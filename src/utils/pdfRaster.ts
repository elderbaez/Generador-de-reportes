/* =====================================================================
   PDF armado por el programa (sin la impresión del sistema).
   Cada hoja se dibuja como imagen con el mismo motor del navegador
   (html-to-image) y se arma un PDF A4 con una imagen por página.
   Sale igual en cualquier equipo — pensado para iPhone/iPad, donde la
   impresión de Safari agrega márgenes, pierde fotos y no respeta filtros.
   Encima de esa imagen van en vector los planos PDF insertados y una capa
   de texto invisible para buscar y copiar (ver pdfVector.ts).
   Necesita el paquete "html-to-image" (npm i html-to-image).
   ===================================================================== */
import { collectPrintImages, swapForPrint, PdfPreset } from './printImages';
import { pageSize, getPageSetup } from './pageSetup';
import { VectorPdf, VecDoc } from './pdfVector';

/** Resolución de la hoja completa según la calidad elegida (ppp) */
export const RASTER_DPI: Record<PdfPreset['id'], { dpi: number; quality: number }> = {
  original: { dpi: 300, quality: 0.92 },
  alta: { dpi: 250, quality: 0.88 },
  media: { dpi: 200, quality: 0.85 },
  correo: { dpi: 160, quality: 0.78 },
  minima: { dpi: 120, quality: 0.7 },
};

/** Tamaño de página en puntos PDF según la hoja elegida (A4: 595,28 × 841,89) */
const pagePt = () => { const { w, h } = pageSize(getPageSetup()); return { w: +(w * 72 / 25.4).toFixed(2), h: +(h * 72 / 25.4).toFixed(2) }; };

// Safari y todos los navegadores de iPhone/iPad (Chrome de iOS también usa el motor de Safari)
const isWebKit = () => /AppleWebKit/.test(navigator.userAgent) && !/Chrome\/|Chromium|Edg\/|Android/.test(navigator.userAgent);

/** Lo que no va en la hoja impresa (lo mismo que oculta la hoja de estilos de impresión) */
const keepNode = (n: HTMLElement) => {
  if (!(n instanceof Element)) return true;
  if (n.classList.contains('no-print') || n.tagName === 'BUTTON') return false;
  if (n.getAttribute('role') === 'tooltip') return false;
  // Lo que en pantalla está oculto (display: none) tampoco va al PDF:
  if (getComputedStyle(n).display === 'none') return false;
  return true;
};

/**
 * Dibuja la hoja (SVG con la copia de la página) en un lienzo.
 * Safari carga las fotos que hay dentro del SVG de a poco y, si se dibuja
 * enseguida, algunas salen en blanco (más cuantas más y más pesadas son).
 * Por eso se vuelve a dibujar hasta que dos dibujos seguidos salen iguales.
 */
async function drawSheet(svgUrl: string, w: number, h: number, ratio: number): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.decoding = 'sync';
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('No se pudo preparar la hoja.'));
    img.src = svgUrl;
  });
  try { await img.decode(); } catch { /* ya cargó */ }

  // iPhone/iPad no dibujan lienzos de más de ~16 millones de píxeles (una A3 a 300 ppp se pasa)
  ratio = Math.min(ratio, Math.sqrt(16_000_000 / (w * h)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * ratio);
  canvas.height = Math.round(h * ratio);
  const ctx = canvas.getContext('2d')!;
  const probe = document.createElement('canvas');
  probe.width = 96; probe.height = 136;
  const pctx = probe.getContext('2d', { willReadFrequently: true })!;
  const draw = () => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  const signature = () => {
    pctx.drawImage(canvas, 0, 0, probe.width, probe.height);
    const d = pctx.getImageData(0, 0, probe.width, probe.height).data;
    let hsh = 0;
    for (let i = 0; i < d.length; i += 4) hsh = (hsh * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) | 0;
    return hsh;
  };

  draw();
  if (!isWebKit()) return canvas;
  // Safari: se repite (con pausas cada vez más largas) hasta que el dibujo deja de cambiar
  let prev = signature(), same = 0;
  for (let k = 0; k < 12 && same < 2; k++) {
    await new Promise((r) => setTimeout(r, 150 + k * 100));
    draw();
    const sig = signature();
    same = sig === prev ? same + 1 : 0;
    prev = sig;
  }
  return canvas;
}

/**
 * html-to-image copia los SVG tal cual, sin los estilos que les llegan por
 * clases (colores del tema, rieles, reflejos…). Antes de dibujar se
 * escriben esos estilos en cada elemento del SVG; después se dejan como estaban.
 */
