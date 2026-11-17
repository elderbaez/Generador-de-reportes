import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Bold, Italic, Underline, Strikethrough, Highlighter, Heading2, List, ListOrdered, TextQuote, Code, Table, Sigma,
  Eye, CodeXml, Check, Trash2, Type, Scissors, Hash, Workflow, Link2,
} from 'lucide-react';
import { RichText, parseBlocks } from './RichText';
import { MathFormula, loadKatex, katexReady, hasMath } from './MathText';
import { htmlToMd } from '../utils/htmlToMd';
import { EditDock } from './EditDock';
import { UiPop } from './UiPop';
import { getRefCatalog, RefItem } from '../utils/refs';
import { VarInfo } from '../utils/fields';
import { mentionItems as sharedMentionItems, MentionRow } from './MentionLayer';
import './formula-input.css';
import { isSampleText, selectAllOnEnter } from '../utils/samples';
import { TableTools, TableToolsHandle, TableSizePicker } from './TableTools';
import { tsvToMd } from '../utils/mdTable';
import './ui-kit.css';
import './rich-text.css';

/**
 * Editor de texto con formato, en dos vistas:
 *  - Visual (ojo): se escribe sobre el texto ya formateado, como en un
 *    procesador de texto. Lo que se pega de ChatGPT, Claude, Gemini o una
 *    página web entra con su formato.
 *  - Código (</>): el Markdown tal cual, para quien lo conoce, con la ayuda.
 * Lo que se guarda siempre es Markdown (ver RichText).
 */

export type EditView = 'visual' | 'code';
type Change = (value: string) => void;
type Action = 'bold' | 'italic' | 'underline' | 'strike' | 'mark' | 'heading' | 'ul' | 'ol' | 'quote' | 'table' | 'code' | 'math' | 'diagram' | 'ref';

const VIEW_KEY = 'rp-text-view';
const readView = (): EditView => {
  try { return localStorage.getItem(VIEW_KEY) === 'code' ? 'code' : 'visual'; } catch { return 'visual'; }
};
const saveView = (v: EditView) => { try { localStorage.setItem(VIEW_KEY, v); } catch { /* sin almacenamiento */ } };

/* =====================================================================
   Vista de código: acciones sobre el <textarea>
   ===================================================================== */

function setSel(el: HTMLTextAreaElement, a: number, b: number) {
  // Se espera a que React vuelva a dibujar el cuadro con el texto nuevo
  requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a, b); });
}

export function wrapSelection(el: HTMLTextAreaElement, value: string, onChange: Change, open: string, close = open, placeholder = 'texto') {
  let a = el.selectionStart, b = el.selectionEnd;
  // Los espacios de los bordes quedan afuera de la marca (**hola** y no ** hola **)
  while (a < b && /\s/.test(value[a])) a++;
  while (b > a && /\s/.test(value[b - 1])) b--;
  const sel = value.slice(a, b);
  if (value.slice(a - open.length, a) === open && value.slice(b, b + close.length) === close) {
    onChange(value.slice(0, a - open.length) + sel + value.slice(b + close.length));
    setSel(el, a - open.length, b - open.length);
    return;
  }
  if (sel.startsWith(open) && sel.endsWith(close) && sel.length >= open.length + close.length) {
    const inner = sel.slice(open.length, sel.length - close.length);
    onChange(value.slice(0, a) + inner + value.slice(b));
    setSel(el, a, a + inner.length);
    return;
  }
  const inner = sel || placeholder;
  onChange(value.slice(0, a) + open + inner + close + value.slice(b));
  setSel(el, a + open.length, a + open.length + inner.length);
}

