// Left rail + side panel: templates, elements, text, brand, uploads, draw, photos, projects, apps.
import { E } from './state.js';
import { Canvas } from './canvas.js';
import { addText, insertAsset, insertURL } from './editor.js';
import { h, icon, ib, toast, menu, debounce, pickFiles, clamp, confirmDlg, uid, esc } from '../util.js';
import { thumb } from '../render.js';
import { TEMPLATES, templatesByAspect, scaleEls } from '../templates.js';
import { shapeEl, lineEl, frameEl, textEl, chartEl, tableEl, cloneEls, bbox, designColors, imageEl } from '../model.js';
import { SHAPES, MASKS, shapePath } from '../shapes.js';
import { Store } from '../store.js';
import { addAsset, assetURL } from '../assets.js';
import { Brand } from '../brand.js';
import { PAIRS, loadFont, fontStack } from '../fonts.js';
import { translate } from '../lexicon.js';
import { drawPanel, stopDraw } from './draw.js';

const reg = {};
export const Panels = {
  cur: null, opts: {},
  register(name, def) { reg[name] = def; },
  mount(rail, panel) {
    this.rail = rail; this.panel = panel;
    panel.classList.add('closed');
    for (const [k, l, ic, cls] of RAIL) {
      rail.append(h('button' + (cls ? '.' + cls : ''), { type: 'button', dataset: { k }, onclick: () => this.open(this.cur === k ? null : k) }, h('span.r-ic', icon(ic)), l));
    }
    E.on('sel', () => {
      // Contextual panels close when nothing that they edit is selected.
      const def = reg[this.cur];
      if (def?.ctx && !def.keep?.(this.opts)) {
        if (!E.sel.length && !(this.cur === 'color' && this.opts.target === 'bg') && !(this.cur === 'anim' && this.opts.page) && !(this.cur === 'photo' && this.opts.bg)) this.open(null);
        else if (def.refresh !== false) this.open(this.cur, this.opts, true);
      }
    });
    E.on('uploads', () => { if (this.cur === 'uploads') this.open('uploads', {}, true); });
    E.on('insertCombo', ({ spec, at }) => { const c = COMBOS.find(x => x.n === spec.name); if (c) E.add(comboEls(c), { at }); });
    E.on('insertSvg', ({ spec, at }) => insertSvg(spec, at));
  },
  open(name, opts = {}, refresh) {
    if (this.cur === 'draw' && name !== 'draw') stopDraw();
    if (!name || !reg[name]) {
      this.cur = null; this.panel.classList.add('closed'); this.panel.textContent = '';
      this.rail.querySelectorAll('button').forEach(b => b.classList.remove('on'));
      E.emit('panel'); return;
    }
    const keepScroll = refresh ? this.panel.querySelector('.pn-b')?.scrollTop : 0;
    this.cur = name; this.opts = opts;
    const def = reg[name];
    this.rail.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === name || (def.rail && b.dataset.k === def.rail)));
    const body = h('div.pn-b');
    const head = h('div.pn-h', def.back ? ib('arrow_back', 'Kembali', () => this.open(def.back), 'sm') : null, h('h3', typeof def.title === 'function' ? def.title(opts) : def.title), ib('close', 'Tutup panel', () => this.open(null), 'sm'));
    this.panel.textContent = '';
    this.panel.append(head, body);
    this.panel.classList.remove('closed');
    def.render(body, opts);
    if (keepScroll) body.scrollTop = keepScroll;
    E.emit('panel');
  },
};

const RAIL = [
  ['design', 'Desain', 'space_dashboard'], ['elements', 'Elemen', 'interests'], ['text', 'Teks', 'text_fields'],
  ['brand', 'Merek', 'verified'], ['uploads', 'Unggahan', 'cloud_upload'], ['draw', 'Gambar', 'draw'],
  ['photos', 'Foto', 'photo_library'], ['projects', 'Proyek', 'folder_open'], ['apps', 'Aplikasi', 'apps', 'magic'],
];

const sec = (title, more, ...kids) => h('div.pn-sec', h('div.pn-sec-h', h('b', title), more ? h('button', { type: 'button', onclick: more }, 'Lihat semua') : null), ...kids);
function searchBox(ph, onSearch, value = '') {
  const inp = h('input', { type: 'search', placeholder: ph, value, enterKeyHint: 'search' });
  inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') onSearch(inp.value.trim()); });
  inp.addEventListener('input', debounce(() => onSearch(inp.value.trim()), 450));
  return h('label.search', icon('search'), inp);
}
// Make a tile draggable onto the canvas and clickable to insert.
function dragSpec(el, spec, onClick) {
  el.draggable = true;
  el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('application/x-amatu', JSON.stringify(spec)); e.dataTransfer.effectAllowed = 'copy'; });
  el.addEventListener('click', onClick);
  return el;
}

