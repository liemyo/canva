// Download & share: PNG, JPG, PDF (standard/print), SVG, PPTX, project file and share links.
import { h, icon, dialog, toast, loadScript, download, slider, readAsDataURL, readAsText, uid, canvasBlob, loadImage } from './util.js';
import { renderPage, whenImages } from './render.js';
import { loadFonts, embedCSS } from './fonts.js';
import { designFonts } from './model.js';
import { Store } from './store.js';
import { isAsset, assetBlob, addAsset } from './assets.js';

const LIB = {
  h2i: 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js',
  pdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  pptx: 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
  zip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
};
const safe = (s) => (s || 'desain').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 80) || 'desain';

const TYPES = [
  ['png', 'PNG', 'Gambar berkualitas tinggi', 'image'], ['jpg', 'JPG', 'Ukuran file kecil', 'photo'],
  ['pdf', 'PDF Standar', 'Dokumen untuk dibagikan', 'picture_as_pdf'], ['pdfp', 'PDF Cetak', 'Resolusi tinggi untuk percetakan', 'print'],
  ['svg', 'SVG', 'Grafik vektor untuk web', 'polyline'], ['pptx', 'PowerPoint', 'Buka di PowerPoint / Keynote', 'slideshow'],
  ['amatu', 'File proyek', 'Simpan & lanjutkan di perangkat lain', 'inventory_2'],
];

export function openExport(d, opt = {}) {
  let type = localStorage.getItem('adesign.exportType') || 'png', scale = 1, quality = 85, transparent = false, which = 'all';
  const picked = new Set(d.pages.map((_, i) => i));
  const body = h('div', { style: { display: 'grid', gap: '16px' } });
  const status = h('p.small.muted', { style: { margin: 0, minHeight: '18px' } });
  const btn = h('button.btn.btn-primary.block', { type: 'button', style: { height: '44px' } }, icon('download'), 'Unduh');
  const draw = () => {
    body.textContent = '';
    const sel = h('select.tx', { onchange: (e) => { type = e.target.value; localStorage.setItem('adesign.exportType', type); draw(); } }, TYPES.map(([k, n, s]) => h('option', { value: k }, `${n} — ${s}`)));
    sel.value = type;
    body.append(h('label.fx', h('span.fx-l', 'Jenis file'), sel));
    if (type === 'png' || type === 'jpg') {
      const k = Math.round(d.w * scale) + ' × ' + Math.round(d.h * scale) + ' px';
      const s = slider({ label: 'Ukuran', min: .25, max: 4, step: .25, value: scale, unit: '×', oninput: (v) => { scale = v; info.textContent = Math.round(d.w * v) + ' × ' + Math.round(d.h * v) + ' px'; } });
      const info = h('small.muted', k);
      body.append(h('div', s, info));
      if (type === 'jpg') body.append(slider({ label: 'Kualitas', min: 30, max: 100, value: quality, unit: '%', oninput: (v) => (quality = v) }));
      if (type === 'png') body.append(h('label.sw', h('input', { type: 'checkbox', checked: transparent, onchange: (e) => (transparent = e.target.checked) }), h('i'), 'Latar transparan'));
    }
    if (type !== 'amatu' && d.pages.length > 1) {
      const pg = h('select.tx', { onchange: (e) => { which = e.target.value; draw(); } }, h('option', { value: 'all' }, `Semua halaman (${d.pages.length})`), h('option', { value: 'cur' }, `Halaman saat ini (${(opt.page || 0) + 1})`), h('option', { value: 'pick' }, 'Pilih halaman…'));
      pg.value = which;
      body.append(h('label.fx', h('span.fx-l', 'Pilih halaman'), pg));
      if (which === 'pick') body.append(h('div.chips', d.pages.map((_, i) => h('button.chip' + (picked.has(i) ? '.on' : ''), { type: 'button', onclick: (e) => { picked.has(i) ? picked.delete(i) : picked.add(i); e.currentTarget.classList.toggle('on'); } }, String(i + 1)))));
    }
    body.append(btn, status);
    body.append(h('div', { style: { borderTop: '1px solid var(--line)', paddingTop: '14px', display: 'grid', gap: '8px' } },
      h('b.small', 'Bagikan'),
      h('div.grid2',
        h('button.btn.btn-ghost', { type: 'button', onclick: () => shareLink(d) }, icon('link'), 'Salin tautan'),
        h('button.btn.btn-ghost', { type: 'button', onclick: () => copyImage(d, opt.page || 0) }, icon('content_copy'), 'Salin gambar'),
        navigator.share ? h('button.btn.btn-ghost', { type: 'button', onclick: () => nativeShare(d, opt.page || 0) }, icon('share'), 'Bagikan ke…') : null,
        h('button.btn.btn-ghost', { type: 'button', onclick: () => { dlg.close(); import('./editor/present.js').then(m => m.present(d, 0)); } }, icon('slideshow'), 'Presentasikan'))));
  };
  btn.onclick = async () => {
    const idx = which === 'cur' ? [opt.page || 0] : which === 'pick' ? [...picked].sort((a, b) => a - b) : d.pages.map((_, i) => i);
    if (!idx.length) return toast('Pilih minimal satu halaman');
    btn.disabled = true;
    try { await runExport(d, type, { idx, scale, quality: quality / 100, transparent, onStatus: (s) => (status.textContent = s) }); status.textContent = 'Selesai.'; }
    catch (e) { console.error(e); status.textContent = 'Gagal mengekspor: ' + (e.message || e); }
    btn.disabled = false;
  };
  draw();
  const dlg = dialog({ title: 'Unduh & bagikan', body, width: 440 });
  return dlg;
}

