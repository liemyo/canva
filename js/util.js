// Small DOM + UI helpers shared by every screen.

// UI code builds children with `cond ? node : null`; skip those instead of inserting "null" text.
for (const P of [Element.prototype, DocumentFragment.prototype]) {
  for (const m of ['append', 'prepend']) {
    const orig = P[m];
    P[m] = function (...a) { return orig.apply(this, a.filter(x => x != null && x !== false)); };
  }
}

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const round = (v, p = 2) => { const k = 10 ** p; return Math.round(v * k) / k; };
export const uid = (p = '') => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const clone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

export function debounce(fn, ms = 200) {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(t); fn(...a); };
  d.cancel = () => clearTimeout(t);
  return d;
}

// h('div.card#id', {onclick, style:{}, dataset:{}}, ...children)
export function h(sel, attrs, ...kids) {
  const m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(sel) || [];
  const el = document.createElement(m[1] || 'div');
  (m[2] || '').replace(/([.#])([\w-]+)/g, (_, t, n) => { t === '.' ? el.classList.add(n) : (el.id = n); });
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'class') el.className += ' ' + v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && k !== 'list' && k !== 'type' || k === 'value') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  return el;
}
function append(el, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else el.append(k instanceof Node ? k : document.createTextNode(k));
  }
}
export const icon = (name, cls = '') => h('span.ms' + (cls ? '.' + cls.split(' ').join('.') : ''), { 'aria-hidden': 'true' }, name);

export function ib(name, tip, onclick, cls = '') {
  return h('button.ib' + (cls ? '.' + cls.split(' ').join('.') : ''), { type: 'button', 'aria-label': tip, dataset: { tip }, onclick }, icon(name));
}

export function loadScript(src) {
  loadScript.c ||= {};
  return loadScript.c[src] ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = () => res(); s.onerror = () => { delete loadScript.c[src]; rej(new Error('Gagal memuat ' + src)); };
    document.head.append(s);
  });
}

export function download(blob, name) {
  const a = h('a', { href: typeof blob === 'string' ? blob : URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  if (typeof blob !== 'string') setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export const readAsDataURL = (blob) => new Promise((r, j) => { const f = new FileReader(); f.onload = () => r(f.result); f.onerror = j; f.readAsDataURL(blob); });
export const readAsText = (blob) => new Promise((r, j) => { const f = new FileReader(); f.onload = () => r(f.result); f.onerror = j; f.readAsText(blob); });
export function pickFiles(accept = 'image/*', multiple = true) {
  return new Promise(res => {
    const i = h('input', { type: 'file', accept, multiple, style: { display: 'none' } });
    i.onchange = () => { res([...i.files]); i.remove(); };
    document.body.append(i); i.click();
  });
}
export function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = 'anonymous'; im.decoding = 'async';
    im.onload = () => res(im); im.onerror = () => rej(new Error('Gambar gagal dimuat'));
    im.src = src;
  });
}
export const canvasBlob = (c, type = 'image/png', q) => new Promise(r => c.toBlob(r, type, q));

export const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
export const kbd = (s) => isMac ? s.replace(/Ctrl\+/g, '⌘').replace(/Shift\+/g, '⇧').replace(/Alt\+/g, '⌥') : s;
export const mod = (e) => (isMac ? e.metaKey : e.ctrlKey);

