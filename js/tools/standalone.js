// Free tools reachable from the home screen without opening a design.
import { h, icon, dialog, toast, pickFiles, download, loadScript, canvasBlob, slider, uid, loadImage } from '../util.js';
import { Store } from '../store.js';
import { newDesign, imageEl, frameEl, textEl } from '../model.js';
import { addAsset, assetURL } from '../assets.js';
import { Brand } from '../brand.js';
import { removeBgAI, removeBgColor, extractPalette, convertImage } from './imagetools.js';
import { qrSVG, barcodeSVG } from './qr.js';
import { generateImage, aiKey, askKey } from './ai.js';
import { PAIRS, loadFont, fontStack } from '../fonts.js';
import { templateById } from '../templates.js';

export const HOME_TOOLS = [
  ['bgremove', 'Hapus Latar Belakang', 'background_replace', 'Pisahkan objek dari latar foto secara otomatis, langsung di browser.', 'linear-gradient(135deg,#7b3fe4,#ff5fa2)', 'AI'],
  ['photo', 'Editor Foto', 'tune', 'Filter, penyesuaian warna, pangkas, bingkai, dan teks di atas foto.', 'linear-gradient(135deg,#0ea5e9,#6366f1)'],
  ['qr', 'Pembuat Kode QR', 'qr_code_2', 'Kode QR untuk tautan, WhatsApp, Wi-Fi — unduh PNG atau SVG.', 'linear-gradient(135deg,#111827,#475467)'],
  ['collage', 'Pembuat Kolase', 'dashboard', 'Gabungkan beberapa foto dalam kisi rapi siap unggah.', 'linear-gradient(135deg,#f59e0b,#ef4444)'],
  ['aiimage', 'Teks ke Gambar', 'auto_awesome', 'Ketik ide Anda dan dapatkan gambar dari AI.', 'linear-gradient(135deg,#db2777,#f97316)', 'AI'],
  ['convert', 'Ubah Ukuran & Format', 'photo_size_select_large', 'Konversi JPG, PNG, WEBP dan ubah dimensi banyak gambar sekaligus.', 'linear-gradient(135deg,#14b8a6,#0ea5e9)'],
  ['compress', 'Kompres Gambar', 'compress', 'Perkecil ukuran file foto tanpa kehilangan kualitas berarti.', 'linear-gradient(135deg,#22c55e,#14b8a6)'],
  ['img2pdf', 'Gambar ke PDF', 'picture_as_pdf', 'Satukan foto atau hasil scan menjadi satu dokumen PDF.', 'linear-gradient(135deg,#dc2626,#f97316)'],
  ['palette', 'Generator Palet Warna', 'palette', 'Ambil palet warna dari foto dan simpan ke Brand Kit.', 'linear-gradient(135deg,#ea6a0c,#facc15)'],
  ['barcode', 'Pembuat Barcode', 'barcode', 'EAN-13, UPC, dan Code128 untuk label produk.', 'linear-gradient(135deg,#334155,#64748b)'],
  ['fonts', 'Kombinasi Font', 'font_download', 'Pasangan font yang serasi untuk judul dan isi.', 'linear-gradient(135deg,#4f46e5,#7b3fe4)'],
  ['logo', 'Pembuat Logo', 'category', 'Mulai dari template logo, lalu ubah sesuka hati.', 'linear-gradient(135deg,#0e9384,#16a34a)'],
  ['mockup', 'Mockup Perangkat', 'devices', 'Tampilkan desain di layar ponsel, laptop, atau browser.', 'linear-gradient(135deg,#6366f1,#0ea5e9)'],
  ['pres', 'Presentasi', 'co_present', 'Buat slide presentasi dengan animasi dan mode presenter.', 'linear-gradient(135deg,#ea6a0c,#db2777)'],
];

async function openNew(d, panel) {
  await Store.putDesign(d);
  if (panel) sessionStorage.setItem('adesign.openPanel', panel);
  location.hash = '#/design/' + d.id;
}
const checker = 'repeating-conic-gradient(#e5e7eb 0 25%, #fff 0 50%) 0 0 / 18px 18px';

export function runTool(k) {
  ({ bgremove, photo, qr, collage, aiimage, convert, compress: () => convert(true), img2pdf, palette, barcode, fonts, logo, mockup, pres })[k]?.();
}

