import { chartWidthMm } from '../../utils/pageSetup';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { SCurvePeriodItem } from '../../types';
import { SectionHeaderBanner } from '../SectionHeaderBanner';
import { EditDock, DockButton, DockGroup, DockSegmented, DockSlider, DockCheck } from '../EditDock';
import {
  EditableCell, NumberCell, useRowOps, NumHeader, NumCell, RowMenuFor, BulkBar, TableHint,
  newRowId, fmtNum,
} from '@/src/components/table/NotionTable';
import {
  Plus, TrendingUp, TrendingDown, FileSpreadsheet, Target, Activity, Minus, Eraser,
} from 'lucide-react';
import { CsvImportButton } from '@/src/components/table/CsvImport';
import { CsvField, csvNumber } from '../../utils/csv';
import { GlassRingArc } from '../GlassRingArc';

const SCURVE_CSV_FIELDS: CsvField[] = [
  { key: 'period', label: 'Período', keywords: ['periodo', 'mes', 'period', 'fecha'] },
  { key: 'planned', label: 'Prog. mes %', keywords: ['prog', 'planif', 'previsto', 'planned'], numeric: true },
  { key: 'actual', label: 'Real mes %', keywords: ['real', 'ejecut', 'actual'], numeric: true },
];

/* =====================================================================
   Tipos y constantes
   ===================================================================== */

export type SCurveKpiVariant = 'cards' | 'strip' | 'rings' | 'panel';

export const SCURVE_KPI_VARIANTS: { value: SCurveKpiVariant; label: string }[] = [
  { value: 'cards', label: 'Tarjetas' },
  { value: 'strip', label: 'Franja' },
  { value: 'rings', label: 'Anillos' },
  { value: 'panel', label: 'Panel' },
];

export const SCURVE_CHART_HEIGHT = { min: 30, max: 90, step: 1, default: 52 };
/* Ancho útil del gráfico: chartWidthMm() (194 mm en A4 vertical), para convertir mm a unidades del viewBox */


interface SCurveBlockProps {
  blockId: string;
  title: string;
  numberIndex?: number | null;
  showTitle?: boolean;
  data?: SCurvePeriodItem[];
  showIndicators?: boolean;
  showTable?: boolean;
  kpiVariant?: SCurveKpiVariant;
  /** Alto del gráfico en mm (por defecto 52) */
  chartHeightMm?: number;
  isEditing?: boolean;
  onUpdateTitle?: (title: string) => void;
  onToggleShowTitle?: () => void;
  onToggleShowIndicators?: () => void;
  onToggleShowTable?: () => void;
  onChangeKpiVariant?: (variant: SCurveKpiVariant) => void;
  onChangeChartHeight?: (mm: number) => void;
  onUpdateData?: (data: SCurvePeriodItem[]) => void;
  onStartEditing?: () => void;
}

export const DEFAULT_SCURVE_PERIODS: SCurvePeriodItem[] = [
  { id: 'sc-1', period: 'Mes 1 (Sep)', plannedPercent: 4.0, plannedCumulative: 4.0, actualPercent: 4.0, actualCumulative: 4.0 },
  { id: 'sc-2', period: 'Mes 2 (Oct)', plannedPercent: 8.5, plannedCumulative: 12.5, actualPercent: 7.2, actualCumulative: 11.2 },
  { id: 'sc-3', period: 'Mes 3 (Nov)', plannedPercent: 14.0, plannedCumulative: 26.5, actualPercent: 12.0, actualCumulative: 23.2 },
  { id: 'sc-4', period: 'Mes 4 (Dic)', plannedPercent: 19.5, plannedCumulative: 46.0 },
  { id: 'sc-5', period: 'Mes 5 (Ene)', plannedPercent: 22.0, plannedCumulative: 68.0 },
  { id: 'sc-6', period: 'Mes 6 (Feb)', plannedPercent: 17.0, plannedCumulative: 85.0 },
  { id: 'sc-7', period: 'Mes 7 (Mar)', plannedPercent: 10.0, plannedCumulative: 95.0 },
  { id: 'sc-8', period: 'Mes 8 (Abr)', plannedPercent: 5.0, plannedCumulative: 100.0 },
];

/* =====================================================================
   Estilos propios del bloque (indicadores y gráfico). La tabla usa el kit compartido.
   ===================================================================== */

