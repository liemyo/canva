// Magic resize: re-lay a design onto a new canvas size, in place or as a copy.
import { h, icon, dialog, toast, uid, clamp } from '../util.js';
import { SIZES } from '../model.js';
import { Store } from '../store.js';
import { E } from '../editor/state.js';
import { Canvas } from '../editor/canvas.js';
import { bbox } from '../model.js';

const UNIT = { px: 1, mm: 96 / 25.4, cm: 96 / 2.54, in: 96 };

// Elements keep their relative centre; sizes scale by the smaller axis ratio.
// Full-bleed elements (≥95% of a dimension) stretch to the new edges.
export function relayout(d, nw, nh) {
  const sx = nw / d.w, sy = nh / d.h, s = Math.min(sx, sy);
  for (const p of d.pages) {
    const groups = new Map();
    for (const e of p.els) { const k = e.gid || e.id; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); }
    for (const els of groups.values()) {
      const b = bbox(els);
      const fullW = b.w >= d.w * .95 && b.x <= d.w * .03, fullH = b.h >= d.h * .95 && b.y <= d.h * .03;
      const cx = (b.x + b.w / 2) * sx, cy = (b.y + b.h / 2) * sy;
      for (const e of els) {
        if (els.length === 1 && (fullW || fullH) && e.type !== 'text') {
          const ex = fullW ? sx : s, ey = fullH ? sy : s;
          if (e.type === 'image' && e.src) {
            // keep image covering the stretched frame
            const imgW = e.iw * e.w * Math.max(ex, ey), imgH = e.ih * e.h * Math.max(ex, ey);
            e.w *= ex; e.h *= ey; e.x = fullW ? e.x * sx : cx - e.w / 2; e.y = fullH ? e.y * sy : cy - e.h / 2;
            e.iw = imgW / e.w; e.ih = imgH / e.h; e.ix = (1 - e.iw) / 2; e.iy = (1 - e.ih) / 2;
          } else { e.x = fullW ? e.x * sx : cx - e.w * ex / 2; e.y = fullH ? e.y * sy : cy - e.h * ey / 2; e.w *= ex; e.h *= ey; }
          // bands hugging an edge stay on that edge
          if (fullW && !fullH) { if (b.y + b.h >= d.h * .97) e.y = nh - e.h; else if (b.y <= d.h * .03) e.y = 0; }
          if (fullH && !fullW) { if (b.x + b.w >= d.w * .97) e.x = nw - e.w; else if (b.x <= d.w * .03) e.x = 0; }
          continue;
        }
        const ox = (e.x - b.x) * s, oy = (e.y - b.y) * s;
        e.x = cx - b.w * s / 2 + ox; e.y = cy - b.h * s / 2 + oy;
        e.w *= s; e.h *= s;
        if (e.size) e.size *= s;
        if (e.type === 'line') e.weight *= s;
        if (e.radius) e.radius *= s;
        if (e.stroke?.w) e.stroke.w *= s;
        if (e.pad) e.pad *= s;
        if (e.shadow) { e.shadow.x *= s; e.shadow.y *= s; e.shadow.blur *= s; }
        // keep inside the page
        const bb = bbox([e]);
        if (bb.x + bb.w > nw && bb.w < nw) e.x -= bb.x + bb.w - nw;
        if (bb.y + bb.h > nh && bb.h < nh) e.y -= bb.y + bb.h - nh;
        if (bb.x < 0 && bb.w < nw) e.x -= bb.x;
        if (bb.y < 0 && bb.h < nh) e.y -= bb.y;
      }
    }
  }
  d.w = Math.round(nw); d.h = Math.round(nh);
  return d;
}

export function openResize() {
  let pick = null, unit = 'px', W = E.d.w, H = E.d.h, lock = false;
  const list = h('div', { style: { display: 'grid', gap: '2px', maxHeight: '300px', overflow: 'auto', margin: '0 -6px' } });
  const wIn = h('input.tx', { type: 'number', value: W, min: 1 }), hIn = h('input.tx', { type: 'number', value: H, min: 1 });
  const uSel = h('select.tx', { style: { width: '84px' } }, Object.keys(UNIT).map(u => h('option', { value: u }, u)));
  const conv = (px) => Math.round(px / UNIT[unit] * 100) / 100;
  const syncInputs = () => { wIn.value = conv(W); hIn.value = conv(H); };
  uSel.onchange = () => { unit = uSel.value; syncInputs(); };
  const ar = () => E.d.w / E.d.h;
  wIn.oninput = () => { W = clamp(+wIn.value * UNIT[unit], 16, 12000); if (lock) { H = W / ar(); hIn.value = conv(H); } pick = null; mark(); };
  hIn.oninput = () => { H = clamp(+hIn.value * UNIT[unit], 16, 12000); if (lock) { W = H * ar(); wIn.value = conv(W); } pick = null; mark(); };
  [wIn, hIn].forEach(i => i.addEventListener('keydown', e => e.stopPropagation()));
  const mark = () => list.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === pick));
  for (const [k, n, w, hh, , ic] of SIZES) {
    list.append(h('button.mi', { type: 'button', dataset: { k }, onclick: () => { pick = k; W = w; H = hh; syncInputs(); mark(); } }, icon(ic, 'sm'), h('span.ml', n, h('small', `${w} × ${hh} px`))));
  }
  const css = h('style', '.mi.on{background:var(--acc-soft)} .mi.on .ms{color:var(--acc-tx)}');
  const body = h('div', { style: { display: 'grid', gap: '14px' } }, css,
    h('div.row', h('label.fx', h('span.fx-l', 'Lebar'), wIn), h('label.fx', h('span.fx-l', 'Tinggi'), hIn), h('label.fx', { style: { flex: '0 0 auto' } }, h('span.fx-l', 'Satuan'), uSel)),
    h('label.sw', h('input', { type: 'checkbox', onchange: (e) => (lock = e.target.checked) }), h('i'), 'Kunci rasio'),
    h('b.small', 'Ukuran populer'), list);
  const apply = async (copy) => {
    W = Math.round(W); H = Math.round(H);
    if (W === E.d.w && H === E.d.h) { toast('Ukuran sama dengan sekarang'); return false; }
    E.emit('endEdit');
    if (copy) {
      const c = relayout(JSON.parse(JSON.stringify(E.d)), W, H);
      c.id = uid('d'); c.name = E.d.name + ` (${W}×${H})`; c.created = Date.now(); c.type = pick || 'custom';
      await Store.putDesign(c);
      toast('Salinan berukuran baru dibuat', { action: { label: 'Buka', run: () => (location.hash = '#/design/' + c.id) } });
      return;
    }
    relayout(E.d, W, H); E.d.type = pick || 'custom';
    Canvas.build(); Canvas.fit(); E.commit('resize');
    toast(`Ukuran diubah ke ${W} × ${H} px`, { icon: 'aspect_ratio' });
  };
  dialog({ title: 'Ubah ukuran ajaib', width: 480, body, actions: [{ label: 'Salin & ubah ukuran', run: () => apply(true) }, { label: 'Ubah ukuran', kind: 'btn-primary', run: () => apply(false) }] });
  syncInputs();
}
