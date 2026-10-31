// Indonesian → English keywords so icon and photo libraries (English-indexed) understand local searches.
const L = {
  rumah: 'home house', hati: 'heart', cinta: 'love heart', bintang: 'star', panah: 'arrow', kopi: 'coffee', teh: 'tea', makanan: 'food', minuman: 'drink',
  kue: 'cake', roti: 'bread', buah: 'fruit', sayur: 'vegetable', bunga: 'flower', daun: 'leaf', pohon: 'tree', alam: 'nature', gunung: 'mountain',
  pantai: 'beach', laut: 'sea ocean', langit: 'sky', awan: 'cloud', hujan: 'rain', matahari: 'sun', bulan: 'moon', cuaca: 'weather', salju: 'snow',
  kota: 'city', jalan: 'road street', mobil: 'car', motor: 'motorcycle', sepeda: 'bicycle', pesawat: 'airplane', kapal: 'ship', kereta: 'train',
  orang: 'people person', wanita: 'woman', pria: 'man', anak: 'child kids', bayi: 'baby', keluarga: 'family', teman: 'friends', tim: 'team',
  kantor: 'office', kerja: 'work', bisnis: 'business', uang: 'money', belanja: 'shopping', toko: 'store shop', diskon: 'discount sale', promo: 'sale',
  sekolah: 'school', buku: 'book', belajar: 'study education', pendidikan: 'education', guru: 'teacher', siswa: 'student', wisuda: 'graduation',
  komputer: 'computer', laptop: 'laptop', ponsel: 'phone', hp: 'phone', teknologi: 'technology', internet: 'internet', kamera: 'camera', musik: 'music',
  olahraga: 'sport', sepak: 'soccer', bola: 'ball', lari: 'running', kesehatan: 'health', dokter: 'doctor', obat: 'medicine', rumahsakit: 'hospital',
  hewan: 'animal', kucing: 'cat', anjing: 'dog', burung: 'bird', ikan: 'fish', kuda: 'horse', kupu: 'butterfly', gajah: 'elephant',
  pesta: 'party', ulang: 'birthday', ultah: 'birthday', pernikahan: 'wedding', nikah: 'wedding', hadiah: 'gift', balon: 'balloon', perayaan: 'celebration',
  natal: 'christmas', lebaran: 'eid', ramadan: 'ramadan', masjid: 'mosque', gereja: 'church', bendera: 'flag', indonesia: 'indonesia',
  wisata: 'travel', liburan: 'holiday vacation', perjalanan: 'travel', hotel: 'hotel', peta: 'map', lokasi: 'location pin', jam: 'clock time', kalender: 'calendar',
  telepon: 'phone call', surel: 'email', email: 'email', pesan: 'message chat', obrolan: 'chat', sosial: 'social media', suka: 'like', centang: 'check',
  silang: 'close cross', tambah: 'plus add', cari: 'search', pengaturan: 'settings', kunci: 'lock key', aman: 'security shield', grafik: 'chart graph',
  data: 'data', statistik: 'statistics', target: 'target goal', ide: 'idea lightbulb', roket: 'rocket', mahkota: 'crown', trofi: 'trophy', medali: 'medal',
  api: 'fire', petir: 'lightning', air: 'water', bumi: 'earth globe', dunia: 'world globe', senyum: 'smile', tertawa: 'laugh', sedih: 'sad',
  makan: 'eat food', masak: 'cooking', restoran: 'restaurant', kafe: 'cafe', pizza: 'pizza', burger: 'burger', es: 'ice cream', nasi: 'rice',
  pakaian: 'clothes fashion', baju: 'shirt', sepatu: 'shoes', tas: 'bag', fesyen: 'fashion', kecantikan: 'beauty', rias: 'makeup', rambut: 'hair',
  properti: 'real estate', bangunan: 'building', arsitektur: 'architecture', interior: 'interior', kamar: 'room bedroom', dapur: 'kitchen',
  tanaman: 'plant', kebun: 'garden', pertanian: 'farm agriculture', padi: 'rice field', sawah: 'rice field', hutan: 'forest', sungai: 'river', danau: 'lake',
  malam: 'night', pagi: 'morning', senja: 'sunset', bintang2: 'stars', abstrak: 'abstract', tekstur: 'texture', pola: 'pattern', latar: 'background',
  emas: 'gold', perak: 'silver', merah: 'red', biru: 'blue', hijau: 'green', kuning: 'yellow', ungu: 'purple', hitam: 'black', putih: 'white',
};
export function translate(q) {
  const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  const out = words.map(w => (L[w] ? L[w].split(' ')[0] : w));
  return out.join(' ');
}
