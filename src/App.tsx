import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  GAME_IDENTITY,
  LEVEL_METADATA,
  LEVEL_4_CITIZENS,
  LEVEL_5_ZONES,
  PROLOGUE_BABAK,
  getRemedialEmpathyText,
} from './game/blueprintData';
import {
  validateAndSanitizePlayerName,
  validateDualPlayerNames,
  calculateTotalScore,
  calculateDualGauges,
  LevelScoreMap,
  DifficultyLevel,
  Level1DeckItem,
  Level2DeckItem,
  Level3DeckItem,
  Level4DeckItem,
  Level5DeckItem,
  Level6DeckItem,
  createLevel1SplitDecks,
  createLevel2SplitDecks,
  createLevel3SplitDecks,
  createLevel4SplitDecks,
  createLevel5SplitDecks,
  createLevel6SplitDecks,
  createLevel4NpcPositions,
  createLevel5NpcPositions,
  formatRoomDisplay,
  getDifficultyConfig,
  LEVEL_6_TOWER_POSITIONS,
} from './game/rules';
import { LEVEL_6_ISLANDS } from './game/blueprintData';
import { audioEngine, NarratorPersona } from './game/audioEngine';
import { webrtcEngine, PeerPlayerState } from './game/webrtcP2P';
import { World3DCanvas, Level2VisualState } from './components/World3DCanvas';
import { OfficialLogoBadge, NusantaraCrestSvg } from './components/OfficialLogos';
import { TopHudHeader } from './components/TopHudHeader';
import { DualPlayerSharedHeader, PersonalPlayerHudStrip } from './components/DualPlayerHud';
import { TouchJoystickControls } from './components/TouchJoystickControls';
import { LevelsArenaView } from './components/LevelsArenaView';
import { ResultPiagamView } from './components/ResultPiagamView';
import {
  AnswerEvaluationInput,
  AnswerEvaluationRecord,
  upsertEvaluationRecord,
} from './game/evaluationLog';
import {
  syncProgressCheckpoint,
  SubmitLeaderboardPayload,
} from './game/leaderboardService';

type PageState = 'splash' | 'setup' | 'arena' | 'result';

