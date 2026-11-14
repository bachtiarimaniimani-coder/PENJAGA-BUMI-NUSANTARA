import React, { useEffect, useState } from 'react';
import { LEVEL_4_CITIZENS, LEVEL_5_ZONES, LEVEL_6_ISLANDS } from '../game/blueprintData';
import { LEVEL_6_TOWER_POSITIONS } from '../game/rules';

export interface MiniMapProps {
  currentLevel: number;
  playerX: number;
  playerZ: number;
  playerPosRef?: React.MutableRefObject<{ x: number; z: number }>;
  partnerPosRef?: React.MutableRefObject<{ x: number; z: number }>;
  playerSlot?: 1 | 2;
  compact?: boolean;
  completedCitizens: number[];
  completedZones: number[];
  completedIslands: number[];
  activeZoneIdx: number;
  activeIslandIdx: number;
  l4Positions?: [number, number][];
  l5Positions?: [number, number][];
  onSelectCitizen?: (idx: number) => void;
  onSelectZone?: (idx: number) => void;
  onSelectIsland?: (idx: number) => void;
}

/**
 * Contextual Mini Map (Section III.3 & VIII: Mandatory active in Level 4, 5, and 6).
 * Supports independent per-player instances in 2P Split Mode.
 */
export const ContextualMiniMap: React.FC<MiniMapProps> = ({
  currentLevel,
  playerX,
  playerZ,
  playerPosRef,
  partnerPosRef,
  playerSlot,
  compact = false,
  completedCitizens,
  completedZones,
  completedIslands,
  activeZoneIdx,
  activeIslandIdx,
  l4Positions,
  l5Positions,
  onSelectCitizen,
  onSelectZone,
  onSelectIsland,
}) => {
  const [livePos, setLivePos] = useState<{ x: number; z: number }>({
    x: playerX,
    z: playerZ,
  });
  const [partnerLivePos, setPartnerLivePos] = useState<{ x: number; z: number } | null>(() =>
    partnerPosRef ? { x: partnerPosRef.current.x, z: partnerPosRef.current.z } : null
  );

  useEffect(() => {
    if ((currentLevel !== 4 && currentLevel !== 5 && currentLevel !== 6) || (!playerPosRef && !partnerPosRef)) {
      return;
    }
    if (playerPosRef) {
      setLivePos({ x: playerPosRef.current.x, z: playerPosRef.current.z });
    }
    if (partnerPosRef) {
      setPartnerLivePos({ x: partnerPosRef.current.x, z: partnerPosRef.current.z });
    }
    const id = window.setInterval(() => {
      if (playerPosRef) {
        const curX = playerPosRef.current.x;
        const curZ = playerPosRef.current.z;
        setLivePos((prev) =>
          Math.abs(prev.x - curX) > 0.08 || Math.abs(prev.z - curZ) > 0.08
            ? { x: curX, z: curZ }
            : prev
        );
      }
      if (partnerPosRef) {
        const px = partnerPosRef.current.x;
        const pz = partnerPosRef.current.z;
        setPartnerLivePos((prev) =>
          !prev || Math.abs(prev.x - px) > 0.08 || Math.abs(prev.z - pz) > 0.08
            ? { x: px, z: pz }
            : prev
        );
      }
    }, 120);
    return () => window.clearInterval(id);
  }, [currentLevel, playerPosRef, partnerPosRef]);

  if (currentLevel < 4) return null;

  const dotX = playerPosRef ? livePos.x : playerX;
  const dotZ = playerPosRef ? livePos.z : playerZ;
  const isP2 = playerSlot === 2;
  const borderAccent = isP2 ? 'border-sky-500/75' : 'border-emerald-500/75';
  const titleAccent = isP2 ? 'text-sky-300' : 'text-emerald-400';
  const dotRing = isP2 ? 'ring-sky-400' : 'ring-emerald-400';
  const partnerDotBg = isP2 ? 'bg-emerald-400 ring-emerald-200' : 'bg-sky-400 ring-sky-200';
  const partnerLabel = isP2 ? 'P1' : 'P2';

  return (
    <aside
      aria-label={
        playerSlot
          ? `Radar Mini Map Kontekstual Pemain ${playerSlot}`
          : 'Radar Mini Map Kontekstual'
      }
      data-testid={playerSlot ? `contextual-minimap-p${playerSlot}` : 'contextual-minimap'}
      className={`bg-slate-950/92 border-2 ${borderAccent} rounded-2xl shadow-xl pointer-events-auto ${
        compact ? 'p-1 w-[84px] md:p-2 md:w-44 lg:w-48' : 'p-1.5 w-[114px] md:p-3 md:w-56'
      }`}
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-0.5 md:pb-1 mb-1 md:mb-1.5 gap-1">
        <span
          className={`font-extrabold uppercase tracking-wider truncate ${titleAccent} ${
            compact ? 'text-[8px] md:text-[10px]' : 'text-[8.5px] md:text-[11px]'
          }`}
        >
          {playerSlot ? `P${playerSlot}: ` : ''}
          {currentLevel === 4
            ? compact
              ? '📡 Radar Kota'
              : '📡 Radar Kota Lestari'
            : currentLevel === 5
            ? compact
              ? '🗺️ 5 Zona'
              : '🗺️ 5 Ekosistem Desa'
            : compact
            ? '🛰️ Sonar Pulau'
            : '🛰️ Sonar Satelit Nusantara'}
        </span>
        <span
          className={`hidden md:inline-block text-[9px] font-mono-num font-bold px-1.5 py-0.2 rounded ${
            isP2 ? 'bg-sky-950 text-sky-300' : 'bg-emerald-950 text-emerald-300'
          }`}
        >
          {playerSlot ? `P${playerSlot}` : 'AKTIF'}
        </span>
      </div>

      {currentLevel === 4 && (
        <div>
          <div
            className={`relative w-full bg-slate-900 rounded-lg md:rounded-xl border border-slate-800 overflow-hidden md:mb-1.5 ${
              compact ? 'h-14 md:h-24' : 'h-[72px] md:h-36'
            }`}
          >
            {/* Cross Roads */}
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1.5 md:w-2.5 bg-slate-800" />
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 md:h-2.5 bg-slate-800" />

            {/* 5 Citizen Beacons */}
            {LEVEL_4_CITIZENS.map((cit, idx) => {
              const pos = l4Positions?.[idx] ?? cit.position;
              const leftPct = Math.min(90, Math.max(10, 50 + (pos[0] / 22) * 42));
              const topPct = Math.min(90, Math.max(10, 50 + (pos[1] / 22) * 42));
              const done = completedCitizens.includes(idx);
              return (
                <button
                  key={cit.id}
                  type="button"
                  onClick={() => onSelectCitizen?.(idx)}
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    backgroundColor: done ? '#10b981' : cit.radarColor,
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border md:border-2 border-white flex items-center justify-center font-extrabold text-slate-950 shadow cursor-pointer hover:scale-125 transition-transform ${
                    compact
                      ? 'w-3 h-3 text-[6.5px] md:w-4 md:h-4 md:text-[8px]'
                      : 'w-3.5 h-3.5 text-[7px] md:w-5 md:h-5 md:text-[9px]'
                  }`}
                  title={`${cit.npcName} — Klik untuk menghampiri`}
                >
                  {done ? '✓' : idx + 1}
                </button>
              );
            })}

            {/* Partner Avatar Dot (2P Split Mode) */}
            {partnerLivePos && (
              <div
                style={{
                  left: `${Math.min(92, Math.max(8, 50 + (partnerLivePos.x / 22) * 42))}%`,
                  top: `${Math.min(92, Math.max(8, 50 + (partnerLivePos.z / 22) * 42))}%`,
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 pointer-events-none ${partnerDotBg} ${
                  compact ? 'w-2 h-2 md:w-2.5 md:h-2.5' : 'w-2.5 h-2.5 md:w-3 md:h-3'
                }`}
                title={`Posisi ${partnerLabel}`}
              />
            )}

            {/* Player Avatar Dot */}
            <div
              style={{
                left: `${Math.min(92, Math.max(8, 50 + (dotX / 22) * 42))}%`,
                top: `${Math.min(92, Math.max(8, 50 + (dotZ / 22) * 42))}%`,
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-sm bg-white ring-2 ${dotRing} pointer-events-none ${
                compact ? 'w-2 h-2 md:w-3 md:h-3' : 'w-2.5 h-2.5 md:w-3.5 md:h-3.5'
              }`}
              title="Posisi Avatarmu"
            />
          </div>
          <p className={`hidden md:block text-slate-300 leading-tight ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
            {compact ? (
              <>
                Gerak <strong>Joystik/{isP2 ? 'Panah' : 'WASD'}</strong> atau klik warga (<strong>[E]</strong>).
              </>
            ) : (
              <>
                Gunakan <strong>Joystik / WASD</strong> atau klik titik warga di radar untuk mendekat (<strong>[E]</strong>).
              </>
            )}
          </p>
        </div>
      )}

      {currentLevel === 5 && (
        <div>
          <div
            className={`relative w-full bg-slate-900 rounded-lg md:rounded-xl border border-slate-800 overflow-hidden md:mb-1.5 ${
              compact ? 'h-14 md:h-24' : 'h-[72px] md:h-36'
            }`}
          >
            {/* Open Ecosystem Terrain Radar */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/45 via-slate-900/40 to-sky-950/45" />
            <div className="absolute inset-2 md:inset-3 rounded-full border border-emerald-500/20" />
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-emerald-500/20" />
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-emerald-500/20" />

            {/* 5 Randomized Ecosystem Guardian Beacons */}
            {LEVEL_5_ZONES.map((z, idx) => {
              const pos = l5Positions?.[idx] ?? z.position;
              const leftPct = Math.min(90, Math.max(10, 50 + (pos[0] / 22) * 42));
              const topPct = Math.min(90, Math.max(10, 50 + (pos[1] / 22) * 42));
              const done = completedZones.includes(idx);
              const active = activeZoneIdx === idx;
              return (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => onSelectZone?.(idx)}
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    backgroundColor: done ? '#10b981' : z.radarColor,
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border md:border-2 border-white flex items-center justify-center font-extrabold text-slate-950 shadow cursor-pointer hover:scale-125 transition-transform ${
                    compact
                      ? 'w-3 h-3 text-[6.5px] md:w-4 md:h-4 md:text-[8px]'
                      : 'w-3.5 h-3.5 text-[7px] md:w-5 md:h-5 md:text-[9px]'
                  } ${active && !done ? 'ring-2 ring-amber-300' : ''}`}
                  title={`${z.npcName} — Klik untuk menghampiri`}
                >
                  {done ? '✓' : idx + 1}
                </button>
              );
            })}

            {/* Partner Avatar Dot (2P Split Mode) */}
            {partnerLivePos && (
              <div
                style={{
                  left: `${Math.min(92, Math.max(8, 50 + (partnerLivePos.x / 22) * 42))}%`,
                  top: `${Math.min(92, Math.max(8, 50 + (partnerLivePos.z / 22) * 42))}%`,
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 pointer-events-none ${partnerDotBg} ${
                  compact ? 'w-2 h-2 md:w-2.5 md:h-2.5' : 'w-2.5 h-2.5 md:w-3 md:h-3'
                }`}
                title={`Posisi ${partnerLabel}`}
              />
            )}

            {/* Player Avatar Dot */}
            <div
              style={{
                left: `${Math.min(92, Math.max(8, 50 + (dotX / 22) * 42))}%`,
                top: `${Math.min(92, Math.max(8, 50 + (dotZ / 22) * 42))}%`,
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-sm bg-white ring-2 ${dotRing} pointer-events-none ${
                compact ? 'w-2 h-2 md:w-3 md:h-3' : 'w-2.5 h-2.5 md:w-3.5 md:h-3.5'
              }`}
              title="Posisi Avatarmu"
            />
          </div>
          <p className={`hidden md:block text-slate-300 leading-tight ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
            {compact ? (
              <>
                Gerak <strong>Joystik/{isP2 ? 'Panah' : 'WASD'}</strong> atau klik penjaga (<strong>[E]</strong>).
              </>
            ) : (
              <>
                Gunakan <strong>Joystik / WASD</strong> atau klik titik penjaga di radar untuk mendekat (<strong>[E]</strong>).
              </>
            )}
          </p>
        </div>
      )}

      {currentLevel === 6 && (
        <div>
          <div
            className={`relative w-full bg-slate-900 rounded-lg md:rounded-xl border border-slate-800 overflow-hidden md:mb-1.5 ${
              compact ? 'h-14 md:h-24' : 'h-[70px] md:h-32'
            }`}
          >
            {/* Radar sweep grid + center sanctuary node */}
            <div className="absolute inset-1.5 md:inset-2 rounded-full border border-emerald-500/20" />
            <div className="absolute inset-4 md:inset-6 rounded-full border border-emerald-500/20" />
            <div
              className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border ${
                completedIslands.length >= LEVEL_6_ISLANDS.length
                  ? 'w-2.5 h-2.5 md:w-3.5 md:h-3.5 bg-emerald-400 border-amber-200 shadow-[0_0_10px_#34d399]'
                  : 'w-1.5 h-1.5 md:w-2 md:h-2 bg-cyan-400/50 border-cyan-200/60'
              }`}
              title="Pusat Cahaya Nusantara (0, 0)"
            />
            {LEVEL_6_ISLANDS.map((isl, idx) => {
              const pos = LEVEL_6_TOWER_POSITIONS[idx] ?? isl.coords;
              const leftPct = Math.min(90, Math.max(10, 50 + (pos[0] / 22) * 42));
              const topPct = Math.min(90, Math.max(10, 50 + (pos[1] / 22) * 42));
              const done = completedIslands.includes(idx);
              const active = activeIslandIdx === idx;
              return (
                <button
                  key={isl.id}
                  type="button"
                  onClick={() => onSelectIsland?.(idx)}
                  style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center font-extrabold font-mono-num border md:border-2 cursor-pointer hover:scale-125 transition-transform ${
                    compact
                      ? 'w-3 h-3 text-[6.5px] md:w-4 md:h-4 md:text-[8px]'
                      : 'w-3.5 h-3.5 text-[7px] md:w-5 md:h-5 md:text-[9px]'
                  } ${
                    done
                      ? 'bg-emerald-500 text-slate-950 border-white shadow-[0_0_8px_#10b981]'
                      : active
                      ? 'bg-amber-400 text-slate-950 border-white scale-115 ring-2 ring-rose-400'
                      : 'bg-rose-600 text-white border-rose-200'
                  }`}
                  title={`Menara #${idx + 1}: ${isl.islandName} (${isl.shortRegion}) — Klik untuk menghampiri`}
                >
                  {done ? '✓' : idx + 1}
                </button>
              );
            })}
            {/* Partner Avatar Dot (2P Split Mode) */}
            {partnerLivePos && (
              <div
                style={{
                  left: `${Math.min(92, Math.max(8, 50 + (partnerLivePos.x / 22) * 42))}%`,
                  top: `${Math.min(92, Math.max(8, 50 + (partnerLivePos.z / 22) * 42))}%`,
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 pointer-events-none ${partnerDotBg} ${
                  compact ? 'w-2 h-2 md:w-2.5 md:h-2.5' : 'w-2.5 h-2.5 md:w-3 md:h-3'
                }`}
                title={`Posisi ${partnerLabel}`}
              />
            )}
            {/* Player Avatar Dot (1P & 2P) */}
            <div
              style={{
                left: `${Math.min(92, Math.max(8, 50 + (dotX / 22) * 42))}%`,
                top: `${Math.min(92, Math.max(8, 50 + (dotZ / 22) * 42))}%`,
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-sm bg-white ring-2 ${dotRing} pointer-events-none ${
                compact ? 'w-2 h-2 md:w-3 md:h-3' : 'w-2.5 h-2.5 md:w-3.5 md:h-3.5'
              }`}
              title="Posisi Avatarmu"
            />
          </div>
          {activeIslandIdx !== undefined && LEVEL_6_ISLANDS[activeIslandIdx] && (
            <div className={`hidden md:block text-amber-300 font-bold truncate mb-0.5 ${compact ? 'text-[8px]' : 'text-[9px]'}`}>
              📡 Menara {LEVEL_6_ISLANDS[activeIslandIdx].islandName}: {LEVEL_6_ISLANDS[activeIslandIdx].shortRegion}
            </div>
          )}
          <div className={`hidden md:flex text-slate-300 justify-between items-center ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
            <span>🔴 Bahaya</span>
            <span>[E] / Klik</span>
            <span>🟢 ({completedIslands.length}/5)</span>
          </div>
          <div className="md:hidden text-[7.5px] font-mono-num font-bold text-emerald-300 text-center mt-0.5">
            🟢 {completedIslands.length}/5 Menara
          </div>
        </div>
      )}
    </aside>
  );
};
