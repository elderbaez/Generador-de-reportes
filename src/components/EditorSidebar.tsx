import React, { useState } from 'react';
import { paperShort } from '../utils/pageSetup';
import {
  ProjectData,
  RubricItem,
  PendingItem,
  PhotoItem,
  ObservationsData,
  BlockConfig,
  BlockId,
  BlockType,
  ImpactLevel,
  PendingStatus,
  TabType,
} from '../types';
import { parseCSV } from '@/src/utils/csv';
import { fileToAsset } from '../theme/assets';
import {
  Layers,
  FileText,
  BarChart3,
  AlertCircle,
  Image as ImageIcon,
  CheckSquare,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Upload,
  Eye,
  EyeOff,
  Sparkles,
  ChevronRight,
  Maximize2,
  GripVertical,
  CloudSun,
  Pencil,
  PanelLeftClose,
  SlidersHorizontal,
  X,
  ArrowUpDown,
  ClipboardList,
  PenTool,
  MessageSquareText,
  ZoomIn,
  ZoomOut,
  FileImage,
  TrendingUp,
  BookOpen,
  ListTree,
  Code2,
  Workflow,
  CalendarRange,
  MapPinned,
  Braces,
} from 'lucide-react';
import { ReportField, newField, uniqueFieldKey } from '../utils/fields';

interface EditorSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  blocks: BlockConfig[];
  projectData: ProjectData;
  rubrics: RubricItem[];
  pendings: PendingItem[];
  photos: PhotoItem[];
  observations: ObservationsData;
  photoColumns: 1 | 2 | 3 | 4;
  photoHeightMm: number;
  totalPages: number;
  sidebarWidth?: number;
  onSidebarWidthChange?: (width: number) => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  onUpdateBlocks: (blocks: BlockConfig[]) => void;
  onUpdateProjectData: (data: Partial<ProjectData>) => void;
  onUpdateRubrics: (rubrics: RubricItem[]) => void;
  onUpdatePendings: (pendings: PendingItem[]) => void;
  onUpdatePhotos: (photos: PhotoItem[]) => void;
  onUpdateObservations: (obs: Partial<ObservationsData>) => void;
  onUpdatePhotoSettings: (columns: 1 | 2 | 3 | 4, heightMm: number) => void;
  onAddPage: () => void;
  activeTab: TabType;
  onSetActiveTab: (tab: TabType) => void;
  onOpenFreeFraming?: (photo: PhotoItem) => void;
  onOpenAnnotate?: (photo: PhotoItem) => void;
  onInsertBlock?: (pageIndex: number, targetOrder: number, type: BlockType) => void;
  onDeleteBlock?: (blockId: string) => void;
  onRequestDeleteBlock?: (blockId: string) => void;
  onUpdateBlockConfig?: (blockId: string, patch: Partial<BlockConfig>) => void;
  onSetInlineEditingBlockId?: (id: BlockId | null) => void;
  pagePhotosMap?: Record<number, PhotoItem[]>;
  photoPagesByBlock?: Record<string, Record<number, PhotoItem[]>>;
  /** Bloques de texto repartidos en varias hojas (tramos por hoja). */
  textParts?: Record<string, { page: number; from: number; to: number }[]>;
}


// ...

/* ---------- Datos generales: tarjetas y campos ---------- */
const inputCls = 'w-full border border-slate-300 rounded-md px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500';

const DataCard: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <section className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
    <header className="px-3 py-2 bg-slate-50 border-b border-slate-200">
      <div className="text-[11px] font-black uppercase tracking-wider text-[#0b455b]">{title}</div>
      {hint && <div className="text-[10px] text-slate-500 mt-0.5">{hint}</div>}
    </header>
    <div className="p-3 space-y-2.5">{children}</div>
  </section>
);

const DataField: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div>
    <div className="font-bold text-slate-700 text-[11px] mb-1">{label}</div>
    {children}
    {hint && <div className="text-[10px] text-slate-400 mt-0.5">{hint}</div>}
  </div>
);

