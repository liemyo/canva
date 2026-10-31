// Built-in templates. Each one is authored in its own canvas units; tpl.build() returns
// fresh pages with new ids every time it is used.
import { textEl, shapeEl, imageEl, lineEl, chartEl, tableEl, newPage } from './model.js';
import { uid } from './util.js';

// ---------- authoring helpers ----------
const t = (html, x, y, w, size, font, color, o = {}) => textEl({ html, x, y, w, size, font, color, h: Math.round(size * (o.lh || 1.25) * (html.split('<br>').length)), lh: o.lh || 1.25, ...o });
const r = (x, y, w, h, fill, o = {}) => shapeEl('rect', { x, y, w, h, fill, ...o });
const s = (shape, x, y, w, h, fill, o = {}) => shapeEl(shape, { x, y, w, h, fill, ...o });
const lg = (a, ...cs) => ({ t: 'linear', a, stops: cs.map((c, i) => [c, i / (cs.length - 1)]) });
function img(pid, x, y, w, h, o = {}) {
  const k = Math.min(1, 1200 / Math.max(w, h)), W = Math.max(40, Math.round(w * k)), H = Math.max(40, Math.round(h * k));
  return imageEl(`https://picsum.photos/id/${pid}/${W}/${H}`, W, H, { x, y, w, h, ...o });
}
const ln = (x, y, w, color, weight = 3, o = {}) => lineEl({ x, y: y - 8, w, h: 16, color, weight, ...o });
function pill(x, y, w, hh, fill, text, size, font, color, o = {}) {
  return [r(x, y, w, hh, fill, { radius: hh / 2, ...(o.shape || {}) }), t(text, x, y + (hh - size * 1.2) / 2, w, size, font, color, { align: 'center', lh: 1.2, weight: o.weight || 600, ls: o.ls || 0, upper: o.upper })];
}
const page = (bg, els, o = {}) => ({ ...newPage(), bg: { fill: bg }, els: els.flat(), ...o });

// Scale authored coordinates (posters are drawn at half size then doubled).
export function scaleEls(els, k) {
  for (const e of els) {
    e.x *= k; e.y *= k; e.w *= k; e.h *= k;
    if (e.size) e.size *= k;
    if (e.weight && e.type !== 'text') e.weight *= k;
    if (e.radius) e.radius *= k;
    if (e.stroke?.w) e.stroke.w *= k;
    if (e.pad) e.pad *= k;
    if (e.text?.size) e.text.size *= k;
    if (e.shadow) { e.shadow.x *= k; e.shadow.y *= k; e.shadow.blur *= k; }
  }
  return els;
}

const TPL = [];
const add = (id, name, size, w, h, tags, build, scale = 1) => TPL.push({ id, name, size, w, h, tags, build: () => {
  const pages = build();
  if (scale !== 1) pages.forEach(p => scaleEls(p.els, scale));
  pages.forEach(p => { p.id = uid('p'); p.els.forEach(e => (e.id = uid('e'))); });
  return pages;
} });

// ===================== Instagram post 1080×1080 =====================
add('ig-kopi', 'Promo Kedai Kopi', 'ig-post', 1080, 1080, 'kopi kafe promo makanan minuman diskon', () => [page('#2a1a0e', [
  img(1060, 0, 0, 1080, 1080),
  r(0, 380, 1080, 700, lg(180, 'rgba(20,10,4,0)', 'rgba(20,10,4,.86)')),
  t('KEDAI KOPI SENJA', 80, 590, 700, 26, 'Montserrat', '#f2c48d', { weight: 600, ls: 300 }),
  t('Kopi enak,<br>hari makin hangat.', 80, 636, 920, 92, 'Playfair Display', '#ffffff', { weight: 700, lh: 1.06 }),
  t('Diskon 30% setiap Jumat · Jl. Melati 12, Bandung', 80, 860, 920, 30, 'Montserrat', '#efe3d6'),
  pill(80, 930, 320, 76, '#f2c48d', 'Pesan sekarang', 28, 'Montserrat', '#2a1a0e'),
])]);

add('ig-quote', 'Kutipan Minimalis', 'ig-post', 1080, 1080, 'quote kutipan motivasi minimal', () => [page('#f4ede4', [
  t('“', 440, 120, 200, 320, 'DM Serif Display', '#c9a27e', { align: 'center', lh: 1 }),
  t('Setiap orang menjadi guru, setiap rumah menjadi sekolah.', 130, 400, 820, 66, 'DM Serif Display', '#2b2420', { align: 'center', lh: 1.2 }),
  ln(460, 760, 160, '#c9a27e', 3),
  t('KI HAJAR DEWANTARA', 140, 800, 800, 26, 'Montserrat', '#6b5a4d', { align: 'center', weight: 600, ls: 280 }),
])]);

add('ig-sale', 'Big Sale Berani', 'ig-post', 1080, 1080, 'sale diskon promo belanja toko 11.11', () => [page('#ff4d2e', [
  s('circle', -180, -200, 620, 620, '#ff6a4f'),
  s('circle', 760, 760, 520, 520, '#e83a1c'),
  t('BIG<br>SALE', 70, 200, 940, 300, 'Anton', '#fff4e0', { lh: .92 }),
  s('burst', 690, 110, 300, 300, '#ffd23f'),
  t('11.11', 690, 222, 300, 70, 'Archivo Black', '#ff4d2e', { align: 'center', lh: 1 }),
  pill(80, 780, 560, 96, '#17110f', 'UP TO 70% OFF', 42, 'Montserrat', '#ffffff', { weight: 800, ls: 60 }),
  t('Belanja di aplikasi · 11–13 November', 80, 920, 900, 32, 'Montserrat', '#fff4e0', { weight: 600 }),
])]);

add('ig-tips', 'Carousel Tips Produktif', 'ig-post', 1080, 1080, 'tips edukasi carousel produktivitas list', () => {
  const bg = lg(135, '#1e1b4b', '#4c1d95');
  const cover = page(bg, [
    s('blob1', 600, -120, 620, 620, 'rgba(167,139,250,.35)'),
    s('circle', -120, 760, 420, 420, 'rgba(45,212,191,.25)'),
    pill(90, 140, 260, 64, '#2dd4bf', 'PANDUAN', 26, 'Poppins', '#0f172a', { weight: 700, ls: 200 }),
    t('5 Kebiasaan<br>Orang Super<br>Produktif', 90, 260, 900, 108, 'Poppins', '#ffffff', { weight: 800, lh: 1.04 }),
    t('Geser untuk membaca →', 90, 900, 600, 32, 'Poppins', '#c4b5fd', { weight: 500 }),
  ]);
  const items = [['01', 'Rencanakan malam sebelumnya', 'Tulis tiga prioritas utama sebelum tidur agar pagi langsung bergerak.'],
    ['02', 'Satu tugas, satu waktu', 'Multitasking memecah fokus. Selesaikan satu hal sampai tuntas.'],
    ['03', 'Gunakan blok waktu', 'Kelompokkan pekerjaan sejenis dalam blok 90 menit tanpa gangguan.']];
  const p2 = page(bg, [
    t('Mulai dari sini', 90, 110, 900, 64, 'Poppins', '#ffffff', { weight: 800 }),
    ...items.map(([n, a, b], i) => [
      r(90, 240 + i * 250, 900, 210, 'rgba(255,255,255,.08)', { radius: 28, stroke: { c: 'rgba(255,255,255,.16)', w: 2 } }),
      t(n, 130, 280 + i * 250, 120, 64, 'Poppins', '#2dd4bf', { weight: 800, lh: 1 }),
      t(a, 270, 278 + i * 250, 680, 38, 'Poppins', '#ffffff', { weight: 700 }),
      t(b, 270, 334 + i * 250, 680, 26, 'Poppins', '#c4b5fd', { lh: 1.45 }),
    ]),
  ]);
  return [cover, p2];
});

