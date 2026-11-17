/* =====================================================================
   Imágenes livianas para el PDF.
   El PDF se arma con la impresión del navegador, que mete cada foto tal
   cual se cargó (una foto de celular pesa 3-8 MB aunque en la hoja ocupe
   6 cm). Antes de imprimir se cambia cada <img> de las hojas por una copia
   JPEG con la resolución justa para el tamaño en que se ve impresa; al
   terminar se devuelve la original. El informe guardado no se toca.
   ===================================================================== */

export interface PdfPreset {
  id: 'original' | 'alta' | 'media' | 'correo' | 'minima';
  label: string;
  hint: string;
  /** Puntos por pulgada en el papel (0 = sin comprimir) */
  dpi: number;
  /** Calidad JPEG 0-1 */
  quality: number;
}

export const PDF_PRESETS: PdfPreset[] = [
  { id: 'original', label: 'Original', hint: 'Las fotos tal cual se cargaron', dpi: 0, quality: 1 },
  { id: 'alta', label: 'Alta', hint: '200 ppp · para imprimir en papel', dpi: 200, quality: 0.85 },
  { id: 'media', label: 'Equilibrada', hint: '150 ppp · se ve bien en pantalla e impresa', dpi: 150, quality: 0.8 },
  { id: 'correo', label: 'Para correo', hint: '110 ppp · liviano, para mandar por mail', dpi: 110, quality: 0.72 },
  { id: 'minima', label: 'Mínima', hint: '80 ppp · lo más liviano posible', dpi: 80, quality: 0.6 },
];

/** Límites de adjuntos más comunes (MB) */
export const MAIL_LIMIT_MB = 20;

/** Peso aproximado del PDF sin imágenes: letras + dibujo de cada hoja */
export const basePdfBytes = (pages: number) => 250_000 + pages * 40_000;

export interface PrintImage {
  el: HTMLImageElement;
  src: string;
  /** Píxeles de pantalla (CSS) que ocupa la parte visible de la foto en la hoja, sin el zoom de la vista */
  wCss: number;
  hCss: number;
  fit: string;
  /** El logo "en blanco" se hace con un filtro CSS que Safari no respeta al imprimir: se pinta en la copia */
  white: boolean;
}

/** brightness(0) invert(1) = todo blanco conservando la transparencia */
const isWhiteFilter = (f: string) => /brightness\(0\)/.test(f) && /invert\((1|100%)\)/.test(f);

const isSkippable = (src: string) =>
  !src || /^data:image\/svg|\.svg(\?|#|$)/i.test(src) || src.startsWith('data:image/gif');

/** Junta las imágenes de las hojas con el tamaño en que se imprimen. */
export function collectPrintImages(root: HTMLElement): PrintImage[] {
  const zoom = root.getBoundingClientRect().width / Math.max(1, root.offsetWidth) || 1;
  const out: PrintImage[] = [];
  root.querySelectorAll('img').forEach((el) => {
    const src = el.currentSrc || el.getAttribute('src') || '';
    if (isSkippable(src) || el.closest('.no-print')) return;
    // getBoundingClientRect incluye el zoom de la vista y la ampliación del encuadre de la foto
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    out.push({ el, src, wCss: r.width / zoom, hCss: r.height / zoom, fit: getComputedStyle(el).objectFit || 'fill', white: isWhiteFilter(getComputedStyle(el).filter || '') });
  });
  return out;
}

/* ---- Lectura de las fotos ---- */
const blobCache = new Map<string, Promise<Blob | null>>();
const sourceBlob = (src: string): Promise<Blob | null> => {
  let p = blobCache.get(src);
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch(src, { mode: 'cors' });
        if (res.ok) return await res.blob();
      } catch { /* cors o red */ }
      // Si fetch no pudo (otro sitio sin permiso CORS), una <img> con crossOrigin tampoco va a poder
      // leerse: se usa la imagen tal cual, sin achicar
      return null;
    })();
    blobCache.set(src, p);
  }
  return p;
};

/** Peso de la foto tal como está cargada (null si no se puede leer, por ejemplo de otro sitio). */
export async function originalBytes(src: string): Promise<number | null> {
  if (src.startsWith('data:')) {
    const comma = src.indexOf(',');
    const b64 = src.slice(comma + 1);
    return /;base64/i.test(src.slice(0, comma)) ? Math.round(b64.length * 0.75) : b64.length;
  }
  const b = await sourceBlob(src);
  return b ? b.size : null;
}

