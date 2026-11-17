import React from 'react';
import { paperShort, getPageSetup } from '../utils/pageSetup';
import {
  Printer,
  FileCode,
  FolderOpen,
  Save,
  PanelLeftClose,
  PanelLeftOpen,
  Bookmark,
  Palette,
  ZoomIn,
  ZoomOut,
  Sparkles,
} from 'lucide-react';

interface HeaderBarProps {
  totalPages: number;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  onPrint: () => void;
  onExportHtml: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
  onLoadExample: () => void;
  onOpenTemplates?: () => void;
  onOpenTheme?: () => void;
  isThemeOpen?: boolean;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  totalPages,
  zoom,
  onZoomChange,
  onPrint,
  onExportHtml,
  onExportJson,
  onImportJson,
  onLoadExample,
  onOpenTemplates,
  onOpenTheme,
  isThemeOpen,
  isSidebarOpen,
  onToggleSidebar,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportJson(file);
      e.target.value = '';
    }
  };

  return (
    <header className="bg-[#0b455b] text-white px-3 sm:px-4 py-2.5 flex items-center justify-between border-b border-[#083445] shadow-md select-none shrink-0 no-print z-50 gap-2">
      {/* Brand & Document Name */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              isSidebarOpen
                ? 'bg-[#f4c84a] text-[#0b455b] hover:bg-[#fed35b] shadow-sm'
                : 'bg-white/15 hover:bg-white/25 text-white ring-1 ring-white/20'
            }`}
            title={isSidebarOpen ? 'Ocultar panel de edición' : 'Mostrar panel de edición'}
            aria-label={isSidebarOpen ? 'Ocultar panel de edición' : 'Mostrar panel de edición'}
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="w-4 h-4 shrink-0" />
            ) : (
              <PanelLeftOpen className="w-4 h-4 shrink-0" />
            )}
            <span className="hidden sm:inline">
              {isSidebarOpen ? 'Ocultar Editor' : 'Editar'}
            </span>
          </button>
        )}

        {/* Ícono del programa: dos hojas con un gráfico (igual que public/favicon.svg) */}
        <svg viewBox="0 0 32 32" className="w-8 h-8 shrink-0 drop-shadow-sm" aria-hidden="true">
          <rect width="32" height="32" rx="7" fill="#f4c84a" />
          <rect x="7.5" y="5.5" width="14" height="18" rx="1.6" fill="#0b455b" opacity=".35" />
          <rect x="10.5" y="8.5" width="14" height="18" rx="1.6" fill="#fff" stroke="#0b455b" strokeWidth="1.4" />
          <rect x="13.2" y="19" width="2.4" height="4.6" rx=".5" fill="#0b455b" />
          <rect x="16.6" y="16.2" width="2.4" height="7.4" rx=".5" fill="#0b455b" />
          <rect x="20" y="12.6" width="2.4" height="11" rx=".5" fill="#2b7a94" />
        </svg>
        <div className="min-w-0 truncate">
          <h1 className="text-xs sm:text-sm font-bold text-white tracking-wide leading-tight truncate">
            Generador de Reportes
          </h1>
          <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-slate-300 truncate">
            <span>Hoja {paperShort() || 'personalizada'}{getPageSetup().orientation === 'landscape' ? ' horizontal' : ''}</span>
            <span>·</span>
            <span className="font-semibold text-[#f4c84a]">
              {totalPages} {totalPages === 1 ? 'Hoja' : 'Hojas'}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* Templates Button */}
        {onOpenTemplates && (
          <button
            type="button"
            onClick={onOpenTemplates}
            className="px-2.5 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ring-1 ring-white/20 shadow-2xs"
            title="Gestor de Plantillas (Guardar y Cargar)"
          >
            <Bookmark className="w-3.5 h-3.5 text-[#f4c84a]" />
            <span className="hidden sm:inline">Plantillas</span>
          </button>
        )}

        {/* Con el editor oculto, la escala de hojas pasa a la barra superior */}
        {!isSidebarOpen && (
          <div className="hidden md:flex items-center gap-1 px-2 py-1 bg-white/10 rounded-md ring-1 ring-white/15 text-white text-xs">
            <button type="button" onClick={() => onZoomChange(Math.max(0.25, Number((zoom - 0.05).toFixed(2))))} title="Reducir" className="p-0.5 rounded hover:bg-white/15 cursor-pointer"><ZoomOut className="w-3.5 h-3.5" /></button>
            <input type="range" min="25" max="250" step="5" value={Math.round(zoom * 100)} onChange={(e) => onZoomChange(parseInt(e.target.value) / 100)}
              className="w-20 accent-[#f4c84a] cursor-pointer" title="Escala de las hojas · también con la rueda del mouse" />
            <button type="button" onClick={() => onZoomChange(Math.min(2.5, Number((zoom + 0.05).toFixed(2))))} title="Aumentar" className="p-0.5 rounded hover:bg-white/15 cursor-pointer"><ZoomIn className="w-3.5 h-3.5" /></button>
            <span className="font-mono font-bold text-[#f4c84a] w-9 text-right">{Math.round(zoom * 100)}%</span>
          </div>
        )}

        {onOpenTheme && (
          <button
            type="button"
            onClick={onOpenTheme}
            className={`px-2.5 py-1.5 ${isThemeOpen ? 'bg-white/30' : 'bg-white/15 hover:bg-white/25'} text-white rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ring-1 ring-white/20 shadow-2xs`}
            title="Tema del informe: colores, fuentes y forma"
          >
            <Palette className="w-3.5 h-3.5 text-[#f4c84a]" />
            <span className="hidden sm:inline">Tema</span>
          </button>
        )}

        <button
          onClick={onLoadExample}
          className="hidden md:inline-flex px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md text-xs font-medium transition-colors cursor-pointer"
        >
          Ejemplo
        </button>

        {/* JSON Import/Export */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Cargar proyecto (.json)"
          className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md text-xs transition-colors"
        >
          <FolderOpen className="w-4 h-4" />
        </button>
        <button
          onClick={onExportJson}
          title="Guardar archivo de proyecto (.json)"
          className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md text-xs transition-colors"
        >
          <Save className="w-4 h-4" />
        </button>

        <button
          onClick={onExportHtml}
          title="Descargar documento HTML autónomo"
          className="hidden sm:flex px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md text-xs font-medium items-center gap-1 transition-colors"
        >
          <FileCode className="w-3.5 h-3.5 text-slate-300" />
          <span className="hidden lg:inline">HTML</span>
        </button>

        {/* Primary Action: Print / PDF */}
        <button
          onClick={onPrint}
          className="px-2.5 sm:px-3.5 py-1.5 bg-[#f4c84a] hover:bg-[#fed35b] text-[#0b455b] font-bold rounded-md text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
        >
          <Printer className="w-4 h-4 text-[#0b455b]" />
          <span className="hidden sm:inline">Imprimir / PDF</span>
          <span className="sm:hidden">PDF</span>
        </button>
      </div>
    </header>
  );
};
