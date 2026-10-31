// Workspace: page rendering, selection overlay and all pointer interaction
// (move, resize, rotate, snap guides, marquee, text editing, image crop, drop).
import { E } from './state.js';
import { h, icon, ib, clamp, drag, menu, mod, uid, round } from '../util.js';
import { renderEl, renderPage, sanitizeHTML, plainText, curvedText } from '../render.js';
import { bbox, corners, rotPt, intersects, textEl, imageEl, newPage, clonePage } from '../model.js';
import { assetURLSync, assetURL, addAsset, fetchAsset } from '../assets.js';
import { maskCSS } from '../shapes.js';

const SNAP = 6;
let ws, inner, pages = [], spaceDown = false, hoverId = null;

export const Canvas = {
  mount(el) {
    ws = el;
    inner = h('div.ws-in');
    ws.append(inner);
    ws.addEventListener('pointerdown', onDown);
    ws.addEventListener('dblclick', onDbl);
    ws.addEventListener('pointermove', onHover);
    ws.addEventListener('pointerleave', () => { hoverId = null; drawOverlay(); });
    ws.addEventListener('contextmenu', onContext);
    ws.addEventListener('wheel', onWheel, { passive: false });
    ws.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].some(t => t === 'Files' || t === 'application/x-amatu')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    ws.addEventListener('drop', onDrop);
    ws.addEventListener('scroll', onScroll, { passive: true });
    addEventListener('keydown', (e) => { if (e.code === 'Space' && !isTyping(e)) { spaceDown = true; ws.classList.add('pan'); } });
    addEventListener('keyup', (e) => { if (e.code === 'Space') { spaceDown = false; ws.classList.remove('pan'); } });
    E.on('full', () => Canvas.build());
    E.on('el', (id) => Canvas.refreshEl(id));
    E.on('sel', drawOverlay);
    E.on('live', drawOverlay);
    E.on('change', () => { drawOverlay(); refreshHeads(); });
    E.on('page', () => { pages.forEach((p, i) => p.wrap.classList.toggle('cur', i === E.pi)); drawOverlay(); });
    E.on('endEdit', endEdit);
    E.on('endCrop', endCrop);
    document.fonts?.addEventListener?.('loadingdone', () => { remeasureAll(); drawOverlay(); });
    new ResizeObserver(() => drawOverlay()).observe(ws);
    Canvas.build();
  },

  build() {
    if (E.editing) { E.editing = null; }
    inner.textContent = '';
    pages = E.d.pages.map((p, i) => buildPage(i));
    inner.append(...pages.map(p => p.wrap));
    inner.append(h('button.add-page', { type: 'button', onclick: () => addPage(E.d.pages.length - 1) }, icon('add'), 'Tambah halaman'));
    applyZoom();
    remeasureAll();
    drawOverlay();
  },
  refreshPage(i) {
    const old = pages[i]; if (!old) return Canvas.build();
    const n = buildPage(i);
    old.wrap.replaceWith(n.wrap); pages[i] = n;
    applyZoom(); remeasureAll(); drawOverlay();
  },
  refreshBg(i = E.pi) {
    const p = pages[i]; if (!p) return;
    const nb = renderPage({ ...E.page(i), els: [] }, E.d).firstChild;
    p.stage.querySelector('.bg').replaceWith(nb);
  },
  refreshEl(id) {
    const i = E.pageOf(id), p = pages[i], e = E.get(id);
    if (!p || !e) return;
    const old = p.stage.querySelector(`.el[data-id="${id}"]`);
    if (E.editing === id && old) { patchGeom(old, e); applyEditStyle(old, e); return; }
    const n = renderEl(e, { mode: 'edit' });
    if (old) old.replaceWith(n); else p.stage.append(n);
    measure(e, n);
  },
  setZoom(z, anchor) {
    z = clamp(z, .05, 5);
    const r = ws.getBoundingClientRect();
    const ax = anchor ? anchor[0] - r.left : r.width / 2, ay = anchor ? anchor[1] - r.top : r.height / 2;
    const k = z / E.z, sx = (ws.scrollLeft + ax) * k - ax, sy = (ws.scrollTop + ay) * k - ay;
    E.z = z; applyZoom();
    ws.scrollLeft = sx; ws.scrollTop = sy;
    drawOverlay(); E.emit('zoom');
  },
  fit() {
    const r = ws.getBoundingClientRect();
    const z = Math.min((r.width - 96) / E.d.w, (r.height - 120) / E.d.h);
    E.z = clamp(z, .05, 4); applyZoom();
    pages[E.pi]?.wrap.scrollIntoView({ block: 'center', inline: 'center' });
    drawOverlay(); E.emit('zoom');
  },
  scrollToPage(i) { pages[i]?.wrap.scrollIntoView({ behavior: 'smooth', block: 'center' }); },
  stage(i = E.pi) { return pages[i]?.stage; },
  pageRect(i = E.pi) { return pages[i]?.pg.getBoundingClientRect(); },
  centerOfView() {
    const r = pages[E.pi]?.pg.getBoundingClientRect(), w = ws.getBoundingClientRect();
    if (!r) return [E.d.w / 2, E.d.h / 2];
    const cx = (clamp(w.left + w.width / 2, r.left, r.right) - r.left) / E.z, cy = (clamp(w.top + w.height / 2, r.top, r.bottom) - r.top) / E.z;
    return [clamp(cx, 0, E.d.w), clamp(cy, 0, E.d.h)];
  },
  startEdit, endEdit, startCrop, endCrop, drawOverlay, addPage,
  toDesign,
};

const isTyping = (e) => { const t = e.target; return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); };

