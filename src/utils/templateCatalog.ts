import type { BlockConfig, ObservationsData, ProjectData, SignatureItem, SpecItem, PendingItem } from '../types';
import type { ReportTemplate } from './templateManager';
import { DEFAULT_PROJECT_DATA } from './defaultData';
import { exampleTasks } from './gantt';
import { BUILT_IN_THEMES, ReportTheme } from '../theme/themes';
import type { PageSetup } from './pageSetup';
import type { HeaderConfig, HeaderLevel } from './header';

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
    ...getEverydayTemplates(),
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


/* =====================================================================
   Plantillas de uso cotidiano (no técnicas). Cada una trae su propio tema y su
   hoja: se ve de una la diferencia entre un memo, un afiche o una cotización.
   ===================================================================== */

const theme = (id: string, extraCss = ''): ReportTheme => {
  const t = BUILT_IN_THEMES.find((x) => x.id === id) ?? BUILT_IN_THEMES[0];
  return { ...t, customCss: `${t.customCss || ''}${extraCss ? `\n${extraCss}` : ''}` || undefined };
};

const hid = () => `h${Math.random().toString(36).slice(2, 8)}`;
const hdr = (layout: HeaderConfig['layout'], lines: [string, HeaderLevel][], meta: [string, string][] = []): HeaderConfig => ({
  layout,
  lines: lines.map(([text, level]) => ({ id: hid(), text, level })),
  meta: meta.map(([label, value]) => ({ id: hid(), label, value })),
  strip: { left: '{titulo}', center: '{direccion}', right: 'Hoja {pagina} de {paginas}' },
});

const everyday = (
  id: string, name: string, category: string, description: string,
  projectData: ProjectData, blocks: BlockConfig[], opts: { theme: ReportTheme; page?: Partial<PageSetup>; columns?: 1 | 2 | 3 | 4 },
): ReportTemplate => {
  const base = tpl(id, name, category, description, projectData, blocks, opts.columns ?? 2);
  return {
    ...base,
    data: {
      ...base.data,
      theme: opts.theme,
      pageSetup: { paper: 'a4', orientation: 'portrait', margins: { t: 0, r: 0, b: 0, l: 0 }, ...opts.page },
    },
  };
};

const plain = (reportTitle: string, extra: Partial<ProjectData> = {}): ProjectData => project(reportTitle, {
  director: 'NOMBRE DE LA EMPRESA U ORGANIZACIÓN', project: reportTitle, footerLeft: 'Nombre de la empresa u organización', footerRight: '', ...extra,
});

