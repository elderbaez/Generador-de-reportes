import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Crosshair, Plus, Minus, Braces } from 'lucide-react';
import { BlockConfig, ProjectData } from '../../types';
import { SectionHeaderBanner } from '../SectionHeaderBanner';
import { EditDock, DockGroup, DockSlider, DockSegmented, DockCheck, DockButton } from '../EditDock';
import { EditableCell } from '../table/NotionTable';
import { stripRefTags } from '../../utils/refs';
import { PHOTO_PREFIX_SUGGESTIONS } from '../../utils/photoNumbering';
import { resolveVars, varList, newField, ReportField } from '../../utils/fields';
import {
  LatLon, MapStyle, MAP_STYLES, TILE, project, unproject, metersPerPx, niceLength, parseNum,
  tileUrl, utmToLatLon, utmZoneOf, fmtDms,
} from '../../utils/geo';
import './map-block.css';

/* =====================================================================
   Módulo Mapa: ubica un punto (coordenadas UTM SIRGAS 2000 o geográficas)
   sobre OpenStreetMap o imagen satelital. Las coordenadas pueden ser
   números o campos del informe ({este_sirgas}), así la misma plantilla
   sirve para cada mojón cambiando solo los datos generales.
   El mapa se arma con teselas sueltas (sin librerías): se imprime y sale
   en el PDF como cualquier imagen.
   ===================================================================== */

const PX_MM = 96 / 25.4;
export const MAP_DEFAULTS = { zoom: 17, heightMm: 80, zone: 21 };

interface Props {
  block: BlockConfig;
  data: ProjectData;
  numberIndex?: number | null;
  label?: string;
  isEditing?: boolean;
  onUpdateConfig?: (patch: Partial<BlockConfig>) => void;
  onUpdateProjectData?: (patch: Partial<ProjectData>) => void;
  onStartEditing?: () => void;
}

/** El punto del módulo (o null si faltan datos) y cómo se escribe */
export function mapPoint(block: BlockConfig, data: ProjectData) {
  const geo = block.mapCoordMode === 'geo';
  const a = parseNum(resolveVars(block.mapEast || '', data));
  const b = parseNum(resolveVars(block.mapNorth || '', data));
  if (a == null || b == null) return null;
  if (geo) {
    if (Math.abs(b) > 90 || Math.abs(a) > 180) return null;
    return { p: { lat: b, lon: a }, east: a, north: b };
  }
  if (a < 100000 || a > 900000 || b < 0 || b > 10000000) return null;
  const zone = block.mapZone || MAP_DEFAULTS.zone;
  return { p: utmToLatLon(a, b, zone, block.mapSouth !== false), east: a, north: b };
}

