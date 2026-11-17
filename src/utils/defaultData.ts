import {
  ProjectData,
  RubricItem,
  PendingItem,
  PhotoItem,
  ObservationsData,
  BlockConfig,
} from '../types';

export const DEFAULT_PROJECT_DATA: ProjectData = {
  director: 'DIRECCIÓN TÉCNICA · SUPERVISIÓN GENERAL DE OBRAS',
  project: 'REHABILITACIÓN Y AMPLIACIÓN DE INFRAESTRUCTURA URBANA Y OBRAS CIVILES',
  reportDate: new Date().toISOString().split('T')[0],
  startDate: '2026-10-01',
  endDate: '2027-03-30',
  contract: 'LPN N.º 08/2026 – Construcción y Rehabilitación de Obras Civiles',
  contractor: 'CONSORCIO CONSTRUCTOR DE OBRAS CIVILES',
  contractValue: '18.500.000.000',
  measurement: '2.775.000.000',
  timeProgress: 20.0,
  financialProgress: 15.0,
  physicalProgress: 16.5,
  logoUrl: '',
  invertLogoColor: false,
  footerLeft: 'Supervisión Técnica de Obras Civiles',
  footerRight: 'Reporte Semanal de Avance Físico-Financiero',
  reportTitle: 'REPORTE SEMANAL DE OBRA',
};

export const DEFAULT_RUBRICS: RubricItem[] = [
  {
    id: 'r-1',
    item: '1.0',
    description: 'Trabajos Preliminares y Movilización',
    percent: 100.0,
    group: true,
  },
  {
    id: 'r-2',
    item: '1.1',
    description: 'Instalación de obradores y campamento de faenas',
    percent: 100.0,
    group: false,
  },
  {
    id: 'r-3',
    item: '1.2',
    description: 'Vallado perimetral y señalización de seguridad ocupacional',
    percent: 100.0,
    group: false,
  },
  {
    id: 'r-4',
    item: '2.0',
    description: 'Movimiento de Suelos y Limpieza de Terreno',
    percent: 65.0,
    group: true,
  },
  {
    id: 'r-5',
    item: '2.1',
    description: 'Desbroce, despeje y excavación para fundaciones',
    percent: 80.0,
    group: false,
  },
  {
    id: 'r-6',
    item: '2.2',
    description: 'Nivelación, perfilado y compactación de subrasante',
    percent: 50.0,
    group: false,
  },
  {
    id: 'r-7',
    item: '3.0',
    description: 'Estructuras de Hormigón Armado',
    percent: 22.0,
    group: true,
  },
  {
    id: 'r-8',
    item: '3.1',
    description: 'Armado de zapatas, pilotes y pilotes de fundación',
    percent: 40.0,
    group: false,
  },
  {
    id: 'r-9',
    item: '3.2',
    description: 'Encofrado y hormigonado de columnas y vigas inferiores',
    percent: 15.0,
    group: false,
  },
  {
    id: 'r-10',
    item: '4.0',
    description: 'Instalaciones e Infraestructura Sanitaria',
    percent: 10.0,
    group: true,
  },
];

export const DEFAULT_PENDINGS: PendingItem[] = [
  {
    id: 'p-1',
    description:
      'Aprobación de ensayos de laboratorio para resistencia de hormigón elaborado H-25 (Probetas a 28 días).',
    responsible: 'Laboratorio de Control de Calidad / Fiscalización',
    deadline: '05/11/2026',
    impact: 'ALTO',
    status: 'En análisis',
  },
  {
    id: 'p-2',
    description:
      'Presentación del plan de contingencia y desvío de tránsito para la etapa de canalización subterránea.',
    responsible: 'Empresa Contratista - Encargado de Seguridad',
    deadline: '02/11/2026',
    impact: 'CRÍTICO',
    status: 'Aguardando respuesta',
  },
  {
    id: 'p-3',
    description:
      'Verificación y catastro de interferencias con redes existentes de agua potable y fibra óptica.',
    responsible: 'Fiscalización / Especialista Sanitario',
    deadline: '10/11/2026',
    impact: 'MEDIO',
    status: 'En ejecución',
  },
];

// Fotos de ejemplo (Unsplash, licencia libre): armaduras, estructura, avance general y personal en obra
export const DEFAULT_PHOTOS: PhotoItem[] = [
  {
    id: 'ph-1',
    src: 'https://images.unsplash.com/photo-1768677903496-becc4be07258?auto=format&fit=crop&w=800&q=80',
    caption: 'Foto 01: Inspección del armado de armaduras de refuerzo previo al hormigonado.',
    pageIndex: 0,
  },
  {
    id: 'ph-2',
    src: 'https://images.unsplash.com/photo-1587582423116-ec07293f0395?auto=format&fit=crop&w=800&q=80',
    caption: 'Foto 02: Montaje de estructura con personal provisto de equipos de seguridad.',
    pageIndex: 0,
  },
  {
    id: 'ph-3',
    src: 'https://images.unsplash.com/photo-1531834685032-c34bf0d84c77?auto=format&fit=crop&w=800&q=80',
    caption: 'Foto 03: Vista general del avance de obra en estructura y cerramientos.',
    pageIndex: 0,
  },
  {
    id: 'ph-4',
    src: 'https://images.unsplash.com/photo-1626885930974-4b69aa21bbf9?auto=format&fit=crop&w=800&q=80',
    caption: 'Foto 04: Coordinación en obra entre la contratista y la fiscalización.',
    pageIndex: 0,
  },
];

export const DEFAULT_OBSERVATIONS: ObservationsData = {
  notes:
    'Los trabajos avanzan en conformidad con el cronograma de ejecución aprobado. Se mantienen estrictos controles de calidad e higiene laboral.',
  showSignatures: true,
  directorSignTitle: 'Dirección de Obras',
  directorSignName: 'Ing. Director Principal',
  supervisorSignTitle: 'Supervisión Técnica',
  supervisorSignName: 'Ing. Inspector de Obra',
  contractorSignTitle: 'Empresa Contratista',
  contractorSignName: 'Director Técnico de Obra',
};

export const DEFAULT_BLOCKS: BlockConfig[] = [
  {
    id: 'header',
    type: 'header',
    title: 'Cabecera Institucional',
    pageIndex: 0,
    enabled: true,
    order: 0,
    showTitle: false,
  },
  {
    id: 'contract_metrics',
    type: 'contract_metrics',
    title: 'Contrato e Indicadores de Avance',
    pageIndex: 0,
    enabled: true,
    order: 1,
    showTitle: false,
  },
  {
    id: 'situation',
    type: 'situation',
    title: 'Situación Actual y Gráfico de Avance',
    pageIndex: 0,
    enabled: true,
    order: 2,
    rubricsItems: DEFAULT_RUBRICS,
  },
  {
    id: 'photos',
    type: 'photos',
    title: 'Fotografías de Situación Actual',
    pageIndex: 0,
    enabled: true,
    order: 3,
    photoColumns: 2,
    photoHeightMm: 40,
  },
  {
    id: 'pending',
    type: 'pending',
    title: 'Cuadro de Pendencias y Situaciones Relevantes',
    pageIndex: 0,
    enabled: true,
    order: 4,
    pendingsItems: DEFAULT_PENDINGS,
  },
  {
    id: 'observations',
    type: 'observations',
    title: 'Observaciones y Firmas',
    pageIndex: 0,
    enabled: true,
    order: 5,
  },
];
