import {
  LEVEL_1_ITEMS,
  LEVEL_2_ANAGRAMS,
  LEVEL_3_CLAW_ITEMS,
  LEVEL_4_CITIZENS,
  LEVEL_5_ZONES,
  LEVEL_6_ISLANDS,
  TrashItemSpec,
  AnagramSpec,
  ClawItemSpec,
  CitizenQuestSpec,
  EcosystemZoneSpec,
  RadarIslandSpec,
} from './blueprintData';

export interface AnswerEvaluationRecord {
  challengeKey: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  bloomCode: 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6';
  phaseLabel: string;
  promptTitle: string;
  questionText: string;
  firstAttemptCorrect: boolean;
  isResolved: boolean;
  attemptsCount: number;
  wrongChoices: string[];
  lastUserAnswer: string;
  correctAnswer: string;
  explanation: string;
  updatedAt: number;
}

export interface AnswerEvaluationInput {
  challengeKey: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  bloomCode: 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6';
  phaseLabel: string;
  promptTitle: string;
  questionText: string;
  isCorrect: boolean;
  chosenAnswer: string;
  correctAnswer: string;
  explanation: string;
}

export function upsertEvaluationRecord(
  list: readonly AnswerEvaluationRecord[],
  incoming: AnswerEvaluationInput
): AnswerEvaluationRecord[] {
  const existingIdx = list.findIndex((item) => item.challengeKey === incoming.challengeKey);
  const now = Date.now();

  if (existingIdx === -1) {
    const newRecord: AnswerEvaluationRecord = {
      challengeKey: incoming.challengeKey,
      level: incoming.level,
      bloomCode: incoming.bloomCode,
      phaseLabel: incoming.phaseLabel,
      promptTitle: incoming.promptTitle,
      questionText: incoming.questionText,
      firstAttemptCorrect: incoming.isCorrect,
      isResolved: incoming.isCorrect,
      attemptsCount: 1,
      wrongChoices: incoming.isCorrect ? [] : [incoming.chosenAnswer],
      lastUserAnswer: incoming.chosenAnswer,
      correctAnswer: incoming.correctAnswer,
      explanation: incoming.explanation,
      updatedAt: now,
    };
    return [...list, newRecord];
  }

  const prev = list[existingIdx];
  const nextWrongChoices =
    !incoming.isCorrect && !prev.wrongChoices.includes(incoming.chosenAnswer)
      ? [...prev.wrongChoices, incoming.chosenAnswer]
      : prev.wrongChoices;

  const updated: AnswerEvaluationRecord = {
    ...prev,
    promptTitle: incoming.promptTitle,
    questionText: incoming.questionText,
    firstAttemptCorrect: prev.firstAttemptCorrect && incoming.isCorrect,
    isResolved: prev.isResolved || incoming.isCorrect,
    attemptsCount: prev.attemptsCount + 1,
    wrongChoices: nextWrongChoices,
    lastUserAnswer: incoming.chosenAnswer,
    correctAnswer: incoming.correctAnswer,
    explanation: incoming.explanation,
    updatedAt: now,
  };

  const nextList = [...list];
  nextList[existingIdx] = updated;
  return nextList;
}

export function getLevel1BinLabel(dir: 'KIRI' | 'KANAN' | 'ATAS'): string {
  if (dir === 'KIRI') return 'Tong ORGANIK (Kiri)';
  if (dir === 'KANAN') return 'Tong ANORGANIK (Kanan)';
  return 'Tong B3 / Berbahaya (Tengah)';
}

export function getLevel1EvaluationMeta(item: TrashItemSpec): {
  correctAnswer: string;
  explanation: string;
} {
  const correctAnswer = getLevel1BinLabel(item.direction);
  const explanation = `${item.hint} Karena itu, "${item.name}" termasuk sampah ${item.category} dan diarahkan ke ${correctAnswer}.`;
  return { correctAnswer, explanation };
}

