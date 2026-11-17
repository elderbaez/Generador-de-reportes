import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Square, Circle, MoveUpRight, Type, Undo2, Redo2, Trash2, RotateCcw, Check, Palette,
  MousePointer2, Minus, Highlighter, Pencil, Hash, Grid3x3, Copy, Ruler,
} from 'lucide-react';
import { PhotoItem, PhotoAnnotation, MarkupItem, MarkupKind } from '../types';
import {
  scaleOf, strokePx, fontPx, markerR, itemOpacity, hasShadow, textBox, bboxOf, arrowGeom,
  freehandPath, pixelate, contrastOn, renderMarkedImage, FONT_STACK, dimGeom,
} from '../utils/markup';
import './photo-annotation.css';

/* =====================================================================
   Editor de anotaciones de fotos
   - Marcas vectoriales que se pueden seleccionar, mover, redimensionar y
     cambiar de propiedades; se guardan junto a la foto, así se pueden
     volver a editar más tarde. Al guardar, además se integran a la imagen.
   - Herramientas: seleccionar, flecha, línea, rectángulo, elipse,
     resaltador, lápiz, texto, marcador numerado y ocultar (pixelar).
   - Rendimiento: lo que se está dibujando se pinta en una capa aparte
     (las demás marcas no se recalculan en cada movimiento del mouse).
   ===================================================================== */

interface PhotoAnnotationModalProps {
  photo: PhotoItem | null;
  onClose: () => void;
  onSave: (photoId: string, newSrc: string, originalSrc?: string, annotations?: PhotoAnnotation[], markup?: MarkupItem[]) => void;
}

type Tool = 'select' | MarkupKind;

const TOOLS: { id: Tool; label: string; key: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'select', label: 'Seleccionar y mover', key: 'V', icon: MousePointer2 },
  { id: 'arrow', label: 'Flecha', key: 'A', icon: MoveUpRight },
  { id: 'line', label: 'Línea', key: 'L', icon: Minus },
  { id: 'dim', label: 'Cota (medida)', key: 'M', icon: Ruler },
  { id: 'rect', label: 'Rectángulo', key: 'R', icon: Square },
  { id: 'ellipse', label: 'Elipse', key: 'E', icon: Circle },
  { id: 'highlight', label: 'Resaltador', key: 'H', icon: Highlighter },
  { id: 'pen', label: 'Lápiz', key: 'P', icon: Pencil },
  { id: 'text', label: 'Texto', key: 'T', icon: Type },
  { id: 'marker', label: 'Marcador numerado', key: 'N', icon: Hash },
  { id: 'blur', label: 'Ocultar (pixelar)', key: 'B', icon: Grid3x3 },
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
const DEFAULT_STYLE: Record<MarkupKind, Style> = {
  arrow: { color: '#ef4444', width: 4 },
  line: { color: '#ef4444', width: 4 },
  rect: { color: '#ef4444', width: 4 },
  ellipse: { color: '#ef4444', width: 4 },
  highlight: { color: '#facc15', width: 4, opacity: 0.4 },
  pen: { color: '#ef4444', width: 3 },
  text: { color: '#facc15', width: 4, fontSize: 24, textBg: true },
  marker: { color: '#ef4444', width: 4, fontSize: 24 },
  blur: { color: '#94a3b8', width: 2 },
  dim: { color: '#facc15', width: 3, fontSize: 22 },
  magnifier: { color: '#ffffff', width: 2 },
};

