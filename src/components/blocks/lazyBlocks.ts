import { lazy } from 'react';

/**
 * Bloques pesados que se cargan bajo demanda. `preloadBlocks()` los descarga todos
 * (se llama al arrancar y antes de imprimir) para que el PDF nunca capture un
 * bloque que todavía no terminó de cargar.
 */
const loaders = {
  gantt: () => import('./GanttBlock'),
  map: () => import('./MapBlock'),
  scurve: () => import('./SCurveBlock'),
  weather: () => import('./WeatherBlock'),
  metrics: () => import('./ContractMetricsBlock'),
  situation: () => import('./SituationBlock'),
};

export const GanttBlock = lazy(() => loaders.gantt().then((m) => ({ default: m.GanttBlock })));
export const MapBlock = lazy(() => loaders.map().then((m) => ({ default: m.MapBlock })));
export const SCurveBlock = lazy(() => loaders.scurve().then((m) => ({ default: m.SCurveBlock })));
export const WeatherBlock = lazy(() => loaders.weather().then((m) => ({ default: m.WeatherBlock })));
export const ContractMetricsBlock = lazy(() => loaders.metrics().then((m) => ({ default: m.ContractMetricsBlock })));
export const SituationBlock = lazy(() => loaders.situation().then((m) => ({ default: m.SituationBlock })));

export function preloadBlocks(): Promise<unknown> {
  return Promise.all(Object.values(loaders).map((l) => l().catch(() => undefined)));
}
