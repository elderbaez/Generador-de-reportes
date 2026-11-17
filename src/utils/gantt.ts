/* =====================================================================
   Cronograma (diagrama de Gantt) — datos, fechas, escala y paginación.
   Todo en mm fijos: cada fila mide lo mismo, así el cronograma se reparte
   entre hojas sin medir nada (un cronograma de 60 tareas ocupa 2-3 hojas).
   ===================================================================== */
import type { BlockConfig, RubricItem } from '../types';
import type { CsvField, CsvRecord } from './csv';

export type GanttColor = 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6';
export interface GanttTask {
  id: string;
  /** Código o N.º (opcional: 1, 1.1, EDT…) */
  code?: string;
  name: string;
  /** aaaa-mm-dd */
  start: string;
  end: string;
  /** Avance real 0–100 (vacío = sin dato) */
  progress?: number;
  /** Avance al cierre del período anterior 0–100 (lo de más es lo ejecutado en el período) */
  prevProgress?: number;
  /** 0 = principal, 1 = subtarea, 2 = sub-subtarea */
  level?: number;
  /** Tarea resumen: su barra abarca a las de abajo con más sangría */
  group?: boolean;
  milestone?: boolean;
  color?: GanttColor;
  /** Duración como venía del programa (Project cuenta días laborables); si no, se calculan días corridos */
  days?: number;
  /** N.º de tarea de Project (columna "Id"): las predecesoras se refieren a este número */
  uid?: string;
  /** Predecesoras como en Project: "3", "3;5", "4CC+2 días", "7FF-1d" (FC/CC/FF/CF o FS/SS/FF/SF) */
  pred?: string;
  /** Crítica marcada a mano o importada de Project (true/false). Sin definir = se calcula */
  critical?: boolean;
}

export type GanttScale = 'auto' | 'week' | 'month' | 'quarter';
export type GanttColumns = 'name' | 'dates' | 'full';
export type GanttDensity = 'normal' | 'compact';
/** Período de medición: lo que se avanzó en él se dibuja rayado */
export type GanttPeriod = 'week' | '2weeks' | 'month' | 'custom';

export const GANTT_COLORS: { id: GanttColor; label: string; v: string }[] = [
  { id: 'c1', label: 'Principal', v: 'var(--rp-primary, #0b455b)' },
  { id: 'c2', label: 'Indicador 1', v: 'var(--rp-ind-1, #0e7490)' },
  { id: 'c3', label: 'Indicador 2', v: 'var(--rp-ind-2, #d97706)' },
  { id: 'c4', label: 'Indicador 3', v: 'var(--rp-ind-3, #16a34a)' },
  { id: 'c5', label: 'Acento', v: 'var(--rp-accent, #f4c84a)' },
  { id: 'c6', label: 'Etiquetas', v: 'var(--rp-label, #1f4e66)' },
];
export const colorVar = (c: GanttColor) => GANTT_COLORS.find((x) => x.id === c)!.v;

