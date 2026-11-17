import type { BlockConfig, ObservationsData, ProjectData, SignatureItem, SpecItem, PendingItem } from '../types';
import type { ReportTemplate } from './templateManager';
import { DEFAULT_PROJECT_DATA } from './defaultData';
import { exampleTasks } from './gantt';

/**
 * Plantillas de fábrica de uso general (visitas, inspecciones, actas, etc.).
 * Cada una arma los bloques que ya existen en el editor; no hay nada nuevo que
 * mantener: el usuario las modifica igual que cualquier informe.
 */

const DATE = '2026-01-01T00:00:00.000Z';

const project = (reportTitle: string, extra: Partial<ProjectData> = {}): ProjectData => ({
  ...DEFAULT_PROJECT_DATA,
  director: 'NOMBRE DE LA INSTITUCIÓN / EMPRESA',
  project: 'NOMBRE DE LA OBRA O PROYECTO',
  contract: '',
  contractor: '',
  contractValue: '',
  measurement: '',
  footerLeft: 'Nombre de la institución / empresa',
  footerRight: reportTitle,
  reportTitle,
  ...extra,
});

let n = 0;
const blk = (type: BlockConfig['type'], title: string, extra: Partial<BlockConfig> = {}): BlockConfig => {
  n += 1;
  return { id: `${type}-${n}`, type, title, pageIndex: 0, enabled: true, order: 0, ...extra };
};
/** Numera el orden y reparte los bloques en la hoja 1 (el paginador reparte el resto solo). */
const seq = (list: BlockConfig[]): BlockConfig[] => list.map((b, i) => ({ ...b, order: i }));
const header = () => blk('header', 'Cabecera', { showTitle: false });
const footer = () => blk('footer', 'Pie de página', { showTitle: false });

const sign = (...roles: [string, string][]): SignatureItem[] =>
  roles.map(([roleTitle, name], i) => ({ id: `sg-${i}`, roleTitle, name }));

const spec = (item: string, description: string, specification: string, resultOrStatus: SpecItem['resultOrStatus'] = 'En ensayo', notes = ''): SpecItem => ({
  id: `sp-${item}-${Math.random().toString(36).slice(2, 6)}`, item, description, specification, resultOrStatus, notes,
});

const pend = (description: string, responsible: string, impact: PendingItem['impact'], status: PendingItem['status'] = 'Pendiente'): PendingItem => ({
  id: `pd-${Math.random().toString(36).slice(2, 7)}`, description, responsible, deadline: 'dd/mm/aaaa', impact, status,
});

const noObs: ObservationsData = {
  notes: '',
  showSignatures: false,
  directorSignTitle: '', directorSignName: '',
  supervisorSignTitle: '', supervisorSignName: '',
  contractorSignTitle: '', contractorSignName: '',
};

const tpl = (id: string, name: string, category: string, description: string, projectData: ProjectData, blocks: BlockConfig[], photoColumns: 1 | 2 | 3 | 4 = 2): ReportTemplate => ({
  id, name, category, description, isBuiltIn: true, createdAt: DATE,
  data: {
    projectData, rubrics: [], pendings: [], photos: [], observations: noObs,
    blocks: seq(blocks), photoColumns, photoHeightMm: 55,
  },
});

