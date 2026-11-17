/* =====================================================================
   Importación CSV unificada para todos los módulos con tablas.

   - Detecta el separador (; , o tabulación), respeta comillas y BOM de Excel.
   - Si la primera fila tiene encabezados reconocibles, mapea las columnas por nombre
     (sin importar el orden, acentos ni mayúsculas).
   - Si no hay encabezados, toma las columnas en el orden definido por el módulo.
   ===================================================================== */

export interface CsvField {
  /** Clave del campo en el registro resultante. */
  key: string;
  /** Nombre de la columna en la plantilla. */
  label: string;
  /** Palabras que identifican la columna en un encabezado (sin acentos, minúsculas). */
  keywords: string[];
  /** Columna numérica: se normaliza según el separador decimal elegido (coma o punto). */
  numeric?: boolean;
  /** Encabezados que tienen que ser exactamente estos (para nombres cortos como "Id", que
      con "contiene" se confundirían con "Actividad" o "Unidad") */
  exact?: string[];
}

export type CsvRecord = Record<string, string>;

export const normalizeText = (s: string) =>
  String(s ?? '')
    .replace(/^﻿/, '')
    .replace(/^="?|"?$/g, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Lee un CSV y devuelve sus filas (sin filas vacías). */
export function readCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/).find((l) => l.trim()) ?? '';
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const semi = count(';'), comma = count(','), tab = count('\t');
  const delim = tab > semi && tab > comma ? '\t' : comma > semi ? ',' : ';';

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  const pushRow = () => {
    row.push(cell);
    if (row.some((c) => c.trim().length > 0)) rows.push(row.map((c) => c.replace(/^="?|"?$/g, '').trim()));
    row = [];
    cell = '';
  };

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '"' && inQuotes && clean[i + 1] === '"') { cell += '"'; i++; }
    else if (ch === '"') inQuotes = !inQuotes;
    else if (ch === delim && !inQuotes) { row.push(cell); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      pushRow();
    } else cell += ch;
  }
  pushRow();
  return rows;
}

/** Convierte filas en registros con las claves de los campos. */
export function mapCsv(rows: string[][], fields: CsvField[]): { records: CsvRecord[]; hasHeader: boolean } {
  if (rows.length === 0) return { records: [], hasHeader: false };

  const header = rows[0].map(normalizeText);
  const idx = fields.map((f) => header.findIndex((h) => h && f.keywords.some((k) => h.includes(k))));
  const recognized = idx.filter((i) => i >= 0).length;
  const hasHeader = recognized >= Math.min(2, fields.length);

  const cols = hasHeader ? idx : fields.map((_, i) => i);
  const data = hasHeader ? rows.slice(1) : rows;

  const records = data.map((r) => {
    const rec: CsvRecord = {};
    fields.forEach((f, i) => { rec[f.key] = cols[i] >= 0 ? (r[cols[i]] ?? '').trim() : ''; });
    return rec;
  });
  return { records, hasHeader };
}

