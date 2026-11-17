/* =====================================================================
   Temas del informe: modelo, temas de fábrica, generación de CSS,
   biblioteca guardada y utilidades de fuentes.
   Un tema solo define variables --rp-* (ver report-theme.css), así que
   cambia la HOJA del informe y nunca el editor.
   ===================================================================== */

import { scopeCustomCss } from './advanced';
import { ThemeAsset, assetVarLines, assetPlacementCss } from './assets';

export type ThemeColorKey =
  | 'primary' | 'primaryDark' | 'primarySoft' | 'label'
  | 'accent'
  | 'titleText' | 'titleBorder' | 'titleBg1' | 'titleBg2'
  | 'ind1' | 'ind2' | 'ind3' | 'real'
  | 'barMain' | 'barSub'
  | 'thBg' | 'thText' | 'border'
  | 'surface1' | 'surface2' | 'line'
  | 'highlightBg' | 'highlightBorder'
  | 'text'
  | 'obsInfo' | 'obsWarn' | 'obsCritical' | 'obsOk';

/** Colores de los avisos de Observaciones (Información, Advertencia, Importante, Conforme). */
type ObsColorKey = 'obsInfo' | 'obsWarn' | 'obsCritical' | 'obsOk';
export const OBS_COLOR_DEFAULTS: Record<ObsColorKey, string> = {
  obsInfo: '#2563eb', obsWarn: '#d97706', obsCritical: '#dc2626', obsOk: '#059669',
};

export type FontSource = 'google' | 'system' | 'stack';

export interface ThemeFont {
  /** Nombre de la familia ("Inter", "Swis721 Lt BT"). Vacío en Títulos = igual que el texto. */
  family: string;
  source: FontSource;
  /** Fuente de reemplazo si en el equipo no está instalada (solo fuentes del sistema). */
  fallback?: string;
}

export interface ReportTheme {
  id: string;
  name: string;
  builtIn?: boolean;
  colors: Record<ThemeColorKey, string>;
  fonts: { body: ThemeFont; title: ThemeFont; num: ThemeFont };
  /** La barra de subtarea usa una versión clara de la barra principal (en vez de su propio color). */
  barSubAuto?: boolean;
  /** Redondeo de esquinas de tablas, tarjetas y barras de título (px). */
  radius: number;
  /** Reglas CSS propias (apartado Avanzado). */
  customCss?: string;
  /** Imágenes del tema (SVG/PNG/JPG), guardadas dentro del tema. */
  assets?: ThemeAsset[];
}

/* ---------- Grupos y nombres para el panel ---------- */

export const COLOR_GROUPS: { title: string; hint?: string; keys: [ThemeColorKey, string][] }[] = [
  {
    title: 'Color principal',
    hint: 'Encabezado, números de sección, etiquetas y valores destacados',
    keys: [['primary', 'Principal'], ['primaryDark', 'Oscuro (degradés)'], ['primarySoft', 'Suave (fondos)'], ['label', 'Etiquetas']],
  },
  { title: 'Acento', hint: 'Título del informe en el encabezado', keys: [['accent', 'Acento']] },
  {
    title: 'Barras de título de sección',
    keys: [['titleText', 'Texto'], ['titleBorder', 'Borde'], ['titleBg1', 'Fondo (extremos)'], ['titleBg2', 'Fondo (centro)']],
  },
  {
    title: 'Indicadores y gráficos',
    hint: 'Plazo, financiero y físico; curva de avance real',
    keys: [['ind1', 'Indicador 1 · plazo'], ['ind2', 'Indicador 2 · financiero'], ['ind3', 'Indicador 3 · físico'], ['real', 'Avance real (curva S)']],
  },
  {
    title: 'Gráfico de avance por rubro',
    hint: 'Barras de las tareas principales (rubros) y de las subtareas',
    keys: [['barMain', 'Tarea principal'], ['barSub', 'Subtarea']],
  },
  { title: 'Tablas', keys: [['thBg', 'Fondo de cabecera'], ['thText', 'Texto de cabecera'], ['border', 'Bordes de tablas y recuadros']] },
  {
    title: 'Fondos suaves y líneas',
    hint: 'El tono de fondo de filas, pies de foto, observaciones, pistas de barras y separadores',
    keys: [['surface1', 'Fondo muy suave'], ['surface2', 'Fondo suave'], ['line', 'Líneas y separadores']],
  },
  { title: 'Recuadro destacado', hint: 'Ej. Medición acumulada', keys: [['highlightBg', 'Fondo'], ['highlightBorder', 'Borde']] },
  { title: 'Texto', keys: [['text', 'Texto general']] },
  {
    title: 'Observaciones con énfasis',
    hint: 'Color de los avisos del módulo de Observaciones (barra, ícono y rótulo)',
    keys: [['obsInfo', 'Información'], ['obsWarn', 'Advertencia'], ['obsCritical', 'Importante'], ['obsOk', 'Conforme']],
  },
];

