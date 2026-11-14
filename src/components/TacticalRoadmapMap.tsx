import React, { useState, useEffect } from 'react';
import { LEVEL_METADATA } from '../game/blueprintData';
import { audioEngine } from '../game/audioEngine';

export interface TacticalRoadmapMapProps {
  playerName: string;
  avatarGender: 'male' | 'female';
  currentLevel: number; // 1..6
  completedLevels: number[];
  onSelectLevel: (level: number) => void;
}

interface MapNodeCoord {
  level: number;
  x: number; // percentage 0..100 on 1000x520 SVG viewBox
  y: number; // percentage 0..100
  sectorCode: string;
  terrainLabel: string;
  fortressName: string;
  accentHex: string;
}

const TERRITORY_NODES: MapNodeCoord[] = [
  {
    level: 1,
    x: 12,
    y: 73,
    sectorCode: 'SEKTOR A-01',
    terrainLabel: 'Zona Pemukiman',
    fortressName: 'Pos Halaman Rumah',
    accentHex: '#10b981',
  },
  {
    level: 2,
    x: 27,
    y: 28,
    sectorCode: 'SEKTOR B-02',
    terrainLabel: 'Zona Taman Baca',
    fortressName: 'Benteng Literasi 3R',
    accentHex: '#f59e0b',
  },
  {
    level: 3,
    x: 45,
    y: 72,
    sectorCode: 'SEKTOR C-03',
    terrainLabel: 'Zona Industri Hijau',
    fortressName: 'Markas Mesin Capit',
    accentHex: '#0ea5e9',
  },
  {
    level: 4,
    x: 61,
    y: 26,
    sectorCode: 'SEKTOR D-04',
    terrainLabel: 'Zona Kampung Warga',
    fortressName: 'Alun-Alun 5 Warga',
    accentHex: '#a855f7',
  },
  {
    level: 5,
    x: 76,
    y: 70,
    sectorCode: 'SEKTOR E-05',
    terrainLabel: 'Zona Hutan & DAS',
    fortressName: 'Posko Balai Hutan',
    accentHex: '#22c55e',
  },
  {
    level: 6,
    x: 90,
    y: 30,
    sectorCode: 'SEKTOR F-06',
    terrainLabel: 'Pusat Komando Utama',
    fortressName: 'Citadel Nusantara',
    accentHex: '#eab308',
  },
];

/**
 * Interpolates position along the 6-node polyline (progress 0..5 where 0 = Level 1, 5 = Level 6)
 */
function getPointAlongRoute(progress: number): {
  x: number;
  y: number;
  currentSegmentLevel: number;
  facingRight: boolean;
} {
  const clamped = Math.max(0, Math.min(TERRITORY_NODES.length - 1, progress));
  const idx = Math.min(TERRITORY_NODES.length - 2, Math.floor(clamped));
  const t = clamped - idx;
  const start = TERRITORY_NODES[idx];
  const end = TERRITORY_NODES[idx + 1];

  // Smooth cubic ease-in-out per segment
  const smoothT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const x = start.x + (end.x - start.x) * smoothT;
  const y = start.y + (end.y - start.y) * smoothT;

  return {
    x,
    y,
    currentSegmentLevel: Math.round(clamped) + 1,
    facingRight: end.x >= start.x,
  };
}

