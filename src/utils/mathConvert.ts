/**
 * Ecuaciones pegadas desde otros programas → LaTeX (lo que dibuja KaTeX).
 *
 *  - Word / Office: OMML (<m:oMath>), que Word pone en el HTML del portapapeles
 *    dentro de un comentario <!--[if gte msEquation 12]> … <![endif]-->.
 *  - Páginas y chats: MathML (<math>), con o sin la anotación LaTeX.
 *
 * No cubre todo OMML/MathML, pero sí lo que aparece en informes: fracciones,
 * potencias, subíndices, raíces, paréntesis, sumatorias, integrales, funciones,
 * acentos, matrices y sistemas.
 */

/* ---------- Símbolos Unicode → comandos LaTeX ---------- */

const SYM: Record<string, string> = {
  α: '\\alpha', β: '\\beta', γ: '\\gamma', δ: '\\delta', ε: '\\varepsilon', ϵ: '\\epsilon', ζ: '\\zeta', η: '\\eta',
  θ: '\\theta', ϑ: '\\vartheta', ι: '\\iota', κ: '\\kappa', λ: '\\lambda', μ: '\\mu', ν: '\\nu', ξ: '\\xi', π: '\\pi',
  ϖ: '\\varpi', ρ: '\\rho', ϱ: '\\varrho', σ: '\\sigma', ς: '\\varsigma', τ: '\\tau', υ: '\\upsilon', φ: '\\varphi',
  ϕ: '\\phi', χ: '\\chi', ψ: '\\psi', ω: '\\omega',
  Γ: '\\Gamma', Δ: '\\Delta', Θ: '\\Theta', Λ: '\\Lambda', Ξ: '\\Xi', Π: '\\Pi', Σ: '\\Sigma', Υ: '\\Upsilon',
  Φ: '\\Phi', Ψ: '\\Psi', Ω: '\\Omega',
  '±': '\\pm', '∓': '\\mp', '×': '\\times', '÷': '\\div', '·': '\\cdot', '⋅': '\\cdot', '∗': '\\ast', '∘': '\\circ',
  '≤': '\\le', '≥': '\\ge', '≠': '\\ne', '≈': '\\approx', '≅': '\\cong', '≡': '\\equiv', '∼': '\\sim', '≃': '\\simeq',
  '∝': '\\propto', '≪': '\\ll', '≫': '\\gg',
  '∞': '\\infty', '∂': '\\partial', '∇': '\\nabla', '∅': '\\emptyset', '∀': '\\forall', '∃': '\\exists',
  '∈': '\\in', '∉': '\\notin', '∋': '\\ni', '⊂': '\\subset', '⊃': '\\supset', '⊆': '\\subseteq', '⊇': '\\supseteq',
  '∪': '\\cup', '∩': '\\cap', '∧': '\\wedge', '∨': '\\vee', '¬': '\\neg',
  '→': '\\to', '←': '\\leftarrow', '↔': '\\leftrightarrow', '⇒': '\\Rightarrow', '⇐': '\\Leftarrow', '⇔': '\\Leftrightarrow',
  '↑': '\\uparrow', '↓': '\\downarrow', '↦': '\\mapsto',
  '∑': '\\sum', '∏': '\\prod', '∐': '\\coprod', '∫': '\\int', '∬': '\\iint', '∭': '\\iiint', '∮': '\\oint',
  '⋃': '\\bigcup', '⋂': '\\bigcap',
  '′': "'", '″': "''", '°': '^\\circ', '…': '\\ldots', '⋯': '\\cdots', '⋮': '\\vdots', '⋱': '\\ddots',
  '⟦': '\\llbracket', '⟧': '\\rrbracket', '⟨': '\\langle', '⟩': '\\rangle', '⌊': '\\lfloor', '⌋': '\\rfloor',
  '⌈': '\\lceil', '⌉': '\\rceil', '‖': '\\|', '∠': '\\angle', '⊥': '\\perp', '∥': '\\parallel', '△': '\\triangle',
  'ℝ': '\\mathbb{R}', 'ℕ': '\\mathbb{N}', 'ℤ': '\\mathbb{Z}', 'ℚ': '\\mathbb{Q}', 'ℂ': '\\mathbb{C}', 'ℏ': '\\hbar',
  'ℓ': '\\ell', '√': '\\surd', '−': '-', '∶': ':', '\u2061': '', '\u2062': '', '\u2063': '', '\u2064': '', '\u200b': '',
};