// ---------- page building ----------
function buildPage(i) {
  const p = E.page(i);
  const stage = renderPage(p, E.d, { mode: 'edit' });
  const ovl = h('div.ovl');
  const pg = h('div.pg', { dataset: { i } }, stage, ovl);
  const title = h('input.pg-title', { value: p.title || '', placeholder: 'Tambahkan judul halaman', onchange: () => { E.page(i).title = title.value; E.commit('title'); } });
  const head = h('div.pg-head',
    h('span.pg-n', 'Halaman ' + (i + 1)), title,
    h('span.grow'),
    ib('keyboard_arrow_up', 'Pindah ke atas', () => movePage(i, -1), 'sm'),
    ib('keyboard_arrow_down', 'Pindah ke bawah', () => movePage(i, 1), 'sm'),
    ib('content_copy', 'Duplikat halaman', () => dupPage(i), 'sm'),
    ib('delete', 'Hapus halaman', () => delPage(i), 'sm'),
    ib('note_add', 'Tambah halaman', () => addPage(i), 'sm'));
  const wrap = h('div.pg-wrap' + (i === E.pi ? '.cur' : ''), { dataset: { i } }, head, pg);
  return { wrap, pg, stage, ovl, head };
}
function refreshHeads() {
  pages.forEach((p, i) => {
    const up = p.head.querySelector('[aria-label="Pindah ke atas"]'), dn = p.head.querySelector('[aria-label="Pindah ke bawah"]'), del = p.head.querySelector('[aria-label="Hapus halaman"]');
    up?.classList.toggle('dis', i === 0); dn?.classList.toggle('dis', i === E.d.pages.length - 1); del?.classList.toggle('dis', E.d.pages.length === 1);
  });
}
function applyZoom() {
  for (const p of pages) {
    p.pg.style.width = E.d.w * E.z + 'px';
    p.pg.style.height = E.d.h * E.z + 'px';
    p.stage.style.transform = `scale(${E.z})`;
    p.head.style.width = Math.max(E.d.w * E.z, 320) + 'px';
  }
  refreshHeads();
}
export function addPage(after = E.pi, pg) {
  E.d.pages.splice(after + 1, 0, pg || newPage(typeof E.page(after)?.bg?.fill === 'string' ? '#ffffff' : '#ffffff'));
  E.pi = after + 1; E.sel = [];
  Canvas.build(); E.commit('page'); E.emit('page'); E.emit('sel');
  setTimeout(() => Canvas.scrollToPage(E.pi), 30);
}
function dupPage(i) { addPage(i, clonePage(E.page(i))); }
function delPage(i) {
  if (E.d.pages.length < 2) return;
  E.d.pages.splice(i, 1);
  E.pi = Math.min(E.pi, E.d.pages.length - 1); E.sel = [];
  Canvas.build(); E.commit('page'); E.emit('page'); E.emit('sel');
}
function movePage(i, d) {
  const j = i + d; if (j < 0 || j >= E.d.pages.length) return;
  const [p] = E.d.pages.splice(i, 1); E.d.pages.splice(j, 0, p);
  E.pi = j; Canvas.build(); E.commit('page'); E.emit('page');
  setTimeout(() => Canvas.scrollToPage(j), 30);
}

// ---------- text measuring ----------
function measure(e, node) {
  if (e.type === 'text') {
    if (e.curve) {
      const c = curvedText(e);
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      if (Math.abs(c.w - e.w) > .5 || Math.abs(c.h - e.h) > .5) { e.w = c.w; e.h = c.h; e.x = cx - c.w / 2; e.y = cy - c.h / 2; patchGeom(node, e); }
    } else {
      const hh = node.offsetHeight;
      if (hh && Math.abs(hh - e.h) > .5) e.h = hh;
    }
  } else if (e.type === 'table') {
    const hh = node.offsetHeight; if (hh) e.h = hh;
  }
}
function remeasureAll() {
  pages.forEach((p, i) => E.els(i).forEach(e => {
    if (e.type !== 'text' && e.type !== 'table') return;
    const n = p.stage.querySelector(`.el[data-id="${e.id}"]`);
    if (n) measure(e, n);
  }));
}
function patchGeom(n, e) {
  n.style.left = e.x + 'px'; n.style.top = e.y + 'px'; n.style.width = e.w + 'px';
  if (!(e.type === 'text' && !e.curve) && e.type !== 'table') n.style.height = e.h + 'px';
  n.style.transform = e.rot ? `rotate(${e.rot}deg)` : '';
}
// Fast path while dragging: only geometry changes, no re-render.
function patchLive(e) {
  const p = pages[E.pageOf(e.id)]; if (!p) return;
  const n = p.stage.querySelector(`.el[data-id="${e.id}"]`); if (!n) return;
  if (e.type === 'image') {
    patchGeom(n, e);
    const clip = n.querySelector('.clip'), im = clip?.querySelector('img');
    if (clip) { const cp = maskCSS(e.mask, e.w, e.h, e.radius); clip.style.clipPath = cp || ''; }
    if (im) Object.assign(im.style, { left: e.ix * 100 + '%', top: e.iy * 100 + '%', width: e.iw * 100 + '%', height: e.ih * 100 + '%' });
  } else if (e.type === 'text' && !e.curve) {
    patchGeom(n, e);
    const tx = n.querySelector('.tx'); if (tx) tx.style.fontSize = e.size + 'px';
    measure(e, n);
  } else Canvas.refreshEl(e.id);
}

// ---------- coordinates ----------
function toDesign(cx, cy, i = E.pi) {
  const r = pages[i].pg.getBoundingClientRect();
  return [(cx - r.left) / E.z, (cy - r.top) / E.z];
}
function pageAt(cx, cy) {
  for (let i = 0; i < pages.length; i++) {
    const r = pages[i].pg.getBoundingClientRect();
    if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) return i;
  }
  return -1;
}

// ---------- overlay ----------
const HANDLES = { nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0] };
function handlesFor(els) {
  if (els.length > 1) return ['nw', 'ne', 'se', 'sw'];
  const e = els[0];
  if (e.lock) return [];
  if (e.type === 'line') return [];
  if (e.type === 'text') return e.curve ? ['nw', 'ne', 'se', 'sw'] : ['nw', 'ne', 'se', 'sw', 'e', 'w'];
  if (e.type === 'table') return ['nw', 'ne', 'se', 'sw', 'e', 'w'];
  if (e.type === 'svg' || e.type === 'qr') return ['nw', 'ne', 'se', 'sw'];
  return Object.keys(HANDLES);
}

