/* =====================================================================
   Hoja: tamaño de papel, orientación y márgenes.
   Es del informe (no del tema): se guarda con el informe, las plantillas
   y el JSON exportado; se cambia desde el panel de Temas.
   Todo lo que antes daba por hecho 210 × 297 mm lee estas medidas.
   ===================================================================== */

export type PaperId = 'a4' | 'carta' | 'oficio' | 'a3' | 'custom';
export type Orientation = 'portrait' | 'landscape';

export interface PageMargins { t: number; r: number; b: number; l: number }

export interface PageSetup {
  paper: PaperId;
  orientation: Orientation;
  /** Solo para "custom": ancho y alto en vertical (mm) */
  customW?: number;
  customH?: number;
  /** Márgenes en blanco alrededor de todo el contenido (mm) */
  margins: PageMargins;
}

export const PAPERS: { id: PaperId; label: string; w: number; h: number }[] = [
  { id: 'a4', label: 'A4', w: 210, h: 297 },
  { id: 'carta', label: 'Carta', w: 215.9, h: 279.4 },
  { id: 'oficio', label: 'Oficio / Legal', w: 215.9, h: 355.6 },
  { id: 'a3', label: 'A3', w: 297, h: 420 },
  { id: 'custom', label: 'Personalizado', w: 210, h: 297 },
];

export const MARGIN_MAX = 30;
export const CUSTOM_LIMITS = { min: 100, max: 600 };

export const DEFAULT_PAGE_SETUP: PageSetup = { paper: 'a4', orientation: 'portrait', margins: { t: 0, r: 0, b: 0, l: 0 } };

const clamp = (v: unknown, lo: number, hi: number, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
};

export function normalizePageSetup(p: Partial<PageSetup> | null | undefined): PageSetup {
  if (!p) return { ...DEFAULT_PAGE_SETUP, margins: { ...DEFAULT_PAGE_SETUP.margins } };
  const paper = PAPERS.some((x) => x.id === p.paper) ? (p.paper as PaperId) : 'a4';
  const m = p.margins || ({} as PageMargins);
  return {
    paper,
    orientation: p.orientation === 'landscape' ? 'landscape' : 'portrait',
    customW: paper === 'custom' ? clamp(p.customW, CUSTOM_LIMITS.min, CUSTOM_LIMITS.max, 210) : undefined,
    customH: paper === 'custom' ? clamp(p.customH, CUSTOM_LIMITS.min, CUSTOM_LIMITS.max, 297) : undefined,
    margins: {
      t: clamp(m.t, 0, MARGIN_MAX, 0), r: clamp(m.r, 0, MARGIN_MAX, 0),
      b: clamp(m.b, 0, MARGIN_MAX, 0), l: clamp(m.l, 0, MARGIN_MAX, 0),
    },
  };
}

/** Medidas de la hoja ya girada (mm) */
export function pageSize(p: PageSetup): { w: number; h: number } {
  const base = PAPERS.find((x) => x.id === p.paper) ?? PAPERS[0];
  let w = p.paper === 'custom' ? p.customW ?? 210 : base.w;
  let h = p.paper === 'custom' ? p.customH ?? 297 : base.h;
  if ((p.orientation === 'landscape') !== (w > h)) [w, h] = [h, w];
  return { w, h };
}

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');
export const pageLabel = (p: PageSetup) => {
  const { w, h } = pageSize(p);
  const name = PAPERS.find((x) => x.id === p.paper)?.label ?? 'A4';
  return `${p.paper === 'custom' ? 'Hoja' : name} ${p.orientation === 'landscape' ? 'horizontal' : 'vertical'} (${fmt(w)} × ${fmt(h)} mm)`;
};

/* ---- Medidas vigentes (las lee la paginación y los bloques al dibujarse) ---- */
let current = DEFAULT_PAGE_SETUP;
let size = pageSize(current);

/** App la llama en cada dibujo con la hoja elegida (no hace nada si no cambió). */
export function setPageGeometry(p: PageSetup) {
  if (p === current) return;
  current = p;
  size = pageSize(p);
}
export const getPageSetup = () => current;
export const pageWmm = () => size.w;
export const pageHmm = () => size.h;

/** Cuánto más ancho / alto es el espacio útil que en una A4 vertical sin márgenes */
const extraW = () => size.w - 210 - current.margins.l - current.margins.r;
const extraH = () => size.h - 297 - current.margins.t - current.margins.b;

/** Ancho útil de un bloque (en A4 sin márgenes: 199 mm = 210 − px-5 a cada lado) */
export const blockInnerWidthMm = () => 199 + extraW();
/** Ancho del área del gráfico de la curva S (en A4: 194 mm) */
export const chartWidthMm = () => 194 + extraW();
/** Alto útil para bloques en una hoja (en A4: 285,5 mm la primera y 278 mm las demás) */
export const pageCapacityFor = (base: number) => base + extraH();