function createNewSessionId(): string {
  return `PBN-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export default function App() {
  // Check ?autostart=1 for automated testing / direct arena entry
  const isAutostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [page, setPage] = useState<PageState>(isAutostart ? 'arena' : 'splash');
  const [sessionId, setSessionId] = useState<string>(() => createNewSessionId());
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [howToPlayModalOpen, setHowToPlayModalOpen] = useState(false);
  const [learningGoalsModalOpen, setLearningGoalsModalOpen] = useState(false);

  // Player Profile & Settings (Halaman 2)
  const [rawNameInput, setRawNameInput] = useState(isAutostart ? 'Bachtiar' : '');
  const [rawName2Input, setRawName2Input] = useState(isAutostart ? 'Fatimah' : '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [name2Error, setName2Error] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('Penjaga Cilik');
  const [schoolName, setSchoolName] = useState('SDN 2 GIRIMARTO');
  const [studentClass, setStudentClass] = useState<'Kelas V (Fase C)' | 'Kelas VI (Fase C)'>(
    'Kelas V (Fase C)'
  );
  const [avatarGender, setAvatarGender] = useState<'male' | 'female'>('male');
  const [avatar2Gender, setAvatar2Gender] = useState<'male' | 'female'>('female');
  const [avatarCostume, setAvatarCostume] = useState<'batik' | 'pramuka' | 'rompi'>('rompi');
  const [persona, setPersona] = useState<NarratorPersona>('rahma');
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [gameMode, setGameMode] = useState<'solo' | 'split' | 'webrtc'>('solo');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('sedang');

  // WebRTC P2P Classroom state
  const [roomCodeInput, setRoomCodeInput] = useState('BUMI-5A');
  const [activeRoomCode, setActiveRoomCode] = useState('BUMI-5A');
  const [webrtcStatus, setWebrtcStatus] = useState('Siap (Mode Kelas / Lokal)');
  const [peersMap, setPeersMap] = useState<Record<string, PeerPlayerState>>({});
  const [roomModalOpen, setRoomModalOpen] = useState(false);

  // Arena Gameplay State (Halaman 3)
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [p2CurrentLevel, setP2CurrentLevel] = useState<number>(1);
  const [level1IntroPhase, setLevel1IntroPhase] = useState<'looking' | 'narration' | 'core_game'>(
    'looking'
  );
  const [lookingSecondsLeft, setLookingSecondsLeft] = useState<number>(12);
  const [narrationSecondsLeft, setNarrationSecondsLeft] = useState<number>(30);
  const [l1IntroTrigger, setL1IntroTrigger] = useState<number>(0);
  const [completedLevels, setCompletedLevels] = useState<number[]>([]);
  const [prologueActive, setPrologueActive] = useState<boolean>(false);
  const [prologueStage, setPrologueStage] = useState<number>(1);
  const [roadmapActive, setRoadmapActive] = useState<boolean>(false);
  const [journalModalLevel, setJournalModalLevel] = useState<number | null>(null);
  const [reflectionModalLevel, setReflectionModalLevel] = useState<number | null>(null);
  const [remedialActive, setRemedialActive] = useState<boolean>(false);
  const [p2RemedialActive, setP2RemedialActive] = useState<boolean>(false);
  const [paused, setPaused] = useState<boolean>(false);
  const [missionMapOpen, setMissionMapOpen] = useState<boolean>(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Lives (3 Monstera Leaves), Scores (C1-C6), Timers, Camera Shake
  const [lives, setLives] = useState<number>(3);
  const [leafShaking, setLeafShaking] = useState<boolean>(false);
  const [scores, setScores] = useState<LevelScoreMap>({
    c1: 0,
    c2: 0,
    c3: 0,
    c4: 0,
    c5: 0,
    c6: 0,
  });
  // Player 2 State for Mode 2P Split Screen
  const [player2Name, setPlayer2Name] = useState<string>('Pemain 2');
  const [p2Lives, setP2Lives] = useState<number>(3);
  const [p2LeafShaking, setP2LeafShaking] = useState<boolean>(false);
  const [p2Scores, setP2Scores] = useState<LevelScoreMap>({
    c1: 0,
    c2: 0,
    c3: 0,
    c4: 0,
    c5: 0,
    c6: 0,
  });
  const [evaluationLog, setEvaluationLog] = useState<AnswerEvaluationRecord[]>([]);
  const [p2EvaluationLog, setP2EvaluationLog] = useState<AnswerEvaluationRecord[]>([]);
  const [lastMistakeNote, setLastMistakeNote] = useState<string | null>(null);
  const [p2LastMistakeNote, setP2LastMistakeNote] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(15);
  const [maxTime, setMaxTime] = useState<number>(15);
  const [readingGraceLeft, setReadingGraceLeft] = useState<number>(6);
  const [p2TimeLeft, setP2TimeLeft] = useState<number>(15);
  const [p2MaxTime, setP2MaxTime] = useState<number>(15);
  const [p2ReadingGraceLeft, setP2ReadingGraceLeft] = useState<number>(6);
  const [cameraShakeTrigger, setCameraShakeTrigger] = useState<number>(0);
  const [p2CameraShakeTrigger, setP2CameraShakeTrigger] = useState<number>(0);
  const [redFlashActive, setRedFlashActive] = useState<boolean>(false);
  const [greenFlashActive, setGreenFlashActive] = useState<boolean>(false);
  const [p1SplitFlash, setP1SplitFlash] = useState<'ok' | 'err' | null>(null);
  const [p2SplitFlash, setP2SplitFlash] = useState<'ok' | 'err' | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const p1FlashTimerRef = useRef<number | null>(null);
  const p2FlashTimerRef = useRef<number | null>(null);

  // Sub-level tracking for 3D World & MiniMap (Independent per player in 2P)
  const [clawState, setClawState] = useState<{
    x: number;
    grabbing: boolean;
    itemIndex: number;
    phase: 'claw' | 'numeracy';
  }>({
    x: 0,
    grabbing: false,
    itemIndex: 0,
    phase: 'claw',
  });
  const [p2ClawState, setP2ClawState] = useState<{
    x: number;
    grabbing: boolean;
    itemIndex: number;
    phase: 'claw' | 'numeracy';
  }>({
    x: 0,
    grabbing: false,
    itemIndex: 1,
    phase: 'claw',
  });
  const [nearbyCitizenIdx, setNearbyCitizenIdx] = useState<number | null>(null);
  const [p2NearbyCitizenIdx, setP2NearbyCitizenIdx] = useState<number | null>(null);
  const [l4InteractTick, setL4InteractTick] = useState<number>(0);
  const [p2L4InteractTick, setP2L4InteractTick] = useState<number>(0);
  const [l4DirectOpen, setL4DirectOpen] = useState<{ citizenIdx: number; tick: number } | null>(null);
  const [p2L4DirectOpen, setP2L4DirectOpen] = useState<{ citizenIdx: number; tick: number } | null>(null);
  const [nearbyZoneIdx, setNearbyZoneIdx] = useState<number | null>(null);
  const [p2NearbyZoneIdx, setP2NearbyZoneIdx] = useState<number | null>(null);
  const [l5InteractTick, setL5InteractTick] = useState<number>(0);
  const [p2L5InteractTick, setP2L5InteractTick] = useState<number>(0);
  const [l5DirectOpen, setL5DirectOpen] = useState<{ zoneIdx: number; tick: number } | null>(null);
  const [p2L5DirectOpen, setP2L5DirectOpen] = useState<{ zoneIdx: number; tick: number } | null>(null);
  const [nearbyIslandIdx, setNearbyIslandIdx] = useState<number | null>(null);
  const [p2NearbyIslandIdx, setP2NearbyIslandIdx] = useState<number | null>(null);
  const [l6InteractTick, setL6InteractTick] = useState<number>(0);
  const [p2L6InteractTick, setP2L6InteractTick] = useState<number>(0);
  const [l6DirectOpen, setL6DirectOpen] = useState<{ islandIdx: number; tick: number } | null>(null);
  const [p2L6DirectOpen, setP2L6DirectOpen] = useState<{ islandIdx: number; tick: number } | null>(null);
  const [l6TouchOpen, setL6TouchOpen] = useState<{ islandIdx: number; tick: number } | null>(null);
  const [p2L6TouchOpen, setP2L6TouchOpen] = useState<{ islandIdx: number; tick: number } | null>(null);
  const [completedCitizens, setCompletedCitizens] = useState<number[]>([]);
  const [completedZones, setCompletedZones] = useState<number[]>([]);
  const [completedIslands, setCompletedIslands] = useState<number[]>([]);
  const [p2CompletedCitizens, setP2CompletedCitizens] = useState<number[]>([]);
  const [p2CompletedZones, setP2CompletedZones] = useState<number[]>([]);
  const [p2CompletedIslands, setP2CompletedIslands] = useState<number[]>([]);
  const [level2Visual, setLevel2Visual] = useState<Level2VisualState>({
    assembledLetters: [],
    targetLength: 6,
    targetWord: 'KOMPOS',
    phase: 'anagram',
  });
  const [p2Level2Visual, setP2Level2Visual] = useState<Level2VisualState>({
    assembledLetters: [],
    targetLength: 6,
    targetWord: 'REDUCE',
    phase: 'anagram',
  });
  const [p1DialogOpen, setP1DialogOpen] = useState<boolean>(false);
  const [p2DialogOpen, setP2DialogOpen] = useState<boolean>(false);
  const [level1Decks, setLevel1Decks] = useState<{ p1: Level1DeckItem[]; p2: Level1DeckItem[] }>(
    () => createLevel1SplitDecks()
  );
  const [level2Decks, setLevel2Decks] = useState<{ p1: Level2DeckItem[]; p2: Level2DeckItem[] }>(
    () => createLevel2SplitDecks()
  );
  const [level3Decks, setLevel3Decks] = useState<{ p1: Level3DeckItem[]; p2: Level3DeckItem[] }>(
    () => createLevel3SplitDecks()
  );
  const [level4Decks, setLevel4Decks] = useState<{ p1: Level4DeckItem[]; p2: Level4DeckItem[] }>(
    () => createLevel4SplitDecks()
  );
  const [level5Decks, setLevel5Decks] = useState<{ p1: Level5DeckItem[]; p2: Level5DeckItem[] }>(
    () => createLevel5SplitDecks()
  );
  const [level6Decks, setLevel6Decks] = useState<{ p1: Level6DeckItem[]; p2: Level6DeckItem[] }>(
    () => createLevel6SplitDecks()
  );
  const [l4NpcPositions, setL4NpcPositions] = useState<[number, number][]>(() =>
    createLevel4NpcPositions()
  );
  const [l5NpcPositions, setL5NpcPositions] = useState<[number, number][]>(() =>
    createLevel5NpcPositions()
  );

  // Player 3D Position & Movement Ref (Decoupled from 60Hz React renders)
  const playerPosRef = useRef({
    x: -1.8,
    z: 3.6,
    rotY: 0,
    moving: false,
    jumping: false,
  });
  const player2PosRef = useRef({
    x: 1.8,
    z: 3.6,
    rotY: 0,
    moving: false,
    jumping: false,
  });
  const p1JumpTimerRef = useRef<number | null>(null);
  const p2JumpTimerRef = useRef<number | null>(null);
  const webrtcMoveStampRef = useRef<number>(0);
  const worldPaneP1Ref = useRef<HTMLDivElement | null>(null);
  const worldPaneP2Ref = useRef<HTMLDivElement | null>(null);
  const arena1pRef = useRef<HTMLDivElement | null>(null);

  const syncDomPlayerAttrs = useCallback((slot: 1 | 2) => {
    if (slot === 1) {
      const p1 = playerPosRef.current;
      const targets = [worldPaneP1Ref.current, arena1pRef.current];
      for (const el of targets) {
        if (el) {
          el.dataset.playerX = p1.x.toFixed(2);
          el.dataset.playerZ = p1.z.toFixed(2);
          el.dataset.playerJumping = p1.jumping ? '1' : '0';
        }
      }
    } else {
      const p2 = player2PosRef.current;
      const el = worldPaneP2Ref.current;
      if (el) {
        el.dataset.playerX = p2.x.toFixed(2);
        el.dataset.playerZ = p2.z.toFixed(2);
        el.dataset.playerJumping = p2.jumping ? '1' : '0';
      }
    }
  }, []);

  // Sync body[data-state] for testing & Game Shell contract
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (page === 'splash' || page === 'setup') {
      document.body.dataset.state = 'title';
    } else if (page === 'arena') {
      if (paused) {
        document.body.dataset.state = 'paused';
      } else if (remedialActive) {
        document.body.dataset.state = 'gameover';
      } else {
        document.body.dataset.state = 'playing';
      }
    } else if (page === 'result') {
      document.body.dataset.state = 'gameover';
    }
  }, [page, paused, remedialActive]);

  // Register WebRTC peer updates
  useEffect(() => {
    webrtcEngine.setOnUpdate((map) => setPeersMap(map));
    return () => webrtcEngine.setOnUpdate(null);
  }, []);

  // Opening music lifecycle: active on splash & setup screens, stopped in arena & result
  useEffect(() => {
    if (page === 'splash' || page === 'setup') {
      audioEngine.startOpeningMusic();
      if (page === 'setup') {
        audioEngine.preloadPrologueMusic();
      }
    } else {
      audioEngine.stopOpeningMusic(true);
    }
  }, [page]);

  // Sinematik Prolog music lifecycle: active during Sinematik Prolog (Babak 1-3), paused on Pause, stopped when leaving/skipping prologue
  useEffect(() => {
    const isPrologueMusicActive = page === 'arena' && prologueActive && !paused;
    if (isPrologueMusicActive) {
      audioEngine.startPrologueMusic();
    } else {
      audioEngine.stopPrologueMusic(!paused);
    }
  }, [page, prologueActive, paused]);

  // Inter-game transition music lifecycle: active during reflection, journal radio, roadmap, and pre-level intro phases (after prologue)
  useEffect(() => {
    const isInterGameTransition =
      page === 'arena' &&
      !paused &&
      !prologueActive &&
      !remedialActive &&
      !p2RemedialActive &&
      (roadmapActive ||
        reflectionModalLevel !== null ||
        journalModalLevel !== null ||
        level1IntroPhase !== 'core_game');

    if (isInterGameTransition) {
      audioEngine.startTransitionMusic();
    } else {
      audioEngine.stopTransitionMusic(true);
    }
  }, [
    page,
    paused,
    remedialActive,
    p2RemedialActive,
    prologueActive,
    roadmapActive,
    reflectionModalLevel,
    journalModalLevel,
    level1IntroPhase,
  ]);

  // Gameplay level music lifecycle: active for Levels 1-6 during core gameplay, stopped on transitions/pause/remedial/result
  useEffect(() => {
    const isCoreArena =
      page === 'arena' &&
      !paused &&
      !prologueActive &&
      !roadmapActive &&
      reflectionModalLevel === null &&
      journalModalLevel === null &&
      level1IntroPhase === 'core_game';

    const candidates: number[] = [];
    if (isCoreArena) {
      if (!remedialActive) candidates.push(currentLevel);
      if (gameMode === 'split' && !p2RemedialActive) candidates.push(p2CurrentLevel);
    }

    const supportedCandidates = candidates.filter((lv) => audioEngine.hasLevelMusicTrack(lv));
    const activeTrackLevel =
      supportedCandidates.length > 0 ? Math.max(...supportedCandidates) : null;

    if (activeTrackLevel !== null) {
      audioEngine.startLevelMusic(activeTrackLevel);
    } else {
      audioEngine.stopLevelMusic(true);
    }
  }, [
    page,
    paused,
    prologueActive,
    roadmapActive,
    reflectionModalLevel,
    journalModalLevel,
    level1IntroPhase,
    currentLevel,
    p2CurrentLevel,
    gameMode,
    remedialActive,
    p2RemedialActive,
  ]);

  useEffect(() => {
    return () => {
      audioEngine.stopOpeningMusic(true);
      audioEngine.stopPrologueMusic(true);
      audioEngine.stopTransitionMusic(true);
      audioEngine.stopLevelMusic(true);
    };
  }, []);

  // Position Player 1 beside the 3D study table in 1P Level 2 so avatar doesn't occlude the 3D letters
  useEffect(() => {
    if (
      page === 'arena' &&
      currentLevel === 2 &&
      gameMode !== 'split' &&
      level1IntroPhase === 'core_game' &&
      !prologueActive &&
      !roadmapActive
    ) {
      playerPosRef.current = {
        x: -2.05,
        z: -0.15,
        rotY: 2.05,
        moving: false,
        jumping: false,
      };
    }
  }, [page, currentLevel, gameMode, level1IntroPhase, prologueActive, roadmapActive]);

  // State Teardown Engine: cleanupCurrentLevel() (Section VI.3)
  const cleanupCurrentLevel = useCallback(() => {
    audioEngine.stopSpeech();
    if (p1JumpTimerRef.current) {
      window.clearTimeout(p1JumpTimerRef.current);
      p1JumpTimerRef.current = null;
    }
    if (p2JumpTimerRef.current) {
      window.clearTimeout(p2JumpTimerRef.current);
      p2JumpTimerRef.current = null;
    }
    playerPosRef.current.moving = false;
    playerPosRef.current.jumping = false;
    player2PosRef.current.moving = false;
    player2PosRef.current.jumping = false;
    setPaused(false);
    setRemedialActive(false);
    setP2RemedialActive(false);
    setJournalModalLevel(null);
    setReflectionModalLevel(null);
  }, []);

  const handleRecordEvaluation = useCallback((entry: AnswerEvaluationInput) => {
    setEvaluationLog((prev) => upsertEvaluationRecord(prev, entry));
  }, []);

  const handleP2RecordEvaluation = useCallback((entry: AnswerEvaluationInput) => {
    setP2EvaluationLog((prev) => upsertEvaluationRecord(prev, entry));
  }, []);

  // Lose 1 Monstera Tolerance Leaf (Player 1)
  const handleLoseLife = useCallback(
    (reason: string) => {
      if (reason) setLastMistakeNote(reason);
      audioEngine.playLeafLost();
      setCameraShakeTrigger((c) => c + 1);
      setLeafShaking(true);
      if (gameMode === 'split') {
        if (p1FlashTimerRef.current) window.clearTimeout(p1FlashTimerRef.current);
        setP1SplitFlash('err');
        p1FlashTimerRef.current = window.setTimeout(() => {
          setP1SplitFlash(null);
          p1FlashTimerRef.current = null;
        }, 300);
      } else {
        setRedFlashActive(true);
        window.setTimeout(() => setRedFlashActive(false), 260);
      }
      window.setTimeout(() => setLeafShaking(false), 500);

      setLives((prev) => {
        const next = Math.max(0, prev - 1);
        if (next === 0) {
          setRemedialActive(true);
          audioEngine.speak(getRemedialEmpathyText(playerName));
        }
        return next;
      });
    },
    [playerName, gameMode]
  );

  // Life Loss Handler for Player 2 (Mode 2P — strictly isolated to Right Screen)
  const handleP2LoseLife = useCallback(
    (reason: string) => {
      if (reason) setP2LastMistakeNote(reason);
      audioEngine.playLeafLost();
      setP2CameraShakeTrigger((c) => c + 1);
      setP2LeafShaking(true);
      if (p2FlashTimerRef.current) window.clearTimeout(p2FlashTimerRef.current);
      setP2SplitFlash('err');
      p2FlashTimerRef.current = window.setTimeout(() => {
        setP2SplitFlash(null);
        p2FlashTimerRef.current = null;
      }, 300);
      window.setTimeout(() => setP2LeafShaking(false), 600);

      setP2Lives((l) => {
        const next = Math.max(0, l - 1);
        if (next === 0) {
          setP2RemedialActive(true);
          audioEngine.speak(getRemedialEmpathyText(player2Name));
        }
        return next;
      });
    },
    [player2Name]
  );

  // Pre-Level 3-Stage Intro Init (Applies to ALL 6 Levels: Level 1, 2, 3, 4, 5, dan 6):
  // In 2P Split Mode, only triggers when both players start together (l1IntroTrigger),
  // never when one player independently advances to the next level mid-game.
  const effectiveIntroLevelDep = gameMode === 'split' ? 0 : currentLevel;
  useEffect(() => {
    if (
      page !== 'arena' ||
      prologueActive ||
      roadmapActive ||
      journalModalLevel !== null ||
      reflectionModalLevel !== null
    ) {
      return;
    }
    const isPhoneLv2Or3 =
      (currentLevel === 2 || currentLevel === 3) &&
      typeof window !== 'undefined' &&
      window.innerWidth < 768;
    setLevel1IntroPhase(isPhoneLv2Or3 ? 'core_game' : 'looking');
    setLookingSecondsLeft(12);
    setNarrationSecondsLeft(30);
  }, [
    page,
    effectiveIntroLevelDep,
    prologueActive,
    roadmapActive,
    journalModalLevel,
    reflectionModalLevel,
    l1IntroTrigger,
  ]);

  // Countdown Timer for Step 1 ('looking': 0,2 Menit / 12 Detik) -> Step 2 ('narration': 0,5 Menit / 30 Detik) -> Step 3 ('core_game')
  useEffect(() => {
    if (
      page !== 'arena' ||
      prologueActive ||
      roadmapActive ||
      level1IntroPhase === 'core_game' ||
      paused ||
      missionMapOpen ||
      logoutConfirmOpen ||
      roomModalOpen ||
      journalModalLevel !== null ||
      reflectionModalLevel !== null
    ) {
      return;
    }

    const tick = window.setInterval(() => {
      if (level1IntroPhase === 'looking') {
        setLookingSecondsLeft((prev) => Math.max(0, prev - 1));
      } else {
        setNarrationSecondsLeft((prev) => Math.max(0, prev - 1));
      }
    }, 1000);

    return () => window.clearInterval(tick);
  }, [
    page,
    prologueActive,
    roadmapActive,
    level1IntroPhase,
    paused,
    missionMapOpen,
    logoutConfirmOpen,
    roomModalOpen,
    journalModalLevel,
    reflectionModalLevel,
  ]);

  useEffect(() => {
    if (
      page !== 'arena' ||
      prologueActive ||
      roadmapActive ||
      journalModalLevel !== null ||
      reflectionModalLevel !== null
    ) {
      return;
    }
    if (level1IntroPhase === 'looking' && lookingSecondsLeft <= 0) {
      setLevel1IntroPhase('narration');
      setNarrationSecondsLeft(30);
    } else if (level1IntroPhase === 'narration' && narrationSecondsLeft <= 0) {
      audioEngine.stopSpeech();
      setLevel1IntroPhase('core_game');
    }
  }, [
    page,
    prologueActive,
    roadmapActive,
    journalModalLevel,
    reflectionModalLevel,
    level1IntroPhase,
    lookingSecondsLeft,
    narrationSecondsLeft,
  ]);

  // Active Level Countdown Timer with Smart Reading & Audio Freeze (P1 & P2 Individual Timers)
  useEffect(() => {
    if (
      page !== 'arena' ||
      prologueActive ||
      roadmapActive ||
      level1IntroPhase !== 'core_game' ||
      paused ||
      missionMapOpen ||
      logoutConfirmOpen ||
      roomModalOpen ||
      journalModalLevel !== null ||
      reflectionModalLevel !== null
    ) {
      return;
    }

    const diffCfg = getDifficultyConfig(difficulty);
    if (diffCfg.untimed) {
      return;
    }

    const timer = window.setInterval(() => {
      if (document.hidden) return;

      // Player 1 Timer (only ticks if P1 is not in remedial)
      if (!remedialActive) {
        setReadingGraceLeft((gracePrev) => {
          if (gracePrev > 0) {
            return Math.max(0, Number((gracePrev - 0.2).toFixed(1)));
          }
          if (audioEngine.isSpeaking()) {
            return 0.4;
          }
          return 0;
        });

        setTimeLeft((prev) => {
          if (readingGraceLeft > 0 || audioEngine.isSpeaking()) {
            return prev;
          }
          if (prev <= 0.2) {
            queueMicrotask(() => {
              handleLoseLife('Waktu habis! Ayo baca dengan tenang dan coba lagi.');
              setReadingGraceLeft(4);
            });
            return maxTime;
          }
          return Number((prev - 0.2).toFixed(1));
        });
      }

      // Player 2 Individual Timer in 2P Split Mode
      if (gameMode === 'split' && !p2RemedialActive) {
        setP2ReadingGraceLeft((gracePrev) => {
          if (gracePrev > 0) {
            return Math.max(0, Number((gracePrev - 0.2).toFixed(1)));
          }
          if (audioEngine.isSpeaking()) {
            return 0.4;
          }
          return 0;
        });

        setP2TimeLeft((prev) => {
          if (p2ReadingGraceLeft > 0 || audioEngine.isSpeaking()) {
            return prev;
          }
          if (prev <= 0.2) {
            queueMicrotask(() => {
              handleP2LoseLife('Waktu Pemain 2 habis! Ayo baca dengan tenang dan coba lagi.');
              setP2ReadingGraceLeft(4);
            });
            return p2MaxTime;
          }
          return Number((prev - 0.2).toFixed(1));
        });
      }
    }, 200);

    return () => window.clearInterval(timer);
  }, [
    page,
    prologueActive,
    paused,
    remedialActive,
    p2RemedialActive,
    missionMapOpen,
    logoutConfirmOpen,
    roomModalOpen,
    journalModalLevel,
    reflectionModalLevel,
    difficulty,
    gameMode,
    readingGraceLeft,
    maxTime,
    p2ReadingGraceLeft,
    p2MaxTime,
    currentLevel,
    level1IntroPhase,
    handleLoseLife,
    handleP2LoseLife,
  ]);

  // Keyboard Controls (WASD / Arrows / Space / E / Escape / Enter)
  useEffect(() => {
    const keys = new Set<string>();

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (page === 'splash' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        audioEngine.playClickWood();
        setPage('setup');
        return;
      }

      if (page !== 'arena') return;

      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setPaused((p) => !p);
        return;
      }

      keys.add(e.key.toLowerCase());

      if (e.key === ' ') {
        e.preventDefault();
        if (!playerPosRef.current.jumping) {
          playerPosRef.current.jumping = true;
          audioEngine.playJump();
          window.setTimeout(() => {
            playerPosRef.current.jumping = false;
            audioEngine.playLand();
          }, 420);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
      if (gameMode === 'split') {
        if (!keys.has('w') && !keys.has('s') && !keys.has('a') && !keys.has('d')) {
          playerPosRef.current.moving = false;
        }
        if (!keys.has('arrowup') && !keys.has('arrowdown') && !keys.has('arrowleft') && !keys.has('arrowright')) {
          player2PosRef.current.moving = false;
        }
      } else if (keys.size === 0) {
        playerPosRef.current.moving = false;
      }
    };

    const onBlur = () => {
      keys.clear();
      playerPosRef.current.moving = false;
      player2PosRef.current.moving = false;
    };

    const moveInterval = window.setInterval(() => {
      if (page !== 'arena' || paused || prologueActive || keys.size === 0) return;

      if (gameMode === 'split') {
        // Player 1: WASD (aktif di semua level 1–6 agar pemain selalu leluasa bergerak)
        let p1dx = 0;
        let p1dz = 0;
        if (keys.has('w')) p1dz -= 0.45;
        if (keys.has('s')) p1dz += 0.45;
        if (keys.has('a')) p1dx -= 0.45;
        if (keys.has('d')) p1dx += 0.45;

        if (p1dx !== 0 || p1dz !== 0) {
          playerPosRef.current.x = Math.max(-22, Math.min(22, playerPosRef.current.x + p1dx));
          playerPosRef.current.z = Math.max(-22, Math.min(22, playerPosRef.current.z + p1dz));
          playerPosRef.current.rotY = Math.atan2(p1dx, p1dz);
          playerPosRef.current.moving = true;
          syncDomPlayerAttrs(1);
        } else {
          playerPosRef.current.moving = false;
        }

        // Player 2: Arrow Keys (aktif di semua level 1–6 agar pemain selalu leluasa bergerak)
        let p2dx = 0;
        let p2dz = 0;
        if (keys.has('arrowup')) p2dz -= 0.45;
        if (keys.has('arrowdown')) p2dz += 0.45;
        if (keys.has('arrowleft')) p2dx -= 0.45;
        if (keys.has('arrowright')) p2dx += 0.45;

        if (p2dx !== 0 || p2dz !== 0) {
          player2PosRef.current.x = Math.max(-22, Math.min(22, player2PosRef.current.x + p2dx));
          player2PosRef.current.z = Math.max(-22, Math.min(22, player2PosRef.current.z + p2dz));
          player2PosRef.current.rotY = Math.atan2(p2dx, p2dz);
          player2PosRef.current.moving = true;
          syncDomPlayerAttrs(2);
        } else {
          player2PosRef.current.moving = false;
        }
      } else {
        // Solo & WebRTC mode: WASD or Arrow Keys move Player 1 (Level 1 & 2 tidak membutuhkan pergerakan karakter Blocky)
        if (currentLevel === 1 || currentLevel === 2) {
          playerPosRef.current.moving = false;
          return;
        }
        let dx = 0;
        let dz = 0;
        if (keys.has('w') || keys.has('arrowup')) dz -= 0.45;
        if (keys.has('s') || keys.has('arrowdown')) dz += 0.45;
        if (keys.has('a') || keys.has('arrowleft')) dx -= 0.45;
        if (keys.has('d') || keys.has('arrowright')) dx += 0.45;

        if (dx !== 0 || dz !== 0) {
          playerPosRef.current.x = Math.max(-22, Math.min(22, playerPosRef.current.x + dx));
          playerPosRef.current.z = Math.max(-22, Math.min(22, playerPosRef.current.z + dz));
          playerPosRef.current.rotY = Math.atan2(dx, dz);
          playerPosRef.current.moving = true;

          if (gameMode === 'webrtc') {
            webrtcEngine.sendMyState({
              name: playerName,
              x: playerPosRef.current.x,
              y: 0,
              z: playerPosRef.current.z,
              rotY: playerPosRef.current.rotY,
              anim: 'walk',
              score: calculateTotalScore(scores),
              level: currentLevel,
            });
          }
        } else {
          playerPosRef.current.moving = false;
        }
      }
    }, 50);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.clearInterval(moveInterval);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [page, paused, prologueActive, gameMode, playerName, scores, currentLevel, p2CurrentLevel]);

  // Dedicated Level 4 [E] / [Enter] NPC interaction key listener (keeps WASD movement keys intact)
  useEffect(() => {
    const onInteractKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (
        e.repeat ||
        page !== 'arena' ||
        paused ||
        prologueActive ||
        roadmapActive ||
        level1IntroPhase !== 'core_game' ||
        journalModalLevel !== null ||
        reflectionModalLevel !== null
      ) {
        return;
      }

      const keyLower = e.key.toLowerCase();
      if (keyLower === 'e') {
        if (gameMode === 'split') {
          if (currentLevel === 4 && nearbyCitizenIdx !== null) {
            e.preventDefault();
            setL4InteractTick((t) => t + 1);
          } else if (currentLevel === 5 && nearbyZoneIdx !== null) {
            e.preventDefault();
            setL5InteractTick((t) => t + 1);
          } else if (currentLevel === 6 && nearbyIslandIdx !== null) {
            e.preventDefault();
            setL6InteractTick((t) => t + 1);
          } else if (p2CurrentLevel === 4 && p2NearbyCitizenIdx !== null) {
            e.preventDefault();
            setP2L4InteractTick((t) => t + 1);
          } else if (p2CurrentLevel === 5 && p2NearbyZoneIdx !== null) {
            e.preventDefault();
            setP2L5InteractTick((t) => t + 1);
          } else if (p2CurrentLevel === 6 && p2NearbyIslandIdx !== null) {
            e.preventDefault();
            setP2L6InteractTick((t) => t + 1);
          } else if (currentLevel === 4) {
            e.preventDefault();
            setL4InteractTick((t) => t + 1);
          } else if (currentLevel === 5) {
            e.preventDefault();
            setL5InteractTick((t) => t + 1);
          } else if (currentLevel === 6) {
            e.preventDefault();
            setL6InteractTick((t) => t + 1);
          }
        } else if (currentLevel === 4) {
          e.preventDefault();
          setL4InteractTick((t) => t + 1);
        } else if (currentLevel === 5) {
          e.preventDefault();
          setL5InteractTick((t) => t + 1);
        } else if (currentLevel === 6) {
          e.preventDefault();
          setL6InteractTick((t) => t + 1);
        }
      } else if (
        gameMode === 'split' &&
        (e.key === 'Enter' || e.key === '/')
      ) {
        if (p2CurrentLevel === 4) {
          e.preventDefault();
          setP2L4InteractTick((t) => t + 1);
        } else if (p2CurrentLevel === 5) {
          e.preventDefault();
          setP2L5InteractTick((t) => t + 1);
        } else if (p2CurrentLevel === 6) {
          e.preventDefault();
          setP2L6InteractTick((t) => t + 1);
        }
      }
    };

    window.addEventListener('keydown', onInteractKeyDown);
    return () => window.removeEventListener('keydown', onInteractKeyDown);
  }, [
    page,
    paused,
    prologueActive,
    roadmapActive,
    level1IntroPhase,
    journalModalLevel,
    reflectionModalLevel,
    gameMode,
    currentLevel,
    p2CurrentLevel,
    nearbyCitizenIdx,
    p2NearbyCitizenIdx,
    nearbyZoneIdx,
    p2NearbyZoneIdx,
    nearbyIslandIdx,
    p2NearbyIslandIdx,
  ]);

  const handleNpcInteract = useCallback(
    (npcIdx: number, slot: 1 | 2, level: 4 | 5 | 6) => {
      if (
        page !== 'arena' ||
        paused ||
        missionMapOpen ||
        roomModalOpen ||
        logoutConfirmOpen ||
        prologueActive ||
        roadmapActive ||
        level1IntroPhase !== 'core_game' ||
        journalModalLevel !== null ||
        reflectionModalLevel !== null
      ) {
        return;
      }

      if (level === 6) {
        const island = LEVEL_6_ISLANDS[npcIdx];
        const pos = LEVEL_6_TOWER_POSITIONS[npcIdx];
        if (!island || !pos) return;

        const vx = -pos[0];
        const vz = 2 - pos[1];
        const len = Math.hypot(vx, vz) || 1;
        const nx = pos[0] + (vx / len) * 2.4;
        const nz = pos[1] + (vz / len) * 2.4;
        const rotY = Math.atan2(pos[0] - nx, pos[1] - nz);

        if (slot === 2 && gameMode === 'split') {
          if (p2CurrentLevel !== 6 || p2RemedialActive) return;
          player2PosRef.current = {
            x: nx,
            z: nz,
            rotY,
            moving: false,
            jumping: player2PosRef.current.jumping,
          };
          syncDomPlayerAttrs(2);
          setP2NearbyIslandIdx(npcIdx);
          setP2L6DirectOpen((prev) => ({ islandIdx: npcIdx, tick: (prev?.tick ?? 0) + 1 }));
          return;
        }

        if (currentLevel !== 6 || remedialActive) return;
        playerPosRef.current = {
          x: nx,
          z: nz,
          rotY,
          moving: false,
          jumping: playerPosRef.current.jumping,
        };
        syncDomPlayerAttrs(1);
        setNearbyIslandIdx(npcIdx);
        setL6DirectOpen((prev) => ({ islandIdx: npcIdx, tick: (prev?.tick ?? 0) + 1 }));
        return;
      }

      if (level === 5) {
        const zone = LEVEL_5_ZONES[npcIdx];
        if (!zone) return;

        const pos = l5NpcPositions[npcIdx] ?? zone.position;
        const vx = -pos[0];
        const vz = 2 - pos[1];
        const len = Math.hypot(vx, vz) || 1;
        const nx = pos[0] + (vx / len) * 2.4;
        const nz = pos[1] + (vz / len) * 2.4;
        const rotY = Math.atan2(pos[0] - nx, pos[1] - nz);

        if (slot === 2 && gameMode === 'split') {
          if (p2CurrentLevel !== 5 || p2RemedialActive) return;
          player2PosRef.current = {
            x: nx,
            z: nz,
            rotY,
            moving: false,
            jumping: player2PosRef.current.jumping,
          };
          syncDomPlayerAttrs(2);
          setP2NearbyZoneIdx(npcIdx);
          setP2L5DirectOpen((prev) => ({ zoneIdx: npcIdx, tick: (prev?.tick ?? 0) + 1 }));
          return;
        }

        if (currentLevel !== 5 || remedialActive) return;
        playerPosRef.current = {
          x: nx,
          z: nz,
          rotY,
          moving: false,
          jumping: playerPosRef.current.jumping,
        };
        syncDomPlayerAttrs(1);
        setNearbyZoneIdx(npcIdx);
        setL5DirectOpen((prev) => ({ zoneIdx: npcIdx, tick: (prev?.tick ?? 0) + 1 }));
        return;
      }

      const cit = LEVEL_4_CITIZENS[npcIdx];
      if (!cit) return;

      const pos = l4NpcPositions[npcIdx] ?? cit.position;
      const vx = -pos[0];
      const vz = 2 - pos[1];
      const len = Math.hypot(vx, vz) || 1;
      const nx = pos[0] + (vx / len) * 2.4;
      const nz = pos[1] + (vz / len) * 2.4;
      const rotY = Math.atan2(pos[0] - nx, pos[1] - nz);

      if (slot === 2 && gameMode === 'split') {
        if (p2CurrentLevel !== 4 || p2RemedialActive) return;
        player2PosRef.current = {
          x: nx,
          z: nz,
          rotY,
          moving: false,
          jumping: player2PosRef.current.jumping,
        };
        syncDomPlayerAttrs(2);
        setP2NearbyCitizenIdx(npcIdx);
        setP2L4DirectOpen((prev) => ({ citizenIdx: npcIdx, tick: (prev?.tick ?? 0) + 1 }));
        return;
      }

      if (currentLevel !== 4 || remedialActive) return;
      playerPosRef.current = {
        x: nx,
        z: nz,
        rotY,
        moving: false,
        jumping: playerPosRef.current.jumping,
      };
      syncDomPlayerAttrs(1);
      setNearbyCitizenIdx(npcIdx);
      setL4DirectOpen((prev) => ({ citizenIdx: npcIdx, tick: (prev?.tick ?? 0) + 1 }));
    },
    [
      page,
      paused,
      missionMapOpen,
      roomModalOpen,
      logoutConfirmOpen,
      prologueActive,
      roadmapActive,
      level1IntroPhase,
      journalModalLevel,
      reflectionModalLevel,
      gameMode,
      currentLevel,
      p2CurrentLevel,
      remedialActive,
      p2RemedialActive,
      l4NpcPositions,
      l5NpcPositions,
      syncDomPlayerAttrs,
    ]
  );

  // Fullscreen API Toggle (Section III.1 & III.3)
  const handleToggleFullscreen = () => {
    audioEngine.playClickFullscreen();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Toggle Game Sound (Mutes all audio except narrator speech)
  const handleToggleSound = () => {
    setSfxEnabled((prev) => {
      const next = !prev;
      audioEngine.setSfxEnabled(next);
      if (next) {
        audioEngine.playClickWood();
      }
      return next;
    });
  };

  // Cycle Narrator Persona: Bu Guru Rahma -> Pak Guru Ilyas -> Hening
  const handleCyclePersona = () => {
    audioEngine.unlockAudio();
    audioEngine.playClickWood();
    const order: NarratorPersona[] = ['rahma', 'ilyas', 'muted'];
    const next = order[(order.indexOf(persona) + 1) % order.length];
    const wasSpeaking = audioEngine.isSpeaking();
    setPersona(next);
    audioEngine.setPersona(next);
    if (next !== 'muted' && !wasSpeaking) {
      const lastText = audioEngine.getLastSpokenText();
      if (lastText && page === 'arena') {
        audioEngine.speak(lastText, 80);
      } else if (next === 'rahma') {
        audioEngine.speak(
          'Assalamu’alaikum anak-anak saleh. Saya Bu Guru Rahma. Mari kita merawat alam Nusantara dengan penuh kasih sayang dan tanggung jawab.',
          80
        );
      } else if (next === 'ilyas') {
        audioEngine.speak(
          'Assalamu’alaikum para Penjaga Bumi Nusantara. Saya Pak Guru Ilyas. Mari kita tegakkan amanah melestarikan bumi dan menjaga masa depan.',
          80
        );
      }
    }
  };

  // Cycle Difficulty Level: Mudah -> Sedang -> Sulit (Tenang dihapus)
  const handleCycleDifficulty = () => {
    audioEngine.playClickWood();
    const order: DifficultyLevel[] = ['mudah', 'sedang', 'sulit'];
    const curIdx = order.indexOf(difficulty === 'tenang' ? 'sedang' : difficulty);
    const next = order[(curIdx + 1) % order.length];
    setDifficulty(next);
  };

  // Add +30 Seconds Reading & Calculation Time Boost without losing any leaf (Player 1)
  const handleAddReadingTime = useCallback(() => {
    audioEngine.playGaugeUp();
    setTimeLeft((prev) => {
      const boosted = Number((prev + 30).toFixed(1));
      queueMicrotask(() => {
        setMaxTime((m) => Math.max(m, boosted));
      });
      return boosted;
    });
    setReadingGraceLeft((g) => Math.max(g, 3));
  }, []);

  // Add +30 Seconds Reading & Calculation Time Boost for Player 2
  const handleP2AddReadingTime = useCallback(() => {
    audioEngine.playGaugeUp();
    setP2TimeLeft((prev) => {
      const boosted = Number((prev + 30).toFixed(1));
      queueMicrotask(() => {
        setP2MaxTime((m) => Math.max(m, boosted));
      });
      return boosted;
    });
    setP2ReadingGraceLeft((g) => Math.max(g, 3));
  }, []);

  const handleSelectPersona = (next: NarratorPersona) => {
    audioEngine.unlockAudio();
    audioEngine.playClickWood();
    setPersona(next);
    audioEngine.setPersona(next);
    const previewName = rawNameInput.trim() || playerName;
    if (next === 'rahma') {
      audioEngine.speak(
        'Assalamu’alaikum anak-anak saleh. Saya Bu Guru Rahma. Mari kita merawat alam Nusantara dengan penuh kasih sayang dan tanggung jawab.',
        100
      );
      audioEngine.prefetch(PROLOGUE_BABAK[0].getText(previewName), 'rahma');
    } else if (next === 'ilyas') {
      audioEngine.speak(
        'Assalamu’alaikum para Penjaga Bumi Nusantara. Saya Pak Guru Ilyas. Mari kita tegakkan amanah melestarikan bumi dan menjaga masa depan.',
        100
      );
      audioEngine.prefetch(PROLOGUE_BABAK[0].getText(previewName), 'ilyas');
    }
  };

  // Start Mission Arena from Halaman 2
  const handleEnterArenaFromSetup = (e: React.FormEvent) => {
    e.preventDefault();
    audioEngine.unlockAudio();
    let resolvedP1 = playerName;
    let resolvedP2 = player2Name;
    if (gameMode === 'split') {
      const dualCheck = validateDualPlayerNames(rawNameInput, rawName2Input);
      if (!dualCheck.valid) {
        audioEngine.playErrorBuzz();
        setNameError(dualCheck.p1Error || null);
        setName2Error(dualCheck.p2Error || null);
        return;
      }
      setNameError(null);
      setName2Error(null);
      resolvedP1 = dualCheck.p1Sanitized;
      resolvedP2 = dualCheck.p2Sanitized;
      setPlayerName(resolvedP1);
      setPlayer2Name(resolvedP2);
    } else {
      const check = validateAndSanitizePlayerName(rawNameInput);
      if (!check.valid) {
        audioEngine.playErrorBuzz();
        setNameError(check.error || 'Nama siswa tidak valid.');
        return;
      }
      setNameError(null);
      setName2Error(null);
      resolvedP1 = check.sanitized;
      setPlayerName(resolvedP1);
    }

    const nextSessionId = createNewSessionId();
    setSessionId(nextSessionId);
    const zeroScores: LevelScoreMap = { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c6: 0 };
    const modeLabel =
      gameMode === 'split'
        ? '2P Split Screen'
        : gameMode === 'webrtc'
        ? 'Mode Kelas'
        : '1P Petualangan';

    // Immediately record user login to Google Spreadsheet & Leaderboard (even before Level 1 finishes)
    void syncProgressCheckpoint({
      sessionId: nextSessionId,
      playerName: resolvedP1,
      player2Name: resolvedP2,
      schoolName: schoolName.trim() || 'SDN 2 GIRIMARTO',
      studentClass,
      gameMode: modeLabel,
      difficulty,
      isTwoPlayer: gameMode === 'split',
      scores: zeroScores,
      p2Scores: zeroScores,
      totalScore: 0,
      p2TotalScore: 0,
      ecoHealth: 30,
      amanah: 30,
      evaluationLog: [],
      p2EvaluationLog: [],
    });

    audioEngine.playSuccessChord();
    cleanupCurrentLevel();
    setLives(3);
    setP2Lives(3);
    setScores(zeroScores);
    setP2Scores(zeroScores);
    setCompletedLevels([]);
    setEvaluationLog([]);
    setP2EvaluationLog([]);
    setLastMistakeNote(null);
    setP2LastMistakeNote(null);
    setCurrentLevel(1);
    setP2CurrentLevel(1);
    setLevel1Decks(createLevel1SplitDecks());
    setLevel2Decks(createLevel2SplitDecks());
    setLevel3Decks(createLevel3SplitDecks());
    setLevel4Decks(createLevel4SplitDecks());
    setLevel5Decks(createLevel5SplitDecks());
    setLevel6Decks(createLevel6SplitDecks());
    setL4NpcPositions(createLevel4NpcPositions());
    setL5NpcPositions(createLevel5NpcPositions());
    setCompletedCitizens([]);
    setCompletedZones([]);
    setCompletedIslands([]);
    setP2CompletedCitizens([]);
    setP2CompletedZones([]);
    setP2CompletedIslands([]);
    setLevel2Visual({
      assembledLetters: [],
      targetLength: 6,
      targetWord: 'KOMPOS',
      phase: 'anagram',
    });
    playerPosRef.current = {
      x: gameMode === 'split' ? -1.8 : 0,
      z: 3.6,
      rotY: 0,
      moving: false,
      jumping: false,
    };
    player2PosRef.current = { x: 1.8, z: 3.6, rotY: 0, moving: false, jumping: false };
    syncDomPlayerAttrs(1);
    syncDomPlayerAttrs(2);
    setP1DialogOpen(false);
    setP2DialogOpen(false);
    // Setelah klik Mulai Misi Pelestarian Alam -> Muncul Sinematik Prolog Lengkap (Babak 1..3)
    setPrologueActive(true);
    setPrologueStage(1);
    setRoadmapActive(false);
    setLevel1IntroPhase('looking');
    setLookingSecondsLeft(12);
    setNarrationSecondsLeft(30);
    setL1IntroTrigger((c) => c + 1);
    audioEngine.startPrologueMusic();
    setPage('arena');
  };

  // Handler saat pengguna melanjutkan dari Roadmap 6 Level menuju Pengenalan Lokasi (0,2 Menit) -> Narasi Pembuka Level
  const handleContinueFromRoadmap = (targetLevel?: number) => {
    const nextLv = targetLevel ?? currentLevel;
    audioEngine.unlockAudio();
    audioEngine.stopSpeech();
    setLives(3);
    setP2Lives(3);
    setRemedialActive(false);
    setP2RemedialActive(false);
    if (nextLv === 1) {
      setLevel1Decks(createLevel1SplitDecks());
    }
    if (nextLv === 2) {
      setLevel2Decks(createLevel2SplitDecks());
      setLevel2Visual({
        assembledLetters: [],
        targetLength: 6,
        targetWord: 'KOMPOS',
        phase: 'anagram',
      });
    } else {
      if (nextLv === 3) setLevel3Decks(createLevel3SplitDecks());
      if (nextLv === 4) {
        setLevel4Decks(createLevel4SplitDecks());
        setL4NpcPositions(createLevel4NpcPositions());
        setCompletedCitizens([]);
        setP2CompletedCitizens([]);
        setNearbyCitizenIdx(null);
        setP2NearbyCitizenIdx(null);
      }
      if (nextLv === 5) {
        setLevel5Decks(createLevel5SplitDecks());
        setL5NpcPositions(createLevel5NpcPositions());
        setCompletedZones([]);
        setP2CompletedZones([]);
      }
      if (nextLv === 6) {
        setLevel6Decks(createLevel6SplitDecks());
        setCompletedIslands([]);
        setP2CompletedIslands([]);
        setNearbyIslandIdx(null);
        setP2NearbyIslandIdx(null);
      }
    }
    playerPosRef.current = {
      x: gameMode === 'split' ? -1.8 : 0,
      z: 3.6,
      rotY: 0,
      moving: false,
      jumping: false,
    };
    player2PosRef.current = { x: 1.8, z: 3.6, rotY: 0, moving: false, jumping: false };
    syncDomPlayerAttrs(1);
    syncDomPlayerAttrs(2);
    setP1DialogOpen(false);
    setP2DialogOpen(false);
    setCurrentLevel(nextLv);
    setP2CurrentLevel(nextLv);
    setRoadmapActive(false);
    const isPhoneLv2Or3 =
      (nextLv === 2 || nextLv === 3) &&
      typeof window !== 'undefined' &&
      window.innerWidth < 768;
    setLevel1IntroPhase(isPhoneLv2Or3 ? 'core_game' : 'looking');
    setLookingSecondsLeft(12);
    setNarrationSecondsLeft(30);
    setL1IntroTrigger((c) => c + 1);
  };

  const triggerAnswerFlash = useCallback(
    (type: 'ok' | 'err') => {
      if (gameMode === 'split') {
        if (p1FlashTimerRef.current) {
          window.clearTimeout(p1FlashTimerRef.current);
          p1FlashTimerRef.current = null;
        }
        setP1SplitFlash(type);
        p1FlashTimerRef.current = window.setTimeout(
          () => {
            setP1SplitFlash(null);
            p1FlashTimerRef.current = null;
          },
          type === 'ok' ? 340 : 300
        );
        return;
      }

      if (flashTimerRef.current) {
        window.clearTimeout(flashTimerRef.current);
        flashTimerRef.current = null;
      }
      if (type === 'ok') {
        setRedFlashActive(false);
        setGreenFlashActive(true);
        flashTimerRef.current = window.setTimeout(() => {
          setGreenFlashActive(false);
          flashTimerRef.current = null;
        }, 340);
      } else {
        setGreenFlashActive(false);
        setRedFlashActive(true);
        flashTimerRef.current = window.setTimeout(() => {
          setRedFlashActive(false);
          flashTimerRef.current = null;
        }, 300);
      }
    },
    [gameMode]
  );

  const triggerP2AnswerFlash = useCallback((type: 'ok' | 'err') => {
    if (p2FlashTimerRef.current) {
      window.clearTimeout(p2FlashTimerRef.current);
      p2FlashTimerRef.current = null;
    }
    setP2SplitFlash(type);
    p2FlashTimerRef.current = window.setTimeout(
      () => {
        setP2SplitFlash(null);
        p2FlashTimerRef.current = null;
      },
      type === 'ok' ? 340 : 300
    );
  }, []);

  // Score Delta Handler (Player 1)
  const handleScoreDelta = (level: number, delta: number) => {
    audioEngine.playGaugeUp();
    triggerAnswerFlash('ok');
    setScores((prev) => {
      const next = { ...prev };
      if (level === 1) next.c1 = Math.min(15, prev.c1 + delta);
      if (level === 2) next.c2 = Math.min(15, prev.c2 + delta);
      if (level === 3) next.c3 = Math.min(15, prev.c3 + delta);
      if (level === 4) next.c4 = Math.min(20, prev.c4 + delta);
      if (level === 5) next.c5 = Math.min(15, prev.c5 + delta);
      if (level === 6) next.c6 = Math.min(20, prev.c6 + delta);
      return next;
    });
  };

  // Score Delta Handler for Player 2 (Mode 2P)
  const handleP2ScoreDelta = (level: number, delta: number) => {
    audioEngine.playGaugeUp();
    triggerP2AnswerFlash('ok');
    setP2Scores((prev) => {
      const next = { ...prev };
      if (level === 1) next.c1 = Math.min(15, prev.c1 + delta);
      if (level === 2) next.c2 = Math.min(15, prev.c2 + delta);
      if (level === 3) next.c3 = Math.min(15, prev.c3 + delta);
      if (level === 4) next.c4 = Math.min(20, prev.c4 + delta);
      if (level === 5) next.c5 = Math.min(15, prev.c5 + delta);
      if (level === 6) next.c6 = Math.min(20, prev.c6 + delta);
      return next;
    });
  };

  // Level Complete Handler (1P / Mode Kelas) -> Opens Reflection Modal -> Journal Transmission -> Roadmap -> Next Level Narration
  const handleLevelComplete = (level: number) => {
    audioEngine.playNatureHealed();
    setCompletedLevels((prev) => (prev.includes(level) ? prev : [...prev, level]));
    setReflectionModalLevel(level);
  };

  // Independent Level Complete Handler for Player 1 in 2P Split Mode (Never interrupts Player 2's Right Screen)
  const handleP1SplitLevelComplete = (level: number) => {
    audioEngine.playNatureHealed();
    setCompletedLevels((prev) => (prev.includes(level) ? prev : [...prev, level]));
    if (level < 6) {
      const nextLv = level + 1;
      setLives(3);
      setRemedialActive(false);
      setP1DialogOpen(false);
      if (nextLv === 4) {
        setCompletedCitizens([]);
        setNearbyCitizenIdx(null);
      } else if (nextLv === 5) {
        setCompletedZones([]);
        setNearbyZoneIdx(null);
      } else if (nextLv === 6) {
        setCompletedIslands([]);
        setNearbyIslandIdx(null);
      }
      playerPosRef.current = { x: -1.8, z: 3.6, rotY: 0, moving: false, jumping: false };
      syncDomPlayerAttrs(1);
      setCurrentLevel(nextLv);
    } else {
      setReflectionModalLevel(6);
    }
  };

  // Independent Level Complete Handler for Player 2 in 2P Split Mode (Never interrupts Player 1's Left Screen)
  const handleP2SplitLevelComplete = (level: number) => {
    audioEngine.playNatureHealed();
    setCompletedLevels((prev) => (prev.includes(level) ? prev : [...prev, level]));
    if (level < 6) {
      const nextLv = level + 1;
      setP2Lives(3);
      setP2RemedialActive(false);
      setP2DialogOpen(false);
      if (nextLv === 4) {
        setP2CompletedCitizens([]);
        setP2NearbyCitizenIdx(null);
      } else if (nextLv === 5) {
        setP2CompletedZones([]);
        setP2NearbyZoneIdx(null);
      } else if (nextLv === 6) {
        setP2CompletedIslands([]);
        setP2NearbyIslandIdx(null);
      }
      player2PosRef.current = { x: 1.8, z: 3.6, rotY: 0, moving: false, jumping: false };
      syncDomPlayerAttrs(2);
      setP2CurrentLevel(nextLv);
    } else {
      setReflectionModalLevel(6);
    }
  };

  const handleCloseReflectionAndAdvance = () => {
    const finishedLevel = reflectionModalLevel || currentLevel;
    setReflectionModalLevel(null);
    // Open Journal Transmission for next level (2..6, or 7 for Victory Epilogue)
    setJournalModalLevel(finishedLevel + 1);
  };

  const handleCloseJournalModal = () => {
    const target = journalModalLevel;
    setJournalModalLevel(null);
    audioEngine.stopSpeech();
    if (!target || target >= 7) {
      // Completed all 6 levels -> Go to Halaman 4 (Result & Piagam Ikrar)
      cleanupCurrentLevel();
      setPage('result');
    } else {
      setLives(3);
      setP2Lives(3);
      setRemedialActive(false);
      setP2RemedialActive(false);
      setCurrentLevel(target);
      setP2CurrentLevel(target);
      setRoadmapActive(true);
    }
  };

  // Jury Free Level Jump (`Peta Misi - Uji Level`)
  const handleJumpToLevel = (targetLevel: number) => {
    audioEngine.unlockAudio();
    audioEngine.playClickWood();
    cleanupCurrentLevel();
    setMissionMapOpen(false);
    setPrologueActive(false);
    setRoadmapActive(false);
    setLives(3);
    setP2Lives(3);
    if (targetLevel === 1) {
      setLevel1Decks(createLevel1SplitDecks());
    }
    if (targetLevel === 2) {
      setLevel2Decks(createLevel2SplitDecks());
      setLevel2Visual({
        assembledLetters: [],
        targetLength: 6,
        targetWord: 'KOMPOS',
        phase: 'anagram',
      });
    } else {
      if (targetLevel === 3) setLevel3Decks(createLevel3SplitDecks());
      if (targetLevel === 4) {
        setLevel4Decks(createLevel4SplitDecks());
        setL4NpcPositions(createLevel4NpcPositions());
        setCompletedCitizens([]);
        setP2CompletedCitizens([]);
        setNearbyCitizenIdx(null);
        setP2NearbyCitizenIdx(null);
      }
      if (targetLevel === 5) {
        setLevel5Decks(createLevel5SplitDecks());
        setL5NpcPositions(createLevel5NpcPositions());
        setCompletedZones([]);
        setP2CompletedZones([]);
        setNearbyZoneIdx(null);
        setP2NearbyZoneIdx(null);
      }
      if (targetLevel === 6) {
        setLevel6Decks(createLevel6SplitDecks());
        setCompletedIslands([]);
        setP2CompletedIslands([]);
        setNearbyIslandIdx(null);
        setP2NearbyIslandIdx(null);
      }
    }
    playerPosRef.current = {
      x: gameMode === 'split' ? -1.8 : 0,
      z: 3.6,
      rotY: 0,
      moving: false,
      jumping: false,
    };
    player2PosRef.current = { x: 1.8, z: 3.6, rotY: 0, moving: false, jumping: false };
    syncDomPlayerAttrs(1);
    syncDomPlayerAttrs(2);
    setP1DialogOpen(false);
    setP2DialogOpen(false);
    setCurrentLevel(targetLevel);
    setP2CurrentLevel(targetLevel);
    const isPhoneLv2Or3 =
      (targetLevel === 2 || targetLevel === 3) &&
      typeof window !== 'undefined' &&
      window.innerWidth < 768;
    setLevel1IntroPhase(isPhoneLv2Or3 ? 'core_game' : 'looking');
    setLookingSecondsLeft(12);
    setNarrationSecondsLeft(30);
    setL1IntroTrigger((c) => c + 1);
    setPage('arena');
  };

  // Virtual Analog Joystick & Jump Handlers — Strictly Isolated for Player 1 & Player 2 across ALL Levels 1–6
  const handleMoveVectorP1 = useCallback(
    (nx: number, nz: number) => {
      const step = 0.24;
      const dx = nx * step;
      const dz = nz * step;
      playerPosRef.current.x = Math.max(-19, Math.min(19, playerPosRef.current.x + dx));
      playerPosRef.current.z = Math.max(-19, Math.min(19, playerPosRef.current.z + dz));
      if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
        playerPosRef.current.rotY = Math.atan2(dx, dz);
      }
      playerPosRef.current.moving = true;
      syncDomPlayerAttrs(1);

      if (gameMode === 'webrtc') {
        const now = performance.now();
        if (now - webrtcMoveStampRef.current >= 120) {
          webrtcMoveStampRef.current = now;
          webrtcEngine.sendMyState({
            name: playerName,
            x: playerPosRef.current.x,
            y: 0,
            z: playerPosRef.current.z,
            rotY: playerPosRef.current.rotY,
            anim: 'walk',
            score: calculateTotalScore(scores),
            level: currentLevel,
          });
        }
      }
    },
    [gameMode, playerName, scores, currentLevel, syncDomPlayerAttrs]
  );

  const handleStopMoveP1 = useCallback(() => {
    playerPosRef.current.moving = false;
    syncDomPlayerAttrs(1);
  }, [syncDomPlayerAttrs]);

  const handleJumpP1 = useCallback(() => {
    if (playerPosRef.current.jumping) return;
    if (p1JumpTimerRef.current) {
      window.clearTimeout(p1JumpTimerRef.current);
      p1JumpTimerRef.current = null;
    }
    playerPosRef.current.jumping = true;
    syncDomPlayerAttrs(1);
    audioEngine.playJump();
    p1JumpTimerRef.current = window.setTimeout(() => {
      p1JumpTimerRef.current = null;
      playerPosRef.current.jumping = false;
      syncDomPlayerAttrs(1);
      audioEngine.playLand();
    }, 420);
  }, [syncDomPlayerAttrs]);

  const handleMoveVectorP2 = useCallback(
    (nx: number, nz: number) => {
      const step = 0.24;
      const dx = nx * step;
      const dz = nz * step;
      player2PosRef.current.x = Math.max(-19, Math.min(19, player2PosRef.current.x + dx));
      player2PosRef.current.z = Math.max(-19, Math.min(19, player2PosRef.current.z + dz));
      if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
        player2PosRef.current.rotY = Math.atan2(dx, dz);
      }
      player2PosRef.current.moving = true;
      syncDomPlayerAttrs(2);
    },
    [syncDomPlayerAttrs]
  );

  const handleStopMoveP2 = useCallback(() => {
    player2PosRef.current.moving = false;
    syncDomPlayerAttrs(2);
  }, [syncDomPlayerAttrs]);

  const handleJumpP2 = useCallback(() => {
    if (player2PosRef.current.jumping) return;
    if (p2JumpTimerRef.current) {
      window.clearTimeout(p2JumpTimerRef.current);
      p2JumpTimerRef.current = null;
    }
    player2PosRef.current.jumping = true;
    syncDomPlayerAttrs(2);
    audioEngine.playJump();
    p2JumpTimerRef.current = window.setTimeout(() => {
      p2JumpTimerRef.current = null;
      player2PosRef.current.jumping = false;
      syncDomPlayerAttrs(2);
      audioEngine.playLand();
    }, 420);
  }, [syncDomPlayerAttrs]);

  // Multi-Touch Input System for IFP, HP, and Touch Chromebook:
  // Tracks each active pointerId independently so simultaneous touches on Left Screen (P1)
  // and Right Screen (P2) always trigger button actions on pointerup without browser
  // multi-touch click suppression, while deduplicating any subsequent native click.
  const activeTouchButtonsRef = useRef<
    Map<number, { btn: HTMLButtonElement; x: number; y: number }>
  >(new Map());
  const lastMtClickTimeByBtnRef = useRef<WeakMap<HTMLButtonElement, number>>(new WeakMap());
  const inSyntheticMtClickRef = useRef<boolean>(false);

  const handleMultiTouchPointerDownCapture = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
      const target = e.target as HTMLElement | null;
      const btn = target?.closest('button') as HTMLButtonElement | null;
      if (!btn || btn.disabled || btn.dataset.noMtClick === 'true') return;
      activeTouchButtonsRef.current.set(e.pointerId, {
        btn,
        x: e.clientX,
        y: e.clientY,
      });
    },
    []
  );

  const handleMultiTouchPointerUpCapture = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
      const rec = activeTouchButtonsRef.current.get(e.pointerId);
      activeTouchButtonsRef.current.delete(e.pointerId);
      if (!rec || rec.btn.disabled || !rec.btn.isConnected) return;
      const moveDist = Math.hypot(e.clientX - rec.x, e.clientY - rec.y);
      if (moveDist > 28) return;
      const upTarget = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const upBtn = (upTarget?.closest('button') ??
        (e.target as HTMLElement | null)?.closest('button')) as HTMLButtonElement | null;
      if (upBtn && upBtn !== rec.btn) return;

      const now = performance.now();
      const prevClickAt = lastMtClickTimeByBtnRef.current.get(rec.btn) ?? 0;
      if (now - prevClickAt < 65) return;

      lastMtClickTimeByBtnRef.current.set(rec.btn, now);
      inSyntheticMtClickRef.current = true;
      try {
        rec.btn.click();
      } finally {
        inSyntheticMtClickRef.current = false;
      }
    },
    []
  );

  const handleMultiTouchPointerCancelCapture = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      activeTouchButtonsRef.current.delete(e.pointerId);
    },
    []
  );

  const handleMultiTouchClickCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (inSyntheticMtClickRef.current) return;
    const target = e.target as HTMLElement | null;
    const btn = target?.closest('button') as HTMLButtonElement | null;
    if (!btn) return;
    const prevMtAt = lastMtClickTimeByBtnRef.current.get(btn);
    if (prevMtAt !== undefined && performance.now() - prevMtAt < 360) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, []);

  const totalScore = calculateTotalScore(scores);
  const p2TotalScore = calculateTotalScore(p2Scores);
  const { ecoHealth, amanah } = calculateDualGauges(
    completedLevels.length,
    Math.max(totalScore, p2TotalScore) / 100
  );

  // Keep a live ref of the player's current session & progress so any level activity,
  // partial level, or early exit is recorded in the Google Spreadsheet & Leaderboard.
  const latestProgressPayloadRef = useRef<SubmitLeaderboardPayload | null>(null);
  const prevCompletedLevelsCountRef = useRef<number>(0);

  const currentProgressPayload: SubmitLeaderboardPayload = {
    sessionId,
    playerName: playerName.trim() || 'Penjaga Cilik',
    player2Name: player2Name.trim() || 'Pemain 2',
    schoolName: schoolName.trim() || 'SDN 2 GIRIMARTO',
    studentClass,
    gameMode:
      gameMode === 'split'
        ? '2P Split Screen'
        : gameMode === 'webrtc'
        ? 'Mode Kelas'
        : '1P Petualangan',
    difficulty,
    isTwoPlayer: gameMode === 'split',
    scores,
    p2Scores,
    totalScore,
    p2TotalScore,
    ecoHealth,
    amanah,
    evaluationLog,
    p2EvaluationLog,
  };
  latestProgressPayloadRef.current = currentProgressPayload;

  // Automatically sync every gameplay activity (even 1 question or 1 level) while in arena
  useEffect(() => {
    if (page !== 'arena') return;
    const hasActivity =
      totalScore > 0 ||
      p2TotalScore > 0 ||
      evaluationLog.length > 0 ||
      p2EvaluationLog.length > 0 ||
      completedLevels.length > 0;
    const completedIncreased = completedLevels.length > prevCompletedLevelsCountRef.current;
    prevCompletedLevelsCountRef.current = completedLevels.length;

    // Immediate sync when a level completes or on autostart; debounced (650ms) on mid-level score/answer activity
    const delayMs = completedIncreased || !hasActivity ? 60 : 650;
    const timer = window.setTimeout(() => {
      if (latestProgressPayloadRef.current) {
        void syncProgressCheckpoint(latestProgressPayloadRef.current, false);
      }
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [
    page,
    sessionId,
    playerName,
    player2Name,
    schoolName,
    studentClass,
    gameMode,
    difficulty,
    totalScore,
    p2TotalScore,
    evaluationLog.length,
    p2EvaluationLog.length,
    completedLevels.length,
  ]);

  // Flush latest session progress to Spreadsheet if player closes tab or navigates away mid-game
  useEffect(() => {
    const onPageHide = () => {
      if (latestProgressPayloadRef.current && (page === 'arena' || page === 'result')) {
        void syncProgressCheckpoint(latestProgressPayloadRef.current, true);
      }
    };
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onPageHide);
    };
  }, [page]);

  return (
    <div
      onPointerDownCapture={handleMultiTouchPointerDownCapture}
      onPointerUpCapture={handleMultiTouchPointerUpCapture}
      onPointerCancelCapture={handleMultiTouchPointerCancelCapture}
      onClickCapture={handleMultiTouchClickCapture}
      style={{ touchAction: page === 'arena' && gameMode === 'split' ? 'none' : 'manipulation' }}
      className="relative min-h-screen w-full flex flex-col select-none overflow-x-hidden"
    >
      {/* Persistent 3D Low-Poly Blocky Nusantara World Canvas */}
      <World3DCanvas
        page={page}
        currentLevel={currentLevel}
        p2CurrentLevel={p2CurrentLevel}
        level1IntroPhase={level1IntroPhase}
        prologueActive={prologueActive}
        prologueStage={prologueStage}
        avatarGender={avatarGender}
        avatar2Gender={avatar2Gender}
        avatarCostume={avatarCostume}
        playerName={playerName}
        player2Name={player2Name}
        gameMode={gameMode}
        ecoHealth={ecoHealth}
        cameraShakeTrigger={cameraShakeTrigger}
        p2CameraShakeTrigger={p2CameraShakeTrigger}
        clawX={clawState.x}
        clawGrabbing={clawState.grabbing}
        clawItemIndex={clawState.itemIndex}
        clawPhase={clawState.phase}
        p2ClawX={p2ClawState.x}
        p2ClawGrabbing={p2ClawState.grabbing}
        p2ClawItemIndex={p2ClawState.itemIndex}
        p2ClawPhase={p2ClawState.phase}
        level2Visual={level2Visual}
        p2Level2Visual={p2Level2Visual}
        p1DialogOpen={p1DialogOpen}
        p2DialogOpen={p2DialogOpen}
        playerPosRef={playerPosRef}
        player2PosRef={player2PosRef}
        completedCitizens={completedCitizens}
        completedZones={completedZones}
        completedIslands={completedIslands}
        p2CompletedCitizens={p2CompletedCitizens}
        p2CompletedZones={p2CompletedZones}
        p2CompletedIslands={p2CompletedIslands}
        onNearbyCitizenChange={(idx) => setNearbyCitizenIdx(idx)}
        onP2NearbyCitizenChange={(idx) => setP2NearbyCitizenIdx(idx)}
        onNearbyZoneChange={(idx) => setNearbyZoneIdx(idx)}
        onP2NearbyZoneChange={(idx) => setP2NearbyZoneIdx(idx)}
        onNearbyIslandChange={(idx) => setNearbyIslandIdx(idx)}
        onP2NearbyIslandChange={(idx) => setP2NearbyIslandIdx(idx)}
        onIslandTouch={(idx) =>
          setL6TouchOpen((prev) => ({ islandIdx: idx, tick: (prev?.tick ?? 0) + 1 }))
        }
        onP2IslandTouch={(idx) =>
          setP2L6TouchOpen((prev) => ({ islandIdx: idx, tick: (prev?.tick ?? 0) + 1 }))
        }
        l4Positions={l4NpcPositions}
        l5Positions={l5NpcPositions}
        onNpcInteract={handleNpcInteract}
      />

      {/* Emerald Celebration & Warm Amber Guiding Screen-Edge Flash Borders (1P / Classroom Mode) */}
      {gameMode !== 'split' && greenFlashActive && (
        <div className="fixed inset-0 border-8 border-emerald-400/75 bg-emerald-500/12 shadow-[inset_0_0_70px_rgba(16,185,129,0.38)] pointer-events-none z-40 animate-[screenFlashFade_340ms_ease-out_forwards]" />
      )}
      {gameMode !== 'split' && redFlashActive && (
        <div className="fixed inset-0 border-8 border-amber-400/75 bg-amber-400/12 shadow-[inset_0_0_65px_rgba(251,191,36,0.34)] pointer-events-none z-40 animate-[screenFlashFade_320ms_ease-out_forwards]" />
      )}

      {/* =====================================================================
          HALAMAN 1: PEMBUKA (SPLASH & TITLE SCREEN)
         ===================================================================== */}
      {page === 'splash' && (
        <main className="relative z-20 flex-1 flex flex-col justify-between p-4 md:p-8">
          {/* Top Official Identity Bar */}
          <div className="max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between gap-4 bg-slate-950/90 border border-emerald-500/40 rounded-3xl px-4 py-3 shadow-xl">
            <div className="flex items-center gap-3">
              <OfficialLogoBadge type="pgri" size="md" />
              <OfficialLogoBadge type="wonogiri" size="md" />
              <div>
                <div className="text-xs md:text-sm font-extrabold text-amber-300 tracking-wide uppercase">
                  {GAME_IDENTITY.competitionHeader}
                </div>
                <div className="text-[11px] md:text-xs text-slate-300">
                  {GAME_IDENTITY.officialHeaderOrg}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCyclePersona}
                data-testid="splash-narrator-btn"
                aria-label="Ganti Suara Narator Guru"
                className="btn-clay-slate px-3 py-2 rounded-xl text-xs font-extrabold text-amber-300 border border-amber-500/50 cursor-pointer"
              >
                {persona === 'rahma'
                  ? '🎙️ Bu Guru Rahma'
                  : persona === 'ilyas'
                  ? '🎙️ Pak Guru Ilyas'
                  : '🔇 Mode Hening'}
              </button>
              <button
                type="button"
                onClick={handleToggleSound}
                aria-label={sfxEnabled ? 'Matikan Musik & Suara Game' : 'Nyalakan Musik & Suara Game'}
                className={`btn-clay-slate px-3 py-2 rounded-xl text-xs font-extrabold border cursor-pointer ${
                  sfxEnabled
                    ? 'text-emerald-300 border-emerald-500/60'
                    : 'text-rose-300 border-rose-500/50'
                }`}
              >
                {sfxEnabled ? '🔊 Musik ON' : '🔇 Musik OFF'}
              </button>
              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="btn-clay-slate px-3.5 py-2 rounded-xl text-xs font-extrabold text-sky-300 border border-slate-700 cursor-pointer"
              >
                {isFullscreen ? '🗗 Mode Jendela' : '⛶ Layar Penuh / Fullscreen'}
              </button>
            </div>
          </div>

          {/* Center Hero Title Lockup over 3D Diorama (Logo Game + Judul & Sub Judul in One Place) */}
          <div className="my-auto py-3 max-w-3xl w-full mx-auto">
            <div className="bg-slate-950/90 border-2 border-emerald-500/70 rounded-3xl px-5 py-5 md:px-8 md:py-6 shadow-2xl">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-6 text-center sm:text-left">
                <NusantaraCrestSvg />

                <div className="flex-1 min-w-0">
                  <div className="text-[11px] md:text-xs font-extrabold text-emerald-400 tracking-widest uppercase">
                    GAME EDUKASI 3D PAI &amp; BUDI PEKERTI — FASE C (KELAS V &amp; VI SD)
                  </div>
                  <h1
                    className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mt-1 drop-shadow-[0_3px_0_#064e3b] leading-none"
                    style={{ textWrap: 'balance' }}
                  >
                    {GAME_IDENTITY.title}
                  </h1>
                  <p className="text-base md:text-xl font-bold text-amber-300 mt-1.5">
                    {GAME_IDENTITY.subtitle}
                  </p>
                  <p className="text-xs text-slate-300 mt-1.5">
                    Karya: <strong className="text-white">{GAME_IDENTITY.developerName}</strong> —{' '}
                    <strong className="text-emerald-300">{GAME_IDENTITY.developerBranch}</strong>
                  </p>
                </div>
              </div>

              {/* Primary CTA Buttons */}
              <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-3.5">
                <button
                  type="button"
                  data-start="true"
                  onClick={() => {
                    audioEngine.unlockAudio();
                    audioEngine.playClickWood();
                    setPage('setup');
                  }}
                  className="btn-clay-emerald px-6 py-3 rounded-2xl text-sm md:text-base font-extrabold text-white cursor-pointer"
                >
                  🚀 Mulai Petualangan
                </button>

                <button
                  type="button"
                  onClick={() => {
                    audioEngine.unlockAudio();
                    audioEngine.playClickWood();
                    setGuideModalOpen(true);
                    audioEngine.speak(
                      'Selamat datang, Penjaga Bumi Cilik! Dalam permainan Penjaga Bumi Nusantara ini, kamu akan menjelajahi enam level tantangan mulai dari memilah sampah, memahami prinsip tiga R, mengoperasikan mesin capit, membangun kota lestari, menjaga ekosistem, hingga merancang strategi pelestarian Nusantara sebagai wujud amanah Khalifah fil Ardh.',
                      100
                    );
                  }}
                  className="btn-clay-amber px-5 py-3 rounded-2xl text-sm md:text-base font-extrabold text-slate-950 cursor-pointer"
                >
                  📖 PETUNJUK
                </button>
              </div>
            </div>
          </div>

          {/* Flat Control Hint Footer */}
          <div className="text-center text-xs text-slate-300 bg-slate-950/80 py-2 px-4 rounded-xl max-w-xl mx-auto">
            WASD / Panah Bergerak · Spasi Lompat · [E] Interaksi Warga · Esc Jeda Permainan
          </div>
        </main>
      )}

      {/* =====================================================================
          HALAMAN 2: PENGATURAN, EDUKASI, & PILIHAN MODE
         ===================================================================== */}
      {page === 'setup' && (
        <main className="relative z-20 flex-1 py-2 px-3 md:px-5 overflow-y-auto flex items-center justify-center min-h-0">
          <div className="max-w-5xl w-full mx-auto bg-slate-950/95 border-2 border-emerald-600/70 rounded-3xl p-3.5 md:p-5 shadow-2xl space-y-2.5">
            {/* Top Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2.5">
                <OfficialLogoBadge type="pgri" size="sm" />
                <OfficialLogoBadge type="game" size="sm" />
                <OfficialLogoBadge type="wonogiri" size="sm" />
                <div>
                  <h1 className="text-base md:text-lg font-extrabold text-white leading-tight">
                    EDUKASI DAN PENGATURAN
                  </h1>
                  <p className="text-[11px] text-emerald-400 font-semibold">
                    {GAME_IDENTITY.subject} · {GAME_IDENTITY.targetStudents}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleSound}
                  aria-label={sfxEnabled ? 'Matikan Musik & Suara Game' : 'Nyalakan Musik & Suara Game'}
                  className={`btn-clay-slate px-2.5 py-1 rounded-xl text-[11px] font-bold border cursor-pointer ${
                    sfxEnabled
                      ? 'text-emerald-300 border-emerald-500/60'
                      : 'text-rose-300 border-rose-500/50'
                  }`}
                >
                  {sfxEnabled ? '🔊 Musik ON' : '🔇 Musik OFF'}
                </button>
                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  className="btn-clay-slate px-2.5 py-1 rounded-xl text-[11px] font-bold text-sky-300 border border-slate-700 cursor-pointer"
                >
                  {isFullscreen ? '🗗 Jendela' : '⛶ Layar Penuh'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.playClickWood();
                    setPage('splash');
                  }}
                  className="btn-clay-slate px-2.5 py-1 rounded-xl text-[11px] font-bold text-slate-300 border border-slate-700 cursor-pointer"
                >
                  ⬅️ Kembali
                </button>
              </div>
            </div>

            {/* Panel Capaian Pembelajaran (Fase C) + Tombol Edukasi Mencolok */}
            <section
              aria-label="Capaian Pembelajaran PAI dan BP Fase C"
              className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px]"
            >
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-emerald-400 uppercase tracking-wider">
                  📚 PAI &amp; BP FASE C:
                </span>
                <span className="text-slate-300 font-medium">
                  {GAME_IDENTITY.curriculum.kelas5.bab} · {GAME_IDENTITY.curriculum.kelas6.bab}
                </span>
              </div>
              <span className="text-[10px] text-amber-300 font-bold bg-amber-950/80 border border-amber-500/40 px-2 py-0.5 rounded-lg">
                {GAME_IDENTITY.targetStudents}
              </span>
            </section>

            {/* 2 Tombol Edukasi dengan Warna Berbeda yang Mencolok */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  audioEngine.unlockAudio();
                  audioEngine.playClickWood();
                  setHowToPlayModalOpen(true);
                  audioEngine.speak(
                    'Petunjuk cara bermain dan penggunaan kontrol. Pilih mode satu pemain, dua pemain, atau mode kelas. Gunakan tombol W A S D, tanda panah, atau joystick layar sentuh untuk menggerakkan karakter dan menyelesaikan enam misi pelestarian alam.',
                    100
                  );
                }}
                className="w-full py-2 px-4 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 border-2 border-amber-100 shadow-lg shadow-amber-500/30 font-black text-xs md:text-sm uppercase tracking-wide flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] transition-all"
              >
                <span>🎮</span>
                <span>PETUNJUK CARA BERMAIN DAN KONTROL</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  audioEngine.unlockAudio();
                  audioEngine.playClickWood();
                  setLearningGoalsModalOpen(true);
                  audioEngine.speak(
                    'Tujuan pembelajaran dan target capaian Fase C. Melalui permainan ini, peserta didik memahami amanah manusia sebagai Khalifah fil Ardh serta menguasai enam tingkatan berpikir dari C1 Mengenali hingga C6 Mencipta solusi pelestarian lingkungan Nusantara.',
                    100
                  );
                }}
                className="w-full py-2 px-4 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-purple-600 to-indigo-600 hover:from-fuchsia-400 hover:to-indigo-500 text-white border-2 border-fuchsia-200 shadow-lg shadow-fuchsia-500/30 font-black text-xs md:text-sm uppercase tracking-wide flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] transition-all"
              >
                <span>🎯</span>
                <span>TUJUAN PEMBELAJARAN DAN TARGET CAPAIAN</span>
              </button>
            </div>

            <form onSubmit={handleEnterArenaFromSetup} className="space-y-2.5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
                {/* Kolom Kiri: Identitas Siswa & Karakter Avatar (Tanpa Kolom Asal Sekolah) */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xs font-extrabold text-amber-300 uppercase tracking-wider">
                      1. Identitas &amp; Avatar {gameMode === 'split' ? '(2 Pemain)' : 'Penjaga Bumi Cilik'}
                    </h2>
                    {gameMode === 'split' && (
                      <span className="text-[10px] font-extrabold text-emerald-300 bg-emerald-950/90 border border-emerald-500/50 px-2 py-0.5 rounded-lg">
                        ⚔️ 2 Siswa (Kiri &amp; Kanan)
                      </span>
                    )}
                  </div>

                  {gameMode === 'split' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* Nama Pemain 1 (Kiri) */}
                      <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-2">
                        <label
                          htmlFor="student-name-input"
                          className="block text-[11px] font-extrabold text-emerald-300 mb-1"
                        >
                          🎮 Nama Pemain 1 / Kiri (WASD):
                        </label>
                        <input
                          id="student-name-input"
                          type="text"
                          maxLength={15}
                          placeholder="Contoh: Ahmad Fauzi"
                          value={rawNameInput}
                          onChange={(e) => {
                            setRawNameInput(e.target.value);
                            if (nameError) setNameError(null);
                          }}
                          className="w-full bg-slate-950 border-2 border-emerald-600/70 focus:border-emerald-400 rounded-xl px-2.5 py-1 text-xs font-bold text-white outline-none"
                        />
                        {nameError && (
                          <p role="alert" className="text-[10px] font-bold text-rose-400 mt-0.5">
                            ⚠️ {nameError}
                          </p>
                        )}
                      </div>

                      {/* Nama Pemain 2 (Kanan) */}
                      <div className="bg-sky-950/30 border border-sky-500/40 rounded-xl p-2">
                        <label
                          htmlFor="student-name-2-input"
                          className="block text-[11px] font-extrabold text-sky-300 mb-1"
                        >
                          🎮 Nama Pemain 2 / Kanan (Panah):
                        </label>
                        <input
                          id="student-name-2-input"
                          type="text"
                          maxLength={15}
                          placeholder="Contoh: Siti Fatimah"
                          value={rawName2Input}
                          onChange={(e) => {
                            setRawName2Input(e.target.value);
                            if (name2Error) setName2Error(null);
                          }}
                          className="w-full bg-slate-950 border-2 border-sky-600/70 focus:border-sky-400 rounded-xl px-2.5 py-1 text-xs font-bold text-white outline-none"
                        />
                        {name2Error && (
                          <p role="alert" className="text-[10px] font-bold text-rose-400 mt-0.5">
                            ⚠️ {name2Error}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label
                        htmlFor="student-name-input"
                        className="block text-xs font-bold text-slate-200 mb-1"
                      >
                        Nama Siswa (2–15 Karakter):
                      </label>
                      <input
                        id="student-name-input"
                        type="text"
                        maxLength={15}
                        placeholder="Contoh: Ahmad Fauzi"
                        value={rawNameInput}
                        onChange={(e) => {
                          setRawNameInput(e.target.value);
                          if (nameError) setNameError(null);
                        }}
                        className="w-full bg-slate-950 border-2 border-slate-700 focus:border-emerald-400 rounded-xl px-3 py-1 text-xs md:text-sm font-bold text-white outline-none"
                      />
                      {nameError && (
                        <p role="alert" className="text-[11px] font-bold text-rose-400 mt-0.5">
                          ⚠️ {nameError}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Kelas / Fase & Asal Sekolah */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label
                        htmlFor="student-class-select"
                        className="block text-[11px] font-bold text-slate-200 mb-0.5"
                      >
                        Kelas / Fase:
                      </label>
                      <select
                        id="student-class-select"
                        value={studentClass}
                        onChange={(e) =>
                          setStudentClass(
                            e.target.value as 'Kelas V (Fase C)' | 'Kelas VI (Fase C)'
                          )
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1 text-xs font-bold text-white"
                      >
                        <option value="Kelas V (Fase C)">Kelas V SD (Fase C)</option>
                        <option value="Kelas VI (Fase C)">Kelas VI SD (Fase C)</option>
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="student-school-input"
                        className="block text-[11px] font-bold text-emerald-300 mb-0.5"
                      >
                        🏫 Nama Sekolah / SD:
                      </label>
                      <input
                        id="student-school-input"
                        data-testid="input-school-name"
                        type="text"
                        maxLength={40}
                        placeholder="Contoh: SDN 2 GIRIMARTO"
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        className="w-full bg-slate-950 border border-emerald-600/70 focus:border-emerald-400 rounded-xl px-2.5 py-1 text-xs font-bold text-white outline-none"
                      />
                    </div>
                  </div>

                  {/* Avatar Headgear & Local Costume */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                    <div>
                      <span className="block text-[11px] font-bold text-slate-200 mb-1">
                        {gameMode === 'split' ? 'Avatar P1 & P2:' : 'Karakter Avatar:'}
                      </span>
                      {gameMode === 'split' ? (
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              audioEngine.playClickWood();
                              setAvatarGender((g) => (g === 'male' ? 'female' : 'male'));
                            }}
                            className="py-1 px-1.5 rounded-xl text-[11px] font-bold border bg-emerald-900/80 text-white border-emerald-400 cursor-pointer transition-all"
                          >
                            P1: {avatarGender === 'male' ? '👦 Peci' : '👧 Jilbab'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              audioEngine.playClickWood();
                              setAvatar2Gender((g) => (g === 'male' ? 'female' : 'male'));
                            }}
                            className="py-1 px-1.5 rounded-xl text-[11px] font-bold border bg-sky-900/80 text-white border-sky-400 cursor-pointer transition-all"
                          >
                            P2: {avatar2Gender === 'male' ? '👦 Peci' : '👧 Jilbab'}
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              audioEngine.playClickWood();
                              setAvatarGender('male');
                            }}
                            className={`py-1 px-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                              avatarGender === 'male'
                                ? 'bg-emerald-600 text-white border-white shadow-sm'
                                : 'bg-slate-950 text-slate-300 border-slate-800'
                            }`}
                          >
                            👦 Peci Hitam
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              audioEngine.playClickWood();
                              setAvatarGender('female');
                            }}
                            className={`py-1 px-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                              avatarGender === 'female'
                                ? 'bg-emerald-600 text-white border-white shadow-sm'
                                : 'bg-slate-950 text-slate-300 border-slate-800'
                            }`}
                          >
                            👧 Jilbab
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="block text-[11px] font-bold text-slate-200 mb-1">
                        Seragam Lokal:
                      </span>
                      <div className="grid grid-cols-3 gap-1">
                        {(['rompi', 'batik', 'pramuka'] as const).map((cost) => (
                          <button
                            key={cost}
                            type="button"
                            onClick={() => {
                              audioEngine.playClickWood();
                              setAvatarCostume(cost);
                            }}
                            className={`py-1 px-0.5 rounded-xl text-[11px] font-bold capitalize border cursor-pointer transition-all ${
                              avatarCostume === cost
                                ? 'bg-amber-400 text-slate-950 border-white font-extrabold shadow-sm'
                                : 'bg-slate-950 text-slate-300 border-slate-800'
                            }`}
                          >
                            {cost}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Kolom Kanan: Narator, Mode Permainan & Tingkat Kesulitan */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between space-y-2">
                  {/* 2. Narator Guru */}
                  <div>
                    <h2 className="text-xs font-extrabold text-amber-300 uppercase tracking-wider mb-1">
                      2. Suara Narator Guru PAI &amp; BP
                    </h2>

                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSelectPersona('rahma')}
                        className={`py-1.5 px-1 rounded-xl border text-center font-black text-xs uppercase tracking-wide cursor-pointer transition-all ${
                          persona === 'rahma'
                            ? 'bg-emerald-950 border-emerald-400 text-amber-300 shadow-md ring-2 ring-emerald-400/50'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        BU GURU RAHMA
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectPersona('ilyas')}
                        className={`py-1.5 px-1 rounded-xl border text-center font-black text-xs uppercase tracking-wide cursor-pointer transition-all ${
                          persona === 'ilyas'
                            ? 'bg-emerald-950 border-emerald-400 text-amber-300 shadow-md ring-2 ring-emerald-400/50'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        PAK GURU ILYAS
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectPersona('muted')}
                        className={`py-1.5 px-1 rounded-xl border text-center font-black text-xs uppercase tracking-wide cursor-pointer transition-all ${
                          persona === 'muted'
                            ? 'bg-amber-950 border-amber-400 text-white shadow-md ring-2 ring-amber-400/50'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        MODE HENING
                      </button>
                    </div>
                  </div>

                  {/* 3. Pilihan Mode Permainan */}
                  <div className="pt-1.5 border-t border-slate-800/80">
                    <h2 className="text-xs font-extrabold text-amber-300 uppercase tracking-wider mb-1">
                      3. Pilihan Mode Permainan
                    </h2>

                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          audioEngine.playClickWood();
                          setGameMode('solo');
                        }}
                        className={`py-1.5 px-2 rounded-xl border text-center font-black text-sm tracking-wide cursor-pointer transition-all ${
                          gameMode === 'solo'
                            ? 'bg-emerald-950 border-emerald-400 text-amber-300 shadow-md ring-2 ring-emerald-400/50'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        1P
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          audioEngine.playClickWood();
                          setGameMode('split');
                        }}
                        className={`py-1.5 px-2 rounded-xl border text-center font-black text-sm tracking-wide cursor-pointer transition-all ${
                          gameMode === 'split'
                            ? 'bg-emerald-950 border-emerald-400 text-amber-300 shadow-md ring-2 ring-emerald-400/50'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        2P
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          audioEngine.playClickWood();
                          setGameMode('webrtc');
                        }}
                        className={`py-1.5 px-2 rounded-xl border text-center font-black text-sm tracking-wide cursor-pointer transition-all ${
                          gameMode === 'webrtc'
                            ? 'bg-emerald-950 border-emerald-400 text-sky-300 shadow-md ring-2 ring-emerald-400/50'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        MODE KELAS
                      </button>
                    </div>

                    {gameMode === 'split' && (
                      <div className="mt-1.5 bg-slate-950 border border-emerald-500/30 rounded-xl px-2.5 py-1 text-[10px] text-emerald-300 flex items-center justify-between">
                        <span>⚔️ Mode 2P (1 Keyboard · Kiri &amp; Kanan):</span>
                        <span className="text-white font-mono">P1: WASD · P2: Panah</span>
                      </div>
                    )}

                    {/* Room Kelas Inline Bar (Tampil Persis di Bawah Mode Kelas secara Kompak 1 Baris) */}
                    {gameMode === 'webrtc' && (
                      <div className="mt-1.5 bg-slate-950 border border-sky-400/80 rounded-xl p-2 space-y-1.5 shadow-md animate-fade-in">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-extrabold text-sky-300 flex items-center gap-1 text-[10px]">
                            <span>🏫</span> ROOM KELAS WEBRTC P2P
                          </span>
                          <span className="text-[10px] text-amber-300 font-mono-num font-bold bg-sky-950 px-2 py-0.5 rounded border border-sky-400/50">
                            Kode: {activeRoomCode || 'BUMI-5A'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <input
                            id="setup-room-input"
                            type="text"
                            maxLength={12}
                            value={activeRoomCode}
                            onChange={(e) => {
                              const val = e.target.value.toUpperCase();
                              setActiveRoomCode(val);
                              setRoomCodeInput(val);
                            }}
                            placeholder="BUMI-5A"
                            className="w-24 bg-slate-900 border border-sky-400 focus:border-amber-300 rounded-lg px-2 py-1 text-xs font-extrabold font-mono-num text-amber-300 uppercase tracking-widest text-center outline-none shadow-inner"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              audioEngine.playClickWood();
                              webrtcEngine.createClassroomHost(
                                rawNameInput || 'Guru PAI',
                                (code, msg) => {
                                  setActiveRoomCode(code);
                                  setRoomCodeInput(code);
                                  setWebrtcStatus(msg);
                                }
                              );
                            }}
                            className="btn-clay-amber flex-1 py-1 px-1.5 rounded-lg text-[10px] font-extrabold text-slate-950 text-center cursor-pointer shadow whitespace-nowrap"
                          >
                            🏫 Host
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              audioEngine.playClickWood();
                              webrtcEngine.joinClassroomRoom(
                                activeRoomCode || 'BUMI-5A',
                                rawNameInput || 'Siswa',
                                (_ok, msg) => {
                                  setWebrtcStatus(msg);
                                }
                              );
                            }}
                            className="btn-clay-emerald flex-1 py-1 px-1.5 rounded-lg text-[10px] font-extrabold text-white text-center cursor-pointer shadow whitespace-nowrap"
                          >
                            👥 Gabung
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-300 bg-slate-900/80 rounded-lg px-2 py-0.5 border border-slate-800">
                          <span className="text-sky-300 font-mono-num truncate max-w-[150px]">
                            📶 {webrtcStatus}
                          </span>
                          <span className="text-emerald-400 font-bold font-mono-num whitespace-nowrap shrink-0">
                            👥 {Object.keys(peersMap).length} Siswa
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 4. Tingkat Kesulitan Permainan (Terpadu di Kolom Kanan Tanpa Ruang Kosong) */}
                  <div className="pt-1.5 border-t border-slate-800/80">
                    <div className="flex items-center justify-between mb-1">
                      <h2 className="text-xs font-extrabold text-amber-300 uppercase tracking-wider">
                        4. Tingkat Kesulitan
                      </h2>
                      <span className="text-[10px] text-slate-400">
                        {difficulty === 'mudah'
                          ? 'Santai (+20s)'
                          : difficulty === 'sedang'
                          ? 'Standar PAI'
                          : 'Tantangan (-10s)'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      {(['mudah', 'sedang', 'sulit'] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => {
                            audioEngine.playClickWood();
                            setDifficulty(d);
                          }}
                          className={`py-1.5 px-1 rounded-xl text-xs font-black uppercase border cursor-pointer transition-all text-center ${
                            difficulty === d
                              ? d === 'mudah'
                                ? 'bg-emerald-600 text-white border-white shadow-md ring-2 ring-emerald-400/50'
                                : d === 'sedang'
                                ? 'bg-amber-400 text-slate-950 border-white shadow-md ring-2 ring-amber-400/50'
                                : 'bg-rose-600 text-white border-white shadow-md ring-2 ring-rose-400/50'
                              : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Panduan Kontrol Interaktif + Tombol Masuk Arena (Kompak & Elegan) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 text-slate-300 text-[11px]">
                    <span className="text-base">💻</span>
                    <span className="font-bold text-white">Desktop:</span>
                    <span>WASD/Panah · Spasi · [E]</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300 text-[11px] hidden sm:flex">
                    <span className="text-base">📱</span>
                    <span className="font-bold text-white">Layar Sentuh:</span>
                    <span>Joystik Virtual &amp; Lompat</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => {
                      const check1 = validateAndSanitizePlayerName(rawNameInput || 'Pemain 1');
                      const check2 = validateAndSanitizePlayerName(rawName2Input || 'Pemain 2');
                      setPlayerName(check1.sanitized);
                      setPlayer2Name(check2.sanitized);
                      setMissionMapOpen(true);
                    }}
                    className="btn-clay-slate px-3 py-1.5 rounded-xl text-xs font-bold text-amber-300 border border-amber-500/40 cursor-pointer whitespace-nowrap"
                  >
                    🗺️ Uji Cepat Level 1–6 (Juri)
                  </button>

                  <button
                    type="submit"
                    className="btn-clay-emerald px-5 py-2 rounded-xl text-xs md:text-sm font-extrabold text-white cursor-pointer shadow-lg whitespace-nowrap active:scale-95 transition-transform"
                  >
                    MULAI MISI PELESTARIAN ALAM →
                  </button>
                </div>
              </div>
            </form>
          </div>
        </main>
      )}

      {/* =====================================================================
          HALAMAN 3: ARENA PERMAINAN UTAMA (INTERACTIVE GAMEPLAY SCREEN)
         ===================================================================== */}
      {page === 'arena' && (
        <>
          {gameMode === 'split' ? (
            <div className="relative z-20 flex-1 flex flex-col min-h-screen max-md:h-[100dvh] max-md:max-h-[100dvh] max-md:overflow-hidden w-full pointer-events-none">
              {/* 1. HEADER UMUM TUNGGAL (1 SAJA): Logo PGRI, Kab Wonogiri, Logo Game, Level, Eco/Amanah, Sound, Jeda, Peta Misi, Keluar */}
              <DualPlayerSharedHeader
                currentLevel={currentLevel}
                p2CurrentLevel={p2CurrentLevel}
                completedLevels={completedLevels}
                ecoHealth={ecoHealth}
                amanah={amanah}
                difficulty={difficulty}
                persona={persona}
                sfxEnabled={sfxEnabled}
                isFullscreen={isFullscreen}
                onCycleDifficulty={handleCycleDifficulty}
                onOpenRoomModal={() => {
                  audioEngine.playClickWood();
                  setRoomModalOpen(true);
                }}
                onOpenMissionMap={() => {
                  audioEngine.playClickWood();
                  setMissionMapOpen(true);
                }}
                onCyclePersona={handleCyclePersona}
                onToggleSfx={handleToggleSound}
                onToggleFullscreen={handleToggleFullscreen}
                onTogglePause={() => {
                  audioEngine.playClickWood();
                  setPaused((p) => !p);
                }}
                onRequestLogout={() => {
                  audioEngine.playClickWood();
                  setLogoutConfirmOpen(true);
                }}
              />

              {/* 2. APABILA PROLOG / ROADMAP 6 LEVEL / NARASI SEBELUM MASUK LEVEL (1..6) / REFLEKSI / JURNAL AKTIF (BERSIFAT UMUM -> 1 KOTAK TERPUSAT SAJA) */}
              {prologueActive ||
              roadmapActive ||
              level1IntroPhase !== 'core_game' ||
              reflectionModalLevel !== null ||
              journalModalLevel !== null ? (
                <LevelsArenaView
                  playerName={`${playerName} & ${player2Name}`}
                  currentLevel={currentLevel}
                  difficulty={difficulty}
                  isSplitMode={false}
                  level1IntroPhase={level1IntroPhase}
                  lookingSecondsLeft={lookingSecondsLeft}
                  onAdvanceLookingToNarration={() => {
                    setLevel1IntroPhase('narration');
                    setNarrationSecondsLeft(30);
                  }}
                  onCompleteLevel1Intro={() => setLevel1IntroPhase('core_game')}
                  roadmapActive={roadmapActive}
                  completedLevels={completedLevels}
                  onContinueFromRoadmap={handleContinueFromRoadmap}
                  narrationSecondsLeft={narrationSecondsLeft}
                  prologueActive={prologueActive}
                  prologueStage={prologueStage}
                  lives={lives}
                  remedialActive={false}
                  journalModalLevel={journalModalLevel}
                  reflectionModalLevel={reflectionModalLevel}
                  playerPosRef={playerPosRef}
                  nearbyCitizenIdx={nearbyCitizenIdx}
                  nearbyZoneIdx={nearbyZoneIdx}
                  l4Positions={l4NpcPositions}
                  l5Positions={l5NpcPositions}
                  completedCitizens={completedCitizens}
                  completedZones={completedZones}
                  completedIslands={completedIslands}
                  onAdvancePrologue={() => {
                    if (prologueStage < 3) {
                      setPrologueStage(prologueStage + 1);
                    } else {
                      audioEngine.stopSpeech();
                      setPrologueActive(false);
                      setRoadmapActive(true);
                    }
                  }}
                  onSkipPrologue={() => {
                    audioEngine.stopSpeech();
                    setPrologueActive(false);
                    setRoadmapActive(true);
                  }}
                  onCloseJournalModal={handleCloseJournalModal}
                  onCloseReflectionAndAdvance={handleCloseReflectionAndAdvance}
                  onRetryRemedialLevel={() => {}}
                  onScoreDelta={handleScoreDelta}
                  onLoseLife={handleLoseLife}
                  onLevelComplete={handleLevelComplete}
                  onSetTimerSpec={(sec, maxSec, graceSec) => {
                    setTimeLeft(sec);
                    setMaxTime(maxSec);
                    setP2TimeLeft(sec);
                    setP2MaxTime(maxSec);
                    if (typeof graceSec === 'number') {
                      setReadingGraceLeft(graceSec);
                      setP2ReadingGraceLeft(graceSec);
                    }
                  }}
                  onUpdateClawState={(x, grabbing, itemIndex, phase) =>
                    setClawState((prev) => ({
                      x,
                      grabbing,
                      itemIndex: itemIndex ?? prev.itemIndex,
                      phase: phase ?? prev.phase,
                    }))
                  }
                  onMarkCitizenDone={() => {}}
                  onMarkZoneDone={() => {}}
                  onMarkIslandDone={() => {}}
                />
              ) : (
                <>
                  {/* 3. AREA PRIBADI KIRI (PEMAIN 1) & KANAN (PEMAIN 2): MASING-MASING FOKUS PADA DUNIA, MINIMAP & JOYSTIK SENDIRI */}
                  <div className="flex-1 flex flex-row items-stretch divide-x-4 divide-emerald-500/80 w-full min-h-0 pointer-events-none relative">
                    {/* SISI KIRI: DUNIA & KEGIATAN PRIBADI PEMAIN 1 (WASD + JOYSTIK P1) */}
                    <div
                      ref={worldPaneP1Ref}
                      data-testid="world-pane-p1"
                      data-player-x={playerPosRef.current.x.toFixed(2)}
                      data-player-z={playerPosRef.current.z.toFixed(2)}
                      data-player-jumping={playerPosRef.current.jumping ? '1' : '0'}
                      className="w-1/2 self-stretch min-h-0 flex flex-col relative pointer-events-none overflow-hidden"
                    >
                      {p1SplitFlash === 'ok' && (
                        <div className="absolute inset-0 border-4 border-emerald-400/80 bg-emerald-500/12 shadow-[inset_0_0_45px_rgba(16,185,129,0.38)] pointer-events-none z-40 animate-[screenFlashFade_340ms_ease-out_forwards]" />
                      )}
                      {p1SplitFlash === 'err' && (
                        <div className="absolute inset-0 border-4 border-amber-400/80 bg-amber-400/12 shadow-[inset_0_0_40px_rgba(251,191,36,0.34)] pointer-events-none z-40 animate-[screenFlashFade_320ms_ease-out_forwards]" />
                      )}
                      <PersonalPlayerHudStrip
                        playerNumber={1}
                        playerName={playerName || 'Pemain 1'}
                        avatarGender={avatarGender}
                        currentLevel={currentLevel}
                        lives={lives}
                        leafShaking={leafShaking}
                        totalScore={totalScore}
                        timeLeft={timeLeft}
                        maxTime={maxTime}
                        readingGraceLeft={readingGraceLeft}
                        difficulty={difficulty}
                        onAddReadingTime={handleAddReadingTime}
                      />

                      <LevelsArenaView
                        playerName={playerName || 'Pemain 1'}
                        currentLevel={currentLevel}
                        difficulty={difficulty}
                        isSplitMode={true}
                        playerSlot={1}
                        onLevel2VisualChange={setLevel2Visual}
                        onDialogOpenChange={setP1DialogOpen}
                        level1Deck={level1Decks.p1}
                        level2Deck={level2Decks.p1}
                        level3Deck={level3Decks.p1}
                        level4Deck={level4Decks.p1}
                        level5Deck={level5Decks.p1}
                        level6Deck={level6Decks.p1}
                        level1IntroPhase={level1IntroPhase}
                        onCompleteLevel1Intro={() => setLevel1IntroPhase('core_game')}
                        prologueActive={false}
                        prologueStage={prologueStage}
                        lives={lives}
                        remedialActive={remedialActive}
                        journalModalLevel={null}
                        reflectionModalLevel={null}
                        playerPosRef={playerPosRef}
                        partnerPosRef={player2PosRef}
                        nearbyCitizenIdx={nearbyCitizenIdx}
                        l4InteractTick={l4InteractTick}
                        l4DirectOpen={l4DirectOpen}
                        nearbyZoneIdx={nearbyZoneIdx}
                        l5InteractTick={l5InteractTick}
                        l5DirectOpen={l5DirectOpen}
                        nearbyIslandIdx={nearbyIslandIdx}
                        l6InteractTick={l6InteractTick}
                        l6DirectOpen={l6DirectOpen}
                        l6TouchOpen={l6TouchOpen}
                        l4Positions={l4NpcPositions}
                        l5Positions={l5NpcPositions}
                        completedCitizens={completedCitizens}
                        completedZones={completedZones}
                        completedIslands={completedIslands}
                        onAdvancePrologue={() => {}}
                        onSkipPrologue={() => {}}
                        onCloseJournalModal={handleCloseJournalModal}
                        onCloseReflectionAndAdvance={handleCloseReflectionAndAdvance}
                        onRetryRemedialLevel={() => {
                          setRemedialActive(false);
                          setLastMistakeNote(null);
                          setLives(3);
                        }}
                        onScoreDelta={handleScoreDelta}
                        onLoseLife={handleLoseLife}
                        onAnswerFeedback={triggerAnswerFlash}
                        evaluationLog={evaluationLog}
                        lastMistakeNote={lastMistakeNote}
                        onRecordEvaluation={handleRecordEvaluation}
                        onLevelComplete={handleP1SplitLevelComplete}
                        onSetTimerSpec={(sec, maxSec, graceSec) => {
                          setTimeLeft(sec);
                          setMaxTime(maxSec);
                          if (typeof graceSec === 'number') {
                            setReadingGraceLeft(graceSec);
                          }
                        }}
                        onUpdateClawState={(x, grabbing, itemIndex, phase) =>
                          setClawState((prev) => ({
                            x,
                            grabbing,
                            itemIndex: itemIndex ?? prev.itemIndex,
                            phase: phase ?? prev.phase,
                          }))
                        }
                        onMarkCitizenDone={(idx) =>
                          setCompletedCitizens((prev) =>
                            prev.includes(idx) ? prev : [...prev, idx]
                          )
                        }
                        onMarkZoneDone={(idx) =>
                          setCompletedZones((prev) => (prev.includes(idx) ? prev : [...prev, idx]))
                        }
                        onMarkIslandDone={(idx) =>
                          setCompletedIslands((prev) =>
                            prev.includes(idx) ? prev : [...prev, idx]
                          )
                        }
                      />

                      {!paused && !remedialActive && (
                        <TouchJoystickControls
                          playerSlot={1}
                          playerLabel="P1"
                          accentColor="emerald"
                          layoutAlign="left"
                          onMoveVector={handleMoveVectorP1}
                          onMoveEnd={handleStopMoveP1}
                          onJump={handleJumpP1}
                          className={`absolute bottom-2.5 left-2.5 z-30 ${
                            p1DialogOpen || currentLevel === 2 || currentLevel === 3
                              ? 'max-md:hidden'
                              : ''
                          }`}
                        />
                      )}
                    </div>

                    {/* SISI KANAN: DUNIA & KEGIATAN PRIBADI PEMAIN 2 (PANAH + JOYSTIK P2) */}
                    <div
                      ref={worldPaneP2Ref}
                      data-testid="world-pane-p2"
                      data-player-x={player2PosRef.current.x.toFixed(2)}
                      data-player-z={player2PosRef.current.z.toFixed(2)}
                      data-player-jumping={player2PosRef.current.jumping ? '1' : '0'}
                      className="w-1/2 self-stretch min-h-0 flex flex-col relative pointer-events-none overflow-hidden"
                    >
                      {p2SplitFlash === 'ok' && (
                        <div className="absolute inset-0 border-4 border-emerald-400/80 bg-emerald-500/12 shadow-[inset_0_0_45px_rgba(16,185,129,0.38)] pointer-events-none z-40 animate-[screenFlashFade_340ms_ease-out_forwards]" />
                      )}
                      {p2SplitFlash === 'err' && (
                        <div className="absolute inset-0 border-4 border-amber-400/80 bg-amber-400/12 shadow-[inset_0_0_40px_rgba(251,191,36,0.34)] pointer-events-none z-40 animate-[screenFlashFade_320ms_ease-out_forwards]" />
                      )}
                      <PersonalPlayerHudStrip
                        playerNumber={2}
                        playerName={player2Name || 'Pemain 2'}
                        avatarGender={avatar2Gender}
                        currentLevel={p2CurrentLevel}
                        lives={p2Lives}
                        leafShaking={p2LeafShaking}
                        totalScore={p2TotalScore}
                        timeLeft={p2TimeLeft}
                        maxTime={p2MaxTime}
                        readingGraceLeft={p2ReadingGraceLeft}
                        difficulty={difficulty}
                        onAddReadingTime={handleP2AddReadingTime}
                      />

                      <LevelsArenaView
                        playerName={player2Name || 'Pemain 2'}
                        currentLevel={p2CurrentLevel}
                        difficulty={difficulty}
                        isSplitMode={true}
                        playerSlot={2}
                        onLevel2VisualChange={setP2Level2Visual}
                        onDialogOpenChange={setP2DialogOpen}
                        level1Deck={level1Decks.p2}
                        level2Deck={level2Decks.p2}
                        level3Deck={level3Decks.p2}
                        level4Deck={level4Decks.p2}
                        level5Deck={level5Decks.p2}
                        level6Deck={level6Decks.p2}
                        level1IntroPhase={level1IntroPhase}
                        onCompleteLevel1Intro={() => setLevel1IntroPhase('core_game')}
                        prologueActive={false}
                        prologueStage={prologueStage}
                        lives={p2Lives}
                        remedialActive={p2RemedialActive}
                        journalModalLevel={null}
                        reflectionModalLevel={null}
                        playerPosRef={player2PosRef as any}
                        partnerPosRef={playerPosRef}
                        nearbyCitizenIdx={p2NearbyCitizenIdx}
                        l4InteractTick={p2L4InteractTick}
                        l4DirectOpen={p2L4DirectOpen}
                        nearbyZoneIdx={p2NearbyZoneIdx}
                        l5InteractTick={p2L5InteractTick}
                        l5DirectOpen={p2L5DirectOpen}
                        nearbyIslandIdx={p2NearbyIslandIdx}
                        l6InteractTick={p2L6InteractTick}
                        l6DirectOpen={p2L6DirectOpen}
                        l6TouchOpen={p2L6TouchOpen}
                        l4Positions={l4NpcPositions}
                        l5Positions={l5NpcPositions}
                        completedCitizens={p2CompletedCitizens}
                        completedZones={p2CompletedZones}
                        completedIslands={p2CompletedIslands}
                        onAdvancePrologue={() => {}}
                        onSkipPrologue={() => {}}
                        onCloseJournalModal={handleCloseJournalModal}
                        onCloseReflectionAndAdvance={handleCloseReflectionAndAdvance}
                        onRetryRemedialLevel={() => {
                          setP2RemedialActive(false);
                          setP2LastMistakeNote(null);
                          setP2Lives(3);
                        }}
                        onScoreDelta={handleP2ScoreDelta}
                        onLoseLife={handleP2LoseLife}
                        onAnswerFeedback={triggerP2AnswerFlash}
                        evaluationLog={p2EvaluationLog}
                        lastMistakeNote={p2LastMistakeNote}
                        onRecordEvaluation={handleP2RecordEvaluation}
                        onLevelComplete={handleP2SplitLevelComplete}
                        onSetTimerSpec={(sec, maxSec, graceSec) => {
                          setP2TimeLeft(sec);
                          setP2MaxTime(maxSec);
                          if (typeof graceSec === 'number') {
                            setP2ReadingGraceLeft(graceSec);
                          }
                        }}
                        onUpdateClawState={(x, grabbing, itemIndex, phase) =>
                          setP2ClawState((prev) => ({
                            x,
                            grabbing,
                            itemIndex: itemIndex ?? prev.itemIndex,
                            phase: phase ?? prev.phase,
                          }))
                        }
                        onMarkCitizenDone={(idx) =>
                          setP2CompletedCitizens((prev) =>
                            prev.includes(idx) ? prev : [...prev, idx]
                          )
                        }
                        onMarkZoneDone={(idx) =>
                          setP2CompletedZones((prev) =>
                            prev.includes(idx) ? prev : [...prev, idx]
                          )
                        }
                        onMarkIslandDone={(idx) =>
                          setP2CompletedIslands((prev) =>
                            prev.includes(idx) ? prev : [...prev, idx]
                          )
                        }
                      />

                      {!paused && !p2RemedialActive && (
                        <TouchJoystickControls
                          playerSlot={2}
                          playerLabel="P2"
                          accentColor="sky"
                          layoutAlign="right"
                          onMoveVector={handleMoveVectorP2}
                          onMoveEnd={handleStopMoveP2}
                          onJump={handleJumpP2}
                          className={`absolute bottom-2.5 right-2.5 z-30 ${
                            p2DialogOpen || p2CurrentLevel === 2 || p2CurrentLevel === 3
                              ? 'max-md:hidden'
                              : ''
                          }`}
                        />
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div
              ref={arena1pRef}
              data-testid="world-pane-1p"
              data-player-x={playerPosRef.current.x.toFixed(2)}
              data-player-z={playerPosRef.current.z.toFixed(2)}
              data-player-jumping={playerPosRef.current.jumping ? '1' : '0'}
              className="relative z-20 flex-1 flex flex-col min-h-screen max-md:h-[100dvh] max-md:max-h-[100dvh] max-md:overflow-hidden pointer-events-none"
            >
              <TopHudHeader
                playerName={playerName}
                avatarGender={avatarGender}
                lives={lives}
                leafShaking={leafShaking}
                totalScore={totalScore}
                timeLeft={timeLeft}
                maxTime={maxTime}
                readingGraceLeft={readingGraceLeft}
                ecoHealth={ecoHealth}
                amanah={amanah}
                currentLevel={currentLevel}
                completedLevels={completedLevels}
                difficulty={difficulty}
                roomDisplay={formatRoomDisplay(activeRoomCode, gameMode)}
                peerCount={Object.keys(peersMap).length}
                persona={persona}
                sfxEnabled={sfxEnabled}
                isFullscreen={isFullscreen}
                onAddReadingTime={handleAddReadingTime}
                onCycleDifficulty={handleCycleDifficulty}
                onOpenRoomModal={() => {
                  audioEngine.playClickWood();
                  setRoomModalOpen(true);
                }}
                onCyclePersona={handleCyclePersona}
                onToggleSfx={handleToggleSound}
                onToggleFullscreen={handleToggleFullscreen}
                onOpenMissionMap={() => {
                  audioEngine.playClickWood();
                  setMissionMapOpen(true);
                }}
                onTogglePause={() => {
                  audioEngine.playClickWood();
                  setPaused((p) => !p);
                }}
                onRequestLogout={() => {
                  audioEngine.playClickWood();
                  setLogoutConfirmOpen(true);
                }}
              />

              <LevelsArenaView
                playerName={playerName}
                currentLevel={currentLevel}
                difficulty={difficulty}
                onLevel2VisualChange={setLevel2Visual}
                onDialogOpenChange={setP1DialogOpen}
                level1IntroPhase={level1IntroPhase}
                lookingSecondsLeft={lookingSecondsLeft}
                onAdvanceLookingToNarration={() => {
                  setLevel1IntroPhase('narration');
                  setNarrationSecondsLeft(30);
                }}
                onCompleteLevel1Intro={() => setLevel1IntroPhase('core_game')}
                roadmapActive={roadmapActive}
                completedLevels={completedLevels}
                onContinueFromRoadmap={handleContinueFromRoadmap}
                narrationSecondsLeft={narrationSecondsLeft}
                prologueActive={prologueActive}
                prologueStage={prologueStage}
                lives={lives}
                remedialActive={remedialActive}
                journalModalLevel={journalModalLevel}
                reflectionModalLevel={reflectionModalLevel}
                playerPosRef={playerPosRef}
                nearbyCitizenIdx={nearbyCitizenIdx}
                l4InteractTick={l4InteractTick}
                l4DirectOpen={l4DirectOpen}
                nearbyZoneIdx={nearbyZoneIdx}
                l5InteractTick={l5InteractTick}
                l5DirectOpen={l5DirectOpen}
                nearbyIslandIdx={nearbyIslandIdx}
                l6InteractTick={l6InteractTick}
                l6DirectOpen={l6DirectOpen}
                l6TouchOpen={l6TouchOpen}
                l4Positions={l4NpcPositions}
                l5Positions={l5NpcPositions}
                completedCitizens={completedCitizens}
                completedZones={completedZones}
                completedIslands={completedIslands}
                onAdvancePrologue={() => {
                  if (prologueStage < 3) {
                    setPrologueStage(prologueStage + 1);
                  } else {
                    audioEngine.stopSpeech();
                    setPrologueActive(false);
                    setRoadmapActive(true);
                  }
                }}
                onSkipPrologue={() => {
                  audioEngine.stopSpeech();
                  setPrologueActive(false);
                  setRoadmapActive(true);
                }}
                onCloseJournalModal={handleCloseJournalModal}
                onCloseReflectionAndAdvance={handleCloseReflectionAndAdvance}
                onRetryRemedialLevel={() => {
                  setRemedialActive(false);
                  setLastMistakeNote(null);
                  setLives(3);
                }}
                onScoreDelta={handleScoreDelta}
                onLoseLife={handleLoseLife}
                onAnswerFeedback={triggerAnswerFlash}
                evaluationLog={evaluationLog}
                lastMistakeNote={lastMistakeNote}
                onRecordEvaluation={handleRecordEvaluation}
                onLevelComplete={handleLevelComplete}
                onSetTimerSpec={(sec, maxSec, graceSec) => {
                  setTimeLeft(sec);
                  setMaxTime(maxSec);
                  if (typeof graceSec === 'number') {
                    setReadingGraceLeft(graceSec);
                  }
                }}
                onUpdateClawState={(x, grabbing, itemIndex, phase) =>
                  setClawState((prev) => ({
                    x,
                    grabbing,
                    itemIndex: itemIndex ?? prev.itemIndex,
                    phase: phase ?? prev.phase,
                  }))
                }
                onMarkCitizenDone={(idx) =>
                  setCompletedCitizens((prev) => (prev.includes(idx) ? prev : [...prev, idx]))
                }
                onMarkZoneDone={(idx) =>
                  setCompletedZones((prev) => (prev.includes(idx) ? prev : [...prev, idx]))
                }
                onMarkIslandDone={(idx) =>
                  setCompletedIslands((prev) => (prev.includes(idx) ? prev : [...prev, idx]))
                }
              />

              {!prologueActive &&
                !roadmapActive &&
                level1IntroPhase === 'core_game' &&
                !paused &&
                !remedialActive &&
                journalModalLevel === null &&
                reflectionModalLevel === null && (
                  <TouchJoystickControls
                    playerLabel="GERAK"
                    accentColor="emerald"
                    layoutAlign="left"
                    onMoveVector={handleMoveVectorP1}
                    onMoveEnd={handleStopMoveP1}
                    onJump={handleJumpP1}
                    className={`fixed bottom-2.5 left-2.5 md:bottom-3 md:left-3 z-30 ${
                      p1DialogOpen || currentLevel === 2 || currentLevel === 3
                        ? 'max-md:hidden'
                        : ''
                    }`}
                  />
                )}
            </div>
          )}
        </>
      )}

      {/* =====================================================================
          HALAMAN 4: HASIL AKHIR & PIAGAM IKRAR AUTENTIK (RESULT SCREEN)
         ===================================================================== */}
      {page === 'result' && (
        <ResultPiagamView
          sessionId={sessionId}
          playerName={playerName}
          player2Name={player2Name}
          isTwoPlayer={gameMode === 'split'}
          schoolName={schoolName}
          onSchoolNameChange={setSchoolName}
          studentClass={studentClass}
          gameMode={gameMode}
          difficulty={difficulty}
          scores={scores}
          p2Scores={p2Scores}
          totalScore={totalScore}
          p2TotalScore={p2TotalScore}
          ecoHealth={ecoHealth}
          amanah={amanah}
          evaluationLog={evaluationLog}
          p2EvaluationLog={p2EvaluationLog}
          persona={persona}
          onCyclePersona={handleCyclePersona}
          onPlayAgain={() => {
            cleanupCurrentLevel();
            const nextSid = createNewSessionId();
            setSessionId(nextSid);
            setLives(3);
            setP2Lives(3);
            setScores({ c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c6: 0 });
            setP2Scores({ c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c6: 0 });
            setCompletedLevels([]);
            setEvaluationLog([]);
            setP2EvaluationLog([]);
            setLastMistakeNote(null);
            setP2LastMistakeNote(null);
            setCurrentLevel(1);
            setP2CurrentLevel(1);
            setCompletedCitizens([]);
            setCompletedZones([]);
            setCompletedIslands([]);
            setP2CompletedCitizens([]);
            setP2CompletedZones([]);
            setP2CompletedIslands([]);
            setLevel1Decks(createLevel1SplitDecks());
            setLevel2Decks(createLevel2SplitDecks());
            setLevel3Decks(createLevel3SplitDecks());
            setLevel4Decks(createLevel4SplitDecks());
            setLevel5Decks(createLevel5SplitDecks());
            setLevel6Decks(createLevel6SplitDecks());
            setL4NpcPositions(createLevel4NpcPositions());
            setL5NpcPositions(createLevel5NpcPositions());
            setPrologueActive(false);
            setPage('arena');
          }}
          onExitGame={() => {
            if (latestProgressPayloadRef.current) {
              void syncProgressCheckpoint(latestProgressPayloadRef.current, true);
            }
            cleanupCurrentLevel();
            webrtcEngine.disconnect();
            setPage('splash');
          }}
        />
      )}

      {/* =====================================================================
          MODAL 1: PETUNJUK (Halaman 1)
         ===================================================================== */}
      {guideModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-3 md:p-4">
          <div
            role="dialog"
            aria-labelledby="guide-modal-title"
            className="bg-slate-900 border-2 border-emerald-500 rounded-3xl max-w-3xl w-full p-5 md:p-7 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3.5">
              <div>
                <h2
                  id="guide-modal-title"
                  className="text-lg md:text-2xl font-black text-white tracking-wide"
                >
                  📖 PETUNJUK — PENJAGA BUMI NUSANTARA
                </h2>
                <p className="text-xs md:text-sm font-bold text-emerald-300 mt-0.5">
                  Merawat Alam Menjaga Masa Depan
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.unlockAudio();
                    audioEngine.speak(
                      'Selamat datang, Penjaga Bumi Cilik! Dalam permainan Penjaga Bumi Nusantara ini, kamu akan menjelajahi enam level tantangan mulai dari memilah sampah, memahami prinsip tiga R, mengoperasikan mesin capit, membangun kota lestari, menjaga ekosistem, hingga merancang strategi pelestarian Nusantara sebagai wujud amanah Khalifah fil Ardh.',
                      80
                    );
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-amber-200 text-xs font-extrabold cursor-pointer"
                >
                  🔊 Dengarkan Narator
                </button>
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.playClickWood();
                    audioEngine.stopSpeech();
                    setGuideModalOpen(false);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                >
                  ✕ Tutup
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs md:text-sm text-slate-200 leading-relaxed">
              {/* 1. TENTANG GAME */}
              <section className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2">
                <h3 className="text-sm md:text-base font-black text-emerald-300">
                  1. 🌿 TENTANG GAME
                </h3>
                <p className="font-bold text-amber-200">Selamat datang, Penjaga Bumi Cilik!</p>
                <p>
                  Penjaga Bumi Nusantara adalah game edukasi petualangan yang mengajakmu menjelajahi
                  berbagai lingkungan dan menyelesaikan tantangan untuk menjaga kelestarian alam.
                </p>
                <p>
                  Dalam permainan ini, kamu berperan sebagai Penjaga Bumi Cilik yang memiliki tugas
                  menjaga bumi sebagai bentuk tanggung jawab manusia sebagai{' '}
                  <strong className="text-emerald-200">Khalifah fil Ardh</strong>.
                </p>
                <p>
                  Temukan permasalahan lingkungan, pelajari penyebabnya, dan lakukan tindakan nyata
                  untuk menyelamatkan bumi!
                </p>
              </section>

              {/* 2. MISI PERMAINAN */}
              <section className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                <h3 className="text-sm md:text-base font-black text-amber-300">
                  2. 🎯 MISI PERMAINAN
                </h3>
                <p>
                  Selesaikan enam level petualangan dengan tantangan yang berbeda. Setiap level akan
                  menguji kemampuan berpikirmu mulai dari mengingat hingga menciptakan solusi.
                </p>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left border-collapse text-xs md:text-sm">
                    <thead>
                      <tr className="bg-slate-900 text-emerald-300 border-b border-slate-800">
                        <th className="py-2 px-3 font-extrabold whitespace-nowrap">Level</th>
                        <th className="py-2 px-3 font-extrabold whitespace-nowrap">Nama Misi</th>
                        <th className="py-2 px-3 font-extrabold">Tantangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-slate-200">
                      <tr>
                        <td className="py-2 px-3 font-bold text-amber-300 whitespace-nowrap">1 – C1</td>
                        <td className="py-2 px-3 font-bold text-white">Detektif Sampah</td>
                        <td className="py-2 px-3">Mengenali dan memilah berbagai jenis sampah.</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-amber-300 whitespace-nowrap">2 – C2</td>
                        <td className="py-2 px-3 font-bold text-white">Rahasia 3R</td>
                        <td className="py-2 px-3">Memahami prinsip Reduce, Reuse, dan Recycle.</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-amber-300 whitespace-nowrap">3 – C3</td>
                        <td className="py-2 px-3 font-bold text-white">Operasi Mesin Capit 3R</td>
                        <td className="py-2 px-3">Menerapkan tindakan yang tepat untuk menjaga lingkungan.</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-amber-300 whitespace-nowrap">4 – C4</td>
                        <td className="py-2 px-3 font-bold text-white">Kreasi Karya Kota Lestari</td>
                        <td className="py-2 px-3">Menganalisis permasalahan lingkungan perkotaan.</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-amber-300 whitespace-nowrap">5 – C5</td>
                        <td className="py-2 px-3 font-bold text-white">Penjaga Ekosistem</td>
                        <td className="py-2 px-3">Mengevaluasi dan memilih solusi terbaik bagi lingkungan.</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-amber-300 whitespace-nowrap">6 – C6</td>
                        <td className="py-2 px-3 font-bold text-white">Radar Nusantara</td>
                        <td className="py-2 px-3">Menciptakan rancangan pelestarian lingkungan Nusantara.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 3. ALUR PETUALANGAN */}
              <section className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2">
                <h3 className="text-sm md:text-base font-black text-sky-300">
                  3. 🗺️ ALUR PETUALANGAN
                </h3>
                <p>
                  Petualanganmu dimulai dari lingkungan sekitar dan berlanjut menuju misi
                  penyelamatan lingkungan Nusantara.
                </p>
                <ul className="space-y-1.5 pl-4 list-disc text-slate-200">
                  <li>
                    <strong>Tahap 1:</strong> Kenali dan selesaikan permasalahan sampah.
                  </li>
                  <li>
                    <strong>Tahap 2:</strong> Pelajari rahasia menjaga kebersihan dan prinsip 3R.
                  </li>
                  <li>
                    <strong>Tahap 3:</strong> Praktikkan tindakan ramah lingkungan melalui tantangan mesin capit.
                  </li>
                  <li>
                    <strong>Tahap 4:</strong> Selidiki permasalahan dan ciptakan karya untuk kota yang lebih lestari.
                  </li>
                  <li>
                    <strong>Tahap 5:</strong> Tentukan solusi terbaik untuk melindungi ekosistem.
                  </li>
                  <li>
                    <strong>Tahap 6:</strong> Rancang strategi penyelamatan lingkungan di berbagai wilayah Nusantara.
                  </li>
                </ul>
                <p className="font-semibold text-sky-200 pt-1">
                  Setiap level memiliki tantangan tersendiri. Selesaikan seluruh misi untuk
                  membuktikan bahwa kamu adalah Penjaga Bumi sejati!
                </p>
              </section>

              {/* 4. SISTEM PENILAIAN */}
              <section className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                <h3 className="text-sm md:text-base font-black text-amber-300">
                  4. 🏆 SISTEM PENILAIAN
                </h3>
                <p>Kumpulkan poin sebanyak-banyaknya dengan menyelesaikan tantangan secara tepat.</p>
                <p className="font-bold text-emerald-300">Total skor maksimal: 100 poin.</p>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left border-collapse text-xs md:text-sm">
                    <thead>
                      <tr className="bg-slate-900 text-amber-300 border-b border-slate-800">
                        <th className="py-2 px-3 font-extrabold">Skor</th>
                        <th className="py-2 px-3 font-extrabold">Penghargaan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      <tr>
                        <td className="py-2 px-3 font-bold text-white whitespace-nowrap">90–100</td>
                        <td className="py-2 px-3 font-bold text-amber-200">
                          ⭐⭐⭐ Penjaga Bumi Teladan Nusantara
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-white whitespace-nowrap">75–89</td>
                        <td className="py-2 px-3 font-semibold text-emerald-200">
                          ⭐⭐ Penjaga Alam Bijaksana
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-white whitespace-nowrap">60–74</td>
                        <td className="py-2 px-3 font-semibold text-sky-200">
                          ⭐ Sahabat Lingkungan Cilik
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-white whitespace-nowrap">Di bawah 60</td>
                        <td className="py-2 px-3 text-rose-200">Kesempatan mengikuti remedial</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="pt-1">Selama permainan, perhatikan juga dua indikator penting:</p>
                <ul className="space-y-1 pl-4 list-disc">
                  <li>
                    <strong>🌱 Eco-Health:</strong> Menggambarkan kondisi kesehatan lingkungan.
                  </li>
                  <li>
                    <strong>🛡️ Amanah:</strong> Menggambarkan tanggung jawabmu dalam menjaga bumi.
                  </li>
                </ul>
                <p className="text-emerald-200 font-semibold">
                  Kamu juga memiliki tiga daun toleransi. Jagalah daunmu dengan menyelesaikan
                  tantangan secara tepat!
                </p>
              </section>

              {/* 5. TUJUAN PERMAINAN */}
              <section className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2">
                <h3 className="text-sm md:text-base font-black text-emerald-300">
                  5. 💚 TUJUAN PERMAINAN
                </h3>
                <p>Melalui permainan ini, kamu diharapkan mampu:</p>
                <ol className="space-y-1 pl-5 list-decimal text-slate-200">
                  <li>Mengenali berbagai permasalahan lingkungan.</li>
                  <li>Memahami pentingnya menjaga kebersihan dan kelestarian alam.</li>
                  <li>Menerapkan perilaku ramah lingkungan dalam kehidupan sehari-hari.</li>
                  <li>Menganalisis penyebab kerusakan lingkungan.</li>
                  <li>Memilih solusi terbaik untuk mengatasi permasalahan lingkungan.</li>
                  <li>Merancang aksi nyata untuk menjaga bumi.</li>
                </ol>
              </section>

              {/* 6. PESAN PENJAGA BUMI */}
              <section className="bg-emerald-950/40 border border-emerald-700/60 rounded-2xl p-4 space-y-2">
                <h3 className="text-sm md:text-base font-black text-emerald-300">
                  6. 🌏 PESAN PENJAGA BUMI
                </h3>
                <p className="font-bold text-amber-200">Ingatlah, teman-teman!</p>
                <p>
                  Menjaga bumi bukan hanya tugas orang dewasa. Kita semua memiliki tanggung jawab
                  untuk merawat alam.
                </p>
                <p>
                  Mulailah dari hal sederhana: membuang sampah pada tempatnya, menghemat air,
                  merawat tanaman, tidak melakukan pemborosan, dan bergotong royong menjaga
                  kebersihan lingkungan.
                </p>
                <p className="font-extrabold text-emerald-200">
                  Bumi adalah amanah. Jagalah hari ini untuk kehidupan esok hari!
                </p>
              </section>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  audioEngine.playClickWood();
                  setGuideModalOpen(false);
                }}
                className="btn-clay-slate px-5 py-2 rounded-xl text-sm font-extrabold text-white border border-slate-700 cursor-pointer"
              >
                ✕ Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 1B: PETUNJUK CARA BERMAIN DAN PENGGUNAAN KONTROL (Halaman 2)
         ===================================================================== */}
      {howToPlayModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-3 md:p-4">
          <div
            role="dialog"
            aria-labelledby="howtoplay-modal-title"
            className="bg-slate-900 border-2 border-amber-400 rounded-3xl max-w-4xl w-full p-5 md:p-7 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3.5">
              <div>
                <h2
                  id="howtoplay-modal-title"
                  className="text-lg md:text-2xl font-black text-amber-300 tracking-wide"
                >
                  🎮 PETUNJUK CARA BERMAIN DAN PENGGUNAAN KONTROL
                </h2>
                <p className="text-xs md:text-sm font-bold text-white mt-0.5">
                  PENJAGA BUMI NUSANTARA — Panduan Bermain untuk Penjaga Bumi Cilik
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.unlockAudio();
                    audioEngine.speak(
                      'Petunjuk cara bermain dan penggunaan kontrol. Pilih mode satu pemain, dua pemain, atau mode kelas. Gunakan tombol W A S D, tanda panah, atau joystick layar sentuh untuk menggerakkan karakter dan menyelesaikan enam misi pelestarian alam.',
                      80
                    );
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold cursor-pointer"
                >
                  🔊 Dengarkan Narator
                </button>
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.playClickWood();
                    audioEngine.stopSpeech();
                    setHowToPlayModalOpen(false);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                >
                  ✕ Tutup
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs md:text-sm text-slate-200 leading-relaxed">
              <div className="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-4 space-y-1.5">
                <p className="font-bold text-amber-200">Selamat datang, Penjaga Bumi Cilik!</p>
                <p>
                  Ikuti petunjuk berikut agar kamu dapat menjelajahi enam level, mengendalikan
                  karakter, menyelesaikan tantangan, dan menjalankan misi menjaga lingkungan
                  Nusantara.
                </p>
              </div>

              {/* A. MEMULAI PERMAINAN */}
              <section className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2">
                <h3 className="text-sm md:text-base font-black text-emerald-300">
                  A. MEMULAI PERMAINAN
                </h3>
                <ol className="space-y-1 pl-5 list-decimal">
                  <li>Masukkan nama pemain pada kolom identitas.</li>
                  <li>Pilih mode permainan yang ingin digunakan.</li>
                  <li>Jika bermain menggunakan Mode Kelas, buat atau masukkan kode ruangan.</li>
                  <li>Pilih pengaturan suara narator dan musik permainan.</li>
                  <li>Pelajari kontrol permainan sesuai perangkat yang digunakan.</li>
                  <li>
                    Tekan tombol <strong>MULAI MISI PELESTARIAN ALAM →</strong> untuk memulai
                    petualangan.
                  </li>
                  <li>Ikuti narasi pembuka dan instruksi dari karakter pemandu.</li>
                </ol>
              </section>

              {/* B. PILIHAN MODE PERMAINAN */}
              <section className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h3 className="text-sm md:text-base font-black text-amber-300">
                  B. PILIHAN MODE PERMAINAN
                </h3>
                <p>Terdapat tiga pilihan mode permainan:</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-slate-900 border border-emerald-500/40 rounded-xl p-3 space-y-1.5">
                    <div className="font-black text-emerald-300">1. MODE SOLO (1 PEMAIN — 1P)</div>
                    <p className="text-[11px] font-bold text-amber-200">Bermain mandiri</p>
                    <p className="text-xs text-slate-300">
                      Satu siswa memainkan seluruh enam level secara mandiri, tanpa membutuhkan
                      kode ruangan.
                    </p>
                    <div className="text-xs font-bold text-white pt-1">Cara bermain:</div>
                    <ol className="text-xs space-y-0.5 pl-4 list-decimal text-slate-300">
                      <li>Masukkan satu nama pemain.</li>
                      <li>Pilih Mode 1P (Solo).</li>
                      <li>Tidak perlu mengisi Room Code.</li>
                      <li>Tekan Mulai Misi Pelestarian Alam.</li>
                      <li>Selesaikan enam level sesuai petunjuk.</li>
                    </ol>
                  </div>

                  <div className="bg-slate-900 border border-sky-500/40 rounded-xl p-3 space-y-1.5">
                    <div className="font-black text-sky-300">2. MODE KOMPETISI (2 PEMAIN — 2P)</div>
                    <p className="text-[11px] font-bold text-amber-200">Bermain berdua</p>
                    <p className="text-xs text-slate-300">
                      Dua siswa bermain menggunakan satu komputer atau laptop dengan sistem kontrol
                      masing-masing.
                    </p>
                    <div className="text-xs font-bold text-white pt-1">Cara bermain:</div>
                    <ol className="text-xs space-y-0.5 pl-4 list-decimal text-slate-300">
                      <li>Masukkan nama Pemain 1 dan Pemain 2.</li>
                      <li>Pilih Mode 2P (Kompetisi).</li>
                      <li>Tidak perlu mengisi Room Code.</li>
                      <li>Pemain 1 menggunakan tombol WASD.</li>
                      <li>Pemain 2 menggunakan tombol panah.</li>
                      <li>Selesaikan tantangan dan bandingkan hasil permainan.</li>
                    </ol>
                  </div>

                  <div className="bg-slate-900 border border-purple-500/40 rounded-xl p-3 space-y-1.5">
                    <div className="font-black text-purple-300">
                      3. MODE KELAS (2–50 SISWA)
                    </div>
                    <p className="text-[11px] font-bold text-amber-200">Multiplayer kelas</p>
                    <p className="text-xs text-slate-300">
                      Guru dan siswa bermain dalam satu sesi kelas menggunakan Room Code.
                    </p>
                    <div className="text-xs font-bold text-white pt-1">Untuk Guru (Host):</div>
                    <ol className="text-xs space-y-0.5 pl-4 list-decimal text-slate-300">
                      <li>Pilih Mode Kelas.</li>
                      <li>Masukkan nama guru atau identitas kelas.</li>
                      <li>Tekan tombol Host.</li>
                      <li>Sistem menghasilkan Room Code.</li>
                      <li>Bagikan kode kepada seluruh siswa.</li>
                      <li>Tunggu siswa bergabung ke ruang permainan.</li>
                    </ol>
                    <div className="text-xs font-bold text-white pt-1">Untuk Siswa:</div>
                    <ol className="text-xs space-y-0.5 pl-4 list-decimal text-slate-300">
                      <li>Pilih Mode Kelas.</li>
                      <li>Masukkan nama masing-masing.</li>
                      <li>Masukkan Room Code dari guru.</li>
                      <li>Tekan tombol Gabung.</li>
                      <li>Tunggu sampai berhasil terhubung.</li>
                      <li>Mulai permainan setelah guru membuka sesi.</li>
                    </ol>
                  </div>
                </div>

                <p className="text-xs text-sky-200">
                  Mode Kelas menggunakan sinkronisasi multiplayer WebRTC P2P sesuai rancangan
                  aplikasi.{' '}
                  <strong className="text-amber-300">
                    Penting: Room Code hanya digunakan pada Mode Kelas. Mode Solo dan Mode
                    Kompetisi tidak memerlukan kode ruangan.
                  </strong>
                </p>
              </section>

              {/* C. KONTROL PERMAINAN BERDASARKAN PERANGKAT */}
              <section className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h3 className="text-sm md:text-base font-black text-sky-300">
                  C. KONTROL PERMAINAN BERDASARKAN PERANGKAT
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
                    <div className="font-extrabold text-emerald-300">
                      1. Kontrol HP &amp; Tablet (Layar Sentuh)
                    </div>
                    <div className="text-xs font-bold text-white">Joystick Virtual:</div>
                    <ul className="text-xs space-y-0.5 pl-4 list-disc text-slate-300">
                      <li>Geser ke atas untuk bergerak maju.</li>
                      <li>Geser ke bawah untuk bergerak mundur.</li>
                      <li>Geser ke kiri untuk bergerak ke kiri.</li>
                      <li>Geser ke kanan untuk bergerak ke kanan.</li>
                      <li>Geser secara diagonal untuk bergerak menyerong.</li>
                      <li>Lepaskan joystick untuk menghentikan gerakan.</li>
                    </ul>
                    <div className="text-xs font-bold text-white pt-1">Tombol Aksi Virtual:</div>
                    <ul className="text-xs space-y-1 text-slate-300">
                      <li>
                        <strong className="text-amber-300">LOMPAT:</strong> Melompat jika tersedia
                        pada level.
                      </li>
                      <li>
                        <strong className="text-amber-300">INTERAKSI:</strong> Berinteraksi dengan
                        NPC atau objek.
                      </li>
                      <li>
                        <strong className="text-amber-300">SENTUH / TAP:</strong> Memilih jawaban
                        dan mengaktifkan tombol.
                      </li>
                      <li>
                        <strong className="text-amber-300">SERET / DRAG:</strong> Memindahkan objek
                        ke tempat yang sesuai.
                      </li>
                    </ul>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
                    <div className="font-extrabold text-sky-300">
                      2. Kontrol Laptop &amp; Komputer (Keyboard)
                    </div>
                    <div className="text-xs font-bold text-white">Tombol Navigasi WASD:</div>
                    <div className="grid grid-cols-4 gap-1.5 text-center text-[11px] font-black">
                      <div className="bg-slate-950 border border-slate-700 rounded-lg py-1.5">
                        <div className="text-emerald-300">W</div>
                        <div className="text-[10px] text-slate-400">MAJU</div>
                      </div>
                      <div className="bg-slate-950 border border-slate-700 rounded-lg py-1.5">
                        <div className="text-emerald-300">A</div>
                        <div className="text-[10px] text-slate-400">KIRI</div>
                      </div>
                      <div className="bg-slate-950 border border-slate-700 rounded-lg py-1.5">
                        <div className="text-emerald-300">S</div>
                        <div className="text-[10px] text-slate-400">MUNDUR</div>
                      </div>
                      <div className="bg-slate-950 border border-slate-700 rounded-lg py-1.5">
                        <div className="text-emerald-300">D</div>
                        <div className="text-[10px] text-slate-400">KANAN</div>
                      </div>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-slate-800">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-950 text-amber-300 border-b border-slate-800">
                            <th className="py-1.5 px-2.5 font-extrabold">Tombol</th>
                            <th className="py-1.5 px-2.5 font-extrabold">Fungsi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-300">
                          <tr>
                            <td className="py-1 px-2.5 font-bold text-white">E</td>
                            <td className="py-1 px-2.5">Interaksi dengan NPC atau objek</td>
                          </tr>
                          <tr>
                            <td className="py-1 px-2.5 font-bold text-white">Spasi</td>
                            <td className="py-1 px-2.5">Aksi khusus atau capit sesuai level</td>
                          </tr>
                          <tr>
                            <td className="py-1 px-2.5 font-bold text-white">Enter</td>
                            <td className="py-1 px-2.5">Melepaskan objek pada Level 3</td>
                          </tr>
                          <tr>
                            <td className="py-1 px-2.5 font-bold text-white">Panah Kiri/Kanan/Atas</td>
                            <td className="py-1 px-2.5">Navigasi tertentu sesuai level</td>
                          </tr>
                          <tr>
                            <td className="py-1 px-2.5 font-bold text-white">Esc / P</td>
                            <td className="py-1 px-2.5">Jeda permainan / kontrol layar penuh</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </section>

              {/* D. KONTROL KHUSUS SETIAP LEVEL */}
              <section className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                <h3 className="text-sm md:text-base font-black text-amber-300">
                  D. KONTROL KHUSUS SETIAP LEVEL
                </h3>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left border-collapse text-xs md:text-sm">
                    <thead>
                      <tr className="bg-slate-900 text-emerald-300 border-b border-slate-800">
                        <th className="py-2 px-3 font-extrabold">Level</th>
                        <th className="py-2 px-3 font-extrabold">HP / Tablet</th>
                        <th className="py-2 px-3 font-extrabold">Laptop / PC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-200">
                      <tr>
                        <td className="py-1.5 px-3 font-bold text-white">1 – Detektif Sampah</td>
                        <td className="py-1.5 px-3">Swipe / tap tong sampah</td>
                        <td className="py-1.5 px-3">Panah kiri, kanan, atas / klik</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-bold text-white">2 – Rahasia 3R</td>
                        <td className="py-1.5 px-3">Tap huruf</td>
                        <td className="py-1.5 px-3">Klik atau ketik huruf</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-bold text-white">3 – Operasi Mesin Capit 3R</td>
                        <td className="py-1.5 px-3">Kiri, kanan, capit, lepas</td>
                        <td className="py-1.5 px-3">A, D, Spasi, Enter / klik tombol</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-bold text-white">4 – Kreasi Karya Kota Lestari</td>
                        <td className="py-1.5 px-3">Joystick / Tap warga</td>
                        <td className="py-1.5 px-3">W, A, S, D, E / klik warga</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-bold text-white">5 – Penjaga Ekosistem</td>
                        <td className="py-1.5 px-3">Joystick / Tap kartu solusi</td>
                        <td className="py-1.5 px-3">W, A, S, D, E / klik kartu solusi</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-bold text-white">6 – Radar Nusantara</td>
                        <td className="py-1.5 px-3">Joystick / Tap tab dan pilihan</td>
                        <td className="py-1.5 px-3">W, A, S, D / klik tab dan pilihan</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                    <div className="font-extrabold text-amber-300">E — Tombol Interaksi</div>
                    <p className="text-slate-300 mt-0.5">
                      Digunakan ketika mendekati warga (NPC), objek, atau fasilitas yang dapat
                      diajak berinteraksi.
                    </p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                    <div className="font-extrabold text-emerald-300">Tombol Capit</div>
                    <p className="text-slate-300 mt-0.5">
                      Mengoperasikan mesin capit pada Level 3 untuk mengambil objek yang menjadi
                      bagian dari tantangan.
                    </p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                    <div className="font-extrabold text-sky-300">Tombol Pilihan</div>
                    <p className="text-slate-300 mt-0.5">
                      Digunakan untuk menentukan jawaban, memilih kebijakan, atau menyusun rancangan.
                    </p>
                  </div>
                </div>
              </section>

              {/* E. PANDUAN KHUSUS MODE KOMPETISI (2 PEMAIN) */}
              <section className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                <h3 className="text-sm md:text-base font-black text-emerald-300">
                  E. PANDUAN KHUSUS MODE KOMPETISI (2 PEMAIN)
                </h3>
                <p>Dalam Mode Kompetisi, kedua pemain menggunakan satu keyboard atau layar yang sama.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-3">
                    <div className="font-black text-emerald-300">PEMAIN 1 (Sisi Kiri)</div>
                    <div className="font-mono font-bold text-white mt-0.5">W A S D</div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Navigasi karakter menggunakan tombol WASD atau joystick kiri.
                    </p>
                  </div>
                  <div className="bg-sky-950/30 border border-sky-500/40 rounded-xl p-3">
                    <div className="font-black text-sky-300">PEMAIN 2 (Sisi Kanan)</div>
                    <div className="font-mono font-bold text-white mt-0.5">↑ ← ↓ →</div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Navigasi karakter menggunakan tombol panah atau joystick kanan.
                    </p>
                  </div>
                </div>
                <ol className="space-y-1 pl-5 list-decimal text-slate-300">
                  <li>Pemain 1 berada pada sisi kiri layar.</li>
                  <li>Pemain 2 berada pada sisi kanan layar.</li>
                  <li>Kedua pemain menjalankan tantangan yang sama.</li>
                  <li>Keduanya berusaha menyelesaikan misi dengan cepat dan tepat.</li>
                  <li>Hasil permainan digunakan untuk membandingkan pencapaian kedua pemain.</li>
                </ol>
                <p className="text-xs text-amber-200 italic">
                  Catatan: Pemetaan tombol khusus untuk interaksi, capit, dan aksi lain pada kedua
                  pemain mengikuti kontrol pada panel permainan masing-masing sisi.
                </p>
              </section>

              {/* F. PANDUAN KHUSUS MODE KELAS (MULTIPLAYER) */}
              <section className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                <h3 className="text-sm md:text-base font-black text-purple-300">
                  F. PANDUAN KHUSUS MODE KELAS (MULTIPLAYER)
                </h3>
                <p>
                  Mode ini digunakan untuk pembelajaran bersama di kelas dengan guru sebagai pembuat
                  ruang permainan dan siswa sebagai peserta.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-3">
                    <div className="font-black text-amber-300 mb-1">GURU – HOST</div>
                    <ol className="text-xs space-y-0.5 pl-4 list-decimal text-slate-300">
                      <li>Pilih Mode Kelas.</li>
                      <li>Tekan tombol Host untuk membuat ruang kelas.</li>
                      <li>Salin atau tampilkan Room Code.</li>
                      <li>Bagikan kode kepada siswa.</li>
                      <li>Tunggu siswa masuk ke lobi.</li>
                      <li>Mulai sesi pembelajaran.</li>
                    </ol>
                  </div>
                  <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-3">
                    <div className="font-black text-emerald-300 mb-1">SISWA – PESERTA</div>
                    <ol className="text-xs space-y-0.5 pl-4 list-decimal text-slate-300">
                      <li>Pilih Mode Kelas.</li>
                      <li>Masukkan nama pemain.</li>
                      <li>Masukkan Room Code dari guru.</li>
                      <li>Tekan Gabung Room.</li>
                      <li>Tunggu sampai terhubung.</li>
                      <li>Ikuti instruksi guru untuk memulai permainan.</li>
                    </ol>
                  </div>
                </div>
                <ul className="space-y-1 pl-4 list-disc text-xs text-slate-300">
                  <li>
                    Jika menggunakan HP atau tablet, setiap siswa menggunakan joystick virtual dan
                    tombol sentuh pada perangkat masing-masing.
                  </li>
                  <li>
                    Jika menggunakan laptop atau komputer, siswa menggunakan keyboard dan mouse
                    masing-masing.
                  </li>
                  <li>Setiap siswa mengendalikan karakter permainannya sendiri.</li>
                  <li>Siswa mengikuti enam level sesuai sesi yang diselenggarakan.</li>
                  <li>
                    Perolehan skor dan progres dapat ditampilkan melalui sistem multiplayer dan
                    papan peringkat kelas.
                  </li>
                </ul>
                <p className="text-xs text-sky-200">
                  <strong>Hal yang perlu diperhatikan:</strong> Mode Kelas berbeda dengan Mode
                  Kompetisi. Mode Kelas menggunakan koneksi jaringan dan Room Code, sedangkan Mode
                  Kompetisi menggunakan satu perangkat dan satu keyboard.
                </p>
              </section>

              {/* G. TOMBOL PENDUKUNG SELAMA BERMAIN */}
              <section className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2">
                <h3 className="text-sm md:text-base font-black text-sky-300">
                  G. TOMBOL PENDUKUNG SELAMA BERMAIN
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                    <strong className="text-emerald-300">🔊 SUARA / SOUND</strong>
                    <p className="text-slate-300 mt-0.5">
                      Mengaktifkan atau mematikan musik dan efek suara permainan.
                    </p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                    <strong className="text-amber-300">🎙️ NARATOR</strong>
                    <p className="text-slate-300 mt-0.5">
                      Mengaktifkan atau memilih suara narasi pemandu permainan.
                    </p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                    <strong className="text-sky-300">⏸️ PAUSE / JEDA</strong>
                    <p className="text-slate-300 mt-0.5">
                      Menghentikan sementara permainan dan membuka menu jeda.
                    </p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                    <strong className="text-emerald-300">▶️ LANJUTKAN / RESUME</strong>
                    <p className="text-slate-300 mt-0.5">
                      Melanjutkan permainan yang sedang dijeda.
                    </p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                    <strong className="text-sky-300">⛶ FULLSCREEN</strong>
                    <p className="text-slate-300 mt-0.5">
                      Memperbesar tampilan game hingga memenuhi layar perangkat.
                    </p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                    <strong className="text-amber-300">🗺️ PETA MISI</strong>
                    <p className="text-slate-300 mt-0.5">
                      Melihat perkembangan misi dan level permainan sesuai hak akses yang tersedia.
                    </p>
                  </div>
                </div>
              </section>

              {/* H. MEMAHAMI INDIKATOR PERMAINAN */}
              <section className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                <h3 className="text-sm md:text-base font-black text-emerald-300">
                  H. MEMAHAMI INDIKATOR PERMAINAN
                </h3>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left border-collapse text-xs md:text-sm">
                    <thead>
                      <tr className="bg-slate-900 text-amber-300 border-b border-slate-800">
                        <th className="py-2 px-3 font-extrabold">Indikator</th>
                        <th className="py-2 px-3 font-extrabold">Fungsi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-200">
                      <tr>
                        <td className="py-1.5 px-3 font-bold">🍃 3 Daun Toleransi</td>
                        <td className="py-1.5 px-3">Menunjukkan kesempatan yang dimiliki pemain.</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-bold">🏆 Skor</td>
                        <td className="py-1.5 px-3">Menampilkan poin yang diperoleh.</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-bold">⏱️ Timer</td>
                        <td className="py-1.5 px-3">Menampilkan waktu penyelesaian tantangan.</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-bold">🌱 Eco-Health</td>
                        <td className="py-1.5 px-3">Menunjukkan kondisi kesehatan ekosistem.</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-bold">🛡️ Amanah</td>
                        <td className="py-1.5 px-3">Menunjukkan indikator tanggung jawab pemain.</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-bold">C1–C6</td>
                        <td className="py-1.5 px-3">Menunjukkan kemajuan enam level permainan.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 space-y-1 text-xs">
                  <div className="font-extrabold text-emerald-300">Aturan penting:</div>
                  <ul className="space-y-0.5 pl-4 list-disc text-slate-200">
                    <li>Usahakan menyelesaikan tantangan dengan benar.</li>
                    <li>Hindari tindakan yang merusak lingkungan.</li>
                    <li>Perhatikan waktu dan kesempatan yang tersedia.</li>
                    <li>Baca umpan balik setiap kali menyelesaikan tantangan.</li>
                    <li>
                      Jika permainan menyediakan sesi pemulihan, manfaatkan kesempatan tersebut
                      untuk belajar kembali.
                    </li>
                  </ul>
                </div>
              </section>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  audioEngine.playClickWood();
                  setHowToPlayModalOpen(false);
                }}
                className="btn-clay-amber px-5 py-2 rounded-xl text-sm font-extrabold text-slate-950 cursor-pointer"
              >
                ✕ Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 1C: TUJUAN PEMBELAJARAN DAN TARGET CAPAIAN (Halaman 2)
         ===================================================================== */}
      {learningGoalsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-3 md:p-4">
          <div
            role="dialog"
            aria-labelledby="learning-goals-modal-title"
            className="bg-slate-900 border-2 border-fuchsia-400 rounded-3xl max-w-4xl w-full p-5 md:p-7 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3.5">
              <div>
                <h2
                  id="learning-goals-modal-title"
                  className="text-lg md:text-2xl font-black text-fuchsia-300 tracking-wide"
                >
                  🎯 TUJUAN PEMBELAJARAN DAN TARGET CAPAIAN
                </h2>
                <p className="text-xs md:text-sm font-bold text-slate-300 mt-0.5">
                  Penjaga Bumi Nusantara — Pendidikan Agama Islam &amp; Budi Pekerti (Fase C)
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.unlockAudio();
                    audioEngine.speak(
                      'Tujuan pembelajaran dan target capaian Fase C. Melalui permainan ini, peserta didik memahami amanah manusia sebagai Khalifah fil Ardh serta menguasai enam tingkatan berpikir dari C1 Mengenali hingga C6 Mencipta solusi pelestarian lingkungan Nusantara.',
                      80
                    );
                  }}
                  className="px-3 py-1.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-extrabold cursor-pointer"
                >
                  🔊 Dengarkan Narator
                </button>
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.playClickWood();
                    audioEngine.stopSpeech();
                    setLearningGoalsModalOpen(false);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                >
                  ✕ Tutup
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs md:text-sm text-slate-200 leading-relaxed">
              {/* 1. TUJUAN PEMBELAJARAN */}
              <section className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2">
                <h3 className="text-sm md:text-base font-black text-amber-300">
                  🎯 TUJUAN PEMBELAJARAN
                </h3>
                <p>
                  Melalui permainan edukasi Penjaga Bumi Nusantara, peserta didik diharapkan mampu:
                </p>
                <ol className="space-y-1.5 pl-5 list-decimal text-slate-200">
                  <li>
                    Memahami makna manusia sebagai <strong>Khalīfah fī al-Arḍ</strong> dan
                    tanggung jawabnya dalam menjaga kelestarian lingkungan sebagai bentuk akhlak
                    terpuji.
                  </li>
                  <li>
                    Mengenali berbagai jenis sampah, memahami prinsip{' '}
                    <strong>3R (Reduce, Reuse, Recycle)</strong>, serta membedakan tindakan yang
                    menjaga dan merusak lingkungan.
                  </li>
                  <li>
                    Menerapkan perilaku ramah lingkungan melalui pemilahan sampah, penghematan
                    sumber daya, pemanfaatan barang bekas, dan tindakan pencegahan kerusakan alam.
                  </li>
                  <li>
                    Menganalisis permasalahan lingkungan berdasarkan informasi, fakta, kondisi
                    ekosistem, serta keamanan dan kelayakan bahan yang digunakan.
                  </li>
                  <li>
                    Mengevaluasi berbagai alternatif solusi permasalahan lingkungan dengan
                    mempertimbangkan efektivitas, biaya, dampak ekologis, dan skala prioritas.
                  </li>
                  <li>
                    Merancang strategi pelestarian lingkungan Nusantara berdasarkan permasalahan nyata
                    dan informasi faktual sebagai wujud tanggung jawab manusia dalam memakmurkan
                    bumi.
                  </li>
                </ol>
              </section>

              {/* 2. TARGET CAPAIAN PEMBELAJARAN */}
              <section className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                <h3 className="text-sm md:text-base font-black text-emerald-300">
                  🌱 TARGET CAPAIAN PEMBELAJARAN
                </h3>
                <p>Peserta didik diharapkan mencapai enam target berikut:</p>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left border-collapse text-xs md:text-sm">
                    <thead>
                      <tr className="bg-slate-900 text-emerald-300 border-b border-slate-800">
                        <th className="py-2 px-3 font-extrabold whitespace-nowrap">Level</th>
                        <th className="py-2 px-3 font-extrabold whitespace-nowrap">Kemampuan</th>
                        <th className="py-2 px-3 font-extrabold">Target capaian yang diharapkan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-200">
                      <tr>
                        <td className="py-2 px-3 font-bold text-amber-300 whitespace-nowrap">
                          C1 – Mengingat
                        </td>
                        <td className="py-2 px-3 font-bold text-white whitespace-nowrap">
                          Mengenali
                        </td>
                        <td className="py-2 px-3">
                          Mampu mengidentifikasi dan mengelompokkan sampah organik, anorganik, dan
                          B3 dengan tepat.
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-amber-300 whitespace-nowrap">
                          C2 – Memahami
                        </td>
                        <td className="py-2 px-3 font-bold text-white whitespace-nowrap">
                          Menjelaskan
                        </td>
                        <td className="py-2 px-3">
                          Mampu memahami prinsip 3R dan menjelaskan amanah menjaga lingkungan dalam
                          perspektif Islam.
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-amber-300 whitespace-nowrap">
                          C3 – Menerapkan
                        </td>
                        <td className="py-2 px-3 font-bold text-white whitespace-nowrap">
                          Mempraktikkan
                        </td>
                        <td className="py-2 px-3">
                          Mampu menerapkan prinsip 3R melalui pemilihan tindakan yang tepat untuk
                          mengurangi pemborosan dan kerusakan alam.
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-amber-300 whitespace-nowrap">
                          C4 – Menganalisis
                        </td>
                        <td className="py-2 px-3 font-bold text-white whitespace-nowrap">
                          Menyelidiki
                        </td>
                        <td className="py-2 px-3">
                          Mampu menganalisis permasalahan lingkungan, membedakan fakta dan pendapat,
                          serta menentukan kelayakan bahan yang aman dan fungsional.
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-amber-300 whitespace-nowrap">
                          C5 – Mengevaluasi
                        </td>
                        <td className="py-2 px-3 font-bold text-white whitespace-nowrap">
                          Menimbang
                        </td>
                        <td className="py-2 px-3">
                          Mampu membandingkan dan mengevaluasi alternatif solusi berdasarkan
                          efektivitas, biaya, dampak lingkungan, dan prioritas.
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-amber-300 whitespace-nowrap">
                          C6 – Mencipta
                        </td>
                        <td className="py-2 px-3 font-bold text-white whitespace-nowrap">
                          Merancang
                        </td>
                        <td className="py-2 px-3">
                          Mampu menyusun strategi pelestarian lingkungan Nusantara berdasarkan data
                          dan permasalahan lingkungan nyata.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 3. INDIKATOR KEBERHASILAN */}
              <section className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2">
                <h3 className="text-sm md:text-base font-black text-sky-300">
                  3. INDIKATOR KEBERHASILAN
                </h3>
                <p>Setelah menyelesaikan seluruh permainan, peserta didik diharapkan:</p>
                <ul className="space-y-1 pl-4 list-disc text-slate-200">
                  <li>Mampu menyelesaikan enam level permainan secara berurutan.</li>
                  <li>Memperoleh skor akhir minimal 75 sebagai target ketuntasan permainan.</li>
                  <li>Menunjukkan peningkatan pemahaman dari C1 sampai C6.</li>
                  <li>
                    Mampu memberikan alasan atas keputusan yang diambil dalam menyelesaikan masalah
                    lingkungan.
                  </li>
                  <li>
                    Mampu menyusun rencana aksi sederhana untuk menjaga lingkungan di rumah, sekolah,
                    dan masyarakat.
                  </li>
                  <li>Menunjukkan sikap peduli, tanggung jawab, hemat, dan gotong royong.</li>
                </ul>
              </section>

              {/* 4. HASIL AKHIR YANG DIHARAPKAN */}
              <section className="bg-fuchsia-950/30 border border-fuchsia-500/40 rounded-2xl p-4 space-y-2.5">
                <h3 className="text-sm md:text-base font-black text-fuchsia-300">
                  4. HASIL AKHIR YANG DIHARAPKAN — PROFIL PENJAGA BUMI CILIK
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <div className="font-black text-amber-300">🧠 Berpikir Kritis</div>
                    <p className="text-slate-300 mt-0.5">
                      Mampu mengenali, menganalisis, dan mengevaluasi permasalahan lingkungan.
                    </p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <div className="font-black text-emerald-300">🌟 Berakhlak Mulia</div>
                    <p className="text-slate-300 mt-0.5">
                      Memahami bahwa menjaga alam merupakan bagian dari amanah manusia sebagai
                      khalifah di bumi.
                    </p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <div className="font-black text-sky-300">🌿 Peduli Lingkungan</div>
                    <p className="text-slate-300 mt-0.5">
                      Membiasakan perilaku menjaga kebersihan, menghemat sumber daya, dan mencegah
                      kerusakan alam.
                    </p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <div className="font-black text-fuchsia-300">💡 Kreatif dan Solutif</div>
                    <p className="text-slate-300 mt-0.5">
                      Mampu merancang gagasan dan tindakan nyata untuk pelestarian lingkungan.
                    </p>
                  </div>
                </div>
              </section>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  audioEngine.playClickWood();
                  setLearningGoalsModalOpen(false);
                }}
                className="btn-clay-slate px-5 py-2 rounded-xl text-sm font-extrabold text-white border border-slate-700 cursor-pointer"
              >
                ✕ Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: PETA MISI (UJI LEVEL BEBAS UNTUK EVALUASI JURI)
         ===================================================================== */}
      {missionMapOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4 no-print">
          <div
            role="dialog"
            aria-labelledby="mission-map-title"
            className="bg-slate-900 border-2 border-amber-400 rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="text-xs font-extrabold text-amber-400 uppercase">
                  NAVIGASI KHUSUS EVALUASI JURI &amp; GURU
                </div>
                <h2 id="mission-map-title" className="text-xl font-extrabold text-white">
                  🗺️ Peta Misi Nusantara (Loncat Bebas Level C1 – C6)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setMissionMapOpen(false)}
                className="px-3 py-1 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕ Tutup Peta
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {LEVEL_METADATA.map((meta) => {
                const isDone = completedLevels.includes(meta.level);
                const isCurr = currentLevel === meta.level && page === 'arena';
                return (
                  <button
                    key={meta.level}
                    type="button"
                    onClick={() => handleJumpToLevel(meta.level)}
                    className={`p-4 rounded-2xl border-2 text-left flex flex-col justify-between cursor-pointer transition-transform hover:scale-102 ${
                      isCurr
                        ? 'bg-amber-500/20 border-amber-400 text-white'
                        : isDone
                        ? 'bg-emerald-950/60 border-emerald-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-emerald-400'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs font-extrabold text-amber-300 font-mono-num">
                        <span>
                          LEVEL {meta.level} · {meta.bloomCode}
                        </span>
                        <span>{meta.maxPoints} Poin</span>
                      </div>
                      <div className="text-base font-extrabold text-white mt-1">{meta.name}</div>
                      <div className="text-[11px] text-emerald-300 font-semibold">
                        {meta.bloomLabel} · {meta.domain}
                      </div>
                    </div>
                    <div className="mt-3 text-[11px] font-bold text-sky-300">
                      📷 {meta.cameraView} ➔
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                data-testid="btn-open-tactical-roadmap"
                onClick={() => {
                  audioEngine.playClickWood();
                  audioEngine.stopSpeech();
                  setMissionMapOpen(false);
                  setPrologueActive(false);
                  setRoadmapActive(true);
                  setPage('arena');
                }}
                className="btn-clay-amber px-4 py-2 rounded-xl text-xs font-extrabold text-slate-950 cursor-pointer"
              >
                🗺️ Buka Roadmap Peta Wilayah 6 Lokasi
              </button>
              <button
                type="button"
                onClick={() => {
                  audioEngine.playCrystalSeal();
                  cleanupCurrentLevel();
                  setMissionMapOpen(false);
                  // Populate exemplary demo scores if jumping directly to Piagam with 0 score
                  if (totalScore === 0) {
                    setScores({ c1: 15, c2: 15, c3: 15, c4: 20, c5: 15, c6: 20 });
                    setCompletedLevels([1, 2, 3, 4, 5, 6]);
                  }
                  setPage('result');
                }}
                className="btn-clay-emerald px-4 py-2 rounded-xl text-xs font-extrabold text-white cursor-pointer"
              >
                📜 Buka Halaman 4 (Hasil Akhir &amp; Piagam Ikrar A4)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: JEDA PERMAINAN (PAUSE MODAL)
         ===================================================================== */}
      {paused && page === 'arena' && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4 no-print">
          <div
            role="dialog"
            aria-labelledby="pause-modal-title"
            className="bg-slate-900 border-2 border-emerald-500 rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl"
          >
            <h2 id="pause-modal-title" className="text-2xl font-extrabold text-white">
              ⏸️ Permainan Dijeda
            </h2>
            <p className="text-xs md:text-sm text-slate-300">
              Istirahat sejenak, <strong>{playerName}</strong>. Progres dan skormu saat ini (
              <strong>{totalScore} Poin</strong>) otomatis tercatat di Spreadsheet.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  audioEngine.playClickWood();
                  setPaused(false);
                }}
                className="btn-clay-emerald py-3 rounded-2xl text-sm font-extrabold text-white cursor-pointer"
              >
                ▶️ Lanjutkan Petualangan
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaused(false);
                  setMissionMapOpen(true);
                }}
                className="btn-clay-amber py-3 rounded-2xl text-sm font-extrabold text-slate-950 cursor-pointer"
              >
                🗺️ Pilih Level di Peta Misi
              </button>
              <button
                type="button"
                data-testid="btn-pause-finish-leaderboard"
                onClick={() => {
                  if (latestProgressPayloadRef.current) {
                    void syncProgressCheckpoint(latestProgressPayloadRef.current, true);
                  }
                  cleanupCurrentLevel();
                  setPaused(false);
                  setPage('result');
                }}
                className="bg-sky-600 hover:bg-sky-500 py-2.5 rounded-2xl text-xs font-extrabold text-white border border-sky-300/60 cursor-pointer shadow"
              >
                🏆 Selesai &amp; Lihat Peringkat Leaderboard Saat Ini ({totalScore} Poin)
              </button>
              <button
                type="button"
                onClick={() => {
                  if (latestProgressPayloadRef.current) {
                    void syncProgressCheckpoint(latestProgressPayloadRef.current, true);
                  }
                  cleanupCurrentLevel();
                  setPage('setup');
                }}
                className="btn-clay-slate py-2.5 rounded-2xl text-xs font-bold text-rose-300 border border-rose-800/50 cursor-pointer"
              >
                🚪 Kembali ke Pengaturan Pemain (Data Tersimpan)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 4: KONFIRMASI KELUAR / GANTI PEMAIN (STATE TEARDOWN)
         ===================================================================== */}
      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4 no-print">
          <div
            role="dialog"
            aria-labelledby="logout-modal-title"
            className="bg-slate-900 border-2 border-rose-500 rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl"
          >
            <h2 id="logout-modal-title" className="text-xl font-extrabold text-white">
              🚪 Keluar atau Lihat Hasil Saat Ini?
            </h2>
            <p className="text-xs md:text-sm text-slate-300">
              Data login dan aktivitas bermain <strong>{playerName}</strong> (Skor saat ini:{' '}
              <strong>{totalScore} Poin</strong>) tetap disimpan otomatis ke Google Spreadsheet
              meskipun belum menyelesaikan semua level.
            </p>
            <div className="flex flex-col gap-2.5 pt-1">
              <button
                type="button"
                data-testid="btn-logout-finish-leaderboard"
                onClick={() => {
                  if (latestProgressPayloadRef.current) {
                    void syncProgressCheckpoint(latestProgressPayloadRef.current, true);
                  }
                  cleanupCurrentLevel();
                  setLogoutConfirmOpen(false);
                  setPage('result');
                }}
                className="btn-clay-emerald w-full py-2.5 px-4 rounded-xl text-xs font-extrabold text-white cursor-pointer"
              >
                🏆 Selesai Sekarang &amp; Lihat Posisi Leaderboard ({totalScore} Poin)
              </button>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setLogoutConfirmOpen(false)}
                  className="btn-clay-slate flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-200 border border-slate-700 cursor-pointer"
                >
                  Batal, Lanjut Main
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (latestProgressPayloadRef.current) {
                      void syncProgressCheckpoint(latestProgressPayloadRef.current, true);
                    }
                    cleanupCurrentLevel();
                    webrtcEngine.disconnect();
                    setLogoutConfirmOpen(false);
                    setScores({ c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c6: 0 });
                    setCompletedLevels([]);
                    setCompletedCitizens([]);
                    setCompletedZones([]);
                    setCompletedIslands([]);
                    setPage('splash');
                  }}
                  className="bg-rose-600 hover:bg-rose-500 flex-1 px-4 py-2.5 rounded-xl text-xs font-extrabold text-white cursor-pointer"
                >
                  Ya, Keluar (Data Tersimpan)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 5: PENGATURAN ROOM & TINGKAT KESULITAN LANGSUNG DI LAYAR PERMAINAN
         ===================================================================== */}
      {roomModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4 no-print">
          <div
            role="dialog"
            aria-labelledby="room-modal-title"
            className="bg-slate-900 border-2 border-sky-400 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="text-[11px] font-extrabold text-sky-400 uppercase tracking-wider">
                  PENGATURAN LANGSUNG LAYAR PERMAINAN
                </div>
                <h2 id="room-modal-title" className="text-xl font-extrabold text-white">
                  🏫 Pengaturan Room Kelas &amp; Tingkat Kesulitan
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setRoomModalOpen(false)}
                className="px-3 py-1 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕ Tutup
              </button>
            </div>

            {/* Section 1: Tingkat Kesulitan */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="text-xs font-extrabold text-amber-300 uppercase">
                TINGKAT KESULITAN : {getDifficultyConfig(difficulty).label}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['mudah', 'sedang', 'sulit'] as const).map((d) => {
                  const cfg = getDifficultyConfig(d);
                  const active = difficulty === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        audioEngine.playClickWood();
                        setDifficulty(d);
                      }}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        active
                          ? d === 'mudah'
                            ? 'bg-emerald-600/30 border-emerald-400 text-white font-extrabold ring-1 ring-emerald-400'
                            : d === 'sedang'
                            ? 'bg-amber-400/30 border-amber-400 text-white font-extrabold ring-1 ring-amber-400'
                            : 'bg-rose-600/30 border-rose-400 text-white font-extrabold ring-1 ring-rose-400'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="text-xs font-extrabold">{cfg.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{cfg.shortDesc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Mode Permainan & Room */}
            <div className="bg-slate-950 border border-sky-500/40 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-sky-300 uppercase">
                  ROOM : {formatRoomDisplay(activeRoomCode, gameMode)}
                </span>
                <span className="text-[11px] text-emerald-400 font-bold">
                  {gameMode === 'webrtc'
                    ? `${Object.keys(peersMap).length + 1} Pemain Aktif`
                    : gameMode === 'split'
                    ? '2 Pemain (1 Keyboard)'
                    : '1 Pemain Mandiri'}
                </span>
              </div>

              {/* Mode switch buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.playClickWood();
                    setGameMode('solo');
                  }}
                  className={`py-2 px-3 rounded-xl border text-center font-black text-sm tracking-wide cursor-pointer transition-all ${
                    gameMode === 'solo'
                      ? 'bg-emerald-950 border-emerald-400 text-amber-300 shadow-sm ring-2 ring-emerald-400/50'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  1P
                </button>
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.playClickWood();
                    setLevel1Decks(createLevel1SplitDecks());
                    setLevel2Decks(createLevel2SplitDecks());
                    setLevel3Decks(createLevel3SplitDecks());
                    setLevel4Decks(createLevel4SplitDecks());
                    setLevel5Decks(createLevel5SplitDecks());
                    setLevel6Decks(createLevel6SplitDecks());
                    setL4NpcPositions(createLevel4NpcPositions());
                    setL5NpcPositions(createLevel5NpcPositions());
                    if (
                      Math.hypot(
                        playerPosRef.current.x - player2PosRef.current.x,
                        playerPosRef.current.z - player2PosRef.current.z
                      ) < 0.8
                    ) {
                      playerPosRef.current.x = -1.8;
                      playerPosRef.current.z = 3.6;
                      player2PosRef.current.x = 1.8;
                      player2PosRef.current.z = 3.6;
                      syncDomPlayerAttrs(1);
                      syncDomPlayerAttrs(2);
                    }
                    setGameMode('split');
                  }}
                  className={`py-2 px-3 rounded-xl border text-center font-black text-sm tracking-wide cursor-pointer transition-all ${
                    gameMode === 'split'
                      ? 'bg-emerald-950 border-emerald-400 text-amber-300 shadow-sm ring-2 ring-emerald-400/50'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  2P
                </button>
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.playClickWood();
                    setGameMode('webrtc');
                  }}
                  className={`py-2 px-3 rounded-xl border text-center font-black text-sm tracking-wide cursor-pointer transition-all ${
                    gameMode === 'webrtc'
                      ? 'bg-emerald-950 border-emerald-400 text-sky-300 shadow-sm ring-2 ring-emerald-400/50'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  MODE KELAS
                </button>
              </div>

              {/* Conditional Room input: ONLY visible when Mode Kelas is active */}
              {gameMode === 'webrtc' ? (
                <div className="pt-2 border-t border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-sky-950/70 border border-sky-400/50 rounded-xl px-3 py-1.5">
                    <span className="text-xs font-bold text-sky-200">
                      Kode Room Kelas Aktif:
                    </span>
                    <span className="text-sm font-extrabold font-mono-num text-amber-300 tracking-wider">
                      {activeRoomCode || 'BUMI-5A'}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="modal-room-input"
                      className="block text-[11px] font-extrabold text-sky-200 uppercase tracking-wider"
                    >
                      Ketik / Atur Kode Ruangan:
                    </label>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        id="modal-room-input"
                        type="text"
                        maxLength={12}
                        placeholder="BUMI-5A"
                        value={roomCodeInput}
                        onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                        className="w-full sm:w-44 bg-slate-900 border-2 border-sky-400 focus:border-amber-300 rounded-xl px-3.5 py-2 text-sm font-extrabold font-mono-num text-amber-300 uppercase tracking-widest text-center outline-none shadow-inner"
                      />
                      <div className="flex items-center gap-2 flex-1">
                        <button
                          type="button"
                          onClick={() => {
                            audioEngine.playClickWood();
                            setGameMode('webrtc');
                            webrtcEngine.createClassroomHost(
                              playerName || 'Guru PAI',
                              (code, msg) => {
                                setActiveRoomCode(code);
                                setRoomCodeInput(code);
                                setWebrtcStatus(msg);
                              }
                            );
                          }}
                          className="btn-clay-amber flex-1 py-2 px-3 rounded-xl text-xs font-extrabold text-slate-950 text-center cursor-pointer shadow-md whitespace-nowrap"
                        >
                          🏫 Host Kelas
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            audioEngine.playClickWood();
                            const nextCode = roomCodeInput.trim().toUpperCase() || 'BUMI-5A';
                            setActiveRoomCode(nextCode);
                            setGameMode('webrtc');
                            webrtcEngine.joinClassroomRoom(
                              nextCode,
                              playerName || 'Siswa',
                              (_ok, msg) => {
                                setWebrtcStatus(msg);
                              }
                            );
                          }}
                          className="btn-clay-emerald flex-1 py-2 px-3 rounded-xl text-xs font-extrabold text-white text-center cursor-pointer shadow-md whitespace-nowrap"
                        >
                          👥 Gabung Room
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-300 flex items-center gap-1.5">
                    <span>💡</span>
                    <span>
                      Gunakan kode yang sama dengan siswa lain (contoh: <strong className="text-amber-300 font-mono-num">BUMI-5A</strong>), lalu klik <strong>Gabung Room</strong>.
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-300 bg-slate-900/90 rounded-xl px-3 py-2 font-mono-num border border-slate-800">
                    Status Koneksi: <strong className="text-sky-300">{webrtcStatus}</strong>
                  </div>
                </div>
              ) : gameMode === 'split' ? (
                <div className="bg-slate-900 border border-emerald-500/30 rounded-xl px-3 py-1.5 text-[11px] text-emerald-300 flex items-center justify-between">
                  <span>⚔️ Kontrol 2P (1 Keyboard):</span>
                  <span className="text-white font-mono text-[10px]">P1: WASD · P2: Panah</span>
                </div>
              ) : null}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  audioEngine.playClickWood();
                  setRoomModalOpen(false);
                }}
                className="btn-clay-emerald px-6 py-2.5 rounded-xl text-xs font-extrabold text-white cursor-pointer"
              >
                ✓ Simpan &amp; Kembali ke Permainan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
