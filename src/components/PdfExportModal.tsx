import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Loader2, TriangleAlert, Mail, Check, FileDown, Share, RotateCcw, ScanEye } from 'lucide-react';
import {
  isAppleTouch, PRINT_FIT_OPTIONS, loadPrintFit,
  PDF_PRESETS, PdfPreset, MAIL_LIMIT_MB, SizeEstimate, collectPrintImages, estimatePdf, fmtMB,
} from '../utils/printImages';
import { renderSheetsToPdf, deliverPdf, RASTER_DPI } from '../utils/pdfRaster';
import './pdf-export.css';

type Mode = 'program' | 'system' | 'share';
const MODE_KEY = 'rp-pdf-mode';
const loadMode = (): Mode => {
  let m: string | null = null;
  try { m = localStorage.getItem(MODE_KEY); } catch { /* sin almacenamiento */ }
  return m === 'program' || m === 'system' || m === 'share' ? m : isAppleTouch() ? 'program' : 'system';
};

/** Achique de la hoja en el PDF del menú Compartir: Safari deja ≈ 13 mm de margen a los costados */
const SHARE_FIT_OPTIONS = [100, 92, 88, 85, 80];
const SHARE_FIT_KEY = 'rp-share-fit';
const loadShareFit = () => {
  let v = NaN;
  try { v = Number(localStorage.getItem(SHARE_FIT_KEY)); } catch { /* sin almacenamiento */ }
  return SHARE_FIT_OPTIONS.includes(v) ? v : 88;
};

const KEY = 'rp-pdf-preset';
export const loadPdfPreset = (): PdfPreset => {
  let id: string | null = null;
  try { id = localStorage.getItem(KEY); } catch { /* sin almacenamiento */ }
  return PDF_PRESETS.find((p) => p.id === id) ?? PDF_PRESETS.find((p) => p.id === 'media')!;
};

interface Props {
  totalPages: number;
  onClose: () => void;
  onPrint: (preset: PdfPreset, fit?: number) => void;
  /** Vista limpia (solo las hojas) para el menú Compartir de Safari */
  onShareView: (preset: PdfPreset, fit: number) => void;
  /** Nombre del archivo y título del PDF que arma el programa */
  fileName: string;
  title: string;
}