add('ig-launch', 'Peluncuran Koleksi', 'ig-post', 1080, 1080, 'fashion koleksi produk baru toko', () => [page('#0f172a', [
  img(1027, 0, 0, 540, 1080),
  t('NEW<br>COLLECTION', 600, 160, 440, 70, 'Bebas Neue', '#f8fafc', { lh: 1, ls: 40 }),
  r(600, 330, 90, 8, '#f59e0b'),
  t('Koleksi musim hujan dengan bahan linen ringan dan warna bumi yang tenang.', 600, 380, 420, 30, 'DM Sans', '#cbd5e1', { lh: 1.5 }),
  t('Mulai Rp189.000', 600, 640, 420, 44, 'DM Sans', '#ffffff', { weight: 700 }),
  pill(600, 740, 300, 74, '#f59e0b', 'Belanja sekarang', 26, 'DM Sans', '#0f172a', { weight: 700 }),
  t('@studiolinen.id', 600, 960, 420, 26, 'DM Sans', '#94a3b8'),
])]);

add('ig-webinar', 'Undangan Webinar', 'ig-post', 1080, 1080, 'webinar seminar online acara pembicara', () => [page('#ffffff', [
  s('blob2', 560, -160, 700, 700, '#ede4ff'),
  s('circle', 640, 230, 360, 360, '#7b3fe4'),
  img(64, 660, 250, 320, 320, { mask: 'circle' }),
  pill(80, 110, 250, 58, '#7b3fe4', 'WEBINAR GRATIS', 22, 'Plus Jakarta Sans', '#ffffff', { weight: 700, ls: 120 }),
  t('Membangun Brand<br>Personal di Era<br>Digital', 80, 210, 560, 66, 'Plus Jakarta Sans', '#16112b', { weight: 800, lh: 1.1 }),
  t('Bersama Rani Wulandari<br>Brand Strategist, 10+ tahun', 680, 620, 340, 26, 'Plus Jakarta Sans', '#4b4566', { align: 'center', lh: 1.4 }),
  r(80, 760, 920, 2, '#e7e2f3'),
  t('SABTU, 16 NOV 2026', 80, 810, 450, 30, 'Plus Jakarta Sans', '#16112b', { weight: 700 }),
  t('19.00 – 21.00 WIB · Zoom', 80, 856, 450, 26, 'Plus Jakarta Sans', '#6a6480'),
  pill(640, 815, 360, 84, '#16112b', 'Daftar di bio', 28, 'Plus Jakarta Sans', '#ffffff', { weight: 700 }),
])]);

add('ig-opening', 'Grand Opening Elegan', 'ig-post', 1080, 1080, 'grand opening pembukaan toko restoran', () => [page('#0b3d2e', [
  r(50, 50, 980, 980, null, { stroke: { c: '#d4b26a', w: 3 } }),
  r(72, 72, 936, 936, null, { stroke: { c: 'rgba(212,178,106,.45)', w: 1.5 } }),
  s('star4', 500, 190, 80, 80, '#d4b26a'),
  t('YOU ARE INVITED TO OUR', 140, 330, 800, 30, 'Montserrat', '#e9dcb8', { align: 'center', ls: 360, weight: 500 }),
  t('GRAND<br>OPENING', 100, 400, 880, 150, 'Cinzel', '#d4b26a', { align: 'center', lh: 1, weight: 700 }),
  ln(340, 760, 400, '#d4b26a', 2),
  t('Sabtu, 23 November 2026 · 10.00 WIB', 140, 800, 800, 32, 'Montserrat', '#f5eedb', { align: 'center' }),
  t('Rumah Makan Sederhana — Jl. Asia Afrika 8', 140, 852, 800, 26, 'Montserrat', '#bfb08a', { align: 'center' }),
])]);

add('ig-healthy', 'Menu Sarapan Sehat', 'ig-post', 1080, 1080, 'makanan sehat sarapan resep kuliner', () => [page('#f3f7ea', [
  img(1080, 560, 120, 420, 640, { mask: 'arch' }),
  s('circle', 880, 700, 160, 160, '#e9f0d4'),
  t('Resep pekan ini', 90, 150, 420, 30, 'Caveat', '#5a7d2a', { size: 44 }),
  t('Sarapan<br>Sehat<br>5 Menit', 90, 220, 460, 104, 'Fraunces', '#21311a', { weight: 700, lh: 1 }),
  t('Granola, yogurt, dan stroberi segar — tinggi serat dan protein untuk energi pagi.', 90, 590, 420, 28, 'DM Sans', '#4a5a3d', { lh: 1.5 }),
  pill(90, 800, 300, 72, '#21311a', 'Lihat resep', 26, 'DM Sans', '#f3f7ea', { weight: 700 }),
  t('@dapursehat', 90, 960, 400, 24, 'DM Sans', '#6c7c5c', { weight: 600 }),
])]);

add('ig-real', 'Properti Dijual', 'ig-post', 1080, 1080, 'rumah properti dijual real estate', () => [page('#ffffff', [
  img(1029, 0, 0, 1080, 640),
  r(0, 600, 1080, 480, '#ffffff'),
  pill(70, 560, 230, 70, '#e11d48', 'DIJUAL', 28, 'Outfit', '#ffffff', { weight: 700, ls: 200 }),
  t('Rumah Modern Tropis', 70, 670, 700, 58, 'Outfit', '#111827', { weight: 700 }),
  t('Bintaro, Tangerang Selatan', 70, 745, 700, 30, 'Outfit', '#6b7280'),
  t('Rp2,4 M', 720, 670, 290, 58, 'Outfit', '#e11d48', { weight: 800, align: 'right' }),
  r(70, 830, 940, 2, '#e5e7eb'),
  t('4 Kamar tidur', 70, 870, 300, 30, 'Outfit', '#111827', { weight: 600 }),
  t('3 Kamar mandi', 390, 870, 300, 30, 'Outfit', '#111827', { weight: 600 }),
  t('LT 180 m²', 720, 870, 290, 30, 'Outfit', '#111827', { weight: 600, align: 'right' }),
  t('Hubungi 0812-3456-7890', 70, 960, 940, 28, 'Outfit', '#6b7280'),
])]);

// ===================== Instagram story 1080×1920 =====================
add('st-travel', 'Story Perjalanan', 'ig-story', 1080, 1920, 'travel liburan wisata gunung story', () => [page('#111', [
  img(1036, 0, 0, 1080, 1920),
  r(0, 0, 1080, 1920, lg(180, 'rgba(0,0,0,.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,.65)')),
  t('PETUALANGAN KAMI', 90, 200, 900, 34, 'Montserrat', '#ffffff', { ls: 420, weight: 600 }),
  t('JELAJAHI<br>BROMO', 80, 1240, 920, 230, 'Bebas Neue', '#ffffff', { lh: .9 }),
  t('3 hari, 2 malam — paket mulai Rp1,2 jt', 90, 1690, 900, 40, 'Montserrat', '#f1f5f9', { weight: 500 }),
  pill(340, 1780, 400, 84, '#ffffff', 'Geser ke atas', 30, 'Montserrat', '#111111', { weight: 700 }),
])]);