// ---------- tooltips ----------
let tipEl, tipT;
export function installTips() {
  tipEl = h('div.tip', { hidden: true, role: 'tooltip' });
  document.body.append(tipEl);
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest?.('[data-tip]');
    clearTimeout(tipT);
    if (!t || e.pointerType === 'touch') { tipEl.hidden = true; return; }
    tipT = setTimeout(() => {
      if (!t.isConnected) return;
      tipEl.textContent = t.dataset.tip + (t.dataset.kbd ? '  ' + kbd(t.dataset.kbd) : '');
      tipEl.hidden = false;
      const r = t.getBoundingClientRect(), w = tipEl.offsetWidth, hh = tipEl.offsetHeight;
      let y = r.bottom + 8;
      if (t.dataset.tipPos === 'top' || y + hh > innerHeight - 6) y = r.top - hh - 8;
      if (t.dataset.tipPos === 'right') { tipEl.style.left = r.right + 10 + 'px'; tipEl.style.top = r.top + r.height / 2 - hh / 2 + 'px'; return; }
      tipEl.style.left = clamp(r.left + r.width / 2 - w / 2, 6, innerWidth - w - 6) + 'px';
      tipEl.style.top = y + 'px';
    }, 420);
  });
  document.addEventListener('pointerdown', () => { clearTimeout(tipT); tipEl.hidden = true; }, true);
}

// ---------- toast ----------
export function toast(msg, opt = {}) {
  let host = $('.toasts');
  if (!host) document.body.append(host = h('div.toasts'));
  const t = h('div.toast.glass-strong', opt.icon ? icon(opt.icon) : null, h('span', msg),
    opt.action ? h('button.btn-text', { onclick: () => { opt.action.run(); close(); } }, opt.action.label) : null);
  host.append(t);
  const close = () => { t.classList.add('out'); setTimeout(() => t.remove(), 220); };
  setTimeout(close, opt.ms || 3200);
  return close;
}

// ---------- popups (menus, popovers) ----------
const stack = [];
export function closePops(level = 0) { while (stack.length > level) stack.pop().close(true); }
document.addEventListener('pointerdown', (e) => {
  if (!stack.length) return;
  for (let i = stack.length - 1; i >= 0; i--) {
    const p = stack[i];
    if (p.el.contains(e.target) || p.anchor?.contains?.(e.target)) { closePops(i + 1); return; }
  }
  closePops(0);
}, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stack.length) { e.stopPropagation(); stack.pop().close(true); } }, true);

export function place(el, anchor, pos = 'bottom-start', gap = 6) {
  const a = anchor instanceof Element ? anchor.getBoundingClientRect() : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y, width: 0, height: 0 };
  const w = el.offsetWidth, hh = el.offsetHeight;
  let x, y;
  const [side, al] = pos.split('-');
  if (side === 'right') { x = a.right + gap; y = a.top; if (x + w > innerWidth - 6) x = a.left - w - gap; }
  else if (side === 'top') { y = a.top - hh - gap; x = al === 'end' ? a.right - w : al === 'center' ? a.left + a.width / 2 - w / 2 : a.left; if (y < 6) y = a.bottom + gap; }
  else { y = a.bottom + gap; x = al === 'end' ? a.right - w : al === 'center' ? a.left + a.width / 2 - w / 2 : a.left; if (y + hh > innerHeight - 6) y = Math.max(6, a.top - hh - gap); }
  el.style.left = clamp(x, 6, innerWidth - w - 6) + 'px';
  el.style.top = clamp(y, 6, Math.max(6, innerHeight - hh - 6)) + 'px';
}

export function popover(anchor, content, opt = {}) {
  if (!opt.keep) closePops(opt.level ?? 0);
  const el = h('div.pop.glass-strong.refract' + (opt.cls ? '.' + opt.cls : ''), { role: 'dialog' }, content);
  document.body.append(el);
  place(el, anchor, opt.pos, opt.gap);
  const p = {
    el, anchor: anchor instanceof Element ? anchor : null,
    close(fromStack) {
      if (!fromStack) { const i = stack.indexOf(p); if (i >= 0) stack.splice(i, 1); }
      el.remove(); opt.onclose?.();
    },
    reposition() { place(el, anchor, opt.pos, opt.gap); },
  };
  stack.push(p);
  return p;
}

