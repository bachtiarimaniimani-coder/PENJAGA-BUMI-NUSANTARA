import {
  LEVEL_1_ITEMS,
  LEVEL_2_ANAGRAMS,
  LEVEL_3_CLAW_ITEMS,
  LEVEL_4_CITIZENS,
  LEVEL_5_ZONES,
  LEVEL_6_ISLANDS,
  TrashItemSpec,
  ClawItemSpec,
  CitizenQuestSpec,
  EcosystemZoneSpec,
  RadarIslandSpec,
} from './blueprintData';

export interface LevelScoreMap {
  c1: number; // max 15
  c2: number; // max 15
  c3: number; // max 15
  c4: number; // max 20
  c5: number; // max 15
  c6: number; // max 20
}

export type DifficultyLevel = 'tenang' | 'mudah' | 'sedang' | 'sulit';

export interface DifficultyConfig {
  id: DifficultyLevel;
  label: string;
  shortDesc: string;
  timeMultiplier: number;
  untimed: boolean;
}

export function getDifficultyConfig(difficulty: DifficultyLevel): DifficultyConfig {
  if (difficulty === 'tenang') {
    return {
      id: 'tenang',
      label: 'TENANG (∞)',
      shortDesc: 'Tanpa Batas Waktu (Fokus Baca & Hitung)',
      timeMultiplier: 1.0,
      untimed: true,
    };
  }
  if (difficulty === 'mudah') {
    return {
      id: 'mudah',
      label: 'MUDAH',
      shortDesc: 'Santai (2x Waktu Baca & Hitung)',
      timeMultiplier: 2.0,
      untimed: false,
    };
  }
  if (difficulty === 'sulit') {
    return {
      id: 'sulit',
      label: 'SULIT',
      shortDesc: 'Tantangan Cepat (Refleks HOTS)',
      timeMultiplier: 0.5,
      untimed: false,
    };
  }
  return {
    id: 'sedang',
    label: 'SEDANG',
    shortDesc: 'Standar Ramah Anak SD',
    timeMultiplier: 1.0,
    untimed: false,
  };
}

export function applyDifficultyTimer(
  baseSeconds: number,
  difficulty: DifficultyLevel
): number {
  const { timeMultiplier } = getDifficultyConfig(difficulty);
  return Number(Math.max(2.5, baseSeconds * timeMultiplier).toFixed(1));
}

/**
 * Returns child-friendly calibrated timers (seconds) for elementary students (Fase C)
 * who need to read narrative context, listen to teacher audio, calculate numeracy, and play.
 */
export function getCalibratedLevelTimer(
  level: number,
  difficulty: DifficultyLevel,
  options?: { wave?: 1 | 2 | 3; isNumeracy?: boolean }
): number {
  if (options?.isNumeracy) {
    // Dedicated 120s base for reading & solving numeracy word problems
    return applyDifficultyTimer(120, difficulty);
  }

  if (level === 1) {
    const wave = options?.wave || 1;
    const baseWave = wave === 1 ? 15 : wave === 2 ? 12 : 10;
    return applyDifficultyTimer(baseWave, difficulty);
  }
  if (level === 2) return applyDifficultyTimer(180, difficulty);
  if (level === 3) return applyDifficultyTimer(60, difficulty);
  if (level === 4) return applyDifficultyTimer(240, difficulty);
  if (level === 5) return applyDifficultyTimer(120, difficulty);
  return applyDifficultyTimer(300, difficulty);
}

/**
 * Returns automatic Reading Grace Period (seconds) where countdown pauses
 * so students can read newly appeared text/questions before timer starts ticking.
 */
export function getReadingGraceSeconds(phase: 'intro' | 'item' | 'numeracy'): number {
  if (phase === 'intro') return 6;
  if (phase === 'numeracy') return 5;
  return 4;
}

export function formatRoomDisplay(
  roomCode: string,
  gameMode: 'solo' | 'split' | 'webrtc'
): string {
  if (gameMode === 'solo') return '1P';
  if (gameMode === 'split') return '2P';
  const normalized = (roomCode || '').trim().toUpperCase();
  return normalized || 'BUMI-5A';
}

export interface PredicateResult {
  stars: 0 | 1 | 2 | 3;
  starText: string;
  title: string;
  needsRemedial: boolean;
}

/**
 * Sanitizes and validates student name input (2-15 chars, anti-empty, strips dangerous chars).
 */
