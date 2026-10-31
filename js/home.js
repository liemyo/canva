// Home, projects, templates, brand kit and apps screens.
import { h, icon, ib, menu, popover, dialog, toast, promptDlg, confirmDlg, fmtDate, uid, debounce, pickFiles, clamp } from './util.js';
import { Store } from './store.js';
import { Theme, ACCENTS, WALLPAPERS, GLASS } from './theme.js';
import { SIZES, SIZE_GROUPS, newDesign, sizeByKey } from './model.js';
import { TEMPLATES } from './templates.js';
import { renderPage } from './render.js';
import { logoSVG } from './logo.js';
import { Brand } from './brand.js';
import { FONTS, loadFont, fontStack, previewFamily } from './fonts.js';
import { addAsset, assetURL } from './assets.js';
import { HOME_TOOLS, runTool } from './tools/standalone.js';

// ---------- fluid thumbnails ----------
const ro = new ResizeObserver((ents) => { for (const en of ents) { const t = en.target, st = t.firstChild; if (st) st.style.transform = `scale(${t.clientWidth / +t.dataset.w})`; } });
export function fluidThumb(page, d, widthCSS = '100%') {
  const box = h('div.thumb.fluid', { dataset: { w: d.w }, style: { width: widthCSS, aspectRatio: `${d.w} / ${d.h}` } });
  const io = new IntersectionObserver(([en]) => {
    if (!en.isIntersecting) return;
    io.disconnect();
    box.append(renderPage(page, d, { mode: 'thumb' }));
    ro.observe(box);
  }, { rootMargin: '300px' });
  io.observe(box);
  return box;
}
const containW = (d) => { const ar = d.w / d.h; return ar >= 4 / 3 ? '84%' : `${84 * .75 * ar}%`; };

export async function createDesign(w, h, name, type, pages) {
  const d = newDesign(w, h, name || 'Desain tanpa judul', type);
  if (pages) d.pages = pages;
  await Store.putDesign(d);
  location.hash = '#/design/' + d.id;
  return d;
}
export function useTemplate(t) {
  const s = sizeByKey(t.size);
  return createDesign(t.w, t.h, t.name, t.size, t.build()).then(() => s);
}

// ---------- theme menu ----------
export function themeMenu(anchor) {
  const p = Theme.p;
  const seg = (items, cur, set) => h('div.seg.full', items.map(([k, l, ic]) => h('button' + (cur === k ? '.on' : ''), { type: 'button', onclick: (e) => { set(k); e.currentTarget.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.currentTarget)); } }, ic ? icon(ic, 'xs') : null, l)));
  const body = h('div', { style: { width: '300px', padding: '16px', display: 'grid', gap: '14px' } },
    h('b', 'Tampilan'),
    seg([['light', 'Terang', 'light_mode'], ['dark', 'Gelap', 'dark_mode'], ['system', 'Sistem', 'contrast']], p.mode, (k) => Theme.set({ mode: k })),
    h('div.fx', h('span.fx-l', 'Warna aksen'), h('div.swatches', ACCENTS.map(([k, n, c]) => h('button.swatch' + (p.accent === k ? '.on' : ''), { type: 'button', dataset: { tip: n }, style: { background: c }, onclick: (e) => { Theme.set({ accent: k }); e.currentTarget.parentNode.querySelectorAll('.swatch').forEach(s => s.classList.toggle('on', s === e.currentTarget)); } })))),
    h('div.fx', h('span.fx-l', 'Material'), seg(GLASS, p.glass, (k) => Theme.set({ glass: k }))),
    h('div.fx', h('span.fx-l', 'Wallpaper'), h('div.chips', WALLPAPERS.map(([k, l]) => h('button.chip' + (p.bg === k ? '.on' : ''), { type: 'button', onclick: (e) => { Theme.set({ bg: k }); e.currentTarget.parentNode.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === e.currentTarget)); } }, l)))),
    h('div.fx', h('span.fx-l', 'Area kerja editor'), seg([['soft', 'Tembus pandang'], ['plain', 'Polos']], p.canvas, (k) => Theme.set({ canvas: k }))));
  popover(anchor, body, { pos: 'bottom-end' });
}