const VAR_OF: Record<Exclude<ThemeColorKey, 'titleBg1' | 'titleBg2'>, string> = {
  primary: '--rp-primary',
  primaryDark: '--rp-primary-dark',
  primarySoft: '--rp-primary-soft',
  label: '--rp-label',
  accent: '--rp-accent',
  titleText: '--rp-title-text',
  titleBorder: '--rp-title-border',
  ind1: '--rp-ind-1',
  ind2: '--rp-ind-2',
  ind3: '--rp-ind-3',
  real: '--rp-real',
  barMain: '--rp-bar-main',
  barSub: '--rp-bar-sub',
  thBg: '--rp-th-bg',
  thText: '--rp-th-text',
  border: '--rp-border',
  surface1: '--rp-surface-1',
  surface2: '--rp-surface-2',
  line: '--rp-line',
  highlightBg: '--rp-highlight-bg',
  highlightBorder: '--rp-highlight-border',
  text: '--rp-text',
  obsInfo: '--rp-obs-info',
  obsWarn: '--rp-obs-warn',
  obsCritical: '--rp-obs-critical',
  obsOk: '--rp-obs-ok',
};

/* ---------- Fuentes ---------- */

export const SANS_STACK = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif";
export const MONO_STACK = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
export const MONO_DEFAULT_LABEL = 'Monoespaciada del sistema';

/** Google Fonts elegidas para informes técnicos, con los pesos que existen de cada una. */
export const GOOGLE_FONTS: { family: string; weights: string; kind: 'sans' | 'serif' | 'mono' }[] = [
  { family: 'Plus Jakarta Sans', weights: '400;500;600;700;800', kind: 'sans' },
  { family: 'Inter', weights: '400;500;600;700;800;900', kind: 'sans' },
  { family: 'Roboto', weights: '400;500;700;900', kind: 'sans' },
  { family: 'Open Sans', weights: '400;500;600;700;800', kind: 'sans' },
  { family: 'Lato', weights: '400;700;900', kind: 'sans' },
  { family: 'Source Sans 3', weights: '400;500;600;700;800;900', kind: 'sans' },
  { family: 'IBM Plex Sans', weights: '400;500;600;700', kind: 'sans' },
  { family: 'Montserrat', weights: '400;500;600;700;800;900', kind: 'sans' },
  { family: 'Work Sans', weights: '400;500;600;700;800;900', kind: 'sans' },
  { family: 'Nunito Sans', weights: '400;500;600;700;800;900', kind: 'sans' },
  { family: 'Barlow', weights: '400;500;600;700;800;900', kind: 'sans' },
  { family: 'Archivo', weights: '400;500;600;700;800;900', kind: 'sans' },
  { family: 'Fira Sans', weights: '400;500;600;700;800;900', kind: 'sans' },
  { family: 'Noto Sans', weights: '400;500;600;700;800;900', kind: 'sans' },
  { family: 'PT Sans', weights: '400;700', kind: 'sans' },
  { family: 'Roboto Condensed', weights: '400;500;600;700;800;900', kind: 'sans' },
  { family: 'Titillium Web', weights: '400;600;700;900', kind: 'sans' },
  { family: 'Merriweather', weights: '400;700;900', kind: 'serif' },
  { family: 'Source Serif 4', weights: '400;500;600;700;800;900', kind: 'serif' },
  { family: 'Roboto Slab', weights: '400;500;600;700;800;900', kind: 'serif' },
  { family: 'Lora', weights: '400;500;600;700', kind: 'serif' },
  { family: 'JetBrains Mono', weights: '400;500;600;700;800', kind: 'mono' },
  { family: 'IBM Plex Mono', weights: '400;500;600;700', kind: 'mono' },
  { family: 'Roboto Mono', weights: '400;500;600;700', kind: 'mono' },
  { family: 'Source Code Pro', weights: '400;500;600;700;800;900', kind: 'mono' },
  { family: 'Fira Code', weights: '400;500;600;700', kind: 'mono' },
];
const GOOGLE_SET = new Set(GOOGLE_FONTS.map((f) => f.family.toLowerCase()));
export const isGoogleFont = (family: string) => GOOGLE_SET.has(family.trim().toLowerCase());

