import React, { useRef, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { SignatureItem } from '../../types';
import { SectionHeaderBanner } from '../SectionHeaderBanner';
import { EditDock, DockButton } from '../EditDock';
import {
  EditableCell,
  useRowOps,
  NumHeader,
  NumCell,
  RowMenuFor,
  BulkBar,
  TableHint,
  newRowId,
} from '@/src/components/table/NotionTable';

interface SignaturesBlockProps {
  blockId: string;
  title: string;
  numberIndex?: number | null;
  showTitle?: boolean;
  items?: SignatureItem[];
  isEditing?: boolean;
  onUpdateTitle?: (title: string) => void;
  onToggleShowTitle?: () => void;
  onUpdateItems?: (items: SignatureItem[]) => void;
  onStartEditing?: () => void;
}

const DEFAULT_SIGNATURE_ITEMS: SignatureItem[] = [
  {
    id: 'sig-1',
    roleTitle: 'Superintendencia de Obras - SO.DT',
    name: 'Ing. Fiscalizador Principal',
    licenseNumber: 'Reg. Prof. MOPC Nº 8.421',
    institution: 'Dirección Técnica · Fiscalización',
  },
  {
    id: 'sig-2',
    roleTitle: 'Fiscalización de Campo',
    name: 'Ing. Residente de Inspección',
    licenseNumber: 'Reg. Prof. MOPC Nº 12.905',
    institution: 'Fiscalización de Obras Civiles',
  },
  {
    id: 'sig-3',
    roleTitle: 'Director Técnico de Obra',
    name: 'Ing. Representante Técnico',
    licenseNumber: 'Reg. Prof. MOPC Nº 6.180',
    institution: 'Consorcio San Blas (Contratista)',
  },
];

export const SignaturesBlock: React.FC<SignaturesBlockProps> = ({
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
  const currentItems: SignatureItem[] =
    items && items.length > 0 ? items : DEFAULT_SIGNATURE_ITEMS;

  const rootRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ rowId: string; index: number; rect: DOMRect } | null>(null);

  const ops = useRowOps<SignatureItem>({
    rows: currentItems,
    onChange: (rows) => onUpdateItems?.(rows),
    isEditing,
    idPrefix: 'sig',
    rootRef,
    createRow: () => ({
      id: newRowId('sig'),
      roleTitle: 'Nuevo Cargo',
      name: 'Nombre del Profesional',
      licenseNumber: 'Reg. Prof. Nº 00.000',
      institution: 'Institución',
    }),
  });

  const change = (id: string, patch: Partial<SignatureItem>) =>
    onUpdateItems?.(currentItems.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const colsClass =
    currentItems.length === 1
      ? 'grid-cols-1 max-w-sm mx-auto'
      : currentItems.length === 2
      ? 'grid-cols-2'
      : currentItems.length === 3
      ? 'grid-cols-3'
      : 'grid-cols-2 sm:grid-cols-4';

  return (
    <div ref={rootRef} className="signatures-block relative px-5 py-2">
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
            <DockButton variant="primary" onClick={() => ops.addRow(currentItems.length - 1)}>
              <Plus /> Agregar Firmante
            </DockButton>
            <DockButton onClick={() => onUpdateItems?.(DEFAULT_SIGNATURE_ITEMS)}>
              <Users /> Restablecer por Defecto
            </DockButton>
          </EditDock>
          <TableHint />
          <BulkBar ops={ops} noun={['firmante', 'firmantes']} masculine />
        </>
      )}

      {isEditing ? (
        <div
          className="nt-wrap rp-table mt-2"
          onClick={() => { if (!isEditing) onStartEditing?.(); }}
        >
          <table className="nt-tbl nt-editing">
            <colgroup>
              <col style={{ width: '6%' }} />
              <col style={{ width: '26%' }} />
              <col style={{ width: '26%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '22%' }} />
            </colgroup>
            <thead>
              <tr>
                <th><NumHeader ops={ops} isEditing count={currentItems.length} /></th>
                <th className="left">Cargo / Rol</th>
                <th className="left">Nombre y Título</th>
                <th className="left">Reg. Prof.</th>
                <th className="left">Institución</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length === 0 ? (
                <tr><td colSpan={5} className="nt-empty">Sin firmantes. Agregá uno con el botón.</td></tr>
              ) : currentItems.map((item, idx) => (
                <tr
                  key={item.id}
                  className={`${ops.selected.has(item.id) ? 'row-selected ' : ''}${ops.dragOverId === item.id ? 'drag-over' : ''}`}
                  {...ops.dragProps(item.id)}
                >
                  <NumCell
                    ops={ops}
                    id={item.id}
                    index={idx}
                    isEditing={isEditing}
                    onOpenMenu={(rect) => setMenu({ rowId: item.id, index: idx, rect })}
                  />
                  <td>
                    <EditableCell
                      value={item.roleTitle}
                      row={idx} col={0} isEditing={isEditing}
                      placeholder="Cargo / Rol"
                      className="font-semibold text-[var(--rp-primary)]"
                      onCommit={(v) => change(item.id, { roleTitle: v })}
                    />
                  </td>
                  <td>
                    <EditableCell
                      value={item.name}
                      row={idx} col={1} isEditing={isEditing}
                      placeholder="Nombre completo"
                      className="font-bold"
                      onCommit={(v) => change(item.id, { name: v })}
                    />
                  </td>
                  <td>
                    <EditableCell
                      value={item.licenseNumber || ''}
                      row={idx} col={2} isEditing={isEditing}
                      placeholder="Reg. Prof. Nº …"
                      className="font-mono text-[7pt]"
                      onCommit={(v) => change(item.id, { licenseNumber: v })}
                    />
                  </td>
                  <td>
                    <EditableCell
                      value={item.institution || ''}
                      row={idx} col={3} isEditing={isEditing}
                      placeholder="Institución"
                      className="text-slate-500"
                      onCommit={(v) => change(item.id, { institution: v })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className={`grid gap-4 ${colsClass} pt-2`}
          onClick={() => onStartEditing?.()}
          style={onStartEditing ? { cursor: 'pointer' } : undefined}
        >
          {currentItems.map((signer) => (
            <div key={signer.id} className="flex flex-col items-center text-center p-2">
              <div className="w-full flex flex-col items-center mb-1.5">
                <div className="h-10 w-full flex items-center justify-center text-[7pt] text-slate-300 italic select-none">
                  [ Firma y Sello ]
                </div>
                <div className="w-4/5 border-b border-slate-700 my-1" />
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[7.5pt] font-bold text-slate-900 leading-tight">
                  {signer.name}
                </span>
                <span className="text-[7pt] font-semibold text-[var(--rp-primary)] leading-tight">
                  {signer.roleTitle}
                </span>
                {signer.licenseNumber && (
                  <span className="text-[6.5pt] font-mono text-slate-600 leading-tight mt-0.5">
                    {signer.licenseNumber}
                  </span>
                )}
                {signer.institution && (
                  <span className="text-[6pt] text-slate-500 leading-tight">
                    {signer.institution}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <RowMenuFor ops={ops} menu={menu} onClose={() => setMenu(null)} noun="firmante" />
    </div>
  );
};
