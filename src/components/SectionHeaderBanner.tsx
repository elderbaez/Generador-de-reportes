import React from 'react';
import { EyeOff } from 'lucide-react';

interface SectionHeaderBannerProps {
  numberIndex?: number | null;
  title: string;
  subtitle?: string;
  isEditing?: boolean;
  showTitle?: boolean;
  onUpdateTitle?: (title: string) => void;
  onToggleShowTitle?: () => void;
  onStartEditing?: () => void;
}

export const SectionHeaderBanner: React.FC<SectionHeaderBannerProps> = ({
  numberIndex,
  title,
  subtitle,
  isEditing = false,
  showTitle = true,
  onUpdateTitle,
  onToggleShowTitle,
  onStartEditing,
}) => {
  // Strip any hardcoded numeric prefix (e.g. "1. ", "4. ") so the dynamic numberIndex is used cleanly
  const cleanTitle = title.replace(/^\d+[\.\-\)]\s*/, '').trim();

  // Título oculto: no ocupa lugar ni siquiera editando, para que la hoja se vea
  // exactamente como quedará. Se vuelve a mostrar desde el panel flotante (botón "Título").
  if (!showTitle) {
    return null;
  }

  return (
    <div className="rp-title-wrap group/banner relative w-full mb-2">
      <div className="rp-title w-full text-center font-bold text-[9pt] text-[var(--rp-title-text)] tracking-wider uppercase py-1 px-4 border border-[var(--rp-title-border)] rounded-[var(--rp-radius-sm)] shadow-2xs flex items-center justify-between">
        <div className="rp-title-inner flex-1 text-center">
          {isEditing && onUpdateTitle ? (
            <div className="rp-title-row flex items-center justify-center gap-2">
              {numberIndex != null && (
                <span className="rp-title-num text-[var(--rp-primary)] font-black font-mono">
                  {numberIndex}.
                </span>
              )}
              <input
                type="text"
                value={cleanTitle}
                onChange={(e) => onUpdateTitle(e.target.value)}
                className="w-4/5 text-center font-bold text-[9pt] text-[var(--rp-primary)] bg-white/80 rounded px-2 border-0 outline-none ring-1 ring-slate-300 focus:ring-[#0b455b] uppercase"
                style={{ height: '1.5em', lineHeight: '1.5em', paddingTop: 0, paddingBottom: 0 }}
                placeholder="Nombre de la sección..."
              />
            </div>
          ) : (
            <div className="rp-title-row flex items-center justify-center gap-1.5">
              {numberIndex != null && (
                <span className="rp-title-num text-[var(--rp-primary)] font-black font-mono">
                  {numberIndex}.
                </span>
              )}
              <span className="rp-title-text">{cleanTitle || title}</span>
            </div>
          )}

          {subtitle && (
            <p className="text-[7pt] text-slate-500 italic font-normal tracking-normal lowercase first-letter:uppercase mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {/* Quick controls in editing mode */}
        {isEditing && onToggleShowTitle && (
          <div className="no-print absolute right-2 flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleShowTitle}
              className="p-1 text-slate-500 hover:text-slate-800 hover:bg-white rounded transition-colors cursor-pointer"
              title="Ocultar título de esta sección"
            >
              <EyeOff className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
