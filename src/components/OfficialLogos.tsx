import React, { useState } from 'react';
import { GAME_IDENTITY } from '../game/blueprintData';

export const OfficialLogoBadge: React.FC<{
  type: 'pgri' | 'game' | 'wonogiri';
  size?: 'xs' | 'sm' | 'md' | 'lg';
}> = ({ type, size = 'md' }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const dim =
    size === 'xs'
      ? 'w-8 h-8 p-1'
      : size === 'sm'
      ? 'w-10 h-10 p-1.5'
      : size === 'lg'
      ? 'w-16 h-16 p-1.5'
      : 'w-12 h-12 p-1.5';

  const src =
    type === 'pgri'
      ? GAME_IDENTITY.logoPgri
      : type === 'game'
      ? GAME_IDENTITY.logoGame
      : GAME_IDENTITY.logoWonogiri;

  const alt =
    type === 'pgri'
      ? 'Logo Resmi PGRI'
      : type === 'game'
      ? 'Logo Game Penjaga Bumi Nusantara'
      : 'Logo Resmi Pemerintah Kabupaten Wonogiri';

  return (
    <div
      className={`${dim} relative flex items-center justify-center rounded-xl ${
        type === 'game'
          ? 'bg-slate-900/95 border border-emerald-400/70'
          : 'bg-white/95 border border-amber-400/50'
      } shadow-md shrink-0`}
      title={alt}
    >
      {!imgFailed ? (
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-contain"
        />
      ) : type === 'pgri' ? (
        <svg viewBox="0 0 64 64" className="w-full h-full" aria-label={alt}>
          <circle cx="32" cy="32" r="29" fill="#dc2626" stroke="#b45309" strokeWidth="3" />
          <circle cx="32" cy="32" r="21" fill="#ffffff" />
          <path d="M32 14 L38 30 L32 46 L26 30 Z" fill="#f59e0b" />
          <text x="32" y="57" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#ffffff">
            PGRI
          </text>
        </svg>
      ) : type === 'game' ? (
        <svg viewBox="0 0 64 64" className="w-full h-full" aria-label={alt}>
          <polygon
            points="32,4 58,16 52,46 32,60 12,46 6,16"
            fill="#059669"
            stroke="#fbbf24"
            strokeWidth="3"
          />
          <circle cx="32" cy="30" r="10" fill="#fde047" />
        </svg>
      ) : (
        <svg viewBox="0 0 64 64" className="w-full h-full" aria-label={alt}>
          <path
            d="M32 4 L56 14 L52 44 L32 60 L12 44 L8 14 Z"
            fill="#15803d"
            stroke="#f59e0b"
            strokeWidth="3"
          />
          <polygon points="32,14 44,36 20,36" fill="#facc15" />
          <text x="32" y="50" textAnchor="middle" fontSize="7.5" fontWeight="bold" fill="#ffffff">
            WONOGIRI
          </text>
        </svg>
      )}
    </div>
  );
};

/**
 * Custom Inline <svg> 3D Dewy Monstera Leaf for Tolerance / Lives (Section VII)
 */
