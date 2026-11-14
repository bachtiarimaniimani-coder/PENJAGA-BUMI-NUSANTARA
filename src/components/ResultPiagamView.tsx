import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { OfficialLogoBadge, GoldenWaxSealSvg } from './OfficialLogos';
import { GAME_IDENTITY, LEVEL_METADATA, PIAGAM_IKRAR_ITEMS } from '../game/blueprintData';
import {
  LevelScoreMap,
  evaluatePredicate,
  RankedLeaderboardEntry,
  filterLeaderboardEntries,
  findPlayerLeaderboardRank,
} from '../game/rules';
import { audioEngine, NarratorPersona, NarrationVoiceStatus } from '../game/audioEngine';
import { AnswerEvaluationRecord } from '../game/evaluationLog';
import { EvaluationReviewPanel } from './EvaluationReviewPanel';
import { generateAndDownloadPiagamPdf } from '../game/piagamPdf';
import {
  submitScoreAndFetchLeaderboard,
  fetchLeaderboardEntries,
} from '../game/leaderboardService';

export interface ResultPiagamProps {
  sessionId?: string;
  playerName: string;
  player2Name?: string;
  isTwoPlayer?: boolean;
  schoolName?: string;
  onSchoolNameChange?: (nextSchool: string) => void;
  studentClass: 'Kelas V (Fase C)' | 'Kelas VI (Fase C)';
  gameMode?: 'solo' | 'split' | 'webrtc';
  difficulty?: string;
  scores: LevelScoreMap;
  p2Scores?: LevelScoreMap;
  totalScore: number;
  p2TotalScore?: number;
  ecoHealth: number;
  amanah: number;
  evaluationLog?: readonly AnswerEvaluationRecord[];
  p2EvaluationLog?: readonly AnswerEvaluationRecord[];
  persona?: NarratorPersona;
  onCyclePersona?: () => void;
  onPlayAgain: () => void;
  onExitGame: () => void;
}

