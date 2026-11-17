import React, { useEffect, useState } from 'react';
import './math.css';

/**
 * Texto con ecuaciones, en la notación que usan los LLM (ChatGPT, Claude…):
 *
 *   en línea:   $E = mc^2$     \( \sigma = F/A \)
 *   centrada:   $$ M = \frac{q L^2}{8} $$     \[ \tau = \frac{V Q}{I b} \]
 *   un $ suelto: \$
 *
 * Para no confundir precios con fórmulas, el $ en línea sigue la regla de
 * Pandoc: el de apertura va pegado al contenido, el de cierre no tiene un
 * espacio antes ni un número después. "Cuesta $500 y $300" queda como texto.
 *
 * KaTeX se carga solo si el texto tiene alguna ecuación. Genera texto real con
 * sus propias fuentes: se imprime nítido (vectorial) y se puede buscar en el PDF.
 */

export type MathSeg =
  | { kind: 'text'; text: string }
  | { kind: 'math'; tex: string; display: boolean; raw: string };

const MATH_RE =
  /\\\$|\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$(?=[^\s$])([^\n$]*?[^\s\\$])\$(?!\d)/g;

export function splitMath(src: string): MathSeg[] {
  const out: MathSeg[] = [];
  let last = 0;
  const pushText = (t: string) => {
    if (!t) return;
    const prev = out[out.length - 1];
    if (prev && prev.kind === 'text') prev.text += t; else out.push({ kind: 'text', text: t });
  };
  for (const m of src.matchAll(MATH_RE)) {
    const i = m.index ?? 0;
    pushText(src.slice(last, i));
    last = i + m[0].length;
    if (m[0] === '\\$') { pushText('$'); continue; }
    const display = m[1] !== undefined || m[2] !== undefined;
    const tex = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').trim();
    if (!tex) { pushText(m[0]); continue; }
    out.push({ kind: 'math', tex, display, raw: m[0] });
  }
  pushText(src.slice(last));
  // Una ecuación centrada ya ocupa su renglón: se quita el salto pegado a ella
  // para no dejar renglones vacíos de más.
  out.forEach((s, k) => {
    if (s.kind !== 'math' || !s.display) return;
    const prev = out[k - 1], next = out[k + 1];
    if (prev?.kind === 'text') prev.text = prev.text.replace(/\n[ \t]*$/, '');
    if (next?.kind === 'text') next.text = next.text.replace(/^[ \t]*\n/, '');
  });
  return out;
}

export const hasMath = (src: string) => splitMath(src || '').some((s) => s.kind === 'math');

/* ---------- Carga diferida de KaTeX ---------- */

type Katex = { renderToString: (tex: string, opts: Record<string, unknown>) => string };
let katexPromise: Promise<Katex> | null = null;
let katexLoaded: Katex | null = null;

/** KaTeX ya cargado (o null). Permite dibujar fórmulas sin esperar, p. ej. en el editor. */
export const katexReady = () => katexLoaded;

export function loadKatex(): Promise<Katex> {
  if (!katexPromise) {
    katexPromise = Promise.all([
      import('katex'),
      import('katex/dist/katex.min.css'),
    ])
      .then(([mod]) => (katexLoaded = (mod as { default?: Katex }).default ?? (mod as unknown as Katex)))
      .catch((err) => { katexPromise = null; throw err; });
  }
  return katexPromise;
}

function useKatex(needed: boolean): Katex | null {
  const [k, setK] = useState<Katex | null>(katexLoaded);
  useEffect(() => {
    if (!needed || k) return;
    let off = false;
    loadKatex().then((m) => { if (!off) setK(m); }).catch((e) => console.warn('[Ecuaciones] No se pudo cargar KaTeX', e));
    return () => { off = true; };
  }, [needed, k]);
  return k;
}

/* ---------- Una fórmula suelta (la usa también RichText) ---------- */

export const MathFormula: React.FC<{ tex: string; display: boolean; raw: string }> = ({ tex, display, raw }) => {
  const katex = useKatex(true);
  return renderFormula(katex, { kind: 'math', tex, display, raw }, 0);
};

function renderFormula(katex: Katex | null, s: Extract<MathSeg, { kind: 'math' }>, key: number) {
  // Mientras carga KaTeX se ve la fórmula tal como se escribió
  // data-md-raw: el editor visual la trata como una pieza y devuelve el texto original
  if (!katex) return <span key={key} className="rp-math-src" data-md-raw={s.raw} contentEditable={false}>{s.raw}</span>;
  try {
    const html = katex.renderToString(s.tex, {
      displayMode: s.display,
      throwOnError: true,
      output: 'html',
      strict: 'ignore',
    });
    return (
      <span
        key={key}
        className={`rp-math ${s.display ? 'rp-math-display' : 'rp-math-inline'}`}
        data-md-raw={s.raw}
        contentEditable={false}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch (err) {
    // Fórmula mal escrita: se muestra el texto original marcado, con el error al pasar el mouse
    return (
      <span key={key} className="rp-math-error" data-md-raw={s.raw} contentEditable={false} title={String((err as Error)?.message || err)}>{s.raw}</span>
    );
  }
}

/* ---------- Componente ---------- */

export const MathText: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const segs = splitMath(text || '');
  const needed = segs.some((s) => s.kind === 'math');
  const katex = useKatex(needed);

  if (!needed) return <span className={className}>{text}</span>;

  return (
    <span className={className}>
      {segs.map((s, i) =>
        s.kind === 'text' ? <React.Fragment key={i}>{s.text}</React.Fragment> : renderFormula(katex, s, i),
      )}
    </span>
  );
};
