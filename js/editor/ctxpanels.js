// Contextual side panels opened from the toolbar: font, colour, effects, animation,
// position/layers, photo editing, masks, shadows, charts, tables, QR, and AI tools.
import { E } from './state.js';
import { Canvas, fillImage } from './canvas.js';
import { Panels } from './panels.js';
import { insertAsset, insertURL, addText } from './editor.js';
import { colorPanel, colorPopover } from './color.js';
import { svgColors } from './toolbar.js';
import { h, icon, ib, slider, toast, debounce, clamp, round, menu, esc, pickFiles } from '../util.js';
import { FONTS, FONT_CATS, loadFont, previewFamily, fontStack } from '../fonts.js';
import { TEXT_FX, FX_DEF, textStyle, FILTER_PRESETS, filterCSS, CHARTS, paintCSS } from '../render.js';
import { MASKS, shapePath } from '../shapes.js';
import { bbox, textEl, TEXT_DEF } from '../model.js';
import { assetURL, assetBlob, addAsset } from '../assets.js';
import { Brand } from '../brand.js';
import { qrSVG, barcodeSVG } from '../tools/qr.js';
import { removeBgAI, removeBgColor, extractPalette, autoEnhance } from '../tools/imagetools.js';
import { generateImage, writeText, aiKey, askKey } from '../tools/ai.js';

const R = (name, def) => Panels.register(name, { ctx: true, ...def });
const sec = (title, ...kids) => h('div.pn-sec', title ? h('div.pn-sec-h', h('b', title)) : null, ...kids);
const live = (patch, els) => E.set(patch, { els, commit: false });
const done = (why) => E.commit(why);

// ================= Font =================
R('font', {
  title: 'Font', keep: (o) => !!o.brand,
  render(b, o) {
    const els = E.selEls().filter(e => e.type === 'text' || e.type === 'table');
    const cur = o.brand ? Brand.d.fonts[o.brand] : els[0]?.font;
    let cat = 'all', q = '';
    const list = h('div.font-list');
    const io = new IntersectionObserver((ents) => ents.forEach(en => { if (en.isIntersecting) { const r = en.target; io.unobserve(r); previewFamily(r.dataset.f).then(n => (r.style.fontFamily = `'${n}', ${fontStack(r.dataset.f)}`)); } }), { root: b });
    const draw = () => {
      list.textContent = '';
      const brandFonts = [...new Set(Object.values(Brand.d.fonts))];
      const fs = FONTS.filter(f => (cat === 'all' || f.c === cat) && (!q || f.n.toLowerCase().includes(q)));
      if (!q && cat === 'all') list.append(h('div.mhead', 'Font merek'), ...brandFonts.map(n => row({ n })), h('div.mhead', 'Semua font'));
      list.append(...fs.map(row));
      if (!fs.length) list.append(h('p.muted.small', 'Font tidak ditemukan.'));
    };
    const row = (f) => {
      const r = h('button.font-row' + (f.n === cur ? '.on' : ''), { type: 'button', dataset: { f: f.n } }, h('span', f.n), f.n === cur ? icon('check') : null);
      io.observe(r);
      r.onclick = async () => {
        await loadFont(f.n);
        if (o.brand) { Brand.d.fonts[o.brand] = f.n; Brand.save(); Panels.open('brand'); return; }
        if (E.editing && getSelection().rangeCount && !getSelection().isCollapsed) { document.execCommand('styleWithCSS', false, true); document.execCommand('fontName', false, f.n); return; }
        E.set({ font: f.n }, { els });
        setTimeout(() => { E.emit('full'); }, 300);
        Panels.open('font', o, true);
      };
      return r;
    };
    const inp = h('input', { type: 'search', placeholder: 'Cari font', oninput: (e) => { q = e.target.value.trim().toLowerCase(); draw(); }, onkeydown: (e) => e.stopPropagation() });
    b.append(h('label.search', icon('search'), inp),
      h('div.chips.scroll', FONT_CATS.map(([k, l]) => h('button.chip' + (k === cat ? '.on' : ''), { type: 'button', onclick: (e) => { cat = k; e.currentTarget.parentNode.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === e.currentTarget)); draw(); } }, l))),
      list);
    draw();
  },
});

