// Freehand drawing tool: pen, marker, highlighter and eraser. Strokes become path elements.
import { E } from './state.js';
import { Canvas } from './canvas.js';
import { h, icon, slider, drag } from '../util.js';
import { pathEl } from '../model.js';
import { colorPopover } from './color.js';

const TOOLS = [['pen', 'Pena', 'edit'], ['marker', 'Spidol', 'ink_marker'], ['glow', 'Pena neon', 'flare'], ['highlighter', 'Stabilo', 'ink_highlighter'], ['eraser', 'Penghapus', 'ink_eraser']];
const COLORS = ['#1d1d24', '#ffffff', '#ff3131', '#ff914d', '#ffde59', '#7ed957', '#0cc0df', '#5170ff', '#8c52ff', '#ff66c4'];
const st = { tool: 'pen', color: '#1d1d24', size: 8, op: 100 };

export function stopDraw() { E.tool = null; document.querySelector('.ws')?.classList.remove('drawing'); }

export function drawPanel(b) {
  const W = Math.max(E.d.w, E.d.h);
  if (!st.scaled) { st.size = Math.max(4, Math.round(W / 160)); st.scaled = true; }
  const render = () => {
    b.textContent = '';
    b.append(h('div.g5', TOOLS.map(([k, n, ic]) => h('button.tile' + (st.tool === k ? '.on' : ''), { type: 'button', dataset: { tip: n }, style: { aspectRatio: '1', boxShadow: st.tool === k ? 'inset 0 0 0 2px var(--accent)' : '' }, onclick: () => { st.tool = k; if (k === 'highlighter') st.op = 45; else if (st.op === 45) st.op = 100; render(); } }, icon(ic)))));
    if (st.tool !== 'eraser') {
      b.append(h('div.pn-sec', h('div.pn-sec-h', h('b', 'Warna')), h('div.swatches',
        h('button.swatch.add', { type: 'button', onclick: (e) => colorPopover(e.currentTarget, st.color, (c) => { st.color = c; }, { onDone: () => render() }) }),
        COLORS.map(c => h('button.swatch' + (st.color === c ? '.on' : ''), { type: 'button', style: { background: c }, onclick: () => { st.color = c; render(); } })))));
    }
    b.append(slider({ label: 'Ukuran', min: 1, max: Math.round(W / 15), value: st.size, oninput: (v) => (st.size = v) }));
    if (st.tool !== 'eraser') b.append(slider({ label: 'Transparansi', min: 5, max: 100, value: st.op, unit: '%', oninput: (v) => (st.op = v) }));
    b.append(h('p.small.muted', { style: { margin: 0 } }, 'Gambar langsung di halaman. Tekan Esc atau tutup panel untuk selesai.'));
  };
  render();
  E.clearSel();
  document.querySelector('.ws')?.classList.add('drawing');
  E.tool = { down };
}

function down(e, i, toDesign) {
  e.preventDefault();
  if (i !== E.pi) { E.pi = i; E.emit('page'); }
  if (st.tool === 'eraser') return erase(e, i);
  const pts = [toDesign(e.clientX, e.clientY, i)];
  const ovl = document.querySelectorAll('.pg .ovl')[i];
  const z = E.z;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const sw = st.tool === 'marker' ? st.size * 1.6 : st.tool === 'highlighter' ? st.size * 3 : st.size;
  path.setAttribute('fill', 'none'); path.setAttribute('stroke', st.color); path.setAttribute('stroke-width', sw * z);
  path.setAttribute('stroke-linecap', st.tool === 'highlighter' ? 'square' : 'round'); path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('opacity', st.op / 100);
  if (st.tool === 'glow') path.setAttribute('style', `filter:drop-shadow(0 0 ${sw * z}px ${st.color})`);
  svg.append(path); ovl.append(svg);
  drag(e, (dx, dy, ev) => {
    const p = toDesign(ev.clientX, ev.clientY, i), l = pts.at(-1);
    if (Math.hypot(p[0] - l[0], p[1] - l[1]) < 1.5 / z) return;
    pts.push(p);
    path.setAttribute('d', smooth(pts.map(([x, y]) => [x * z, y * z])));
  }, () => {
    svg.remove();
    if (pts.length < 2) pts.push([pts[0][0] + .5, pts[0][1] + .5]);
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const [x, y] of pts) { x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y); }
    const pad = sw / 2 + 1, bx = x1 - pad, by = y1 - pad, bw = Math.max(2, x2 - x1 + pad * 2), bh = Math.max(2, y2 - y1 + pad * 2);
    const el = pathEl({ x: bx, y: by, w: bw, h: bh, vw: bw, vh: bh, d: smooth(pts.map(([x, y]) => [x - bx, y - by])), color: st.color, weight: sw, op: st.op / 100, blend: st.tool === 'highlighter', name: 'Gambar' });
    if (st.tool === 'glow') el.shadow = { x: 0, y: 0, blur: sw * 1.5, color: st.color, op: 90 };
    E.page(i).els.push(el);
    Canvas.refreshEl(el.id);
    E.commit('draw');
  });
}
function smooth(p) {
  if (p.length < 3) return 'M' + p.map(q => q.map(v => v.toFixed(1)).join(' ')).join('L');
  let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
  for (let k = 1; k < p.length - 1; k++) {
    const mx = (p[k][0] + p[k + 1][0]) / 2, my = (p[k][1] + p[k + 1][1]) / 2;
    d += `Q${p[k][0].toFixed(1)} ${p[k][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const l = p.at(-1);
  return d + `L${l[0].toFixed(1)} ${l[1].toFixed(1)}`;
}
function erase(e, i) {
  const hit = (ev) => {
    const n = document.elementsFromPoint(ev.clientX, ev.clientY).find(x => x.closest?.('.el-path'))?.closest('.el-path');
    if (n) { const id = n.dataset.id; E.page(i).els = E.page(i).els.filter(x => x.id !== id); n.remove(); changed = true; }
  };
  let changed = false;
  hit(e);
  drag(e, (dx, dy, ev) => hit(ev), () => { if (changed) E.commit('erase'); });
}
