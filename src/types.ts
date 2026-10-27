export type ImpactLevel = 'CRÍTICO' | 'ALTO' | 'MEDIO' | 'BAJO';

export type PendingStatus =
  | 'En análisis'
  | 'Pendiente'
  | 'En ejecución'
  | 'Aguardando respuesta'
  | 'Resuelto'
  | 'Vencido';

export interface RubricItem {
  id: string;
  item: string;
  description: string;
  percent: number;
  group: boolean;
}

export interface PendingItem {
  id: string;
  description: string;
  responsible: string;
  deadline: string;
  impact: ImpactLevel;
  status: PendingStatus;
}

export interface PhotoItem {
  id: string;
  src: string;
  caption: string;
  pageIndex?: number;
}

export interface ProjectData {
  director: string;
  project: string;
  reportDate: string;
  startDate: string;
  contract: string;
  contractor: string;
  contractValue: string;
  measurement: string;
  timeProgress: number;
  financialProgress: number;
  physicalProgress: number;
  logoUrl: string;
  invertLogoColor: boolean;
}

export interface ObservationsData {
  notes: string;
  showSignatures: boolean;
  directorSignTitle: string;
  directorSignName: string;
  supervisorSignTitle: string;
  supervisorSignName: string;
  contractorSignTitle: string;
  contractorSignName: string;
}

export type BlockId =
  | 'header'
  | 'contract_metrics'
  | 'situation'
  | 'pending'
  | 'photos'
  | 'observations';

export interface BlockConfig {
  id: BlockId;
  title: string;
  pageIndex: number; // 0-based page index (0 = Page 1, 1 = Page 2, etc.)
  enabled: boolean;
  order: number;
  forceNewPage?: boolean;
}

export interface ReportLayoutConfig {
  blocks: BlockConfig[];
  photoColumns: 1 | 2 | 3 | 4;
  photoHeightMm: number;
  totalA4Pages: number;
}
