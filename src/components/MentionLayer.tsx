import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image as ImageIcon, Table2, Braces, Workflow, FileText } from 'lucide-react';
import { UiPop } from './UiPop';
import { getRefCatalog, RefItem } from '../utils/refs';
import { currentVars, VarInfo } from '../utils/fields';
import './formula-input.css';

/* =====================================================================
   @ en CUALQUIER campo de texto del programa (celdas de tablas, encabezado,
   pies, portada, cuadros del panel, código HTML…), con la misma lista:
   - Citar figura o tabla  → escribe [[ref:ID]] (en la hoja se ve "Foto 03")
   - Datos del informe     → escribe {clave}   (en la hoja se ve el valor)
   Uno solo para toda la app: escucha los eventos del documento, así ningún
   módulo tiene que hacer nada. Los que ya tienen su propia lista (el editor
   de textos y el cuadro de fórmulas) quedan afuera.
   ===================================================================== */

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLElement;
export type Item = { kind: 'ref'; it: RefItem } | { kind: 'var'; v: VarInfo };

const OWN_MENU = '.rp-md-editor, .rp-fx-input, [data-no-mention]';
const TEXT_INPUTS = new Set(['text', 'search', '']);
const MENTION_RE = /(^|[^\w@[\]{}])@([\p{L}\p{N}_-]{0,30})$/u;
const norm = (t: string) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** El campo donde se está escribiendo, si admite @ */
function fieldOf(t: EventTarget | null): Field | null {
  if (!(t instanceof HTMLElement) || t.closest(OWN_MENU)) return null;
  if (t instanceof HTMLTextAreaElement) return t;
  if (t instanceof HTMLInputElement) return TEXT_INPUTS.has(t.type) ? t : null;
  if (t.isContentEditable) return (t.closest('[contenteditable="true"], [contenteditable=""]') as HTMLElement) || t;
  return null;
}

const isPlain = (f: Field): f is HTMLInputElement | HTMLTextAreaElement =>
  f instanceof HTMLInputElement || f instanceof HTMLTextAreaElement;

/** Texto antes del cursor y dónde dibujar la lista */
function caretInfo(f: Field): { before: string; rect: DOMRect } | null {
  if (isPlain(f)) {
    const pos = f.selectionStart ?? f.value.length;
    if (f.selectionEnd != null && f.selectionEnd !== pos) return null;
    const r = f.getBoundingClientRect();
    // Sin forma fácil de medir el cursor en un <input>: la lista va debajo del cuadro
    return { before: f.value.slice(0, pos), rect: new DOMRect(r.left, r.top, Math.min(r.width, 260), r.height) };
  }
  const sel = getSelection();
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return null;
  const rg = sel.getRangeAt(0);
  const node = rg.startContainer;
  if (node.nodeType !== 3 || !f.contains(node)) return null;
  const before = (node.textContent || '').slice(0, rg.startOffset);
  const m = MENTION_RE.exec(before);
  const mark = document.createRange();
  mark.setStart(node, Math.max(0, rg.startOffset - (m ? m[2].length + 1 : 0)));
  mark.setEnd(node, rg.startOffset);
  const r = mark.getBoundingClientRect();
  return { before, rect: r.width || r.height ? r : f.getBoundingClientRect() };
}

/**
 * Lista para un @texto: citas (figuras, tablas) y datos del informe. Primero lo que EMPIEZA
 * con lo escrito, después lo que lo contiene; el grupo con la mejor coincidencia va arriba.
 * La usan también el editor de textos, así todas las listas de @ ordenan igual.
 */
export function mentionItems(q0: string): Item[] {
  const q = norm(q0);
  const score = (...txt: string[]) => {
    if (!q) return 1;
    let best = 9;
    for (const t of txt.map(norm)) {
      if (t.startsWith(q)) best = Math.min(best, 0);
      else if (t.split(/[\s_.\-/]+/).some((w) => w.startsWith(q))) best = Math.min(best, 1);
      else if (t.includes(q)) best = Math.min(best, 2);
    }
    return best;
  };
  const refs = getRefCatalog().map((it) => ({ x: { kind: 'ref', it } as Item, s: score(it.label, it.caption) })).filter((r) => r.s < 9);
  const vars = currentVars().map((v) => ({ x: { kind: 'var', v } as Item, s: score(v.key, v.label) })).filter((r) => r.s < 9);
  const sort = (a: { s: number }[]) => a.sort((m, n) => m.s - n.s);
  sort(refs); sort(vars);
  const varsFirst = vars.length > 0 && (!refs.length || vars[0].s < refs[0].s);
  const out = varsFirst ? [...vars, ...refs] : [...refs, ...vars];
  return out.slice(0, 50).map((r) => r.x);
}

