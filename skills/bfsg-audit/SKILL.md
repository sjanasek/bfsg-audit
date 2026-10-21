---
name: bfsg-audit
description: Prüft Websites, Online-Shops und Web-Apps auf digitale Barrierefreiheit nach dem Barrierefreiheitsstärkungsgesetz (BFSG) — klärt zuerst, ob das BFSG überhaupt gilt (B2C-Vertrag? Kleinstunternehmen?), prüft dann Code und Seiten gegen WCAG 2.1 AA (EN 301 549) mit Fundstelle und konkretem Code-Fix und erstellt die Pflicht-Informationen zur Barrierefreiheit nach Anlage 3 BFSG. Verwende diesen Skill immer, wenn jemand nach BFSG, Barrierefreiheitsstärkungsgesetz, European Accessibility Act/EAA, Barrierefreiheitserklärung, WCAG, a11y, Screenreader-Tauglichkeit, Tastaturbedienung oder "ist mein Shop barrierefrei" fragt, vor dem Go-live eines Shops oder Buchungssystems in Deutschland steht oder ein Repo/eine URL auf Barrieren prüfen lassen will — auch wenn nur "Accessibility" oder "Barrierefreiheit" fällt.
---

# BFSG-Audit für Entwickler

Ein Prüf-Workflow, der zwei Fragen beantwortet, die Entwickler:innen und Agenturen in Deutschland seit dem 28.06.2025 gestellt bekommen: **Muss diese Website barrierefrei sein?** und **Was genau muss ich im Code ändern?** Das Ergebnis ist ein Bericht, mit dem man sofort arbeiten kann — jede Barriere mit WCAG-Kriterium, Fundstelle im Code und Fix — plus auf Wunsch die gesetzlich verlangten Barrierefreiheitsinformationen.

**Grenze dieses Skills:** Technische Vorprüfung, keine Rechtsberatung. Ein Code-Audit kann Konformität nicht nachweisen: Kontrast, Screenreader-Verhalten, Inhalte, Dokumente und Prozesse brauchen Tests im Browser und von Menschen. Sag das einmal am Anfang des Berichts, statt es unter jeden Befund zu schreiben. Datenschutz (Cookies, Google Fonts, Datenschutzerklärung) und Impressum sind nicht Teil dieses Skills — wenn danach gefragt wird, darauf hinweisen, dass das eigene Prüfungen sind.

## Ablauf

### 1. Anwendungsbereich klären

Lies `references/rechtsrahmen.md` (Prüfschema, Ausnahmen, Pflichten — alles mit Fundstelle geprüft). Kläre dann knapp, was du nicht aus dem Code ablesen kannst, und starte den Scan parallel, statt auf Antworten zu warten:

- **Wird online ein Vertrag mit Verbraucher:innen geschlossen?** (Shop, Buchung, Bestellung, Abo, Ticket) → Indizien liefert der Scan (`[hinweis-ecommerce]`), die Antwort kommt vom Betreiber.
- **Kleinstunternehmen?** Unter 10 Beschäftigte und Jahresumsatz oder Bilanzsumme höchstens 2 Mio. € → dann für Dienstleistungen ausgenommen.

Ergebnis als eine von drei Einordnungen an den Anfang des Berichts:
- **BFSG gilt wahrscheinlich** → Befunde nach Schwere 🔴/🟠
- **BFSG gilt wahrscheinlich nicht** (Info-Seite, B2B, Kleinstunternehmen) → alle Befunde als 🟡 Empfehlung, mit dem Satz, warum Barrierefreiheit trotzdem lohnt
- **Unklar** → als ❓ offene Frage formulieren und vorsorglich wie "gilt" bewerten

Entscheide die Rechtsfrage nicht selbst, wenn sie an Fakten hängt, die du nicht kennst.

### 2. Statischer Scan

```bash
python3 scripts/scan.py <projektordner>        # Repo, Build-Ordner, Theme
python3 scripts/scan.py https://example.de      # Live-Seite (Startseite + verlinkte Unterseiten)
python3 scripts/scan.py <ziel> --json           # maschinenlesbar
```

Nur Python-Standardbibliothek. Der Scanner findet Muster, keine Wahrheiten: Prüfe jeden Treffer im Code (auskommentiert? Komponente setzt das Attribut zur Laufzeit? Third-Party-Code in `vendor/`?) und verwirf Fehlalarme still. Was er statisch nicht sehen kann, steht in der Ausgabe unter "Nicht automatisch prüfbar".

### 3. Runtime-Prüfung (wenn möglich)

Die statische Analyse sieht nur das ausgelieferte HTML. Kontrast, Inhalte, die erst JavaScript aufbaut (React, Vue, Shopify …), und das Verhalten bei Tastaturbedienung brauchen einen Browser. Dafür gibt es `scripts/browser-scan.mjs`. Es braucht eine erreichbare URL — eine Live-Seite oder den lokalen Entwicklungsserver (`http://localhost:…`):

```bash
node scripts/browser-scan.mjs <url> [--max-pages N] [--mobile] [--json]
```

Das Skript lädt die Seite in Chromium, prüft sie mit **axe-core** (WCAG 2.0–2.2, deutsche Texte) und macht zusätzlich einen **Tastatur-Durchlauf**: Es tabbt durch die Seite und meldet Elemente ohne sichtbaren Fokus (2.4.7) und Tastaturfallen (2.1.2). Ist axe-core nicht installiert, laufen eingebaute Regeln (Kontrast, Alternativtexte, Beschriftungen, Namen, Sprache, Titel) — das Ergebnis sagt in der Zeile „Engine“, welche Variante lief. Die Fundstellen sind CSS-Selektoren; die zugehörige Datei im Projekt suchst du über Klassen, IDs oder Textinhalt.

