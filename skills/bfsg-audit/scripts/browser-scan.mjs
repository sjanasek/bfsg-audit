#!/usr/bin/env node
// BFSG-Audit — Prüfung im echten Browser (Ergänzung zu scan.py).
//
// Öffnet Seiten in Chromium (Playwright), wartet, bis JavaScript den Inhalt
// aufgebaut hat, und prüft dann:
//   • mit axe-core, falls installiert (empfohlen) — sonst mit eingebauten Regeln
//     (Kontrast, Alternativtexte, Beschriftungen, Namen, Sprache, Titel …)
//   • immer: einen Tastatur-Durchlauf (sichtbarer Fokus, Tastaturfallen)
//
// Aufruf:
//   node browser-scan.mjs <url> [weitere URLs] [--max-pages N] [--json]
//                         [--mobile] [--fail-on kritisch|wichtig] [--no-axe]
//
// Voraussetzungen: Node 18+, Playwright mit Chromium, optional axe-core.
//   npm install playwright axe-core
//   npx playwright install chromium
//
// Das Skript sendet keine Daten an Dritte. Es ruft nur die angegebenen Seiten
// (und Unterseiten derselben Domain) auf, wie ein normaler Browser.

import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const VERSION = '1.3.0';
const HERE = dirname(fileURLToPath(import.meta.url));
const SEV_ORDER = { kritisch: 0, wichtig: 1, empfehlung: 2, hinweis: 3 };
const SEV_ICON = { kritisch: '🔴', wichtig: '🟠', empfehlung: '🟡', hinweis: 'ℹ️' };
const MAX_LOCS = 8;

// ---------------------------------------------------------------------------
// Argumente
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const o = { urls: [], maxPages: null, json: false, mobile: false, failOn: null, noAxe: false, timeout: 30000, states: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (a === '--mobile') o.mobile = true;
    else if (a === '--no-axe') o.noAxe = true;
    else if (a === '--max-pages') o.maxPages = Math.max(0, parseInt(argv[++i], 10) || 0);
    else if (a === '--timeout') o.timeout = Math.max(5000, parseInt(argv[++i], 10) || 30000);
    else if (a === '--fail-on') o.failOn = argv[++i];
    else if (a === '--states') o.states = argv[++i];
    else if (a === '-h' || a === '--help') o.help = true;
    else if (a.startsWith('--')) throw new Error(`Unbekannte Option: ${a}`);
    else o.urls.push(/^https?:\/\//.test(a) ? a : `https://${a}`);
  }
  if (o.failOn && !(o.failOn in SEV_ORDER)) throw new Error('--fail-on erwartet "kritisch" oder "wichtig"');
  if (process.env.BFSG_NO_AXE === '1') o.noAxe = true;
  // Mit Zustandsdatei werden standardmäßig keine weiteren Unterseiten gesucht
  if (o.maxPages === null) o.maxPages = o.states ? 0 : 5;
  return o;
}

const HELP = `BFSG-Audit Browser-Scan ${VERSION}

  node browser-scan.mjs <url> [weitere URLs] [Optionen]
  node browser-scan.mjs [<basis-url>] --states zustaende.json [Optionen]

Optionen:
  --states DATEI     Zustände aus einer JSON-Datei durchklicken und einzeln prüfen
                     (z. B. leerer Warenkorb, Validierungsfehler, geöffneter Dialog)
  --max-pages N      zusätzlich bis zu N Unterseiten derselben Domain prüfen
                     (Standard 5, mit --states 0)
  --mobile           mit Smartphone-Ansicht (390 × 844) prüfen
  --json             Ausgabe als JSON
  --fail-on STUFE    Exit-Code 1, wenn Befunde ab "kritisch" bzw. "wichtig" vorliegen (für CI)
  --no-axe           axe-core nicht verwenden, nur eingebaute Regeln
  --timeout MS       Zeitlimit je Seite (Standard 30000)

Voraussetzungen:
  npm install playwright axe-core
  npx playwright install chromium`;

// ---------------------------------------------------------------------------
// Abhängigkeiten finden (lokal, im Skript-Ordner, Cache oder global)
// ---------------------------------------------------------------------------

function searchPaths() {
  const p = [process.cwd(), HERE, join(HERE, '..'), join(homedir(), '.cache', 'bfsg-audit')];
  if (process.env.BFSG_AUDIT_DEPS) p.unshift(process.env.BFSG_AUDIT_DEPS);
  if (process.env.NODE_PATH) p.push(...process.env.NODE_PATH.split(':'));
  try { p.push(execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()); } catch { /* npm fehlt */ }
  return p;
}