/* ---------- Fechas ---------- */
const DAY = 86400000;
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const toDate = (s?: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((s || '').trim());
  return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null;
};
export const addDays = (s: string, n: number) => { const d = toDate(s)!; d.setDate(d.getDate() + n); return iso(d); };
export const daysBetween = (a: string, b: string) => Math.round((toDate(b)!.getTime() - toDate(a)!.getTime()) / DAY);
export const fmtShort = (s?: string) => { const d = toDate(s); return d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}` : '—'; };
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTH_WORDS: Record<string, number> = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12,
};

/**
 * Lee una fecha como venga: 14/10/26, 14/10/2026, "mié 14/10/26" (Project), 2026-10-14,
 * 14-oct-26, "14 de octubre de 2026" o el número de serie de Excel.
 */
export function parseDateLoose(raw: string): string | null {
  let s = (raw || '').trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-zá-úñ]{2,4}\.?\s+(?=\d)/, ''); // "mié 14/10/26"
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return iso(new Date(+m[1], +m[2] - 1, +m[3], 12));
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(s);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return iso(new Date(y, +m[2] - 1, +m[1], 12)); }
  m = /^(\d{1,2})(?:\s+de)?[\s\-/.]+([a-zá-úñ]{3})[a-zá-úñ]*\.?(?:\s+de)?[\s\-/.]+(\d{2,4})/.exec(s);
  if (m && MONTH_WORDS[m[2].normalize('NFD').replace(/[̀-ͯ]/g, '')]) {
    let y = +m[3]; if (y < 100) y += 2000;
    return iso(new Date(y, MONTH_WORDS[m[2].normalize('NFD').replace(/[̀-ͯ]/g, '')] - 1, +m[1], 12));
  }
  if (/^\d{5}(\.\d+)?$/.test(s)) { // serie de Excel (días desde 1899-12-30)
    const d = new Date(1899, 11, 30, 12); d.setDate(d.getDate() + Math.floor(+s)); return iso(d);
  }
  return null;
}

/* ---------- Estructura (grupos, colores, avance) ---------- */
export interface GanttRow extends GanttTask {
  /** Fechas efectivas (un grupo sin fechas toma las de sus hijos) */
  s: string; e: string;
  colorV: string;
  /** Avance efectivo (manual, de los rubros o promedio ponderado de los hijos) */
  prog?: number;
  /** Avance efectivo al cierre del período anterior */
  prev?: number;
  dur: number;
  /** Ruta crítica: crítica o no (sin definir = no se sabe: sin dato ni vínculos) */
  crit?: boolean;
  /** Holgura total en días hábiles (si se pudo calcular) y fecha más tardía de fin */
  slack?: number;
  lateEnd?: string;
}

const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
export function findRubric(rubrics: RubricItem[], key: string) {
  const k = norm(key);
  if (!k) return undefined;
  const active = rubrics.filter((r) => !r.comment);
  return active.find((r) => norm(r.item || '') === k)
    ?? active.find((r) => norm(r.description || '').startsWith(k))
    ?? active.find((r) => k.startsWith(norm(r.description || '')) && norm(r.description || '').length > 4);
}

export function buildRows(tasks: GanttTask[], opts: { fromRubrics?: boolean; rubrics?: RubricItem[] } = {}): GanttRow[] {
  const rows: GanttRow[] = tasks.map((t) => ({ ...t, s: t.start, e: t.end, colorV: '', dur: 0 }));
  // Hijos de cada grupo: las filas siguientes con más sangría
  const childrenOf = (i: number) => {
    const out: number[] = [];
    const lv = rows[i].level ?? 0;
    for (let j = i + 1; j < rows.length && (rows[j].level ?? 0) > lv; j++) out.push(j);
    return out;
  };
  // Fechas de los grupos (de abajo hacia arriba)
  for (let i = rows.length - 1; i >= 0; i--) {
    if (!rows[i].group) continue;
    const kids = childrenOf(i).filter((j) => toDate(rows[j].s) && toDate(rows[j].e));
    if (!kids.length) continue;
    const s = kids.map((j) => rows[j].s).sort()[0];
    const e = kids.map((j) => rows[j].e).sort().slice(-1)[0];
    if (!toDate(rows[i].s)) rows[i].s = s;
    if (!toDate(rows[i].e)) rows[i].e = e;
  }
  // Colores: cada grupo principal toma el siguiente de la paleta y sus subtareas lo heredan;
  // las tareas sueltas de primer nivel y los hitos van con el color principal
  let pal = 0;
  let current = GANTT_COLORS[0].v;
  rows.forEach((r) => {
    if ((r.level ?? 0) === 0) {
      if (r.group) { pal++; current = GANTT_COLORS[pal % GANTT_COLORS.length].v; }
      else current = GANTT_COLORS[0].v;
    }
    const own = r.color ? colorVar(r.color) : current;
    r.colorV = own;
    if (r.group && r.color) current = own; // un grupo con color propio se lo pasa a sus subtareas
  });
  // Duración y avance
  rows.forEach((r) => {
    r.dur = r.days ?? (toDate(r.s) && toDate(r.e) ? daysBetween(r.s, r.e) + 1 : 0);
    if (r.milestone) r.dur = 0;
    const rub = opts.fromRubrics && opts.rubrics ? findRubric(opts.rubrics, r.code || '') ?? findRubric(opts.rubrics, r.name) : undefined;
    r.prog = rub ? Number(rub.percent) || 0 : r.progress;
    r.prev = r.prevProgress;
  });
  // Grupos sin dato propio: promedio de sus tareas ponderado por duración (avance y avance anterior)
  for (const key of ['prog', 'prev'] as const) {
    for (let i = rows.length - 1; i >= 0; i--) {
      if (!rows[i].group || rows[i][key] != null) continue;
      const kids = childrenOf(i).filter((j) => !rows[j].group && rows[j][key] != null && rows[j].dur > 0);
      const w = kids.reduce((a, j) => a + rows[j].dur, 0);
      if (w > 0) rows[i][key] = Math.round(kids.reduce((a, j) => a + rows[j].dur * (rows[j][key] ?? 0), 0) / w * 10) / 10;
    }
  }
  return rows;
}

/* ---------- Ruta crítica ----------
   Tres fuentes, de más a menos confiable:
   1. La columna "Crítica" de Project (o la marca a mano en la tabla): se respeta tal cual.
   2. Las predecesoras: se calcula la holgura de cada tarea con sus fechas (sin reprogramar
      nada) en días hábiles de lunes a viernes, como el calendario estándar de Project.
      Holgura 0 (o menor o igual a la tolerancia) = crítica.
   3. Sin dato ni vínculos: no se marca.
   Un grupo es crítico si tiene alguna tarea crítica adentro. */

type LinkType = 'FS' | 'SS' | 'FF' | 'SF';
export interface GanttLink { from: number; type: LinkType; lag: number }

const LINK_TYPES: Record<string, LinkType> = { FC: 'FS', FS: 'FS', CC: 'SS', SS: 'SS', FF: 'FF', CF: 'SF', SF: 'SF', EE: 'FF', SE: 'SF', ES: 'FS' };

/** "4CC+2 días; 7" → vínculos a filas (por N.º de Project, código o número de fila) */
export function parsePred(pred: string | undefined, rows: GanttTask[]): GanttLink[] {
  if (!pred || !pred.trim()) return [];
  const byUid = new Map<string, number>(), byCode = new Map<string, number>();
  rows.forEach((r, i) => { if (r.uid) byUid.set(r.uid.trim(), i); if (r.code) byCode.set(r.code.trim(), i); });
  const out: GanttLink[] = [];
  for (const part of pred.split(/[;,]/)) {
    const m = /^\s*([\w.]+?)\s*(FC|FS|CC|SS|FF|CF|SF|EE|SE|ES)?\s*(?:([+-])\s*(\d+(?:[.,]\d+)?)\s*(?:d[ií]as?|ds?|days?|d\.?)?)?\s*$/i.exec(part);
    if (!m) continue;
    const ref = m[1];
    const idx = byUid.get(ref) ?? byCode.get(ref) ?? (/^\d+$/.test(ref) && !byUid.size ? Number(ref) - 1 : undefined);
    if (idx == null || idx < 0 || idx >= rows.length) continue;
    const lag = m[4] ? Math.round(parseFloat(m[4].replace(',', '.'))) * (m[3] === '-' ? -1 : 1) : 0;
    out.push({ from: idx, type: LINK_TYPES[(m[2] || 'FS').toUpperCase()] || 'FS', lag });
  }
  return out;
}

/** Días hábiles (lun–vie) desde una fecha de referencia hasta d (sin contar d). Un sábado o domingo vale como el lunes siguiente. */
const REF_MONDAY = new Date(2000, 0, 3, 12).getTime();
function workIndex(d: Date): number {
  const days = Math.round((d.getTime() - REF_MONDAY) / DAY);
  const weeks = Math.floor(days / 7), rest = days - weeks * 7;
  return weeks * 5 + Math.min(rest, 5);
}
function fromWorkIndex(w: number): string {
  const weeks = Math.floor(w / 5), rest = w - weeks * 5;
  return iso(new Date(REF_MONDAY + (weeks * 7 + rest) * DAY));
}

export function markCritical(rows: GanttRow[], tolerance = 0): void {
  const n = rows.length;
  // Nodos: tareas con fechas (los grupos entran solo si tienen vínculos propios)
  const links = rows.map((r) => parsePred(r.pred, rows));
  const succ: { to: number; type: LinkType; lag: number }[][] = rows.map(() => []);
  links.forEach((ls, to) => ls.forEach((l) => succ[l.from].push({ to, type: l.type, lag: l.lag })));
  const linked = rows.map((r, i) => links[i].length > 0 || succ[i].length > 0);
  const ES: number[] = [], EF: number[] = [];
  rows.forEach((r, i) => {
    const a = toDate(r.s), b = toDate(r.e);
    ES[i] = a ? workIndex(a) : NaN;
    EF[i] = b ? workIndex(new Date(b.getTime() + DAY)) : NaN; // fin exclusivo
    // Un hito vale como el fin de su día (así lo pone Project detrás de su predecesora)
    if (r.milestone && a) ES[i] = EF[i] = workIndex(new Date(a.getTime() + DAY));
  });
  const nodes = rows.map((r, i) => i).filter((i) => linked[i] && Number.isFinite(ES[i]) && Number.isFinite(EF[i]));
  if (nodes.length) {
    // Orden topológico (Kahn); las tareas en un ciclo quedan sin calcular
    const inNet = new Set(nodes);
    const indeg = new Map<number, number>(nodes.map((i) => [i, 0]));
    nodes.forEach((i) => succ[i].forEach((s) => { if (inNet.has(s.to)) indeg.set(s.to, (indeg.get(s.to) || 0) + 1); }));
    const queue = nodes.filter((i) => !indeg.get(i));
    const order: number[] = [];
    while (queue.length) {
      const i = queue.shift()!;
      order.push(i);
      succ[i].forEach((s) => {
        if (!inNet.has(s.to)) return;
        const d = (indeg.get(s.to) || 0) - 1;
        indeg.set(s.to, d);
        if (d === 0) queue.push(s.to);
      });
    }
    // Fin del proyecto: el fin más tardío de todas las tareas con fecha (no solo las vinculadas)
    const projectEnd = Math.max(...rows.map((r, i) => (r.group ? -Infinity : EF[i])).filter(Number.isFinite));
    const LF: number[] = [];
    for (let k = order.length - 1; k >= 0; k--) {
      const i = order[k];
      const dur = EF[i] - ES[i];
      let lf = projectEnd;
      for (const s of succ[i]) {
        if (!inNet.has(s.to) || LF[s.to] == null) continue;
        const lsJ = LF[s.to] - (EF[s.to] - ES[s.to]);
        const lim = s.type === 'FS' ? lsJ - s.lag
          : s.type === 'SS' ? lsJ - s.lag + dur
          : s.type === 'FF' ? LF[s.to] - s.lag
          : LF[s.to] - s.lag + dur; // SF
        lf = Math.min(lf, lim);
      }
      LF[i] = lf;
      rows[i].slack = lf - EF[i];
      rows[i].crit = rows[i].slack! <= tolerance;
      rows[i].lateEnd = fromWorkIndex(lf - 1);
    }
  }
  // Lo marcado (Project o a mano) manda sobre lo calculado
  rows.forEach((r) => { if (r.critical != null) r.crit = r.critical; });
  // Grupos: críticos si tienen alguna tarea crítica adentro (salvo marca propia)
  for (let i = n - 1; i >= 0; i--) {
    if (!rows[i].group || rows[i].critical != null) continue;
    const lv = rows[i].level ?? 0;
    let any = false, known = false;
    for (let j = i + 1; j < n && (rows[j].level ?? 0) > lv; j++) {
      if (rows[j].crit != null) known = true;
      if (rows[j].crit) { any = true; break; }
    }
    if (known || any) rows[i].crit = any;
  }
}

/** Comienzo del período de medición que termina en la fecha de toma de datos (null = sin período) */
export function periodStartOf(b: { ganttPeriod?: GanttPeriod; ganttPeriodStart?: string }, ref: string): string | null {
  const d = toDate(ref);
  if (!d) return null;
  const p = b.ganttPeriod ?? 'week';
  if (p === 'custom') return toDate(b.ganttPeriodStart) && b.ganttPeriodStart! < ref ? b.ganttPeriodStart! : null;
  if (p === 'month') {
    const day = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() - 1);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return iso(d);
  }
  return addDays(ref, p === '2weeks' ? -14 : -7);
}

/**
 * Cierra el período: el avance de hoy pasa a ser el "avance anterior" de cada tarea.
 * Los grupos sin avance propio lo siguen calculando de sus tareas.
 */
export function closePeriod(tasks: GanttTask[], rows: GanttRow[], fromRubrics: boolean): GanttTask[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return tasks.map((t) => {
    const r = byId.get(t.id);
    if (!r || t.milestone) return t;
    const auto = t.group && t.progress == null && !fromRubrics;
    return { ...t, prevProgress: auto || r.prog == null ? undefined : r.prog };
  });
}

/** Avance programado a una fecha (lineal entre inicio y fin) */
export function plannedAt(r: GanttRow, ref: string): number | null {
  const d = toDate(ref), a = toDate(r.s), b = toDate(r.e);
  if (!d || !a || !b) return null;
  if (r.milestone) return d >= a ? 100 : 0;
  const total = b.getTime() - a.getTime() + DAY;
  return Math.round(Math.min(100, Math.max(0, ((d.getTime() - a.getTime() + DAY) / total) * 100)));
}

/* ---------- Escala de tiempo ---------- */
export interface GanttScaleInfo {
  start: string; end: string; span: number;
  kind: 'week' | 'month' | 'quarter';
  ticks: { label: string; left: number; width: number; strong?: boolean }[];
  years: { label: string; left: number; width: number }[];
}

export function buildScale(rows: GanttRow[], scale: GanttScale, from?: string, to?: string): GanttScaleInfo | null {
  const ds = rows.flatMap((r) => [r.s, r.e]).filter((x) => toDate(x)).sort();
  if (!ds.length && !(from && to)) return null;
  const minD = toDate(from) ?? toDate(ds[0])!;
  const maxD = toDate(to) ?? toDate(ds[ds.length - 1])!;
  const spanDays = (maxD.getTime() - minD.getTime()) / DAY;
  const kind: GanttScaleInfo['kind'] = scale !== 'auto' ? scale : spanDays <= 75 ? 'week' : spanDays <= 640 ? 'month' : 'quarter';
  // Bordes redondeados al período
  let s: Date, e: Date;
  if (kind === 'week') {
    s = new Date(minD); s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
    e = new Date(maxD); e.setDate(e.getDate() + (7 - ((e.getDay() + 6) % 7)));
  } else if (kind === 'month') {
    s = new Date(minD.getFullYear(), minD.getMonth(), 1, 12);
    e = new Date(maxD.getFullYear(), maxD.getMonth() + 1, 1, 12);
  } else {
    s = new Date(minD.getFullYear(), Math.floor(minD.getMonth() / 3) * 3, 1, 12);
    e = new Date(maxD.getFullYear(), Math.floor(maxD.getMonth() / 3) * 3 + 3, 1, 12);
  }
  if (from && toDate(from)) s = toDate(from)!;
  if (to && toDate(to)) e = toDate(to)!;
  const span = Math.max(1, Math.round((e.getTime() - s.getTime()) / DAY));
  const pos = (d: Date) => ((d.getTime() - s.getTime()) / DAY / span) * 100;
  const ticks: GanttScaleInfo['ticks'] = [];
  const cur = new Date(s);
  while (cur < e) {
    const nx = new Date(cur);
    let label = '';
    if (kind === 'week') { nx.setDate(nx.getDate() + 7); label = `${String(cur.getDate()).padStart(2, '0')}/${String(cur.getMonth() + 1).padStart(2, '0')}`; }
    else if (kind === 'month') { nx.setMonth(nx.getMonth() + 1, 1); label = MONTHS[cur.getMonth()]; }
    else { nx.setMonth(nx.getMonth() + 3, 1); label = `T${Math.floor(cur.getMonth() / 3) + 1}`; }
    const l = pos(cur), r = pos(nx > e ? e : nx);
    ticks.push({ label, left: l, width: r - l, strong: kind === 'week' ? cur.getDate() <= 7 : kind === 'month' ? cur.getMonth() === 0 : cur.getMonth() === 0 });
    cur.setTime(nx.getTime());
  }
  // Fila de años (y de meses en la escala semanal)
  const years: GanttScaleInfo['years'] = [];
  const y = new Date(s);
  if (kind === 'week') {
    y.setDate(1);
    while (y < e) {
      const nx = new Date(y.getFullYear(), y.getMonth() + 1, 1, 12);
      const l = Math.max(0, pos(y)), r = Math.min(100, pos(nx));
      if (r > l) years.push({ label: `${MONTHS[y.getMonth()]} ${String(y.getFullYear()).slice(2)}`, left: l, width: r - l });
      y.setTime(nx.getTime());
    }
  } else {
    y.setMonth(0, 1);
    while (y < e) {
      const nx = new Date(y.getFullYear() + 1, 0, 1, 12);
      const l = Math.max(0, pos(y)), r = Math.min(100, pos(nx));
      if (r > l) years.push({ label: String(y.getFullYear()), left: l, width: r - l });
      y.setTime(nx.getTime());
    }
  }
  return { start: iso(s), end: iso(e), span, kind, ticks, years };
}

export const posOf = (sc: GanttScaleInfo, d: string) => (daysBetween(sc.start, d) / sc.span) * 100;
/** Izquierda y ancho (%) de una barra que va de s a e inclusive */
export const barOf = (sc: GanttScaleInfo, s: string, e: string) => {
  const l = Math.max(0, posOf(sc, s));
  const r = Math.min(100, ((daysBetween(sc.start, e) + 1) / sc.span) * 100);
  return { left: l, width: Math.max(0.4, r - l) };
};

/* ---------- Medidas en mm (las usa también la paginación) ---------- */
export const GANTT_MM = {
  pad: 4.2,         // py-2 del bloque
  title: 9.5,       // barra de título
  head: 7,          // fila de meses / semanas
  headYears: 4.5,   // fila de años
  row: { normal: 5.6, compact: 4.4 },
  legend: 7,
  caption: 6.5,
  editor: 0,        // el editor de tareas solo existe mientras se edita
};

/** Filas que se dibujan (con "solo principales", las subtareas no) */
export const visibleTasks = (b: BlockConfig) => (b.ganttTasks || []).filter((t) => !(b.ganttOnlyMain && (t.level ?? 0) > 0));

/**
 * Filas del cronograma: `all` (todas, para la escala de tiempo y los colores de grupo) y
 * `shown` (las que se dibujan). Con "ocultar en 0 %" salen las tareas y grupos sin avance
 * (los hitos quedan). La hoja y el paginador usan esta misma función, así cuentan igual.
 */
export function ganttRowsFor(b: BlockConfig, rubrics?: RubricItem[]) {
  // Se arma con TODAS las tareas (grupos, avance y ruta crítica necesitan las subtareas)
  // y después se dejan solo las principales si así se pidió
  const full = buildRows(b.ganttTasks || [], { fromRubrics: !!b.ganttFromRubrics, rubrics });
  if (b.ganttCritical) markCritical(full, b.ganttCritTolerance ?? 0);
  const all = b.ganttOnlyMain ? full.filter((r) => (r.level ?? 0) === 0) : full;
  const shown = b.ganttHideZero ? all.filter((r) => r.milestone || (r.prog ?? 0) > 0) : all;
  return { all, shown };
}

export function ganttLayoutMm(b: BlockConfig) {
  const row = GANTT_MM.row[b.ganttDensity === 'compact' ? 'compact' : 'normal'];
  const header = GANTT_MM.head + GANTT_MM.headYears;
  const hasCaption = !!(b.ganttPrefix || '').trim() || !!(b.ganttCaption || '').trim();
  return {
    row,
    head0: GANTT_MM.pad + (b.showTitle !== false ? GANTT_MM.title : 0) + header,
    headN: GANTT_MM.pad + header,
    tail: GANTT_MM.legend + (hasCaption ? GANTT_MM.caption : 0),
  };
}

/* ---------- Importación CSV / Excel / Project ---------- */
export const GANTT_CSV_FIELDS: CsvField[] = [
  { key: 'code', label: 'Código', keywords: ['codigo', 'edt', 'wbs', 'item'] },
  { key: 'name', label: 'Tarea', keywords: ['nombre', 'tarea', 'actividad', 'descripcion', 'task', 'name', 'rubro'] },
  { key: 'start', label: 'Inicio', keywords: ['inicio', 'comienzo', 'start', 'desde', 'begin'] },
  { key: 'end', label: 'Fin', keywords: ['fin', 'final', 'finish', 'end', 'hasta', 'termino', 'terminacion'] },
  { key: 'days', label: 'Duración', keywords: ['duracion', 'duration', 'dias', 'plazo'] },
  { key: 'prevProgress', label: 'Avance anterior %', keywords: ['anterior', 'previo', 'semana pasada', 'periodo anterior', 'acumulado ant'], numeric: true },
  { key: 'progress', label: 'Avance %', keywords: ['avance', 'progreso', 'completado', 'complete', 'porcentaje', '%'], numeric: true },
  { key: 'level', label: 'Nivel', keywords: ['nivel', 'esquema', 'outline', 'level', 'sangria'] },
  { key: 'pred', label: 'Predecesoras', keywords: ['predecesor', 'predecessor', 'antecesor', 'precedente', 'depende'] },
  { key: 'critical', label: 'Crítica', keywords: ['critica', 'critical', 'critico'] },
  { key: 'uid', label: 'Id', keywords: ['id unico', 'unique id'], exact: ['id', 'nro', 'n', 'no', 'n°', 'nº', 'numero', '#'] },
];

let seq = 0;
export const newTaskId = () => `gt-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export function ganttTaskFromCsv(rec: CsvRecord): GanttTask | null {
  const rawName = rec.name || '';
  const name = rawName.trim();
  if (!name) return null;
  const start = parseDateLoose(rec.start || '');
  const daysMatch = /(\d+(?:[.,]\d+)?)/.exec(rec.days || '');
  const days = daysMatch ? Math.round(parseFloat(daysMatch[1].replace(',', '.'))) : undefined;
  let end = parseDateLoose(rec.end || '');
  if (!end && start && days != null) end = addDays(start, Math.max(0, days - 1));
  if (!start && !end) return null;
  // Nivel: columna propia, o la sangría del nombre (Project la copia con espacios), o el código (1.2.3)
  let level = rec.level ? Math.max(0, parseInt(rec.level, 10) - 1) : NaN;
  if (Number.isNaN(level)) {
    const sp = /^\s*/.exec(rawName)![0].replace(/\t/g, '   ').length;
    level = sp >= 2 ? Math.min(2, Math.round(sp / 3)) : (rec.code && /^\d+(\.\d+)+$/.test(rec.code.trim()) ? Math.min(2, rec.code.trim().split('.').filter((x) => x !== '0').length - 1) : 0);
  }
  const prog = rec.progress !== undefined && rec.progress !== '' ? Number(rec.progress) : undefined;
  const prev = rec.prevProgress !== undefined && rec.prevProgress !== '' ? Number(String(rec.prevProgress).replace('%', '').replace(',', '.')) : undefined;
  return {
    id: newTaskId(),
    code: rec.code?.trim() || undefined,
    name,
    start: start ?? end!,
    end: end ?? start!,
    days,
    progress: prog != null && Number.isFinite(prog) ? Math.max(0, Math.min(100, prog)) : undefined,
    prevProgress: prev != null && Number.isFinite(prev) ? Math.max(0, Math.min(100, prev)) : undefined,
    level: Math.max(0, Math.min(2, level)),
    uid: rec.uid?.trim() || undefined,
    pred: rec.pred?.trim() || undefined,
    critical: /^(s[ií]|yes|true|1|x|cr[ií]tica)$/i.test((rec.critical || '').trim()) ? true
      : /^(no|false|0)$/i.test((rec.critical || '').trim()) ? false : undefined,
    milestone: days === 0 || (!!start && start === end && /hito|inicio de obra|fin de obra|entrega/i.test(name)),
  };
}

