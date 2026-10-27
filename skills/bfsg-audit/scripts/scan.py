#!/usr/bin/env python3
"""BFSG-Audit — statischer Barrierefreiheits-Scan (WCAG 2.1 AA, Hinweise auf 2.2).

Findet typische, statisch erkennbare Barrieren in HTML, Templates und
Komponenten (JSX/TSX/Vue/Svelte/Astro/PHP/Twig …) sowie in CSS und meldet
Indizien dafür, ob das BFSG überhaupt greift (Shop/Checkout-Elemente) und ob
Barrierefreiheitsinformationen vorhanden sind. Nur Python-Standardbibliothek.

    python3 scan.py <ordner|datei|url> [--json] [--max-pages N]

Die Treffer sind Hinweise, keine Urteile: Jeder muss im Kontext bestätigt werden.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from html.parser import HTMLParser

__version__ = "1.3.0"

SEV_ORDER = {"kritisch": 0, "wichtig": 1, "empfehlung": 2, "hinweis": 3}
SEV_ICON = {"kritisch": "🔴", "wichtig": "🟠", "empfehlung": "🟡", "hinweis": "ℹ️"}

TEXT_EXT = {".html", ".htm", ".php", ".twig", ".liquid", ".njk", ".hbs", ".ejs", ".erb", ".blade.php",
            ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".vue", ".svelte", ".astro",
            ".css", ".scss", ".sass", ".less", ".json", ".webmanifest"}
MARKUP_EXT = {".html", ".htm", ".php", ".twig", ".liquid", ".njk", ".hbs", ".ejs", ".erb",
              ".jsx", ".tsx", ".vue", ".svelte", ".astro"}
SKIP_DIRS = {"node_modules", ".git", "vendor", ".next", ".nuxt", ".svelte-kit", ".cache", "__pycache__",
             ".venv", "venv", "coverage", ".turbo", ".vercel", ".output", "bower_components"}
SKIP_FILES = {"package-lock.json", "yarn.lock", "pnpm-lock.yaml", "composer.lock", "tsconfig.json"}
MAX_FILE_BYTES = 2_000_000
MAX_LOCS = 8

BF_INFO_RX = re.compile(r"barrierefreiheit|barrierefrei|accessibility|erkl[aä]rung[-_ ]zur[-_ ]barriere", re.I)
ECOM_RX = re.compile(r"warenkorb|zur kasse|checkout|add[-_ ]?to[-_ ]?cart|in den warenkorb|zahlungspflichtig|"
                     r"js\.stripe\.com|paypal\.com/sdk|paypalobjects|klarna|mollie|woocommerce|shopify|"
                     r"jetzt (kaufen|buchen)|termin buchen|online[- ]buchung", re.I)
COMMON_AUTOCOMPLETE = {
    "email": "email", "e-mail": "email", "mail": "email", "tel": "tel", "telefon": "tel", "phone": "tel",
    "vorname": "given-name", "firstname": "given-name", "first_name": "given-name", "fname": "given-name",
    "nachname": "family-name", "lastname": "family-name", "last_name": "family-name", "lname": "family-name",
    "plz": "postal-code", "zip": "postal-code", "postcode": "postal-code", "postal_code": "postal-code",
    "strasse": "street-address", "straße": "street-address", "street": "street-address", "address": "street-address",
    "ort": "address-level2", "stadt": "address-level2", "city": "address-level2",
}
VAGUE_LINK_TEXTS = {"hier", "mehr", "weiter", "klick hier", "hier klicken", "mehr erfahren", "weiterlesen",
                    "click here", "more", "read more", "learn more", "link", "details"}

# Zeilenbasierte Muster: (id, regex, schwere, titel, wcag, hinweis)
LINE_RULES = [
    ("outline-none", r"outline\s*:\s*(none|0)(\s*!important)?\s*[;}]", "wichtig",
     "Fokus-Rahmen entfernt (outline: none/0)", "2.4.7 Fokus sichtbar (AA)",
     "Nur zulässig mit sichtbarem Ersatz, z. B. :focus-visible { outline: 3px solid … }. Im Kontext prüfen."),
    ("zoom-blocked", r"user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b", "kritisch",
     "Zoom im Viewport gesperrt", "1.4.4 Textgröße (AA)",
     "user-scalable=no / maximum-scale=1 entfernen. Menschen mit Sehschwäche können sonst nicht vergrößern."),
    ("tabindex-positive", r"tabindex\s*=\s*[\"'{]?\s*[1-9]", "wichtig",
     "Positiver tabindex", "2.4.3 Fokus-Reihenfolge (A)",
     "tabindex > 0 bricht die natürliche Reihenfolge. Auf 0 oder -1 ändern bzw. DOM umsortieren."),
    ("paste-blocked", r"onpaste\s*=\s*[\"']\s*return\s+false|on:paste\|preventDefault|@paste\.prevent|"
                      r"addEventListener\(\s*['\"]paste['\"][^)]*preventDefault", "wichtig",
     "Einfügen (Paste) blockiert", "3.3.8 Barrierefreie Authentifizierung [2.2] (AA)",
     "Blockiert Passwortmanager und Menschen, die nicht abtippen können. Paste erlauben."),
    ("orientation-lock", r"\"orientation\"\s*:\s*\"(portrait|landscape)", "wichtig",
     "Bildschirmausrichtung im Manifest festgelegt", "1.3.4 Ausrichtung (AA)",
     "Nur zulässig, wenn die Ausrichtung wesentlich ist. Sonst entfernen."),
    ("auto-submit", r"onchange\s*=\s*[\"'][^\"']*\.submit\(\)", "wichtig",
     "Formular wird bei Auswahl automatisch abgeschickt", "3.2.2 Bei Eingabe (A)",
     "Unerwarteter Kontextwechsel. Expliziten Absenden-Button verwenden."),
    ("overlay", r"acsbapp\.com|accessibe|userway\.org|cdn\.userway|equalweb|audioeye\.com|"
                r"eye-able|enable\.co\.il", "empfehlung",
     "Accessibility-Overlay eingebunden", "—",
     "Overlays beheben keine Ursachen, stören Screenreader teils und gelten nicht als Konformitätsnachweis."),
    ("carousel-autoplay", r"autoplay\s*:\s*(true|\{)|data-(bs-)?ride\s*=\s*[\"']carousel|data-autoplay\s*=\s*[\"']true",
     "empfehlung", "Karussell/Slider mit Autoplay", "2.2.2 Pausieren, Stoppen, Ausblenden (A)",
     "Bewegter Inhalt > 5 s braucht eine Pause-Möglichkeit. Prüfen, ob ein Pause-Button existiert."),
]
COMPILED_RULES = [(rid, re.compile(rx, re.I), sev, t, w, h) for rid, rx, sev, t, w, h in LINE_RULES]


@dataclass
class Finding:
    id: str
    severity: str
    title: str
    wcag: str
    hint: str
    locations: list = field(default_factory=list)

    def add(self, loc):
        if loc not in self.locations:
            self.locations.append(loc)


class Report:
    def __init__(self):
        self.findings: dict[str, Finding] = {}
        self.facts = {"dateien": 0, "seiten": 0, "ecommerce_indizien": [], "bf_info": False,
                      "aria_live": False, "focus_visible": False, "reduced_motion": False}

    def hit(self, rid, sev, title, wcag, hint, loc):
        f = self.findings.setdefault(rid, Finding(rid, sev, title, wcag, hint))
        f.add(loc)


# --------------------------------------------------------------------------
# Markup-Analyse
# --------------------------------------------------------------------------

def attr_present(a: dict, *names) -> bool:
    return any(n in a for n in names)


def attr_val(a: dict, *names) -> str:
    for n in names:
        if n in a and a[n]:
            return a[n]
    return ""


class Audit(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.saw_html = False
        self.html_lang = ""
        self.title = ""
        self._in_title = False
        self.headings: list[tuple[int, int]] = []
        self.issues: list[tuple[str, int, str]] = []  # (rule-id, line, detail)
        self.inputs: list[tuple[int, dict, bool]] = []
        self.label_for: set[str] = set()
        self.label_depth = 0
        self.ids: set[str] = set()
        self.links: list[tuple[int, str, str, dict]] = []
        self._a: list | None = None
        self._btn: list | None = None
        self.skip_link = False
        self.has_main = False
        self.aria_live = False

    # Elemente ------------------------------------------------------------
    def handle_starttag(self, tag, attrs):
        a = {k.lower(): (v if v is not None else "") for k, v in attrs}
        ln = self.getpos()[0]
        if a.get("id"):
            self.ids.add(a["id"])
        if tag not in ("a", "button", "img") and a.get("aria-label") and a.get("aria-hidden") != "true":
            # z. B. <svg aria-label="Warenkorb"> innerhalb eines Links/Buttons
            if self._a is not None:
                self._a[2] += " " + a["aria-label"]
            if self._btn is not None:
                self._btn[1] += " " + a["aria-label"]
        if attr_val(a, "aria-live") in ("polite", "assertive") or a.get("role") in ("status", "alert", "log"):
            self.aria_live = True
        if tag == "html":
            self.saw_html = True
            self.html_lang = a.get("lang", "") or a.get("xml:lang", "")
        elif tag == "title":
            self._in_title = True
        elif tag == "main" or a.get("role") == "main":
            self.has_main = True
        elif re.fullmatch(r"h[1-6]", tag):
            self.headings.append((int(tag[1]), ln))
        elif tag == "img":
            # Alternativtext eines Bildes zählt als Name des umschließenden Links/Buttons
            alt_text = attr_val(a, "alt", ":alt", "aria-label")
            if alt_text:
                if self._a is not None:
                    self._a[2] += " " + alt_text
                if self._btn is not None:
                    self._btn[1] += " " + alt_text
            if "alt" not in a and ":alt" not in a and a.get("role") not in ("presentation", "none") \
                    and a.get("aria-hidden") != "true" and not attr_present(a, "aria-label", "aria-labelledby"):
                self.issues.append(("img-alt", ln, a.get("src", "")[:60]))
        elif tag in ("video", "audio") and "autoplay" in a and "muted" not in a:
            self.issues.append(("autoplay", ln, tag))
        elif tag == "video" and "controls" not in a and "autoplay" in a:
            self.issues.append(("video-no-controls", ln, ""))
        elif tag == "iframe":
            if not attr_val(a, "title", "aria-label", ":title"):
                self.issues.append(("iframe-title", ln, a.get("src", "")[:60]))
        elif tag in ("div", "span", "li", "td", "p", "img", "svg", "section"):
            clicky = attr_present(a, "onclick", "@click", "v-on:click", "on:click", "(click)")
            if clicky and a.get("role") not in ("button", "link", "tab", "menuitem", "checkbox", "switch", "option"):
                self.issues.append(("click-div", ln, tag))
            elif clicky and "tabindex" not in a:
                self.issues.append(("click-div", ln, f"{tag} mit role, aber ohne tabindex"))
        elif tag in ("input", "select", "textarea"):
            typ = a.get("type", "text").lower()
            if typ not in ("hidden", "submit", "button", "reset", "image"):
                self.inputs.append((ln, a, self.label_depth > 0))
        elif tag == "label":
            self.label_depth += 1
            target = a.get("for") or a.get("htmlfor")
            if target:
                self.label_for.add(target)
        elif tag == "a":
            self._a = [ln, a.get("href", "") or a.get("to", ""), "", a]
            if re.match(r"#(inhalt|content|main|maincontent|main-content|skip)", a.get("href", ""), re.I):
                self.skip_link = True
        elif tag == "button":
            self._btn = [ln, attr_val(a, "aria-label", "aria-labelledby", "title", ":aria-label"), a]
        # aria-hidden auf fokussierbarem Element
        if a.get("aria-hidden") == "true" and (tag in ("a", "button", "input", "select", "textarea")
                                               or (a.get("tabindex", "-1").strip() not in ("-1", ""))):
            self.issues.append(("aria-hidden-focus", ln, tag))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag in ("a", "button", "label"):
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        elif tag == "label" and self.label_depth:
            self.label_depth -= 1
        elif tag == "a" and self._a is not None:
            ln, href, text, a = self._a
            self.links.append((ln, href, text.strip(), a))
            if not text.strip() and not attr_val(a, "aria-label", "aria-labelledby", "title", ":aria-label"):
                self.issues.append(("empty-link", ln, href[:60]))
            self._a = None
        elif tag == "button" and self._btn is not None:
            if not self._btn[1].strip():
                self.issues.append(("empty-button", self._btn[0], ""))
            self._btn = None

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        if self._a is not None:
            self._a[2] += data
        if self._btn is not None:
            self._btn[1] += data

    # Auswertung ---------------------------------------------------------
    def finish(self):
        for ln, a, in_label in self.inputs:
            named = in_label or attr_val(a, "aria-label", "aria-labelledby", "title", ":aria-label") \
                or (a.get("id") and a["id"] in self.label_for)
            if not named:
                self.issues.append(("input-label", ln, attr_val(a, "name", "id", "placeholder")[:40]))
            typ = a.get("type", "text").lower()
            key = (a.get("name") or a.get("id") or "").lower()
            if typ == "password" and a.get("autocomplete", "").lower() in ("off", "false"):
                self.issues.append(("pw-autocomplete-off", ln, ""))
            if typ in ("email", "tel") or key in COMMON_AUTOCOMPLETE:
                if not a.get("autocomplete") and not a.get(":autocomplete"):
                    want = COMMON_AUTOCOMPLETE.get(key, typ)
                    self.issues.append(("autocomplete", ln, f"{key or typ} → autocomplete=\"{want}\""))
        prev = 0
        for lvl, ln in self.headings:
            if prev and lvl > prev + 1:
                self.issues.append(("heading-skip", ln, f"h{prev} → h{lvl}"))
            prev = lvl


RULE_META = {
    "img-alt": ("wichtig", "Bilder ohne Alternativtext", "1.1.1 Nicht-Text-Inhalt (A)",
                "alt-Attribut ergänzen: beschreibend bei Inhaltsbildern, alt=\"\" bei dekorativen. Screenreader lesen sonst Dateinamen vor."),
    "input-label": ("kritisch", "Formularfelder ohne zugänglichen Namen", "1.3.1 / 3.3.2 / 4.1.2 (A)",
                    "<label for=…> verknüpfen (placeholder ist kein Label). Screenreader-Nutzer:innen wissen sonst nicht, was einzugeben ist."),
    "click-div": ("kritisch", "Klickbare Elemente, die per Tastatur nicht erreichbar sind", "2.1.1 Tastatur (A) / 4.1.2",
                  "<button> (Aktion) bzw. <a href> (Navigation) statt div/span mit Klick-Handler."),
    "empty-button": ("kritisch", "Buttons ohne zugänglichen Namen", "4.1.2 Name, Rolle, Wert (A)",
                     "Icon-Buttons brauchen aria-label oder sichtbaren Text, sonst hören Screenreader nur 'Schaltfläche'."),
    "empty-link": ("wichtig", "Links ohne zugänglichen Namen", "2.4.4 Linkzweck (A) / 4.1.2",
                   "Icon-/Bild-Links mit aria-label oder alt am Bild versehen."),
    "iframe-title": ("wichtig", "iframes ohne title", "4.1.2 Name, Rolle, Wert (A)",
                     "title beschreibt den Inhalt, z. B. title=\"Video: Produktvorstellung\"."),
    "autoplay": ("wichtig", "Audio/Video startet automatisch mit Ton", "1.4.2 Audio-Steuerung (A)",
                 "autoplay entfernen oder muted + sichtbare Steuerung."),
    "video-no-controls": ("empfehlung", "Autoplay-Video ohne Bedienelemente", "2.2.2 Pausieren (A)",
                          "controls ergänzen oder eigenen Pause-Button."),
    "aria-hidden-focus": ("wichtig", "aria-hidden auf fokussierbarem Element", "4.1.2 Name, Rolle, Wert (A)",
                          "Element ist per Tab erreichbar, aber für Screenreader unsichtbar. aria-hidden entfernen oder tabindex=\"-1\"."),
    "pw-autocomplete-off": ("wichtig", "Passwortfeld mit autocomplete=\"off\"", "3.3.8 Barrierefreie Authentifizierung [2.2] (AA)",
                            "autocomplete=\"current-password\" bzw. \"new-password\" — Passwortmanager müssen funktionieren."),
    "autocomplete": ("wichtig", "Persönliche Eingabefelder ohne autocomplete", "1.3.5 Zweck von Eingaben (AA)",
                     "autocomplete-Wert ergänzen (Vorschlag steht bei der Fundstelle). Hilft u. a. Menschen mit motorischen und kognitiven Einschränkungen."),
    "heading-skip": ("empfehlung", "Übersprungene Überschriftenebenen", "1.3.1 Info und Beziehungen (A)",
                     "Hierarchie ohne Sprünge (h2 → h3, nicht h2 → h4). Screenreader navigieren über Überschriften."),
    "html-lang": ("wichtig", "<html> ohne lang-Attribut", "3.1.1 Sprache der Seite (A)",
                  "lang=\"de\" setzen, sonst lesen Screenreader mit falscher Aussprache vor."),
    "no-title": ("wichtig", "Seite ohne <title>", "2.4.2 Seite mit Titel (A)", "Aussagekräftigen Seitentitel setzen."),
    "no-h1": ("empfehlung", "Seite ohne <h1>", "1.3.1 / 2.4.6", "Eine Hauptüberschrift je Seite."),
    "skip-link": ("empfehlung", "Kein Skip-Link und kein <main>", "2.4.1 Bereiche überspringen (A)",
                  "Skip-Link \"Zum Inhalt springen\" oder zumindest <main>-Landmark."),
    "vague-links": ("empfehlung", "Unspezifische Linktexte", "2.4.4 Linkzweck (A)",
                    "Linkziel im Text nennen statt 'hier' oder 'mehr'."),
}


def audit_markup(text, where, rep: Report, is_page: bool):
    p = Audit()
    try:
        p.feed(text)
        p.close()
    except Exception:  # noqa: BLE001 — kaputtes Markup nicht abbrechen lassen
        return None
    p.finish()
    if p.aria_live:
        rep.facts["aria_live"] = True
    for rid, ln, detail in p.issues:
        sev, title, wcag, hint = RULE_META[rid]
        rep.hit(rid, sev, title, wcag, hint, f"{where}:{ln}" + (f" ({detail})" if detail else ""))
    vague = [(ln, t) for ln, _, t, _ in p.links if t.lower().strip(" .…»›→") in VAGUE_LINK_TEXTS]
    for ln, t in vague:
        sev, title, wcag, hint = RULE_META["vague-links"]
        rep.hit("vague-links", sev, title, wcag, hint, f"{where}:{ln} ('{t}')")
    if p.saw_html:
        if not p.html_lang:
            rep.hit("html-lang", *RULE_META["html-lang"], where)
        if is_page:
            if not p.title.strip():
                rep.hit("no-title", *RULE_META["no-title"], where)
            if not any(lvl == 1 for lvl, _ in p.headings):
                rep.hit("no-h1", *RULE_META["no-h1"], where)
            if not p.skip_link and not p.has_main:
                rep.hit("skip-link", *RULE_META["skip-link"], where)
    return p


def scan_lines(text, where, rep: Report):
    lines = text.splitlines()
    for i, line in enumerate(lines, 1):
        for rid, rx, sev, title, wcag, hint in COMPILED_RULES:
            if rx.search(line):
                rep.hit(rid, sev, title, wcag, hint, f"{where}:{i}")
        if ":focus-visible" in line:
            rep.facts["focus_visible"] = True
        if "prefers-reduced-motion" in line:
            rep.facts["reduced_motion"] = True
        if re.search(r"aria-live|role=[\"'{]?(status|alert)", line):
            rep.facts["aria_live"] = True
        m = ECOM_RX.search(line)
        if m and len(rep.facts["ecommerce_indizien"]) < 12:
            rep.facts["ecommerce_indizien"].append(f"{where}:{i} ({m.group(0)})")


# --------------------------------------------------------------------------
# Ordner / Datei
# --------------------------------------------------------------------------

def scan_dir(root, rep: Report):
    all_links = []
    paths = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for name in filenames:
            path = os.path.join(dirpath, name)
            rel = os.path.relpath(path, root)
            paths.append(rel)
            ext = os.path.splitext(name)[1].lower()
            if ext not in TEXT_EXT or name in SKIP_FILES or ".min." in name:
                continue
            try:
                if os.path.getsize(path) > MAX_FILE_BYTES:
                    continue
                with open(path, encoding="utf-8", errors="replace") as fh:
                    text = fh.read()
            except OSError:
                continue
            rep.facts["dateien"] += 1
            scan_lines(text, rel, rep)
            if ext in MARKUP_EXT:
                is_page = ext in (".html", ".htm", ".php") and "<html" in text.lower()
                rep.facts["seiten"] += is_page
                p = audit_markup(text, rel, rep, is_page)
                if p:
                    all_links += [(h, t) for _, h, t, _ in p.links]
    rep.facts["bf_info"] = any(BF_INFO_RX.search(h) or BF_INFO_RX.search(t) for h, t in all_links) \
        or any(BF_INFO_RX.search(os.path.basename(x)) for x in paths)


def scan_file(path, rep: Report):
    with open(path, encoding="utf-8", errors="replace") as fh:
        text = fh.read()
    name = os.path.basename(path)
    rep.facts["dateien"] = 1
    scan_lines(text, name, rep)
    p = audit_markup(text, name, rep, "<html" in text.lower())
    if p:
        rep.facts["bf_info"] = any(BF_INFO_RX.search(h) or BF_INFO_RX.search(t) for _, h, t, _ in p.links)


# --------------------------------------------------------------------------
# URL
# --------------------------------------------------------------------------

UA = f"Mozilla/5.0 (compatible; bfsg-audit/{__version__})"


def fetch(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9"})
        with urllib.request.urlopen(req, timeout=20) as r:
            raw = r.read(MAX_FILE_BYTES)
            return raw.decode(r.headers.get_content_charset() or "utf-8", errors="replace")
    except Exception as e:  # noqa: BLE001
        print(f"Hinweis: {url} nicht abrufbar ({e})", file=sys.stderr)
        return None


def scan_url(start, rep: Report, max_pages: int):
    if not urllib.parse.urlparse(start).scheme:
        start = "https://" + start
    host = urllib.parse.urlparse(start).netloc
    html = fetch(start)
    if html is None:
        print("Startseite nicht erreichbar — Abbruch.", file=sys.stderr)
        sys.exit(2)
    rep.facts["seiten"] = 1
    scan_lines(html, start, rep)
    p = audit_markup(html, start, rep, True)
    links = p.links if p else []
    rep.facts["bf_info"] = any(BF_INFO_RX.search(h) or BF_INFO_RX.search(t) for _, h, t, _ in links)

    # Priorität: Barrierefreiheitsinfos, Warenkorb/Checkout/Login, dann weitere interne Links
    prio = re.compile(r"barriere|accessib|warenkorb|cart|kasse|checkout|login|anmelden|konto|account|kontakt|buch", re.I)
    candidates, seen = [], {start}
    for _, href, text, _ in links:
        u = urllib.parse.urljoin(start, href).split("#")[0]
        if urllib.parse.urlparse(u).netloc != host or u in seen or not u.startswith("http"):
            continue
        seen.add(u)
        candidates.append((0 if (prio.search(href) or prio.search(text)) else 1, u))
    for _, u in sorted(candidates)[:max_pages]:
        sub = fetch(u)
        if sub is None:
            continue
        rep.facts["seiten"] += 1
        scan_lines(sub, u, rep)
        audit_markup(sub, u, rep, True)
    for m in re.finditer(r"""<link[^>]+href=["']([^"']+\.css[^"']*)["']""", html, re.I):
        u = urllib.parse.urljoin(start, m.group(1))
        if urllib.parse.urlparse(u).netloc == host:
            css = fetch(u)
            if css:
                scan_lines(css, u.split("?")[0], rep)


