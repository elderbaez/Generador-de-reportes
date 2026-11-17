import React, { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Calculator, Braces } from 'lucide-react';
import { UiPop } from './UiPop';
import './formula-input.css';

/* =====================================================================
   Cuadro para escribir un valor o una fórmula con variables (@monto…).
   Se comporta como el @ de los textos:
   - la lista aparece solo mientras se escribe @palabra justo antes del cursor;
   - flechas para moverse, Enter o Tab para elegir, Esc para cerrar la lista;
   - elegir una variable la escribe en el lugar del @ y sigue escribiendo ahí,
     sin guardar todavía;
   - se guarda al salir del cuadro o con Enter (con la lista cerrada), y solo
     si cambió algo. Esc con la lista cerrada vuelve a lo que había.
   ===================================================================== */

export interface FormulaVar {
  key: string;      // '@monto'
  label: string;    // 'Monto del contrato'
  value?: string;   // valor actual, para mostrar
  type: 'num' | 'date';
  group: string;    // 'Contrato', 'Fechas', 'Campos del informe'
}

export interface FormulaInputHandle {
  /** Escribe una variable donde está el cursor (botones de acceso rápido) */
  insert: (text: string) => void;
  focus: () => void;
  /** Escribe @ en el cursor y abre la lista de variables */
  mention: () => void;
}

interface Props {
  value: string;
  vars: FormulaVar[];
  onCommit: (text: string) => void;
  /** Cada cambio mientras se escribe (para mostrar el resultado en vivo) */
  onDraft?: (text: string) => void;
  onFocus?: () => void;
  placeholder?: string;
  className?: string;
  /** Ancho según lo escrito (celdas) en vez de ocupar todo el lugar */
  autoWidth?: boolean;
  title?: string;
}