/** Después de importar: una fila seguida de otras con más sangría es una tarea resumen */
export function markGroups(tasks: GanttTask[]): GanttTask[] {
  return tasks.map((t, i) => ({ ...t, group: t.group || ((tasks[i + 1]?.level ?? 0) > (t.level ?? 0)) }));
}

/* ---------- Ejemplo inicial: cronograma de una obra ---------- */
export function exampleTasks(): GanttTask[] {
  const T = (name: string, start: string, end: string, extra: Partial<GanttTask> = {}): GanttTask => ({ id: newTaskId(), name, start, end, ...extra });
  return markGroups([
    T('Inicio de obra', '2026-10-14', '2026-10-14', { milestone: true }),
    T('Proyecto ejecutivo', '2026-10-14', '2026-11-21', { progress: 60 }),
    T('Obras previas (movilización)', '2026-10-20', '2026-11-12', { progress: 85 }),
    T('Obrador y vallado', '2026-10-20', '2026-11-12', { level: 1, progress: 100 }),
    T('Instalaciones provisorias', '2026-10-21', '2026-11-12', { level: 1, progress: 70 }),
    T('Demolición y desmontaje', '2026-11-05', '2027-03-12'),
    T('Desmontaje de techo', '2026-11-10', '2026-12-15', { level: 1, progress: 10 }),
    T('Demoliciones internas', '2027-02-05', '2027-03-12', { level: 1 }),
    T('Edificación', '2026-11-16', '2027-06-11'),
    T('Techo (cabriadas y cubierta)', '2026-11-23', '2027-01-25', { level: 1 }),
    T('Patología del hormigón', '2026-11-16', '2027-01-22', { level: 1, progress: 5 }),
    T('Restauración arquitectónica', '2027-04-13', '2027-06-04', { level: 1 }),
    T('Instalaciones', '2026-10-30', '2027-05-28'),
    T('Eléctricas', '2026-10-30', '2027-05-28', { level: 1, progress: 5 }),
    T('Contra incendio y señales débiles', '2027-01-07', '2027-02-26', { level: 1 }),
    T('Exteriores y paisajismo', '2027-01-25', '2027-04-28'),
    T('Fin de obra', '2027-06-11', '2027-06-11', { milestone: true }),
  ]);
}
