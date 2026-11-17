import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import {
  BetweenHorizontalStart, BetweenHorizontalEnd, BetweenVerticalStart, BetweenVerticalEnd,
  TableCellsMerge, TableCellsSplit, AlignLeft, AlignCenter, AlignRight, Trash2, Minus, Rows3, PanelTop, Captions,
} from 'lucide-react';
import { EditDock } from './EditDock';
import { UiPop } from './UiPop';
import {
  TableModel, Align, readTableDom, layoutSpans, alignAttr, insertRow, insertCol, deleteRow, deleteCol,
  mergeRect, splitCell, regionOf, DEFAULT_OPTS,
} from '../utils/mdTable';
import { TABLE_CAPTION } from '../utils/refs';
import './table-tools.css';

/* =====================================================================
   Tablas en el editor con formato (Texto libre, Observaciones):
   barra con filas, columnas, encabezado, filas alternadas, alineación,
   título numerado y combinar / dividir celdas. Se edita sobre el HTML del
   editor y al terminar cada acción se guarda como texto (utils/mdTable).
   ===================================================================== */

export interface TableToolsHandle {
  /** Inserta una tabla nueva de filas × columnas en el cursor */
  insert: (rows: number, cols: number) => void;
  /** Tab / Shift+Tab dentro de una tabla: pasa de celda (y en la última agrega una fila). true = la usó */
  onKey: (e: React.KeyboardEvent) => boolean;
}

type Pos = [number, number];

/** Posición en la grilla de cada celda (contando las combinadas) */
function positions(table: HTMLTableElement): Map<HTMLTableCellElement, Pos> {
  const map = new Map<HTMLTableCellElement, Pos>();
  const taken: boolean[][] = [];
  Array.from(table.rows).forEach((tr, r) => {
    taken[r] = taken[r] || [];
    let c = 0;
    Array.from(tr.cells).forEach((td) => {
      while (taken[r][c]) c++;
      map.set(td, [r, c]);
      for (let dr = 0; dr < (td.rowSpan || 1); dr++) {
        taken[r + dr] = taken[r + dr] || [];
        for (let dc = 0; dc < (td.colSpan || 1); dc++) taken[r + dr][c + dc] = true;
      }
      c += td.colSpan || 1;
    });
  });
  return map;
}

/** HTML de la tabla del editor (mismas clases y atributos que dibuja RichText) */
export function tableHtml(m: TableModel): string {
  const W = m.cells[0]?.length ?? 1;
  const head = m.opts.header ? m.cells.slice(0, 1) : [];
  const body = m.opts.header ? m.cells.slice(1) : m.cells;
  const rows = (grid: string[][], tag: 'th' | 'td') => layoutSpans(grid).map((row) => `<tr>${row.map((cell, k) => {
    if (!cell) return '';
    const a = m.align[k];
    return `<${tag}${cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : ''}${cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : ''}${a ? ` style="text-align:${a}"` : ''}>${cell.text || '<br>'}</${tag}>`;
  }).join('')}</tr>`).join('');
  return `<table class="rp-md-table nt-tbl${m.opts.alt ? ' rp-md-alt' : ''}${m.opts.header ? '' : ' is-nohead'}" data-align="${alignAttr(Array.from({ length: W }, (_, k) => m.align[k] ?? null))}"${m.opts.header ? '' : ' data-noheader="1"'}${m.opts.alt ? ' data-alt="1"' : ''}>${head.length ? `<thead>${rows(head, 'th')}</thead>` : ''}<tbody>${rows(body, 'td')}</tbody></table>`;
}

const caretIn = (td: Element | null | undefined, atEnd = true) => {
  if (!td) return;
  const r = document.createRange();
  r.selectNodeContents(td);
  r.collapse(!atEnd);
  const s = getSelection();
  s?.removeAllRanges();
  s?.addRange(r);
};

const cellAt = (table: HTMLTableElement, p: Pos): HTMLTableCellElement | undefined => {
  for (const [td, q] of positions(table)) if (q[0] === p[0] && q[1] === p[1]) return td;
  return undefined;
};

