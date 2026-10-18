# Rechtsrahmen BFSG — geprüfte Fakten

Stand: 18.10.2026. Jede Aussage hier wurde am amtlichen Text (gesetze-im-internet.de) bzw. an der genannten Quelle geprüft. Wenn du im Bericht etwas behauptest, das hier nicht steht, kennzeichne es als Einschätzung. Bei entscheidenden Punkten und wenn Websuche verfügbar ist: kurz gegenprüfen, ob sich etwas geändert hat.

## Gilt das BFSG? — Prüfschema

### Schritt 1: Ist es eine erfasste Dienstleistung? (§ 1 Abs. 3 BFSG)

Erfasst sind Dienstleistungen **für Verbraucher**, die nach dem 28.06.2025 erbracht werden:
1. Telekommunikationsdienste (außer M2M)
2. bestimmte Elemente von Personenbeförderung (Luft, Bus, Schiene, Schiff — Websites, Apps, E-Tickets, Verkehrsinfos, Terminals; Stadt-/Vorort-/Regionalverkehr nur Terminals)
3. Bankdienstleistungen für Verbraucher
4. E-Books und zugehörige Software
5. **Dienstleistungen im elektronischen Geschäftsverkehr** ← für Websites der Normalfall

**Definition** (§ 2 Nr. 26 BFSG): digitale Dienste, die über Webseiten und Apps angeboten und **elektronisch auf individuelle Anfrage eines Verbrauchers im Hinblick auf den Abschluss eines Verbrauchervertrags** erbracht werden.

Daraus folgt für die Praxis:
- **Online-Shop** an Verbraucher → erfasst, auch wenn die verkauften Produkte selbst nicht unter das BFSG fallen (Bundesfachstelle Barrierefreiheit, FAQ).
- **Online-Bestellung/-Buchung mit Vertragsschluss** (z. B. Lieferdienst, Ticket, Kurs-Buchung) → erfasst.
- **Reine Informations-, Portfolio- oder Imageseite ohne Vertragsschluss** → nach der Definition nicht erfasst.
- **Reines B2B** → nicht erfasst (kein Verbrauchervertrag).
- **Terminbuchung, Kontaktformular, Anfrageformular** → nicht ausdrücklich geregelt. Entscheidend ist, ob online ein Verbrauchervertrag angebahnt/geschlossen wird. **Als offene Frage kennzeichnen, nicht entscheiden.**

### Schritt 2: Kleinstunternehmen? (§ 3 Abs. 3, § 2 Nr. 17 BFSG)

Die Barrierefreiheitspflicht nach § 3 Abs. 1 gilt **nicht für Kleinstunternehmen, die Dienstleistungen anbieten oder erbringen**.

Kleinstunternehmen = **weniger als 10 Beschäftigte** UND (**Jahresumsatz ≤ 2 Mio. €** ODER **Jahresbilanzsumme ≤ 2 Mio. €**).

- Die Ausnahme gilt nur für Dienstleistungen, nicht für Produkte.
- Ob ein Unternehmen darunter fällt, sieht man nicht im Code → immer als ❓ offene Frage an den Betreiber.
- Auch wer ausgenommen ist: Barrierefreiheit bleibt sinnvoll (größere Zielgruppe, SEO, Zukunftssicherheit) → Befunde dann als 🟡 Empfehlung statt 🔴/🟠 einstufen.

### Schritt 3: Ausnahmen für bestimmte Inhalte (§ 1 Abs. 4 BFSG)

Nicht erfasst sind:
1. aufgezeichnete zeitbasierte Medien (Video/Audio), veröffentlicht vor dem 28.06.2025
2. Office-Dateien (PDF, Word …), veröffentlicht vor dem 28.06.2025
3. Online-Karten, sofern bei Navigationskarten die wesentlichen Informationen barrierefrei digital bereitgestellt werden
4. Inhalte Dritter, die der Anbieter weder finanziert, entwickelt noch kontrolliert
5. archivierte Inhalte, die nach dem 28.06.2025 nicht mehr aktualisiert werden

