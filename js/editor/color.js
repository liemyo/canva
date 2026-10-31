// Colour picking: the side-panel palette (document / brand / default colours, gradients)
// plus a custom HSV picker popover with eyedropper.
import { h, icon, popover, parseColor, toHex, rgb2hsv, hsv2rgb, clamp, drag, toast } from '../util.js';
import { paintCSS } from '../render.js';
import { E } from './state.js';
import { designColors } from '../model.js';
import { Brand } from '../brand.js';

export const DEFAULTS = [
  '#000000', '#545454', '#737373', '#a6a6a6', '#d9d9d9', '#ffffff', '#f4ede4',
  '#ff3131', '#ff5757', '#ff66c4', '#cb6ce6', '#8c52ff', '#5e17eb', '#0097b2',
  '#0cc0df', '#5ce1e6', '#38b6ff', '#5170ff', '#004aad', '#00bf63', '#7ed957',
  '#c1ff72', '#ffde59', '#ffbd59', '#ff914d', '#c0392b', '#7a4a2a', '#1e3a5f',
];
export const GRADIENTS = [
  ['#00c4cc', '#7b3fe4'], ['#ff5fa2', '#ffc86b'], ['#7b3fe4', '#ff5fa2'], ['#00f5a0', '#00d9f5'], ['#f83600', '#f9d423'],
  ['#0f2027', '#2c5364'], ['#fbc2eb', '#a6c1ee'], ['#43e97b', '#38f9d7'], ['#fa709a', '#fee140'], ['#30cfd0', '#330867'],
  ['#ff9a9e', '#fad0c4'], ['#a18cd1', '#fbc2eb'], ['#0ba360', '#3cba92'], ['#000000', '#434343'],
];
const RECENT_KEY = 'adesign.recentColors';
const recent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } };
export function pushRecent(c) {
  if (typeof c !== 'string') return;
  const r = [c, ...recent().filter(x => x !== c)].slice(0, 14);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(r)); } catch {}
}

const sameColor = (a, b) => typeof a === 'string' && typeof b === 'string' && (toHex(a) || '').slice(0, 7) === (toHex(b) || '').slice(0, 7);

function swatch(c, cur, pick, title) {
  const isGrad = typeof c === 'object';
  return h('button.swatch' + (isGrad ? '.grad' : '') + (!isGrad && sameColor(c, cur) ? '.on' : ''), {
    type: 'button', 'aria-label': title || (isGrad ? 'Gradasi' : c), dataset: { tip: title || (isGrad ? 'Gradasi' : c.toUpperCase()) },
    style: { background: paintCSS(c) }, onclick: () => pick(c),
  });
}

// Side-panel colour chooser. opts: { gradient: bool, none: bool, title }
export function colorPanel(cur, onPick, opts = {}) {
  const pick = (c) => { if (typeof c === 'string') pushRecent(c); onPick(c); render(); };
  const root = h('div.pn-sec');
  const render = () => {
    root.textContent = '';
    const custom = h('button.swatch.add', { type: 'button', 'aria-label': 'Warna baru', dataset: { tip: 'Warna baru' }, onclick: (e) => colorPopover(e.currentTarget, typeof cur === 'string' ? cur : '#7b3fe4', (c) => { cur = c; onPick(c); }, { onDone: (c) => { pushRecent(c); render(); } }) });
    const docCols = designColors(E.d).slice(0, 13);
    root.append(
      h('div.pn-sec-h', h('b', 'Warna dokumen')),
      h('div.swatches', custom, opts.none ? h('button.swatch.none', { type: 'button', dataset: { tip: 'Tanpa warna' }, onclick: () => pick(null) }) : null, docCols.map(c => swatch(c, cur, pick))),
    );
    const rec = recent();
    if (rec.length) root.append(h('div.pn-sec-h', h('b', 'Baru dipakai')), h('div.swatches', rec.map(c => swatch(c, cur, pick))));
    const brand = Brand.colors();
    if (brand.length) root.append(h('div.pn-sec-h', h('b', 'Warna merek'), h('button', { onclick: () => E.emit('cmd', 'panel:brand') }, 'Kelola')), h('div.swatches', brand.map(c => swatch(c, cur, pick))));
    root.append(h('div.pn-sec-h', h('b', 'Warna default')), h('div.swatches', DEFAULTS.map(c => swatch(c, cur, pick))));
    if (opts.gradient) {
      root.append(h('div.pn-sec-h', h('b', 'Gradasi')), h('div.swatches', GRADIENTS.map(([a, b]) => swatch({ t: 'linear', a: 135, stops: [[a, 0], [b, 1]] }, cur, pick))));
      if (cur && typeof cur === 'object') root.append(gradEditor(cur, (g) => { cur = g; onPick(g); }));
    }
    if (window.EyeDropper) root.append(h('button.btn.btn-ghost.block', { type: 'button', onclick: async () => { try { const r = await new EyeDropper().open(); pick(r.sRGBHex); } catch {} } }, icon('colorize'), 'Ambil warna dari layar'));
  };
  render();
  return root;
}

