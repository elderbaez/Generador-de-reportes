import React, { useContext } from 'react';
import { RefsContext, applyRefs, TABLE_CAPTION, stripRefTags, refLabel } from '../utils/refs';
import { resolveVars, getReportData, currentVars } from '../utils/fields';
import { TABLE_OPTS_RE, TableOpts, DEFAULT_OPTS, parseTableOpts, layoutSpans, alignAttr } from '../utils/mdTable';
import { MathFormula } from './MathText';
import { MermaidDiagram } from './Mermaid';
import { splitMdChunks, trackDisplay, type MathMode } from '../utils/mdChunks';
import './rich-text.css';

/**
 * Texto con formato en Markdown, el que escriben los LLM (ChatGPT, Claude,
 * Gemini…), para poder pegar su respuesta tal cual. Se arma con elementos de
 * React (nada de innerHTML), así que un texto pegado no puede meter código.
 *
 * En el renglón:
 *   **negrita**  __negrita__  *cursiva*  _cursiva_  ***ambas***
 *   ++subrayado++  <u>subrayado</u>  ~~tachado~~  ==resaltado==
 *   `código`  [enlace](https://…)  H<sub>2</sub>O  m<sup>3</sup>  <br>
 *   ecuaciones: $…$  \( … \)  $$…$$  \[ … \]   (ver MathText)
 *   \* \_ \$ …  muestran el signo tal cual
 *
 * Bloques:
 *   # Título   ## Subtítulo   ### Apartado
 *   - viñetas / * / +  (con sangría se anidan)   1. numerada   - [ ] / - [x] tareas
 *   > cita     ``` código ```     ---  (línea)     | tablas | con | barras |
 *
 * Un salto de renglón simple se respeta (como al escribir en el cuadro).
 */

/* =====================================================================
   En el renglón
   ===================================================================== */

type Inline =
  | { t: 'text'; v: string }
  | { t: 'br' }
  | { t: 'code'; v: string }
  | { t: 'math'; tex: string; display: boolean; raw: string }
  | { t: 'link'; href: string; kids: Inline[] }
  | { t: 'wrap'; tag: 'strong' | 'em' | 'u' | 's' | 'mark' | 'sub' | 'sup'; kids: Inline[] };

// Cada alternativa tiene un solo grupo con nombre; la primera que calza gana.
const INLINE_RE = new RegExp(
  [
    String.raw`(?<code>(?<tick>` + '`+' + String.raw`)(?<codev>[\s\S]*?[^` + '`' + String.raw`])\k<tick>(?!` + '`' + String.raw`))`,
    String.raw`(?<mdd>\$\$(?<mddv>[\s\S]+?)\$\$)`,
    String.raw`(?<mbd>\\\[(?<mbdv>[\s\S]+?)\\\])`,
    String.raw`(?<mpi>\\\((?<mpiv>[\s\S]+?)\\\))`,
    String.raw`(?<mdi>\$(?=[^\s$])(?<mdiv>[^\n$]*?[^\s\\$])\$(?!\d))`,
    String.raw`(?<esc>\\(?<escv>[\\` + '`' + String.raw`*_{}\[\]()#+\-.!~=<>|$]))`,
    String.raw`(?<br><br\s*\/?>)`,
    String.raw`(?<html><(?<htag>u|b|strong|i|em|mark|s|del|sub|sup)>(?<htmlv>[\s\S]+?)<\/\k<htag>>)`,
    String.raw`(?<bi>\*\*\*(?=\S)(?<biv>[\s\S]+?)(?<=\S)\*\*\*)`,
    String.raw`(?<b1>\*\*(?=\S)(?<b1v>[\s\S]+?)(?<=\S)\*\*)`,
    String.raw`(?<b2>(?<![\p{L}\p{N}])__(?=\S)(?<b2v>[\s\S]+?)(?<=\S)__(?![\p{L}\p{N}]))`,
    String.raw`(?<ul>\+\+(?=\S)(?<ulv>[\s\S]+?)(?<=\S)\+\+)`,
    String.raw`(?<st>~~(?=\S)(?<stv>[\s\S]+?)(?<=\S)~~)`,
    String.raw`(?<hl>==(?=\S)(?<hlv>[\s\S]+?)(?<=\S)==)`,
    String.raw`(?<i1>\*(?<i1v>[^\s*](?:[^*\n]*?[^\s*])?)\*(?!\*))`,
    String.raw`(?<i2>(?<![\p{L}\p{N}_])_(?<i2v>[^\s_](?:[^_\n]*?[^\s_])?)_(?![\p{L}\p{N}_]))`,
    String.raw`(?<lk>\[(?<lkt>[^\]\n]+)\]\((?<lkh>https?:\/\/[^)\s]+|mailto:[^)\s]+)\))`,
  ].join('|'),
  'gu',
);