// ---------- shell ----------
let shell;
export function homeShell(mount, route) {
  if (!shell || !shell.isConnected) {
    shell = h('div.home');
    mount.append(shell);
  }
  shell.textContent = '';
  const nav = [['', 'Beranda', 'home'], ['projects', 'Proyek', 'folder'], ['templates', 'Template', 'dashboard'], ['brand', 'Merek', 'verified'], ['apps', 'Aplikasi', 'apps']];
  const recent = h('div.recent-l');
  Store.listDesigns().then(l => recent.append(...l.slice(0, 8).map(d => h('a', { href: '#/design/' + d.id, title: d.name }, d.name))));
  const side = h('aside.side.glass.refract',
    h('a.logo', { href: '#/', html: logoSVG + '<span>Amatu <b>Design</b></span>' }),
    h('button.btn.btn-brand', { type: 'button', onclick: () => newDesignDialog() }, icon('add'), 'Buat desain'),
    h('nav.nav', nav.map(([k, l, ic]) => h('a' + (route === k ? '.on' : ''), { href: '#/' + k }, icon(ic), l))),
    h('div.side-sec', 'Terbaru'), recent,
    h('div.side-foot', h('div.av', 'A'), h('div.who', h('b', 'Ruang kerja saya'), h('small', 'Tersimpan di perangkat ini')), ib('contrast', 'Tema & tampilan', (e) => themeMenu(e.currentTarget))));
  const main = h('main.main');
  shell.append(side, h('div.mob-back', { onclick: () => shell.classList.remove('nav-open') }), main);
  shell.classList.remove('nav-open');
  const top = h('div.topbar', ib('menu', 'Menu', () => shell.classList.toggle('nav-open'), 'burger'), h('span.grow'),
    ib('contrast', 'Tema & tampilan', (e) => themeMenu(e.currentTarget)),
    h('button.btn.btn-primary', { type: 'button', onclick: () => newDesignDialog() }, icon('add'), 'Buat desain'));
  main.append(top);
  return main;
}

// ---------- home ----------
export async function renderHome(mount) {
  const main = homeShell(mount, '');
  document.title = 'Amatu Design — desain grafis online';
  let group = 'all';
  const sizesRow = h('div.sizes');
  const drawSizes = () => {
    sizesRow.textContent = '';
    const list = group === 'all' ? ['ig-post', 'ig-story', 'pres', 'poster-a4', 'yt-thumb', 'card', 'fb-post', 'logo', 'flyer', 'doc', 'cert', 'invite', 'resume', 'banner'].map(sizeByKey) : SIZES.filter(s => s[4] === group);
    sizesRow.append(sizeCard(null), ...list.map(sizeCard));
  };
  const q = h('input', { type: 'search', placeholder: 'Cari template, ukuran, atau ide desain…', enterKeyHint: 'search' });
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter' && q.value.trim()) location.hash = '#/templates?q=' + encodeURIComponent(q.value.trim()); });
  const cats = h('div.hero-cats', SIZE_GROUPS.map(([k, l, ic]) => h('button' + (k === group ? '.on' : ''), { type: 'button', onclick: (e) => { group = k; cats.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.currentTarget)); drawSizes(); } }, h('i', icon(ic)), l)));
  main.append(h('section.hero', h('h1', 'Mau desain apa hari ini?'), h('label.search', icon('search'), q), cats));
  main.append(h('section.sec', h('div.sec-h', h('h2', 'Mulai dari ukuran'), h('button.btn-text', { onclick: () => newDesignDialog() }, 'Ukuran khusus')), sizesRow));
  drawSizes();
  const designs = await Store.listDesigns();
  if (designs.length) {
    const g = h('div.grid-cards', designs.slice(0, 8).map(designCard));
    main.append(h('section.sec', h('div.sec-h', h('h2', 'Desain terbaru'), h('a.btn-text', { href: '#/projects' }, 'Lihat semua')), g));
  }
  main.append(h('section.sec', h('div.sec-h', h('h2', 'Template untuk Anda'), h('a.btn-text', { href: '#/templates' }, 'Lihat semua')), templateGrid(TEMPLATES.slice(0, 20))));
  main.append(h('section.sec', h('div.sec-h', h('h2', 'Alat gratis'), h('a.btn-text', { href: '#/apps' }, 'Semua aplikasi')), toolsGrid(HOME_TOOLS.slice(0, 6))));
}

