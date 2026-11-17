/* =====================================================================
   PDF del programa con partes en VECTOR (también en iPhone/iPad).

   La hoja se sigue dibujando como imagen (es lo que la hace salir igual en
   cualquier equipo), pero encima se agrega:
   - Los planos y documentos PDF insertados, como la página ORIGINAL
     incrustada (vector: líneas y textos del plano nítidos a cualquier
     ampliación). Se respeta el recorte, el giro y el borde rasgado. Las
     lupas sobre esos planos también salen en vector.
   - Una capa de texto invisible justo sobre cada renglón: el PDF se puede
     buscar (Ctrl+F), copiar y leer con lector de pantalla, como un escaneo
     con reconocimiento de texto.
   Usa pdf-lib (ya está en el proyecto para extraer páginas).
   ===================================================================== */
import type { DocItem, DocCrop, MarkupItem } from '../types';
import { itemCrop, dataUrlToBytes } from './pdf';
import { magGeom } from './markup';
import { zoneRegion } from './magnify';

type Lib = typeof import('pdf-lib');
type OutDoc = import('pdf-lib').PDFDocument;
type OutPage = import('pdf-lib').PDFPage;
type OutFont = import('pdf-lib').PDFFont;
type Embedded = import('pdf-lib').PDFEmbeddedPage;

/* ---------- Registro de documentos de la hoja ----------
   La hoja sólo tiene <figure data-doc-item="id">; el bloque de documentos
   anota acá cada elemento para que la exportación sepa qué PDF es. */
const registry = new Map<string, DocItem>();
export const registerDocItem = (it: DocItem) => { registry.set(it.id, it); };

/* ---------- Geometría ---------- */
interface Rect { x: number; y: number; w: number; h: number }
const normRot = (r: number) => (((Math.round(r / 90) * 90) % 360) + 360) % 360;

/**
 * Matriz que dibuja la página incrustada (forma de fw × fh, sin girar) de modo que
 * la parte `c` (0…1, como se VE: ya girada, y hacia abajo) caiga en `t` (puntos, y hacia arriba).
 */
function placeMatrix(fw: number, fh: number, rot: number, c: DocCrop, t: Rect): [number, number, number, number, number, number] {
  // Rectángulo que ocuparía la página entera
  const FW = t.w / c.w, FH = t.h / c.h;
  const x0 = t.x - c.x * FW;
  const y0 = t.y + t.h + c.y * FH - FH;
  switch (rot) {
    case 90: { const sx = FW / fh, sy = FH / fw; return [0, -sy, sx, 0, x0, y0 + sy * fw]; }
    case 180: { const sx = FW / fw, sy = FH / fh; return [-sx, 0, 0, -sy, x0 + sx * fw, y0 + sy * fh]; }
    case 270: { const sx = FW / fh, sy = FH / fw; return [0, sy, -sx, 0, x0 + sx * fh, y0]; }
    default: return [FW / fw, 0, 0, FH / fh, x0, y0];
  }
}

/** Puntos de un clip-path: polygon(…) en % o px de la caja del elemento */
function parsePolygon(css: string, box: Rect): [number, number][] | null {
  const m = /polygon\(([^)]*)\)/.exec(css || '');
  if (!m) return null;
  const val = (s: string, tot: number) => (s.endsWith('%') ? (parseFloat(s) / 100) * tot : parseFloat(s));
  const pts = m[1].split(',').map((p) => p.trim().split(/\s+/)).filter((p) => p.length >= 2)
    .map(([a, b]) => [box.x + val(a, box.w), box.y + val(b, box.h)] as [number, number]);
  return pts.length >= 3 ? pts : null;
}

/* ---------- Lo que se prepara por hoja ---------- */
export interface VecDoc {
  item: DocItem;
  emb: Embedded;
  fw: number; fh: number; rot: number;
  img: HTMLElement;
  overlay: SVGSVGElement | null;
  /** En px de la hoja (sin zoom), relativos a la hoja */
  imgBox: Rect;
  clip: [number, number][] | null;
  overlayBox: Rect | null;
}

export class VectorPdf {
  private srcCache = new Map<string, Promise<{ emb: Embedded; fw: number; fh: number; rot: number } | null>>();
  private names = new WeakMap<OutPage, Map<string, import('pdf-lib').PDFName>>();
  private charset: Set<number>;
  private fontKey = new WeakMap<OutPage, import('pdf-lib').PDFName>();

