/* =====================================================================
   Módulos en columnas (lado a lado).
   Un bloque se pone al lado de otro con rowWith = id del primero de la
   fila. La fila son los bloques SEGUIDOS (por orden) con el mismo grupo
   (rowWith ?? id). En la hoja se dibujan en una fila; el paginador los
   trata como una sola pieza (no se cortan entre hojas).
   ===================================================================== */
import type { BlockConfig, BlockType } from '../types';

export const MAX_COLUMNS = 4;
export const rowKey = (b: BlockConfig) => b.rowWith || b.id;

/** Tipos que no van en columnas (ocupan el ancho o la hoja entera) */
export const NO_COLUMN_TYPES: BlockType[] = ['header', 'cover', 'toc', 'footer'];
export const canBeColumn = (b: BlockConfig) => !NO_COLUMN_TYPES.includes(b.type) && b.id !== 'header';

/** Parte una lista YA ORDENADA en filas: cada una con 1 o más bloques */
export function groupRows(sorted: BlockConfig[]): BlockConfig[][] {
  const out: BlockConfig[][] = [];
  for (const b of sorted) {
    const last = out[out.length - 1];
    if (last && canBeColumn(b) && canBeColumn(last[0]) && rowKey(last[0]) === rowKey(b) && last.length < MAX_COLUMNS) last.push(b);
    else out.push([b]);
  }
  return out;
}

/** id del bloque → los bloques de su fila (solo filas de 2 o más) */
export function rowMap(blocks: BlockConfig[]): Map<string, BlockConfig[]> {
  const sorted = blocks
    .filter((b) => b.enabled)
    .map((b, i) => ({ b, i }))
    .sort((x, y) => (x.b.order ?? 0) - (y.b.order ?? 0) || x.i - y.i)
    .map(({ b }) => b);
  const m = new Map<string, BlockConfig[]>();
  for (const g of groupRows(sorted)) if (g.length > 1) for (const b of g) m.set(b.id, g);
  return m;
}