### Übergangsregel (§ 38 Abs. 1 BFSG)

Wortlaut sinngemäß: Dienstleistungen dürfen **bis 27.06.2030** weiter mit **Produkten** erbracht werden, die vor dem 28.06.2025 rechtmäßig dafür eingesetzt wurden; vor dem 28.06.2025 geschlossene Verträge dürfen bis Laufzeitende, höchstens bis 27.06.2030, fortbestehen.

**Ob eine bestehende Website als solches "Produkt" gilt, ist umstritten.** Im Bericht niemals als sichere Ausnahme darstellen. Formulierung: "Ob § 38 BFSG für bestehende Websites greift, ist rechtlich ungeklärt — nicht darauf verlassen."

## Welche Anforderungen gelten?

- **§ 12 Nr. 3 BFSGV**: Webseiten einschließlich zugehöriger Online-Anwendungen und mobile Dienste einschließlich Apps müssen auf konsistente und angemessene Weise **wahrnehmbar, bedienbar, verständlich und robust** gestaltet sein (die vier WCAG-Prinzipien).
- **§ 12 Nr. 2 BFSGV**: Informationen zur Funktionsweise der Dienstleistung u. a. über mehr als einen Sinneskanal, verständlich, in geeigneten Textformaten, mit ausreichender Schriftgröße, Kontrast und Abständen, mit Alternativen für Nicht-Text-Inhalte.
- **§ 19 BFSGV** (zusätzlich für elektronischen Geschäftsverkehr):
  1. Informationen zur Barrierefreiheit der angebotenen Produkte/Dienstleistungen bereitstellen, soweit der Anbieter solche Informationen hat
  2. + 3. **Identifizierung, Authentifizierung, Sicherheits- und Zahlungsfunktionen, elektronische Signaturen und Zahlungsdienste** wahrnehmbar, bedienbar, verständlich und robust → **Login, Captcha, Checkout und Payment besonders prüfen**
- **Umfang**: Nach Auffassung der Bundesfachstelle Barrierefreiheit muss **die gesamte Website/App** die Anforderungen erfüllen, nicht nur der Bestellprozess (gestützt auf § 12 Nr. 3 BFSGV).

### Technischer Maßstab

- Die Bundesfachstelle verweist auf die Norm **EN 301 549**. Rechtlich maßgebliche Version ist derzeit **V3.2.1**, die für Webinhalte auf **WCAG 2.1 Level AA** verweist.
- **EN 301 549 V4.1.1** (verabschiedet August 2026, veröffentlicht September 2026) stellt auf **WCAG 2.2** um und enthält einen Anhang mit Bezug zum European Accessibility Act. Sie ist laut AccessibleEU (07.09.2026) **noch nicht im EU-Amtsblatt zitiert** und begründet daher noch keine Konformitätsvermutung.
- **Für den Bericht**: gegen **WCAG 2.1 AA** prüfen (Pflicht-Maßstab), die zusätzlichen WCAG-2.2-Kriterien als 🟡 "zukunftssicher" mitprüfen. Wenn Websuche verfügbar ist, vorher kurz nachsehen, ob V4.1.1 inzwischen im Amtsblatt zitiert wurde.

## Pflichten des Anbieters (§ 14 BFSG)

1. Dienstleistung darf nur angeboten werden, wenn sie die Anforderungen erfüllt **und** die **Informationen nach Anlage 3** erstellt und der Allgemeinheit **barrierefrei zugänglich** gemacht wurden.
2. Informationen aufbewahren, solange die Dienstleistung angeboten wird.
3. Konformität dauerhaft sicherstellen, Änderungen berücksichtigen.
4. Bei Nichtkonformität: Korrekturmaßnahmen und **unverzügliche Meldung** an die Marktüberwachungsbehörde.
5. Auskunft auf begründetes Verlangen der Behörde.