// ======================= Design (templates + styles) =======================
Panels.register('design', {
  title: 'Desain',
  render(b, o) {
    const tab = o.tab || 'tpl';
    b.append(h('div.pn-tabs', [['tpl', 'Template'], ['styles', 'Gaya']].map(([k, l]) => h('button' + (tab === k ? '.on' : ''), { type: 'button', onclick: () => Panels.open('design', { tab: k }) }, l))));
    if (tab === 'styles') return stylesTab(b);
    const list = h('div.g2');
    const fill = (q) => {
      list.textContent = '';
      const ql = (q || '').toLowerCase();
      let ts = ql ? TEMPLATES.filter(t => (t.name + ' ' + t.tags).toLowerCase().includes(ql) || ql.split(/\s+/).some(w => w && t.tags.includes(w))) : templatesByAspect(E.d.w, E.d.h);
      const other = ql ? [] : TEMPLATES.filter(t => !ts.includes(t));
      const card = (t) => {
        const pages = t.build();
        const c = h('button.tpl-card', { type: 'button' }, thumb(pages[0], t, 150, 190), h('small', t.name + (pages.length > 1 ? ` · ${pages.length} hlm` : '')));
        c.onclick = () => applyTemplate(t);
        return c;
      };
      if (ts.length) { list.append(...ts.map(card)); }
      else if (ql) list.append(h('p.muted.small', 'Tidak ada template yang cocok.'));
      if (other.length) {
        list.append(h('div.pn-sec-h', { style: { gridColumn: '1/-1', marginTop: '8px' } }, h('b', 'Ukuran lain')));
        list.append(...other.map(card));
      }
    };
    b.append(searchBox('Cari template', fill), list);
    fill('');
  },
});
export function applyTemplate(t) {
  const pages = t.build();
  const W = E.d.w, H = E.d.h;
  if (t.w !== W || t.h !== H) {
    const k = Math.min(W / t.w, H / t.h), ox = (W - t.w * k) / 2, oy = (H - t.h * k) / 2;
    pages.forEach(p => { scaleEls(p.els, k); p.els.forEach(e => { e.x += ox; e.y += oy; }); });
  }
  const cur = E.page();
  if (!cur.els.length) {
    E.d.pages.splice(E.pi, 1, ...pages);
  } else {
    E.d.pages.splice(E.pi + 1, 0, ...pages);
    E.pi++;
  }
  E.sel = [];
  Canvas.build(); E.commit('template'); E.emit('page'); E.emit('sel');
  setTimeout(() => Canvas.scrollToPage(E.pi), 40);
  toast(pages.length > 1 ? `Template diterapkan (${pages.length} halaman)` : 'Template diterapkan', { icon: 'auto_awesome' });
}
const PALETTES = [
  ['Senja', ['#2a1a0e', '#f2c48d', '#efe3d6', '#b4846c', '#ffffff']], ['Samudra', ['#0b1220', '#2dd4bf', '#7b3fe4', '#94a3b8', '#ffffff']],
  ['Hutan', ['#0b3d2e', '#d4b26a', '#f5eedb', '#5a7d2a', '#ffffff']], ['Pop', ['#ff4d2e', '#ffd23f', '#17110f', '#fff4e0', '#3a86ff']],
  ['Pastel', ['#cdb4db', '#ffc8dd', '#ffafcc', '#bde0fe', '#a2d2ff']], ['Monokrom', ['#111111', '#444444', '#888888', '#dddddd', '#ffffff']],
  ['Korporat', ['#1d4ed8', '#0f172a', '#64748b', '#f1f5f9', '#ffffff']], ['Neon', ['#07060f', '#ff2bd6', '#00e5ff', '#a5f3fc', '#ffffff']],
  ['Bumi', ['#3d2c22', '#b4846c', '#f1ece4', '#7a5c49', '#e9dcb8']], ['Ceria', ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#073b4c']],
];
function stylesTab(b) {
  b.append(sec('Palet warna', null, h('p.small.muted', { style: { margin: 0 } }, 'Klik untuk mewarnai ulang seluruh desain. Klik lagi untuk mengacak.'),
    h('div.g2', PALETTES.map(([n, cs]) => h('button.tile', { type: 'button', style: { aspectRatio: 'auto', padding: '10px', display: 'grid', gap: '6px', justifyItems: 'start' }, onclick: () => applyPalette(cs) },
      h('div', { style: { display: 'flex', width: '100%', height: '26px', borderRadius: '7px', overflow: 'hidden' } }, cs.map(c => h('i', { style: { flex: 1, background: c } }))), h('small', n))))));
  b.append(sec('Kombinasi font', null, h('div.g2', PAIRS.slice(0, 12).map(([a, c]) => {
    loadFont(a); loadFont(c);
    return h('button.tile', { type: 'button', style: { aspectRatio: 'auto', padding: '12px 10px', display: 'grid', gap: '2px', textAlign: 'left', justifyItems: 'start' }, onclick: () => applyFonts(a, c) },
      h('b', { style: { fontFamily: fontStack(a), fontSize: '19px', color: 'var(--tx)', lineHeight: 1.1 } }, a), h('small', { style: { fontFamily: fontStack(c), color: 'var(--tx3)' } }, c));
  }))));
}
let palShift = 0, lastPal = null;
function applyPalette(cs) {
  if (lastPal === cs) palShift++; else { palShift = 0; lastPal = cs; }
  const used = designColors(E.d), map = new Map();
  used.forEach((c, i) => map.set(c, cs[(i + palShift) % cs.length]));
  const sw = (c) => (typeof c === 'string' && map.get(c.toLowerCase().slice(0, 7))) || c;
  const swf = (f) => (!f ? f : typeof f === 'string' ? sw(f) : { ...f, stops: f.stops.map(([c, p]) => [sw(c), p]) });
  for (const p of E.d.pages) {
    p.bg.fill = swf(p.bg.fill);
    for (const e of p.els) {
      if (e.fill !== undefined) e.fill = swf(e.fill);
      if (e.color) e.color = sw(e.color);
      if (e.stroke?.c) e.stroke.c = sw(e.stroke.c);
      if (e.type === 'text') e.html = e.html.replace(/#[0-9a-f]{6}/gi, m => sw(m));
      if (e.type === 'chart') { e.colors = e.colors.map(sw); e.fg = sw(e.fg); }
      if (e.type === 'table') ['head', 'headColor', 'cell', 'stripe', 'border'].forEach(k => (e[k] = sw(e[k])));
      if (e.type === 'svg' && e.colors) for (const k of Object.keys(e.colors)) e.colors[k] = sw(e.colors[k]);
    }
  }
  Canvas.build(); E.commit('palette');
}
function applyFonts(head, body) {
  const texts = E.d.pages.flatMap(p => p.els.filter(e => e.type === 'text'));
  if (!texts.length) return toast('Belum ada teks di desain');
  const sizes = texts.map(e => e.size).sort((a, b) => b - a), cut = sizes[Math.floor(sizes.length * .34)] || sizes[0];
  loadFont(head); loadFont(body);
  texts.forEach(e => (e.font = e.size >= cut ? head : body));
  Canvas.build(); E.commit('fonts');
}

// ======================= Elements =======================
const ICON_SETS = 'ph,mdi,tabler,lucide,solar,material-symbols,ri,iconoir,mingcute,heroicons';
const STICKER_SETS = 'fluent-emoji-flat,noto,twemoji,openmoji,flat-color-icons,streamline-emojis,emojione';
const ICON_CATS = [['Populer', 'star'], ['Bisnis', 'business'], ['Panah', 'arrow'], ['Media sosial', 'social'], ['Makanan', 'food'], ['Cuaca', 'weather'], ['Pendidikan', 'school'], ['Teknologi', 'computer'], ['Perjalanan', 'travel'], ['Alam', 'leaf'], ['Hati', 'heart'], ['Belanja', 'shopping']];
const STICKER_CATS = [['Emoji', 'smile'], ['Pesta', 'party'], ['Makanan', 'food'], ['Hewan', 'animal'], ['Alam', 'flower'], ['Olahraga', 'sport'], ['Kantor', 'office'], ['Perjalanan', 'travel']];

Panels.register('elements', {
  title: 'Elemen',
  render(b, o) {
    const results = h('div');
    const doSearch = (q) => { if (!q) { results.textContent = ''; home.hidden = false; return; } home.hidden = true; iconSearch(results, q); };
    const home = h('div', { style: { display: 'grid', gap: '18px' } });
    b.append(searchBox('Cari ikon, grafik, stiker…', doSearch, o.q || ''), results, home);
    if (o.q) doSearch(o.q);
    const shapeKeys = ['rect', 'rounded', 'circle', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'star4', 'heart', 'arrow', 'burst', 'blob1', 'bubble', 'pill', 'arch', 'cloud', 'plus'];
    home.append(sec('Garis & bentuk', () => Panels.open('shapes'),
      h('div.g4', lineTiles().slice(0, 4)),
      h('div.g4', shapeKeys.slice(0, 12).map(shapeTile))));
    home.append(sec('Grafis & stiker', () => Panels.open('elements', { q: 'party sticker' }), h('div.hscroll', STICKER_CATS.map(([l, q]) => h('button.chip', { type: 'button', onclick: () => iconSearchPanel(q, STICKER_SETS, l) }, l))), stickerRow()));
    home.append(sec('Ikon', null, h('div.hscroll', ICON_CATS.map(([l, q]) => h('button.chip', { type: 'button', onclick: () => iconSearchPanel(q, ICON_SETS, l) }, l))), iconRow()));
    home.append(sec('Bingkai', () => Panels.open('frames'), h('div.g4', Object.keys(MASKS).slice(0, 8).map(frameTile))));
    home.append(sec('Kisi foto', () => Panels.open('grids'), h('div.g3', GRIDS.slice(0, 6).map(gridTile))));
    home.append(sec('Grafik data', null, h('div.g4', [['bar', 'bar_chart'], ['line', 'show_chart'], ['pie', 'pie_chart'], ['donut', 'donut_large'], ['hbar', 'align_horizontal_left'], ['area', 'area_chart'], ['stack', 'stacked_bar_chart'], ['ring', 'progress_activity']].map(([k, ic]) =>
      dragSpec(h('button.tile', { type: 'button', dataset: { tip: { bar: 'Batang', line: 'Garis', pie: 'Pai', donut: 'Donat', hbar: 'Batang horizontal', area: 'Area', stack: 'Bertumpuk', ring: 'Progres' }[k] } }, icon(ic)), { kind: 'els', els: [chartFor(k)] }, () => { const [el] = E.add(chartFor(k), { at: Canvas.centerOfView() }); Panels.open('chart'); void el; })))));
    home.append(sec('Tabel', null, h('div.g3', [[2, 2], [3, 3], [4, 3]].map(([r, c]) => dragSpec(h('button.tile', { type: 'button', style: { aspectRatio: '1.4' } }, tableIcon(r, c)), { kind: 'els', els: [tableFor(r, c)] }, () => E.add(tableFor(r, c), { at: Canvas.centerOfView() }))))));
    home.append(sec('Perangkat & mockup', null, h('div.g3', DEVICES.map(deviceTile))));
  },
});
function lineTiles() {
  const L = [['Garis', {}], ['Panah', { end: 'arrow' }], ['Putus-putus', { dash: 'dash' }], ['Titik', { dash: 'dot', round: true }], ['Panah ganda', { start: 'tri', end: 'tri' }], ['Konektor', { start: 'circle', end: 'circle' }], ['Tebal', { weight: 14, h: 50 }], ['Batas', { start: 'bar', end: 'bar' }]];
  return L.map(([n, o]) => {
    const mk = () => lineEl({ ...o, w: Math.min(E.d.w * .4, 400), weight: o.weight || Math.max(3, Math.round(E.d.w / 300)) });
    const svg = `<svg viewBox="0 0 60 20"><line x1="${o.start ? 9 : 4}" y1="10" x2="${o.end ? 51 : 56}" y2="10" stroke="currentColor" stroke-width="${o.weight ? 5 : 2.5}" ${o.dash === 'dash' ? 'stroke-dasharray="6 4"' : o.dash === 'dot' ? 'stroke-dasharray="0.1 5" stroke-linecap="round"' : ''}/>${o.end === 'arrow' ? '<path d="M48 5 56 10 48 15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>' : ''}${o.end === 'tri' ? '<path d="M50 5 58 10 50 15Z M10 5 2 10 10 15Z" fill="currentColor"/>' : ''}${o.end === 'circle' ? '<circle cx="5" cy="10" r="4" fill="currentColor"/><circle cx="55" cy="10" r="4" fill="currentColor"/>' : ''}${o.end === 'bar' ? '<path d="M4 4v12M56 4v12" stroke="currentColor" stroke-width="2.5"/>' : ''}</svg>`;
    return dragSpec(h('button.tile', { type: 'button', dataset: { tip: n }, html: svg, style: { aspectRatio: '1.6', padding: '10px' } }), { kind: 'els', els: [mk()] }, () => E.add(mk(), { at: Canvas.centerOfView() }));
  });
}
function shapeTile(k) {
  const mk = () => { const s = Math.min(E.d.w, E.d.h) * .3; const w = ['arrow', 'arrowL', 'arrow2', 'pill', 'pentArrow', 'chevron', 'ticket', 'parallelogram'].includes(k) ? s * 1.6 : s; return shapeEl(k, { w, h: s, fill: '#c9c4d8' }); };
  const w = 60, hh = ['arrow', 'arrowL', 'arrow2', 'pill', 'pentArrow', 'chevron', 'ticket', 'parallelogram'].includes(k) ? 38 : 60;
  const svg = `<svg viewBox="-2 -2 64 64"><path d="${shapePath(k, w, hh, k === 'rect' ? 0 : 0)}" transform="translate(0 ${(60 - hh) / 2})" fill="#bdb6cf" ${SHAPES[k]?.evenodd ? 'fill-rule="evenodd"' : ''}/></svg>`;
  return dragSpec(h('button.tile', { type: 'button', dataset: { tip: SHAPES[k]?.name || k }, html: svg }), { kind: 'els', els: [mk()] }, () => E.add(mk(), { at: Canvas.centerOfView() }));
}
Panels.register('shapes', { title: 'Garis & bentuk', back: 'elements', rail: 'elements', render(b) {
  b.append(sec('Garis', null, h('div.g4', lineTiles())), sec('Bentuk', null, h('div.g4', Object.keys(SHAPES).map(shapeTile))));
} });
function frameTile(k) {
  const mk = () => { const s = Math.min(E.d.w, E.d.h) * .4; return frameEl(k, { w: k === 'arch' || k === 'drop' ? s * .8 : k === 'pill' ? s * 1.6 : s, h: s }); };
  const isW = k === 'pill', w = isW ? 60 : (k === 'arch' || k === 'drop' ? 48 : 60), hh = isW ? 36 : 60;
  const d = k === 'rect' ? 'M0 0H60V60H0Z' : k === 'circle' ? shapePath('circle', 60, 60) : shapePath(k, w, hh, k === 'rounded' ? 10 : 0);
  const svg = `<svg viewBox="-2 -2 64 64"><path d="${d}" transform="translate(${(60 - w) / 2} ${(60 - hh) / 2})" fill="#d9d4e6" stroke="#bdb6cf" stroke-width="1.5"/><path d="M${18 + (60 - w) / 2} ${40} l8 -10 6 7 4 -4 8 7z" fill="#a49cbd"/></svg>`;
  return dragSpec(h('button.tile', { type: 'button', dataset: { tip: 'Bingkai ' + (MASKS[k] || '').toLowerCase() }, html: svg }), { kind: 'els', els: [mk()] }, () => E.add(mk(), { at: Canvas.centerOfView() }));
}
Panels.register('frames', { title: 'Bingkai', back: 'elements', rail: 'elements', render(b) {
  b.append(h('p.small.muted', { style: { margin: 0 } }, 'Tambahkan bingkai, lalu seret foto ke dalamnya.'), h('div.g4', Object.keys(MASKS).map(frameTile)));
} });
// Grids: [name, cells as [x,y,w,h] in 0..1]
const G = (n, cells) => [n, cells];
const GRIDS = [
  G('2 kolom', [[0, 0, .5, 1], [.5, 0, .5, 1]]), G('2 baris', [[0, 0, 1, .5], [0, .5, 1, .5]]), G('3 kolom', [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]]),
  G('4 kotak', [[0, 0, .5, .5], [.5, 0, .5, .5], [0, .5, .5, .5], [.5, .5, .5, .5]]), G('1 + 2', [[0, 0, .6, 1], [.6, 0, .4, .5], [.6, .5, .4, .5]]), G('2 + 1', [[0, 0, .5, .5], [.5, 0, .5, .5], [0, .5, 1, .5]]),
  G('1 + 3', [[0, 0, 1, .6], [0, .6, 1 / 3, .4], [1 / 3, .6, 1 / 3, .4], [2 / 3, .6, 1 / 3, .4]]), G('Mozaik', [[0, 0, .5, .66], [.5, 0, .5, .33], [.5, .33, .5, .33], [0, .66, .5, .34], [.5, .66, .5, .34]]), G('6 kotak', [[0, 0, 1 / 3, .5], [1 / 3, 0, 1 / 3, .5], [2 / 3, 0, 1 / 3, .5], [0, .5, 1 / 3, .5], [1 / 3, .5, 1 / 3, .5], [2 / 3, .5, 1 / 3, .5]]),
];
function gridEls([, cells], gap = 0) {
  const W = E.d.w, H = E.d.h, g = uid('g');
  return cells.map(([x, y, w, hh]) => frameEl('rect', { x: x * W + gap / 2, y: y * H + gap / 2, w: w * W - gap, h: hh * H - gap, gid: g }));
}
function gridTile(gd) {
  const svg = `<svg viewBox="0 0 60 60">${gd[1].map(([x, y, w, hh]) => `<rect x="${x * 60 + 1.5}" y="${y * 60 + 1.5}" width="${w * 60 - 3}" height="${hh * 60 - 3}" rx="2" fill="#d9d4e6"/>`).join('')}</svg>`;
  return h('button.tile', { type: 'button', dataset: { tip: gd[0] }, html: svg, onclick: () => { const els = gridEls(gd, Math.round(Math.min(E.d.w, E.d.h) * .012)); E.page().els.push(...els); Canvas.build(); E.select(els.map(e => e.id), { raw: true }); E.commit('grid'); } });
}
Panels.register('grids', { title: 'Kisi foto', back: 'elements', rail: 'elements', render(b) {
  b.append(h('p.small.muted', { style: { margin: 0 } }, 'Kisi mengisi seluruh halaman. Seret foto ke setiap kotak.'), h('div.g3', GRIDS.map(gridTile)));
} });
function chartFor(k) {
  const W = E.d.w, s = Math.min(W, E.d.h) * .55;
  const base = chartEl(k, { w: s * 1.4, h: s });
  if (k === 'pie' || k === 'donut') { base.data = [['Produk A', 42], ['Produk B', 28], ['Produk C', 18], ['Lainnya', 12]]; base.series = ['Porsi']; base.w = s * 1.3; }
  if (k === 'ring') { base.data = [['Selesai', 72]]; base.series = ['Progres']; base.w = s; }
  if (k === 'line' || k === 'area' || k === 'stack' || k === 'bar') { /* two series default */ }
  return base;
}
function tableFor(r, c) { const W = E.d.w; return tableEl(r, c, { w: W * .5, size: Math.max(12, Math.round(W / 60)) }); }
function tableIcon(r, c) {
  return h('span', { html: `<svg viewBox="0 0 60 40"><rect x="1" y="1" width="58" height="38" rx="3" fill="none" stroke="#a49cbd" stroke-width="1.5"/>${Array.from({ length: c - 1 }, (_, i) => `<line x1="${(i + 1) * 60 / c}" y1="1" x2="${(i + 1) * 60 / c}" y2="39" stroke="#a49cbd"/>`).join('')}${Array.from({ length: r - 1 }, (_, i) => `<line x1="1" y1="${(i + 1) * 40 / r}" x2="59" y2="${(i + 1) * 40 / r}" stroke="#a49cbd"/>`).join('')}<rect x="1" y="1" width="58" height="${40 / r}" fill="#a49cbd" opacity=".5"/></svg>`, style: { width: '100%' } });
}
// Device mockups built from shapes + an image frame (grouped).
const DEVICES = [
  ['Ponsel', 'smartphone', (s) => { const w = s * .5, hh = s; const g = uid('g'); return [shapeEl('rect', { w: w, h: hh, radius: w * .14, fill: '#111318', gid: g }), frameEl('rounded', { x: w * .05, y: w * .05, w: w * .9, h: hh - w * .1, radius: w * .1, mask: 'rect', gid: g }), shapeEl('pill', { x: w * .35, y: w * .07, w: w * .3, h: w * .06, fill: '#111318', gid: g })]; }],
  ['Laptop', 'laptop_mac', (s) => { const w = s * 1.5, hh = w * .62; const g = uid('g'); return [shapeEl('rect', { w: w * .84, h: hh * .9, x: w * .08, radius: w * .025, fill: '#1c1e24', gid: g }), frameEl('rect', { x: w * .105, y: w * .025, w: w * .79, h: hh * .9 - w * .05, gid: g }), shapeEl('trapezoid', { x: 0, y: hh * .9, w, h: hh * .1, fill: '#c7c9d1', gid: g, flipY: true })]; }],
  ['Browser', 'web', (s) => { const w = s * 1.5, hh = w * .66, g = uid('g'), bar = hh * .09; return [shapeEl('rect', { w, h: hh, radius: w * .02, fill: '#eceef3', gid: g }), ...[0, 1, 2].map(i => shapeEl('circle', { x: bar * .45 + i * bar * .55, y: bar * .32, w: bar * .36, h: bar * .36, fill: ['#ff5f57', '#febc2e', '#28c840'][i], gid: g })), frameEl('rect', { x: 0, y: bar, w, h: hh - bar, gid: g })]; }],
];
function deviceTile([n, ic, mk]) {
  return h('button.tile', { type: 'button', dataset: { tip: 'Mockup ' + n.toLowerCase() }, onclick: () => { E.add(mk(Math.min(E.d.w, E.d.h) * .6), { at: Canvas.centerOfView() }); toast('Seret foto atau tangkapan layar ke layar perangkat'); } }, icon(ic));
}

// ---------- Iconify ----------
const iconCache = new Map();
async function iconify(q, sets, limit = 64) {
  const key = q + '|' + sets;
  if (iconCache.has(key)) return iconCache.get(key);
  const r = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(translate(q))}&limit=${limit}&prefixes=${sets}`);
  const j = await r.json();
  iconCache.set(key, j.icons || []);
  return j.icons || [];
}
const iconURL = (id) => { const [p, n] = id.split(':'); return `https://api.iconify.design/${p}/${n}.svg`; };
function iconTile(id, color) {
  const t = h('button.tile', { type: 'button', dataset: { tip: id.split(':')[1].replace(/-/g, ' ') } }, h('img', { src: iconURL(id) + (color ? '?color=%23' + color : ''), alt: '', loading: 'lazy', width: 44, height: 44 }));
  return dragSpec(t, { kind: 'svg', url: iconURL(id), name: id }, () => E.emit('insertSvg', { spec: { url: iconURL(id), name: id } }));
}
async function iconSearch(host, q, sets) {
  host.textContent = '';
  const grid = h('div.g4', Array.from({ length: 16 }, () => h('div.tile.ph')));
  const grid2 = h('div.g4');
  host.append(sets ? null : sec('Grafis', null, grid2), sec(sets ? 'Hasil' : 'Ikon', null, grid));
  if (!sets) grid2.append(...Array.from({ length: 8 }, () => h('div.tile.ph')));
  try {
    const [a, b] = await Promise.all([iconify(q, sets || ICON_SETS, sets ? 96 : 48), sets ? [] : iconify(q, STICKER_SETS, 24)]);
    grid.textContent = ''; grid2.textContent = '';
    grid.append(...a.map(id => iconTile(id, sets === STICKER_SETS ? null : '3d3d4e')));
    grid2.append(...b.map(id => iconTile(id)));
    if (!a.length && !b.length) host.prepend(h('p.muted.small', `Tidak ada hasil untuk “${q}”. Coba kata lain (mis. bahasa Inggris).`));
    if (!sets && !b.length) grid2.closest('.pn-sec')?.remove();
  } catch { host.textContent = ''; host.append(h('p.muted.small', 'Perpustakaan ikon tidak dapat dijangkau. Periksa koneksi internet.')); }
}
async function insertSvg(spec, at) {
  try {
    let svg = spec.svg || await (await fetch(spec.url)).text();
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml'), root = doc.documentElement;
    if (root.nodeName !== 'svg') throw new Error('bad svg');
    root.querySelectorAll('script,foreignObject').forEach(n => n.remove());
    for (const n of [root, ...root.querySelectorAll('*')]) for (const a of [...n.attributes]) if (/^on/i.test(a.name)) n.removeAttribute(a.name);
    const vb = (root.getAttribute('viewBox') || `0 0 ${parseFloat(root.getAttribute('width')) || 100} ${parseFloat(root.getAttribute('height')) || 100}`).split(/[\s,]+/).map(Number);
    if (!root.getAttribute('viewBox')) root.setAttribute('viewBox', vb.join(' '));
    root.setAttribute('width', '100%'); root.setAttribute('height', '100%');
    root.setAttribute('preserveAspectRatio', 'none');
    svg = new XMLSerializer().serializeToString(root);
    const mono = /currentColor/.test(svg);
    const s = Math.min(E.d.w, E.d.h) * .28, ar = (vb[2] || 1) / (vb[3] || 1);
    const el = { ...shapeEl('rect'), type: 'svg', svg, colors: {}, mono: mono ? '#3d3d4e' : null, w: ar >= 1 ? s : s * ar, h: ar >= 1 ? s / ar : s, name: spec.name || '' };
    delete el.shape; delete el.fill; delete el.stroke; delete el.radius;
    E.add(el, { at: at || Canvas.centerOfView() });
  } catch { toast('Grafis gagal dimuat'); }
}
function iconSearchPanel(q, sets, label) { Panels.open('iconset', { q, sets, label }); }
Panels.register('iconset', { title: (o) => o.label || 'Ikon', back: 'elements', rail: 'elements', render(b, o) { const host = h('div'); b.append(host); iconSearch(host, o.q, o.sets); } });
function stickerRow() { const g = h('div.g4'); iconify('party', STICKER_SETS, 8).then(ids => g.append(...ids.slice(0, 8).map(id => iconTile(id)))).catch(() => {}); return g; }
function iconRow() { const g = h('div.g4'); iconify('star', 'ph,tabler,lucide', 8).then(ids => g.append(...ids.slice(0, 8).map(id => iconTile(id, '3d3d4e')))).catch(() => {}); return g; }

// ======================= Text =======================
const COMBOS = [
  { n: 'SALE', els: [['SALE', 'Anton', 120, '#ff3d6e', { lh: 1, align: 'center' }], ['UP TO 50% OFF', 'Montserrat', 28, '#111111', { weight: 700, ls: 200, align: 'center' }]] },
  { n: 'Elegan', els: [['Selamat Datang', 'Great Vibes', 84, '#5b4630', { align: 'center' }], ['DI RUMAH KAMI', 'Cinzel', 24, '#7a6347', { align: 'center', ls: 300 }]] },
  { n: 'Grand', els: [['GRAND', 'Cinzel', 80, '#b08d57', { weight: 700, align: 'center', lh: 1 }], ['OPENING', 'Montserrat', 30, '#1d1d24', { ls: 600, align: 'center' }]] },
  { n: 'Neon', els: [['OPEN', 'Unbounded', 90, '#ff2bd6', { weight: 800, align: 'center', fx: { type: 'neon', int: 60 } }]] },
  { n: 'Kutipan', els: [['“Mulai dari yang kecil.”', 'DM Serif Display', 54, '#2b2420', { align: 'center' }], ['— ANONIM', 'Montserrat', 18, '#6b5a4d', { ls: 300, align: 'center' }]] },
  { n: 'Retro', els: [['RETRO', 'Luckiest Guy', 100, '#ffd23f', { align: 'center', fx: { type: 'splice', thick: 3, ox: 8, oy: 8, color: '#ff4d2e' } }]] },
  { n: 'Tebal', els: [['BIG', 'Archivo Black', 110, '#111111', { align: 'center', lh: 1 }], ['IDEAS', 'Archivo Black', 110, 'transparent', { align: 'center', lh: 1, fx: { type: 'hollow', thick: 3 }, color: '#111111' }]] },
  { n: 'Minimal', els: [['minimal', 'Syne', 72, '#1d1d24', { weight: 700, align: 'center' }], ['studio & co.', 'Inter', 22, '#6a6b78', { align: 'center', ls: 100 }]] },
];
function comboEls(c, at) {
  const W = E.d.w, k = Math.max(.4, Math.min(W, E.d.h) / 1080), g = uid('g');
  let y = 0;
  const els = c.els.map(([html, font, size, color, o]) => {
    const t = textEl({ html, font, size: size * k, color: o.color || color, w: W * .62, x: 0, y, h: size * k * (o.lh || 1.25), lh: o.lh || 1.25, gid: c.els.length > 1 ? g : null, ...o, ...(o.color ? { color: o.color } : {}) });
    y += t.h + size * k * .1;
    loadFont(font);
    return t;
  });
  return els;
}
Panels.register('text', {
  title: 'Teks',
  render(b) {
    const bf = Brand.d.fonts;
    b.append(h('button.btn.btn-primary.block', { type: 'button', onclick: () => addText('body') }, icon('text_fields'), 'Tambahkan kotak teks'));
    b.append(sec('Gaya teks default', null, h('div.add-text',
      dragSpec(h('button', { type: 'button', style: { fontFamily: fontStack(bf.heading), fontSize: '26px', fontWeight: 700 } }, 'Tambahkan judul'), { kind: 'text', preset: 'heading' }, () => addText('heading')),
      dragSpec(h('button', { type: 'button', style: { fontFamily: fontStack(bf.sub), fontSize: '18px', fontWeight: 600 } }, 'Tambahkan subjudul'), { kind: 'text', preset: 'sub' }, () => addText('sub')),
      dragSpec(h('button', { type: 'button', style: { fontFamily: fontStack(bf.body), fontSize: '14px' } }, 'Tambahkan sedikit teks isi'), { kind: 'text', preset: 'body' }, () => addText('body')))));
    b.append(sec('Kombinasi font', null, h('div.g2', COMBOS.map(c => {
      c.els.forEach(([, f]) => loadFont(f));
      const prev = h('div', { style: { display: 'grid', gap: '2px', pointerEvents: 'none' } }, c.els.map(([html, font, size, color, o]) => h('div', { style: { fontFamily: fontStack(font), fontSize: Math.max(11, size * .26) + 'px', color: color === 'transparent' ? 'transparent' : color, fontWeight: o.weight || 400, letterSpacing: (o.ls || 0) / 1000 + 'em', lineHeight: 1.1, WebkitTextStroke: o.fx?.type === 'hollow' ? '1px #111' : '', textShadow: o.fx?.type === 'neon' ? `0 0 6px ${color}` : o.fx?.type === 'splice' ? `2px 2px 0 ${o.fx.color}` : '' } }, html)));
      const bt = h('button.combo', { type: 'button', style: { background: c.n === 'Neon' ? '#101018' : '#f6f5fa' } }, prev);
      return dragSpec(bt, { kind: 'combo', name: c.n }, () => E.add(comboEls(c), { at: Canvas.centerOfView() }));
    }))));
    b.append(sec('Teks melengkung', null, h('button.btn.btn-ghost.block', { type: 'button', onclick: () => { const el = addText('sub', { html: 'TEKS MELENGKUNG', curve: 50, ls: 120 }); void el; setTimeout(() => E.emit('endEdit'), 60); } }, icon('looks'), 'Tambahkan teks melengkung')));
  },
});

// ======================= Brand =======================
Panels.register('brand', {
  title: 'Brand Kit',
  render(b) {
    const d = Brand.d;
    const pal = h('div.pn-sec');
    const drawPal = () => {
      pal.textContent = '';
      d.palettes.forEach((p, pi) => {
        pal.append(h('div.pn-sec-h', h('b', p.name), h('button', { type: 'button', onclick: () => { d.palettes.splice(pi, 1); Brand.save(); drawPal(); } }, 'Hapus')),
          h('div.swatches', p.colors.map((c, ci) => h('button.swatch', { type: 'button', style: { background: c }, dataset: { tip: c + ' — klik untuk menerapkan, klik kanan untuk menghapus' }, onclick: () => applyColor(c), oncontextmenu: (e) => { e.preventDefault(); p.colors.splice(ci, 1); Brand.save(); drawPal(); } })),
            h('button.swatch.add', { type: 'button', dataset: { tip: 'Tambah warna' }, onclick: (e) => import('./color.js').then(m => { let last = '#7b3fe4'; m.colorPopover(e.currentTarget, last, (c) => (last = c), { onDone: (c) => { if (!p.colors.includes(c)) { p.colors.push(c.slice(0, 7)); Brand.save(); drawPal(); } } }); }) })));
      });
      pal.append(h('button.btn.btn-text', { type: 'button', onclick: () => { d.palettes.push({ name: 'Palet ' + (d.palettes.length + 1), colors: designColors(E.d).slice(0, 6) }); Brand.save(); drawPal(); } }, icon('add'), 'Palet dari desain ini'));
    };
    drawPal();
    b.append(sec('Warna merek', null, pal));
    const fontRow = (k, label, size) => h('button.tile', { type: 'button', style: { aspectRatio: 'auto', padding: '12px', textAlign: 'left', justifyItems: 'start', display: 'grid', gap: '2px' }, onclick: () => addText(k === 'heading' ? 'heading' : k === 'sub' ? 'sub' : 'body') },
      h('small', { style: { color: 'var(--tx3)' } }, label), h('b', { style: { fontFamily: fontStack(d.fonts[k]), fontSize: size + 'px', color: 'var(--tx)' } }, d.fonts[k]));
    Object.values(d.fonts).forEach(loadFont);
    b.append(sec('Font merek', null, fontRow('heading', 'Judul', 22), fontRow('sub', 'Subjudul', 17), fontRow('body', 'Teks isi', 14),
      h('button.btn.btn-text', { type: 'button', onclick: () => Panels.open('font', { brand: 'heading' }) }, icon('edit'), 'Ubah font judul'),
      h('button.btn.btn-text', { type: 'button', onclick: () => Panels.open('font', { brand: 'body' }) }, icon('edit'), 'Ubah font isi')));
    const logos = h('div.g3');
    Promise.all(d.logos.map(async (src) => {
      const u = await assetURL(src);
      const t = h('button.tile', { type: 'button', oncontextmenu: (e) => { e.preventDefault(); d.logos = d.logos.filter(x => x !== src); Brand.save(); Panels.open('brand', {}, true); } }, h('img', { src: u, alt: 'Logo' }));
      t.onclick = async () => { const a = await Store.getAsset(src.slice(6)); insertAsset({ src, w: a?.w || 400, h: a?.h || 400 }); };
      return t;
    })).then(ts => logos.append(...ts, h('button.tile', { type: 'button', dataset: { tip: 'Unggah logo' }, onclick: async () => { const fs = await pickFiles('image/*', true); for (const f of fs) { const a = await addAsset(f, { uploaded: true, name: f.name }); d.logos.push(a.src); } Brand.save(); Panels.open('brand', {}, true); } }, icon('add'))));
    b.append(sec('Logo', null, logos));
  },
});
function applyColor(c) {
  const els = E.selEls();
  if (!els.length) { E.page().bg.fill = c; Canvas.refreshBg(); E.commit('bg'); return; }
  E.set(x => { if (x.type === 'text' || x.type === 'line' || x.type === 'path') x.color = c; else if (x.type === 'shape') x.fill = c; else if (x.type === 'svg') x.mono = c; });
}

// ======================= Uploads =======================
Panels.register('uploads', {
  title: 'Unggahan',
  render(b) {
    const up = async (files) => {
      const fs = files.filter(f => /^image\//.test(f.type));
      if (!fs.length) return;
      for (const f of fs) await addAsset(f, { uploaded: true, name: f.name });
      toast(fs.length + ' file diunggah', { icon: 'cloud_done' });
      Panels.open('uploads', {}, true);
    };
    const zone = h('div.drop-zone', icon('cloud_upload'), h('b', 'Seret file ke sini'), h('small', 'PNG, JPG, WEBP, SVG, GIF — tersimpan di perangkat ini'));
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('over'));
    zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('over'); up([...e.dataTransfer.files]); });
    b.append(h('button.btn.btn-primary.block', { type: 'button', onclick: async () => up(await pickFiles('image/*', true)) }, icon('upload'), 'Unggah file'), zone);
    const grid = h('div.masonry');
    b.append(sec('Gambar', null, grid));
    Store.listAssets().then(list => {
      if (!list.length) grid.append(h('p.muted.small', 'Belum ada unggahan.'));
      for (const a of list) {
        const im = h('img', { alt: a.name, loading: 'lazy' });
        assetURL('asset:' + a.id).then(u => (im.src = u));
        const t = h('button.ptile', { type: 'button', dataset: { tip: a.name } }, im);
        dragSpec(t, { kind: 'asset', src: 'asset:' + a.id, w: a.w, h: a.h }, () => insertAsset({ src: 'asset:' + a.id, w: a.w, h: a.h }));
        t.addEventListener('contextmenu', (e) => { e.preventDefault(); menu({ x: e.clientX, y: e.clientY }, [
          { label: 'Jadikan latar', icon: 'wallpaper', run: () => { E.page().bg = { ...E.page().bg, img: { src: 'asset:' + a.id } }; Canvas.refreshBg(); E.commit('bg'); } },
          { label: 'Hapus dari unggahan', icon: 'delete', danger: true, run: async () => { if (await confirmDlg('Hapus unggahan?', 'Gambar yang sudah dipakai di desain tidak bisa ditampilkan lagi.', 'Hapus', true)) { await Store.deleteAsset(a.id); Panels.open('uploads', {}, true); } } },
        ]); });
        grid.append(t);
      }
    });
  },
});

