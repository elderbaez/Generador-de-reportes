import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload, Download, X, FileText, ClipboardPaste, Check } from 'lucide-react';
import { DockButton } from '../EditDock';
import {
  CsvDecimal, CsvDelimiter, CsvField, CsvRecord, DELIMITER_LABELS,
  autoMapColumns, csvTemplate, detectDecimal, detectDelimiter, detectSkip, downloadText,
  looksLikeHeader, normalizeNumber, splitCsv,
} from '../../utils/csv';
import './csv-import.css';

export type CsvMode = 'replace' | 'append';

interface CsvImportProps<T> {
  /** Columnas que entiende el módulo. */
  fields: CsvField[];
  /** Convierte un registro (claves de `fields`) en una fila del bloque. Devolver null para descartarlo. */
  toRow: (rec: CsvRecord, index: number) => T | null;
  onImport: (rows: T[], mode: CsvMode) => void;
  templateName: string;
  sampleRows?: string[][];
  /** Nombre del módulo para el título de la ventana (ej. "Rubros"). */
  title?: string;
}

/**
 * Botón "Importar CSV" del panel flotante. Abre la ventana de importación:
 * archivo (arrastrar o elegir) o tabla pegada, separador y decimal automáticos,
 * filas a ignorar, encabezados, asignación de columnas con vista previa y modo reemplazar/agregar.
 */
export function CsvImportButton<T>(props: CsvImportProps<T>) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(t);
  }, [status]);

  return (
    <>
      <DockButton onClick={() => setOpen(true)} title="Importar desde CSV, TXT o tabla copiada de Excel">
        <Upload /> Importar CSV
      </DockButton>
      {status && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#6ee7b7' }}>{status}</span>}
      {open && (
        <CsvImportModal
          {...props}
          onClose={() => setOpen(false)}
          onDone={(n, mode) => setStatus(`${n} fila${n === 1 ? '' : 's'} ${mode === 'append' ? 'agregadas' : 'importadas'}`)}
        />
      )}
    </>
  );
}

type Source = 'file' | 'paste';