export const TacticalRoadmapMap: React.FC<TacticalRoadmapMapProps> = ({
  playerName,
  currentLevel,
  completedLevels,
  onSelectLevel,
}) => {
  const [selectedLevel, setSelectedLevel] = useState<number>(currentLevel);
  // Route progress: 0 = Level 1, 1 = Level 2, 2 = Level 3, 3 = Level 4, 4 = Level 5, 5 = Level 6
  const [routeProgress, setRouteProgress] = useState<number>(0);
  const [walkStep, setWalkStep] = useState<number>(0);
  const [patrolMode, setPatrolMode] = useState<'full_tour' | 'to_target'>('full_tour');

  // Ensure no narration speech plays while the tactical territory map is displayed
  useEffect(() => {
    audioEngine.stopSpeech();
  }, []);

  useEffect(() => {
    setSelectedLevel(currentLevel);
  }, [currentLevel]);

  // Animate Blocky character marching across the 6 locations: Level 1 -> 2 -> 3 -> 4 -> 5 -> 6
  useEffect(() => {
    const interval = window.setInterval(() => {
      setWalkStep((s) => (s + 1) % 4);
      setRouteProgress((prev) => {
        if (patrolMode === 'to_target') {
          const targetIdx = Math.max(0, Math.min(5, selectedLevel - 1));
          const diff = targetIdx - prev;
          if (Math.abs(diff) <= 0.08) {
            return targetIdx;
          }
          return prev + Math.sign(diff) * 0.14;
        }
        // Full campaign tour: marches continuously from Level 1 (0) -> 2 (1) -> 3 (2) -> 4 (3) -> 5 (4) -> 6 (5)
        const next = prev + 0.12;
        return next > 5.15 ? 0 : next;
      });
    }, 140);

    return () => window.clearInterval(interval);
  }, [patrolMode, selectedLevel]);

  const charPos = getPointAlongRoute(routeProgress);
  const activeMeta = LEVEL_METADATA[selectedLevel - 1] || LEVEL_METADATA[0];
  const activeNode = TERRITORY_NODES[selectedLevel - 1] || TERRITORY_NODES[0];

  return (
    <div
      data-testid="roadmap-6-levels"
      className="relative z-30 flex-1 flex flex-col items-center justify-center p-2 md:p-4 pointer-events-auto select-none"
    >
      <div className="w-full max-w-6xl bg-slate-950/95 border-2 border-amber-500/90 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* TOP TACTICAL WAR-ROOM COMMAND BAR */}
        <div className="bg-slate-900/95 border-b border-amber-500/40 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-lg shadow-inner">
              🗺️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono-num font-extrabold uppercase tracking-widest px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40">
                  PETA WILAYAH OPERASI DARI ATAS · 6 LOKASI
                </span>
                <span className="text-[10px] font-mono-num text-emerald-400 font-bold hidden sm:inline">
                  KOORDINAT: 07°49&apos;LS 111°04&apos;BT · NUSANTARA
                </span>
              </div>
              <h2 className="text-base md:text-lg font-extrabold text-white leading-tight mt-0.5">
                Peta Strategis 6 Wilayah Penjaga Bumi Nusantara
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="btn-toggle-map-patrol"
              onClick={() => {
                audioEngine.playClickWood();
                if (patrolMode === 'full_tour') {
                  setPatrolMode('to_target');
                } else {
                  setRouteProgress(0);
                  setPatrolMode('full_tour');
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-amber-400/50 text-[11px] font-extrabold text-amber-300 cursor-pointer"
            >
              {patrolMode === 'full_tour'
                ? `🚶 Animasi Rute: Pos 1 ➔ 6 (Di Pos ${charPos.currentSegmentLevel})`
                : `🎯 Fokus Pos Level ${selectedLevel} (Klik untuk Tur 1➔6)`}
            </button>
          </div>
        </div>

        {/* CENTER: REAL TOP-DOWN TERRITORY / WAR-MAP CANVAS (6 LOKASI) */}
        <div
          data-testid="tactical-territory-map-canvas"
          className="relative w-full aspect-[16/8.2] min-h-[340px] max-h-[58vh] bg-[#07191e] overflow-hidden"
        >
          {/* SVG Topographic & Tactical Territory Map from Above */}
          <svg
            viewBox="0 0 1000 520"
            preserveAspectRatio="none"
            className="w-full h-full block"
          >
            <defs>
              {/* Tactical Grid Pattern */}
              <pattern id="tacticalGrid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path
                  d="M 50 0 L 0 0 0 50"
                  fill="none"
                  stroke="rgba(16, 185, 129, 0.11)"
                  strokeWidth="1"
                />
              </pattern>
              {/* Terrain Landmass Gradient */}
              <linearGradient id="landmassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#123524" />
                <stop offset="35%" stopColor="#1b4332" />
                <stop offset="70%" stopColor="#2d4a28" />
                <stop offset="100%" stopColor="#1e3a2f" />
              </linearGradient>
              {/* Territory Zone Glow */}
              <radialGradient id="activeZoneGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(251, 191, 36, 0.45)" />
                <stop offset="100%" stopColor="rgba(251, 191, 36, 0)" />
              </radialGradient>
            </defs>

            {/* 1. Deep Ocean Water Base */}
            <rect x="0" y="0" width="1000" height="520" fill="#061826" />

            {/* Shallow Coastal Water Contour */}
            <path
              d="M 35 120 Q 150 40 320 65 T 640 55 T 945 95 Q 985 250 950 430 Q 810 495 580 475 T 210 480 Q 55 460 35 320 Z"
              fill="#0a2e3f"
              stroke="#0ea5e9"
              strokeWidth="1.5"
              strokeOpacity="0.35"
              strokeDasharray="8 6"
            />

            {/* 2. Main Top-Down Archipelago Landmass */}
            <path
              d="M 55 140 Q 160 65 320 85 T 635 78 T 925 115 Q 960 250 925 410 Q 795 470 575 455 T 220 460 Q 75 440 55 310 Z"
              fill="url(#landmassGrad)"
              stroke="#ca8a04"
              strokeWidth="3"
            />

            {/* 3. Topographic Elevation Contour Lines & Territory Borders */}
            <path
              d="M 95 175 Q 210 110 355 130 T 640 120 T 885 155 Q 915 260 885 380 Q 760 430 560 420 T 240 420 Q 110 400 95 290 Z"
              fill="none"
              stroke="rgba(250, 204, 21, 0.16)"
              strokeWidth="1.5"
              strokeDasharray="6 6"
            />

            {/* Territory Division Borders (6 Sektor Wilayah Pertahanan) */}
            <g stroke="rgba(251, 191, 36, 0.28)" strokeWidth="1.8" strokeDasharray="7 5">
              <line x1="205" y1="75" x2="185" y2="465" />
              <line x1="365" y1="80" x2="355" y2="460" />
              <line x1="535" y1="75" x2="525" y2="458" />
              <line x1="690" y1="82" x2="685" y2="455" />
              <line x1="830" y1="95" x2="825" y2="440" />
            </g>

            {/* 4. Winding River & Watershed From Mountains to Sea */}
            <path
              d="M 290 85 Q 315 200 265 290 T 330 460"
              fill="none"
              stroke="#0284c7"
              strokeWidth="10"
              strokeLinecap="round"
              opacity="0.55"
            />
            <path
              d="M 710 80 Q 745 210 695 310 T 755 455"
              fill="none"
              stroke="#0284c7"
              strokeWidth="12"
              strokeLinecap="round"
              opacity="0.55"
            />

            {/* 5. Top-Down Mountain Ridges & Forest Clusters */}
            {/* Mountain range top-center */}
            <g fill="#3f3f46" stroke="#71717a" strokeWidth="1.5" opacity="0.75">
              <polygon points="440,120 465,85 490,120" />
              <polygon points="470,128 500,82 530,128" />
              <polygon points="730,140 760,92 790,140" />
              <polygon points="765,148 795,102 825,148" />
            </g>

            {/* Forest Canopy Top-Down Circles */}
            <g fill="#15803d" stroke="#22c55e" strokeWidth="1" opacity="0.7">
              <circle cx="140" cy="210" r="16" />
              <circle cx="162" cy="222" r="13" />
              <circle cx="235" cy="340" r="18" />
              <circle cx="575" cy="360" r="17" />
              <circle cx="600" cy="375" r="14" />
              <circle cx="735" cy="245" r="19" />
              <circle cx="760" cy="235" r="15" />
              <circle cx="805" cy="255" r="16" />
            </g>

            {/* Tactical Map Grid Overlay */}
            <rect x="0" y="0" width="1000" height="520" fill="url(#tacticalGrid)" />

            {/* 6. TACTICAL CAMPAIGN ROAD (JALUR OPERASI LEVEL 1 -> 2 -> 3 -> 4 -> 5 -> 6) */}
            {/* Outer Road Casing */}
            <polyline
              points={TERRITORY_NODES.map((n) => `${n.x * 10},${n.y * 5.2}`).join(' ')}
              fill="none"
              stroke="#1e293b"
              strokeWidth="16"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Inner Earth/Stone Path */}
            <polyline
              points={TERRITORY_NODES.map((n) => `${n.x * 10},${n.y * 5.2}`).join(' ')}
              fill="none"
              stroke="#78350f"
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Glowing Tactical Marching Line */}
            <polyline
              points={TERRITORY_NODES.map((n) => `${n.x * 10},${n.y * 5.2}`).join(' ')}
              fill="none"
              stroke="#fbbf24"
              strokeWidth="3.5"
              strokeDasharray="10 8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Directional Arrows along each segment 1->2, 2->3, 3->4, 4->5, 5->6 */}
            {TERRITORY_NODES.slice(0, -1).map((startNode, idx) => {
              const endNode = TERRITORY_NODES[idx + 1];
              const midX = ((startNode.x + endNode.x) / 2) * 10;
              const midY = ((startNode.y + endNode.y) / 2) * 5.2;
              const angleDeg =
                (Math.atan2((endNode.y - startNode.y) * 5.2, (endNode.x - startNode.x) * 10) *
                  180) /
                Math.PI;
              return (
                <g
                  key={`arrow-${idx}`}
                  transform={`translate(${midX}, ${midY}) rotate(${angleDeg})`}
                >
                  <circle r="11" fill="#0f172a" stroke="#fbbf24" strokeWidth="1.5" />
                  <polygon points="-4,-5 6,0 -4,5" fill="#fbbf24" />
                </g>
              );
            })}

            {/* 7. TOP-DOWN ARCHITECTURAL MINIATURES AT EACH OF THE 6 LOCATIONS */}
            {TERRITORY_NODES.map((n) => {
              const cx = n.x * 10;
              const cy = n.y * 5.2;
              const isSelected = selectedLevel === n.level;
              return (
                <g key={`fort-${n.level}`} transform={`translate(${cx}, ${cy})`}>
                  {isSelected && <circle r="56" fill="url(#activeZoneGlow)" />}
                  {/* Outer Tactical Perimeter Ring */}
                  <circle
                    r="38"
                    fill="rgba(15, 23, 42, 0.85)"
                    stroke={n.accentHex}
                    strokeWidth={isSelected ? '4' : '2.5'}
                    strokeDasharray={isSelected ? 'none' : '6 4'}
                  />
                  {/* Top-Down Roof / Fortress Iconography per Level */}
                  {n.level === 1 && (
                    // Level 1: Top-down Terracotta House Roof + 3 Bins
                    <g>
                      <rect x="-16" y="-14" width="32" height="24" rx="3" fill="#c2410c" stroke="#fed7aa" strokeWidth="1.5" />
                      <line x1="-16" y1="-2" x2="16" y2="-2" stroke="#7c2d12" strokeWidth="2" />
                      <circle cx="-10" cy="17" r="4" fill="#22c55e" />
                      <circle cx="0" cy="17" r="4" fill="#0ea5e9" />
                      <circle cx="10" cy="17" r="4" fill="#ef4444" />
                    </g>
                  )}
                  {n.level === 2 && (
                    // Level 2: Top-down Octagonal Reading Pavilion & 3R Totems
                    <g>
                      <rect x="-18" y="-12" width="36" height="24" rx="4" fill="#92400e" stroke="#fde68a" strokeWidth="1.5" />
                      <rect x="-10" y="-6" width="20" height="12" rx="2" fill="#f59e0b" />
                    </g>
                  )}
                  {n.level === 3 && (
                    // Level 3: Top-down Logistics Warehouse & Gantry Rail
                    <g>
                      <rect x="-20" y="-14" width="40" height="28" rx="3" fill="#1e3a8a" stroke="#7dd3fc" strokeWidth="1.5" />
                      <line x1="-18" y1="0" x2="18" y2="0" stroke="#fbbf24" strokeWidth="3" />
                      <circle cx="0" cy="0" r="5" fill="#fbbf24" />
                    </g>
                  )}
                  {n.level === 4 && (
                    // Level 4: Top-down Village Plaza & 5 Citizen Houses
                    <g>
                      <circle r="12" fill="#581c87" stroke="#e9d5ff" strokeWidth="1.5" />
                      <rect x="-20" y="-18" width="8" height="8" fill="#c084fc" />
                      <rect x="12" y="-18" width="8" height="8" fill="#c084fc" />
                      <rect x="-20" y="10" width="8" height="8" fill="#c084fc" />
                      <rect x="12" y="10" width="8" height="8" fill="#c084fc" />
                    </g>
                  )}
                  {n.level === 5 && (
                    // Level 5: Top-down Forest Canopy & Council Hall
                    <g>
                      <polygon points="0,-18 -18,12 18,12" fill="#14532d" stroke="#86efac" strokeWidth="1.5" />
                      <circle cx="0" cy="2" r="7" fill="#22c55e" />
                    </g>
                  )}
                  {n.level === 6 && (
                    // Level 6: Top-down Nusantara Command Citadel Star
                    <g>
                      <polygon
                        points="0,-20 6,-6 20,-6 9,3 13,18 0,10 -13,18 -9,3 -20,-6 -6,-6"
                        fill="#eab308"
                        stroke="#fef08a"
                        strokeWidth="1.5"
                      />
                    </g>
                  )}
                </g>
              );
            })}

            {/* 8. COMPASS ROSE (TOP RIGHT) & MAP SCALE (BOTTOM LEFT) */}
            <g transform="translate(945, 58)">
              <circle r="28" fill="rgba(15, 23, 42, 0.9)" stroke="#fbbf24" strokeWidth="2" />
              <polygon points="0,-22 5,-4 0,-8 -5,-4" fill="#ef4444" />
              <polygon points="0,22 5,4 0,8 -5,4" fill="#cbd5e1" />
              <text x="0" y="-10" textAnchor="middle" fill="#fef08a" fontSize="9" fontWeight="bold">
                U
              </text>
            </g>
          </svg>

          {/* HTML OVERLAY: 6 CLICKABLE TACTICAL LOCATION PINS */}
          {TERRITORY_NODES.map((node) => {
            const meta = LEVEL_METADATA[node.level - 1] || LEVEL_METADATA[0];
            const isDone = completedLevels.includes(node.level);
            const isCurrent = currentLevel === node.level;
            const isSelected = selectedLevel === node.level;

            return (
              <button
                key={node.level}
                type="button"
                data-testid={`roadmap-card-level-${node.level}`}
                onClick={() => {
                  audioEngine.playClickWood();
                  setSelectedLevel(node.level);
                  onSelectLevel(node.level);
                }}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer text-left transition-transform ${
                  isSelected ? 'z-20 scale-105' : 'z-10 hover:scale-105'
                }`}
              >
                {/* Top Territory Sector Tag */}
                <div
                  className={`-mt-14 px-2.5 py-1 rounded-xl border-2 shadow-xl whitespace-nowrap flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 border-white font-black'
                      : isDone
                      ? 'bg-emerald-950/95 text-emerald-200 border-emerald-400 font-bold'
                      : isCurrent
                      ? 'bg-emerald-900/95 text-amber-300 border-amber-400 font-extrabold'
                      : 'bg-slate-950/95 text-slate-200 border-slate-600 font-bold'
                  }`}
                >
                  <span className="text-[10px] font-mono-num px-1.5 py-0.2 rounded bg-slate-950 text-amber-300">
                    POS {node.level} · {meta.bloomCode}
                  </span>
                  <span className="text-xs font-extrabold">{meta.name}</span>
                  {isDone && <span className="text-xs">✓</span>}
                </div>

                {/* Center Pin Target */}
                <div className="w-11 h-11 mx-auto rounded-full flex items-center justify-center">
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black font-mono-num border-2 shadow-md ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950 border-white'
                        : isDone
                        ? 'bg-emerald-500 text-slate-950 border-white'
                        : 'bg-slate-900/90 text-amber-300 border-amber-400'
                    }`}
                  >
                    {node.level}
                  </span>
                </div>

                {/* Bottom Domain Subtitle */}
                <div className="mt-0.5 bg-slate-950/90 border border-slate-700/90 rounded-lg px-2 py-0.5 text-[10px] font-bold text-emerald-300 text-center whitespace-nowrap shadow">
                  📍 {meta.domain}
                </div>
              </button>
            );
          })}

          {/* ANIMATED BLOCKY CHARACTER MARCHING FROM LEVEL 1 -> 2 -> 3 -> 4 -> 5 -> 6 */}
          <div
            data-testid="roadmap-animated-character"
            style={{
              left: `${charPos.x}%`,
              top: `${charPos.y}%`,
              transition: 'left 135ms linear, top 135ms linear',
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none flex flex-col items-center"
          >
            {/* Floating Player Nameplate Above Blocky */}
            <div className="bg-emerald-950/95 border-2 border-amber-400 text-amber-200 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold whitespace-nowrap shadow-xl mb-0.5 flex items-center gap-1">
              <span>🛡️</span>
              <span>{playerName}</span>
              <span className="text-emerald-300 font-mono-num">
                (Pos {charPos.currentSegmentLevel})
              </span>
            </div>

            {/* 3D-Styled Blocky Character Marching Sprite */}
            <div
              className="relative flex flex-col items-center"
              style={{
                transform: `${charPos.facingRight ? 'scaleX(1)' : 'scaleX(-1)'} translateY(${
                  walkStep % 2 === 0 ? '-3px' : '1px'
                })`,
              }}
            >
              {/* Blocky Head */}
              <div className="w-6 h-6 bg-amber-200 border-2 border-slate-950 rounded-sm relative shadow-md">
                {/* Hair / Cap */}
                <div className="w-full h-2 bg-slate-900" />
                {/* Eyes */}
                <div className="flex justify-between px-1 mt-0.5">
                  <span className="w-1 h-1 bg-slate-950 rounded-full" />
                  <span className="w-1 h-1 bg-slate-950 rounded-full" />
                </div>
              </div>
              {/* Blocky Torso (Rompi Hijau Penjaga Bumi) */}
              <div className="w-7 h-5 bg-emerald-600 border-2 border-slate-950 rounded-sm flex items-center justify-center text-[8px] font-black text-amber-300 shadow-md">
                3R
              </div>
              {/* Blocky Marching Legs */}
              <div className="flex gap-1 -mt-0.5">
                <div
                  className="w-2.5 h-3 bg-amber-900 border border-slate-950"
                  style={{
                    transform: walkStep % 2 === 0 ? 'rotate(18deg)' : 'rotate(-18deg)',
                  }}
                />
                <div
                  className="w-2.5 h-3 bg-amber-900 border border-slate-950"
                  style={{
                    transform: walkStep % 2 === 0 ? 'rotate(-18deg)' : 'rotate(18deg)',
                  }}
                />
              </div>
            </div>

            {/* Tactical Radar Base Under Character */}
            <div className="w-9 h-3 rounded-full bg-amber-400/50 border border-amber-300 -mt-1 shadow-lg" />
          </div>
        </div>

        {/* BOTTOM COMMAND FOOTER (TANPA NARASI — FOKUS KOMANDO WILAYAH) */}
        <div className="bg-slate-900/95 border-t border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold text-amber-300 font-mono-num bg-slate-950 border border-amber-400/50 px-3 py-1 rounded-xl">
              {activeNode.sectorCode} · LEVEL {selectedLevel} ({activeMeta.bloomCode})
            </span>
            <span className="text-xs md:text-sm font-extrabold text-white">
              {activeMeta.name} — 📍 {activeMeta.domain}
            </span>
            <span className="text-xs text-slate-400 hidden md:inline">
              (Mentor: {activeMeta.npcName} · {activeMeta.maxPoints} Poin)
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              data-testid="btn-start-level-narration"
              onClick={() => {
                audioEngine.playClickWood();
                onSelectLevel(selectedLevel);
              }}
              className="btn-clay-emerald px-5 py-2.5 rounded-2xl text-xs md:text-sm font-extrabold text-white cursor-pointer shadow-lg"
            >
              ⚔️ Masuk Wilayah Level {selectedLevel}: {activeMeta.name} ➔
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