// Render one page to a canvas at the requested pixel ratio.
let host;
export async function pageCanvas(d, i, { scale = 1, transparent = false, bg } = {}) {
  await loadScript(LIB.h2i);
  host ||= document.body.appendChild(h('div', { style: { position: 'fixed', left: '-100000px', top: '0', pointerEvents: 'none', opacity: '1' }, 'aria-hidden': 'true' }));
  const st = renderPage(d.pages[i], d, { mode: 'export' });
  if (transparent) st.querySelector('.bg').style.background = 'transparent', st.style.background = 'transparent';
  host.append(st);
  try {
    const fonts = designFonts(d);
    await loadFonts(fonts);
    await document.fonts.ready;
    await whenImages(st);
    const css = await embedCSS(fonts);
    const c = await window.htmlToImage.toCanvas(st, { pixelRatio: scale, width: d.w, height: d.h, canvasWidth: d.w, canvasHeight: d.h, fontEmbedCSS: css, backgroundColor: bg || (transparent ? null : undefined), cacheBust: false, skipAutoScale: true, style: { transform: 'none', left: '0', top: '0' } });
    return c;
  } finally { st.remove(); }
}
async function pageSVG(d, i) {
  await loadScript(LIB.h2i);
  host ||= document.body.appendChild(h('div', { style: { position: 'fixed', left: '-100000px', top: '0' } }));
  const st = renderPage(d.pages[i], d, { mode: 'export' });
  host.append(st);
  try {
    const fonts = designFonts(d); await loadFonts(fonts); await whenImages(st);
    const css = await embedCSS(fonts);
    return await window.htmlToImage.toSvg(st, { width: d.w, height: d.h, fontEmbedCSS: css, style: { transform: 'none' } });
  } finally { st.remove(); }
}