/** Pone (o quita) un prefijo en cada renglón de la selección: "## ", "- ", "1. ", "> ". */
export function prefixLines(el: HTMLTextAreaElement, value: string, onChange: Change, kind: 'h' | 'ul' | 'ol' | 'quote') {
  const a = value.lastIndexOf('\n', el.selectionStart - 1) + 1;
  let b = value.indexOf('\n', Math.max(el.selectionEnd - (el.selectionEnd > el.selectionStart ? 1 : 0), el.selectionStart));
  if (b < 0) b = value.length;
  const lines = value.slice(a, b).split('\n');
  const re = { h: /^#{1,6}\s+/, ul: /^\s*[-*+•]\s+(?!\[)/, ol: /^\s*\d+[.)]\s+/, quote: /^>\s?/ }[kind];
  const all = lines.filter((l) => l.trim()).every((l) => re.test(l));
  const any = /^(#{1,6}\s+|\s*[-*+•]\s+|\s*\d+[.)]\s+|>\s?)/;
  let n = 0;
  const next = lines.map((l) => {
    if (!l.trim() && lines.length > 1) return l;
    if (all) return l.replace(re, '');
    const bare = l.replace(any, '');
    n++;
    return (kind === 'h' ? '## ' : kind === 'ul' ? '- ' : kind === 'ol' ? `${n}. ` : '> ') + bare;
  });
  const text = next.join('\n');
  onChange(value.slice(0, a) + text + value.slice(b));
  setSel(el, a, a + text.length);
}

function insertBlockText(el: HTMLTextAreaElement, value: string, onChange: Change, block: string, selectFrom = 0, selectLen = 0) {
  const a = el.selectionStart, b = el.selectionEnd;
  const before = value.slice(0, a), after = value.slice(b);
  const pre = !before || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const post = !after || after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  onChange(before + pre + block + post + after);
  const at = before.length + pre.length + selectFrom;
  setSel(el, at, at + selectLen);
}

const TABLE_MD = 'Tabla: Título de la tabla\n\n| Ítem | Descripción | Estado |\n|---|---|:---:|\n| 1 | … | Listo |\n| 2 | … | Pendiente |';
/** Diagrama de ejemplo (Mermaid) para modificar */
export const DIAGRAM_MD = '```mermaid\nflowchart LR\n  A[Inicio] --> B{¿Aprobado?}\n  B -- Sí --> C[Continuar]\n  B -- No --> D[Corregir]\n  D --> B\n```';

function codeAction(el: HTMLTextAreaElement, value: string, onChange: Change, a: Action) {
  switch (a) {
    case 'bold': return wrapSelection(el, value, onChange, '**');
    case 'italic': return wrapSelection(el, value, onChange, '*');
    case 'underline': return wrapSelection(el, value, onChange, '++');
    case 'strike': return wrapSelection(el, value, onChange, '~~');
    case 'mark': return wrapSelection(el, value, onChange, '==');
    case 'code': return wrapSelection(el, value, onChange, '`', '`', 'código');
    case 'math': return wrapSelection(el, value, onChange, '$', '$', 'x^2');
    case 'heading': return prefixLines(el, value, onChange, 'h');
    case 'ul': return prefixLines(el, value, onChange, 'ul');
    case 'ol': return prefixLines(el, value, onChange, 'ol');
    case 'quote': return prefixLines(el, value, onChange, 'quote');
    case 'table': return insertBlockText(el, value, onChange, TABLE_MD, 7, 18);
    case 'diagram': return insertBlockText(el, value, onChange, DIAGRAM_MD, 11, 12);
  }
}

/** Ctrl/⌘ + B / I / U en la vista de código. */
export function handleFormatKeys(e: React.KeyboardEvent<HTMLTextAreaElement>, value: string, onChange: Change) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return false;
  const k = e.key.toLowerCase();
  const el = e.currentTarget;
  if (k === 'b') wrapSelection(el, value, onChange, '**');
  else if (k === 'i') wrapSelection(el, value, onChange, '*');
  else if (k === 'u') wrapSelection(el, value, onChange, '++');
  else return false;
  e.preventDefault();
  return true;
}

/* =====================================================================
   Vista visual: HTML del texto formateado (igual al impreso)
   ===================================================================== */

/** Markdown → HTML del editor (mismo dibujo que RichText; las fórmulas quedan como piezas). */
function mdToEditorHtml(md: string) {
  const html = renderToStaticMarkup(<RichText text={md} />);
  // Se saca la envoltura <div class="rp-md">: el editor ya es .rp-md
  return html.replace(/^<div class="rp-md">/, '').replace(/<\/div>$/, '') || '<p class="rp-md-p"><br></p>';
}

const mathHtml = (tex: string, display: boolean) =>
  renderToStaticMarkup(<MathFormula tex={tex} display={display} raw={display ? `$$${tex}$$` : `$${tex}$`} />);

function editorRoot(node: Node | null): HTMLElement | null {
  const el = node && (node.nodeType === 1 ? (node as Element) : node.parentElement);
  return (el?.closest('.rp-md-editor') as HTMLElement) || null;
}

/** Envuelve (o desenvuelve) la selección en una etiqueta: resaltado, código. */
function toggleInlineTag(root: HTMLElement, tag: 'mark' | 'code') {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return;
  const start = range.startContainer.nodeType === 1 ? (range.startContainer as Element) : range.startContainer.parentElement;
  const found = start?.closest(tag);
  if (found && root.contains(found)) {
    const parent = found.parentNode!;
    while (found.firstChild) parent.insertBefore(found.firstChild, found);
    parent.removeChild(found);
    return;
  }
  const el = document.createElement(tag);
  if (tag === 'code') el.className = 'rp-md-code';
  if (range.collapsed) el.textContent = tag === 'code' ? 'código' : 'texto';
  else el.appendChild(range.extractContents());
  range.insertNode(el);
  sel.removeAllRanges();
  const r = document.createRange();
  r.selectNodeContents(el);
  sel.addRange(r);
}

function currentBlock(root: HTMLElement): Element | null {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  let n: Node | null = sel.getRangeAt(0).startContainer;
  while (n && n !== root) {
    if (n.nodeType === 1 && /^(P|DIV|H[1-6]|BLOCKQUOTE|LI|PRE)$/.test((n as Element).tagName)) return n as Element;
    n = n.parentNode;
  }
  return null;
}

/** Inserta un elemento donde está el cursor (siempre dentro de un párrafo, no suelto). */
function insertAtCaret(root: HTMLElement, node: HTMLElement) {
  const sel = window.getSelection();
  let range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
  if (!range || !root.contains(range.commonAncestorContainer)) {
    range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(false);
  }
  range.deleteContents();
  // Cursor suelto en el editor (entre bloques): se lleva al final del párrafo anterior
  if (range.startContainer === root) {
    const prev = root.childNodes[range.startOffset - 1] as HTMLElement | undefined;
    if (prev && prev.nodeType === 1 && /^(P|H[1-6]|LI|BLOCKQUOTE)$/.test(prev.tagName)) {
      range.selectNodeContents(prev);
      range.collapse(false);
    } else if (!prev) {
      const p = document.createElement('p');
      p.className = 'rp-md-p';
      root.insertBefore(p, root.firstChild);
      range.selectNodeContents(p);
    }
  }
  range.insertNode(node);
  const space = document.createTextNode('\u00a0');
  node.after(space);
  range.setStartAfter(space);
  range.collapse(true);
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function visualAction(root: HTMLElement, a: Action, openMath: (el: HTMLElement) => void) {
  root.focus();
  const exec = (cmd: string, val?: string) => document.execCommand(cmd, false, val);
  switch (a) {
    case 'bold': return exec('bold');
    case 'italic': return exec('italic');
    case 'underline': return exec('underline');
    case 'strike': return exec('strikeThrough');
    case 'mark': return toggleInlineTag(root, 'mark');
    case 'code': return toggleInlineTag(root, 'code');
    case 'ul': return exec('insertUnorderedList');
    case 'ol': return exec('insertOrderedList');
    case 'heading': {
      const b = currentBlock(root);
      return exec('formatBlock', b && /^H[1-6]$/.test(b.tagName) ? 'P' : 'H4');
    }
    case 'quote': {
      const b = currentBlock(root);
      return exec('formatBlock', b?.closest('blockquote') ? 'P' : 'BLOCKQUOTE');
    }
    case 'table':
      return exec(
        'insertHTML',
        '<p class="rp-md-p">Tabla: Título de la tabla</p><div class="rp-md-table-wrap nt-wrap rp-table"><table class="rp-md-table nt-tbl"><thead><tr><th>Ítem</th><th>Descripción</th><th>Estado</th></tr></thead>' +
          '<tbody><tr><td>1</td><td>…</td><td>…</td></tr><tr><td>2</td><td>…</td><td>…</td></tr></tbody></table></div><p class="rp-md-p"><br></p>',
      );
    case 'diagram':
      // Se pega como Markdown: el editor arma el bloque de código y lo pone en su lugar
      return pasteMarkdown(root, DIAGRAM_MD);
    case 'math': {
      const el = document.createElement('span');
      el.setAttribute('data-md-raw', '$x^2$');
      el.contentEditable = 'false';
      el.className = 'rp-math-src';
      el.textContent = '$x^2$';
      insertAtCaret(root, el);
      openMath(el);
      return;
    }
  }
}

/** Inserta Markdown en el cursor del editor visual, por el mismo camino que un pegado */
function pasteMarkdown(root: HTMLElement, md: string) {
  root.focus();
  const dt = new DataTransfer();
  dt.setData('text/plain', md);
  root.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
}

/* =====================================================================
   Barra
   ===================================================================== */

const FormatButtons: React.FC<{ onAction: (a: Action, at?: DOMRect) => void; compact: boolean; math: boolean }> = ({ onAction, compact, math }) => {
  const B = (title: string, icon: React.ReactNode, a: Action) => (
    <button
      type="button"
      className="ui-tb"
      title={title}
      aria-label={title}
      // No le saca el foco ni la selección al texto
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => onAction(a, e.currentTarget.getBoundingClientRect())}
    >
      {icon}
    </button>
  );
  return (
    <>
      {B('Negrita (Ctrl+B)', <Bold />, 'bold')}
      {B('Cursiva (Ctrl+I)', <Italic />, 'italic')}
      {B('Subrayado (Ctrl+U)', <Underline />, 'underline')}
      {B('Tachado', <Strikethrough />, 'strike')}
      {B('Resaltado', <Highlighter />, 'mark')}
      {!compact && (
        <>
          <span className="ui-tb-sep" />
          {B('Subtítulo', <Heading2 />, 'heading')}
          {B('Viñetas', <List />, 'ul')}
          {B('Lista numerada', <ListOrdered />, 'ol')}
          {B('Cita', <TextQuote />, 'quote')}
          {B('Tabla', <Table />, 'table')}
          {B('Diagrama (Mermaid)', <Workflow />, 'diagram')}
        </>
      )}
      {!compact && (
        <>
          <span className="ui-tb-sep" />
          {B('Referencia a una foto, figura o tabla ("ver Foto 03")', <Link2 />, 'ref')}
        </>
      )}
      <span className="ui-tb-sep" />
      {B('Código', <Code />, 'code')}
      {math && B('Ecuación', <Sigma />, 'math')}
    </>
  );
};

/** Ayuda de Markdown (solo en la vista de código). */
const MarkdownHelp: React.FC<{ math: boolean }> = ({ math }) => {
  const C = ({ children }: { children: React.ReactNode }) => <code className="bg-slate-100 px-1 rounded">{children}</code>;
  return (
    <div className="no-print space-y-1 mt-1.5 text-[10px] text-slate-500 leading-snug">
      <div className="flex items-start gap-1.5">
        <Type className="w-3 h-3 mt-px text-[var(--rp-primary)] shrink-0" />
        <span>
          Markdown, el formato de ChatGPT, Claude o Gemini: <C>**negrita**</C> <C>*cursiva*</C> <C>++subrayado++</C>{' '}
          <C>~~tachado~~</C> <C>==resaltado==</C>, <C>## Título</C>, <C>- viñeta</C>, <C>1. numerada</C>, <C>- [x] tarea</C>,{' '}
          <C>&gt; cita</C>, tablas con <C>| a | b |</C>.
        </span>
      </div>
      <div className="flex items-start gap-1.5">
        <Workflow className="w-3 h-3 mt-px text-[var(--rp-primary)] shrink-0" />
        <span>
          Diagramas: un bloque <C>```mermaid</C> … <C>```</C> (flujos, secuencias, Gantt, organigramas) se dibuja en la hoja
          con los colores del tema. Una IA te lo escribe si le pedís "en Mermaid".
        </span>
      </div>
      <div className="flex items-start gap-1.5">
        <Hash className="w-3 h-3 mt-px text-[var(--rp-primary)] shrink-0" />
        <span>
          Referencias: con el botón de cadena elegís la foto, figura o tabla y aparece "Foto 03" o "Tabla 2", que se renumera solo.
          Las tablas se numeran si tienen un renglón <C>Tabla: Título</C> justo antes (el botón Tabla ya lo pone).
        </span>
      </div>
      {math && (
        <div className="flex items-start gap-1.5">
          <Sigma className="w-3 h-3 mt-px text-[var(--rp-primary)] shrink-0" />
          <span>
            Ecuaciones (LaTeX): <C>$E = mc^2$</C> en el renglón, <C>$$ \frac{'{'}a{'}'}{'{'}b{'}'} $$</C> centrada. También{' '}
            <C>\( … \)</C> y <C>\[ … \]</C>. Un precio como $500 queda como texto; para un $ suelto, <C>\$</C>.
          </span>
        </div>
      )}
    </div>
  );
};

/* =====================================================================
   Editor
   ===================================================================== */

export const RichEditor: React.FC<{
  value: string;
  onChange: Change;
  placeholder?: string;
  /** Sin títulos, listas, citas ni tablas (cuadros de un solo tipo). */
  compact?: boolean;
  math?: boolean;
  /** Ayuda de Markdown en la vista de código. */
  help?: boolean;
  className?: string;
  /** Si se da, aparece "Dividir aquí": corta el texto en el cursor en dos partes. */
  onSplit?: (before: string, after: string) => void;
}> = ({ value, onChange, placeholder = 'Escriba aquí…', compact = false, math = true, help = true, className = '', onSplit }) => {
  const [view, setView] = useState<EditView>(readView);
  const ref = useRef<HTMLDivElement>(null);
  const sampleSel = useMemo(() => selectAllOnEnter(), []);
  // Tablas: barra de tabla y grilla para elegir el tamaño
  const tblRef = useRef<TableToolsHandle>(null);
  const tblSel = useRef<Range | null>(null);
  const [tblPick, setTblPick] = useState<DOMRect | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const lastMd = useRef<string | null>(null);
  const [mathEdit, setMathEdit] = useState<{ el: HTMLElement; tex: string; display: boolean; top: number; left: number } | null>(null);

  const switchView = (v: EditView) => { setView(v); saveView(v); setMathEdit(null); };

  // Visual: se arma el HTML cuando el texto cambia desde afuera (no al escribir,
  // para no mover el cursor)
  useLayoutEffect(() => {
    if (view !== 'visual') return;
    const el = ref.current;
    if (!el) return;
    if (el.dataset.built === '1' && value === lastMd.current) return;
    const build = () => {
      el.innerHTML = mdToEditorHtml(value);
      el.dataset.built = '1';
      lastMd.current = value;
      el.classList.toggle('is-empty', !value.trim());
    };
    build();
    let off = false;
    if (hasMath(value) && !katexReady()) loadKatex().then(() => { if (!off && lastMd.current === value) build(); }).catch(() => {});
    return () => { off = true; };
  }, [value, view]);

  // Código: el cuadro crece con el texto (no hay barra de desplazamiento)
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (view !== 'code' || !ta) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 2 + 'px';
  }, [value, view]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    // Todo borrado: si quedó un bloque de código o una cita vacíos, se vuelve a un párrafo común
    // (si no, lo que se escribe después entra en el bloque de código)
    if (!(el.textContent || '').trim() && !el.querySelector('table,hr,[data-md-raw],img') && el.querySelector('pre,blockquote,.rp-mermaid')) {
      el.innerHTML = '<p class="rp-md-p"><br></p>';
      const r = document.createRange(); r.setStart(el.firstChild!, 0); r.collapse(true);
      const sel = getSelection(); sel?.removeAllRanges(); sel?.addRange(r);
    }
    const md = htmlToMd(el, true);
    lastMd.current = md;
    el.classList.toggle('is-empty', !md.trim() && !el.querySelector('table,hr,[data-md-raw]'));
    if (md !== value) onChange(md);
  };

  const openMath = (m: HTMLElement) => {
    const wrap = ref.current?.parentElement;
    if (!wrap) return;
    const raw = m.getAttribute('data-md-raw') || '';
    const display = /^\$\$|^\\\[/.test(raw);
    const tex = raw.replace(/^\$\$|\$\$$|^\\\[|\\\]$|^\\\(|\\\)$|^\$|\$$/g, '').trim();
    const r = m.getBoundingClientRect(), w = wrap.getBoundingClientRect();
    const k = wrap.offsetWidth / (w.width || 1); // sin el zoom de la vista
    setMathEdit({ el: m, tex, display, top: (r.bottom - w.top) * k + 4, left: Math.max(0, (r.left - w.left) * k) });
  };

  const commitMath = (tex: string, display: boolean, remove = false) => {
    const m = mathEdit?.el;
    setMathEdit(null);
    if (!m || !m.isConnected) return;
    if (remove || !tex.trim()) m.remove();
    else {
      const go = () => {
        const tmp = document.createElement('span');
        tmp.innerHTML = mathHtml(tex.trim(), display);
        const fresh = tmp.firstElementChild;
        if (fresh && m.isConnected) m.replaceWith(fresh);
        emit();
      };
      if (katexReady()) go(); else loadKatex().then(go).catch(go);
      return;
    }
    emit();
  };

  /* ---- Referencias: lista de fotos, figuras y tablas del informe para citarlas ---- */
  const [refPop, setRefPop] = useState<DOMRect | null>(null);
  const refSel = useRef<{ range?: Range; pos?: number } | null>(null);
  const insertRef = (it: RefItem) => {
    const token = `[[ref:${it.id}]]`;
    setRefPop(null);
    if (view === 'code') {
      const ta = taRef.current;
      const at = refSel.current?.pos ?? value.length;
      const before = value.slice(0, at), after = value.slice(at);
      const pre = before && !/\s$/.test(before) ? ' ' : '';
      onChange(before + pre + token + after);
      if (ta) setSel(ta, at + pre.length + token.length, at + pre.length + token.length);
      return;
    }
    const root = ref.current;
    if (!root) return;
    root.focus();
    const r = refSel.current?.range;
    if (r) { const sel = getSelection(); sel?.removeAllRanges(); sel?.addRange(r); }
    const chip = document.createElement('span');
    chip.className = 'rp-ref-chip';
    chip.setAttribute('data-md-raw', token);
    chip.contentEditable = 'false';
    chip.textContent = it.label;
    insertAtCaret(root, chip);
    // Un espacio después, para seguir escribiendo
    const sp = document.createTextNode('\u00a0');
    chip.after(sp);
    const rr = document.createRange(); rr.setStartAfter(sp); rr.collapse(true);
    const sel = getSelection(); sel?.removeAllRanges(); sel?.addRange(rr);
    emit();
  };

  /* ---- @ al escribir: lista de figuras, tablas y datos del informe ---- */
  type MentionItem = { kind: 'ref'; it: RefItem } | { kind: 'var'; v: VarInfo };
  const [mention, setMention] = useState<{ rect: DOMRect; q: string; i: number } | null>(null);
  const mentionRange = useRef<Range | null>(null);
  const norm = (t: string) => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  // Misma lista y orden que el @ del resto del programa (MentionLayer)
  const mentionItems = (q: string): MentionItem[] => sharedMentionItems(q);
  const checkMention = () => {
    const sel = getSelection();
    const root = ref.current;
    if (!root || !sel || !sel.rangeCount || !sel.isCollapsed) { setMention(null); return; }
    const r = sel.getRangeAt(0);
    const node = r.startContainer;
    if (node.nodeType !== 3 || !root.contains(node) || (node.parentElement && node.parentElement.closest('pre,code,[data-md-raw]'))) { setMention(null); return; }
    const before = (node.textContent || '').slice(0, r.startOffset);
    const m = /(^|[\s(\u00a0])@([\p{L}\p{N}_-]{0,30})$/u.exec(before);
    if (!m) { setMention(null); return; }
    const rg = document.createRange();
    rg.setStart(node, r.startOffset - m[2].length - 1);
    rg.setEnd(node, r.startOffset);
    mentionRange.current = rg;
    const rect = rg.getBoundingClientRect();
    setMention((prev) => ({ rect, q: m[2], i: prev && prev.q === m[2] ? prev.i : 0 }));
  };
  const pickMention = (item: MentionItem) => {
    const root = ref.current;
    const rg = mentionRange.current;
    setMention(null);
    if (!root || !rg) return;
    root.focus();
    const sel = getSelection();
    sel?.removeAllRanges();
    sel?.addRange(rg);
    rg.deleteContents();
    const chip = document.createElement('span');
    chip.contentEditable = 'false';
    if (item.kind === 'ref') {
      chip.className = 'rp-ref-chip';
      chip.setAttribute('data-md-raw', `[[ref:${item.it.id}]]`);
      chip.textContent = item.it.label;
    } else {
      chip.className = 'rp-var-chip';
      chip.setAttribute('data-md-raw', `{${item.v.key}}`);
      chip.title = `${item.v.label} · {${item.v.key}}`;
      chip.textContent = item.v.value || item.v.label;
    }
    rg.insertNode(chip);
    const sp = document.createTextNode('\u00a0');
    chip.after(sp);
    const rr = document.createRange(); rr.setStartAfter(sp); rr.collapse(true);
    sel?.removeAllRanges(); sel?.addRange(rr);
    emit();
  };

  const onAction = (a: Action, at?: DOMRect) => {
    if (a === 'ref') {
      if (view === 'code') refSel.current = { pos: taRef.current?.selectionStart ?? value.length };
      else {
        const sel = getSelection();
        const r = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
        refSel.current = { range: r && ref.current?.contains(r.startContainer) ? r.cloneRange() : undefined };
      }
      setRefPop(at ?? null);
      return;
    }
    if (view === 'code') {
      const ta = taRef.current;
      if (ta) codeAction(ta, value, onChange, a);
      return;
    }
    // Tabla en la vista con formato: se elige el tamaño en una grilla (o 3 × 3 si no hay dónde mostrarla)
    if (a === 'table') {
      const s0 = getSelection();
      tblSel.current = s0 && s0.rangeCount && ref.current?.contains(s0.anchorNode) ? s0.getRangeAt(0).cloneRange() : null;
      if (at) setTblPick(at); else tblRef.current?.insert(3, 3);
      return;
    }
    const el = ref.current;
    if (!el) return;
    if (a === 'math' && !katexReady()) loadKatex().catch(() => {});
    visualAction(el, a, openMath);
    emit();
  };

  /** Parte el texto en el cursor: lo de antes queda, lo de después va a otro bloque. */
  const splitHere = () => {
    if (!onSplit) return;
    if (view === 'code') {
      const ta = taRef.current;
      if (!ta) return;
      const i = ta.selectionStart;
      const before = value.slice(0, i).replace(/\s+$/, ''), after = value.slice(i).replace(/^\s+/, '');
      if (before && after) onSplit(before, after);
      return;
    }
    const root = ref.current;
    const sel = window.getSelection();
    if (!root || !sel || !sel.rangeCount || !root.contains(sel.getRangeAt(0).startContainer)) return;
    const r = sel.getRangeAt(0);
    const head = document.createRange();
    head.setStart(root, 0);
    head.setEnd(r.startContainer, r.startOffset);
    const tail = document.createRange();
    tail.setStart(r.startContainer, r.startOffset);
    tail.setEnd(root, root.childNodes.length);
    const box = (f: DocumentFragment) => { const d = document.createElement('div'); d.appendChild(f); return htmlToMd(d, true).trim(); };
    const before = box(head.cloneContents()), after = box(tail.cloneContents());
    if (before && after) onSplit(before, after);
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const cd = e.clipboardData;
    const html = cd.getData('text/html');
    const text = cd.getData('text/plain');
    if (!html && !text) return;
    e.preventDefault();
    // Dentro de una celda: solo texto, en un renglón (pegar párrafos o tablas adentro la rompe)
    const selNode = getSelection()?.anchorNode;
    const inCell = (selNode && (selNode.nodeType === 1 ? (selNode as Element) : selNode.parentElement)?.closest('td,th'));
    if (inCell) {
      document.execCommand('insertText', false, text.replace(/\s*\n\s*/g, ' ').trim());
      emit();
      return;
    }
    let md = text;
    // Rango copiado de Excel como texto (columnas separadas por tabulación) → tabla
    const tsv = !/<table/i.test(html) ? tsvToMd(text) : null;
    // Un bloque de código con ``` (un diagrama Mermaid copiado de un chat): el texto plano es el bueno,
    // el HTML de los chats lo trae partido en renglones sueltos
    if (tsv) md = tsv;
    else if (html && !/(^|\n)\s*(```|~~~)/.test(text)) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const fromHtml = htmlToMd(doc.body, false);
      // Si el HTML no trae formato (solo párrafos) y el texto parece Markdown, gana el texto
      const plainish = !doc.body.querySelector('b,strong,i,em,u,h1,h2,h3,h4,ul,ol,table,blockquote,pre,code,mark');
      // Copiado de un bloque de código de un chat (todo es un único <pre>): lo de adentro es Markdown
      const pres = doc.body.querySelectorAll('pre');
      const onlyPre = pres.length === 1 && (pres[0].textContent || '').trim().length >= (doc.body.textContent || '').trim().length - 2;
      if (onlyPre && text.trim()) { md = text; } else
      md = plainish && /(^|\n)\s*(#{1,6}\s|[-*]\s|\d+\.\s|\|)|\*\*|\$\$/.test(text) ? text : fromHtml || text;
    }
    const blocks = parseBlocks(md);
    const root = ref.current!;
    if (blocks.length === 1 && blocks[0].t === 'p') {
      // Un solo párrafo se pega dentro del renglón, sin cortarlo
      const ins = mdToEditorHtml(md).replace(/^<p class="rp-md-p">/, '').replace(/<\/p>$/, '');
      document.execCommand('insertHTML', false, ins);
      emit();
    } else {
      // Varios bloques: se arma el texto entero (antes + pegado + después) y se redibuja.
      // Pegarlo con el navegador a veces cambia el orden de listas y párrafos.
      const sel = window.getSelection();
      const r = sel && sel.rangeCount && root.contains(sel.getRangeAt(0).startContainer) ? sel.getRangeAt(0) : null;
      const part = (from: [Node, number], to: [Node, number]) => {
        const rg = document.createRange();
        rg.setStart(from[0], from[1]);
        rg.setEnd(to[0], to[1]);
        const d = document.createElement('div');
        d.appendChild(rg.cloneContents());
        return htmlToMd(d, true).trim();
      };
      const before = r ? part([root, 0], [r.startContainer, r.startOffset]) : htmlToMd(root, true).trim();
      const after = r ? part([r.endContainer, r.endOffset], [root, root.childNodes.length]) : '';
      const head = [before, md.trim()].filter(Boolean).join('\n\n');
      const full = [head, after].filter(Boolean).join('\n\n');
      const apply = () => {
      root.innerHTML = mdToEditorHtml(full);
      root.classList.toggle('is-empty', !full.trim());
      lastMd.current = full;
      if (full !== value) onChange(full);
      // Cursor al final de lo pegado
      const n = new DOMParser().parseFromString(`<div>${mdToEditorHtml(head)}</div>`, 'text/html').body.firstElementChild!.childElementCount;
      const last = root.children[Math.max(0, n - 1)];
      if (last && sel) {
        const c = document.createRange();
        c.selectNodeContents(last);
        c.collapse(false);
        sel.removeAllRanges();
        sel.addRange(c);
      }
      };
      // Con fórmulas, se espera a KaTeX para dibujarlas de una vez (y no perder el cursor)
      if (hasMath(full) && !katexReady()) loadKatex().then(apply, apply); else apply();
      return;
    }
    // Si KaTeX todavía no estaba cargado, las fórmulas pegadas se redibujan al cargar
    if (hasMath(md) && !katexReady()) {
      loadKatex().then(() => {
        const el = ref.current;
        if (el && lastMd.current != null) el.innerHTML = mdToEditorHtml(lastMd.current);
      }).catch(() => {});
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = ref.current!;
    if (!mention && tblRef.current?.onKey(e)) return;
    if (mention) {
      const items = mentionItems(mention.q);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (items.length) setMention({ ...mention, i: (mention.i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length });
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && items.length) {
        e.preventDefault();
        pickMention(items[Math.min(mention.i, items.length - 1)]);
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); setMention(null); return; }
    }
    // Tab dentro de una lista: sangría (subnivel) o la quita
    if (e.key === 'Tab') {
      const b = currentBlock(el);
      if (b?.closest('li')) {
        e.preventDefault();
        document.execCommand(e.shiftKey ? 'outdent' : 'indent');
        emit();
      }
      return;
    }
    // ``` (o ```mermaid) + Enter en un renglón propio: se arma un bloque de código, como en Markdown
    if (e.key === 'Enter' && !e.shiftKey) {
      const b = currentBlock(el);
      const m = b && b.tagName !== 'PRE' ? /^\s*(```|~~~)\s*([\w+-]*)\s*$/.exec(b.textContent || '') : null;
      if (b && m) {
        e.preventDefault();
        const lang = m[2];
        const body = lang.toLowerCase() === 'mermaid' ? 'flowchart LR\n  A[Inicio] --> B[Fin]' : '…';
        const r = document.createRange();
        r.selectNodeContents(b);
        const sel = getSelection(); sel?.removeAllRanges(); sel?.addRange(r);
        pasteMarkdown(el, '```' + lang + '\n' + body + '\n```');
        return;
      }
    }
    // Ctrl+B/I/U los resuelve el navegador; el input avisa el cambio
  };

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    const check = t.closest('.rp-md-check');
    if (check) {
      const li = check.closest('li');
      if (li) {
        const done = !li.classList.contains('is-done');
        li.classList.toggle('is-done', done);
        check.textContent = done ? '✓' : '';
        emit();
      }
      return;
    }
    const m = t.closest('[data-md-raw]') as HTMLElement | null;
    if (m && ref.current?.contains(m) && !m.classList.contains('rp-ref-chip') && !m.classList.contains('rp-var-chip')) openMath(m);
  };

  // Al salir del editor se cierra la ventanita de la fórmula
  useEffect(() => { if (view !== 'visual') setMathEdit(null); }, [view]);

  return (
    <div className={`rp-rich-editor relative ${className}`} onMouseDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      {refPop && (
        <UiPop anchor={refPop} onClose={() => setRefPop(null)} caption="Citar en el texto" className="rp-ref-pop">
          {(() => {
            const items = getRefCatalog();
            if (!items.length) return <div className="rp-ref-empty">Todavía no hay fotos, documentos, diagramas ni tablas con título para citar.</div>;
            const KIND: Record<RefItem['kind'], string> = { foto: 'Fotos', documento: 'Documentos', diagrama: 'Diagramas', grafico: 'Gráficos', tabla: 'Tablas' };
            return (Object.keys(KIND) as RefItem['kind'][]).filter((k) => items.some((i) => i.kind === k)).map((k) => (
              <div key={k} className="rp-ref-group">
                <div className="ui-pop-caption">{KIND[k]}</div>
                {items.filter((i) => i.kind === k).map((it) => (
                  <button key={it.id} type="button" className="rp-ref-item" onMouseDown={(e) => e.preventDefault()} onClick={() => insertRef(it)}>
                    <b>{it.label}</b><span>{it.caption || '—'}</span>
                  </button>
                ))}
              </div>
            ));
          })()}
        </UiPop>
      )}
      {!compact && <TableTools ref={tblRef} root={ref} onChanged={() => emit()} active={view === 'visual'} />}
      {tblPick && (
        <TableSizePicker anchor={tblPick} onClose={() => setTblPick(null)}
          onPick={(r, c) => {
            setTblPick(null);
            const el = ref.current;
            if (el && tblSel.current) { el.focus(); const s0 = getSelection(); s0?.removeAllRanges(); s0?.addRange(tblSel.current); }
            tblRef.current?.insert(r, c);
          }} />
      )}
      {mention && (() => {
        const items = mentionItems(mention.q);
        const cur = Math.min(mention.i, Math.max(0, items.length - 1));
        const row = (x: MentionItem, k: number) => (
          <MentionRow key={x.kind === 'ref' ? 'r' + x.it.id : 'v' + x.v.key} x={x} active={k === cur}
            onHover={() => setMention((m) => (m ? { ...m, i: k } : m))} onPick={() => pickMention(x)} />
        );
        return (
          <UiPop anchor={mention.rect} align="start" onClose={() => setMention(null)} className="rp-fx-pop rp-mention-pop">
            {!items.length && <div className="rp-fx-empty">Nada coincide con “{mention.q}”. Seguí escribiendo o Esc.</div>}
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
      })()}
      {/* La barra vive fija en pantalla, sobre el panel de edición (no se pierde al desplazarse) */}
      <EditDock slot="format">
        <div className="rp-fmt-bar ui-glass" role="toolbar" aria-label="Formato de texto" onMouseDown={(e) => e.preventDefault()}>
          <FormatButtons onAction={onAction} compact={compact} math={math} />
          {onSplit && (
            <>
              <span className="ui-tb-sep" />
              <button
                type="button"
                className="ui-tb"
                title="Dividir aquí: lo que sigue al cursor pasa a otro bloque, para poder insertar algo en medio"
                onMouseDown={(e) => e.preventDefault()}
                onClick={splitHere}
              >
                <Scissors />
              </button>
            </>
          )}
          <span className="ui-tb-sep" />
          <button
            type="button"
            className={`ui-tb${view === 'visual' ? ' on' : ''}`}
            title="Vista con formato: se escribe sobre el texto ya formateado"
            aria-pressed={view === 'visual'}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => switchView('visual')}
          >
            <Eye />
          </button>
          <button
            type="button"
            className={`ui-tb${view === 'code' ? ' on' : ''}`}
            title="Vista de código (Markdown, el formato de los LLM)"
            aria-pressed={view === 'code'}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => switchView('code')}
          >
            <CodeXml />
          </button>
        </div>
      </EditDock>

      {view === 'visual' ? (
        <div
          ref={ref}
          className="rp-md rp-md-editor relative"
          contentEditable
          suppressContentEditableWarning
          spellCheck
          role="textbox"
          aria-multiline="true"
          data-placeholder={placeholder}
          onFocus={(e) => {
            try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* */ }
            // Texto de ejemplo: al entrar queda todo seleccionado y lo que se escribe lo reemplaza
            sampleSel.onFocus(e, isSampleText(value));
          }}
          onMouseUp={sampleSel.onMouseUp}
          onInput={() => { emit(); checkMention(); }}
          onBlur={() => setTimeout(() => setMention(null), 150)}
          onPaste={onPaste}
          onKeyDown={onKeyDown}
          onClick={onClick}
        />
      ) : (
        <>
          <textarea
            ref={taRef}
            className="rp-md-source"
            value={value}
            onFocus={(e) => sampleSel.onFocus(e, isSampleText(value))}
            onMouseUp={sampleSel.onMouseUp}
            spellCheck={false}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => handleFormatKeys(e, value, onChange)}
          />
          {help && <MarkdownHelp math={math} />}
        </>
      )}

      {mathEdit && (
        <MathPopover
          key={mathEdit.top + ':' + mathEdit.left}
          {...mathEdit}
          onCommit={commitMath}
          onCancel={() => setMathEdit(null)}
        />
      )}
    </div>
  );
};

