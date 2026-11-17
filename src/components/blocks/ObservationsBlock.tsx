import React from 'react';
import { Info, AlertTriangle, OctagonAlert, CheckCircle2, Quote } from 'lucide-react';
import { ObservationsData, ObsStyle } from '../../types';
import { SectionHeaderBanner } from '../SectionHeaderBanner';
import { EditDock, DockGroup, DockSegmented } from '../EditDock';
import { EditableCell } from '@/src/components/table/NotionTable';
import { RichText, InlineRich } from '../RichText';
import { RichEditor } from '../FormatBar';
import './observations.css';

/**
 * Módulo de Observaciones. Las firmas ya no van acá: son un módulo aparte (los
 * informes viejos se migran solos, ver migrateObservationSignatures en App).
 *
 * Estilos de énfasis (clase .rp-obs--<estilo>, ver observations.css):
 *   note      Nota: el recuadro clásico (conserva .rp-card .rp-notes)
 *   quote     Cita: comillas grandes, cursiva y autor
 *   code      Código: monoespaciado con números de renglón
 *   list      Lista: cada renglón es un punto numerado
 *   info      Información (azul) · warning Advertencia (ámbar)
 *   critical  Importante (rojo) · success Conforme (verde)
 * Los cuatro últimos son "avisos": marco y fondo del color, ícono y rótulo, con los
 * colores del tema (--rp-obs-info, --rp-obs-warn, --rp-obs-critical, --rp-obs-ok).
 */

interface ObservationsBlockProps {
  data: ObservationsData;
  title?: string;
  numberIndex?: number | null;
  showTitle?: boolean;
  isEditing?: boolean;
  obsStyle?: ObsStyle;
  obsLabel?: string;
  obsAttribution?: string;
  onUpdateTitle?: (title: string) => void;
  onToggleShowTitle?: () => void;
  onUpdateObservations?: (patch: Partial<ObservationsData>) => void;
  onUpdateStyle?: (patch: { obsStyle?: ObsStyle; obsLabel?: string; obsAttribution?: string }) => void;
  onStartEditing?: () => void;
}