export function getLevel2WordEvaluationMeta(spec: AnagramSpec): {
  correctAnswer: string;
  explanation: string;
} {
  return {
    correctAnswer: spec.targetWord,
    explanation: `Kata "${spec.targetWord}" berarti: ${spec.meaning}`,
  };
}

export function getLevel2NumeracyEvaluationMeta(spec: AnagramSpec): {
  correctAnswer: string;
  explanation: string;
} {
  const correctOpt = spec.options.find((o) => o.isCorrect)?.label || '-';
  return {
    correctAnswer: correctOpt,
    explanation: `Langkah hitung: ${spec.numeracyFormula}. Jadi jawabannya: ${correctOpt}.`,
  };
}

const LEVEL_3_NUMERACY_FORMULAS: Record<number, string> = {
  1: '12 ban bekas ÷ 3 ban/set = 4 set kursi taman sekolah',
  2: '4 kantong plastik × 4 pekan = 16 lembar sampah plastik dicegah',
  3: '2 botol plastik × 20 hari sekolah = 40 botol plastik berkurang',
  4: '100% − 95% penghematan = hanya 5% energi pengolahan yang dibutuhkan',
  5: '5 botol kaca × Rp15.000 = Rp75.000 biaya sekolah yang dihemat',
  6: '150 kg kardus ÷ 50 kg/pohon = 3 pohon peneduh dewasa yang selamat',
};

export function getLevel3ClawEvaluationMeta(item: ClawItemSpec): {
  correctAnswer: string;
  explanation: string;
} {
  const binLabel = `Tong ${item.targetBin}`;
  return {
    correctAnswer: binLabel,
    explanation: `${item.description} Maka "${item.name}" paling tepat dimasukkan ke ${binLabel}.`,
  };
}

export function getLevel3NumeracyEvaluationMeta(item: ClawItemSpec): {
  correctAnswer: string;
  explanation: string;
} {
  const correctOpt = item.options.find((o) => o.isCorrect)?.label || '-';
  const formula = LEVEL_3_NUMERACY_FORMULAS[item.id] || correctOpt;
  return {
    correctAnswer: correctOpt,
    explanation: `Langkah hitung: ${formula}. Jawaban tepat: ${correctOpt}.`,
  };
}

const LEVEL_4_NUMERACY_FORMULAS: Record<number, string> = {
  1: '10 ban ÷ 2 ban = 5 kursi (sedangkan 6 papan cukup untuk 6 kursi). Jumlah maksimal yang bisa dirakit utuh adalah 5 kursi taman',
  2: '72 pensil ÷ 18 pensil/wadah = 4 buah tempat pensil meja',
  3: '18 sekat ÷ 2 sekat/lembar = 9 lembar kardus paket tebal',
  4: '8 deret × 3 pot = 24 bibit sayur sawi hijau segar',
  5: '4 kg awal − 1 kg rusak − 2 kg sudah dijahit = tersisa 1 kg kain jeans bersih',
};

export function getLevel4MaterialEvaluationMeta(citizen: CitizenQuestSpec): {
  correctAnswer: string;
  explanation: string;
} {
  const safeNames = citizen.materials.filter((m) => !m.isHazardous).map((m) => m.name);
  const hazardMat = citizen.materials.find((m) => m.isHazardous);
  const correctAnswer = safeNames.join(', ');
  const hazardNote = hazardMat
    ? ` Tolak "${hazardMat.name}" karena ${hazardMat.hazardReason || 'berbahaya bagi keselamatan.'}`
    : '';
  return {
    correctAnswer,
    explanation: `Bahan aman untuk proyek ${citizen.projectTitle} adalah: ${correctAnswer}.${hazardNote}`,
  };
}