## Anlage 3 — Pflichtinhalt der Barrierefreiheitsinformationen

In den **AGB oder auf andere deutlich wahrnehmbare Weise** (üblich: eigene Seite, im Footer verlinkt). Mindestens, soweit anwendbar:
- a) allgemeine Beschreibung der Dienstleistung **in barrierefreiem Format**
- b) Beschreibungen und Erläuterungen, die zum Verständnis der Durchführung der Dienstleistung erforderlich sind
- c) Beschreibung, wie die Dienstleistung die Barrierefreiheitsanforderungen der Verordnung erfüllt
- d) Angabe der **zuständigen Marktüberwachungsbehörde**

Harmonisierte Normen dürfen dafür ganz oder teilweise angewendet werden (Anlage 3 Nr. 2). Vorlage: `assets/barrierefreiheitsinformationen.md`.

**Zuständige Marktüberwachungsbehörde** in Deutschland: Marktüberwachungsstelle der Länder für die Barrierefreiheit von Produkten und Dienstleistungen (MLBF AöR), Sitz Magdeburg. Aktuelle Kontaktdaten vor Verwendung auf der Website der MLBF prüfen.

## Unverhältnismäßige Belastung (§ 17 BFSG)

Anforderungen gelten nur, soweit sie keine unverhältnismäßige Belastung nach Anlage 4 darstellen. Wer sich darauf beruft, muss die Beurteilung **selbst vornehmen, dokumentieren, 5 Jahre aufbewahren**, bei Dienstleistungen mind. alle 5 Jahre und bei jeder Änderung der Dienstleistung **wiederholen** und die Behörde **unverzüglich informieren** (Kleinstunternehmen von der Mitteilung ausgenommen). → Im Bericht nie als bequemen Ausweg anbieten; nur als Hinweis, dass es die Regel gibt und sie Aufwand bedeutet.

## Sanktionen (§ 37 BFSG)

- Dienstleistung entgegen § 14 Abs. 1 anbieten (nicht barrierefrei oder ohne Anlage-3-Informationen): Bußgeld **bis 100.000 €**
- Informations-/Auskunftspflichten verletzt (u. a. § 14 Abs. 4 Meldung, § 14 Abs. 5 Auskunft): **bis 10.000 €**
- Zusätzlich möglich: Abmahnungen durch Mitbewerber/Verbände über das UWG. Wie Gerichte das BFSG dabei einordnen, ist noch nicht höchstrichterlich geklärt → nur als Risiko erwähnen, nicht als sichere Folge.

## Formulierungsregeln für den Bericht

- Nie "rechtssicher", "BFSG-konform" oder "abmahnsicher" bescheinigen. Ein Code-Audit kann Konformität nicht nachweisen (manuelle Tests, Inhalte, Dokumente, Prozesse gehören dazu).
- Stattdessen: "Folgende technische Barrieren wurden gefunden" / "Keine der automatisch prüfbaren Kriterien verletzt — manuelle Prüfung erforderlich".
- Einmal am Anfang: "Technische Vorprüfung, keine Rechtsberatung."

## Quellen

- BFSG: https://www.gesetze-im-internet.de/bfsg/ (§§ 1, 2, 3, 14, 17, 37, 38, Anlage 3)
- BFSGV: https://www.gesetze-im-internet.de/bfsgv/ (§§ 12, 19)
- Bundesfachstelle Barrierefreiheit, FAQ elektronischer Geschäftsverkehr: https://www.bundesfachstelle-barrierefreiheit.de/DE/Barrierefreiheitsstaerkungsgesetz/FAQ-elektronischer-Geschaeftsverkehr/faq-elektronischer-Geschaeftsverkehr_node
- AccessibleEU zu EN 301 549 V4.1.1 (07.09.2026): https://accessible-eu-centre.ec.europa.eu/content-corner/news/european-accessibility-standard-en-301-549-has-been-updated-2026-09-07_en
