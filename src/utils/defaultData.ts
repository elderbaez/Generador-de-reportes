import {
  ProjectData,
  RubricItem,
  PendingItem,
  PhotoItem,
  ObservationsData,
  BlockConfig,
} from '../types';

export const DEFAULT_PROJECT_DATA: ProjectData = {
  director: 'DIRECCIÓN TÉCNICA - SUPERINTENDENCIA DE OBRAS - SO.DT',
  project: 'RESTAURACIÓN, RECUPERACIÓN Y REFORMA DE LA CATEDRAL SAN BLAS DE CIUDAD DEL ESTE',
  reportDate: '2026-10-26',
  startDate: '2026-10-14',
  contract: '4500084818 – Restauración, Recuperación y Reforma de la Catedral San Blas de Ciudad del Este',
  contractor: 'CONSORCIO SAN BLAS',
  contractValue: '18.921.072.142',
  measurement: '1.362.317.194',
  timeProgress: 14.5,
  financialProgress: 7.2,
  physicalProgress: 7.2,
  logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/ea/Logo_Itaipu_Preferencial.svg',
  invertLogoColor: true,
};

export const DEFAULT_RUBRICS: RubricItem[] = [
  {
    id: 'r-1',
    item: '1.0',
    description: 'Obras previas (Periodo de movilización)',
    percent: 33.25,
    group: true,
  },
  {
    id: 'r-2',
    item: '1.1',
    description: 'Obrador y campamento de faena',
    percent: 33.0,
    group: false,
  },
  {
    id: 'r-3',
    item: '1.2',
    description: 'Vallado perimetral y señalización de seguridad',
    percent: 100.0,
    group: false,
  },
  {
    id: 'r-4',
    item: '2.0',
    description: 'Demolición y desmontaje',
    percent: 40.8,
    group: true,
  },
  {
    id: 'r-5',
    item: '2.1',
    description: 'Instalaciones previas para inicio de desmontaje',
    percent: 6.0,
    group: false,
  },
  {
    id: 'r-6',
    item: '2.2',
    description: 'Desmontaje de techo (Cubierta y estructura metálica)',
    percent: 60.0,
    group: false,
  },
  {
    id: 'r-7',
    item: '2.4',
    description: 'Demoliciones internas (remoción de pisos e instalaciones)',
    percent: 38.0,
    group: false,
  },
  {
    id: 'r-8',
    item: '2.5',
    description: 'Desmontaje de cerramiento de Durlock y vitrales protegidos',
    percent: 100.0,
    group: false,
  },
  {
    id: 'r-9',
    item: '3.0',
    description: 'Estructuras y patología del hormigón',
    percent: 4.5,
    group: true,
  },
  {
    id: 'r-10',
    item: '3.2.1',
    description: 'Retiro de revoque, tratamiento de armaduras y mortero proyectado',
    percent: 12.0,
    group: false,
  },
];

export const DEFAULT_PENDINGS: PendingItem[] = [
  {
    id: 'p-1',
    description:
      'Pontillón de hormigón armado - Presentación de detalles solicitados sobre cálculo de fundaciones y cargas vivas.',
    responsible: 'Tecnoedil / Consorcio San Blas',
    deadline: '02/11/2026',
    impact: 'ALTO',
    status: 'En análisis',
  },
  {
    id: 'p-2',
    description:
      'Aprobación final de muestra de mortero tixotrópico para restauración de vigas principales color verde.',
    responsible: 'Fiscalización SO.DT',
    deadline: '30/10/2026',
    impact: 'CRÍTICO',
    status: 'Aguardando respuesta',
  },
  {
    id: 'p-3',
    description:
      'Protocolo de catalogación y embalaje protector de vitrales patrimoniales de fachada lateral este.',
    responsible: 'Restaurador Especialista',
    deadline: '06/11/2026',
    impact: 'MEDIO',
    status: 'En ejecución',
  },
  {
    id: 'p-4',
    description:
      'Revisión de interferencias en ductos subterráneos de desagüe pluvial en patio exterior.',
    responsible: 'Área Eléctrica e Hidráulica',
    deadline: '10/11/2026',
    impact: 'BAJO',
    status: 'Pendiente',
  },
];

export const DEFAULT_PHOTOS: PhotoItem[] = [
  {
    id: 'ph-1',
    src: 'https://images.unsplash.com/photo-1541888946425-d0fbb1861593?auto=format&fit=crop&w=800&q=80',
    caption: 'Foto 01: Avance en desmontaje de estructura de cubierta superior sobre nave principal.',
    pageIndex: 1,
  },
  {
    id: 'ph-2',
    src: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80',
    caption: 'Foto 02: Remoción de revoques degradados e inspección de armaduras en vigas perimetrales.',
    pageIndex: 1,
  },
  {
    id: 'ph-3',
    src: 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=800&q=80',
    caption: 'Foto 03: Montaje de andamios tubulares de seguridad certificados y vallado de protección.',
    pageIndex: 1,
  },
  {
    id: 'ph-4',
    src: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=800&q=80',
    caption: 'Foto 04: Estado de acopio ordenado de materiales demolidos y clasificación para retiro.',
    pageIndex: 1,
  },
];

export const DEFAULT_OBSERVATIONS: ObservationsData = {
  notes:
    'Los trabajos avanzan conforme al cronograma reprogramado tras la liberación del sector este. Se mantiene estricto control de seguridad en trabajos de altura y protección de piezas patrimoniales.',
  showSignatures: true,
  directorSignTitle: 'Superintendencia de Obras',
  directorSignName: 'Ing. Fiscalizador Principal',
  supervisorSignTitle: 'Fiscalización de Obra SO.DT',
  supervisorSignName: 'Fiscal de Obras Civiles',
  contractorSignTitle: 'Consorcio San Blas',
  contractorSignName: 'Director Técnico de Obra',
};

export const DEFAULT_BLOCKS: BlockConfig[] = [
  {
    id: 'header',
    title: '1. Cabecera Institucional',
    pageIndex: 0,
    enabled: true,
    order: 0,
  },
  {
    id: 'contract_metrics',
    title: '2. Contrato e Indicadores de Avance',
    pageIndex: 0,
    enabled: true,
    order: 1,
  },
  {
    id: 'situation',
    title: '3. Situación Actual y Gráfico de Avance',
    pageIndex: 0,
    enabled: true,
    order: 2,
  },
  {
    id: 'photos',
    title: '4. Fotografías de Situación Actual',
    pageIndex: 0,
    enabled: true,
    order: 3,
  },
  {
    id: 'pending',
    title: '5. Cuadro de Pendencias y Situaciones Relevantes',
    pageIndex: 1,
    enabled: true,
    order: 4,
  },
  {
    id: 'observations',
    title: '6. Observaciones y Firmas',
    pageIndex: 1,
    enabled: true,
    order: 5,
  },
];
