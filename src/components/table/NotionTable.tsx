import { resolveTokens } from '../../utils/fields';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Copy, X, ArrowUp, ArrowDown, ArrowUpDown, Check } from 'lucide-react';
import { EditDock, DockButton } from '../EditDock';
import './notion-table.css';

/* =====================================================================
   Kit de tabla estilo Notion — piezas compartidas por todos los bloques
   con tablas (Pendencias, Curva S, Situación, Especificaciones, Clima…).

   Mecánica común:
   - Clic en una celda o entrar con Tab/Shift+Tab/Enter/↑↓ → selecciona todo el texto.
   - Segundo clic → cursor libre dentro del texto. Esc → revierte.
   - Fichas (pills): ↑↓ cambian el valor, Enter/Espacio abren el selector.
   - Columna N.º: clic selecciona fila, Shift+clic extiende, Ctrl/Cmd+clic suma.
   - ⋮⋮ arrastra la fila, ··· abre el menú de fila.
   - La navegación queda limitada a la tabla actual (no salta a otros bloques).
   ===================================================================== */

/* ---------- Utilidades ---------- */

export const newRowId = (prefix = 'row') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export const fmtNum = (n?: number | null, decimals = 1) =>
  n == null || isNaN(n) ? '' : Number(n).toFixed(decimals);

export const parseNum = (t?: string | null): number | undefined => {
  const s = String(t ?? '').replace(/%/g, '').replace(/\s/g, '').replace(',', '.').trim();
  if (!s || s === '-' || s === '—') return undefined;
  const n = parseFloat(s);
  return isNaN(n) ? undefined : n;
};

export function selectAllText(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

const getRoot = (el: HTMLElement) => el.closest('.nt-root') as HTMLElement | null;

export function focusCell(root: HTMLElement | null, row: number, col: number): boolean {
  const el = root?.querySelector<HTMLElement>(`[data-nt-cell][data-row="${row}"][data-col="${col}"]`);
  if (el) { el.focus(); return true; }
  return false;
}

/** Mueve el foco a la celda anterior/siguiente en orden de lectura. Devuelve true si había destino. */
function focusSibling(el: HTMLElement, dir: 1 | -1): boolean {
  const root = getRoot(el);
  if (!root) return false;
  const cells = Array.from(root.querySelectorAll<HTMLElement>('[data-nt-cell]'));
  const target = cells[cells.indexOf(el) + dir];
  if (!target) return false;
  setTimeout(() => target.focus(), 0);
  return true;
}

/* ---------- Celda de texto / número ---------- */

export interface EditableCellProps {
  value: string;
  onCommit: (value: string) => void;
  isEditing: boolean;
  row: number;
  col: number;
  placeholder?: string;
  className?: string;
  /** Normaliza el texto al confirmar (ej. formatear números). */
  normalize?: (value: string) => string;
  /** Sufijo visual que no forma parte del valor (ej. "%"). */
  suffix?: string;
  /** Permite saltos de línea con Shift+Enter. */
  multiline?: boolean;
  /** Texto a mostrar fuera de edición cuando la celda está vacía (ej. "-"). */
  emptyText?: string;
}

export const EditableCell: React.FC<EditableCellProps> = ({
  value, onCommit, isEditing, row, col, placeholder, className, normalize, suffix, multiline, emptyText,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const initialRef = useRef('');
  // Datos {clave} y citas [[ref:ID]] se ven resueltos; al entrar a escribir aparece el texto tal cual
  const display = resolveTokens(value);
  const shown = !isEditing && !value && emptyText ? emptyText : display;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if (el.textContent !== shown) el.textContent = shown;
  }, [shown]);

  const commit = (el: HTMLElement) => {
    let t = el.innerText ?? el.textContent ?? '';
    t = multiline ? t.replace(/\n{3,}/g, '\n\n').trim() : t.replace(/\n/g, ' ').trim();
    if (normalize) t = normalize(t);
    if (document.activeElement !== el && el.textContent !== t) el.textContent = resolveTokens(t);
    if (t !== value) onCommit(t);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const root = getRoot(el);
    if (e.key === 'Enter' && !(multiline && e.shiftKey)) {
      e.preventDefault();
      commit(el);
      const d = e.shiftKey ? -1 : 1;
      setTimeout(() => { if (!focusCell(root, row + d, col)) el.blur(); }, 0);
      return;
    }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.shiftKey && !e.altKey && !multiline) {
      e.preventDefault();
      commit(el);
      const d = e.key === 'ArrowDown' ? 1 : -1;
      setTimeout(() => focusCell(root, row + d, col), 0);
      return;
    }
    if (e.key === 'Tab') {
      commit(el);
      if (focusSibling(el, e.shiftKey ? -1 : 1)) e.preventDefault();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      el.textContent = initialRef.current;
      el.blur();
    }
  };

  return (
    <div
      ref={ref}
      className={`nt-cell ${className || ''}`}
      contentEditable={isEditing}
      suppressContentEditableWarning
      tabIndex={isEditing ? 0 : -1}
      data-nt-cell={isEditing ? 'true' : undefined}
      data-row={row}
      data-col={col}
      data-placeholder={placeholder || '—'}
      data-suffix={suffix}
      onMouseDown={(e) => {
        if (!isEditing) return;
        const el = e.currentTarget;
        if (document.activeElement === el) return;
        e.preventDefault();
        el.focus();
        selectAllText(el);
      }}
      onFocus={(e) => {
        const el = e.currentTarget;
        if (display !== value) el.textContent = value; // mostrar {fecha} / [[ref:…]] para editarlos
        initialRef.current = el.textContent || '';
        selectAllText(el);
      }}
      onKeyDown={onKeyDown}
      onPaste={(e) => {
        e.preventDefault();
        let t = e.clipboardData.getData('text/plain') || '';
        if (!multiline) t = t.replace(/\r?\n/g, ' ');
        document.execCommand('insertText', false, t);
      }}
      onBlur={(e) => {
        const el = e.currentTarget;
        commit(el);
        // Si no cambió, React no vuelve a escribir la celda: se pone el texto resuelto a mano
        const t = el.textContent || '';
        const r = resolveTokens(t);
        if (r !== t) el.textContent = r;
      }}
    />
  );
};