const FUNCS = new Set([
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'coth',
  'log', 'ln', 'lg', 'exp', 'lim', 'max', 'min', 'sup', 'inf', 'det', 'dim', 'ker', 'deg', 'gcd', 'arg', 'mod',
]);

/** Texto con símbolos Unicode → LaTeX (los comandos llevan un espacio para no pegarse a lo que sigue). */
export function symbolsToTex(t: string): string {
  let out = '';
  for (const ch of t) {
    const m = SYM[ch];
    if (m === undefined) out += /[{}#%&_^]/.test(ch) ? '\\' + ch : ch;
    else out += m && /^\\[a-zA-Z]+$/.test(m) ? m + ' ' : m;
  }
  // Funciones escritas como texto (sin, cos, log…)
  return out.replace(/(?<![\\a-zA-Z])(arcsin|arccos|arctan|sinh|cosh|tanh|coth|sin|cos|tan|cot|sec|csc|log|ln|exp|lim|max|min|det)(?![a-zA-Z])/g, '\\$1 ');
}

const grp = (s: string) => (s.length === 1 || /^\\[a-zA-Z]+\s?$/.test(s) ? s.trim() : `{${s.trim()}}`);
const tidy = (s: string) => s.replace(/\s+/g, ' ').replace(/\s+([}^_)\]])/g, '$1').trim();

/* =====================================================================
   OMML (Word)
   ===================================================================== */

const ln = (el: Element) => (el.localName || el.tagName).toLowerCase().replace(/^m:/, '');
const kids = (el: Element) => Array.from(el.children);
const kid = (el: Element, name: string) => kids(el).find((c) => ln(c) === name);
const val = (el: Element | undefined, name: string) => {
  const c = el && kid(el, name);
  return c ? c.getAttribute('m:val') ?? c.getAttribute('val') ?? '' : undefined;
};

/**
 * Contenido de un elemento OMML. Ojo: en el HTML que copia Word el texto de la
 * fórmula NO va en <m:t>, sino suelto dentro de <m:r> y de <span>/<i> con la
 * letra "Cambria Math": por eso se leen también los nodos de texto.
 */
function omml(el: Element | undefined): string {
  if (!el) return '';
  let out = '';
  el.childNodes.forEach((c) => {
    if (c.nodeType === 3) {
      const t = (c.nodeValue || '').replace(/\u00a0/g, ' ').replace(/[\r\n]+/g, '');
      if (t.trim()) out += symbolsToTex(t);
    } else if (c.nodeType === 1) out += ommlNode(c as Element);
  });
  return out;
}

/** Texto plano de un nodo, sin las propiedades (m:rPr, w:rPr…). */
function plainText(el: Element): string {
  let t = '';
  el.childNodes.forEach((c) => {
    if (c.nodeType === 3) t += (c.nodeValue || '').replace(/\u00a0/g, ' ').replace(/[\r\n]+/g, '');
    else if (c.nodeType === 1 && !/pr$/.test(ln(c as Element))) t += plainText(c as Element);
  });
  return t;
}

const DELIM: Record<string, string> = {
  '(': '(', ')': ')', '[': '[', ']': ']', '{': '\\{', '}': '\\}', '|': '|', '‖': '\\|', '⟨': '\\langle', '⟩': '\\rangle',
  '⌊': '\\lfloor', '⌋': '\\rfloor', '⌈': '\\lceil', '⌉': '\\rceil', '⟦': '\\llbracket', '⟧': '\\rrbracket', '': '.',
};

