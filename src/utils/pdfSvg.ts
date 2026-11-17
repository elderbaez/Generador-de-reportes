/**
 * Planos vectoriales: convierte la página PDF de un DocItem a SVG con MuPDF y
 * la devuelve recortada y girada, lista para un <img>.
 *
 * Por qué así:
 *  - Un SVG dentro de <img> se imprime como vector en Chrome (verificado), y el
 *    navegador lo rasteriza solo a la resolución de pantalla: liviano y nítido.
 *  - Se devuelve como data URL (no blob:) para que "Exportar HTML" lo conserve.
 *  - La conversión corre en un worker. Si el worker no arranca, se intenta en el
 *    hilo principal; si MuPDF no carga, se devuelve null y el bloque cae al
 *    dibujo como imagen de siempre. Nada se rompe.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { DocItem } from '../types';
import { dataUrlToBytes, bytesToDataUrl, itemCrop, normRot, rotatedSize } from './pdf';
import { pdfPageToSvg, unwrapMupdf, type PdfSvgResult } from './pdfSvgCore';

/* ---------- Estado del motor (para el indicador y la consola) ---------- */

export type VectorEngine = 'pending' | 'worker' | 'main' | 'unavailable';
let engine: VectorEngine = 'pending';
let engineReason = '';
export const vectorEngineStatus = () => ({ engine, reason: engineReason });

function giveUp(reason: string) {
  if (engine === 'unavailable') return;
  engine = 'unavailable';
  engineReason = reason;
  console.warn('[Documentos] No se pudo cargar MuPDF; los planos se dibujan como imagen.', reason);
}

/* ---------- Worker ---------- */

type Pending = { res: (r: PdfSvgResult) => void; rej: (e: Error) => void };
let worker: Worker | null = null;
let workerReady: Promise<void> | null = null;
let workerDead = false;
let seq = 0;
const pending = new Map<number, Pending>();