// ---------- background remover ----------
async function bgremove() {
  const [f] = await pickFiles('image/*', false); if (!f) return;
  const src = URL.createObjectURL(f);
  const before = h('img', { src, style: { maxWidth: '100%', maxHeight: '320px', borderRadius: '10px' } });
  const after = h('div', { style: { minHeight: '200px', borderRadius: '12px', background: checker, display: 'grid', placeItems: 'center', padding: '8px' } }, h('span.muted.small', 'Memproses…'));
  const status = h('p.small.muted', { style: { margin: 0 } }, 'Menyiapkan model AI (unduhan pertama ±40 MB, lalu tersimpan di cache)…');
  let out = null;
  const actions = h('div.row', { style: { flexWrap: 'wrap' } });
  const show = (blob) => {
    out = blob; after.textContent = '';
    after.append(h('img', { src: URL.createObjectURL(blob), style: { maxWidth: '100%', maxHeight: '320px' } }));
    actions.textContent = '';
    actions.append(h('button.btn.btn-primary', { type: 'button', onclick: () => download(out, f.name.replace(/\.\w+$/, '') + '-tanpa-latar.png') }, icon('download'), 'Unduh PNG'),
      h('button.btn.btn-ghost', { type: 'button', onclick: async () => { const a = await addAsset(out, { uploaded: true, name: 'Tanpa latar' }); const d = newDesign(Math.min(2000, a.w), Math.round(Math.min(2000, a.w) * a.h / a.w), 'Foto tanpa latar', 'custom'); d.pages[0].els.push(imageEl(a.src, a.w, a.h, { w: d.w, h: d.h })); dl.close(); openNew(d); } }, icon('edit'), 'Edit di desain'));
  };
  const color = async () => { status.textContent = 'Menghapus warna latar…'; try { show(await removeBgColor(f, 36)); status.textContent = 'Selesai (mode warna latar).'; } catch { status.textContent = 'Gagal memproses.'; } };
  const dl = dialog({ title: 'Hapus latar belakang', width: 760, body: h('div', { style: { display: 'grid', gap: '14px' } }, h('div.grid2', h('div', { style: { display: 'grid', gap: '6px' } }, h('b.small', 'Asli'), before), h('div', { style: { display: 'grid', gap: '6px' } }, h('b.small', 'Hasil'), after)), status, actions) });
  try {
    const r = await removeBgAI(f, (key, p) => { status.textContent = (/fetch/.test(key) ? 'Mengunduh model… ' : 'Memproses… ') + Math.round(p * 100) + '%'; });
    show(r); status.textContent = 'Selesai. Diproses di perangkat Anda — foto tidak diunggah.';
  } catch (e) {
    console.error(e);
    status.textContent = 'AI tidak dapat dijalankan di browser ini. Gunakan mode warna latar (cocok untuk latar polos).';
    actions.append(h('button.btn.btn-primary', { type: 'button', onclick: color }, icon('format_color_reset'), 'Hapus warna latar'));
  }
}

// ---------- photo editor ----------
async function photo() {
  const [f] = await pickFiles('image/*', false); if (!f) return;
  const a = await addAsset(f, { uploaded: true, name: f.name });
  const k = Math.min(1, 2400 / Math.max(a.w, a.h));
  const d = newDesign(Math.round(a.w * k), Math.round(a.h * k), f.name.replace(/\.\w+$/, ''), 'photo');
  const el = imageEl(a.src, a.w, a.h, { w: d.w, h: d.h });
  d.pages[0].els.push(el);
  sessionStorage.setItem('adesign.select', el.id);
  openNew(d, 'photo');
}