# --------------------------------------------------------------------------
# Projektweite Schlussfolgerungen + Ausgabe
# --------------------------------------------------------------------------

def conclude(rep: Report):
    f = rep.facts
    if not f["bf_info"]:
        rep.hit("keine-bf-info", "kritisch" if f["ecommerce_indizien"] else "empfehlung",
                "Keine Informationen zur Barrierefreiheit gefunden", "§ 14 Abs. 1 Nr. 2, Anlage 3 BFSG",
                "Pflicht, wenn das BFSG gilt (Seite im Footer, z. B. /barrierefreiheit). "
                "Schwere hängt davon ab, ob das BFSG greift — siehe Anwendungsbereich.", "(gesamtes Projekt)")
    if "outline-none" in rep.findings and f["focus_visible"]:
        rep.findings["outline-none"].severity = "empfehlung"
        rep.findings["outline-none"].hint += " Das Projekt nutzt :focus-visible — vermutlich gibt es Ersatz; stichprobenartig prüfen."
    if f["ecommerce_indizien"]:
        rep.hit("hinweis-ecommerce", "hinweis", "Indizien für Online-Vertragsschluss (Shop/Buchung)",
                "§ 1 Abs. 3 Nr. 5, § 2 Nr. 26 BFSG",
                "Spricht dafür, dass das BFSG greift (außer Kleinstunternehmen). Mit dem Betreiber klären.",
                "; ".join(f["ecommerce_indizien"][:6]))
    if not f["aria_live"] and f["ecommerce_indizien"]:
        rep.hit("no-live-region", "empfehlung", "Keine Live-Region für Statusmeldungen gefunden",
                "4.1.3 Statusmeldungen (AA)",
                "Meldungen wie 'In den Warenkorb gelegt' werden Screenreadern sonst nicht angesagt. role=\"status\" verwenden.",
                "(gesamtes Projekt)")


