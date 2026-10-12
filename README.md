# GETTIN’ FIGGY WITH IT!! — EPISODE 001
## 001_firmware_camesp32-cam.bin

Your camera, your point of view. This firmware gives you a local web dashboard, live video, and a Save photo button.

Build it. Break it. Know it!

## What you need

- AI Thinker ESP32-CAM with an OV3660 camera and 4 MB flash.
- An ESP32-CAM USB programmer/base, or a USB-to-serial adapter with 3.3 V UART logic.
- A USB data cable, stable power, and a jumper for IO0 to GND.
- A computer with Python 3 and the matching episode ZIP extracted into a writable folder.

With an external serial adapter, connect adapter TX to board U0R, adapter RX to board U0T, and common GND. Supply stable 5 V to the board’s 5V pin. Do not apply 5 V logic to its UART pins. Avoid connecting competing power supplies.

## Pick your download

`001_firmware_camesp32-cam.bin` is the complete factory image. It contains the bootloader, partition table, dashboard artwork, and application. Flash this ONE file at **0x0**. Do not use 0x10000 for this file. No separate filesystem upload is needed.

`001_firmware_camesp32-cam.zip` contains the same image under `flash/`, the upload helper, editable source, and instructions. Extract the ZIP before running its tools. Commands below run from the extracted episode folder, where `platformio.ini` and `tools/` are located. Replace placeholders with YOUR values; no author-specific paths are required.

## Find YOUR_PORT before flashing

Figgy says: `YOUR_PORT` is a placeholder, folks — don't type it literally! Replace it with the serial port assigned to YOUR USB programmer. The camera’s IP address and Wi-Fi name are not serial ports.

### The reliable check: unplug, list, plug in, list again

1. Close any serial monitor. With the programmer unplugged, list the available ports.
2. Plug in the programmer using a **USB data cable**, wait a few seconds, and list ports again.
3. The new entry is usually your programmer. Unplug it once more if you need to confirm which entry disappears. Reconnect and check its name again before uploading.

You can find the port without the IO0 jumper attached. The jumper is needed when entering download mode for flashing, not for discovering the USB serial device.

From the extracted firmware folder, with esptool installed, use either command:

```sh
python3 tools/flash.py --list-ports
python3 -m serial.tools.list_ports -v
```

On Windows, use your working `python` or `py` command in place of `python3`. The first command also checks the packaged firmware; the second works without the firmware ZIP. If the second reports a missing `serial` module, install esptool into that same Python environment as described below.

### Windows: look for COM followed by a number

1. Right-click Start and open **Device Manager**.
2. Expand **Ports (COM & LPT)**.
3. Unplug/replug the programmer and identify the entry that disappears/reappears. It might say USB Serial Port, USB-SERIAL CH340, or Silicon Labs CP210x, followed by a port such as **(COM5)**.
4. Use only **COM5** in the command — not the description or parentheses. Your number may be different.

Example, only if your device appears as COM5:

```sh
python tools/flash.py --port COM5 --manual-reset
```

If Ports is absent or the programmer appears under Other devices with a warning icon, check the cable and install the driver supplied by the programmer/chip vendor. Then reconnect and check again. Bluetooth COM ports are not the camera programmer.

### macOS: use the /dev/cu. device

In Terminal, run this before and after connecting the programmer:

```sh
ls /dev/cu.*
```

Look for a new USB serial entry, often `/dev/cu.usbserial-...`, `/dev/cu.wchusbserial...`, or `/dev/cu.SLAB_USBtoUART`. Copy its complete name. Do not choose `/dev/cu.Bluetooth-Incoming-Port` or `/dev/cu.debug-console`. A “no matches found” message can simply mean no matching devices are currently present.

Example, only if that exact name appears on your computer:

```sh
python3 tools/flash.py --port /dev/cu.usbserial-110 --manual-reset
```

### Linux: look for /dev/ttyUSB or /dev/ttyACM

Use `python3 -m serial.tools.list_ports -v`, or check:

```sh
ls /dev/ttyUSB* /dev/ttyACM* 2>/dev/null
```

