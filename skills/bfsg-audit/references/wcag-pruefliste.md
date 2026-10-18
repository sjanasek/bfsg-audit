# Prüfliste WCAG 2.1 AA (+ 2.2) für Websites

Maßstab: WCAG 2.1 Level AA (De-facto-Referenz über EN 301 549 V3.2.1). Kriterien, die erst mit WCAG 2.2 dazukommen, sind mit **[2.2]** markiert → 🟡 Empfehlung, solange keine Norm mit WCAG 2.2 zum EAA im Amtsblatt zitiert ist (siehe `rechtsrahmen.md`).

Legende: ⚙️ = findet `scripts/scan.py` statisch · 🧪 = findet ein Runtime-Tool (axe-core) · 👤 = nur manuell prüfbar

Fix-Code zu den häufigsten Punkten: `fix-muster.md`.

## Inhaltsverzeichnis
1. Wahrnehmbar (1.x)
2. Bedienbar (2.x)
3. Verständlich (3.x)
4. Robust (4.x)
5. Brennpunkte nach § 19 BFSGV: Login, Captcha, Checkout, Zahlung
6. Typische Komponenten, die fast immer Probleme machen

---

## 1. Wahrnehmbar

| SC | Was prüfen | Wie | Typischer Fix |
|---|---|---|---|
| 1.1.1 Nicht-Text-Inhalt (A) | Jedes `<img>` hat `alt`; Inhaltsbilder beschreibend, dekorative `alt=""`; Icon-Buttons/SVGs mit Namen; Captcha mit Alternative | ⚙️🧪👤 (Qualität der Texte nur manuell) | `alt` ergänzen, SVG `aria-hidden="true"` wenn dekorativ |
| 1.2.2 Untertitel (A) / 1.2.5 Audiodeskription (AA) | Videos mit Ton haben Untertitel; wichtige visuelle Infos beschrieben | 👤 | `<track kind="captions">`, Untertitel im Player aktivieren |
| 1.3.1 Info und Beziehungen (A) | Überschriften als `<h1>`–`<h6>`, Listen als `<ul>/<ol>`, Tabellen mit `<th>`, Formularfelder mit `<label>`, Landmarks | ⚙️🧪 | semantisches HTML statt `<div class="h2">` |
| 1.3.2 Bedeutungstragende Reihenfolge (A) | DOM-Reihenfolge = visuelle Reihenfolge (CSS `order`, absolute Positionierung) | 👤 | DOM umsortieren |
| 1.3.4 Ausrichtung (AA) | Kein Sperren auf Hoch-/Querformat | ⚙️ (CSS/Manifest `orientation`) | Sperre entfernen |
| 1.3.5 Zweck von Eingaben (AA) | `autocomplete` bei Name, E-Mail, Telefon, Adresse, Zahlungsdaten | ⚙️ | `autocomplete="email"` usw. |
| 1.4.1 Farbe (A) | Info nicht nur über Farbe (Pflichtfelder rot, Links nur farbig) | 👤 | Text/Icon zusätzlich, Links unterstreichen |
| 1.4.2 Audio-Steuerung (A) | Kein Autoplay mit Ton > 3 s ohne Stopp | ⚙️ | `autoplay` entfernen oder `muted` |
| 1.4.3 Kontrast (AA) | Text ≥ 4,5:1, großer Text (≥ 18 pt bzw. ≥ 14 pt fett, ≈ 24 px / 18,67 px) ≥ 3:1 | 🧪 | Farben anpassen; Platzhaltertext beachten |
| 1.4.4 Textgröße (AA) | 200 % Zoom ohne Verlust; Zoom nicht gesperrt | ⚙️👤 | `user-scalable=no` / `maximum-scale=1` entfernen; `rem` statt `px` für Schrift |
| 1.4.5 Bilder von Text (AA) | Kein Text als Bild (außer Logo) | 👤 | echten Text verwenden |
| 1.4.10 Reflow (AA) | Bei 320 CSS-px Breite kein horizontales Scrollen | 👤 (Browser auf 320px / 400 % Zoom) | responsive Layout, `overflow-wrap` |
| 1.4.11 Nicht-Text-Kontrast (AA) | Rahmen von Eingabefeldern, Fokus-Indikator, Icons ≥ 3:1 | 🧪👤 | Rahmenfarbe dunkler |
| 1.4.12 Textabstand (AA) | Kein Abschneiden bei erhöhtem Zeilen-/Buchstabenabstand | 👤 | keine festen Höhen für Textcontainer |
| 1.4.13 Inhalt bei Hover/Fokus (AA) | Tooltips/Popover schließbar (Esc), überfahrbar, bleiben stehen | 👤 | Esc-Handler, kein Verschwinden bei Mauswechsel |

## 2. Bedienbar