export function getCatalogTemplates(): ReportTemplate[] {
  n = 0;
  return [
    tpl('cat-visita', 'Informe de visita a obra', 'Visitas',
      'Registro de una visita de campo: datos de la visita, ubicación, observaciones, fotos, hallazgos y conclusiones.',
      project('INFORME DE VISITA A OBRA'),
      [
        header(),
        blk('text', 'Datos de la visita', { textContent:
          '| Dato | Detalle |\n|---|---|\n| Fecha y hora | |\n| Lugar / frente de obra | |\n| Visita realizada por | |\n| Acompañantes | |\n| Condiciones climáticas | |\n| Motivo de la visita | |' }),
        blk('map', 'Ubicación', { mapCoordMode: 'geo', mapEast: '-57,5759', mapNorth: '-25,2637', mapZoom: 15, mapHeightMm: 60, mapLabel: 'Punto de visita', mapShowScale: true, mapShowNorth: true }),
        blk('text', 'Observaciones generales', { textContent: '## Estado general\nDescriba el estado de avance y las condiciones encontradas.\n\n## Actividades en ejecución\n- \n- \n\n## Personal y equipos en el frente\n- ' }),
        blk('photos', 'Registro fotográfico', { photos: [], photoColumns: 2, photoPrefix: 'Foto' }),
        blk('pending', 'Hallazgos y acciones requeridas', { pendingsItems: [
          pend('Describa el hallazgo o acción a realizar.', 'Responsable', 'MEDIO'),
        ] }),
        blk('text', 'Conclusiones y recomendaciones', { textContent: 'Resuma las conclusiones de la visita y las recomendaciones al equipo.' }),
        blk('signatures', 'Firmas', { signaturesItems: sign(['Visitante', 'Nombre y apellido'], ['Responsable de obra', 'Nombre y apellido']) }),
        footer(),
      ]),

    tpl('cat-inspeccion', 'Acta de inspección', 'Inspección',
      'Lista de verificación con resultado conforme / no conforme por ítem, evidencias fotográficas y firmas de conformidad.',
      project('ACTA DE INSPECCIÓN'),
      [
        header(),
        blk('text', 'Datos de la inspección', { textContent:
          '| Dato | Detalle |\n|---|---|\n| Fecha | |\n| Inspector | |\n| Área / elemento inspeccionado | |\n| Documentos de referencia | |' }),
        blk('specs', 'Puntos verificados', { specsItems: [
          spec('1', 'Elemento o actividad a verificar', 'Criterio de aceptación o norma', 'Conforme'),
          spec('2', 'Elemento o actividad a verificar', 'Criterio de aceptación o norma', 'No conforme', 'Detalle de la desviación'),
          spec('3', 'Elemento o actividad a verificar', 'Criterio de aceptación o norma', 'Observado'),
        ] }),
        blk('observations', 'Observaciones del inspector', { obsStyle: 'warning', obsNotes: 'Detalle las no conformidades y las correcciones exigidas.' }),
        blk('photos', 'Evidencias', { photos: [], photoColumns: 2, photoPrefix: 'Foto' }),
        blk('signatures', 'Conformidad', { signaturesItems: sign(['Inspector', 'Nombre y apellido'], ['Responsable de la obra', 'Nombre y apellido']) }),
        footer(),
      ]),

    tpl('cat-incidente', 'Informe de incidente o no conformidad', 'Seguridad y calidad',
      'Descripción de un hecho, causas, evidencias y plan de acciones correctivas con responsables y plazos.',
      project('INFORME DE INCIDENTE / NO CONFORMIDAD'),
      [
        header(),
        blk('text', 'Identificación', { textContent:
          '| Dato | Detalle |\n|---|---|\n| N.º de informe | |\n| Fecha y hora del hecho | |\n| Lugar | |\n| Personas / equipos involucrados | |\n| Gravedad | |' }),
        blk('text', 'Descripción de los hechos', { textContent: 'Relate qué ocurrió, en orden cronológico y sin interpretaciones.' }),
        blk('text', 'Análisis de causas', { textContent: '- Causa inmediata: \n- Causa raíz: \n- Factores contribuyentes: ' }),
        blk('photos', 'Evidencias', { photos: [], photoColumns: 2, photoPrefix: 'Foto' }),
        blk('observations', 'Impacto', { obsStyle: 'critical', obsNotes: 'Indique daños, riesgos o demoras generadas.' }),
        blk('pending', 'Plan de acciones correctivas', { pendingsItems: [
          pend('Acción inmediata de contención.', 'Responsable', 'ALTO', 'En ejecución'),
          pend('Acción correctiva definitiva.', 'Responsable', 'MEDIO'),
          pend('Acción preventiva para evitar la repetición.', 'Responsable', 'BAJO'),
        ] }),
        blk('signatures', 'Firmas', { signaturesItems: sign(['Elaboró', 'Nombre y apellido'], ['Revisó', 'Nombre y apellido'], ['Aprobó', 'Nombre y apellido']) }),
        footer(),
      ]),

    tpl('cat-calidad', 'Control de calidad y ensayos', 'Calidad',
      'Tabla de ensayos con especificación y resultado, interpretación técnica y registro fotográfico de la toma de muestras.',
      project('INFORME DE CONTROL DE CALIDAD'),
      [
        header(),
        blk('text', 'Alcance', { textContent: 'Indique el material, la partida o el elemento controlado y las normas aplicadas.' }),
        blk('specs', 'Resultados de ensayos', { specsItems: [
          spec('E-01', 'Ensayo o parámetro', 'Valor mínimo / máximo exigido', 'Aprobado', 'Valor obtenido: '),
          spec('E-02', 'Ensayo o parámetro', 'Valor mínimo / máximo exigido', 'Conforme', 'Valor obtenido: '),
          spec('E-03', 'Ensayo o parámetro', 'Valor mínimo / máximo exigido', 'En ensayo'),
        ] }),
        blk('text', 'Interpretación de resultados', { textContent: 'Analice si los resultados cumplen lo especificado y qué acciones corresponden.' }),
        blk('photos', 'Toma de muestras y ensayos', { photos: [], photoColumns: 3, photoPrefix: 'Foto' }),
        blk('signatures', 'Responsables', { signaturesItems: sign(['Laboratorio', 'Nombre y apellido'], ['Control de calidad', 'Nombre y apellido']) }),
        footer(),
      ], 3),

    tpl('cat-seguridad', 'Inspección de seguridad y salud', 'Seguridad y calidad',
      'Lista de control de seguridad en obra (EPP, señalización, orden y limpieza) con evidencias y acciones.',
      project('INSPECCIÓN DE SEGURIDAD Y SALUD OCUPACIONAL'),
      [
        header(),
        blk('text', 'Lista de control', { textContent:
          '## Equipos de protección personal\n- [ ] Casco y calzado de seguridad\n- [ ] Chaleco reflectivo\n- [ ] Protección auditiva / visual cuando corresponde\n\n## Condiciones del frente\n- [ ] Señalización y delimitación de áreas\n- [ ] Orden y limpieza\n- [ ] Extintores y botiquín disponibles\n\n## Trabajos de riesgo\n- [ ] Permisos de trabajo vigentes\n- [ ] Andamios y escaleras en buen estado\n- [ ] Excavaciones entibadas y protegidas' }),
        blk('observations', 'Desvíos detectados', { obsStyle: 'warning', obsNotes: 'Detalle los desvíos encontrados y su ubicación.' }),
        blk('photos', 'Evidencias', { photos: [], photoColumns: 2, photoPrefix: 'Foto' }),
        blk('pending', 'Acciones correctivas', { pendingsItems: [
          pend('Describa la acción correctiva.', 'Responsable de seguridad', 'ALTO'),
        ] }),
        blk('signatures', 'Firmas', { signaturesItems: sign(['Inspector de seguridad', 'Nombre y apellido'], ['Responsable de obra', 'Nombre y apellido']) }),
        footer(),
      ]),

    tpl('cat-reunion', 'Acta de reunión', 'Gestión',
      'Participantes, orden del día, temas tratados, compromisos con responsable y plazo, y firmas.',
      project('ACTA DE REUNIÓN'),
      [
        header(),
        blk('text', 'Datos de la reunión', { textContent:
          '| Dato | Detalle |\n|---|---|\n| Fecha y hora | |\n| Lugar / modalidad | |\n| Convocada por | |\n\n## Participantes\n| Nombre | Cargo / Empresa |\n|---|---|\n| | |\n| | |' }),
        blk('text', 'Orden del día', { textContent: '1. \n2. \n3. ' }),
        blk('text', 'Temas tratados', { textContent: '## Tema 1\nResumen de lo discutido y decidido.\n\n## Tema 2\nResumen de lo discutido y decidido.' }),
        blk('pending', 'Compromisos y próximos pasos', { pendingsItems: [
          pend('Compromiso asumido.', 'Responsable', 'MEDIO'),
          pend('Compromiso asumido.', 'Responsable', 'MEDIO'),
        ] }),
        blk('signatures', 'Firmas de los participantes', { signaturesItems: sign(['Participante', 'Nombre y apellido'], ['Participante', 'Nombre y apellido'], ['Participante', 'Nombre y apellido']) }),
        footer(),
      ]),

    tpl('cat-fotografico', 'Informe fotográfico', 'Visitas',
      'Álbum de fotos numeradas con pie descriptivo; ideal para registrar el estado de un sitio o una etapa.',
      project('INFORME FOTOGRÁFICO'),
      [
        header(),
        blk('text', 'Introducción', { textContent: 'Indique el sitio, la fecha del registro y el propósito de las imágenes.' }),
        blk('photos', 'Registro fotográfico', { photos: [], photoColumns: 2, photoPrefix: 'Foto', photoHeightMm: 70 }),
        blk('footer', 'Pie de página', { showTitle: false }),
      ]),

    tpl('cat-cronograma', 'Cronograma y plan de trabajos', 'Planificación',
      'Diagrama de Gantt con avance y ruta crítica, más notas de planificación y riesgos.',
      project('CRONOGRAMA Y PLAN DE TRABAJOS'),
      [
        header(),
        blk('gantt', 'Cronograma de actividades', { ganttTasks: exampleTasks(), ganttScale: 'week', ganttShowToday: true, ganttShowProgress: true, ganttCaption: 'Cronograma general de la obra', ganttPrefix: 'Figura' }),
        blk('text', 'Hitos y supuestos', { textContent: '- Hito 1: \n- Hito 2: \n\n**Supuestos:** condiciones asumidas para la programación.' }),
        blk('observations', 'Riesgos a la programación', { obsStyle: 'info', obsNotes: 'Indique los riesgos que pueden afectar los plazos.' }),
        footer(),
      ]),

    tpl('cat-tecnico', 'Informe técnico', 'General',
      'Documento largo con portada, índice automático, secciones de texto, diagrama y firmas. Sirve para memorias, estudios o dictámenes.',
      project('INFORME TÉCNICO'),
      [
        blk('cover', 'Portada', { showTitle: false, coverLayout: 'classic', coverKicker: '{direccion}', coverTitle: '{titulo}', coverSubtitle: '{obra}' }),
        blk('toc', 'Índice', { forceNewPage: true }),
        blk('text', '1. Antecedentes', { forceNewPage: true, textContent: '# 1. Antecedentes\nContexto y motivo del informe.' }),
        blk('text', '2. Análisis', { textContent: '# 2. Análisis\nDesarrollo técnico. Puede usar tablas, listas, ecuaciones $E = mc^2$ y diagramas.' }),
        blk('diagram', 'Diagrama de proceso', { diagramCode: 'flowchart LR\n  A[Datos] --> B[Análisis] --> C[Conclusiones]', diagramCaption: 'Esquema general', diagramPrefix: 'Figura' }),
        blk('text', '3. Conclusiones', { textContent: '# 3. Conclusiones\nResumen de resultados y recomendaciones.' }),
        blk('signatures', 'Firmas', { signaturesItems: sign(['Elaboró', 'Nombre y apellido'], ['Revisó', 'Nombre y apellido']) }),
        footer(),
      ], 2),
  ];
}
