import type { PageSetup } from './pageSetup';
import {
  ProjectData,
  RubricItem,
  PendingItem,
  PhotoItem,
  ObservationsData,
  BlockConfig,
} from '../types';
import type { ReportTheme } from '../theme/themes';
import {
  DEFAULT_PROJECT_DATA,
  DEFAULT_RUBRICS,
  DEFAULT_PENDINGS,
  DEFAULT_PHOTOS,
  DEFAULT_OBSERVATIONS,
  DEFAULT_BLOCKS,
} from './defaultData';
import { getCatalogTemplates } from './templateCatalog';

export interface ReportTemplateData {
  projectData: ProjectData;
  rubrics: RubricItem[];
  pendings: PendingItem[];
  photos: PhotoItem[];
  observations: ObservationsData;
  blocks: BlockConfig[];
  photoColumns?: 1 | 2 | 3 | 4;
  photoHeightMm?: number;
  /** Tema del informe (colores, fuentes, forma). Las plantillas viejas no lo tienen. */
  theme?: ReportTheme;
  /** Tamaño de papel, orientación y márgenes. Las plantillas viejas no lo tienen (A4 vertical). */
  pageSetup?: PageSetup;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category?: string;
  isBuiltIn?: boolean;
  createdAt: string;
  data: ReportTemplateData;
}

const STORAGE_KEY = 'a4_report_user_templates_v1';

/**
 * Returns built-in system templates
 */
export function getBuiltInTemplates(): ReportTemplate[] {
  return [
    ...getCatalogTemplates(),
    {
      id: 'builtin-standard',
      name: 'Reporte Semanal Estándar de Obra',
      description: 'Plantilla completa con resumen ejecutivo, indicadores, rubros de avance, fotografías de obra y cuadro de pendencias.',
      category: 'General',
      isBuiltIn: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      data: {
        projectData: DEFAULT_PROJECT_DATA,
        rubrics: DEFAULT_RUBRICS,
        pendings: DEFAULT_PENDINGS,
        photos: DEFAULT_PHOTOS,
        observations: DEFAULT_OBSERVATIONS,
        blocks: DEFAULT_BLOCKS,
        photoColumns: 2,
        photoHeightMm: 40,
      },
    },
    {
      id: 'builtin-scurve',
      name: 'Informe de Avance Físico y Curva S',
      description: 'Enfocado en la evolución física acumulada vs. programada mediante gráfico de Curva S, desglose de rubros y métricas.',
      category: 'Físico-Financiero',
      isBuiltIn: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      data: {
        projectData: {
          ...DEFAULT_PROJECT_DATA,
          reportTitle: 'INFORME DE AVANCE FÍSICO Y CURVA S',
        },
        rubrics: DEFAULT_RUBRICS,
        pendings: DEFAULT_PENDINGS,
        photos: DEFAULT_PHOTOS.slice(0, 2),
        observations: DEFAULT_OBSERVATIONS,
        blocks: [
          { id: 'header', type: 'header', title: 'Cabecera Institucional', pageIndex: 0, enabled: true, order: 0, showTitle: false },
          { id: 'contract_metrics', type: 'contract_metrics', title: 'Contrato e Indicadores', pageIndex: 0, enabled: true, order: 1, showTitle: false },
          { id: 'situation', type: 'situation', title: 'Situación Actual de Rubros', pageIndex: 0, enabled: true, order: 2, rubricsItems: DEFAULT_RUBRICS },
          { id: 'scurve-1', type: 'scurve', title: 'Curva S de Avance Físico Acumulado', pageIndex: 1, enabled: true, order: 3, showIndicators: true, showTable: true },
          { id: 'observations', type: 'observations', title: 'Observaciones y Firmas', pageIndex: 1, enabled: true, order: 4 },
          { id: 'footer', type: 'footer', title: 'Pie de Página', pageIndex: 1, enabled: true, order: 5, showTitle: false },
        ],
        photoColumns: 2,
        photoHeightMm: 45,
      },
    },
    {
      id: 'builtin-weather',
      name: 'Bitácora Climatológica y Actividades',
      description: 'Informe semanal para el registro de precipitaciones pluviales, días trabajados y memoria técnica descriptiva.',
      category: 'Diario de Campo',
      isBuiltIn: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      data: {
        projectData: {
          ...DEFAULT_PROJECT_DATA,
          reportTitle: 'BITÁCORA CLIMATOLÓGICA Y REGISTRO DE TRABAJO',
        },
        rubrics: DEFAULT_RUBRICS,
        pendings: DEFAULT_PENDINGS,
        photos: DEFAULT_PHOTOS.slice(0, 2),
        observations: DEFAULT_OBSERVATIONS,
        blocks: [
          { id: 'header', type: 'header', title: 'Cabecera Institucional', pageIndex: 0, enabled: true, order: 0, showTitle: false },
          { id: 'weather-1', type: 'weather', title: 'Registro Semanal de Clima y Lluvias', pageIndex: 0, enabled: true, order: 1, weatherMode: 'week' },
          { id: 'text-1', type: 'text', title: 'Memoria Técnica Semanal', pageIndex: 0, enabled: true, order: 2, textContent: 'Detalle de las actividades ejecutadas durante la semana, incidencias climatológicas e intervenciones de maquinaria...' },
          { id: 'photos', type: 'photos', title: 'Galería Fotográfica de Campo', pageIndex: 1, enabled: true, order: 3 },
          { id: 'observations', type: 'observations', title: 'Firmas de Conformidad', pageIndex: 1, enabled: true, order: 4 },
          { id: 'footer', type: 'footer', title: 'Pie de Página', pageIndex: 1, enabled: true, order: 5, showTitle: false },
        ],
        photoColumns: 2,
        photoHeightMm: 45,
      },
    },
    {
      id: 'builtin-blank',
      name: 'Plantilla Limpia / En Blanco',
      description: 'Estructura base con cabecera y pie de página, lista para armar un informe a medida desde cero.',
      category: 'Minimalista',
      isBuiltIn: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      data: {
        projectData: {
          ...DEFAULT_PROJECT_DATA,
          reportTitle: 'INFORME TÉCNICO DE OBRA',
          project: 'NOMBRE DEL PROYECTO',
        },
        rubrics: [],
        pendings: [],
        photos: [],
        observations: {
          notes: 'Observaciones generales del informe...',
          showSignatures: true,
          directorSignTitle: 'Dirección de Obras',
          directorSignName: 'Fiscalizador Principal',
          supervisorSignTitle: 'Supervisión Técnica',
          supervisorSignName: 'Inspector de Obra',
          contractorSignTitle: 'Contratista',
          contractorSignName: 'Director de Obra',
        },
        blocks: [
          { id: 'header', type: 'header', title: 'Cabecera Institucional', pageIndex: 0, enabled: true, order: 0, showTitle: false },
          { id: 'text-main', type: 'text', title: 'Memoria Descriptiva', pageIndex: 0, enabled: true, order: 1, textContent: 'Escriba aquí la memoria explicativa...' },
          { id: 'observations', type: 'observations', title: 'Observaciones y Firmas', pageIndex: 0, enabled: true, order: 2 },
          { id: 'footer', type: 'footer', title: 'Pie de Documento', pageIndex: 0, enabled: true, order: 3, showTitle: false },
        ],
        photoColumns: 2,
        photoHeightMm: 40,
      },
    },
  ];
}