add('st-newpost', 'Story Postingan Baru', 'ig-story', 1080, 1920, 'new post story pastel estetik', () => [page(lg(160, '#fde2e4', '#e2ece9', '#cddafd'), [
  r(170, 470, 740, 900, '#ffffff', { rot: -4, shadow: { x: 0, y: 30, blur: 60, color: '#6b5b95', op: 25 } }),
  img(1011, 210, 510, 660, 680, { rot: -4 }),
  t('Postingan baru!', 100, 250, 880, 92, 'Pacifico', '#4a3f6b', { align: 'center' }),
  t('cek feed sekarang ✦', 140, 1450, 800, 46, 'Quicksand', '#4a3f6b', { align: 'center', weight: 700 }),
  s('star4', 820, 380, 110, 110, '#ffffff'), s('star4', 150, 1350, 80, 80, '#ffffff'),
])]);

add('st-count', 'Hitung Mundur Acara', 'ig-story', 1080, 1920, 'countdown acara event neon konser', () => [page('#07060f', [
  s('circle', 140, 520, 800, 800, null, { stroke: { c: '#ff2bd6', w: 6 } }),
  s('circle', 190, 570, 700, 700, null, { stroke: { c: 'rgba(0,229,255,.6)', w: 3 } }),
  t('HITUNG MUNDUR', 90, 300, 900, 44, 'Montserrat', '#a5f3fc', { align: 'center', ls: 420, weight: 600 }),
  t('3', 240, 640, 600, 420, 'Unbounded', '#ff2bd6', { align: 'center', lh: 1, weight: 800, fx: { type: 'neon', int: 70 } }),
  t('HARI LAGI', 140, 1110, 800, 90, 'Unbounded', '#ffffff', { align: 'center', weight: 700 }),
  t('Festival Musik Kota · 22 Nov', 90, 1500, 900, 46, 'Montserrat', '#e9e7ff', { align: 'center', weight: 500 }),
])]);

add('st-promo', 'Story Flash Sale', 'ig-story', 1080, 1920, 'flash sale promo diskon belanja', () => [page('#ffe14d', [
  s('blob3', -260, -200, 900, 900, '#ffd000'),
  t('FLASH', 80, 260, 920, 260, 'Anton', '#111111', { lh: .9 }),
  t('SALE', 80, 500, 920, 260, 'Anton', '#ff3d6e', { lh: .9 }),
  img(1073, 140, 860, 800, 620, { radius: 40 }),
  t('Hanya hari ini · Diskon s/d 50%', 80, 1560, 920, 50, 'Poppins', '#111111', { align: 'center', weight: 700 }),
  pill(290, 1680, 500, 100, '#111111', 'Belanja sekarang', 36, 'Poppins', '#ffe14d', { weight: 700 }),
])]);

// ===================== Presentations 1920×1080 =====================
add('pr-pitch', 'Pitch Deck Startup', 'pres', 1920, 1080, 'presentasi pitch deck startup bisnis investor', () => {
  const nv = '#0b1220', ac = '#7b3fe4', tl = '#2dd4bf', mu = '#94a3b8';
  return [
    page(nv, [
      s('blob1', 1180, -260, 1000, 1000, 'rgba(123,63,228,.35)'), s('circle', 1500, 640, 520, 520, 'rgba(45,212,191,.18)'),
      pill(140, 300, 260, 60, 'rgba(45,212,191,.15)', 'SERI A · 2026', 24, 'Sora', tl, { weight: 600, ls: 160 }),
      t('Logistik pintar<br>untuk UMKM Indonesia', 140, 400, 1500, 104, 'Sora', '#ffffff', { weight: 700, lh: 1.08 }),
      t('KirimAja — pengiriman same-day dengan biaya 40% lebih hemat.', 140, 660, 1000, 36, 'Sora', mu, { lh: 1.4 }),
      t('kirimaja.id', 140, 920, 400, 28, 'Sora', mu),
    ]),
    page(nv, [
      t('01 — Masalah', 140, 130, 800, 30, 'Sora', tl, { weight: 600, ls: 100 }),
      t('UMKM kehilangan 18% margin<br>karena ongkos kirim.', 140, 190, 1400, 72, 'Sora', '#ffffff', { weight: 700, lh: 1.15 }),
      ...[['64 jt', 'pelaku UMKM aktif'], ['18%', 'margin habis untuk ongkir'], ['2,7 hari', 'rata-rata waktu kirim']].map(([a, b], i) => [
        r(140 + i * 560, 520, 500, 340, 'rgba(255,255,255,.05)', { radius: 32, stroke: { c: 'rgba(255,255,255,.1)', w: 2 } }),
        t(a, 190 + i * 560, 590, 420, 96, 'Sora', i === 1 ? tl : '#ffffff', { weight: 700 }),
        t(b, 190 + i * 560, 730, 420, 32, 'Sora', mu),
      ]),
    ]),
    page(nv, [
      t('02 — Traksi', 140, 130, 800, 30, 'Sora', tl, { weight: 600, ls: 100 }),
      t('Pertumbuhan 3× dalam 6 bulan', 140, 190, 1400, 72, 'Sora', '#ffffff', { weight: 700 }),
      chartEl('bar', { x: 140, y: 340, w: 1100, h: 620, data: [['Mei', 12], ['Jun', 16], ['Jul', 21], ['Agu', 25], ['Sep', 30], ['Okt', 37]], series: ['Pengiriman (ribu)'], colors: [ac, tl], fg: '#cbd5e1', font: 'Sora', legend: false }),
      t('37 rb', 1380, 420, 400, 120, 'Sora', tl, { weight: 700 }),
      t('pengiriman per bulan, naik 23% MoM dengan retensi pelanggan 82%.', 1380, 580, 400, 32, 'Sora', mu, { lh: 1.45 }),
    ]),
    page(nv, [
      t('03 — Tim', 140, 130, 800, 30, 'Sora', tl, { weight: 600, ls: 100 }),
      t('Dibangun oleh operator logistik', 140, 190, 1400, 72, 'Sora', '#ffffff', { weight: 700 }),
      ...[[64, 'Rani W.', 'CEO · ex-Gojek'], [91, 'Bima S.', 'CTO · ex-Tokopedia'], [65, 'Sari D.', 'COO · ex-JNE'], [1005, 'Dimas P.', 'Head of Growth']].map(([p, n, d], i) => [
        img(p, 140 + i * 420, 400, 300, 300, { mask: 'circle' }),
        t(n, 140 + i * 420, 740, 300, 36, 'Sora', '#ffffff', { weight: 700, align: 'center' }),
        t(d, 140 + i * 420, 792, 300, 26, 'Sora', mu, { align: 'center' }),
      ]),
    ]),
    page(lg(120, ac, '#4c1d95'), [
      t('Terima kasih', 140, 380, 1640, 140, 'Sora', '#ffffff', { weight: 700, align: 'center' }),
      t('rani@kirimaja.id · +62 812 3456 7890', 140, 580, 1640, 40, 'Sora', '#e9d5ff', { align: 'center' }),
    ]),
  ];
});