NOT_STATIC = [
    "Farbkontraste (1.4.3, 1.4.11) — mit axe-core oder Kontrast-Tool im Browser",
    "Tastaturbedienung, Fokus-Reihenfolge und Tastaturfallen (2.1.1, 2.1.2, 2.4.3) — Seite nur mit Tab/Enter/Esc bedienen",
    "Zoom 200 % und Reflow bei 320 px Breite (1.4.4, 1.4.10)",
    "Qualität von Alternativtexten, Linktexten, Fehlermeldungen",
    "Untertitel und Audiodeskription von Videos (1.2.x)",
    "Verhalten eingebetteter Drittanbieter-Widgets (Zahlung, Captcha, Chat)",
    "Screenreader-Test der Kernaufgaben (z. B. Bestellung mit NVDA/VoiceOver)",
]


LOC_RX = re.compile(r"^(?P<file>.+?):(?P<line>\d+)(?: \(|$)")


def files_overview(rep: Report):
    """Fundstellen je Datei — wo sich viele Befunde sammeln, liegt meist eine gemeinsame Ursache."""
    files = {}
    for f in rep.findings.values():
        if f.severity == "hinweis":
            continue
        for loc in f.locations:
            m = LOC_RX.match(loc)
            if not m or m.group("file").startswith("http"):
                continue
            entry = files.setdefault(m.group("file"), {"count": 0, "rules": {}})
            entry["count"] += 1
            entry["rules"][f.title] = entry["rules"].get(f.title, 0) + 1
    return sorted(({"file": k, **v} for k, v in files.items() if v["count"] >= 2),
                  key=lambda x: (-x["count"], x["file"]))