function CsvImportModal<T>({
  fields, toRow, onImport, templateName, sampleRows, title, onClose, onDone,
}: CsvImportProps<T> & { onClose: () => void; onDone: (n: number, mode: CsvMode) => void }) {
  const [source, setSource] = useState<Source>('file');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileText, setFileText] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [delimChoice, setDelimChoice] = useState<'auto' | CsvDelimiter>('auto');
  const [decimalChoice, setDecimalChoice] = useState<'auto' | CsvDecimal>('auto');
  const [skipChoice, setSkipChoice] = useState<number | null>(null); // null = automático
  const [headerChoice, setHeaderChoice] = useState<'auto' | boolean>('auto');
  const [mapping, setMapping] = useState<number[]>([]);
  const [mappingTouched, setMappingTouched] = useState(false);
  const [mode, setMode] = useState<CsvMode>('replace');
  const fileRef = useRef<HTMLInputElement>(null);

  const text = source === 'file' ? fileText : pasteText;

  // ---- Detección automática
  const detectedDelim = useMemo(() => detectDelimiter(text), [text]);
  const delim: CsvDelimiter = delimChoice === 'auto' ? detectedDelim : delimChoice;
  const allRows = useMemo(() => (text.trim() ? splitCsv(text, delim) : []), [text, delim]);
  const detectedSkip = useMemo(() => detectSkip(allRows), [allRows]);
  const skip = skipChoice ?? detectedSkip;
  const rows = useMemo(() => allRows.slice(Math.max(0, skip)), [allRows, skip]);
  const detectedHeader = useMemo(() => looksLikeHeader(rows[0], fields), [rows, fields]);
  const hasHeader = headerChoice === 'auto' ? detectedHeader : headerChoice;
  const header = hasHeader ? rows[0] ?? null : null;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const ncols = useMemo(() => Math.max(0, ...rows.slice(0, 60).map((r) => r.length)), [rows]);
  // El decimal se detecta solo en las columnas asignadas a campos numéricos (los códigos "5.1" no confunden)
  const numericCols = mapping.map((fi, col) => (fi >= 0 && fields[fi]?.numeric ? col : -1)).filter((c) => c >= 0);
  const detectedDecimal = useMemo(
    () => detectDecimal(dataRows, delim, numericCols),
    [dataRows, delim, numericCols.join(',')]
  );
  const decimal: CsvDecimal = decimalChoice === 'auto' ? detectedDecimal : decimalChoice;

  // Mapeo automático cuando cambia la estructura (salvo que el usuario ya lo haya tocado)
  useEffect(() => {
    if (!mappingTouched) setMapping(autoMapColumns(header, ncols, fields));
  }, [header?.join('\u0001'), ncols, fields, mappingTouched]);

  // ---- Conversión a filas del módulo
  const result = useMemo(() => {
    const colOf = (fi: number) => mapping.indexOf(fi);
    const out: T[] = [];
    let skipped = 0;
    dataRows.forEach((r, i) => {
      const rec: CsvRecord = {};
      fields.forEach((f, fi) => {
        const c = colOf(fi);
        const raw = c >= 0 ? (r[c] ?? '').trim() : '';
        rec[f.key] = f.numeric ? normalizeNumber(raw, decimal) : raw;
      });
      const row = toRow(rec, i);
      if (row) out.push(row); else skipped++;
    });
    return { rows: out, skipped };
  }, [dataRows, mapping, fields, decimal, toRow]);

  const setColumnField = (col: number, fi: number) => {
    setMappingTouched(true);
    setMapping((prev) => {
      const next = [...prev];
      while (next.length < ncols) next.push(-1);
      if (fi >= 0) next.forEach((v, i) => { if (v === fi) next[i] = -1; });
      next[col] = fi;
      return next;
    });
  };

  const loadFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const t = typeof ev.target?.result === 'string' ? ev.target.result : '';
      setFileText(t);
      setFileName(file.name);
      setSkipChoice(null);
      setHeaderChoice('auto');
      setMappingTouched(false);
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);

  const doImport = () => {
    if (result.rows.length === 0) return;
    onImport(result.rows, mode);
    onDone(result.rows.length, mode);
    onClose();
  };

  const preview = dataRows.slice(0, 8);
  const requiredLabels = fields.map((f) => f.label).join(' · ');

  return createPortal(
    <div className="csvi-overlay no-print" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="csvi-modal" role="dialog" aria-label="Importar CSV">
        <div className="csvi-head">
          <div>
            <div className="csvi-eyebrow">Importar datos</div>
            <h2>{title ? `Importar ${title}` : 'Importar CSV'}</h2>
          </div>
          <button type="button" className="csvi-close" onClick={onClose} title="Cerrar (Esc)"><X /></button>
        </div>

        <div className="csvi-tabs">
          <button type="button" className={source === 'file' ? 'on' : ''} onClick={() => setSource('file')}>
            <FileText /> Archivo
          </button>
          <button type="button" className={source === 'paste' ? 'on' : ''} onClick={() => setSource('paste')}>
            <ClipboardPaste /> Pegar tabla
          </button>
        </div>

        <div className="csvi-body">
          {source === 'file' ? (
            // Es un <label>: el toque abre el selector de archivos de forma nativa. Antes un
            // clic por código + el mismo clic que "rebotaba" desde el campo cancelaban el
            // selector en el iPad, y no pasaba nada.
            <label
              className={`csvi-drop${dragOver ? ' over' : ''}${fileName ? ' loaded' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) loadFile(f);
              }}
            >
              {fileName ? (
                <>
                  <FileText className="csvi-drop-ic" />
                  <div>
                    <b>{fileName}</b>
                    <span>{allRows.length} filas leídas · clic o arrastrá otro archivo para cambiarlo</span>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="csvi-drop-ic" />
                  <div>
                    <b>Arrastrá aquí un archivo .csv o .txt</b>
                    <span>o hacé clic para elegirlo</span>
                  </div>
                </>
              )}
              <input ref={fileRef} type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ''; }} />
            </label>
          ) : (
            <textarea
              className="csvi-paste"
              placeholder="Pegá aquí celdas copiadas de Excel, Google Sheets o un archivo de texto…"
              value={pasteText}
              onChange={(e) => { setPasteText(e.target.value); setSkipChoice(null); setHeaderChoice('auto'); setMappingTouched(false); }}
              autoFocus
            />
          )}

          <div className="csvi-options">
            <label>
              <span>Separador</span>
              <select value={delimChoice} onChange={(e) => { setDelimChoice(e.target.value as 'auto' | CsvDelimiter); setMappingTouched(false); }}>
                <option value="auto">Auto · {DELIMITER_LABELS[detectedDelim]}</option>
                {(Object.keys(DELIMITER_LABELS) as CsvDelimiter[]).map((d) => (
                  <option key={d} value={d}>{DELIMITER_LABELS[d]}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Decimal</span>
              <select value={decimalChoice} onChange={(e) => setDecimalChoice(e.target.value as 'auto' | CsvDecimal)}>
                <option value="auto">Auto · {detectedDecimal === ',' ? 'coma (12,5)' : 'punto (12.5)'}</option>
                <option value=",">Coma (12,5)</option>
                <option value=".">Punto (12.5)</option>
              </select>
            </label>
            <label className="csvi-narrow">
              <span>Filas a ignorar{skipChoice === null && detectedSkip > 0 ? ' · auto' : ''}</span>
              <input type="number" min={0} value={skip}
                onChange={(e) => { setSkipChoice(Math.max(0, Number(e.target.value) || 0)); setMappingTouched(false); }} />
            </label>
            <label className="csvi-check">
              <input type="checkbox" checked={hasHeader}
                onChange={(e) => { setHeaderChoice(e.target.checked); setMappingTouched(false); }} />
              <span>Primera fila con nombres de columna</span>
            </label>
          </div>

          {rows.length > 0 ? (
            <div className="csvi-preview">
              <div className="csvi-preview-scroll">
                <table>
                  <thead>
                    <tr>
                      {Array.from({ length: ncols }).map((_, col) => (
                        <th key={col} className={mapping[col] >= 0 ? 'mapped' : ''}>
                          <select value={mapping[col] ?? -1} onChange={(e) => setColumnField(col, Number(e.target.value))}>
                            <option value={-1}>Ignorar</option>
                            {fields.map((f, fi) => <option key={f.key} value={fi}>{f.label}</option>)}
                          </select>
                          {header && <div className="csvi-colname">{header[col] ?? ''}</div>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i}>
                        {Array.from({ length: ncols }).map((_, col) => {
                          const fi = mapping[col] ?? -1;
                          const raw = r[col] ?? '';
                          const shown = fi >= 0 && fields[fi]?.numeric && raw ? normalizeNumber(raw, decimal).replace('.', ',') : raw;
                          return <td key={col} className={fi >= 0 ? 'mapped' : ''}>{shown || <span className="csvi-empty">—</span>}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {dataRows.length > preview.length && (
                <div className="csvi-more">… y {dataRows.length - preview.length} filas más</div>
              )}
            </div>
          ) : (
            <div className="csvi-hint">
              Columnas que entiende este módulo: <b>{requiredLabels}</b>. Si el archivo trae nombres de columna, se asignan solas;
              si no, podés elegirlas en la vista previa.
            </div>
          )}
        </div>

        <div className="csvi-foot">
          <button type="button" className="csvi-link"
            onClick={() => downloadText(`plantilla-${templateName}.csv`, csvTemplate(fields, sampleRows))}>
            <Download /> Descargar plantilla
          </button>
          <div className="csvi-foot-right">
            {rows.length > 0 && (
              <span className="csvi-summary">
                <b>{result.rows.length}</b> filas listas{result.skipped > 0 ? ` · ${result.skipped} se omiten` : ''}
              </span>
            )}
            <div className="csvi-seg">
              <button type="button" className={mode === 'replace' ? 'on' : ''} onClick={() => setMode('replace')}>Reemplazar tabla</button>
              <button type="button" className={mode === 'append' ? 'on' : ''} onClick={() => setMode('append')}>Agregar al final</button>
            </div>
            <button type="button" className="csvi-primary" disabled={result.rows.length === 0} onClick={doImport}>
              <Check /> Importar {result.rows.length > 0 ? result.rows.length : ''} fila{result.rows.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