/**
 * Retrieves user-saved templates from LocalStorage
 */
export function getSavedTemplates(): ReportTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error loading saved templates from localStorage', err);
    return [];
  }
}

/**
 * Saves a new template to LocalStorage
 */
export function saveTemplate(
  name: string,
  description: string,
  category: string,
  data: ReportTemplateData
): ReportTemplate {
  const newTemplate: ReportTemplate = {
    id: `tpl-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    name: name.trim() || 'Plantilla Personalizada',
    description: description.trim() || 'Plantilla guardada por el usuario',
    category: category.trim() || 'Personalizadas',
    isBuiltIn: false,
    createdAt: new Date().toISOString(),
    data,
  };

  const existing = getSavedTemplates();
  const updated = [newTemplate, ...existing];

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Error saving template to localStorage', err);
  }

  return newTemplate;
}

/**
 * Deletes a saved template by ID
 */
export function deleteTemplate(id: string): boolean {
  const existing = getSavedTemplates();
  const filtered = existing.filter((t) => t.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (err) {
    console.error('Error deleting template from localStorage', err);
    return false;
  }
}

/**
 * Exports a template object as a downloadable JSON file
 */
export function exportTemplateToJsonFile(template: ReportTemplate) {
  const blob = new Blob([JSON.stringify(template, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `plantilla_${template.name.toLowerCase().replace(/\s+/g, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- Última plantilla usada: se abre sola al iniciar ---------- */

const LAST_KEY = 'a4_report_last_template_v1';

export function getLastTemplateId(): string | null {
  try { return localStorage.getItem(LAST_KEY); } catch { return null; }
}

export function setLastTemplateId(id: string) {
  try { localStorage.setItem(LAST_KEY, id); } catch { /* sin almacenamiento */ }
}

export function clearLastTemplateId() {
  try { localStorage.removeItem(LAST_KEY); } catch { /* noop */ }
}

/** Busca una plantilla (de fábrica o guardada) por su id. */
export function findTemplateById(id: string | null): ReportTemplate | null {
  if (!id) return null;
  return [...getBuiltInTemplates(), ...getSavedTemplates()].find((t) => t.id === id) ?? null;
}

/** La ventana de bienvenida se muestra al iniciar salvo que el usuario la haya desactivado. */
export function shouldShowWelcome(): boolean {
  try { return localStorage.getItem('a4_report_welcome_hidden_v1') !== '1'; } catch { return true; }
}
