/* =====================================================================
   Avanzado: reglas CSS propias del tema.
   - Se aplican SOLO dentro de la hoja: se envuelven en @scope (.a4-sheet).
   - :root y :scope significan "la hoja" (ahí se pueden redefinir variables).
   - @import y @font-face se sacan afuera (no pueden ir dentro de @scope),
     así se puede traer una fuente propia por URL.
   ===================================================================== */

export interface Hint { label: string; detail: string; insert?: string }

/** Variables del tema que se pueden usar con var(--…) o redefinir en :scope { }. */
export const KNOWN_VARS: Hint[] = [
  ['--rp-primary', 'Color principal'],
  ['--rp-obs-info', 'Observaciones: aviso de información'],
  ['--rp-obs-warn', 'Observaciones: aviso de advertencia'],
  ['--rp-obs-critical', 'Observaciones: aviso importante'],
  ['--rp-obs-ok', 'Observaciones: aviso de conforme'],
  ['--rp-primary-dark', 'Principal oscuro (degradés)'],
  ['--rp-primary-soft', 'Principal suave (fondos)'],
  ['--rp-label', 'Etiquetas'],
  ['--rp-accent', 'Acento (título del encabezado)'],
  ['--rp-title-text', 'Texto de barras de título'],
  ['--rp-title-border', 'Borde de barras de título'],
  ['--rp-title-bg', 'Fondo de barras de título (degradé)'],
  ['--rp-ind-1', 'Indicador 1 · plazo'],
  ['--rp-ind-2', 'Indicador 2 · financiero'],
  ['--rp-ind-3', 'Indicador 3 · físico'],
  ['--rp-real', 'Avance real (curva S)'],
  ['--rp-bar-main', 'Barra de tarea principal'],
  ['--rp-bar-sub', 'Barra de subtarea'],
  ['--rp-th-bg', 'Fondo de cabecera de tablas'],
  ['--rp-th-text', 'Texto de cabecera de tablas'],
  ['--rp-border', 'Bordes de tablas y recuadros'],
  ['--rp-surface-1', 'Fondo muy suave'],
  ['--rp-surface-2', 'Fondo suave'],
  ['--rp-line', 'Líneas y separadores'],
  ['--rp-highlight-bg', 'Fondo del recuadro destacado'],
  ['--rp-highlight-border', 'Borde del recuadro destacado'],
  ['--rp-text', 'Texto general'],
  ['--rp-text-size', 'Tamaño de letra del módulo de Texto (por defecto 10pt; cada bloque puede elegir el suyo)'],
  ['--rp-font-body', 'Fuente del texto'],
  ['--rp-font-title', 'Fuente de títulos'],
  ['--rp-font-num', 'Fuente de números'],
  ['--rp-radius', 'Redondeo de esquinas'],
  ['--rp-radius-sm', 'Redondeo chico (−2 px)'],
  ['--rp-radius-lg', 'Redondeo grande (+2 px)'],
].map(([label, detail]) => ({ label, detail }));
const KNOWN_SET = new Set(KNOWN_VARS.map((v) => v.label).concat(['--rp-radius-in', '--rp-radius-xs']));

/** Elementos del informe con nombre estable. */
export const RP_SELECTORS: Hint[] = [
  [':scope', 'La hoja entera (variables, fuente base, fondo)'],
  ['.rp-block', 'Cada módulo (todos)'],
  ['.rp-block-situation', 'Módulo Situación actual'],
  ['.rp-block-pending', 'Módulo Pendencias'],
  ['.rp-block-photos', 'Módulo Fotos'],
  ['.rp-block-map', 'Módulo Mapa'],
  ['.rp-row', 'Fila de módulos en columnas'],
  ['.rp-col', 'Cada módulo dentro de una fila'],
  ['.rp-block-specs', 'Módulo Especificaciones'],
  ['.rp-block-scurve', 'Módulo Curva S'],
  ['.rp-block-weather', 'Módulo Clima'],
  ['.rp-block-contract_metrics', 'Módulo Contrato e indicadores'],
  ['.rp-block-text', 'Módulo Texto libre'],
  ['.rp-block-observations', 'Módulo Observaciones'],
  ['.rp-block-signatures', 'Módulo Firmas'],
  ['.rp-block-document', 'Módulo Documentos y planos'],
  ['.rp-title-wrap', 'Contenedor de la barra de título (márgenes)'],
  ['.rp-title', 'Barra de título de sección'],
  ['.rp-title-row', 'Fila interna del título (alineación)'],
  ['.rp-title-num', 'Número de la sección (1., 2.…)'],
  ['.rp-title-text', 'Texto del título'],
  ['.rp-header', 'Encabezado de la primera hoja'],
  ['.rp-header-logo', 'Logo del encabezado'],
  ['.rp-header-titles', 'Bloque de textos del encabezado'],
  ['.rp-header-director', 'Línea de la dirección'],
  ['.rp-header-project', 'Nombre de la obra'],
  ['.rp-header-report', 'Título del informe (color acento)'],
  ['.rp-header-date', 'Fecha de toma de datos'],
  ['.rp-header-line', 'Renglón del encabezado (+ --xl, --accent, --md, --sm, --xs)'],
  ['.rp-header-meta', 'Bloque de datos del encabezado (Empresa / ISO)'],
  ['.rp-header--iso', 'Encabezado con diseño ISO (tabla)'],
  ['.rp-header-mini', 'Encabezado de las hojas siguientes'],
  ['.rp-cover', 'Portada (+ --classic, --photo, --minimal)'],
  ['.rp-cover-title', 'Título de la portada'],
  ['.rp-toc', 'Índice (lista ol)'],
  ['.rp-html', 'Contenido del módulo HTML / SVG'],
  ['.rp-toc-row', 'Renglón del índice (+ --main / --sub)'],
  ['.rp-footer', 'Pie de página'],
  ['.rp-footer-left', 'Texto izquierdo del pie'],
  ['.rp-footer-page', '“Página N de M”'],
  ['.rp-table', 'Contenedor de cada tabla'],
  ['.rp-table th', 'Cabecera de tabla'],
  ['.rp-table td', 'Celdas de tabla'],
  ['.rp-table tbody tr:nth-child(even) td', 'Filas pares (cebra)'],
  ['.nt-pill', 'Fichas (impacto, estado…)'],
  ['.nt-pill.status', 'Fichas de estado'],
  ['.rp-card', 'Tarjetas y recuadros'],
  ['.rp-photo', 'Tarjeta de foto'],
  ['.rp-photo img', 'La foto'],
  ['.rp-caption', 'Pie de foto'],
  ['.rp-notes', 'Recuadro de observaciones (estilo Nota)'],
  ['.rp-obs', 'Observaciones, cualquier estilo'],
  ['.rp-obs--quote', 'Observaciones estilo Cita'],
  ['.rp-obs--code', 'Observaciones estilo Código'],
  ['.rp-obs--list', 'Observaciones estilo Lista'],
  ['.rp-obs--callout', 'Observaciones estilo aviso (los cuatro)'],
  ['.rp-obs--warning', 'Aviso de advertencia (también --info, --critical, --success)'],
  ['.rp-obs-label', 'Rótulo de las observaciones'],
  ['.rp-math', 'Ecuaciones (módulos de Texto y Observaciones)'],
  ['.rp-md', 'Texto con formato Markdown (Texto y Observaciones)'],
  ['.rp-md-h1', 'Texto: título #'],
  ['.rp-md-h2', 'Texto: subtítulo ##'],
  ['.rp-md-h3', 'Texto: apartado ###'],
  ['.rp-md-table', 'Texto: tabla Markdown'],
  ['.rp-md-quote', 'Texto: cita >'],
  ['.rp-md-mark', 'Texto: resaltado =='],
  ['.rp-md-code', 'Texto: código en el renglón'],
  ['.rp-label', 'Etiquetas en mayúsculas'],
  ['.rp-value', 'Valores de los campos del contrato'],
  ['.rp-highlight', 'Recuadro destacado'],
  ['.font-mono', 'Números y códigos'],
  ['.rp-track', 'Rieles y fondos de todos los gráficos y barras (métricas, curva S, rubros, anillos, Gantt)'],
  ['.rp-bar-fill', 'Relleno de avance y color de todas las barras (métricas, curva S, rubros, anillos, Gantt)'],
  ['.rp-ring-track', 'Riel de los anillos circulares (contrato y curva S)'],
  ['.rp-ring-fill', 'Arco de avance de los anillos circulares (contrato y curva S)'],
  ['.rp-ring-highlight', 'Reflejo de vidrio 3D de los anillos circulares'],
].map(([label, detail]) => ({ label, detail }));