  private constructor(public lib: Lib, public doc: OutDoc, private font: OutFont) {
    this.charset = new Set(font.getCharacterSet());
  }

  static async create(): Promise<VectorPdf | null> {
    try {
      const lib = await import('pdf-lib');
      const doc = await lib.PDFDocument.create({ updateMetadata: false });
      const font = await doc.embedFont(lib.StandardFonts.Helvetica);
      return new VectorPdf(lib, doc, font);
    } catch (e) {
      console.warn('PDF del programa: sin pdf-lib, todo sale como imagen.', e);
      return null;
    }
  }

  /** La página original de un documento PDF, incrustada una sola vez (aunque tenga lupas) */
  private embedItem(item: DocItem) {
    const key = `${item.id}|${item.src.length}`;
    let p = this.srcCache.get(key);
    if (!p) {
      p = (async () => {
        try {
          const src = await this.lib.PDFDocument.load(dataUrlToBytes(item.src), { ignoreEncryption: true, updateMetadata: false });
          const page = src.getPage(0);
          const cb = page.getCropBox();
          const emb = await this.doc.embedPage(page, { left: cb.x, bottom: cb.y, right: cb.x + cb.width, top: cb.y + cb.height });
          return { emb, fw: cb.width, fh: cb.height, rot: normRot(page.getRotation().angle) };
        } catch (e) {
          console.warn('No se pudo incrustar el plano en vector; va como imagen.', e);
          return null;
        }
      })();
      this.srcCache.set(key, p);
    }
    return p;
  }

  /** Busca en la hoja los documentos PDF que pueden ir en vector */
  async prepare(sheet: HTMLElement): Promise<VecDoc[]> {
    const sr = sheet.getBoundingClientRect();
    const s = sr.width / (sheet.offsetWidth || sr.width); // zoom de la vista
    const rel = (r: DOMRect): Rect => ({ x: (r.left - sr.left) / s, y: (r.top - sr.top) / s, w: r.width / s, h: r.height / s });
    const out: VecDoc[] = [];
    for (const fig of Array.from(sheet.querySelectorAll<HTMLElement>('figure[data-doc-item]'))) {
      const item = registry.get(fig.dataset.docItem || '');
      const img = fig.querySelector<HTMLElement>('.rp-doc-clip .rp-doc-img');
      if (!item || item.kind !== 'pdf' || !img) continue;
      const e = await this.embedItem(item);
      if (!e) continue;
      const clipEl = fig.querySelector<HTMLElement>('.rp-doc-clip');
      const overlay = fig.querySelector<SVGSVGElement>('svg.rp-doc-annotation-overlay');
      const clipBox = clipEl ? rel(clipEl.getBoundingClientRect()) : null;
      out.push({
        item, ...e, img, overlay,
        imgBox: rel(img.getBoundingClientRect()),
        clip: clipEl && clipBox ? parsePolygon(clipEl.style.clipPath || getComputedStyle(clipEl).clipPath, clipBox) : null,
        overlayBox: overlay ? rel(overlay.getBoundingClientRect()) : null,
      });
    }
    return out;
  }

  /** Oculta en la hoja lo que se va a dibujar en vector (y lo vuelve a mostrar) */
  static hide(vec: VecDoc[], what: 'sheet' | 'overlay'): () => void {
    const els: { el: Element & { style: CSSStyleDeclaration }; v: string }[] = [];
    const hideEl = (el: Element | null) => {
      if (!el) return;
      const h = el as Element & { style: CSSStyleDeclaration };
      els.push({ el: h, v: h.style.visibility });
      h.style.visibility = 'hidden';
    };
    for (const v of vec) {
      if (what === 'sheet') { hideEl(v.img); hideEl(v.overlay); }
      else v.overlay?.querySelectorAll('.rp-mag-bg, .rp-mag-img').forEach(hideEl);
    }
    return () => { for (const { el, v } of els) el.style.visibility = v; };
  }

  private xName(page: OutPage, emb: Embedded) {
    let m = this.names.get(page);
    if (!m) { m = new Map(); this.names.set(page, m); }
    const k = String(emb.ref);
    let n = m.get(k);
    if (!n) { n = page.node.newXObject('Plano', emb.ref); m.set(k, n); }
    return n;
  }

