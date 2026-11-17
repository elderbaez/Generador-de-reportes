import React, { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Hint } from '../theme/advanced';
import './code-editor.css';

/* =====================================================================
   Editor de CSS liviano, sin librerías:
   - colores de sintaxis (selectores, propiedades, valores, variables, colores con muestra)
   - números de línea
   - autocompletado de variables del tema (--rp-…), elementos (.rp-…) y propiedades
   - Tab sangra, Enter mantiene la sangría, "}" desangra
   Técnica: un <textarea> transparente encima de un <pre> coloreado, con la misma fuente.
   ===================================================================== */

export interface CodeEditorHandle { insert: (text: string) => void; focus: () => void }

interface CodeEditorProps {
  value: string;
  onChange: (v: string) => void;
  vars: Hint[];
  selectors: Hint[];
  props: Hint[];
  readOnly?: boolean;
  minHeight?: number;
  placeholder?: string;
}

const LINE_H = 18;
const PAD = 8;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ---------- Coloreado ---------- */

function hlValue(v: string): string {
  const re = /(\/\*[\s\S]*?(?:\*\/|$))|("(?:\\.|[^"\\])*"?|'(?:\\.|[^'\\])*'?)|(--[\w-]+)|(#[0-9a-fA-F]{3,8}\b)|(!important)|(-?\d*\.?\d+(?:px|pt|em|rem|%|mm|cm|s|ms|deg|vh|vw)?)|([a-zA-Z-]+(?=\())|([^]+?)/g;
  let out = '';
  for (const m of v.matchAll(re)) {
    const [t, com, str, vr, hex, imp, num, fn] = m;
    if (com) out += `<span class="ce-c">${esc(com)}</span>`;
    else if (str) out += `<span class="ce-s">${esc(str)}</span>`;
    else if (vr) out += `<span class="ce-var">${esc(vr)}</span>`;
    else if (hex) out += `<span class="ce-hex" style="--sw:${hex}">${esc(hex)}</span>`;
    else if (imp) out += `<span class="ce-imp">${imp}</span>`;
    else if (num) out += `<span class="ce-num">${esc(num)}</span>`;
    else if (fn) out += `<span class="ce-fn">${esc(fn)}</span>`;
    else out += esc(t);
  }
  return out;
}

function hlSelector(sel: string): string {
  const re = /(\/\*[\s\S]*?(?:\*\/|$))|(@[\w-]+)|(\.[\w-]+)|(::?[\w-]+)|(&)|([^]+?)/g;
  let out = '';
  for (const m of sel.matchAll(re)) {
    const [t, com, at, cls, pseudo, amp] = m;
    if (com) out += `<span class="ce-c">${esc(com)}</span>`;
    else if (at) out += `<span class="ce-at">${esc(at)}</span>`;
    else if (cls) out += `<span class="ce-cls">${esc(cls)}</span>`;
    else if (pseudo) out += `<span class="ce-pseudo">${esc(pseudo)}</span>`;
    else if (amp) out += `<span class="ce-pseudo">&amp;</span>`;
    else out += `<span class="ce-sel">${esc(t)}</span>`;
  }
  return out;
}

/** ¿Lo que empieza en i es un selector/regla-@ (termina en "{") o una declaración? */
function statementKind(code: string, i: number): 'block' | 'decl' {
  let j = i;
  while (j < code.length) {
    const c = code[j];
    if (c === '/' && code[j + 1] === '*') { const e = code.indexOf('*/', j + 2); j = e < 0 ? code.length : e + 2; continue; }
    if (c === '"' || c === "'") { const e = code.indexOf(c, j + 1); j = e < 0 ? code.length : e + 1; continue; }
    if (c === '{') return 'block';
    if (c === ';' || c === '}') return 'decl';
    j++;
  }
  return 'decl';
}

