import React, { useState, useEffect } from 'react';
import {
  X,
  Bookmark,
  Plus,
  Trash2,
  Download,
  Upload,
  Check,
  Folder,
  Sparkles,
  Layout,
  FileText,
  Clock,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import {
  ReportTemplate,
  ReportTemplateData,
  getBuiltInTemplates,
  getSavedTemplates,
  saveTemplate,
  deleteTemplate,
  exportTemplateToJsonFile,
  getLastTemplateId,
  setLastTemplateId,
  clearLastTemplateId,
} from '../utils/templateManager';

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentData: ReportTemplateData;
  onSelectTemplate: (data: ReportTemplateData) => void;
}

export const TemplateModal: React.FC<TemplateModalProps> = ({
  isOpen,
  onClose,
  currentData,
  onSelectTemplate,
}) => {
  const [activeTab, setActiveTab] = useState<'select' | 'save'>('select');
  const [userTemplates, setUserTemplates] = useState<ReportTemplate[]>([]);
  const builtInTemplates = getBuiltInTemplates();

  // Save form states
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateCategory, setNewTemplateCategory] = useState('Personalizadas');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  // Selected template for preview
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate>(
    builtInTemplates[0]
  );

  useEffect(() => {
    if (isOpen) {
      setUserTemplates(getSavedTemplates());
      setSaveSuccessMsg(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const lastId = getLastTemplateId();

  const handleSaveCurrentAsTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim()) return;

    const saved = saveTemplate(
      newTemplateName,
      newTemplateDesc || 'Plantilla guardada del usuario',
      newTemplateCategory || 'Personalizadas',
      currentData
    );

    setUserTemplates(getSavedTemplates());
    setSelectedTemplate(saved);
    // Guardar el informe como plantilla = es la que se está usando: se abre al iniciar
    setLastTemplateId(saved.id);
    setNewTemplateName('');
    setNewTemplateDesc('');
    setSaveSuccessMsg(true);

    setTimeout(() => {
      setSaveSuccessMsg(false);
      setActiveTab('select');
    }, 1200);
  };

  const handleDeleteTemplate = (id: string, _name?: string) => {
    deleteTemplate(id);
    if (getLastTemplateId() === id) clearLastTemplateId();
    const updated = getSavedTemplates();
    setUserTemplates(updated);
    if (selectedTemplate.id === id) {
      setSelectedTemplate(builtInTemplates[0]);
    }
  };

  const handleImportTemplateFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        // Check if it's a full template object or raw data
        if (parsed.data && parsed.name) {
          const imported = saveTemplate(
            parsed.name,
            parsed.description || 'Plantilla importada de archivo .json',
            parsed.category || 'Importadas',
            parsed.data
          );
          setUserTemplates(getSavedTemplates());
          setSelectedTemplate(imported);
          setSaveSuccessMsg(true);
          setTimeout(() => setSaveSuccessMsg(false), 2000);
        } else if (parsed.projectData && parsed.blocks) {
          const imported = saveTemplate(
            `Plantilla Importada (${new Date().toLocaleDateString()})`,
            'Importada desde archivo .json de reporte',
            'Importadas',
            {
              projectData: parsed.projectData,
              rubrics: parsed.rubrics || [],
              pendings: parsed.pendings || [],
              photos: parsed.photos || [],
              observations: parsed.observations || {},
              blocks: parsed.blocks || [],
              photoColumns: parsed.photoColumns,
              photoHeightMm: parsed.photoHeightMm,
            }
          );
          setUserTemplates(getSavedTemplates());
          setSelectedTemplate(imported);
          setSaveSuccessMsg(true);
          setTimeout(() => setSaveSuccessMsg(false), 2000);
        }
      } catch (err) {
        console.error('Error al importar plantilla:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const allTemplates = [...builtInTemplates, ...userTemplates];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-[#0b455b] text-white flex items-center justify-between shrink-0 border-b border-[#083445]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#f4c84a] flex items-center justify-center text-[#0b455b] font-bold shadow-xs">
              <Bookmark className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm tracking-wide text-white">
                Gestor de Plantillas de Reporte
              </h2>
              <p className="text-[11px] text-slate-300">
                Guarda, selecciona e importa configuraciones predefinidas en el navegador
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-2 gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('select')}
            className={`py-2 px-4 text-xs font-bold rounded-t-lg flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'select'
                ? 'border-[#0b455b] text-[#0b455b] bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Seleccionar Plantilla ({allTemplates.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('save')}
            className={`py-2 px-4 text-xs font-bold rounded-t-lg flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'save'
                ? 'border-[#0b455b] text-[#0b455b] bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Guardar Configuración Actual</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          {activeTab === 'select' ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 h-full">
              {/* Left Column: List of templates */}
              <div className="md:col-span-5 space-y-4">
                {/* Custom User Templates Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Bookmark className="w-3.5 h-3.5 text-[#0b455b]" />
                      <span>Mis Plantillas Guardadas ({userTemplates.length})</span>
                    </span>

                    <label className="text-[11px] font-bold text-[#0b455b] hover:text-[#125873] flex items-center gap-1 cursor-pointer">
                      <Upload className="w-3 h-3 text-[#f4c84a]" />
                      <span>Importar .json</span>
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={handleImportTemplateFile}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {userTemplates.length === 0 ? (
                    <div className="border border-dashed border-slate-300 rounded-lg p-3 text-center text-slate-400 text-[11px] bg-slate-50/50">
                      No has guardado plantillas personalizadas aún.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                      {userTemplates.map((tpl) => (
                        <div
                          key={tpl.id}
                          onClick={() => setSelectedTemplate(tpl)}
                          className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between ${
                            selectedTemplate.id === tpl.id
                              ? 'bg-sky-50 border-[#0b455b] ring-1 ring-[#0b455b]'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-slate-800 truncate">
                                {tpl.name}
                              </span>
                              {tpl.id === lastId && (
                                <span className="shrink-0 text-[9px] font-bold px-1.5 rounded bg-amber-100 text-amber-800 border border-amber-200" title="Es la última que usaste: se abre sola al iniciar">
                                  Se abre al iniciar
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 truncate">
                              {tpl.description}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTemplate(tpl.id, tpl.name);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            title="Eliminar plantilla"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Built-in System Templates Section */}
                <div>
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Plantillas del Sistema</span>
                  </span>

                  <div className="space-y-1.5">
                    {builtInTemplates.map((tpl) => (
                      <div
                        key={tpl.id}
                        onClick={() => setSelectedTemplate(tpl)}
                        className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                          selectedTemplate.id === tpl.id
                            ? 'bg-sky-50 border-[#0b455b] ring-1 ring-[#0b455b]'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                            {tpl.name}
                            {tpl.id === lastId && (
                              <span className="text-[9px] font-bold px-1.5 rounded bg-amber-100 text-amber-800 border border-amber-200" title="Es la última que usaste: se abre sola al iniciar">
                                Se abre al iniciar
                              </span>
                            )}
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded border border-slate-200">
                            {tpl.category}
                          </span>
                        </div>
                        <p className="text-[10.5px] text-slate-500 leading-snug line-clamp-2">
                          {tpl.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Selected Template Details Preview & Apply */}
              <div className="md:col-span-7 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between border-b border-slate-200 pb-3 mb-3">
                    <div>
                      <span className="text-[10px] font-bold text-[#0b455b] uppercase tracking-wider block mb-0.5">
                        {selectedTemplate.isBuiltIn ? 'Plantilla Predeterminada' : 'Plantilla Guardada'}
                      </span>
                      <h3 className="font-bold text-base text-slate-900 leading-tight">
                        {selectedTemplate.name}
                      </h3>
                      <p className="text-xs text-slate-600 mt-1">
                        {selectedTemplate.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => exportTemplateToJsonFile(selectedTemplate)}
                      className="p-1.5 text-slate-600 hover:text-[#0b455b] hover:bg-white rounded border border-slate-300 transition-colors shrink-0"
                      title="Descargar archivo de plantilla .json a la computadora"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Included Sections / Blocks */}
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="font-bold text-slate-700 block mb-1">
                        Estructura de Bloques ({selectedTemplate.data.blocks?.length || 0}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedTemplate.data.blocks?.map((b) => (
                          <span
                            key={b.id}
                            className="bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded text-[10.5px] font-medium shadow-2xs"
                          >
                            {b.title}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-slate-600 text-[11px]">
                      <div>
                        <span className="font-semibold text-slate-700 block">Rubros y Actividades:</span>
                        <span>{selectedTemplate.data.rubrics?.length || 0} ítems</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700 block">Fotografías iniciales:</span>
                        <span>{selectedTemplate.data.photos?.length || 0} imágenes</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700 block">Cuadro de Pendencias:</span>
                        <span>{selectedTemplate.data.pendings?.length || 0} situaciones</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700 block">Título del Reporte:</span>
                        <span className="truncate block font-mono text-[10px] font-bold text-[#0b455b]">
                          {selectedTemplate.data.projectData?.reportTitle || 'REPORTE'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Primary Apply Action Button */}
                <div className="pt-4 border-t border-slate-200 mt-4 flex items-center justify-between gap-3">
                  <span className="text-[10.5px] text-slate-500">
                    * Al aplicar esta plantilla se actualizará la vista del informe.
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectTemplate(selectedTemplate.data);
                      setLastTemplateId(selectedTemplate.id);
                      onClose();
                    }}
                    className="bg-[#0b455b] hover:bg-[#083445] text-white font-bold text-xs px-4 py-2 rounded-lg shadow-md flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#f4c84a]" />
                    <span>Cargar esta Plantilla</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: Save current report setup as template */
            <form onSubmit={handleSaveCurrentAsTemplate} className="max-w-xl mx-auto space-y-4 py-2">
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-xs text-sky-900 space-y-1">
                <span className="font-bold block text-sm">
                  Guardar informe actual como nueva plantilla
                </span>
                <p>
                  Guarda la configuración de bloques, datos de obra, rubros, pendencias y formato en el
                  almacenamiento local de tu navegador para reutilizarlos en futuros informes.
                </p>
              </div>

              {saveSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>¡Plantilla guardada correctamente en la memoria local!</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-xs text-slate-700 mb-1">
                  Nombre de la Plantilla *
                </label>
                <input
                  type="text"
                  required
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="Ej: Reporte Semanal Vial - Proyecto Municipal"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-[#0b455b] outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-xs text-slate-700 mb-1">
                  Categoría
                </label>
                <input
                  type="text"
                  value={newTemplateCategory}
                  onChange={(e) => setNewTemplateCategory(e.target.value)}
                  placeholder="Ej: Obras Civiles, Infraestructura, Mantenimiento"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-[#0b455b] outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-xs text-slate-700 mb-1">
                  Descripción Corta
                </label>
                <textarea
                  rows={2}
                  value={newTemplateDesc}
                  onChange={(e) => setNewTemplateDesc(e.target.value)}
                  placeholder="Breve explicación del propósito o estructura de la plantilla..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-[#0b455b] outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('select')}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#0b455b] hover:bg-[#083445] text-white text-xs font-bold px-5 py-2 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Bookmark className="w-4 h-4 text-[#f4c84a]" />
                  <span>Guardar Plantilla</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
