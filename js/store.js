// IndexedDB persistence: designs, uploaded/inserted assets (as Blobs), folders and settings.

const DB = 'amatu-design', VER = 1;
let dbp;
function db() {
  return dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('designs')) d.createObjectStore('designs', { keyPath: 'id' }).createIndex('updated', 'updated');
      if (!d.objectStoreNames.contains('assets')) d.createObjectStore('assets', { keyPath: 'id' }).createIndex('created', 'created');
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode), r = fn(t.objectStore(store));
    t.oncomplete = () => res(r?.result);
    t.onerror = () => rej(t.error);
  });
}
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const Store = {
  async listDesigns() {
    const d = await db();
    const all = await req(d.transaction('designs').objectStore('designs').getAll());
    return all.sort((a, b) => b.updated - a.updated);
  },
  async getDesign(id) { const d = await db(); return req(d.transaction('designs').objectStore('designs').get(id)); },
  async putDesign(design) { design.updated = Date.now(); return tx('designs', 'readwrite', s => s.put(design)); },
  async deleteDesign(id) { return tx('designs', 'readwrite', s => s.delete(id)); },

  async putAsset(a) { return tx('assets', 'readwrite', s => s.put(a)); },
  async getAsset(id) { const d = await db(); return req(d.transaction('assets').objectStore('assets').get(id)); },
  async listAssets() {
    const d = await db();
    const all = await req(d.transaction('assets').objectStore('assets').getAll());
    return all.filter(a => a.uploaded).sort((a, b) => b.created - a.created);
  },
  async deleteAsset(id) { return tx('assets', 'readwrite', s => s.delete(id)); },

  async get(key, def) { const d = await db(); const v = await req(d.transaction('kv').objectStore('kv').get(key)); return v === undefined ? def : v; },
  async set(key, val) { return tx('kv', 'readwrite', s => s.put(val, key)); },
};
