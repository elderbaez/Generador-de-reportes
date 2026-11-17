import { MarkupItem, MarkupKind } from '../types';

/* =====================================================================
   Motor de anotaciones de fotos: medidas, cajas y dibujo en canvas.
   La vista previa (SVG) y el guardado (canvas) usan exactamente las
   mismas fórmulas, así lo que se ve al editar es lo que queda en la foto.
   ===================================================================== */

export const FONT_STACK = '"Plus Jakarta Sans", system-ui, sans-serif';

export const scaleOf = (W: number, H: number) => Math.max(W, H) / 1000;
export const strokePx = (it: MarkupItem, S: number) =>
  it.kind === 'highlight' ? Math.max(6, it.width * S * 7) : Math.max(2, it.width * S * 1.5);
export const fontPx = (it: MarkupItem, S: number) => Math.round((it.fontSize || 24) * S * 1.3);
export const markerR = (it: MarkupItem, S: number) => fontPx(it, S) * 0.85;
export const itemOpacity = (it: MarkupItem) => it.opacity ?? (it.kind === 'highlight' ? 0.4 : 1);
export const hasShadow = (k: MarkupKind) => k !== 'highlight' && k !== 'blur';

let mctx: CanvasRenderingContext2D | null = null;
export function measureText(text: string, px: number): number {
  if (!mctx && typeof document !== 'undefined') mctx = document.createElement('canvas').getContext('2d');
  if (!mctx) return text.length * px * 0.6;
  mctx.font = `bold ${px}px ${FONT_STACK}`;
  return mctx.measureText(text).width;
}

/** Geometría de la caja de texto (con o sin fondo). */
export function textBox(it: MarkupItem, W: number, H: number) {
  const S = scaleOf(W, H);
  const f = fontPx(it, S);
  const w = measureText(it.text || ' ', f);
  const padX = f * 0.35, padY = f * 0.2;
  const x = it.x1 * W, y = it.y1 * H;
  return { f, x, y, w, h: f * 1.25, padX, padY, bx: x - padX, by: y - padY, bw: w + padX * 2, bh: f * 1.25 + padY * 2, r: Math.min(8 * S, (f * 1.25 + padY * 2) / 3) };
}

/** Caja que ocupa la marca, en píxeles de la imagen. */
export function bboxOf(it: MarkupItem, W: number, H: number): { x: number; y: number; w: number; h: number } {
  const S = scaleOf(W, H);
  if (it.kind === 'text') { const t = textBox(it, W, H); return { x: t.bx, y: t.by, w: t.bw, h: t.bh }; }
  if (it.kind === 'marker') { const r = markerR(it, S); return { x: it.x1 * W - r, y: it.y1 * H - r, w: r * 2, h: r * 2 }; }
  if ((it.kind === 'pen' || it.kind === 'highlight') && it.points?.length) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < it.points.length; i += 2) {
      const x = it.points[i] * W, y = it.points[i + 1] * H;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    const p = strokePx(it, S) / 2;
    return { x: x0 - p, y: y0 - p, w: x1 - x0 + p * 2, h: y1 - y0 + p * 2 };
  }
  const x = Math.min(it.x1, it.x2) * W, y = Math.min(it.y1, it.y2) * H;
  return { x, y, w: Math.abs(it.x2 - it.x1) * W, h: Math.abs(it.y2 - it.y1) * H };
}

/** Puntas de flecha (polígono) y fin de la línea. */
export function arrowGeom(it: MarkupItem, W: number, H: number) {
  const S = scaleOf(W, H);
  const sw = strokePx(it, S);
  const sx = it.x1 * W, sy = it.y1 * H, ex = it.x2 * W, ey = it.y2 * H;
  const a = Math.atan2(ey - sy, ex - sx);
  const head = Math.min(80 * S, Math.max(26 * S, 20 * S + sw * 2));
  const ha = 0.44;
  return {
    sx, sy, ex, ey, sw,
    lx: ex - Math.cos(a) * head * 0.35, ly: ey - Math.sin(a) * head * 0.35,
    pts: [
      [ex, ey],
      [ex - head * Math.cos(a - ha), ey - head * Math.sin(a - ha)],
      [ex - head * 0.65 * Math.cos(a), ey - head * 0.65 * Math.sin(a)],
      [ex - head * Math.cos(a + ha), ey - head * Math.sin(a + ha)],
    ] as [number, number][],
  };
}