const uid = () => `mk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const zOrder = (k: MarkupKind) => (k === 'blur' ? 0 : k === 'highlight' ? 1 : 2);

/* ---------- Una marca en SVG (mismas fórmulas que el guardado) ---------- */
const Shape: React.FC<{ it: MarkupItem; W: number; H: number; pixUrl?: string | null; hit: number; shadow: boolean; fast?: boolean }> = ({ it, W, H, pixUrl, hit, shadow, fast }) => {
  const S = scaleOf(W, H);
  const sw = strokePx(it, S);
  const op = itemOpacity(it);
  const dash = it.dashed ? `${sw * 2.2} ${sw * 1.8}` : undefined;
  const filter = shadow && hasShadow(it.kind) ? 'url(#mk-shadow)' : undefined;
  const sx = it.x1 * W, sy = it.y1 * H, ex = it.x2 * W, ey = it.y2 * H;
  const hitStroke = { stroke: 'transparent', strokeWidth: Math.max(hit, sw), fill: 'none', pointerEvents: 'stroke' as const };
  let body: React.ReactNode = null;
  let hitEl: React.ReactNode = null;

  switch (it.kind) {
    case 'line':
      body = <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={it.color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={dash} />;
      hitEl = <line x1={sx} y1={sy} x2={ex} y2={ey} {...hitStroke} />;
      break;
    case 'dim': {
      const g = dimGeom(it, W, H);
      const tsw = Math.max(1.5, sw * 0.8);
      const bw = g.tw + g.padX * 2, bh = g.f * 1.2 + g.padY * 2;
      body = (<>
        <line x1={g.sx} y1={g.sy} x2={g.ex} y2={g.ey} stroke={it.color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={dash} />
        <path d={`M${g.t1[0]} ${g.t1[1]}L${g.t1[2]} ${g.t1[3]}M${g.t2[0]} ${g.t2[1]}L${g.t2[2]} ${g.t2[3]}`} stroke={it.color} strokeWidth={tsw} strokeLinecap="round" />
        <polygon points={g.a1.map((p) => p.join(',')).join(' ')} fill={it.color} />
        <polygon points={g.a2.map((p) => p.join(',')).join(' ')} fill={it.color} />
        {g.label && (
          <g transform={`translate(${g.cx} ${g.cy}) rotate(${(g.ta * 180) / Math.PI})`}>
            <rect x={-bw / 2} y={-bh / 2} width={bw} height={bh} rx={bh / 3} fill="rgba(15,23,42,0.85)" />
            <text x={0} y={g.f * 0.04} textAnchor="middle" dominantBaseline="central" fill={it.color} fontSize={g.f} fontWeight="bold" fontFamily={FONT_STACK}>{g.label}</text>
          </g>
        )}
      </>);
      hitEl = <line x1={sx} y1={sy} x2={ex} y2={ey} {...hitStroke} />;
      break;
    }
    case 'arrow': {
      const g = arrowGeom(it, W, H);
      body = (<>
        <line x1={g.sx} y1={g.sy} x2={g.lx} y2={g.ly} stroke={it.color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={dash} />
        <polygon points={g.pts.map((p) => p.join(',')).join(' ')} fill={it.color} />
      </>);
      hitEl = <line x1={sx} y1={sy} x2={ex} y2={ey} {...hitStroke} />;
      break;
    }
    case 'rect': {
      const b = bboxOf(it, W, H);
      body = <rect x={b.x} y={b.y} width={Math.max(1, b.w)} height={Math.max(1, b.h)} rx={8 * S}
        fill={it.fill ? it.color : 'none'} fillOpacity={it.fill ? 0.2 : undefined} stroke={it.color} strokeWidth={sw} strokeDasharray={dash} strokeLinejoin="round" />;
      hitEl = <rect x={b.x} y={b.y} width={Math.max(1, b.w)} height={Math.max(1, b.h)} {...hitStroke} pointerEvents={it.fill ? 'all' : 'stroke'} />;
      break;
    }
    case 'ellipse': {
      const cx = (sx + ex) / 2, cy = (sy + ey) / 2, rx = Math.max(1, Math.abs(ex - sx) / 2), ry = Math.max(1, Math.abs(ey - sy) / 2);
      body = <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={it.fill ? it.color : 'none'} fillOpacity={it.fill ? 0.2 : undefined}
        stroke={it.color} strokeWidth={sw} strokeDasharray={dash} />;
      hitEl = <ellipse cx={cx} cy={cy} rx={rx} ry={ry} {...hitStroke} pointerEvents={it.fill ? 'all' : 'stroke'} />;
      break;
    }
    case 'pen':
    case 'highlight': {
      const d = freehandPath(it.points || [it.x1, it.y1], W, H);
      body = <path d={d} fill="none" stroke={it.color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={dash} style={it.kind === 'highlight' && !fast ? { mixBlendMode: 'multiply' } : undefined} />;
      hitEl = <path d={d} {...hitStroke} />;
      break;
    }
    case 'blur': {
      const b = bboxOf(it, W, H);
      const cid = `clip-${it.id}`;
      body = (<>
        <clipPath id={cid}><rect x={b.x} y={b.y} width={Math.max(1, b.w)} height={Math.max(1, b.h)} /></clipPath>
        {pixUrl
          ? <image href={pixUrl} x={0} y={0} width={W} height={H} preserveAspectRatio="none" clipPath={`url(#${cid})`} />
          : <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="#64748b" />}
      </>);
      hitEl = <rect x={b.x} y={b.y} width={Math.max(1, b.w)} height={Math.max(1, b.h)} fill="transparent" pointerEvents="all" />;
      break;
    }
    case 'marker': {
      const r = markerR(it, S);
      body = (<>
        <circle cx={sx} cy={sy} r={r} fill={it.color} stroke="#fff" strokeWidth={Math.max(2, r * 0.14)} />
        <text x={sx} y={sy + r * 0.04} textAnchor="middle" dominantBaseline="central" fill={contrastOn(it.color)}
          fontSize={Math.round(r * 1.05)} fontWeight={800} fontFamily={FONT_STACK}>{it.num ?? 1}</text>
      </>);
      hitEl = <circle cx={sx} cy={sy} r={r} fill="transparent" pointerEvents="all" />;
      break;
    }
    case 'text': {
      const t = textBox(it, W, H);
      body = (<>
        {it.textBg !== false && (
          <rect x={t.bx} y={t.by} width={t.bw} height={t.bh} rx={t.r} fill="rgba(15,23,42,0.85)" stroke={it.color} strokeWidth={Math.max(1.5, 2 * S)} />
        )}
        <text x={t.x} y={t.y} dominantBaseline="text-before-edge" fill={it.color} fontSize={t.f} fontWeight="bold" fontFamily={FONT_STACK}>{it.text || ' '}</text>
      </>);
      hitEl = <rect x={t.bx} y={t.by} width={t.bw} height={t.bh} fill="transparent" pointerEvents="all" />;
      break;
    }
  }
  return (
    <g data-mk={it.id} opacity={op} filter={filter} style={{ cursor: 'move' }}>
      {body}
      {hitEl}
    </g>
  );
};

