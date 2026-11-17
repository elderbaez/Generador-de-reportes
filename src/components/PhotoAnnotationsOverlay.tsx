import React from 'react';
import { PhotoAnnotation } from '../types';

interface PhotoAnnotationsOverlayProps {
  annotations?: PhotoAnnotation[];
  tempAnnotation?: PhotoAnnotation | null;
  className?: string;
}

export const PhotoAnnotationsOverlay: React.FC<PhotoAnnotationsOverlayProps> = ({
  annotations = [],
  tempAnnotation,
  className = '',
}) => {
  const filterId = React.useId();
  const filterUrl = `url(#${filterId})`;
  const markerId = `arrowhead-${filterId.replace(/:/g, '')}`;
  const allAnnotations = tempAnnotation ? [...annotations, tempAnnotation] : annotations;
  const hasAnnotations = allAnnotations && allAnnotations.length > 0;

  return (
    <svg
      className={`absolute inset-0 w-full h-full pointer-events-none select-none z-10 ${
        !hasAnnotations ? 'hidden' : ''
      } ${className}`}
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
    >
      <defs>
        <filter id={filterId} x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#000000" floodOpacity="0.7" />
        </filter>

        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
        </marker>
      </defs>

      {allAnnotations.map((ann, idx) => {
        const strokeW = Math.max(3, (ann.strokeWidth || 4) * 3);
        const key = ann.id || `ann-${idx}`;

        const sx = ann.startX;
        const sy = ann.startY;
        const ex = ann.endX;
        const ey = ann.endY;

        if (ann.type === 'rect') {
          const x = Math.min(sx, ex);
          const y = Math.min(sy, ey);
          const w = Math.max(1, Math.abs(ex - sx));
          const h = Math.max(1, Math.abs(ey - sy));

          return (
            <rect
              key={key}
              x={x}
              y={y}
              width={w}
              height={h}
              fill="none"
              stroke={ann.color || '#ef4444'}
              strokeWidth={strokeW}
              strokeLinejoin="round"
              rx={6}
              filter={filterUrl}
            />
          );
        }

        if (ann.type === 'circle') {
          const cx = (sx + ex) / 2;
          const cy = (sy + ey) / 2;
          const rx = Math.max(1, Math.abs(ex - sx) / 2);
          const ry = Math.max(1, Math.abs(ey - sy) / 2);

          return (
            <ellipse
              key={key}
              cx={cx}
              cy={cy}
              rx={rx}
              ry={ry}
              fill="none"
              stroke={ann.color || '#ef4444'}
              strokeWidth={strokeW}
              filter={filterUrl}
            />
          );
        }

        if (ann.type === 'arrow') {
          const dx = ex - sx;
          const dy = ey - sy;
          const length = Math.hypot(dx, dy);
          if (length < 2) return null;

          const angle = Math.atan2(dy, dx);
          const headLen = Math.min(70, Math.max(28, 22 + strokeW * 1.5));
          const headAngle = 0.44;

          const lineEndX = ex - Math.cos(angle) * (headLen * 0.35);
          const lineEndY = ey - Math.sin(angle) * (headLen * 0.35);

          const pTip = `${ex},${ey}`;
          const pLeft = `${ex - headLen * Math.cos(angle - headAngle)},${ey - headLen * Math.sin(angle - headAngle)}`;
          const pIndent = `${ex - headLen * 0.65 * Math.cos(angle)},${ey - headLen * 0.65 * Math.sin(angle)}`;
          const pRight = `${ex - headLen * Math.cos(angle + headAngle)},${ey - headLen * Math.sin(angle + headAngle)}`;

          return (
            <g key={key} filter={filterUrl}>
              <line
                x1={sx}
                y1={sy}
                x2={lineEndX}
                y2={lineEndY}
                stroke={ann.color || '#ef4444'}
                strokeWidth={strokeW}
                strokeLinecap="round"
              />
              <polygon
                points={`${pTip} ${pLeft} ${pIndent} ${pRight}`}
                fill={ann.color || '#ef4444'}
                stroke={ann.color || '#ef4444'}
                strokeWidth={1}
                strokeLinejoin="round"
              />
            </g>
          );
        }

        return null;
      })}
    </svg>
  );
};
