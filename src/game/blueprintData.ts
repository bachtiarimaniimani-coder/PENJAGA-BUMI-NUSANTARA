export interface TrashItemSpec {
  id: number;
  name: string;
  wave: 1 | 2 | 3;
  direction: 'KIRI' | 'KANAN' | 'ATAS';
  category: 'Organik' | 'Anorganik' | 'B3';
  hint: string;
  colorHex: string;
  shapeType: 'bottle' | 'bag' | 'banana' | 'battery' | 'branch' | 'leaf' | 'can' | 'spray' | 'bulb' | 'veggie' | 'glass' | 'bleach' | 'corn' | 'straw' | 'thermometer';
}

export interface AnagramSpec {
  id: number;
  targetWord: string;
  scrambled: string[];
  meaning: string;
  numeracyQuestion: string;
  numeracyFormula: string;
  options: { label: string; isCorrect: boolean }[];
}

export interface ClawItemSpec {
  id: number;
  name: string;
  targetBin: 'REDUCE' | 'REUSE' | 'RECYCLE';
  description: string;
  numeracyQuestion: string;
  options: { label: string; isCorrect: boolean }[];
  colorHex: string;
}

export interface CitizenQuestSpec {
  id: number;
  npcName: string;
  npcRole: string;
  projectTitle: string;
  position: [number, number]; // x, z on city map
  radarColor: string;
  complaint: string;
  materials: {
    slot: 1 | 2 | 3 | 4;
    name: string;
    isHazardous: boolean;
    hazardReason?: string;
  }[];
  rejectedSlot: 1 | 2 | 3 | 4;
  numeracyQuestion: string;
  options: { label: string; isCorrect: boolean }[];
}

export interface EcosystemZoneSpec {
  id: number;
  npcName: string;
  npcRole: string;
  position: [number, number];
  radarColor: string;
  zoneName: string;
  crisisTitle: string;
  crisisDescription: string;
  correctOption: 'A' | 'B' | 'C';
  alternatives: {
    code: 'A' | 'B' | 'C';
    text: string;
    coinCost: number;
    energyCost: number;
    isBest: boolean;
    impactFeedback: string;
  }[];
  numeracyQuestion: string;
  options: { label: string; isCorrect: boolean }[];
}

export interface RadarIslandSpec {
  id: number;
  islandName: string;
  shortRegion: string;
  regionTitle: string;
  coords: [number, number]; // x, z on archipelago map
  newsSource: string;
  newsHeadline: string;
  newsUrl: string;
  emergencyFact: string;
  correctPillarSlots: [number, number, number]; // [Regulasi, Fisik, Edukasi]
  pillarChoices: {
    pillarName: 'Aturan Pemerintah' | 'Perbaikan Fisik' | 'Edukasi Warga';
    slots: { slotNum: 1 | 2 | 3; text: string }[];
  }[];
  numeracyQuestion: string;
  options: { label: string; isCorrect: boolean }[];
}

export const GAME_IDENTITY = {
  title: 'PENJAGA BUMI NUSANTARA',
  subtitle: 'Merawat Alam Menjaga Masa Depan',
  competitionHeader: 'Lomba Inovasi Game Edukasi PGRI Kabupaten Wonogiri 2026',
  officialHeaderOrg: 'Pemerintah Kabupaten Wonogiri — Persatuan Guru Republik Indonesia (PGRI)',
  developerName: 'BACHTIAR IMANI',
  developerBranch: 'PGRI CABANG GIRIMARTO',
  targetStudents: 'Fase C (Kelas V & VI SD)',
  subject: 'Pendidikan Agama Islam dan Budi Pekerti (PAI & BP)',
  mainTheme: 'Tanggung Jawab Manusia Menjaga Lingkungan sebagai Amanah Penjaga Bumi (Penjaga Bumi Cilik)',
  logoPgri: 'https://i.imgur.com/5isghy7.png',
  logoGame: 'https://i.imgur.com/9PLallN.png',
  logoWonogiri: 'https://i.imgur.com/RVQBxN6.png',
  curriculum: {
    kelas5: {
      bab: 'Kelas V (Bab 3: Aku Anak Saleh)',
      summary: 'Hakikat manusia sebagai pemelihara di bumi dan tugas menjaga lingkungan sekolah, rumah, dan masyarakat.',
    },
    kelas6: {
      bab: 'Kelas VI (Bab 8: Peduli Lingkungan)',
      summary: 'Konsep lingkungan biotik dan abiotik, kepedulian lingkungan dalam Islam, serta aksi nyata pencegahan kerusakan alam.',
    },
    cp: 'Peserta didik memahami tanggung jawab manusia sebagai Penjaga Bumi Cilik dalam merawat lingkungan biotik dan abiotik, menghindari kebiasaan boros, mengutamakan gotong royong, serta memilih solusi paling minim dampak buruknya bagi kelestarian alam.',
  },
};

export const PROLOGUE_BABAK = [
  {
    id: 1,
    title: 'Babak 1: Keseimbangan Bumi Nusantara',
    sceneDirection: 'Kamera Melayang di Atas Panorama Nusantara — Pemandangan Gunung & Sungai',
    cameraMode: 'panorama',
    getText: (_playerName: string) =>
      'Subhanallah... Pandanglah bumi Nusantara yang terbentang indah. Gunung-gunung hijau menjulang, sungai-sungai mengalir jernih, dan lautan biru memeluk ribuan pulau dengan penuh berkah. Segala ciptaan Tuhan ini dianugerahkan dalam keseimbangan yang sempurna.',
  },
  {
    id: 2,
    title: 'Babak 2: Bumi yang Terluka',
    sceneDirection: 'Kamera Menukik Tajam, Tanah Retak, Warna Kelabu, Gemuruh Bumi',
    cameraMode: 'crisis',
    getText: (_playerName: string) =>
      'Namun, lihatlah apa yang terjadi... Tangan-tangan manusia yang serakah dan lalai mulai mendatangkan kerusakan alam. Sampah plastik menumpuk, pohon-pohon ditebang sembarangan, dan sumber air tercemar. Bumi merintih menahan beban pemborosan ini...',
  },
  {
    id: 3,
    title: 'Babak 3: Panggilan Amanah Penjaga Bumi',
    sceneDirection: 'Kamera Mengorbit ke Karakter Murid, Tunas Hijau Bercahaya Turun',
    cameraMode: 'hero',
    getText: (playerName: string) =>
      `Ingatlah anak saleh, kita dihadirkan di bumi bukan untuk merusak, melainkan memikul amanah mulia sebagai Penjaga Bumi. Wahai ${playerName}, bumi memanggil kepedulianmu! Mulailah dari langkah paling dekat di halaman depan rumahmu sendiri. Jadilah Penjaga Bumi Nusantara!`,
  },
];

export const JOURNAL_TRANSMISSIONS: Record<number, { header: string; getText: (name: string) => string }> = {
  2: {
    header: '[TRANSMISI JURNAL PENJAGA BUMI - CATATAN 01]',
    getText: (name: string) =>
      `"Langkah awalmu luar biasa, ${name}! Halaman depan rumah kini telah bersih dan sampahnya terpilah rapi. Namun ingatlah, memilah saja belum cukup jika kita terus menimbun barang baru setiap hari. Masuklah ke ruang baca, temukan 'Rahasia 3R' untuk mencegah kebiasaan hidup boros!"`,
  },
  3: {
    header: '[TRANSMISI JURNAL PENJAGA BUMI - CATATAN 02]',
    getText: (_name: string) =>
      `"Satu per satu rahasia berhasil kamu pecahkan. Pemahaman penting kini ada di pikiranmu. Namun ilmu akan sia-sia jika tidak dipraktikkan. Pintu gudang logistik telah dibuka. Kendalikan Mesin Capit Pengolah Sampah, buktikan aksimu dengan tepat!"`,
  },
  4: {
    header: '[TRANSMISI JURNAL PENJAGA BUMI - CATATAN 03]',
    getText: (_name: string) =>
      `"Barang-barang di sekolah telah terselamatkan dari pemborosan. Tapi dengarlah... di luar pagar sekolah, warga kota sedang bingung mengolah barang bekas. Mari melangkah ke jalanan kota! Waktunya bergotong royong dan merakit karya bermanfaat untuk sesama."`,
  },
  5: {
    header: '[TRANSMISI JURNAL PENJAGA BUMI - CATATAN 04]',
    getText: (_name: string) =>
      `"Karyamu telah membuat warga kota tersenyum lega. Namun lihatlah di bukit, sungai, sawah, pantai bakau, dan taman kolam desa, alam membutuhkan pertolongan kita! Mari berpetualang menemui kelima penjaga alam dan pilih cara paling baik untuk merawat bumi!"`,
  },
  6: {
    header: '[TRANSMISI JURNAL PENJAGA BUMI - CATATAN 05]',
    getText: (_name: string) =>
      `"Keputusan bijakmu berhasil menenangkan ancaman bencana alam setempat. Namun pandanglah cakrawala yang lebih luas! Satelit pemantau menangkap lima sinyal darurat di berbagai penjuru Nusantara. Masuklah ke ruang pusat komando, aktifkan Radar Nusantara, dan rancang strategi hebat untuk memulihkan negeri!"`,
  },
  7: {
    header: '[TRANSMISI JURNAL PENJAGA BUMI - CATATAN AKHIR]',
    getText: (_name: string) =>
      `"Alhamdulillah! Lima titik radar kini bersinar hijau terang benderang. Langit kembali bersih, perairan kembali jernih, dan rimba bernapas lega. Seluruh pulau Nusantara tersambung dalam keharmonisan alam. Kamu telah membuktikan hakikat sejati seorang Penjaga Bumi Cilik: beriman, peduli, cerdas, dan merawat bumi demi masa depan yang lestari!"`,
  },
};

