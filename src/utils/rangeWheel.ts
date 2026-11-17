/**
 * Ajuste fino de TODOS los deslizadores (input type="range") con la rueda del mouse:
 * con el puntero encima, cada "clic" de la rueda mueve un paso (step) del deslizador.
 * Arriba = sube, abajo = baja. Shift + rueda mueve 5 pasos (ajuste grueso).
 * Funciona en cualquier deslizador presente o futuro, sin tocar cada componente:
 * se instala una sola vez a nivel de documento.
 */
export function installRangeWheel(): () => void {
  let acc = 0;
  let lastTarget: HTMLInputElement | null = null;

  const setNativeValue = (input: HTMLInputElement, value: string) => {
    // El setter nativo + evento "input" hace que React dispare su onChange normalmente
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const onWheel = (e: WheelEvent) => {
    const t = e.target as HTMLElement | null;
    const input = t?.closest?.('input[type="range"]') as HTMLInputElement | null;
    if (!input || input.disabled) return;
    e.preventDefault(); // la página no se desplaza mientras se ajusta

    if (input !== lastTarget) { acc = 0; lastTarget = input; }
    // Rueda clásica: cada evento es un paso. Trackpad: se acumula hasta completar un paso.
    const raw = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY || e.deltaX;
    let steps = 0;
    if (Math.abs(raw) >= 50) steps = raw < 0 ? 1 : -1;
    else {
      acc += raw;
      if (Math.abs(acc) >= 50) { steps = acc < 0 ? 1 : -1; acc = 0; }
    }
    if (!steps) return;
    if (e.shiftKey) steps *= 5;

    const min = input.min === '' ? 0 : Number(input.min);
    const max = input.max === '' ? 100 : Number(input.max);
    const stepAttr = input.step === '' || input.step === 'any' ? 1 : Number(input.step) || 1;
    const decimals = (String(stepAttr).split('.')[1] || '').length;
    const current = Number(input.value);
    const next = Math.min(max, Math.max(min, current + steps * stepAttr));
    const rounded = Number(next.toFixed(decimals));
    if (rounded !== current) setNativeValue(input, String(rounded));
  };

  document.addEventListener('wheel', onWheel, { passive: false, capture: true });
  return () => document.removeEventListener('wheel', onWheel, { capture: true } as EventListenerOptions);
}
