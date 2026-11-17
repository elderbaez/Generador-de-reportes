import { useEffect, useMemo, useState } from 'react';
import type { DocItem, MarkupItem } from '../types';
import { itemCrop, renderItemImage } from './pdf';

/* =====================================================================
   Lupa nítida.
   Antes el callout ampliaba la imagen entera del fragmento, que está
   dibujada a la resolución de la hoja: al multiplicarla ×3…×8 se veían
   los píxeles. Ahora cada lupa pide SOLO su zona, dibujada al tamaño del
   callout (un PDF se vuelve a dibujar en vector a esa escala; una imagen
   usa sus píxeles originales, sin el achique de la hoja).
   ===================================================================== */

/** Zona dibujada aparte, con la parte del fragmento que cubre (0…1). */
export interface ZoneImg { url: string; x: number; y: number; w: number; h: number }

const c01 = (v: number) => Math.max(0, Math.min(1, v));

/** Zona de la lupa dentro del fragmento (0…1), recortada a sus bordes. */
export function zoneRegion(it: MarkupItem) {
  const x0 = c01(Math.min(it.x1, it.x2)), x1 = c01(Math.max(it.x1, it.x2));
  const y0 = c01(Math.min(it.y1, it.y2)), y1 = c01(Math.max(it.y1, it.y2));
  if (x1 - x0 < 1e-4 || y1 - y0 < 1e-4) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** ¿La imagen guardada sigue correspondiendo a la zona actual? (al mover la lupa cambia) */
export const zoneMatches = (z: ZoneImg | undefined, it: MarkupItem) => {
  const r = zoneRegion(it);
  return !!z && !!r && Math.abs(z.x - r.x) < 1e-3 && Math.abs(z.y - r.y) < 1e-3
    && Math.abs(z.w - r.w) < 1e-3 && Math.abs(z.h - r.h) < 1e-3;
};

/**
 * Imágenes nítidas de las zonas de lupa de un fragmento.
 * @param unitPx ancho en px de pantalla de TODO el fragmento a escala 1
 *               (se multiplica por el zoom de cada lupa y por `density`).
 * @param density píxeles por px de pantalla (≈ 220 ppp / 96 para imprimir).
 */
export function useZoneImages(
  item: DocItem, markup: MarkupItem[] | undefined, unitPx: number, density: number, enabled = true,
): Record<string, ZoneImg> {
  const [out, setOut] = useState<Record<string, ZoneImg>>({});
  const crop = itemCrop(item);

  // Un pedido por lupa; la clave cambia sólo si cambia la zona o la resolución necesaria
  const jobs = useMemo(() => {
    if (!enabled) return [];
    return (markup || []).filter((m) => m.kind === 'magnifier').flatMap((m) => {
      const r = zoneRegion(m);
      if (!r) return [];
      const zoom = Math.max(1.2, Math.min(8, m.magnifier?.zoom ?? 3));
      const target = Math.min(4096, Math.max(200, r.w * unitPx * zoom * density));
      const bucket = Math.ceil(target / 200) * 200;
      return [{ id: m.id, r, bucket, key: `${m.id}|${r.x.toFixed(4)}|${r.y.toFixed(4)}|${r.w.toFixed(4)}|${r.h.toFixed(4)}|${bucket}` }];
    });
  }, [enabled, markup, unitPx, density]);
  const sig = jobs.map((j) => j.key).join(';') + `|${item.id}|${item.src.length}|${item.rotation || 0}|${crop.x}|${crop.y}|${crop.w}|${crop.h}`;

  useEffect(() => {
    if (!jobs.length) { setOut((o) => (Object.keys(o).length ? {} : o)); return; }
    let off = false;
    // Pequeña espera: mientras se arrastra la lupa no se dibuja en cada cuadro
    const t = setTimeout(() => {
      jobs.forEach((j) => {
        // La zona, expresada en el recorte del fragmento → recorte del original
        const sub = { x: crop.x + j.r.x * crop.w, y: crop.y + j.r.y * crop.h, w: j.r.w * crop.w, h: j.r.h * crop.h };
        renderItemImage({ ...item, crop: sub }, j.bucket)
          .then((url) => { if (!off) setOut((o) => ({ ...o, [j.id]: { url, ...j.r } })); })
          .catch(() => undefined);
      });
    }, 160);
    return () => { off = true; clearTimeout(t); };
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  return out;
}