/** Se decodifica cada vez (y se libera enseguida): guardar fotos de 12 MP abiertas llenaría la memoria del iPad */
const decode = async (src: string): Promise<ImageBitmap | HTMLImageElement | null> => {
  const blob = await sourceBlob(src);
  if (!blob) return null;
  try {
    if ('createImageBitmap' in window) return await createImageBitmap(blob);
  } catch { /* algunos formatos no: se prueba con <img> */ }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch { return null; } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
};

const sizeOf = (im: ImageBitmap | HTMLImageElement) =>
  'naturalWidth' in im ? { w: im.naturalWidth, h: im.naturalHeight } : { w: im.width, h: im.height };

/** ¿Tiene partes transparentes? (logos PNG: pasarlos a JPEG les pondría fondo) */
const hasAlpha = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  const sw = Math.min(w, 64), sh = Math.min(h, 64);
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  const x = c.getContext('2d')!;
  x.drawImage(ctx.canvas, 0, 0, sw, sh);
  const d = x.getImageData(0, 0, sw, sh).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
  return false;
};

export interface Compressed { url: string; bytes: number; origBytes: number | null }

const compCache = new Map<string, Promise<Compressed | null>>();

/**
 * Copia liviana de una imagen para el tamaño impreso. Devuelve null si no
 * conviene tocarla (no se puede leer, o la copia no pesa menos).
 */
export function compressFor(img: PrintImage, preset: PdfPreset): Promise<Compressed | null> {
  // Píxeles necesarios en el papel: 96 px CSS = 1 pulgada
  const needW = (img.wCss / 96) * preset.dpi;
  const needH = (img.hCss / 96) * preset.dpi;
  const key = `${preset.id}|${img.white ? 'w' : ''}|${Math.round(needW)}x${Math.round(needH)}|${img.fit}|${img.src.length}|${img.src.slice(-64)}`;
  let p = compCache.get(key);
  if (p) return p;
  p = (async () => {
    const [im, orig] = await Promise.all([decode(img.src), originalBytes(img.src)]);
    if (!im) return null;
    const { w, h } = sizeOf(im);
    if (!w || !h) return null;
    // "cover" recorta: manda el lado que más llena; "contain"/"fill": el que menos
    const sx = needW / w, sy = needH / h;
    const s = Math.min(1, img.fit === 'cover' ? Math.max(sx, sy) : img.fit === 'contain' || img.fit === 'scale-down' ? Math.min(sx, sy) : Math.max(sx, sy));
    const tw = Math.max(1, Math.round(w * s)), th = Math.max(1, Math.round(h * s));
    const c = document.createElement('canvas');
    c.width = tw; c.height = th;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(im as CanvasImageSource, 0, 0, tw, th);
    if ('close' in im) im.close();
    let type = 'image/jpeg';
    if (img.white) {
      // Logo en blanco: cada píxel pasa a blanco y se conserva la transparencia
      try {
        const d = ctx.getImageData(0, 0, tw, th);
        for (let i = 0; i < d.data.length; i += 4) { d.data[i] = d.data[i + 1] = d.data[i + 2] = 255; }
        ctx.putImageData(d, 0, 0);
      } catch { return null; }
      type = 'image/png';
    } else {
      try { if (hasAlpha(ctx, tw, th)) type = 'image/png'; } catch { return null; }
    }
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, type, preset.quality));
    // Si no se pudo achicar, se usa la imagen original: una imagen rebelde (por ejemplo una tesela
    // de mapa de otro sitio) no puede frenar todo el PDF
    if (!blob) return null;
    // Si la original ya era más liviana (foto chica), se deja la original
    if (!img.white && orig != null && blob.size >= orig * 0.95) return null;
    return { url: URL.createObjectURL(blob), bytes: blob.size, origBytes: orig };
  })();
  compCache.set(key, p);
  return p;
}

export interface SizeEstimate {
  images: number;
  /** Fotos de otros sitios que no se pueden medir ni achicar */
  unknown: number;
  originalBytes: number;
  pdfBytes: number;
}

