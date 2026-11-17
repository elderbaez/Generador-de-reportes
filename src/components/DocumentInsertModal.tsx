import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, FileUp, RotateCcw, RotateCw, ZoomIn, ZoomOut, Maximize, Crop, ChevronLeft, AlertTriangle, Loader2, FileText,
} from 'lucide-react';
import { DocItem, DocCrop, DocEdge } from '../types';
import {
  PdfDoc, PdfPage, openPdf, dataUrlToBytes, bytesToDataUrl, extractPdfPage, rasterizePage, pageSizePt,
  renderPdfRegion, renderImageRegion, loadImage, normRot, rotatedSize, FULL_CROP, fmtBytes, paperName, dataUrlBytes,
} from '../utils/pdf';
import { DOC_EDGE_OPTIONS } from '../utils/docLayout';
import './doc-modal.css';

/** Peso a partir del cual se avisa que la página agranda el informe. */
const HEAVY_BYTES = 1.5 * 1024 * 1024;

type Source =
  | { kind: 'pdf'; bytes: Uint8Array; doc: PdfDoc; fileName: string; numPages: number; keepSrc?: string }
  | { kind: 'image'; src: string; w: number; h: number; fileName: string };

type Extracted = { bytes: Uint8Array | null; size: number } | 'pending' | null;

export type DocInsertResult = Omit<DocItem, 'id'> & { id?: string };

