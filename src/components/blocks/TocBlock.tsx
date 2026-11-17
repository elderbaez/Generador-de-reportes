import React from 'react';
import { BlockConfig } from '../../types';
import { SectionHeaderBanner } from '../SectionHeaderBanner';
import { EditDock, DockCheck } from '../EditDock';
import { splitMdChunks } from '../../utils/mdChunks';
import { stripRefTags } from '../../utils/refs';
import type { TextPart } from '../../utils/photoPagination';
import './toc-block.css';

/* =====================================================================
   Índice: se arma solo con los títulos de sección (y, si se quiere, los
   títulos # y ## de los textos) y la hoja en que cae cada uno.
   No se configura: se inserta y listo. El aspecto lo da el tema.
   ===================================================================== */

export interface TocEntry { key: string; level: 0 | 1; num?: number; title: string; page: number }

const clean = (t: string) => stripRefTags(t.replace(/^\d+[.\-)]\s*/, '').replace(/[*_`~=]+/g, '').trim());

/** Entradas del índice (también lo usa la paginación para estimar el alto) */
export function buildToc(
  blocks: BlockConfig[], numberOf: (id: string) => number | null, textParts: Record<string, TextPart[]> | undefined,
  coverOffset: number, withHeadings: boolean,
): TocEntry[] {
  const out: TocEntry[] = [];
  const ordered = blocks
    .filter((b) => b.enabled && !['header', 'footer', 'cover', 'toc'].includes(b.type))
    .slice()
    .sort((a, b) => (a.pageIndex !== b.pageIndex ? a.pageIndex - b.pageIndex : a.order - b.order));
  for (const b of ordered) {
    const titled = b.showTitle !== false;
    if (titled) out.push({ key: b.id, level: 0, num: numberOf(b.id) ?? undefined, title: clean(b.title), page: b.pageIndex + 1 - coverOffset });
    if (withHeadings && b.type === 'text' && b.textContent) {
      const chunks = splitMdChunks(b.textContent);
      const parts = textParts?.[b.id] ?? [{ page: b.pageIndex, from: 0, to: chunks.length }];
      chunks.forEach((c, i) => {
        const m = /^\s{0,3}(#{1,2})\s+(.*?)\s*#*\s*$/.exec(c.src);
        if (!m) return; // (el primer trozo siempre figura como 'block': se mira el texto)
        const part = parts.find((p) => i >= p.from && i < p.to) ?? parts[0];
        // Sin título de sección, los títulos del texto pasan a ser entradas principales
        out.push({ key: `${b.id}|${i}`, level: titled ? 1 : 0, title: clean(m[2]), page: (part?.page ?? b.pageIndex) + 1 - coverOffset });
      });
    }
  }
  return out;
}

interface Props {
  block: BlockConfig;
  entries: TocEntry[];
  isEditing?: boolean;
  onUpdateConfig?: (patch: Partial<BlockConfig>) => void;
  onStartEditing?: () => void;
}

export const TocBlock: React.FC<Props> = ({ block, entries, isEditing = false, onUpdateConfig, onStartEditing }) => (
  <div className="rp-toc-block px-5 py-2">
    <SectionHeaderBanner
      numberIndex={null}
      title={block.title}
      isEditing={isEditing}
      showTitle={block.showTitle ?? true}
      onUpdateTitle={(t) => onUpdateConfig?.({ title: t })}
      onToggleShowTitle={() => onUpdateConfig?.({ showTitle: !(block.showTitle ?? true) })}
      onStartEditing={onStartEditing}
    />
    <ol className="rp-toc">
      {entries.length === 0 && <li className="rp-toc-empty">El índice se completa solo con los títulos de las secciones.</li>}
      {entries.map((e) => (
        <li key={e.key} className={`rp-toc-row rp-toc-row--${e.level === 0 ? 'main' : 'sub'}`}>
          {e.num != null && <span className="rp-toc-num">{e.num}.</span>}
          <span className="rp-toc-title">{e.title}</span>
          <span className="rp-toc-dots" aria-hidden />
          <span className="rp-toc-page">{Math.max(1, e.page)}</span>
        </li>
      ))}
    </ol>
    {isEditing && (
      <EditDock slot="options">
        <DockCheck
          label="Incluir los títulos (# y ##) de los textos"
          checked={block.tocHeadings !== false}
          onChange={() => onUpdateConfig?.({ tocHeadings: block.tocHeadings === false })}
        />
        <span className="dock-label">Se actualiza solo: títulos de sección y número de hoja</span>
      </EditDock>
    )}
  </div>
);
