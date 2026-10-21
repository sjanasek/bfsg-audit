"""Gibt fehlgeschlagene Tests aus test.log als GitHub-Annotationen aus."""
import re
import sys

log = open(sys.argv[1], encoding="utf-8", errors="replace").read()
blocks = re.split(r"\n=+\n", log)
n = 0
for i, b in enumerate(blocks):
    m = re.match(r"(FAIL|ERROR): (.+)", b.strip())
    if m and i + 1 < len(blocks):
        detail = blocks[i + 1].split("\n-" * 1)[0][-1500:]
        msg = f"{m.group(1)} {m.group(2)}\n{detail}".replace("%", "%25").replace("\r", "").replace("\n", "%0A")
        print(f"::error title={m.group(1)} {m.group(2)[:80]}::{msg}")
        n += 1
        if n >= 9:
            break
