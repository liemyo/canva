// Editor shell: header, footer, keyboard shortcuts, clipboard and insert helpers.
import { E } from './state.js';
import { Canvas, contextMenu, fillImage, addPage } from './canvas.js';
import { Toolbar } from './toolbar.js';
import { Panels } from './panels.js';
import { wireShapeText } from './ctxpanels.js';
import { present } from './present.js';
import { h, icon, ib, menu, dialog, toast, kbd, mod, clamp, slider, promptDlg, confirmDlg, uid, download, pickFiles, readAsText } from '../util.js';
import { Store } from '../store.js';
import { textEl, shapeEl, lineEl, imageEl, cloneEls, bbox, newDesign, clonePage } from '../model.js';
import { addAsset, fetchAsset, assetURL } from '../assets.js';
import { thumb } from '../render.js';
import { logoSVG } from '../logo.js';
import { openExport } from '../export.js';
import { openResize } from '../tools/resize.js';
import { themeMenu } from '../home.js';
import { Brand } from '../brand.js';
import { loadFonts } from '../fonts.js';
import { designFonts } from '../model.js';

let root, offs = [];

export async function openEditor(id, mount) {
  const d = await Store.getDesign(id);
  if (!d) { toast('Desain tidak ditemukan'); location.hash = '#/'; return; }
  await Brand.load();
  E.reset();
  Object.assign(E, { d, pi: 0, sel: [], z: 1, editing: null, crop: null, tool: null });
  loadFonts(designFonts(d));
  document.title = d.name + ' — Amatu Design';
  root = h('div.ed');
  const hdr = header(), rail = h('nav.rail.glass.refract', { 'aria-label': 'Alat' }), panel = h('aside.panel.glass.refract');
  const ctx = h('div.ctx.glass.refract'), ws = h('div.ws', { tabIndex: -1 }), foot = footer();
  const work = h('div.work', ctx, ws, foot);
  root.append(hdr, h('div.ed-body', rail, panel, work));
  mount.append(root);
  Canvas.mount(ws);
  Toolbar.mount(ctx);
  Panels.mount(rail, panel);
  E.initHistory();
  wireEvents();
  requestAnimationFrame(() => Canvas.fit());
  if (innerWidth > 820) Panels.open(d.pages.length === 1 && !d.pages[0].els.length ? 'design' : 'design');
}
export function closeEditor() {
  E.emit('endEdit');
  E.save.flush?.();
  offs.forEach(f => f()); offs = [];
  root?.remove(); root = null;
  E.reset();
}

// ---------- header ----------
function header() {
  const name = h('input.dname', { value: E.d.name, 'aria-label': 'Nama desain', spellcheck: false });
  name.addEventListener('change', () => { E.d.name = name.value.trim() || 'Desain tanpa judul'; name.value = E.d.name; document.title = E.d.name + ' — Amatu Design'; E.save(); });
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') name.blur(); e.stopPropagation(); });
  const undo = ib('undo', 'Urungkan', () => E.undo()); undo.dataset.kbd = 'Ctrl+Z';
  const redo = ib('redo', 'Ulangi', () => E.redo()); redo.dataset.kbd = 'Ctrl+Shift+Z';
  const st = h('span.save-st.hide-sm', icon('cloud_done'), h('span', 'Tersimpan'));
  E.on('hist', () => { undo.classList.toggle('dis', !E.canUndo()); redo.classList.toggle('dis', !E.canRedo()); });
  E.on('saving', (v) => { st.firstChild.textContent = v ? 'cloud_sync' : 'cloud_done'; st.lastChild.textContent = v ? 'Menyimpan…' : 'Tersimpan'; });
  const fileBtn = h('button.hb', { type: 'button', onclick: (e) => fileMenu(e.currentTarget) }, 'File', icon('expand_more', 'sm'));
  const sizeBtn = h('button.hb.hide-sm', { type: 'button', onclick: () => openResize() }, icon('aspect_ratio', 'sm'), 'Ubah ukuran');
  return h('header.ed-hdr.glass.refract',
    h('a.logo', { href: '#/', 'aria-label': 'Beranda', dataset: { tip: 'Beranda' }, html: logoSVG + '<span>Amatu <b>Design</b></span>' }),
    h('span.vsep'), fileBtn, sizeBtn, h('span.vsep.hide-sm'), undo, redo, st,
    h('span.grow'), name,
    ib('contrast', 'Tema & tampilan', (e) => themeMenu(e.currentTarget), 'hide-sm'),
    h('button.btn.btn-ghost.hide-sm', { type: 'button', onclick: () => present(E.d, E.pi) }, icon('slideshow'), h('span.hide-md', 'Presentasikan')),
    h('button.btn.btn-primary', { type: 'button', onclick: () => openExport(E.d, { page: E.pi }) }, icon('ios_share'), 'Bagikan'));
}