add('pr-report', 'Laporan Kinerja Bulanan', 'pres', 1920, 1080, 'laporan bulanan kantor korporat presentasi data', () => {
  const bl = '#1d4ed8', ink = '#0f172a', mu = '#64748b';
  const head = (n, title) => [r(0, 0, 1920, 8, bl), t(n, 120, 90, 400, 26, 'Inter', bl, { weight: 700, ls: 120 }), t(title, 120, 130, 1600, 60, 'Inter', ink, { weight: 800 })];
  return [
    page('#f8fafc', [
      r(0, 0, 820, 1080, bl), s('quarter', 520, 780, 300, 300, '#3b82f6'),
      t('LAPORAN KINERJA', 120, 330, 640, 30, 'Inter', '#bfdbfe', { weight: 700, ls: 240 }),
      t('Oktober<br>2026', 120, 390, 640, 140, 'Inter', '#ffffff', { weight: 800, lh: 1 }),
      t('Divisi Penjualan & Pemasaran', 120, 720, 600, 32, 'Inter', '#dbeafe'),
      img(1050, 900, 120, 900, 840, { radius: 24 }),
    ]),
    page('#ffffff', [
      ...head('RINGKASAN', 'Pendapatan naik 14% dari bulan lalu'),
      ...[['Rp4,8 M', 'Pendapatan', '+14%'], ['1.284', 'Pelanggan baru', '+9%'], ['92%', 'Kepuasan', '+3 poin'], ['Rp312 rb', 'Nilai transaksi', '+5%']].map(([a, b, c], i) => [
        r(120 + i * 430, 300, 390, 230, '#f1f5f9', { radius: 20 }),
        t(b, 160 + i * 430, 335, 320, 26, 'Inter', mu, { weight: 600 }),
        t(a, 160 + i * 430, 380, 320, 58, 'Inter', ink, { weight: 800 }),
        t(c, 160 + i * 430, 465, 320, 26, 'Inter', '#16a34a', { weight: 700 }),
      ]),
      chartEl('line', { x: 120, y: 590, w: 1680, h: 400, data: [['Mei', 3.2, 2.8], ['Jun', 3.6, 3.1], ['Jul', 3.9, 3.4], ['Agu', 4.0, 3.8], ['Sep', 4.2, 3.9], ['Okt', 4.8, 4.1]], series: ['Realisasi', 'Target'], colors: [bl, '#f59e0b'], fg: '#334155' }),
    ]),
    page('#ffffff', [
      ...head('WILAYAH', 'Kontribusi per wilayah'),
      chartEl('donut', { x: 120, y: 290, w: 760, h: 640, data: [['Jawa', 52], ['Sumatra', 21], ['Kalimantan', 11], ['Sulawesi', 9], ['Lainnya', 7]], series: ['Porsi'], colors: [bl, '#3b82f6', '#60a5fa', '#93c5fd', '#cbd5e1'], fg: '#334155' }),
      tableEl(5, 3, { x: 980, y: 300, w: 820, h: 400, rows: [['Wilayah', 'Pendapatan', 'Tumbuh'], ['Jawa', 'Rp2,50 M', '+12%'], ['Sumatra', 'Rp1,01 M', '+19%'], ['Kalimantan', 'Rp0,53 M', '+8%'], ['Sulawesi', 'Rp0,43 M', '+22%']], cols: [.42, .34, .24], head: bl, stripe: '#f1f5f9', border: '#e2e8f0', size: 26, pad: 18 }),
    ]),
    page(bl, [
      t('Langkah berikutnya', 120, 140, 1600, 70, 'Inter', '#ffffff', { weight: 800 }),
      ...['Perluas tim penjualan Sulawesi', 'Kampanye akhir tahun mulai 1 Desember', 'Integrasi CRM baru selesai Q1 2027'].map((x, i) => [
        s('circle', 120, 330 + i * 170, 90, 90, '#ffffff'),
        t(String(i + 1), 120, 350 + i * 170, 90, 40, 'Inter', bl, { weight: 800, align: 'center', lh: 1.2 }),
        t(x, 260, 350 + i * 170, 1400, 44, 'Inter', '#ffffff', { weight: 600 }),
      ]),
    ]),
  ];
});

add('pr-edu', 'Materi Kelas Ceria', 'pres', 1920, 1080, 'edukasi sekolah kelas belajar anak presentasi', () => [
  page('#fff7e8', [
    s('blob1', -200, 560, 700, 700, '#ffd6a5'), s('blob2', 1400, -220, 700, 700, '#caffbf'), s('circle', 1580, 760, 220, 220, '#9bf6ff'),
    s('star', 300, 160, 120, 120, '#ffb703', { rot: 12 }),
    t('Mengenal<br>Tata Surya', 420, 330, 1080, 150, 'Fredoka', '#2b2d42', { weight: 700, align: 'center', lh: 1 }),
    pill(760, 720, 400, 84, '#ef476f', 'IPA · Kelas 5', 34, 'Fredoka', '#ffffff', { weight: 600 }),
  ]),
  page('#ffffff', [
    t('Planet di sekitar Matahari', 120, 110, 1680, 76, 'Fredoka', '#2b2d42', { weight: 700 }),
    ...[['#ffb703', 'Merkurius'], ['#fb8500', 'Venus'], ['#219ebc', 'Bumi'], ['#e63946', 'Mars'], ['#c9a227', 'Jupiter']].map(([c, n], i) => [
      s('circle', 160 + i * 340, 400, 200 - Math.abs(2 - i) * 20, 200 - Math.abs(2 - i) * 20, c),
      t(n, 100 + i * 340, 700, 320, 40, 'Fredoka', '#2b2d42', { align: 'center', weight: 600 }),
    ]),
  ]),
  page('#2b2d42', [
    t('Kuis!', 120, 300, 1680, 200, 'Fredoka', '#ffd166', { weight: 700, align: 'center' }),
    t('Planet manakah yang paling besar?', 120, 560, 1680, 60, 'Fredoka', '#ffffff', { align: 'center' }),
  ]),
]);

add('pr-folio', 'Portofolio Minimal', 'pres', 1920, 1080, 'portofolio fotografi minimal hitam putih', () => [
  page('#f5f5f4', [
    t('ARUNA STUDIO', 120, 110, 600, 26, 'Inter', '#1c1917', { weight: 700, ls: 300 }),
    t('Portofolio<br>2026', 120, 600, 900, 170, 'Instrument Serif', '#1c1917', { lh: .95 }),
    img(1043, 1060, 120, 740, 840),
  ]),
  page('#f5f5f4', [
    img(1039, 120, 120, 820, 840), img(1040, 980, 120, 820, 400), img(1041, 980, 560, 820, 400),
    t('Arsitektur & Ruang', 120, 990, 800, 30, 'Inter', '#1c1917', { weight: 600 }),
  ]),
  page('#1c1917', [
    t('Mari bekerja sama.', 120, 420, 1680, 130, 'Instrument Serif', '#f5f5f4', { align: 'center' }),
    t('halo@arunastudio.id', 120, 620, 1680, 36, 'Inter', '#a8a29e', { align: 'center' }),
  ]),
]);