export function highlightCss(code: string): string {
  let out = '';
  let i = 0;
  let depth = 0;
  while (i < code.length) {
    const c = code[i];
    // espacios
    if (/\s/.test(c)) { let j = i; while (j < code.length && /\s/.test(code[j])) j++; out += code.slice(i, j); i = j; continue; }
    // comentarios
    if (c === '/' && code[i + 1] === '*') {
      const e = code.indexOf('*/', i + 2); const j = e < 0 ? code.length : e + 2;
      out += `<span class="ce-c">${esc(code.slice(i, j))}</span>`; i = j; continue;
    }
    if (c === '}') { out += '<span class="ce-p">}</span>'; depth = Math.max(0, depth - 1); i++; continue; }
    if (c === '{' || c === ';') { out += `<span class="ce-p">${c}</span>`; if (c === '{') depth++; i++; continue; }

    const kind = depth === 0 ? 'block' : statementKind(code, i);
    // hasta el terminador
    let j = i;
    while (j < code.length) {
      const d = code[j];
      if (d === '/' && code[j + 1] === '*') { const e = code.indexOf('*/', j + 2); j = e < 0 ? code.length : e + 2; continue; }
      if (d === '"' || d === "'") { const e = code.indexOf(d, j + 1); j = e < 0 ? code.length : e + 1; continue; }
      if (kind === 'block' ? d === '{' || d === '}' || (d === ';' && code[i] === '@') : d === ';' || d === '}') break;
      j++;
    }
    const seg = code.slice(i, j);
    if (kind === 'block') out += hlSelector(seg);
    else {
      const k = seg.indexOf(':');
      if (k < 0) out += `<span class="ce-prop">${esc(seg)}</span>`;
      else {
        const name = seg.slice(0, k);
        out += `<span class="${name.trim().startsWith('--') ? 'ce-var' : 'ce-prop'}">${esc(name)}</span><span class="ce-p">:</span>${hlValue(seg.slice(k + 1))}`;
      }
    }
    i = j;
  }
  return out + '\n';
}

/* ---------- Contexto para autocompletar ---------- */

type Ctx = { kind: 'var' | 'prop' | 'sel'; word: string; start: number; inVar: boolean } | null;