// ---------- QR ----------
async function qr() {
  let data = 'https://', fg = '#111111', bg = '#ffffff', style = 'square', svg = '';
  const prev = h('div', { style: { width: '220px', height: '220px', margin: '0 auto', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 0 0 1px var(--line2)', background: '#fff' } });
  const upd = async () => { if (!data || data === 'https://') { prev.innerHTML = ''; return; } try { svg = await qrSVG(data, { fg, bg, style }); prev.innerHTML = svg; } catch { prev.textContent = 'Pustaka QR gagal dimuat'; } };
  const inp = h('input.tx', { value: data, placeholder: 'Tautan atau teks', oninput: (e) => { data = e.target.value; upd(); } });
  const colors = h('div.row', ...[['Kode', () => fg, (v) => (fg = v)], ['Latar', () => bg, (v) => (bg = v)]].map(([l, g, s]) => h('label.row', { style: { flex: 1 } }, h('input', { type: 'color', value: g(), style: { width: '40px', height: '32px', border: 0, background: 'none' }, oninput: (e) => { s(e.target.value); upd(); } }), h('span.small', l))));
  const st = h('div.seg.full', [['square', 'Kotak'], ['rounded', 'Bulat'], ['dots', 'Titik']].map(([k2, l]) => h('button' + (style === k2 ? '.on' : ''), { type: 'button', onclick: (e) => { style = k2; e.currentTarget.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.currentTarget)); upd(); } }, l)));
  const png = async () => {
    const im = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
    const c = Object.assign(document.createElement('canvas'), { width: 1200, height: 1200 }); c.getContext('2d').drawImage(im, 0, 0, 1200, 1200);
    download(await canvasBlob(c), 'kode-qr.png');
  };
  dialog({ title: 'Pembuat kode QR', width: 440, body: h('div', { style: { display: 'grid', gap: '14px' } }, h('label.fx', h('span.fx-l', 'Isi kode QR'), inp), st, colors, prev),
    actions: [{ label: 'SVG', icon: 'polyline', run: () => { if (!svg) return false; download(new Blob([svg], { type: 'image/svg+xml' }), 'kode-qr.svg'); return false; } }, { label: 'Unduh PNG', icon: 'download', kind: 'btn-primary', run: async () => { if (!svg) { toast('Isi tautan dulu'); return false; } await png(); return false; } }] });
  setTimeout(() => inp.select(), 50);
}

// ---------- collage ----------
const GRIDS = [
  ['2 kolom', [[0, 0, .5, 1], [.5, 0, .5, 1]]], ['4 kotak', [[0, 0, .5, .5], [.5, 0, .5, .5], [0, .5, .5, .5], [.5, .5, .5, .5]]],
  ['1 + 2', [[0, 0, .6, 1], [.6, 0, .4, .5], [.6, .5, .4, .5]]], ['3 kolom', [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]]],
  ['1 + 3', [[0, 0, 1, .6], [0, .6, 1 / 3, .4], [1 / 3, .6, 1 / 3, .4], [2 / 3, .6, 1 / 3, .4]]], ['6 kotak', [[0, 0, 1 / 3, .5], [1 / 3, 0, 1 / 3, .5], [2 / 3, 0, 1 / 3, .5], [0, .5, 1 / 3, .5], [1 / 3, .5, 1 / 3, .5], [2 / 3, .5, 1 / 3, .5]]],
];
function collage() {
  let pick = 1;
  const grid = h('div.grid3', GRIDS.map(([n, cells], i) => h('button.tile', { type: 'button', style: { aspectRatio: '1', boxShadow: i === pick ? 'inset 0 0 0 2px var(--accent)' : '' }, dataset: { tip: n }, html: `<svg viewBox="0 0 60 60">${cells.map(([x, y, w, hh]) => `<rect x="${x * 60 + 1.5}" y="${y * 60 + 1.5}" width="${w * 60 - 3}" height="${hh * 60 - 3}" rx="2" fill="#bdb6cf"/>`).join('')}</svg>`, onclick: (e) => { pick = i; grid.querySelectorAll('.tile').forEach((t, j) => (t.style.boxShadow = j === i ? 'inset 0 0 0 2px var(--accent)' : '')); } })));
  dialog({ title: 'Pembuat kolase', width: 440, body: h('div', { style: { display: 'grid', gap: '14px' } }, h('p.muted.small', 'Pilih tata letak, lalu pilih foto. Anda bisa mengatur ulang di editor.'), grid),
    actions: [{ label: 'Batal' }, { label: 'Pilih foto', kind: 'btn-primary', icon: 'add_photo_alternate', run: async () => {
      const fs = await pickFiles('image/*', true);
      const d = newDesign(1080, 1080, 'Kolase', 'ig-post'), gap = 12, g = uid('g');
      const cells = GRIDS[pick][1];
      for (const [i, [x, y, w, hh]] of cells.entries()) {
        const fr = frameEl('rect', { x: x * 1080 + gap / 2, y: y * 1080 + gap / 2, w: w * 1080 - gap, h: hh * 1080 - gap, gid: g });
        const f = fs[i];
        if (f) {
          const a = await addAsset(f, { uploaded: true, name: f.name });
          Object.assign(fr, { src: a.src, nw: a.w, nh: a.h, frame: false });
          const ar = a.w / a.h, rr = fr.w / fr.h;
          if (ar > rr) { fr.iw = ar / rr; fr.ix = (1 - fr.iw) / 2; } else { fr.ih = rr / ar; fr.iy = (1 - fr.ih) / 2; }
        }
        d.pages[0].els.push(fr);
      }
      openNew(d);
    } }] });
}

