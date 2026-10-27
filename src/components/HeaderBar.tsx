import React from 'react';
import {
  Printer,
  Download,
  FileCode,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FolderOpen,
  Save,
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
  onAutoDistribute: () => void;
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
  onAutoDistribute,
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
    <header className="bg-[#0b455b] text-white px-4 py-2.5 flex items-center justify-between border-b border-[#083445] shadow-md select-none shrink-0 no-print z-50">
      {/* Brand & Document Name */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#f4c84a] flex items-center justify-center text-[#0b455b] font-black text-base shadow-sm">
          A4
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-wide leading-tight">
            Generador de Reportes Semanales de Obra
          </h1>
          <div className="flex items-center gap-2 text-[11px] text-slate-300">
            <span>Plantilla Oficial A4</span>
            <span>·</span>
            <span className="font-semibold text-[#f4c84a]">
              {totalPages} {totalPages === 1 ? 'Hoja' : 'Hojas'} generadas
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={onAutoDistribute}
          title="Distribuir bloques inteligentemente para que calcen en hojas A4"
          className="px-2.5 py-1.5 bg-[#1f6487] hover:bg-[#2778a2] text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors border border-sky-400/30"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#f4c84a]" />
          <span className="hidden sm:inline">Auto-Distribuir A4</span>
        </button>

        <button
          onClick={onLoadExample}
          className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md text-xs font-medium transition-colors"
        >
          Cargar Ejemplo
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
          className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md text-xs font-medium flex items-center gap-1 transition-colors"
        >
          <FileCode className="w-3.5 h-3.5 text-slate-300" />
          <span className="hidden md:inline">Exportar HTML</span>
        </button>

        {/* Primary Action: Print / PDF */}
        <button
          onClick={onPrint}
          className="px-3.5 py-1.5 bg-[#f4c84a] hover:bg-[#fed35b] text-[#0b455b] font-bold rounded-md text-xs flex items-center gap-1.5 shadow-sm transition-colors"
        >
          <Printer className="w-4 h-4 text-[#0b455b]" />
          <span>Imprimir / PDF</span>
        </button>
      </div>
    </header>
  );
};