const SIZE_COLORS = { social: ['#ffe0ec', '#d6336c'], pres: ['#ffedd5', '#ea6a0c'], print: ['#dcfce7', '#16a34a'], docs: ['#dbeafe', '#1f6feb'], brand: ['#ede4ff', '#7b3fe4'] };
function sizeCard(s) {
  if (!s) return h('button.size-card', { type: 'button', onclick: () => newDesignDialog() }, h('div.sz-b', { style: { background: 'var(--card)', border: '1.5px dashed var(--line2)' } }, icon('add')), h('b', 'Ukuran khusus'));
  const [k, n, w, hh, g, ic, hint] = s, [bg, fg] = SIZE_COLORS[g] || SIZE_COLORS.brand;
  return h('button.size-card', { type: 'button', onclick: () => createDesign(w, hh, n, k) },
    h('div.sz-b', { style: { background: bg, color: fg } }, icon(ic)), h('b', n), h('small', hint || `${w} × ${hh} px`));
}
function designCard(d) {
  const card = h('div.dcard', { tabIndex: 0, onclick: (e) => { if (!e.target.closest('.dmore')) location.hash = '#/design/' + d.id; }, onkeydown: (e) => { if (e.key === 'Enter') location.hash = '#/design/' + d.id; } },
    h('div.dthumb', fluidThumb(d.pages[0], d, containW(d)), d.starred ? icon('star', 'fill star') : null,
      h('button.ib.sm.dmore', { type: 'button', 'aria-label': 'Opsi', onclick: (e) => designMenu(e.currentTarget, d) }, icon('more_horiz'))),
    h('div.dmeta', h('div', h('b', d.name), h('small', `${fmtDate(d.updated)} · ${d.w} × ${d.h}${d.pages.length > 1 ? ' · ' + d.pages.length + ' hlm' : ''}`))));
  card.addEventListener('contextmenu', (e) => { e.preventDefault(); designMenu({ x: e.clientX, y: e.clientY }, d); });
  return card;
}
function designMenu(anchor, d) {
  const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
  menu(anchor, [
    { label: 'Buka', icon: 'open_in_new', run: () => (location.hash = '#/design/' + d.id) },
    { label: 'Ganti nama', icon: 'edit', run: async () => { const v = await promptDlg('Ganti nama', d.name); if (v) { d.name = v; await Store.putDesign(d); refresh(); } } },
    { label: 'Buat salinan', icon: 'file_copy', run: async () => { const c = JSON.parse(JSON.stringify(d)); c.id = uid('d'); c.name = 'Salinan ' + d.name; c.created = Date.now(); await Store.putDesign(c); refresh(); } },
    { label: d.starred ? 'Hapus bintang' : 'Beri bintang', icon: 'star', run: async () => { d.starred = !d.starred; await Store.putDesign(d); refresh(); } },
    { label: 'Unduh', icon: 'download', run: () => import('./export.js').then(m => m.openExport(d)) },
    { label: 'Presentasikan', icon: 'slideshow', run: () => import('./editor/present.js').then(m => m.present(d, 0)) },
    { sep: 1 },
    { label: 'Hapus', icon: 'delete', danger: true, run: async () => { if (await confirmDlg('Hapus desain?', `“${d.name}” akan dihapus permanen.`, 'Hapus', true)) { await Store.deleteDesign(d.id); refresh(); toast('Desain dihapus'); } } },
  ]);
}
function templateGrid(list) {
  return h('div.tgrid', list.map(t => {
    const pages = t.build();
    return h('div.tcard', { tabIndex: 0, onclick: () => useTemplate(t), onkeydown: (e) => { if (e.key === 'Enter') useTemplate(t); } },
      h('div.tbox', fluidThumb(pages[0], t), h('span.tag', (sizeByKey(t.size)?.[1] || '') + (pages.length > 1 ? ` · ${pages.length} hlm` : ''))),
      h('small', t.name));
  }));
}
function toolsGrid(list) {
  return h('div.tools-grid', list.map(([k, n, ic, d, c, badge]) => h('button.tool-card', { type: 'button', onclick: () => runTool(k) },
    h('i', { style: { background: c } }, icon(ic)), h('div', h('b', n, badge ? h('span.badge', badge) : null), h('small', d)))));
}

