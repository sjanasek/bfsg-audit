# Datenschutzhinweis — BFSG-Audit

Stand: 21.10.2026

BFSG-Audit ist ein kostenloses Open-Source-Plugin (Claude-Skill und Python-Skript). Dieser Hinweis erklärt, was mit Daten passiert, wenn du es nutzt.

## Kurz gesagt

**Die Anbieterin von BFSG-Audit erhebt, empfängt und speichert keine Daten.** Es gibt keinen Server, kein Konto, kein Tracking und keine Telemetrie.

## Was der Skill tut

- **Code prüfen:** Der Skill und das Skript lesen die Dateien des Projekts, das du selbst zur Prüfung angibst. Das geschieht in deiner eigenen Umgebung. Die Dateien werden nicht an die Anbieterin übertragen.
- **Webseiten prüfen:** Wenn du eine URL angibst, ruft das Skript diese Seite und bis zu acht verlinkte Unterseiten derselben Domain ab, wie ein Browser. Dabei sieht der Server dieser Website, wie bei jedem Seitenaufruf, die übliche technische Information (z. B. die IP-Adresse). An die Anbieterin von BFSG-Audit geht nichts.
- **Browser-Prüfung (optional):** Wenn Claude die Seite zusätzlich mit axe-core prüft, wird dieses Werkzeug über die Paketverwaltung npm geladen.
- **Ergebnisse:** Berichte entstehen in deiner Sitzung und werden von BFSG-Audit nirgends gespeichert.

## Nutzung über Claude

Wenn du BFSG-Audit in Claude verwendest, verarbeitet Anthropic die Inhalte deiner Unterhaltung, also auch Code und Prüfergebnisse, nach den eigenen Datenschutzbestimmungen von Anthropic. Darauf hat die Anbieterin von BFSG-Audit keinen Einfluss. Es gelten die [Datenschutzbestimmungen von Anthropic](https://www.anthropic.com/legal/privacy).

## GitHub

Das Projekt liegt auf GitHub. Wenn du das Repository besuchst, ein Issue eröffnest oder einen Stern vergibst, gelten die [Datenschutzbestimmungen von GitHub](https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement).

## Kontakt

Fragen zum Datenschutz: bitte über [GitHub-Issues](https://github.com/sjanasek/bfsg-audit/issues) oder über die Kontaktdaten im GitHub-Profil von [sjanasek](https://github.com/sjanasek).
