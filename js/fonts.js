// Google Fonts catalogue + loader. Weights are listed explicitly because css2 rejects
// a request that names a weight the family does not ship.

const W = (a, b, s = 100) => { const r = []; for (let i = a; i <= b; i += s) r.push(i); return r; };
const F = (n, c, w = [400], i = false) => ({ n, c, w, i });

export const FONTS = [
  // sans
  F('Inter', 'sans', W(100, 900)), F('Poppins', 'sans', W(100, 900), true), F('Montserrat', 'sans', W(100, 900), true),
  F('Roboto', 'sans', [100, 300, 400, 500, 700, 900], true), F('Open Sans', 'sans', W(300, 800), true), F('Lato', 'sans', [100, 300, 400, 700, 900], true),
  F('Raleway', 'sans', W(100, 900), true), F('Nunito', 'sans', W(200, 900), true), F('DM Sans', 'sans', [400, 500, 700], true),
  F('Work Sans', 'sans', W(100, 900), true), F('Rubik', 'sans', W(300, 900), true), F('Manrope', 'sans', W(200, 800)),
  F('Plus Jakarta Sans', 'sans', W(200, 800), true), F('Space Grotesk', 'sans', W(300, 700)), F('Outfit', 'sans', W(100, 900)),
  F('Sora', 'sans', W(100, 800)), F('League Spartan', 'sans', W(100, 900)), F('Archivo', 'sans', W(100, 900), true),
  F('Barlow', 'sans', W(100, 900), true), F('Oswald', 'sans', W(200, 700)), F('Josefin Sans', 'sans', W(100, 700), true),
  F('Quicksand', 'sans', W(300, 700)), F('Kanit', 'sans', W(100, 900), true), F('Lexend', 'sans', W(100, 900)),
  F('Figtree', 'sans', W(300, 900)), F('Urbanist', 'sans', W(100, 900)), F('Syne', 'sans', W(400, 800)),
  F('Bricolage Grotesque', 'sans', W(200, 800)), F('Mulish', 'sans', W(200, 900)), F('Cabin', 'sans', W(400, 700)), F('Exo 2', 'sans', W(100, 900)),
  // serif
  F('Playfair Display', 'serif', W(400, 900), true), F('Lora', 'serif', W(400, 700), true), F('Merriweather', 'serif', [300, 400, 700, 900], true),
  F('DM Serif Display', 'serif', [400], true), F('Libre Baskerville', 'serif', [400, 700], true), F('Cormorant Garamond', 'serif', W(300, 700), true),
  F('EB Garamond', 'serif', W(400, 800), true), F('Fraunces', 'serif', W(100, 900), true), F('Crimson Text', 'serif', [400, 600, 700], true),
  F('Abril Fatface', 'serif'), F('Prata', 'serif'), F('Cinzel', 'serif', W(400, 900)), F('Bodoni Moda', 'serif', W(400, 900), true),
  F('Marcellus', 'serif'), F('Spectral', 'serif', W(200, 800), true), F('Zilla Slab', 'serif', W(300, 700), true),
  F('Roboto Slab', 'serif', W(100, 900)), F('Arvo', 'serif', [400, 700], true), F('Yeseva One', 'serif'), F('Gloock', 'serif'), F('Instrument Serif', 'serif', [400], true),
  // display
  F('Bebas Neue', 'display'), F('Anton', 'display'), F('Archivo Black', 'display'), F('Alfa Slab One', 'display'), F('Righteous', 'display'),
  F('Lobster', 'display'), F('Bungee', 'display'), F('Monoton', 'display'), F('Black Ops One', 'display'), F('Fredoka', 'display', W(300, 700)),
  F('Titan One', 'display'), F('Ultra', 'display'), F('Shrikhand', 'display'), F('Paytone One', 'display'), F('Luckiest Guy', 'display'),
  F('Russo One', 'display'), F('Staatliches', 'display'), F('Big Shoulders Display', 'display', W(100, 900)), F('Unbounded', 'display', W(200, 900)),
  F('Rubik Mono One', 'display'), F('Press Start 2P', 'display'), F('Bungee Shade', 'display'), F('Chango', 'display'), F('Teko', 'display', W(300, 700)),
  // script / handwriting
  F('Dancing Script', 'script', W(400, 700)), F('Great Vibes', 'script'), F('Pacifico', 'script'), F('Caveat', 'script', W(400, 700)),
  F('Satisfy', 'script'), F('Sacramento', 'script'), F('Kaushan Script', 'script'), F('Allura', 'script'), F('Parisienne', 'script'),
  F('Amatic SC', 'script', [400, 700]), F('Shadows Into Light', 'script'), F('Indie Flower', 'script'), F('Permanent Marker', 'script'),
  F('Patrick Hand', 'script'), F('Homemade Apple', 'script'), F('Alex Brush', 'script'), F('Yellowtail', 'script'), F('Courgette', 'script'),
  F('Cookie', 'script'), F('Playball', 'script'), F('Kalam', 'script', [300, 400, 700]), F('Pinyon Script', 'script'), F('Tangerine', 'script', [400, 700]),
  // mono
  F('JetBrains Mono', 'mono', W(100, 800), true), F('Space Mono', 'mono', [400, 700], true), F('IBM Plex Mono', 'mono', W(100, 700), true),
  F('Courier Prime', 'mono', [400, 700], true), F('Fira Code', 'mono', W(300, 700)),
];
export const FONT_CATS = [['all', 'Semua'], ['sans', 'Sans serif'], ['serif', 'Serif'], ['display', 'Dekoratif'], ['script', 'Tulisan tangan'], ['mono', 'Monospace']];
const byName = new Map(FONTS.map(f => [f.n, f]));
export const fontInfo = (n) => byName.get(n) || F(n, 'sans', [400, 700]);
export const fallback = (n) => ({ serif: 'serif', script: 'cursive', mono: 'monospace' }[fontInfo(n).c] || 'sans-serif');
export const fontStack = (n) => `"${n}", ${fallback(n)}`;

