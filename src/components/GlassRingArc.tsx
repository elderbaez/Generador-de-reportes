import React, { useId } from 'react';

export interface GlassRingArcProps {
  cx?: number;
  cy?: number;
  r: number;
  sw: number;
  color: string;
  value: number; // 0 to 100
  linecap?: 'round' | 'butt';
  showTrack?: boolean;
  trackColor?: string;
  className?: string;
  trackClassName?: string;
}

/**
 * Renderiza un arco o anillo circular con soporte robusto para gradientes individuales
 * y efecto de vidrio cilíndrico 3D continuo.
 */
export const GlassRingArc: React.FC<GlassRingArcProps> = ({
  cx = 50,
  cy = 50,
  r,
  sw,
  color,
  value,
  linecap = 'round',
  showTrack = true,
  trackColor = 'var(--rp-track-bg, var(--rp-surface-2))',
  className = '',
  trackClassName = '',
}) => {
  const rawId = useId();
  const safeId = rawId.replace(/[^a-zA-Z0-9-_]/g, '_');
  const glossGradId = `rp-rad-gloss-${safeId}`;
  const strokeGradId = `rp-stroke-grad-${safeId}`;

  const v = Math.max(0, Math.min(100, isNaN(value) ? 0 : value));
  const isFull = v >= 99.95;

  const c = 2 * Math.PI * r;
  const dash = (c * v) / 100;

  const rOuter = r + sw / 2;
  const rInner = Math.max(0.1, r - sw / 2);

  const pInner = (rInner / rOuter) * 100;
  const pMid = (r / rOuter) * 100;

  const rGlint = r + sw * 0.22;
  const cGlint = 2 * Math.PI * rGlint;
  const dashGlint = (cGlint * v) / 100;

  // Degradé a partir del color del indicador (hex o variable del tema): del color a una
  // versión más oscura. Va por style (no por atributo) para que var(--rp-…) funcione y
  // siga al tema; color-mix lo resuelve el navegador.
  const base = color || 'var(--rp-primary)';
  const stop1 = base;
  const stop2 = `color-mix(in srgb, ${base} 72%, #000)`;

  return (
    <g className={`rp-glass-ring ${className}`}>
      <defs>
        {/* Gradiente lineal SVG dedicado para este arco exacto */}
        <linearGradient id={strokeGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: stop1 }} />
          <stop offset="100%" style={{ stopColor: stop2 }} />
        </linearGradient>

        <radialGradient
          id={glossGradId}
          cx={cx}
          cy={cy}
          r={rOuter}
          fx={cx}
          fy={cy}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#000000" stopOpacity="0" />
          <stop offset={`${pInner.toFixed(2)}%`} stopColor="#000000" stopOpacity="0.16" />
          <stop offset={`${pMid.toFixed(2)}%`} stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.45" />
        </radialGradient>
      </defs>

      {/* 1. Riel (canal de fondo) */}
      {showTrack && (
        <g className="rp-ring-track-group">
          <circle
            className={`rp-track rp-ring-track ${trackClassName}`}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            style={{ stroke: trackColor }}
            strokeWidth={sw}
          />
        </g>
      )}

      {/* 2. Cuerpo de color base (avance) con gradiente dedicado */}
      {v > 0 && (
        <circle
          className="rp-bar-fill rp-ring-fill"
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          style={{ stroke: `url(#${strokeGradId})` }}
          strokeWidth={sw}
          strokeLinecap={linecap}
          strokeDasharray={isFull ? undefined : `${dash} ${c}`}
        />
      )}

      {/* 3. Reflejo cilíndrico de vidrio (3D continuo) */}
      {v > 0 && (
        <g className="rp-ring-glass-layers" pointerEvents="none">
          <circle
            className="rp-ring-volume"
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={`url(#${glossGradId})`}
            strokeWidth={sw}
            strokeLinecap={linecap}
            strokeDasharray={isFull ? undefined : `${dash} ${c}`}
          />
          <circle
            className="rp-ring-highlight"
            cx={cx}
            cy={cy}
            r={rGlint}
            fill="none"
            stroke="rgba(255, 255, 255, 0.55)"
            strokeWidth={sw * 0.20}
            strokeLinecap={linecap}
            strokeDasharray={isFull ? undefined : `${dashGlint} ${cGlint}`}
          />
        </g>
      )}
    </g>
  );
};
