import React from 'react';
import { TrashItemSpec } from '../game/blueprintData';

interface RealisticTrashVisualProps {
  shapeType: TrashItemSpec['shapeType'];
  className?: string;
}

/**
 * Renders a detailed, realistic multi-layered SVG object for each of the 15 Level 1 trash items.
 */
export const RealisticTrashVisual: React.FC<RealisticTrashVisualProps> = ({
  shapeType,
  className = 'w-24 h-24',
}) => {
  switch (shapeType) {
    case 'bottle':
      // Botol Plastik Air Mineral (PET)
      return (
        <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
          <defs>
            <linearGradient id="petBody" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.85" />
              <stop offset="35%" stopColor="#e0f2fe" stopOpacity="0.95" />
              <stop offset="70%" stopColor="#7dd3fc" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id="waterFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#0369a1" stopOpacity="0.75" />
            </linearGradient>
          </defs>
          <ellipse cx="60" cy="108" rx="26" ry="5" fill="#0f172a" opacity="0.45" />
          {/* Bottle Cap */}
          <rect x="49" y="10" width="22" height="10" rx="3" fill="#0284c7" stroke="#0369a1" strokeWidth="1.5" />
          <line x1="53" y1="10" x2="53" y2="20" stroke="#7dd3fc" strokeWidth="1" />
          <line x1="58" y1="10" x2="58" y2="20" stroke="#7dd3fc" strokeWidth="1" />
          <line x1="63" y1="10" x2="63" y2="20" stroke="#7dd3fc" strokeWidth="1" />
          {/* Neck */}
          <path d="M51 20 L69 20 L76 34 L44 34 Z" fill="url(#petBody)" stroke="#38bdf8" strokeWidth="1.5" />
          {/* Main Cylinder Body */}
          <rect x="38" y="34" width="44" height="70" rx="9" fill="url(#petBody)" stroke="#38bdf8" strokeWidth="1.8" />
          {/* Residual Water at Bottom */}
          <path d="M39 78 Q60 82 81 78 L81 96 C81 101 77 103 73 103 L47 103 C43 103 39 101 39 96 Z" fill="url(#waterFill)" />
          {/* Bottle Label */}
          <rect x="38" y="50" width="44" height="22" fill="#0284c7" stroke="#e0f2fe" strokeWidth="1" />
          <text x="60" y="64" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="900" fontFamily="sans-serif">
            AIR MINERAL
          </text>
          {/* Molded Ribs & Specular Highlight */}
          <line x1="40" y1="42" x2="80" y2="42" stroke="#bae6fd" strokeWidth="1.2" opacity="0.7" />
          <line x1="40" y1="84" x2="80" y2="84" stroke="#bae6fd" strokeWidth="1.2" opacity="0.7" />
          <rect x="44" y="36" width="5" height="62" rx="2.5" fill="#ffffff" opacity="0.55" />
        </svg>
      );

    case 'bag':
      // Kantong Kresek Plastik
      return (
        <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
          <defs>
            <linearGradient id="bagGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#93c5fd" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
          </defs>
          <ellipse cx="60" cy="106" rx="32" ry="6" fill="#0f172a" opacity="0.45" />
          {/* Left & Right Handles */}
          <path
            d="M34 44 C30 22, 44 16, 48 38 L52 44 L68 44 L72 38 C76 16, 90 22, 86 44 L92 94 C93 101, 86 104, 78 103 L42 103 C34 104, 27 101, 28 94 Z"
            fill="url(#bagGrad)"
            stroke="#bfdbfe"
            strokeWidth="2"
          />
          {/* Inner Handle Cutouts */}
          <path d="M38 42 C36 28, 43 26, 45 42 Z" fill="#0f172a" />
          <path d="M75 42 C77 26, 84 28, 82 42 Z" fill="#0f172a" />
          {/* Crinkle Fold Lines */}
          <path d="M40 56 L55 72 L46 92" fill="none" stroke="#dbeafe" strokeWidth="2" opacity="0.65" strokeLinecap="round" />
          <path d="M78 54 L64 76 L76 94" fill="none" stroke="#dbeafe" strokeWidth="2" opacity="0.65" strokeLinecap="round" />
          <text x="60" y="72" textAnchor="middle" fill="#eff6ff" fontSize="8" fontWeight="900">
            PLASTIK
          </text>
        </svg>
      );

    case 'banana':
      // Kulit Pisang Sisa Makanan
      return (
        <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
          <defs>
            <linearGradient id="bananaGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="60%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#ca8a04" />
            </linearGradient>
          </defs>
          <ellipse cx="60" cy="105" rx="34" ry="6" fill="#0f172a" opacity="0.45" />
          {/* Stem */}
          <path d="M55 18 L66 18 L63 32 L57 32 Z" fill="#713f12" />
          {/* Left Peel */}
          <path d="M58 30 C36 42, 20 72, 24 96 C36 96, 48 76, 58 54 Z" fill="url(#bananaGrad)" stroke="#a16207" strokeWidth="2" />
          {/* Right Peel */}
          <path d="M62 30 C84 42, 100 72, 96 96 C84 96, 72 76, 62 54 Z" fill="url(#bananaGrad)" stroke="#a16207" strokeWidth="2" />
          {/* Center Front Peel */}
          <path d="M56 30 C52 58, 48 86, 60 102 C72 86, 68 58, 64 30 Z" fill="#fde047" stroke="#a16207" strokeWidth="2" />
          {/* Organic Brown Spots */}
          <circle cx="38" cy="68" r="3" fill="#713f12" opacity="0.75" />
          <circle cx="60" cy="76" r="3.5" fill="#713f12" opacity="0.75" />
          <circle cx="82" cy="66" r="2.8" fill="#713f12" opacity="0.75" />
          <circle cx="58" cy="54" r="2.2" fill="#713f12" opacity="0.7" />
        </svg>
      );

    case 'battery':
      // Baterai Jam Dinding Bekas (B3)
      return (
        <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
          <defs>
            <linearGradient id="batRed" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#991b1b" />
              <stop offset="35%" stopColor="#ef4444" />
              <stop offset="70%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#7f1d1d" />
            </linearGradient>
          </defs>
          <ellipse cx="60" cy="107" rx="26" ry="5" fill="#0f172a" opacity="0.45" />
          {/* Positive Terminal Nub */}
          <rect x="52" y="14" width="16" height="8" rx="2" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
          {/* Top Metallic Cap */}
          <rect x="38" y="21" width="44" height="12" rx="3" fill="#e2e8f0" stroke="#64748b" strokeWidth="1.5" />
          {/* Dark Top Band */}
          <rect x="38" y="30" width="44" height="20" fill="#1e293b" />
          <text x="60" y="44" textAnchor="middle" fill="#facc15" fontSize="14" fontWeight="900">
            +
          </text>
          {/* Red Hazard Body */}
          <rect x="38" y="50" width="44" height="44" fill="url(#batRed)" />
          <text x="60" y="71" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="900">
            BATERAI B3
          </text>
          <text x="60" y="84" textAnchor="middle" fill="#fde047" fontSize="12" fontWeight="900">
            −
          </text>
          {/* Bottom Metallic Base */}
          <rect x="38" y="94" width="44" height="8" rx="2" fill="#94a3b8" stroke="#475569" strokeWidth="1.5" />
          {/* Specular Strip */}
          <rect x="43" y="23" width="5" height="76" fill="#ffffff" opacity="0.35" />
        </svg>
      );

    case 'branch':
      // Ranting Pohon Patah (Organik)
      return (
        <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
          <ellipse cx="60" cy="104" rx="36" ry="5" fill="#0f172a" opacity="0.4" />
          <path
            d="M20 88 L52 58 L40 30 L48 26 L62 50 L96 24 L102 32 L68 60 L92 76 L88 84 L60 67 L28 96 Z"
            fill="#854d0e"
            stroke="#451a03"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Small Green Sprouts */}
          <path d="M40 30 C30 24, 28 14, 38 18 C44 20, 44 26, 40 30 Z" fill="#22c55e" stroke="#14532d" strokeWidth="1.5" />
          <path d="M96 24 C104 16, 112 20, 104 28 Z" fill="#16a34a" stroke="#14532d" strokeWidth="1.5" />
          {/* Wood Bark Lines */}
          <line x1="34" y1="80" x2="54" y2="62" stroke="#ca8a04" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="65" y1="54" x2="86" y2="38" stroke="#ca8a04" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    case 'leaf':
      // Daun Kering Berserakan (Organik)
      return (
        <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
          <defs>
            <linearGradient id="dryLeaf" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="55%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#78350f" />
            </linearGradient>
          </defs>
          <ellipse cx="60" cy="105" rx="30" ry="5" fill="#0f172a" opacity="0.4" />
          <path
            d="M26 94 C22 52, 52 20, 94 22 C92 64, 64 94, 26 94 Z"
            fill="url(#dryLeaf)"
            stroke="#451a03"
            strokeWidth="2.2"
          />
          {/* Stem & Veins */}
          <path d="M18 102 L90 26" stroke="#451a03" strokeWidth="3" strokeLinecap="round" />
          <path d="M45 73 L40 48 M60 58 L54 34 M48 70 L72 66 M64 54 L84 50" stroke="#fef3c7" strokeWidth="1.8" opacity="0.7" strokeLinecap="round" />
        </svg>
      );

    case 'can':
      // Kaleng Minuman Soda (Anorganik)
      return (
        <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
          <defs>
            <linearGradient id="aluCan" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#94a3b8" />
              <stop offset="30%" stopColor="#f8fafc" />
              <stop offset="65%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>
          </defs>
          <ellipse cx="60" cy="106" rx="26" ry="5" fill="#0f172a" opacity="0.45" />
          <rect x="36" y="24" width="48" height="76" rx="8" fill="url(#aluCan)" stroke="#64748b" strokeWidth="2" />
          {/* Red Soda Stripe */}
          <path d="M36 42 L84 34 L84 78 L36 86 Z" fill="#e11d48" />
          <text x="60" y="63" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="900" fontStyle="italic">
            SODA
          </text>
          {/* Top Rim Ellipse */}
          <ellipse cx="60" cy="24" rx="22" ry="6" fill="#e2e8f0" stroke="#64748b" strokeWidth="2" />
          <ellipse cx="60" cy="24" rx="8" ry="2.5" fill="#64748b" />
          {/* Specular Reflection */}
          <rect x="42" y="28" width="6" height="68" fill="#ffffff" opacity="0.4" />
        </svg>
      );

    case 'spray':
      // Botol Semprot Obat Nyamuk (B3)
      return (
        <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
          <ellipse cx="60" cy="107" rx="25" ry="5" fill="#0f172a" opacity="0.45" />
          {/* Spray Nozzle */}
          <rect x="52" y="14" width="16" height="10" rx="2" fill="#f8fafc" stroke="#64748b" strokeWidth="1.5" />
          <circle cx="65" cy="19" r="2" fill="#ef4444" />
          {/* Metallic Dome */}
          <path d="M38 38 C38 24, 82 24, 82 38 Z" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.8" />
          {/* Aerosol Body */}
          <rect x="38" y="38" width="44" height="64" rx="4" fill="#1e293b" stroke="#ef4444" strokeWidth="2" />
          <rect x="38" y="50" width="44" height="28" fill="#dc2626" />
          <text x="60" y="63" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="900">
            AEROSOL B3
          </text>
          <text x="60" y="73" textAnchor="middle" fill="#fde047" fontSize="7" fontWeight="800">
            RACUN SERANGGA
          </text>
          <rect x="43" y="40" width="5" height="58" fill="#ffffff" opacity="0.25" />
        </svg>
      );

    case 'bulb':
      // Lampu Bohlam Rusak (B3)
      return (
        <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
          <defs>
            <radialGradient id="bulbGlass" cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="60%" stopColor="#e2e8f0" />
              <stop offset="100%" stopColor="#94a3b8" />
            </radialGradient>
          </defs>
          <ellipse cx="60" cy="108" rx="20" ry="4" fill="#0f172a" opacity="0.45" />
          {/* Screw Base */}
          <rect x="48" y="80" width="24" height="20" rx="4" fill="#94a3b8" stroke="#475569" strokeWidth="1.8" />
          <line x1="48" y1="86" x2="72" y2="86" stroke="#475569" strokeWidth="2" />
          <line x1="48" y1="92" x2="72" y2="92" stroke="#475569" strokeWidth="2" />
          <path d="M53 100 L67 100 L63 106 L57 106 Z" fill="#0f172a" />
          {/* Bulb Glass Globe */}
          <path
            d="M46 80 C44 68, 30 58, 30 42 C30 24, 43 14, 60 14 C77 14, 90 24, 90 42 C90 58, 76 68, 74 80 Z"
            fill="url(#bulbGlass)"
            stroke="#64748b"
            strokeWidth="2"
          />
          {/* Broken Filament & Crack Line */}
          <path d="M52 80 L52 52 L58 46 M68 80 L68 54 L63 48" fill="none" stroke="#f59e0b" strokeWidth="2" />
          <path d="M66 24 L56 38 L64 46 L52 60" fill="none" stroke="#ef4444" strokeWidth="1.8" />
        </svg>
      );

    case 'veggie':
      // Sisa Sayuran Kantin (Organik)
      return (
        <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
          <ellipse cx="60" cy="105" rx="30" ry="5" fill="#0f172a" opacity="0.4" />
          {/* Outer Green Leaf */}
          <path
            d="M36 90 C20 66, 22 30, 48 24 C60 22, 68 32, 74 24 C96 28, 98 66, 82 90 Z"
            fill="#16a34a"
            stroke="#14532d"
            strokeWidth="2"
          />
          {/* Inner Leaf */}
          <path
            d="M44 92 C36 68, 42 38, 60 34 C78 38, 84 68, 76 92 Z"
            fill="#22c55e"
            stroke="#15803d"
            strokeWidth="1.8"
          />
          {/* White Stalk Ribs */}
          <path d="M46 96 L60 44 L74 96 Z" fill="#dcfce7" />
          <line x1="60" y1="42" x2="60" y2="96" stroke="#86efac" strokeWidth="3" />
        </svg>
      );

    case 'glass':
      // Pecahan Botol Kaca (Anorganik)
      return (
        <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
          <ellipse cx="60" cy="106" rx="28" ry="5" fill="#0f172a" opacity="0.45" />
          <path
            d="M50 16 L70 16 L72 34 L82 48 L82 92 L68 80 L58 96 L46 82 L38 94 L38 48 L48 34 Z"
            fill="#14b8a6"
            fillOpacity="0.8"
            stroke="#99f6e4"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          {/* Jagged Shards Nearby */}
          <polygon points="24,96 34,84 36,98" fill="#2dd4bf" stroke="#ccfbf1" strokeWidth="1.5" />
          <polygon points="86,96 90,82 98,94" fill="#2dd4bf" stroke="#ccfbf1" strokeWidth="1.5" />
          <line x1="46" y1="42" x2="46" y2="78" stroke="#ffffff" strokeWidth="3" opacity="0.6" strokeLinecap="round" />
        </svg>
      );

    case 'bleach':
      // Botol Bekas Pemutih Baju (B3)
      return (
        <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
          <ellipse cx="60" cy="107" rx="28" ry="5" fill="#0f172a" opacity="0.45" />
          {/* Cap */}
          <rect x="46" y="14" width="18" height="10" rx="2" fill="#e11d48" />
          {/* Jug Body with Handle */}
          <path
            d="M42 24 L68 24 L86 44 L86 96 C86 101 82 103 76 103 L40 103 C34 103 30 101 30 96 L30 42 Z"
            fill="#f8fafc"
            stroke="#cbd5e1"
            strokeWidth="2"
          />
          {/* Handle Cutout */}
          <path d="M68 38 L78 48 L78 64 L68 64 Z" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1.5" />
          {/* Warning Label */}
          <rect x="34" y="56" width="38" height="30" rx="3" fill="#e11d48" />
          <text x="53" y="70" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="900">
            PEMUTIH
          </text>
          <text x="53" y="81" textAnchor="middle" fill="#fde047" fontSize="7" fontWeight="900">
            KIMIA B3
          </text>
        </svg>
      );

    case 'corn':
      // Bonggol Jagung Rebus (Organik)
      return (
        <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
          <ellipse cx="60" cy="106" rx="24" ry="5" fill="#0f172a" opacity="0.4" />
          {/* Corn Cob Cylinder */}
          <rect x="44" y="20" width="32" height="76" rx="16" fill="#facc15" stroke="#a16207" strokeWidth="2" />
          {/* Kernel Grid Texture */}
          <line x1="54" y1="22" x2="54" y2="94" stroke="#ca8a04" strokeWidth="1.5" />
          <line x1="66" y1="22" x2="66" y2="94" stroke="#ca8a04" strokeWidth="1.5" />
          <line x1="45" y1="36" x2="75" y2="36" stroke="#ca8a04" strokeWidth="1.5" />
          <line x1="44" y1="52" x2="76" y2="52" stroke="#ca8a04" strokeWidth="1.5" />
          <line x1="44" y1="68" x2="76" y2="68" stroke="#ca8a04" strokeWidth="1.5" />
          <line x1="45" y1="82" x2="75" y2="82" stroke="#ca8a04" strokeWidth="1.5" />
          {/* Green Husk Leaves at Base */}
          <path d="M44 74 C28 68, 24 90, 52 100 Z" fill="#16a34a" stroke="#14532d" strokeWidth="1.5" />
          <path d="M76 74 C92 68, 96 90, 68 100 Z" fill="#22c55e" stroke="#14532d" strokeWidth="1.5" />
        </svg>
      );

    case 'straw':
      // Sedotan Plastik Bekas (Anorganik)
      return (
        <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
          <ellipse cx="60" cy="106" rx="26" ry="4" fill="#0f172a" opacity="0.4" />
          {/* Bendy Plastic Straw #1 */}
          <path
            d="M44 100 L54 44 L88 26"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M44 100 L54 44 L88 26"
            fill="none"
            stroke="#f8fafc"
            strokeWidth="3"
            strokeDasharray="6 6"
            strokeLinecap="round"
          />
          {/* Second Pink Straw */}
          <path
            d="M68 102 L62 52 L32 34"
            fill="none"
            stroke="#f43f5e"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'thermometer':
    default:
      // Termometer Air Raksa Retak (B3)
      return (
        <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
          <ellipse cx="60" cy="106" rx="22" ry="4" fill="#0f172a" opacity="0.4" />
          {/* Glass Tube */}
          <rect
            x="52"
            y="14"
            width="16"
            height="72"
            rx="8"
            fill="#e2e8f0"
            stroke="#64748b"
            strokeWidth="2"
          />
          {/* Mercury Bulb */}
          <circle cx="60" cy="90" r="14" fill="#dc2626" stroke="#991b1b" strokeWidth="2" />
          {/* Mercury Column */}
          <rect x="57" y="36" width="6" height="50" fill="#dc2626" />
          {/* Scale Marks */}
          <line x1="62" y1="26" x2="67" y2="26" stroke="#1e293b" strokeWidth="1.5" />
          <line x1="62" y1="36" x2="67" y2="36" stroke="#1e293b" strokeWidth="1.5" />
          <line x1="62" y1="46" x2="67" y2="46" stroke="#1e293b" strokeWidth="1.5" />
          <line x1="62" y1="56" x2="67" y2="56" stroke="#1e293b" strokeWidth="1.5" />
          <line x1="62" y1="66" x2="67" y2="66" stroke="#1e293b" strokeWidth="1.5" />
          {/* Spilled Mercury Droplets */}
          <circle cx="80" cy="98" r="4" fill="#94a3b8" stroke="#475569" strokeWidth="1" />
          <circle cx="88" cy="95" r="2.5" fill="#cbd5e1" />
        </svg>
      );
  }
};

interface RealisticBinVisualProps {
  binType: 'ORGANIK' | 'ANORGANIK' | 'B3';
  isActiveDrop?: boolean;
}

/**
 * Renders a realistic wheeled school sorting bin with a hinged lid and bold front nameplate:
 * ORGANIK (Green), ANORGANIK (Blue), B3 (Red).
 */
export const RealisticBinVisual: React.FC<RealisticBinVisualProps> = ({
  binType,
  isActiveDrop = false,
}) => {
  const palette =
    binType === 'ORGANIK'
      ? {
          bodyTop: '#22c55e',
          bodyBottom: '#15803d',
          lid: '#4ade80',
          rim: '#166534',
          badgeBg: '#052e16',
          badgeBorder: '#86efac',
          icon: '🍂',
          sub: 'Alami / Kompos',
        }
      : binType === 'ANORGANIK'
      ? {
          bodyTop: '#0ea5e9',
          bodyBottom: '#0369a1',
          lid: '#38bdf8',
          rim: '#075985',
          badgeBg: '#082f49',
          badgeBorder: '#7dd3fc',
          icon: '♻️',
          sub: 'Plastik / Kaleng',
        }
      : {
          bodyTop: '#f43f5e',
          bodyBottom: '#be123c',
          lid: '#fb7185',
          rim: '#881337',
          badgeBg: '#4c0519',
          badgeBorder: '#fda4af',
          icon: '☣️',
          sub: 'Racun / Kimia',
        };

  return (
    <div className="flex flex-col items-center select-none pointer-events-none">
      <svg viewBox="0 0 130 135" className="w-20 h-22 sm:w-24 sm:h-24 overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id={`binGrad-${binType}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={palette.bodyTop} />
            <stop offset="100%" stopColor={palette.bodyBottom} />
          </linearGradient>
        </defs>
        {/* Ground Shadow */}
        <ellipse cx="65" cy="126" rx="44" ry="6" fill="#020617" opacity="0.55" />

        {/* Hinged Lid (Tilts open when dragging over) */}
        <g
          style={{
            transform: isActiveDrop ? 'rotate(-22deg) translate(-8px, -10px)' : 'rotate(0deg)',
            transformOrigin: '24px 26px',
            transition: 'transform 180ms ease-out',
          }}
        >
          <path d="M18 24 L112 24 L104 12 L26 12 Z" fill={palette.lid} stroke={palette.rim} strokeWidth="2.5" />
          <rect x="50" y="6" width="30" height="6" rx="3" fill={palette.rim} />
        </g>

        {/* Dark Open Mouth Interior */}
        <ellipse cx="65" cy="27" rx="44" ry="6" fill="#090d16" />

        {/* Tapered Bin Body */}
        <path
          d="M20 26 L110 26 L98 118 C97 123 93 125 88 125 L42 125 C37 125 33 123 32 118 Z"
          fill={`url(#binGrad-${binType})`}
          stroke="#ffffff"
          strokeOpacity="0.35"
          strokeWidth="2"
        />

        {/* Upper Collar Rim */}
        <rect x="16" y="23" width="98" height="8" rx="4" fill={palette.lid} stroke={palette.rim} strokeWidth="2" />

        {/* Vertical Structural Ribs */}
        <line x1="36" y1="34" x2="42" y2="116" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="3" strokeLinecap="round" />
        <line x1="94" y1="34" x2="88" y2="116" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="3" strokeLinecap="round" />

        {/* Center Emblem Circle */}
        <circle cx="65" cy="54" r="14" fill={palette.badgeBg} stroke={palette.badgeBorder} strokeWidth="2" />
        <text x="65" y="59" textAnchor="middle" fontSize="15">
          {palette.icon}
        </text>

        {/* Bold Physical Front Nameplate: ORGANIK / ANORGANIK / B3 */}
        <rect
          x="23"
          y="74"
          width="84"
          height="24"
          rx="6"
          fill={palette.badgeBg}
          stroke={palette.badgeBorder}
          strokeWidth="2"
        />
        <text
          x="65"
          y="90"
          textAnchor="middle"
          fill="#ffffff"
          fontSize={binType === 'ANORGANIK' ? '11.5' : '13'}
          fontWeight="900"
          letterSpacing="0.5"
        >
          {binType}
        </text>

        {/* Subtitle on Bin Bottom */}
        <text x="65" y="112" textAnchor="middle" fill="#f8fafc" fontSize="8.5" fontWeight="700">
          {palette.sub}
        </text>
      </svg>
    </div>
  );
};