  /** Dibuja los planos (y sus lupas) en vector. `k` = puntos por px de la hoja; H = alto en puntos. */
  drawDocs(page: OutPage, vec: VecDoc[], k: number, H: number) {
    const L = this.lib;
    const P = (x: number, y: number) => [x * k, H - y * k] as [number, number];
    const rectPt = (r: Rect): Rect => ({ x: r.x * k, y: H - (r.y + r.h) * k, w: r.w * k, h: r.h * k });
    const pathPoly = (pts: [number, number][]) => {
      const ops = [L.moveTo(...P(...pts[0]))];
      for (const p of pts.slice(1)) ops.push(L.lineTo(...P(...p)));
      ops.push(L.closePath());
      return ops;
    };
    const pathRect = (r: Rect) => { const t = rectPt(r); return [L.rectangle(t.x, t.y, t.w, t.h)]; };
    const pathCircle = (cx: number, cy: number, r: number) => {
      const [x, y] = P(cx, cy); const R = r * k, c = R * 0.5523;
      return [
        L.moveTo(x + R, y),
        L.appendBezierCurve(x + R, y + c, x + c, y + R, x, y + R),
        L.appendBezierCurve(x - c, y + R, x - R, y + c, x - R, y),
        L.appendBezierCurve(x - R, y - c, x - c, y - R, x, y - R),
        L.appendBezierCurve(x + c, y - R, x + R, y - c, x + R, y),
        L.closePath(),
      ];
    };
    const put = (v: VecDoc, c: DocCrop, target: Rect, clipOps: ReturnType<typeof pathRect>[number][], white = false) => {
      const name = this.xName(page, v.emb);
      const rot = normRot(v.rot + (v.item.rotation || 0));
      const m = placeMatrix(v.fw, v.fh, rot, c, rectPt(target));
      page.pushOperators(
        L.pushGraphicsState(),
        ...clipOps, L.clip(), L.endPath(),
        ...(white ? [L.setFillingRgbColor(1, 1, 1), ...clipOps, L.fill()] : []),
        L.concatTransformationMatrix(...m),
        L.drawObject(name),
        L.popGraphicsState(),
      );
    };

    for (const v of vec) {
      const crop = itemCrop(v.item);
      // El plano, dentro de su caja (y del borde rasgado si tiene)
      put(v, crop, v.imgBox, v.clip ? pathPoly(v.clip) : pathRect(v.imgBox));

      // Lupas: la zona ampliada, recortada a la forma del callout
      for (const it of (v.item.markup || []) as MarkupItem[]) {
        if (it.kind !== 'magnifier') continue;
        const r = zoneRegion(it);
        if (!r) continue;
        const W = v.imgBox.w, Hh = v.imgBox.h;
        const g = magGeom(it, W, Hh);
        const ox = v.imgBox.x, oy = v.imgBox.y;
        const zc: DocCrop = { x: crop.x + r.x * crop.w, y: crop.y + r.y * crop.h, w: r.w * crop.w, h: r.h * crop.h };
        const target: Rect = {
          x: ox + g.cx + (r.x * W - g.zx) * g.zoom, y: oy + g.cy + (r.y * Hh - g.zy) * g.zoom,
          w: r.w * W * g.zoom, h: r.h * Hh * g.zoom,
        };
        const shape = g.shape === 'circle'
          ? pathCircle(ox + g.ccx, oy + g.ccy, g.cr)
          : pathRect({ x: ox + g.cx, y: oy + g.cy, w: g.cw, h: g.ch });
        put(v, zc, target, shape, true);
      }
    }
  }