function resolveDep(name, paths) {
  const req = createRequire(join(HERE, 'noop.js'));
  try { return req.resolve(name, { paths }); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Zustände
// ---------------------------------------------------------------------------

// Was ohne Zustandsdatei typischerweise offen bleibt:
const DEFAULT_OPEN_STATES = [
  'Warenkorb leer und gefüllt',
  'Validierungsfehler in Formularen (z. B. leer abgeschickt)',
  'Geöffnete Dialoge, Menüs, Akkordeons und Tooltips',
  'Cookie-Banner und Cookie-Einstellungen',
  'Login, Registrierung und Kundenkonto',
  'Bestellabschluss und Bestätigungsseite',
];

const STEP_KINDS = ['click', 'fill', 'select', 'check', 'press', 'waitFor', 'wait', 'goto', 'hover'];

function loadStates(file, baseArg) {
  let data;
  try { data = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { throw new Error(`Zustandsdatei nicht lesbar: ${file} (${e.message})`); }
  const list = Array.isArray(data) ? data : data.states;
  if (!Array.isArray(list) || !list.length) throw new Error('Zustandsdatei braucht eine Liste "states".');
  const base = baseArg || data.baseUrl || null;
  return list.map((st, i) => {
    if (!st || typeof st.name !== 'string' || !st.name.trim()) throw new Error(`Zustand ${i + 1}: "name" fehlt.`);
    let url = null;
    if (!st.manual) {
      if (!st.url) throw new Error(`Zustand "${st.name}": "url" fehlt.`);
      try { url = new URL(st.url, base || undefined).href; }
      catch { throw new Error(`Zustand "${st.name}": URL "${st.url}" ungültig — relative Pfade brauchen eine Basis-URL (Argument oder "baseUrl").`); }
    } else if (st.url) {
      try { url = new URL(st.url, base || undefined).href; } catch { url = st.url; }
    }
    const steps = st.steps || [];
    steps.forEach((step, j) => {
      const kind = STEP_KINDS.find(k => k in step);
      if (!kind) throw new Error(`Zustand "${st.name}", Schritt ${j + 1}: unbekannter Schritt ${JSON.stringify(step)}. Erlaubt: ${STEP_KINDS.join(', ')}`);
    });
    return { name: st.name.trim(), url, steps, manual: st.manual || null, note: st.note || '' };
  });
}

function describeStep(step) {
  if ('click' in step) return `klicken: ${step.click}`;
  if ('fill' in step) return `ausfüllen: ${step.fill}`;
  if ('select' in step) return `auswählen: ${step.select}`;
  if ('check' in step) return `ankreuzen: ${step.check}`;
  if ('press' in step) return `Taste ${step.press}${step.on ? ` in ${step.on}` : ''}`;
  if ('waitFor' in step) return `warten auf: ${step.waitFor}`;
  if ('wait' in step) return `${step.wait} ms warten`;
  if ('goto' in step) return `öffnen: ${step.goto}`;
  if ('hover' in step) return `Maus über: ${step.hover}`;
  return JSON.stringify(step);
}

async function runStep(page, step, timeout) {
  const loc = sel => page.locator(sel).first();
  const t = { timeout: Math.min(timeout, 10000) };
  if ('click' in step) await loc(step.click).click(t);
  else if ('fill' in step) await loc(step.fill).fill(String(step.value ?? ''), t);
  else if ('select' in step) await loc(step.select).selectOption(String(step.value ?? ''), t);
  else if ('check' in step) await loc(step.check).check(t);
  else if ('hover' in step) await loc(step.hover).hover(t);
  else if ('press' in step) { if (step.on) await loc(step.on).press(step.press, t); else await page.keyboard.press(step.press); }
  else if ('waitFor' in step) await loc(step.waitFor).waitFor({ state: 'visible', ...t });
  else if ('wait' in step) await page.waitForTimeout(Math.min(+step.wait || 0, 10000));
  else if ('goto' in step) await page.goto(new URL(step.goto, page.url()).href, { waitUntil: 'load', timeout });
  await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Regeln
// ---------------------------------------------------------------------------

// Eingebaute Regeln (ohne axe). Texte wie in scan.py.
const BUILTIN_META = {
  'color-contrast': ['wichtig', 'Zu geringer Farbkontrast', '1.4.3 Kontrast (AA)',
    'Text braucht mindestens 4,5:1, großer Text (≥ 18 pt bzw. 14 pt fett) 3:1. Textfarbe abdunkeln oder Hintergrund aufhellen.'],
  'image-alt': ['wichtig', 'Bilder ohne Alternativtext', '1.1.1 Nicht-Text-Inhalt (A)',
    'alt-Attribut ergänzen: beschreibend bei Inhaltsbildern, alt="" bei dekorativen.'],
  'label': ['kritisch', 'Formularfelder ohne zugänglichen Namen', '1.3.1 / 3.3.2 / 4.1.2 (A)',
    '<label for=…> verknüpfen (placeholder ist kein Label).'],
  'button-name': ['kritisch', 'Buttons ohne zugänglichen Namen', '4.1.2 Name, Rolle, Wert (A)',
    'Icon-Buttons brauchen aria-label oder sichtbaren Text.'],
  'link-name': ['wichtig', 'Links ohne zugänglichen Namen', '2.4.4 Linkzweck (A) / 4.1.2',
    'Icon-/Bild-Links mit aria-label oder alt am Bild versehen.'],
  'frame-title': ['wichtig', 'iframes ohne title', '4.1.2 Name, Rolle, Wert (A)',
    'title beschreibt den Inhalt, z. B. title="Video: Produktvorstellung".'],
  'html-has-lang': ['wichtig', '<html> ohne lang-Attribut', '3.1.1 Sprache der Seite (A)', 'lang="de" setzen.'],
  'document-title': ['wichtig', 'Seite ohne <title>', '2.4.2 Seite mit Titel (A)', 'Aussagekräftigen Seitentitel setzen.'],
  'meta-viewport': ['kritisch', 'Zoom im Viewport gesperrt', '1.4.4 Textgröße (AA)',
    'user-scalable=no / maximum-scale=1 entfernen.'],
  'tabindex': ['wichtig', 'Positiver tabindex', '2.4.3 Fokus-Reihenfolge (A)', 'tabindex > 0 entfernen bzw. DOM umsortieren.'],
  'no-autoplay-audio': ['wichtig', 'Audio/Video startet automatisch mit Ton', '1.4.2 Audio-Steuerung (A)',
    'autoplay entfernen oder muted + sichtbare Steuerung.'],
};

// Laufzeit-Prüfungen, die es nur hier gibt (auch zusätzlich zu axe)
// Ergänzende Prüfung, die auch zusätzlich zu axe läuft
const EXTRA_META = {
  'placeholder-label': ['wichtig', 'Platzhalter statt Beschriftung', '3.3.2 Beschriftungen oder Anweisungen (A)',
    'Der Platzhalter verschwindet beim Tippen, danach fehlt die Beschriftung. Sichtbares <label for=…> ergänzen.'],
};

const KEYBOARD_META = {
  'focus-not-visible': ['wichtig', 'Fokus beim Tabben nicht sichtbar', '2.4.7 Fokus sichtbar (AA)',
    'Per Tab erreichtes Element zeigt keinen Fokusrahmen. :focus-visible { outline: 3px solid … } ergänzen.'],
  'keyboard-trap': ['kritisch', 'Mögliche Tastaturfalle', '2.1.2 Keine Tastaturfalle (A)',
    'Beim Tabben bleibt der Fokus hängen. Prüfen, ob Modal/Widget per Tab und Esc verlassen werden kann.'],
  'no-focusable': ['hinweis', 'Kein Element per Tab erreichbar', '2.1.1 Tastatur (A)',
    'Auf der Seite ließ sich nichts per Tab fokussieren. Bei interaktiven Seiten manuell prüfen.'],
};

function axeSeverity(v) {
  const tags = v.tags || [];
  const only22 = tags.includes('wcag22aa') || tags.includes('wcag22a');
  const older = tags.some(t => /^wcag2a$|^wcag2aa$|^wcag21a$|^wcag21aa$/.test(t));
  if (only22 && !older) return 'empfehlung';
  return { critical: 'kritisch', serious: 'wichtig', moderate: 'wichtig', minor: 'empfehlung' }[v.impact] || 'wichtig';
}

function wcagFromTags(tags) {
  const sc = (tags || []).filter(t => /^wcag\d{3,4}$/.test(t))
    .map(t => t.slice(4).split('').join('.').replace(/^(\d)\.(\d)\.(\d)\.(\d)$/, '$1.$2.$3$4'));
  const lvl = (tags || []).find(t => /^wcag2(1|2)?a{1,2}$/.test(t));
  return sc.length ? `${sc.join(', ')}${lvl ? ` (${lvl.replace(/^wcag2(1|2)?/, '').toUpperCase()})` : ''}` : '—';
}

// ---------------------------------------------------------------------------
// Im Browser auszuführender Code
// ---------------------------------------------------------------------------

// Eingebaute DOM-/Kontrastprüfung auf der fertig aufgebauten Seite.
function builtinAudit() {
  const out = [];
  const inc = [];
  const sel = el => {
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = [];
    for (let e = el; e && e.nodeType === 1 && parts.length < 4; e = e.parentElement) {
      let s = e.tagName.toLowerCase();
      if (e.classList.length) s += '.' + [...e.classList].slice(0, 2).map(c => CSS.escape(c)).join('.');
      const p = e.parentElement;
      if (p) { const same = [...p.children].filter(c => c.tagName === e.tagName); if (same.length > 1) s += `:nth-of-type(${same.indexOf(e) + 1})`; }
      parts.unshift(s);
      if (e.id) { parts[0] = `#${CSS.escape(e.id)}`; break; }
    }
    return parts.join(' > ');
  };
  const html = el => el.outerHTML.replace(/\s+/g, ' ').slice(0, 140);
  const visible = el => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.visibility !== 'hidden' && cs.display !== 'none' && r.width > 0 && r.height > 0; };
  const add = (rule, el, extra, data) => out.push({ rule, target: el ? sel(el) : '', html: el ? html(el) : '', extra: extra || '', data: data || null });
  const accName = el => {
    const lb = el.getAttribute('aria-labelledby');
    if (lb) { const t = lb.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim(); if (t) return t; }
    const al = el.getAttribute('aria-label'); if (al && al.trim()) return al.trim();
    if (el.labels && el.labels.length) { const t = [...el.labels].map(l => l.textContent).join(' ').trim(); if (t) return t; }
    const txt = (el.innerText || el.textContent || '').trim(); if (txt) return txt;
    const imgAlt = [...el.querySelectorAll('img[alt],[aria-label]')].map(i => i.getAttribute('alt') || i.getAttribute('aria-label')).join(' ').trim(); if (imgAlt) return imgAlt;
    return (el.getAttribute('title') || el.getAttribute('value') || '').trim();
  };
  if (!document.documentElement.getAttribute('lang')) add('html-has-lang', document.documentElement);
  if (!document.title.trim()) add('document-title', null);
  const vp = document.querySelector('meta[name=viewport]');
  if (vp && /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/.test(vp.content)) add('meta-viewport', vp);
  document.querySelectorAll('img').forEach(i => { if (!i.hasAttribute('alt') && i.getAttribute('role') !== 'presentation' && i.getAttribute('role') !== 'none' && !i.closest('[aria-hidden=true]') && !i.getAttribute('aria-label')) add('image-alt', i); });
  document.querySelectorAll('input,select,textarea').forEach(f => { if (['hidden', 'submit', 'button', 'reset', 'image'].includes((f.type || '').toLowerCase()) || !visible(f)) return; const n = (f.labels && [...f.labels].some(l => l.textContent.trim())) || f.getAttribute('aria-label') || f.getAttribute('aria-labelledby') || f.getAttribute('title'); if (!n && !(f.getAttribute('placeholder') || '').trim()) add('label', f); });
  document.querySelectorAll('button,[role=button]').forEach(b => { if (visible(b) && !accName(b)) add('button-name', b); });
  document.querySelectorAll('a[href]').forEach(a => { if (visible(a) && !accName(a)) add('link-name', a); });
  document.querySelectorAll('iframe').forEach(f => { if (!f.title && !f.getAttribute('aria-label') && f.getAttribute('aria-hidden') !== 'true') add('frame-title', f); });
  document.querySelectorAll('[tabindex]').forEach(e => { if (+e.getAttribute('tabindex') > 0) add('tabindex', e); });
  document.querySelectorAll('video[autoplay]:not([muted]),audio[autoplay]').forEach(v => { if (!v.muted) add('no-autoplay-audio', v); });

  // Kontrast (WCAG 2.x Formel); Text über Hintergrundbildern -> manuell prüfen
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const blend = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
  const bgOf = el => { const L = []; let complex = false; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== 'none' || cs.filter !== 'none' || +cs.opacity < 1) complex = true; const c = parse(cs.backgroundColor); if (c && c.a > 0) { L.push(c); if (c.a >= 1) break; } } let b = { r: 255, g: 255, b: 255, a: 1 }; for (const l of L.reverse()) b = blend(l, b); return { bg: b, complex }; };
  const seen = new Set();
  const w = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) {
    const t = w.currentNode; const el = t.parentElement;
    if (!t.textContent.trim() || !el || seen.has(el) || !visible(el)) continue;
    seen.add(el);
    if (el.closest('[disabled],[aria-disabled=true],[aria-hidden=true]')) continue;
    const cs = getComputedStyle(el); let fg = parse(cs.color); if (!fg) continue;
    const { bg, complex } = bgOf(el);
    if (complex) { inc.push({ rule: 'color-contrast', target: sel(el), html: html(el) }); continue; }
    fg = blend(fg, bg);
    const ratio = (Math.max(lum(fg), lum(bg)) + 0.05) / (Math.min(lum(fg), lum(bg)) + 0.05);
    const size = parseFloat(cs.fontSize); const bold = +cs.fontWeight >= 700;
    const pt = size * 0.75; const need = (pt >= 18 || (bold && pt >= 14)) ? 3 : 4.5;
    const bgStr = `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`;
    if (ratio + 1e-9 < need) add('color-contrast', el, `${ratio.toFixed(2)}:1, nötig ${need}:1 (${cs.color} auf ${bgStr}, ${size}px)`, { fg: cs.color, bg: bgStr, need });
  }
  return { violations: out, incomplete: inc };
}

