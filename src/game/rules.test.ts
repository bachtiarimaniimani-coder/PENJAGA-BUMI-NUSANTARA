import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAndSanitizePlayerName,
  validateDualPlayerNames,
  getLevel1WaveDuration,
  calculateTotalScore,
  evaluatePredicate,
  calculateDualGauges,
  verifyLevel1Sort,
  createLevel1SplitDecks,
  verifyLevel2Anagram,
  createLevel2SplitDecks,
  verifyLevel3Drop,
  stepLevel3Bin,
  getLevel3ClawXForBin,
  createLevel3SplitDecks,
  verifyLevel4MaterialSlot,
  evaluateLevel4MaterialSelection,
  findNearestCitizenIndex,
  evaluateCitizenInteraction,
  computeJoystickVector,
  createLevel4SplitDecks,
  verifyLevel5Decision,
  createLevel5SplitDecks,
  createLevel4NpcPositions,
  createLevel5NpcPositions,
  verifyLevel6Masterplan,
  createLevel6SplitDecks,
  LEVEL_6_TOWER_POSITIONS,
  LEVEL_6_INTERACT_RADIUS,
  detectTowerTouchTrigger,
  getDifficultyConfig,
  applyDifficultyTimer,
  getCalibratedLevelTimer,
  getReadingGraceSeconds,
  formatRoomDisplay,
  computeMobileLevel3CameraSpec,
  computeMobileLevel2CameraSpec,
  resolveLevel2CursorIndex,
  stepLevel2AvailableLetterIndex,
  NARRATOR_VOICE_PROFILES,
  getNarratorVoiceProfile,
  resolveSplitTouchSlot,
  shouldAcceptMultiTouchTrigger,
  evaluateViewportMultiTouchGesture,
  GOOGLE_APPS_SCRIPT_URL,
  formatClassWithSchool,
  parseClassAndSchool,
  normalizeLeaderboardEntry,
  rankAndDeduplicateLeaderboard,
  filterLeaderboardEntries,
  findPlayerLeaderboardRank,
} from './rules';
import { LEVEL_6_ISLANDS } from './blueprintData';
import {
  upsertEvaluationRecord,
  buildReferenceEvaluationBank,
  AnswerEvaluationRecord,
} from './evaluationLog';
import { sanitizePdfText, buildPiagamPdfFilename } from './piagamPdf';

test('validateAndSanitizePlayerName enforces 2-15 chars and strips dangerous symbols', () => {
  assert.equal(validateAndSanitizePlayerName('').valid, false);
  assert.equal(validateAndSanitizePlayerName('A').valid, false);
  const clean = validateAndSanitizePlayerName('  Bachtiar <script> ');
  assert.equal(clean.valid, true);
  assert.equal(clean.sanitized, 'Bachtiar script');
  assert.equal(validateAndSanitizePlayerName('NamaYangSangatPanjangSekali').valid, false);
});

test('validateDualPlayerNames validates both Player 1 and Player 2 names for 2P mode', () => {
  const failP2 = validateDualPlayerNames('Ahmad', '');
  assert.equal(failP2.valid, false);
  assert.equal(failP2.p1Sanitized, 'Ahmad');
  assert.ok(failP2.p2Error);

  const bothValid = validateDualPlayerNames('Ahmad Fauzi', 'Siti Fatimah');
  assert.equal(bothValid.valid, true);
  assert.equal(bothValid.p1Sanitized, 'Ahmad Fauzi');
  assert.equal(bothValid.p2Sanitized, 'Siti Fatimah');
});

test('Level 1 wave timers match Master Blueprint (4.5s, 3.5s, 2.8s)', () => {
  assert.equal(getLevel1WaveDuration(1), 4.5);
  assert.equal(getLevel1WaveDuration(2), 3.5);
  assert.equal(getLevel1WaveDuration(3), 2.8);
});

test('Difficulty config, calibrated child-friendly timers, and reading grace periods work accurately', () => {
  assert.equal(getDifficultyConfig('tenang').untimed, true);
  assert.equal(getDifficultyConfig('mudah').label, 'MUDAH');
  assert.equal(getDifficultyConfig('sedang').label, 'SEDANG');
  assert.equal(getDifficultyConfig('sulit').label, 'SULIT');
  assert.equal(applyDifficultyTimer(10, 'mudah'), 20);
  assert.equal(applyDifficultyTimer(10, 'sedang'), 10);
  assert.equal(applyDifficultyTimer(10, 'sulit'), 5);
  assert.equal(getCalibratedLevelTimer(1, 'sedang', { wave: 1 }), 15);
  assert.equal(getCalibratedLevelTimer(3, 'sedang'), 60);
  assert.equal(getCalibratedLevelTimer(5, 'sedang'), 120);
  assert.equal(getCalibratedLevelTimer(2, 'sedang', { isNumeracy: true }), 120);
  assert.equal(getReadingGraceSeconds('intro'), 6);
  assert.equal(getReadingGraceSeconds('numeracy'), 5);
  assert.equal(getReadingGraceSeconds('item'), 4);
  assert.equal(formatRoomDisplay('bumi-6b', 'webrtc'), 'BUMI-6B');
  assert.equal(formatRoomDisplay('', 'solo'), '1P');
  assert.equal(formatRoomDisplay('', 'split'), '2P');
});

test('Level 1 15-item sequence matches Master Blueprint random key map', () => {
  const expected: ('KANAN' | 'KIRI' | 'ATAS')[] = [
    'KANAN', 'KANAN', 'KIRI', 'ATAS', 'KIRI',
    'KIRI', 'KANAN', 'ATAS', 'ATAS', 'KIRI',
    'KANAN', 'ATAS', 'KIRI', 'KANAN', 'ATAS',
  ];
  expected.forEach((dir, idx) => {
    assert.equal(verifyLevel1Sort(idx, dir).correct, true, `Item ${idx + 1} should be ${dir}`);
  });
});

