import React from 'react';
import { RubricItem } from '../../types';

interface SituationBlockProps {
  rubrics: RubricItem[];
}

export const SituationBlock: React.FC<SituationBlockProps> = ({ rubrics }) => {
  const chartWidth = 480;
  const barChartHeight = Math.max(160, rubrics.length * 30 + 34);
  const leftMargin = 190;
  const rightMargin = 15;
  const topMargin = 12;
  const plotWidth = chartWidth - leftMargin - rightMargin;
  const rowHeight = rubrics.length > 0 ? (barChartHeight - 26) / rubrics.length : 30;

  return (
    <section className="px-5 py-2 shrink-0 select-none">
      {/* Section Title Banner */}
      <div className="w-full text-center font-bold text-[9pt] text-[#174b60] tracking-wider uppercase py-1 px-4 bg-gradient-to-r from-slate-100 via-sky-50 to-slate-100 border border-[#b8cbd4] rounded-lg mb-2 shadow-2xs">
        SITUACIÓN ACTUAL DE LA OBRA
      </div>

      <div className="grid grid-cols-[1.05fr_0.95fr] gap-4 items-start">
        {/* Left: Rubric Table */}
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
          <table className="w-full border-collapse text-[7.5pt] table-fixed">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
              <tr>
                <th className="py-1.5 px-2 text-left w-[72%] tracking-wide">
                  RUBROS / ACTIVIDADES
                </th>
                <th className="py-1.5 px-2 text-right w-[28%] tracking-wide">
                  AVANCE (%)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rubrics.length === 0 ? (
                <tr>
                  <td colSpan={2} className="py-4 text-center text-slate-400 italic text-[8pt]">
                    No se han registrado rubros. Importa un CSV o agrégalos en el panel lateral.
                  </td>
                </tr>
              ) : (
                rubrics.map((r, idx) => (
                  <tr
                    key={r.id || idx}
                    className={`transition-colors ${
                      r.group
                        ? 'bg-slate-50 font-bold text-slate-900 border-t border-slate-200'
                        : 'text-slate-700 hover:bg-slate-50/50'
                    }`}
                  >
                    <td
                      className={`py-1 px-2 truncate leading-snug ${
                        r.group ? 'font-bold text-slate-900' : 'pl-5 text-slate-600'
                      }`}
                      title={`${r.item ? r.item + ' ' : ''}${r.description}`}
                    >
                      {r.item ? (
                        <span className="font-mono text-slate-500 mr-1.5 text-[7pt]">
                          {r.item}
                        </span>
                      ) : null}
                      <span>{r.description}</span>
                    </td>
                    <td className="py-1 px-2 text-right font-semibold tabular-nums text-slate-900">
                      {Number(r.percent || 0).toLocaleString('es-PY', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 2,
                      })}
                      %
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Right: Synchronized SVG Bar Chart */}
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white p-2 shadow-2xs flex flex-col justify-center">
          <div className="text-[7pt] font-bold text-slate-500 uppercase tracking-wider mb-1 text-center border-b border-slate-100 pb-1">
            Gráfico de Avance Físico por Rubro (%)
          </div>
          <svg
            viewBox={`0 0 ${chartWidth} ${barChartHeight}`}
            className="w-full h-auto block"
            role="img"
            aria-label="Gráfico de avance"
          >
            {/* Background gridlines for 0%, 20%, 40%, 60%, 80%, 100% */}
            {[0, 20, 40, 60, 80, 100].map((t) => {
              const x = leftMargin + (plotWidth * t) / 100;
              return (
                <g key={`grid-${t}`}>
                  <line
                    x1={x}
                    y1={topMargin}
                    x2={x}
                    y2={barChartHeight - 16}
                    stroke="#e2e8f0"
                    strokeWidth="1"
                    strokeDasharray={t === 0 || t === 100 ? undefined : '2 2'}
                  />
                  <text
                    x={x}
                    y={barChartHeight - 4}
                    fill="#64748b"
                    fontSize="8.5"
                    fontWeight="600"
                    textAnchor="middle"
                  >
                    {t}%
                  </text>
                </g>
              );
            })}

            {/* Horizontal bars */}
            {rubrics.map((r, i) => {
              const y = topMargin + i * rowHeight + rowHeight * 0.18;
              const barH = Math.min(18, Math.max(10, rowHeight * 0.64));
              const val = Math.max(0, Math.min(100, Number(r.percent) || 0));
              const barWidth = Math.max(val > 0 ? 3 : 0, (plotWidth * val) / 100);

              let label = (r.item ? `${r.item} ` : '') + r.description;
              if (label.length > 27) {
                label = label.slice(0, 25) + '…';
              }

              const barColor = r.group ? '#0b455b' : '#1f6487';

              return (
                <g key={`bar-${r.id || i}`}>
                  <text
                    x={leftMargin - 6}
                    y={y + barH * 0.74}
                    fontSize="8.5"
                    fontWeight={r.group ? '700' : '500'}
                    fill={r.group ? '#0f172a' : '#475569'}
                    textAnchor="end"
                  >
                    {label}
                  </text>
                  {/* Empty track */}
                  <rect
                    x={leftMargin}
                    y={y}
                    width={plotWidth}
                    height={barH}
                    rx="2"
                    fill="#f1f5f9"
                  />
                  {/* Filled bar */}
                  {val > 0 && (
                    <rect
                      x={leftMargin}
                      y={y}
                      width={barWidth}
                      height={barH}
                      rx="2"
                      fill={barColor}
                    />
                  )}
                  {/* Percentage label */}
                  <text
                    x={
                      val > 15
                        ? leftMargin + barWidth - 4
                        : leftMargin + barWidth + 4
                    }
                    y={y + barH * 0.72}
                    fill={val > 15 ? '#ffffff' : '#1e293b'}
                    fontSize="8"
                    fontWeight="700"
                    textAnchor={val > 15 ? 'end' : 'start'}
                  >
                    {val.toLocaleString('es-PY', {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                    %
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </section>
  );
};