def render_md(target, rep: Report):
    f = rep.facts
    out = [f"# BFSG-Scan: {target}", "",
           f"Gescannt: {f['dateien'] or f['seiten']} Dateien/Seiten · scan.py {__version__}. "
           "Treffer sind Hinweise — jeden im Kontext bestätigen.", ""]
    overview = files_overview(rep)
    if overview:
        out.append("## Nach Datei\n")
        out.append("Wo sich Fundstellen sammeln, steckt meist eine gemeinsame Ursache — z. B. eine Komponente oder ein Template, "
                   "das mehrfach verwendet wird. Dort lohnt sich der Fix am meisten.\n")
        for e in overview[:15]:
            rules = ", ".join(f"{t} ({n}×)" for t, n in sorted(e["rules"].items(), key=lambda x: -x[1]))
            out.append(f"- `{e['file']}` — {e['count']} Fundstellen: {rules}")
        out.append("")
    items = sorted(rep.findings.values(), key=lambda x: (SEV_ORDER[x.severity], x.id))
    cur = None
    if not items:
        out.append("Keine statisch erkennbaren Barrieren gefunden. Runtime- und manuelle Prüfung trotzdem nötig.")
    for it in items:
        if it.severity != cur:
            cur = it.severity
            out.append(f"\n## {SEV_ICON[cur]} {cur.capitalize()}\n")
        out.append(f"### {it.title}  `[{it.id}]`")
        out.append(f"- **WCAG/Norm:** {it.wcag}")
        out.append(f"- **Hinweis:** {it.hint}")
        locs = it.locations[:MAX_LOCS]
        more = len(it.locations) - len(locs)
        out.append(f"- **Fundstellen ({len(it.locations)}):** " + ", ".join(f"`{l}`" for l in locs)
                   + (f" … +{more} weitere" if more > 0 else "") + "\n")
    out.append("\n## Nicht automatisch prüfbar\n")
    out += [f"- {x}" for x in NOT_STATIC]
    return "\n".join(out)


def main(argv=None):
    ap = argparse.ArgumentParser(description="BFSG-Audit: statischer Barrierefreiheits-Scan")
    ap.add_argument("target", help="Projektordner, Datei oder URL")
    ap.add_argument("--json", action="store_true", help="Ausgabe als JSON")
    ap.add_argument("--max-pages", type=int, default=8, help="max. Unterseiten im URL-Modus (Standard 8)")
    args = ap.parse_args(argv)

    rep = Report()
    t = args.target
    if re.match(r"^https?://", t):
        scan_url(t, rep, args.max_pages)
    elif os.path.isdir(t):
        scan_dir(t, rep)
    elif os.path.isfile(t):
        scan_file(t, rep)
    else:
        print(f"Ziel nicht gefunden: {t}", file=sys.stderr)
        return 2
    conclude(rep)
    if args.json:
        print(json.dumps({"target": t, "version": __version__, "facts": rep.facts, "files": files_overview(rep),
                          "findings": [x.__dict__ for x in sorted(rep.findings.values(),
                                                                  key=lambda x: (SEV_ORDER[x.severity], x.id))]},
                         ensure_ascii=False, indent=2))
    else:
        print(render_md(t, rep))
    return 0


if __name__ == "__main__":
    sys.exit(main())
