import { BlockConfig, PhotoItem } from '../types';

/**
 * Numeración automática de fotos y documentos ("Foto 01", "Plano 03"…).
 * Es GLOBAL: recorre todos los bloques activos con prefijo, en el orden del informe
 * (hoja, luego posición) y cada prefijo lleva su propio contador correlativo.
 * Un bloque sin prefijo no numera.
 */
/** Número escrito a mano al inicio de un pie: "Foto 03: …", "Fig. 2 -", "Plano Nº 4". */
const MANUAL_NUM = /^\s*([\p{L}][\p{L}.]{1,24}?)\.?\s*(?:n[º°o.]*\s*)?(\d{1,4})\s*(?:[-–—:.)]\s*|$)/u;

/** Quita el número escrito a mano al inicio del pie, sea cual sea la palabra ("Plano 3 - …"). */
export const stripLeadNumber = (c: string) => (c || '').replace(MANUAL_NUM, '');

/**
 * Prefijo con el que numera un bloque de fotos o documentos.
 * Si se eligió en «Numerar como», ese. Si no, se toma de los pies cuando ya
 * traen su número escrito a mano con la misma palabra ("Foto 01: …", "Foto 02: …"):
 * así esas fotos entran en la MISMA secuencia que las de otros bloques que
 * se llaman igual, en vez de quedar con números sueltos.
 */
export function effectivePrefix(b: BlockConfig): string {
  const own = (b.type === 'photos' ? b.photoPrefix : b.type === 'document' ? b.docPrefix : '') || '';
  if (own.trim()) return own.trim();
  const caps = (b.type === 'photos' ? b.photos || [] : b.type === 'document' ? b.docItems || [] : [])
    .map((x: { caption?: string }) => x.caption || '');
  let word = '', hits = 0;
  const filled = caps.filter((c) => c.trim()).length;
  for (const c of caps) {
    const m = MANUAL_NUM.exec(c);
    if (!m) continue;
    const w = m[1].replace(/\.$/, '');
    if (!word) word = w;
    else if (w.toLowerCase() !== word.toLowerCase()) return ''; // palabras distintas: se respeta lo escrito
    hits++;
  }
  // Al menos la mitad de los pies con número: si no, es texto común ("Losa 2 terminada")
  if (!word || hits * 2 < filled) return '';
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function computePhotoLabels(blocks: BlockConfig[]): Record<string, string> {
  // Bloques de fotos con prefijo (elegido o tomado de los pies)
  const photoBlocks = blocks
    .filter((b) => b.enabled && b.type === 'photos' && effectivePrefix(b))
    .sort((a, b) => (a.pageIndex !== b.pageIndex ? a.pageIndex - b.pageIndex : a.order - b.order));

  // Bloques de documentos con prefijo
  const docBlocks = blocks
    .filter((b) => b.enabled && b.type === 'document' && effectivePrefix(b))
    .sort((a, b) => (a.pageIndex !== b.pageIndex ? a.pageIndex - b.pageIndex : a.order - b.order));

  // Bloques de diagrama con prefijo (cada bloque es una figura)
  const diagramBlocks = blocks
    .filter((b) => b.enabled && b.type === 'diagram' && (b.diagramPrefix || '').trim());
  // Módulos HTML / SVG con prefijo (también son una figura cada uno)
  const htmlBlocks = blocks
    .filter((b) => b.enabled && b.type === 'html' && (b.htmlPrefix || '').trim());
  const ganttBlocks = blocks
    .filter((b) => b.enabled && b.type === 'gantt' && (b.ganttPrefix || '').trim());
  const mapBlocks = blocks
    .filter((b) => b.enabled && b.type === 'map' && (b.mapPrefix || '').trim());

  // Re-ordenar por posición en el informe (pageIndex, order del bloque)
  type EntryWithBlock = { prefix: string; ids: string[]; pageIndex: number; order: number };
  const allOrdered: EntryWithBlock[] = [
    ...photoBlocks.map((b) => ({ prefix: effectivePrefix(b), ids: (b.photos || []).map((p: PhotoItem) => p.id), pageIndex: b.pageIndex, order: b.order })),
    ...docBlocks.map((b) => ({ prefix: effectivePrefix(b), ids: (b.docItems || []).map((d) => d.id), pageIndex: b.pageIndex, order: b.order })),
    ...diagramBlocks.map((b) => ({ prefix: b.diagramPrefix!.trim(), ids: [b.id], pageIndex: b.pageIndex, order: b.order })),
    ...htmlBlocks.map((b) => ({ prefix: b.htmlPrefix!.trim(), ids: [b.id], pageIndex: b.pageIndex, order: b.order })),
    ...ganttBlocks.map((b) => ({ prefix: b.ganttPrefix!.trim(), ids: [b.id], pageIndex: b.pageIndex, order: b.order })),
    ...mapBlocks.map((b) => ({ prefix: b.mapPrefix!.trim(), ids: [b.id], pageIndex: b.pageIndex, order: b.order })),
  ].sort((a, b) => (a.pageIndex !== b.pageIndex ? a.pageIndex - b.pageIndex : a.order - b.order));

  // Total por prefijo para decidir los dígitos (01…99, 001…999)
  const totals: Record<string, number> = {};
  allOrdered.forEach((e) => {
    const k = e.prefix.toLowerCase();
    totals[k] = (totals[k] || 0) + e.ids.length;
  });

  const counters: Record<string, number> = {};
  const labels: Record<string, string> = {};
  allOrdered.forEach((e) => {
    const prefix = e.prefix;
    const k = prefix.toLowerCase();
    const digits = Math.max(2, String(totals[k]).length);
    e.ids.forEach((id) => {
      counters[k] = (counters[k] || 0) + 1;
      labels[id] = `${prefix} ${String(counters[k]).padStart(digits, '0')}`;
    });
  });
  return labels;
}

/** Quita una numeración escrita a mano al inicio del pie ("Foto 3 - ", "Fig. 12: ", "Ilustración Nº 4 –"). */
export function stripManualNumber(caption: string, prefix?: string): string {
  const words = ['foto(?:graf[ií]a)?', 'imagen', 'ilustraci[oó]n', 'figura', 'fig\\.?', 'lámina', 'lamina'];
  if (prefix && prefix.trim()) words.unshift(prefix.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`^\\s*(?:${words.join('|')})\\s*(?:n[º°o.]*\\s*)?\\d+\\s*[-–—:.)]?\\s*`, 'i');
  return caption.replace(re, '');
}

export const PHOTO_PREFIX_SUGGESTIONS = ['Foto', 'Fotografía', 'Ilustración', 'Figura', 'Imagen'];
