import React, { useRef, useState } from 'react';
import {
  ProjectData, BlockConfig, ContractField, ContractIndicator, ContractChartStyle,
  ContractBind, ContractIndicatorBind, IndicatorSourceMode, IndicatorCalcConfig, RubricItem,
} from '../../types';
import {
  Plus, Star, Ruler, Link2Off, TrendingDown, TrendingUp, Minus, RotateCcw,
  Calculator, Link2, Edit3,
} from 'lucide-react';
import { toIsoDate } from '../../utils/fields';
import { EditDock, DockButton, DockGroup, DockSegmented } from '../EditDock';
import {
  EditableCell, useRowOps, RowGutter, RowMenuFor, BulkBar, StatusPill, newRowId, fmtEs,
  RowMenuExtra,
} from '../table/NotionTable';
import { GlassRingArc } from '../GlassRingArc';
import { FormulaInput, FormulaInputHandle, FormulaVar } from '../FormulaInput';

/* =====================================================================
   Contrato e Indicadores de Avance — módulo configurable en dos columnas
   · Columna 1: campos "título + contenido" totalmente editables. Se agregan,
     arrastran, ponen a media o ancho completo y se destacan en un recuadro.
     Los campos de fábrica quedan vinculados a "Obra & Contrato".
   · Columna 2: indicadores "título + porcentaje" en tres estilos de gráfico
     (círculos, anillo triple o barras comparadas). Los valores pueden ser:
     1. Editados in situ libremente.
     2. Vinculados a campos del informe.
     3. Calculados automáticamente (ej. plazo por fechas: inicio, fin y
        toma de muestra / informe; financiero por medición vs contrato; etc.).
   ===================================================================== */

export const DEFAULT_CONTRACT_FIELDS: ContractField[] = [
  { id: 'cf-contract', label: 'Contrato', value: '', bind: 'contract', width: 'full' },
  { id: 'cf-contractor', label: 'Contratista', value: '', bind: 'contractor', width: 'full' },
  { id: 'cf-value', label: 'Monto + aditivos', value: '', bind: 'contractValue', width: 'half' },
  { id: 'cf-ois', label: 'Fecha de O.I.S.', value: '', bind: 'startDate', width: 'half' },
  { id: 'cf-end', label: 'Fecha fin prevista', value: '', bind: 'endDate', width: 'half' },
  { id: 'cf-measure', label: 'Medición acumulada', value: '', bind: 'measurement', highlight: true },
  { id: 'cf-measure-pct', label: 'Del contrato', value: '', bind: 'measurementPct', highlight: true },
];

export const DEFAULT_CONTRACT_INDICATORS: ContractIndicator[] = [
  {
    id: 'ci-time',
    label: 'Plazo transcurrido',
    value: 20.0,
    color: 'var(--rp-ind-1)',
    sourceMode: 'calc',
    calc: { type: 'time_dates' },
    bind: 'timeProgress',
    reference: true,
  },
  {
    id: 'ci-fin',
    label: 'Avance financiero',
    value: 15.0,
    color: 'var(--rp-ind-2)',
    sourceMode: 'bind',
    bind: 'financialProgress',
  },
  {
    id: 'ci-fis',
    label: 'Avance físico',
    value: 16.5,
    color: 'var(--rp-ind-3)',
    sourceMode: 'bind',
    bind: 'physicalProgress',
    primary: true,
  },
];

const PALETTE: { name: string; color: string }[] = [
  { name: 'del tema 1 (plazo)', color: 'var(--rp-ind-1)' },
  { name: 'del tema 2 (financiero)', color: 'var(--rp-ind-2)' },
  { name: 'del tema 3 (físico)', color: 'var(--rp-ind-3)' },
  { name: 'principal del tema', color: 'var(--rp-primary)' },
  { name: 'Rojo', color: '#dc2626' },
  { name: 'Violeta', color: '#7c3aed' },
];

const BIND_LABEL: Record<ContractBind, string> = {
  contract: 'Contrato',
  contractor: 'Contratista',
  contractValue: 'Monto',
  startDate: 'Fecha de O.I.S.',
  endDate: 'Fecha fin prevista',
  reportDate: 'Fecha toma de muestra',
  measurement: 'Medición',
  measurementPct: '% medido',
};

const OPERAND_LABELS: Record<string, string> = {
  contractValue: 'Monto (PYG)',
  measurement: 'Medición (PYG)',
  timeProgress: 'Plazo (%)',
  financialProgress: 'Financiero (%)',
  physicalProgress: 'Físico (%)',
};


/* ---------- De dónde sale cada indicador (un solo lugar para elegirlo: la barra ƒx) ---------- */

export type IndSource =
  | 'manual' | 'formula' | 'time_dates' | 'financial_measure' | 'rubrics_physical'
  | 'bind:timeProgress' | 'bind:financialProgress' | 'bind:physicalProgress' | 'bind:measurementPct' | 'bind:rubrics';

export const IND_SOURCES: { value: IndSource; label: string; formula?: string }[] = [
  { value: 'manual', label: 'Número a mano' },
  { value: 'formula', label: 'Fórmula propia' },
  { value: 'time_dates', label: 'Plazo por fechas', formula: '(@toma_de_muestra - @inicio) / (@fin - @inicio) * 100' },
  { value: 'financial_measure', label: 'Medición ÷ monto', formula: '@medicion / @monto * 100' },
  { value: 'rubrics_physical', label: 'Promedio de rubros', formula: '@rubros' },
  { value: 'bind:timeProgress', label: 'Plazo de Datos generales', formula: '@plazo' },
  { value: 'bind:financialProgress', label: 'Financiero de Datos generales', formula: '@financiero' },
  { value: 'bind:physicalProgress', label: 'Físico de Datos generales', formula: '@fisico' },
];

export function indSourceOf(it: ContractIndicator): IndSource {
  const mode = it.sourceMode ?? (it.calc ? 'calc' : it.bind ? 'bind' : 'manual');
  if (mode === 'calc' && it.calc) return it.calc.type === 'custom' ? 'formula' : it.calc.type;
  if (mode === 'bind' && it.bind) {
    if (it.bind === 'measurementPct') return 'financial_measure';
    if (it.bind === 'rubrics') return 'rubrics_physical';
    return `bind:${it.bind}` as IndSource;
  }
  return 'manual';
}

/* ---------- Utilidades de formato y cálculo ---------- */

/** Hoy en formato aaaa-mm-dd según el reloj del equipo (toISOString da la fecha UTC: de noche ya es "mañana") */
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Calcula una expresión con números, + - * / y paréntesis (sin eval: no ejecuta código).
 * Devuelve NaN si la expresión está mal escrita.
 */
