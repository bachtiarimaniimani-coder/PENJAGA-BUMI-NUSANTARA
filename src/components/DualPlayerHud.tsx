import React from 'react';
import { MonsteraLeafIcon, OfficialLogoBadge } from './OfficialLogos';
import { NarratorPersona } from '../game/audioEngine';
import { LEVEL_METADATA } from '../game/blueprintData';
import { DifficultyLevel, getDifficultyConfig } from '../game/rules';

export interface DualPlayerSharedHeaderProps {
  currentLevel: number;
  p2CurrentLevel?: number;
  completedLevels: number[];
  ecoHealth: number;
  amanah: number;
  difficulty: DifficultyLevel;
  persona: NarratorPersona;
  sfxEnabled: boolean;
  isFullscreen: boolean;
  onCycleDifficulty: () => void;
  onOpenRoomModal: () => void;
  onOpenMissionMap: () => void;
  onCyclePersona: () => void;
  onToggleSfx: () => void;
  onToggleFullscreen: () => void;
  onTogglePause: () => void;
  onRequestLogout: () => void;
}

export const DualPlayerSharedHeader: React.FC<DualPlayerSharedHeaderProps> = ({
  currentLevel,
  p2CurrentLevel,
  completedLevels,
  ecoHealth,
  amanah,
  difficulty,
  persona,
  sfxEnabled,
  isFullscreen,
  onCycleDifficulty,
  onOpenRoomModal,
  onOpenMissionMap,
  onCyclePersona,
  onToggleSfx,
  onToggleFullscreen,
  onTogglePause,
  onRequestLogout,
}) => {
  const currentMeta = LEVEL_METADATA[currentLevel - 1] || LEVEL_METADATA[0];
  const p2Meta = LEVEL_METADATA[(p2CurrentLevel ?? currentLevel) - 1] || currentMeta;
  const diffCfg = getDifficultyConfig(difficulty);

  const personaLabel =
    persona === 'rahma'
      ? '🎙️ BU GURU RAHMA'
      : persona === 'ilyas'
      ? '🎙️ PAK GURU ILYAS'
      : '🔇 MODE HENING';

  const personaShortLabel =
    persona === 'rahma'
      ? '🎙️ Rahma'
      : persona === 'ilyas'
      ? '🎙️ Ilyas'
      : '🔇 Hening';

  const diffBadgeColor =
    difficulty === 'tenang'
      ? 'text-sky-200 border-sky-400/70 bg-sky-950/80'
      : difficulty === 'mudah'
      ? 'text-emerald-300 border-emerald-500/60 bg-emerald-950/70'
      : difficulty === 'sulit'
      ? 'text-rose-300 border-rose-500/60 bg-rose-950/70'
      : 'text-amber-300 border-amber-500/60 bg-amber-950/70';

  return (
    <header
      aria-label="HUD Umum Bersama Mode 2P"
      data-testid="dual-shared-header"
      className="w-full bg-slate-950/95 border-b-2 border-emerald-600/80 px-1.5 md:px-2.5 py-1 z-30 pointer-events-auto shadow-xl select-none no-print"
    >
      <div className="max-w-[1920px] mx-auto flex flex-wrap lg:flex-nowrap items-center justify-between gap-1 xl:gap-1.5">
        {/* BAGIAN KIRI & TENGAH UMUM (1 SAJA): Logo Resmi + Misi Level + Progres C1-C6 + Eco/Amanah + Kesulitan & Room */}
        <div className="flex flex-wrap md:flex-nowrap items-center gap-1 xl:gap-1.5 w-full md:w-auto justify-between md:justify-start">
          <div className="hidden sm:flex items-center gap-1 shrink-0" data-testid="shared-logos-2p">
            <OfficialLogoBadge type="pgri" size="xs" />
            <OfficialLogoBadge type="wonogiri" size="xs" />
            <OfficialLogoBadge type="game" size="xs" />
          </div>

          {/* Level Tracker (Menampilkan progres kompetitif P1 & P2) */}
          <div className="flex items-center gap-1 md:gap-1.5 bg-slate-900 border border-slate-700/80 rounded-xl px-1.5 md:px-2 py-0.5 shrink-0 whitespace-nowrap">
            {p2CurrentLevel && p2CurrentLevel !== currentLevel ? (
              <>
                <span className="text-[9.5px] md:text-[10px] font-extrabold text-emerald-300">
                  P1: Lv.{currentLevel} ({currentMeta.bloomCode})
                </span>
                <span className="text-slate-600">vs</span>
                <span className="text-[9.5px] md:text-[10px] font-extrabold text-sky-300">
                  P2: Lv.{p2CurrentLevel} ({p2Meta.bloomCode})
                </span>
              </>
            ) : (
              <>
                <span className="text-[9.5px] md:text-[10px] font-extrabold text-amber-300 uppercase">
                  Lv.{currentLevel}:
                </span>
                <span className="text-[10px] md:text-[11px] font-black text-white truncate max-w-[85px] md:max-w-[115px] xl:max-w-[165px]">
                  {currentMeta.name}
                </span>
                <span className="bg-amber-400 text-slate-950 text-[9px] md:text-[10px] font-extrabold px-1 md:px-1.5 py-0.2 rounded">
                  {currentMeta.bloomCode}
                </span>
              </>
            )}
          </div>

          {/* Indikator Tahapan C1..C6 (1 Saja) */}
          <div
            className="hidden xl:flex items-center gap-0.5 bg-slate-900 border border-slate-700/80 rounded-xl px-1.5 py-0.5 shrink-0"
            aria-label="Tahapan Level Taksonomi Bloom C1 sampai C6"
          >
            {LEVEL_METADATA.map((meta, idx) => {
              const isCurrent =
                currentLevel === meta.level || (p2CurrentLevel ?? currentLevel) === meta.level;
              const isDone = completedLevels.includes(meta.level);
              return (
                <React.Fragment key={meta.level}>
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-extrabold font-mono-num ${
                      isCurrent
                        ? 'bg-amber-400 text-slate-950 ring-1 ring-amber-200'
                        : isDone
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                    title={`Level ${meta.level}: ${meta.name} (${meta.bloomCode})`}
                  >
                    {meta.bloomCode}
                  </div>
                  {idx < 5 && (
                    <div className={`w-1 h-0.5 ${isDone ? 'bg-emerald-400' : 'bg-slate-700'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Dual-Gauge Bersama (Eco-Health & Amanah Nusantara - 1 Saja) */}
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 rounded-xl px-2 py-0.5 shrink-0">
            <div className="w-15">
              <div className="flex justify-between text-[9px] font-bold text-emerald-400 mb-0.5 whitespace-nowrap">
                <span>🌿 Eco</span>
                <span className="font-mono-num">{ecoHealth}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-emerald-500/40">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                  style={{ width: `${ecoHealth}%` }}
                />
              </div>
            </div>

            <div className="w-15">
              <div className="flex justify-between text-[9px] font-bold text-amber-300 mb-0.5 whitespace-nowrap">
                <span>✨ Amanah</span>
                <span className="font-mono-num">{amanah}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-amber-500/40">
                <div
                  className="h-full bg-gradient-to-r from-amber-600 to-yellow-400 transition-all duration-300"
                  style={{ width: `${amanah}%` }}
                />
              </div>
            </div>
          </div>

          {/* TINGKAT KESULITAN (1 Saja) */}
          <button
            type="button"
            onClick={onCycleDifficulty}
            data-testid="hud-difficulty"
            title="Klik untuk mengganti Tingkat Kesulitan (Mudah / Sedang / Sulit)"
            className={`border rounded-xl px-1.5 md:px-2 py-0.5 text-left shrink-0 cursor-pointer transition-transform active:scale-95 whitespace-nowrap ${diffBadgeColor}`}
          >
            <div className="hidden md:block text-[8px] font-extrabold uppercase tracking-wider text-slate-200 leading-none">
              KESULITAN :
            </div>
            <div className="text-[9.5px] md:text-[10px] font-extrabold font-mono-num leading-tight">
              ⚡ {diffCfg.label}
            </div>
          </button>

          {/* ROOM : 2P (1 Saja) */}
          <button
            type="button"
            onClick={onOpenRoomModal}
            data-testid="hud-room"
            title="Klik untuk mengatur Mode Permainan atau Nama Pemain"
            className="bg-sky-950/80 border border-sky-400/60 rounded-xl px-1.5 md:px-2 py-0.5 text-left shrink-0 cursor-pointer transition-transform active:scale-95 whitespace-nowrap"
          >
            <div className="hidden md:block text-[8px] font-extrabold uppercase tracking-wider text-sky-200 leading-none">
              MODE :
            </div>
            <div className="text-[9.5px] md:text-[10px] font-extrabold text-sky-300 font-mono-num leading-tight">
              ⚔️ 2P<span className="hidden md:inline"> DUEL</span>
            </div>
          </button>
        </div>

        {/* BAGIAN KANAN: Kontrol Umum (Wrap rapi di HP, 1 Baris Utuh di Laptop & IFP) */}
        <div className="flex flex-wrap md:flex-nowrap items-center justify-between md:justify-end gap-1 xl:gap-1.5 w-full md:w-auto">
          {/* 1. Peta Misi */}
          <button
            type="button"
            onClick={onOpenMissionMap}
            className="btn-clay-amber px-1.5 md:px-2 py-0.5 md:py-1 rounded-xl text-[9px] md:text-[10px] font-extrabold text-slate-950 whitespace-nowrap cursor-pointer shadow-sm active:scale-95"
            title="Peta Misi — Loncat Level untuk Evaluasi Juri"
          >
            🗺️ <span className="hidden md:inline">Peta </span>Misi
          </button>

          {/* 2. Suara Narator Guru */}
          <button
            type="button"
            onClick={onCyclePersona}
            className="btn-clay-slate px-1.5 md:px-2 py-0.5 md:py-1 rounded-xl text-[9px] md:text-[10px] font-bold text-emerald-300 border border-slate-700 whitespace-nowrap cursor-pointer active:scale-95"
            title="Ganti Suara Narator Guru PAI & BP"
          >
            <span className="md:hidden">{personaShortLabel}</span>
            <span className="hidden md:inline">{personaLabel}</span>
          </button>

          {/* 3. Toggle SOUND ON / OFF */}
          <button
            type="button"
            onClick={onToggleSfx}
            aria-label={
              sfxEnabled
                ? 'Matikan Suara Permainan (Sound Off)'
                : 'Nyalakan Suara Permainan (Sound On)'
            }
            title={
              sfxEnabled
                ? 'Suara Permainan Aktif (Klik untuk mematikan semua suara game selain narator)'
                : 'Suara Permainan Mati (Hanya narator yang aktif)'
            }
            className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded-xl text-[9px] md:text-[10px] font-black border whitespace-nowrap cursor-pointer transition-all active:scale-95 flex items-center gap-1 ${
              sfxEnabled
                ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 shadow-sm shadow-emerald-500/20'
                : 'bg-slate-900 border-rose-500/40 text-rose-300'
            }`}
          >
            <span className="text-[10px] md:text-xs">{sfxEnabled ? '🔊' : '🔇'}</span>
            <span className="md:hidden">{sfxEnabled ? 'ON' : 'OFF'}</span>
            <span className="hidden md:inline">{sfxEnabled ? 'SOUND ON' : 'SOUND OFF'}</span>
            <span
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                sfxEnabled ? 'bg-emerald-400' : 'bg-rose-500/70'
              }`}
            />
          </button>

          {/* 4. Jeda Permainan */}
          <button
            type="button"
            onClick={onTogglePause}
            aria-label="Jeda Permainan"
            className="btn-clay-slate px-1.5 md:px-2 py-0.5 md:py-1 rounded-xl text-[9px] md:text-[10px] font-bold text-slate-200 border border-slate-700 whitespace-nowrap cursor-pointer active:scale-95"
          >
            ⏸️ Jeda
          </button>

          {/* 5. Layar Penuh */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label="Layar Penuh"
            className="btn-clay-slate px-1.5 md:px-2 py-0.5 md:py-1 rounded-xl text-[9px] md:text-[10px] font-bold text-sky-300 border border-slate-700 whitespace-nowrap cursor-pointer active:scale-95"
          >
            {isFullscreen ? '🗗 Jendela' : '⛶ Penuh'}
          </button>

          {/* 6. Tombol Keluar Menonjol */}
          <button
            type="button"
            onClick={onRequestLogout}
            data-testid="hud-logout-btn"
            className="bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-extrabold px-2 md:px-2.5 py-0.5 md:py-1 rounded-xl text-[9.5px] md:text-[11px] shadow-md shadow-rose-950/60 border border-rose-300/80 whitespace-nowrap cursor-pointer transition-all flex items-center gap-0.5 md:gap-1 ring-1 ring-rose-400/50"
            title="Keluar dari sesi permainan 2P"
          >
            <span className="text-[10px] md:text-xs">🚪</span>
            <span>Keluar</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export interface PersonalPlayerHudStripProps {
  playerNumber: 1 | 2;
  playerName: string;
  avatarGender: 'male' | 'female';
  currentLevel?: number;
  lives: number; // 0..3
  leafShaking: boolean;
  totalScore: number; // 0..100
  timeLeft: number;
  maxTime: number;
  readingGraceLeft?: number;
  difficulty: DifficultyLevel;
  onAddReadingTime?: () => void;
}

export const PersonalPlayerHudStrip: React.FC<PersonalPlayerHudStripProps> = ({
  playerNumber,
  playerName,
  avatarGender,
  currentLevel = 1,
  lives,
  leafShaking,
  totalScore,
  timeLeft,
  maxTime,
  readingGraceLeft = 0,
  difficulty,
  onAddReadingTime,
}) => {
  const diffCfg = getDifficultyConfig(difficulty);
  const isUntimed = diffCfg.untimed;
  const isReadingFreeze = !isUntimed && readingGraceLeft > 0;
  const timeRatio = isUntimed
    ? 1
    : maxTime > 0
    ? Math.min(1, Math.max(0, timeLeft / maxTime))
    : 1;
  const isCriticalTime = !isUntimed && !isReadingFreeze && timeLeft <= 10;
  const timerColor = isUntimed
    ? 'bg-sky-400'
    : isReadingFreeze
    ? 'bg-sky-400'
    : isCriticalTime
    ? 'bg-rose-500'
    : timeRatio < 0.45
    ? 'bg-amber-400'
    : 'bg-emerald-400';

  const isP1 = playerNumber === 1;
  const lvMeta = LEVEL_METADATA[currentLevel - 1] || LEVEL_METADATA[0];
  const showMovementHint = currentLevel !== 1 && currentLevel !== 2;

  return (
    <div
      data-testid={isP1 ? 'personal-hud-p1' : 'personal-hud-p2'}
      aria-label={isP1 ? 'HUD Pribadi Pemain 1 (Kiri)' : 'HUD Pribadi Pemain 2 (Kanan)'}
      className={`w-full px-2 py-1 flex flex-wrap lg:flex-nowrap items-center justify-between gap-1 border-b ${
        isP1
          ? 'bg-emerald-950/90 border-emerald-500/60'
          : 'bg-sky-950/90 border-sky-500/60'
      } pointer-events-auto z-20 shadow-md select-none`}
    >
      {/* SISI KIRI PANEL PEMAIN: Badge Pemain (Kiri/Kanan), Avatar & Nama Pribadi */}
      <div className="flex items-center gap-1 shrink-0 min-w-0">
        <div
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[9px] md:text-[10px] font-black border shrink-0 whitespace-nowrap ${
            isP1
              ? 'bg-emerald-900/90 text-emerald-200 border-emerald-400/60'
              : 'bg-sky-900/90 text-sky-200 border-sky-400/60'
          }`}
        >
          <span>🎮</span>
          <span className="md:hidden">{isP1 ? 'P1' : 'P2'}</span>
          <span className="hidden md:inline">{isP1 ? 'P1 (KIRI)' : 'P2 (KANAN)'}</span>
          {showMovementHint && (
            <span className="hidden md:inline bg-slate-950 px-1 py-0.2 rounded text-[8px] font-mono font-bold text-amber-300 border border-slate-700">
              {isP1 ? 'WASD' : 'PANAH'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 bg-slate-900/95 border border-slate-700/80 rounded-xl px-1.5 py-0.5 min-w-0">
          <div
            className={`w-4 h-4 md:w-5 md:h-5 rounded-md flex items-center justify-center text-[10px] md:text-xs font-bold text-white shrink-0 ${
              isP1 ? 'bg-emerald-600' : 'bg-sky-600'
            }`}
          >
            {avatarGender === 'male' ? '👦' : '👧'}
          </div>
          <span
            data-testid={isP1 ? 'hud-name-p1' : 'hud-name-p2'}
            className="text-[10px] md:text-[11px] font-extrabold text-white truncate max-w-[54px] md:max-w-[90px] xl:max-w-[120px]"
          >
            {playerName || (isP1 ? 'Pemain 1' : 'Pemain 2')}
          </span>
          <span className="text-[8px] md:text-[9px] font-extrabold font-mono-num bg-amber-400 text-slate-950 px-1 py-0.2 rounded shrink-0 whitespace-nowrap">
            Lv.{currentLevel} <span className="hidden md:inline">{lvMeta.bloomCode}</span>
          </span>
        </div>
      </div>

      {/* SISI KANAN PANEL PEMAIN: Nyawa Pribadi (3 Daun), Skor Bloom Pribadi & Timer Pribadi (1 Baris) */}
      <div className="flex items-center gap-1 shrink-0 ml-auto">
        {/* 3 Daun Monstera Toleransi (Nyawa Pribadi) */}
        <div
          className="flex items-center gap-0.5 bg-slate-900/95 border border-slate-700/80 rounded-xl px-1 md:px-1.5 py-0.5 shrink-0"
          title={`Nyawa (3 Daun Toleransi) ${isP1 ? 'Pemain 1' : 'Pemain 2'}`}
          data-testid={isP1 ? 'hud-lives-p1' : 'hud-lives-p2'}
        >
          <span className="text-[8px] font-extrabold text-emerald-300 uppercase mr-0.5 hidden xl:inline">
            NYAWA:
          </span>
          {[1, 2, 3].map((idx) => (
            <MonsteraLeafIcon
              key={idx}
              active={idx <= lives}
              shaking={leafShaking && idx === lives + 1}
            />
          ))}
        </div>

        {/* Skor Bloom Individu */}
        <div
          className="bg-slate-900/95 border border-amber-500/60 rounded-xl px-1 md:px-1.5 py-0.5 text-center shrink-0 whitespace-nowrap"
          data-testid={isP1 ? 'hud-score-p1' : 'hud-score-p2'}
        >
          <span className="hidden md:inline text-[8px] font-extrabold text-amber-300 uppercase tracking-wider mr-0.5">
            SKOR:
          </span>
          <span className="text-[10px] md:text-[11px] font-extrabold text-amber-400 font-mono-num">
            {Math.round(totalScore)}
          </span>
          <span className="text-[7px] md:text-[8px] text-slate-400">/100</span>
        </div>

        {/* Timer Individu */}
        <div className="flex items-center gap-1 bg-slate-900/95 border border-slate-700/80 rounded-xl px-1.5 py-0.5 shrink-0 whitespace-nowrap">
          <span className="text-[9px]">⏱️</span>
          <span className="text-[11px] font-extrabold font-mono-num text-white">
            {isUntimed
              ? '∞'
              : isReadingFreeze
              ? `${Math.ceil(readingGraceLeft)}s 📖`
              : `${Math.ceil(timeLeft)}s`}
          </span>
          {!isUntimed && (
            <div className="w-6 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700 hidden sm:block">
              <div
                className={`h-full ${timerColor} transition-all duration-300`}
                style={{ width: `${Math.round(timeRatio * 100)}%` }}
              />
            </div>
          )}
          {!isUntimed && onAddReadingTime && (
            <button
              type="button"
              onClick={onAddReadingTime}
              className="text-[8px] font-extrabold bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/60 text-emerald-300 px-1 py-0.5 rounded cursor-pointer"
              title="Tambah +30 Detik Waktu Membaca Pribadi"
            >
              +30d
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
