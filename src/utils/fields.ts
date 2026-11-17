/* =====================================================================
   Campos compartidos del informe.
   Además de los datos fijos ({fecha}, {contrato}, {obra}…), el usuario
   puede crear los suyos (Vértice, Norte SIRGAS, Este SIRGAS…) en
   "Datos generales → Campos del informe". Se usan con {clave} en textos,
   encabezado, portada, HTML y en el módulo Mapa; al escribir @ en un texto
   aparecen en la lista para insertarlos.
   ===================================================================== */
import type { ProjectData } from '../types';
import { REF_TOKEN, refLabel } from './refs';

export interface ReportField {
  id: string;
  /** Lo que se escribe entre llaves: {norte_sirgas} */
  key: string;
  /** Nombre visible: "Norte SIRGAS 2000" */
  label: string;
  value: string;
}

export interface VarInfo { key: string; label: string; value: string; custom?: boolean }

const fmtDate = (iso: string) => {
  const p = (iso || '').split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso || '—';
};

/** Clave a partir del nombre: "Norte SIRGAS 2000" → norte_sirgas_2000 */
export const fieldKey = (label: string) =>
  (label || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    .slice(0, 32) || 'campo';

/** Las claves de los datos fijos no se pueden usar para campos propios */
export const BUILTIN_KEYS = ['titulo', 'direccion', 'obra', 'fecha', 'fecha_corta', 'contrato', 'contratista', 'pagina', 'paginas',
  'monto', 'medicion', 'inicio', 'fin', 'plazo', 'avance_fisico', 'avance_financiero', 'logo', 'logo_derecho'];

export const uniqueFieldKey = (label: string, fields: ReportField[], selfId?: string) => {
  const base = fieldKey(label);
  let k = base, n = 2;
  while (BUILTIN_KEYS.includes(k) || fields.some((f) => f.key === k && f.id !== selfId)) k = `${base}_${n++}`;
  return k;
};

export const newField = (label: string, value = '', fields: ReportField[] = []): ReportField => ({
  id: `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  key: uniqueFieldKey(label, fields),
  label,
  value,
});

const pct = (n: unknown) => {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString('es-PY', { maximumFractionDigits: 1 }) : '';
};

/** Todos los datos que se pueden escribir con {clave}, con su valor actual */
export function varList(d: ProjectData | null | undefined, page?: number, pages?: number): VarInfo[] {
  if (!d) return [];
  const iso = (d.reportDate || '').split('-');
  const out: VarInfo[] = [
    { key: 'fecha', label: 'Fecha de toma de datos', value: fmtDate(d.reportDate) },
    { key: 'fecha_corta', label: 'Fecha corta', value: iso.length === 3 ? `${iso[2]}/${iso[1]}/${iso[0].slice(2)}` : '' },
    { key: 'obra', label: 'Obra / documento', value: d.project || '' },
    { key: 'titulo', label: 'Título del informe', value: d.reportTitle || '' },
    { key: 'contrato', label: 'Contrato', value: d.contract || '' },
    { key: 'contratista', label: 'Contratista', value: d.contractor || '' },
    { key: 'direccion', label: 'Dirección / institución', value: d.director || '' },
    { key: 'monto', label: 'Monto del contrato', value: d.contractValue || '' },
    { key: 'medicion', label: 'Medición acumulada', value: d.measurement || '' },
    { key: 'inicio', label: 'Fecha de inicio', value: d.startDate ? fmtDate(d.startDate) : '' },
    { key: 'fin', label: 'Fecha fin prevista', value: d.endDate ? fmtDate(d.endDate) : '' },
    { key: 'plazo', label: 'Plazo transcurrido (%)', value: pct(d.timeProgress) },
    { key: 'avance_fisico', label: 'Avance físico (%)', value: pct(d.physicalProgress) },
    { key: 'avance_financiero', label: 'Avance financiero (%)', value: pct(d.financialProgress) },
  ];
  if (page != null) out.push({ key: 'pagina', label: 'N.º de hoja', value: String(page) });
  if (pages != null) out.push({ key: 'paginas', label: 'Total de hojas', value: String(pages) });
  for (const f of d.fields || []) if (f.key) out.push({ key: f.key, label: f.label || f.key, value: f.value ?? '', custom: true });
  return out;
}

/** Reemplaza {clave} por su valor (las claves desconocidas quedan como están) */
export function resolveVars(text: string, d: ProjectData | null | undefined, page?: number, pages?: number): string {
  if (!text) return text;
  // Citas a figuras y tablas ([[ref:ID]] → "Foto 03"), las mismas que en los textos
  if (text.indexOf('[[ref:') >= 0) text = text.replace(REF_TOKEN, (m, id: string) => refLabel(id) ?? m);
  if (!d || text.indexOf('{') < 0) return text;
  const map = new Map(varList(d, page, pages).map((v) => [v.key, v.value]));
  return text.replace(/\{([A-Za-z][\w]*)\}/g, (m, k: string) => {
    const v = map.get(k) ?? map.get(k.toLowerCase());
    return v !== undefined ? v : m;
  });
}

/* Los textos del editor no reciben los datos por props: App los publica acá en cada render
   (igual que la geometría de la hoja) */
let current: ProjectData | null = null;
export const setReportData = (d: ProjectData) => { current = d; };
export const getReportData = () => current;
export const currentVars = () => varList(current);
export const varValue = (key: string) => currentVars().find((v) => v.key === key)?.value;

/* ---------- Editar un dato desde donde se usa (tabla del módulo HTML, edición en la hoja) ---------- */

/** Datos fijos que se pueden cambiar desde un módulo (el resto, como {pagina}, no) */
const BUILTIN_PROP: Record<string, keyof ProjectData> = {
  titulo: 'reportTitle', obra: 'project', direccion: 'director', contrato: 'contract', contratista: 'contractor', fecha: 'reportDate',
};
export const isEditableVar = (key: string, d: ProjectData | null | undefined) =>
  key in BUILTIN_PROP || !!(d?.fields || []).some((f) => f.key === key);

/** "04/11/2026" o "2026-11-04" → "2026-11-04" */
export function toIsoDate(s: string): string | null {
  const t = (s || '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(t);
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  return null;
}

/** Cambio de ProjectData para darle a {clave} un valor nuevo (null si no se puede) */
export function patchForVar(d: ProjectData, key: string, value: string): Partial<ProjectData> | null {
  const prop = BUILTIN_PROP[key];
  if (prop === 'reportDate') { const iso = toIsoDate(value); return iso ? { reportDate: iso } : null; }
  if (prop) return { [prop]: value } as Partial<ProjectData>;
  const fields = d.fields || [];
  if (!fields.some((f) => f.key === key)) return null;
  return { fields: fields.map((f) => (f.key === key ? { ...f, value } : f)) };
}

/** Claves {…} que aparecen en un texto o código, en orden y sin repetir */
export function varsUsedIn(code: string): string[] {
  const out: string[] = [];
  for (const m of (code || '').matchAll(/\{([A-Za-z]\w*)\}/g)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

/** Para mostrar cualquier texto del informe: datos {clave} y citas [[ref:ID]] resueltos */
export const resolveTokens = (text: string) =>
  text && (text.indexOf('{') >= 0 || text.indexOf('[[ref:') >= 0) ? resolveVars(text, current) : text;