export async function runExport(d, type, { idx, scale = 1, quality = .85, transparent = false, onStatus = () => {} }) {
  const name = safe(d.name);
  if (type === 'amatu') return exportProject(d);
  if (type === 'png' || type === 'jpg') {
    const mime = type === 'png' ? 'image/png' : 'image/jpeg';
    const files = [];
    for (const [n, i] of idx.entries()) {
      onStatus(`Merender halaman ${i + 1} (${n + 1}/${idx.length})…`);
      const c = await pageCanvas(d, i, { scale, transparent: type === 'png' && transparent, bg: type === 'jpg' ? '#ffffff' : undefined });
      files.push([`${name}${idx.length > 1 ? '-' + (i + 1) : ''}.${type}`, await canvasBlob(c, mime, quality)]);
    }
    return deliver(files, name);
  }
  if (type === 'svg') {
    const files = [];
    for (const i of idx) { onStatus(`Membuat SVG halaman ${i + 1}…`); const url = await pageSVG(d, i); files.push([`${name}${idx.length > 1 ? '-' + (i + 1) : ''}.svg`, await (await fetch(url)).blob()]); }
    return deliver(files, name);
  }
  if (type === 'pdf' || type === 'pdfp') {
    await loadScript(LIB.pdf);
    const { jsPDF } = window.jspdf;
    const pw = d.w * .75, ph = d.h * .75;
    const pdf = new jsPDF({ unit: 'pt', format: [pw, ph], orientation: pw > ph ? 'landscape' : 'portrait', compress: true });
    const target = type === 'pdfp' ? 3000 : 1800, sc = Math.min(3, Math.max(1, target / Math.max(d.w, d.h)));
    for (const [n, i] of idx.entries()) {
      onStatus(`Menyusun PDF halaman ${i + 1} (${n + 1}/${idx.length})…`);
      if (n) pdf.addPage([pw, ph], pw > ph ? 'landscape' : 'portrait');
      const c = await pageCanvas(d, i, { scale: sc, bg: '#ffffff' });
      pdf.addImage(c.toDataURL('image/jpeg', type === 'pdfp' ? .95 : .88), 'JPEG', 0, 0, pw, ph, undefined, 'FAST');
      for (const e of d.pages[i].els) if (e.link && !e.rot) pdf.link(e.x * .75, e.y * .75, e.w * .75, e.h * .75, { url: e.link });
    }
    return download(pdf.output('blob'), name + '.pdf');
  }
  if (type === 'pptx') {
    await loadScript(LIB.pptx);
    const p = new window.PptxGenJS();
    const wIn = d.w >= d.h ? 13.333 : 7.5, hIn = wIn * d.h / d.w;
    p.defineLayout({ name: 'AMATU', width: wIn, height: hIn });
    p.layout = 'AMATU';
    const sc = Math.min(2, 1920 / d.w * 1.2);
    for (const [n, i] of idx.entries()) {
      onStatus(`Membuat slide ${n + 1}/${idx.length}…`);
      const c = await pageCanvas(d, i, { scale: sc, bg: '#ffffff' });
      const s = p.addSlide();
      s.addImage({ data: c.toDataURL('image/jpeg', .9), x: 0, y: 0, w: '100%', h: '100%' });
      if (d.pages[i].notes) s.addNotes(d.pages[i].notes);
    }
    const blob = await p.write({ outputType: 'blob' });
    return download(blob, name + '.pptx');
  }
}
async function deliver(files, name) {
  if (files.length === 1) return download(files[0][1], files[0][0]);
  await loadScript(LIB.zip);
  const z = new window.JSZip();
  for (const [n, b] of files) z.file(n, b);
  download(await z.generateAsync({ type: 'blob' }), name + '.zip');
}

async function copyImage(d, i) {
  try {
    const c = await pageCanvas(d, i, { scale: Math.min(2, 2000 / Math.max(d.w, d.h)) });
    const blob = await canvasBlob(c, 'image/png');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast('Gambar halaman disalin ke papan klip', { icon: 'content_copy' });
  } catch { toast('Browser tidak mengizinkan menyalin gambar'); }
}
async function nativeShare(d, i) {
  try {
    const c = await pageCanvas(d, i, { scale: Math.min(2, 2000 / Math.max(d.w, d.h)) });
    const f = new File([await canvasBlob(c, 'image/png')], safe(d.name) + '.png', { type: 'image/png' });
    await navigator.share({ files: [f], title: d.name });
  } catch {}
}

