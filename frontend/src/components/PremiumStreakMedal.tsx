import React, { useId } from 'react';
import { MilestoneTier } from '../utils/streakMilestones';
import { Lock } from 'lucide-react';

interface PremiumStreakMedalProps {
  days: number;
  tier?: MilestoneTier;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'custom';
  customSize?: number;
  isLocked?: boolean;
  animated?: boolean;
  className?: string;
  onClick?: () => void;
}

export const PremiumStreakMedal: React.FC<PremiumStreakMedalProps> = ({
  days,
  tier = 'gold',
  size = 'lg',
  customSize,
  isLocked = false,
  animated = false,
  className = '',
  onClick,
}) => {
  const uid = useId().replace(/:/g, '_');

  const dimension = customSize
    ? customSize
    : {
        sm: 44,
        md: 84,
        lg: 168,
        xl: 260,
        custom: 168,
      }[size];

  // Palette configurations matching each tier's unique metallic luster
  const palette = {
    bronze: {
      outerRim: ['#F9D423', '#D35400', '#6E2C00'],
      innerDisc: ['#7E2A0C', '#C0392B', '#E67E22'],
      bevel: ['#FAD7A0', '#BA4A00', '#5E2605'],
      flame: ['#FFF3B0', '#F39C12', '#E74C3C', '#922B21'],
      ribbon: ['#E67E22', '#D35400', '#641E16'],
      textFill: '#FFF6D6',
      textStroke: '#6E2C00',
      stars: '#FAD7A0',
      laurel: '#F39C12',
      glow: 'rgba(230, 126, 34, 0.45)',
    },
    gold: {
      outerRim: ['#FFF6B7', '#F6D365', '#9E7412'],
      innerDisc: ['#6B4E08', '#D4AF37', '#FFF3A8'],
      bevel: ['#FFECB3', '#D4AF37', '#734B00'],
      flame: ['#FFFFFF', '#FFE259', '#FFA751', '#C0392B'],
      ribbon: ['#FCE043', '#E6AC00', '#734B00'],
      textFill: '#FFFFEA',
      textStroke: '#634200',
      stars: '#FFF8DC',
      laurel: '#F1C40F',
      glow: 'rgba(255, 215, 0, 0.55)',
    },
    platinum: {
      outerRim: ['#FFFFFF', '#A8E6CF', '#0072FF'],
      innerDisc: ['#003554', '#00A896', '#E0F7FA'],
      bevel: ['#E0F7FA', '#00C9FF', '#003554'],
      flame: ['#FFFFFF', '#92FE9D', '#00C9FF', '#0052D4'],
      ribbon: ['#00C9FF', '#0083B0', '#003554'],
      textFill: '#FFFFFF',
      textStroke: '#002B49',
      stars: '#E0F7FA',
      laurel: '#00E5FF',
      glow: 'rgba(0, 229, 255, 0.5)',
    },
    diamond: {
      outerRim: ['#FFFFFF', '#D1C4E9', '#4A148C'],
      innerDisc: ['#280659', '#7C4DFF', '#EDE7F6'],
      bevel: ['#EDE7F6', '#9575CD', '#311B92'],
      flame: ['#FFFFFF', '#E040FB', '#7C4DFF', '#311B92'],
      ribbon: ['#B388FF', '#7C4DFF', '#311B92'],
      textFill: '#FFFFFF',
      textStroke: '#21094E',
      stars: '#EDE7F6',
      laurel: '#B388FF',
      glow: 'rgba(179, 136, 255, 0.55)',
    },
    ruby: {
      outerRim: ['#FFCDD2', '#FF1744', '#51000B'],
      innerDisc: ['#56000E', '#D50000', '#FFCDD2'],
      bevel: ['#FFCDD2', '#FF1744', '#5B000E'],
      flame: ['#FFFFFF', '#FF8A80', '#FF1744', '#880E4F'],
      ribbon: ['#FF5252', '#D50000', '#4A000A'],
      textFill: '#FFF5F5',
      textStroke: '#400008',
      stars: '#FFEBEE',
      laurel: '#FF5252',
      glow: 'rgba(255, 51, 102, 0.55)',
    },
    emerald: {
      outerRim: ['#E8F8F5', '#2ECC71', '#0E4B25'],
      innerDisc: ['#0B3B1D', '#27AE60', '#A3E4D7'],
      bevel: ['#D4EFDF', '#229954', '#0B3B1D'],
      flame: ['#FFFFFF', '#A9DFBF', '#2ECC71', '#145A32'],
      ribbon: ['#2ECC71', '#1E8449', '#0B3B1D'],
      textFill: '#FFFFFF',
      textStroke: '#072613',
      stars: '#D4EFDF',
      laurel: '#2ECC71',
      glow: 'rgba(46, 204, 113, 0.5)',
    },
    titan: {
      outerRim: ['#FFE082', '#FF6D00', '#3E1C00'],
      innerDisc: ['#210D00', '#FF8F00', '#FFF8E1'],
      bevel: ['#FFE082', '#E65100', '#2E1100'],
      flame: ['#FFFFFF', '#FFD54F', '#FF6D00', '#DD2C00'],
      ribbon: ['#FFA000', '#E65100', '#3E1500'],
      textFill: '#FFF8E1',
      textStroke: '#2E1000',
      stars: '#FFECB3',
      laurel: '#FFA000',
      glow: 'rgba(255, 145, 0, 0.55)',
    },
    mythic: {
      outerRim: ['#FFFDE7', '#FFD700', '#7F4500'],
      innerDisc: ['#422100', '#FFB300', '#FFF8E1'],
      bevel: ['#FFF9C4', '#FFA000', '#451F00'],
      flame: ['#FFFFFF', '#FFF176', '#FF9800', '#E65100'],
      ribbon: ['#FFD54F', '#FFA000', '#562500'],
      textFill: '#FFFDE7',
      textStroke: '#3D1A00',
      stars: '#FFF9C4',
      laurel: '#FFD700',
      glow: 'rgba(255, 215, 0, 0.65)',
    },
  }[tier];

  return (
    <div
      onClick={onClick}
      style={{ width: dimension, height: dimension }}
      className={`relative inline-flex items-center justify-center select-none ${
        onClick ? 'cursor-pointer hover:scale-105 active:scale-95 transition-transform' : ''
      } ${className}`}
    >
      <svg
        viewBox="0 0 200 200"
        className={`w-full h-full drop-shadow-xl ${isLocked ? 'filter grayscale contrast-75 opacity-40' : ''} ${
          animated && !isLocked ? 'animate-pulse' : ''
        }`}
      >
        <defs>
          {/* Radial Ambient Glow */}
          <radialGradient id={`glow_${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={palette.glow} stopOpacity="0.8" />
            <stop offset="70%" stopColor={palette.glow} stopOpacity="0.3" />
            <stop offset="100%" stopColor={palette.glow} stopOpacity="0" />
          </radialGradient>

          {/* Outer Rim Bevel Gradient */}
          <linearGradient id={`outer_rim_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.outerRim[0]} />
            <stop offset="30%" stopColor={palette.outerRim[1]} />
            <stop offset="70%" stopColor={palette.outerRim[2]} />
            <stop offset="100%" stopColor={palette.outerRim[0]} />
          </linearGradient>

          {/* Stepped Rim Ring */}
          <linearGradient id={`stepped_rim_${uid}`} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={palette.bevel[0]} />
            <stop offset="50%" stopColor={palette.bevel[1]} />
            <stop offset="100%" stopColor={palette.bevel[2]} />
          </linearGradient>

          {/* Inner Disc Radial Gradient */}
          <radialGradient id={`inner_disc_${uid}`} cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor={palette.innerDisc[2]} />
            <stop offset="60%" stopColor={palette.innerDisc[1]} />
            <stop offset="100%" stopColor={palette.innerDisc[0]} />
          </radialGradient>

          {/* Crown Flames Gradients */}
          <linearGradient id={`flame_core_${uid}`} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor={palette.flame[2]} />
            <stop offset="40%" stopColor={palette.flame[1]} />
            <stop offset="100%" stopColor={palette.flame[0]} />
          </linearGradient>
          <linearGradient id={`flame_side_${uid}`} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor={palette.flame[3]} />
            <stop offset="50%" stopColor={palette.flame[2]} />
            <stop offset="100%" stopColor={palette.flame[1]} />
          </linearGradient>

          {/* Ribbon Gradient */}
          <linearGradient id={`ribbon_grad_${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={palette.ribbon[2]} />
            <stop offset="15%" stopColor={palette.ribbon[1]} />
            <stop offset="50%" stopColor={palette.ribbon[0]} />
            <stop offset="85%" stopColor={palette.ribbon[1]} />
            <stop offset="100%" stopColor={palette.ribbon[2]} />
          </linearGradient>

          {/* Laurel Branch Gradient */}
          <linearGradient id={`laurel_grad_${uid}`} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={palette.bevel[2]} />
            <stop offset="50%" stopColor={palette.laurel} />
            <stop offset="100%" stopColor={palette.bevel[0]} />
          </linearGradient>

          {/* Shimmer Specular Light Sweep */}
          <linearGradient id={`shimmer_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
            <stop offset="35%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.25" />
          </linearGradient>

          {/* Drop Shadow Filter */}
          <filter id={`shadow_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#000000" floodOpacity="0.6" />
          </filter>
        </defs>

        {/* Ambient Halo */}
        {!isLocked && (
          <circle cx="100" cy="100" r="94" fill={`url(#glow_${uid})`} />
        )}

        {/* 1. Top Crown Flames (Sculpted 3D flame tongues bursting from top rim) */}
        <g id="crown-flames" filter={`url(#shadow_${uid})`}>
          {/* Back Outer Flame Crest */}
          <path
            d="M 68 62 C 60 40 70 20 80 14 C 82 26 88 32 94 36 C 96 22 104 10 112 6 C 118 20 120 30 114 42 C 122 34 130 32 134 22 C 142 34 136 50 128 62 Z"
            fill={`url(#flame_side_${uid})`}
          />
          {/* Main Central Flame */}
          <path
            d="M 82 60 C 80 42 88 28 98 12 C 104 26 108 36 104 46 C 112 36 118 34 122 28 C 126 38 122 52 116 60 Z"
            fill={`url(#flame_core_${uid})`}
          />
          {/* Inner Flame Tongue Core */}
          <path
            d="M 92 56 C 92 44 96 34 100 24 C 104 34 106 42 102 52 C 106 46 110 44 112 40 C 114 48 112 54 106 58 Z"
            fill="#FFFFFF"
            opacity="0.8"
          />
        </g>

        {/* 2. Outer Medallion Body (Multi-beveled layered metallic rings) */}
        <g id="medallion-rim" filter={`url(#shadow_${uid})`}>
          {/* Outermost rim base */}
          <circle cx="100" cy="108" r="76" fill={`url(#outer_rim_${uid})`} />
          {/* Dark recessed bevel channel */}
          <circle cx="100" cy="108" r="71" fill="#2C1B00" opacity="0.75" />
          {/* Second stepped gold ridge */}
          <circle cx="100" cy="108" r="68" fill={`url(#stepped_rim_${uid})`} />
          {/* Decorative milled dots ring */}
          <circle
            cx="100"
            cy="108"
            r="63.5"
            fill="none"
            stroke={palette.outerRim[0]}
            strokeWidth="1.2"
            strokeDasharray="2 3"
            opacity="0.8"
          />
          {/* Deep inner disc */}
          <circle cx="100" cy="108" r="60" fill={`url(#inner_disc_${uid})`} />
          {/* Specular glass reflection half-moon */}
          <path
            d="M 40 108 A 60 60 0 0 1 160 108 A 60 38 0 0 0 40 108 Z"
            fill={`url(#shimmer_${uid})`}
          />
        </g>

        {/* 3. Engraved Laurel Wreath Branches around bottom rim */}
        <g id="laurel-wreath" fill={`url(#laurel_grad_${uid})`} opacity="0.95">
          {/* Left Laurel Leaves */}
          <path d="M 44 135 C 38 128 36 118 38 110 C 44 116 46 126 44 135 Z" />
          <path d="M 49 146 C 42 140 40 130 43 122 C 49 128 50 138 49 146 Z" />
          <path d="M 58 156 C 50 152 46 142 49 135 C 56 140 58 149 58 156 Z" />
          <path d="M 70 164 C 62 162 56 154 58 146 C 65 150 69 158 70 164 Z" />
          <path d="M 84 169 C 75 169 68 163 70 155 C 77 158 82 164 84 169 Z" />

          {/* Right Laurel Leaves */}
          <path d="M 156 135 C 162 128 164 118 162 110 C 156 116 154 126 156 135 Z" />
          <path d="M 151 146 C 158 140 160 130 157 122 C 151 128 150 138 151 146 Z" />
          <path d="M 142 156 C 150 152 154 142 151 135 C 144 140 142 149 142 156 Z" />
          <path d="M 130 164 C 138 162 144 154 142 146 C 135 150 131 158 130 164 Z" />
          <path d="M 116 169 C 125 169 132 163 130 155 C 123 158 118 164 116 169 Z" />
        </g>

        {/* 4. Flanking Engraved Stars (Left & Right) */}
        <g id="stars" fill={palette.stars} filter={`url(#shadow_${uid})`}>
          {/* Left Upper Star */}
          <polygon points="56,86 58,91 63,91 59,94 60,99 56,96 52,99 53,94 49,91 54,91" />
          {/* Left Lower Star */}
          <polygon points="51,101 53,105 57,105 54,108 55,112 51,109 47,112 48,108 45,105 49,105" />
          {/* Right Upper Star */}
          <polygon points="144,86 146,91 151,91 147,94 148,99 144,96 140,99 141,94 137,91 142,91" />
          {/* Right Lower Star */}
          <polygon points="149,101 151,105 155,105 152,108 153,112 149,109 145,112 146,108 143,105 147,105" />
        </g>

        {/* 5. Center Bold 3D Numeric Display */}
        <g id="center-numeral">
          {/* Deep Drop Shadow text */}
          <text
            x="100"
            y={days >= 100 ? "114" : "118"}
            textAnchor="middle"
            fill="#1E1200"
            fontSize={days >= 1000 ? "34" : days >= 100 ? "40" : "50"}
            fontWeight="900"
            fontFamily="system-ui, -apple-system, sans-serif"
            opacity="0.8"
            dy="2"
          >
            {days}
          </text>
          {/* Main Beveled Numeric Text */}
          <text
            x="100"
            y={days >= 100 ? "113" : "117"}
            textAnchor="middle"
            fill={palette.textFill}
            stroke={palette.textStroke}
            strokeWidth="2.5"
            strokeLinejoin="round"
            fontSize={days >= 1000 ? "34" : days >= 100 ? "40" : "50"}
            fontWeight="900"
            fontFamily="system-ui, -apple-system, sans-serif"
            letterSpacing="-0.03em"
          >
            {days}
          </text>
          {/* Top Specular Inner Text Shine */}
          <text
            x="100"
            y={days >= 100 ? "112" : "116"}
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize={days >= 1000 ? "34" : days >= 100 ? "40" : "50"}
            fontWeight="900"
            fontFamily="system-ui, -apple-system, sans-serif"
            letterSpacing="-0.03em"
            opacity="0.4"
          >
            {days}
          </text>
        </g>

        {/* 6. Wrapped Lower Golden Ribbon Banner ("DAY STREAK") */}
        <g id="ribbon-banner" filter={`url(#shadow_${uid})`}>
          {/* Left Ribbon Tail */}
          <path d="M 22 144 L 40 134 L 40 152 L 22 160 Z" fill={palette.ribbon[2]} />
          <path d="M 22 144 L 14 152 L 22 160 Z" fill={palette.ribbon[1]} />
          {/* Left Ribbon Fold Under */}
          <path d="M 38 148 L 50 152 L 40 136 Z" fill="#2E1100" />

          {/* Right Ribbon Tail */}
          <path d="M 178 144 L 160 134 L 160 152 L 178 160 Z" fill={palette.ribbon[2]} />
          <path d="M 178 144 L 186 152 L 178 160 Z" fill={palette.ribbon[1]} />
          {/* Right Ribbon Fold Under */}
          <path d="M 162 148 L 150 152 L 160 136 Z" fill="#2E1100" />

          {/* Main Curved Center Ribbon Banner */}
          <path
            d="M 36 138 C 70 128 130 128 164 138 C 160 156 150 162 100 162 C 50 162 40 156 36 138 Z"
            fill={`url(#ribbon_grad_${uid})`}
            stroke={palette.bevel[0]}
            strokeWidth="1.2"
          />
          {/* Banner Upper/Lower Gold Borders */}
          <path
            d="M 37 140 C 70 130 130 130 163 140"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1"
            opacity="0.6"
          />
          <path
            d="M 44 156 C 70 159 130 159 156 156"
            fill="none"
            stroke="#2C1200"
            strokeWidth="1"
            opacity="0.5"
          />

          {/* Ribbon Embossed Text: DAY STREAK */}
          <text
            x="100"
            y="151"
            textAnchor="middle"
            fill="#2A1200"
            fontSize="10"
            fontWeight="900"
            fontFamily="system-ui, -apple-system, sans-serif"
            letterSpacing="0.16em"
            dy="1"
            opacity="0.75"
          >
            DAY STREAK
          </text>
          <text
            x="100"
            y="150"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="10"
            fontWeight="900"
            fontFamily="system-ui, -apple-system, sans-serif"
            letterSpacing="0.16em"
          >
            DAY STREAK
          </text>
        </g>

        {/* 7. Metallic Specular Sparkle Stars */}
        {!isLocked && (
          <g id="specular-sparkles">
            {/* Top-Right Rim Glint */}
            <path
              d="M 148 72 Q 152 72 152 68 Q 152 72 156 72 Q 152 72 152 76 Q 152 72 148 72 Z"
              fill="#FFFFFF"
              opacity="0.9"
            />
            {/* Top-Left Flame Sparkle */}
            <path
              d="M 76 38 Q 79 38 79 35 Q 79 38 82 38 Q 79 38 79 41 Q 79 38 76 38 Z"
              fill="#FFFFFF"
              opacity="0.7"
            />
          </g>
        )}
      </svg>

      {/* Lock Overlay for locked milestone badges */}
      {isLocked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="p-2 rounded-full bg-zinc-950/85 border border-zinc-700/80 shadow-lg text-zinc-400">
            <Lock className="w-5 h-5" />
          </div>
        </div>
      )}
    </div>
  );
};

