// Shape geometry. Every shape is a path computed for the element's real w×h so strokes
// stay uniform when a shape is stretched.

const poly = (pts, w, h) => 'M' + pts.map(([x, y]) => `${(x * w).toFixed(2)} ${(y * h).toFixed(2)}`).join('L') + 'Z';
const ngon = (n, rot = -90) => Array.from({ length: n }, (_, i) => {
  const a = (rot + i * 360 / n) * Math.PI / 180;
  return [.5 + .5 * Math.cos(a), .5 + .5 * Math.sin(a)];
});
const star = (n, inner) => Array.from({ length: n * 2 }, (_, i) => {
  const a = (-90 + i * 180 / n) * Math.PI / 180, r = i % 2 ? inner : .5;
  return [.5 + r * Math.cos(a), .5 + r * Math.sin(a)];
});
function rrect(w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (!r) return `M0 0H${w}V${h}H0Z`;
  return `M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${h - r}A${r} ${r} 0 0 1 ${w - r} ${h}H${r}A${r} ${r} 0 0 1 0 ${h - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`;
}
// Normalised cubic outlines (0..1) scaled to the box.
const curve = (d) => (w, h) => d.replace(/(-?\d*\.?\d+)\s+(-?\d*\.?\d+)/g, (_, x, y) => `${(x * w).toFixed(2)} ${(y * h).toFixed(2)}`);

