import React from 'react';
import { MarkupItem } from '../types';
import { MarkupShape, markupZOrder } from './DocMarkupShape';
import type { ZoneImg } from '../utils/magnify';

/**
 * Anotaciones vectoriales sobre un fragmento de documento, tal como salen
 * impresas. No interactivo.
 *
 * El lienzo puede ser mayor que el papel: los callouts de lupa pueden salirse
 * y el bloque reserva ese margen (ver `docOutset`). Por eso el viewBox arranca
 * en negativo: el (0,0) del dibujo es la esquina del PAPEL, no del lienzo.
 *
 * Va montado como hermano de `.rp-doc-paper`, ocupando también el margen
 * reservado, para que el callout que se sale tenga dónde dibujarse.
 *
 * Sin filtros SVG: un feDropShadow hace que Chrome imprima la marca como
 * imagen (verificado). En su lugar cada trazo lleva un halo blanco, que es
 * vector puro y separa igual la marca del plano.
 */
export const DocAnnotationOverlay: React.FC<{
  markup: MarkupItem[];
  /** Tamaño del papel, en px. */
  width: number;
  height: number;
  /** Margen reservado alrededor, como fracción de width/height. */
  outset?: { t: number; r: number; b: number; l: number };
  /** Imagen del fragmento: la necesita la lupa para ampliar. */
  src?: string;
  /** Zonas de lupa nítidas (ver utils/magnify). */
  zones?: Record<string, ZoneImg>;
  uid: string;
}> = ({ markup, width: W, height: H, outset, src, zones, uid }) => {
  if (!markup.length) return null;
  const o = outset || { t: 0, r: 0, b: 0, l: 0 };
  const padL = o.l * W, padT = o.t * H;
  const boxW = W * (1 + o.l + o.r), boxH = H * (1 + o.t + o.b);

  return (
    <svg
      className="rp-doc-annotation-overlay"
      viewBox={`${-padL} ${-padT} ${boxW} ${boxH}`}
      style={{ position: 'absolute', left: 0, top: 0, width: boxW, height: boxH }}
      aria-hidden
    >
      {[...markup]
        .sort((a, b) => markupZOrder(a.kind) - markupZOrder(b.kind))
        .map((it) => (
          <MarkupShape key={it.id} it={it} W={W} H={H} halo src={src} zones={zones} uid={uid} />
        ))}
    </svg>
  );
};
