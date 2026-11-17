/* =====================================================================
   Textos de ejemplo con los que nacen algunos módulos. Si el contenido
   sigue siendo el de ejemplo, al hacer clic para escribir se selecciona
   todo (como en las celdas de las tablas): lo que se escribe lo reemplaza.
   ===================================================================== */
export const SAMPLE_TEXTS = [
  'Ingrese aquí la narrativa descriptiva, condiciones de ejecución o especificaciones de fiscalización...',
];

const extra = new Set<string>();
/** Otros módulos registran su texto de ejemplo (p. ej. el diagrama) */
export const registerSample = (t: string) => { extra.add(t.trim()); };

export const isSampleText = (t: string | undefined | null) => {
  const v = (t || '').trim();
  return !!v && (SAMPLE_TEXTS.some((s) => s.trim() === v) || extra.has(v));
};

/**
 * Para un cuadro editable: al entrar con el mouse, el clic pondría el cursor DESPUÉS
 * de seleccionar; esto selecciona todo en el foco y en el primer mouseup.
 */
export function selectAllOnEnter() {
  let pending = false;
  const selectAll = (el: HTMLElement) => {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) { el.select(); return; }
    const r = document.createRange();
    r.selectNodeContents(el);
    const s = getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
  };
  return {
    onFocus: (e: { currentTarget: HTMLElement }, when = true) => {
      if (!when) return;
      pending = true;
      const el = e.currentTarget;
      requestAnimationFrame(() => selectAll(el));
    },
    onMouseUp: (e: { currentTarget: HTMLElement; preventDefault: () => void }) => {
      if (!pending) return;
      pending = false;
      e.preventDefault();
      selectAll(e.currentTarget);
    },
  };
}
