// Contextual toolbar above the canvas — its contents follow the current selection.
import { E } from './state.js';
import { Canvas } from './canvas.js';
import { Panels } from './panels.js';
import { h, icon, ib, menu, popover, slider, clamp, round } from '../util.js';
import { paintCSS } from '../render.js';
import { loadFont } from '../fonts.js';

let host;
const put = (...a) => host.append(...a.flat().filter(Boolean));
export const Toolbar = {
  mount(el) {
    host = el;
    E.on('sel', render); E.on('change', render); E.on('page', render);
    E.on('textToggle', (k) => toggleText({ b: 'bold', i: 'italic', u: 'underline' }[k]));
    render();
  },
};

const tb = (label, iconName, onclick, opt = {}) => h('button.tb' + (opt.on ? '.on' : '') + (opt.cls ? '.' + opt.cls : ''), { type: 'button', onclick, dataset: opt.tip ? { tip: opt.tip, kbd: opt.kbd || '' } : {}, 'aria-label': opt.tip || label }, iconName ? icon(iconName) : null, label ? h('span', label) : null);
const sep = () => h('span.vsep');
const tog = (iconName, tip, on, fn, kbd) => { const b = ib(iconName, tip, fn, on ? 'on' : ''); if (kbd) b.dataset.kbd = kbd; return b; };
function colorBtn(fill, tip, onclick, text) {
  if (text) return h('button.colbtn.txc', { type: 'button', dataset: { tip }, 'aria-label': tip, onclick }, h('b', 'A'), h('i', { style: { background: paintCSS(fill) } }));
  return h('button.colbtn', { type: 'button', dataset: { tip }, 'aria-label': tip, onclick }, h('i', { style: { background: fill ? paintCSS(fill) : 'repeating-linear-gradient(45deg,#fff 0 4px,#e5484d 4px 5px)' } }));
}

function render() {
  if (!host || !E.d) return;
  host.textContent = '';
  const els = E.selEls();
  const t = E.selType(), one = E.one();
  if (E.crop) { put(h('span.ctx-hint', 'Seret gambar untuk mengatur posisi, tarik sudut untuk memperbesar.'), h('div.ctx-right', h('button.btn.btn-primary.sm', { onclick: () => E.emit('endCrop') }, 'Selesai'))); return; }
  if (!els.length) return pageBar();
  const left = [];
  if (t === 'text') left.push(...textTools(els));
  else if (t === 'shape') left.push(...shapeTools(els));
  else if (t === 'image') left.push(...imageTools(els, one));
  else if (t === 'svg') left.push(...svgTools(els, one));
  else if (t === 'line') left.push(...lineTools(els));
  else if (t === 'path') left.push(colorBtn(els[0].color, 'Warna', () => Panels.open('color', { target: 'color' })), weightBtn(els));
  else if (t === 'chart') left.push(tb('Edit grafik', 'bar_chart', () => Panels.open('chart')), sep(), ...(one ? [colorBtn(one.fg, 'Warna teks', () => Panels.open('color', { target: 'fg' }), true)] : []));
  else if (t === 'table') left.push(...tableTools(els));
  else if (t === 'qr') left.push(tb(one?.kind === 'barcode' ? 'Edit barcode' : 'Edit kode QR', 'qr_code_2', () => Panels.open(one?.kind === 'barcode' ? 'barcode' : 'qr')));
  else left.push(h('span.ctx-hint', `${els.length} elemen dipilih`));
  if (els.length > 1) left.push(sep(), tb(els.every(x => x.gid && x.gid === els[0].gid) ? 'Pisahkan grup' : 'Kelompokkan', 'ad_group', () => (els.every(x => x.gid && x.gid === els[0].gid) ? E.ungroup() : E.group()), { tip: 'Kelompokkan', kbd: 'Ctrl+G' }));
  left.push(sep(), tb('Animasi', 'animation', () => Panels.open('anim'), { on: Panels.cur === 'anim' }));
  const right = h('div.ctx-right',
    tb('Posisi', null, () => Panels.open('pos'), { on: Panels.cur === 'pos' }),
    ib('opacity', 'Transparansi', (e) => opacityPop(e.currentTarget, els)),
    ib('format_paint', 'Salin gaya', () => E.emit('cmd', 'copyStyle')),
    E.styleClip ? ib('colorize', 'Tempel gaya', () => E.emit('cmd', 'pasteStyle')) : null,
    ib(els.every(x => x.lock) ? 'lock' : 'lock_open', els.every(x => x.lock) ? 'Buka kunci' : 'Kunci', () => E.toggleLock()));
  put(...left, right);
}

