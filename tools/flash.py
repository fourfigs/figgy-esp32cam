#!/usr/bin/env python3
"""Validate and flash the AI Thinker ESP32-CAM factory image."""
import argparse
import hashlib
import importlib.metadata
from pathlib import Path
import struct
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
IMAGE = ROOT / 'flash/001_firmware_camesp32-cam.bin'

def validate():
    entries = {}
    for line in (ROOT / 'flash/SHA256SUMS').read_text().splitlines():
        digest, name = line.split()
        entries[name] = digest
    data = IMAGE.read_bytes()
    if hashlib.sha256(data).hexdigest() != entries[IMAGE.name]:
        raise ValueError('Factory image checksum mismatch')
    if not 0x10000 < len(data) <= 0x400000:
        raise ValueError('Invalid image length for 4 MB flash')
    # ESP32 image headers: magic, SPI mode DIO, size 4 MB / frequency 40 MHz.
    if data[0x1000] != 0xE9 or data[0x1002:0x1004] != b'\x02\x20':
        raise ValueError('Bootloader header is not DIO / 40 MHz / 4 MB')
    if struct.unpack_from('<H', data, 0x1000 + 12)[0] != 0:
        raise ValueError('Bootloader is not for the original ESP32')
    if data[0x10000] != 0xE9:
        raise ValueError('Application missing at 0x10000')
    app = (ROOT / 'flash/firmware.bin').read_bytes()
    if hashlib.sha256(app).hexdigest() != entries['firmware.bin']:
        raise ValueError('Application checksum mismatch')
    if data[0x10000:0x10000 + len(app)] != app:
        raise ValueError('Factory image does not contain the packaged application')
    partitions = []
    for pos in range(0x8000, 0x8C00, 32):
        magic, kind, subtype, offset, size = struct.unpack_from('<HBBII', data, pos)
        if magic != 0x50AA:
            break
        if offset + size > 0x400000:
            raise ValueError('Partition exceeds 4 MB flash')
        partitions.append((offset, size, kind))
    for previous, current in zip(sorted(partitions), sorted(partitions)[1:]):
        if previous[0] + previous[1] > current[0]:
            raise ValueError('Overlapping partitions')
    if not any(offset == 0x10000 and kind == 0 and len(app) <= size
               for offset, size, kind in partitions):
        raise ValueError('Application does not fit the partition table')
    print('PASS: checksums, ESP32 boot header, DIO/40 MHz/4 MB, partitions and app offset.', flush=True)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', help='USB serial device, e.g. /dev/cu.usbserial-XXXX or COM5')
    parser.add_argument('--check', action='store_true', help='Validate files only; never access a serial port')
    parser.add_argument('--list-ports', action='store_true', help='List available serial ports without flashing')
    parser.add_argument('--manual-reset', action='store_true', help='Skip automatic reset; jumper GPIO0 to GND and reset before running')
    parser.add_argument('--baud', type=int, default=115200, choices=[9600, 57600, 115200, 230400, 460800])
    args = parser.parse_args()
    try:
        validate()
    except (OSError, ValueError, KeyError, struct.error) as exc:
        parser.exit(1, f'Image check failed: {exc}. Flash cancelled.\n')
    if args.check:
        return 0
    try:
        version = importlib.metadata.version('esptool')
        if int(version.split('.')[0]) != 5:
            raise ValueError('esptool 5.x required')
    except (importlib.metadata.PackageNotFoundError, ValueError):
        parser.exit(1, 'Install the supported uploader in this Python environment:\n'
                    f'  "{sys.executable}" -m pip install "esptool>=5,<6"\n')
    if args.list_ports:
        from serial.tools.list_ports import comports
        ports = list(comports())
        for port in ports:
            print(f'{port.device}: {port.description}')
        if not ports:
            print('No serial ports found. Connect a USB data cable and programmer.')
        return 0
    if not args.port:
        parser.error('--port is required to flash; use --list-ports to find it')
    print('Flashing factory image at 0x0; existing firmware and covered settings are replaced.\n'
          'Close serial monitors. Keep GPIO0 jumpered to GND until upload finishes.', flush=True)
    command = [sys.executable, '-m', 'esptool', '--chip', 'esp32', '--port', args.port,
               '--baud', str(args.baud), '--before', 'no-reset' if args.manual_reset else 'default-reset',
               '--after', 'no-reset', 'write-flash', '0x0', str(IMAGE)]
    result = subprocess.run(command, check=False)
    if result.returncode:
        print('Upload failed. Check the selected port, GPIO0-to-GND jumper and power.\n'
              'Reset with the jumper attached, then retry with --manual-reset.\n'
              'For noisy serial links, add --baud 57600.', file=sys.stderr)
        return result.returncode
    print('Upload verified by esptool. Remove GPIO0-to-GND, then reset/power-cycle.\n'
          'Join Gettin-Figgy-XXXXXX / FiggySetup! and open http://192.168.4.1')
    return 0

if __name__ == '__main__':
    sys.exit(main())