/** Celda numérica: acepta coma o punto, formatea al confirmar. */
export const NumberCell: React.FC<Omit<EditableCellProps, 'value' | 'onCommit' | 'normalize'> & {
  value?: number | null;
  onCommit: (value: number | undefined) => void;
  decimals?: number;
  /** Si es true, una celda vacía vale 0 en vez de "sin dato". */
  required?: boolean;
  /** Formato de visualización (ej. coma decimal). Debe poder volver a leerse con parseNum. */
  format?: (n: number) => string;
  /** Limita el valor (ej. 0–100 para porcentajes). */
  min?: number;
  max?: number;
}> = ({ value, onCommit, decimals = 1, required, format, min, max, ...rest }) => {
  const clamp = (n: number | undefined) =>
    n == null ? n : Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  const show = (n: number | undefined | null) => (n == null || isNaN(n) ? '' : format ? format(n) : fmtNum(n, decimals));
  return (
    <EditableCell
      {...rest}
      value={show(value)}
      normalize={(t) => show(clamp(parseNum(t) ?? (required ? 0 : undefined)))}
      onCommit={(t) => onCommit(clamp(parseNum(t) ?? (required ? 0 : undefined)))}
    />
  );
};

/** Formato con coma decimal (es-PY), compatible con parseNum. */
export const fmtEs = (n: number, min = 1, max = 2) =>
  n.toLocaleString('es-PY', { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: false });

/* ---------- Celda con sugerencias (autocompletado de valores ya usados) ---------- */

