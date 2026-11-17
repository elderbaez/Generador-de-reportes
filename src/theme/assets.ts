/* =====================================================================
   Imágenes del tema (SVG, PNG, JPG, WebP)
   ---------------------------------------------------------------------
   - Se guardan DENTRO del tema (como data URL), así viajan con el tema,
     la plantilla y el archivo exportado. No dependen de rutas ni de URLs.
   - Cada imagen queda disponible como variable CSS: var(--rp-img-<nombre>)
     para usarla en Avanzado:  background-image: var(--rp-img-logo);
   - Además se pueden ubicar sin código: marca de agua de la hoja,
     encabezado (izquierda, derecha o fondo), ícono de los títulos, pie.
   ===================================================================== */

export type AssetSpot =
  | 'none'
  | 'sheet'          // marca de agua centrada en cada hoja
  | 'sheet-corner'   // esquina inferior derecha de cada hoja
  | 'header-right'
  | 'header-left'
  | 'header-bg'      // fondo del encabezado (cubre todo, con velo del color principal)
  | 'title-icon'     // ícono antes del texto de cada título de sección
  | 'footer';        // a la derecha del pie de página

export const SPOT_LABEL: Record<AssetSpot, string> = {
  none: 'Solo como variable (Avanzado)',
  sheet: 'Marca de agua de la hoja',
  'sheet-corner': 'Esquina de la hoja',
  'header-right': 'Encabezado · derecha',
  'header-left': 'Encabezado · izquierda',
  'header-bg': 'Encabezado · fondo',
  'title-icon': 'Ícono de los títulos',
  footer: 'Pie de página',
};

export interface ThemeAsset {
  id: string;
  /** Nombre corto: da la variable --rp-img-<name>. */
  name: string;
  mime: string;
  dataUrl: string;
  width?: number;
  height?: number;
  spot: AssetSpot;
  /** Tamaño: % del ancho de la hoja (marca de agua) o mm de alto (encabezado, íconos, pie). */
  size: number;
  /** 0–100 */
  opacity: number;
}

export const slugName = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'imagen';

export const assetVar = (a: Pick<ThemeAsset, 'name'>) => `--rp-img-${slugName(a.name)}`;

export const DEFAULT_SIZE: Record<AssetSpot, number> = {
  none: 0, sheet: 70, 'sheet-corner': 30, 'header-right': 18, 'header-left': 18, 'header-bg': 0, 'title-icon': 5, footer: 6,
};
export const DEFAULT_OPACITY: Record<AssetSpot, number> = {
  none: 100, sheet: 8, 'sheet-corner': 18, 'header-right': 100, 'header-left': 100, 'header-bg': 35, 'title-icon': 100, footer: 80,
};

const MAX_RASTER = 1400;   // px del lado mayor
const MAX_SVG_KB = 600;

