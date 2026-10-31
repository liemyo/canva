// Generative helpers. Text uses the browser's built-in model when Chrome offers one,
// otherwise Pollinations; Pollinations needs a free personal key (stored only in this browser).
import { h, icon, dialog, toast } from '../util.js';

const KEY = 'adesign.aiKey';
export const aiKey = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
export function setAiKey(v) { try { v ? localStorage.setItem(KEY, v.trim()) : localStorage.removeItem(KEY); } catch {} }

export function askKey() {
  return new Promise(res => {
    const inp = h('input.tx', { type: 'password', placeholder: 'sk_… atau pk_…', value: aiKey(), autocomplete: 'off' });
    dialog({
      title: 'Kunci AI', width: 440,
      body: h('div', { style: { display: 'grid', gap: '12px' } },
        h('p.muted.small', 'Fitur gambar & teks AI memakai layanan Pollinations. Buat kunci gratis, lalu tempel di sini. Kunci hanya disimpan di browser ini.'),
        h('a.btn.btn-ghost', { href: 'https://enter.pollinations.ai/keys', target: '_blank', rel: 'noopener' }, icon('open_in_new'), 'Buat kunci di enter.pollinations.ai'),
        h('label.fx', h('span.fx-l', 'Kunci API'), inp)),
      onclose: (v) => res(v || ''),
      actions: [{ label: 'Hapus kunci', run: () => { setAiKey(''); toast('Kunci dihapus'); return ''; } }, { label: 'Simpan', kind: 'btn-primary', run: () => { setAiKey(inp.value); return inp.value.trim(); } }],
    });
  });
}

async function authFetch(url) {
  let k = aiKey();
  if (!k) k = await askKey();
  if (!k) throw Object.assign(new Error('Kunci AI belum diisi'), { code: 'nokey' });
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + k } });
  if (r.status === 401 || r.status === 403) { setAiKey(''); throw Object.assign(new Error('Kunci AI ditolak'), { code: 'badkey' }); }
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r;
}

// Returns a Blob.
export async function generateImage(prompt, { w = 1024, h = 1024, seed = Math.floor(Math.random() * 1e6), style = '' } = {}) {
  const p = [prompt, style].filter(Boolean).join(', ');
  const r = await authFetch(`https://gen.pollinations.ai/image/${encodeURIComponent(p)}?width=${w}&height=${h}&seed=${seed}&nologo=true&model=flux`);
  return r.blob();
}

export async function writeText(prompt, { tone = 'ramah', kind = 'caption', lang = 'Indonesia' } = {}) {
  const sys = `Kamu copywriter profesional. Tulis ${kind} dalam bahasa ${lang} dengan nada ${tone}. Jawab hanya dengan teksnya, tanpa pembuka, tanpa tanda kutip, tanpa markdown.`;
  const LM = globalThis.LanguageModel;
  if (LM?.availability) {
    try {
      if ((await LM.availability()) === 'available') {
        const s = await LM.create({ initialPrompts: [{ role: 'system', content: sys }] });
        const t = await s.prompt(prompt);
        s.destroy?.();
        if (t) return clean(t);
      }
    } catch {}
  }
  const r = await authFetch(`https://gen.pollinations.ai/text/${encodeURIComponent(prompt)}?system=${encodeURIComponent(sys)}&seed=${Math.floor(Math.random() * 1e6)}`);
  return clean(await r.text());
}
const clean = (t) => t.trim().replace(/^["“]|["”]$/g, '').replace(/\*\*/g, '');
