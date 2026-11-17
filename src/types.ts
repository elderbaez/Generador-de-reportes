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
  comment?: boolean;
}

export interface PendingItem {
  id: string;
  description: string;
  responsible: string;
  deadline: string;
  impact: ImpactLevel;
  status: PendingStatus;
}

export type AnnotationToolType = 'rect' | 'circle' | 'arrow';

export interface PhotoAnnotation {
  id: string;
  type: AnnotationToolType;
  startX: number; // 0 to 1000
  startY: number; // 0 to 1000
  endX: number;   // 0 to 1000
  endY: number;   // 0 to 1000
  color: string;
  strokeWidth: number; // 2, 4, 6, 8
}

/* ---------- Anotaciones de fotos (editables) ---------- */
export type MarkupKind = 'arrow' | 'line' | 'rect' | 'ellipse' | 'highlight' | 'pen' | 'text' | 'marker' | 'blur' | 'dim' | 'magnifier';

/** Una marca sobre la foto. Coordenadas relativas (0–1) al ancho y alto de la imagen. */
export interface MarkupItem {
  id: string;
  kind: MarkupKind;
  x1: number; y1: number;
  x2: number; y2: number;
  /** Trazos a mano (lápiz, resaltador): x,y,x,y… relativos. */
  points?: number[];
  color: string;
  /** Grosor 1–10. */
  width: number;
  /** 0–1 (resaltador por defecto 0,4). */
  opacity?: number;
  /** Relleno suave (rectángulo, elipse). */
  fill?: boolean;
  dashed?: boolean;
  text?: string;
  fontSize?: number;
  textBg?: boolean;
  /** Número del marcador. */
  num?: number;
  /** Datos extra para la lupa (sólo kind='magnifier'). */
  magnifier?: MagnifierData;
}

/** Datos de la herramienta "lupa / callout" sobre un documento. */
export interface MagnifierData {
  /**
   * Esquina superior izquierda del recuadro ampliado, relativa al fragmento.
   * Puede quedar fuera de 0–1: el callout puede salirse del plano y el bloque
   * reserva el margen necesario (ver `docOutset` en utils/docLayout).
   */
  calloutX: number;
  calloutY: number;
  /** Forma de la zona y del callout. */
  shape?: 'rect' | 'circle';
  /**
   * Factor de zoom: 2–8. El tamaño del callout se deriva de la zona por este
   * factor, así la ampliación nunca sale deformada.
   */
  zoom: number;
  /** Mostrar líneas guía conectando zona con callout. */
  guide: boolean;
}

export interface PhotoItem {
  id: string;
  src: string;
  originalSrc?: string; // Copia original previa a las marcas en mapa de bits
  caption: string;
  pageIndex?: number;
  objectFit?: 'cover' | 'contain';
  objectPosition?: string;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  annotations?: PhotoAnnotation[];
  /** Marcas del editor de anotaciones (vectoriales, se pueden volver a editar). */
  markup?: MarkupItem[];
  breakAfter?: boolean; // Forzar salto de hoja después de esta foto
}

export interface ProjectData {
  director: string;
  project: string;
  reportDate: string;
  startDate: string;
  endDate?: string;
  contract: string;
  contractor: string;
  contractValue: string;
  measurement: string;
  timeProgress: number;
  financialProgress: number;
  physicalProgress: number;
  logoUrl: string;
  invertLogoColor: boolean;
  footerLeft: string;
  footerRight: string;
  reportTitle: string;
  /** Segundo logo (a la derecha del encabezado) */
  logoRightUrl?: string;
  invertLogoRight?: boolean;
  /** Encabezado configurable (ver utils/header). Sin esto, se arma igual al de siempre. */
  header?: import('./utils/header').HeaderConfig;
  /** Campos propios del informe ({clave}), ver utils/fields */
  fields?: import('./utils/fields').ReportField[];
}

export interface ObservationsData {
  notes: string;
  /**
   * Obsoleto: las firmas ahora son un módulo aparte. Si un informe guardado lo
   * trae en true, App lo migra solo a un bloque de Firmas (migrateObservationSignatures)
   * y lo deja en false. Los campos *Sign* quedan para esa migración.
   */
  showSignatures: boolean;
  directorSignTitle: string;
  directorSignName: string;
  supervisorSignTitle: string;
  supervisorSignName: string;
  contractorSignTitle: string;
  contractorSignName: string;
}

