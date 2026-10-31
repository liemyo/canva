// Turns the design model into DOM. The same renderer drives the editor, thumbnails,
// presentation mode and exports, so what you see is exactly what downloads.
import { h, esc, parseColor, clamp } from './util.js';
import { shapePath, shapeEvenOdd, maskCSS } from './shapes.js';
import { fontStack, loadFont } from './fonts.js';
import { assetURL, assetURLSync, isAsset } from './assets.js';

let gradSeq = 0;

export function paintCSS(f) {
  if (!f) return 'transparent';
  if (typeof f === 'string') return f;
  const st = (f.stops || []).map(([c, p]) => `${c} ${Math.round(p * 100)}%`).join(', ');
  return f.t === 'radial' ? `radial-gradient(circle at 50% 50%, ${st})` : `linear-gradient(${f.a ?? 90}deg, ${st})`;
}
function svgPaint(f, defs) {
  if (!f) return 'none';
  if (typeof f === 'string') return f;
  const id = 'g' + (++gradSeq);
  const stops = f.stops.map(([c, p]) => `<stop offset="${p}" stop-color="${c}"/>`).join('');
  if (f.t === 'radial') defs.push(`<radialGradient id="${id}" cx=".5" cy=".5" r=".5">${stops}</radialGradient>`);
  else {
    const a = ((f.a ?? 90) - 90) * Math.PI / 180, c = Math.cos(a) / 2, s = Math.sin(a) / 2;
    defs.push(`<linearGradient id="${id}" x1="${.5 - c}" y1="${.5 - s}" x2="${.5 + c}" y2="${.5 + s}">${stops}</linearGradient>`);
  }
  return `url(#${id})`;
}
const rgba = (c, a) => { const p = parseColor(c) || { r: 0, g: 0, b: 0, a: 1 }; return `rgba(${p.r | 0},${p.g | 0},${p.b | 0},${+(a * (p.a ?? 1)).toFixed(3)})`; };

// ---------- image filters ----------
export const FILTER_PRESETS = {
  none: ['Asli', {}],
  vivid: ['Cerah', { sat: 35, con: 12, bri: 4 }],
  warm: ['Hangat', { temp: 40, sat: 10 }],
  cool: ['Sejuk', { temp: -40, bri: 4 }],
  summer: ['Musim panas', { temp: 25, sat: 25, bri: 8, con: 6 }],
  retro: ['Retro', { sep: 35, con: -8, fade: 22, temp: 15 }],
  vintage: ['Vintage', { sep: 50, sat: -20, vig: 40, fade: 12 }],
  film: ['Film', { con: 18, sat: -12, fade: 18, tint: 8, vig: 22 }],
  drama: ['Dramatis', { con: 40, sat: -18, bri: -6, vig: 45 }],
  noir: ['Noir', { gray: 100, con: 35, vig: 35 }],
  mono: ['Mono', { gray: 100 }],
  pastel: ['Pastel', { sat: -25, bri: 10, fade: 25 }],
  fresh: ['Segar', { sat: 18, temp: -12, bri: 6, con: 8 }],
  golden: ['Keemasan', { temp: 55, sat: 20, con: 10, vig: 18 }],
  rose: ['Mawar', { tint: 30, bri: 6, sat: 8 }],
  matte: ['Matte', { con: -18, fade: 30, sat: -8 }],
  night: ['Malam', { temp: -55, bri: -12, con: 20, vig: 40 }],
  pop: ['Pop', { sat: 60, con: 25 }],
};
export function filterCSS(f) {
  if (!f) return '';
  const v = (k) => +f[k] || 0, out = [];
  if (v('bri')) out.push(`brightness(${1 + v('bri') / 160})`);
  if (v('con')) out.push(`contrast(${1 + v('con') / 100})`);
  if (v('sat')) out.push(`saturate(${Math.max(0, 1 + v('sat') / 100)})`);
  if (v('hue')) out.push(`hue-rotate(${v('hue') * 1.8}deg)`);
  if (v('sep')) out.push(`sepia(${v('sep') / 100})`);
  if (v('gray')) out.push(`grayscale(${v('gray') / 100})`);
  if (v('blur')) out.push(`blur(${v('blur') / 10}px)`);
  return out.join(' ');
}
function filterOverlays(f) {
  if (!f) return [];
  const o = [], v = (k) => +f[k] || 0;
  if (v('temp')) o.push(h('i.ov', { style: { background: v('temp') > 0 ? `rgba(255,150,40,${v('temp') / 330})` : `rgba(40,120,255,${-v('temp') / 330})`, mixBlendMode: 'soft-light' } }));
  if (v('tint')) o.push(h('i.ov', { style: { background: v('tint') > 0 ? `rgba(255,40,170,${v('tint') / 400})` : `rgba(40,220,90,${-v('tint') / 400})`, mixBlendMode: 'soft-light' } }));
  if (v('fade')) o.push(h('i.ov', { style: { background: `rgba(240,236,230,${v('fade') / 260})` } }));
  if (v('vig')) o.push(h('i.ov', { style: { background: `radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,${v('vig') / 120}) 100%)` } }));
  return o;
}