function fileMenu(anchor) {
  const C = (n) => E.emit('cmd', n);
  menu(anchor, [
    { head: E.d.name },
    { label: 'Buat desain baru', icon: 'add', run: () => (location.hash = '#/new') },
    { label: 'Salin desain', icon: 'file_copy', run: async () => { const c = JSON.parse(JSON.stringify(E.d)); c.id = uid('d'); c.name = 'Salinan ' + E.d.name; c.created = Date.now(); await Store.putDesign(c); toast('Salinan dibuat', { action: { label: 'Buka', run: () => (location.hash = '#/design/' + c.id) } }); } },
    { label: 'Ubah ukuran', icon: 'aspect_ratio', run: () => openResize() },
    { sep: 1 },
    { label: 'Unduh', icon: 'download', run: () => openExport(E.d, { page: E.pi }) },
    { label: 'Simpan file proyek (.amatu)', icon: 'save', run: () => saveProjectFile() },
    { label: 'Impor file proyek', icon: 'upload_file', run: () => importProjectFile() },
    { sep: 1 },
    { label: 'Tampilan', icon: 'visibility', sub: [
      { label: 'Tampilkan margin', checked: !!E.view?.margin, run: () => toggleView('margin') },
      { label: 'Tampilkan bleed cetak', checked: !!E.view?.bleed, run: () => toggleView('bleed') },
      { label: 'Tampilkan kisi', checked: !!E.view?.grid, run: () => toggleView('grid') },
    ] },
    { label: 'Tema & tampilan', icon: 'palette', run: () => themeMenu(anchor) },
    { label: 'Pintasan keyboard', icon: 'keyboard', kbd: '?', run: () => shortcuts() },
    { sep: 1 },
    { label: 'Hapus desain', icon: 'delete', danger: true, run: async () => { if (await confirmDlg('Hapus desain?', `“${E.d.name}” akan dihapus permanen dari perangkat ini.`, 'Hapus', true)) { await Store.deleteDesign(E.d.id); location.hash = '#/'; } } },
    { label: 'Kembali ke beranda', icon: 'home', run: () => (location.hash = '#/') },
  ]);
}
function toggleView(k) {
  E.view = { ...(E.view || {}), [k]: !E.view?.[k] };
  root.classList.toggle('v-' + k, E.view[k]);
  document.querySelectorAll('.pg').forEach(pg => {
    pg.querySelector('.vguide.' + k)?.remove();
    if (E.view[k]) pg.append(h('i.vguide.' + k));
  });
}
function saveProjectFile() {
  E.save.flush?.();
  import('../export.js').then(m => m.exportProject(E.d));
}
async function importProjectFile() {
  const [f] = await pickFiles('.amatu,.json,application/json', false);
  if (!f) return;
  import('../export.js').then(m => m.importProject(f));
}

