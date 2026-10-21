"""Gibt fehlgeschlagene Tests aus test.log als GitHub-Annotationen aus."""
import re
import sys

log = open(sys.argv[1], encoding="utf-8", errors="replace").read()
n = 0
for m in re.finditer(r"^=+\n(FAIL|ERROR): (.+?)\n-+\n(.*?)(?=^=+\n|^-+\nRan )", log, re.S | re.M):
    kind, name, detail = m.group(1), m.group(2), m.group(3).strip()[-1800:]
    msg = f"{kind} {name}\n{detail}".replace("%", "%25").replace("\r", "").replace("\n", "%0A")
    print(f"::error title={kind} {name[:80]}::{msg}")
    n += 1
    if n >= 9:
        break