/* ---- Estilos de la hoja (se inyectan en <head>) ---- */
export function pageCss(p: PageSetup): string {
  const { w, h } = pageSize(p);
  const m = p.margins;
  const W = `${w}mm`, H = `${h}mm`;
  return `
:root { --rp-page-w: ${W}; --rp-page-h: ${H}; }
.a4-sheet { width: ${W}; height: ${H}; min-height: ${H}; padding: ${m.t}mm ${m.r}mm ${m.b}mm ${m.l}mm; }
@media print {
  @page { size: ${W} ${H}; margin: 0; }
  #report-print-container { width: ${W} !important; }
  .sheet-page-wrapper { width: ${W} !important; height: ${H} !important; min-height: ${H} !important; max-height: ${H} !important; }
  .a4-sheet { width: ${W} !important; height: ${H} !important; min-height: ${H} !important; max-height: ${H} !important; padding: ${m.t}mm ${m.r}mm ${m.b}mm ${m.l}mm !important; }
}`;
}

const KEY = 'rp-page-setup';
export function loadPageSetup(): PageSetup {
  try { return normalizePageSetup(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch { return normalizePageSetup(null); }
}
export function savePageSetup(p: PageSetup) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* sin almacenamiento */ }
}

/** Nombre corto del papel para los rótulos ("A4", "Carta", "Oficio"…) */
export const paperShort = (p: PageSetup = current) =>
  ({ a4: 'A4', carta: 'Carta', oficio: 'Oficio', a3: 'A3', custom: '' } as Record<PaperId, string>)[p.paper];

/* =====================================================================
   @page en el CSS de una IA: la guía le pide que, si el usuario quiere
   otro papel u otros márgenes, los escriba como regla @page (la forma
   estándar). Al pegar la respuesta se lee, se aplica a la hoja y se saca
   del CSS del tema.
   ===================================================================== */
const PAGE_RULE = /@page\s*(?::[a-z-]+\s*)?\{([^{}]*)\}/gi;

const toMm = (v: string): number | null => {
  const m = /^(-?[\d.]+)\s*(mm|cm|in|pt|px)?$/i.exec(v.trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  switch ((m[2] || 'mm').toLowerCase()) {
    case 'cm': return n * 10;
    case 'in': return n * 25.4;
    case 'pt': return (n * 25.4) / 72;
    case 'px': return (n * 25.4) / 96;
    default: return n;
  }
};

const NAMED: Record<string, { paper: PaperId; w?: number; h?: number }> = {
  a4: { paper: 'a4' }, a3: { paper: 'a3' }, letter: { paper: 'carta' }, carta: { paper: 'carta' },
  legal: { paper: 'oficio' }, oficio: { paper: 'oficio' },
  a5: { paper: 'custom', w: 148, h: 210 }, b5: { paper: 'custom', w: 176, h: 250 }, b4: { paper: 'custom', w: 250, h: 353 },
};

/** Lee las reglas @page (la última manda). Devuelve null si no hay ninguna. */
export function parsePageRule(css: string, base: PageSetup): { setup: PageSetup; css: string } | null {
  const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(PAGE_RULE)].map((m) => m[1]);
  if (!rules.length) return null;
  let next: PageSetup = { ...base, margins: { ...base.margins } };
  for (const body of rules) {
    const decl: Record<string, string> = {};
    body.split(';').forEach((d) => {
      const i = d.indexOf(':');
      if (i > 0) decl[d.slice(0, i).trim().toLowerCase()] = d.slice(i + 1).replace(/!important/i, '').trim();
    });
    if (decl.size) {
      const toks = decl.size.toLowerCase().split(/\s+/).filter(Boolean);
      const orient = toks.includes('landscape') ? 'landscape' : toks.includes('portrait') ? 'portrait' : undefined;
      const named = toks.map((t) => NAMED[t]).find(Boolean);
      const lens = toks.map(toMm).filter((n): n is number => n != null && n > 0);
      if (named) {
        next = { ...next, paper: named.paper, customW: named.w, customH: named.h };
      } else if (lens.length >= 1) {
        const w = lens[0], h = lens[1] ?? lens[0];
        const std = PAPERS.find((p) => p.id !== 'custom' && Math.abs(Math.min(w, h) - p.w) < 1 && Math.abs(Math.max(w, h) - p.h) < 1);
        next = std
          ? { ...next, paper: std.id, orientation: w > h ? 'landscape' : 'portrait' }
          : { ...next, paper: 'custom', customW: Math.min(w, h), customH: Math.max(w, h), orientation: w > h ? 'landscape' : 'portrait' };
      }
      if (orient) next.orientation = orient;
    }
    if (decl.margin) {
      const v = decl.margin.split(/\s+/).map(toMm);
      if (v.every((x) => x != null)) {
        const [t, r = t, b = t, l = r] = v as number[];
        next.margins = { t, r, b, l };
      }
    }
    (['top', 'right', 'bottom', 'left'] as const).forEach((side) => {
      const v = decl[`margin-${side}`];
      const mm = v != null ? toMm(v) : null;
      if (mm != null) next.margins = { ...next.margins, [side[0]]: mm };
    });
  }
  // Márgenes con un decimal como mucho
  const r1 = (n: number) => Math.round(n); // los deslizadores van de a 1 mm
  next.margins = { t: r1(next.margins.t), r: r1(next.margins.r), b: r1(next.margins.b), l: r1(next.margins.l) };
  return { setup: normalizePageSetup(next), css: stripPageRules(css) };
}

/** Saca las reglas @page del CSS (la hoja la maneja el programa, no el tema). */
export const stripPageRules = (css: string) => css.replace(PAGE_RULE, '').replace(/\n{3,}/g, '\n\n').trim();
