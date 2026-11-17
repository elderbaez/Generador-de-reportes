/**
 * PDF y planos: carga diferida de pdf.js (para dibujar páginas) y pdf-lib (para
 * extraer una sola página como PDF liviano). Ninguna de las dos librerías se
 * descarga hasta que se usa el bloque de documentos por primera vez.
 *
 * Se usa la versión "legacy" de pdf.js porque incluye los polyfills necesarios
 * para navegadores que no son de última generación.
 */
import type { DocItem, DocCrop } from '../types';

/* ---------- Tipos mínimos (evita depender de nombres internos de pdf.js) ---------- */

export interface PdfViewport { width: number; height: number }
export interface PdfPage {
  rotate: number;
  getViewport(o: { scale: number; rotation?: number }): PdfViewport;
  render(o: { canvas: HTMLCanvasElement; viewport: PdfViewport; transform?: number[]; background?: string; intent?: string }): { promise: Promise<void>; cancel(): void };
  cleanup(): void;
}
export interface PdfDoc {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
  destroy(): Promise<void>;
}

type PdfjsModule = {
  getDocument(src: { data: Uint8Array; isEvalSupported?: boolean; password?: string }): { promise: Promise<unknown> };
  GlobalWorkerOptions: { workerSrc: string };
};

let pdfjsPromise: Promise<PdfjsModule> | null = null;

export function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist')
      .then((lib) => {
        const m = lib as unknown as PdfjsModule;
        // Apuntamos al worker usando new URL con ruta relativa desde este módulo.
        // Vite procesa new URL(string, import.meta.url) como asset estático sin
        // necesitar declaración en exports del package.json de pdfjs-dist.
        m.GlobalWorkerOptions.workerSrc = new URL(
          '../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).href;
        return m;
      })
      .catch((err) => {
        pdfjsPromise = null;
        throw err;
      });
  }
  return pdfjsPromise;
}

/* ---------- Conversión de datos ---------- */

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  const b64 = dataUrl.slice(comma + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CH)));
  }
  return `data:${mime};base64,${btoa(bin)}`;
}

/** Peso aproximado (bytes) de un data URL en base64. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  return Math.round(((dataUrl.length - comma - 1) * 3) / 4);
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/* ---------- Apertura de documentos ---------- */

export async function openPdf(bytes: Uint8Array): Promise<PdfDoc> {
  const lib = await loadPdfjs();
  // pdf.js transfiere el buffer al worker: se le pasa una copia para no perder el original.
  const task = lib.getDocument({ data: bytes.slice(), isEvalSupported: false });
  return (await task.promise) as PdfDoc;
}

/** Documentos ya abiertos (por id de elemento + tamaño de datos), para no reabrirlos en cada dibujo. */
const docCache = new Map<string, Promise<PdfDoc>>();

function itemDoc(item: DocItem): Promise<PdfDoc> {
  const key = `${item.id}|${item.src.length}`;
  let p = docCache.get(key);
  if (!p) {
    p = openPdf(dataUrlToBytes(item.src));
    p.catch(() => docCache.delete(key));
    docCache.set(key, p);
  }
  return p;
}

const imgCache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  const key = `${src.length}|${src.slice(-64)}`;
  let p = imgCache.get(key);
  if (!p) {
    p = new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('No se pudo leer la imagen'));
      im.src = src;
    });
    p.catch(() => imgCache.delete(key));
    imgCache.set(key, p);
  }
  return p;
}

/* ---------- Geometría ---------- */

export const normRot = (r: number) => (((Math.round(r / 90) * 90) % 360) + 360) % 360;

/** Tamaño de la página ya girada (en las unidades de pageW/pageH). */
export function rotatedSize(w: number, h: number, rotation: number): { w: number; h: number } {
  return normRot(rotation) % 180 === 0 ? { w, h } : { w: h, h: w };
}

export const FULL_CROP: DocCrop = { x: 0, y: 0, w: 1, h: 1 };

