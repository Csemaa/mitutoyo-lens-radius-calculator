import http from 'node:http';
import process from 'node:process';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import fs from 'node:fs';
import os from 'node:os';

const PLATFORM = os.platform();
const DEFAULT_DEVICE_MODE = PLATFORM === 'linux' ? 'hid' : 'serial';
const DEVICE_MODE = process.env.DEVICE_MODE ?? DEFAULT_DEVICE_MODE; // 'serial' or 'hid'
const HID_PATH = process.env.HID_PATH ?? '/dev/hidraw3';
const SERIAL_PORT = process.env.SERIAL_PORT ?? 'COM3';
const DEVICE_PORT = DEVICE_MODE === 'hid' ? HID_PATH : SERIAL_PORT;
const BAUD_RATE = Number(process.env.SERIAL_BAUD ?? '9600');
const HTTP_HOST = process.env.BRIDGE_HOST ?? '127.0.0.1';
const HTTP_PORT = Number(process.env.BRIDGE_PORT ?? '8000');
const POLL_INTERVAL_MS = Number(process.env.SERIAL_POLL_MS ?? '300');
const POLL_COMMAND = Buffer.from([49, 13]); // ASCII: "1\r"
const DEBUG_BYTES = process.argv.includes('--debug-bytes');
const DEBUG_PARSED = process.argv.includes('--debug-parsed');
const DEBUG_POLL = process.argv.includes('--debug-poll');

const state = {
  mode: DEVICE_MODE,
  port: DEVICE_PORT,
  connected: false,
  value: null,
  raw: '',
  updated_at: null,
  error: 'Waiting for first reading',
};

function parseMeasurement(line) {
  const decimalMatches = line.match(/[-+]?\d+[\.,]\d+/g);
  if (decimalMatches && decimalMatches.length > 0) {
    const measurement = decimalMatches[decimalMatches.length - 1];
    return Number.parseFloat(measurement.replace(',', '.'));
  }

  const integerMatches = line.match(/[-+]?\d+/g);
  if (integerMatches && integerMatches.length > 0) {
    const measurement = integerMatches[integerMatches.length - 1];
    return Number.parseFloat(measurement.replace(',', '.'));
  }

  return null;
}