// ---------- text ----------
export const TEXT_FX = {
  none: 'Tidak ada', shadow: 'Bayangan', lift: 'Angkat', hollow: 'Berongga', splice: 'Sambung', outline: 'Garis tepi',
  echo: 'Gema', glitch: 'Glitch', neon: 'Neon', background: 'Latar', gradient: 'Gradasi',
};
export const FX_DEF = {
  shadow: { ox: 6, oy: 6, blur: 10, color: '#000000', op: 40 },
  lift: { int: 50 },
  hollow: { thick: 3 },
  splice: { thick: 3, ox: 6, oy: 6, color: '#7b3fe4' },
  outline: { thick: 4, color: '#000000' },
  echo: { ox: 6, oy: 6, color: '' },
  glitch: { off: 4, c1: '#00e5ff', c2: '#ff2bd6' },
  neon: { int: 50 },
  background: { color: '#ffd74a', round: 30, spread: 40, op: 100 },
  gradient: { c1: '#7b3fe4', c2: '#ff5fa2', a: 90 },
};
function fxStyle(e) {
  const fx = e.fx, s = {}, sz = e.size;
  if (!fx || fx.type === 'none') return s;
  const p = { ...FX_DEF[fx.type], ...fx }, k = sz / 100;
  switch (fx.type) {
    case 'shadow': s.textShadow = `${p.ox * k}px ${p.oy * k}px ${p.blur * k}px ${rgba(p.color, p.op / 100)}`; break;
    case 'lift': s.textShadow = `0 ${sz * .05}px ${sz * (.1 + p.int / 300)}px rgba(0,0,0,${.12 + p.int / 180})`; break;
    case 'hollow': s.color = 'transparent'; s.webkitTextStroke = `${Math.max(1, p.thick * k * 2)}px ${e.color}`; break;
    case 'splice': s.color = 'transparent'; s.webkitTextStroke = `${Math.max(1, p.thick * k * 2)}px ${e.color}`; s.textShadow = `${p.ox * k}px ${p.oy * k}px 0 ${p.color}`; break;
    case 'outline': s.webkitTextStroke = `${p.thick * k * 2.4}px ${p.color}`; s.paintOrder = 'stroke fill'; break;
    case 'echo': { const c = p.color || e.color; s.textShadow = `${p.ox * k}px ${p.oy * k}px 0 ${rgba(c, .5)}, ${p.ox * k * 2}px ${p.oy * k * 2}px 0 ${rgba(c, .3)}, ${p.ox * k * 3}px ${p.oy * k * 3}px 0 ${rgba(c, .15)}`; break; }
    case 'glitch': s.textShadow = `${-p.off * k}px 0 0 ${p.c1}, ${p.off * k}px 0 0 ${p.c2}`; break;
    case 'neon': { const c = e.color, i = .4 + p.int / 100; s.color = mixWhite(c, .55); s.textShadow = `0 0 ${sz * .04 * i}px ${c}, 0 0 ${sz * .12 * i}px ${c}, 0 0 ${sz * .3 * i}px ${c}, 0 0 ${sz * .5 * i}px ${rgba(c, .6)}`; break; }
    case 'background': s.background = rgba(p.color, p.op / 100); s.borderRadius = (p.round / 100) * sz * .6 + 'px'; s.padding = `${(p.spread / 100) * sz * .35}px ${(p.spread / 100) * sz * .6}px`; break;
    case 'gradient': s.background = `linear-gradient(${p.a}deg, ${p.c1}, ${p.c2})`; s.webkitBackgroundClip = 'text'; s.backgroundClip = 'text'; s.color = 'transparent'; break;
  }
  return s;
}
function mixWhite(c, t) { const p = parseColor(c) || { r: 255, g: 255, b: 255 }; return `rgb(${p.r + (255 - p.r) * t | 0},${p.g + (255 - p.g) * t | 0},${p.b + (255 - p.b) * t | 0})`; }

