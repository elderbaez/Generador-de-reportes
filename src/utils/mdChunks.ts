import { TABLE_OPTS_RE } from './mdTable';
/**
 * Corta un texto Markdown en "trozos" que se pueden repartir entre hojas sin
 * romper el formato: cada renglón de un párrafo, cada ítem de una lista, y los
 * títulos, citas, tablas, código y líneas enteros.
 *
 * Unir los trozos con su separador (`sep`) devuelve un texto que se ve igual al
 * original. El tipo (`kind`) dice qué espacio va antes del trozo:
 *   line     renglón que sigue en el mismo párrafo (sin espacio)
 *   item     ítem que sigue en la misma lista (sin espacio)
 *   block    párrafo, lista, tabla… nuevos (espacio de párrafo)
 *   heading  título (un poco más de espacio)
 */

export type MdChunkKind = 'line' | 'item' | 'block' | 'heading';
export interface MdChunk {
  src: string;
  kind: MdChunkKind;
  /** Clave estable para medir el alto del trozo (cambia si cambia el texto). */
  key: string;
}

/** Espacio antes de cada tipo de trozo, en mm (texto de 8pt: 1em ≈ 2,82 mm). */
export const CHUNK_GAP_MM: Record<MdChunkKind, number> = { line: 0, item: 0, block: 1.55, heading: 3.1 };

const RE_FENCE = /^\s*(```+|~~~+)/;
const RE_HEAD = /^\s{0,3}#{1,6}\s+/;
const RE_HR = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const RE_QUOTE = /^\s{0,3}>\s?/;
const RE_LIST = /^(\s*)([-*+•]|\d{1,9}[.)])\s+(.*)$/;
const RE_TSEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

const indentOf = (s: string) => s.replace(/\t/g, '    ').match(/^ */)![0].length;
const isTable = (l: string, next?: string) => l.includes('|') && next !== undefined && RE_TSEP.test(next) && next.includes('-');
const isStart = (l: string, next?: string) =>
  RE_FENCE.test(l) || RE_HEAD.test(l) || RE_HR.test(l) || RE_QUOTE.test(l) || RE_LIST.test(l) || isTable(l, next) || TABLE_OPTS_RE.test(l);

function hash(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Sigue una ecuación centrada abierta ($$ … $$ o \[ … \]) renglón por renglón.
 * Adentro de $$ solo cierra otro $$: un "\\[6pt]" (salto con espacio) de un cases/aligned
 * NO abre nada (antes partía la ecuación en pedazos y se veía el código).
 */
export type MathMode = null | '$$' | '\\[';
export const trackDisplay = (l: string, mode: MathMode): MathMode => {
  for (const m of l.matchAll(/(?<!\\)\$\$|(?<!\\)\\\[|(?<!\\)\\\]/g)) {
    const t = m[0];
    if (mode === null) mode = t === '$$' ? '$$' : t === '\\[' ? '\\[' : null;
    else if (mode === '$$' && t === '$$') mode = null;
    else if (mode === '\\[' && t === '\\]') mode = null;
  }
  return mode;
};

export function splitMdChunks(md: string): MdChunk[] {
  const lines = (md || '').replace(/\r\n?/g, '\n').split('\n');
  const raw: { src: string; kind: MdChunkKind }[] = [];
  const push = (src: string, kind: MdChunkKind) => raw.push({ src, kind: raw.length ? kind : 'block' });
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }

    const fence = l.match(RE_FENCE);
    if (fence) {
      const body = [l];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) body.push(lines[i++]);
      if (i < lines.length) body.push(lines[i++]);
      push(body.join('\n'), 'block');
      continue;
    }
    if (RE_HEAD.test(l)) { push(l, 'heading'); i++; continue; }
    if (RE_HR.test(l)) { push(l, 'block'); i++; continue; }
    if (RE_QUOTE.test(l)) {
      const q: string[] = [];
      while (i < lines.length && lines[i].trim() && RE_QUOTE.test(lines[i])) q.push(lines[i++]);
      push(q.join('\n'), 'block');
      continue;
    }
    // Línea de opciones de tabla: va en el mismo trozo que su tabla
    const withOpts = TABLE_OPTS_RE.test(l) && isTable(lines[i + 1] ?? '', lines[i + 2]);
    if (TABLE_OPTS_RE.test(l) && !withOpts) { i++; continue; }
    if (withOpts || isTable(l, lines[i + 1])) {
      const t = withOpts ? [l, lines[i + 1], lines[i + 2]] : [l, lines[i + 1]];
      i += withOpts ? 3 : 2;
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) t.push(lines[i++]);
      push(t.join('\n'), 'block');
      continue;
    }

    const lm = l.match(RE_LIST);
    if (lm) {
      const base = indentOf(lm[1]);
      const ordered = /\d/.test(lm[2]);
      const otherKind = (s: string) => {
        const m = s.match(RE_LIST);
        return !!m && indentOf(m[1]) <= base + 1 && /\d/.test(m[2]) !== ordered;
      };
      const items: string[][] = [];
      while (i < lines.length) {
        const s = lines[i];
        if (items.length && otherKind(s)) break;
        const m = s.match(RE_LIST);
        if (m && indentOf(m[1]) <= base + 1) { items.push([s]); i++; continue; }
        if (s.trim() && indentOf(s) > 0 && items.length) { items[items.length - 1].push(s); i++; continue; }
        if (!s.trim() && i + 1 < lines.length && RE_LIST.test(lines[i + 1]) && !otherKind(lines[i + 1])) { i++; continue; }
        break;
      }
      // En las numeradas, cada ítem lleva su número real (cada trozo se dibuja solo)
      let n = ordered ? parseInt(lm[2], 10) : 0;
      items.forEach((it, k) => {
        if (ordered) it[0] = it[0].replace(/^(\s*)\d{1,9}([.)])/, `$1${n++}$2`);
        push(it.join('\n'), k === 0 ? 'block' : 'item');
      });
      continue;
    }

    // Párrafo: un trozo por renglón (una ecuación $$ … $$ de varios renglones va junta)
    let first = true;
    while (i < lines.length) {
      const s = lines[i];
      if (!s.trim()) break;
      if (!first && isStart(s, lines[i + 1])) break;
      const group = [s];
      i++;
      let mode = trackDisplay(s, null);
      while (mode && i < lines.length) {
        group.push(lines[i]);
        mode = trackDisplay(lines[i], mode);
        i++;
      }
      push(group.join('\n'), first ? 'block' : 'line');
      first = false;
    }
  }
  return raw.map((c) => ({ ...c, key: hash(c.kind + '|' + c.src) }));
}

/** Vuelve a unir un tramo de trozos en Markdown. */
export const joinMdChunks = (chunks: MdChunk[]) =>
  chunks.map((c, k) => (k === 0 ? '' : c.kind === 'line' || c.kind === 'item' ? '\n' : '\n\n') + c.src).join('');

/** Alto estimado de un trozo (mm), mientras no se haya medido. */
export function estimateChunkMm(c: MdChunk): number {
  if (c.kind === 'heading') return 4.5;
  {
    const ls = c.src.split('\n').filter((l) => !TABLE_OPTS_RE.test(l));
    if (c.src.includes('|') && ls.length > 1 && RE_TSEP.test(ls[1] || '')) return ls.length * 5;
  }
  // Estimación inicial para letra de 10 pt (después se usa el alto medido en pantalla)
  const rows = c.src.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 96)), 0);
  const display = /\$\$|\\\[/.test(c.src) ? 9 : 0;
  return rows * 4.5 + display;
}
