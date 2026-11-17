/**
 * Worker de conversión PDF → SVG. MuPDF trabaja de forma sincrónica y un plano
 * denso puede tardar; acá corre aparte para no congelar la interfaz.
 *
 * Protocolo: recibe { id, bytes } y responde { id, ok: true, ...PdfSvgResult }
 * o { id, ok: false, error }.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as mupdfModule from 'mupdf';
import { pdfPageToSvg, unwrapMupdf } from './pdfSvgCore';

const mupdf = unwrapMupdf(mupdfModule);
const ctx = self as any;

// Aviso de que el módulo (y su WASM) cargó bien.
ctx.postMessage({ id: 0, ready: true });

ctx.onmessage = (e: MessageEvent) => {
  const { id, bytes } = e.data as { id: number; bytes: Uint8Array };
  try {
    const r = pdfPageToSvg(mupdf, bytes);
    ctx.postMessage({ id, ok: true, ...r });
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: String((err as Error)?.message || err) });
  }
};