export const CSS_PROPS = [
  'background', 'background-color', 'border', 'border-color', 'border-width', 'border-style', 'border-radius',
  'border-top', 'border-bottom', 'border-left', 'border-right', 'box-shadow', 'color', 'font-family', 'font-size',
  'font-weight', 'font-style', 'letter-spacing', 'line-height', 'text-transform', 'text-align', 'text-decoration',
  'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right', 'margin', 'margin-top', 'margin-bottom',
  'opacity', 'outline', 'width', 'height', 'min-height', 'gap', 'display', 'font-variant-numeric', 'white-space',
].map((p) => ({ label: p, detail: 'propiedad', insert: `${p}: ` }));

/** Reglas de referencia: el código que hoy dicta el aspecto de cada elemento. */
/** Ideas listas para probar (muestran hasta dónde se puede llegar). */
export const IDEAS: { label: string; css: string }[] = [
  {
    label: 'Títulos a la izquierda, subrayados',
    css: `/* Idea: títulos alineados a la izquierda, sin caja y con subrayado grueso */
:scope .rp-title {
  background: none;
  border: 0;
  border-bottom: 2.5px solid var(--rp-primary);
  border-radius: 0;
  box-shadow: none;
  padding: 2px 0 3px;
}
:scope .rp-title-inner,
:scope .rp-title-row { text-align: left; justify-content: flex-start; }
:scope .rp-title-text { color: var(--rp-primary); letter-spacing: 0.08em; }`,
  },
  {
    label: 'Títulos con degradé',
    css: `/* Idea: barra con degradé del color principal y texto blanco */
:scope .rp-title {
  background: linear-gradient(90deg, var(--rp-primary), var(--rp-ind-1) 70%, var(--rp-primary-soft));
  border: 0;
  color: #ffffff;
}
:scope .rp-title-num { color: var(--rp-accent); }
:scope .rp-title-row { justify-content: flex-start; }`,
  },
  {
    label: 'Títulos con patrón rayado',
    css: `/* Idea: fondo de rayas diagonales suaves + franja de color a la izquierda */
:scope .rp-title {
  background:
    repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in srgb, var(--rp-primary) 7%, transparent) 6px 12px),
    var(--rp-surface-1);
  border: 1px solid var(--rp-line);
  border-left: 6px solid var(--rp-primary);
  border-radius: 4px;
}
:scope .rp-title-row { justify-content: flex-start; }`,
  },
  {
    label: 'Títulos tipo cinta',
    css: `/* Idea: número en un círculo y cinta del color principal */
:scope .rp-title {
  background: var(--rp-primary);
  color: #ffffff;
  border: 0;
  border-radius: 999px;
}
:scope .rp-title-num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 1.7em; height: 1.7em; border-radius: 50%;
  background: var(--rp-accent); color: var(--rp-primary);
}`,
  },
  {
    label: 'Tablas en cebra',
    css: `/* Idea: filas pares con fondo suave */
:scope .rp-table tbody tr:nth-child(even) td { background: var(--rp-surface-1); }`,
  },
  {
    label: 'Gráficos y barras de vidrio uniforme (Métricas, Rubros, Anillos y Gantt)',
    css: `/* Idea: estilo de vidrio y riel claro idéntico en absolutamente todos los gráficos */
:scope .rp-track,
:scope .rp-ring-track,
:scope .cmb-bar,
:scope .scb-kp-track,
:scope .scb-kpi-bar {
  background: #E2E8F0 !important;
  stroke: #E2E8F0 !important;
  --rp-track-bg: #E2E8F0 !important;
  border-color: transparent !important;
}

:scope .rp-bar-fill {
  background-image: linear-gradient(180deg,
    rgba(255, 255, 255, .42) 0%,
    rgba(255, 255, 255, .10) 34%,
    rgba(255, 255, 255, 0)   50%,
    rgba(0, 0, 0, .12)      100%) !important;
}

/* Activa el reflejo 3D también en los anillos SVG */
:scope { --rp-gloss-opacity: 1; }`,
  },
];