export function validateAndSanitizePlayerName(rawInput: string): {
  valid: boolean;
  sanitized: string;
  error?: string;
} {
  const cleaned = rawInput
    .replace(/[<>"'`&/\\;{}()[\]=+$^*|~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length < 2) {
    return {
      valid: false,
      sanitized: cleaned,
      error: 'Nama siswa wajib diisi minimal 2 karakter (tanpa simbol berbahaya).',
    };
  }

  if (cleaned.length > 15) {
    return {
      valid: false,
      sanitized: cleaned.slice(0, 15),
      error: 'Nama siswa maksimal 15 karakter.',
    };
  }

  return { valid: true, sanitized: cleaned };
}

/**
 * Validates and sanitizes both Player 1 and Player 2 names for 2P Split Mode.
 */
export function validateDualPlayerNames(
  rawP1: string,
  rawP2: string
): {
  valid: boolean;
  p1Sanitized: string;
  p2Sanitized: string;
  p1Error?: string;
  p2Error?: string;
} {
  const res1 = validateAndSanitizePlayerName(rawP1);
  const res2 = validateAndSanitizePlayerName(rawP2);
  return {
    valid: res1.valid && res2.valid,
    p1Sanitized: res1.sanitized,
    p2Sanitized: res2.sanitized,
    p1Error: res1.valid ? undefined : 'Nama Pemain 1 wajib diisi (2–15 karakter).',
    p2Error: res2.valid ? undefined : 'Nama Pemain 2 wajib diisi (2–15 karakter).',
  };
}

/**
 * Returns the exact wave timer (seconds per item) for Level 1 (Detektif Sampah).
 */
export function getLevel1WaveDuration(wave: 1 | 2 | 3): number {
  if (wave === 1) return 4.5;
  if (wave === 2) return 3.5;
  return 2.8;
}

/**
 * Computes total score across C1-C6 (0 to 100 max).
 */
export function calculateTotalScore(scores: LevelScoreMap): number {
  const raw =
    Math.min(15, Math.max(0, scores.c1)) +
    Math.min(15, Math.max(0, scores.c2)) +
    Math.min(15, Math.max(0, scores.c3)) +
    Math.min(20, Math.max(0, scores.c4)) +
    Math.min(15, Math.max(0, scores.c5)) +
    Math.min(20, Math.max(0, scores.c6));
  return Math.round(Math.min(100, Math.max(0, raw)));
}

/**
 * Computes the official Star Predicate based on total score (0-100).
 */
export function evaluatePredicate(totalScore: number): PredicateResult {
  if (totalScore >= 90) {
    return {
      stars: 3,
      starText: '⭐⭐⭐',
      title: 'PENJAGA BUMI TELADAN NUSANTARA',
      needsRemedial: false,
    };
  }
  if (totalScore >= 75) {
    return {
      stars: 2,
      starText: '⭐⭐',
      title: 'PENJAGA ALAM BIJAKSANA',
      needsRemedial: false,
    };
  }
  if (totalScore >= 60) {
    return {
      stars: 1,
      starText: '⭐',
      title: 'SAHABAT LINGKUNGAN CILIK',
      needsRemedial: false,
    };
  }
  return {
    stars: 0,
    starText: '🌱',
    title: 'SESI REMEDIAL PENJAGA BUMI',
    needsRemedial: true,
  };
}

/**
 * Dual-Gauge Bar Dynamic Formula:
 * Initial: Eco-Health = 20%, Amanah = 50%.
 * Each completed level/milestone injects +13% to +15% bio-energy, reaching 100% upon Level 6 completion.
 */
export function calculateDualGauges(
  completedLevelsCount: number,
  currentLevelProgressRatio = 0
): { ecoHealth: number; amanah: number } {
  const clampedLevels = Math.min(6, Math.max(0, completedLevelsCount));
  const clampedRatio = Math.min(1, Math.max(0, currentLevelProgressRatio));

  if (clampedLevels >= 6) {
    return { ecoHealth: 100, amanah: 100 };
  }

  // Eco-Health rises from 20% to 100% across 6 levels (~13.33% per level)
  const ecoStep = 80 / 6;
  const ecoHealth = Math.min(
    100,
    Math.round(20 + (clampedLevels + clampedRatio) * ecoStep)
  );

  // Amanah rises from 50% to 100% across 6 levels (using +13% boost capped smoothly at 100%)
  const amanahStep = 50 / 6;
  const amanah = Math.min(
    100,
    Math.round(50 + (clampedLevels + clampedRatio) * amanahStep)
  );

  return { ecoHealth, amanah };
}

/**
 * Verifies Level 1 trash sorting action.
 */
export function verifyLevel1Sort(
  itemIndex: number,
  chosenDirection: 'KIRI' | 'KANAN' | 'ATAS'
): { correct: boolean; pointsDelta: number } {
  const spec = LEVEL_1_ITEMS[itemIndex];
  if (!spec) return { correct: false, pointsDelta: 0 };
  const correct = spec.direction === chosenDirection;
  return { correct, pointsDelta: correct ? 1 : 0 };
}

/**
 * Verifies Level 2 anagram word assembly.
 */
export function verifyLevel2Anagram(itemIndex: number, assembledWord: string): boolean {
  const spec = LEVEL_2_ANAGRAMS[itemIndex];
  if (!spec) return false;
  return spec.targetWord.toUpperCase() === assembledWord.trim().toUpperCase();
}

export interface Level1DeckItem {
  specIndex: number;
  item: TrashItemSpec;
}

/**
 * Generates two distinct randomized Level 1 item orders for 2P Split Mode so Player 1
 * and Player 2 never get the same trash object at the same step and cannot copy each other,
 * while preserving the Wave 1 -> Wave 2 -> Wave 3 progression.
 */
export function createLevel1SplitDecks(rng: () => number = Math.random): {
  p1: Level1DeckItem[];
  p2: Level1DeckItem[];
} {
  const waves = [1, 2, 3] as const;
  const p1: Level1DeckItem[] = [];
  const p2: Level1DeckItem[] = [];

  waves.forEach((waveNum, waveIdx) => {
    const waveIndices = LEVEL_1_ITEMS.map((item, idx) => ({ item, idx }))
      .filter((entry) => entry.item.wave === waveNum)
      .map((entry) => entry.idx);

    const p1Wave = shuffleWithRng(waveIndices, rng);
    let p2Wave = shuffleWithRng(waveIndices, rng);

    for (let attempt = 0; attempt < 24; attempt++) {
      const noSameIndex = p2Wave.every((idx, k) => idx !== p1Wave[k]);
      const diffFirstDir =
        waveIdx > 0 ||
        LEVEL_1_ITEMS[p2Wave[0]].direction !== LEVEL_1_ITEMS[p1Wave[0]].direction;
      if (noSameIndex && diffFirstDir) {
        break;
      }
      p2Wave = shuffleWithRng(waveIndices, rng);
    }

    // Deterministic derangement fallback if RNG didn't find one
    if (p1Wave.length > 1 && !p2Wave.every((idx, k) => idx !== p1Wave[k])) {
      let shift = 1;
      if (
        waveIdx === 0 &&
        p1Wave.length > 2 &&
        LEVEL_1_ITEMS[p1Wave[1]].direction === LEVEL_1_ITEMS[p1Wave[0]].direction
      ) {
        for (let s = 1; s < p1Wave.length; s++) {
          if (LEVEL_1_ITEMS[p1Wave[s]].direction !== LEVEL_1_ITEMS[p1Wave[0]].direction) {
            shift = s;
            break;
          }
        }
      }
      p2Wave = p1Wave.map((_, k) => p1Wave[(k + shift) % p1Wave.length]);
    }

    p1Wave.forEach((specIndex) => {
      p1.push({ specIndex, item: LEVEL_1_ITEMS[specIndex] });
    });
    p2Wave.forEach((specIndex) => {
      p2.push({ specIndex, item: LEVEL_1_ITEMS[specIndex] });
    });
  });

  return { p1, p2 };
}

export interface Level2DeckItem {
  specIndex: number;
  targetWord: string;
  scrambledLetters: string[];
  meaning: string;
  numeracyQuestion: string;
  options: { label: string; isCorrect: boolean }[];
}

function shuffleWithRng<T>(items: readonly T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function scrambleWordDistinct(
  targetWord: string,
  rng: () => number = Math.random,
  avoidLetters?: readonly string[]
): string[] {
  const base = targetWord.split('');
  const avoidStr = avoidLetters ? avoidLetters.join('') : '';
  let candidate = shuffleWithRng(base, rng);

  for (let attempt = 0; attempt < 16; attempt++) {
    const joined = candidate.join('');
    if (joined !== targetWord && (!avoidStr || joined !== avoidStr)) {
      return candidate;
    }
    candidate = shuffleWithRng(base, rng);
  }

  // Deterministic fallback rotation if RNG repeatedly hit targetWord
  if (candidate.join('') === targetWord && candidate.length > 1) {
    return [...candidate.slice(1), candidate[0]];
  }
  return candidate;
}

export function shuffleOptionsDistinct(
  options: readonly { label: string; isCorrect: boolean }[],
  rng: () => number = Math.random,
  avoidOptions?: readonly { label: string; isCorrect: boolean }[]
): { label: string; isCorrect: boolean }[] {
  const cloned = options.map((o) => ({ ...o }));
  const avoidKey = avoidOptions ? avoidOptions.map((o) => o.label).join('|') : '';
  const avoidCorrectIdx = avoidOptions ? avoidOptions.findIndex((o) => o.isCorrect) : -1;
  let candidate = shuffleWithRng(cloned, rng);

  for (let attempt = 0; attempt < 20; attempt++) {
    const key = candidate.map((o) => o.label).join('|');
    const correctIdx = candidate.findIndex((o) => o.isCorrect);
    const keyDiffers = !avoidKey || key !== avoidKey;
    const correctPosDiffers = avoidCorrectIdx < 0 || options.length < 2 || correctIdx !== avoidCorrectIdx;
    if (keyDiffers && correctPosDiffers) {
      return candidate;
    }
    candidate = shuffleWithRng(cloned, rng);
  }

  if (avoidKey && candidate.length > 1) {
    const rotated = [...candidate.slice(1), candidate[0]];
    if (
      rotated.map((o) => o.label).join('|') !== avoidKey &&
      (avoidCorrectIdx < 0 || rotated.findIndex((o) => o.isCorrect) !== avoidCorrectIdx)
    ) {
      return rotated;
    }
    return [...candidate.slice(2), candidate[0], candidate[1]].slice(0, candidate.length);
  }
  return candidate;
}

/**
 * Generates two distinct randomized Level 2 decks for 2P Split Mode so Player 1
 * and Player 2 have different word sequences, different scrambled tile layouts,
 * and different numeracy option orders to prevent copying.
 */
export function createLevel2SplitDecks(rng: () => number = Math.random): {
  p1: Level2DeckItem[];
  p2: Level2DeckItem[];
} {
  const indices = LEVEL_2_ANAGRAMS.map((_, idx) => idx);
  const p1Order = shuffleWithRng(indices, rng);
  let p2Order = shuffleWithRng(indices, rng);

  for (let attempt = 0; attempt < 10; attempt++) {
    if (
      p2Order[0] !== p1Order[0] &&
      p2Order.some((val, idx) => val !== p1Order[idx])
    ) {
      break;
    }
    p2Order = shuffleWithRng(indices, rng);
  }

  if (p2Order.length > 1 && (p2Order[0] === p1Order[0] || p2Order.every((v, i) => v === p1Order[i]))) {
    p2Order = [...p1Order.slice(1), p1Order[0]];
  }

  const p1ScrambledBySpec = new Map<number, string[]>();
  const p1OptionsBySpec = new Map<number, { label: string; isCorrect: boolean }[]>();

  const p1: Level2DeckItem[] = p1Order.map((specIndex) => {
    const spec = LEVEL_2_ANAGRAMS[specIndex];
    const scrambledLetters = scrambleWordDistinct(spec.targetWord, rng);
    const shuffledOptions = shuffleOptionsDistinct(spec.options, rng);
    p1ScrambledBySpec.set(specIndex, scrambledLetters);
    p1OptionsBySpec.set(specIndex, shuffledOptions);
    return {
      specIndex,
      targetWord: spec.targetWord,
      scrambledLetters,
      meaning: spec.meaning,
      numeracyQuestion: spec.numeracyQuestion,
      options: shuffledOptions,
    };
  });

  const p2: Level2DeckItem[] = p2Order.map((specIndex) => {
    const spec = LEVEL_2_ANAGRAMS[specIndex];
    const scrambledLetters = scrambleWordDistinct(
      spec.targetWord,
      rng,
      p1ScrambledBySpec.get(specIndex)
    );
    const shuffledOptions = shuffleOptionsDistinct(
      spec.options,
      rng,
      p1OptionsBySpec.get(specIndex)
    );
    return {
      specIndex,
      targetWord: spec.targetWord,
      scrambledLetters,
      meaning: spec.meaning,
      numeracyQuestion: spec.numeracyQuestion,
      options: shuffledOptions,
    };
  });

  return { p1, p2 };
}

export const LEVEL_3_BINS_ORDER = ['REDUCE', 'REUSE', 'RECYCLE'] as const;
export type Level3Bin = (typeof LEVEL_3_BINS_ORDER)[number];

/**
 * Steps the Level 3 gantry claw position left or right along REDUCE (Kiri) <-> REUSE (Tengah) <-> RECYCLE (Kanan).
 */
export function stepLevel3Bin(
  current: Level3Bin,
  direction: 'left' | 'right'
): Level3Bin {
  const idx = LEVEL_3_BINS_ORDER.indexOf(current);
  const safeIdx = idx === -1 ? 1 : idx;
  if (direction === 'left') {
    return LEVEL_3_BINS_ORDER[Math.max(0, safeIdx - 1)];
  }
  return LEVEL_3_BINS_ORDER[Math.min(LEVEL_3_BINS_ORDER.length - 1, safeIdx + 1)];
}

export function getLevel3ClawXForBin(bin: Level3Bin): number {
  if (bin === 'REDUCE') return -0.8;
  if (bin === 'RECYCLE') return 0.8;
  return 0;
}

/**
 * Verifies Level 3 claw drop into 3R bin.
 */
export function verifyLevel3Drop(
  itemIndex: number,
  targetBin: Level3Bin
): { correct: boolean; pointsDelta: number } {
  const spec = LEVEL_3_CLAW_ITEMS[itemIndex];
  if (!spec) return { correct: false, pointsDelta: 0 };
  const correct = spec.targetBin === targetBin;
  return { correct, pointsDelta: correct ? 2.5 : 0 };
}

/**
 * Verifies Level 4 citizen material selection (rejects hazardous slot).
 */
export function verifyLevel4MaterialSlot(
  citizenIndex: number,
  slotNumber: 1 | 2 | 3 | 4
): { isSafe: boolean; isRejectedSlot: boolean; reason?: string } {
  const citizen = LEVEL_4_CITIZENS[citizenIndex];
  if (!citizen) return { isSafe: false, isRejectedSlot: false };
  const mat = citizen.materials.find((m) => m.slot === slotNumber);
  if (!mat) return { isSafe: false, isRejectedSlot: false };
  return {
    isSafe: !mat.isHazardous,
    isRejectedSlot: citizen.rejectedSlot === slotNumber,
    reason: mat.hazardReason,
  };
}

export interface Level4MaterialSelectionResult {
  status: 'selected' | 'deselected' | 'complete' | 'hazard_decoy' | 'invalid';
  nextSelected: (1 | 2 | 3 | 4)[];
  isComplete: boolean;
  safeCount: number;
  reason?: string;
}

/**
 * Evaluates clicking a material card in Level 4 Phase 1:
 * Students must click all safe/suitable materials for the craft project while avoiding
 * the 1 hazardous/toxic/dangerous decoy material.
 */
export function evaluateLevel4MaterialSelection(
  citizenIndex: number,
  currentlySelected: readonly (1 | 2 | 3 | 4)[],
  clickedSlot: 1 | 2 | 3 | 4
): Level4MaterialSelectionResult {
  const citizen = LEVEL_4_CITIZENS[citizenIndex];
  if (!citizen) {
    return {
      status: 'invalid',
      nextSelected: [...currentlySelected],
      isComplete: false,
      safeCount: 0,
    };
  }
  const mat = citizen.materials.find((m) => m.slot === clickedSlot);
  if (!mat) {
    return {
      status: 'invalid',
      nextSelected: [...currentlySelected],
      isComplete: false,
      safeCount: 0,
    };
  }

  const safeSlots = citizen.materials.filter((m) => !m.isHazardous).map((m) => m.slot);
  const safeCount = safeSlots.length;

  if (mat.isHazardous) {
    return {
      status: 'hazard_decoy',
      nextSelected: [...currentlySelected],
      isComplete: false,
      safeCount,
      reason: mat.hazardReason,
    };
  }

  if (currentlySelected.includes(clickedSlot)) {
    const nextSelected = currentlySelected.filter((s) => s !== clickedSlot);
    return {
      status: 'deselected',
      nextSelected,
      isComplete: false,
      safeCount,
    };
  }

  const nextSelected = [...currentlySelected, clickedSlot];
  const isComplete = nextSelected.length >= safeCount;
  return {
    status: isComplete ? 'complete' : 'selected',
    nextSelected,
    isComplete,
    safeCount,
  };
}

export const LEVEL_4_INTERACT_RADIUS = 4.6;

/**
 * Finds the nearest citizen index within maxDist of (px, pz), or null if none in range.
 */
export function findNearestCitizenIndex(
  px: number,
  pz: number,
  citizenPositions: readonly [number, number][],
  maxDist: number = LEVEL_4_INTERACT_RADIUS
): number | null {
  let bestIdx: number | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < citizenPositions.length; i++) {
    const [cx, cz] = citizenPositions[i];
    const dist = Math.hypot(px - cx, pz - cz);
    if (dist <= maxDist && dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Determines whether pressing [E] can open a citizen quest modal in Level 4.
 */
export function evaluateCitizenInteraction(
  nearbyCitizenIdx: number | null,
  completedCitizens: readonly number[]
): {
  canOpen: boolean;
  status: 'no_npc' | 'already_done' | 'ready';
  citizenIndex: number | null;
} {
  if (nearbyCitizenIdx === null) {
    return { canOpen: false, status: 'no_npc', citizenIndex: null };
  }
  if (completedCitizens.includes(nearbyCitizenIdx)) {
    return { canOpen: false, status: 'already_done', citizenIndex: nearbyCitizenIdx };
  }
  return { canOpen: true, status: 'ready', citizenIndex: nearbyCitizenIdx };
}

export interface NpcScatterOptions {
  count: number;
  minX?: number;
  maxX?: number;
  minZ?: number;
  maxZ?: number;
  minSpacing?: number;
  spawnX?: number;
  spawnZ?: number;
  avoidSpawnRadius?: number;
  avoidBoxes?: readonly { minX: number; maxX: number; minZ: number; maxZ: number }[];
  rng?: () => number;
}

function isIrregularNonPatternLayout(pts: readonly [number, number][]): boolean {
  if (pts.length < 3) return true;

  // 1. Reject any collinear triple (area of triangle < 12)
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      for (let k = j + 1; k < pts.length; k++) {
        const [ax, az] = pts[i];
        const [bx, bz] = pts[j];
        const [cx, cz] = pts[k];
        const area2 = Math.abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax));
        if (area2 < 24) return false;
      }
    }
  }

  // 2. Reject circular ring symmetry (radii from origin must vary meaningfully)
  const radii = pts.map(([x, z]) => Math.hypot(x, z - 1));
  const minR = Math.min(...radii);
  const maxR = Math.max(...radii);
  if (maxR - minR < 4.5) return false;

  // 3. Reject left-right mirror symmetry pairs
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (Math.abs(pts[i][0] + pts[j][0]) < 2.2 && Math.abs(pts[i][1] - pts[j][1]) < 2.2) {
        return false;
      }
    }
  }

  // 4. Require at least 3 distinct quadrants so NPCs don't clump in one corner
  const quadrants = new Set<string>();
  pts.forEach(([x, z]) => {
    quadrants.add(`${x >= 0 ? 'R' : 'L'}${z >= 2 ? 'S' : 'N'}`);
  });
  return quadrants.size >= 3;
}