/** Fuentes habituales de Windows/Office, para elegir sin tener que buscarlas. */
export const COMMON_SYSTEM_FONTS = [
  'Arial', 'Arial Narrow', 'Calibri', 'Cambria', 'Candara', 'Century Gothic', 'Consolas', 'Corbel',
  'Courier New', 'Franklin Gothic Medium', 'Georgia', 'Segoe UI', 'Tahoma', 'Times New Roman',
  'Trebuchet MS', 'Verdana', 'Swis721 BT', 'Swis721 Lt BT', 'Swis721 Cn BT', 'Helvetica', 'Helvetica Neue',
];

export const FALLBACK_OPTIONS: { value: string; label: string }[] = [
  { value: 'sans-serif', label: 'Sin serifa genérica' },
  { value: 'serif', label: 'Con serifa genérica' },
  { value: 'monospace', label: 'Monoespaciada genérica' },
  ...GOOGLE_FONTS.map((f) => ({ value: f.family, label: `${f.family} (Google)` })),
];

const q = (family: string) => (/^[\w-]+$/.test(family) ? family : `'${family.replace(/'/g, "\\'")}'`);

/** Pila CSS de una fuente del tema (con reemplazos sensatos). */
export function fontStack(f: ThemeFont, kind: 'sans' | 'mono' = 'sans'): string {
  const generic = kind === 'mono' ? MONO_STACK : SANS_STACK;
  if (f.source === 'stack' || !f.family.trim()) return generic;
  const parts = [q(f.family.trim())];
  if (f.source === 'system' && f.fallback && !['sans-serif', 'serif', 'monospace'].includes(f.fallback)) parts.push(q(f.fallback));
  if (f.fallback === 'serif') parts.push('Georgia', "'Times New Roman'", 'serif');
  else if (f.fallback === 'monospace' || kind === 'mono') parts.push(MONO_STACK);
  else parts.push(SANS_STACK);
  return parts.join(', ');
}

/** Fuentes de Google que el tema necesita descargar. */
export function googleFamiliesOf(theme: ReportTheme): string[] {
  const out = new Set<string>();
  Object.values(theme.fonts).forEach((f) => {
    if (f.source === 'google' && f.family) out.add(f.family);
    if (f.source === 'system' && f.fallback && isGoogleFont(f.fallback)) out.add(f.fallback);
  });
  return [...out];
}

export function googleFontHref(family: string): string {
  const g = GOOGLE_FONTS.find((f) => f.family.toLowerCase() === family.toLowerCase());
  const fam = encodeURIComponent(family).replace(/%20/g, '+');
  return `https://fonts.googleapis.com/css2?family=${fam}${g ? `:wght@${g.weights}` : ''}&display=swap`;
}

/**
 * ¿Está instalada esta fuente en el equipo? Compara el ancho de un texto dibujado
 * con la fuente pedida contra las fuentes genéricas: si coincide con todas, no está.
 */
export function isFontInstalled(family: string): boolean {
  if (!family.trim()) return false;
  try {
    const c = document.createElement('canvas').getContext('2d');
    if (!c) return true;
    const text = 'mmmmmmmmmlli1WQ@#08 ÁÑáñ';
    const width = (font: string) => { c.font = `72px ${font}`; return c.measureText(text).width; };
    return ['monospace', 'serif', 'sans-serif'].some((g) => width(`${q(family)}, ${g}`) !== width(g));
  } catch {
    return true;
  }
}