// ---------- footer ----------
function footer() {
  const zr = slider({ min: 10, max: 400, value: 100, oninput: (v) => Canvas.setZoom(v / 100) });
  zr.classList.add('zr');
  const zp = h('button.tb.zp', { type: 'button', onclick: (e) => menu(e.currentTarget, [
    { label: 'Sesuaikan layar', icon: 'fit_screen', kbd: 'Ctrl+0', run: () => Canvas.fit() },
    { sep: 1 }, ...[10, 25, 50, 75, 100, 125, 150, 200, 300].map(z => ({ label: z + '%', run: () => Canvas.setZoom(z / 100) })),
  ], { pos: 'top-end' }) }, '100%');
  const pinfo = h('span.pinfo');
  const notesBtn = h('button.tb', { type: 'button', onclick: () => toggleNotes() }, icon('sticky_note_2', 'sm'), h('span.hide-sm', 'Catatan'));
  const timerBtn = h('button.tb.hide-sm', { type: 'button', onclick: (e) => durationMenu(e.currentTarget) }, icon('timer', 'sm'), h('span', 'Durasi'));
  const gridBtn = ib('grid_view', 'Tampilan kisi', () => toggleGrid(), 'sm');
  const upd = () => {
    zp.textContent = Math.round(E.z * 100) + '%'; zr.set(clamp(Math.round(E.z * 100), 10, 400));
    pinfo.textContent = `Halaman ${E.pi + 1} / ${E.d.pages.length}`;
  };
  E.on('zoom', upd); E.on('page', upd); E.on('full', upd); E.on('change', upd);
  setTimeout(upd);
  const f = h('footer.foot.glass.refract', notesBtn, timerBtn, h('span.grow'), zr, zp, pinfo, gridBtn,
    ib('fullscreen', 'Layar penuh', () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()), 'sm hide-sm'),
    ib('help', 'Pintasan & bantuan', () => shortcuts(), 'sm'));
  return f;
}
function durationMenu(anchor) {
  const p = E.page();
  menu(anchor, [{ head: 'Durasi halaman (presentasi otomatis)' }, ...[3, 5, 7, 10, 15, 20, 30].map(s => ({ label: s + ' detik', checked: (p.dur || 5) === s, run: () => { p.dur = s; E.commit('dur'); } })),
    { sep: 1 }, { label: 'Terapkan ke semua halaman', icon: 'done_all', run: () => { E.d.pages.forEach(x => (x.dur = p.dur || 5)); E.commit('dur'); toast('Durasi diterapkan ke semua halaman'); } }], { pos: 'top-start' });
}
let notesEl;
function toggleNotes() {
  if (notesEl) { notesEl.remove(); notesEl = null; return; }
  const ta = h('textarea', { placeholder: 'Tulis catatan pembicara untuk halaman ini…' });
  const sync = () => { ta.value = E.page().notes || ''; title.textContent = 'Catatan · Halaman ' + (E.pi + 1); };
  const title = h('b.small');
  ta.addEventListener('input', () => { E.page().notes = ta.value; E.save(); });
  ta.addEventListener('keydown', (e) => e.stopPropagation());
  notesEl = h('div.notes.glass-strong', h('div.row', title, h('span.grow'), ib('close', 'Tutup', () => toggleNotes(), 'sm')), ta);
  root.querySelector('.work').append(notesEl);
  sync();
  const off = E.on('page', () => notesEl && sync());
  notesEl.addEventListener('remove', off);
}
let gridEl;
function toggleGrid() {
  if (gridEl) { gridEl.remove(); gridEl = null; return; }
  gridEl = h('div.gridv.glass-strong');
  let dragI = -1;
  const draw = () => {
    gridEl.textContent = '';
    E.d.pages.forEach((p, i) => {
      const it = h('div.gv-item' + (i === E.pi ? '.cur' : ''), { draggable: true },
        thumb(p, E.d, 190, 150), h('small', (i + 1) + (p.title ? ' · ' + p.title : '')));
      it.onclick = () => { E.pi = i; E.emit('page'); toggleGrid(); Canvas.scrollToPage(i); };
      it.ondragstart = (e) => { dragI = i; e.dataTransfer.effectAllowed = 'move'; };
      it.ondragover = (e) => { e.preventDefault(); it.classList.add('drop-before'); };
      it.ondragleave = () => it.classList.remove('drop-before');
      it.ondrop = (e) => {
        e.preventDefault(); if (dragI < 0 || dragI === i) return;
        const [pg] = E.d.pages.splice(dragI, 1); E.d.pages.splice(dragI < i ? i - 1 : i, 0, pg);
        E.pi = E.d.pages.indexOf(pg); Canvas.build(); E.commit('reorder'); E.emit('page'); draw();
      };
      it.oncontextmenu = (e) => { e.preventDefault(); menu({ x: e.clientX, y: e.clientY }, [
        { label: 'Duplikat', icon: 'content_copy', run: () => { E.d.pages.splice(i + 1, 0, clonePage(p)); Canvas.build(); E.commit('page'); draw(); } },
        { label: 'Hapus', icon: 'delete', danger: true, disabled: E.d.pages.length < 2, run: () => { E.d.pages.splice(i, 1); E.pi = Math.min(E.pi, E.d.pages.length - 1); Canvas.build(); E.commit('page'); draw(); } },
      ]); };
      gridEl.append(it);
    });
    const add = h('button.add-page', { type: 'button', style: { height: '120px' }, onclick: () => { addPage(E.d.pages.length - 1); draw(); } }, icon('add'), 'Tambah');
    gridEl.append(add);
  };
  draw();
  root.querySelector('.work').append(gridEl);
}