function contextAt(code: string, pos: number): Ctx {
  const before = code.slice(0, pos);
  const m = before.match(/(--[\w-]*|\.[\w-]*|[\w-]+)$/);
  const word = m ? m[1] : '';
  const start = pos - word.length;
  // ¿dentro de un comentario?
  const lastOpen = before.lastIndexOf('/*');
  if (lastOpen > before.lastIndexOf('*/')) return null;
  // profundidad y tipo de sentencia
  let depth = 0, stmtStart = 0;
  for (let i = 0; i < start; i++) {
    const ch = code[i];
    if (ch === '{') { depth++; stmtStart = i + 1; }
    else if (ch === '}') { depth = Math.max(0, depth - 1); stmtStart = i + 1; }
    else if (ch === ';') stmtStart = i + 1;
  }
  const stmt = code.slice(stmtStart, start);
  const kind = depth === 0 ? 'block' : statementKind(code, stmtStart);
  if (kind === 'block') return word.startsWith('.') || word === '' || /^[\w-]+$/.test(word) ? { kind: 'sel', word, start, inVar: false } : null;
  if (!stmt.includes(':')) return word.startsWith('--') ? { kind: 'var', word, start, inVar: false } : { kind: 'prop', word, start, inVar: false };
  // en el valor
  const inVar = /var\(\s*$/.test(code.slice(stmtStart, start));
  if (word.startsWith('--') || inVar) return { kind: 'var', word, start, inVar };
  return null;
}

/* =====================================================================
   Componente
   ===================================================================== */

export const CodeEditor = React.forwardRef<CodeEditorHandle, CodeEditorProps>(({
  value, onChange, vars, selectors, props, readOnly, minHeight = 260, placeholder,
}, ref) => {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutRef = useRef<HTMLDivElement>(null);
  const [charW, setCharW] = useState(7.2);
  const [menu, setMenu] = useState<{ items: Hint[]; ctx: NonNullable<Ctx>; idx: number; x: number; y: number } | null>(null);

  const html = useMemo(() => highlightCss(value), [value]);
  const lines = useMemo(() => value.split('\n').length, [value]);

  // ancho de carácter real (fuente monoespaciada)
  useLayoutEffect(() => {
    const span = document.createElement('span');
    span.className = 'ce-measure';
    span.textContent = 'M'.repeat(50);
    preRef.current?.appendChild(span);
    const w = span.getBoundingClientRect().width / 50;
    span.remove();
    if (w > 0) setCharW(w);
  }, []);

  const syncScroll = () => {
    const ta = taRef.current;
    if (!ta) return;
    if (preRef.current) { preRef.current.scrollTop = ta.scrollTop; preRef.current.scrollLeft = ta.scrollLeft; }
    if (gutRef.current) gutRef.current.scrollTop = ta.scrollTop;
  };
  useEffect(syncScroll, [value]);

  const insertText = useCallback((text: string, replaceFrom?: number, replaceTo?: number) => {
    const ta = taRef.current;
    if (!ta) return;
    const keepS = ta.selectionStart, keepE = ta.selectionEnd;
    ta.focus();
    ta.setSelectionRange(keepS, keepE);
    if (replaceFrom != null) ta.setSelectionRange(replaceFrom, replaceTo ?? ta.selectionEnd);
    // execCommand conserva Ctrl+Z
    const ok = document.execCommand('insertText', false, text);
    if (!ok) {
      const s = ta.selectionStart, e = ta.selectionEnd;
      const next = ta.value.slice(0, s) + text + ta.value.slice(e);
      onChange(next);
      requestAnimationFrame(() => ta.setSelectionRange(s + text.length, s + text.length));
    }
  }, [onChange]);

  useImperativeHandle(ref, () => ({
    insert: (text: string) => {
      const ta = taRef.current;
      if (!ta) return;
      let pos = ta.selectionStart;
      // Si el cursor está dentro de una regla, el bloque nuevo va al final (no adentro de otra regla)
      let depth = 0;
      for (const ch of ta.value.slice(0, pos).replace(/\/\*[\s\S]*?(\*\/|$)/g, '')) { if (ch === '{') depth++; else if (ch === '}') depth = Math.max(0, depth - 1); }
      if (depth > 0) { pos = ta.value.length; ta.setSelectionRange(pos, pos); }
      const pre = ta.value.slice(0, pos);
      const sep = pre.length === 0 || pre.endsWith('\n\n') ? '' : pre.endsWith('\n') ? '\n' : '\n\n';
      insertText(`${sep}${text}\n`);
    },
    focus: () => taRef.current?.focus(),
  }), [insertText]);

  const openMenu = (force = false) => {
    const ta = taRef.current;
    if (!ta || readOnly) return;
    const pos = ta.selectionStart;
    if (pos !== ta.selectionEnd) { setMenu(null); return; }
    const ctx = contextAt(ta.value, pos);
    if (!ctx || (!force && ctx.word.length < 1 && !ctx.inVar)) { setMenu(null); return; }
    const pool = ctx.kind === 'var' ? vars : ctx.kind === 'prop' ? props : selectors;
    const w = ctx.word.toLowerCase();
    const items = pool.filter((h) => h.label.toLowerCase().includes(w) && h.label.toLowerCase() !== w).slice(0, 40);
    if (!items.length) { setMenu(null); return; }
    const before = ta.value.slice(0, ctx.start);
    const line = before.split('\n').length - 1;
    const col = before.length - before.lastIndexOf('\n') - 1;
    setMenu({
      items, ctx, idx: 0,
      x: PAD + col * charW - ta.scrollLeft,
      y: PAD + (line + 1) * LINE_H - ta.scrollTop + 2,
    });
  };

  const accept = (h: Hint) => {
    const ta = taRef.current;
    if (!ta || !menu) return;
    const { ctx } = menu;
    let text = h.insert ?? h.label;
    if (ctx.kind === 'var') {
      const stmt = ta.value.slice(0, ctx.start);
      const afterColon = /:[^;{}]*$/.test(stmt);
      if (afterColon && !ctx.inVar) text = `var(${h.label})`;
      else if (ctx.inVar) text = ta.value[ta.selectionStart] === ')' ? h.label : `${h.label})`;
      else text = `${h.label}: `;
    }
    if (ctx.kind === 'sel' && h.label !== ':scope') text = h.label.startsWith('.') ? `:scope ${h.label}` : h.label;
    if (ctx.kind === 'sel') {
      // si se escribía ":scope .algo", no repetir ":scope"
      const pre = ta.value.slice(0, ctx.start);
      if (/:scope\s+$/.test(pre)) text = h.label;
    }
    insertText(text, ctx.start, ta.selectionStart);
    setMenu(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    // Lista vieja (se siguió escribiendo antes de que se actualizara): no se usa
    const stale = menu && (() => { const cur = contextAt(ta.value, ta.selectionStart); return !cur || cur.start !== menu.ctx.start || ta.selectionStart !== ta.selectionEnd; })();
    if (menu && stale) setMenu(null);
    if (menu && !stale) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMenu({ ...menu, idx: (menu.idx + 1) % menu.items.length }); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMenu({ ...menu, idx: (menu.idx - 1 + menu.items.length) % menu.items.length }); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); accept(menu.items[menu.idx]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setMenu(null); return; }
    }
    if (e.key === ' ' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); openMenu(true); return; }
    if (readOnly) return;
    const s = ta.selectionStart, end = ta.selectionEnd;
    const v = ta.value;
    const lineStart = v.lastIndexOf('\n', s - 1) + 1;
    const indent = (v.slice(lineStart).match(/^[ \t]*/) || [''])[0];
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        if (v.slice(lineStart, lineStart + 2) === '  ') { ta.setSelectionRange(lineStart, lineStart + 2); insertText(''); ta.setSelectionRange(s - 2, end - 2); }
      } else insertText('  ');
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const prev = v.slice(0, s).trimEnd();
      const next = v.slice(end);
      if (prev.endsWith('{') && next.trimStart().startsWith('}')) {
        insertText(`\n${indent}  \n${indent}`);
        const p = s + 1 + indent.length + 2;
        ta.setSelectionRange(p, p);
      } else {
        insertText(`\n${indent}${prev.endsWith('{') ? '  ' : ''}`);
      }
      return;
    }
    if (e.key === '{') {
      e.preventDefault();
      insertText('{}');
      ta.setSelectionRange(s + 1, s + 1);
      return;
    }
    if (e.key === '}') {
      // si la línea solo tiene sangría, desangrar
      if (/^[ \t]+$/.test(v.slice(lineStart, s)) && v[s] !== '}') {
        e.preventDefault();
        ta.setSelectionRange(Math.max(lineStart, s - 2), s);
        insertText('}');
        return;
      }
      if (v[s] === '}' && s === end) { e.preventDefault(); ta.setSelectionRange(s + 1, s + 1); return; }
    }
  };

  return (
    <div className={`ce-root${readOnly ? ' ro' : ''}`} style={{ minHeight }}>
      <div className="ce-gutter" ref={gutRef} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}
      </div>
      <div className="ce-body">
        <pre ref={preRef} className="ce-pre" aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />
        {!value && placeholder && <div className="ce-placeholder">{placeholder}</div>}
        <textarea
          ref={taRef}
          className="ce-ta"
          value={value}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          wrap="off"
          onChange={(e) => { onChange(e.target.value); requestAnimationFrame(() => openMenu()); }}
          onScroll={syncScroll}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(() => setMenu(null), 120)}
          onClick={() => setMenu(null)}
        />
        {menu && (
          <div className="ce-menu" style={{ left: Math.max(0, menu.x), top: menu.y }} onMouseDown={(e) => e.preventDefault()}>
            {menu.items.map((h, i) => (
              <div key={h.label} className={`ce-opt${i === menu.idx ? ' on' : ''}`}
                onMouseEnter={() => setMenu({ ...menu, idx: i })} onClick={() => accept(h)}>
                <span className="ce-opt-l">{h.label}</span>
                <span className="ce-opt-d">{h.detail}</span>
              </div>
            ))}
            <div className="ce-menu-foot">↑↓ elegir · Enter/Tab insertar · Esc cerrar</div>
          </div>
        )}
      </div>
    </div>
  );
});
CodeEditor.displayName = 'CodeEditor';