export function calcExpression(src: string): number {
  const t = src.replace(/\s+/g, '');
  let i = 0;
  const peek = () => t[i];
  const num = (): number => {
    const m = /^\d+(?:\.\d+)?|^\.\d+/.exec(t.slice(i));
    if (!m) throw new Error('número');
    i += m[0].length;
    return Number(m[0]);
  };
  const factor = (): number => {
    if (peek() === '-') { i++; return -factor(); }
    if (peek() === '+') { i++; return factor(); }
    if (peek() === '(') {
      i++;
      const v = expr();
      if (peek() !== ')') throw new Error(')');
      i++;
      return v;
    }
    return num();
  };
  const term = (): number => {
    let v = factor();
    while (peek() === '*' || peek() === '/') { const op = t[i++]; const r = factor(); v = op === '*' ? v * r : v / r; }
    return v;
  };
  const expr = (): number => {
    let v = term();
    while (peek() === '+' || peek() === '-') { const op = t[i++]; const r = term(); v = op === '+' ? v + r : v - r; }
    return v;
  };
  try {
    if (!t) return NaN;
    const v = expr();
    return i === t.length ? v : NaN;
  } catch {
    return NaN;
  }
}

const digits = (s: string) => Number(String(s || '').replace(/[^\d,]/g, '').replace(',', '.')) || 0;

const isoToDmy = (iso: string) => {
  const p = (iso || '').split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso || '';
};

const dmyToIso = (dmy: string): string | null => {
  const m = dmy.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (!m) return null;
  const y = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
};

/**
 * Calcula el porcentaje de plazo transcurrido a partir de las fechas:
 * - Fecha de inicio (O.I.S.)
 * - Fecha fin prevista (Contractual)
 * - Fecha de toma de muestra / corte (Informe)
 */
