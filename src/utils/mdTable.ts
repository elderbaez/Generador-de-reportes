/* =====================================================================
   Tablas de los textos (Markdown extendido, sigue siendo texto):

     <!-- tabla: sin-encabezado alternadas -->      ← opciones (opcional)
     | Rubro      | Avance |  <  |                  ← "<" = se une con la de la izquierda
     |---|:---:|---|                                ← alineación por columna
     | Estructura | 60 %   | ok  |
     |  ^         | 40 %   | obs |                  ← "^" = se une con la de arriba

   - Sin la línea de opciones: primera fila de encabezado, sin filas alternadas.
   - Un "<" o "^" literal se escribe "\<" o "\^".
   Lo usan el lector de los textos (RichText), el editor (htmlToMd y la barra de
   tabla) y los trozos para repartir entre hojas (mdChunks).
   ===================================================================== */

export type Align = 'left' | 'center' | 'right' | null;
export interface TableOpts { header: boolean; alt: boolean }
export const DEFAULT_OPTS: TableOpts = { header: true, alt: false };

export const TABLE_OPTS_RE = /^\s*<!--\s*tabla\s*:?\s*(.*?)\s*-->\s*$/i;
export const MERGE_LEFT = '<';
export const MERGE_UP = '^';

export function parseTableOpts(line: string): TableOpts | null {
  const m = TABLE_OPTS_RE.exec(line);
  if (!m) return null;
  const w = m[1].toLowerCase();
  return { header: !/sin[-\s]?encabezado|no[-\s]?header/.test(w), alt: /alternad|zebra|rayad/.test(w) };
}

/** Línea de opciones, o null si son las de siempre (así las tablas comunes quedan igual que antes) */
export function optsLine(o: TableOpts): string | null {
  const w: string[] = [];
  if (!o.header) w.push('sin-encabezado');
  if (o.alt) w.push('alternadas');
  return w.length ? `<!-- tabla: ${w.join(' ')} -->` : null;
}

const isMark = (t: string) => t === MERGE_LEFT || t === MERGE_UP;
/** Texto que se muestra de una celda (sin las marcas; "\<" → "<") */
export const cellText = (t: string) => (isMark(t.trim()) ? '' : t.replace(/^\s*\\([<^])\s*$/, '$1'));

export interface SpanCell { text: string; colSpan: number; rowSpan: number; r: number; c: number }

/**
 * Celdas combinadas: para cada celda, su celda de origen ("<" va a la izquierda, "^" arriba).
 * Devuelve la grilla con la celda de origen (con su colSpan/rowSpan) o null si queda tapada.
 */
export function layoutSpans(grid: string[][]): (SpanCell | null)[][] {
  const R = grid.length, C = Math.max(0, ...grid.map((r) => r.length));
  const key = (r: number, c: number) => r * 10000 + c;
  const memo = new Map<number, number>();
  const origin = (r: number, c: number, depth = 0): number => {
    const k = key(r, c);
    if (memo.has(k)) return memo.get(k)!;
    const t = (grid[r]?.[c] ?? '').trim();
    let o = k;
    if (depth < 200) {
      if (t === MERGE_LEFT && c > 0) o = origin(r, c - 1, depth + 1);
      else if (t === MERGE_UP && r > 0) o = origin(r - 1, c, depth + 1);
    }
    memo.set(k, o);
    return o;
  };
  const box = new Map<number, { r1: number; c1: number }>();
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const o = origin(r, c);
    const b = box.get(o) ?? { r1: Math.floor(o / 10000), c1: o % 10000 };
    b.r1 = Math.max(b.r1, r); b.c1 = Math.max(b.c1, c);
    box.set(o, b);
  }
  const out: (SpanCell | null)[][] = [];
  for (let r = 0; r < R; r++) {
    out.push([]);
    for (let c = 0; c < C; c++) {
      const o = origin(r, c);
      if (o !== key(r, c)) { out[r].push(null); continue; }
      const b = box.get(o)!;
      out[r].push({ text: cellText(grid[r]?.[c] ?? ''), colSpan: b.c1 - c + 1, rowSpan: b.r1 - r + 1, r, c });
    }
  }
  return out;
}

/* ---------- Modelo para editar (contenido de cada celda en HTML del editor) ---------- */