function writeJson(res, code, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(body.length),
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function startHttpServer() {
  const server = http.createServer((req, res) => {
    if (!req.url) {
      writeJson(res, 400, { error: 'Bad request' });
      return;
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url === '/measurement') {
      writeJson(res, 200, state);
      return;
    }

    if (req.method === 'GET' && req.url === '/health') {
      writeJson(res, 200, { status: 'ok' });
      return;
    }

    writeJson(res, 404, { error: 'Not found' });
  });

  server.listen(HTTP_PORT, HTTP_HOST, () => {
    console.log(`HTTP API available at http://${HTTP_HOST}:${HTTP_PORT}/measurement`);
  });
}

function startSerialReader() {
	let pollTimer = null;

  const port = new SerialPort({
    path: SERIAL_PORT,
    baudRate: BAUD_RATE,
    dataBits: 8,
    parity: 'none',
    stopBits: 1,
    autoOpen: false,
  });

  const parser = port.pipe(new ReadlineParser({ delimiter: '\r' }));

  port.on('open', () => {
    state.connected = true;
    state.error = null;
    console.log(`Serial reader listening on ${SERIAL_PORT} @ ${BAUD_RATE}`);

    const sendPoll = () => {
      if (!port.isOpen) {
        return;
      }

      port.write(POLL_COMMAND, (error) => {
        if (error) {
          state.error = error.message;
          if (DEBUG_POLL) {
            console.log(`[SERIAL POLL] write error=${error.message}`);
          }
          return;
        }

        if (DEBUG_POLL) {
          console.log('[SERIAL POLL] sent=31 0D ascii=1\\r');
        }
      });
    };

    sendPoll();
    pollTimer = setInterval(sendPoll, POLL_INTERVAL_MS);
  });

  port.on('close', () => {
    state.connected = false;
    state.error = 'Serial port closed';
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  });

  port.on('error', (error) => {
    state.connected = false;
    state.error = error.message;
  });

  port.on('data', (chunk) => {
    if (!DEBUG_BYTES) {
      return;
    }

    const hex = [...chunk].map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    const ascii = chunk.toString('ascii').replace(/[\r\n]+$/, '');
    console.log(`[SERIAL RAW] len=${chunk.length} hex=${hex} ascii=${ascii}`);
  });

  parser.on('data', (line) => {
    const trimmed = String(line).trim();
    if (!trimmed) {
      return;
    }

    const parsed = parseMeasurement(trimmed);
    if (Number.isFinite(parsed)) {
      state.value = parsed;
      state.raw = trimmed;
      state.updated_at = new Date().toISOString();
      state.error = null;
      if (DEBUG_PARSED) {
        console.log(`[SERIAL PARSED] value=${parsed} line=${trimmed}`);
      }
      return;
    }

    if (DEBUG_PARSED) {
      console.log(`[SERIAL PARSED] skipped line=${trimmed}`);
    }
  });

  const tryOpen = () => {
    port.open((error) => {
      if (!error) {
        return;
      }

      state.connected = false;
      state.error = error.message;
      setTimeout(tryOpen, 1000);
    });
  };

  tryOpen();
}

function startHidReader() {
  let pollTimer = null;
  let readTimer = null;
  let buffer = Buffer.alloc(0);

  console.log(`HID reader listening on ${HID_PATH}`);

  // Open HID device read/write so we can send poll commands
  let fd = null;

  const tryOpen = () => {
    try {
      fd = fs.openSync(HID_PATH, fs.constants.O_RDWR);
      state.connected = true;
      state.error = null;
      if (DEBUG_PARSED) {
        console.log(`HID connected: ${HID_PATH}`);
      }
    } catch (error) {
      state.connected = false;
      state.error = `Failed to open HID: ${error.message}`;
      setTimeout(tryOpen, 1000);
    }
  };

  tryOpen();

  // Function to send poll command (same POLL_COMMAND as serial)
  const sendPoll = () => {
    if (fd === null) {
      return;
    }

    try {
      fs.writeSync(fd, POLL_COMMAND);
      if (DEBUG_POLL) {
        console.log('[HID POLL] sent=31 0D ascii=1\\r');
      }
    } catch (error) {
      state.error = error.message;
      if (DEBUG_POLL) {
        console.log(`[HID POLL] write error=${error.message}`);
      }
    }
  };

  // Start polling
  sendPoll();
  pollTimer = setInterval(sendPoll, POLL_INTERVAL_MS);

  // Simple read loop using a separate timer
  const READ_CHUNK = 64;

  const readLoop = () => {
    if (fd === null) {
      return;
    }

    try {
      const chunk = Buffer.alloc(READ_CHUNK);
      const bytesRead = fs.readSync(fd, chunk, 0, READ_CHUNK, null);

      if (bytesRead > 0) {
        const data = chunk.subarray(0, bytesRead);

        if (DEBUG_BYTES) {
          const hex = [...data].map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
          const ascii = data.toString('ascii').replace(/[\r\n]+$/, '');
          console.log(`[HID RAW] len=${bytesRead} hex=${hex} ascii=${ascii}`);
        }

        // Accumulate and split on \r (same framing as serial)
        buffer = Buffer.concat([buffer, data]);

        let idx;
        while ((idx = buffer.indexOf('\r')) !== -1) {
          const lineBuf = buffer.subarray(0, idx);
          buffer = buffer.subarray(idx + 1);

          const line = lineBuf.toString('ascii').trim();
          if (!line) {
            continue;
          }

          const parsed = parseMeasurement(line);
          if (Number.isFinite(parsed)) {
            state.value = parsed;
            state.raw = line;
            state.updated_at = new Date().toISOString();
            state.error = null;
            if (DEBUG_PARSED) {
              console.log(`[HID PARSED] value=${parsed} line=${line}`);
            }
          } else if (DEBUG_PARSED) {
            console.log(`[HID PARSED] skipped line=${line}`);
          }
        }
      }
    } catch (error) {
      state.connected = false;
      state.error = `HID read error: ${error.message}`;
      if (fd !== null) {
        try {
          fs.closeSync(fd);
        } catch {
          // Ignore close errors on reconnect.
        }
      }
      fd = null;
      tryOpen();
    }
  };

  // Poll for data regularly
  readTimer = setInterval(readLoop, 50);

  // Ensure timers are cleared on process exit.
  const cleanup = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (readTimer) {
      clearInterval(readTimer);
      readTimer = null;
    }
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // Ignore close errors during shutdown.
      }
      fd = null;
    }
  };

  process.once('SIGINT', cleanup);
  process.once('SIGTERM', cleanup);
}


startHttpServer();

console.log(`Device mode: ${DEVICE_MODE} (${PLATFORM})`);

if (DEVICE_MODE === 'hid') {
  startHidReader();
} else {
  startSerialReader();
}
