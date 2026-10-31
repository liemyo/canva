// Shared editor state, undo history and element-level operations.
import { Store } from '../store.js';
import { debounce, uid, clone } from '../util.js';
import { cloneEls, bbox } from '../model.js';

const listeners = {};

export const E = {
  d: null,          // the design
  pi: 0,            // active page index
  sel: [],          // selected element ids (all on page pi)
  z: 1,             // zoom
  editing: null,    // id of text/table being edited in place
  crop: null,       // id of image in crop mode
  clip: null,       // internal clipboard
  styleClip: null,  // copied style
  hist: [], hi: -1,
  saving: false,

  on(ev, fn) { (listeners[ev] ||= []).push(fn); return () => listeners[ev].splice(listeners[ev].indexOf(fn), 1); },
  emit(ev, a) { (listeners[ev] || []).slice().forEach(f => f(a)); },
  reset() { for (const k of Object.keys(listeners)) delete listeners[k]; },

  page(i = E.pi) { return E.d.pages[i]; },
  els(i = E.pi) { return E.d.pages[i].els; },
  get(id) { for (const p of E.d.pages) { const e = p.els.find(x => x.id === id); if (e) return e; } return null; },
  pageOf(id) { return E.d.pages.findIndex(p => p.els.some(x => x.id === id)); },
  selEls() { return E.sel.map(id => E.get(id)).filter(Boolean); },
  one() { return E.sel.length === 1 ? E.get(E.sel[0]) : null; },
  selType() {
    const els = E.selEls();
    if (!els.length) return null;
    const t = new Set(els.map(e => e.type));
    return t.size === 1 ? [...t][0] : 'mixed';
  },

  select(ids, opt = {}) {
    ids = [].concat(ids || []).filter(Boolean);
    if (!opt.raw) {
      // Selecting one member of a group selects the whole group.
      const out = new Set();
      for (const id of ids) {
        const e = E.get(id); if (!e) continue;
        if (e.gid) E.els(E.pageOf(id)).filter(x => x.gid === e.gid).forEach(x => out.add(x.id)); else out.add(id);
      }
      ids = [...out];
    }
    if (ids.length) { const p = E.pageOf(ids[0]); if (p >= 0 && p !== E.pi) { E.pi = p; E.emit('page'); } }
    if (E.editing && !ids.includes(E.editing)) E.emit('endEdit');
    if (E.crop && !ids.includes(E.crop)) E.emit('endCrop');
    E.sel = ids;
    E.emit('sel');
  },
  clearSel() { if (E.sel.length || E.editing) E.select([]); },

  // ---------- history ----------
  snap() { return JSON.stringify({ w: E.d.w, h: E.d.h, pages: E.d.pages }); },
  initHistory() { E.hist = [E.snap()]; E.hi = 0; E.emit('hist'); },
  commit(why = '') {
    const s = E.snap();
    if (s === E.hist[E.hi]) { E.emit('change', why); return; }
    E.hist = E.hist.slice(0, E.hi + 1);
    E.hist.push(s);
    if (E.hist.length > 150) E.hist.shift();
    E.hi = E.hist.length - 1;
    E.emit('change', why); E.emit('hist');
    E.save();
  },
  restore(s) {
    const o = JSON.parse(s);
    E.d.w = o.w; E.d.h = o.h; E.d.pages = o.pages;
    E.pi = Math.min(E.pi, E.d.pages.length - 1);
    E.sel = E.sel.filter(id => E.get(id));
    E.emit('full'); E.emit('sel'); E.emit('hist'); E.save();
  },
  undo() { if (E.hi > 0) { E.emit('endEdit'); E.restore(E.hist[--E.hi]); } },
  redo() { if (E.hi < E.hist.length - 1) { E.emit('endEdit'); E.restore(E.hist[++E.hi]); } },
  canUndo() { return E.hi > 0; },
  canRedo() { return E.hi < E.hist.length - 1; },

  save: debounce(async () => {
    if (!E.d) return;
    E.saving = true; E.emit('saving', true);
    try { await Store.putDesign(E.d); } finally { E.saving = false; E.emit('saving', false); }
  }, 700),

  // ---------- element operations ----------
  // patch: object or fn(el). Applies to selection (or given els) and re-renders them.
  set(patch, opt = {}) {
    const els = opt.els || E.selEls();
    for (const e of els) {
      if (e.lock && !opt.force && !opt.allowLocked) continue;
      if (typeof patch === 'function') patch(e); else Object.assign(e, clone(patch));
      E.emit('el', e.id);
    }
    if (opt.commit !== false) E.commit(opt.why);
    else E.emit('live');
  },
  add(els, opt = {}) {
    els = [].concat(els);
    const pg = E.page(opt.page ?? E.pi);
    if (opt.center !== false && !opt.keepPos) {
      const b = bbox(els), W = E.d.w, H = E.d.h;
      // Fit inside the page if bigger than ~80%.
      const k = Math.min(1, (W * .8) / b.w, (H * .8) / b.h);
      if (k < 1) els.forEach(e => { e.x = b.x + (e.x - b.x) * k; e.y = b.y + (e.y - b.y) * k; e.w *= k; e.h *= k; if (e.size) e.size *= k; });
      const b2 = bbox(els), dx = (opt.at ? opt.at[0] : W / 2) - (b2.x + b2.w / 2), dy = (opt.at ? opt.at[1] : H / 2) - (b2.y + b2.h / 2);
      els.forEach(e => { e.x += dx; e.y += dy; });
    }
    pg.els.push(...els);
    E.emit('full');
    if (opt.select !== false) E.select(els.map(e => e.id), { raw: true });
    E.commit('add');
    return els;
  },
  remove(ids = E.sel) {
    const set = new Set(ids);
    for (const p of E.d.pages) p.els = p.els.filter(e => !(set.has(e.id) && !e.lock));
    E.sel = E.sel.filter(id => E.get(id));
    E.emit('full'); E.emit('sel'); E.commit('remove');
  },
  duplicate() {
    const els = E.selEls(); if (!els.length) return;
    const cp = cloneEls(els);
    cp.forEach(e => { e.x += 24; e.y += 24; e.lock = false; });
    const arr = E.els(), last = Math.max(...els.map(e => arr.indexOf(e)));
    arr.splice(last + 1, 0, ...cp);
    E.emit('full'); E.select(cp.map(e => e.id), { raw: true }); E.commit('duplicate');
  },
  // Layer order: dir = 1 forward, -1 backward, 'front', 'back'.
  order(dir) {
    const arr = E.els(), ids = new Set(E.sel);
    if (!ids.size) return;
    const picked = arr.filter(e => ids.has(e.id)), rest = arr.filter(e => !ids.has(e.id));
    let idx;
    if (dir === 'front') idx = rest.length;
    else if (dir === 'back') idx = 0;
    else {
      const first = arr.indexOf(picked[0]), last = arr.indexOf(picked.at(-1));
      if (dir > 0) { const after = arr.slice(last + 1).find(e => !ids.has(e.id)); idx = after ? rest.indexOf(after) + 1 : rest.length; }
      else { const before = arr.slice(0, first).reverse().find(e => !ids.has(e.id)); idx = before ? rest.indexOf(before) : 0; }
    }
    rest.splice(idx, 0, ...picked);
    E.page().els = rest;
    E.emit('full'); E.commit('order');
  },
  group() {
    const els = E.selEls(); if (els.length < 2) return;
    const g = uid('g'); els.forEach(e => (e.gid = g));
    E.commit('group'); E.emit('sel');
  },
  ungroup() {
    const els = E.selEls(); els.forEach(e => (e.gid = null));
    E.commit('ungroup'); E.emit('sel');
  },
  toggleLock() {
    const els = E.selEls(); const v = !els.every(e => e.lock);
    els.forEach(e => (e.lock = v));
    E.commit('lock'); E.emit('sel');
  },
};