export const getRemedialEmpathyText = (playerName: string) =>
  `Jangan berkecil hati, ${playerName}. Menjaga bumi memang membutuhkan ketekunan dan latihan. Tarik napas sejenak, ingat kembali pelajaran kita, dan mari coba sekali lagi bersama-sama!`;

export const LEVEL_METADATA = [
  {
    level: 1,
    name: 'Detektif Sampah',
    bloomCode: 'C1',
    bloomLabel: 'Mengenali / Mengingat',
    domain: 'Halaman Depan Rumah',
    cameraView: 'Kamera dari Atas (Halaman Depan Rumah)',
    miniMapActive: false,
    maxPoints: 15,
    npcName: 'Pak Guru Ilyas',
    npcRole: 'Guru PAI & BP',
    getOpeningDialog: (name: string) =>
      `Assalamu’alaikum, ${name}! Menjaga kebersihan rumah dan lingkungan adalah bukti nyata iman serta rasa syukur kita. Lihatlah dari atas halaman depan rumah ini, banyak sekali sampah yang berserakan—mulai dari sisa makanan organik, plastik anorganik, hingga limbah berbahaya B3. Mari kita pilah dan masukkan setiap sampah ke tong yang tepat!`,
    reflection:
      'Apakah selama ini aku sudah rajin membersihkan halaman rumahku dan membuang sampah pada tempat yang benar?',
    actionPlans: [
      'Memungut sampah yang berserakan di halaman depan rumah dan memilahnya.',
      'Menyiapkan 2 tempat sampah terpisah di rumah (Organik & Anorganik).',
      'Memilah sisa sayur dan kulit buah di rumah untuk bahan kompos.',
    ],
  },
  {
    level: 2,
    name: 'Rahasia 3R',
    bloomCode: 'C2',
    bloomLabel: 'Memahami',
    domain: 'Ruang Baca dan Taman Literasi 3R',
    cameraView: 'Kamera dari Atas (Ruang Baca dan Taman Literasi 3R)',
    miniMapActive: false,
    maxPoints: 15,
    npcName: 'Kak Shofi',
    npcRole: 'Duta Lingkungan Sekolah',
    getOpeningDialog: (name: string) =>
      `Hebat sekali, halaman depan rumah kini sudah bersih berkat ketelitianmu! Sekarang lihatlah posisi kita di Ruang Baca dan Taman Literasi 3R ini, ${name}. Tumpukan sampah akan terus bertambah jika kita tidak tahu cara mengendalikannya. Pecahkan teka-teki balok kata 3R di meja baca ini, pahami maknanya, dan hitung dampak kebaikannya!`,
    reflection:
      'Berapa banyak barang sekali pakai yang kubuang setiap hari? Mengapa kita tidak boleh membiasakan hidup boros? Apakah gaya hidupku sudah cukup hemat?',
    actionPlans: [
      'Membawa botol minum (tumbler) sendiri dari rumah setiap hari.',
      'Menolak kantong plastik saat belanjaan kecil bisa dipegang tangan.',
      'Memakai sisi kosong kertas bekas untuk coretan hitung belajar.',
    ],
  },
  {
    level: 3,
    name: 'Operasi Mesin Capit 3R',
    bloomCode: 'C3',
    bloomLabel: 'Menerapkan',
    domain: 'Gudang Logistik & Mesin Capit 3R',
    cameraView: 'Kamera dari Atas (Gudang Mesin Capit 3R)',
    miniMapActive: false,
    maxPoints: 15,
    npcName: 'Pak Joko',
    npcRole: 'Petugas Sarana Sekolah',
    getOpeningDialog: (name: string) =>
      `Halo, ${name}! Lihatlah dari atas area Gudang Logistik Sekolah tempat kamu berdiri ini. Di sepanjang sabuk konveyor, banyak sekali barang yang baru dikumpulkan. Jika dibiarkan menumpuk, tentu terjadi pemborosan besar. Setelah prolog ini selesai, kendalikan Mesin Capit 3R untuk menjepit dan menjatuhkan barang tepat ke tong REDUCE, REUSE, atau RECYCLE!`,
    reflection:
      'Memilah barang butuh ketelitian dan kesabaran seperti mengendalikan mesin capit. Sudahkah aku bersungguh-sungguh menjaga sarana dan fasilitas umum di sekolahku?',
    actionPlans: [
      'Menutup rapat keran air tempat wudu yang masih menetes.',
      'Mematikan kipas angin dan lampu saat ruang kelas sedang kosong.',
      'Membuat pot tanaman hias dari kaleng atau botol bekas.',
    ],
  },
  {
    level: 4,
    name: 'Kreasi Karya Kota Lestari',
    bloomCode: 'C4',
    bloomLabel: 'Menganalisis',
    domain: 'Kawasan Pemukiman & Fasilitas Publik Kota',
    cameraView: 'Top-Down Isometric 2.5D',
    miniMapActive: true,
    maxPoints: 20,
    npcName: 'Bu Lurah Sekar',
    npcRole: 'Pamong Warga Kota Wonogiri',
    getOpeningDialog: (name: string) =>
      `Selamat datang di lingkungan kami, ${name}! Warga kota menghadapi masalah tumpukan barang bekas. Namun, niat baik saja tidak cukup. Sebagai Penjaga Bumi yang cerdas, dengarkan keluhan warga dengan cermat, seleksi bahan yang aman, dan tolak keras bahan bekas yang beracun atau berbahaya. Mari bergotong royong!`,
    reflection:
      'Membantu sesama bisa dimulai dari hal sederhana di sekitar kita. Barang bekas ternyata bisa menjadi perabot bermanfaat jika diolah dengan cermat. Apakah tindakanku sudah membawa kebaikan dan rasa aman bagi orang lain?',
    actionPlans: [
      'Mengajak teman sekelas membuat prakarya bermanfaat dari kardus bekas.',
      'Mengganti kantong kresek belanja ibu di rumah dengan tas belanja kain.',
      'Menyumbangkan pakaian yang masih layak pakai kepada yang membutuhkan.',
    ],
  },
  {
    level: 5,
    name: 'Penjaga Ekosistem',
    bloomCode: 'C5',
    bloomLabel: 'Mengevaluasi',
    domain: '5 Ekosistem Desa Nusantara',
    cameraView: 'Top-Down Isometric 2.5D',
    miniMapActive: true,
    maxPoints: 15,
    npcName: 'Pak Darmo',
    npcRole: 'Penjaga Alam Senior',
    getOpeningDialog: (name: string) =>
      `Selamat datang di pos penjagaan alam, ${name}! Ada 5 ekosistem yang sedang terganggu: bukit hijau, sungai, sawah, pantai bakau, dan taman kolam. Jalanilah area ini dengan posisi penjaga yang tersebar acak, temui kelima penjaga alam, lalu bantu pilih cara paling aman bagi bumi!`,
    reflection:
      'Merawat alam membutuhkan kesabaran dan pilihan yang tepat. Tidak semua cara cepat itu baik untuk tumbuhan dan hewan. Apakah aku sudah memilih cara yang aman dan ramah alam?',
    actionPlans: [
      'Merawat dan menyiram tanaman di pekarangan rumah setiap sore.',
      'Tidak membuang sisa minyak jelantah atau sabun pekat ke parit.',
      'Menegur dengan santun teman yang sengaja merusak tanaman sekolah.',
    ],
  },
  {
    level: 6,
    name: 'Radar Nusantara',
    bloomCode: 'C6',
    bloomLabel: 'Mencipta',
    domain: 'Pusat Kendali Satelit Nusantara',
    cameraView: 'Satellite Orbital View',
    miniMapActive: true,
    maxPoints: 20,
    npcName: 'Ibu Melati',
    npcRole: 'Kepala Satelit Pemantau Bumi',
    getOpeningDialog: (name: string) =>
      `Selamat datang di ruang komando utama, ${name}! Layar satelit kita mendeteksi 5 titik darurat di Indonesia: Waduk Gajah Mungkur Wonogiri (Jateng), Gambut Siak–Pelalawan (Riau) & Tanjab Timur (Jambi), Koridor Tanjung Puting–Sungai Wain (Kalimantan), Pesisir Pemuteran–Nusa Penida (Bali) & Gili Matra–Komodo (NTB/NTT), serta Mangrove Teluk Youtefa Jayapura & Teluk Bintuni (Papua). Rakitlah masterplan Aturan Pemerintah, Perbaikan Fisik, dan Edukasi Warga!`,
    reflection:
      'Aku adalah bagian utuh dari Nusantara. Masalah lingkungan di berbagai pulau Indonesia adalah panggilan bagi kepedulianku. Kebaikan apa yang ingin kuberikan bagi masa depan negeriku?',
    actionPlans: [
      'Membuat poster ajakan peduli alam untuk ditempel di mading sekolah.',
      'Menulis janji pribadi menjaga kebersihan alam di buku catatan.',
      'Aktif mengikuti kegiatan kerja bakti di lingkungan tempat tinggal.',
    ],
  },
];

