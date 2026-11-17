import React, { useRef, useEffect, useState } from 'react';
import { pageHmm, pageLabel, getPageSetup } from '../utils/pageSetup';
import {
  ProjectData,
  RubricItem,
  PendingItem,
  PhotoItem,
  ObservationsData,
  BlockConfig,
  BlockId,
  BlockType,
} from '../types';
import { HeaderBlock, InlineText } from './blocks/HeaderBlock';
import { CoverBlock } from './blocks/CoverBlock';
import { TocBlock, buildToc } from './blocks/TocBlock';
import { HtmlBlock } from './blocks/HtmlBlock';
import { DiagramBlock } from './blocks/DiagramBlock';
import { GanttBlock } from './blocks/GanttBlock';
import { MapBlock } from './blocks/MapBlock';
import { RefsContext, buildRefIndex, buildRefCatalog, setRefCatalog } from '../utils/refs';
import { normalizeHeader, resolveHeaderText } from '../utils/header';
import { ContractMetricsBlock } from './blocks/ContractMetricsBlock';
import { SituationBlock } from './blocks/SituationBlock';
import { PendingBoxBlock } from './blocks/PendingBoxBlock';
import { PhotosBlock } from './blocks/PhotosBlock';
import { ObservationsBlock } from './blocks/ObservationsBlock';
import { TextBlock } from './blocks/TextBlock';
import { SpecsBlock } from './blocks/SpecsBlock';
import { SignaturesBlock } from './blocks/SignaturesBlock';
import { SCurveBlock } from './blocks/SCurveBlock';
import { WeatherBlock } from './blocks/WeatherBlock';
import { DocumentBlock } from './blocks/DocumentBlock';
import { EditDock, DockButton, DockGroup, DockSegmented, DockSlider, DockCheck } from './EditDock';
import { EditableCell, selectAllText } from './table/NotionTable';
import { InSituBlockDivider, ColumnAdder } from './InSituBlockDivider';
import { groupRows, canBeColumn, MAX_COLUMNS, rowMap } from '../utils/rows';
import { PhotoAnnotationsOverlay } from './PhotoAnnotationsOverlay';
import { distributePhotosAcrossPages, TextPart } from '../utils/photoPagination';
import { parseCSV } from '@/src/utils/csv';
import '../theme/report-theme.css';
import './ui-kit.css';
import { computePhotoLabels, stripManualNumber, stripLeadNumber, effectivePrefix, PHOTO_PREFIX_SUGGESTIONS } from '../utils/photoNumbering';

import {
  ArrowUp,
  ArrowDown,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Move,
  CornerDownRight,
  Pencil,
  Trash2,
  Plus,
  X,
  Check,
  GripVertical,
  Maximize2,
  Upload,
  ArrowUpDown,
  ClipboardPaste,
  ChevronLeft,
  ChevronRight,
  Rows3,
  Columns2,
} from 'lucide-react';

interface ReportSheetProps {
  pageIndex: number;
  totalPages: number;
  blocks: BlockConfig[];
  projectData: ProjectData;
  rubrics: RubricItem[];
  pendings: PendingItem[];
  photos: PhotoItem[];
  observations: ObservationsData;
  photoColumns: 1 | 2 | 3 | 4;
  photoHeightMm: number;
  inlineEditingBlockId: BlockId | null;
  onSetInlineEditingBlockId: (id: BlockId | null) => void;
  selectedRubricIds: string[];
  onSetSelectedRubricIds: (ids: string[]) => void;
  onUpdateProjectData: (patch: Partial<ProjectData>) => void;
  onUpdateRubrics: (rubrics: RubricItem[]) => void;
  onUpdatePendings: (pendings: PendingItem[]) => void;
  onUpdatePhotos: (photos: PhotoItem[]) => void;
  onUpdateObservations: (patch: Partial<ObservationsData>) => void;
  onMoveBlockOrder: (blockId: BlockId, direction: 'up' | 'down') => void;
  onMoveBlockPage: (blockId: BlockId, targetPageIndex: number) => void;
  onToggleForcePageBreak: (blockId: BlockId) => void;
  onUpdatePhotoFit?: (id: string, fit: 'cover' | 'contain') => void;
  onUpdatePhotoPosition?: (id: string, position: string) => void;
  onUpdatePhotoField?: (id: string, patch: Partial<PhotoItem>) => void;
  onOpenFreeFraming?: (photo: PhotoItem) => void;
  onOpenAnnotate?: (photo: PhotoItem) => void;
  onUpdatePhotoSettings?: (columns: 1 | 2 | 3 | 4, heightMm: number) => void;
  pagePhotosMap?: Record<number, PhotoItem[]>;
  /** Reparto de fotos por bloque y por hoja, calculado una sola vez en App. */
  photoPagesByBlock?: Record<string, Record<number, PhotoItem[]>>;
  /** Bloques de texto repartidos en varias hojas (ver distributePhotosAcrossPages). */
  textParts?: Record<string, TextPart[]>;
  /** Corta un bloque de texto en dos en el cursor. */
  onSplitTextBlock?: (blockId: string, before: string, after: string) => void;
  onTogglePhotoBreak?: (photoId: string) => void;
  onInsertBlock?: (pageIndex: number, targetOrder: number, type: BlockType, afterBlockId?: string) => void;
  onDeleteBlock?: (blockId: string) => void;
  onRequestDeleteBlock?: (blockId: string) => void;
  onUpdateBlockConfig?: (blockId: string, patch: Partial<BlockConfig>) => void;
  /** Columnas: poner un módulo nuevo al lado de otro, moverlo dentro de la fila o sacarlo */
  onInsertColumn?: (targetId: string, side: 'left' | 'right', type: BlockType) => void;
  onMoveColumn?: (blockId: string, dir: 'left' | 'right') => void;
  onUnlinkColumn?: (blockId: string) => void;
}


