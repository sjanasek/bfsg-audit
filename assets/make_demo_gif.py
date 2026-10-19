"""Rendert ein Terminal-Demo-GIF aus echten Scan-Ergebnissen (siehe demo/)."""
from PIL import Image, ImageDraw, ImageFont
import sys

OUT = sys.argv[1]
W, H = 960, 372
PAD, LH = 28, 22
FONT = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 15)
BOLD = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 15)

BG = (24, 26, 33)
BAR = (40, 43, 54)
FG = (220, 223, 228)
DIM = (130, 136, 150)
RED = (240, 98, 98)
ORA = (240, 168, 72)
YEL = (230, 210, 100)
GRN = (110, 205, 130)
BLU = (120, 170, 255)
ADD_BG = (30, 60, 40)
DEL_BG = (70, 34, 38)

# Jede Zeile: Liste von (text, farbe, fett) ; optional Hintergrund via ("__bg__", farbe)
def L(*parts, bg=None):
    return {"parts": parts, "bg": bg}

SCAN1 = [
    L(("$ ", GRN, True), ("python3 scan.py ./shop", FG, True)),
    L(),
    L(("BFSG-Scan: ./shop", FG, True)),
    L(("● Kritisch", RED, True)),
    L(("  Formularfelder ohne zugänglichen Namen     ", FG, False), ("1.3.1 / 4.1.2", DIM, False), ("   index.html:18 +3", BLU, False)),
    L(("  Klickbare Elemente ohne Tastaturzugang     ", FG, False), ("2.1.1", DIM, False), ("           index.html:8", BLU, False)),
    L(("  Button ohne zugänglichen Namen             ", FG, False), ("4.1.2", DIM, False), ("           index.html:13", BLU, False)),
    L(("  Zoom im Viewport gesperrt                  ", FG, False), ("1.4.4", DIM, False), ("           index.html:4", BLU, False)),
    L(("  Keine Informationen zur Barrierefreiheit   ", FG, False), ("Anlage 3 BFSG", DIM, False)),
    L(("● Wichtig", ORA, True), ("   Bilder ohne alt · Fokus entfernt · Paste blockiert · …", FG, False)),
    L(("● Empfehlung", YEL, True), ("   Überschriften-Sprung · kein Skip-Link · …", FG, False)),
    L(),
    L(("  5 kritisch   12 wichtig   4 Empfehlung", FG, True)),
]

FIX = [
    L(("# Fix aus dem Bericht — WCAG 1.3.1 / 3.3.2 / 1.3.5", DIM, False)),
    L(("- ", RED, True), ('<input type="email" name="email" placeholder="E-Mail">', FG, False), bg=DEL_BG),
    L(("+ ", GRN, True), ('<label for="email">E-Mail</label>', FG, False), bg=ADD_BG),
    L(("+ ", GRN, True), ('<input type="email" id="email" name="email"', FG, False), bg=ADD_BG),
    L(("+ ", GRN, True), ('       autocomplete="email">', FG, False), bg=ADD_BG),
]

SCAN2 = [
    L(("$ ", GRN, True), ("python3 scan.py ./shop", FG, True), ("   # nach allen Fixes", DIM, False)),
    L(),
    L(("  0 kritisch   0 wichtig   1 Empfehlung", GRN, True)),
    L(("  Manuell prüfen: Kontrast · Tastatur · Screenreader", DIM, False)),
]

TITLE = "bfsg-audit · Claude Skill"


def render(lines, cursor_line=None, partial=None):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 34], fill=BAR)
    for i, c in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        d.ellipse([16 + i * 22, 11, 28 + i * 22, 23], fill=c)
    d.text((W // 2 - d.textlength(TITLE, font=FONT) // 2, 9), TITLE, font=FONT, fill=DIM)
    y = 34 + PAD // 2
    for idx, line in enumerate(lines):
        x = PAD
        if line["bg"]:
            d.rectangle([PAD - 6, y - 2, W - PAD, y + LH - 4], fill=line["bg"])
        parts = line["parts"]
        if partial is not None and idx == len(lines) - 1:
            # Tippanimation: nur die ersten n Zeichen des letzten Teils
            parts = parts[:-1] + ((parts[-1][0][:partial], parts[-1][1], parts[-1][2]),)
        for text, col, bold in parts:
            f = BOLD if bold else FONT
            d.text((x, y), text, font=f, fill=col)
            x += d.textlength(text, font=f)
        if cursor_line is not None and idx == len(lines) - 1:
            d.rectangle([x + 1, y + 1, x + 9, y + LH - 4], fill=FG)
        y += LH
    return img


frames, durs = [], []

def add(img, ms):
    frames.append(img)
    durs.append(ms)

def type_cmd(prefix_lines, cmd_line, speed=45):
    full = cmd_line["parts"][-1][0] if len(cmd_line["parts"]) == 2 else None
    # Kommando ist Teil 2 ("python3 scan.py ./shop")
    text = cmd_line["parts"][1][0]
    head = L(cmd_line["parts"][0], cmd_line["parts"][1])
    for n in range(0, len(text) + 1, 2):
        add(render(prefix_lines + [head], cursor_line=True, partial=n), speed)
    return prefix_lines + [cmd_line]

# Szene 1: Scan
shown = type_cmd([], SCAN1[0])
add(render(shown, cursor_line=True), 500)
for line in SCAN1[1:]:
    shown = shown + [line]
    add(render(shown), 130)
add(render(shown), 2600)

# Szene 2: Fix
shown = []
for line in FIX:
    shown = shown + [line]
    add(render(shown), 350)
add(render(shown), 2600)

# Szene 3: erneuter Scan
shown = type_cmd([], SCAN2[0])
add(render(shown), 500)
for line in SCAN2[1:]:
    shown = shown + [line]
    add(render(shown), 300)
add(render(shown), 3200)

# Gemeinsame Palette aus allen Szenen, damit keine Farbe verloren geht
sheet = Image.new("RGB", (W, H * 3))
for k, i in enumerate([durs.index(max(durs[:30])), len(frames) - 8, len(frames) - 1]):
    sheet.paste(frames[i], (0, H * k))
ref = sheet.quantize(colors=96, method=Image.Quantize.MEDIANCUT)
pal = [f.quantize(palette=ref, dither=Image.Dither.NONE) for f in frames]
pal[0].save(OUT, save_all=True, append_images=pal[1:], duration=durs, loop=0, optimize=True, disposal=1)
print(f"{len(frames)} frames, {sum(durs)/1000:.1f}s -> {OUT}")
