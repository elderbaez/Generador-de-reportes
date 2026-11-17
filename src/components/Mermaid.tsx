import React, { useContext, useEffect, useState } from 'react';
import { RefsContext } from '../utils/refs';

/* =====================================================================
   Diagramas Mermaid dentro del texto: un bloque ```mermaid … ``` se
   dibuja como diagrama (SVG vectorial: se imprime nítido).
   - La librería es pesada: se carga solo cuando un texto tiene un diagrama.
   - Los colores salen del tema (--rp-primary, --rp-line…).
   - Las etiquetas van como texto SVG (no HTML) para que salgan bien en el
     PDF del programa y al imprimir.
   - En el editor (render estático) se ve el código, para poder editarlo.
   Necesita el paquete "mermaid" (npm i mermaid).
   ===================================================================== */

type MermaidApi = {
  initialize: (cfg: Record<string, unknown>) => void;
  render: (id: string, code: string) => Promise<{ svg: string }>;
};

let mermaidPromise: Promise<MermaidApi> | null = null;
const loadMermaid = () => {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid')
      .then((m) => ((m as { default?: MermaidApi }).default ?? (m as unknown as MermaidApi)))
      .catch((e) => { mermaidPromise = null; throw e; });
  }
  return mermaidPromise;
};

const cssVar = (name: string, fallback: string) => {
  const sheet = document.querySelector('.a4-sheet') || document.documentElement;
  return getComputedStyle(sheet).getPropertyValue(name).trim() || fallback;
};

/** Mezcla un color #rrggbb con blanco (k = 0 → igual, 1 → blanco). Otros formatos quedan como están. */
const tint = (hex: string, k: number) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (sh: number) => Math.round(((n >> sh) & 255) * (1 - k) + 255 * k);
  return `#${[16, 8, 0].map((sh) => ch(sh).toString(16).padStart(2, '0')).join('')}`;
};

/** Colores y letra del tema actual: todo el diagrama (nodos, cronogramas, tortas, mapas…) sigue al informe */
const themeConfig = () => {
  const v = (n: string, f: string) => cssVar(n, f);
  const primary = v('--rp-primary', '#0b455b');
  const dark = v('--rp-primary-dark', '#083445');
  const soft = v('--rp-primary-soft', '#e6f0f3');
  const label = v('--rp-label', '#1f4e66');
  const line = v('--rp-line', '#cbd5e1');
  const border = v('--rp-border', '#94a3b8');
  const text = v('--rp-text', '#172033');
  const accent = v('--rp-accent', '#f4c84a');
  const s1 = v('--rp-surface-1', '#f8fafc');
  const s2 = v('--rp-surface-2', '#f1f5f9');
  const ind1 = v('--rp-ind-1', '#0e7490');
  const ind2 = v('--rp-ind-2', '#d97706');
  const ind3 = v('--rp-ind-3', '#16a34a');
  const real = v('--rp-real', '#059669');
  const crit = v('--rp-obs-critical', '#dc2626');
  const font = v('--rp-font-body', 'Plus Jakarta Sans, system-ui, sans-serif');
  // Paleta para series (tortas, barras, ramas del mapa)
  const palette = [primary, accent, ind1, ind3, ind2, label, real, dark];
  const cScale: Record<string, string> = {};
  palette.forEach((c, i) => { cScale[`cScale${i}`] = c; cScale[`cScaleLabel${i}`] = i === 1 ? text : '#ffffff'; cScale[`pie${i + 1}`] = c; });
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily: font,
    htmlLabels: false,
    flowchart: { htmlLabels: false, useMaxWidth: true, curve: 'basis' },
    sequence: { useMaxWidth: true },
    // Cronogramas legibles en una hoja: barras más altas, letra más grande y lugar para los nombres de sección
    gantt: { useMaxWidth: true, barHeight: 22, barGap: 6, fontSize: 12, sectionFontSize: 12, leftPadding: 160, topPadding: 40, gridLineStartPadding: 30 },
    themeVariables: {
      fontFamily: font,
      fontSize: '13px',
      // Nodos y líneas
      primaryColor: soft,
      primaryBorderColor: primary,
      primaryTextColor: text,
      secondaryColor: s1,
      secondaryBorderColor: border,
      tertiaryColor: s2,
      tertiaryBorderColor: border,
      lineColor: primary,
      textColor: text,
      mainBkg: soft,
      nodeBorder: primary,
      clusterBkg: s1,
      clusterBorder: line,
      titleColor: primary,
      edgeLabelBackground: '#ffffff',
      noteBkgColor: s1,
      noteBorderColor: accent,
      noteTextColor: text,
      // Secuencias
      actorBkg: soft,
      actorBorder: primary,
      actorTextColor: text,
      actorLineColor: border,
      signalColor: primary,
      signalTextColor: text,
      labelBoxBkgColor: soft,
      labelBoxBorderColor: primary,
      labelTextColor: text,
      loopTextColor: label,
      activationBkgColor: s2,
      activationBorderColor: primary,
      sequenceNumberColor: '#ffffff',
      // Cronogramas (Gantt)
      sectionBkgColor: s1,
      altSectionBkgColor: '#ffffff',
      sectionBkgColor2: s1,
      gridColor: line,
      taskBkgColor: soft,
      taskBorderColor: primary,
      taskTextColor: text,
      taskTextOutsideColor: text,
      taskTextLightColor: '#ffffff',
      taskTextDarkColor: text,
      // En curso y críticas con fondo claro: su texto va oscuro y tiene que leerse
      activeTaskBkgColor: tint(primary, 0.55),
      activeTaskBorderColor: primary,
      doneTaskBkgColor: s2,
      doneTaskBorderColor: border,
      critBkgColor: tint(crit, 0.7),
      critBorderColor: crit,
      todayLineColor: accent,
      // Estados
      labelColor: text,
      altBackground: s1,
      // Tortas
      pieStrokeColor: '#ffffff',
      pieOuterStrokeColor: line,
      pieTitleTextColor: primary,
      pieSectionTextColor: '#ffffff',
      pieLegendTextColor: text,
      // Gráficos XY
      xyChart: { plotColorPalette: palette.join(', '), titleColor: primary, xAxisLabelColor: text, yAxisLabelColor: text, xAxisLineColor: border, yAxisLineColor: border, backgroundColor: '#ffffff' },
      ...cScale,
    },
  };
};