const DEFS = {
  rect: { name: 'Persegi', path: (w, h, r) => rrect(w, h, r) },
  rounded: { name: 'Persegi bulat', path: (w, h) => rrect(w, h, Math.min(w, h) * .18) },
  circle: { name: 'Lingkaran', path: (w, h) => `M${w / 2} 0A${w / 2} ${h / 2} 0 1 1 ${w / 2} ${h}A${w / 2} ${h / 2} 0 1 1 ${w / 2} 0Z` },
  triangle: { name: 'Segitiga', path: (w, h) => poly([[.5, 0], [1, 1], [0, 1]], w, h) },
  rtriangle: { name: 'Segitiga siku', path: (w, h) => poly([[0, 0], [1, 1], [0, 1]], w, h) },
  diamond: { name: 'Belah ketupat', path: (w, h) => poly([[.5, 0], [1, .5], [.5, 1], [0, .5]], w, h) },
  pentagon: { name: 'Segi lima', path: (w, h) => poly(ngon(5), w, h) },
  hexagon: { name: 'Segi enam', path: (w, h) => poly(ngon(6, 0), w, h) },
  octagon: { name: 'Segi delapan', path: (w, h) => poly(ngon(8, 22.5), w, h) },
  star: { name: 'Bintang', path: (w, h) => poly(star(5, .2), w, h) },
  star4: { name: 'Kilau', path: (w, h) => poly(star(4, .14), w, h) },
  star6: { name: 'Bintang 6', path: (w, h) => poly(star(6, .3), w, h) },
  burst: { name: 'Ledakan', path: (w, h) => poly(star(12, .38), w, h) },
  seal: { name: 'Segel', path: (w, h) => poly(star(24, .44), w, h) },
  heart: { name: 'Hati', path: curve('M.5 .94C.33 .8 0 .58 0 .3C0 .13 .13 0 .28 0C.38 0 .46 .05 .5 .14C.54 .05 .62 0 .72 0C.87 0 1 .13 1 .3C1 .58 .67 .8 .5 .94Z') },
  arrow: { name: 'Panah', path: (w, h) => poly([[0, .3], [.62, .3], [.62, 0], [1, .5], [.62, 1], [.62, .7], [0, .7]], w, h) },
  arrowL: { name: 'Panah kiri', path: (w, h) => poly([[1, .3], [.38, .3], [.38, 0], [0, .5], [.38, 1], [.38, .7], [1, .7]], w, h) },
  arrow2: { name: 'Panah ganda', path: (w, h) => poly([[0, .5], [.28, 0], [.28, .3], [.72, .3], [.72, 0], [1, .5], [.72, 1], [.72, .7], [.28, .7], [.28, 1]], w, h) },
  chevron: { name: 'Chevron', path: (w, h) => poly([[0, 0], [.7, 0], [1, .5], [.7, 1], [0, 1], [.3, .5]], w, h) },
  pentArrow: { name: 'Label panah', path: (w, h) => poly([[0, 0], [.78, 0], [1, .5], [.78, 1], [0, 1]], w, h) },
  plus: { name: 'Plus', path: (w, h) => poly([[.35, 0], [.65, 0], [.65, .35], [1, .35], [1, .65], [.65, .65], [.65, 1], [.35, 1], [.35, .65], [0, .65], [0, .35], [.35, .35]], w, h) },
  cross: { name: 'Silang', path: (w, h) => poly([[.2, 0], [.5, .3], [.8, 0], [1, .2], [.7, .5], [1, .8], [.8, 1], [.5, .7], [.2, 1], [0, .8], [.3, .5], [0, .2]], w, h) },
  parallelogram: { name: 'Jajar genjang', path: (w, h) => poly([[.22, 0], [1, 0], [.78, 1], [0, 1]], w, h) },
  trapezoid: { name: 'Trapesium', path: (w, h) => poly([[.2, 0], [.8, 0], [1, 1], [0, 1]], w, h) },
  arch: { name: 'Lengkung', path: (w, h) => { const r = w / 2; return `M0 ${h}V${Math.min(r, h)}A${r} ${Math.min(r, h)} 0 0 1 ${w} ${Math.min(r, h)}V${h}Z`; } },
  semicircle: { name: 'Setengah lingkaran', path: (w, h) => `M0 ${h}A${w / 2} ${h} 0 0 1 ${w} ${h}Z` },
  quarter: { name: 'Seperempat', path: (w, h) => `M0 0A${w} ${h} 0 0 1 ${w} ${h}H0Z` },
  pill: { name: 'Pil', path: (w, h) => rrect(w, h, Math.min(w, h) / 2) },
  ticket: { name: 'Tiket', path: (w, h) => { const r = Math.min(w, h) * .12; return `M0 0H${w}V${h / 2 - r}A${r} ${r} 0 0 0 ${w} ${h / 2 + r}V${h}H0V${h / 2 + r}A${r} ${r} 0 0 0 0 ${h / 2 - r}Z`; } },
  bubble: { name: 'Gelembung', path: curve('M.12 0L.88 0C.95 0 1 .05 1 .12L1 .66C1 .73 .95 .78 .88 .78L.36 .78L.18 1L.2 .78L.12 .78C.05 .78 0 .73 0 .66L0 .12C0 .05 .05 0 .12 0Z') },
  bubbleR: { name: 'Gelembung bulat', path: curve('M.5 0C.78 0 1 .17 1 .4C1 .62 .78 .8 .5 .8C.44 .8 .38 .79 .33 .78L.12 .95L.17 .7C.06 .63 0 .52 0 .4C0 .17 .22 0 .5 0Z') },
  cloud: { name: 'Awan', path: curve('M.25 .9C.11 .9 0 .79 0 .65C0 .52 .1 .42 .22 .4C.23 .24 .36 .12 .52 .12C.64 .12 .74 .19 .79 .29C.91 .3 1 .41 1 .54C1 .74 .86 .9 .68 .9Z') },
  blob1: { name: 'Blob', path: curve('M.83 .17C.98 .32 1.02 .58 .9 .76C.78 .95 .5 1.02 .3 .93C.1 .84 -.03 .6 .02 .4C.07 .19 .27 .02 .48 .01C.62 0 .74 .08 .83 .17Z') },
  blob2: { name: 'Blob 2', path: curve('M.78 .1C.93 .2 .98 .42 .95 .6C.92 .8 .78 .97 .56 .99C.33 1.01 .1 .89 .03 .67C-.04 .45 .06 .2 .25 .08C.42 -.03 .63 0 .78 .1Z') },
  blob3: { name: 'Blob 3', path: curve('M.62 .03C.82 .07 .99 .25 .99 .46C.99 .63 .88 .7 .86 .84C.83 .98 .63 1.02 .47 .97C.3 .92 .23 .8 .11 .69C-.02 .56 -.03 .36 .08 .2C.2 .04 .43 -.01 .62 .03Z') },
  flower: { name: 'Bunga', path: curve('M.5 .2C.55 .02 .8 .02 .82 .2C1 .2 1 .45 .84 .5C1 .55 1 .8 .82 .8C.8 .98 .55 .98 .5 .8C.45 .98 .2 .98 .18 .8C0 .8 0 .55 .16 .5C0 .45 0 .2 .18 .2C.2 .02 .45 .02 .5 .2Z') },
  ring: { name: 'Cincin', path: (w, h) => `M${w / 2} 0A${w / 2} ${h / 2} 0 1 1 ${w / 2} ${h}A${w / 2} ${h / 2} 0 1 1 ${w / 2} 0ZM${w / 2} ${h * .22}A${w * .28} ${h * .28} 0 1 0 ${w / 2} ${h * .78}A${w * .28} ${h * .28} 0 1 0 ${w / 2} ${h * .22}Z`, evenodd: true },
  moon: { name: 'Bulan sabit', path: curve('M.62 0C.34 .06 .14 .3 .14 .58C.14 .83 .33 1 .58 1C.76 1 .9 .93 1 .82C.94 .84 .88 .85 .82 .85C.55 .85 .34 .64 .34 .37C.34 .21 .45 .07 .62 0Z') },
  shield: { name: 'Perisai', path: curve('M.5 0L1 .16V.46C1 .74 .78 .93 .5 1C.22 .93 0 .74 0 .46V.16Z') },
  drop: { name: 'Tetesan', path: curve('M.5 0C.5 0 .9 .45 .9 .66C.9 .87 .72 1 .5 1C.28 1 .1 .87 .1 .66C.1 .45 .5 0 .5 0Z') },
  badge: { name: 'Lencana', path: (w, h) => poly(star(16, .43), w, h) },
};
export const SHAPES = DEFS;
export const SHAPE_LIST = Object.keys(DEFS);
export function shapePath(kind, w, h, radius = 0) {
  const d = DEFS[kind] || DEFS.rect;
  return d.path(w, h, radius);
}
export const shapeEvenOdd = (kind) => !!DEFS[kind]?.evenodd;

// Masks for image frames, expressed as CSS clip-path for a box of w×h.
export const MASKS = {
  rect: 'Persegi', rounded: 'Persegi bulat', circle: 'Lingkaran', arch: 'Lengkung', heart: 'Hati', star: 'Bintang',
  hexagon: 'Segi enam', diamond: 'Belah ketupat', triangle: 'Segitiga', blob1: 'Blob', blob2: 'Blob 2', flower: 'Bunga',
  drop: 'Tetesan', shield: 'Perisai', pill: 'Pil', ticket: 'Tiket', burst: 'Ledakan', cloud: 'Awan', seal: 'Segel',
};
export function maskCSS(mask, w, h, radius = 0) {
  if (!mask || mask === 'rect') return radius ? `inset(0 round ${radius}px)` : '';
  if (mask === 'circle') return 'ellipse(50% 50% at 50% 50%)';
  return `path('${shapePath(mask, w, h, radius)}')`;
}
