import React, { useMemo } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, IndentIncrease, IndentDecrease, Sparkles, Diamond, CalendarCheck } from 'lucide-react';
import { BlockConfig, ProjectData, RubricItem } from '../../types';
import { SectionHeaderBanner } from '../SectionHeaderBanner';
import { EditDock, DockButton, DockGroup, DockSegmented, DockCheck, DockSlider } from '../EditDock';
import { EditableCell } from '../table/NotionTable';
import { CsvImportButton } from '../table/CsvImport';
import { stripRefTags } from '../../utils/refs';
import {
  GanttTask, GanttRow, GanttScale, GanttColumns, GanttDensity, GanttColor, GanttPeriod, GANTT_COLORS, GANTT_MM, GANTT_CSV_FIELDS,
  ganttRowsFor, buildScale, barOf, posOf, plannedAt, fmtShort, ganttTaskFromCsv, markGroups, newTaskId,
  exampleTasks, toDate, addDays, periodStartOf, closePeriod, buildRows,
} from '../../utils/gantt';
import { resolveTokens } from '../../utils/fields';
import './gantt-block.css';

/* =====================================================================
   Módulo Cronograma: diagrama de Gantt con tareas, subtareas, hitos,
   avance real sobre lo programado y línea en la fecha de toma de datos.
   Se edita en una tabla arriba del gráfico, o se importa de Excel /
   Project (CSV o tabla pegada). Si es largo, sigue en las hojas siguientes
   repitiendo la escala de tiempo.
   ===================================================================== */

interface Props {
  block: BlockConfig;
  data?: ProjectData;
  rubrics?: RubricItem[];
  numberIndex?: number | null;
  label?: string;
  part?: { from: number; to: number; index: number; count: number };
  isEditing?: boolean;
  onUpdateConfig?: (patch: Partial<BlockConfig>) => void;
  onStartEditing?: () => void;
}

const COLS: Record<GanttColumns, { key: string; label: string; mm: number }[]> = {
  name: [{ key: 'name', label: 'Tarea', mm: 52 }],
  dates: [{ key: 'name', label: 'Tarea', mm: 46 }, { key: 'start', label: 'Inicio', mm: 12.5 }, { key: 'end', label: 'Fin', mm: 12.5 }, { key: 'dur', label: 'Días', mm: 8 }],
  full: [
    { key: 'name', label: 'Tarea', mm: 42 }, { key: 'start', label: 'Inicio', mm: 12 }, { key: 'end', label: 'Fin', mm: 12 },
    { key: 'dur', label: 'Días', mm: 7.5 }, { key: 'plan', label: 'Prog.', mm: 9 }, { key: 'prog', label: 'Real', mm: 9 },
  ],
};
/** Columna "avance del período" (vista completa): le saca su ancho al nombre */
const PER_MM = 9;
const PERIOD_LABEL: Record<GanttPeriod, string> = { week: 'Sem.', '2weeks': 'Per.', month: 'Mes', custom: 'Per.' };

/** Relleno de avance: lo ejecutado hasta el período anterior lleno y lo del período rayado */
const Fill: React.FC<{ r: GanttRow; period: boolean }> = ({ r, period }) => {
  const p = Math.min(100, r.prog ?? 0);
  const prev = period && r.prev != null ? Math.min(p, r.prev) : null;
  return (
    <i className="rp-bar-fill" style={{ width: `${p}%` }}>
      {prev != null && p - prev > 0.05 && <i className="rp-gantt-per" style={{ left: `${(prev / Math.max(p, 0.001)) * 100}%` }} />}
    </i>
  );
};