export function calcTimeProgressFromDates(
  startDateStr: string,
  endDateStr: string,
  sampleDateStr: string
): { percent: number; elapsedDays: number; totalDays: number } {
  if (!startDateStr || !endDateStr) {
    return { percent: 0, elapsedDays: 0, totalDays: 0 };
  }
  const start = new Date(startDateStr).getTime();
  const end = new Date(endDateStr).getTime();
  const sample = sampleDateStr ? new Date(sampleDateStr).getTime() : Date.now();

  if (isNaN(start) || isNaN(end) || end <= start) {
    return { percent: 0, elapsedDays: 0, totalDays: 0 };
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const totalDays = Math.max(1, Math.round((end - start) / msPerDay));
  const elapsedDays = Math.round((sample - start) / msPerDay);
  const clampedElapsed = Math.max(0, elapsedDays);

  const percent = Math.round((clampedElapsed / totalDays) * 1000) / 10;
  return { percent, elapsedDays, totalDays };
}

/**
 * Evalúa una fórmula de texto que puede contener variables del proyecto como @monto, @medicion, etc.
 * Soporta operaciones con fechas convirtiéndolas a número de días.
 */
export function evaluateFormula(formula: string, data: ProjectData, rubrics?: RubricItem[]): { value: number; detail: string } {
  if (!formula) return { value: 0, detail: '' };

  const msPerDay = 1000 * 60 * 60 * 24;
  const toDays = (dateStr: string) => {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 0 : Math.floor(d.getTime() / msPerDay);
  };

  const vars: Record<string, number> = {
    '@monto': digits(data.contractValue),
    '@medicion': digits(data.measurement),
    '@plazo': Number(data.timeProgress) || 0,
    '@financiero': Number(data.financialProgress) || 0,
    '@fisico': Number(data.physicalProgress) || 0,
    '@inicio': toDays(data.startDate),
    '@fin': toDays(data.endDate || ''),
    '@toma_de_muestra': toDays(data.reportDate),
    '@hoy': toDays(todayIso()),
    '@rubros': (() => {
      const items = (rubrics || []).filter((r) => !r.comment && !r.group);
      if (items.length === 0) return 0;
      const sum = items.reduce((acc, r) => acc + (Number(r.percent) || 0), 0);
      return sum / items.length;
    })(),
  };

  // Alias
  vars['@avance_fisico'] = vars['@fisico'];
  vars['@avance_financiero'] = vars['@financiero'];
  vars['@fecha_inicio'] = vars['@inicio'];
  vars['@fecha_fin'] = vars['@fin'];
  vars['@fecha_informe'] = vars['@toma_de_muestra'];

  const labels: Record<string, string> = {
    '@inicio': isoToDmy(data.startDate),
    '@fin': isoToDmy(data.endDate || ''),
    '@toma_de_muestra': isoToDmy(data.reportDate),
    '@hoy': isoToDmy(todayIso()),
    '@fecha_inicio': isoToDmy(data.startDate),
    '@fecha_fin': isoToDmy(data.endDate || ''),
    '@fecha_informe': isoToDmy(data.reportDate),
  };

  // Campos personalizados del proyecto
  for (const f of data.fields || []) {
    if (!f.key) continue;
    const key = `@${f.key.toLowerCase()}`;
    const iso = toIsoDate(f.value);
    if (iso) {
      vars[key] = toDays(iso);
      labels[key] = isoToDmy(iso);
    } else {
      vars[key] = digits(f.value);
    }
  }

  let processed = formula.toLowerCase();
  // Ordenar por longitud descendente para evitar problemas con nombres que contienen otros (@fin / @financiero)
  const sortedKeys = Object.keys(vars).sort((a, b) => b.length - a.length);
  const keyRe = (key: string) => new RegExp(key.replace('@', '\\@') + '(?![\\w])', 'gi');

  for (const key of sortedKeys) {
    processed = processed.replace(keyRe(key), `(${vars[key]})`);
  }

  // Lo que quede fuera de números, operadores y paréntesis no se calcula
  const sanitized = processed.replace(/,/g, '.').replace(/[^0-9+\-*/().\s]/g, '');
  const result = calcExpression(sanitized);
  if (!isFinite(result)) return { value: 0, detail: 'Error en fórmula' };
  const finalVal = Math.round(result * 10) / 10;

  // Detalle con los valores reales (para revisar la fórmula)
  let displayDetail = formula;
  for (const key of sortedKeys) {
    const displayVal = labels[key] || vars[key].toLocaleString('es-PY', { maximumFractionDigits: 1 });
    displayDetail = displayDetail.replace(keyRe(key), displayVal);
  }
  return { value: finalVal, detail: displayDetail };
}

/**
 * Determina el valor efectivo de un indicador y su detalle según su modo:
 * - 'manual': valor ingresado in situ.
 * - 'bind': vinculado a campo de datos generales.
 * - 'calc': calculado dinámicamente según fórmulas (fechas, medición o rubros).
 */
export function getIndicatorEffectiveValue(
  it: ContractIndicator,
  data: ProjectData,
  rubrics?: RubricItem[]
): { value: number; detail?: string; mode: IndicatorSourceMode } {
  const mode: IndicatorSourceMode = it.sourceMode ?? (it.calc ? 'calc' : it.bind ? 'bind' : 'manual');

  if (mode === 'calc' && it.calc) {
    if (it.calc.type === 'time_dates') {
      const s = it.calc.startDate || data.startDate || '';
      const e = it.calc.endDate || data.endDate || '';
      const m = it.calc.sampleDate || data.reportDate || todayIso();
      // Sin fechas no se inventa un plazo: se avisa y queda el valor cargado en Datos generales
      if (!s || !e) {
        return { value: Math.max(0, Math.min(100, Number(data.timeProgress) || 0)), detail: !s ? 'falta inicio' : 'falta fin', mode: 'calc' };
      }
      const res = calcTimeProgressFromDates(s, e, m);
      return {
        value: Math.max(0, Math.min(100, res.percent)),
        detail: `${res.elapsedDays}/${res.totalDays} d`,
        mode: 'calc',
      };
    }
    if (it.calc.type === 'financial_measure') {
      const total = digits(data.contractValue);
      const meas = digits(data.measurement);
      const pct = total > 0 ? Math.round(((meas / total) * 100) * 10) / 10 : 0;
      return {
        value: Math.max(0, Math.min(100, pct)),
        detail: 'Medición/Contrato',
        mode: 'calc',
      };
    }
    if (it.calc.type === 'rubrics_physical') {
      const items = (rubrics || []).filter((r) => !r.comment && !r.group);
      if (items.length > 0) {
        const sum = items.reduce((acc, r) => acc + (Number(r.percent) || 0), 0);
        const avg = Math.round((sum / items.length) * 10) / 10;
        return {
          value: Math.max(0, Math.min(100, avg)),
          detail: `${items.length} rubros`,
          mode: 'calc',
        };
      }
      return {
        value: Math.max(0, Math.min(100, Number(data.physicalProgress) || 0)),
        detail: 'Sin rubros',
        mode: 'calc',
      };
    }
    if (it.calc.type === 'custom') {
      if (it.calc.formula) {
        const res = evaluateFormula(it.calc.formula, data, rubrics);
        return { value: Math.max(0, Math.min(100, res.value)), detail: it.calc.formula, mode: 'calc' };
      }
      const valA = it.calc.opA === 'contractValue' ? digits(data.contractValue) :
                 it.calc.opA === 'measurement' ? digits(data.measurement) :
                 it.calc.opA === 'timeProgress' ? Number(data.timeProgress) || 0 :
                 it.calc.opA === 'financialProgress' ? Number(data.financialProgress) || 0 :
                 it.calc.opA === 'physicalProgress' ? Number(data.physicalProgress) || 0 :
                 Number(it.calc.opA) || 0;
      const valB = it.calc.opB === 'contractValue' ? digits(data.contractValue) :
                 it.calc.opB === 'measurement' ? digits(data.measurement) :
                 it.calc.opB === 'timeProgress' ? Number(data.timeProgress) || 0 :
                 it.calc.opB === 'financialProgress' ? Number(data.financialProgress) || 0 :
                 it.calc.opB === 'physicalProgress' ? Number(data.physicalProgress) || 0 :
                 Number(it.calc.opB) || 0;
      const pct = valB !== 0 ? Math.round(((valA / valB) * 100) * 10) / 10 : 0;
      const labelA = OPERAND_LABELS[it.calc.opA as string] || it.calc.opA || '?';
      const labelB = OPERAND_LABELS[it.calc.opB as string] || it.calc.opB || '?';
      return {
        value: Math.max(0, Math.min(100, pct)),
        detail: `${labelA} / ${labelB}`,
        mode: 'calc',
      };
    }
  }

  if (mode === 'bind' && it.bind) {
    if (it.bind === 'measurementPct') {
      const total = digits(data.contractValue);
      const meas = digits(data.measurement);
      const pct = total > 0 ? Math.round(((meas / total) * 100) * 10) / 10 : 0;
      return { value: Math.max(0, Math.min(100, pct)), detail: 'Monto medido', mode: 'bind' };
    }
    if (it.bind === 'rubrics') {
      const items = (rubrics || []).filter((r) => !r.comment && !r.group);
      if (items.length > 0) {
        const sum = items.reduce((acc, r) => acc + (Number(r.percent) || 0), 0);
        const avg = Math.round((sum / items.length) * 10) / 10;
        return { value: Math.max(0, Math.min(100, avg)), detail: 'Tabla rubros', mode: 'bind' };
      }
      return { value: Math.max(0, Math.min(100, Number(data.physicalProgress) || 0)), mode: 'bind' };
    }
    return {
      value: Math.max(0, Math.min(100, Number(data[it.bind]) || 0)),
      detail: BIND_LABEL[it.bind as ContractBind] || it.bind,
      mode: 'bind',
    };
  }

  return {
    value: Math.max(0, Math.min(100, Number(it.value) || 0)),
    mode: 'manual',
  };
}

function boundValue(bind: ContractBind, d: ProjectData): string {
  switch (bind) {
    case 'contract': return d.contract || '';
    case 'contractor': return d.contractor || '';
    case 'contractValue': return d.contractValue ? `PYG ${d.contractValue}` : '';
    case 'measurement': return d.measurement ? `PYG ${d.measurement}` : '';
    case 'startDate': return isoToDmy(d.startDate);
    case 'endDate': return isoToDmy(d.endDate || '');
    case 'reportDate': return isoToDmy(d.reportDate);
    case 'measurementPct': {
      const total = digits(d.contractValue);
      return total > 0 ? `${fmtEs((digits(d.measurement) / total) * 100)}%` : '';
    }
  }
}

function boundPatch(bind: ContractBind, text: string): Partial<ProjectData> | null {
  const money = (t: string) => t.replace(/^\s*PYG\s*/i, '').trim();
  switch (bind) {
    case 'contract': return { contract: text };
    case 'contractor': return { contractor: text };
    case 'contractValue': return { contractValue: money(text) };
    case 'measurement': return { measurement: money(text) };
    case 'startDate': { const iso = dmyToIso(text); return iso ? { startDate: iso } : null; }
    case 'endDate': { const iso = dmyToIso(text); return iso ? { endDate: iso } : null; }
    case 'reportDate': { const iso = dmyToIso(text); return iso ? { reportDate: iso } : null; }
    case 'measurementPct': return null;
  }
}

/* =====================================================================
   Componente
   ===================================================================== */

interface IndValueCellProps {
  it: ContractIndicator;
  isEditing: boolean;
  data: ProjectData;
  rubrics?: RubricItem[];
  vars: FormulaVar[];
  className?: string;
  /** Guarda lo escrito: número (valor in situ) o fórmula */
  onApply: (it: ContractIndicator, text: string) => void;
  /** Lleva el indicador a la barra ƒx (los cálculos se editan solo ahí) */
  onEditCalc: (id: string) => void;
}

/**
 * Valor de un indicador. En la hoja, el número. Editando:
 * - a mano o vinculado: el número se cambia ahí mismo;
 * - calculado: se ve el resultado y un clic lo abre en la barra ƒx (la fórmula
 *   no se escribe dentro del gráfico, que se desarmaba con textos largos).
 */
const IndValueCell: React.FC<IndValueCellProps> = ({ it, isEditing, data, rubrics, vars, className = '', onApply, onEditCalc }) => {
  const eff = getIndicatorEffectiveValue(it, data, rubrics);
  const shown = `${fmtEs(eff.value, 1, 1)}%`;
  if (!isEditing) return <span className={`nt-nowrap font-mono tabular-nums ${className}`}>{shown}</span>;
  if (eff.mode === 'calc') {
    return (
      <button type="button" className={`cmb-calc-val ${className}`} title="Calculado: se cambia en la barra ƒx de abajo"
        onClick={(e) => { e.stopPropagation(); onEditCalc(it.id); }}>
        <span className="cmb-calc-fx">ƒx</span>{shown}
      </button>
    );
  }
  return (
    <span className={`cmb-fx-cell ${className}`} title="Escribí el número; para una fórmula usá la barra ƒx de abajo">
      <FormulaInput value={shown} vars={vars} autoWidth onFocus={() => onEditCalc(it.id)} onCommit={(t) => onApply(it, t)} />
    </span>
  );
};

interface ContractMetricsBlockProps {
  data: ProjectData;
  block?: BlockConfig;
  rubrics?: RubricItem[];
  isEditing?: boolean;
  onUpdateProjectData?: (patch: Partial<ProjectData>) => void;
  onUpdateConfig?: (patch: Partial<BlockConfig>) => void;
  onStartEditing?: () => void;
}

export const ContractMetricsBlock: React.FC<ContractMetricsBlockProps> = ({
  data, block, rubrics, isEditing = false, onUpdateProjectData, onUpdateConfig, onStartEditing,
}) => {
  const rootRef = useRef<HTMLElement>(null);
  const [fieldMenu, setFieldMenu] = useState<{ rowId: string; index: number; rect: DOMRect } | null>(null);
  const [indMenu, setIndMenu] = useState<{ rowId: string; index: number; rect: DOMRect } | null>(null);

  const fields = block?.contractFields ?? DEFAULT_CONTRACT_FIELDS;
  const indicators = block?.contractIndicators ?? DEFAULT_CONTRACT_INDICATORS;
  const style: ContractChartStyle = block?.contractChartStyle ?? 'bars';

  const setFields = (list: ContractField[]) => onUpdateConfig?.({ contractFields: list });
  const setIndicators = (list: ContractIndicator[]) => onUpdateConfig?.({ contractIndicators: list });

  /* ---- Campos ---- */
  const fieldValue = (f: ContractField) => (f.bind ? boundValue(f.bind, data) : f.value);
  const commitFieldValue = (f: ContractField, text: string) => {
    if (f.bind) {
      const patch = boundPatch(f.bind, text);
      if (patch) { onUpdateProjectData?.(patch); return; }
      setFields(fields.map((x) => (x.id === f.id ? { ...x, bind: undefined, value: text } : x)));
      return;
    }
    setFields(fields.map((x) => (x.id === f.id ? { ...x, value: text } : x)));
  };
  const patchField = (id: string, patch: Partial<ContractField>) =>
    setFields(fields.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const fieldOps = useRowOps<ContractField>({
    rows: fields,
    onChange: setFields,
    isEditing,
    idPrefix: 'cf',
    rootRef,
    createRow: () => ({ id: newRowId('cf'), label: 'Nuevo campo', value: '', width: 'full' }),
  });

  /* ---- Indicadores ---- */
  const indEffective = (it: ContractIndicator) => getIndicatorEffectiveValue(it, data, rubrics);
  const indValue = (it: ContractIndicator) => indEffective(it).value;

  /**
   * Permite editar el valor in situ directamente en la celda/gráfico:
   * - Si está vinculado a un campo estándar, sincroniza el campo de datos generales y el indicador.
   * - Si es un cálculo o manual, actualiza el valor y asegura modo manual para respetar el número ingresado.
   */
  const commitIndValue = (it: ContractIndicator, v: number) => {
    const eff = indEffective(it);
    if (eff.mode === 'bind' && it.bind && ['timeProgress', 'financialProgress', 'physicalProgress'].includes(it.bind)) {
      onUpdateProjectData?.({ [it.bind]: v } as Partial<ProjectData>);
      setIndicators(indicators.map((x) => (x.id === it.id ? { ...x, value: v } : x)));
      return;
    }
    // Si era calculado o manual, fijar el valor manual in situ
    setIndicators(indicators.map((x) => (x.id === it.id ? { ...x, sourceMode: 'manual', value: v } : x)));
  };

  /** Lo escrito en un valor o en la barra de fórmulas: vacío = 0, número = valor in situ, si no = fórmula */
  const applyIndText = (it: ContractIndicator, text: string) => {
    // Espacios prolijos: "( @a / @b ) * 100" → "(@a / @b) * 100"
    const raw = text.trim().replace(/^=\s*/, '').replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();
    const plain = raw.replace(/%/g, '').replace(/\s/g, '');
    if (!raw) { commitIndValue(it, 0); return; }
    if (/^-?\d+([.,]\d+)?$/.test(plain)) { commitIndValue(it, parseFloat(plain.replace(',', '.'))); return; }
    patchInd(it.id, { sourceMode: 'calc', calc: { ...it.calc, type: 'custom', formula: raw, opA: undefined, opB: undefined } });
  };

  const patchInd = (id: string, patch: Partial<ContractIndicator>) =>
    setIndicators(indicators.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const setExclusive = (id: string, key: 'primary' | 'reference') =>
    setIndicators(indicators.map((x) => ({ ...x, [key]: x.id === id ? !x[key] : false })));

  const indOps = useRowOps<ContractIndicator>({
    rows: indicators,
    onChange: setIndicators,
    isEditing,
    idPrefix: 'ci',
    createRow: () => ({
      id: newRowId('ci'),
      label: 'Nuevo indicador',
      value: 0,
      sourceMode: 'manual',
      color: PALETTE[indicators.length % PALETTE.length].color,
    }),
  });

  const primary = indicators.find((x) => x.primary);
  const reference = indicators.find((x) => x.reference);
  const deviation = primary && reference && primary.id !== reference.id ? indValue(primary) - indValue(reference) : null;

  /* ---- Render de un campo ---- */
  const renderField = (f: ContractField, idx: number, inBox: boolean, align: 'left' | 'right' = 'left') => (
    <div
      key={f.id}
      className={`nt-item${fieldOps.selected.has(f.id) ? ' row-selected' : ''}${fieldOps.dragOverId === f.id ? ' drag-over' : ''}`}
      style={{
        gridColumn: !inBox && f.width !== 'half' ? '1 / -1' : undefined,
        textAlign: align,
        padding: '1px 3px',
        margin: '-1px -3px',
      }}
      {...fieldOps.dragProps(f.id)}
    >
      <RowGutter ops={fieldOps} id={f.id} isEditing={isEditing}
        onOpenMenu={(rect) => setFieldMenu({ rowId: f.id, index: idx, rect })} />
      <div className="cmb-lbl rp-label" style={inBox ? { color: align === 'left' ? 'var(--rp-primary)' : undefined } : undefined}>
        <EditableCell value={f.label} row={idx} col={0} isEditing={isEditing} placeholder="Título"
          className="nt-inherit-lh" onCommit={(v) => patchField(f.id, { label: v })} />
      </div>
      <div className={`cmb-val rp-value${inBox ? ' big' : ''}`}>
        <EditableCell value={fieldValue(f)} row={idx} col={1} isEditing={isEditing} placeholder="Contenido"
          className="nt-inherit-lh" emptyText="—" onCommit={(v) => commitFieldValue(f, v)} />
      </div>
    </div>
  );

  const fieldNodes: React.ReactNode[] = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (!f.highlight) { fieldNodes.push(renderField(f, i, false)); continue; }
    const group: { f: ContractField; i: number }[] = [];
    while (i < fields.length && fields[i].highlight) { group.push({ f: fields[i], i }); i++; }
    i--;
    fieldNodes.push(
      <div key={`hl-${group[0].f.id}`} className="cmb-highlight rp-highlight">
        {group.map(({ f: g, i: gi }, k) => renderField(g, gi, true, k === 0 ? 'left' : 'right'))}
      </div>
    );
  }

  /* ---- Render de indicadores ---- */
  const indItemProps = (it: ContractIndicator, idx: number, top = false) => ({
    className: `nt-item${top ? ' nt-tools-top' : ''}${indOps.selected.has(it.id) ? ' row-selected' : ''}${indOps.dragOverId === it.id ? ' drag-over' : ''}`,
    ...indOps.dragProps(it.id),
    children: undefined as unknown as React.ReactNode,
    'data-idx': idx,
  });
  const indGutter = (it: ContractIndicator, idx: number) => (
    <RowGutter ops={indOps} id={it.id} isEditing={isEditing}
      onOpenMenu={(rect) => setIndMenu({ rowId: it.id, index: idx, rect })} />
  );
  // ID del indicador seleccionado en la barra de fórmulas unificada
  const [selectedFormulaIndId, setSelectedFormulaIndId] = useState<string>('');

  const safeIndicators = indicators && indicators.length > 0 ? indicators : DEFAULT_CONTRACT_INDICATORS;
  const activeIndId = safeIndicators.some((x) => x.id === selectedFormulaIndId) ? selectedFormulaIndId : (safeIndicators[0]?.id || '');
  const activeInd = safeIndicators.find((x) => x.id === activeIndId) || safeIndicators[0];

  const formulaRef = useRef<FormulaInputHandle>(null);
  /** Lleva un indicador a la barra ƒx (clic en su valor calculado, en su etiqueta o desde el menú) */
  const editInBar = (id: string, focus = true) => {
    setSelectedFormulaIndId(id);
    if (focus) requestAnimationFrame(() => requestAnimationFrame(() => formulaRef.current?.focus()));
  };

  /** Cambia de dónde sale el valor. Al pasar a "a mano" se queda con el valor que mostraba. */
  const setSource = (it: ContractIndicator, src: IndSource) => {
    const cur = indValue(it);
    if (src === 'manual') { patchInd(it.id, { sourceMode: 'manual', value: cur, calc: undefined }); return; }
    if (src === 'formula') {
      const pre = IND_SOURCES.find((x) => x.value === indSourceOf(it))?.formula;
      patchInd(it.id, { sourceMode: 'calc', calc: { type: 'custom', formula: it.calc?.formula || pre || '' } });
      editInBar(it.id);
      return;
    }
    if (src.startsWith('bind:')) {
      patchInd(it.id, { sourceMode: 'bind', bind: src.slice(5) as ContractIndicatorBind, calc: undefined });
      return;
    }
    patchInd(it.id, { sourceMode: 'calc', calc: { type: src as IndicatorCalcConfig['type'] } });
  };
  // Fórmula que se está escribiendo en la barra (para mostrar el resultado en vivo)
  const [formulaDraft, setFormulaDraft] = useState<{ id: string; text: string } | null>(null);

  // Variables para las fórmulas, con su valor actual (mismo listado en la barra y en las celdas)
  const money = (n: number) => (n ? n.toLocaleString('es-PY') : '');
  const pctTxt = (n: unknown) => (Number.isFinite(Number(n)) ? `${fmtEs(Number(n), 1, 1)}%` : '');
  const rubricAvg = (() => {
    const items = (rubrics || []).filter((r) => !r.comment && !r.group);
    return items.length ? items.reduce((a, r) => a + (Number(r.percent) || 0), 0) / items.length : null;
  })();
  const projectVariables: FormulaVar[] = [
    { key: '@monto', label: 'Monto del contrato', value: money(digits(data.contractValue)), type: 'num', group: 'Contrato' },
    { key: '@medicion', label: 'Medición acumulada', value: money(digits(data.measurement)), type: 'num', group: 'Contrato' },
    { key: '@plazo', label: 'Plazo transcurrido (Datos generales)', value: pctTxt(data.timeProgress), type: 'num', group: 'Avance' },
    { key: '@financiero', label: 'Avance financiero (Datos generales)', value: pctTxt(data.financialProgress), type: 'num', group: 'Avance' },
    { key: '@fisico', label: 'Avance físico (Datos generales)', value: pctTxt(data.physicalProgress), type: 'num', group: 'Avance' },
    { key: '@rubros', label: 'Promedio de la tabla de rubros', value: rubricAvg == null ? 'sin rubros' : pctTxt(rubricAvg), type: 'num', group: 'Avance' },
    { key: '@inicio', label: 'Fecha de inicio (O.I.S.)', value: isoToDmy(data.startDate), type: 'date', group: 'Fechas (en días)' },
    { key: '@fin', label: 'Fecha fin prevista', value: isoToDmy(data.endDate || ''), type: 'date', group: 'Fechas (en días)' },
    { key: '@toma_de_muestra', label: 'Fecha del informe', value: isoToDmy(data.reportDate), type: 'date', group: 'Fechas (en días)' },
    { key: '@hoy', label: 'Fecha de hoy', value: isoToDmy(todayIso()), type: 'date', group: 'Fechas (en días)' },
    ...(data.fields || []).filter((f) => f.key).map((f): FormulaVar => {
      const iso = toIsoDate(f.value);
      return { key: `@${f.key.toLowerCase()}`, label: f.label || f.key, value: f.value, type: iso ? 'date' : 'num', group: 'Campos del informe' };
    }),
  ];

  const indLabel = (it: ContractIndicator, idx: number, className = '') => (
    <EditableCell value={it.label} row={100 + idx} col={0} isEditing={isEditing} placeholder="Título"
      className={`nt-inherit-lh ${className}`} onCommit={(v) => patchInd(it.id, { label: v })} />
  );



  /* Etiqueta corta del origen (solo editando). Clic: se edita en la barra ƒx */
  const indBadge = (it: ContractIndicator) => {
    if (!isEditing) return null;
    const eff = indEffective(it);
    const src = indSourceOf(it);
    const short: Record<IndSource, string> = {
      manual: 'a mano', formula: 'ƒx', time_dates: eff.detail || 'fechas', financial_measure: 'medición',
      rubrics_physical: 'rubros', 'bind:timeProgress': 'vinc', 'bind:financialProgress': 'vinc', 'bind:physicalProgress': 'vinc',
      'bind:measurementPct': 'medición', 'bind:rubrics': 'rubros',
    };
    const cls = eff.mode === 'calc' ? 'is-calc' : eff.mode === 'bind' ? 'is-bind' : 'is-manual';
    const Icon = eff.mode === 'calc' ? Calculator : eff.mode === 'bind' ? Link2 : Edit3;
    return (
      <button type="button" className={`cmb-src ${cls}`}
        title={`${IND_SOURCES.find((x) => x.value === src)?.label || 'Calculado'}${it.calc?.formula ? `: ${it.calc.formula}` : ''} · clic para cambiarlo en la barra ƒx`}
        onClick={(e) => { e.stopPropagation(); editInBar(it.id); }}>
        <Icon /><span>{short[src]}</span>
      </button>
    );
  };

  const deviationChip = deviation != null && (
    <StatusPill
      cls={Math.abs(deviation) < 0.5 ? 'pendiente' : deviation > 0 ? 'resuelto' : 'vencido'}
      icon={Math.abs(deviation) < 0.5 ? Minus : deviation > 0 ? TrendingUp : TrendingDown}
    >
      {Math.abs(deviation) < 0.5
        ? `${primary!.label} en línea con ${reference!.label.toLowerCase()}`
        : `${primary!.label} ${fmtEs(Math.abs(deviation), 1, 1)} p.p. ${deviation > 0 ? 'adelante' : 'detrás'}`}
    </StatusPill>
  );

  let chart: React.ReactNode;
  if (style === 'bars') {
    chart = (
      <div className="cmb-panel rp-card" style={{ display: 'flex', flexDirection: 'column', gap: 9, justifyContent: 'center' }}>
        {indicators.map((it, idx) => {
          const v = indValue(it);
          const { children: _c, ...p } = indItemProps(it, idx);
          return (
            <div key={it.id} {...p} style={{ padding: '1px 3px', margin: '-1px -3px' }}>
              {indGutter(it, idx)}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: it.primary ? '8pt' : '7.5pt', fontWeight: it.primary ? 800 : 700, color: '#334155' }}>
                    {indLabel(it, idx)}
                  </span>
                  {indBadge(it)}
                </div>
                <span className="cmb-num" style={{ color: it.color, fontSize: it.primary ? '12pt' : '10pt' }}>
                  <IndValueCell it={it} isEditing={isEditing} data={data} rubrics={rubrics} vars={projectVariables}
                    onApply={applyIndText} onEditCalc={(id) => editInBar(id, false)} />
                </span>
              </div>
              <div className="cmb-bar rp-track" style={{ height: it.primary ? 8 : 6 }}>
                <i className="rp-bar-fill" style={{ width: `${v}%`, background: it.color }} />
                {reference && reference.id !== it.id && (
                  <span className="cmb-refline" style={{ left: `${indValue(reference)}%` }} />
                )}
              </div>
            </div>
          );
        })}
        {(reference || deviationChip) && (
          <div className="cmb-foot">
            {reference ? <span>┆ línea punteada = {reference.label.toLowerCase()}</span> : <span />}
            {deviationChip}
          </div>
        )}
      </div>
    );
  } else if (style === 'rings') {
    chart = (
      <div className="cmb-panel rp-card" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, indicators.length)}, minmax(0, 1fr))`, gap: 6, alignItems: 'start', textAlign: 'center' }}>
        {indicators.map((it, idx) => {
          const v = indValue(it);
          const size = it.primary ? 92 : 76;
          const stroke = it.primary ? 15 : 13;
          const r = (100 - stroke) / 2;
          const { children: _c, ...p } = indItemProps(it, idx, true);
          return (
            <div key={it.id} {...p} style={{ padding: 2 }}>
              {indGutter(it, idx)}
              <div style={{ fontSize: '7pt', fontWeight: it.primary ? 800 : 700, color: it.primary ? '#0f172a' : '#475569', minHeight: '6.5mm', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textTransform: 'uppercase', lineHeight: 1.2 }}>
                {indLabel(it, idx)}
                {indBadge(it)}
              </div>
              <div style={{ position: 'relative', width: size, height: size, margin: '3px auto 0' }}>
                <svg viewBox="0 0 100 100" width={size} height={size} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
                  <GlassRingArc
                    r={r}
                    sw={stroke}
                    color={it.color}
                    value={v}
                    linecap="round"
                    trackColor="var(--rp-track-bg, var(--rp-surface-2))"
                  />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="cmb-num" style={{ fontSize: it.primary ? '11.5pt' : '9.5pt', color: '#1e293b' }}>
                    <IndValueCell it={it} isEditing={isEditing} data={data} rubrics={rubrics} vars={projectVariables}
                    onApply={applyIndText} onEditCalc={(id) => editInBar(id, false)} />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {deviationChip && <div style={{ gridColumn: '1 / -1', marginTop: 2 }}>{deviationChip}</div>}
      </div>
    );
  } else {
    // Anillo triple (concéntrico)
    const n = indicators.length;
    const step = n > 0 ? Math.min(11, 40 / n) : 11;
    chart = (
      <div className="cmb-panel rp-card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ position: 'relative', width: 104, height: 104, flexShrink: 0 }}>
          <svg viewBox="0 0 100 100" width={104} height={104} style={{ transform: 'rotate(-90deg)', display: 'block', overflow: 'visible' }}>
            {indicators.map((it, i) => {
              const r = 45 - i * step;
              const sw = Math.min(step - 2, it.primary ? 9 : 7);
              const v = indValue(it);
              return (
                <GlassRingArc
                  key={it.id}
                  r={r}
                  sw={sw}
                  color={it.color}
                  value={v}
                  linecap="round"
                  trackColor="var(--rp-track-bg, var(--rp-surface-2))"
                />
              );
            })}
          </svg>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 0 }}>
          {indicators.map((it, idx) => {
            const { children: _c, ...p } = indItemProps(it, idx);
            return (
              <div key={it.id} {...p} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '1px 3px', margin: '-1px -3px', fontSize: '8pt', fontWeight: it.primary ? 800 : 600, color: it.primary ? '#0f172a' : '#475569' }}>
                {indGutter(it, idx)}
                <span style={{ width: 9, height: 9, borderRadius: 3, background: it.color, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
                  {indLabel(it, idx)}
                  {indBadge(it)}
                </span>
                <span className="cmb-num" style={{ color: '#0f172a', fontSize: it.primary ? '10pt' : '8.5pt' }}>
                  <IndValueCell it={it} isEditing={isEditing} data={data} rubrics={rubrics} vars={projectVariables}
                    onApply={applyIndText} onEditCalc={(id) => editInBar(id, false)} />
                </span>
              </div>
            );
          })}
          {deviationChip && <div style={{ marginTop: 2 }}>{deviationChip}</div>}
        </div>
      </div>
    );
  }

  /* ---- Menús ---- */
  const fieldExtras = (rowId: string): RowMenuExtra[] => {
    const f = fields.find((x) => x.id === rowId);
    if (!f) return [];
    const out: RowMenuExtra[] = [
      { label: f.width === 'half' ? 'Ancho completo' : 'Media columna', icon: <Ruler />, onClick: () => patchField(rowId, { width: f.width === 'half' ? 'full' : 'half' }) },
      { label: f.highlight ? 'Quitar del recuadro destacado' : 'Mostrar en recuadro destacado', icon: <Star />, onClick: () => patchField(rowId, { highlight: !f.highlight }) },
    ];
    if (f.bind) {
      out.push({
        label: `Desvincular de Datos generales (${BIND_LABEL[f.bind] || f.bind})`,
        icon: <Link2Off />,
        onClick: () => patchField(rowId, { bind: undefined, value: boundValue(f.bind!, data) }),
      });
    } else {
      out.push(
        { label: 'Vincular a Contrato N.º', icon: <Link2 />, onClick: () => patchField(rowId, { bind: 'contract' }) },
        { label: 'Vincular a Contratista', icon: <Link2 />, onClick: () => patchField(rowId, { bind: 'contractor' }) },
        { label: 'Vincular a Monto del contrato', icon: <Link2 />, onClick: () => patchField(rowId, { bind: 'contractValue' }) },
        { label: 'Vincular a Fecha de O.I.S. (Inicio)', icon: <Link2 />, onClick: () => patchField(rowId, { bind: 'startDate' }) },
        { label: 'Vincular a Fecha fin contractual', icon: <Link2 />, onClick: () => patchField(rowId, { bind: 'endDate' }) },
        { label: 'Vincular a Medición acumulada', icon: <Link2 />, onClick: () => patchField(rowId, { bind: 'measurement' }) }
      );
    }
    return out;
  };

  const indExtras = (rowId: string): RowMenuExtra[] => {
    const it = indicators.find((x) => x.id === rowId);
    if (!it) return [];

    const out: RowMenuExtra[] = [
      { label: 'Cambiar cálculo o valor (barra ƒx)', icon: <Calculator />, onClick: () => editInBar(rowId) },
    ];

    out.push(
      { label: it.primary ? 'Quitar destacado' : 'Destacar (más grande)', icon: <Star />, onClick: () => setExclusive(rowId, 'primary') },
      { label: it.reference ? 'Quitar como referencia' : 'Usar como referencia (línea punteada)', icon: <Ruler />, onClick: () => setExclusive(rowId, 'reference') },
      ...PALETTE.map((p) => ({
        label: `Color ${p.name}${it.color === p.color ? ' ✓' : ''}`,
        icon: <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color, display: 'inline-block' }} />,
        onClick: () => patchInd(rowId, { color: p.color }),
      }))
    );

    return out;
  };

  return (
    <section
      ref={rootRef}
      className={`nt-root cmb-root px-5 pt-3 pb-2 select-none shrink-0 border-b border-slate-200${isEditing ? ' nt-editing' : ''}`}
      onClick={(e) => { 
        // Siempre detener la propagación para evitar que el clic abra el panel lateral
        // de "Datos generales" o difumine el fondo innecesariamente.
        e.stopPropagation();
        if (!isEditing) {
          onStartEditing?.(); 
        }
      }}
    >
      <style>{CMB_CSS}</style>

      {isEditing && (
        <>
          <EditDock slot="options">
            <DockGroup label="Gráfico">
              <DockSegmented<ContractChartStyle>
                value={style}
                options={[{ value: 'rings', label: 'Círculos' }, { value: 'triple', label: 'Anillo triple' }, { value: 'bars', label: 'Barras' }]}
                onChange={(v) => onUpdateConfig?.({ contractChartStyle: v })}
              />
            </DockGroup>
            <DockGroup>
              <DockButton variant="primary" onClick={() => fieldOps.addRow(fields.length - 1)}><Plus /> Campo</DockButton>
              <DockButton variant="primary" onClick={() => indOps.addRow(indicators.length - 1)}><Plus /> Indicador</DockButton>
              {(block?.contractFields || block?.contractIndicators) && (
                <DockButton onClick={() => onUpdateConfig?.({ contractFields: undefined, contractIndicators: undefined })}
                  title="Vuelve a los campos e indicadores de fábrica, vinculados a Datos generales">
                  <RotateCcw /> Restablecer
                </DockButton>
              )}
            </DockGroup>

            {/* Barra ƒx: el único lugar donde se elige de dónde sale cada indicador */}
            {activeInd && (() => {
              const src = indSourceOf(activeInd);
              const preset = IND_SOURCES.find((x) => x.value === src)?.formula;
              const current = src === 'formula'
                ? `=${activeInd.calc?.formula || ''}`
                : src === 'manual' ? `${fmtEs(indValue(activeInd), 1, 1)}%` : `=${preset || ''}`;
              const draft = formulaDraft && formulaDraft.id === activeInd.id ? formulaDraft.text : current;
              const draftF = draft.trim().replace(/^=\s*/, '');
              const isF = !!draftF && !/^-?\d+([.,]\d+)?%?$/.test(draftF.replace(/\s/g, ''));
              const live = isF ? evaluateFormula(draftF, data, rubrics) : null;
              // El resultado que se ve es el del indicador (para "plazo por fechas" usa sus fechas propias si las tiene)
              const result = formulaDraft && formulaDraft.id === activeInd.id && live ? live : null;
              const shownVal = result ? (result.detail === 'Error en fórmula' ? null : Math.max(0, Math.min(100, result.value))) : indValue(activeInd);
              return (
                <div className="cmb-fx-bar">
                  <span className="cmb-fx-badge">ƒx</span>
                  <select className="cmb-fx-sel" value={activeInd.id} title="Indicador"
                    onChange={(e) => { setFormulaDraft(null); setSelectedFormulaIndId(e.target.value); }}>
                    {indicators.map((it) => <option key={it.id} value={it.id}>{it.label} · {fmtEs(indValue(it), 1, 1)}%</option>)}
                  </select>
                  <select className="cmb-fx-sel" value={src} title="De dónde sale el valor"
                    onChange={(e) => { setFormulaDraft(null); setSource(activeInd, e.target.value as IndSource); }}>
                    {IND_SOURCES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <div className="cmb-fx-field">
                    <FormulaInput
                      key={`${activeInd.id}|${src}`}
                      ref={formulaRef}
                      value={current}
                      vars={projectVariables}
                      className="w-full"
                      title="Un número (21,7) o una fórmula que empiece con = y use variables @ (escribí @ para ver la lista)"
                      placeholder="21,7  o  =(@medicion / @monto) * 100"
                      onDraft={(t) => setFormulaDraft({ id: activeInd.id, text: t })}
                      onCommit={(t) => { applyIndText(activeInd, t); setFormulaDraft(null); }}
                    />
                    <button type="button" className="cmb-fx-at" title="Insertar una variable"
                      onMouseDown={(e) => e.preventDefault()} onClick={() => formulaRef.current?.mention()}>@</button>
                  </div>
                  <span className={`cmb-fx-res${shownVal == null ? ' is-err' : ''}`} title={result?.detail || ''}>
                    {shownVal == null ? 'error' : `= ${fmtEs(shownVal, 1, 1)}%`}
                  </span>
                </div>
              );
            })()}
          </EditDock>

          <EditDock slot="hint">
            <span>Clic en un valor calculado (ƒx) o en su etiqueta para cambiarlo en la barra</span>
            <span>Escribí <kbd>@</kbd> para las variables</span>
          </EditDock>
          <BulkBar ops={fieldOps} noun={['campo', 'campos']} masculine />
          <BulkBar ops={indOps} noun={['indicador', 'indicadores']} masculine />
        </>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.05fr)', gap: 16, alignItems: 'stretch' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '6px 14px', alignContent: 'start' }}>
          {fieldNodes}
        </div>
        {chart}
      </div>

      <RowMenuFor ops={fieldOps} menu={fieldMenu} onClose={() => setFieldMenu(null)} noun="campo" extra={fieldExtras} />
      <RowMenuFor ops={indOps} menu={indMenu} onClose={() => setIndMenu(null)} noun="indicador" extra={indExtras} />

    </section>
  );
};

const CMB_CSS = `
.cmb-root .cmb-lbl{font-size:6.5pt;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#64748b;line-height:1.35}
.cmb-root .cmb-val{font-size:8.5pt;font-weight:600;color:#0f172a;line-height:1.35;font-variant-numeric:tabular-nums}
.cmb-root .cmb-val.big{font-size:10pt;font-weight:800;color:var(--rp-primary)}
.cmb-root .cmb-highlight{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;gap:12px;background:var(--rp-highlight-bg);border:1px solid var(--rp-highlight-border);border-radius:var(--rp-radius-sm);padding:6px 9px}
.cmb-root .cmb-highlight>.nt-item:not(:first-child) .cmb-val.big{color:#0f172a}
.cmb-root .cmb-panel{border:1px solid var(--rp-line);border-radius:var(--rp-radius);padding:10px 12px}
.cmb-root .cmb-num{font-weight:800;font-variant-numeric:tabular-nums;line-height:1.1}
.cmb-root .cmb-bar{position:relative;background:var(--rp-surface-2);border-radius:999px}
.cmb-root .cmb-bar>i{position:absolute;left:0;top:0;bottom:0;border-radius:999px}
.cmb-root .cmb-refline{position:absolute;top:-4px;bottom:-4px;border-left:2px dashed var(--rp-ind-1)}
.cmb-root .cmb-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;border-top:1px dashed var(--rp-line);padding-top:7px;font-size:7pt;color:#64748b}
@media print{.cmb-root,.cmb-root *{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.cmb-root .cmb-src{display:inline-flex;align-items:center;gap:2px;margin-left:5px;padding:0 4px;height:13px;border-radius:4px;border:1px solid;font:600 6pt/1 ui-monospace,monospace;vertical-align:middle;cursor:pointer;white-space:nowrap;max-width:62px;overflow:hidden;flex-shrink:0}
.cmb-root .cmb-src svg{width:8px;height:8px;flex-shrink:0}
.cmb-root .cmb-src span{overflow:hidden;text-overflow:ellipsis}
.cmb-root .cmb-src.is-calc{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe}
.cmb-root .cmb-src.is-bind{background:#ecfdf5;color:#047857;border-color:#a7f3d0}
.cmb-root .cmb-src.is-manual{background:#f8fafc;color:#64748b;border-color:#e2e8f0}
.cmb-root .cmb-calc-val{font:inherit;color:inherit;background:transparent;border:0;padding:0 2px;border-radius:4px;cursor:pointer;display:inline-flex;align-items:baseline;gap:3px;white-space:nowrap}
.cmb-root .cmb-calc-val:hover{background:#eff6ff}
.cmb-root .cmb-calc-fx{font:italic 700 .62em/1 Georgia,serif;color:#2563eb}
.cmb-root .cmb-fx-cell input{max-width:9ch;text-align:right;border-radius:4px;padding:0 2px}
.cmb-root .cmb-fx-cell input:hover{background:#f1f5f9}
.cmb-root .cmb-fx-cell input:focus{background:#fff;box-shadow:0 0 0 1px #60a5fa}
.cmb-fx-bar{display:flex;align-items:center;gap:6px;width:100%;flex-wrap:wrap}
.cmb-fx-badge{font:italic 700 13px/1 Georgia,serif;color:#fcd34d;padding:0 2px}
.cmb-fx-sel{height:26px;max-width:210px;border-radius:6px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:#fff;font-size:11px;font-weight:600;padding:0 6px;cursor:pointer}
.cmb-fx-sel option{color:#0f172a}
.cmb-fx-field{flex:1;min-width:200px;display:flex;align-items:center;height:26px;border-radius:6px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);padding:0 3px 0 8px;color:#fff;font:12px/1 ui-monospace,SFMono-Regular,Menlo,monospace}
.cmb-fx-field:focus-within{background:rgba(255,255,255,.16);border-color:#fcd34d}
.cmb-fx-field input::placeholder{color:rgba(255,255,255,.4)}
.cmb-fx-at{flex-shrink:0;width:20px;height:20px;border-radius:5px;border:0;background:rgba(255,255,255,.12);color:#fcd34d;font:700 12px/1 ui-monospace,monospace;cursor:pointer}
.cmb-fx-at:hover{background:rgba(255,255,255,.22)}
.cmb-fx-res{flex-shrink:0;min-width:64px;text-align:right;font:700 12px/1 ui-monospace,monospace;color:#fff;background:rgba(255,255,255,.1);border-radius:6px;padding:7px 8px}
.cmb-fx-res.is-err{color:#fca5a5}
`;