// LEVEL 1: 15 OBJEK SAMPAH (Kanan -> Kanan -> Kiri -> Atas -> Kiri -> Kiri -> Kanan -> Atas -> Atas -> Kiri -> Kanan -> Atas -> Kiri -> Kanan -> Atas)
export const LEVEL_1_ITEMS: TrashItemSpec[] = [
  { id: 1, name: 'Botol Plastik Air Mineral', wave: 1, direction: 'KANAN', category: 'Anorganik', hint: 'Plastik buatan pabrik yang butuh ratusan tahun terurai.', colorHex: '#38bdf8', shapeType: 'bottle' },
  { id: 2, name: 'Kantong Kresek Plastik', wave: 1, direction: 'KANAN', category: 'Anorganik', hint: 'Kemasan plastik tipis anorganik yang dapat didaur ulang.', colorHex: '#60a5fa', shapeType: 'bag' },
  { id: 3, name: 'Kulit Pisang Sisa Makanan', wave: 1, direction: 'KIRI', category: 'Organik', hint: 'Bahan alami sisa buah yang mudah membusuk jadi penyubur tanah alami.', colorHex: '#facc15', shapeType: 'banana' },
  { id: 4, name: 'Baterai Jam Dinding Bekas', wave: 1, direction: 'ATAS', category: 'B3', hint: 'Mengandung logam berat beracun yang mencemari air tanah.', colorHex: '#ef4444', shapeType: 'battery' },
  { id: 5, name: 'Ranting Pohon Patah', wave: 1, direction: 'KIRI', category: 'Organik', hint: 'Bagian tumbuhan alami yang terurai kembali ke tanah.', colorHex: '#a16207', shapeType: 'branch' },
  { id: 6, name: 'Daun Kering Berserakan', wave: 2, direction: 'KIRI', category: 'Organik', hint: 'Bahan organik utama pembuat pupuk kompos sekolah.', colorHex: '#ca8a04', shapeType: 'leaf' },
  { id: 7, name: 'Kaleng Minuman Soda', wave: 2, direction: 'KANAN', category: 'Anorganik', hint: 'Logam aluminium anorganik yang bisa dilebur kembali.', colorHex: '#94a3b8', shapeType: 'can' },
  { id: 8, name: 'Botol Semprot Obat Nyamuk', wave: 2, direction: 'ATAS', category: 'B3', hint: 'Kemasan bertekanan dengan sisa zat kimia beracun (B3).', colorHex: '#f87171', shapeType: 'spray' },
  { id: 9, name: 'Lampu Bohlam Rusak', wave: 2, direction: 'ATAS', category: 'B3', hint: 'Limbah berbahaya yang mengandung uap logam dan kaca tajam.', colorHex: '#fb7185', shapeType: 'bulb' },
  { id: 10, name: 'Sisa Sayuran Kantin', wave: 2, direction: 'KIRI', category: 'Organik', hint: 'Sisa pangan alami yang cepat terurai menjadi kompos.', colorHex: '#22c55e', shapeType: 'veggie' },
  { id: 11, name: 'Pecahan Botol Kaca', wave: 3, direction: 'KANAN', category: 'Anorganik', hint: 'Bahan kaca anorganik yang dapat dilebur ulang di pabrik.', colorHex: '#2dd4bf', shapeType: 'glass' },
  { id: 12, name: 'Botol Bekas Pemutih Baju', wave: 3, direction: 'ATAS', category: 'B3', hint: 'Wadah cairan kimia keras korosif yang termasuk limbah B3.', colorHex: '#e11d48', shapeType: 'bleach' },
  { id: 13, name: 'Bonggol Jagung Rebus', wave: 3, direction: 'KIRI', category: 'Organik', hint: 'Serat tumbuhan alami yang membusuk menjadi penyubur tanah alami.', colorHex: '#eab308', shapeType: 'corn' },
  { id: 14, name: 'Sedotan Plastik Bekas', wave: 3, direction: 'KANAN', category: 'Anorganik', hint: 'Plastik buatan pabrik sekali pakai kategori anorganik.', colorHex: '#3b82f6', shapeType: 'straw' },
  { id: 15, name: 'Termometer Air Raksa Retak', wave: 3, direction: 'ATAS', category: 'B3', hint: 'Mengandung merkuri cair sangat berbahaya bagi makhluk hidup.', colorHex: '#dc2626', shapeType: 'thermometer' },
];

