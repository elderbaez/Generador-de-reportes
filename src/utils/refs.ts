/* =====================================================================
   Referencias a figuras y tablas.
   - Etiqueta: {#nombre} al final del pie de una foto o un documento, o del
     rótulo de una tabla ("Tabla: Cronograma {#crono}" justo antes de la tabla).
   - Referencia: @nombre en cualquier texto → "Foto 03", "Tabla 2"…
   Los números salen del orden del informe, así que si se mueven módulos
   las referencias se acomodan solas. La etiqueta no se imprime.
   ===================================================================== */
import { createContext } from 'react';
import type { BlockConfig } from '../types';
import { computePhotoLabels, stripManualNumber, stripLeadNumber } from './photoNumbering';

export const REF_TAG = /\s*\{#([A-Za-z][\w-]*)\}/g;
/** Rótulo de tabla: "Tabla: …" o "Cuadro: …" en su propio renglón */
export const TABLE_CAPTION = /^\s*(tabla|cuadro)\s*:\s*(.*?)\s*$/i;
/** @nombre (no toma los @ de un correo: antes no puede haber letra ni número) */
export const REF_USE = /(^|[^\p{L}\p{N}_@])@([A-Za-z][\w-]*)/gu;

export const stripRefTags = (s: string) => (s || '').replace(REF_TAG, '').trim();
const tagOf = (s: string) => { const m = /\{#([A-Za-z][\w-]*)\}/.exec(s || ''); return m ? m[1] : null; };
const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

export interface RefIndex {
  /** nombre → texto que reemplaza a @nombre */
  refs: Record<string, string>;
  /** renglón del rótulo (sin espacios a los lados) → número de tabla */
  tableNo: Record<string, number>;
}

export function buildRefIndex(blocks: BlockConfig[], generalNotes = ''): RefIndex {
  const refs: Record<string, string> = {};
  const tableNo: Record<string, number> = {};
  const ordered = blocks
    .filter((b) => b.enabled)
    .slice()
    .sort((a, b) => (a.pageIndex !== b.pageIndex ? a.pageIndex - b.pageIndex : a.order - b.order));

  // Fotos y documentos: el número es el de su pie ("Foto 03"); sin numeración, su pie entre comillas
  const labels = computePhotoLabels(blocks);
  for (const b of ordered) {
    const items = b.type === 'photos' ? b.photos || [] : b.type === 'document' ? b.docItems || []
      : b.type === 'diagram' ? [{ id: b.id, caption: b.diagramCaption }]
      : b.type === 'html' ? [{ id: b.id, caption: b.htmlCaption }]
      : b.type === 'gantt' ? [{ id: b.id, caption: b.ganttCaption }]
      : b.type === 'map' ? [{ id: b.id, caption: b.mapCaption }] : [];
    for (const it of items as { id: string; caption?: string }[]) {
      const tag = tagOf(it.caption || '');
      if (!tag || tag in refs) continue;
      // Sin numeración automática: si el pie ya trae su número escrito ("Foto 03: …") se usa ese
      const manual = /^\s*((?:foto(?:graf[ií]a)?|imagen|ilustraci[oó]n|figura|fig\.?|l[aá]mina|plano)\s*(?:n[º°o.]*\s*)?\d+)/i.exec(it.caption || '');
      refs[tag] = labels[it.id] || (manual ? manual[1].trim() : `“${stripRefTags(it.caption || '')}”`);
    }
  }

  // Tablas con rótulo, en el orden del informe (Tabla y Cuadro cuentan juntos)
  let n = 0;
  const scan = (md: string) => {
    let inFence = false;
    for (const line of (md || '').split('\n')) {
      if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue; }
      if (inFence) continue;
      const m = TABLE_CAPTION.exec(line);
      if (!m) continue;
      n++;
      const key = line.trim();
      if (!(key in tableNo)) tableNo[key] = n;
      const tag = tagOf(line);
      if (tag && !(tag in refs)) refs[tag] = `${cap(m[1])} ${n}`;
    }
  };
  for (const b of ordered) {
    if (b.type === 'text') scan(b.textContent || '');
    else if (b.type === 'observations') scan(b.obsNotes ?? generalNotes);
  }
  return { refs, tableNo };
}

/** Cambia @nombre por su número y quita las etiquetas {#nombre}. Sin índice (editor) no toca nada. */
export function applyRefs(text: string, idx: RefIndex | null): string {
  if (!idx) return text;
  return text
    .replace(REF_TOKEN, (m, id: string) => refLabel(id) ?? '(referencia eliminada)')
    .replace(REF_TAG, '')
    .replace(REF_USE, (m, pre: string, name: string) => (name in idx.refs ? pre + idx.refs[name] : m));
}

export const RefsContext = createContext<RefIndex | null>(null);

/* =====================================================================
   Referencias simples (sin escribir nada raro): el botón "Referencia" de la
   barra de formato muestra la lista de figuras y tablas del informe y mete
   en el texto [[ref:ID]], que en la hoja se ve como "Foto 03" / "Tabla 2".
   El ID es el de la foto / documento / módulo, o "tabla:<título>" para las
   tablas de los textos: no cambia aunque se muevan los módulos.
   ===================================================================== */
export const REF_TOKEN = /\[\[ref:([^\]\n]+)\]\]/g;

export interface RefItem { id: string; label: string; caption: string; kind: 'foto' | 'documento' | 'diagrama' | 'grafico' | 'tabla' }

let catalog: RefItem[] = [];
/** La hoja publica la lista de lo que se puede citar (la usa el editor de texto) */
export const setRefCatalog = (c: RefItem[]) => { catalog = c; };
export const getRefCatalog = () => catalog;
export const refLabel = (id: string) => catalog.find((c) => c.id === id)?.label;

/** Arma la lista de figuras y tablas citables, con su número actual */
export function buildRefCatalog(blocks: BlockConfig[], idx: RefIndex, generalNotes = ''): RefItem[] {
  const labels = computePhotoLabels(blocks);
  const out: RefItem[] = [];
  const ordered = blocks
    .filter((b) => b.enabled)
    .slice()
    .sort((a, b) => (a.pageIndex !== b.pageIndex ? a.pageIndex - b.pageIndex : a.order - b.order));
  const manual = (cap: string) => /^\s*((?:foto(?:graf[ií]a)?|imagen|ilustraci[oó]n|figura|fig\.?|l[aá]mina|plano)\s*(?:n[º°o.]*\s*)?\d+)/i.exec(cap)?.[1]?.trim();
  for (const b of ordered) {
    const push = (id: string, kind: RefItem['kind'], cap: string | undefined, fallback: string) => {
      const c = stripRefTags(cap || '');
      const lab = labels[id] || manual(c) || fallback;
      // En la lista no se repite el número si el pie ya lo trae escrito ("Foto 03: …")
      out.push({ id, kind, caption: (labels[id] ? stripLeadNumber(c) : stripManualNumber(c)) || c, label: lab });
    };
    if (b.type === 'photos') (b.photos || []).forEach((p, i) => push(p.id, 'foto', p.caption, `Foto ${i + 1}`));
    else if (b.type === 'document') (b.docItems || []).forEach((d, i) => push(d.id, 'documento', d.caption, `Documento ${i + 1}`));
    else if (b.type === 'diagram') push(b.id, 'diagrama', b.diagramCaption || b.title, 'el diagrama');
    else if (b.type === 'html') push(b.id, 'grafico', b.htmlCaption || b.title, 'el gráfico');
    else if (b.type === 'gantt') push(b.id, 'grafico', b.ganttCaption || b.title, 'el cronograma');
    else if (b.type === 'map') push(b.id, 'grafico', b.mapCaption || b.title, 'el mapa');
    else if (b.type === 'text' || b.type === 'observations') {
      const md = b.type === 'text' ? b.textContent || '' : b.obsNotes ?? generalNotes;
      for (const line of md.split('\n')) {
        const m = TABLE_CAPTION.exec(line);
        if (!m) continue;
        const title = stripRefTags(m[2]);
        const n = idx.tableNo[line.trim()];
        out.push({ id: `tabla:${title}`, kind: 'tabla', caption: title, label: `${cap(m[1])}${n ? ` ${n}` : ''}` });
      }
    }
  }
  return out;
}