export function itemCrop(item: Pick<DocItem, 'crop'>): DocCrop {
  const c = item.crop;
  if (!c || c.w <= 0 || c.h <= 0) return FULL_CROP;
  return c;
}

/** Relación ancho/alto del fragmento visible. */
export function itemAspect(item: Pick<DocItem, 'pageW' | 'pageH' | 'rotation' | 'crop'>): number {
  const s = rotatedSize(item.pageW || 1, item.pageH || 1, item.rotation || 0);
  const c = itemCrop(item);
  return (s.w * c.w) / Math.max(1e-6, s.h * c.h);
}

export function isFullPage(item: Pick<DocItem, 'crop'>): boolean {
  const c = itemCrop(item);
  return c.x <= 0.001 && c.y <= 0.001 && c.w >= 0.998 && c.h >= 0.998;
}

/** Lados que quedaron cortados por el recorte (no coinciden con el borde de la hoja). */
export function cutSides(item: Pick<DocItem, 'crop'>): { top: boolean; right: boolean; bottom: boolean; left: boolean } {
  const c = itemCrop(item);
  const e = 0.002;
  return { top: c.y > e, left: c.x > e, right: c.x + c.w < 1 - e, bottom: c.y + c.h < 1 - e };
}

/* ---------- Dibujo ---------- */

const MAX_PIXELS = 18_000_000;

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/**
 * Dibuja una página de PDF (girada) recortada a `crop`, con `targetW` píxeles de ancho.
 * Sólo se dibuja la zona recortada, así un detalle chico de un plano A0 sale nítido
 * sin crear un lienzo gigante.
 */
export async function renderPdfRegion(page: PdfPage, rotation: number, crop: DocCrop, targetW: number): Promise<HTMLCanvasElement> {
  const rot = normRot((page.rotate || 0) + rotation);
  const base = page.getViewport({ scale: 1, rotation: rot });
  let scale = targetW / Math.max(1, base.width * crop.w);
  const area = base.width * crop.w * base.height * crop.h * scale * scale;
  if (area > MAX_PIXELS) scale *= Math.sqrt(MAX_PIXELS / area);
  const vp = page.getViewport({ scale, rotation: rot });
  const cw = vp.width * crop.w;
  const ch = vp.height * crop.h;
  const canvas = makeCanvas(cw, ch);
  const ctx = canvas.getContext('2d');
  if (ctx) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  await page.render({
    canvas,
    viewport: vp,
    transform: [1, 0, 0, 1, -vp.width * crop.x, -vp.height * crop.y],
    background: 'rgb(255,255,255)',
    intent: 'print',
  }).promise;
  return canvas;
}