const SVG_PROPS = [
  'display', 'visibility', 'opacity', 'fill', 'fill-opacity', 'stroke', 'stroke-opacity', 'stroke-width',
  'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'color', 'stop-color', 'stop-opacity',
  'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'text-anchor', 'dominant-baseline',
  'mix-blend-mode', 'filter',
];
function inlineSvgStyles(root: HTMLElement): () => void {
  const saved: { el: Element; style: string | null }[] = [];
  root.querySelectorAll('svg *').forEach((el) => {
    if (!(el instanceof SVGElement)) return;
    const cs = getComputedStyle(el);
    saved.push({ el, style: el.getAttribute('style') });
    let css = '';
    for (const prop of SVG_PROPS) {
      const v = cs.getPropertyValue(prop);
      if (v) css += `${prop}:${v};`;
    }
    el.setAttribute('style', css + (el.getAttribute('style') || ''));
  });
  return () => {
    for (const { el, style } of saved) {
      if (style == null) el.removeAttribute('style'); else el.setAttribute('style', style);
    }
  };
}

/* ---- PDF mínimo: una imagen JPEG por página ---- */
function buildPdf(pages: { jpeg: Uint8Array; w: number; h: number }[], title: string): Blob {
  const enc = new TextEncoder();
  const parts: (Uint8Array | string)[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const push = (x: Uint8Array | string) => { parts.push(x); pos += typeof x === 'string' ? enc.encode(x).length : x.length; };
  const obj = (n: number, body: string | (Uint8Array | string)[]) => {
    offsets[n] = pos;
    push(`${n} 0 obj\n`);
    if (typeof body === 'string') push(body); else body.forEach(push);
    push('\nendobj\n');
  };
  const pdfStr = (t: string) => {
    // Texto en UTF-16BE para que salgan bien los acentos
    let hex = 'FEFF';
    for (const ch of t) { const c = ch.charCodeAt(0); hex += c.toString(16).padStart(4, '0').toUpperCase(); }
    return `<${hex}>`;
  };

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const n = pages.length;
  const pageIds = pages.map((_, i) => 4 + i * 3);
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Count ${n} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`);
  obj(3, `<< /Title ${pdfStr(title)} /Producer (Generador de Reportes) >>`);
  const A4_PT = pagePt();
  pages.forEach((p, i) => {
    const pid = pageIds[i], cid = pid + 1, iid = pid + 2;
    obj(pid, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_PT.w} ${A4_PT.h}] /Resources << /XObject << /Im0 ${iid} 0 R >> >> /Contents ${cid} 0 R >>`);
    const content = `q ${A4_PT.w} 0 0 ${A4_PT.h} 0 0 cm /Im0 Do Q`;
    obj(cid, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    obj(iid, [`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`, p.jpeg, '\nendstream']);
  });
  const total = 4 + n * 3;
  const xref = pos;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) x += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  push(x);
  push(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts.map((p) => (typeof p === 'string' ? enc.encode(p) : p)) as BlobPart[], { type: 'application/pdf' });
}

/**
 * Dibuja todas las hojas y devuelve el PDF.
 * onProgress(hoja, total) avisa por qué hoja va.
 */
