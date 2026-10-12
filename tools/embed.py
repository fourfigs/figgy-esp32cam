#!/usr/bin/env python3
"""Embed the dashboard in both the PlatformIO and Arduino IDE sources."""
from pathlib import Path
import gzip
import re
root=Path(__file__).resolve().parents[1]
data=gzip.compress((root/'web/index.html').read_bytes(),mtime=0)
asset='const uint8_t index_html[] PROGMEM = {\n'+''.join(','.join(map(str,data[i:i+24]))+',\n' for i in range(0,len(data),24))+'};'
p=root/'src/main.cpp'
source,count=re.subn(r'const uint8_t index_html\[\] PROGMEM = \{.*?\};',lambda _:asset,p.read_text(),count=1,flags=re.S)
assert count==1
p.write_text(source)
(root/'FiggyEpisode001/FiggyEpisode001.ino').write_text(source)
print(f'Embedded dashboard: {len(data)} bytes; both sources synchronized.')