export const SNIPPETS: { label: string; css: string }[] = [
  {
    label: 'Títulos de sección',
    css: `/* Barra de título de sección */
:scope .rp-title {
  font-family: var(--rp-font-title);
  font-size: 9pt;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--rp-title-text);
  background: var(--rp-title-bg);
  border: 1px solid var(--rp-title-border);
  border-radius: var(--rp-radius-sm);
}
/* Número de la sección */
:scope .rp-title-num {
  color: var(--rp-primary);
  font-family: var(--rp-font-num);
  font-weight: 900;
}`,
  },
  {
    label: 'Encabezado',
    css: `/* Encabezado (primera hoja y hojas siguientes) */
:scope .rp-header,
:scope .rp-header-mini {
  background: var(--rp-primary);
  color: #ffffff;
}`,
  },
  {
    label: 'Tablas',
    css: `/* Contenedor de tabla */
:scope .rp-table {
  border: 1px solid var(--rp-border);
  border-radius: var(--rp-radius);
}
/* Cabecera */
:scope .rp-table th {
  background: var(--rp-th-bg);
  color: var(--rp-th-text);
  font-size: 6.5pt;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
/* Celdas */
:scope .rp-table td {
  font-size: 7.5pt;
  border-color: var(--rp-line);
}`,
  },
  {
    label: 'Fichas',
    css: `/* Fichas (impacto, estado, trabajo…) */
:scope .nt-pill {
  font-size: 6.5pt;
  font-weight: 900;
  border-radius: 999px;
}
:scope .nt-pill.status {
  font-weight: 600;
  border-radius: 4px;
}`,
  },
  {
    label: 'Tarjetas y fotos',
    css: `/* Tarjetas y recuadros */
:scope .rp-card {
  border: 1px solid var(--rp-line);
  background: #ffffff;
  /* border-radius: var(--rp-radius); */
}
/* Pie de foto */
:scope .rp-caption {
  background: var(--rp-surface-1);
  font-size: 7.5pt;
  color: var(--rp-text);
}`,
  },
  {
    label: 'Etiquetas',
    css: `/* Etiquetas en mayúsculas (contrato, clima…) */
:scope .rp-label {
  font-size: 6.5pt;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: #64748b;
}`,
  },
  {
    label: 'Fuentes',
    css: `/* Fuente y tamaño base de la hoja */
:scope {
  font-family: var(--rp-font-body);
}
/* Números y códigos */
:scope .font-mono,
:scope .rp-num {
  font-family: var(--rp-font-num);
  font-variant-numeric: tabular-nums;
}`,
  },
  {
    label: 'Variables',
    css: `/* Redefinir variables del tema solo con código */
:scope {
  --rp-primary: #0b455b;
  --rp-radius: 10px;
}`,
  },
  {
    label: 'Fuente propia (URL)',
    css: `/* Fuente propia desde un archivo publicado (woff2/ttf) */
@font-face {
  font-family: 'Mi Fuente';
  src: url('https://ejemplo.com/mi-fuente.woff2') format('woff2');
  font-weight: 400;
}
:scope {
  --rp-font-body: 'Mi Fuente', sans-serif;
}`,
  },
];

/* ---------- Armado del CSS final ---------- */

/* ---------- Lectura del CSS en sentencias de primer nivel ---------- */

export interface CssStatement {
  text: string;
  line: number;
  kind: 'import' | 'outside' | 'rule';
  /** Problema de sintaxis detectado al leer (comilla o llave sin cerrar…). */
  problem?: string;
}

/**
 * Corta el CSS en sentencias de primer nivel respetando comentarios, comillas y paréntesis
 * (así un ";" dentro de una URL de Google Fonts no corta nada).
 */
export function splitStatements(css: string): CssStatement[] {
  const out: CssStatement[] = [];
  let i = 0, line = 1;
  let start = -1, startLine = 1, depth = 0, paren = 0;
  let quote: string | null = null, quoteLine = 0;
  const push = (end: number, problem?: string) => {
    if (start < 0) return;
    const text = css.slice(start, end).trim();
    if (text) {
      const head = text.slice(0, 20).toLowerCase();
      const kind: CssStatement['kind'] = head.startsWith('@import') ? 'import'
        : /^@(font-face|keyframes|-webkit-keyframes|page|charset|layer|property)\b/.test(head) ? 'outside' : 'rule';
      out.push({ text, line: startLine, kind, problem });
    }
    start = -1; depth = 0; paren = 0;
  };
  while (i < css.length) {
    const c = css[i];
    if (c === '\n') line++;
    if (quote) {
      if (c === '\\') { i += 2; continue; }
      if (c === quote) quote = null;
      else if (c === '\n') { // comilla sin cerrar: el CSS la corta en el salto de línea
        push(i, `Comilla ${quote} sin cerrar en la línea ${quoteLine}.`);
        quote = null;
      }
      i++; continue;
    }
    if (c === '/' && css[i + 1] === '*') {
      const e = css.indexOf('*/', i + 2);
      const end = e < 0 ? css.length : e + 2;
      for (let k = i; k < end; k++) if (css[k] === '\n') line++;
      i = end; continue;
    }
    if (start < 0) {
      if (/\s/.test(c)) { i++; continue; }
      if (c === '}') { out.push({ text: '}', line, kind: 'rule', problem: `Sobra una llave “}” en la línea ${line}.` }); i++; continue; }
      start = i; startLine = line;
    }
    if (c === '"' || c === "'") { quote = c; quoteLine = line; i++; continue; }
    if (c === '(') paren++;
    else if (c === ')') paren = Math.max(0, paren - 1);
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth <= 0) { push(i + 1); i++; continue; } }
    else if (c === ';' && depth === 0 && paren === 0) { push(i + 1); i++; continue; }
    i++;
  }
  if (start >= 0) {
    const pending = depth > 0 ? `Falta cerrar ${depth === 1 ? 'una llave' : `${depth} llaves`} “}” (regla de la línea ${startLine}).` : undefined;
    push(css.length, quote ? `Comilla ${quote} sin cerrar en la línea ${quoteLine}.` : pending);
  }
  return out;
}