export const TableTools = forwardRef<TableToolsHandle, { root: React.RefObject<HTMLDivElement | null>; onChanged: () => void; active: boolean }>(
  function TableTools({ root, onChanged, active }, fwd) {
    const [cur, setCur] = useState<{ table: HTMLTableElement; td: HTMLTableCellElement; a?: Pos; b?: Pos } | null>(null);

    // ¿El cursor está en una tabla? (y qué celdas abarca la selección)
    useEffect(() => {
      if (!active) { setCur(null); return; }
      const onSel = () => {
        const el = root.current;
        const s = getSelection();
        if (!el || !s || !s.rangeCount || !el.contains(s.anchorNode)) { setCur((c) => (c && el?.contains(document.activeElement) ? c : null)); return; }
        const cellOf = (n: Node | null) => (n && (n.nodeType === 1 ? (n as Element) : n.parentElement)?.closest('td,th')) as HTMLTableCellElement | null;
        const ta = cellOf(s.anchorNode), tb = cellOf(s.focusNode);
        el.querySelectorAll('.is-sel').forEach((x) => x.classList.remove('is-sel'));
        if (!ta || !el.contains(ta)) { setCur(null); return; }
        const table = ta.closest('table') as HTMLTableElement;
        if (tb && tb !== ta && tb.closest('table') === table) {
          const pos = positions(table);
          const a = pos.get(ta)!, b = pos.get(tb)!;
          const r0 = Math.min(a[0], b[0]), r1 = Math.max(a[0], b[0]), c0 = Math.min(a[1], b[1]), c1 = Math.max(a[1], b[1]);
          for (const [td, p] of pos) if (p[0] >= r0 && p[0] <= r1 && p[1] >= c0 && p[1] <= c1) td.classList.add('is-sel');
          setCur({ table, td: ta, a, b });
        } else setCur({ table, td: ta });
      };
      document.addEventListener('selectionchange', onSel);
      return () => {
        document.removeEventListener('selectionchange', onSel);
        root.current?.querySelectorAll('.is-sel').forEach((x) => x.classList.remove('is-sel'));
      };
    }, [active, root]);

    const model = (table: HTMLTableElement) => readTableDom(table, (td) => td.innerHTML.replace(/^<br\s*\/?>$/i, ''));

    /** Reemplaza la tabla por la del modelo, guarda y deja el cursor en la celda p */
    const write = (table: HTMLTableElement, m: TableModel, p: Pos) => {
      const box = document.createElement('div');
      box.innerHTML = tableHtml(m);
      const next = box.firstElementChild as HTMLTableElement;
      table.replaceWith(next);
      onChanged();
      const g = regionOf(m.cells, Math.min(p[0], m.cells.length - 1), Math.min(p[1], (m.cells[0]?.length ?? 1) - 1));
      const td = cellAt(next, [g.r0, g.c0]);
      caretIn(td);
      if (td) setCur({ table: next, td });
    };

    /** Celda donde está el cursor AHORA (el estado puede llegar un instante tarde al escribir rápido) */
    const liveCell = (): HTMLTableCellElement | null => {
      const s = getSelection();
      const n = s?.anchorNode;
      const td = n ? ((n.nodeType === 1 ? (n as Element) : n.parentElement)?.closest('td,th') as HTMLTableCellElement | null) : null;
      return td && root.current?.contains(td) ? td : null;
    };

    const run = (fn: (m: TableModel, p: Pos) => { m: TableModel; p: Pos } | null) => {
      if (!cur) return;
      const live = liveCell();
      const td = live && live.closest('table') === cur.table && !cur.a ? live : cur.td;
      const p = positions(cur.table).get(td);
      if (!p) return;
      const res = fn(model(cur.table), p);
      if (res) write(cur.table, res.m, res.p);
    };

    useImperativeHandle(fwd, () => ({
      insert: (rows: number, cols: number) => {
        const el = root.current;
        if (!el) return;
        const m: TableModel = { cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => '')), align: Array(cols).fill(null), opts: { ...DEFAULT_OPTS } };
        el.focus();
        document.execCommand('insertHTML', false, `<div class="rp-md-table-wrap nt-wrap rp-table">${tableHtml(m)}</div><p class="rp-md-p"><br></p>`);
        onChanged();
        // El cursor va a la primera celda de la tabla recién puesta
        const s = getSelection();
        const near = s && s.anchorNode ? (s.anchorNode.nodeType === 1 ? (s.anchorNode as Element) : s.anchorNode.parentElement) : null;
        const wrap = near?.closest('p')?.previousElementSibling ?? null;
        const table = (wrap?.querySelector('table') ?? Array.from(el.querySelectorAll('table')).pop()) as HTMLTableElement | undefined;
        caretIn(table?.querySelector('th,td'), false);
      },
      onKey: (e: React.KeyboardEvent) => {
        if (e.key !== 'Tab') return false;
        const here = liveCell();
        if (!here) return false;
        const table = here.closest('table') as HTMLTableElement;
        const pos = positions(table);
        const list = [...pos.entries()].sort((x, y) => x[1][0] - y[1][0] || x[1][1] - y[1][1]);
        const i = list.findIndex(([td]) => td === here);
        if (i < 0) return false;
        e.preventDefault();
        if (e.shiftKey) { if (i > 0) caretIn(list[i - 1][0]); return true; }
        if (i < list.length - 1) { caretIn(list[i + 1][0]); return true; }
        // Última celda: fila nueva, como en Word
        const m = model(table);
        write(table, insertRow(m, m.cells.length), [m.cells.length, 0]);
        return true;
      },
    }), [cur, root, onChanged]);

    if (!active || !cur) return null;

    const m0 = model(cur.table);
    const p0 = positions(cur.table).get(cur.td) ?? [0, 0];
    const g0 = regionOf(m0.cells, p0[0], p0[1]);
    const merged = g0.r1 > g0.r0 || g0.c1 > g0.c0;
    const multi = !!(cur.a && cur.b);
    const wrap = cur.table.closest('.rp-md-table-wrap') as HTMLElement | null;
    const capEl = wrap?.previousElementSibling as HTMLElement | null;
    const hasCaption = !!capEl && TABLE_CAPTION.test((capEl.textContent || '').trim());
    const colAlign = m0.align[p0[1]] ?? null;

    const B = (title: string, icon: React.ReactNode, onClick: () => void, opts: { on?: boolean; disabled?: boolean; label?: string } = {}) => (
      <button type="button" className={`ui-tb${opts.on ? ' is-on' : ''}${opts.label ? ' has-label' : ''}`} title={title} aria-label={title}
        disabled={opts.disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
        {icon}{opts.label && <span>{opts.label}</span>}
      </button>
    );
    const setAlign = (a: Align) => run((m, p) => { const align = [...m.align]; const g = regionOf(m.cells, p[0], p[1]); for (let c = g.c0; c <= g.c1; c++) align[c] = a; return { m: { ...m, align }, p }; });

    return (
      <EditDock slot="format">
        <div className="rp-tbl-bar ui-glass" role="toolbar" aria-label="Tabla" onMouseDown={(e) => e.preventDefault()}>
          <span className="rp-tbl-tag">Tabla</span>
          {B('Fila arriba', <BetweenHorizontalStart />, () => run((m, p) => ({ m: insertRow(m, regionOf(m.cells, p[0], p[1]).r0), p: [regionOf(m.cells, p[0], p[1]).r0, p[1]] })))}
          {B('Fila abajo', <BetweenHorizontalEnd />, () => run((m, p) => { const r = regionOf(m.cells, p[0], p[1]).r1 + 1; return { m: insertRow(m, r), p: [r, p[1]] }; }))}
          {B('Columna a la izquierda', <BetweenVerticalStart />, () => run((m, p) => { const c = regionOf(m.cells, p[0], p[1]).c0; return { m: insertCol(m, c), p: [p[0], c] }; }))}
          {B('Columna a la derecha', <BetweenVerticalEnd />, () => run((m, p) => { const c = regionOf(m.cells, p[0], p[1]).c1 + 1; return { m: insertCol(m, c), p: [p[0], c] }; }))}
          {B('Quitar la fila', <><Minus /><Rows3 /></>, () => run((m, p) => (m.cells.length > 1 ? { m: deleteRow(m, p[0]), p: [Math.max(0, p[0] - (p[0] >= m.cells.length - 1 ? 1 : 0)), p[1]] } : null)), { disabled: m0.cells.length <= 1 })}
          {B('Quitar la columna', <><Minus /><Rows3 style={{ transform: 'rotate(90deg)' }} /></>, () => run((m, p) => ((m.cells[0]?.length ?? 0) > 1 ? { m: deleteCol(m, p[1]), p: [p[0], Math.max(0, p[1] - (p[1] >= m.cells[0].length - 1 ? 1 : 0))] } : null)), { disabled: (m0.cells[0]?.length ?? 0) <= 1 })}
          <span className="ui-tb-sep" />
          {B('Combinar las celdas seleccionadas (arrastrá el mouse sobre varias celdas)', <TableCellsMerge />, () => run((m) => {
            if (!cur.a || !cur.b) return null;
            const res = mergeRect(m, cur.a, cur.b);
            return { m: res.model, p: res.origin };
          }), { disabled: !multi, label: 'Combinar' })}
          {B('Dividir la celda combinada', <TableCellsSplit />, () => run((m, p) => ({ m: splitCell(m, p[0], p[1]), p })), { disabled: !merged })}
          <span className="ui-tb-sep" />
          {B('Alinear la columna a la izquierda', <AlignLeft />, () => setAlign(null), { on: !colAlign || colAlign === 'left' })}
          {B('Centrar la columna', <AlignCenter />, () => setAlign('center'), { on: colAlign === 'center' })}
          {B('Alinear la columna a la derecha', <AlignRight />, () => setAlign('right'), { on: colAlign === 'right' })}
          <span className="ui-tb-sep" />
          {B('Primera fila como encabezado', <PanelTop />, () => run((m, p) => ({ m: { ...m, opts: { ...m.opts, header: !m.opts.header } }, p })), { on: m0.opts.header, label: 'Encabezado' })}
          {B('Filas alternadas (con el color del tema)', <Rows3 />, () => run((m, p) => ({ m: { ...m, opts: { ...m.opts, alt: !m.opts.alt } }, p })), { on: m0.opts.alt, label: 'Alternadas' })}
          {B('Título numerado ("Tabla 3 – …"), se puede citar con @', <Captions />, () => {
            if (!wrap) return;
            if (hasCaption && capEl) capEl.remove();
            else {
              const pEl = document.createElement('p');
              pEl.className = 'rp-md-p';
              pEl.textContent = 'Tabla: Título de la tabla';
              wrap.before(pEl);
              const r = document.createRange();
              r.setStart(pEl.firstChild!, 7);
              r.setEnd(pEl.firstChild!, pEl.textContent.length);
              const s = getSelection(); s?.removeAllRanges(); s?.addRange(r);
            }
            onChanged();
          }, { on: hasCaption, label: 'Título' })}
          <span className="ui-tb-sep" />
          {B('Quitar la tabla', <Trash2 />, () => {
            const w = cur.table.closest('.rp-md-table-wrap') ?? cur.table;
            if (hasCaption && capEl) capEl.remove();
            w.remove();
            setCur(null);
            onChanged();
          })}
        </div>
      </EditDock>
    );
  },
);

