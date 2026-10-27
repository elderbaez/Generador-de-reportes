import React, { useRef, useEffect, useState } from 'react';
import {
  ProjectData,
  RubricItem,
  PendingItem,
  PhotoItem,
  ObservationsData,
  BlockConfig,
  BlockId,
} from '../types';
import { HeaderBlock } from './blocks/HeaderBlock';
import { ContractMetricsBlock } from './blocks/ContractMetricsBlock';
import { SituationBlock } from './blocks/SituationBlock';
import { PendingBoxBlock } from './blocks/PendingBoxBlock';
import { PhotosBlock } from './blocks/PhotosBlock';
import { ObservationsBlock } from './blocks/ObservationsBlock';
import {
  ArrowUp,
  ArrowDown,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Move,
  CornerDownRight,
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
  photosPage1Count?: number;
  onMoveBlockOrder: (blockId: BlockId, direction: 'up' | 'down') => void;
  onMoveBlockPage: (blockId: BlockId, targetPageIndex: number) => void;
  onToggleForcePageBreak: (blockId: BlockId) => void;
  isContinuousView?: boolean;
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
  photosPage1Count = 2,
  onMoveBlockOrder,
  onMoveBlockPage,
  onToggleForcePageBreak,
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
    // 297mm standard A4 height
    setIsOverflowing(mmHeight > 297);
  }, [
    blocks,
    rubrics,
    pendings,
    photos,
    observations,
    projectData,
    photoColumns,
    photoHeightMm,
    photosPage1Count,
  ]);

  // Photo split calculations between Page 1 and Page 2
  const isPage1 = pageIndex === 0;
  const isPage2 = pageIndex === 1;
  const photosBlock = blocks.find((b) => b.id === 'photos' && b.enabled);
  const photosAreOnPage1 = photosBlock && photosBlock.pageIndex === 0;

  const countOnP1 = Math.max(1, Math.min(photos.length, photosPage1Count));
  const page1PhotosList = photos.slice(0, countOnP1);
  const continuationPhotosList = photos.slice(countOnP1);

  let thisPagePhotos: PhotoItem[] = [];
  let thisPagePhotoTitle = 'REGISTRO FOTOGRÁFICO DE SITUACIÓN ACTUAL';

  if (isPage1 && photosAreOnPage1) {
    thisPagePhotos = page1PhotosList;
  } else if (isPage2 && photosAreOnPage1 && continuationPhotosList.length > 0) {
    thisPagePhotos = continuationPhotosList;
    thisPagePhotoTitle = 'REGISTRO FOTOGRÁFICO (CONTINUACIÓN)';
  } else if (photosBlock && photosBlock.pageIndex === pageIndex) {
    thisPagePhotos = photos;
  }

  const hasContinuationPhotosOnPage2 =
    isPage2 &&
    photosAreOnPage1 &&
    continuationPhotosList.length > 0 &&
    !blocks.some((b) => b.enabled && b.pageIndex === 1 && b.id === 'photos');

  // Filter and sort blocks belonging to this page
  const pageBlocks = blocks
    .filter((b) => b.enabled && b.pageIndex === pageIndex)
    .sort((a, b) => a.order - b.order);

  const renderBlockContent = (blockId: BlockId) => {
    switch (blockId) {
      case 'header':
        return <HeaderBlock data={projectData} />;
      case 'contract_metrics':
        return <ContractMetricsBlock data={projectData} />;
      case 'situation':
        return <SituationBlock rubrics={rubrics} />;
      case 'pending':
        return <PendingBoxBlock pendings={pendings} />;
      case 'photos':
        if (thisPagePhotos.length === 0) return null;
        return (
          <PhotosBlock
            photos={thisPagePhotos}
            columns={photoColumns}
            heightMm={photoHeightMm}
            title={thisPagePhotoTitle}
          />
        );
      case 'observations':
        return <ObservationsBlock data={observations} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col items-center mb-8 last:mb-2 print:mb-0">
      {/* Page indicator & toolbar above sheet (Screen Only) */}
      <div className="w-[210mm] flex items-center justify-between pb-2 text-xs text-slate-500 font-medium no-print">
        <div className="flex items-center gap-2">
          <span className="bg-slate-800 text-white font-bold px-2.5 py-0.5 rounded text-[11px] shadow-xs">
            Hoja {pageIndex + 1} de {totalPages}
          </span>
          <span className="text-slate-400">· Formato A4 (210 × 297 mm)</span>
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
                Exceso de altura: ~{contentHeightMm}mm / 297mm
              </span>
            </div>
          ) : (
            <span className="text-slate-500">
              Altura estimada: ~{contentHeightMm}mm de 297mm ({Math.min(100, Math.round((contentHeightMm / 297) * 100))}%)
            </span>
          )}
        </div>
      </div>

      {/* Physical A4 Sheet Container */}
      <div
        className={`a4-sheet relative bg-white border border-slate-300 shadow-xl transition-all ${
          isOverflowing ? 'ring-2 ring-rose-400/80' : ''
        }`}
      >
        {/* Overflow indicator mark at exactly 297mm line (Screen Only) */}
        <div className="absolute left-0 right-0 top-[297mm] h-[1px] border-b-2 border-dashed border-rose-400 z-30 pointer-events-none no-print">
          <span className="absolute right-2 -top-4 text-[9px] bg-rose-600 text-white font-bold px-1.5 py-0.5 rounded shadow-xs">
            Límite corte A4 (297 mm)
          </span>
        </div>

        {/* Running Header on sub-pages (pages 2+) if no institutional header block is present */}
        {pageIndex > 0 && !pageBlocks.some((b) => b.id === 'header') && (
          <div className="bg-[#0b455b] text-white px-5 py-1.5 flex items-center justify-between text-[7.5pt] font-semibold border-b border-slate-200 shrink-0">
            <span className="text-[#f4c84a] font-bold tracking-wider uppercase">
              REPORTE SEMANAL DE OBRAS
            </span>
            <span className="text-slate-200 font-normal truncate max-w-[120mm]">
              {projectData.project || 'Proyecto de Obra'}
            </span>
            <span className="text-white font-mono font-bold">
              Hoja {pageIndex + 1} de {totalPages}
            </span>
          </div>
        )}

        {/* Content area holding all blocks for this page */}
        <div
          ref={contentRef}
          className="flex-1 flex flex-col justify-start overflow-hidden print:overflow-visible"
        >
          {/* Continuation photos block if divided across pages (rendered at top of page 2) */}
          {hasContinuationPhotosOnPage2 && (
            <div className="relative transition-all">
              <PhotosBlock
                photos={continuationPhotosList}
                columns={photoColumns}
                heightMm={photoHeightMm}
                title="REGISTRO FOTOGRÁFICO (CONTINUACIÓN)"
              />
            </div>
          )}

          {pageBlocks.length === 0 && !hasContinuationPhotosOnPage2 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 text-center">
              <Move className="w-8 h-8 mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">Hoja A4 Vacía</p>
              <p className="text-xs max-w-sm mt-1 text-slate-400">
                Esta página no tiene bloques asignados. Puedes mover secciones aquí desde el editor o
                usar el botón &quot;Distribuir inteligentemente&quot;.
              </p>
            </div>
          ) : (
            pageBlocks.map((block, indexInPage) => {
              const isFirst = indexInPage === 0;
              const isLast = indexInPage === pageBlocks.length - 1;

              return (
                <div
                  key={block.id}
                  className="group relative transition-all"
                >
                  {/* Hover Quick Action Bar (Screen Only) */}
                  <div className="no-print absolute top-1 right-2 z-20 hidden group-hover:flex items-center gap-1 bg-slate-900/90 text-white text-[10px] p-1 rounded shadow-lg backdrop-blur-xs">
                    <span className="px-1 text-slate-300 font-medium">
                      {block.title.replace(/^\d+\.\s*/, '')}
                    </span>

                    {/* Move Up */}
                    <button
                      onClick={() => onMoveBlockOrder(block.id, 'up')}
                      disabled={isFirst && pageIndex === 0}
                      title="Subir bloque"
                      className="p-1 hover:bg-slate-700 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>

                    {/* Move Down */}
                    <button
                      onClick={() => onMoveBlockOrder(block.id, 'down')}
                      disabled={isLast && pageIndex === totalPages - 1}
                      title="Bajar bloque"
                      className="p-1 hover:bg-slate-700 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>

                    {/* Move to Prev Page */}
                    {pageIndex > 0 && (
                      <button
                        onClick={() => onMoveBlockPage(block.id, pageIndex - 1)}
                        title="Enviar a hoja anterior"
                        className="p-1 hover:bg-slate-700 rounded flex items-center gap-0.5 text-sky-300"
                      >
                        <ArrowLeft className="w-3 h-3" />
                        <span>Pág {pageIndex}</span>
                      </button>
                    )}

                    {/* Move to Next Page */}
                    <button
                      onClick={() => onMoveBlockPage(block.id, pageIndex + 1)}
                      title="Mover a hoja siguiente"
                      className="p-1 hover:bg-slate-700 rounded flex items-center gap-0.5 text-amber-300"
                    >
                      <span>Pág {pageIndex + 2}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>

                    {/* Toggle Force New Page */}
                    <button
                      onClick={() => onToggleForcePageBreak(block.id)}
                      title="Forzar salto de página"
                      className={`p-1 rounded ${
                        block.forceNewPage ? 'bg-amber-500 text-slate-950 font-bold' : 'hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      <CornerDownRight className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Render the actual block */}
                  {renderBlockContent(block.id)}
                </div>
              );
            })
          )}
        </div>

        {/* Page Footer */}
        <footer className="mt-auto px-6 py-2.5 border-t border-slate-200 text-slate-500 text-[7pt] flex justify-between items-center shrink-0 select-none bg-white">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-700">
              Dirección Técnica · SO.DT
            </span>
            <span>·</span>
            <span>Reporte Semanal de Estado de Obras Civiles</span>
          </div>
          <div className="font-mono font-bold text-slate-700">
            Página {pageIndex + 1} de {totalPages}
          </div>
        </footer>
      </div>

      {/* Overflow warning banner below sheet if needed */}
      {isOverflowing && (
        <div className="w-[210mm] mt-2 p-2 bg-rose-50 border border-rose-300 rounded-lg flex items-center justify-between text-xs text-rose-800 no-print">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              Esta hoja está demasiado cargada y sobrepasa el largo A4 (297 mm). Al imprimir se generará un corte inesperado.
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
    </div>
  );
};
