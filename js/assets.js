// Image assets live in IndexedDB as Blobs; designs reference them as "asset:<id>".
import { Store } from './store.js';
import { uid, loadImage } from './util.js';

const urls = new Map();     // id -> object URL
const pending = new Map();  // id -> Promise<url>

export const isAsset = (s) => typeof s === 'string' && s.startsWith('asset:');

export function assetURLSync(src) {
  if (!src) return '';
  if (!isAsset(src)) return src;
  return urls.get(src.slice(6)) || '';
}
export function assetURL(src) {
  if (!src) return Promise.resolve('');
  if (!isAsset(src)) return Promise.resolve(src);
  const id = src.slice(6);
  if (urls.has(id)) return Promise.resolve(urls.get(id));
  if (!pending.has(id)) pending.set(id, Store.getAsset(id).then(a => {
    const u = a?.blob ? URL.createObjectURL(a.blob) : '';
    if (u) urls.set(id, u);
    return u;
  }));
  return pending.get(id);
}

async function dims(blob) {
  try {
    const b = await createImageBitmap(blob);
    const r = { w: b.width, h: b.height }; b.close?.(); return r;
  } catch {
    const u = URL.createObjectURL(blob);
    try { const im = await loadImage(u); return { w: im.naturalWidth || 400, h: im.naturalHeight || 400 }; } finally { URL.revokeObjectURL(u); }
  }
}

// Store a Blob; returns { src: 'asset:id', w, h }.
export async function addAsset(blob, opt = {}) {
  const id = uid('a');
  let d = { w: opt.w, h: opt.h };
  if (!d.w) d = await dims(blob).catch(() => ({ w: 400, h: 400 }));
  await Store.putAsset({ id, blob, type: blob.type, name: opt.name || 'Gambar', w: d.w, h: d.h, created: Date.now(), uploaded: !!opt.uploaded, kind: opt.kind || 'image' });
  urls.set(id, URL.createObjectURL(blob));
  return { src: 'asset:' + id, w: d.w, h: d.h, id };
}

// Download a remote image into the asset store so exports never hit CORS problems later.
export async function fetchAsset(url, opt = {}) {
  const r = await fetch(url, { mode: 'cors' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const blob = await r.blob();
  if (!/^image\//.test(blob.type)) throw new Error('Bukan gambar');
  return addAsset(blob, opt);
}

export async function assetBlob(src) {
  if (isAsset(src)) return (await Store.getAsset(src.slice(6)))?.blob;
  return (await fetch(src)).blob();
}