test('createLevel1SplitDecks produces distinct item orders per wave for P1 and P2', () => {
  let seed = 101;
  const seededRng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const { p1, p2 } = createLevel1SplitDecks(seededRng);
  assert.equal(p1.length, 15);
  assert.equal(p2.length, 15);

  // Both cover all 15 item indices
  assert.deepEqual(
    [...p1.map((d) => d.specIndex)].sort((a, b) => a - b),
    Array.from({ length: 15 }, (_, i) => i)
  );
  assert.deepEqual(
    [...p2.map((d) => d.specIndex)].sort((a, b) => a - b),
    Array.from({ length: 15 }, (_, i) => i)
  );

  // Every step 0..14 shows a different item to P1 vs P2 and preserves wave 1 -> 2 -> 3
  for (let i = 0; i < 15; i++) {
    assert.notEqual(p1[i].specIndex, p2[i].specIndex, `Step ${i} item should differ between P1 and P2`);
    const expectedWave = i < 5 ? 1 : i < 10 ? 2 : 3;
    assert.equal(p1[i].item.wave, expectedWave);
    assert.equal(p2[i].item.wave, expectedWave);
    assert.equal(verifyLevel1Sort(p1[i].specIndex, p1[i].item.direction).correct, true);
    assert.equal(verifyLevel1Sort(p2[i].specIndex, p2[i].item.direction).correct, true);
  }
  // First item differs in target bin direction as well
  assert.notEqual(p1[0].item.direction, p2[0].item.direction);
});

test('Level 2 anagram sequence matches KOMPOS -> REDUCE -> AMANAH -> RECYCLE -> REUSE', () => {
  const words = ['KOMPOS', 'REDUCE', 'AMANAH', 'RECYCLE', 'REUSE'];
  words.forEach((word, idx) => {
    assert.equal(verifyLevel2Anagram(idx, word), true);
  });
});

test('createLevel2SplitDecks produces distinct anti-cheat decks for P1 and P2', () => {
  let seed = 42;
  const seededRng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const { p1, p2 } = createLevel2SplitDecks(seededRng);
  assert.equal(p1.length, 5);
  assert.equal(p2.length, 5);

  // Both decks contain all 5 unique spec indices
  assert.deepEqual([...p1.map((d) => d.specIndex)].sort(), [0, 1, 2, 3, 4]);
  assert.deepEqual([...p2.map((d) => d.specIndex)].sort(), [0, 1, 2, 3, 4]);

  // First word and overall order differ between P1 and P2
  assert.notEqual(p1[0].specIndex, p2[0].specIndex);
  assert.notEqual(
    p1.map((d) => d.specIndex).join(','),
    p2.map((d) => d.specIndex).join(',')
  );

  // Every item has scrambled letters not equal to the solved word, and 1 correct option
  p1.forEach((item) => {
    assert.notEqual(item.scrambledLetters.join(''), item.targetWord);
    assert.equal(
      [...item.scrambledLetters].sort().join(''),
      item.targetWord.split('').sort().join('')
    );
    assert.equal(item.options.filter((o) => o.isCorrect).length, 1);

    const p2Match = p2.find((x) => x.specIndex === item.specIndex)!;
    assert.notEqual(p2Match.scrambledLetters.join(''), item.targetWord);
    assert.notEqual(
      p2Match.scrambledLetters.join(''),
      item.scrambledLetters.join('')
    );
    assert.notEqual(
      p2Match.options.map((o) => o.label).join('|'),
      item.options.map((o) => o.label).join('|')
    );
  });
});

test('Level 3 claw drop sequence matches REUSE -> REDUCE -> REDUCE -> RECYCLE -> REUSE -> RECYCLE', () => {
  const bins: ('REUSE' | 'REDUCE' | 'RECYCLE')[] = [
    'REUSE', 'REDUCE', 'REDUCE', 'RECYCLE', 'REUSE', 'RECYCLE',
  ];
  bins.forEach((bin, idx) => {
    const res = verifyLevel3Drop(idx, bin);
    assert.equal(res.correct, true);
    assert.equal(res.pointsDelta, 2.5);
  });
});

test('stepLevel3Bin moves claw left/right across REDUCE (left), REUSE (center), RECYCLE (right)', () => {
  assert.equal(stepLevel3Bin('REUSE', 'left'), 'REDUCE');
  assert.equal(stepLevel3Bin('REDUCE', 'left'), 'REDUCE');
  assert.equal(stepLevel3Bin('REUSE', 'right'), 'RECYCLE');
  assert.equal(stepLevel3Bin('RECYCLE', 'right'), 'RECYCLE');
  assert.equal(stepLevel3Bin('REDUCE', 'right'), 'REUSE');
  assert.equal(stepLevel3Bin('RECYCLE', 'left'), 'REUSE');
  assert.equal(getLevel3ClawXForBin('REDUCE'), -0.8);
  assert.equal(getLevel3ClawXForBin('REUSE'), 0);
  assert.equal(getLevel3ClawXForBin('RECYCLE'), 0.8);
});

test('Level 4 rejected hazardous slots match 3 -> 1 -> 3 -> 2 -> 4', () => {
  const rejectedSlots: (1 | 2 | 3 | 4)[] = [3, 1, 3, 2, 4];
  rejectedSlots.forEach((slot, idx) => {
    const check = verifyLevel4MaterialSlot(idx, slot);
    assert.equal(check.isSafe, false);
    assert.equal(check.isRejectedSlot, true);
  });
});

