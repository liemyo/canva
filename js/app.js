// Entry: hash router between the home screens and the editor.
import { installTips, h } from './util.js';
import { Theme, installRefraction } from './theme.js';
import { renderHome, renderProjects, renderTemplates, renderBrand, renderApps, newDesignDialog } from './home.js';
import { openEditor, closeEditor } from './editor/editor.js';
import { openShared } from './export.js';
import { Brand } from './brand.js';
import { E } from './editor/state.js';
import { Panels } from './editor/panels.js';

Theme.apply();
installRefraction();
installTips();
Brand.load();

const app = document.getElementById('app');
let inEditor = false;

async function route() {
  const raw = location.hash.slice(1) || '/';
  const [path, qs] = raw.split('?');
  const params = new URLSearchParams(qs || '');
  const parts = path.split('/').filter(Boolean);
  document.querySelectorAll('.dlg-back, .pop').forEach(n => n.remove());
  if (parts[0] === 'design' && parts[1]) {
    if (inEditor && E.d?.id === parts[1]) return;
    if (inEditor) closeEditor();
    app.textContent = '';
    inEditor = true;
    await openEditor(parts[1], app);
    const panel = sessionStorage.getItem('adesign.openPanel'), sel = sessionStorage.getItem('adesign.select');
    sessionStorage.removeItem('adesign.openPanel'); sessionStorage.removeItem('adesign.select');
    if (sel) E.select(sel, { raw: true });
    if (panel) Panels.open(panel);
    return;
  }
  if (inEditor) { closeEditor(); inEditor = false; app.textContent = ''; }
  if (parts[0] === 's' && parts[1]) return openShared(parts.slice(1).join('/'));
  if (parts[0] === 'new') { location.replace('#/'); setTimeout(newDesignDialog, 50); return; }
  const page = parts[0] || '';
  if (page === 'projects') return renderProjects(app);
  if (page === 'templates') return renderTemplates(app, params);
  if (page === 'brand') return renderBrand(app);
  if (page === 'apps') return renderApps(app);
  return renderHome(app);
}
addEventListener('hashchange', route);
route();

