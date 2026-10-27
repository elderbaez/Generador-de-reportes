import { RubricItem } from '../types';

export function parsePercent(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const str = String(value)
    .replace(/["%]/g, '')
    .trim()
    .replace(',', '.');
  const num = parseFloat(str);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, num));
}

export function parseCSV(text: string): RubricItem[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return [];

  const firstLine = lines[0];
  let delim = ';';
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  if (tabCount > semicolonCount && tabCount > commaCount) {
    delim = '\t';
  } else if (commaCount > semicolonCount) {
    delim = ',';
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && inQuotes && text[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delim && !inQuotes) {
      currentRow.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') {
        i++;
      }
      currentRow.push(cell);
      if (currentRow.some((c) => c.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  currentRow.push(cell);
  if (currentRow.some((c) => c.trim().length > 0)) {
    rows.push(currentRow);
  }

  if (rows.length < 2) return [];

  const normalize = (s: string) =>
    String(s ?? '')
      .replace(/^\uFEFF/, '')
      .replace(/^="?|"?$/g, '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const headers = rows[0].map(normalize);
  const findIdx = (...keywords: string[]) =>
    headers.findIndex((h) => keywords.some((k) => h.includes(k)));

  const itemIdx = findIdx('item', 'n item', 'nº', 'numero', 'codigo', 'cod');
  const descIdx = findIdx('descricao', 'description', 'rubro', 'actividad', 'detalle', 'tarea');
  const groupIdx = findIdx('etapa', 'group', 'tipo', 'fase', 'categoria');
  const percentIdx = findIdx('porcentagem', 'porcentaje', 'percentual', 'avance', 'progresso', '%');

  const dataRows = rows.slice(1);
  const rubrics: RubricItem[] = [];

  dataRows.forEach((r, idx) => {
    const getCell = (colIdx: number) =>
      colIdx >= 0 ? (r[colIdx] || '').replace(/^="?|"?$/g, '').trim() : '';

    const itemCode = getCell(itemIdx);
    const description = getCell(descIdx) || (itemIdx === -1 ? getCell(0) : '');
    const percent = parsePercent(getCell(percentIdx));
    const groupRaw = normalize(getCell(groupIdx));
    const isGroup =
      groupRaw === 'etapa' ||
      groupRaw === 'grupo' ||
      groupRaw === 'si' ||
      groupRaw === 'true' ||
      (itemCode.length > 0 && !itemCode.includes('.') && itemCode.endsWith('0'));

    // Only import rubrics with progress greater than 0% (ignore 0% activities)
    if ((description || itemCode) && percent > 0) {
      rubrics.push({
        id: `rubric-${Date.now()}-${idx}`,
        item: itemCode,
        description: description || `Rubro ${idx + 1}`,
        percent,
        group: isGroup,
      });
    }
  });

  return rubrics;
}