// Ordnet Fundstellen einer Ursache zu: wiederholte Komponente (nächstes Elternelement,
// dessen Klassen mehrfach auf der Seite vorkommen), Element-Muster und CSS-Farbvariablen.
function describeTargets(items) {
  const usable = c => !/^(css|sc|jsx|svelte|astro|emotion|chakra|tw)-/.test(c) && !/[0-9a-f]{6,}/i.test(c)
    && !/^(is|has)-(active|open|selected|focus|hover|visible)$/.test(c) && !/^(active|open|selected|show|visible)$/.test(c);
  const strip = c => c.replace(/(_{1,2}|-)[a-zA-Z0-9]{5}$/, m => (/\d/.test(m) ? '' : m));
  const classes = el => [...(el.classList || [])].filter(usable).map(strip).filter(Boolean).slice(0, 3).sort();
  const sig = el => { const c = classes(el); return c.length ? { show: `${el.tagName.toLowerCase()}.${c.join('.')}`, css: `${el.tagName.toLowerCase()}${c.map(x => '.' + CSS.escape(x)).join('')}` } : null; };
  const howMany = q => { try { return document.querySelectorAll(q).length; } catch { return 0; } };
  const norm = v => { const d = document.createElement('span'); d.style.color = v; if (!d.style.color) return null; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; };
  let vars = null;
  const collectVars = () => {
    const out = [];
    for (const sh of document.styleSheets) {
      let rules; try { rules = sh.cssRules; } catch { continue; }
      const walk = rs => { for (const r of rs) { if (r.style) for (const prop of r.style) if (prop.startsWith('--')) out.push([prop, r.style.getPropertyValue(prop).trim()]); if (r.cssRules) walk(r.cssRules); } };
      walk(rules);
    }
    return out.map(([n, v]) => [n, norm(v)]).filter(([, v]) => v);
  };
  return items.map(it => {
    let el = null; try { el = document.querySelector(it.selector); } catch { /* ungültiger Selektor */ }
    if (!el) return { component: null, element: null, colorVars: [] };
    let component = null;
    for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      const s = sig(a); if (s && howMany(s.css) >= 2) { component = s.show; break; }
    }
    let colorVars = [];
    if (it.fg) {
      if (!vars) vars = collectVars();
      const f = norm(it.fg);
      colorVars = [...new Set(vars.filter(([, v]) => v === f).map(([n]) => n))].slice(0, 3);
    }
    const own = sig(el);
    return { component, element: own ? own.show : el.tagName.toLowerCase(), colorVars };
  });
}