export function getLevel4NumeracyEvaluationMeta(citizen: CitizenQuestSpec): {
  correctAnswer: string;
  explanation: string;
} {
  const correctOpt = citizen.options.find((o) => o.isCorrect)?.label || '-';
  const formula = LEVEL_4_NUMERACY_FORMULAS[citizen.id] || correctOpt;
  return {
    correctAnswer: correctOpt,
    explanation: `Langkah hitung: ${formula}. Jawaban tepat: ${correctOpt}.`,
  };
}

const LEVEL_5_NUMERACY_FORMULAS: Record<number, string> = {
  1: '100 Koin Desa − 30 Koin bibit = tersisa 70 Koin Desa',
  2: '70 Koin Desa − 25 Koin jaring + 5 Koin sumbangan warga = 50 Koin Desa',
  3: '6 rumah × 2 ekor = 12 ekor burung hantu di sawah',
  4: '4 baris × 8 bibit = 32 bibit pohon bakau di pantai',
  5: '18 pot bunga + 7 pot sumbangan = 25 pot bunga di taman',
};

export function getLevel5PolicyEvaluationMeta(zone: EcosystemZoneSpec): {
  correctAnswer: string;
  explanation: string;
} {
  const bestAlt = zone.alternatives.find((a) => a.isBest) || zone.alternatives[0];
  const correctAnswer = `Pilihan ${bestAlt.code}: ${bestAlt.text}`;
  return {
    correctAnswer,
    explanation: `${bestAlt.impactFeedback} Solusi ini ramah makhluk hidup dan menjaga keseimbangan ekosistem.`,
  };
}

export function getLevel5NumeracyEvaluationMeta(zone: EcosystemZoneSpec): {
  correctAnswer: string;
  explanation: string;
} {
  const correctOpt = zone.options.find((o) => o.isCorrect)?.label || '-';
  const formula = LEVEL_5_NUMERACY_FORMULAS[zone.id] || correctOpt;
  return {
    correctAnswer: correctOpt,
    explanation: `Langkah hitung: ${formula}. Jawaban tepat: ${correctOpt}.`,
  };
}

const LEVEL_6_NUMERACY_FORMULAS: Record<number, string> = {
  1: '150 ha × 40 ton/ha = 6.000 ton lumpur/sedimentasi dicegah per tahun',
  2: '25 sekat kanal × 8 ha = 200 ha lahan gambut tetap basah',
  3: '15 orangutan × 4 koridor = 60 orangutan terlindungi',
  4: '15 rak × 40 bibit karang = 600 karang baru ditanam',
  5: '(18 bibit pagi + 22 bibit sore) = 40 bibit/hari × 5 hari = 200 bibit bakau pesisir',
};

export function getLevel6PillarEvaluationMeta(island: RadarIslandSpec): {
  correctAnswer: string;
  explanation: string;
} {
  const parts = island.pillarChoices.map((pillar, idx) => {
    const slotNum = island.correctPillarSlots[idx];
    const slotText = pillar.slots.find((s) => s.slotNum === slotNum)?.text || '-';
    return `${pillar.pillarName}: ${slotText}`;
  });
  return {
    correctAnswer: parts.join(' | '),
    explanation: `Fakta wilayah: ${island.emergencyFact} Ketiga pilar harus saling mendukung: ${parts.join(' • ')}`,
  };
}

export function getLevel6NumeracyEvaluationMeta(island: RadarIslandSpec): {
  correctAnswer: string;
  explanation: string;
} {
  const correctOpt = island.options.find((o) => o.isCorrect)?.label || '-';
  const formula = LEVEL_6_NUMERACY_FORMULAS[island.id] || correctOpt;
  return {
    correctAnswer: correctOpt,
    explanation: `Langkah hitung: ${formula}. Jawaban tepat: ${correctOpt}.`,
  };
}

/**
 * Builds a complete reference evaluation & explanation bank across C1–C6
 * for previewing or reviewing unplayed levels on the Result screen.
 */
