import React from 'react';
import { ProjectData } from '../../types';

interface ContractMetricsBlockProps {
  data: ProjectData;
}

export const ContractMetricsBlock: React.FC<ContractMetricsBlockProps> = ({ data }) => {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const renderMetricRing = (label: string, value: number, strokeColor = '#659d43') => {
    const val = Math.max(0, Math.min(100, Number(value) || 0));
    const radius = 38;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - val / 100);

    return (
      <div className="flex flex-col items-center justify-start text-center">
        <div className="text-[7pt] font-bold text-slate-600 h-[6.5mm] flex items-center justify-center uppercase leading-tight px-1">
          {label}
        </div>
        <div className="relative w-[21mm] h-[21mm] my-1">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {/* Background Track */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="15"
            />
            {/* Value Track */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={strokeColor}
              strokeWidth="15"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="butt"
            />
            {/* Small start marker accent */}
            {val > 0 && (
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="#a9c994"
                strokeWidth="15"
                strokeDasharray={`${circumference * 0.04} ${circumference * 0.96}`}
                strokeDashoffset={0}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-[9.5pt] font-black text-slate-800 tabular-nums">
            {val.toLocaleString('es-PY', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%
          </div>
        </div>
      </div>
    );
  };

  const overallVal = Math.max(0, Math.min(100, Number(data.physicalProgress) || 0));

  return (
    <section className="px-5 pt-3 pb-2 select-none shrink-0 border-b border-slate-200">
      <div className="grid grid-cols-[1.3fr_1.7fr] gap-4 items-start">
        {/* Left column: Contract & Financial metadata */}
        <div className="text-[8.5pt] text-slate-700 space-y-1 leading-snug">
          <div>
            <span className="font-bold text-[#1f4e66]">Contrato: </span>
            <span className="font-medium text-slate-800">{data.contract || '—'}</span>
          </div>
          <div>
            <span className="font-bold text-[#1f4e66]">Contratista: </span>
            <span className="font-medium text-slate-800">{data.contractor || '—'}</span>
          </div>
          <div>
            <span className="font-bold text-[#1f4e66]">Valor del contrato + Aditivos: </span>
            <span className="font-semibold text-slate-900 tabular-nums">
              PYG {data.contractValue || '—'}
            </span>
          </div>
          <div>
            <span className="font-bold text-[#1f4e66]">Fecha de O.I.S.: </span>
            <span className="font-medium text-slate-800">{formatDate(data.startDate)}</span>
          </div>
          <div className="pt-1 border-t border-slate-200/80">
            <span className="font-bold text-[#0b455b] uppercase text-[8pt] tracking-wide block">
              Medición Acumulada
            </span>
            <span className="font-bold text-slate-900 text-[9pt] tabular-nums">
              PYG {data.measurement || '—'}
            </span>
          </div>
        </div>

        {/* Right column: Progress Indicators */}
        <div className="grid grid-cols-4 gap-1.5 items-start bg-slate-50/70 p-2 rounded-lg border border-slate-200">
          {renderMetricRing('Avance Plazo', data.timeProgress, '#1f6487')}
          {renderMetricRing('Avance Financiero', data.financialProgress, '#c99326')}
          {renderMetricRing('Avance Físico', data.physicalProgress, '#659d43')}

          {/* Overall Project Progress Ring / Badge */}
          <div className="flex flex-col items-center justify-start text-center">
            <div className="text-[7pt] font-bold text-slate-700 h-[6.5mm] flex items-center justify-center uppercase leading-tight px-1">
              Avance General
            </div>
            <div className="w-[23mm] h-[23mm] my-0.5 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-emerald-600/30 flex flex-col items-center justify-center shadow-xs">
              <span className="text-[13pt] font-black text-[#2e5d1e] tracking-tight tabular-nums leading-none">
                {overallVal.toLocaleString('es-PY', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%
              </span>
              <span className="text-[5.5pt] font-bold text-slate-500 uppercase mt-0.5">
                Total Acum.
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