// Eingabefelder, deren einzige Beschriftung der Platzhalter ist (axe wertet ihn als Namen).
function placeholderOnly() {
  const out = [];
  document.querySelectorAll('input[placeholder],textarea[placeholder]').forEach(f => {
    const r = f.getBoundingClientRect(); if (!r.width || !r.height) return;
    if (['hidden', 'submit', 'button', 'reset', 'image', 'checkbox', 'radio'].includes((f.type || '').toLowerCase())) return;
    const labelled = (f.labels && [...f.labels].some(l => l.textContent.trim())) || f.getAttribute('aria-label') || f.getAttribute('aria-labelledby') || f.getAttribute('title');
    if (!labelled && f.getAttribute('placeholder').trim()) out.push({ html: f.outerHTML.replace(/\s+/g, ' ').slice(0, 140) });
  });
  return out;
}

// Merkt sich den Stil eines Elements, um Fokus-Änderungen zu erkennen.
function focusSnapshot() {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    key: el.outerHTML.slice(0, 200) + '|' + Math.round(r.top) + '|' + Math.round(r.left),
    html: el.outerHTML.replace(/\s+/g, ' ').slice(0, 140),
    tag: el.tagName.toLowerCase(),
    style: [cs.outlineStyle, cs.outlineWidth, cs.outlineColor, cs.boxShadow, cs.borderColor, cs.borderWidth, cs.backgroundColor, cs.color, cs.textDecorationLine].join('|'),
    outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0,
    shadow: cs.boxShadow !== 'none',
    visible: r.width > 0 && r.height > 0,
  };
}

// ---------------------------------------------------------------------------
// Ablauf je Seite
// ---------------------------------------------------------------------------