Compare before and after connecting. A typical programmer is `/dev/ttyUSB0`; some USB devices use `/dev/ttyACM0`. Missing-pattern messages are harmless if one device family is absent. If a device appears but access is denied, follow your Linux distribution’s serial-port permission instructions; the required group varies by distribution. Do not assume running the whole editor as root is necessary.

Example, only if your programmer is ttyUSB0:

```sh
python3 tools/flash.py --port /dev/ttyUSB0 --manual-reset
```

### Select the same port in your editor

- **Arduino IDE:** use **Tools → Port** or the board/port selector. Choose the entry identified by the unplug/replug check. A generic “Unknown” USB board name can still be the correct port; select **AI Thinker ESP32-CAM** as the board separately.
- **VS Code + PlatformIO:** open **PlatformIO: Open PlatformIO Core CLI** from the Command Palette and run `pio device list`. Use that device in `pio run -e esp32cam -t upload --upload-port YOUR_PORT`. To save a fixed choice, add `upload_port = YOUR_ACTUAL_PORT` beneath `[env:esp32cam]` in `platformio.ini`; optionally add `monitor_port = YOUR_ACTUAL_PORT` too. Replace those placeholders with the real device name.

If no new port appears, check the USB cable, USB port/hub, programmer driver, and programmer connection. Wi-Fi connectivity will not create a USB serial port. Port names can change after reconnecting or moving USB sockets, so check again when an upload says the port cannot be found. Close Arduino Serial Monitor, PlatformIO Monitor, and other terminal programs before flashing.

## Flash with esptool (no IDE needed)

1. Disconnect power. Bridge **IO0 (the number zero) to GND** using a real ground pin.
2. Connect the programmer and power the board, or press RST with that jumper attached. This starts download mode. Close any serial monitor using the port.
3. Install the uploader in your Python environment:

   ```sh
   python3 -m pip install "esptool>=5,<6"
   ```

   If your system requires a virtual environment, create one with `python3 -m venv .venv`, then activate it using `source .venv/bin/activate` on macOS/Linux or `.venv\Scripts\activate` in Windows Command Prompt. On Windows, use `python` or `py` instead of `python3` if appropriate for your installation.

4. Check the packaged image, list ports, then flash:

   ```sh
   python3 tools/flash.py --check
   python3 tools/flash.py --list-ports
   python3 tools/flash.py --port YOUR_PORT --manual-reset
   ```

   YOUR_PORT might be `COM5` on Windows, `/dev/cu.usbserial-XXXX` on macOS, or `/dev/ttyUSB0` on Linux. Choose the port belonging to your programmer. The helper checks the image and writes at 115200 baud. `--manual-reset` means you already reset with IO0 grounded.

5. Wait for successful completion. **Remove the IO0-to-GND jumper, then reset or power-cycle.** The uploader intentionally leaves the chip in its loader until you do this. IO0 also carries the camera clock during normal operation, so do not leave it grounded.

Flashing replaces existing firmware and can clear saved Wi-Fi settings. A separate full-chip erase is not required.

### Direct esptool commands — using only the BIN

If you downloaded only the BIN, install esptool as shown above and open a terminal in the folder containing it. You do not need Arduino IDE or VS Code for this method. List the serial devices with:

```sh
python3 -m serial.tools.list_ports
```

Choose the programmer's port. With IO0 bridged to GND, reset/power-cycle to enter download mode, then run:

```sh
python3 -m esptool --chip esp32 --port YOUR_PORT --baud 115200 --before no-reset --after no-reset write-flash 0x0 001_firmware_camesp32-cam.bin
```

Wait for esptool to finish without errors and report successful verification. Remove the jumper and reset afterward. The ZIP helper provides additional file/header checks; this direct command uses esptool’s normal upload verification.

`--chip esp32` selects the original ESP32, `--before no-reset` uses the download mode you entered manually, and `--after no-reset` leaves the board in its loader until you remove the jumper and reset. The final `0x0` is the write address for this complete factory image. Do not use `erase-flash` or `--force` as a routine step.

