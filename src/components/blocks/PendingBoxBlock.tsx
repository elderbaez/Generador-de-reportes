import React from 'react';
import { PendingItem, ImpactLevel } from '../../types';

interface PendingBoxBlockProps {
  pendings: PendingItem[];
}

export const PendingBoxBlock: React.FC<PendingBoxBlockProps> = ({ pendings }) => {
  const getImpactBadge = (impact: ImpactLevel) => {
    switch (impact) {
      case 'CRÍTICO':
        return 'bg-rose-900 text-white border-rose-950';
      case 'ALTO':
        return 'bg-red-600 text-white border-red-700';
      case 'MEDIO':
        return 'bg-amber-400 text-slate-900 border-amber-500 font-bold';
      case 'BAJO':
        return 'bg-emerald-600 text-white border-emerald-700';
      default:
        return 'bg-slate-200 text-slate-700 border-slate-300';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Resuelto':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Vencido':
        return 'bg-rose-50 text-rose-800 border-rose-200 font-semibold';
      case 'En ejecución':
        return 'bg-sky-50 text-sky-800 border-sky-200';
      case 'Aguardando respuesta':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <section className="px-5 py-2 shrink-0 select-none">
      {/* Section Title */}
      <div className="w-full text-center font-bold text-[9pt] text-[#174b60] tracking-wider uppercase py-1 px-4 bg-gradient-to-r from-slate-100 via-sky-50 to-slate-100 border border-[#b8cbd4] rounded-lg mb-2 shadow-2xs">
        PENDENCIAS Y SITUACIONES RELEVANTES
      </div>

      {/* Cuadro integrado con esquinas redondeadas (Solid rounded box table container) */}
      <div className="rounded-xl border border-slate-300 bg-white overflow-hidden shadow-xs">
        <table className="w-full border-collapse text-[7.5pt] table-fixed">
          <thead>
            <tr className="bg-[#e9edf4] text-[#1f3a52] font-bold border-b border-slate-300 uppercase text-[7pt] tracking-wider">
              <th className="py-2 px-2 text-center w-[6%] border-r border-slate-300">N.º</th>
              <th className="py-2 px-3 text-left w-[42%] border-r border-slate-300">
                Descripción de la Situación / Pendencia
              </th>
              <th className="py-2 px-2.5 text-left w-[17%] border-r border-slate-300">
                Responsable
              </th>
              <th className="py-2 px-2 text-center w-[11%] border-r border-slate-300">Plazo</th>
              <th className="py-2 px-2 text-center w-[11%] border-r border-slate-300">Impacto</th>
              <th className="py-2 px-2 text-center w-[13%]">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {pendings.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-5 text-center text-slate-400 italic text-[8pt] bg-slate-50/50"
                >
                  No hay pendencias ni situaciones críticas registradas en esta semana.
                </td>
              </tr>
            ) : (
              pendings.map((p, idx) => (
                <tr
                  key={p.id || idx}
                  className={`transition-colors hover:bg-slate-50/80 ${
                    idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                  }`}
                >
                  <td className="py-2 px-2 text-center font-bold text-slate-700 border-r border-slate-200">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-3 text-slate-800 leading-snug border-r border-slate-200">
                    {p.description || '—'}
                  </td>
                  <td className="py-2 px-2.5 text-slate-700 font-medium truncate border-r border-slate-200">
                    {p.responsible || '—'}
                  </td>
                  <td className="py-2 px-2 text-center font-mono text-[7pt] text-slate-600 border-r border-slate-200">
                    {p.deadline || '—'}
                  </td>
                  <td className="py-2 px-2 text-center border-r border-slate-200">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[6.5pt] font-black tracking-wide border shadow-2xs ${getImpactBadge(
                        p.impact
                      )}`}
                    >
                      {p.impact}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[6.5pt] border ${getStatusBadge(
                        p.status
                      )}`}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
