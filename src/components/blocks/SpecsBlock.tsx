import React, { useRef, useState } from 'react';
import { SpecItem } from '../../types';
import { Plus, CheckCircle2, BadgeCheck, Clock, AlertCircle, XCircle } from 'lucide-react';
import { SectionHeaderBanner } from '../SectionHeaderBanner';
import { EditDock, DockButton } from '../EditDock';
import {
  EditableCell, PillSelectCell, PillOption, StatusPill, useRowOps, RowGutter, RowMenuFor, BulkBar, TableHint, newRowId,
} from '../table/NotionTable';
import { CsvImportButton } from '../table/CsvImport';
import { CsvField, normalizeText } from '../../utils/csv';

type SpecStatus = SpecItem['resultOrStatus'];
const SPEC_STATUSES: SpecStatus[] = ['Conforme', 'Aprobado', 'En ensayo', 'Observado', 'No conforme'];

const SPEC_CSV_FIELDS: CsvField[] = [
  { key: 'item', label: 'Ítem', keywords: ['item', 'codigo', 'cod', 'nº', 'numero'] },
  { key: 'description', label: 'Descripción / Material / Ensayo', keywords: ['descripcion', 'material', 'ensayo', 'description'] },
  { key: 'specification', label: 'Especificación / Norma', keywords: ['especificacion', 'norma', 'specification', 'requisito'] },
  { key: 'status', label: 'Estado / Dictamen', keywords: ['estado', 'dictamen', 'resultado', 'status'] },
  { key: 'notes', label: 'Observaciones / Registro', keywords: ['observ', 'registro', 'nota', 'notes'] },
];

const statusFromText = (t: string): SpecStatus => {
  const n = normalizeText(t);
  if (n.startsWith('no conf') || n.includes('rechaz')) return 'No conforme';
  if (n.startsWith('conf')) return 'Conforme';
  if (n.startsWith('aprob')) return 'Aprobado';
  if (n.startsWith('obs')) return 'Observado';
  return 'En ensayo';
};

interface SpecsBlockProps {
  blockId: string;
  title: string;
  numberIndex?: number | null;
  showTitle?: boolean;
  items?: SpecItem[];
  isEditing?: boolean;
  onUpdateTitle?: (title: string) => void;
  onToggleShowTitle?: () => void;
  onUpdateItems?: (items: SpecItem[]) => void;
  onStartEditing?: () => void;
}


const DEFAULT_SPEC_ITEMS: SpecItem[] = [
  {
    id: 'spec-1',
    item: 'E-01',
    description: 'Hormigón H-30 Probetas testigo a 28 días (Vigas nave principal)',
    specification: "f'c ≥ 30.0 MPa (Norma NP 04 001)",
    resultOrStatus: 'Conforme',
    notes: 'Rotura promedio 32.4 MPa. Registro de laboratorio LAB-781.',
  },
  {
    id: 'spec-2',
    item: 'E-02',
    description: 'Mortero tixotrópico de reparación estructural de armaduras',
    specification: 'Adherencia ≥ 2.0 MPa (EN 1504-3)',
    resultOrStatus: 'Aprobado',
    notes: 'Muestra aprobada por Fiscalización SO.DT.',
  },
  {
    id: 'spec-3',
    item: 'E-03',
    description: 'Acero de refuerzo ADN-420 conformado en frío para encamisado',
    specification: 'Límite elástico fy ≥ 420 MPa',
    resultOrStatus: 'En ensayo',
    notes: 'Aguardando reporte de tracción de laboratorio de la FIUNA.',
  },
];

