import React, { useLayoutEffect, useRef } from 'react';
import { Workflow } from 'lucide-react';
import { BlockConfig } from '../../types';
import { SectionHeaderBanner } from '../SectionHeaderBanner';
import { EditDock, DockGroup, DockSlider } from '../EditDock';
import { EditableCell } from '../table/NotionTable';
import { MermaidDiagram } from '../Mermaid';
import { stripRefTags } from '../../utils/refs';
import { PHOTO_PREFIX_SUGGESTIONS } from '../../utils/photoNumbering';
import { registerSample, isSampleText, selectAllOnEnter } from '../../utils/samples';
import './diagram-block.css';

/* =====================================================================
   Módulo Diagrama: un diagrama Mermaid con su pie numerado ("Figura 03 -
   …"), como una foto. El pie acepta {#nombre} para citarlo con @nombre.
   Se escribe el código arriba y se ve el diagrama en vivo debajo.
   ===================================================================== */

export const DEFAULT_DIAGRAM = `flowchart LR
  A[Contratista presenta] --> B{Fiscalización revisa}
  B -- Aprueba --> C[Certificado]
  B -- Observa --> A`;

const MAX_H = { min: 40, max: 250, def: 120 };
registerSample(DEFAULT_DIAGRAM);

interface Props {
  block: BlockConfig;
  numberIndex?: number | null;
  label?: string;
  isEditing?: boolean;
  onUpdateConfig?: (patch: Partial<BlockConfig>) => void;
  onStartEditing?: () => void;
}

export const DiagramBlock: React.FC<Props> = ({ block, numberIndex, label, isEditing = false, onUpdateConfig, onStartEditing }) => {
  const code = block.diagramCode ?? '';
  const caption = block.diagramCaption ?? '';
  const maxH = block.diagramMaxHeightMm ?? MAX_H.def;

  const taRef = useRef<HTMLTextAreaElement>(null);
  const sampleSel = React.useMemo(() => selectAllOnEnter(), []);
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight + 2, 360)}px`;
  }, [code, isEditing]);

  const showCap = isEditing || !!label || !!stripRefTags(caption);

  return (
    <div className="rp-diagram-block relative px-5 py-2">
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
        <div className="rp-diagram-editor no-print">
          <textarea
            ref={taRef}
            className="rp-md-source"
            spellCheck={false}
            value={code}
            onFocus={(e) => sampleSel.onFocus(e, isSampleText(code))}
            onMouseUp={sampleSel.onMouseUp}
            placeholder="Código Mermaid: flowchart, sequenceDiagram, gantt, classDiagram…"
            onChange={(e) => onUpdateConfig?.({ diagramCode: e.target.value })}
            onKeyDown={(e) => {
              // Tab inserta sangría en vez de salir del cuadro
              if (e.key !== 'Tab') return;
              e.preventDefault();
              const t = e.currentTarget, a = t.selectionStart, b = t.selectionEnd;
              onUpdateConfig?.({ diagramCode: code.slice(0, a) + '  ' + code.slice(b) });
              requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = a + 2; });
            }}
          />
          <div className="rp-diagram-help">
            <Workflow /> Se dibuja en vivo debajo. Pedile a una IA "un diagrama en Mermaid de…" y pegá solo el código (sin las comillas <code>```</code>).
          </div>
        </div>
      )}

      <figure className="rp-diagram" style={{ ['--dg-max' as string]: `${maxH}mm` }}>
        {code.trim() ? (
          <MermaidDiagram code={code.replace(/^\s*```\s*mermaid\s*\n?|\n?\s*```\s*$/gi, '')} />
        ) : (
          <div className="rp-diagram-empty no-print" onDoubleClick={onStartEditing}><Workflow /> Doble clic para escribir el diagrama</div>
        )}
        {showCap && (
          <figcaption className="rp-caption rp-diagram-caption">
            {label && <b className="rp-diagram-label">{label}</b>}
            {label && (stripRefTags(caption) || isEditing) ? ' - ' : ''}
            <EditableCell
              value={isEditing ? caption : stripRefTags(caption)}
              onCommit={(v) => onUpdateConfig?.({ diagramCaption: v })}
              isEditing={isEditing}
              row={0}
              col={0}
              placeholder="Pie del diagrama"
              className="rp-diagram-capcell"
            />
          </figcaption>
        )}
      </figure>

      {isEditing && (
        <EditDock slot="options">
          <label className="dock-group" title="Numera sola la figura junto con fotos y documentos del mismo prefijo. Vacío = sin número.">
            <span className="dock-label">Numerar como</span>
            <input
              type="text"
              list="diagram-prefix-suggestions"
              value={block.diagramPrefix ?? ''}
              placeholder="sin numerar"
              onChange={(e) => onUpdateConfig?.({ diagramPrefix: e.target.value })}
              className="dock-input"
            />
            <datalist id="diagram-prefix-suggestions">
              {['Figura', 'Diagrama', ...PHOTO_PREFIX_SUGGESTIONS].filter((v, i, a) => a.indexOf(v) === i).map((x) => <option key={x} value={x} />)}
            </datalist>
          </label>
          <DockGroup>
            <DockSlider label="Alto máx." value={maxH} min={MAX_H.min} max={MAX_H.max} step={1} unit="mm"
              onChange={(v) => onUpdateConfig?.({ diagramMaxHeightMm: v })} />
          </DockGroup>
        </EditDock>
      )}
    </div>
  );
};