  /* ---------- Capa de texto invisible ---------- */
  drawText(page: OutPage, sheet: HTMLElement, k: number, H: number, keep: (el: Element) => boolean) {
    const L = this.lib;
    const runs = collectTextRuns(sheet, keep);
    if (!runs.length) return;
    let key = this.fontKey.get(page);
    if (!key) { key = page.node.newFontDictionary(this.font.name, this.font.ref); this.fontKey.set(page, key); }
    const ops: Parameters<OutPage['pushOperators']> = [L.beginText(), L.setTextRenderingMode(L.TextRenderingMode.Invisible)];
    for (const r of runs) {
      const txt = Array.from(r.text).map((ch) => (this.charset.has(ch.codePointAt(0)!) ? ch : sanitize(ch, this.charset))).join('');
      if (!txt.trim()) continue;
      const size = Math.max(1, r.fontPx * k);
      const tw = this.font.widthOfTextAtSize(txt, size);
      if (!tw) continue;
      const base = r.y + r.h / 2 + r.fontPx * 0.32; // línea de base aproximada
      ops.push(
        L.setFontAndSize(key, size),
        L.setCharacterSqueeze(Math.max(1, Math.min(1000, ((r.w * k) / tw) * 100))),
        L.setTextMatrix(1, 0, 0, 1, r.x * k, H - base * k),
        L.showText(this.font.encodeText(txt)),
      );
    }
    ops.push(L.endText());
    page.pushOperators(...ops);
  }
}

/** Un carácter que Helvetica no tiene: sin acento si es posible, si no un espacio */
function sanitize(ch: string, cs: Set<number>): string {
  const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (base && Array.from(base).every((c) => cs.has(c.codePointAt(0)!))) return base;
  const map: Record<string, string> = { '≥': '>=', '≤': '<=', '→': '->', '←': '<-', '×': 'x', '−': '-', '✓': 'v', '•': '-' };
  const m = map[ch];
  return m && Array.from(m).every((c) => cs.has(c.codePointAt(0)!)) ? m : ' ';
}

/* ---------- Renglones de texto de la hoja ---------- */
interface Run { text: string; x: number; y: number; w: number; h: number; fontPx: number }

function collectTextRuns(sheet: HTMLElement, keep: (el: Element) => boolean): Run[] {
  const sr = sheet.getBoundingClientRect();
  const s = sr.width / (sheet.offsetWidth || sr.width);
  const ok = new Map<Element, boolean>();
  const visible = (el: Element | null): boolean => {
    if (!el || el === sheet) return true;
    const c = ok.get(el);
    if (c !== undefined) return c;
    const cs = getComputedStyle(el);
    const v = keep(el as HTMLElement) && cs.visibility !== 'hidden' && cs.opacity !== '0' && visible(el.parentElement);
    ok.set(el, v);
    return v;
  };
  const runs: Run[] = [];
  let cur: Run | null = null;
  const flush = () => { if (cur && cur.text.trim()) runs.push(cur); cur = null; };

  const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const parent = n.parentElement;
    if (!parent || !n.data.trim() || !visible(parent)) continue;
    if (parent.closest('style, script, textarea, input, select')) continue;
    const cs = getComputedStyle(parent);
    const fontPx = parseFloat(cs.fontSize) || 10;
    const tt = cs.textTransform;
    const re = /\S+/g;
    for (let m = re.exec(n.data); m; m = re.exec(n.data)) {
      range.setStart(n, m.index);
      range.setEnd(n, m.index + m[0].length);
      const rects = range.getClientRects();
      if (!rects.length) continue;
      // Una palabra cortada entre renglones (guion) trae dos cajas: se toma la primera
      const b = rects[0];
      if (b.width <= 0 || b.height <= 0) continue;
      const box = { x: (b.left - sr.left) / s, y: (b.top - sr.top) / s, w: b.width / s, h: b.height / s };
      let word = m[0];
      if (tt === 'uppercase') word = word.toUpperCase();
      else if (tt === 'lowercase') word = word.toLowerCase();
      const c = cur as Run | null;
      const sameLine = c && Math.abs((c.y + c.h / 2) - (box.y + box.h / 2)) < Math.min(c.h, box.h) * 0.45 && Math.abs(c.fontPx - fontPx) < 0.6;
      const gap = c ? box.x - (c.x + c.w) : 0;
      if (c && sameLine && gap > -fontPx * 0.3 && gap < fontPx * 1.6) {
        c.text += (gap > fontPx * 0.12 ? ' ' : '') + word;
        const right = Math.max(c.x + c.w, box.x + box.w);
        c.y = Math.min(c.y, box.y);
        c.h = Math.max(c.h, box.h);
        c.w = right - c.x;
      } else {
        flush();
        cur = { text: word, ...box, fontPx };
      }
    }
  }
  flush();
  return runs;
}