let guides = [], marquee = null, dimLabel = null;
export function drawOverlay() {
  if (!pages.length) return;
  pages.forEach((p, i) => { if (i !== E.pi) p.ovl.textContent = ''; });
  const p = pages[E.pi]; if (!p) return;
  const o = p.ovl, z = E.z;
  o.textContent = '';
  const els = E.selEls().filter(e => E.pageOf(e.id) === E.pi);
  // hover outline
  if (hoverId && !E.sel.includes(hoverId)) {
    const he = E.get(hoverId);
    if (he && E.pageOf(he.id) === E.pi) o.append(outline(he, 'hov'));
  }
  if (els.length) {
    const multi = els.length > 1;
    if (multi) els.forEach(e => o.append(outline(e, 'sub')));
    const g = multi ? { ...bbox(els), rot: 0 } : els[0];
    const box = h('div.sbox' + (E.editing ? '.editing' : '') + (els.some(e => e.lock) ? '.locked' : ''), {
      style: { left: g.x * z + 'px', top: g.y * z + 'px', width: g.w * z + 'px', height: g.h * z + 'px', transform: g.rot ? `rotate(${g.rot}deg)` : '' },
    });
    if (!E.editing && !E.crop) {
      const hs = handlesFor(els);
      for (const k of hs) {
        const [u, v] = HANDLES[k];
        box.append(h('i.hd.hd-' + (u && v ? 'c' : (u ? 'v' : 'h')), { dataset: { h: k }, style: { left: (u + 1) * 50 + '%', top: (v + 1) * 50 + '%' } }));
      }
      if (!els.some(e => e.lock)) {
        if (!multi && els[0].type === 'line') {
          box.append(h('i.hd.hd-c.hd-end', { dataset: { h: 'l1' }, style: { left: '0%', top: '50%' } }), h('i.hd.hd-c.hd-end', { dataset: { h: 'l2' }, style: { left: '100%', top: '50%' } }));
        }
        box.append(h('button.rot-h', { type: 'button', dataset: { h: 'rot', tip: 'Putar' }, 'aria-label': 'Putar' }, icon('refresh', 'xs')));
      }
    }
    if (E.crop && !multi) cropGhost(box, els[0]);
    o.append(box);
    if (!E.editing && !E.crop) o.append(selBar(els));
    if (E.crop) o.append(cropBar());
  }
  guides.forEach(gd => o.append(h('i.guide.' + gd.axis, { style: gd.axis === 'v' ? { left: gd.v * z + 'px', top: gd.a * z + 'px', height: (gd.b - gd.a) * z + 'px' } : { top: gd.v * z + 'px', left: gd.a * z + 'px', width: (gd.b - gd.a) * z + 'px' } })));
  if (marquee) o.append(h('i.marq', { style: { left: marquee.x * z + 'px', top: marquee.y * z + 'px', width: marquee.w * z + 'px', height: marquee.h * z + 'px' } }));
  if (dimLabel) o.append(h('span.dim', { style: { left: dimLabel.x * z + 'px', top: dimLabel.y * z + 'px' } }, dimLabel.t));
}
function outline(e, cls) {
  return h('i.outl.' + cls, { style: { left: e.x * E.z + 'px', top: e.y * E.z + 'px', width: e.w * E.z + 'px', height: e.h * E.z + 'px', transform: e.rot ? `rotate(${e.rot}deg)` : '' } });
}
function selBar(els) {
  const b = bbox(els), z = E.z;
  const locked = els.every(e => e.lock);
  const bar = h('div.selbar.glass-strong', { style: { left: (b.x + b.w / 2) * z + 'px', top: b.y * z + 'px' } },
    ib(locked ? 'lock' : 'lock_open', locked ? 'Buka kunci' : 'Kunci', () => E.toggleLock(), 'sm'),
    locked ? null : ib('content_copy', 'Duplikat', () => E.duplicate(), 'sm'),
    locked ? null : ib('delete', 'Hapus', () => E.remove(), 'sm'),
    ib('more_horiz', 'Lainnya', (ev) => contextMenu(ev.currentTarget), 'sm'));
  bar.addEventListener('pointerdown', (e) => e.stopPropagation());
  // Keep it on screen: flip below when the selection touches the top of the page view.
  requestAnimationFrame(() => {
    const r = bar.getBoundingClientRect(), wr = ws.getBoundingClientRect();
    if (r.top < wr.top + 4) { bar.style.top = (b.y + b.h) * z + 'px'; bar.classList.add('below'); }
  });
  return bar;
}

// ---------- hit testing & pointer ----------
function elAt(target) {
  const n = target.closest?.('.stage .el');
  return n ? n.dataset.id : null;
}
function onHover(e) {
  if (e.buttons) return;
  const id = elAt(e.target);
  if (id !== hoverId) { hoverId = id; drawOverlay(); }
}

function onDown(e) {
  if (e.button === 2) return;
  if (e.target.closest('.pg-head, .add-page, .selbar, .cropbar')) return;
  if (e.button === 1 || spaceDown) { e.preventDefault(); return pan(e); }
  const pgEl = e.target.closest('.pg');
  const i = pgEl ? +pgEl.dataset.i : pageAt(e.clientX, e.clientY);
  if (E.tool && i >= 0) { E.tool.down(e, i, toDesign); return; }
  const hd = e.target.closest('[data-h]');
  if (hd) { e.preventDefault(); return startHandle(e, hd.dataset.h); }
  if (E.crop) {
    const ce = E.get(E.crop);
    if (e.target.closest('.ghost') || elAt(e.target) === E.crop) { e.preventDefault(); return cropPan(e, ce); }
    endCrop();
  }
  const id = elAt(e.target);
  if (E.editing) {
    if (id === E.editing) return; // let the caret move
    endEdit();
  }
  if (i >= 0 && i !== E.pi) { E.pi = i; E.emit('page'); }
  if (id) {
    const el = E.get(id);
    if (e.shiftKey) {
      const ids = new Set(E.sel), grp = el.gid ? E.els().filter(x => x.gid === el.gid).map(x => x.id) : [id];
      if (ids.has(id)) grp.forEach(x => ids.delete(x)); else grp.forEach(x => ids.add(x));
      E.select([...ids], { raw: true });
      return;
    }
    const was = E.sel.includes(id) && E.sel.length === 1;
    const inGroupSel = E.sel.includes(id);
    if (!inGroupSel) E.select(id);
    e.preventDefault();
    startMove(e, was && el.type === 'text' && !el.lock);
    return;
  }
  // empty page area or workspace
  if (!e.shiftKey) E.clearSel();
  if (e.pointerType === 'touch') return; // let the finger scroll the workspace
  if (i >= 0 || e.target === ws || e.target.closest('.ws-in')) startMarquee(e, i >= 0 ? i : E.pi);
}