// items: {label, icon, kbd, run, sub:[...], sep:true, checked, disabled, danger, hint}
export function menu(anchor, items, opt = {}) {
  const level = opt.level ?? 0;
  const list = h('div.menu', { role: 'menu' });
  let subTimer;
  for (const it of items) {
    if (!it) continue;
    if (it.sep) { list.append(h('div.msep')); continue; }
    if (it.head) { list.append(h('div.mhead', it.head)); continue; }
    const row = h('button.mi' + (it.danger ? '.danger' : '') + (it.sub ? '.has-sub' : ''), {
      type: 'button', role: 'menuitem', disabled: it.disabled,
      onclick: (e) => {
        if (it.sub) { openSub(); return; }
        closePops(0); it.run?.(e);
      },
      onpointerenter: () => { clearTimeout(subTimer); if (it.sub) subTimer = setTimeout(openSub, 160); else subTimer = setTimeout(() => closePops(level + 1), 160); },
    },
    it.checked != null ? icon(it.checked ? 'check' : '', 'sm chk') : (it.icon ? icon(it.icon, 'sm') : h('span.mi-pad')),
    h('span.ml', it.label, it.hint ? h('small', it.hint) : null),
    it.kbd ? h('kbd', kbd(it.kbd)) : null,
    it.sub ? icon('chevron_right', 'sm') : null);
    function openSub() { closePops(level + 1); menu(row, it.sub, { level: level + 1, pos: 'right-start', keep: true }); }
    list.append(row);
  }
  return popover(anchor, list, { pos: opt.pos || 'bottom-start', level, keep: opt.keep, cls: 'menu-pop' });
}

// ---------- dialogs ----------
export function dialog({ title, body, actions = [], width = 460, cls = '', onclose, noClose } = {}) {
  const back = h('div.dlg-back');
  const close = (v) => { back.classList.add('out'); setTimeout(() => back.remove(), 160); onclose?.(v); res(v); };
  let res;
  const promise = new Promise(r => (res = r));
  const box = h('div.dlg.glass-strong.refract' + (cls ? '.' + cls : ''), { role: 'dialog', 'aria-modal': 'true', style: { width: typeof width === 'number' ? width + 'px' : width } },
    title ? h('div.dlg-h', h('h2', title), noClose ? null : ib('close', 'Tutup', () => close())) : null,
    h('div.dlg-b', body),
    actions.length ? h('div.dlg-f', actions.map(a => h('button.btn.' + (a.kind || 'btn-ghost'), { type: 'button', onclick: async () => { const v = await a.run?.(); if (v !== false) close(a.value ?? v); } }, a.icon ? icon(a.icon) : null, a.label))) : null);
  back.append(box);
  back.addEventListener('pointerdown', (e) => { if (e.target === back && !noClose) close(); });
  back.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !noClose) { e.stopPropagation(); close(); } });
  document.body.append(back);
  setTimeout(() => (box.querySelector('[autofocus]') || box.querySelector('input,textarea,select,button.btn-primary'))?.focus(), 30);
  return { el: box, close, then: (...a) => promise.then(...a) };
}

export function confirmDlg(title, text, okLabel = 'Ya', danger) {
  return new Promise(r => dialog({
    title, body: h('p.muted', text), width: 400, onclose: (v) => r(!!v),
    actions: [{ label: 'Batal', value: false }, { label: okLabel, kind: danger ? 'btn-danger' : 'btn-primary', value: true }],
  }));
}
export function promptDlg(title, value = '', label = '') {
  return new Promise(r => {
    const inp = h('input.tx', { value, autofocus: true });
    let done = false;
    const d = dialog({
      title, width: 420, body: h('div.fx', label ? h('label.fx-l', label) : null, inp),
      onclose: (v) => { if (!done) r(v ?? null); },
      actions: [{ label: 'Batal', value: null }, { label: 'Simpan', kind: 'btn-primary', run: () => inp.value }],
    });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { done = true; r(inp.value); d.close(inp.value); } });
    setTimeout(() => inp.select(), 40);
  });
}

