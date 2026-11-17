import React, { useMemo, useRef, useState } from 'react';
import { Plus, Search, Clock, Loader, Hourglass, CheckCircle2, AlertCircle } from 'lucide-react';
import { PendingItem, ImpactLevel, PendingStatus } from '../../types';
import { SectionHeaderBanner } from '../SectionHeaderBanner';
import { EditDock, DockButton } from '../EditDock';
import {
  EditableCell, SuggestCell, PillSelectCell, PillOption, StatusPill,
  useRowOps, NumHeader, NumCell, RowMenuFor, BulkBar, TableHint, newRowId,
  useColumnSort, SortHeader, dateSortValue,
} from '@/src/components/table/NotionTable';

const IMPACT: PillOption<ImpactLevel>[] = [
  { value: 'CRÍTICO', label: 'CRÍTICO', cls: 'critico' },
  { value: 'ALTO', label: 'ALTO', cls: 'alto' },
  { value: 'MEDIO', label: 'MEDIO', cls: 'medio' },
  { value: 'BAJO', label: 'BAJO', cls: 'bajo' },
];

const STATUS_DEF: [PendingStatus, string, React.ComponentType<{ className?: string }>][] = [
  ['En análisis', 'analisis', Search],
  ['Pendiente', 'pendiente', Clock],
  ['En ejecución', 'ejecucion', Loader],
  ['Aguardando respuesta', 'aguardando', Hourglass],
  ['Resuelto', 'resuelto', CheckCircle2],
  ['Vencido', 'vencido', AlertCircle],
];
const STATUS: PillOption<PendingStatus>[] = STATUS_DEF.map(([value, cls, icon]) => ({
  value,
  label: value,
  // "wrap": si el texto no entra en la columna (ej. "Aguardando respuesta") pasa a 2 líneas
  render: () => <StatusPill cls={`${cls} wrap`} icon={icon}>{value}</StatusPill>,
  menu: () => <StatusPill cls={cls} icon={icon}>{value}</StatusPill>,
}));

type SortKey = 'description' | 'responsible' | 'deadline' | 'impact' | 'status';
const IMPACT_RANK: Record<string, number> = { 'CRÍTICO': 0, 'ALTO': 1, 'MEDIO': 2, 'BAJO': 3 };
const STATUS_RANK: Record<string, number> = Object.fromEntries(STATUS_DEF.map(([v], i) => [v, i]));

interface PendingBoxBlockProps {
  pendings: PendingItem[];
  title?: string;
  numberIndex?: number | null;
  showTitle?: boolean;
  isEditing?: boolean;
  onUpdateTitle?: (title: string) => void;
  onToggleShowTitle?: () => void;
  onUpdatePendings?: (pendings: PendingItem[]) => void;
  onStartEditing?: () => void;
}