export const SpecsBlock: React.FC<SpecsBlockProps> = ({
  blockId,
  title,
  numberIndex,
  showTitle = true,
  items,
  isEditing = false,
  onUpdateTitle,
  onToggleShowTitle,
  onUpdateItems,
  onStartEditing,
}) => {

  // Datos de ejemplo solo si el bloque nunca tuvo ítems; una tabla vaciada a mano queda vacía.
  const currentItems = items ?? DEFAULT_SPEC_ITEMS;
  const rootRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ rowId: string; index: number; rect: DOMRect } | null>(null);
  const update = (rows: SpecItem[]) => onUpdateItems?.(rows);

  const ops = useRowOps<SpecItem>({
    rows: currentItems,
    onChange: update,
    isEditing,
    idPrefix: 'spec',
    rootRef,
    createRow: (index) => ({
      id: newRowId('spec'),
      item: `E-${String(index + 1).padStart(2, '0')}`,
      description: '',
      specification: '',
      resultOrStatus: 'En ensayo',
      notes: '',
    }),
  });

  const handleItemChange = (id: string, patch: Partial<SpecItem>) =>
    update(currentItems.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  // Fichas de estado con la misma estética que la columna Estado de Pendencias.
  const STATUS_CLS: Record<SpecStatus, string> = {
    'Conforme': 'resuelto',
    'Aprobado': 'ejecucion',
    'En ensayo': 'aguardando',
    'Observado': 'observado',
    'No conforme': 'vencido',
  };
  const STATUS_ICON: Record<SpecStatus, React.ComponentType<{ className?: string }>> = {
    'Conforme': CheckCircle2,
    'Aprobado': BadgeCheck,
    'En ensayo': Clock,
    'Observado': AlertCircle,
    'No conforme': XCircle,
  };
  const getStatusBadge = (status: SpecStatus) => (
    <StatusPill cls={STATUS_CLS[status] ?? 'pendiente'} icon={STATUS_ICON[status]}>{status}</StatusPill>
  );

  const statusOptions: PillOption<SpecStatus>[] = SPEC_STATUSES.map((v) => ({
    value: v,
    label: v,
    render: () => getStatusBadge(v),
  }));

  return (
    <section ref={rootRef} className="nt-root specs-block relative px-5 py-2 shrink-0">
      {/* Universal Section Header Banner */}
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
            <DockButton variant="primary" onClick={() => ops.addRow(currentItems.length - 1)}>
              <Plus /> Agregar ítem de ensayo / material
            </DockButton>
            <CsvImportButton<SpecItem>
              fields={SPEC_CSV_FIELDS}
              templateName="especificaciones"
              title="ítems de ensayo"
              sampleRows={[['E-01', 'Hormigón H-30 probetas a 28 días', "f'c ≥ 30 MPa", 'Conforme', 'Rotura promedio 32,4 MPa']]}
              toRow={(rec) => (rec.description || rec.item ? {
                id: newRowId('spec'),
                item: rec.item,
                description: rec.description,
                specification: rec.specification,
                resultOrStatus: statusFromText(rec.status),
                notes: rec.notes,
              } : null)}
              onImport={(rows, mode) => update(mode === 'append' ? [...currentItems, ...rows] : rows)}
            />
          </EditDock>
          <TableHint gutter />
          <BulkBar ops={ops} noun={['ítem', 'ítems']} masculine />
        </>
      )}


      {/* Tabla con la misma estética que Pendencias y Curva S */}
      <div className="nt-wrap rp-table">
        <table className={`nt-tbl${isEditing ? ' nt-editing' : ''}`}>
          <colgroup>
            <col style={{ width: '9%' }} />
            <col style={{ width: '33%' }} />
            <col style={{ width: '23%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '21%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Ítem</th>
              <th className="left">Descripción / Material / Ensayo</th>
              <th className="left">Especificación / Norma</th>
              <th>Estado / Dictamen</th>
              <th className="left">Observaciones / Registro</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.length === 0 && (
              <tr><td colSpan={5} className="nt-empty">Sin ítems de ensayo. Agregalos desde el panel de edición.</td></tr>
            )}
            {currentItems.map((item, idx) => (
              <tr
                key={item.id}
                className={`${ops.selected.has(item.id) ? 'row-selected ' : ''}${ops.dragOverId === item.id ? 'drag-over' : ''}`}
                {...ops.dragProps(item.id)}
              >
                <td className="nt-gutter" style={{ textAlign: 'center', fontFamily: 'var(--rp-font-num)', fontWeight: 700, color: '#334155' }}>
                  <RowGutter ops={ops} id={item.id} isEditing={isEditing}
                    onOpenMenu={(rect) => setMenu({ rowId: item.id, index: idx, rect })} />
                  <EditableCell value={item.item} row={idx} col={0} isEditing={isEditing} placeholder="Ítem"
                    onCommit={(v) => handleItemChange(item.id, { item: v })} />
                </td>
                <td style={{ color: '#1e293b', fontWeight: 500 }}>
                  <EditableCell value={item.description} row={idx} col={1} isEditing={isEditing} multiline
                    placeholder="Material o ensayo…" onCommit={(v) => handleItemChange(item.id, { description: v })} />
                </td>
                <td style={{ color: '#475569', fontFamily: 'var(--rp-font-num)', fontSize: '7pt' }}>
                  <EditableCell value={item.specification} row={idx} col={2} isEditing={isEditing} multiline
                    placeholder="Especificación / norma…" onCommit={(v) => handleItemChange(item.id, { specification: v })} />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <PillSelectCell value={item.resultOrStatus} options={statusOptions} isEditing={isEditing}
                    row={idx} col={3} caption="Estado / Dictamen"
                    onChange={(v) => handleItemChange(item.id, { resultOrStatus: v })} />
                </td>
                <td style={{ color: '#475569', fontSize: '7pt' }}>
                  <EditableCell value={item.notes || ''} row={idx} col={4} isEditing={isEditing} multiline
                    emptyText="-" placeholder="Observaciones…" onCommit={(v) => handleItemChange(item.id, { notes: v })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RowMenuFor ops={ops} menu={menu} onClose={() => setMenu(null)} noun="ítem" />
    </section>
  );

};