export const ResultPiagamView: React.FC<ResultPiagamProps> = ({
  sessionId,
  playerName,
  player2Name = 'Pemain 2',
  isTwoPlayer = false,
  schoolName = 'SDN 2 GIRIMARTO',
  onSchoolNameChange,
  studentClass,
  gameMode = 'solo',
  difficulty = 'sedang',
  scores,
  p2Scores,
  totalScore,
  p2TotalScore = 0,
  ecoHealth,
  amanah,
  evaluationLog = [],
  p2EvaluationLog = [],
  persona,
  onCyclePersona,
  onPlayAgain,
  onExitGame,
}) => {
  const [checkedPledges, setCheckedPledges] = useState<boolean[]>([
    true,
    true,
    true,
    true,
    true,
    true,
  ]);
  const [editablePlayerName, setEditablePlayerName] = useState(playerName);
  const [editablePlayer2Name, setEditablePlayer2Name] = useState(player2Name);
  const [editableSchoolName, setEditableSchoolName] = useState(
    schoolName.trim() || 'SDN 2 GIRIMARTO'
  );
  const [teacherName, setTeacherName] = useState('Bachtiar Imani, S.Pd.I.');
  const [parentName, setParentName] = useState('Orang Tua / Wali Murid');
  const [editingCertField, setEditingCertField] = useState<'parent' | 'teacher' | 'player' | null>(
    null
  );
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfReadyFile, setPdfReadyFile] = useState<{ fileName: string; blobUrl: string } | null>(
    null
  );
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<NarrationVoiceStatus>(() =>
    audioEngine.getVoiceStatus()
  );

  // Leaderboard & Google Spreadsheet Sync State
  const sessionIdRef = useRef<string>(
    sessionId || `PBN-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
  );
  if (sessionId && sessionIdRef.current !== sessionId) {
    sessionIdRef.current = sessionId;
  }
  const [leaderboardEntries, setLeaderboardEntries] = useState<RankedLeaderboardEntry[]>([]);
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'synced' | 'queued' | 'error'>(
    'syncing'
  );
  const [isRefreshingBoard, setIsRefreshingBoard] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterSchool, setFilterSchool] = useState('');

  useEffect(() => {
    return audioEngine.subscribeVoiceStatus((st) => setVoiceStatus(st));
  }, []);

  useEffect(() => {
    setEditablePlayerName(playerName);
  }, [playerName]);

  useEffect(() => {
    setEditablePlayer2Name(player2Name);
  }, [player2Name]);

  useEffect(() => {
    if (schoolName && schoolName.trim()) {
      setEditableSchoolName(schoolName.trim());
    }
  }, [schoolName]);

  const resolvedPlayerName = editablePlayerName.trim() || playerName;
  const resolvedPlayer2Name = editablePlayer2Name.trim() || player2Name;
  const resolvedSchoolName = editableSchoolName.trim() || 'SDN 2 GIRIMARTO';
  const resolvedTeacherName = teacherName.trim() || 'Guru PAI & Budi Pekerti';
  const resolvedParentName = parentName.trim() || 'Orang Tua / Wali Murid';

  const predicate = evaluatePredicate(totalScore);
  const p2Predicate = evaluatePredicate(p2TotalScore);
  const activePersona = persona ?? audioEngine.getPersona();

  const gameModeLabel =
    gameMode === 'split' || isTwoPlayer
      ? '2P Split Screen'
      : gameMode === 'webrtc'
      ? 'Mode Kelas'
      : '1P Petualangan';

  const handleSyncToSpreadsheet = useCallback(
    async (customName1?: string, customName2?: string, customSchool?: string) => {
      setSyncStatus('syncing');
      try {
        const res = await submitScoreAndFetchLeaderboard({
          sessionId: sessionIdRef.current,
          playerName: (customName1 ?? resolvedPlayerName).trim() || 'Penjaga Cilik',
          player2Name: (customName2 ?? resolvedPlayer2Name).trim() || 'Pemain 2',
          schoolName: (customSchool ?? resolvedSchoolName).trim() || 'SDN 2 GIRIMARTO',
          studentClass,
          gameMode: gameModeLabel,
          difficulty,
          isTwoPlayer,
          scores,
          p2Scores,
          totalScore,
          p2TotalScore,
          ecoHealth,
          amanah,
          evaluationLog,
          p2EvaluationLog,
        });
        setLeaderboardEntries(res.rankedEntries);
        setSyncStatus(res.syncedToSheet ? 'synced' : res.queuedForRetry ? 'queued' : 'synced');
      } catch {
        setSyncStatus('error');
      }
    },
    [
      resolvedPlayerName,
      resolvedPlayer2Name,
      resolvedSchoolName,
      studentClass,
      gameModeLabel,
      difficulty,
      isTwoPlayer,
      scores,
      p2Scores,
      totalScore,
      p2TotalScore,
      ecoHealth,
      amanah,
      evaluationLog,
      p2EvaluationLog,
    ]
  );

  const handleRefreshLeaderboard = useCallback(async () => {
    setIsRefreshingBoard(true);
    try {
      const list = await fetchLeaderboardEntries(true);
      setLeaderboardEntries(list);
    } finally {
      setIsRefreshingBoard(false);
    }
  }, []);

  // Automatically submit score & load leaderboard when arriving at Result Screen
  useEffect(() => {
    void handleSyncToSpreadsheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Find exact rank of Player 1 and Player 2
  const p1RankedEntry = useMemo(
    () =>
      findPlayerLeaderboardRank(
        leaderboardEntries,
        sessionIdRef.current,
        resolvedPlayerName,
        resolvedSchoolName,
        totalScore
      ),
    [leaderboardEntries, resolvedPlayerName, resolvedSchoolName, totalScore]
  );

  const p2RankedEntry = useMemo(
    () =>
      isTwoPlayer
        ? findPlayerLeaderboardRank(
            leaderboardEntries,
            `${sessionIdRef.current}-P2`,
            resolvedPlayer2Name,
            resolvedSchoolName,
            p2TotalScore
          )
        : null,
    [isTwoPlayer, leaderboardEntries, resolvedPlayer2Name, resolvedSchoolName, p2TotalScore]
  );

  // Filtered entries by Nama & Sekolah
  const filteredLeaderboard = useMemo(
    () => filterLeaderboardEntries(leaderboardEntries, filterName, filterSchool),
    [leaderboardEntries, filterName, filterSchool]
  );

  // Unique schools for quick filter chips
  const availableSchools = useMemo(() => {
    const set = new Set<string>();
    for (const item of leaderboardEntries) {
      if (item.schoolName && item.schoolName.trim()) {
        set.add(item.schoolName.trim());
      }
    }
    return Array.from(set).slice(0, 8);
  }, [leaderboardEntries]);

  const buildPiagamNarrationText = () => {
    const teacherIntro =
      activePersona === 'ilyas' ? 'Saya Pak Guru Ilyas.' : 'Saya Bu Guru Rahma.';
    const rankSentenceP1 = p1RankedEntry
      ? ` Saat ini posisi peringkatmu berada di peringkat ke-${p1RankedEntry.rank} dari ${leaderboardEntries.length} peserta pada Papan Peringkat Nusantara!`
      : '';
    if (isTwoPlayer) {
      const rankSentence2P =
        p1RankedEntry && p2RankedEntry
          ? ` Pada Papan Peringkat Nusantara, ${resolvedPlayerName} berada di peringkat ke-${p1RankedEntry.rank} dan ${resolvedPlayer2Name} berada di peringkat ke-${p2RankedEntry.rank}!`
          : '';
      return `Alhamdulillah, selamat kepada ${resolvedPlayerName} dan ${resolvedPlayer2Name} dari ${resolvedSchoolName}! ${teacherIntro} Kalian telah menuntaskan enam misi Penjaga Bumi Nusantara dengan predikat ${predicate.title} dan ${p2Predicate.title}.${rankSentence2P} Mari kita jaga enam ikrar suci Khalifah fil Ardh ini dalam kehidupan sehari-hari di rumah, sekolah, dan masyarakat.`;
    }
    return `Alhamdulillah, selamat kepada ananda ${resolvedPlayerName} dari ${resolvedSchoolName}! ${teacherIntro} Kamu berhasil menuntaskan enam misi Penjaga Bumi Nusantara dengan skor akhir ${totalScore} poin dan meraih predikat ${predicate.title}.${rankSentenceP1} Mari kita amalkan enam ikrar suci Penjaga Bumi Cilik ini dengan penuh amanah dan kasih sayang terhadap alam.`;
  };

  useEffect(() => {
    if (activePersona !== 'muted') {
      audioEngine.speak(buildPiagamNarrationText(), 120);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (pdfReadyFile?.blobUrl) {
        URL.revokeObjectURL(pdfReadyFile.blobUrl);
      }
    };
  }, [pdfReadyFile]);

  const togglePledge = (idx: number) => {
    audioEngine.playClickWood();
    setCheckedPledges((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  };

  const todayFormatted = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const handleDownloadPdf = async () => {
    if (isGeneratingPdf) return;
    audioEngine.playCrystalSeal();
    setIsGeneratingPdf(true);
    setPdfError(null);
    try {
      const result = await generateAndDownloadPiagamPdf({
        playerName: resolvedPlayerName,
        player2Name: resolvedPlayer2Name,
        isTwoPlayer,
        studentClass,
        totalScore,
        p2TotalScore,
        ecoHealth,
        amanah,
        checkedPledges,
        teacherName: resolvedTeacherName,
        parentName: resolvedParentName,
        dateFormatted: todayFormatted,
      });
      setPdfReadyFile((prev) => {
        if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
        return result;
      });
    } catch {
      setPdfError(
        'Gagal membuat berkas PDF secara otomatis. Silakan coba lagi atau gunakan tombol Cetak Langsung.'
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrintPiagam = () => {
    audioEngine.playClickWood();
    window.print();
  };

  const scoreArray = [
    { code: 'C1', label: 'Mengenali', val: scores.c1, val2: p2Scores?.c1 ?? 0, max: 15, name: 'Detektif Sampah' },
    { code: 'C2', label: 'Memahami', val: scores.c2, val2: p2Scores?.c2 ?? 0, max: 15, name: 'Rahasia 3R' },
    { code: 'C3', label: 'Menerapkan', val: scores.c3, val2: p2Scores?.c3 ?? 0, max: 15, name: 'Mesin Capit 3R' },
    { code: 'C4', label: 'Menganalisis', val: scores.c4, val2: p2Scores?.c4 ?? 0, max: 20, name: 'Kota Lestari' },
    { code: 'C5', label: 'Mengevaluasi', val: scores.c5, val2: p2Scores?.c5 ?? 0, max: 15, name: 'Penjaga Ekosistem' },
    { code: 'C6', label: 'Mencipta', val: scores.c6, val2: p2Scores?.c6 ?? 0, max: 20, name: 'Radar Nusantara' },
  ];

  return (
    <main className="relative z-20 min-h-screen w-full py-6 px-4 md:px-8 overflow-y-auto print-only-container">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* SCORECARD & BLOOM ANALYTICS (Hidden during print so A4 Piagam fits cleanly) */}
        <section
          aria-label="Papan Evaluasi Kinerja Taksonomi Bloom"
          className="bg-slate-950/95 border-2 border-emerald-600/80 rounded-3xl p-6 shadow-2xl no-print"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                HASIL AKHIR PETUALANGAN PENJAGA BUMI {isTwoPlayer ? '(MODE 2 PEMAIN)' : ''}
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-1">
                {predicate.starText} {predicate.title}
              </h1>
              <p className="text-sm text-slate-300 mt-1">
                {isTwoPlayer ? (
                  <>
                    Pemain 1 (Kiri): <strong className="text-emerald-300">{playerName}</strong> · Pemain 2 (Kanan):{' '}
                    <strong className="text-sky-300">{player2Name}</strong> · {studentClass}
                  </>
                ) : (
                  <>
                    Siswa: <strong>{playerName}</strong> · {studentClass}
                  </>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {isTwoPlayer ? (
                <>
                  <div className="bg-emerald-950/80 border border-emerald-500/60 rounded-2xl px-4 py-2.5 text-center">
                    <div className="text-[10px] font-extrabold text-emerald-300 uppercase">
                      SKOR P1 ({playerName})
                    </div>
                    <div className="text-2xl font-extrabold text-amber-400 font-mono-num">
                      {totalScore} <span className="text-xs text-slate-400">/ 100</span>
                    </div>
                  </div>
                  <div className="bg-sky-950/80 border border-sky-500/60 rounded-2xl px-4 py-2.5 text-center">
                    <div className="text-[10px] font-extrabold text-sky-300 uppercase">
                      SKOR P2 ({player2Name})
                    </div>
                    <div className="text-2xl font-extrabold text-amber-400 font-mono-num">
                      {p2TotalScore} <span className="text-xs text-slate-400">/ 100</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-slate-900 border border-amber-500/60 rounded-2xl px-5 py-3 text-center">
                  <div className="text-xs font-bold text-amber-300">SKOR AKHIR</div>
                  <div className="text-3xl font-extrabold text-amber-400 font-mono-num">
                    {totalScore} <span className="text-sm text-slate-400">/ 100</span>
                  </div>
                </div>
              )}
              <div className="bg-slate-900 border border-emerald-500/60 rounded-2xl px-4 py-3 text-xs space-y-1">
                <div className="flex justify-between gap-4 text-emerald-300 font-bold">
                  <span>🌿 Eco-Health:</span>
                  <span className="font-mono-num">{ecoHealth}%</span>
                </div>
                <div className="flex justify-between gap-4 text-amber-300 font-bold">
                  <span>✨ Amanah:</span>
                  <span className="font-mono-num">{amanah}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Narrator Control Bar on Halaman 4 */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 border border-emerald-500/40 rounded-2xl px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full ${
                  voiceStatus === 'speaking'
                    ? 'bg-emerald-400 animate-ping'
                    : voiceStatus === 'waiting'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-slate-500'
                }`}
              />
              <span className="font-extrabold text-emerald-300">
                {activePersona === 'ilyas'
                  ? '🎙️ Narator: Pak Guru Ilyas'
                  : activePersona === 'rahma'
                  ? '🎙️ Narator: Bu Guru Rahma'
                  : '🔇 Narator: Mode Hening'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onCyclePersona && (
                <button
                  type="button"
                  onClick={onCyclePersona}
                  data-testid="result-narrator-cycle-btn"
                  className="btn-clay-slate px-3 py-1.5 rounded-xl text-xs font-extrabold text-amber-300 border border-amber-500/50 cursor-pointer"
                >
                  🔄 Ganti Suara Guru
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  audioEngine.unlockAudio();
                  audioEngine.speak(buildPiagamNarrationText(), 80);
                }}
                data-testid="result-narrator-speak-btn"
                className="btn-clay-emerald px-3.5 py-1.5 rounded-xl text-xs font-extrabold text-white cursor-pointer"
              >
                🔊 Dengarkan Apresiasi &amp; Ikrar
              </button>
            </div>
          </div>

          {/* Matriks Analisis Kognitif Taksonomi Bloom C1-C6 */}
          <div className="mt-5">
            <h2 className="text-sm font-extrabold text-slate-200 uppercase tracking-wider mb-3">
              Matriks Analisis Kognitif Taksonomi Bloom (C1 – C6)
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
              {scoreArray.map((item) => {
                const meta = LEVEL_METADATA.find((m) => m.bloomCode === item.code);
                return (
                  <div
                    key={item.code}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center"
                  >
                    <div className="text-xs font-extrabold text-amber-400 font-mono-num">
                      {item.code} · {item.label}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      {meta?.name || item.name}
                    </div>
                    {isTwoPlayer ? (
                      <div className="mt-1.5 space-y-0.5 text-xs font-mono-num font-bold">
                        <div className="text-emerald-300">
                          P1: {Math.round(item.val * 10) / 10}/{item.max}
                        </div>
                        <div className="text-sky-300">
                          P2: {Math.round(item.val2 * 10) / 10}/{item.max}
                        </div>
                      </div>
                    ) : (
                      <div className="text-lg font-extrabold text-white font-mono-num mt-1">
                        {Math.round(item.val * 10) / 10}{' '}
                        <span className="text-xs text-slate-400">/ {item.max}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Inputs for customizing Piagam signature names & School Name before printing/downloading */}
          <div className="mt-5 pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label
                htmlFor="input-result-school-name"
                className="block text-[11px] font-bold text-emerald-300 mb-1"
              >
                🏫 Nama Sekolah / SD:
              </label>
              <input
                id="input-result-school-name"
                data-testid="input-result-school-name"
                type="text"
                value={editableSchoolName}
                onChange={(e) => {
                  setEditableSchoolName(e.target.value);
                  onSchoolNameChange?.(e.target.value);
                }}
                placeholder="Contoh: SDN 2 GIRIMARTO"
                className="w-full bg-slate-900 border border-emerald-600/70 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label
                htmlFor="input-parent-piagam"
                className="block text-[11px] font-bold text-slate-300 mb-1"
              >
                Nama Orang Tua / Wali Murid:
              </label>
              <input
                id="input-parent-piagam"
                type="text"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="Isi nama Orang Tua / Wali..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label
                htmlFor="input-teacher-piagam"
                className="block text-[11px] font-bold text-slate-300 mb-1"
              >
                Nama Guru PAI &amp; Budi Pekerti:
              </label>
              <input
                id="input-teacher-piagam"
                type="text"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                placeholder="Isi nama Guru PAI & BP..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label
                htmlFor="input-player-piagam"
                className="block text-[11px] font-bold text-slate-300 mb-1"
              >
                {isTwoPlayer ? 'Nama Pemain 1 & Pemain 2:' : 'Nama Pemain / Siswa:'}
              </label>
              {isTwoPlayer ? (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    id="input-player-piagam"
                    type="text"
                    value={editablePlayerName}
                    onChange={(e) => setEditablePlayerName(e.target.value)}
                    placeholder="Pemain 1..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                  />
                  <input
                    id="input-player2-piagam"
                    type="text"
                    value={editablePlayer2Name}
                    onChange={(e) => setEditablePlayer2Name(e.target.value)}
                    placeholder="Pemain 2..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-400"
                  />
                </div>
              ) : (
                <input
                  id="input-player-piagam"
                  type="text"
                  value={editablePlayerName}
                  onChange={(e) => setEditablePlayerName(e.target.value)}
                  placeholder="Isi nama Pemain..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                />
              )}
            </div>
          </div>
        </section>

        {/* =====================================================================
            PAPAN PERINGKAT NUSANTARA (LEADERBOARD) & POSISI PERINGKAT PEMAIN
           ===================================================================== */}
        <section
          aria-label="Papan Peringkat Leaderboard Penjaga Bumi Nusantara"
          data-testid="leaderboard-section"
          className="bg-slate-950/95 border-2 border-amber-500/80 rounded-3xl p-5 md:p-6 shadow-2xl space-y-5 no-print"
        >
          {/* Header Leaderboard & Status Sinkronisasi Spreadsheet */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-widest text-amber-400">
                  🏆 PAPAN PERINGKAT NUSANTARA (LIVE SPREADSHEET LEADERBOARD)
                </span>
                <span
                  data-testid="leaderboard-sync-badge"
                  className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-lg border ${
                    syncStatus === 'synced'
                      ? 'bg-emerald-950/90 border-emerald-400/70 text-emerald-300'
                      : syncStatus === 'syncing'
                      ? 'bg-amber-950/90 border-amber-400/70 text-amber-300 animate-pulse'
                      : syncStatus === 'queued'
                      ? 'bg-sky-950/90 border-sky-400/70 text-sky-300'
                      : 'bg-rose-950/90 border-rose-400/70 text-rose-300'
                  }`}
                >
                  {syncStatus === 'synced'
                    ? '✅ Data Tersimpan di Google Spreadsheet'
                    : syncStatus === 'syncing'
                    ? '⏳ Menyimpan ke Google Spreadsheet...'
                    : syncStatus === 'queued'
                    ? '☁️ Antrean Aman Aktif (Tersimpan Otomatis)'
                    : '⚠️ Mode Cadangan Lokal Aktif'}
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-white mt-1">
                Posisi Peringkat &amp; Klasemen Penjaga Bumi Cilik
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="btn-resubmit-leaderboard"
                onClick={() => {
                  audioEngine.playClickWood();
                  void handleSyncToSpreadsheet(
                    resolvedPlayerName,
                    resolvedPlayer2Name,
                    resolvedSchoolName
                  );
                }}
                disabled={syncStatus === 'syncing'}
                className="btn-clay-emerald px-3.5 py-2 rounded-xl text-xs font-extrabold text-white cursor-pointer disabled:opacity-60"
              >
                {syncStatus === 'syncing'
                  ? '⏳ Menyimpan...'
                  : '☁️ Simpan / Perbarui Nama & Sekolah'}
              </button>
              <button
                type="button"
                data-testid="btn-refresh-leaderboard"
                onClick={() => {
                  audioEngine.playClickWood();
                  void handleRefreshLeaderboard();
                }}
                disabled={isRefreshingBoard}
                className="btn-clay-slate px-3.5 py-2 rounded-xl text-xs font-extrabold text-amber-300 border border-amber-500/50 cursor-pointer disabled:opacity-60"
              >
                {isRefreshingBoard ? '⏳ Memuat...' : '🔄 Segarkan Peringkat'}
              </button>
            </div>
          </div>

          {/* KARTU PENGUMUMAN POSISI PERINGKAT PEMAIN SETELAH GAME SELESAI */}
          <div
            data-testid="player-leaderboard-rank-banner"
            className="bg-gradient-to-r from-emerald-950 via-slate-900 to-amber-950/80 border-2 border-amber-400 rounded-2xl p-4 md:p-5 shadow-lg"
          >
            {isTwoPlayer ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Peringkat Pemain 1 (Kiri) */}
                <div
                  data-testid="player1-rank-card"
                  className="bg-slate-950/90 border border-emerald-500/70 rounded-2xl p-3.5 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-[11px] font-extrabold text-emerald-300 uppercase">
                      🎉 POSISI PERINGKAT PEMAIN 1 (KIRI)
                    </div>
                    <div className="text-base md:text-lg font-black text-white mt-0.5">
                      {resolvedPlayerName}
                    </div>
                    <div className="text-xs text-slate-300">
                      🏫 {resolvedSchoolName} · {studentClass}
                    </div>
                    <div className="text-xs font-bold text-amber-300 mt-1">
                      Skor: {totalScore}/100 · {predicate.starText}
                    </div>
                  </div>
                  <div className="bg-amber-400 text-slate-950 rounded-2xl px-4 py-2.5 text-center shrink-0 shadow-md">
                    <div className="text-[10px] font-black uppercase tracking-wider">
                      PERINGKAT
                    </div>
                    <div
                      data-testid="player1-rank-number"
                      className="text-2xl md:text-3xl font-black font-mono-num leading-none mt-0.5"
                    >
                      #{p1RankedEntry?.rank ?? 1}
                    </div>
                    <div className="text-[10px] font-extrabold mt-0.5">
                      dari {Math.max(1, leaderboardEntries.length)} Siswa
                    </div>
                  </div>
                </div>

                {/* Peringkat Pemain 2 (Kanan) */}
                <div
                  data-testid="player2-rank-card"
                  className="bg-slate-950/90 border border-sky-500/70 rounded-2xl p-3.5 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-[11px] font-extrabold text-sky-300 uppercase">
                      🎉 POSISI PERINGKAT PEMAIN 2 (KANAN)
                    </div>
                    <div className="text-base md:text-lg font-black text-white mt-0.5">
                      {resolvedPlayer2Name}
                    </div>
                    <div className="text-xs text-slate-300">
                      🏫 {resolvedSchoolName} · {studentClass}
                    </div>
                    <div className="text-xs font-bold text-amber-300 mt-1">
                      Skor: {p2TotalScore}/100 · {p2Predicate.starText}
                    </div>
                  </div>
                  <div className="bg-sky-400 text-slate-950 rounded-2xl px-4 py-2.5 text-center shrink-0 shadow-md">
                    <div className="text-[10px] font-black uppercase tracking-wider">
                      PERINGKAT
                    </div>
                    <div
                      data-testid="player2-rank-number"
                      className="text-2xl md:text-3xl font-black font-mono-num leading-none mt-0.5"
                    >
                      #{p2RankedEntry?.rank ?? 2}
                    </div>
                    <div className="text-[10px] font-extrabold mt-0.5">
                      dari {Math.max(2, leaderboardEntries.length)} Siswa
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-amber-400/20 border border-amber-400/60 text-amber-300 text-xs font-black uppercase">
                    🌟 PENGUMUMAN POSISI LEADERBOARD KAMU
                  </div>
                  <h3 className="text-lg md:text-2xl font-black text-white">
                    Selamat, <span className="text-emerald-300">{resolvedPlayerName}</span>! Kamu
                    Berada di{' '}
                    <span className="text-amber-300 underline decoration-amber-400/80">
                      Peringkat #{p1RankedEntry?.rank ?? 1}
                    </span>{' '}
                    dari {Math.max(1, leaderboardEntries.length)} Peserta!
                  </h3>
                  <p className="text-xs md:text-sm text-slate-200">
                    🏫 Asal Sekolah: <strong className="text-amber-200">{resolvedSchoolName}</strong>{' '}
                    · {studentClass} · Skor Akhir:{' '}
                    <strong className="text-emerald-300 font-mono-num">{totalScore}/100</strong> (
                    {predicate.title})
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="bg-amber-400 text-slate-950 rounded-2xl px-5 py-3 text-center shadow-xl border-2 border-white">
                    <div className="text-[10px] font-black uppercase tracking-wider">
                      POSISI KAMU
                    </div>
                    <div
                      data-testid="player1-rank-number"
                      className="text-3xl md:text-4xl font-black font-mono-num leading-none mt-0.5"
                    >
                      #{p1RankedEntry?.rank ?? 1}
                    </div>
                    <div className="text-[11px] font-extrabold mt-1">
                      dari {Math.max(1, leaderboardEntries.length)} Siswa
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* KOLOM FILTER PENCARIAN: NAMA SISWA & NAMA SEKOLAH */}
          <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-extrabold text-emerald-300 uppercase tracking-wider">
                🔍 FILTER PENCARIAN LEADERBOARD (BERDASARKAN NAMA &amp; SEKOLAH)
              </div>
              <div className="text-xs text-slate-300 font-mono-num">
                Menampilkan <strong>{filteredLeaderboard.length}</strong> dari{' '}
                <strong>{leaderboardEntries.length}</strong> peserta
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Filter Nama Siswa */}
              <div className="lg:col-span-2">
                <label
                  htmlFor="leaderboard-filter-name"
                  className="block text-[11px] font-bold text-slate-300 mb-1"
                >
                  👤 Cari Nama Siswa:
                </label>
                <input
                  id="leaderboard-filter-name"
                  data-testid="input-leaderboard-filter-name"
                  type="text"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  placeholder="Ketik nama siswa (misal: Ahmad, Siti)..."
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-400 rounded-xl px-3.5 py-2 text-xs font-bold text-white outline-none"
                />
              </div>

              {/* Filter Nama Sekolah */}
              <div className="lg:col-span-2">
                <label
                  htmlFor="leaderboard-filter-school"
                  className="block text-[11px] font-bold text-slate-300 mb-1"
                >
                  🏫 Cari Nama Sekolah / SD:
                </label>
                <input
                  id="leaderboard-filter-school"
                  data-testid="input-leaderboard-filter-school"
                  type="text"
                  value={filterSchool}
                  onChange={(e) => setFilterSchool(e.target.value)}
                  placeholder="Ketik nama sekolah (misal: SDN 2 GIRIMARTO)..."
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2 text-xs font-bold text-white outline-none"
                />
              </div>

              {/* Tombol Reset Filter */}
              <div className="flex items-end">
                <button
                  type="button"
                  data-testid="btn-reset-leaderboard-filter"
                  onClick={() => {
                    audioEngine.playClickWood();
                    setFilterName('');
                    setFilterSchool('');
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-extrabold cursor-pointer transition-colors"
                >
                  ✕ Reset Filter
                </button>
              </div>
            </div>

            {/* Quick Filter Chips Sekolah */}
            {availableSchools.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-400 mr-1">
                  Filter Cepat Sekolah:
                </span>
                <button
                  type="button"
                  onClick={() => setFilterSchool('')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border cursor-pointer transition-all ${
                    filterSchool === ''
                      ? 'bg-amber-400 text-slate-950 border-white'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  Semua Sekolah ({leaderboardEntries.length})
                </button>
                {availableSchools.map((sch) => {
                  const active = filterSchool.toLowerCase() === sch.toLowerCase();
                  return (
                    <button
                      key={sch}
                      type="button"
                      onClick={() => setFilterSchool(active ? '' : sch)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-all ${
                        active
                          ? 'bg-emerald-500 text-slate-950 border-white font-extrabold'
                          : 'bg-slate-950 text-emerald-200 border-slate-800 hover:border-emerald-500/60'
                      }`}
                    >
                      🏫 {sch}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* TABEL LEADERBOARD */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/90 max-h-[420px] overflow-y-auto">
            <table
              data-testid="leaderboard-table"
              className="w-full text-left border-collapse text-xs md:text-sm"
            >
              <thead className="sticky top-0 z-10 bg-slate-950 text-amber-300 border-b border-slate-800 uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-3.5 font-extrabold whitespace-nowrap">Peringkat</th>
                  <th className="py-3 px-3.5 font-extrabold">Nama Siswa</th>
                  <th className="py-3 px-3.5 font-extrabold">Asal Sekolah &amp; Kelas</th>
                  <th className="py-3 px-3.5 font-extrabold text-center hidden md:table-cell">
                    Skor C1–C6
                  </th>
                  <th className="py-3 px-3.5 font-extrabold text-right whitespace-nowrap">
                    Total Skor
                  </th>
                  <th className="py-3 px-3.5 font-extrabold">Predikat Penghargaan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredLeaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 px-4 text-center text-slate-400">
                      Tidak ditemukan data peserta dengan filter Nama{' '}
                      <strong>&ldquo;{filterName || '-'}&rdquo;</strong> dan Sekolah{' '}
                      <strong>&ldquo;{filterSchool || '-'}&rdquo;</strong>.
                    </td>
                  </tr>
                ) : (
                  filteredLeaderboard.map((entry) => {
                    const isCurrentP1 =
                      entry.sessionId === sessionIdRef.current ||
                      (p1RankedEntry && entry.sessionId === p1RankedEntry.sessionId);
                    const isCurrentP2 =
                      isTwoPlayer &&
                      (entry.sessionId === `${sessionIdRef.current}-P2` ||
                        (p2RankedEntry && entry.sessionId === p2RankedEntry.sessionId));
                    const isMe = Boolean(isCurrentP1 || isCurrentP2);

                    const medal =
                      entry.rank === 1
                        ? '🥇'
                        : entry.rank === 2
                        ? '🥈'
                        : entry.rank === 3
                        ? '🥉'
                        : '🏅';

                    return (
                      <tr
                        key={entry.sessionId}
                        data-testid={`leaderboard-row-rank-${entry.rank}`}
                        className={`transition-colors ${
                          isMe
                            ? 'bg-emerald-950/80 border-l-4 border-l-amber-400 text-white font-bold'
                            : 'hover:bg-slate-800/60 text-slate-200'
                        }`}
                      >
                        <td className="py-2.5 px-3.5 font-mono-num whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">{medal}</span>
                            <span
                              className={`px-2 py-0.5 rounded-lg text-xs font-black ${
                                entry.rank === 1
                                  ? 'bg-amber-400 text-slate-950'
                                  : entry.rank === 2
                                  ? 'bg-slate-300 text-slate-950'
                                  : entry.rank === 3
                                  ? 'bg-amber-700 text-white'
                                  : 'bg-slate-800 text-amber-300'
                              }`}
                            >
                              #{entry.rank}
                            </span>
                            {isMe && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-400 text-slate-950 text-[10px] font-black uppercase">
                                {isCurrentP2 ? 'POSISI P2' : 'POSISI KAMU'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5">
                          <div className="font-extrabold text-white">{entry.playerName}</div>
                          <div className="text-[10px] text-slate-400">{entry.gameMode}</div>
                        </td>
                        <td className="py-2.5 px-3.5">
                          <div className="font-bold text-emerald-300">🏫 {entry.schoolName}</div>
                          <div className="text-[11px] text-slate-400">{entry.studentClass}</div>
                        </td>
                        <td className="py-2.5 px-3.5 text-center font-mono-num text-[11px] text-slate-300 hidden md:table-cell">
                          {entry.c1} · {entry.c2} · {entry.c3} · {entry.c4} · {entry.c5} ·{' '}
                          {entry.c6}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono-num whitespace-nowrap">
                          <span className="text-base font-black text-amber-300">
                            {entry.totalScore}
                          </span>
                          <span className="text-[11px] text-slate-400"> / 100</span>
                        </td>
                        <td className="py-2.5 px-3.5">
                          <div className="text-xs font-extrabold text-amber-200">
                            {entry.starsText}
                          </div>
                          <div className="text-[11px] text-emerald-300">{entry.title}</div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* RINCIAN EVALUASI JAWABAN & PEMBAHASAN SINGKAT (Hidden on A4 print) */}
        <EvaluationReviewPanel
          variant="result"
          records={evaluationLog}
          p2Records={p2EvaluationLog}
          isTwoPlayer={isTwoPlayer}
          playerName={playerName}
          player2Name={player2Name}
        />

        {/* INSTRUMEN ASESMEN AUTENTIK: PIAGAM IKRAR AKSI NYATA (Section XIV Blueprint) */}
        <section
          aria-label="Piagam Ikrar Aksi Nyata Penjaga Bumi Cilik"
          className="piagam-frame rounded-3xl p-6 md:p-10 relative"
        >
          {/* Kop Dokumen Resmi */}
          <div className="flex items-center justify-between gap-4 border-b-4 border-double border-amber-800 pb-4">
            <div className="flex items-center gap-2">
              <OfficialLogoBadge type="pgri" size="lg" />
              <OfficialLogoBadge type="game" size="lg" />
            </div>
            <div className="text-center flex-1">
              <div className="text-sm md:text-base font-extrabold tracking-wide text-stone-900 uppercase">
                PEMERINTAH KABUPATEN WONOGIRI
              </div>
              <div className="text-sm md:text-base font-extrabold tracking-wide text-stone-900 uppercase">
                PERSATUAN GURU REPUBLIK INDONESIA (PGRI)
              </div>
              <div className="text-xs md:text-sm font-bold text-amber-900 uppercase">
                CABANG PGRI GIRIMARTO
              </div>
              <div className="mt-2 inline-block border-t border-amber-700/60 pt-1">
                <h2 className="text-lg md:text-2xl font-extrabold text-emerald-900 tracking-tight">
                  PIAGAM IKRAR AKSI NYATA PENJAGA BUMI CILIK
                </h2>
                <p className="text-xs font-bold text-stone-700">
                  Game Edukasi PAI &amp; BP: &ldquo;{GAME_IDENTITY.title} — {GAME_IDENTITY.subtitle}&rdquo;
                </p>
              </div>
            </div>
            <OfficialLogoBadge type="wonogiri" size="lg" />
          </div>

          {/* Identitas Penerima Piagam */}
          <div className="mt-5 bg-amber-50/90 border border-amber-300 rounded-2xl p-4 text-sm text-stone-900">
            <p className="font-bold text-stone-700 mb-2">Diberikan kepada:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-6">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="w-32 font-semibold text-stone-700 shrink-0">Nama Siswa</span>
                <span className="font-extrabold text-stone-950">
                  :{' '}
                  {isTwoPlayer
                    ? `${resolvedPlayerName} & ${resolvedPlayer2Name}`
                    : resolvedPlayerName}
                </span>
                <button
                  type="button"
                  data-testid="btn-edit-cert-player-top"
                  onClick={() => {
                    audioEngine.playClickWood();
                    setEditingCertField((prev) => (prev === 'player' ? null : 'player'));
                  }}
                  className="no-print ml-1 px-2 py-0.5 rounded-lg bg-amber-200/80 hover:bg-amber-300 text-amber-950 text-[10px] font-extrabold border border-amber-500/60 cursor-pointer"
                >
                  ✏️ Isi Nama Pemain
                </button>
              </div>
              <div className="flex">
                <span className="w-32 font-semibold text-stone-700">Kelas / Fase</span>
                <span className="font-bold text-stone-900">: {studentClass}</span>
              </div>
              <div className="flex sm:col-span-2">
                <span className="w-32 font-semibold text-stone-700">Predikat Game</span>
                <span className="font-extrabold text-emerald-800">
                  :{' '}
                  {isTwoPlayer
                    ? `P1 (${resolvedPlayerName}): ${predicate.starText} ${totalScore}/100 · P2 (${resolvedPlayer2Name}): ${p2Predicate.starText} ${p2TotalScore}/100`
                    : `${predicate.starText} ${predicate.title} (${totalScore}/100)`}
                </span>
              </div>
            </div>
          </div>

          {/* 6 Butir Janji Aksi Nyata Pelestarian Alam */}
          <div className="mt-5">
            <p className="text-xs md:text-sm text-stone-800 leading-relaxed mb-3">
              Telah menyelesaikan seluruh misi pemulihan lingkungan dari{' '}
              <strong>Level 1 sampai Level 6</strong> dan berikrar sungguh-sungguh untuk menjalankan{' '}
              <strong>6 Rencana Aksi Nyata Pelestarian Alam</strong>:
            </p>

            <div className="space-y-2">
              {PIAGAM_IKRAR_ITEMS.map((itemText, idx) => {
                const isChecked = checkedPledges[idx];
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => togglePledge(idx)}
                    className="w-full text-left flex items-start gap-3 p-2.5 rounded-xl bg-white border border-amber-300/80 hover:border-emerald-600 transition-colors cursor-pointer"
                  >
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center font-extrabold text-sm shrink-0 border ${
                        isChecked
                          ? 'bg-emerald-700 text-amber-200 border-emerald-900'
                          : 'bg-stone-100 text-stone-400 border-stone-300'
                      }`}
                    >
                      {isChecked ? '✓' : ''}
                    </span>
                    <span className="text-xs md:text-sm font-medium text-stone-900 leading-snug">
                      <strong>{idx + 1}.</strong> {itemText}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="text-xs md:text-sm text-stone-800 italic mt-4">
              Ikrar ini dibuat dengan penuh kesadaran dan tanggung jawab sebagai wujud rasa syukur
              kepada Tuhan Yang Maha Esa atas anugerah alam semesta.
            </p>
          </div>

          {/* 3 Kolom Tanda Tangan Resmi + Stempel Segel Lilin Emas */}
          <div className="mt-7 pt-4 border-t border-amber-300 grid grid-cols-1 sm:grid-cols-3 items-end gap-6 text-center text-xs md:text-sm text-stone-900">
            {/* KOLOM 1: ORANG TUA / WALI MURID */}
            <div className="flex flex-col items-center">
              <div className="font-semibold">Mengetahui,</div>
              <div className="font-bold">Orang Tua / Wali Murid,</div>
              <div className="h-14" />
              {editingCertField === 'parent' ? (
                <div className="no-print w-full max-w-[230px] space-y-1.5 bg-amber-50 border border-amber-400 rounded-xl p-2 shadow-sm">
                  <input
                    type="text"
                    autoFocus
                    data-testid="input-cert-parent"
                    value={parentName}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => setParentName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setEditingCertField(null);
                    }}
                    placeholder="Ketik nama Orang Tua / Wali..."
                    aria-label="Isi nama Orang Tua atau Wali Murid"
                    className="w-full bg-white border border-amber-500 rounded-lg px-2.5 py-1 text-xs font-bold text-stone-900 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        audioEngine.playClickWood();
                        setEditingCertField(null);
                      }}
                      className="px-2.5 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold cursor-pointer"
                    >
                      ✓ Simpan
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        audioEngine.playClickWood();
                        setParentName('');
                      }}
                      className="px-2 py-0.5 rounded-md bg-stone-200 hover:bg-stone-300 text-stone-700 text-[11px] font-bold cursor-pointer"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="font-bold underline decoration-stone-400">
                    ( {resolvedParentName} )
                  </div>
                  <button
                    type="button"
                    data-testid="btn-edit-cert-parent"
                    onClick={() => {
                      audioEngine.playClickWood();
                      setEditingCertField('parent');
                    }}
                    className="no-print mt-1.5 px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 text-[11px] font-extrabold border border-amber-400 cursor-pointer transition-colors"
                  >
                    ✏️ Isi Nama Orang Tua / Wali
                  </button>
                </>
              )}
            </div>

            {/* KOLOM 2: GURU PAI & BUDI PEKERTI */}
            <div className="flex flex-col items-center">
              <GoldenWaxSealSvg />
              <div className="mt-2 font-semibold">Menyetujui,</div>
              <div className="font-bold">Guru PAI &amp; Budi Pekerti,</div>
              <div className="h-10" />
              {editingCertField === 'teacher' ? (
                <div className="no-print w-full max-w-[230px] space-y-1.5 bg-amber-50 border border-amber-400 rounded-xl p-2 shadow-sm">
                  <input
                    type="text"
                    autoFocus
                    data-testid="input-cert-teacher"
                    value={teacherName}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => setTeacherName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setEditingCertField(null);
                    }}
                    placeholder="Ketik nama Guru PAI & BP..."
                    aria-label="Isi nama Guru PAI dan Budi Pekerti"
                    className="w-full bg-white border border-amber-500 rounded-lg px-2.5 py-1 text-xs font-bold text-stone-900 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        audioEngine.playClickWood();
                        setEditingCertField(null);
                      }}
                      className="px-2.5 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold cursor-pointer"
                    >
                      ✓ Simpan
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        audioEngine.playClickWood();
                        setTeacherName('');
                      }}
                      className="px-2 py-0.5 rounded-md bg-stone-200 hover:bg-stone-300 text-stone-700 text-[11px] font-bold cursor-pointer"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="font-extrabold underline decoration-stone-500">
                    ( {resolvedTeacherName} )
                  </div>
                  <button
                    type="button"
                    data-testid="btn-edit-cert-teacher"
                    onClick={() => {
                      audioEngine.playClickWood();
                      setEditingCertField('teacher');
                    }}
                    className="no-print mt-1.5 px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 text-[11px] font-extrabold border border-amber-400 cursor-pointer transition-colors"
                  >
                    ✏️ Isi Nama Guru PAI &amp; BP
                  </button>
                </>
              )}
              <div className="text-[11px] text-stone-600 mt-1">
                Pengembang: {GAME_IDENTITY.developerBranch}
              </div>
            </div>

            {/* KOLOM 3: NAMA PEMAIN / SISWA PENJAGA BUMI CILIK */}
            <div className="flex flex-col items-center">
              <div className="font-semibold">Wonogiri, {todayFormatted}</div>
              <div className="font-bold">Siswa Penjaga Bumi Cilik,</div>
              <div className="h-14" />
              {editingCertField === 'player' ? (
                <div className="no-print w-full max-w-[230px] space-y-1.5 bg-emerald-50 border border-emerald-500 rounded-xl p-2 shadow-sm">
                  <input
                    type="text"
                    autoFocus
                    data-testid="input-cert-player"
                    value={editablePlayerName}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => setEditablePlayerName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setEditingCertField(null);
                    }}
                    placeholder={isTwoPlayer ? 'Nama Pemain 1...' : 'Ketik nama Pemain...'}
                    aria-label="Isi nama Pemain"
                    className="w-full bg-white border border-emerald-500 rounded-lg px-2.5 py-1 text-xs font-bold text-stone-900 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {isTwoPlayer && (
                    <input
                      type="text"
                      data-testid="input-cert-player2"
                      value={editablePlayer2Name}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => setEditablePlayer2Name(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setEditingCertField(null);
                      }}
                      placeholder="Nama Pemain 2..."
                      aria-label="Isi nama Pemain 2"
                      className="w-full bg-white border border-sky-500 rounded-lg px-2.5 py-1 text-xs font-bold text-stone-900 text-center focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  )}
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        audioEngine.playClickWood();
                        setEditingCertField(null);
                      }}
                      className="px-2.5 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold cursor-pointer"
                    >
                      ✓ Simpan
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        audioEngine.playClickWood();
                        setEditablePlayerName('');
                        if (isTwoPlayer) setEditablePlayer2Name('');
                      }}
                      className="px-2 py-0.5 rounded-md bg-stone-200 hover:bg-stone-300 text-stone-700 text-[11px] font-bold cursor-pointer"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="font-extrabold underline decoration-stone-500">
                    ( {isTwoPlayer ? `${resolvedPlayerName} & ${resolvedPlayer2Name}` : resolvedPlayerName} )
                  </div>
                  <button
                    type="button"
                    data-testid="btn-edit-cert-player"
                    onClick={() => {
                      audioEngine.playClickWood();
                      setEditingCertField('player');
                    }}
                    className="no-print mt-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-950 text-[11px] font-extrabold border border-emerald-500 cursor-pointer transition-colors"
                  >
                    ✏️ Isi Nama Pemain
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        {/* STATUS UNDUHAN PDF & TOMBOL NAVIGASI AKHIR (Hidden on A4 print) */}
        <div className="space-y-4 pb-8 no-print">
          {pdfReadyFile && (
            <div
              role="status"
              data-testid="pdf-download-ready-banner"
              className="bg-emerald-950/90 border border-emerald-400/80 rounded-2xl px-4 py-3 text-xs md:text-sm text-emerald-100 flex flex-wrap items-center justify-between gap-3 shadow-lg"
            >
              <span>
                ✅ Sertifikat PDF <strong>{pdfReadyFile.fileName}</strong> berhasil dibuat! Jika
                unduhan otomatis belum muncul, tekan tautan simpan di samping.
              </span>
              <a
                href={pdfReadyFile.blobUrl}
                download={pdfReadyFile.fileName}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shrink-0"
              >
                📥 Simpan Ulang PDF
              </a>
            </div>
          )}

          {pdfError && (
            <div
              role="alert"
              className="bg-amber-950/90 border border-amber-400/80 rounded-2xl px-4 py-3 text-xs md:text-sm text-amber-100"
            >
              ⚠️ {pdfError}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
            <button
              type="button"
              data-testid="btn-download-piagam-pdf"
              disabled={isGeneratingPdf}
              onClick={handleDownloadPdf}
              className="btn-clay-emerald px-6 py-3.5 rounded-2xl text-sm md:text-base font-extrabold text-white cursor-pointer flex items-center gap-2 disabled:opacity-60"
            >
              {isGeneratingPdf
                ? '⏳ Menyiapkan Berkas PDF...'
                : '📥 Unduh Sertifikat Piagam (PDF A4)'}
            </button>

            <button
              type="button"
              onClick={handlePrintPiagam}
              className="btn-clay-slate px-5 py-3.5 rounded-2xl text-sm md:text-base font-bold text-amber-300 border border-amber-500/60 cursor-pointer flex items-center gap-2"
            >
              🖨️ Cetak Langsung
            </button>

            <button
              type="button"
              onClick={() => {
                audioEngine.playClickWood();
                onPlayAgain();
              }}
              className="btn-clay-amber px-6 py-3.5 rounded-2xl text-sm md:text-base font-extrabold text-slate-950 cursor-pointer flex items-center gap-2"
            >
              🔄 Main Lagi / Remedial
            </button>

            <button
              type="button"
              onClick={() => {
                audioEngine.playClickWood();
                onExitGame();
              }}
              className="btn-clay-slate px-6 py-3.5 rounded-2xl text-sm md:text-base font-bold text-rose-300 border border-rose-700/60 cursor-pointer flex items-center gap-2"
            >
              🚪 Selesai &amp; Keluar
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};