| SC | Was prüfen | Wie | Typischer Fix |
|---|---|---|---|
| 2.1.1 Tastatur (A) | Alles per Tastatur bedienbar; keine klickbaren `div`/`span` ohne Rolle und Tastatur-Handler | ⚙️👤 | `<button>`/`<a href>` verwenden |
| 2.1.2 Keine Tastaturfalle (A) | Modals, Cookie-Banner, eingebettete Player: Fokus kommt wieder raus | 👤 | Fokus-Management, Esc schließt |
| 2.2.1 Zeitbegrenzung (A) | Session-Timeouts im Checkout verlängerbar | 👤 | Warnung + "Zeit verlängern" |
| 2.2.2 Pausieren (A) | Karussells/Animationen > 5 s pausierbar | ⚙️ (Autoplay-Slider-Libs) 👤 | Pause-Button, kein Auto-Rotate |
| 2.3.1 Blitzen (A) | Nichts blitzt > 3×/s | 👤 | — |
| 2.4.1 Bereiche überspringen (A) | Skip-Link oder Landmarks | ⚙️ | Skip-Link "Zum Inhalt springen" |
| 2.4.2 Seitentitel (A) | Aussagekräftiger `<title>` je Seite/Route (SPA: Titel bei Routenwechsel aktualisieren) | ⚙️ | `document.title` / Framework-Head |
| 2.4.3 Fokus-Reihenfolge (A) | Logisch; kein `tabindex` > 0 | ⚙️👤 | positive `tabindex` entfernen |
| 2.4.4 Linkzweck (A) | Linktext verständlich ("hier", "mehr" vermeiden) | ⚙️ | Ziel im Linktext nennen |
| 2.4.6 Überschriften und Labels (AA) | beschreibend | 👤 | — |
| 2.4.7 Fokus sichtbar (AA) | Kein `outline: none` ohne Ersatz | ⚙️👤 | `:focus-visible` mit deutlichem Rahmen |
| 2.4.11 Fokus nicht verdeckt [2.2] (AA) | Fokussiertes Element nicht komplett unter Sticky-Header/Cookie-Banner | 👤 | `scroll-padding-top` |
| 2.5.3 Label im Namen (A) | Sichtbarer Text ist im zugänglichen Namen enthalten (aria-label ≠ sichtbarer Text) | ⚙️ (teilweise) | `aria-label` entfernen oder angleichen |
| 2.5.7 Ziehbewegungen [2.2] (AA) | Drag-&-Drop (Slider, Sortierung) auch ohne Ziehen bedienbar | 👤 | Buttons als Alternative |
| 2.5.8 Zielgröße [2.2] (AA) | Klickziele ≥ 24×24 CSS-px (oder genug Abstand) | 🧪👤 | `min-width/min-height: 24px` |

## 3. Verständlich

| SC | Was prüfen | Wie | Typischer Fix |
|---|---|---|---|
| 3.1.1 Sprache der Seite (A) | `<html lang="de">` | ⚙️ | Attribut setzen |
| 3.1.2 Sprache von Teilen (AA) | Fremdsprachige Abschnitte mit `lang` | 👤 | `<span lang="en">` |
| 3.2.1/3.2.2 Bei Fokus/Eingabe (A) | Keine unerwarteten Kontextwechsel (Auto-Submit bei `<select>`-Änderung) | ⚙️ (`onchange="this.form.submit()"`) 👤 | expliziter Button |
| 3.2.3/3.2.4 Konsistente Navigation/Erkennung (AA) | Navigation und Komponenten seitenübergreifend gleich | 👤 | — |
| 3.2.6 Konsistente Hilfe [2.2] (A) | Kontakt/Hilfe an gleicher Stelle auf allen Seiten | 👤 | Footer-Link |
| 3.3.1 Fehlererkennung (A) | Fehler als Text, beim Feld, programmatisch verknüpft | ⚙️ (teilweise) 👤 | `aria-describedby`, `aria-invalid` |
| 3.3.2 Beschriftungen (A) | Jedes Feld hat sichtbares Label; Pflichtfelder gekennzeichnet | ⚙️ | `<label>`, `required` |
| 3.3.3 Fehlerkorrektur (AA) | Korrekturvorschlag ("Bitte gültige PLZ mit 5 Ziffern") | 👤 | — |
| 3.3.4 Fehlervermeidung (AA) | **Bestellung**: Prüfen, korrigieren oder stornieren vor Abschluss möglich | 👤 | Bestellübersicht vor "zahlungspflichtig bestellen" |
| 3.3.7 Redundante Eingabe [2.2] (A) | Bereits eingegebene Daten nicht erneut verlangen (Rechnungs-/Lieferadresse) | 👤 | "Lieferadresse = Rechnungsadresse" |
| 3.3.8 Barrierefreie Authentifizierung [2.2] (AA) | Login ohne kognitiven Funktionstest (Rätsel, Rechenaufgabe, Passwort abtippen ohne Hilfsmittel) — Objekterkennung ist auf AA ausgenommen; Einfügen in Passwortfelder erlaubt, Passwortmanager funktionieren | ⚙️ (paste-Blocker, `autocomplete="off"` an Passwort) 👤 | paste erlauben, `autocomplete="current-password"`, Captcha-Alternative |