// ---------- AI image ----------
function aiimage() {
  const ta = h('textarea.tx', { placeholder: 'Contoh: ilustrasi kota tropis saat senja dengan gaya flat pastel' });
  const out = h('div.grid2');
  const go = async () => {
    const p = ta.value.trim(); if (!p) return toast('Tulis deskripsi dulu');
    if (!aiKey() && !(await askKey())) return;
    out.textContent = '';
    for (let i = 0; i < 4; i++) {
      const box = h('div.tile.ph', { style: { aspectRatio: '1', padding: 0, cursor: 'default' } });
      out.append(box);
      generateImage(p, { w: 1024, h: 1024 }).then(blob => {
        box.classList.remove('ph');
        const bar = h('div.row', { style: { position: 'absolute', left: '8px', right: '8px', bottom: '8px', justifyContent: 'center' } },
          h('button.btn.btn-primary.sm', { type: 'button', onclick: () => download(blob, 'gambar-ai.jpg') }, icon('download')),
          h('button.btn.btn-ghost.sm', { type: 'button', onclick: async () => { const a = await addAsset(blob, { uploaded: true, name: 'Gambar AI' }); const d = newDesign(1080, 1080, p.slice(0, 40), 'ig-post'); d.pages[0].els.push(imageEl(a.src, a.w, a.h, { w: 1080, h: 1080 })); openNew(d); } }, icon('edit'), 'Edit'));
        box.append(h('img', { src: URL.createObjectURL(blob), alt: p, style: { width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' } }), bar);
      }).catch(err => { box.classList.remove('ph'); box.append(h('small.muted', err.code === 'badkey' ? 'Kunci AI ditolak' : 'Gagal membuat gambar')); });
    }
  };
  dialog({ title: 'Teks ke gambar', width: 620, body: h('div', { style: { display: 'grid', gap: '14px' } }, ta, h('button.btn.btn-brand', { type: 'button', onclick: go }, icon('auto_awesome'), 'Buat gambar'), out, h('p.small.muted', 'Gambar dibuat oleh Pollinations AI memakai kunci Anda (gratis).'), h('button.btn.btn-text', { type: 'button', onclick: () => askKey() }, icon('key'), 'Atur kunci AI')) });
}

// ---------- convert / compress ----------
async function convert(compress) {
  const fs = await pickFiles('image/*', true); if (!fs.length) return;
  let type = compress ? 'image/jpeg' : 'image/png', q = compress ? 72 : 90, maxW = compress ? 2000 : 0;
  const info = h('div', { style: { display: 'grid', gap: '4px', maxHeight: '140px', overflow: 'auto' } }, fs.map(f => h('small.muted', `${f.name} · ${(f.size / 1024).toFixed(0)} KB`)));
  const fmt = h('select.tx', { onchange: (e) => (type = e.target.value) }, [['image/png', 'PNG'], ['image/jpeg', 'JPG'], ['image/webp', 'WEBP']].map(([v, l]) => h('option', { value: v }, l)));
  fmt.value = type;
  const mw = h('input.tx', { type: 'number', value: maxW || '', placeholder: 'Asli', oninput: (e) => (maxW = +e.target.value || 0) });
  const res = h('div', { style: { display: 'grid', gap: '4px' } });
  dialog({ title: compress ? 'Kompres gambar' : 'Ubah ukuran & format', width: 460,
    body: h('div', { style: { display: 'grid', gap: '14px' } }, info, h('div.grid2', h('label.fx', h('span.fx-l', 'Format'), fmt), h('label.fx', h('span.fx-l', 'Lebar maksimum (px)'), mw)), slider({ label: 'Kualitas', min: 30, max: 100, value: q, unit: '%', oninput: (v) => (q = v) }), res),
    actions: [{ label: 'Tutup' }, { label: 'Proses & unduh', kind: 'btn-primary', icon: 'download', run: async () => {
      res.textContent = '';
      const outs = [];
      let before = 0, after = 0;
      for (const f of fs) {
        const r = await convertImage(f, { type, quality: q / 100, maxW: maxW || undefined });
        const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[type];
        outs.push([f.name.replace(/\.\w+$/, '') + '.' + ext, r.blob]);
        before += f.size; after += r.blob.size;
        res.append(h('small', `${f.name} → ${r.w}×${r.h}, ${(r.blob.size / 1024).toFixed(0)} KB`));
      }
      res.append(h('b.small', `Total ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB (${Math.round((1 - after / before) * 100)}% lebih kecil)`));
      if (outs.length === 1) download(outs[0][1], outs[0][0]);
      else { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'); const z = new window.JSZip(); outs.forEach(([n, b]) => z.file(n, b)); download(await z.generateAsync({ type: 'blob' }), 'gambar.zip'); }
      return false;
    } }] });
}

// ---------- images → PDF ----------
async function img2pdf() {
  let fs = await pickFiles('image/*', true); if (!fs.length) return;
  let size = 'a4', margin = 24;
  const list = h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } });
  const draw = () => { list.textContent = ''; fs.forEach((f, i) => list.append(h('div', { style: { position: 'relative' } }, h('img', { src: URL.createObjectURL(f), style: { width: '78px', height: '100px', objectFit: 'cover', borderRadius: '8px', boxShadow: '0 0 0 1px var(--line2)' } }),
    h('button.ib.sm', { type: 'button', style: { position: 'absolute', top: '-8px', right: '-8px', background: 'var(--glass3)' }, onclick: () => { fs.splice(i, 1); draw(); } }, icon('close', 'xs')),
    i ? h('button.ib.sm', { type: 'button', style: { position: 'absolute', bottom: '-8px', left: '-8px', background: 'var(--glass3)' }, onclick: () => { [fs[i - 1], fs[i]] = [fs[i], fs[i - 1]]; draw(); } }, icon('arrow_back', 'xs')) : null))); };
  draw();
  const sel = h('select.tx', { onchange: (e) => (size = e.target.value) }, [['a4', 'A4 (pas dengan margin)'], ['fit', 'Sesuai ukuran gambar'], ['letter', 'Letter']].map(([v, l]) => h('option', { value: v }, l)));
  dialog({ title: 'Gambar ke PDF', width: 520, body: h('div', { style: { display: 'grid', gap: '14px' } }, list, h('label.fx', h('span.fx-l', 'Ukuran halaman'), sel)),
    actions: [{ label: 'Tambah gambar', icon: 'add', run: async () => { fs = fs.concat(await pickFiles('image/*', true)); draw(); return false; } }, { label: 'Buat PDF', kind: 'btn-primary', icon: 'picture_as_pdf', run: async () => {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      const { jsPDF } = window.jspdf;
      let pdf;
      for (const [i, f] of fs.entries()) {
        const r = await convertImage(f, { type: 'image/jpeg', quality: .9, maxW: 2400, maxH: 2400 });
        const data = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(r.blob); });
        let pw, ph;
        if (size === 'fit') { pw = r.w * .75; ph = r.h * .75; } else if (size === 'letter') { pw = 612; ph = 792; } else { pw = 595.28; ph = 841.89; }
        if (size !== 'fit' && r.w > r.h) [pw, ph] = [ph, pw];
        if (!i) pdf = new jsPDF({ unit: 'pt', format: [pw, ph], orientation: pw > ph ? 'landscape' : 'portrait' }); else pdf.addPage([pw, ph], pw > ph ? 'landscape' : 'portrait');
        const m = size === 'fit' ? 0 : margin, k = Math.min((pw - m * 2) / r.w, (ph - m * 2) / r.h), w = r.w * k, hh = r.h * k;
        pdf.addImage(data, 'JPEG', (pw - w) / 2, (ph - hh) / 2, w, hh, undefined, 'FAST');
      }
      download(pdf.output('blob'), 'gambar.pdf');
    } }] });
}

