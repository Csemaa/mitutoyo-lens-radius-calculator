import argparse
import ctypes
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import re
import subprocess
import sys
import threading
import time
from typing import Any, Dict, List

try:
	import serial
except ImportError:
	serial = None


GENERIC_READ = 0x80000000
GENERIC_WRITE = 0x40000000
OPEN_EXISTING = 3
INVALID_HANDLE_VALUE = ctypes.c_void_p(-1).value


class SerialMeasurementState:
	def __init__(self, port: str) -> None:
		self._lock = threading.Lock()
		self.port = port
		self.connected = False
		self.value = None
		self.raw = ""
		self.updated_at = None
		self.error = "Waiting for first reading"

	def set_connected(self, connected: bool) -> None:
		with self._lock:
			self.connected = connected
			if connected:
				self.error = None

	def set_value(self, value: float, raw: str) -> None:
		with self._lock:
			self.value = value
			self.raw = raw
			self.updated_at = datetime.now(timezone.utc).isoformat()
			self.error = None

	def set_error(self, message: str) -> None:
		with self._lock:
			self.error = message
			self.connected = False

	def to_dict(self) -> Dict[str, Any]:
		with self._lock:
			return {
				"port": self.port,
				"connected": self.connected,
				"value": self.value,
				"raw": self.raw,
				"updated_at": self.updated_at,
				"error": self.error,
			}


def parse_measurement(raw_line: str) -> float:
	# Mitutoyo frames can include numeric prefixes (for example: "01A+0010.779").
	# Prefer the signed decimal measurement token and ignore frame identifiers.
	decimal_matches = re.findall(r"[-+]?\d+[\.,]\d+", raw_line)
	if decimal_matches:
		return float(decimal_matches[-1].replace(",", "."))

	integer_matches = re.findall(r"[-+]?\d+", raw_line)
	if integer_matches:
		return float(integer_matches[-1].replace(",", "."))

	raise ValueError("No numeric value found in serial data")


def serial_reader_loop(
	port_name: str,
	baudrate: int,
	bytesize: int,
	parity: str,
	stopbits: float,
	debug_bytes: bool,
	debug_parsed: bool,
	state: SerialMeasurementState,
) -> None:
	if serial is None:
		state.set_error("pyserial is not installed. Run: pip install pyserial")
		return

	while True:
		try:
			with serial.Serial(
				port=port_name,
				baudrate=baudrate,
				bytesize=bytesize,
				parity=parity,
				stopbits=stopbits,
				timeout=1,
			) as ser:
				state.set_connected(True)
				while True:
					raw_bytes = ser.readline()
					if not raw_bytes:
						continue

					if debug_bytes:
						hex_dump = " ".join(f"{byte_value:02X}" for byte_value in raw_bytes)
						ascii_dump = raw_bytes.decode("ascii", errors="replace").rstrip("\r\n")
						print(f"[SERIAL RAW] len={len(raw_bytes)} hex={hex_dump} ascii={ascii_dump}")

					raw_line = raw_bytes.decode("ascii", errors="ignore").strip()
					if not raw_line:
						continue

					try:
						value = parse_measurement(raw_line)
						state.set_value(value, raw_line)
						if debug_parsed:
							print(f"[SERIAL PARSED] value={value} line={raw_line}")
					except ValueError:
						# Keep reading when payload lines contain framing/status text.
						continue
		except Exception as exc:  # serial errors vary by platform/backend
			state.set_error(str(exc))
			time.sleep(1)