/** Lee un número con coma o punto decimal y % opcional. */
export function csvNumber(value: string | undefined): number | undefined {
  const s = String(value ?? '').replace(/[%"\s]/g, '').replace(',', '.');
  if (!s || s === '-') return undefined;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Genera el texto de una plantilla CSV (separador ;, con BOM para que Excel respete acentos). */
export function csvTemplate(fields: CsvField[], sampleRows: string[][] = []): string {
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [fields.map((f) => f.label), ...sampleRows].map((r) => r.map(esc).join(';'));
  return '﻿' + lines.join('\r\n');
}

export function downloadText(fileName: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* =====================================================================
   Detección automática para el importador (separador, decimal, encabezado)
   ===================================================================== */

export type CsvDelimiter = ';' | ',' | '\t' | 'space';
export type CsvDecimal = ',' | '.';

export const DELIMITER_LABELS: Record<CsvDelimiter, string> = {
  ';': 'Punto y coma',
  ',': 'Coma',
  '\t': 'Tabulación',
  space: 'Espacios',
};

const countOutsideQuotes = (line: string, ch: string) => {
  let n = 0, q = false;
  for (const c of line) { if (c === '"') q = !q; else if (c === ch && !q) n++; }
  return n;
};

/**
 * Elige el separador que aparece la misma cantidad de veces en la mayoría de las líneas.
 * Tolera líneas de título o comentarios al principio del archivo.
 */
export function detectDelimiter(text: string): CsvDelimiter {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim()).slice(0, 40);
  if (lines.length === 0) return ';';
  const candidates: { d: CsvDelimiter; count: (l: string) => number }[] = [
    { d: '\t', count: (l) => countOutsideQuotes(l, '\t') },
    { d: ';', count: (l) => countOutsideQuotes(l, ';') },
    { d: ',', count: (l) => countOutsideQuotes(l, ',') },
    { d: 'space', count: (l) => (l.trim().match(/\s+/g) || []).length },
  ];
  let best: { d: CsvDelimiter; share: number } = { d: ';', share: 0 };
  for (const c of candidates) {
    const counts = lines.map(c.count).filter((n) => n > 0);
    if (counts.length === 0) continue;
    const freq = new Map<number, number>();
    counts.forEach((n) => freq.set(n, (freq.get(n) || 0) + 1));
    const modeCount = Math.max(...freq.values());
    const share = modeCount / lines.length;
    // Orden de preferencia: tab > ; > , > espacio (solo gana uno posterior si es claramente mejor)
    if (share >= 0.5 && share > best.share + 0.15) best = { d: c.d, share };
  }
  return best.d;
}

/** Sugiere cuántas filas iniciales ignorar: las que no tienen la cantidad de columnas habitual. */
export function detectSkip(rows: string[][]): number {
  if (rows.length < 2) return 0;
  const freq = new Map<number, number>();
  rows.slice(0, 60).forEach((r) => { if (r.length > 1) freq.set(r.length, (freq.get(r.length) || 0) + 1); });
  if (freq.size === 0) return 0;
  const mode = [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
  const i = rows.findIndex((r) => r.length >= mode - 0 && r.length === mode);
  return i > 0 && i < 10 ? i : 0;
}

/** Divide el texto en filas y celdas con el separador indicado. */
export function splitCsv(text: string, delim: CsvDelimiter): string[][] {
  if (delim === 'space') {
    return text.replace(/^\uFEFF/, '').split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => l.split(/\s+/));
  }
  const clean = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  const push = () => {
    row.push(cell);
    if (row.some((c) => c.trim())) rows.push(row.map((c) => c.replace(/^="?|"?$/g, '').trim()));
    row = [];
    cell = '';
  };
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '"' && q && clean[i + 1] === '"') { cell += '"'; i++; }
    else if (ch === '"') q = !q;
    else if (ch === delim && !q) { row.push(cell); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !q) { if (ch === '\r' && clean[i + 1] === '\n') i++; push(); }
    else cell += ch;
  }
  push();
  return rows;
}

/**
 * Detecta si los números usan coma o punto decimal. Si se indican columnas, mira solo esas
 * (las numéricas), así los códigos tipo "5.1" no confunden. Un número con miles ("1.240,5")
 * o con coma decimal clara decide por sí solo.
 */
export function detectDecimal(rows: string[][], delim: CsvDelimiter, columns?: number[]): CsvDecimal {
  let comma = 0, dot = 0;
  rows.slice(0, 80).forEach((r) => {
    const cells = columns && columns.length ? columns.map((c) => r[c] ?? '') : r;
    cells.forEach((raw) => {
      const c = raw.replace(/[\s%]/g, '');
      if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(c)) comma += 5;
      else if (/^-?\d{1,3}(,\d{3})+\.\d+$/.test(c)) dot += 5;
      else if (/^-?\d+,\d+$/.test(c)) comma++;
      else if (/^-?\d+\.\d+$/.test(c)) dot++;
    });
  });
  if (comma === dot) return delim === ',' ? '.' : ',';
  return comma > dot ? ',' : '.';
}

/** Convierte un número del CSV a texto con punto decimal (quita separadores de miles). */
export function normalizeNumber(value: string, decimal: CsvDecimal): string {
  let v = (value ?? '').replace(/[\s%]/g, '');
  if (!v) return '';
  if (decimal === ',') v = v.replace(/\./g, '').replace(',', '.');
  else v = v.replace(/,/g, '');
  return v;
}

/** ¿La fila parece de encabezados? (reconoce nombres de columnas y no es mayormente numérica) */
export function looksLikeHeader(row: string[] | undefined, fields: CsvField[]): boolean {
  if (!row || row.length === 0) return false;
  const norm = row.map(normalizeText);
  const recognized = norm.filter((h) => h && fields.some((f) => f.keywords.some((k) => h.includes(k)))).length;
  const numeric = row.filter((c) => /^-?[\d.,]+%?$/.test(c.trim())).length;
  return recognized >= 1 && numeric < row.length / 2;
}