const HTML_TAG: Record<string, Extract<Inline, { t: 'wrap' }>['tag']> = {
  u: 'u', b: 'strong', strong: 'strong', i: 'em', em: 'em', mark: 'mark', s: 's', del: 's', sub: 'sub', sup: 'sup',
};

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  const text = (v: string) => {
    if (!v) return;
    const prev = out[out.length - 1];
    if (prev && prev.t === 'text') prev.v += v; else out.push({ t: 'text', v });
  };
  let last = 0;
  for (const m of src.matchAll(INLINE_RE)) {
    const g = m.groups!;
    const i = m.index ?? 0;
    text(src.slice(last, i));
    last = i + m[0].length;
    const wrap = (tag: Extract<Inline, { t: 'wrap' }>['tag'], inner: string) =>
      out.push({ t: 'wrap', tag, kids: parseInline(inner) });

    if (g.code !== undefined) {
      const v = g.codev;
      // `` `x` `` → se quita un espacio a cada lado, como en Markdown
      out.push({ t: 'code', v: /^ .* $/.test(v) && v.trim() ? v.slice(1, -1) : v });
    } else if (g.mdd !== undefined || g.mbd !== undefined || g.mpi !== undefined || g.mdi !== undefined) {
      const tex = (g.mddv ?? g.mbdv ?? g.mpiv ?? g.mdiv ?? '').trim();
      if (!tex) text(m[0]);
      else out.push({ t: 'math', tex, display: g.mdd !== undefined || g.mbd !== undefined, raw: m[0] });
    } else if (g.esc !== undefined) text(g.escv);
    else if (g.br !== undefined) out.push({ t: 'br' });
    else if (g.html !== undefined) wrap(HTML_TAG[g.htag], g.htmlv);
    else if (g.bi !== undefined) out.push({ t: 'wrap', tag: 'strong', kids: [{ t: 'wrap', tag: 'em', kids: parseInline(g.biv) }] });
    else if (g.b1 !== undefined) wrap('strong', g.b1v);
    else if (g.b2 !== undefined) wrap('strong', g.b2v);
    else if (g.ul !== undefined) wrap('u', g.ulv);
    else if (g.st !== undefined) wrap('s', g.stv);
    else if (g.hl !== undefined) wrap('mark', g.hlv);
    else if (g.i1 !== undefined) wrap('em', g.i1v);
    else if (g.i2 !== undefined) wrap('em', g.i2v);
    else if (g.lk !== undefined) out.push({ t: 'link', href: g.lkh, kids: parseInline(g.lkt) });
    else text(m[0]);
  }
  text(src.slice(last));

  // Una ecuación centrada ya ocupa su renglón: se quita el salto pegado a ella
  out.forEach((n, k) => {
    if (n.t !== 'math' || !n.display) return;
    const prev = out[k - 1], next = out[k + 1];
    if (prev?.t === 'text') prev.v = prev.v.replace(/\n[ \t]*$/, '');
    if (next?.t === 'text') next.v = next.v.replace(/^[ \t]*\n/, '');
  });
  return out;
}

/** Texto con referencias (@nombre → "Foto 03") y campos ({fecha}, {vertice}…).
    En la hoja se reemplazan; en el editor cada pieza es una ficha que se guarda tal cual. */
const RefText: React.FC<{ v: string }> = ({ v }) => {
  const idx = useContext(RefsContext);
  if (idx) return <>{resolveVars(applyRefs(v, idx), getReportData())}</>;
  const vars = new Map(currentVars().map((x) => [x.key, x]));
  const parts = v.split(/(\[\[ref:[^\]\n]+\]\]|\{[A-Za-z]\w*\})/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = /^\[\[ref:([^\]\n]+)\]\]$/.exec(p);
        if (m) return <span key={i} className="rp-ref-chip" data-md-raw={p} contentEditable={false}>{refLabel(m[1]) ?? 'referencia'}</span>;
        const f = /^\{(\w+)\}$/.exec(p);
        const info = f && vars.get(f[1]);
        if (info) return <span key={i} className="rp-var-chip" data-md-raw={p} contentEditable={false} title={`${info.label} · {${info.key}}`}>{info.value || info.label}</span>;
        return <React.Fragment key={i}>{p}</React.Fragment>;
      })}
    </>
  );
};

