import React, { useLayoutEffect, useRef, useState } from 'react';
import { RubricItem } from '../../types';
import { SectionHeaderBanner } from '../SectionHeaderBanner';
import { Plus, Layers, MessageSquareText, CornerDownRight } from 'lucide-react';
import { EditDock, DockButton, DockCheck } from '../EditDock';
import {
  EditableCell, NumberCell, useRowOps, RowGutter, RowMenuFor, BulkBar, TableHint, newRowId, fmtEs,
} from '../table/NotionTable';
import { CsvImportButton } from '../table/CsvImport';
import { RUBRIC_CSV_FIELDS, rubricFromCsv, detectRubricType } from '@/src/utils/csv';

/**
 * Calcula el porcentaje efectivo de un rubro o grupo:
 * - Comentarios: no tienen porcentaje (0).
 * - Rubros normales: su propio porcentaje.
 * - Grupos: promedio aritmético de los porcentajes de sus rubros hijos
 *   (todos los rubros que le siguen hasta el próximo grupo, omitiendo comentarios).
 *   Si todos los hijos están al 100%, el grupo está al 100%.
 *   Si no tiene hijos registrados, conserva su propio porcentaje.
 */
export function getRubricEffectivePercent(r: RubricItem, idx: number, all: RubricItem[]): number {
  if (r.comment) return 0;
  if (!r.group) return Math.max(0, Math.min(100, Number(r.percent) || 0));

  const children: RubricItem[] = [];
  for (let i = idx + 1; i < all.length; i++) {
    if (all[i].group) break;
    if (!all[i].comment) {
      children.push(all[i]);
    }
  }

  if (children.length === 0) {
    return Math.max(0, Math.min(100, Number(r.percent) || 0));
  }

  const sum = children.reduce((acc, c) => acc + Math.max(0, Math.min(100, Number(c.percent) || 0)), 0);
  const avg = sum / children.length;
  return Math.round(avg * 10) / 10;
}

export function getGroupChildrenCount(idx: number, all: RubricItem[]): number {
  let count = 0;
  for (let i = idx + 1; i < all.length; i++) {
    if (all[i].group) break;
    if (!all[i].comment) count++;
  }
  return count;
}

interface SituationBlockProps {
  rubrics: RubricItem[];
  title?: string;
  numberIndex?: number | null;
  showTitle?: boolean;
  isEditing?: boolean;
  onUpdateTitle?: (title: string) => void;
  onToggleShowTitle?: () => void;
  onUpdateRubrics?: (rubrics: RubricItem[]) => void;
  onStartEditing?: () => void;
  /** Ocultar en la hoja los rubros y grupos con avance 0 % */
  hideZero?: boolean;
  onToggleHideZero?: () => void;
}

