import { BlockConfig, PhotoItem, RubricItem, PendingItem, ObservationsData } from '../types';
import { ganttLayoutMm, ganttRowsFor } from './gantt';
import { pageCapacityFor, blockInnerWidthMm } from './pageSetup';
import { estimateDocContentMm } from './docLayout';
import { rowMap } from './rows';
import { splitMdChunks, CHUNK_GAP_MM, estimateChunkMm } from './mdChunks';

export interface PhotoDistributionResult {
  pagePhotosMap: Record<number, PhotoItem[]>;
  blockPhotoPagesMap: Record<string, Record<number, PhotoItem[]>>;
  totalRequiredPhotoPages: number;
  effectiveBlocks: BlockConfig[];
  totalRequiredPages: number;
  /**
   * Bloques de texto repartidos en varias hojas: tramos de trozos (ver mdChunks)
   * por hoja. Solo aparecen los bloques que de verdad se cortan.
   */
  textParts: Record<string, TextPart[]>;
}

export interface TextPart {
  page: number;
  /** Trozos [from, to) de splitMdChunks(textContent) */
  from: number;
  to: number;
}

// 250mm safe printable content height for A4 (297mm total - 12mm running header - 14mm footer - 21mm margins/safe buffer)
// This strictly prevents the red 297mm cutline overflow indicator from triggering.
export const TOTAL_A4_PRINTABLE_MM = 278;

/**
 * Alto útil real de cada hoja (medido): 287 mm en la hoja 1 (sin franja superior) y 280 mm
 * en las demás (franja de 7 mm). Se deja ~1,8 mm de margen de seguridad (los altos ahora se miden).
 */
export const pageCapacityMm = (page: number) => pageCapacityFor(page === 0 ? 285.5 : TOTAL_A4_PRINTABLE_MM);

/* Medidas reales del bloque de fotos (medidas en pantalla a 96 dpi) */
const PHOTO_BLOCK_PADDING_MM = 4.2;   // py-2 del bloque (arriba + abajo)
const PHOTO_TITLE_MM = 9.5;           // banner de título + margen inferior
const PHOTO_CONT_TITLE_MM = 5.2;      // título menor "(continuación)"
const PHOTO_ROW_GAP_MM = 3.2;         // separación entre filas (gap-3)
// Ancho útil del bloque de fotos: 199 mm en A4 (210 mm − px-5 a cada lado); cambia con la hoja elegida

/** Alto de una fila de tarjetas: foto + pie de foto (según líneas del texto más largo) + bordes. */
export function photoCardHeightMm(row: PhotoItem[], cols: number, imgMm: number): number {
  const cardWidthMm = (blockInnerWidthMm() - (cols - 1) * PHOTO_ROW_GAP_MM) / cols;
  const charsPerLine = Math.max(8, Math.floor((cardWidthMm - 4.5) / 1.45));
  const lines = Math.max(1, ...row.map((p) => Math.ceil(((p.caption || 'Fotografía 00').length) / charsPerLine)));
  const captionMm = Math.max(5.5, lines * 3.3 + 2.2);
  return imgMm + captionMm + 0.8;
}

/**
 * Estimates the physical height in millimeters of a block on an A4 sheet.
 */