test('evaluateLevel4MaterialSelection requires all 3 suitable materials and rejects hazardous decoy', () => {
  // Citizen 0 (Kursi Taman Daur Ulang): safe slots = 1, 2, 4; hazardous decoy = 3
  const step1 = evaluateLevel4MaterialSelection(0, [], 1);
  assert.equal(step1.status, 'selected');
  assert.deepEqual(step1.nextSelected, [1]);
  assert.equal(step1.isComplete, false);
  assert.equal(step1.safeCount, 3);

  // Clicking hazardous decoy slot 3 fails & preserves existing safe selections
  const decoy = evaluateLevel4MaterialSelection(0, step1.nextSelected, 3);
  assert.equal(decoy.status, 'hazard_decoy');
  assert.deepEqual(decoy.nextSelected, [1]);
  assert.equal(decoy.isComplete, false);
  assert.ok(decoy.reason && decoy.reason.length > 0);

  // Clicking already selected slot 1 toggles it off
  const toggled = evaluateLevel4MaterialSelection(0, step1.nextSelected, 1);
  assert.equal(toggled.status, 'deselected');
  assert.deepEqual(toggled.nextSelected, []);

  // Selecting all 3 suitable slots completes Phase 1
  const s1 = evaluateLevel4MaterialSelection(0, [], 1);
  const s2 = evaluateLevel4MaterialSelection(0, s1.nextSelected, 2);
  assert.equal(s2.status, 'selected');
  const s3 = evaluateLevel4MaterialSelection(0, s2.nextSelected, 4);
  assert.equal(s3.status, 'complete');
  assert.equal(s3.isComplete, true);
  assert.deepEqual(s3.nextSelected, [1, 2, 4]);
});

test('Level 4 proximity detection returns null at plaza spawn and detects nearest NPC within radius', () => {
  const positions: [number, number][] = [
    [-14, -10],
    [14, -10],
    [-16, 12],
    [16, 12],
    [0, 16],
  ];
  assert.equal(findNearestCitizenIndex(0, 4, positions), null);
  assert.equal(findNearestCitizenIndex(-12, -8, positions), 0);
  assert.equal(findNearestCitizenIndex(14, -11, positions), 1);
  assert.equal(findNearestCitizenIndex(0, 13.5, positions), 4);

  assert.deepEqual(evaluateCitizenInteraction(null, []), {
    canOpen: false,
    status: 'no_npc',
    citizenIndex: null,
  });
  assert.deepEqual(evaluateCitizenInteraction(0, []), {
    canOpen: true,
    status: 'ready',
    citizenIndex: 0,
  });
  assert.deepEqual(evaluateCitizenInteraction(0, [0]), {
    canOpen: false,
    status: 'already_done',
    citizenIndex: 0,
  });
});

test('computeJoystickVector applies deadzone, radial clamp, and normalized direction', () => {
  const idle = computeJoystickVector(0, 0, 32);
  assert.equal(idle.nx, 0);
  assert.equal(idle.nz, 0);
  assert.equal(idle.magnitude, 0);

  const insideDeadzone = computeJoystickVector(2, 2, 32);
  assert.equal(insideDeadzone.nx, 0);
  assert.equal(insideDeadzone.nz, 0);

  const fullRight = computeJoystickVector(80, 0, 32);
  assert.equal(fullRight.knobX, 32);
  assert.equal(fullRight.knobY, 0);
  assert.equal(fullRight.nx, 1);
  assert.equal(fullRight.nz, 0);
  assert.equal(fullRight.magnitude, 1);

  const fullUp = computeJoystickVector(0, -32, 32);
  assert.equal(fullUp.nx, 0);
  assert.equal(fullUp.nz, -1);
  assert.equal(fullUp.knobY, -32);
});

test('Level 5 5-ecosystem policies match B -> C -> A -> B -> C and budget math (100 -> 70 -> 50 -> 30 -> 15 -> 5)', () => {
  const z1 = verifyLevel5Decision(0, 'B', 100, 100);
  assert.equal(z1.isBest, true);
  assert.equal(z1.nextCoins, 70);

  const z2 = verifyLevel5Decision(1, 'C', z1.nextCoins, z1.nextEnergy);
  assert.equal(z2.isBest, true);
  assert.equal(z2.nextCoins, 50);

  const z3 = verifyLevel5Decision(2, 'A', z2.nextCoins, z2.nextEnergy);
  assert.equal(z3.isBest, true);
  assert.equal(z3.nextCoins, 30);

  const z4 = verifyLevel5Decision(3, 'B', z3.nextCoins, z3.nextEnergy);
  assert.equal(z4.isBest, true);
  assert.equal(z4.nextCoins, 15);

  const z5 = verifyLevel5Decision(4, 'C', z4.nextCoins, z4.nextEnergy);
  assert.equal(z5.isBest, true);
  assert.equal(z5.nextCoins, 5);
  assert.equal(z5.nextEnergy, 5);
});

test('createLevel4NpcPositions and createLevel5NpcPositions produce 5 well-spaced irregular positions', () => {
  const mkRng = (seedStart: number) => {
    let seed = seedStart;
    return () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  };

  const l4A = createLevel4NpcPositions(mkRng(11));
  const l4B = createLevel4NpcPositions(mkRng(999));
  const l5A = createLevel5NpcPositions(mkRng(22));
  const l5B = createLevel5NpcPositions(mkRng(777));

  assert.equal(l4A.length, 5);
  assert.equal(l5A.length, 5);
  assert.notDeepEqual(l4A, l4B);
  assert.notDeepEqual(l5A, l5B);

  [l4A, l4B, l5A, l5B].forEach((pts) => {
    // None triggers proximity at spawn (0, 4)
    assert.equal(findNearestCitizenIndex(0, 4, pts), null);
    for (let i = 0; i < pts.length; i++) {
      assert.ok(Math.hypot(pts[i][0] - 0, pts[i][1] - 4) >= 7.0);
      for (let j = i + 1; j < pts.length; j++) {
        assert.ok(Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) >= 8.0);
      }
    }
  });
});

