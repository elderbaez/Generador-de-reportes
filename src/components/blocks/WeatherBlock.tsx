import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  WeatherCondition, DayTurnWeather, DailyWeatherItem, WeatherDayStyle, WeatherWeekStyle, BlockConfig,
  RainLevel, WeatherLocation,
} from '../../types';
import { searchPlaces, fetchDailyWeather, getBrowserPosition, reverseGeocode, GeoResult, WEATHER_SOURCE_NAME } from '../../utils/weatherService';
import { SectionHeaderBanner } from '../SectionHeaderBanner';
import { EditDock, DockGroup, DockSegmented, DockCheck, DockButton } from '../EditDock';
import { NumberCell, PillSelectCell, PillOption, StatusPill, fmtEs } from '../table/NotionTable';
import { CheckCircle2, XCircle, Clock, HardHat, Droplets, CalendarDays, MapPin, CloudDownload, Plus, X, RotateCcw, Search, LocateFixed } from 'lucide-react';

/* =====================================================================
   Condiciones climáticas
   · Vista de día: tarjetas por turno, franja compacta o resumen de la jornada.
   · Vista de semana: calendario con lluvia, tabla + gráfico o franja compacta.
   Todo se edita sobre la hoja (clic en la ilustración cambia el clima, clic
   en los números los edita) y las opciones van al panel flotante.
   ===================================================================== */

type TurnKey = 'morning' | 'afternoon' | 'night';
type WorkStatus = 'Trabajado' | 'No trabajado' | 'Parcialmente';
type DayData = Record<TurnKey, DayTurnWeather>;

const TURNS: TurnKey[] = ['morning', 'afternoon', 'night'];
const TURN_LABEL: Record<TurnKey, string> = { morning: 'Mañana', afternoon: 'Tarde', night: 'Noche' };

const DEFAULT_DAY: DayData = {
  morning: { show: true, condition: 'soleado', tempC: 22, practicable: true },
  afternoon: { show: true, condition: 'parcial', tempC: 28, practicable: true },
  night: { show: true, condition: 'nublado', tempC: 19, practicable: true },
};

const DEFAULT_WEEK: DailyWeatherItem[] = [
  { id: 'd1', dayName: 'Lunes', dateStr: '01/10', condition: 'soleado', rainfallMm: 0, workStatus: 'Trabajado' },
  { id: 'd2', dayName: 'Martes', dateStr: '02/10', condition: 'parcial', rainfallMm: 0, workStatus: 'Trabajado' },
  { id: 'd3', dayName: 'Miércoles', dateStr: '03/10', condition: 'lluvia_debil', rainfallMm: 4.5, workStatus: 'Parcialmente' },
  { id: 'd4', dayName: 'Jueves', dateStr: '04/10', condition: 'soleado', rainfallMm: 0, workStatus: 'Trabajado' },
  { id: 'd5', dayName: 'Viernes', dateStr: '05/10', condition: 'nublado', rainfallMm: 0, workStatus: 'Trabajado' },
  { id: 'd6', dayName: 'Sábado', dateStr: '06/10', condition: 'lluvia_fuerte', rainfallMm: 18.2, workStatus: 'No trabajado' },
  { id: 'd7', dayName: 'Domingo', dateStr: '07/10', condition: 'soleado', rainfallMm: 0, workStatus: 'Trabajado' },
];

const CONDITIONS: WeatherCondition[] = ['soleado', 'parcial', 'nublado', 'lluvia_debil', 'lluvia_fuerte', 'tormenta'];

export const WEATHER_LABEL: Record<WeatherCondition, string> = {
  soleado: 'Despejado / Soleado',
  parcial: 'Parcialmente nublado',
  nublado: 'Nublado',
  lluvia_debil: 'Lluvia débil',
  lluvia_fuerte: 'Lluvia fuerte',
  tormenta: 'Tormenta',
};
const WEATHER_SHORT: Record<WeatherCondition, string> = {
  soleado: 'Soleado', parcial: 'Parcial', nublado: 'Nublado',
  lluvia_debil: 'Lluvia débil', lluvia_fuerte: 'Lluvia fuerte', tormenta: 'Tormenta',
};
const TINT: Record<WeatherCondition, string> = {
  soleado: '#fffbeb', parcial: '#f0f9ff', nublado: '#f1f5f9',
  lluvia_debil: '#eff6ff', lluvia_fuerte: '#e0e7ff', tormenta: '#f5f3ff',
};
const ACCENT: Record<WeatherCondition, string> = {
  soleado: '#f59e0b', parcial: '#38bdf8', nublado: '#94a3b8',
  lluvia_debil: '#3b82f6', lluvia_fuerte: '#1d4ed8', tormenta: '#7c3aed',
};
const isRain = (c: WeatherCondition) => c === 'lluvia_debil' || c === 'lluvia_fuerte' || c === 'tormenta';

/* ---------- Ilustraciones de clima (SVG propio, a color, legible impreso) ---------- */

const SunG: React.FC = () => (
  <>
    <circle cx="24" cy="24" r="9" fill="#fbbf24" />
    <g stroke="#f59e0b" strokeWidth="3" strokeLinecap="round">
      <path d="M24 5v5M24 38v5M5 24h5M38 24h5M10.6 10.6l3.5 3.5M33.9 33.9l3.5 3.5M10.6 37.4l3.5-3.5M33.9 14.1l3.5-3.5" />
    </g>
  </>
);
const CloudG: React.FC<{ x?: number; y?: number; fill: string; stroke: string }> = ({ x = 0, y = 0, fill, stroke }) => (
  <path transform={`translate(${x} ${y})`} d="M14 38h22a8 8 0 0 0 0-16 11 11 0 0 0-21-2 8 8 0 0 0-1 18z"
    fill={fill} stroke={stroke} strokeWidth="1.5" />
);

export const WeatherIcon: React.FC<{ condition: WeatherCondition; size?: number }> = ({ condition, size = 24 }) => {
  let body: React.ReactNode;
  switch (condition) {
    case 'parcial':
      body = <><g transform="translate(-6 -6) scale(.85)"><SunG /></g><CloudG x={4} y={4} fill="#e2e8f0" stroke="#94a3b8" /></>;
      break;
    case 'nublado':
      body = <><CloudG x={-4} y={-6} fill="#e2e8f0" stroke="#cbd5e1" /><CloudG x={2} fill="#cbd5e1" stroke="#94a3b8" /></>;
      break;
    case 'lluvia_debil':
      body = <><CloudG y={-6} fill="#cbd5e1" stroke="#94a3b8" /><g stroke="#3b82f6" strokeWidth="2.6" strokeLinecap="round"><path d="M18 38l-2 5M28 38l-2 5" /></g></>;
      break;
    case 'lluvia_fuerte':
      body = <><CloudG y={-7} fill="#94a3b8" stroke="#64748b" /><g stroke="#1d4ed8" strokeWidth="2.6" strokeLinecap="round"><path d="M15 36l-3 7M22 36l-3 7M29 36l-3 7M36 36l-3 7" /></g></>;
      break;
    case 'tormenta':
      body = <><CloudG y={-7} fill="#64748b" stroke="#475569" /><path d="M25 30l-6 9h5l-3 8 9-11h-5l3-6z" fill="#facc15" stroke="#ca8a04" strokeWidth="1" /></>;
      break;
    default:
      body = <SunG />;
  }
  return <svg viewBox="0 0 48 48" width={size} height={size} style={{ display: 'block', overflow: 'visible' }} aria-label={WEATHER_LABEL[condition]}>{body}</svg>;
};

