import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './ui-kit.css';
import './edit-dock.css';

/**
 * Panel de edición flotante.
 *
 * Todo lo que un bloque necesita mostrar mientras se edita (opciones, botones
 * de agregar, importar CSV, sliders, acciones sobre filas seleccionadas) se
 * renderiza aquí, fijo en la parte inferior de la pantalla, y NO dentro de la
 * hoja A4. Así la hoja se ve exactamente igual editando que en la versión final.
 *
 * Uso dentro de cualquier bloque:
 *   {isEditing && <EditDock slot="options"> ...controles... </EditDock>}
 *
 * Slots (de arriba hacia abajo en el panel):
 *   - "format":  barra de formato de texto (píldora propia, arriba de todo)
 *   - "bulk":    acciones sobre filas seleccionadas
 *   - "options": opciones propias del bloque
 *   - "hint":    ayuda de teclado
 *   - "main":    barra principal (nombre del bloque, eliminar, listo) → la pone ReportSheet
 */
export type EditDockSlot = 'format' | 'bulk' | 'options' | 'hint' | 'main';

const SLOTS: EditDockSlot[] = ['format', 'bulk', 'options', 'hint', 'main'];
const ROOT_ID = 'edit-dock-root';

function getSlot(slot: EditDockSlot): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  let root = document.getElementById(ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'edit-dock no-print';
    const panel = document.createElement('div');
    panel.className = 'edit-dock-panel';
    SLOTS.forEach((name) => {
      const el = document.createElement('div');
      el.className = `edit-dock-slot edit-dock-${name}`;
      el.dataset.slot = name;
      (name === 'bulk' || name === 'format' ? root! : panel).appendChild(el);
    });
    root.appendChild(panel);
    document.body.appendChild(root);
  }
  return root.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
}

export const EditDock: React.FC<{ slot: EditDockSlot; children: React.ReactNode }> = ({ slot, children }) => {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => { setTarget(getSlot(slot)); }, [slot]);
  return target ? createPortal(children, target) : null;
};

/* ---------- Piezas visuales reutilizables dentro del panel ---------- */

export const DockGroup: React.FC<{ label?: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="dock-group">
    {label && <span className="dock-label">{label}</span>}
    {children}
  </div>
);

export const DockButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'accent'; active?: boolean }
>(({ variant = 'ghost', active, className, children, ...rest }, ref) => (
  <button ref={ref} type="button" className={`dock-btn ${variant}${active ? ' on' : ''} ${className || ''}`} {...rest}>
    {children}
  </button>
));
DockButton.displayName = 'DockButton';

export const DockSegmented = <T extends string | number>({
  value, options, onChange,
}: {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (v: T) => void;
}) => (
  <div className="dock-seg">
    {options.map((o) => (
      <button key={String(o.value)} type="button" className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
        {o.label}
      </button>
    ))}
  </div>
);

export const DockSlider: React.FC<{
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void;
}> = ({ label, value, min, max, step = 1, unit = '', onChange }) => (
  <label className="dock-group dock-slider">
    <span className="dock-label">{label}</span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    <span className="dock-value">{value}{unit && ` ${unit}`}</span>
  </label>
);

export const DockCheck: React.FC<{ label: string; checked: boolean; onChange: () => void }> = ({ label, checked, onChange }) => (
  <label className="dock-check">
    <input type="checkbox" checked={checked} onChange={onChange} />
    <span>{label}</span>
  </label>
);