// ---------- palette ----------
async function palette() {
  const [f] = await pickFiles('image/*', false); if (!f) return;
  const u = URL.createObjectURL(f);
  const cols = await extractPalette(u, 6).catch(() => []);
  if (!cols.length) return toast('Tidak bisa membaca warna gambar');
  await Brand.load();
  dialog({ title: 'Palet warna', width: 520, body: h('div', { style: { display: 'grid', gap: '14px' } },
    h('img', { src: u, style: { width: '100%', maxHeight: '260px', objectFit: 'cover', borderRadius: '14px' } }),
    h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${cols.length},1fr)`, gap: '8px' } }, cols.map(c => h('button', { type: 'button', style: { border: 0, background: 'none', display: 'grid', gap: '6px', cursor: 'pointer', color: 'var(--tx)' }, onclick: () => navigator.clipboard?.writeText(c).then(() => toast(c.toUpperCase() + ' disalin')) }, h('i', { style: { height: '64px', borderRadius: '12px', background: c, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.08)' } }), h('small', { style: { fontFamily: 'ui-monospace, monospace', fontWeight: 600 } }, c.toUpperCase()))))),
    actions: [{ label: 'Salin semua', icon: 'content_copy', run: () => { navigator.clipboard?.writeText(cols.join(', ')); toast('Kode warna disalin'); return false; } }, { label: 'Simpan ke Brand Kit', kind: 'btn-primary', icon: 'bookmark_add', run: async () => { Brand.d.palettes.push({ name: 'Dari foto', colors: cols }); await Brand.save(); toast('Palet disimpan ke Brand Kit'); } }] });
}

// ---------- barcode ----------
function barcode() {
  let data = '8991234567891', format = 'EAN13', svg = '';
  const prev = h('div', { style: { height: '160px', borderRadius: '12px', background: '#fff', boxShadow: '0 0 0 1px var(--line2)', display: 'grid', placeItems: 'center', padding: '10px' } });
  const upd = async () => { try { const r = await barcodeSVG(data, { format }); svg = r.svg; prev.innerHTML = svg; } catch { prev.innerHTML = '<span class="small muted">Data tidak valid untuk format ini</span>'; svg = ''; } };
  const inp = h('input.tx', { value: data, oninput: (e) => { data = e.target.value; upd(); } });
  const fmt = h('select.tx', { onchange: (e) => { format = e.target.value; upd(); } }, [['EAN13', 'EAN-13'], ['UPC', 'UPC-A'], ['CODE128', 'Code 128'], ['CODE39', 'Code 39'], ['ITF14', 'ITF-14']].map(([v, l]) => h('option', { value: v }, l)));
  dialog({ title: 'Pembuat barcode', width: 460, body: h('div', { style: { display: 'grid', gap: '14px' } }, h('div.grid2', h('label.fx', h('span.fx-l', 'Format'), fmt), h('label.fx', h('span.fx-l', 'Data'), inp)), prev),
    actions: [{ label: 'Unduh SVG', kind: 'btn-primary', icon: 'download', run: () => { if (svg) download(new Blob([svg], { type: 'image/svg+xml' }), 'barcode.svg'); return false; } }] });
  upd();
}

// ---------- fonts ----------
function fonts() {
  const grid = h('div.grid2', PAIRS.map(([a, b]) => {
    loadFont(a); loadFont(b);
    return h('button.tile', { type: 'button', style: { aspectRatio: 'auto', padding: '16px', display: 'grid', gap: '6px', textAlign: 'left', justifyItems: 'start' }, onclick: () => {
      const d = newDesign(1080, 1080, `${a} + ${b}`, 'ig-post');
      d.pages[0].els.push(textEl({ html: 'Judul yang Menarik', font: a, size: 96, weight: 700, w: 900, x: 90, y: 360, h: 120, lh: 1.1 }), textEl({ html: 'Teks isi yang mudah dibaca untuk menjelaskan pesan utama desain Anda.', font: b, size: 36, w: 900, x: 90, y: 560, h: 100 }));
      openNew(d);
    } }, h('b', { style: { fontFamily: fontStack(a), fontSize: '24px', color: 'var(--tx)', lineHeight: 1.1 } }, a), h('span', { style: { fontFamily: fontStack(b), color: 'var(--tx2)', fontSize: '14px' } }, `${b} — teks isi yang nyaman dibaca.`));
  }));
  dialog({ title: 'Kombinasi font', width: 620, body: h('div', { style: { display: 'grid', gap: '12px' } }, h('p.muted.small', 'Klik pasangan untuk membuat desain dengan font tersebut.'), grid) });
}

function logo() { const t = templateById('lg-kopi'); const d = newDesign(500, 500, 'Logo', 'logo'); openNew(d, 'design'); void t; }
function mockup() { const d = newDesign(1920, 1080, 'Mockup', 'pres'); openNew(d, 'elements'); }
function pres() { const t = templateById('pr-pitch'); const d = newDesign(1920, 1080, 'Presentasi', 'pres'); d.pages = t.build(); openNew(d, 'design'); }