// LEVEL 2: 5 KATA ANAGRAM & NUMERASI (KOMPOS -> REDUCE -> AMANAH -> RECYCLE -> REUSE)
export const LEVEL_2_ANAGRAMS: AnagramSpec[] = [
  {
    id: 1,
    targetWord: 'KOMPOS',
    scrambled: ['P', 'M', 'O', 'K', 'O', 'S'],
    meaning: 'Pupuk alami dari pembusukan sisa daun dan bahan organik yang menyuburkan tanah sekolah.',
    numeracyQuestion: 'Sekolah mengolah daun kering menjadi 3 kg pupuk kompos setiap bulan. Berapa total pupuk kompos yang dihasilkan selama 4 bulan?',
    numeracyFormula: '3 kg × 4 bulan = 12 kg',
    options: [
      { label: 'Menghasilkan 12 kg pupuk penyubur tanah alami', isCorrect: true },
      { label: 'Menghasilkan 10 kg pupuk penyubur tanah alami', isCorrect: false },
      { label: 'Menghasilkan 15 kg pupuk penyubur tanah alami', isCorrect: false },
    ],
  },
  {
    id: 2,
    targetWord: 'REDUCE',
    scrambled: ['E', 'D', 'C', 'U', 'R', 'E'],
    meaning: 'Tindakan membatasi pemakaian barang sekali pakai demi mencegah timbulan sampah baru dan menjauhi boros.',
    numeracyQuestion: 'Jika seorang siswa menolak 2 sedotan plastik setiap hari, berapa jumlah sedotan plastik yang berhasil dicegah selama 7 hari?',
    numeracyFormula: '2 sedotan × 7 hari = 14 sedotan',
    options: [
      { label: 'Mencegah 12 batang sampah sedotan plastik', isCorrect: false },
      { label: 'Mencegah 14 batang sampah sedotan plastik', isCorrect: true },
      { label: 'Mencegah 16 batang sampah sedotan plastik', isCorrect: false },
    ],
  },
  {
    id: 3,
    targetWord: 'AMANAH',
    scrambled: ['A', 'H', 'M', 'A', 'N', 'A'],
    meaning: 'Tanggung jawab moral yang diemban manusia sebagai pemelihara bumi untuk menjaga kelestarian alam dan lingkungan.',
    numeracyQuestion: 'Dari 10 bibit pohon yang diamanahkan kepada kelasmu, 9 pohon tumbuh subur terawat. Berapa persentase keberhasilan amanah tersebut?',
    numeracyFormula: '(9 / 10) × 100% = 90%',
    options: [
      { label: 'Sebesar 80% pohon tumbuh subur terawat', isCorrect: false },
      { label: 'Sebesar 85% pohon tumbuh subur terawat', isCorrect: false },
      { label: 'Sebesar 90% pohon tumbuh subur terawat', isCorrect: true },
    ],
  },
  {
    id: 4,
    targetWord: 'RECYCLE',
    scrambled: ['C', 'E', 'C', 'L', 'R', 'Y', 'E'],
    meaning: 'Tindakan mengolah limbah padat anorganik melalui proses daur ulang industri agar menjadi bahan baku bermanfaat.',
    numeracyQuestion: 'Bank sampah sekolah menyetorkan 8 kg botol plastik untuk didaur ulang dengan nilai Rp2.000 per kg. Berapa dana tabungan kelas yang terkumpul?',
    numeracyFormula: '8 kg × Rp2.000 = Rp16.000',
    options: [
      { label: 'Terkumpul dana kas kelas sebesar Rp14.000', isCorrect: false },
      { label: 'Terkumpul dana kas kelas sebesar Rp16.000', isCorrect: true },
      { label: 'Terkumpul dana kas kelas sebesar Rp18.000', isCorrect: false },
    ],
  },
  {
    id: 5,
    targetWord: 'REUSE',
    scrambled: ['S', 'U', 'E', 'E', 'R'],
    meaning: 'Tindakan memanfaatkan kembali wadah atau kemasan yang masih kokoh untuk keperluan lain tanpa meleburnya di pabrik.',
    numeracyQuestion: 'Ada 12 toples kaca bersih di dapur sekolah: 4 dipakai menyimpan kapur dan 5 dipakai wadah manik prakarya. Berapa sisa toples yang siap dipakai lagi?',
    numeracyFormula: '12 - (4 + 5) = 3 toples',
    options: [
      { label: 'Tersisa 3 toples kaca bersih siap pakai', isCorrect: true },
      { label: 'Tersisa 4 toples kaca bersih siap pakai', isCorrect: false },
      { label: 'Tersisa 5 toples kaca bersih siap pakai', isCorrect: false },
    ],
  },
];

// LEVEL 3: 6 BARANG MESIN CAPIT 3R (REUSE -> REDUCE -> REDUCE -> RECYCLE -> REUSE -> RECYCLE)
export const LEVEL_3_CLAW_ITEMS: ClawItemSpec[] = [
  {
    id: 1,
    name: 'Ban Mobil Bekas Layak Pakai',
    targetBin: 'REUSE',
    description: 'Ban karet yang masih utuh dan kokoh dapat langsung dicat ulang menjadi kursi taman sekolah tanpa dilebur.',
    numeracyQuestion: 'Gudang memiliki 12 ban mobil bekas. Jika 1 set kursi taman membutuhkan 3 ban, berapa set kursi taman yang dapat dibuat?',
    options: [
      { label: 'Menghasilkan 3 set kursi taman sekolah', isCorrect: false },
      { label: 'Menghasilkan 4 set kursi taman sekolah', isCorrect: true },
      { label: 'Menghasilkan 6 set kursi taman sekolah', isCorrect: false },
    ],
    colorHex: '#334155',
  },
  {
    id: 2,
    name: 'Kantong Belanja Kain (Tote Bag)',
    targetBin: 'REDUCE',
    description: 'Tas kain berulang pakai untuk mencegah timbulan sampah kantong kresek sekali pakai sejak awal belanja.',
    numeracyQuestion: 'Satu tas belanja kain mencegah 4 kantong plastik setiap pekan. Berapa kantong plastik yang berhasil dicegah selama 4 pekan?',
    options: [
      { label: 'Mencegah 12 lembar sampah kantong plastik', isCorrect: false },
      { label: 'Mencegah 16 lembar sampah kantong plastik', isCorrect: true },
      { label: 'Mencegah 20 lembar sampah kantong plastik', isCorrect: false },
    ],
    colorHex: '#10b981',
  },
  {
    id: 3,
    name: 'Botol Minum Isi Ulang (Tumbler)',
    targetBin: 'REDUCE',
    description: 'Wadah minum pribadi yang mengurangi pembelian botol air kemasan sekali pakai di sekolah.',
    numeracyQuestion: 'Membawa tumbler menghemat 2 botol plastik setiap hari sekolah. Dalam 20 hari sekolah, berapa botol plastik yang berhasil dikurangi?',
    options: [
      { label: 'Mengurangi 40 sampah botol plastik baru', isCorrect: true },
      { label: 'Mengurangi 30 sampah botol plastik baru', isCorrect: false },
      { label: 'Mengurangi 22 sampah botol plastik baru', isCorrect: false },
    ],
    colorHex: '#06b6d4',
  },
  {
    id: 4,
    name: 'Kaleng Minuman Penyok',
    targetBin: 'RECYCLE',
    description: 'Kaleng aluminium yang sudah penyok tidak bisa dipakai langsung, tetapi harus dilebur ulang di pabrik daur ulang.',
    numeracyQuestion: 'Mendaur ulang aluminium menghemat 95% energi dibanding menambang bijih baru. Berapa persen energi yang dibutuhkan proses daur ulang tersebut?',
    options: [
      { label: 'Hanya membutuhkan 15% energi pengolahan', isCorrect: false },
      { label: 'Hanya membutuhkan 10% energi pengolahan', isCorrect: false },
      { label: 'Hanya membutuhkan 5% energi pengolahan', isCorrect: true },
    ],
    colorHex: '#f59e0b',
  },
  {
    id: 5,
    name: 'Botol Kaca Bekas Sirup (Bersih)',
    targetBin: 'REUSE',
    description: 'Botol kaca tebal yang sudah dicuci bersih dapat langsung digunakan kembali sebagai wadah air atau vas bunga meja.',
    numeracyQuestion: 'Kantin memanfaatkan kembali 5 botol kaca sirup sehingga tidak perlu membeli vas baru seharga Rp15.000 per buah. Berapa total penghematannya?',
    options: [
      { label: 'Menghemat biaya sekolah sebesar Rp65.000', isCorrect: false },
      { label: 'Menghemat biaya sekolah sebesar Rp75.000', isCorrect: true },
      { label: 'Menghemat biaya sekolah sebesar Rp85.000', isCorrect: false },
    ],
    colorHex: '#14b8a6',
  },
  {
    id: 6,
    name: 'Kardus & Kertas Pembungkus Rusak',
    targetBin: 'RECYCLE',
    description: 'Kardus yang sudah robek dan lembek dikirim ke pabrik kertas untuk diolah menjadi bubur kertas daur ulang.',
    numeracyQuestion: 'Setiap 50 kg kertas yang didaur ulang menyelamatkan 1 pohon dewasa. Jika terkumpul 150 kg kardus rusak, berapa pohon yang selamat?',
    options: [
      { label: 'Menyelamatkan 3 pohon peneduh dewasa', isCorrect: true },
      { label: 'Menyelamatkan 4 pohon peneduh dewasa', isCorrect: false },
      { label: 'Menyelamatkan 5 pohon peneduh dewasa', isCorrect: false },
    ],
    colorHex: '#d97706',
  },
];