export interface TableModel {
  /** Contenido de cada celda; "<" / "^" = unida a la de la izquierda / arriba */
  cells: string[][];
  align: Align[];
  opts: TableOpts;
}

/** Lee una <table> del editor (con colspan/rowspan) como grilla con marcas */
export function readTableDom(table: HTMLTableElement, cellValue: (el: HTMLTableCellElement) => string): TableModel {
  const grid: string[][] = [];
  Array.from(table.rows).forEach((tr, r) => {
    grid[r] = grid[r] || [];
    let c = 0;
    Array.from(tr.cells).forEach((td) => {
      while (grid[r][c] !== undefined) c++;
      const cs = Math.max(1, td.colSpan || 1), rs = Math.max(1, td.rowSpan || 1);
      for (let dr = 0; dr < rs; dr++) {
        grid[r + dr] = grid[r + dr] || [];
        for (let dc = 0; dc < cs; dc++) grid[r + dr][c + dc] = dr === 0 && dc === 0 ? cellValue(td) : dc > 0 ? MERGE_LEFT : MERGE_UP;
      }
      c += cs;
    });
  });
  const width = Math.max(1, ...grid.map((r) => r.length));
  const cells = grid.map((row) => Array.from({ length: width }, (_, c) => row[c] ?? ''));
  const alignAttr = (table.getAttribute('data-align') || '').split(',');
  const align: Align[] = Array.from({ length: width }, (_, c) => {
    const a = alignAttr[c];
    return a === 'c' ? 'center' : a === 'r' ? 'right' : a === 'l' ? 'left' : null;
  });
  const opts: TableOpts = { header: table.getAttribute('data-noheader') !== '1' && !!table.tHead?.rows.length, alt: table.getAttribute('data-alt') === '1' };
  return { cells, align, opts };
}

export const alignAttr = (align: Align[]) => align.map((a) => (a === 'center' ? 'c' : a === 'right' ? 'r' : a === 'left' ? 'l' : '')).join(',');

/** Origen (fila, columna) de la celda r,c */
export function originOf(cells: string[][], r: number, c: number): [number, number] {
  let rr = r, cc = c, guard = 0;
  while (guard++ < 500) {
    const t = (cells[rr]?.[cc] ?? '').trim();
    if (t === MERGE_LEFT && cc > 0) cc--;
    else if (t === MERGE_UP && rr > 0) rr--;
    else break;
  }
  return [rr, cc];
}

/** Rectángulo que ocupa la celda de origen r,c */
export function regionOf(cells: string[][], r: number, c: number) {
  const [r0, c0] = originOf(cells, r, c);
  let r1 = r0, c1 = c0;
  cells.forEach((row, i) => row.forEach((_, j) => {
    const [a, b] = originOf(cells, i, j);
    if (a === r0 && b === c0) { r1 = Math.max(r1, i); c1 = Math.max(c1, j); }
  }));
  return { r0, c0, r1, c1 };
}

const sameOrigin = (cells: string[][], a: [number, number], b: [number, number]) => {
  const x = originOf(cells, a[0], a[1]), y = originOf(cells, b[0], b[1]);
  return x[0] === y[0] && x[1] === y[1];
};

/** Nueva fila en la posición `at` (las celdas combinadas que la cruzan se estiran) */
export function insertRow(m: TableModel, at: number): TableModel {
  const W = m.cells[0]?.length ?? 1;
  const row = Array.from({ length: W }, (_, c) =>
    at > 0 && at < m.cells.length && sameOrigin(m.cells, [at - 1, c], [at, c]) ? m.cells[at][c] : '');
  const cells = [...m.cells.slice(0, at), row, ...m.cells.slice(at)];
  return { ...m, cells };
}

export function insertCol(m: TableModel, at: number): TableModel {
  const cells = m.cells.map((row, r) => {
    const v = at > 0 && at < row.length && sameOrigin(m.cells, [r, at - 1], [r, at]) ? row[at] : '';
    return [...row.slice(0, at), v, ...row.slice(at)];
  });
  const align = [...m.align.slice(0, at), null, ...m.align.slice(at)];
  return { ...m, cells, align };
}