/**
 * Lista completa de fuentes instaladas (Chrome/Edge, con permiso del usuario).
 * Devuelve null si el navegador no lo permite.
 */
export async function queryInstalledFonts(): Promise<string[] | null> {
  const w = window as unknown as { queryLocalFonts?: () => Promise<{ family: string }[]> };
  if (typeof w.queryLocalFonts !== 'function') return null;
  try {
    const fonts = await w.queryLocalFonts();
    return [...new Set(fonts.map((f) => f.family))].sort((a, b) => a.localeCompare(b, 'es'));
  } catch {
    return null;
  }
}

/* ---------- Temas de fábrica ---------- */

const baseFonts = (): ReportTheme['fonts'] => ({
  body: { family: 'Plus Jakarta Sans', source: 'google' },
  title: { family: '', source: 'google' },
  num: { family: MONO_DEFAULT_LABEL, source: 'stack' },
});

const mk = (
  id: string,
  name: string,
  colors: Omit<Record<ThemeColorKey, string>, ObsColorKey> & Partial<Record<ObsColorKey, string>>,
): ReportTheme => ({
  id, name, builtIn: true, colors: { ...OBS_COLOR_DEFAULTS, ...colors }, fonts: baseFonts(), radius: 10,
  // Institucional conserva su azul de subtarea propio; los demás usan la versión clara de la principal
  barSubAuto: id !== 'institucional',
});

export const BUILT_IN_THEMES: ReportTheme[] = [
  mk('institucional', 'Institucional', {
    primary: '#0b455b', primaryDark: '#072f3e', primarySoft: '#e6eef2', label: '#1f4e66',
    accent: '#f4c84a',
    titleText: '#174b60', titleBorder: '#b8cbd4', titleBg1: '#f1f5f9', titleBg2: '#f0f9ff',
    ind1: '#1f6487', ind2: '#c99326', ind3: '#659d43', real: '#059669',
    barMain: '#0b455b', barSub: '#1f6487',
    thBg: '#e9edf4', thText: '#1f3a52', border: '#cbd5e1',
    surface1: '#f8fafc', surface2: '#f1f5f9', line: '#e2e8f0',
    highlightBg: '#f0f7f9', highlightBorder: '#d6e4ea',
    text: '#172033',
  }),
  mk('grafito', 'Grafito (impresión B/N)', {
    // En blanco y negro los avisos se distinguen por el ícono: grises de distinta intensidad
    obsInfo: '#4b5563', obsWarn: '#374151', obsCritical: '#111827', obsOk: '#6b7280',
    primary: '#1f2937', primaryDark: '#111827', primarySoft: '#e5e7eb', label: '#374151',
    accent: '#e5e7eb',
    titleText: '#1f2937', titleBorder: '#9ca3af', titleBg1: '#f3f4f6', titleBg2: '#fafafa',
    ind1: '#4b5563', ind2: '#9ca3af', ind3: '#111827', real: '#374151',
    barMain: '#1f2937', barSub: '#1f2937',
    thBg: '#e5e7eb', thText: '#111827', border: '#9ca3af',
    surface1: '#fafafa', surface2: '#f4f4f5', line: '#e4e4e7',
    highlightBg: '#f3f4f6', highlightBorder: '#d1d5db',
    text: '#111827',
  }),
  mk('verde-obra', 'Verde obra', {
    primary: '#1e4d2b', primaryDark: '#13331c', primarySoft: '#e3efe6', label: '#2f5d3a',
    accent: '#e9c46a',
    titleText: '#1e4d2b', titleBorder: '#b7cfbd', titleBg1: '#f1f5f2', titleBg2: '#eef7f0',
    ind1: '#2a6f97', ind2: '#d08c2b', ind3: '#4c9a2a', real: '#2f855a',
    barMain: '#1e4d2b', barSub: '#1e4d2b',
    thBg: '#e6efe8', thText: '#1e3a26', border: '#c5d3c8',
    surface1: '#f7faf8', surface2: '#eef4f0', line: '#dde8e0',
    highlightBg: '#eff6f0', highlightBorder: '#cfe0d3',
    text: '#18231b',
  }),
  mk('azul-corporativo', 'Azul corporativo', {
    primary: '#1d3f8a', primaryDark: '#132a5e', primarySoft: '#e5ebf7', label: '#26489a',
    accent: '#ffcf4a',
    titleText: '#1d3f8a', titleBorder: '#b9c6e4', titleBg1: '#f2f5fb', titleBg2: '#eef3ff',
    ind1: '#2b6cb0', ind2: '#dd8f1f', ind3: '#2f9e63', real: '#0f9d76',
    barMain: '#1d3f8a', barSub: '#1d3f8a',
    thBg: '#e7ecf6', thText: '#1b2f5c', border: '#c4cfe3',
    surface1: '#f7f9fd', surface2: '#eef2fa', line: '#dfe6f3',
    highlightBg: '#f0f4fb', highlightBorder: '#d4ddef',
    text: '#141c2f',
  }),
  mk('terracota', 'Terracota', {
    primary: '#7a2e1d', primaryDark: '#521d12', primarySoft: '#f6e7e1', label: '#8a3b28',
    accent: '#f2c14e',
    titleText: '#7a2e1d', titleBorder: '#e0bfb3', titleBg1: '#faf4f1', titleBg2: '#fdf1ea',
    ind1: '#3d6a8a', ind2: '#c27c1e', ind3: '#5f8f3a', real: '#2f7d5b',
    barMain: '#7a2e1d', barSub: '#7a2e1d',
    thBg: '#f3e6e0', thText: '#5a2417', border: '#dcc6bd',
    surface1: '#fcf8f6', surface2: '#f7efeb', line: '#ecdcd5',
    highlightBg: '#fbf3ef', highlightBorder: '#ecd5cb',
    text: '#2a1a15',
  }),
];