/** Reglas @font-face con local() de la página (fuentes instaladas en el equipo) */
function localFontFaceCss(): string {
  const out: string[] = [];
  for (const sh of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try { rules = sh.cssRules; } catch { continue; }
    for (const r of Array.from(rules)) {
      if (r instanceof CSSFontFaceRule && /local\(/i.test(r.style.getPropertyValue('src')) && !/url\(/i.test(r.style.getPropertyValue('src'))) out.push(r.cssText);
    }
  }
  return out.join('\n');
}

/**
 * Las marcas de un plano que va en vector, como PNG transparente para ponerlas encima.
 * El fondo y la imagen de las lupas se ocultan: esas partes ya van en vector.
 */
async function overlayPng(svg: SVGSVGElement, w: number, h: number, ratio: number, fontCss?: string): Promise<Uint8Array | null> {
  const unhide = VectorPdf.hide([{ overlay: svg } as unknown as VecDoc], 'overlay');
  const undo = inlineSvgStyles(svg.parentElement as HTMLElement);
  let xml: string;
  try {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    clone.removeAttribute('style');
    clone.querySelectorAll('[style*="visibility: hidden"], [style*="visibility:hidden"]').forEach((n) => n.remove());
    if (fontCss) {
      const st = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      st.textContent = fontCss;
      clone.insertBefore(st, clone.firstChild);
    }
    xml = new XMLSerializer().serializeToString(clone);
  } finally { undo(); unhide(); }
  const img = new Image();
  try {
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('marcas')); img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`; });
  } catch { return null; }
  const r = Math.min(ratio, Math.sqrt(12_000_000 / Math.max(1, w * h)));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * r)); c.height = Math.max(1, Math.round(h * r));
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  const b = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
  c.width = c.height = 0;
  return b ? new Uint8Array(await b.arrayBuffer()) : null;
}

export async function renderSheetsToPdf(
  preset: PdfPreset, title: string, onProgress?: (page: number, total: number) => void,
): Promise<Blob> {
  const root = document.getElementById('report-print-container');
  if (!root) throw new Error('No se encontraron las hojas.');
  const sheets = Array.from(root.querySelectorAll<HTMLElement>('.a4-sheet'));
  if (!sheets.length) throw new Error('No hay hojas para exportar.');

  const { toSvg, getFontEmbedCSS } = await import('html-to-image');
  const { dpi, quality } = RASTER_DPI[preset.id];

  // Fotos con la resolución justa (menos memoria: en iPhone las fotos enteras la agotan)
  const restore = await swapForPrint(collectPrintImages(root), { ...preset, dpi, quality: Math.max(quality, 0.85) });
  try {
    let fontEmbedCSS: string | undefined;
    try { fontEmbedCSS = await getFontEmbedCSS(sheets[0]); } catch { fontEmbedCSS = undefined; }
    // Fuentes del equipo declaradas con local() (por ejemplo en un tema): html-to-image solo copia
    // las que se descargan, así que estas se agregan aparte para que el PDF use la misma letra
    const local = localFontFaceCss();
    if (local) fontEmbedCSS = `${fontEmbedCSS ?? ''}\n${local}`;

    const out: { jpeg: Uint8Array; w: number; h: number }[] = [];
    // Planos en vector y texto buscable; sin pdf-lib queda como antes (todo imagen)
    const vpdf = await VectorPdf.create();
    const pt = pagePt();
    for (let i = 0; i < sheets.length; i++) {
      onProgress?.(i + 1, sheets.length);
      const sheet = sheets[i];
      const w = sheet.offsetWidth, h = sheet.offsetHeight;
      const opts = {
        width: w,
        height: h,
        backgroundColor: '#ffffff',
        cacheBust: false,
        fontEmbedCSS,
        skipFonts: fontEmbedCSS === undefined,
        filter: keepNode,
        style: { margin: '0', border: '0', boxShadow: 'none', transform: 'none', outline: 'none' } as Partial<CSSStyleDeclaration>,
      };
      const vec: VecDoc[] = vpdf ? await vpdf.prepare(sheet) : [];
      const undoSvg = inlineSvgStyles(sheet);
      let svgUrl: string;
      // Los planos que van en vector no se dibujan en la imagen de la hoja (ni sus marcas: van aparte, encima)
      const unhide = VectorPdf.hide(vec, 'sheet');
      try { svgUrl = await toSvg(sheet, opts); } finally { unhide(); undoSvg(); }
      const canvas = await drawSheet(svgUrl, w, h, dpi / 96);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
      if (!blob) throw new Error(`No se pudo dibujar la hoja ${i + 1}.`);
      const jpeg = new Uint8Array(await blob.arrayBuffer());
      const cw = canvas.width, ch = canvas.height;
      // Libera la memoria del dibujo antes de seguir (iPhone)
      canvas.width = canvas.height = 0;

      if (!vpdf) { out.push({ jpeg, w: cw, h: ch }); continue; }
      const page = vpdf.doc.addPage([pt.w, pt.h]);
      page.drawImage(await vpdf.doc.embedJpg(jpeg), { x: 0, y: 0, width: pt.w, height: pt.h });
      const k = pt.w / w;
      if (vec.length) {
        vpdf.drawDocs(page, vec, k, pt.h);
        // Las marcas del anotador (flechas, cotas, bordes de lupa…) encima del plano, con transparencia
        for (const v of vec) {
          if (!v.overlay || !v.overlayBox || !v.item.markup?.length) continue;
          const png = await overlayPng(v.overlay, v.overlayBox.w, v.overlayBox.h, Math.max(dpi / 96, 4), fontEmbedCSS);
          if (!png) continue;
          const b = v.overlayBox;
          page.drawImage(await vpdf.doc.embedPng(png), { x: b.x * k, y: pt.h - (b.y + b.h) * k, width: b.w * k, height: b.h * k });
        }
      }
      vpdf.drawText(page, sheet, k, pt.h, (el) => keepNode(el as HTMLElement));
    }
    if (vpdf) {
      vpdf.doc.setTitle(title);
      vpdf.doc.setProducer('Generador de Reportes');
      const bytes = await vpdf.doc.save({ useObjectStreams: true });
      return new Blob([bytes as BlobPart], { type: 'application/pdf' });
    }
    return buildPdf(out, title);
  } finally {
    restore();
  }
}

/** Ofrece el PDF: en iPhone/iPad abre "Compartir" (Guardar en Archivos, Mail…); si no, lo descarga. */
export async function deliverPdf(blob: Blob, fileName: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], fileName, { type: 'application/pdf' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] }) && /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1) {
    try {
      await nav.share({ files: [file], title: fileName });
      return 'shared';
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'cancelled';
      // si falla compartir, se descarga
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}