test('Level 6 masterplan slots match Jawa 1-2-3, Sumatra 2-3-1, Kalimantan 3-1-2, Bali/NT 1-3-2, Papua 2-2-3', () => {
  assert.equal(verifyLevel6Masterplan(0, [1, 2, 3]), true);
  assert.equal(verifyLevel6Masterplan(1, [2, 3, 1]), true);
  assert.equal(verifyLevel6Masterplan(2, [3, 1, 2]), true);
  assert.equal(verifyLevel6Masterplan(3, [1, 3, 2]), true);
  assert.equal(verifyLevel6Masterplan(4, [2, 2, 3]), true);
  assert.equal(verifyLevel6Masterplan(0, [1, 1, 1]), false);
});

test('Bloom total score and star predicate evaluation', () => {
  const maxTotal = calculateTotalScore({ c1: 15, c2: 15, c3: 15, c4: 20, c5: 15, c6: 20 });
  assert.equal(maxTotal, 100);
  assert.equal(evaluatePredicate(95).stars, 3);
  assert.equal(evaluatePredicate(80).stars, 2);
  assert.equal(evaluatePredicate(65).stars, 1);
  assert.equal(evaluatePredicate(50).needsRemedial, true);
});

test('Dual-Gauge Bar starts at 20% Eco-Health & 50% Amanah and reaches 100% at Level 6 completion', () => {
  const start = calculateDualGauges(0, 0);
  assert.equal(start.ecoHealth, 20);
  assert.equal(start.amanah, 50);

  const end = calculateDualGauges(6, 0);
  assert.equal(end.ecoHealth, 100);
  assert.equal(end.amanah, 100);
});

