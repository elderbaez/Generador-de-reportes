import { blockInnerWidthMm } from './pageSetup';
import type { DocItem, DocEdge } from '../types';
import { itemAspect, cutSides } from './pdf';
import { magOutset } from './markup';

/** Margen libre alrededor del papel, como fracción de su ancho/alto. */
export interface DocOutset { t: number; r: number; b: number; l: number }

export const NO_OUTSET: DocOutset = { t: 0, r: 0, b: 0, l: 0 };

/**
 * Cuánto hay que dejar libre alrededor del papel para que los callouts de las
 * lupas no pisen lo que esté al lado. Fracción del ancho/alto del papel.
 */
/**
 * Tope de margen por eje: sin esto, una lupa con zoom alto sobre una zona
 * grande pide tanto lugar que el papel queda reducido a una tira. Con 0,8 el
 * papel nunca baja del ~55% del hueco; si el callout es más grande que eso,
 * se sale del margen reservado en vez de aplastar el fragmento.
 */
const MAX_OUTSET_PER_AXIS = 0.8;

export function docOutset(item: DocItem): DocOutset {
  const mags = (item.markup || []).filter((m) => m.kind === 'magnifier' && m.magnifier);
  if (!mags.length) return NO_OUTSET;

  const raw = mags.reduce<DocOutset>((acc, m) => {
    const o = magOutset(m);
    return { t: Math.max(acc.t, o.t), r: Math.max(acc.r, o.r), b: Math.max(acc.b, o.b), l: Math.max(acc.l, o.l) };
  }, { ...NO_OUTSET });

  // Se escala cada eje en bloque, para no correr el callout de lugar más de lo necesario.
  const fx = Math.min(1, MAX_OUTSET_PER_AXIS / Math.max(1e-6, raw.l + raw.r));
  const fy = Math.min(1, MAX_OUTSET_PER_AXIS / Math.max(1e-6, raw.t + raw.b));
  return { l: raw.l * fx, r: raw.r * fx, t: raw.t * fy, b: raw.b * fy };
}

/** Separación entre fragmentos y entre filas (mm). */
export const DOC_GAP_MM = 4;
/** Alto del pie de cada fragmento (una línea, mm). */
export const DOC_CAPTION_LINE_MM = 3.4;
/**
 * Lo que suma el pie además de sus líneas: relleno (2 × 4 px), borde (2 × 1 px)
 * y separación del papel (3 px) ≈ 3.3 mm. Ver figcaption.rp-doc-caption.
 */
export const DOC_CAPTION_PAD_MM = 3.3;
/** Ancho útil del bloque dentro de la hoja (210 mm − márgenes laterales). */
export const DOC_INNER_WIDTH_MM = 199;
/** Ancho útil según la hoja elegida (199 mm en A4 vertical sin márgenes). */
export const docInnerWidthMm = () => blockInnerWidthMm();
export const DOC_MAX_HEIGHT = { min: 40, max: 255, step: 1, default: 150 };

export interface DocRowLayout {
  /**
   * `w`/`h` son el papel; `outset` el margen reservado alrededor (fracción de
   * w/h), y `boxW`/`boxH` el lugar total que ocupa el fragmento en la fila.
   */
  items: { item: DocItem; w: number; h: number; outset: DocOutset; boxW: number; boxH: number }[];
  h: number;
  w: number;
}

/** Agrupa los elementos en filas: cada "rowBreak" empieza una fila nueva. */
export function docRows(items: DocItem[]): DocItem[][] {
  const rows: DocItem[][] = [];
  items.forEach((it, i) => {
    if (i === 0 || it.rowBreak) rows.push([]);
    rows[rows.length - 1].push(it);
  });
  return rows;
}

/**
 * Filas "justificadas": todos los fragmentos de una fila tienen el mismo alto y
 * juntos ocupan el ancho disponible, salvo que eso supere el alto máximo (en ese
 * caso la fila queda centrada y más angosta). Unidades: las mismas de `width`.
 */
export function layoutDocRows(items: DocItem[], width: number, maxH: number, gap: number): DocRowLayout[] {
  return docRows(items).map((row) => {
    const ars = row.map((it) => Math.max(0.05, itemAspect(it)));
    const outs = row.map((it) => docOutset(it));
    // Relación de aspecto de la caja completa (papel + margen reservado): con
    // eso la fila se justifica por lo que realmente ocupa cada fragmento.
    const boxArs = ars.map((ar, i) => (ar * (1 + outs[i].l + outs[i].r)) / (1 + outs[i].t + outs[i].b));
    const sum = boxArs.reduce((a, b) => a + b, 0);
    const free = Math.max(10, width - gap * (row.length - 1));
    const boxH = Math.min(maxH, free / sum);
    const its = row.map((item, i) => {
      const h = boxH / (1 + outs[i].t + outs[i].b);
      const w = ars[i] * h;
      return { item, w, h, outset: outs[i], boxW: boxArs[i] * boxH, boxH };
    });
    return { items: its, h: boxH, w: its.reduce((a, b) => a + b.boxW, 0) + gap * (row.length - 1) };
  });
}

