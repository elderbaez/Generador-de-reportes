import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import './ui-kit.css';
import { Plus, Image, FileText, ClipboardList, PenTool, MessageSquareText, CheckSquare, BarChart3, TrendingUp, X, CloudSun, FileImage, BookOpen, ListTree, Code2, Workflow, CalendarRange, MapPinned, Columns2 } from 'lucide-react';
import { BlockType } from '../types';

interface InSituBlockDividerProps {
  pageIndex: number;
  insertOrder: number;
  afterBlockId?: string;
  onInsertBlock: (pageIndex: number, targetOrder: number, type: BlockType, afterBlockId?: string) => void;
}

interface BlockOption {
  type: BlockType;
  title: string;
  icon: React.ReactNode;
}

const BLOCK_OPTIONS: BlockOption[] = [
  { type: 'photos', title: 'Bloque de Fotografías', icon: <Image className="w-4 h-4" /> },
  { type: 'text', title: 'Texto Libre / Narrativa', icon: <FileText className="w-4 h-4" /> },
  { type: 'specs', title: 'Especificaciones y Ensayos', icon: <ClipboardList className="w-4 h-4" /> },
  { type: 'observations', title: 'Observaciones / Avisos', icon: <MessageSquareText className="w-4 h-4" /> },
  { type: 'signatures', title: 'Firmas y Conformidades', icon: <PenTool className="w-4 h-4" /> },
  { type: 'pending', title: 'Cuadro de Pendencias', icon: <CheckSquare className="w-4 h-4" /> },
  { type: 'situation', title: 'Rubros de Obra', icon: <BarChart3 className="w-4 h-4" /> },
  { type: 'scurve', title: 'Curva S (Físico y Financiero)', icon: <TrendingUp className="w-4 h-4" /> },
  { type: 'weather', title: 'Condiciones Climáticas', icon: <CloudSun className="w-4 h-4" /> },
  { type: 'document', title: 'Documentos y Planos', icon: <FileImage className="w-4 h-4" /> },
  { type: 'map', title: 'Mapa / croquis de ubicación', icon: <MapPinned className="w-4 h-4" /> },
  { type: 'gantt', title: 'Cronograma (Gantt)', icon: <CalendarRange className="w-4 h-4" /> },
  { type: 'diagram', title: 'Diagrama (Mermaid)', icon: <Workflow className="w-4 h-4" /> },
  { type: 'html', title: 'HTML / SVG (gráfico propio)', icon: <Code2 className="w-4 h-4" /> },
  { type: 'toc', title: 'Índice', icon: <ListTree className="w-4 h-4" /> },
  { type: 'cover', title: 'Portada (va al principio)', icon: <BookOpen className="w-4 h-4" /> },
];