export type BlockType =
  | 'header'
  | 'contract_metrics'
  | 'situation'
  | 'pending'
  | 'photos'
  | 'text'
  | 'specs'
  | 'signatures'
  | 'scurve'
  | 'weather'
  | 'observations'
  | 'document'
  | 'cover'
  | 'toc'
  | 'html'
  | 'diagram'
  | 'gantt'
  | 'map'
  | 'footer';

export type BlockId = string;

export type TabType = 'blocks' | 'project';

export interface SpecItem {
  id: string;
  item: string;
  description: string;
  specification: string;
  resultOrStatus: 'Conforme' | 'No conforme' | 'En ensayo' | 'Observado' | 'Aprobado';
  notes?: string;
}

/** Estilos de énfasis del módulo de observaciones. */
export type ObsStyle = 'note' | 'quote' | 'code' | 'list' | 'info' | 'warning' | 'critical' | 'success';

export interface SignatureItem {
  id: string;
  roleTitle: string;
  name: string;
  licenseNumber?: string;
  institution?: string;
}

export interface SCurvePeriodItem {
  id: string;
  period: string;
  plannedPercent: number;
  plannedCumulative: number;
  actualPercent?: number;
  actualCumulative?: number;
}

export type WeatherCondition = 'soleado' | 'parcial' | 'nublado' | 'lluvia_debil' | 'lluvia_fuerte' | 'tormenta';

export interface DayTurnWeather {
  show: boolean;
  condition: WeatherCondition;
  tempC: number;
  practicable: boolean;
}

/** Nivel de resaltado de lluvia (ej. límites de mm para prórroga de contrato). */
export interface RainLevel { id: string; mm: number; color: string }

/** Ubicación de la obra para traer datos meteorológicos. */
export interface WeatherLocation { name: string; lat: number; lon: number }

export interface DailyWeatherItem {
  id: string;
  dayName: string; // 'Lunes', 'Martes', etc.
  dateStr: string;
  /** Fecha real del día (aaaa-mm-dd). El nombre del día y "dd/mm" se calculan de acá. */
  date?: string;
  condition: WeatherCondition;
  rainfallMm: number;
  workStatus: 'Trabajado' | 'No trabajado' | 'Parcialmente' | 'Sí' | 'No' | 'Parcial';
}

/* ---------- Contrato e indicadores (módulo configurable) ---------- */

/** Datos del informe a los que puede quedar vinculado un campo (se editan en ambos lados). */
export type ContractBind = 'contract' | 'contractor' | 'contractValue' | 'startDate' | 'endDate' | 'reportDate' | 'measurement' | 'measurementPct';

export interface ContractField {
  id: string;
  /** Título (primer nivel de texto), ej. "Contrato". */
  label: string;
  /** Contenido (segundo nivel de texto). Si el campo está vinculado, se toma de los datos del informe. */
  value: string;
  width?: 'full' | 'half';
  /** Los campos destacados consecutivos se agrupan en un recuadro resaltado. */
  highlight?: boolean;
  bind?: ContractBind;
}

export type IndicatorSourceMode = 'manual' | 'bind' | 'calc';

export type ContractIndicatorBind =
  | 'timeProgress'
  | 'financialProgress'
  | 'physicalProgress'
  | 'measurementPct'
  | 'rubrics';

export type ContractIndicatorCalcType =
  | 'time_dates'        // Plazo por fechas: (tomaDeMuestra - inicio) / (fin - inicio) * 100
  | 'financial_measure' // Financiero por medición: (measurement / contractValue) * 100
  | 'rubrics_physical'  // Físico por rubros: promedio de avance de la tabla de rubros
  | 'custom';           // Cálculo personalizado: (A / B) * 100

export interface IndicatorCalcConfig {
  type: ContractIndicatorCalcType;
  startDate?: string;
  endDate?: string;
  sampleDate?: string;
  // Campos para el cálculo personalizado (A / B) * 100 o fórmula libre
  opA?: string;
  opB?: string;
  formula?: string; // Ej: "(@medicion / @monto) * 100"
}

export interface ContractIndicator {
  id: string;
  label: string;
  value: number;
  color: string;
  sourceMode?: IndicatorSourceMode;
  bind?: ContractIndicatorBind;
  calc?: IndicatorCalcConfig;
  /** Indicador principal: se dibuja más grande / más marcado. */
  primary?: boolean;
  /** Referencia (normalmente el plazo): línea punteada en las barras y base del desvío. */
  reference?: boolean;
}

