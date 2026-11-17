/* =====================================================================
   Coordenadas para el módulo Mapa.
   - UTM (SIRGAS 2000 / WGS84; mismo elipsoide a efectos de un mapa) → lat/lon.
   - Mosaico Web Mercator (teselas de 256 px) y escala en metros.
   ===================================================================== */

export interface LatLon { lat: number; lon: number }

/** Elipsoide GRS80 (SIRGAS 2000). WGS84 difiere en menos de 0,1 mm. */
const A = 6378137;
const F = 1 / 298.257222101;
const K0 = 0.9996;

/** UTM → latitud/longitud (grados). south = hemisferio sur (falso norte 10 000 000). */
export function utmToLatLon(east: number, north: number, zone: number, south: boolean): LatLon {
  const e2 = F * (2 - F);
  const ep2 = e2 / (1 - e2);
  const x = east - 500000;
  const y = south ? north - 10000000 : north;
  const lon0 = ((zone - 1) * 6 - 180 + 3) * (Math.PI / 180);

  const M = y / K0;
  const mu = M / (A * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const phi1 = mu
    + ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu)
    + ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu)
    + ((151 * e1 ** 3) / 96) * Math.sin(6 * mu)
    + ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);

  const s = Math.sin(phi1), c = Math.cos(phi1), t = Math.tan(phi1);
  const N1 = A / Math.sqrt(1 - e2 * s * s);
  const T1 = t * t;
  const C1 = ep2 * c * c;
  const R1 = (A * (1 - e2)) / Math.pow(1 - e2 * s * s, 1.5);
  const D = x / (N1 * K0);

  const lat = phi1 - ((N1 * t) / R1) * (
    (D * D) / 2
    - ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4) / 24
    + ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6) / 720
  );
  const lon = lon0 + (
    D
    - ((1 + 2 * T1 + C1) * D ** 3) / 6
    + ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5) / 120
  ) / c;
  return { lat: (lat * 180) / Math.PI, lon: (lon * 180) / Math.PI };
}

/** Zona UTM de una longitud */
export const utmZoneOf = (lon: number) => Math.min(60, Math.max(1, Math.floor((lon + 180) / 6) + 1));

/** Número escrito a la manera de cada uno: "7.183.456,78", "7 183 456.78", "7183456,78" */
export function parseNum(raw: string | number | undefined | null): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  let s = String(raw).trim().replace(/[\s '’]/g, '').replace(/[^\d.,+-]/g, '');
  if (!s) return null;
  const lastC = s.lastIndexOf(','), lastD = s.lastIndexOf('.');
  if (lastC >= 0 && lastD >= 0) {
    // El último separador es el decimal
    s = lastC > lastD ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastC >= 0) {
    s = (s.match(/,/g)!.length > 1) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Grados en "25°24'31,2" S" */
export function fmtDms(v: number, pos: string, neg: string): string {
  const h = v < 0 ? neg : pos;
  let a = Math.abs(v);
  let d = Math.floor(a); a = (a - d) * 60;
  let m = Math.floor(a); let s = Math.round((a - m) * 600) / 10;
  if (s >= 60) { s = 0; m++; }
  if (m >= 60) { m = 0; d++; }
  return `${d}°${String(m).padStart(2, '0')}'${s.toFixed(1).replace('.', ',').padStart(4, '0')}" ${h}`;
}

/* ---------- Web Mercator ---------- */
export const TILE = 256;
export const worldPx = (z: number) => TILE * 2 ** z;
export function project(p: LatLon, z: number) {
  const lat = Math.max(-85.0511, Math.min(85.0511, p.lat));
  const s = Math.sin((lat * Math.PI) / 180);
  const W = worldPx(z);
  return { x: ((p.lon + 180) / 360) * W, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * W };
}
export function unproject(x: number, y: number, z: number): LatLon {
  const W = worldPx(z);
  const lon = (x / W) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / W;
  return { lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))), lon };
}
/** Metros por píxel de tesela a esa latitud y zoom */
export const metersPerPx = (lat: number, z: number) => (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;

/** Largo "redondo" para la barra de escala: 1, 2, 5 × 10^n que no pase de max */
export function niceLength(max: number): number {
  const p = 10 ** Math.floor(Math.log10(max));
  for (const k of [5, 2, 1]) if (k * p <= max) return k * p;
  return p;
}

/* ---------- Fuentes de teselas ---------- */
export type MapStyle = 'osm' | 'sat' | 'hybrid' | 'topo';
export interface TileSource { url: string; max: number; attribution: string; overlay?: string }
export const MAP_STYLES: Record<MapStyle, TileSource & { label: string }> = {
  osm: { label: 'Calles', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', max: 19, attribution: '© colaboradores de OpenStreetMap' },
  sat: { label: 'Satélite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', max: 19, attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics' },
  hybrid: {
    label: 'Satélite + nombres',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    overlay: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    max: 19,
    attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics',
  },
  topo: { label: 'Topográfico', url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png', max: 17, attribution: '© OpenStreetMap · © OpenTopoMap (CC-BY-SA)' },
};
export const tileUrl = (tpl: string, z: number, x: number, y: number) => {
  const n = 2 ** z;
  const xx = ((x % n) + n) % n;
  return tpl.replace('{z}', String(z)).replace('{x}', String(xx)).replace('{y}', String(y));
};