function pageBar() {
  const p = E.page();
  put(
    colorBtn(p.bg?.fill || '#ffffff', 'Warna latar', () => Panels.open('color', { target: 'bg' })),
    p.bg?.img ? tb('Hapus gambar latar', 'hide_image', () => { delete p.bg.img; Canvas.refreshBg(); E.commit('bg'); }) : null,
    p.bg?.img ? tb('Edit latar', 'tune', () => Panels.open('photo', { bg: true })) : null,
    sep(),
    tb('Animasi halaman', 'animation', () => Panels.open('anim', { page: true })),
    tb('Transisi', 'transition_slide', () => Panels.open('anim', { page: true, tab: 'trans' })),
    h('span.ctx-hint', 'Pilih elemen untuk mengeditnya, atau seret dari panel kiri.'),
    h('div.ctx-right', tb('Gaya desain', 'style', () => Panels.open('design', { tab: 'styles' }))));
}

// ---------- text ----------
function inRange() {
  if (!E.editing) return false;
  const s = getSelection();
  return s.rangeCount && !s.isCollapsed;
}
function toggleText(cmd) {
  const els = E.selEls().filter(x => x.type === 'text'); if (!els.length) return;
  if (inRange()) { document.execCommand(cmd); return; }
  const key = { bold: 'weight', italic: 'italic', underline: 'underline', strikeThrough: 'strike' }[cmd];
  if (key === 'weight') { const on = els.every(x => x.weight >= 600); E.set(x => { x.weight = on ? 400 : 700; x.html = x.html.replace(/<\/?(b|strong)>/gi, ''); }, { els }); }
  else { const on = els.every(x => x[key]); E.set({ [key]: !on }, { els }); }
}
function textTools(els) {
  const e = els[0];
  const fontBtn = h('button.tb.font-btn', { type: 'button', onclick: () => Panels.open('font'), dataset: { tip: 'Font' } }, h('span', { style: { fontFamily: `"${e.font}"` } }, e.font), icon('expand_more', 'sm'));
  loadFont(e.font);
  const sizeIn = h('input', { value: round(e.size, 1), inputMode: 'decimal', 'aria-label': 'Ukuran font' });
  const setSize = (v) => { v = clamp(+v || e.size, 1, 1600); E.set(x => { x.size = round(v, 1); }, { els }); };
  sizeIn.addEventListener('keydown', (k) => { k.stopPropagation(); if (k.key === 'Enter') { setSize(sizeIn.value); sizeIn.blur(); } if (k.key === 'ArrowUp' || k.key === 'ArrowDown') { k.preventDefault(); setSize(+sizeIn.value + (k.key === 'ArrowUp' ? 1 : -1)); } });
  sizeIn.addEventListener('change', () => setSize(sizeIn.value));
  sizeIn.addEventListener('focus', () => { sizeIn.select(); sizeMenu(sizeIn, setSize); });
  const step = (d) => { const s = e.size, n = d > 0 ? (s < 12 ? s + 1 : s < 40 ? s + 2 : Math.round(s * 1.1)) : (s <= 12 ? s - 1 : s <= 40 ? s - 2 : Math.round(s / 1.1)); setSize(Math.max(1, n)); };
  const size = h('div.sz', h('button', { type: 'button', 'aria-label': 'Perkecil font', dataset: { tip: 'Perkecil' }, onclick: () => step(-1) }, icon('remove', 'xs')), sizeIn, h('button', { type: 'button', 'aria-label': 'Perbesar font', dataset: { tip: 'Perbesar' }, onclick: () => step(1) }, icon('add', 'xs')));
  const alignIc = { left: 'format_align_left', center: 'format_align_center', right: 'format_align_right', justify: 'format_align_justify' };
  const nextAlign = { left: 'center', center: 'right', right: 'justify', justify: 'left' };
  return [
    fontBtn, size,
    colorBtn(e.color, 'Warna teks', () => Panels.open('color', { target: 'text' }), true),
    tog('format_bold', 'Tebal', e.weight >= 600, () => toggleText('bold'), 'Ctrl+B'),
    tog('format_italic', 'Miring', e.italic, () => toggleText('italic'), 'Ctrl+I'),
    tog('format_underlined', 'Garis bawah', e.underline, () => toggleText('underline'), 'Ctrl+U'),
    tog('strikethrough_s', 'Coret', e.strike, () => toggleText('strikeThrough')),
    tog('match_case', 'Huruf kapital', e.upper, () => E.set({ upper: !e.upper }, { els })),
    ib(alignIc[e.align] || 'format_align_left', 'Perataan', () => E.set({ align: nextAlign[e.align] || 'left' }, { els })),
    tog(e.list === 'ol' ? 'format_list_numbered' : 'format_list_bulleted', 'Daftar', !!e.list, () => E.set({ list: e.list === '' ? 'ul' : e.list === 'ul' ? 'ol' : '' }, { els })),
    ib('format_line_spacing', 'Spasi', (ev) => spacingPop(ev.currentTarget, els)),
    sep(),
    tb('Efek', 'auto_awesome', () => Panels.open('fx'), { on: Panels.cur === 'fx' }),
  ];
}
function sizeMenu(anchor, set) {
  const sizes = [6, 8, 10, 12, 14, 16, 18, 21, 24, 28, 32, 36, 42, 48, 56, 64, 72, 80, 88, 96, 104, 120, 144, 180, 240];
  const list = h('div.menu', { style: { minWidth: '90px', maxHeight: '300px' } }, sizes.map(s => h('button.mi', { type: 'button', onpointerdown: (ev) => ev.preventDefault(), onclick: () => { set(s); document.activeElement?.blur(); } }, h('span.ml', String(s)))));
  popover(anchor, list, { pos: 'bottom-start', cls: 'menu-pop' });
}
function spacingPop(anchor, els) {
  const e = els[0];
  const body = h('div', { style: { width: '260px', padding: '14px', display: 'grid', gap: '14px' } },
    slider({ label: 'Jarak huruf', min: -200, max: 800, value: e.ls, oninput: (v) => E.set({ ls: v }, { els, commit: false }), onchange: () => E.commit('ls') }),
    slider({ label: 'Jarak baris', min: .5, max: 2.5, step: .01, value: e.lh, oninput: (v) => E.set({ lh: v }, { els, commit: false }), onchange: () => E.commit('lh') }),
    h('div.fx', h('span.fx-l', 'Ketebalan'), weightSelect(els)));
  popover(anchor, body);
}
function weightSelect(els) {
  const names = { 100: 'Tipis', 200: 'Ekstra ringan', 300: 'Ringan', 400: 'Normal', 500: 'Sedang', 600: 'Semi tebal', 700: 'Tebal', 800: 'Ekstra tebal', 900: 'Hitam' };
  const sel = h('select.tx', { onchange: (ev) => E.set({ weight: +ev.target.value }, { els }) }, Object.entries(names).map(([w, n]) => h('option', { value: w }, n)));
  sel.value = String(els[0].weight);
  return sel;
}
export function opacityPop(anchor, els) {
  const body = h('div', { style: { width: '260px', padding: '14px' } },
    slider({ label: 'Transparansi', min: 0, max: 100, value: Math.round((els[0].op ?? 1) * 100), unit: '%', oninput: (v) => E.set({ op: v / 100 }, { els, commit: false, allowLocked: false }), onchange: () => E.commit('op') }));
  popover(anchor, body);
}

