import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Code2, ShieldCheck, Bot, ClipboardCopy, Download, ChevronDown, ChevronUp, Braces, Plus } from 'lucide-react';
import { BlockConfig, ProjectData, RubricItem } from '../../types';
import { isEditableVar, patchForVar, varList, varsUsedIn, newField, resolveVars } from '../../utils/fields';
import { SectionHeaderBanner } from '../SectionHeaderBanner';
import { EditDock } from '../EditDock';
import { EditableCell } from '../table/NotionTable';
import { stripRefTags } from '../../utils/refs';
import { PHOTO_PREFIX_SUGGESTIONS } from '../../utils/photoNumbering';
import { buildHtmlGuide } from '../../utils/htmlGuide';
import './html-block.css';

/* =====================================================================
   Módulo HTML / SVG: un gráfico, una tarjeta o un diagrama hecho a mano
   o por una IA, dibujado directo en la hoja.
   - ESTÁTICO: se limpia de scripts, eventos (onclick…), iframes y
     formularios antes de mostrarlo (DOMPurify). Así una plantilla
     compartida no puede ejecutar nada en el programa.
   - Los <style> se aplican SOLO dentro del módulo (@scope).
   - Puede usar los colores del tema: var(--rp-primary), var(--rp-accent)…
   Necesita el paquete "dompurify" (npm i dompurify).
   ===================================================================== */

type Purify = { sanitize: (dirty: string, cfg: Record<string, unknown>) => string };
let purifyPromise: Promise<Purify> | null = null;
let purifyLoaded: Purify | null = null;
const loadPurify = () => {
  if (!purifyPromise) {
    purifyPromise = import('dompurify')
      .then((m) => (purifyLoaded = (m as { default?: Purify }).default ?? (m as unknown as Purify)))
      .catch((e) => { purifyPromise = null; throw e; });
  }
  return purifyPromise;
};

const PURIFY_CFG = {
  USE_PROFILES: { html: true, svg: true, svgFilters: true },
  FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'link', 'meta', 'base'],
  FORBID_ATTR: ['srcset'],
  ALLOW_DATA_ATTR: false,
  // Marca de los datos que se pueden editar en la hoja (la pone el programa, ver markFields)
  ADD_ATTR: ['data-rp-field'],
};

/** Separa los <style> del resto: el CSS se encierra en el módulo con @scope */
function splitStyles(code: string): { css: string; markup: string } {
  const css: string[] = [];
  const markup = code.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, c: string) => { css.push(c); return ''; });
  return { css: css.join('\n'), markup };
}

