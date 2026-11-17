import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ui-kit.css';

/**
 * Menú blanco flotante (familia .ui-pop del kit visual).
 *
 * Se monta en <body> con posición fija, anclado a un botón: así nunca queda
 * recortado por una tarjeta con overflow:hidden ni afectado por el zoom de la
 * hoja (transform: scale). Se cierra al hacer clic afuera, con Escape o al
 * desplazar la página.
 *
 * Uso:
 *   const [anchor, setAnchor] = useState<DOMRect | null>(null);
 *   <button onClick={(e) => setAnchor(e.currentTarget.getBoundingClientRect())} />
 *   {anchor && <UiPop anchor={anchor} onClose={() => setAnchor(null)}>…</UiPop>}
 */
export const UiPop: React.FC<{
  anchor: DOMRect;
  onClose: () => void;
  /** Alineación horizontal respecto del botón. */
  align?: 'start' | 'end';
  caption?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ anchor, onClose, align = 'end', caption, className, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Ubicación: debajo del botón; si no entra, arriba. Siempre dentro de la ventana.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight, m = 8;
    let left = align === 'end' ? anchor.right - w : anchor.left;
    left = Math.max(m, Math.min(window.innerWidth - w - m, left));
    let top = anchor.bottom + 6;
    if (top + h > window.innerHeight - m) top = Math.max(m, anchor.top - h - 6);
    setPos({ left, top });
  }, [anchor, align]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    const onScroll = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    // En el próximo ciclo, para que el mismo clic que lo abrió no lo cierre
    const t = window.setTimeout(() => {
      document.addEventListener('pointerdown', onDown, true);
      window.addEventListener('scroll', onScroll, true);
      window.addEventListener('resize', onClose);
    }, 0);
    document.addEventListener('keydown', onKey, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className={`ui-pop no-print ${className || ''}`}
      role="menu"
      style={{
        position: 'fixed',
        zIndex: 1400,
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        visibility: pos ? 'visible' : 'hidden',
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {caption && <div className="ui-pop-caption">{caption}</div>}
      {children}
    </div>,
    document.body,
  );
};

/** Opción de menú con marca de seleccionada. */
export const UiPopItem: React.FC<{
  on?: boolean;
  danger?: boolean;
  icon?: React.ReactNode;
  title?: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ on, danger, icon, title, onClick, children }) => (
  <button
    type="button"
    role="menuitemradio"
    aria-checked={!!on}
    title={title}
    className={`ui-pop-item${on ? ' on' : ''}${danger ? ' is-danger' : ''}`}
    onClick={onClick}
  >
    {icon}
    <span style={{ flex: 1 }}>{children}</span>
    {on && <span aria-hidden style={{ fontSize: 11 }}>✓</span>}
  </button>
);