/** Firma del tema: si cambia, los diagramas se vuelven a dibujar */
const themeSignature = () => ['--rp-primary', '--rp-primary-soft', '--rp-accent', '--rp-text', '--rp-font-body', '--rp-ind-1', '--rp-surface-1']
  .map((n) => cssVar(n, '')).join('|');

const cache = new Map<string, { svg?: string; error?: string }>();
let seq = 0;
let lastTheme = '';

export const MermaidDiagram: React.FC<{ code: string }> = ({ code }) => {
  // Fuera de la hoja (el editor arma su vista sin el índice de referencias) se muestra el código
  const inSheet = useContext(RefsContext) !== null;
  const [state, setState] = useState<{ svg?: string; error?: string } | null>(() => cache.get(code) ?? null);

  // El tema se aplica después de dibujar: se escucha el aviso para releer sus colores
  const [themeTick, setThemeTick] = useState(0);
  useEffect(() => {
    const on = () => setThemeTick((t) => t + 1);
    window.addEventListener('rp-theme-applied', on);
    return () => window.removeEventListener('rp-theme-applied', on);
  }, []);
  const themeSig = inSheet ? `${themeSignature()}#${themeTick}` : '';
  useEffect(() => {
    if (!inSheet) return;
    let off = false;
    (async () => {
      try {
        const m = await loadMermaid();
        const cfg = themeConfig();
        const themeKey = JSON.stringify(cfg.themeVariables);
        if (themeKey !== lastTheme) { m.initialize(cfg); lastTheme = themeKey; cache.clear(); }
        const key = code;
        let r = cache.get(key);
        if (!r) {
          try {
            const { svg } = await m.render(`rp-mmd-${++seq}`, code);
            r = { svg };
          } catch (e) {
            r = { error: e instanceof Error ? e.message.split('\n')[0] : String(e) };
          }
          cache.set(key, r);
        }
        if (!off) setState(r);
      } catch (e) {
        console.warn('[Mermaid] No se pudo cargar la librería', e);
        if (!off) setState({ error: 'Falta instalar el paquete "mermaid" en el proyecto.' });
      }
    })();
    return () => { off = true; };
  }, [code, inSheet, themeSig]);

  // Sin dibujo todavía (o en el editor): el código, como cualquier bloque de código
  if (!inSheet || !state?.svg) {
    return (
      <div className="rp-mermaid is-src">
        <pre className="rp-md-pre" data-lang="mermaid"><code className="language-mermaid">{code}</code></pre>
        {state?.error && <div className="rp-mermaid-error no-print">Diagrama con error: {state.error}</div>}
      </div>
    );
  }
  return <div className="rp-mermaid" dangerouslySetInnerHTML={{ __html: state.svg }} />;
};