// The UI font is the system stack — no fetch needed for it.
const SYSTEM = new Set(['system-ui']);

function cssURL(n) {
  const f = fontInfo(n), fam = encodeURIComponent(n).replace(/%20/g, '+');
  if (f.w.length === 1 && f.w[0] === 400 && !f.i) return `https://fonts.googleapis.com/css2?family=${fam}&display=swap`;
  const ax = f.i ? 'ital,wght@' + [...f.w.map(w => '0,' + w), '1,400'].join(';') : 'wght@' + f.w.join(';');
  return `https://fonts.googleapis.com/css2?family=${fam}:${ax}&display=swap`;
}

const loaded = new Map();
export function loadFont(n) {
  if (!n || SYSTEM.has(n)) return Promise.resolve();
  if (loaded.has(n)) return loaded.get(n);
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = cssURL(n); link.crossOrigin = 'anonymous';
  const p = new Promise(res => {
    link.onload = () => {
      const f = fontInfo(n);
      Promise.all([document.fonts.load(`400 20px "${n}"`), f.w.includes(700) ? document.fonts.load(`700 20px "${n}"`) : null]).catch(() => {}).then(res);
    };
    link.onerror = () => res();
  });
  document.head.append(link);
  loaded.set(n, p);
  return p;
}
export const loadFonts = (names) => Promise.all([...new Set(names)].map(loadFont));

// Font-picker previews use a renamed, text-subset face so they never shadow the full family.
const pv = new Map();
export function previewFamily(n) {
  if (pv.has(n)) return pv.get(n);
  const fam = encodeURIComponent(n).replace(/%20/g, '+');
  const name = 'pv-' + n.replace(/\s+/g, '-');
  const p = fetch(`https://fonts.googleapis.com/css2?family=${fam}&text=${encodeURIComponent(n)}`)
    .then(r => r.ok ? r.text() : '')
    .then(css => { if (css) document.head.append(Object.assign(document.createElement('style'), { textContent: css.replace(/font-family:\s*'[^']+'/g, `font-family:'${name}'`) })); return name; })
    .catch(() => name);
  pv.set(n, p);
  return p;
}

// For export: inline the latin/latin-ext woff2 files of the families a page uses.
const embedCache = new Map();
export async function embedCSS(names) {
  const parts = await Promise.all([...new Set(names)].filter(n => !SYSTEM.has(n)).map(async (n) => {
    if (embedCache.has(n)) return embedCache.get(n);
    try {
      const css = await (await fetch(cssURL(n))).text();
      const blocks = css.split(/(?=\/\*\s*[\w-]+\s*\*\/)/).filter(b => /\/\*\s*latin(-ext)?\s*\*\//.test(b) || !/\/\*/.test(b));
      const out = await Promise.all(blocks.map(async (b) => {
        const m = /url\((https:[^)]+)\)/.exec(b);
        if (!m) return b;
        const blob = await (await fetch(m[1])).blob();
        const data = await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
        return b.replace(m[1], data);
      }));
      const s = out.join('\n');
      embedCache.set(n, s);
      return s;
    } catch { return ''; }
  }));
  return parts.join('\n');
}

// Font pairings shown in the Text panel and Brand kit.
export const PAIRS = [
  ['Playfair Display', 'Lato'], ['Montserrat', 'Merriweather'], ['Bebas Neue', 'Montserrat'], ['DM Serif Display', 'DM Sans'],
  ['Poppins', 'Lora'], ['Fraunces', 'Inter'], ['Syne', 'Inter'], ['Abril Fatface', 'Poppins'], ['Cormorant Garamond', 'Raleway'],
  ['League Spartan', 'Work Sans'], ['Anton', 'Roboto'], ['Great Vibes', 'Montserrat'], ['Space Grotesk', 'Space Mono'], ['Archivo Black', 'Archivo'],
  ['Cinzel', 'Lato'], ['Unbounded', 'Manrope'], ['Bodoni Moda', 'Figtree'], ['Pacifico', 'Quicksand'],
];