export const PendingBoxBlock: React.FC<PendingBoxBlockProps> = ({
  pendings,
  title = 'PENDENCIAS Y SITUACIONES RELEVANTES',
  numberIndex,
  showTitle = true,
  isEditing = false,
  onUpdateTitle,
  onToggleShowTitle,
  onUpdatePendings,
  onStartEditing,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ rowId: string; index: number; rect: DOMRect } | null>(null);

  const update = (rows: PendingItem[]) => onUpdatePendings?.(rows);

  const ops = useRowOps<PendingItem>({
    rows: pendings,
    onChange: update,
    isEditing,
    idPrefix: 'pending',
    rootRef,
    createRow: () => ({
      id: newRowId('pending'),
      description: '',
      responsible: '',
      deadline: '',
      impact: 'MEDIO',
      status: 'Pendiente',
    }),
  });

  // Ordenar por columna: clic en el título (impacto va de crítico a bajo; estado, en el orden del flujo)
  const { sortKey, sortDir, sortBy } = useColumnSort<PendingItem, SortKey>({
    rows: pendings,
    onChange: update,
    getValue: (p, key) => {
      switch (key) {
        case 'deadline': return dateSortValue(p.deadline);
        case 'impact': return IMPACT_RANK[p.impact] ?? 9;
        case 'status': return STATUS_RANK[p.status] ?? 99;
        default: return (p[key] || '').trim();
      }
    },
  });
  const sh = (key: SortKey, label: string) => (
    <SortHeader label={label} isEditing={isEditing} dir={sortKey === key ? sortDir : null} onSort={() => sortBy(key)} />
  );

  const responsibles = useMemo(() => pendings.map((p) => p.responsible || ''), [pendings]);
  const change = (id: string, patch: Partial<PendingItem>) =>
    update(pendings.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  return (
    <section ref={rootRef} className="nt-root px-5 py-2 shrink-0">
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
            <DockButton variant="primary" onClick={() => ops.addRow(pendings.length - 1)}>
              <Plus /> Agregar pendencia
            </DockButton>
          </EditDock>
          <TableHint sortable />
          <BulkBar ops={ops} />
        </>
      )}

      <div
        className="nt-wrap rp-table"
        onClick={() => { if (!isEditing) onStartEditing?.(); }}
        style={!isEditing && onStartEditing ? { cursor: 'pointer' } : undefined}
      >
        <table className={`nt-tbl${isEditing ? ' nt-editing' : ''}`}>
          <colgroup>
            <col style={{ width: '7%' }} />
            <col style={{ width: '37%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '17%' }} />
          </colgroup>
          <thead>
            <tr>
              <th><NumHeader ops={ops} isEditing={isEditing} count={pendings.length} /></th>
              <th className="left">{sh('description', 'Descripción de la Situación / Pendencia')}</th>
              <th className="left">{sh('responsible', 'Responsable')}</th>
              <th>{sh('deadline', 'Plazo')}</th>
              <th>{sh('impact', 'Impacto')}</th>
              <th>{sh('status', 'Estado')}</th>
            </tr>
          </thead>
          <tbody>
            {pendings.length === 0 ? (
              <tr><td colSpan={6} className="nt-empty">No hay pendencias registradas.</td></tr>
            ) : pendings.map((p, idx) => (
              <tr
                key={p.id}
                className={`${ops.selected.has(p.id) ? 'row-selected ' : ''}${ops.dragOverId === p.id ? 'drag-over' : ''}`}
                {...ops.dragProps(p.id)}
              >
                <NumCell ops={ops} id={p.id} index={idx} isEditing={isEditing}
                  onOpenMenu={(rect) => setMenu({ rowId: p.id, index: idx, rect })} />
                <td>
                  <EditableCell value={p.description} row={idx} col={0} isEditing={isEditing} multiline
                    placeholder="Describir la pendencia…" onCommit={(v) => change(p.id, { description: v })} />
                </td>
                <td style={{ color: '#334155', fontWeight: 500 }}>
                  <SuggestCell value={p.responsible} row={idx} col={1} isEditing={isEditing}
                    suggestions={responsibles} caption="Responsables"
                    onCommit={(v) => change(p.id, { responsible: v })} />
                </td>
                <td style={{ textAlign: 'center', fontFamily: 'var(--rp-font-num)', color: '#475569' }}>
                  <EditableCell value={p.deadline} row={idx} col={2} isEditing={isEditing}
                    placeholder="dd/mm/aaaa" onCommit={(v) => change(p.id, { deadline: v })} />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <PillSelectCell value={p.impact} options={IMPACT} isEditing={isEditing} row={idx} col={3}
                    caption="Impacto" onChange={(v) => change(p.id, { impact: v })} />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <PillSelectCell value={p.status} options={STATUS} isEditing={isEditing} row={idx} col={4}
                    caption="Estado" onChange={(v) => change(p.id, { status: v })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RowMenuFor ops={ops} menu={menu} onClose={() => setMenu(null)} noun="pendencia" />
    </section>
  );
};