/**
 * Generates irregular, non-patterned 3D world positions [x, z] for NPCs so they
 * never form predictable grids, lines, or symmetric rings, while avoiding spawn,
 * static 3D landmarks, and overlapping each other.
 */
export function generateRandomizedNpcPositions(options: NpcScatterOptions): [number, number][] {
  const {
    count,
    minX = -17.5,
    maxX = 17.5,
    minZ = -13.5,
    maxZ = 16.0,
    minSpacing = 8.0,
    spawnX = 0,
    spawnZ = 4,
    avoidSpawnRadius = 7.0,
    avoidBoxes = [],
    rng = Math.random,
  } = options;

  const isPointValid = (x: number, z: number, existing: readonly [number, number][]) => {
    if (Math.hypot(x - spawnX, z - spawnZ) < avoidSpawnRadius) return false;
    for (const box of avoidBoxes) {
      if (x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ) {
        return false;
      }
    }
    for (const [ex, ez] of existing) {
      if (Math.hypot(x - ex, z - ez) < minSpacing) return false;
    }
    return true;
  };

  for (let layoutAttempt = 0; layoutAttempt < 80; layoutAttempt++) {
    const picked: [number, number][] = [];
    for (let i = 0; i < count; i++) {
      let placed = false;
      for (let ptAttempt = 0; ptAttempt < 60; ptAttempt++) {
        const x = Number((minX + rng() * (maxX - minX)).toFixed(2));
        const z = Number((minZ + rng() * (maxZ - minZ)).toFixed(2));
        if (isPointValid(x, z, picked)) {
          picked.push([x, z]);
          placed = true;
          break;
        }
      }
      if (!placed) break;
    }
    if (picked.length === count && isIrregularNonPatternLayout(picked)) {
      return picked;
    }
  }

  // Irregular asymmetric fallback pool shuffled per RNG
  const fallbackPool: [number, number][] = [
    [-15.4, -7.8],
    [11.6, -11.4],
    [-11.2, 13.7],
    [16.3, 6.2],
    [3.8, 15.1],
    [-8.5, -12.6],
    [14.2, -3.5],
  ];
  return shuffleWithRng(fallbackPool, rng).slice(0, count);
}