// ---------- projects ----------
export async function renderProjects(mount) {
  const main = homeShell(mount, 'projects');
  document.title = 'Proyek — Amatu Design';
  let tab = 'all', q = '';
  const list = await Store.listDesigns();
  const grid = h('div');
  const draw = async () => {
    grid.textContent = '';
    if (tab === 'uploads') {
      const as = await Store.listAssets();
      if (!as.length) return grid.append(empty('cloud_upload', 'Belum ada unggahan', 'Gambar yang Anda unggah di editor akan muncul di sini.'));
      const g = h('div.grid-cards');
      for (const a of as) {
        const im = h('img', { alt: a.name, style: { maxWidth: '86%', maxHeight: '86%', borderRadius: '6px', boxShadow: '0 2px 10px rgba(0,0,0,.15)' } });
        assetURL('asset:' + a.id).then(u => (im.src = u));
        g.append(h('div.dcard', h('div.dthumb', im, h('button.ib.sm.dmore', { type: 'button', onclick: async () => { if (await confirmDlg('Hapus unggahan?', a.name, 'Hapus', true)) { await Store.deleteAsset(a.id); draw(); } } }, icon('delete'))), h('div.dmeta', h('div', h('b', a.name), h('small', `${a.w} × ${a.h} · ${fmtDate(a.created)}`)))));
      }
      return grid.append(g);
    }
    let ds = list;
    if (tab === 'star') ds = ds.filter(d => d.starred);
    if (q) ds = ds.filter(d => d.name.toLowerCase().includes(q));
    if (!ds.length) return grid.append(empty('folder_open', q ? 'Tidak ada yang cocok' : 'Belum ada desain', 'Buat desain pertama Anda dari ukuran atau template.', h('button.btn.btn-primary', { onclick: () => newDesignDialog() }, icon('add'), 'Buat desain')));
    grid.append(h('div.grid-cards', ds.map(designCard)));
  };
  const s = h('input', { type: 'search', placeholder: 'Cari desain', oninput: debounce((e) => { q = e.target.value.trim().toLowerCase(); draw(); }, 200) });
  main.append(h('div.sec-h', { style: { marginTop: '6px' } }, h('h2', { style: { fontSize: '26px' } }, 'Proyek')),
    h('div.row', { style: { flexWrap: 'wrap', marginBottom: '18px' } }, h('div.seg', [['all', 'Semua desain'], ['star', 'Berbintang'], ['uploads', 'Unggahan']].map(([k, l]) => h('button' + (tab === k ? '.on' : ''), { type: 'button', onclick: (e) => { tab = k; e.currentTarget.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.currentTarget)); draw(); } }, l))),
      h('span.grow'), h('label.search', { style: { width: 'min(320px,100%)' } }, icon('search'), s),
      h('button.btn.btn-ghost', { type: 'button', onclick: async () => { const [f] = await pickFiles('.amatu,.json', false); if (f) import('./export.js').then(m => m.importProject(f)); } }, icon('upload_file'), 'Impor')),
    grid);
  draw();
}
const empty = (ic, t, d, action) => h('div.empty', icon(ic), h('b', t), h('span', d), action);

