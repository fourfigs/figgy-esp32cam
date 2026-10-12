#!/usr/bin/env python3
"""Episode 002: local computer inference from ESP32-CAM JPEG snapshots. Disabled by default."""
import argparse
import json
import math
import subprocess
from pathlib import Path
import sys
import time
from urllib.error import URLError, HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

# FIGGY'S BENCH NOTES — let's give this camera something new to do!
# We're leaving detection OFF for 001. This file runs on your COMPUTER, folks.
# When we're ready for 002:
#   1. COMMENT OUT the False line below.
#   2. UNCOMMENT the True line below. Keep only ONE active assignment.
#   3. Uncomment FIGGY_EPISODE_002 in src/main.cpp (or your single .ino), rebuild, and flash.
#   4. Stop the browser's stream, then run the command in the 002 README.
# Going back to 001? Swap these two lines back and disable the firmware switch.
ENABLE_OBJECT_DETECTION = False
# ENABLE_OBJECT_DETECTION = True

# Confidence isn't a promise! Higher values show fewer, stronger guesses.
# This detects the classes in YOUR model; it doesn't recognize every object.
DEFAULT_CONFIDENCE = 0.45
BASE_DIR = Path(__file__).resolve().parent
CONFIG_FILE = BASE_DIR / "detector-settings.json"
MAX_JPEG_BYTES = 2 * 1024 * 1024

def camera_url(value):
    parsed = urlsplit(value)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname:
        raise argparse.ArgumentTypeError('Use http://CAMERA_IP or http://gettin-figgy.local')
    if parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ('', '/'):
        raise argparse.ArgumentTypeError('Use just the camera base URL, without credentials or a path')
    return value.rstrip('/') + '/detect.jpg'

def fetch_jpeg(url):
    # Figgy says: ask, wait a little, and give the camera a break if it says no.
    req = Request(url, headers={'Cache-Control': 'no-cache'})
    with urlopen(req, timeout=8) as response:
        if response.headers.get_content_type() != 'image/jpeg':
            raise ValueError('Camera returned something other than a JPEG')
        data = response.read(MAX_JPEG_BYTES + 1)
    if not data or len(data) > MAX_JPEG_BYTES or not data.startswith(b'\xff\xd8'):
        raise ValueError('Incomplete, invalid, or oversized camera image')
    return data

def configure(args):
    # Figgy says: your computer, your folders. No paths from my bench required!
    settings = {}
    if CONFIG_FILE.exists():
        try:
            settings = json.loads(CONFIG_FILE.read_text())
            if not isinstance(settings, dict):
                raise ValueError('Settings must be an object')
        except (OSError, ValueError) as exc:
            print(f"Couldn't read saved setup: {exc}. Let's set it up again.")
            settings = {}
    first_run = not settings
    settings = {**{'camera': 'http://gettin-figgy.local', 'model': 'models/yolo11n.pt',
                   'confidence': DEFAULT_CONFIDENCE, 'interval': 0.5}, **settings}
    for key in ('camera', 'model', 'confidence', 'interval'):
        if getattr(args, key) is not None:
            settings[key] = getattr(args, key)
    if first_run or args.setup:
        if not sys.stdin.isatty():
            raise ValueError('First-run setup needs an interactive terminal. Run this script there with --setup.')
        print("\nFiggy's 002 setup — let's make this yours!")
        print('Connect this computer to the camera network. Have internet available for the first model download.')
        print('Press Enter to keep a suggestion. Relative model paths start beside this script, not in my folders.')
        settings['camera'] = input(f"Camera base URL [{settings['camera']}]: ").strip() or settings['camera']
        settings['model'] = input(f"Model path (.pt; default downloads official YOLO11 nano) [{settings['model']}]: ").strip() or settings['model']
        settings['confidence'] = input(f"Confidence, 0–1 [{settings['confidence']}]: ").strip() or settings['confidence']
        settings['interval'] = input(f"Seconds between snapshots [{settings['interval']}]: ").strip() or settings['interval']
    camera_url(settings['camera'])
    settings['confidence'] = float(settings['confidence'])
    settings['interval'] = float(settings['interval'])
    if not math.isfinite(settings['interval']) or not 0 < settings['confidence'] <= 1 or not settings['interval'] >= 0.1:
        raise ValueError('Use confidence > 0 and <= 1, and interval >= 0.1 seconds')
    model_path = Path(settings['model']).expanduser()
    if not model_path.is_absolute():
        model_path = BASE_DIR / model_path
    if model_path.suffix.lower() != '.pt':
        raise ValueError('Choose trusted .pt object-detection weights')
    if not model_path.exists() and model_path.name != 'yolo11n.pt':
        raise ValueError('Custom weights were not found. Supply an existing .pt file, or use models/yolo11n.pt')
    model_path.parent.mkdir(parents=True, exist_ok=True)
    if first_run or args.setup:
        # Save the user's relative path unchanged so moving the folder still works.
        temporary = CONFIG_FILE.with_suffix('.tmp')
        temporary.write_text(json.dumps(settings, indent=2) + '\n')
        temporary.replace(CONFIG_FILE)
        print(f'Setup saved beside the script: {CONFIG_FILE.name}. Run --setup to change it.')
    return settings, model_path


