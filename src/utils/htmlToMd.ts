import { readTableDom, tableToMd } from './mdTable';
import { wordEquationToTex, mathmlToTex } from './mathConvert';

/**
 * Convierte HTML (el del editor visual, o lo que se pega desde una página o un
 * chat de IA) al Markdown que guarda el informe (ver components/RichText).
 *
 * keepNewlines: en el editor los saltos dentro de un párrafo son reales
 * (white-space: pre-line); en HTML pegado de afuera son solo espacios.
 */

const BLOCK_TAGS = new Set([
  'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'TABLE', 'HR',
  'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'FIGURE', 'MAIN', 'ASIDE', 'NAV', 'DL', 'DD', 'DT',
]);
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'META', 'LINK', 'TITLE', 'BUTTON', 'svg', 'SVG']);

const BLOCK_SEL = 'p,div,h1,h2,h3,h4,h5,h6,ul,ol,li,blockquote,pre,table,hr,section,article';
/** Bloque: etiqueta de bloque, o cualquier otra (p. ej. <table-block> de Gemini) que tenga bloques adentro. */
const isBlock = (n: Node) => {
  if (n.nodeType !== 1) return false;
  const el = n as Element;
  // Ecuaciones (aunque vengan en un <div>) se tratan dentro del renglón
  if (el.hasAttribute('data-math') || el.hasAttribute('data-latex') || el.hasAttribute('data-tex')) return false;
  if (BLOCK_TAGS.has(el.tagName)) return true;
  if (el.getAttribute('data-md-raw') != null || el.localName === 'math' || el.classList.contains('katex')) return false;
  return !!el.querySelector(BLOCK_SEL);
};

