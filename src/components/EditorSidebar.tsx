import React, { useState } from 'react';
import {
  ProjectData,
  RubricItem,
  PendingItem,
  PhotoItem,
  ObservationsData,
  BlockConfig,
  BlockId,
  ImpactLevel,
  PendingStatus,
} from '../types';
import { parseCSV } from '../utils/csvParser';
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
} from 'lucide-react';

interface EditorSidebarProps {
  blocks: BlockConfig[];
  projectData: ProjectData;
  rubrics: RubricItem[];
  pendings: PendingItem[];
  photos: PhotoItem[];
  observations: ObservationsData;
  photoColumns: 1 | 2 | 3 | 4;
  photoHeightMm: number;
  photosPage1Count?: number;
  totalPages: number;
  sidebarWidth?: number;
  onSidebarWidthChange?: (width: number) => void;
  onUpdateBlocks: (blocks: BlockConfig[]) => void;
  onUpdateProjectData: (data: Partial<ProjectData>) => void;
  onUpdateRubrics: (rubrics: RubricItem[]) => void;
  onUpdatePendings: (pendings: PendingItem[]) => void;
  onUpdatePhotos: (photos: PhotoItem[]) => void;
  onUpdateObservations: (obs: Partial<ObservationsData>) => void;
  onUpdatePhotoSettings: (columns: 1 | 2 | 3 | 4, heightMm: number) => void;
  onUpdatePhotosPage1Count?: (count: number) => void;
  onAddPage: () => void;
  onAutoDistribute: () => void;
}

type TabType = 'blocks' | 'project' | 'rubrics' | 'pendings' | 'photos' | 'observations';