/** Igual que renderPdfRegion, para imágenes (planos escaneados, capturas). */
export function renderImageRegion(img: HTMLImageElement, rotation: number, crop: DocCrop, targetW: number): HTMLCanvasElement {
  const rot = normRot(rotation);
  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  const rs = rotatedSize(nw, nh, rot);
  const srcW = rs.w * crop.w;
  const srcH = rs.h * crop.h;
  let scale = Math.min(1, targetW / Math.max(1, srcW)); // nunca agrandar más que el original
  if (srcW * srcH * scale * scale > MAX_PIXELS) scale = Math.sqrt(MAX_PIXELS / (srcW * srcH));
  const canvas = makeCanvas(srcW * scale, srcH * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(scale, scale);
  ctx.translate(-rs.w * crop.x, -rs.h * crop.y);
  // girar la imagen completa dentro de su caja rotada
  ctx.translate(rs.w / 2, rs.h / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.drawImage(img, -nw / 2, -nh / 2);
  return canvas;
}

function canvasToUrl(canvas: HTMLCanvasElement): string {
  // WebP conserva bien las líneas finas de los planos y pesa mucho menos que PNG.
  const webp = canvas.toDataURL('image/webp', 0.94);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
}

/** Resultados ya dibujados, por elemento + recorte + giro + resolución. */
const renderCache = new Map<string, Promise<string>>();

/**
 * Imagen (data URL) del fragmento visible de un elemento, con `targetW` px de ancho.
 * Se usa data URL (y no blob:) para que "Exportar HTML" conserve las imágenes.
 */
export function renderItemImage(item: DocItem, targetW: number): Promise<string> {
  const c = itemCrop(item);
  const bucket = Math.max(200, Math.ceil(targetW / 200) * 200);
  const key = [item.id, item.src.length, item.rotation || 0, c.x.toFixed(4), c.y.toFixed(4), c.w.toFixed(4), c.h.toFixed(4), bucket].join('|');
  let p = renderCache.get(key);
  if (!p) {
    p = (async () => {
      if (item.kind === 'pdf') {
        const doc = await itemDoc(item);
        const page = await doc.getPage(1);
        const canvas = await renderPdfRegion(page, item.rotation || 0, c, bucket);
        return canvasToUrl(canvas);
      }
      const img = await loadImage(item.src);
      return canvasToUrl(renderImageRegion(img, item.rotation || 0, c, bucket));
    })();
    p.catch(() => renderCache.delete(key));
    renderCache.set(key, p);
    if (renderCache.size > 60) {
      const first = renderCache.keys().next().value;
      if (first !== undefined && first !== key) renderCache.delete(first);
    }
  }
  return p;
}

/* ---------- Extracción de una página ---------- */

/**
 * Devuelve un PDF nuevo que contiene sólo la página `pageIndex` (0 = primera).
 * Si el archivo está protegido o pdf-lib no puede copiarla, devuelve null
 * (en ese caso se inserta la página como imagen).
 */
export async function extractPdfPage(bytes: Uint8Array, pageIndex: number): Promise<Uint8Array | null> {
  try {
    const { PDFDocument } = await import('pdf-lib');
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    if (src.isEncrypted) return null;
    const out = await PDFDocument.create({ updateMetadata: false });
    const [pg] = await out.copyPages(src, [pageIndex]);
    out.addPage(pg);
    return await out.save({ useObjectStreams: true });
  } catch (err) {
    console.warn('No se pudo extraer la página como PDF', err);
    return null;
  }
}

/** Página completa como imagen (para PDFs protegidos o para alivianar escaneos). */
export async function rasterizePage(page: PdfPage, dpi = 170): Promise<{ src: string; w: number; h: number }> {
  const vp1 = page.getViewport({ scale: 1, rotation: page.rotate || 0 });
  const targetW = (vp1.width / 72) * dpi;
  const canvas = await renderPdfRegion(page, 0, FULL_CROP, targetW);
  const src = canvas.toDataURL('image/jpeg', 0.88);
  return { src, w: canvas.width, h: canvas.height };
}

/** Tamaño de página en puntos tal como se ve (con el giro propio del PDF aplicado). */
export function pageSizePt(page: PdfPage): { w: number; h: number } {
  const vp = page.getViewport({ scale: 1, rotation: page.rotate || 0 });
  return { w: vp.width, h: vp.height };
}

/** Formato de papel aproximado (A4, A3, A1…) a partir del tamaño en puntos. */
export function paperName(wPt: number, hPt: number): string {
  const mm = (pt: number) => (pt / 72) * 25.4;
  const a = Math.min(mm(wPt), mm(hPt));
  const b = Math.max(mm(wPt), mm(hPt));
  const sizes: [string, number, number][] = [
    ['A4', 210, 297], ['A3', 297, 420], ['A2', 420, 594], ['A1', 594, 841], ['A0', 841, 1189],
    ['Carta', 216, 279], ['Oficio', 216, 356], ['Legal', 216, 356],
  ];
  for (const [n, w, h] of sizes) if (Math.abs(a - w) < 6 && Math.abs(b - h) < 6) return n;
  return `${Math.round(a)}×${Math.round(b)} mm`;
}
