# Fix-Muster

Bewährte, framework-neutrale Lösungen. Beim Umsetzen an das Projekt anpassen (React/Vue/Svelte-Syntax, vorhandene CSS-Variablen, Komponentenbibliothek). Native HTML-Elemente schlagen ARIA — erst wenn es kein natives Element gibt, ARIA nach den WAI-ARIA Authoring Practices verwenden.

## Inhaltsverzeichnis
- Sprache, Titel, Skip-Link, Landmarks
- Sichtbarer Fokus
- Klickbare div → Button
- Icon-Buttons
- Formularfelder: Label, Pflicht, Fehler, autocomplete
- Passwortfeld (3.3.8)
- Dialog / Modal
- Statusmeldungen (aria-live)
- Akkordeon / Menü-Toggle
- Cookie-Banner barrierefrei
- Zoom freigeben, Zielgröße, Fokus nicht verdeckt
- Bewegung reduzieren
- iframes (Video, Karte, Payment)
- SPA: Titel und Fokus bei Routenwechsel

---

### Sprache, Titel, Skip-Link, Landmarks

```html
<html lang="de">
<head><title>Warenkorb – Musterladen</title></head>
<body>
  <a class="skip-link" href="#inhalt">Zum Inhalt springen</a>
  <header>…</header>
  <nav aria-label="Hauptnavigation">…</nav>
  <main id="inhalt" tabindex="-1">…</main>
  <footer>…</footer>
</body>
```
```css
.skip-link { position: absolute; left: -9999px; }
.skip-link:focus { left: 1rem; top: 1rem; z-index: 1000; padding: .5rem 1rem; background: #fff; color: #000; }
```

### Sichtbarer Fokus (2.4.7, 1.4.11)

`outline: none` ersatzlos entfernen ist der häufigste Einzelfehler. Stattdessen:
```css
:focus { outline: none; }                     /* nur zusammen mit der nächsten Regel! */
:focus-visible { outline: 3px solid #1a56db; outline-offset: 2px; }
```
Fokusfarbe muss ≥ 3:1 gegen den Hintergrund haben.

### Klickbare div → Button (2.1.1, 4.1.2)

```html
<!-- vorher -->
<div class="add" onclick="addToCart()">In den Warenkorb</div>
<!-- nachher -->
<button type="button" class="add" onclick="addToCart()">In den Warenkorb</button>
```
Navigation zu anderer Seite → `<a href="…">`, Aktion auf der Seite → `<button>`. Styling mit `all: unset` zurücksetzen, aber danach `:focus-visible` wieder setzen.

### Icon-Buttons (4.1.2, 1.1.1)

```html
<button type="button" aria-label="Menü öffnen" aria-expanded="false" aria-controls="menu">
  <svg aria-hidden="true" focusable="false">…</svg>
</button>

<!-- Mengenauswahl -->
<button type="button" aria-label="Menge von Kaffeebohnen verringern">−</button>
<input type="number" id="qty-1" value="1" min="1" aria-label="Menge Kaffeebohnen">
<button type="button" aria-label="Menge von Kaffeebohnen erhöhen">+</button>
```

### Formularfelder (1.3.1, 1.3.5, 3.3.1, 3.3.2)

```html
<label for="email">E-Mail-Adresse <span aria-hidden="true">*</span></label>
<input id="email" name="email" type="email" autocomplete="email" required
       aria-describedby="email-hinweis email-fehler" aria-invalid="false">
<p id="email-hinweis" class="hint">Für die Bestellbestätigung.</p>
<p id="email-fehler" class="error" hidden>Bitte eine gültige E-Mail-Adresse eingeben, z. B. name@example.de.</p>
```
```js
function zeigeFehler(input, fehlerEl, text) {
  input.setAttribute('aria-invalid', 'true');
  fehlerEl.textContent = text;
  fehlerEl.hidden = false;
}
// Bei Absenden mit Fehlern: Fokus auf erstes fehlerhaftes Feld oder auf eine Fehlerzusammenfassung.
```
Häufige `autocomplete`-Werte: `given-name`, `family-name`, `email`, `tel`, `street-address`, `postal-code`, `address-level2` (Ort), `country`, `cc-name`, `cc-number`, `cc-exp`, `cc-csc`, `username`, `current-password`, `new-password`, `one-time-code`.

