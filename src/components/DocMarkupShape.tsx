import React from 'react';
import { MarkupItem } from '../types';
import { ZoneImg, zoneMatches } from '../utils/magnify';
import {
  scaleOf, strokePx, itemOpacity, bboxOf, arrowGeom, freehandPath,
  contrastOn, textBox, dimGeom, markerR, magGeom, magGuides, FONT_STACK,
} from '../utils/markup';

/**
 * Dibujo de UNA marca. Lo usan el editor (DocAnnotationModal) y la vista de la
 * hoja (DocAnnotationOverlay), así lo que se edita es idéntico a lo que se
 * imprime. Sin eventos: cada consumidor pone sus propias zonas de click.
 */
/** Marcas de trazo que llevan halo blanco para despegarse del plano. */
const HALO_KINDS = new Set(['line', 'arrow', 'rect', 'ellipse', 'pen', 'dim']);

/**
 * Copia de la marca en blanco y más gruesa, que se dibuja debajo. Reemplaza a
 * la sombra: un filtro SVG haría que la marca se imprima como imagen.
 */
function haloOf(it: MarkupItem): MarkupItem {
  return { ...it, color: '#ffffff', width: it.width + 2.5, opacity: 0.9, fill: false, dashed: false, text: '' };
}

export const MarkupShape: React.FC<{
  it: MarkupItem;
  W: number;
  H: number;
  /** Halo blanco debajo de los trazos (vector puro, a diferencia de una sombra). */
  halo?: boolean;
  /** Imagen del fragmento. Sólo la necesita la lupa. */
  src?: string;
  /** Prefijo para los ids de clipPath, único por lienzo. */
  uid: string;
  /** Zonas de lupa dibujadas aparte, nítidas (ver utils/magnify). */
  zones?: Record<string, ZoneImg>;
}> = ({ it, W, H, halo, src, uid, zones }) => {
  if (halo && HALO_KINDS.has(it.kind)) {
    return (
      <g>
        <MarkupShape it={haloOf(it)} W={W} H={H} uid={uid} />
        <MarkupShape it={it} W={W} H={H} src={src} uid={uid} zones={zones} />
      </g>
    );
  }

  const S = scaleOf(W, H);
  const sw = strokePx(it, S);
  const op = itemOpacity(it);
  const dash = it.dashed ? `${sw * 2.2} ${sw * 1.8}` : undefined;
  const sx = it.x1 * W, sy = it.y1 * H, ex = it.x2 * W, ey = it.y2 * H;

  const wrap = (body: React.ReactNode) => <g opacity={op}>{body}</g>;

  switch (it.kind) {
    case 'line':
      return wrap(
        <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={it.color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={dash} />,
      );

    case 'arrow': {
      const g = arrowGeom(it, W, H);
      return wrap(<>
        <line x1={g.sx} y1={g.sy} x2={g.lx} y2={g.ly} stroke={it.color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={dash} />
        <polygon points={g.pts.map((p) => p.join(',')).join(' ')} fill={it.color} />
      </>);
    }

    case 'rect': {
      const b = bboxOf(it, W, H);
      return wrap(
        <rect
          x={b.x} y={b.y} width={Math.max(1, b.w)} height={Math.max(1, b.h)} rx={8 * S}
          fill={it.fill ? it.color : 'none'} fillOpacity={it.fill ? 0.2 : undefined}
          stroke={it.color} strokeWidth={sw} strokeDasharray={dash} strokeLinejoin="round"
        />,
      );
    }

    case 'ellipse': {
      const cx = (sx + ex) / 2, cy = (sy + ey) / 2;
      return wrap(
        <ellipse
          cx={cx} cy={cy} rx={Math.max(1, Math.abs(ex - sx) / 2)} ry={Math.max(1, Math.abs(ey - sy) / 2)}
          fill={it.fill ? it.color : 'none'} fillOpacity={it.fill ? 0.2 : undefined}
          stroke={it.color} strokeWidth={sw} strokeDasharray={dash}
        />,
      );
    }

    case 'highlight': {
      const b = bboxOf(it, W, H);
      return (
        <rect x={b.x} y={b.y} width={Math.max(1, b.w)} height={Math.max(1, b.h)} fill={it.color} opacity={op} />
      );
    }

    case 'pen':
      return wrap(
        <path
          d={freehandPath(it.points || [it.x1, it.y1], W, H)} fill="none" stroke={it.color}
          strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash}
        />,
      );

    case 'marker': {
      const r = markerR(it, S);
      return wrap(<>
        <circle cx={sx} cy={sy} r={r} fill={it.color} stroke="#fff" strokeWidth={Math.max(2, r * 0.14)} />
        <text
          x={sx} y={sy + r * 0.04} textAnchor="middle" dominantBaseline="central" fill={contrastOn(it.color)}
          fontSize={Math.round(r * 1.05)} fontWeight={800} fontFamily={FONT_STACK} style={{ userSelect: 'none' }}
        >
          {it.num ?? 1}
        </text>
      </>);
    }

    case 'text': {
      const t = textBox(it, W, H);
      return wrap(<>
        {it.textBg !== false && (
          <rect
            x={t.bx} y={t.by} width={t.bw} height={t.bh} rx={t.r}
            fill="rgba(15,23,42,0.85)" stroke={it.color} strokeWidth={Math.max(1.5, 2 * S)}
          />
        )}
        <text
          x={t.x} y={t.y} dominantBaseline="text-before-edge" fill={it.color}
          fontSize={t.f} fontWeight="bold" fontFamily={FONT_STACK} style={{ userSelect: 'none' }}
        >
          {it.text || ' '}
        </text>
      </>);
    }

    case 'dim': {
      const g = dimGeom(it, W, H);
      const tsw = Math.max(1.5, sw * 0.8);
      const bw = g.tw + g.padX * 2, bh = g.f * 1.2 + g.padY * 2;
      return wrap(<>
        <line x1={g.sx} y1={g.sy} x2={g.ex} y2={g.ey} stroke={it.color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={dash} />
        <path
          d={`M${g.t1[0]} ${g.t1[1]}L${g.t1[2]} ${g.t1[3]}M${g.t2[0]} ${g.t2[1]}L${g.t2[2]} ${g.t2[3]}`}
          stroke={it.color} strokeWidth={tsw} strokeLinecap="round"
        />
        <polygon points={g.a1.map((p) => p.join(',')).join(' ')} fill={it.color} />
        <polygon points={g.a2.map((p) => p.join(',')).join(' ')} fill={it.color} />
        {g.label && (
          <g transform={`translate(${g.cx} ${g.cy}) rotate(${(g.ta * 180) / Math.PI})`}>
            <rect x={-bw / 2} y={-bh / 2} width={bw} height={bh} rx={bh / 3} fill="rgba(15,23,42,0.85)" />
            <text
              x={0} y={g.f * 0.04} textAnchor="middle" dominantBaseline="central" fill={it.color}
              fontSize={g.f} fontWeight="bold" fontFamily={FONT_STACK} style={{ userSelect: 'none' }}
            >
              {g.label}
            </text>
          </g>
        )}
      </>);
    }

    case 'magnifier':
      return <MagnifierShape it={it} W={W} H={H} src={src} uid={uid} zone={zones?.[it.id]} />;

    default:
      return null;
  }
};

/**
 * Lupa: la zona marcada y el callout, que es esa zona ampliada por `zoom`.
 * El callout puede caer fuera del fragmento; el bloque reserva el margen.
 */
const MagnifierShape: React.FC<{ it: MarkupItem; W: number; H: number; src?: string; uid: string; zone?: ZoneImg }> = ({
  it, W, H, src, uid, zone,
}) => {
  const g = magGeom(it, W, H);
  const clipId = `mag-${uid}-${it.id}`;
  const circle = g.shape === 'circle';
  const zoneDash = `${g.sw * 3} ${g.sw * 2}`;

  const zoneOutline = circle
    ? <circle cx={g.zcx} cy={g.zcy} r={g.zr} fill="none" stroke={it.color} strokeWidth={g.sw} strokeDasharray={zoneDash} />
    : <rect x={g.zx} y={g.zy} width={g.zw} height={g.zh} fill="none" stroke={it.color} strokeWidth={g.sw} strokeDasharray={zoneDash} />;

  const calloutBg = circle
    ? <circle className="rp-mag-bg" cx={g.ccx} cy={g.ccy} r={g.cr} fill="#fff" />
    : <rect className="rp-mag-bg" x={g.cx} y={g.cy} width={g.cw} height={g.ch} rx={g.sw * 1.5} fill="#fff" />;

  const calloutBorder = circle
    ? <circle cx={g.ccx} cy={g.ccy} r={g.cr} fill="none" stroke={it.color} strokeWidth={g.sw} />
    : <rect x={g.cx} y={g.cy} width={g.cw} height={g.ch} rx={g.sw * 1.5} fill="none" stroke={it.color} strokeWidth={g.sw} />;

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          {circle
            ? <circle cx={g.ccx} cy={g.ccy} r={g.cr} />
            : <rect x={g.cx} y={g.cy} width={g.cw} height={g.ch} rx={g.sw * 1.5} />}
        </clipPath>
      </defs>

      {/* Guías por debajo de todo */}
      {it.magnifier?.guide !== false && magGuides(g).map(([x1, y1, x2, y2], i) => (
        <line
          key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={it.color}
          strokeWidth={g.sw * 0.7} strokeDasharray={`${g.sw * 2} ${g.sw * 2}`} opacity={0.75}
        />
      ))}

      {zoneOutline}

      {/* Fondo: si la imagen no cargó, el callout se ve igual */}
      {calloutBg}

      {zone && zoneMatches(zone, it) ? (
        // Sólo la zona, dibujada a la resolución del callout: nítida
        <g className="rp-mag-img" clipPath={`url(#${clipId})`}>
          <image href={zone.url} preserveAspectRatio="none"
            x={g.cx + (zone.x * W - g.zx) * g.zoom} y={g.cy + (zone.y * H - g.zy) * g.zoom}
            width={zone.w * W * g.zoom} height={zone.h * H * g.zoom} />
        </g>
      ) : src && (
        <g className="rp-mag-img" clipPath={`url(#${clipId})`}>
          <image href={src} x={g.imgX} y={g.imgY} width={g.imgW} height={g.imgH} preserveAspectRatio="none" />
        </g>
      )}

      {calloutBorder}
    </g>
  );
};

/** Orden de dibujo: resaltador abajo, lupa arriba de todo. */
export const markupZOrder = (k: string) => (k === 'highlight' ? 0 : k === 'magnifier' ? 3 : 2);
