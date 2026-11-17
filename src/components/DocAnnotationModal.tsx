/**
 * DocAnnotationModal — editor de anotaciones vectoriales sobre fragmentos de
 * documento (planos, láminas, contratos).
 *
 * Decisiones de diseño:
 *  - Las marcas NO se hornean en la imagen: quedan como MarkupItem[] editables.
 *  - El dibujo se delega a <MarkupShape>, el mismo que usa la hoja, así lo que
 *    se edita es exactamente lo que se imprime.
 *  - Ningún filtro SVG: cuestan un rasterizado por figura al arrastrar y hacen
 *    que la marca se imprima como imagen. Los trazos llevan halo blanco.
 *  - El plano se muestra en SVG (vectorial) cuando MuPDF está disponible.
 *  - Herramienta "lupa": zona + callout ampliado de verdad, en círculo o
 *    rectángulo, y el callout puede salirse del plano.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Square, Circle, MoveUpRight, Type, Undo2, Redo2, Trash2, RotateCcw, Check,
  MousePointer2, Minus, Plus, Highlighter, Pencil, Hash, Ruler, ZoomIn, Copy, Palette,
} from 'lucide-react';
import { DocItem, MarkupItem, MarkupKind } from '../types';
import { scaleOf, bboxOf, magGeom } from '../utils/markup';
import { MarkupShape, markupZOrder } from './DocMarkupShape';
import { renderItemImage } from '../utils/pdf';
import { itemSvgUrl } from '../utils/pdfSvg';
import { useZoneImages, ZoneImg } from '../utils/magnify';
import './ui-kit.css';
import './photo-annotation.css';
import './doc-annotation-modal.css';

/* ---------- Tipos ---------- */
type DocTool = 'select' | MarkupKind;
type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'p1' | 'p2' | 'callout';

interface DocAnnotationModalProps {
  item: DocItem;
  onClose: () => void;
  onSave: (markup: MarkupItem[]) => void;
}

/* ---------- Herramientas ---------- */
const TOOLS: { id: DocTool; label: string; key: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'select',    label: 'Seleccionar y editar', key: 'V', icon: MousePointer2 },
  { id: 'arrow',     label: 'Flecha',               key: 'A', icon: MoveUpRight },
  { id: 'line',      label: 'Línea',                key: 'L', icon: Minus },
  { id: 'dim',       label: 'Cota (medida)',        key: 'M', icon: Ruler },
  { id: 'rect',      label: 'Rectángulo',           key: 'R', icon: Square },
  { id: 'ellipse',   label: 'Elipse',               key: 'E', icon: Circle },
  { id: 'highlight', label: 'Resaltador',           key: 'H', icon: Highlighter },
  { id: 'pen',       label: 'Lápiz libre',          key: 'P', icon: Pencil },
  { id: 'text',      label: 'Texto',                key: 'T', icon: Type },
  { id: 'marker',    label: 'Marcador numerado',    key: 'N', icon: Hash },
  { id: 'magnifier', label: 'Lupa / Callout',       key: 'Z', icon: ZoomIn },
];

const COLORS = [
  { hex: '#ef4444', label: 'Rojo · crítico' },
  { hex: '#f59e0b', label: 'Ámbar · observación' },
  { hex: '#facc15', label: 'Amarillo · resaltar' },
  { hex: '#10b981', label: 'Verde · conforme' },
  { hex: '#3b82f6', label: 'Azul · técnico' },
  { hex: '#ffffff', label: 'Blanco' },
  { hex: '#0f172a', label: 'Negro' },
];

type Style = Pick<MarkupItem, 'color' | 'width' | 'opacity' | 'fill' | 'dashed' | 'fontSize' | 'textBg'>;
const DEFAULT_STYLE: Record<string, Style> = {
  arrow:     { color: '#ef4444', width: 4 },
  line:      { color: '#ef4444', width: 4 },
  rect:      { color: '#ef4444', width: 4 },
  ellipse:   { color: '#ef4444', width: 4 },
  highlight: { color: '#facc15', width: 4, opacity: 0.4 },
  pen:       { color: '#ef4444', width: 3 },
  text:      { color: '#facc15', width: 4, fontSize: 24, textBg: true },
  marker:    { color: '#ef4444', width: 4, fontSize: 24 },
  dim:       { color: '#facc15', width: 3, fontSize: 22 },
  magnifier: { color: '#f4c84a', width: 2 },
};

/** Qué controles muestra la barra de opciones para cada tipo de marca. */
const HAS = {
  width:   (k: DocTool) => k !== 'select' && k !== 'text' && k !== 'marker',
  fill:    (k: DocTool) => k === 'rect' || k === 'ellipse',
  dashed:  (k: DocTool) => k === 'rect' || k === 'ellipse' || k === 'line' || k === 'arrow',
  font:    (k: DocTool) => k === 'text' || k === 'marker' || k === 'dim',
  dimText: (k: DocTool) => k === 'dim',
  lupa:    (k: DocTool) => k === 'magnifier',
};

