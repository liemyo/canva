// Brand kit: palettes, typography and logos, persisted in IndexedDB.
import { Store } from './store.js';

const DEF = {
  name: 'Merek saya',
  palettes: [{ name: 'Palet utama', colors: ['#7b3fe4', '#00c4cc', '#ff5fa2', '#16112b', '#f4f1fb'] }],
  fonts: { heading: 'Poppins', sub: 'Poppins', body: 'Inter' },
  logos: [],
};

export const Brand = {
  d: structuredClone(DEF),
  async load() { this.d = { ...structuredClone(DEF), ...(await Store.get('brand', {})) }; return this.d; },
  save() { return Store.set('brand', this.d); },
  colors() { return [...new Set(this.d.palettes.flatMap(p => p.colors))]; },
};