export function shortcuts() {
  const rows = [
    ['Urungkan / Ulangi', 'Ctrl+Z / Ctrl+Shift+Z'], ['Salin / Tempel / Potong', 'Ctrl+C / Ctrl+V / Ctrl+X'], ['Duplikat', 'Ctrl+D'],
    ['Pilih semua', 'Ctrl+A'], ['Kelompokkan / Pisahkan', 'Ctrl+G / Ctrl+Shift+G'], ['Kunci', 'Ctrl+Shift+L'],
    ['Ke depan / Ke belakang', 'Ctrl+] / Ctrl+['], ['Paling depan / belakang', 'Ctrl+Alt+] / Ctrl+Alt+['],
    ['Geser 1 px / 10 px', '← ↑ → ↓ / Shift+panah'], ['Tambah teks', 'T'], ['Persegi / Lingkaran / Garis', 'R / C / L'],
    ['Edit teks terpilih', 'Enter'], ['Tebal / Miring / Garis bawah', 'Ctrl+B / Ctrl+I / Ctrl+U'], ['Tautan', 'Ctrl+K'],
    ['Salin / Tempel gaya', 'Ctrl+Alt+C / Ctrl+Alt+V'], ['Halaman baru', 'Ctrl+Enter'], ['Perbesar / Perkecil', 'Ctrl++ / Ctrl+-'],
    ['Sesuaikan layar', 'Ctrl+0'], ['Presentasikan', 'Ctrl+Alt+P'], ['Geser kanvas', 'Spasi + seret'], ['Duplikat sambil geser', 'Alt + seret'],
    ['Matikan magnet', 'Tahan Ctrl saat menggeser'], ['Putar 15°', 'Shift saat memutar'],
  ];
  dialog({ title: 'Pintasan keyboard', width: 560, body: h('div', { style: { display: 'grid', gridTemplateColumns: '1fr auto', gap: '9px 18px', fontSize: '13.5px' } }, rows.flatMap(([a, b]) => [h('span', a), h('kbd', { style: { color: 'var(--tx3)', fontFamily: 'inherit', fontWeight: 600 } }, kbd(b))])) });
}

// ---------- events ----------
function wireEvents() {
  const k = (e) => onKey(e);
  addEventListener('keydown', k);
  const cp = (e) => onCopy(e, false), ct = (e) => onCopy(e, true), ps = (e) => onPaste(e);
  document.addEventListener('copy', cp); document.addEventListener('cut', ct); document.addEventListener('paste', ps);
  const bu = () => E.save.flush?.();
  addEventListener('beforeunload', bu);
  offs.push(() => { removeEventListener('keydown', k); document.removeEventListener('copy', cp); document.removeEventListener('cut', ct); document.removeEventListener('paste', ps); removeEventListener('beforeunload', bu); });

  wireShapeText();
  E.on('cmd', runCmd);
  E.on('insertImage', ({ a, at }) => insertAsset(a, at));
  E.on('dropSpec', ({ spec, at, target }) => handleSpec(spec, at, target));
}