Pflichtfeld-Hinweis einmal oberhalb des Formulars als Text: "Felder mit * sind Pflichtfelder."

### Passwortfeld (3.3.8 [2.2])

```html
<label for="pw">Passwort</label>
<input id="pw" type="password" autocomplete="current-password">
<button type="button" aria-controls="pw" aria-pressed="false" id="pw-toggle">Passwort anzeigen</button>
```
Nicht verwenden: `onpaste="return false"`, `e.preventDefault()` im paste-Handler, `autocomplete="off"` am Passwort. Das blockiert Passwortmanager.

### Dialog / Modal (2.1.2, 2.4.3)

Natives `<dialog>` übernimmt Fokus-Trap und Esc:
```html
<dialog id="groessen" aria-labelledby="groessen-titel">
  <h2 id="groessen-titel">Größentabelle</h2>
  …
  <button type="button" onclick="this.closest('dialog').close()">Schließen</button>
</dialog>
<button type="button" onclick="document.getElementById('groessen').showModal()">Größentabelle öffnen</button>
```
Nach dem Schließen den Fokus auf den auslösenden Button zurücksetzen (bei `showModal()` macht das der Browser in aktuellen Versionen; bei Eigenbau manuell).

### Statusmeldungen (4.1.3)

```html
<div role="status" class="visually-hidden" id="live"></div>
```
```js
document.getElementById('live').textContent = 'Kaffeebohnen wurden in den Warenkorb gelegt. 3 Artikel im Warenkorb.';
```
```css
.visually-hidden { position:absolute; width:1px; height:1px; margin:-1px; padding:0; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0; }
```
Für dringende Fehler `role="alert"`. Das Element muss beim Laden schon im DOM sein — erst danach Text einsetzen.

### Akkordeon / Menü-Toggle (4.1.2)

```html
<h3><button type="button" aria-expanded="false" aria-controls="faq-1">Wie lange dauert der Versand?</button></h3>
<div id="faq-1" hidden>…</div>
```
```js
btn.addEventListener('click', () => {
  const offen = btn.getAttribute('aria-expanded') === 'true';
  btn.setAttribute('aria-expanded', String(!offen));
  document.getElementById(btn.getAttribute('aria-controls')).hidden = offen;
});
```
Alternative ohne JS: `<details><summary>…</summary>…</details>`.

### Cookie-Banner barrierefrei

- Als `<dialog>` bzw. `role="dialog"` mit `aria-labelledby`; beim Erscheinen Fokus auf die Überschrift oder ersten Button.
- "Ablehnen" und "Akzeptieren" als echte `<button>` mit gleichem Kontrast.
- Darf Fokus auf der Seite nicht verdecken (2.4.11) → als Modal (blockierend, fokussiert) oder Seite mit `padding-bottom` in Bannerhöhe.
- Link "Cookie-Einstellungen" im Footer als `<button>` (öffnet Dialog).

### Zoom, Zielgröße, Fokus nicht verdeckt

```html
<meta name="viewport" content="width=device-width, initial-scale=1">  <!-- kein user-scalable=no, kein maximum-scale=1 -->
```
```css
button, a.icon, input[type=checkbox], input[type=radio] { min-width: 24px; min-height: 24px; } /* 2.5.8 */
html { scroll-padding-top: 5rem; }  /* Höhe des Sticky-Headers, 2.4.11 */
```

### Bewegung reduzieren

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
}
```
Karussell: kein Autoplay oder sichtbarer Pause-Button als erstes Element.

### iframes

```html
<iframe src="…" title="Video: So pflegen Sie Ihre Kaffeemühle"></iframe>
<iframe src="…" title="Zahlungsformular (Kreditkarte)"></iframe>
```

### SPA: Titel und Fokus bei Routenwechsel (2.4.2, 2.4.3)

```js
// nach jedem Routenwechsel
document.title = `${seitenTitel} – Musterladen`;
const main = document.querySelector('main');
main.setAttribute('tabindex', '-1');
main.focus({ preventScroll: false });
```
Next.js App Router: `export const metadata = { title: … }` je Route; Vue Router: `router.afterEach`; SvelteKit: `<svelte:head>`.