/* ---------- Documentos y planos (bloque "Documento / plano") ---------- */

/** Recorte relativo (0–1) sobre la página ya girada. */
export interface DocCrop { x: number; y: number; w: number; h: number }

/** Estilo de los bordes de un fragmento recortado. */
export type DocEdge = 'straight' | 'zigzag' | 'wave' | 'torn';

export interface DocItem {
  id: string;
  /** 'pdf': src es un PDF de una sola página (vectorial). 'image': src es una imagen. */
  kind: 'pdf' | 'image';
  src: string;
  fileName?: string;
  /** Número de página en el archivo original (sólo informativo). */
  sourcePage?: number;
  /** Tamaño de la página sin el giro del usuario (puntos para PDF, píxeles para imagen). */
  pageW: number;
  pageH: number;
  rotation?: 0 | 90 | 180 | 270;
  /** Sin recorte (o null) = hoja completa. */
  crop?: DocCrop | null;
  edge?: DocEdge;
  /** 'cut': el efecto sólo en los lados recortados. 'all': en los cuatro lados. 'h': sólo superior e inferior. */
  edgeSides?: 'cut' | 'all' | 'h';
  /** Sombra de papel (por defecto sí). */
  shadow?: boolean;
  caption?: string;
  /** Empieza una fila nueva a partir de este elemento. */
  rowBreak?: boolean;
  /** Anotaciones vectoriales encima (próxima etapa). */
  markup?: MarkupItem[];
}

export type ContractChartStyle = 'rings' | 'triple' | 'bars';
export type WeatherDayStyle = 'cards' | 'strip' | 'summary';
export type WeatherWeekStyle = 'calendar' | 'table' | 'compact';