// ======================= Draw =======================
Panels.register('draw', { title: 'Gambar', render: drawPanel });

// ======================= Photos =======================
Panels.register('photos', {
  title: 'Foto',
  render(b, o) {
    const grid = h('div.masonry'), more = h('button.btn.btn-ghost.block', { type: 'button' }, 'Muat lebih banyak');
    let page = 1, q = o.q || '';
    const load = async (reset) => {
      if (reset) { grid.textContent = ''; page = 1; }
      more.disabled = true;
      try {
        if (!q) {
          const list = await (await fetch(`https://picsum.photos/v2/list?page=${page}&limit=30`)).json();
          for (const p of list) grid.append(photoTile(`https://picsum.photos/id/${p.id}/300/${Math.round(300 * p.height / p.width)}`, `https://picsum.photos/id/${p.id}/${Math.min(1800, p.width)}/${Math.round(Math.min(1800, p.width) * p.height / p.width)}`, p.author, p.width, p.height));
        } else {
          const j = await (await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(translate(q))}&page_size=30&page=${page}&mature=false`)).json();
          if (reset && !j.results?.length) grid.append(h('p.muted.small', `Tidak ada foto untuk “${q}”.`));
          for (const p of j.results || []) grid.append(photoTile(p.thumbnail, p.url, p.creator || p.source, p.width || 800, p.height || 600, p.thumbnail));
        }
        page++;
      } catch { if (!grid.childElementCount) grid.append(h('p.muted.small', 'Perpustakaan foto tidak dapat dijangkau.')); }
      more.disabled = false;
    };
    more.onclick = () => load(false);
    b.append(searchBox('Cari foto (mis. kopi, pantai, kantor)', (v) => { q = v; load(true); }, q),
      h('div.chips.scroll', ['Alam', 'Kopi', 'Kantor', 'Kota', 'Makanan', 'Bisnis', 'Pantai', 'Gunung', 'Bunga', 'Teknologi'].map(c => h('button.chip', { type: 'button', onclick: (e) => { q = c; e.currentTarget.closest('.pn-b').querySelector('input').value = c; load(true); } }, c))),
      grid, more, h('p.small.muted', { style: { margin: 0 } }, 'Foto dari Lorem Picsum (Unsplash) dan Openverse (lisensi Creative Commons). Periksa lisensi sebelum penggunaan komersial.'));
    load(true);
  },
});
function photoTile(thumbUrl, full, credit, w, hh, fallback) {
  const t = h('button.ptile', { type: 'button', dataset: { tip: credit ? 'Oleh ' + credit : 'Foto' } }, h('img', { src: thumbUrl, alt: '', loading: 'lazy', style: { aspectRatio: `${w} / ${hh}` } }));
  return dragSpec(t, { kind: 'image', url: full, w, h: hh, fallback, name: credit }, () => insertURL(full, null, null, { w, h: hh, fallback, name: credit }));
}

// ======================= Projects =======================
Panels.register('projects', {
  title: 'Proyek',
  render(b) {
    const g = h('div.g2');
    b.append(h('p.small.muted', { style: { margin: 0 } }, 'Klik desain untuk menyalin halamannya ke desain ini.'), g);
    Store.listDesigns().then(list => {
      list = list.filter(d => d.id !== E.d.id);
      if (!list.length) g.append(h('p.muted.small', 'Belum ada desain lain.'));
      for (const d of list) {
        const c = h('button.tpl-card', { type: 'button' }, thumb(d.pages[0], d, 150, 150), h('small', d.name));
        c.onclick = () => menu(c, [
          { label: 'Tambahkan semua halaman', icon: 'library_add', run: () => copyPages(d) },
          { label: 'Buka desain', icon: 'open_in_new', run: () => (location.hash = '#/design/' + d.id) },
        ]);
        g.append(c);
      }
    });
  },
});
function copyPages(d) {
  const k = Math.min(E.d.w / d.w, E.d.h / d.h), ox = (E.d.w - d.w * k) / 2, oy = (E.d.h - d.h * k) / 2;
  const pages = d.pages.map(p => { const c = JSON.parse(JSON.stringify(p)); c.id = uid('p'); c.els = cloneEls(c.els); scaleEls(c.els, k); c.els.forEach(e => { e.x += ox; e.y += oy; }); return c; });
  E.d.pages.splice(E.pi + 1, 0, ...pages); E.pi++;
  Canvas.build(); E.commit('copyPages'); E.emit('page');
  toast(pages.length + ' halaman ditambahkan');
}

// ======================= Apps =======================
export const APPS = [
  ['qr', 'Kode QR', 'qr_code_2', 'Buat kode QR untuk tautan, WhatsApp, Wi-Fi, atau teks.', '#111827'],
  ['barcode', 'Barcode', 'barcode', 'Barcode EAN-13, UPC, Code128 untuk label produk.', '#334155'],
  ['bgremove', 'Hapus Latar', 'background_replace', 'Hapus latar belakang foto otomatis dengan AI di perangkat.', '#7b3fe4'],
  ['aiimage', 'Teks ke Gambar', 'auto_awesome', 'Tulis deskripsi, dapatkan gambar dari AI.', '#db2777'],
  ['aiwrite', 'Tulis Ajaib', 'edit_note', 'Buat caption, judul, dan teks promosi dengan AI.', '#0e9384'],
  ['palette', 'Palet dari Foto', 'palette', 'Ambil palet warna dari gambar mana pun.', '#ea6a0c'],
  ['resize', 'Ubah Ukuran Ajaib', 'aspect_ratio', 'Ubah desain ke ukuran lain dalam sekali klik.', '#1f6feb'],
  ['chart', 'Grafik', 'bar_chart', 'Batang, garis, pai, donat, dan progres.', '#16a34a'],
  ['table', 'Tabel', 'table', 'Tabel yang bisa diedit dan diberi gaya.', '#475467'],
  ['mockup', 'Mockup', 'devices', 'Tempatkan desain di ponsel, laptop, atau browser.', '#4f46e5'],
  ['curve', 'Teks Melengkung', 'looks', 'Lengkungkan teks seperti logo stempel.', '#dc2626'],
  ['emoji', 'Emoji & Stiker', 'mood', 'Ribuan emoji berwarna siap pakai.', '#f59e0b'],
];
Panels.register('apps', {
  title: 'Aplikasi',
  render(b) {
    b.append(h('div', { style: { display: 'grid', gap: '8px' } }, APPS.map(([k, n, ic, d, c]) => h('button.tool-card', { type: 'button', style: { gridTemplateColumns: '42px 1fr', padding: '12px', borderRadius: '14px' }, onclick: () => runApp(k) },
      h('i', { style: { background: c, width: '42px', height: '42px', borderRadius: '12px' } }, icon(ic)), h('div', h('b', { style: { fontSize: '13.5px', margin: '1px 0' } }, n), h('small', d))))));
  },
});
export function runApp(k) {
  if (k === 'resize') return import('../tools/resize.js').then(m => m.openResize());
  if (k === 'chart') { E.add(chartFor('bar'), { at: Canvas.centerOfView() }); return Panels.open('chart'); }
  if (k === 'table') return E.add(tableFor(3, 3), { at: Canvas.centerOfView() });
  if (k === 'mockup') return Panels.open('elements');
  if (k === 'curve') { addText('sub', { html: 'TEKS MELENGKUNG', curve: 50, ls: 120 }); setTimeout(() => { E.emit('endEdit'); Panels.open('fx'); }, 80); return; }
  if (k === 'emoji') return iconSearchPanel('smile', STICKER_SETS, 'Emoji & Stiker');
  if (k === 'bgremove') { const one = E.one(); if (one?.type === 'image' && one.src) return Panels.open('photo', { tab: 'bg' }); toast('Pilih foto di kanvas terlebih dahulu'); return; }
  Panels.open(k);
}