test('createLevel3SplitDecks produces distinct item orders and numeracy option orders for P1 and P2', () => {
  let seed = 303;
  const seededRng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const { p1, p2 } = createLevel3SplitDecks(seededRng);
  assert.equal(p1.length, 6);
  assert.equal(p2.length, 6);
  assert.deepEqual([...p1.map((d) => d.specIndex)].sort(), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual([...p2.map((d) => d.specIndex)].sort(), [0, 1, 2, 3, 4, 5]);

  for (let i = 0; i < 6; i++) {
    assert.notEqual(p1[i].specIndex, p2[i].specIndex);
    assert.equal(verifyLevel3Drop(p1[i].specIndex, p1[i].item.targetBin).correct, true);
    assert.equal(verifyLevel3Drop(p2[i].specIndex, p2[i].item.targetBin).correct, true);
  }
  assert.notEqual(p1[0].item.targetBin, p2[0].item.targetBin);

  p1.forEach((entry) => {
    const p2Match = p2.find((x) => x.specIndex === entry.specIndex)!;
    assert.notEqual(
      entry.options.map((o) => o.label).join('|'),
      p2Match.options.map((o) => o.label).join('|')
    );
    assert.notEqual(
      entry.options.findIndex((o) => o.isCorrect),
      p2Match.options.findIndex((o) => o.isCorrect)
    );
  });
});

test('createLevel4SplitDecks produces distinct citizen order, shuffled hazardous material positions, and numeracy options', () => {
  let seed = 404;
  const seededRng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const { p1, p2 } = createLevel4SplitDecks(seededRng);
  assert.equal(p1.length, 5);
  assert.equal(p2.length, 5);
  assert.deepEqual([...p1.map((d) => d.specIndex)].sort(), [0, 1, 2, 3, 4]);
  assert.deepEqual([...p2.map((d) => d.specIndex)].sort(), [0, 1, 2, 3, 4]);

  for (let i = 0; i < 5; i++) {
    assert.notEqual(p1[i].specIndex, p2[i].specIndex);
    assert.notEqual(
      p1[i].materials.findIndex((m) => m.isHazardous),
      p2[i].materials.findIndex((m) => m.isHazardous)
    );
    assert.notEqual(
      p1[i].options.findIndex((o) => o.isCorrect),
      p2[i].options.findIndex((o) => o.isCorrect)
    );
  }

  p1.forEach((entry) => {
    const p2Match = p2.find((x) => x.specIndex === entry.specIndex)!;
    assert.notEqual(
      entry.materials.findIndex((m) => m.isHazardous),
      p2Match.materials.findIndex((m) => m.isHazardous)
    );
    assert.notEqual(
      entry.options.findIndex((o) => o.isCorrect),
      p2Match.options.findIndex((o) => o.isCorrect)
    );
    const hazMat = entry.materials.find((m) => m.isHazardous)!;
    assert.equal(verifyLevel4MaterialSlot(entry.specIndex, hazMat.slot).isRejectedSlot, true);
  });
});

test('createLevel5SplitDecks produces distinct zone quest order, action card positions, and numeracy option orders for P1 and P2', () => {
  let seed = 505;
  const seededRng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const { p1, p2 } = createLevel5SplitDecks(seededRng);
  assert.equal(p1.length, 5);
  assert.equal(p2.length, 5);
  assert.deepEqual([...p1.map((d) => d.specIndex)].sort(), [0, 1, 2, 3, 4]);
  assert.deepEqual([...p2.map((d) => d.specIndex)].sort(), [0, 1, 2, 3, 4]);

  for (let i = 0; i < 5; i++) {
    assert.notEqual(p1[i].specIndex, p2[i].specIndex);
    assert.notEqual(
      p1[i].alternatives.findIndex((a) => a.isBest),
      p2[i].alternatives.findIndex((a) => a.isBest)
    );
    assert.notEqual(
      p1[i].options.findIndex((o) => o.isCorrect),
      p2[i].options.findIndex((o) => o.isCorrect)
    );
  }

  p1.forEach((entry) => {
    const p2Match = p2.find((x) => x.specIndex === entry.specIndex)!;
    assert.notEqual(
      entry.alternatives.findIndex((a) => a.isBest),
      p2Match.alternatives.findIndex((a) => a.isBest)
    );
    assert.notEqual(
      entry.options.findIndex((o) => o.isCorrect),
      p2Match.options.findIndex((o) => o.isCorrect)
    );
    const bestAlt = entry.alternatives.find((a) => a.isBest)!;
    assert.equal(verifyLevel5Decision(entry.specIndex, bestAlt.code, 100, 100).isBest, true);
  });
});

test('createLevel6SplitDecks produces distinct island orders, pillar slot row positions, and numeracy option orders', () => {
  let seed = 606;
  const seededRng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const { p1, p2 } = createLevel6SplitDecks(seededRng);
  assert.equal(p1.length, 5);
  assert.equal(p2.length, 5);
  assert.deepEqual([...p1.map((d) => d.specIndex)].sort(), [0, 1, 2, 3, 4]);
  assert.deepEqual([...p2.map((d) => d.specIndex)].sort(), [0, 1, 2, 3, 4]);

  for (let i = 0; i < 5; i++) {
    assert.notEqual(p1[i].specIndex, p2[i].specIndex);
  }

  p1.forEach((entry) => {
    const p2Match = p2.find((x) => x.specIndex === entry.specIndex)!;
    entry.pillarChoices.forEach((pillar, pIdx) => {
      const correctSlot = entry.island.correctPillarSlots[pIdx];
      assert.notEqual(
        pillar.slots.findIndex((s) => s.slotNum === correctSlot),
        p2Match.pillarChoices[pIdx].slots.findIndex((s) => s.slotNum === correctSlot)
      );
    });
    assert.notEqual(
      entry.options.findIndex((o) => o.isCorrect),
      p2Match.options.findIndex((o) => o.isCorrect)
    );
    assert.equal(verifyLevel6Masterplan(entry.specIndex, entry.island.correctPillarSlots), true);
  });
});

test('LEVEL_6_TOWER_POSITIONS are well separated from spawn points and center core', () => {
  assert.equal(LEVEL_6_TOWER_POSITIONS.length, 5);
  assert.equal(findNearestCitizenIndex(0, 3.6, LEVEL_6_TOWER_POSITIONS, LEVEL_6_INTERACT_RADIUS), null);
  assert.equal(findNearestCitizenIndex(-1.8, 3.6, LEVEL_6_TOWER_POSITIONS, LEVEL_6_INTERACT_RADIUS), null);
  assert.equal(findNearestCitizenIndex(1.8, 3.6, LEVEL_6_TOWER_POSITIONS, LEVEL_6_INTERACT_RADIUS), null);

  for (let i = 0; i < LEVEL_6_TOWER_POSITIONS.length; i++) {
    const [tx, tz] = LEVEL_6_TOWER_POSITIONS[i];
    assert.ok(Math.hypot(tx, tz) >= 8.0, `Tower ${i} should stay clear of central core (0,0)`);
    assert.ok(Math.hypot(tx - 1.8, tz - 3.6) >= 7.0, `Tower ${i} should stay clear of P2 spawn`);
    assert.ok(Math.hypot(tx + 1.8, tz - 3.6) >= 7.0, `Tower ${i} should stay clear of P1 spawn`);
    for (let j = i + 1; j < LEVEL_6_TOWER_POSITIONS.length; j++) {
      assert.ok(
        Math.hypot(tx - LEVEL_6_TOWER_POSITIONS[j][0], tz - LEVEL_6_TOWER_POSITIONS[j][1]) >= 10.0,
        `Towers ${i} and ${j} should have ample separation`
      );
    }
  }
});

test('detectTowerTouchTrigger triggers on initial physical contact, debounces release, and skips solved towers', () => {
  const [t0x, t0z] = LEVEL_6_TOWER_POSITIONS[0];
  // Far away -> no trigger
  const far = detectTowerTouchTrigger(0, 3.6, null, []);
  assert.equal(far.triggeredIdx, null);
  assert.equal(far.nextLastTouchedIdx, null);

  // Touching tower 0 -> triggers once
  const hit = detectTowerTouchTrigger(t0x + 1.0, t0z + 0.5, null, []);
  assert.equal(hit.triggeredIdx, 0);
  assert.equal(hit.nextLastTouchedIdx, 0);

  // Staying inside release radius after closing dialog -> does not immediately re-trigger
  const stillClose = detectTowerTouchTrigger(t0x + 2.2, t0z, hit.nextLastTouchedIdx, []);
  assert.equal(stillClose.triggeredIdx, null);
  assert.equal(stillClose.nextLastTouchedIdx, 0);

  // Stepping outside release radius clears latch
  const released = detectTowerTouchTrigger(t0x + 3.0, t0z, stillClose.nextLastTouchedIdx, []);
  assert.equal(released.triggeredIdx, null);
  assert.equal(released.nextLastTouchedIdx, null);

  // Touching an already completed tower does not trigger modal
  const solvedHit = detectTowerTouchTrigger(t0x + 0.5, t0z + 0.5, null, [0]);
  assert.equal(solvedHit.triggeredIdx, null);
  assert.equal(solvedHit.nextLastTouchedIdx, 0);
});

test('LEVEL_6_ISLANDS includes real factual article URLs and SD-calibrated numeracy answers', () => {
  assert.equal(LEVEL_6_ISLANDS.length, 5);
  assert.equal(
    LEVEL_6_ISLANDS[0].newsUrl,
    'https://solopos.espos.id/gara-gara-sedimentasi-usia-pakai-wgm-wonogiri-tinggal-6-tahun-lagi-2057869'
  );
  assert.equal(
    LEVEL_6_ISLANDS[1].newsUrl,
    'https://mongabay.co.id/2024/05/12/gambut-riau-menipis-bagaimana-perkembangan-restorasi/'
  );
  assert.equal(
    LEVEL_6_ISLANDS[2].newsUrl,
    'https://www.betahita.id/berita/12044/fragmentasi-habitat-rusak-ketahanan-genetik-satwa'
  );
  assert.equal(
    LEVEL_6_ISLANDS[3].newsUrl,
    'https://nationalgeographic.grid.id/read/13309631/viral-video-penyelam-berenang-di-lautan-plastik-bali-ini-penjelasan-ahli'
  );
  assert.equal(
    LEVEL_6_ISLANDS[4].newsUrl,
    'https://papuatengah.antaranews.com/berita/83281/kemenhut-intensifkan-pelestarian-hutan-bakau-papua-sebagai-paru-paru-dunia'
  );

  const expectedAnswers = ['6.000 ton', '200 ha', '60 orangutan', '600 karang baru', '200 bibit bakau'];
  LEVEL_6_ISLANDS.forEach((isl, idx) => {
    const correctOpts = isl.options.filter((o) => o.isCorrect);
    assert.equal(correctOpts.length, 1);
    assert.ok(
      correctOpts[0].label.includes(expectedAnswers[idx]),
      `Island ${isl.islandName} expected answer containing ${expectedAnswers[idx]}`
    );
  });
});

test('upsertEvaluationRecord tracks first-attempt accuracy, deduplicates wrong choices, and resolves on retry', () => {
  let log: AnswerEvaluationRecord[] = [];

  // First try wrong
  log = upsertEvaluationRecord(log, {
    challengeKey: 'L1-item-1',
    level: 1,
    bloomCode: 'C1',
    phaseLabel: 'Pilah Sampah',
    promptTitle: 'Botol Plastik Air Mineral',
    questionText: 'Termasuk kategori apakah "Botol Plastik Air Mineral"?',
    isCorrect: false,
    chosenAnswer: 'Tong ORGANIK (Kiri)',
    correctAnswer: 'Tong ANORGANIK (Kanan)',
    explanation: 'Plastik buatan pabrik yang butuh ratusan tahun terurai.',
  });
  assert.equal(log.length, 1);
  assert.equal(log[0].firstAttemptCorrect, false);
  assert.equal(log[0].isResolved, false);
  assert.equal(log[0].attemptsCount, 1);
  assert.deepEqual(log[0].wrongChoices, ['Tong ORGANIK (Kiri)']);

  // Repeated same wrong choice does not duplicate wrongChoices
  log = upsertEvaluationRecord(log, {
    challengeKey: 'L1-item-1',
    level: 1,
    bloomCode: 'C1',
    phaseLabel: 'Pilah Sampah',
    promptTitle: 'Botol Plastik Air Mineral',
    questionText: 'Termasuk kategori apakah "Botol Plastik Air Mineral"?',
    isCorrect: false,
    chosenAnswer: 'Tong ORGANIK (Kiri)',
    correctAnswer: 'Tong ANORGANIK (Kanan)',
    explanation: 'Plastik buatan pabrik yang butuh ratusan tahun terurai.',
  });
  assert.equal(log[0].attemptsCount, 2);
  assert.deepEqual(log[0].wrongChoices, ['Tong ORGANIK (Kiri)']);

  // Correct on 3rd attempt resolves while preserving firstAttemptCorrect: false
  log = upsertEvaluationRecord(log, {
    challengeKey: 'L1-item-1',
    level: 1,
    bloomCode: 'C1',
    phaseLabel: 'Pilah Sampah',
    promptTitle: 'Botol Plastik Air Mineral',
    questionText: 'Termasuk kategori apakah "Botol Plastik Air Mineral"?',
    isCorrect: true,
    chosenAnswer: 'Tong ANORGANIK (Kanan)',
    correctAnswer: 'Tong ANORGANIK (Kanan)',
    explanation: 'Plastik buatan pabrik yang butuh ratusan tahun terurai.',
  });
  assert.equal(log[0].attemptsCount, 3);
  assert.equal(log[0].isResolved, true);
  assert.equal(log[0].firstAttemptCorrect, false);
  assert.equal(log[0].lastUserAnswer, 'Tong ANORGANIK (Kanan)');
});

test('buildReferenceEvaluationBank covers all 6 Bloom levels (C1-C6) with explanations', () => {
  const bank = buildReferenceEvaluationBank();
  assert.ok(bank.length >= 60);
  const coveredLevels = new Set(bank.map((b) => b.level));
  assert.deepEqual([...coveredLevels].sort(), [1, 2, 3, 4, 5, 6]);
  bank.forEach((entry) => {
    assert.ok(entry.correctAnswer.trim().length > 0, `${entry.challengeKey} needs correctAnswer`);
    assert.ok(entry.explanation.trim().length > 10, `${entry.challengeKey} needs explanation`);
  });
});

test('sanitizePdfText strips unsupported emojis while preserving Indonesian punctuation and names', () => {
  assert.equal(sanitizePdfText('⭐⭐⭐ Penjaga Bumi — “Teladan”'), 'Penjaga Bumi - "Teladan"');
  assert.equal(sanitizePdfText('Bachtiar Imani, S.Pd.I.'), 'Bachtiar Imani, S.Pd.I.');
});

test('buildPiagamPdfFilename builds clean .pdf filenames for 1P and 2P modes', () => {
  assert.equal(
    buildPiagamPdfFilename('Ahmad Fauzi'),
    'Piagam-Penjaga-Bumi-ahmad-fauzi.pdf'
  );
  assert.equal(
    buildPiagamPdfFilename('Ahmad', true, 'Fatimah'),
    'Piagam-Penjaga-Bumi-ahmad-fatimah.pdf'
  );
});

test('computeMobileLevel3CameraSpec frames all 3 bins on phones (<768px) and returns null for PC/IFP (>=768px)', () => {
  // PC, Tablet, and IFP viewports remain 100% untouched
  assert.equal(computeMobileLevel3CameraSpec(768, 1024), null);
  assert.equal(computeMobileLevel3CameraSpec(1280, 720), null);
  assert.equal(computeMobileLevel3CameraSpec(1920, 1080), null);
  assert.equal(computeMobileLevel3CameraSpec(3840, 2160), null);

  // Portrait and landscape mobile phone viewports frame REDUCE (-3.61m) to RECYCLE (+3.61m)
  const phoneSizes: [number, number][] = [
    [360, 640],
    [375, 667],
    [390, 844],
    [412, 915],
    [667, 375],
  ];

  phoneSizes.forEach(([w, h]) => {
    const spec = computeMobileLevel3CameraSpec(w, h, false);
    assert.ok(spec !== null, `Expected camera spec for ${w}x${h}`);
    const aspect = w / h;
    const dist = spec.camPos[2] - -2.6;
    const halfVisibleW = dist * aspect * Math.tan(((spec.fov / 2) * Math.PI) / 180);
    assert.ok(
      halfVisibleW >= 4.2,
      `Expected all 3 bins & gantry (±4.2m) to fit on ${w}x${h}, got ±${halfVisibleW.toFixed(2)}m`
    );
    assert.ok(spec.viewOffsetYFrac > 0);
  });
});

test('computeMobileLevel2CameraSpec frames the 3D letter rack (±2.85m) on phones (<768px) and returns null for PC/IFP (>=768px)', () => {
  assert.equal(computeMobileLevel2CameraSpec(768, 1024), null);
  assert.equal(computeMobileLevel2CameraSpec(1280, 720), null);
  assert.equal(computeMobileLevel2CameraSpec(1440, 900), null);
  assert.equal(computeMobileLevel2CameraSpec(1920, 1080), null);

  const phoneSizes: [number, number][] = [
    [360, 640],
    [375, 667],
    [390, 844],
    [412, 915],
    [667, 375],
  ];

  phoneSizes.forEach(([w, h]) => {
    const spec = computeMobileLevel2CameraSpec(w, h, false);
    assert.ok(spec !== null, `Expected Level 2 camera spec for ${w}x${h}`);
    const aspect = w / h;
    const dist = spec.camPos[2] - -1.5;
    const halfVisibleW = dist * aspect * Math.tan(((spec.fov / 2) * Math.PI) / 180);
    assert.ok(
      halfVisibleW >= 3.2,
      `Expected 3D letter rack & pedestals (±3.2m) to fit on ${w}x${h}, got ±${halfVisibleW.toFixed(2)}m`
    );
    assert.ok(spec.viewOffsetYFrac > 0);
  });
});

test('resolveLevel2CursorIndex and stepLevel2AvailableLetterIndex navigate unpicked letters cleanly', () => {
  assert.equal(resolveLevel2CursorIndex(6, [], 0), 0);
  assert.equal(resolveLevel2CursorIndex(6, [0, 1], 0), 2);
  assert.equal(stepLevel2AvailableLetterIndex(6, [1, 3], 0, 'right'), 2);
  assert.equal(stepLevel2AvailableLetterIndex(6, [1, 3], 2, 'right'), 4);
  assert.equal(stepLevel2AvailableLetterIndex(6, [1, 3], 0, 'left'), 5);
});

test('NARRATOR_VOICE_PROFILES defines exact expressive storyteller style prompts for Pak Guru Ilyas and Bu Guru Rahma', () => {
  const ilyas = getNarratorVoiceProfile('ilyas');
  const rahma = getNarratorVoiceProfile('rahma');

  assert.equal(ilyas.persona, 'ilyas');
  assert.equal(ilyas.voiceName, 'Charon');
  assert.equal(
    ilyas.stylePrompt,
    'A mature male voice, gentle, expressive, and deep. Sounds like an engaging literature teacher or wise storyteller. Very warm with dynamic pacing to keep the listener hooked.'
  );

  assert.equal(rahma.persona, 'rahma');
  assert.equal(rahma.voiceName, 'Kore');
  assert.equal(
    rahma.stylePrompt,
    'A mature female voice, soft, soothing, and highly expressive. Sounds like a gentle arts or language teacher reading a storybook. Warm, dynamic, and emotionally engaging.'
  );

  assert.equal(NARRATOR_VOICE_PROFILES.ilyas.stylePrompt, ilyas.stylePrompt);
  assert.equal(NARRATOR_VOICE_PROFILES.rahma.stylePrompt, rahma.stylePrompt);
});

test('Multi-Touch Input System isolates Left (P1) and Right (P2) viewports and accepts simultaneous touches', () => {
  // 1. Viewport slot partitioning across HP (390px), Chromebook (1366px), and IFP 4K (3840px)
  assert.equal(resolveSplitTouchSlot(100, 0, 390, true), 1);
  assert.equal(resolveSplitTouchSlot(220, 0, 390, true), 2);
  assert.equal(resolveSplitTouchSlot(680, 0, 1366, true), 1);
  assert.equal(resolveSplitTouchSlot(685, 0, 1366, true), 2);
  assert.equal(resolveSplitTouchSlot(1500, 0, 3840, true), 1);
  assert.equal(resolveSplitTouchSlot(2400, 0, 3840, true), 2);
  assert.equal(resolveSplitTouchSlot(2400, 0, 3840, false), 1);

  // 2. Simultaneous triggers from P1 (pointerId=1) and P2 (pointerId=2) at the exact same millisecond (t=1000)
  const triggerMap = new Map<number, number>();
  assert.equal(shouldAcceptMultiTouchTrigger(1, triggerMap, 1000, 65), true);
  assert.equal(shouldAcceptMultiTouchTrigger(2, triggerMap, 1000, 65), true);
  // Duplicate synthetic tap on same pointer within 65ms is suppressed
  assert.equal(shouldAcceptMultiTouchTrigger(1, triggerMap, 1020, 65), false);
  // Subsequent deliberate tap after cooldown is accepted
  assert.equal(shouldAcceptMultiTouchTrigger(1, triggerMap, 1080, 65), true);

  // 3. Per-viewport camera gesture isolation: 1 touch on P1 + 1 touch on P2 remain independent 1-finger pans (never a pinch)
  const p1Touches = new Map<number, { x: number; y: number }>([[1, { x: 140, y: 300 }]]);
  const p2Touches = new Map<number, { x: number; y: number }>([[2, { x: 920, y: 300 }]]);

  const p1Res = evaluateViewportMultiTouchGesture(
    p1Touches,
    1,
    { x: 100, y: 300 },
    { x: 140, y: 300 },
    { zoomScale: 1, panX: 0, panZ: 0, lastPinchDist: null }
  );
  const p2Res = evaluateViewportMultiTouchGesture(
    p2Touches,
    2,
    { x: 960, y: 300 },
    { x: 920, y: 300 },
    { zoomScale: 1, panX: 0, panZ: 0, lastPinchDist: null }
  );

  // Neither viewport zoomed; P1 panned left while P2 panned right independently
  assert.equal(p1Res.nextState.zoomScale, 1);
  assert.equal(p2Res.nextState.zoomScale, 1);
  assert.ok(p1Res.nextState.panX < 0);
  assert.ok(p2Res.nextState.panX > 0);
  assert.equal(p1Res.movedSignificantly, true);
  assert.equal(p2Res.movedSignificantly, true);
});

test('Leaderboard & Google Apps Script helpers encode school, rank players accurately, and filter by Nama & Sekolah', () => {
  assert.ok(GOOGLE_APPS_SCRIPT_URL.startsWith('https://script.google.com/macros/s/'));

  const encoded = formatClassWithSchool('Kelas V (Fase C)', 'SDN 1 Girimarto');
  assert.equal(encoded, 'Kelas V (Fase C) | SDN 1 Girimarto');

  const parsed = parseClassAndSchool(encoded);
  assert.equal(parsed.studentClass, 'Kelas V (Fase C)');
  assert.equal(parsed.schoolName, 'SDN 1 Girimarto');

  const rawRows = [
    {
      sessionId: 'S-1',
      timestamp: '2026-11-14 08:00:00',
      playerName: 'Ahmad Fauzi',
      studentClass: 'Kelas V (Fase C) | SDN 1 Girimarto',
      c1: 15,
      c2: 15,
      c3: 15,
      c4: 20,
      c5: 15,
      c6: 20,
      totalScore: 100,
    },
    {
      sessionId: 'S-2',
      timestamp: '2026-11-14 08:02:00',
      playerName: 'Siti Fatimah',
      studentClass: 'Kelas VI (Fase C) | SDN 2 Wonogiri',
      c1: 15,
      c2: 12,
      c3: 15,
      c4: 16,
      c5: 15,
      c6: 16,
      totalScore: 89,
    },
    {
      sessionId: 'S-3',
      timestamp: '2026-11-14 08:05:00',
      playerName: 'Bachtiar',
      studentClass: 'Kelas V (Fase C) | SDN 1 Girimarto',
      c1: 15,
      c2: 15,
      c3: 15,
      c4: 16,
      c5: 15,
      c6: 18,
      totalScore: 94,
    },
  ];

  const normalized = rawRows.map((r, i) => normalizeLeaderboardEntry(r, i));
  const ranked = rankAndDeduplicateLeaderboard(normalized);

  assert.equal(ranked.length, 3);
  assert.equal(ranked[0].playerName, 'Ahmad Fauzi');
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[1].playerName, 'Bachtiar');
  assert.equal(ranked[1].rank, 2);
  assert.equal(ranked[2].playerName, 'Siti Fatimah');
  assert.equal(ranked[2].rank, 3);

  // Locate Bachtiar's exact rank (#2)
  const bachtiarRank = findPlayerLeaderboardRank(
    ranked,
    'S-3',
    'Bachtiar',
    'SDN 1 Girimarto',
    94
  );
  assert.ok(bachtiarRank);
  assert.equal(bachtiarRank.rank, 2);

  // Filter by Nama
  const byName = filterLeaderboardEntries(ranked, 'siti', '');
  assert.equal(byName.length, 1);
  assert.equal(byName[0].playerName, 'Siti Fatimah');
  assert.equal(byName[0].rank, 3); // Global rank preserved!

  // Filter by Sekolah
  const bySchool = filterLeaderboardEntries(ranked, '', 'Girimarto');
  assert.equal(bySchool.length, 2);
  assert.equal(bySchool[0].rank, 1);
  assert.equal(bySchool[1].rank, 2);

  // Combined filter by Nama + Sekolah
  const byBoth = filterLeaderboardEntries(ranked, 'bachtiar', 'girimarto');
  assert.equal(byBoth.length, 1);
  assert.equal(byBoth[0].playerName, 'Bachtiar');
  assert.equal(byBoth[0].rank, 2);
});