/** Quita una fila: si en ella empezaba una combinada que sigue abajo, el contenido baja */
export function deleteRow(m: TableModel, r: number): TableModel {
  if (m.cells.length <= 1) return m;
  const cells = m.cells.map((row) => [...row]);
  const W = cells[0].length;
  for (let c = 0; c < W; c++) {
    const t = cells[r][c].trim();
    if (r + 1 < cells.length && !isMark(t) && cells[r + 1][c].trim() === MERGE_UP) cells[r + 1][c] = cells[r][c];
  }
  cells.splice(r, 1);
  return { ...m, cells };
}

export function deleteCol(m: TableModel, c: number): TableModel {
  if ((m.cells[0]?.length ?? 0) <= 1) return m;
  const cells = m.cells.map((row) => {
    const x = [...row];
    const t = x[c].trim();
    if (c + 1 < x.length && !isMark(t) && x[c + 1].trim() === MERGE_LEFT) x[c + 1] = x[c];
    // Un "^" que queda en la primera columna de una combinada sigue siendo válido
    x.splice(c, 1);
    return x;
  });
  const align = m.align.filter((_, i) => i !== c);
  return { ...m, cells, align };
}

/** Combina el rectángulo (agrandado para no cortar combinadas); el texto se junta en la primera */
export function mergeRect(m: TableModel, a: [number, number], b: [number, number]): { model: TableModel; origin: [number, number] } {
  let r0 = Math.min(a[0], b[0]), r1 = Math.max(a[0], b[0]), c0 = Math.min(a[1], b[1]), c1 = Math.max(a[1], b[1]);
  // Agrandar hasta cubrir enteras las combinadas que toca
  for (let changed = true, guard = 0; changed && guard < 50; guard++) {
    changed = false;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const g = regionOf(m.cells, r, c);
      if (g.r0 < r0 || g.c0 < c0 || g.r1 > r1 || g.c1 > c1) {
        r0 = Math.min(r0, g.r0); c0 = Math.min(c0, g.c0); r1 = Math.max(r1, g.r1); c1 = Math.max(c1, g.c1);
        changed = true;
      }
    }
  }
  const cells = m.cells.map((row) => [...row]);
  const texts: string[] = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const t = cells[r][c];
    if (!isMark(t.trim()) && t.replace(/<br\s*\/?>/gi, '').trim()) texts.push(t.trim());
    cells[r][c] = r === r0 && c === c0 ? '' : c === c0 ? MERGE_UP : MERGE_LEFT;
  }
  cells[r0][c0] = texts.join(' ');
  return { model: { ...m, cells }, origin: [r0, c0] };
}

/** Separa la combinada de r,c en celdas sueltas (el texto queda en la primera) */
export function splitCell(m: TableModel, r: number, c: number): TableModel {
  const g = regionOf(m.cells, r, c);
  const cells = m.cells.map((row) => [...row]);
  for (let i = g.r0; i <= g.r1; i++) for (let j = g.c0; j <= g.c1; j++) if (i !== g.r0 || j !== g.c0) cells[i][j] = '';
  return { ...m, cells };
}

/** Grilla del Markdown (texto de cada celda) → líneas de la tabla, con su línea de opciones */
export function tableToMd(cells: string[][], align: Align[], opts: TableOpts): string {
  const W = Math.max(1, ...cells.map((r) => r.length));
  // Las celdas ya vienen con sus marcas ("<", "^") y con "\<" si el texto era un "<" de verdad
  const line = (row: string[]) => '| ' + Array.from({ length: W }, (_, c) => (row[c] ?? '').trim() || ' ').join(' | ') + ' |';
  const sep = '| ' + Array.from({ length: W }, (_, c) => (align[c] === 'center' ? ':---:' : align[c] === 'right' ? '---:' : align[c] === 'left' ? ':---' : '---')).join(' | ') + ' |';
  const head = cells[0] ?? [];
  const o = optsLine(opts);
  return [...(o ? [o] : []), line(head), sep, ...cells.slice(1).map(line)].join('\n');
}

/** Tabla de texto separado por tabulaciones (copiada de Excel como texto) → Markdown */
export function tsvToMd(text: string): string | null {
  const rows = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n');
  if (rows.length < 2 || !rows.every((r) => r.includes('\t'))) return null;
  const cells = rows.map((r) => r.split('\t').map((c) => c.trim().replace(/\|/g, '\\|')));
  return tableToMd(cells, [], DEFAULT_OPTS);
}
