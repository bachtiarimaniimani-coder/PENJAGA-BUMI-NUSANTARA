import React, { useState, useEffect, useRef } from 'react';
import {
  LEVEL_METADATA,
  LEVEL_1_ITEMS,
  LEVEL_2_ANAGRAMS,
  LEVEL_3_CLAW_ITEMS,
  LEVEL_4_CITIZENS,
  LEVEL_5_ZONES,
  LEVEL_6_ISLANDS,
  PROLOGUE_BABAK,
  JOURNAL_TRANSMISSIONS,
  getRemedialEmpathyText,
} from '../game/blueprintData';
import {
  verifyLevel1Sort,
  verifyLevel2Anagram,
  verifyLevel3Drop,
  stepLevel3Bin,
  getLevel3ClawXForBin,
  evaluateLevel4MaterialSelection,
  evaluateCitizenInteraction,
  verifyLevel5Decision,
  verifyLevel6Masterplan,
  DifficultyLevel,
  Level1DeckItem,
  Level2DeckItem,
  Level3DeckItem,
  Level4DeckItem,
  Level5DeckItem,
  Level6DeckItem,
  getDifficultyConfig,
  getCalibratedLevelTimer,
  getReadingGraceSeconds,
  LEVEL_6_TOWER_POSITIONS,
  resolveLevel2CursorIndex,
  stepLevel2AvailableLetterIndex,
} from '../game/rules';
import { audioEngine, NarrationVoiceStatus } from '../game/audioEngine';
import { ContextualMiniMap } from './ContextualMiniMap';
import { RealisticTrashVisual, RealisticBinVisual } from './RealisticTrashVisual';
import { TacticalRoadmapMap } from './TacticalRoadmapMap';
import { Level2VisualState } from './World3DCanvas';
import {
  AnswerEvaluationInput,
  AnswerEvaluationRecord,
  getLevel1BinLabel,
  getLevel1EvaluationMeta,
  getLevel2WordEvaluationMeta,
  getLevel2NumeracyEvaluationMeta,
  getLevel3ClawEvaluationMeta,
  getLevel3NumeracyEvaluationMeta,
  getLevel4MaterialEvaluationMeta,
  getLevel4NumeracyEvaluationMeta,
  getLevel5PolicyEvaluationMeta,
  getLevel5NumeracyEvaluationMeta,
  getLevel6PillarEvaluationMeta,
  getLevel6NumeracyEvaluationMeta,
} from '../game/evaluationLog';
import { EvaluationReviewPanel } from './EvaluationReviewPanel';

/**
 * Splits long narration or location strings into bite-sized readable subtitle chunks
 * for mobile smartphones (< md) so text alternates cleanly without blocking the 3D scene.
 */
function splitSubtitleChunks(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const rawSentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const sentence of rawSentences) {
    if (sentence.length <= 105) {
      if (chunks.length > 0 && chunks[chunks.length - 1].length + sentence.length + 1 <= 92) {
        chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${sentence}`;
      } else {
        chunks.push(sentence);
      }
    } else {
      const subParts = sentence
        .split(/(?<=[,;:])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const part of subParts) {
        if (part.length <= 105) {
          if (chunks.length > 0 && chunks[chunks.length - 1].length + part.length + 1 <= 92) {
            chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${part}`;
          } else {
            chunks.push(part);
          }
        } else {
          const words = part.split(' ');
          let buf = '';
          for (const w of words) {
            if ((buf + ' ' + w).trim().length > 98 && buf) {
              chunks.push(buf.trim());
              buf = w;
            } else {
              buf = buf ? `${buf} ${w}` : w;
            }
          }
          if (buf.trim()) chunks.push(buf.trim());
        }
      }
    }
  }
  return chunks.length > 0 ? chunks : [cleaned];
}

export interface LevelsArenaProps {
  playerName: string;
  currentLevel: number; // 1..6
  difficulty: DifficultyLevel;
  isSplitMode?: boolean;
  playerSlot?: 1 | 2;
  prologueActive: boolean;
  prologueStage: number; // 1..3
  lives: number;
  remedialActive: boolean;
  journalModalLevel: number | null;
  reflectionModalLevel: number | null;
  playerPosRef: React.MutableRefObject<{ x: number; z: number; rotY: number; moving: boolean; jumping: boolean }>;
  partnerPosRef?: React.MutableRefObject<{ x: number; z: number; rotY: number; moving: boolean; jumping?: boolean }>;
  nearbyCitizenIdx: number | null;
  completedCitizens: number[];
  completedZones: number[];
  completedIslands: number[];
  onAdvancePrologue: () => void;
  onSkipPrologue: () => void;
  onCloseJournalModal: () => void;
  onCloseReflectionAndAdvance: () => void;
  onRetryRemedialLevel: () => void;
  onScoreDelta: (level: number, delta: number) => void;
  onLoseLife: (reason: string) => void;
  onAnswerFeedback?: (type: 'ok' | 'err') => void;
  evaluationLog?: readonly AnswerEvaluationRecord[];
  lastMistakeNote?: string | null;
  onRecordEvaluation?: (entry: AnswerEvaluationInput) => void;
  onLevelComplete: (level: number) => void;
  onSetTimerSpec: (seconds: number, maxSeconds: number, graceSeconds?: number) => void;
  onUpdateClawState: (
    x: number,
    grabbing: boolean,
    itemSpecIndex?: number,
    phase?: 'claw' | 'numeracy'
  ) => void;
  onMarkCitizenDone: (idx: number) => void;
  onMarkZoneDone: (idx: number) => void;
  onMarkIslandDone: (idx: number) => void;
  level1IntroPhase?: 'looking' | 'narration' | 'core_game';
  lookingSecondsLeft?: number;
  onAdvanceLookingToNarration?: () => void;
  onCompleteLevel1Intro?: () => void;
  roadmapActive?: boolean;
  completedLevels?: number[];
  onContinueFromRoadmap?: (targetLevel?: number) => void;
  narrationSecondsLeft?: number;
  level1Deck?: Level1DeckItem[];
  level2Deck?: Level2DeckItem[];
  level3Deck?: Level3DeckItem[];
  level4Deck?: Level4DeckItem[];
  level5Deck?: Level5DeckItem[];
  level6Deck?: Level6DeckItem[];
  onLevel2VisualChange?: (state: Level2VisualState) => void;
  onDialogOpenChange?: (open: boolean) => void;
  l4InteractTick?: number;
  l4DirectOpen?: { citizenIdx: number; tick: number } | null;
  nearbyZoneIdx?: number | null;
  l5InteractTick?: number;
  l5DirectOpen?: { zoneIdx: number; tick: number } | null;
  l4Positions?: [number, number][];
  l5Positions?: [number, number][];
  nearbyIslandIdx?: number | null;
  l6InteractTick?: number;
  l6DirectOpen?: { islandIdx: number; tick: number } | null;
  l6TouchOpen?: { islandIdx: number; tick: number } | null;
}