/** Asigna columnas a campos: por nombre si hay encabezado, si no, en orden. -1 = ignorar. */
export function autoMapColumns(header: string[] | null, ncols: number, fields: CsvField[]): number[] {
  const map = Array(ncols).fill(-1);
  if (header) {
    const used = new Set<number>();
    header.forEach((h, col) => {
      const n = normalizeText(h);
      if (!n) return;
      const fi = fields.findIndex((f, i) => !used.has(i) && (f.exact?.includes(n) || f.keywords.some((k) => n.includes(k))));
      if (fi >= 0 && col < ncols) { map[col] = fi; used.add(fi); }
    });
    return map;
  }
  for (let i = 0; i < Math.min(ncols, fields.length); i++) map[i] = i;
  return map;
}

/* =====================================================================
   Rubros (SituationBlock)
   ===================================================================== */

export const RUBRIC_CSV_FIELDS: CsvField[] = [
  { key: 'item', label: 'Ítem', keywords: ['item', 'codigo', 'cod', 'nº', 'numero'] },
  { key: 'description', label: 'Rubro / Actividad', keywords: ['descripcion', 'descricao', 'description', 'rubro', 'actividad', 'detalle', 'tarea'] },
  { key: 'percent', label: 'Avance %', keywords: ['avance', 'porcentaje', 'porcentagem', 'percentual', 'progreso', 'progresso', '%'], numeric: true },
  { key: 'group', label: 'Grupo (si/no)', keywords: ['grupo', 'etapa', 'group', 'tipo', 'fase', 'categoria'] },
];

const newRubricId = () => `rubric-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

/**
 * Detecta automáticamente el tipo de fila según el código/número del ítem:
 * - Sin número (vacío, guion, texto sin dígitos): Comentario
 * - Entero (1, 2, 10...) o con decimal 0 (1.0, 2.0, 1.0.0...): Grupo
 * - Decimal con dígitos distintos de cero (1.1, 1.2, 2.1...): Rubro
 */
export function detectRubricType(item: string): { group: boolean; comment: boolean } {
  const trimmed = item ? item.trim() : '';
  if (!trimmed || trimmed === '—' || trimmed === '-') {
    return { group: false, comment: true };
  }
  if (!/\d/.test(trimmed)) {
    return { group: false, comment: true };
  }
  const numMatch = trimmed.match(/^[\D]*(\d+(?:[.,]\d+)*)/);
  const numStr = numMatch ? numMatch[1].replace(/,/g, '.') : trimmed;

  const parts = numStr.split('.');
  if (parts.length === 1) {
    return { group: true, comment: false };
  }
  const allZeroDecimals = parts.slice(1).every((p) => /^0+$/.test(p));
  if (allZeroDecimals) {
    return { group: true, comment: false };
  }
  return { group: false, comment: false };
}

/** Convierte una fila del CSV en rubro con autodetección de tipo. */
export const rubricFromCsv = (rec: Record<string, string>, idx: number) => {
  const item = rec.item || '';
  const description = rec.description || '';
  if (!description && !item) return null;
  const g = normalizeText(rec.group || '');
  const isExplicitComment = ['comentario', 'nota', 'obs', 'comment'].includes(g);
  const isExplicitGroup = ['etapa', 'grupo', 'si', 'sí', 'true', 'x', '1'].includes(g);
  const type = detectRubricType(item);

  // Lo que dice la columna "grupo" del CSV manda sobre lo que se adivina por el número
  // (un grupo "A" o "I" sin dígitos no se vuelve comentario)
  if (isExplicitComment || (type.comment && !isExplicitGroup)) {
    return {
      id: newRubricId(),
      item,
      description: description || `Comentario ${idx + 1}`,
      percent: 0,
      group: false,
      comment: true,
    };
  }

  const group = isExplicitGroup || type.group;
  const percent = Math.max(0, Math.min(100, csvNumber(rec.percent) ?? 0));
  if (percent <= 0 && !group) return null;

  return {
    id: newRubricId(),
    item,
    description: description || `Rubro ${idx + 1}`,
    percent,
    group,
    comment: false,
  };
};

/** Compatibilidad: convierte el texto de un CSV en rubros. */
export function parseCSV(text: string) {
  const { records } = mapCsv(readCsv(text), RUBRIC_CSV_FIELDS);
  return records.map(rubricFromCsv).filter((r) => r !== null);
}