export const SuggestCell: React.FC<EditableCellProps & { suggestions: string[]; caption?: string }> = ({
  value, onCommit, isEditing, row, col, placeholder, className, suggestions, caption = 'Sugerencias',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const initialRef = useRef('');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hi, setHi] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Datos {clave} y citas [[ref:ID]] se ven resueltos; al entrar a escribir, tal cual
  const display = resolveTokens(value);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if (el.textContent !== display) el.textContent = display;
  }, [display]);

  const list = useMemo(() => {
    const unique = Array.from(new Set(suggestions.map((v) => v.trim()).filter(Boolean)));
    const q = query.trim().toLowerCase();
    return q ? unique.filter((v) => v.toLowerCase().includes(q)) : unique;
  }, [suggestions, query]);

  useEffect(() => { setHi((h) => (list.length === 0 ? 0 : Math.min(h, list.length - 1))); }, [list.length]);

  useEffect(() => {
    if (!open) { setRect(null); return; }
    const update = () => { if (ref.current) setRect(ref.current.getBoundingClientRect()); };
    update();
    document.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => { document.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [open]);

  const commit = (t: string) => { const v = t.trim(); if (v !== value) onCommit(v); };

  const pick = (v: string) => {
    if (ref.current) ref.current.textContent = v;
    commit(v);
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const root = getRoot(el);
    if (open && list.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => (h + 1) % list.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => (h - 1 + list.length) % list.length); return; }
      if (e.key === 'Enter' && query) { e.preventDefault(); pick(list[hi]); return; }
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      commit(el.textContent || '');
      setOpen(false);
      const d = e.shiftKey ? -1 : 1;
      setTimeout(() => { if (!focusCell(root, row + d, col)) el.blur(); }, 0);
      return;
    }
    if (e.key === 'Tab') {
      setOpen(false);
      commit(el.textContent || '');
      if (focusSibling(el, e.shiftKey ? -1 : 1)) e.preventDefault();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (open) { setOpen(false); return; }
      el.textContent = initialRef.current;
      el.blur();
    }
  };

  let menuStyle: React.CSSProperties | null = null;
  if (open && rect && list.length > 0) {
    const width = Math.max(200, rect.width + 40);
    const approxH = Math.min(220, 32 + list.length * 28);
    let x = rect.left;
    let y = rect.bottom + 4;
    if (x + width > window.innerWidth - 12) x = window.innerWidth - width - 12;
    if (y + approxH > window.innerHeight - 12) y = Math.max(12, rect.top - approxH - 4);
    menuStyle = { left: Math.max(12, x), top: y, width };
  }

  return (
    <>
      <div
        ref={ref}
        className={`nt-cell has-suggest ${className || ''}`}
        contentEditable={isEditing}
        suppressContentEditableWarning
        tabIndex={isEditing ? 0 : -1}
        data-nt-cell={isEditing ? 'true' : undefined}
        data-row={row}
        data-col={col}
        data-placeholder={placeholder || '—'}
        onMouseDown={(e) => {
          if (!isEditing) return;
          const el = e.currentTarget;
          if (document.activeElement === el) return;
          e.preventDefault();
          el.focus();
          selectAllText(el);
        }}
        onFocus={(e) => {
          if (display !== value) e.currentTarget.textContent = value;
          initialRef.current = e.currentTarget.textContent || '';
          selectAllText(e.currentTarget);
          setQuery('');
          setHi(0);
          setOpen(true);
        }}
        onInput={(e) => {
          const t = e.currentTarget.textContent || '';
          // Escribiendo un @: manda la lista de citas y datos, no la de sugerencias
          if (/(^|[^\w@])@[\p{L}\p{N}_-]*$/u.test(t)) { setOpen(false); return; }
          setQuery(t === initialRef.current ? '' : t);
          setOpen(true);
          setHi(0);
        }}
        onKeyDown={onKeyDown}
        onPaste={(e) => {
          e.preventDefault();
          document.execCommand('insertText', false, (e.clipboardData.getData('text/plain') || '').replace(/\r?\n/g, ' '));
        }}
        onBlur={(e) => {
          const el = e.currentTarget;
          const t = el.textContent || '';
          commit(t);
          setOpen(false);
          const r = resolveTokens(t.trim());
          if (r !== t) el.textContent = r;
        }}
      />
      {menuStyle && createPortal(
        <div className="nt-menu" style={menuStyle} onMouseDown={(e) => e.preventDefault()}>
          <div className="nt-menu-caption"><span>{caption}</span><span className="nt-menu-caption-hint">↑↓ · Enter</span></div>
          <div className="nt-menu-list">
            {list.map((s, i) => (
              <button key={s} type="button" className={`nt-menu-opt${i === hi ? ' active' : ''}`}
                onMouseEnter={() => setHi(i)} onClick={() => pick(s)}>
                <span className="nt-menu-opt-text">{s}</span>
                {i === hi && <span className="nt-menu-opt-key">↵</span>}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

/* ---------- Ficha de estado con ícono (misma en todos los módulos) ---------- */

export const StatusPill: React.FC<{ cls: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }> = ({
  cls, icon: IconCmp, children,
}) => (
  <span className={`nt-pill status ${cls}`}>
    {IconCmp && <IconCmp />}
    {children !== '' && children != null && <span className="nt-pill-txt">{children}</span>}
  </span>
);

/* ---------- Ficha con selector ---------- */

export interface PillOption<T extends string> {
  value: T;
  label: string;
  /** Cómo se dibuja la ficha (badge). Si no se da, se usa <span className="nt-pill {cls}">. */
  render?: () => React.ReactNode;
  /** Cómo se dibuja dentro de la lista desplegable (si difiere de la ficha, ej. una ilustración grande). */
  menu?: () => React.ReactNode;
  cls?: string;
}

const renderPill = <T extends string>(o: PillOption<T>) =>
  o.render ? o.render() : <span className={`nt-pill ${o.cls || ''}`}>{o.label}</span>;

const FloatingMenu: React.FC<{ anchor: HTMLElement | null; onClose: () => void; caption?: string; children: React.ReactNode }> = ({
  anchor, onClose, caption, children,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const r = anchor.getBoundingClientRect();
    const m = ref.current.getBoundingClientRect();
    let left = r.left, top = r.bottom + 6;
    if (left + m.width > window.innerWidth - 12) left = window.innerWidth - m.width - 12;
    if (top + m.height > window.innerHeight - 12) top = Math.max(12, r.top - m.height - 6);
    setPos({ x: Math.max(12, left), y: Math.max(12, top) });
  }, [anchor]);
  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node) || anchor?.contains(e.target as Node)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [onClose, anchor]);
  return createPortal(
    <div ref={ref} className="nt-menu" role="listbox"
      style={{ left: pos?.x ?? 0, top: pos?.y ?? 0, visibility: pos ? 'visible' : 'hidden' }}>
      {caption && <div className="nt-menu-caption">{caption}</div>}
      <div className="nt-menu-list">{children}</div>
    </div>,
    document.body
  );
};

export const PillSelectCell = <T extends string>({
  value, options, onChange, isEditing, row, col, caption,
}: {
  value: T;
  options: PillOption<T>[];
  onChange: (value: T) => void;
  isEditing: boolean;
  row: number;
  col: number;
  caption: string;
}) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  if (!isEditing) return <>{renderPill(current)}</>;

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (open) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const i = options.findIndex((o) => o.value === value);
      const d = e.key === 'ArrowDown' ? 1 : -1;
      onChange(options[(i + d + options.length) % options.length].value);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); return; }
    if (e.key === 'Tab') {
      if (focusSibling(e.currentTarget, e.shiftKey ? -1 : 1)) e.preventDefault();
    }
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="nt-pill-btn"
        data-nt-cell="true"
        data-row={row}
        data-col={col}
        onKeyDown={onKeyDown}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={`${caption}: ${current.label} · ↑↓ cambia · Enter abre`}
      >
        {renderPill(current)}
      </button>
      {open && (
        <FloatingMenu anchor={btnRef.current} caption={caption}
          onClose={() => { setOpen(false); btnRef.current?.focus(); }}>
          {options.map((o) => (
            <button key={o.value} type="button" className="nt-menu-opt"
              onClick={() => { onChange(o.value); setOpen(false); btnRef.current?.focus(); }}>
              {o.menu ? o.menu() : renderPill(o)}
              {o.value === value && <Check className="nt-menu-check" strokeWidth={3} />}
            </button>
          ))}
        </FloatingMenu>
      )}
    </>
  );
};