/* ---------- Campos propios del informe ({clave}) ---------- */
const FieldsEditor: React.FC<{ fields: ReportField[]; onChange: (f: ReportField[]) => void }> = ({ fields, onChange }) => {
  const upd = (id: string, patch: Partial<ReportField>) =>
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  return (
    <div className="space-y-1.5">
      {fields.length === 0 && (
        <div className="text-[10.5px] text-slate-400">Todavía no hay campos propios. Ejemplos: Vértice, Norte SIRGAS, Este SIRGAS, Cota, Progresiva.</div>
      )}
      {fields.map((f, i) => (
        <div key={f.id} className="rounded-lg border border-slate-200 p-1.5 bg-slate-50/60">
          <div className="flex items-center gap-1">
            <input type="text" value={f.label} placeholder="Nombre" className={`${inputCls} font-semibold`}
              onChange={(e) => {
                const label = e.target.value;
                // La clave sigue al nombre mientras no se haya usado a mano
                const auto = f.key === uniqueFieldKey(f.label, fields, f.id) || !f.key;
                upd(f.id, auto ? { label, key: uniqueFieldKey(label, fields, f.id) } : { label });
              }} />
            <button type="button" title="Subir" disabled={i === 0} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"
              onClick={() => { const c = [...fields]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; onChange(c); }}><ArrowUp className="w-3 h-3" /></button>
            <button type="button" title="Quitar el campo (donde se use queda escrito {clave})" className="p-1 rounded hover:bg-rose-100 text-rose-600"
              onClick={() => onChange(fields.filter((x) => x.id !== f.id))}><Trash2 className="w-3 h-3" /></button>
          </div>
          <div className="flex items-center gap-1 mt-1">
            <input type="text" value={f.value} placeholder="Valor" className={`${inputCls} font-mono`}
              onChange={(e) => upd(f.id, { value: e.target.value })} />
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
            <Braces className="w-3 h-3" /> se escribe
            <input type="text" value={f.key} title="Clave: letras, números y _"
              className="font-mono text-[10px] text-[#0b455b] bg-transparent border-b border-dashed border-slate-300 px-0.5 w-32 focus:outline-none"
              onChange={(e) => upd(f.id, { key: e.target.value.replace(/[^\w]/g, '').slice(0, 32) })}
              onBlur={(e) => upd(f.id, { key: uniqueFieldKey(e.target.value || f.label, fields, f.id) })} />
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...fields, newField('Campo nuevo', '', fields)])}
        className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-md border border-dashed border-slate-300 text-[11px] font-bold text-[#0b455b] hover:bg-slate-50">
        <Plus className="w-3 h-3" /> Agregar campo
      </button>
    </div>
  );
};

/* ---------- Logo: archivo de la PC (SVG/PNG/JPG) o dirección web ---------- */
const LogoPicker: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const isData = (value || '').startsWith('data:');
  const kb = isData ? Math.round((value.length * 3) / 4 / 1024) : 0;
  const kind = isData ? (value.slice(5, value.indexOf(';')).replace('image/', '').replace('svg+xml', 'svg').toUpperCase()) : '';

  const load = async (file?: File | null) => {
    if (!file) return;
    setErr(null);
    try {
      // Mismo tratamiento que las imágenes del tema: SVG tal cual, fotos achicadas a WebP
      const a = await fileToAsset(file, []);
      onChange(a.dataUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="mb-2">
      <div
        className={`flex items-center gap-2 p-2 rounded-lg border border-dashed transition-colors ${drag ? 'border-[#0b455b] bg-sky-50' : 'border-slate-300 bg-slate-50'}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); load(e.dataTransfer.files?.[0]); }}
      >
        <div className="w-14 h-10 shrink-0 rounded bg-[#0b455b] flex items-center justify-center overflow-hidden" title="Vista previa sobre el color del encabezado">
          {value ? <img src={value} alt="" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" /> : <span className="text-[9px] text-white/60 font-bold">SIN LOGO</span>}
        </div>
        <div className="flex-1 min-w-0">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="px-2.5 py-1 rounded-md bg-[#0b455b] hover:bg-[#083445] text-white text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> Elegir archivo de la PC
          </button>
          <div className="text-[10px] text-slate-500 mt-1 truncate">
            {isData ? `Archivo cargado · ${kind} · ${kb < 1 ? "<1" : kb} KB` : 'SVG, PNG, JPG o WebP · o arrastralo acá'}
          </div>
        </div>
        {value && (
          <button type="button" onClick={() => onChange('')} title="Quitar logo"
            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
        )}
        <input ref={fileRef} type="file" accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp" hidden
          onChange={(e) => { load(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {err && <div className="text-[10.5px] text-rose-700 mt-1">{err}</div>}
      <input
        type="text"
        value={isData ? '' : value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs mt-1.5"
        placeholder={isData ? 'O pegá una dirección web para reemplazar el archivo' : 'O pegá la dirección web del logo (https://…)'}
      />
    </div>
  );
};

export const EditorSidebar: React.FC<EditorSidebarProps> = ({
  isOpen = true,
  onClose,
  blocks,
  projectData,
  rubrics,
  pendings,
  photos,
  observations,
  photoColumns,
  photoHeightMm,
  totalPages,
  sidebarWidth = 380,
  onSidebarWidthChange,
  zoom = 0.9,
  onZoomChange,
  onUpdateBlocks,
  onUpdateProjectData,
  onUpdateRubrics,
  onUpdatePendings,
  onUpdatePhotos,
  onUpdateObservations,
  onUpdatePhotoSettings,
  onAddPage,
  activeTab,
  onSetActiveTab,
  onOpenFreeFraming,
  onOpenAnnotate,
  onInsertBlock,
  onDeleteBlock,
  onRequestDeleteBlock,
  onUpdateBlockConfig,
  onSetInlineEditingBlockId,
  pagePhotosMap,
  photoPagesByBlock,
  textParts,
}) => {
  const [csvRawText, setCsvRawText] = useState('');
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvNotice, setCsvNotice] = useState<string | null>(null);
  const [showAddBlockMenu, setShowAddBlockMenu] = useState(false);
  const [targetAddPage, setTargetAddPage] = useState<number>(0);
  const [selectedSituationBlockId, setSelectedSituationBlockId] = useState<string>('');
  const [selectedPendingBlockId, setSelectedPendingBlockId] = useState<string>('');

  const situationBlocks = blocks.filter((b) => b.type === 'situation');
  const pendingBlocks = blocks.filter((b) => b.type === 'pending');

  const activeSituationBlock =
    blocks.find((b) => b.id === (selectedSituationBlockId || situationBlocks[0]?.id)) ||
    situationBlocks[0];
  const activePendingBlock =
    blocks.find((b) => b.id === (selectedPendingBlockId || pendingBlocks[0]?.id)) ||
    pendingBlocks[0];

  const currentRubrics = activeSituationBlock?.rubricsItems ?? rubrics;
  const currentPendings = activePendingBlock?.pendingsItems ?? pendings;

  const updateActiveRubrics = (newRubrics: RubricItem[]) => {
    if (activeSituationBlock) {
      onUpdateBlockConfig?.(activeSituationBlock.id, { rubricsItems: newRubrics });
    }
    onUpdateRubrics(newRubrics);
  };

  const updateActivePendings = (newPendings: PendingItem[]) => {
    if (activePendingBlock) {
      onUpdateBlockConfig?.(activePendingBlock.id, { pendingsItems: newPendings });
    }
    onUpdatePendings(newPendings);
  };

  // Drag-and-drop reordering state
  const [dragItem, setDragItem] = useState<{
    type: 'blocks' | 'rubrics' | 'pendings' | 'photos';
    index: number;
  } | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (
    e: React.DragEvent,
    type: 'blocks' | 'rubrics' | 'pendings' | 'photos',
    index: number
  ) => {
    setDragItem({ type, index });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${type}:${index}`);
  };

  const handleDragOver = (
    e: React.DragEvent,
    type: 'blocks' | 'rubrics' | 'pendings' | 'photos',
    index: number
  ) => {
    if (dragItem?.type === type) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragOverIndex !== index) {
        setDragOverIndex(index);
      }
    }
  };

  const handleDrop = (
    e: React.DragEvent,
    type: 'blocks' | 'rubrics' | 'pendings' | 'photos',
    targetIndex: number
  ) => {
    e.preventDefault();
    if (!dragItem || dragItem.type !== type || dragItem.index === targetIndex) {
      setDragItem(null);
      setDragOverIndex(null);
      return;
    }
    const from = dragItem.index;
    const to = targetIndex;

    if (type === 'blocks') {
      const list = [...blocks];
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      list.forEach((b, i) => {
        b.order = i;
      });
      onUpdateBlocks(list);
    } else if (type === 'rubrics') {
      const list = [...currentRubrics];
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      updateActiveRubrics(list);
    } else if (type === 'pendings') {
      const list = [...currentPendings];
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      updateActivePendings(list);
    } else if (type === 'photos') {
      const list = [...photos];
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      onUpdatePhotos(list);
    }

    setDragItem(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragItem(null);
    setDragOverIndex(null);
  };

  // Orden de bloques: siempre por `order`, nunca por la posición en la lista.
  const sortedBlocks = [...blocks].sort((a, b) => a.order - b.order);
  const commitOrder = (list: BlockConfig[]) =>
    onUpdateBlocks(list.map((b, i) => (b.order === i ? b : { ...b, order: i })));

  const moveBlock = (blockId: BlockId, direction: 'up' | 'down') => {
    const list = [...sortedBlocks];
    const i = list.findIndex((b) => b.id === blockId);
    const j = direction === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    commitOrder(list);
  };

  // Arrastre de bloques estilo Notion en el panel de hojas
  const [blockDragId, setBlockDragId] = useState<BlockId | null>(null);
  const [blockDrop, setBlockDrop] = useState<{ id: BlockId; pos: 'before' | 'after' } | null>(null);

  const dropBlock = (targetId: BlockId, pos: 'before' | 'after') => {
    if (!blockDragId || blockDragId === targetId) return;
    const list = sortedBlocks.filter((b) => b.id !== blockDragId);
    const moved = sortedBlocks.find((b) => b.id === blockDragId);
    const t = list.findIndex((b) => b.id === targetId);
    if (!moved || t < 0) return;
    list.splice(pos === 'before' ? t : t + 1, 0, moved);
    commitOrder(list);
  };

  const blockDragProps = (blockId: BlockId) => ({
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => {
      if (!blockDragId || blockDragId === blockId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const r = e.currentTarget.getBoundingClientRect();
      const pos: 'before' | 'after' = e.clientY < r.top + r.height / 2 ? 'before' : 'after';
      if (blockDrop?.id !== blockId || blockDrop.pos !== pos) setBlockDrop({ id: blockId, pos });
    },
    onDragLeave: (e: React.DragEvent<HTMLDivElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setBlockDrop((d) => (d?.id === blockId ? null : d));
    },
    onDrop: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (blockDrop) dropBlock(blockId, blockDrop.pos);
      setBlockDragId(null);
      setBlockDrop(null);
    },
  });

  const setBlockPage = (blockId: BlockId, pageIndex: number) => {
    const newBlocks = blocks.map((b) =>
      b.id === blockId ? { ...b, pageIndex } : b
    );
    onUpdateBlocks(newBlocks);
  };

  const toggleBlockEnabled = (blockId: BlockId) => {
    const newBlocks = blocks.map((b) =>
      b.id === blockId ? { ...b, enabled: !b.enabled } : b
    );
    onUpdateBlocks(newBlocks);
  };

  // CSV Import handler
  const handleCsvImport = () => {
    if (!csvRawText.trim()) return;
    const parsed = parseCSV(csvRawText);
    if (parsed.length > 0) {
      updateActiveRubrics(parsed);
      setShowCsvModal(false);
      setCsvRawText('');
      setCsvNotice(null);
    } else {
      setCsvNotice('No se encontraron actividades con avance mayor a 0%. Las actividades con 0% fueron ignoradas.');
    }
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const parsed = parseCSV(content);
        if (parsed.length > 0) {
          updateActiveRubrics(parsed);
          setCsvNotice(null);
        } else {
          setCsvNotice('No se encontraron actividades con avance mayor a 0%. Las actividades con 0% fueron ignoradas.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Photo uploader handler for multiple files (sorted naturally to guarantee correct sequence)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Natural alphanumeric sorting (ensures Foto 1, Foto 2, Foto 10 instead of random or reverse OS order)
    const sortedFiles = Array.from(files).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );

    const promises = sortedFiles.map((file, idx) => {
      return new Promise<PhotoItem | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const src = event.target?.result as string;
          if (src) {
            const rawName = file.name.replace(/\.[^/.]+$/, '');
            const cleanName = rawName.replace(/[-_]/g, ' ');
            const defaultCaption = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

            resolve({
              id: `photo-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
              src,
              caption: defaultCaption,
              objectFit: 'cover',
              objectPosition: 'center',
            });
          } else {
            resolve(null);
          }
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises).then((results) => {
      const validItems = results.filter((item): item is PhotoItem => item !== null);
      if (validItems.length > 0) {
        onUpdatePhotos([...photos, ...validItems]);
      }
    });

    e.target.value = '';
  };

  // Add new pending item
  const handleAddPending = () => {
    const newItem: PendingItem = {
      id: `pending-${Date.now()}`,
      description: 'Nueva situación pendiente de resolución...',
      responsible: 'Fiscalización / Contratista',
      deadline: 'A definir',
      impact: 'MEDIO',
      status: 'Pendiente',
    };
    updateActivePendings([...currentPendings, newItem]);
  };

  // Add new rubric item
  const handleAddRubric = () => {
    const newItem: RubricItem = {
      id: `rubric-${Date.now()}`,
      item: `${currentRubrics.length + 1}.0`,
      description: 'Nuevo rubro de obra',
      percent: 0,
      group: false,
    };
    updateActiveRubrics([...currentRubrics, newItem]);
  };

  if (!isOpen) return null;

  return (
    <aside
      style={{
        width:
          typeof window !== 'undefined' && window.innerWidth >= 1024
            ? `${sidebarWidth}px`
            : undefined,
      }}
      className="bg-white border-r border-slate-200 flex flex-col h-[calc(100vh-52px)] shadow-2xl lg:shadow-xs select-none shrink-0 no-print fixed lg:relative top-[52px] lg:top-0 left-0 z-40 w-[92vw] sm:w-[380px] lg:w-auto"
    >
      {/* Desktop resize handle */}
      <div
        className="hidden lg:block absolute right-0 top-0 w-1.5 h-full cursor-col-resize hover:bg-slate-300 transition-colors z-50"
        onMouseDown={(e) => {
          const handleMouseMove = (me: MouseEvent) => {
            if (onSidebarWidthChange) onSidebarWidthChange(Math.max(200, Math.min(600, me.clientX)));
          };
          const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
          };
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
        }}
      />

      {/* Editor Panel Header with Hide Button */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#0b455b] text-white shrink-0 border-b border-[#083445]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#f4c84a] flex items-center justify-center text-[#0b455b] shadow-xs">
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="font-bold text-xs tracking-wide text-white leading-none">
              Panel de Edición
            </h2>
            <p className="text-[10px] text-slate-300 leading-tight">
              Ajustes de bloques, datos y fotos
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            title="Ocultar panel de edición"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <PanelLeftClose className="w-3.5 h-3.5 text-[#f4c84a]" />
            <span>Ocultar</span>
          </button>
        )}
      </div>

      {/* Category Navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50 p-1 gap-1 shrink-0">
        <button
          onClick={() => onSetActiveTab('blocks')}
          className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'blocks'
              ? 'bg-white text-[#0b455b] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Gestión de Bloques y Hojas A4"
        >
          <Layers className="w-3.5 h-3.5 text-[#0b455b]" />
          <span>Hojas & Bloques</span>
        </button>

        <button
          onClick={() => onSetActiveTab('project')}
          className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'project'
              ? 'bg-white text-[#0b455b] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Datos Generales de la Obra y Contrato"
        >
          <FileText className="w-3.5 h-3.5 text-[#0b455b]" />
          <span>Datos generales</span>
        </button>
      </div>

      {/* Tab Contents Area */}
      <div className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar p-4 space-y-4">
        {/* TAB 1: BLOCKS & A4 PAGES MANAGEMENT */}
        {activeTab === 'blocks' && (
          <div className="space-y-4">
            {/* Action Bar with + Agregar Bloque and Auto-Distribuir */}
            <div className="flex items-center justify-between gap-1.5 bg-slate-100 p-2 rounded-lg border border-slate-200">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Bloques ({blocks.length})
                </span>
                <span className="text-[10.5px] text-slate-500">
                  {totalPages} {totalPages === 1 ? 'hoja' : 'hojas'} {paperShort()}
                </span>
              </div>

              <div className="flex items-center gap-1.5">

                {onInsertBlock && (
                  <button
                    type="button"
                    onClick={() => setShowAddBlockMenu(!showAddBlockMenu)}
                    className="bg-[#0b455b] hover:bg-[#083445] text-white text-[10.5px] font-bold px-2.5 py-1.5 rounded-md flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-[#f4c84a]" />
                    <span>Bloque</span>
                  </button>
                )}
              </div>
            </div>

            {/* In-Sidebar Block Type Selector Dropdown */}
            {showAddBlockMenu && onInsertBlock && (
              <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-1.5 border-b border-sky-200/60">
                  <span className="text-[11px] font-bold text-[#0b455b] uppercase tracking-wider">
                    Insertar Nuevo Bloque
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddBlockMenu(false)}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Target page picker */}
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 text-[11px]">Insertar en Hoja:</span>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }).map((_, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => setTargetAddPage(pIdx)}
                        className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] cursor-pointer ${
                          targetAddPage === pIdx
                            ? 'bg-[#0b455b] text-white'
                            : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Pág {pIdx + 1}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Block choices */}
                <div className="grid grid-cols-1 gap-1.5 pt-1">
                  {[
                    {
                      type: 'photos' as BlockType,
                      title: 'Fotografías independientes',
                      desc: 'Galería o foto única con columnas y altura propia',
                      icon: <ImageIcon className="w-4 h-4 text-[#0b455b]" />,
                    },
                    {
                      type: 'text' as BlockType,
                      title: 'Texto libre / Memoria técnica',
                      desc: 'Narrativa, notas de seguridad, clima o directivas',
                      icon: <FileText className="w-4 h-4 text-[#0b455b]" />,
                    },
                    {
                      type: 'specs' as BlockType,
                      title: 'Especificaciones y Ensayos',
                      desc: 'Tabla de control de materiales, probetas y calidad',
                      icon: <ClipboardList className="w-4 h-4 text-[#0b455b]" />,
                    },
                    {
                      type: 'observations' as BlockType,
                      title: 'Observaciones / Avisos',
                      desc: 'Nota, cita, lista o aviso de color (info, advertencia…)',
                      icon: <MessageSquareText className="w-4 h-4 text-[#0b455b]" />,
                    },
                    {
                      type: 'signatures' as BlockType,
                      title: 'Firmas y Conformidades',
                      desc: 'Fiscalización, contratista y sellos profesionales',
                      icon: <PenTool className="w-4 h-4 text-[#0b455b]" />,
                    },
                    {
                      type: 'pending' as BlockType,
                      title: 'Cuadro de Pendencias',
                      desc: 'Gestión de temas abiertos y responsables',
                      icon: <CheckSquare className="w-4 h-4 text-[#0b455b]" />,
                    },
                    {
                      type: 'situation' as BlockType,
                      title: 'Rubros y Curva de Avance',
                      desc: 'Avance físico ponderado y cronograma',
                      icon: <BarChart3 className="w-4 h-4 text-[#0b455b]" />,
                    },
                    {
                      type: 'scurve' as BlockType,
                      title: 'Curva S Independiente',
                      desc: 'Gráfico y tabla de avance físico vs programado',
                      icon: <TrendingUp className="w-4 h-4 text-[#0b455b]" />,
                    },
                    {
                      type: 'weather' as BlockType,
                      title: 'Condiciones Climáticas y Clima',
                      desc: 'Vista de día (mañana/tarde/noche) o semana completa',
                      icon: <CloudSun className="w-4 h-4 text-[#0b455b]" />,
                    },
                    {
                      type: 'document' as BlockType,
                      title: 'Documentos y Planos',
                      desc: 'Hojas de plano, contratos o fragmentos con pie',
                      icon: <FileImage className="w-4 h-4 text-[#0b455b]" />,
                    },
                    {
                      type: 'map' as BlockType,
                      title: 'Mapa / croquis',
                      desc: 'Punto en coordenadas UTM SIRGAS o lat/lon sobre calles o satélite',
                      icon: <MapPinned className="w-4 h-4 text-[#0b455b]" />,
                    },
                    {
                      type: 'gantt' as BlockType,
                      title: 'Cronograma (Gantt)',
                      desc: 'Tareas, hitos y avance real; se importa de Excel o Project',
                      icon: <CalendarRange className="w-4 h-4 text-[#0b455b]" />,
                    },
                    {
                      type: 'diagram' as BlockType,
                      title: 'Diagrama (Mermaid)',
                      desc: 'Flujos, organigramas, Gantt… con pie numerado como una figura',
                      icon: <Workflow className="w-4 h-4 text-[#0b455b]" />,
                    },
                    {
                      type: 'html' as BlockType,
                      title: 'HTML / SVG',
                      desc: 'Gráfico o tarjeta propia (de una IA): sin scripts, con colores del tema',
                      icon: <Code2 className="w-4 h-4 text-[#0b455b]" />,
                    },
                    {
                      type: 'toc' as BlockType,
                      title: 'Índice',
                      desc: 'Se arma solo con los títulos y el número de hoja',
                      icon: <ListTree className="w-4 h-4 text-[#0b455b]" />,
                    },
                    {
                      type: 'cover' as BlockType,
                      title: 'Portada',
                      desc: 'Hoja inicial con logos, título y datos (va al principio)',
                      icon: <BookOpen className="w-4 h-4 text-[#0b455b]" />,
                    },
                  ].map((opt) => (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => {
                        onInsertBlock(targetAddPage, blocks.length, opt.type);
                        setShowAddBlockMenu(false);
                      }}
                      className="flex items-start gap-2 p-2 bg-white hover:bg-sky-100/60 border border-slate-200 rounded-md text-left transition-colors cursor-pointer group/item"
                    >
                      <div className="p-1 rounded bg-slate-100 group-hover/item:bg-white shrink-0 mt-0.5">
                        {opt.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-bold text-slate-800 group-hover/item:text-[#0b455b] block">
                          {opt.title}
                        </span>
                        <span className="text-[9.5px] text-slate-500 block leading-tight">
                          {opt.desc}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Structured Page-by-Page View */}
            <div className="space-y-3">
              {Array.from({ length: totalPages }).map((_, pIdx) => {
                const pageBlocks = sortedBlocks.filter(
                  (b) => b.enabled && b.type !== 'footer' && b.pageIndex === pIdx
                );
                // Bloques de fotos que empezaron en una hoja anterior y continúan en esta
                const contPhotoBlocks = sortedBlocks.filter(
                  (b) => b.enabled && b.type === 'photos' && b.pageIndex !== pIdx && (photoPagesByBlock?.[b.id]?.[pIdx]?.length ?? 0) > 0
                );
                // Textos largos que empezaron en una hoja anterior y siguen en esta
                const contTextBlocks = sortedBlocks
                  .filter((b) => b.enabled && b.type === 'text' && b.pageIndex !== pIdx)
                  .map((b) => {
                    const parts = textParts?.[b.id] ?? [];
                    const k = parts.findIndex((p) => p.page === pIdx);
                    return { b, k, last: k === parts.length - 1 };
                  })
                  .filter((x) => x.k > 0);
                // La hoja está tomada por un texto que sigue en la siguiente: no se le agregan bloques
                const fullOfText = pageBlocks.length === 0 && contTextBlocks.some((x) => !x.last);

                return (
                  <div
                    key={`page-group-${pIdx}`}
                    className="bg-slate-50 border border-slate-300 rounded-xl p-3 space-y-2 shadow-2xs"
                  >
                    {/* Page Header Banner */}
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-[#0b455b] text-white font-mono font-bold text-[11px] flex items-center justify-center">
                          {pIdx + 1}
                        </span>
                        <span className="text-xs font-extrabold text-slate-800 tracking-wide">
                          PÁGINA {pIdx + 1}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono font-semibold">
                          ({pageBlocks.length + contPhotoBlocks.length + contTextBlocks.length} bloques)
                        </span>
                      </div>

                      {onInsertBlock && !fullOfText && (
                        <button
                          type="button"
                          onClick={() => {
                            setTargetAddPage(pIdx);
                            setShowAddBlockMenu(true);
                          }}
                          className="text-[10px] font-bold text-[#0b455b] hover:text-[#083445] bg-sky-100/70 hover:bg-sky-200/80 px-2 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3 h-3 text-[#0b455b]" />
                          <span>Bloque</span>
                        </button>
                      )}
                    </div>

                    {/* List of blocks on this page */}
                    <div className="space-y-2 pt-0.5">
                      {/* Continuaciones de bloques de fotos en esta hoja */}
                      {contPhotoBlocks.map((pb) => {
                        const n = photoPagesByBlock?.[pb.id]?.[pIdx]?.length ?? 0;
                        return (
                          <button
                            key={`cont-${pb.id}`}
                            type="button"
                            onClick={() => onSetInlineEditingBlockId?.(pb.id)}
                            className="w-full bg-sky-50 border border-sky-200 border-dashed rounded-lg p-2 flex items-center justify-between text-xs text-[#0b455b] cursor-pointer hover:bg-sky-100/70 text-left"
                            title="Continuación del bloque de fotos (clic para editarlo)"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <ImageIcon className="w-4 h-4 text-sky-600 shrink-0" />
                              <div className="truncate">
                                <span className="font-bold text-[11px] block text-slate-800 truncate">{pb.title}</span>
                                <span className="text-[9.5px] text-sky-700 font-medium block">Continúa de la hoja {pb.pageIndex + 1}</span>
                              </div>
                            </div>
                            <span className="text-[9.5px] bg-sky-100 text-sky-800 px-2 py-0.5 rounded font-mono font-bold shrink-0 border border-sky-200">
                              {n} foto{n === 1 ? '' : 's'}
                            </span>
                          </button>
                        );
                      })}

                      {/* Continuaciones de textos largos en esta hoja */}
                      {contTextBlocks.map(({ b: tb, last }) => (
                        <button
                          key={`cont-text-${tb.id}`}
                          type="button"
                          onClick={() => onSetInlineEditingBlockId?.(tb.id)}
                          className="w-full bg-sky-50 border border-sky-200 border-dashed rounded-lg p-2 flex items-center justify-between text-xs text-[#0b455b] cursor-pointer hover:bg-sky-100/70 text-left"
                          title="Continuación del bloque de texto (clic para editarlo)"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-sky-600 shrink-0" />
                            <div className="truncate">
                              <span className="font-bold text-[11px] block text-slate-800 truncate">{tb.title}</span>
                              <span className="text-[9.5px] text-sky-700 font-medium block">
                                Continúa de la hoja {tb.pageIndex + 1}{last ? '' : ' · sigue en la próxima'}
                              </span>
                            </div>
                          </div>
                          <span className="text-[9.5px] bg-sky-100 text-sky-800 px-2 py-0.5 rounded font-mono font-bold shrink-0 border border-sky-200">
                            texto
                          </span>
                        </button>
                      ))}

                      {pageBlocks.length === 0 && contPhotoBlocks.length === 0 && contTextBlocks.length === 0 ? (
                        <div className="p-3 text-center text-slate-400 text-[10.5px] italic border border-dashed border-slate-200 rounded-lg bg-white/50">
                          Página vacía. Usá el botón "Bloque" para agregar una sección aquí.
                        </div>
                      ) : (
                        pageBlocks.map((block) => {
                          const globalIdx = blocks.findIndex((b) => b.id === block.id);
                          const isPhotos = block.type === 'photos';
                          const isText = block.type === 'text';

                          return (
                            <div
                              key={block.id}
                              {...blockDragProps(block.id)}
                              className={`group/card relative bg-white border border-slate-300 rounded-lg p-2.5 shadow-2xs space-y-1.5 transition-all ${
                                blockDragId === block.id ? 'opacity-40' : ''
                              }`}
                            >
                              {blockDrop?.id === block.id && (
                                <div
                                  className="absolute left-0 right-0 h-[3px] rounded-full bg-sky-500 pointer-events-none"
                                  style={blockDrop.pos === 'before' ? { top: -6 } : { bottom: -6 }}
                                />
                              )}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <span
                                    draggable
                                    onDragStart={(e) => {
                                      setBlockDragId(block.id);
                                      e.dataTransfer.effectAllowed = 'move';
                                      try { e.dataTransfer.setData('text/plain', block.id); } catch { /* noop */ }
                                      const card = (e.currentTarget as HTMLElement).closest('.group\\/card') as HTMLElement | null;
                                      if (card) e.dataTransfer.setDragImage(card, 16, 16);
                                    }}
                                    onDragEnd={() => { setBlockDragId(null); setBlockDrop(null); }}
                                    className="p-0.5 -ml-1 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 cursor-grab active:cursor-grabbing"
                                    title="Arrastrar para reordenar el bloque"
                                  >
                                    <GripVertical className="w-3.5 h-3.5" />
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => toggleBlockEnabled(block.id)}
                                    className={`p-1 rounded cursor-pointer ${
                                      block.enabled
                                        ? 'text-emerald-700 hover:bg-emerald-50'
                                        : 'text-slate-400 hover:bg-slate-200'
                                    }`}
                                    title={block.enabled ? 'Ocultar bloque' : 'Mostrar bloque'}
                                  >
                                    {block.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                  </button>
                                  <span className="text-xs font-bold text-slate-800 truncate" title={block.title}>
                                    {block.title}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {/* In-situ Edit button */}
                                  {onSetInlineEditingBlockId && (
                                    <button
                                      type="button"
                                      onClick={() => onSetInlineEditingBlockId(block.id)}
                                      className="p-1 text-slate-500 hover:text-[#0b455b] hover:bg-slate-100 rounded cursor-pointer"
                                      title="Editar in-situ en la hoja"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  )}

                                  {/* Move Up */}
                                  <button
                                    onClick={() => moveBlock(block.id, 'up')}
                                    disabled={sortedBlocks[0]?.id === block.id}
                                    className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded disabled:opacity-20 cursor-pointer"
                                    title="Mover arriba"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Move Down */}
                                  <button
                                    onClick={() => moveBlock(block.id, 'down')}
                                    disabled={sortedBlocks[sortedBlocks.length - 1]?.id === block.id}
                                    className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded disabled:opacity-20 cursor-pointer"
                                    title="Mover abajo"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Delete button (non-header) */}
                                  {(onRequestDeleteBlock || onDeleteBlock) && block.id !== 'header' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (onRequestDeleteBlock) {
                                          onRequestDeleteBlock(block.id);
                                        } else if (onDeleteBlock) {
                                          onDeleteBlock(block.id);
                                        }
                                      }}
                                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                                      title="Eliminar este bloque"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Specialized per-block controls in sidebar */}
                              {isPhotos && (
                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 space-y-1.5 text-[10px]">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-slate-600">Columnas:</span>
                                    <div className="flex items-center gap-1">
                                      {([1, 2, 3, 4] as const).map((col) => (
                                        <button
                                          key={col}
                                          type="button"
                                          onClick={() => onUpdateBlockConfig?.(block.id, { photoColumns: col })}
                                          className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                                            (block.photoColumns ?? photoColumns) === col
                                              ? 'bg-[#0b455b] text-white shadow-2xs'
                                              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                                          }`}
                                        >
                                          {col}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-slate-600">Alto:</span>
                                    <input
                                      type="range"
                                      min={30}
                                      max={120}
                                      step={1}
                                      value={block.photoHeightMm ?? photoHeightMm}
                                      onChange={(e) => onUpdateBlockConfig?.(block.id, { photoHeightMm: Number(e.target.value) })}
                                      className="flex-1 accent-[#0b455b] cursor-pointer"
                                    />
                                    <span className="font-mono font-bold text-[#0b455b] w-11 text-right">{block.photoHeightMm ?? photoHeightMm} mm</span>
                                  </div>
                                  <div className="text-[9.5px] text-slate-500">
                                    {(block.photos ?? []).length} fotos
                                    {(() => {
                                      const pages = Object.keys(photoPagesByBlock?.[block.id] ?? {}).length;
                                      const here = photoPagesByBlock?.[block.id]?.[block.pageIndex]?.length ?? 0;
                                      return pages > 1 ? ` · ${here} en esta hoja, sigue en ${pages - 1} hoja${pages > 2 ? 's' : ''} más` : '';
                                    })()}
                                  </div>
                                </div>
                              )}

                              {isText && (
                                <div className="bg-slate-50 p-1.5 rounded border border-slate-200 text-[10px] text-slate-600 line-clamp-2">
                                  {(block.textContent || '').replace(/<!--[\s\S]*?-->/g, '').trim() || 'Sin contenido de texto aún. Haz clic en el lápiz para escribir.'}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Bloques ocultos: siguen en el panel para poder volver a mostrarlos */}
              {sortedBlocks.some((b) => !b.enabled && b.type !== 'footer') && (
                <div className="bg-white border border-dashed border-slate-300 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center gap-2 pb-1 text-[11px] font-extrabold text-slate-500 tracking-wide">
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>BLOQUES OCULTOS</span>
                    <span className="font-mono font-semibold text-[10px]">
                      ({sortedBlocks.filter((b) => !b.enabled && b.type !== 'footer').length})
                    </span>
                  </div>
                  {sortedBlocks.filter((b) => !b.enabled && b.type !== 'footer').map((block) => (
                    <div key={block.id} className="flex items-center gap-1.5 p-1.5 rounded-lg bg-slate-50 border border-slate-200">
                      <button
                        type="button"
                        onClick={() => toggleBlockEnabled(block.id)}
                        className="p-1 rounded text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                        title="Mostrar bloque"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-semibold text-slate-500 truncate flex-1" title={block.title}>{block.title}</span>
                      <button
                        type="button"
                        onClick={() => toggleBlockEnabled(block.id)}
                        className="text-[10px] font-bold text-[#0b455b] bg-sky-100/70 hover:bg-sky-200/80 px-2 py-0.5 rounded cursor-pointer"
                      >
                        Mostrar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}


        {/* TAB 2: PROJECT & CONTRACT DATA */}
        {activeTab === 'project' && (
          <div className="space-y-3 text-xs">
            <p className="text-[10.5px] text-slate-500 leading-relaxed px-0.5">
              Datos generales del informe. El encabezado, el pie y el módulo de contrato los toman de acá;
              los <b>porcentajes de avance</b> se editan directamente en la hoja (módulo Contrato e indicadores).
            </p>

            {/* ---- Encabezado ---- */}
            <DataCard title="Encabezado" hint="Datos que usa el encabezado ({titulo}, {obra}…) y sus logos">
              <DataField label="Título del informe">
                <input type="text" value={projectData.reportTitle} placeholder="REPORTE SEMANAL DE OBRA"
                  onChange={(e) => onUpdateProjectData({ reportTitle: e.target.value })} className={inputCls} />
              </DataField>
              <DataField label="Dirección / Superintendencia">
                <input type="text" value={projectData.director}
                  onChange={(e) => onUpdateProjectData({ director: e.target.value })} className={inputCls} />
              </DataField>
              <DataField label="Nombre de la obra">
                <textarea rows={2} value={projectData.project}
                  onChange={(e) => onUpdateProjectData({ project: e.target.value })} className={`${inputCls} resize-y`} />
              </DataField>
              <DataField label="Fecha de toma de datos" hint="La semana del clima se calcula desde esta fecha">
                <input type="date" value={projectData.reportDate}
                  onChange={(e) => onUpdateProjectData({ reportDate: e.target.value })} className={inputCls} />
              </DataField>
              <DataField label="Logo institucional">
                <LogoPicker value={projectData.logoUrl} onChange={(v) => onUpdateProjectData({ logoUrl: v })} />
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer text-[11px]">
                  <input type="checkbox" checked={projectData.invertLogoColor}
                    onChange={(e) => onUpdateProjectData({ invertLogoColor: e.target.checked })} className="rounded text-sky-600" />
                  <span>Invertir a blanco (para fondos oscuros)</span>
                </label>
              </DataField>
              <DataField label="Logo derecho (opcional)" hint="Organismo, financiador, contratista…">
                <LogoPicker value={projectData.logoRightUrl || ''} onChange={(v) => onUpdateProjectData({ logoRightUrl: v })} />
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer text-[11px]">
                  <input type="checkbox" checked={!!projectData.invertLogoRight}
                    onChange={(e) => onUpdateProjectData({ invertLogoRight: e.target.checked })} className="rounded text-sky-600" />
                  <span>Invertir a blanco (para fondos oscuros)</span>
                </label>
              </DataField>
              <p className="text-[10.5px] text-slate-500 leading-relaxed">
                El diseño del encabezado (Institucional, Empresa o ISO) y sus renglones se editan en la hoja: doble clic sobre el encabezado.
                Los textos pueden usar estos datos con <code>{'{titulo}'}</code>, <code>{'{obra}'}</code>, <code>{'{fecha}'}</code>, <code>{'{direccion}'}</code>…
              </p>
            </DataCard>

            {/* ---- Campos propios ---- */}
            <DataCard title="Campos del informe" hint="Datos propios que se repiten en el informe: se usan con {clave} o escribiendo @ en un texto">
              <FieldsEditor fields={projectData.fields || []} onChange={(fields) => onUpdateProjectData({ fields })} />
            </DataCard>

            {/* ---- Contrato ---- */}
            <DataCard title="Contrato" hint="Vinculado al módulo Contrato e indicadores (se edita en ambos lados)">
              <DataField label="Contrato N.º y descripción">
                <input type="text" value={projectData.contract}
                  onChange={(e) => onUpdateProjectData({ contract: e.target.value })} className={inputCls} />
              </DataField>
              <DataField label="Empresa contratista">
                <input type="text" value={projectData.contractor}
                  onChange={(e) => onUpdateProjectData({ contractor: e.target.value })} className={inputCls} />
              </DataField>
              <div className="grid grid-cols-2 gap-2">
                <DataField label="Fecha de O.I.S.">
                  <input type="date" value={projectData.startDate}
                    onChange={(e) => onUpdateProjectData({ startDate: e.target.value })} className={inputCls} />
                </DataField>
                <DataField label="Fecha fin prevista">
                  <input type="date" value={projectData.endDate || ''}
                    onChange={(e) => onUpdateProjectData({ endDate: e.target.value })} className={inputCls} />
                </DataField>
                <DataField label="Monto + aditivos (PYG)">
                  <input type="text" value={projectData.contractValue}
                    onChange={(e) => onUpdateProjectData({ contractValue: e.target.value })} className={`${inputCls} font-mono`} />
                </DataField>
                <DataField label="Medición acumulada (PYG)">
                  <input type="text" value={projectData.measurement}
                    onChange={(e) => onUpdateProjectData({ measurement: e.target.value })} className={`${inputCls} font-mono`} />
                </DataField>
              </div>
            </DataCard>

            {/* ---- Pie de página ---- */}
            <DataCard title="Pie de página" hint="También se edita en la hoja: doble clic sobre el pie">
              <div className="grid grid-cols-2 gap-2">
                <DataField label="Texto izquierdo">
                  <input type="text" value={projectData.footerLeft} placeholder="Texto izq…"
                    onChange={(e) => onUpdateProjectData({ footerLeft: e.target.value })} className={inputCls} />
                </DataField>
                <DataField label="Texto derecho">
                  <input type="text" value={projectData.footerRight} placeholder="Texto der…"
                    onChange={(e) => onUpdateProjectData({ footerRight: e.target.value })} className={inputCls} />
                </DataField>
              </div>
            </DataCard>
          </div>
        )}
      </div>

      {/* Escala de las hojas (antes flotaba al pie de la vista previa) */}
      {onZoomChange && (
        <div className="p-2.5 border-t border-slate-200 bg-slate-50 flex items-center gap-2 text-[11px] text-slate-600 shrink-0 select-none">
          <span className="font-semibold text-slate-700 whitespace-nowrap">Escala de hojas:</span>
          <button type="button" onClick={() => onZoomChange(Math.max(0.25, Number((zoom - 0.05).toFixed(2))))}
            title="Reducir" className="p-1 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"><ZoomOut className="w-3.5 h-3.5" /></button>
          <input
            type="range"
            min="25"
            max="250"
            step="5"
            value={Math.round(zoom * 100)}
            onChange={(e) => onZoomChange(parseInt(e.target.value) / 100)}
            className="flex-1 min-w-0 accent-[#0b455b] cursor-pointer"
            title="Escala de las hojas · también con la rueda del mouse"
          />
          <button type="button" onClick={() => onZoomChange(Math.min(2.5, Number((zoom + 0.05).toFixed(2))))}
            title="Aumentar" className="p-1 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"><ZoomIn className="w-3.5 h-3.5" /></button>
          <span className="font-mono text-[#0b455b] font-bold w-10 text-right">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => onZoomChange(0.85)} title="Volver a 85 %"
            className="px-1.5 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer">Ajustar</button>
        </div>
      )}
    </aside>
  );
};