export interface BlockConfig {
  id: BlockId;
  type: BlockType;
  title: string;
  pageIndex: number; // 0-based page index (0 = Page 1, 1 = Page 2, etc.)
  enabled: boolean;
  order: number;
  forceNewPage?: boolean;
  /** Columnas: los bloques seguidos con el mismo grupo (rowWith ?? id) van lado a lado */
  rowWith?: string;
  /** Ancho relativo dentro de la fila (1 por defecto) */
  colWeight?: number;
  showTitle?: boolean; // Controls whether this block displays the standardized title banner (defaults to true)
  // Per-block configuration
  photos?: PhotoItem[];
  photoColumns?: 1 | 2 | 3 | 4;
  photoPrefix?: string; // prefijo de numeración automática de fotos ("Foto" → Foto 01 - …); vacío = sin numerar
  photoHeightMm?: number;
  maxPhotosPerPage?: number; // 0 o undefined = automático según espacio A4; 2, 4, 6...
  showContinuationTitle?: boolean; // título menor "(continuación)" en las hojas siguientes (por defecto sí)
  textSubtitle?: string;
  textContent?: string;
  /** Tamaño de letra del módulo de Texto (pt); sin definir = el del tema */
  textSizePt?: number;
  specsItems?: SpecItem[];
  signaturesItems?: SignatureItem[];
  /** Portada: diseño, foto de fondo y textos (pueden usar {campos}, ver utils/header) */
  coverLayout?: 'classic' | 'photo' | 'minimal';
  coverImage?: string;
  coverKicker?: string;
  coverTitle?: string;
  coverSubtitle?: string;
  coverMeta?: { id: string; label: string; value: string }[];
  coverNote?: string;
  /** Índice: incluir los títulos # y ## de los textos (por defecto sí) */
  tocHeadings?: boolean;
  /** Módulo HTML/SVG: código tal cual lo pegó el usuario (se limpia al mostrarlo) */
  htmlCode?: string;
  /** Módulo HTML/SVG: pie y prefijo de numeración (como las figuras) */
  htmlCaption?: string;
  /** Módulo Cronograma (Gantt), ver utils/gantt */
  ganttTasks?: import('./utils/gantt').GanttTask[];
  ganttScale?: import('./utils/gantt').GanttScale;
  ganttColumns?: import('./utils/gantt').GanttColumns;
  ganttDensity?: import('./utils/gantt').GanttDensity;
  ganttShowToday?: boolean;
  ganttShowProgress?: boolean;
  /** Avance del período: la parte ejecutada desde el corte anterior va rayada (por defecto sí) */
  ganttShowPeriod?: boolean;
  /** Largo del período de medición (por defecto una semana); 'custom' = desde ganttPeriodStart */
  ganttPeriod?: import('./utils/gantt').GanttPeriod;
  /** Inicio del período cuando es 'custom' (aaaa-mm-dd) */
  ganttPeriodStart?: string;
  ganttFromRubrics?: boolean;
  ganttOnlyMain?: boolean;
  /** No dibujar las tareas y grupos con avance 0 % (los hitos quedan) */
  ganttHideZero?: boolean;
  /** Mostrar la ruta crítica (ver utils/gantt markCritical) */
  ganttCritical?: boolean;
  /** Holgura (días hábiles) hasta la que una tarea cuenta como crítica */
  ganttCritTolerance?: number;
  /** Dibujar la holgura de las tareas no críticas (línea fina hasta su fin más tardío) */
  ganttShowSlack?: boolean;
  ganttFrom?: string;
  ganttTo?: string;
  ganttCaption?: string;
  ganttPrefix?: string;
  htmlPrefix?: string;
  /** Módulo Mapa: punto en UTM (SIRGAS 2000) o lat/lon; los valores pueden ser {campos} */
  mapCoordMode?: 'utm' | 'geo';
  mapEast?: string;
  mapNorth?: string;
  mapZone?: number;
  mapSouth?: boolean;
  mapZoom?: number;
  mapStyle?: import('./utils/geo').MapStyle;
  mapHeightMm?: number;
  /** Centro elegido arrastrando el mapa; sin definir = el punto */
  mapCenter?: { lat: number; lon: number };
  mapLabel?: string;
  mapShowCoords?: boolean;
  mapShowScale?: boolean;
  mapShowNorth?: boolean;
  mapHd?: boolean;
  mapCaption?: string;
  mapPrefix?: string;
  /** Módulo Diagrama (Mermaid): código, pie, prefijo de numeración ("Figura") y alto máximo */
  diagramCode?: string;
  diagramCaption?: string;
  diagramPrefix?: string;
  diagramMaxHeightMm?: number;
  /** Observaciones: estilo de énfasis (por defecto 'note', el recuadro clásico). */
  obsStyle?: ObsStyle;
  /** Notas propias del bloque. Sin definir = usa las observaciones generales del informe (bloque original). */
  obsNotes?: string;
  /** Observaciones: rótulo propio; vacío = el del estilo ("Advertencia", "Información"…). */
  obsLabel?: string;
  /** Observaciones, estilo cita: autor o fuente ("Fiscalización", "Acta Nº 12"). */
  obsAttribution?: string;
  scurveData?: SCurvePeriodItem[];
  rubricsItems?: RubricItem[];
  /** Rubros (y grupos) en 0 %: no se muestran en la hoja; editando se ven atenuados */
  hideZeroRubrics?: boolean;
  showChart?: boolean;
  pendingsItems?: PendingItem[];
  weatherMode?: 'day' | 'week';
  weatherDay?: {
    morning: DayTurnWeather;
    afternoon: DayTurnWeather;
    night: DayTurnWeather;
  };
  weatherWeek?: DailyWeatherItem[];
  showIndicators?: boolean;
  showTable?: boolean;
  kpiVariant?: 'cards' | 'strip' | 'rings' | 'panel';
  contractFields?: ContractField[];
  contractIndicators?: ContractIndicator[];
  contractChartStyle?: ContractChartStyle;
  weatherDayStyle?: WeatherDayStyle;
  weatherWeekStyle?: WeatherWeekStyle;
  /** Primer día de la vista de semana (aaaa-mm-dd). Sin valor: los 7 días anteriores a la toma de datos. */
  weatherWeekStart?: string;
  weatherRainLevels?: RainLevel[];
  weatherLocation?: WeatherLocation;
  /** Origen de los datos traídos (se muestra como nota en la hoja). */
  weatherSource?: string;
  scurveChartHeightMm?: number; // alto del gráfico de la Curva S (mm)
  /** Bloque "Documento / plano": páginas o fragmentos de PDF/imagen. */
  docItems?: DocItem[];
  /** Alto máximo de cada fila de fragmentos (mm). */
  docMaxHeightMm?: number;
  /** Prefijo de numeración (comparte contador con las fotos del mismo prefijo). */
  docPrefix?: string;
  /** Mostrar pie debajo de cada fragmento (por defecto sí). */
  docShowCaption?: boolean;
}



export interface ReportLayoutConfig {
  blocks: BlockConfig[];
  photoColumns: 1 | 2 | 3 | 4;
  photoHeightMm: number;
  totalA4Pages: number;
}