// ===================== Posters (authored at half size) =====================
add('po-konser', 'Poster Konser Musik', 'poster-a4', 2480, 3508, 'poster konser musik festival acara', () => [page(lg(160, '#13072e', '#3b0a5e', '#c2185b'), [
  s('circle', 140, 230, 960, 960, lg(180, '#ff8a00', '#ff2e63')),
  r(0, 860, 1240, 900, lg(180, 'rgba(19,7,46,0)', 'rgba(19,7,46,.9)')),
  t('LIVE IN JAKARTA', 100, 120, 1040, 44, 'Montserrat', '#ffd1e0', { ls: 600, weight: 600, align: 'center' }),
  t('SUARA<br>SENJA', 60, 980, 1120, 260, 'Anton', '#ffffff', { lh: .9, align: 'center' }),
  t('FEAT. LANGIT BIRU · NADA KITA · RUMAH KACA', 100, 1490, 1040, 34, 'Montserrat', '#ffd1e0', { align: 'center', weight: 600, ls: 120 }),
  t('14 DESEMBER 2026 · ISTORA SENAYAN', 100, 1590, 1040, 40, 'Montserrat', '#ffffff', { align: 'center', weight: 800 }),
], {})], 2);

add('po-seminar', 'Poster Seminar Nasional', 'poster-a4', 2480, 3508, 'poster seminar kampus acara akademik', () => [page('#ffffff', [
  r(0, 0, 1240, 760, '#0f3d91'), s('circle', 820, -200, 620, 620, '#1e56c2'), s('ring', 980, 420, 360, 360, 'rgba(255,255,255,.12)'),
  t('SEMINAR NASIONAL', 100, 140, 900, 40, 'Plus Jakarta Sans', '#9cc0ff', { weight: 700, ls: 300 }),
  t('Masa Depan<br>Kecerdasan Buatan<br>di Indonesia', 100, 220, 1000, 96, 'Plus Jakarta Sans', '#ffffff', { weight: 800, lh: 1.08 }),
  img(1005, 100, 860, 330, 330, { mask: 'circle' }), img(64, 455, 860, 330, 330, { mask: 'circle' }), img(91, 810, 860, 330, 330, { mask: 'circle' }),
  t('Dr. Andi P.', 100, 1220, 330, 34, 'Plus Jakarta Sans', '#0f172a', { weight: 700, align: 'center' }),
  t('Prof. Sinta R.', 455, 1220, 330, 34, 'Plus Jakarta Sans', '#0f172a', { weight: 700, align: 'center' }),
  t('Ir. Bayu K.', 810, 1220, 330, 34, 'Plus Jakarta Sans', '#0f172a', { weight: 700, align: 'center' }),
  r(100, 1360, 1040, 2, '#e2e8f0'),
  t('Rabu, 20 November 2026<br>08.00 – 15.00 WIB · Aula Utama', 100, 1410, 700, 38, 'Plus Jakarta Sans', '#0f172a', { lh: 1.45, weight: 600 }),
  pill(820, 1420, 320, 96, '#0f3d91', 'Gratis', 40, 'Plus Jakarta Sans', '#ffffff', { weight: 800 }),
  t('Daftar: bit.ly/seminar-ai-2026', 100, 1600, 1040, 32, 'Plus Jakarta Sans', '#64748b'),
])], 2);

add('po-hiring', 'Poster Lowongan Kerja', 'poster-a4', 2480, 3508, 'lowongan kerja hiring karir rekrutmen', () => [page('#ffd84d', [
  t('WE’RE', 90, 160, 1060, 230, 'Archivo Black', '#111111', { lh: .95 }),
  t('HIRING!', 90, 380, 1060, 230, 'Archivo Black', '#111111', { lh: .95 }),
  s('arrow', 860, 700, 280, 160, '#111111', { rot: 20 }),
  t('Bergabunglah dengan tim kami:', 90, 760, 800, 44, 'DM Sans', '#111111', { weight: 700 }),
  ...['UI/UX Designer', 'Frontend Developer', 'Content Writer'].map((x, i) => pill(90, 860 + i * 140, 700, 110, '#111111', x, 44, 'DM Sans', '#ffd84d', { weight: 700 })),
  t('Kirim CV ke karir@ruangkerja.id<br>paling lambat 30 November 2026', 90, 1340, 1060, 40, 'DM Sans', '#111111', { lh: 1.45 }),
  s('circle', 860, 1340, 300, 300, '#ffffff'),
  t('Remote<br>friendly', 860, 1435, 300, 46, 'DM Sans', '#111111', { weight: 700, align: 'center', lh: 1.1 }),
])], 2);

// ===================== Flyer A5 =====================
add('fl-yoga', 'Flyer Kelas Yoga', 'flyer', 1748, 2480, 'flyer yoga olahraga kesehatan kelas', () => [page('#f1ece4', [
  img(1035, 0, 0, 874, 720),
  r(0, 600, 874, 640, '#f1ece4', { radius: 0 }),
  s('circle', 600, 520, 200, 200, '#b4846c'),
  t('Mulai<br>Rp75 rb', 600, 575, 200, 32, 'DM Sans', '#ffffff', { align: 'center', weight: 700, lh: 1.15 }),
  t('Yoga Pagi', 70, 760, 760, 110, 'Cormorant Garamond', '#3d2c22', { weight: 600 }),
  t('di Taman Kota', 70, 880, 760, 50, 'Cormorant Garamond', '#7a5c49', { italic: true }),
  t('Setiap Sabtu & Minggu · 06.30 WIB<br>Cocok untuk pemula, matras disediakan.', 70, 980, 760, 28, 'DM Sans', '#5a4638', { lh: 1.55 }),
  t('IG @yogakota · WA 0813-2222-1111', 70, 1150, 760, 26, 'DM Sans', '#3d2c22', { weight: 700 }),
])], 2);

add('fl-bimbel', 'Flyer Bimbingan Belajar', 'flyer', 1748, 2480, 'flyer les bimbel sekolah pendidikan', () => [page('#ffffff', [
  r(0, 0, 874, 520, '#4361ee'), s('blob2', 520, -120, 480, 480, '#4895ef'),
  t('PENDAFTARAN DIBUKA', 60, 90, 760, 30, 'Poppins', '#cfe0ff', { weight: 700, ls: 240 }),
  t('Bimbel<br>Juara', 60, 150, 760, 120, 'Poppins', '#ffffff', { weight: 800, lh: 1 }),
  t('SD · SMP · SMA', 60, 420, 760, 36, 'Poppins', '#ffffff', { weight: 600 }),
  ...[['Kelas kecil', 'maks. 8 siswa'], ['Tryout rutin', 'setiap bulan'], ['Tutor PTN', 'berpengalaman']].map(([a, b], i) => [
    s('circle', 60, 600 + i * 150, 96, 96, '#fde047'), t('✓', 60, 618 + i * 150, 96, 48, 'Poppins', '#4361ee', { align: 'center', weight: 800, lh: 1.2 }),
    t(a, 190, 600 + i * 150, 600, 40, 'Poppins', '#111827', { weight: 700 }), t(b, 190, 650 + i * 150, 600, 28, 'Poppins', '#6b7280'),
  ]),
  pill(60, 1080, 754, 100, '#4361ee', 'Diskon 20% untuk 50 pendaftar pertama', 30, 'Poppins', '#ffffff', { weight: 700 }),
])], 2);

