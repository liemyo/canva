// QR codes (qrcode-generator) and barcodes (JsBarcode) rendered as SVG markup.
import { loadScript } from '../util.js';

const QR_LIB = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
const BC_LIB = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';

export async function qrSVG(data, { fg = '#111111', bg = '#ffffff', ecc = 'M', style = 'square' } = {}) {
  await loadScript(QR_LIB);
  const q = window.qrcode(0, ecc);
  q.addData(unescape(encodeURIComponent(data || ' ')));
  q.make();
  const n = q.getModuleCount(), m = 2, size = n + m * 2;
  const cells = [];
  const isFinder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!q.isDark(r, c) || (style !== 'square' && isFinder(r, c))) continue;
    const x = c + m, y = r + m;
    cells.push(style === 'dots' ? `<circle cx="${x + .5}" cy="${y + .5}" r=".42"/>` : style === 'rounded' ? `<rect x="${x + .06}" y="${y + .06}" width=".88" height=".88" rx=".32"/>` : `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`);
  }
  let finders = '';
  if (style !== 'square') {
    for (const [r, c] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
      const x = c + m, y = r + m, rx = style === 'dots' ? 2.2 : 1.6;
      finders += `<rect x="${x + .5}" y="${y + .5}" width="6" height="6" rx="${rx}" fill="none" stroke="${fg}" stroke-width="1"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="${rx * .5}" fill="${fg}"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%" shape-rendering="${style === 'square' ? 'crispEdges' : 'geometricPrecision'}">${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ''}<g fill="${fg}">${cells.join('')}</g>${finders}</svg>`;
}

export async function barcodeSVG(data, { format = 'CODE128', fg = '#111111', bg = '#ffffff', text = true } = {}) {
  await loadScript(BC_LIB);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  window.JsBarcode(svg, data, { format, lineColor: fg, background: bg || 'transparent', displayValue: text, margin: 10, fontOptions: 'bold', font: 'Inter, sans-serif', fontSize: 18 });
  const w = parseFloat(svg.getAttribute('width')), hh = parseFloat(svg.getAttribute('height'));
  svg.setAttribute('viewBox', `0 0 ${w} ${hh}`);
  svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
  svg.setAttribute('preserveAspectRatio', 'none');
  return { svg: new XMLSerializer().serializeToString(svg), w, h: hh };
}