const NARY: Record<string, string> = {
  '∑': '\\sum', '∏': '\\prod', '∐': '\\coprod', '∫': '\\int', '∬': '\\iint', '∭': '\\iiint', '∮': '\\oint',
  '⋃': '\\bigcup', '⋂': '\\bigcap', '⋁': '\\bigvee', '⋀': '\\bigwedge',
};

const ACC: Record<string, string> = {
  '̂': '\\hat', '^': '\\hat', '̃': '\\tilde', '~': '\\tilde', '̄': '\\bar', '¯': '\\bar', '̇': '\\dot', '̈': '\\ddot',
  '⃗': '\\vec', '→': '\\vec', '́': '\\acute', '̀': '\\grave', '̌': '\\check', '̆': '\\breve',
};

function ommlNode(el: Element): string {
  const n = ln(el);
  switch (n) {
    case 'r': {
      // Texto normal (no cursiva matemática) de más de una letra → \text{}
      const plain = Array.from(el.getElementsByTagName('*')).some((e) => ln(e) === 'nor');
      const t = plainText(el);
      if (plain && /[A-Za-zÁÉÍÓÚáéíóúñÑ]{2,}/.test(t)) return `\\text{${t}}`;
      return omml(el);
    }
    case 't': return symbolsToTex(el.textContent || '');
    case 'f': {
      const type = val(kid(el, 'fpr'), 'type');
      const num = omml(kid(el, 'num')), den = omml(kid(el, 'den'));
      if (type === 'lin') return `${grp(num)}/${grp(den)}`;
      if (type === 'noBar') return `\\binom{${num}}{${den}}`;
      return `\\frac{${num}}{${den}}`;
    }
    case 'ssup': return grp(omml(kid(el, 'e'))) + '^' + grp(omml(kid(el, 'sup')));
    case 'ssub': return grp(omml(kid(el, 'e'))) + '_' + grp(omml(kid(el, 'sub')));
    case 'ssubsup': return grp(omml(kid(el, 'e'))) + '_' + grp(omml(kid(el, 'sub'))) + '^' + grp(omml(kid(el, 'sup')));
    case 'spre': return `{}_${grp(omml(kid(el, 'sub')))}^${grp(omml(kid(el, 'sup')))}` + grp(omml(kid(el, 'e')));
    case 'rad': {
      const deg = omml(kid(el, 'deg'));
      const hide = val(kid(el, 'radpr'), 'deghide');
      return deg.trim() && hide !== '1' && hide !== 'on' ? `\\sqrt[${deg}]{${omml(kid(el, 'e'))}}` : `\\sqrt{${omml(kid(el, 'e'))}}`;
    }
    case 'd': {
      const pr = kid(el, 'dpr');
      const beg = val(pr, 'begchr'), end = val(pr, 'endchr'), sep = val(pr, 'sepchr') ?? '|';
      const open = DELIM[beg ?? '('] ?? symbolsToTex(beg ?? '(');
      const close = DELIM[end ?? ')'] ?? symbolsToTex(end ?? ')');
      const parts = kids(el).filter((c) => ln(c) === 'e').map((c) => omml(c));
      return `\\left${open}${parts.join(sep === '|' ? ' \\mid ' : symbolsToTex(sep))}\\right${close}`;
    }
    case 'nary': {
      const pr = kid(el, 'narypr');
      const chr = val(pr, 'chr') ?? '∫';
      const op = NARY[chr] ?? symbolsToTex(chr);
      const sub = omml(kid(el, 'sub')), sup = omml(kid(el, 'sup'));
      const subHide = val(pr, 'subhide'), supHide = val(pr, 'suphide');
      let s = op;
      if (sub.trim() && subHide !== '1' && subHide !== 'on') s += `_{${sub}}`;
      if (sup.trim() && supHide !== '1' && supHide !== 'on') s += `^{${sup}}`;
      return s + ' ' + omml(kid(el, 'e'));
    }
    case 'func': {
      const fnEl = kid(el, 'fname');
      const name = fnEl ? plainText(fnEl).trim() : '';
      const fn = FUNCS.has(name) ? `\\${name}` : omml(fnEl);
      return `${fn}${fn.startsWith('\\') ? ' ' : ''}${grp(omml(kid(el, 'e')))}`;
    }
    case 'fname': return omml(el);
    case 'acc': {
      const chr = val(kid(el, 'accpr'), 'chr') ?? '̂';
      return `${ACC[chr] ?? '\\hat'}{${omml(kid(el, 'e'))}}`;
    }
    case 'bar': {
      const pos = val(kid(el, 'barpr'), 'pos');
      return `${pos === 'bot' ? '\\underline' : '\\overline'}{${omml(kid(el, 'e'))}}`;
    }
    case 'limlow': {
      const e = omml(kid(el, 'e'));
      const lim = omml(kid(el, 'lim'));
      return `${/^\\(lim|max|min|sup|inf)\s?$/.test(e) ? e.trim() : `\\operatorname*{${e}}`}_{${lim}}`;
    }
    case 'limupp': return `\\overset{${omml(kid(el, 'lim'))}}{${omml(kid(el, 'e'))}}`;
    case 'groupchr': {
      const pr = kid(el, 'groupchrpr');
      const pos = val(pr, 'pos');
      return pos === 'top' ? `\\overbrace{${omml(kid(el, 'e'))}}` : `\\underbrace{${omml(kid(el, 'e'))}}`;
    }
    case 'm': {
      const rows = kids(el).filter((c) => ln(c) === 'mr').map((r) => kids(r).filter((c) => ln(c) === 'e').map(omml).join(' & '));
      return `\\begin{matrix}${rows.join(' \\\\ ')}\\end{matrix}`;
    }
    case 'eqarr': {
      const rows = kids(el).filter((c) => ln(c) === 'e').map(omml);
      return `\\begin{aligned}${rows.map((r) => (r.includes('&') ? r : r.replace(/=/, '&='))).join(' \\\\ ')}\\end{aligned}`;
    }
    case 'box': case 'borderbox': case 'phant': case 'e': case 'num': case 'den': case 'sub': case 'sup': case 'deg': case 'lim':
    case 'omath':
      return omml(el);
    // Propiedades y formato: no son contenido
    case 'rpr': case 'ctrlpr': case 'fpr': case 'dpr': case 'narypr': case 'radpr': case 'accpr': case 'barpr':
    case 'funcpr': case 'limlowpr': case 'limuppr': case 'mpr': case 'eqarrpr': case 'ssuppr': case 'ssubpr':
    case 'ssubsuppr': case 'boxpr': case 'groupchrpr': case 'spr': case 'omathparapr': case 'brk':
      return '';
  }
  if (n.startsWith('w:') || n.startsWith('o:') || n.startsWith('v:')) return '';
  return omml(el);
}