export function createLevel4NpcPositions(rng: () => number = Math.random): [number, number][] {
  return generateRandomizedNpcPositions({
    count: LEVEL_4_CITIZENS.length,
    minX: -17.5,
    maxX: 17.5,
    minZ: -14.5,
    maxZ: 16.0,
    minSpacing: 8.2,
    spawnX: 0,
    spawnZ: 4,
    avoidSpawnRadius: 7.0,
    avoidBoxes: [
      { minX: -3.4, maxX: 3.4, minZ: -6.4, maxZ: -0.2 }, // Gazebo
      { minX: -7.0, maxX: 7.0, minZ: -17.0, maxZ: -10.0 }, // School
    ],
    rng,
  });
}

export function createLevel5NpcPositions(rng: () => number = Math.random): [number, number][] {
  return generateRandomizedNpcPositions({
    count: LEVEL_5_ZONES.length,
    minX: -17.5,
    maxX: 17.5,
    minZ: -12.5,
    maxZ: 16.0,
    minSpacing: 8.2,
    spawnX: 0,
    spawnZ: 4,
    avoidSpawnRadius: 7.0,
    avoidBoxes: [
      { minX: -7.0, maxX: 7.0, minZ: -17.0, maxZ: -10.0 }, // North border area
    ],
    rng,
  });
}

/**
 * Computes normalized movement vector (nx, nz) and clamped thumb-knob offsets
 * from a pointer displacement (dx, dy) relative to the virtual joystick center.
 */
export function computeJoystickVector(
  dx: number,
  dy: number,
  maxRadius: number,
  deadzone: number = 0.14
): { nx: number; nz: number; magnitude: number; knobX: number; knobY: number } {
  if (maxRadius <= 0) {
    return { nx: 0, nz: 0, magnitude: 0, knobX: 0, knobY: 0 };
  }
  const dist = Math.hypot(dx, dy);
  if (dist <= 0) {
    return { nx: 0, nz: 0, magnitude: 0, knobX: 0, knobY: 0 };
  }

  const clampedDist = Math.min(dist, maxRadius);
  const ux = dx / dist;
  const uy = dy / dist;
  const knobX = ux * clampedDist;
  const knobY = uy * clampedDist;
  const rawMag = clampedDist / maxRadius;

  if (rawMag < deadzone) {
    return { nx: 0, nz: 0, magnitude: 0, knobX, knobY };
  }

  const magnitude = Math.min(1, (rawMag - deadzone) / Math.max(0.001, 1 - deadzone));
  return {
    nx: ux * magnitude,
    nz: uy * magnitude,
    magnitude,
    knobX,
    knobY,
  };
}

/**
 * Verifies Level 5 ecosystem policy evaluation & updates conservation coins/energy.
 */
export function verifyLevel5Decision(
  zoneIndex: number,
  optionCode: 'A' | 'B' | 'C',
  currentCoins: number,
  currentEnergy: number
): {
  isBest: boolean;
  nextCoins: number;
  nextEnergy: number;
  feedback: string;
} {
  const zone = LEVEL_5_ZONES[zoneIndex];
  if (!zone) {
    return { isBest: false, nextCoins: currentCoins, nextEnergy: currentEnergy, feedback: '' };
  }
  const alt = zone.alternatives.find((a) => a.code === optionCode);
  if (!alt) {
    return { isBest: false, nextCoins: currentCoins, nextEnergy: currentEnergy, feedback: '' };
  }
  if (!alt.isBest) {
    return {
      isBest: false,
      nextCoins: currentCoins,
      nextEnergy: currentEnergy,
      feedback: alt.impactFeedback,
    };
  }
  // Zone 2 includes +5 Koin gotong royong community bonus as specified in Blueprint Numeracy (70 - 25 + 5 = 50)
  const bonusCoins = zone.id === 2 ? 5 : 0;
  return {
    isBest: true,
    nextCoins: Math.max(0, currentCoins - alt.coinCost + bonusCoins),
    nextEnergy: Math.max(0, currentEnergy - alt.energyCost),
    feedback: alt.impactFeedback,
  };
}

/**
 * Verifies Level 6 3-Pillar Masterplan combination for a given Nusantara island.
 */
export function verifyLevel6Masterplan(
  islandIndex: number,
  selectedSlots: [number, number, number]
): boolean {
  const island = LEVEL_6_ISLANDS[islandIndex];
  if (!island) return false;
  return (
    island.correctPillarSlots[0] === selectedSlots[0] &&
    island.correctPillarSlots[1] === selectedSlots[1] &&
    island.correctPillarSlots[2] === selectedSlots[2]
  );
}

/**
 * Spatial coordinates [x, z] for the 5 interactive Menara Radar towers in Level 6 Core Arena.
 * Ordered to match LEVEL_6_ISLANDS (0: Jawa, 1: Sumatra, 2: Kalimantan, 3: Bali/NT, 4: Papua)
 * and safely separated from player spawn points (±1.8, 3.6) and the central Energy Core (0, 0).
 */
export const LEVEL_6_TOWER_POSITIONS: readonly [number, number][] = [
  [-6.8, 11.2],  // 0: Jawa (Wonogiri & Girimarto)
  [-15.2, -3.5], // 1: Sumatra (Siak, Pelalawan, Tanjab Timur)
  [-2.0, -11.5], // 2: Kalimantan (Kumai & Sungai Wain)
  [7.5, 11.2],   // 3: Bali & Nusa Tenggara (Pemuteran, Penida, Gili Matra, Komodo)
  [15.2, -2.5],  // 4: Papua (Teluk Youtefa & Teluk Bintuni)
];

export const LEVEL_6_INTERACT_RADIUS = 4.6;
export const LEVEL_6_TOUCH_RADIUS = 2.05;
export const LEVEL_6_TOUCH_RELEASE_RADIUS = 2.45;

/**
 * Edge-triggered physical tower touch detector for Level 6:
 * Triggers when player physically touches an unsolved Menara Radar (dist <= touchRadius),
 * and remembers the touched tower until player steps outside releaseRadius so closing
 * the modal does not immediately trap the player in a re-open loop.
 */
export function detectTowerTouchTrigger(
  px: number,
  pz: number,
  lastTouchedIdx: number | null,
  completedTowerIndices: readonly number[],
  towerPositions: readonly [number, number][] = LEVEL_6_TOWER_POSITIONS,
  touchRadius: number = LEVEL_6_TOUCH_RADIUS,
  releaseRadius: number = LEVEL_6_TOUCH_RELEASE_RADIUS
): { nextLastTouchedIdx: number | null; triggeredIdx: number | null } {
  if (lastTouchedIdx !== null) {
    const prevPos = towerPositions[lastTouchedIdx];
    if (prevPos && Math.hypot(px - prevPos[0], pz - prevPos[1]) <= releaseRadius) {
      return { nextLastTouchedIdx: lastTouchedIdx, triggeredIdx: null };
    }
  }

  const touchedIdx = findNearestCitizenIndex(px, pz, towerPositions, touchRadius);
  if (touchedIdx === null) {
    return { nextLastTouchedIdx: null, triggeredIdx: null };
  }

  if (completedTowerIndices.includes(touchedIdx)) {
    return { nextLastTouchedIdx: touchedIdx, triggeredIdx: null };
  }

  return { nextLastTouchedIdx: touchedIdx, triggeredIdx: touchedIdx };
}

