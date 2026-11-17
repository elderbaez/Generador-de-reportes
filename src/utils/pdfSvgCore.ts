/**
 * Núcleo de la conversión PDF → SVG con MuPDF. Lo usan el worker
 * (pdfSvg.worker.ts) y, si el worker no arranca, el hilo principal.
 *
 * Se tipa `mupdf` como `any` a propósito: el paquete trae sus tipos, pero así
 * este archivo no se rompe si cambian entre versiones menores.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export interface PdfSvgResult {
  /** SVG completo de la página tal como lo escribe MuPDF. */
  svg: string;
  /** Caja de la página (ya con el /Rotate propio del PDF aplicado), en puntos. */
  x0: number;
  y0: number;
  w: number;
  h: number;
}

/** Libera memoria WASM si el objeto lo permite (no todas las versiones exponen destroy). */
function free(...objs: any[]) {
  for (const o of objs) {
    try { o?.destroy?.(); } catch { /* ya liberado */ }
  }
}

/**
 * Convierte la primera página de `bytes` (un PDF) a SVG.
 * `text=path`: el texto sale como trazos, así no depende de las fuentes del
 * equipo y se imprime idéntico en cualquier lado.
 */
export function pdfPageToSvg(mupdf: any, bytes: Uint8Array): PdfSvgResult {
  const doc = mupdf.Document.openDocument(bytes, 'application/pdf');
  let page: any, buf: any, writer: any;
  try {
    page = doc.loadPage(0);
    const b = page.getBounds() as number[];
    buf = new mupdf.Buffer();
    writer = new mupdf.DocumentWriter(buf, 'svg', 'text=path');
    const dev = writer.beginPage(b);
    page.run(dev, mupdf.Matrix.identity);
    writer.endPage();
    writer.close();
    const svg = String(buf.asString());
    if (!svg.includes('<svg')) throw new Error('MuPDF no devolvió un SVG');
    return { svg, x0: b[0], y0: b[1], w: b[2] - b[0], h: b[3] - b[1] };
  } finally {
    free(writer, buf, page, doc);
  }
}

/** El módulo de MuPDF puede venir como default o con exports nombrados. */
export function unwrapMupdf(mod: any): any {
  return mod?.Document ? mod : mod?.default ?? mod;
}