interface Props {
  /** Si viene, se edita el recorte de ese elemento (y se puede reemplazar el archivo). */
  editItem?: DocItem | null;
  /** Archivo ya elegido (pegado o arrastrado sobre el bloque): se abre directamente. */
  initialFile?: File | null;
  onCancel: () => void;
  onConfirm: (item: DocInsertResult) => void;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const isFull = (c: DocCrop | null) => !c || (c.x <= 0.001 && c.y <= 0.001 && c.w >= 0.998 && c.h >= 0.998);
const baseName = (n: string) => n.replace(/\.[^/.]+$/, '').replace(/[_]+/g, ' ').trim();

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

/** Gira un recorte relativo junto con la página (90° horario o antihorario). */
function rotateCrop(c: DocCrop | null, dir: 1 | -1): DocCrop | null {
  if (!c) return c;
  return dir === 1
    ? { x: 1 - (c.y + c.h), y: c.x, w: c.h, h: c.w }
    : { x: c.y, y: 1 - (c.x + c.w), w: c.h, h: c.w };
}

/* ---------- Miniatura de página (se dibuja en orden, una por vez) ---------- */

const PageThumbs: React.FC<{
  doc: PdfDoc; numPages: number; selected: number; onSelect: (i: number) => void; onOpen: (i: number) => void;
}> = ({ doc, numPages, selected, onSelect, onOpen }) => {
  const [thumbs, setThumbs] = useState<Record<number, { url: string; label: string }>>({});
  useEffect(() => {
    let off = false;
    (async () => {
      for (let i = 0; i < numPages && !off; i++) {
        try {
          const page = await doc.getPage(i + 1);
          if (off) return;
          const canvas = await renderPdfRegion(page, 0, FULL_CROP, 170);
          const s = pageSizePt(page);
          const url = canvas.toDataURL('image/jpeg', 0.8);
          page.cleanup();
          if (!off) setThumbs((t) => ({ ...t, [i]: { url, label: paperName(s.w, s.h) } }));
        } catch { /* página dañada: queda sin miniatura */ }
      }
    })();
    return () => { off = true; };
  }, [doc, numPages]);

  return (
    <div className="dm-thumbs">
      {Array.from({ length: numPages }).map((_, i) => (
        <button
          key={i}
          type="button"
          className={`dm-thumb${selected === i ? ' on' : ''}`}
          onClick={() => onSelect(i)}
          onDoubleClick={() => onOpen(i)}
          title="Doble clic para elegir esta página"
        >
          <span className="dm-thumb-img">
            {thumbs[i] ? <img src={thumbs[i].url} alt={`Página ${i + 1}`} /> : <Loader2 className="dm-spin" />}
          </span>
          <span className="dm-thumb-lbl">Pág. {i + 1}{thumbs[i] ? <em>{thumbs[i].label}</em> : null}</span>
        </button>
      ))}
    </div>
  );
};

/* ===================================================================== */

export const DocumentInsertModal: React.FC<Props> = ({ editItem, initialFile, onCancel, onConfirm }) => {
  const [step, setStep] = useState<'file' | 'pages' | 'crop'>(editItem ? 'crop' : 'file');
  const [source, setSource] = useState<Source | null>(null);
  const [pageIdx, setPageIdx] = useState(0);
  const [page, setPage] = useState<PdfPage | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [pageSize, setPageSize] = useState<{ w: number; h: number }>({ w: editItem?.pageW || 1, h: editItem?.pageH || 1 });
  const [rotation, setRotation] = useState<number>(editItem?.rotation || 0);
  const [crop, setCrop] = useState<DocCrop | null>(editItem?.crop ?? null);
  const [edge, setEdge] = useState<DocEdge>(editItem?.edge ?? 'zigzag');
  const [extracted, setExtracted] = useState<Extracted>(null);
  const [asImage, setAsImage] = useState(false);
  const [busy, setBusy] = useState<string | null>(editItem ? 'Abriendo…' : null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [box, setBox] = useState({ w: 900, h: 560 });
  const fileRef = useRef<HTMLInputElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const zoomAnchor = useRef<{ rx: number; ry: number; cx: number; cy: number } | null>(null);

  /* ---------- Abrir archivos ---------- */

  const showPage = useCallback(async (src: Source, i: number, keep?: { rotation: number; crop: DocCrop | null }) => {
    if (src.kind !== 'pdf') return;
    setBusy('Preparando la página…');
    setError(null);
    try {
      const pg = await src.doc.getPage(i + 1);
      setPage(pg);
      setImg(null);
      setPageIdx(i);
      setPageSize(pageSizePt(pg));
      setRotation(keep ? keep.rotation : 0);
      setCrop(keep ? keep.crop : null);
      setZoom(1);
      setAsImage(false);
      setStep('crop');
      if (src.keepSrc) {
        setExtracted({ bytes: null, size: dataUrlBytes(src.keepSrc) });
      } else if (src.numPages === 1) {
        setExtracted({ bytes: src.bytes, size: src.bytes.length });
      } else {
        setExtracted('pending');
        extractPdfPage(src.bytes, i).then((b) => setExtracted({ bytes: b, size: b ? b.length : 0 }));
      }
    } catch {
      setError('No se pudo leer esa página.');
    } finally {
      setBusy(null);
    }
  }, []);

  const readFile = useCallback(async (file: File) => {
    setError(null);
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isImg = /^image\/(png|jpe?g|webp|gif|bmp)$/i.test(file.type);
    if (!isPdf && !isImg) {
      setError('Formato no admitido. Usá un PDF o una imagen (PNG, JPG, WebP).');
      return;
    }
    setBusy('Abriendo el archivo…');
    try {
      if (isPdf) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const doc = await openPdf(bytes);
        const src: Source = { kind: 'pdf', bytes, doc, fileName: file.name, numPages: doc.numPages };
        setSource(src);
        if (doc.numPages === 1) await showPage(src, 0);
        else { setPageIdx(0); setStep('pages'); setBusy(null); }
      } else {
        const dataUrl = await fileToDataUrl(file);
        const im = await loadImage(dataUrl);
        setSource({ kind: 'image', src: dataUrl, w: im.naturalWidth, h: im.naturalHeight, fileName: file.name });
        setImg(im);
        setPage(null);
        setPageSize({ w: im.naturalWidth, h: im.naturalHeight });
        setRotation(0);
        setCrop(null);
        setZoom(1);
        setExtracted({ bytes: null, size: dataUrlBytes(dataUrl) });
        setStep('crop');
        setBusy(null);
      }
    } catch (err) {
      const name = (err as { name?: string })?.name;
      setError(name === 'PasswordException'
        ? 'El PDF está protegido con contraseña. Abrilo, guardalo sin contraseña y volvé a intentar.'
        : 'No se pudo abrir el archivo. ¿Está dañado?');
      setBusy(null);
    }
  }, [showPage]);

  // Modo "editar recorte": abre el elemento existente
  useEffect(() => {
    if (!editItem) return;
    let off = false;
    (async () => {
      try {
        if (editItem.kind === 'pdf') {
          const bytes = dataUrlToBytes(editItem.src);
          const doc = await openPdf(bytes);
          if (off) return;
          const src: Source = { kind: 'pdf', bytes, doc, fileName: editItem.fileName || 'documento.pdf', numPages: doc.numPages, keepSrc: editItem.src };
          setSource(src);
          await showPage(src, 0, { rotation: editItem.rotation || 0, crop: editItem.crop ?? null });
        } else {
          const im = await loadImage(editItem.src);
          if (off) return;
          setSource({ kind: 'image', src: editItem.src, w: im.naturalWidth, h: im.naturalHeight, fileName: editItem.fileName || 'imagen' });
          setImg(im);
          setPageSize({ w: editItem.pageW || im.naturalWidth, h: editItem.pageH || im.naturalHeight });
          setExtracted({ bytes: null, size: dataUrlBytes(editItem.src) });
          setBusy(null);
        }
      } catch {
        if (!off) { setError('No se pudo abrir el documento guardado.'); setBusy(null); }
      }
    })();
    return () => { off = true; };
  }, [editItem, showPage]);

  // Archivo pegado o arrastrado sobre el bloque
  const initialDone = useRef(false);
  useEffect(() => {
    if (initialFile && !initialDone.current) { initialDone.current = true; readFile(initialFile); }
  }, [initialFile, readFile]);

  // Pegar un PDF o una imagen con Ctrl+V
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = Array.from(e.clipboardData?.files || [])[0];
      if (f) { e.preventDefault(); readFile(f); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [readFile]);

  /* ---------- Vista del recorte ---------- */

  useLayoutEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [step]);