function getEverydayTemplates(): ReportTemplate[] {
  return [
    everyday('cat-memo', 'Memorando', 'Oficina',
      'Comunicación interna breve: para, de, fecha y asunto. Estilo máquina de escribir, sin adornos.',
      plain('MEMORANDO', { header: hdr('institutional', [['{direccion}', 'sm'], ['MEMORANDO', 'xl'], ['N.º 000 / 2026', 'accent']]) }),
      [
        blk('header', 'Cabecera', { showTitle: false }),
        blk('text', 'Datos', { showTitle: false, textContent: '| Campo | Dato |\n|---|---|\n| **PARA:** | Nombre y cargo |\n| **DE:** | Nombre y cargo |\n| **FECHA:** | dd de mes de aaaa |\n| **ASUNTO:** | Resumen en una línea |' }),
        blk('text', 'Mensaje', { showTitle: false, textContent: 'Estimado/a:\n\nEscriba aquí el mensaje. Vaya directo al punto: qué se necesita, para cuándo y quién se encarga.\n\n- Punto importante 1\n- Punto importante 2\n\nQuedo a disposición para cualquier consulta.\n\nSaludos cordiales,' }),
        blk('signatures', 'Firma', { showTitle: false, signaturesItems: sign(['Cargo', 'Nombre y apellido']) }),
        footer(),
      ], { theme: theme('maquina'), page: { margins: { t: 8, r: 6, b: 8, l: 6 } } }),

    everyday('cat-carta', 'Carta formal', 'Oficina',
      'Carta con membrete, destinatario, cuerpo y firma. Estilo editorial, de aspecto sobrio y elegante.',
      plain('CARTA', { header: hdr('institutional', [['{direccion}', 'sm'], ['Membrete o nombre de la empresa', 'xl'], ['Dirección · Teléfono · Correo', 'xs']]) }),
      [
        blk('header', 'Membrete', { showTitle: false }),
        blk('text', 'Carta', { showTitle: false, textContent: 'Ciudad, dd de mes de aaaa\n\n**Nombre del destinatario**  \nCargo  \nEmpresa u organización  \nDirección\n\n**Ref.:** asunto de la carta\n\nEstimado/a señor/a:\n\nPrimer párrafo: presente el motivo de la carta de forma clara.\n\nSegundo párrafo: desarrolle los detalles, fechas o condiciones relevantes.\n\nTercer párrafo: cierre indicando el próximo paso esperado.\n\nSin otro particular, saludo a usted atentamente.' }),
        blk('signatures', 'Firma', { showTitle: false, signaturesItems: sign(['Cargo', 'Nombre y apellido']) }),
        footer(),
      ], { theme: theme('editorial'), page: { margins: { t: 6, r: 14, b: 8, l: 14 } } }),

    everyday('cat-comunicado', 'Comunicado / circular', 'Oficina',
      'Aviso para todo el personal o la comunidad: titular grande, mensaje, fechas importantes y contacto. Estilo suizo.',
      plain('COMUNICADO', { header: hdr('institutional', [['{direccion}', 'sm'], ['COMUNICADO', 'xl'], ['Asunto del comunicado', 'accent']]) }),
      [
        blk('header', 'Cabecera', { showTitle: false }),
        blk('text', 'Mensaje', { showTitle: false, textContent: '## Qué está pasando\nExplique la novedad en dos o tres frases claras.\n\n## Qué tiene que hacer cada persona\n1. Primer paso\n2. Segundo paso\n3. Tercer paso' }),
        blk('observations', 'Fechas importantes', { obsStyle: 'warning', obsLabel: 'Fecha límite', obsNotes: 'Indique aquí la fecha, el horario y el lugar.' }),
        blk('text', 'Contacto', { textContent: 'Consultas: nombre · teléfono · correo electrónico.' }),
        footer(),
      ], { theme: theme('suizo') }),

    everyday('cat-afiche', 'Afiche / cartel', 'Eventos y difusión',
      'Cartel vertical A3 para pegar o imprimir: titular enorme, frase, fecha, hora y lugar. Estilo pop de bordes gruesos.',
      plain('GRAN EVENTO', { director: 'ENTRADA LIBRE Y GRATUITA' }),
      [
        blk('cover', 'Afiche', { showTitle: false, coverLayout: 'classic', coverKicker: 'Entrada libre y gratuita', coverTitle: 'Título del evento', coverSubtitle: 'Una frase que cuente de qué se trata', coverMeta: [
          { id: 'm1', label: 'Fecha', value: 'Sábado 00 de mes' },
          { id: 'm2', label: 'Hora', value: '00:00 hs.' },
          { id: 'm3', label: 'Lugar', value: 'Dirección del lugar' },
          { id: 'm4', label: 'Informes', value: 'Teléfono o red social' },
        ], coverNote: 'Auspician: nombre de las organizaciones' }),
      ], { theme: theme('pop', ':scope .rp-cover-title { font-size: 96pt; line-height: .95; color: var(--rp-primary); text-shadow: 6px 6px 0 var(--rp-label); }\n:scope .rp-cover-subtitle { font-size: 26pt; color: var(--rp-label); text-transform: none; }\n:scope .rp-cover-kicker { font-size: 20pt; }\n:scope .rp-cover-meta { font-size: 22pt; }\n:scope .rp-cover-meta-label { font-size: 14pt; }\n:scope .rp-cover { background: var(--rp-surface-1); }\n:scope .rp-cover--classic .rp-cover-band { background: var(--rp-accent); min-height: 26mm; padding: 0; border-bottom: 3mm solid var(--rp-label); }\n:scope .rp-cover--classic .rp-cover-photo { display: none; }\n:scope .rp-cover--classic .rp-cover-titles { gap: 10mm; }'), page: { paper: 'a3' } }),

    everyday('cat-pancarta', 'Pancarta horizontal', 'Eventos y difusión',
      'Banner apaisado de 60 × 20 cm con mensaje grande. Se edita el texto desde el código HTML del bloque. Estilo neón sobre fondo oscuro.',
      plain('PANCARTA'),
      [
        blk('html', 'Pancarta', { showTitle: false, htmlCode:
          '<div style="height:196mm;display:flex;align-items:center;justify-content:space-between;padding:0 28mm;box-sizing:border-box;background:linear-gradient(110deg,#0c0720,#2b0f63 60%,#ff2d95 160%)">\n  <div>\n    <div style="font-family:var(--rp-font-title);font-size:92pt;line-height:1;color:#7df9ff;text-shadow:0 0 18px #7df9ff">BIENVENIDOS</div>\n    <div style="font-family:var(--rp-font-body);font-size:34pt;color:#f9f871;margin-top:6mm;text-shadow:0 0 12px #f9f871">Mensaje de la pancarta</div>\n  </div>\n  <div style="font-family:var(--rp-font-title);font-size:60pt;color:#ff2d95;text-shadow:0 0 16px #ff2d95;border:3px solid #ff2d95;border-radius:50%;width:80mm;height:80mm;display:flex;align-items:center;justify-content:center">2026</div>\n</div>' }),
      ], { theme: theme('neon'), page: { paper: 'custom', orientation: 'landscape', customW: 200, customH: 600 } }),

    everyday('cat-invitacion', 'Invitación', 'Eventos y difusión',
      'Tarjeta tamaño A5 para una celebración, charla o inauguración. Estilo editorial, de tipografía con serifa.',
      plain('INVITACIÓN'),
      [
        blk('cover', 'Invitación', { showTitle: false, coverLayout: 'minimal', coverKicker: 'Tenemos el gusto de invitarte a', coverTitle: 'Nombre del evento', coverSubtitle: 'Frase breve de bienvenida', coverMeta: [
          { id: 'm1', label: 'Cuándo', value: 'Fecha y hora' },
          { id: 'm2', label: 'Dónde', value: 'Lugar y dirección' },
          { id: 'm3', label: 'Confirmar', value: 'Nombre · teléfono' },
        ], coverNote: 'Se agradece confirmar asistencia.' }),
      ], { theme: theme('editorial', ':scope .rp-cover--minimal { padding: 14mm 14mm 12mm; }\n:scope .rp-cover-title { font-size: 28pt; font-style: italic; }'), page: { paper: 'custom', customW: 148, customH: 210 } }),

    everyday('cat-certificado', 'Certificado / reconocimiento', 'Eventos y difusión',
      'Diploma apaisado con nombre destacado, motivo y firmas. Se imprime en A4 horizontal.',
      plain('CERTIFICADO'),
      [
        blk('cover', 'Certificado', { showTitle: false, coverLayout: 'minimal', coverKicker: 'Se otorga el presente', coverTitle: 'Certificado de reconocimiento', coverSubtitle: 'Nombre y apellido de la persona', coverMeta: [
          { id: 'm1', label: 'Por', value: 'Motivo del reconocimiento' },
          { id: 'm2', label: 'Fecha', value: 'Ciudad, dd de mes de aaaa' },
        ], coverNote: '' }),
      ], { theme: theme('editorial', ':scope { border: 7px double #1c1a17; box-sizing: border-box; }\n:scope .rp-cover--minimal { padding: 20mm 26mm; text-align: center; }\n:scope .rp-cover--minimal .rp-cover-body { justify-content: center; text-align: center; }\n:scope .rp-cover--minimal .rp-cover-bar { display: none; }\n:scope .rp-cover-meta { grid-template-columns: 1fr; row-gap: 0; text-align: center; margin-top: 8mm; }\n:scope .rp-cover-meta-label { padding-top: 3mm; }\n:scope .rp-cover-title { font-size: 34pt; }\n:scope .rp-cover-subtitle { font-size: 22pt; font-style: italic; text-transform: none; color: #b4452c; }'), page: { orientation: 'landscape' } }),

    everyday('cat-cotizacion', 'Cotización / presupuesto', 'Ventas',
      'Presupuesto con tabla de ítems, subtotal e impuestos, condiciones de pago y aceptación del cliente.',
      plain('COTIZACIÓN', { header: hdr('iso', [['{direccion}', 'sm'], ['COTIZACIÓN', 'xl'], ['Servicio o proyecto cotizado', 'md']], [['N.º', '000'], ['Fecha', '{fecha}'], ['Validez', '15 días'], ['Hoja', '{pagina} de {paginas}']]) }),
      [
        blk('header', 'Cabecera', { showTitle: false }),
        blk('text', 'Cliente', { textContent: '| Dato | Detalle |\n|---|---|\n| Cliente | Nombre o razón social |\n| RUC / documento | |\n| Contacto | Nombre · teléfono · correo |' }),
        blk('text', 'Detalle', { textContent: '| Ítem | Descripción | Cant. | P. unitario | Total |\n|---|---|---:|---:|---:|\n| 1 | Descripción del producto o servicio | 1 | 0 | 0 |\n| 2 | Descripción del producto o servicio | 1 | 0 | 0 |\n| 3 | Descripción del producto o servicio | 1 | 0 | 0 |\n| | **Subtotal** | | | **0** |\n| | **IVA 10 %** | | | **0** |\n| | **TOTAL** | | | **0** |' }),
        blk('observations', 'Condiciones', { obsStyle: 'info', obsLabel: 'Condiciones', obsNotes: 'Forma de pago, plazo de entrega, garantía y validez de la oferta.' }),
        blk('signatures', 'Aceptación', { signaturesItems: sign(['Por la empresa', 'Nombre y apellido'], ['Aceptación del cliente', 'Firma y fecha']) }),
        footer(),
      ], { theme: theme('azul-corporativo') }),

    everyday('cat-planificador', 'Planificador semanal', 'Personal y equipos',
      'Una hoja para organizar la semana: prioridades, tareas por día y notas. Casillas para tildar.',
      plain('PLANIFICADOR SEMANAL', { director: 'SEMANA DEL __ AL __', header: hdr('institutional', [['{direccion}', 'sm'], ['MI SEMANA', 'xl'], ['Prioridades y tareas', 'accent']]) }),
      [
        blk('header', 'Cabecera', { showTitle: false }),
        blk('observations', 'Prioridades', { obsStyle: 'success', obsLabel: 'Las 3 prioridades', obsNotes: '1. \n2. \n3. ' }),
        blk('text', 'Lunes', { id: 'day-l', textContent: '- [ ] Tarea\n- [ ] Tarea\n- [ ] Tarea' }),
        blk('text', 'Martes', { rowWith: 'day-l', textContent: '- [ ] Tarea\n- [ ] Tarea\n- [ ] Tarea' }),
        blk('text', 'Miércoles', { id: 'day-x', textContent: '- [ ] Tarea\n- [ ] Tarea\n- [ ] Tarea' }),
        blk('text', 'Jueves', { rowWith: 'day-x', textContent: '- [ ] Tarea\n- [ ] Tarea\n- [ ] Tarea' }),
        blk('text', 'Viernes', { id: 'day-v', textContent: '- [ ] Tarea\n- [ ] Tarea\n- [ ] Tarea' }),
        blk('text', 'Fin de semana', { rowWith: 'day-v', textContent: '- [ ] Tarea\n- [ ] Tarea' }),
        blk('text', 'Notas', { textContent: 'Ideas, pendientes y recordatorios.' }),
        footer(),
      ], { theme: theme('pop') }),
  ];
}
