import { selectAllOnEnter } from '../../utils/samples';
import React, { useRef } from 'react';
import { Plus, X, ImagePlus, Trash2, Braces } from 'lucide-react';
import { ProjectData } from '../../types';
import {
  HeaderConfig, HeaderLayout, HeaderLevel, HEADER_LEVELS, HEADER_VARS, MAX_HEADER_LINES,
  normalizeHeader, resolveHeaderText, newHeaderLine, newHeaderMeta,
} from '../../utils/header';
import { EditDock, DockButton, DockGroup, DockSegmented, DockCheck } from '../EditDock';
import { fileToAsset } from '../../theme/assets';
import './header-block.css';

interface HeaderBlockProps {
  data: ProjectData;
  totalPages?: number;
  isEditing?: boolean;
  onUpdateProjectData?: (patch: Partial<ProjectData>) => void;
}

/* Texto editable en el lugar: al editar muestra {campos}; si no, los datos ya puestos */
export const InlineText: React.FC<{
  value: string; shown: string; editing: boolean; className?: string; placeholder?: string;
  onCommit: (v: string) => void; as?: 'span' | 'div' | 'h1';
}> = ({ value, shown, editing, className, placeholder, onCommit, as = 'span' }) => {
  const Tag = as as any;
  // Como en las celdas de las tablas: al entrar queda todo seleccionado
  const sel = React.useMemo(() => selectAllOnEnter(), []);
  if (!editing) return <Tag className={className}>{shown}</Tag>;
  return (
    <Tag
      className={`${className || ''} rp-hd-edit`}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-placeholder={placeholder}
      onFocus={(e: React.FocusEvent<HTMLElement>) => sel.onFocus(e)}
      onMouseUp={sel.onMouseUp}
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); } }}
      onBlur={(e: React.FocusEvent<HTMLElement>) => { const t = (e.target as HTMLElement).innerText.replace(/\n/g, ' ').trim(); if (t !== value) onCommit(t); }}
    >{value}</Tag>
  );
};

const LEVEL_CLASS: Record<HeaderLevel, string> = {
  // Se conservan las clases de siempre para que los temas existentes sigan funcionando
  sm: 'rp-header-director',
  xl: 'rp-header-project',
  accent: 'rp-header-report',
  md: 'rp-header-line-md',
  xs: 'rp-header-date',
};