export const SituationBlock: React.FC<SituationBlockProps> = ({
  rubrics,
  title = 'DETALLE DE AVANCE FÍSICO DE OBRAS EN EJECUCIÓN',
  numberIndex,
  showTitle = true,
  isEditing = false,
  onUpdateTitle,
  onToggleShowTitle,
  onUpdateRubrics,
  hideZero = false,
  onToggleHideZero,
  onStartEditing,
}) => {
  const rootRef = useRef<HTMLElement>(null);
  const [menu, setMenu] = useState<{ rowId: string; index: number; rect: DOMRect } | null>(null);
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
  const trRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const rowHeightsRef = useRef<Record<string, number>>({});

  // Sincronizar altura exacta de cada fila entre la tabla y el gráfico de barras
  useLayoutEffect(() => {
    // Limpiar referencias a filas eliminadas
    const activeIds = new Set(rubrics.map((r) => r.id));
    for (const id in trRefs.current) {
      if (!activeIds.has(id)) {
        delete trRefs.current[id];
      }
    }

    const syncHeights = () => {
      const next: Record<string, number> = {};
      let hasChange = false;
      for (const [id, el] of Object.entries(trRefs.current)) {
        if (!el) continue;
        // offsetHeight: alto real de la fila. getBoundingClientRect trae el zoom de la vista
        // (la hoja se escala con transform) y con la hoja ampliada las filas crecían sin fin
        const h = el.offsetHeight;
        const finalH = Math.max(30, h);
        next[id] = finalH;
        if (rowHeightsRef.current[id] !== finalH) {
          hasChange = true;
        }
      }
      if (hasChange) {
        rowHeightsRef.current = next;
        setRowHeights({ ...next });
      }
    };

    syncHeights();

    const ro = new ResizeObserver(() => {
      syncHeights();
    });

    Object.values(trRefs.current).forEach((el) => {
      if (el) ro.observe(el);
    });

    return () => ro.disconnect();
  }, [rubrics]);

  // % efectivo y cantidad de rubros de cada grupo, en una sola pasada (la tabla y el gráfico los usan)
  const effective = React.useMemo(() => {
    const pct: number[] = new Array(rubrics.length);
    const kids: number[] = new Array(rubrics.length).fill(0);
    let groupIdx = -1, sum = 0, n = 0;
    const closeGroup = () => {
      if (groupIdx < 0) return;
      const g = rubrics[groupIdx];
      pct[groupIdx] = n > 0 ? Math.round((sum / n) * 10) / 10 : Math.max(0, Math.min(100, Number(g.percent) || 0));
      kids[groupIdx] = n;
    };
    rubrics.forEach((r, i) => {
      if (r.group) { closeGroup(); groupIdx = i; sum = 0; n = 0; pct[i] = 0; return; }
      pct[i] = r.comment ? 0 : Math.max(0, Math.min(100, Number(r.percent) || 0));
      if (!r.comment && groupIdx >= 0) { sum += pct[i]; n++; }
    });
    closeGroup();
    return { pct, kids };
  }, [rubrics]);

  // Filas en 0 % que no van a la hoja. Un comentario sigue al rubro de arriba: si ese se oculta, él también.
  const zeroHidden = React.useMemo(() => {
    const out = new Set<number>();
    if (!hideZero) return out;
    let prevHidden = false;
    rubrics.forEach((r, i) => {
      const h = r.comment ? prevHidden : effective.pct[i] <= 0;
      if (h) out.add(i);
      if (!r.comment) prevHidden = h;
    });
    return out;
  }, [hideZero, rubrics, effective]);
  // En la hoja se sacan; editando se ven atenuados para poder cambiarlos
  const skipRow = (i: number) => !isEditing && zeroHidden.has(i);
  const fadeRow = (i: number) => isEditing && zeroHidden.has(i);

  const update = (rows: RubricItem[]) => {
    // Sincronizar porcentajes de grupos calculados a partir de sus rubros hijos
    const synced = rows.map((r, idx) => {
      if (r.comment) return { ...r, percent: 0, group: false };
      if (r.group) {
        const eff = getRubricEffectivePercent(r, idx, rows);
        return { ...r, percent: eff };
      }
      return r;
    });
    onUpdateRubrics?.(synced);
  };

  const ops = useRowOps<RubricItem>({
    rows: rubrics,
    onChange: update,
    isEditing,
    idPrefix: 'rubric',
    rootRef,
    createRow: (index) => {
      const prev = rubrics[index - 1] ?? rubrics[rubrics.length - 1];
      let defaultItem = `${index + 1}.0`;
      if (prev && prev.item) {
        const match = prev.item.match(/^(\d+)(?:\.(\d+))?$/);
        if (match) {
          const major = parseInt(match[1], 10);
          const minor = match[2] !== undefined ? parseInt(match[2], 10) : 0;
          defaultItem = prev.group ? `${major}.1` : `${major}.${minor + 1}`;
        }
      }
      const detected = detectRubricType(defaultItem);
      return {
        id: newRowId('rubric'),
        item: defaultItem,
        description: '',
        percent: 0,
        group: detected.group,
        comment: detected.comment,
      };
    },
  });

  const handleRubricChange = (id: string, patch: Partial<RubricItem>) =>
    update(rubrics.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const handleItemChange = (id: string, newItem: string) => {
    const type = detectRubricType(newItem);
    const updated = rubrics.map((r) => {
      if (r.id !== id) return r;
      return {
        ...r,
        item: newItem,
        group: type.group,
        comment: type.comment,
        ...(type.comment ? { percent: 0 } : {}),
      };
    });
    update(updated);
  };

  const handleAddComment = () => {
    const newRow: RubricItem = {
      id: newRowId('rubric'),
      item: '',
      description: '',
      percent: 0,
      group: false,
      comment: true,
    };
    update([...rubrics, newRow]);
  };

  return (
    <section ref={rootRef} className="nt-root px-5 py-2 shrink-0">
      {/* Section Title Banner */}
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
            <DockButton variant="primary" onClick={() => ops.addRow(rubrics.length - 1)}>
              <Plus /> Agregar rubro
            </DockButton>
            <DockButton onClick={handleAddComment}>
              <MessageSquareText /> Agregar comentario
            </DockButton>
            <DockCheck
              label={`Ocultar los de 0 %${hideZero && zeroHidden.size ? ` (${zeroHidden.size})` : ''}`}
              checked={hideZero}
              onChange={() => onToggleHideZero?.()}
            />
            <CsvImportButton<RubricItem>
              fields={RUBRIC_CSV_FIELDS}
              toRow={rubricFromCsv}
              templateName="rubros"
              title="rubros"
              sampleRows={[
                ['1.0', 'Obras preliminares', '100', 'si'],
                ['1.1', 'Replanteo y nivelación', '100', 'no'],
                ['', 'Nota: Trabajos de topografía culminados', '0', 'comentario'],
              ]}
              onImport={(rows, mode) => update(mode === 'append' ? [...rubrics, ...rows] : rows)}
            />
            <span className="dock-label">Autodetección: 1.0 (Grupo) · 1.1 (Rubro) · Sin número (Comentario)</span>
          </EditDock>
          <TableHint gutter />
          <BulkBar ops={ops} noun={['rubro', 'rubros']} masculine />
        </>
      )}

      {/* Cuadrícula sincronizada: misma altura total y barras alineadas fila a fila */}
      <div className="grid grid-cols-[1.05fr_0.95fr] gap-4 items-stretch">
        {/* Izquierda: Tabla de Rubros, Grupos y Comentarios */}
        <div className="rp-table border border-slate-200 rounded-[var(--rp-radius-sm)] nt-visible bg-white shadow-2xs overflow-hidden flex flex-col">
          <table className={`w-full border-collapse text-[7.5pt] table-fixed nt-round${isEditing ? ' nt-editing' : ''}`}>
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
              <tr className="h-[28px]">
                <th className="h-[28px] py-0 px-2 text-left w-[72%] tracking-wide font-bold align-middle">
                  RUBROS / ACTIVIDADES
                </th>
                <th className="h-[28px] py-0 px-2 text-right w-[28%] tracking-wide font-bold align-middle">
                  AVANCE (%)
                </th>
              </tr>
            </thead>
            <tbody>
              {rubrics.length === 0 ? (
                <tr>
                  <td colSpan={2} className="py-8 text-center text-slate-400 italic text-[8pt]">
                    No se han registrado rubros. Importa un CSV o agrégalos con el menú de edición.
                  </td>
                </tr>
              ) : (
                rubrics.map((r, idx) => {
                  if (skipRow(idx)) return null;
                  const effVal = effective.pct[idx];
                  const childCount = effective.kids[idx];
                  const rowH = rowHeights[r.id] ?? 30;

                  return (
                    <tr
                      key={r.id || idx}
                      data-row-id={r.id}
                      ref={(el) => {
                        trRefs.current[r.id] = el;
                      }}
                      style={{ height: `${rowH}px` }}
                      title={fadeRow(idx) ? 'Avance 0 %: no se muestra en la hoja' : undefined}
                      className={`h-[30px] transition-colors border-b border-slate-100 ${fadeRow(idx) ? 'opacity-40 ' : ''}${
                        r.comment
                          ? 'bg-slate-50/40 text-slate-600'
                          : r.group
                          ? `bg-slate-50 font-bold text-slate-900 ${idx > 0 ? 'border-t border-slate-200' : ''}`
                          : 'text-slate-700 hover:bg-slate-50/50'
                      }${ops.selected.has(r.id) ? ' row-selected' : ''}${ops.dragOverId === r.id ? ' drag-over' : ''}`}
                      {...ops.dragProps(r.id)}
                    >
                      <td
                        style={{ height: `${rowH}px` }}
                        className={`h-[30px] nt-gutter py-1 px-2 leading-snug align-middle ${
                          r.group
                            ? 'font-bold text-slate-900'
                            : r.comment
                            ? 'pl-7 text-slate-600'
                            : 'pl-3 text-slate-600'
                        }`}
                      >
                        <RowGutter
                          ops={ops}
                          id={r.id}
                          isEditing={isEditing}
                          onOpenMenu={(rect) => setMenu({ rowId: r.id, index: idx, rect })}
                        />
                        <div
                          className={`flex items-start min-w-0 ${r.comment ? 'pl-3' : ''}`}
                          title={`${r.item ? r.item + ' ' : ''}${r.description}`}
                        >
                          {r.comment && (
                            <span
                              className="shrink-0 mr-1.5 mt-0.5 text-slate-400 select-none flex items-center"
                              aria-hidden="true"
                            >
                              <CornerDownRight className="w-3.5 h-3.5" />
                            </span>
                          )}
                          {(r.item || isEditing) && !r.comment && (
                            <span className="shrink-0 mr-1.5">
                              <EditableCell
                                value={r.item || ''}
                                row={idx}
                                col={0}
                                isEditing={isEditing}
                                placeholder="Ítem"
                                className={`nt-nowrap font-mono text-[7pt] tabular-nums ${
                                  r.group
                                    ? 'font-bold text-slate-900'
                                    : 'font-medium text-slate-600'
                                }`}
                                onCommit={(v) => handleItemChange(r.id, v)}
                              />
                            </span>
                          )}
                          {isEditing && r.comment && (
                            <span className="shrink-0 mr-1.5 opacity-60 hover:opacity-100">
                              <EditableCell
                                value={r.item || ''}
                                row={idx}
                                col={0}
                                isEditing={isEditing}
                                placeholder="—"
                                className="nt-nowrap font-mono text-[7pt] tabular-nums text-slate-400"
                                onCommit={(v) => handleItemChange(r.id, v)}
                              />
                            </span>
                          )}
                          <span className="flex-1 min-w-0">
                            <EditableCell
                              value={r.description}
                              row={idx}
                              col={1}
                              isEditing={isEditing}
                              multiline={r.comment}
                              placeholder={
                                r.comment
                                  ? 'Comentario u observación sobre el rubro anterior…'
                                  : 'Descripción del rubro…'
                              }
                              className={`${
                                r.comment
                                  ? 'italic text-slate-600 break-words whitespace-pre-wrap leading-relaxed'
                                  : 'nt-truncate'
                              }`}
                              onCommit={(v) => handleRubricChange(r.id, { description: v })}
                            />
                          </span>
                        </div>
                      </td>

                      <td
                        style={{ height: `${rowH}px` }}
                        className="h-[30px] py-1 px-2 text-right align-middle"
                      >
                        {r.comment ? (
                          <span className="text-slate-300 font-mono text-[7.5pt] tabular-nums select-none">—</span>
                        ) : r.group && childCount > 0 ? (
                          <span
                            className="font-mono font-bold text-slate-900 text-[7.5pt] tabular-nums inline-block py-[2px] px-[4px] cursor-default"
                            title={`Calculado automáticamente del promedio de los ${childCount} rubros del grupo`}
                          >
                            {fmtEs(effVal)}%
                          </span>
                        ) : (
                          <NumberCell
                            value={effVal}
                            row={idx}
                            col={2}
                            isEditing={isEditing}
                            required
                            min={0}
                            max={100}
                            format={(n) => `${fmtEs(n)}%`}
                            className={`font-mono tabular-nums text-[7.5pt] text-right ${
                              r.group ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'
                            }`}
                            onCommit={(v) => handleRubricChange(r.id, { percent: v ?? 0 })}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Derecha: Gráfico de Avance Físico alineado fila a fila */}
        <div className="rp-card border border-slate-200 rounded-[var(--rp-radius-sm)] overflow-hidden bg-white shadow-2xs flex flex-col">
          {/* Cabecera del gráfico con la misma altura exacta que thead de la tabla */}
          <div className="h-[28px] bg-slate-100 text-slate-700 font-bold border-b border-slate-300 px-3 flex items-center justify-between text-[7.5pt] tracking-wide shrink-0">
            <span>GRÁFICO DE AVANCE FÍSICO</span>
            <span className="font-mono text-[7pt] text-slate-500 font-semibold">% EJECUTADO</span>
          </div>

          <div className="flex flex-col flex-1">
            {rubrics.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs italic flex items-center justify-center flex-1">
                Sin rubros cargados
              </div>
            ) : (
              rubrics.map((r, i) => {
                if (skipRow(i)) return null;
                const effVal = effective.pct[i];
                const barColor = r.group ? 'var(--rp-bar-main)' : 'var(--rp-bar-sub)';
                const rowH = rowHeights[r.id] ?? 30;

                return (
                  <div
                    key={`rubric-bar-${r.id || i}`}
                    style={{ height: `${rowH}px` }}
                    className={`h-[30px] px-3 flex items-center gap-2 border-b border-slate-100 ${fadeRow(i) ? 'opacity-40 ' : ''}${
                      r.comment
                        ? 'bg-slate-50/20'
                        : r.group
                        ? `bg-slate-50 font-bold ${i > 0 ? 'border-t border-slate-200' : ''}`
                        : ''
                    }`}
                  >
                    {!r.comment ? (
                      <>
                        {r.item ? (
                          <span
                            className={`font-mono text-[7pt] shrink-0 w-7 text-right tabular-nums ${
                              r.group ? 'font-bold text-slate-700' : 'font-medium text-slate-400'
                            }`}
                          >
                            {r.item}
                          </span>
                        ) : (
                          <span className="shrink-0 w-7" />
                        )}
                        <div
                          className="rp-track cmb-bar scb-kp-track relative flex-1 rounded-full overflow-hidden"
                          style={{
                            height: r.group ? 8 : 6,
                            backgroundColor: 'var(--rp-track-bg, var(--rp-surface-2))',
                          }}
                        >
                          <i
                            className="rp-bar-fill block h-full rounded-full transition-all duration-300"
                            style={{ width: `${effVal}%`, backgroundColor: barColor }}
                          />
                        </div>
                        <span
                          className={`font-mono text-[7.5pt] shrink-0 w-11 text-right tabular-nums ${
                            r.group ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'
                          }`}
                        >
                          {fmtEs(effVal)}%
                        </span>
                      </>
                    ) : (
                      <div className="flex-1" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <RowMenuFor
        ops={ops}
        menu={menu}
        onClose={() => setMenu(null)}
        noun="rubro"
        extra={(rowId) => {
          const r = rubrics.find((x) => x.id === rowId);
          return [
            {
              label: r?.group ? 'Quitar como grupo' : 'Marcar como grupo',
              icon: <Layers className="w-3.5 h-3.5" />,
              onClick: () => handleRubricChange(rowId, { group: !r?.group, comment: false }),
            },
            {
              label: r?.comment ? 'Quitar como comentario' : 'Marcar como comentario',
              icon: <MessageSquareText className="w-3.5 h-3.5" />,
              onClick: () => handleRubricChange(rowId, { comment: !r?.comment, group: false }),
            },
          ];
        }}
      />
    </section>
  );
};