def make_measurement_handler(state: SerialMeasurementState):
	class MeasurementHandler(BaseHTTPRequestHandler):
		def _send_json(self, status_code: int, payload: Dict[str, Any]) -> None:
			body = json.dumps(payload, ensure_ascii=True).encode("utf-8")
			self.send_response(status_code)
			self.send_header("Content-Type", "application/json; charset=utf-8")
			self.send_header("Content-Length", str(len(body)))
			self.send_header("Access-Control-Allow-Origin", "*")
			self.end_headers()
			self.wfile.write(body)

		def do_OPTIONS(self) -> None:
			self.send_response(HTTPStatus.NO_CONTENT)
			self.send_header("Access-Control-Allow-Origin", "*")
			self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
			self.send_header("Access-Control-Allow-Headers", "Content-Type")
			self.end_headers()

		def do_GET(self) -> None:
			if self.path == "/measurement":
				self._send_json(HTTPStatus.OK, state.to_dict())
				return

			if self.path == "/health":
				self._send_json(HTTPStatus.OK, {"status": "ok"})
				return

			self._send_json(HTTPStatus.NOT_FOUND, {"error": "Not found"})

		def log_message(self, format: str, *args: Any) -> None:
			return

	return MeasurementHandler


def run_measurement_server(
	port_name: str,
	baudrate: int,
	bytesize: int,
	parity: str,
	stopbits: float,
	debug_bytes: bool,
	debug_parsed: bool,
	host: str,
	http_port: int,
) -> int:
	state = SerialMeasurementState(port_name)

	reader = threading.Thread(
		target=serial_reader_loop,
		args=(port_name, baudrate, bytesize, parity, stopbits, debug_bytes, debug_parsed, state),
		daemon=True,
	)
	reader.start()

	handler = make_measurement_handler(state)
	server = ThreadingHTTPServer((host, http_port), handler)

	print(f"Serial reader listening on {port_name}")
	print(f"HTTP API available at http://{host}:{http_port}/measurement")
	if debug_bytes:
		print("Serial raw byte debug output is enabled.")
	if debug_parsed:
		print("Serial parsed value debug output is enabled.")

	try:
		server.serve_forever()
	except KeyboardInterrupt:
		print("\nStopping server...")
	finally:
		server.server_close()

	return 0


def run_powershell_json(command: str) -> Any:
	"""Run a PowerShell command and parse JSON output."""
	full_command = [
		"powershell",
		"-NoProfile",
		"-ExecutionPolicy",
		"Bypass",
		"-Command",
		command,
	]
	result = subprocess.run(full_command, capture_output=True, text=True, check=False)

	if result.returncode != 0:
		raise RuntimeError(
			f"PowerShell failed with exit code {result.returncode}: {result.stderr.strip()}"
		)

	output = result.stdout.strip()
	if not output:
		return []

	try:
		return json.loads(output)
	except json.JSONDecodeError as exc:
		raise RuntimeError(f"Could not parse PowerShell JSON output: {exc}") from exc


def normalize_to_list(data: Any) -> List[Dict[str, Any]]:
	if data is None:
		return []
	if isinstance(data, list):
		return data
	if isinstance(data, dict):
		return [data]
	return []


def get_usb_pnp_devices() -> List[Dict[str, Any]]:
	# Win32_PnPEntity provides USB-connected devices and identity fields.
	ps = (
		"Get-CimInstance Win32_PnPEntity | "
		"Where-Object { $_.PNPDeviceID -like 'USB*' } | "
		"Select-Object Name, Description, DeviceID, PNPDeviceID, Manufacturer, Status, Service | "
		"ConvertTo-Json -Depth 4"
	)
	data = run_powershell_json(ps)
	return normalize_to_list(data)


def get_usb_hub_ports() -> List[Dict[str, Any]]:
	# USB hubs/controllers often expose port-level information via Win32_USBHub.
	ps = (
		"Get-CimInstance Win32_USBHub | "
		"Select-Object Name, DeviceID, PNPDeviceID, Description, Status, NumberOfPorts | "
		"ConvertTo-Json -Depth 4"
	)
	data = run_powershell_json(ps)
	return normalize_to_list(data)


def get_com_ports() -> List[Dict[str, Any]]:
	# Win32_SerialPort maps active serial interfaces to COM names.
	ps = (
		"Get-CimInstance Win32_SerialPort | "
		"Select-Object DeviceID, Name, Description, PNPDeviceID, Manufacturer, Status, MaxBaudRate | "
		"ConvertTo-Json -Depth 4"
	)
	data = run_powershell_json(ps)
	return normalize_to_list(data)