function startWorker(): Promise<void> {
  if (workerReady) return workerReady;
  workerReady = new Promise<void>((resolve, reject) => {
    let w: Worker;
    try {
      w = new Worker(new URL('./pdfSvg.worker.ts', import.meta.url), { type: 'module' });
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    // La primera carga baja ~10 MB de WASM: se le da tiempo de sobra.
    const timer = setTimeout(() => reject(new Error('El worker de MuPDF no respondió a tiempo')), 60_000);
    w.onmessage = (e: MessageEvent) => {
      const d = e.data as any;
      if (d?.ready) { clearTimeout(timer); worker = w; resolve(); return; }
      const p = pending.get(d?.id);
      if (!p) return;
      pending.delete(d.id);
      if (d.ok) p.res({ svg: d.svg, x0: d.x0, y0: d.y0, w: d.w, h: d.h });
      else p.rej(new Error(d.error || 'Error de conversión'));
    };
    w.onerror = (ev: ErrorEvent) => {
      clearTimeout(timer);
      const err = new Error(ev.message || 'El worker de MuPDF falló al cargar');
      workerDead = true;
      pending.forEach((p) => p.rej(err));
      pending.clear();
      try { w.terminate(); } catch { /* nada */ }
      worker = null;
      reject(err);
    };
  });
  workerReady.catch(() => { workerDead = true; });
  return workerReady;
}

function viaWorker(bytes: Uint8Array): Promise<PdfSvgResult> {
  return new Promise((res, rej) => {
    if (!worker) { rej(new Error('Worker no disponible')); return; }
    const id = ++seq;
    pending.set(id, { res, rej });
    // Copia transferible: el original sigue disponible para pdf.js.
    const copy = bytes.slice();
    worker.postMessage({ id, bytes: copy }, [copy.buffer]);
  });
}

/* ---------- Respaldo en el hilo principal ---------- */

let mainMupdf: Promise<any> | null = null;
let mainChain: Promise<unknown> = Promise.resolve();

function viaMain(bytes: Uint8Array): Promise<PdfSvgResult> {
  if (!mainMupdf) mainMupdf = import('mupdf').then(unwrapMupdf);
  // De a una por vez: cada conversión bloquea el hilo un momento.
  const run = mainChain.then(async () => pdfPageToSvg(await mainMupdf!, bytes));
  mainChain = run.catch(() => undefined);
  return run;
}

/* ---------- Conversión con caché ---------- */

const svgCache = new Map<string, Promise<PdfSvgResult | null>>();

async function convert(bytes: Uint8Array): Promise<PdfSvgResult | null> {
  if (engine === 'unavailable') return null;

  if (!workerDead) {
    try {
      await startWorker();
      const r = await viaWorker(bytes);
      if (engine === 'pending') { engine = 'worker'; console.info('[Documentos] Planos vectoriales con MuPDF (en segundo plano).'); }
      return r;
    } catch (err) {
      // Si el worker murió se sigue abajo; si fue un error de ESTE PDF, se respeta.
      if (!workerDead) throw err;
    }
  }

  try {
    const r = await viaMain(bytes);
    if (engine === 'pending') { engine = 'main'; console.info('[Documentos] Planos vectoriales con MuPDF (hilo principal).'); }
    return r;
  } catch (err) {
    if (engine === 'pending') giveUp(String((err as Error)?.message || err));
    return null;
  }
}

/** SVG de la página completa del elemento (sin recorte ni giro del usuario). */
export function pdfPageSvg(item: DocItem): Promise<PdfSvgResult | null> {
  if (item.kind !== 'pdf') return Promise.resolve(null);
  const key = `${item.id}|${item.src.length}`;
  let p = svgCache.get(key);
  if (!p) {
    p = convert(dataUrlToBytes(item.src)).catch((err) => {
      console.warn('[Documentos] Este PDF no se pudo pasar a vector; se dibuja como imagen.', err);
      return null;
    });
    svgCache.set(key, p);
    if (svgCache.size > 40) {
      const first = svgCache.keys().next().value;
      if (first !== undefined && first !== key) svgCache.delete(first);
    }
  }
  return p;
}

/* ---------- Recorte y giro ---------- */

const n = (v: number) => +v.toFixed(3);

/** Quita width/height/x/y del tag raíz del SVG de MuPDF y lo ubica en (0,0)-(W,H). */
function nestRoot(svg: string, r: PdfSvgResult): string {
  const start = svg.indexOf('<svg');
  const end = svg.indexOf('>', start);
  if (start < 0 || end < 0) throw new Error('SVG sin raíz');
  let attrs = svg.slice(start + 4, end);
  const selfClosing = attrs.endsWith('/');
  if (selfClosing) attrs = attrs.slice(0, -1);
  attrs = attrs.replace(/\s(?:width|height|x|y)\s*=\s*("[^"]*"|'[^']*')/g, '');
  if (!/\sviewBox\s*=/.test(attrs)) attrs += ` viewBox="${n(r.x0)} ${n(r.y0)} ${n(r.w)} ${n(r.h)}"`;
  const head = `<svg x="0" y="0" width="${n(r.w)}" height="${n(r.h)}"${attrs}>`;
  return head + (selfClosing ? '</svg>' : svg.slice(end + 1));
}

/** Transformación para girar el contenido W×H en sentido horario dentro de su caja girada. */
function rotTransform(rot: number, W: number, H: number): string {
  switch (rot) {
    case 90: return `translate(${n(H)} 0) rotate(90)`;
    case 180: return `translate(${n(W)} ${n(H)}) rotate(180)`;
    case 270: return `translate(0 ${n(W)}) rotate(270)`;
    default: return '';
  }
}

/**
 * Arma el SVG final: página girada por el usuario y recortada con un viewBox.
 * El recorte se define sobre la página ya girada, igual que en pdf.js.
 */
export function buildCroppedSvg(r: PdfSvgResult, item: Pick<DocItem, 'rotation' | 'crop'>): string {
  const rot = normRot(item.rotation || 0);
  const rs = rotatedSize(r.w, r.h, rot);
  const c = itemCrop(item);
  const vx = c.x * rs.w, vy = c.y * rs.h, vw = c.w * rs.w, vh = c.h * rs.h;
  const t = rotTransform(rot, r.w, r.h);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"` +
    ` width="${n(vw)}" height="${n(vh)}" viewBox="${n(vx)} ${n(vy)} ${n(vw)} ${n(vh)}" preserveAspectRatio="none">` +
    // Fondo blanco: muchos PDF no pintan el fondo, y debajo va la sombra.
    `<rect x="0" y="0" width="${n(rs.w)}" height="${n(rs.h)}" fill="#fff"/>` +
    `<g${t ? ` transform="${t}"` : ''}>${nestRoot(r.svg, r)}</g>` +
    `</svg>`
  );
}

const urlCache = new Map<string, Promise<string | null>>();

/**
 * Data URL de un SVG con el fragmento visible del elemento, o null si no se
 * pudo pasar a vector (en ese caso el que llama dibuja la imagen como antes).
 */
export function itemSvgUrl(item: DocItem): Promise<string | null> {
  if (item.kind !== 'pdf') return Promise.resolve(null);
  const c = itemCrop(item);
  const key = [item.id, item.src.length, normRot(item.rotation || 0), n(c.x), n(c.y), n(c.w), n(c.h)].join('|');
  let p = urlCache.get(key);
  if (!p) {
    p = pdfPageSvg(item).then((r) => {
      if (!r) return null;
      try {
        const bytes = new TextEncoder().encode(buildCroppedSvg(r, item));
        return bytesToDataUrl(bytes, 'image/svg+xml');
      } catch (err) {
        console.warn('[Documentos] No se pudo armar el SVG recortado.', err);
        return null;
      }
    });
    urlCache.set(key, p);
    if (urlCache.size > 60) {
      const first = urlCache.keys().next().value;
      if (first !== undefined && first !== key) urlCache.delete(first);
    }
  }
  return p;
}