const STYLES: { value: ObsStyle; label: string }[] = [
  { value: 'note', label: 'Nota' },
  { value: 'quote', label: 'Cita' },
  { value: 'code', label: 'Código' },
  { value: 'list', label: 'Lista' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Advertencia' },
  { value: 'critical', label: 'Importante' },
  { value: 'success', label: 'Conforme' },
];

/** Rótulo de cada estilo cuando el usuario no escribió uno propio. */
const DEFAULT_LABEL: Record<ObsStyle, string> = {
  note: 'Notas Generales y Observaciones:',
  quote: '',
  code: 'observaciones.txt',
  list: 'Observaciones',
  info: 'Información',
  warning: 'Advertencia',
  critical: 'Importante',
  success: 'Conforme',
};

const CALLOUT_ICON: Partial<Record<ObsStyle, React.ReactNode>> = {
  info: <Info />,
  warning: <AlertTriangle />,
  critical: <OctagonAlert />,
  success: <CheckCircle2 />,
};

const isCallout = (s: ObsStyle) => s === 'info' || s === 'warning' || s === 'critical' || s === 'success';

const PLACEHOLDER: Record<ObsStyle, string> = {
  note: 'Escriba aquí observaciones de seguridad, contingencias o directivas de obra...',
  quote: 'Texto de la cita (p. ej. lo que dispuso la fiscalización)...',
  code: 'Un registro por renglón...',
  list: 'Una observación por renglón: cada renglón es un punto de la lista...',
  info: 'Información para el lector...',
  warning: 'Riesgo, condición a vigilar o tarea pendiente...',
  critical: 'Incumplimiento, riesgo grave o decisión que no puede esperar...',
  success: 'Lo verificado y aprobado...',
};

export const ObservationsBlock: React.FC<ObservationsBlockProps> = ({
  data,
  title = 'OBSERVACIONES',
  numberIndex,
  showTitle = true,
  isEditing = false,
  obsStyle = 'note',
  obsLabel,
  obsAttribution,
  onUpdateTitle,
  onToggleShowTitle,
  onUpdateObservations,
  onUpdateStyle,
  onStartEditing,
}) => {
  const style: ObsStyle = STYLES.some((s) => s.value === obsStyle) ? obsStyle : 'note';
  const notes = data.notes || '';
  const label = (obsLabel ?? '').trim() ? obsLabel! : DEFAULT_LABEL[style];
  const lines = notes.split('\n').map((l) => l.replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, '')).filter((l) => l.trim());

  /** Rótulo editable en el lugar (vacío vuelve al del estilo). */
  const labelCell = (className: string) => (
    <EditableCell
      row={0}
      col={0}
      value={label}
      onCommit={(v) => onUpdateStyle?.({ obsLabel: v.trim() === DEFAULT_LABEL[style] ? '' : v })}
      isEditing={isEditing}
      placeholder={DEFAULT_LABEL[style] || 'Rótulo'}
      className={className}
    />
  );

  const setNotes = (v: string) => onUpdateObservations?.({ notes: v });
  // Código: cuadro de texto plano. El resto: editor con formato (vista visual o Markdown)
  const editor =
    style === 'code' ? (
      <textarea
        rows={5}
        value={notes}
        onMouseDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={PLACEHOLDER[style]}
        className="rp-obs-input is-mono"
      />
    ) : (
      <RichEditor value={notes} onChange={setNotes} placeholder={PLACEHOLDER[style]} compact={style === 'list'} />
    );

  const empty = <p className="rp-obs-empty">Sin observaciones registradas.</p>;

  let body: React.ReactNode;
  if (style === 'note') {
    body = (
      <div className="rp-card rp-notes rp-obs rp-obs--note border border-slate-200 rounded-[var(--rp-radius-sm)] p-2.5 bg-slate-50/70 text-[8pt] text-slate-700 leading-relaxed shadow-2xs">
        {labelCell('rp-obs-label font-bold text-[var(--rp-label)] block mb-1')}
        {isEditing ? editor : notes ? <RichText className="rp-obs-body" text={notes} /> : empty}
      </div>
    );
  } else if (style === 'quote') {
    body = (
      <figure className="rp-obs rp-obs--quote">
        <span className="rp-obs-mark" aria-hidden><Quote /></span>
        {isEditing ? editor : notes ? <blockquote className="rp-obs-body"><RichText text={notes} /></blockquote> : empty}
        {(isEditing || (obsAttribution || '').trim()) && (
          <figcaption className="rp-obs-attr">
            <span aria-hidden>— </span>
            <EditableCell
              row={1}
              col={0}
              value={obsAttribution || ''}
              onCommit={(v) => onUpdateStyle?.({ obsAttribution: v })}
              isEditing={isEditing}
              placeholder="Autor o fuente (opcional)"
              className="rp-obs-attr-cell"
            />
          </figcaption>
        )}
      </figure>
    );
  } else if (style === 'code') {
    const codeLines = notes ? notes.split('\n') : [];
    body = (
      <div className="rp-obs rp-obs--code">
        <div className="rp-obs-codehead">
          <span className="rp-obs-dots" aria-hidden><i /><i /><i /></span>
          {labelCell('rp-obs-label')}
        </div>
        {isEditing ? editor : codeLines.length ? (
          <ol className="rp-obs-body">
            {codeLines.map((l, i) => <li key={i}><code>{l || ' '}</code></li>)}
          </ol>
        ) : empty}
      </div>
    );
  } else if (style === 'list') {
    body = (
      <div className="rp-obs rp-obs--list">
        {labelCell('rp-obs-label')}
        {isEditing ? editor : lines.length ? (
          <ol className="rp-obs-body">
            {lines.map((l, i) => <li key={i}><InlineRich text={l} /></li>)}
          </ol>
        ) : empty}
      </div>
    );
  } else {
    body = (
      <div className={`rp-obs rp-obs--callout rp-obs--${style}`} role="note">
        <span className="rp-obs-icon" aria-hidden>{CALLOUT_ICON[style]}</span>
        <div className="rp-obs-content">
          {labelCell('rp-obs-label')}
          {isEditing ? editor : notes ? <RichText className="rp-obs-body" text={notes} /> : empty}
        </div>
      </div>
    );
  }

  return (
    <section className="px-5 py-2 shrink-0">
      <SectionHeaderBanner
        numberIndex={numberIndex}
        title={title}
        isEditing={isEditing}
        showTitle={showTitle}
        onUpdateTitle={onUpdateTitle}
        onToggleShowTitle={onToggleShowTitle}
        onStartEditing={onStartEditing}
      />

      {body}

      {isEditing && (
        <EditDock slot="options">
          <DockGroup label="Estilo">
            <DockSegmented value={style} options={STYLES} onChange={(v) => onUpdateStyle?.({ obsStyle: v })} />
          </DockGroup>
        </EditDock>
      )}
    </section>
  );
};