const cleanCss = (css: string) =>
  css
    .replace(/@import[^;]*;?/gi, '')            // nada de traer hojas de afuera
    .replace(/@font-face\s*\{[^}]*\}/gi, '')     // ni fuentes
    .replace(/expression\s*\(/gi, '(')           // IE viejo
    .replace(/<\/?[a-z][^>]*>/gi, '');           // que no se cuele HTML

type Safe = { html: string; css: string; removed: boolean };
/**
 * Limpieza guardada por código: si el módulo se vuelve a montar (por ejemplo al pasar
 * a otra hoja) se muestra enseguida con el mismo alto. Si apareciera vacío un instante,
 * la paginación lo devolvería a la hoja anterior y quedaría saltando entre hojas.
 */
const safeCache = new Map<string, Safe>();
function sanitize(p: Purify, code: string): Safe {
  let r = safeCache.get(code);
  if (r) return r;
  const { css, markup } = splitStyles(code);
  const html = p.sanitize(markup, PURIFY_CFG);
  const removed = /<script|\son\w+\s*=|javascript:|<iframe|<object|<embed|<form/i.test(markup);
  r = { html, css: cleanCss(css), removed };
  if (safeCache.size > 50) safeCache.clear();
  safeCache.set(code, r);
  return r;
}

export const EXAMPLE_HTML = `<!-- Ejemplo: barras de avance con los colores del tema -->
<svg viewBox="0 0 700 118" width="100%" font-family="inherit">
  <g font-size="12" fill="var(--rp-text, #172033)">
    <text x="0" y="22">Hormigón</text>
    <text x="0" y="60">Mampostería</text>
    <text x="0" y="98">Terminaciones</text>
  </g>
  <rect x="120" y="8" width="520" height="20" rx="5" fill="var(--rp-surface-2, #f1f5f9)"/>
  <rect x="120" y="8" width="390" height="20" rx="5" fill="var(--rp-primary)"/>
  <rect x="120" y="46" width="520" height="20" rx="5" fill="var(--rp-surface-2, #f1f5f9)"/>
  <rect x="120" y="46" width="260" height="20" rx="5" fill="var(--rp-accent)"/>
  <rect x="120" y="84" width="520" height="20" rx="5" fill="var(--rp-surface-2, #f1f5f9)"/>
  <rect x="120" y="84" width="114" height="20" rx="5" fill="var(--rp-ind3, #16a34a)"/>
  <g font-size="12" font-weight="700" text-anchor="end" fill="var(--rp-primary)">
    <text x="700" y="22">75 %</text><text x="700" y="60">50 %</text><text x="700" y="98">22 %</text>
  </g>
</svg>`;

/** Si se pega la respuesta entera de una IA, se toma solo el bloque ```html */
const extractHtml = (t: string) => {
  const m = /```(?:html|svg|xml)?\s*\n([\s\S]*?)```/i.exec(t);
  return m ? m[1].trim() : t;
};

/** Fecha aaaa-mm-dd → Date local (mediodía, para no correrse de día) */
const isoDate = (s: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim()); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; };
const dd = (d: Date, long: boolean) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${long ? d.getFullYear() : String(d.getFullYear()).slice(2)}`;

/**
 * Marcas que el programa completa con los datos del informe antes de dibujar el HTML:
 *  {fecha}        fecha de toma de datos, 03/11/2026      {fecha_corta}  03/11/26
 *  {pos:2026-10-01:2027-07-01}   dónde cae la fecha de toma de datos entre esas dos fechas, en %
 *                                 (con 2 decimales, entre 0 y 100) → style="left:{pos:…}%"
 *  {titulo} {obra} {direccion} {contrato} {contratista}  como en el encabezado
 *  {avance:1.0} o {avance:Movimiento de suelos}  % de avance de ese rubro del módulo
 *                 "Situación actual y gráfico de avance" (por código o por el comienzo del nombre)
 *  {avance_fisico} {avance_financiero} {plazo}  % del módulo Contrato e indicadores
 * Los números salen con punto decimal (sirven para CSS: width:calc(30% * {avance:1.0} / 100)).
 */
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const num = (n: number) => String(Math.round((Number(n) || 0) * 100) / 100);
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Editando: los datos escritos como texto ({vertice} dentro de una celda, no dentro de
 * un atributo ni de un <style>) se dibujan dentro de <span data-rp-field="vertice">
 * para poder cambiarlos con un clic en la hoja.
 */
function markFields(code: string, data: ProjectData): { code: string; spans: Map<string, string> } {
  const spans = new Map<string, string>();
  let n = 0;
  const out = code.split(/(<style[\s\S]*?<\/style>|<!--[\s\S]*?-->|<[^>]*>)/i).map((seg, i) => {
    if (i % 2 === 1) return seg; // etiqueta, comentario o estilo: se deja
    return seg.replace(/\{([A-Za-z]\w*)\}/g, (m, k: string) => {
      if (!isEditableVar(k, data)) return m;
      const id = `\u0001${n++}\u0002`;
      spans.set(id, k);
      return id;
    });
  });
  return { code: out.join(''), spans };
}

export function resolveHtmlVars(code: string, data: ProjectData, rubrics: RubricItem[] = [], editable = false): string {
  if (editable) {
    const { code: marked, spans } = markFields(code, data);
    const done = resolveHtmlVars(marked, data, rubrics, false);
    return done.replace(/\u0001\d+\u0002/g, (id) => {
      const k = spans.get(id)!;
      return `<span class="rp-hf" data-rp-field="${k}">${esc(resolveHtmlVars(`{${k}}`, data, rubrics))}</span>`;
    });
  }
  const ref = isoDate(data.reportDate || '');
  const rubric = (key: string) => {
    const k = norm(key);
    const active = rubrics.filter((r) => !r.comment);
    return active.find((r) => norm(r.item || '') === k)
      ?? active.find((r) => norm(r.description || '').startsWith(k))
      ?? active.find((r) => norm(r.description || '').includes(k));
  };
  return code
    .replace(/\{avance:([^}\n]+)\}/g, (m, key: string) => num(rubric(key)?.percent ?? 0))
    .replace(/\{avance_fisico\}/g, num(data.physicalProgress))
    .replace(/\{avance_financiero\}/g, num(data.financialProgress))
    .replace(/\{plazo\}/g, num(data.timeProgress))
    .replace(/\{pos:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})\}/g, (m, a: string, b: string) => {
      const d0 = isoDate(a), d1 = isoDate(b);
      if (!ref || !d0 || !d1 || d1 <= d0) return '0';
      const p = ((ref.getTime() - d0.getTime()) / (d1.getTime() - d0.getTime())) * 100;
      return String(Math.round(Math.min(100, Math.max(0, p)) * 100) / 100);
    })
    .replace(/\{fecha_corta\}/g, ref ? dd(ref, false) : '—')
    // Logos de Datos generales (para un encabezado propio: <img src="{logo}">)
    .replace(/\{logo\}/g, data.logoUrl || '')
    .replace(/\{logo_derecho\}/g, data.logoRightUrl || '')
    // El resto, igual que en cualquier texto del informe: datos {clave}, campos propios y citas [[ref:ID]]
    .replace(/[\s\S]*/, (all) => resolveVars(all, data));
}

interface Props {
  block: BlockConfig;
  /** Datos generales del informe (para {fecha}, {pos:…}…) */
  data?: ProjectData;
  /** Rubros del módulo de situación actual (para {avance:…}) */
  rubrics?: RubricItem[];
  numberIndex?: number | null;
  label?: string;
  isEditing?: boolean;
  onUpdateConfig?: (patch: Partial<BlockConfig>) => void;
  /** Para cambiar los datos del informe que usa el HTML (tabla de datos y edición en la hoja) */
  onUpdateProjectData?: (patch: Partial<ProjectData>) => void;
  onStartEditing?: () => void;
}

/** Marcas que el programa calcula (no se editan como dato) */
const COMPUTED = new Set(['fecha_corta', 'avance_fisico', 'avance_financiero', 'plazo', 'logo', 'logo_derecho', 'pagina', 'paginas']);

export const HtmlBlock: React.FC<Props> = ({ block, data, rubrics, numberIndex, label, isEditing = false, onUpdateConfig, onUpdateProjectData, onStartEditing }) => {
  const caption = block.htmlCaption ?? '';
  const [guideMsg, setGuideMsg] = useState<string | null>(null);
  const copyGuide = async () => {
    try { await navigator.clipboard.writeText(buildHtmlGuide()); setGuideMsg('Guía copiada: completá "Lo que quiero" y pegala en la IA. Después pegá su respuesta acá.'); }
    catch { setGuideMsg('No se pudo copiar: usá "Descargar guía".'); }
  };
  const downloadGuide = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buildHtmlGuide()], { type: 'text/markdown;charset=utf-8' }));
    a.download = 'guia-html-informe.md';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  // Datos del informe dentro del HTML: {fecha}, {pos:inicio:fin}… (ver resolveHtmlVars)
  const raw = block.htmlCode ?? '';
  const canEditData = isEditing && !!data && !!onUpdateProjectData;
  const code = useMemo(() => (data ? resolveHtmlVars(raw, data, rubrics, canEditData) : raw), [raw, data, rubrics, canEditData]);
  const [codeOpen, setCodeOpen] = useState(false);

  // Datos que usa este HTML: se muestran en una tabla para cambiarlos sin tocar el código
  const used = useMemo(() => varsUsedIn(raw).filter((k) => !COMPUTED.has(k)), [raw]);
  const vars = useMemo(() => new Map(varList(data).map((v) => [v.key, v])), [data]);
  const setVar = (key: string, value: string) => {
    if (!data || !onUpdateProjectData) return;
    const p = patchForVar(data, key, value);
    if (p) onUpdateProjectData(p);
  };
  const createField = (key: string) => {
    if (!data || !onUpdateProjectData) return;
    const fields = data.fields || [];
    const label2 = key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
    onUpdateProjectData({ fields: [...fields, { ...newField(label2, '', fields), key }] });
  };

  // Clic en un dato marcado de la hoja: se escribe ahí mismo; Enter o salir del dato lo guarda
  const onSheetClick = (e: React.MouseEvent) => {
    if (!canEditData) return;
    const el = (e.target as HTMLElement).closest('[data-rp-field]') as HTMLElement | null;
    if (!el || el.isContentEditable) return;
    const key = el.getAttribute('data-rp-field')!;
    el.contentEditable = 'true';
    el.spellcheck = false;
    el.focus();
    const r = document.createRange(); r.selectNodeContents(el);
    const sel = getSelection(); sel?.removeAllRanges(); sel?.addRange(r);
    const before = el.textContent || '';
    const done = (save: boolean) => {
      el.removeEventListener('blur', onBlur);
      el.removeEventListener('keydown', onKey);
      el.contentEditable = 'false';
      const v = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (save && v !== before.trim()) setVar(key, v); else el.textContent = before;
    };
    const onBlur = () => done(true);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Enter') { ev.preventDefault(); done(true); }
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); done(false); }
    };
    el.addEventListener('blur', onBlur);
    el.addEventListener('keydown', onKey);
  };
  const [safe, setSafe] = useState<Safe | null>(() => (purifyLoaded ? sanitize(purifyLoaded, code) : null));
  const [failed, setFailed] = useState(false);
  const scopeId = `rp-html-${block.id.replace(/[^\w-]/g, '')}`;

  useEffect(() => {
    let off = false;
    if (purifyLoaded) { setSafe(sanitize(purifyLoaded, code)); return; }
    loadPurify()
      .then((p) => {
        if (off) return;
        setSafe(sanitize(p, code));
        setFailed(false);
      })
      .catch(() => { if (!off) setFailed(true); });
    return () => { off = true; };
  }, [code]);

  const scoped = useMemo(() => (safe?.css.trim() ? `@scope ([data-html-scope="${scopeId}"]) {\n${safe.css}\n}` : ''), [safe, scopeId]);

  // Cuadro de código que crece con el contenido
  const taRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    // Cerrado: un par de renglones (el que no programa no lo necesita); abierto: crece con el código
    const open = codeOpen || !raw.trim();
    ta.style.height = `${open ? Math.min(ta.scrollHeight + 2, 520) : Math.min(ta.scrollHeight + 2, 46)}px`;
  }, [raw, isEditing, codeOpen]);

  return (
    <div className="rp-html-block relative px-5 py-2">
      <SectionHeaderBanner
        numberIndex={numberIndex}
        title={block.title}
        isEditing={isEditing}
        showTitle={block.showTitle ?? true}
        onUpdateTitle={(t) => onUpdateConfig?.({ title: t })}
        onToggleShowTitle={() => onUpdateConfig?.({ showTitle: !(block.showTitle ?? true) })}
        onStartEditing={onStartEditing}
      />

      {isEditing && (
        <div className="rp-html-editor no-print">
          <div className="rp-html-codebar">
            <Code2 /> <b>Código</b>
            <span>{raw.trim() ? `${raw.split('\n').length} renglones` : 'vacío'}</span>
            {raw.trim() && (
              <button type="button" onClick={() => setCodeOpen(!codeOpen)}>
                {codeOpen ? <><ChevronUp /> Achicar</> : <><ChevronDown /> Ver todo el código</>}
              </button>
            )}
          </div>
          <textarea
            ref={taRef}
            className={`rp-md-source rp-html-code${codeOpen || !raw.trim() ? ' is-open' : ''}`}
            onFocus={() => setCodeOpen(true)}
            spellCheck={false}
            value={raw}
            placeholder="Pegá acá HTML o SVG (sin scripts). Podés usar los colores del tema: var(--rp-primary), var(--rp-accent)…"
            onChange={(e) => onUpdateConfig?.({ htmlCode: e.target.value })}
            onPaste={(e) => {
              // Respuesta completa de una IA (texto + ```html …```): se queda solo con el código
              const t = e.clipboardData.getData('text/plain');
              if (/```/.test(t) && !raw.trim()) { e.preventDefault(); onUpdateConfig?.({ htmlCode: extractHtml(t) }); }
            }}
          />
          {used.length > 0 && data && (
            <div className="rp-html-data">
              <div className="rp-html-data-head">
                <Braces /> <b>Datos de este bloque</b>
                <span>{onUpdateProjectData ? 'Se cambian acá o con un clic sobre el dato en la hoja. Son los mismos de Datos generales.' : ''}</span>
              </div>
              <div className="rp-html-data-grid">
                {used.map((k) => {
                  const v = vars.get(k);
                  if (!v) {
                    return (
                      <div key={k} className="rp-html-data-row is-missing">
                        <span className="rp-html-data-lbl">{`{${k}}`}</span>
                        <button type="button" onClick={() => createField(k)} title="Crea el campo en Datos generales → Campos del informe">
                          <Plus /> Crear campo
                        </button>
                      </div>
                    );
                  }
                  const isDate = k === 'fecha';
                  return (
                    <label key={k} className="rp-html-data-row" title={`{${k}}`}>
                      <span className="rp-html-data-lbl">{v.label}</span>
                      <input
                        type={isDate ? 'date' : 'text'}
                        value={isDate ? data.reportDate || '' : v.value}
                        placeholder="—"
                        onChange={(e) => setVar(k, e.target.value)}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          <div className="rp-html-ai">
            <Bot />
            <span>¿Lo arma una IA? Copiá la guía (trae los colores y medidas de este informe), completala y pegá acá la respuesta.</span>
            <button type="button" onClick={copyGuide}><ClipboardCopy /> Copiar guía para IA</button>
            <button type="button" onClick={downloadGuide}><Download /> Descargar</button>
          </div>
          {guideMsg && <div className="rp-html-help">{guideMsg}</div>}
          <div className="rp-html-help">
            <ShieldCheck /> Se muestra sin scripts ni eventos (por seguridad). Los <code>&lt;style&gt;</code> solo afectan a este módulo.
            {!raw.trim() && (
              <button type="button" onClick={() => onUpdateConfig?.({ htmlCode: EXAMPLE_HTML })}>Cargar un ejemplo</button>
            )}
          </div>
          {safe?.removed && <div className="rp-html-warn">Se quitaron partes con código (scripts, eventos o marcos): no se ejecutan en la hoja.</div>}
          {failed && <div className="rp-html-warn">Falta instalar el paquete "dompurify" en el proyecto.</div>}
        </div>
      )}

      {scoped && <style>{scoped}</style>}
      {safe && safe.html.trim() ? (
        <div
          className={`rp-html${canEditData ? ' is-data-editing' : ''}`}
          data-html-scope={scopeId}
          onClick={onSheetClick}
          dangerouslySetInnerHTML={{ __html: safe.html }}
        />
      ) : !isEditing ? (
        <div className="rp-html-empty no-print" onDoubleClick={onStartEditing}><Code2 /> Doble clic para pegar HTML o SVG</div>
      ) : null}

      {(isEditing || !!label || !!stripRefTags(caption)) && (
        <div className="rp-caption rp-html-caption">
          {label && <b className="rp-html-label">{label}</b>}
          {label && (stripRefTags(caption) || isEditing) ? ' - ' : ''}
          <EditableCell
            value={isEditing ? caption : stripRefTags(caption)}
            onCommit={(v) => onUpdateConfig?.({ htmlCaption: v })}
            isEditing={isEditing}
            row={0}
            col={0}
            placeholder="Pie de la figura"
            className="rp-html-capcell"
          />
        </div>
      )}

      {isEditing && (
        <EditDock slot="options">
          <label className="dock-group" title="Numera sola la figura junto con fotos, documentos y diagramas del mismo prefijo. Vacío = sin número.">
            <span className="dock-label">Numerar como</span>
            <input
              type="text"
              list="html-prefix-suggestions"
              value={block.htmlPrefix ?? ''}
              placeholder="sin numerar"
              onChange={(e) => onUpdateConfig?.({ htmlPrefix: e.target.value })}
              className="dock-input"
            />
            <datalist id="html-prefix-suggestions">
              {['Figura', 'Gráfico', 'Cuadro', ...PHOTO_PREFIX_SUGGESTIONS].filter((v, i, a) => a.indexOf(v) === i).map((x) => <option key={x} value={x} />)}
            </datalist>
          </label>
          <span className="dock-label">HTML y SVG estáticos · sin scripts · colores del tema con var(--rp-…)</span>
        </EditDock>
      )}
    </div>
  );
};
