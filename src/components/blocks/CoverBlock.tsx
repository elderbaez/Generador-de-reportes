import React, { useRef } from 'react';
import { Plus, X, ImagePlus, Trash2, Braces } from 'lucide-react';
import { BlockConfig, ProjectData } from '../../types';
import { resolveHeaderText, HEADER_VARS } from '../../utils/header';
import { InlineText } from './HeaderBlock';
import { EditDock, DockButton, DockGroup, DockSegmented } from '../EditDock';
import { fileToAsset } from '../../theme/assets';
import './cover-block.css';

/* =====================================================================
   Portada: ocupa la primera hoja entera (sin encabezado ni pie).
   Toma los logos y los datos generales; los textos se editan en la hoja
   y pueden usar {obra}, {fecha}… Tres diseños; los temas pueden
   rediseñarla con .rp-cover y sus partes.
   ===================================================================== */

type CoverLayout = NonNullable<BlockConfig['coverLayout']>;

const uid = () => `c${Math.random().toString(36).slice(2, 9)}`;
export const DEFAULT_COVER = {
  kicker: '{direccion}',
  title: '{obra}',
  subtitle: '{titulo}',
  meta: () => [
    { id: uid(), label: 'Contrato', value: '{contrato}' },
    { id: uid(), label: 'Contratista', value: '{contratista}' },
    { id: uid(), label: 'Fecha', value: '{fecha}' },
  ],
  note: '',
};

interface Props {
  block: BlockConfig;
  data: ProjectData;
  isEditing?: boolean;
  onUpdateConfig?: (patch: Partial<BlockConfig>) => void;
}

