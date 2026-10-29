# Changelog

## Unveröffentlicht

- Neu: Formulare mit falschen Eingaben (`--forms`, Issue #2)
  - erkennt prüfbare Formulare (ohne Suchfelder, Warenkorb-Formulare und versteckte Formulare) und plant falsche Eingaben aus `required`, `type`, `pattern`, `minlength`, `min`/`max`, `autocomplete` und der Beschriftung
  - Abschicken-Schutz: Navigation, POST und fetch/XHR sind beim Absenden gesperrt, Service Worker blockiert
  - Ergebnis je Formular: vom Browser verhindert, per Skript verhindert, alert(), würde abgeschickt, keine Reaktion; im JSON als `forms`
  - gleiche Formulare auf mehreren Seiten werden einmal geprüft

## 1.3.0 — 2026-10-28

- Neu: Ursachen statt Symptome
  - Browser-Scan: Abschnitt „Ursachen“ fasst Fundstellen zusammen — wiederholte Komponente (z. B. Produktkachel), Textfarbe mit CSS-Variable und Farbvorschlag für ausreichenden Kontrast, gleiches Element-Muster; sortiert nach Zahl der behobenen Fundstellen; im JSON als `causes`
  - Statischer Scan: Abschnitt „Nach Datei“ zeigt, wo sich Fundstellen sammeln; im JSON als `files`
  - bewusst ohne Aufwandsschätzung — nur Zählbares (Fundstellen, Seiten, Zustände)

## 1.2.0 — 2026-10-27

- Neu: Zustände im Browser-Scan (`--states datei.json`) — Dialoge öffnen, Formulare mit Fehlern auslösen, Warenkorb füllen und jeden Zustand einzeln prüfen
  - Schritte: click, fill, select, check, hover, press, waitFor, wait, goto
  - Bericht mit Tabelle „Geprüfte Zustände“ (geprüft / fehlgeschlagen / manuell offen, Befunde je Zustand) und Liste der nicht geprüften Zustände
  - Ohne Zustandsdatei nennt der Bericht die typischen offenen Zustände
  - Vorlage `assets/zustaende-beispiel.json`, Sicherheitsregeln für Live-Seiten in SKILL.md

## 1.1.0 — 2026-10-21

- Neu: `browser-scan.mjs` prüft Seiten im echten Browser (Chromium über Playwright)
  - axe-core mit deutschen Meldungen, WCAG 2.0–2.2; ohne axe-core eingebaute Regeln inkl. Kontrastberechnung
  - Tastatur-Durchlauf: unsichtbarer Fokus (2.4.7) und Tastaturfallen (2.1.2)
  - Unterseiten derselben Domain, Smartphone-Ansicht, JSON-Ausgabe, `--fail-on` für CI
  - funktioniert auch bei strenger Content-Security-Policy
- SKILL.md, README und Anleitung um die Browser-Prüfung ergänzt
- Anleitung, Datenschutzhinweis, Support-Link und Icon für das Anthropic-Verzeichnis

## 1.0.0 — 2026-10-18

Erste Version.
- Anwendungsbereichsprüfung BFSG (§§ 1, 2, 3, 38) mit geprüften Fundstellen, Stand 18.10.2026
- WCAG-2.1-AA-Prüfliste mit WCAG-2.2-Kriterien als Empfehlung, Brennpunkte nach § 19 BFSGV
- Statischer Scanner (HTML, JSX/TSX, Vue, Svelte, Astro, PHP, CSS; Ordner und URL)
- Fix-Muster und Vorlage für Barrierefreiheitsinformationen nach Anlage 3 BFSG
- Regressionstests und Evals