function onDbl(e) {
  const id = elAt(e.target); if (!id) return;
  const el = E.get(id); if (!el || el.lock) return;
  if (el.gid && E.sel.length > 1) { E.select(id, { raw: true }); return; }
  if (el.type === 'text') startEdit(id, e);
  else if (el.type === 'image' && el.src) startCrop(id);
  else if (el.type === 'table') startEdit(id, e);
  else if (el.type === 'shape') { E.emit('shapeText', id); }
}

function pan(e) {
  const sl = ws.scrollLeft, st = ws.scrollTop;
  ws.classList.add('panning');
  drag(e, (dx, dy) => { ws.scrollLeft = sl - dx; ws.scrollTop = st - dy; }, () => ws.classList.remove('panning'));
}

function onWheel(e) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    Canvas.setZoom(E.z * Math.exp(-e.deltaY * .0022), [e.clientX, e.clientY]);
  }
}
function onScroll() {
  if (E.sel.length || E.editing) return;
  const wr = ws.getBoundingClientRect(), mid = wr.top + wr.height / 2;
  let best = E.pi, bd = Infinity;
  pages.forEach((p, i) => { const r = p.pg.getBoundingClientRect(), d = Math.abs((r.top + r.bottom) / 2 - mid); if (d < bd) { bd = d; best = i; } });
  if (best !== E.pi) { E.pi = best; E.emit('page'); }
}

// ---------- snapping ----------
function snapTargets(exclude) {
  const W = E.d.w, H = E.d.h, xs = [[0, 0, H], [W / 2, 0, H], [W, 0, H]], ys = [[0, 0, W], [H / 2, 0, W], [H, 0, W]];
  for (const o of E.els()) {
    if (exclude.has(o.id) || o.hidden) continue;
    const b = bbox([o]);
    xs.push([b.x, b.y, b.y + b.h], [b.x + b.w / 2, b.y, b.y + b.h], [b.x + b.w, b.y, b.y + b.h]);
    ys.push([b.y, b.x, b.x + b.w], [b.y + b.h / 2, b.x, b.x + b.w], [b.y + b.h, b.x, b.x + b.w]);
  }
  return { xs, ys };
}
function snapBox(b, T, thr) {
  let dx = 0, dy = 0, bx = thr + 1, by = thr + 1, gx = null, gy = null;
  for (const v of [b.x, b.x + b.w / 2, b.x + b.w]) for (const t of T.xs) { const d = t[0] - v; if (Math.abs(d) < Math.abs(bx) && Math.abs(d) <= thr) { bx = d; dx = d; gx = t; } }
  for (const v of [b.y, b.y + b.h / 2, b.y + b.h]) for (const t of T.ys) { const d = t[0] - v; if (Math.abs(d) < Math.abs(by) && Math.abs(d) <= thr) { by = d; dy = d; gy = t; } }
  const g = [];
  if (gx) g.push({ axis: 'v', v: gx[0], a: Math.min(gx[1], b.y + dy), b: Math.max(gx[2], b.y + dy + b.h) });
  if (gy) g.push({ axis: 'h', v: gy[0], a: Math.min(gy[1], b.x + dx), b: Math.max(gy[2], b.x + dx + b.w) });
  return { dx, dy, g };
}

// ---------- move ----------
function startMove(e, editOnClick) {
  const els = E.selEls().filter(x => !x.lock);
  const ids = new Set(E.sel);
  const st = els.map(x => [x.x, x.y]);
  const b0 = bbox(els), T = snapTargets(ids);
  let dupDone = false;
  drag(e, (dx, dy, ev) => {
    if (!els.length) return;
    if (ev.altKey && !dupDone) { dupDone = true; dupForAltDrag(els); }
    let ddx = dx / E.z, ddy = dy / E.z;
    guides = [];
    if (!mod(ev)) {
      const s = snapBox({ ...b0, x: b0.x + ddx, y: b0.y + ddy }, T, SNAP / E.z);
      ddx += s.dx; ddy += s.dy; guides = s.g;
    }
    if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) ddy = 0; else ddx = 0; }
    els.forEach((x, k) => { x.x = st[k][0] + ddx; x.y = st[k][1] + ddy; patchLive(x); });
    dimLabel = null;
    drawOverlay();
    E.emit('moving');
  }, (ev, moved) => {
    guides = [];
    if (moved) E.commit('move');
    else if (editOnClick) startEdit(E.sel[0], ev);
    drawOverlay();
  }, { threshold: 3 });
}
function dupForAltDrag(els) {
  // Alt-drag leaves a copy behind at the original position.
  const arr = E.els();
  for (const x of els) {
    const c = JSON.parse(JSON.stringify(x)); c.id = uid('e');
    arr.splice(arr.indexOf(x), 0, c);
    pages[E.pi].stage.querySelector(`.el[data-id="${x.id}"]`)?.before(renderEl(c, { mode: 'edit' }));
  }
}

// ---------- marquee ----------
function startMarquee(e, i) {
  if (i < 0 || !pages[i]) return;
  if (i !== E.pi) { E.pi = i; E.emit('page'); }
  const [sx, sy] = toDesign(e.clientX, e.clientY, i);
  const base = e.shiftKey ? [...E.sel] : [];
  drag(e, (dx, dy) => {
    const [cx, cy] = [sx + dx / E.z, sy + dy / E.z];
    marquee = { x: Math.min(sx, cx), y: Math.min(sy, cy), w: Math.abs(cx - sx), h: Math.abs(cy - sy) };
    const hit = E.els(i).filter(x => !x.lock && !x.hidden && intersects(bbox([x]), marquee)).map(x => x.id);
    E.select([...new Set([...base, ...hit])]);
  }, () => { marquee = null; drawOverlay(); }, { threshold: 3 });
}

