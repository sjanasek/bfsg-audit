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

const VERSION = '1.1.0';
const HERE = dirname(fileURLToPath(import.meta.url));
const SEV_ORDER = { kritisch: 0, wichtig: 1, empfehlung: 2, hinweis: 3 };
const SEV_ICON = { kritisch: '🔴', wichtig: '🟠', empfehlung: '🟡', hinweis: 'ℹ️' };
const MAX_LOCS = 8;

// ---------------------------------------------------------------------------
// Argumente
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const o = { urls: [], maxPages: 5, json: false, mobile: false, failOn: null, noAxe: false, timeout: 30000 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (a === '--mobile') o.mobile = true;
    else if (a === '--no-axe') o.noAxe = true;
    else if (a === '--max-pages') o.maxPages = Math.max(0, parseInt(argv[++i], 10) || 0);
    else if (a === '--timeout') o.timeout = Math.max(5000, parseInt(argv[++i], 10) || 30000);
    else if (a === '--fail-on') o.failOn = argv[++i];
    else if (a === '-h' || a === '--help') o.help = true;
    else if (a.startsWith('--')) throw new Error(`Unbekannte Option: ${a}`);
    else o.urls.push(/^https?:\/\//.test(a) ? a : `https://${a}`);
  }
  if (o.failOn && !(o.failOn in SEV_ORDER)) throw new Error('--fail-on erwartet "kritisch" oder "wichtig"');
  if (process.env.BFSG_NO_AXE === '1') o.noAxe = true;
  return o;
}

const HELP = `BFSG-Audit Browser-Scan ${VERSION}

  node browser-scan.mjs <url> [weitere URLs] [Optionen]

Optionen:
  --max-pages N      zusätzlich bis zu N Unterseiten derselben Domain prüfen (Standard 5)
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
  const add = (rule, el, extra) => out.push({ rule, target: el ? sel(el) : '', html: el ? html(el) : '', extra: extra || '' });
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
  document.querySelectorAll('input,select,textarea').forEach(f => { if (['hidden', 'submit', 'button', 'reset', 'image'].includes((f.type || '').toLowerCase()) || !visible(f)) return; const n = (f.labels && [...f.labels].some(l => l.textContent.trim())) || f.getAttribute('aria-label') || f.getAttribute('aria-labelledby') || f.getAttribute('title'); if (!n) add('label', f); });
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
    if (ratio + 1e-9 < need) add('color-contrast', el, `${ratio.toFixed(2)}:1, nötig ${need}:1 (${cs.color} auf rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)}), ${size}px)`);
  }
  return { violations: out, incomplete: inc };
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

  if (axeSrc) {
    await page.addScriptTag({ content: axeSrc });
    const r = await page.evaluate(async (locale) => {
      if (locale) window.axe.configure({ locale });
      const res = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations', 'incomplete'] });
      const slim = v => ({ id: v.id, impact: v.impact, tags: v.tags, help: v.help, helpUrl: v.helpUrl, description: v.description,
        nodes: v.nodes.map(n => ({ target: n.target.join(' '), html: n.html.replace(/\s+/g, ' ').slice(0, 140), summary: (n.failureSummary || '').replace(/\s+/g, ' ').slice(0, 220) })) });
      return { violations: res.violations.map(slim), incomplete: res.incomplete.map(slim), version: window.axe.version };
    }, axeLocale);
    report.engine = `axe-core ${r.version}`;
    for (const v of r.violations) {
      const f = findingFor(report, `axe:${v.id}`, axeSeverity(v), v.help, wcagFromTags(v.tags), `${v.description} Mehr: ${v.helpUrl}`);
      v.nodes.forEach(n => f.locations.push(`${finalUrl} → ${n.target}  ${n.html}${n.summary ? `  — ${n.summary}` : ''}`));
    }
    for (const v of r.incomplete) {
      const m = report.manual[v.id] || (report.manual[v.id] = { help: v.help, wcag: wcagFromTags(v.tags), count: 0, examples: [] });
      m.count += v.nodes.length; if (m.examples.length < 3) m.examples.push(`${finalUrl} → ${v.nodes[0]?.target || ''}`);
    }
  } else {
    report.engine = 'eingebaute Regeln (axe-core nicht installiert)';
    const r = await page.evaluate(builtinAudit);
    for (const v of r.violations) {
      const [sev, title, wcag, hint] = BUILTIN_META[v.rule];
      const f = findingFor(report, v.rule, sev, title, wcag, hint);
      f.locations.push(`${finalUrl} → ${v.target}  ${v.html}${v.extra ? `  — ${v.extra}` : ''}`);
    }
    if (r.incomplete.length) {
      const m = report.manual['color-contrast'] || (report.manual['color-contrast'] = { help: 'Kontrast über Hintergrundbildern, Verläufen oder Transparenz', wcag: '1.4.3 (AA)', count: 0, examples: [] });
      m.count += r.incomplete.length; if (m.examples.length < 3) m.examples.push(`${finalUrl} → ${r.incomplete[0].target}`);
    }
  }

  for (const k of await keyboardWalk(page)) {
    const [sev, title, wcag, hint] = KEYBOARD_META[k.rule];
    const f = findingFor(report, k.rule, sev, title, wcag, hint);
    f.locations.push(`${finalUrl}${k.html ? ` → ${k.html}` : ''}`);
  }

  const links = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => ({ href: a.href, text: (a.textContent || '').trim() })));
  await page.close();
  return links;
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
    '- Abläufe hinter Formularen, Logins und Cookie-Bannern (werden hier nicht durchgeklickt)');
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Hauptprogramm
// ---------------------------------------------------------------------------

async function main() {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); return 2; }
  if (opts.help || !opts.urls.length) { console.log(HELP); return opts.help ? 0 : 2; }

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
  const report = { version: VERSION, engine: '', viewport: opts.mobile ? 'mobil 390×844' : 'Desktop 1280×900', pages: [], errors: [], findings: {}, manual: {} };

  const queue = [...opts.urls];
  const seen = new Set(queue.map(u => u.split('#')[0]));
  const origins = new Set(opts.urls.map(u => new URL(u).origin));
  const prio = /barriere|accessib|warenkorb|cart|kasse|checkout|login|anmelden|konto|account|kontakt|buch|bestell/i;
  let extra = 0;
  try {
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
    console.log(JSON.stringify({ ...report, findings }, null, 2));
  } else {
    console.log(renderMd(report));
  }
  if (!report.pages.length) return 2;
  if (opts.failOn) {
    const limit = SEV_ORDER[opts.failOn];
    if (Object.values(report.findings).some(f => SEV_ORDER[f.severity] <= limit)) return 1;
  }
  return 0;
}

main().then(code => process.exit(code), e => { console.error(e.stack || String(e)); process.exit(2); });
