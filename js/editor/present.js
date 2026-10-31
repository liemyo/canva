// Fullscreen presentation with page transitions, element animations, autoplay and notes.
import { h, ib } from '../util.js';
import { renderPage } from '../render.js';
import { animCSS } from './ctxpanels.js';

export function present(d, start = 0, opt = {}) {
  const pages = d.pages.filter(p => !p.hidden);
  let i = Math.min(start, pages.length - 1), auto = !!opt.auto, timer, hideT, notes = false;
  const t0 = Date.now();
  const root = h('div.present.cursor', { tabIndex: 0 });
  const slot = h('div.slot');
  const label = h('span');
  const clock = h('div.timer');
  const notesEl = h('div.pnotes', { hidden: true });
  const autoBtn = ib('play_arrow', 'Putar otomatis', () => { auto = !auto; autoBtn.querySelector('.ms').textContent = auto ? 'pause' : 'play_arrow'; schedule(); });
  const bar = h('div.pbar', ib('chevron_left', 'Sebelumnya', () => go(i - 1)), label, ib('chevron_right', 'Berikutnya', () => go(i + 1)), autoBtn,
    ib('sticky_note_2', 'Catatan', () => { notes = !notes; show(); }), ib('fullscreen', 'Layar penuh', () => toggleFs()), ib('close', 'Keluar', () => close()));
  root.append(slot, clock, notesEl, bar);
  document.body.append(root);
  root.focus();
  try { root.requestFullscreen?.().catch(() => {}); } catch {}

  const fit = () => {
    const s = Math.min(innerWidth / d.w, innerHeight / d.h);
    slot.style.transform = `translate(${-d.w * s / 2}px, ${-d.h * s / 2}px) scale(${s})`;
  };
  function show(dir = 1) {
    const p = pages[i];
    const st = renderPage(p, d, { mode: 'present' });
    const pageAnim = p.anim;
    [...st.querySelectorAll('.el')].forEach((n, k) => {
      const e = p.els.find(x => x.id === n.dataset.id);
      const a = e?.anim || pageAnim;
      if (a) n.style.animation = animCSS(a, (e?.anim ? 0 : k * .12) + .15);
    });
    const tr = p.trans && p.trans !== 'none' ? p.trans : null;
    if (tr) st.style.animation = `t-${tr} .7s cubic-bezier(.2,.8,.2,1) both${dir < 0 && (tr === 'slide' || tr === 'push') ? ' reverse' : ''}`;
    slot.textContent = ''; slot.append(st);
    label.textContent = `${i + 1} / ${pages.length}`;
    notesEl.hidden = !notes || !p.notes; notesEl.textContent = p.notes || '';
    fit(); schedule();
  }
  function go(n) { if (n < 0 || n >= pages.length) { if (n >= pages.length && auto) { i = -1; go(0); } return; } const dir = n > i ? 1 : -1; i = n; show(dir); }
  function schedule() { clearTimeout(timer); if (auto) timer = setTimeout(() => go(i + 1), (pages[i].dur || 5) * 1000); }
  function toggleFs() { document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen?.(); }
  const tick = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); clock.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }, 1000);
  function close() {
    clearTimeout(timer); clearInterval(tick); removeEventListener('resize', fit); document.removeEventListener('fullscreenchange', onFs);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    root.remove();
  }
  const onFs = () => {};
  document.addEventListener('fullscreenchange', onFs);
  root.addEventListener('keydown', (e) => {
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); go(i + 1); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); go(i - 1); }
    else if (e.key === 'Home') go(0); else if (e.key === 'End') go(pages.length - 1);
    else if (e.key === 'Escape') close();
    else if (e.key.toLowerCase() === 'f') toggleFs();
    else if (e.key.toLowerCase() === 'n') { notes = !notes; show(); }
    else if (e.key.toLowerCase() === 'p') autoBtn.click();
    e.stopPropagation();
  });
  root.addEventListener('click', (e) => { if (e.target.closest('.pbar, .el')) return; go(e.clientX > innerWidth / 3 ? i + 1 : i - 1); });
  root.addEventListener('pointermove', () => { root.classList.add('cursor'); clearTimeout(hideT); hideT = setTimeout(() => root.classList.remove('cursor'), 2200); });
  addEventListener('resize', fit);
  show();
  hideT = setTimeout(() => root.classList.remove('cursor'), 2500);
}
