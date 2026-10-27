import React from 'react';
import { ObservationsData } from '../../types';

interface ObservationsBlockProps {
  data: ObservationsData;
}

export const ObservationsBlock: React.FC<ObservationsBlockProps> = ({ data }) => {
  return (
    <section className="px-5 py-2 shrink-0 select-none">
      {/* Section Title */}
      <div className="w-full text-center font-bold text-[9pt] text-[#174b60] tracking-wider uppercase py-1 px-4 bg-gradient-to-r from-slate-100 via-sky-50 to-slate-100 border border-[#b8cbd4] rounded-lg mb-2 shadow-2xs">
        OBSERVACIONES Y FIRMAS DE RESPONSABLES
      </div>

      {/* Observations Box */}
      {data.notes && (
        <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/70 mb-3 text-[8pt] text-slate-700 leading-relaxed shadow-2xs">
          <span className="font-bold text-[#1f4e66] block mb-0.5">Notas Generales:</span>
          <p className="whitespace-pre-line">{data.notes}</p>
        </div>
      )}

      {/* Signatures */}
      {data.showSignatures && (
        <div className="grid grid-cols-3 gap-4 pt-4 mt-2">
          {/* Sign 1: Fiscalización */}
          <div className="text-center flex flex-col items-center">
            <div className="w-[85%] border-b border-slate-400 h-10 mb-1.5" />
            <div className="text-[7.5pt] font-bold text-slate-900 leading-tight">
              {data.supervisorSignName || 'Ing. Fiscalizador'}
            </div>
            <div className="text-[6.5pt] font-medium text-slate-500 uppercase tracking-wide">
              {data.supervisorSignTitle || 'Fiscalización de Obra SO.DT'}
            </div>
          </div>

          {/* Sign 2: Dirección / Superintendencia */}
          <div className="text-center flex flex-col items-center">
            <div className="w-[85%] border-b border-slate-400 h-10 mb-1.5" />
            <div className="text-[7.5pt] font-bold text-slate-900 leading-tight">
              {data.directorSignName || 'Director de Obra'}
            </div>
            <div className="text-[6.5pt] font-medium text-slate-500 uppercase tracking-wide">
              {data.directorSignTitle || 'Superintendencia de Obras'}
            </div>
          </div>

          {/* Sign 3: Contratista */}
          <div className="text-center flex flex-col items-center">
            <div className="w-[85%] border-b border-slate-400 h-10 mb-1.5" />
            <div className="text-[7.5pt] font-bold text-slate-900 leading-tight">
              {data.contractorSignName || 'Representante Técnico'}
            </div>
            <div className="text-[6.5pt] font-medium text-slate-500 uppercase tracking-wide">
              {data.contractorSignTitle || 'Consorcio Contratista'}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
