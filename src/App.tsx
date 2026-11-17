import React, { lazy, Suspense, useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, X, Move, RotateCcw, SlidersHorizontal, ZoomIn, ZoomOut } from 'lucide-react';

/** Escala mínima de las hojas (en un teléfono la hoja entera entra a ~45 %) */
const ZOOM_MIN = 0.25;
import { PhotoAnnotationsOverlay } from './components/PhotoAnnotationsOverlay';
const PhotoAnnotationModal = lazy(() => import('./components/PhotoAnnotationModal').then((m) => ({ default: m.PhotoAnnotationModal })));
import {
  ProjectData,
  RubricItem,
  PendingItem,
  PhotoItem,
  PhotoAnnotation,
  MarkupItem,
  AnnotationToolType,
  ObservationsData,
  BlockConfig,
  BlockId,
  BlockType,
  TabType,
  SignatureItem,
} from './types';
import {
  DEFAULT_PROJECT_DATA,
  DEFAULT_RUBRICS,
  DEFAULT_PENDINGS,
  DEFAULT_PHOTOS,
  DEFAULT_OBSERVATIONS,
  DEFAULT_BLOCKS,
} from './utils/defaultData';
import { HeaderBar } from './components/HeaderBar';
import { EditorSidebar } from './components/EditorSidebar';
import { ReportSheet } from './components/ReportSheet';
const TemplateModal = lazy(() => import('./components/TemplateModal').then((m) => ({ default: m.TemplateModal })));
import { DeleteBlockConfirmModal } from './components/DeleteBlockConfirmModal';
import { distributePhotosAcrossPages, MeasuredHeights } from './utils/photoPagination';
import { ReportTemplateData, getLastTemplateId, findTemplateById, clearLastTemplateId } from './utils/templateManager';
import { installRangeWheel } from './utils/rangeWheel';
const ThemePanel = lazy(() => import('./components/ThemePanel').then((m) => ({ default: m.ThemePanel })));
const PdfExportModal = lazy(() => import('./components/PdfExportModal').then((m) => ({ default: m.PdfExportModal })));
import { MentionLayer } from './components/MentionLayer';
import { DEFAULT_DIAGRAM } from './components/blocks/DiagramBlock';
import { exampleTasks } from './utils/gantt';
import { setReportData } from './utils/fields';
import { rowKey, rowMap, groupRows } from './utils/rows';
import { PageSetup, loadPageSetup, savePageSetup, normalizePageSetup, setPageGeometry, pageCss, pageSize, blockInnerWidthMm, pageWmm } from './utils/pageSetup';
import { collectPrintImages, swapForPrint, PdfPreset, isAppleTouch, applyPrintFit, savePrintFit } from './utils/printImages';
import { ReportTheme, applyTheme, loadCurrentTheme, saveCurrentTheme, normalizeTheme, themeHeadHtml } from './theme/themes';

/**
 * Orden único de bloques: ordena por `order` (desempatando por posición en la lista)
 * y renumera 0, 1, 2… sin mutar los objetos del estado. Todas las operaciones que
 * cambian el orden pasan por aquí, así el paginador, las hojas y el panel coinciden.
 */
export function normalizeBlockOrder(list: BlockConfig[]): BlockConfig[] {
  return list
    .map((b, i) => ({ b, i }))
    .sort((x, y) => (x.b.order ?? 0) - (y.b.order ?? 0) || x.i - y.i)
    .map(({ b }, i) => (b.order === i ? b : { ...b, order: i }));
}

/** Aplica un cambio a una foto, esté en el bloque que esté. */
export function patchPhotoInBlocks(list: BlockConfig[], photoId: string, patch: (p: PhotoItem) => PhotoItem): BlockConfig[] {
  return list.map((b) =>
    b.type === 'photos' && b.photos?.some((ph) => ph.id === photoId)
      ? { ...b, photos: b.photos.map((ph) => (ph.id === photoId ? patch(ph) : ph)) }
      : b
  );
}

/**
 * Cada bloque de fotos es dueño de su lista. Los informes antiguos guardaban las fotos
 * en una lista global: se pasan al primer bloque de fotos que no tenga lista propia.
 */
export function migrateLegacyPhotos(list: BlockConfig[], legacy: PhotoItem[]): BlockConfig[] {
  if (!list.some((b) => b.type === 'photos' && b.photos === undefined)) return list;
  const firstLegacy = normalizeBlockOrder(list).find((b) => b.type === 'photos' && b.photos === undefined)?.id;
  return list.map((b) =>
    b.type === 'photos' && b.photos === undefined ? { ...b, photos: b.id === firstLegacy ? legacy : [] } : b
  );
}

/**
 * Las firmas antes vivían dentro del módulo de Observaciones (tres firmas fijas).
 * Ahora son un módulo aparte. Si un informe trae showSignatures en true:
 *  - si no tiene bloque de Firmas, se crea uno justo después de Observaciones con
 *    los mismos nombres y cargos;
 *  - el título "Observaciones y Firmas" pasa a "Observaciones";
 *  - si el bloque se llamaba solo como firmas ("Firmas de Conformidad"), ese título
 *    pasa al bloque nuevo, y Observaciones se apaga si no tenía texto.
 * Devuelve null si no hay nada que migrar. Es pura: sirve para lo guardado, lo
 * importado y las plantillas, que pasan todos por acá.
 */
export function migrateObservationSignatures(
  list: BlockConfig[],
  obs: ObservationsData,
): { blocks: BlockConfig[]; observations: ObservationsData } | null {
  if (!obs?.showSignatures) return null;
  const observations: ObservationsData = { ...obs, showSignatures: false };
  const ob = list.find((b) => b.type === 'observations');
  if (!ob) return { blocks: list, observations };

  const oldTitle = ob.title || '';
  const mentionsSign = /firma/i.test(oldTitle);
  const onlySign = mentionsSign && !/observ/i.test(oldTitle);
  const hasNotes = !!(obs.notes || '').trim();
  const renamed = list.map((b) => (b.id !== ob.id ? b : {
    ...b,
    title: mentionsSign ? 'Observaciones' : b.title,
    enabled: onlySign && !hasNotes ? false : b.enabled,
  }));

  // Ya hay un módulo de Firmas: no se duplica
  if (list.some((b) => b.type === 'signatures')) return { blocks: renamed, observations };

  const stamp = Date.now().toString(36);
  const items: SignatureItem[] = [
    { name: obs.supervisorSignName, roleTitle: obs.supervisorSignTitle },
    { name: obs.directorSignName, roleTitle: obs.directorSignTitle },
    { name: obs.contractorSignName, roleTitle: obs.contractorSignTitle },
  ]
    .filter((x) => (x.name || '').trim() || (x.roleTitle || '').trim())
    .map((x, i) => ({ id: `sig-${stamp}-${i + 1}`, name: x.name || '', roleTitle: x.roleTitle || '' }));

  const sig: BlockConfig = {
    id: `signatures-${stamp}`,
    type: 'signatures',
    title: onlySign ? oldTitle : 'Firmas y Conformidades',
    pageIndex: ob.pageIndex,
    enabled: ob.enabled,
    order: (ob.order ?? 0) + 0.5,
    signaturesItems: items,
  };
  return { blocks: normalizeBlockOrder([...renamed, sig]), observations };
}

/** Verdadero desde la primera vez que `v` es true: monta un panel diferido una sola vez y lo conserva. */
function useEverTrue(v: boolean): boolean {
  const seen = useRef(false);
  if (v) seen.current = true;
  return seen.current;
}

