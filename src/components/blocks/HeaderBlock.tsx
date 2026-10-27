import React from 'react';
import { ProjectData } from '../../types';

interface HeaderBlockProps {
  data: ProjectData;
  isCompact?: boolean;
}

export const HeaderBlock: React.FC<HeaderBlockProps> = ({ data }) => {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <header className="bg-[#0b455b] text-white px-5 py-2.5 flex items-center justify-between gap-4 select-none shrink-0 print:py-2">
      {/* Institutional Logo */}
      <div className="w-[28mm] flex justify-center items-center shrink-0">
        {data.logoUrl ? (
          <img
            src={data.logoUrl}
            alt="Logo Institucional"
            className={`max-h-[19mm] max-w-[28mm] object-contain ${
              data.invertLogoColor ? 'brightness-0 invert' : ''
            }`}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-[24mm] h-[16mm] border border-white/30 rounded flex items-center justify-center text-[8pt] text-white/70">
            SO.DT
          </div>
        )}
      </div>

      {/* Main Titles */}
      <div className="flex-1 text-center min-w-0 px-2">
        <div className="text-[8pt] font-semibold text-slate-200 uppercase tracking-wide leading-tight line-clamp-1">
          {data.director || 'DIRECCIÓN TÉCNICA - SUPERINTENDENCIA DE OBRAS - SO.DT'}
        </div>
        <h1 className="text-[11.5pt] font-bold text-white leading-tight my-0.5 line-clamp-2">
          {data.project || 'NOMBRE DE LA OBRA'}
        </h1>
        <div className="text-[10.5pt] font-black text-[#f4c84a] tracking-[1.5px] uppercase leading-tight">
          REPORTE SEMANAL DE OBRAS
        </div>
        <div className="text-[8.5pt] font-bold text-slate-100 mt-0.5 leading-tight">
          Fecha de toma de datos: al {formatDate(data.reportDate)}
        </div>
      </div>

      {/* Right Balance Box (Emblem or Badge) */}
      <div className="w-[28mm] flex flex-col items-center justify-center shrink-0 text-right">
        <div className="border border-white/25 rounded px-2 py-1 bg-white/10 text-center">
          <span className="block text-[6.5pt] font-semibold text-slate-200 uppercase">Documento</span>
          <span className="block text-[8pt] font-bold text-[#f4c84a] tracking-wider">SO-INF</span>
        </div>
      </div>
    </header>
  );
};