// ---------- project file ----------
async function collectAssets(d, maxSide) {
  const out = {};
  const srcs = new Set();
  for (const p of d.pages) { if (p.bg?.img?.src) srcs.add(p.bg.img.src); for (const e of p.els) { if (e.src) srcs.add(e.src); if (e.orig) srcs.add(e.orig); } }
  for (const s of srcs) {
    if (!isAsset(s)) continue;
    let b = await assetBlob(s).catch(() => null);
    if (!b) continue;
    if (maxSide) {
      const u = URL.createObjectURL(b); const im = await loadImage(u); URL.revokeObjectURL(u);
      const k = Math.min(1, maxSide / Math.max(im.naturalWidth, im.naturalHeight));
      const c = Object.assign(document.createElement('canvas'), { width: Math.round(im.naturalWidth * k), height: Math.round(im.naturalHeight * k) });
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      b = await canvasBlob(c, b.type === 'image/png' ? 'image/png' : 'image/jpeg', .8);
    }
    out[s.slice(6)] = await readAsDataURL(b);
  }
  return out;
}
export async function exportProject(d) {
  const assets = await collectAssets(d);
  const blob = new Blob([JSON.stringify({ format: 'amatu-design', v: 1, design: d, assets })], { type: 'application/json' });
  download(blob, safe(d.name) + '.amatu');
  toast('File proyek disimpan', { icon: 'inventory_2' });
}
export async function importProject(file) {
  try {
    const j = JSON.parse(typeof file === 'string' ? file : await readAsText(file));
    if (j.format !== 'amatu-design' || !j.design) throw new Error('format');
    await restore(j);
  } catch { toast('File bukan proyek Amatu Design yang valid'); }
}
async function restore(j) {
  const map = {};
  for (const [id, data] of Object.entries(j.assets || {})) {
    const blob = await (await fetch(data)).blob();
    const a = await addAsset(blob, { name: 'Impor' });
    map['asset:' + id] = a.src;
  }
  const d = j.design;
  const fix = (s) => map[s] || s;
  for (const p of d.pages) { if (p.bg?.img) p.bg.img.src = fix(p.bg.img.src); for (const e of p.els) { if (e.src) e.src = fix(e.src); if (e.orig) e.orig = fix(e.orig); } }
  d.id = uid('d'); d.created = d.updated = Date.now();
  await Store.putDesign(d);
  location.hash = '#/design/' + d.id;
  toast('Desain diimpor', { icon: 'check_circle' });
}

// ---------- share link (design compressed into the URL fragment) ----------
async function deflate(str) {
  const cs = new Blob([str]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const buf = new Uint8Array(await new Response(cs).arrayBuffer());
  let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function inflate(b64) {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const buf = Uint8Array.from(bin, c => c.charCodeAt(0));
  const ds = new Blob([buf]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(ds).text();
}
async function shareLink(d) {
  try {
    const assets = await collectAssets(d, 900);
    const json = JSON.stringify({ format: 'amatu-design', v: 1, design: d, assets });
    let data = await deflate(json), note = '';
    if (data.length > 1_800_000) { data = await deflate(JSON.stringify({ format: 'amatu-design', v: 1, design: d, assets: {} })); note = ' (gambar unggahan tidak disertakan karena terlalu besar)'; }
    const url = location.origin + location.pathname + '#/s/' + data;
    await navigator.clipboard.writeText(url);
    toast('Tautan salinan disalin' + note, { icon: 'link', ms: 4200 });
  } catch { toast('Gagal membuat tautan'); }
}
export async function openShared(data) {
  try { await restore(JSON.parse(await inflate(data))); }
  catch { toast('Tautan desain rusak atau tidak lengkap'); location.hash = '#/'; }
}