const typing = (e) => { const t = e.target; return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); };
function onKey(e) {
  if (!root || document.querySelector('.dlg-back, .present')) return;
  if (typing(e)) return;
  const m = mod(e), key = e.key.toLowerCase();
  const sel = E.sel.length > 0;
  if (m && key === 'z') { e.preventDefault(); e.shiftKey ? E.redo() : E.undo(); return; }
  if (m && key === 'y') { e.preventDefault(); E.redo(); return; }
  if (m && key === 's') { e.preventDefault(); E.save.flush?.(); toast('Desain tersimpan', { icon: 'cloud_done' }); return; }
  if (m && key === 'd') { e.preventDefault(); E.duplicate(); return; }
  if (m && key === 'a') { e.preventDefault(); runCmd('selectAll'); return; }
  if (m && key === 'g') { e.preventDefault(); e.shiftKey ? E.ungroup() : E.group(); return; }
  if (m && e.shiftKey && key === 'l') { e.preventDefault(); E.toggleLock(); return; }
  if (m && (e.key === ']' || e.code === 'BracketRight')) { e.preventDefault(); E.order(e.altKey ? 'front' : 1); return; }
  if (m && (e.key === '[' || e.code === 'BracketLeft')) { e.preventDefault(); E.order(e.altKey ? 'back' : -1); return; }
  if (m && e.altKey && e.code === 'KeyC') { e.preventDefault(); runCmd('copyStyle'); return; }
  if (m && e.altKey && e.code === 'KeyV') { e.preventDefault(); runCmd('pasteStyle'); return; }
  if (m && e.altKey && e.code === 'KeyP') { e.preventDefault(); present(E.d, E.pi); return; }
  if (m && key === 'enter') { e.preventDefault(); addPage(E.pi); return; }
  if (m && (key === '=' || key === '+')) { e.preventDefault(); Canvas.setZoom(E.z * 1.2); return; }
  if (m && key === '-') { e.preventDefault(); Canvas.setZoom(E.z / 1.2); return; }
  if (m && key === '0') { e.preventDefault(); e.altKey ? Canvas.setZoom(1) : Canvas.fit(); return; }
  if (m && key === 'k') { e.preventDefault(); runCmd('link'); return; }
  if (m && ['b', 'i', 'u'].includes(key) && E.selType() === 'text') { e.preventDefault(); E.emit('cmd', 'text:' + key); return; }
  if (m) return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); E.remove(); return; }
  if (e.key === 'Escape') { if (E.crop) E.emit('endCrop'); else if (E.tool) Panels.open(null); else E.clearSel(); return; }
  if (e.key === 'Enter' && E.one()?.type === 'text') { e.preventDefault(); Canvas.startEdit(E.sel[0]); return; }
  if (e.key.startsWith('Arrow') && sel) {
    e.preventDefault();
    const d = e.shiftKey ? 10 : 1, dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
    E.set(x => { x.x += dx; x.y += dy; }, { commit: false });
    nudgeCommit();
    return;
  }
  if (e.key === 'PageDown' || e.key === 'PageUp') { e.preventDefault(); const i = clamp(E.pi + (e.key === 'PageDown' ? 1 : -1), 0, E.d.pages.length - 1); E.pi = i; E.emit('page'); Canvas.scrollToPage(i); return; }
  if (e.key === '?') { shortcuts(); return; }
  if (key === 't') { e.preventDefault(); addText('body'); return; }
  if (key === 'r') { e.preventDefault(); E.add(shapeEl('rect', { fill: '#c9c4d8' }), { at: Canvas.centerOfView() }); return; }
  if (key === 'c') { e.preventDefault(); E.add(shapeEl('circle', { fill: '#c9c4d8' }), { at: Canvas.centerOfView() }); return; }
  if (key === 'l') { e.preventDefault(); E.add(lineEl(), { at: Canvas.centerOfView() }); return; }
}
let nudgeT;
function nudgeCommit() { clearTimeout(nudgeT); nudgeT = setTimeout(() => E.commit('nudge'), 400); }