/** Alto estimado del contenido del bloque (sin título) en mm. */
export function estimateDocContentMm(items: DocItem[], maxH: number, showCaption: boolean): number {
  if (!items.length) return 24;
  const rows = layoutDocRows(items, docInnerWidthMm(), maxH, DOC_GAP_MM);
  return rows.reduce((sum, r) => {
    let cap = 0;
    if (showCaption) {
      const lines = Math.max(1, ...r.items.map(({ item, w }) => {
        const per = Math.max(10, Math.floor((w - 2) / 1.45));
        return Math.ceil(((item.caption || 'x').length + 10) / per);
      }));
      cap = lines * DOC_CAPTION_LINE_MM + DOC_CAPTION_PAD_MM;
    }
    return sum + r.h + cap;
  }, 0) + DOC_GAP_MM * (rows.length - 1) + 6;
}

/* ---------- Bordes con efecto de corte ---------- */

/** Generador pseudoaleatorio estable (el rasgado no cambia entre dibujos). */
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
}

type Side = 'top' | 'right' | 'bottom' | 'left';

/**
 * Hundimiento (mm) del borde a lo largo de un lado de `len` mm.
 * Devuelve pares [posición, hundimiento] desde el inicio hasta el final del lado.
 */
function edgeProfile(edge: DocEdge, len: number, rand: () => number): [number, number][] {
  const pts: [number, number][] = [];
  if (edge === 'zigzag') {
    const A = 1.5;
    const n = Math.max(2, Math.round(len / 3.2));
    const P = len / n;
    for (let i = 0; i <= n; i++) {
      pts.push([i * P, 0]);
      if (i < n) pts.push([i * P + P / 2, A]);
    }
  } else if (edge === 'wave') {
    const A = 1.1;
    const n = Math.max(1, Math.round(len / 7));
    const P = len / n;
    const steps = n * 10;
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * len;
      pts.push([x, (A / 2) * (1 - Math.cos((2 * Math.PI * x) / P))]);
    }
  } else if (edge === 'torn') {
    const step = 0.9;
    const n = Math.max(3, Math.round(len / step));
    let d = 0.9;
    for (let i = 0; i <= n; i++) {
      // paseo aleatorio suave con saltos ocasionales (fibra de papel)
      d += (rand() - 0.5) * 0.9;
      if (rand() < 0.08) d += (rand() - 0.5) * 1.6;
      d = Math.max(0.1, Math.min(2.2, d));
      pts.push([(i / n) * len, d]);
    }
  } else {
    pts.push([0, 0], [len, 0]);
  }
  return pts;
}

/**
 * Lados a los que se aplica el efecto de borde. Si el fragmento es la hoja
 * entera, "sólo los recortados" no tendría ningún lado y el borde elegido no se
 * vería: en ese caso se aplica a los cuatro.
 */
export function effectiveEdgeSides(item: DocItem): 'cut' | 'all' | 'h' {
  const mode = item.edgeSides || 'cut';
  if (mode !== 'cut') return mode;
  const c = cutSides(item);
  return c.top || c.right || c.bottom || c.left ? 'cut' : 'all';
}

/**
 * clip-path (polygon en %) para un fragmento de `w`×`h` mm. Devuelve undefined si
 * todos los lados son rectos.
 */
export function edgeClipPath(item: DocItem, w: number, h: number): string | undefined {
  const edge = item.edge || 'straight';
  if (edge === 'straight' || w <= 0 || h <= 0) return undefined;
  const cut = cutSides(item);
  const sides = effectiveEdgeSides(item);
  const on: Record<Side, boolean> = sides === 'all'
    ? { top: true, right: true, bottom: true, left: true }
    : sides === 'h'
    ? { top: true, right: false, bottom: true, left: false }
    : cut;
  if (!on.top && !on.right && !on.bottom && !on.left) return undefined;
  const rand = rng(item.id + edge);
  const pts: [number, number][] = [];
  const prof = (s: Side, len: number) => (on[s] ? edgeProfile(edge, len, rand) : [[0, 0], [len, 0]] as [number, number][]);
  prof('top', w).forEach(([t, d]) => pts.push([t, d]));
  prof('right', h).forEach(([t, d]) => pts.push([w - d, t]));
  prof('bottom', w).forEach(([t, d]) => pts.push([w - t, h - d]));
  prof('left', h).forEach(([t, d]) => pts.push([d, h - t]));
  const pct = (v: number, tot: number) => `${((v / tot) * 100).toFixed(3)}%`;
  return `polygon(${pts.map(([x, y]) => `${pct(x, w)} ${pct(y, h)}`).join(',')})`;
}

export const DOC_EDGE_OPTIONS: { value: DocEdge; label: string }[] = [
  { value: 'straight', label: 'Recto' },
  { value: 'zigzag', label: 'Zigzag' },
  { value: 'wave', label: 'Ondulado' },
  { value: 'torn', label: 'Rasgado' },
];