/** Rótulo de tabla ("Tabla: Cronograma {#crono}") → "Tabla 2. Cronograma" con número del informe */
const TableCaption: React.FC<{ raw: string }> = ({ raw }) => {
  const idx = useContext(RefsContext);
  const m = TABLE_CAPTION.exec(raw);
  if (!idx || !m) return <p className="rp-md-p">{renderInline(parseInline(raw))}</p>;
  const n = idx.tableNo[raw.trim()];
  const word = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
  const title = stripRefTags(m[2]);
  return (
    <p className="rp-caption rp-md-table-caption">
      <span className="rp-md-table-num">{word}{n ? ` ${n}` : ''}</span>
      {title && <>. {renderInline(parseInline(title))}</>}
    </p>
  );
};

function renderInline(nodes: Inline[], keyBase = ''): React.ReactNode[] {
  return nodes.map((n, i) => {
    const key = keyBase + i;
    switch (n.t) {
      case 'text': return /[@{]|\[\[ref:/.test(n.v) ? <RefText key={key} v={n.v} /> : <React.Fragment key={key}>{n.v}</React.Fragment>;
      case 'br': return <br key={key} />;
      case 'code': return <code key={key} className="rp-md-code">{n.v}</code>;
      case 'math': return <MathFormula key={key} tex={n.tex} display={n.display} raw={n.raw} />;
      case 'link':
        return (
          <a key={key} className="rp-md-link" href={n.href} target="_blank" rel="noopener noreferrer">
            {renderInline(n.kids, key + '.')}
          </a>
        );
      case 'wrap': {
        const Tag = n.tag;
        return <Tag key={key} className={`rp-md-${n.tag}`}>{renderInline(n.kids, key + '.')}</Tag>;
      }
    }
  });
}

/** Solo el formato del renglón (para títulos, celdas, ítems sueltos). */
export const InlineRich: React.FC<{ text: string }> = ({ text }) => <>{renderInline(parseInline(text || ''))}</>;

/* =====================================================================
   Bloques
   ===================================================================== */

type ListItem = { kids: Block[]; task?: boolean; done?: boolean };
type Block =
  | { t: 'p'; v: string }
  | { t: 'h'; level: 1 | 2 | 3; v: string }
  | { t: 'hr' }
  | { t: 'quote'; kids: Block[] }
  | { t: 'pre'; v: string; lang: string }
  | { t: 'list'; ordered: boolean; start: number; items: ListItem[] }
  | { t: 'table'; align: ('left' | 'center' | 'right' | null)[]; head: string[]; rows: string[][]; opts: TableOpts };

const RE_FENCE = /^\s*(```+|~~~+)\s*([\w+-]*)\s*$/;
const RE_HEAD = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const RE_HR = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const RE_QUOTE = /^\s{0,3}>\s?/;
const RE_LIST = /^(\s*)([-*+•]|\d{1,9}[.)])\s+(.*)$/;
const RE_TSEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

const splitRow = (line: string) => {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  // Se respeta \| como barra dentro de la celda
  return s.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
};

const isBlockStart = (line: string, next?: string) =>
  RE_FENCE.test(line) || RE_HEAD.test(line) || RE_HR.test(line) || RE_QUOTE.test(line) || RE_LIST.test(line) ||
  TABLE_OPTS_RE.test(line) ||
  (line.includes('|') && next !== undefined && RE_TSEP.test(next) && next.includes('-'));

const indentOf = (s: string) => s.replace(/\t/g, '    ').match(/^ */)![0].length;

export function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    // ``` código ```
    const fence = line.match(RE_FENCE);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) body.push(lines[i++]);
      i++;
      out.push({ t: 'pre', v: body.join('\n'), lang: fence[2] });
      continue;
    }

    const head = line.match(RE_HEAD);
    if (head) {
      out.push({ t: 'h', level: Math.min(3, head[1].length) as 1 | 2 | 3, v: head[2] });
      i++;
      continue;
    }

    if (RE_HR.test(line)) {
      out.push({ t: 'hr' });
      i++;
      continue;
    }

    if (RE_QUOTE.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && lines[i].trim() && RE_QUOTE.test(lines[i])) inner.push(lines[i++].replace(RE_QUOTE, ''));
      out.push({ t: 'quote', kids: parseBlocks(inner.join('\n')) });
      continue;
    }

    // Opciones de la tabla que sigue (<!-- tabla: sin-encabezado alternadas -->); suelta no se muestra
    let tOpts: TableOpts = DEFAULT_OPTS;
    if (TABLE_OPTS_RE.test(line)) {
      const nx = lines[i + 1], nx2 = lines[i + 2];
      if (nx !== undefined && nx.includes('|') && nx2 !== undefined && RE_TSEP.test(nx2) && nx2.includes('-')) {
        tOpts = parseTableOpts(line) ?? DEFAULT_OPTS;
        i++;
      } else { i++; continue; }
    }
    const tline = lines[i];

    // Tabla: renglón con barras seguido del separador |---|
    if (tline.includes('|') && i + 1 < lines.length && RE_TSEP.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const head = splitRow(tline);
      const align = splitRow(lines[i + 1]).map((c) =>
        c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : null,
      );
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) rows.push(splitRow(lines[i++]));
      out.push({ t: 'table', align, head, rows, opts: tOpts });
      continue;
    }

    if (RE_LIST.test(line)) {
      const block: string[] = [];
      const firstM = line.match(RE_LIST)!;
      const baseIndent = indentOf(firstM[1]);
      const ordered = /\d/.test(firstM[2]);
      // Un ítem al mismo nivel pero de otro tipo (viñeta ↔ número) empieza otra lista
      const otherKind = (l: string) => {
        const m = l.match(RE_LIST);
        return !!m && indentOf(m[1]) <= baseIndent + 1 && /\d/.test(m[2]) !== ordered;
      };
      // La lista sigue mientras haya ítems, renglones con sangría o un renglón
      // vacío seguido de otro ítem.
      while (i < lines.length) {
        const l = lines[i];
        if (block.length && otherKind(l)) break;
        if (RE_LIST.test(l) || (l.trim() && indentOf(l) > 0 && block.length)) { block.push(l); i++; continue; }
        if (!l.trim() && i + 1 < lines.length && RE_LIST.test(lines[i + 1]) && !otherKind(lines[i + 1])) { i++; continue; }
        break;
      }
      out.push(parseList(block));
      continue;
    }

    // Párrafo: hasta un renglón vacío o el comienzo de otro bloque. Una ecuación
    // $$ … $$ de varios renglones queda entera en el mismo párrafo.
    const para: string[] = [];
    let mode: MathMode = null;
    while (i < lines.length) {
      const l = lines[i];
      if (!mode && para.length && (!l.trim() || isBlockStart(l, lines[i + 1]))) break;
      if (!mode && !l.trim()) break;
      para.push(l);
      mode = trackDisplay(l, mode);
      i++;
    }
    out.push({ t: 'p', v: para.join('\n') });
  }
  return out;
}

function parseList(lines: string[]): Extract<Block, { t: 'list' }> {
  const first = lines[0].match(RE_LIST)!;
  const base = indentOf(first[1]);
  const ordered = /\d/.test(first[2]);
  const list: Extract<Block, { t: 'list' }> = { t: 'list', ordered, start: ordered ? parseInt(first[2], 10) : 1, items: [] };
  let cur: { text: string[]; sub: string[] } | null = null;
  const flush = () => {
    if (!cur) return;
    let txt = cur.text.join('\n');
    const item: ListItem = { kids: [] };
    const task = txt.match(/^\[([ xX])\]\s+/);
    if (task) { item.task = true; item.done = task[1] !== ' '; txt = txt.slice(task[0].length); }
    item.kids.push({ t: 'p', v: txt });
    if (cur.sub.length) {
      const sub = cur.sub.map((l) => l.replace(new RegExp('^ {0,' + (base + 2) + '}'), ''));
      item.kids.push(...parseBlocks(sub.join('\n')));
    }
    list.items.push(item);
  };
  for (const l of lines) {
    const m = l.match(RE_LIST);
    if (m && indentOf(m[1]) <= base + 1) {
      flush();
      cur = { text: [m[3]], sub: [] };
    } else if (cur) {
      // Sub-ítem (más sangría) o continuación del texto del ítem
      if (m || cur.sub.length) cur.sub.push(l.replace(/^\s{0,1}/, ''));
      else cur.text.push(l.trim());
    }
  }
  flush();
  return list;
}

function renderBlocks(blocks: Block[], keyBase = ''): React.ReactNode[] {
  return blocks.map((b, i) => {
    const key = keyBase + i;
    switch (b.t) {
      case 'p':
        if (TABLE_CAPTION.test(b.v) && !b.v.includes('\n')) return <TableCaption key={key} raw={b.v} />;
        return <p key={key} className="rp-md-p">{renderInline(parseInline(b.v))}</p>;
      case 'h': {
        const Tag = (`h${b.level + 2}`) as 'h3' | 'h4' | 'h5';
        return <Tag key={key} className={`rp-md-h rp-md-h${b.level}`}>{renderInline(parseInline(b.v))}</Tag>;
      }
      case 'hr':
        return <hr key={key} className="rp-md-hr" />;
      case 'quote':
        return <blockquote key={key} className="rp-md-quote">{renderBlocks(b.kids, key + '.')}</blockquote>;
      case 'pre':
        // ```mermaid → diagrama (en la hoja); en el editor se ve el código para poder editarlo
        if (b.lang.toLowerCase() === 'mermaid') return <MermaidDiagram key={key} code={b.v} />;
        return <pre key={key} className="rp-md-pre" data-lang={b.lang || undefined}><code className={b.lang ? `language-${b.lang}` : undefined}>{b.v}</code></pre>;
      case 'list': {
        const items = b.items.map((it, k) => (
          <li key={k} className={it.task ? `rp-md-task${it.done ? ' is-done' : ''}` : undefined}>
            {it.task && <span className="rp-md-check" aria-hidden contentEditable={false}>{it.done ? '✓' : ''}</span>}
            {renderBlocks(it.kids, key + '.' + k + '.')}
          </li>
        ));
        return b.ordered
          ? <ol key={key} className="rp-md-ol" start={b.start}>{items}</ol>
          : <ul key={key} className="rp-md-ul">{items}</ul>;
      }
      case 'table': {
        // Celdas combinadas ("<" y "^") y opciones: ver utils/mdTable
        const W = Math.max(b.head.length, ...b.rows.map((r) => r.length));
        const fill = (r: string[]) => Array.from({ length: W }, (_, k) => r[k] ?? '');
        const all = [fill(b.head), ...b.rows.map(fill)];
        const headRows = b.opts.header ? all.slice(0, 1) : [];
        const bodyRows = b.opts.header ? all.slice(1) : all;
        const cellsOf = (grid: string[][], Tag: 'th' | 'td', base: number) =>
          layoutSpans(grid).map((row, ri) => (
            <tr key={base + ri}>
              {row.map((cell, k) => cell && (
                <Tag key={k} colSpan={cell.colSpan > 1 ? cell.colSpan : undefined} rowSpan={cell.rowSpan > 1 ? cell.rowSpan : undefined}
                  style={{ textAlign: b.align[k] ?? undefined }}>
                  {renderInline(parseInline(cell.text))}
                </Tag>
              ))}
            </tr>
          ));
        return (
          // Misma estética que las tablas de los demás módulos (nt-wrap / nt-tbl, ver notion-table.css)
          <div key={key} className="rp-md-table-wrap nt-wrap rp-table">
            <table className={`rp-md-table nt-tbl${b.opts.alt ? ' rp-md-alt' : ''}${b.opts.header ? '' : ' is-nohead'}`}
              data-align={alignAttr(Array.from({ length: W }, (_, k) => b.align[k] ?? null))}
              data-noheader={b.opts.header ? undefined : '1'} data-alt={b.opts.alt ? '1' : undefined}>
              {headRows.length > 0 && <thead>{cellsOf(headRows, 'th', 0)}</thead>}
              <tbody>{cellsOf(bodyRows, 'td', 1)}</tbody>
            </table>
          </div>
        );
      }
    }
  });
}

/** Texto completo con formato (bloques + renglón + ecuaciones). */
export const RichText: React.FC<{ text: string; className?: string }> = ({ text, className }) => (
  <div className={`rp-md${className ? ' ' + className : ''}`}>{renderBlocks(parseBlocks(text || ''))}</div>
);

/**
 * Igual que RichText pero armado por trozos (ver utils/mdChunks), cada uno con
 * su alto medible. Así un bloque largo se puede repartir entre hojas: se dibuja
 * solo el tramo [from, to) que le toca a esta hoja.
 */
export const ChunkedRichText: React.FC<{ text: string; measureId?: string; from?: number; to?: number; className?: string }> = ({
  text, measureId, from = 0, to, className,
}) => {
  const chunks = splitMdChunks(text || '').slice(from, to);
  return (
    <div className={`rp-md-chunks${className ? ' ' + className : ''}`}>
      {chunks.map((c, k) => (
        <div
          key={k + c.key}
          className={`rp-md rp-md-chunk is-${c.kind}`}
          data-text-chunk={measureId ? `${measureId}|${c.key}` : undefined}
        >
          {renderBlocks(parseBlocks(c.src))}
        </div>
      ))}
    </div>
  );
};