export const DEFAULT_THEME = BUILT_IN_THEMES[0];

/** Completa un tema que viene de un archivo o de una plantilla vieja con los valores de fábrica. */
export function normalizeTheme(t: Partial<ReportTheme> | null | undefined): ReportTheme {
  const base = DEFAULT_THEME;
  if (!t) return { ...base, colors: { ...base.colors }, fonts: baseFonts() };
  return {
    id: t.id || `tema-${Date.now()}`,
    name: t.name || 'Tema sin nombre',
    builtIn: t.builtIn,
    colors: {
      ...base.colors,
      // Temas guardados antes de existir estas barras: conservan cómo se veían (principal y su indicador 1)
      barMain: t.colors?.primary ?? base.colors.barMain,
      barSub: t.colors?.ind1 ?? base.colors.barSub,
      ...(t.colors || {}),
    },
    barSubAuto: t.barSubAuto,
    fonts: {
      body: { ...base.fonts.body, ...(t.fonts?.body || {}) },
      title: { ...base.fonts.title, ...(t.fonts?.title || {}) },
      num: { ...base.fonts.num, ...(t.fonts?.num || {}) },
    },
    radius: typeof t.radius === 'number' ? t.radius : base.radius,
    customCss: t.customCss,
    assets: Array.isArray(t.assets) ? t.assets : undefined,
  };
}

/* ---------- CSS del tema ---------- */

/** Variables del tema. Con `short`, las imágenes se muestran abreviadas (para leer, no para aplicar). */
export function buildThemeVars(theme: ReportTheme, short = false): string {
  const c = theme.colors;
  const lines = (Object.keys(VAR_OF) as (keyof typeof VAR_OF)[]).map((k) => `  ${VAR_OF[k]}: ${c[k]};`);
  if (theme.barSubAuto) lines.push('  --rp-bar-sub: color-mix(in oklab, var(--rp-bar-main) 55%, #fff);');
  lines.push(`  --rp-title-bg: linear-gradient(to right in oklab, ${c.titleBg1}, ${c.titleBg2}, ${c.titleBg1});`);
  const body = fontStack(theme.fonts.body);
  lines.push(`  --rp-font-body: ${body};`);
  lines.push(`  --rp-font-title: ${theme.fonts.title.family.trim() ? fontStack(theme.fonts.title) : 'var(--rp-font-body)'};`);
  lines.push(`  --rp-font-num: ${fontStack(theme.fonts.num, 'mono')};`);
  lines.push(`  --rp-radius: ${Math.max(0, Math.round(theme.radius))}px;`);
  lines.push(...assetVarLines(theme.assets, short));
  return `:root {\n${lines.join('\n')}\n}`;
}