// ---------- templates ----------
export function renderTemplates(mount, params) {
  const main = homeShell(mount, 'templates');
  document.title = 'Template — Amatu Design';
  let q = params.get('q') || '', cat = 'all';
  const host = h('div');
  const draw = () => {
    host.textContent = '';
    const ql = q.toLowerCase();
    const list = TEMPLATES.filter(t => (cat === 'all' || sizeByKey(t.size)?.[4] === cat) && (!ql || (t.name + ' ' + t.tags + ' ' + (sizeByKey(t.size)?.[1] || '')).toLowerCase().includes(ql) || ql.split(/\s+/).every(w => (t.name + ' ' + t.tags).toLowerCase().includes(w))));
    host.append(list.length ? templateGrid(list) : empty('search_off', 'Template tidak ditemukan', 'Coba kata kunci lain, atau mulai dari desain kosong.'));
  };
  const s = h('input', { type: 'search', value: q, placeholder: 'Cari template (mis. promo, undangan, CV)', oninput: debounce((e) => { q = e.target.value.trim(); draw(); }, 200) });
  main.append(h('div.sec-h', { style: { marginTop: '6px' } }, h('h2', { style: { fontSize: '26px' } }, 'Template')),
    h('label.search', { style: { maxWidth: '620px', marginBottom: '14px' } }, icon('search'), s),
    h('div.chips.scroll', { style: { marginBottom: '20px' } }, [['all', 'Semua'], ...SIZE_GROUPS.slice(1).map(([k, l]) => [k, l])].map(([k, l]) => h('button.chip' + (cat === k ? '.on' : ''), { type: 'button', onclick: (e) => { cat = k; e.currentTarget.parentNode.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === e.currentTarget)); draw(); } }, l))),
    host);
  draw();
}

// ---------- brand ----------
export async function renderBrand(mount) {
  const main = homeShell(mount, 'brand');
  document.title = 'Brand Kit — Amatu Design';
  await Brand.load();
  const d = Brand.d;
  const save = () => Brand.save();
  const name = h('input.tx', { value: d.name, style: { maxWidth: '360px', fontWeight: 700 }, onchange: (e) => { d.name = e.target.value; save(); } });
  const pal = h('div', { style: { display: 'grid', gap: '16px' } });
  const drawPal = () => {
    pal.textContent = '';
    d.palettes.forEach((p, pi) => {
      pal.append(h('div', { style: { display: 'grid', gap: '8px' } },
        h('div.row', h('input.tx', { value: p.name, style: { maxWidth: '240px', height: '32px' }, onchange: (e) => { p.name = e.target.value; save(); } }), h('span.grow'), ib('delete', 'Hapus palet', () => { d.palettes.splice(pi, 1); save(); drawPal(); }, 'sm')),
        h('div.pal-row', p.colors.map((c, ci) => h('button.sw-c', { type: 'button', style: { background: c }, dataset: { tip: c.toUpperCase() + ' · klik untuk hapus' }, onclick: () => { p.colors.splice(ci, 1); save(); drawPal(); } })),
          h('button.add', { type: 'button', dataset: { tip: 'Tambah warna' }, onclick: (e) => import('./editor/color.js').then(m => m.colorPopover(e.currentTarget, '#7b3fe4', () => {}, { onDone: (c) => { if (!p.colors.includes(c.slice(0, 7))) { p.colors.push(c.slice(0, 7)); save(); drawPal(); } } })) }, icon('add')))));
    });
    pal.append(h('button.btn.btn-ghost', { type: 'button', style: { justifySelf: 'start' }, onclick: () => { d.palettes.push({ name: 'Palet baru', colors: [] }); save(); drawPal(); } }, icon('add'), 'Tambah palet'));
  };
  drawPal();
  const fonts = h('div.grid3');
  const drawFonts = () => {
    fonts.textContent = '';
    for (const [k, l, s] of [['heading', 'Judul', 30], ['sub', 'Subjudul', 22], ['body', 'Teks isi', 16]]) {
      loadFont(d.fonts[k]);
      const sel = h('select.tx', { onchange: (e) => { d.fonts[k] = e.target.value; save(); drawFonts(); } }, FONTS.map(f => h('option', { value: f.n }, f.n)));
      sel.value = d.fonts[k];
      fonts.append(h('div', { style: { display: 'grid', gap: '8px', padding: '14px', borderRadius: '14px', background: 'var(--field)', border: '1px solid var(--line)' } }, h('small.muted', l), h('div', { style: { fontFamily: fontStack(d.fonts[k]), fontSize: s + 'px', fontWeight: k === 'body' ? 400 : 700, minHeight: '40px' } }, d.fonts[k]), sel));
    }
  };
  drawFonts();
  const logos = h('div.pal-row');
  const drawLogos = async () => {
    logos.textContent = '';
    for (const src of d.logos) {
      const u = await assetURL(src);
      logos.append(h('button', { type: 'button', style: { width: '96px', height: '96px', borderRadius: '14px', border: '1px solid var(--line2)', background: '#fff', display: 'grid', placeItems: 'center', padding: '8px' }, dataset: { tip: 'Klik untuk menghapus' }, onclick: () => { d.logos = d.logos.filter(x => x !== src); save(); drawLogos(); } }, h('img', { src: u, style: { maxWidth: '100%', maxHeight: '100%' } })));
    }
    logos.append(h('button.add', { type: 'button', style: { width: '96px', height: '96px' }, onclick: async () => { for (const f of await pickFiles('image/*', true)) { const a = await addAsset(f, { uploaded: true, name: f.name }); d.logos.push(a.src); } save(); drawLogos(); } }, icon('add')));
  };
  drawLogos();
  main.append(h('div.sec-h', { style: { marginTop: '6px' } }, h('h2', { style: { fontSize: '26px' } }, 'Brand Kit')),
    h('p.muted', { style: { marginTop: '-6px' } }, 'Simpan identitas visual Anda — warna, font, dan logo — lalu pakai di setiap desain.'),
    h('div', { style: { display: 'grid', gap: '16px', maxWidth: '980px' } },
      h('div.brand-box', h('h3', icon('badge'), 'Nama merek'), name),
      h('div.brand-box', h('h3', icon('palette'), 'Warna merek'), pal),
      h('div.brand-box', h('h3', icon('font_download'), 'Font merek'), fonts),
      h('div.brand-box', h('h3', icon('category'), 'Logo'), logos)));
}