const MARK = 'amatu-design/els:';
function onCopy(e, cut) {
  if (!root || typing(e) || !E.sel.length) return;
  const els = E.selEls();
  E.clip = JSON.parse(JSON.stringify(els));
  e.clipboardData.setData('text/plain', MARK + JSON.stringify(E.clip));
  e.preventDefault();
  if (cut) E.remove();
  toast(cut ? 'Dipotong' : 'Disalin', { icon: 'content_copy', ms: 1400 });
}
async function onPaste(e) {
  if (!root || typing(e)) return;
  const dt = e.clipboardData;
  const files = [...dt.files].filter(f => /^image\//.test(f.type));
  if (files.length) {
    e.preventDefault();
    for (const f of files) { const a = await addAsset(f, { uploaded: true, name: f.name || 'Tempelan' }); E.emit('uploads'); insertAsset(a); }
    return;
  }
  const txt = dt.getData('text/plain');
  e.preventDefault();
  if (txt.startsWith(MARK)) { try { pasteEls(JSON.parse(txt.slice(MARK.length))); } catch {} return; }
  if (E.clip && !txt) { pasteEls(E.clip); return; }
  if (txt) {
    if (/^https?:\/\/\S+\.(png|jpe?g|webp|gif|svg)(\?\S*)?$/i.test(txt.trim())) { insertURL(txt.trim()); return; }
    const t = textEl({ html: txt.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/\n/g, '<br>'), size: 32, w: Math.min(E.d.w * .7, 600) });
    E.add(t, { at: Canvas.centerOfView() });
  }
}
function pasteEls(src) {
  const cp = cloneEls(src);
  const sameSpot = E.els().some(x => src.some(s => s.x === x.x && s.y === x.y));
  if (sameSpot) cp.forEach(x => { x.x += 24; x.y += 24; });
  E.add(cp, { keepPos: true });
}

// ---------- commands ----------
function runCmd(c) {
  const one = E.one();
  if (c === 'copy') { if (E.sel.length) { E.clip = JSON.parse(JSON.stringify(E.selEls())); navigator.clipboard?.writeText(MARK + JSON.stringify(E.clip)).catch(() => {}); toast('Disalin', { icon: 'content_copy', ms: 1400 }); } return; }
  if (c === 'paste') {
    navigator.clipboard?.readText?.().then(t => { if (t?.startsWith(MARK)) pasteEls(JSON.parse(t.slice(MARK.length))); else if (E.clip) pasteEls(E.clip); }).catch(() => E.clip && pasteEls(E.clip));
    return;
  }
  if (c === 'selectAll') { E.select(E.els().filter(x => !x.lock).map(x => x.id), { raw: true }); return; }
  if (c === 'copyStyle') { if (one) { E.styleClip = styleOf(one); toast('Gaya disalin — pilih elemen lalu Tempel gaya', { icon: 'format_paint' }); } return; }
  if (c === 'pasteStyle') { const s = E.styleClip; if (!s) return; E.set(x => { for (const [k, v] of Object.entries(s)) if (k in x || STYLE_KEYS.includes(k)) x[k] = JSON.parse(JSON.stringify(v)); }); return; }
  if (c.startsWith('align:')) return alignToPage(c.slice(6));
  if (c === 'asBg' && one?.type === 'image') { E.page().bg = { ...E.page().bg, img: { src: one.src, filter: one.filter } }; E.remove([one.id]); Canvas.refreshBg(); E.commit('bg'); return; }
  if (c === 'link') { promptDlg('Tautan', one?.link || E.selEls()[0]?.link || 'https://', 'Elemen akan bisa diklik saat presentasi dan di PDF').then(v => { if (v != null) E.set({ link: v === 'https://' ? '' : v.trim() }); }); return; }
  if (c.startsWith('panel:')) { Panels.open(c.slice(6)); return; }
  if (c === 'bgColor') { E.clearSel(); Panels.open('color', { target: 'bg' }); return; }
  if (c.startsWith('text:')) { E.emit('textToggle', c.slice(5)); return; }
}
const STYLE_KEYS = ['font', 'size', 'color', 'weight', 'italic', 'underline', 'strike', 'align', 'lh', 'ls', 'upper', 'fx', 'fill', 'stroke', 'radius', 'filter', 'shadow', 'op', 'mask'];
function styleOf(e) { const o = {}; for (const k of STYLE_KEYS) if (e[k] !== undefined) o[k] = JSON.parse(JSON.stringify(e[k])); return o; }