function gradEditor(g, onChange) {
  const wrap = h('div.pn-sec');
  const draw = () => {
    wrap.textContent = '';
    wrap.append(h('div.pn-sec-h', h('b', 'Atur gradasi')),
      h('div', { style: { height: '28px', borderRadius: '8px', background: paintCSS(g), boxShadow: 'inset 0 0 0 1px var(--line2)' } }),
      h('div.row', g.stops.map((s, i) => h('button.swatch', { type: 'button', style: { width: '34px', background: s[0] }, dataset: { tip: 'Warna ' + (i + 1) }, onclick: (e) => colorPopover(e.currentTarget, s[0], (c) => { s[0] = c; onChange({ ...g }); draw(); }) })),
        h('span.grow'),
        h('div.seg', ['linear', 'radial'].map(t => h('button' + (g.t === t ? '.on' : ''), { type: 'button', onclick: () => { g.t = t; onChange({ ...g }); draw(); } }, t === 'linear' ? 'Linear' : 'Radial')))),
      g.t === 'linear' ? h('div.row', h('span.small.muted', 'Sudut'), h('input.rng', { type: 'range', min: 0, max: 360, value: g.a ?? 90, style: { '--p': ((g.a ?? 90) / 3.6) + '%' }, oninput: (e) => { g.a = +e.target.value; e.target.style.setProperty('--p', g.a / 3.6 + '%'); onChange({ ...g }); } })) : null);
  };
  draw();
  return wrap;
}

// Custom picker popover: SV area, hue, alpha, hex.
export function colorPopover(anchor, value, onChange, opt = {}) {
  let p = parseColor(value) || { r: 123, g: 63, b: 228, a: 1 };
  let hsv = rgb2hsv(p), a = p.a ?? 1;
  const sv = h('div.cp-sv'), dot = h('i.cp-dot'), hue = h('div.cp-hue'), hk = h('i.cp-knob'), al = h('div.cp-alpha'), alI = h('i'), ak = h('i.cp-knob');
  sv.append(dot); hue.append(hk); al.append(alI, ak);
  const hex = h('input', { maxLength: 9, spellcheck: false });
  const prev = h('i', { style: { width: '34px', height: '34px', borderRadius: '8px', flex: 'none', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.15)' } });
  const out = () => { const c = hsv2rgb(hsv); return toHex({ ...c, a }); };
  const paint = (emit = true) => {
    const base = toHex(hsv2rgb({ h: hsv.h, s: 1, v: 1 }));
    sv.style.background = base;
    dot.style.left = hsv.s * 100 + '%'; dot.style.top = (1 - hsv.v) * 100 + '%';
    hk.style.left = hsv.h / 360 * 100 + '%';
    const solid = toHex(hsv2rgb(hsv));
    alI.style.background = `linear-gradient(90deg, transparent, ${solid})`;
    ak.style.left = a * 100 + '%';
    const c = out();
    prev.style.background = c;
    if (document.activeElement !== hex) hex.value = c.toUpperCase();
    if (emit) onChange(c);
  };
  const track = (el, fn) => el.addEventListener('pointerdown', (e) => {
    const r = el.getBoundingClientRect();
    const f = (ev) => { fn(clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1)); paint(); };
    f(e); drag(e, (dx, dy, ev) => f(ev), () => opt.onDone?.(out()));
  });
  track(sv, (x, y) => { hsv.s = x; hsv.v = 1 - y; });
  track(hue, (x) => { hsv.h = x * 360; });
  track(al, (x) => { a = Math.round(x * 100) / 100; });
  hex.addEventListener('change', () => { const q = parseColor(hex.value.startsWith('#') ? hex.value : '#' + hex.value); if (q) { hsv = rgb2hsv(q); a = q.a ?? 1; paint(); opt.onDone?.(out()); } else toast('Kode warna tidak valid'); });
  const eye = window.EyeDropper ? h('button.ib.sm', { type: 'button', dataset: { tip: 'Pipet' }, onclick: async () => { try { const r = await new EyeDropper().open(); const q = parseColor(r.sRGBHex); hsv = rgb2hsv(q); paint(); opt.onDone?.(out()); } catch {} } }, icon('colorize')) : null;
  const body = h('div.cp', sv, hue, opt.alpha === false ? null : al, h('div.cp-row', prev, hex, eye));
  paint(false);
  return popover(anchor, body, { pos: opt.pos || 'right-start', level: opt.level ?? 0, keep: opt.keep, onclose: () => opt.onDone?.(out()) });
}