export function buildThemeCss(theme: ReportTheme): string {
  const { head, body } = scopeCustomCss(theme.customCss || '');
  const placed = scopeCustomCss(assetPlacementCss(theme.assets)).body;
  // Los @import tienen que ir antes que cualquier otra regla, o el navegador los ignora
  return `${head ? `${head}\n` : ''}/* Tema del informe: ${theme.name} */\n${buildThemeVars(theme)}`
    + `${placed ? `\n\n/* Imágenes ubicadas desde el panel */\n${placed}` : ''}`
    + `${body ? `\n\n/* Reglas propias (Avanzado), solo dentro de la hoja */\n${body}` : ''}\n`;
}

/** Aplica el tema a la página: variables + descarga de las Google Fonts que use. */
export function applyTheme(theme: ReportTheme) {
  let style = document.getElementById('rp-theme-style') as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = 'rp-theme-style';
  }
  // Al final del documento: ante igual especificidad, las reglas del tema ganan a las de los módulos
  if (style.parentNode !== document.body || style !== document.body.lastElementChild) document.body.appendChild(style);
  style.textContent = buildThemeCss(theme);
  // Avisa a lo que se dibuja con los colores del tema fuera de CSS (diagramas Mermaid)
  window.dispatchEvent(new Event('rp-theme-applied'));

  const wanted = new Set(googleFamiliesOf(theme).map(googleFontHref));
  document.querySelectorAll<HTMLLinkElement>('link[data-rp-font]').forEach((l) => {
    if (!wanted.has(l.href)) l.remove(); else wanted.delete(l.href);
  });
  wanted.forEach((href) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    l.dataset.rpFont = '1';
    document.head.appendChild(l);
  });
}

/** <link> de fuentes + <style> del tema, para incluir en un HTML exportado. */
export function themeHeadHtml(theme: ReportTheme): string {
  const links = googleFamiliesOf(theme).map((f) => `<link href="${googleFontHref(f)}" rel="stylesheet">`).join('\n');
  return `${links}\n<style>\n${buildThemeCss(theme)}</style>`;
}

/* ---------- Biblioteca de temas guardados (este navegador) ---------- */

const LIB_KEY = 'a4_report_themes_v1';
const CURRENT_KEY = 'a4_report_current_theme_v1';

export function loadSavedThemes(): ReportTheme[] {
  try {
    const raw = localStorage.getItem(LIB_KEY);
    const list = raw ? (JSON.parse(raw) as Partial<ReportTheme>[]) : [];
    return list.map((t) => ({ ...normalizeTheme(t), builtIn: false }));
  } catch {
    return [];
  }
}

/** Devuelve false si el navegador no tuvo lugar para guardar (imágenes muy pesadas). */
export function saveThemes(list: ReportTheme[]): boolean {
  try { localStorage.setItem(LIB_KEY, JSON.stringify(list.filter((t) => !t.builtIn))); return true; } catch { return false; }
}

export function loadCurrentTheme(): ReportTheme {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    if (raw) return normalizeTheme(JSON.parse(raw));
  } catch { /* noop */ }
  return normalizeTheme(DEFAULT_THEME);
}

export function saveCurrentTheme(theme: ReportTheme): boolean {
  try { localStorage.setItem(CURRENT_KEY, JSON.stringify(theme)); return true; } catch { return false; }
}

const assetsKey = (t: ReportTheme) => (t.assets || []).map((x) => [x.id, x.name, x.spot, x.size, x.opacity, x.dataUrl.length]);

/** ¿Dos temas se ven igual? (para marcar "modificado") */
export function sameLook(a: ReportTheme, b: ReportTheme): boolean {
  return JSON.stringify([a.colors, a.fonts, a.radius, !!a.barSubAuto, a.customCss || '', assetsKey(a)]) === JSON.stringify([b.colors, b.fonts, b.radius, !!b.barSubAuto, b.customCss || '', assetsKey(b)]);
}