/** Cota: línea con remates en los extremos y la medida escrita sobre la línea. */
export function dimGeom(it: MarkupItem, W: number, H: number) {
  const S = scaleOf(W, H);
  const sw = strokePx(it, S);
  const sx = it.x1 * W, sy = it.y1 * H, ex = it.x2 * W, ey = it.y2 * H;
  const a = Math.atan2(ey - sy, ex - sx);
  const nx = -Math.sin(a), ny = Math.cos(a);           // normal
  const tick = 9 * S + sw * 2.2;                        // largo de los remates
  const head = Math.max(10 * S, sw * 3.2);              // flechitas
  const ha = 0.5;
  const arrow = (x: number, y: number, dir: number): [number, number][] => [
    [x, y],
    [x - dir * head * Math.cos(a - ha), y - dir * head * Math.sin(a - ha)],
    [x - dir * head * Math.cos(a + ha), y - dir * head * Math.sin(a + ha)],
  ];
  // Texto: centrado sobre la línea y siempre legible (nunca cabeza abajo)
  let ta = a;
  if (ta > Math.PI / 2) ta -= Math.PI; else if (ta < -Math.PI / 2) ta += Math.PI;
  const f = fontPx(it, S);
  const label = (it.text || '').trim();
  const tw = label ? measureText(label, f) : 0;
  const off = f * 0.95 + sw;
  const side = Math.cos(ta - a) >= 0 ? -1 : 1;          // del lado "de arriba" del texto
  return {
    sx, sy, ex, ey, sw, a, ta, f, label, tw,
    t1: [sx + nx * tick, sy + ny * tick, sx - nx * tick, sy - ny * tick],
    t2: [ex + nx * tick, ey + ny * tick, ex - nx * tick, ey - ny * tick],
    a1: arrow(sx, sy, -1), a2: arrow(ex, ey, 1),
    cx: (sx + ex) / 2 + nx * off * side, cy: (sy + ey) / 2 + ny * off * side,
    padX: f * 0.35, padY: f * 0.18,
  };
}

/** Trazo a mano alzada suavizado (curvas por los puntos medios). */
export function freehandPath(points: number[], W: number, H: number): string {
  if (points.length < 4) {
    const x = points[0] * W, y = points[1] * H;
    return `M${x} ${y} L${x + 0.01} ${y}`;
  }
  let d = `M${points[0] * W} ${points[1] * H}`;
  for (let i = 2; i < points.length - 2; i += 2) {
    const x = points[i] * W, y = points[i + 1] * H;
    const nx = points[i + 2] * W, ny = points[i + 3] * H;
    d += ` Q${x} ${y} ${(x + nx) / 2} ${(y + ny) / 2}`;
  }
  d += ` L${points[points.length - 2] * W} ${points[points.length - 1] * H}`;
  return d;
}

/** Imagen pixelada (para la herramienta Ocultar). */
export function pixelate(img: CanvasImageSource, W: number, H: number): HTMLCanvasElement {
  const block = Math.max(6, Math.round(Math.max(W, H) / 70));
  const small = document.createElement('canvas');
  small.width = Math.max(1, Math.ceil(W / block)); small.height = Math.max(1, Math.ceil(H / block));
  small.getContext('2d')!.drawImage(img, 0, 0, small.width, small.height);
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const c = out.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  c.drawImage(small, 0, 0, W, H);
  return out;
}

/* ---------- Dibujo en canvas (guardado) ---------- */