/* ---------- Estado de filas: selección, arrastre, alta, duplicado, borrado ---------- */

export interface RowOps<T> {
  selected: Set<string>;
  allSelected: boolean;
  dragOverId: string | null;
  toggleRow: (id: string, e: React.MouseEvent) => void;
  toggleAll: () => void;
  clearSelection: () => void;
  addRow: (afterIndex: number) => void;
  duplicateRow: (id: string) => void;
  deleteRow: (id: string) => void;
  moveRow: (id: string, dir: -1 | 1) => void;
  bulkDelete: () => void;
  bulkDuplicate: () => void;
  dragProps: (id: string) => {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
  };
  handleProps: (id: string) => { onDragStart: (e: React.DragEvent) => void; onDragEnd: () => void };
}

export function useRowOps<T extends { id: string }>({
  rows, onChange, isEditing, createRow, idPrefix = 'row', rootRef,
}: {
  rows: T[];
  onChange: (rows: T[]) => void;
  isEditing: boolean;
  createRow: (index: number) => T;
  idPrefix?: string;
  /** Si se pasa, al agregar una fila se enfoca su primera celda. */
  rootRef?: React.RefObject<HTMLElement | null>;
}): RowOps<T> {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => { if (!isEditing) { setSelected(new Set()); setAnchorId(null); } }, [isEditing]);
  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(rows.map((r) => r.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [rows]);

  const copy = (r: T): T => ({ ...r, id: newRowId(idPrefix) });

  const ops: RowOps<T> = {
    selected,
    allSelected: rows.length > 0 && selected.size === rows.length,
    dragOverId,
    toggleRow: (id, e) => {
      e.stopPropagation();
      setSelected((prev) => {
        const next = new Set(prev);
        if (e.shiftKey && anchorId) {
          const ids = rows.map((r) => r.id);
          const a = ids.indexOf(anchorId), b = ids.indexOf(id);
          if (a >= 0 && b >= 0) {
            for (let i = Math.min(a, b); i <= Math.max(a, b); i++) next.add(ids[i]);
            return next;
          }
        }
        if (e.metaKey || e.ctrlKey) { if (next.has(id)) next.delete(id); else next.add(id); }
        else if (next.has(id)) next.delete(id);
        else { next.clear(); next.add(id); }
        return next;
      });
      setAnchorId(id);
    },
    toggleAll: () => {
      if (rows.length > 0 && selected.size === rows.length) { setSelected(new Set()); setAnchorId(null); }
      else { setSelected(new Set(rows.map((r) => r.id))); setAnchorId(rows[0]?.id ?? null); }
    },
    clearSelection: () => { setSelected(new Set()); setAnchorId(null); },
    addRow: (afterIndex) => {
      const next = [...rows];
      next.splice(afterIndex + 1, 0, createRow(afterIndex + 1));
      onChange(next);
      if (rootRef) setTimeout(() => focusCell(rootRef.current, afterIndex + 1, 0), 30);
    },
    duplicateRow: (id) => {
      const i = rows.findIndex((r) => r.id === id);
      if (i < 0) return;
      const next = [...rows];
      next.splice(i + 1, 0, copy(rows[i]));
      onChange(next);
    },
    deleteRow: (id) => onChange(rows.filter((r) => r.id !== id)),
    moveRow: (id, dir) => {
      const i = rows.findIndex((r) => r.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= rows.length) return;
      const next = [...rows];
      const [m] = next.splice(i, 1);
      next.splice(j, 0, m);
      onChange(next);
    },
    bulkDelete: () => {
      if (!selected.size) return;
      onChange(rows.filter((r) => !selected.has(r.id)));
      setSelected(new Set()); setAnchorId(null);
    },
    bulkDuplicate: () => {
      if (!selected.size) return;
      const out: T[] = [];
      rows.forEach((r) => { out.push(r); if (selected.has(r.id)) out.push(copy(r)); });
      onChange(out);
      setSelected(new Set()); setAnchorId(null);
    },
    dragProps: (id) => ({
      onDragOver: (e) => {
        if (!draggedId || draggedId === id) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverId(id);
      },
      onDragLeave: () => setDragOverId(null),
      onDrop: (e) => {
        e.preventDefault();
        if (draggedId && draggedId !== id) {
          const from = rows.findIndex((r) => r.id === draggedId);
          const to = rows.findIndex((r) => r.id === id);
          if (from >= 0 && to >= 0) {
            const next = [...rows];
            const [m] = next.splice(from, 1);
            next.splice(to, 0, m);
            onChange(next);
          }
        }
        setDraggedId(null);
        setDragOverId(null);
      },
    }),
    handleProps: (id) => ({
      onDragStart: (e) => {
        setDraggedId(id);
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', id); } catch { /* noop */ }
      },
      onDragEnd: () => { setDraggedId(null); setDragOverId(null); },
    }),
  };
  return ops;
}