/** Un renglón de la lista de @ (igual en todas partes) */
export const MentionRow: React.FC<{ x: Item; active: boolean; onHover?: () => void; onPick: () => void }> = ({ x, active, onHover, onPick }) => {
  const k = x.kind === 'ref' ? x.it.kind : '';
  const icon = x.kind === 'var' ? <Braces /> : k === 'tabla' ? <Table2 /> : k === 'diagrama' ? <Workflow /> : k === 'documento' ? <FileText /> : <ImageIcon />;
  return (
    <button
      type="button"
      className={`rp-fx-item${active ? ' is-active' : ''}`}
      ref={(b) => { if (b && active) b.scrollIntoView({ block: 'nearest' }); }}
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={onHover}
      onClick={onPick}
    >
      <span className="rp-fx-ico">{icon}</span>
      {x.kind === 'ref' ? (
        <span className="rp-fx-txt"><b>{x.it.label}</b><span>{x.it.caption || '—'}</span></span>
      ) : (
        <>
          <span className="rp-fx-txt"><b>{x.v.label}</b><span>{`{${x.v.key}}`}</span></span>
          {x.v.value && <span className="rp-fx-val">{x.v.value}</span>}
        </>
      )}
    </button>
  );
};

export const MentionLayer: React.FC = () => {
  const [st, setSt] = useState<{ f: Field; q: string; i: number; rect: DOMRect } | null>(null);
  const stRef = useRef(st);
  stRef.current = st;

  const items = useMemo<Item[]>(() => (st ? mentionItems(st.q) : []), [st]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  /** Cambia el @palabra por el texto elegido (como si se hubiera escrito: React se entera solo) */
  const pick = (item: Item) => {
    const cur = stRef.current;
    if (!cur) return;
    const { f, q } = cur;
    const token = item.kind === 'ref' ? `[[ref:${item.it.id}]]` : `{${item.v.key}}`;
    f.focus();
    if (isPlain(f)) {
      const pos = f.selectionStart ?? f.value.length;
      f.setSelectionRange(pos - q.length - 1, pos);
    } else {
      const sel = getSelection();
      if (sel && sel.rangeCount) {
        const rg = sel.getRangeAt(0);
        const r = document.createRange();
        r.setStart(rg.startContainer, Math.max(0, rg.startOffset - q.length - 1));
        r.setEnd(rg.startContainer, rg.startOffset);
        sel.removeAllRanges();
        sel.addRange(r);
      }
    }
    // insertText deja deshacer con Ctrl+Z y dispara el evento input que escuchan los módulos
    document.execCommand('insertText', false, `${token} `);
    setSt(null);
  };

  useEffect(() => {
    const check = (t: EventTarget | null) => {
      const f = fieldOf(t);
      if (!f) { if (stRef.current) setSt(null); return; }
      const info = caretInfo(f);
      const m = info && MENTION_RE.exec(info.before);
      if (!info || !m) { if (stRef.current) setSt(null); return; }
      setSt((prev) => ({ f, q: m[2], i: prev && prev.f === f && prev.q === m[2] ? prev.i : 0, rect: info.rect }));
    };
    const onInput = (e: Event) => check(e.target);
    const onKey = (e: KeyboardEvent) => {
      const cur = stRef.current;
      if (!cur || e.target !== cur.f) return;
      const list = itemsRef.current;
      const stop = () => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); };
      if (e.key === 'Escape') { stop(); setSt(null); return; }
      if (!list.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        stop();
        const n = list.length;
        const i = Math.min(cur.i, n - 1);
        setSt({ ...cur, i: (i + (e.key === 'ArrowDown' ? 1 : n - 1)) % n });
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') { stop(); pick(list[Math.min(cur.i, list.length - 1)]); }
    };
    // Moverse con el mouse o las flechas laterales puede dejar el cursor después de un @
    const onKeyUp = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) check(e.target);
    };
    const onBlur = (e: FocusEvent) => {
      if (stRef.current && e.target === stRef.current.f) setTimeout(() => {
        if (stRef.current && document.activeElement !== stRef.current.f) setSt(null);
      }, 120);
    };
    document.addEventListener('input', onInput, true);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('keyup', onKeyUp, true);
    document.addEventListener('focusout', onBlur, true);
    return () => {
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('keyup', onKeyUp, true);
      document.removeEventListener('focusout', onBlur, true);
    };
  }, []);

  if (!st) return null;
  const cur = Math.min(st.i, Math.max(0, items.length - 1));
  const row = (x: Item, k: number) => (
    <MentionRow key={x.kind === 'ref' ? `r${x.it.id}` : `v${x.v.key}`} x={x} active={k === cur}
      onHover={() => setSt((s2) => (s2 ? { ...s2, i: k } : s2))} onPick={() => pick(x)} />
  );

  return (
    <UiPop anchor={st.rect} align="start" onClose={() => setSt(null)} className="rp-fx-pop rp-mention-layer">
      {!items.length && <div className="rp-fx-empty">Nada coincide con “{st.q}”. Seguí escribiendo o Esc.</div>}
      {items.map((x, k) => (
        <React.Fragment key={k}>
          {(k === 0 || items[k - 1].kind !== x.kind) && (
            <div className="ui-pop-caption">{x.kind === 'ref' ? 'Citar figura o tabla' : 'Datos del informe'}</div>
          )}
          {row(x, k)}
        </React.Fragment>
      ))}
      <div className="rp-fx-foot">↑↓ elegir · Enter o Tab insertar · Esc cerrar</div>
    </UiPop>
  );
};