export function drawItem(ctx: CanvasRenderingContext2D, it: MarkupItem, W: number, H: number, pix?: HTMLCanvasElement | null) {
  const S = scaleOf(W, H);
  const sw = strokePx(it, S);
  ctx.save();
  ctx.globalAlpha = itemOpacity(it);
  ctx.strokeStyle = it.color; ctx.fillStyle = it.color;
  ctx.lineWidth = sw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (it.dashed) ctx.setLineDash([sw * 2.2, sw * 1.8]);
  if (hasShadow(it.kind)) {
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = Math.max(3, 2 * S * 1.6); ctx.shadowOffsetX = S; ctx.shadowOffsetY = S;
  }
  const sx = it.x1 * W, sy = it.y1 * H, ex = it.x2 * W, ey = it.y2 * H;
  const fillSoft = () => {
    if (!it.fill) return;
    ctx.save(); ctx.shadowColor = 'transparent'; ctx.globalAlpha = itemOpacity(it) * 0.2; ctx.fill(); ctx.restore();
  };
  switch (it.kind) {
    case 'line':
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke(); break;
    case 'dim': {
      const g = dimGeom(it, W, H);
      ctx.beginPath(); ctx.moveTo(g.sx, g.sy); ctx.lineTo(g.ex, g.ey); ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = Math.max(1.5, sw * 0.8);
      ctx.beginPath(); ctx.moveTo(g.t1[0], g.t1[1]); ctx.lineTo(g.t1[2], g.t1[3]); ctx.moveTo(g.t2[0], g.t2[1]); ctx.lineTo(g.t2[2], g.t2[3]); ctx.stroke();
      [g.a1, g.a2].forEach((pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); });
      if (g.label) {
        ctx.save();
        ctx.translate(g.cx, g.cy); ctx.rotate(g.ta);
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = 'rgba(15,23,42,0.85)';
        const bw = g.tw + g.padX * 2, bh = g.f * 1.2 + g.padY * 2;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 3); else ctx.rect(-bw / 2, -bh / 2, bw, bh);
        ctx.fill();
        ctx.fillStyle = it.color;
        ctx.font = `bold ${g.f}px ${FONT_STACK}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(g.label, 0, g.f * 0.04);
        ctx.restore();
      }
      break;
    }
    case 'arrow': {
      const g = arrowGeom(it, W, H);
      ctx.beginPath(); ctx.moveTo(g.sx, g.sy); ctx.lineTo(g.lx, g.ly); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); g.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill();
      break;
    }
    case 'rect': {
      const b = bboxOf(it, W, H);
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') ctx.roundRect(b.x, b.y, b.w, b.h, 8 * S); else ctx.rect(b.x, b.y, b.w, b.h);
      fillSoft(); ctx.stroke(); break;
    }
    case 'ellipse': {
      ctx.beginPath(); ctx.ellipse((sx + ex) / 2, (sy + ey) / 2, Math.abs(ex - sx) / 2, Math.abs(ey - sy) / 2, 0, 0, Math.PI * 2);
      fillSoft(); ctx.stroke(); break;
    }
    case 'pen':
    case 'highlight': {
      if (!it.points?.length) break;
      const p = new Path2D(freehandPath(it.points, W, H));
      if (it.kind === 'highlight') ctx.globalCompositeOperation = 'multiply';
      ctx.stroke(p); break;
    }
    case 'blur': {
      const b = bboxOf(it, W, H);
      if (pix && b.w > 0 && b.h > 0) ctx.drawImage(pix, b.x, b.y, b.w, b.h, b.x, b.y, b.w, b.h);
      break;
    }
    case 'marker': {
      const r = markerR(it, S);
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = Math.max(2, r * 0.14); ctx.strokeStyle = '#ffffff'; ctx.stroke();
      ctx.fillStyle = contrastOn(it.color);
      ctx.font = `800 ${Math.round(r * 1.05)}px ${FONT_STACK}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(it.num ?? 1), sx, sy + r * 0.04);
      break;
    }
    case 'text': {
      if (!it.text) break;
      const t = textBox(it, W, H);
      if (it.textBg !== false) {
        ctx.save(); ctx.shadowColor = 'transparent';
        ctx.fillStyle = 'rgba(15,23,42,0.85)';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(t.bx, t.by, t.bw, t.bh, t.r); else ctx.rect(t.bx, t.by, t.bw, t.bh);
        ctx.fill(); ctx.setLineDash([]); ctx.lineWidth = Math.max(1.5, 2 * S); ctx.strokeStyle = it.color; ctx.stroke();
        ctx.restore();
      }
      ctx.font = `bold ${t.f}px ${FONT_STACK}`;
      ctx.textBaseline = 'top';
      ctx.shadowBlur = it.textBg !== false ? 0 : Math.max(3, 4 * S);
      ctx.fillText(it.text, t.x, t.y);
      break;
    }
  }
  ctx.restore();
}

/** Texto blanco u oscuro según el color de fondo. */
export function contrastOn(hex: string): string {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (!m) return '#ffffff';
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? '#0f172a' : '#ffffff';
}

/** Dibuja la foto con todas sus marcas al tamaño real y devuelve la imagen resultante. */
export async function renderMarkedImage(src: string, items: MarkupItem[]): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('No se pudo abrir la foto.'));
    i.src = src;
  });
  const W = img.naturalWidth || 1200, H = img.naturalHeight || 800;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, W, H);
  const pix = items.some((i) => i.kind === 'blur') ? pixelate(img, W, H) : null;
  // Primero lo que oculta y resalta (debajo), después las marcas
  const order = (k: MarkupKind) => (k === 'blur' ? 0 : k === 'highlight' ? 1 : 2);
  [...items].sort((a, b) => order(a.kind) - order(b.kind)).forEach((it) => drawItem(ctx, it, W, H, pix));
  return canvas.toDataURL('image/jpeg', 0.92);
}