export function textStyle(e) {
  return {
    fontFamily: fontStack(e.font), fontSize: e.size + 'px', color: e.color, fontWeight: e.weight,
    fontStyle: e.italic ? 'italic' : 'normal',
    textDecoration: [e.underline && 'underline', e.strike && 'line-through'].filter(Boolean).join(' ') || 'none',
    textAlign: e.align, lineHeight: e.lh, letterSpacing: (e.ls / 1000) + 'em',
    textTransform: e.upper ? 'uppercase' : 'none',
    ...fxStyle(e),
  };
}

// Text on a circular arc. Returns { w, h } of the box it needs and the SVG markup.
const measureCtx = document.createElement('canvas').getContext('2d');
export const plainText = (html) => { const t = document.createElement('template'); t.innerHTML = String(html).replace(/<br\s*\/?>/gi, ' ').replace(/<\/(div|p|li)>/gi, ' '); return t.content.textContent.replace(/\s+/g, ' ').trim(); };
export function curvedText(e) {
  const txt = (e.upper ? plainText(e.html).toUpperCase() : plainText(e.html)) || ' ';
  measureCtx.font = `${e.italic ? 'italic ' : ''}${e.weight} ${e.size}px ${fontStack(e.font)}`;
  const W = measureCtx.measureText(txt).width + txt.length * e.size * e.ls / 1000;
  const th = clamp(Math.abs(e.curve) / 100, .02, 1) * Math.PI * 1.9;
  const R = Math.max(W / th, e.size * .6), asc = e.size * .78, dsc = e.size * .24, neg = e.curve < 0;
  const rIn = neg ? R - asc : R - dsc, rOut = neg ? R + dsc : R + asc;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (let i = 0; i <= 64; i++) {
    const a = -th / 2 + th * i / 64;
    for (const r of [rIn, rOut]) {
      const x = r * Math.sin(a), y = neg ? r * Math.cos(a) : -r * Math.cos(a);
      x1 = Math.min(x1, x); x2 = Math.max(x2, x); y1 = Math.min(y1, y); y2 = Math.max(y2, y);
    }
  }
  const pad = e.size * .1, w = x2 - x1 + pad * 2, hh = y2 - y1 + pad * 2, cx = -x1 + pad, cy = -y1 + pad;
  const sa = -th / 2, ea = th / 2;
  const px = (a) => cx + R * Math.sin(a), py = (a) => neg ? cy + R * Math.cos(a) : cy - R * Math.cos(a);
  const large = th > Math.PI ? 1 : 0;
  const d = neg ? `M${px(ea)} ${py(ea)}A${R} ${R} 0 ${large} 0 ${px(sa)} ${py(sa)}` : `M${px(sa)} ${py(sa)}A${R} ${R} 0 ${large} 1 ${px(ea)} ${py(ea)}`;
  const id = 'cv' + (++gradSeq);
  const st = textStyle(e);
  const css = `font-family:${esc(st.fontFamily)};font-size:${e.size}px;font-weight:${e.weight};font-style:${st.fontStyle};letter-spacing:${st.letterSpacing};text-decoration:${st.textDecoration};${st.textShadow ? 'text-shadow:' + st.textShadow + ';' : ''}`;
  const fill = st.color === 'transparent' ? 'none' : (st.color || e.color);
  const stroke = e.fx?.type === 'hollow' || e.fx?.type === 'outline' || e.fx?.type === 'splice' ? `stroke="${e.fx.type === 'outline' ? (e.fx.color || '#000') : e.color}" stroke-width="${Math.max(1, (e.fx.thick || 3) * e.size / 50)}" paint-order="stroke"` : '';
  const svg = `<svg viewBox="0 0 ${w} ${hh}" width="100%" height="100%" style="overflow:visible"><path id="${id}" d="${d}" fill="none"/><text style="${css}" fill="${fill}" ${stroke}><textPath href="#${id}" startOffset="50%" text-anchor="middle">${esc(txt)}</textPath></text></svg>`;
  return { w, h: hh, svg };
}

