"""Regressionstests für scripts/scan.py. Ausführen: python3 -m unittest discover tests"""
import json
import os
import subprocess
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCAN = os.path.join(ROOT, "skills", "bfsg-audit", "scripts", "scan.py")
FIX = os.path.join(ROOT, "tests", "fixtures")


def run(target):
    out = subprocess.run([sys.executable, SCAN, os.path.join(FIX, target), "--json"],
                         capture_output=True, text=True, check=True).stdout
    data = json.loads(out)
    return {f["id"]: f for f in data["findings"]}, data["facts"]


class SchlechterShop(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.f, cls.facts = run("shop-schlecht")

    def test_kritische_befunde(self):
        for rid in ("click-div", "empty-button", "input-label", "zoom-blocked", "keine-bf-info"):
            self.assertIn(rid, self.f)
            self.assertEqual(self.f[rid]["severity"], "kritisch", rid)

    def test_wichtige_befunde(self):
        for rid in ("img-alt", "html-lang", "iframe-title", "autoplay", "outline-none", "paste-blocked",
                    "pw-autocomplete-off", "tabindex-positive", "auto-submit", "autocomplete", "empty-link"):
            self.assertIn(rid, self.f)

    def test_unverknuepftes_label_wird_erkannt(self):
        locs = " ".join(self.f["input-label"]["locations"])
        self.assertIn("plz", locs)

    def test_ecommerce_indiz(self):
        self.assertIn("hinweis-ecommerce", self.f)
        self.assertFalse(self.facts["bf_info"])


class GuterShop(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.f, cls.facts = run("shop-gut")

    def test_keine_kritischen_oder_wichtigen(self):
        schwer = [k for k, v in self.f.items() if v["severity"] in ("kritisch", "wichtig")]
        self.assertEqual(schwer, [], schwer)

    def test_focus_visible_entschaerft_outline(self):
        self.assertEqual(self.f["outline-none"]["severity"], "empfehlung")

    def test_bf_info_gefunden(self):
        self.assertTrue(self.facts["bf_info"])
        self.assertNotIn("keine-bf-info", self.f)


class Frameworks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.f, _ = run("frameworks")

    def test_jsx_und_vue_click_handler(self):
        locs = " ".join(self.f["click-div"]["locations"])
        self.assertIn("Cart.tsx", locs)
        self.assertIn("Menu.vue", locs)

    def test_jsx_alt_ausdruck_zaehlt(self):
        locs = self.f["img-alt"]["locations"]
        self.assertEqual(len(locs), 1, locs)  # nur /deko.png, nicht alt={…}

    def test_htmlfor_verknuepft(self):
        locs = " ".join(self.f["input-label"]["locations"])
        self.assertNotIn("coupon", locs)
        self.assertIn("email", locs)

    def test_namen_ueber_aria_label(self):
        self.assertNotIn("empty-button", self.f)   # aria-label / :aria-label
        self.assertNotIn("empty-link", self.f)     # svg aria-label im Link


if __name__ == "__main__":
    unittest.main()
