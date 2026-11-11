// Newsletter: Prüfung per Skript (novalidate), Fehlermeldung wird eingefügt
document.querySelectorAll('form.newsletter').forEach(form => {
  form.addEventListener('submit', e => {
    const input = form.querySelector('input');
    if (!input.value.includes('@')) {
      e.preventDefault();
      let msg = form.querySelector('.fehler');
      if (!msg) { msg = document.createElement('p'); msg.className = 'fehler'; form.appendChild(msg); }
      msg.textContent = 'Bitte eine gültige E-Mail-Adresse eingeben.';
    }
  });
});
document.querySelectorAll('form.gutschein').forEach(form => {
  form.addEventListener('submit', e => {
    if (!form.querySelector('input').value.trim()) { e.preventDefault(); alert('Bitte Gutscheincode eingeben'); }
  });
});
// Anmelden: Fehler nur durch roten Rahmen
document.querySelectorAll('form.nur-farbe').forEach(form => {
  form.addEventListener('submit', e => {
    const input = form.querySelector('input');
    if (!input.value.trim()) { e.preventDefault(); input.classList.add('ungueltig'); }
  });
});
// Rabattcode: verhindert das Absenden, zeigt aber nichts an
document.querySelectorAll('form.stumm').forEach(form => {
  form.addEventListener('submit', e => {
    const input = form.querySelector('input');
    if (!input.value.trim()) { e.preventDefault(); input.setAttribute('aria-invalid', 'true'); }
  });
});
// Profil: Fehlertext, aber alle Eingaben werden gelöscht
document.querySelectorAll('form.vergesslich').forEach(form => {
  form.addEventListener('submit', e => {
    const name = form.querySelector('#pname'), mail = form.querySelector('#pmail');
    if (!name.value.trim() || !mail.value.includes('@')) {
      e.preventDefault();
      form.reset();
      let msg = form.querySelector('.fehler');
      if (!msg) { msg = document.createElement('p'); msg.className = 'fehler'; form.prepend(msg); }
      msg.textContent = 'Bitte Eingaben prüfen.';
    }
  });
});
// Laufschrift: verändert die Seite ständig (darf nicht als Reaktion zählen)
const ticker = document.getElementById('ticker');
if (ticker) setInterval(() => { ticker.dataset.pos = String((+ticker.dataset.pos || 0) + 1); }, 100);
