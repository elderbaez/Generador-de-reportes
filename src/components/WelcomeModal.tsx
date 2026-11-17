import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, FolderOpen, Bookmark, FilePlus2 } from 'lucide-react';
import { shouldShowWelcome, getBuiltInTemplates, getSavedTemplates, setLastTemplateId, ReportTemplate, ReportTemplateData } from '../utils/templateManager';
import { TemplateThumb } from './TemplateThumb';

const HIDE_KEY = 'a4_report_welcome_hidden_v1';

interface Props {
  onSelectTemplate: (data: ReportTemplateData) => void;
  onImportJson: (file: File) => void;
  onOpenTemplates: () => void;
  onClose: () => void;
}

const BLANK_ID = 'builtin-blank';

export const WelcomeModal: React.FC<Props> = ({ onSelectTemplate, onImportJson, onOpenTemplates, onClose }) => {
  const [category, setCategory] = useState<string>('Todas');
  const [hide, setHide] = useState(!shouldShowWelcome());
  const fileRef = useRef<HTMLInputElement>(null);

  const templates = useMemo<ReportTemplate[]>(() => {
    const all = [...getBuiltInTemplates(), ...getSavedTemplates()];
    // "En blanco" primero: es el punto de partida más común
    return [...all.filter((t) => t.id === BLANK_ID), ...all.filter((t) => t.id !== BLANK_ID)];
  }, []);
  const categories = useMemo(() => ['Todas', ...Array.from(new Set(templates.map((t) => t.category || 'General')))], [templates]);
  const shown = category === 'Todas' ? templates : templates.filter((t) => (t.category || 'General') === category);

  const close = () => {
    try { localStorage.setItem(HIDE_KEY, hide ? '1' : '0'); } catch { /* sin almacenamiento */ }
    onClose();
  };
  const pick = (t: ReportTemplate) => {
    onSelectTemplate(t.data);
    setLastTemplateId(t.id);
    close();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hide]);

  return (
    <div className="no-print fixed inset-0 z-[1300] flex items-center justify-center p-3 sm:p-6 bg-slate-900/55 backdrop-blur-[2px]" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div role="dialog" aria-modal="true" aria-label="Bienvenida" className="bg-white w-full max-w-[1020px] max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="bg-[#0b455b] text-white px-5 py-4 flex items-start gap-3">
          <div className="flex-1">
            <h2 className="text-lg font-extrabold leading-tight">¿Qué informe quieres armar hoy?</h2>
            <p className="text-[12.5px] text-slate-200 mt-1">Elige un punto de partida. Todo se puede cambiar después: bloques, fotos, tablas, tema y tamaño de hoja.</p>
          </div>
          <button type="button" onClick={close} aria-label="Cerrar" className="text-slate-300 hover:text-white p-1 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-5 pt-3 pb-2 flex flex-wrap items-center gap-1.5 border-b border-slate-200">
          {categories.map((c) => (
            <button key={c} type="button" onClick={() => setCategory(c)}
              className={`text-[11.5px] font-semibold px-3 py-1 rounded-full border cursor-pointer transition-colors ${category === c ? 'bg-[#0b455b] text-white border-[#0b455b]' : 'bg-white text-slate-600 border-slate-300 hover:border-[#0b455b]'}`}>
              {c}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto px-5 py-4 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(210px,1fr))] bg-slate-50">
          {shown.map((t) => (
            <button key={t.id} type="button" onClick={() => pick(t)}
              className="group text-left bg-white rounded-xl border border-slate-200 hover:border-[#0b455b] hover:shadow-lg transition-all p-3 flex flex-col gap-2.5 cursor-pointer">
              <div className="bg-slate-100 rounded-lg py-3 flex justify-center items-center" style={{ minHeight: 230 }}>
                {t.id === BLANK_ID
                  ? <div className="bg-white shadow-md ring-1 ring-slate-300/70 flex items-center justify-center text-slate-400" style={{ width: 150, aspectRatio: '210 / 297' }}><FilePlus2 className="w-8 h-8" /></div>
                  : <TemplateThumb blocks={t.data.blocks} photoColumns={t.data.photoColumns} theme={t.data.theme} pageSetup={t.data.pageSetup} />}
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#0b455b]/70">{t.category || 'General'}{!t.isBuiltIn ? ' · mía' : ''}</span>
                <div className="text-[13.5px] font-bold text-slate-800 leading-snug group-hover:text-[#0b455b]">{t.name}</div>
                <p className="text-[11.5px] text-slate-500 leading-snug mt-0.5 line-clamp-3">{t.description}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 flex flex-wrap items-center gap-x-4 gap-y-2 bg-white">
          <button type="button" onClick={() => fileRef.current?.click()} className="text-[12px] font-semibold text-[#0b455b] hover:underline flex items-center gap-1.5 cursor-pointer">
            <FolderOpen className="w-4 h-4" /> Abrir un informe guardado (.json)
          </button>
          <button type="button" onClick={() => { close(); onOpenTemplates(); }} className="text-[12px] font-semibold text-[#0b455b] hover:underline flex items-center gap-1.5 cursor-pointer">
            <Bookmark className="w-4 h-4" /> Administrar plantillas
          </button>
          <label className="ml-auto flex items-center gap-2 text-[11.5px] text-slate-500 cursor-pointer select-none">
            <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} /> No mostrar al iniciar
          </label>
          <button type="button" onClick={close} className="text-[12px] font-semibold text-slate-600 border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50 cursor-pointer">
            Seguir con el informe actual
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { onImportJson(f); close(); } e.target.value = ''; }} />
      </div>
    </div>
  );
};
