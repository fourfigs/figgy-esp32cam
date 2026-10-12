#!/usr/bin/env python3
"""Bundle dependency-free web sources into the PlatformIO and Arduino IDE sketches."""
import argparse
import gzip
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PATTERN = r'const uint8_t index_html\[\] PROGMEM = \{(.*?)\};'


def bundle():
    html = (ROOT / 'web/index.html').read_text()
    css = (ROOT / 'web/dashboard.css').read_text()
    script = (ROOT / 'web/dashboard.js').read_text()
    html, styles = re.subn(
        r'<link\s+rel="stylesheet"\s+href="dashboard.css"\s*/?>',
        lambda _: f'<style>\n{css}</style>', html,
    )
    html, scripts = re.subn(
        r'<script src="dashboard.js"></script>',
        lambda _: f'<script>\n{script}</script>', html,
    )
    if styles != 1 or scripts != 1:
        raise ValueError('Expected exactly one dashboard stylesheet and script')
    return html.encode('utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Verify bundled assets without writing')
    args = parser.parse_args()
    cpp = ROOT / 'src/main.cpp'
    ino = ROOT / 'FiggyEpisode001/FiggyEpisode001.ino'
    source = cpp.read_text()
    match = re.search(PATTERN, source, re.S)
    if not match:
        raise ValueError('Embedded dashboard array not found')
    content = bundle()
    if args.check:
        packed = bytes(int(n) for n in re.findall(r'\d+', match.group(1)))
        if gzip.decompress(packed) != content or ino.read_text() != source:
            raise ValueError('Sources or embedded assets differ; run python3 tools/embed.py')
        print('PASS: web sources match embedded dashboard; Arduino and PlatformIO sources match.')
        return
    packed = bytearray(gzip.compress(content, compresslevel=9, mtime=0))
    packed[9] = 255  # Stable gzip OS marker across Python versions/platforms.
    rows = ''.join(','.join(map(str, packed[i:i+24])) + ',\n' for i in range(0, len(packed), 24))
    asset = 'const uint8_t index_html[] PROGMEM = {\n' + rows + '};'
    source = source[:match.start()] + asset + source[match.end():]
    cpp.write_text(source)
    ino.write_text(source)
    print(f'Embedded dashboard: {len(packed)} bytes; both sources synchronized.')


if __name__ == '__main__':
    main()