function buildDerangedOrderPair(
  length: number,
  rng: () => number
): { p1Order: number[]; p2Order: number[] } {
  const indices = Array.from({ length }, (_, i) => i);
  const p1Order = shuffleWithRng(indices, rng);
  let p2Order = shuffleWithRng(indices, rng);

  for (let attempt = 0; attempt < 24; attempt++) {
    if (p2Order.every((val, idx) => val !== p1Order[idx])) {
      return { p1Order, p2Order };
    }
    p2Order = shuffleWithRng(indices, rng);
  }

  if (length > 1) {
    p2Order = p1Order.map((_, idx) => p1Order[(idx + 1) % length]);
  }
  return { p1Order, p2Order };
}

function shuffleDistinctArray<T>(
  items: readonly T[],
  getKey: (item: T) => string | number,
  rng: () => number,
  avoidItems?: readonly T[],
  mustMovePredicate?: (item: T) => boolean
): T[] {
  const cloned = [...items];
  const avoidKey = avoidItems ? avoidItems.map(getKey).join('|') : '';
  const avoidTargetIdx =
    avoidItems && mustMovePredicate ? avoidItems.findIndex(mustMovePredicate) : -1;

  let candidate = shuffleWithRng(cloned, rng);
  for (let attempt = 0; attempt < 24; attempt++) {
    const key = candidate.map(getKey).join('|');
    const keyDiffers = !avoidKey || key !== avoidKey;
    const targetDiffers =
      avoidTargetIdx < 0 ||
      items.length < 2 ||
      candidate.findIndex(mustMovePredicate!) !== avoidTargetIdx;
    if (keyDiffers && targetDiffers) {
      return candidate;
    }
    candidate = shuffleWithRng(cloned, rng);
  }

  if (avoidKey && candidate.length > 1) {
    for (let shift = 1; shift < candidate.length; shift++) {
      const rotated = candidate.map((_, idx) => candidate[(idx + shift) % candidate.length]);
      const keyDiffers = rotated.map(getKey).join('|') !== avoidKey;
      const targetDiffers =
        avoidTargetIdx < 0 || rotated.findIndex(mustMovePredicate!) !== avoidTargetIdx;
      if (keyDiffers && targetDiffers) {
        return rotated;
      }
    }
    return [...candidate.slice(1), candidate[0]];
  }
  return candidate;
}

export interface Level3DeckItem {
  specIndex: number;
  item: ClawItemSpec;
  options: { label: string; isCorrect: boolean }[];
}

/**
 * Generates two distinct Level 3 decks for 2P Split Mode so P1 and P2 face
 * different claw items at every step (starting with different 3R target bins)
 * and differently ordered numeracy answer options.
 */
export function createLevel3SplitDecks(rng: () => number = Math.random): {
  p1: Level3DeckItem[];
  p2: Level3DeckItem[];
} {
  const { p1Order, p2Order } = buildDerangedOrderPair(LEVEL_3_CLAW_ITEMS.length, rng);

  // Ensure step 0 also targets different 3R bins between P1 and P2
  if (
    p2Order.length > 1 &&
    LEVEL_3_CLAW_ITEMS[p1Order[0]].targetBin === LEVEL_3_CLAW_ITEMS[p2Order[0]].targetBin
  ) {
    const swapIdx = p2Order.findIndex(
      (val, idx) =>
        idx > 0 &&
        LEVEL_3_CLAW_ITEMS[val].targetBin !== LEVEL_3_CLAW_ITEMS[p1Order[0]].targetBin &&
        val !== p1Order[0] &&
        p2Order[0] !== p1Order[idx]
    );
    if (swapIdx > 0) {
      [p2Order[0], p2Order[swapIdx]] = [p2Order[swapIdx], p2Order[0]];
    }
  }

  const p1OptsBySpec = new Map<number, { label: string; isCorrect: boolean }[]>();
  const p1: Level3DeckItem[] = p1Order.map((specIndex) => {
    const item = LEVEL_3_CLAW_ITEMS[specIndex];
    const options = shuffleOptionsDistinct(item.options, rng);
    p1OptsBySpec.set(specIndex, options);
    return { specIndex, item, options };
  });

  const p2: Level3DeckItem[] = p2Order.map((specIndex) => {
    const item = LEVEL_3_CLAW_ITEMS[specIndex];
    const options = shuffleOptionsDistinct(item.options, rng, p1OptsBySpec.get(specIndex));
    return { specIndex, item, options };
  });

  return { p1, p2 };
}

export interface Level4DeckItem {
  specIndex: number;
  citizen: CitizenQuestSpec;
  materials: CitizenQuestSpec['materials'];
  options: { label: string; isCorrect: boolean }[];
}

/**
 * Generates two distinct Level 4 decks for 2P Split Mode so P1 and P2 face
 * different project quests at every citizen station index (0..4), with
 * shuffled material card positions and shuffled numeracy answer orders that
 * differ both per-station and per-specIndex.
 */
export function createLevel4SplitDecks(rng: () => number = Math.random): {
  p1: Level4DeckItem[];
  p2: Level4DeckItem[];
} {
  const { p1Order, p2Order } = buildDerangedOrderPair(LEVEL_4_CITIZENS.length, rng);

  const p1MatsBySpec = new Map<number, CitizenQuestSpec['materials']>();
  const p1OptsBySpec = new Map<number, { label: string; isCorrect: boolean }[]>();

  const p1: Level4DeckItem[] = p1Order.map((specIndex) => {
    const citizen = LEVEL_4_CITIZENS[specIndex];
    const materials = shuffleDistinctArray(citizen.materials, (m) => m.slot, rng);
    const options = shuffleOptionsDistinct(citizen.options, rng);
    p1MatsBySpec.set(specIndex, materials);
    p1OptsBySpec.set(specIndex, options);
    return { specIndex, citizen, materials, options };
  });

  const p2: Level4DeckItem[] = p2Order.map((specIndex, stationIdx) => {
    const citizen = LEVEL_4_CITIZENS[specIndex];
    const sameSpecP1Mats = p1MatsBySpec.get(specIndex)!;
    const sameStationP1Mats = p1[stationIdx].materials;
    const forbiddenHazIndices = new Set<number>([
      sameSpecP1Mats.findIndex((m) => m.isHazardous),
      sameStationP1Mats.findIndex((m) => m.isHazardous),
    ]);

    let materials = shuffleDistinctArray(
      citizen.materials,
      (m) => m.slot,
      rng,
      sameSpecP1Mats,
      (m) => m.isHazardous
    );
    for (let attempt = 0; attempt < 16; attempt++) {
      const hazIdx = materials.findIndex((m) => m.isHazardous);
      if (!forbiddenHazIndices.has(hazIdx)) break;
      materials = shuffleDistinctArray(
        citizen.materials,
        (m) => m.slot,
        rng,
        sameSpecP1Mats,
        (m) => m.isHazardous
      );
    }

    const sameSpecP1Opts = p1OptsBySpec.get(specIndex)!;
    const sameStationP1Opts = p1[stationIdx].options;
    const forbiddenOptIndices = new Set<number>([
      sameSpecP1Opts.findIndex((o) => o.isCorrect),
      sameStationP1Opts.findIndex((o) => o.isCorrect),
    ]);

    let options = shuffleOptionsDistinct(citizen.options, rng, sameSpecP1Opts);
    for (let attempt = 0; attempt < 16; attempt++) {
      const correctIdx = options.findIndex((o) => o.isCorrect);
      if (!forbiddenOptIndices.has(correctIdx)) break;
      options = shuffleOptionsDistinct(citizen.options, rng, sameSpecP1Opts);
    }
    if (forbiddenOptIndices.has(options.findIndex((o) => o.isCorrect))) {
      for (let shift = 1; shift < options.length; shift++) {
        const rotated = options.map((_, k) => options[(k + shift) % options.length]);
        if (!forbiddenOptIndices.has(rotated.findIndex((o) => o.isCorrect))) {
          options = rotated;
          break;
        }
      }
    }

    return { specIndex, citizen, materials, options };
  });

  return { p1, p2 };
}