/** Ventana antes de imprimir: muestra cuánto pesará el PDF y deja achicar las fotos. */
export const PdfExportModal: React.FC<Props> = ({ totalPages, onClose, onPrint, onShareView, fileName, title }) => {
  const [sel, setSel] = useState<PdfPreset>(loadPdfPreset);
  const [est, setEst] = useState<Record<string, SizeEstimate>>({});
  const [progress, setProgress] = useState<{ id: string; done: number; total: number } | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const apple = isAppleTouch();
  const [fit, setFit] = useState(loadPrintFit);
  const [shareFit, setShareFitState] = useState(loadShareFit);
  const setShareFit = (v: number) => { setShareFitState(v); try { localStorage.setItem(SHARE_FIT_KEY, String(v)); } catch { /* */ } };
  const [mode, setModeState] = useState<Mode>(loadMode);
  const setMode = (m: Mode) => { setModeState(m); setResult(null); setErr(null); try { localStorage.setItem(MODE_KEY, m); } catch { /* */ } };
  const [gen, setGen] = useState<{ page: number; total: number } | null>(null);
  const [result, setResult] = useState<{ blob: Blob; preset: PdfPreset } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [delivered, setDelivered] = useState<string | null>(null);
  const selRef = useRef(sel);
  selRef.current = sel;

  // Calcula el peso de cada opción: primero la elegida, después las demás
  useEffect(() => {
    let alive = true;
    (async () => {
      const root = document.getElementById('report-print-container');
      if (!root) return;
      const imgs = collectPrintImages(root);
      setCount(imgs.length);
      const order = [selRef.current, ...PDF_PRESETS.filter((p) => p.id !== selRef.current.id)];
      for (const p of order) {
        if (!alive) return;
        const r = await estimatePdf(imgs, p, totalPages, (done, total) => alive && setProgress({ id: p.id, done, total }));
        if (!alive) return;
        setEst((e) => ({ ...e, [p.id]: r }));
      }
      if (alive) setProgress(null);
    })();
    return () => { alive = false; };
  }, [totalPages]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);

  const choose = (p: PdfPreset) => {
    setSel(p);
    setResult(null); setErr(null);
    try { localStorage.setItem(KEY, p.id); } catch { /* sin almacenamiento */ }
  };

  const generate = async () => {
    setErr(null); setResult(null); setDelivered(null);
    setGen({ page: 0, total: totalPages });
    try {
      const blob = await renderSheetsToPdf(sel, title, (page, total) => setGen({ page, total }));
      setResult({ blob, preset: sel });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(/html-to-image|Failed to fetch dynamically|module/i.test(msg)
        ? 'Falta instalar el paquete "html-to-image" en el proyecto (en AI Studio: agregar la dependencia html-to-image).'
        : `No se pudo armar el PDF: ${msg}`);
    } finally { setGen(null); }
  };
  const deliver = async () => {
    if (!result) return;
    const r = await deliverPdf(result.blob, fileName);
    setDelivered(r === 'shared' ? 'Listo.' : r === 'downloaded' ? 'Descargado.' : null);
  };
  const program = mode === 'program';
  const share = mode === 'share';
  const resMB = result ? result.blob.size / 1_048_576 : 0;
  const lighter = result && resMB > MAIL_LIMIT_MB ? PDF_PRESETS.find((p) => RASTER_DPI[p.id].dpi < RASTER_DPI[result.preset.id].dpi && p.id !== 'original' && PDF_PRESETS.indexOf(p) > PDF_PRESETS.indexOf(result.preset)) : undefined;

  const cur = est[sel.id];
  const curMB = cur ? cur.pdfBytes / 1_048_576 : 0;
  const tooBig = cur && curMB > MAIL_LIMIT_MB;
  const mailOk = PDF_PRESETS.filter((p) => p.dpi > 0 && est[p.id] && est[p.id].pdfBytes / 1_048_576 <= MAIL_LIMIT_MB)
    .sort((a, b) => b.dpi - a.dpi)[0];

  return createPortal(
    <div className="pdfx-overlay no-print" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pdfx-modal" role="dialog" aria-label="Exportar PDF">
        <div className="pdfx-head">
          <div>
            <div className="pdfx-eyebrow">Imprimir / PDF</div>
            <h2>Calidad de las fotos</h2>
          </div>
          <button className="pdfx-close" onClick={onClose} title="Cerrar"><X /></button>
        </div>

        <div className="pdfx-body">
          <p className="pdfx-intro">
            {count === null ? 'Revisando las fotos…'
              : count === 0 ? 'El informe no tiene fotos: el PDF va a ser liviano.'
              : <>El informe tiene <b>{count}</b> foto{count === 1 ? '' : 's'} e imágenes. Achicarlas para el PDF no cambia el informe guardado: solo la copia que se exporta.</>}
          </p>

          <div className="pdfx-mode">
            <button className={program ? 'on' : ''} onClick={() => setMode('program')}>
              <FileDown /><span><b>PDF del programa</b><span>Sale igual en cualquier equipo. Planos en vector y texto que se puede buscar.</span></span>
            </button>
            <button className={mode === 'system' ? 'on' : ''} onClick={() => setMode('system')}>
              <Printer /><span><b>Impresión del sistema</b><span>Texto nítido y seleccionable. En iPhone/iPad puede fallar.</span></span>
            </button>
            <button className={share ? 'on' : ''} onClick={() => setMode('share')}>
              <ScanEye /><span><b>Vista para compartir</b><span>Solo las hojas, sin la interfaz, para guardar el PDF desde el menú Compartir.</span></span>
            </button>
          </div>

          <div className="pdfx-opts">
            {PDF_PRESETS.map((p) => {
              const e = est[p.id];
              const mb = e ? e.pdfBytes / 1_048_576 : 0;
              const busy = !e && progress?.id === p.id;
              return (
                <button key={p.id} className={`pdfx-opt${sel.id === p.id ? ' on' : ''}`} onClick={() => choose(p)}>
                  <span className="pdfx-radio">{sel.id === p.id && <Check />}</span>
                  <span className="pdfx-opt-txt">
                    <b>{p.label}{p.id === 'media' && <em> recomendada</em>}</b>
                    <span>{program ? `Hoja a ${RASTER_DPI[p.id].dpi} ppp` : p.hint}</span>
                  </span>
                  {!program && <span className={`pdfx-size${e ? (mb > MAIL_LIMIT_MB ? ' big' : mb > MAIL_LIMIT_MB / 2 ? ' mid' : ' ok') : ''}`}>
                    {e ? `≈ ${fmtMB(e.pdfBytes)}` : busy ? <><Loader2 className="pdfx-spin" /> {progress!.done}/{progress!.total}</> : <Loader2 className="pdfx-spin" />}
                  </span>}
                </button>
              );
            })}
          </div>

          {program && gen && (
            <div className="pdfx-ok pdfx-busy"><Loader2 className="pdfx-spin" /> <span>Dibujando hoja {gen.page || 1} de {gen.total}…</span></div>
          )}
          {program && err && <div className="pdfx-warn"><TriangleAlert /><div><b>{err}</b></div></div>}
          {program && result && (resMB > MAIL_LIMIT_MB ? (
            <div className="pdfx-warn">
              <TriangleAlert />
              <div>
                <b>PDF listo: {fmtMB(result.blob.size)}. Demasiado pesado para mandar por correo.</b>
                <span>
                  La mayoría de los correos aceptan hasta 20-25 MB.
                  {lighter && <> Probá con <button className="pdfx-link" onClick={() => choose(lighter)}>{lighter.label}</button> y generalo de nuevo.</>}
                </span>
              </div>
            </div>
          ) : (
            <div className="pdfx-ok"><Mail /> <span>PDF listo: {fmtMB(result.blob.size)}. Se puede mandar por correo.{delivered && ` ${delivered}`}</span></div>
          ))}
          {!program && tooBig && (
            <div className="pdfx-warn">
              <TriangleAlert />
              <div>
                <b>≈ {fmtMB(cur.pdfBytes)}: demasiado pesado para mandar por correo.</b>
                <span>
                  La mayoría de los correos aceptan adjuntos de hasta 20-25 MB (Outlook 20 MB, Gmail 25 MB).
                  {mailOk ? <> Con <button className="pdfx-link" onClick={() => choose(mailOk)}>{mailOk.label}</button> queda en ≈ {fmtMB(est[mailOk.id].pdfBytes)}.</> : ' Probá con una opción más liviana.'}
                </span>
              </div>
            </div>
          )}
          {!program && cur && !tooBig && count! > 0 && (
            <div className="pdfx-ok"><Mail /> <span>≈ {fmtMB(cur.pdfBytes)}: se puede mandar por correo.</span></div>
          )}
          {!program && cur && cur.unknown > 0 && (
            <p className="pdfx-note">{cur.unknown} imagen{cur.unknown === 1 ? '' : 'es'} de internet no se pueden medir ni achicar: no están contadas.</p>
          )}
          {share && (
            <div className="pdfx-fit">
              <div className="pdfx-fit-head">
                <b>Tamaño de la hoja en el PDF</b>
                <div className="pdfx-seg">
                  {SHARE_FIT_OPTIONS.map((v) => (
                    <button key={v} className={shareFit === v ? 'on' : ''} onClick={() => setShareFit(v)}>{v}%</button>
                  ))}
                </div>
              </div>
              <span>
                Safari deja un margen blanco fijo de unos 13 mm alrededor y no se puede sacar. Con 88 % la hoja entra
                completa y centrada. Si queda cortada a la derecha o abajo, elegí un valor más chico.
              </span>
            </div>
          )}
          {share && (
            <div className="pdfx-steps">
              <b>Cómo guardar el PDF desde el iPhone / iPad</b>
              <ol>
                <li>Tocá <b>Abrir vista limpia</b>: quedan solo las hojas, una debajo de otra.</li>
                <li>Tocá el botón <b>Compartir</b> de Safari (el cuadrado con la flecha) → <b>Opciones</b> → <b>PDF</b> → <b>Guardar en Archivos</b>.</li>
                <li>También podés probar <b>Compartir → Imprimir</b> desde la vista limpia.</li>
                <li>Para volver, tocá <b>Salir</b> en la barra de arriba (si la ocultaste, tocá dos veces la hoja).</li>
              </ol>
            </div>
          )}
          {apple && mode === 'system' && (
            <div className="pdfx-fit">
              <div className="pdfx-fit-head">
                <b>Tamaño de las hojas en iPhone / iPad</b>
                <div className="pdfx-seg">
                  {PRINT_FIT_OPTIONS.map((v) => (
                    <button key={v} className={fit === v ? 'on' : ''} onClick={() => setFit(v)}>{v}%</button>
                  ))}
                </div>
              </div>
              <span>
                Safari agrega sus propios márgenes (dirección, fecha y número de página), así que la hoja entera no entra
                y el pie pasa a otra página. Si todavía pasa, elegí un valor más chico. En las opciones de impresión dejá la
                <b> Escala en 100 %</b>.
              </span>
            </div>
          )}
          {share ? null : program
            ? <p className="pdfx-note">Cada hoja se dibuja tal como se ve en pantalla. Puede tardar unos segundos por hoja.</p>
            : <p className="pdfx-note">El peso es aproximado. En la ventana de impresión elegí <b>Guardar como PDF</b> como destino.</p>}
        </div>

        <div className="pdfx-foot">
          <button className="pdfx-btn" onClick={onClose}>Cancelar</button>
          {share ? (
            <button className="pdfx-btn primary" onClick={() => onShareView(sel, shareFit)}>
              <ScanEye /> Abrir vista limpia
            </button>
          ) : !program ? (
            <button className="pdfx-btn primary" onClick={() => onPrint(sel, apple ? fit : undefined)}>
              <Printer /> Imprimir / guardar PDF
            </button>
          ) : result ? (
            <>
              <button className="pdfx-btn" onClick={generate}><RotateCcw /> Generar de nuevo</button>
              <button className="pdfx-btn primary" onClick={deliver}>
                {apple ? <><Share /> Compartir / guardar</> : <><FileDown /> Descargar PDF</>}
              </button>
            </>
          ) : (
            <button className="pdfx-btn primary" onClick={generate} disabled={!!gen}>
              {gen ? <><Loader2 className="pdfx-spin" /> Generando…</> : <><FileDown /> Generar PDF</>}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
