// Design document model: sizes catalogue, element factories and geometry helpers.
import { uid, clone } from './util.js';

// [key, name, w, h, group, icon, unit hint]
export const SIZES = [
  ['ig-post', 'Postingan Instagram (Persegi)', 1080, 1080, 'social', 'photo_camera'],
  ['ig-portrait', 'Postingan Instagram (Potret)', 1080, 1350, 'social', 'photo_camera'],
  ['ig-story', 'Story Instagram', 1080, 1920, 'social', 'amp_stories'],
  ['reels', 'Reels / TikTok', 1080, 1920, 'social', 'movie'],
  ['fb-post', 'Postingan Facebook', 1200, 630, 'social', 'thumb_up'],
  ['fb-cover', 'Sampul Facebook', 1640, 624, 'social', 'panorama'],
  ['yt-thumb', 'Thumbnail YouTube', 1280, 720, 'social', 'smart_display'],
  ['yt-banner', 'Banner Saluran YouTube', 2560, 1440, 'social', 'smart_display'],
  ['x-post', 'Postingan X', 1600, 900, 'social', 'tag'],
  ['li-post', 'Postingan LinkedIn', 1200, 1200, 'social', 'work'],
  ['li-banner', 'Banner LinkedIn', 1584, 396, 'social', 'work'],
  ['pin', 'Pin Pinterest', 1000, 1500, 'social', 'push_pin'],
  ['wa-status', 'Status WhatsApp', 1080, 1920, 'social', 'chat'],
  ['pres', 'Presentasi (16:9)', 1920, 1080, 'pres', 'co_present'],
  ['pres43', 'Presentasi (4:3)', 1024, 768, 'pres', 'co_present'],
  ['poster', 'Poster (A3)', 3508, 4961, 'print', 'wallpaper', 'mm 297 × 420'],
  ['poster-a4', 'Poster (A4)', 2480, 3508, 'print', 'wallpaper', 'mm 210 × 297'],
  ['flyer', 'Flyer (A5)', 1748, 2480, 'print', 'description', 'mm 148 × 210'],
  ['doc', 'Dokumen A4', 794, 1123, 'docs', 'article', 'A4'],
  ['letter', 'Kop Surat', 794, 1123, 'docs', 'mail'],
  ['resume', 'CV / Resume', 794, 1123, 'docs', 'badge'],
  ['card', 'Kartu Nama', 1050, 600, 'print', 'contact_page', 'mm 89 × 51'],
  ['logo', 'Logo', 500, 500, 'brand', 'category'],
  ['cert', 'Sertifikat', 2000, 1414, 'print', 'workspace_premium', 'A4 lanskap'],
  ['invite', 'Undangan', 1500, 2100, 'print', 'celebration', '5 × 7 in'],
  ['menu', 'Menu Restoran', 2480, 3508, 'print', 'restaurant_menu'],
  ['infographic', 'Infografis', 800, 2000, 'docs', 'insights'],
  ['banner', 'Banner Spanduk', 3000, 1000, 'print', 'flag', '3 × 1 m'],
  ['brochure', 'Brosur Lipat 3', 3508, 2480, 'print', 'auto_stories', 'A4 lanskap'],
  ['label', 'Label Produk', 1200, 800, 'print', 'sell'],
  ['desktop', 'Wallpaper Desktop', 1920, 1080, 'brand', 'desktop_windows'],
  ['phone', 'Wallpaper Ponsel', 1080, 2340, 'brand', 'smartphone'],
  ['email', 'Header Email', 600, 200, 'brand', 'alternate_email'],
  ['web', 'Banner Situs Web', 1440, 600, 'brand', 'web'],
  ['whiteboard', 'Papan Tulis', 4000, 2600, 'docs', 'developer_board'],
  ['zoom', 'Latar Virtual', 1920, 1080, 'brand', 'videocam'],
];
export const SIZE_GROUPS = [
  ['all', 'Untuk Anda', 'auto_awesome'], ['social', 'Media sosial', 'favorite'], ['pres', 'Presentasi', 'co_present'],
  ['print', 'Cetak', 'print'], ['docs', 'Dokumen', 'description'], ['brand', 'Lainnya', 'apps'],
];
export const sizeByKey = (k) => SIZES.find(s => s[0] === k);

export function newDesign(w = 1080, h = 1080, name = 'Desain tanpa judul', type = 'custom') {
  const now = Date.now();
  return { id: uid('d'), name, w, h, type, created: now, updated: now, starred: false, folder: '', pages: [newPage()], v: 1 };
}
export function newPage(bg = '#ffffff') {
  return { id: uid('p'), title: '', bg: { fill: bg }, els: [], notes: '', dur: 5, trans: 'none', anim: null };
}

const base = (type, o) => ({ id: uid('e'), type, x: 0, y: 0, w: 100, h: 100, rot: 0, op: 1, lock: false, gid: null, flipX: false, flipY: false, anim: null, link: '', ...o });

