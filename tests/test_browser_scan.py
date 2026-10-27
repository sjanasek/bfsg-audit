"""Tests für scripts/browser-scan.mjs (Prüfung im echten Browser).

Laufen nur, wenn Node und Playwright mit Chromium verfügbar sind; sonst werden
sie übersprungen. Die axe-core-Tests laufen zusätzlich nur, wenn axe-core
installiert ist (in der CI immer).

    python3 -m unittest tests.test_browser_scan -v
"""
import functools
import http.server
import json
import os
import shutil
import subprocess
import threading
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "skills", "bfsg-audit", "scripts", "browser-scan.mjs")
FIX = os.path.join(ROOT, "tests", "fixtures")
CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'"


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        if self.path.startswith("/browser/csp/"):
            self.send_header("Content-Security-Policy", CSP)
        super().end_headers()

    def log_message(self, *args):
        pass


def run(url, *args, env_extra=None):
    env = dict(os.environ, **(env_extra or {}))
    p = subprocess.run(["node", SCRIPT, url, "--max-pages", "0", "--json", *args],
                       capture_output=True, text=True, timeout=180, env=env)
    data = json.loads(p.stdout) if p.stdout.strip().startswith("{") else None
    return p.returncode, data, p.stderr


def ids(data):
    return {f["id"]: f for f in data["findings"]}


@functools.lru_cache(maxsize=1)
def environment():
    """(verfügbar, Grund) — prüft Node, Playwright und Chromium mit einem Probelauf."""
    if not shutil.which("node"):
        return False, "node nicht installiert"
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Handler, directory=FIX))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        code, data, err = run(f"http://127.0.0.1:{srv.server_address[1]}/browser/trap/index.html", "--no-axe")
    finally:
        srv.shutdown()
        srv.server_close()
    if code == 3 or data is None:
        return False, err.strip().splitlines()[0] if err.strip() else "Playwright/Chromium nicht verfügbar"
    return True, ""


class BrowserScanBase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        ok, why = environment()
        if not ok:
            raise unittest.SkipTest(why)
        cls.srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Handler, directory=FIX))
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.srv.server_address[1]}"

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, "srv"):
            cls.srv.shutdown()
            cls.srv.server_close()


class EingebauteRegeln(BrowserScanBase):
    """Ohne axe-core: eingebaute Regeln auf der fertig aufgebauten Seite."""

    def test_js_gerenderte_seite(self):
        code, data, _ = run(f"{self.base}/browser/js-shop/index.html", "--no-axe")
        self.assertEqual(code, 0)
        f = ids(data)
        for rid in ("placeholder-label", "button-name", "image-alt", "color-contrast", "focus-not-visible"):
            self.assertIn(rid, f, rid)
        self.assertNotIn("label", f)  # Platzhalter vorhanden -> eigene Regel statt "kein Name"
        self.assertEqual(f["button-name"]["severity"], "kritisch")
        self.assertIn("2.61:1", " ".join(f["color-contrast"]["locations"]))
        self.assertIn("buy", " ".join(f["focus-not-visible"]["locations"]))

    def test_statischer_scan_sieht_das_nicht(self):
        # Gegenprobe: scan.py findet auf derselben Seite kein fehlendes Label.
        p = subprocess.run(["python3", os.path.join(ROOT, "skills", "bfsg-audit", "scripts", "scan.py"),
                            os.path.join(FIX, "browser", "js-shop"), "--json"], capture_output=True, text=True)
        static = {f["id"] for f in json.loads(p.stdout)["findings"]}
        self.assertNotIn("input-label", static)
        self.assertNotIn("img-alt", static)

    def test_tastaturfalle(self):
        _, data, _ = run(f"{self.base}/browser/trap/index.html", "--no-axe")
        self.assertEqual(ids(data)["keyboard-trap"]["severity"], "kritisch")

    def test_reparierte_seite_ohne_befunde(self):
        _, data, _ = run(f"{self.base}/shop-repariert/index.html", "--no-axe")
        schwer = [k for k, v in ids(data).items() if v["severity"] in ("kritisch", "wichtig")]
        self.assertEqual(schwer, [], schwer)

    def test_fail_on(self):
        code, _, _ = run(f"{self.base}/browser/js-shop/index.html", "--no-axe", "--fail-on", "kritisch")
        self.assertEqual(code, 1)
        code, _, _ = run(f"{self.base}/shop-repariert/index.html", "--no-axe", "--fail-on", "wichtig")
        self.assertEqual(code, 0)

    def test_unterseiten(self):
        p = subprocess.run(["node", SCRIPT, f"{self.base}/shop-schlecht/index.html", "--max-pages", "2", "--json", "--no-axe"],
                           capture_output=True, text=True, timeout=180)
        data = json.loads(p.stdout)
        self.assertGreaterEqual(len(data["pages"]) + len(data["errors"]), 2)