const fmtM = (n: number) => n.toLocaleString('es-PY', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const fmtLen = (m: number) => (m >= 1000 ? `${m / 1000} km` : `${m} m`);

export const MapBlock: React.FC<Props> = ({ block, data, numberIndex, label, isEditing = false, onUpdateConfig, onUpdateProjectData, onStartEditing }) => {
  const style: MapStyle = block.mapStyle && MAP_STYLES[block.mapStyle] ? block.mapStyle : 'osm';
  const src = MAP_STYLES[style];
  const zoom = Math.min(src.max, Math.max(2, block.mapZoom ?? MAP_DEFAULTS.zoom));
  const heightMm = block.mapHeightMm ?? MAP_DEFAULTS.heightMm;
  const hd = block.mapHd !== false;
  const caption = block.mapCaption ?? '';
  const geoMode = block.mapCoordMode === 'geo';
  const pt = useMemo(() => mapPoint(block, data), [block, data]);
  const center: LatLon | null = block.mapCenter ?? pt?.p ?? null;
  const markLabel = resolveVars(block.mapLabel ?? '', data);

  // Ancho real del recuadro (px de pantalla, sin el zoom de la vista)
  const boxRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.offsetWidth));
    ro.observe(el);
    setW(el.offsetWidth);
    return () => ro.disconnect();
  }, []);
  const h = Math.round(heightMm * PX_MM);

  // Arrastre para mover el mapa (solo editando)
  const [drag, setDrag] = useState<{ x: number; y: number; dx: number; dy: number; k: number } | null>(null);
  const [failed, setFailed] = useState(0);
  useEffect(() => setFailed(0), [style, zoom]);

  // Teselas: con "alta definición" se piden las del zoom siguiente a la mitad de tamaño (doble de detalle al imprimir)
  const tz = Math.min(src.max, hd ? zoom + 1 : zoom);
  const f = 2 ** (zoom - tz); // tamaño en pantalla de cada píxel de tesela
  const tileSize = TILE * f;
  const layout = useMemo(() => {
    if (!center || !w) return null;
    const c = project(center, tz);
    const cx = c.x * f - (drag?.dx ?? 0), cy = c.y * f - (drag?.dy ?? 0);
    const left = cx - w / 2, top = cy - h / 2;
    const x0 = Math.floor(left / tileSize), x1 = Math.floor((left + w) / tileSize);
    const y0 = Math.max(0, Math.floor(top / tileSize)), y1 = Math.min(2 ** tz - 1, Math.floor((top + h) / tileSize));
    const tiles: { k: string; x: number; y: number; tx: number; ty: number }[] = [];
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) tiles.push({ k: `${tz}/${tx}/${ty}`, tx, ty, x: tx * tileSize - left, y: ty * tileSize - top });
    let mark: { x: number; y: number } | null = null;
    if (pt) { const m = project(pt.p, tz); mark = { x: m.x * f - left, y: m.y * f - top }; }
    return { tiles, mark, left, top };
  }, [center, w, h, tz, f, tileSize, drag, pt]);

  const scale = useMemo(() => {
    if (!center) return null;
    const mpp = metersPerPx(center.lat, zoom); // metros por px de pantalla
    const len = niceLength(25 * PX_MM * mpp);
    return { len, px: len / mpp };
  }, [center, zoom]);

  const set = (patch: Partial<BlockConfig>) => onUpdateConfig?.(patch);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isEditing || !center || e.button !== 0) return;
    const el = boxRef.current!;
    const k = el.offsetWidth / (el.getBoundingClientRect().width || 1);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDrag({ x: e.clientX, y: e.clientY, dx: 0, dy: 0, k });
    e.stopPropagation();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    setDrag({ ...drag, dx: (e.clientX - drag.x) * drag.k, dy: (e.clientY - drag.y) * drag.k });
  };
  const onPointerUp = () => {
    if (!drag || !center) { setDrag(null); return; }
    if (Math.abs(drag.dx) + Math.abs(drag.dy) > 2) {
      const c = project(center, tz);
      set({ mapCenter: unproject(c.x - drag.dx / f, c.y - drag.dy / f, tz) });
    }
    setDrag(null);
  };

  // Campos del informe que se pueden usar como coordenadas
  const fields = data.fields || [];
  const suggestions = varList(data).filter((v) => v.custom);
  const isRef = (s?: string) => /^\s*\{\w+\}\s*$/.test(s || '');
  const saveAsFields = () => {
    if (!onUpdateProjectData) return;
    const list: ReportField[] = [...fields];
    const patch: Partial<BlockConfig> = {};
    const mk = (labelTxt: string, raw: string | undefined, key: 'mapEast' | 'mapNorth') => {
      if (isRef(raw)) return;
      const f2 = newField(labelTxt, raw || '', list);
      list.push(f2);
      patch[key] = `{${f2.key}}`;
    };
    mk(geoMode ? 'Longitud' : 'Este SIRGAS', block.mapEast, 'mapEast');
    mk(geoMode ? 'Latitud' : 'Norte SIRGAS', block.mapNorth, 'mapNorth');
    if (list.length !== fields.length) { onUpdateProjectData({ fields: list }); set(patch); }
  };

  const showCap = isEditing || !!label || !!stripRefTags(caption);
  const zone = pt && geoMode ? utmZoneOf(pt.p.lon) : block.mapZone || MAP_DEFAULTS.zone;

  return (
    <div className="rp-map-block relative px-5 py-2">
      <SectionHeaderBanner
        numberIndex={numberIndex}
        title={block.title}
        isEditing={isEditing}
        showTitle={block.showTitle ?? true}
        onUpdateTitle={(t) => set({ title: t })}
        onToggleShowTitle={() => set({ showTitle: !(block.showTitle ?? true) })}
        onStartEditing={onStartEditing}
      />

      <figure className="rp-map">
        <div
          ref={boxRef}
          className={`rp-map-box${isEditing ? ' is-editing' : ''}${drag ? ' is-dragging' : ''}`}
          style={{ height: `${heightMm}mm` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDrag(null)}
        >
          {layout ? (
            <>
              {layout.tiles.map((t) => (
                <React.Fragment key={t.k}>
                  <img
                    className="rp-map-tile"
                    src={tileUrl(src.url, tz, t.tx, t.ty)}
                    crossOrigin="anonymous"
                    alt=""
                    draggable={false}
                    style={{ left: t.x, top: t.y, width: tileSize, height: tileSize }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; setFailed((n) => n + 1); }}
                  />
                  {src.overlay && (
                    <img className="rp-map-tile" src={tileUrl(src.overlay, tz, t.tx, t.ty)} crossOrigin="anonymous" alt="" draggable={false}
                      style={{ left: t.x, top: t.y, width: tileSize, height: tileSize }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                  )}
                </React.Fragment>
              ))}
              {layout.mark && (
                <div className="rp-map-mark" style={{ left: layout.mark.x, top: layout.mark.y }}>
                  <svg viewBox="0 0 24 34" aria-hidden>
                    <path d="M12 33C12 33 2 19.5 2 12a10 10 0 0 1 20 0c0 7.5-10 21-10 21Z" />
                    <circle cx="12" cy="12" r="4.2" />
                  </svg>
                  {markLabel && <span className="rp-map-mark-label">{markLabel}</span>}
                </div>
              )}
              {block.mapShowNorth !== false && (
                <svg className="rp-map-north" viewBox="0 0 20 28" aria-label="Norte">
                  <path d="M10 2 17 22 10 18 3 22Z" className="n-l" />
                  <path d="M10 2 10 18 3 22Z" className="n-d" />
                  <text x="10" y="27.5" textAnchor="middle">N</text>
                </svg>
              )}
              {block.mapShowScale !== false && scale && (
                <div className="rp-map-scale">
                  <span className="rp-map-scale-bar" style={{ width: scale.px }} />
                  <span>{fmtLen(scale.len)}</span>
                </div>
              )}
              {block.mapShowCoords !== false && pt && (
                <div className="rp-map-coords">
                  {!geoMode && <b>SIRGAS 2000 / UTM {zone}{block.mapSouth !== false ? 'S' : 'N'}</b>}
                  {!geoMode && <span>E {fmtM(pt.east)} · N {fmtM(pt.north)}</span>}
                  <span>{fmtDms(pt.p.lat, 'N', 'S')} · {fmtDms(pt.p.lon, 'E', 'O')}</span>
                </div>
              )}
              <div className="rp-map-attr">{src.attribution}</div>
              {failed > 0 && failed >= layout.tiles.length && (
                <div className="rp-map-msg no-print">No se pudo cargar el mapa (¿sin conexión?). Se vuelve a intentar al cambiar el zoom o el estilo.</div>
              )}
              {isEditing && (
                <div className="rp-map-ctl no-print" onPointerDown={(e) => e.stopPropagation()}>
                  <button type="button" title="Acercar" onClick={() => set({ mapZoom: Math.min(src.max, zoom + 1) })}><Plus /></button>
                  <button type="button" title="Alejar" onClick={() => set({ mapZoom: Math.max(2, zoom - 1) })}><Minus /></button>
                  {block.mapCenter && pt && (
                    <button type="button" title="Volver a centrar en el punto" onClick={() => set({ mapCenter: undefined })}><Crosshair /></button>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="rp-map-empty" onDoubleClick={onStartEditing}>
              <MapPin />
              <span>{isEditing ? 'Escribí las coordenadas en el panel de edición (Este y Norte, o un campo como {este_sirgas})' : 'Doble clic para cargar las coordenadas del punto'}</span>
            </div>
          )}
        </div>
        {showCap && (
          <figcaption className="rp-caption rp-map-caption">
            {label && <b className="rp-map-label">{label}</b>}
            {label && (stripRefTags(caption) || isEditing) ? ' - ' : ''}
            <EditableCell
              value={isEditing ? caption : stripRefTags(resolveVars(caption, data))}
              onCommit={(v) => set({ mapCaption: v })}
              isEditing={isEditing}
              row={0}
              col={0}
              placeholder="Pie del mapa (p. ej. Croquis de localización)"
              className="rp-map-capcell"
            />
          </figcaption>
        )}
      </figure>

      {isEditing && (
        <EditDock slot="options">
          <DockGroup label="Coordenadas">
            <DockSegmented
              value={geoMode ? 'geo' : 'utm'}
              options={[{ value: 'utm', label: 'UTM' }, { value: 'geo', label: 'Lat / Lon' }]}
              onChange={(v) => set({ mapCoordMode: v as 'utm' | 'geo', mapCenter: undefined })}
            />
          </DockGroup>
          <label className="dock-group" title="Número o campo del informe, p. ej. {este_sirgas}">
            <span className="dock-label">{geoMode ? 'Longitud' : 'Este (X)'}</span>
            <input type="text" className="dock-input rp-map-in" list="rp-map-fields" value={block.mapEast ?? ''}
              placeholder={geoMode ? '-54,5891' : '744 123,45'} onChange={(e) => set({ mapEast: e.target.value, mapCenter: undefined })} />
          </label>
          <label className="dock-group" title="Número o campo del informe, p. ej. {norte_sirgas}">
            <span className="dock-label">{geoMode ? 'Latitud' : 'Norte (Y)'}</span>
            <input type="text" className="dock-input rp-map-in" list="rp-map-fields" value={block.mapNorth ?? ''}
              placeholder={geoMode ? '-25,4083' : '7 186 512,30'} onChange={(e) => set({ mapNorth: e.target.value, mapCenter: undefined })} />
          </label>
          <datalist id="rp-map-fields">
            {suggestions.map((v) => <option key={v.key} value={`{${v.key}}`}>{v.label}: {v.value}</option>)}
          </datalist>
          {!geoMode && (
            <label className="dock-group" title="Zona UTM (Paraguay y el este de Argentina: 21; oeste de Paraguay: 20)">
              <span className="dock-label">Zona</span>
              <input type="number" min={1} max={60} className="dock-input" style={{ width: 48 }} value={block.mapZone ?? MAP_DEFAULTS.zone}
                onChange={(e) => set({ mapZone: Math.min(60, Math.max(1, Number(e.target.value) || MAP_DEFAULTS.zone)), mapCenter: undefined })} />
              <DockSegmented
                value={block.mapSouth === false ? 'N' : 'S'}
                options={[{ value: 'S', label: 'Sur' }, { value: 'N', label: 'Norte' }]}
                onChange={(v) => set({ mapSouth: v === 'S', mapCenter: undefined })}
              />
            </label>
          )}
          {onUpdateProjectData && (!isRef(block.mapEast) || !isRef(block.mapNorth)) && (block.mapEast || block.mapNorth) && (
            <DockButton onClick={saveAsFields} title="Crea campos del informe con estas coordenadas y los usa acá: así se pueden mostrar también en textos, tablas y el encabezado con {este_sirgas}">
              <Braces /> Guardar como campos
            </DockButton>
          )}
          <span className="dock-label rp-map-readout">
            {pt ? `${fmtDms(pt.p.lat, 'N', 'S')} · ${fmtDms(pt.p.lon, 'E', 'O')}` : 'Sin punto: faltan coordenadas válidas'}
          </span>
          <label className="dock-group" title="Texto junto al marcador; puede usar campos, p. ej. {vertice}">
            <span className="dock-label">Etiqueta</span>
            <input type="text" className="dock-input" list="rp-map-labels" value={block.mapLabel ?? ''} placeholder="sin etiqueta"
              onChange={(e) => set({ mapLabel: e.target.value })} />
            <datalist id="rp-map-labels">
              {suggestions.map((v) => <option key={v.key} value={`{${v.key}}`}>{v.label}: {v.value}</option>)}
            </datalist>
          </label>
          <DockGroup label="Mapa">
            <DockSegmented
              value={style}
              options={(Object.keys(MAP_STYLES) as MapStyle[]).map((k) => ({ value: k, label: MAP_STYLES[k].label }))}
              onChange={(v) => set({ mapStyle: v as MapStyle, mapZoom: Math.min(MAP_STYLES[v as MapStyle].max, zoom) })}
            />
          </DockGroup>
          <DockSlider label="Zoom" value={zoom} min={2} max={src.max} step={1} onChange={(v) => set({ mapZoom: v })} />
          <DockSlider label="Alto" value={heightMm} min={30} max={220} step={1} unit="mm" onChange={(v) => set({ mapHeightMm: v })} />
          <DockCheck label="Coordenadas" checked={block.mapShowCoords !== false} onChange={() => set({ mapShowCoords: block.mapShowCoords === false })} />
          <DockCheck label="Escala" checked={block.mapShowScale !== false} onChange={() => set({ mapShowScale: block.mapShowScale === false })} />
          <DockCheck label="Norte" checked={block.mapShowNorth !== false} onChange={() => set({ mapShowNorth: block.mapShowNorth === false })} />
          <DockCheck label="Alta definición" checked={hd} onChange={() => set({ mapHd: !hd })} />
          {block.mapCenter && (
            <DockButton onClick={() => set({ mapCenter: undefined })} title="El punto vuelve al centro del mapa"><Crosshair /> Centrar</DockButton>
          )}
          <label className="dock-group" title="Numera el mapa junto con fotos y figuras del mismo prefijo. Vacío = sin número.">
            <span className="dock-label">Numerar como</span>
            <input type="text" list="map-prefix-suggestions" value={block.mapPrefix ?? ''} placeholder="sin numerar"
              onChange={(e) => set({ mapPrefix: e.target.value })} className="dock-input" />
            <datalist id="map-prefix-suggestions">
              {['Figura', 'Croquis', 'Mapa', ...PHOTO_PREFIX_SUGGESTIONS].filter((v, i, a) => a.indexOf(v) === i).map((x) => <option key={x} value={x} />)}
            </datalist>
          </label>
        </EditDock>
      )}
      {isEditing && (
        <EditDock slot="hint">
          <span>Arrastrá el mapa para encuadrarlo · el marcador queda en el punto</span>
        </EditDock>
      )}
    </div>
  );
};