export default function App() {
  const [projectData, setProjectData] = useState<ProjectData>(DEFAULT_PROJECT_DATA);
  const [rubrics, setRubrics] = useState<RubricItem[]>(DEFAULT_RUBRICS);
  const [pendings, setPendings] = useState<PendingItem[]>(DEFAULT_PENDINGS);
  const [photos, setPhotos] = useState<PhotoItem[]>(DEFAULT_PHOTOS);
  const [observations, setObservations] = useState<ObservationsData>(DEFAULT_OBSERVATIONS);
  const [blocks, setBlocks] = useState<BlockConfig[]>(DEFAULT_BLOCKS);
  const [blockToDeleteConfirm, setBlockToDeleteConfirm] = useState<{ id: string; title: string; type?: string } | null>(null);

  const [photoColumns, setPhotoColumns] = useState<1 | 2 | 3 | 4>(2);
  const [photoHeightMm, setPhotoHeightMm] = useState<number>(40); // 4 cm (40 mm) compact height for Page 1
  const [zoom, setZoom] = useState<number>(0.9);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const zoomAtRef = useRef<(z: number, x?: number, y?: number) => void>(() => {});
  // Tamaño real (sin escala) del contenedor de hojas, para reservar el lugar ya escalado
  const sheetsRef = useRef<HTMLDivElement>(null);
  const [sheetBox, setSheetBox] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = sheetsRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.offsetWidth, h = el.offsetHeight;
      setSheetBox((p) => (p && p.w === w && p.h === h ? p : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [sidebarWidth, setSidebarWidth] = useState<number>(380);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });
  const [extraPages, setExtraPages] = useState<number>(0);
  const [inlineEditingBlockId, setInlineEditingBlockId] = useState<BlockId | null>(null);
  const [selectedRubricIds, setSelectedRubricIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('blocks');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);
  // Tema del informe (colores, fuentes, forma): se aplica en vivo y se recuerda entre sesiones
  const [theme, setTheme] = useState<ReportTheme>(() => loadCurrentTheme());
  const [isThemeOpen, setIsThemeOpen] = useState<boolean>(false);
  const [isThemeWide, setIsThemeWide] = useState<boolean>(false);
  useEffect(() => { applyTheme(theme); saveCurrentTheme(theme); }, [theme]);

  // Hoja: tamaño de papel, orientación y márgenes (se cambia en el panel de Temas)
  const [pageSetup, setPageSetup] = useState<PageSetup>(() => loadPageSetup());
  setReportData(projectData); // los textos y el menú @ leen los campos del informe
  setPageGeometry(pageSetup); // la paginación y los bloques leen estas medidas al dibujarse
  useEffect(() => {
    savePageSetup(pageSetup);
    let el = document.getElementById('rp-page-setup') as HTMLStyleElement | null;
    if (!el) { el = document.createElement('style'); el.id = 'rp-page-setup'; }
    document.head.appendChild(el); // siempre al final: gana sobre los estilos fijos de A4
    el.textContent = pageCss(pageSetup);
  }, [pageSetup]);

  // Firmas dentro de Observaciones → módulo de Firmas aparte (ver migrateObservationSignatures).
  // Corre ante cualquier carga: datos de ejemplo, plantillas, JSON importado.
  useEffect(() => {
    const m = migrateObservationSignatures(blocks, observations);
    if (!m) return;
    setBlocks(m.blocks);
    setObservations(m.observations);
  }, [blocks, observations]);

  const handleSelectTemplate = (tplData: ReportTemplateData) => {
    if (tplData.projectData) setProjectData(tplData.projectData);
    if (tplData.rubrics) setRubrics(tplData.rubrics);
    if (tplData.pendings) setPendings(tplData.pendings);
    if (tplData.photos) setPhotos(tplData.photos);
    if (tplData.observations) setObservations(tplData.observations);
    if (tplData.blocks) setBlocks(normalizeBlockOrder(tplData.blocks));
    if (tplData.photoColumns) setPhotoColumns(tplData.photoColumns);
    if (tplData.photoHeightMm) setPhotoHeightMm(tplData.photoHeightMm);
    if (tplData.theme) setTheme(normalizeTheme(tplData.theme));
    // Las plantillas viejas no traen hoja: quedan en A4 vertical
    setPageSetup(normalizePageSetup(tplData.pageSetup));
    setExtraPages(0);
  };

  // Al abrir la web se carga la última plantilla usada (la que se cargó o guardó por última vez)
  const [startupTemplate, setStartupTemplate] = useState<string | null>(null);
  useEffect(() => {
    const id = getLastTemplateId();
    if (!id) return;
    const tpl = findTemplateById(id);
    if (!tpl) { clearLastTemplateId(); return; }
    handleSelectTemplate(tpl.data);
    setStartupTemplate(tpl.name);
    const t = setTimeout(() => setStartupTemplate(null), 9000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEditBlock = (id: BlockId | null) => {
    setInlineEditingBlockId(id);
    // No forzamos la apertura del panel lateral (isSidebarOpen) para no obstruir
    // ni difuminar la vista cuando el usuario edita in situ en la hoja.
  };

  const handleInsertBlock = (
    pageIndex: number,
    targetOrder: number,
    type: BlockType,
    afterBlockId?: string,
    column?: { target: string; side: 'left' | 'right' }
  ) => {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const newId = `${type}-${timestamp}-${randomSuffix}`;

    const defaultTitles: Record<BlockType, string> = {
      header: 'Cabecera Institucional',
      contract_metrics: 'Contrato y Métricas',
      situation: 'Rubros y Curva de Avance',
      pending: 'Cuadro de Pendencias',
      photos: 'Registro Fotográfico',
      text: 'Memoria Técnica y Descripción',
      specs: 'Especificaciones Técnicas y Ensayos',
      signatures: 'Firmas y Conformidades de Fiscalización',
      scurve: 'Curva S de Avance Físico y Financiero',
      weather: 'Condiciones Climáticas y Meteorológicas',
      observations: 'Observaciones',
      document: 'DOCUMENTOS Y PLANOS',
      cover: 'Portada',
      toc: 'Índice',
      html: 'Gráfico personalizado',
      diagram: 'Diagrama',
      gantt: 'Cronograma de obra',
      map: 'Croquis de localización',
      footer: 'Pie de Página',
    };

    const newBlock: BlockConfig = {
      id: newId,
      type,
      title: defaultTitles[type] || 'Nuevo Bloque',
      pageIndex,
      enabled: true,
      order: 0,
    };

    if (type === 'photos') {
      newBlock.photoColumns = 2;
      newBlock.photoHeightMm = 50;
      newBlock.photos = [];
    } else if (type === 'text') {
      newBlock.textSubtitle = 'Memoria técnica explicativa';
      newBlock.textContent =
        'Ingrese aquí la narrativa descriptiva, condiciones de ejecución o especificaciones de fiscalización...';
    } else if (type === 'situation') {
      newBlock.rubricsItems = JSON.parse(JSON.stringify(rubrics.length > 0 ? rubrics : DEFAULT_RUBRICS));
    } else if (type === 'pending') {
      newBlock.pendingsItems = JSON.parse(JSON.stringify(pendings.length > 0 ? pendings : DEFAULT_PENDINGS));
    } else if (type === 'specs') {
      // Sin specsItems: el bloque muestra los ítems de ejemplo hasta que se editen.
    } else if (type === 'signatures') {
      newBlock.signaturesItems = [];
    } else if (type === 'observations') {
      // Cada bloque nuevo tiene sus propias notas
      newBlock.obsNotes = '';
      newBlock.obsStyle = 'note';
    } else if (type === 'weather') {
      newBlock.weatherMode = 'day';
    } else if (type === 'gantt') {
      newBlock.ganttTasks = exampleTasks();
      newBlock.ganttColumns = 'dates';
    } else if (type === 'diagram') {
      newBlock.diagramCode = DEFAULT_DIAGRAM;
      newBlock.diagramPrefix = 'Figura';
      newBlock.diagramCaption = '';
    } else if (type === 'map') {
      newBlock.mapPrefix = '';
      newBlock.mapZoom = 17;
      newBlock.mapHeightMm = 80;
      newBlock.mapStyle = 'hybrid';
      newBlock.mapZone = 21;
      newBlock.mapSouth = true;
      // Si el informe ya tiene campos de coordenadas, el mapa los usa de entrada
      const fk = (re: RegExp) => (projectData.fields || []).find((f) => re.test(f.key))?.key;
      const e = fk(/^este|^east|^x_|longitud/), n = fk(/^norte|^north|^y_|latitud/);
      newBlock.mapEast = e ? `{${e}}` : '';
      newBlock.mapNorth = n ? `{${n}}` : '';
    } else if (type === 'html') {
      newBlock.htmlCode = '';
      newBlock.htmlPrefix = 'Figura';
    } else if (type === 'document') {
      newBlock.docItems = [];
      newBlock.docMaxHeightMm = 150;
      newBlock.docShowCaption = false;
    }

    // Se trabaja siempre sobre la lista ordenada, así "insertar después de X" cae donde se ve.
    const sorted = normalizeBlockOrder(blocks);
    // La portada va siempre al principio, y hay una sola
    if (type === 'cover') {
      const existing = sorted.find((b) => b.type === 'cover');
      if (existing) {
        setBlocks(sorted.map((b) => (b.id === existing.id ? { ...b, enabled: true } : b)));
        setInlineEditingBlockId(existing.id);
        return;
      }
      newBlock.showTitle = false;
      const updated = [newBlock, ...sorted].map((b, i) => (b.order === i ? b : { ...b, order: i }));
      setBlocks(updated);
      setInlineEditingBlockId(newId);
      return;
    }
    let insertIndex = -1;
    // Al lado de otro módulo: misma fila (columnas), justo antes o después de él
    if (column) {
      const t = sorted.findIndex((b) => b.id === column.target);
      if (t !== -1) {
        newBlock.rowWith = rowKey(sorted[t]);
        newBlock.pageIndex = sorted[t].pageIndex;
        insertIndex = column.side === 'left' ? t : t + 1;
      }
    }
    if (insertIndex === -1 && afterBlockId) {
      const foundIdx = sorted.findIndex((b) => b.id === afterBlockId);
      if (foundIdx !== -1) insertIndex = foundIdx + 1;
    }
    if (insertIndex === -1) {
      const targetIdx = sorted.findIndex((b) => b.order >= targetOrder);
      insertIndex = targetIdx !== -1 ? targetIdx : sorted.length;
    }
    sorted.splice(insertIndex, 0, newBlock);
    const updated = sorted.map((b, i) => (b.order === i ? b : { ...b, order: i }));

    setBlocks(updated);
    setInlineEditingBlockId(newId);
  };

  /* ---- Columnas (módulos lado a lado), ver utils/rows ---- */
  const handleInsertColumn = (targetId: string, side: 'left' | 'right', type: BlockType) => {
    const t = blocks.find((b) => b.id === targetId);
    if (!t) return;
    handleInsertBlock(t.pageIndex, t.order, type, undefined, { target: targetId, side });
  };
  const handleMoveColumn = (blockId: string, dir: 'left' | 'right') => {
    const sorted = normalizeBlockOrder(blocks);
    const row = rowMap(sorted).get(blockId);
    if (!row) return;
    const k = row.findIndex((b) => b.id === blockId);
    const other = row[dir === 'left' ? k - 1 : k + 1];
    if (!other) return;
    const a = sorted.findIndex((b) => b.id === blockId), b2 = sorted.findIndex((b) => b.id === other.id);
    [sorted[a], sorted[b2]] = [sorted[b2], sorted[a]];
    setBlocks(sorted.map((b, i) => (b.order === i ? b : { ...b, order: i })));
  };
  const handleUnlinkColumn = (blockId: string) => {
    const sorted = normalizeBlockOrder(blocks);
    const row = rowMap(sorted).get(blockId);
    if (!row) return;
    const rest = row.filter((b) => b.id !== blockId);
    const newKey = rest[0].id;
    let list = sorted.map((b) => {
      if (b.id === blockId) return { ...b, rowWith: undefined, colWeight: undefined };
      if (!rest.some((r) => r.id === b.id)) return b;
      return { ...b, rowWith: b.id === newKey ? undefined : newKey, ...(rest.length === 1 ? { colWeight: undefined } : {}) };
    });
    // Queda debajo de la fila, a todo el ancho
    const moved = list.find((b) => b.id === blockId)!;
    list = list.filter((b) => b.id !== blockId);
    const lastIdx = list.findIndex((b) => b.id === rest[rest.length - 1].id);
    list.splice(lastIdx + 1, 0, moved);
    setBlocks(list.map((b, i) => (b.order === i ? b : { ...b, order: i })));
  };

  const handleDeleteBlock = (blockId: string) => {
    setBlocks(normalizeBlockOrder(blocks.filter((b) => b.id !== blockId)));
    if (inlineEditingBlockId === blockId) {
      setInlineEditingBlockId(null);
    }
    setBlockToDeleteConfirm(null);
  };

  const handleRequestDeleteBlock = (blockId: string) => {
    const target = blocks.find((b) => b.id === blockId);
    if (target) {
      setBlockToDeleteConfirm({ id: target.id, title: target.title, type: target.type });
    }
  };

  /** Corta un bloque de texto en dos (lo de después del cursor pasa a un bloque nuevo, sin título). */
  const handleSplitTextBlock = (blockId: string, before: string, after: string) => {
    setBlocks((prev) => {
      const src = prev.find((b) => b.id === blockId);
      if (!src) return prev;
      const twin: BlockConfig = {
        id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'text',
        title: src.title,
        showTitle: false,
        pageIndex: src.pageIndex,
        enabled: true,
        order: src.order + 0.5,
        textContent: after,
      };
      return normalizeBlockOrder([...prev.map((b) => (b.id === blockId ? { ...b, textContent: before } : b)), twin]);
    });
    setInlineEditingBlockId(null);
  };

  const handleUpdateBlockConfig = (blockId: string, patch: Partial<BlockConfig>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, ...patch } : b))
    );
  };

  // Pasar las fotos de la lista global (formato antiguo) a su bloque, una sola vez por carga.
  // Rueda del mouse sobre cualquier deslizador = ajuste fino (un paso por clic de rueda)
  useEffect(() => installRangeWheel(), []);

  useEffect(() => {
    if (blocks.some((b) => b.type === 'photos' && b.photos === undefined)) {
      setBlocks((prev) => migrateLegacyPhotos(prev, photos));
    }
  }, [blocks, photos]);

  /** Cambia una foto en el bloque que la contiene. */
  const updatePhoto = (photoId: string, patch: (p: PhotoItem) => PhotoItem) =>
    setBlocks((prev) => patchPhotoInBlocks(prev, photoId, patch));

  // Modal state for free framing (pan and zoom)
  const [activeFreeFramingPhoto, setActiveFreeFramingPhoto] = useState<PhotoItem | null>(null);

  // Modal state for dedicated full-image annotation (baked into bitmap)
  const [activeAnnotatingPhoto, setActiveAnnotatingPhoto] = useState<PhotoItem | null>(null);
  // Mientras se edita un bloque, se anota o se encuadra una foto, el panel de Tema se oculta
  // (no tapa los editores) y vuelve solo al terminar.
  const editingSomething = !!inlineEditingBlockId || !!activeAnnotatingPhoto || !!activeFreeFramingPhoto;
  const themeVisible = isThemeOpen && !editingSomething;
  const everTheme = useEverTrue(themeVisible);
  const everTemplates = useEverTrue(isTemplateModalOpen);


  // Dragging states for Free Framing mouse drag
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const previewBoxRef = useRef<HTMLDivElement>(null);
  /* ---- Zoom con punto fijo: lo que está bajo el puntero (o entre los dedos) queda en su lugar ---- */
  const zoomAnchor = useRef<{ px: number; py: number; cx: number; cy: number; z: number } | null>(null);
  const zoomAt = (z: number, clientX?: number, clientY?: number) => {
    const sheets = sheetsRef.current;
    const vp = viewportRef.current;
    if (sheets && vp) {
      const vr = vp.getBoundingClientRect();
      const cx = clientX ?? vr.left + vr.width / 2;
      const cy = clientY ?? vr.top + vr.height / 2;
      const r = sheets.getBoundingClientRect();
      const z0 = zoomRef.current || 1;
      // Punto de la hoja (sin escala) que está bajo el puntero
      zoomAnchor.current = { px: (cx - r.left) / z0, py: (cy - r.top) / z0, cx, cy, z };
    }
    setZoom(z);
  };
  zoomAtRef.current = zoomAt;
  useLayoutEffect(() => {
    const a = zoomAnchor.current;
    const sheets = sheetsRef.current;
    const vp = viewportRef.current;
    if (!a || !sheets || !vp || Math.abs(a.z - zoom) > 1e-6) return;
    zoomAnchor.current = null;
    const prev = vp.style.scrollBehavior;
    vp.style.scrollBehavior = 'auto';
    const r = sheets.getBoundingClientRect();
    vp.scrollLeft += r.left + a.px * zoom - a.cx;
    vp.scrollTop += r.top + a.py * zoom - a.cy;
    vp.style.scrollBehavior = prev;
  }, [zoom]);
  const viewportRef = useRef<HTMLElement>(null);

  // Zona visible de las hojas (sin el panel lateral): el panel flotante de edición se centra
  // y se limita a ella, así no se monta sobre el panel de edición
  useEffect(() => {
    const el = viewportRef.current as HTMLElement | null;
    if (!el) return;
    const root = document.documentElement;
    const publish = () => {
      const r = el.getBoundingClientRect();
      root.style.setProperty('--rp-view-left', `${Math.round(r.left)}px`);
      root.style.setProperty('--rp-view-width', `${Math.round(r.width)}px`);
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    window.addEventListener('resize', publish);
    return () => { ro.disconnect(); window.removeEventListener('resize', publish); };
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handleNativeWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        // Trackpad (pellizco en Mac = ctrl+rueda con pasos chicos): proporcional; rueda: de a 5 %
        const z0 = zoomRef.current;
        const z = Math.abs(e.deltaY) < 30
          ? z0 * Math.exp(-e.deltaY * 0.01)
          : z0 + (e.deltaY < 0 ? 0.05 : -0.05);
        zoomAt(Number(Math.max(ZOOM_MIN, Math.min(2.5, z)).toFixed(3)), e.clientX, e.clientY);
      }
    };
    el.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleNativeWheel);
    };
  }, []);

  /* ---- Celular: hojas al ancho de la pantalla y zoom con dos dedos ----
     La hoja mide 21 cm o más: en un teléfono no entra a 90 %. El zoom de Safari
     tampoco sirve (la app no se desplaza como página, solo su panel), así que el
     gesto de pellizcar maneja la escala de las hojas, como la rueda en la computadora. */
  const fitWidth = () => {
    const el = viewportRef.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const avail = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const sheetPx = (sheetBox?.w ?? (pageWmm() * 96) / 25.4) + 2;
    setZoom(Math.max(ZOOM_MIN, Math.min(2.5, Math.floor((avail / sheetPx) * 100) / 100)));
  };
  const fitRef = useRef(fitWidth);
  fitRef.current = fitWidth;
  useEffect(() => {
    // Al abrir en pantallas angostas, y al girar el teléfono
    const narrow = () => window.innerWidth < 768;
    if (narrow()) requestAnimationFrame(() => fitRef.current());
    const onTurn = () => { if (narrow()) setTimeout(() => fitRef.current(), 250); };
    window.addEventListener('orientationchange', onTurn);
    return () => window.removeEventListener('orientationchange', onTurn);
  }, []);
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    let g: { d0: number; z0: number; cx: number; cy: number; sx: number; sy: number } | null = null;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const r = el.getBoundingClientRect();
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
      g = { d0: dist(e.touches), z0: zoomRef.current, cx, cy, sx: el.scrollLeft + cx, sy: el.scrollTop + cy };
      el.style.scrollBehavior = 'auto';
    };
    const move = (e: TouchEvent) => {
      if (!g || e.touches.length !== 2) return;
      e.preventDefault();
      const z = Math.max(ZOOM_MIN, Math.min(2.5, Number((g.z0 * dist(e.touches) / g.d0).toFixed(3))));
      // El punto entre los dedos queda en su lugar
      const r = el.getBoundingClientRect();
      zoomAtRef.current(z, r.left + g.cx, r.top + g.cy);
    };
    const end = (e: TouchEvent) => {
      if (g && e.touches.length < 2) {
        g = null;
        setZoom((z) => Number(z.toFixed(2)));
        setTimeout(() => { el.style.scrollBehavior = 'smooth'; }, 100);
      }
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, []);

  // iPad / iPhone: al enfocar un cuadro de texto, Safari desplaza la página ENTERA hacia
  // arriba para mostrar el cursor y después no la devuelve: la barra superior (guardar,
  // exportar) quedaba fuera de la pantalla sin forma de volver. La app no tiene desplazamiento
  // de página (solo sus paneles), así que se la vuelve a su lugar en cuanto se mueve,
  // salvo mientras el teclado en pantalla está abierto (ahí Safari necesita mostrar el cursor).
  useEffect(() => {
    const vv = window.visualViewport;
    const keyboardOpen = () => !!vv && vv.height < window.innerHeight - 80;
    const reset = () => {
      if (keyboardOpen()) return;
      const se = document.scrollingElement || document.documentElement;
      if (window.scrollY || se.scrollTop || document.body.scrollTop) {
        window.scrollTo(0, 0);
        se.scrollTop = 0;
        document.body.scrollTop = 0;
      }
    };
    const later = () => window.setTimeout(reset, 60);
    window.addEventListener('scroll', reset, { passive: true });
    window.addEventListener('focusout', later);
    vv?.addEventListener('resize', later);
    vv?.addEventListener('scroll', reset);
    return () => {
      window.removeEventListener('scroll', reset);
      window.removeEventListener('focusout', later);
      vv?.removeEventListener('resize', later);
      vv?.removeEventListener('scroll', reset);
    };
  }, []);

  // Pegar fotos (Ctrl/⌘+V) en el bloque de fotos que se está editando.
  // En iPad, Safari no avisa el "pegar" si no hay un cuadro de texto activo: ahí se
  // lee el portapapeles directamente (Safari muestra su globito "Pegar" para confirmar).
  // El botón "Pegar foto" del panel hace lo mismo (evento rp-paste-photos).
  useEffect(() => {
    const activePhotoBlock = () => blocks.find((b) => b.id === inlineEditingBlockId && b.type === 'photos');
    let lastRead = 0;

    const addBlobs = (blobs: Blob[]) => {
      const block = activePhotoBlock();
      if (!block || !blobs.length) return;
      Promise.all(
        blobs.map((blob, k) => new Promise<PhotoItem | null>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const src = ev.target?.result as string;
            resolve(src ? {
              id: `photo-paste-${Date.now()}-${k}-${Math.random().toString(36).slice(2, 6)}`,
              src,
              caption: `Recorte pegado (${new Date().toLocaleTimeString()})`,
              objectFit: 'cover',
              objectPosition: 'center',
              scale: 1,
              offsetX: 0,
              offsetY: 0,
            } : null);
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        }))
      ).then((list) => {
        const valid = list.filter((x): x is PhotoItem => !!x);
        if (!valid.length) return;
        setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, photos: [...(b.photos ?? []), ...valid] } : b)));
      });
    };

    const readClipboard = async () => {
      if (!activePhotoBlock() || !navigator.clipboard?.read) return;
      lastRead = Date.now();
      try {
        const items = await navigator.clipboard.read();
        const blobs: Blob[] = [];
        for (const it of items) {
          const type = it.types.find((t) => t.startsWith('image/'));
          if (type) blobs.push(await it.getType(type));
        }
        addBlobs(blobs);
      } catch {
        /* el usuario no confirmó, o no hay imagen */
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (!activePhotoBlock()) return;
      const blobs: Blob[] = [];
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].kind === 'file' && items[i].type.startsWith('image/')) {
            const f = items[i].getAsFile();
            if (f) blobs.push(f);
          }
        }
      }
      if (!blobs.length) return;
      e.preventDefault();
      // Ya se leyó el portapapeles por el atajo de teclado: no se repite
      if (Date.now() - lastRead < 1500) return;
      addBlobs(blobs);
    };

    const isTyping = (t: EventTarget | null) =>
      !!(t as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
    // Safari en iPad/Mac (no Chrome): el ⌘V sin cuadro de texto activo no genera "paste"
    const isSafari = /^((?!chrome|crios|android|fxios|edg).)*safari/i.test(navigator.userAgent);
    const handleKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'v' || e.shiftKey || e.altKey) return;
      if (!activePhotoBlock() || isTyping(e.target) || !isSafari) return;
      readClipboard();
    };
    const handleButton = () => { readClipboard(); };

    window.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleKey);
    window.addEventListener('rp-paste-photos', handleButton);
    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('rp-paste-photos', handleButton);
    };
  }, [blocks, inlineEditingBlockId]);

  // Keyboard shortcut to close framing modal
  useEffect(() => {
    if (!activeFreeFramingPhoto) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveFreeFramingPhoto(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFreeFramingPhoto]);

  // Compute total pages dynamically based on blocks and photo distribution
  // Altos reales de los bloques y tarjetas de fotos, medidos en pantalla (sin el zoom de la vista).
  // El paginador los usa en lugar de estimaciones: así cada bloque ocupa exactamente lo que ocupa.
  const [measuredHeights, setMeasuredHeights] = useState<MeasuredHeights>({ blocks: {}, photos: {}, chunks: {}, textFrame: {} });
  /* Medición congelada: mientras se imprime o está abierta la vista para compartir, Safari vuelve a
     dibujar la página con otra disposición para armar el PDF. Si se midiera en ese momento, el
     programa repartiría de nuevo los bloques (salían 3 hojas a medio llenar en vez de 2). */
  const freezeMeasure = useRef(false);
  useEffect(() => {
    const before = () => { freezeMeasure.current = true; };
    const after = () => { if (!document.documentElement.classList.contains('rp-share-view')) freezeMeasure.current = false; };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); };
  }, []);
  useEffect(() => {
    const root = document.getElementById('report-print-container');
    if (!root) return;
    const PX_PER_MM = 96 / 25.4;
    let raf = 0;
    const read = () => {
      raf = 0;
      if (freezeMeasure.current) return;
      const next: MeasuredHeights = { blocks: {}, photos: {}, chunks: {}, textFrame: {} };
      const mm = (px: number) => Math.round((px / PX_PER_MM) * 10) / 10;
      // Trozos de texto: su alto no depende de en qué hoja caen, así que se guardan
      // (y se conservan los ya medidos mientras el bloque está en edición).
      root.querySelectorAll<HTMLElement>('[data-text-chunk]').forEach((el) => {
        next.chunks![el.dataset.textChunk!] = mm(el.offsetHeight);
      });
      // Marco de cada tramo de texto: del borde del bloque al primer trozo, y del último al borde
      root.querySelectorAll<HTMLElement>('[data-text-part]').forEach((el) => {
        const [id, idx] = el.dataset.textPart!.split('|');
        const cs = el.querySelectorAll<HTMLElement>('[data-text-chunk]');
        if (!cs.length) return;
        const r = el.getBoundingClientRect();
        const k = r.height ? el.offsetHeight / r.height : 1; // quita el zoom de la vista
        const head = mm((cs[0].getBoundingClientRect().top - r.top) * k);
        const tail = mm((r.bottom - cs[cs.length - 1].getBoundingClientRect().bottom) * k);
        const f = (next.textFrame![id] ??= {});
        if (idx === '0') f.head0 = head; else f.headN = head;
        f.tail = Math.max(f.tail ?? 0, tail);
      });
      root.querySelectorAll<HTMLElement>('[data-measure-block]').forEach((el) => {
        next.blocks[el.dataset.measureBlock!] = Math.round((el.offsetHeight / PX_PER_MM) * 10) / 10;
      });
      root.querySelectorAll<HTMLElement>('[data-photo-card]').forEach((el) => {
        next.photos[el.dataset.photoCard!] = Math.round((el.offsetHeight / PX_PER_MM) * 10) / 10;
      });
      setMeasuredHeights((prev) => {
        const same = (a: Record<string, number>, b: Record<string, number>) =>
          Object.keys(a).length === Object.keys(b).length &&
          Object.keys(b).every((k) => a[k] !== undefined && Math.abs(a[k] - b[k]) < 0.3);
        // Los trozos y marcos ya medidos se conservan (un bloque en edición no los muestra)
        next.chunks = { ...prev.chunks, ...next.chunks };
        const frames: NonNullable<MeasuredHeights['textFrame']> = { ...prev.textFrame };
        for (const [id, f] of Object.entries(next.textFrame!)) frames[id] = { ...frames[id], ...f };
        next.textFrame = frames;
        const flat = (t?: Record<string, { head0?: number; headN?: number; tail?: number }>) => {
          const o: Record<string, number> = {};
          for (const [id, f] of Object.entries(t ?? {})) for (const [k, v] of Object.entries(f)) if (v !== undefined) o[id + k] = v;
          return o;
        };
        return same(prev.blocks, next.blocks) && same(prev.photos, next.photos) &&
          same(prev.chunks ?? {}, next.chunks) && same(flat(prev.textFrame), flat(next.textFrame))
          ? prev
          : next;
      });
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(read); };
    const ro = new ResizeObserver(schedule);
    let rescanRaf = 0;
    const observeAll = () => {
      rescanRaf = 0;
      ro.disconnect();
      root.querySelectorAll('[data-measure-block],[data-photo-card],[data-text-chunk],[data-text-part]').forEach((el) => ro.observe(el));
      schedule();
    };
    const mo = new MutationObserver(() => { if (!rescanRaf) rescanRaf = requestAnimationFrame(observeAll); });
    mo.observe(root, { childList: true, subtree: true });
    observeAll();
    return () => {
      ro.disconnect();
      mo.disconnect();
      if (raf) cancelAnimationFrame(raf);
      if (rescanRaf) cancelAnimationFrame(rescanRaf);
    };
  }, []);

  const photoDistribution = useMemo(() => {
    return distributePhotosAcrossPages(
      photos,
      blocks,
      rubrics,
      pendings,
      observations,
      photoColumns,
      photoHeightMm,
      measuredHeights
    );
  }, [photos, blocks, rubrics, pendings, observations, photoColumns, photoHeightMm, measuredHeights, pageSetup]);

  const { effectiveBlocks, totalRequiredPages } = photoDistribution;

  const totalPages = Math.max(totalRequiredPages, 1) + extraPages;

  // Photo helpers
  const handleUpdatePhotoFit = (id: string, fit: 'cover' | 'contain') =>
    updatePhoto(id, (p) => ({ ...p, objectFit: fit }));

  const handleUpdatePhotoPosition = (id: string, position: string) =>
    updatePhoto(id, (p) => ({ ...p, objectPosition: position }));

  const handleUpdatePhotoField = (id: string, patch: Partial<PhotoItem>) =>
    updatePhoto(id, (p) => ({ ...p, ...patch }));

  // Free Framing Drag & Zoom Handlers (Clean Pan & Zoom)
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !activeFreeFramingPhoto) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setDragStart({ x: e.clientX, y: e.clientY });

    const scale = activeFreeFramingPhoto.scale || 1;
    const sensitivity = 0.6 / scale;
    const newOffsetX = Math.max(-150, Math.min(150, (activeFreeFramingPhoto.offsetX || 0) + dx * sensitivity));
    const newOffsetY = Math.max(-150, Math.min(150, (activeFreeFramingPhoto.offsetY || 0) + dy * sensitivity));

    const updated = {
      ...activeFreeFramingPhoto,
      offsetX: Math.round(newOffsetX),
      offsetY: Math.round(newOffsetY),
    };
    setActiveFreeFramingPhoto(updated);
    handleUpdatePhotoField(updated.id, { offsetX: updated.offsetX, offsetY: updated.offsetY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Save annotated image bitmap directly into photo.src and clear vector overlay to avoid double rendering
  const handleSaveAnnotatedBitmap = (
    photoId: string,
    newSrc: string,
    originalSrc?: string,
    annotations?: PhotoAnnotation[],
    markup?: MarkupItem[]
  ) => {
    updatePhoto(photoId, (p) => ({
      ...p,
      src: newSrc,
      originalSrc: originalSrc || p.originalSrc || p.src,
      annotations: annotations !== undefined ? annotations : [],
      // Marcas vectoriales: permiten volver a editar la foto más tarde
      markup: markup && markup.length ? markup : undefined,
    }));
    setActiveAnnotatingPhoto(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!activeFreeFramingPhoto) return;
    const currentScale = activeFreeFramingPhoto.scale || 1;
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    const newScale = Math.max(1, Math.min(3, Number((currentScale + delta).toFixed(2))));

    const updated = { ...activeFreeFramingPhoto, scale: newScale };
    setActiveFreeFramingPhoto(updated);
    handleUpdatePhotoField(updated.id, { scale: newScale });
  };

  // Block reordering within document sequence
  const handleMoveBlockOrder = (blockId: BlockId, direction: 'up' | 'down') => {
    // Se mueve de a filas: un módulo en columnas sube o baja con toda su fila
    const sorted = normalizeBlockOrder(blocks);
    const groups = groupRows(sorted);
    const gi = groups.findIndex((g) => g.some((b) => b.id === blockId));
    if (gi === -1) return;
    const ti = direction === 'up' ? gi - 1 : gi + 1;
    if (ti < 0 || ti >= groups.length) return;
    [groups[gi], groups[ti]] = [groups[ti], groups[gi]];
    setBlocks(groups.flat().map((b, i) => (b.order === i ? b : { ...b, order: i })));
  };

  const handleMoveBlockPage = (blockId: BlockId, targetPageIndex: number) => {
    // El informe fluye solo: "pasar a la hoja siguiente" activa el salto de página del bloque
    // y "volver a la hoja anterior" lo desactiva. No se guardan números de hoja manuales.
    if (targetPageIndex < 0) return;
    const current = effectiveBlocks.find((b) => b.id === blockId);
    const goesForward = !current || targetPageIndex > current.pageIndex;
    setBlocks(blocks.map((b) => (b.id === blockId ? { ...b, forceNewPage: goesForward } : b)));
  };

  const handleToggleForcePageBreak = (blockId: BlockId) => {
    const newBlocks = blocks.map((b) =>
      b.id === blockId ? { ...b, forceNewPage: !b.forceNewPage } : b
    );
    setBlocks(newBlocks);
  };

  const handleTogglePhotoBreak = (photoId: string) => {
    updatePhoto(photoId, (p) => ({ ...p, breakAfter: !p.breakAfter }));
  };

  const handleAddPage = () => {
    setExtraPages((prev) => prev + 1);
  };

  const handleLoadExample = () => {
    setProjectData(DEFAULT_PROJECT_DATA);
    setRubrics(DEFAULT_RUBRICS);
    setPendings(DEFAULT_PENDINGS);
    setPhotos(DEFAULT_PHOTOS);
    setObservations(DEFAULT_OBSERVATIONS);
    setBlocks(DEFAULT_BLOCKS);
    setPhotoHeightMm(40);
    setExtraPages(0);
  };

  // iPhone/iPad: si se imprime desde el menú de Safari (sin pasar por el botón), igual se achican las hojas
  useEffect(() => {
    if (!isAppleTouch()) return;
    let undo: (() => void) | null = null;
    const before = () => {
      const h = document.documentElement.classList;
      // En la vista para compartir no se achica: así se ve si Safari respeta el margen cero
      if (!h.contains('rp-print-fit') && !h.contains('rp-share-view')) undo = applyPrintFit();
    };
    const after = () => { undo?.(); undo = null; };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); };
  }, []);

  /* Imprimir / PDF: primero la ventana que muestra el peso y deja achicar las fotos */
  const [pdfOpen, setPdfOpen] = useState(false);
  const handlePrint = () => {
    // Cierra el editor antes de medir: así las fotos están en su tamaño final
    if (inlineEditingBlockId) setInlineEditingBlockId(null);
    const root = document.getElementById('report-print-container');
    // En iPhone/iPad siempre se muestra: ahí se elige cuánto achicar las hojas para que entren
    if (!isAppleTouch() && (!root || root.querySelectorAll('img').length === 0)) {
      setTimeout(() => window.print(), 60);
      return;
    }
    setTimeout(() => setPdfOpen(true), 60);
  };
  const doPrint = async (preset: PdfPreset, fit?: number) => {
    setPdfOpen(false);
    if (fit != null) savePrintFit(fit);
    await new Promise((r) => setTimeout(r, 80));
    const root = document.getElementById('report-print-container');
    let restore = () => {};
    try {
      if (root) restore = await swapForPrint(collectPrintImages(root), preset);
    } catch (e) {
      console.warn('No se pudieron achicar las fotos; se imprime con las originales.', e);
    }
    // Vuelve a las fotos originales al cerrar la impresión (en Safari window.print no espera)
    const unfit = applyPrintFit(fit);
    const done = () => {
      window.removeEventListener('afterprint', done);
      // En iPhone/iPad Safari avisa "terminó" antes de dibujar: se vuelve a las fotos originales recién al tocar de nuevo la app
      if (isAppleTouch()) {
        const later = () => { window.removeEventListener('pointerdown', later, true); restore(); unfit(); };
        window.addEventListener('pointerdown', later, true);
      } else { restore(); unfit(); }
    };
    window.addEventListener('afterprint', done);
    window.print();
  };

  /* Vista para compartir (iPhone/iPad): solo las hojas, sin la interfaz ni separación, con el
     desplazamiento en el documento. Así el menú Compartir de Safari → Opciones → PDF
     (o Imprimir) toma las hojas tal cual, en vector. */
  const [shareView, setShareView] = useState<{ bar: boolean } | null>(null);
  const shareUndo = useRef<(() => void) | null>(null);
  const openShareView = async (preset: PdfPreset, fit: number) => {
    setPdfOpen(false);
    if (inlineEditingBlockId) setInlineEditingBlockId(null);
    await new Promise((r) => setTimeout(r, 80));
    const root = document.getElementById('report-print-container');
    let restoreImgs = () => {};
    try {
      if (root) restoreImgs = await swapForPrint(collectPrintImages(root), preset);
    } catch (e) {
      console.warn('No se pudieron achicar las fotos; quedan las originales.', e);
    }
    const html = document.documentElement;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    const oldMeta = meta?.getAttribute('content') ?? null;
    // El ancho de la vista = el de la hoja: Safari no deja espacio a los costados
    const wPx = Math.round((pageSize(pageSetup).w * 96) / 25.4);
    meta?.setAttribute('content', `width=${wPx}, initial-scale=${Math.min(1, window.innerWidth / wPx).toFixed(3)}`);
    // Primero se congela la medición: con la página ya repartida, nada la vuelve a repartir
    freezeMeasure.current = true;
    // En el PDF de Safari cada hoja se achica para entrar en su margen fijo (≈ 13 mm)
    html.style.setProperty('--rp-share-fit', String(fit / 100));
    html.classList.add('rp-share-view');
    window.scrollTo(0, 0);
    shareUndo.current = () => {
      html.classList.remove('rp-share-view');
      html.style.removeProperty('--rp-share-fit');
      freezeMeasure.current = false;
      if (meta && oldMeta != null) meta.setAttribute('content', oldMeta);
      restoreImgs();
    };
    setShareView({ bar: true });
  };
  const closeShareView = () => {
    shareUndo.current?.();
    shareUndo.current = null;
    setShareView(null);
  };
  useEffect(() => {
    if (!shareView) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeShareView(); };
    // Con la barra oculta: dos toques (o doble click) la vuelven a mostrar
    let last = 0;
    const onTap = (e: PointerEvent) => {
      if ((e.target as Element)?.closest?.('.rp-share-bar')) return;
      const t = Date.now();
      if (t - last < 350) setShareView({ bar: true });
      last = t;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerup', onTap);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerup', onTap); };
  }, [shareView]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExportJson = () => {
    const payload = {
      projectData,
      rubrics,
      pendings,
      photos,
      observations,
      blocks,
      photoColumns,
      photoHeightMm,
      theme,
      pageSetup,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_obra_${projectData.reportDate || 'semanal'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (parsed.projectData) setProjectData(parsed.projectData);
        if (parsed.rubrics) setRubrics(parsed.rubrics);
        if (parsed.pendings) setPendings(parsed.pendings);
        if (parsed.photos) setPhotos(parsed.photos);
        if (parsed.observations) setObservations(parsed.observations);
        if (parsed.blocks) setBlocks(normalizeBlockOrder(parsed.blocks));
        if (parsed.photoColumns) setPhotoColumns(parsed.photoColumns);
        if (parsed.photoHeightMm) setPhotoHeightMm(parsed.photoHeightMm);
        if (parsed.theme) setTheme(normalizeTheme(parsed.theme));
        setPageSetup(normalizePageSetup(parsed.pageSetup));
      } catch (err) {
        console.error('Archivo de proyecto JSON inválido:', err);
      }
    };
    reader.readAsText(file);
  };

  const handleExportHtml = () => {
    const printArea = document.getElementById('report-print-container');
    if (!printArea) return;

    const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${projectData.project || 'Reporte de Obra A4'}</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
${printArea.querySelector('.katex') ? '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.css">' : ''}
${themeHeadHtml(theme)}
<style>
@page { size: ${pageSize(pageSetup).w}mm ${pageSize(pageSetup).h}mm; margin: 0; }
body { margin: 0; padding: 0; background: #f1f5f9; font-family: 'Plus Jakarta Sans', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.sheet-page-wrapper { display: block; width: 210mm; margin: 15px auto; }
.a4-sheet { width: 210mm; min-height: 297mm; height: 297mm; background: #fff; margin: 0 auto; box-shadow: 0 4px 14px rgba(0,0,0,0.1); overflow: hidden; display: flex; flex-direction: column; }
@media print {
  body { background: transparent; }
  #report-print-container { display: block !important; width: 210mm !important; margin: 0 auto !important; padding: 0 !important; }
  .sheet-page-wrapper { display: block !important; margin: 0 !important; width: 210mm !important; height: 297mm !important; page-break-inside: avoid !important; break-inside: avoid !important; page-break-after: always !important; break-after: page !important; }
  .sheet-page-wrapper + .sheet-page-wrapper { page-break-before: always !important; break-before: page !important; }
  .sheet-page-wrapper:last-child { page-break-after: auto !important; break-after: auto !important; }
  .a4-sheet { margin: 0 !important; box-shadow: none !important; border: none !important; height: 297mm !important; page-break-inside: avoid !important; break-inside: avoid !important; }
  .no-print { display: none !important; }
}
${pageCss(pageSetup)}
</style>
</head>
<body>
${printArea.innerHTML}
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_semanal_${projectData.reportDate || 'a4'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-dvh max-h-dvh w-screen overflow-hidden flex flex-col bg-slate-100 text-slate-800 print:h-auto print:max-h-none print:w-full print:overflow-visible print:block print:bg-white">
      {/* Top Application Bar */}
      <HeaderBar
        totalPages={totalPages}
        zoom={zoom}
        onZoomChange={(z) => zoomAt(z)}
        onPrint={handlePrint}
        onExportHtml={handleExportHtml}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onLoadExample={handleLoadExample}
        onOpenTemplates={() => setIsTemplateModalOpen(true)}
        onOpenTheme={() => { if (editingSomething) { setInlineEditingBlockId(null); setIsThemeOpen(true); } else setIsThemeOpen((v) => !v); }}
        isThemeOpen={themeVisible}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
      />

      {/* Main Workspace: Left Editor Sidebar + Right A4 Paper Preview */}
      <div className="flex-1 flex overflow-hidden min-h-0 print:h-auto print:max-h-none print:overflow-visible print:block relative">
        {/* Mobile Backdrop when sidebar is open */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 top-[52px] bg-slate-950/40 backdrop-blur-xs z-30 lg:hidden no-print cursor-pointer"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Cerrar panel de edición"
          />
        )}

        <EditorSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          blocks={effectiveBlocks}
          projectData={projectData}
          rubrics={rubrics}
          pendings={pendings}
          photos={photos}
          observations={observations}
          photoColumns={photoColumns}
          photoHeightMm={photoHeightMm}
          totalPages={totalPages}
          sidebarWidth={sidebarWidth}
          onSidebarWidthChange={setSidebarWidth}
          zoom={zoom}
          onZoomChange={(z) => zoomAt(z)}
          onUpdateBlocks={(list) => setBlocks(normalizeBlockOrder(list))}
          onUpdateProjectData={(patch) =>
            setProjectData((prev) => ({ ...prev, ...patch }))
          }
          onUpdateRubrics={setRubrics}
          onUpdatePendings={setPendings}
          onUpdatePhotos={setPhotos}
          onUpdateObservations={(patch) =>
            setObservations((prev) => ({ ...prev, ...patch }))
          }
          onUpdatePhotoSettings={(cols, height) => {
            setPhotoColumns(cols);
            setPhotoHeightMm(height);
          }}
          onAddPage={handleAddPage}
          activeTab={activeTab}
          onSetActiveTab={setActiveTab}
          onOpenFreeFraming={(photo) => setActiveFreeFramingPhoto(photo)}
          onOpenAnnotate={(photo) => setActiveAnnotatingPhoto(photo)}
          onInsertBlock={handleInsertBlock}
          onDeleteBlock={handleDeleteBlock}
          onRequestDeleteBlock={handleRequestDeleteBlock}
          onUpdateBlockConfig={handleUpdateBlockConfig}
          onSetInlineEditingBlockId={handleEditBlock}
          pagePhotosMap={photoDistribution.pagePhotosMap}
          photoPagesByBlock={photoDistribution.blockPhotoPagesMap}
          textParts={photoDistribution.textParts}
        />

        {/* Floating Quick Edit Button when Editor is hidden (especially convenient for mobile devices) */}
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="fixed bottom-6 left-4 z-40 bg-[#0b455b] hover:bg-[#125873] text-white px-4 py-2.5 rounded-full shadow-2xl border border-white/20 flex items-center gap-2 font-bold text-xs cursor-pointer no-print transition-all hover:scale-105 active:scale-95 animate-in fade-in"
            title="Abrir panel de edición"
          >
            <SlidersHorizontal className="w-4 h-4 text-[#f4c84a]" />
            <span>Editar Reporte</span>
          </button>
        )}

        {/* Celular: escala de las hojas (el panel lateral y la barra superior no la muestran) */}
          <div className="md:hidden fixed bottom-6 right-3 z-40 no-print flex items-center gap-0.5 bg-[#0b455b] text-white rounded-full shadow-2xl border border-white/20 px-1.5 py-1 text-xs font-bold">
            <button type="button" onClick={() => zoomAt(Math.max(ZOOM_MIN, Number((zoom - 0.1).toFixed(2))))} className="p-1.5 rounded-full active:bg-white/15" title="Reducir"><ZoomOut className="w-4 h-4" /></button>
            <span className="font-mono text-[#f4c84a] w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => zoomAt(Math.min(2.5, Number((zoom + 0.1).toFixed(2))))} className="p-1.5 rounded-full active:bg-white/15" title="Aumentar"><ZoomIn className="w-4 h-4" /></button>
            <button type="button" onClick={fitWidth} className="p-1.5 rounded-full active:bg-white/15" title="Ajustar al ancho de la pantalla"><Maximize2 className="w-4 h-4" /></button>
          </div>

        {/* Right Preview Viewport */}
        <main
          ref={viewportRef as any}
          id="report-scroll-viewport"
          tabIndex={0}
          onMouseDown={(e) => {
            // Clic en el vacío (fuera de la hoja): guarda lo que se estaba escribiendo y cierra el editor
            if (!inlineEditingBlockId) return;
            const t = e.target as Element;
            // Los eventos de React también suben desde ventanas abiertas con portal (importar CSV,
            // menús, el panel de edición) aunque no estén dentro de la vista: esos no cierran nada.
            // Antes, un clic en la barra de desplazamiento de la vista previa del importador cerraba todo.
            if (!e.currentTarget.contains(t)) return;
            if (t.closest('.a4-sheet, .block-rail, button, input, select, textarea, a, label, [role="button"]')) return;
            (document.activeElement as HTMLElement | null)?.blur?.();
            setInlineEditingBlockId(null);
          }}
          className="flex-1 h-full overflow-y-scroll overflow-x-auto preview-scrollbar bg-slate-300/70 p-4 md:p-8 outline-none select-none print:p-0 print:m-0 print:overflow-visible print:bg-transparent print:h-auto print:block print:static"
          style={{ scrollBehavior: 'smooth', touchAction: 'pan-x pan-y' }}
        >
          <div className="w-full flex flex-col items-center min-h-max pb-36 print:p-0 print:m-0 print:block print:min-h-0 print:w-full print:pb-0">
            {/* Caja con el tamaño ya escalado: con zoom alto las hojas se pueden recorrer
                con la barra horizontal (antes la parte izquierda quedaba fuera de alcance) */}
            <div
              className="self-start mx-auto shrink-0 print:!w-auto print:!h-auto print:!m-0"
              style={sheetBox ? { width: sheetBox.w * zoom, height: sheetBox.h * zoom } : undefined}
            >
            <div
              id="report-print-container"
              ref={sheetsRef}
              className="w-max flex flex-col items-center origin-top-left transition-transform duration-100 ease-out print:block print:m-0 print:p-0 print:w-[var(--rp-page-w)] print:transform-none"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
              }}
            >
              {Array.from({ length: totalPages }).map((_, pageIdx) => (
                <ReportSheet
                  key={`page-${pageIdx}`}
                  pageIndex={pageIdx}
                  totalPages={totalPages}
                  blocks={effectiveBlocks}
                  projectData={projectData}
                  rubrics={rubrics}
                  pendings={pendings}
                  photos={photos}
                  observations={observations}
                  photoColumns={photoColumns}
                  photoHeightMm={photoHeightMm}
                  inlineEditingBlockId={inlineEditingBlockId}
                  onSetInlineEditingBlockId={handleEditBlock}
                  selectedRubricIds={selectedRubricIds}
                  onSetSelectedRubricIds={setSelectedRubricIds}
                  onUpdateProjectData={(patch) =>
                    setProjectData((prev) => ({ ...prev, ...patch }))
                  }
                  onUpdateRubrics={setRubrics}
                  onUpdatePendings={setPendings}
                  onUpdatePhotos={setPhotos}
                  onUpdateObservations={(patch) =>
                    setObservations((prev) => ({ ...prev, ...patch }))
                  }
                  onMoveBlockOrder={handleMoveBlockOrder}
                  onMoveBlockPage={handleMoveBlockPage}
                  onToggleForcePageBreak={handleToggleForcePageBreak}
                  onUpdatePhotoFit={handleUpdatePhotoFit}
                  onUpdatePhotoPosition={handleUpdatePhotoPosition}
                  onUpdatePhotoField={handleUpdatePhotoField}
                  onOpenFreeFraming={(photo) => setActiveFreeFramingPhoto(photo)}
                  onOpenAnnotate={(photo) => setActiveAnnotatingPhoto(photo)}
                  onUpdatePhotoSettings={(cols, height) => {
                    setPhotoColumns(cols);
                    setPhotoHeightMm(height);
                  }}
                  pagePhotosMap={photoDistribution.pagePhotosMap}
                  photoPagesByBlock={photoDistribution.blockPhotoPagesMap}
                  textParts={photoDistribution.textParts}
                  onSplitTextBlock={handleSplitTextBlock}
                  onTogglePhotoBreak={handleTogglePhotoBreak}
                  onInsertBlock={handleInsertBlock}
                  onInsertColumn={handleInsertColumn}
                  onMoveColumn={handleMoveColumn}
                  onUnlinkColumn={handleUnlinkColumn}
                  onDeleteBlock={handleDeleteBlock}
                  onRequestDeleteBlock={handleRequestDeleteBlock}
                  onUpdateBlockConfig={handleUpdateBlockConfig}
                />
              ))}
            </div>
            </div>


          </div>
        </main>

        {/* Lugar reservado para el panel de Temas: la hoja se corre y no queda tapada */}
        {themeVisible && <div className={`hidden md:block ${isThemeWide ? 'w-[600px]' : 'w-[360px]'} shrink-0 no-print`} aria-hidden="true" />}
      </div>

      {/* Free Framing Modal (Dedicated Pan & Zoom) */}
      {activeFreeFramingPhoto && (
        <div className="fixed inset-0 z-[1400] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 no-print overflow-y-auto"
          title="Clic fuera: guarda y cierra"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setActiveFreeFramingPhoto(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col my-auto" title="">
            {/* Header */}
            <div className="bg-[#0b455b] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#f4c84a] flex items-center justify-center text-[#0b455b]">
                  <Maximize2 className="w-4 h-4 font-bold" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-wide">
                    Encuadre y Zoom de Fotografía
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Ajusta el zoom y arrastra para reubicar la imagen en su marco de hoja
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveFreeFramingPhoto(null)}
                className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                title="Cerrar ventana"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Instructions badge */}
              <div className="bg-sky-50 border border-sky-200 text-sky-900 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2.5">
                <Move className="w-4 h-4 shrink-0 text-[#0b455b]" />
                <span>
                  <strong>Arrastra con el mouse</strong> sobre la imagen para moverla (Pan), y usa la <strong>rueda del ratón</strong> para hacer Zoom.
                </span>
              </div>

              {/* Live Interactive Drag Preview Box */}
              <div
                ref={previewBoxRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                className="w-full bg-slate-950 border-2 border-dashed border-slate-300 rounded-xl overflow-hidden flex items-center justify-center relative cursor-grab active:cursor-grabbing select-none shadow-inner"
                style={{ aspectRatio: `${(blockInnerWidthMm() / photoColumns) / photoHeightMm}` }}
              >
                <img
                  src={activeFreeFramingPhoto.src}
                  alt="preview"
                  className="w-full h-full pointer-events-none transition-transform duration-75 ease-out"
                  style={{
                    objectFit: activeFreeFramingPhoto.objectFit || 'cover',
                    objectPosition: activeFreeFramingPhoto.objectPosition || 'center',
                    transform: `scale(${activeFreeFramingPhoto.scale || 1}) translate(${activeFreeFramingPhoto.offsetX || 0}%, ${activeFreeFramingPhoto.offsetY || 0}%)`,
                  }}
                  referrerPolicy="no-referrer"
                />

                <div className="absolute bottom-2 left-2 bg-slate-950/85 text-white text-[11px] px-2.5 py-1 rounded-md backdrop-blur-xs flex items-center gap-2 pointer-events-none">
                  <span>Zoom: {Math.round((activeFreeFramingPhoto.scale || 1) * 100)}%</span>
                  <span className="text-slate-500">|</span>
                  <span>X: {activeFreeFramingPhoto.offsetX || 0}%, Y: {activeFreeFramingPhoto.offsetY || 0}%</span>
                </div>
              </div>

              {/* Zoom slider control */}
              <div className="space-y-1.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center font-bold text-slate-700">
                  <span>Ajuste Rápido de Zoom:</span>
                  <span className="font-mono text-[#0b455b] bg-white px-2 py-0.5 rounded border border-slate-200">
                    {Math.round((activeFreeFramingPhoto.scale || 1) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={activeFreeFramingPhoto.scale || 1}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    const updated = { ...activeFreeFramingPhoto, scale: val };
                    setActiveFreeFramingPhoto(updated);
                    handleUpdatePhotoField(updated.id, { scale: val });
                  }}
                  className="w-full h-1 bg-slate-300 rounded-full appearance-none cursor-pointer accent-[#0b455b]"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    const resetObj = { ...activeFreeFramingPhoto, scale: 1, offsetX: 0, offsetY: 0 };
                    setActiveFreeFramingPhoto(resetObj);
                    handleUpdatePhotoField(resetObj.id, { scale: 1, offsetX: 0, offsetY: 0 });
                  }}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restablecer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFreeFramingPhoto(null)}
                  className="px-5 py-2 bg-[#0b455b] hover:bg-[#16556e] text-white rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer"
                >
                  Guardar y Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Full-Image Annotation Modal (Baked into Bitmap) */}
      {activeAnnotatingPhoto && (
        <Suspense fallback={null}>
          <PhotoAnnotationModal
            photo={activeAnnotatingPhoto}
            onClose={() => setActiveAnnotatingPhoto(null)}
            onSave={handleSaveAnnotatedBitmap}
          />
        </Suspense>
      )}

      {/* Template Manager Modal */}
      {everTemplates && (
        <Suspense fallback={null}>
        <TemplateModal
          isOpen={isTemplateModalOpen}
          onClose={() => setIsTemplateModalOpen(false)}
          currentData={{
            projectData,
            rubrics,
            pendings,
            photos,
            observations,
            blocks,
            photoColumns,
            photoHeightMm,
            theme,
            pageSetup,
          }}
          onSelectTemplate={handleSelectTemplate}
        />
        </Suspense>
      )}

      {/* Aviso: se abrió con la última plantilla */}
      {startupTemplate && (
        <div className="no-print fixed bottom-4 left-4 z-[1250] max-w-[420px] bg-[#0b455b] text-white rounded-xl shadow-2xl ring-1 ring-white/15 px-4 py-3 text-xs flex items-start gap-3">
          <div className="flex-1">
            <div className="font-bold text-[12.5px]">Se abrió tu última plantilla</div>
            <div className="text-slate-200 mt-0.5">“{startupTemplate}”. Cambiala cuando quieras desde <b>Plantillas</b>.</div>
            <button type="button" onClick={() => { clearLastTemplateId(); setStartupTemplate(null); }}
              className="mt-2 text-[11px] font-semibold text-[#f4c84a] hover:underline cursor-pointer">
              No abrirla automáticamente la próxima vez
            </button>
          </div>
          <button type="button" onClick={() => setStartupTemplate(null)} className="text-slate-300 hover:text-white text-base leading-none cursor-pointer" aria-label="Cerrar">×</button>
        </div>
      )}

      {/* Panel de Temas (derecha; la hoja queda visible para ver los cambios en vivo) */}
      {shareView?.bar && createPortal(
        <div className="rp-share-bar" role="toolbar" aria-label="Vista para compartir">
          <div className="rp-share-txt">
            <b>Vista para compartir</b>
            <span>Ocultá esta barra y usá Compartir de Safari → Opciones → PDF. Dos toques en la hoja la vuelven a mostrar.</span>
          </div>
          <button type="button" onClick={() => setShareView({ bar: false })}>Ocultar barra</button>
          <button type="button" className="is-exit" onClick={closeShareView}>Salir</button>
        </div>,
        document.body,
      )}
      {/* @ en cualquier campo de texto: citas y datos del informe */}
      <MentionLayer />

      {pdfOpen && (
        <Suspense fallback={null}><PdfExportModal
          totalPages={totalPages}
          onClose={() => setPdfOpen(false)}
          onPrint={doPrint}
          onShareView={openShareView}
          fileName={`reporte_semanal_${projectData.reportDate || 'a4'}.pdf`}
          title={projectData.project || 'Reporte semanal de obra'}
        /></Suspense>
      )}
      {everTheme && <Suspense fallback={null}><ThemePanel isOpen={themeVisible} theme={theme} onChange={setTheme} pageSetup={pageSetup} onPageSetupChange={setPageSetup} onClose={() => setIsThemeOpen(false)} onWideChange={setIsThemeWide} /></Suspense>}

      {/* Floating Block Deletion Confirmation Modal */}
      <DeleteBlockConfirmModal
        isOpen={!!blockToDeleteConfirm}
        blockTitle={blockToDeleteConfirm?.title || ''}
        blockType={blockToDeleteConfirm?.type}
        onConfirm={() => {
          if (blockToDeleteConfirm) {
            handleDeleteBlock(blockToDeleteConfirm.id);
          }
        }}
        onCancel={() => setBlockToDeleteConfirm(null)}
      />
    </div>
  );
}