/* ---------- Fichas ---------- */

const workKey = (status: string): WorkStatus => {
  if (status === 'Sí' || status === 'Trabajado') return 'Trabajado';
  if (status === 'No' || status === 'No trabajado') return 'No trabajado';
  if (status === 'Parcial' || status === 'Parcialmente') return 'Parcialmente';
  return 'Trabajado';
};
const WORK_DEF: Record<WorkStatus, { cls: string; icon: React.ComponentType<{ className?: string }>; short: string }> = {
  'Trabajado': { cls: 'resuelto', icon: CheckCircle2, short: 'Trabajado' },
  'Parcialmente': { cls: 'aguardando', icon: Clock, short: 'Parcial' },
  'No trabajado': { cls: 'vencido', icon: XCircle, short: 'No trab.' },
};
const workOptions = (variant: 'full' | 'short' | 'icon'): PillOption<WorkStatus>[] =>
  (['Trabajado', 'Parcialmente', 'No trabajado'] as WorkStatus[]).map((w) => ({
    value: w,
    label: w,
    render: () => (
      <span title={w} style={{ display: 'inline-flex' }}>
        <StatusPill cls={WORK_DEF[w].cls} icon={WORK_DEF[w].icon}>
          {variant === 'full' ? w : variant === 'short' ? WORK_DEF[w].short : ''}
        </StatusPill>
      </span>
    ),
    menu: () => <StatusPill cls={WORK_DEF[w].cls} icon={WORK_DEF[w].icon}>{w}</StatusPill>,
  }));

type Practicable = 'si' | 'no';
const practicableOptions = (short = false): PillOption<Practicable>[] => [
  { value: 'si', label: 'Practicable', render: () => <StatusPill cls="resuelto" icon={CheckCircle2}>Practicable</StatusPill> },
  {
    value: 'no', label: 'No practicable',
    render: () => <StatusPill cls="vencido" icon={XCircle}>{short ? 'No' : 'No practicable'}</StatusPill>,
    menu: () => <StatusPill cls="vencido" icon={XCircle}>No practicable</StatusPill>,
  },
];

/** Selector de clima: la ficha es la ilustración; la lista muestra ilustración + nombre. */
const conditionOptions = (size: number, ring?: boolean): PillOption<WeatherCondition>[] =>
  CONDITIONS.map((c) => ({
    value: c,
    label: WEATHER_LABEL[c],
    render: () => ring ? (
      <span className="wb-ring" style={{ borderColor: ACCENT[c], width: size + 8, height: size + 8 }}>
        <WeatherIcon condition={c} size={size} />
      </span>
    ) : <WeatherIcon condition={c} size={size} />,
    menu: () => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <WeatherIcon condition={c} size={20} />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{WEATHER_LABEL[c]}</span>
      </span>
    ),
  }));

const mm = (n: number) => fmtEs(n, 0, 1);
const dayAbbr = (name: string) => (name || '').slice(0, 3).toUpperCase();