// ---------- shape ----------
function shapeTools(els) {
  const e = els[0];
  return [
    colorBtn(e.fill, 'Warna isi', () => Panels.open('color', { target: 'fill', gradient: true })),
    ib('border_style', 'Garis tepi', (ev) => borderPop(ev.currentTarget, els)),
    e.stroke?.w ? colorBtn(e.stroke.c, 'Warna garis tepi', () => Panels.open('color', { target: 'stroke' })) : null,
    sep(),
    tb(e.text ? 'Edit teks' : 'Tambah teks', 'title', () => E.emit('shapeText', e.id)),
    tb('Bayangan', 'shadow', () => Panels.open('shadow')),
    ib('flip', 'Balik', (ev) => flipMenu(ev.currentTarget, els)),
  ];
}
function borderPop(anchor, els) {
  const e = els[0], st = e.stroke || { c: '#1d1d24', w: 0, dash: 'solid' };
  const set = (patch, commit = true) => E.set(x => { x.stroke = { ...(x.stroke || { c: '#1d1d24', w: 0, dash: 'solid' }), ...patch }; if (!x.stroke.w && patch.dash) x.stroke.w = 4; }, { els, commit });
  const kinds = [['none', 'block'], ['solid', 'horizontal_rule'], ['dash', 'line_style'], ['dot', 'more_horiz']];
  const body = h('div', { style: { width: '270px', padding: '14px', display: 'grid', gap: '14px' } },
    h('div.seg.full', kinds.map(([k, ic]) => h('button' + ((k === 'none' ? !st.w : st.w && (st.dash || 'solid') === k) ? '.on' : ''), { type: 'button', dataset: { tip: { none: 'Tidak ada', solid: 'Garis', dash: 'Putus-putus', dot: 'Titik' }[k] }, onclick: (ev) => { if (k === 'none') E.set(x => { x.stroke = null; }, { els }); else set({ dash: k }); ev.currentTarget.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === ev.currentTarget)); } }, icon(ic)))),
    slider({ label: 'Ketebalan', min: 0, max: 60, value: st.w || 0, oninput: (v) => set({ w: v }, false), onchange: () => E.commit('stroke') }),
    e.type === 'shape' && e.shape === 'rect' || e.type === 'image' ? slider({ label: 'Sudut melengkung', min: 0, max: Math.round(Math.min(e.w, e.h) / 2), value: e.radius || 0, oninput: (v) => E.set({ radius: v }, { els, commit: false }), onchange: () => E.commit('radius') }) : null);
  popover(anchor, body);
}
function flipMenu(anchor, els) {
  menu(anchor, [
    { label: 'Balik horizontal', icon: 'flip', run: () => E.set(x => { x.flipX = !x.flipX; }, { els }) },
    { label: 'Balik vertikal', icon: 'flip', run: () => E.set(x => { x.flipY = !x.flipY; }, { els }) },
  ]);
}