// Merkt sich den Stil aller fokussierbaren Elemente OHNE Fokus. Beim Tabben wird
// verglichen: Ändert sich nichts Sichtbares, fehlt ein Fokus-Indikator.
function rememberUnfocusedStyles() {
  const q = 'a[href],button,input,select,textarea,summary,iframe,[tabindex],[contenteditable=""],[contenteditable=true]';
  window.__bfsgBase = new WeakMap();
  for (const el of document.querySelectorAll(q)) {
    const cs = getComputedStyle(el);
    window.__bfsgBase.set(el, [cs.outlineStyle, cs.outlineWidth, cs.outlineColor, cs.boxShadow, cs.borderColor, cs.borderWidth, cs.backgroundColor, cs.color, cs.textDecorationLine].join('|'));
  }
}

function focusChanged() {
  const el = document.activeElement;
  const base = window.__bfsgBase && window.__bfsgBase.get(el);
  const cs = getComputedStyle(el);
  const now = [cs.outlineStyle, cs.outlineWidth, cs.outlineColor, cs.boxShadow, cs.borderColor, cs.borderWidth, cs.backgroundColor, cs.color, cs.textDecorationLine].join('|');
  if (base === undefined) return (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
  return base !== now;
}

async function keyboardWalk(page, maxTabs = 60) {
  const issues = [];
  await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); });
  await page.evaluate(rememberUnfocusedStyles);
  let prevKey = null, stuck = 0, reached = 0;
  const seen = new Set();
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab');
    const s = await page.evaluate(focusSnapshot);
    if (!s) { if (reached) break; continue; }
    if (seen.has(s.key) && s.key !== prevKey) break; // einmal durch die Seite
    if (s.key === prevKey) { if (++stuck >= 3) { issues.push({ rule: 'keyboard-trap', html: s.html }); break; } continue; }
    stuck = 0; prevKey = s.key; seen.add(s.key); reached++;
    if (s.visible && s.tag !== 'iframe' && !(await page.evaluate(focusChanged))) issues.push({ rule: 'focus-not-visible', html: s.html });
  }
  if (!reached) issues.push({ rule: 'no-focusable', html: '' });
  return issues;
}

async function auditPage(context, url, opts, axeSrc, axeLocale, report) {
  const page = await context.newPage();
  let status = 'ok';
  try {
    const resp = await page.goto(url, { waitUntil: 'load', timeout: opts.timeout });
    if (resp && resp.status() >= 400) status = `HTTP ${resp.status()}`;
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(500);
  } catch (e) {
    report.errors.push(`${url}: ${e.message.split('\n')[0]}`);
    await page.close();
    return [];
  }
  const finalUrl = page.url();
  report.pages.push({ url: finalUrl, status, title: await page.title() });
  const counts = await auditCurrent(page, 'Nach dem Laden', opts, axeSrc, axeLocale, report);
  report.states.push({ name: 'Nach dem Laden', url: finalUrl, status: 'geprüft', steps: [], counts, note: status !== 'ok' ? status : '' });

  const links = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => ({ href: a.href, text: (a.textContent || '').trim() })));
  await page.close();
  return links;
}

// Prüft den aktuellen Zustand einer Seite; liefert die Zahl neuer Fundstellen je Schweregrad.
async function auditCurrent(page, label, opts, axeSrc, axeLocale, report) {
  const finalUrl = page.url();
  const where = `[${label}] ${finalUrl}`;
  const before = {};
  for (const f of Object.values(report.findings)) before[f.id] = f.locations.length;
  const causeItems = [];
  let path = finalUrl; try { const u = new URL(finalUrl); path = u.pathname + u.search; } catch { /* keine URL */ }
  const place = `${label} (${path})`;

  if (axeSrc) {
    await page.addScriptTag({ content: axeSrc });
    const r = await page.evaluate(async (locale) => {
      if (locale) window.axe.configure({ locale });
      const res = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations', 'incomplete'] });
      const slim = v => ({ id: v.id, impact: v.impact, tags: v.tags, help: v.help, helpUrl: v.helpUrl, description: v.description,
        nodes: v.nodes.map(n => {
          const cc = [...(n.any || []), ...(n.all || [])].find(c => c.id === 'color-contrast' || c.id === 'color-contrast-enhanced');
          return { target: n.target.join(' '), html: n.html.replace(/\s+/g, ' ').slice(0, 140), summary: (n.failureSummary || '').replace(/\s+/g, ' ').slice(0, 220),
            color: cc && cc.data ? { fg: cc.data.fgColor, bg: cc.data.bgColor, need: parseFloat(cc.data.expectedContrastRatio) || 4.5 } : null };
        }) });
      return { violations: res.violations.map(slim), incomplete: res.incomplete.map(slim), version: window.axe.version };
    }, axeLocale);
    report.engine = `axe-core ${r.version}`;
    for (const v of r.violations) {
      const f = findingFor(report, `axe:${v.id}`, axeSeverity(v), v.help, wcagFromTags(v.tags), `${v.description} Mehr: ${v.helpUrl}`);
      v.nodes.forEach(n => {
        f.locations.push(`${where} → ${n.target}  ${n.html}${n.summary ? `  — ${n.summary}` : ''}`);
        causeItems.push({ ruleId: f.id, title: f.title, where: place, selector: n.target, html: n.html, ...(n.color || {}) });
      });
    }
    for (const v of r.incomplete) {
      const m = report.manual[v.id] || (report.manual[v.id] = { help: v.help, wcag: wcagFromTags(v.tags), count: 0, examples: [] });
      m.count += v.nodes.length; if (m.examples.length < 3) m.examples.push(`${where} → ${v.nodes[0]?.target || ''}`);
    }
  } else {
    report.engine = 'eingebaute Regeln (axe-core nicht installiert)';
    const r = await page.evaluate(builtinAudit);
    for (const v of r.violations) {
      const [sev, title, wcag, hint] = BUILTIN_META[v.rule];
      const f = findingFor(report, v.rule, sev, title, wcag, hint);
      f.locations.push(`${where} → ${v.target}  ${v.html}${v.extra ? `  — ${v.extra}` : ''}`);
      causeItems.push({ ruleId: f.id, title: f.title, where: place, selector: v.target, html: v.html, ...(v.data || {}) });
    }
    if (r.incomplete.length) {
      const m = report.manual['color-contrast'] || (report.manual['color-contrast'] = { help: 'Kontrast über Hintergrundbildern, Verläufen oder Transparenz', wcag: '1.4.3 (AA)', count: 0, examples: [] });
      m.count += r.incomplete.length; if (m.examples.length < 3) m.examples.push(`${where} → ${r.incomplete[0].target}`);
    }
  }

  for (const p of await page.evaluate(placeholderOnly)) {
    const [sev, title, wcag, hint] = EXTRA_META['placeholder-label'];
    findingFor(report, 'placeholder-label', sev, title, wcag, hint).locations.push(`${where} → ${p.html}`);
  }

  for (const k of await keyboardWalk(page)) {
    const [sev, title, wcag, hint] = KEYBOARD_META[k.rule];
    const f = findingFor(report, k.rule, sev, title, wcag, hint);
    f.locations.push(`${where}${k.html ? ` → ${k.html}` : ''}`);
  }

  if (causeItems.length) {
    const info = await page.evaluate(describeTargets, causeItems.slice(0, 600).map(i => ({ selector: i.selector, fg: i.fg || null })));
    causeItems.slice(0, 600).forEach((it, i) => addToCause(report, it, info[i]));
  }

  const counts = { kritisch: 0, wichtig: 0, empfehlung: 0, hinweis: 0 };
  for (const f of Object.values(report.findings)) counts[f.severity] += f.locations.length - (before[f.id] || 0);
  return counts;
}