function alignToPage(k) {
  const els = E.selEls(); if (!els.length) return;
  const W = E.d.w, H = E.d.h;
  // multiple selected → align to the selection box; single → to the page
  const ref = els.length > 1 ? bbox(els) : { x: 0, y: 0, w: W, h: H };
  for (const e of els) {
    const b = bbox([e]);
    if (k === 'l') e.x += ref.x - b.x; if (k === 'r') e.x += ref.x + ref.w - (b.x + b.w); if (k === 'c') e.x += ref.x + ref.w / 2 - (b.x + b.w / 2);
    if (k === 't') e.y += ref.y - b.y; if (k === 'b') e.y += ref.y + ref.h - (b.y + b.h); if (k === 'm') e.y += ref.y + ref.h / 2 - (b.y + b.h / 2);
    E.emit('el', e.id);
  }
  E.commit('align');
}

// ---------- inserting ----------
export function addText(kind = 'body', o = {}) {
  const bf = Brand.d.fonts, W = E.d.w, k = Math.max(.35, Math.min(W, E.d.h) / 1080);
  const presets = {
    heading: { html: 'Tambahkan judul', size: Math.round(72 * k), weight: 700, font: bf.heading, w: W * .7 },
    sub: { html: 'Tambahkan subjudul', size: Math.round(44 * k), weight: 600, font: bf.sub, w: W * .6 },
    body: { html: 'Tambahkan sedikit teks isi', size: Math.round(28 * k), weight: 400, font: bf.body, w: W * .5 },
  };
  const t = textEl({ ...presets[kind], ...o });
  const [el] = E.add(t, { at: o.at || Canvas.centerOfView() });
  setTimeout(() => Canvas.startEdit(el.id), 30);
  return el;
}
export function insertAsset(a, at, target) {
  if (target && target.type === 'image' && !target.lock) return fillImage(target, a);
  const W = E.d.w, H = E.d.h, k = Math.min(1, (W * .55) / a.w, (H * .55) / a.h);
  const el = imageEl(a.src, a.w, a.h, { w: a.w * k, h: a.h * k });
  return E.add(el, { at: at || Canvas.centerOfView() });
}
export async function insertURL(url, at, target, meta = {}) {
  const close = toast('Menambahkan gambar…', { icon: 'downloading', ms: 20000 });
  try {
    let a;
    try { a = await fetchAsset(url, { name: meta.name || 'Foto' }); }
    catch { if (meta.fallback) a = await fetchAsset(meta.fallback, { name: meta.name || 'Foto' }); else throw new Error('cors'); }
    close();
    return insertAsset(a, at, target);
  } catch {
    close();
    // Last resort: reference the remote URL directly.
    const el = imageEl(url, meta.w || 800, meta.h || 600, { w: 500, h: 500 * (meta.h || 600) / (meta.w || 800) });
    return E.add(el, { at: at || Canvas.centerOfView() });
  }
}
async function handleSpec(spec, at, target) {
  if (spec.kind === 'els') {
    const els = cloneEls(spec.els);
    E.add(els, { at });
    return;
  }
  if (spec.kind === 'asset') { const a = { src: spec.src, w: spec.w, h: spec.h }; return insertAsset(a, at, target); }
  if (spec.kind === 'image') return insertURL(spec.url, at, target, spec);
  if (spec.kind === 'svg') return E.emit('insertSvg', { spec, at });
  if (spec.kind === 'text') return addText(spec.preset, { at });
  if (spec.kind === 'combo') return E.emit('insertCombo', { spec, at });
}