// ---------- image ----------
function imageTools(els, one) {
  const e = els[0];
  if (one && !e.src) return [tb('Ganti gambar', 'add_photo_alternate', () => Panels.open('uploads')), h('span.ctx-hint', 'Seret foto ke bingkai ini'), sep(), ib('border_style', 'Garis tepi', (ev) => borderPop(ev.currentTarget, els))];
  return [
    tb('Edit foto', 'tune', () => Panels.open('photo'), { on: Panels.cur === 'photo' }),
    tb('Hapus latar', 'background_replace', () => Panels.open('photo', { tab: 'bg' })),
    one ? tb('Pangkas', 'crop', () => Canvas.startCrop(one.id)) : null,
    ib('flip', 'Balik', (ev) => flipMenu(ev.currentTarget, els)),
    sep(),
    tb('Bentuk', 'interests', () => Panels.open('mask')),
    ib('rounded_corner', 'Sudut & garis tepi', (ev) => borderPop(ev.currentTarget, els)),
    tb('Bayangan', 'shadow', () => Panels.open('shadow')),
  ];
}

// ---------- svg / icons ----------
function svgTools(els, one) {
  const out = [];
  if (one) {
    const cols = svgColors(one);
    if (one.mono || !cols.length) out.push(colorBtn(one.mono || '#000000', 'Warna', () => Panels.open('color', { target: 'mono' })));
    cols.slice(0, 8).forEach(c => out.push(colorBtn(one.colors?.[c] || c, 'Warna', () => Panels.open('color', { target: 'svg:' + c }))));
  }
  out.push(sep(), ib('flip', 'Balik', (ev) => flipMenu(ev.currentTarget, els)), tb('Bayangan', 'shadow', () => Panels.open('shadow')));
  return out;
}
export function svgColors(e) {
  if (e._cols) return e._cols;
  const s = e.svg || '', set = new Set();
  for (const m of s.matchAll(/(?:fill|stroke|stop-color)\s*[=:]\s*["']?(#[0-9a-fA-F]{3,8}|rgb\([^)]+\))/g)) set.add(m[1]);
  const out = [...set].slice(0, 12);
  Object.defineProperty(e, '_cols', { value: out, enumerable: false, configurable: true });
  return out;
}

// ---------- line ----------
function lineTools(els) {
  const e = els[0];
  return [
    colorBtn(e.color, 'Warna garis', () => Panels.open('color', { target: 'color' })),
    ib('line_weight', 'Gaya garis', (ev) => linePop(ev.currentTarget, els)),
    tb('Ujung awal', null, (ev) => capMenu(ev.currentTarget, els, 'start')),
    tb('Ujung akhir', null, (ev) => capMenu(ev.currentTarget, els, 'end')),
  ];
}
function linePop(anchor, els) {
  const e = els[0];
  const body = h('div', { style: { width: '270px', padding: '14px', display: 'grid', gap: '14px' } },
    h('div.seg.full', [['solid', 'horizontal_rule'], ['dash', 'line_style'], ['dot', 'more_horiz']].map(([k, ic]) => h('button' + (e.dash === k ? '.on' : ''), { type: 'button', onclick: (ev) => { E.set({ dash: k }, { els }); ev.currentTarget.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === ev.currentTarget)); } }, icon(ic)))),
    slider({ label: 'Ketebalan', min: 1, max: 80, value: e.weight, oninput: (v) => E.set(x => { x.weight = v; x.h = Math.max(16, v * 3 + 8); }, { els, commit: false }), onchange: () => E.commit('weight') }),
    h('label.sw', h('input', { type: 'checkbox', checked: !!e.round, onchange: (ev) => E.set({ round: ev.target.checked }, { els }) }), h('i'), 'Ujung membulat'));
  popover(anchor, body);
}
function capMenu(anchor, els, which) {
  const caps = [['none', 'Tidak ada'], ['arrow', 'Panah'], ['tri', 'Segitiga'], ['circle', 'Lingkaran'], ['square', 'Kotak'], ['bar', 'Garis']];
  menu(anchor, caps.map(([k, l]) => ({ label: l, checked: els[0][which] === k, run: () => E.set({ [which]: k }, { els }) })));
}
function weightBtn(els) {
  return ib('line_weight', 'Ketebalan', (ev) => popover(ev.currentTarget, h('div', { style: { width: '240px', padding: '14px' } },
    slider({ label: 'Ketebalan', min: 1, max: 60, value: els[0].weight, oninput: (v) => E.set({ weight: v }, { els, commit: false }), onchange: () => E.commit('w') }))));
}

// ---------- table ----------
function tableTools(els) {
  const e = els[0];
  return [
    tb('Edit tabel', 'table', () => Panels.open('table')),
    sep(),
    h('button.tb.font-btn', { type: 'button', onclick: () => Panels.open('font'), dataset: { tip: 'Font' } }, h('span', e.font), icon('expand_more', 'sm')),
    colorBtn(e.color, 'Warna teks', () => Panels.open('color', { target: 'color' }), true),
    colorBtn(e.head, 'Warna kepala', () => Panels.open('color', { target: 'head', none: true })),
    colorBtn(e.cell, 'Warna sel', () => Panels.open('color', { target: 'cell' })),
  ];
}