const SCB_STYLE_ID = 'scb-styles-v2';
const SCB_CSS = `
.scb-root *{box-sizing:border-box}
/* KPI A · Tarjetas */
.scb-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px}
.scb-kpi{--accent:var(--rp-primary);--soft:var(--rp-primary-soft);position:relative;background:#fff;border:1px solid var(--rp-line);border-radius:var(--rp-radius);padding:10px 12px 12px 14px;box-shadow:0 1px 2px rgba(0,0,0,.04);display:flex;flex-direction:column;gap:7px;overflow:hidden}
.scb-kpi::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--accent)}
.scb-kpi-top{display:flex;align-items:center;justify-content:space-between;gap:6px;min-height:20px}
.scb-kpi-lbl{font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#64748b;display:inline-flex;align-items:center;gap:6px}
.scb-kpi-ic{width:20px;height:20px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;background:var(--soft);color:var(--accent);flex-shrink:0}
.scb-kpi-ic svg{width:12px;height:12px}
.scb-kpi-val{font-size:22px;font-weight:800;letter-spacing:-.02em;color:#0f172a;font-variant-numeric:tabular-nums;line-height:1}
.scb-kpi-val small{font-size:12px;font-weight:700;color:#94a3b8;margin-left:2px;letter-spacing:0}
.scb-kpi-sub{font-size:10px;color:#64748b;font-weight:500;display:flex;justify-content:space-between;gap:6px}
.scb-kpi-sub b{color:#334155;font-weight:700;font-variant-numeric:tabular-nums}
.scb-kpi-bar{position:relative;height:6px;background:var(--rp-surface-2);border-radius:999px}
.scb-kpi-bar-fill{height:100%;border-radius:999px;background:var(--accent);transition:width .45s ease}
.scb-kpi-bar-mark{position:absolute;top:-3px;width:2px;height:12px;margin-left:-1px;background:var(--rp-primary);border-radius:1px;box-shadow:0 0 0 1.5px #fff;transition:left .45s ease}
.scb-kpi-div{position:relative;height:6px;background:var(--rp-surface-2);border-radius:999px}
.scb-kpi-div::after{content:'';position:absolute;left:50%;top:-3px;width:2px;height:12px;margin-left:-1px;background:#94a3b8;border-radius:1px}
.scb-kpi-div-fill{position:absolute;top:0;height:100%;background:var(--accent);transition:width .45s ease}
.scb-kpi-div-fill.right{left:50%;border-radius:0 999px 999px 0}
.scb-kpi-div-fill.left{right:50%;border-radius:999px 0 0 999px}
.scb-kpi-chip{font-size:9px;font-weight:700;padding:2px 7px;border-radius:4px;border:1px solid;white-space:nowrap;background:var(--soft);color:var(--accent);border-color:color-mix(in srgb,var(--accent) 30%,transparent)}
.scb-kpi.real{--accent:var(--rp-real);--soft:color-mix(in srgb,var(--rp-real) 9%,#fff)}.scb-kpi.pos{--accent:#059669;--soft:#ecfdf5}
.scb-kpi.neg{--accent:#e11d48;--soft:#fff1f2}
.scb-kpi.neutral{--accent:#64748b;--soft:var(--rp-surface-2)}
.scb-kpi.pos .scb-kpi-val{color:#047857}
.scb-kpi.neg .scb-kpi-val{color:#be123c}

/* KPI B · Franja */
.scb-strip{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--rp-line);border-radius:var(--rp-radius);background:#fff;overflow:hidden;margin-bottom:12px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.scb-strip-cell{position:relative;padding:10px 14px 12px;border-right:1px solid var(--rp-line);display:flex;align-items:center;justify-content:space-between;gap:10px}
.scb-strip-cell:last-child{border-right:0}
.scb-ks-lbl{font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#64748b}
.scb-ks-sub{font-size:10px;color:#94a3b8;margin-top:3px;display:flex;align-items:center;gap:5px}
.scb-ks-val{font-size:20px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1;white-space:nowrap}
.scb-ks-val small{font-size:11px;font-weight:700;color:#94a3b8;margin-left:2px;letter-spacing:0}
.scb-ks-val.plan{color:var(--rp-primary)}.scb-ks-val.real,.scb-ks-val.pos{color:#047857}.scb-ks-val.neg{color:#be123c}.scb-ks-val.neutral{color:#475569}
.scb-ks-line{position:absolute;left:0;bottom:0;height:3px;transition:width .45s ease}
.scb-ks-dot{width:6px;height:6px;border-radius:50%;display:inline-block}
.scb-ks-dot.pos{background:#059669}.scb-ks-dot.neg{background:#e11d48}.scb-ks-dot.neutral{background:#94a3b8}

/* KPI C · Anillos */
.scb-ring{display:grid;grid-template-columns:auto 1fr 1fr;gap:18px;align-items:center;background:#fff;border:1px solid var(--rp-line);border-radius:var(--rp-radius);padding:12px 16px;margin-bottom:12px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.scb-ring-chart{width:104px;height:104px;position:relative}
.scb-ring-chart svg{width:100%;height:100%;display:block}
.scb-ring-chart circle.arc{transition:stroke-dasharray .45s ease}
.scb-ring-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}
.scb-ring-center b{font-size:17px;font-weight:800;color:#0f172a;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.scb-ring-center span{font-size:8px;font-weight:700;color:#94a3b8;letter-spacing:.08em;text-transform:uppercase;margin-top:3px}
.scb-ring-list{display:flex;flex-direction:column;gap:8px}
.scb-kr-row{display:flex;align-items:center;gap:8px;font-size:11px;color:#475569;font-weight:600}
.scb-kr-row b{margin-left:auto;font-size:14px;font-weight:800;color:#0f172a;font-variant-numeric:tabular-nums}
.scb-kr-sw{width:10px;height:10px;border-radius:3px;flex-shrink:0}
.scb-kr-sw.plan{background:var(--rp-primary)}.scb-kr-sw.real{background:var(--rp-real)}
.scb-kr-note{font-size:10px;color:#94a3b8;border-top:1px dashed var(--rp-line);padding-top:6px}
.scb-ring-dev{border-left:1px solid var(--rp-line);padding-left:18px;display:flex;flex-direction:column;gap:6px}
.scb-kd-val{font-size:24px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1}
.scb-kd-val small{font-size:12px;color:#94a3b8;margin-left:2px;font-weight:700;letter-spacing:0}
.scb-ring-dev.pos .scb-kd-val{color:#047857}.scb-ring-dev.neg .scb-kd-val{color:#be123c}.scb-ring-dev.neutral .scb-kd-val{color:#475569}
.scb-kd-chip{align-self:flex-start;display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:700;padding:2px 7px;border-radius:4px;border:1px solid}
.scb-kd-chip svg{width:11px;height:11px}
.scb-kd-chip.pos{background:#ecfdf5;color:#065f46;border-color:#a7f3d0}
.scb-kd-chip.neg{background:#fff1f2;color:#9f1239;border-color:#fecdd3}
.scb-kd-chip.neutral{background:var(--rp-surface-2);color:#334155;border-color:var(--rp-line)}
.scb-kd-sub{font-size:10px;color:#64748b}
.scb-kd-sub b{color:#334155;font-variant-numeric:tabular-nums}

/* KPI D · Panel oscuro */
.scb-panel{display:grid;grid-template-columns:230px 1fr;gap:22px;align-items:center;background:linear-gradient(135deg,var(--rp-primary) 0%,var(--rp-primary-dark) 100%);color:#fff;border-radius:var(--rp-radius-lg);padding:16px 20px;margin-bottom:12px;box-shadow:0 8px 20px rgba(11,69,91,.18)}
.scb-kp-lbl{font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.6)}
.scb-kp-val{font-size:34px;font-weight:800;letter-spacing:-.03em;line-height:1;margin:6px 0 10px;font-variant-numeric:tabular-nums}
.scb-kp-val small{font-size:15px;color:rgba(255,255,255,.55);margin-left:2px;letter-spacing:0}
.scb-kp-chip{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;padding:3px 9px;border-radius:999px}
.scb-kp-chip svg{width:12px;height:12px}
.scb-kp-chip.pos{background:rgba(52,211,153,.16);color:#6ee7b7}
.scb-kp-chip.neg{background:rgba(251,113,133,.16);color:#fda4af}
.scb-kp-chip.neutral{background:rgba(255,255,255,.1);color:#cbd5e1}
.scb-kp-bars{display:flex;flex-direction:column;gap:10px;border-left:1px solid rgba(255,255,255,.12);padding-left:22px}
.scb-kp-row{display:grid;grid-template-columns:86px 1fr 50px;gap:10px;align-items:center;font-size:11px;color:rgba(255,255,255,.75);font-weight:600}
.scb-kp-row b{text-align:right;color:#fff;font-variant-numeric:tabular-nums}
.scb-kp-track{height:8px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden}
.scb-kp-fill{height:100%;border-radius:999px;transition:width .45s ease}
.scb-kp-fill.plan{background:rgba(255,255,255,.75)}
.scb-kp-fill.real{background:#34d399}
.scb-kp-foot{display:flex;gap:16px;flex-wrap:wrap;font-size:10px;color:rgba(255,255,255,.55);padding-top:2px}
.scb-kp-foot b{color:#fff;font-variant-numeric:tabular-nums}

/* Gráfico */
.scb-chart{background:color-mix(in srgb,var(--rp-surface-1) 50%,transparent);border:1px solid var(--rp-line);border-radius:8px;padding:8px;margin-bottom:10px}
.scb-chart-head{display:flex;align-items:center;justify-content:space-between;padding:0 8px 4px;font-size:7.5pt;border-bottom:1px solid rgba(226,232,240,.8);margin-bottom:4px;gap:8px;flex-wrap:wrap}
.scb-chart-title{font-weight:700;color:var(--rp-primary);text-transform:uppercase;letter-spacing:.025em;display:inline-flex;align-items:center;gap:6px}
.scb-chart-title svg{width:14px;height:14px}
.scb-chart-legend{display:flex;align-items:center;gap:12px}
.scb-lg{display:inline-flex;align-items:center;gap:4px;font-weight:600;color:#475569}
.scb-lg.real{color:#047857}
.scb-lg-line{width:12px;height:2px;background:var(--rp-primary);display:inline-block}
.scb-lg-dot{width:8px;height:8px;border-radius:50%;background:var(--rp-real);display:inline-block}
.scb-plot{width:100%;height:auto;overflow:visible;user-select:none;display:block}
.scb-ax-lbl{font-size:6.5pt;fill:#94a3b8;font-family:var(--rp-font-num);font-weight:600}
.scb-x-lbl{font-size:6.5pt;fill:#475569;font-weight:500}

/* Columnas calculadas de la tabla */
.scb-root .nt-tbl tbody td.calc{font-family:var(--rp-font-num);font-weight:700;text-align:center}
.scb-root .nt-tbl tbody td.calc-plan{background-image:linear-gradient(color-mix(in srgb,var(--rp-primary) 5%,transparent),color-mix(in srgb,var(--rp-primary) 5%,transparent));color:var(--rp-primary)}
.scb-root .nt-tbl tbody td.calc-real{background-image:linear-gradient(rgba(5,150,105,.07),rgba(5,150,105,.07));color:#064e3b}
.scb-root .nt-tbl tbody td.pct{font-family:var(--rp-font-num);text-align:center;font-weight:700}
.scb-root .nt-tbl tbody td.pct.plan{color:var(--rp-primary)}
.scb-root .nt-tbl tbody td.pct.real{color:#047857}
.scb-root .nt-tbl tbody td.per{font-weight:700;color:#1e293b}
.scb-dv-pos{color:#047857}.scb-dv-neg{color:#e11d48}.scb-muted{color:#cbd5e1;font-weight:500}

@media print{
  .scb-root,.scb-root *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .scb-root .scb-kpi,.scb-root .scb-panel,.scb-root .scb-chart{box-shadow:none}
}
`;

