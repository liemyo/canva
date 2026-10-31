// Image processing: AI background removal, colour-key removal, palette extraction,
// auto-enhance and simple resize/convert helpers.
import { loadImage, canvasBlob } from '../util.js';

const IMGLY = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.6.0/+esm';
let imgly;

// Runs entirely in the browser (ONNX model downloaded once and cached by the browser).
export async function removeBgAI(blob, onProgress) {
  imgly ||= import(IMGLY);
  const m = await imgly;
  const fn = m.removeBackground || m.default;
  return fn(blob, {
    model: 'isnet_quint8',
    output: { format: 'image/png' },
    progress: (key, cur, total) => onProgress?.(key, total ? cur / total : 0),
  });
}

// Flood-fill from the borders, removing pixels close to the edge colours.
export async function removeBgColor(blob, tolerance = 32, feather = 1) {
  const url = URL.createObjectURL(blob);
  try {
    const im = await loadImage(url);
    const W = im.naturalWidth, H = im.naturalHeight, c = new OffscreenCanvasOr(W, H), x = c.getContext('2d');
    x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, W, H), p = d.data;
    const seen = new Uint8Array(W * H), stack = [];
    const ref = [];
    for (let i = 0; i < W; i += Math.max(1, W >> 5)) ref.push(i, (H - 1) * W + i);
    for (let j = 0; j < H; j += Math.max(1, H >> 5)) ref.push(j * W, j * W + W - 1);
    const cols = ref.map(k => [p[k * 4], p[k * 4 + 1], p[k * 4 + 2]]);
    const t2 = tolerance * tolerance * 3;
    const near = (k) => { const r = p[k * 4], g = p[k * 4 + 1], b = p[k * 4 + 2]; for (const q of cols) { const dr = r - q[0], dg = g - q[1], db = b - q[2]; if (dr * dr + dg * dg + db * db <= t2) return true; } return false; };
    for (const k of ref) if (!seen[k] && near(k)) { seen[k] = 1; stack.push(k); }
    while (stack.length) {
      const k = stack.pop(); p[k * 4 + 3] = 0;
      const xx = k % W, yy = (k / W) | 0;
      for (const n of [xx > 0 ? k - 1 : -1, xx < W - 1 ? k + 1 : -1, yy > 0 ? k - W : -1, yy < H - 1 ? k + W : -1]) if (n >= 0 && !seen[n]) { seen[n] = 1; if (near(n)) stack.push(n); }
    }
    if (feather) for (let k = 0; k < W * H; k++) {
      if (p[k * 4 + 3] === 0) continue;
      const xx = k % W, yy = (k / W) | 0;
      let z = 0;
      if (xx > 0 && p[(k - 1) * 4 + 3] === 0) z++; if (xx < W - 1 && p[(k + 1) * 4 + 3] === 0) z++;
      if (yy > 0 && p[(k - W) * 4 + 3] === 0) z++; if (yy < H - 1 && p[(k + W) * 4 + 3] === 0) z++;
      if (z) p[k * 4 + 3] = Math.round(p[k * 4 + 3] * (1 - z * .2));
    }
    x.putImageData(d, 0, 0);
    return toBlob(c, 'image/png');
  } finally { URL.revokeObjectURL(url); }
}

function OffscreenCanvasOr(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const toBlob = (c, type, q) => canvasBlob(c, type, q);

// k-means palette (k colours, most common first).
export async function extractPalette(src, k = 6) {
  const im = await loadImage(src);
  const S = 96, r = Math.min(1, S / Math.max(im.naturalWidth, im.naturalHeight));
  const c = OffscreenCanvasOr(Math.max(1, im.naturalWidth * r | 0), Math.max(1, im.naturalHeight * r | 0)), x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(im, 0, 0, c.width, c.height);
  const p = x.getImageData(0, 0, c.width, c.height).data, px = [];
  for (let i = 0; i < p.length; i += 4) if (p[i + 3] > 128) px.push([p[i], p[i + 1], p[i + 2]]);
  if (!px.length) return [];
  let cent = Array.from({ length: k }, (_, i) => px[Math.floor((i + .5) * px.length / k)].slice());
  let assign = new Array(px.length).fill(0);
  for (let it = 0; it < 12; it++) {
    for (let i = 0; i < px.length; i++) {
      let best = 0, bd = Infinity;
      for (let j = 0; j < k; j++) { const a = px[i], b = cent[j], d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2; if (d < bd) { bd = d; best = j; } }
      assign[i] = best;
    }
    const sum = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let i = 0; i < px.length; i++) { const s = sum[assign[i]]; s[0] += px[i][0]; s[1] += px[i][1]; s[2] += px[i][2]; s[3]++; }
    cent = sum.map((s, j) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3], s[3]] : [...cent[j], 0]));
  }
  const hex = (v) => Math.round(v).toString(16).padStart(2, '0');
  return cent.sort((a, b) => b[3] - a[3]).map(c2 => '#' + hex(c2[0]) + hex(c2[1]) + hex(c2[2]));
}

// Suggest adjustment values (bri/con/sat) from the luminance histogram.
export async function autoEnhance(src) {
  const im = await loadImage(src);
  const c = OffscreenCanvasOr(64, 64), x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(im, 0, 0, 64, 64);
  const p = x.getImageData(0, 0, 64, 64).data;
  let sum = 0, lo = 255, hi = 0, sat = 0;
  const lum = [];
  for (let i = 0; i < p.length; i += 4) {
    const l = .299 * p[i] + .587 * p[i + 1] + .114 * p[i + 2]; lum.push(l); sum += l;
    const mx = Math.max(p[i], p[i + 1], p[i + 2]), mn = Math.min(p[i], p[i + 1], p[i + 2]); sat += mx ? (mx - mn) / mx : 0;
  }
  lum.sort((a, b) => a - b);
  lo = lum[Math.floor(lum.length * .02)]; hi = lum[Math.floor(lum.length * .98)];
  const mean = sum / lum.length, spread = hi - lo, s = sat / lum.length;
  return {
    bri: Math.round(Math.max(-30, Math.min(30, (128 - mean) / 3))),
    con: Math.round(Math.max(-10, Math.min(35, (200 - spread) / 5))),
    sat: Math.round(Math.max(-10, Math.min(30, (.35 - s) * 80))),
  };
}

// Resize / convert / compress an image file.
export async function convertImage(blob, { type = 'image/png', quality = .9, maxW, maxH, scale = 1 } = {}) {
  const url = URL.createObjectURL(blob);
  try {
    const im = await loadImage(url);
    let w = im.naturalWidth * scale, hh = im.naturalHeight * scale;
    if (maxW || maxH) { const k = Math.min(1, (maxW || Infinity) / w, (maxH || Infinity) / hh); w *= k; hh *= k; }
    const c = OffscreenCanvasOr(Math.max(1, Math.round(w)), Math.max(1, Math.round(hh))), x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    if (type === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); }
    x.drawImage(im, 0, 0, c.width, c.height);
    return { blob: await toBlob(c, type, quality), w: c.width, h: c.height };
  } finally { URL.revokeObjectURL(url); }
}