export function estimateBlockHeightMm(
  block: BlockConfig,
  rubrics: RubricItem[] = [],
  pendings: PendingItem[] = [],
  observations?: ObservationsData
): number {
  const showTitle = block.showTitle !== false;
  const titleHeight = showTitle ? 11 : 0;

  switch (block.type) {
    case 'header':
      // Header with institutional titles, logo, date and badge ~32mm
      return 32;

    case 'contract_metrics':
      // Contract details and 3 progress circles ~44mm
      return 44;

    case 'situation': {
      // Section title banner + dynamic SVG bar chart + padding
      const all = block.rubricsItems ?? rubrics;
      // Con "ocultar en 0 %" se cuentan solo los que se ven (aproximado: la medición corrige)
      const items = block.hideZeroRubrics ? all.filter((r) => r.group || r.comment || Number(r.percent) > 0) : all;
      const count = Math.min(items.length, 30);
      const chartMm = Math.max(45, (count * 30 + 34) / 3.78);
      return titleHeight + chartMm + 14; // ~114mm for 10 rubrics
    }

    case 'pending': {
      // Alto real de la tabla estilo Notion: cada fila crece según el texto más largo
      // (medido: descripción ~50 caracteres por línea, responsable ~20, 3,7 mm por línea + 1,1 mm por fila).
      const items = block.pendingsItems ?? pendings;
      const lines = (text: string, perLine: number) => Math.max(1, Math.ceil((text || '').length / perLine));
      const rowsMm = items.length === 0
        ? 12
        : items.reduce((sum, it) => sum + Math.max(lines(it.description, 50), lines(it.responsible, 20)) * 3.7 + 1.1, 0);
      return titleHeight + 4.2 + 6.2 + rowsMm + 0.5;
    }

    case 'observations': {
      // Solo el recuadro de notas (las firmas son un módulo aparte). Es la
      // estimación inicial: la hoja después mide el alto real del bloque.
      const text = (block.obsNotes !== undefined ? block.obsNotes : observations?.notes) || '';
      const rows = text.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 110)), 0);
      const extra = block.obsStyle === 'list' || block.obsStyle === 'code' ? 1.2 : 0;
      return titleHeight + 10 + Math.max(1, rows) * (3.6 + extra) + 6;
    }

    case 'photos': {
      const pCols = block.photoColumns ?? 2;
      const pH = block.photoHeightMm ?? 40;
      const count = block.photos ? block.photos.length : 4;
      const rows = Math.ceil(count / pCols);
      return titleHeight + rows * (pH + 19);
    }

    case 'weather':
      return titleHeight + (block.weatherMode === 'week' ? 68 : 45);

    case 'text': {
      const len = (block.textContent || '').length;
      return titleHeight + Math.max(20, Math.min(100, Math.ceil(len / 80) * 8)) + 8;
    }

    case 'specs': {
      const items = block.specsItems || [];
      return titleHeight + 14 + Math.max(1, items.length) * 11;
    }

    case 'signatures':
      return titleHeight + 48;

    case 'html':
      return titleHeight + 50;

    case 'diagram':
      return titleHeight + Math.min(block.diagramMaxHeightMm ?? 120, 80) + 10;

    case 'map':
      return titleHeight + (block.mapHeightMm ?? 80) + 12;

    case 'toc':
      // Se corrige solo con el alto medido en pantalla
      return titleHeight + 70;

    case 'scurve': {
      // Alturas medidas del bloque renderizado a 210 mm de ancho (modo lectura/impresión)
      const KPI_MM: Record<string, number> = { cards: 31, strip: 16, rings: 38, panel: 33 };
      const rows = block.scurveData ? block.scurveData.length : 8; // sin datos = 8 períodos de ejemplo
      const kpiMm = block.showIndicators !== false ? KPI_MM[block.kpiVariant ?? 'cards'] ?? 31 : 0;
      const chartMm = (block.scurveChartHeightMm ?? 52) + 13; // gráfico + cabecera y márgenes
      const tableMm = block.showTable !== false ? 6.5 + Math.max(1, rows) * 6.1 : 0;
      return titleHeight + 6 + kpiMm + chartMm + tableMm;
    }

    case 'document': {
      const docContent = estimateDocContentMm(
        block.docItems ?? [],
        block.docMaxHeightMm ?? 150,
        block.docShowCaption ?? false,
      );
      return titleHeight + docContent;
    }

    case 'footer':
      // Footer is rendered statically at the bottom of each A4 page
      return 0;

    default:
      return titleHeight + 35;
  }
}

/**
 * Calculates photo pagination across pages and cascades subsequent blocks
 * to ensure that split photo sections flow naturally without being pushed
 * behind non-photo blocks or causing unexpected overflows.
 */
export interface MeasuredHeights {
  /** Alto de cada bloque (no fotos) por id. */
  blocks: Record<string, number>;
  /** Alto de cada tarjeta de foto, por "id|columnas|alto". */
  photos: Record<string, number>;
  /** Alto de cada trozo de texto, por "idBloque|claveTrozo" (ver mdChunks). */
  chunks?: Record<string, number>;
  /** Bloques de texto: lo que ocupa el bloque fuera del texto (título y rellenos), en mm. */
  textFrame?: Record<string, { head0?: number; headN?: number; tail?: number }>;
}