// ---------- resize / rotate ----------
function startHandle(e, k) {
  const els = E.selEls().filter(x => !x.lock);
  if (!els.length) return;
  if (k === 'rot') return startRotate(e, els);
  if (k === 'l1' || k === 'l2') return startLineEnd(e, els[0], k);
  if (k.startsWith('c')) return startCropScale(e, els[0], k.slice(1));
  if (els.length > 1) return startGroupScale(e, els, k);
  const el = els[0], o = JSON.parse(JSON.stringify(el));
  const [u, v] = HANDLES[k], th = (o.rot || 0) * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th);
  const c0 = [o.x + o.w / 2, o.y + o.h / 2];
  const corner = u && v;
  const keepAspect = corner && !(el.type === 'shape' && false);
  const T = snapTargets(new Set([el.id]));
  drag(e, (dx, dy, ev) => {
    const P = toDesign(ev.clientX, ev.clientY);
    // pointer in the element's local (unrotated) frame, relative to its original centre
    const px = P[0] - c0[0], py = P[1] - c0[1];
    let lx = px * cs + py * sn, ly = -px * sn + py * cs;
    let L = -o.w / 2, R = o.w / 2, Tp = -o.h / 2, B = o.h / 2;
    if (!o.rot && !mod(ev)) {
      // snap the moving edge(s) to guides when unrotated
      const gx = u ? snapVal(c0[0] + lx, T.xs, SNAP / E.z) : null, gy = v ? snapVal(c0[1] + ly, T.ys, SNAP / E.z) : null;
      guides = [];
      if (gx && !corner) { lx = gx.v - c0[0]; guides.push({ axis: 'v', v: gx.v, a: 0, b: E.d.h }); }
      if (gy && !corner) { ly = gy.v - c0[1]; guides.push({ axis: 'h', v: gy.v, a: 0, b: E.d.w }); }
    }
    const min = 8;
    if (keepAspect) {
      const ax = -u * o.w / 2, ay = -v * o.h / 2, hx = u * o.w / 2 - ax, hy = v * o.h / 2 - ay;
      let s = ((lx - ax) * hx + (ly - ay) * hy) / (hx * hx + hy * hy);
      s = Math.max(s, min / Math.min(o.w, o.h));
      const nw = o.w * s, nh = o.h * s;
      if (u > 0) R = L + nw; else L = R - nw;
      if (v > 0) B = Tp + nh; else Tp = B - nh;
      applyScale(el, o, s);
    } else {
      if (u > 0) R = Math.max(L + min, lx); if (u < 0) L = Math.min(R - min, lx);
      if (v > 0) B = Math.max(Tp + min, ly); if (v < 0) Tp = Math.min(B - min, ly);
      if (el.type === 'image' && !corner) cropSide(el, o, L, R, Tp, B);
    }
    const nw = R - L, nh = B - Tp, mx = (L + R) / 2, my = (Tp + B) / 2;
    const cx = c0[0] + mx * cs - my * sn, cy = c0[1] + mx * sn + my * cs;
    el.w = nw; if (!(el.type === 'text' && !el.curve)) el.h = nh;
    el.x = cx - nw / 2; el.y = cy - el.h / 2;
    if (el.type === 'text' && !el.curve) {
      // keep the anchored edge fixed while height follows the text
      patchLive(el);
      const ay = v < 0 ? c0[1] + o.h / 2 : (v > 0 ? c0[1] - o.h / 2 : null);
      if (!o.rot && corner) el.y = v > 0 ? o.y : (o.y + o.h) - el.h;
      else if (!o.rot) el.y = o.y;
      void ay;
      patchGeom(pages[E.pi].stage.querySelector(`.el[data-id="${el.id}"]`), el);
    } else patchLive(el);
    dimLabel = { x: el.x + el.w / 2, y: el.y + el.h, t: `${Math.round(el.w)} × ${Math.round(el.h)}` };
    drawOverlay();
  }, () => { guides = []; dimLabel = null; E.commit('resize'); Canvas.refreshEl(el.id); drawOverlay(); });
}
function snapVal(v, list, thr) { let best = null; for (const t of list) { const d = Math.abs(t[0] - v); if (d <= thr && (!best || d < best.d)) best = { v: t[0], d }; } return best; }
function applyScale(el, o, s) {
  if (el.type === 'text') { el.size = Math.max(1, round(o.size * s, 1)); if (o.fx) el.fx = { ...o.fx }; }
  if (el.type === 'table') { el.size = Math.max(4, round(o.size * s, 1)); el.pad = o.pad * s; }
  if (el.type === 'shape' && el.text) el.text.size = o.text.size * s;
}
// Side handles on an image crop the frame while the picture stays put on the page.
function cropSide(el, o, L, R, Tp, B) {
  const imgW = o.iw * o.w, imgH = o.ih * o.h, imgL = -o.w / 2 + o.ix * o.w, imgT = -o.h / 2 + o.iy * o.h;
  L = Math.max(L, imgL); R = Math.min(R, imgL + imgW); Tp = Math.max(Tp, imgT); B = Math.min(B, imgT + imgH);
  const nw = R - L, nh = B - Tp;
  el.iw = imgW / nw; el.ih = imgH / nh; el.ix = (imgL - L) / nw; el.iy = (imgT - Tp) / nh;
  return [L, R, Tp, B];
}
function startGroupScale(e, els, k) {
  const os = els.map(x => JSON.parse(JSON.stringify(x))), b = bbox(els);
  const [u, v] = HANDLES[k], ax = b.x + (u < 0 ? b.w : 0), ay = b.y + (v < 0 ? b.h : 0);
  drag(e, (dx, dy, ev) => {
    const P = toDesign(ev.clientX, ev.clientY);
    const s = Math.max(.05, Math.max((P[0] - ax) * u / b.w, (P[1] - ay) * v / b.h));
    els.forEach((x, i) => {
      const o = os[i];
      x.x = ax + (o.x - ax) * s; x.y = ay + (o.y - ay) * s; x.w = o.w * s; x.h = o.h * s;
      applyScale(x, o, s);
      if (x.type === 'line') x.weight = o.weight * s;
      patchLive(x);
    });
    dimLabel = { x: b.x + b.w * s / 2, y: b.y + b.h * s, t: `${Math.round(b.w * s)} × ${Math.round(b.h * s)}` };
    drawOverlay();
  }, () => { dimLabel = null; E.commit('resize'); els.forEach(x => Canvas.refreshEl(x.id)); drawOverlay(); });
}
function startRotate(e, els) {
  const b = bbox(els), c = [b.x + b.w / 2, b.y + b.h / 2];
  const os = els.map(x => ({ x: x.x, y: x.y, w: x.w, h: x.h, rot: x.rot || 0 }));
  const P0 = toDesign(e.clientX, e.clientY), a0 = Math.atan2(P0[1] - c[1], P0[0] - c[0]);
  const single = els.length === 1;
  drag(e, (dx, dy, ev) => {
    const P = toDesign(ev.clientX, ev.clientY);
    let da = (Math.atan2(P[1] - c[1], P[0] - c[0]) - a0) * 180 / Math.PI;
    let target = (single ? os[0].rot : 0) + da;
    if (ev.shiftKey) target = Math.round(target / 15) * 15;
    else { const m = Math.round(target / 45) * 45; if (Math.abs(m - target) < 3) target = m; }
    da = target - (single ? os[0].rot : 0);
    els.forEach((x, i) => {
      const o = os[i], oc = [o.x + o.w / 2, o.y + o.h / 2], [nx, ny] = rotPt(oc[0], oc[1], c[0], c[1], da);
      x.rot = ((o.rot + da) % 360 + 360) % 360; if (x.rot > 180) x.rot -= 360;
      x.rot = round(x.rot, 1);
      x.x = nx - o.w / 2; x.y = ny - o.h / 2;
      patchGeom(pages[E.pi].stage.querySelector(`.el[data-id="${x.id}"]`), x);
    });
    dimLabel = { x: c[0], y: b.y + b.h + 30 / E.z, t: `${Math.round(single ? els[0].rot : da)}°` };
    drawOverlay();
  }, () => { dimLabel = null; E.commit('rotate'); drawOverlay(); });
}
function startLineEnd(e, el, k) {
  const ends = () => { const c = [el.x + el.w / 2, el.y + el.h / 2]; return [rotPt(el.x, c[1], c[0], c[1], el.rot || 0), rotPt(el.x + el.w, c[1], c[0], c[1], el.rot || 0)]; };
  const [p1, p2] = ends(), fixed = k === 'l1' ? p2 : p1;
  drag(e, (dx, dy, ev) => {
    let P = toDesign(ev.clientX, ev.clientY);
    let ang = Math.atan2(P[1] - fixed[1], P[0] - fixed[0]) * 180 / Math.PI;
    let len = Math.max(8, Math.hypot(P[0] - fixed[0], P[1] - fixed[1]));
    const sn = Math.round(ang / 15) * 15;
    if (ev.shiftKey || Math.abs(sn - ang) < 2) ang = sn;
    const r = ang * Math.PI / 180, q = [fixed[0] + Math.cos(r) * len, fixed[1] + Math.sin(r) * len];
    const a = k === 'l1' ? q : fixed, b = k === 'l1' ? fixed : q;
    const rot = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI, cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
    el.w = len; el.rot = round(rot, 2); el.x = cx - len / 2; el.y = cy - el.h / 2;
    Canvas.refreshEl(el.id);
    dimLabel = { x: cx, y: cy + 24 / E.z, t: `${Math.round(len)} px · ${Math.round(ang)}°` };
    drawOverlay();
  }, () => { dimLabel = null; E.commit('line'); drawOverlay(); });
}