export function buildReferenceEvaluationBank(): AnswerEvaluationRecord[] {
  const now = Date.now();
  const bank: AnswerEvaluationRecord[] = [];

  LEVEL_1_ITEMS.forEach((item) => {
    const meta = getLevel1EvaluationMeta(item);
    bank.push({
      challengeKey: `L1-item-${item.id}`,
      level: 1,
      bloomCode: 'C1',
      phaseLabel: 'Pilah Sampah',
      promptTitle: item.name,
      questionText: `Termasuk kategori apakah "${item.name}"?`,
      firstAttemptCorrect: true,
      isResolved: true,
      attemptsCount: 1,
      wrongChoices: [],
      lastUserAnswer: meta.correctAnswer,
      correctAnswer: meta.correctAnswer,
      explanation: meta.explanation,
      updatedAt: now,
    });
  });

  LEVEL_2_ANAGRAMS.forEach((spec) => {
    const wordMeta = getLevel2WordEvaluationMeta(spec);
    bank.push({
      challengeKey: `L2-word-${spec.id}`,
      level: 2,
      bloomCode: 'C2',
      phaseLabel: 'Susun Kata 3R',
      promptTitle: `Konsep "${spec.targetWord}"`,
      questionText: `Susun kata yang bermakna: ${spec.meaning}`,
      firstAttemptCorrect: true,
      isResolved: true,
      attemptsCount: 1,
      wrongChoices: [],
      lastUserAnswer: wordMeta.correctAnswer,
      correctAnswer: wordMeta.correctAnswer,
      explanation: wordMeta.explanation,
      updatedAt: now,
    });

    const numMeta = getLevel2NumeracyEvaluationMeta(spec);
    bank.push({
      challengeKey: `L2-num-${spec.id}`,
      level: 2,
      bloomCode: 'C2',
      phaseLabel: 'Numerasi 3R',
      promptTitle: `Hitungan ${spec.targetWord}`,
      questionText: spec.numeracyQuestion,
      firstAttemptCorrect: true,
      isResolved: true,
      attemptsCount: 1,
      wrongChoices: [],
      lastUserAnswer: numMeta.correctAnswer,
      correctAnswer: numMeta.correctAnswer,
      explanation: numMeta.explanation,
      updatedAt: now,
    });
  });

  LEVEL_3_CLAW_ITEMS.forEach((item) => {
    const clawMeta = getLevel3ClawEvaluationMeta(item);
    bank.push({
      challengeKey: `L3-claw-${item.id}`,
      level: 3,
      bloomCode: 'C3',
      phaseLabel: 'Mesin Capit 3R',
      promptTitle: item.name,
      questionText: `Ke tong 3R mana "${item.name}" harus diarahkan?`,
      firstAttemptCorrect: true,
      isResolved: true,
      attemptsCount: 1,
      wrongChoices: [],
      lastUserAnswer: clawMeta.correctAnswer,
      correctAnswer: clawMeta.correctAnswer,
      explanation: clawMeta.explanation,
      updatedAt: now,
    });

    const numMeta = getLevel3NumeracyEvaluationMeta(item);
    bank.push({
      challengeKey: `L3-num-${item.id}`,
      level: 3,
      bloomCode: 'C3',
      phaseLabel: 'Numerasi Mesin Capit',
      promptTitle: `Hitungan: ${item.name}`,
      questionText: item.numeracyQuestion,
      firstAttemptCorrect: true,
      isResolved: true,
      attemptsCount: 1,
      wrongChoices: [],
      lastUserAnswer: numMeta.correctAnswer,
      correctAnswer: numMeta.correctAnswer,
      explanation: numMeta.explanation,
      updatedAt: now,
    });
  });

  LEVEL_4_CITIZENS.forEach((cit) => {
    const matMeta = getLevel4MaterialEvaluationMeta(cit);
    bank.push({
      challengeKey: `L4-mat-${cit.id}`,
      level: 4,
      bloomCode: 'C4',
      phaseLabel: 'Seleksi Bahan Aman',
      promptTitle: `${cit.projectTitle} (${cit.npcName})`,
      questionText: cit.complaint,
      firstAttemptCorrect: true,
      isResolved: true,
      attemptsCount: 1,
      wrongChoices: [],
      lastUserAnswer: matMeta.correctAnswer,
      correctAnswer: matMeta.correctAnswer,
      explanation: matMeta.explanation,
      updatedAt: now,
    });

    const numMeta = getLevel4NumeracyEvaluationMeta(cit);
    bank.push({
      challengeKey: `L4-num-${cit.id}`,
      level: 4,
      bloomCode: 'C4',
      phaseLabel: 'Numerasi Karya Kota',
      promptTitle: `Hitungan: ${cit.projectTitle}`,
      questionText: cit.numeracyQuestion,
      firstAttemptCorrect: true,
      isResolved: true,
      attemptsCount: 1,
      wrongChoices: [],
      lastUserAnswer: numMeta.correctAnswer,
      correctAnswer: numMeta.correctAnswer,
      explanation: numMeta.explanation,
      updatedAt: now,
    });
  });

  LEVEL_5_ZONES.forEach((zone) => {
    const polMeta = getLevel5PolicyEvaluationMeta(zone);
    bank.push({
      challengeKey: `L5-pol-${zone.id}`,
      level: 5,
      bloomCode: 'C5',
      phaseLabel: 'Solusi Ekosistem',
      promptTitle: `${zone.zoneName} (${zone.npcName})`,
      questionText: `${zone.crisisTitle}: ${zone.crisisDescription}`,
      firstAttemptCorrect: true,
      isResolved: true,
      attemptsCount: 1,
      wrongChoices: [],
      lastUserAnswer: polMeta.correctAnswer,
      correctAnswer: polMeta.correctAnswer,
      explanation: polMeta.explanation,
      updatedAt: now,
    });

    const numMeta = getLevel5NumeracyEvaluationMeta(zone);
    bank.push({
      challengeKey: `L5-num-${zone.id}`,
      level: 5,
      bloomCode: 'C5',
      phaseLabel: 'Numerasi Ekosistem',
      promptTitle: `Hitungan: ${zone.zoneName}`,
      questionText: zone.numeracyQuestion,
      firstAttemptCorrect: true,
      isResolved: true,
      attemptsCount: 1,
      wrongChoices: [],
      lastUserAnswer: numMeta.correctAnswer,
      correctAnswer: numMeta.correctAnswer,
      explanation: numMeta.explanation,
      updatedAt: now,
    });
  });

  LEVEL_6_ISLANDS.forEach((isl) => {
    const pilMeta = getLevel6PillarEvaluationMeta(isl);
    bank.push({
      challengeKey: `L6-pil-${isl.id}`,
      level: 6,
      bloomCode: 'C6',
      phaseLabel: 'Masterplan 3 Pilar',
      promptTitle: `${isl.islandName} (${isl.shortRegion})`,
      questionText: isl.emergencyFact,
      firstAttemptCorrect: true,
      isResolved: true,
      attemptsCount: 1,
      wrongChoices: [],
      lastUserAnswer: pilMeta.correctAnswer,
      correctAnswer: pilMeta.correctAnswer,
      explanation: pilMeta.explanation,
      updatedAt: now,
    });

    const numMeta = getLevel6NumeracyEvaluationMeta(isl);
    bank.push({
      challengeKey: `L6-num-${isl.id}`,
      level: 6,
      bloomCode: 'C6',
      phaseLabel: 'Numerasi Nusantara',
      promptTitle: `Hitungan: ${isl.islandName}`,
      questionText: isl.numeracyQuestion,
      firstAttemptCorrect: true,
      isResolved: true,
      attemptsCount: 1,
      wrongChoices: [],
      lastUserAnswer: numMeta.correctAnswer,
      correctAnswer: numMeta.correctAnswer,
      explanation: numMeta.explanation,
      updatedAt: now,
    });
  });

  return bank;
}