/** Capa de marcas ya hechas: no se vuelve a dibujar mientras se arrastra otra cosa. */
const ItemsLayer = React.memo(function ItemsLayer({ items, W, H, pixUrl, hit, shadow, hideId }: {
  items: MarkupItem[]; W: number; H: number; pixUrl: string | null; hit: number; shadow: boolean; hideId?: string | null;
}) {
  const sorted = useMemo(() => [...items].sort((a, b) => zOrder(a.kind) - zOrder(b.kind)), [items]);
  return <g>{sorted.map((it) => (it.id === hideId ? null : <Shape key={it.id} it={it} W={W} H={H} pixUrl={pixUrl} hit={hit} shadow={shadow} />))}</g>;
});

/**
 * Capa de lo que se está dibujando o arrastrando. Tiene su propio estado: cada movimiento
 * del mouse vuelve a dibujar SOLO esta marca, no todo el editor.
 */
const DraftLayer: React.FC<{ bind: (set: (d: MarkupItem | null) => void) => void; W: number; H: number; pixUrl: string | null }> = ({ bind, W, H, pixUrl }) => {
  const [d, setD] = useState<MarkupItem | null>(null);
  useEffect(() => { bind(setD); }, [bind]);
  return d ? <Shape it={d} W={W} H={H} pixUrl={pixUrl} hit={0} shadow={false} fast /> : null;
};

/* ===================================================================== */

export const PhotoAnnotationModal: React.FC<PhotoAnnotationModalProps> = ({ photo, onClose, onSave }) => {
  if (!photo) return null;
  return <Editor key={photo.id} photo={photo} onClose={onClose} onSave={onSave} />;
};

type Drag =
  | { mode: 'draw'; id: string; start: { x: number; y: number } }
  | { mode: 'move'; id: string; start: { x: number; y: number }; orig: MarkupItem }
  | { mode: 'handle'; id: string; handle: string; orig: MarkupItem };