// ---------- text editing ----------
function applyEditStyle(n, e) {
  const tx = n.querySelector('.tx'); if (!tx) return;
  const keep = tx.innerHTML;
  const fresh = renderEl(e, { mode: 'edit', editingText: true }).querySelector('.tx');
  tx.style.cssText = fresh.style.cssText;
  if (tx.innerHTML !== keep) tx.innerHTML = keep;
}
export function startEdit(id, ev) {
  const e = E.get(id); if (!e || e.lock) return;
  if (E.editing === id) return;
  if (E.editing) endEdit();
  const i = E.pageOf(id);
  if (!E.sel.includes(id) || E.sel.length > 1) E.select(id, { raw: true });
  E.editing = id;
  if (e.type === 'table') return editTable(e, i, ev);
  let n = pages[i].stage.querySelector(`.el[data-id="${id}"]`);
  if (e.curve) { const nn = renderEl(e, { mode: 'edit', editingText: true }); n.replaceWith(nn); n = nn; n.style.height = 'auto'; }
  const tx = n.querySelector('.tx');
  if (e.list) tx.innerHTML = e.html;
  n.classList.add('editing');
  tx.contentEditable = 'true';
  tx.spellcheck = false;
  tx.focus({ preventScroll: true });
  const sel = getSelection(), r = document.createRange();
  if (ev?.clientX != null && document.caretRangeFromPoint) {
    const cr = document.caretRangeFromPoint(ev.clientX, ev.clientY);
    if (cr && tx.contains(cr.startContainer)) { sel.removeAllRanges(); sel.addRange(cr); }
    else { r.selectNodeContents(tx); sel.removeAllRanges(); sel.addRange(r); }
  } else { r.selectNodeContents(tx); sel.removeAllRanges(); sel.addRange(r); }
  tx.oninput = () => { if (!e.curve) { e.h = n.offsetHeight; } drawOverlay(); E.emit('typing'); };
  tx.onkeydown = (k) => {
    if (k.key === 'Escape') { k.preventDefault(); endEdit(); }
    k.stopPropagation();
    if (mod(k) && ['b', 'i', 'u'].includes(k.key.toLowerCase())) {
      k.preventDefault(); document.execCommand({ b: 'bold', i: 'italic', u: 'underline' }[k.key.toLowerCase()]);
    }
  };
  tx.onpaste = (p) => {
    p.preventDefault();
    const text = p.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };
  drawOverlay(); E.emit('sel');
}
function endEdit() {
  const id = E.editing; if (!id) return;
  E.editing = null;
  const e = E.get(id); const i = E.pageOf(id);
  if (!e || i < 0) { drawOverlay(); return; }
  const n = pages[i]?.stage.querySelector(`.el[data-id="${id}"]`);
  if (e.type === 'table') {
    n?.querySelectorAll('td').forEach(td => { td.contentEditable = 'false'; e.rows[+td.dataset.r][+td.dataset.c] = sanitizeHTML(td.innerHTML); });
    Canvas.refreshEl(id); E.commit('table'); drawOverlay(); return;
  }
  const tx = n?.querySelector('.tx');
  if (tx) {
    tx.contentEditable = 'false';
    let html = sanitizeHTML(tx.innerHTML);
    if (e.list) { const t = document.createElement('div'); t.innerHTML = html; const lis = [...t.querySelectorAll('li')]; if (lis.length) html = lis.map(li => li.innerHTML).join('<br>'); }
    if (!plainText(html)) { E.remove([id]); getSelection().removeAllRanges(); return; }
    e.html = html;
  }
  getSelection().removeAllRanges();
  Canvas.refreshEl(id);
  E.commit('text');
  drawOverlay(); E.emit('sel');
}
function editTable(e, i, ev) {
  const n = pages[i].stage.querySelector(`.el[data-id="${e.id}"]`);
  n.classList.add('editing');
  const tds = [...n.querySelectorAll('td')];
  tds.forEach(td => { td.contentEditable = 'true'; td.onkeydown = (k) => { k.stopPropagation(); if (k.key === 'Escape') endEdit(); if (k.key === 'Tab') { k.preventDefault(); const j = tds.indexOf(td) + (k.shiftKey ? -1 : 1); tds[(j + tds.length) % tds.length].focus(); } }; td.oninput = () => { e.h = n.offsetHeight; drawOverlay(); }; });
  const hit = ev?.target?.closest?.('td');
  (hit && n.contains(hit) ? hit : tds[0])?.focus();
  drawOverlay(); E.emit('sel');
}