## 4. Robust

| SC | Was prüfen | Wie | Typischer Fix |
|---|---|---|---|
| 4.1.2 Name, Rolle, Wert (A) | Custom-Komponenten (Dropdown, Tabs, Akkordeon, Toggle) haben Rolle, Namen, Zustand (`aria-expanded`, `aria-selected`, `aria-checked`); Buttons/iframes haben Namen | ⚙️🧪 | native Elemente oder ARIA Authoring Practices |
| 4.1.3 Statusmeldungen (AA) | "In den Warenkorb gelegt", Fehleranzahl, Suchergebnisse → per `aria-live` angesagt | ⚙️ (Hinweis, wenn kein aria-live/role=status im Projekt) 👤 | `role="status"` |

## 5. Brennpunkte nach § 19 BFSGV

§ 19 BFSGV nennt Identifizierungs-, Authentifizierungs-, Sicherheits- und Zahlungsfunktionen. Daraus folgt (eigene Ableitung, nicht Wortlaut): Login, Captcha, Checkout und Zahlung zuerst und am gründlichsten prüfen:

- **Login/Registrierung**: Labels, Fehlermeldungen, Passwort-Einfügen erlaubt (3.3.8), sichtbarer Fokus, "Passwort anzeigen"-Button mit Namen und Zustand.
- **Captcha**: Ein Captcha ohne Alternative in einer anderen Sinnesmodalität (z. B. nur Bild, kein Audio) verletzt 1.1.1. Rätsel- und Rechenaufgaben verletzen zusätzlich 3.3.8 [2.2]. Objekterkennung ("wähle alle Ampeln") ist von 3.3.8 auf Stufe AA ausgenommen — erst 3.3.9 (AAA) schließt sie aus. Besser: unsichtbare Verfahren, Honeypot, Rate-Limit — Datenschutz der Alternative mitdenken.
- **Checkout**: Schritte als Überschriften, Fortschritt als Text, Fehler je Feld, `autocomplete` für Adresse/Zahlung, Bestellübersicht vor Abschluss (3.3.4), Session-Timeout (2.2.1).
- **Zahlungs-Widgets** (Stripe Elements, PayPal-Buttons, Klarna, Mollie): Sind iframes betitelt? Per Tastatur erreichbar? Eigene Wrapper um Fremd-Widgets prüfen. Barrieren im Widget selbst → beim Anbieter melden und im Bericht als ❓ "Drittanbieter-Komponente, Barrierefreiheitsangaben des Anbieters anfordern" führen (§ 1 Abs. 4 Nr. 4 BFSG greift nur, wenn der Betreiber den Inhalt weder finanziert, entwickelt noch kontrolliert — beim selbst eingebundenen Checkout regelmäßig nicht).
- **Rechtliche Seiten** (AGB, Widerruf, Datenschutz, Barrierefreiheitsinfos): selbst barrierefrei — und nicht als PDF ohne Tags.

## 6. Komponenten, die fast immer Probleme machen

| Komponente | Häufiger Fehler |
|---|---|
| Cookie-/Consent-Banner | Fokus landet nicht im Banner; per Tastatur nicht schließbar; geringer Kontrast der "Ablehnen"-Schaltfläche; verdeckt fokussierte Elemente (2.4.11) |
| Mega-Menü / Burger-Menü | `<div onclick>`, kein `aria-expanded`, Fokus bleibt hinter geschlossenem Menü |
| Modal / Dialog | Kein Fokus-Trap, Esc schließt nicht, Fokus kehrt nicht zurück → `<dialog>` nutzen |
| Slider / Karussell | Autoplay ohne Pause, Pfeile ohne Namen |
| Custom Select / Combobox | Nicht per Pfeiltasten bedienbar → natives `<select>` oder ARIA-Pattern |
| Akkordeon / FAQ | Kein `<button>` mit `aria-expanded` |
| Toast / Snackbar | Nicht angesagt (kein `aria-live`), verschwindet zu schnell |
| Produkt-Varianten (Farb-Kacheln) | Nur Farbe, kein Text; nicht per Tastatur wählbar |
| Mengenauswahl +/- | Buttons ohne Namen ("+" wird als "plus" vorgelesen, ohne Kontext) |
| Accessibility-Overlay (accessiBe, UserWay …) | Behebt keine Ursachen, stört Screenreader teils — kein Nachweis von Konformität |