/**
 * Contenido de un comentario de Word "[if gte msEquation 12]> … <![endif]" → LaTeX.
 * Devuelve null si no es una ecuación.
 */
export function wordEquationToTex(comment: string): { tex: string; display: boolean } | null {
  if (!/^\s*\[if gte msEquation/i.test(comment)) return null;
  const body = comment.replace(/^\s*\[if[^\]]*\]>/i, '').replace(/<!\[endif\]\s*$/i, '');
  // El lector HTML no entiende "<m:deg/>" (se tragaría lo que sigue): se cierran a mano
  const xmlish = body.replace(/<([a-zA-Z]+:[a-zA-Z]+)([^<>]*?)\/>/g, '<$1$2></$1>');
  const doc = new DOMParser().parseFromString(`<body>${xmlish}</body>`, 'text/html');
  const all = Array.from(doc.body.getElementsByTagName('*'));
  const para = all.find((e) => ln(e) === 'omathpara');
  // Solo las ecuaciones de primer nivel (no las anidadas)
  const maths = all.filter((e) => ln(e) === 'omath' && !all.some((o) => o !== e && ln(o) === 'omath' && o.contains(e)));
  if (!maths.length) return null;
  const tex = tidy(maths.map((m) => omml(m)).join(' \\\\ '));
  if (!tex) return null;
  return { tex: maths.length > 1 ? `\\begin{gathered}${tex}\\end{gathered}` : tex, display: !!para };
}