/* ---------- Encabezado y celda N.º ---------- */

export const NumHeader: React.FC<{ ops: RowOps<any>; isEditing: boolean; count: number; label?: string }> = ({
  ops, isEditing, count, label = 'N.º',
}) => (
  <div className="nt-num-inner">
    {isEditing && count > 0 && (
      <button type="button" className="nt-btn-all" onClick={ops.toggleAll}
        title={ops.allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}>
        {ops.allSelected && <Check strokeWidth={3} />}
      </button>
    )}
    <span>{label}</span>
  </div>
);

export const NumCell: React.FC<{
  ops: RowOps<any>;
  id: string;
  index: number;
  isEditing: boolean;
  onOpenMenu: (rect: DOMRect) => void;
  /** Lo que se muestra en la celda (por defecto el número de fila). */
  label?: React.ReactNode;
  className?: string;
}> = ({ ops, id, index, isEditing, onOpenMenu, label, className }) => {
  const isSel = ops.selected.has(id);
  return (
    <td
      className={`nt-cell-num${isEditing ? ' editable' : ''} ${className || ''}`}
      onClick={(e) => isEditing && ops.toggleRow(id, e)}
      title={isEditing ? 'Clic para seleccionar · Shift para extender' : undefined}
    >
      {isEditing && (
        <div className="nt-row-tools">
          <button type="button" className="nt-edge-btn drag" draggable {...ops.handleProps(id)}
            onClick={(e) => e.stopPropagation()} title="Arrastrar para reordenar" aria-label="Reordenar fila">⋮⋮</button>
          <button type="button" className="nt-edge-btn"
            onClick={(e) => { e.stopPropagation(); onOpenMenu(e.currentTarget.getBoundingClientRect()); }}
            title="Acciones de fila" aria-label="Acciones de fila">···</button>
        </div>
      )}
      <div className="nt-num-inner">
        {isEditing && <span className={`nt-chk${isSel ? ' on' : ''}`}>{isSel && <Check strokeWidth={3} />}</span>}
        <span>{label ?? index + 1}</span>
      </div>
    </td>
  );
};