If the command cannot open the port, close serial monitors and check YOUR_PORT. If no data is received, reset again with IO0 grounded. If transfer fails partway through, check power/cable quality and retry with `--baud 57600`. A missing `esptool` module means it must be installed into the same Python interpreter used to run the command. On Windows, replace `python3` with your working `python` or `py` command consistently.

## First connection

1. Join the Wi-Fi network **Gettin-Figgy-XXXXXX**.
2. Enter password **FiggySetup!**.
3. Open **http://192.168.4.1** in your browser. Stay connected if your computer reports that this network has no internet.
4. Optionally open **Connect to your Wi-Fi**, enter a **2.4 GHz** network name and password, then save. The board restarts.
5. Reconnect your computer to that network and open **http://gettin-figgy.local**. If that name does not resolve, use the board’s IP from your router’s client list or its serial log at **115200 baud**.

If the board cannot join the saved network, its setup network returns. After a later sustained Wi-Fi outage, the setup network can also return and remains available until restart. Wi-Fi changes are accepted through the setup network. The setup password is shared by this build, and the dashboard has no login; keep it on a trusted local network.

## Use your camera

- **Start stream** begins live video; **Stop stream** pauses it.
- **Save photo** downloads a JPEG to your computer or phone.
- Leaving or hiding the browser tab pauses the stream. Start it again when you return.
- One active live-video viewer is supported. Saving a photo can briefly pause video.

The dashboard works without internet access. The default is VGA when PSRAM is available, with a QVGA fallback. This build does not record video to an SD card or provide an internet viewing service.

## Build and upload with Arduino IDE

Figgy says: pick one editor and follow that path. Arduino IDE uses the single `.ino` sketch; VS Code uses the included PlatformIO project. Both build the firmware from source. To flash the downloaded BIN without rebuilding, use the earlier upload-helper instructions instead.