// ===================== Business cards 1050×600 =====================
add('bc-elegan', 'Kartu Nama Elegan', 'card', 1050, 600, 'kartu nama bisnis elegan emas', () => [
  page('#0e1a2b', [
    s('hexagon', 445, 170, 160, 160, null, { stroke: { c: '#d4b26a', w: 4 } }),
    t('A', 445, 200, 160, 90, 'Cinzel', '#d4b26a', { align: 'center', weight: 700, lh: 1.1 }),
    t('ADIWANGSA LAW', 225, 380, 600, 38, 'Cinzel', '#f5ead0', { align: 'center', weight: 600, ls: 200 }),
    t('KONSULTAN HUKUM', 225, 440, 600, 20, 'Montserrat', '#a99a7a', { align: 'center', ls: 400 }),
  ]),
  page('#f7f3ea', [
    r(0, 0, 18, 600, '#d4b26a'),
    t('Raden Adiwangsa, S.H., M.H.', 90, 120, 860, 44, 'Cormorant Garamond', '#0e1a2b', { weight: 700 }),
    t('Managing Partner', 90, 180, 860, 26, 'Montserrat', '#8a7a5a', { ls: 100 }),
    ln(90, 260, 120, '#d4b26a', 3),
    t('+62 811 2233 4455<br>raden@adiwangsa.law<br>Jl. Sudirman Kav. 21, Jakarta', 90, 300, 860, 26, 'Montserrat', '#2a3444', { lh: 1.7 }),
  ]),
]);

add('bc-modern', 'Kartu Nama Modern', 'card', 1050, 600, 'kartu nama modern kreatif desainer', () => [
  page('#ffffff', [
    r(700, 0, 350, 600, lg(160, '#7b3fe4', '#ff5fa2')),
    s('circle', 790, 210, 180, 180, 'rgba(255,255,255,.18)'),
    t('Nadia Putri', 80, 170, 600, 64, 'Poppins', '#16112b', { weight: 700 }),
    t('Product Designer', 80, 250, 600, 30, 'Poppins', '#7b3fe4', { weight: 600 }),
    t('nadia.design · 0812 9999 1212', 80, 420, 600, 24, 'Poppins', '#6a6480'),
  ]),
  page(lg(160, '#7b3fe4', '#ff5fa2'), [
    t('np.', 225, 210, 600, 150, 'Poppins', '#ffffff', { weight: 800, align: 'center', lh: 1 }),
  ]),
]);

// ===================== Logos 500×500 =====================
add('lg-kopi', 'Logo Kedai Kopi', 'logo', 500, 500, 'logo kopi kafe badge', () => [page('#f5ede1', [
  s('circle', 50, 50, 400, 400, '#3b2416'),
  s('circle', 70, 70, 360, 360, null, { stroke: { c: '#e2b682', w: 3, dash: 'dash' } }),
  s('drop', 205, 120, 90, 120, '#e2b682', { rot: 180 }),
  t('SENJA', 90, 260, 320, 66, 'Abril Fatface', '#f5ede1', { align: 'center', lh: 1 }),
  t('COFFEE · EST 2026', 90, 345, 320, 20, 'Montserrat', '#e2b682', { align: 'center', ls: 300, weight: 600 }),
])]);

add('lg-studio', 'Logo Monogram Studio', 'logo', 500, 500, 'logo monogram studio minimal', () => [page('#ffffff', [
  s('arch', 150, 90, 200, 230, '#111827'),
  t('m', 150, 150, 200, 150, 'Fraunces', '#ffffff', { align: 'center', lh: 1, italic: true }),
  t('MERAKI STUDIO', 50, 350, 400, 36, 'Fraunces', '#111827', { align: 'center', weight: 600, ls: 120 }),
])]);

add('lg-tech', 'Logo Teknologi', 'logo', 500, 500, 'logo teknologi startup aplikasi', () => [page('#0b1220', [
  s('hexagon', 160, 90, 180, 180, lg(135, '#2dd4bf', '#7b3fe4')),
  s('hexagon', 205, 135, 90, 90, '#0b1220'),
  t('nexa', 50, 300, 400, 80, 'Space Grotesk', '#ffffff', { align: 'center', weight: 700, lh: 1 }),
  t('TECHNOLOGIES', 50, 395, 400, 20, 'Space Grotesk', '#94a3b8', { align: 'center', ls: 500 }),
])]);

// ===================== YouTube 1280×720 =====================
add('yt-vlog', 'Thumbnail Vlog', 'yt-thumb', 1280, 720, 'youtube thumbnail vlog travel', () => [page('#111', [
  img(1015, 0, 0, 1280, 720),
  r(0, 0, 760, 720, lg(90, 'rgba(0,0,0,.75)', 'rgba(0,0,0,0)')),
  t('KE SINI<br>CUMA 50 RB?!', 60, 180, 760, 120, 'Anton', '#ffe600', { lh: 1, fx: { type: 'outline', thick: 6, color: '#000000' } }),
  pill(60, 520, 300, 70, '#ff0033', 'VLOG #27', 32, 'Montserrat', '#ffffff', { weight: 800 }),
  s('arrow', 860, 420, 220, 130, '#ff0033', { rot: -25, stroke: { c: '#ffffff', w: 8 } }),
])]);

add('yt-tutorial', 'Thumbnail Tutorial', 'yt-thumb', 1280, 720, 'youtube thumbnail tutorial edukasi teknologi', () => [page('#111827', [
  s('blob1', 680, -100, 700, 700, '#7b3fe4'),
  img(0, 720, 160, 480, 400, { radius: 24, rot: 4, shadow: { x: 0, y: 20, blur: 40, color: '#000', op: 50 } }),
  t('BELAJAR', 70, 150, 640, 70, 'Poppins', '#a78bfa', { weight: 800 }),
  t('EXCEL<br>DALAM<br>10 MENIT', 70, 230, 640, 110, 'Poppins', '#ffffff', { weight: 800, lh: 1 }),
])]);

// ===================== Facebook post 1200×630 =====================
add('fb-event', 'Postingan Acara Komunitas', 'fb-post', 1200, 630, 'facebook acara komunitas event', () => [page('#ecfdf5', [
  img(1018, 640, 0, 560, 630),
  s('circle', -80, -80, 260, 260, '#a7f3d0'),
  t('Bersih-Bersih<br>Pantai Bersama', 70, 150, 560, 66, 'Outfit', '#064e3b', { weight: 800, lh: 1.08 }),
  t('Minggu, 1 Desember · 07.00 WIB<br>Pantai Ancol, Jakarta', 70, 340, 560, 28, 'Outfit', '#065f46', { lh: 1.5 }),
  pill(70, 470, 260, 70, '#059669', 'Ikut serta', 28, 'Outfit', '#ffffff', { weight: 700 }),
])]);