const wrapRule = (text: string) => `@scope (.a4-sheet) {\n${text.replace(/:root\b/g, ':scope')}\n}`;

/**
 * Arma el CSS final de las reglas propias:
 * - head: @import (deben ir al principio de todo).
 * - body: @font-face/@keyframes afuera y cada regla en su propio @scope (.a4-sheet),
 *   para que una regla rota no anule a las demás.
 */
export function scopeCustomCss(css: string): { head: string; body: string } {
  const src = (css || '').trim();
  if (!src) return { head: '', body: '' };
  const head: string[] = [];
  const body: string[] = [];
  for (const st of splitStatements(src)) {
    if (st.problem && st.text === '}') continue;
    // @page no va: la hoja (papel, orientación, márgenes) la maneja el programa (ver utils/pageSetup)
    if (/^@page\b/i.test(st.text.trim())) continue;
    if (st.kind === 'import') head.push(st.text.endsWith(';') ? st.text : `${st.text};`);
    else if (st.kind === 'outside') body.push(st.text);
    else body.push(wrapRule(st.text));
  }
  return { head: head.join('\n'), body: body.join('\n') };
}

/* ---------- Validación ---------- */

export interface CssCheck { ok: boolean; errors: string[]; warnings: string[]; rules: number }

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?(\*\/|$)/g, (m) => m.replace(/[^\n]/g, ' '));