// ================= Color =================
R('color', {
  title: (o) => ({ bg: 'Warna latar', text: 'Warna teks', fill: 'Warna isi', stroke: 'Warna garis tepi', shadow: 'Warna bayangan' }[o.target] || 'Warna'),
  keep: (o) => o.target === 'bg',
  refresh: false,
  render(b, o) {
    const t = o.target;
    const els = E.selEls();
    const get = () => {
      if (t === 'bg') return E.page().bg.fill;
      const e = els[0]; if (!e) return null;
      if (t === 'text') return e.color;
      if (t === 'stroke') return e.stroke?.c;
      if (t === 'mono') return e.mono;
      if (t.startsWith('svg:')) return e.colors?.[t.slice(4)] || t.slice(4);
      if (t === 'shadow') return e.shadow?.color;
      return e[t];
    };
    const set = (c) => {
      if (t === 'bg') { E.page().bg.fill = c || '#ffffff'; Canvas.refreshBg(); E.commit('bg'); return; }
      if (t === 'text' && E.editing && getSelection().rangeCount && !getSelection().isCollapsed && typeof c === 'string') { document.execCommand('styleWithCSS', false, true); document.execCommand('foreColor', false, c); return; }
      E.set(x => {
        if (t === 'text') { x.color = c; if (x.html) x.html = x.html.replace(/color:\s*[^;"]+;?/gi, ''); }
        else if (t === 'stroke') x.stroke = { ...(x.stroke || { w: 4 }), c };
        else if (t === 'mono') x.mono = c;
        else if (t.startsWith('svg:')) x.colors = { ...(x.colors || {}), [t.slice(4)]: c };
        else if (t === 'shadow') x.shadow = { ...(x.shadow || { x: 8, y: 8, blur: 16, op: 40 }), color: c };
        else x[t] = c;
      }, { els });
    };
    b.append(colorPanel(get(), set, { gradient: t === 'bg' || t === 'fill', none: t === 'fill' || t === 'head' || t === 'bg' }));
    if (t === 'bg') {
      b.append(sec('Gambar latar', h('div.g2',
        h('button.btn.btn-ghost', { type: 'button', onclick: async () => { const [f] = await pickFiles('image/*', false); if (!f) return; const a = await addAsset(f, { uploaded: true, name: f.name }); E.page().bg.img = { src: a.src }; Canvas.refreshBg(); E.commit('bg'); } }, icon('image'), 'Unggah'),
        h('button.btn.btn-ghost', { type: 'button', onclick: () => Panels.open('photos') }, icon('photo_library'), 'Foto'))),
        h('button.btn.btn-text', { type: 'button', onclick: () => { const f = E.page().bg.fill; E.d.pages.forEach(p => (p.bg.fill = JSON.parse(JSON.stringify(f)))); Canvas.build(); E.commit('bgAll'); toast('Latar diterapkan ke semua halaman'); } }, icon('done_all'), 'Terapkan ke semua halaman'));
    }
  },
});

// ================= Text effects =================
R('fx', {
  title: 'Efek',
  render(b) {
    const els = E.selEls().filter(e => e.type === 'text'); const e = els[0]; if (!e) return;
    const curType = e.fx?.type || 'none';
    const grid = h('div.fx-grid', Object.entries(TEXT_FX).map(([k, n]) => {
      const sample = { ...TEXT_DEF, size: 30, color: k === 'neon' ? '#ff2bd6' : '#2b2b36', fx: k === 'none' ? null : { type: k, ...FX_DEF[k] }, font: 'Archivo Black', weight: 400 };
      const st = textStyle(sample);
      const tile = h('i', h('span', { style: { ...st, fontSize: '30px', lineHeight: 1, padding: k === 'background' ? '4px 8px' : '' } }, 'Ag'));
      if (k === 'neon') tile.style.background = '#14121c';
      return h('button.fx-item' + (curType === k ? '.on' : ''), { type: 'button', onclick: () => { E.set(x => { x.fx = k === 'none' ? null : { type: k, ...FX_DEF[k], ...(k === 'echo' || k === 'hollow' ? {} : {}) }; }, { els }); Panels.open('fx', {}, true); } }, tile, n);
    }));
    b.append(sec('Gaya', grid));
    if (e.fx && e.fx.type !== 'none') {
      const p = { ...FX_DEF[e.fx.type], ...e.fx };
      const ctl = h('div.pn-sec');
      const sl = (k, label, min, max, step = 1) => slider({ label, min, max, step, value: p[k], oninput: (v) => live(x => { x.fx = { ...x.fx, [k]: v }; }, els), onchange: () => done('fx') });
      const col = (k, label) => h('div.row', h('span.small', { style: { flex: 1, fontWeight: 600, color: 'var(--tx2)' } }, label), h('button.swatch', { type: 'button', style: { width: '32px', background: p[k] || e.color }, onclick: (ev) => colorPopover(ev.currentTarget, p[k] || e.color, (c) => live(x => { x.fx = { ...x.fx, [k]: c }; }, els), { onDone: () => done('fx') }) }));
      const map = {
        shadow: [sl('ox', 'Offset X', -50, 50), sl('oy', 'Offset Y', -50, 50), sl('blur', 'Buram', 0, 100), sl('op', 'Transparansi', 0, 100), col('color', 'Warna')],
        lift: [sl('int', 'Intensitas', 0, 100)], hollow: [sl('thick', 'Ketebalan', 1, 10)],
        splice: [sl('thick', 'Ketebalan', 1, 10), sl('ox', 'Offset X', -50, 50), sl('oy', 'Offset Y', -50, 50), col('color', 'Warna')],
        outline: [sl('thick', 'Ketebalan', 1, 20), col('color', 'Warna')], echo: [sl('ox', 'Offset X', -50, 50), sl('oy', 'Offset Y', -50, 50), col('color', 'Warna')],
        glitch: [sl('off', 'Offset', 1, 20), col('c1', 'Warna 1'), col('c2', 'Warna 2')], neon: [sl('int', 'Intensitas', 0, 100)],
        background: [sl('round', 'Kelengkungan', 0, 100), sl('spread', 'Ruang', 0, 100), sl('op', 'Transparansi', 0, 100), col('color', 'Warna')],
        gradient: [col('c1', 'Warna awal'), col('c2', 'Warna akhir'), sl('a', 'Sudut', 0, 360)],
      };
      ctl.append(...(map[e.fx.type] || []));
      b.append(ctl);
    }
    b.append(sec('Bentuk',
      h('div.g2', h('button.fx-item' + (!e.curve ? '.on' : ''), { type: 'button', onclick: () => { E.set({ curve: 0 }, { els }); Panels.open('fx', {}, true); } }, h('i', { style: { fontSize: '20px' } }, 'abcd'), 'Tidak ada'),
        h('button.fx-item' + (e.curve ? '.on' : ''), { type: 'button', onclick: () => { E.set(x => { x.curve = x.curve || 50; }, { els }); Panels.open('fx', {}, true); } }, h('i', { html: '<svg viewBox="0 0 80 50" width="70%"><path id="cvp" d="M8 42 A40 40 0 0 1 72 42" fill="none"/><text font-size="13" font-weight="800" fill="#2b2b36"><textPath href="#cvp" startOffset="50%" text-anchor="middle">abcdef</textPath></text></svg>' }), 'Lengkung')),
      e.curve ? slider({ label: 'Kelengkungan', min: -100, max: 100, value: e.curve, oninput: (v) => live(x => { x.curve = v || 1; }, els), onchange: () => done('curve') }) : null));
  },
});

// ================= Animation =================
export const ANIMS = {
  none: 'Tidak ada', fade: 'Pudar', rise: 'Naik', pan: 'Geser', pop: 'Muncul', wipe: 'Usap', blur: 'Buram', zoom: 'Perbesar',
  drop: 'Jatuh', tumble: 'Berguling', baseline: 'Garis dasar', stomp: 'Hentak', flicker: 'Berkedip', breathe: 'Bernapas',
};
export const TRANS = { none: 'Tidak ada', fade: 'Pudar', slide: 'Geser', push: 'Dorong', zoom: 'Perbesar', dissolve: 'Larut', circle: 'Lingkaran' };
export function animCSS(a, delay = 0) {
  if (!a || a.type === 'none') return '';
  const dur = a.dur || .8;
  if (a.type === 'breathe') return `a-breathe ${dur * 3}s ease-in-out ${delay}s infinite`;
  if (a.type === 'flicker') return `a-flicker ${dur * 1.6}s linear ${delay}s both`;
  return `a-${a.type} ${dur}s cubic-bezier(.2,.8,.2,1) ${delay}s both`;
}
function preview(els, a) {
  els.forEach((e, i) => {
    const n = Canvas.stage(E.pageOf(e.id))?.querySelector(`.el[data-id="${e.id}"]`); if (!n) return;
    n.style.animation = 'none'; void n.offsetWidth;
    n.style.animation = animCSS(a, i * .08);
    setTimeout(() => (n.style.animation = ''), ((a.dur || .8) * 1000 + 600) * (a.type === 'breathe' ? 3 : 1));
  });
}
R('anim', {
  title: (o) => o.page ? 'Animasi halaman' : 'Animasi',
  keep: (o) => !!o.page,
  render(b, o) {
    const page = o.page || !E.sel.length;
    const tab = o.tab || 'anim';
    if (page) b.append(h('div.pn-tabs', [['anim', 'Animasi'], ['trans', 'Transisi']].map(([k, l]) => h('button' + (tab === k ? '.on' : ''), { type: 'button', onclick: () => Panels.open('anim', { page: true, tab: k }) }, l))));
    if (page && tab === 'trans') {
      const p = E.page();
      b.append(h('p.small.muted', { style: { margin: 0 } }, 'Transisi diputar saat berpindah ke halaman ini dalam mode presentasi.'),
        h('div.fx-grid', Object.entries(TRANS).map(([k, n]) => h('button.fx-item' + ((p.trans || 'none') === k ? '.on' : ''), { type: 'button', onclick: () => { p.trans = k; E.commit('trans'); Panels.open('anim', o, true); } }, h('i', icon({ none: 'block', fade: 'gradient', slide: 'arrow_forward', push: 'arrow_upward', zoom: 'zoom_in', dissolve: 'blur_on', circle: 'radio_button_unchecked' }[k])), n))),
        h('button.btn.btn-text', { type: 'button', onclick: () => { E.d.pages.forEach(x => (x.trans = p.trans)); E.commit('trans'); toast('Transisi diterapkan ke semua halaman'); } }, icon('done_all'), 'Terapkan ke semua halaman'));
      return;
    }
    const els = page ? E.els() : E.selEls();
    const cur = page ? E.page().anim : els[0]?.anim;
    const grid = h('div.fx-grid', Object.entries(ANIMS).map(([k, n]) => {
      const it = h('button.fx-item' + ((cur?.type || 'none') === k ? '.on' : ''), { type: 'button' }, h('i', icon({ none: 'block', fade: 'gradient', rise: 'north', pan: 'east', pop: 'bubble_chart', wipe: 'swipe_right', blur: 'blur_on', zoom: 'zoom_in', drop: 'south', tumble: 'rotate_right', baseline: 'vertical_align_bottom', stomp: 'compress', flicker: 'flash_on', breathe: 'air' }[k])), n);
      it.onmouseenter = () => k !== 'none' && preview(page ? E.els() : E.selEls(), { type: k, dur: cur?.dur || .8 });
      it.onclick = () => {
        const a = k === 'none' ? null : { type: k, dur: cur?.dur || .8 };
        if (page) { E.page().anim = a; E.commit('anim'); } else E.set({ anim: a }, { els });
        preview(els, a || { type: 'none' });
        Panels.open('anim', o, true);
      };
      return it;
    }));
    b.append(h('p.small.muted', { style: { margin: 0 } }, page ? 'Semua elemen di halaman ini masuk berurutan.' : 'Arahkan kursor untuk pratinjau.'), grid);
    if (cur) b.append(slider({ label: 'Durasi', min: .2, max: 3, step: .1, value: cur.dur || .8, unit: 'dtk', onchange: (v) => { if (page) { E.page().anim = { ...cur, dur: v }; E.commit('anim'); } else E.set(x => { x.anim = { ...x.anim, dur: v }; }, { els }); } }),
      h('button.btn.btn-ghost.block', { type: 'button', onclick: () => preview(els, cur) }, icon('play_arrow'), 'Putar'));
  },
});

// ================= Position / layers =================
R('pos', {
  title: 'Posisi',
  render(b, o) {
    const tab = o.tab || 'arr';
    b.append(h('div.pn-tabs', [['arr', 'Atur'], ['layers', 'Lapisan']].map(([k, l]) => h('button' + (tab === k ? '.on' : ''), { type: 'button', onclick: () => Panels.open('pos', { tab: k }) }, l))));
    if (tab === 'layers') return layers(b);
    const els = E.selEls(); if (!els.length) return;
    const C = (n) => E.emit('cmd', n);
    const big = (l, ic, fn) => h('button.btn.btn-ghost', { type: 'button', style: { justifyContent: 'flex-start' }, onclick: fn }, icon(ic), l);
    b.append(sec('Lapisan', h('div.g2', big('Ke depan', 'flip_to_front', () => E.order(1)), big('Ke belakang', 'flip_to_back', () => E.order(-1)), big('Paling depan', 'vertical_align_top', () => E.order('front')), big('Paling belakang', 'vertical_align_bottom', () => E.order('back')))));
    b.append(sec(els.length > 1 ? 'Ratakan elemen' : 'Ratakan ke halaman', h('div.g2',
      big('Atas', 'align_vertical_top', () => C('align:t')), big('Kiri', 'align_horizontal_left', () => C('align:l')),
      big('Tengah', 'align_vertical_center', () => C('align:m')), big('Tengah', 'align_horizontal_center', () => C('align:c')),
      big('Bawah', 'align_vertical_bottom', () => C('align:b')), big('Kanan', 'align_horizontal_right', () => C('align:r')))));
    if (els.length > 2) b.append(sec('Beri jarak', h('div.g2', big('Vertikal', 'vertical_distribute', () => distribute('y')), big('Horizontal', 'horizontal_distribute', () => distribute('x')))));
    if (els.length > 1) b.append(sec(null, big('Rapikan otomatis', 'auto_awesome_mosaic', () => tidy(els))));
    const one = E.one();
    if (one) {
      const num = (k, label, unit = '') => {
        const inp = h('input.tx', { type: 'number', value: round(one[k], 1), step: k === 'rot' ? 1 : 1 });
        inp.addEventListener('keydown', (e) => e.stopPropagation());
        inp.addEventListener('change', () => {
          const v = +inp.value;
          E.set(x => {
            if (k === 'w' && x.type !== 'text') { const ar = x.h / x.w; if (x.type === 'image' || x.type === 'svg' || x.type === 'qr') x.h = v * ar; x.w = v; }
            else if (k === 'h' && x.type !== 'text') { const ar = x.w / x.h; if (x.type === 'image' || x.type === 'svg' || x.type === 'qr') x.w = v * ar; x.h = v; }
            else if (k !== 'h') x[k] = v;
          });
          Panels.open('pos', o, true);
        });
        return h('label.fx', h('span.fx-l', label + (unit ? ` (${unit})` : '')), inp);
      };
      b.append(sec('Lanjutan', h('div.kv', num('w', 'Lebar', 'px'), num('h', 'Tinggi', 'px'), num('x', 'X', 'px'), num('y', 'Y', 'px'), num('rot', 'Rotasi', '°'))));
    }
  },
});
function distribute(ax) {
  const els = E.selEls(); if (els.length < 3) return;
  const k = ax === 'x' ? 'w' : 'h', bs = els.map(e => ({ e, b: bbox([e]) })).sort((a, c) => a.b[ax] - c.b[ax]);
  const first = bs[0].b, last = bs.at(-1).b, total = bs.reduce((s, x) => s + x.b[k], 0);
  const gap = (last[ax] + last[k] - first[ax] - total) / (bs.length - 1);
  let pos = first[ax];
  for (const { e, b } of bs) { e[ax] += pos - b[ax]; pos += b[k] + gap; E.emit('el', e.id); }
  E.commit('distribute');
}
function tidy(els) {
  // Arrange selected elements into an even grid inside their current bounds.
  const b = bbox(els), n = els.length, cols = Math.ceil(Math.sqrt(n * b.w / Math.max(1, b.h))), rows = Math.ceil(n / cols);
  const gap = Math.min(b.w, b.h) * .03, cw = (b.w - gap * (cols - 1)) / cols, rh = (b.h - gap * (rows - 1)) / rows;
  els.slice().sort((a, c) => (a.y - c.y) || (a.x - c.x)).forEach((e, i) => {
    const c = i % cols, r = Math.floor(i / cols), s = Math.min(cw / e.w, rh / e.h);
    e.w *= s; e.h *= s; if (e.size) e.size *= s;
    e.x = b.x + c * (cw + gap) + (cw - e.w) / 2; e.y = b.y + r * (rh + gap) + (rh - e.h) / 2; e.rot = 0;
  });
  Canvas.build(); E.commit('tidy');
}
function layers(b) {
  const list = h('div.layers');
  const arr = E.els().slice().reverse();
  let dragId = null;
  for (const e of arr) {
    const th = h('div.lthumb');
    if (e.type === 'text') th.append(h('b', { style: { fontFamily: fontStack(e.font), color: e.color, fontSize: '13px' } }, 'Aa'));
    else if (e.type === 'image' && e.src) assetURL(e.src).then(u => th.append(h('img', { src: u, style: { objectFit: 'cover', width: '100%', height: '100%' } })));
    else th.append(icon({ shape: 'category', line: 'horizontal_rule', svg: 'interests', path: 'draw', chart: 'bar_chart', table: 'table', qr: 'qr_code_2', image: 'image' }[e.type] || 'square', 'sm'));
    const name = e.type === 'text' ? (e.html.replace(/<[^>]+>/g, ' ').trim().slice(0, 40) || 'Teks') : (e.name || { shape: 'Bentuk', line: 'Garis', svg: 'Grafis', path: 'Gambar', chart: 'Grafik', table: 'Tabel', qr: e.kind === 'barcode' ? 'Barcode' : 'Kode QR', image: e.src ? 'Foto' : 'Bingkai' }[e.type]);
    const row = h('div.layer' + (E.sel.includes(e.id) ? '.on' : ''), { draggable: true }, th, h('span.ln-n', name),
      ib(e.lock ? 'lock' : 'lock_open', e.lock ? 'Buka kunci' : 'Kunci', (ev) => { ev.stopPropagation(); e.lock = !e.lock; E.commit('lock'); Panels.open('pos', { tab: 'layers' }, true); }, 'sm'),
      ib(e.hidden ? 'visibility_off' : 'visibility', e.hidden ? 'Tampilkan' : 'Sembunyikan', (ev) => { ev.stopPropagation(); e.hidden = !e.hidden; Canvas.build(); E.commit('hide'); Panels.open('pos', { tab: 'layers' }, true); }, 'sm'));
    row.onclick = (ev) => { if (ev.shiftKey) E.select([...E.sel, e.id], { raw: true }); else E.select(e.id, { raw: true }); Panels.open('pos', { tab: 'layers' }, true); };
    row.ondragstart = () => (dragId = e.id);
    row.ondragover = (ev) => { ev.preventDefault(); row.classList.add('drop'); };
    row.ondragleave = () => row.classList.remove('drop');
    row.ondrop = (ev) => {
      ev.preventDefault(); row.classList.remove('drop');
      if (!dragId || dragId === e.id) return;
      const els = E.page().els, from = els.findIndex(x => x.id === dragId);
      const [m] = els.splice(from, 1);
      const to = els.findIndex(x => x.id === e.id);
      els.splice(to + 1, 0, m);
      Canvas.build(); E.commit('layers'); Panels.open('pos', { tab: 'layers' }, true);
    };
    list.append(row);
  }
  if (!arr.length) list.append(h('p.muted.small', 'Halaman ini masih kosong.'));
  b.append(h('p.small.muted', { style: { margin: 0 } }, 'Seret untuk mengubah urutan. Teratas = paling depan.'), list);
}

// ================= Photo edit =================
const ADJ = [['bri', 'Kecerahan'], ['con', 'Kontras'], ['sat', 'Saturasi'], ['temp', 'Suhu'], ['tint', 'Rona'], ['hue', 'Warna'], ['fade', 'Pudar'], ['vig', 'Vinyet'], ['sep', 'Sepia'], ['blur', 'Buram']];
R('photo', {
  title: (o) => o.bg ? 'Edit latar' : 'Edit foto',
  keep: (o) => !!o.bg,
  render(b, o) {
    const bgMode = !!o.bg;
    const one = bgMode ? null : E.one();
    const tgt = bgMode ? E.page().bg.img : one;
    if (!tgt?.src) { b.append(h('p.muted.small', 'Pilih satu foto untuk diedit.')); return; }
    const tab = o.tab || 'flt';
    b.append(h('div.pn-tabs', [['flt', 'Filter'], ['adj', 'Sesuaikan'], ['bg', 'Latar']].filter(x => !bgMode || x[0] !== 'bg').map(([k, l]) => h('button' + (tab === k ? '.on' : ''), { type: 'button', onclick: () => Panels.open('photo', { ...o, tab: k }) }, l))));
    const apply = (f, commit = true) => {
      tgt.filter = f;
      if (bgMode) { Canvas.refreshBg(); if (commit) E.commit('filter'); }
      else E.set({ filter: f }, { els: [one], commit });
    };
    if (tab === 'flt') {
      assetURL(tgt.src).then(u => {
        const grid = h('div.fx-grid', Object.entries(FILTER_PRESETS).map(([k, [n, f]]) => {
          const it = h('button.fx-item.flt-item' + ((tgt.filter?.preset || 'none') === k ? '.on' : ''), { type: 'button', onclick: () => { apply(k === 'none' ? null : { ...f, preset: k }); Panels.open('photo', o, true); } },
            h('i', { style: { backgroundImage: `url("${u}")`, filter: filterCSS(f) } }), n);
          return it;
        }));
        b.append(grid);
        if (tgt.filter) b.append(h('button.btn.btn-text', { type: 'button', onclick: () => { apply(null); Panels.open('photo', o, true); } }, icon('restart_alt'), 'Atur ulang'));
      });
      return;
    }
    if (tab === 'adj') {
      b.append(h('button.btn.btn-tonal.block', { type: 'button', onclick: async () => { const u = await assetURL(tgt.src); const v = await autoEnhance(u).catch(() => null); if (v) { apply({ ...(tgt.filter || {}), ...v, preset: '' }); Panels.open('photo', o, true); toast('Foto ditingkatkan otomatis', { icon: 'auto_fix_high' }); } } }, icon('auto_fix_high'), 'Tingkatkan otomatis'));
      for (const [k, l] of ADJ) {
        const min = ['sep', 'blur', 'fade', 'vig'].includes(k) ? 0 : -100;
        b.append(slider({ label: l, min, max: 100, value: tgt.filter?.[k] || 0, oninput: (v) => apply({ ...(tgt.filter || {}), [k]: v, preset: tgt.filter?.preset || '' }, false), onchange: () => E.commit('adjust') }));
      }
      b.append(h('button.btn.btn-text', { type: 'button', onclick: () => { apply(null); Panels.open('photo', o, true); } }, icon('restart_alt'), 'Atur ulang penyesuaian'));
      return;
    }
    // background removal
    const status = h('p.small.muted', { style: { margin: 0 } });
    const run = async (kind) => {
      const btns = b.querySelectorAll('button'); btns.forEach(x => (x.disabled = true));
      try {
        const blob = await assetBlob(one.src);
        let out;
        if (kind === 'ai') {
          status.textContent = 'Menyiapkan model AI (unduhan pertama ±40 MB)…';
          out = await removeBgAI(blob, (key, p) => { status.textContent = (/fetch/.test(key) ? 'Mengunduh model… ' : 'Memproses… ') + Math.round(p * 100) + '%'; });
        } else {
          status.textContent = 'Menghapus warna latar…';
          out = await removeBgColor(blob, +(b.querySelector('.tol input.rng')?.value || 32));
        }
        const a = await addAsset(out, { name: 'Tanpa latar' });
        E.set(x => { x.src = a.src; x.orig = x.orig || one.src; });
        status.textContent = 'Selesai. Latar belakang dihapus.';
        toast('Latar belakang dihapus', { icon: 'background_replace' });
      } catch (err) {
        console.error(err);
        status.textContent = kind === 'ai' ? 'AI gagal dimuat di perangkat ini. Coba “Hapus warna latar”.' : 'Gagal memproses gambar.';
      } finally { btns.forEach(x => (x.disabled = false)); }
    };
    const tol = slider({ label: 'Toleransi warna', min: 4, max: 120, value: 32 }); tol.classList.add('tol');
    b.append(sec('Hapus latar belakang (AI)', h('p.small.muted', { style: { margin: 0 } }, 'Diproses di browser Anda — foto tidak diunggah ke server.'),
      h('button.btn.btn-brand.block', { type: 'button', onclick: () => run('ai') }, icon('auto_awesome'), 'Hapus latar otomatis')),
      sec('Hapus warna latar', h('p.small.muted', { style: { margin: 0 } }, 'Cocok untuk latar polos (putih, hijau, biru).'), tol,
        h('button.btn.btn-ghost.block', { type: 'button', onclick: () => run('color') }, icon('format_color_reset'), 'Hapus warna latar')),
      one.orig ? h('button.btn.btn-text', { type: 'button', onclick: () => { E.set(x => { x.src = x.orig; delete x.orig; }); status.textContent = 'Foto asli dipulihkan.'; } }, icon('undo'), 'Kembalikan foto asli') : null,
      status);
  },
});

// ================= Masks =================
R('mask', {
  title: 'Bentuk foto',
  render(b) {
    const els = E.selEls().filter(e => e.type === 'image'); const e = els[0]; if (!e) return;
    b.append(h('div.g4', Object.entries(MASKS).map(([k, n]) => {
      const d = k === 'rect' ? 'M0 0H60V60H0Z' : shapePath(k, 60, 60, k === 'rounded' ? 10 : 0);
      return h('button.tile', { type: 'button', dataset: { tip: n }, style: { boxShadow: (e.mask || 'rect') === k ? 'inset 0 0 0 2px var(--accent)' : '' }, html: `<svg viewBox="-2 -2 64 64"><path d="${d}" fill="#bdb6cf"/></svg>`, onclick: () => { E.set(x => { x.mask = k === 'rect' ? null : k; if (['circle', 'heart', 'star', 'hexagon', 'flower', 'seal', 'burst'].includes(k) && Math.abs(x.w - x.h) > 2) { const s = Math.min(x.w, x.h), cx = x.x + x.w / 2, cy = x.y + x.h / 2, imgW = x.iw * x.w, imgH = x.ih * x.h, il = x.x + x.ix * x.w, it = x.y + x.iy * x.h; x.w = x.h = s; x.x = cx - s / 2; x.y = cy - s / 2; x.iw = imgW / s; x.ih = imgH / s; x.ix = (il - x.x) / s; x.iy = (it - x.y) / s; x.ix = clamp(x.ix, 1 - x.iw, 0); x.iy = clamp(x.iy, 1 - x.ih, 0); } }, { els }); Panels.open('mask', {}, true); } });
    })));
  },
});

// ================= Shadow =================
const SHADOWS = [['Tidak ada', null], ['Lembut', { x: 0, y: 12, blur: 30, color: '#000000', op: 25 }], ['Tajam', { x: 10, y: 10, blur: 0, color: '#000000', op: 35 }], ['Melayang', { x: 0, y: 30, blur: 50, color: '#000000', op: 35 }], ['Cahaya', { x: 0, y: 0, blur: 30, color: '#7b3fe4', op: 80 }], ['Sudut', { x: 18, y: 18, blur: 14, color: '#000000', op: 30 }]];
R('shadow', {
  title: 'Bayangan',
  render(b) {
    const els = E.selEls(); const e = els[0]; if (!e) return;
    const k = Math.max(1, Math.min(E.d.w, E.d.h) / 1080);
    b.append(h('div.fx-grid', SHADOWS.map(([n, s]) => h('button.fx-item' + ((!s && !e.shadow) || (s && e.shadow && e.shadow.blur === s.blur * k && e.shadow.y === s.y * k) ? '.on' : ''), { type: 'button', onclick: () => { E.set({ shadow: s ? { ...s, x: s.x * k, y: s.y * k, blur: s.blur * k } : null }, { els }); Panels.open('shadow', {}, true); } },
      h('i', h('span', { style: { width: '44%', height: '44%', borderRadius: '8px', background: '#bdb6cf', display: 'block', boxShadow: s ? `${s.x / 3}px ${s.y / 3}px ${s.blur / 3}px rgba(${s.color === '#7b3fe4' ? '123,63,228' : '0,0,0'},${s.op / 100})` : 'none' } })), n))));
    if (e.shadow) {
      const s = e.shadow, sl = (key, label, min, max) => slider({ label, min, max, value: Math.round(s[key]), oninput: (v) => live(x => { x.shadow = { ...x.shadow, [key]: v }; }, els), onchange: () => done('shadow') });
      b.append(sec('Atur', sl('x', 'Offset X', -200, 200), sl('y', 'Offset Y', -200, 200), sl('blur', 'Buram', 0, 300), sl('op', 'Transparansi', 0, 100),
        h('div.row', h('span.small', { style: { flex: 1, fontWeight: 600, color: 'var(--tx2)' } }, 'Warna'), h('button.swatch', { type: 'button', style: { width: '32px', background: s.color }, onclick: (ev) => colorPopover(ev.currentTarget, s.color, (c) => live(x => { x.shadow = { ...x.shadow, color: c.slice(0, 7) }; }, els), { onDone: () => done('shadow') }) }))));
    }
  },
});

// ================= Chart =================
R('chart', {
  title: 'Grafik',
  render(b) {
    const e = E.one(); if (!e || e.type !== 'chart') return;
    const upd = debounce(() => E.set(() => {}, { els: [e] }), 250);
    b.append(sec('Jenis', h('div.g4', Object.entries(CHARTS).map(([k, n]) => h('button.tile', { type: 'button', dataset: { tip: n }, style: { boxShadow: e.chart === k ? 'inset 0 0 0 2px var(--accent)' : '' }, onclick: () => { E.set({ chart: k }, { els: [e] }); Panels.open('chart', {}, true); } }, icon({ bar: 'bar_chart', hbar: 'align_horizontal_left', stack: 'stacked_bar_chart', line: 'show_chart', area: 'area_chart', pie: 'pie_chart', donut: 'donut_large', ring: 'progress_activity' }[k]))))));
    const single = ['pie', 'donut', 'ring'].includes(e.chart);
    const S = single ? 1 : e.series.length;
    const tbl = h('table.data-grid');
    const head = h('tr', h('td', h('input', { value: 'Label', disabled: true })), ...Array.from({ length: S }, (_, s) => h('td', h('input', { value: e.series[s] || '', oninput: (ev) => { e.series[s] = ev.target.value; upd(); } }))));
    tbl.append(head);
    e.data.forEach((r, i) => tbl.append(h('tr', h('td', h('input', { value: r[0], oninput: (ev) => { r[0] = ev.target.value; upd(); } })), ...Array.from({ length: S }, (_, s) => h('td', h('input', { type: 'number', value: r[s + 1] ?? 0, oninput: (ev) => { r[s + 1] = +ev.target.value; upd(); } }))))));
    tbl.querySelectorAll('input').forEach(i => i.addEventListener('keydown', (k) => k.stopPropagation()));
    b.append(sec('Data', tbl, h('div.row',
      h('button.btn.btn-ghost.sm', { type: 'button', onclick: () => { e.data.push(['Baru', ...Array(e.series.length).fill(10)]); E.set(() => {}, { els: [e] }); Panels.open('chart', {}, true); } }, icon('add'), 'Baris'),
      e.data.length > 1 ? h('button.btn.btn-ghost.sm', { type: 'button', onclick: () => { e.data.pop(); E.set(() => {}, { els: [e] }); Panels.open('chart', {}, true); } }, icon('remove'), 'Baris') : null,
      single ? null : h('button.btn.btn-ghost.sm', { type: 'button', onclick: () => { e.series.push('Seri ' + (e.series.length + 1)); e.data.forEach(r => r.push(10)); E.set(() => {}, { els: [e] }); Panels.open('chart', {}, true); } }, icon('add'), 'Seri'),
      !single && e.series.length > 1 ? h('button.btn.btn-ghost.sm', { type: 'button', onclick: () => { e.series.pop(); e.data.forEach(r => r.splice(e.series.length + 1)); E.set(() => {}, { els: [e] }); Panels.open('chart', {}, true); } }, icon('remove'), 'Seri') : null),
      h('button.btn.btn-text', { type: 'button', onclick: () => pasteData(e) }, icon('content_paste'), 'Tempel dari spreadsheet')));
    const n = single ? Math.max(e.data.length, 2) : e.series.length;
    b.append(sec('Warna', h('div.swatches', e.colors.slice(0, n).map((c, i) => h('button.swatch', { type: 'button', style: { background: c }, onclick: (ev) => colorPopover(ev.currentTarget, c, (v) => { e.colors[i] = v.slice(0, 7); upd(); }, { onDone: () => Panels.open('chart', {}, true) }) })))));
    b.append(sec('Tampilan',
      ...[['grid', 'Garis kisi'], ['labels', 'Label nilai'], ['legend', 'Keterangan']].map(([k, l]) => h('label.sw', h('input', { type: 'checkbox', checked: !!e[k], onchange: (ev) => E.set({ [k]: ev.target.checked }, { els: [e] }) }), h('i'), l)),
      h('button.btn.btn-ghost', { type: 'button', onclick: () => Panels.open('font') }, icon('font_download'), e.font)));
  },
});
async function pasteData(e) {
  let t = '';
  try { t = await navigator.clipboard.readText(); } catch { toast('Izinkan akses papan klip, atau tempel manual'); return; }
  const rows = t.trim().split(/\r?\n/).map(r => r.split(/\t|;|,(?=\S)/));
  if (rows.length < 2) return toast('Salin minimal dua baris dari spreadsheet');
  e.series = rows[0].slice(1).map(s => s.trim() || 'Seri');
  e.data = rows.slice(1).map(r => [r[0], ...r.slice(1).map(v => +String(v).replace(/[^\d.-]/g, '') || 0)]);
  E.set(() => {}, { els: [e] }); Panels.open('chart', {}, true);
}

// ================= Table =================
const TSTYLES = [['Ungu', '#7b3fe4', '#ffffff', '#ffffff', '#f4f1fb', '#d9d4e6'], ['Biru', '#1d4ed8', '#ffffff', '#ffffff', '#eff6ff', '#dbeafe'], ['Gelap', '#111827', '#ffffff', '#1f2937', '#273244', '#374151'], ['Hijau', '#047857', '#ffffff', '#ffffff', '#ecfdf5', '#a7f3d0'], ['Minimal', null, '#111111', '#ffffff', '#ffffff', '#e5e7eb'], ['Hangat', '#b45309', '#ffffff', '#fffbeb', '#fef3c7', '#fde68a']];
R('table', {
  title: 'Tabel',
  render(b) {
    const e = E.one(); if (!e || e.type !== 'table') return;
    const mut = (fn) => { fn(); e.cols = Array(e.rows[0].length).fill(1 / e.rows[0].length); E.set(() => {}, { els: [e] }); Panels.open('table', {}, true); };
    b.append(sec('Struktur', h('div.g2',
      h('button.btn.btn-ghost', { type: 'button', onclick: () => mut(() => e.rows.push(Array(e.rows[0].length).fill(''))) }, icon('add_row_below'), 'Tambah baris'),
      h('button.btn.btn-ghost', { type: 'button', onclick: () => mut(() => e.rows.forEach((r, i) => r.push(i === 0 ? 'Judul' : ''))) }, icon('add_column_right'), 'Tambah kolom'),
      h('button.btn.btn-ghost', { type: 'button', disabled: e.rows.length < 2, onclick: () => mut(() => e.rows.pop()) }, icon('remove'), 'Hapus baris'),
      h('button.btn.btn-ghost', { type: 'button', disabled: e.rows[0].length < 2, onclick: () => mut(() => e.rows.forEach(r => r.pop())) }, icon('remove'), 'Hapus kolom')),
      h('button.btn.btn-tonal', { type: 'button', onclick: () => Canvas.startEdit(e.id) }, icon('edit'), 'Edit isi sel')));
    b.append(sec('Gaya', h('div.g3', TSTYLES.map(([n, hd, hc, cell, stripe, border]) => h('button.tile', { type: 'button', style: { aspectRatio: '1.3', padding: '6px', display: 'grid', gap: '2px' }, onclick: () => E.set({ head: hd, headColor: hc, cell, stripe, border, color: cell === '#1f2937' ? '#f3f4f6' : '#1d1d24' }, { els: [e] }) },
      h('div', { style: { display: 'grid', gridTemplateRows: 'repeat(3,1fr)', width: '100%', height: '100%', gap: '1px', background: border, borderRadius: '4px', overflow: 'hidden' } }, h('i', { style: { background: hd || cell } }), h('i', { style: { background: stripe } }), h('i', { style: { background: cell } })))))));
    b.append(sec('Ukuran', slider({ label: 'Ukuran font', min: 6, max: 120, value: Math.round(e.size), oninput: (v) => live({ size: v }, [e]), onchange: () => done('tbl') }),
      slider({ label: 'Ruang sel', min: 0, max: 60, value: Math.round(e.pad), oninput: (v) => live({ pad: v }, [e]), onchange: () => done('tbl') }),
      slider({ label: 'Garis batas', min: 0, max: 10, value: e.bw, oninput: (v) => live({ bw: v }, [e]), onchange: () => done('tbl') })));
  },
});

// ================= QR / Barcode =================
const QR_KINDS = [['url', 'Tautan', 'link'], ['wa', 'WhatsApp', 'chat'], ['wifi', 'Wi-Fi', 'wifi'], ['mail', 'Email', 'mail'], ['text', 'Teks', 'notes']];
Panels.register('qr', {
  title: 'Kode QR', rail: 'apps', back: 'apps',
  render(b) {
    const one = E.one(), edit = one?.type === 'qr' && one.kind !== 'barcode' ? one : null;
    const st = edit?.qr || { kind: 'url', url: 'https://', phone: '', msg: '', ssid: '', pass: '', sec: 'WPA', mail: '', text: '', fg: '#111111', bg: '#ffffff', style: 'square', ecc: 'M' };
    const form = h('div.pn-sec');
    const data = () => ({ url: st.url, wa: `https://wa.me/${(st.phone || '').replace(/\D/g, '').replace(/^0/, '62')}${st.msg ? '?text=' + encodeURIComponent(st.msg) : ''}`, wifi: `WIFI:T:${st.sec};S:${st.ssid};P:${st.pass};;`, mail: `mailto:${st.mail}`, text: st.text }[st.kind]);
    const field = (k, label, ph, type = 'text') => h('label.fx', h('span.fx-l', label), h('input.tx', { type, value: st[k] || '', placeholder: ph, oninput: (e) => { st[k] = e.target.value; }, onkeydown: (e) => e.stopPropagation() }));
    const drawForm = () => {
      form.textContent = '';
      form.append(h('div.chips', QR_KINDS.map(([k, l, ic]) => h('button.chip' + (st.kind === k ? '.on' : ''), { type: 'button', onclick: () => { st.kind = k; drawForm(); } }, icon(ic, 'xs'), l))));
      if (st.kind === 'url') form.append(field('url', 'Tautan', 'https://contoh.com'));
      if (st.kind === 'wa') form.append(field('phone', 'Nomor WhatsApp', '0812…', 'tel'), field('msg', 'Pesan awal (opsional)', 'Halo, saya ingin pesan…'));
      if (st.kind === 'wifi') form.append(field('ssid', 'Nama jaringan (SSID)', 'WiFi Kantor'), field('pass', 'Kata sandi', '••••••••'), h('label.fx', h('span.fx-l', 'Keamanan'), (() => { const s = h('select.tx', { onchange: (e) => (st.sec = e.target.value) }, ['WPA', 'WEP', 'nopass'].map(x => h('option', { value: x }, x === 'nopass' ? 'Tanpa sandi' : x))); s.value = st.sec; return s; })()));
      if (st.kind === 'mail') form.append(field('mail', 'Email', 'nama@contoh.com', 'email'));
      if (st.kind === 'text') form.append(h('label.fx', h('span.fx-l', 'Teks'), h('textarea.tx', { value: st.text, oninput: (e) => (st.text = e.target.value), onkeydown: (e) => e.stopPropagation() })));
      form.append(h('div.fx', h('span.fx-l', 'Gaya titik'), h('div.seg.full', [['square', 'Kotak'], ['rounded', 'Bulat'], ['dots', 'Titik']].map(([k, l]) => h('button' + (st.style === k ? '.on' : ''), { type: 'button', onclick: () => { st.style = k; drawForm(); } }, l)))),
        h('div.row', ...[['fg', 'Warna kode'], ['bg', 'Latar']].map(([k, l]) => h('div.row', { style: { flex: 1 } }, h('button.swatch', { type: 'button', style: { width: '32px', background: st[k] }, onclick: (ev) => colorPopover(ev.currentTarget, st[k], (c) => { st[k] = c.slice(0, 7); ev.target.style.background = c; }, { alpha: false }) }), h('span.small', l)))));
    };
    drawForm();
    const go = async () => {
      const d = data();
      if (!d || d === 'https://') return toast('Isi datanya dulu');
      try {
        const svg = await qrSVG(d, { fg: st.fg, bg: st.bg, ecc: st.ecc, style: st.style });
        if (edit) E.set({ svg, data: d, qr: { ...st } }, { els: [edit] });
        else { const s = Math.min(E.d.w, E.d.h) * .32; E.add((await import('../model.js')).qrEl(d, { w: s, h: s, svg, qr: { ...st } }), { at: Canvas.centerOfView() }); }
      } catch { toast('Pustaka QR gagal dimuat. Periksa koneksi internet.'); }
    };
    b.append(form, h('button.btn.btn-primary.block', { type: 'button', onclick: go }, icon('qr_code_2'), edit ? 'Perbarui kode QR' : 'Buat kode QR'));
  },
});
Panels.register('barcode', {
  title: 'Barcode', rail: 'apps', back: 'apps',
  render(b) {
    const one = E.one(), edit = one?.type === 'qr' && one.kind === 'barcode' ? one : null;
    const st = edit?.bc || { data: '8991234567891', format: 'EAN13', fg: '#111111', text: true };
    const inp = h('input.tx', { value: st.data, oninput: (e) => (st.data = e.target.value), onkeydown: (e) => e.stopPropagation() });
    const fmt = h('select.tx', { onchange: (e) => (st.format = e.target.value) }, [['EAN13', 'EAN-13 (produk ritel)'], ['UPC', 'UPC-A'], ['CODE128', 'Code 128 (bebas)'], ['CODE39', 'Code 39'], ['ITF14', 'ITF-14 (kardus)']].map(([v, l]) => h('option', { value: v }, l)));
    fmt.value = st.format;
    const go = async () => {
      try {
        const r = await barcodeSVG(st.data, { format: st.format, fg: st.fg, text: st.text });
        const s = Math.min(E.d.w, E.d.h) * .45;
        if (edit) E.set({ svg: r.svg, data: st.data, bc: { ...st }, h: edit.w * r.h / r.w }, { els: [edit] });
        else E.add((await import('../model.js')).qrEl(st.data, { kind: 'barcode', svg: r.svg, w: s, h: s * r.h / r.w, bc: { ...st } }), { at: Canvas.centerOfView() });
      } catch (err) { toast('Data tidak valid untuk format ' + st.format); }
    };
    b.append(h('label.fx', h('span.fx-l', 'Format'), fmt), h('label.fx', h('span.fx-l', 'Data'), inp),
      h('label.sw', h('input', { type: 'checkbox', checked: st.text, onchange: (e) => (st.text = e.target.checked) }), h('i'), 'Tampilkan angka'),
      h('button.btn.btn-primary.block', { type: 'button', onclick: go }, icon('barcode'), edit ? 'Perbarui barcode' : 'Buat barcode'));
  },
});

// ================= AI image =================
const AI_STYLES = [['', 'Tanpa gaya'], ['photorealistic, 35mm photo', 'Foto'], ['3d render, octane, soft light', '3D'], ['flat vector illustration', 'Ilustrasi'], ['watercolor painting', 'Cat air'], ['anime style', 'Anime'], ['minimal line art', 'Garis'], ['cinematic, dramatic lighting', 'Sinematik']];
Panels.register('aiimage', {
  title: 'Teks ke Gambar', rail: 'apps', back: 'apps',
  render(b) {
    let style = '', ar = [1, 1];
    const ta = h('textarea.tx', { placeholder: 'Contoh: secangkir kopi di meja kayu dengan cahaya pagi, gaya hangat', onkeydown: (e) => e.stopPropagation() });
    const out = h('div.g2');
    const go = async () => {
      const p = ta.value.trim(); if (!p) return toast('Tulis deskripsi gambar dulu');
      if (!aiKey() && !(await askKey())) return;
      out.textContent = '';
      for (let i = 0; i < 4; i++) {
        const w = 768, hh = Math.round(768 * ar[1] / ar[0]);
        const tile = h('button.ptile.tile.ph', { type: 'button', style: { aspectRatio: `${ar[0]} / ${ar[1]}`, padding: 0 } });
        out.append(tile);
        generateImage(p, { w, h: hh, style }).then(blob => {
          tile.classList.remove('ph');
          tile.append(h('img', { src: URL.createObjectURL(blob), alt: p, style: { width: '100%', height: '100%', objectFit: 'cover' } }));
          tile.onclick = async () => insertAsset(await addAsset(blob, { name: 'Gambar AI' }));
        }).catch(err => { tile.classList.remove('ph'); tile.append(h('small.muted', err.code === 'badkey' ? 'Kunci ditolak' : 'Gagal')); });
      }
    };
    b.append(h('label.fx', h('span.fx-l', 'Deskripsikan gambar'), ta),
      h('div.fx', h('span.fx-l', 'Gaya'), h('div.chips', AI_STYLES.map(([v, l]) => h('button.chip' + (style === v ? '.on' : ''), { type: 'button', onclick: (e) => { style = v; e.currentTarget.parentNode.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === e.currentTarget)); } }, l)))),
      h('div.fx', h('span.fx-l', 'Rasio'), h('div.seg.full', [[[1, 1], 'Persegi'], [[16, 9], 'Lanskap'], [[9, 16], 'Potret']].map(([v, l], i) => h('button' + (i === 0 ? '.on' : ''), { type: 'button', onclick: (e) => { ar = v; e.currentTarget.parentNode.querySelectorAll('button').forEach(c => c.classList.toggle('on', c === e.currentTarget)); } }, l)))),
      h('button.btn.btn-brand.block', { type: 'button', onclick: go }, icon('auto_awesome'), 'Buat gambar'), out,
      h('p.small.muted', { style: { margin: 0 } }, 'Dibuat oleh layanan Pollinations AI dengan kunci Anda sendiri. Hasil bisa berbeda setiap kali.'),
      h('button.btn.btn-text', { type: 'button', onclick: () => askKey() }, icon('key'), 'Atur kunci AI'));
  },
});

// ================= AI write =================
Panels.register('aiwrite', {
  title: 'Tulis Ajaib', rail: 'apps', back: 'apps',
  render(b) {
    let kind = 'caption media sosial', tone = 'ramah';
    const ta = h('textarea.tx', { placeholder: 'Contoh: promo kopi susu gula aren diskon 20% akhir pekan', onkeydown: (e) => e.stopPropagation() });
    const out = h('div.pn-sec');
    const go = async (btn) => {
      const p = ta.value.trim(); if (!p) return toast('Tulis topiknya dulu');
      btn.disabled = true; out.textContent = ''; out.append(h('div.tile.ph', { style: { aspectRatio: '3' } }));
      try {
        const t = await writeText(p, { kind, tone });
        out.textContent = '';
        const box = h('div', { style: { whiteSpace: 'pre-wrap', padding: '12px', borderRadius: '12px', background: 'var(--card)', border: '1px solid var(--line)', fontSize: '14px' } }, t);
        out.append(box, h('div.row', h('button.btn.btn-primary.sm', { type: 'button', onclick: () => { const el = textEl({ html: esc(t).replace(/\n/g, '<br>'), size: Math.max(16, Math.round(E.d.w / 40)), w: E.d.w * .6, font: Brand.d.fonts.body }); E.add(el, { at: Canvas.centerOfView() }); } }, icon('add'), 'Tambahkan ke desain'),
          h('button.btn.btn-ghost.sm', { type: 'button', onclick: () => navigator.clipboard?.writeText(t).then(() => toast('Disalin')) }, icon('content_copy'), 'Salin'),
          h('button.btn.btn-text.sm', { type: 'button', onclick: (e) => go(e.currentTarget) }, icon('refresh'), 'Lagi')));
      } catch (err) { out.textContent = ''; out.append(h('p.muted.small', err.code === 'nokey' ? 'Isi kunci AI terlebih dahulu.' : err.code === 'badkey' ? 'Kunci AI ditolak. Periksa lagi kuncinya.' : 'Layanan AI sedang tidak tersedia. Coba lagi nanti.')); }
      btn.disabled = false;
    };
    const chips = (list, get, set) => h('div.chips', list.map(v => h('button.chip' + (get() === v ? '.on' : ''), { type: 'button', onclick: (e) => { set(v); e.currentTarget.parentNode.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === e.currentTarget)); } }, v)));
    b.append(h('label.fx', h('span.fx-l', 'Topik'), ta),
      h('div.fx', h('span.fx-l', 'Jenis'), chips(['caption media sosial', 'judul iklan', 'slogan', 'deskripsi produk', 'undangan'], () => kind, v => (kind = v))),
      h('div.fx', h('span.fx-l', 'Nada'), chips(['ramah', 'profesional', 'lucu', 'mewah', 'semangat'], () => tone, v => (tone = v))),
      h('button.btn.btn-brand.block', { type: 'button', onclick: (e) => go(e.currentTarget) }, icon('edit_note'), 'Tulis'), out,
      h('button.btn.btn-text', { type: 'button', onclick: () => askKey() }, icon('key'), 'Atur kunci AI'));
  },
});