// ---------- colors ----------
export function parseColor(c) {
  if (!c) return null;
  c = String(c).trim();
  let m;
  if ((m = /^#([0-9a-f]{3,8})$/i.exec(c))) {
    let x = m[1];
    if (x.length <= 4) x = [...x].map(ch => ch + ch).join('');
    return { r: parseInt(x.slice(0, 2), 16), g: parseInt(x.slice(2, 4), 16), b: parseInt(x.slice(4, 6), 16), a: x.length === 8 ? parseInt(x.slice(6, 8), 16) / 255 : 1 };
  }
  if ((m = /^rgba?\(([^)]+)\)/i.exec(c))) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(parseFloat);
    return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
  }
  const named = { white: '#ffffff', black: '#000000', red: '#ff0000', blue: '#0000ff', green: '#008000', none: null, transparent: '#00000000', currentcolor: null };
  if (c.toLowerCase() in named) return named[c.toLowerCase()] ? parseColor(named[c.toLowerCase()]) : null;
  return null;
}
export const hex2 = (n) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');
export function toHex(c) { const p = typeof c === 'string' ? parseColor(c) : c; if (!p) return null; return '#' + hex2(p.r) + hex2(p.g) + hex2(p.b) + (p.a < 1 ? hex2(p.a * 255) : ''); }
export function luminance(c) {
  const p = parseColor(c); if (!p) return 1;
  const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
  return .2126 * f(p.r) + .7152 * f(p.g) + .0722 * f(p.b);
}
export const isDark = (c) => luminance(c) < .4;
export function rgb2hsv({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let hh = 0;
  if (d) hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (hh * 60 + 360) % 360, s: mx ? d / mx : 0, v: mx };
}
export function hsv2rgb({ h: hh, s, v }) {
  const f = (n) => { const k = (n + hh / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return { r: f(5) * 255, g: f(3) * 255, b: f(1) * 255 };
}
export function mix(a, b, t) {
  const p = parseColor(a), q = parseColor(b);
  return toHex({ r: p.r + (q.r - p.r) * t, g: p.g + (q.g - p.g) * t, b: p.b + (q.b - p.b) * t, a: 1 });
}

export function fmtDate(t) {
  const d = new Date(t), now = new Date(), diff = (now - d) / 1000;
  if (diff < 60) return 'Baru saja';
  if (diff < 3600) return Math.floor(diff / 60) + ' menit lalu';
  if (diff < 86400 && d.getDate() === now.getDate()) return Math.floor(diff / 3600) + ' jam lalu';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

// Drag helper: calls move(dx, dy, e) and end(e) using pointer capture.
export function drag(e, move, end, opt = {}) {
  const sx = e.clientX, sy = e.clientY, t = e.currentTarget || e.target;
  let moved = false;
  try { t.setPointerCapture?.(e.pointerId); } catch {}
  const mv = (ev) => {
    const dx = ev.clientX - sx, dy = ev.clientY - sy;
    if (!moved && Math.hypot(dx, dy) < (opt.threshold ?? 0)) return;
    moved = true; move(dx, dy, ev);
  };
  const up = (ev) => {
    removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    end?.(ev, moved);
  };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}

export function slider({ min = 0, max = 100, step = 1, value = 0, oninput, onchange, label, unit = '', fmt }) {
  const num = h('input.num', { type: 'number', min, max, step, value });
  const rng = h('input.rng', { type: 'range', min, max, step, value });
  const paint = () => rng.style.setProperty('--p', ((rng.value - min) / (max - min) * 100) + '%');
  rng.addEventListener('input', () => { num.value = rng.value; paint(); oninput?.(+rng.value); });
  rng.addEventListener('change', () => onchange?.(+rng.value));
  num.addEventListener('change', () => { const v = clamp(+num.value || 0, min, max); num.value = rng.value = v; paint(); oninput?.(v); onchange?.(v); });
  paint();
  const el = h('div.sld', label ? h('div.sld-h', h('span', label), h('span.sld-v', num, unit ? h('small', unit) : null)) : null, h('div.sld-r', rng, label ? null : num));
  el.set = (v) => { num.value = rng.value = v; paint(); };
  return el;
}