export const EditorSidebar: React.FC<EditorSidebarProps> = ({
  blocks,
  projectData,
  rubrics,
  pendings,
  photos,
  observations,
  photoColumns,
  photoHeightMm,
  photosPage1Count = 2,
  totalPages,
  sidebarWidth = 380,
  onSidebarWidthChange,
  onUpdateBlocks,
  onUpdateProjectData,
  onUpdateRubrics,
  onUpdatePendings,
  onUpdatePhotos,
  onUpdateObservations,
  onUpdatePhotoSettings,
  onUpdatePhotosPage1Count,
  onAddPage,
  onAutoDistribute,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('blocks');
  const [csvRawText, setCsvRawText] = useState('');
  const [showCsvModal, setShowCsvModal] = useState(false);

  // Reorder a block in global array
  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;
    const newBlocks = [...blocks];
    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[targetIndex];
    newBlocks[targetIndex] = temp;
    // Update order numbers
    newBlocks.forEach((b, i) => {
      b.order = i;
    });
    onUpdateBlocks(newBlocks);
  };

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
      onUpdateRubrics(parsed);
      setShowCsvModal(false);
      setCsvRawText('');
    } else {
      alert('No se encontraron actividades con avance mayor a 0%. Las actividades con 0% fueron ignoradas.');
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
          onUpdateRubrics(parsed);
        } else {
          alert('No se encontraron actividades con avance mayor a 0%. Las actividades con 0% fueron ignoradas.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Photo uploader handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const src = event.target?.result as string;
        if (src) {
          const newPhoto: PhotoItem = {
            id: `photo-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
            src,
            caption: `Foto ${photos.length + idx + 1}: Inspección de avance en sector ${String.fromCharCode(65 + (photos.length % 5))}.`,
          };
          onUpdatePhotos([...photos, newPhoto]);
        }
      };
      reader.readAsDataURL(file);
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
    onUpdatePendings([...pendings, newItem]);
  };

  // Add new rubric item
  const handleAddRubric = () => {
    const newItem: RubricItem = {
      id: `rubric-${Date.now()}`,
      item: `${rubrics.length + 1}.0`,
      description: 'Nuevo rubro de obra',
      percent: 0,
      group: false,
    };
    onUpdateRubrics([...rubrics, newItem]);
  };

  return (
    <aside
      style={{ width: `${sidebarWidth}px` }}
      className="bg-white border-r border-slate-200 flex flex-col h-[calc(100vh-52px)] shadow-xs select-none shrink-0 no-print"
    >
      {/* Category Navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto p-1 gap-1 shrink-0">
        <button
          onClick={() => setActiveTab('blocks')}
          className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
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
          onClick={() => setActiveTab('project')}
          className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
            activeTab === 'project'
              ? 'bg-white text-[#0b455b] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Datos de Obra y Contrato"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Obra</span>
        </button>

        <button
          onClick={() => setActiveTab('rubrics')}
          className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
            activeTab === 'rubrics'
              ? 'bg-white text-[#0b455b] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Rubros y Gráfico de Avance"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Rubros</span>
        </button>

        <button
          onClick={() => setActiveTab('pendings')}
          className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
            activeTab === 'pendings'
              ? 'bg-white text-[#0b455b] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Cuadro de Pendencias Redondeado"
        >
          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
          <span>Pendencias</span>
        </button>

        <button
          onClick={() => setActiveTab('photos')}
          className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
            activeTab === 'photos'
              ? 'bg-white text-[#0b455b] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Fotografías de Obra"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Fotos</span>
        </button>

        <button
          onClick={() => setActiveTab('observations')}
          className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
            activeTab === 'observations'
              ? 'bg-white text-[#0b455b] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Observaciones y Firmas"
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Firmas</span>
        </button>
      </div>

      {/* Tab Contents Area */}
      <div className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar p-4 space-y-4">
        {/* TAB 1: BLOCKS & A4 PAGES MANAGEMENT */}
        {activeTab === 'blocks' && (
          <div className="space-y-4">
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-xs text-sky-900">
              <div className="font-bold flex items-center gap-1.5 mb-1">
                <Sparkles className="w-4 h-4 text-sky-600" />
                <span>Paginación y Distribución A4</span>
              </div>
              <p className="text-[11px] text-sky-800 leading-relaxed">
                Cada sección es un bloque modular. Puedes moverlo arriba/abajo, decidir en qué hoja A4
                colocarlo o presionar &quot;Auto-distribuir&quot; para que calce perfecto sin cortarse.
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  onClick={onAutoDistribute}
                  className="flex-1 bg-[#1f6487] hover:bg-[#185370] text-white font-semibold py-1.5 px-2 rounded text-[11px] transition-colors flex items-center justify-center gap-1 shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#f4c84a]" />
                  <span>Distribuir inteligentemente</span>
                </button>
                <button
                  onClick={onAddPage}
                  className="bg-white hover:bg-slate-100 text-slate-800 font-semibold py-1.5 px-2.5 rounded text-[11px] border border-slate-300 transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Hoja</span>
                </button>
              </div>
            </div>

            {/* List of blocks */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-1">
                <span>Bloques del Reporte ({blocks.length})</span>
                <span className="text-[11px] font-normal text-slate-400">Total: {totalPages} hojas A4</span>
              </div>

              {blocks.map((block, idx) => (
                <div
                  key={block.id}
                  className={`border rounded-lg p-2.5 transition-all ${
                    block.enabled
                      ? 'bg-white border-slate-300 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        onClick={() => toggleBlockEnabled(block.id)}
                        className={`p-1 rounded ${
                          block.enabled ? 'text-emerald-700 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-200'
                        }`}
                        title={block.enabled ? 'Ocultar bloque' : 'Mostrar bloque'}
                      >
                        {block.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <span className="text-xs font-bold text-slate-800 truncate">
                        {block.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveBlock(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded disabled:opacity-20"
                        title="Mover arriba"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveBlock(idx, 'down')}
                        disabled={idx === blocks.length - 1}
                        className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded disabled:opacity-20"
                        title="Mover abajo"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Page selector for this block */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px]">
                    <span className="text-slate-500 font-medium">Asignar a Hoja:</span>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }).map((_, pIdx) => (
                        <button
                          key={pIdx}
                          onClick={() => setBlockPage(block.id, pIdx)}
                          className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] transition-colors ${
                            block.pageIndex === pIdx
                              ? 'bg-[#0b455b] text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Pág {pIdx + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: PROJECT & CONTRACT DATA */}
        {activeTab === 'project' && (
          <div className="space-y-3.5 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Dirección / Superintendencia
              </label>
              <input
                type="text"
                value={projectData.director}
                onChange={(e) => onUpdateProjectData({ director: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-sky-500 text-xs"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Nombre de la Obra / Proyecto
              </label>
              <textarea
                rows={2}
                value={projectData.project}
                onChange={(e) => onUpdateProjectData({ project: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-sky-500 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Fecha de toma de datos
                </label>
                <input
                  type="date"
                  value={projectData.reportDate}
                  onChange={(e) => onUpdateProjectData({ reportDate: e.target.value })}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Fecha de O.I.S.
                </label>
                <input
                  type="date"
                  value={projectData.startDate}
                  onChange={(e) => onUpdateProjectData({ startDate: e.target.value })}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Contrato N.º y Descripción
              </label>
              <input
                type="text"
                value={projectData.contract}
                onChange={(e) => onUpdateProjectData({ contract: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Empresa Contratista
              </label>
              <input
                type="text"
                value={projectData.contractor}
                onChange={(e) => onUpdateProjectData({ contractor: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Valor Contrato (PYG)
                </label>
                <input
                  type="text"
                  value={projectData.contractValue}
                  onChange={(e) => onUpdateProjectData({ contractValue: e.target.value })}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Medición Acumulada (PYG)
                </label>
                <input
                  type="text"
                  value={projectData.measurement}
                  onChange={(e) => onUpdateProjectData({ measurement: e.target.value })}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono text-xs"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3">
              <label className="block font-bold text-slate-800 mb-2">
                Porcentajes de Avance de la Obra (%)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="block text-[11px] text-slate-600 mb-1">Plazo %</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={projectData.timeProgress}
                    onChange={(e) =>
                      onUpdateProjectData({ timeProgress: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1 font-mono text-xs font-bold"
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-slate-600 mb-1">Financiero %</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={projectData.financialProgress}
                    onChange={(e) =>
                      onUpdateProjectData({ financialProgress: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1 font-mono text-xs font-bold"
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-slate-600 mb-1">Físico / Gral %</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={projectData.physicalProgress}
                    onChange={(e) =>
                      onUpdateProjectData({ physicalProgress: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1 font-mono text-xs font-bold text-emerald-700"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3">
              <label className="block font-bold text-slate-700 mb-1">
                Logo Institucional (URL o SVG)
              </label>
              <input
                type="text"
                value={projectData.logoUrl}
                onChange={(e) => onUpdateProjectData({ logoUrl: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs mb-2"
                placeholder="https://..."
              />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={projectData.invertLogoColor}
                    onChange={(e) => onUpdateProjectData({ invertLogoColor: e.target.checked })}
                    className="rounded text-sky-600"
                  />
                  <span>Invertir a blanco (para fondos oscuros)</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: RUBRICS & PROGRESS GRAPH */}
        {activeTab === 'rubrics' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Lista de Rubros ({rubrics.length})
              </span>
              <div className="flex items-center gap-1.5">
                <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2 py-1 rounded text-xs transition-colors flex items-center gap-1">
                  <Upload className="w-3 h-3" />
                  <span>Subir CSV</span>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleCsvFileUpload}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={() => setShowCsvModal(true)}
                  className="bg-sky-50 text-sky-700 hover:bg-sky-100 font-semibold px-2 py-1 rounded text-xs transition-colors"
                >
                  Pegar CSV
                </button>
              </div>
            </div>

            {/* Rubrics table in editor */}
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {rubrics.map((r, i) => (
                <div
                  key={r.id || i}
                  className={`border rounded-md p-2 text-xs flex flex-col gap-1.5 ${
                    r.group ? 'bg-slate-50 border-slate-300' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Cod."
                      value={r.item}
                      onChange={(e) => {
                        const copy = [...rubrics];
                        copy[i].item = e.target.value;
                        onUpdateRubrics(copy);
                      }}
                      className="w-14 border border-slate-300 rounded px-1.5 py-0.5 font-mono text-[11px]"
                    />
                    <input
                      type="text"
                      placeholder="Descripción del rubro..."
                      value={r.description}
                      onChange={(e) => {
                        const copy = [...rubrics];
                        copy[i].description = e.target.value;
                        onUpdateRubrics(copy);
                      }}
                      className="flex-1 border border-slate-300 rounded px-2 py-0.5 text-xs font-medium"
                    />
                    <button
                      onClick={() => {
                        const copy = rubrics.filter((_, idx) => idx !== i);
                        onUpdateRubrics(copy);
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1"
                      title="Eliminar rubro"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-[11px] text-slate-600">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={r.group}
                        onChange={(e) => {
                          const copy = [...rubrics];
                          copy[i].group = e.target.checked;
                          onUpdateRubrics(copy);
                        }}
                        className="rounded text-sky-600"
                      />
                      <span>Es Etapa / Grupo Principal</span>
                    </label>

                    <div className="flex items-center gap-1">
                      <span>Avance:</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={r.percent}
                        onChange={(e) => {
                          const copy = [...rubrics];
                          copy[i].percent = parseFloat(e.target.value) || 0;
                          onUpdateRubrics(copy);
                        }}
                        className="w-16 border border-slate-300 rounded px-1.5 py-0.5 text-right font-mono font-bold"
                      />
                      <span>%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleAddRubric}
              className="w-full border border-dashed border-slate-300 hover:border-slate-400 text-slate-700 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir Nuevo Rubro</span>
            </button>
          </div>
        )}

        {/* TAB 4: CUADRO DE PENDENCIAS (ESQUINAS REDONDEADAS) */}
        {activeTab === 'pendings' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800">
                  Cuadro de Pendencias ({pendings.length})
                </span>
                <span className="block text-[11px] text-slate-500">
                  Diseñado como cuadro integrado con esquinas redondeadas
                </span>
              </div>
              <button
                onClick={handleAddPending}
                className="bg-[#0b455b] hover:bg-[#16556e] text-white font-semibold px-2.5 py-1 rounded text-xs flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Pendencia</span>
              </button>
            </div>

            <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
              {pendings.map((p, i) => (
                <div
                  key={p.id || i}
                  className="border border-slate-300 rounded-lg p-2.5 bg-white shadow-2xs space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-[#0b455b] text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">
                      #{i + 1}
                    </span>
                    <textarea
                      rows={2}
                      placeholder="Descripción de la pendencia o situación crítica..."
                      value={p.description}
                      onChange={(e) => {
                        const copy = [...pendings];
                        copy[i].description = e.target.value;
                        onUpdatePendings(copy);
                      }}
                      className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs"
                    />
                    <button
                      onClick={() => {
                        const copy = pendings.filter((_, idx) => idx !== i);
                        onUpdatePendings(copy);
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1"
                      title="Eliminar pendencia"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[10px] text-slate-500 mb-0.5 font-medium">
                        Responsable:
                      </span>
                      <input
                        type="text"
                        value={p.responsible}
                        onChange={(e) => {
                          const copy = [...pendings];
                          copy[i].responsible = e.target.value;
                          onUpdatePendings(copy);
                        }}
                        className="w-full border border-slate-300 rounded px-1.5 py-0.5 text-xs"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 mb-0.5 font-medium">
                        Plazo / Fecha:
                      </span>
                      <input
                        type="text"
                        value={p.deadline}
                        onChange={(e) => {
                          const copy = [...pendings];
                          copy[i].deadline = e.target.value;
                          onUpdatePendings(copy);
                        }}
                        className="w-full border border-slate-300 rounded px-1.5 py-0.5 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                    <div>
                      <span className="block text-[10px] text-slate-500 mb-0.5 font-medium">
                        Nivel de Impacto:
                      </span>
                      <select
                        value={p.impact}
                        onChange={(e) => {
                          const copy = [...pendings];
                          copy[i].impact = e.target.value as ImpactLevel;
                          onUpdatePendings(copy);
                        }}
                        className="w-full border border-slate-300 rounded px-1.5 py-0.5 text-xs font-bold"
                      >
                        <option value="CRÍTICO">CRÍTICO</option>
                        <option value="ALTO">ALTO</option>
                        <option value="MEDIO">MEDIO</option>
                        <option value="BAJO">BAJO</option>
                      </select>
                    </div>

                    <div>
                      <span className="block text-[10px] text-slate-500 mb-0.5 font-medium">
                        Estado:
                      </span>
                      <select
                        value={p.status}
                        onChange={(e) => {
                          const copy = [...pendings];
                          copy[i].status = e.target.value as PendingStatus;
                          onUpdatePendings(copy);
                        }}
                        className="w-full border border-slate-300 rounded px-1.5 py-0.5 text-xs"
                      >
                        <option value="En análisis">En análisis</option>
                        <option value="Pendiente">Pendiente</option>
                        <option value="En ejecución">En ejecución</option>
                        <option value="Aguardando respuesta">Aguardando respuesta</option>
                        <option value="Resuelto">Resuelto</option>
                        <option value="Vencido">Vencido</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: PHOTOS */}
        {activeTab === 'photos' && (
          <div className="space-y-3.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">
                Fotografías ({photos.length})
              </span>
              <label className="cursor-pointer bg-[#0b455b] hover:bg-[#16556e] text-white font-semibold px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" />
                <span>+ Subir Fotos</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Anti-cut protection banner */}
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-2.5 text-xs text-sky-900 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Protección anti-cortes A4 activa:</span>
                <span className="text-[11px] text-sky-800 leading-tight block mt-0.5">
                  Si el bloque fotográfico no entra entero en la primera hoja, salta automáticamente a la Hoja 2 para no cortar ninguna fotografía.
                </span>
              </div>
            </div>

            {/* Layout options for photo block */}
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Columnas de Fotos:</span>
                <div className="flex items-center gap-1">
                  {([1, 2, 3, 4] as const).map((cols) => (
                    <button
                      key={cols}
                      onClick={() => onUpdatePhotoSettings(cols, photoHeightMm)}
                      className={`px-2 py-0.5 rounded font-bold text-xs ${
                        photoColumns === cols
                          ? 'bg-[#0b455b] text-white'
                          : 'bg-white border border-slate-300 text-slate-700'
                      }`}
                    >
                      {cols} col
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Altura de imagen:</span>
                <select
                  value={photoHeightMm}
                  onChange={(e) =>
                    onUpdatePhotoSettings(photoColumns, parseInt(e.target.value) || 40)
                  }
                  className="border border-slate-300 rounded px-2 py-0.5 text-xs bg-white font-medium"
                >
                  <option value={40}>40 mm (4 cm - Mínimo Hoja 1)</option>
                  <option value={45}>45 mm (4.5 cm - Recomendado)</option>
                  <option value={50}>50 mm (5 cm)</option>
                  <option value={60}>60 mm (6 cm)</option>
                  <option value={70}>70 mm (7 cm - Estándar)</option>
                  <option value={85}>85 mm (8.5 cm)</option>
                  <option value={100}>100 mm (10 cm)</option>
                </select>
              </div>

              {/* Photos on Page 1 selector */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                <span className="font-semibold text-slate-700">Fotos en Hoja 1:</span>
                <select
                  value={photosPage1Count}
                  onChange={(e) =>
                    onUpdatePhotosPage1Count?.(parseInt(e.target.value) ?? 2)
                  }
                  className="border border-slate-300 rounded px-2 py-0.5 text-xs bg-white font-medium"
                >
                  <option value={1}>1 foto (resto en Hoja 2)</option>
                  <option value={2}>2 fotos (resto en Hoja 2)</option>
                  <option value={3}>3 fotos (resto en Hoja 2)</option>
                  <option value={4}>4 fotos (todas en Hoja 1)</option>
                  <option value={0}>0 (todas en Hoja 2)</option>
                </select>
              </div>
            </div>

            {/* Photos list */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {photos.map((ph, idx) => (
                <div
                  key={ph.id || idx}
                  className="border border-slate-200 rounded-lg p-2 bg-white flex gap-2.5 items-start"
                >
                  <img
                    src={ph.src}
                    alt="preview"
                    className="w-16 h-14 object-cover rounded border border-slate-200 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      placeholder="Pie de foto..."
                      value={ph.caption}
                      onChange={(e) => {
                        const copy = [...photos];
                        copy[idx].caption = e.target.value;
                        onUpdatePhotos(copy);
                      }}
                      className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                    />
                  </div>
                  <button
                    onClick={() => {
                      const copy = photos.filter((_, i) => i !== idx);
                      onUpdatePhotos(copy);
                    }}
                    className="text-slate-400 hover:text-rose-600 p-1 shrink-0"
                    title="Eliminar foto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: OBSERVATIONS & SIGNATURES */}
        {activeTab === 'observations' && (
          <div className="space-y-3.5 text-xs">
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Notas Generales / Observaciones
              </label>
              <textarea
                rows={4}
                value={observations.notes}
                onChange={(e) => onUpdateObservations({ notes: e.target.value })}
                className="w-full border border-slate-300 rounded p-2 text-xs"
                placeholder="Observaciones de seguridad, contingencias o acuerdos tomados..."
              />
            </div>

            <div className="border-t border-slate-200 pt-3">
              <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={observations.showSignatures}
                  onChange={(e) => onUpdateObservations({ showSignatures: e.target.checked })}
                  className="rounded text-sky-600"
                />
                <span>Incluir cuadro formal de 3 firmas</span>
              </label>

              {observations.showSignatures && (
                <div className="space-y-2.5 pl-2 border-l-2 border-slate-200">
                  <div>
                    <span className="block text-[11px] font-bold text-slate-700">
                      1. Fiscalización de Obra
                    </span>
                    <input
                      type="text"
                      placeholder="Nombre del fiscal"
                      value={observations.supervisorSignName}
                      onChange={(e) =>
                        onUpdateObservations({ supervisorSignName: e.target.value })
                      }
                      className="w-full border border-slate-300 rounded px-2 py-1 text-xs mt-0.5"
                    />
                  </div>

                  <div>
                    <span className="block text-[11px] font-bold text-slate-700">
                      2. Dirección / Superintendencia
                    </span>
                    <input
                      type="text"
                      placeholder="Nombre del superintendente"
                      value={observations.directorSignName}
                      onChange={(e) =>
                        onUpdateObservations({ directorSignName: e.target.value })
                      }
                      className="w-full border border-slate-300 rounded px-2 py-1 text-xs mt-0.5"
                    />
                  </div>

                  <div>
                    <span className="block text-[11px] font-bold text-slate-700">
                      3. Representante Técnico Contratista
                    </span>
                    <input
                      type="text"
                      placeholder="Nombre del contratista"
                      value={observations.contractorSignName}
                      onChange={(e) =>
                        onUpdateObservations({ contractorSignName: e.target.value })
                      }
                      className="w-full border border-slate-300 rounded px-2 py-1 text-xs mt-0.5"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CSV Paste Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-4 space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">
              Pegar datos CSV de Rubros y Avance
            </h3>
            <p className="text-xs text-slate-500">
              Pega filas copiadas de Excel o un archivo CSV con columnas como: Item, Descripción, Etapa,
              Porcentaje. <strong>Nota:</strong> Los rubros con avance 0% se ignoran automáticamente.
            </p>
            <textarea
              rows={8}
              value={csvRawText}
              onChange={(e) => setCsvRawText(e.target.value)}
              placeholder="Item;Descripcion;Etapa;Porcentaje
1.0;Obras preliminares;Etapa;100%
1.1;Vallado;Rubro;100%
2.0;Estructura de hormigón;Etapa;45%..."
              className="w-full border border-slate-300 rounded p-2 text-xs font-mono"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCsvModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                onClick={handleCsvImport}
                className="px-3 py-1.5 text-xs font-bold text-white bg-[#0b455b] hover:bg-[#16556e] rounded-md"
              >
                Procesar e Importar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Width Slider & Status Footer */}
      {onSidebarWidthChange && (
        <div className="p-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-[11px] text-slate-600 shrink-0 select-none">
          <span className="font-semibold text-slate-700">Ancho del editor:</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="320"
              max="540"
              step="10"
              value={sidebarWidth}
              onChange={(e) => onSidebarWidthChange(parseInt(e.target.value))}
              className="w-24 accent-[#0b455b] cursor-pointer h-1.5 bg-slate-300 rounded-lg appearance-none"
              title="Deslizador para ajustar el ancho de la columna de edición"
            />
            <span className="font-mono text-slate-700 font-bold w-11 text-right">{sidebarWidth}px</span>
          </div>
        </div>
      )}
    </aside>
  );
};