export const ReportSheet: React.FC<ReportSheetProps> = ({
  pageIndex,
  totalPages,
  blocks,
  projectData,
  rubrics,
  pendings,
  photos,
  observations,
  photoColumns,
  photoHeightMm,
  inlineEditingBlockId,
  onSetInlineEditingBlockId,
  selectedRubricIds,
  onSetSelectedRubricIds,
  onUpdateProjectData,
  onUpdateRubrics,
  onUpdatePendings,
  onUpdatePhotos,
  onUpdateObservations,
  onMoveBlockOrder,
  onMoveBlockPage,
  onToggleForcePageBreak,
  onUpdatePhotoFit,
  onUpdatePhotoPosition,
  onUpdatePhotoField,
  onOpenFreeFraming,
  onOpenAnnotate,
  onUpdatePhotoSettings,
  pagePhotosMap: propsPagePhotosMap,
  photoPagesByBlock,
  textParts,
  onSplitTextBlock,
  onTogglePhotoBreak,
  onInsertBlock,
  onDeleteBlock,
  onRequestDeleteBlock,
  onUpdateBlockConfig,
  onInsertColumn,
  onMoveColumn,
  onUnlinkColumn,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeightMm, setContentHeightMm] = useState<number>(0);
  const [isOverflowing, setIsOverflowing] = useState<boolean>(false);

  // Measure content height in mm (1mm = 3.7795px at standard 96dpi)
  useEffect(() => {
    if (!contentRef.current) return;
    const pxHeight = contentRef.current.scrollHeight;
    const mmHeight = Math.round(pxHeight / 3.7795);
    setContentHeightMm(mmHeight);
    // Alto de la hoja elegida (297 mm en A4 vertical)
    setIsOverflowing(mmHeight > pageHmm() + 0.5);
  }, [
    blocks,
    rubrics,
    pendings,
    photos,
    observations,
    projectData,
    photoColumns,
    photoHeightMm,
  ]);

  // Dynamic multi-block photo distribution across pages
  const distributionResult = React.useMemo(() => {
    // Antes, al recibir el mapa global se descartaba el reparto por bloque y cada bloque
    // dibujaba TODAS sus fotos en su primera hoja (quedaban cortadas bajo la hoja).
    if (propsPagePhotosMap && photoPagesByBlock) {
      return { pagePhotosMap: propsPagePhotosMap, blockPhotoPagesMap: photoPagesByBlock };
    }
    return distributePhotosAcrossPages(
      photos,
      blocks,
      rubrics,
      pendings,
      observations,
      photoColumns,
      photoHeightMm
    );
  }, [propsPagePhotosMap, photoPagesByBlock, photos, blocks, rubrics, pendings, observations, photoColumns, photoHeightMm]);

  const { pagePhotosMap, blockPhotoPagesMap } = distributionResult;
  const allTextParts: Record<string, TextPart[]> | undefined =
    textParts ?? (distributionResult as { textParts?: Record<string, TextPart[]> }).textParts;
  const photoBlocks = blocks.filter((b) => b.type === 'photos' && b.enabled);
  const continuationPhotoBlocksOnThisPage = photoBlocks.filter(
    (b) => b.pageIndex !== pageIndex && blockPhotoPagesMap?.[b.id]?.[pageIndex]?.length > 0
  );
  // Tramos de bloques de texto que siguen en esta hoja (no se muestran mientras se edita:
  // el editor tiene todo el texto junto, en la hoja donde empieza el bloque)
  const continuationTextOnThisPage = blocks
    .filter((b) => (b.type === 'text' || b.type === 'gantt') && b.enabled && b.pageIndex !== pageIndex && b.id !== inlineEditingBlockId)
    .map((b) => ({ block: b, idx: allTextParts?.[b.id]?.findIndex((p) => p.page === pageIndex) ?? -1 }))
    .filter((x) => x.idx > 0);
  const textPartOf = (b: BlockConfig) => {
    const parts = allTextParts?.[b.id];
    if (!parts || b.id === inlineEditingBlockId) return undefined;
    const idx = parts.findIndex((p) => p.page === pageIndex);
    return idx < 0 ? undefined : { ...parts[idx], index: idx, count: parts.length };
  };

  // Helper to compute sequential 1-based number index for blocks with visible titles
  // Numeración global de fotos ("Foto 01"…), recalculada ante cualquier cambio de orden
  const photoLabels = React.useMemo(() => computePhotoLabels(blocks), [blocks]);

  /* Al empezar a editar un bloque cuya numeración salió de los pies ("Foto 01: …"
     escrito a mano), se fija ese prefijo en «Numerar como» y se limpian los números
     escritos: desde ahí la numeración es automática y no se rompe al editar. */
  React.useEffect(() => {
    const b = blocks.find((x) => x.id === inlineEditingBlockId);
    if (!b || b.pageIndex !== pageIndex || (b.type !== 'photos' && b.type !== 'document')) return;
    const own = (b.type === 'photos' ? b.photoPrefix : b.docPrefix) || '';
    const inferred = effectivePrefix(b);
    if (own.trim() || !inferred) return;
    if (b.type === 'photos') {
      onUpdateBlockConfig?.(b.id, { photoPrefix: inferred, photos: (b.photos || []).map((p) => ({ ...p, caption: stripLeadNumber(p.caption || '') })) });
    } else {
      onUpdateBlockConfig?.(b.id, { docPrefix: inferred, docItems: (b.docItems || []).map((d) => ({ ...d, caption: stripLeadNumber(d.caption || '') })) });
    }
  }, [inlineEditingBlockId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Rubros que usan cronograma, HTML e indicadores: los de la primera tabla de rubros (o los generales)
  const sheetRubrics = React.useMemo(
    () => blocks.find((b) => b.enabled && b.type === 'situation')?.rubricsItems ?? rubrics,
    [blocks, rubrics],
  );
  const rowsById = React.useMemo(() => rowMap(blocks), [blocks]);
  // Referencias @nombre → "Foto 03" / "Tabla 2" (ver utils/refs)
  const refIndex = React.useMemo(() => {
    const idx = buildRefIndex(blocks, observations?.notes || '');
    // Lista de lo que se puede citar con el botón "Referencia" del editor de texto
    setRefCatalog(buildRefCatalog(blocks, idx, observations?.notes || ''));
    return idx;
  }, [blocks, observations]);

  const getBlockNumberIndex = (targetBlockId: string): number => {
    const enabledBlocks = blocks
      .filter((b) => b.enabled && b.showTitle !== false && b.type !== 'toc' && b.type !== 'cover')
      .sort((a, b) => {
        if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
        return a.order - b.order;
      });
    const foundIdx = enabledBlocks.findIndex((b) => b.id === targetBlockId);
    return foundIdx !== -1 ? foundIdx + 1 : 1;
  };

  // Filter and sort blocks belonging to this page
  const pageBlocks = blocks
    .filter((b) => b.enabled && b.pageIndex === pageIndex)
    .sort((a, b) => a.order - b.order);
  // Portada: ocupa su hoja entera, sin encabezado ni pie, y no cuenta en la numeración
  const isCoverPage = pageBlocks.some((b) => b.type === 'cover');
  const coverOffset = blocks.some((b) => b.enabled && b.type === 'cover') ? 1 : 0;
  const shownPage = pageIndex + 1 - coverOffset;
  const shownTotal = Math.max(1, totalPages - coverOffset);

  // Si un bloque de esta hoja está en edición, la hoja deja de recortar su contenido
  // y se eleva por encima de las demás hojas para que el editor nunca quede oculto.
  const pageIsEditing =
    !!inlineEditingBlockId &&
    (pageBlocks.some((b) => b.id === inlineEditingBlockId) ||
      continuationPhotoBlocksOnThisPage.some((b) => b.id === inlineEditingBlockId));

  /* ---------- Barra de acciones del bloque (subir, bajar, hoja, editar…) ----------
     Vive FUERA de la hoja, a la derecha del bloque señalado, para no tapar nada editable.
     Si no hay lugar a la derecha (pantalla angosta), se ubica como columna fina dentro del borde. */
  const wrapperRef = useRef<HTMLDivElement>(null);
  const railTimer = useRef<number | null>(null);
  const [rail, setRail] = useState<{ id: string; top: number; inside: boolean } | null>(null);

  const showRail = (id: string, el: HTMLElement) => {
    if (railTimer.current) { window.clearTimeout(railTimer.current); railTimer.current = null; }
    if (id === inlineEditingBlockId) { setRail(null); return; }
    const wrap = wrapperRef.current;
    if (!wrap) return;
    const wr = wrap.getBoundingClientRect();
    const br = el.getBoundingClientRect();
    const scale = wrap.offsetWidth ? wr.width / wrap.offsetWidth : 1;
    // Si el bloque empieza por encima de la pantalla, la barra baja hasta quedar visible
    const visibleTop = Math.max(br.top, 72);
    const maxTop = Math.max(br.top, br.bottom - 230 * scale);
    const top = (Math.min(visibleTop, maxTop) - wr.top) / scale;
    const sheetRight = wr.left + wr.width / 2 + (105 * 96 / 25.4) * scale;
    const inside = sheetRight + 52 * scale > window.innerWidth - 8;
    setRail({ id, top, inside });
  };
  const hideRailSoon = () => {
    if (railTimer.current) window.clearTimeout(railTimer.current);
    railTimer.current = window.setTimeout(() => setRail(null), 260);
  };
  const keepRail = () => {
    if (railTimer.current) { window.clearTimeout(railTimer.current); railTimer.current = null; }
  };
  useEffect(() => { if (rail && rail.id === inlineEditingBlockId) setRail(null); }, [inlineEditingBlockId, rail]);
  useEffect(() => () => { if (railTimer.current) window.clearTimeout(railTimer.current); }, []);

  const renderBlockRail = () => {
    if (!rail) return null;
    const idx = pageBlocks.findIndex((b) => b.id === rail.id);
    const block = pageBlocks[idx];
    if (!block) return null;
    const isFirst = idx === 0;
    const isLast = idx === pageBlocks.length - 1;
    const btn = 'ui-tb';
    return (
      <div
        className="block-rail no-print ui-glass is-vertical absolute z-[70]"
        style={{
          top: rail.top,
          left: rail.inside ? 'calc(50% + 105mm - 40px)' : 'calc(50% + 105mm + 8px)',
        }}
        onMouseEnter={keepRail}
        onMouseLeave={hideRailSoon}
        title={block.title.replace(/^\d+\.\s*/, '')}
      >
        <button type="button" className={`${btn} is-accent`}
          onClick={() => { setRail(null); onSetInlineEditingBlockId(block.id); }} title="Editar este bloque">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <span className="ui-tb-sep" />
        <button type="button" className={btn} disabled={isFirst && pageIndex === 0}
          onClick={() => onMoveBlockOrder(block.id, 'up')} title="Subir bloque">
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
        <button type="button" className={btn} disabled={isLast && pageIndex === totalPages - 1}
          onClick={() => onMoveBlockOrder(block.id, 'down')} title="Bajar bloque">
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
        {(() => {
          // En una fila de columnas: mover a izquierda / derecha y sacarlo de la fila
          const row = rowsById.get(block.id);
          if (!row) return null;
          const k = row.findIndex((b) => b.id === block.id);
          return (
            <>
              <span className="ui-tb-sep" />
              <button type="button" className={btn} disabled={k === 0} onClick={() => onMoveColumn?.(block.id, 'left')} title="Pasar a la columna de la izquierda">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button type="button" className={btn} disabled={k === row.length - 1} onClick={() => onMoveColumn?.(block.id, 'right')} title="Pasar a la columna de la derecha">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button type="button" className={btn} onClick={() => { setRail(null); onUnlinkColumn?.(block.id); }} title="Sacar de la fila: vuelve a ocupar todo el ancho, debajo">
                <Rows3 className="w-3.5 h-3.5" />
              </button>
              <span className="ui-tb-sep" />
            </>
          );
        })()}
        {pageIndex > 0 && (
          <button type="button" className={`${btn} rail-page`}
            onClick={() => onMoveBlockPage(block.id, pageIndex - 1)} title={`Enviar a la hoja ${pageIndex}`}>
            <ArrowLeft className="w-3 h-3" /><span className="text-[7px] font-bold">H{pageIndex}</span>
          </button>
        )}
        <button type="button" className={`${btn} rail-page`}
          onClick={() => onMoveBlockPage(block.id, pageIndex + 1)} title={`Mover a la hoja ${pageIndex + 2}`}>
          <ArrowRight className="w-3 h-3" /><span className="text-[7px] font-bold">H{pageIndex + 2}</span>
        </button>
        <button type="button"
          className={`${btn}${block.forceNewPage ? ' on' : ''}`}
          onClick={() => onToggleForcePageBreak(block.id)}
          title={block.forceNewPage ? 'Quitar salto de hoja' : 'Empezar este bloque en hoja nueva'}>
          <CornerDownRight className="w-3.5 h-3.5" />
        </button>
        {(onRequestDeleteBlock || onDeleteBlock) && block.id !== 'header' && block.id !== 'footer' && (
          <span className="ui-tb-sep" />
        )}
        {(onRequestDeleteBlock || onDeleteBlock) && block.id !== 'header' && block.id !== 'footer' && (
          <button type="button" className={`${btn} is-danger`}
            onClick={() => { setRail(null); if (onRequestDeleteBlock) onRequestDeleteBlock(block.id); else onDeleteBlock?.(block.id); }}
            title="Eliminar este bloque del informe">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  };

  const handleMovePhoto = (photoId: string, direction: 'left' | 'right') => {
    const idx = photos.findIndex((p) => p.id === photoId);
    if (idx === -1) return;
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= photos.length) return;
    const copy = [...photos];
    const [moved] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, moved);
    onUpdatePhotos(copy);
  };

  const renderBlockContent = (block: BlockConfig) => {
    const numIdx = block.enabled && block.showTitle !== false ? getBlockNumberIndex(block.id) : null;
    const showT = block.showTitle ?? true;

    switch (block.type) {
      case 'header':
        return <HeaderBlock data={projectData} totalPages={shownTotal} isEditing={inlineEditingBlockId === block.id} onUpdateProjectData={onUpdateProjectData} />;
      case 'cover':
        return (
          <CoverBlock
            block={block}
            data={projectData}
            isEditing={inlineEditingBlockId === block.id}
            onUpdateConfig={(patch) => onUpdateBlockConfig?.(block.id, patch)}
          />
        );
      case 'gantt':
        return (
          <GanttBlock
            block={block}
            data={projectData}
            rubrics={sheetRubrics}
            numberIndex={numIdx}
            label={(block.ganttPrefix || '').trim() ? photoLabels[block.id] : undefined}
            part={textPartOf(block)}
            isEditing={inlineEditingBlockId === block.id}
            onUpdateConfig={(patch) => onUpdateBlockConfig?.(block.id, patch)}
            onStartEditing={() => onSetInlineEditingBlockId(block.id)}
          />
        );
      case 'map':
        return (
          <MapBlock
            block={block}
            data={projectData}
            numberIndex={numIdx}
            label={(block.mapPrefix || '').trim() ? photoLabels[block.id] : undefined}
            isEditing={inlineEditingBlockId === block.id}
            onUpdateConfig={(patch) => onUpdateBlockConfig?.(block.id, patch)}
            onUpdateProjectData={onUpdateProjectData}
            onStartEditing={() => onSetInlineEditingBlockId(block.id)}
          />
        );
      case 'diagram':
        return (
          <DiagramBlock
            block={block}
            numberIndex={numIdx}
            label={(block.diagramPrefix || '').trim() ? photoLabels[block.id] : undefined}
            isEditing={inlineEditingBlockId === block.id}
            onUpdateConfig={(patch) => onUpdateBlockConfig?.(block.id, patch)}
            onStartEditing={() => onSetInlineEditingBlockId(block.id)}
          />
        );
      case 'html':
        return (
          <HtmlBlock
            block={block}
            data={projectData}
            onUpdateProjectData={onUpdateProjectData}
            rubrics={sheetRubrics}
            numberIndex={numIdx}
            label={(block.htmlPrefix || '').trim() ? photoLabels[block.id] : undefined}
            isEditing={inlineEditingBlockId === block.id}
            onUpdateConfig={(patch) => onUpdateBlockConfig?.(block.id, patch)}
            onStartEditing={() => onSetInlineEditingBlockId(block.id)}
          />
        );
      case 'toc':
        return (
          <TocBlock
            block={block}
            entries={buildToc(blocks, (id) => {
              const b = blocks.find((x) => x.id === id);
              return b && b.showTitle !== false ? getBlockNumberIndex(id) : null;
            }, allTextParts, coverOffset, block.tocHeadings !== false)}
            isEditing={inlineEditingBlockId === block.id}
            onUpdateConfig={(patch) => onUpdateBlockConfig?.(block.id, patch)}
            onStartEditing={() => onSetInlineEditingBlockId(block.id)}
          />
        );
      case 'contract_metrics':
        return (
          <ContractMetricsBlock
            data={projectData}
            block={block}
            rubrics={sheetRubrics}
            isEditing={inlineEditingBlockId === block.id}
            onUpdateProjectData={onUpdateProjectData}
            onUpdateConfig={(patch) => onUpdateBlockConfig?.(block.id, patch)}
            onStartEditing={() => onSetInlineEditingBlockId(block.id)}
          />
        );
      case 'situation': {
        const blockRubrics = block.rubricsItems ?? rubrics;
        return (
          <SituationBlock
            rubrics={blockRubrics}
            title={block.title}
            numberIndex={numIdx}
            showTitle={showT}
            isEditing={inlineEditingBlockId === block.id}
            onUpdateTitle={(t) => onUpdateBlockConfig?.(block.id, { title: t })}
            onToggleShowTitle={() =>
              onUpdateBlockConfig?.(block.id, { showTitle: !showT })
            }
            hideZero={!!block.hideZeroRubrics}
            onToggleHideZero={() => onUpdateBlockConfig?.(block.id, { hideZeroRubrics: !block.hideZeroRubrics })}
            onUpdateRubrics={(newRubrics) => {
              onUpdateBlockConfig?.(block.id, { rubricsItems: newRubrics });
              onUpdateRubrics(newRubrics);
            }}
            onStartEditing={() => onSetInlineEditingBlockId(block.id)}
          />
        );
      }

      case 'pending': {
        const blockPendings = block.pendingsItems ?? pendings;
        return (
          <PendingBoxBlock
            pendings={blockPendings}
            title={block.title}
            numberIndex={numIdx}
            showTitle={showT}
            isEditing={inlineEditingBlockId === block.id}
            onUpdateTitle={(t) => onUpdateBlockConfig?.(block.id, { title: t })}
            onToggleShowTitle={() =>
              onUpdateBlockConfig?.(block.id, { showTitle: !showT })
            }
            onUpdatePendings={(newPendings) => {
              onUpdateBlockConfig?.(block.id, { pendingsItems: newPendings });
              onUpdatePendings(newPendings);
            }}
            onStartEditing={() => onSetInlineEditingBlockId(block.id)}
          />
        );
      }

      case 'photos': {
        // Solo las fotos que el paginador asignó a ESTA hoja; el resto se dibuja en las siguientes.
        const blockPhotoList = blockPhotoPagesMap?.[block.id]?.[pageIndex] ?? [];
        const blockCols = block.photoColumns ?? photoColumns;
        const blockHeight = block.photoHeightMm ?? photoHeightMm;
        const isStartPage = block.pageIndex === pageIndex;
        const blockTitle = block.title || 'REGISTRO FOTOGRÁFICO';

        if (!isStartPage && blockPhotoList.length === 0) return null;

        return (
          <PhotosBlock
            photos={blockPhotoList}
            allPhotos={block.photos ?? []}
            photoLabels={effectivePrefix(block) ? photoLabels : undefined}
            continuation={!isStartPage}
            showContinuationTitle={block.showContinuationTitle !== false}
            columns={blockCols}
            heightMm={blockHeight}
            title={blockTitle}
            numberIndex={numIdx}
            showTitle={showT}
            isEditing={inlineEditingBlockId === block.id}
            onUpdateTitle={(t) => onUpdateBlockConfig?.(block.id, { title: t })}
            onToggleShowTitle={() =>
              onUpdateBlockConfig?.(block.id, { showTitle: !showT })
            }
            onUpdatePhotoFit={onUpdatePhotoFit}
            onUpdatePhotoPosition={onUpdatePhotoPosition}
            onUpdatePhotoField={(id, patch) => {
              if (block.photos !== undefined) {
                onUpdateBlockConfig?.(block.id, {
                  photos: block.photos.map((p) => (p.id === id ? { ...p, ...patch } : p)),
                });
              } else if (onUpdatePhotoField) {
                onUpdatePhotoField(id, patch);
              } else {
                onUpdatePhotos(photos.map((p) => (p.id === id ? { ...p, ...patch } : p)));
              }
            }}
            onUpdatePhotoCaption={(id, caption) => {
              if (block.photos !== undefined) {
                onUpdateBlockConfig?.(block.id, {
                  photos: block.photos.map((p) => (p.id === id ? { ...p, caption } : p)),
                });
              } else {
                onUpdatePhotos(photos.map((p) => (p.id === id ? { ...p, caption } : p)));
              }
            }}
            onDeletePhoto={(id) => {
              if (block.photos !== undefined) {
                onUpdateBlockConfig?.(block.id, {
                  photos: block.photos.filter((p) => p.id !== id),
                });
              } else {
                onUpdatePhotos(photos.filter((p) => p.id !== id));
              }
            }}
            onMovePhoto={(photoId, direction) => {
              const targetList = block.photos ?? photos;
              const idx = targetList.findIndex((p) => p.id === photoId);
              if (idx === -1) return;
              const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
              if (targetIdx < 0 || targetIdx >= targetList.length) return;
              const copy = [...targetList];
              const [moved] = copy.splice(idx, 1);
              copy.splice(targetIdx, 0, moved);
              if (block.photos !== undefined) {
                onUpdateBlockConfig?.(block.id, { photos: copy });
              } else {
                onUpdatePhotos(copy);
              }
            }}
            onReorderPhoto={(dragId, targetId, side) => {
              const list = [...(block.photos ?? [])];
              const from = list.findIndex((p) => p.id === dragId);
              if (from < 0) return;
              const [moved] = list.splice(from, 1);
              const to = list.findIndex((p) => p.id === targetId);
              if (to < 0) return;
              list.splice(side === 'before' ? to : to + 1, 0, moved);
              onUpdateBlockConfig?.(block.id, { photos: list });
            }}
            onToggleBreakAfter={onTogglePhotoBreak}
            onOpenFreeFraming={onOpenFreeFraming}
            onOpenAnnotate={onOpenAnnotate}
            onStartEditing={() => onSetInlineEditingBlockId(block.id)}
          />
        );
      }
      case 'text':
        return (
          <TextBlock
            blockId={block.id}
            title={block.title}
            numberIndex={block.enabled && block.showTitle !== false ? getBlockNumberIndex(block.id) : null}
            showTitle={block.showTitle ?? true}
            content={block.textContent}
            sizePt={block.textSizePt}
            onChangeSize={(pt) => onUpdateBlockConfig?.(block.id, { textSizePt: pt })}
            part={textPartOf(block)}
            isEditing={inlineEditingBlockId === block.id}
            onUpdateTitle={(t) => onUpdateBlockConfig?.(block.id, { title: t })}
            onToggleShowTitle={() =>
              onUpdateBlockConfig?.(block.id, { showTitle: !(block.showTitle ?? true) })
            }
            onUpdateContent={(c) => onUpdateBlockConfig?.(block.id, { textContent: c })}
            onSplit={onSplitTextBlock ? (a, b) => onSplitTextBlock(block.id, a, b) : undefined}
            onStartEditing={() => onSetInlineEditingBlockId(block.id)}
          />
        );
      case 'specs':
        return (
          <SpecsBlock
            blockId={block.id}
            title={block.title}
            numberIndex={numIdx}
            showTitle={showT}
            onToggleShowTitle={() => onUpdateBlockConfig?.(block.id, { showTitle: !showT })}
            items={block.specsItems}
            isEditing={inlineEditingBlockId === block.id}
            onUpdateTitle={(t) => onUpdateBlockConfig?.(block.id, { title: t })}
            onUpdateItems={(items) => onUpdateBlockConfig?.(block.id, { specsItems: items })}
            onStartEditing={() => onSetInlineEditingBlockId(block.id)}
          />
        );
      case 'signatures':
        return (
          <SignaturesBlock
            blockId={block.id}
            title={block.title}
            numberIndex={block.enabled && block.showTitle !== false ? getBlockNumberIndex(block.id) : null}
            showTitle={block.showTitle ?? true}
            items={block.signaturesItems}
            isEditing={inlineEditingBlockId === block.id}
            onUpdateTitle={(t) => onUpdateBlockConfig?.(block.id, { title: t })}
            onToggleShowTitle={() =>
              onUpdateBlockConfig?.(block.id, { showTitle: !(block.showTitle ?? true) })
            }
            onUpdateItems={(items) => onUpdateBlockConfig?.(block.id, { signaturesItems: items })}
            onStartEditing={() => onSetInlineEditingBlockId(block.id)}
          />
        );
      case 'scurve':
        return (
          <SCurveBlock
            blockId={block.id}
            title={block.title}
            numberIndex={block.enabled && block.showTitle !== false ? getBlockNumberIndex(block.id) : null}
            showTitle={block.showTitle ?? true}
            showIndicators={block.showIndicators ?? true}
            showTable={block.showTable ?? true}
            kpiVariant={block.kpiVariant ?? 'cards'}
            chartHeightMm={block.scurveChartHeightMm}
            data={block.scurveData}
            isEditing={inlineEditingBlockId === block.id}
            onUpdateTitle={(t) => onUpdateBlockConfig?.(block.id, { title: t })}
            onToggleShowTitle={() =>
              onUpdateBlockConfig?.(block.id, { showTitle: !(block.showTitle ?? true) })
            }
            onToggleShowIndicators={() => onUpdateBlockConfig?.(block.id, { showIndicators: !(block.showIndicators ?? true) })}
            onToggleShowTable={() => onUpdateBlockConfig?.(block.id, { showTable: !(block.showTable ?? true) })}
            onChangeKpiVariant={(v) => onUpdateBlockConfig?.(block.id, { kpiVariant: v })}
            onChangeChartHeight={(mm) => onUpdateBlockConfig?.(block.id, { scurveChartHeightMm: mm })}
            onUpdateData={(data) => onUpdateBlockConfig?.(block.id, { scurveData: data })}
            onStartEditing={() => onSetInlineEditingBlockId(block.id)}
          />
        );
      case 'observations':
        return (
          <ObservationsBlock
            data={block.obsNotes !== undefined ? { ...observations, notes: block.obsNotes } : observations}
            title={block.title}
            numberIndex={block.enabled && block.showTitle !== false ? getBlockNumberIndex(block.id) : null}
            showTitle={block.showTitle ?? true}
            isEditing={inlineEditingBlockId === block.id}
            onUpdateTitle={(t) => onUpdateBlockConfig?.(block.id, { title: t })}
            onToggleShowTitle={() =>
              onUpdateBlockConfig?.(block.id, { showTitle: !(block.showTitle ?? true) })
            }
            onUpdateObservations={(patch) =>
              block.obsNotes !== undefined
                ? onUpdateBlockConfig?.(block.id, { obsNotes: patch.notes ?? '' })
                : onUpdateObservations?.(patch)
            }
            obsStyle={block.obsStyle}
            obsLabel={block.obsLabel}
            obsAttribution={block.obsAttribution}
            onUpdateStyle={(patch) => onUpdateBlockConfig?.(block.id, patch)}
            onStartEditing={() => onSetInlineEditingBlockId(block.id)}
          />
        );
      case 'weather':
        return (
          <WeatherBlock
            blockId={block.id}
            title={block.title}
            numberIndex={block.enabled && block.showTitle !== false ? getBlockNumberIndex(block.id) : null}
            showTitle={block.showTitle ?? true}
            weatherMode={block.weatherMode}
            weatherDay={block.weatherDay}
            weatherWeek={block.weatherWeek}
            weatherDayStyle={block.weatherDayStyle}
            reportDate={projectData.reportDate}
            weekStart={block.weatherWeekStart}
            rainLevels={block.weatherRainLevels}
            location={block.weatherLocation}
            dataSource={block.weatherSource}
            weatherWeekStyle={block.weatherWeekStyle}
            isEditing={inlineEditingBlockId === block.id}
            onUpdateTitle={(t) => onUpdateBlockConfig?.(block.id, { title: t })}
            onToggleShowTitle={() =>
              onUpdateBlockConfig?.(block.id, { showTitle: !(block.showTitle ?? true) })
            }
            onUpdateConfig={(patch) => onUpdateBlockConfig?.(block.id, patch)}
            onStartEditing={() => onSetInlineEditingBlockId(block.id)}
          />
        );

      case 'document':
        return (
          <DocumentBlock
            title={block.title}
            numberIndex={block.enabled && block.showTitle !== false ? getBlockNumberIndex(block.id) : null}
            showTitle={block.showTitle ?? true}
            items={block.docItems ?? []}
            maxHeightMm={block.docMaxHeightMm ?? 150}
            showCaption={block.docShowCaption ?? false}
            prefix={effectivePrefix(block)}
            labels={effectivePrefix(block) ? photoLabels : undefined}
            isEditing={inlineEditingBlockId === block.id}
            onUpdateTitle={(t) => onUpdateBlockConfig?.(block.id, { title: t })}
            onToggleShowTitle={() =>
              onUpdateBlockConfig?.(block.id, { showTitle: !(block.showTitle ?? true) })
            }
            onUpdateItems={(items) => onUpdateBlockConfig?.(block.id, { docItems: items })}
            onChangeMaxHeight={(mm) => onUpdateBlockConfig?.(block.id, { docMaxHeightMm: mm })}
            onToggleCaption={() => onUpdateBlockConfig?.(block.id, { docShowCaption: !(block.docShowCaption ?? false) })}
            onChangePrefix={(prefix) => onUpdateBlockConfig?.(block.id, { docPrefix: prefix })}
            onStartEditing={() => onSetInlineEditingBlockId(block.id)}
          />
        );

      default:
        return null;
    }
  };

  const renderBlockEditingToolbar = (block: BlockConfig) => {
    const isPhotos = block.type === 'photos';

    const currentPhotos = block.photos ?? [];
    const currentCols = block.photoColumns ?? photoColumns;
    const currentHeight = block.photoHeightMm ?? photoHeightMm;

    return (
      <>
        {/* Opciones del bloque de fotos → panel flotante (no ocupan lugar en la hoja) */}
        {isPhotos && (
          <EditDock slot="options">
            <label className="dock-btn primary" style={{ cursor: 'pointer' }}>
              <Upload />
              <span>Agregar fotos</span>
              <input
                type="file"
                multiple
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const files = e.target.files;
                  if (!files || files.length === 0) return;
                  const sortedFiles = Array.from(files).sort((a, b) =>
                    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
                  );
                  Promise.all(
                    sortedFiles.map((file, idx) => new Promise<PhotoItem | null>((resolve) => {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const src = ev.target?.result as string;
                        if (!src) return resolve(null);
                        const rawName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
                        resolve({
                          id: `photo-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
                          src,
                          caption: rawName.charAt(0).toUpperCase() + rawName.slice(1),
                          objectFit: 'cover',
                          objectPosition: 'center',
                        });
                      };
                      reader.onerror = () => resolve(null);
                      reader.readAsDataURL(file);
                    }))
                  ).then((results) => {
                    const valid = results.filter((item): item is PhotoItem => item !== null);
                    if (valid.length > 0) onUpdateBlockConfig?.(block.id, { photos: [...(block.photos ?? []), ...valid] });
                  });
                  e.target.value = '';
                }}
              />
            </label>
            {/* Pegar del portapapeles (útil en iPad, donde ⌘V sin cuadro de texto no siempre llega) */}
            {typeof navigator !== 'undefined' && !!navigator.clipboard?.read && (
              <button
                type="button"
                className="dock-btn"
                title="Pegar una imagen copiada (también Ctrl/⌘ + V)"
                onClick={() => window.dispatchEvent(new Event('rp-paste-photos'))}
              >
                <ClipboardPaste />
                <span>Pegar foto</span>
              </button>
            )}

            <DockGroup label="Columnas">
              <DockSegmented
                value={currentCols}
                options={[1, 2, 3, 4].map((c) => ({ value: c as 1 | 2 | 3 | 4, label: String(c) }))}
                onChange={(col) => onUpdateBlockConfig?.(block.id, { photoColumns: col })}
              />
            </DockGroup>

            <DockSlider
              label="Alto fotos"
              value={currentHeight}
              min={30}
              max={120}
              step={1}
              unit="mm"
              onChange={(h) => onUpdateBlockConfig?.(block.id, { photoHeightMm: h })}
            />

            {currentPhotos.length > 1 && (
              <DockGroup label="Orden">
                <DockButton
                  onClick={() => onUpdateBlockConfig?.(block.id, { photos: [...currentPhotos].reverse() })}
                  title="Invertir el orden de las fotos de este bloque"
                >
                  <ArrowUpDown /> Invertir
                </DockButton>
                <DockButton
                  onClick={() => onUpdateBlockConfig?.(block.id, {
                    photos: [...currentPhotos].sort((a, b) =>
                      (a.caption || '').localeCompare(b.caption || '', undefined, { numeric: true, sensitivity: 'base' })
                    ),
                  })}
                  title="Ordenar fotos por pie de foto (A-Z)"
                >
                  A-Z
                </DockButton>
              </DockGroup>
            )}

            <label className="dock-group" title="Numera solas las fotos de todo el informe: Foto 01, Foto 02… Dejalo vacío para no numerar.">
              <span className="dock-label">Numerar como</span>
              <input
                type="text"
                list="photo-prefix-suggestions"
                value={block.photoPrefix ?? ''}
                placeholder="sin numerar"
                onChange={(e) => {
                  const prefix = e.target.value;
                  const wasEmpty = !(block.photoPrefix || '').trim();
                  // Al activar la numeración, se limpian los números escritos a mano en los pies
                  if (wasEmpty && prefix.trim()) {
                    onUpdateBlockConfig?.(block.id, {
                      photoPrefix: prefix,
                      photos: currentPhotos.map((p) => ({ ...p, caption: stripManualNumber(p.caption || '', prefix) })),
                    });
                  } else {
                    onUpdateBlockConfig?.(block.id, { photoPrefix: prefix });
                  }
                }}
                className="dock-input"
              />
              <datalist id="photo-prefix-suggestions">
                {PHOTO_PREFIX_SUGGESTIONS.map((x) => <option key={x} value={x} />)}
              </datalist>
            </label>

            <DockCheck
              label="Título en hojas de continuación"
              checked={block.showContinuationTitle !== false}
              onChange={() => onUpdateBlockConfig?.(block.id, { showContinuationTitle: block.showContinuationTitle === false })}
            />

            <span className="dock-label">
              {currentPhotos.length} foto{currentPhotos.length === 1 ? '' : 's'}
              {Object.keys(blockPhotoPagesMap?.[block.id] ?? {}).length > 1
                ? ` · en ${Object.keys(blockPhotoPagesMap?.[block.id] ?? {}).length} hojas`
                : ''}
            </span>
          </EditDock>
        )}

        {/* Barra principal del panel flotante: qué se edita, mostrar título, eliminar y listo */}
        <EditDock slot="main">
          <span className="dock-title">
            <span className="dock-title-ic"><Pencil /></span>
            <span>Editando: {block.title}</span>
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {block.type !== 'header' && block.type !== 'footer' && block.type !== 'contract_metrics' && (
              <button
                type="button"
                onClick={() => onUpdateBlockConfig?.(block.id, { showTitle: !(block.showTitle ?? true) })}
                className={`dock-btn ghost${(block.showTitle ?? true) ? ' on' : ''}`}
                title="Mostrar u ocultar el título de la sección"
              >
                Título
              </button>
            )}
            {rowsById.get(block.id) && (
              <span className="dock-group" title="Ancho de esta columna respecto de las otras de la fila">
                <Columns2 className="w-3 h-3" />
                <DockSegmented
                  value={block.colWeight || 1}
                  options={[1, 1.5, 2, 3].map((w) => ({ value: w, label: `${String(w).replace('.', ',')}×` }))}
                  onChange={(w) => onUpdateBlockConfig?.(block.id, { colWeight: w })}
                />
              </span>
            )}
            <button
              type="button"
              onClick={() => onToggleForcePageBreak(block.id)}
              className={`dock-btn ghost${block.forceNewPage ? ' on' : ''}`}
              title="Hace que este bloque empiece en una hoja nueva"
            >
              <CornerDownRight />
              <span>Hoja nueva</span>
            </button>
          {/* Delete Block option */}
          {(onRequestDeleteBlock || onDeleteBlock) && block.id !== 'header' && block.id !== 'footer' && (
            <button
              type="button"
              onClick={() => {
                if (onRequestDeleteBlock) {
                  onRequestDeleteBlock(block.id);
                } else if (onDeleteBlock) {
                  onDeleteBlock(block.id);
                  onSetInlineEditingBlockId(null);
                }
              }}
              className="dock-btn danger"
              title="Eliminar este bloque del informe"
            >
              <Trash2 className="w-3 h-3" />
              <span>Eliminar Bloque</span>
            </button>
          )}

          {/* Close / Done Button */}
          <button
            type="button"
            onClick={() => onSetInlineEditingBlockId(null)}
            className="dock-btn accent"
            title="Finalizar edición y ocultar herramientas"
          >
            <Check className="w-3 h-3 font-bold" />
            <span>Listo</span>
          </button>
          </div>
        </EditDock>
      </>
    );
  };


  return (
    <RefsContext.Provider value={refIndex}>
    <div
      ref={wrapperRef}
      className={`sheet-page-wrapper relative flex flex-col items-center mb-8 last:mb-2 print:m-0 print:p-0 print:block print:overflow-hidden ${
        pageIsEditing ? 'z-40' : rail ? 'z-10' : 'z-0'
      }`}
    >
      {/* Page indicator & toolbar above sheet (Screen Only) */}
      <div style={{ width: 'var(--rp-page-w, 210mm)' }} className="flex items-center justify-between pb-2 text-xs text-slate-500 font-medium no-print">
        <div className="flex items-center gap-2">
          <span className="bg-slate-800 text-white font-bold px-2.5 py-0.5 rounded text-[11px] shadow-xs">
            Hoja {pageIndex + 1} de {totalPages}
          </span>
          <span className="text-slate-400">· {pageLabel(getPageSetup())}</span>
          {pageBlocks.length > 0 && (
            <span className="text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded text-[10px]">
              {pageBlocks.length} {pageBlocks.length === 1 ? 'bloque' : 'bloques'}
            </span>
          )}
        </div>

        {/* Height calculation info */}
        <div className="flex items-center gap-2 text-[11px]">
          {isOverflowing ? (
            <div className="flex items-center gap-1.5 text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200 font-semibold animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>
                Exceso de altura: ~{contentHeightMm}mm / {Math.round(pageHmm())}mm
              </span>
            </div>
          ) : (
            <span className="text-slate-500">
              Altura estimada: ~{contentHeightMm}mm de {Math.round(pageHmm())}mm ({Math.min(100, Math.round((contentHeightMm / pageHmm()) * 100))}%)
            </span>
          )}
        </div>
      </div>

      {/* Physical A4 Sheet Container */}
      <div
        className={`a4-sheet relative bg-white border border-slate-300 shadow-xl transition-all ${
          isOverflowing ? 'ring-2 ring-rose-400/80' : ''
        }`}
        style={pageIsEditing ? { overflow: 'visible' } : undefined}
      >
        {/* Línea de corte A4: solo cuando la hoja se pasa de largo (si no, coincide con el borde y tapa el pie) */}
        {isOverflowing && (
        <div style={{ top: 'var(--rp-page-h, 297mm)' }} className="absolute left-0 right-0 h-[1px] border-b-2 border-dashed border-rose-400 z-30 pointer-events-none no-print">
          <span className="absolute right-2 -top-4 text-[9px] bg-rose-600 text-white font-bold px-1.5 py-0.5 rounded shadow-xs">
            Límite de la hoja ({Math.round(pageHmm())} mm)
          </span>
        </div>
        )}

        {pageIndex > 0 && !isCoverPage && !pageBlocks.some((b) => b.id === 'header') && (
          <div className="rp-header-mini group relative bg-[var(--rp-primary)] text-white px-5 py-1.5 flex items-center justify-between text-[7.5pt] font-semibold border-b border-slate-200 shrink-0">
            <div className="no-print absolute top-0 right-1 z-20 hidden group-hover:flex items-center ui-glass is-sm">
              <button
                onClick={() => onSetInlineEditingBlockId('header')}
                title="Editar encabezado"
                className="ui-tb is-accent"
              >
                <Pencil className="w-3 h-3" />
                <span>Editar</span>
              </button>
            </div>
            {(() => {
              // Franja de las hojas siguientes: textos editables (con {campos}) desde el encabezado
              const hd = normalizeHeader(projectData.header);
              const ed = inlineEditingBlockId === 'header';
              const commit = (k: 'left' | 'center' | 'right') => (v: string) =>
                onUpdateProjectData?.({ header: { ...hd, strip: { ...hd.strip, [k]: v } } });
              const shown = (t: string) => resolveHeaderText(t, projectData, shownPage, shownTotal);
              return (
                <>
                  <InlineText value={hd.strip.left} shown={shown(hd.strip.left)} editing={ed} placeholder="izquierda"
                    className="rp-strip-left text-[var(--rp-accent)] font-bold tracking-wider uppercase" onCommit={commit('left')} />
                  <InlineText value={hd.strip.center} shown={shown(hd.strip.center)} editing={ed} placeholder="centro"
                    className="rp-strip-center text-slate-200 font-normal truncate max-w-[120mm]" onCommit={commit('center')} />
                  <InlineText value={hd.strip.right} shown={shown(hd.strip.right)} editing={ed} placeholder="derecha"
                    className="rp-strip-right text-white font-mono font-bold" onCommit={commit('right')} />
                </>
              );
            })()}
          </div>
        )}

        {/* Content area holding all blocks for this page */}
        <div
          ref={contentRef}
          className={`flex-1 flex flex-col justify-start print:overflow-visible ${
            pageIsEditing ? 'overflow-visible' : 'overflow-hidden'
          }`}
        >
          {/* Top In-Situ Block Divider (Above first block) */}
          {/* (no va si la hoja empieza con la continuación de un texto: se insertaría en medio de él) */}
          {onInsertBlock && pageBlocks.length > 0 && !isCoverPage && continuationTextOnThisPage.length === 0 && (
            <InSituBlockDivider
              pageIndex={pageIndex}
              insertOrder={pageBlocks[0]?.order ?? 0}
              onInsertBlock={onInsertBlock}
            />
          )}

          {/* Continuation photos blocks if divided across pages */}
          {continuationPhotoBlocksOnThisPage.map((pBlock) => (
            <React.Fragment key={`cont-${pBlock.id}`}>
              {renderBlockContent(pBlock)}
            </React.Fragment>
          ))}

          {/* Continuación de bloques de texto largos */}
          {continuationTextOnThisPage.map(({ block: tBlock, idx }) => (
            <div
              key={`cont-text-${tBlock.id}`}
              data-text-part={tBlock.type === 'text' ? `${tBlock.id}|${idx}` : undefined}
              data-block-type={tBlock.type}
              onDoubleClick={() => onSetInlineEditingBlockId(tBlock.id)}
              className={`rp-block rp-block-${tBlock.type} rp-block-cont group relative flow-root cursor-pointer`}
              title="Doble clic para editar este texto"
            >
              {renderBlockContent(tBlock)}
            </div>
          ))}
          {/* Insertar después del texto: va al pie de su último tramo */}
          {onInsertBlock &&
            continuationTextOnThisPage
              .filter(({ block: tBlock, idx }) => idx === (allTextParts?.[tBlock.id]?.length ?? 0) - 1)
              .map(({ block: tBlock }) => (
                <InSituBlockDivider
                  key={`cont-text-div-${tBlock.id}`}
                  pageIndex={pageIndex}
                  insertOrder={tBlock.order + 1}
                  afterBlockId={tBlock.id}
                  onInsertBlock={onInsertBlock}
                />
              ))}

          {pageBlocks.length === 0 && continuationPhotoBlocksOnThisPage.length === 0 && continuationTextOnThisPage.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 text-center">
              <Move className="w-8 h-8 mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">Hoja A4 Vacía</p>
              <p className="text-xs max-w-sm mt-1 text-slate-400 mb-4">
                Esta página no tiene bloques asignados. Puedes mover secciones aquí desde el editor o
                insertar un bloque nuevo en esta posición:
              </p>
              {onInsertBlock && (
                <div className="w-full max-w-xs">
                  <InSituBlockDivider
                    pageIndex={pageIndex}
                    insertOrder={0}
                    onInsertBlock={onInsertBlock}
                  />
                </div>
              )}
            </div>
          ) : (
            groupRows(pageBlocks).map((group) => {
              const last = group[group.length - 1];
              const inRow = group.length > 1;
              const shell = (block: BlockConfig) => {
                const colOk = !!onInsertColumn && canBeColumn(block) && !(inRow && group.length >= MAX_COLUMNS) && inlineEditingBlockId !== block.id;
                return (
                  <div
                    key={block.id}
                    onDoubleClick={() => onSetInlineEditingBlockId(block.id)}
                    data-measure-block={block.type !== 'photos' && !inRow ? block.id : undefined}
                    data-text-part={block.type === 'text' && !inRow ? `${block.id}|0` : undefined}
                    data-block-type={block.type}
                    onMouseEnter={(e) => showRail(block.id, e.currentTarget)}
                    onMouseLeave={hideRailSoon}
                    style={inRow ? { flexGrow: block.colWeight || 1 } : undefined}
                    className={`rp-block rp-block-${block.type}${inRow ? ' rp-col' : ''} group relative flow-root transition-all cursor-pointer ${block.type === 'cover' ? 'flex-1 min-h-0 flex flex-col ' : ''}${
                      inlineEditingBlockId === block.id
                        ? 'z-[60] ring-2 ring-[#0b455b] ring-offset-2 rounded-lg bg-white shadow-2xl'
                        : rail?.id === block.id
                          ? 'outline outline-1 outline-dashed outline-sky-400/70 -outline-offset-1 rounded-sm'
                          : ''
                    }`}
                    title="Doble clic para editar este bloque"
                  >
                    {inlineEditingBlockId === block.id && renderBlockEditingToolbar(block)}
                    {renderBlockContent(block)}
                    {/* Al acercarse al borde: "+" para poner otro módulo al lado */}
                    {colOk && <ColumnAdder side="left" onPick={(t) => onInsertColumn!(block.id, 'left', t)} />}
                    {colOk && <ColumnAdder side="right" onPick={(t) => onInsertColumn!(block.id, 'right', t)} />}
                  </div>
                );
              };

              return (
                <React.Fragment key={group[0].id}>
                  {inRow ? (
                    <div className="rp-row" data-measure-block={`row:${group[0].id}`}>
                      {group.map(shell)}
                    </div>
                  ) : (
                    shell(group[0])
                  )}

                  {/* In-situ Divider between and after blocks (un texto que sigue en otra hoja lo lleva al final de su último tramo) */}
                  {onInsertBlock && last.type !== 'cover' && !(!inRow && textPartOf(last) && textPartOf(last)!.index < textPartOf(last)!.count - 1) && (
                    <InSituBlockDivider
                      pageIndex={pageIndex}
                      insertOrder={last.order + 1}
                      afterBlockId={last.id}
                      onInsertBlock={onInsertBlock}
                    />
                  )}
                </React.Fragment>
              );
            })
          )}

        </div>

        {/* Page Footer (la portada no lleva) */}
        {!isCoverPage && (() => {
          // Pie de página: doble clic (o "Editar") lo vuelve editable ahí mismo
          const editingFooter = inlineEditingBlockId === 'footer';
          return (
            <footer
              className={`rp-footer nt-root group relative mt-auto px-6 py-2.5 border-t border-slate-200 text-slate-500 text-[7pt] flex justify-between items-center shrink-0 select-none bg-white${editingFooter ? ' nt-editing ring-2 ring-[#0b455b] ring-inset' : ''}`}
              onDoubleClick={(e) => {
                if (editingFooter) return;
                // Entra a editar y deja seleccionado el texto donde se hizo doble clic (se escribe encima)
                const cell = (e.target as Element).closest('.nt-cell') as HTMLElement | null;
                onSetInlineEditingBlockId('footer');
                setTimeout(() => { if (cell) { cell.focus(); selectAllText(cell); } }, 0);
              }}
              title={editingFooter ? undefined : 'Doble clic para editar el pie de página'}
            >
              {!editingFooter && (
                <div className="no-print absolute bottom-full mb-1 right-2 z-20 hidden group-hover:flex items-center ui-glass is-sm">
                  <button
                    onClick={() => onSetInlineEditingBlockId('footer')}
                    title="Editar pie de página"
                    className="ui-tb is-accent"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Editar</span>
                  </button>
                </div>
              )}
              <div className="flex items-center gap-3 min-w-0">
                <span className="rp-footer-left font-semibold text-slate-700">
                  <EditableCell value={editingFooter ? projectData.footerLeft || '' : resolveHeaderText(projectData.footerLeft || '', projectData, shownPage, shownTotal)} row={0} col={0} isEditing={editingFooter}
                    placeholder="Texto izquierdo" className="nt-inherit-lh nt-nowrap"
                    onCommit={(v) => onUpdateProjectData({ footerLeft: v })} />
                </span>
                <span>·</span>
                <span className="rp-footer-right">
                  <EditableCell value={editingFooter ? projectData.footerRight || '' : resolveHeaderText(projectData.footerRight || '', projectData, shownPage, shownTotal)} row={0} col={1} isEditing={editingFooter}
                    placeholder="Texto derecho" className="nt-inherit-lh nt-nowrap"
                    onCommit={(v) => onUpdateProjectData({ footerRight: v })} />
                </span>
              </div>
              {/* Partes separadas para que un tema pueda mostrar solo el número (.rp-footer-page-n) */}
              <div className="rp-footer-page font-mono font-bold text-slate-700">
                <span className="rp-footer-page-word">Página </span>
                <span className="rp-footer-page-n">{shownPage}</span>
                <span className="rp-footer-page-of"> de {shownTotal}</span>
              </div>
              {editingFooter && pageIndex === coverOffset && (
                <>
                  <EditDock slot="main">
                    <span className="dock-title">
                      <span className="dock-title-ic"><Pencil /></span>
                      <span>Editando: Pie de página (se repite en todas las hojas)</span>
                    </span>
                    <button type="button" onClick={() => onSetInlineEditingBlockId(null)} title="Finalizar edición"
                      className="bg-[#f4c84a] hover:bg-[#fed35b] text-[#0b455b] text-[10.5px] font-bold px-3 py-0.5 rounded flex items-center gap-1 shadow-sm transition-colors cursor-pointer">
                      <Check className="w-3 h-3 font-bold" /><span>Listo</span>
                    </button>
                  </EditDock>
                  <EditDock slot="hint">
                    <span>Clic en un texto para editarlo · Tab pasa al otro</span>
                    <span>Clic fuera de la hoja: guarda y cierra</span>
                  </EditDock>
                </>
              )}
            </footer>
          );
        })()}
      </div>

      {/* Overflow warning banner below sheet if needed */}
      {isOverflowing && (
        <div style={{ width: 'var(--rp-page-w, 210mm)' }} className="mt-2 p-2 bg-rose-50 border border-rose-300 rounded-lg flex items-center justify-between text-xs text-rose-800 no-print">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              Esta hoja está demasiado cargada y sobrepasa el largo de la hoja ({Math.round(pageHmm())} mm). Al imprimir se generará un corte inesperado.
            </span>
          </div>
          {pageBlocks.length > 1 && (
            <button
              onClick={() => onMoveBlockPage(pageBlocks[pageBlocks.length - 1].id, pageIndex + 1)}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold px-2.5 py-1 rounded text-xs transition-colors shrink-0 flex items-center gap-1"
            >
              <span>Mover &quot;{pageBlocks[pageBlocks.length - 1].title.replace(/^\d+\.\s*/, '')}&quot; a Hoja {pageIndex + 2}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Barra de acciones del bloque bajo el mouse (fuera de la hoja) */}
      {renderBlockRail()}
    </div>
    </RefsContext.Provider>
  );
};