const MathPopover: React.FC<{
  tex: string;
  display: boolean;
  top: number;
  left: number;
  onCommit: (tex: string, display: boolean, remove?: boolean) => void;
  onCancel: () => void;
}> = ({ tex, display, top, left, onCommit, onCancel }) => {
  const [t, setT] = useState(tex);
  const [d, setD] = useState(display);
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => { inp.current?.focus(); inp.current?.select(); }, []);
  return (
    <div className="rp-math-pop ui-glass is-sm no-print" style={{ top, left }} onMouseDown={(e) => e.stopPropagation()}>
      <Sigma className="w-3.5 h-3.5 text-white/70 shrink-0 ml-1" />
      <input
        ref={inp}
        type="text"
        value={t}
        placeholder="LaTeX, p. ej. \frac{q L^2}{8}"
        onChange={(e) => setT(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); onCommit(t, d); }
          if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
        }}
      />
      <button
        type="button"
        className={`ui-tb${d ? ' on' : ''}`}
        title="Centrada en su propio renglón"
        onClick={() => setD(!d)}
      >
        ⇔
      </button>
      <button type="button" className="ui-tb is-accent" title="Aplicar (Enter)" onClick={() => onCommit(t, d)}>
        <Check />
      </button>
      <button type="button" className="ui-tb is-danger" title="Quitar la ecuación" onClick={() => onCommit(t, d, true)}>
        <Trash2 />
      </button>
    </div>
  );
};