export function distributePhotosAcrossPages(
  photos: PhotoItem[],
  blocks: BlockConfig[],
  rubrics: RubricItem[] = [],
  pendings: PendingItem[] = [],
  observations?: ObservationsData,
  photoColumns: 1 | 2 | 3 | 4 = 2,
  photoHeightMm: number = 40,
  /** Altos reales medidos en pantalla (mm). Si existen, reemplazan a las estimaciones. */
  measured?: MeasuredHeights
): PhotoDistributionResult {
  let currentPage = 0;
  let availableHeightMm = pageCapacityMm(0);
  // Rubros que usa el cronograma (los mismos que le pasa ReportSheet)
  const ganttRubrics = blocks.find((b) => b.enabled && b.type === 'situation')?.rubricsItems ?? rubrics;

  const blockPhotoPagesMap: Record<string, Record<number, PhotoItem[]>> = {};
  const globalPagePhotosMap: Record<number, PhotoItem[]> = {};
  const effectiveBlocks: BlockConfig[] = [];
  const textParts: Record<string, TextPart[]> = {};

  let maxPhotoPage = 0;

  // Recorrer los bloques en el mismo orden en que se muestran (por `order`), no en el
  // orden en que quedaron guardados en la lista. Antes esto hacía que los bloques "saltaran".
  const orderedBlocks = blocks
    .map((b, i) => ({ b, i }))
    .sort((x, y) => (x.b.order ?? 0) - (y.b.order ?? 0) || x.i - y.i)
    .map(({ b }) => b);

  // Filas de módulos lado a lado: se ubican juntos, como una sola pieza
  const rows = rowMap(blocks);

  for (const block of orderedBlocks) {
    if (!block.enabled) {
      effectiveBlocks.push(block);
      continue;
    }

    const row = rows.get(block.id);
    if (row) {
      if (row[0].id !== block.id) continue; // ya se ubicó con el primero de su fila
      const rowH = measured?.blocks[`row:${row[0].id}`]
        ?? Math.max(...row.map((b) => estimateBlockHeightMm(b, rubrics, pendings, observations)));
      const pageIsEmpty = availableHeightMm >= pageCapacityMm(currentPage);
      if (!pageIsEmpty && (row.some((b) => b.forceNewPage) || rowH > availableHeightMm)) {
        currentPage++;
        availableHeightMm = pageCapacityMm(currentPage);
      }
      for (const b of row) {
        if (b.type === 'photos') {
          const list = b.photos !== undefined ? b.photos : photos;
          blockPhotoPagesMap[b.id] = { [currentPage]: list };
          if (list.length) maxPhotoPage = Math.max(maxPhotoPage, currentPage);
        }
        effectiveBlocks.push({ ...b, pageIndex: currentPage });
      }
      availableHeightMm -= rowH;
      continue;
    }

    if (block.type === 'footer') {
      effectiveBlocks.push(block);
      continue;
    }

    // Portada: siempre sola en su hoja (si la hoja actual ya tiene algo, va a la siguiente)
    if (block.type === 'cover') {
      if (availableHeightMm < pageCapacityMm(currentPage)) currentPage++;
      effectiveBlocks.push({ ...block, pageIndex: currentPage });
      currentPage++;
      availableHeightMm = pageCapacityMm(currentPage);
      continue;
    }

    if (block.type === 'photos') {
      const blockPhotos = block.photos !== undefined ? block.photos : photos;
      const cols = block.photoColumns ?? photoColumns;
      const imgMm = block.photoHeightMm ?? photoHeightMm;
      const maxPerPage = block.maxPhotosPerPage || 0; // 0 = automático
      const firstOverhead = PHOTO_BLOCK_PADDING_MM + (block.showTitle !== false ? PHOTO_TITLE_MM : 0);
      const contOverhead = PHOTO_BLOCK_PADDING_MM + (block.showContinuationTitle !== false ? PHOTO_CONT_TITLE_MM : 0);

      // Filas: grupos de `cols` fotos; un salto forzado (breakAfter) cierra la fila y la hoja.
      const rows: { photos: PhotoItem[]; heightMm: number; breakAfter: boolean }[] = [];
      for (let i = 0; i < blockPhotos.length; ) {
        const row: PhotoItem[] = [];
        while (row.length < cols && i < blockPhotos.length) {
          row.push(blockPhotos[i]);
          i++;
          if (row[row.length - 1].breakAfter) break;
        }
        rows.push({
          photos: row,
          // Alto real de la tarjeta más alta de la fila (si ya se midió), si no, la estimación.
          heightMm: Math.max(
            ...row.map((ph) => measured?.photos[`${ph.id}|${cols}|${imgMm}`] ?? photoCardHeightMm([ph], cols, imgMm))
          ),
          breakAfter: !!row[row.length - 1].breakAfter,
        });
      }

      // ¿Entra al menos el título y la primera fila en lo que queda de la hoja actual?
      const firstNeed = firstOverhead + (rows[0]?.heightMm ?? 0);
      if ((block.forceNewPage || availableHeightMm < firstNeed) && availableHeightMm < pageCapacityMm(currentPage)) {
        currentPage++;
        availableHeightMm = pageCapacityMm(currentPage);
      }

      const startPage = currentPage;
      blockPhotoPagesMap[block.id] = {};

      if (rows.length === 0) {
        effectiveBlocks.push({ ...block, pageIndex: startPage });
        availableHeightMm = Math.max(0, availableHeightMm - firstOverhead - 20);
        continue;
      }

      // Llenar hojas fila por fila. Lo que no entra pasa a la hoja siguiente (nunca queda cortado).
      let page = startPage;
      let used = firstOverhead;
      let room = availableHeightMm;
      let onPage: PhotoItem[] = [];
      let rowsOnPage = 0;

      const closePage = () => {
        if (onPage.length > 0) {
          blockPhotoPagesMap[block.id][page] = onPage;
          if (Object.keys(blockPhotoPagesMap)[0] === block.id) globalPagePhotosMap[page] = onPage;
          maxPhotoPage = Math.max(maxPhotoPage, page);
        }
      };

      for (const row of rows) {
        const need = (rowsOnPage > 0 ? PHOTO_ROW_GAP_MM : 0) + row.heightMm;
        const overCount = maxPerPage > 0 && onPage.length + row.photos.length > maxPerPage;
        if (rowsOnPage > 0 && (used + need > room || overCount)) {
          closePage();
          page++;
          room = pageCapacityMm(page);
          used = contOverhead;
          onPage = [];
          rowsOnPage = 0;
        }
        used += (rowsOnPage > 0 ? PHOTO_ROW_GAP_MM : 0) + row.heightMm;
        onPage.push(...row.photos);
        rowsOnPage++;
        if (row.breakAfter) {
          closePage();
          page++;
          room = pageCapacityMm(page);
          used = contOverhead;
          onPage = [];
          rowsOnPage = 0;
        }
      }

      if (onPage.length > 0) {
        closePage();
        currentPage = page;
        availableHeightMm = Math.max(0, room - used);
      } else {
        // La última fila terminó con un salto forzado: lo siguiente empieza en hoja nueva.
        currentPage = page;
        availableHeightMm = pageCapacityMm(page);
      }

      effectiveBlocks.push({ ...block, pageIndex: startPage });

    } else if (block.type === 'gantt' && ganttRowsFor(block, ganttRubrics).shown.length) {
      // Cronograma: filas de alto fijo; si no entra, sigue en la hoja siguiente repitiendo la escala
      const L = ganttLayoutMm(block);
      // Las mismas filas que dibuja la hoja (con los rubros de la primera tabla, como ReportSheet)
      const n = ganttRowsFor(block, ganttRubrics).shown.length;
      const pageIsEmpty = availableHeightMm >= pageCapacityMm(currentPage);
      const firstNeed = L.head0 + L.row * Math.min(n, 3) + (n <= 3 ? L.tail : 0);
      if (!pageIsEmpty && (block.forceNewPage || firstNeed > availableHeightMm)) {
        currentPage++;
        availableHeightMm = pageCapacityMm(currentPage);
      }
      const parts: TextPart[] = [];
      let page = currentPage;
      let room = availableHeightMm;
      let used = L.head0;
      let from = 0;
      for (let k = 0; k < n; k++) {
        // La última fila tiene que entrar junto con la leyenda y el pie
        const need = L.row + (k === n - 1 ? L.tail : 0);
        if (k > from && used + need > room) {
          parts.push({ page, from, to: k });
          page++;
          room = pageCapacityMm(page);
          from = k;
          used = L.headN;
        }
        used += L.row;
      }
      used += L.tail;
      parts.push({ page, from, to: n });
      if (parts.length > 1) textParts[block.id] = parts;
      effectiveBlocks.push({ ...block, pageIndex: parts[0].page });
      currentPage = page;
      availableHeightMm = Math.max(0, room - used);
    } else if (block.type === 'text' && (block.textContent || '').trim()) {
      // Texto: se reparte por trozos (renglones, ítems, párrafos) entre las hojas que haga falta
      const chunks = splitMdChunks(block.textContent || '');
      const frame = measured?.textFrame?.[block.id] ?? {};
      const titleMm = block.showTitle !== false ? 9.5 : 0;
      const head0 = frame.head0 ?? 3.6 + titleMm;
      const headN = frame.headN ?? 3.6;
      const tail = frame.tail ?? 3.6;
      const h = chunks.map((c) => measured?.chunks?.[`${block.id}|${c.key}`] ?? estimateChunkMm(c));
      const gap = (k: number, from: number) => (k > from ? CHUNK_GAP_MM[chunks[k].kind] : 0);

      // ¿Entra al menos el título y el primer trozo en lo que queda de la hoja?
      const pageIsEmpty = availableHeightMm >= pageCapacityMm(currentPage);
      if (!pageIsEmpty && (block.forceNewPage || head0 + h[0] + tail > availableHeightMm)) {
        currentPage++;
        availableHeightMm = pageCapacityMm(currentPage);
      }
      const parts: TextPart[] = [];
      let page = currentPage;
      let room = availableHeightMm;
      let used = head0;
      let from = 0;
      for (let k = 0; k < chunks.length; k++) {
        const need = gap(k, from) + h[k];
        if (k > from && used + need + tail > room) {
          // Un título no queda solo al pie de la hoja: pasa con lo que le sigue
          let cut = k;
          while (cut - 1 > from && chunks[cut - 1].kind === 'heading') cut--;
          parts.push({ page, from, to: cut });
          page++;
          room = pageCapacityMm(page);
          from = cut;
          used = headN;
          for (let j = cut; j < k; j++) used += gap(j, from) + h[j];
        }
        used += gap(k, from) + h[k];
      }
      parts.push({ page, from, to: chunks.length });
      if (parts.length > 1) textParts[block.id] = parts;
      effectiveBlocks.push({ ...block, pageIndex: parts[0].page });
      currentPage = page;
      availableHeightMm = Math.max(0, room - used - tail);
    } else {
      const blockH = measured?.blocks[block.id] ?? estimateBlockHeightMm(block, rubrics, pendings, observations);
      // Salta de hoja si se pidió o si no entra, salvo que la hoja actual esté vacía.
      const pageIsEmpty = availableHeightMm >= pageCapacityMm(currentPage);
      if (!pageIsEmpty && (block.forceNewPage || blockH > availableHeightMm)) {
        currentPage++;
        availableHeightMm = pageCapacityMm(currentPage);
      }
      effectiveBlocks.push({ ...block, pageIndex: currentPage });
      availableHeightMm -= blockH;
    }
  }

  const maxBlockPage = Math.max(
    0,
    ...effectiveBlocks.filter((b) => b.enabled).map((b) => b.pageIndex),
    ...Object.values(textParts).map((ps) => ps[ps.length - 1].page)
  );

  const totalRequiredPages = Math.max(1, maxPhotoPage + 1, maxBlockPage + 1);

  return {
    pagePhotosMap: globalPagePhotosMap,
    blockPhotoPagesMap,
    totalRequiredPhotoPages: maxPhotoPage + 1,
    effectiveBlocks,
    totalRequiredPages,
    textParts,
  };
}