export const GanttBlock: React.FC<Props> = ({ block, data, rubrics = [], numberIndex, label, part, isEditing = false, onUpdateConfig, onStartEditing }) => {
  const tasks = block.ganttTasks ?? [];
  const set = (patch: Partial<BlockConfig>) => onUpdateConfig?.(patch);
  const setTasks = (t: GanttTask[]) => set({ ganttTasks: t });
  const patchTask = (id: string, p: Partial<GanttTask>) => setTasks(tasks.map((t) => (t.id === id ? { ...t, ...p } : t)));

  const showProgress = block.ganttShowProgress !== false;
  const ref = data?.reportDate || '';

  // Todas las filas (para escala y grupos) y las de esta hoja
  // all: todas (escala y colores); shown: las que se dibujan (sin las de 0 % si se ocultan)
  const { all, shown } = useMemo(() => ganttRowsFor(block, rubrics),
    [block.ganttTasks, block.ganttOnlyMain, block.ganttFromRubrics, block.ganttHideZero, block.ganttCritical, block.ganttCritTolerance, rubrics]);

  // Avance del período: rayado sobre la barra, franja en la escala y columna en la vista completa
  const periodOn = showProgress && block.ganttShowPeriod !== false;
  const period: GanttPeriod = block.ganttPeriod ?? 'week';
  const perStart = periodOn ? periodStartOf(block, ref) : null;
  const hasPrev = periodOn && all.some((r) => r.prev != null && !r.milestone);

  const columns: GanttColumns = block.ganttColumns ?? 'dates';
  const cols = COLS[columns]
    .filter((c) => showProgress || (c.key !== 'prog' && c.key !== 'plan'))
    .map((c) => (c.key === 'name' && columns === 'full' && hasPrev ? { ...c, mm: c.mm - PER_MM } : c));
  if (columns === 'full' && hasPrev) cols.push({ key: 'per', label: PERIOD_LABEL[period], mm: PER_MM });
  const leftMm = cols.reduce((a, c) => a + c.mm, 0);
  const density: GanttDensity = block.ganttDensity ?? 'normal';
  const rowMm = GANTT_MM.row[density];
  const critOn = !!block.ganttCritical;
  const CRIT = 'var(--rp-obs-critical, #dc2626)';
  // Lo que calculó la ruta crítica, para la tabla de edición (columna "Crít.")
  const critById = useMemo(() => new Map(all.map((r) => [r.id, r])), [all]);
  const scale = useMemo(() => buildScale(all, block.ganttScale ?? 'auto', block.ganttFrom, block.ganttTo), [all, block.ganttScale, block.ganttFrom, block.ganttTo]);
  const from = isEditing ? 0 : part?.from ?? 0;
  const to = isEditing ? shown.length : part?.to ?? shown.length;
  const rows = shown.slice(from, to);
  const isFirst = isEditing || !part || part.index === 0;
  const isLast = isEditing || !part || part.index === part.count - 1;
  const showToday = block.ganttShowToday !== false && !!scale && !!toDate(ref) && ref >= scale.start && ref <= scale.end;
  // Franja del período en la escala (del corte anterior a la toma de datos, a mitad de día como la línea)
  const band = (() => {
    if (!scale || !perStart || !toDate(ref) || ref < scale.start || perStart > scale.end) return null;
    const half = 100 / scale.span / 2;
    const a = Math.max(0, posOf(scale, perStart) + half), b = Math.min(100, posOf(scale, ref) + half);
    return b > a ? { left: a, width: b - a } : null;
  })();
  const caption = block.ganttCaption ?? '';

  const headerMm = GANTT_MM.head + GANTT_MM.headYears;

  return (
    <div className={`rp-gantt-block relative px-5 py-2${part && part.index > 0 ? ' is-cont' : ''}`}>
      {isFirst && (
        <SectionHeaderBanner
          numberIndex={numberIndex}
          title={block.title}
          isEditing={isEditing}
          showTitle={block.showTitle ?? true}
          onUpdateTitle={(t) => set({ title: t })}
          onToggleShowTitle={() => set({ showTitle: !(block.showTitle ?? true) })}
          onStartEditing={onStartEditing}
        />
      )}

      {isEditing && <GanttEditor tasks={tasks} setTasks={setTasks} patchTask={patchTask} critOn={critOn} critById={critById} periodOn={periodOn} />}

      {!scale ? (
        <div className="rp-gantt-empty no-print" onDoubleClick={onStartEditing}>Sin tareas con fechas: doble clic para cargar el cronograma o importarlo de Excel / Project.</div>
      ) : (
        <div className={`rp-gantt is-${density}`} style={{ ['--g-left' as string]: `${leftMm}mm`, ['--g-row' as string]: `${rowMm}mm` }}>
          {/* Encabezado: columnas + escala (años / meses, o meses / semanas) */}
          <div className="rp-gantt-head" style={{ height: `${headerMm}mm` }}>
            <div className="rp-gantt-cols">
              {cols.map((c) => <span key={c.key} className={`rp-gantt-col is-${c.key}`} style={{ width: `${c.mm}mm` }}>{c.label}</span>)}
            </div>
            <div className="rp-gantt-scale">
              <div className="rp-gantt-years" style={{ height: `${GANTT_MM.headYears}mm` }}>
                {scale.years.map((y, i) => <span key={i} style={{ left: `${y.left}%`, width: `${y.width}%` }}>{y.label}</span>)}
              </div>
              <div className="rp-gantt-ticks" style={{ height: `${GANTT_MM.head}mm` }}>
                {scale.ticks.map((t, i) => <span key={i} className={t.strong ? 'is-strong' : undefined} style={{ left: `${t.left}%`, width: `${t.width}%` }}>{t.label}</span>)}
              </div>
            </div>
          </div>

          <div className="rp-gantt-body">
            {/* Líneas de la escala y de la fecha de toma de datos, sobre todas las filas */}
            <div className="rp-gantt-grid" aria-hidden>
              {band && <span className="rp-gantt-period" style={{ left: `${band.left}%`, width: `${band.width}%` }} />}
              {scale.ticks.map((t, i) => <i key={i} className={t.strong ? 'is-strong' : undefined} style={{ left: `${t.left}%` }} />)}
              {showToday && <b className="rp-gantt-today" style={{ left: `${posOf(scale, ref) + 100 / scale.span / 2}%` }} />}
            </div>

            {rows.map((r) => {
              const lv = r.level ?? 0;
              const plan = plannedAt(r, ref);
              const late = showProgress && r.prog != null && plan != null && r.prog + 0.5 < plan;
              const bar = toDate(r.s) && toDate(r.e) ? barOf(scale, r.s, r.e) : null;
              return (
                <div key={r.id}
                  className={`rp-gantt-row lv-${lv}${r.group ? ' is-group' : ''}${r.milestone ? ' is-ms' : ''}${critOn && r.crit ? ' is-crit' : ''}${critOn && r.crit === false ? ' is-noncrit' : ''}`}
                  style={{ height: `${rowMm}mm`, ['--gc' as string]: critOn && r.crit ? CRIT : r.colorV }}>
                  <div className="rp-gantt-cols">
                    {cols.map((c) => (
                      <span key={c.key} className={`rp-gantt-col is-${c.key}`} style={{ width: `${c.mm}mm` }}>
                        {c.key === 'name' && <>{r.code && <em>{r.code}</em>}<span className="t" title={r.name}>{resolveTokens(r.name)}</span></>}
                        {c.key === 'start' && fmtShort(r.s)}
                        {c.key === 'end' && (r.milestone ? '' : fmtShort(r.e))}
                        {c.key === 'dur' && (r.milestone ? '◆' : r.dur || '')}
                        {c.key === 'plan' && (plan != null && !r.milestone ? `${plan} %` : '')}
                        {c.key === 'prog' && (r.prog != null && !r.milestone ? <b className={late ? 'is-late' : undefined}>{Math.round(r.prog)} %</b> : '')}
                        {c.key === 'per' && (r.prog != null && r.prev != null && !r.milestone ? fmtDelta(r.prog - r.prev) : '')}
                      </span>
                    ))}
                  </div>
                  <div className="rp-gantt-track">
                    {bar && (r.milestone ? (
                      <span className="rp-gantt-ms rp-bar-fill" style={{ left: `${bar.left}%` }} title={`${r.name} · ${fmtShort(r.s)}`} />
                    ) : r.group ? (
                      <span className="rp-gantt-sum" style={{ left: `${bar.left}%`, width: `${bar.width}%` }}>
                        {showProgress && r.prog != null && <Fill r={r} period={periodOn} />}
                      </span>
                    ) : (
                      <span className="rp-gantt-bar" style={{ left: `${bar.left}%`, width: `${bar.width}%` }}>
                        {showProgress && r.prog != null && <Fill r={r} period={periodOn} />}
                      </span>
                    ))}
                    {/* Holgura: línea fina desde el fin hasta el fin más tardío posible */}
                    {critOn && block.ganttShowSlack && bar && !r.crit && !r.milestone && !r.group && r.lateEnd && (r.slack ?? 0) > 0 && (() => {
                      const late = barOf(scale, r.s, r.lateEnd!);
                      const a = bar.left + bar.width, b = late.left + late.width;
                      return b > a + 0.1 ? <span className="rp-gantt-slack" style={{ left: `${a}%`, width: `${b - a}%` }} title={`Holgura: ${r.slack} días hábiles`} /> : null;
                    })()}
                    {/* Con solo la columna de nombre, el avance va al lado de la barra */}
                    {bar && columns === 'name' && showProgress && r.prog != null && !r.milestone && (
                      <span className="rp-gantt-pct" style={{ left: `calc(${bar.left + bar.width}% + 1mm)` }}>
                        {Math.round(r.prog)} %{periodOn && r.prev != null && Math.round(r.prog - r.prev) !== 0 && <small> ({fmtDelta(r.prog - r.prev)})</small>}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {isLast && (
            <div className="rp-gantt-legend" style={{ height: `${GANTT_MM.legend}mm` }}>
              <span><i className="lg-plan" />Programado</span>
              {showProgress && !hasPrev && <span><i className="lg-real" />Avance real</span>}
              {hasPrev && <span><i className="lg-real" />Avance {perStart ? `al ${fmtShort(perStart)}` : 'anterior'}</span>}
              {hasPrev && <span><i className="lg-real lg-per" />Avance del período{perStart && toDate(ref) ? ` (${fmtShort(perStart)} – ${fmtShort(ref)})` : ''}</span>}
              <span><i className="lg-sum" />Resumen</span>
              <span><i className="lg-ms" />Hito</span>
              {critOn && <span className="lg-crit-t"><i className="lg-crit" />Ruta crítica</span>}
              {critOn && block.ganttShowSlack && <span><i className="lg-slack" />Holgura</span>}
              {showToday && <span className="lg-today-t"><i className="lg-today" />Toma de datos {fmtShort(ref)}</span>}
              {showProgress && columns === 'full' && <span className="lg-note">Prog. = avance programado a esa fecha · en rojo, lo atrasado</span>}
            </div>
          )}
        </div>
      )}

      {isLast && (isEditing || !!label || !!stripRefTags(caption)) && (
        <div className="rp-caption rp-gantt-caption" style={{ height: `${GANTT_MM.caption}mm` }}>
          {label && <b className="rp-gantt-label">{label}</b>}
          {label && (stripRefTags(caption) || isEditing) ? ' - ' : ''}
          <EditableCell value={isEditing ? caption : stripRefTags(caption)} onCommit={(v) => set({ ganttCaption: v })} isEditing={isEditing}
            row={0} col={0} placeholder="Pie del cronograma" className="rp-gantt-capcell" />
        </div>
      )}

      {isEditing && (
        <EditDock slot="options">
          <DockButton variant="primary" onClick={() => setTasks([...tasks, { id: newTaskId(), name: 'Nueva tarea', start: tasks[tasks.length - 1]?.end ?? ref ?? '2026-01-01', end: addDays(tasks[tasks.length - 1]?.end ?? ref ?? '2026-01-01', 13) }])}>
            <Plus /> Tarea
          </DockButton>
          <CsvImportButton<GanttTask>
            fields={GANTT_CSV_FIELDS}
            toRow={(rec) => ganttTaskFromCsv(rec)}
            templateName="cronograma"
            title="cronograma (Excel, Project…)"
            sampleRows={[['1', 'Obras preliminares', '05/01/2027', '30/01/2027', '20 días', '80', '100', '1'], ['1.1', 'Replanteo', '05/01/2027', '12/01/2027', '6 días', '90', '100', '2']]}
            onImport={(rows, mode) => setTasks(markGroups(mode === 'append' ? [...tasks, ...rows] : rows))}
          />
          {!tasks.length && <DockButton onClick={() => setTasks(exampleTasks())}><Sparkles /> Ejemplo</DockButton>}
          <DockGroup label="Escala">
            <DockSegmented<GanttScale> value={block.ganttScale ?? 'auto'} onChange={(v) => set({ ganttScale: v })}
              options={[{ value: 'auto', label: 'Auto' }, { value: 'week', label: 'Semanas' }, { value: 'month', label: 'Meses' }, { value: 'quarter', label: 'Trim.' }]} />
          </DockGroup>
          <DockGroup label="Columnas">
            <DockSegmented<GanttColumns> value={columns} onChange={(v) => set({ ganttColumns: v })}
              options={[{ value: 'name', label: 'Nombre' }, { value: 'dates', label: 'Fechas' }, { value: 'full', label: 'Completo' }]} />
          </DockGroup>
          <DockGroup label="Filas">
            <DockSegmented<GanttDensity> value={density} onChange={(v) => set({ ganttDensity: v })}
              options={[{ value: 'normal', label: 'Normal' }, { value: 'compact', label: 'Compactas' }]} />
          </DockGroup>
          <DockCheck label="Avance real" checked={showProgress} onChange={() => set({ ganttShowProgress: !showProgress })} />
          {showProgress && (
            <DockCheck label="Avance del período (rayado)" checked={periodOn} onChange={() => set({ ganttShowPeriod: !periodOn })} />
          )}
          {periodOn && (
            <>
              <DockGroup label="Período">
                <DockSegmented<GanttPeriod> value={period} onChange={(v) => set({ ganttPeriod: v, ...(v === 'custom' && !block.ganttPeriodStart && toDate(ref) ? { ganttPeriodStart: addDays(ref, -7) } : {}) })}
                  options={[{ value: 'week', label: '1 sem.' }, { value: '2weeks', label: '2 sem.' }, { value: 'month', label: 'Mes' }, { value: 'custom', label: 'Desde…' }]} />
              </DockGroup>
              {period === 'custom' && (
                <label className="dock-group" title="Comienzo del período (el fin es la fecha de toma de datos del informe)">
                  <span className="dock-label">Desde</span>
                  <input type="date" className="dock-input" value={block.ganttPeriodStart ?? ''} onChange={(e) => set({ ganttPeriodStart: e.target.value || undefined })} />
                </label>
              )}
              <DockButton
                title="Al empezar un período nuevo: el avance de hoy pasa a ser el avance anterior de cada tarea. Después actualizá los % y la fecha de toma de datos."
                onClick={() => set({
                  ganttTasks: closePeriod(tasks, buildRows(tasks, { fromRubrics: !!block.ganttFromRubrics, rubrics }), !!block.ganttFromRubrics),
                  ...(period === 'custom' && toDate(ref) ? { ganttPeriodStart: ref } : {}),
                })}>
                <CalendarCheck /> Cerrar período
              </DockButton>
            </>
          )}
          <DockCheck label="Avance desde los rubros" checked={!!block.ganttFromRubrics} onChange={() => set({ ganttFromRubrics: !block.ganttFromRubrics })} />
          <DockCheck label="Línea de toma de datos" checked={block.ganttShowToday !== false} onChange={() => set({ ganttShowToday: block.ganttShowToday === false })} />
          <DockCheck label="Ruta crítica" checked={critOn} onChange={() => set({ ganttCritical: !critOn })} />
          {critOn && (
            <>
              <DockCheck label="Holgura" checked={!!block.ganttShowSlack} onChange={() => set({ ganttShowSlack: !block.ganttShowSlack })} />
              <DockSlider label="Tolerancia" value={block.ganttCritTolerance ?? 0} min={0} max={10} step={1} unit=" d"
                onChange={(v) => set({ ganttCritTolerance: v })} />
              <span className="dock-label" title="Tareas críticas: de la columna Crítica de Project, de la marca a mano, o calculadas con las predecesoras">
                {(() => {
                  const leaf = all.filter((r) => !r.group && !r.milestone);
                  const c = leaf.filter((r) => r.crit).length, known = leaf.filter((r) => r.crit != null).length;
                  return known ? `${c} críticas de ${leaf.length}` : 'Sin datos: cargá predecesoras o marcalas';
                })()}
              </span>
            </>
          )}
          <DockCheck label="Solo tareas principales" checked={!!block.ganttOnlyMain} onChange={() => set({ ganttOnlyMain: !block.ganttOnlyMain })} />
          <DockCheck
            label={`Ocultar las de 0 %${block.ganttHideZero && all.length > shown.length ? ` (${all.length - shown.length})` : ''}`}
            checked={!!block.ganttHideZero}
            onChange={() => set({ ganttHideZero: !block.ganttHideZero })}
          />
          <label className="dock-group" title="Fecha de comienzo de la escala (vacío = automática)">
            <span className="dock-label">Desde</span>
            <input type="date" className="dock-input" value={block.ganttFrom ?? ''} onChange={(e) => set({ ganttFrom: e.target.value || undefined })} />
          </label>
          <label className="dock-group" title="Fecha de fin de la escala (vacío = automática)">
            <span className="dock-label">Hasta</span>
            <input type="date" className="dock-input" value={block.ganttTo ?? ''} onChange={(e) => set({ ganttTo: e.target.value || undefined })} />
          </label>
          <label className="dock-group" title="Numera el cronograma como figura. Vacío = sin número.">
            <span className="dock-label">Numerar como</span>
            <input type="text" list="gantt-prefix" className="dock-input" value={block.ganttPrefix ?? ''} placeholder="sin numerar" onChange={(e) => set({ ganttPrefix: e.target.value })} />
            <datalist id="gantt-prefix">{['Figura', 'Gráfico', 'Cuadro'].map((x) => <option key={x} value={x} />)}</datalist>
          </label>
        </EditDock>
      )}
    </div>
  );
};

/** +5 % / −2 % (avance del período) */
const fmtDelta = (d: number) => { const v = Math.round(d); return v > 0 ? `+${v} %` : v < 0 ? `−${-v} %` : '0 %'; };

/* ---------- Tabla de edición de tareas ---------- */
const GanttEditor: React.FC<{
  tasks: GanttTask[]; setTasks: (t: GanttTask[]) => void; patchTask: (id: string, p: Partial<GanttTask>) => void;
  critOn?: boolean; critById?: Map<string, GanttRow>; periodOn?: boolean;
}> = ({ tasks, setTasks, patchTask, critOn, critById, periodOn }) => {
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= tasks.length) return;
    const c = [...tasks];
    [c[i], c[j]] = [c[j], c[i]];
    setTasks(markGroups(c.map((t) => ({ ...t, group: false }))));
  };
  const indent = (i: number, d: number) => {
    const c = tasks.map((t, k) => (k === i ? { ...t, level: Math.max(0, Math.min(2, (t.level ?? 0) + d)) } : t));
    // Al cambiar la sangría se recalcula qué filas son resumen
    setTasks(markGroups(c.map((t) => ({ ...t, group: false }))));
  };
  if (!tasks.length) return null;
  return (
    <div className="rp-gantt-editor no-print">
      <table>
        <thead>
          <tr><th>Cód.</th><th>Tarea</th><th>Inicio</th><th>Fin</th>{periodOn && <th title="Avance al cierre del período anterior. Lo que sumes en Avance % se dibuja rayado">Anterior %</th>}<th>Avance %</th><th title="Hito (un día, rombo)">Hito</th>
            {critOn && <th title="Predecesoras como en Project: 3 · 3;5 · 4CC+2d · 7FF-1d (FC, CC, FF, CF). El número es el N.º de Project o el código">Predec.</th>}
            {critOn && <th title="Ruta crítica: Auto (calculada), Sí o No (a mano). Clic para cambiar">Crít.</th>}
            <th>Color</th><th /></tr>
        </thead>
        <tbody>
          {tasks.map((t, i) => (
            <tr key={t.id} className={t.group ? 'is-group' : undefined}>
              <td><input value={t.code ?? ''} onFocus={(e) => e.currentTarget.select()} onChange={(e) => patchTask(t.id, { code: e.target.value || undefined })} className="w-code" /></td>
              <td>
                <div className="g-name-cell" style={{ paddingLeft: `${(t.level ?? 0) * 12}px` }}>
                  <button type="button" title="Quitar sangría" onClick={() => indent(i, -1)} disabled={!t.level}><IndentDecrease /></button>
                  <button type="button" title="Hacer subtarea de la de arriba" onClick={() => indent(i, 1)} disabled={i === 0 || (t.level ?? 0) >= 2}><IndentIncrease /></button>
                  <input value={t.name} onFocus={(e) => e.currentTarget.select()} onChange={(e) => patchTask(t.id, { name: e.target.value })} />
                </div>
              </td>
              <td><input type="date" value={t.start} onChange={(e) => { const s = e.target.value; if (!s) return; patchTask(t.id, { start: s, end: t.milestone || t.end < s ? s : t.end, days: undefined }); }} /></td>
              <td><input type="date" value={t.end} disabled={t.milestone} onChange={(e) => { const v = e.target.value; if (!v) return; patchTask(t.id, { end: v < t.start ? t.start : v, days: undefined }); }} /></td>
              {periodOn && (
                <td><input type="number" min={0} max={100} value={t.prevProgress ?? ''} placeholder={t.group ? 'auto' : '—'} className="w-num"
                  onChange={(e) => patchTask(t.id, { prevProgress: e.target.value === '' ? undefined : Math.max(0, Math.min(100, Number(e.target.value))) })} /></td>
              )}
              <td><input type="number" min={0} max={100} value={t.progress ?? ''} placeholder={t.group ? 'auto' : '—'} className="w-num"
                onChange={(e) => patchTask(t.id, { progress: e.target.value === '' ? undefined : Math.max(0, Math.min(100, Number(e.target.value))) })} /></td>
              <td className="c"><input type="checkbox" checked={!!t.milestone} onChange={(e) => patchTask(t.id, { milestone: e.target.checked, end: e.target.checked ? t.start : t.end })} /></td>
              {critOn && (
                <td><input value={t.pred ?? ''} placeholder={t.uid ? `N.º ${t.uid}` : '—'} className="w-pred" title={t.uid ? `Esta tarea es la N.º ${t.uid}` : undefined}
                  onChange={(e) => patchTask(t.id, { pred: e.target.value || undefined })} /></td>
              )}
              {critOn && (() => {
                const r = critById?.get(t.id);
                const auto = t.critical == null;
                const on = auto ? r?.crit : t.critical;
                const next = t.critical == null ? true : t.critical ? false : undefined;
                return (
                  <td className="c">
                    <button type="button" className={`g-crit${on ? ' is-on' : ''}${auto ? ' is-auto' : ''}`}
                      title={`${auto ? 'Automática' : 'Marcada a mano'}${r?.slack != null ? ` · holgura ${r.slack} d` : ''} · clic: ${next == null ? 'automática' : next ? 'sí' : 'no'}`}
                      onClick={() => patchTask(t.id, { critical: next })}>
                      {auto ? (on == null ? 'auto' : on ? 'auto·sí' : 'auto·no') : on ? 'Sí' : 'No'}
                    </button>
                  </td>
                );
              })()}
              <td>
                <select value={t.color ?? ''} onChange={(e) => patchTask(t.id, { color: (e.target.value || undefined) as GanttColor | undefined })}>
                  <option value="">Auto</option>
                  {GANTT_COLORS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </td>
              <td className="ops">
                <button type="button" title="Subir" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp /></button>
                <button type="button" title="Bajar" onClick={() => move(i, 1)} disabled={i === tasks.length - 1}><ArrowDown /></button>
                <button type="button" title="Insertar debajo" onClick={() => { const c = [...tasks]; c.splice(i + 1, 0, { id: newTaskId(), name: 'Nueva tarea', start: t.start, end: t.end, level: t.group ? (t.level ?? 0) + 1 : t.level }); setTasks(markGroups(c.map((x) => ({ ...x, group: false })))); }}><Plus /></button>
                <button type="button" title="Quitar" className="danger" onClick={() => setTasks(markGroups(tasks.filter((x) => x.id !== t.id).map((x) => ({ ...x, group: false }))))}><Trash2 /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="rp-gantt-editor-hint"><Diamond /> Las tareas con subtareas (sangría) se vuelven resumen: su barra abarca a las de abajo y su avance se calcula solo si lo dejás vacío.</div>
    </div>
  );
};
