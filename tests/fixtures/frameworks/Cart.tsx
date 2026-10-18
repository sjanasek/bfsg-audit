export function Cart({ items }) {
  return (
    <section>
      <h2>Warenkorb</h2>
      <img src={items[0].img} alt={items[0].name} />
      <img src="/deko.png" />
      <div className="remove" onClick={() => remove()}>Entfernen</div>
      <label htmlFor="coupon">Gutschein</label>
      <input id="coupon" name="coupon" />
      <input name="email" type="email" />
      <button aria-label="Schließen"><svg aria-hidden="true" /></button>
      <a href="/kasse"><svg aria-label="Zur Kasse" /></a>
    </section>
  );
}