// Öffnet einen Zustand aus der Zustandsdatei, führt die Schritte aus und prüft ihn.
async function auditState(context, st, opts, axeSrc, axeLocale, report) {
  const entry = { name: st.name, url: st.url, status: '', steps: st.steps.map(describeStep), counts: null, note: st.note };
  report.states.push(entry);
  if (st.manual) { entry.status = 'manuell offen'; entry.note = typeof st.manual === 'string' ? st.manual : (st.note || 'manuell prüfen'); return; }
  const page = await context.newPage();
  try {
    try {
      const resp = await page.goto(st.url, { waitUntil: 'load', timeout: opts.timeout });
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      if (resp && resp.status() >= 400) entry.note = `HTTP ${resp.status()}`;
    } catch (e) {
      entry.status = 'fehlgeschlagen'; entry.note = `Seite nicht geladen: ${e.message.split('\n')[0]}`; return;
    }
    for (let i = 0; i < st.steps.length; i++) {
      try { await runStep(page, st.steps[i], opts.timeout); }
      catch (e) {
        entry.status = 'fehlgeschlagen';
        const msg = e.message.split('\n')[0];
        const why = /Timeout/i.test(msg) ? 'Element nicht gefunden, nicht sichtbar oder nicht bedienbar (Zeitlimit überschritten)'
          : /strict mode violation/i.test(msg) ? 'Selektor passt auf mehrere Elemente' : msg.slice(0, 160);
        entry.note = `Schritt ${i + 1} (${describeStep(st.steps[i])}): ${why}`;
        return;
      }
    }
    await page.waitForTimeout(300);
    if (!report.pages.some(p => p.url === page.url())) report.pages.push({ url: page.url(), status: 'ok', title: await page.title() });
    entry.url = page.url();
    entry.counts = await auditCurrent(page, st.name, opts, axeSrc, axeLocale, report);
    entry.status = 'geprüft';
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// Ursachen
// ---------------------------------------------------------------------------

function parseColor(c) {
  if (!c) return null;
  let m = String(c).trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) { let h = m[1]; if (h.length === 3) h = h.split('').map(x => x + x).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }
  m = String(c).match(/rgba?\(([^)]+)\)/);
  if (m) return m[1].split(/[ ,/]+/).filter(Boolean).slice(0, 3).map(Number);
  return null;
}
const toHex = rgb => '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
function luminance([r, g, b]) { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
function contrast(a, b) { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }

// Nächste Textfarbe in gleicher Richtung (dunkler auf hellem, heller auf dunklem Grund), die den Mindestkontrast erreicht.
function suggestColor(fg, bg, need) {
  const f = parseColor(fg), b = parseColor(bg);
  if (!f || !b) return null;
  const target = luminance(b) > 0.4 ? [0, 0, 0] : [255, 255, 255];
  for (let t = 0; t <= 1.0001; t += 0.01) {
    const c = f.map((v, i) => v + (target[i] - v) * t);
    const r = contrast(c.map(Math.round), b);
    if (r >= need + 0.05) return { color: toHex(c), ratio: r };
  }
  return null;
}

function addToCause(report, it, info) {
  report.causes = report.causes || {};
  let key, kind, label;
  if (/color-contrast/.test(it.ruleId) && it.fg && it.bg) {
    const fg = toHex(parseColor(it.fg) || [0, 0, 0]), bg = toHex(parseColor(it.bg) || [255, 255, 255]);
    key = `farbe|${fg}|${bg}`; kind = 'farbe'; label = `Textfarbe ${fg} auf ${bg}`;
  } else if (info && info.component) {
    key = `komponente|${info.component}`; kind = 'komponente'; label = `Komponente \`${info.component}\``;
  } else {
    const el = (info && info.element) || '?';
    key = `muster|${it.ruleId}|${el}`; kind = 'muster'; label = `Element-Muster \`${el}\``;
  }
  const c = report.causes[key] || (report.causes[key] = { kind, label, count: 0, rules: {}, places: [], example: '', colorVars: [], suggestion: null });
  c.count++;
  c.rules[it.title] = (c.rules[it.title] || 0) + 1;
  if (!c.places.includes(it.where)) c.places.push(it.where);
  if (!c.example) c.example = `${it.selector}  ${it.html || ''}`.trim();
  if (kind === 'farbe') {
    for (const v of (info && info.colorVars) || []) if (!c.colorVars.includes(v)) c.colorVars.push(v);
    if (!c.suggestion) {
      const sgg = suggestColor(it.fg, it.bg, it.need || 4.5);
      if (sgg) c.suggestion = `${sgg.color} ergibt ${sgg.ratio.toFixed(1)}:1 (nötig ${it.need || 4.5}:1)`;
    }
  }
}

function sortedCauses(report) {
  return Object.values(report.causes || {}).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function findingFor(report, id, severity, title, wcag, hint) {
  return report.findings[id] || (report.findings[id] = { id, severity, title, wcag, hint, locations: [] });
}

// ---------------------------------------------------------------------------
// Ausgabe
// ---------------------------------------------------------------------------

function renderMd(report) {
  const out = [`# BFSG-Browser-Scan`, '',
    `Engine: ${report.engine} · Tastatur-Durchlauf · browser-scan ${VERSION} · Ansicht: ${report.viewport}`,
    `Geprüfte Seiten (${report.pages.length}): ${report.pages.map(p => p.url + (p.status !== 'ok' ? ` [${p.status}]` : '')).join(', ')}`, '',
    'Treffer sind Hinweise — jeden im Kontext bestätigen. Fundstellen sind CSS-Selektoren im Browser; die Datei im Projekt muss man daraus ableiten.'];
  if (report.errors.length) out.push('', '**Nicht geprüft:** ' + report.errors.join('; '));

  // Geprüfte Zustände
  out.push('', '## Geprüfte Zustände', '', '| Zustand | Seite | Status | 🔴 | 🟠 | 🟡 |', '|---|---|---|---|---|---|');
  const icon = { 'geprüft': '✅ geprüft', 'fehlgeschlagen': '⚠️ fehlgeschlagen', 'manuell offen': '👤 manuell offen' };
  for (const st of report.states) {
    const c = st.counts || {};
    const n = k => (st.counts ? String(c[k]) : '–');
    out.push(`| ${st.name.replace(/\|/g, '/')} | ${(st.url || '–').replace(/\|/g, '/')} | ${icon[st.status] || st.status} | ${n('kritisch')} | ${n('wichtig')} | ${n('empfehlung')} |`);
  }
  const notes = report.states.filter(st => st.note || st.steps.length);
  if (notes.length) {
    out.push('');
    for (const st of notes) out.push(`- **${st.name}:**${st.steps.length ? ` Schritte: ${st.steps.join(' → ')}.` : ''}${st.note ? ` ${st.note}` : ''}`);
  }
  out.push('', '**Nicht geprüfte Zustände:**');
  const open = report.states.filter(st => st.status !== 'geprüft').map(st => `${st.name}${st.status === 'fehlgeschlagen' ? ' (Schritte fehlgeschlagen, siehe oben)' : ''}`);
  if (report.usedStatesFile) {
    open.forEach(o => out.push(`- ${o}`));
    out.push('- alle Zustände, die nicht in der Zustandsdatei stehen');
  } else {
    out.push('Geprüft wurde nur der Zustand direkt nach dem Laden. Diese typischen Zustände sind offen — mit `--states` lassen sie sich durchklicken:');
    DEFAULT_OPEN_STATES.forEach(o => out.push(`- ${o}`));
  }

  // Ursachen: was mehrfach auftritt, hat meist eine gemeinsame Ursache
  const total = Object.values(report.findings).reduce((n, f) => n + f.locations.length, 0);
  const causes = sortedCauses(report).filter(c => c.count >= 2);
  if (causes.length) {
    const covered = causes.reduce((n, c) => n + c.count, 0);
    out.push('', '## Ursachen', '', `${causes.length} Ursache(n) erklären ${covered} von ${total} Fundstellen. Übrige Fundstellen sind Einzelfälle (siehe Befunde unten).`, '');
    causes.forEach((c, i) => {
      out.push(`### ${i + 1}. ${c.label} — behebt ${c.count} Fundstelle(n)`);
      out.push(`- **Betrifft:** ${Object.entries(c.rules).map(([t, n]) => `${t} (${n}×)`).join(', ')}`);
      out.push(`- **Vorkommen:** ${c.places.length} ${c.places.length === 1 ? 'Seite/Zustand' : 'Seiten/Zustände'}: ${c.places.slice(0, 5).join(', ')}${c.places.length > 5 ? ' …' : ''}`);
      if (c.kind === 'farbe') {
        out.push(`- **Farbvariable:** ${c.colorVars.length ? c.colorVars.map(v => `\`${v}\``).join(', ') : 'keine gefunden — Farbe direkt im CSS suchen'}`);
        if (c.suggestion) out.push(`- **Vorschlag:** ${c.suggestion} — optisch prüfen`);
      } else if (c.kind === 'komponente') {
        out.push('- **Wo im Code:** Datei der Komponente über den Klassennamen suchen; ein Fix dort wirkt auf alle Vorkommen');
      }
      out.push(`- **Beispiel:** \`${c.example.replace(/`/g, "'").slice(0, 200)}\``, '');
    });
  }

  const items = Object.values(report.findings).sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.id.localeCompare(b.id));
  if (!items.length) out.push('', 'Keine automatisch prüfbaren Barrieren gefunden. Manuelle Prüfung trotzdem nötig.');
  let cur = null;
  for (const it of items) {
    if (it.severity !== cur) { cur = it.severity; out.push('', `## ${SEV_ICON[cur]} ${cur[0].toUpperCase()}${cur.slice(1)}`, ''); }
    out.push(`### ${it.title}  \`[${it.id}]\``, `- **WCAG:** ${it.wcag}`, `- **Hinweis:** ${it.hint}`);
    const locs = it.locations.slice(0, MAX_LOCS); const more = it.locations.length - locs.length;
    out.push(`- **Fundstellen (${it.locations.length}):**`, ...locs.map(l => `  - \`${l.replace(/`/g, "'")}\``));
    if (more > 0) out.push(`  - … +${more} weitere`);
    out.push('');
  }
  const man = Object.entries(report.manual);
  out.push('', '## 👤 Manuell prüfen', '');
  for (const [id, m] of man) out.push(`- ${m.help} (${m.wcag}) — ${m.count} Stelle(n), z. B. ${m.examples.join('; ')}`);
  out.push('- Screenreader-Test der Kernaufgaben (z. B. Bestellung mit NVDA oder VoiceOver)',
    '- Zoom 200 % und Ansicht bei 320 px Breite (1.4.4, 1.4.10)',
    '- Qualität von Alternativtexten, Linktexten und Fehlermeldungen',
    '- Untertitel und Audiodeskription bei Videos (1.2.x)',
    '- alle unter „Nicht geprüfte Zustände“ genannten Zustände');
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Hauptprogramm
// ---------------------------------------------------------------------------

