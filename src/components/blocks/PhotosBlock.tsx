import React, { useState } from 'react';
import { PhotoItem } from '../../types';
import { SectionHeaderBanner } from '../SectionHeaderBanner';
import { PhotoCardItem } from './PhotoCardItem';

interface PhotosBlockProps {
  photos: PhotoItem[];
  allPhotos?: PhotoItem[];
  /** Rótulos de numeración global por id de foto ("Foto 01"). Sin esto, no se numera. */
  photoLabels?: Record<string, string>;
  columns?: 1 | 2 | 3 | 4;
  heightMm?: number;
  title?: string;
  numberIndex?: number | null;
  showTitle?: boolean;
  isEditing?: boolean;
  /** Esta hoja es continuación del bloque (las fotos vienen de la hoja anterior). */
  continuation?: boolean;
  /** Mostrar el título menor "(continuación)" en las hojas siguientes. */
  showContinuationTitle?: boolean;
  onUpdateTitle?: (title: string) => void;
  onToggleShowTitle?: () => void;
  onUpdatePhotoFit?: (id: string, fit: 'cover' | 'contain') => void;
  onUpdatePhotoPosition?: (id: string, position: string) => void;
  onUpdatePhotoCaption?: (id: string, caption: string) => void;
  onUpdatePhotoField?: (id: string, patch: Partial<PhotoItem>) => void;
  onDeletePhoto?: (id: string) => void;
  onMovePhoto?: (id: string, direction: 'left' | 'right') => void;
  onReorderPhoto?: (dragId: string, targetId: string, side: 'before' | 'after') => void;
  onToggleBreakAfter?: (id: string) => void;
  onOpenFreeFraming?: (photo: PhotoItem) => void;
  onOpenAnnotate?: (photo: PhotoItem) => void;
  onStartEditing?: () => void;
}

export const PhotosBlock: React.FC<PhotosBlockProps> = ({
  photos,
  allPhotos,
  photoLabels,
  columns = 2,
  heightMm = 70,
  title = 'REGISTRO FOTOGRÁFICO DE SITUACIÓN ACTUAL',
  numberIndex,
  showTitle = true,
  isEditing = false,
  continuation = false,
  showContinuationTitle = true,
  onUpdateTitle,
  onToggleShowTitle,
  onUpdatePhotoFit,
  onUpdatePhotoPosition,
  onUpdatePhotoCaption,
  onUpdatePhotoField,
  onDeletePhoto,
  onMovePhoto,
  onReorderPhoto,
  onToggleBreakAfter,
  onOpenFreeFraming,
  onOpenAnnotate,
  onStartEditing,
}) => {
  // In-situ framing state for active photo card
  const [activeFramingId, setActiveFramingId] = useState<string | null>(null);

  const handleCaptionKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    currIndex: number,
    totalCount: number
  ) => {
    const input = e.currentTarget;
    const val = input.value;
    const isAllSelected =
      input.selectionStart === 0 && input.selectionEnd === val.length;
    const isAtStart =
      input.selectionStart === 0 && input.selectionEnd === 0;
    const isAtEnd =
      input.selectionStart === val.length && input.selectionEnd === val.length;

    let targetIdx: number | null = null;

    if (e.key === 'ArrowRight') {
      if (isAllSelected || isAtEnd || val === '') {
        e.preventDefault();
        if (currIndex + 1 < totalCount) {
          targetIdx = currIndex + 1;
        }
      }
    } else if (e.key === 'ArrowLeft') {
      if (isAllSelected || isAtStart || val === '') {
        e.preventDefault();
        if (currIndex - 1 >= 0) {
          targetIdx = currIndex - 1;
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextRowIdx = currIndex + columns;
      if (nextRowIdx < totalCount) {
        targetIdx = nextRowIdx;
      } else if (currIndex < totalCount - 1) {
        targetIdx = totalCount - 1;
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevRowIdx = currIndex - columns;
      if (prevRowIdx >= 0) {
        targetIdx = prevRowIdx;
      } else if (currIndex > 0) {
        targetIdx = 0;
      }
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        if (currIndex - 1 >= 0) targetIdx = currIndex - 1;
      } else {
        if (currIndex + 1 < totalCount) targetIdx = currIndex + 1;
      }
    } else if (e.key === 'Escape') {
      input.blur();
    }

    if (targetIdx !== null) {
      const nextInput = document.querySelector<HTMLInputElement>(
        `input[data-photo-caption-input="true"][data-photo-index="${targetIdx}"]`
      );
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
        nextInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  return (
    <section className="photos-block-container px-5 py-2 shrink-0 select-none break-inside-avoid">
      {continuation ? (
        // Hojas siguientes: título menor (desactivable). Su alto es fijo (5,2 mm) para que el paginador acierte.
        showContinuationTitle && (
          <div
            className="flex items-center gap-1.5 text-[7pt] font-bold uppercase tracking-wider text-slate-500"
            style={{ height: '3.6mm', marginBottom: '1.6mm' }}
          >
            <span className="h-px flex-1 bg-slate-200" />
            <span>{title.replace(/^\d+[\.\-\)]\s*/, '')} · continuación</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
        )
      ) : (
        <SectionHeaderBanner
          numberIndex={numberIndex}
          title={title}
          isEditing={isEditing}
          showTitle={showTitle}
          onUpdateTitle={onUpdateTitle}
          onToggleShowTitle={onToggleShowTitle}
          onStartEditing={onStartEditing}
        />
      )}

      {photos.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-lg p-6 text-center text-slate-400 text-[8pt] italic bg-slate-50/50">
          No se han adjuntado fotografías para esta sección. Sube imágenes o pega desde el portapapeles (Ctrl+V).
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-3">
          {photos.map((ph, idx) => {
            const masterList = allPhotos && allPhotos.length > 0 ? allPhotos : photos;
            const globalIdx = masterList.findIndex((p) => p.id === ph.id);
            const resolvedIdx = globalIdx !== -1 ? globalIdx : idx;
            const isFirstOverall = resolvedIdx === 0;
            const isLastOverall = resolvedIdx === masterList.length - 1;

            const cardWidth = `calc(${100 / columns}% - ${((columns - 1) * 12) / columns}px)`;
            const isNarrowCard = columns >= 3;

            return (
              <PhotoCardItem
                key={ph.id || `photo-${idx}`}
                ph={ph}
                label={photoLabels?.[ph.id]}
                resolvedIdx={resolvedIdx}
                masterListLength={masterList.length}
                isFirstOverall={isFirstOverall}
                isLastOverall={isLastOverall}
                cardWidth={cardWidth}
                heightMm={heightMm}
                columns={columns}
                isNarrowCard={isNarrowCard}
                isEditing={isEditing}
                activeFramingId={activeFramingId}
                setActiveFramingId={setActiveFramingId}
                onUpdatePhotoFit={onUpdatePhotoFit}
                onUpdatePhotoPosition={onUpdatePhotoPosition}
                onUpdatePhotoCaption={onUpdatePhotoCaption}
                onUpdatePhotoField={onUpdatePhotoField}
                onDeletePhoto={onDeletePhoto}
                onMovePhoto={onMovePhoto}
                onReorderPhoto={onReorderPhoto}
                blockPhotoIds={(allPhotos && allPhotos.length > 0 ? allPhotos : photos).map((p) => p.id)}
                onOpenAnnotate={onOpenAnnotate}
                onOpenFreeFraming={onOpenFreeFraming}
                onStartEditing={onStartEditing}
                handleCaptionKeyDown={handleCaptionKeyDown}
              />
            );
          })}
        </div>
      )}
    </section>
  );
};