def load_dependencies():
    try:
        import cv2
        import numpy as np
        from ultralytics import YOLO
        return cv2, np, YOLO
    except ImportError:
        requirements = BASE_DIR / 'requirements.txt'
        command = [sys.executable, '-m', 'pip', 'install', '-r', str(requirements)]
        print('002 needs its computer-side packages. A separate virtual environment is recommended.')
        print('Install command:', subprocess.list2cmdline(command))
        if not sys.stdin.isatty() or input('Install into this Python environment now? [y/N]: ').strip().lower() != 'y':
            raise ValueError('Install the dependencies, then run this script again; setup is saved.')
        subprocess.run(command, check=True)
        # A fresh interpreter avoids partially imported modules after installation.
        print('Packages installed. Run this same script again to start detection.')
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--setup', action='store_true', help='Run the viewer setup again')
    parser.add_argument('--camera', help='Camera base URL, e.g. http://192.168.4.1')
    parser.add_argument('--model', help='Trusted local .pt weights; relative to this script folder')
    parser.add_argument('--confidence', type=float)
    parser.add_argument('--interval', type=float, help='Minimum seconds between requests')
    args = parser.parse_args()
    if not ENABLE_OBJECT_DETECTION:
        print('002 is parked for now! Follow the Figgy switch notes in this file and src/main.cpp (or your single .ino).')
        return 0  # No setup prompts, model import, downloads, or camera requests while disabled.
    try:
        settings, model_path = configure(args)
        args.camera = camera_url(settings['camera'])
        args.confidence = settings['confidence']
        args.interval = settings['interval']
        dependencies = load_dependencies()
        if dependencies is None:
            return 0
        cv2, np, YOLO = dependencies
    except (OSError, ValueError, argparse.ArgumentTypeError, subprocess.CalledProcessError) as exc:
        parser.exit(1, f'Setup needs attention: {exc}\nRun with --setup to revise your settings.\n')
    # Figgy says: first run may download the named official model. After that,
    # use its saved .pt path for offline work. Camera pictures stay local here.
    try:
        model = YOLO(str(model_path), task='detect')
        if model.task != 'detect':
            raise ValueError('Choose object-detection weights, not classification or pose weights')
    except Exception as exc:
        parser.exit(1, f'Model could not load: {exc}\n')
    title = "Gettin' Figgy With It!! | 002 | Q to quit"
    print('Make it. Try it. Make it yours. Press Q in the window or Ctrl+C to stop.')
    failures = 0
    try:
        while True:
            started = time.monotonic()
            try:
                frame = cv2.imdecode(np.frombuffer(fetch_jpeg(args.camera), dtype=np.uint8), cv2.IMREAD_COLOR)
                if frame is None:
                    raise ValueError('JPEG could not be decoded')
                # One request, one frame, one result — no growing frame queue.
                result = model.predict(source=frame, conf=args.confidence, imgsz=320, device='cpu', verbose=False)[0]
                cv2.imshow(title, result.plot())
                failures = 0
            except HTTPError as exc:
                if exc.code == 404:
                    print('No /detect.jpg route. Enable FIGGY_EPISODE_002, rebuild, and flash the 002 image.', file=sys.stderr)
                    return 1
                failures += 1
                print(f'Camera replied HTTP {exc.code}; retrying…', file=sys.stderr)
            except (URLError, TimeoutError, OSError, ValueError) as exc:
                failures += 1
                print(f'Frame unavailable: {exc}. Retrying…', file=sys.stderr)
            if failures:
                # Clear the last picture so a disconnected camera never looks live.
                blank = np.zeros((240, 480, 3), dtype=np.uint8)
                cv2.putText(blank, 'Camera unavailable - retrying', (12, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
                cv2.imshow(title, blank)
            if failures >= 5:
                print('Five failed frames. Check Wi-Fi, power, and the 002 firmware switch.', file=sys.stderr)
                return 1
            # Keep the window responsive while pacing requests.
            until = time.monotonic() + max(0, (2 if failures else args.interval) - (time.monotonic() - started))
            while True:
                if cv2.waitKey(20) & 0xFF == ord('q'):
                    return 0
                if cv2.getWindowProperty(title, cv2.WND_PROP_VISIBLE) < 1:
                    return 0
                if time.monotonic() >= until:
                    break
    except KeyboardInterrupt:
        return 0
    finally:
        cv2.destroyAllWindows()

if __name__ == '__main__':
    sys.exit(main())