**Voraussetzungen:** Node 18+, Playwright mit Chromium, empfohlen axe-core. Fehlen sie (Exit-Code 3), frag die Nutzerin bzw. den Nutzer, bevor du etwas installierst — es wird ein Browser heruntergeladen. Installiere dann nicht ins Projekt, sondern in einen eigenen Ordner, den das Skript automatisch findet:

```bash
npm install --prefix ~/.cache/bfsg-audit playwright axe-core
~/.cache/bfsg-audit/node_modules/.bin/playwright install chromium
```

Was der Browser-Scan nicht abdeckt, prüfst du, wenn du Browser-Tools hast, selbst: Zoom 400 % bzw. 320 px Breite, Cookie-Banner und Checkout durchklicken, Formular-Fehlermeldungen auslösen. Kein Browser verfügbar → im Bericht unter "Manuell zu prüfen" auflisten, nicht weglassen.

Für automatische Prüfungen in CI/CD: `--fail-on kritisch` (oder `wichtig`) liefert Exit-Code 1, wenn solche Befunde vorliegen.

### 4. Bewerten

Ordne jeden bestätigten Befund einem WCAG-Erfolgskriterium zu (`references/wcag-pruefliste.md`). Prüfe die **Brennpunkte zuerst**: Login, Captcha, Checkout, Zahlung — dort werden Barrieren am teuersten, und § 19 BFSGV hebt Identifizierungs-, Authentifizierungs-, Sicherheits- und Zahlungsfunktionen eigens hervor.

Schweregrade (bei "BFSG gilt"):
- 🔴 **Kritisch**: blockiert eine Kernaufgabe für eine Nutzergruppe — Checkout/Login nicht per Tastatur bedienbar, Formular ohne Labels, Captcha ohne Alternative, Tastaturfalle, Zoom gesperrt, fehlende Barrierefreiheitsinformationen (§ 14 Abs. 1 Nr. 2 BFSG)
- 🟠 **Wichtig**: erschwert die Nutzung deutlich — fehlende Alt-Texte, unsichtbarer Fokus, Icon-Buttons ohne Namen, fehlende Sprache, Kontrastfehler im Fließtext
- 🟡 **Empfehlung**: WCAG-2.2-Kriterien, Best Practices, alles bei "BFSG gilt nicht"

### 5. Bericht

```markdown
# BFSG-Audit: [Projekt/Domain]
Stand: [Datum] · Maßstab: WCAG 2.1 AA (De-facto-Referenz EN 301 549 V3.2.1), WCAG 2.2 als Empfehlung
> Technische Vorprüfung, keine Rechtsberatung. Ein Code-Audit ersetzt keine Prüfung mit Screenreader und echten Nutzer:innen.

## Gilt das BFSG?
[Einordnung + ein, zwei Sätze Begründung + offene Fragen]

## Ergebnis in einem Satz
[z. B. "Checkout per Tastatur nicht abschließbar, 23 Bilder ohne Alternativtext, Barrierefreiheitsinformationen fehlen."]

## 🔴 Kritisch
### [Kurztitel] — WCAG [SC-Nummer + Name]
- **Wo:** `pfad/datei:zeile` (bzw. URL + Element)
- **Problem:** [wer ist betroffen und wie — z. B. "Screenreader lesen nur 'Schaltfläche'"]
- **Fix:**
  ```[sprache]
  [konkreter Code im Stil des Projekts]
  ```

## 🟠 Wichtig
## 🟡 Empfehlung
## ❓ Offene Fragen
## 👤 Manuell zu prüfen
[was ohne Browser/Screenreader nicht prüfbar war — konkret, z. B. "Kontrast der grauen Preisangaben", "Stripe-Zahlungsformular mit NVDA"]
## ✅ Geprüft und in Ordnung
```

Gruppiere gleichartige Treffer (23× `img` ohne `alt` = ein Befund mit Fundstellenliste, nicht 23 Befunde). Zeig den Fix einmal exemplarisch und nenne die übrigen Stellen.

### 6. Barrierefreiheitsinformationen (Anlage 3 BFSG)

Wenn das BFSG gilt und keine solche Seite existiert (Scan meldet `[keine-bf-info]`), biete an, sie zu erstellen: `assets/barrierefreiheitsinformationen.md`. Fülle sie aus dem, was du über das Angebot weißt, und **übernimm "Bekannte Einschränkungen" ehrlich aus dem Bericht**. Keine Konformitätsaussage, die kein Test belegt. Angaben, die der Betreiber liefern muss, bleiben als `[[…]]` stehen.

### 7. Fixes umsetzen (auf Wunsch)

- Nur ändern, was im Bericht steht; jede Änderung zeigen.
- Muster aus `references/fix-muster.md`, angepasst an Framework und Stil des Projekts. Native Elemente vor ARIA.
- Nach dem Umsetzen Scan erneut laufen lassen und Vorher/Nachher-Zahlen nennen.
- Keine Accessibility-Overlays als Lösung vorschlagen.

## Formulierungen

Schreib nie, eine Seite sei "BFSG-konform", "barrierefrei zertifiziert" oder "rechtssicher". Ein Audit findet Barrieren, es bescheinigt keine Konformität. Gute Formulierungen: "Folgende Barrieren wurden gefunden", "Die automatisch prüfbaren Kriterien sind erfüllt; offen sind …".

Schreib den Bericht für Entwickler:innen, aber erklär bei jedem Befund in einem Halbsatz, *wen* er betrifft (Screenreader-Nutzer:innen, Tastaturnutzer:innen, Menschen mit Sehschwäche, motorischen oder kognitiven Einschränkungen). Das macht Prioritäten nachvollziehbar und hilft, den Bericht an Kund:innen weiterzugeben.