// ---------- image crop ----------
export function startCrop(id) {
  const e = E.get(id); if (!e || e.type !== 'image' || !e.src) return;
  E.select(id, { raw: true });
  E.crop = id; drawOverlay(); E.emit('sel');
}
function endCrop() { if (!E.crop) return; const id = E.crop; E.crop = null; E.commit('crop'); Canvas.refreshEl(id); drawOverlay(); E.emit('sel'); }
function cropGhost(box, e) {
  const z = E.z;
  const g = h('div.ghost', { style: { left: e.ix * e.w * z + 'px', top: e.iy * e.h * z + 'px', width: e.iw * e.w * z + 'px', height: e.ih * e.h * z + 'px' } },
    h('img', { src: assetURLSync(e.src) || e.src, alt: '', draggable: false, style: { transform: (e.flipX || e.flipY) ? `scale(${e.flipX ? -1 : 1},${e.flipY ? -1 : 1})` : '' } }));
  for (const k of ['nw', 'ne', 'se', 'sw']) { const [u, v] = HANDLES[k]; g.append(h('i.hd.hd-c.hd-crop', { dataset: { h: 'c' + k }, style: { left: (u + 1) * 50 + '%', top: (v + 1) * 50 + '%' } })); }
  box.classList.add('cropping');
  box.prepend(g);
}
function cropBar() {
  const e = E.get(E.crop), z = E.z, b = bbox([e]);
  const bar = h('div.selbar.cropbar.glass-strong', { style: { left: (b.x + b.w / 2) * z + 'px', top: b.y * z + 'px' } },
    h('button.btn.btn-text.sm', { onclick: () => { Object.assign(e, { ix: 0, iy: 0, iw: 1, ih: 1 }); const ar = e.nw / e.nh, fr = e.w / e.h; if (ar > fr) { e.iw = ar / fr; e.ix = (1 - e.iw) / 2; } else { e.ih = fr / ar; e.iy = (1 - e.ih) / 2; } Canvas.refreshEl(e.id); drawOverlay(); } }, 'Atur ulang'),
    h('button.btn.btn-primary.sm', { onclick: () => endCrop() }, 'Selesai'));
  bar.addEventListener('pointerdown', (ev) => ev.stopPropagation());
  return bar;
}
function cropPan(ev, e) {
  const o = { ix: e.ix, iy: e.iy };
  const th = (e.rot || 0) * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th);
  drag(ev, (dx, dy) => {
    const lx = (dx * cs + dy * sn) / E.z, ly = (-dx * sn + dy * cs) / E.z;
    e.ix = clamp(o.ix + lx / e.w, 1 - e.iw, 0); e.iy = clamp(o.iy + ly / e.h, 1 - e.ih, 0);
    patchLive(e); drawOverlay();
  }, () => drawOverlay());
}
function startCropScale(ev, e, k) {
  const [u, v] = HANDLES[k], o = { ix: e.ix, iy: e.iy, iw: e.iw, ih: e.ih };
  const ax = o.ix + (u < 0 ? o.iw : 0), ay = o.iy + (v < 0 ? o.ih : 0); // anchor in frame fractions
  const th = (e.rot || 0) * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th);
  drag(ev, (dx, dy) => {
    const lx = (dx * cs + dy * sn) / E.z, ly = (-dx * sn + dy * cs) / E.z;
    let s = Math.max((o.iw * e.w + u * lx) / (o.iw * e.w), (o.ih * e.h + v * ly) / (o.ih * e.h));
    s = Math.max(s, 1 / o.iw, 1 / o.ih);
    let iw = o.iw * s, ih = o.ih * s, ix = u < 0 ? ax - iw : ax, iy = v < 0 ? ay - ih : ay;
    ix = clamp(ix, 1 - iw, 0); iy = clamp(iy, 1 - ih, 0);
    Object.assign(e, { iw, ih, ix, iy });
    patchLive(e); drawOverlay();
  }, () => drawOverlay());
}