// LEVEL 4: 5 NPC WARGA KOTA LESTARI (Bahan Pengecoh Berbahaya: Slot 3 -> Slot 1 -> Slot 3 -> Slot 2 -> Slot 4)
export const LEVEL_4_CITIZENS: CitizenQuestSpec[] = [
  {
    id: 1,
    npcName: 'Pak RT Harjo',
    npcRole: 'Ketua RT Kampung Hijau',
    projectTitle: 'Kursi Taman Daur Ulang',
    position: [-14, -10],
    radarColor: '#facc15',
    complaint: 'Bapak ingin merakit kursi taman warga dari barang bekas yang kuat dan aman. Pilih semua bahan yang sesuai dan aman untuk membuat Kursi Taman Daur Ulang!',
    rejectedSlot: 3,
    materials: [
      { slot: 1, name: 'Ban Karet Mobil Bekas Utuh', isHazardous: false },
      { slot: 2, name: 'Papan Kayu Palet Halus', isHazardous: false },
      { slot: 3, name: 'Kaleng Bekas Racun Rumput Kimia', isHazardous: true, hazardReason: 'Kaleng bekas racun rumput mengandung zat beracun berbahaya yang membahayakan kulit dan pernapasan warga!' },
      { slot: 4, name: 'Tali Tambang Sabut Kelapa Kuat', isHazardous: false },
    ],
    numeracyQuestion: 'Tersedia 10 ban bekas dan 6 papan kayu. Jika 1 kursi taman membutuhkan 2 ban dan 1 papan kayu, berapa jumlah maksimal kursi yang dapat dirakit?',
    options: [
      { label: 'Maksimal 5 kursi taman warga dapat dirakit', isCorrect: true },
      { label: 'Maksimal 6 kursi taman warga dapat dirakit', isCorrect: false },
      { label: 'Maksimal 8 kursi taman warga dapat dirakit', isCorrect: false },
    ],
  },
  {
    id: 2,
    npcName: 'Bu Nisa Guru TK',
    npcRole: 'Pendidik PAUD Tunas Mulia',
    projectTitle: 'Tempat Pensil Meja Cantik',
    position: [14, -10],
    radarColor: '#38bdf8',
    complaint: 'Ibu ingin membuat tempat pensil untuk adik-adik TK. Pilih semua bahan yang sesuai dan aman agar jari anak-anak tidak terluka saat memakainya!',
    rejectedSlot: 1,
    materials: [
      { slot: 1, name: 'Potongan Pelat Seng Berkarat Tajam', isHazardous: true, hazardReason: 'Pelat seng tajam dan berkarat dapat melukai tangan anak-anak serta memicu infeksi tetanus!' },
      { slot: 2, name: 'Tabung Karton Bekas Tisu Gulung', isHazardous: false },
      { slot: 3, name: 'Kertas Kado Bekas Bermotif Batik', isHazardous: false },
      { slot: 4, name: 'Lem Sagu Ramah Anak Tidak Berbau', isHazardous: false },
    ],
    numeracyQuestion: 'Ada 72 pensil warna yang akan dimasukkan sama rata ke dalam beberapa tempat pensil. Jika tiap tempat pensil memuat 18 pensil, berapa tempat pensil yang dibutuhkan?',
    options: [
      { label: 'Membutuhkan 3 buah tempat pensil meja', isCorrect: false },
      { label: 'Membutuhkan 4 buah tempat pensil meja', isCorrect: true },
      { label: 'Membutuhkan 6 buah tempat pensil meja', isCorrect: false },
    ],
  },
  {
    id: 3,
    npcName: 'Mas Bagas Petugas Kurir',
    npcRole: 'Relawan Logistik Warga',
    projectTitle: 'Rak Sepatu Bersekat',
    position: [-16, 12],
    radarColor: '#22c55e',
    complaint: 'Mas Bagas ingin merakit kardus paket bekas menjadi rak sepatu pos ronda. Pilih semua bahan yang sesuai dan kokoh untuk membuat Rak Sepatu Bersekat!',
    rejectedSlot: 3,
    materials: [
      { slot: 1, name: 'Lembaran Kardus Paket Gelombang Tebal', isHazardous: false },
      { slot: 2, name: 'Lakban Kertas Cokelat Perekat Sudut', isHazardous: false },
      { slot: 3, name: 'Pecahan Cermin Kaca Lemari Rias Retak', isHazardous: true, hazardReason: 'Pecahan cermin kaca retak sangat tajam dan berbahaya jika terinjak kaki di pos ronda!' },
      { slot: 4, name: 'Karton Pembatas Sekat Sepatu Kokoh', isHazardous: false },
    ],
    numeracyQuestion: 'Satu lembar kardus tebal dapat dibuat menjadi 2 sekat sepatu. Jika pos ronda membutuhkan 18 sekat sepatu, berapa lembar kardus tebal yang diperlukan?',
    options: [
      { label: 'Memerlukan 8 lembar kardus paket tebal', isCorrect: false },
      { label: 'Memerlukan 9 lembar kardus paket tebal', isCorrect: true },
      { label: 'Memerlukan 12 lembar kardus paket tebal', isCorrect: false },
    ],
  },
  {
    id: 4,
    npcName: 'Mbah Tejo Petani Kota',
    npcRole: 'Penggerak Kebun Sayur Warga',
    projectTitle: 'Pot Gantung Hidroponik',
    position: [16, 12],
    radarColor: '#f97316',
    complaint: 'Mbah ingin menanam sawi sehat di pagar kampung. Pilih semua bahan yang sesuai dan bebas bahan beracun untuk membuat Pot Gantung Hidroponik!',
    rejectedSlot: 2,
    materials: [
      { slot: 1, name: 'Botol Plastik Air Mineral Ukuran Besar', isHazardous: false },
      { slot: 2, name: 'Jeriken Bekas Bensin Minyak Tanah', isHazardous: true, hazardReason: 'Jeriken bekas bensin mengandung sisa minyak beracun yang meracuni akar sayuran pangan warga!' },
      { slot: 3, name: 'Sumbu Kain Flanel Penyerap Air Nutrisi', isHazardous: false },
      { slot: 4, name: 'Media Tanam Arang Sekam Padi Alami', isHazardous: false },
    ],
    numeracyQuestion: 'Mbah Tejo memasang 8 deret pot gantung, dan setiap deret berisi 3 pot bibit sayur sawi. Berapa total bibit sayur sawi yang ditanam?',
    options: [
      { label: 'Sebanyak 21 bibit sayur sawi hijau segar', isCorrect: false },
      { label: 'Sebanyak 24 bibit sayur sawi hijau segar', isCorrect: true },
      { label: 'Sebanyak 27 bibit sayur sawi hijau segar', isCorrect: false },
    ],
  },
  {
    id: 5,
    npcName: 'Dek Maya Pelajar SD',
    npcRole: 'Penggerak Pojok Kreasi Siswa',
    projectTitle: 'Tote Bag Jeans Kuat',
    position: [0, 16],
    radarColor: '#ec4899',
    complaint: 'Aku ingin menjahit celana jeans bekas menjadi tas buku sekolah. Pilih semua bahan yang sesuai dan aman untuk membuat Tote Bag Jeans Kuat!',
    rejectedSlot: 4,
    materials: [
      { slot: 1, name: 'Potongan Kain Celana Jeans Tebal Bersih', isHazardous: false },
      { slot: 2, name: 'Tali Sabuk Katun Lebar untuk Bahu Tas', isHazardous: false },
      { slot: 3, name: 'Kancing Kayu Batok Kelapa Halus', isHazardous: false },
      { slot: 4, name: 'Kawat Jemuran Berkarat Tanpa Pelindung', isHazardous: true, hazardReason: 'Ujung kawat berkarat mudah menusuk tangan dan merobek buku pelajaran di dalam tas!' },
    ],
    numeracyQuestion: 'Tersedia 4 kg kain bekas di pojok kreasi: 1 kg rusak berjamur dan 2 kg sudah dijahit menjadi tas. Berapa kg sisa kain aman yang masih tersimpan?',
    options: [
      { label: 'Tersisa 1 kg kain jeans bersih yang aman', isCorrect: true },
      { label: 'Tersisa 2 kg kain jeans bersih yang aman', isCorrect: false },
      { label: 'Tersisa 3 kg kain jeans bersih yang aman', isCorrect: false },
    ],
  },
];