export const TEXT_DEF = {
  font: 'Inter', size: 32, color: '#1d1d24', weight: 400, italic: false, underline: false, strike: false,
  align: 'left', lh: 1.4, ls: 0, upper: false, fx: null, curve: 0, list: '',
};
export function textEl(o = {}) {
  return base('text', { ...TEXT_DEF, html: 'Teks', w: 400, h: 50, ...o });
}
export function shapeEl(shape = 'rect', o = {}) {
  return base('shape', { shape, fill: '#c9c4d8', stroke: null, radius: 0, w: 260, h: 260, ...o });
}
export function lineEl(o = {}) {
  return base('line', { w: 320, h: 16, color: '#1d1d24', weight: 4, dash: 'solid', start: 'none', end: 'none', round: true, ...o });
}
export function imageEl(src, iw, ih, o = {}) {
  return base('image', { src, nw: iw, nh: ih, ix: 0, iy: 0, iw: 1, ih: 1, filter: null, radius: 0, mask: null, stroke: null, shadow: null, ...o });
}
export function frameEl(mask = 'rect', o = {}) {
  return base('image', { src: null, nw: 0, nh: 0, ix: 0, iy: 0, iw: 1, ih: 1, filter: null, radius: 0, mask, frame: true, w: 300, h: 300, ...o });
}
export function svgEl(svg, o = {}) {
  return base('svg', { svg, colors: {}, mono: null, w: 200, h: 200, ...o });
}
export function pathEl(o = {}) {
  return base('path', { d: '', vw: 100, vh: 100, color: '#1d1d24', weight: 6, ...o });
}
export function chartEl(chart = 'bar', o = {}) {
  return base('chart', {
    chart, w: 520, h: 340,
    data: [['Jan', 32, 20], ['Feb', 45, 28], ['Mar', 38, 35], ['Apr', 60, 42], ['Mei', 52, 48]],
    series: ['Seri 1', 'Seri 2'], colors: ['#7b3fe4', '#14b8a6', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'],
    font: 'Inter', fg: '#3d3d4e', grid: true, labels: true, legend: true, ...o,
  });
}
export function tableEl(r = 3, c = 3, o = {}) {
  const rows = Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => (i === 0 ? 'Judul ' + (j + 1) : '')));
  return base('table', {
    rows, cols: Array(c).fill(1 / c), w: 540, h: 40 * r,
    font: 'Inter', size: 18, color: '#1d1d24', head: '#7b3fe4', headColor: '#ffffff', cell: '#ffffff', stripe: '#f4f1fb', border: '#d9d4e6', bw: 1, pad: 10, ...o,
  });
}
export function qrEl(data = 'https://liemyo.github.io/canva/', o = {}) {
  return base('qr', { kind: 'qr', data, fg: '#111111', bg: '#ffffff', ecc: 'M', w: 300, h: 300, ...o });
}

// ---------- geometry ----------
export function corners(e) {
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2, r = (e.rot || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => {
    const dx = u * e.w / 2, dy = v * e.h / 2;
    return [cx + dx * c - dy * s, cy + dx * s + dy * c];
  });
}
export function bbox(els) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const e of els) for (const [x, y] of (e.rot ? corners(e) : [[e.x, e.y], [e.x + e.w, e.y + e.h]])) {
    if (x < x1) x1 = x; if (y < y1) y1 = y; if (x > x2) x2 = x; if (y > y2) y2 = y;
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
export const rotPt = (x, y, cx, cy, deg) => {
  const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), dx = x - cx, dy = y - cy;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
};
export const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// Deep copy with fresh ids, keeping group membership consistent.
export function cloneEls(els) {
  const gmap = {};
  return els.map(e => {
    const c = clone(e);
    c.id = uid('e');
    if (c.gid) c.gid = gmap[c.gid] ||= uid('g');
    return c;
  });
}
export function clonePage(p) { const c = clone(p); c.id = uid('p'); c.els = cloneEls(p.els); return c; }

// Colours used by a design, most frequent first.
export function designColors(design) {
  const m = new Map(), add = (c) => { if (typeof c === 'string' && /^#/.test(c)) m.set(c.toLowerCase().slice(0, 7), (m.get(c.toLowerCase().slice(0, 7)) || 0) + 1); };
  const fill = (f) => { if (!f) return; if (typeof f === 'string') add(f); else f.stops?.forEach(s => add(s[0])); };
  for (const p of design.pages) {
    fill(p.bg?.fill);
    for (const e of p.els) {
      fill(e.fill); add(e.color); add(e.stroke?.c); add(e.fg); add(e.head); add(e.fx?.color);
      if (e.type === 'text') (e.html.match(/#[0-9a-f]{6}/gi) || []).forEach(add);
      if (e.type === 'svg') Object.values(e.colors || {}).forEach(add);
      if (e.type === 'chart') e.colors.slice(0, e.series.length).forEach(add);
    }
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]);
}
export function designFonts(design) {
  const s = new Set();
  for (const p of design.pages) for (const e of p.els) {
    if (e.font) s.add(e.font);
    if (e.type === 'text') for (const m of e.html.matchAll(/font-family:\s*&quot;([^&]+)&quot;|font-family:\s*"([^"]+)"/g)) s.add(m[1] || m[2]);
  }
  return [...s];
}