/** Grilla para elegir el tamaño de la tabla nueva (como en Word) */
export const TableSizePicker: React.FC<{ anchor: DOMRect; onPick: (rows: number, cols: number) => void; onClose: () => void }> = ({ anchor, onPick, onClose }) => {
  const [hv, setHv] = useState<Pos>([3, 3]);
  const R = 8, C = 8;
  return (
    <UiPop anchor={anchor} align="start" onClose={onClose} className="rp-tbl-pick">
      <div className="ui-pop-caption">Tabla nueva · {hv[0]} × {hv[1]}</div>
      <div className="rp-tbl-grid" style={{ gridTemplateColumns: `repeat(${C}, 16px)` }} onMouseDown={(e) => e.preventDefault()}>
        {Array.from({ length: R * C }, (_, k) => {
          const r = Math.floor(k / C) + 1, c = (k % C) + 1;
          return (
            <button key={k} type="button" className={r <= hv[0] && c <= hv[1] ? 'on' : ''}
              onMouseEnter={() => setHv([r, c])} onClick={() => onPick(r, c)} aria-label={`${r} filas por ${c} columnas`} />
          );
        })}
      </div>
      <div className="rp-tbl-pick-hint">La 1.ª fila es el encabezado (se puede cambiar). Pegar desde Excel también arma la tabla.</div>
    </UiPop>
  );
};