export const CoverBlock: React.FC<Props> = ({ block, data, isEditing = false, onUpdateConfig }) => {
  const editing = isEditing && !!onUpdateConfig;
  const layout: CoverLayout = block.coverLayout || 'classic';
  const meta = block.coverMeta ?? DEFAULT_COVER.meta();
  const show = (t: string) => resolveHeaderText(t, data);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<BlockConfig>) => onUpdateConfig?.(patch);

  const txt = (key: 'coverKicker' | 'coverTitle' | 'coverSubtitle' | 'coverNote', def: string, cls: string, ph: string, as: 'div' | 'h1' = 'div') => {
    const v = block[key] ?? def;
    if (!editing && !show(v).trim()) return null;
    return <InlineText value={v} shown={show(v)} editing={editing} className={cls} placeholder={ph} as={as} onCommit={(t) => set({ [key]: t })} />;
  };

  const logos = (data.logoUrl || data.logoRightUrl) ? (
    <div className="rp-cover-logos">
      {data.logoUrl ? <img src={data.logoUrl} alt="Logo" className={`rp-cover-logo${data.invertLogoColor && layout !== 'minimal' ? ' brightness-0 invert' : ''}`} referrerPolicy="no-referrer" /> : <span />}
      {data.logoRightUrl ? <img src={data.logoRightUrl} alt="Logo derecho" className={`rp-cover-logo${data.invertLogoRight && layout !== 'minimal' ? ' brightness-0 invert' : ''}`} referrerPolicy="no-referrer" /> : <span />}
    </div>
  ) : null;

  const metaEl = (meta.length > 0 || editing) ? (
    <div className="rp-cover-meta">
      {meta.map((m) => (
        <div key={m.id} className="rp-cover-meta-row">
          <InlineText value={m.label} shown={m.label} editing={editing} className="rp-cover-meta-label" placeholder="Dato"
            onCommit={(t) => set({ coverMeta: meta.map((x) => (x.id === m.id ? { ...x, label: t } : x)) })} />
          <InlineText value={m.value} shown={show(m.value) || '—'} editing={editing} className="rp-cover-meta-value" placeholder="valor"
            onCommit={(t) => set({ coverMeta: meta.map((x) => (x.id === m.id ? { ...x, value: t } : x)) })} />
          {editing && <button type="button" className="rp-hd-x no-print" title="Quitar dato" onClick={() => set({ coverMeta: meta.filter((x) => x.id !== m.id) })}><X /></button>}
        </div>
      ))}
      {editing && meta.length < 8 && (
        <button type="button" className="rp-hd-add no-print" onClick={() => set({ coverMeta: [...meta, { id: uid(), label: 'Dato', value: '' }] })}><Plus /> Dato</button>
      )}
    </div>
  ) : null;

  const photo = (
    <div className="rp-cover-photo" style={block.coverImage ? { backgroundImage: `url("${block.coverImage}")` } : undefined}>
      {!block.coverImage && editing && (
        <button type="button" className="rp-hd-logo-add no-print" onClick={() => fileRef.current?.click()}><ImagePlus /> Foto de portada</button>
      )}
    </div>
  );

  const titles = (
    <div className="rp-cover-titles">
      {txt('coverKicker', DEFAULT_COVER.kicker, 'rp-cover-kicker', 'Institución / dirección')}
      {txt('coverTitle', DEFAULT_COVER.title, 'rp-cover-title', 'Título del documento', 'h1')}
      {txt('coverSubtitle', DEFAULT_COVER.subtitle, 'rp-cover-subtitle', 'Subtítulo')}
    </div>
  );

  return (
    <div className={`rp-cover rp-cover--${layout}${block.coverImage ? ' has-photo' : ''}`}>
      {layout === 'classic' && (
        <>
          <div className="rp-cover-band">{logos}</div>
          {block.coverImage && photo}
          <div className="rp-cover-body">{titles}<div className="rp-cover-rule" /></div>
          {metaEl}
          {txt('coverNote', DEFAULT_COVER.note, 'rp-cover-note', 'Nota al pie (elaborado por…)')}
        </>
      )}
      {layout === 'photo' && (
        <>
          {logos}
          {photo}
          <div className="rp-cover-body">{titles}</div>
          {metaEl}
          {txt('coverNote', DEFAULT_COVER.note, 'rp-cover-note', 'Nota al pie (elaborado por…)')}
        </>
      )}
      {layout === 'minimal' && (
        <>
          {logos}
          <div className="rp-cover-body"><div className="rp-cover-bar" />{titles}</div>
          {block.coverImage && photo}
          {metaEl}
          {txt('coverNote', DEFAULT_COVER.note, 'rp-cover-note', 'Nota al pie (elaborado por…)')}
        </>
      )}

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => {
        const f = e.target.files?.[0]; e.target.value = '';
        if (!f) return;
        // La foto se guarda achicada (como las imágenes del tema): una portada no necesita 12 MP
        try { set({ coverImage: (await fileToAsset(f, [])).dataUrl }); } catch (err) { alert(err instanceof Error ? err.message : String(err)); }
      }} />

      {editing && (
        <EditDock slot="options">
          <DockGroup label="Diseño">
            <DockSegmented<CoverLayout>
              value={layout}
              options={[{ value: 'classic', label: 'Clásica' }, { value: 'photo', label: 'Con foto' }, { value: 'minimal', label: 'Minimalista' }]}
              onChange={(v) => set({ coverLayout: v })}
            />
          </DockGroup>
          <DockGroup label="Foto">
            <DockButton onClick={() => fileRef.current?.click()}><ImagePlus /> {block.coverImage ? 'Cambiar' : 'Elegir'}</DockButton>
            {block.coverImage && <DockButton onClick={() => set({ coverImage: undefined })} title="Quitar la foto"><Trash2 /></DockButton>}
          </DockGroup>
          <span className="dock-label" title={HEADER_VARS.map((v) => `{${v.key}} = ${v.label}`).join('\n')}>
            <Braces style={{ width: 12, height: 12, display: 'inline', verticalAlign: '-2px' }} /> Datos: {'{obra} {titulo} {fecha} {direccion} {contrato} {contratista}'}
          </span>
          <span className="dock-label">Los logos se cargan en el encabezado o en Datos generales</span>
        </EditDock>
      )}
    </div>
  );
};
