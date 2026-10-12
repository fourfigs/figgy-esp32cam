# Figgy dashboard 1.1

The dashboard now lists nearby Wi-Fi networks, shows signal strength and security, offers manual entry for hidden networks, and lets you show/hide the password. Live viewing has a fullscreen button on supported browsers. Connection status and photo-saving feedback are clearer, and Wi-Fi restart instructions remain visible after the device disconnects.

## Network CSV

Open **Wi-Fi networks & CSV**, choose **Scan networks**, and then **Download CSV**. During first-time setup this section opens automatically and network selection fills the sign-in form.

Each scan returns up to 32 of the strongest 2.4 GHz access points, including hidden SSIDs. The network picker groups matching names; the CSV keeps separate BSSIDs. Rescanning accumulates up to 256 of the most recently seen access points **in this browser tab only**. Download before reloading, closing the page, or saving Wi-Fi credentials and restarting. Data is not written to device flash or an SD card.

CSV columns: SSID, BSSID, channel, security, RSSI in dBm, first seen UTC, and last seen UTC. Times come from your browser clock. Hidden SSIDs have an empty name. Signal strength is the most recently observed value. Formula-like SSIDs are prefixed with an apostrophe to keep spreadsheet programs from executing them; quotes, commas, and line breaks are escaped.

Scanning can briefly affect live video. This update does not collect handshakes or force clients to reconnect. Scanning is available through the local dashboard; changing saved Wi-Fi credentials still requires joining Figgy's setup access point. There is no new dashboard login, so keep the device on a trusted local network.

## Update the already-working Episode 001 device

The dashboard is embedded in the firmware, so a reflash is required. No flashing is performed automatically by this project.

With your existing Python environment active, close the serial monitor, put the board into download mode using the procedure that worked for your board, and run:

```sh
python tools/flash.py --check
python -m esptool --chip esp32 --port /dev/cu.usbserial-A5069RR4 --baud 115200 --before no-reset --after no-reset write-flash 0x10000 flash/firmware.bin
```

Replace the serial port if it changes. This application-only update preserves the existing Episode 001 partition table and saved Wi-Fi credentials. Use it only over the original Episode 001 layout preserved in this repository. After writing, take GPIO0 out of download mode and power-cycle the board, then reload the dashboard.

For a fresh install, the existing `tools/flash.py` uploader writes `flash/001_firmware_camesp32-cam.bin` at `0x0`. A factory flash replaces the covered settings as well. The older ZIP and BIN in the parent `episodes/001` folder are the original release; the updated images live in this repository's `flash/` directory.

## Develop and verify

The browser uses plain HTML, CSS, and JavaScript. Prettier is the only npm development dependency. Python bundles those files into a compressed asset so the ESP32 serves the dashboard in one request, with no external scripts, fonts, or stylesheets.

```sh
npm ci --ignore-scripts
npm run format
npm test
python3 tools/embed.py
python3 tools/embed.py --check
pio run
```

After a firmware build, refresh both files in `flash/` from `.pio/build/esp32cam/firmware.bin` and `firmware.factory.bin`, and regenerate SHA256SUMS before committing. `tools/flash.py --check` verifies the packaged images. GitHub Actions runs dashboard, formatting, embedded-asset, firmware-image, and compilation checks.

The original working source and images are preserved under the Git tag `episode-001-original`. New firmware is build-tested and the dashboard behavior is tested with mocked device responses. Actual radio scans, mobile appearance, and live camera behavior still need to be checked on the board. Automated browser launch was blocked by the local sandbox during development.