export function checkCss(css: string, extraVars: string[] = []): CssCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const raw = css || '';
  if (/\/\*(?![\s\S]*?\*\/)/.test(raw)) errors.push('Hay un comentario /* sin cerrar */.');
  const stmts = splitStatements(raw);
  stmts.forEach((st) => { if (st.problem) errors.push(st.problem); });

  // Variables desconocidas
  const code = stripComments(raw);
  const unknown = new Set<string>();
  for (const m of code.matchAll(/var\(\s*(--rp-[\w-]+)/g)) if (!KNOWN_SET.has(m[1]) && !extraVars.includes(m[1])) unknown.add(m[1]);
  if (unknown.size) warnings.push(`Variable${unknown.size > 1 ? 's' : ''} del tema que no existe${unknown.size > 1 ? 'n' : ''}: ${[...unknown].join(', ')}.`);

  // filter (drop-shadow, blur…): Chrome imprime como imagen todo lo que lo lleva,
  // texto incluido. Verificado imprimiendo a PDF; backdrop-filter, mask y
  // mix-blend-mode NO lo hacen.
  if (/(?:^|[;{\s])filter\s*:/.test(code)) {
    warnings.push('filter: al imprimir o guardar en PDF, el elemento y todo lo que tiene adentro sale como imagen (el texto y las líneas pierden nitidez). Para sombras usá box-shadow; para brillos y vidrio usá degradés en .rp-bar-fill.');
  }
  if (/@page\b/i.test(code)) {
    warnings.push('@page no se usa desde acá: el papel, la orientación y los márgenes se eligen en Ajustes → Hoja. (Si pegás la respuesta de una IA con “Pegar respuesta”, su @page se aplica a la hoja sola.)');
  }
  if (/background-attachment\s*:\s*fixed/.test(code)) {
    warnings.push('background-attachment: fixed no sirve en la hoja (está escalada en pantalla y no aporta nada al imprimir); obliga a redibujar el fondo al desplazar.');
  }

  // @import mal escritos
  stmts.filter((s) => s.kind === 'import').forEach((s) => {
    if (!/^@import\s+(url\(\s*(['"]).+?\2\s*\)|url\([^)'"]+\)|(['"]).+?\3)/i.test(s.text)) errors.push(`El @import de la línea ${s.line} está mal escrito.`);
  });

  // Cada regla, por separado: ¿la entiende el navegador?
  let rules = 0;
  let canCheck = true;
  for (const st of stmts) {
    if (st.kind !== 'rule' || st.problem) continue;
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(wrapRule(st.text));
      const scope = sheet.cssRules[0] as CSSGroupingRule | undefined;
      if (scope && scope.cssRules && scope.cssRules.length > 0) rules++;
      else {
        const sel = st.text.slice(0, st.text.indexOf('{') >= 0 ? st.text.indexOf('{') : 40).trim().replace(/\s+/g, ' ').slice(0, 50);
        errors.push(`La regla de la línea ${st.line} (“${sel}”) no se entiende y se ignora.`);
      }
    } catch {
      canCheck = false;
      break;
    }
  }
  if (!canCheck) rules = stmts.filter((s) => s.kind === 'rule').length;
  if (typeof CSS !== 'undefined' && CSS.supports && !CSS.supports('selector(:scope)')) {
    warnings.push('Este navegador es antiguo y puede no aplicar las reglas: usá Chrome o Edge actualizados.');
  }
  return { ok: errors.length === 0, errors, warnings, rules };
}

/* ---------- Guía para pedirle el tema a una IA ---------- */

/** Saca el CSS de la respuesta de una IA (bloques ```css … ```), o devuelve el texto tal cual. */
export function extractCss(answer: string): string {
  const blocks = [...answer.matchAll(/```(?:css)?\s*\n([\s\S]*?)```/gi)].map((m) => m[1].trim());
  return (blocks.length ? blocks.join('\n\n') : answer).trim();
}

export function buildAiGuide(opts: { varsCss: string; customCss: string; themeName: string; images?: { varName: string; kind: string; size: string }[]; page?: { label: string; css: string } }): string {
  const sel = RP_SELECTORS.map((h) => `| \`${h.label}\` | ${h.detail} |`).join('\n');
  const vars = KNOWN_VARS.map((h) => `| \`${h.label}\` | ${h.detail} |`).join('\n');
  return `# Guía para diseñar un tema del informe de obra

Sos un diseñador web experto en CSS. Necesito que escribas el CSS de un **tema visual** para un generador de informes semanales de obra en hojas que se imprimen o se guardan en PDF. La hoja actual es **${opts.page?.label ?? 'A4 vertical (210 × 297 mm)'}**; el papel, la orientación y los márgenes se pueden cambiar (ver *Hoja: papel, orientación y márgenes*).

## Lo que quiero
> ✏️ **Describí acá cómo querés que se vea** (estilo, colores, sensación, ejemplos):
>
> _…_

## Cómo se aplica tu CSS
- Todo lo que escribas se envuelve automáticamente en \`@scope (.a4-sheet) { … }\`: **solo afecta a la hoja del informe**, nunca a la interfaz del editor.
- \`:scope\` (o \`:root\`) es la hoja entera. Ahí podés redefinir variables: \`:scope { --rp-primary: #123456; }\`.
- Empezá los selectores con \`:scope\` para ganar especificidad, por ejemplo \`:scope .rp-title { … }\`.
- Los módulos usan clases de Tailwind (pierden siempre contra tus reglas) y algunos estilos propios (empatan: gana el tuyo). Algunos detalles tienen estilo en línea: ahí hace falta \`!important\`.
- \`@import\` (Google Fonts) y \`@font-face\` están permitidos: se sacan fuera del \`@scope\` automáticamente.
- Podés usar CSS moderno: \`color-mix()\`, \`linear-gradient\`, \`repeating-linear-gradient\`, \`::before/::after\`, \`:nth-child\`, anidamiento con \`&\`.

## Reglas que hay que respetar
1. **Hoja impresa**: nada de animaciones, sombras exageradas ni elementos fijos (\`position: fixed\`). Usá unidades \`pt\`/\`px\`/\`mm\`.
2. **No ocultes contenido** (\`display: none\`, \`visibility: hidden\`) ni cambies el orden de los elementos.
3. **Alturas**: la paginación mide sola el alto de cada módulo, así que podés cambiar márgenes y rellenos, pero evitá aumentos grandes (más de ~4 mm por título): hacen que los módulos salten de hoja.
4. **Contraste**: el texto tiene que leerse bien impreso, también en blanco y negro.
5. Usá las **variables del tema** (\`var(--rp-…)\`) para los colores siempre que se pueda: así el usuario puede seguir ajustándolos desde el panel.
6. **No toques** clases que empiezan con \`nt-row\`, \`nt-edge\`, \`nt-chk\`, \`nt-menu\`, \`dock-\`, \`edit-\`, \`ui-\` ni \`no-print\`: son herramientas del editor.
7. **Nada de \`filter\`** (\`drop-shadow\`, \`blur\`…) en la hoja. Al imprimir o guardar en PDF, Chrome convierte en imagen el elemento y todo lo que tiene adentro: el texto y las líneas pierden nitidez. Para sombras usá \`box-shadow\` (solo la sombra sale como imagen; el contenido queda nítido). Para vidrio o brillo, \`linear-gradient\`/\`radial-gradient\`, bordes translúcidos y las clases unificadas \`.rp-track\` y \`.rp-bar-fill\`.
8. **\`backdrop-filter\` no aporta**: la hoja es casi blanca y no hay nada detrás que desenfocar, así que no se ve; solo cuesta rendimiento en pantalla. Tampoco uses \`background-attachment: fixed\`.

## Hoja: papel, orientación y márgenes
Si en *Lo que quiero* pido otro papel, la hoja horizontal o ciertos márgenes, **escribilo con una regla \`@page\`** (la forma estándar). Al pegar tu respuesta, el programa la lee, cambia la hoja y la saca del CSS del tema. Si no pido nada de esto, **no escribas \`@page\`**.

Hoja actual:
\`\`\`css
${opts.page?.css ?? '@page { size: A4 portrait; margin: 0; }'}
\`\`\`

- \`size\`: \`A4\`, \`A3\`, \`letter\` (Carta, 215,9 × 279,4 mm), \`legal\` (Oficio, 215,9 × 355,6 mm) o medidas propias (\`size: 200mm 280mm\`, entre 100 y 600 mm), más \`portrait\` (vertical) o \`landscape\` (horizontal). Ejemplo: \`size: A4 landscape;\`.
- \`margin\`: de 0 a 30 mm, como en CSS (1 a 4 valores: arriba, derecha, abajo, izquierda), o \`margin-top\`, \`margin-left\`… Ejemplo: \`margin: 12mm 10mm;\`.
- Los márgenes son un **borde blanco alrededor de todo**, incluidos el encabezado y el pie. Con \`margin: 0\` el encabezado y el pie llegan al borde del papel. Si querés un fondo de color que llegue hasta el borde, dejá el margen en 0 y separá el contenido con \`padding\` en los módulos.
- No uses otras propiedades dentro de \`@page\` (contadores, cajas de margen, \`@top-center\`…): se ignoran.
- El ancho útil cambia con la hoja: los módulos se adaptan solos. No fijes anchos en mm para la hoja, el encabezado ni los módulos; usá porcentajes o dejá que fluyan.

## Errores típicos (evitalos)
- **No fuerces \`font-weight\` en \`.rp-table td\`**: les quita la negrita a las filas de grupo (1.0, 2.0…), que la ponen los módulos con su propia clase, y la tabla pierde jerarquía. Ajustá tamaño, color y relleno, pero dejá el peso.
- **No le pongas tamaño ni negrita a \`.font-mono\` en general**: se usa también para los códigos de rubro (1.0, 1.1) y los agranda por encima de la descripción. Si cambiás la familia, sumá \`font-variant-numeric: tabular-nums\` para que los números de una columna sigan alineados. Para destacar cifras, apuntá a un módulo: \`:scope .rp-block-scurve .font-mono\`.
- **Los textos de un SVG se miden en unidades del dibujo, no en pt.** Un \`font-size: 10.5pt\` dentro de un gráfico se vuelve enorme y se corta. Ver *Gráficos*.
- **Si agrandás textos o rellenos de tablas, compensá**: un 30 % más de alto en una tabla empuja todo lo que sigue a la hoja siguiente.

## Elementos del informe con nombre estable
| Selector | Qué es |
|---|---|
${sel}

Estructura de una barra de título:
\`\`\`html
<div class="rp-title-wrap">            <!-- margen inferior -->
  <div class="rp-title">               <!-- la barra: fondo, borde, radio, texto en mayúsculas -->
    <div class="rp-title-inner">       <!-- centra el contenido (text-align) -->
      <div class="rp-title-row">       <!-- flex: justify-content: center -->
        <span class="rp-title-num">1.</span>
        <span class="rp-title-text">SITUACIÓN ACTUAL</span>
      </div>
    </div>
  </div>
</div>
\`\`\`

Estructura del encabezado (el usuario elige el diseño: \`.rp-header--institutional\`, \`.rp-header--company\` o \`.rp-header--iso\`; los renglones son libres, de 0 a 5):
\`\`\`html
<header class="rp-header rp-header--institutional">
  <div class="rp-header-logo is-left"><img></div>
  <div class="rp-header-titles">
    <!-- cada renglón: .rp-header-line + su nivel -->
    <div class="rp-header-line rp-header-line--sm rp-header-director">DIRECCIÓN TÉCNICA…</div>      <!-- chico, arriba -->
    <div class="rp-header-line rp-header-line--xl rp-header-project"><h1>NOMBRE DE LA OBRA</h1></div> <!-- título grande -->
    <div class="rp-header-line rp-header-line--accent rp-header-report">REPORTE SEMANAL</div>  <!-- destacado (acento) -->
    <div class="rp-header-line rp-header-line--md rp-header-line-md">Texto normal</div>
    <div class="rp-header-line rp-header-line--xs rp-header-date">Fecha…</div>               <!-- dato chico -->
  </div>
  <div class="rp-header-logo is-right"><img></div>                <!-- segundo logo (opcional) -->
  <div class="rp-header-meta">                                    <!-- solo Empresa e ISO -->
    <div class="rp-header-meta-row"><span class="rp-header-meta-label">Código</span><span class="rp-header-meta-value">PR-01</span></div>
  </div>
</header>
\`\`\`
- Institucional y Empresa: fondo \`--rp-primary\` y texto blanco. ISO: tabla de celdas sobre blanco con bordes \`--rp-border\`. Dale estilo a los tres o, si cambiás el fondo del encabezado, revisá que el diseño ISO siga leyéndose.
- No ocultes \`.rp-header-logo.is-right\` ni \`.rp-header-meta\`: aparecen solo si el usuario los usa.
- Hojas siguientes: \`.rp-header-mini\` con \`.rp-strip-left\`, \`.rp-strip-center\` y \`.rp-strip-right\` (textos que elige el usuario).

## Portada
Ocupa la primera hoja entera, sin encabezado ni pie. Diseños \`.rp-cover--classic\`, \`.rp-cover--photo\` y \`.rp-cover--minimal\` (+ \`.has-photo\` si tiene foto).
Partes: \`.rp-cover-band\` (solo clásica), \`.rp-cover-logos\` > \`img.rp-cover-logo\`, \`.rp-cover-photo\` (la foto va como \`background-image\` en línea: no la reemplaces), \`.rp-cover-body\` > \`.rp-cover-titles\` > \`.rp-cover-kicker\` / \`h1.rp-cover-title\` / \`.rp-cover-subtitle\`, \`.rp-cover-rule\` y \`.rp-cover-bar\` (adornos), \`.rp-cover-meta\` (grilla de \`.rp-cover-meta-label\` + \`.rp-cover-meta-value\`) y \`.rp-cover-note\`.
- Es el lugar ideal para que el tema luzca (fondos, degradés, formas con \`::before\`), pero tiene que entrar en una hoja: no agrandes mucho los márgenes.

## Índice
\`ol.rp-toc > li.rp-toc-row\` (\`--main\` secciones, \`--sub\` títulos de los textos) con \`.rp-toc-num\`, \`.rp-toc-title\`, \`.rp-toc-dots\` (la línea de puntos, un \`border-bottom\` que se estira) y \`.rp-toc-page\`.

## Módulo de Observaciones
Tiene ocho estilos de énfasis que elige el usuario. Todos llevan \`.rp-obs\` más \`.rp-obs--<estilo>\`:
| Estilo | Clases | Estructura |
|---|---|---|
| Nota (el clásico) | \`.rp-obs--note\` (+ \`.rp-card .rp-notes\`) | \`.rp-obs-label\` + \`.rp-obs-body\` |
| Cita | \`.rp-obs--quote\` | \`.rp-obs-mark\` (ícono de comillas) + \`blockquote.rp-obs-body\` + \`.rp-obs-attr\` (autor) |
| Código | \`.rp-obs--code\` | \`.rp-obs-codehead\` (puntos + \`.rp-obs-label\`) + \`ol.rp-obs-body > li > code\` (renglones numerados con \`::before\`) |
| Lista | \`.rp-obs--list\` | \`.rp-obs-label\` + \`ol.rp-obs-body > li\` (número en círculo con \`::before\`) |
| Información / Advertencia / Importante / Conforme | \`.rp-obs--callout\` + \`.rp-obs--info\` / \`--warning\` / \`--critical\` / \`--success\` | \`.rp-obs-icon\` + \`.rp-obs-content\` (\`.rp-obs-label\` + \`.rp-obs-body\`) |

- Los avisos toman su color de \`--obs-c\`, que sale de las variables del tema \`--rp-obs-info\`, \`--rp-obs-warn\`, \`--rp-obs-critical\` y \`--rp-obs-ok\`. Para cambiarles el color redefiní esas variables en \`:scope\`; no pises \`border-color\` ni \`background\` con colores fijos, o los cuatro avisos quedan iguales.
- Si le das a \`.rp-notes\` un fondo con \`!important\`, afecta solo al estilo Nota: los otros estilos no llevan esa clase a propósito.
- Ejemplo, avisos "de vidrio": \`:scope .rp-obs--callout { background: color-mix(in srgb, var(--obs-c) 6%, rgba(255,255,255,.7)) !important; border-radius: var(--rp-radius); }\`

## Ecuaciones
Los módulos de Texto y Observaciones dibujan fórmulas LaTeX con KaTeX (\`$…$\` en el renglón, \`$$…$$\` centradas). Quedan en \`.rp-math\` (\`.rp-math-inline\` o \`.rp-math-display\`) y adentro \`.katex\`.
- Podés cambiar el color (\`:scope .rp-math { color: var(--rp-primary); }\`) y el tamaño relativo (\`:scope .rp-math .katex { font-size: 1.05em; }\`).
- **No cambies la fuente de \`.katex\`** ni de nada de adentro: KaTeX arma cada símbolo con sus propias fuentes y medidas, y con otra familia las fracciones y raíces se desarman.

## Texto con formato (Markdown)
Los módulos de Texto y Observaciones entienden Markdown, el que escriben los LLM. Todo queda dentro de \`.rp-md\`:
| Elemento | Clase |
|---|---|
| Párrafo | \`.rp-md-p\` |
| Títulos \`#\` \`##\` \`###\` | \`.rp-md-h\` + \`.rp-md-h1\` / \`.rp-md-h2\` / \`.rp-md-h3\` |
| Negrita, cursiva, subrayado, tachado, resaltado | \`.rp-md-strong\`, \`.rp-md-em\`, \`.rp-md-u\`, \`.rp-md-s\`, \`.rp-md-mark\` |
| Código en el renglón / bloque | \`.rp-md-code\` / \`.rp-md-pre\` |
| Listas | \`ul.rp-md-ul\`, \`ol.rp-md-ol\` (viñeta con \`li::marker\`); tareas \`li.rp-md-task\` (+ \`.is-done\`) con \`.rp-md-check\` |
| Cita \`>\` | \`.rp-md-quote\` |
| Tabla | \`.rp-md-table-wrap.nt-wrap.rp-table > table.rp-md-table.nt-tbl\` — **la misma estética que las tablas de los demás módulos**: lo que el tema le haga a \`.rp-table\` / \`.nt-wrap\` / \`.nt-tbl\` le llega solo |
| Línea \`---\` | \`.rp-md-hr\` |
| Rótulo de tabla ("Tabla: …" antes de una tabla) | \`p.rp-caption.rp-md-table-caption\` > \`.rp-md-table-num\` ("Tabla 2") |
- **Los módulos de Texto (\`.text-block\`) y Firmas (\`.signatures-block\`) no tienen fondo ni marco propios**: se ve el fondo de la hoja, como en los demás módulos. Si el tema pone fondos de color o degradés en la hoja, no les agregues un fondo blanco; si querés que el texto vaya en una tarjeta, hacelo con el mismo estilo de \`.rp-card\` del tema (por ejemplo \`:scope .text-block { background: var(--rp-surface-1); border-radius: var(--rp-radius); }\`).
- El texto puede tener títulos, listas, tablas, citas, código, resaltado y ecuaciones a la vez: un tema completo debería darles estilo a \`.rp-md-h1/-h2/-h3\`, \`.rp-md-quote\`, \`.rp-md-mark\`, \`.rp-md-code\` y las viñetas (\`.rp-md li::marker\`), además de las tablas.
- Al editar aparecen la barra de formato (\`.rp-fmt-bar\`) y el editor (\`.rp-md-editor\`, \`.rp-md-source\`): son herramientas, no se imprimen; no les des estilo desde el tema.
- Ya usan las variables del tema: títulos \`--rp-primary\` y \`--rp-label\`, encabezado de tabla \`--rp-th-bg\` / \`--rp-th-text\`, bordes \`--rp-line\`. Normalmente alcanza con definir esas variables.
- Las listas necesitan \`list-style\` explícito (Tailwind lo borra): si las rediseñás, no pongas \`list-style: none\` salvo que dibujes la viñeta vos.
- En el módulo de Texto, el contenido va en trozos \`.rp-md-chunks > .rp-md-chunk\` (cada renglón, ítem o párrafo) para poder repartir un texto largo entre hojas. El espacio entre trozos lo da su \`margin-top\` (\`.is-block\`, \`.is-heading\`): no lo cambies, el paginador lo usa para calcular cuánto entra en cada hoja. La parte que sigue en otra hoja lleva \`.rp-block-cont\` y \`.text-block.is-cont\` (sin título).
- \`.rp-md-p\` respeta los saltos de renglón (\`white-space: pre-line\`): no lo cambies o se juntan los renglones que escribió el usuario.

## Cronograma (Gantt)
\`.rp-gantt\` > \`.rp-gantt-head\` (columnas \`.rp-gantt-col\` + escala \`.rp-gantt-years\` / \`.rp-gantt-ticks\`) y \`.rp-gantt-body\` con filas \`.rp-gantt-row\` (\`.lv-0/1/2\`, \`.is-group\`, \`.is-ms\`). Barras: \`.rp-gantt-bar\` (programado, con \`i\` = avance real), \`.rp-gantt-sum\` (resumen con puntas), \`.rp-gantt-ms\` (hito), \`.rp-gantt-today\` (línea de toma de datos). El color de cada fila viene en \`--gc\`; cambiá la paleta con las variables del tema, no pises \`--gc\`.
- **Las alturas son fijas en mm** (filas, encabezado, leyenda): el cronograma se reparte entre hojas con esas medidas. No cambies \`height\`, \`padding\` vertical ni \`font-size\` de filas y encabezado; sí colores, bordes, fondos y radios.

## Mapa
\`.rp-map-block\` > \`figure.rp-map\` > \`.rp-map-box\` (recuadro con las teselas \`.rp-map-tile\`), marcador \`.rp-map-mark\` (color \`--rp-obs-critical\`) con \`.rp-map-mark-label\`, norte \`.rp-map-north\`, escala \`.rp-map-scale\`, coordenadas \`.rp-map-coords\` (borde \`--rp-primary\`) y atribución \`.rp-map-attr\` (obligatoria: no la ocultes). El pie es \`figcaption.rp-caption.rp-map-caption\`. Podés cambiar borde y radio de \`.rp-map-box\`; el alto lo elige el usuario en mm, no lo cambies.

## Pie de página
\`footer.rp-footer\` con \`.rp-footer-left\`, \`.rp-footer-right\` (textos del usuario; aceptan {campos}) y \`.rp-footer-page\`, que tiene tres partes: \`.rp-footer-page-word\` ("Página "), \`.rp-footer-page-n\` (el número) y \`.rp-footer-page-of\` (" de N"). Para un pie tipo planilla podés ocultar la palabra y el total y mostrar solo el número, y poner rótulos con \`::before { content: 'PÁGINA' }\`.

## Columnas (módulos lado a lado)
Los módulos puestos uno al lado del otro van en \`.rp-row\` y cada uno es \`.rp-block.rp-col\` (el ancho lo da \`flex-grow\`, que elige el usuario). La fila se mide entera para repartir las hojas: no le pongas \`gap\`, \`padding\` ni \`margin\` verticales, ni cambies \`display\`. Podés dibujar un separador con \`border-left\` en \`.rp-col + .rp-col\`.

## Módulo HTML / SVG
El usuario puede pegar HTML o SVG propio; queda en \`.rp-html-block\` > \`.rp-html\`. Sus \`<style>\` solo valen dentro del módulo. Desde el tema podés darle marco o fondo a \`.rp-html\`, pero no cambies el interior: es diseño del usuario.

## Diagramas (Mermaid)
Hay un módulo Diagrama propio (\`.rp-diagram-block\` > \`figure.rp-diagram\` con \`.rp-mermaid\` y \`figcaption.rp-caption.rp-diagram-caption\` > \`.rp-diagram-label\`, igual que el pie de las fotos). Además, un bloque \`\`\`mermaid\`\`\` de un texto se dibuja como SVG dentro de \`.rp-mermaid\`. Toma TODOS sus colores y la letra del tema: nodos \`--rp-primary-soft\` con borde \`--rp-primary\`, texto \`--rp-text\`, fondos \`--rp-surface-1/2\`, bordes \`--rp-border\`/\`--rp-line\`, tareas críticas de los cronogramas \`--rp-obs-critical\`, y la paleta de tortas, barras y mapas sale de \`--rp-primary\`, \`--rp-accent\`, \`--rp-ind-1/2/3\`, \`--rp-label\`, \`--rp-real\` y \`--rp-primary-dark\`. Las esquinas usan \`--rp-radius\`. Para cambiar el aspecto de los diagramas, cambiá esas variables; no pises colores dentro del SVG. Podés darle margen o un marco a \`.rp-mermaid\`, pero no le cambies el tamaño de letra a su SVG.

## Gráficos y Barras (Estilo Totalmente Unificado)
Todos los gráficos (barras métricas del contrato, curva S en tarjetas/panel/franja, avance por rubro, cronograma Gantt y anillos) comparten exactamente las mismas dos clases universales:

- **\`.rp-track\`**: Riel o fondo base de las barras y de los anillos. (Las barras del cronograma no son riel: llevan el color de su grupo y no se tocan con esta clase.)
- **\`.rp-bar-fill\`**: Relleno de avance de todas las barras, del avance de las tareas del cronograma, de los hitos y del arco de los anillos.
- **Reflejo de los anillos**: está apagado; se enciende con \`:scope { --rp-gloss-opacity: 1; }\` (0 a 1 para regular la intensidad).

### Ejemplo de estilo 100% uniforme (Vidrio y Riel claro para TODO sin distinción):
\`\`\`css
/* Rieles claros para todos los gráficos (Métricas, Curva S, Rubros y Anillos) */
:scope .rp-track,
:scope .rp-ring-track {
  background: #E2E8F0 !important;
  stroke: #E2E8F0 !important;
  border-color: transparent !important;
}

/* Reflejo de vidrio encima de todos los rellenos de avance (Métricas, Curva S, Rubros y Gantt) */
:scope .rp-bar-fill {
  background-image: linear-gradient(180deg,
    rgba(255, 255, 255, .42) 0%,
    rgba(255, 255, 255, .10) 34%,
    rgba(255, 255, 255, 0)   50%,
    rgba(0, 0, 0, .12)      100%) !important;
}

/* …y en los anillos */
:scope { --rp-gloss-opacity: 1; }
\`\`\`

| Selector universal | Qué abarca |
|---|---|
| \`:scope .rp-track\` | Rieles de métricas, curva S, rubros y anillos |
| \`:scope .rp-bar-fill\` | Rellenos de avance de métricas, curva S, rubros, avance e hitos del cronograma y anillos |
| \`:scope { --rp-gloss-opacity: 1 }\` | Enciende el reflejo de vidrio de los anillos |

## Imágenes del tema
${opts.images && opts.images.length ? `El usuario cargó estas imágenes dentro del tema. **No uses rutas ni URLs de archivos**: usá siempre estas variables.

| Variable | Tipo | Tamaño |
|---|---|---|
${opts.images.map((i) => `| \`var(${i.varName})\` | ${i.kind} | ${i.size} |`).join('\n')}

Ejemplos:
\`\`\`css
/* Imagen a la derecha del encabezado */
:scope .rp-header { position: relative; }
:scope .rp-header::after { content: ''; position: absolute; right: 5mm; top: 50%; transform: translateY(-50%);
  height: 18mm; aspect-ratio: 1; background: ${opts.images[0].varName ? `var(${opts.images[0].varName})` : ''} center / contain no-repeat; }
/* Marca de agua detrás del contenido de la hoja */
:scope { isolation: isolate; }
:scope::before { content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none;
  background: var(${opts.images[0].varName}) center / 70% auto no-repeat; opacity: .08; }
\`\`\`
Las imágenes también se pueden ubicar sin código desde el panel (Ajustes → Imágenes); si escribís reglas para la misma ubicación, las tuyas ganan.` : `El tema todavía no tiene imágenes. Si el diseño necesita una (logo, marca de agua, ícono), pedile al usuario que la cargue en **Ajustes → Imágenes**: queda disponible como \`var(--rp-img-<nombre>)\`. No uses rutas de archivos ni URLs externas.`}

## Variables del tema
| Variable | Qué controla |
|---|---|
${vars}

Valores actuales (tema “${opts.themeName}”):
\`\`\`css
${opts.varsCss}
\`\`\`
${opts.customCss.trim() ? `
Reglas propias que ya tiene el tema (podés reescribirlas):
\`\`\`css
${opts.customCss.trim()}
\`\`\`
` : ''}
## Ejemplo de respuesta válida
\`\`\`css
:scope { --rp-primary: #2b3a55; --rp-accent: #e8b44c; }
:scope .rp-title { background: none; border: 0; border-bottom: 2px solid var(--rp-primary); border-radius: 0; }
:scope .rp-title-row { justify-content: flex-start; }
\`\`\`

## Formato de tu respuesta
Respondé con **un solo bloque \`\`\`css** con el tema completo, con comentarios breves en español que expliquen cada parte. Sin texto fuera del bloque.
`;
}