// ===================== Certificate 2000×1414 =====================
add('ce-award', 'Sertifikat Penghargaan', 'cert', 2000, 1414, 'sertifikat penghargaan piagam pelatihan', () => [page('#fffdf7', [
  r(50, 50, 1900, 1314, null, { stroke: { c: '#1e3a5f', w: 14 } }),
  r(90, 90, 1820, 1234, null, { stroke: { c: '#c9a24d', w: 4 } }),
  s('triangle', 1700, 90, 210, 210, '#1e3a5f', { rot: 180, shape: 'rtriangle', flipX: true }),
  s('seal', 1580, 980, 240, 240, '#c9a24d'),
  s('circle', 1620, 1020, 160, 160, null, { stroke: { c: '#fffdf7', w: 4 } }),
  t('2026', 1620, 1075, 160, 40, 'Cinzel', '#fffdf7', { align: 'center', weight: 700 }),
  t('SERTIFIKAT', 200, 200, 1600, 110, 'Cinzel', '#1e3a5f', { align: 'center', weight: 700, ls: 200 }),
  t('PENGHARGAAN', 200, 330, 1600, 40, 'Montserrat', '#c9a24d', { align: 'center', weight: 600, ls: 700 }),
  t('Dengan bangga diberikan kepada', 200, 470, 1600, 40, 'Montserrat', '#475569', { align: 'center' }),
  t('Anindya Kirana', 200, 540, 1600, 150, 'Great Vibes', '#1e3a5f', { align: 'center' }),
  ln(600, 730, 800, '#c9a24d', 3),
  t('atas dedikasi dan prestasi luar biasa sebagai Peserta Terbaik<br>Pelatihan Desain Grafis Angkatan VII.', 300, 770, 1400, 34, 'Montserrat', '#475569', { align: 'center', lh: 1.55 }),
  ln(260, 1110, 440, '#1e3a5f', 2), ln(1000 - 220, 1110, 440, '#1e3a5f', 2),
  t('Budi Santoso<br>Direktur', 260, 1130, 440, 30, 'Montserrat', '#1e3a5f', { align: 'center', lh: 1.4, weight: 600 }),
  t('Dewi Lestari<br>Ketua Panitia', 780, 1130, 440, 30, 'Montserrat', '#1e3a5f', { align: 'center', lh: 1.4, weight: 600 }),
])]);

// ===================== Invitations 1500×2100 =====================
add('iv-wedding', 'Undangan Pernikahan', 'invite', 1500, 2100, 'undangan pernikahan wedding nikah', () => [page('#f8f4ee', [
  s('arch', 250, 180, 1000, 1500, null, { stroke: { c: '#b08d57', w: 4 } }),
  s('arch', 280, 210, 940, 1440, null, { stroke: { c: 'rgba(176,141,87,.4)', w: 2 } }),
  s('blob1', -160, -160, 520, 520, '#e8dccb'), s('blob3', 1140, 1680, 520, 520, '#e8dccb'),
  t('The Wedding of', 300, 470, 900, 54, 'Cormorant Garamond', '#7a6347', { align: 'center', italic: true }),
  t('Raka<br>&<br>Alya', 300, 600, 900, 200, 'Great Vibes', '#5b4630', { align: 'center', lh: 1 }),
  ln(600, 1300, 300, '#b08d57', 2),
  t('SABTU, 12 DESEMBER 2026', 300, 1350, 900, 40, 'Cormorant Garamond', '#5b4630', { align: 'center', weight: 700, ls: 200 }),
  t('Gedung Sasana Kriya, TMII · 11.00 WIB', 300, 1420, 900, 34, 'Cormorant Garamond', '#7a6347', { align: 'center' }),
  t('Merupakan kehormatan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir.', 280, 1800, 940, 30, 'Cormorant Garamond', '#7a6347', { align: 'center', italic: true, lh: 1.5 }),
])]);

add('iv-bday', 'Undangan Ulang Tahun Anak', 'invite', 1500, 2100, 'undangan ulang tahun anak pesta', () => [page('#a0e7ff', [
  s('circle', 140, 160, 200, 240, '#ff6b9a'), s('circle', 1180, 220, 180, 220, '#ffd23f'), s('circle', 1020, 120, 160, 200, '#7b3fe4'),
  ln(240, 520, 300, '#555', 2, { rot: 80 }), ln(1170, 560, 300, '#555', 2, { rot: 100 }),
  t('Yuk datang ke pesta', 150, 700, 1200, 70, 'Fredoka', '#1d3557', { align: 'center', weight: 600 }),
  t('ulang tahun ke-5', 150, 800, 1200, 60, 'Fredoka', '#1d3557', { align: 'center' }),
  t('Kenzo', 150, 900, 1200, 300, 'Luckiest Guy', '#ff6b9a', { align: 'center', lh: 1, fx: { type: 'splice', thick: 3, ox: 10, oy: 10, color: '#1d3557' } }),
  r(250, 1360, 1000, 420, '#ffffff', { radius: 60 }),
  t('Minggu, 8 Desember 2026<br>Pukul 15.00 WIB<br>Rumah Kenzo, Jl. Kenanga 5', 250, 1440, 1000, 52, 'Fredoka', '#1d3557', { align: 'center', lh: 1.5 }),
])]);

// ===================== Docs A4 794×1123 =====================
add('cv-pro', 'CV Profesional', 'resume', 794, 1123, 'cv resume lamaran kerja riwayat hidup', () => [page('#ffffff', [
  r(0, 0, 270, 1123, '#1f2a44'),
  img(64, 55, 60, 160, 160, { mask: 'circle' }),
  t('KONTAK', 40, 270, 200, 13, 'Inter', '#9fb3d9', { weight: 700, ls: 200 }),
  t('0812 3456 7890<br>rani.w@email.com<br>Bandung, Jawa Barat<br>linkedin.com/in/raniw', 40, 296, 200, 12.5, 'Inter', '#e5ebf7', { lh: 1.8 }),
  t('KEAHLIAN', 40, 440, 200, 13, 'Inter', '#9fb3d9', { weight: 700, ls: 200 }),
  t('Riset pengguna<br>Figma & prototyping<br>Design system<br>Copywriting UX<br>Analisis data', 40, 466, 200, 12.5, 'Inter', '#e5ebf7', { lh: 1.8 }),
  t('BAHASA', 40, 620, 200, 13, 'Inter', '#9fb3d9', { weight: 700, ls: 200 }),
  t('Indonesia — Asli<br>Inggris — Profesional', 40, 646, 200, 12.5, 'Inter', '#e5ebf7', { lh: 1.8 }),
  t('Rani Wulandari', 310, 70, 440, 40, 'Inter', '#1f2a44', { weight: 800 }),
  t('UX Designer Senior', 310, 120, 440, 17, 'Inter', '#5b6b8c', { weight: 600 }),
  t('Desainer produk dengan 7 tahun pengalaman membangun aplikasi fintech dan e-commerce yang digunakan jutaan orang.', 310, 160, 440, 12.5, 'Inter', '#475569', { lh: 1.6 }),
  t('PENGALAMAN', 310, 260, 440, 13, 'Inter', '#1f2a44', { weight: 800, ls: 200 }), r(310, 284, 440, 2, '#e2e8f0'),
  ...[['Lead UX Designer — DompetKu', '2022 – sekarang', 'Memimpin 6 desainer; menaikkan konversi onboarding 31%.'], ['Product Designer — Belanjaku', '2019 – 2022', 'Merancang ulang checkout; menurunkan keranjang terbengkalai 18%.'], ['UI Designer — Agensi Kreasi', '2017 – 2019', 'Mengerjakan 40+ situs untuk klien UMKM dan korporat.']].map(([a, b, c], i) => [
    t(a, 310, 304 + i * 110, 440, 14, 'Inter', '#1f2a44', { weight: 700 }), t(b, 310, 326 + i * 110, 440, 12, 'Inter', '#7b3fe4', { weight: 600 }), t(c, 310, 348 + i * 110, 440, 12.5, 'Inter', '#475569', { lh: 1.6 }),
  ]),
  t('PENDIDIKAN', 310, 650, 440, 13, 'Inter', '#1f2a44', { weight: 800, ls: 200 }), r(310, 674, 440, 2, '#e2e8f0'),
  t('S1 Desain Komunikasi Visual — ITB', 310, 694, 440, 14, 'Inter', '#1f2a44', { weight: 700 }), t('2013 – 2017 · IPK 3,72', 310, 716, 440, 12, 'Inter', '#7b3fe4', { weight: 600 }),
])]);