/* =====================================================================
   Lupa / callout (kind='magnifier')
   La zona marcada es x1,y1→x2,y2. El callout es esa zona ampliada por
   `zoom`, apoyada en calloutX/calloutY. Puede quedar fuera del fragmento.
   ===================================================================== */

export interface MagGeom {
  shape: 'rect' | 'circle';
  zoom: number;
  /** Zona marcada, en px. */
  zx: number; zy: number; zw: number; zh: number;
  /** Centro y radio de la zona (shape='circle'). */
  zcx: number; zcy: number; zr: number;
  /** Callout, en px. Siempre zona × zoom, así no se deforma. */
  cx: number; cy: number; cw: number; ch: number;
  /** Centro y radio del callout (shape='circle'). */
  ccx: number; ccy: number; cr: number;
  /** Desplazamiento de la imagen para que la zona caiga dentro del callout. */
  imgX: number; imgY: number; imgW: number; imgH: number;
  sw: number;
}

/** Geometría completa de una lupa. `W`,`H` son el tamaño del fragmento en px. */
export function magGeom(it: MarkupItem, W: number, H: number): MagGeom {
  const S = scaleOf(W, H);
  const sw = Math.max(1.5, it.width * S * 1.2);
  const mg = it.magnifier;
  const zoom = Math.max(1.2, Math.min(8, mg?.zoom ?? 3));
  const shape = mg?.shape === 'circle' ? 'circle' : 'rect';

  const zx = Math.min(it.x1, it.x2) * W, zy = Math.min(it.y1, it.y2) * H;
  const zw = Math.abs(it.x2 - it.x1) * W, zh = Math.abs(it.y2 - it.y1) * H;
  const zcx = zx + zw / 2, zcy = zy + zh / 2;
  const zr = Math.min(zw, zh) / 2;

  const cw = zw * zoom, ch = zh * zoom;
  const cx = (mg?.calloutX ?? 0) * W, cy = (mg?.calloutY ?? 0) * H;
  const ccx = cx + cw / 2, ccy = cy + ch / 2;
  const cr = zr * zoom;

  // La imagen se dibuja a escala `zoom` y se corre para que el punto (zx,zy)
  // de la imagen caiga exactamente en (cx,cy) del callout.
  return {
    shape, zoom, zx, zy, zw, zh, zcx, zcy, zr,
    cx, cy, cw, ch, ccx, ccy, cr,
    imgX: cx - zx * zoom, imgY: cy - zy * zoom, imgW: W * zoom, imgH: H * zoom,
    sw,
  };
}

/**
 * Líneas guía entre zona y callout. Para círculos son las dos tangentes
 * exteriores; para rectángulos, los dos vértices del lado que se enfrenta.
 */
export function magGuides(g: MagGeom): [number, number, number, number][] {
  const dx = g.ccx - g.zcx, dy = g.ccy - g.zcy;
  const d = Math.hypot(dx, dy);
  if (d < 1) return [];

  if (g.shape === 'circle') {
    const a = Math.atan2(dy, dx);
    const ratio = (g.zr - g.cr) / d;
    if (Math.abs(ratio) > 1) return [];
    const t = Math.acos(ratio);
    return [a - t, a + t].map((ang) => {
      const c = Math.cos(ang), s = Math.sin(ang);
      return [g.zcx + g.zr * c, g.zcy + g.zr * s, g.ccx + g.cr * c, g.ccy + g.cr * s] as
        [number, number, number, number];
    });
  }

  // Rectángulos: se conecta el lado enfrentado según el eje dominante.
  const zr2 = g.zx + g.zw, zb = g.zy + g.zh;
  const cr2 = g.cx + g.cw, cb = g.cy + g.ch;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0
      ? [[zr2, g.zy, g.cx, g.cy], [zr2, zb, g.cx, cb]]
      : [[g.zx, g.zy, cr2, g.cy], [g.zx, zb, cr2, cb]];
  }
  return dy > 0
    ? [[g.zx, zb, g.cx, cb], [zr2, zb, cr2, cb]]
    : [[g.zx, g.zy, g.cx, g.cy], [zr2, g.zy, cr2, g.cy]];
}

/**
 * Cuánto sobresale el callout de una lupa más allá del fragmento, como
 * fracción del ancho/alto del fragmento. Se usa para reservar margen.
 */
export function magOutset(it: MarkupItem): { t: number; r: number; b: number; l: number } {
  const g = magGeom(it, 1, 1);
  return {
    l: Math.max(0, -g.cx),
    t: Math.max(0, -g.cy),
    r: Math.max(0, g.cx + g.cw - 1),
    b: Math.max(0, g.cy + g.ch - 1),
  };
}