// LEVEL 5: 5 POS PENJAGA ALAM / 5 EKOSISTEM DESA (Pola: B - C - A - B - C, Bahasa & Matematika Ramah Anak SD)
export const LEVEL_5_ZONES: EcosystemZoneSpec[] = [
  {
    id: 1,
    npcName: 'Pak Rino Penjaga Bukit',
    npcRole: 'Penjaga Hutan Bukit Hijau',
    position: [-14, -10],
    radarColor: '#4ade80',
    zoneName: 'Zona 1: Lereng Bukit Hijau',
    crisisTitle: 'Tanah Bukit Mudah Longsor Saat Hujan',
    crisisDescription: 'Banyak pohon di bukit ditebang sehingga tanahnya mudah hanyut terbawa air hujan. Bantu Pak Rino memilih cara terbaik agar bukit tetap kuat dan hijau!',
    correctOption: 'B',
    alternatives: [
      {
        code: 'A',
        text: 'Menutup seluruh tanah bukit dengan semen beton supaya tidak ada tanah yang jatuh.',
        coinCost: 45,
        energyCost: 40,
        isBest: false,
        impactFeedback: 'Semen membuat air hujan tidak bisa meresap ke tanah dan bisa menyebabkan banjir di bawah!',
      },
      {
        code: 'B',
        text: 'Menanam bibit pohon dan rumput berakar kuat di seluruh lereng bukit.',
        coinCost: 30,
        energyCost: 25,
        isBest: true,
        impactFeedback: 'Hebat! Akar pohon dan rumput mengikat tanah dengan kuat agar bukit hijau dan tidak longsor.',
      },
      {
        code: 'C',
        text: 'Membiarkan bukit kosong dan hanya memasang papan tulisan dilarang lewat.',
        coinCost: 10,
        energyCost: 10,
        isBest: false,
        impactFeedback: 'Papan peringatan saja tidak bisa menahan tanah saat hujan deras turun!',
      },
    ],
    numeracyQuestion: 'Warga memiliki 100 Koin Desa. Sebanyak 30 Koin dipakai untuk membeli bibit pohon di bukit. Berapa sisa Koin Desa sekarang?',
    options: [
      { label: 'Tersisa 60 Koin Desa', isCorrect: false },
      { label: 'Tersisa 70 Koin Desa', isCorrect: true },
      { label: 'Tersisa 80 Koin Desa', isCorrect: false },
    ],
  },
  {
    id: 2,
    npcName: 'Bu Sari Relawan Sungai',
    npcRole: 'Sahabat Sungai Bersih',
    position: [13, -11],
    radarColor: '#38bdf8',
    zoneName: 'Zona 2: Pinggir Sungai Desa',
    crisisTitle: 'Air Sungai Keruh dan Banyak Sampah',
    crisisDescription: 'Banyak sampah plastik dan air cucian masuk ke sungai tempat ikan hidup. Bantu Bu Sari memilih cara yang aman agar air sungai kembali jernih!',
    correctOption: 'C',
    alternatives: [
      {
        code: 'A',
        text: 'Menuangkan cairan pemutih pakaian ke sungai supaya airnya tampak bening.',
        coinCost: 20,
        energyCost: 15,
        isBest: false,
        impactFeedback: 'Cairan pemutih sangat berbahaya karena bisa membuat ikan dan tumbuhan air mati!',
      },
      {
        code: 'B',
        text: 'Menutup aliran sungai dengan tumpukan tanah agar sampah tidak terlihat.',
        coinCost: 35,
        energyCost: 35,
        isBest: false,
        impactFeedback: 'Menutup aliran sungai membuat air meluap ke rumah warga dan menimbulkan banjir!',
      },
      {
        code: 'C',
        text: 'Memasang jaring penangkap sampah dan menyaring air kotor di bak saringan.',
        coinCost: 25,
        energyCost: 25,
        isBest: true,
        impactFeedback: 'Pintar! Sampah terjaring rapi dan air disaring aman sehingga ikan tetap hidup sehat.',
      },
    ],
    numeracyQuestion: 'Pos sungai memiliki 70 Koin Desa. Sebanyak 25 Koin dipakai membuat jaring sampah, lalu warga menyumbang 5 Koin tambahan. Berapa Koin Desa sekarang?',
    options: [
      { label: 'Menjadi 45 Koin Desa', isCorrect: false },
      { label: 'Menjadi 50 Koin Desa', isCorrect: true },
      { label: 'Menjadi 55 Koin Desa', isCorrect: false },
    ],
  },
  {
    id: 3,
    npcName: 'Pak Budi Petani Desa',
    npcRole: 'Petani Padi Ramah Alam',
    position: [-15, 11],
    radarColor: '#facc15',
    zoneName: 'Zona 3: Kebun & Sawah Desa',
    crisisTitle: 'Banyak Tikus Memakan Padi di Sawah',
    crisisDescription: 'Tanaman padi Pak Budi sering dimakan tikus sawah. Bantu Pak Budi memilih cara mengusir hama yang aman bagi petani, katak, dan ikan di sawah!',
    correctOption: 'A',
    alternatives: [
      {
        code: 'A',
        text: 'Membuat rumah burung hantu di sawah dan menanam bunga pengusir hama.',
        coinCost: 20,
        energyCost: 20,
        isBest: true,
        impactFeedback: 'Cerdas dan bijak! Burung hantu menjaga sawah secara alami tanpa meracuni padi dan air.',
      },
      {
        code: 'B',
        text: 'Menyemprotkan racun tikus kimia ke seluruh petak sawah dan saluran air.',
        coinCost: 15,
        energyCost: 15,
        isBest: false,
        impactFeedback: 'Racun kimia bisa mencemari beras yang kita makan serta membunuh katak dan ikan!',
      },
      {
        code: 'C',
        text: 'Memasang kawat listrik bertegangan tinggi mengelilingi pematang sawah.',
        coinCost: 30,
        energyCost: 25,
        isBest: false,
        impactFeedback: 'Kawat listrik di sawah sangat berbahaya bagi keselamatan petani dan anak-anak!',
      },
    ],
    numeracyQuestion: 'Pak Budi memasang 6 rumah burung hantu di sawah. Jika setiap rumah diisi 2 ekor burung hantu, berapa jumlah seluruh burung hantu di sawah?',
    options: [
      { label: 'Sebanyak 12 ekor burung hantu', isCorrect: true },
      { label: 'Sebanyak 10 ekor burung hantu', isCorrect: false },
      { label: 'Sebanyak 8 ekor burung hantu', isCorrect: false },
    ],
  },
  {
    id: 4,
    npcName: 'Bu Mira Penjaga Bakau',
    npcRole: 'Pelindung Pesisir Pantai',
    position: [15, 10],
    radarColor: '#f97316',
    zoneName: 'Zona 4: Pantai & Hutan Bakau',
    crisisTitle: 'Ombak Pantai Mengikis Pasir Desa',
    crisisDescription: 'Ombak laut mulai mendekati rumah warga di tepi pantai karena pohon di pesisir berkurang. Bantu Bu Mira memilih cara terbaik menjaga pantai!',
    correctOption: 'B',
    alternatives: [
      {
        code: 'A',
        text: 'Menimbun tepi pantai dengan sampah plastik dan karung bekas.',
        coinCost: 15,
        energyCost: 20,
        isBest: false,
        impactFeedback: 'Sampah plastik akan hanyut ke laut dan membahayakan penyu serta ikan!',
      },
      {
        code: 'B',
        text: 'Menanam bibit pohon bakau bersama warga di sepanjang pinggir pantai.',
        coinCost: 15,
        energyCost: 15,
        isBest: true,
        impactFeedback: 'Hebat! Akar pohon bakau menahan ombak laut sekaligus menjadi rumah kepiting dan ikan kecil.',
      },
      {
        code: 'C',
        text: 'Menggali pasir pantai untuk dijual agar pantai menjadi lebih dalam.',
        coinCost: 10,
        energyCost: 25,
        isBest: false,
        impactFeedback: 'Mengambil pasir pantai justru membuat daratan makin cepat terkikis ombak!',
      },
    ],
    numeracyQuestion: 'Bu Mira menyiapkan 4 baris bibit bakau di pantai. Jika setiap baris berisi 8 bibit bakau, berapa seluruh bibit bakau yang ditanam?',
    options: [
      { label: 'Sebanyak 24 bibit pohon bakau', isCorrect: false },
      { label: 'Sebanyak 32 bibit pohon bakau', isCorrect: true },
      { label: 'Sebanyak 36 bibit pohon bakau', isCorrect: false },
    ],
  },
  {
    id: 5,
    npcName: 'Mas Dani Sahabat Kolam',
    npcRole: 'Penggerak Taman & Kolam Desa',
    position: [2, 15],
    radarColor: '#ec4899',
    zoneName: 'Zona 5: Taman & Kolam Kampung',
    crisisTitle: 'Taman Kering dan Kolam Banyak Jentik Nyamuk',
    crisisDescription: 'Taman kampung terasa panas karena kurang pohon, dan kolam airnya menjadi sarang jentik nyamuk. Bantu Mas Dani memilih cara paling sehat merawat taman!',
    correctOption: 'C',
    alternatives: [
      {
        code: 'A',
        text: 'Menuangkan sisa minyak goreng ke kolam supaya nyamuk tidak bertelur.',
        coinCost: 10,
        energyCost: 15,
        isBest: false,
        impactFeedback: 'Minyak goreng membuat air kolam bau, kotor, dan mematikan tanaman air!',
      },
      {
        code: 'B',
        text: 'Mengeringkan seluruh kolam dan menebang semak taman sampai habis.',
        coinCost: 25,
        energyCost: 20,
        isBest: false,
        impactFeedback: 'Taman akan menjadi makin gersang dan panas tanpa air serta tumbuhan hijau!',
      },
      {
        code: 'C',
        text: 'Menanam pohon peneduh di taman dan memelihara ikan kecil pemakan jentik di kolam.',
        coinCost: 10,
        energyCost: 10,
        isBest: true,
        impactFeedback: 'Cerdas! Pohon membuat taman sejuk dan ikan kecil membasmi jentik nyamuk secara alami.',
      },
    ],
    numeracyQuestion: 'Di taman kampung ada 18 pot bunga, lalu siswa SD menyumbang 7 pot bunga lagi. Berapa jumlah seluruh pot bunga di taman sekarang?',
    options: [
      { label: 'Sebanyak 22 pot bunga di taman', isCorrect: false },
      { label: 'Sebanyak 27 pot bunga di taman', isCorrect: false },
      { label: 'Sebanyak 25 pot bunga di taman', isCorrect: true },
    ],
  },
];

