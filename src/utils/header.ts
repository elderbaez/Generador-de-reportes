/* =====================================================================
   Encabezado institucional configurable.
   - Tres diseños: Institucional (logos a los costados), Empresa (logo +
     bloque de datos) e ISO (tabla con código, revisión, fecha y hoja).
   - Renglones libres con nivel; pueden usar datos generales con {campo}.
   - Franja de las hojas siguientes con texto a la izquierda, centro y derecha.
   Los informes viejos no tienen esta configuración: se arma una igual a
   como se veían (los mismos cuatro renglones, ahora editables).
   ===================================================================== */
import type { ProjectData } from '../types';
import { resolveVars } from './fields';

export type HeaderLayout = 'institutional' | 'company' | 'iso';
/** xl = título grande · accent = título destacado (color acento) · md = normal · sm = chico arriba · xs = dato chico */
export type HeaderLevel = 'xl' | 'accent' | 'md' | 'sm' | 'xs';

export interface HeaderLine { id: string; text: string; level: HeaderLevel }
export interface HeaderMeta { id: string; label: string; value: string }

export interface HeaderConfig {
  layout: HeaderLayout;
  lines: HeaderLine[];
  /** Bloque de datos (Empresa) / columna de control (ISO) */
  meta: HeaderMeta[];
  /** Franja de las hojas 2 en adelante */
  strip: { left: string; center: string; right: string };
}

export const HEADER_LEVELS: { value: HeaderLevel; label: string }[] = [
  { value: 'sm', label: 'Chico (arriba)' },
  { value: 'xl', label: 'Título grande' },
  { value: 'accent', label: 'Destacado' },
  { value: 'md', label: 'Normal' },
  { value: 'xs', label: 'Dato chico' },
];
export const MAX_HEADER_LINES = 5;

/** Datos que se pueden usar dentro de los textos */
export const HEADER_VARS: { key: string; label: string }[] = [
  { key: 'titulo', label: 'Título del informe' },
  { key: 'direccion', label: 'Dirección / institución' },
  { key: 'obra', label: 'Nombre de la obra / documento' },
  { key: 'fecha', label: 'Fecha de toma de datos' },
  { key: 'contrato', label: 'Contrato' },
  { key: 'contratista', label: 'Contratista' },
  { key: 'pagina', label: 'N.º de hoja' },
  { key: 'paginas', label: 'Total de hojas' },
];

const uid = () => `h${Math.random().toString(36).slice(2, 9)}`;

export const defaultHeader = (): HeaderConfig => ({
  layout: 'institutional',
  lines: [
    { id: uid(), text: '{direccion}', level: 'sm' },
    { id: uid(), text: '{obra}', level: 'xl' },
    { id: uid(), text: '{titulo}', level: 'accent' },
    { id: uid(), text: 'Fecha de toma de datos: al {fecha}', level: 'xs' },
  ],
  meta: [
    { id: uid(), label: 'Código', value: '' },
    { id: uid(), label: 'Revisión', value: '00' },
    { id: uid(), label: 'Fecha', value: '{fecha}' },
    { id: uid(), label: 'Hoja', value: '{pagina} de {paginas}' },
  ],
  strip: { left: '{titulo}', center: '{obra}', right: 'Hoja {pagina} de {paginas}' },
});

const LEVELS = new Set<HeaderLevel>(['xl', 'accent', 'md', 'sm', 'xs']);
export function normalizeHeader(h: Partial<HeaderConfig> | null | undefined): HeaderConfig {
  const d = defaultHeader();
  if (!h) return d;
  return {
    layout: h.layout === 'company' || h.layout === 'iso' ? h.layout : 'institutional',
    lines: Array.isArray(h.lines)
      ? h.lines.slice(0, MAX_HEADER_LINES).map((l) => ({ id: l.id || uid(), text: String(l.text ?? ''), level: LEVELS.has(l.level) ? l.level : 'md' }))
      : d.lines,
    meta: Array.isArray(h.meta) ? h.meta.map((m) => ({ id: m.id || uid(), label: String(m.label ?? ''), value: String(m.value ?? '') })) : d.meta,
    strip: { ...d.strip, ...(h.strip || {}) },
  };
}

export const newHeaderLine = (): HeaderLine => ({ id: uid(), text: '', level: 'md' });
export const newHeaderMeta = (): HeaderMeta => ({ id: uid(), label: 'Dato', value: '' });

/** Reemplaza {campo} por los datos del informe y los campos propios (los desconocidos quedan como están) */
export function resolveHeaderText(text: string, d: ProjectData, page = 1, pages = 1): string {
  return resolveVars(text || '', d, page, pages);
}