/** Lee un archivo de imagen y lo deja listo para el tema (las fotos grandes se achican). */
export async function fileToAsset(file: File, existing: ThemeAsset[]): Promise<ThemeAsset> {
  const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
  if (!isSvg && !/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) {
    throw new Error('Formato no admitido: usá SVG, PNG, JPG o WebP.');
  }
  let base = slugName(file.name);
  const used = new Set(existing.map((a) => slugName(a.name)));
  let name = base, k = 2;
  while (used.has(name)) name = `${base}-${k++}`;

  if (isSvg) {
    const text = await file.text();
    if (text.length / 1024 > MAX_SVG_KB) throw new Error(`El SVG pesa ${Math.round(text.length / 1024)} KB: el máximo es ${MAX_SVG_KB} KB.`);
    if (!/<svg[\s>]/i.test(text)) throw new Error('El archivo no parece un SVG válido.');
    const vb = text.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
    const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`;
    return { id: `img-${Date.now().toString(36)}`, name, mime: 'image/svg+xml', dataUrl, width: vb ? +vb[1] : undefined, height: vb ? +vb[2] : undefined, spot: 'none', size: 0, opacity: 100 };
  }

  // Imágenes de píxeles: se achican y se guardan en WebP (conserva transparencia y pesa poco)
  const src = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('No se pudo leer la imagen.')); r.readAsDataURL(file); });
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('No se pudo abrir la imagen.')); i.src = src; });
  const scale = Math.min(1, MAX_RASTER / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
  let dataUrl = canvas.toDataURL('image/webp', 0.85);
  if (!dataUrl.startsWith('data:image/webp')) dataUrl = canvas.toDataURL('image/png');
  return { id: `img-${Date.now().toString(36)}`, name, mime: dataUrl.slice(5, dataUrl.indexOf(';')), dataUrl, width: w, height: h, spot: 'none', size: 0, opacity: 100 };
}

export const assetKB = (a: ThemeAsset) => Math.round((a.dataUrl.length * 3) / 4 / 1024);

/** Variables CSS con las imágenes (solo para aplicar; en pantalla se muestran abreviadas). */
export function assetVarLines(assets: ThemeAsset[] = [], short = false): string[] {
  return assets.map((a) => `  ${assetVar(a)}: ${short ? `url(… ${a.mime.replace('image/', '').toUpperCase()} ${a.width ?? '?'}×${a.height ?? '?'} …)` : `url("${a.dataUrl}")`};`);
}

/** Reglas para las ubicaciones elegidas sin código (van antes de las reglas propias, que pueden pisarlas). */
export function assetPlacementCss(assets: ThemeAsset[] = []): string {
  const out: string[] = [];
  for (const a of assets) {
    if (a.spot === 'none') continue;
    const v = `var(${assetVar(a)})`;
    const op = Math.max(0, Math.min(100, a.opacity)) / 100;
    const size = a.size || DEFAULT_SIZE[a.spot];
    switch (a.spot) {
      case 'sheet':
        out.push(`:scope { isolation: isolate; }
:scope::before { content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none;
  background: ${v} center / ${size}% auto no-repeat; opacity: ${op}; }`);
        break;
      case 'sheet-corner':
        out.push(`:scope { isolation: isolate; }
:scope::after { content: ''; position: absolute; right: 6mm; bottom: 14mm; width: ${size}%; aspect-ratio: ${a.width && a.height ? `${a.width} / ${a.height}` : '1'};
  z-index: -1; pointer-events: none; background: ${v} center / contain no-repeat; opacity: ${op}; }`);
        break;
      case 'header-right':
      case 'header-left':
        out.push(`:scope .rp-header { position: relative; }
:scope .rp-header::after { content: ''; position: absolute; top: 50%; ${a.spot === 'header-right' ? 'right' : 'left'}: 5mm; transform: translateY(-50%);
  height: ${size}mm; aspect-ratio: ${a.width && a.height ? `${a.width} / ${a.height}` : '1'}; max-width: 45mm;
  background: ${v} center / contain no-repeat; opacity: ${op}; pointer-events: none; }
:scope .rp-header-titles { padding-${a.spot === 'header-right' ? 'right' : 'left'}: ${Math.round(size * (a.width && a.height ? Math.min(2.5, a.width / a.height) : 1)) + 4}mm; }`);
        break;
      case 'header-bg':
        out.push(`:scope .rp-header {
  background: linear-gradient(color-mix(in srgb, var(--rp-primary) ${100 - Math.round(op * 100)}%, transparent), color-mix(in srgb, var(--rp-primary) ${100 - Math.round(op * 100)}%, transparent)),
    ${v} center / cover no-repeat, var(--rp-primary);
}`);
        break;
      case 'title-icon':
        out.push(`:scope .rp-title-row::before { content: ''; display: inline-block; flex-shrink: 0; width: ${size}mm; height: ${size}mm;
  background: ${v} center / contain no-repeat; opacity: ${op}; margin-right: 1.5mm; }`);
        break;
      case 'footer':
        out.push(`:scope .rp-footer { position: relative; }
:scope .rp-footer-page::before { content: ''; display: inline-block; vertical-align: middle; width: ${size}mm; height: ${size}mm; margin-right: 2mm;
  background: ${v} center / contain no-repeat; opacity: ${op}; }`);
        break;
    }
  }
  return out.join('\n');
}