export interface Level5DeckItem {
  specIndex: number;
  zone: EcosystemZoneSpec;
  alternatives: EcosystemZoneSpec['alternatives'];
  options: { label: string; isCorrect: boolean }[];
}

/**
 * Generates two distinct Level 5 decks for 2P Split Mode so P1 and P2 receive
 * different zone quests at every NPC station (0..2), with shuffled action cards
 * and shuffled numeracy answer options that differ both per-station and per-specIndex.
 */
export function createLevel5SplitDecks(rng: () => number = Math.random): {
  p1: Level5DeckItem[];
  p2: Level5DeckItem[];
} {
  const { p1Order, p2Order } = buildDerangedOrderPair(LEVEL_5_ZONES.length, rng);

  const p1AltsBySpec = new Map<number, EcosystemZoneSpec['alternatives']>();
  const p1OptsBySpec = new Map<number, { label: string; isCorrect: boolean }[]>();

  const p1: Level5DeckItem[] = p1Order.map((specIndex) => {
    const zone = LEVEL_5_ZONES[specIndex];
    const alternatives = shuffleDistinctArray(zone.alternatives, (a) => a.code, rng);
    const options = shuffleOptionsDistinct(zone.options, rng);
    p1AltsBySpec.set(specIndex, alternatives);
    p1OptsBySpec.set(specIndex, options);
    return { specIndex, zone, alternatives, options };
  });

  const p2: Level5DeckItem[] = p2Order.map((specIndex, stationIdx) => {
    const zone = LEVEL_5_ZONES[specIndex];
    const sameSpecP1Alts = p1AltsBySpec.get(specIndex)!;
    const sameStationP1Alts = p1[stationIdx].alternatives;
    const forbiddenBestIndices = new Set<number>([
      sameSpecP1Alts.findIndex((a) => a.isBest),
      sameStationP1Alts.findIndex((a) => a.isBest),
    ]);

    let alternatives = shuffleDistinctArray(
      zone.alternatives,
      (a) => a.code,
      rng,
      sameSpecP1Alts,
      (a) => a.isBest
    );
    for (let attempt = 0; attempt < 16; attempt++) {
      if (!forbiddenBestIndices.has(alternatives.findIndex((a) => a.isBest))) break;
      alternatives = shuffleDistinctArray(
        zone.alternatives,
        (a) => a.code,
        rng,
        sameSpecP1Alts,
        (a) => a.isBest
      );
    }
    if (forbiddenBestIndices.has(alternatives.findIndex((a) => a.isBest))) {
      for (let shift = 1; shift < alternatives.length; shift++) {
        const rotated = alternatives.map((_, k) => alternatives[(k + shift) % alternatives.length]);
        if (!forbiddenBestIndices.has(rotated.findIndex((a) => a.isBest))) {
          alternatives = rotated;
          break;
        }
      }
    }

    const sameSpecP1Opts = p1OptsBySpec.get(specIndex)!;
    const sameStationP1Opts = p1[stationIdx].options;
    const forbiddenOptIndices = new Set<number>([
      sameSpecP1Opts.findIndex((o) => o.isCorrect),
      sameStationP1Opts.findIndex((o) => o.isCorrect),
    ]);

    let options = shuffleOptionsDistinct(zone.options, rng, sameSpecP1Opts);
    for (let attempt = 0; attempt < 16; attempt++) {
      if (!forbiddenOptIndices.has(options.findIndex((o) => o.isCorrect))) break;
      options = shuffleOptionsDistinct(zone.options, rng, sameSpecP1Opts);
    }
    if (forbiddenOptIndices.has(options.findIndex((o) => o.isCorrect))) {
      for (let shift = 1; shift < options.length; shift++) {
        const rotated = options.map((_, k) => options[(k + shift) % options.length]);
        if (!forbiddenOptIndices.has(rotated.findIndex((o) => o.isCorrect))) {
          options = rotated;
          break;
        }
      }
    }

    return { specIndex, zone, alternatives, options };
  });

  return { p1, p2 };
}

export interface Level6DeckItem {
  specIndex: number;
  island: RadarIslandSpec;
  pillarChoices: RadarIslandSpec['pillarChoices'];
  options: { label: string; isCorrect: boolean }[];
}

/**
 * Generates two distinct Level 6 decks for 2P Split Mode so P1 and P2 handle
 * different Nusantara islands at every step, with shuffled pillar slot choices
 * (correct choice at different row positions) and shuffled numeracy options.
 */
export function createLevel6SplitDecks(rng: () => number = Math.random): {
  p1: Level6DeckItem[];
  p2: Level6DeckItem[];
} {
  const { p1Order, p2Order } = buildDerangedOrderPair(LEVEL_6_ISLANDS.length, rng);

  const p1PillarsBySpec = new Map<number, RadarIslandSpec['pillarChoices']>();
  const p1OptsBySpec = new Map<number, { label: string; isCorrect: boolean }[]>();

  const p1: Level6DeckItem[] = p1Order.map((specIndex) => {
    const island = LEVEL_6_ISLANDS[specIndex];
    const pillarChoices = island.pillarChoices.map((pillar) => ({
      pillarName: pillar.pillarName,
      slots: shuffleDistinctArray(pillar.slots, (s) => s.slotNum, rng),
    }));
    const options = shuffleOptionsDistinct(island.options, rng);
    p1PillarsBySpec.set(specIndex, pillarChoices);
    p1OptsBySpec.set(specIndex, options);
    return { specIndex, island, pillarChoices, options };
  });

  const p2: Level6DeckItem[] = p2Order.map((specIndex) => {
    const island = LEVEL_6_ISLANDS[specIndex];
    const p1Pillars = p1PillarsBySpec.get(specIndex)!;
    const pillarChoices = island.pillarChoices.map((pillar, pillarIdx) => {
      const correctSlot = island.correctPillarSlots[pillarIdx];
      return {
        pillarName: pillar.pillarName,
        slots: shuffleDistinctArray(
          pillar.slots,
          (s) => s.slotNum,
          rng,
          p1Pillars[pillarIdx].slots,
          (s) => s.slotNum === correctSlot
        ),
      };
    });
    const options = shuffleOptionsDistinct(island.options, rng, p1OptsBySpec.get(specIndex));
    return { specIndex, island, pillarChoices, options };
  });

  return { p1, p2 };
}

export interface MobileLevel3CameraSpec {
  fov: number;
  camPos: [number, number, number];
  lookAt: [number, number, number];
  viewOffsetYFrac: number;
}

/**
 * Computes zoomed-out camera & upward viewport shift for Level 3 (Mesin Capit 3R)
 * exclusively on mobile phone screens (viewportWidth < 768px) so the claw crane and
 * ALL three bins (REDUCE at x=-2.8, REUSE at x=0, RECYCLE at x=+2.8) remain fully visible
 * above the bottom question/control dock. Returns null for PC/Tablet/IFP (>= 768px).
 */
export function computeMobileLevel3CameraSpec(
  viewportWidth: number,
  viewportHeight: number,
  isSplitMode: boolean = false
): MobileLevel3CameraSpec | null {
  if (viewportWidth >= 768 || viewportWidth <= 0 || viewportHeight <= 0) {
    return null;
  }

  const effectiveWidth = isSplitMode ? viewportWidth / 2 : viewportWidth;
  const aspect = Math.max(0.24, effectiveWidth / viewportHeight);
  const fov = isSplitMode ? 76 : aspect < 0.68 ? 78 : 66;
  const tanHalfV = Math.tan(((fov / 2) * Math.PI) / 180);

  // Chute outer edges span ±3.61m (glow frames ±3.67m) and gantry pillars ±4.2m.
  // Using wider FOV on portrait phones keeps camera much closer (~11.3m) so the claw & 3 bins look big and clear.
  const requiredHalfSpanX = 4.25;
  const dist = Math.max(8.2, Math.min(20.5, requiredHalfSpanX / (aspect * tanHalfV)));

  return {
    fov,
    camPos: [0, aspect < 1 ? 3.55 : 3.45, Number((-2.6 + dist).toFixed(2))],
    lookAt: [0, 2.55, -2.6],
    viewOffsetYFrac: isSplitMode ? 0.105 : aspect < 1 ? 0.085 : 0.075,
  };
}