async function main() {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); return 2; }
  if (opts.help || (!opts.urls.length && !opts.states)) { console.log(HELP); return opts.help ? 0 : 2; }
  let states = null;
  if (opts.states) {
    try { states = loadStates(opts.states, opts.urls[0]); }
    catch (e) { console.error(e.message); return 2; }
  }

  const paths = searchPaths();
  const pwPath = resolveDep('playwright', paths) || resolveDep('playwright-core', paths);
  if (!pwPath) {
    console.error('Playwright nicht gefunden. Installation (einmalig):\n  npm install playwright axe-core\n  npx playwright install chromium');
    return 3;
  }
  const req = createRequire(join(HERE, 'noop.js'));
  const { chromium } = req(pwPath);

  let axeSrc = null, axeLocale = null;
  if (!opts.noAxe) {
    const axePath = resolveDep('axe-core/axe.min.js', paths);
    if (axePath) {
      axeSrc = readFileSync(axePath, 'utf8');
      const loc = join(dirname(axePath), 'locales', 'de.json');
      if (existsSync(loc)) axeLocale = JSON.parse(readFileSync(loc, 'utf8'));
    } else if (!opts.json) {
      console.error('Hinweis: axe-core nicht installiert — es laufen die eingebauten Regeln. Für die vollständige Prüfung: npm install axe-core');
    }
  }

  let browser;
  try { browser = await chromium.launch(); }
  catch (e) { console.error(`Chromium konnte nicht gestartet werden (${e.message.split('\n')[0]}).\nEinmalig ausführen: npx playwright install chromium`); return 3; }

  const viewport = opts.mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 };
  const context = await browser.newContext({
    bypassCSP: true, // erlaubt das Einspielen von axe-core auch bei strenger Content-Security-Policy
    locale: 'de-DE', viewport, isMobile: opts.mobile, hasTouch: opts.mobile,
  });
  const report = { version: VERSION, engine: '', viewport: opts.mobile ? 'mobil 390×844' : 'Desktop 1280×900', pages: [], errors: [], findings: {}, manual: {}, states: [], usedStatesFile: !!states, causes: {} };

  // Mit Zustandsdatei: die angegebenen URLs dienen als Basis, geprüft werden die Zustände
  const queue = states ? [] : [...opts.urls];
  const seen = new Set(queue.map(u => u.split('#')[0]));
  const origins = new Set([...opts.urls, ...(states || []).map(st => st.url).filter(Boolean)].map(u => { try { return new URL(u).origin; } catch { return null; } }).filter(Boolean));
  const prio = /barriere|accessib|warenkorb|cart|kasse|checkout|login|anmelden|konto|account|kontakt|buch|bestell/i;
  let extra = 0;
  try {
    for (const st of states || []) {
      await auditState(context, st, opts, axeSrc, axeLocale, report);
      if (!report.engine) report.engine = axeSrc ? 'axe-core' : 'eingebaute Regeln (axe-core nicht installiert)';
    }
    if (states && opts.maxPages > 0) {
      // optional zusätzlich Unterseiten ab der ersten geprüften Seite
      const start = states.find(st => st.url && !st.manual)?.url;
      if (start) { queue.push(start); seen.add(start); }
    }
    while (queue.length) {
      const url = queue.shift();
      const links = await auditPage(context, url, opts, axeSrc, axeLocale, report);
      if (extra >= opts.maxPages) continue;
      const cand = links.map(l => ({ ...l, href: l.href.split('#')[0] }))
        .filter(l => { try { const u = new URL(l.href); return origins.has(u.origin) && /^https?:$/.test(u.protocol) && !seen.has(l.href) && !/\.(pdf|zip|jpe?g|png|gif|svg|webp|mp4|docx?|xlsx?)$/i.test(u.pathname); } catch { return false; } })
        .sort((a, b) => (prio.test(b.href + b.text) ? 1 : 0) - (prio.test(a.href + a.text) ? 1 : 0));
      for (const l of cand) { if (extra >= opts.maxPages) break; seen.add(l.href); queue.push(l.href); extra++; }
    }
  } finally {
    await browser.close();
  }

  if (opts.json) {
    const findings = Object.values(report.findings).sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.id.localeCompare(b.id));
    console.log(JSON.stringify({ ...report, findings, causes: sortedCauses(report) }, null, 2));
  } else {
    console.log(renderMd(report));
  }
  if (!report.pages.length && !report.states.some(st => st.status === 'manuell offen')) return 2;
  if (opts.failOn) {
    const limit = SEV_ORDER[opts.failOn];
    if (Object.values(report.findings).some(f => SEV_ORDER[f.severity] <= limit)) return 1;
  }
  return 0;
}

main().then(code => process.exit(code), e => { console.error(e.stack || String(e)); process.exit(2); });
