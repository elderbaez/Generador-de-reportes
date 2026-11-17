import { WeatherCondition, WeatherLocation } from '../types';

/* =====================================================================
   Datos meteorológicos desde Open-Meteo (gratis, sin clave, permite pedidos
   desde el navegador). Se usan para completar la semana; los valores
   quedan editables en el informe.
   ===================================================================== */

export const WEATHER_SOURCE_NAME = 'Open-Meteo';

export interface GeoResult extends WeatherLocation { detail: string }

const strip = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

async function searchOpenMeteo(name: string): Promise<GeoResult[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=10&language=es&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`El buscador de lugares respondió ${res.status}`);
  const json = await res.json();
  return (json.results || []).map((r: any) => ({
    name: r.name,
    lat: r.latitude,
    lon: r.longitude,
    detail: [r.admin2, r.admin1, r.country].filter(Boolean).join(', '),
  }));
}

/** Respaldo para localidades chicas o escritas con más detalle (OpenStreetMap). */
async function searchNominatim(query: string): Promise<GeoResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&accept-language=es&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return [];
  const json = await res.json();
  return (json || []).map((r: any) => {
    const parts = String(r.display_name || '').split(',').map((x: string) => x.trim());
    return { name: r.name || parts[0], lat: Number(r.lat), lon: Number(r.lon), detail: parts.slice(1, 4).join(', ') };
  });
}

/**
 * Busca un lugar. Acepta "Ciudad", "Ciudad, País" o "Ciudad, Departamento":
 * el nombre se busca y lo que va después de la coma filtra los resultados.
 */
export async function searchPlaces(query: string): Promise<GeoResult[]> {
  const q = query.trim();
  if (!q) return [];
  const [name, ...rest] = q.split(',').map((x) => x.trim()).filter(Boolean);
  const filter = strip(rest.join(' '));
  let results = await searchOpenMeteo(name);
  if (!results.length && strip(name) !== name.toLowerCase()) results = await searchOpenMeteo(strip(name));
  if (filter) {
    const f = results.filter((r) => filter.split(/\s+/).every((w) => strip(r.detail).includes(w)));
    if (f.length) results = f;
  }
  if (!results.length) results = await searchNominatim(q).catch(() => []);
  return results;
}

/* ---------- Ubicación del equipo ---------- */

/** Pide la ubicación al navegador (muestra el aviso de permiso la primera vez). */
export function getBrowserPosition(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) { reject(new Error('Este navegador no permite conocer la ubicación.')); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => reject(new Error(
        e.code === 1 ? 'Permiso de ubicación denegado. Podés habilitarlo en el candado de la barra de direcciones o buscar la ciudad a mano.'
          : e.code === 3 ? 'La ubicación tardó demasiado. Probá de nuevo o buscá la ciudad a mano.'
            : 'No se pudo obtener la ubicación. Buscá la ciudad a mano.')),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

/** Nombre de la localidad para unas coordenadas (servicio gratuito pensado para usarse desde el navegador). */
export async function reverseGeocode(lat: number, lon: number): Promise<{ name: string; detail: string }> {
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=es`);
    if (res.ok) {
      const j = await res.json();
      const name = j.city || j.locality || j.principalSubdivision || '';
      if (name) return { name, detail: [j.principalSubdivision, j.countryName].filter((x: string) => x && x !== name).join(', ') };
    }
  } catch { /* sin nombre: se usan las coordenadas */ }
  return { name: `Mi ubicación (${lat.toFixed(3)}, ${lon.toFixed(3)})`, detail: '' };
}

export interface DailyWeather { date: string; condition: WeatherCondition; rainfallMm: number; tMax?: number; tMin?: number }

/** Código WMO del día + lluvia → condición del informe. */
export function wmoToCondition(code: number, precipMm: number): WeatherCondition {
  if ([95, 96, 99].includes(code)) return 'tormenta';
  const rainCode = (code >= 51 && code <= 67) || (code >= 80 && code <= 82);
  if (precipMm >= 10) return 'lluvia_fuerte';
  if (precipMm >= 0.5 || rainCode) return precipMm >= 10 || code === 65 || code === 82 ? 'lluvia_fuerte' : 'lluvia_debil';
  if (code === 0) return 'soleado';
  if (code === 1 || code === 2) return 'parcial';
  return 'nublado';
}

const daysAgo = (iso: string) => (Date.now() - new Date(`${iso}T12:00:00`).getTime()) / 86400000;

/** Clima diario entre dos fechas (aaaa-mm-dd), en la zona horaria del lugar. */
export async function fetchDailyWeather(loc: WeatherLocation, startIso: string, endIso: string): Promise<DailyWeather[]> {
  const params = `latitude=${loc.lat}&longitude=${loc.lon}&daily=weather_code,precipitation_sum,temperature_2m_max,temperature_2m_min&timezone=auto&start_date=${startIso}&end_date=${endIso}`;
  // Fechas recientes y próximas: servicio de pronóstico (guarda ~3 meses hacia atrás).
  // Fechas más viejas: archivo histórico (reanálisis ERA5, con unos días de demora).
  const urls = daysAgo(endIso) > 80
    ? [`https://archive-api.open-meteo.com/v1/archive?${params}`]
    : [`https://api.open-meteo.com/v1/forecast?${params}`, `https://archive-api.open-meteo.com/v1/archive?${params}`];
  let lastErr = '';
  for (const url of urls) {
    try {
      const res = await fetch(url);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.daily) { lastErr = json.reason || `respuesta ${res.status}`; continue; }
      const d = json.daily;
      return (d.time as string[]).map((date, i) => {
        const p = Number(d.precipitation_sum?.[i]) || 0;
        return {
          date,
          rainfallMm: Math.round(p * 10) / 10,
          condition: wmoToCondition(Number(d.weather_code?.[i]) || 0, p),
          tMax: d.temperature_2m_max?.[i] ?? undefined,
          tMin: d.temperature_2m_min?.[i] ?? undefined,
        };
      });
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(lastErr || 'sin datos');
}