class MitAxe(BrowserScanBase):
    """Mit axe-core — läuft in der CI, lokal nur wenn axe-core installiert ist."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        _, data, _ = run(f"{cls.base}/browser/trap/index.html")
        if not data or not data["engine"].startswith("axe-core"):
            cls.tearDownClass()
            raise unittest.SkipTest("axe-core nicht installiert")

    def test_js_gerenderte_seite(self):
        _, data, _ = run(f"{self.base}/browser/js-shop/index.html")
        f = ids(data)
        for rid in ("axe:button-name", "axe:image-alt", "axe:color-contrast", "placeholder-label", "focus-not-visible"):
            self.assertIn(rid, f, rid)
        self.assertEqual(f["axe:button-name"]["severity"], "kritisch")

    def test_deutsche_texte(self):
        _, data, _ = run(f"{self.base}/browser/js-shop/index.html")
        self.assertIn("Farbkontrast", ids(data)["axe:color-contrast"]["title"])

    def test_strenge_csp(self):
        # Seite verbietet fremde Skripte; axe muss trotzdem laufen.
        _, data, _ = run(f"{self.base}/browser/csp/index.html")
        self.assertTrue(data["engine"].startswith("axe-core"))
        self.assertIn("axe:image-alt", ids(data))

    def test_reparierte_seite_ohne_kritische(self):
        _, data, _ = run(f"{self.base}/shop-repariert/index.html")
        kritisch = [k for k, v in ids(data).items() if v["severity"] == "kritisch"]
        self.assertEqual(kritisch, [], kritisch)


class Zustaende(BrowserScanBase):
    """--states: Zustände durchklicken und einzeln prüfen."""

    STATES = os.path.join(FIX, "browser", "states", "zustaende.json")

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        _, cls.data, _ = run(f"{cls.base}/browser/states/", "--no-axe", "--states", cls.STATES)

    def state(self, name):
        return next(st for st in self.data["states"] if st["name"] == name)

    def test_status_je_zustand(self):
        self.assertEqual(self.state("Produktseite geladen")["status"], "geprüft")
        self.assertEqual(self.state("Größentabelle geöffnet")["status"], "geprüft")
        self.assertEqual(self.state("Newsletter: Validierungsfehler")["status"], "geprüft")
        self.assertEqual(self.state("Warenkorb leer")["status"], "geprüft")
        self.assertEqual(self.state("Gutschein eingelöst")["status"], "fehlgeschlagen")
        self.assertIn("Schritt 1", self.state("Gutschein eingelöst")["note"])
        self.assertEqual(self.state("Bestellabschluss")["status"], "manuell offen")

    def test_dialogfehler_nur_im_dialog_zustand(self):
        f = ids(self.data)
        for rid in ("label", "button-name"):
            locs = f[rid]["locations"]
            self.assertTrue(all(l.startswith("[Größentabelle geöffnet]") for l in locs), locs)
        self.assertEqual(self.state("Produktseite geladen")["counts"]["kritisch"], 0)
        self.assertEqual(self.state("Größentabelle geöffnet")["counts"]["kritisch"], 2)

    def test_fehlermeldung_erst_nach_absenden(self):
        locs = " ".join(ids(self.data)["color-contrast"]["locations"])
        self.assertIn("[Newsletter: Validierungsfehler]", locs)
        self.assertIn("#fehler", locs)
        self.assertIn("[Warenkorb leer]", locs)

    def test_bericht_listet_zustaende(self):
        p = subprocess.run(["node", SCRIPT, f"{self.base}/browser/states/", "--states", self.STATES, "--no-axe"],
                           capture_output=True, text=True, timeout=180)
        self.assertIn("## Geprüfte Zustände", p.stdout)
        self.assertIn("👤 manuell offen", p.stdout)
        self.assertIn("alle Zustände, die nicht in der Zustandsdatei stehen", p.stdout)

    def test_ohne_zustandsdatei_standardliste(self):
        p = subprocess.run(["node", SCRIPT, f"{self.base}/browser/js-shop/index.html", "--max-pages", "0", "--no-axe"],
                           capture_output=True, text=True, timeout=180)
        self.assertIn("Nach dem Laden", p.stdout)
        self.assertIn("Validierungsfehler in Formularen", p.stdout)

    def test_ungueltige_zustandsdatei(self):
        bad = os.path.join(FIX, "browser", "states", "kaputt.json.tmp")
        with open(bad, "w") as fh:
            fh.write('{"states": [{"name": "X", "url": "a.html", "steps": [{"tanzen": "#x"}]}]}')
        try:
            p = subprocess.run(["node", SCRIPT, f"{self.base}/", "--states", bad], capture_output=True, text=True, timeout=60)
            self.assertEqual(p.returncode, 2)
            self.assertIn("unbekannter Schritt", p.stderr)
        finally:
            os.remove(bad)


class ZustaendeMitAxe(Zustaende):
    """Gleiche Zustände mit axe-core (läuft in der CI)."""

    @classmethod
    def setUpClass(cls):
        BrowserScanBase.setUpClass.__func__(cls)
        _, cls.data, _ = run(f"{cls.base}/browser/states/", "--states", cls.STATES)
        if not cls.data or not cls.data["engine"].startswith("axe-core"):
            cls.tearDownClass()
            raise unittest.SkipTest("axe-core nicht installiert")

    def test_dialogfehler_nur_im_dialog_zustand(self):
        f = ids(self.data)
        locs = f["axe:button-name"]["locations"]
        self.assertTrue(all(l.startswith("[Größentabelle geöffnet]") for l in locs), locs)
        self.assertGreater(self.state("Größentabelle geöffnet")["counts"]["kritisch"], 0)

    def test_fehlermeldung_erst_nach_absenden(self):
        locs = " ".join(ids(self.data)["axe:color-contrast"]["locations"])
        self.assertIn("[Newsletter: Validierungsfehler]", locs)
        self.assertIn("[Warenkorb leer]", locs)


if __name__ == "__main__":
    unittest.main()
