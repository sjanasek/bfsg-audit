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