function useScbStyles() {
  useLayoutEffect(() => {
    if (typeof document === 'undefined' || document.getElementById(SCB_STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = SCB_STYLE_ID;
    el.textContent = SCB_CSS;
    document.head.appendChild(el);
  }, []);
}

const recomputeCumulative = (list: SCurvePeriodItem[]): SCurvePeriodItem[] => {
  let pCum = 0;
  let aCum = 0;
  return list.map((item) => {
    pCum = Math.min(100, Number((pCum + (item.plannedPercent || 0)).toFixed(1)));
    let actCum: number | undefined;
    if (item.actualPercent != null && !isNaN(item.actualPercent)) {
      aCum = Math.min(100, Number((aCum + item.actualPercent).toFixed(1)));
      actCum = aCum;
    }
    return { ...item, plannedCumulative: pCum, actualCumulative: actCum };
  });
};

/* =====================================================================
   Indicadores KPI (4 variantes)
   ===================================================================== */

interface KpiMetrics {
  plan: number;
  real: number;
  variance: number;
  devState: 'pos' | 'neg' | 'neutral';
  devLabel: string;
  perfIndex: number | null;
  devWidth: number;
  period: string | null;
  recorded: number;
  total: number;
  hasData: boolean;
}

const KpiPanel: React.FC<{ variant: SCurveKpiVariant; m: KpiMetrics }> = ({ variant, m }) => {
  const f = (v: number) => v.toFixed(1);
  const pct = (v: number) => `${Math.max(0, Math.min(100, v))}%`;
  const DevIcon = m.devState === 'pos' ? TrendingUp : m.devState === 'neg' ? TrendingDown : Minus;
  const sign = m.variance > 0 ? '+' : '';
  const idx = m.perfIndex != null ? m.perfIndex.toFixed(2) : '—';

  if (variant === 'strip') {
    return (
      <div className="scb-strip">
        <div className="scb-strip-cell">
          <div>
            <div className="scb-ks-lbl">Programado</div>
            <div className="scb-ks-sub">al corte · {m.period || '—'}</div>
          </div>
          <div className="scb-ks-val plan">{f(m.plan)}<small>%</small></div>
          <span className="scb-ks-line" style={{ width: pct(m.plan), background: 'var(--rp-primary)' }} />
        </div>
        <div className="scb-strip-cell">
          <div>
            <div className="scb-ks-lbl">Real ejecutado</div>
            <div className="scb-ks-sub">{m.recorded} de {m.total} períodos</div>
          </div>
          <div className="scb-ks-val real">{f(m.real)}<small>%</small></div>
          <span className="scb-ks-line" style={{ width: pct(m.real), background: 'var(--rp-real)' }} />
        </div>
        <div className="scb-strip-cell">
          <div>
            <div className="scb-ks-lbl">Desvío</div>
            <div className="scb-ks-sub"><span className={`scb-ks-dot ${m.devState}`} />{m.devLabel} · índice {idx}</div>
          </div>
          <div className={`scb-ks-val ${m.devState}`}>{sign}{f(m.variance)}<small>p.p.</small></div>
        </div>
      </div>
    );
  }

  if (variant === 'rings') {
    const rO = 42, rI = 31;
    return (
      <div className="scb-ring">
        <div className="scb-ring-chart">
          <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
            <GlassRingArc
              r={rO}
              sw={7}
              color="var(--rp-primary)"
              value={m.plan}
              linecap="round"
              trackColor="var(--rp-track-bg, var(--rp-primary-soft))"
            />
            <GlassRingArc
              r={rI}
              sw={7}
              color="var(--rp-real)"
              value={m.real}
              linecap="round"
              trackColor="var(--rp-track-bg, #ecfdf5)"
            />
          </svg>
          <div className="scb-ring-center"><b>{f(m.real)}%</b><span>Real</span></div>
        </div>
        <div className="scb-ring-list">
          <div className="scb-kr-row"><span className="scb-kr-sw plan" />Avance programado<b>{f(m.plan)}%</b></div>
          <div className="scb-kr-row"><span className="scb-kr-sw real" />Avance real ejecutado<b>{f(m.real)}%</b></div>
          <div className="scb-kr-note">Corte: {m.period || '—'} · {m.recorded} de {m.total} períodos con registro</div>
        </div>
        <div className={`scb-ring-dev ${m.devState}`}>
          <span className="scb-ks-lbl">Desvío de avance</span>
          <div className="scb-kd-val">{sign}{f(m.variance)}<small>p.p.</small></div>
          <span className={`scb-kd-chip ${m.devState}`}><DevIcon />{m.devLabel}</span>
          <span className="scb-kd-sub">Índice real / programado <b>{idx}</b></span>
        </div>
      </div>
    );
  }

  if (variant === 'panel') {
    return (
      <div className="scb-panel">
        <div>
          <div className="scb-kp-lbl">Avance real ejecutado</div>
          <div className="scb-kp-val">{f(m.real)}<small>%</small></div>
          <span className={`scb-kp-chip ${m.devState}`}><DevIcon />{sign}{f(m.variance)} p.p. · {m.devLabel}</span>
        </div>
        <div className="scb-kp-bars">
          <div className="scb-kp-row">
            <span>Programado</span>
            <div className="scb-kp-track rp-track"><div className="scb-kp-fill plan rp-bar-fill" style={{ width: pct(m.plan) }} /></div>
            <b>{f(m.plan)}%</b>
          </div>
          <div className="scb-kp-row">
            <span>Real</span>
            <div className="scb-kp-track rp-track"><div className="scb-kp-fill real rp-bar-fill" style={{ width: pct(m.real) }} /></div>
            <b>{f(m.real)}%</b>
          </div>
          <div className="scb-kp-foot">
            <span>Corte <b>{m.period || '—'}</b></span>
            <span>Índice real/prog. <b>{idx}</b></span>
            <span>Registros <b>{m.recorded}/{m.total}</b></span>
          </div>
        </div>
      </div>
    );
  }

  // 'cards' (por defecto)
  return (
    <div className="scb-kpis">
      <div className="scb-kpi plan">
        <div className="scb-kpi-top">
          <span className="scb-kpi-lbl"><span className="scb-kpi-ic"><Target /></span>Avance programado</span>
        </div>
        <div className="scb-kpi-val">{f(m.plan)}<small>%</small></div>
        <div className="scb-kpi-bar rp-track"><div className="scb-kpi-bar-fill rp-bar-fill" style={{ width: pct(m.plan) }} /></div>
        <div className="scb-kpi-sub"><span>Acumulado a la fecha</span><b>{m.period || '—'}</b></div>
      </div>
      <div className="scb-kpi real">
        <div className="scb-kpi-top">
          <span className="scb-kpi-lbl"><span className="scb-kpi-ic"><Activity /></span>Avance real ejecutado</span>
        </div>
        <div className="scb-kpi-val">{f(m.real)}<small>%</small></div>
        <div className="scb-kpi-bar rp-track" title={`Marca: programado ${f(m.plan)}%`}>
          <div className="scb-kpi-bar-fill rp-bar-fill" style={{ width: pct(m.real) }} />
          {m.hasData && <span className="scb-kpi-bar-mark" style={{ left: pct(m.plan) }} />}
        </div>
        <div className="scb-kpi-sub"><span>Períodos con registro</span><b>{m.recorded} de {m.total}</b></div>
      </div>
      <div className={`scb-kpi ${m.devState}`}>
        <div className="scb-kpi-top">
          <span className="scb-kpi-lbl"><span className="scb-kpi-ic"><DevIcon /></span>Desvío de avance</span>
          <span className="scb-kpi-chip">{m.devLabel}</span>
        </div>
        <div className="scb-kpi-val">{sign}{f(m.variance)}<small>p.p.</small></div>
        <div className="scb-kpi-div rp-track" title="Escala ±20 p.p.">
          {m.hasData && Math.abs(m.variance) >= 0.05 && (
            <div className={`scb-kpi-div-fill rp-bar-fill ${m.variance >= 0 ? 'right' : 'left'}`} style={{ width: `${m.devWidth}%` }} />
          )}
        </div>
        <div className="scb-kpi-sub"><span>Índice real / programado</span><b>{idx}</b></div>
      </div>
    </div>
  );
};


/* =====================================================================
   Bloque principal
   ===================================================================== */

export const SCurveBlock: React.FC<SCurveBlockProps> = ({
  blockId,
  title,
  numberIndex,
  showTitle = true,
  data,
  showIndicators = true,
  showTable = true,
  kpiVariant = 'cards',
  chartHeightMm = SCURVE_CHART_HEIGHT.default,
  isEditing = false,
  onUpdateTitle,
  onToggleShowTitle,
  onToggleShowIndicators,
  onToggleShowTable,
  onChangeKpiVariant,
  onChangeChartHeight,
  onUpdateData,
  onStartEditing,
}) => {
  useScbStyles();

  const periods = data ?? DEFAULT_SCURVE_PERIODS;
  const rootRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ rowId: string; index: number; rect: DOMRect } | null>(null);

  const update = (list: SCurvePeriodItem[]) => onUpdateData?.(recomputeCumulative(list));

  const ops = useRowOps<SCurvePeriodItem>({
    rows: periods,
    onChange: update,
    isEditing,
    idPrefix: 'sc',
    rootRef,
    createRow: () => ({ id: newRowId('sc'), period: `Mes ${periods.length + 1}`, plannedPercent: 0, plannedCumulative: 0 }),
  });

  const change = (id: string, patch: Partial<SCurvePeriodItem>) =>
    update(periods.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  /* ---- KPIs ---- */
  const recorded = periods.filter((p) => p.actualCumulative != null && !isNaN(p.actualCumulative));
  const latest = recorded[recorded.length - 1] || null;
  const currentActualCum = latest?.actualCumulative ?? 0;
  const correspondingPlannedCum = latest?.plannedCumulative ?? 0;
  const variance = currentActualCum - correspondingPlannedCum;
  const devState: KpiMetrics['devState'] = !latest ? 'neutral' : Math.abs(variance) < 0.5 ? 'neutral' : variance > 0 ? 'pos' : 'neg';
  const metrics: KpiMetrics = {
    plan: correspondingPlannedCum,
    real: currentActualCum,
    variance,
    devState,
    devLabel: !latest ? 'Sin datos' : devState === 'neutral' ? 'En línea' : devState === 'pos' ? 'Adelantado' : 'Atrasado',
    perfIndex: correspondingPlannedCum > 0 ? currentActualCum / correspondingPlannedCum : null,
    devWidth: Math.min(50, (Math.abs(variance) / 20) * 50), // escala ±20 p.p.
    period: latest?.period ?? null,
    recorded: recorded.length,
    total: periods.length,
    hasData: !!latest,
  };

  /* ---- Geometría del gráfico ---- */
  const chartMm = Math.max(SCURVE_CHART_HEIGHT.min, Math.min(SCURVE_CHART_HEIGHT.max, chartHeightMm));
  const svgWidth = 600, svgHeight = Math.round((chartMm * svgWidth) / chartWidthMm());
  const padL = 40, padR = 20, padT = 15, padB = 25;
  const cW = svgWidth - padL - padR;
  const cH = svgHeight - padT - padB;
  const n = periods.length;
  const getX = (i: number) => (n <= 1 ? padL + cW / 2 : padL + (i / (n - 1)) * cW);
  const getY = (v: number) => padT + cH - (Math.max(0, Math.min(100, v)) / 100) * cH;
  const plannedPoints = periods.map((p, i) => ({ x: getX(i), y: getY(p.plannedCumulative) }));
  const actualPoints = recorded.map((p) => ({ x: getX(periods.findIndex((o) => o.id === p.id)), y: getY(p.actualCumulative!) }));
  const toPath = (pts: { x: number; y: number }[]) => pts.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
  const plannedPathD = toPath(plannedPoints);
  const actualPathD = toPath(actualPoints);
  const plannedAreaD = plannedPoints.length > 0
    ? `${plannedPathD} L ${plannedPoints[plannedPoints.length - 1].x} ${padT + cH} L ${plannedPoints[0].x} ${padT + cH} Z`
    : '';
  const gradientId = `scb-planned-fill-${blockId}`;

  return (
    <div ref={rootRef} className="scb-root nt-root scurve-block relative px-5 py-2 shrink-0">
      <SectionHeaderBanner
        numberIndex={numberIndex}
        title={title}
        isEditing={isEditing}
        showTitle={showTitle}
        onUpdateTitle={onUpdateTitle}
        onToggleShowTitle={onToggleShowTitle}
        onStartEditing={onStartEditing}
      />

      {/* Opciones de edición → panel flotante (no ocupan lugar en la hoja) */}
      {isEditing && (
        <>
          <EditDock slot="options">
            <DockGroup>
              <DockCheck label="Indicadores" checked={showIndicators} onChange={() => onToggleShowIndicators?.()} />
              <DockCheck label="Tabla" checked={showTable} onChange={() => onToggleShowTable?.()} />
            </DockGroup>
            {showIndicators && onChangeKpiVariant && (
              <DockGroup label="Estilo KPI">
                <DockSegmented value={kpiVariant} options={SCURVE_KPI_VARIANTS} onChange={onChangeKpiVariant} />
              </DockGroup>
            )}
            {onChangeChartHeight && (
              <DockSlider label="Alto gráfico" value={chartMm} min={SCURVE_CHART_HEIGHT.min}
                max={SCURVE_CHART_HEIGHT.max} step={SCURVE_CHART_HEIGHT.step} unit="mm" onChange={onChangeChartHeight} />
            )}
            <DockGroup>
              <DockButton variant="primary" onClick={() => ops.addRow(periods.length - 1)}><Plus /> Agregar mes</DockButton>
              <CsvImportButton<SCurvePeriodItem>
                fields={SCURVE_CSV_FIELDS}
                templateName="curva-s"
                title="períodos de la Curva S"
                sampleRows={[['Mes 1 (Sep)', '4,0', '4,0'], ['Mes 2 (Oct)', '8,5', '']]}
                toRow={(rec) => {
                  const prog = csvNumber(rec.planned);
                  if (!rec.period || prog == null) return null;
                  return { id: newRowId('sc'), period: rec.period, plannedPercent: prog, plannedCumulative: 0, actualPercent: csvNumber(rec.actual) };
                }}
                onImport={(rows, mode) => update(mode === 'append' ? [...periods, ...rows] : rows)}
              />
              <DockButton onClick={() => update(periods.map((p) => ({ ...p, actualPercent: undefined })))}
                title="Borra los avances reales de todos los meses">
                <Eraser /> Limpiar reales
              </DockButton>
            </DockGroup>
          </EditDock>
          <TableHint />
          <BulkBar ops={ops} noun={['mes', 'meses']} masculine />
        </>
      )}

      {showIndicators && <KpiPanel variant={kpiVariant} m={metrics} />}

      <div className="scb-chart">
        <div className="scb-chart-head">
          <span className="scb-chart-title"><FileSpreadsheet /> Curva S de Avance Programado vs. Real</span>
          <div className="scb-chart-legend">
            <span className="scb-lg"><span className="scb-lg-line" /> Programado</span>
            <span className="scb-lg real"><span className="scb-lg-dot" /> Real Ejecutado</span>
          </div>
        </div>
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="scb-plot">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--rp-primary)' }} stopOpacity="0.12" />
              <stop offset="100%" style={{ stopColor: 'var(--rp-primary)' }} stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {[0, 25, 50, 75, 100].map((v) => {
            const y = getY(v);
            return (
              <g key={v}>
                <line x1={padL} y1={y} x2={svgWidth - padR} y2={y} style={{ stroke: 'var(--rp-border)' }} strokeDasharray="3 3" strokeWidth="0.8" />
                <text x={padL - 6} y={y + 3} textAnchor="end" className="scb-ax-lbl">{v}%</text>
              </g>
            );
          })}
          {plannedAreaD && <path d={plannedAreaD} fill={`url(#${gradientId})`} />}
          {plannedPathD && <path d={plannedPathD} fill="none" style={{ stroke: 'var(--rp-primary)' }} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
          {actualPathD && <path d={actualPathD} fill="none" style={{ stroke: 'var(--rp-real)' }} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
          {plannedPoints.map((pt, i) => <circle key={`p-${i}`} cx={pt.x} cy={pt.y} r="2.5" fill="#fff" style={{ stroke: 'var(--rp-primary)' }} strokeWidth="1.5" />)}
          {actualPoints.map((pt, i) => <circle key={`a-${i}`} cx={pt.x} cy={pt.y} r="3.5" style={{ fill: 'var(--rp-real)' }} stroke="#fff" strokeWidth="1.5" />)}
          {periods.map((p, i) => (
            <text key={p.id} x={getX(i)} y={svgHeight - 6} textAnchor="middle" className="scb-x-lbl">{p.period}</text>
          ))}
        </svg>
      </div>

      {showTable && (
        <div
          className="nt-wrap rp-table"
          onClick={() => { if (!isEditing) onStartEditing?.(); }}
          style={!isEditing && onStartEditing ? { cursor: 'pointer' } : undefined}
        >
          <table className={`nt-tbl${isEditing ? ' nt-editing' : ''}`}>
            <colgroup>
              <col style={{ width: '7%' }} />
              <col style={{ width: '23%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '16%' }} />
            </colgroup>
            <thead>
              <tr>
                <th><NumHeader ops={ops} isEditing={isEditing} count={periods.length} /></th>
                <th className="left">Período / Mes</th>
                <th>Prog. Mes (%)</th>
                <th>Prog. Acum. (%)</th>
                <th>Real Mes (%)</th>
                <th>Real Acum. (%)</th>
                <th>Desvío</th>
              </tr>
            </thead>
            <tbody>
              {periods.length === 0 ? (
                <tr><td colSpan={7} className="nt-empty">No hay períodos cargados.</td></tr>
              ) : periods.map((p, idx) => {
                const diff = p.actualCumulative != null ? p.actualCumulative - p.plannedCumulative : null;
                return (
                  <tr
                    key={p.id}
                    className={`${ops.selected.has(p.id) ? 'row-selected ' : ''}${ops.dragOverId === p.id ? 'drag-over' : ''}`}
                    {...ops.dragProps(p.id)}
                  >
                    <NumCell ops={ops} id={p.id} index={idx} isEditing={isEditing}
                      onOpenMenu={(rect) => setMenu({ rowId: p.id, index: idx, rect })} />
                    <td className="per">
                      <EditableCell value={p.period} row={idx} col={0} isEditing={isEditing} placeholder="Mes X"
                        onCommit={(v) => change(p.id, { period: v })} />
                    </td>
                    <td className="pct plan">
                      <NumberCell value={p.plannedPercent} row={idx} col={1} isEditing={isEditing} suffix="%"
                        placeholder="0.0" required onCommit={(v) => change(p.id, { plannedPercent: v ?? 0 })} />
                    </td>
                    <td className="calc calc-plan">{fmtNum(p.plannedCumulative)}%</td>
                    <td className="pct real">
                      <NumberCell value={p.actualPercent} row={idx} col={2} isEditing={isEditing} suffix="%"
                        placeholder="—" onCommit={(v) => change(p.id, { actualPercent: v })} />
                    </td>
                    <td className="calc calc-real">
                      {p.actualCumulative != null ? `${fmtNum(p.actualCumulative)}%` : <span className="scb-muted">—</span>}
                    </td>
                    <td className={`calc ${diff == null ? 'scb-muted' : diff >= 0 ? 'scb-dv-pos' : 'scb-dv-neg'}`}>
                      {diff != null ? `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <RowMenuFor ops={ops} menu={menu} onClose={() => setMenu(null)} noun="período" />
    </div>
  );
};