export const MonsteraLeafIcon: React.FC<{
  active: boolean;
  shaking?: boolean;
}> = ({ active, shaking }) => {
  return (
    <svg
      viewBox="0 0 36 36"
      className={`w-7 h-7 transition-transform duration-300 ${
        active
          ? 'scale-100 drop-shadow-[0_2px_4px_rgba(16,185,129,0.5)]'
          : 'scale-90 opacity-45 rotate-12'
      } ${shaking ? 'animate-bounce' : ''}`}
      aria-label={active ? 'Daun Toleransi Aktif' : 'Daun Toleransi Gugur'}
    >
      {/* Outer silhouette */}
      <path
        d="M18 3 C8 5 4 15 7 25 C9 30 14 33 18 34 C22 33 27 30 29 25 C32 15 28 5 18 3 Z"
        fill={active ? '#064e3b' : '#451a03'}
      />
      {/* Main leaf body with Monstera fenestrations */}
      <path
        d="M18 5 C10 7 6 15 9 24 C12 22 15 22 16 24 C11 26 13 30 18 32 C23 30 25 26 20 24 C21 22 24 22 27 24 C30 15 26 7 18 5 Z"
        fill={active ? '#10b981' : '#78350f'}
      />
      {/* Central vein highlight */}
      <path
        d="M18 6 L18 31 M18 14 L12 11 M18 19 L11 17 M18 14 L24 11 M18 19 L25 17"
        stroke={active ? '#6ee7b7' : '#a16207'}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Dewdrop highlight */}
      {active && (
        <>
          <circle cx="13" cy="14" r="2.1" fill="#ecfdf5" />
          <circle cx="23" cy="20" r="1.5" fill="#d1fae5" />
        </>
      )}
    </svg>
  );
};

/**
 * Hero Game Logo Emblem for PENJAGA BUMI NUSANTARA (uses Official Game Logo https://i.imgur.com/9PLallN.png with SVG fallback)
 */
export const NusantaraCrestSvg: React.FC = () => {
  const [imgFailed, setImgFailed] = useState(false);

  if (!imgFailed) {
    return (
      <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 shrink-0 rounded-2xl bg-slate-900/95 border-2 border-amber-400/80 p-1.5 shadow-[0_0_24px_rgba(16,185,129,0.4)] flex items-center justify-center">
        <img
          src={GAME_IDENTITY.logoGame}
          alt="Logo Game Penjaga Bumi Nusantara"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-contain drop-shadow-[0_3px_8px_rgba(0,0,0,0.6)]"
        />
      </div>
    );
  }

  return (
    <svg viewBox="0 0 120 120" className="w-20 h-20 sm:w-24 sm:h-24 shrink-0" aria-hidden="true">
      <defs>
        <linearGradient id="crestGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id="crestEmerald" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#065f46" />
        </linearGradient>
      </defs>
      <polygon
        points="60,4 108,28 98,86 60,114 22,86 12,28"
        fill="url(#crestEmerald)"
        stroke="url(#crestGold)"
        strokeWidth="5"
      />
      <polygon points="60,26 88,72 32,72" fill="#047857" />
      <polygon points="44,38 68,72 22,72" fill="#10b981" />
      <path d="M24 76 Q60 66 96 76 Q60 92 24 76 Z" fill="#38bdf8" />
      <path
        d="M60 68 L60 40 C60 32 72 28 76 34 C72 42 64 44 60 44 C56 44 48 42 44 34 C48 28 60 32 60 40 Z"
        fill="#fde047"
      />
    </svg>
  );
};

/**
 * Golden Wax Seal Stamp for Halaman 4 Piagam Ikrar Autentik
 */
export const GoldenWaxSealSvg: React.FC = () => (
  <svg viewBox="0 0 120 120" className="w-24 h-24 select-none" aria-label="Segel Lilin Emas Resmi">
    <defs>
      <radialGradient id="waxGoldGrad" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="55%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#92400e" />
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#waxGoldGrad)" stroke="#78350f" strokeWidth="3" strokeDasharray="6 3" />
    <circle cx="60" cy="60" r="43" fill="none" stroke="#fef3c7" strokeWidth="2" />
    <polygon points="60,22 68,44 92,44 72,58 80,82 60,67 40,82 48,58 28,44 52,44" fill="#78350f" opacity="0.28" />
    <text x="60" y="54" textAnchor="middle" fontSize="10" fontWeight="800" fill="#451a03">
      PENJAGA BUMI
    </text>
    <text x="60" y="67" textAnchor="middle" fontSize="9" fontWeight="700" fill="#451a03">
      NUSANTARA
    </text>
    <text x="60" y="80" textAnchor="middle" fontSize="8" fontWeight="700" fill="#78350f">
      WONOGIRI 2026
    </text>
  </svg>
);
