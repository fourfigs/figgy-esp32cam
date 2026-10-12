# Figgy project conventions

- Figgy repositories should be public unless Kenneth explicitly requests otherwise.
- Preserve the working camera pin mapping and sensor setup when changing the dashboard.
- Keep the dashboard dependency-free at runtime; formatting tools are development-only.
- Edit `web/index.html`, `web/dashboard.css`, and `web/dashboard.js`, then run `python3 tools/embed.py` to update both firmware sketches. Do not hand-edit the compressed array.
- Keep `src/main.cpp` and `FiggyEpisode001/FiggyEpisode001.ino` synchronized.
- Run dashboard tests, formatting checks, embedded-asset checks, and a firmware build for firmware changes. Refresh the packaged flash images and checksums when firmware changes.
- Keep commits focused. Never describe mocked tests as physical-device validation.
- This release includes Wi-Fi scanning and CSV collection, not handshake capture.