// ---------- apps ----------
export function renderApps(mount) {
  const main = homeShell(mount, 'apps');
  document.title = 'Aplikasi — Amatu Design';
  main.append(h('div.sec-h', { style: { marginTop: '6px' } }, h('h2', { style: { fontSize: '26px' } }, 'Aplikasi & alat')),
    h('p.muted', { style: { marginTop: '-6px' } }, 'Alat siap pakai untuk foto, kode QR, PDF, warna, dan AI. Semua berjalan di browser Anda.'),
    toolsGrid(HOME_TOOLS));
}

// ---------- new design dialog ----------
export function newDesignDialog() {
  const UNIT = { px: 1, mm: 96 / 25.4, cm: 96 / 2.54, in: 96 };
  let unit = 'px';
  const w = h('input.tx', { type: 'number', value: 1080, min: 16 }), hh = h('input.tx', { type: 'number', value: 1080, min: 16 });
  const u = h('select.tx', { style: { width: '90px' }, onchange: () => { const k = UNIT[unit] / UNIT[u.value]; w.value = Math.round(w.value * k * 100) / 100; hh.value = Math.round(hh.value * k * 100) / 100; unit = u.value; } }, Object.keys(UNIT).map(x => h('option', { value: x }, x)));
  const list = h('div', { style: { display: 'grid', gap: '2px', maxHeight: '320px', overflow: 'auto', margin: '0 -6px' } },
    SIZES.map(([k, n, ww, hhh, , ic, hint]) => h('button.mi', { type: 'button', onclick: () => { dl.close(); createDesign(ww, hhh, n, k); } }, icon(ic, 'sm'), h('span.ml', n, h('small', hint || `${ww} × ${hhh} px`)))));
  const dl = dialog({
    title: 'Buat desain', width: 480,
    body: h('div', { style: { display: 'grid', gap: '14px' } }, h('b.small', 'Ukuran khusus'), h('div.row', h('label.fx', h('span.fx-l', 'Lebar'), w), h('label.fx', h('span.fx-l', 'Tinggi'), hh), h('label.fx', { style: { flex: '0 0 auto' } }, h('span.fx-l', 'Satuan'), u)), h('b.small', 'Atau pilih ukuran'), list),
    actions: [{ label: 'Batal' }, { label: 'Buat desain baru', kind: 'btn-primary', run: () => { const W = clamp(Math.round(+w.value * UNIT[unit]), 16, 12000), H = clamp(Math.round(+hh.value * UNIT[unit]), 16, 12000); createDesign(W, H, 'Desain tanpa judul', 'custom'); } }],
  });
}