add('doc-proposal', 'Sampul Proposal', 'doc', 794, 1123, 'proposal sampul dokumen laporan', () => [page('#ffffff', [
  img(1048, 0, 0, 794, 620),
  r(0, 0, 794, 620, 'rgba(15,23,42,.35)'),
  r(60, 520, 674, 260, '#ffffff', { shadow: { x: 0, y: 20, blur: 40, color: '#0f172a', op: 20 } }),
  t('PROPOSAL KEGIATAN', 100, 560, 600, 13, 'Inter', '#0e9384', { weight: 700, ls: 300 }),
  t('Festival Literasi<br>Anak Nusantara 2026', 100, 590, 600, 36, 'Fraunces', '#0f172a', { weight: 700, lh: 1.15 }),
  t('Diajukan oleh Komunitas Baca Bersama', 100, 700, 600, 14, 'Inter', '#64748b'),
  t('Jakarta, November 2026', 60, 1040, 674, 13, 'Inter', '#64748b'),
])]);

add('mn-cafe', 'Menu Kafe', 'menu', 2480, 3508, 'menu kafe restoran makanan minuman daftar harga', () => {
  const items = [['Espresso', '18'], ['Americano', '22'], ['Cafe Latte', '28'], ['Kopi Susu Gula Aren', '25'], ['Matcha Latte', '30'], ['Coklat Panas', '27']];
  const food = [['Croissant Mentega', '24'], ['Roti Bakar Srikaya', '20'], ['Pisang Goreng Keju', '22'], ['Nasi Goreng Kampung', '35']];
  return [page('#1d1611', [
    t('KEDAI SENJA', 100, 110, 1040, 34, 'Montserrat', '#d9a86c', { align: 'center', weight: 600, ls: 600 }),
    t('Menu', 100, 160, 1040, 170, 'Playfair Display', '#f6eadb', { align: 'center', italic: true }),
    t('MINUMAN', 100, 420, 520, 34, 'Montserrat', '#d9a86c', { weight: 700, ls: 300 }),
    ...items.map(([n, p], i) => [t(n, 100, 490 + i * 82, 420, 34, 'Playfair Display', '#f6eadb'), t(p, 460, 490 + i * 82, 120, 34, 'Montserrat', '#d9a86c', { align: 'right', weight: 600 })]),
    t('MAKANAN', 680, 420, 460, 34, 'Montserrat', '#d9a86c', { weight: 700, ls: 300 }),
    ...food.map(([n, p], i) => [t(n, 680, 490 + i * 82, 360, 34, 'Playfair Display', '#f6eadb'), t(p, 1000, 490 + i * 82, 140, 34, 'Montserrat', '#d9a86c', { align: 'right', weight: 600 })]),
    img(1060, 680, 860, 460, 420, { radius: 20 }),
    ln(100, 1360, 1040, 'rgba(217,168,108,.4)', 2),
    t('Harga dalam ribu rupiah · Buka setiap hari 07.00 – 22.00', 100, 1400, 1040, 28, 'Montserrat', '#a8937d', { align: 'center' }),
  ])];
}, 2);

add('ig-info', 'Infografis Statistik', 'infographic', 800, 2000, 'infografis statistik data edukasi', () => [page('#f8fafc', [
  r(0, 0, 800, 520, lg(135, '#0e9384', '#2563eb')),
  t('INFOGRAFIS', 60, 80, 680, 18, 'Poppins', '#ccfbf1', { weight: 700, ls: 400 }),
  t('Kebiasaan Membaca<br>Generasi Muda', 60, 120, 680, 52, 'Poppins', '#ffffff', { weight: 800, lh: 1.1 }),
  t('Survei 2.400 responden usia 15–30 tahun di 12 kota.', 60, 280, 620, 20, 'Poppins', '#e0f2fe', { lh: 1.5 }),
  ...[['68%', 'membaca lewat ponsel setiap hari'], ['3,2 jam', 'rata-rata membaca per minggu'], ['41%', 'pernah membeli buku digital']].map(([a, b], i) => [
    r(60, 580 + i * 220, 680, 190, '#ffffff', { radius: 24, shadow: { x: 0, y: 10, blur: 30, color: '#0f172a', op: 8 } }),
    t(a, 100, 615 + i * 220, 300, 64, 'Poppins', '#0e9384', { weight: 800 }),
    t(b, 380, 640 + i * 220, 320, 22, 'Poppins', '#334155', { lh: 1.45 }),
  ]),
  t('Genre favorit', 60, 1280, 680, 30, 'Poppins', '#0f172a', { weight: 800 }),
  chartEl('hbar', { x: 60, y: 1340, w: 680, h: 460, data: [['Fiksi', 46], ['Pengembangan diri', 31], ['Komik', 28], ['Sejarah', 14], ['Sains', 12]], series: ['%'], colors: ['#0e9384', '#2563eb'], legend: false, font: 'Poppins', fg: '#334155' }),
  t('Sumber: Survei Literasi Muda 2026', 60, 1880, 680, 16, 'Poppins', '#94a3b8'),
])]);

add('bn-promo', 'Spanduk Promo Toko', 'banner', 3000, 1000, 'spanduk banner promo toko pembukaan', () => [page('#e11d48', [
  r(0, 0, 1500, 1000, '#be123c'), s('circle', 1220, -280, 760, 760, '#fb7185'),
  t('PROMO<br>AKHIR TAHUN', 120, 200, 1300, 230, 'Anton', '#ffffff', { lh: .95 }),
  t('Diskon hingga 50% untuk semua produk', 120, 720, 1450, 62, 'Poppins', '#ffe4e6', { weight: 600 }),
  img(1074, 1650, 120, 1220, 760, { radius: 40 }),
])], 1);

export const TEMPLATES = TPL;
export const templatesFor = (size) => TPL.filter(t => t.size === size);
export function templateById(id) { return TPL.find(t => t.id === id); }

// Match templates whose aspect ratio is close to the current design.
export function templatesByAspect(w, h) {
  const ar = w / h;
  return TPL.map(t => ({ t, d: Math.abs(Math.log((t.w / t.h) / ar)) })).sort((a, b) => a.d - b.d).filter(x => x.d < .25).map(x => x.t);
}