def normalize_com_port_name(port_name: str) -> str:
	name = port_name.strip().upper()
	if name.startswith("\\\\.\\"):
		return name
	if not name.startswith("COM"):
		raise ValueError("COM port must look like COM3, COM4, etc.")
	return f"\\\\.\\{name}"


def try_open_com_port(port_name: str, hold_seconds: float) -> Dict[str, Any]:
	"""Try opening a COM port and keep it open briefly if requested."""
	try:
		normalized_name = normalize_com_port_name(port_name)
	except ValueError as exc:
		return {
			"requested_port": port_name,
			"opened": False,
			"error": str(exc),
		}

	handle = ctypes.windll.kernel32.CreateFileW(
		normalized_name,
		GENERIC_READ | GENERIC_WRITE,
		0,
		None,
		OPEN_EXISTING,
		0,
		None,
	)

	if handle == INVALID_HANDLE_VALUE:
		error_code = ctypes.GetLastError()
		error_message = ctypes.FormatError(error_code).strip()
		return {
			"requested_port": port_name,
			"normalized_port": normalized_name,
			"opened": False,
			"error_code": error_code,
			"error": error_message,
		}

	try:
		if hold_seconds > 0:
			time.sleep(hold_seconds)
	finally:
		ctypes.windll.kernel32.CloseHandle(handle)

	return {
		"requested_port": port_name,
		"normalized_port": normalized_name,
		"opened": True,
		"held_seconds": hold_seconds,
	}


def print_human_readable(
	hubs: List[Dict[str, Any]],
	devices: List[Dict[str, Any]],
	com_ports: List[Dict[str, Any]],
) -> None:
	print("USB HUBS / CONTROLLERS")
	print("-" * 60)
	if not hubs:
		print("No USB hub/controller info found.")
	else:
		for idx, hub in enumerate(hubs, start=1):
			name = hub.get("Name") or "(unknown)"
			ports = hub.get("NumberOfPorts")
			status = hub.get("Status") or "Unknown"
			pnp = hub.get("PNPDeviceID") or "(none)"
			print(f"{idx}. {name}")
			print(f"   Ports: {ports if ports is not None else 'n/a'}")
			print(f"   Status: {status}")
			print(f"   PNPDeviceID: {pnp}")

	print()
	print("USB DEVICES")
	print("-" * 60)
	if not devices:
		print("No USB devices found.")
		return

	for idx, dev in enumerate(devices, start=1):
		name = dev.get("Name") or dev.get("Description") or "(unknown)"
		manufacturer = dev.get("Manufacturer") or "Unknown"
		status = dev.get("Status") or "Unknown"
		pnp = dev.get("PNPDeviceID") or "(none)"
		print(f"{idx}. {name}")
		print(f"   Manufacturer: {manufacturer}")
		print(f"   Status: {status}")
		print(f"   PNPDeviceID: {pnp}")

	print()
	print("COM PORTS")
	print("-" * 60)
	if not com_ports:
		print("No COM ports found.")
		return

	for idx, port in enumerate(com_ports, start=1):
		port_name = port.get("DeviceID") or "(unknown)"
		name = port.get("Name") or port.get("Description") or "(unknown)"
		manufacturer = port.get("Manufacturer") or "Unknown"
		status = port.get("Status") or "Unknown"
		pnp = port.get("PNPDeviceID") or "(none)"
		max_baud = port.get("MaxBaudRate")
		print(f"{idx}. {port_name} - {name}")
		print(f"   Manufacturer: {manufacturer}")
		print(f"   Status: {status}")
		print(f"   MaxBaudRate: {max_baud if max_baud is not None else 'n/a'}")
		print(f"   PNPDeviceID: {pnp}")