/** Peso aproximado del PDF con un preset (las fotos repetidas se cuentan una vez). */
export async function estimatePdf(
  imgs: PrintImage[], preset: PdfPreset, pages: number, onProgress?: (done: number, total: number) => void,
): Promise<SizeEstimate> {
  const seen = new Map<string, { orig: number | null; best: number | null }>();
  let done = 0;
  for (const img of imgs) {
    const orig = await originalBytes(img.src);
    let size = orig;
    if (preset.dpi > 0) {
      const c = await compressFor(img, preset);
      if (c) size = c.bytes;
    }
    const prev = seen.get(img.src);
    // Misma foto en dos lugares: el navegador puede guardarla dos veces si se achica distinto; se toma la mayor
    seen.set(img.src, { orig, best: prev?.best != null && size != null ? Math.max(prev.best, size) : size });
    onProgress?.(++done, imgs.length);
  }
  let o = 0, b = 0, unknown = 0;
  seen.forEach((v) => {
    if (v.orig == null) { unknown++; return; }
    o += v.orig; b += v.best ?? v.orig;
  });
  const base = basePdfBytes(pages);
  return { images: seen.size, unknown, originalBytes: o + base, pdfBytes: b + base };
}

/**
 * Cambia las imágenes de las hojas por sus copias livianas.
 * Devuelve la función que deja todo como estaba.
 */
export async function swapForPrint(imgs: PrintImage[], preset: PdfPreset): Promise<() => void> {
  const changed: { el: HTMLImageElement; src: string | null; srcset: string | null; loading: string | null; filter: string }[] = [];
  // "Original" no achica las fotos, pero el logo en blanco igual se pinta (con buena resolución)
  const forWhite: PdfPreset = preset.dpi > 0 ? preset : { ...preset, dpi: 300, quality: 0.92 };
  for (const img of imgs) {
    const el = img.el;
    const c = img.white ? await compressFor(img, forWhite) : preset.dpi > 0 ? await compressFor(img, preset) : null;
    if (!c) {
      // Sin copia: igual se carga ya (las fotos "perezosas" fuera de pantalla salían en blanco en Safari)
      if (el.getAttribute('loading') === 'lazy') {
        changed.push({ el, src: null, srcset: null, loading: 'lazy', filter: el.style.filter });
        el.removeAttribute('loading');
      }
      continue;
    }
    changed.push({ el, src: el.getAttribute('src'), srcset: el.getAttribute('srcset'), loading: el.getAttribute('loading'), filter: el.style.filter });
    el.removeAttribute('srcset');
    el.removeAttribute('loading');
    if (img.white) el.style.filter = 'none';
    el.src = c.url;
  }
  // Que estén listas antes de abrir la impresión
  await Promise.all(imgs.map(({ el }) => el.decode().catch(() => {})));
  return () => {
    for (const { el, src, srcset, loading, filter } of changed) {
      if (src != null) el.setAttribute('src', src);
      if (srcset != null) el.setAttribute('srcset', srcset);
      if (loading != null) el.setAttribute('loading', loading);
      el.style.filter = filter;
    }
  };
}

export const fmtMB = (bytes: number) => {
  const mb = bytes / 1_048_576;
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${mb.toLocaleString('es', { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`;
};

/* =====================================================================
   iPhone / iPad: Safari imprime con márgenes propios (donde pone la
   dirección, la fecha y el número de página) y no respeta "margin: 0",
   así que una hoja A4 completa no entra y el pie pasa a otra página.
   Se achican las hojas al imprimir para que entren en el espacio que deja.
   ===================================================================== */
export const isAppleTouch = () =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export const PRINT_FIT_OPTIONS = [100, 95, 90, 85, 80];
const FIT_KEY = 'rp-print-fit';
export const loadPrintFit = (): number => {
  let v = NaN;
  try { v = Number(localStorage.getItem(FIT_KEY)); } catch { /* sin almacenamiento */ }
  return PRINT_FIT_OPTIONS.includes(v) ? v : 90;
};
export const savePrintFit = (v: number) => { try { localStorage.setItem(FIT_KEY, String(v)); } catch { /* sin almacenamiento */ } };

/** Aplica el achique de hojas (solo en iPhone/iPad). Devuelve la función que lo quita. */
export function applyPrintFit(percent = loadPrintFit()): () => void {
  const html = document.documentElement;
  if (!isAppleTouch() || percent >= 100) return () => {};
  html.style.setProperty('--rp-print-fit', String(percent / 100));
  html.classList.add('rp-print-fit');
  return () => { html.classList.remove('rp-print-fit'); html.style.removeProperty('--rp-print-fit'); };
}
