// Appearance: light/dark/system, accent colour, glass material and wallpaper.

const KEY = 'adesign.ui';
const DEF = { mode: 'system', accent: 'violet', glass: 'liquid', bg: 'aurora', canvas: 'soft' };
const mq = matchMedia('(prefers-color-scheme: dark)');

export const ACCENTS = [
  ['violet', 'Ungu', '#7b3fe4'], ['indigo', 'Nila', '#4f46e5'], ['blue', 'Biru', '#1f6feb'], ['teal', 'Toska', '#0e9384'],
  ['green', 'Hijau', '#16a34a'], ['orange', 'Jingga', '#ea6a0c'], ['pink', 'Merah muda', '#db2777'], ['red', 'Merah', '#dc2626'], ['graphite', 'Grafit', '#475467'],
];
export const WALLPAPERS = [
  ['aurora', 'Aurora'], ['ocean', 'Samudra'], ['sunset', 'Senja'], ['mesh', 'Mesh'], ['soft', 'Lembut'], ['plain', 'Polos'],
];
export const GLASS = [['liquid', 'Liquid glass'], ['frost', 'Kaca buram'], ['solid', 'Solid']];

export const Theme = {
  p: (() => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEF }; } })(),
  get dark() { return this.p.mode === 'dark' || (this.p.mode === 'system' && mq.matches); },
  set(patch) {
    Object.assign(this.p, patch);
    try { localStorage.setItem(KEY, JSON.stringify(this.p)); } catch {}
    this.apply();
  },
  apply() {
    const r = document.documentElement;
    r.dataset.theme = this.dark ? 'dark' : 'light';
    r.dataset.accent = this.p.accent;
    r.dataset.glass = this.p.glass;
    r.dataset.bg = this.p.bg;
    r.dataset.canvas = this.p.canvas;
    r.classList.toggle('can-refract', !!window.chrome);
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', this.dark ? '#0d0f16' : '#f1eefb');
  },
};
mq.addEventListener?.('change', () => Theme.apply());

// Liquid glass: a displacement map that bends whatever sits behind a panel near its rim,
// the way thick glass does. Only Chromium supports url() filters inside backdrop-filter.
export function installRefraction() {
  if (document.getElementById('lg-refract')) return;
  const N = 128, c = document.createElement('canvas');
  c.width = c.height = N;
  const x = c.getContext('2d'), img = x.createImageData(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = i / (N - 1) * 2 - 1, v = j / (N - 1) * 2 - 1;
    const ex = Math.max(0, (Math.abs(u) - .84) / .16), ey = Math.max(0, (Math.abs(v) - .6) / .4);
    const dx = -Math.sign(u) * ex * ex, dy = -Math.sign(v) * ey * ey;
    const k = (j * N + i) * 4;
    img.data[k] = 128 + dx * 120; img.data[k + 1] = 128 + dy * 120; img.data[k + 2] = 128; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  svg.innerHTML = `<filter id="lg-refract" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feImage href="${c.toDataURL()}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map"/>
    <feDisplacementMap in="SourceGraphic" in2="map" scale="28" xChannelSelector="R" yChannelSelector="G"/></filter>`;
  document.body.append(svg);
}