1. Install **Arduino IDE 2.x** from [Arduino’s downloads page](https://www.arduino.cc/en/software). Extract the matching firmware ZIP into a folder you can edit.
2. Open Arduino IDE’s **Preferences/Settings**. In **Additional Boards Manager URLs**, add this URL without deleting any URLs already there:

   ```text
   https://espressif.github.io/arduino-esp32/package_esp32_index.json
   ```

3. Open **Boards Manager**, search for **esp32**, and install **esp32 by Espressif Systems**, version **3.3.9**, to match this firmware’s Arduino core. Wait for its tools to finish installing. The camera and networking libraries used here come with that board package; no separate camera library install is needed.
4. Use **File → Open** and select `FiggyEpisode001/FiggyEpisode001.ino` from the extracted package. Keep the sketch in its same-named folder. All firmware code and brand artwork are included in that one file.
5. Under **Tools → Board → esp32**, choose **AI Thinker ESP32-CAM**. Choose the programmer’s serial port under **Tools → Port** or the board/port selector.
6. Check these settings where the selected board exposes them:

   | Setting | Value |
   |---|---|
   | Partition Scheme | Huge APP (3 MB, no OTA) |
   | Flash Size | 4 MB |
   | Flash Mode | DIO |
   | Flash Frequency | 40 MHz |
   | Upload Speed | 115200 |
   | PSRAM | Enabled, if a menu is shown |

   Some values are fixed by the board definition and have no menu. Keep those board defaults. Do not select a different processor family to expose more options.
7. Click **Verify** (checkmark) to compile. The Arduino IDE workflow has not been run in this session; the pinned PlatformIO configuration below is the build verified here.
8. Close Serial Monitor. With power off, bridge **IO0 to GND**, then power on or tap **RST**. Click **Upload** (right arrow). If it stays at “Connecting,” tap RST while IO0 is still grounded.
9. After upload completes, remove the IO0-to-GND jumper and reset/power-cycle. Open **Tools → Serial Monitor**, choose **115200 baud**, and reset again if you missed the startup messages. Follow the Wi-Fi connection instructions above.

If the sketch is too large, recheck the Huge APP partition selection. If the port is unavailable, close other serial programs. If a library is reported missing, confirm that you installed the Espressif board package and selected its AI Thinker board.

Official board-installation reference: [Espressif Arduino-ESP32 installation](https://docs.espressif.com/projects/arduino-esp32/en/latest/installing.html).

## Build and upload with Visual Studio Code + PlatformIO

Use **Visual Studio Code (VS Code)** for this path.

1. Install [Visual Studio Code](https://code.visualstudio.com/). In its Extensions view, install **PlatformIO IDE**, published by PlatformIO. Let its initial setup finish and reload VS Code if prompted. It supplies the PlatformIO build tools; a separate global PlatformIO installation is not necessary.
2. Extract the episode ZIP. Choose **File → Open Folder** and open the folder containing **`platformio.ini`**, **`src/`**, and **`tools/`**. Do not open only the `.ino` folder or create a new blank project.
3. Keep the supplied `platformio.ini`. It pins the toolchain platform and selects `esp32cam`, Arduino, Huge APP partitions, DIO, 40 MHz, 4 MB flash, and 115200 baud. First build requires internet to download the pinned tools.
4. Edit **`src/main.cpp`** if you want to change the firmware. This is a self-contained copy of the single Arduino sketch. VS Code’s build does not use the separate `.ino` file.
5. Open the **PlatformIO** sidebar, then **Project Tasks → esp32cam → General → Build**. Wait for **SUCCESS**. You can also use the PlatformIO toolbar’s Build button.
6. Close any serial monitor. Attach **IO0 to GND** with power off, then power on or press RST. Run **Project Tasks → esp32cam → General → Upload**.
7. If automatic port selection chooses incorrectly, use **PlatformIO: Open PlatformIO Core CLI** from the Command Palette and run:

   ```sh
   pio device list
   pio run -e esp32cam -t upload --upload-port YOUR_PORT
   ```

   Replace YOUR_PORT with the listed USB serial device. If connection stalls, press RST with the IO0 jumper still attached.
8. After upload succeeds, remove the IO0 jumper and reset. Run **Project Tasks → esp32cam → General → Monitor** to see startup output at the configured **115200 baud**. Close the monitor before uploading again. Follow the Wi-Fi instructions above.

The same actions work from PlatformIO’s terminal:

```sh
pio run -e esp32cam
pio run -e esp32cam -t upload --upload-port YOUR_PORT
pio device monitor --port YOUR_PORT --baud 115200
```

After a build, `.pio/build/esp32cam/firmware.factory.bin` is the NEW complete image for flashing at **0x0**. `firmware.bin` in that build directory is application-only; do not substitute it for the complete image. The packaged upload helper always checks and flashes the downloaded release BIN, not your edited build.

Official editor reference: [PlatformIO IDE for VS Code](https://docs.platformio.org/en/stable/integration/ide/vscode.html).

## Keep your source edits in the right place

Use `FiggyEpisode001.ino` for Arduino IDE or `src/main.cpp` for PlatformIO. These are separate copies: an edit to one does not change the other. The `web/` folder is readable design reference; editing those files alone does not update the HTML embedded in either single-file source. After changing source, rebuild and upload. Editing source never changes the prebuilt download automatically.

## If something gets stuck

- **No serial port:** use a data-capable USB cable, check the programmer connection, and install its vendor’s USB serial driver if required.
- **Cannot connect / wrong boot mode:** confirm IO0-to-GND, press RST with the jumper attached, close other serial monitors, and retry with the correct port.
- **Upload disconnects:** check power and cable quality. Retry the helper with `--baud 57600`.
- **Upload succeeds but nothing boots:** remove the IO0 jumper and reset. Confirm the complete image was written at 0x0. Open serial output at 115200 baud to see startup errors.
- **Camera unavailable:** power off before checking the ribbon cable. Confirm the AI Thinker pinout and OV3660-compatible module. Read the serial initialization error.
- **Unexpected resets:** check the power supply and wiring first.
- **Cannot reach the dashboard:** verify which network your computer joined, use `http://` rather than `https://`, and try the device IP instead of its local hostname.

## Checked here

The firmware compiled successfully without warnings. Its ESP32 image header, DIO/40 MHz/4 MB configuration, partition bounds, application layout, and checksums were checked. The single-file sketch matches the compiled source.

Physical flashing and live camera operation have not been tested in this session.