/* =====================================================================
   MathML
   ===================================================================== */

function mml(el: Element): string {
  const n = (el.localName || el.tagName).toLowerCase().replace(/^m:/, '');
  const c = Array.from(el.children);
  const k = (i: number) => (c[i] ? mml(c[i]) : '');
  switch (n) {
    case 'math': case 'mrow': case 'mstyle': case 'mpadded': case 'mphantom': case 'merror': case 'semantics':
      if (n === 'semantics') {
        const ann = c.find((x) => x.localName === 'annotation' && /tex/i.test(x.getAttribute('encoding') || ''));
        if (ann) return ann.textContent || '';
        return c[0] ? mml(c[0]) : '';
      }
      return c.map(mml).join('');
    case 'annotation': case 'annotation-xml': return '';
    case 'mi': {
      const t = el.textContent || '';
      if (FUNCS.has(t)) return `\\${t} `;
      return t.length > 1 ? `\\mathrm{${t}}` : symbolsToTex(t);
    }
    case 'mn': return el.textContent || '';
    case 'mo': {
      const t = (el.textContent || '').trim();
      if (t === '{') return '\\{';
      if (t === '}') return '\\}';
      return symbolsToTex(t);
    }
    case 'mtext': return (el.textContent || '').trim() ? `\\text{${el.textContent}}` : '\\ ';
    case 'mspace': return '\\ ';
    case 'mfrac': return el.getAttribute('linethickness') === '0' ? `\\binom{${k(0)}}{${k(1)}}` : `\\frac{${k(0)}}{${k(1)}}`;
    case 'msqrt': return `\\sqrt{${c.map(mml).join('')}}`;
    case 'mroot': return `\\sqrt[${k(1)}]{${k(0)}}`;
    case 'msup': return `${grp(k(0))}^${grp(k(1))}`;
    case 'msub': return `${grp(k(0))}_${grp(k(1))}`;
    case 'msubsup': return `${grp(k(0))}_${grp(k(1))}^${grp(k(2))}`;
    case 'munder': return `${grp(k(0))}_${grp(k(1))}`;
    case 'mover': {
      const acc = (c[1]?.textContent || '').trim();
      if (ACC[acc]) return `${ACC[acc]}{${k(0)}}`;
      return `${grp(k(0))}^${grp(k(1))}`;
    }
    case 'munderover': return `${grp(k(0))}_${grp(k(1))}^${grp(k(2))}`;
    case 'mfenced': {
      const open = el.getAttribute('open') ?? '(', close = el.getAttribute('close') ?? ')';
      return `\\left${DELIM[open] ?? open}${c.map(mml).join(',')}\\right${DELIM[close] ?? close}`;
    }
    case 'mtable': return `\\begin{matrix}${c.map(mml).join(' \\\\ ')}\\end{matrix}`;
    case 'mtr': case 'mlabeledtr': return c.map(mml).join(' & ');
    case 'mtd': return c.map(mml).join('');
  }
  return c.length ? c.map(mml).join('') : symbolsToTex(el.textContent || '');
}

/** <math> → LaTeX (usa la anotación LaTeX si la trae). */
export function mathmlToTex(math: Element): { tex: string; display: boolean } | null {
  const ann = Array.from(math.getElementsByTagName('annotation')).find((a) => /tex/i.test(a.getAttribute('encoding') || ''));
  const tex = tidy(ann?.textContent || mml(math));
  if (!tex) return null;
  return { tex, display: math.getAttribute('display') === 'block' };
}