/**
 * Herramientas de fila para tablas SIN columna N.º (mantienen su estética).
 * Se ubican fuera del borde izquierdo de la primera celda, que debe llevar la clase "nt-gutter".
 * Clic en ⋮⋮ selecciona la fila (Shift extiende, Ctrl/Cmd suma); arrastrarlo la mueve.
 */
export const RowGutter: React.FC<{
  ops: RowOps<any>;
  id: string;
  isEditing: boolean;
  onOpenMenu: (rect: DOMRect) => void;
}> = ({ ops, id, isEditing, onOpenMenu }) => {
  if (!isEditing) return null;
  const isSel = ops.selected.has(id);
  return (
    <div className="nt-row-tools no-print">
      <button type="button" className={`nt-edge-btn drag${isSel ? ' on' : ''}`} draggable {...ops.handleProps(id)}
        onClick={(e) => ops.toggleRow(id, e)}
        title="Clic para seleccionar (Shift extiende) · Arrastrar para reordenar" aria-label="Seleccionar o reordenar fila">⋮⋮</button>
      <button type="button" className="nt-edge-btn"
        onClick={(e) => { e.stopPropagation(); onOpenMenu(e.currentTarget.getBoundingClientRect()); }}
        title="Acciones de fila" aria-label="Acciones de fila">···</button>
    </div>
  );
};

/* ---------- Menú de fila ---------- */

export interface RowMenuExtra { label: string; icon?: React.ReactNode; onClick: () => void }