/**
 * Computes zoomed-out camera & upward viewport shift for Level 2 (Rahasia 3R - Meja Balok Huruf 3D)
 * exclusively on mobile phone screens (viewportWidth < 768px) so the 3D wooden letter rack (up to 7 slots, ±2.85m),
 * dynamic status banner, and 3R concept pedestals remain fully visible above the bottom question/control dock.
 * Returns null for PC/Tablet/IFP (>= 768px).
 */
export function computeMobileLevel2CameraSpec(
  viewportWidth: number,
  viewportHeight: number,
  isSplitMode: boolean = false
): MobileLevel3CameraSpec | null {
  if (viewportWidth >= 768 || viewportWidth <= 0 || viewportHeight <= 0) {
    return null;
  }

  const effectiveWidth = isSplitMode ? viewportWidth / 2 : viewportWidth;
  const aspect = Math.max(0.24, effectiveWidth / viewportHeight);
  const fov = isSplitMode ? 74 : aspect < 0.68 ? 72 : 62;
  const tanHalfV = Math.tan(((fov / 2) * Math.PI) / 180);

  // 3D Letter Rack spans ±2.85m at z = -1.5 (with 3R pedestals framed behind it).
  const requiredHalfSpanX = 3.25;
  const dist = Math.max(6.8, Math.min(18.5, requiredHalfSpanX / (aspect * tanHalfV)));

  return {
    fov,
    camPos: [0, aspect < 1 ? 3.15 : 3.05, Number((-1.5 + dist).toFixed(2))],
    lookAt: [0, 1.95, -1.5],
    viewOffsetYFrac: isSplitMode ? 0.115 : aspect < 1 ? 0.095 : 0.075,
  };
}

/**
 * Resolves the active cursor index among unpicked scrambled letters in Level 2.
 */
export function resolveLevel2CursorIndex(
  scrambledLength: number,
  pickedIndices: readonly number[],
  preferredIndex: number
): number {
  if (scrambledLength <= 0) return 0;
  const pickedSet = new Set(pickedIndices);
  const clamped = Math.max(0, Math.min(scrambledLength - 1, preferredIndex));
  if (!pickedSet.has(clamped)) {
    return clamped;
  }
  for (let offset = 1; offset < scrambledLength; offset++) {
    const rightIdx = (clamped + offset) % scrambledLength;
    if (!pickedSet.has(rightIdx)) return rightIdx;
  }
  return 0;
}

/**
 * Steps the Level 2 letter selector left or right across available (unpicked) scrambled letters.
 */
export function stepLevel2AvailableLetterIndex(
  scrambledLength: number,
  pickedIndices: readonly number[],
  currentCursor: number,
  direction: 'left' | 'right'
): number {
  if (scrambledLength <= 0) return 0;
  const available: number[] = [];
  const pickedSet = new Set(pickedIndices);
  for (let i = 0; i < scrambledLength; i++) {
    if (!pickedSet.has(i)) available.push(i);
  }
  if (available.length === 0) return 0;

  const resolved = resolveLevel2CursorIndex(scrambledLength, pickedIndices, currentCursor);
  const pos = available.indexOf(resolved);
  if (pos === -1) return available[0];

  const delta = direction === 'left' ? -1 : 1;
  const nextPos = (pos + delta + available.length) % available.length;
  return available[nextPos];
}

export interface NarratorVoiceProfile {
  persona: 'rahma' | 'ilyas';
  displayName: string;
  voiceName: 'Kore' | 'Charon';
  stylePrompt: string;
  fallbackPitch: number;
  fallbackPitchSyntheticMale?: number;
  fallbackRate: number;
  sentencePauseMs: number;
}

export const NARRATOR_VOICE_PROFILES: Record<'rahma' | 'ilyas', NarratorVoiceProfile> = {
  ilyas: {
    persona: 'ilyas',
    displayName: 'Pak Guru Ilyas',
    voiceName: 'Charon',
    stylePrompt:
      'A mature male voice, gentle, expressive, and deep. Sounds like an engaging literature teacher or wise storyteller. Very warm with dynamic pacing to keep the listener hooked.',
    fallbackPitch: 0.86,
    fallbackPitchSyntheticMale: 0.72,
    fallbackRate: 0.92,
    sentencePauseMs: 280,
  },
  rahma: {
    persona: 'rahma',
    displayName: 'Bu Guru Rahma',
    voiceName: 'Kore',
    stylePrompt:
      'A mature female voice, soft, soothing, and highly expressive. Sounds like a gentle arts or language teacher reading a storybook. Warm, dynamic, and emotionally engaging.',
    fallbackPitch: 1.04,
    fallbackRate: 0.93,
    sentencePauseMs: 240,
  },
};

export function getNarratorVoiceProfile(persona: string): NarratorVoiceProfile {
  if (persona === 'ilyas') {
    return NARRATOR_VOICE_PROFILES.ilyas;
  }
  return NARRATOR_VOICE_PROFILES.rahma;
}

/**
 * Strictly partitions a touch/pointer X coordinate into Player 1 (Left Screen = 1)
 * or Player 2 (Right Screen = 2) when 2P Split Mode is active.
 */
export function resolveSplitTouchSlot(
  clientX: number,
  rectLeft: number,
  rectWidth: number,
  isSplitMode: boolean
): 1 | 2 {
  if (!isSplitMode || rectWidth <= 0) return 1;
  const relX = clientX - rectLeft;
  return relX >= rectWidth * 0.5 ? 2 : 1;
}

/**
 * Evaluates whether a pointer/touch trigger should be accepted per pointerId.
 * Because tracking is keyed by pointerId (and scoped per player slot), two players
 * touching Left and Right screens at the exact same millisecond (nowMs) with different
 * pointerIds are BOTH accepted without blocking each other.
 */
export function shouldAcceptMultiTouchTrigger(
  pointerId: number,
  lastTriggerByPointer: Map<number, number>,
  nowMs: number,
  cooldownMs: number = 65
): boolean {
  const prev = lastTriggerByPointer.get(pointerId);
  if (prev !== undefined && nowMs - prev < cooldownMs) {
    return false;
  }
  lastTriggerByPointer.set(pointerId, nowMs);
  if (lastTriggerByPointer.size > 24) {
    const oldestKey = lastTriggerByPointer.keys().next().value;
    if (oldestKey !== undefined) {
      lastTriggerByPointer.delete(oldestKey);
    }
  }
  return true;
}

export interface ViewportTouchGestureState {
  zoomScale: number;
  panX: number;
  panZ: number;
  lastPinchDist: number | null;
}

/**
 * Evaluates 1-finger camera pan or 2-finger pinch-zoom strictly within a single
 * player's viewport touch map so touches on Left Screen (P1) and Right Screen (P2)
 * never combine into a false 2-finger pinch gesture.
 */
export function evaluateViewportMultiTouchGesture(
  viewportTouches: ReadonlyMap<number, { x: number; y: number }>,
  activePointerId: number,
  prevPointerPos: { x: number; y: number } | undefined,
  nextPointerPos: { x: number; y: number },
  state: ViewportTouchGestureState
): {
  nextState: ViewportTouchGestureState;
  movedSignificantly: boolean;
} {
  let movedSignificantly = false;
  if (prevPointerPos) {
    const stepDist = Math.hypot(
      nextPointerPos.x - prevPointerPos.x,
      nextPointerPos.y - prevPointerPos.y
    );
    if (stepDist > 8) {
      movedSignificantly = true;
    }
  }

  if (viewportTouches.size === 1 && prevPointerPos && viewportTouches.has(activePointerId)) {
    const dx = nextPointerPos.x - prevPointerPos.x;
    const dy = nextPointerPos.y - prevPointerPos.y;
    const panX = Math.max(-7.5, Math.min(7.5, state.panX - dx * 0.022));
    const panZ = Math.max(-7.5, Math.min(7.5, state.panZ - dy * 0.022));
    return {
      nextState: {
        ...state,
        panX,
        panZ,
        lastPinchDist: null,
      },
      movedSignificantly,
    };
  }

  if (viewportTouches.size >= 2) {
    const pts = Array.from(viewportTouches.values());
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    let zoomScale = state.zoomScale;
    if (state.lastPinchDist !== null && Math.abs(dist - state.lastPinchDist) > 4) {
      movedSignificantly = true;
    }
    if (state.lastPinchDist !== null && state.lastPinchDist > 8) {
      const ratio = state.lastPinchDist / Math.max(8, dist);
      zoomScale = Math.max(0.68, Math.min(1.55, state.zoomScale * ratio));
    }
    return {
      nextState: {
        ...state,
        zoomScale,
        lastPinchDist: dist,
      },
      movedSignificantly,
    };
  }

  return {
    nextState: {
      ...state,
      lastPinchDist: null,
    },
    movedSignificantly,
  };
}