export const InSituBlockDivider: React.FC<InSituBlockDividerProps> = ({
  pageIndex,
  insertOrder,
  afterBlockId,
  onInsertBlock,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  // El menú se dibuja fuera de la hoja (en document.body) para que nunca quede recortado
  // por los bordes de la hoja A4. Se ubica bajo el botón, o arriba si no hay espacio.
  useLayoutEffect(() => {
    if (!isOpen) { setPos(null); return; }
    const place = () => {
      if (!btnRef.current || !menuRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      const m = menuRef.current.getBoundingClientRect();
      let x = r.left + r.width / 2 - m.width / 2;
      let y = r.bottom + 6;
      if (y + m.height > window.innerHeight - 12) y = Math.max(12, r.top - m.height - 6);
      x = Math.max(12, Math.min(x, window.innerWidth - m.width - 12));
      setPos({ x, y });
    };
    place();
    document.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => { document.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (type: BlockType) => {
    onInsertBlock(pageIndex, insertOrder, type, afterBlockId);
    setIsOpen(false);
  };

  return (
    // Alto 0: el divisor no ocupa lugar en la hoja (pantalla = impresión). La zona sensible
    // al mouse se superpone 8 px arriba y abajo del borde entre bloques.
    <div className="in-situ-divider no-print relative h-0 group z-20">
      <div className="absolute inset-x-[9mm] -top-2 h-4 flex items-center justify-center cursor-pointer">
        <div
          className={`w-full transition-all duration-150 ${
            isOpen
              ? 'border-b-2 border-[#0b455b]'
              : 'border-b border-transparent group-hover:border-dashed group-hover:border-sky-400'
          }`}
        />
        <button
          ref={btnRef}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold shadow-md transition-all duration-150 cursor-pointer ${
            isOpen
              ? 'bg-[#0b455b] text-white ring-2 ring-white scale-105'
              : 'opacity-0 group-hover:opacity-100 bg-white hover:bg-[#0b455b] text-slate-700 hover:text-white border border-slate-300 hover:border-[#0b455b]'
          }`}
          title="Insertar un nuevo bloque en esta posición"
        >
          {isOpen ? (
            <>
              <X className="w-3 h-3 text-[#f4c84a]" />
              <span>Cerrar</span>
            </>
          ) : (
            <>
              <Plus className="w-3 h-3 text-[#0b455b] group-hover:text-[#f4c84a]" />
              <span>+ Insertar bloque aquí</span>
            </>
          )}
        </button>
      </div>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          className="ui-pop no-print fixed w-[260px] max-h-[70vh] overflow-auto z-[1300]"
          style={{ left: pos?.x ?? 0, top: pos?.y ?? 0, visibility: pos ? 'visible' : 'hidden' }}
        >
          <div className="ui-pop-caption">Insertar bloque</div>

          <div className="flex flex-col gap-px">
            {BLOCK_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                type="button"
                onClick={() => handleSelect(opt.type)}
                className="ui-pop-item"
              >
                <span className="w-7 h-7 rounded-md bg-slate-100 text-[var(--ui-brand)] inline-flex items-center justify-center shrink-0">
                  {opt.icon}
                </span>
                <span className="font-semibold">{opt.title}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

/* =====================================================================
   "+" en el borde izquierdo o derecho de un módulo: agrega otro módulo AL
   LADO (columna), en vez de debajo. Aparece al acercar el mouse al borde.
   ===================================================================== */
const COLUMN_TYPES = BLOCK_OPTIONS.filter((o) => o.type !== 'cover' && o.type !== 'toc');

export const ColumnAdder: React.FC<{
  side: 'left' | 'right';
  onPick: (type: BlockType) => void;
}> = ({ side, onPick }) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const place = () => {
      if (!btnRef.current || !menuRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      const m = menuRef.current.getBoundingClientRect();
      let x = side === 'right' ? r.right + 6 : r.left - m.width - 6;
      if (x + m.width > window.innerWidth - 12 || x < 12) x = Math.max(12, Math.min(window.innerWidth - m.width - 12, r.left - m.width / 2));
      let y = r.top + r.height / 2 - m.height / 2;
      y = Math.max(12, Math.min(window.innerHeight - m.height - 12, y));
      setPos({ x, y });
    };
    place();
    document.addEventListener('scroll', place, true);
    return () => document.removeEventListener('scroll', place, true);
  }, [open, side]);

  useEffect(() => {
    if (!open) return;
    const out = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', out);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', key); };
  }, [open]);

  return (
    <div className={`rp-col-adder no-print is-${side}${open ? ' is-open' : ''}`} onDoubleClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        className="rp-col-adder-btn"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        title={side === 'right' ? 'Agregar un módulo a la derecha (en columnas)' : 'Agregar un módulo a la izquierda (en columnas)'}
      >
        {open ? <X /> : <><Plus /><Columns2 /></>}
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className="ui-pop no-print fixed w-[250px] max-h-[70vh] overflow-auto z-[1300]"
          style={{ left: pos?.x ?? 0, top: pos?.y ?? 0, visibility: pos ? 'visible' : 'hidden' }}
        >
          <div className="ui-pop-caption">Agregar {side === 'right' ? 'a la derecha' : 'a la izquierda'}</div>
          <div className="flex flex-col gap-px">
            {COLUMN_TYPES.map((opt) => (
              <button key={opt.type} type="button" className="ui-pop-item" onClick={() => { setOpen(false); onPick(opt.type); }}>
                <span className="w-7 h-7 rounded-md bg-slate-100 text-[var(--ui-brand)] inline-flex items-center justify-center shrink-0">{opt.icon}</span>
                <span className="font-semibold">{opt.title}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
