import http from 'node:http';
import process from 'node:process';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

const SERIAL_PORT = process.env.SERIAL_PORT ?? 'COM3';
const BAUD_RATE = Number(process.env.SERIAL_BAUD ?? '9600');
const HTTP_HOST = process.env.BRIDGE_HOST ?? '127.0.0.1';
const HTTP_PORT = Number(process.env.BRIDGE_PORT ?? '8000');
const DEBUG_BYTES = process.argv.includes('--debug-bytes');
const DEBUG_PARSED = process.argv.includes('--debug-parsed');

const state = {
  port: SERIAL_PORT,
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
  });

  port.on('close', () => {
    state.connected = false;
    state.error = 'Serial port closed';
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

startHttpServer();
startSerialReader();