// ================= Palette from photo =================
Panels.register('palette', {
  title: 'Palet dari Foto', rail: 'apps', back: 'apps',
  render(b) {
    const out = h('div.pn-sec');
    const run = async (src) => {
      out.textContent = ''; out.append(h('div.tile.ph', { style: { aspectRatio: '4' } }));
      const u = await assetURL(src);
      const cols = await extractPalette(u, 6).catch(() => []);
      out.textContent = '';
      if (!cols.length) return out.append(h('p.muted.small', 'Tidak bisa membaca warna gambar ini.'));
      out.append(h('img', { src: u, style: { width: '100%', borderRadius: '12px', maxHeight: '180px', objectFit: 'cover' } }),
        h('div', { style: { display: 'flex', height: '54px', borderRadius: '12px', overflow: 'hidden' } }, cols.map(c => h('button', { type: 'button', style: { flex: 1, border: 0, background: c, cursor: 'pointer' }, dataset: { tip: c.toUpperCase() + ' — klik untuk menyalin' }, onclick: () => navigator.clipboard?.writeText(c).then(() => toast(c.toUpperCase() + ' disalin')) }))),
        h('div.g2', h('button.btn.btn-primary', { type: 'button', onclick: () => applyPal(cols) }, icon('format_paint'), 'Terapkan'),
          h('button.btn.btn-ghost', { type: 'button', onclick: () => { Brand.d.palettes.push({ name: 'Dari foto', colors: cols }); Brand.save(); toast('Disimpan ke Brand Kit'); } }, icon('bookmark_add'), 'Simpan ke merek')));
    };
    const one = E.one();
    b.append(h('div.g2', h('button.btn.btn-ghost', { type: 'button', disabled: !(one?.type === 'image' && one.src), onclick: () => run(one.src) }, icon('image'), 'Foto terpilih'),
      h('button.btn.btn-ghost', { type: 'button', onclick: async () => { const [f] = await pickFiles('image/*', false); if (!f) return; const a = await addAsset(f, { uploaded: true, name: f.name }); run(a.src); } }, icon('upload'), 'Unggah foto')), out);
    if (one?.type === 'image' && one.src) run(one.src);
  },
});
const applyPal = (cols) => applyPaletteDirect(cols);
function applyPaletteDirect(cs) {
  const used = [...new Set(E.d.pages.flatMap(p => [p.bg.fill, ...p.els.flatMap(e => [e.fill, e.color])]).filter(c => typeof c === 'string' && c.startsWith('#')).map(c => c.toLowerCase().slice(0, 7)))];
  const map = new Map(used.map((c, i) => [c, cs[i % cs.length]]));
  const sw = (c) => (typeof c === 'string' && map.get(c.toLowerCase().slice(0, 7))) || c;
  for (const p of E.d.pages) { if (typeof p.bg.fill === 'string') p.bg.fill = sw(p.bg.fill); for (const e of p.els) { if (typeof e.fill === 'string') e.fill = sw(e.fill); if (e.color) e.color = sw(e.color); } }
  Canvas.build(); E.commit('palette');
}

// ================= Shape text =================
export function wireShapeText() {
  E.on('shapeText', (id) => {
    const e = E.get(id); if (!e || e.type !== 'shape') return;
    // Convert to a text element grouped on top of the shape — simpler editing, same look.
    const g = e.gid || ('g' + Math.random().toString(36).slice(2, 8));
    e.gid = g;
    const s = Math.max(14, Math.min(e.w, e.h) / 6);
    const t = textEl({ html: 'Teks', font: Brand.d.fonts.body, size: s, color: '#1d1d24', align: 'center', w: e.w * .84, x: e.x + e.w * .08, y: e.y + e.h / 2 - s * .7, gid: g, rot: e.rot });
    const arr = E.page(E.pageOf(id)).els; arr.splice(arr.indexOf(e) + 1, 0, t);
    Canvas.build(); E.commit('shapeText');
    setTimeout(() => Canvas.startEdit(t.id), 30);
  });
}
