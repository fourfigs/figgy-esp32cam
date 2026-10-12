# Figgy's computer detector — episode 001

This copy is **disabled**. The matching 002 firmware exposes `/detect.jpg`; the 001 firmware does not.

For 002, comment `ENABLE_OBJECT_DETECTION = False` and uncomment `# ENABLE_OBJECT_DETECTION = True` in detect.py. Also enable the firmware switch and rebuild, or flash the ready-made 002 image.

From the episode folder:

```sh
python3 -m venv .venv-002
source .venv-002/bin/activate
python 002-object-detection/detect.py
```

On Windows, activate using `.venv-002\Scripts\activate` instead. Use `python` in place of `python3` if that is your installed command. The first enabled run asks for camera URL, trusted model path, confidence and snapshot interval. Press Enter for suggestions; use `http://192.168.4.1` on the standalone camera network, or its home-network address. Run with `--setup` to change saved choices.

Missing packages produce an install prompt using the viewer's current Python interpreter; answer Y to install or use the displayed command yourself. Restart the script after installation. Package requirements and pretrained model weights are NOT bundled. Have internet access for this first installation/download. The default official model is YOLO11 nano (`models/yolo11n.pt`), resolved beside this script. Custom weights must already exist. Saved relative paths stay relative to this folder, never to the author's home directory.

If the camera's standalone Wi-Fi has no internet, prepare the packages and model first from your normal network:

```sh
python -m pip install -r 002-object-detection/requirements.txt
python -c "from pathlib import Path; from ultralytics import YOLO; p=Path('002-object-detection/models/yolo11n.pt'); p.parent.mkdir(parents=True, exist_ok=True); YOLO(str(p))"
```

Then join the camera network and start detection. Settings save beside the script as `detector-settings.json`; the folder must be writable. Press Q in the window or Ctrl+C to stop. Confidence is a model score, not proof; custom objects need suitable trained weights. Inference runs on the computer CPU, one snapshot at a time. Hardware/inference performance remains untested.

API reference and model usage: https://docs.ultralytics.com/modes/predict/