// ---------- context menu ----------
function onContext(e) {
  if (e.target.closest('.pg-head') || isTyping(e)) return;
  const id = elAt(e.target);
  e.preventDefault();
  if (id && !E.sel.includes(id)) E.select(id);
  if (!id && !e.target.closest('.selbar')) E.clearSel();
  contextMenu({ x: e.clientX, y: e.clientY });
}
export function contextMenu(at) {
  const els = E.selEls(), one = E.one();
  const C = (n) => E.emit('cmd', n);
  if (!els.length) {
    return menu(at, [
      { label: 'Tempel', icon: 'content_paste', kbd: 'Ctrl+V', run: () => C('paste') },
      { label: 'Pilih semua', icon: 'select_all', kbd: 'Ctrl+A', run: () => C('selectAll') },
      { sep: 1 },
      { label: 'Tambah halaman', icon: 'note_add', run: () => addPage(E.pi) },
      { label: 'Duplikat halaman', icon: 'content_copy', run: () => dupPage(E.pi) },
      { label: 'Hapus halaman', icon: 'delete', danger: true, disabled: E.d.pages.length < 2, run: () => delPage(E.pi) },
      { sep: 1 },
      { label: 'Warna latar', icon: 'format_color_fill', run: () => C('bgColor') },
    ]);
  }
  const locked = els.every(x => x.lock);
  return menu(at, [
    { label: 'Salin', icon: 'content_copy', kbd: 'Ctrl+C', run: () => C('copy') },
    { label: 'Tempel', icon: 'content_paste', kbd: 'Ctrl+V', run: () => C('paste') },
    { label: 'Duplikat', icon: 'library_add', kbd: 'Ctrl+D', disabled: locked, run: () => E.duplicate() },
    { label: 'Hapus', icon: 'delete', kbd: 'Delete', disabled: locked, run: () => E.remove() },
    { sep: 1 },
    { label: 'Salin gaya', icon: 'format_paint', kbd: 'Ctrl+Alt+C', disabled: !one, run: () => C('copyStyle') },
    { label: 'Tempel gaya', icon: 'colorize', kbd: 'Ctrl+Alt+V', disabled: !E.styleClip, run: () => C('pasteStyle') },
    { sep: 1 },
    { label: 'Lapisan', icon: 'layers', sub: [
      { label: 'Ke depan', icon: 'flip_to_front', kbd: 'Ctrl+]', run: () => E.order(1) },
      { label: 'Paling depan', icon: 'vertical_align_top', kbd: 'Ctrl+Alt+]', run: () => E.order('front') },
      { label: 'Ke belakang', icon: 'flip_to_back', kbd: 'Ctrl+[', run: () => E.order(-1) },
      { label: 'Paling belakang', icon: 'vertical_align_bottom', kbd: 'Ctrl+Alt+[', run: () => E.order('back') },
    ] },
    { label: 'Ratakan ke halaman', icon: 'align_horizontal_center', sub: [
      ['Kiri', 'align_horizontal_left', 'l'], ['Tengah', 'align_horizontal_center', 'c'], ['Kanan', 'align_horizontal_right', 'r'],
      ['Atas', 'align_vertical_top', 't'], ['Tengah vertikal', 'align_vertical_center', 'm'], ['Bawah', 'align_vertical_bottom', 'b'],
    ].map(([l, ic, k]) => ({ label: l, icon: ic, run: () => C('align:' + k) })) },
    els.length > 1 ? { label: els.every(x => x.gid && x.gid === els[0].gid) ? 'Pisahkan grup' : 'Kelompokkan', icon: 'ad_group', kbd: 'Ctrl+G', run: () => (els.every(x => x.gid && x.gid === els[0].gid) ? E.ungroup() : E.group()) } : null,
    { label: locked ? 'Buka kunci' : 'Kunci', icon: locked ? 'lock_open' : 'lock', kbd: 'Ctrl+Shift+L', run: () => E.toggleLock() },
    one?.type === 'image' && one.src ? { label: 'Jadikan latar belakang', icon: 'wallpaper', run: () => C('asBg') } : null,
    one?.type === 'image' && one.src ? { label: 'Pangkas', icon: 'crop', run: () => startCrop(one.id) } : null,
    { label: 'Tautan', icon: 'link', kbd: 'Ctrl+K', run: () => C('link') },
    { label: 'Animasi', icon: 'animation', run: () => C('panel:anim') },
  ]);
}

// ---------- drop ----------
async function onDrop(e) {
  e.preventDefault();
  let i = pageAt(e.clientX, e.clientY);
  if (i < 0) i = E.pi;
  if (i !== E.pi) { E.pi = i; E.emit('page'); }
  const at = toDesign(e.clientX, e.clientY, i);
  const targetId = elAt(document.elementFromPoint(e.clientX, e.clientY) || e.target);
  const target = targetId ? E.get(targetId) : null;
  const raw = e.dataTransfer.getData('application/x-amatu');
  if (raw) {
    const spec = JSON.parse(raw);
    E.emit('dropSpec', { spec, at, target });
    return;
  }
  const files = [...e.dataTransfer.files].filter(f => /^image\//.test(f.type));
  for (const [k, f] of files.entries()) {
    const a = await addAsset(f, { uploaded: true, name: f.name });
    E.emit('uploads');
    if (target && target.type === 'image' && k === 0 && !target.lock) { fillImage(target, a); continue; }
    E.emit('insertImage', { a, at: [at[0] + k * 30, at[1] + k * 30] });
  }
}
export function fillImage(el, a) {
  el.src = a.src; el.nw = a.w; el.nh = a.h; el.filter = el.filter || null;
  const ar = a.w / a.h, fr = el.w / el.h;
  if (ar > fr) { el.ih = 1; el.iw = ar / fr; el.ix = (1 - el.iw) / 2; el.iy = 0; }
  else { el.iw = 1; el.ih = fr / ar; el.iy = (1 - el.ih) / 2; el.ix = 0; }
  delete el.frame;
  Canvas.refreshEl(el.id); E.select(el.id, { raw: true }); E.commit('fill');
}

export { toDesign };
