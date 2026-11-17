import React, { useState, useRef, useEffect } from 'react';
import { stripRefTags } from '../../utils/refs';
import { stripLeadNumber } from '../../utils/photoNumbering';
import { PhotoItem } from '../../types';
import { Pencil, Trash2, CornerDownRight, Check, Move, Expand, Shrink, Crosshair, GripVertical } from 'lucide-react';
import { UiPop, UiPopItem } from '../UiPop';

const PHOTO_POSITIONS = [
  { value: 'center', label: 'Centro' },
  { value: 'top', label: 'Arriba' },
  { value: 'bottom', label: 'Abajo' },
  { value: 'left', label: 'Izquierda' },
  { value: 'right', label: 'Derecha' },
];
import { PhotoAnnotationsOverlay } from '../PhotoAnnotationsOverlay';

export interface PhotoCardItemProps {
  ph: PhotoItem;
  /** Rótulo automático ("Foto 01"); el pie queda como "Foto 01 - descripción". */
  label?: string;
  resolvedIdx: number;
  masterListLength: number;
  isFirstOverall: boolean;
  isLastOverall: boolean;
  cardWidth: string;
  heightMm: number;
  columns: number;
  isNarrowCard: boolean;
  isEditing?: boolean;
  activeFramingId: string | null;
  setActiveFramingId: (id: string | null) => void;
  onUpdatePhotoFit?: (id: string, fit: 'cover' | 'contain') => void;
  onUpdatePhotoPosition?: (id: string, position: string) => void;
  onUpdatePhotoCaption?: (id: string, caption: string) => void;
  onUpdatePhotoField?: (id: string, patch: Partial<PhotoItem>) => void;
  onDeletePhoto?: (id: string) => void;
  onMovePhoto?: (id: string, direction: 'left' | 'right') => void;
  /** Reordenar arrastrando ⋮⋮: mueve `dragId` antes o después de `targetId` (mismo bloque). */
  onReorderPhoto?: (dragId: string, targetId: string, side: 'before' | 'after') => void;
  /** Ids de las fotos del mismo bloque (para aceptar solo arrastres de este bloque). */
  blockPhotoIds?: string[];
  onOpenAnnotate?: (photo: PhotoItem) => void;
  onOpenFreeFraming?: (photo: PhotoItem) => void;
  onStartEditing?: () => void;
  handleCaptionKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, currIndex: number, totalCount: number) => void;
}

/** Foto que se está arrastrando (compartido entre tarjetas, incluso en otras hojas). */
let draggingPhotoId: string | null = null;