export const LevelsArenaView: React.FC<LevelsArenaProps> = ({
  playerName,
  currentLevel,
  difficulty,
  isSplitMode = false,
  playerSlot = 1,
  prologueActive,
  prologueStage,
  remedialActive,
  journalModalLevel,
  reflectionModalLevel,
  playerPosRef,
  partnerPosRef,
  nearbyCitizenIdx,
  completedCitizens,
  completedZones,
  completedIslands,
  onAdvancePrologue,
  onSkipPrologue,
  onCloseJournalModal,
  onCloseReflectionAndAdvance,
  onRetryRemedialLevel,
  onScoreDelta,
  onLoseLife,
  onAnswerFeedback,
  evaluationLog = [],
  lastMistakeNote = null,
  onRecordEvaluation,
  onLevelComplete,
  onSetTimerSpec,
  onUpdateClawState,
  onMarkCitizenDone,
  onMarkZoneDone,
  onMarkIslandDone,
  level1IntroPhase = 'core_game',
  lookingSecondsLeft = 12,
  onAdvanceLookingToNarration,
  onCompleteLevel1Intro,
  roadmapActive = false,
  completedLevels = [],
  onContinueFromRoadmap,
  narrationSecondsLeft = 30,
  level1Deck,
  level2Deck,
  level3Deck,
  level4Deck,
  level5Deck,
  level6Deck,
  onLevel2VisualChange,
  onDialogOpenChange,
  l4InteractTick = 0,
  l4DirectOpen = null,
  nearbyZoneIdx = null,
  l5InteractTick = 0,
  l5DirectOpen = null,
  l4Positions,
  l5Positions,
  nearbyIslandIdx = null,
  l6InteractTick = 0,
  l6DirectOpen = null,
  l6TouchOpen = null,
}) => {
  // Per-player-pane anti-spam debounce (tuned for responsive multi-touch on IFP/HP/Chromebook)
  const lastClickRef = useRef<number>(0);
  const canClick = () => {
    const now = performance.now();
    if (now - lastClickRef.current < 65) return false;
    lastClickRef.current = now;
    return true;
  };

  const levelMeta = LEVEL_METADATA[currentLevel - 1] || LEVEL_METADATA[0];

  // Full text first + delayed narrator voice state for Prologue, Journal & Pre-Level Narrations
  const [typedText, setTypedText] = useState('');
  const [subtitleChunkIdx, setSubtitleChunkIdx] = useState(0);
  const [mobileTextExpanded, setMobileTextExpanded] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<NarrationVoiceStatus>(() =>
    audioEngine.getVoiceStatus()
  );

  useEffect(() => {
    return audioEngine.subscribeVoiceStatus((st) => setVoiceStatus(st));
  }, []);
  const [feedbackToast, setFeedbackToast] = useState<{
    id: number;
    type: 'ok' | 'err';
    title: string;
    msg: string;
    badge?: string;
  } | null>(null);
  const [panelFeedbackFlash, setPanelFeedbackFlash] = useState<{
    type: 'ok' | 'err';
    id: number;
  } | null>(null);
  const [l1BinFlash, setL1BinFlash] = useState<{
    dir: 'KIRI' | 'KANAN' | 'ATAS';
    type: 'ok' | 'err';
    id: number;
  } | null>(null);
  const [wrongOptionFlash, setWrongOptionFlash] = useState<{
    key: string;
    id: number;
  } | null>(null);

  const toastIdRef = useRef<number>(0);
  const toastTimerRef = useRef<number | null>(null);
  const panelFlashTimerRef = useRef<number | null>(null);
  const l1BinFlashTimerRef = useRef<number | null>(null);
  const wrongOptionTimerRef = useRef<number | null>(null);

  const triggerPanelFlash = (type: 'ok' | 'err') => {
    const id = ++toastIdRef.current;
    setPanelFeedbackFlash({ type, id });
    if (panelFlashTimerRef.current) window.clearTimeout(panelFlashTimerRef.current);
    panelFlashTimerRef.current = window.setTimeout(() => {
      setPanelFeedbackFlash(null);
      panelFlashTimerRef.current = null;
    }, 420);
  };

  const triggerWrongOptionFlash = (key: string) => {
    const id = ++toastIdRef.current;
    setWrongOptionFlash({ key, id });
    if (wrongOptionTimerRef.current) window.clearTimeout(wrongOptionTimerRef.current);
    wrongOptionTimerRef.current = window.setTimeout(() => {
      setWrongOptionFlash(null);
      wrongOptionTimerRef.current = null;
    }, 700);
  };

  const triggerL1BinFlash = (dir: 'KIRI' | 'KANAN' | 'ATAS', type: 'ok' | 'err') => {
    const id = ++toastIdRef.current;
    setL1BinFlash({ dir, type, id });
    if (l1BinFlashTimerRef.current) window.clearTimeout(l1BinFlashTimerRef.current);
    l1BinFlashTimerRef.current = window.setTimeout(() => {
      setL1BinFlash(null);
      l1BinFlashTimerRef.current = null;
    }, 440);
  };

  const showToast = (
    type: 'ok' | 'err',
    msg: string,
    opts?: { title?: string; badge?: string; notifyFlash?: boolean }
  ) => {
    const id = ++toastIdRef.current;
    const notifyFlash = opts?.notifyFlash ?? true;
    const title = opts?.title ?? (type === 'ok' ? 'HEBAT SEKALI!' : 'YUK KITA CEK BERSAMA');
    setFeedbackToast({ id, type, title, msg, badge: opts?.badge });

    if (notifyFlash) {
      triggerPanelFlash(type);
      onAnswerFeedback?.(type);
    }

    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setFeedbackToast((prev) => (prev && prev.id === id ? null : prev));
      toastTimerRef.current = null;
    }, 3800);
  };

  // --- LEVEL 1 STATE (15 Trash Objects + Drag & Drop) ---
  const [l1Index, setL1Index] = useState(0);
  const [l1DragOverBin, setL1DragOverBin] = useState<'ORGANIK' | 'ANORGANIK' | 'B3' | null>(null);
  const [l1IsDragging, setL1IsDragging] = useState(false);
  const [l1PointerPos, setL1PointerPos] = useState<{ x: number; y: number } | null>(null);

  // --- LEVEL 2 STATE (5 Anagrams + Numeracy) ---
  const [l2Index, setL2Index] = useState(0);
  const [l2PickedIndices, setL2PickedIndices] = useState<number[]>([]);
  const [l2CursorIdx, setL2CursorIdx] = useState(0);
  const [l2Phase, setL2Phase] = useState<'anagram' | 'numeracy'>('anagram');

  // --- LEVEL 3 STATE (6 Claw Items + Numeracy) ---
  const [l3Index, setL3Index] = useState(0);
  const [l3Phase, setL3Phase] = useState<'claw' | 'numeracy'>('claw');
  const [l3SelectedBin, setL3SelectedBin] = useState<'REDUCE' | 'REUSE' | 'RECYCLE'>('REUSE');
  const [l3Dropping, setL3Dropping] = useState(false);
  const l3DropTimerRef = useRef<number | null>(null);

  // --- LEVEL 4 STATE (5 Citizen Quests: Clean Exploration -> Meet/Tap NPC or [E] -> Select All Safe Materials + Numeracy) ---
  const [l4ActiveCitizen, setL4ActiveCitizen] = useState<number | null>(null);
  const [l4DialogOpen, setL4DialogOpen] = useState<boolean>(false);
  const [l4Phase, setL4Phase] = useState<'reject_hazard' | 'numeracy'>('reject_hazard');
  const [l4SelectedSlots, setL4SelectedSlots] = useState<(1 | 2 | 3 | 4)[]>([]);
  const lastL4InteractTickRef = useRef<number>(l4InteractTick);
  const lastL4DirectTickRef = useRef<number>(l4DirectOpen?.tick ?? 0);
  const lastL4MatClickRef = useRef<number>(0);

  // --- LEVEL 5 STATE (3 Guardian NPCs: Clean Exploration -> Meet/Tap NPC or [E] -> Policy B-C-A + SD Numeracy) ---
  const [l5ActiveZone, setL5ActiveZone] = useState<number | null>(null);
  const [l5DialogOpen, setL5DialogOpen] = useState<boolean>(false);
  const [l5Coins, setL5Coins] = useState(100);
  const [l5Energy, setL5Energy] = useState(100);
  const [l5Phase, setL5Phase] = useState<'policy' | 'numeracy'>('policy');
  const lastL5InteractTickRef = useRef<number>(l5InteractTick);
  const lastL5DirectTickRef = useRef<number>(l5DirectOpen?.tick ?? 0);

  // --- LEVEL 6 STATE (5 Menara Radar: Clean Exploration -> Touch / Click / [E] -> 3 Pillars + Numeracy) ---
  const [l6ActiveStation, setL6ActiveStation] = useState<number | null>(null);
  const [l6DialogOpen, setL6DialogOpen] = useState<boolean>(false);
  const [l6CelebratingNetwork, setL6CelebratingNetwork] = useState<boolean>(false);
  const [l6Pillars, setL6Pillars] = useState<[number, number, number]>([1, 1, 1]);
  const [l6Phase, setL6Phase] = useState<'pillars' | 'numeracy'>('pillars');
  const lastL6InteractTickRef = useRef<number>(l6InteractTick);
  const lastL6DirectTickRef = useRef<number>(l6DirectOpen?.tick ?? 0);
  const lastL6TouchTickRef = useRef<number>(l6TouchOpen?.tick ?? 0);
  const l6CelebrationTimerRef = useRef<number | null>(null);
  const l6DiveRumbleTriggeredRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      if (l6CelebrationTimerRef.current) {
        window.clearTimeout(l6CelebrationTimerRef.current);
        l6CelebrationTimerRef.current = null;
      }
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (panelFlashTimerRef.current) window.clearTimeout(panelFlashTimerRef.current);
      if (l1BinFlashTimerRef.current) window.clearTimeout(l1BinFlashTimerRef.current);
      if (wrongOptionTimerRef.current) window.clearTimeout(wrongOptionTimerRef.current);
    };
  }, []);

  // Reset sub-states when currentLevel changes
  useEffect(() => {
    setFeedbackToast(null);
    setPanelFeedbackFlash(null);
    setL1BinFlash(null);
    setWrongOptionFlash(null);

    if (roadmapActive) {
      audioEngine.stopSpeech();
      return;
    }

    if (prologueActive || journalModalLevel || reflectionModalLevel || remedialActive) {
      return;
    }

    const introGrace = getReadingGraceSeconds('intro');

    if (currentLevel === 1) {
      setL1Index(0);
      const firstWave =
        isSplitMode && level1Deck && level1Deck[0]
          ? level1Deck[0].item.wave
          : LEVEL_1_ITEMS[0].wave;
      const dur = getCalibratedLevelTimer(1, difficulty, { wave: firstWave });
      onSetTimerSpec(dur, dur, introGrace);
    } else if (currentLevel === 2) {
      setL2Index(0);
      setL2PickedIndices([]);
      setL2Phase('anagram');
      const dur = getCalibratedLevelTimer(2, difficulty);
      onSetTimerSpec(dur, dur, introGrace);
    } else if (currentLevel === 3) {
      if (l3DropTimerRef.current) {
        window.clearTimeout(l3DropTimerRef.current);
        l3DropTimerRef.current = null;
      }
      setL3Index(0);
      setL3Phase('claw');
      setL3SelectedBin('REUSE');
      setL3Dropping(false);
      const dur = getCalibratedLevelTimer(3, difficulty);
      onSetTimerSpec(dur, dur, introGrace);
    } else if (currentLevel === 4) {
      setL4ActiveCitizen(null);
      setL4DialogOpen(false);
      setL4Phase('reject_hazard');
      setL4SelectedSlots([]);
      const dur = getCalibratedLevelTimer(4, difficulty);
      onSetTimerSpec(dur, dur, introGrace);
    } else if (currentLevel === 5) {
      setL5ActiveZone(null);
      setL5DialogOpen(false);
      setL5Coins(100);
      setL5Energy(100);
      setL5Phase('policy');
      if (!isSplitMode || playerSlot === 1) {
        audioEngine.playEarthTremor();
      }
      const dur = getCalibratedLevelTimer(5, difficulty);
      onSetTimerSpec(dur, dur, introGrace);
    } else if (currentLevel === 6) {
      if (l6CelebrationTimerRef.current) {
        window.clearTimeout(l6CelebrationTimerRef.current);
        l6CelebrationTimerRef.current = null;
      }
      setL6ActiveStation(null);
      setL6DialogOpen(false);
      setL6CelebratingNetwork(false);
      setL6Pillars(isSplitMode ? [0, 0, 0] : [1, 1, 1]);
      setL6Phase('pillars');
      const dur = getCalibratedLevelTimer(6, difficulty);
      onSetTimerSpec(dur, dur, introGrace);
    }
  }, [
    currentLevel,
    difficulty,
    prologueActive,
    roadmapActive,
    journalModalLevel,
    reflectionModalLevel,
    remedialActive,
    isSplitMode,
    playerSlot,
    level3Deck,
    level4Deck,
    level5Deck,
    level6Deck,
  ]);

  // Sync nearby citizen in Level 4: close dialog if player walks away; never auto-open without [E]
  useEffect(() => {
    if (currentLevel !== 4) return;
    if (nearbyCitizenIdx === null) {
      setL4DialogOpen(false);
      setL4ActiveCitizen(null);
    } else if (!l4DialogOpen) {
      setL4ActiveCitizen(nearbyCitizenIdx);
    }
  }, [nearbyCitizenIdx, currentLevel, l4DialogOpen]);

  // Open Level 4 NPC question modal when [E] (or P2 interact key) is pressed near an NPC
  useEffect(() => {
    if (l4InteractTick === lastL4InteractTickRef.current) return;
    lastL4InteractTickRef.current = l4InteractTick;
    if (
      currentLevel !== 4 ||
      prologueActive ||
      roadmapActive ||
      level1IntroPhase !== 'core_game' ||
      remedialActive ||
      journalModalLevel !== null ||
      reflectionModalLevel !== null
    ) {
      return;
    }
    const check = evaluateCitizenInteraction(nearbyCitizenIdx, completedCitizens);
    if (check.status === 'ready' && check.citizenIndex !== null) {
      audioEngine.playClickWood();
      setL4ActiveCitizen(check.citizenIndex);
      setL4SelectedSlots([]);
      setL4Phase('reject_hazard');
      setL4DialogOpen(true);
      const nextDur = getCalibratedLevelTimer(4, difficulty);
      onSetTimerSpec(nextDur, nextDur, getReadingGraceSeconds('item'));
    } else if (check.status === 'already_done' && check.citizenIndex !== null) {
      const npc = LEVEL_4_CITIZENS[check.citizenIndex];
      showToast('ok', `Proyek ${npc?.npcName || 'warga'} sudah selesai! Jelajahi warga lain.`, {
        title: 'SELESAI',
        notifyFlash: false,
      });
    } else {
      showToast('err', 'Dekati atau ketuk salah satu warga untuk membuka soal!', {
        title: 'INFO MISI',
        notifyFlash: false,
      });
    }
  }, [
    l4InteractTick,
    currentLevel,
    prologueActive,
    roadmapActive,
    level1IntroPhase,
    remedialActive,
    journalModalLevel,
    reflectionModalLevel,
    nearbyCitizenIdx,
    completedCitizens,
    difficulty,
  ]);

  // Open Level 4 NPC question modal immediately when player clicks/taps an NPC in the 3D scene
  useEffect(() => {
    if (!l4DirectOpen || l4DirectOpen.tick === lastL4DirectTickRef.current) return;
    lastL4DirectTickRef.current = l4DirectOpen.tick;
    if (
      currentLevel !== 4 ||
      prologueActive ||
      roadmapActive ||
      level1IntroPhase !== 'core_game' ||
      remedialActive ||
      journalModalLevel !== null ||
      reflectionModalLevel !== null
    ) {
      return;
    }
    const check = evaluateCitizenInteraction(l4DirectOpen.citizenIdx, completedCitizens);
    if (check.status === 'ready' && check.citizenIndex !== null) {
      audioEngine.playClickWood();
      setL4ActiveCitizen(check.citizenIndex);
      setL4SelectedSlots([]);
      setL4Phase('reject_hazard');
      setL4DialogOpen(true);
      const nextDur = getCalibratedLevelTimer(4, difficulty);
      onSetTimerSpec(nextDur, nextDur, getReadingGraceSeconds('item'));
    } else if (check.status === 'already_done' && check.citizenIndex !== null) {
      const npc = LEVEL_4_CITIZENS[check.citizenIndex];
      showToast('ok', `Proyek ${npc?.npcName || 'warga'} sudah selesai! Jelajahi warga lain.`, {
        title: 'SELESAI',
        notifyFlash: false,
      });
    }
  }, [
    l4DirectOpen,
    currentLevel,
    prologueActive,
    roadmapActive,
    level1IntroPhase,
    remedialActive,
    journalModalLevel,
    reflectionModalLevel,
    completedCitizens,
    difficulty,
  ]);

  // Sync nearby guardian NPC in Level 5: close dialog if player walks away; never auto-open without [E]
  useEffect(() => {
    if (currentLevel !== 5) return;
    if (nearbyZoneIdx === null) {
      setL5DialogOpen(false);
      setL5ActiveZone(null);
    } else if (!l5DialogOpen) {
      setL5ActiveZone(nearbyZoneIdx);
    }
  }, [nearbyZoneIdx, currentLevel, l5DialogOpen]);

  // Open Level 5 NPC question modal when [E] (or P2 interact key) is pressed near a guardian NPC
  useEffect(() => {
    if (l5InteractTick === lastL5InteractTickRef.current) return;
    lastL5InteractTickRef.current = l5InteractTick;
    if (
      currentLevel !== 5 ||
      prologueActive ||
      roadmapActive ||
      level1IntroPhase !== 'core_game' ||
      remedialActive ||
      journalModalLevel !== null ||
      reflectionModalLevel !== null
    ) {
      return;
    }
    const check = evaluateCitizenInteraction(nearbyZoneIdx, completedZones);
    if (check.status === 'ready' && check.citizenIndex !== null) {
      audioEngine.playClickWood();
      setL5ActiveZone(check.citizenIndex);
      setL5Phase('policy');
      setL5DialogOpen(true);
      const nextDur = getCalibratedLevelTimer(5, difficulty);
      onSetTimerSpec(nextDur, nextDur, getReadingGraceSeconds('item'));
    } else if (check.status === 'already_done' && check.citizenIndex !== null) {
      const npc = LEVEL_5_ZONES[check.citizenIndex];
      showToast('ok', `Pos ${npc?.npcName || 'penjaga'} sudah selesai! Jelajahi zona lain.`, {
        title: 'SELESAI',
        notifyFlash: false,
      });
    } else {
      showToast('err', 'Dekati atau ketuk salah satu penjaga alam untuk membuka soal!', {
        title: 'INFO MISI',
        notifyFlash: false,
      });
    }
  }, [
    l5InteractTick,
    currentLevel,
    prologueActive,
    roadmapActive,
    level1IntroPhase,
    remedialActive,
    journalModalLevel,
    reflectionModalLevel,
    nearbyZoneIdx,
    completedZones,
    difficulty,
  ]);

  // Open Level 5 NPC question modal immediately when player clicks/taps a guardian NPC in 3D scene
  useEffect(() => {
    if (!l5DirectOpen || l5DirectOpen.tick === lastL5DirectTickRef.current) return;
    lastL5DirectTickRef.current = l5DirectOpen.tick;
    if (
      currentLevel !== 5 ||
      prologueActive ||
      roadmapActive ||
      level1IntroPhase !== 'core_game' ||
      remedialActive ||
      journalModalLevel !== null ||
      reflectionModalLevel !== null
    ) {
      return;
    }
    const check = evaluateCitizenInteraction(l5DirectOpen.zoneIdx, completedZones);
    if (check.status === 'ready' && check.citizenIndex !== null) {
      audioEngine.playClickWood();
      setL5ActiveZone(check.citizenIndex);
      setL5Phase('policy');
      setL5DialogOpen(true);
      const nextDur = getCalibratedLevelTimer(5, difficulty);
      onSetTimerSpec(nextDur, nextDur, getReadingGraceSeconds('item'));
    } else if (check.status === 'already_done' && check.citizenIndex !== null) {
      const npc = LEVEL_5_ZONES[check.citizenIndex];
      showToast('ok', `Pos ${npc?.npcName || 'penjaga'} sudah selesai! Jelajahi zona lain.`, {
        title: 'SELESAI',
        notifyFlash: false,
      });
    }
  }, [
    l5DirectOpen,
    currentLevel,
    prologueActive,
    roadmapActive,
    level1IntroPhase,
    remedialActive,
    journalModalLevel,
    reflectionModalLevel,
    completedZones,
    difficulty,
  ]);

  // Level 6 Pre-Level Opening Audio: Trigger dramatic Earth Rumble at Beat 2 (Dive + Cracked Earth + Ash-Gray)
  useEffect(() => {
    if (
      currentLevel !== 6 ||
      level1IntroPhase !== 'looking' ||
      prologueActive ||
      roadmapActive
    ) {
      l6DiveRumbleTriggeredRef.current = false;
      return;
    }
    if (lookingSecondsLeft <= 9 && !l6DiveRumbleTriggeredRef.current) {
      l6DiveRumbleTriggeredRef.current = true;
      if (!isSplitMode || playerSlot === 1) {
        audioEngine.playEarthRumbleLong();
      }
    }
  }, [currentLevel, level1IntroPhase, lookingSecondsLeft, prologueActive, roadmapActive, isSplitMode, playerSlot]);

  // Sync nearby Menara Radar in Level 6: close dialog if player walks far away; track nearby index
  useEffect(() => {
    if (currentLevel !== 6) return;
    if (nearbyIslandIdx === null) {
      setL6DialogOpen(false);
      setL6ActiveStation(null);
    } else if (!l6DialogOpen) {
      setL6ActiveStation(nearbyIslandIdx);
    }
  }, [nearbyIslandIdx, currentLevel, l6DialogOpen]);

  // Helper to open Level 6 tower modal safely
  const openL6TowerModal = (stationIdx: number) => {
    audioEngine.playClickWood();
    setL6ActiveStation(stationIdx);
    setL6Pillars(isSplitMode ? [0, 0, 0] : [1, 1, 1]);
    setL6Phase('pillars');
    setL6DialogOpen(true);
    const nextDur = getCalibratedLevelTimer(6, difficulty);
    onSetTimerSpec(nextDur, nextDur, getReadingGraceSeconds('item'));
  };

  // Open Level 6 Menara Radar modal when [E] (or P2 interact key) is pressed near a tower
  useEffect(() => {
    if (l6InteractTick === lastL6InteractTickRef.current) return;
    lastL6InteractTickRef.current = l6InteractTick;
    if (
      currentLevel !== 6 ||
      prologueActive ||
      roadmapActive ||
      level1IntroPhase !== 'core_game' ||
      remedialActive ||
      journalModalLevel !== null ||
      reflectionModalLevel !== null ||
      l6CelebratingNetwork
    ) {
      return;
    }
    const check = evaluateCitizenInteraction(nearbyIslandIdx, completedIslands);
    if (check.status === 'ready' && check.citizenIndex !== null) {
      openL6TowerModal(check.citizenIndex);
    } else if (check.status === 'already_done' && check.citizenIndex !== null) {
      const isl = LEVEL_6_ISLANDS[check.citizenIndex];
      showToast('ok', `Menara ${isl?.islandName || 'Radar'} (${isl?.shortRegion || ''}) sudah hijau zamrud! Jelajahi menara lain.`, {
        title: 'AKTIF',
        notifyFlash: false,
      });
    } else {
      showToast('err', 'Dekati, sentuh, atau klik salah satu Menara Radar untuk membuka soal!', {
        title: 'INFO MISI',
        notifyFlash: false,
      });
    }
  }, [
    l6InteractTick,
    currentLevel,
    prologueActive,
    roadmapActive,
    level1IntroPhase,
    remedialActive,
    journalModalLevel,
    reflectionModalLevel,
    nearbyIslandIdx,
    completedIslands,
    difficulty,
    isSplitMode,
    l6CelebratingNetwork,
  ]);

  // Open Level 6 Menara Radar modal immediately when player clicks/taps a tower in the 3D scene
  useEffect(() => {
    if (!l6DirectOpen || l6DirectOpen.tick === lastL6DirectTickRef.current) return;
    lastL6DirectTickRef.current = l6DirectOpen.tick;
    if (
      currentLevel !== 6 ||
      prologueActive ||
      roadmapActive ||
      level1IntroPhase !== 'core_game' ||
      remedialActive ||
      journalModalLevel !== null ||
      reflectionModalLevel !== null ||
      l6CelebratingNetwork
    ) {
      return;
    }
    const check = evaluateCitizenInteraction(l6DirectOpen.islandIdx, completedIslands);
    if (check.status === 'ready' && check.citizenIndex !== null) {
      openL6TowerModal(check.citizenIndex);
    } else if (check.status === 'already_done' && check.citizenIndex !== null) {
      const isl = LEVEL_6_ISLANDS[check.citizenIndex];
      showToast('ok', `Menara ${isl?.islandName || 'Radar'} (${isl?.shortRegion || ''}) sudah hijau zamrud! Jelajahi menara lain.`, {
        title: 'AKTIF',
        notifyFlash: false,
      });
    }
  }, [
    l6DirectOpen,
    currentLevel,
    prologueActive,
    roadmapActive,
    level1IntroPhase,
    remedialActive,
    journalModalLevel,
    reflectionModalLevel,
    completedIslands,
    difficulty,
    isSplitMode,
    l6CelebratingNetwork,
  ]);

  // Open Level 6 Menara Radar modal when player physically touches a tower in 3D space
  useEffect(() => {
    if (!l6TouchOpen || l6TouchOpen.tick === lastL6TouchTickRef.current) return;
    lastL6TouchTickRef.current = l6TouchOpen.tick;
    if (
      currentLevel !== 6 ||
      prologueActive ||
      roadmapActive ||
      level1IntroPhase !== 'core_game' ||
      remedialActive ||
      journalModalLevel !== null ||
      reflectionModalLevel !== null ||
      l6DialogOpen ||
      l6CelebratingNetwork
    ) {
      return;
    }
    const check = evaluateCitizenInteraction(l6TouchOpen.islandIdx, completedIslands);
    if (check.status === 'ready' && check.citizenIndex !== null) {
      openL6TowerModal(check.citizenIndex);
    }
  }, [
    l6TouchOpen,
    currentLevel,
    prologueActive,
    roadmapActive,
    level1IntroPhase,
    remedialActive,
    journalModalLevel,
    reflectionModalLevel,
    completedIslands,
    difficulty,
    isSplitMode,
    l6DialogOpen,
    l6CelebratingNetwork,
  ]);

  const onDialogOpenChangeRef = useRef(onDialogOpenChange);
  onDialogOpenChangeRef.current = onDialogOpenChange;
  useEffect(() => {
    const isOpen =
      (currentLevel === 4 && l4DialogOpen) ||
      (currentLevel === 5 && l5DialogOpen) ||
      (currentLevel === 6 && l6DialogOpen);
    onDialogOpenChangeRef.current?.(isOpen);
  }, [currentLevel, l4DialogOpen, l5DialogOpen, l6DialogOpen]);

  // Sistem Narasi: TULISAN MUNCUL 0,1 DETIK, DISUSUL SUARA NARATOR MEMBACA
  useEffect(() => {
    let targetString = '';
    const isPreLevelNarration =
      !prologueActive &&
      !roadmapActive &&
      !journalModalLevel &&
      !reflectionModalLevel &&
      level1IntroPhase === 'narration';

    if (prologueActive) {
      const stageObj = PROLOGUE_BABAK[prologueStage - 1] || PROLOGUE_BABAK[0];
      targetString = stageObj.getText(playerName);
      // 1. Tulisan muncul penuh terlebih dahulu
      setTypedText(targetString);
      // 2. Efek suara atmosferik per babak & suara narator menyusul 0,1 detik
      if (!isSplitMode || playerSlot === 1) {
        if (prologueStage === 2) {
          audioEngine.playEarthTremor();
        } else if (prologueStage === 3) {
          audioEngine.playNatureHealed();
        }
        audioEngine.speak(targetString, 100);
        const nextBabak = PROLOGUE_BABAK[prologueStage];
        if (nextBabak) {
          audioEngine.prefetch(nextBabak.getText(playerName));
        }
      }
    } else if (journalModalLevel && JOURNAL_TRANSMISSIONS[journalModalLevel]) {
      targetString = JOURNAL_TRANSMISSIONS[journalModalLevel].getText(playerName);
      // 1. Tulisan muncul penuh terlebih dahulu
      setTypedText(targetString);
      // 2. 0,1 detik kemudian (100ms) menyusul suara narator membaca
      if (!isSplitMode || playerSlot === 1) {
        audioEngine.speak(targetString, 100);
      }
    } else if (reflectionModalLevel) {
      const rMeta = LEVEL_METADATA[reflectionModalLevel - 1] || LEVEL_METADATA[0];
      targetString = `Alhamdulillah, Misi Level ${rMeta.level} ${rMeta.name} tuntas! ${rMeta.reflection}`;
      setTypedText(targetString);
      if (!isSplitMode || playerSlot === 1) {
        audioEngine.speak(targetString, 100);
        const nextJournal = JOURNAL_TRANSMISSIONS[reflectionModalLevel + 1];
        if (nextJournal) {
          audioEngine.prefetch(nextJournal.getText(playerName));
        }
      }
    } else if (isPreLevelNarration) {
      targetString = levelMeta.getOpeningDialog(playerName);
      // 1. Tulisan muncul penuh terlebih dahulu
      setTypedText(targetString);
      // 2. 0,1 detik kemudian (100ms) menyusul suara narator membaca
      if (!isSplitMode || playerSlot === 1) {
        audioEngine.speak(targetString, 100);
      }
    } else {
      setTypedText('');
      if (!isSplitMode || playerSlot === 1) {
        if (level1IntroPhase === 'looking' && !roadmapActive) {
          audioEngine.prefetch(levelMeta.getOpeningDialog(playerName));
        }
      }
    }
  }, [
    prologueActive,
    prologueStage,
    roadmapActive,
    journalModalLevel,
    reflectionModalLevel,
    currentLevel,
    level1IntroPhase,
    playerName,
    isSplitMode,
    playerSlot,
    levelMeta,
  ]);

  // Mobile-only alternating subtitle ticker ("tulisan bergantian") for Prologue, Journal, and Tahap 1/2
  const isShowingMobileSubtitleView =
    prologueActive ||
    Boolean(journalModalLevel) ||
    (!roadmapActive && !reflectionModalLevel && level1IntroPhase !== 'core_game');

  useEffect(() => {
    setSubtitleChunkIdx(0);
    setMobileTextExpanded(false);
  }, [prologueActive, prologueStage, journalModalLevel, currentLevel, level1IntroPhase]);

  useEffect(() => {
    if (!isShowingMobileSubtitleView || mobileTextExpanded) return;
    const intervalMs = level1IntroPhase === 'looking' ? 3200 : 4000;
    const id = window.setInterval(() => {
      setSubtitleChunkIdx((prev) => prev + 1);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [isShowingMobileSubtitleView, mobileTextExpanded, level1IntroPhase]);

  // --- LEVEL 1 HANDLER ---
  const fallbackL1Item = LEVEL_1_ITEMS[l1Index] || LEVEL_1_ITEMS[0];
  const activeL1Entry: Level1DeckItem =
    isSplitMode && level1Deck && level1Deck[l1Index]
      ? level1Deck[l1Index]
      : { specIndex: l1Index, item: fallbackL1Item };
  const totalL1Items =
    isSplitMode && level1Deck && level1Deck.length > 0
      ? level1Deck.length
      : LEVEL_1_ITEMS.length;

  const handleLevel1Sort = (dir: 'KIRI' | 'ATAS' | 'KANAN') => {
    if (!canClick()) return;
    const item = activeL1Entry.item;
    if (!item) return;

    const res = verifyLevel1Sort(activeL1Entry.specIndex, dir);
    const evalMeta = getLevel1EvaluationMeta(item);
    onRecordEvaluation?.({
      challengeKey: `L1-item-${item.id}`,
      level: 1,
      bloomCode: 'C1',
      phaseLabel: 'Pilah Sampah',
      promptTitle: item.name,
      questionText: `Termasuk kategori apakah "${item.name}"?`,
      isCorrect: res.correct,
      chosenAnswer: getLevel1BinLabel(dir),
      correctAnswer: evalMeta.correctAnswer,
      explanation: evalMeta.explanation,
    });

    if (res.correct) {
      if (dir === 'ATAS') {
        audioEngine.playBinMetallicB3();
      } else {
        audioEngine.playBinThud();
      }
      audioEngine.playSuccessChord();
      triggerL1BinFlash(dir, 'ok');
      onScoreDelta(1, res.pointsDelta);
      showToast(
        'ok',
        `Bagus sekali, ${playerName}! Kamu teliti mengenali ${item.name} sebagai sampah ${item.category}. Terus pertahankan kepedulianmu ya!`,
        {
          title: 'HEBAT, TEPAT!',
          badge: `+${res.pointsDelta} Poin 🌟`,
        }
      );

      if (l1Index + 1 >= totalL1Items) {
        onLevelComplete(1);
      } else {
        const nextIdx = l1Index + 1;
        setL1Index(nextIdx);
        const nextItem =
          isSplitMode && level1Deck && level1Deck[nextIdx]
            ? level1Deck[nextIdx].item
            : LEVEL_1_ITEMS[nextIdx];
        const nextDur = getCalibratedLevelTimer(1, difficulty, {
          wave: nextItem.wave,
        });
        onSetTimerSpec(nextDur, nextDur, getReadingGraceSeconds('item'));
      }
    } else {
      audioEngine.playErrorBuzz();
      triggerL1BinFlash(dir, 'err');
      const l1GuideHint =
        item.category === 'Organik'
          ? `Tidak apa-apa, ${playerName}, belajar itu butuh proses! Perhatikan ${item.name} — benda ini berasal dari alam dan mudah membusuk, yuk arahkan ke tong ORGANIK (Kiri) ya.`
          : item.category === 'Anorganik'
          ? `Hampir pas, ${playerName}! Yuk perhatikan ${item.name} — benda ini bisa didaur ulang dan bukan sisa makhluk hidup, mari arahkan ke tong ANORGANIK (Kanan) ya.`
          : `Terima kasih sudah mencoba, ${playerName}! Ingat ya, ${item.name} mengandung bahan khusus yang perlu penanganan aman, yuk masukkan ke tong B3 (Tengah).`;
      onLoseLife(l1GuideHint);
      showToast('err', l1GuideHint, {
        title: 'YUK KITA PERIKSA BERSAMA',
        badge: '🌱 Coba Lagi Ya',
      });
    }
  };

  // --- LEVEL 2 HANDLERS ---
  const fallbackL2Spec = LEVEL_2_ANAGRAMS[l2Index] || LEVEL_2_ANAGRAMS[0];
  const activeL2Item: Level2DeckItem =
    isSplitMode && level2Deck && level2Deck[l2Index]
      ? level2Deck[l2Index]
      : {
          specIndex: l2Index,
          targetWord: fallbackL2Spec.targetWord,
          scrambledLetters: fallbackL2Spec.scrambled,
          meaning: fallbackL2Spec.meaning,
          numeracyQuestion: fallbackL2Spec.numeracyQuestion,
          options: fallbackL2Spec.options,
        };
  const totalL2Words =
    isSplitMode && level2Deck && level2Deck.length > 0
      ? level2Deck.length
      : LEVEL_2_ANAGRAMS.length;
  const assembledL2Word = l2PickedIndices
    .map((i) => activeL2Item.scrambledLetters[i] || '')
    .join('');

  const onLevel2VisualChangeRef = useRef(onLevel2VisualChange);
  onLevel2VisualChangeRef.current = onLevel2VisualChange;

  useEffect(() => {
    if (currentLevel === 2 && onLevel2VisualChangeRef.current) {
      onLevel2VisualChangeRef.current({
        assembledLetters: l2PickedIndices.map((i) => activeL2Item.scrambledLetters[i] || ''),
        targetLength: activeL2Item.scrambledLetters.length,
        targetWord: activeL2Item.targetWord,
        phase: l2Phase,
      });
    }
  }, [
    currentLevel,
    l2Index,
    l2PickedIndices,
    l2Phase,
    activeL2Item.targetWord,
    activeL2Item.scrambledLetters,
  ]);

  const activeL2CursorIdx = resolveLevel2CursorIndex(
    activeL2Item.scrambledLetters.length,
    l2PickedIndices,
    l2CursorIdx
  );
  const activeL2CursorLetter = activeL2Item.scrambledLetters[activeL2CursorIdx] || '';

  const handlePickL2Letter = (letterIdx: number) => {
    if (l2PickedIndices.includes(letterIdx)) return;
    audioEngine.playWoodTileSnap();
    const next = [...l2PickedIndices, letterIdx];
    setL2PickedIndices(next);
    setL2CursorIdx(
      resolveLevel2CursorIndex(activeL2Item.scrambledLetters.length, next, letterIdx)
    );

    if (next.length === activeL2Item.scrambledLetters.length) {
      const candidate = next.map((i) => activeL2Item.scrambledLetters[i] || '').join('');
      const isWordRight = verifyLevel2Anagram(activeL2Item.specIndex, candidate);
      const l2FullSpec = LEVEL_2_ANAGRAMS[activeL2Item.specIndex] || fallbackL2Spec;
      const wordEvalMeta = getLevel2WordEvaluationMeta(l2FullSpec);
      onRecordEvaluation?.({
        challengeKey: `L2-word-${l2FullSpec.id}`,
        level: 2,
        bloomCode: 'C2',
        phaseLabel: 'Susun Kata 3R',
        promptTitle: `Konsep "${l2FullSpec.targetWord}"`,
        questionText: `Susun kata yang bermakna: ${l2FullSpec.meaning}`,
        isCorrect: isWordRight,
        chosenAnswer: candidate,
        correctAnswer: wordEvalMeta.correctAnswer,
        explanation: wordEvalMeta.explanation,
      });

      if (isWordRight) {
        audioEngine.playSuccessChord();
        setWrongOptionFlash(null);
        showToast(
          'ok',
          `MasyaAllah, pintar sekali ${playerName}! Kamu berhasil menyusun "${candidate}". Sekarang mari pecahkan soal hitungannya dengan tenang ya!`,
          { title: 'LUAR BIASA!', badge: '✨ Tahap 2 Siap' }
        );
        setL2Phase('numeracy');
        const numDur = getCalibratedLevelTimer(2, difficulty, { isNumeracy: true });
        onSetTimerSpec(numDur, numDur, getReadingGraceSeconds('numeracy'));
      } else {
        audioEngine.playErrorBuzz();
        const l2WordGuide = `Tidak apa-apa, ${playerName}, menyusun huruf memang butuh ketelitian! Coba baca lagi maknanya di atas pelan-pelan, lalu susun hurufnya satu per satu ya.`;
        onLoseLife(l2WordGuide);
        showToast('err', l2WordGuide, {
          title: 'YUK SUSUN PELAN-PELAN',
          badge: '💡 Pasti Bisa',
        });
        setL2PickedIndices([]);
        setL2CursorIdx(0);
      }
    }
  };

  const handleStepL2Cursor = (direction: 'left' | 'right') => {
    if (l2Phase !== 'anagram') return;
    audioEngine.playClickWood();
    const nextCursor = stepLevel2AvailableLetterIndex(
      activeL2Item.scrambledLetters.length,
      l2PickedIndices,
      activeL2CursorIdx,
      direction
    );
    setL2CursorIdx(nextCursor);
  };

  const handleDropL2CursorLetter = () => {
    if (l2Phase !== 'anagram' || !canClick()) return;
    if (l2PickedIndices.includes(activeL2CursorIdx)) return;
    handlePickL2Letter(activeL2CursorIdx);
  };

  const handleRemoveL2Slot = (slotIdx: number) => {
    if (l2Phase !== 'anagram' || slotIdx >= l2PickedIndices.length) return;
    audioEngine.playClickWood();
    const removedIdx = l2PickedIndices[slotIdx];
    setL2PickedIndices((prev) => prev.filter((_, idx) => idx !== slotIdx));
    if (typeof removedIdx === 'number') {
      setL2CursorIdx(removedIdx);
    }
  };

  const handleL2NumeracyOption = (isCorrect: boolean, optIdx?: number) => {
    if (!canClick()) return;
    const l2FullSpec = LEVEL_2_ANAGRAMS[activeL2Item.specIndex] || fallbackL2Spec;
    const numEvalMeta = getLevel2NumeracyEvaluationMeta(l2FullSpec);
    const chosenLabel =
      typeof optIdx === 'number' && activeL2Item.options[optIdx]
        ? activeL2Item.options[optIdx].label
        : isCorrect
        ? numEvalMeta.correctAnswer
        : 'Pilihan lain';

    onRecordEvaluation?.({
      challengeKey: `L2-num-${l2FullSpec.id}`,
      level: 2,
      bloomCode: 'C2',
      phaseLabel: 'Numerasi 3R',
      promptTitle: `Hitungan ${l2FullSpec.targetWord}`,
      questionText: l2FullSpec.numeracyQuestion,
      isCorrect,
      chosenAnswer: chosenLabel,
      correctAnswer: numEvalMeta.correctAnswer,
      explanation: numEvalMeta.explanation,
    });

    if (isCorrect) {
      audioEngine.playSuccessChord();
      setWrongOptionFlash(null);
      onScoreDelta(2, 3);
      showToast(
        'ok',
        `Hebat sekali, ${playerName}! Hitunganmu tentang ${activeL2Item.targetWord} sudah tepat. Semangat belajar seperti ini yang bikin bumi bangga!`,
        {
          title: 'CERDAS & TELITI!',
          badge: '+3 Poin C2 🌟',
        }
      );
      if (l2Index + 1 >= totalL2Words) {
        onLevelComplete(2);
      } else {
        setL2Index(l2Index + 1);
        setL2PickedIndices([]);
        setL2Phase('anagram');
        const nextDur = getCalibratedLevelTimer(2, difficulty);
        onSetTimerSpec(nextDur, nextDur, getReadingGraceSeconds('item'));
      }
    } else {
      audioEngine.playErrorBuzz();
      if (typeof optIdx === 'number') triggerWrongOptionFlash(`l2-opt-${optIdx}`);
      const l2NumGuide = `Semangat terus ya, ${playerName}! Belum pas sedikit lagi — yuk baca ulang angkanya pelan-pelan dan hitung langkah demi langkah.`;
      onLoseLife(l2NumGuide);
      showToast('err', l2NumGuide, {
        title: 'MARI HITUNG BERSAMA',
        badge: '💡 Cek Lagi Ya',
      });
    }
  };

  // --- LEVEL 3 HANDLERS ---
  const activeL3Deck =
    isSplitMode && level3Deck && level3Deck.length > 0 ? level3Deck : null;
  const totalL3Items = activeL3Deck ? activeL3Deck.length : LEVEL_3_CLAW_ITEMS.length;
  const activeL3Entry = activeL3Deck
    ? activeL3Deck[l3Index] || activeL3Deck[0]
    : {
        specIndex: l3Index,
        item: LEVEL_3_CLAW_ITEMS[l3Index] || LEVEL_3_CLAW_ITEMS[0],
        options: (LEVEL_3_CLAW_ITEMS[l3Index] || LEVEL_3_CLAW_ITEMS[0]).options,
      };
  const currentL3Spec = activeL3Entry.item;

  useEffect(() => {
    return () => {
      if (l3DropTimerRef.current) {
        window.clearTimeout(l3DropTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (currentLevel === 3) {
      onUpdateClawState(
        getLevel3ClawXForBin(l3SelectedBin),
        l3Dropping,
        activeL3Entry.specIndex,
        l3Phase
      );
    }
  }, [currentLevel, l3SelectedBin, l3Dropping, activeL3Entry.specIndex, l3Phase]);

  const handleSelectClawBin = (bin: 'REDUCE' | 'REUSE' | 'RECYCLE') => {
    if (l3Dropping) return;
    audioEngine.playClawAction('motor');
    setL3SelectedBin(bin);
  };

  const handleMoveClawStep = (direction: 'left' | 'right') => {
    if (l3Dropping) return;
    const nextBin = stepLevel3Bin(l3SelectedBin, direction);
    if (nextBin === l3SelectedBin) {
      audioEngine.playClickWood();
      return;
    }
    audioEngine.playClawAction('motor');
    setL3SelectedBin(nextBin);
  };

  const handleDropClawItem = () => {
    if (l3Dropping || !canClick()) return;
    audioEngine.playClawAction('lock');
    setL3Dropping(true);

    const droppedBin = l3SelectedBin;
    const droppedSpecIdx = activeL3Entry.specIndex;
    const droppedSpec = currentL3Spec;

    if (l3DropTimerRef.current) {
      window.clearTimeout(l3DropTimerRef.current);
    }
    l3DropTimerRef.current = window.setTimeout(() => {
      l3DropTimerRef.current = null;
      setL3Dropping(false);
      const check = verifyLevel3Drop(droppedSpecIdx, droppedBin);
      const clawEvalMeta = getLevel3ClawEvaluationMeta(droppedSpec);
      onRecordEvaluation?.({
        challengeKey: `L3-claw-${droppedSpec.id}`,
        level: 3,
        bloomCode: 'C3',
        phaseLabel: 'Mesin Capit 3R',
        promptTitle: droppedSpec.name,
        questionText: `Ke tong 3R mana "${droppedSpec.name}" harus diarahkan?`,
        isCorrect: check.correct,
        chosenAnswer: `Tong ${droppedBin}`,
        correctAnswer: clawEvalMeta.correctAnswer,
        explanation: clawEvalMeta.explanation,
      });

      if (check.correct) {
        audioEngine.playSuccessChord();
        setWrongOptionFlash(null);
        showToast(
          'ok',
          `Tepat sasaran, ${playerName}! ${droppedSpec.name} paling pas masuk ke tong ${droppedBin}. Yuk lanjut hitung dampak baiknya dengan tenang!`,
          { title: 'KEREN & TELITI!', badge: `Tong ${droppedBin} ✨` }
        );
        setL3Phase('numeracy');
        const numDur = getCalibratedLevelTimer(3, difficulty, { isNumeracy: true });
        onSetTimerSpec(numDur, numDur, getReadingGraceSeconds('numeracy'));
      } else {
        audioEngine.playErrorBuzz();
        const l3BinGuide = `Bagus sudah berani mencoba, ${playerName}! Sedikit petunjuk: pikirkan apakah ${droppedSpec.name} sebaiknya dikurangi (REDUCE), dipakai ulang (REUSE), atau didaur ulang (RECYCLE) — yuk arahkan ke tong ${droppedSpec.targetBin} ya!`;
        onLoseLife(l3BinGuide);
        showToast('err', l3BinGuide, {
          title: 'YUK ARAHKAN BERSAMA',
          badge: '🌱 Coba Lagi Ya',
        });
      }
    }, 550);
  };

  const handleL3NumeracyOption = (isCorrect: boolean, optIdx?: number) => {
    if (!canClick()) return;
    const numEvalMeta = getLevel3NumeracyEvaluationMeta(currentL3Spec);
    const chosenLabel =
      typeof optIdx === 'number' && activeL3Entry.options[optIdx]
        ? activeL3Entry.options[optIdx].label
        : isCorrect
        ? numEvalMeta.correctAnswer
        : 'Pilihan lain';

    onRecordEvaluation?.({
      challengeKey: `L3-num-${currentL3Spec.id}`,
      level: 3,
      bloomCode: 'C3',
      phaseLabel: 'Numerasi Mesin Capit',
      promptTitle: `Hitungan: ${currentL3Spec.name}`,
      questionText: currentL3Spec.numeracyQuestion,
      isCorrect,
      chosenAnswer: chosenLabel,
      correctAnswer: numEvalMeta.correctAnswer,
      explanation: numEvalMeta.explanation,
    });

    if (isCorrect) {
      audioEngine.playSuccessChord();
      setWrongOptionFlash(null);
      onScoreDelta(3, 2.5);
      showToast(
        'ok',
        `Alhamdulillah, mantap sekali ${playerName}! Kamu makin mahir menghitung kebaikan 3R untuk ${currentL3Spec.name}. Terus semangat ya!`,
        {
          title: 'ALHAMDULILLAH, TEPAT!',
          badge: '+2,5 Poin C3 🌟',
        }
      );
      setL3Dropping(false);
      setL3SelectedBin('REUSE');
      if (l3Index + 1 >= totalL3Items) {
        onLevelComplete(3);
      } else {
        setL3Index(l3Index + 1);
        setL3Phase('claw');
        const nextDur = getCalibratedLevelTimer(3, difficulty);
        onSetTimerSpec(nextDur, nextDur, getReadingGraceSeconds('item'));
      }
    } else {
      audioEngine.playErrorBuzz();
      if (typeof optIdx === 'number') triggerWrongOptionFlash(`l3-opt-${optIdx}`);
      const l3NumGuide = `Jangan ragu mencoba lagi ya, ${playerName}! Perhatikan kembali perbandingan angkanya di soal, kamu pasti ketemu jawabannya.`;
      onLoseLife(l3NumGuide);
      showToast('err', l3NumGuide, {
        title: 'PELAN-PELAN SAJA',
        badge: '💡 Hitung Ulang Yuk',
      });
    }
  };

  // --- LEVEL 4 HANDLERS ---
  const activeL4Deck: Level4DeckItem[] =
    isSplitMode && level4Deck && level4Deck.length > 0
      ? level4Deck
      : LEVEL_4_CITIZENS.map((citizen, specIndex) => ({
          specIndex,
          citizen,
          materials: citizen.materials,
          options: citizen.options,
        }));
  const activeStationIdx = l4ActiveCitizen ?? 0;
  const activeL4Entry = isSplitMode
    ? activeL4Deck[activeStationIdx] || activeL4Deck[0]
    : activeL4Deck.find((d) => d.specIndex === activeStationIdx) || activeL4Deck[0];
  const stationNpc = LEVEL_4_CITIZENS[activeStationIdx] || activeL4Entry.citizen;
  const currentCitizen = activeL4Entry.citizen;

  const handleWalkToCitizen = (idx: number) => {
    audioEngine.playFootstepAsphalt();
    const cit = LEVEL_4_CITIZENS[idx];
    if (cit) {
      const pos = l4Positions?.[idx] ?? cit.position;
      const vx = -pos[0];
      const vz = 2 - pos[1];
      const len = Math.hypot(vx, vz) || 1;
      const nx = pos[0] + (vx / len) * 2.4;
      const nz = pos[1] + (vz / len) * 2.4;
      playerPosRef.current.x = nx;
      playerPosRef.current.z = nz;
      playerPosRef.current.rotY = Math.atan2(pos[0] - nx, pos[1] - nz);
      setL4DialogOpen(false);
      setL4ActiveCitizen(idx);
      setL4SelectedSlots([]);
      showToast(
        'ok',
        `Mendekati ${cit.npcName}. Ketuk warga atau tekan tombol [E] untuk membuka soal!`,
        { title: 'SIAP INTERAKSI', notifyFlash: false }
      );
    }
  };

  const handleOpenNearbyCitizenQuestion = () => {
    const check = evaluateCitizenInteraction(nearbyCitizenIdx, completedCitizens);
    if (check.status === 'ready' && check.citizenIndex !== null) {
      audioEngine.playClickWood();
      setL4ActiveCitizen(check.citizenIndex);
      setL4SelectedSlots([]);
      setL4Phase('reject_hazard');
      setL4DialogOpen(true);
      const nextDur = getCalibratedLevelTimer(4, difficulty);
      onSetTimerSpec(nextDur, nextDur, getReadingGraceSeconds('item'));
    } else if (check.status === 'already_done' && check.citizenIndex !== null) {
      const npc = LEVEL_4_CITIZENS[check.citizenIndex];
      showToast('ok', `Proyek ${npc?.npcName || 'warga'} sudah selesai! Jelajahi warga lain.`, {
        title: 'SELESAI',
        notifyFlash: false,
      });
    }
  };

  const handleL4InspectMaterial = (slot: 1 | 2 | 3 | 4, displayNum?: number) => {
    const now = performance.now();
    if (now - lastL4MatClickRef.current < 65) return;
    lastL4MatClickRef.current = now;

    const res = evaluateLevel4MaterialSelection(activeL4Entry.specIndex, l4SelectedSlots, slot);
    const labelText = isSplitMode && displayNum ? `Pilihan ${displayNum}` : `Slot ${slot}`;
    const matEvalMeta = getLevel4MaterialEvaluationMeta(currentCitizen);
    const clickedMat = currentCitizen.materials.find((m) => m.slot === slot);

    if (res.status === 'hazard_decoy') {
      onRecordEvaluation?.({
        challengeKey: `L4-mat-${currentCitizen.id}`,
        level: 4,
        bloomCode: 'C4',
        phaseLabel: 'Seleksi Bahan Aman',
        promptTitle: `${currentCitizen.projectTitle} (${currentCitizen.npcName})`,
        questionText: currentCitizen.complaint,
        isCorrect: false,
        chosenAnswer: clickedMat?.name || labelText,
        correctAnswer: matEvalMeta.correctAnswer,
        explanation: matEvalMeta.explanation,
      });
      audioEngine.playErrorBuzz();
      triggerWrongOptionFlash(`l4-mat-${slot}`);
      const cleanReason = (res.reason || `${labelText} kurang aman digunakan`).replace(/!+$/, '');
      const l4HazardGuide = `Terima kasih sudah teliti memeriksa, ${playerName}! Namun ${cleanReason} — yuk kita pilih bahan lain yang aman dan ramah bagi warga ya!`;
      onLoseLife(l4HazardGuide);
      showToast('err', l4HazardGuide, {
        title: 'YUK JAGA KESELAMATAN',
        badge: '💡 Pilih Bahan Aman',
      });
    } else if (res.status === 'deselected') {
      audioEngine.playClickWood();
      setL4SelectedSlots(res.nextSelected);
    } else if (res.status === 'selected') {
      audioEngine.playSelectionConfirm();
      setL4SelectedSlots(res.nextSelected);
      showToast(
        'ok',
        `Bagus sekali, ${playerName}! Bahan ramah lingkungan ini aman dan cocok (${res.nextSelected.length}/${res.safeCount}). Yuk pilih bahan aman lainnya!`,
        { title: 'PILIHAN CERDAS!', badge: `${res.nextSelected.length}/${res.safeCount} Bahan 🌱` }
      );
    } else if (res.status === 'complete') {
      onRecordEvaluation?.({
        challengeKey: `L4-mat-${currentCitizen.id}`,
        level: 4,
        bloomCode: 'C4',
        phaseLabel: 'Seleksi Bahan Aman',
        promptTitle: `${currentCitizen.projectTitle} (${currentCitizen.npcName})`,
        questionText: currentCitizen.complaint,
        isCorrect: true,
        chosenAnswer: matEvalMeta.correctAnswer,
        correctAnswer: matEvalMeta.correctAnswer,
        explanation: matEvalMeta.explanation,
      });
      setL4SelectedSlots(res.nextSelected);
      setWrongOptionFlash(null);
      audioEngine.playSuccessChord();
      showToast(
        'ok',
        `Luar biasa, ${playerName}! Semua ${res.safeCount} bahan membuat ${currentCitizen.projectTitle} aman dan ramah alam. Sekarang yuk bantu warga menghitung kebutuhannya!`,
        { title: 'TELITI & PEDULI!', badge: '✨ Bahan Lengkap' }
      );
      setL4Phase('numeracy');
      const numDur = getCalibratedLevelTimer(4, difficulty, { isNumeracy: true });
      onSetTimerSpec(numDur, numDur, getReadingGraceSeconds('numeracy'));
    }
  };

  const handleL4NumeracyOption = (isCorrect: boolean, optIdx?: number) => {
    if (!canClick()) return;
    const numEvalMeta = getLevel4NumeracyEvaluationMeta(currentCitizen);
    const chosenLabel =
      typeof optIdx === 'number' && activeL4Entry.options[optIdx]
        ? activeL4Entry.options[optIdx].label
        : isCorrect
        ? numEvalMeta.correctAnswer
        : 'Pilihan lain';

    onRecordEvaluation?.({
      challengeKey: `L4-num-${currentCitizen.id}`,
      level: 4,
      bloomCode: 'C4',
      phaseLabel: 'Numerasi Karya Kota',
      promptTitle: `Hitungan: ${currentCitizen.projectTitle}`,
      questionText: currentCitizen.numeracyQuestion,
      isCorrect,
      chosenAnswer: chosenLabel,
      correctAnswer: numEvalMeta.correctAnswer,
      explanation: numEvalMeta.explanation,
    });

    if (isCorrect) {
      audioEngine.playSuccessChord();
      setWrongOptionFlash(null);
      onScoreDelta(4, 4);
      onMarkCitizenDone(activeStationIdx);

      const nextDoneCount = completedCitizens.includes(activeStationIdx)
        ? completedCitizens.length
        : completedCitizens.length + 1;

      setL4DialogOpen(false);
      setL4ActiveCitizen(null);
      setL4SelectedSlots([]);
      setL4Phase('reject_hazard');

      if (nextDoneCount >= activeL4Deck.length) {
        showToast(
          'ok',
          `Alhamdulillah! Karyamu untuk ${currentCitizen.projectTitle} selesai dengan penuh kepedulian. Semua warga sangat berterima kasih padamu, ${playerName}!`,
          {
            title: 'KARYA HEBAT!',
            badge: '+4 Poin C4 🌟',
          }
        );
        onLevelComplete(4);
      } else {
        showToast(
          'ok',
          `Hebat, ${playerName}! Karya ${currentCitizen.projectTitle} selesai dengan aman. Warga senang sekali — yuk bantu warga berikutnya!`,
          { title: 'TERIMA KASIH, NAK!', badge: '+4 Poin C4 🌟' }
        );
      }
    } else {
      audioEngine.playErrorBuzz();
      if (typeof optIdx === 'number') triggerWrongOptionFlash(`l4-opt-${optIdx}`);
      const l4NumGuide = `Hampir ketemu, ${playerName}! Yuk baca lagi kebutuhan jumlah bahan pada soal di atas, lalu hitung pelan-pelan ya.`;
      onLoseLife(l4NumGuide);
      showToast('err', l4NumGuide, {
        title: 'AYO HITUNG BERSAMA',
        badge: '💡 Cek Angka Lagi',
      });
    }
  };

  // --- LEVEL 5 HANDLERS ---
  const activeL5Deck: Level5DeckItem[] =
    isSplitMode && level5Deck && level5Deck.length > 0
      ? level5Deck
      : LEVEL_5_ZONES.map((zone, specIndex) => ({
          specIndex,
          zone,
          alternatives: zone.alternatives,
          options: zone.options,
        }));
  const activeL5StationIdx = l5ActiveZone ?? 0;
  const activeL5Entry = isSplitMode
    ? activeL5Deck[activeL5StationIdx] || activeL5Deck[0]
    : activeL5Deck.find((d) => d.specIndex === activeL5StationIdx) || activeL5Deck[0];
  const stationZoneNpc = LEVEL_5_ZONES[activeL5StationIdx] || activeL5Entry.zone;
  const currentZone = activeL5Entry.zone;

  const handleWalkToZoneNpc = (idx: number) => {
    audioEngine.playFootstepAsphalt();
    const z = LEVEL_5_ZONES[idx];
    if (z) {
      const pos = l5Positions?.[idx] ?? z.position;
      const vx = -pos[0];
      const vz = 2 - pos[1];
      const len = Math.hypot(vx, vz) || 1;
      const nx = pos[0] + (vx / len) * 2.4;
      const nz = pos[1] + (vz / len) * 2.4;
      playerPosRef.current.x = nx;
      playerPosRef.current.z = nz;
      playerPosRef.current.rotY = Math.atan2(pos[0] - nx, pos[1] - nz);
      setL5DialogOpen(false);
      setL5ActiveZone(idx);
      setL5Phase('policy');
      showToast(
        'ok',
        `Mendekati ${z.npcName}. Ketuk penjaga atau tekan tombol [E] untuk membuka soal!`,
        { title: 'SIAP INTERAKSI', notifyFlash: false }
      );
    }
  };

  const handleOpenNearbyZoneQuestion = () => {
    const check = evaluateCitizenInteraction(nearbyZoneIdx, completedZones);
    if (check.status === 'ready' && check.citizenIndex !== null) {
      audioEngine.playClickWood();
      setL5ActiveZone(check.citizenIndex);
      setL5Phase('policy');
      setL5DialogOpen(true);
      const nextDur = getCalibratedLevelTimer(5, difficulty);
      onSetTimerSpec(nextDur, nextDur, getReadingGraceSeconds('item'));
    } else if (check.status === 'already_done' && check.citizenIndex !== null) {
      const npc = LEVEL_5_ZONES[check.citizenIndex];
      showToast('ok', `Pos ${npc?.npcName || 'penjaga'} sudah selesai! Jelajahi zona lain.`, {
        title: 'SELESAI',
        notifyFlash: false,
      });
    }
  };

  const handleL5ChoosePolicy = (code: 'A' | 'B' | 'C') => {
    if (!canClick()) return;
    const res = verifyLevel5Decision(activeL5Entry.specIndex, code, l5Coins, l5Energy);
    const chosenAlt = currentZone.alternatives.find((a) => a.code === code);
    const polEvalMeta = getLevel5PolicyEvaluationMeta(currentZone);
    onRecordEvaluation?.({
      challengeKey: `L5-pol-${currentZone.id}`,
      level: 5,
      bloomCode: 'C5',
      phaseLabel: 'Solusi Ekosistem',
      promptTitle: `${currentZone.zoneName} (${currentZone.npcName})`,
      questionText: `${currentZone.crisisTitle}: ${currentZone.crisisDescription}`,
      isCorrect: res.isBest,
      chosenAnswer: chosenAlt ? `Pilihan ${chosenAlt.code}: ${chosenAlt.text}` : `Pilihan ${code}`,
      correctAnswer: polEvalMeta.correctAnswer,
      explanation: polEvalMeta.explanation,
    });

    if (res.isBest) {
      audioEngine.playNatureHealed();
      setWrongOptionFlash(null);
      setL5Coins(res.nextCoins);
      setL5Energy(res.nextEnergy);
      showToast(
        'ok',
        `${res.feedback} Keputusanmu menunjukkan hati yang sungguh menyayangi alam, ${playerName}! Yuk lanjut hitung kebutuhannya.`,
        {
          title: 'BIJAKSANA SEKALI!',
          badge: '🌿 Ekosistem Pulih',
        }
      );
      setL5Phase('numeracy');
      const numDur = getCalibratedLevelTimer(5, difficulty, { isNumeracy: true });
      onSetTimerSpec(numDur, numDur, getReadingGraceSeconds('numeracy'));
    } else {
      audioEngine.playErrorBuzz();
      triggerWrongOptionFlash(`l5-alt-${code}`);
      const l5PolicyGuide = `Terima kasih sudah mencoba, ${playerName}! Mari kita pikirkan bersama: ${res.feedback} Yuk pilih solusi lain yang lebih ramah bagi makhluk hidup dan alam sekitar.`;
      onLoseLife(l5PolicyGuide);
      showToast('err', l5PolicyGuide, {
        title: 'YUK PIKIRKAN DAMPAKNYA',
        badge: '🌱 Pilih Lebih Bijak',
      });
    }
  };

  const handleL5NumeracyOption = (isCorrect: boolean, optIdx?: number) => {
    if (!canClick()) return;
    const numEvalMeta = getLevel5NumeracyEvaluationMeta(currentZone);
    const chosenLabel =
      typeof optIdx === 'number' && activeL5Entry.options[optIdx]
        ? activeL5Entry.options[optIdx].label
        : isCorrect
        ? numEvalMeta.correctAnswer
        : 'Pilihan lain';

    onRecordEvaluation?.({
      challengeKey: `L5-num-${currentZone.id}`,
      level: 5,
      bloomCode: 'C5',
      phaseLabel: 'Numerasi Ekosistem',
      promptTitle: `Hitungan: ${currentZone.zoneName}`,
      questionText: currentZone.numeracyQuestion,
      isCorrect,
      chosenAnswer: chosenLabel,
      correctAnswer: numEvalMeta.correctAnswer,
      explanation: numEvalMeta.explanation,
    });

    if (isCorrect) {
      audioEngine.playSuccessChord();
      setWrongOptionFlash(null);
      onScoreDelta(5, 3);
      onMarkZoneDone(activeL5StationIdx);

      const nextDoneCount = completedZones.includes(activeL5StationIdx)
        ? completedZones.length
        : completedZones.length + 1;

      setL5DialogOpen(false);
      setL5ActiveZone(null);
      setL5Phase('policy');

      if (nextDoneCount >= activeL5Deck.length) {
        showToast(
          'ok',
          `Alhamdulillah, luar biasa ${playerName}! Semua 5 ekosistem desa aman dan kembali lestari berkat kepedulianmu!`,
          {
            title: 'PENJAGA ALAM HEBAT!',
            badge: '+3 Poin C5 🌟',
          }
        );
        onLevelComplete(5);
      } else {
        showToast(
          'ok',
          `Hebat sekali, ${playerName}! Perhitunganmu tepat dan pos ${stationZoneNpc.npcName} kini terlindungi. Yuk temui penjaga berikutnya!`,
          { title: 'ALHAMDULILLAH, TEPAT!', badge: '+3 Poin C5 🌟' }
        );
      }
    } else {
      audioEngine.playErrorBuzz();
      if (typeof optIdx === 'number') triggerWrongOptionFlash(`l5-opt-${optIdx}`);
      const l5NumGuide = `Tidak mengapa kalau belum pas, ${playerName}! Coba cek kembali sisa koin atau energi pada soal, lalu hitung pelan-pelan ya.`;
      onLoseLife(l5NumGuide);
      showToast('err', l5NumGuide, {
        title: 'COBA HITUNG LAGI YA',
        badge: '💡 Pasti Bisa',
      });
    }
  };

  // --- LEVEL 6 HANDLERS (5 Menara Radar: Station-Indexed for 3D Green Beam Parity & Split Deck Anti-Cheat) ---
  const activeL6Deck: Level6DeckItem[] =
    isSplitMode && level6Deck && level6Deck.length > 0
      ? level6Deck
      : LEVEL_6_ISLANDS.map((island, specIndex) => ({
          specIndex,
          island,
          pillarChoices: island.pillarChoices,
          options: island.options,
        }));
  const activeL6StationIdx = l6ActiveStation ?? 0;
  const activeL6Entry = isSplitMode
    ? activeL6Deck[activeL6StationIdx] || activeL6Deck[0]
    : activeL6Deck.find((d) => d.specIndex === activeL6StationIdx) || activeL6Deck[0];
  const stationIslandSpec = LEVEL_6_ISLANDS[activeL6StationIdx] || activeL6Entry.island;
  const currentIsland = activeL6Entry.island;

  const handleWalkToIslandTower = (idx: number) => {
    audioEngine.playFootstepAsphalt();
    const isl = LEVEL_6_ISLANDS[idx];
    const pos = LEVEL_6_TOWER_POSITIONS[idx];
    if (isl && pos) {
      const vx = -pos[0];
      const vz = 2 - pos[1];
      const len = Math.hypot(vx, vz) || 1;
      const nx = pos[0] + (vx / len) * 2.4;
      const nz = pos[1] + (vz / len) * 2.4;
      playerPosRef.current.x = nx;
      playerPosRef.current.z = nz;
      playerPosRef.current.rotY = Math.atan2(pos[0] - nx, pos[1] - nz);
      setL6DialogOpen(false);
      setL6ActiveStation(idx);
      setL6Pillars(isSplitMode ? [0, 0, 0] : [1, 1, 1]);
      setL6Phase('pillars');
      showToast(
        'ok',
        `Mendekati Menara ${isl.islandName} (${isl.shortRegion}). Sentuh, klik menara, atau tekan [E] untuk membuka soal!`,
        { title: 'SIAP AKTIVASI', notifyFlash: false }
      );
    }
  };

  const handleOpenNearbyIslandQuestion = () => {
    const check = evaluateCitizenInteraction(nearbyIslandIdx, completedIslands);
    if (check.status === 'ready' && check.citizenIndex !== null) {
      openL6TowerModal(check.citizenIndex);
    } else if (check.status === 'already_done' && check.citizenIndex !== null) {
      const isl = LEVEL_6_ISLANDS[check.citizenIndex];
      showToast(
        'ok',
        `Menara ${isl?.islandName || 'Radar'} (${isl?.shortRegion || ''}) sudah hijau zamrud! Jelajahi menara lain.`,
        { title: 'AKTIF', notifyFlash: false }
      );
    }
  };

  const handleL6VerifyMasterplan = () => {
    if (!canClick()) return;
    if (isSplitMode && l6Pillars.some((slot) => slot === 0)) {
      audioEngine.playErrorBuzz();
      showToast(
        'err',
        `Yuk lengkapi dulu 1 pilihan terbaik untuk ketiga pilar (Aturan, Fisik, dan Edukasi) sebelum mengaktifkan menara ya, ${playerName}!`,
        {
          title: 'SATU LANGKAH LAGI',
          badge: '💡 Lengkapi Pilar',
          notifyFlash: false,
        }
      );
      return;
    }
    const valid = verifyLevel6Masterplan(activeL6Entry.specIndex, l6Pillars);
    const pilEvalMeta = getLevel6PillarEvaluationMeta(currentIsland);
    const chosenPillarsSummary = activeL6Entry.pillarChoices
      .map((pillar, idx) => {
        const chosenSlot = pillar.slots.find((s) => s.slotNum === l6Pillars[idx]);
        return `${pillar.pillarName}: ${chosenSlot?.text || '-'}`;
      })
      .join(' | ');

    onRecordEvaluation?.({
      challengeKey: `L6-pil-${currentIsland.id}`,
      level: 6,
      bloomCode: 'C6',
      phaseLabel: 'Masterplan 3 Pilar',
      promptTitle: `${currentIsland.islandName} (${currentIsland.shortRegion})`,
      questionText: currentIsland.emergencyFact,
      isCorrect: valid,
      chosenAnswer: chosenPillarsSummary,
      correctAnswer: pilEvalMeta.correctAnswer,
      explanation: pilEvalMeta.explanation,
    });

    if (valid) {
      audioEngine.playNatureHealed();
      setWrongOptionFlash(null);
      showToast(
        'ok',
        `MasyaAllah, ${playerName}! Ketiga pilarmu untuk ${currentIsland.islandName} (${currentIsland.shortRegion}) saling menguatkan dan ramah alam. Yuk selesaikan hitungan dampaknya!`,
        { title: 'RANCANGAN LUAR BIASA!', badge: '🛰️ Menara Siap' }
      );
      setL6Phase('numeracy');
      const numDur = getCalibratedLevelTimer(6, difficulty, { isNumeracy: true });
      onSetTimerSpec(numDur, numDur, getReadingGraceSeconds('numeracy'));
    } else {
      audioEngine.playErrorBuzz();
      const l6PillarGuide = `Semangat terus, ${playerName}! Agar Menara ${currentIsland.islandName} (${currentIsland.shortRegion}) aktif, yuk pastikan ketiga pilihan (Aturan, Perbaikan Fisik, dan Edukasi Warga) semuanya menjaga kelestarian alam ya.`;
      onLoseLife(l6PillarGuide);
      showToast('err', l6PillarGuide, {
        title: 'MARI SELARASKAN PILAR',
        badge: '🌱 Cek 3 Pilar',
      });
    }
  };

  const handleL6NumeracyOption = (isCorrect: boolean, optIdx?: number) => {
    if (!canClick()) return;
    const numEvalMeta = getLevel6NumeracyEvaluationMeta(currentIsland);
    const chosenLabel =
      typeof optIdx === 'number' && activeL6Entry.options[optIdx]
        ? activeL6Entry.options[optIdx].label
        : isCorrect
        ? numEvalMeta.correctAnswer
        : 'Pilihan lain';

    onRecordEvaluation?.({
      challengeKey: `L6-num-${currentIsland.id}`,
      level: 6,
      bloomCode: 'C6',
      phaseLabel: 'Numerasi Nusantara',
      promptTitle: `Hitungan: ${currentIsland.islandName}`,
      questionText: currentIsland.numeracyQuestion,
      isCorrect,
      chosenAnswer: chosenLabel,
      correctAnswer: numEvalMeta.correctAnswer,
      explanation: numEvalMeta.explanation,
    });

    if (isCorrect) {
      audioEngine.playSuccessChord();
      setWrongOptionFlash(null);
      onScoreDelta(6, 4);
      onMarkIslandDone(activeL6StationIdx);

      const nextCount = completedIslands.includes(activeL6StationIdx)
        ? completedIslands.length
        : completedIslands.length + 1;

      setL6DialogOpen(false);
      setL6ActiveStation(null);
      setL6Pillars(isSplitMode ? [0, 0, 0] : [1, 1, 1]);
      setL6Phase('pillars');

      if (nextCount >= activeL6Deck.length) {
        audioEngine.playTowerNetworkComplete();
        setL6CelebratingNetwork(true);
        showToast(
          'ok',
          `Alhamdulillah, ${playerName}! Kamu luar biasa — semua 5 Menara Radar kini hijau zamrud dan menyinari seluruh Nusantara!`,
          { title: 'NUSANTARA BERSINAR!', badge: '+4 Poin C6 🌟' }
        );
        if (l6CelebrationTimerRef.current) {
          window.clearTimeout(l6CelebrationTimerRef.current);
        }
        l6CelebrationTimerRef.current = window.setTimeout(() => {
          l6CelebrationTimerRef.current = null;
          setL6CelebratingNetwork(false);
          onLevelComplete(6);
        }, 2600);
      } else {
        showToast(
          'ok',
          `Hebat sekali, ${playerName}! Menara ${stationIslandSpec.islandName} (${stationIslandSpec.shortRegion}) kini hijau zamrud. Yuk aktifkan menara berikutnya!`,
          { title: 'MENARA BERSINAR!', badge: '+4 Poin C6 🌟' }
        );
      }
    } else {
      audioEngine.playErrorBuzz();
      if (typeof optIdx === 'number') triggerWrongOptionFlash(`l6-opt-${optIdx}`);
      const l6NumGuide = `Jangan menyerah ya, ${playerName}! Coba baca ulang angka dampak lingkungan pada berita dan soal di atas, kamu pasti bisa menemukannya.`;
      onLoseLife(l6NumGuide);
      showToast('err', l6NumGuide, {
        title: 'YUK CEK HITUNGANNYA',
        badge: '💡 Semangat Terus',
      });
    }
  };

  // Helper badge untuk status "Tulisan Muncul Dulu -> Suara Narator Menyusul"
  const renderVoiceStatusBadge = (textToSpeak: string) => {
    const isMuted = audioEngine.getPersona() === 'muted';
    return (
      <div className="flex flex-wrap items-center justify-between gap-1.5 md:gap-2 mb-1.5 md:mb-2.5 bg-amber-950/10 border border-amber-800/25 rounded-xl px-2 py-1 md:px-3 md:py-1.5">
        <span
          data-testid="narration-voice-status"
          className="text-[10px] md:text-[11px] font-extrabold text-emerald-950 flex items-center gap-1 md:gap-1.5"
        >
          {isMuted ? (
            <>🔇 <span className="md:hidden">Mode Hening</span><span className="hidden md:inline">Mode Hening: Tulisan Narasi Ditampilkan</span></>
          ) : voiceStatus === 'waiting' ? (
            <>📝 <span className="md:hidden">Tulisan Dulu · Suara 0,1 dtk</span><span className="hidden md:inline">Tulisan Muncul 0,1 Detik · ⏳ Suara Narator Menyusul...</span></>
          ) : voiceStatus === 'speaking' ? (
            <>🔊 <span className="md:hidden">Narator Membaca...</span><span className="hidden md:inline">Suara Narator Sedang Membaca Narasi...</span></>
          ) : (
            <>✅ <span className="md:hidden">Narator Siap</span><span className="hidden md:inline">Tulisan Narasi Tampil · Suara Narator Siap</span></>
          )}
        </span>
        {!isMuted && (
          <button
            type="button"
            onClick={() => {
              audioEngine.unlockAudio();
              audioEngine.speak(textToSpeak, 100);
            }}
            className="text-[10px] md:text-[11px] font-extrabold text-amber-950 bg-amber-400/50 hover:bg-amber-400/80 border border-amber-700/40 px-2 py-0.5 md:px-2.5 rounded-lg cursor-pointer"
          >
            🔊 <span className="md:hidden">Ulang</span><span className="hidden md:inline">Baca Ulang Narasi</span>
          </button>
        )}
      </div>
    );
  };

  // Mobile-only alternating subtitle renderer ("tulisan bergantian" + optional expand)
  const renderMobileAlternatingSubtitle = (fullText: string, darkTheme = false) => {
    const chunks = splitSubtitleChunks(fullText);
    const totalChunks = chunks.length;
    const safeIdx = totalChunks > 0 ? ((subtitleChunkIdx % totalChunks) + totalChunks) % totalChunks : 0;
    const currentChunk = chunks[safeIdx] || fullText;

    return (
      <div className="md:hidden">
        {mobileTextExpanded ? (
          <p
            className={`text-xs font-semibold leading-snug max-h-28 overflow-y-auto pr-1 ${
              darkTheme ? 'text-emerald-100' : 'text-stone-900'
            }`}
          >
            {fullText}
          </p>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p
              className={`text-xs font-bold leading-snug min-h-[2.2rem] flex-1 ${
                darkTheme ? 'text-emerald-100' : 'text-stone-900'
              }`}
            >
              {currentChunk}
            </p>
            {totalChunks > 1 && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  aria-label="Kalimat Sebelumnya"
                  onClick={() => setSubtitleChunkIdx((p) => (p - 1 + totalChunks) % totalChunks)}
                  className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center border cursor-pointer ${
                    darkTheme
                      ? 'bg-slate-900 border-emerald-500/50 text-emerald-300'
                      : 'bg-amber-900/15 border-amber-800/30 text-amber-950'
                  }`}
                >
                  ‹
                </button>
                <span
                  className={`text-[10px] font-mono-num font-extrabold min-w-[26px] text-center ${
                    darkTheme ? 'text-amber-300' : 'text-emerald-950'
                  }`}
                >
                  {safeIdx + 1}/{totalChunks}
                </span>
                <button
                  type="button"
                  aria-label="Kalimat Berikutnya"
                  onClick={() => setSubtitleChunkIdx((p) => (p + 1) % totalChunks)}
                  className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center border cursor-pointer ${
                    darkTheme
                      ? 'bg-slate-900 border-emerald-500/50 text-emerald-300'
                      : 'bg-amber-900/15 border-amber-800/30 text-amber-950'
                  }`}
                >
                  ›
                </button>
              </div>
            )}
          </div>
        )}
        {totalChunks > 1 && (
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {chunks.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={`Kalimat ${idx + 1}`}
                  onClick={() => {
                    setMobileTextExpanded(false);
                    setSubtitleChunkIdx(idx);
                  }}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    !mobileTextExpanded && idx === safeIdx
                      ? darkTheme
                        ? 'w-4 bg-amber-400'
                        : 'w-4 bg-emerald-700'
                      : darkTheme
                      ? 'w-1.5 bg-slate-700'
                      : 'w-1.5 bg-amber-900/30'
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setMobileTextExpanded((v) => !v)}
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border cursor-pointer ${
                darkTheme
                  ? 'bg-slate-900 border-slate-700 text-amber-300'
                  : 'bg-amber-900/10 border-amber-800/25 text-amber-950'
              }`}
            >
              {mobileTextExpanded ? '💬 Mode Bergantian' : '📖 Baca Penuh'}
            </button>
          </div>
        )}
      </div>
    );
  };

  // 1. CINEMATIC PROLOGUE OVERLAY (Section X.1 — Muncul lengkap 3 Babak setelah klik Mulai Misi Pelestarian Alam)
  if (prologueActive) {
    const babak = PROLOGUE_BABAK[prologueStage - 1] || PROLOGUE_BABAK[0];
    const prologueText = babak.getText(playerName);
    return (
      <div
        data-testid="cinematic-prologue-overlay"
        className="relative z-20 flex-1 flex flex-col justify-end items-center p-2 md:p-5 pointer-events-none"
      >
        <div className="parchment-box max-w-3xl w-full rounded-2xl md:rounded-3xl p-2.5 md:p-6 pointer-events-auto">
          <div className="flex flex-wrap items-center justify-between gap-1.5 md:gap-2 border-b border-amber-800/30 pb-1.5 md:pb-2 mb-1.5 md:mb-2">
            <div className="min-w-0">
              <span className="block text-[10.5px] md:text-xs font-extrabold uppercase tracking-wider text-amber-900">
                🎬 <span className="hidden md:inline">SINEMATIK PROLOG — </span>{babak.title} ({prologueStage}/3)
              </span>
              <span
                data-testid="prologue-scene-direction"
                className="hidden md:block text-[11px] font-bold text-emerald-900 mt-0.5"
              >
                {prologueStage === 1
                  ? '🏔️ '
                  : prologueStage === 2
                  ? '⚡ '
                  : '🌱 '}
                {babak.sceneDirection}
              </span>
            </div>
            <button
              type="button"
              data-testid="btn-prologue-skip"
              onClick={() => {
                audioEngine.playClickWood();
                onSkipPrologue();
              }}
              className="px-2 py-0.5 md:px-3 md:py-1 rounded-xl bg-amber-900/15 hover:bg-amber-900/25 text-amber-950 text-[10.5px] md:text-xs font-extrabold cursor-pointer shrink-0"
            >
              Lewati <span className="hidden md:inline">ke Roadmap </span>⏭️
            </button>
          </div>

          {renderVoiceStatusBadge(prologueText)}

          {renderMobileAlternatingSubtitle(typedText || prologueText)}

          <p
            data-testid="prologue-narration-text"
            className="hidden md:block text-sm md:text-base font-semibold text-stone-900 leading-relaxed min-h-[3.8rem]"
          >
            &ldquo;{typedText || prologueText}&rdquo;
          </p>

          <div className="mt-2 md:mt-3.5 flex justify-end">
            <button
              type="button"
              data-testid="btn-prologue-next"
              onClick={() => {
                audioEngine.playClickWood();
                onAdvancePrologue();
              }}
              className="btn-clay-emerald px-3.5 py-1.5 md:px-5 md:py-2 rounded-xl text-xs md:text-sm font-extrabold text-white cursor-pointer"
            >
              {prologueStage < 3 ? 'Babak Selanjutnya ➔' : '🗺️ Buka Roadmap 6 Level ➔'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 1B. ROADMAP 6 LEVEL NUSANTARA — PETA WILAYAH OPERASI 6 LOKASI DARI ATAS (TANPA NARASI)
  if (roadmapActive) {
    return (
      <TacticalRoadmapMap
        playerName={playerName}
        avatarGender="male"
        currentLevel={currentLevel}
        completedLevels={completedLevels}
        onSelectLevel={(lv) => onContinueFromRoadmap?.(lv)}
      />
    );
  }

  // 2. CHILD-FRIENDLY REMEDIAL PANEL (Section IV.3 — Never says "Game Over" or "Kamu Kalah")
  if (remedialActive) {
    const empathyMsg = getRemedialEmpathyText(playerName);
    return (
      <div className="relative z-30 flex-1 flex items-center justify-center p-3 md:p-4 pointer-events-auto overflow-y-auto">
        <div
          role="dialog"
          aria-labelledby="remedial-heading"
          className="parchment-box max-w-3xl w-full rounded-3xl p-4 md:p-7 text-center max-h-[90vh] overflow-y-auto shadow-2xl"
        >
          <div className="text-3xl md:text-4xl mb-1.5">🌱🤲</div>
          <h2 id="remedial-heading" className="text-lg md:text-2xl font-extrabold text-emerald-950">
            Mari Berefleksi Sejenak, Penjaga Bumi Cilik
          </h2>
          <p className="mt-2 text-xs md:text-base font-medium text-stone-800 leading-relaxed">
            &ldquo;{empathyMsg}&rdquo;
          </p>

          <EvaluationReviewPanel
            variant="remedial"
            records={evaluationLog}
            playerName={playerName}
            activeLevel={currentLevel}
            lastMistakeNote={lastMistakeNote}
          />

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                audioEngine.unlockAudio();
                audioEngine.speak(empathyMsg, 80);
              }}
              className="btn-clay-amber px-4 py-2.5 rounded-2xl text-xs md:text-sm font-extrabold text-slate-950 cursor-pointer"
            >
              🔊 Dengarkan Nasihat Guru
            </button>
            <button
              type="button"
              onClick={() => {
                audioEngine.playSuccessChord();
                onRetryRemedialLevel();
              }}
              className="btn-clay-emerald px-6 py-3 rounded-2xl text-sm md:text-base font-extrabold text-white cursor-pointer"
            >
              🔄 Coba Ulang Misi Ini (Pulihkan 3 Daun Toleransi)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. LEVEL REFLECTION & ACTION PLAN MODAL (End of each level before advancing)
  if (reflectionModalLevel) {
    const rMeta = LEVEL_METADATA[reflectionModalLevel - 1] || LEVEL_METADATA[0];
    return (
      <div className="relative z-30 flex-1 flex items-center justify-center p-4 pointer-events-auto">
        <div
          role="dialog"
          aria-labelledby="reflection-title"
          className="bg-slate-950/95 border-2 border-emerald-500 rounded-2xl max-w-2xl w-full p-6 md:p-8 shadow-lg text-white"
        >
          <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
            ✨ MISI LEVEL {rMeta.level} ({rMeta.bloomCode}) TUNTAS!
          </div>
          <h2 id="reflection-title" className="text-2xl font-extrabold mt-1">
            Refleksi Diri &amp; Rencana Aksi Nyata
          </h2>

          <div className="mt-4 bg-slate-900 border border-amber-500/40 rounded-2xl p-4">
            <div className="text-xs font-bold text-amber-300 uppercase mb-1">
              🪞 Refleksi Diri Anak Saleh:
            </div>
            <p className="text-sm md:text-base italic text-slate-100">&ldquo;{rMeta.reflection}&rdquo;</p>
          </div>

          <div className="mt-4 bg-slate-900 border border-emerald-500/40 rounded-2xl p-4">
            <div className="text-xs font-bold text-emerald-300 uppercase mb-2">
              🌱 Rencana Aksi Nyata:
            </div>
            <ul className="space-y-1.5 text-xs md:text-sm text-slate-200">
              {rMeta.actionPlans.map((plan, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>{plan}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            {renderVoiceStatusBadge(
              `Alhamdulillah, Misi Level ${rMeta.level} ${rMeta.name} tuntas! ${rMeta.reflection}`
            )}
            <button
              type="button"
              onClick={() => {
                audioEngine.playClickWood();
                onCloseReflectionAndAdvance();
              }}
              className="btn-clay-emerald px-6 py-3 rounded-2xl text-sm font-extrabold text-white cursor-pointer"
            >
              Lanjutkan Transmisi Jurnal ➔
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. INTER-LEVEL JOURNAL TRANSMISSION (Section X.2 Box — Tulisan Muncul Dulu, Suara Menyusul)
  if (journalModalLevel && JOURNAL_TRANSMISSIONS[journalModalLevel]) {
    const jSpec = JOURNAL_TRANSMISSIONS[journalModalLevel];
    const journalText = jSpec.getText(playerName);
    return (
      <div className="relative z-30 flex-1 flex items-end md:items-center justify-center p-2.5 md:p-4 pointer-events-auto">
        <div
          role="dialog"
          aria-labelledby="journal-header"
          className="parchment-box max-w-2xl w-full rounded-2xl md:rounded-3xl p-3.5 md:p-8"
        >
          <div
            id="journal-header"
            className="text-[11px] md:text-sm font-extrabold text-emerald-900 tracking-wider font-mono-num border-b border-amber-800/30 pb-1.5 md:pb-2 mb-1.5 md:mb-2.5"
          >
            📡 {jSpec.header}
          </div>

          {renderVoiceStatusBadge(journalText)}

          {renderMobileAlternatingSubtitle(typedText || journalText)}

          <p className="hidden md:block text-base md:text-lg font-semibold text-stone-900 leading-relaxed min-h-[4.5rem]">
            {typedText || journalText}
          </p>
          <div className="mt-3 md:mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => {
                audioEngine.playClickWood();
                onCloseJournalModal();
              }}
              className="btn-clay-emerald px-4 py-2 md:px-6 md:py-3 rounded-xl md:rounded-2xl text-xs md:text-sm font-extrabold text-white cursor-pointer"
            >
              {journalModalLevel === 7
                ? '📜 Buka Piagam Ikrar Autentik (Halaman 4)'
                : `⚔️ Masuk ke Level ${journalModalLevel}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const diffCfg = getDifficultyConfig(difficulty);

  // 4B. ALUR 3 TAHAP TIAP LEVEL (LEVEL 1, 2, 3, 4, 5, DAN 6):
  // 1. Tampilkan Lokasi dan Lingkungan Terlebih Dahulu, Kamera dari Atas Terus Mendekat (0,2 Menit / 12 Detik)
  // 2. Disusul Kemudian Muncul Narasi yang Sekarang Ada di Tiap Level (0,5 Menit / 30 Detik)
  // 3. Lalu Bermain Game Seperti Biasa
  if (level1IntroPhase !== 'core_game') {
    const fullPrologueText = levelMeta.getOpeningDialog(playerName);
    const lookingElapsedSec = Math.max(0, Math.min(12, 12 - lookingSecondsLeft));
    const lookingPct = Math.min(100, Math.round((lookingElapsedSec / 12) * 100));
    const elapsedSec = Math.max(0, Math.min(30, 30 - narrationSecondsLeft));
    const durationPct = Math.min(100, Math.round((elapsedSec / 30) * 100));

    const lookingDescriptions: Record<number, string> = {
      1: 'Menampilkan lokasi & lingkungan Halaman Depan Rumah Asri Nusantara yang dipenuhi sampah berserakan beserta 3 tong pilah (Organik, Anorganik, B3)...',
      2: 'Menampilkan lokasi & lingkungan Paviliun Ruang Baca & Taman Literasi 3R beserta rak buku, meja balok kata, dan 3 pilar konsep 3R...',
      3: 'Menampilkan lokasi & lingkungan Gudang Logistik beserta rel Mesin Capit 3R dan 3 corong pilah (Reduce, Reuse, Recycle)...',
      4: 'Menampilkan lokasi & lingkungan Pendopo Alun-Alun Kampung bersama 5 pos warga yang sedang berkarya mengolah barang bekas...',
      5: 'Menampilkan lokasi & lingkungan 5 Ekosistem Desa Nusantara (Lereng Bukit, Pinggir Sungai, Kebun & Sawah, Pantai Bakau, dan Taman Kolam)...',
      6: 'Menampilkan Peta Indonesia & 5 Titik Radar Nusantara: Wonogiri (Jateng), Siak–Pelalawan & Tanjab Timur (Riau–Jambi), Kumai–Sungai Wain (Kalimantan), Pemuteran–Nusa Penida–Gili Matra–Komodo (Bali–NTB–NTT), serta Teluk Youtefa–Teluk Bintuni (Papua)...',
    };
    const lookingDescription =
      lookingDescriptions[currentLevel] || lookingDescriptions[1];

    const isLevel6OpeningMap = currentLevel === 6;
    const l6CameraBeatLabel =
      lookingSecondsLeft >= 10
        ? '🛸 Kamera Melayang di Atas Panorama Peta Nusantara'
        : lookingSecondsLeft >= 7
        ? '🌋 Menukik Tajam · Tanah Retak Kelabu & Gemuruh Bumi'
        : '🔴 Mengorbit ke 5 Titik Merah Bahaya Satu Per Satu';

    return (
      <div
        key={`pre-level-intro-${currentLevel}-${level1IntroPhase}`}
        data-testid="level1-house-intro"
        className="relative z-20 flex-1 min-h-0 flex flex-col justify-between items-center p-1.5 md:p-3.5 pointer-events-none"
      >
        {/* Top Location & Aerial Camera Indicator (Compact 1-line pill on HP so 3D center stays open) */}
        <div className="relative z-10 shrink-0 bg-slate-950/90 border border-amber-400/80 md:border-2 rounded-xl md:rounded-2xl px-2.5 py-1 md:px-4 md:py-1.5 shadow-xl flex flex-wrap items-center justify-center gap-1.5 md:gap-2 text-center pointer-events-auto max-w-[96vw]">
          <span className="text-[10.5px] md:text-sm font-extrabold text-amber-300 uppercase tracking-wide truncate max-w-[200px] md:max-w-none">
            📍 {levelMeta.domain}
          </span>
          <span className="text-slate-500">·</span>
          <span className="text-[10px] md:text-xs font-bold text-emerald-300">
            {level1IntroPhase === 'looking'
              ? isLevel6OpeningMap
                ? l6CameraBeatLabel
                : '📷 Lihat Lokasi'
              : `Lv.${currentLevel} (${levelMeta.bloomCode})`}
          </span>
          <span className="hidden md:inline text-slate-500">·</span>
          <span className="hidden md:inline text-[11px] font-semibold text-slate-200">
            {level1IntroPhase === 'looking'
              ? `Level ${currentLevel} (${levelMeta.bloomCode}): ${levelMeta.name}`
              : `📷 ${levelMeta.cameraView}`}
          </span>
        </div>

        {/* Bottom Area: Step 1 ('looking': 0,2 Menit / 12 Detik) -> Step 2 ('narration': 0,5 Menit / 30 Detik) */}
        {level1IntroPhase === 'looking' ? (
          <div
            data-testid="level1-looking-caption"
            className="relative z-10 max-w-3xl w-full bg-slate-950/90 border-2 border-emerald-400/80 rounded-2xl p-2 md:p-4 text-slate-100 shadow-lg pointer-events-auto mb-0.5 md:mb-1"
          >
            <div className="flex flex-wrap items-center justify-between gap-1.5 md:gap-2 pb-1.5 md:pb-2 mb-1.5 md:mb-2 border-b border-slate-800">
              <div className="flex items-center gap-1.5 md:gap-2">
                <span className="text-[10px] md:text-xs font-extrabold uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-2 py-0.5 md:px-2.5 rounded-lg border border-emerald-400/40">
                  {isLevel6OpeningMap ? '🗺️' : '🎥'} TAHAP 1/3 <span className="hidden md:inline">— LOKASI &amp; LINGKUNGAN</span> LV.{currentLevel}
                </span>
                <span className="hidden md:inline text-[11px] font-bold text-amber-300">
                  {isLevel6OpeningMap
                    ? l6CameraBeatLabel
                    : 'Kamera dari Atas Terus Mendekat'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 md:gap-2">
                <span
                  data-testid="looking-timer-badge"
                  className="text-[10px] md:text-[11px] font-mono-num font-extrabold text-slate-950 bg-amber-300 px-1.5 md:px-2.5 py-0.5 rounded-lg"
                >
                  ⏱️ <span className="hidden md:inline">Durasi 0,2 Menit: </span>{lookingSecondsLeft}d<span className="hidden md:inline"> / 12d</span>
                </span>
                <button
                  type="button"
                  data-testid="btn-advance-to-narration"
                  onClick={() => {
                    audioEngine.unlockAudio();
                    audioEngine.playClickWood();
                    onAdvanceLookingToNarration?.();
                  }}
                  className="btn-clay-amber px-2 py-0.5 md:px-3 md:py-1 rounded-xl text-[10px] md:text-xs font-extrabold text-slate-950 cursor-pointer"
                >
                  🗣️ <span className="hidden md:inline">Lanjut ke </span>Narasi ➔
                </button>
                <button
                  type="button"
                  data-testid="btn-skip-l1-intro"
                  onClick={() => {
                    audioEngine.playClickWood();
                    audioEngine.stopSpeech();
                    onCompleteLevel1Intro?.();
                  }}
                  className="btn-clay-emerald px-2 py-0.5 md:px-3 md:py-1 rounded-xl text-[10px] md:text-xs font-extrabold text-white cursor-pointer"
                >
                  ⚔️ Main ➔
                </button>
              </div>
            </div>

            {/* Progress Bar Kamera dari Atas Terus Mendekat (0,2 Menit / 12 Detik) */}
            <div className="w-full h-1.5 md:h-2 bg-slate-800 rounded-full overflow-hidden mb-1.5 md:mb-2 border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-300"
                style={{ width: `${lookingPct}%` }}
              />
            </div>

            {renderMobileAlternatingSubtitle(lookingDescription, true)}

            <div className="hidden md:flex items-center justify-between gap-3 text-xs md:text-sm font-semibold text-emerald-100">
              <div className="flex items-center gap-2">
                <span className="text-base">👀</span>
                <span>{lookingDescription}</span>
              </div>
              <span className="text-[11px] font-extrabold text-amber-300 uppercase shrink-0">
                Disusul Narasi Level {currentLevel}
              </span>
            </div>
          </div>
        ) : (
          <div
            data-testid="level1-bottom-narration"
            className={`relative z-10 parchment-box max-w-3xl w-full rounded-2xl md:rounded-3xl pointer-events-auto shadow-2xl mb-0.5 md:mb-1 ${
              isLevel6OpeningMap ? 'p-2 md:p-4' : 'p-2.5 md:p-6'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-1.5 md:gap-2 border-b border-amber-800/30 pb-1.5 md:pb-2 mb-1.5 md:mb-2">
              <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
                <span className="text-[10px] md:text-xs font-extrabold uppercase tracking-wider text-emerald-950 bg-emerald-500/20 px-2 py-0.5 md:px-2.5 rounded-lg border border-emerald-700/30 truncate">
                  🗣️ TAHAP 2/3: <span className="hidden md:inline">NARASI LEVEL {currentLevel} — </span>{levelMeta.npcName}
                </span>
                <span className="hidden md:inline text-[11px] font-bold text-amber-900">
                  📍 {levelMeta.domain}
                </span>
              </div>

              <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                <span
                  data-testid="narration-timer-badge"
                  className="text-[10px] md:text-[11px] font-mono-num font-extrabold text-emerald-950 bg-amber-300/80 px-1.5 md:px-2.5 py-0.5 rounded-lg border border-amber-700/40"
                >
                  ⏱️ <span className="hidden md:inline">Durasi 0,5 Menit: </span>{narrationSecondsLeft}d<span className="hidden md:inline"> / 30d</span>
                </span>
                <button
                  type="button"
                  data-testid="btn-skip-l1-intro"
                  onClick={() => {
                    audioEngine.playClickWood();
                    audioEngine.stopSpeech();
                    onCompleteLevel1Intro?.();
                  }}
                  className="btn-clay-emerald px-2.5 py-0.5 md:px-3 md:py-1 rounded-xl text-[10.5px] md:text-xs font-extrabold text-white cursor-pointer"
                >
                  Mulai <span className="hidden md:inline">Level {currentLevel} </span>➔
                </button>
              </div>
            </div>

            {/* Progress Bar Durasi Narasi 0,5 Menit (30 Detik) */}
            <div className="w-full h-1.5 md:h-2 bg-amber-950/20 rounded-full overflow-hidden mb-1.5 md:mb-2 border border-amber-900/30">
              <div
                className="h-full bg-emerald-600 transition-all duration-300"
                style={{ width: `${durationPct}%` }}
              />
            </div>

            {renderVoiceStatusBadge(fullPrologueText)}

            {renderMobileAlternatingSubtitle(typedText || fullPrologueText)}

            <p
              data-testid="level-narration-text"
              className="hidden md:block text-sm md:text-base font-semibold text-stone-900 leading-relaxed min-h-[3.5rem]"
            >
              &ldquo;{typedText || fullPrologueText}&rdquo;
            </p>

            <div className="hidden md:flex mt-3 pt-2 border-t border-amber-800/20 items-center justify-between gap-3 text-[11px] font-bold text-amber-950">
              <span>
                ⏳ Narasi sebelum masuk Level {currentLevel} (Durasi 0,5 Menit · sisa {narrationSecondsLeft} detik)...
              </span>
              <span className="text-emerald-900 font-extrabold uppercase">
                Tahap 3/3: Masuk Permainan Level {currentLevel}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Animated High-Contrast Feedback Banner Helper (Loving Educator Voice — Encouraging & Guiding, Never Blaming)
  const renderFeedbackBanner = (extraClassName = '') => {
    if (!feedbackToast) return null;
    const isOk = feedbackToast.type === 'ok';
    return (
      <div
        key={feedbackToast.id}
        role="status"
        data-testid={isSplitMode ? `feedback-banner-p${playerSlot}` : 'feedback-banner'}
        className={`rounded-2xl px-3 py-2 md:px-4 md:py-2.5 border-2 flex items-center justify-between gap-2.5 shadow-xl animate-[feedbackPop_280ms_cubic-bezier(0.16,1,0.3,1)] ${
          isOk
            ? 'bg-emerald-950/95 border-emerald-400 text-emerald-100 shadow-[0_0_24px_rgba(16,185,129,0.42)]'
            : 'bg-amber-950/95 border-amber-400 text-amber-100 shadow-[0_0_22px_rgba(251,191,36,0.36)]'
        } ${extraClassName}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] md:text-[11px] font-black uppercase tracking-wider ${
              isOk ? 'bg-emerald-400 text-slate-950' : 'bg-amber-300 text-slate-950'
            }`}
          >
            {isOk ? '🌟' : '💡'} {feedbackToast.title}
          </span>
          <span className="text-[11px] md:text-xs font-bold leading-snug break-words">
            {feedbackToast.msg}
          </span>
        </div>
        {feedbackToast.badge && (
          <span
            className={`shrink-0 font-mono-num text-[10px] md:text-[11px] font-black px-2 py-0.5 rounded-lg border whitespace-nowrap ${
              isOk
                ? 'bg-amber-400/20 border-amber-300/70 text-amber-200'
                : 'bg-amber-900/80 border-amber-300/60 text-amber-100'
            }`}
          >
            {feedbackToast.badge}
          </span>
        )}
      </div>
    );
  };

  const panelFlashClasses = panelFeedbackFlash
    ? panelFeedbackFlash.type === 'ok'
      ? 'ring-4 ring-emerald-400/80 shadow-[0_0_26px_rgba(16,185,129,0.45)]'
      : 'ring-4 ring-amber-400/80 shadow-[0_0_24px_rgba(251,191,36,0.38)]'
    : '';

  // 4C. MEKANIK GAME INTI LEVEL 1: FOKUS DI MEKANIK DRAG & DROP SAMPAH DI TENGAH (CENTER BERIMBANG)
  if (currentLevel === 1) {
    const currentL1Item = activeL1Entry.item;
    const slotAttr = `${playerSlot}`;

    const handlePointerDownTrash = (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const activePointerId = e.pointerId;
      e.stopPropagation();
      try {
        e.currentTarget.setPointerCapture(activePointerId);
      } catch {
        // Fallback to window listeners filtered by pointerId
      }
      setL1IsDragging(true);
      setL1PointerPos({ x: e.clientX, y: e.clientY });

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== activePointerId) return;
        setL1PointerPos({ x: ev.clientX, y: ev.clientY });
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const binEl = el?.closest(`[data-bin-slot="${slotAttr}"]`) as HTMLElement | null;
        const binLabel = binEl?.getAttribute('data-bin-label') as
          | 'ORGANIK'
          | 'ANORGANIK'
          | 'B3'
          | null;
        setL1DragOverBin(binLabel || null);
      };

      const cleanupDrag = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        setL1IsDragging(false);
        setL1PointerPos(null);
        setL1DragOverBin(null);
      };

      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== activePointerId) return;
        cleanupDrag();

        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const binEl = el?.closest(`[data-bin-slot="${slotAttr}"]`) as HTMLElement | null;
        const dropDir = binEl?.getAttribute('data-bin-dir') as
          | 'KIRI'
          | 'KANAN'
          | 'ATAS'
          | null;
        if (dropDir) {
          handleLevel1Sort(dropDir);
        }
      };

      const onCancel = (ev: PointerEvent) => {
        if (ev.pointerId !== activePointerId) return;
        cleanupDrag();
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
    };

    const binsConfig: {
      label: 'ORGANIK' | 'ANORGANIK' | 'B3';
      dir: 'KIRI' | 'KANAN' | 'ATAS';
      testId: string;
      borderClass: string;
      activeRingClass: string;
    }[] = [
      {
        label: 'ORGANIK',
        dir: 'KIRI',
        testId: isSplitMode ? `bin-organik-p${playerSlot}` : 'bin-organik',
        borderClass: 'border-emerald-500/80 bg-emerald-950/60 hover:bg-emerald-900/70',
        activeRingClass: 'ring-4 ring-emerald-400 bg-emerald-900/85 scale-105',
      },
      {
        label: 'ANORGANIK',
        dir: 'KANAN',
        testId: isSplitMode ? `bin-anorganik-p${playerSlot}` : 'bin-anorganik',
        borderClass: 'border-sky-500/80 bg-sky-950/60 hover:bg-sky-900/70',
        activeRingClass: 'ring-4 ring-sky-400 bg-sky-900/85 scale-105',
      },
      {
        label: 'B3',
        dir: 'ATAS',
        testId: isSplitMode ? `bin-b3-p${playerSlot}` : 'bin-b3',
        borderClass: 'border-rose-500/80 bg-rose-950/60 hover:bg-rose-900/70',
        activeRingClass: 'ring-4 ring-rose-400 bg-rose-900/85 scale-105',
      },
    ];

    return (
      <div
        data-testid={isSplitMode ? `level1-core-studio-p${playerSlot}` : 'level1-core-studio'}
        className={`relative z-20 flex-1 w-full h-full flex flex-col ${
          isSplitMode
            ? 'items-center justify-end p-2 pb-24 lg:pb-2 pointer-events-none bg-transparent'
            : 'items-center justify-center p-2.5 md:p-5 pb-24 lg:pb-6 pointer-events-auto bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/85 via-slate-950 to-slate-950'
        }`}
      >
        <div
          data-testid={isSplitMode ? `arena-deck-p${playerSlot}` : 'arena-deck-1p'}
          className={`w-full ${
            isSplitMode
              ? `pointer-events-auto max-w-[520px] max-h-[54vh] overflow-y-auto pr-0.5 space-y-1.5 ${
                  playerSlot === 1 ? 'lg:ml-[156px] lg:mr-1' : 'lg:mr-[156px] lg:ml-1'
                }`
              : 'mx-auto my-auto max-w-3xl space-y-2.5'
          }`}
        >
          {/* Feedback Toast Centered */}
          {renderFeedbackBanner('justify-center sm:justify-between')}

          {/* =================================================================
              MEKANIK INTI LEVEL 1: DETEKTIF SAMPAH (DRAG & DROP)
             ================================================================= */}
          {currentLevel === 1 && (
            <section
              aria-label="Arena Inti Level 1 Detektif Sampah Drag and Drop"
              className={`bg-slate-900/95 border-2 border-emerald-500/80 rounded-2xl shadow-lg transition-all duration-200 ${
                isSplitMode ? 'p-2.5' : 'p-3.5 md:p-5'
              } ${panelFlashClasses}`}
            >
              {/* Header Bar Seimbang di Tengah */}
              <div
                className={`flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-800 ${
                  isSplitMode ? 'pb-1.5 mb-2' : 'pb-2.5 mb-3'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isSplitMode ? (
                    <span
                      className={`text-[11px] font-extrabold font-mono-num px-2 py-0.5 rounded-xl border uppercase ${
                        playerSlot === 1
                          ? 'bg-emerald-950 border-emerald-400 text-emerald-300'
                          : 'bg-sky-950 border-sky-400 text-sky-300'
                      }`}
                    >
                      {playerSlot === 1
                        ? `🎯 P1 (KIRI): ${playerName}`
                        : `🎯 P2 (KANAN): ${playerName}`}
                    </span>
                  ) : (
                    <span className="text-xs font-extrabold font-mono-num px-3 py-0.5 rounded-xl bg-emerald-950 border border-emerald-400/80 text-emerald-300 uppercase">
                      🏡 Level 1 (C1): Detektif Sampah
                    </span>
                  )}
                  <span className="text-xs text-slate-300 font-bold hidden sm:inline">
                    Pilah Sampah Halaman Rumah
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-extrabold uppercase text-amber-300 font-mono-num bg-amber-950/70 border border-amber-500/40 px-2 py-0.5 rounded-lg">
                    Gelombang {currentL1Item.wave} · #{l1Index + 1}/{totalL1Items}
                  </span>
                  <span className="text-[11px] font-mono-num font-extrabold bg-slate-950 border border-emerald-500/50 px-2 py-0.5 rounded-lg text-emerald-300">
                    {l1Index}/{totalL1Items}
                  </span>
                </div>
              </div>

              {/* BAGIAN ATAS (CENTER): BENDA SAMPAH REALISTIS UNTUK DISERET */}
              <div
                data-testid={
                  isSplitMode ? `level1-trash-source-p${playerSlot}` : 'level1-trash-source'
                }
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', String(currentL1Item.id));
                  e.dataTransfer.effectAllowed = 'move';
                  setL1IsDragging(true);
                }}
                onDragEnd={() => {
                  setL1IsDragging(false);
                  setL1DragOverBin(null);
                }}
                onPointerDown={handlePointerDownTrash}
                className={`max-w-xl mx-auto rounded-2xl border-2 flex flex-col sm:flex-row items-center justify-center text-center sm:text-left cursor-grab active:cursor-grabbing select-none transition-all ${
                  isSplitMode ? 'p-2 gap-2.5' : 'p-3 md:p-4 gap-3.5'
                } ${
                  l1IsDragging
                    ? 'border-amber-400 bg-slate-950 ring-2 ring-amber-300/70 scale-[0.98]'
                    : 'border-amber-400/90 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/70 hover:border-amber-300 shadow-xl'
                }`}
                style={{ touchAction: 'none' }}
              >
                <div className="shrink-0 bg-slate-950 border border-slate-700/90 rounded-2xl p-1.5 shadow-inner flex items-center justify-center">
                  <RealisticTrashVisual
                    shapeType={currentL1Item.shapeType}
                    className={
                      isSplitMode ? 'w-14 h-14 md:w-16 md:h-16' : 'w-24 h-24 md:w-28 md:h-28'
                    }
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="inline-flex items-center gap-1 bg-amber-400 text-slate-950 text-[9px] md:text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wide">
                    <span>✋ SERET (DRAG) SAMPAH KE TONG</span>
                  </div>
                  <h3
                    className={`font-extrabold text-white leading-tight mt-1 ${
                      isSplitMode ? 'text-sm md:text-base' : 'text-base md:text-xl'
                    }`}
                  >
                    {currentL1Item.name}
                  </h3>
                  <p
                    className={`text-slate-300 leading-snug mt-0.5 ${
                      isSplitMode ? 'text-[11px]' : 'text-xs md:text-sm'
                    }`}
                  >
                    {currentL1Item.hint}
                  </p>
                </div>
              </div>

              <div
                className={`text-center font-extrabold text-amber-300 tracking-wider uppercase flex items-center justify-center gap-1.5 ${
                  isSplitMode ? 'py-1 text-[10px]' : 'py-2 text-[11px] md:text-xs'
                }`}
              >
                <span>⬇️</span>
                <span>Pilih Tong Sampah (Organik / Anorganik / B3)</span>
                <span>⬇️</span>
              </div>

              <div className={`grid grid-cols-3 max-w-2xl mx-auto ${isSplitMode ? 'gap-2' : 'gap-2.5 md:gap-4'}`}>
                {binsConfig.map((bin) => {
                  const isOver = l1DragOverBin === bin.label;
                  const binHit = l1BinFlash?.dir === bin.dir ? l1BinFlash.type : null;
                  return (
                    <button
                      key={bin.label}
                      type="button"
                      data-testid={bin.testId}
                      data-bin-slot={slotAttr}
                      data-bin-label={bin.label}
                      data-bin-dir={bin.dir}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (l1DragOverBin !== bin.label) {
                          setL1DragOverBin(bin.label);
                        }
                      }}
                      onDragLeave={() => {
                        if (l1DragOverBin === bin.label) {
                          setL1DragOverBin(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setL1IsDragging(false);
                        setL1DragOverBin(null);
                        handleLevel1Sort(bin.dir);
                      }}
                      onClick={() => handleLevel1Sort(bin.dir)}
                      className={`rounded-2xl border-2 flex flex-col items-center justify-between cursor-pointer transition-all ${
                        isSplitMode ? 'p-1.5' : 'p-2 md:p-3'
                      } ${
                        binHit === 'ok'
                          ? 'ring-4 ring-emerald-300 border-emerald-300 bg-emerald-700/85 scale-105 shadow-[0_0_24px_rgba(52,211,153,0.6)]'
                          : binHit === 'err'
                          ? 'ring-4 ring-amber-400 border-amber-300 bg-amber-900/80 shadow-[0_0_20px_rgba(251,191,36,0.45)]'
                          : isOver
                          ? bin.activeRingClass
                          : bin.borderClass
                      }`}
                    >
                      <RealisticBinVisual binType={bin.label} isActiveDrop={isOver} />
                      <span
                        className={`mt-1 font-extrabold text-white bg-slate-950/90 border border-slate-700 px-2 py-0.5 rounded-lg uppercase tracking-wider ${
                          isSplitMode ? 'text-[10px]' : 'text-[11px] md:text-xs'
                        }`}
                      >
                        TONG {bin.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {l1IsDragging && l1PointerPos && (
                <div
                  className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-1/2 opacity-90 scale-95"
                  style={{ left: l1PointerPos.x, top: l1PointerPos.y }}
                >
                  <RealisticTrashVisual
                    shapeType={currentL1Item.shapeType}
                    className="w-24 h-24 drop-shadow-2xl"
                  />
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    );
  }

  // 4D. MODE 2P SPLIT SCREEN LEVEL 2: KOTAK BAWAH RINGKAS AGAR KEDUA KARAKTER UTAMA & RUANG BACA 3D SELALU TERLIHAT
  if (currentLevel === 2 && isSplitMode) {
    return (
      <div
        data-testid={`level2-core-studio-p${playerSlot}`}
        className="relative z-20 flex-1 w-full h-full flex flex-col items-center justify-end p-2 pb-24 lg:pb-2 pointer-events-none bg-transparent"
      >
        <div
          data-testid={`arena-deck-p${playerSlot}`}
          className={`pointer-events-auto w-full max-w-[520px] max-h-[54vh] overflow-y-auto pr-0.5 space-y-1.5 ${
            playerSlot === 1 ? 'lg:ml-[156px] lg:mr-1' : 'lg:mr-[156px] lg:ml-1'
          }`}
        >
          {renderFeedbackBanner()}

          <section
            data-testid={`level2-panel-p${playerSlot}`}
            aria-label={`Arena Level 2 Rahasia 3R Pemain ${playerSlot}`}
            className={`bg-slate-900/95 border-2 border-amber-500/85 rounded-2xl p-2.5 md:p-3 shadow-xl space-y-2 transition-all duration-200 ${panelFlashClasses}`}
          >
            {/* Header Seimbang Fokus Soal */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-800 pb-1.5">
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[11px] font-extrabold font-mono-num px-2 py-0.5 rounded-xl border uppercase ${
                    playerSlot === 1
                      ? 'bg-emerald-950 border-emerald-400 text-emerald-300'
                      : 'bg-sky-950 border-sky-400 text-sky-300'
                  }`}
                >
                  {playerSlot === 1
                    ? `🎯 P1 (KIRI): ${playerName}`
                    : `🎯 P2 (KANAN): ${playerName}`}
                </span>
                <span className="text-[10px] font-extrabold text-amber-300 uppercase">
                  Level 2 · Rahasia 3R
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span
                  data-testid={`l2-progress-p${playerSlot}`}
                  className="text-[10px] font-extrabold uppercase text-amber-300 font-mono-num bg-amber-950/70 border border-amber-500/40 px-2 py-0.5 rounded-lg"
                >
                  Kata #{l2Index + 1}/{totalL2Words}
                </span>
                {l2Phase === 'anagram' && (
                  <button
                    type="button"
                    onClick={() => {
                      audioEngine.playClickWood();
                      setL2PickedIndices([]);
                    }}
                    className="btn-clay-slate px-2.5 py-0.5 rounded-xl text-[11px] font-bold text-amber-300 border border-slate-700 cursor-pointer"
                  >
                    🔄 Reset
                  </button>
                )}
              </div>
            </div>

            {/* Fokus Soal & Petunjuk Makna di Tengah (Teks Utuh Tidak Terputus) */}
            <div className="bg-slate-950/90 border border-amber-500/40 rounded-2xl p-2 text-center space-y-0.5">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
                {l2Phase === 'anagram'
                  ? '🧩 Tahap 1: Susun Huruf Menjadi Kata Kunci 3R'
                  : `🧮 Tahap 2: Soal Hitungan Numerasi (${activeL2Item.targetWord})`}
              </div>
              <p
                data-testid={`l2-question-text-p${playerSlot}`}
                className="text-xs font-semibold text-slate-100 leading-snug break-words"
              >
                {l2Phase === 'anagram' ? (
                  <>
                    <strong className="text-emerald-300">Makna Kata:</strong>{' '}
                    {activeL2Item.meaning}
                  </>
                ) : (
                  activeL2Item.numeracyQuestion
                )}
              </p>
            </div>

            {l2Phase === 'anagram' ? (
              <div className="space-y-2">
                {/* Papan Jawaban Susun Huruf Utama di Tengah */}
                <div
                  data-testid={`l2-slots-p${playerSlot}`}
                  className="flex flex-wrap items-center justify-center gap-1.5 min-h-[2.75rem] bg-slate-950 border-2 border-emerald-500/40 rounded-2xl p-2"
                >
                  {activeL2Item.scrambledLetters.map((_, slotIdx) => {
                    const char = assembledL2Word[slotIdx] || '';
                    return (
                      <button
                        key={slotIdx}
                        type="button"
                        disabled={!char}
                        onClick={() => handleRemoveL2Slot(slotIdx)}
                        title={char ? 'Klik untuk melepas huruf ini' : undefined}
                        className={`w-9 h-10 rounded-xl flex items-center justify-center text-base font-extrabold font-mono-num border-2 transition-all ${
                          char
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-300 shadow-lg scale-105 cursor-pointer'
                            : 'bg-slate-900 text-slate-500 border-dashed border-slate-700 cursor-default'
                        }`}
                      >
                        {char || '·'}
                      </button>
                    );
                  })}
                </div>

                {/* Tombol Pilihan Balok Huruf Acak (Berbeda antara P1 & P2) */}
                <div className="space-y-1">
                  <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    Pilih &amp; Susun Balok Huruf:
                  </div>
                  <div
                    data-testid={`l2-tiles-p${playerSlot}`}
                    className="flex flex-wrap items-center justify-center gap-1.5"
                  >
                    {activeL2Item.scrambledLetters.map((letter, idx) => {
                      const used = l2PickedIndices.includes(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={used}
                          onClick={() => handlePickL2Letter(idx)}
                          className={`wood-tile w-9 h-10 rounded-xl text-base font-extrabold font-mono-num cursor-pointer transition-transform active:scale-95 ${
                            used ? 'opacity-25 cursor-not-allowed' : 'hover:scale-105'
                          }`}
                        >
                          {letter}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div
                data-testid={`l2-options-p${playerSlot}`}
                className="grid grid-cols-1 gap-1.5"
              >
                {activeL2Item.options.map((opt, idx) => {
                  const isGuideFlash = wrongOptionFlash?.key === `l2-opt-${idx}`;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleL2NumeracyOption(opt.isCorrect, idx)}
                      className={`border-2 px-3 py-2 rounded-2xl text-xs font-bold text-left text-white leading-snug cursor-pointer transition-all ${
                        isGuideFlash
                          ? 'bg-amber-950/90 border-amber-400 ring-2 ring-amber-400/70'
                          : 'btn-clay-slate hover:border-emerald-400 border-slate-700'
                      }`}
                    >
                      {isGuideFlash && <span className="text-amber-300 font-black mr-1.5">💡 Cek lagi yuk:</span>}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  // 5. ACTIVE ARENA GAMEPLAY (Levels 2 to 6)
  const isSidebar = true;
  const panelCardClass =
    `bg-slate-950 rounded-2xl p-2 md:p-4 shadow-lg transition-all duration-300 ${panelFlashClasses}`;

  const renderDeckToolbar = (badgeLabel: string) => (
    <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1 md:pb-2 mb-1.5 md:mb-2">
      <div className="flex items-center gap-1.5">
        {isSplitMode ? (
          <span
            className={`text-[10px] font-extrabold font-mono-num px-2 py-0.5 rounded-lg border uppercase shadow-sm ${
              playerSlot === 1
                ? 'bg-emerald-950 border-emerald-400 text-emerald-300'
                : 'bg-sky-950 border-sky-400 text-sky-300'
            }`}
          >
            {playerSlot === 1 ? `🎯 P1 (KIRI): ${playerName}` : `🎯 P2 (KANAN): ${playerName}`}
          </span>
        ) : (
          <span className="text-[10px] font-extrabold font-mono-num px-2 md:px-2.5 py-0.5 rounded-lg bg-emerald-950 border border-emerald-500 text-emerald-300 uppercase shadow-sm">
            {badgeLabel}
          </span>
        )}
        <span className="text-xs text-slate-300 font-bold hidden sm:inline">
          Misi {levelMeta.bloomCode}
        </span>
      </div>
      <span className="text-[10px] font-semibold text-slate-400">
        Level {currentLevel}/6
      </span>
    </div>
  );

  const anyExploreDialogOpen =
    (currentLevel === 4 && l4DialogOpen) ||
    (currentLevel === 5 && l5DialogOpen) ||
    (currentLevel === 6 && l6DialogOpen);

  return (
    <div
      key={`core-gameplay-arena-${currentLevel}`}
      className={`relative ${
        anyExploreDialogOpen
          ? 'max-md:z-[80] z-20'
          : currentLevel === 2 || currentLevel === 3
          ? 'max-md:z-40 z-20'
          : 'z-20'
      } flex-1 flex flex-col justify-between ${
        currentLevel === 2 || currentLevel === 3
          ? 'max-md:px-0 max-md:pt-1.5 max-md:pb-0 md:p-3.5'
          : 'p-1.5 md:p-3.5'
      } pointer-events-none`}
    >
      {/* Top Row: 1P Banner + MiniMap OR 2P Independent Per-Player MiniMap on Levels 4, 5, 6 */}
      {!isSplitMode ? (
        <div
          className={`flex flex-wrap items-start justify-between gap-2.5 ${
            currentLevel === 2 || currentLevel === 3 ? 'max-md:px-1.5' : ''
          }`}
        >
          <div className="space-y-1 md:space-y-1.5 max-w-xl pointer-events-auto">
            {/* Banner Indikator Bloom (Section III.3) */}
            <div className="inline-flex flex-wrap items-center gap-1.5 md:gap-2 bg-slate-950/92 border border-amber-400 md:border-2 rounded-xl px-2 py-0.5 md:px-3 md:py-1 shadow-lg">
              <span className="text-[10.5px] md:text-xs font-extrabold text-amber-300">
                Lv.{levelMeta.level}: {levelMeta.name}
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-[10.5px] md:text-xs font-bold text-emerald-300">
                {levelMeta.bloomCode} <span className="hidden md:inline">({levelMeta.bloomLabel})</span>
              </span>
              <span className="hidden md:inline text-slate-500">·</span>
              <span className="hidden md:inline text-[11px] text-slate-300">📷 {levelMeta.cameraView}</span>
            </div>

            {/* Feedback Toast (1P / Mode Kelas) */}
            {renderFeedbackBanner(currentLevel === 2 || currentLevel === 3 ? 'max-md:hidden' : '')}
          </div>

          {/* Contextual Mini Map: Pada HP (< md) dipindah ke kanan bawah berdampingan dengan Joystik Virtual; di PC/IFP tetap di kanan atas */}
          <div
            className={`max-md:fixed max-md:bottom-2.5 max-md:right-2.5 max-md:z-30 ${
              anyExploreDialogOpen ? 'max-md:hidden' : ''
            }`}
          >
            <ContextualMiniMap
              currentLevel={currentLevel}
              playerX={playerPosRef.current.x}
              playerZ={playerPosRef.current.z}
              playerPosRef={playerPosRef}
              completedCitizens={completedCitizens}
              completedZones={completedZones}
              completedIslands={completedIslands}
              activeZoneIdx={activeL5StationIdx}
              activeIslandIdx={activeL6StationIdx}
              l4Positions={l4Positions}
              l5Positions={l5Positions}
              onSelectCitizen={handleWalkToCitizen}
              onSelectZone={handleWalkToZoneNpc}
              onSelectIsland={handleWalkToIslandTower}
            />
          </div>
        </div>
      ) : (
        currentLevel >= 4 && (
          <div
            className={`flex items-start ${
              playerSlot === 1 ? 'justify-start' : 'justify-end'
            } max-md:absolute max-md:bottom-2 ${
              playerSlot === 1 ? 'max-md:right-1.5' : 'max-md:left-1.5'
            } max-md:z-30 ${anyExploreDialogOpen ? 'max-md:hidden' : ''} pointer-events-none`}
          >
            <ContextualMiniMap
              compact
              playerSlot={playerSlot}
              currentLevel={currentLevel}
              playerX={playerPosRef.current.x}
              playerZ={playerPosRef.current.z}
              playerPosRef={playerPosRef}
              partnerPosRef={partnerPosRef}
              completedCitizens={completedCitizens}
              completedZones={completedZones}
              completedIslands={completedIslands}
              activeZoneIdx={activeL5StationIdx}
              activeIslandIdx={activeL6StationIdx}
              l4Positions={l4Positions}
              l5Positions={l5Positions}
              onSelectCitizen={handleWalkToCitizen}
              onSelectZone={handleWalkToZoneNpc}
              onSelectIsland={handleWalkToIslandTower}
            />
          </div>
        )
      )}

      {/* Main Gameplay Deck Work Area: Clean bottom alignment near Joystick on HP for Level 2/3 & Exploration */}
      <div
        className={`flex-1 flex flex-col gap-3 pointer-events-none ${
          (currentLevel === 5 && l5DialogOpen) || (currentLevel === 6 && l6DialogOpen)
            ? isSplitMode
              ? playerSlot === 1
                ? currentLevel === 6
                  ? 'justify-end md:justify-start items-end xl:-mt-[162px] pb-1'
                  : 'justify-end md:justify-start items-end xl:-mt-[150px] pb-1'
                : currentLevel === 6
                ? 'justify-end md:justify-start items-start xl:-mt-[162px] pb-1'
                : 'justify-end md:justify-start items-start xl:-mt-[150px] pb-1'
              : currentLevel === 6
              ? 'justify-end md:justify-start items-center lg:-mt-[154px] pb-1.5'
              : 'justify-end md:justify-start items-center lg:-mt-[125px] pb-2 md:pb-4'
            : `mt-auto ${
                isSplitMode && (currentLevel === 2 || currentLevel === 3)
                  ? 'justify-end items-center pb-0 md:pb-24 lg:pb-1'
                  : (currentLevel === 4 && !l4DialogOpen) ||
                    (currentLevel === 5 && !l5DialogOpen) ||
                    (currentLevel === 6 && !l6DialogOpen)
                  ? 'justify-end items-center pb-[72px] md:pb-24 xl:pb-1'
                  : isSplitMode
                  ? playerSlot === 1
                    ? 'items-end lg:flex-row lg:justify-end pb-[72px] md:pb-24 lg:pb-0'
                    : 'items-end lg:flex-row lg:justify-start pb-[72px] md:pb-24 lg:pb-0'
                  : currentLevel === 2 || currentLevel === 3
                  ? 'justify-end items-end lg:flex-row lg:justify-between pb-0 md:pb-24 lg:pb-0'
                  : currentLevel === 4 && l4DialogOpen
                  ? 'items-end lg:flex-row lg:justify-between pb-2 md:pb-24 lg:pb-0'
                  : 'items-end lg:flex-row lg:justify-between pb-[74px] md:pb-24 lg:pb-0'
              }`
        }`}
      >
        {!isSplitMode &&
          !(
            (currentLevel === 4 && !l4DialogOpen) ||
            (currentLevel === 5 && !l5DialogOpen) ||
            (currentLevel === 6 && !l6DialogOpen)
          ) &&
          !(currentLevel === 5 && l5DialogOpen) &&
          !(currentLevel === 6 && l6DialogOpen) && (
            <div className="flex-1 pointer-events-none hidden lg:block" />
          )}

        {/* Interactive Deck Container (On mobile < md, open L4/L5/L6 question modals take primary full-screen top layer with zero obstructions; PC/IFP untouched) */}
        <div
          data-testid={isSplitMode ? `arena-deck-p${playerSlot}` : 'arena-deck-1p'}
          className={`pointer-events-auto w-full ${
            (currentLevel === 5 && l5DialogOpen) || (currentLevel === 6 && l6DialogOpen)
              ? isSplitMode
                ? currentLevel === 6
                  ? 'max-w-[440px] xl:max-w-none xl:w-[412px] min-[1400px]:w-[480px] max-md:max-h-[70vh] max-md:overflow-y-auto overflow-visible space-y-1'
                  : 'max-w-[440px] xl:max-w-none xl:w-[405px] min-[1400px]:w-[475px] max-md:max-h-[70vh] max-md:overflow-y-auto overflow-visible space-y-1.5'
              : currentLevel === 6
                ? 'max-w-[820px] lg:mr-[238px] lg:ml-auto max-md:max-h-[70vh] max-md:overflow-y-auto overflow-visible space-y-1.5'
                : 'max-w-[780px] lg:mr-[240px] lg:ml-auto max-md:max-h-[70vh] max-md:overflow-y-auto overflow-visible space-y-2'
              : `${
                  (currentLevel === 4 && !l4DialogOpen) ||
                  (currentLevel === 5 && !l5DialogOpen) ||
                  (currentLevel === 6 && !l6DialogOpen)
                    ? isSplitMode
                      ? 'max-w-[310px] mx-auto'
                      : 'max-w-[540px] mx-auto'
                    : isSplitMode && (currentLevel === 2 || currentLevel === 3)
                    ? playerSlot === 1
                      ? 'max-w-[520px] lg:ml-[172px] lg:mr-1 max-h-[46dvh] md:max-h-[380px]'
                      : 'max-w-[520px] lg:mr-[172px] lg:ml-1 max-h-[46dvh] md:max-h-[380px]'
                    : isSplitMode
                    ? 'max-w-[315px] xl:max-w-[360px] max-h-[46vh] md:max-h-[calc(100vh-155px)]'
                    : currentLevel === 2 || currentLevel === 3
                    ? 'lg:w-[410px] xl:w-[450px] max-h-[46dvh] md:max-h-[calc(100vh-140px)]'
                    : 'lg:w-[410px] xl:w-[450px] max-h-[70vh] md:max-h-[calc(100vh-140px)]'
                } overflow-y-auto ${
                  currentLevel === 2 || currentLevel === 3 ? 'pr-0 md:pr-0.5' : 'pr-0.5'
                } space-y-1.5 md:space-y-2`
          } ${
            anyExploreDialogOpen
              ? isSplitMode
                ? 'max-md:absolute max-md:inset-0 max-md:z-[80] max-md:w-full max-md:h-full max-md:max-w-none max-md:max-h-none max-md:m-0 max-md:bg-slate-950/92 max-md:p-2 max-md:flex max-md:flex-col max-md:items-center max-md:justify-center max-md:overflow-y-auto max-md:space-y-1.5'
                : 'max-md:fixed max-md:inset-0 max-md:z-[80] max-md:w-screen max-md:h-[100dvh] max-md:max-w-none max-md:max-h-none max-md:m-0 max-md:bg-slate-950/92 max-md:p-2.5 max-md:flex max-md:flex-col max-md:items-center max-md:justify-center max-md:overflow-y-auto max-md:space-y-2'
              : ''
          }`}
        >
          {/* Mobile Modal Feedback Toast for 1P when modal backdrop is open or on Level 2/3 bottom dock */}
          {!isSplitMode &&
            (anyExploreDialogOpen || currentLevel === 2 || currentLevel === 3) &&
            renderFeedbackBanner(
              currentLevel === 2 || currentLevel === 3
                ? 'md:hidden w-full mx-auto py-1 px-2.5 rounded-xl [&_span]:text-[10px] [&_span]:line-clamp-2'
                : 'md:hidden w-full max-w-lg'
            )}

          {/* Personal Feedback Toast in 2P Mode */}
          {isSplitMode &&
            renderFeedbackBanner(
              anyExploreDialogOpen
                ? 'max-md:w-full max-md:max-w-lg'
                : currentLevel === 2 || currentLevel === 3
                ? 'max-md:py-1 max-md:px-2 max-md:rounded-xl max-md:[&_span]:text-[9.5px] max-md:[&_span]:line-clamp-1'
                : ''
            )}

          {/* LEVEL 2 DECK: RAHASIA 3R (1P Mode with Center 3D Letter Blocks Visualization) */}
          {currentLevel === 2 && (
            <section
              data-testid="level2-panel"
              aria-label="Arena Level 2 Rahasia 3R"
              className={`${panelCardClass} border-2 border-amber-500 max-md:rounded-b-none max-md:rounded-t-2xl ${
                isSplitMode ? 'max-md:border-x' : 'max-md:border-x-0'
              } max-md:border-b-0 max-md:px-2.5 max-md:pt-2 max-md:pb-2.5 max-md:shadow-[0_-10px_28px_rgba(2,6,23,0.94)]`}
            >
              <div className="hidden md:block">
                {renderDeckToolbar('Level 2: Rahasia 3R')}
              </div>

              <div className="hidden md:flex mb-2.5 bg-emerald-950/75 border border-emerald-500/50 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-emerald-200 items-center gap-1.5">
                <span>🧱</span>
                <span>Susun huruf di bawah — balok huruf 3D otomatis tertata di meja tengah!</span>
              </div>

              {/* BAGIAN SOAL / MAKNA KATA (Di bagian bawah layar pada HP, tepat di atas kolom huruf & tombol geser/jatuh) */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 md:gap-2 border-b border-slate-800 pb-1.5 md:pb-2 mb-1.5 md:mb-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[10px] md:text-[11px] font-extrabold uppercase text-amber-400 font-mono-num whitespace-nowrap">
                      Soal #{l2Index + 1}/{totalL2Words} ·{' '}
                      {l2Phase === 'anagram' ? (
                        <>
                          <span className="md:hidden">Susun Huruf 3R</span>
                          <span className="hidden md:inline">Susun Balok Huruf 3R</span>
                        </>
                      ) : (
                        'Tahap 2: Numerasi AKM'
                      )}
                    </span>
                    {l2Phase === 'anagram' && activeL2CursorLetter && (
                      <span className="md:hidden text-[9.5px] font-mono-num font-extrabold text-amber-300 bg-slate-900 px-2 py-0.5 rounded-lg border border-amber-500/40 shrink-0">
                        🎯 Huruf: {activeL2CursorLetter}
                      </span>
                    )}
                  </div>
                  <p className="text-[10.5px] md:text-xs font-semibold text-slate-200 mt-0.5 leading-snug max-md:line-clamp-2">
                    <strong className="text-amber-300">Soal Makna:</strong> {activeL2Item.meaning}
                  </p>
                </div>
                {l2Phase === 'anagram' && (
                  <button
                    type="button"
                    onClick={() => {
                      audioEngine.playClickWood();
                      setL2PickedIndices([]);
                      setL2CursorIdx(0);
                    }}
                    className="btn-clay-slate px-2 py-0.5 md:px-3 md:py-1 rounded-xl text-[10.5px] md:text-xs font-bold text-amber-300 border border-slate-700 cursor-pointer shrink-0"
                  >
                    🔄 Reset<span className="hidden md:inline"> Balok</span>
                  </button>
                )}
              </div>

              {l2Phase === 'anagram' ? (
                <div className="space-y-1.5 md:space-y-3">
                  <div className="flex flex-wrap items-center justify-center gap-1.5 md:gap-2 min-h-[2.2rem] md:min-h-[3.25rem] bg-slate-900 border border-slate-800 rounded-xl p-1 md:p-2.5">
                    {activeL2Item.scrambledLetters.map((_, slotIdx) => {
                      const char = assembledL2Word[slotIdx] || '';
                      const isNextSlot = slotIdx === assembledL2Word.length;
                      return (
                        <button
                          key={slotIdx}
                          type="button"
                          disabled={!char}
                          onClick={() => handleRemoveL2Slot(slotIdx)}
                          title={char ? 'Klik untuk melepas huruf ini' : undefined}
                          className={`w-7 h-7 md:w-11 md:h-11 rounded-lg md:rounded-xl flex items-center justify-center text-xs md:text-xl font-extrabold font-mono-num border-2 transition-all ${
                            char
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-300 shadow-lg scale-105 cursor-pointer'
                              : isNextSlot
                              ? 'bg-slate-950 text-amber-300 border-amber-400/80 cursor-default'
                              : 'bg-slate-950 text-slate-600 border-dashed border-slate-700 cursor-default'
                          }`}
                        >
                          {char || '·'}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-1.5 md:gap-2">
                    {activeL2Item.scrambledLetters.map((letter, idx) => {
                      const used = l2PickedIndices.includes(idx);
                      const isCursorSelected = !used && idx === activeL2CursorIdx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          data-testid={`btn-letter-${idx}`}
                          disabled={used}
                          onClick={() => handlePickL2Letter(idx)}
                          className={`wood-tile w-8 h-8 md:w-11 md:h-11 rounded-lg md:rounded-xl text-sm md:text-xl font-extrabold font-mono-num cursor-pointer transition-transform active:scale-95 ${
                            used
                              ? 'opacity-25 cursor-not-allowed'
                              : isCursorSelected
                              ? 'max-md:ring-2 max-md:ring-amber-300 max-md:border-white max-md:scale-105 hover:scale-105'
                              : 'hover:scale-105'
                          }`}
                        >
                          {letter}
                        </button>
                      );
                    })}
                  </div>

                  {/* KOLOM GESER KIRI - JATUHKAN - GESER KANAN DI BAWAH (KHUSUS HP < 768px) */}
                  <div className="grid grid-cols-3 gap-1.5 md:hidden pt-0.5">
                    <button
                      type="button"
                      data-testid="btn-l2-left"
                      disabled={l2PickedIndices.length >= activeL2Item.scrambledLetters.length}
                      onClick={() => handleStepL2Cursor('left')}
                      className="btn-clay-slate disabled:opacity-45 border border-amber-500/60 py-2 px-1.5 rounded-xl text-[10.5px] font-extrabold text-white cursor-pointer"
                    >
                      ⬅️ Geser Kiri
                    </button>
                    <button
                      type="button"
                      data-testid="btn-l2-drop"
                      disabled={l2PickedIndices.length >= activeL2Item.scrambledLetters.length}
                      onClick={handleDropL2CursorLetter}
                      className="btn-clay-emerald disabled:opacity-60 py-2 px-1.5 rounded-xl text-[10.5px] font-extrabold text-white cursor-pointer"
                    >
                      ⬇️ JATUHKAN ({activeL2CursorLetter || '-'})
                    </button>
                    <button
                      type="button"
                      data-testid="btn-l2-right"
                      disabled={l2PickedIndices.length >= activeL2Item.scrambledLetters.length}
                      onClick={() => handleStepL2Cursor('right')}
                      className="btn-clay-slate disabled:opacity-45 border border-amber-500/60 py-2 px-1.5 rounded-xl text-[10.5px] font-extrabold text-white cursor-pointer"
                    >
                      Geser Kanan ➡️
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 md:space-y-2.5">
                  <div className="bg-slate-900 border border-amber-500/40 rounded-xl md:rounded-2xl p-2 md:p-3 text-[11px] md:text-sm text-amber-100 leading-snug md:leading-relaxed">
                    <strong className="text-amber-300">
                      🧮 Soal Numerasi ({activeL2Item.targetWord}):
                    </strong>{' '}
                    {activeL2Item.numeracyQuestion}
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 md:gap-2">
                    {activeL2Item.options.map((opt, idx) => {
                      const isGuideFlash = wrongOptionFlash?.key === `l2-opt-${idx}`;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleL2NumeracyOption(opt.isCorrect, idx)}
                          className={`border max-md:p-1.5 p-2 md:p-2.5 rounded-xl md:rounded-2xl text-[11px] md:text-xs font-bold text-left text-white cursor-pointer transition-all ${
                            isGuideFlash
                              ? 'bg-amber-950/90 border-amber-400 ring-2 ring-amber-400/70'
                              : 'btn-clay-slate hover:border-emerald-400 border-slate-700'
                          }`}
                        >
                          {isGuideFlash && <span className="text-amber-300 font-black mr-1.5">💡 Cek lagi yuk:</span>}
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* LEVEL 3 DECK: OPERASI MESIN CAPIT 3R (6 Items + Numeracy) */}
          {currentLevel === 3 && (
            <section
              data-testid="level3-panel"
              aria-label="Arena Level 3 Mesin Capit 3R"
              className={`${panelCardClass} border-2 border-sky-500 max-md:rounded-b-none max-md:rounded-t-2xl ${
                isSplitMode ? 'max-md:border-x' : 'max-md:border-x-0'
              } max-md:border-b-0 max-md:px-2.5 max-md:pt-2 max-md:pb-2.5 max-md:shadow-[0_-10px_28px_rgba(2,6,23,0.94)]`}
            >
              <div className="hidden md:block">
                {renderDeckToolbar('Level 3: Mesin Capit 3R')}
              </div>

              {/* BAGIAN SOAL / BENDA (Di bagian bawah layar pada HP, tepat di atas kolom tombol geser & jatuh) */}
              <div className="flex flex-wrap items-start justify-between gap-1.5 md:gap-2 border-b border-slate-800 pb-1.5 md:pb-2 mb-1.5 md:mb-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[10px] md:text-[11px] font-extrabold uppercase text-sky-400 font-mono-num">
                      Soal Barang #{l3Index + 1}/{totalL3Items} ·{' '}
                      {l3Phase === 'claw' ? 'Arahkan Capit 3R' : 'Hitung Dampak 3R'}
                    </span>
                    <span className="md:hidden text-[9.5px] font-mono-num font-extrabold text-amber-300 bg-slate-900 px-2 py-0.5 rounded-lg border border-amber-500/40 shrink-0">
                      🎯 Capit: {l3SelectedBin}
                    </span>
                  </div>
                  <h3 className="text-xs md:text-base font-extrabold text-white truncate md:whitespace-normal mt-0.5">
                    📦 {currentL3Spec.name}
                  </h3>
                  <p className="text-[10.5px] md:text-[11px] text-slate-200 md:text-slate-300 max-md:line-clamp-2 md:whitespace-normal leading-snug">
                    {currentL3Spec.description}{' '}
                    <span className="md:hidden text-amber-300 font-bold">
                      (Pilih tong 3R lalu tekan Jatuhkan)
                    </span>
                  </p>
                </div>
                <div className="hidden md:block text-[10px] md:text-xs font-mono-num font-bold text-amber-300 bg-slate-900 px-2 py-0.5 md:px-2.5 md:py-1 rounded-xl border border-slate-800 shrink-0">
                  Target: {l3SelectedBin}
                </div>
              </div>

              {l3Phase === 'claw' ? (
                <div className={isSplitMode ? 'space-y-1.5 md:space-y-2' : 'space-y-1.5 md:space-y-2.5'}>
                  {!isSplitMode && (
                    <div className="hidden md:flex bg-sky-950/70 border border-sky-500/40 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-sky-200 items-center gap-1.5">
                      <span>🏗️</span>
                      <span>Capit sudah mencapit benda — geser kiri/kanan lalu tekan Jatuhkan!</span>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { bin: 'REDUCE', pos: 'Kiri' },
                      { bin: 'REUSE', pos: 'Tengah' },
                      { bin: 'RECYCLE', pos: 'Kanan' },
                    ] as const).map(({ bin, pos }) => (
                      <button
                        key={bin}
                        type="button"
                        disabled={l3Dropping}
                        onClick={() => handleSelectClawBin(bin)}
                        className={`${
                          isSplitMode ? 'py-1 px-1 md:py-1.5 md:px-1.5' : 'py-1 px-1 md:py-2 md:px-1.5'
                        } rounded-xl md:rounded-2xl font-extrabold text-[10px] md:text-[11px] border-2 cursor-pointer transition-all ${
                          l3SelectedBin === bin
                            ? 'bg-amber-400 text-slate-950 border-white shadow-md'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                        }`}
                      >
                        <div>🎯 {bin}</div>
                        <div className="text-[8px] md:text-[9px] opacity-80">({pos})</div>
                      </button>
                    ))}
                  </div>
                  {/* KOLOM GESER KIRI - JATUHKAN - GESER KANAN DI BAWAH */}
                  {isSplitMode ? (
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        data-testid="btn-claw-left"
                        disabled={l3Dropping || l3SelectedBin === 'REDUCE'}
                        onClick={() => handleMoveClawStep('left')}
                        className="btn-clay-slate disabled:opacity-45 disabled:cursor-not-allowed border border-sky-500/60 hover:border-sky-300 py-2 md:py-2 px-1.5 rounded-xl md:rounded-2xl text-[10.5px] md:text-xs font-extrabold text-white cursor-pointer"
                      >
                        ⬅️ Geser Kiri
                      </button>
                      <button
                        type="button"
                        data-testid="btn-claw-drop"
                        disabled={l3Dropping}
                        onClick={handleDropClawItem}
                        className="btn-clay-emerald disabled:opacity-60 py-2 md:py-2 px-1.5 rounded-xl md:rounded-2xl text-[10.5px] md:text-xs font-extrabold text-white cursor-pointer"
                      >
                        {l3Dropping ? '⬇️ Jatuh...' : `⬇️ Jatuhkan (${l3SelectedBin})`}
                      </button>
                      <button
                        type="button"
                        data-testid="btn-claw-right"
                        disabled={l3Dropping || l3SelectedBin === 'RECYCLE'}
                        onClick={() => handleMoveClawStep('right')}
                        className="btn-clay-slate disabled:opacity-45 disabled:cursor-not-allowed border border-sky-500/60 hover:border-sky-300 py-2 md:py-2 px-1.5 rounded-xl md:rounded-2xl text-[10.5px] md:text-xs font-extrabold text-white cursor-pointer"
                      >
                        Geser Kanan ➡️
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 md:grid-cols-2 gap-1.5 md:gap-2">
                      <button
                        type="button"
                        data-testid="btn-claw-left"
                        disabled={l3Dropping || l3SelectedBin === 'REDUCE'}
                        onClick={() => handleMoveClawStep('left')}
                        className="order-1 md:order-1 btn-clay-slate disabled:opacity-45 disabled:cursor-not-allowed border border-sky-500/60 hover:border-sky-300 py-2.5 md:py-2.5 px-1.5 md:px-2 rounded-xl md:rounded-2xl text-[11px] md:text-sm font-extrabold text-white cursor-pointer"
                      >
                        ⬅️ Geser Kiri
                      </button>
                      <button
                        type="button"
                        data-testid="btn-claw-drop"
                        disabled={l3Dropping}
                        onClick={handleDropClawItem}
                        className="order-2 md:order-3 md:col-span-2 btn-clay-emerald disabled:opacity-60 w-full py-2.5 md:py-2.5 px-1.5 md:px-2 rounded-xl md:rounded-2xl text-[11px] md:text-sm font-extrabold text-white cursor-pointer"
                      >
                        <span className="md:hidden">
                          {l3Dropping ? '⬇️ Jatuh...' : `⬇️ JATUHKAN (${l3SelectedBin})`}
                        </span>
                        <span className="hidden md:inline">
                          {l3Dropping
                            ? `⬇️ MENJATUHKAN KE TONG ${l3SelectedBin}...`
                            : `⬇️ JATUHKAN (TONG ${l3SelectedBin})`}
                        </span>
                      </button>
                      <button
                        type="button"
                        data-testid="btn-claw-right"
                        disabled={l3Dropping || l3SelectedBin === 'RECYCLE'}
                        onClick={() => handleMoveClawStep('right')}
                        className="order-3 md:order-2 btn-clay-slate disabled:opacity-45 disabled:cursor-not-allowed border border-sky-500/60 hover:border-sky-300 py-2.5 md:py-2.5 px-1.5 md:px-2 rounded-xl md:rounded-2xl text-[11px] md:text-sm font-extrabold text-white cursor-pointer"
                      >
                        Geser Kanan ➡️
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5 md:space-y-2.5">
                  <div className="bg-slate-900 border border-sky-500 rounded-xl p-2 md:p-3 text-[11px] md:text-sm text-sky-100 leading-snug md:leading-relaxed">
                    <strong className="text-sky-300">🧮 Soal Numerasi 3R:</strong>{' '}
                    {currentL3Spec.numeracyQuestion}
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 md:gap-2">
                    {activeL3Entry.options.map((opt, idx) => {
                      const isGuideFlash = wrongOptionFlash?.key === `l3-opt-${idx}`;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleL3NumeracyOption(opt.isCorrect, idx)}
                          className={`border max-md:p-1.5 p-2 md:p-2.5 rounded-xl md:rounded-2xl text-[11px] md:text-xs font-bold text-left text-white cursor-pointer transition-all ${
                            isGuideFlash
                              ? 'bg-amber-950/90 border-amber-400 ring-2 ring-amber-400/70'
                              : 'btn-clay-slate hover:border-emerald-400 border-slate-700'
                          }`}
                        >
                          {isGuideFlash && <span className="text-amber-300 font-black mr-1.5">💡 Cek lagi yuk:</span>}
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* LEVEL 4: CLEAN EXPLORATION PROMPT vs [E]-TRIGGERED QUESTION MODAL */}
          {currentLevel === 4 && !l4DialogOpen && (
            <div className="flex flex-col items-center gap-1.5 pb-1">
              {nearbyCitizenIdx !== null && LEVEL_4_CITIZENS[nearbyCitizenIdx] ? (
                !completedCitizens.includes(nearbyCitizenIdx) ? (
                  <button
                    type="button"
                    data-testid="btn-npc-interact-e"
                    onClick={handleOpenNearbyCitizenQuestion}
                    className="btn-clay-amber border-2 border-amber-200 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-slate-950 font-extrabold text-xs md:text-sm cursor-pointer animate-pulse"
                  >
                    <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg bg-slate-950 text-amber-300 font-mono-num text-xs font-black border border-amber-400">
                      {isSplitMode && playerSlot === 2 ? 'E / Enter' : 'E'}
                    </span>
                    <span>
                      Bicara dengan {LEVEL_4_CITIZENS[nearbyCitizenIdx].npcName} — Buka Soal
                    </span>
                  </button>
                ) : (
                  <div
                    data-testid="l4-npc-done-badge"
                    className="bg-emerald-950/95 border border-emerald-400 text-emerald-200 px-4 py-2 rounded-2xl text-xs font-bold shadow-lg"
                  >
                    ✓ Proyek {LEVEL_4_CITIZENS[nearbyCitizenIdx].npcName} tuntas ({completedCitizens.length}/{activeL4Deck.length}) — Jelajahi warga lain!
                  </div>
                )
              ) : (
                <div
                  data-testid="l4-explore-hint"
                  className="bg-slate-950/88 border border-emerald-500/50 text-slate-100 px-3.5 py-1.5 rounded-2xl text-[11px] md:text-xs font-semibold shadow-lg flex items-center gap-2"
                >
                  <span>🚶</span>
                  <span>
                    Jelajahi (<strong>{isSplitMode && playerSlot === 2 ? 'Panah' : 'WASD'}</strong>) · Ketuk/klik warga atau tekan{' '}
                    <strong className="text-amber-300">[{isSplitMode && playerSlot === 2 ? 'Enter / E' : 'E'}]</strong>
                  </span>
                  <span className="text-emerald-300 font-mono-num font-extrabold shrink-0 whitespace-nowrap">
                    · {completedCitizens.length}/{activeL4Deck.length}
                  </span>
                </div>
              )}
            </div>
          )}

          {currentLevel === 4 && l4DialogOpen && (
            <section
              data-testid="level4-panel"
              aria-label="Arena Level 4 Kreasi Karya Kota Lestari"
              className={`${panelCardClass} border-2 border-emerald-500 max-md:w-full max-md:max-w-lg max-md:max-h-[88dvh] max-md:overflow-y-auto max-md:shadow-2xl`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
                <div className="flex items-center gap-1.5">
                  {isSplitMode ? (
                    <span
                      className={`text-[10px] font-extrabold font-mono-num px-2 py-0.5 rounded-lg border uppercase shadow-sm ${
                        playerSlot === 1
                          ? 'bg-emerald-950 border-emerald-400 text-emerald-300'
                          : 'bg-sky-950 border-sky-400 text-sky-300'
                      }`}
                    >
                      {playerSlot === 1 ? `🎯 P1 (KIRI): ${playerName}` : `🎯 P2 (KANAN): ${playerName}`}
                    </span>
                  ) : (
                    <span className="text-[10px] font-extrabold font-mono-num px-2.5 py-0.5 rounded-lg bg-emerald-950 border border-emerald-500 text-emerald-300 uppercase shadow-sm">
                      Level 4: Kota Lestari
                    </span>
                  )}
                  <span className="text-[11px] font-mono-num font-bold text-emerald-300">
                    Tuntas: {completedCitizens.length}/{activeL4Deck.length}
                  </span>
                </div>
                <button
                  type="button"
                  data-testid="btn-l4-close-dialog"
                  onClick={() => {
                    audioEngine.playClickWood();
                    setL4DialogOpen(false);
                  }}
                  className="btn-clay-slate border border-slate-700 hover:border-amber-400 px-2.5 py-1 rounded-xl text-[11px] font-bold text-slate-200 cursor-pointer"
                >
                  ✕ Tutup
                </button>
              </div>

              <div className="mb-2">
                <div
                  data-testid="l4-project-header"
                  className="text-xs font-extrabold text-amber-300"
                >
                  {isSplitMode
                    ? `🛠️ Pos #${activeStationIdx + 1} (${stationNpc.npcName}) · Proyek: ${currentCitizen.projectTitle}`
                    : `🛠️ Proyek ${currentCitizen.npcName} (${currentCitizen.npcRole}): ${currentCitizen.projectTitle}`}
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  &ldquo;
                  {isSplitMode && stationNpc.id !== currentCitizen.id
                    ? `Titipan ${currentCitizen.npcName}: ${currentCitizen.complaint}`
                    : currentCitizen.complaint}
                  &rdquo;
                </p>
              </div>

              {l4Phase === 'reject_hazard' ? (
                <div>
                  <div
                    data-testid="l4-phase1-question"
                    className="bg-slate-950/90 border border-amber-500/45 rounded-xl p-2.5 mb-2 flex flex-wrap items-center justify-between gap-2"
                  >
                    <span className="text-xs font-extrabold text-amber-200 leading-snug">
                      🧱 Berikut ini adalah bahan-bahan dalam membuat{' '}
                      <strong className="text-white">{currentCitizen.projectTitle}</strong>. Silakan klik semua bahan yang sesuai!
                    </span>
                    <span
                      data-testid="l4-selected-count"
                      className="text-[11px] font-mono-num font-extrabold px-2 py-0.5 rounded-lg bg-emerald-950 border border-emerald-500/60 text-emerald-300 shrink-0"
                    >
                      Dipilih: {l4SelectedSlots.length}/3
                    </span>
                  </div>
                  <div className={`grid gap-2 ${isSidebar ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
                    {activeL4Entry.materials.map((mat, dispIdx) => {
                      const isSelected = l4SelectedSlots.includes(mat.slot);
                      const isHazardFlash = wrongOptionFlash?.key === `l4-mat-${mat.slot}`;
                      return (
                        <button
                          key={mat.slot}
                          type="button"
                          data-testid={`l4-mat-slot-${mat.slot}`}
                          data-hazardous={mat.isHazardous ? '1' : '0'}
                          onClick={() => handleL4InspectMaterial(mat.slot, dispIdx + 1)}
                          className={`p-2.5 rounded-2xl text-left cursor-pointer border-2 transition-all ${
                            isHazardFlash
                              ? 'bg-amber-950/95 border-amber-400 ring-2 ring-amber-400/75'
                              : isSelected
                              ? 'bg-emerald-950/85 border-emerald-400 ring-2 ring-emerald-400/50 shadow-md animate-[feedbackPop_220ms_ease-out]'
                              : 'btn-clay-slate border-slate-700 hover:border-amber-400'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`text-[10px] font-mono-num font-bold ${
                                isHazardFlash
                                  ? 'text-amber-300'
                                  : isSelected
                                  ? 'text-emerald-300'
                                  : 'text-amber-400'
                              }`}
                            >
                              {isSplitMode ? `PILIHAN ${dispIdx + 1}` : `SLOT ${mat.slot}`}
                            </span>
                            {isHazardFlash ? (
                              <span className="text-[10px] font-extrabold text-amber-300">
                                💡 Kurang Aman
                              </span>
                            ) : (
                              isSelected && (
                                <span className="text-[10px] font-extrabold text-emerald-300">
                                  ✅ SESUAI
                                </span>
                              )
                            )}
                          </div>
                          <div className="text-xs font-bold text-white mt-0.5 leading-snug">
                            {mat.name}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="bg-slate-900/90 border border-emerald-500/40 rounded-2xl p-3 text-xs md:text-sm text-emerald-100 leading-relaxed">
                    <strong className="text-emerald-300">🧮 Hitungan Rakit ({currentCitizen.projectTitle}):</strong>{' '}
                    {currentCitizen.numeracyQuestion}
                  </div>
                  <div className={`grid gap-2 ${isSidebar ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
                    {activeL4Entry.options.map((opt, idx) => {
                      const isGuideFlash = wrongOptionFlash?.key === `l4-opt-${idx}`;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleL4NumeracyOption(opt.isCorrect, idx)}
                          className={`border p-2.5 rounded-2xl text-xs md:text-sm font-bold text-left text-white cursor-pointer transition-all ${
                            isGuideFlash
                              ? 'bg-amber-950/90 border-amber-400 ring-2 ring-amber-400/70'
                              : 'btn-clay-slate hover:border-emerald-400 border-slate-700'
                          }`}
                        >
                          {isGuideFlash && <span className="text-amber-300 font-black mr-1.5">💡 Cek lagi yuk:</span>}
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          )}

              {/* LEVEL 5 DECK: PENJAGA EKOSISTEM — Clean Exploration -> Meet/Tap Guardian NPC or [E] -> Modal Soal SD */}
              {currentLevel === 5 && !l5DialogOpen && (
                <div
                  data-testid="l5-explore-prompt"
                  className="flex flex-col items-center gap-1.5"
                >
                  {nearbyZoneIdx !== null && LEVEL_5_ZONES[nearbyZoneIdx] ? (
                    !completedZones.includes(nearbyZoneIdx) ? (
                      <button
                        type="button"
                        data-testid="btn-l5-interact-e"
                        onClick={handleOpenNearbyZoneQuestion}
                        className="btn-clay-emerald border-2 border-amber-300 px-4 py-2 rounded-2xl text-xs md:text-sm font-extrabold text-white shadow-xl flex items-center gap-2 cursor-pointer animate-pulse"
                      >
                        <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg bg-slate-950 text-amber-300 font-mono-num text-xs font-black border border-amber-400">
                          {isSplitMode && playerSlot === 2 ? 'E / Enter' : 'E'}
                        </span>
                        <span>
                          Bicara dengan {LEVEL_5_ZONES[nearbyZoneIdx].npcName} — Buka Soal
                        </span>
                      </button>
                    ) : (
                      <div
                        data-testid="l5-npc-done-badge"
                        className="bg-emerald-950/95 border border-emerald-400 text-emerald-200 px-4 py-2 rounded-2xl text-xs font-bold shadow-lg"
                      >
                        ✓ Pos {LEVEL_5_ZONES[nearbyZoneIdx].npcName} tuntas ({completedZones.length}/{activeL5Deck.length}) — Jelajahi penjaga lain!
                      </div>
                    )
                  ) : (
                    <div
                      data-testid="l5-explore-hint"
                      className="bg-slate-950/88 border border-emerald-500/50 text-slate-100 px-3.5 py-1.5 rounded-2xl text-[11px] md:text-xs font-semibold shadow-lg flex items-center gap-2"
                    >
                      <span>🌿</span>
                      <span>
                        Jelajahi 5 ekosistem (<strong>{isSplitMode && playerSlot === 2 ? 'Panah' : 'WASD'}</strong>) · Ketuk/klik penjaga atau tekan{' '}
                        <strong className="text-amber-300">[{isSplitMode && playerSlot === 2 ? 'Enter / E' : 'E'}]</strong>
                      </span>
                      <span className="text-emerald-300 font-mono-num font-extrabold shrink-0 whitespace-nowrap">
                        · {completedZones.length}/{activeL5Deck.length}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {currentLevel === 5 && l5DialogOpen && (
                <section
                  data-testid="level5-panel"
                  aria-label="Arena Level 5 Penjaga Ekosistem"
                  className={`bg-slate-950 rounded-2xl shadow-xl transition-all duration-300 border-2 border-emerald-500/80 max-md:w-full max-md:max-w-lg max-md:max-h-[88dvh] max-md:overflow-y-auto max-md:shadow-2xl ${
                    isSplitMode ? 'p-2.5' : 'p-3 md:p-3.5'
                  } ${panelFlashClasses}`}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      {isSplitMode ? (
                        <span
                          className={`text-[10px] font-extrabold font-mono-num px-2 py-0.5 rounded-lg border uppercase shadow-sm ${
                            playerSlot === 1
                              ? 'bg-emerald-950 border-emerald-400 text-emerald-300'
                              : 'bg-sky-950 border-sky-400 text-sky-300'
                          }`}
                        >
                          {playerSlot === 1 ? `🎯 P1 (KIRI): ${playerName}` : `🎯 P2 (KANAN): ${playerName}`}
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold font-mono-num px-2.5 py-0.5 rounded-lg bg-emerald-950 border border-emerald-500 text-emerald-300 uppercase shadow-sm">
                          Level 5: Penjaga Ekosistem
                        </span>
                      )}
                      <span className="text-[11px] font-mono-num font-bold text-emerald-300">
                        Tuntas: {completedZones.length}/{activeL5Deck.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      data-testid="btn-l5-close-dialog"
                      onClick={() => {
                        audioEngine.playClickWood();
                        setL5DialogOpen(false);
                      }}
                      className="btn-clay-slate border border-slate-700 hover:border-amber-400 px-2.5 py-0.5 rounded-xl text-[11px] font-bold text-slate-200 cursor-pointer shrink-0 whitespace-nowrap"
                    >
                      ✕ Tutup
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-800/80 pb-1.5 mb-2">
                    <div className="min-w-0 flex-1">
                      <span
                        data-testid="l5-project-header"
                        className="text-[11px] font-extrabold text-amber-400 uppercase block leading-snug"
                      >
                        {isSplitMode
                          ? `🌿 Pos #${activeL5StationIdx + 1} (${stationZoneNpc.npcName}) · ${currentZone.zoneName} — ${currentZone.crisisTitle}`
                          : `🌿 ${currentZone.npcName} · ${currentZone.zoneName} — ${currentZone.crisisTitle}`}
                      </span>
                      <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                        {isSplitMode && stationZoneNpc.id !== currentZone.id
                          ? `Pesan ${currentZone.npcName}: ${currentZone.crisisDescription}`
                          : currentZone.crisisDescription}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-mono-num font-bold shrink-0">
                      <span className="bg-amber-950/80 border border-amber-500/60 text-amber-300 px-2 py-0.5 rounded-xl">
                        🪙 {l5Coins} Koin
                      </span>
                      <span className="bg-sky-950/80 border border-sky-500/60 text-sky-300 px-2 py-0.5 rounded-xl">
                        ⚡ {l5Energy} Energi
                      </span>
                    </div>
                  </div>

                  {l5Phase === 'policy' ? (
                    <div className={`grid ${isSplitMode ? 'grid-cols-1 gap-1.5' : 'grid-cols-1 md:grid-cols-3 gap-2.5'}`}>
                      {activeL5Entry.alternatives.map((alt, dispIdx) => {
                        const isWrongFlash = wrongOptionFlash?.key === `l5-alt-${alt.code}`;
                        return (
                          <button
                            key={alt.code}
                            type="button"
                            data-testid={`l5-alt-code-${alt.code}`}
                            onClick={() => handleL5ChoosePolicy(alt.code)}
                            className={`border text-left flex flex-col justify-between cursor-pointer transition-all ${
                              isSplitMode ? 'p-2 rounded-xl' : 'p-2.5 rounded-2xl'
                            } ${
                              isWrongFlash
                                ? 'bg-amber-950/90 border-amber-400 ring-2 ring-amber-400/70'
                                : 'btn-clay-slate border-slate-700 hover:border-emerald-400'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between text-[11px] font-extrabold text-amber-400 mb-0.5">
                                <span>
                                  {isWrongFlash && <span className="text-amber-300 mr-1">💡 Cek dampaknya:</span>}
                                  {isSplitMode ? `PILIHAN ${dispIdx + 1}` : `OPSI ${alt.code}`}
                                </span>
                                <span className="font-mono-num text-[10px] text-slate-300">
                                  {alt.coinCost} Koin · {alt.energyCost} Energi
                                </span>
                              </div>
                              <p className={`${isSplitMode ? 'text-[11px]' : 'text-xs'} text-white leading-snug`}>{alt.text}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div
                        className={`bg-slate-900/90 border border-emerald-500/40 rounded-xl text-emerald-100 leading-snug ${
                          isSplitMode ? 'p-2 text-[11px]' : 'p-2.5 text-xs md:text-sm'
                        }`}
                      >
                        <strong className="text-emerald-300">🧮 Hitungan Koin Desa ({currentZone.zoneName}):</strong>{' '}
                        {currentZone.numeracyQuestion}
                      </div>
                      <div className={`grid ${isSplitMode ? 'grid-cols-1 gap-1.5' : 'grid-cols-1 md:grid-cols-3 gap-2'}`}>
                        {activeL5Entry.options.map((opt, idx) => {
                          const isGuideFlash = wrongOptionFlash?.key === `l5-opt-${idx}`;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleL5NumeracyOption(opt.isCorrect, idx)}
                              className={`border font-bold text-left text-white cursor-pointer leading-snug transition-all ${
                                isSplitMode ? 'p-2 rounded-xl text-[11px]' : 'p-2.5 rounded-2xl text-xs md:text-sm'
                              } ${
                                isGuideFlash
                                  ? 'bg-amber-950/90 border-amber-400 ring-2 ring-amber-400/70'
                                  : 'btn-clay-slate hover:border-emerald-400 border-slate-700'
                              }`}
                            >
                              {isGuideFlash && <span className="text-amber-300 font-black mr-1.5">💡 Cek lagi yuk:</span>}
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* LEVEL 6 DECK: RADAR NUSANTARA — Exploration -> Touch / Click / [E] on Menara Radar -> 3 Pillars + Numeracy */}
              {currentLevel === 6 && !l6DialogOpen && (
                <div
                  data-testid="l6-explore-prompt"
                  className="flex flex-col items-center gap-1.5 pb-1"
                >
                  {l6CelebratingNetwork ? (
                    <div
                      data-testid="l6-network-celebration"
                      className="bg-emerald-950/95 border-2 border-emerald-300 text-emerald-100 px-4 py-2.5 rounded-2xl text-xs md:text-sm font-extrabold shadow-[0_0_25px_rgba(52,211,153,0.55)] flex flex-wrap items-center justify-center gap-3"
                    >
                      <span>✨ Semua 5 Menara Terhubung Cahaya ke Pusat Nusantara!</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (l6CelebrationTimerRef.current) {
                            window.clearTimeout(l6CelebrationTimerRef.current);
                            l6CelebrationTimerRef.current = null;
                          }
                          setL6CelebratingNetwork(false);
                          onLevelComplete(6);
                        }}
                        className="btn-clay-emerald px-3 py-1 rounded-xl text-xs font-extrabold text-white cursor-pointer"
                      >
                        Lanjut ➔
                      </button>
                    </div>
                  ) : nearbyIslandIdx !== null && LEVEL_6_ISLANDS[nearbyIslandIdx] ? (
                    !completedIslands.includes(nearbyIslandIdx) ? (
                      <button
                        type="button"
                        data-testid="btn-l6-interact-e"
                        onClick={handleOpenNearbyIslandQuestion}
                        className="btn-clay-amber border-2 border-amber-200 px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2 text-slate-950 font-extrabold text-xs md:text-sm cursor-pointer animate-pulse"
                      >
                        <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg bg-slate-950 text-amber-300 font-mono-num text-xs font-black border border-amber-400">
                          {isSplitMode && playerSlot === 2 ? 'E / Enter' : 'E'}
                        </span>
                        <span>
                          Aktifkan Menara {LEVEL_6_ISLANDS[nearbyIslandIdx].islandName} (
                          {LEVEL_6_ISLANDS[nearbyIslandIdx].shortRegion}) — Buka Soal
                        </span>
                      </button>
                    ) : (
                      <div
                        data-testid="l6-tower-done-badge"
                        className="bg-emerald-950/95 border border-emerald-400 text-emerald-200 px-4 py-2 rounded-2xl text-xs font-bold shadow-lg"
                      >
                        🟢 Menara {LEVEL_6_ISLANDS[nearbyIslandIdx].islandName} (
                        {LEVEL_6_ISLANDS[nearbyIslandIdx].shortRegion}) sudah hijau zamrud (
                        {completedIslands.length}/{activeL6Deck.length}) — Jelajahi menara lain!
                      </div>
                    )
                  ) : (
                    <div
                      data-testid="l6-explore-hint"
                      className="bg-slate-950/88 border border-sky-500/50 text-slate-100 px-3.5 py-1.5 rounded-2xl text-[11px] md:text-xs font-semibold shadow-lg flex items-center gap-2"
                    >
                      <span>🗼</span>
                      <span>
                        Jelajahi 5 Menara Radar (
                        <strong>{isSplitMode && playerSlot === 2 ? 'Panah' : 'WASD'}</strong>) · Sentuh, klik menara, atau tekan{' '}
                        <strong className="text-amber-300">
                          [{isSplitMode && playerSlot === 2 ? 'Enter / E' : 'E'}]
                        </strong>
                      </span>
                      <span className="text-emerald-300 font-mono-num font-extrabold shrink-0 whitespace-nowrap">
                        · {completedIslands.length}/{activeL6Deck.length}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {currentLevel === 6 && l6DialogOpen && (
                <section
                  data-testid="level6-panel"
                  aria-label="Arena Level 6 Radar Nusantara"
                  className={`bg-slate-950 rounded-2xl shadow-xl border-2 border-sky-500/80 transition-all duration-300 max-md:w-full max-md:max-w-lg max-md:max-h-[88dvh] max-md:overflow-y-auto max-md:shadow-2xl ${
                    isSplitMode ? 'p-2.5' : 'p-3'
                  } ${panelFlashClasses}`}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      {isSplitMode ? (
                        <span
                          className={`text-[10px] font-extrabold font-mono-num px-2 py-0.5 rounded-lg border uppercase shadow-sm ${
                            playerSlot === 1
                              ? 'bg-emerald-950 border-emerald-400 text-emerald-300'
                              : 'bg-sky-950 border-sky-400 text-sky-300'
                          }`}
                        >
                          {playerSlot === 1 ? `🎯 P1 (KIRI): ${playerName}` : `🎯 P2 (KANAN): ${playerName}`}
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold font-mono-num px-2.5 py-0.5 rounded-lg bg-sky-950 border border-sky-500 text-sky-300 uppercase shadow-sm">
                          Level 6: Radar Nusantara
                        </span>
                      )}
                      <span className="text-[11px] font-mono-num font-bold text-emerald-300">
                        Hijau: {completedIslands.length}/{activeL6Deck.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      data-testid="btn-l6-close-dialog"
                      onClick={() => {
                        audioEngine.playClickWood();
                        setL6DialogOpen(false);
                      }}
                      className="btn-clay-slate border border-slate-700 hover:border-amber-400 px-2.5 py-0.5 rounded-xl text-[11px] font-bold text-slate-200 cursor-pointer shrink-0 whitespace-nowrap"
                    >
                      ✕ Tutup
                    </button>
                  </div>

                  {/* Active Menara Station Header + Region Detail + News Fact Link */}
                  <div
                    className={`bg-sky-950/55 border border-sky-500/45 rounded-xl text-slate-200 leading-snug ${
                      isSplitMode ? 'px-2 py-1 mb-1.5 text-[10px]' : 'px-2.5 py-1.5 mb-1.5 text-[11px]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1 mb-0.5">
                      <span
                        data-testid="l6-tower-header"
                        className="text-[11px] font-extrabold text-amber-300 uppercase tracking-wide leading-tight"
                      >
                        {isSplitMode && stationIslandSpec.id !== currentIsland.id
                          ? `🗼 Menara #${activeL6StationIdx + 1} (${stationIslandSpec.islandName}) · Misi: ${currentIsland.islandName}`
                          : `🗼 Menara #${activeL6StationIdx + 1}: ${currentIsland.islandName} · ${currentIsland.shortRegion}`}
                      </span>
                    </div>
                    <div className="text-slate-200">
                      <strong className="text-sky-200">Lokasi & Masalah:</strong> {currentIsland.regionTitle} —{' '}
                      {currentIsland.emergencyFact}
                    </div>
                    <div
                      data-testid="l6-news-fact-box"
                      className={`mt-1 bg-slate-900/95 border border-amber-400/60 rounded-lg flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 ${
                        isSplitMode ? 'px-1.5 py-1 text-[9.5px]' : 'px-2 py-1 text-[10.5px]'
                      }`}
                    >
                      <span className="font-extrabold text-amber-300 uppercase tracking-wide shrink-0">
                        📰 KLIK BERITA ONLINE :
                      </span>
                      <a
                        href={currentIsland.newsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="l6-news-link"
                        className="font-bold text-sky-300 hover:text-sky-200 underline underline-offset-2 break-all"
                      >
                        {currentIsland.newsHeadline} — {currentIsland.newsUrl} ↗
                      </a>
                    </div>
                  </div>

                  {l6Phase === 'pillars' ? (
                    <div className={isSplitMode ? 'space-y-1.5' : 'space-y-2'}>
                      <div className={`grid ${isSplitMode ? 'grid-cols-1 gap-1.5' : 'grid-cols-1 md:grid-cols-3 gap-2'}`}>
                        {activeL6Entry.pillarChoices.map((pillar, pIdx) => {
                          const selectedSlot = l6Pillars[pIdx];
                          return (
                            <div
                              key={pillar.pillarName}
                              className={`bg-slate-900/90 border border-slate-800 flex flex-col justify-between ${
                                isSplitMode ? 'rounded-xl p-1.5' : 'rounded-2xl p-2'
                              }`}
                            >
                              <div>
                                <div
                                  className={`font-extrabold text-amber-400 uppercase ${
                                    isSplitMode ? 'text-[10px] mb-1' : 'text-[11px] mb-1.5'
                                  }`}
                                >
                                  Pilar {pIdx + 1}: {pillar.pillarName}
                                </div>
                                <div className="space-y-1">
                                  {pillar.slots.map((s, sIdx) => (
                                    <button
                                      key={s.slotNum}
                                      type="button"
                                      onClick={() => {
                                        audioEngine.playClickWood();
                                        const next: [number, number, number] = [...l6Pillars] as [
                                          number,
                                          number,
                                          number
                                        ];
                                        next[pIdx] = s.slotNum;
                                        setL6Pillars(next);
                                      }}
                                      className={`w-full text-left border cursor-pointer ${
                                        isSplitMode
                                          ? 'px-2 py-1 rounded-lg text-[10px] leading-tight'
                                          : 'p-1.5 rounded-xl text-[11px] leading-snug'
                                      } ${
                                        selectedSlot === s.slotNum
                                          ? 'bg-emerald-950 border-emerald-400 text-emerald-200 font-bold'
                                          : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-600'
                                      }`}
                                    >
                                      <span className="font-mono-num text-amber-300 mr-1">
                                        {isSplitMode ? `[Opsi ${sIdx + 1}]` : `[Slot ${s.slotNum}]`}
                                      </span>
                                      {s.text}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <div className="text-[11px] font-mono-num text-slate-300">
                          Pilihan:{' '}
                          <strong className="text-amber-300">
                            {isSplitMode
                              ? [0, 1, 2]
                                  .map((pIdx) => {
                                    const pos = activeL6Entry.pillarChoices[pIdx].slots.findIndex(
                                      (s) => s.slotNum === l6Pillars[pIdx]
                                    );
                                    return pos >= 0 ? String(pos + 1) : '?';
                                  })
                                  .join('-')
                              : `${l6Pillars[0]}-${l6Pillars[1]}-${l6Pillars[2]}`}
                          </strong>
                        </div>
                        <button
                          type="button"
                          onClick={handleL6VerifyMasterplan}
                          className={`btn-clay-emerald font-extrabold text-white cursor-pointer ${
                            isSplitMode ? 'px-3 py-1.5 rounded-xl text-[11px]' : 'px-4 py-1.5 rounded-2xl text-xs'
                          }`}
                        >
                          🛰️ Aktifkan Masterplan
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div
                        className={`bg-slate-900/90 border border-sky-500/40 rounded-xl text-sky-100 leading-snug ${
                          isSplitMode ? 'p-2 text-[11px]' : 'p-2.5 text-xs md:text-sm'
                        }`}
                      >
                        <strong className="text-sky-300">🧮 Hitungan Dampak ({currentIsland.islandName} — {currentIsland.shortRegion}):</strong>{' '}
                        {currentIsland.numeracyQuestion}
                      </div>
                      <div className={`grid ${isSplitMode ? 'grid-cols-1 gap-1.5' : 'grid-cols-1 md:grid-cols-3 gap-2'}`}>
                        {activeL6Entry.options.map((opt, idx) => {
                          const isGuideFlash = wrongOptionFlash?.key === `l6-opt-${idx}`;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleL6NumeracyOption(opt.isCorrect, idx)}
                              className={`border font-bold text-left text-white cursor-pointer leading-snug transition-all ${
                                isSplitMode ? 'p-2 rounded-xl text-[11px]' : 'p-2.5 rounded-2xl text-xs md:text-sm'
                              } ${
                                isGuideFlash
                                  ? 'bg-amber-950/90 border-amber-400 ring-2 ring-amber-400/70'
                                  : 'btn-clay-slate hover:border-emerald-400 border-slate-700'
                              }`}
                            >
                              {isGuideFlash && <span className="text-amber-300 font-black mr-1.5">💡 Cek lagi yuk:</span>}
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>
              )}
        </div>
      </div>
    </div>
  );
};