  const rs = rotatedSize(pageSize.w, pageSize.h, rotation);
  const PAD = 28;
  const fit = Math.max(0.01, Math.min((box.w - PAD * 2) / rs.w, (box.h - PAD * 2) / rs.h));
  const dispW = rs.w * fit * zoom;
  const dispH = rs.h * fit * zoom;

  // Dibujo de la página al tamaño de pantalla (se rehace al girar o hacer zoom)
  useEffect(() => {
    if (step !== 'crop' || (!page && !img)) return;
    let off = false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const target = Math.min(7000, Math.ceil((dispW * dpr) / 150) * 150);
    const t = setTimeout(async () => {
      try {
        const canvas = page
          ? await renderPdfRegion(page, rotation, FULL_CROP, target)
          : renderImageRegion(img!, rotation, FULL_CROP, target);
        if (off || !canvasHostRef.current) return;
        canvas.className = 'dm-canvas';
        canvasHostRef.current.replaceChildren(canvas);
      } catch { /* se reintenta con el próximo cambio */ }
    }, 90);
    return () => { off = true; clearTimeout(t); };
  }, [step, page, img, rotation, Math.round(dispW / 150)]); // eslint-disable-line react-hooks/exhaustive-deps

  // Zoom manteniendo el punto bajo el cursor
  useLayoutEffect(() => {
    const a = zoomAnchor.current;
    const v = viewRef.current;
    const st = stageRef.current;
    if (!a || !v || !st) return;
    zoomAnchor.current = null;
    v.scrollLeft = st.offsetLeft + a.rx * dispW - a.cx;
    v.scrollTop = st.offsetTop + a.ry * dispH - a.cy;
  }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  const zoomTo = (z: number, clientX?: number, clientY?: number) => {
    const v = viewRef.current;
    const st = stageRef.current;
    const nz = clamp(Math.round(z * 100) / 100, 1, 10);
    if (v && st) {
      const vr = v.getBoundingClientRect();
      const sr = st.getBoundingClientRect();
      const cx = (clientX ?? vr.left + vr.width / 2) - vr.left;
      const cy = (clientY ?? vr.top + vr.height / 2) - vr.top;
      zoomAnchor.current = {
        rx: clamp((vr.left + cx - sr.left) / sr.width, 0, 1),
        ry: clamp((vr.top + cy - sr.top) / sr.height, 0, 1),
        cx, cy,
      };
    }
    setZoom(nz);
  };

  useEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom((z) => {
        const nz = clamp(z * (e.deltaY < 0 ? 1.18 : 1 / 1.18), 1, 10);
        const st = stageRef.current;
        if (st) {
          const vr = v.getBoundingClientRect();
          const sr = st.getBoundingClientRect();
          zoomAnchor.current = {
            rx: clamp((e.clientX - sr.left) / sr.width, 0, 1),
            ry: clamp((e.clientY - sr.top) / sr.height, 0, 1),
            cx: e.clientX - vr.left,
            cy: e.clientY - vr.top,
          };
        }
        return Math.round(nz * 100) / 100;
      });
    };
    v.addEventListener('wheel', onWheel, { passive: false });
    return () => v.removeEventListener('wheel', onWheel);
  }, [step]);

  /* ---------- Recorte con el mouse ---------- */

  const gesture = useRef<{ mode: 'new' | 'move' | string; x0: number; y0: number; c0: DocCrop | null; rect: DOMRect } | null>(null);

  const relPoint = (e: React.PointerEvent | PointerEvent, rect: DOMRect) => ({
    x: clamp((e.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((e.clientY - rect.top) / rect.height, 0, 1),
  });

  const onStageDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const p = relPoint(e, rect);
    const handle = (e.target as HTMLElement).dataset.h;
    const inside = crop && p.x >= crop.x && p.x <= crop.x + crop.w && p.y >= crop.y && p.y <= crop.y + crop.h;
    const mode = handle ? handle : inside && !isFull(crop) ? 'move' : 'new';
    gesture.current = { mode, x0: p.x, y0: p.y, c0: crop, rect };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onStageMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    const p = relPoint(e, g.rect);
    if (g.mode === 'new') {
      setCrop({ x: Math.min(g.x0, p.x), y: Math.min(g.y0, p.y), w: Math.abs(p.x - g.x0), h: Math.abs(p.y - g.y0) });
      return;
    }
    const c0 = g.c0 || FULL_CROP;
    const dx = p.x - g.x0;
    const dy = p.y - g.y0;
    if (g.mode === 'move') {
      setCrop({ ...c0, x: clamp(c0.x + dx, 0, 1 - c0.w), y: clamp(c0.y + dy, 0, 1 - c0.h) });
      return;
    }
    let x1 = c0.x, y1 = c0.y, x2 = c0.x + c0.w, y2 = c0.y + c0.h;
    if (g.mode.includes('w')) x1 = clamp(c0.x + dx, 0, x2 - 0.01);
    if (g.mode.includes('e')) x2 = clamp(c0.x + c0.w + dx, x1 + 0.01, 1);
    if (g.mode.includes('n')) y1 = clamp(c0.y + dy, 0, y2 - 0.01);
    if (g.mode.includes('s')) y2 = clamp(c0.y + c0.h + dy, y1 + 0.01, 1);
    setCrop({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
  };

  const onStageUp = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    setCrop((c) => {
      if (!c) return c;
      // un clic sin arrastrar (o un recorte minúsculo) vuelve a la hoja completa
      if (c.w * dispW < 8 || c.h * dispH < 8) return g.mode === 'new' ? null : g.c0;
      return c;
    });
  };

  const rotate = (dir: 1 | -1) => {
    setRotation((r) => normRot(r + dir * 90));
    setCrop((c) => rotateCrop(c, dir));
  };

  /* ---------- Confirmar ---------- */

  const canConfirm = step === 'crop' && !!source && !busy && extracted !== 'pending';
  const effectiveCrop = isFull(crop) ? null : crop;

  const confirm = async () => {
    if (!source || !canConfirm) return;
    setBusy('Insertando…');
    try {
      let kind: DocItem['kind'];
      let src: string;
      let pw = pageSize.w;
      let ph = pageSize.h;
      if (source.kind === 'image') {
        kind = 'image';
        src = source.src;
      } else if (source.keepSrc && !asImage) {
        kind = 'pdf';
        src = source.keepSrc;
      } else {
        const ex = (extracted && typeof extracted === 'object') ? extracted.bytes : null;
        if (ex && !asImage) {
          kind = 'pdf';
          src = bytesToDataUrl(ex, 'application/pdf');
        } else {
          const r = await rasterizePage(page!);
          kind = 'image';
          src = r.src;
          pw = r.w;
          ph = r.h;
        }
      }
      const multi = source.kind === 'pdf' && source.numPages > 1 && !source.keepSrc;
      const defaultCaption = `${baseName(source.fileName)}${multi ? ` – pág. ${pageIdx + 1}` : ''}`;
      onConfirm({
        ...(editItem || {}),
        kind,
        src,
        fileName: source.fileName,
        sourcePage: source.kind === 'pdf' ? (source.keepSrc ? editItem?.sourcePage : pageIdx + 1) : undefined,
        pageW: pw,
        pageH: ph,
        rotation: normRot(rotation) as DocItem['rotation'],
        crop: effectiveCrop,
        edge: effectiveCrop || editItem?.edgeSides === 'all' ? edge : editItem?.edge ?? 'straight',
        edgeSides: editItem?.edgeSides ?? 'cut',
        shadow: editItem?.shadow ?? true,
        caption: editItem ? editItem.caption : defaultCaption,
      });
    } catch {
      setError('No se pudo insertar el documento.');
      setBusy(null);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      else if (e.key === 'Enter' && tag !== 'INPUT' && tag !== 'TEXTAREA' && step === 'crop') { e.preventDefault(); confirm(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /* ---------- Textos de estado ---------- */

  const unitMm = source?.kind === 'pdf' ? 25.4 / 72 : 0;
  const sizeText = (c: DocCrop) => unitMm
    ? `${Math.round(rs.w * c.w * unitMm)} × ${Math.round(rs.h * c.h * unitMm)} mm`
    : `${Math.round(rs.w * c.w)} × ${Math.round(rs.h * c.h)} px`;
  const paper = source?.kind === 'pdf' ? paperName(pageSize.w, pageSize.h) : `${pageSize.w} × ${pageSize.h} px`;
  const weight = extracted && extracted !== 'pending' ? extracted.size : 0;
  const protectedPdf = source?.kind === 'pdf' && !source.keepSrc && extracted && extracted !== 'pending' && !extracted.bytes;
  const heavy = weight > HEAVY_BYTES;

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  /* ---------- Render ---------- */

  const body = (() => {
    if (step === 'file') {
      return (
        <div
          className={`dm-drop${drag ? ' over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) readFile(f); }}
          onClick={() => fileRef.current?.click()}
        >
          <FileUp className="dm-drop-ic" />
          <b>Arrastrá un PDF o una imagen acá</b>
          <span>o hacé clic para elegir el archivo · también podés pegarlo (Ctrl+V)</span>
          <small>Planos, contratos, pliegos, croquis escaneados… Después elegís la página y si querés la hoja completa o sólo un recorte.</small>
        </div>
      );
    }
    if (step === 'pages' && source?.kind === 'pdf') {
      return (
        <div className="dm-pages">
          <div className="dm-pages-head">
            <span><FileText /> {source.fileName} · {source.numPages} páginas</span>
            <span className="dm-muted">Elegí la página a insertar (doble clic para abrirla)</span>
          </div>
          <PageThumbs
            doc={source.doc}
            numPages={source.numPages}
            selected={pageIdx}
            onSelect={setPageIdx}
            onOpen={(i) => showPage(source, i)}
          />
        </div>
      );
    }
    return (
      <div className="dm-cropwrap">
        <div className="dm-toolbar">
          <div className="dm-tgroup">
            <button type="button" className="dm-tbtn" onClick={() => rotate(-1)} title="Girar a la izquierda"><RotateCcw /></button>
            <button type="button" className="dm-tbtn" onClick={() => rotate(1)} title="Girar a la derecha"><RotateCw /></button>
          </div>
          <div className="dm-tgroup">
            <button type="button" className="dm-tbtn" onClick={() => zoomTo(zoom / 1.4)} disabled={zoom <= 1} title="Alejar"><ZoomOut /></button>
            <span className="dm-zoom">{Math.round(zoom * 100)}%</span>
            <button type="button" className="dm-tbtn" onClick={() => zoomTo(zoom * 1.4)} disabled={zoom >= 10} title="Acercar (también Ctrl + rueda)"><ZoomIn /></button>
            <button type="button" className="dm-tbtn" onClick={() => setZoom(1)} disabled={zoom === 1} title="Ver la hoja entera"><Maximize /></button>
          </div>
          <div className="dm-tgroup">
            <button
              type="button"
              className={`dm-chip${!effectiveCrop ? ' on' : ''}`}
              onClick={() => setCrop(null)}
              title="Insertar la hoja entera"
            >
              Hoja completa
            </button>
            <span className={`dm-chip ghost${effectiveCrop ? ' on' : ''}`}>
              <Crop /> {effectiveCrop ? `Recorte ${sizeText(effectiveCrop)}` : 'Arrastrá sobre la hoja para recortar'}
            </span>
          </div>
          {effectiveCrop && (
            <div className="dm-tgroup">
              <span className="dm-tlabel">Bordes</span>
              <div className="dm-seg">
                {DOC_EDGE_OPTIONS.map((o) => (
                  <button key={o.value} type="button" className={edge === o.value ? 'on' : ''} onClick={() => setEdge(o.value)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="dm-view" ref={viewRef}>
          <div className="dm-viewinner" style={{ minWidth: dispW + PAD * 2, minHeight: dispH + PAD * 2 }}>
            <div
              ref={stageRef}
              className={`dm-stage${effectiveCrop ? ' has-crop' : ''}`}
              style={{ width: dispW, height: dispH }}
              onPointerDown={onStageDown}
              onPointerMove={onStageMove}
              onPointerUp={onStageUp}
              onPointerCancel={onStageUp}
            >
              <div ref={canvasHostRef} className="dm-canvas-host" />
              {effectiveCrop && (
                <div
                  className="dm-crop"
                  style={{
                    left: `${effectiveCrop.x * 100}%`,
                    top: `${effectiveCrop.y * 100}%`,
                    width: `${effectiveCrop.w * 100}%`,
                    height: `${effectiveCrop.h * 100}%`,
                  }}
                >
                  {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((h) => (
                    <span key={h} data-h={h} className={`dm-h dm-h-${h}`} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  })();

  const modal = (
    <div
      className="dm-overlay no-print"
      onMouseDown={(e) => { e.stopPropagation(); if (e.target === e.currentTarget && step === 'file') onCancel(); }}
      onClick={stop}
      onDoubleClick={stop}
      onPointerDown={stop}
      onKeyDown={stop}
    >
      <div className="dm-modal" role="dialog" aria-label="Insertar documento o plano">
        <div className="dm-head">
          <div className="dm-title">
            {step === 'pages' || (step === 'crop' && source?.kind === 'pdf' && source.numPages > 1 && !source.keepSrc) ? (
              <button type="button" className="dm-back" onClick={() => setStep('pages')} title="Elegir otra página">
                <ChevronLeft />
              </button>
            ) : null}
            <b>{editItem ? 'Recortar documento' : 'Insertar documento o plano'}</b>
            <span className="dm-steps">
              <i className={step === 'file' ? 'on' : ''}>Archivo</i>
              <i className={step === 'pages' ? 'on' : ''}>Página</i>
              <i className={step === 'crop' ? 'on' : ''}>Recorte</i>
            </span>
          </div>
          <button type="button" className="dm-x" onClick={onCancel} title="Cerrar (Esc)"><X /></button>
        </div>

        <div className="dm-body">
          {body}
          {busy && (
            <div className="dm-busy"><Loader2 className="dm-spin" /> {busy}</div>
          )}
        </div>

        <div className="dm-foot">
          <div className="dm-info">
            {error && <span className="dm-err"><AlertTriangle /> {error}</span>}
            {!error && step === 'crop' && source && (
              <>
                <span className="dm-meta">
                  {source.fileName}
                  {source.kind === 'pdf' && source.numPages > 1 && !source.keepSrc ? ` · pág. ${pageIdx + 1} de ${source.numPages}` : ''}
                  {` · ${paper}`}
                  {extracted === 'pending' ? ' · calculando peso…' : weight ? ` · ${fmtBytes(weight)}` : ''}
                </span>
                {protectedPdf && (
                  <span className="dm-warn"><AlertTriangle /> El PDF no permite extraer la página: se insertará como imagen.</span>
                )}
                {heavy && !protectedPdf && source.kind === 'pdf' && (
                  <span className="dm-warn">
                    <AlertTriangle /> Página pesada: agranda el informe y las plantillas guardadas.
                    <label><input type="checkbox" checked={asImage} onChange={(e) => setAsImage(e.target.checked)} /> Guardar como imagen (más liviana)</label>
                  </span>
                )}
                {heavy && source.kind === 'image' && (
                  <span className="dm-warn"><AlertTriangle /> Imagen pesada: agranda el informe y las plantillas guardadas.</span>
                )}
              </>
            )}
            {!error && step === 'file' && editItem && (
              <span className="dm-meta">Elegí el archivo nuevo para reemplazar el actual.</span>
            )}
          </div>
          <div className="dm-actions">
            {step === 'crop' && (
              <button type="button" className="dm-btn" onClick={() => fileRef.current?.click()}>
                <FileUp /> {editItem ? 'Reemplazar archivo' : 'Otro archivo'}
              </button>
            )}
            <button type="button" className="dm-btn" onClick={onCancel}>Cancelar</button>
            {step === 'pages' && source?.kind === 'pdf' && (
              <button type="button" className="dm-btn primary" onClick={() => showPage(source, pageIdx)}>
                Usar página {pageIdx + 1}
              </button>
            )}
            {step === 'crop' && (
              <button type="button" className="dm-btn primary" disabled={!canConfirm} onClick={confirm}>
                {editItem ? 'Aplicar' : effectiveCrop ? 'Insertar recorte' : 'Insertar hoja'}
              </button>
            )}
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf,image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ''; }}
        />
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};