// ============================================================================
// GOOGLE APPS SCRIPT & LEADERBOARD PURE HELPERS
// ============================================================================

export const GOOGLE_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbwMV5ZI8PXFlSmOosLZtJBkqpd-491JqAcrkvUdWOrBp_jrowNtPcesTAI3jWGwJ7tfRw/exec';

export interface LeaderboardEntry {
  sessionId: string;
  timestamp: string;
  playerName: string;
  schoolName: string;
  studentClass: string;
  gameMode: string;
  playerSlot: string;
  difficulty: string;
  c1: number;
  c2: number;
  c3: number;
  c4: number;
  c5: number;
  c6: number;
  totalScore: number;
  starsText: string;
  title: string;
  statusText: string;
}

export interface RankedLeaderboardEntry extends LeaderboardEntry {
  rank: number;
}

/**
 * Encodes `studentClass` and `schoolName` together into a single string
 * ("Kelas V (Fase C) | SDN 1 Girimarto") so the deployed Google Apps Script
 * stores and returns both Class and School in its `studentClass` column without
 * requiring manual column changes.
 */
export function formatClassWithSchool(studentClass: string, schoolName: string): string {
  const cleanClass = (studentClass || 'Kelas V (Fase C)').split('|')[0].trim();
  const cleanSchool = (schoolName || '').replace(/\|/g, '-').trim();
  if (!cleanSchool) return cleanClass;
  return `${cleanClass} | ${cleanSchool}`;
}

/**
 * Extracts `studentClass` and `schoolName` from a raw `studentClass` string
 * returned by Google Apps Script or an explicit `rawSchoolName` field.
 */
export function parseClassAndSchool(
  rawStudentClass?: string,
  rawSchoolName?: string
): { studentClass: string; schoolName: string } {
  const explicitSchool = (rawSchoolName || '').trim();
  const raw = (rawStudentClass || 'Kelas V (Fase C)').trim();
  if (raw.includes('|')) {
    const parts = raw.split('|').map((s) => s.trim());
    const parsedClass = parts[0] || 'Kelas V (Fase C)';
    const parsedSchool = explicitSchool || parts.slice(1).join(' ').trim() || 'SDN 2 GIRIMARTO';
    return { studentClass: parsedClass, schoolName: parsedSchool };
  }
  return {
    studentClass: raw || 'Kelas V (Fase C)',
    schoolName: explicitSchool || 'SDN 2 GIRIMARTO',
  };
}

/**
 * Normalizes any raw row object from Google Apps Script or local cache into a
 * strictly typed `LeaderboardEntry`.
 */
export function normalizeLeaderboardEntry(raw: Record<string, unknown>, idx = 0): LeaderboardEntry {
  const { studentClass, schoolName } = parseClassAndSchool(
    typeof raw.studentClass === 'string' ? raw.studentClass : undefined,
    typeof raw.schoolName === 'string'
      ? raw.schoolName
      : typeof raw.sekolah === 'string'
      ? raw.sekolah
      : undefined
  );
  const c1 = Number(raw.c1 ?? 0) || 0;
  const c2 = Number(raw.c2 ?? 0) || 0;
  const c3 = Number(raw.c3 ?? 0) || 0;
  const c4 = Number(raw.c4 ?? 0) || 0;
  const c5 = Number(raw.c5 ?? 0) || 0;
  const c6 = Number(raw.c6 ?? 0) || 0;
  const computedSum = Math.min(100, Math.round((c1 + c2 + c3 + c4 + c5 + c6) * 10) / 10);
  const rawTotal = Number(raw.totalScore);
  const totalScore = Number.isFinite(rawTotal) && rawTotal >= 0 ? rawTotal : computedSum;
  const pred = evaluatePredicate(totalScore);

  const playerName =
    typeof raw.playerName === 'string' && raw.playerName.trim()
      ? raw.playerName.trim()
      : 'Penjaga Cilik';
  const timestamp =
    typeof raw.timestamp === 'string' && raw.timestamp.trim()
      ? raw.timestamp.trim()
      : new Date().toISOString().replace('T', ' ').slice(0, 19);
  const sessionId =
    typeof raw.sessionId === 'string' && raw.sessionId.trim()
      ? raw.sessionId.trim()
      : `PBN-ROW-${idx}-${playerName}-${totalScore}`;

  return {
    sessionId,
    timestamp,
    playerName,
    schoolName,
    studentClass,
    gameMode:
      typeof raw.gameMode === 'string' && raw.gameMode.trim()
        ? raw.gameMode.trim()
        : '1P Petualangan',
    playerSlot:
      typeof raw.playerSlot === 'string' && raw.playerSlot.trim()
        ? raw.playerSlot.trim()
        : 'Pemain Utama (1P)',
    difficulty:
      typeof raw.difficulty === 'string' && raw.difficulty.trim()
        ? raw.difficulty.trim().toUpperCase()
        : 'SEDANG',
    c1,
    c2,
    c3,
    c4,
    c5,
    c6,
    totalScore,
    starsText:
      typeof raw.starsText === 'string' && raw.starsText.trim()
        ? raw.starsText.trim()
        : pred.starText,
    title:
      typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : pred.title,
    statusText:
      typeof raw.statusText === 'string' && raw.statusText.trim()
        ? raw.statusText.trim()
        : totalScore >= 60
        ? 'TUNTAS'
        : 'REMEDIAL',
  };
}

/**
 * Deduplicates leaderboard entries by `sessionId`, sorts descending by `totalScore`
 * (with higher-order Bloom C6 -> C5 -> C4 tie-breakers), and assigns 1-based `rank`.
 */
export function rankAndDeduplicateLeaderboard(
  entries: readonly LeaderboardEntry[]
): RankedLeaderboardEntry[] {
  const bySession = new Map<string, LeaderboardEntry>();
  for (const item of entries) {
    const key = item.sessionId || `${item.playerName}::${item.schoolName}::${item.timestamp}`;
    const existing = bySession.get(key);
    if (!existing || item.totalScore >= existing.totalScore) {
      bySession.set(key, item);
    }
  }

  const unique = Array.from(bySession.values());
  unique.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.c6 !== a.c6) return b.c6 - a.c6;
    if (b.c5 !== a.c5) return b.c5 - a.c5;
    if (b.c4 !== a.c4) return b.c4 - a.c4;
    return String(b.timestamp).localeCompare(String(a.timestamp));
  });

  return unique.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

/**
 * Filters ranked leaderboard entries by Nama Siswa (`nameQuery`) and Nama Sekolah (`schoolQuery`)
 * while preserving each student's global `rank`.
 */
export function filterLeaderboardEntries(
  rankedEntries: readonly RankedLeaderboardEntry[],
  nameQuery: string,
  schoolQuery: string
): RankedLeaderboardEntry[] {
  const cleanName = (nameQuery || '').trim().toLowerCase();
  const cleanSchool = (schoolQuery || '').trim().toLowerCase();

  return rankedEntries.filter((entry) => {
    const matchName =
      !cleanName || entry.playerName.toLowerCase().includes(cleanName);
    const matchSchool =
      !cleanSchool || entry.schoolName.toLowerCase().includes(cleanSchool);
    return matchName && matchSchool;
  });
}

/**
 * Locates a player's exact ranked entry in the leaderboard by `sessionId` first,
 * falling back to matching `playerName`, `schoolName`, and `totalScore`.
 */
export function findPlayerLeaderboardRank(
  rankedEntries: readonly RankedLeaderboardEntry[],
  sessionId: string,
  playerName: string,
  schoolName: string,
  totalScore: number
): RankedLeaderboardEntry | null {
  if (!rankedEntries.length) return null;

  if (sessionId) {
    const byId = rankedEntries.find((e) => e.sessionId === sessionId);
    if (byId) return byId;
  }

  const cleanName = (playerName || '').trim().toLowerCase();
  const cleanSchool = (schoolName || '').trim().toLowerCase();

  const exactMatch = rankedEntries.find(
    (e) =>
      e.playerName.trim().toLowerCase() === cleanName &&
      (!cleanSchool || e.schoolName.trim().toLowerCase() === cleanSchool) &&
      Math.abs(e.totalScore - totalScore) < 0.05
  );
  if (exactMatch) return exactMatch;

  const byNameOnly = rankedEntries.find(
    (e) => e.playerName.trim().toLowerCase() === cleanName
  );
  return byNameOnly ?? null;
}



