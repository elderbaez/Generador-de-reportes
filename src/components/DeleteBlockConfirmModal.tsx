import React, { useEffect } from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';

interface DeleteBlockConfirmModalProps {
  isOpen: boolean;
  blockTitle: string;
  blockType?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteBlockConfirmModal: React.FC<DeleteBlockConfirmModalProps> = ({
  isOpen,
  blockTitle,
  blockType,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        onConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-150 no-print">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Bar */}
        <div className="bg-[#0b455b] text-white px-5 py-3.5 flex items-center justify-between border-b border-[#083445]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-300">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white leading-tight">
                Eliminar Bloque
              </h3>
              <p className="text-[11px] text-slate-300">
                Confirmación de remoción de sección
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-amber-900 text-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">
                ¿Estás seguro de que deseas eliminar este bloque?
              </span>
              <p className="text-amber-800 leading-relaxed">
                El bloque <strong className="font-semibold text-slate-900">"{blockTitle}"</strong>{' '}
                será retirado de todas las páginas del informe. Los demás bloques se reorganizarán automáticamente.
              </p>
            </div>
          </div>

          {blockType && (
            <div className="text-[11px] text-slate-500 flex items-center justify-between px-1">
              <span>Tipo de sección:</span>
              <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {blockType}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Eliminar Bloque</span>
          </button>
        </div>
      </div>
    </div>
  );
};