/* ---------- Fechas de la semana (7 días corridos desde cualquier día) ---------- */
const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const pad2 = (n: number) => String(n).padStart(2, '0');
const isoToDate = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const dateToIso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const addDays = (iso: string, n: number) => { const d = isoToDate(iso); d.setDate(d.getDate() + n); return dateToIso(d); };
const isIso = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const ddmm = (iso: string) => { const d = isoToDate(iso); return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`; };

/* ---------- Niveles de resaltado de lluvia ---------- */
export const DEFAULT_RAIN_LEVELS: RainLevel[] = [
  { id: 'lv1', mm: 10, color: '#d97706' },
  { id: 'lv2', mm: 20, color: '#dc2626' },
];
const LEVEL_COLORS = ['#d97706', '#dc2626', '#7c3aed', '#0e7490', '#be185d'];

/* ---------- Ventanita flotante sobre el panel inferior ---------- */
const DockPopover: React.FC<{ anchor: HTMLElement | null; onClose: () => void; title: string; children: React.ReactNode }> = ({ anchor, onClose, title, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const w = ref.current?.offsetWidth ?? 320;
    const h = ref.current?.offsetHeight ?? 160;
    // Arriba del control; si no entra, abajo
    let top = r.top - h - 10;
    if (top < 8) top = Math.min(window.innerHeight - h - 8, r.bottom + 10);
    setPos({ left: Math.max(12, Math.min(r.left, window.innerWidth - w - 12)), top: Math.max(8, top) });
  }, [anchor]);
  React.useEffect(() => {
    const down = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node) || anchor?.contains(e.target as Node)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [anchor, onClose]);
  return createPortal(
    <div ref={ref} className="wb-pop no-print" style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}>
      <div className="wb-pop-title">{title}</div>
      {children}
    </div>,
    document.body
  );
};

/* =====================================================================
   Componente
   ===================================================================== */

interface WeatherBlockProps {
  blockId: string;
  title?: string;
  numberIndex?: number | null;
  showTitle?: boolean;
  weatherMode?: 'day' | 'week';
  weatherDay?: DayData;
  weatherWeek?: DailyWeatherItem[];
  weatherDayStyle?: WeatherDayStyle;
  weatherWeekStyle?: WeatherWeekStyle;
  /** Fecha de toma de datos del encabezado (aaaa-mm-dd): por defecto la semana son los 7 días anteriores. */
  reportDate?: string;
  weekStart?: string;
  rainLevels?: RainLevel[];
  location?: WeatherLocation;
  dataSource?: string;
  isEditing?: boolean;
  onUpdateTitle?: (title: string) => void;
  onToggleShowTitle?: () => void;
  onUpdateConfig?: (patch: Partial<BlockConfig>) => void;
  onStartEditing?: () => void;
}

export const WeatherBlock: React.FC<WeatherBlockProps> = ({
  title = 'CONDICIONES CLIMÁTICAS Y METEOROLÓGICAS',
  numberIndex,
  showTitle = true,
  weatherMode = 'day',
  weatherDay,
  weatherWeek,
  weatherDayStyle = 'cards',
  weatherWeekStyle = 'calendar',
  reportDate,
  weekStart,
  rainLevels,
  location,
  dataSource,
  isEditing = false,
  onUpdateTitle,
  onToggleShowTitle,
  onUpdateConfig,
  onStartEditing,
}) => {
  const mode = weatherMode || 'day';
  const dayData: DayData = { ...DEFAULT_DAY, ...(weatherDay || {}) };
  const stored = weatherWeek || DEFAULT_WEEK;
  const levels = [...(rainLevels ?? DEFAULT_RAIN_LEVELS)].sort((a, b) => a.mm - b.mm);

  // Semana = 7 días corridos desde el primer día elegido; por defecto, los 7 días anteriores a la toma de datos
  const autoStart = addDays(isIso(reportDate) ? reportDate! : dateToIso(new Date()), -7);
  const start = isIso(weekStart) ? weekStart! : autoStart;
  const anyDated = stored.some((d) => isIso(d.date));
  const weekData: DailyWeatherItem[] = Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(start, i);
    // Datos guardados por fecha; los informes viejos (sin fechas) se toman por posición
    const found = stored.find((d) => d.date === iso) ?? (anyDated ? undefined : stored[i]);
    return {
      id: `day-${iso}`,
      condition: found?.condition ?? 'soleado',
      rainfallMm: found?.rainfallMm ?? 0,
      workStatus: found?.workStatus ?? 'Trabajado',
      date: iso,
      dayName: DAY_NAMES[isoToDate(iso).getDay()],
      dateStr: ddmm(iso),
    };
  });

  /* ---- Actualizaciones ---- */
  const setTurn = (k: TurnKey, patch: Partial<DayTurnWeather>) =>
    onUpdateConfig?.({ weatherDay: { ...dayData, [k]: { ...dayData[k], ...patch } } });
  /** Guarda la semana visible por fecha, sin perder lo cargado para otras fechas. */
  const saveWeek = (list: DailyWeatherItem[], extra?: Partial<BlockConfig>) => {
    const dates = new Set(list.map((d) => d.date));
    const others = anyDated ? stored.filter((d) => isIso(d.date) && !dates.has(d.date)) : [];
    onUpdateConfig?.({ weatherWeek: [...others, ...list].slice(-63), ...extra });
  };
  /** Texto de la fuente cuando el clima o la lluvia se cargan o corrigen a mano. */
  const IN_SITU_SOURCE = 'registrados in situ';
  const setDay = (i: number, patch: Partial<DailyWeatherItem>) => {
    const cur = weekData[i];
    // Si se toca a mano el clima o la lluvia, ya no son los datos del servicio tal cual:
    // la nota de la esquina pasa a decir que se registraron en obra (el estado de trabajo no cuenta)
    const weatherEdited =
      (patch.condition !== undefined && patch.condition !== cur.condition) ||
      (patch.rainfallMm !== undefined && Number(patch.rainfallMm) !== Number(cur.rainfallMm));
    saveWeek(
      weekData.map((d, j) => (j === i ? { ...d, ...patch } : d)),
      weatherEdited && dataSource !== IN_SITU_SOURCE ? { weatherSource: IN_SITU_SOURCE } : undefined,
    );
  };
  const setWeekStart = (iso: string | undefined) => {
    if (iso !== undefined && !isIso(iso)) return;
    const newStart = iso ?? autoStart;
    const newDates = Array.from({ length: 7 }, (_, i) => addDays(newStart, i));
    const hasData = anyDated && stored.some((d) => d.date && newDates.includes(d.date));
    if (!hasData) {
      // La semana nueva no tiene nada cargado: los valores que se veían pasan a las fechas nuevas
      // (como corregir la fecha de inicio sin perder lo escrito)
      const moved = weekData.map((d, i) => ({ ...d, id: `day-${newDates[i]}`, date: newDates[i], dayName: DAY_NAMES[isoToDate(newDates[i]).getDay()], dateStr: ddmm(newDates[i]) }));
      const others = anyDated ? stored.filter((d) => isIso(d.date) && !newDates.includes(d.date!) && !weekData.some((w) => w.date === d.date)) : [];
      onUpdateConfig?.({ weatherWeekStart: iso, weatherWeek: [...others, ...weekData, ...moved].filter((d, i, a) => a.findIndex((x) => x.date === d.date) === i).slice(-63) });
    } else {
      onUpdateConfig?.({ weatherWeekStart: iso });
    }
  };
  const setLevels = (list: RainLevel[]) => onUpdateConfig?.({ weatherRainLevels: list });

  /* ---- Resaltado de lluvia ---- */
  const levelOf = (v: number) => [...levels].reverse().find((l) => v >= l.mm && l.mm > 0);
  const rainTextColor = (v: number) => levelOf(v)?.color ?? (v > 0 ? '#1d4ed8' : '#94a3b8');
  const rainBarColor = (v: number) => levelOf(v)?.color ?? (v > 0 ? '#3b82f6' : 'var(--rp-line)');
  const rainWrap = (v: number, node: React.ReactNode, extra?: React.CSSProperties) => {
    const lv = levelOf(v);
    return (
      <span className={lv ? 'wb-rain-hl' : undefined}
        style={{ ...(lv ? { background: `color-mix(in srgb, ${lv.color} 14%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${lv.color} 45%, transparent)` } : {}), ...extra }}>
        {node}
      </span>
    );
  };

  /* ---- Ventanitas del panel: niveles de lluvia y ubicación ---- */
  const [pop, setPop] = useState<{ kind: 'levels' | 'place'; anchor: HTMLElement } | null>(null);
  const [placeQuery, setPlaceQuery] = useState(location?.name ?? '');
  const [places, setPlaces] = useState<GeoResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  /* ---- Si cambian las fechas y hay ubicación guardada, preguntar si se actualiza el clima ---- */
  const rootRef = useRef<HTMLElement>(null);
  const startInputRef = useRef<HTMLInputElement>(null);
  const prevStart = useRef(start);
  const [ask, setAsk] = useState<{ anchor: HTMLElement } | null>(null);
  React.useEffect(() => {
    if (prevStart.current === start) return;
    prevStart.current = start;
    if (mode !== 'week' || !location) return;
    // Pequeña pausa: al escribir la fecha a mano no pregunta en cada dígito
    const t = setTimeout(() => {
      const anchor = (isEditing && startInputRef.current) || rootRef.current;
      if (anchor) { setPop(null); setMsg(null); setAsk({ anchor }); }
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);

  const doSearch = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await searchPlaces(placeQuery);
      setPlaces(r);
      if (!r.length) setMsg({ ok: false, text: 'No se encontró ese lugar. Probá con la ciudad y el país.' });
    } catch (e) {
      setMsg({ ok: false, text: `No se pudo buscar: ${e instanceof Error ? e.message : e}` });
    } finally { setBusy(false); }
  };
  /** Usa la ubicación del equipo: la nombra, la guarda y trae el clima de la semana. */
  const doLocate = async () => {
    setBusy(true); setMsg({ ok: true, text: 'Buscando tu ubicación…' });
    try {
      const pos = await getBrowserPosition();
      const place = await reverseGeocode(pos.lat, pos.lon);
      const loc = { name: place.name, lat: pos.lat, lon: pos.lon };
      onUpdateConfig?.({ weatherLocation: loc });
      setPlaceQuery(place.name);
      setPlaces(null);
      setBusy(false);
      await doFetch(loc);
    } catch (e) {
      setBusy(false);
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };
  const doFetch = async (loc: WeatherLocation | undefined = location) => {
    if (!loc) return;
    setBusy(true); setMsg(null);
    try {
      const data = await fetchDailyWeather(loc, weekData[0].date!, weekData[6].date!);
      const byDate = new Map(data.map((d) => [d.date, d]));
      let n = 0;
      const list = weekData.map((d) => {
        const w = byDate.get(d.date!);
        if (!w) return d;
        n++;
        return { ...d, condition: w.condition, rainfallMm: w.rainfallMm };
      });
      if (!n) { setMsg({ ok: false, text: 'El servicio no tiene datos para esas fechas (¿son futuras lejanas?).' }); return; }
      // Los datos quedan guardados por fecha: si después cambia la semana, no se corren de día
      saveWeek(list, { weatherSource: `${WEATHER_SOURCE_NAME} · ${loc.name}` });
      setMsg({ ok: true, text: `Listo: ${n} de 7 días completados con clima y lluvia. Podés corregir cualquier valor en la hoja.` });
    } catch (e) {
      setMsg({ ok: false, text: `No se pudieron traer los datos: ${e instanceof Error ? e.message : e}` });
    } finally { setBusy(false); }
  };

  const visibleTurns = TURNS.filter((k) => dayData[k].show !== false);

  /* ---- Piezas editables reutilizadas por los estilos ---- */
  const condCell = (cond: WeatherCondition, size: number, row: number, col: number, onChange: (c: WeatherCondition) => void, ring?: boolean) => (
    <PillSelectCell value={cond} options={conditionOptions(size, ring)} isEditing={isEditing}
      row={row} col={col} caption="Clima" onChange={onChange} />
  );
  const tempCell = (k: TurnKey, row: number, col: number) => (
    <NumberCell value={dayData[k].tempC} row={row} col={col} isEditing={isEditing} required
      className="nt-inherit-lh nt-nowrap" format={(n) => fmtEs(n, 0, 1)}
      onCommit={(v) => setTurn(k, { tempC: v ?? 0 })} />
  );
  const practCell = (k: TurnKey, row: number, col: number, short = false) => (
    <PillSelectCell<Practicable> value={dayData[k].practicable ? 'si' : 'no'} options={practicableOptions(short)}
      isEditing={isEditing} row={row} col={col} caption="Turno"
      onChange={(v) => setTurn(k, { practicable: v === 'si' })} />
  );
  // La fecha de cada día se calcula desde el primer día (se cambia en el panel inferior)
  const dateCell = (d: DailyWeatherItem, _i: number, _row = 0) => <span title="Se cambia con “Primer día” en el panel">{d.dateStr}</span>;
  const rainCell = (d: DailyWeatherItem, i: number, row: number) => (
    <NumberCell value={d.rainfallMm} row={row} col={i} isEditing={isEditing} required min={0}
      className="nt-inherit-lh nt-nowrap" format={mm} onCommit={(v) => setDay(i, { rainfallMm: v ?? 0 })} />
  );
  const workCell = (d: DailyWeatherItem, i: number, row: number, variant: 'full' | 'short' | 'icon') => (
    <PillSelectCell<WorkStatus> value={workKey(d.workStatus)} options={workOptions(variant)} isEditing={isEditing}
      row={row} col={i} caption="Trabajo en obra" onChange={(v) => setDay(i, { workStatus: v })} />
  );

  /* ---- Resumen semanal (calculado) ---- */
  const totalRain = weekData.reduce((s, d) => s + (Number(d.rainfallMm) || 0), 0);
  const worked = weekData.filter((d) => workKey(d.workStatus) === 'Trabajado').length;
  const partial = weekData.filter((d) => workKey(d.workStatus) === 'Parcialmente').length;
  const rainyDays = weekData.filter((d) => (Number(d.rainfallMm) || 0) > 0).length;
  const maxRain = Math.max(1, ...weekData.map((d) => Number(d.rainfallMm) || 0));
  const n = weekData.length;

  /* =================== Vistas de día =================== */
  const renderDay = () => {
    if (visibleTurns.length === 0) {
      return <div className="wb-empty">Todos los turnos están ocultos{isEditing ? ' — activalos en el panel inferior' : ''}.</div>;
    }
    const cols = `repeat(${visibleTurns.length}, minmax(0, 1fr))`;

    if (weatherDayStyle === 'strip') {
      return (
        <div className="wb-strip rp-table" style={{ gridTemplateColumns: cols }}>
          {visibleTurns.map((k, i) => {
            const t = dayData[k];
            return (
              <div key={k} className="wb-strip-cell">
                <span style={{ flexShrink: 0 }}>{condCell(t.condition, 28, 0, i, (c) => setTurn(k, { condition: c }))}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="wb-lbl rp-label">{TURN_LABEL[k]}</div>
                  <div className="wb-cond">{WEATHER_LABEL[t.condition]}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="wb-mono" style={{ fontSize: '11pt', fontWeight: 800, lineHeight: 1.15, display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline' }}>
                    {tempCell(k, 1, i)}<span>°</span>
                  </div>
                  {practCell(k, 2, i, true)}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (weatherDayStyle === 'summary') {
      const temps = visibleTurns.map((k) => Number(dayData[k].tempC) || 0);
      const ok = visibleTurns.filter((k) => dayData[k].practicable).length;
      const rainTurns = visibleTurns.filter((k) => isRain(dayData[k].condition)).map((k) => TURN_LABEL[k].toLowerCase());
      const lo = Math.min(...temps), hi = Math.max(...temps);
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '52mm minmax(0, 1fr)', gap: 12, alignItems: 'stretch' }}>
          <div className="wb-sum">
            <div className="wb-lbl rp-label" style={{ color: 'rgba(255,255,255,.6)' }}>Jornada del día</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '3px 0' }}>
              <span className="wb-mono" style={{ fontSize: '18pt', fontWeight: 800, lineHeight: 1 }}>{ok}/{visibleTurns.length}</span>
              <span style={{ fontSize: '8pt', color: '#cbd5e1' }}>{visibleTurns.length === 1 ? 'turno practicable' : 'turnos practicables'}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: '7.5pt', color: '#cbd5e1', flexWrap: 'wrap' }}>
              <span><b className="wb-mono" style={{ color: '#fff' }}>{lo === hi ? `${fmtEs(lo, 0, 1)} °C` : `${fmtEs(lo, 0, 1)}–${fmtEs(hi, 0, 1)} °C`}</b> {lo === hi ? '' : 'rango'}</span>
              <span>
                {rainTurns.length
                  ? <><b style={{ color: '#fde68a' }}>Lluvia</b> {rainTurns.length === visibleTurns.length ? 'todo el día' : `por la ${rainTurns.join(' y ')}`}</>
                  : <><b style={{ color: '#fde68a' }}>Sin lluvia</b></>}
              </span>
            </div>
          </div>
          <div className="wb-timeline" style={{ gridTemplateColumns: cols }}>
            {visibleTurns.length > 1 && (
              <div className="wb-timeline-line" style={{ left: `${50 / visibleTurns.length}%`, right: `${50 / visibleTurns.length}%` }} />
            )}
            {visibleTurns.map((k, i) => {
              const t = dayData[k];
              return (
                <div key={k} style={{ position: 'relative', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {condCell(t.condition, 30, 0, i, (c) => setTurn(k, { condition: c }), true)}
                  <div className="wb-lbl rp-label" style={{ color: 'var(--rp-primary)', marginTop: 3, display: 'flex', gap: 3, alignItems: 'baseline', justifyContent: 'center' }}>
                    <span>{TURN_LABEL[k]} ·</span>
                    <span className="wb-mono" style={{ color: '#0f172a', display: 'inline-flex' }}>{tempCell(k, 1, i)}°C</span>
                  </div>
                  <div style={{ marginTop: 3 }}>{practCell(k, 2, i)}</div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // 'cards'
    return (
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10 }}>
        {visibleTurns.map((k, i) => {
          const t = dayData[k];
          return (
            <div key={k} className="wb-card rp-card" style={{ background: `linear-gradient(180deg, ${TINT[t.condition]}, #fff 70%)` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px 0', gap: 6 }}>
                <span className="wb-lbl rp-label" style={{ color: 'var(--rp-primary)' }}>{TURN_LABEL[k]}</span>
                {practCell(k, 2, i)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 8px' }}>
                <span style={{ flexShrink: 0 }}>{condCell(t.condition, 46, 0, i, (c) => setTurn(k, { condition: c }))}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="wb-mono" style={{ fontSize: '17pt', fontWeight: 800, lineHeight: 1, color: '#0f172a', display: 'flex', alignItems: 'baseline' }}>
                    {tempCell(k, 1, i)}<span style={{ fontSize: '9pt', color: '#94a3b8' }}>°C</span>
                  </div>
                  <div style={{ fontSize: '7.5pt', fontWeight: 600, color: '#475569', marginTop: 3 }}>{WEATHER_LABEL[t.condition]}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  /* =================== Vistas de semana =================== */
  const summaryText = (
    <>
      <span>Trabajados <b className="wb-mono" style={{ color: '#059669' }}>{worked}/{n}</b>{partial ? <> · parciales <b className="wb-mono" style={{ color: '#b45309' }}>{partial}</b></> : null}</span>
      <span>Lluvia acumulada <b className="wb-mono" style={{ color: '#1d4ed8' }}>{mm(totalRain)} mm</b></span>
      <span>Días con lluvia <b className="wb-mono" style={{ color: 'var(--rp-primary)' }}>{rainyDays}</b></span>
      {levels.filter((l) => l.mm > 0).map((l) => (
        <span key={l.id}>≥ {mm(l.mm)} mm <b className="wb-mono" style={{ color: l.color }}>{weekData.filter((d) => (Number(d.rainfallMm) || 0) >= l.mm).length}</b></span>
      ))}
    </>
  );
  const legend = (levels.some((l) => l.mm > 0) || dataSource) ? (
    <div className="wb-legend">
      {levels.some((l) => l.mm > 0) && (
        <span className="wb-legend-levels">
          Lluvia resaltada:
          {levels.filter((l) => l.mm > 0).map((l) => (
            <span key={l.id}><i style={{ background: l.color }} /> ≥ {mm(l.mm)} mm</span>
          ))}
        </span>
      )}
      {dataSource && <span className="wb-legend-src">Datos meteorológicos: {dataSource}</span>}
    </div>
  ) : null;

  const renderWeek = () => {
    if (weatherWeekStyle === 'table') {
      return (
        <div className="wb-tablewrap rp-table">
          <table className={`wb-table${isEditing ? ' nt-editing' : ''}`}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', width: '14%' }}>Día</th>
                {weekData.map((d, i) => (
                  <th key={d.id || i}>
                    <div style={{ fontSize: '7pt', fontWeight: 800 }}>{dayAbbr(d.dayName)}</div>
                    <div className="wb-mono" style={{ fontSize: '6pt', color: '#64748b', fontWeight: 500, letterSpacing: 0 }}>{dateCell(d, i)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="wb-rowlbl">Clima</td>
                {weekData.map((d, i) => (
                  <td key={d.id || i} style={{ textAlign: 'center', padding: 3 }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>{condCell(d.condition, 26, 1, i, (c) => setDay(i, { condition: c }))}</div>
                    <div style={{ fontSize: '6pt', color: '#475569', fontWeight: 600, lineHeight: 1.1 }}>{WEATHER_SHORT[d.condition]}</div>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="wb-rowlbl">Lluvia <span style={{ fontWeight: 500, color: '#94a3b8' }}>(mm)</span></td>
                {weekData.map((d, i) => {
                  const v = Number(d.rainfallMm) || 0;
                  return (
                    <td key={d.id || i} style={{ padding: '3px 6px', verticalAlign: 'bottom' }}>
                      <div style={{ height: 22, display: 'flex', alignItems: 'flex-end' }}>
                        <div style={{ width: '100%', height: Math.max(2, (v / maxRain) * 22), background: rainBarColor(v), borderRadius: '3px 3px 0 0' }} />
                      </div>
                      <div className="wb-mono" style={{ textAlign: 'center', fontWeight: 800, color: rainTextColor(v), marginTop: 2, display: 'flex', justifyContent: 'center' }}>{rainWrap(v, rainCell(d, i, 2))}</div>
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="wb-rowlbl">Trabajo</td>
                {weekData.map((d, i) => (
                  <td key={d.id || i} style={{ textAlign: 'center', padding: '4px 2px' }}>{workCell(d, i, 3, 'short')}</td>
                ))}
              </tr>
            </tbody>
          </table>
          <div className="wb-foot">{summaryText}</div>
          {legend}
        </div>
      );
    }

    if (weatherWeekStyle === 'compact') {
      return (
        <div className="wb-compact rp-table">
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {weekData.map((d, i) => {
              const v = Number(d.rainfallMm) || 0;
              const w = workKey(d.workStatus);
              return (
                <div key={d.id || i} className="wb-compact-cell" style={{ borderBottomColor: w === 'Trabajado' ? '#34d399' : w === 'Parcialmente' ? '#fbbf24' : '#fb7185' }}>
                  <span style={{ flexShrink: 0 }}>{condCell(d.condition, 22, 1, i, (c) => setDay(i, { condition: c }))}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                      <span style={{ fontSize: '6.5pt', fontWeight: 800, color: 'var(--rp-primary)' }}>{dayAbbr(d.dayName)}</span>
                      <span className="wb-mono" style={{ fontSize: '5.5pt', color: '#94a3b8' }}>{dateCell(d, i)}</span>
                    </div>
                    <div className="wb-mono" style={{ fontSize: '7pt', fontWeight: 800, color: rainTextColor(v), display: 'flex', alignItems: 'baseline', gap: 2 }}>
                      {rainWrap(v, <>{rainCell(d, i, 2)}<span style={{ fontSize: '5.5pt', fontWeight: 600 }}>mm</span></>, { display: 'inline-flex', alignItems: 'baseline', gap: 2 })}
                    </div>
                  </div>
                  <span style={{ flexShrink: 0, alignSelf: 'flex-start' }}>{workCell(d, i, 3, 'icon')}</span>
                </div>
              );
            })}
          </div>
          <div className="wb-foot" style={{ justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {(['Trabajado', 'Parcialmente', 'No trabajado'] as WorkStatus[]).map((w) => (
                <span key={w} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <i style={{ width: 10, height: 3, borderRadius: 2, background: w === 'Trabajado' ? '#34d399' : w === 'Parcialmente' ? '#fbbf24' : '#fb7185' }} />{w}
                </span>
              ))}
            </span>
            <span style={{ display: 'flex', gap: 14 }}>{summaryText}</span>
          </div>
          {legend}
        </div>
      );
    }

    // 'calendar'
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: 6 }}>
          {weekData.map((d, i) => {
            const v = Number(d.rainfallMm) || 0;
            return (
              <div key={d.id || i} className="wb-tile rp-card" style={{ background: `linear-gradient(180deg, ${TINT[d.condition]}, #fff 60%)` }}>
                <div style={{ fontSize: '7pt', fontWeight: 800, color: 'var(--rp-primary)' }}>{dayAbbr(d.dayName)}</div>
                <div className="wb-mono" style={{ fontSize: '6.5pt', color: '#64748b' }}>{dateCell(d, i)}</div>
                <div style={{ display: 'flex', justifyContent: 'center', margin: '3px 0' }}>{condCell(d.condition, 30, 1, i, (c) => setDay(i, { condition: c }))}</div>
                <div style={{ height: 16, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <div style={{ width: '60%', height: Math.max(2, (v / maxRain) * 16), borderRadius: '3px 3px 0 0', background: rainBarColor(v) }} />
                </div>
                <div className="wb-mono" style={{ fontSize: '7pt', fontWeight: 800, color: rainTextColor(v), margin: '2px 0 4px', display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 2 }}>
                  {rainWrap(v, <>{rainCell(d, i, 2)}<span>mm</span></>, { display: 'inline-flex', alignItems: 'baseline', gap: 2 })}
                </div>
                {workCell(d, i, 3, 'short')}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 7 }}>
          {([
            [HardHat, 'Días trabajados', `${worked} de ${n}`, '#059669'],
            [Droplets, 'Lluvia acumulada', `${mm(totalRain)} mm`, '#1d4ed8'],
            [CalendarDays, 'Días con lluvia', `${rainyDays} de ${n}`, 'var(--rp-primary)'],
          ] as [React.ComponentType<{ className?: string; style?: React.CSSProperties }>, string, string, string][]).map(([Icon, l, v, c]) => (
            <div key={l} className="wb-kpi rp-card">
              <Icon style={{ width: 15, height: 15, color: c, flexShrink: 0 }} />
              <span style={{ fontSize: '7.5pt', color: '#475569', fontWeight: 600 }}>{l}</span>
              <b className="wb-mono" style={{ marginLeft: 'auto', fontSize: '9.5pt', color: c }}>{v}</b>
            </div>
          ))}
        </div>
        {levels.some((l) => l.mm > 0) && (
          <div className="wb-legend" style={{ border: 0, background: 'none', padding: '5px 2px 0' }}>
            <span className="wb-legend-levels">
              {levels.filter((l) => l.mm > 0).map((l) => (
                <span key={l.id}><i style={{ background: l.color }} /> Días ≥ {mm(l.mm)} mm: <b className="wb-mono" style={{ color: l.color }}>{weekData.filter((d) => (Number(d.rainfallMm) || 0) >= l.mm).length}</b></span>
              ))}
            </span>
            {dataSource && <span className="wb-legend-src">Datos meteorológicos: {dataSource}</span>}
          </div>
        )}
        {!levels.some((l) => l.mm > 0) && dataSource && (
          <div className="wb-legend" style={{ border: 0, background: 'none', padding: '5px 2px 0' }}><span className="wb-legend-src">Datos meteorológicos: {dataSource}</span></div>
        )}
      </>
    );
  };

  return (
    <section ref={rootRef} className={`nt-root wb-root px-5 py-2 shrink-0 select-none${isEditing ? ' nt-editing' : ''}`}>
      <style>{WB_CSS}</style>
      <SectionHeaderBanner
        numberIndex={numberIndex}
        title={title}
        isEditing={isEditing}
        showTitle={showTitle}
        onUpdateTitle={onUpdateTitle}
        onToggleShowTitle={onToggleShowTitle}
        onStartEditing={onStartEditing}
      />

      {isEditing && (
        <>
          <EditDock slot="options">
            <DockGroup label="Vista">
              <DockSegmented
                value={mode}
                options={[{ value: 'day', label: 'Día' }, { value: 'week', label: 'Semana' }]}
                onChange={(m) => onUpdateConfig?.({ weatherMode: m as 'day' | 'week' })}
              />
            </DockGroup>
            {mode === 'day' ? (
              <>
                <DockGroup label="Estilo">
                  <DockSegmented<WeatherDayStyle>
                    value={weatherDayStyle}
                    options={[{ value: 'cards', label: 'Tarjetas' }, { value: 'strip', label: 'Franja' }, { value: 'summary', label: 'Resumen' }]}
                    onChange={(v) => onUpdateConfig?.({ weatherDayStyle: v })}
                  />
                </DockGroup>
                <DockGroup label="Turnos">
                  {TURNS.map((k) => (
                    <DockCheck key={k} label={TURN_LABEL[k]} checked={dayData[k].show !== false}
                      onChange={() => setTurn(k, { show: dayData[k].show === false })} />
                  ))}
                </DockGroup>
              </>
            ) : (
              <>
                <DockGroup label="Estilo">
                  <DockSegmented<WeatherWeekStyle>
                    value={weatherWeekStyle}
                    options={[{ value: 'calendar', label: 'Calendario' }, { value: 'table', label: 'Tabla' }, { value: 'compact', label: 'Compacta' }]}
                    onChange={(v) => onUpdateConfig?.({ weatherWeekStyle: v })}
                  />
                </DockGroup>
                <label className="dock-group" title="Los 7 días se cuentan desde esta fecha (cualquier día de la semana)">
                  <span className="dock-label">Primer día</span>
                  <input
                    ref={startInputRef}
                    type="date"
                    value={start}
                    onChange={(e) => setWeekStart(e.target.value || undefined)}
                    className="bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-[11px] font-mono font-bold text-white cursor-pointer [color-scheme:dark]"
                  />
                </label>
                {isIso(weekStart) ? (
                  <DockButton onClick={() => setWeekStart(undefined)} title={`Volver a los 7 días anteriores a la toma de datos (desde ${ddmm(autoStart)})`}>
                    <RotateCcw /> 7 días antes de la toma
                  </DockButton>
                ) : (
                  <span className="dock-label" title="Sigue a la fecha de toma de datos del encabezado">7 días antes de la toma</span>
                )}
                <DockButton active={pop?.kind === 'levels'} onClick={(e) => setPop(pop?.kind === 'levels' ? null : { kind: 'levels', anchor: e.currentTarget })}>
                  <Droplets /> Lluvia ≥ {levels.filter((l) => l.mm > 0).map((l) => mm(l.mm)).join(' / ') || '—'} mm
                </DockButton>
                <DockButton active={pop?.kind === 'place'} onClick={(e) => {
                  if (pop?.kind === 'place') { setPop(null); return; }
                  setPop({ kind: 'place', anchor: e.currentTarget });
                  // Sin ubicación guardada: se intenta detectar sola (el navegador pide permiso)
                  if (!location && !busy) doLocate();
                }}>
                  <MapPin /> {location ? location.name : 'Ubicación y datos'}
                </DockButton>
              </>
            )}
          </EditDock>
          {pop?.kind === 'levels' && mode === 'week' && (
            <DockPopover anchor={pop.anchor} onClose={() => setPop(null)} title="Resaltar la lluvia desde…">
              <div className="wb-pop-note">Los días que alcancen cada límite se resaltan con su color y se cuentan en el resumen (útil para justificar prórrogas).</div>
              {levels.map((l, i) => (
                <div key={l.id} className="wb-lv-row">
                  <span>Nivel {i + 1}: desde</span>
                  <input type="number" min={0} step={0.5} value={l.mm}
                    onChange={(e) => setLevels(levels.map((x) => (x.id === l.id ? { ...x, mm: Math.max(0, Number(e.target.value) || 0) } : x)))} />
                  <span>mm</span>
                  <input type="color" value={l.color} onChange={(e) => setLevels(levels.map((x) => (x.id === l.id ? { ...x, color: e.target.value } : x)))} title="Color del resaltado" />
                  <button type="button" className="wb-pop-x" onClick={() => setLevels(levels.filter((x) => x.id !== l.id))} title="Quitar nivel"><X /></button>
                </div>
              ))}
              <div className="wb-pop-actions">
                <button type="button" className="wb-pop-btn" onClick={() => setLevels([...levels, { id: `lv-${Date.now().toString(36)}`, mm: (levels[levels.length - 1]?.mm ?? 0) + 10, color: LEVEL_COLORS[levels.length % LEVEL_COLORS.length] }])}>
                  <Plus /> Agregar nivel
                </button>
                {levels.length === 0 && <span className="wb-pop-note">Sin niveles: la lluvia no se resalta.</span>}
              </div>
            </DockPopover>
          )}
          {pop?.kind === 'place' && mode === 'week' && (
            <DockPopover anchor={pop.anchor} onClose={() => setPop(null)} title="Ubicación de la obra">
              <button type="button" className="wb-pop-btn primary wide" disabled={busy} onClick={doLocate}>
                <LocateFixed /> Usar mi ubicación actual
              </button>
              <div className="wb-pop-or"><span>o buscá la ciudad</span></div>
              <form className="wb-pop-search" onSubmit={(e) => { e.preventDefault(); doSearch(); }}>
                <input value={placeQuery} onChange={(e) => setPlaceQuery(e.target.value)} placeholder="Ciudad, departamento o país (ej. Encarnación, Itapúa)" />
                <button type="submit" className="wb-pop-btn" disabled={busy || !placeQuery.trim()}><Search /> Buscar</button>
              </form>
              {places && places.length > 0 && (
                <div className="wb-pop-list">
                  {places.map((p) => (
                    <button key={`${p.lat},${p.lon}`} type="button" className={`wb-pop-place${location && location.lat === p.lat && location.lon === p.lon ? ' on' : ''}`}
                      onClick={() => { const loc = { name: p.name, lat: p.lat, lon: p.lon }; onUpdateConfig?.({ weatherLocation: loc }); setPlaces(null); setPlaceQuery(p.name); doFetch(loc); }}>
                      <b>{p.name}</b><span>{p.detail}</span>
                    </button>
                  ))}
                </div>
              )}
              {location && (
                <div className="wb-pop-sel">
                  <MapPin /> <b>{location.name}</b> <span className="wb-mono">{location.lat.toFixed(3)}, {location.lon.toFixed(3)}</span>
                </div>
              )}
              <div className="wb-pop-actions">
                <button type="button" className="wb-pop-btn primary" disabled={!location || busy} onClick={() => doFetch()}>
                  <CloudDownload /> {busy ? 'Trayendo…' : `Traer clima del ${ddmm(weekData[0].date!)} al ${ddmm(weekData[6].date!)}`}
                </button>
              </div>
              {msg && <div className={`wb-pop-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
              <div className="wb-pop-note">
                Completa el clima y los mm de lluvia de cada día desde {WEATHER_SOURCE_NAME} (servicio meteorológico abierto). El estado de trabajo no se toca.
                Todos los valores siguen siendo editables en la hoja.
              </div>
            </DockPopover>
          )}
          <EditDock slot="hint">
            <span>Clic en la ilustración cambia el clima</span>
            <span>Clic en un número lo edita · Tab avanza</span>
            <span>Clic en una ficha cambia el estado · ↑↓ la recorren</span>
          </EditDock>
        </>
      )}

      {ask && location && mode === 'week' && (
        <DockPopover anchor={ask.anchor} onClose={() => { if (!busy) setAsk(null); }} title="¿Actualizar el clima?">
          <div className="wb-pop-note" style={{ color: '#334155', fontSize: 11.5 }}>
            Cambiaron las fechas de la semana: ahora va del <b>{ddmm(weekData[0].date!)}</b> al <b>{ddmm(weekData[6].date!)}</b>.
            ¿Traer el clima y la lluvia de esos días para <b>{location.name}</b>?
          </div>
          <div className="wb-pop-actions">
            <button type="button" className="wb-pop-btn primary" disabled={busy}
              onClick={async () => { await doFetch(); }}>
              <CloudDownload /> {busy ? 'Trayendo…' : 'Actualizar clima'}
            </button>
            <button type="button" className="wb-pop-btn" disabled={busy} onClick={() => setAsk(null)}>Ahora no</button>
          </div>
          {msg && <div className={`wb-pop-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
          {msg?.ok && (
            <div className="wb-pop-actions"><button type="button" className="wb-pop-btn" onClick={() => { setAsk(null); setMsg(null); }}>Cerrar</button></div>
          )}
          <div className="wb-pop-note">Los valores que ya escribiste a mano se reemplazan por los del servicio; el estado de trabajo no se toca.</div>
        </DockPopover>
      )}

      <div onClick={() => { if (!isEditing) onStartEditing?.(); }} style={!isEditing && onStartEditing ? { cursor: 'pointer' } : undefined}>
        {mode === 'day' ? renderDay() : renderWeek()}
      </div>
    </section>
  );
};

const WB_CSS = `
.wb-root .wb-lbl{font-size:6.5pt;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#64748b;line-height:1.35}
.wb-root .wb-mono{font-family:var(--rp-font-num);font-variant-numeric:tabular-nums}
.wb-root .wb-cond{font-size:7.5pt;font-weight:600;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-root .wb-card{border:1px solid var(--rp-line);border-radius:var(--rp-radius);overflow:hidden}
.wb-root .wb-strip{display:grid;border:1px solid var(--rp-border);border-radius:var(--rp-radius);overflow:hidden}
.wb-root .wb-strip-cell{display:flex;align-items:center;gap:8px;padding:6px 10px;border-right:1px solid var(--rp-line)}
.wb-root .wb-strip-cell:last-child{border-right:0}
.wb-root .wb-sum{background:var(--rp-primary);color:#fff;border-radius:var(--rp-radius);padding:9px 12px;display:flex;flex-direction:column;justify-content:space-between}
.wb-root .wb-timeline{position:relative;display:grid;align-items:center;border:1px solid var(--rp-line);border-radius:var(--rp-radius);padding:8px 10px}
.wb-root .wb-timeline-line{position:absolute;top:29px;height:2px;background:var(--rp-line)}
.wb-root .wb-ring{display:inline-flex;align-items:center;justify-content:center;background:#fff;border-radius:50%;border:2px solid;position:relative}
.wb-root .wb-tile{border:1px solid var(--rp-line);border-radius:var(--rp-radius-in);padding:6px 5px;text-align:center;display:flex;flex-direction:column;align-items:center}
.wb-root .wb-tile .nt-cell{text-align:center}
.wb-root .wb-kpi{display:flex;align-items:center;gap:8px;border:1px solid var(--rp-line);border-radius:var(--rp-radius-sm);padding:5px 9px}
.wb-root .wb-tablewrap,.wb-root .wb-compact{border:1px solid var(--rp-border);border-radius:var(--rp-radius);overflow:visible;background:#fff}
.wb-root .wb-table{width:100%;border-collapse:separate;border-spacing:0;font-size:7pt;table-layout:fixed}
.wb-root .wb-table thead th{background:var(--rp-th-bg);color:var(--rp-th-text);padding:5px 2px;border-left:1px solid var(--rp-border);font-size:6.5pt;text-transform:uppercase;letter-spacing:.05em;text-align:center}
.wb-root .wb-table thead th:first-child{border-left:0;padding:6px 8px;border-top-left-radius:var(--rp-radius-in)}
.wb-root .wb-table thead th:last-child{border-top-right-radius:var(--rp-radius-in)}
.wb-root .wb-table tbody td{border-left:1px solid var(--rp-surface-2);border-top:1px solid var(--rp-line)}
.wb-root .wb-table tbody td:first-child{border-left:0}
.wb-root .wb-table .wb-rowlbl{padding:5px 8px;font-weight:700;color:#334155}
.wb-root .wb-table .nt-cell{text-align:center}
.wb-root .wb-foot{display:flex;gap:18px;justify-content:flex-end;align-items:center;padding:5px 10px;background:var(--rp-surface-1);border-top:1px solid var(--rp-line);font-size:7pt;color:#475569;border-radius:0 0 var(--rp-radius-in) var(--rp-radius-in)}
.wb-root .wb-compact-cell{display:flex;align-items:center;gap:5px;padding:5px 6px;border-right:1px solid var(--rp-line);border-bottom:3px solid}
.wb-root .wb-compact-cell:last-child{border-right:0}
.wb-root .wb-compact-cell:first-child{border-top-left-radius:var(--rp-radius-in)}
.wb-root .wb-compact-cell:last-child{border-top-right-radius:var(--rp-radius-in)}
.wb-root .wb-compact-cell .nt-pill.status{padding:1px 3px;gap:0}
.wb-root .wb-empty{padding:10px;text-align:center;color:#94a3b8;font-style:italic;font-size:7.5pt;border:1px dashed var(--rp-border);border-radius:var(--rp-radius)}
.wb-root .nt-pill-btn{border-radius:50%}
.wb-root .nt-pill-btn:has(.nt-pill){border-radius:6px}
.nt-editing.wb-root .nt-pill-btn:hover svg[aria-label]{filter:drop-shadow(0 0 3px rgba(14,165,233,.55))}
/* Las columnas nunca se ensanchan por su contenido (temas con letras, rellenos o fichas más grandes):
   lo que no entra se acomoda en dos líneas en lugar de empujar la grilla fuera de la hoja */
.wb-root .wb-tile,.wb-root .wb-card,.wb-root .wb-strip-cell,.wb-root .wb-compact-cell,.wb-root .wb-kpi{min-width:0}
/* Fichas dentro de columnas angostas: nunca más anchas que su casilla (si no entran, terminan en "…"; el texto completo queda en el globito) */
.wb-root .wb-tile .nt-pill-btn,.wb-root .wb-table .nt-pill-btn,.wb-root .wb-card .nt-pill-btn,.wb-root .wb-strip-cell .nt-pill-btn{max-width:100%;min-width:0}
.wb-root .wb-tile .nt-pill,.wb-root .wb-table .nt-pill,.wb-root .wb-card .nt-pill,.wb-root .wb-strip-cell .nt-pill{max-width:100%;min-width:0;overflow:hidden}
.wb-root .wb-tile .nt-pill-txt,.wb-root .wb-table .nt-pill-txt,.wb-root .wb-card .nt-pill-txt,.wb-root .wb-strip-cell .nt-pill-txt{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-root .wb-tile>*,.wb-root .wb-tile span[title]{max-width:100%}
.wb-root .wb-kpi>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-root .wb-rain-hl{border-radius:4px;padding:0 3px;margin:0 -3px}
.wb-root .wb-legend{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:4px 10px;border-top:1px solid var(--rp-line);font-size:6.5pt;color:#64748b}
.wb-root .wb-legend-levels{display:inline-flex;align-items:center;gap:10px;flex-wrap:wrap}
.wb-root .wb-legend-levels i{display:inline-block;width:8px;height:8px;border-radius:2px;vertical-align:-1px;margin-right:2px}
.wb-root .wb-legend-src{font-style:italic;color:#94a3b8}
.wb-pop{position:fixed;z-index:1300;width:340px;max-width:calc(100vw - 24px);background:#fff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 14px 40px rgba(15,23,42,.25);padding:12px;font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#1e293b;display:flex;flex-direction:column;gap:8px}
.wb-pop svg{width:13px;height:13px;flex-shrink:0}
.wb-pop-title{font-size:12px;font-weight:800;color:#0b455b}
.wb-pop-note{font-size:10.5px;color:#64748b;line-height:1.45}
.wb-lv-row{display:flex;align-items:center;gap:6px;font-size:11.5px;color:#334155}
.wb-lv-row input[type=number]{width:64px;border:1px solid #cbd5e1;border-radius:6px;padding:3px 6px;font:600 12px ui-monospace,monospace}
.wb-lv-row input[type=color]{width:26px;height:24px;border:1px solid #cbd5e1;border-radius:6px;padding:1px;background:#fff;cursor:pointer}
.wb-pop-x{margin-left:auto;border:0;background:transparent;color:#94a3b8;cursor:pointer;padding:3px;border-radius:5px}
.wb-pop-x:hover{background:#fef2f2;color:#b91c1c}
.wb-pop-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.wb-pop-btn{border:1px solid #e2e8f0;background:#fff;color:#334155;font:700 11px 'Plus Jakarta Sans',system-ui,sans-serif;padding:5px 9px;border-radius:7px;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
.wb-pop-btn:hover{background:#f8fafc}
.wb-pop-btn.primary{background:#0b455b;border-color:#0b455b;color:#fff}
.wb-pop-btn:disabled{opacity:.45;cursor:default}
.wb-pop-search{display:flex;gap:6px}
.wb-pop-btn.wide{justify-content:center;width:100%;padding:7px 9px}
.wb-pop-or{display:flex;align-items:center;gap:8px;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em}
.wb-pop-or::before,.wb-pop-or::after{content:'';flex:1;height:1px;background:#e2e8f0}
.wb-pop-search input{flex:1;min-width:0;border:1px solid #cbd5e1;border-radius:7px;padding:5px 8px;font-size:12px;font-family:inherit;outline:none}
.wb-pop-search input:focus{border-color:#0ea5e9;box-shadow:0 0 0 3px rgba(14,165,233,.15)}
.wb-pop-list{display:flex;flex-direction:column;gap:2px;max-height:180px;overflow:auto;border:1px solid #f1f5f9;border-radius:8px;padding:3px}
.wb-pop-place{all:unset;box-sizing:border-box;display:flex;flex-direction:column;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:11.5px}
.wb-pop-place span{font-size:10px;color:#64748b}
.wb-pop-place:hover,.wb-pop-place.on{background:#e0f2fe}
.wb-pop-sel{display:flex;align-items:center;gap:6px;font-size:11.5px;color:#0b455b;background:#f0f9ff;border:1px solid #bae6fd;border-radius:7px;padding:5px 8px}
.wb-pop-sel .wb-mono{font-family:ui-monospace,monospace;font-size:10px;color:#64748b;margin-left:auto}
.wb-pop-msg{font-size:11px;border-radius:7px;padding:5px 8px;border:1px solid}
.wb-pop-msg.ok{color:#065f46;background:#ecfdf5;border-color:#a7f3d0}
.wb-pop-msg.err{color:#9f1239;background:#fff1f2;border-color:#fecdd3}
@media print{.wb-root,.wb-root *{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
`;