export const RowMenu: React.FC<{
  rect: DOMRect;
  onClose: () => void;
  onAddAbove: () => void;
  onAddBelow: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  noun?: string;
  /** Acciones propias del bloque (ej. "Marcar como grupo"). */
  extra?: RowMenuExtra[];
}> = ({ rect, onClose, onAddAbove, onAddBelow, onMoveUp, onMoveDown, onDuplicate, onDelete, noun = 'fila', extra }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: rect.right + 6, y: rect.top });

  useLayoutEffect(() => {
    if (!ref.current) return;
    const m = ref.current.getBoundingClientRect();
    let x = rect.right + 6, y = rect.top;
    if (x + m.width > window.innerWidth - 12) x = Math.max(12, rect.left - m.width - 6);
    if (y + m.height > window.innerHeight - 12) y = Math.max(12, window.innerHeight - m.height - 12);
    setPos({ x, y });
  }, [rect]);

  useEffect(() => {
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [onClose]);

  const run = (fn: () => void) => () => { fn(); onClose(); };

  return createPortal(
    <div ref={ref} className="nt-menu no-print" style={{ left: pos.x, top: pos.y }}>
      <button type="button" className="nt-menu-opt" onClick={run(onAddAbove)}><Plus /> Agregar {noun} arriba</button>
      <button type="button" className="nt-menu-opt" onClick={run(onAddBelow)}><Plus /> Agregar {noun} abajo</button>
      <div className="nt-menu-sep" />
      <button type="button" className="nt-menu-opt" onClick={run(onMoveUp)}><ArrowUp /> Mover arriba</button>
      <button type="button" className="nt-menu-opt" onClick={run(onMoveDown)}><ArrowDown /> Mover abajo</button>
      <button type="button" className="nt-menu-opt" onClick={run(onDuplicate)}><Copy /> Duplicar {noun}</button>
      {extra && extra.length > 0 && (
        <>
          <div className="nt-menu-sep" />
          {extra.map((x) => (
            <button key={x.label} type="button" className="nt-menu-opt" onClick={run(x.onClick)}>{x.icon}{x.label}</button>
          ))}
        </>
      )}
      <div className="nt-menu-sep" />
      <button type="button" className="nt-menu-opt danger" onClick={run(onDelete)}><Trash2 /> Eliminar {noun}</button>
    </div>,
    document.body
  );
};

/** Menú de fila conectado a las operaciones estándar. */
export const RowMenuFor: React.FC<{
  ops: RowOps<any>;
  menu: { rowId: string; index: number; rect: DOMRect } | null;
  onClose: () => void;
  noun?: string;
  /** Acciones extra según la fila abierta. */
  extra?: (rowId: string) => RowMenuExtra[];
}> = ({ ops, menu, onClose, noun, extra }) => menu ? (
  <RowMenu
    rect={menu.rect}
    noun={noun}
    extra={extra?.(menu.rowId)}
    onClose={onClose}
    onAddAbove={() => ops.addRow(menu.index - 1)}
    onAddBelow={() => ops.addRow(menu.index)}
    onMoveUp={() => ops.moveRow(menu.rowId, -1)}
    onMoveDown={() => ops.moveRow(menu.rowId, 1)}
    onDuplicate={() => ops.duplicateRow(menu.rowId)}
    onDelete={() => ops.deleteRow(menu.rowId)}
  />
) : null;

/* ---------- Barra de filas seleccionadas (va al panel flotante) ---------- */

export const BulkBar: React.FC<{ ops: RowOps<any>; noun?: [string, string]; masculine?: boolean }> = ({
  ops, noun = ['fila', 'filas'], masculine,
}) => {
  const n = ops.selected.size;
  if (!n) return null;
  const adj = (masculine ? 'seleccionado' : 'seleccionada') + (n === 1 ? '' : 's');
  return (
    <EditDock slot="bulk">
      <span className="dock-count">{n} {n === 1 ? noun[0] : noun[1]} {adj}</span>
      <DockButton className="bulk-dup" onClick={ops.bulkDuplicate}><Copy /> Duplicar</DockButton>
      <DockButton className="bulk-del" onClick={ops.bulkDelete}><Trash2 /> Eliminar</DockButton>
      <button type="button" className="dock-close" onClick={ops.clearSelection} title="Cancelar selección"><X /></button>
    </EditDock>
  );
};

