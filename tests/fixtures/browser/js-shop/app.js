// Inhalt entsteht erst im Browser – ein statischer Scan sieht davon nichts.
document.getElementById('app').innerHTML = `
  <main>
    <h1>Kaffeebohnen</h1>
    <p class="hint">Versandkostenfrei ab 30 €</p>
    <img src="bohnen.jpg" width="120" height="80">
    <form>
      <input type="email" name="email" placeholder="E-Mail">
      <button type="button" class="icon"><svg width="16" height="16" aria-hidden="true"></svg></button>
      <button type="button" class="buy">In den Warenkorb</button>
    </form>
    <a href="/kontakt">Kontakt</a>
  </main>`;