/** Botón de logo (izquierdo / derecho) con carga de archivo */
const LogoSlot: React.FC<{
  url?: string; invert?: boolean; side: 'left' | 'right'; editing: boolean; onPick: (url: string) => void;
}> = ({ url, invert, side, editing, onPick }) => {
  const ref = useRef<HTMLInputElement>(null);
  const load = async (f?: File | null) => {
    if (!f) return;
    try { onPick((await fileToAsset(f, [])).dataUrl); } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  };
  return (
    <div className={`rp-header-logo is-${side}`}>
      {url ? (
        <img src={url} alt={side === 'left' ? 'Logo' : 'Logo derecho'} className={invert ? 'brightness-0 invert' : ''} referrerPolicy="no-referrer" />
      ) : editing ? (
        <button type="button" className="rp-hd-logo-add no-print" onClick={() => ref.current?.click()}>
          <ImagePlus /> {side === 'left' ? 'Logo' : 'Logo der.'}
        </button>
      ) : side === 'left' ? (
        <div className="rp-hd-logo-empty">LOGO</div>
      ) : null}
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { load(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
};

export const HeaderBlock: React.FC<HeaderBlockProps> = ({ data, totalPages = 1, isEditing = false, onUpdateProjectData }) => {
  const h = normalizeHeader(data.header);
  const save = (patch: Partial<HeaderConfig>) => onUpdateProjectData?.({ header: { ...h, ...patch } });
  const show = (t: string) => resolveHeaderText(t, data, 1, totalPages);
  const editing = isEditing && !!onUpdateProjectData;

  const lines = (
    <div className="rp-header-titles">
      {h.lines.map((l, i) => (
        <div key={l.id} className={`rp-header-line rp-header-line--${l.level} ${LEVEL_CLASS[l.level]}`}>
          <InlineText value={l.text} shown={show(l.text)} editing={editing} placeholder="Texto del renglón"
            as={l.level === 'xl' ? 'h1' : 'span'} className="rp-header-line-text"
            onCommit={(v) => save({ lines: h.lines.map((x) => (x.id === l.id ? { ...x, text: v } : x)) })} />
          {editing && (
            <span className="rp-hd-line-tools no-print">
              <select value={l.level} title="Tamaño del renglón"
                onChange={(e) => save({ lines: h.lines.map((x) => (x.id === l.id ? { ...x, level: e.target.value as HeaderLevel } : x)) })}>
                {HEADER_LEVELS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button type="button" title="Quitar renglón" onClick={() => save({ lines: h.lines.filter((x) => x.id !== l.id) })}><X /></button>
              {i === h.lines.length - 1 && h.lines.length < MAX_HEADER_LINES && (
                <button type="button" title="Agregar renglón" onClick={() => save({ lines: [...h.lines, newHeaderLine()] })}><Plus /></button>
              )}
            </span>
          )}
        </div>
      ))}
      {editing && h.lines.length === 0 && (
        <button type="button" className="rp-hd-add no-print" onClick={() => save({ lines: [newHeaderLine()] })}><Plus /> Renglón</button>
      )}
    </div>
  );

  const meta = (
    <div className="rp-header-meta">
      {h.meta.map((m) => (
        <div key={m.id} className="rp-header-meta-row">
          <InlineText value={m.label} shown={m.label} editing={editing} className="rp-header-meta-label" placeholder="Dato"
            onCommit={(v) => save({ meta: h.meta.map((x) => (x.id === m.id ? { ...x, label: v } : x)) })} />
          <InlineText value={m.value} shown={show(m.value) || '—'} editing={editing} className="rp-header-meta-value" placeholder="valor"
            onCommit={(v) => save({ meta: h.meta.map((x) => (x.id === m.id ? { ...x, value: v } : x)) })} />
          {editing && (
            <button type="button" className="rp-hd-x no-print" title="Quitar dato" onClick={() => save({ meta: h.meta.filter((x) => x.id !== m.id) })}><X /></button>
          )}
        </div>
      ))}
      {editing && h.meta.length < 6 && (
        <button type="button" className="rp-hd-add no-print" onClick={() => save({ meta: [...h.meta, newHeaderMeta()] })}><Plus /> Dato</button>
      )}
    </div>
  );

  const left = <LogoSlot url={data.logoUrl} invert={data.invertLogoColor} side="left" editing={editing} onPick={(u) => onUpdateProjectData?.({ logoUrl: u })} />;
  const right = <LogoSlot url={data.logoRightUrl} invert={data.invertLogoRight} side="right" editing={editing} onPick={(u) => onUpdateProjectData?.({ logoRightUrl: u })} />;

  return (
    <header className={`rp-header rp-header--${h.layout} select-none shrink-0${editing ? ' is-editing' : ''}`}>
      {h.layout === 'institutional' && <>{left}{lines}{right}</>}
      {h.layout === 'company' && <>{left}{lines}{data.logoRightUrl || editing ? right : null}{meta}</>}
      {h.layout === 'iso' && <>{left}{lines}{data.logoRightUrl || editing ? right : null}{meta}</>}

      {editing && (
        <EditDock slot="options">
          <DockGroup label="Diseño">
            <DockSegmented<HeaderLayout>
              value={h.layout}
              options={[
                { value: 'institutional', label: 'Institucional' },
                { value: 'company', label: 'Empresa' },
                { value: 'iso', label: 'ISO' },
              ]}
              onChange={(v) => save({ layout: v })}
            />
          </DockGroup>
          {(data.logoUrl || data.logoRightUrl) && <DockGroup label="Logos">
            {data.logoUrl && <DockButton onClick={() => onUpdateProjectData?.({ logoUrl: '' })} title="Quitar el logo izquierdo"><Trash2 /> Izq.</DockButton>}
            {data.logoRightUrl && <DockButton onClick={() => onUpdateProjectData?.({ logoRightUrl: '' })} title="Quitar el logo derecho"><Trash2 /> Der.</DockButton>}
          </DockGroup>}
          {data.logoUrl && <DockCheck label="Logo izq. en blanco" checked={!!data.invertLogoColor} onChange={() => onUpdateProjectData?.({ invertLogoColor: !data.invertLogoColor })} />}
          {data.logoRightUrl && <DockCheck label="Logo der. en blanco" checked={!!data.invertLogoRight} onChange={() => onUpdateProjectData?.({ invertLogoRight: !data.invertLogoRight })} />}
          <span className="dock-label" title={HEADER_VARS.map((v) => `{${v.key}} = ${v.label}`).join('\n')}>
            <Braces style={{ width: 12, height: 12, display: 'inline', verticalAlign: '-2px' }} /> Datos: {HEADER_VARS.map((v) => `{${v.key}}`).join(' ')}
          </span>
        </EditDock>
      )}
    </header>
  );
};