const Editor: React.FC<{ photo: PhotoItem; onClose: () => void; onSave: PhotoAnnotationModalProps['onSave'] }> = ({ photo, onClose, onSave }) => {
  // Fotos marcadas con la versión anterior (marcas fijas en la imagen): se parte de esa imagen para no perderlas
  const legacyBaked = !!photo.originalSrc && !photo.markup && photo.src !== photo.originalSrc;
  const baseSrc = legacyBaked ? photo.src : (photo.originalSrc || photo.src);

  const [tool, setTool] = useState<Tool>('arrow');
  const [styles, setStyles] = useState<Record<MarkupKind, Style>>(DEFAULT_STYLE);
  const [items, setItems] = useState<MarkupItem[]>(() => photo.markup ? JSON.parse(JSON.stringify(photo.markup)) : []);
  const [selId, setSelId] = useState<string | null>(null);
  // Marca en vivo (dibujo nuevo, o la que se mueve/redimensiona): vive fuera del estado del editor
  const live = useRef<MarkupItem | null>(null);
  const setLiveView = useRef<(d: MarkupItem | null) => void>(() => undefined);
  const bindLive = useCallback((set: (d: MarkupItem | null) => void) => { setLiveView.current = set; }, []);
  const [liveId, setLiveId] = useState<string | null>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const showLive = (d: MarkupItem | null) => { live.current = d; setLiveView.current(d); };
  const [editingText, setEditingText] = useState<{ id: string; value: string } | null>(null);
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const [viewSrc, setViewSrc] = useState<string | null>(null);
  const [pixUrl, setPixUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [past, setPast] = useState<MarkupItem[][]>([]);
  const [future, setFuture] = useState<MarkupItem[][]>([]);
  const [dragging, setDragging] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const dimInputRef = useRef<HTMLInputElement>(null);
  const imgElRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<Drag | null>(null);
  const raf = useRef<number | null>(null);
  const pending = useRef<{ x: number; y: number; shift: boolean } | null>(null);
  const lastCoalesce = useRef<{ key: string; t: number } | null>(null);
  const itemsRef = useRef(items); itemsRef.current = items;
  const initial = useRef(JSON.stringify(photo.markup || []));
  const W = size.w, H = size.h;
  const S = scaleOf(W, H);

  /* ---- Imagen base y versión pixelada (para Ocultar) ---- */
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgElRef.current = img;
      const w = img.naturalWidth || 1200, h = img.naturalHeight || 800;
      setSize({ w, h });
      // Fotos de celular (4000 px o más): para mirar alcanza una copia más chica, que el
      // navegador pinta mucho más rápido. El guardado sigue usando la foto completa.
      const MAX = 2000;
      if (Math.max(w, h) > MAX) {
        try {
          const r = MAX / Math.max(w, h);
          const c = document.createElement('canvas');
          c.width = Math.round(w * r); c.height = Math.round(h * r);
          c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
          setViewSrc(c.toDataURL('image/jpeg', 0.9));
        } catch { /* foto de otro sitio sin permiso: se muestra la original */ }
      }
    };
    img.src = baseSrc;
  }, [baseSrc]);
  const needPix = items.some((i) => i.kind === 'blur') || tool === 'blur';
  useEffect(() => {
    if (!needPix || pixUrl || !imgElRef.current) return;
    try { setPixUrl(pixelate(imgElRef.current, W, H).toDataURL('image/jpeg', 0.8)); } catch { /* foto de otro sitio sin permiso: se muestra un gris */ }
  }, [needPix, pixUrl, W, H]);

  /* ---- Historial ---- */
  const commit = useCallback((next: MarkupItem[], coalesceKey?: string) => {
    const now = Date.now();
    const lc = lastCoalesce.current;
    const merge = coalesceKey && lc && lc.key === coalesceKey && now - lc.t < 700;
    if (!merge) setPast((p) => [...p.slice(-80), itemsRef.current]);
    lastCoalesce.current = coalesceKey ? { key: coalesceKey, t: now } : null;
    setFuture([]);
    setItems(next);
  }, []);
  const undo = () => {
    if (!past.length) return;
    setFuture((f) => [items, ...f]); setItems(past[past.length - 1]); setPast((p) => p.slice(0, -1));
    lastCoalesce.current = null;
  };
  const redo = () => {
    if (!future.length) return;
    setPast((p) => [...p, items]); setItems(future[0]); setFuture((f) => f.slice(1));
  };

  const selected = items.find((i) => i.id === selId) || null;
  const activeKind: MarkupKind | null = selected ? selected.kind : tool === 'select' ? null : tool;
  const activeStyle: Style | null = selected ? selected : activeKind ? styles[activeKind] : null;

  /** Cambia una propiedad: a la marca seleccionada y a la herramienta (queda como preferida). */
  const setProp = (patch: Partial<MarkupItem>) => {
    if (activeKind) setStyles((s) => ({ ...s, [activeKind]: { ...s[activeKind], ...patch } }));
    if (selected) commit(items.map((i) => (i.id === selected.id ? { ...i, ...patch } : i)), `${selected.id}:${Object.keys(patch).join(',')}`);
  };
  const removeSel = () => { if (selected) { commit(items.filter((i) => i.id !== selected.id)); setSelId(null); } };
  const duplicateSel = () => {
    if (!selected) return;
    const d = 0.03;
    const copy: MarkupItem = {
      ...selected, id: uid(), x1: clamp01(selected.x1 + d), y1: clamp01(selected.y1 + d), x2: clamp01(selected.x2 + d), y2: clamp01(selected.y2 + d),
      points: selected.points?.map((v, i) => clamp01(v + d)),
      num: selected.kind === 'marker' ? nextNum() : selected.num,
    };
    commit([...items, copy]); setSelId(copy.id);
  };
  const nextNum = () => Math.max(0, ...itemsRef.current.filter((i) => i.kind === 'marker').map((i) => i.num || 0)) + 1;

  /* ---- Coordenadas ---- */
  const toRel = (clientX: number, clientY: number) => {
    // Durante un arrastre se usa la medida tomada al empezar (no se fuerza al navegador a recalcular)
    const r = rectRef.current || svgRef.current!.getBoundingClientRect();
    return { x: clamp01((clientX - r.left) / r.width), y: clamp01((clientY - r.top) / r.height) };
  };
  /** Cuánto mide un píxel de pantalla en píxeles de la imagen (para manijas y zonas de clic). */
  const [k, setK] = useState(1);
  useEffect(() => {
    const upd = () => { const r = svgRef.current?.getBoundingClientRect(); if (r && r.width) setK(W / r.width); };
    upd(); window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, [W]);

  /* ---- Interacción ---- */
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    // Evita que el clic le saque el foco al cuadro de texto recién creado
    e.preventDefault();
    if (editingRef.current) { finishText(); return; }
    rectRef.current = svgRef.current!.getBoundingClientRect();
    const p = toRel(e.clientX, e.clientY);
    const target = e.target as Element;
    const handle = target.closest('[data-handle]')?.getAttribute('data-handle');
    const hitId = target.closest('[data-mk]')?.getAttribute('data-mk');

    // Manija de la marca seleccionada (con cualquier herramienta)
    if (handle && selected) {
      drag.current = { mode: 'handle', id: selected.id, handle, orig: { ...selected } };
      showLive({ ...selected }); setLiveId(selected.id);
    } else if (hitId && (tool === 'select' || hitId === selId)) {
      // Clic sobre una marca: se selecciona y se puede arrastrar
      const it = items.find((i) => i.id === hitId)!;
      setSelId(hitId);
      drag.current = { mode: 'move', id: hitId, start: p, orig: { ...it, points: it.points ? [...it.points] : undefined } };
      showLive({ ...it }); setLiveId(hitId);
    } else if (tool === 'select') {
      setSelId(null);
      rectRef.current = null;
      return;
    } else if (tool === 'text') {
      const it: MarkupItem = { id: uid(), kind: 'text', x1: p.x, y1: p.y, x2: p.x, y2: p.y, ...styles.text, text: '' };
      setItems((l) => [...l, it]);
      setSelId(it.id);
      setEditingText({ id: it.id, value: '' });
      return;
    } else if (tool === 'marker') {
      const it: MarkupItem = { id: uid(), kind: 'marker', x1: p.x, y1: p.y, x2: p.x, y2: p.y, ...styles.marker, num: nextNum() };
      commit([...items, it]); setSelId(it.id);
      return;
    } else {
      const it: MarkupItem = {
        id: uid(), kind: tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y, ...styles[tool],
        points: tool === 'pen' || tool === 'highlight' ? [p.x, p.y] : undefined,
      };
      showLive(it);
      setSelId(null);
      drag.current = { mode: 'draw', id: it.id, start: p };
    }
    setDragging(true);
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
  };

  const applyMove = useCallback(() => {
    raf.current = null;
    const pt = pending.current, d = drag.current, dr = live.current;
    if (!pt || !d || !dr) return;
    let { x, y } = pt;
    if (d.mode === 'draw') {
      if (dr.kind === 'pen' || dr.kind === 'highlight') {
        if (pt.shift) { showLive({ ...dr, points: [dr.points![0], dr.points![1], x, y], x2: x, y2: y }); return; }
        const pts = dr.points!;
        const lx = pts[pts.length - 2], ly = pts[pts.length - 1];
        if (Math.hypot((x - lx) * W, (y - ly) * H) < 2 * k) return;
        pts.push(x, y);                                   // sin copiar el trazo entero en cada punto
        showLive({ ...dr, points: pts, x2: x, y2: y });
        return;
      }
      if (pt.shift) {
        if (dr.kind === 'line' || dr.kind === 'arrow' || dr.kind === 'dim') {
          // Ángulos de 15°
          const dx = (x - dr.x1) * W, dy = (y - dr.y1) * H;
          const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * (Math.PI / 12);
          const len = Math.hypot(dx, dy);
          x = clamp01(dr.x1 + (Math.cos(a) * len) / W); y = clamp01(dr.y1 + (Math.sin(a) * len) / H);
        } else {
          // Cuadrado / círculo
          const s2 = Math.max(Math.abs(x - dr.x1) * W, Math.abs(y - dr.y1) * H);
          x = clamp01(dr.x1 + (Math.sign(x - dr.x1) || 1) * s2 / W); y = clamp01(dr.y1 + (Math.sign(y - dr.y1) || 1) * s2 / H);
        }
      }
      showLive({ ...dr, x2: x, y2: y });
      return;
    }
    const o = d.orig;
    if (d.mode === 'move') {
      const dx = x - d.start.x, dy = y - d.start.y;
      showLive({
        ...o,
        x1: clamp01(o.x1 + dx), y1: clamp01(o.y1 + dy), x2: clamp01(o.x2 + dx), y2: clamp01(o.y2 + dy),
        points: o.points?.map((v, i) => clamp01(v + (i % 2 ? dy : dx))),
      });
      return;
    }
    // Manijas
    const h = d.handle;
    if (h === 'p1') { showLive({ ...dr, x1: x, y1: y }); return; }
    if (h === 'p2') { showLive({ ...dr, x2: x, y2: y }); return; }
    const n = { ...dr };
    if (h.includes('w')) { if (o.x1 <= o.x2) n.x1 = x; else n.x2 = x; }
    if (h.includes('e')) { if (o.x1 <= o.x2) n.x2 = x; else n.x1 = x; }
    if (h.includes('n')) { if (o.y1 <= o.y2) n.y1 = y; else n.y2 = y; }
    if (h.includes('s')) { if (o.y1 <= o.y2) n.y2 = y; else n.y1 = y; }
    showLive(n);
  }, [W, H, k]);

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    pending.current = { ...toRel(e.clientX, e.clientY), shift: e.shiftKey };
    if (raf.current == null) raf.current = requestAnimationFrame(applyMove);
  };

  const onPointerUp = () => {
    const d = drag.current;
    if (!d) return;
    if (raf.current != null) { cancelAnimationFrame(raf.current); applyMove(); }
    drag.current = null;
    rectRef.current = null;
    const dr = live.current;
    showLive(null);
    setLiveId(null);
    setDragging(false);
    if (!dr) return;
    if (d.mode === 'draw') {
      const big = dr.kind === 'pen' || dr.kind === 'highlight'
        ? (dr.points?.length || 0) >= 4
        : Math.hypot((dr.x2 - dr.x1) * W, (dr.y2 - dr.y1) * H) > 6 * k;
      if (big) {
        commit([...itemsRef.current, { ...dr, points: dr.points ? [...dr.points] : undefined }]);
        setSelId(dr.id);
        // Cota recién trazada: el cursor va directo al campo de la medida
        if (dr.kind === 'dim') setTimeout(() => dimInputRef.current?.focus(), 30);
      }
    } else if (JSON.stringify(dr) !== JSON.stringify(d.orig)) {
      // Movida o redimensionada: un solo paso en el historial
      commit(itemsRef.current.map((i) => (i.id === d.id ? dr : i)));
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const id = (e.target as Element).closest('[data-mk]')?.getAttribute('data-mk');
    const it = items.find((i) => i.id === id);
    if (it?.kind === 'text') { setSelId(it.id); setEditingText({ id: it.id, value: it.text || '' }); }
    if (it?.kind === 'dim') { setSelId(it.id); setTimeout(() => dimInputRef.current?.focus(), 0); }
  };

  /* ---- Texto ---- */
  // Ref para no confirmar dos veces (el clic en la foto y la pérdida de foco llegan juntos)
  const editingRef = useRef(editingText); editingRef.current = editingText;
  const cancelText = () => {
    const et = editingRef.current;
    if (!et) return;
    editingRef.current = null;
    const it = itemsRef.current.find((i) => i.id === et.id);
    if (!it?.text) { setItems((l) => l.filter((i) => i.id !== et.id)); setSelId(null); }
    setEditingText(null);
  };
  const finishText = () => {
    const editingText = editingRef.current;
    if (!editingText) return;
    editingRef.current = null;
    const v = editingText.value.trim();
    const exists = itemsRef.current.find((i) => i.id === editingText.id);
    const wasEmpty = !exists?.text;
    if (!v) {
      setItems((l) => l.filter((i) => i.id !== editingText.id));
      if (!wasEmpty) commit(itemsRef.current.filter((i) => i.id !== editingText.id));
      setSelId(null);
    } else {
      const next = itemsRef.current.map((i) => (i.id === editingText.id ? { ...i, text: v } : i));
      if (wasEmpty) { setPast((p) => [...p, itemsRef.current.filter((i) => i.id !== editingText.id)]); setFuture([]); setItems(next); }
      else commit(next);
    }
    setEditingText(null);
  };

  /* ---- Guardar ---- */
  const changed = JSON.stringify(items) !== initial.current;
  const save = async () => {
    if (editingRef.current) finishText();
    setBusy(true); setErr(null);
    try {
      const list = itemsRef.current.filter((i) => i.kind !== 'text' || (i.text || '').trim());
      const src = list.length ? await renderMarkedImage(baseSrc, list) : baseSrc;
      // En fotos de la versión anterior, la imagen con sus marcas fijas pasa a ser la base editable
      onSave(photo.id, src, legacyBaked ? photo.src : (photo.originalSrc || photo.src), [], list);
      onClose();
    } catch (e) {
      setErr('No se pudo integrar las marcas en esta foto (la imagen no permite ser copiada). Volvé a cargar la foto desde tu PC e intentá de nuevo.');
    } finally {
      setBusy(false);
    }
  };
  const revertOriginal = () => {
    const orig = photo.originalSrc || photo.src;
    onSave(photo.id, orig, orig, [], []);
    onClose();
  };
  const tryClose = () => {
    if (changed && !window.confirm('¿Salir sin guardar las anotaciones?')) return;
    onClose();
  };

  /* ---- Teclado ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.('input, textarea, [contenteditable="true"]');
      if (typing) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return; }
      if (mod && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); duplicateSel(); return; }
      if (mod && e.key === 'Enter') { e.preventDefault(); save(); return; }
      if (e.key === 'Escape') { e.preventDefault(); if (selId) setSelId(null); else tryClose(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); removeSel(); return; }
      if (selected && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = (e.shiftKey ? 10 : 1) / Math.max(W, H);
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        commit(items.map((i) => (i.id !== selected.id ? i : {
          ...i, x1: clamp01(i.x1 + dx), y1: clamp01(i.y1 + dy), x2: clamp01(i.x2 + dx), y2: clamp01(i.y2 + dy),
          points: i.points?.map((v, j) => clamp01(v + (j % 2 ? dy : dx))),
        })), `${selected.id}:nudge`);
        return;
      }
      if (!mod && !e.altKey) {
        const t = TOOLS.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
        if (t) { setTool(t.id); if (t.id !== 'select') setSelId(null); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /* ---- Manijas de la marca seleccionada ---- */
  const handles = (() => {
    if (!selected || editingText || liveId) return null;
    const hr = 6 * k;
    const sw = 1.5 * k;
    const dot = (key: string, x: number, y: number, cursor: string) => (
      <circle key={key} data-handle={key} cx={x} cy={y} r={hr} fill="#fff" stroke="#0ea5e9" strokeWidth={sw} style={{ cursor }} />
    );
    if (selected.kind === 'line' || selected.kind === 'arrow' || selected.kind === 'dim') {
      return <g>{dot('p1', selected.x1 * W, selected.y1 * H, 'crosshair')}{dot('p2', selected.x2 * W, selected.y2 * H, 'crosshair')}</g>;
    }
    const b = bboxOf(selected, W, H);
    const pad = 4 * k;
    const box = <rect x={b.x - pad} y={b.y - pad} width={b.w + pad * 2} height={b.h + pad * 2} fill="none" stroke="#0ea5e9" strokeWidth={sw} strokeDasharray={`${4 * k} ${3 * k}`} pointerEvents="none" />;
    if (selected.kind === 'rect' || selected.kind === 'ellipse' || selected.kind === 'blur') {
      return <g>{box}
        {dot('nw', b.x, b.y, 'nwse-resize')}{dot('ne', b.x + b.w, b.y, 'nesw-resize')}
        {dot('sw', b.x, b.y + b.h, 'nesw-resize')}{dot('se', b.x + b.w, b.y + b.h, 'nwse-resize')}
      </g>;
    }
    return box;
  })();

  /* ---- Barra de propiedades ---- */
  const kindLabel = activeKind ? TOOLS.find((t) => t.id === activeKind)?.label : null;
  const strokeKinds: MarkupKind[] = ['arrow', 'line', 'rect', 'ellipse', 'pen', 'highlight', 'dim'];
  const editingItem = editingText ? items.find((i) => i.id === editingText.id) : null;
  const editBox = editingItem ? textBox({ ...editingItem, text: editingText!.value || ' ' }, W, H) : null;

  return (
    <div
      className="fixed inset-0 z-[1400] bg-slate-950/85 flex items-center justify-center p-3 md:p-5 no-print"
      title="Clic fuera del editor: guarda y cierra"
      onMouseDown={(e) => { if (e.target === e.currentTarget) save(); }}
    >
      <div className="pa-modal" title="">
        {/* ---- Encabezado ---- */}
        <div className="pa-head">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#f4c84a] flex items-center justify-center text-[#0b455b] shrink-0"><Palette className="w-4 h-4" /></div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm tracking-wide">Anotar fotografía</h3>
              <p className="text-[11px] text-slate-300 truncate">{photo.caption || 'Foto'} · las marcas se pueden volver a editar</p>
            </div>
          </div>
          <button onClick={tryClose} className="text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10" title="Cerrar sin guardar (Esc)"><X className="w-5 h-5" /></button>
        </div>

        {/* ---- Propiedades ---- */}
        <div className="pa-props">
          {activeStyle && activeKind ? (
            <>
              <span className="pa-props-title">{selected ? `${kindLabel} seleccionado` : kindLabel}</span>
              {activeKind !== 'blur' && (
                <div className="pa-group">
                  {COLORS.map((c) => (
                    <button key={c.hex} type="button" title={c.label} onClick={() => setProp({ color: c.hex })}
                      className={`pa-swatch${activeStyle.color === c.hex ? ' on' : ''}`} style={{ background: c.hex }} />
                  ))}
                  <label className="pa-swatch custom" title="Otro color">
                    <input type="color" value={/^#[0-9a-f]{6}$/i.test(activeStyle.color || '') ? activeStyle.color : '#ef4444'} onChange={(e) => setProp({ color: e.target.value })} />
                  </label>
                </div>
              )}
              {strokeKinds.includes(activeKind) && (
                <label className="pa-range" title="Grosor">
                  <span>Grosor</span>
                  <input type="range" min={1} max={10} step={1} value={activeStyle.width ?? 4} onChange={(e) => setProp({ width: Number(e.target.value) })} />
                  <b>{activeStyle.width ?? 4}</b>
                </label>
              )}
              {activeKind === 'dim' && (
                <label className="pa-range" title="Medida que se escribe sobre la cota">
                  <span>Medida</span>
                  <input ref={dimInputRef} type="text" className="pa-dim" placeholder="ej. 2,35 m"
                    value={selected?.kind === 'dim' ? (selected.text || '') : ''} disabled={selected?.kind !== 'dim'}
                    onChange={(e) => setProp({ text: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                </label>
              )}
              {(activeKind === 'text' || activeKind === 'marker' || activeKind === 'dim') && (
                <label className="pa-range" title="Tamaño">
                  <span>Tamaño</span>
                  <input type="range" min={12} max={64} step={2} value={activeStyle.fontSize ?? 24} onChange={(e) => setProp({ fontSize: Number(e.target.value) })} />
                  <b>{activeStyle.fontSize ?? 24}</b>
                </label>
              )}
              {activeKind !== 'blur' && (
                <label className="pa-range" title="Opacidad">
                  <span>Opacidad</span>
                  <input type="range" min={10} max={100} step={5} value={Math.round((activeStyle.opacity ?? (activeKind === 'highlight' ? 0.4 : 1)) * 100)}
                    onChange={(e) => setProp({ opacity: Number(e.target.value) / 100 })} />
                  <b>{Math.round((activeStyle.opacity ?? (activeKind === 'highlight' ? 0.4 : 1)) * 100)}%</b>
                </label>
              )}
              {(activeKind === 'rect' || activeKind === 'ellipse') && (
                <label className="pa-check"><input type="checkbox" checked={!!activeStyle.fill} onChange={(e) => setProp({ fill: e.target.checked })} /> Relleno suave</label>
              )}
              {(activeKind === 'rect' || activeKind === 'ellipse' || activeKind === 'line' || activeKind === 'arrow' || activeKind === 'pen' || activeKind === 'dim') && (
                <label className="pa-check"><input type="checkbox" checked={!!activeStyle.dashed} onChange={(e) => setProp({ dashed: e.target.checked })} /> Punteado</label>
              )}
              {activeKind === 'text' && (
                <label className="pa-check"><input type="checkbox" checked={activeStyle.textBg !== false} onChange={(e) => setProp({ textBg: e.target.checked })} /> Fondo oscuro</label>
              )}
              {selected?.kind === 'marker' && (
                <label className="pa-range" title="Número">
                  <span>N.º</span>
                  <input type="number" min={0} className="pa-num" value={selected.num ?? 1} onChange={(e) => setProp({ num: Math.max(0, Number(e.target.value) || 0) })} />
                </label>
              )}
              {selected?.kind === 'text' && !editingText && (
                <button type="button" className="pa-btn" onClick={() => setEditingText({ id: selected.id, value: selected.text || '' })}><Type className="w-3.5 h-3.5" /> Editar texto</button>
              )}
              {selected && (
                <span className="pa-group ml-auto">
                  <button type="button" className="pa-btn" onClick={duplicateSel} title="Duplicar (Ctrl+D)"><Copy className="w-3.5 h-3.5" /> Duplicar</button>
                  <button type="button" className="pa-btn danger" onClick={removeSel} title="Eliminar (Supr)"><Trash2 className="w-3.5 h-3.5" /> Eliminar</button>
                </span>
              )}
            </>
          ) : (
            <span className="pa-props-hint">Elegí una herramienta para dibujar, o hacé clic en una marca para cambiarla. <b>Supr</b> borra · <b>Ctrl+D</b> duplica · flechas mueven · <b>Shift</b> recto/cuadrado.</span>
          )}
        </div>

        <div className="pa-main">
          {/* ---- Herramientas ---- */}
          <div className="pa-tools">
            {TOOLS.map((t) => (
              <button key={t.id} type="button" title={`${t.label} (${t.key})`}
                className={`pa-tool${tool === t.id ? ' on' : ''}`}
                onClick={() => { setTool(t.id); if (t.id !== 'select') setSelId(null); }}>
                <t.icon className="w-4 h-4" />
                <span className="pa-tool-key">{t.key}</span>
              </button>
            ))}
            <div className="pa-tools-sep" />
            <button type="button" className="pa-tool" title="Deshacer (Ctrl+Z)" disabled={!past.length} onClick={undo}><Undo2 className="w-4 h-4" /></button>
            <button type="button" className="pa-tool" title="Rehacer (Ctrl+Y)" disabled={!future.length} onClick={redo}><Redo2 className="w-4 h-4" /></button>
          </div>

          {/* ---- Lienzo ---- */}
          <div className="pa-stage">
            <div className="pa-frame" style={{ aspectRatio: `${W} / ${H}`, ['--ar' as string]: String(W / H) } as React.CSSProperties}>
              <img src={viewSrc || baseSrc} alt="" className="pa-img" draggable={false} decoding="async" />
              <svg
                ref={svgRef}
                className={`pa-svg tool-${tool}`}
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onDoubleClick={onDoubleClick}
              >
                <defs>
                  <filter id="mk-shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx={S} dy={S} stdDeviation={Math.max(1.5, 2 * S)} floodColor="#000" floodOpacity="0.6" />
                  </filter>
                </defs>
                <ItemsLayer items={items} W={W} H={H} pixUrl={pixUrl} hit={12 * k} shadow={!dragging} hideId={liveId || editingText?.id} />
                <DraftLayer bind={bindLive} W={W} H={H} pixUrl={pixUrl} />
                {handles}
              </svg>
              {editingItem && editBox && (
                <input
                  autoFocus
                  className="pa-text-input"
                  value={editingText!.value}
                  placeholder="Escribí la nota…"
                  onChange={(e) => setEditingText({ ...editingText!, value: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); finishText(); }
                    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelText(); }
                  }}
                  onBlur={finishText}
                  style={{
                    left: `${(editBox.bx / W) * 100}%`, top: `${(editBox.by / H) * 100}%`,
                    fontSize: `${editBox.f / k}px`, color: editingItem.color,
                    minWidth: `${Math.max(120, editBox.bw / k)}px`, height: `${editBox.bh / k}px`,
                    background: editingItem.textBg !== false ? 'rgba(15,23,42,0.85)' : 'rgba(15,23,42,0.35)',
                    borderColor: editingItem.color, fontFamily: FONT_STACK,
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* ---- Pie ---- */}
        <div className="pa-foot">
          <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
            <span className="font-semibold text-slate-700">{items.length} {items.length === 1 ? 'marca' : 'marcas'}</span>
            {legacyBaked && <span className="truncate">· Las marcas de antes quedaron fijas en la foto: “Restablecer original” las quita.</span>}
            {err && <span className="text-rose-700">{err}</span>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {(photo.originalSrc || (photo.markup && photo.markup.length > 0)) && (
              <button type="button" onClick={revertOriginal} className="pa-btn warn" title="Quitar todas las marcas y volver a la foto original">
                <RotateCcw className="w-3.5 h-3.5" /> Restablecer original
              </button>
            )}
            <button type="button" onClick={tryClose} className="pa-btn">Cancelar</button>
            <button type="button" onClick={save} disabled={busy} className="pa-btn primary" title="Guardar (Ctrl+Enter)">
              <Check className="w-4 h-4 text-[#f4c84a]" /> {busy ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
