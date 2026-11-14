import React from 'react';
import { MonsteraLeafIcon, OfficialLogoBadge } from './OfficialLogos';
import { NarratorPersona } from '../game/audioEngine';
import { LEVEL_METADATA } from '../game/blueprintData';
import { DifficultyLevel, getDifficultyConfig } from '../game/rules';

export interface TopHudProps {
  playerName: string;
  avatarGender: 'male' | 'female';
  lives: number; // 0..3
  leafShaking: boolean;
  totalScore: number; // 0..100
  timeLeft: number;
  maxTime: number;
  readingGraceLeft: number;
  ecoHealth: number; // 20..100
  amanah: number; // 50..100
  currentLevel: number; // 1..6
  completedLevels: number[];
  difficulty: DifficultyLevel;
  roomDisplay: string;
  peerCount: number;
  persona: NarratorPersona;
  sfxEnabled: boolean;
  isFullscreen: boolean;
  onAddReadingTime: () => void;
  onCycleDifficulty: () => void;
  onOpenRoomModal: () => void;
  onCyclePersona: () => void;
  onToggleSfx: () => void;
  onToggleFullscreen: () => void;
  onOpenMissionMap: () => void;
  onTogglePause: () => void;
  onRequestLogout: () => void;
}

export const TopHudHeader: React.FC<TopHudProps> = ({
  playerName,
  avatarGender,
  lives,
  leafShaking,
  totalScore,
  timeLeft,
  maxTime,
  readingGraceLeft,
  ecoHealth,
  amanah,
  currentLevel,
  completedLevels,
  difficulty,
  roomDisplay,
  peerCount,
  persona,
  sfxEnabled,
  isFullscreen,
  onAddReadingTime,
  onCycleDifficulty,
  onOpenRoomModal,
  onCyclePersona,
  onToggleSfx,
  onToggleFullscreen,
  onOpenMissionMap,
  onTogglePause,
  onRequestLogout,
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

  const personaLabel =
    persona === 'rahma'
      ? '🎙️ BU GURU RAHMA'
      : persona === 'ilyas'
      ? '🎙️ PAK GURU ILYAS'
      : '🔇 MODE HENING';

  const diffBadgeColor =
    difficulty === 'tenang'
      ? 'text-sky-200 border-sky-400/70 bg-sky-950/80'
      : difficulty === 'mudah'
      ? 'text-emerald-300 border-emerald-500/60 bg-emerald-950/70'
      : difficulty === 'sulit'
      ? 'text-rose-300 border-rose-500/60 bg-rose-950/70'
      : 'text-amber-300 border-amber-500/60 bg-amber-950/70';

  const personaShortLabel =
    persona === 'rahma'
      ? '🎙️ Rahma'
      : persona === 'ilyas'
      ? '🎙️ Ilyas'
      : '🔇 Hening';

  return (
    <header
      aria-label="HUD Status Penjaga Bumi"
      className="w-full bg-slate-950/95 border-b-2 border-emerald-700/60 px-1.5 md:px-2.5 py-1 z-30 pointer-events-auto shadow-lg no-print"
    >
      <div className="max-w-[1920px] mx-auto flex flex-wrap lg:flex-nowrap items-center justify-between gap-1 xl:gap-1.5">
        {/* 1. Official Logos (PGRI, Wonogiri, Game) + Player Identity + 3 Monstera Leaves + Score + Difficulty & Room */}
        <div className="flex flex-wrap md:flex-nowrap items-center gap-1 xl:gap-1.5 w-full md:w-auto justify-between md:justify-start">
          <div className="hidden sm:flex items-center gap-1 shrink-0">
            <OfficialLogoBadge type="pgri" size="xs" />
            <OfficialLogoBadge type="wonogiri" size="xs" />
            <OfficialLogoBadge type="game" size="xs" />
          </div>

          <div className="flex items-center gap-1 md:gap-1.5 bg-slate-900 border border-slate-700/80 rounded-xl px-1.5 md:px-2 py-0.5 shrink-0">
            <div className="w-5 h-5 md:w-6 md:h-6 rounded-lg bg-emerald-600 flex items-center justify-center text-[10px] md:text-xs font-bold text-white shrink-0">
              {avatarGender === 'male' ? '👦' : '👧'}
            </div>
            <div className="leading-tight">
              <div className="text-[10px] md:text-[11px] font-extrabold text-white truncate max-w-[68px] md:max-w-[85px] xl:max-w-[110px]">
                {playerName}
              </div>
              <div className="text-[8px] font-semibold text-emerald-400 whitespace-nowrap">
                Lv.{currentLevel} · C{currentLevel}
              </div>
            </div>
          </div>

          {/* 3 Daun Monstera Toleransi */}
          <div
            className="flex items-center gap-0.5 bg-slate-900 border border-slate-700/80 rounded-xl px-1 md:px-1.5 py-0.5 shrink-0"
            title="3 Daun Toleransi Batin"
            data-testid="hud-lives"
          >
            {[1, 2, 3].map((idx) => (
              <MonsteraLeafIcon
                key={idx}
                active={idx <= lives}
                shaking={leafShaking && idx === lives + 1}
              />
            ))}
          </div>

          {/* Cumulative Score (0 - 100) */}
          <div
            className="bg-slate-900 border border-amber-500/60 rounded-xl px-1.5 md:px-2 py-0.5 text-center shrink-0 whitespace-nowrap"
            data-testid="hud-score"
          >
            <div className="hidden md:block text-[8px] font-bold text-amber-300 uppercase tracking-wider leading-none">
              SKOR
            </div>
            <div className="text-[10px] md:text-[11px] font-extrabold text-amber-400 font-mono-num leading-tight">
              <span className="md:hidden text-[8px] text-amber-300 mr-0.5">⭐</span>
              {Math.round(totalScore)}<span className="text-[8px] md:text-[9px] text-slate-400">/100</span>
            </div>
          </div>

          {/* TINGKAT KESULITAN : Badge (Interactive) */}
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

          {/* ROOM : Badge (Interactive) */}
          <button
            type="button"
            onClick={onOpenRoomModal}
            data-testid="hud-room"
            title="Klik untuk mengatur atau mengganti Kode Room Kelas"
            className="bg-sky-950/80 border border-sky-400/60 rounded-xl px-1.5 md:px-2 py-0.5 text-left shrink-0 cursor-pointer transition-transform active:scale-95 whitespace-nowrap"
          >
            <div className="hidden md:block text-[8px] font-extrabold uppercase tracking-wider text-sky-200 leading-none">
              ROOM :
            </div>
            <div className="text-[9.5px] md:text-[10px] font-extrabold text-sky-300 font-mono-num leading-tight whitespace-nowrap">
              {roomDisplay === '1P'
                ? '👤 1P'
                : roomDisplay === '2P'
                ? '⚔️ 2P'
                : `🏫 ${roomDisplay}`} {peerCount > 0 ? `(${peerCount + 1}P)` : ''}
            </div>
          </button>
        </div>

        {/* 2. Countdown Timer + +30s Reading Boost + Dual-Gauge Bar + C1-C6 Progress */}
        <div className="flex items-center gap-1 xl:gap-1.5 w-full md:w-auto justify-between md:justify-start">
          {/* Countdown Capsule with Smart Reading Freeze */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-xl px-1.5 md:px-2 py-0.5 shrink-0">
            <div className="min-w-[68px] md:min-w-[82px]">
              <div className="flex items-center justify-between text-[8.5px] md:text-[9px] font-bold mb-0.5 gap-1 whitespace-nowrap">
                <span className="text-slate-300">
                  {isUntimed ? '🌱 WAKTU' : isReadingFreeze ? '📖 BACA' : '⏱️ WAKTU'}
                </span>
                <span
                  className={`font-mono-num ${
                    isUntimed || isReadingFreeze
                      ? 'text-sky-300 font-extrabold'
                      : isCriticalTime
                      ? 'text-rose-400 font-extrabold'
                      : 'text-emerald-300'
                  }`}
                >
                  {isUntimed
                    ? '∞'
                    : isReadingFreeze
                    ? `Jeda ${Math.ceil(readingGraceLeft)}s`
                    : `${timeLeft.toFixed(0)}s`}
                </span>
              </div>
              <div className="w-full h-1 md:h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div
                  className={`h-full transition-all duration-200 ${timerColor}`}
                  style={{ width: `${Math.round(timeRatio * 100)}%` }}
                />
              </div>
            </div>

            {!isUntimed && (
              <button
                type="button"
                onClick={onAddReadingTime}
                data-testid="hud-add-reading-time"
                title="Tambah +30 Detik Waktu Membaca & Berhitung (Tanpa Mengurangi Daun Toleransi)"
                className="bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/60 text-emerald-300 rounded-lg px-1.5 py-0.5 text-[9px] font-extrabold whitespace-nowrap cursor-pointer transition-transform active:scale-95"
              >
                +30d
              </button>
            )}
          </div>

          {/* Mobile Compact Action Bar Slot (wraps neatly alongside Timer on tiny screens, full buttons on md+) */}
          <div className="flex md:hidden items-center gap-1 text-[9px] font-bold text-slate-300">
            <span className="bg-slate-900 border border-emerald-500/40 rounded-lg px-1.5 py-0.5 font-mono-num text-emerald-300">
              🌿 {ecoHealth}%
            </span>
            <span className="bg-slate-900 border border-amber-500/40 rounded-lg px-1.5 py-0.5 font-mono-num text-amber-300">
              ✨ {amanah}%
            </span>
          </div>

          {/* Dual-Gauge Bar: Eco-Health (Emerald) & Amanah (Gold) */}
          <div className="hidden xl:flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-xl px-2 py-0.5 shrink-0">
            <div className="w-15">
              <div className="flex justify-between text-[9px] font-bold text-emerald-300 mb-0.5 whitespace-nowrap">
                <span>🌿 Eco</span>
                <span className="font-mono-num">{ecoHealth}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-emerald-500/40">
                <div
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-300"
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

          {/* 6-Level Hexagonal Progress Bar (C1..C6) */}
          <div
            className="hidden 2xl:flex items-center gap-0.5 bg-slate-900 border border-slate-700/80 rounded-xl px-1.5 py-1 shrink-0"
            aria-label="Tahapan Level Taksonomi Bloom C1 sampai C6"
          >
            {LEVEL_METADATA.map((meta, idx) => {
              const isCurrent = currentLevel === meta.level;
              const isDone = completedLevels.includes(meta.level);
              return (
                <React.Fragment key={meta.level}>
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-extrabold font-mono-num transition-transform ${
                      isCurrent
                        ? 'bg-amber-400 text-slate-950 scale-105 ring-1 ring-amber-200'
                        : isDone
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                    title={`Level ${meta.level}: ${meta.name} (${meta.bloomCode})`}
                  >
                    {meta.bloomCode}
                  </div>
                  {idx < 5 && (
                    <div
                      className={`w-1 h-0.5 ${
                        isDone ? 'bg-emerald-400' : 'bg-slate-700'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* 3. Mission Map, Narator, Audio & Prominent Tombol Keluar (Wrap rapi di HP, 1 Baris Utuh di PC/IFP) */}
        <div className="flex flex-wrap md:flex-nowrap items-center justify-between md:justify-end gap-1 xl:gap-1.5 w-full md:w-auto">
          <button
            type="button"
            onClick={onOpenMissionMap}
            className="btn-clay-amber px-1.5 md:px-2.5 py-0.5 md:py-1 rounded-xl text-[9px] md:text-[10px] font-extrabold text-slate-950 whitespace-nowrap shrink-0 cursor-pointer shadow-sm transition-transform active:scale-95"
            title="Peta Misi — Loncat Bebas ke Level 1-6 untuk Evaluasi Juri"
          >
            🗺️ <span className="hidden md:inline">Peta </span>Misi
          </button>

          <button
            type="button"
            onClick={onCyclePersona}
            className="btn-clay-slate px-1.5 md:px-2 py-0.5 md:py-1 rounded-xl text-[9px] md:text-[10px] font-bold text-emerald-300 border border-slate-700 whitespace-nowrap shrink-0 cursor-pointer transition-transform active:scale-95"
            title="Ganti Suara Narator Guru PAI & BP"
          >
            <span className="md:hidden">{personaShortLabel}</span>
            <span className="hidden md:inline">{personaLabel}</span>
          </button>

          <button
            type="button"
            onClick={onToggleSfx}
            aria-label={sfxEnabled ? 'Matikan Suara Permainan (Sound Off)' : 'Nyalakan Suara Permainan (Sound On)'}
            title={sfxEnabled ? 'Suara Permainan Aktif (Klik untuk mematikan semua suara game selain narator)' : 'Suara Permainan Mati (Hanya narator yang aktif)'}
            className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded-xl text-[9px] md:text-[10px] font-black border whitespace-nowrap shrink-0 cursor-pointer transition-all active:scale-95 flex items-center gap-1 ${
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

          <button
            type="button"
            onClick={onTogglePause}
            aria-label="Jeda Permainan"
            className="btn-clay-slate px-1.5 md:px-2 py-0.5 md:py-1 rounded-xl text-[9px] md:text-[10px] font-bold text-slate-200 border border-slate-700 whitespace-nowrap shrink-0 cursor-pointer transition-transform active:scale-95"
          >
            ⏸️ Jeda
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label="Layar Penuh"
            className="btn-clay-slate px-1.5 md:px-2 py-0.5 md:py-1 rounded-xl text-[9px] md:text-[10px] font-bold text-sky-300 border border-slate-700 whitespace-nowrap shrink-0 cursor-pointer transition-transform active:scale-95"
          >
            {isFullscreen ? '🗗 Jendela' : '⛶ Penuh'}
          </button>

          {/* TOMBOL KELUAR */}
          <button
            type="button"
            onClick={onRequestLogout}
            data-testid="hud-logout-btn"
            className="bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-extrabold px-2 md:px-2.5 py-0.5 md:py-1 rounded-xl text-[9.5px] md:text-[11px] shadow-md shadow-rose-950/60 border border-rose-300/80 whitespace-nowrap shrink-0 cursor-pointer transition-all flex items-center gap-0.5 md:gap-1 ring-1 ring-rose-400/50"
            title="Keluar dari sesi permainan atau ganti pemain"
          >
            <span className="text-[10px] md:text-xs">🚪</span>
            <span>Keluar</span>
          </button>
        </div>
      </div>
    </header>
  );
};