// ---------- charts ----------
export const CHARTS = { bar: 'Batang', hbar: 'Batang horizontal', stack: 'Batang bertumpuk', line: 'Garis', area: 'Area', pie: 'Pai', donut: 'Donat', ring: 'Progres' };
export function chartSVG(e) {
  const W = e.w, H = e.h, fs = clamp(Math.min(W, H) / 20, 9, 40), defs = [], g = [];
  const rows = e.data.filter(r => r && r.length), S = e.series.length, col = (i) => e.colors[i % e.colors.length];
  const font = `font-family:${esc(fontStack(e.font))};font-size:${fs}px;fill:${e.fg}`;
  const legendH = e.legend && !['pie', 'donut', 'ring'].includes(e.chart) && S > 1 ? fs * 2 : 0;
  const nums = (r) => r.slice(1, S + 1).map(v => +v || 0);
  if (e.chart === 'pie' || e.chart === 'donut') {
    const vals = rows.map(r => Math.max(0, +r[1] || 0)), tot = vals.reduce((a, b) => a + b, 0) || 1;
    const lw = e.legend ? Math.min(W * .38, fs * 9) : 0, cx = (W - lw) / 2, cy = H / 2, R = Math.min(W - lw, H) / 2 * .92, r0 = e.chart === 'donut' ? R * .58 : 0;
    let a = -Math.PI / 2;
    vals.forEach((v, i) => {
      const da = v / tot * Math.PI * 2, a2 = a + da, lg = da > Math.PI ? 1 : 0;
      const p = (rr, ang) => `${cx + rr * Math.cos(ang)} ${cy + rr * Math.sin(ang)}`;
      if (da >= Math.PI * 2 - 1e-6) g.push(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="${col(i)}"/>`);
      else g.push(`<path d="M${r0 ? p(r0, a) : cx + ' ' + cy}L${p(R, a)}A${R} ${R} 0 ${lg} 1 ${p(R, a2)}${r0 ? `L${p(r0, a2)}A${r0} ${r0} 0 ${lg} 0 ${p(r0, a)}` : ''}Z" fill="${col(i)}" stroke="#fff" stroke-width="${Math.max(1, R / 90)}"/>`);
      if (e.labels && v / tot > .04) { const m = a + da / 2, rr = r0 ? (R + r0) / 2 : R * .64; g.push(`<text x="${cx + rr * Math.cos(m)}" y="${cy + rr * Math.sin(m)}" text-anchor="middle" dominant-baseline="central" style="${font};fill:#fff;font-weight:700">${Math.round(v / tot * 100)}%</text>`); }
      a = a2;
    });
    if (e.legend) rows.forEach((r, i) => {
      const y = cy - rows.length * fs * .8 + i * fs * 1.6 + fs * .8, x = W - lw + fs * .5;
      g.push(`<rect x="${x}" y="${y - fs * .45}" width="${fs * .9}" height="${fs * .9}" rx="${fs * .2}" fill="${col(i)}"/><text x="${x + fs * 1.4}" y="${y}" dominant-baseline="central" style="${font}">${esc(r[0])}</text>`);
    });
  } else if (e.chart === 'ring') {
    const v = clamp(+rows[0]?.[1] || 0, 0, 100), cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 * .86, sw = R * .2, c = 2 * Math.PI * R;
    g.push(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${col(1)}" stroke-opacity=".22" stroke-width="${sw}"/>`);
    g.push(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${col(0)}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${c * v / 100} ${c}" transform="rotate(-90 ${cx} ${cy})"/>`);
    g.push(`<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" style="${font};font-size:${R * .5}px;font-weight:700">${v}%</text>`);
  } else {
    const padL = fs * 3, padB = fs * 2.2, padT = fs * .8 + legendH, padR = fs, cw = W - padL - padR, ch = H - padT - padB;
    const stack = e.chart === 'stack', horiz = e.chart === 'hbar';
    const mx = Math.max(1, ...rows.map(r => stack ? nums(r).reduce((a, b) => a + b, 0) : Math.max(...nums(r))));
    const step = niceStep(mx / 4), top = Math.ceil(mx / step) * step;
    for (let t = 0; t <= top + 1e-9; t += step) {
      if (horiz) {
        const x = padL + cw * t / top;
        if (e.grid) g.push(`<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + ch}" stroke="${e.fg}" stroke-opacity=".15"/>`);
        g.push(`<text x="${x}" y="${padT + ch + fs * 1.3}" text-anchor="middle" style="${font};fill-opacity:.7">${fmtNum(t)}</text>`);
      } else {
        const y = padT + ch - ch * t / top;
        if (e.grid) g.push(`<line x1="${padL}" y1="${y}" x2="${padL + cw}" y2="${y}" stroke="${e.fg}" stroke-opacity=".15"/>`);
        g.push(`<text x="${padL - fs * .5}" y="${y}" text-anchor="end" dominant-baseline="central" style="${font};fill-opacity:.7">${fmtNum(t)}</text>`);
      }
    }
    const n = rows.length, band = (horiz ? ch : cw) / Math.max(1, n);
    if (e.chart === 'line' || e.chart === 'area') {
      for (let s = 0; s < S; s++) {
        const pts = rows.map((r, i) => [padL + band * (i + .5), padT + ch - ch * (+r[s + 1] || 0) / top]);
        const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join('');
        if (e.chart === 'area') g.push(`<path d="${d}L${pts.at(-1)[0]} ${padT + ch}L${pts[0][0]} ${padT + ch}Z" fill="${col(s)}" fill-opacity=".28"/>`);
        g.push(`<path d="${d}" fill="none" stroke="${col(s)}" stroke-width="${fs * .28}" stroke-linejoin="round" stroke-linecap="round"/>`);
        pts.forEach(p => g.push(`<circle cx="${p[0]}" cy="${p[1]}" r="${fs * .32}" fill="#fff" stroke="${col(s)}" stroke-width="${fs * .18}"/>`));
      }
    } else {
      const bw = band * .7 / (stack ? 1 : S);
      rows.forEach((r, i) => {
        let acc = 0;
        nums(r).forEach((v, s) => {
          const len = (horiz ? cw : ch) * v / top, off = stack ? (horiz ? cw : ch) * acc / top : 0;
          const o = band * .15 + (stack ? 0 : s * bw), rr = Math.min(bw * .18, fs * .4);
          if (horiz) g.push(`<rect x="${padL + off}" y="${padT + band * i + o}" width="${Math.max(0, len)}" height="${bw}" rx="${rr}" fill="${col(s)}"/>`);
          else g.push(`<rect x="${padL + band * i + o}" y="${padT + ch - len - off}" width="${bw}" height="${Math.max(0, len)}" rx="${rr}" fill="${col(s)}"/>`);
          if (e.labels && !stack && len > fs) {
            if (horiz) g.push(`<text x="${padL + len - fs * .4}" y="${padT + band * i + o + bw / 2}" text-anchor="end" dominant-baseline="central" style="${font};fill:#fff;font-size:${fs * .8}px">${fmtNum(v)}</text>`);
            else g.push(`<text x="${padL + band * i + o + bw / 2}" y="${padT + ch - len + fs * .9}" text-anchor="middle" style="${font};fill:#fff;font-size:${Math.min(fs * .8, bw * .45)}px">${fmtNum(v)}</text>`);
          }
          acc += v;
        });
      });
    }
    rows.forEach((r, i) => {
      if (horiz) g.push(`<text x="${padL - fs * .5}" y="${padT + band * (i + .5)}" text-anchor="end" dominant-baseline="central" style="${font}">${esc(r[0])}</text>`);
      else g.push(`<text x="${padL + band * (i + .5)}" y="${padT + ch + fs * 1.3}" text-anchor="middle" style="${font}">${esc(r[0])}</text>`);
    });
    g.push(`<line x1="${padL}" y1="${padT + ch}" x2="${padL + cw}" y2="${padT + ch}" stroke="${e.fg}" stroke-opacity=".4"/>`);
    if (legendH) {
      let x = padL;
      e.series.forEach((s, i) => { g.push(`<rect x="${x}" y="${fs * .3}" width="${fs * .8}" height="${fs * .8}" rx="${fs * .2}" fill="${col(i)}"/><text x="${x + fs * 1.2}" y="${fs * .7}" dominant-baseline="central" style="${font}">${esc(s)}</text>`); x += fs * 1.8 + measure(s, fs, e.font); });
    }
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="none"><defs>${defs.join('')}</defs>${g.join('')}</svg>`;
}
function niceStep(x) { const p = 10 ** Math.floor(Math.log10(x || 1)), m = x / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
const fmtNum = (v) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'jt' : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'rb' : String(Math.round(v * 100) / 100));
function measure(s, fs, font) { measureCtx.font = `${fs}px ${fontStack(font)}`; return measureCtx.measureText(s).width; }

// ---------- sanitising ----------
const OK_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'BR', 'DIV', 'P', 'SPAN', 'UL', 'OL', 'LI', 'A', 'FONT', 'SUP', 'SUB']);
const OK_CSS = ['color', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line', 'font-family', 'font-size', 'background-color'];
export function sanitizeHTML(html) {
  const t = document.createElement('template');
  t.innerHTML = html;
  const walk = (n) => {
    for (const c of [...n.childNodes]) {
      if (c.nodeType === 3) continue;
      if (c.nodeType !== 1 || !OK_TAGS.has(c.tagName)) { if (c.nodeType === 1 && !/^(SCRIPT|STYLE|IFRAME|OBJECT)$/.test(c.tagName)) { walk(c); c.replaceWith(...c.childNodes); } else c.remove(); continue; }
      const keep = {};
      if (c.tagName === 'A' && /^(https?:|mailto:|tel:)/i.test(c.getAttribute('href') || '')) keep.href = c.getAttribute('href');
      if (c.tagName === 'FONT' && c.getAttribute('color')) keep.color = c.getAttribute('color');
      const st = c.style, css = OK_CSS.map(p => st.getPropertyValue(p) ? `${p}:${st.getPropertyValue(p)}` : '').filter(Boolean).join(';');
      for (const a of [...c.attributes]) c.removeAttribute(a.name);
      if (keep.href) { c.setAttribute('href', keep.href); c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noopener'); }
      if (keep.color) c.setAttribute('color', keep.color);
      if (css) c.setAttribute('style', css);
      walk(c);
    }
  };
  walk(t.content);
  return t.innerHTML;
}

// ---------- element rendering ----------
function inner(e, opt) {
  switch (e.type) {
    case 'text': {
      if (e.curve && !opt.editingText) {
        const c = curvedText(e);
        return h('div.cv', { html: c.svg });
      }
      const tx = h('div.tx', { style: textStyle(e), html: e.list ? listHTML(e) : e.html });
      return tx;
    }
    case 'shape': {
      const defs = [], fill = svgPaint(e.fill, defs), sw = e.stroke?.w || 0;
      const d = shapePath(e.shape, Math.max(1, e.w - sw), Math.max(1, e.h - sw), e.radius || 0);
      const dash = e.stroke?.dash === 'dash' ? `stroke-dasharray="${sw * 3} ${sw * 2}"` : e.stroke?.dash === 'dot' ? `stroke-dasharray="0 ${sw * 2}" stroke-linecap="round"` : '';
      const svg = `<svg viewBox="0 0 ${e.w} ${e.h}" width="100%" height="100%" preserveAspectRatio="none" style="overflow:visible"><defs>${defs.join('')}</defs><path d="${d}" transform="translate(${sw / 2} ${sw / 2})" fill="${fill}" ${shapeEvenOdd(e.shape) ? 'fill-rule="evenodd"' : ''} ${sw ? `stroke="${e.stroke.c}" stroke-width="${sw}" ${dash} stroke-linejoin="round"` : ''}/></svg>`;
      const node = h('div.shp', { html: svg });
      if (e.text) node.append(h('div.tx.shp-tx', { style: textStyle({ ...e.text, fx: null }), html: e.text.html }));
      return node;
    }
    case 'line': {
      const w = e.w, hh = e.h, y = hh / 2, sw = e.weight, c = e.color;
      const cap = (kind, x, dir) => {
        const s = sw * 2.6 + 4;
        if (kind === 'arrow') return `<path d="M${x - dir * s} ${y - s * .7}L${x} ${y}L${x - dir * s} ${y + s * .7}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
        if (kind === 'tri') return `<path d="M${x - dir * s * 1.1} ${y - s * .6}L${x} ${y}L${x - dir * s * 1.1} ${y + s * .6}Z" fill="${c}"/>`;
        if (kind === 'circle') return `<circle cx="${x - dir * s * .4}" cy="${y}" r="${s * .45}" fill="${c}"/>`;
        if (kind === 'square') return `<rect x="${x - dir * s * .4 - s * .4}" y="${y - s * .4}" width="${s * .8}" height="${s * .8}" fill="${c}"/>`;
        if (kind === 'bar') return `<line x1="${x}" y1="${y - s * .7}" x2="${x}" y2="${y + s * .7}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"/>`;
        return '';
      };
      const inset = (k) => k === 'tri' ? sw * 2.6 : k === 'circle' || k === 'square' ? sw * 1.5 : 0;
      const dash = e.dash === 'dash' ? `stroke-dasharray="${sw * 3} ${sw * 2}"` : e.dash === 'dot' ? `stroke-dasharray="0.01 ${sw * 2}"` : '';
      const lc = e.dash === 'dot' || e.round ? 'round' : 'butt';
      const svg = `<svg viewBox="0 0 ${w} ${hh}" width="100%" height="100%" style="overflow:visible"><line x1="${sw / 2 + inset(e.start)}" y1="${y}" x2="${w - sw / 2 - inset(e.end)}" y2="${y}" stroke="${c}" stroke-width="${sw}" stroke-linecap="${lc}" ${dash}/>${cap(e.start, sw / 2, -1)}${cap(e.end, w - sw / 2, 1)}</svg>`;
      return h('div.ln', { html: svg });
    }
    case 'image': {
      const clip = h('div.clip');
      const cp = maskCSS(e.mask, e.w, e.h, e.radius);
      if (cp) clip.style.clipPath = cp;
      else if (e.radius) clip.style.borderRadius = e.radius + 'px';
      if (e.src) {
        const im = h('img', { alt: '', draggable: false, style: { left: e.ix * 100 + '%', top: e.iy * 100 + '%', width: e.iw * 100 + '%', height: e.ih * 100 + '%', filter: filterCSS(e.filter) } });
        setSrc(im, e.src, opt);
        clip.append(im, ...filterOverlays(e.filter));
      } else {
        clip.classList.add('ph');
        if (opt.mode === 'edit' || opt.mode === 'thumb') clip.append(h('span.ms', 'add_photo_alternate'));
      }
      if (e.stroke?.w) clip.append(h('i.ov.stk', { style: { boxShadow: `inset 0 0 0 ${e.stroke.w}px ${e.stroke.c}`, borderRadius: cp ? '' : (e.radius || 0) + 'px' } }));
      return clip;
    }
    case 'svg': {
      let s = e.svg || '';
      for (const [from, to] of Object.entries(e.colors || {})) s = s.split(from).join(to);
      const node = h('div.svg', { html: s });
      if (e.mono) node.style.color = e.mono;
      return node;
    }
    case 'qr': return h('div.svg', { html: e.svg || '' });
    case 'path': return h('div.svg', { html: `<svg viewBox="0 0 ${e.vw} ${e.vh}" width="100%" height="100%" preserveAspectRatio="none" style="overflow:visible"><path d="${e.d}" fill="none" stroke="${e.color}" stroke-width="${e.weight}" stroke-linecap="round" stroke-linejoin="round"/></svg>` });
    case 'chart': return h('div.svg', { html: chartSVG(e) });
    case 'table': {
      const tb = h('table.tbl', { style: { fontFamily: fontStack(e.font), fontSize: e.size + 'px', color: e.color, borderColor: e.border } });
      const cg = h('colgroup', e.cols.map(c => h('col', { style: { width: c * 100 + '%' } })));
      tb.append(cg);
      e.rows.forEach((r, i) => {
        const tr = h('tr');
        r.forEach((c, j) => tr.append(h('td', {
          dataset: { r: i, c: j }, html: c,
          style: { padding: e.pad + 'px', border: `${e.bw}px solid ${e.border}`, background: i === 0 && e.head ? e.head : (i % 2 === 0 && e.stripe ? e.stripe : e.cell), color: i === 0 && e.head ? e.headColor : e.color, fontWeight: i === 0 && e.head ? 700 : 400 },
        })));
        tb.append(tr);
      });
      return tb;
    }
  }
  return h('div');
}
function listHTML(e) {
  const tag = e.list === 'ol' ? 'ol' : 'ul';
  const lines = e.html.split(/<br\s*\/?>|<\/div>\s*<div>|<\/?div>/i).map(s => s.trim()).filter(Boolean);
  return `<${tag}>${lines.map(l => `<li>${l}</li>`).join('')}</${tag}>`;
}

function setSrc(im, src) {
  if (!isAsset(src)) im.crossOrigin = 'anonymous'; // before src, or the image loads twice
  const u = assetURLSync(src);
  if (u) { im.src = u; return; }
  assetURL(src).then(x => { if (x) im.src = x; });
}

export function renderEl(e, opt = {}) {
  const node = h('div.el.el-' + e.type, { dataset: { id: e.id } });
  const st = node.style;
  st.left = e.x + 'px'; st.top = e.y + 'px'; st.width = e.w + 'px';
  if (e.type === 'text' && !e.curve || e.type === 'table') st.height = 'auto';
  else st.height = e.h + 'px';
  if (e.type === 'text' && !e.curve && e.fx?.type === 'background') st.height = 'auto';
  const tf = [];
  if (e.rot) tf.push(`rotate(${e.rot}deg)`);
  if (tf.length) st.transform = tf.join(' ');
  if (e.op != null && e.op < 1) st.opacity = e.op;
  if (e.shadow && e.type !== 'text') st.filter = `drop-shadow(${e.shadow.x}px ${e.shadow.y}px ${e.shadow.blur}px ${rgba(e.shadow.color || '#000', (e.shadow.op ?? 40) / 100)})`;
  if (e.blend) st.mixBlendMode = e.blend === true ? 'multiply' : e.blend;
  if (e.type === 'text' && e.font) loadFont(e.font);
  const c = inner(e, opt);
  if (e.flipX || e.flipY) c.style.transform = `scale(${e.flipX ? -1 : 1}, ${e.flipY ? -1 : 1})`;
  node.append(c);
  if (opt.mode === 'present' && e.link) { node.style.cursor = 'pointer'; node.onclick = () => window.open(e.link, '_blank', 'noopener'); }
  return node;
}

export function renderBg(page) {
  const bg = h('div.bg', { style: { background: paintCSS(page.bg?.fill || '#ffffff') } });
  if (page.bg?.img) {
    const im = h('img', { alt: '', draggable: false, style: { filter: filterCSS(page.bg.img.filter) } });
    setSrc(im, page.bg.img.src, {});
    bg.append(im, ...filterOverlays(page.bg.img.filter));
  }
  return bg;
}

export function renderPage(page, design, opt = {}) {
  const st = h('div.stage', { style: { width: design.w + 'px', height: design.h + 'px' }, dataset: { page: page.id } });
  st.append(renderBg(page));
  for (const e of page.els) if (!e.hidden) st.append(renderEl(e, opt));
  return st;
}

// Scaled, non-interactive preview (template cards, project thumbnails, page strip).
export function thumb(page, design, maxW, maxH = maxW) {
  const s = Math.min(maxW / design.w, maxH / design.h);
  const box = h('div.thumb', { style: { width: design.w * s + 'px', height: design.h * s + 'px' } });
  const st = renderPage(page, design, { mode: 'thumb' });
  st.style.transform = `scale(${s})`;
  box.append(st);
  return box;
}

// Resolve once every image inside node has decoded.
export function whenImages(node) {
  return Promise.all([...node.querySelectorAll('img')].map(im => im.complete && im.naturalWidth ? null : new Promise(r => { im.onload = im.onerror = r; setTimeout(r, 8000); })));
}