/** Ayuda de teclado estándar para el panel flotante. */
export const TableHint: React.FC<{ gutter?: boolean; sortable?: boolean }> = ({ gutter, sortable }) => (
  <EditDock slot="hint">
    <span>Clic o Tab seleccionan todo el texto</span>
    <span>Enter / ↑↓ cambian de fila</span>
    <span><kbd>⋮⋮</kbd> {gutter ? 'clic selecciona · arrastrar mueve' : 'arrastra'}</span>
    <span><kbd>···</kbd> acciones de fila</span>
    {!gutter && <span>Clic en N.º selecciona · Shift extiende</span>}
    {sortable && <span>Clic en un título ordena (otra vez invierte)</span>}
  </EditDock>
);

/* ---------- Ordenar por columna (clic en el título de la columna) ----------
   Ordena las filas de verdad (el informe se imprime en ese orden). Primer clic:
   ascendente, segundo: descendente. Si después se reordena a mano, la flecha
   desaparece porque la tabla ya no está ordenada por esa columna. */

export type SortDir = 'asc' | 'desc';
export type SortValue = string | number | null | undefined;

const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

/** Compara dos valores; los vacíos van siempre al final. */
export function compareSortValues(a: SortValue, b: SortValue, dir: SortDir): number {
  const ea = a == null || a === '', eb = b == null || b === '';
  if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;
  const r = typeof a === 'number' && typeof b === 'number' ? a - b : collator.compare(String(a), String(b));
  return dir === 'asc' ? r : -r;
}

/** Fecha dd/mm/aaaa (o dd/mm, dd-mm-aa, aaaa-mm-dd) → número ordenable; texto libre → null (va al final). */
export function dateSortValue(t?: string | null): number | null {
  const s = (t || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return +m[1] * 10000 + +m[2] * 100 + +m[3];
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/);
  if (!m) return null;
  const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : 0;
  return y * 10000 + +m[2] * 100 + +m[1];
}

export function useColumnSort<T extends { id: string }, K extends string>({
  rows, onChange, getValue,
}: {
  rows: T[];
  onChange: (rows: T[]) => void;
  /** Valor de la fila para cada columna ordenable. */
  getValue: (row: T, key: K) => SortValue;
}) {
  const [sort, setSort] = useState<{ key: K; dir: SortDir; ids: string } | null>(null);
  const idsKey = rows.map((r) => r.id).join('|');
  // Si el orden cambió por otra vía (arrastre, alta, borrado), deja de mostrarse como ordenada
  const active = sort && sort.ids === idsKey ? sort : null;

  const sortBy = (key: K) => {
    const dir: SortDir = active?.key === key && active.dir === 'asc' ? 'desc' : 'asc';
    const sorted = rows
      .map((r, i) => ({ r, i }))
      .sort((x, y) => compareSortValues(getValue(x.r, key), getValue(y.r, key), dir) || x.i - y.i)
      .map((x) => x.r);
    setSort({ key, dir, ids: sorted.map((r) => r.id).join('|') });
    if (sorted.some((r, i) => r !== rows[i])) onChange(sorted);
  };
  return { sortKey: active?.key ?? null, sortDir: active?.dir ?? null, sortBy };
}

/**
 * Título de columna que ordena al hacer clic (solo en edición). La flecha va superpuesta
 * al borde derecho de la celda, así que el título no se corre ni cambia de tamaño.
 */
export const SortHeader: React.FC<{
  label: React.ReactNode;
  isEditing: boolean;
  dir: SortDir | null;
  onSort: () => void;
}> = ({ label, isEditing, dir, onSort }) => {
  if (!isEditing) return <>{label}</>;
  const Icon = dir === 'asc' ? ArrowUp : dir === 'desc' ? ArrowDown : ArrowUpDown;
  return (
    <>
    <span className="nt-sort-ghost" aria-hidden="true">{label}</span>
    <button type="button" className={`nt-sort${dir ? ' on' : ''}`} onClick={onSort}
      title={dir === 'asc' ? 'Ordenado A→Z · clic para invertir' : dir === 'desc' ? 'Ordenado Z→A · clic para invertir' : 'Clic para ordenar por esta columna'}>
      <span className="nt-sort-label">{label}</span>
      <Icon className="nt-sort-ic" />
    </button>
    </>
  );
};
