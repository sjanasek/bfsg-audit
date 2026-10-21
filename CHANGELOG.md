# Changelog

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