export const PhotoCardItem: React.FC<PhotoCardItemProps> = ({
  ph,
  label,
  resolvedIdx,
  masterListLength,
  isFirstOverall,
  isLastOverall,
  cardWidth,
  heightMm,
  columns,
  isNarrowCard,
  isEditing,
  activeFramingId,
  setActiveFramingId,
  onUpdatePhotoFit,
  onUpdatePhotoPosition,
  onUpdatePhotoCaption,
  onUpdatePhotoField,
  onDeletePhoto,
  onMovePhoto,
  onReorderPhoto,
  blockPhotoIds,
  onOpenAnnotate,
  onOpenFreeFraming,
  onStartEditing,
  handleCaptionKeyDown,
}) => {
  const isFramingActive = activeFramingId === ph.id;
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dropSide, setDropSide] = useState<'before' | 'after' | null>(null);
  /** Menú de posición abierto: guarda dónde está el botón para anclarlo. */
  const [posMenu, setPosMenu] = useState<DOMRect | null>(null);
  const acceptsDrop = () =>
    !!onReorderPhoto && !!draggingPhotoId && draggingPhotoId !== ph.id && (!blockPhotoIds || blockPhotoIds.includes(draggingPhotoId));
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const cardContainerRef = useRef<HTMLDivElement | null>(null);

  const scale = ph.scale || 1;
  const offsetX = ph.offsetX || 0;
  const offsetY = ph.offsetY || 0;

  // Native wheel listener on active framing card for smooth zooming without page scrolling
  useEffect(() => {
    if (!isFramingActive) return;
    const container = cardContainerRef.current;
    if (!container) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const currentScale = ph.scale || 1;
      const delta = e.deltaY < 0 ? 0.08 : -0.08;
      const newScale = Math.max(1, Math.min(3.5, Number((currentScale + delta).toFixed(2))));

      if (onUpdatePhotoField) {
        onUpdatePhotoField(ph.id, { scale: newScale });
      }
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
    };
  }, [isFramingActive, ph.id, ph.scale, onUpdatePhotoField]);

  // Global window mousemove / mouseup drag handler for silky-smooth pan across entire screen
  useEffect(() => {
    if (!isDragging || !isFramingActive) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setDragStart({ x: e.clientX, y: e.clientY });

      const currentScale = ph.scale || 1;
      const sensitivity = 0.6 / currentScale;
      const newOffsetX = Math.max(-150, Math.min(150, (ph.offsetX || 0) + dx * sensitivity));
      const newOffsetY = Math.max(-150, Math.min(150, (ph.offsetY || 0) + dy * sensitivity));

      if (onUpdatePhotoField) {
        onUpdatePhotoField(ph.id, {
          offsetX: Math.round(newOffsetX),
          offsetY: Math.round(newOffsetY),
        });
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, isFramingActive, dragStart, ph.id, ph.scale, ph.offsetX, ph.offsetY, onUpdatePhotoField]);

  return (
    <div
      data-photo-card={`${ph.id}|${columns}|${heightMm}`}
      onDragOver={(e) => {
        if (!acceptsDrop()) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const r = e.currentTarget.getBoundingClientRect();
        const side = e.clientX < r.left + r.width / 2 ? 'before' : 'after';
        if (side !== dropSide) setDropSide(side);
      }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropSide(null); }}
      onDrop={(e) => {
        e.preventDefault();
        if (acceptsDrop() && dropSide && draggingPhotoId) onReorderPhoto?.(draggingPhotoId, ph.id, dropSide);
        draggingPhotoId = null;
        setDropSide(null);
      }}
      className={`photo-card rp-card rp-photo group/photo relative break-inside-avoid border rounded-[var(--rp-radius-sm)] overflow-hidden bg-white shadow-2xs flex flex-col transition-all ${
        isFramingActive ? 'border-amber-400 ring-2 ring-amber-400 shadow-md z-30' : 'border-slate-300'
      }`}
      style={{ width: cardWidth }}
    >
      <div
        ref={cardContainerRef}
        className={`w-full flex items-center justify-center overflow-hidden relative select-none ${
          isFramingActive
            ? 'cursor-grab active:cursor-grabbing bg-slate-900/10'
            : 'bg-slate-100'
        }`}
        style={{ height: `${heightMm}mm`, touchAction: 'none' }}
        onMouseDown={(e) => {
          if (isFramingActive) {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
            setDragStart({ x: e.clientX, y: e.clientY });
          }
        }}
      >
        <img
          src={ph.src}
          alt={[label, ph.caption].filter(Boolean).join(' - ') || `Fotografía de obra ${resolvedIdx + 1}`}
          className="w-full h-full transition-transform duration-75 ease-out pointer-events-none"
          style={{
            objectFit: ph.objectFit || 'cover',
            objectPosition: ph.objectPosition || 'center',
            transform: `scale(${scale}) translate(${offsetX}%, ${offsetY}%)`,
          }}
          referrerPolicy="no-referrer"
          loading="lazy"
        />

        {/* Markup / Annotations vector overlay */}
        <PhotoAnnotationsOverlay annotations={ph.annotations} />

        {/* Encuadre activo: misma barra de vidrio que el resto, ARRIBA, en el
            lugar de la barra de la foto: "Listo" queda donde estaba el botón
            de encuadrar. */}
        {isFramingActive && (
          <div
            className="no-print absolute top-1.5 inset-x-1.5 z-30 ui-glass is-sm justify-between pointer-events-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span className="flex items-center gap-1.5 min-w-0 px-1.5 text-[10px] font-semibold text-slate-200">
              <Move className="w-3 h-3 shrink-0 text-[var(--ui-accent)]" />
              <span className="truncate">Rueda: zoom {Math.round((ph.scale || 1) * 100)}% · arrastrá para mover</span>
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveFramingId(null);
                setIsDragging(false);
              }}
              className="ui-tb is-accent shrink-0"
            >
              <Check />
              <span>Listo</span>
            </button>
          </div>
        )}

        {/* Asa para reordenar + número de foto (solo pantalla).
            Al editar queda visible; si no, solo al pasar el mouse. */}
        {onReorderPhoto && !isFramingActive && (
          <div
            className={`no-print absolute top-1.5 left-1.5 z-20 ui-glass is-sm pointer-events-auto transition-opacity duration-150 ${
              isEditing ? 'opacity-100' : 'opacity-0 group-hover/photo:opacity-100'
            }`}
          >
            <span
              draggable
              onDragStart={(e) => {
                draggingPhotoId = ph.id;
                e.dataTransfer.effectAllowed = 'move';
                try { e.dataTransfer.setData('text/plain', ph.id); } catch { /* noop */ }
                const card = (e.currentTarget as HTMLElement).closest('.photo-card') as HTMLElement | null;
                if (card) e.dataTransfer.setDragImage(card, 20, 20);
              }}
              onDragEnd={() => { draggingPhotoId = null; setDropSide(null); }}
              onMouseDown={(e) => e.stopPropagation()}
              className="ui-tb cursor-grab active:cursor-grabbing"
              title="Arrastrar para reordenar la foto"
            >
              <GripVertical />
            </span>
            <span className="ui-tb-note">#{resolvedIdx + 1}</span>
          </div>
        )}

        {/* Línea que indica dónde va a caer la foto arrastrada */}
        {dropSide && (
          <div
            className="no-print absolute top-0 bottom-0 w-1 rounded-full bg-sky-500 z-40 pointer-events-none"
            style={dropSide === 'before' ? { left: 0 } : { right: 0 }}
          />
        )}

        {/* Barra de la foto: misma familia que la barra del PDF (vidrio oscuro,
            iconos, arriba a la derecha). Solo aparece al pasar el mouse. */}
        {!isFramingActive && (
          <div
            className={`no-print absolute top-1.5 right-1.5 z-20 ui-glass is-sm pointer-events-auto transition-opacity duration-150 ${
              posMenu ? 'opacity-100' : 'opacity-0 group-hover/photo:opacity-100 focus-within:opacity-100'
            }`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="ui-tb"
              onClick={(e) => {
                e.stopPropagation();
                onUpdatePhotoFit?.(ph.id, ph.objectFit === 'contain' ? 'cover' : 'contain');
              }}
              title={ph.objectFit === 'contain'
                ? 'Ajuste: foto entera · clic para rellenar el cuadro'
                : 'Ajuste: rellena el cuadro · clic para ver la foto entera'}
            >
              {ph.objectFit === 'contain' ? <Shrink /> : <Expand />}
            </button>
            <button
              type="button"
              className={`ui-tb${posMenu ? ' on' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setPosMenu(posMenu ? null : e.currentTarget.getBoundingClientRect());
              }}
              title="Posición del encuadre"
            >
              <Crosshair />
            </button>
            <span className="ui-tb-sep" />
            {onOpenAnnotate && (
              <button
                type="button"
                className={`ui-tb${(ph.markup?.length || ph.annotations?.length) ? ' on' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenAnnotate(ph);
                }}
                title="Anotar sobre la foto: flechas, cotas, textos"
              >
                <Pencil />
              </button>
            )}
            <button
              type="button"
              className="ui-tb"
              onClick={(e) => {
                e.stopPropagation();
                setActiveFramingId(isFramingActive ? null : ph.id);
              }}
              title="Encuadrar: rueda del mouse para zoom, arrastrar para mover"
            >
              <Move />
            </button>
            {onDeletePhoto && (
              <>
                <span className="ui-tb-sep" />
                <button
                  type="button"
                  className="ui-tb is-danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePhoto(ph.id);
                  }}
                  title="Eliminar foto"
                >
                  <Trash2 />
                </button>
              </>
            )}
          </div>
        )}

        {posMenu && (
          <UiPop anchor={posMenu} onClose={() => setPosMenu(null)} caption="Posición del encuadre">
            {PHOTO_POSITIONS.map((o) => (
              <UiPopItem
                key={o.value}
                on={(ph.objectPosition || 'center') === o.value}
                onClick={() => { onUpdatePhotoPosition?.(ph.id, o.value); setPosMenu(null); }}
              >
                {o.label}
              </UiPopItem>
            ))}
          </UiPop>
        )}
      </div>

      <div
        className={`rp-caption py-1 px-2 border-t text-[7.5pt] text-slate-700 text-center font-medium leading-tight min-h-[5.5mm] flex items-center justify-center transition-colors ${
          isEditing
            ? 'bg-amber-50/40 border-amber-200'
            : 'bg-slate-50 border-slate-200 hover:bg-sky-50/60 cursor-pointer'
        }`}
        title={!isEditing ? "Doble clic para editar pies de foto" : undefined}
        onDoubleClick={(e) => {
          if (!isEditing && onStartEditing) {
            e.stopPropagation();
            onStartEditing();
            setTimeout(() => {
              const target = document.querySelector<HTMLInputElement>(
                `input[data-photo-caption-input="true"][data-photo-index="${resolvedIdx}"]`
              );
              if (target) {
                target.focus();
                target.select();
              }
            }, 50);
          }
        }}
      >
        {isEditing && onUpdatePhotoCaption ? (
          <>
          {label && (
            <span className="shrink-0 font-bold text-[var(--rp-primary)] whitespace-nowrap mr-1 select-none" title="Numeración automática (se cambia desde «Numerar como» en el panel)">
              {label} -
            </span>
          )}
          <input
            type="text"
            data-photo-caption-input="true"
            data-photo-index={resolvedIdx}
            data-photo-id={ph.id}
            value={ph.caption || ''}
            onChange={(e) => onUpdatePhotoCaption(ph.id, e.target.value)}
            onKeyDown={(e) => handleCaptionKeyDown(e, resolvedIdx, masterListLength)}
            onFocus={(e) => e.currentTarget.select()}
            placeholder={label ? 'Descripción…' : `Descripción foto ${resolvedIdx + 1}...`}
            className="w-full min-w-0 flex-1 text-[7.5pt] text-center bg-white/70 border-0 ring-1 ring-amber-300 focus:ring-2 focus:ring-[#0b455b]/40 rounded px-1.5 py-0 outline-none font-medium leading-tight transition-all"
            style={{ height: '1.25em' }}
            onClick={(e) => e.stopPropagation()}
          />
          </>
        ) : label ? (
          <span>
            <b className="font-bold text-[var(--rp-primary)]">{label}</b>
            {stripLeadNumber(ph.caption || '').trim() ? ` - ${stripRefTags(stripLeadNumber(ph.caption || ''))}` : ''}
          </span>
        ) : (
          stripRefTags(ph.caption || '') || `Fotografía ${resolvedIdx + 1}`
        )}
      </div>

      {ph.breakAfter && (
        // Indicador superpuesto: no agrega alto a la tarjeta (la hoja se ve igual que impresa)
        <div className="no-print absolute right-1.5 bottom-[calc(5.5mm+4px)] z-20 bg-amber-100/95 text-amber-900 border border-amber-300 rounded py-0.5 px-1.5 text-[8px] font-bold flex items-center gap-1 select-none shadow-xs pointer-events-none">
          <CornerDownRight className="w-2.5 h-2.5 text-amber-700" />
          <span>Salto de hoja</span>
        </div>
      )}
    </div>
  );
};
