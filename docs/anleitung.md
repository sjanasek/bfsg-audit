# BFSG-Audit — Anleitung

Diese Anleitung erklärt, wie du BFSG-Audit installierst, was der Skill prüft und wie du die Ergebnisse liest. Für einen schnellen Überblick siehe die [README](../README.md).

> **Keine Rechtsberatung.** BFSG-Audit ist eine technische Vorprüfung. Es findet Barrieren, kann aber keine Konformität mit dem BFSG bescheinigen.

## Inhalt

1. [Installation](#1-installation)
2. [Erste Prüfung](#2-erste-prüfung)
3. [Was passiert bei einer Prüfung?](#3-was-passiert-bei-einer-prüfung)
4. [Den Bericht lesen](#4-den-bericht-lesen)
5. [Fixes umsetzen lassen](#5-fixes-umsetzen-lassen)
6. [Informationen zur Barrierefreiheit erstellen](#6-informationen-zur-barrierefreiheit-erstellen)
7. [Den Scanner ohne Claude nutzen](#7-den-scanner-ohne-claude-nutzen)
8. [Die Browser-Prüfung](#8-die-browser-prüfung)
9. [Was automatisch nicht geprüft werden kann](#9-was-automatisch-nicht-geprüft-werden-kann)
10. [Häufige Fragen](#10-häufige-fragen)
11. [Hilfe und Feedback](#11-hilfe-und-feedback)

## 1. Installation

**Claude Code**

```
/plugin marketplace add sjanasek/bfsg-audit
/plugin install bfsg-audit@sjanasek
```

**Claude-Apps (Web, Desktop, Mobil) und Cowork:** Sobald das Plugin im Verzeichnis von Anthropic freigeschaltet ist, kannst du es dort direkt hinzufügen.

**Manuell:** Den Ordner `skills/bfsg-audit/` nach `~/.claude/skills/` (für alle Projekte) oder nach `.claude/skills/` in deinem Projekt kopieren.

## 2. Erste Prüfung

Du musst keinen Befehl kennen. Frag Claude einfach in normaler Sprache, zum Beispiel:

- „Prüf meinen Shop auf BFSG, der Code liegt in ./shop“
- „Check https://example.de auf Barrierefreiheit“
- „Muss meine Portfolio-Seite eigentlich barrierefrei sein?“
- „Schreib die Barrierefreiheitserklärung für unseren Shop“

Der Skill wird automatisch aktiv, wenn es um BFSG, Barrierefreiheit, WCAG oder Accessibility geht.

## 3. Was passiert bei einer Prüfung?

**Schritt 1 — Gilt das BFSG überhaupt?**
Claude klärt, ob die Seite unter das Gesetz fällt. Entscheidend ist, ob online ein Vertrag mit Verbraucher:innen geschlossen wird (Shop, Buchung, Bestellung) und ob das Unternehmen als Kleinstunternehmen ausgenommen ist (weniger als 10 Beschäftigte und höchstens 2 Mio. € Jahresumsatz oder Bilanzsumme). Was sich nicht aus dem Code ablesen lässt, fragt Claude nach oder markiert es als offene Frage.

**Schritt 2 — Statischer Scan**
Ein Skript durchsucht HTML, Templates, Komponenten (React, Vue, Svelte, Astro, PHP …) und CSS nach typischen Barrieren.

**Schritt 3 — Prüfung im Browser (wenn möglich)**
Ist eine Adresse erreichbar (Live-Seite oder lokaler Entwicklungsserver), öffnet ein zweites Skript die Seite in einem echten Browser. Es prüft Kontraste und Inhalte, die erst per JavaScript entstehen, und tabbt einmal durch die Seite, um unsichtbaren Fokus und Tastaturfallen zu finden. Details in [Abschnitt 8](#8-die-browser-prüfung).

**Schritt 4 — Bericht**
Alle bestätigten Befunde, sortiert nach Schwere, mit WCAG-Kriterium, Fundstelle und Lösungsvorschlag.

## 4. Den Bericht lesen

| Symbol | Bedeutung |
|---|---|
| 🔴 Kritisch | Blockiert eine Kernaufgabe, z. B. Formular ohne Beschriftung, Bestellung nicht per Tastatur möglich, Zoom gesperrt |
| 🟠 Wichtig | Erschwert die Nutzung deutlich, z. B. fehlende Alternativtexte, unsichtbarer Fokus |
| 🟡 Empfehlung | Gute Praxis oder Kriterien aus WCAG 2.2 |
| ❓ Offene Frage | Muss der Betreiber klären, z. B. Unternehmensgröße |
| 👤 Manuell prüfen | Lässt sich nicht automatisch prüfen |

Gilt das BFSG für die Seite wahrscheinlich nicht, stuft der Skill alle Befunde als Empfehlung ein. Barrierefreiheit lohnt sich trotzdem: mehr Nutzer:innen, bessere Bedienbarkeit, oft auch bessere Suchmaschinen-Ergebnisse.

Jeder Befund nennt:
- **WCAG-Kriterium**, z. B. „1.1.1 Nicht-Text-Inhalt“
- **Wo:** Datei und Zeile (bei Live-Seiten die URL und das Element)
- **Wen es betrifft:** z. B. Screenreader-Nutzer:innen, Tastaturnutzer:innen
- **Fix:** konkreter Code

## 5. Fixes umsetzen lassen

Am Ende des Berichts bietet Claude an, die Fixes direkt umzusetzen. Sagst du Ja, ändert Claude nur die Stellen aus dem Bericht, zeigt jede Änderung und lässt den Scan danach erneut laufen.

Das funktioniert, wenn Claude Zugriff auf dein Projekt hat, zum Beispiel in Claude Code. In einem normalen Chat bekommst du die Fixes als Code zum Kopieren.

## 6. Informationen zur Barrierefreiheit erstellen

Wenn das BFSG gilt, verlangt es Informationen zur Barrierefreiheit (§ 14 und Anlage 3 BFSG), üblich als eigene Seite im Footer. Der Skill erstellt dafür einen Entwurf:

- Beschreibung des Angebots und des Ablaufs
- wie die Anforderungen erfüllt werden
- **bekannte Einschränkungen ehrlich aus dem Prüfbericht**
- zuständige Marktüberwachungsbehörde

Angaben, die nur du kennst, bleiben als `[[Platzhalter]]` stehen. Der Skill erfindet keine Kontaktdaten und keine Testergebnisse. Bitte prüfe die Behördenangaben vor dem Veröffentlichen auf Aktualität.

## 7. Den Scanner ohne Claude nutzen

Der Scanner ist ein eigenständiges Python-Skript ohne zusätzliche Pakete (Python 3.9 oder neuer). Er liegt im Repository unter `skills/bfsg-audit/scripts/scan.py`. Lade das Repository von GitHub herunter, schau dir das Skript gern vorher an, und starte es dann aus dem Repository-Ordner:

```bash
python3 skills/bfsg-audit/scripts/scan.py ./mein-projekt
python3 skills/bfsg-audit/scripts/scan.py https://example.de
python3 skills/bfsg-audit/scripts/scan.py ./mein-projekt --json
```

| Option | Bedeutung |
|---|---|
| `<ordner>` | prüft alle relevanten Dateien im Ordner (ohne `node_modules`, Build-Ordner usw.) |
| `<datei>` | prüft eine einzelne Datei |
| `<url>` | prüft die Seite und bis zu 8 verlinkte Unterseiten derselben Domain |
| `--json` | Ausgabe als JSON, z. B. für eigene Auswertungen |
| `--max-pages N` | Anzahl der Unterseiten im URL-Modus |

Der Scanner findet nur, er repariert nichts. Die Fixes kommen von Claude.

**Was er erkennt:** Bilder ohne Alternativtext, Formularfelder ohne Beschriftung, klickbare Elemente ohne Tastaturzugang, Buttons und Links ohne Namen, iframes ohne Titel, fehlende Seitensprache und Titel, entfernte Fokus-Rahmen, gesperrten Zoom, Autoplay mit Ton, blockiertes Einfügen in Passwortfelder, fehlendes `autocomplete`, positive `tabindex`-Werte, übersprungene Überschriftenebenen, Accessibility-Overlays und fehlende Barrierefreiheitsinformationen. Außerdem Hinweise, ob es sich um einen Shop handelt.

## 8. Die Browser-Prüfung

Der statische Scanner sieht nur das HTML, das der Server ausliefert. Viele Shops und Web-Apps bauen ihren Inhalt aber erst im Browser per JavaScript auf, und Kontraste lassen sich nur mit den tatsächlich angezeigten Farben berechnen. Dafür gibt es ein zweites Skript: `skills/bfsg-audit/scripts/browser-scan.mjs`.

**Was es prüft:**
- die fertig aufgebaute Seite mit **axe-core**, dem verbreitetsten Werkzeug für automatische WCAG-Prüfungen (WCAG 2.0 bis 2.2, Meldungen auf Deutsch)
- einen **Tastatur-Durchlauf**: Das Skript drückt nacheinander Tab und meldet Elemente, deren Fokus nicht sichtbar ist (WCAG 2.4.7), und Stellen, an denen der Fokus hängen bleibt (Tastaturfalle, WCAG 2.1.2)
- auf Wunsch weitere Unterseiten derselben Domain, bevorzugt Warenkorb, Kasse, Login, Kontakt und Barrierefreiheit

Ist axe-core nicht installiert, laufen eingebaute Regeln: Kontrast, Alternativtexte, Beschriftungen, Namen von Buttons und Links, Sprache, Seitentitel, gesperrter Zoom und einiges mehr. Welche Variante lief, steht im Bericht in der Zeile „Engine“.

**Voraussetzungen:** Node 18 oder neuer, Playwright mit Chromium und, empfohlen, axe-core. Am einfachsten installierst du alles einmalig in einen eigenen Ordner, den das Skript automatisch findet:

```bash
npm install --prefix ~/.cache/bfsg-audit playwright axe-core
~/.cache/bfsg-audit/node_modules/.bin/playwright install chromium
```

Wenn Claude die Prüfung übernimmt, fragt es vorher, ob es das installieren darf.

**Aufruf** (aus dem Repository-Ordner):

```bash
node skills/bfsg-audit/scripts/browser-scan.mjs https://example.de
node skills/bfsg-audit/scripts/browser-scan.mjs http://localhost:3000 --max-pages 10
node skills/bfsg-audit/scripts/browser-scan.mjs https://example.de --mobile --json
```

| Option | Bedeutung |
|---|---|
| `--max-pages N` | zusätzlich bis zu N Unterseiten derselben Domain (Standard 5) |
| `--mobile` | Smartphone-Ansicht (390 × 844 px) |
| `--json` | Ausgabe als JSON |
| `--fail-on kritisch` | Exit-Code 1, wenn kritische Befunde vorliegen (auch `wichtig`), z. B. für automatische Prüfungen bei jedem Deployment |
| `--states DATEI` | Zustände aus einer JSON-Datei durchklicken und einzeln prüfen (siehe unten) |
| `--no-axe` | nur die eingebauten Regeln verwenden |

**Gut zu wissen:**
- Die Fundstellen sind CSS-Selektoren im Browser, z. B. `#app > main > form > input`. Die zugehörige Datei im Projekt findest du über Klassen, IDs oder Text. Wenn Claude die Prüfung macht, sucht es die Stelle im Code selbst.
- Das Skript lädt axe-core auch auf Seiten mit strenger Content-Security-Policy, ohne die Seite zu verändern.
- Ohne Zustandsdatei prüft es nur den Zustand direkt nach dem Laden und sagt im Bericht, welche typischen Zustände dadurch offen bleiben. Mit einer Zustandsdatei klickt es Abläufe durch (siehe unten).
- Es ruft nur die angegebenen Seiten auf, wie ein normaler Browser, und sendet keine Daten an Dritte.

### Zustände prüfen: Dialoge, Fehlermeldungen, Warenkorb

Viele Barrieren zeigen sich erst, wenn man etwas tut: ein Dialog öffnet sich, ein Formular meldet einen Fehler, der Warenkorb füllt sich. Diese Zustände beschreibst du in einer kleinen JSON-Datei. Der Browser-Scan klickt sie durch und prüft jeden einzeln.

```json
{
  "baseUrl": "http://localhost:3000",
  "states": [
    { "name": "Warenkorb leer", "url": "/warenkorb" },
    { "name": "Größentabelle geöffnet", "url": "/produkte/kaffee",
      "steps": [ { "click": "text=Größentabelle" }, { "waitFor": "dialog[open]" } ] },
    { "name": "Kontakt: ungültige E-Mail", "url": "/kontakt",
      "steps": [ { "fill": "#email", "value": "keine-mail" }, { "press": "Tab" }, { "waitFor": ".error" } ] },
    { "name": "Bestellabschluss", "manual": "Nur mit Testzahlung prüfbar" }
  ]
}
```

Eine ausführliche Vorlage liegt unter `skills/bfsg-audit/assets/zustaende-beispiel.json`.

```bash
node skills/bfsg-audit/scripts/browser-scan.mjs --states zustaende.json
```

| Schritt | Bedeutung |
|---|---|
| `{ "click": "Selektor" }` | Element anklicken |
| `{ "fill": "Selektor", "value": "Text" }` | Feld ausfüllen |
| `{ "select": "Selektor", "value": "Option" }` | Option in einer Auswahlliste wählen |
| `{ "check": "Selektor" }` | Checkbox ankreuzen |
| `{ "hover": "Selektor" }` | Maus über ein Element bewegen (z. B. für Tooltips) |
| `{ "press": "Taste" }` | Taste drücken, z. B. `Tab`, `Escape`, `Enter`; mit `"on": "Selektor"` in einem bestimmten Element |
| `{ "waitFor": "Selektor" }` | warten, bis ein Element sichtbar ist |
| `{ "wait": 500 }` | Millisekunden warten |
| `{ "goto": "/pfad" }` | andere Seite öffnen |

Selektoren funktionieren wie in Playwright: `#id`, `.klasse`, `[role=dialog]` oder `text=Größentabelle`.

Im Bericht steht dann die Tabelle **„Geprüfte Zustände“**: Für jeden Zustand siehst du, ob er geprüft wurde, ob ein Schritt fehlgeschlagen ist (mit Grund) oder ob er bewusst manuell offen ist, und wie viele Befunde dort gefunden wurden. Jede Fundstelle nennt ihren Zustand, z. B. `[Größentabelle geöffnet]`. Darunter listet der Bericht alle Zustände, die nicht geprüft wurden.

**Bitte beachten:**
- Auf einer Live-Seite nichts absenden, bestellen oder buchen. Abläufe mit Folgen nur auf dem eigenen Rechner (`localhost`) oder einer Testumgebung prüfen.
- Keine echten Passwörter oder Kundendaten in die Datei schreiben. Logins nur mit Testkonten, sonst als `manual` eintragen.

## 9. Was automatisch nicht geprüft werden kann

Viele Barrieren lassen sich nur von Menschen finden. Der Bericht listet diese Punkte ausdrücklich auf:

- Farbkontraste über Hintergrundbildern, Verläufen oder Transparenz (der Browser-Scan meldet sie als „manuell prüfen“)
- Tastaturbedienung von Menüs, Dialogen und Formularen: Seite nur mit Tab, Enter und Esc bedienen (der Browser-Scan tabbt nur einmal durch)
- Vergrößerung auf 200 % und Ansicht bei 320 px Breite
- Qualität von Alternativtexten, Linktexten und Fehlermeldungen
- Untertitel und Audiodeskription bei Videos
- eingebettete Fremd-Widgets wie Zahlung, Captcha oder Chat
- Test der wichtigsten Abläufe mit einem Screenreader (z. B. NVDA oder VoiceOver)

## 10. Häufige Fragen

**Ist meine Seite nach der Prüfung BFSG-konform?**
Das kann kein automatisches Werkzeug bescheinigen. Der Skill findet technische Barrieren im Code. Für Konformität gehören auch manuelle Tests, Inhalte und Dokumente dazu.

**Welche WCAG-Version wird geprüft?**
WCAG 2.1 Stufe AA als anerkannter Maßstab (über die Norm EN 301 549 V3.2.1). Die zusätzlichen Kriterien aus WCAG 2.2 prüft der Skill als Empfehlung mit, weil die neue EN 301 549 V4.1.1 darauf umstellt.

**Werden meine Daten irgendwohin geschickt?**
Nein. Der Skill sammelt und speichert nichts. Siehe [Datenschutzhinweis](../PRIVACY.md).

**Prüft der Skill auch Datenschutz und Impressum?**
Nein, bewusst nicht. Das sind eigene Themen mit eigenen Gesetzen.

**Kostet das etwas?**
Nein. BFSG-Audit ist kostenlos und Open Source (MIT-Lizenz).

## 11. Hilfe und Feedback

Fehler gefunden, Frage oder Idee? Eröffne ein [Issue auf GitHub](https://github.com/sjanasek/bfsg-audit/issues). Rechtsänderungen bitte mit Quelle (Gesetzestext, Urteil mit Aktenzeichen oder Behördendokument).