/** Escapa lo que el lector de Markdown tomaría como formato. */
export function escapeMdText(s: string): string {
  return s
    .replace(/\\(?=[\\`*_{}()#+\-.!~=<>|$])/g, '\\\\')
    .replace(/[*`]/g, (c) => '\\' + c)
    .replace(/(?<![\p{L}\p{N}])_|_(?![\p{L}\p{N}])/gu, '\\_')
    .replace(/~~/g, '\\~\\~')
    .replace(/==/g, '\\=\\=')
    .replace(/\+\+/g, '\\+\\+')
    .replace(/\$(?=[^\s\d])/g, '\\$')
    .replace(/<(?=\/?(?:u|b|i|em|strong|mark|s|del|sub|sup|br)\b)/gi, '\\<');
}

/** Un renglón que empieza como título, lista, cita o tabla se protege con "\". */
const escapeLineStarts = (s: string) =>
  s
    .split('\n')
    .map((l) =>
      l
        .replace(/^(\s*)(#{1,6}\s|>|[-+*•]\s|\|)/, '$1\\$2')
        .replace(/^(\s*\d{1,9})([.)]\s)/, '$1\\$2')
        .replace(/^(\s*)([-*_])(\s*\2){2,}\s*$/, (m) => m.replace(/[-*_]/, (c) => '\\' + c)),
    )
    .join('\n');

const wrapMd = (inner: string, open: string, close = open) => {
  if (!inner.trim()) return inner;
  const lead = inner.match(/^\s*/)![0];
  const trail = inner.match(/\s*$/)![0];
  return lead + open + inner.trim() + close + trail;
};

function inlineOf(node: Node, keepNewlines: boolean): string {
  let out = '';
  node.childNodes.forEach((c) => { out += inlineNode(c, keepNewlines); });
  return out;
}

const texMd = (tex: string, display: boolean) => (display ? `$$${tex}$$` : `$${tex}$`);

function inlineNode(n: Node, keepNewlines: boolean): string {
  // Ecuación de Word (viene en un comentario condicional con su OMML)
  if (n.nodeType === 8) {
    const eq = wordEquationToTex((n as Comment).data);
    return eq ? texMd(eq.tex, eq.display) : '';
  }
  if (n.nodeType === 3) {
    let t = n.nodeValue || '';
    t = t.replace(/ /g, ' ').replace(/​/g, '');
    if (!keepNewlines) t = t.replace(/\s+/g, ' ');
    return escapeMdText(t);
  }
  if (n.nodeType !== 1) return '';
  const el = n as HTMLElement;
  const tag = el.tagName;
  if (SKIP_TAGS.has(tag)) return '';
  // Fórmula (o algo que el editor marcó como pieza): vuelve su texto original
  const raw = el.getAttribute('data-md-raw');
  if (raw != null) return raw;
  if (el.classList.contains('rp-md-check')) return '';
  // Ecuaciones de chats y páginas: data-math (Gemini), data-latex / data-tex, MathML
  const dm = el.getAttribute('data-math') ?? el.getAttribute('data-latex') ?? el.getAttribute('data-tex');
  if (dm != null && dm.trim()) {
    const display = /block|display/i.test(el.className) || el.tagName === 'DIV';
    return texMd(dm.trim(), display);
  }
  if (el.localName === 'math') {
    const eq = mathmlToTex(el);
    return eq ? texMd(eq.tex, eq.display) : '';
  }
  if (el.classList.contains('MathJax') || el.classList.contains('MathJax_Preview') || el.classList.contains('MJX_Assistive_MathML')) {
    const m = el.querySelector('math');
    if (el.classList.contains('MathJax_Preview')) return '';
    if (m) { const eq = mathmlToTex(m); return eq ? texMd(eq.tex, eq.display) : ''; }
  }
  // Fórmula de KaTeX pegada desde otra página: su LaTeX está en la anotación
  if (el.classList.contains('katex') || el.classList.contains('katex-display')) {
    const tex = el.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
    if (tex) return texMd(tex.trim(), el.classList.contains('katex-display') || !!el.closest('.katex-display'));
    const m = el.querySelector('math');
    if (m) { const eq = mathmlToTex(m); if (eq) return texMd(eq.tex, !!el.closest('.katex-display')); }
  }
  if (tag === 'BR') return '\n';
  if (tag === 'IMG') return '';
  if (isBlock(el)) return '\n' + blocksOf(el, keepNewlines).join('\n') + '\n';

  const inner = () => inlineOf(el, keepNewlines);
  switch (tag) {
    case 'B': case 'STRONG': return wrapMd(inner(), '**');
    case 'I': case 'EM': case 'CITE': case 'DFN': return wrapMd(inner(), '*');
    case 'U': case 'INS': return wrapMd(inner(), '++');
    case 'S': case 'STRIKE': case 'DEL': return wrapMd(inner(), '~~');
    case 'MARK': return wrapMd(inner(), '==');
    case 'SUB': return wrapMd(inner(), '<sub>', '</sub>');
    case 'SUP': return wrapMd(inner(), '<sup>', '</sup>');
    case 'CODE': case 'KBD': case 'SAMP': {
      const t = (el.textContent || '').replace(/\n/g, ' ');
      if (!t) return '';
      const tick = t.includes('`') ? '``' : '`';
      return tick + (tick === '``' ? ' ' + t + ' ' : t) + tick;
    }
    case 'A': {
      const href = el.getAttribute('href') || '';
      const txt = inner();
      return /^(https?:|mailto:)/i.test(href) && txt.trim() ? `[${txt.trim()}](${href})` : txt;
    }
  }
  // <span style="…"> (lo que dejan algunos navegadores y páginas)
  let s = inner();
  const st = el.style;
  if (st) {
    const bg = st.backgroundColor;
    if (bg && !/^(transparent|rgba\(0, 0, 0, 0\)|initial|inherit)$/.test(bg) && !/^(rgb\(255, 255, 255\)|white)$/.test(bg)) s = wrapMd(s, '==');
    if (/line-through/.test(st.textDecoration || st.textDecorationLine)) s = wrapMd(s, '~~');
    if (/underline/.test(st.textDecoration || st.textDecorationLine)) s = wrapMd(s, '++');
    if (st.fontStyle === 'italic') s = wrapMd(s, '*');
    const fw = st.fontWeight;
    if (fw === 'bold' || fw === 'bolder' || parseInt(fw, 10) >= 600) s = wrapMd(s, '**');
  }
  return s;
}

const cleanPara = (s: string, keepNewlines: boolean) => {
  let t = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  if (!keepNewlines) t = t.replace(/^ +| +$/gm, '');
  return escapeLineStarts(t.replace(/^\n+|\n+$/g, ''));
};

function headingLevel(el: Element): number {
  if (el.classList.contains('rp-md-h1')) return 1;
  if (el.classList.contains('rp-md-h2')) return 2;
  if (el.classList.contains('rp-md-h3')) return 3;
  return ({ H1: 1, H2: 2, H3: 3, H4: 2, H5: 3, H6: 3 } as Record<string, number>)[el.tagName] ?? 2;
}

function listOf(el: Element, keepNewlines: boolean): string {
  const ordered = el.tagName === 'OL';
  let n = ordered ? parseInt(el.getAttribute('start') || '1', 10) || 1 : 1;
  const items: string[] = [];
  el.childNodes.forEach((c) => {
    if (c.nodeType !== 1) {
      if ((c.nodeValue || '').trim() && items.length) items[items.length - 1] += ' ' + escapeMdText(c.nodeValue!.trim());
      return;
    }
    const ce = c as Element;
    // Lista anidada directamente en la lista (lo que hace "sangría" en el navegador)
    if (ce.tagName === 'UL' || ce.tagName === 'OL') {
      const sub = listOf(ce, keepNewlines);
      const pad = items.length ? '  ' : '';
      if (items.length) items[items.length - 1] += '\n' + sub.split('\n').map((l) => pad + l).join('\n');
      else items.push(sub);
      return;
    }
    const marker = ordered ? `${n++}. ` : '- ';
    const pad = ' '.repeat(marker.length);
    let task = '';
    if (ce.classList.contains('rp-md-task')) task = ce.classList.contains('is-done') ? '[x] ' : '[ ] ';
    else {
      const box = ce.querySelector(':scope > input[type="checkbox"]') as HTMLInputElement | null;
      if (box) task = box.checked ? '[x] ' : '[ ] ';
    }
    const parts = blocksOf(ce, keepNewlines);
    const body = parts.length ? parts.join('\n') : '';
    const lines = body.split('\n');
    items.push(marker + task + lines[0] + (lines.length > 1 ? '\n' + lines.slice(1).map((l) => (l ? pad + l : l)).join('\n') : ''));
  });
  return items.join('\n');
}

function tableOf(el: HTMLTableElement, keepNewlines: boolean): string {
  if (!el.rows.length) return '';
  const cell = (c: Element) => {
    const t = inlineOf(c, keepNewlines).replace(/^\s+|\s+$/g, '').replace(/\n+/g, '<br>').replace(/\|/g, '\\|').trim();
    // Un "<" o "^" escrito en la celda es texto, no una marca de celda combinada
    return /^[<^]$/.test(t) ? `\\${t}` : t || ' ';
  };
  const m = readTableDom(el, cell);
  // Tablas pegadas de otros lados (sin data-align): la alineación sale de la primera fila
  if (!el.hasAttribute('data-align')) {
    Array.from(el.rows[0].cells).forEach((c, k) => {
      const a = (c as HTMLElement).style.textAlign || c.getAttribute('align') || '';
      if (k < m.align.length) m.align[k] = a === 'center' ? 'center' : a === 'right' ? 'right' : null;
    });
    if (!el.hasAttribute('data-noheader')) m.opts.header = true; // lo de afuera siempre trae encabezado en la 1.ª fila
  }
  return tableToMd(m.cells, m.align, m.opts);
}

/** Bloques de un contenedor (párrafos, listas, tablas…), cada uno ya en Markdown. */
export function blocksOf(container: Node, keepNewlines: boolean): string[] {
  const out: string[] = [];
  let para = '';
  const flush = () => {
    const p = cleanPara(para, keepNewlines);
    if (p.trim()) out.push(p);
    para = '';
  };
  // Listas de Word: son párrafos sueltos con style="mso-list:l0 level1 lfo1"; se juntan acá
  let wordList: string[] = [];
  const wordCount: number[] = [];
  let wordKey = '';
  const flushWord = () => {
    if (wordList.length) out.push(wordList.join('\n'));
    wordList = [];
    wordCount.length = 0;
    wordKey = '';
  };
  container.childNodes.forEach((n) => {
    const wl = wordListItem(n, keepNewlines);
    if (wl) {
      flush();
      // Otra lista de Word (otro "l0/l1…"), o cambio de viñeta a número en el primer nivel: lista nueva
      const key = wl.list + (wl.level === 1 ? (wl.ordered ? '#' : '-') : wordKey.slice(-1));
      if (wordList.length && (wl.level === 1 ? key !== wordKey : !wordKey.startsWith(wl.list))) flushWord();
      if (wl.level === 1 || !wordKey) wordKey = key;
      const lvl = Math.min(wl.level, wordCount.length + 1);
      wordCount.length = lvl;
      wordCount[lvl - 1] = (wordCount[lvl - 1] ?? 0) + 1;
      // Se respeta el número que traía Word (una lista que arranca en 20 sigue en 20)
      if (wl.ordered && wl.num != null && wordCount[lvl - 1] === 1) wordCount[lvl - 1] = wl.num;
      const marker = wl.ordered ? `${wordCount[lvl - 1]}. ` : '- ';
      wordList.push('   '.repeat(lvl - 1) + marker + wl.text);
      return;
    }
    // Entre ítems de Word suele haber espacios o saltos sueltos: no cortan la lista
    if (wordList.length && n.nodeType !== 1 && !(n.nodeValue || '').trim()) return;
    flushWord();
    if (!isBlock(n)) { para += inlineNode(n, keepNewlines); return; }
    flush();
    const el = n as HTMLElement;
    if (el.getAttribute('data-md-raw') != null) { out.push(el.getAttribute('data-md-raw')!); return; }
    switch (el.tagName) {
      case 'H1': case 'H2': case 'H3': case 'H4': case 'H5': case 'H6': {
        const src = /mso-list/i.test(el.getAttribute('style') || '') ? stripWordMarker(el).clone : el;
        const t = inlineOf(src, keepNewlines).replace(/\s*\n\s*/g, ' ').trim();
        if (t) out.push('#'.repeat(headingLevel(el)) + ' ' + t);
        break;
      }
      case 'UL': case 'OL': {
        const l = listOf(el, keepNewlines);
        if (l.trim()) out.push(l);
        break;
      }
      case 'BLOCKQUOTE': {
        const inner = blocksOf(el, keepNewlines).join('\n\n');
        if (inner.trim()) out.push(inner.split('\n').map((l) => (l ? '> ' + l : '>')).join('\n'));
        break;
      }
      case 'PRE': {
        // Renglones: el editor visual puede partirlos con <br> o <div> al apretar Enter
        const c = el.cloneNode(true) as HTMLElement;
        c.querySelectorAll('br').forEach((b) => b.replaceWith('\n'));
        c.querySelectorAll('div, p').forEach((d) => { d.prepend('\n'); });
        const t = (c.textContent || '').replace(/^\n/, '').replace(/\n$/, '');
        if (!t.trim()) break; // bloque de código vacío: no se guarda
        // Se conserva el lenguaje del bloque (```mermaid, ```python…)
        const lang = (el as HTMLElement).dataset?.lang
          || /(?:^|\s)language-([\w+-]+)/.exec(el.querySelector('code')?.className || '')?.[1] || '';
        out.push('```' + lang + '\n' + t + '\n```');
        break;
      }
      case 'TABLE': {
        const t = tableOf(el as HTMLTableElement, keepNewlines);
        if (t) out.push(t);
        break;
      }
      case 'HR':
        out.push('---');
        break;
      default: {
        // Párrafo o contenedor (div con bloques adentro)
        const hasBlocks = Array.from(el.childNodes).some(isBlock);
        if (hasBlocks) out.push(...blocksOf(el, keepNewlines));
        else {
          const p = cleanPara(inlineOf(el, keepNewlines), keepNewlines);
          if (p.trim()) out.push(p);
        }
      }
    }
  });
  flushWord();
  flush();
  return out;
}

/** Un párrafo-ítem de lista de Word: nivel, si es numerado y su texto (sin la viñeta). */
function wordListItem(n: Node, keepNewlines: boolean): { level: number; ordered: boolean; text: string; list: string; num?: number } | null {
  if (n.nodeType !== 1) return null;
  const el = n as HTMLElement;
  // Un título numerado de Word sigue siendo título (se le saca el número de lista, ver más abajo)
  if (/^H[1-6]$/.test(el.tagName)) return null;
  const st = el.getAttribute('style') || '';
  const m = st.match(/mso-list:\s*(l\d+)\s+level(\d+)/i);
  if (!m) return null;
  const { clone, marker: mk } = stripWordMarker(el);
  let marker = mk;
  marker = marker.replace(/\u00a0/g, ' ').trim();
  const ordered = /^[(\[]?([0-9]{1,3}|[a-zA-Z]{1,2}|[ivxlcdmIVXLCDM]{1,5})[.)\]]$/.test(marker);
  const text = cleanPara(inlineOf(clone, keepNewlines), keepNewlines).replace(/\n+/g, ' ').trim();
  const num = /^\d{1,4}[.)]$/.test(marker) ? parseInt(marker, 10) : undefined;
  return { level: parseInt(m[2], 10) || 1, ordered, text, list: m[1].toLowerCase(), num };
}

/** HTML → Markdown. */
export function htmlToMd(root: Node, keepNewlines = true): string {
  return blocksOf(root, keepNewlines).join('\n\n');
}

/** Copia del elemento sin la viñeta/número que Word pone entre [if !supportLists] y [endif]. */
function stripWordMarker(el: HTMLElement): { clone: HTMLElement; marker: string } {
  // La viñeta o el número va entre los comentarios [if !supportLists] … [endif]
  const clone = el.cloneNode(true) as HTMLElement;
  let marker = '';
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_COMMENT);
  const comments: Comment[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode as Comment);
  const start = comments.find((c) => /if\s+!supportLists/i.test(c.data));
  if (start) {
    const end = comments.find((c) => c !== start && /endif/i.test(c.data) && (start.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING));
    const range = document.createRange();
    range.setStartAfter(start);
    if (end) range.setEndBefore(end); else range.setEndAfter(start);
    marker = range.toString();
    range.deleteContents();
  } else {
    // Sin comentarios: la viñeta es el primer <span style="mso-list:Ignore">
    const ign = clone.querySelector('[style*="mso-list:Ignore" i], [style*="mso-list: Ignore" i]');
    if (ign) { marker = ign.textContent || ''; ign.remove(); }
  }
  return { clone, marker };
}
