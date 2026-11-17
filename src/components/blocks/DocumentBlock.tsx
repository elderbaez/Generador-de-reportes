import React, { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { stripRefTags } from '../../utils/refs';
import {
  FilePlus2, Crop, Scissors, ChevronLeft, ChevronRight, Trash2, CornerDownLeft, Loader2, FileWarning, Layers, Pencil,
} from 'lucide-react';
import { DocItem, DocEdge, MarkupItem } from '../../types';
import { SectionHeaderBanner } from '../SectionHeaderBanner';
import { EditDock, DockButton, DockSlider, DockCheck } from '../EditDock';
import { EditableCell } from '../table/NotionTable';
import type { DocInsertResult } from '../DocumentInsertModal';
const DocumentInsertModal = lazy(() => import('../DocumentInsertModal').then((m) => ({ default: m.DocumentInsertModal })));
const DocAnnotationModal = lazy(() => import('../DocAnnotationModal').then((m) => ({ default: m.DocAnnotationModal })));
import { DocAnnotationOverlay } from '../DocAnnotationOverlay';
import { useZoneImages } from '../../utils/magnify';
import { registerDocItem } from '../../utils/pdfVector';
import { renderItemImage, isFullPage, cutSides } from '../../utils/pdf';
import { itemSvgUrl } from '../../utils/pdfSvg';
import { UiPop, UiPopItem } from '../UiPop';
import '../ui-kit.css';
import { layoutDocRows, edgeClipPath, effectiveEdgeSides, DOC_GAP_MM, DOC_MAX_HEIGHT, DOC_EDGE_OPTIONS, docInnerWidthMm, type DocOutset } from '../../utils/docLayout';
import { PHOTO_PREFIX_SUGGESTIONS, stripLeadNumber } from '../../utils/photoNumbering';
import './document-block.css';

const PX_PER_MM = 96 / 25.4;
/** Resolución con la que se dibujan los fragmentos (nítidos al imprimir). */
const PRINT_DPI = 220;

interface DocumentBlockProps {
  title: string;
  numberIndex?: number | null;
  showTitle?: boolean;
  items: DocItem[];
  maxHeightMm?: number;
  showCaption?: boolean;
  prefix?: string;
  /** Rótulos de numeración global por id ("Figura 03"). */
  labels?: Record<string, string>;
  isEditing?: boolean;
  onUpdateTitle?: (t: string) => void;
  onToggleShowTitle?: () => void;
  onUpdateItems: (items: DocItem[]) => void;
  onChangeMaxHeight: (mm: number) => void;
  onToggleCaption: () => void;
  onChangePrefix: (prefix: string) => void;
  onStartEditing?: () => void;
}

const newDocId = () => `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/* ---------- Imagen del fragmento (se dibuja desde el PDF) ---------- */

/**
 * Imagen del fragmento.
 *  - PDF: se intenta primero como SVG (vectorial: se imprime como vector y el
 *    navegador solo lo rasteriza a resolución de pantalla).
 *  - Si MuPDF no está o falla con ese PDF, y para imágenes escaneadas: se
 *    dibuja como imagen a PRINT_DPI, como antes.
 * Las dos rutas cachean, así que la lupa y la imagen comparten resultado.
 * Con `enabled=false` no hace nada (la capa de marcas sin lupa no la necesita).
 */
function useItemImage(item: DocItem, wPx: number, enabled = true) {
  const [state, setState] = useState<{ url: string | null; vector: boolean; failed: boolean }>(
    { url: null, vector: false, failed: false },
  );
  const target = Math.min(4200, Math.max(300, (wPx * PRINT_DPI) / 96));
  useEffect(() => {
    if (!enabled) return;
    let off = false;
    (async () => {
      if (item.kind === 'pdf') {
        const svg = await itemSvgUrl(item);
        if (off) return;
        if (svg) { setState({ url: svg, vector: true, failed: false }); return; }
      }
      const raster = await renderItemImage(item, target);
      if (!off) setState({ url: raster, vector: false, failed: false });
    })().catch(() => { if (!off) setState({ url: null, vector: false, failed: true }); });
    return () => { off = true; };
  }, [enabled, item.id, item.src, item.rotation, item.crop?.x, item.crop?.y, item.crop?.w, item.crop?.h, Math.ceil(target / 200)]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

/** Indicador en la barra de edición: el fragmento quedó vectorial o como imagen. */
const DocKindBadge: React.FC<{ item: DocItem }> = ({ item }) => {
  const [vector, setVector] = useState<boolean | null>(null);
  useEffect(() => {
    let off = false;
    if (item.kind !== 'pdf') { setVector(false); return; }
    setVector(null);
    itemSvgUrl(item).then((u) => { if (!off) setVector(!!u); });
    return () => { off = true; };
  }, [item.id, item.src, item.rotation, item.crop?.x, item.crop?.y, item.crop?.w, item.crop?.h]); // eslint-disable-line react-hooks/exhaustive-deps
  if (vector === null) return <span className="rp-doc-kind pending" title="Convirtiendo a vector…">…</span>;
  return vector
    ? <span className="rp-doc-kind vec" title="Vectorial: se imprime nítido a cualquier tamaño">VEC</span>
    : <span className="rp-doc-kind img" title={item.kind === 'pdf'
      ? 'Como imagen: no se pudo pasar a vector (ver la consola)'
      : 'Imagen escaneada: se imprime a 220 ppp'}>IMG</span>;
};

const DocImage: React.FC<{ item: DocItem; wPx: number }> = ({ item, wPx }) => {
  const { url, failed } = useItemImage(item, wPx);

  if (failed) {
    return (
      <div className="rp-doc-ph err">
        <FileWarning />
        <span>No se pudo dibujar el documento</span>
      </div>
    );
  }
  if (!url) {
    return <div className="rp-doc-ph"><Loader2 className="rp-doc-spin" /></div>;
  }
  return <img className="rp-doc-img" src={url} alt={item.caption || item.fileName || 'Documento'} draggable={false} />;
};

/** Capa de anotaciones: necesita la imagen para que la lupa pueda ampliar. */
const DocMarkupLayer: React.FC<{
  item: DocItem; w: number; h: number; outset: DocOutset;
}> = ({ item, w, h, outset }) => {
  // Solo la lupa necesita la imagen; sin lupa no se dibuja nada extra.
  const needsImg = (item.markup || []).some((m) => m.kind === 'magnifier');
  const { url, vector } = useItemImage(item, w, needsImg);
  // Una imagen (no vectorial) se amplía desde su zona dibujada aparte: así no se pixela
  const zones = useZoneImages(item, item.markup, w, PRINT_DPI / 96, needsImg && !vector && !!url);
  return (
    <DocAnnotationOverlay
      markup={item.markup!}
      width={w}
      height={h}
      outset={outset}
      src={needsImg ? url || undefined : undefined}
      zones={zones}
      uid={item.id}
    />
  );
};

/* ---------- Bloque ---------- */

export const DocumentBlock: React.FC<DocumentBlockProps> = ({
  title,
  numberIndex,
  showTitle = true,
  items,
  maxHeightMm = DOC_MAX_HEIGHT.default,
  showCaption = true,
  prefix = '',
  labels,
  isEditing = false,
  onUpdateTitle,
  onToggleShowTitle,
  onUpdateItems,
  onChangeMaxHeight,
  onToggleCaption,
  onChangePrefix,
  onStartEditing,
}) => {
  const rowsRef = useRef<HTMLDivElement>(null);
  const [widthPx, setWidthPx] = useState(() => docInnerWidthMm() * PX_PER_MM);
  const [modal, setModal] = useState<{ edit?: DocItem; file?: File } | null>(null);
  /** Menú de bordes abierto: fragmento + posición del botón (para anclar el menú). */
  const [edgeMenu, setEdgeMenu] = useState<{ id: string; rect: DOMRect } | null>(null);
  const [annotateItem, setAnnotateItem] = useState<DocItem | null>(null);
  const [dropOver, setDropOver] = useState(false);

  useLayoutEffect(() => {
    const el = rowsRef.current;
    if (!el) return;
    const read = () => { if (el.clientWidth > 0) setWidthPx(el.clientWidth); };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pegar un PDF o una imagen mientras se edita el bloque
  useEffect(() => {
    if (!isEditing || modal) return;
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /INPUT|TEXTAREA/.test(t.tagName))) return;
      const f = Array.from(e.clipboardData?.files || []).find((x) => /pdf|image\//i.test(x.type));
      if (f) { e.preventDefault(); setModal({ file: f }); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [isEditing, modal]);

  useEffect(() => { if (!isEditing) setEdgeMenu(null); }, [isEditing]);

  const patchItem = (id: string, patch: Partial<DocItem>) =>
    onUpdateItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const move = (id: string, dir: -1 | 1) => {
    const i = items.findIndex((it) => it.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onUpdateItems(next);
  };

  const handleConfirm = (res: DocInsertResult) => {
    const editing = modal?.edit;
    if (editing) {
      onUpdateItems(items.map((it) => (it.id === editing.id ? { ...it, ...res, id: editing.id } : it)));
    } else {
      onUpdateItems([...items, { ...res, id: newDocId() } as DocItem]);
    }
    setModal(null);
  };

  const gapPx = DOC_GAP_MM * PX_PER_MM;
  const rows = layoutDocRows(items, widthPx, maxHeightMm * PX_PER_MM, gapPx);
  let flatIndex = -1;

  return (
    <section
      className={`nt-root rp-doc-root px-5 py-2 shrink-0 select-none${isEditing ? ' nt-editing is-editing' : ''}${dropOver ? ' drop-over' : ''}`}
      onDragOver={(e) => { if (isEditing && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropOver(true); } }}
      onDragLeave={() => setDropOver(false)}
      onDrop={(e) => {
        if (!isEditing) return;
        const f = e.dataTransfer.files?.[0];
        setDropOver(false);
        if (f) { e.preventDefault(); setModal({ file: f }); }
      }}
    >
      <SectionHeaderBanner
        numberIndex={numberIndex}
        title={title}
        isEditing={isEditing}
        showTitle={showTitle}
        onUpdateTitle={onUpdateTitle}
        onToggleShowTitle={onToggleShowTitle}
        onStartEditing={onStartEditing}
      />

      <div ref={rowsRef} className="rp-doc-rows">
        {items.length === 0 ? (
          <div
            className="rp-doc-empty"
            onClick={() => { if (isEditing) setModal({}); else onStartEditing?.(); }}
          >
            <FilePlus2 />
            <span>
              {isEditing
                ? 'Hacé clic para insertar una hoja o un recorte de un PDF o plano (también podés arrastrarlo o pegarlo).'
                : 'Sin documentos. Doble clic para insertar una hoja o un recorte de un PDF o plano.'}
            </span>
          </div>
        ) : (
          rows.map((row, ri) => (
            <div key={ri} className="rp-doc-row" style={{ gap: gapPx }}>
              {row.items.map(({ item, w, h, outset, boxW }) => {
                flatIndex += 1;
                const idx = flatIndex;
                const wMm = w / PX_PER_MM;
                const hMm = h / PX_PER_MM;
                // Margen reservado para los callouts de lupa que salen del papel
                const pad = {
                  top: outset.t * h, right: outset.r * w,
                  bottom: outset.b * h, left: outset.l * w,
                };
                const hasPad = pad.top || pad.right || pad.bottom || pad.left;
                const clip = edgeClipPath(item, wMm, hMm);
                const shadow = item.shadow !== false;
                const full = isFullPage(item);
                const label = labels?.[item.id];
                registerDocItem(item); // el PDF del programa lo incrusta en vector
                const cut = cutSides(item);
                const hasCut = cut.top || cut.left || cut.right || cut.bottom;
                const showCap = showCaption && (isEditing || !!label || !!item.caption);
                return (
                  <figure
                    key={item.id}
                    className={`rp-doc-item${full ? ' is-page' : ' is-fragment'}`}
                    style={{ width: boxW }}
                    data-doc-item={item.id}
                  >
                    <div
                      className={`rp-doc-paper${shadow ? ' has-shadow' : ''}${!shadow && !clip ? ' has-line' : ''}`}
                      style={{
                        width: w,
                        height: h,
                        ...(hasPad ? { margin: `${pad.top}px ${pad.right}px ${pad.bottom}px ${pad.left}px` } : null),
                      }}
                    >
                      {/* Sombra como capa HERMANA del plano, no como filtro del
                          contenedor: un filter: drop-shadow sobre el papel hace
                          que Chrome imprima todo lo de adentro como imagen. Así
                          solo la sombra sale rasterizada y el plano queda vector.
                          El blur va en el envoltorio y el recorte adentro, para
                          que la sombra siga el borde rasgado sin cortarse. */}
                      {shadow && (
                        <div className="rp-doc-shadow" aria-hidden>
                          <div style={clip ? { clipPath: clip } : undefined} />
                        </div>
                      )}

                      <div className="rp-doc-clip" style={clip ? { clipPath: clip } : undefined}>
                        <DocImage item={item} wPx={w} />
                      </div>

                      {isEditing && (
                        <div className={`rp-doc-tools ui-glass is-sm no-print${edgeMenu?.id === item.id ? ' open' : ''}`}>
                          <DocKindBadge item={item} />
                          <span className="ui-tb-sep" />
                          {/* Grupo: recortar + bordes + sombra */}
                          <button type="button" className="ui-tb" title="Recortar, girar o cambiar el archivo" onClick={() => setModal({ edit: item })}>
                            <Crop />
                          </button>
                          <button
                            type="button"
                            className={`ui-tb${edgeMenu?.id === item.id || (item.edge && item.edge !== 'straight') ? ' on' : ''}`}
                            title="Estilo de los bordes"
                            onClick={(e) => setEdgeMenu(edgeMenu?.id === item.id ? null : { id: item.id, rect: e.currentTarget.getBoundingClientRect() })}
                          >
                            <Scissors />
                          </button>
                          <button
                            type="button"
                            className={`ui-tb${shadow ? ' on' : ''}`}
                            title={shadow ? 'Quitar sombra' : 'Agregar sombra de papel'}
                            onClick={() => patchItem(item.id, { shadow: !shadow })}
                          >
                            <Layers />
                          </button>

                          <span className="ui-tb-sep" />

                          {/* Grupo: anotar */}
                          <button
                            type="button"
                            className={`ui-tb${item.markup?.length ? ' on' : ''}`}
                            title="Anotar: flechas, cotas, lupa y otras marcas"
                            onClick={() => setAnnotateItem(item)}
                          >
                            <Pencil />
                          </button>

                          <span className="ui-tb-sep" />

                          {/* Grupo: posición */}
                          {idx > 0 && (
                            <button
                              type="button"
                              className={`ui-tb${item.rowBreak ? ' on' : ''}`}
                              title={item.rowBreak ? 'Unir a la fila anterior' : 'Empezar una fila nueva desde acá'}
                              onClick={() => patchItem(item.id, { rowBreak: !item.rowBreak })}
                            >
                              <CornerDownLeft />
                            </button>
                          )}
                          <button type="button" className="ui-tb" title="Mover antes" disabled={idx === 0} onClick={() => move(item.id, -1)}>
                            <ChevronLeft />
                          </button>
                          <button type="button" className="ui-tb" title="Mover después" disabled={idx === items.length - 1} onClick={() => move(item.id, 1)}>
                            <ChevronRight />
                          </button>

                          <span className="ui-tb-sep" />

                          {/* Grupo: eliminar */}
                          <button type="button" className="ui-tb is-danger" title="Quitar del informe" onClick={() => onUpdateItems(items.filter((x) => x.id !== item.id))}>
                            <Trash2 />
                          </button>

                          {edgeMenu?.id === item.id && (
                            <UiPop anchor={edgeMenu.rect} onClose={() => setEdgeMenu(null)} caption="Borde">
                              {DOC_EDGE_OPTIONS.map((o) => (
                                <UiPopItem
                                  key={o.value}
                                  on={(item.edge || 'straight') === o.value}
                                  icon={<EdgeIcon edge={o.value} />}
                                  onClick={() => patchItem(item.id, { edge: o.value as DocEdge })}
                                >
                                  {o.label}
                                </UiPopItem>
                              ))}
                              {(item.edge && item.edge !== 'straight') && (
                                <>
                                  <div className="ui-pop-sep" />
                                  <div className="ui-pop-caption">Aplicar en</div>
                                  <div className="ui-seg" style={{ margin: '0 2px 2px' }}>
                                    <button
                                      type="button"
                                      className={effectiveEdgeSides(item) === 'cut' ? 'on' : ''}
                                      onClick={() => patchItem(item.id, { edgeSides: 'cut' })}
                                      disabled={!hasCut}
                                      style={!hasCut ? { opacity: .4, cursor: 'default' } : undefined}
                                      title={hasCut ? 'Sólo los lados recortados' : 'Es la hoja completa: no tiene lados recortados'}
                                    >
                                      Recortados
                                    </button>
                                    <button
                                      type="button"
                                      className={effectiveEdgeSides(item) === 'h' ? 'on' : ''}
                                      onClick={() => patchItem(item.id, { edgeSides: 'h' })}
                                      title="Sólo superior e inferior"
                                    >
                                      Sup / Inf
                                    </button>
                                    <button
                                      type="button"
                                      className={effectiveEdgeSides(item) === 'all' ? 'on' : ''}
                                      onClick={() => patchItem(item.id, { edgeSides: 'all' })}
                                      title="Los cuatro lados"
                                    >
                                      Todos
                                    </button>
                                  </div>
                                </>
                              )}
                            </UiPop>
                          )}
                        </div>
                      )}

                    </div>

                    {/* Anotaciones: hermanas del papel, ocupando también el
                        margen reservado para los callouts de lupa. */}
                    {(item.markup && item.markup.length > 0) && (
                      <DocMarkupLayer item={item} w={w} h={h} outset={outset} />
                    )}

                    {showCap && (
                      <figcaption className="rp-caption rp-doc-caption">
                        {/* Un solo renglón de texto, como el pie de las fotos: "Figura 01 - descripción" */}
                        <span>
                          {label && <b className="rp-doc-label">{label}</b>}
                          {label && (item.caption || isEditing) ? ' - ' : ''}
                          <EditableCell
                            value={isEditing ? item.caption || '' : stripRefTags(label ? stripLeadNumber(item.caption || '') : item.caption || '')}
                            onCommit={(v) => patchItem(item.id, { caption: v })}
                            isEditing={isEditing}
                            row={idx}
                            col={0}
                            placeholder="Pie del documento"
                            className="rp-doc-capcell"
                          />
                        </span>
                      </figcaption>
                    )}
                  </figure>
                );
              })}
            </div>
          ))
        )}
      </div>

      {isEditing && (
        <>
          <EditDock slot="options">
            <DockButton variant="primary" onClick={() => setModal({})} title="Insertar una hoja o un recorte de un PDF, plano o imagen">
              <FilePlus2 /> Agregar documento
            </DockButton>
            <DockSlider
              label="Alto máx."
              value={maxHeightMm}
              min={DOC_MAX_HEIGHT.min}
              max={DOC_MAX_HEIGHT.max}
              step={DOC_MAX_HEIGHT.step}
              unit="mm"
              onChange={onChangeMaxHeight}
            />
            <DockCheck label="Pies" checked={showCaption} onChange={onToggleCaption} />
            <label className="dock-group" title="Numera solos los documentos: Figura 01, Lámina 02… Si usás el mismo prefijo que en las fotos, comparten la numeración.">
              <span className="dock-label">Numerar como</span>
              <input
                type="text"
                list="doc-prefix-suggestions"
                value={prefix}
                placeholder="sin numerar"
                onChange={(e) => onChangePrefix(e.target.value)}
                className="w-[96px] bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-[11px] font-semibold text-white placeholder:text-white/40 outline-none focus:border-sky-300"
              />
              <datalist id="doc-prefix-suggestions">
                {[...new Set(['Plano', 'Lámina', 'Figura', 'Anexo', 'Detalle', ...PHOTO_PREFIX_SUGGESTIONS])].map((x) => <option key={x} value={x} />)}
              </datalist>
            </label>
            <span className="dock-label">
              {items.length} documento{items.length === 1 ? '' : 's'}
            </span>
          </EditDock>
          <EditDock slot="hint">
            <span>Pasá el mouse sobre un fragmento para recortarlo, cambiar bordes o moverlo</span>
            <span>Arrastrá o pegá (Ctrl+V) un PDF o imagen para agregar un documento</span>
          </EditDock>
        </>
      )}

      {modal && (
        <Suspense fallback={null}><DocumentInsertModal
          editItem={modal.edit || null}
          initialFile={modal.file || null}
          onCancel={() => setModal(null)}
          onConfirm={handleConfirm}
        /></Suspense>
      )}

      {annotateItem && (
        <Suspense fallback={null}><DocAnnotationModal
          item={annotateItem}
          onClose={() => setAnnotateItem(null)}
          onSave={(markup: MarkupItem[]) => {
            patchItem(annotateItem.id, { markup });
            setAnnotateItem(null);
          }}
        /></Suspense>
      )}
    </section>
  );
};

/** Iconito con la forma del borde (para el menú). */
const EdgeIcon: React.FC<{ edge: DocEdge }> = ({ edge }) => {
  const d = {
    straight: 'M2 8 H22',
    zigzag: 'M2 8 L5 5 L8 8 L11 5 L14 8 L17 5 L20 8 L22 6',
    wave: 'M2 7 Q5 3 8 7 T14 7 T20 7 L22 6',
    torn: 'M2 7 L4 6 L5 8 L7 6.5 L9 7.5 L10 5.5 L12 7 L14 6 L15 8 L17 6 L19 7.5 L22 6.5',
  }[edge];
  return (
    <svg viewBox="0 0 24 12" className="rp-doc-edgeic" aria-hidden>
      <path d={`${d} V12 H2 Z`} fill="currentColor" opacity=".18" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
};