// LEVEL 6: 5 TITIK RADAR NUSANTARA (Jawa: 1-2-3 | Sumatra: 2-3-1 | Kalimantan: 3-1-2 | Bali/NT: 1-3-2 | Papua: 2-2-3)
export const LEVEL_6_ISLANDS: RadarIslandSpec[] = [
  {
    id: 1,
    islandName: 'Jawa',
    shortRegion: 'Kec. Wonogiri & Girimarto, Kab. Wonogiri (Jateng)',
    regionTitle: 'Waduk Gajah Mungkur (Kec. Wonogiri) & Hulu Sungai Kec. Girimarto, Kab. Wonogiri, Jawa Tengah',
    coords: [-6, 8],
    newsSource: 'Solopos.com',
    newsHeadline: 'Solopos.com: Usia Pakai WGM Wonogiri Tinggal 6 Tahun',
    newsUrl: 'https://solopos.espos.id/gara-gara-sedimentasi-usia-pakai-wgm-wonogiri-tinggal-6-tahun-lagi-2057869',
    emergencyFact: 'Saat hujan, tanah gundul di bukit Kec. Girimarto hanyut dan memenuhi Waduk Gajah Mungkur dengan lumpur sehingga usia pakainya terancam.',
    correctPillarSlots: [1, 2, 3],
    pillarChoices: [
      {
        pillarName: 'Aturan Pemerintah',
        slots: [
          { slotNum: 1, text: 'Melarang tebang pohon di bukit Wonogiri agar tanah kuat.' },
          { slotNum: 2, text: 'Mengizinkan bukit digali habis untuk tempat parkir wisata.' },
          { slotNum: 3, text: 'Menghapus aturan menanam pohon di lereng bukit yang miring.' },
        ],
      },
      {
        pillarName: 'Perbaikan Fisik',
        slots: [
          { slotNum: 1, text: 'Menutup tepi waduk dengan batu agar air meluap ke jalan.' },
          { slotNum: 2, text: 'Membuat tanggul penahan lumpur dan menanam pohon berakar kuat.' },
          { slotNum: 3, text: 'Membiarkan lumpur terus menumpuk di dasar waduk tiap hujan.' },
        ],
      },
      {
        pillarName: 'Edukasi Warga',
        slots: [
          { slotNum: 1, text: 'Mengajak petani membakar jerami di tepi sungai saat kemarau.' },
          { slotNum: 2, text: 'Menyarankan warga membuang sampah ke sungai menuju waduk.' },
          { slotNum: 3, text: 'Melatih petani membuat kebun bertingkat dan menjaga sungai bersih.' },
        ],
      },
    ],
    numeracyQuestion: 'Penghijauan di hulu Waduk Gajah Mungkur mencakup 150 hektare (ha) lahan. Jika setiap 1 ha mencegah 40 ton lumpur/sedimentasi per tahun, berapa ton sedimentasi yang dicegah per tahun?',
    options: [
      { label: '6.000 ton sedimentasi dicegah/tahun', isCorrect: true },
      { label: '4.500 ton sedimentasi dicegah/tahun', isCorrect: false },
      { label: '7.500 ton sedimentasi dicegah/tahun', isCorrect: false },
    ],
  },
  {
    id: 2,
    islandName: 'Sumatra',
    shortRegion: 'Kab. Siak & Pelalawan (Riau) · Kab. Tanjab Timur (Jambi)',
    regionTitle: 'Lahan Gambut Kec. Sungai Apit (Kab. Siak & Pelalawan, Riau) & Kec. Dendang (Kab. Tanjab Timur, Jambi)',
    coords: [-18, -2],
    newsSource: 'Mongabay Indonesia',
    newsHeadline: 'Mongabay Indonesia: Gambut Riau Menipis & Restorasi',
    newsUrl: 'https://mongabay.co.id/2024/05/12/gambut-riau-menipis-bagaimana-perkembangan-restorasi/',
    emergencyFact: 'Tanah gambut di Riau dan Jambi menipis serta mengering sehingga mudah terbakar dan menimbulkan kabut asap.',
    correctPillarSlots: [2, 3, 1],
    pillarChoices: [
      {
        pillarName: 'Aturan Pemerintah',
        slots: [
          { slotNum: 1, text: 'Membolehkan warga menggali parit untuk mengeringkan rawa.' },
          { slotNum: 2, text: 'Melarang keras pembakaran lahan dan menjaga rawa tetap basah.' },
          { slotNum: 3, text: 'Menghapus hukuman bagi pelaku pembakar semak saat kemarau.' },
        ],
      },
      {
        pillarName: 'Perbaikan Fisik',
        slots: [
          { slotNum: 1, text: 'Menyedot air rawa memakai pompa agar tanah cepat kering.' },
          { slotNum: 2, text: 'Menebang pohon rawa agar tanah langsung terkena panas terik.' },
          { slotNum: 3, text: 'Membangun sekat kanal dan sumur air agar tanah gambut tetap lembap.' },
        ],
      },
      {
        pillarName: 'Edukasi Warga',
        slots: [
          { slotNum: 1, text: 'Mengajak warga berpatroli api dan berkebun tanpa membakar lahan.' },
          { slotNum: 2, text: 'Membiarkan warga membuka kebun baru dengan cara membakar semak.' },
          { slotNum: 3, text: 'Menghentikan kerja bakti menjaga hutan saat musim kemarau.' },
        ],
      },
    ],
    numeracyQuestion: 'Tim restorasi membangun 25 sekat kanal di lahan gambut Riau & Jambi. Jika setiap 1 sekat kanal membasahi 8 hektare (ha) lahan, berapa luas lahan gambut yang tetap basah?',
    options: [
      { label: '160 ha gambut basah', isCorrect: false },
      { label: '200 ha gambut basah', isCorrect: true },
      { label: '240 ha gambut basah', isCorrect: false },
    ],
  },
  {
    id: 3,
    islandName: 'Kalimantan',
    shortRegion: 'Kec. Kumai (Kobar, Kalteng) & Sungai Wain (Balikpapan, Kaltim)',
    regionTitle: 'Hutan Sekonyer (Kec. Kumai, Kab. Kotawaringin Barat, Kalteng) & Hutan Sungai Wain (Balikpapan Utara, Kaltim)',
    coords: [-4, -4],
    newsSource: 'Betahita.id',
    newsHeadline: 'Betahita.id: Fragmentasi Habitat Rusak Satwa',
    newsUrl: 'https://www.betahita.id/berita/12044/fragmentasi-habitat-rusak-ketahanan-genetik-satwa',
    emergencyFact: 'Rimba tropis di Kalimantan terpecah-pecah sehingga koridor gerak orangutan dan satwa liar terputus.',
    correctPillarSlots: [3, 1, 2],
    pillarChoices: [
      {
        pillarName: 'Aturan Pemerintah',
        slots: [
          { slotNum: 1, text: 'Mengizinkan penebangan pohon besar tempat sarang orangutan.' },
          { slotNum: 2, text: 'Membangun jalan raya di tengah hutan tanpa jembatan satwa.' },
          { slotNum: 3, text: 'Menetapkan jalur koridor hutan lindung khusus untuk gerak satwa.' },
        ],
      },
      {
        pillarName: 'Perbaikan Fisik',
        slots: [
          { slotNum: 1, text: 'Menanam pohon buah hutan dan membuat koridor jembatan antar-pohon.' },
          { slotNum: 2, text: 'Memasang pagar kawat berduri agar satwa tidak bisa pindah hutan.' },
          { slotNum: 3, text: 'Mengganti semua pohon buah hutan dengan rumput lapangan saja.' },
        ],
      },
      {
        pillarName: 'Edukasi Warga',
        slots: [
          { slotNum: 1, text: 'Membiarkan orang memelihara anak orangutan di dalam kandang.' },
          { slotNum: 2, text: 'Mengajak warga melindungi satwa langka dan melapor jika ada yang tersesat.' },
          { slotNum: 3, text: 'Menyarankan warga menebang pohon buah hutan untuk kayu bakar.' },
        ],
      },
    ],
    numeracyQuestion: 'Satu koridor rimba tropis mampu melindungi 15 ekor orangutan agar aman mencari makan. Jika dibangun 4 koridor penghubung hutan, berapa ekor orangutan yang terlindungi?',
    options: [
      { label: '45 orangutan terlindungi', isCorrect: false },
      { label: '60 orangutan terlindungi', isCorrect: true },
      { label: '75 orangutan terlindungi', isCorrect: false },
    ],
  },
  {
    id: 4,
    islandName: 'Bali & Nusa Tenggara',
    shortRegion: 'Pemuteran & Nusa Penida (Bali) · Gili Matra (NTB) · Komodo (NTT)',
    regionTitle: 'Teluk Pemuteran & Nusa Penida (Bali), Gili Matra (Lombok Utara, NTB), & Perairan Komodo (Manggarai Barat, NTT)',
    coords: [4, 9],
    newsSource: 'National Geographic Indonesia',
    newsHeadline: 'National Geographic Indonesia: Lautan Plastik & Karang',
    newsUrl: 'https://nationalgeographic.grid.id/read/13309631/viral-video-penyelam-berenang-di-lautan-plastik-bali-ini-penjelasan-ahli',
    emergencyFact: 'Sampah plastik di laut Bali hingga Nusa Tenggara menutupi rumah ikan dan merusak terumbu karang.',
    correctPillarSlots: [1, 3, 2],
    pillarChoices: [
      {
        pillarName: 'Aturan Pemerintah',
        slots: [
          { slotNum: 1, text: 'Mengurangi plastik sekali pakai di pantai dan melarang rusak karang.' },
          { slotNum: 2, text: 'Membolehkan kapal membuang jangkar besi tepat di atas karang.' },
          { slotNum: 3, text: 'Mengizinkan nelayan menangkap ikan memakai bom peledak.' },
        ],
      },
      {
        pillarName: 'Perbaikan Fisik',
        slots: [
          { slotNum: 1, text: 'Mengambil batu karang hidup untuk hiasan pagar penginapan.' },
          { slotNum: 2, text: 'Menimbun pasir pantai dengan tumpukan sampah plastik.' },
          { slotNum: 3, text: 'Menaruh rak kerangka besi di dasar laut untuk menumbuhkan bibit karang baru.' },
        ],
      },
      {
        pillarName: 'Edukasi Warga',
        slots: [
          { slotNum: 1, text: 'Membiarkan pengunjung membuang botol plastik ke ombak laut.' },
          { slotNum: 2, text: 'Mengajak siswa, nelayan, dan wisatawan rajin bersih pantai bersama.' },
          { slotNum: 3, text: 'Mengajak pedagang membakar sampah plastik di atas pasir pantai.' },
        ],
      },
    ],
    numeracyQuestion: 'Penyelam memasang 15 rak kerangka besi di dasar laut yang bersih dari plastik. Jika tiap rak diisi 40 bibit karang, berapa jumlah karang baru yang ditanam?',
    options: [
      { label: '450 karang baru', isCorrect: false },
      { label: '600 karang baru', isCorrect: true },
      { label: '750 karang baru', isCorrect: false },
    ],
  },
  {
    id: 5,
    islandName: 'Papua',
    shortRegion: 'Teluk Youtefa (Jayapura, Papua) & Teluk Bintuni (Papua Barat)',
    regionTitle: 'Hutan Bakau Teluk Youtefa (Distrik Abepura, Kota Jayapura, Papua) & Teluk Bintuni (Papua Barat)',
    coords: [18, 2],
    newsSource: 'ANTARA News',
    newsHeadline: 'ANTARA News: Pelestarian Hutan Bakau Papua',
    newsUrl: 'https://papuatengah.antaranews.com/berita/83281/kemenhut-intensifkan-pelestarian-hutan-bakau-papua-sebagai-paru-paru-dunia',
    emergencyFact: 'Penebangan bakau di Teluk Youtefa (Jayapura) dan Teluk Bintuni membuat pantai mudah terkikis ombak serta mengurangi tempat ikan bertelur.',
    correctPillarSlots: [2, 2, 3],
    pillarChoices: [
      {
        pillarName: 'Aturan Pemerintah',
        slots: [
          { slotNum: 1, text: 'Menebang habis hutan bakau pantai untuk menggali pasir laut.' },
          { slotNum: 2, text: 'Menetapkan hutan bakau teluk sebagai kawasan lindung yang wajib dijaga.' },
          { slotNum: 3, text: 'Membolehkan kapal membuang sisa oli mesin ke akar bakau.' },
        ],
      },
      {
        pillarName: 'Perbaikan Fisik',
        slots: [
          { slotNum: 1, text: 'Memotong akar pohon bakau supaya perahu bisa menabrak pantai.' },
          { slotNum: 2, text: 'Menanam ribuan bibit bakau secara rapat di garis pantai yang rusak.' },
          { slotNum: 3, text: 'Mengganti tanaman bakau pantai dengan kaktus gurun pasir.' },
        ],
      },
      {
        pillarName: 'Edukasi Warga',
        slots: [
          { slotNum: 1, text: 'Mengajak warga menebang kayu bakau muda setiap hari untuk dijual.' },
          { slotNum: 2, text: 'Membiarkan jaring plastik bekas menutupi tunas bakau muda.' },
          { slotNum: 3, text: 'Melatih warga merawat bibit bakau dan menangkap ikan tanpa merusak alam.' },
        ],
      },
    ],
    numeracyQuestion: 'Anak SD pesisir menanam 18 bibit bakau di pagi hari dan 22 bibit di sore hari. Jika mereka menanam selama 5 hari, berapa total bibit bakau yang tertanam?',
    options: [
      { label: 'Menanam 200 bibit bakau pesisir', isCorrect: true },
      { label: 'Menanam 160 bibit bakau pesisir', isCorrect: false },
      { label: 'Menanam 220 bibit bakau pesisir', isCorrect: false },
    ],
  },
];

export const PIAGAM_IKRAR_ITEMS = [
  'Memungut sampah plastik di lingkungan sekolah dan memilahnya pada tempat yang benar.',
  'Membawa botol minum (tumbler) sendiri dari rumah guna mencegah pemborosan sampah plastik.',
  'Menutup rapat keran air tempat wudu dan mematikan lampu kelas saat tidak digunakan.',
  'Mengubah barang bekas menjadi barang bermanfaat dan membantu sesama yang membutuhkan.',
  'Menanam dan merawat minimal satu pohon serta tidak mencemari selokan air pemukiman.',
  'Berpartisipasi aktif dalam kegiatan kerja bakti dan menjaga kebersihan bumi Nusantara.',
];