const newId = () => `dm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** El callout de la lupa puede salirse del plano, pero no irse al infinito. */
const clampOut = (v: number) => Math.max(-2, Math.min(3, v));

/** Tipos cuya geometría es una caja (se redimensionan con 8 handles). */
const BOX_KINDS: MarkupKind[] = ['rect', 'ellipse', 'highlight', 'magnifier'];
/** Tipos definidos por dos extremos. */
const SEG_KINDS: MarkupKind[] = ['line', 'arrow', 'dim'];

/* =====================================================================
   Modal
   ===================================================================== */
export const DocAnnotationModal: React.FC<DocAnnotationModalProps> = (props) => <Editor {...props} />;

type Drag =
  | { mode: 'draw'; start: { x: number; y: number } }
  | { mode: 'move'; id: string; start: { x: number; y: number }; orig: MarkupItem }
  | { mode: 'handle'; id: string; handle: HandleId; start: { x: number; y: number }; orig: MarkupItem };

const Editor: React.FC<DocAnnotationModalProps> = ({ item, onClose, onSave }) => {
  const [tool, setTool] = useState<DocTool>('arrow');
  const [styles, setStyles] = useState<Record<string, Style>>(DEFAULT_STYLE);
  const [items, setItems] = useState<MarkupItem[]>(
    () => (item.markup ? JSON.parse(JSON.stringify(item.markup)) : []),
  );
  const [selId, setSelId] = useState<string | null>(null);
  const [past, setPast] = useState<MarkupItem[][]>([]);
  const [future, setFuture] = useState<MarkupItem[][]>([]);
  const [editingText, setEditingText] = useState<{ id: string; value: string } | null>(null);
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const [viewSrc, setViewSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [isVec, setIsVec] = useState(false);
  // Vista: zoom con la rueda y desplazamiento (para acomodar la lupa incluso fuera del plano)
  const [view, setView] = useState({ z: 1, x: 0, y: 0 });
  const viewRef = useRef(view); viewRef.current = view;
  const stageRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const pan = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  // Lupa
  const [lupZoom, setLupZoom] = useState(3);
  const [lupShape, setLupShape] = useState<'rect' | 'circle'>('rect');
  const [lupGuide, setLupGuide] = useState(true);

  const svgRef = useRef<SVGSVGElement>(null);
  const dimRef = useRef<HTMLInputElement>(null);
  const drag = useRef<Drag | null>(null);
  const raf = useRef<number | null>(null);
  const pending = useRef<{ x: number; y: number; shift: boolean } | null>(null);
  const live = useRef<MarkupItem | null>(null);
  const setLiveView = useRef<(d: MarkupItem | null) => void>(() => undefined);
  const bindLive = useCallback((set: (d: MarkupItem | null) => void) => { setLiveView.current = set; }, []);
  const [liveId, setLiveId] = useState<string | null>(null);
  const itemsRef = useRef(items); itemsRef.current = items;
  const showLive = (d: MarkupItem | null) => { live.current = d; setLiveView.current(d); };

  const W = size.w, H = size.h;
  const S = scaleOf(W, H);
  const hit = 12 * S;
  const sel = items.find((x) => x.id === selId) ?? null;
  /** La barra de opciones edita la selección si hay una; si no, la herramienta. */
  const activeKind: DocTool = sel ? sel.kind : tool;
  const curStyle: Style = sel ?? styles[tool] ?? {};

  /* ---------- Imagen del documento ----------
     Primero el SVG vectorial; si no hay, la imagen de siempre a 1800 px.
     Las dos vienen como data URL (lo necesita "Exportar HTML"). Acá se pasan a
     blob: para no arrastrar megas de base64 en el DOM y para que la lupa pueda
     referenciar la misma imagen varias veces barato. */
  useEffect(() => {
    let off = false;
    let blob: string | null = null;
    setBusy(true);
    setErr(null);

    itemSvgUrl(item)
      .then((svg) => { if (!off) setIsVec(!!svg); return svg ?? renderItemImage(item, 1800); })
      .then(async (dataUrl) => {
        const img = new Image();
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = () => rej(new Error('img'));
          img.src = dataUrl;
        });
        if (off) return;
        // Espacio de trabajo de ~1800 px en el lado mayor. Las marcas escalan
        // con el tamaño (scaleOf), así que vale cualquier tamaño con la misma
        // proporción; un SVG trae su tamaño en puntos, que puede ser chico.
        const nw = img.naturalWidth || 1200, nh = img.naturalHeight || 800;
        const k = 1800 / Math.max(nw, nh);
        setSize({ w: Math.round(nw * k), h: Math.round(nh * k) });
        try {
          const b = await (await fetch(dataUrl)).blob();
          if (off) return;
          blob = URL.createObjectURL(b);
          setViewSrc(blob);
        } catch {
          setViewSrc(dataUrl);
        }
        setBusy(false);
      })
      .catch(() => { if (!off) { setBusy(false); setErr('No se pudo dibujar el documento.'); } });

    return () => { off = true; if (blob) URL.revokeObjectURL(blob); };
  }, [item.id, item.src, item.rotation]);

  /* ---------- Historial ---------- */
  const push = useCallback((next: MarkupItem[]) => {
    setPast((p) => [...p.slice(-29), itemsRef.current]);
    setFuture([]);
    setItems(next);
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p;
      setFuture((f) => [itemsRef.current, ...f.slice(0, 29)]);
      setItems(p[p.length - 1]);
      setSelId(null);
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      setPast((p) => [...p.slice(-29), itemsRef.current]);
      setItems(f[0]);
      setSelId(null);
      return f.slice(1);
    });
  }, []);

  /* ---------- Edición de la marca seleccionada ---------- */
  const patchSel = useCallback((patch: Partial<MarkupItem>) => {
    if (!selId) return;
    push(itemsRef.current.map((x) => (x.id === selId ? { ...x, ...patch } : x)));
  }, [selId, push]);

  /**
   * Igual que patchSel pero agrupa: escribir una medida letra por letra deja
   * UNA entrada en el historial, no una por tecla.
   */
  const coalesce = useRef<{ id: string; t: number } | null>(null);
  const patchSelTyping = useCallback((patch: Partial<MarkupItem>) => {
    if (!selId) return;
    const now = Date.now();
    const fresh = !coalesce.current || coalesce.current.id !== selId || now - coalesce.current.t > 900;
    coalesce.current = { id: selId, t: now };
    const next = itemsRef.current.map((x) => (x.id === selId ? { ...x, ...patch } : x));
    if (fresh) push(next); else setItems(next);
  }, [selId, push]);

  /** Aplica estilo: a la selección si hay, y siempre al default de la herramienta. */
  const applyStyle = useCallback((patch: Partial<Style>) => {
    const k = sel ? sel.kind : tool;
    if (k !== 'select') setStyles((s) => ({ ...s, [k]: { ...(s[k] || {}), ...patch } }));
    if (sel) patchSel(patch);
  }, [sel, tool, patchSel]);

  const patchLupa = useCallback((patch: Partial<NonNullable<MarkupItem['magnifier']>>) => {
    if (patch.zoom !== undefined) setLupZoom(patch.zoom);
    if (patch.shape !== undefined) setLupShape(patch.shape);
    if (patch.guide !== undefined) setLupGuide(patch.guide);
    if (sel?.kind === 'magnifier' && sel.magnifier) {
      patchSel({ magnifier: { ...sel.magnifier, ...patch } });
    }
  }, [sel, patchSel]);

  const deleteItem = useCallback((id: string) => {
    push(itemsRef.current.filter((x) => x.id !== id));
    setSelId(null);
  }, [push]);

  const duplicateSel = useCallback(() => {
    if (!sel) return;
    const copy: MarkupItem = {
      ...JSON.parse(JSON.stringify(sel)),
      id: newId(),
      x1: clamp01(sel.x1 + 0.03), y1: clamp01(sel.y1 + 0.03),
      x2: clamp01(sel.x2 + 0.03), y2: clamp01(sel.y2 + 0.03),
    };
    if (copy.magnifier) {
      copy.magnifier = {
        ...copy.magnifier,
        calloutX: copy.magnifier.calloutX + 0.03,
        calloutY: copy.magnifier.calloutY + 0.03,
      };
    }
    push([...itemsRef.current, copy]);
    setSelId(copy.id);
  }, [sel, push]);

  const commitSave = useCallback(() => onSave(itemsRef.current), [onSave]);

  /* ---------- Atajos ---------- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') (e.target as HTMLElement).blur();
        return;
      }
      const k = e.key.toUpperCase();
      if (k === 'ESCAPE') { if (selId) setSelId(null); else onClose(); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'Z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'Y') { e.preventDefault(); redo(); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'D') { e.preventDefault(); duplicateSel(); return; }
      if ((k === 'DELETE' || k === 'BACKSPACE') && selId) { e.preventDefault(); deleteItem(selId); return; }
      const t = TOOLS.find((x) => x.key === k);
      if (t && !e.ctrlKey && !e.metaKey) { setTool(t.id); setSelId(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selId, onClose, undo, redo, deleteItem, duplicateSel]);

  /* ---------- Vista: zoom con la rueda y desplazamiento ----------
     La rueda acerca o aleja alrededor del puntero (hasta 25 %, para ver
     lugar fuera del plano donde dejar el callout de una lupa). Se desplaza
     arrastrando el fondo oscuro, con el botón del medio o con Espacio. */
  const zoneImgs = useZoneImages(item, items, W * Math.max(1, Math.min(2, view.z)), 1, !isVec && !!viewSrc);
  const zoomAt = useCallback((nz: number, cx?: number, cy?: number) => {
    const el = innerRef.current, st = stageRef.current;
    const v = viewRef.current;
    const z = Math.max(0.25, Math.min(6, nz));
    if (!el || !st) { setView({ ...v, z }); return; }
    const r = el.getBoundingClientRect();
    const sr = st.getBoundingClientRect();
    const px = cx ?? sr.left + sr.width / 2, py = cy ?? sr.top + sr.height / 2;
    // Origen de la transformación arriba a la izquierda: el punto bajo el puntero queda quieto
    const qx = (px - r.left) / v.z, qy = (py - r.top) / v.z;
    const baseX = r.left - v.x, baseY = r.top - v.y;
    setView({ z, x: px - baseX - z * qx, y: py - baseY - z * qy });
  }, []);
  const fitView = useCallback(() => setView({ z: 1, x: 0, y: 0 }), []);

  useEffect(() => {
    const st = stageRef.current;
    if (!st) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(viewRef.current.z * Math.exp(-dy * 0.0015), e.clientX, e.clientY);
    };
    st.addEventListener('wheel', onWheel, { passive: false });
    return () => st.removeEventListener('wheel', onWheel);
  }, [zoomAt, busy]);

  useEffect(() => {
    const typing = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !typing(e.target)) { e.preventDefault(); setSpaceDown(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceDown(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  /** Desplazar la vista: fondo del lienzo, botón del medio o Espacio + arrastre */
  const onStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const onBg = e.target === e.currentTarget;
    if (!(e.button === 1 || spaceDown || (e.button === 0 && onBg))) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pan.current = { x: e.clientX, y: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y };
  };
  const onStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pan.current;
    if (!p) return;
    setView((v) => ({ ...v, x: p.vx + e.clientX - p.x, y: p.vy + e.clientY - p.y }));
  };
  const onStagePointerUp = () => { pan.current = null; };

  /* ---------- Coordenadas ---------- */
  const rel = useCallback((e: { clientX: number; clientY: number }) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || !r.width || !r.height) return { x: 0, y: 0 };
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }, []);

  /* ---------- Empezar un gesto ---------- */
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const pt = rel(e);
    const target = e.target as Element;
    const handleId = target.getAttribute('data-handle') as HandleId | null;
    const markId = target.getAttribute('data-mk');

    // 1) Agarró un handle de la marca seleccionada
    if (handleId && sel) {
      drag.current = { mode: 'handle', id: sel.id, handle: handleId, start: pt, orig: sel };
      setLiveId(sel.id);
      showLive(sel);
      return;
    }

    // 2) Clic sobre una marca existente → seleccionar y mover
    if (markId) {
      const found = itemsRef.current.find((x) => x.id === markId);
      if (found) {
        setSelId(found.id);
        setTool('select');
        drag.current = { mode: 'move', id: found.id, start: pt, orig: found };
        setLiveId(found.id);
        showLive(found);
        if (found.kind === 'dim') setTimeout(() => dimRef.current?.focus(), 30);
        return;
      }
    }

    // 3) Clic al vacío con la herramienta de selección → deseleccionar
    if (tool === 'select') { setSelId(null); return; }

    // 4) Marcas de un solo clic. El estilo ya trae color y grosor; los
    //    valores de acá son sólo el respaldo si la herramienta no define uno.
    const st: Style = styles[tool] ?? { color: '#ef4444', width: 4 };
    if (tool === 'text') {
      const it: MarkupItem = { id: newId(), kind: 'text', x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y, text: '', ...st } as MarkupItem;
      push([...itemsRef.current, it]);
      setSelId(it.id);
      setEditingText({ id: it.id, value: '' });
      return;
    }
    if (tool === 'marker') {
      const nums = itemsRef.current.filter((x) => x.kind === 'marker').map((x) => x.num ?? 0);
      const it: MarkupItem = {
        id: newId(), kind: 'marker', x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y,
        num: Math.max(0, ...nums) + 1, ...st,
      } as MarkupItem;
      push([...itemsRef.current, it]);
      setSelId(it.id);
      return;
    }

    // 5) Arrastre para dibujar
    const base: MarkupItem = {
      id: newId(), kind: tool as MarkupKind,
      x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y,
      ...st,
      ...(tool === 'pen' ? { points: [pt.x, pt.y] } : null),
      ...(tool === 'magnifier' ? { magnifier: { calloutX: pt.x, calloutY: pt.y, zoom: lupZoom, shape: lupShape, guide: lupGuide } } : null),
    } as MarkupItem;
    drag.current = { mode: 'draw', start: pt };
    setSelId(null);
    setLiveId(null);
    showLive(base);
  };

  /* ---------- Mover el puntero (throttle por frame) ---------- */
  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag.current || !live.current) return;
    pending.current = { x: e.clientX, y: e.clientY, shift: e.shiftKey };
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = null;
      const p = pending.current;
      if (!p || !drag.current || !live.current) return;
      const pt = rel({ clientX: p.x, clientY: p.y });
      const d = drag.current;

      if (d.mode === 'draw') {
        const next = { ...live.current };
        if (next.kind === 'pen') {
          next.points = [...(next.points || []), pt.x, pt.y];
          next.x2 = pt.x; next.y2 = pt.y;
        } else {
          next.x2 = pt.x; next.y2 = pt.y;
          if (p.shift) {
            const dx = Math.abs(pt.x - d.start.x) * W, dy = Math.abs(pt.y - d.start.y) * H;
            if (next.kind === 'rect' || next.kind === 'ellipse' || next.kind === 'magnifier') {
              // Cuadrado / círculo perfecto
              const s = Math.max(dx / W, dy / H);
              next.x2 = d.start.x + Math.sign(pt.x - d.start.x || 1) * s;
              next.y2 = d.start.y + Math.sign(pt.y - d.start.y || 1) * s;
            } else if (dx > dy) next.y2 = d.start.y;
            else next.x2 = d.start.x;
          }
        }
        if (next.kind === 'magnifier' && next.magnifier) {
          // Mientras se dibuja la zona, el callout se para al costado
          const zw = Math.abs(next.x2 - next.x1), zh = Math.abs(next.y2 - next.y1);
          next.magnifier = {
            ...next.magnifier,
            calloutX: Math.min(next.x1, next.x2) + zw + 0.04,
            calloutY: Math.min(next.y1, next.y2) - (zh * next.magnifier.zoom - zh) / 2,
          };
        }
        showLive(next);
        return;
      }

      if (d.mode === 'move') {
        const dx = pt.x - d.start.x, dy = pt.y - d.start.y;
        const o = d.orig;
        showLive({
          ...o,
          x1: clamp01(o.x1 + dx), y1: clamp01(o.y1 + dy),
          x2: clamp01(o.x2 + dx), y2: clamp01(o.y2 + dy),
          points: o.points?.map((v, i) => clamp01(v + (i % 2 === 0 ? dx : dy))),
          magnifier: o.magnifier
            ? { ...o.magnifier, calloutX: clampOut(o.magnifier.calloutX + dx), calloutY: clampOut(o.magnifier.calloutY + dy) }
            : undefined,
        });
        return;
      }

      // d.mode === 'handle'
      showLive(applyHandle(d.orig, d.handle, pt, d.start, p.shift));
    });
  }, [W, H, rel]);

  /* ---------- Soltar ---------- */
  const onPointerUp = () => {
    if (raf.current) { cancelAnimationFrame(raf.current); raf.current = null; }
    const d = drag.current;
    const l = live.current;
    drag.current = null;
    setLiveId(null);
    showLive(null);
    if (!d || !l) return;

    if (d.mode === 'draw') {
      const tiny = Math.abs(l.x2 - l.x1) * W < 3 && Math.abs(l.y2 - l.y1) * H < 3;
      if (tiny && l.kind !== 'pen') return;
      push([...itemsRef.current, l]);
      setSelId(l.id);
      if (l.kind === 'dim') setTimeout(() => dimRef.current?.focus(), 30);
      return;
    }
    push(itemsRef.current.map((x) => (x.id === d.id ? l : x)));
  };

  /* ---------- Render ---------- */
  // Misma estructura y clases (pa-*) que el anotador de fotos: los dos editores
  // se ven idénticos y cualquier ajuste a photo-annotation.css vale para ambos.
  return createPortal(
    <div
      className="fixed inset-0 z-[1400] bg-slate-950/85 flex items-center justify-center p-3 md:p-5 no-print"
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="pa-modal is-doc">
        {/* ---- Encabezado ---- */}
        <div className="pa-head">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#f4c84a] flex items-center justify-center text-[#0b455b] shrink-0"><Palette className="w-4 h-4" /></div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm tracking-wide">Anotar documento</h3>
              <p className="text-[11px] text-slate-300 truncate">{item.fileName || 'Documento'} · las marcas quedan vectoriales y se pueden volver a editar</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10" title="Cerrar sin guardar (Esc)"><X className="w-5 h-5" /></button>
        </div>

        {/* ---- Propiedades: editan la selección si hay una, si no la herramienta ---- */}
        <div className="pa-props">
          {activeKind === 'select' ? (
            <span className="pa-props-hint">Hacé clic en una marca para <b>moverla</b>, <b>redimensionarla</b> o <b>cambiarle el estilo</b>.</span>
          ) : (
            <>
              <span className="pa-props-title">
                {sel ? 'Marca seleccionada' : TOOLS.find((t) => t.id === activeKind)?.label}
              </span>

              <div className="pa-group">
                {COLORS.map((c) => (
                  <button
                    key={c.hex} type="button" title={c.label}
                    className={`pa-swatch${curStyle.color === c.hex ? ' on' : ''}`}
                    style={{ background: c.hex }}
                    onClick={() => applyStyle({ color: c.hex })}
                  />
                ))}
              </div>

              {HAS.width(activeKind) && (
                <label className="pa-range" title="Grosor del trazo">
                  Grosor
                  <input type="range" min="1" max="10" step="1" value={curStyle.width ?? 4}
                    onChange={(e) => applyStyle({ width: +e.target.value })} />
                  <b>{curStyle.width ?? 4}</b>
                </label>
              )}
              {HAS.font(activeKind) && (
                <label className="pa-range" title="Tamaño del texto">
                  Texto
                  <input type="range" min="12" max="60" step="2" value={curStyle.fontSize ?? 24}
                    onChange={(e) => applyStyle({ fontSize: +e.target.value })} />
                  <b>{curStyle.fontSize ?? 24}</b>
                </label>
              )}
              {HAS.fill(activeKind) && (
                <label className="pa-check">
                  <input type="checkbox" checked={!!curStyle.fill}
                    onChange={(e) => applyStyle({ fill: e.target.checked })} />
                  Relleno
                </label>
              )}
              {HAS.dashed(activeKind) && (
                <label className="pa-check">
                  <input type="checkbox" checked={!!curStyle.dashed}
                    onChange={(e) => applyStyle({ dashed: e.target.checked })} />
                  Punteado
                </label>
              )}

              {/* Medida de la cota */}
              {HAS.dimText(activeKind) && (
                <label className="pa-range" title="Lo que dice la cota: 3,50 m, Ø 20, L=12,4…">
                  Medida
                  <input
                    ref={dimRef}
                    type="text"
                    className="pa-dim"
                    placeholder={sel ? 'ej. 3,50 m' : 'dibujá la cota primero'}
                    value={sel?.kind === 'dim' ? (sel.text || '') : ''}
                    disabled={sel?.kind !== 'dim'}
                    onChange={(e) => patchSelTyping({ text: e.target.value })}
                  />
                </label>
              )}

              {/* Lupa */}
              {HAS.lupa(activeKind) && (
                <>
                  <div className="ui-seg dam-shape" role="group" aria-label="Forma de la lupa">
                    <button type="button" className={(sel?.magnifier?.shape ?? lupShape) !== 'circle' ? 'on' : ''}
                      title="Zona y callout rectangulares" onClick={() => patchLupa({ shape: 'rect' })}><Square /></button>
                    <button type="button" className={(sel?.magnifier?.shape ?? lupShape) === 'circle' ? 'on' : ''}
                      title="Zona y callout circulares" onClick={() => patchLupa({ shape: 'circle' })}><Circle /></button>
                  </div>
                  <label className="pa-range" title="Cuántas veces se amplía la zona">
                    Zoom
                    <input type="range" min="2" max="8" step="1" value={sel?.magnifier?.zoom ?? lupZoom}
                      onChange={(e) => patchLupa({ zoom: +e.target.value })} />
                    <b>×{sel?.magnifier?.zoom ?? lupZoom}</b>
                  </label>
                  <label className="pa-check">
                    <input type="checkbox" checked={sel?.magnifier?.guide ?? lupGuide}
                      onChange={(e) => patchLupa({ guide: e.target.checked })} />
                    Guías
                  </label>
                </>
              )}

              {sel && (
                <div className="pa-group ml-auto">
                  <button type="button" className="pa-btn" title="Duplicar (Ctrl+D)" onClick={duplicateSel}><Copy className="w-3.5 h-3.5" /> Duplicar</button>
                  <button type="button" className="pa-btn danger" title="Eliminar (Supr)" onClick={() => deleteItem(sel.id)}><Trash2 className="w-3.5 h-3.5" /> Eliminar</button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ---- Herramientas + lienzo ---- */}
        <div className="pa-main">
          <div className="pa-tools">
            {TOOLS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`pa-tool${tool === t.id && !sel ? ' on' : ''}`}
                  title={`${t.label} (${t.key})`}
                  onClick={() => { setTool(t.id); setSelId(null); }}
                >
                  <Icon className="w-4 h-4" />
                  <span className="pa-tool-key">{t.key}</span>
                </button>
              );
            })}
            <div className="pa-tools-sep" />
            <button type="button" className="pa-tool" title="Deshacer (Ctrl+Z)" disabled={!past.length} onClick={undo}><Undo2 className="w-4 h-4" /></button>
            <button type="button" className="pa-tool" title="Rehacer (Ctrl+Y)" disabled={!future.length} onClick={redo}><Redo2 className="w-4 h-4" /></button>
          </div>

          <div
            className={`pa-stage dam-stage${spaceDown ? ' is-pan' : ''}`}
            ref={stageRef}
            onPointerDownCapture={(e) => { if (e.button === 1 || spaceDown) onStagePointerDown(e); }}
            onPointerDown={onStagePointerDown}
            onPointerMove={onStagePointerMove}
            onPointerUp={onStagePointerUp}
            onPointerCancel={onStagePointerUp}
            onAuxClick={(e) => e.preventDefault()}
          >
            {busy && <div className="dam-loading">Dibujando el documento…</div>}
            {err && <div className="dam-error">{err}</div>}
            {!busy && !err && viewSrc && (
              <div className="dam-canvas-inner" ref={innerRef}
                style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}>
                <img className="dam-img" src={viewSrc} alt="Documento" draggable={false} />
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${W} ${H}`}
                  className="dam-svg"
                  style={{ cursor: tool === 'select' ? 'default' : 'crosshair' }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                >
                  <ItemsLayer items={items} W={W} H={H} hit={hit} hideId={liveId} src={viewSrc} zones={zoneImgs} />
                  <DraftLayer bind={bindLive} W={W} H={H} src={viewSrc} />
                  {sel && !liveId && <Handles item={sel} W={W} H={H} S={S} />}
                </svg>

                {editingText && (
                  <TextInput
                    value={editingText.value}
                    onChange={(v) => setEditingText({ ...editingText, value: v })}
                    onCommit={() => {
                      const t = editingText.value.trim();
                      const id = editingText.id;
                      setEditingText(null);
                      if (!t) { deleteItem(id); return; }
                      setItems((cur) => cur.map((x) => (x.id === id ? { ...x, text: t } : x)));
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* ---- Pie ---- */}
        <div className="pa-foot">
          <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
            <span className="font-semibold text-slate-700">{items.length} {items.length === 1 ? 'marca' : 'marcas'}</span>
            <span className="truncate">· Rueda: acercar / alejar · Arrastrar el fondo o Espacio: mover la vista · Shift mantiene la proporción · Supr borra</span>
          </div>
          <div className="dam-zoom" role="group" aria-label="Zoom de la vista">
            <button type="button" title="Alejar" onClick={() => zoomAt(view.z / 1.25)}><Minus className="w-3.5 h-3.5" /></button>
            <button type="button" className="dam-zoom-val" title="Volver a encajar en la ventana" onClick={fitView}>{Math.round(view.z * 100)}%</button>
            <button type="button" title="Acercar" onClick={() => zoomAt(view.z * 1.25)}><Plus className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {items.length > 0 && (
              <button type="button" className="pa-btn warn" title="Quitar todas las marcas"
                onClick={() => { push([]); setSelId(null); }}>
                <RotateCcw className="w-3.5 h-3.5" /> Borrar todo
              </button>
            )}
            <button type="button" onClick={onClose} className="pa-btn">Cancelar</button>
            <button type="button" onClick={commitSave} className="pa-btn primary"><Check className="w-3.5 h-3.5" /> Guardar</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

/* =====================================================================
   Redimensionar: de un handle a una geometría nueva
   ===================================================================== */
function applyHandle(
  orig: MarkupItem,
  handle: HandleId,
  pt: { x: number; y: number },
  start: { x: number; y: number },
  shift: boolean,
): MarkupItem {
  const next = { ...orig };

  // Mover sólo el callout de la lupa: es lo que puede salirse del plano.
  if (handle === 'callout') {
    if (!next.magnifier) return next;
    next.magnifier = {
      ...next.magnifier,
      calloutX: clampOut(next.magnifier.calloutX + (pt.x - start.x)),
      calloutY: clampOut(next.magnifier.calloutY + (pt.y - start.y)),
    };
    return next;
  }

  // Extremos de línea / flecha / cota
  if (handle === 'p1') { next.x1 = clamp01(pt.x); next.y1 = clamp01(pt.y); return next; }
  if (handle === 'p2') { next.x2 = clamp01(pt.x); next.y2 = clamp01(pt.y); return next; }

  // Caja: los handles mueven los bordes que correspondan
  let l = Math.min(orig.x1, orig.x2), r = Math.max(orig.x1, orig.x2);
  let t = Math.min(orig.y1, orig.y2), b = Math.max(orig.y1, orig.y2);
  const x = clamp01(pt.x), y = clamp01(pt.y);

  if (handle.includes('w')) l = x;
  if (handle.includes('e')) r = x;
  if (handle.includes('n')) t = y;
  if (handle.includes('s')) b = y;

  // Shift en una esquina mantiene la proporción original
  if (shift && handle.length === 2) {
    const ar = Math.abs(orig.x2 - orig.x1) / Math.max(1e-6, Math.abs(orig.y2 - orig.y1));
    const w = Math.abs(r - l), h = Math.abs(b - t);
    if (w / Math.max(1e-6, h) > ar) {
      const nh = w / ar;
      if (handle.includes('n')) t = b - nh; else b = t + nh;
    } else {
      const nw = h * ar;
      if (handle.includes('w')) l = r - nw; else r = l + nw;
    }
  }

  next.x1 = Math.min(l, r); next.x2 = Math.max(l, r);
  next.y1 = Math.min(t, b); next.y2 = Math.max(t, b);
  return next;
}

/* =====================================================================
   Capas
   ===================================================================== */

/** Marcas guardadas. Memo: no se redibujan mientras se traza algo nuevo. */
const ItemsLayer = React.memo(function ItemsLayer({ items, W, H, hit, hideId, src, zones }: {
  items: MarkupItem[]; W: number; H: number; hit: number; hideId?: string | null; src?: string;
  zones?: Record<string, ZoneImg>;
}) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => markupZOrder(a.kind) - markupZOrder(b.kind)),
    [items],
  );
  return (
    <g>
      {sorted.map((it) => (it.id === hideId ? null : (
        <g key={it.id}>
          <MarkupShape it={it} W={W} H={H} halo src={src} zones={zones} uid="dam" />
          <HitArea it={it} W={W} H={H} hit={hit} />
        </g>
      )))}
    </g>
  );
});

/** Capa de lo que se está trazando ahora. Aislada: sólo esto re-renderiza. */
const DraftLayer: React.FC<{
  bind: (set: (d: MarkupItem | null) => void) => void; W: number; H: number; src?: string;
}> = ({ bind, W, H, src }) => {
  const [d, setD] = useState<MarkupItem | null>(null);
  useEffect(() => { bind(setD); }, [bind]);
  if (!d) return null;
  return <MarkupShape it={d} W={W} H={H} halo src={src} uid="dam-live" />;
};

/** Zona clickeable de una marca: generosa, para no tener que apuntar fino. */
const HitArea: React.FC<{ it: MarkupItem; W: number; H: number; hit: number }> = ({ it, W, H, hit }) => {
  const common = { 'data-mk': it.id, fill: 'none', stroke: 'transparent', strokeWidth: hit * 1.6 } as const;
  const sx = it.x1 * W, sy = it.y1 * H, ex = it.x2 * W, ey = it.y2 * H;

  if (SEG_KINDS.includes(it.kind)) {
    return <line x1={sx} y1={sy} x2={ex} y2={ey} {...common} pointerEvents="stroke" />;
  }
  if (it.kind === 'pen') {
    return <polyline points={(it.points || []).reduce<string[]>((a, v, i) => {
      if (i % 2 === 0) a.push(`${v * W}`); else a[a.length - 1] += `,${v * H}`;
      return a;
    }, []).join(' ')} {...common} pointerEvents="stroke" />;
  }
  if (it.kind === 'magnifier') {
    const g = magGeom(it, W, H);
    return (
      <>
        <rect x={g.zx} y={g.zy} width={Math.max(1, g.zw)} height={Math.max(1, g.zh)}
          data-mk={it.id} fill="transparent" pointerEvents="all" />
        <rect x={g.cx} y={g.cy} width={Math.max(1, g.cw)} height={Math.max(1, g.ch)}
          data-mk={it.id} fill="transparent" pointerEvents="all" />
      </>
    );
  }
  const b = bboxOf(it, W, H);
  return (
    <rect x={b.x} y={b.y} width={Math.max(1, b.w)} height={Math.max(1, b.h)}
      data-mk={it.id} fill="transparent" pointerEvents="all" />
  );
};

/* =====================================================================
   Handles de la selección — interactivos
   ===================================================================== */
const Handles: React.FC<{ item: MarkupItem; W: number; H: number; S: number }> = ({ item, W, H, S }) => {
  const r = 6 * S;
  const dot = (id: HandleId, cx: number, cy: number, cursor: string, accent = false) => (
    <circle
      key={id}
      data-handle={id}
      cx={cx} cy={cy} r={r}
      fill={accent ? '#f4c84a' : '#fff'} stroke={accent ? '#fff' : '#0ea5e9'} strokeWidth={Math.max(1.5, r * 0.3)}
      style={{ cursor }}
      pointerEvents="all"
    />
  );

  // Línea, flecha, cota: un handle en cada punta
  if (SEG_KINDS.includes(item.kind)) {
    return (
      <g>
        {dot('p1', item.x1 * W, item.y1 * H, 'move')}
        {dot('p2', item.x2 * W, item.y2 * H, 'move')}
      </g>
    );
  }

  // Texto, marcador, lápiz: sin redimensión (el tamaño va por la barra)
  if (item.kind === 'text' || item.kind === 'marker' || item.kind === 'pen') {
    const b = bboxOf(item, W, H);
    return (
      <rect
        x={b.x - r} y={b.y - r} width={b.w + r * 2} height={b.h + r * 2}
        fill="none" stroke="rgba(14,165,233,.85)" strokeWidth={Math.max(1.5, 2 * S)}
        strokeDasharray={`${6 * S} ${4 * S}`} pointerEvents="none"
      />
    );
  }

  // Caja: 8 handles. En la lupa, la caja que se redimensiona es la zona.
  const g = item.kind === 'magnifier' ? magGeom(item, W, H) : null;
  const box = g ? { x: g.zx, y: g.zy, w: g.zw, h: g.zh } : bboxOf(item, W, H);
  const { x, y, w, h } = box;
  const mx = x + w / 2, my = y + h / 2;

  return (
    <g>
      <rect
        x={x} y={y} width={Math.max(1, w)} height={Math.max(1, h)}
        fill="none" stroke="rgba(14,165,233,.85)" strokeWidth={Math.max(1.5, 2 * S)}
        strokeDasharray={`${6 * S} ${4 * S}`} pointerEvents="none"
      />
      {dot('nw', x, y, 'nwse-resize')}
      {dot('n', mx, y, 'ns-resize')}
      {dot('ne', x + w, y, 'nesw-resize')}
      {dot('e', x + w, my, 'ew-resize')}
      {dot('se', x + w, y + h, 'nwse-resize')}
      {dot('s', mx, y + h, 'ns-resize')}
      {dot('sw', x, y + h, 'nesw-resize')}
      {dot('w', x, my, 'ew-resize')}

      {/* Lupa: handle propio para arrastrar el callout, que puede salirse */}
      {g && (
        <>
          <rect
            x={g.cx} y={g.cy} width={Math.max(1, g.cw)} height={Math.max(1, g.ch)}
            fill="none" stroke="rgba(244,200,74,.85)" strokeWidth={Math.max(1.5, 2 * S)}
            strokeDasharray={`${6 * S} ${4 * S}`} pointerEvents="none"
          />
          {dot('callout', g.ccx, g.ccy, 'move', true)}
        </>
      )}
    </g>
  );
};

/* =====================================================================
   Texto inline
   ===================================================================== */
const TextInput: React.FC<{
  value: string; onChange: (v: string) => void; onCommit: () => void;
}> = ({ value, onChange, onCommit }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="dam-text-pop">
      <textarea
        ref={ref}
        value={value}
        placeholder="Escribí la nota…"
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onCommit(); }
          if (e.key === 'Escape') { e.preventDefault(); onCommit(); }
        }}
      />
      <span className="dam-text-hint">Enter para confirmar · Shift+Enter salto de línea</span>
    </div>
  );
};