const norm = (t: string) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const FormulaInput = forwardRef<FormulaInputHandle, Props>(function FormulaInput(
  { value, vars, onCommit, onDraft, onFocus, placeholder, className = '', autoWidth, title }, fwd,
) {
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);
  const [menu, setMenu] = useState<{ q: string; i: number; rect: DOMRect } | null>(null);
  // Lo que había al entrar: si al salir es igual no se guarda nada
  const start = useRef(value);

  // Si el valor cambia desde afuera (otro cuadro, el menú…) y no se está escribiendo acá, se actualiza
  useEffect(() => { if (!focused) { setText(value); start.current = value; } }, [value, focused]);

  const items = useMemo(() => {
    if (!menu) return [];
    const q = norm(menu.q);
    return vars.filter((v) => !q || norm(v.key).includes(q) || norm(v.label).includes(q)).slice(0, 40);
  }, [menu, vars]);

  const change = (t: string) => { setText(t); onDraft?.(t); };

  // Cursor a dejar después de insertar algo. Se pone apenas React escribe el texto, antes de la
  // próxima tecla: con un requestAnimationFrame, escribiendo rápido las letras caían en otro lugar
  const caret = useRef<{ pos: number; menu: boolean } | null>(null);
  useLayoutEffect(() => {
    const c = caret.current, el = ref.current;
    if (!c || !el) return;
    caret.current = null;
    if (document.activeElement !== el) el.focus();
    el.setSelectionRange(c.pos, c.pos);
    if (c.menu) checkMenu(el.value, c.pos);
  });

  /** ¿Hay un @palabra justo antes del cursor? */
  const checkMenu = (t: string, caret: number) => {
    const m = /(^|[^\w@])@([\wÀ-ɏ]*)$/.exec(t.slice(0, caret));
    if (!m || !ref.current) { setMenu(null); return; }
    const rect = ref.current.getBoundingClientRect();
    setMenu((prev) => ({ q: m[2], i: prev && prev.q === m[2] ? prev.i : 0, rect }));
  };

  // Al entrar con el mouse o Tab se selecciona todo; al entrar por un botón de "insertar", no
  const skipSelect = useRef(false);

  /** Pone `ins` en lugar del @palabra (o de lo seleccionado) y deja el cursor después */
  const put = (ins: string, replaceMention: boolean, base?: string) => {
    const el = ref.current;
    if (!el) return;
    const cur = base ?? el.value;
    let from = base != null ? cur.length : el.selectionStart ?? cur.length;
    const to = base != null ? cur.length : el.selectionEnd ?? from;
    if (replaceMention) {
      const m = /@[\w\u00C0-\u024F]*$/.exec(cur.slice(0, from));
      if (m) from -= m[0].length;
    }
    const before = cur.slice(0, from);
    const after = cur.slice(to);
    const pad = !replaceMention && before && !/[\s(=]$/.test(before) ? ' ' : '';
    const tail = after.startsWith(' ') ? '' : ' ';
    const next = before + pad + ins + tail + after;
    const pos = (before + pad + ins + tail).length;
    caret.current = { pos, menu: false };
    change(next);
    setMenu(null);
  };

  useImperativeHandle(fwd, () => ({
    insert: (t: string) => {
      const el = ref.current;
      if (!el) return;
      if (document.activeElement !== el) {
        skipSelect.current = true;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
      // Si había solo un número, la variable empieza una fórmula nueva
      const plain = /^\s*-?[\d.,\s]*%?\s*$/.test(el.value);
      put(t, false, plain ? '=' : undefined);
    },
    focus: () => ref.current?.focus(),
    mention: () => {
      const el = ref.current;
      if (!el) return;
      if (document.activeElement !== el) { skipSelect.current = true; el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      const plain = /^\s*-?[\d.,\s]*%?\s*$/.test(el.value);
      const cur = plain ? '=' : el.value;
      const a = plain ? 1 : el.selectionStart ?? cur.length, b = plain ? 1 : el.selectionEnd ?? a;
      const pad = a > 0 && !/[\s(=]$/.test(cur.slice(0, a)) ? ' ' : '';
      const next = cur.slice(0, a) + pad + '@' + cur.slice(b);
      const pos = a + pad.length + 1;
      caret.current = { pos, menu: true };
      change(next);
    },
  }));

  const commit = () => {
    setMenu(null);
    if (text.trim() !== start.current.trim()) { start.current = text; onCommit(text); }
  };

  const groups = useMemo(() => {
    const out: { name: string; list: { v: FormulaVar; k: number }[] }[] = [];
    items.forEach((v, k) => {
      let g = out.find((x) => x.name === v.group);
      if (!g) { g = { name: v.group, list: [] }; out.push(g); }
      g.list.push({ v, k });
    });
    return out;
  }, [items]);
  const cur = menu ? Math.min(menu.i, Math.max(0, items.length - 1)) : 0;

  return (
    <>
      <input
        ref={ref}
        type="text"
        value={text}
        title={title}
        spellCheck={false}
        placeholder={placeholder}
        className={`rp-fx-input ${className}`}
        style={autoWidth ? { width: `${Math.max(5, text.length + 1)}ch` } : undefined}
        onFocus={(e) => {
          setFocused(true);
          start.current = value;
          onFocus?.();
          if (skipSelect.current) skipSelect.current = false;
          else e.currentTarget.select();
        }}
        onBlur={() => { setFocused(false); commit(); }}
        onChange={(e) => { change(e.target.value); checkMenu(e.target.value, e.target.selectionStart ?? e.target.value.length); }}
        onClick={(e) => checkMenu(text, e.currentTarget.selectionStart ?? text.length)}
        onKeyDown={(e) => {
          e.stopPropagation(); // que las teclas no las tome la hoja ni la tabla
          if (menu && items.length) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              const n = items.length;
              setMenu({ ...menu, i: (cur + (e.key === 'ArrowDown' ? 1 : n - 1)) % n });
              return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); put(items[cur].key, true); return; }
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            if (menu) { setMenu(null); return; }
            change(start.current);
            requestAnimationFrame(() => ref.current?.blur());
            return;
          }
          if (e.key === 'Enter') { e.preventDefault(); commit(); return; }
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
            const el = e.currentTarget;
            requestAnimationFrame(() => checkMenu(el.value, el.selectionStart ?? el.value.length));
          }
        }}
      />
      {menu && (
        <UiPop anchor={menu.rect} align="start" onClose={() => setMenu(null)} className="rp-fx-pop">
          {!items.length && <div className="rp-fx-empty">Ninguna variable con “{menu.q}”. Seguí escribiendo o Esc.</div>}
          {groups.map((g) => (
            <React.Fragment key={g.name}>
              <div className="ui-pop-caption">{g.name}</div>
              {g.list.map(({ v, k }) => (
                <button
                  key={v.key}
                  type="button"
                  className={`rp-fx-item${k === cur ? ' is-active' : ''}`}
                  ref={(b) => { if (b && k === cur) b.scrollIntoView({ block: 'nearest' }); }}
                  onMouseDown={(e) => e.preventDefault()} // que el cuadro no pierda el foco
                  onMouseEnter={() => setMenu((m) => (m ? { ...m, i: k } : m))}
                  onClick={() => put(v.key, true)}
                >
                  <span className="rp-fx-ico">{v.type === 'date' ? <Calendar /> : v.group === 'Campos del informe' ? <Braces /> : <Calculator />}</span>
                  <span className="rp-fx-txt">
                    <b>{v.key}</b>
                    <span>{v.label}</span>
                  </span>
                  {v.value != null && v.value !== '' && <span className="rp-fx-val">{v.value}</span>}
                </button>
              ))}
            </React.Fragment>
          ))}
          <div className="rp-fx-foot">↑↓ elegir · Enter o Tab insertar · Esc cerrar</div>
        </UiPop>
      )}
    </>
  );
});