def main() -> int:
	parser = argparse.ArgumentParser(
		description="Scan USB and COM ports/devices on Windows and print details."
	)
	parser.add_argument(
		"--serve",
		action="store_true",
		help="Start COM measurement HTTP service (GET /measurement).",
	)
	parser.add_argument(
		"--serial-port",
		type=str,
		default="COM3",
		help="Serial port to read from when --serve is enabled (default: COM3).",
	)
	parser.add_argument(
		"--baudrate",
		type=int,
		default=9600,
		help="Serial baud rate for --serve mode (default: 9600).",
	)
	parser.add_argument(
		"--bytesize",
		type=int,
		choices=[5, 6, 7, 8],
		default=8,
		help="Serial byte size for --serve mode (default: 8).",
	)
	parser.add_argument(
		"--parity",
		type=str,
		choices=["N", "E", "O", "M", "S"],
		default="N",
		help="Serial parity for --serve mode (default: N).",
	)
	parser.add_argument(
		"--stopbits",
		type=float,
		choices=[1, 1.5, 2],
		default=1,
		help="Serial stop bits for --serve mode (default: 1).",
	)
	parser.add_argument(
		"--debug-bytes",
		action="store_true",
		help="Print each received serial packet as hex and ASCII in --serve mode.",
	)
	parser.add_argument(
		"--debug-parsed",
		action="store_true",
		help="Print parsed numeric values in --serve mode.",
	)
	parser.add_argument(
		"--host",
		type=str,
		default="127.0.0.1",
		help="HTTP host for --serve mode (default: 127.0.0.1).",
	)
	parser.add_argument(
		"--http-port",
		type=int,
		default=8000,
		help="HTTP port for --serve mode (default: 8000).",
	)
	parser.add_argument(
		"--json",
		action="store_true",
		help="Print raw structured data as JSON.",
	)
	parser.add_argument(
		"--open-com",
		type=str,
		help="Try opening a COM port (example: COM3).",
	)
	parser.add_argument(
		"--hold-seconds",
		type=float,
		default=0,
		help="When opening a COM port, keep it open for this many seconds before closing.",
	)
	args = parser.parse_args()

	if sys.platform != "win32":
		print("This script currently supports Windows only.", file=sys.stderr)
		return 1

	if args.serve:
		return run_measurement_server(
			port_name=args.serial_port,
			baudrate=args.baudrate,
			bytesize=args.bytesize,
			parity=args.parity,
			stopbits=args.stopbits,
			debug_bytes=args.debug_bytes,
			debug_parsed=args.debug_parsed,
			host=args.host,
			http_port=args.http_port,
		)

	try:
		hubs = get_usb_hub_ports()
		devices = get_usb_pnp_devices()
		com_ports = get_com_ports()
	except RuntimeError as exc:
		print(f"Error: {exc}", file=sys.stderr)
		return 1

	open_result = None
	if args.open_com:
		open_result = try_open_com_port(args.open_com, max(0.0, args.hold_seconds))

	if args.json:
		print(
			json.dumps(
				{
					"usb_hubs": hubs,
					"usb_devices": devices,
					"com_ports": com_ports,
					"open_com_result": open_result,
				},
				indent=2,
				ensure_ascii=True,
			)
		)
	else:
		print_human_readable(hubs, devices, com_ports)
		if open_result is not None:
			print()
			print("COM OPEN TEST")
			print("-" * 60)
			if open_result.get("opened"):
				print(
					f"Opened {open_result.get('requested_port')} successfully"
					f" (held {open_result.get('held_seconds', 0)}s)."
				)
			else:
				error_code = open_result.get("error_code")
				error_text = open_result.get("error") or "Unknown error"
				if error_code is not None:
					print(
						f"Failed to open {open_result.get('requested_port')} "
						f"(WinError {error_code}): {error_text}"
					)
				else:
					print(f"Failed to open {open_result.get('requested_port')}: {error_text}")

	return 0


if __name__ == "__main__":
	raise SystemExit(main())
