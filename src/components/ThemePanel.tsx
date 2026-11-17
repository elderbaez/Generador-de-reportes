import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PageSetup, PageMargins, PaperId, PAPERS, MARGIN_MAX, CUSTOM_LIMITS, normalizePageSetup, pageSize, pageLabel, parsePageRule, stripPageRules } from '../utils/pageSetup';

/** La hoja actual, para la guía de la IA (como regla @page) */
const guidePage = (p?: PageSetup) => {
  if (!p) return undefined;
  const sizeName = ({ a4: 'A4', carta: 'letter', oficio: 'legal', a3: 'A3', custom: '' } as Record<string, string>)[p.paper];
  const { w, h } = pageSize(p);
  const size = sizeName ? `${sizeName} ${p.orientation}` : `${w}mm ${h}mm`;
  const m = p.margins;
  const margin = m.t === m.r && m.r === m.b && m.b === m.l ? `${m.t}mm` : `${m.t}mm ${m.r}mm ${m.b}mm ${m.l}mm`;
  return { label: pageLabel(p), css: `@page { size: ${size}; margin: ${margin}; }` };
};
import { createPortal } from 'react-dom';
import { X, Check, Save, Plus, RotateCcw, Trash2, Download, Upload, Search, AlertTriangle, ChevronDown, CheckCircle2, Code2, SlidersHorizontal, Bot, ClipboardCopy, ClipboardPaste, Lightbulb, ImagePlus } from 'lucide-react';
import {
  ReportTheme, ThemeColorKey, ThemeFont, COLOR_GROUPS, BUILT_IN_THEMES, GOOGLE_FONTS, COMMON_SYSTEM_FONTS,
  FALLBACK_OPTIONS, MONO_DEFAULT_LABEL, isGoogleFont, isFontInstalled, queryInstalledFonts, fontStack,
  loadSavedThemes, saveThemes, normalizeTheme, sameLook, buildThemeVars,
} from '../theme/themes';
import { KNOWN_VARS, RP_SELECTORS, CSS_PROPS, SNIPPETS, IDEAS, checkCss, buildAiGuide, extractCss } from '../theme/advanced';
import { CodeEditor, CodeEditorHandle } from './CodeEditor';
import { ThemeAsset, AssetSpot, SPOT_LABEL, DEFAULT_SIZE, DEFAULT_OPACITY, fileToAsset, assetVar, assetKB, slugName } from '../theme/assets';
import './theme-panel.css';

/* =====================================================================
   Panel de Temas: elegir un tema, ajustar colores, fuentes y forma,
   guardar en la biblioteca y exportar/importar. Los cambios se ven en
   vivo sobre la hoja (el panel queda a la derecha y no la tapa).
   ===================================================================== */

interface ThemePanelProps {
  isOpen: boolean;
  theme: ReportTheme;
  onChange: (theme: ReportTheme) => void;
  onClose: () => void;
  /** El apartado Avanzado necesita un panel más ancho (la hoja se corre). */
  onWideChange?: (wide: boolean) => void;
  /** Hoja: papel, orientación y márgenes (es del informe, no del tema) */
  pageSetup?: PageSetup;
  onPageSetupChange?: (p: PageSetup) => void;
}

const HEX = /^#[0-9a-f]{6}$/i;
const toHex6 = (c: string) => {
  const m = c.trim().match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  return m ? `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toLowerCase() : c.trim().toLowerCase();
};

/* ---------- Fila de color: muestra + selector nativo + código ---------- */
const ColorRow: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;
  const commit = (v: string) => {
    const h = toHex6(v.startsWith('#') ? v : `#${v}`);
    if (HEX.test(h)) onChange(h);
    setDraft(null);
  };
  return (
    <label className="tp-color">
      <span className="tp-swatch" style={{ background: value }}>
        <input type="color" value={HEX.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} />
      </span>
      <span className="tp-color-label">{label}</span>
      <input
        className="tp-hex"
        value={shown}
        spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
          if (e.key === 'Escape') setDraft(null);
        }}
      />
    </label>
  );
};

/* ---------- Campo de fuente ---------- */
const FontField: React.FC<{
  label: string;
  font: ThemeFont;
  kind: 'body' | 'title' | 'num';
  installed: string[];
  bodyFamily: string;
  onChange: (f: ThemeFont) => void;
}> = ({ label, font, kind, installed, bodyFamily, onChange }) => {
  const listId = `tp-fonts-${kind}`;
  const shown = font.source === 'stack' ? MONO_DEFAULT_LABEL : font.family;
  const [draft, setDraft] = useState<string | null>(null);

  const setFamily = (raw: string) => {
    const family = raw.trim();
    setDraft(null);
    if (kind === 'num' && (family === '' || family === MONO_DEFAULT_LABEL)) return onChange({ family: MONO_DEFAULT_LABEL, source: 'stack' });
    if (kind === 'title' && family === '') return onChange({ family: '', source: 'google' });
    if (family === '') return;
    if (isGoogleFont(family)) {
      const g = GOOGLE_FONTS.find((f) => f.family.toLowerCase() === family.toLowerCase())!;
      return onChange({ family: g.family, source: 'google' });
    }
    onChange({ family, source: 'system', fallback: font.source === 'system' && font.fallback ? font.fallback : kind === 'num' ? 'monospace' : 'sans-serif' });
  };

  const status = useMemo(() => {
    if (font.source === 'stack') return { cls: 'neutral', text: 'Del sistema' };
    if (kind === 'title' && !font.family) return { cls: 'neutral', text: `Igual que el texto (${bodyFamily || '—'})` };
    if (font.source === 'google') return { cls: 'ok', text: 'Google Fonts · se descarga sola' };
    return isFontInstalled(font.family)
      ? { cls: 'ok', text: 'Instalada en este equipo' }
      : { cls: 'warn', text: 'No está instalada en este equipo: se usa el reemplazo' };
  }, [font, kind, bodyFamily]);

  const previewFamily = kind === 'title' && !font.family ? undefined : fontStack(font, kind === 'num' ? 'mono' : 'sans');
  const sample = kind === 'num' ? '1.234.567,89 · 16,5 % · 02/11/2026' : kind === 'title' ? 'SITUACIÓN ACTUAL Y GRÁFICO DE AVANCE' : 'Avance de obra conforme al cronograma';

  return (
    <div className="tp-font">
      <div className="tp-font-head">
        <span className="tp-font-label">{label}</span>
        <span className={`tp-badge ${status.cls}`}>{status.cls === 'warn' && <AlertTriangle />}{status.text}</span>
      </div>
      <input
        className="tp-input"
        list={listId}
        value={draft ?? shown}
        placeholder={kind === 'title' ? 'Igual que el texto' : 'Nombre de la fuente'}
        spellCheck={false}
        onChange={(e) => {
          setDraft(e.target.value);
          // Elegir de la lista aplica en el acto
          const v = e.target.value;
          const opts = (e.target.list?.options ?? []) as HTMLCollectionOf<HTMLOptionElement>;
          if (Array.from(opts).some((o) => o.value === v)) setFamily(v);
        }}
        onBlur={(e) => { if (draft !== null) setFamily(e.target.value); }}
        onKeyDown={(e) => { if (e.key === 'Enter') setFamily((e.target as HTMLInputElement).value); if (e.key === 'Escape') setDraft(null); }}
      />
      <datalist id={listId}>
        {kind === 'num' && <option value={MONO_DEFAULT_LABEL} />}
        {GOOGLE_FONTS.filter((f) => (kind === 'num' ? true : f.kind !== 'mono')).map((f) => (
          <option key={f.family} value={f.family} label={`Google · ${f.kind === 'serif' ? 'con serifa' : f.kind === 'mono' ? 'monoespaciada' : 'sin serifa'}`} />
        ))}
        {[...new Set([...COMMON_SYSTEM_FONTS, ...installed])].filter((f) => !isGoogleFont(f)).map((f) => (
          <option key={f} value={f} label="Del sistema" />
        ))}
      </datalist>
      {font.source === 'system' && (
        <label className="tp-fallback">
          <span>Si falta, usar</span>
          <select value={font.fallback || 'sans-serif'} onChange={(e) => onChange({ ...font, fallback: e.target.value })}>
            {FALLBACK_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      )}
      <div className="tp-sample" style={{ fontFamily: previewFamily, fontWeight: kind === 'title' ? 700 : 500, letterSpacing: kind === 'title' ? '.06em' : undefined }}>
        {sample}
      </div>
    </div>
  );
};

/* ---------- Hoja: papel, orientación y márgenes ---------- */
const PageSection: React.FC<{ value: PageSetup; onChange: (p: PageSetup) => void }> = ({ value, onChange }) => {
  const set = (patch: Partial<PageSetup>) => onChange(normalizePageSetup({ ...value, ...patch }));
  const setM = (k: keyof PageMargins, v: number) => set({ margins: { ...value.margins, [k]: v } });
  const { w, h } = pageSize(value);
  const m = value.margins;
  const portraitW = Math.min(w, h), portraitH = Math.max(w, h);
  return (
    <Section title="Hoja">
      <div className="tp-page">
        <div className="tp-page-row">
          <span>Papel</span>
          <select className="tp-select" value={value.paper}
            onChange={(e) => set({ paper: e.target.value as PaperId, customW: portraitW, customH: portraitH })}>
            {PAPERS.map((p) => (
              <option key={p.id} value={p.id}>{p.id === 'custom' ? p.label : `${p.label} · ${String(p.w).replace('.', ',')} × ${String(p.h).replace('.', ',')} mm`}</option>
            ))}
          </select>
        </div>
        {value.paper === 'custom' && (
          <div className="tp-page-row">
            <span>Medidas</span>
            <span className="tp-page-wh">
              <input type="number" min={CUSTOM_LIMITS.min} max={CUSTOM_LIMITS.max} key={`customW-${value.customW}`} defaultValue={value.customW ?? 210}
                onBlur={(e) => set({ customW: Number(e.target.value) })}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /> ×
              <input type="number" min={CUSTOM_LIMITS.min} max={CUSTOM_LIMITS.max} key={`customH-${value.customH}`} defaultValue={value.customH ?? 297}
                onBlur={(e) => set({ customH: Number(e.target.value) })}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /> mm
            </span>
          </div>
        )}
        <div className="tp-page-row">
          <span>Orientación</span>
          <div className="tp-page-seg">
            <button type="button" className={value.orientation === 'portrait' ? 'on' : ''} onClick={() => set({ orientation: 'portrait' })}>
              <i className="tp-page-ic" style={{ width: 9, height: 12 }} /> Vertical
            </button>
            <button type="button" className={value.orientation === 'landscape' ? 'on' : ''} onClick={() => set({ orientation: 'landscape' })}>
              <i className="tp-page-ic" style={{ width: 12, height: 9 }} /> Horizontal
            </button>
          </div>
        </div>
        <div className="tp-page-sub">Márgenes</div>
        <div className="tp-page-margins">
          <div className="tp-page-preview" style={{ aspectRatio: `${w} / ${h}` }}>
            <i style={{ top: `${(m.t / h) * 100}%`, right: `${(m.r / w) * 100}%`, bottom: `${(m.b / h) * 100}%`, left: `${(m.l / w) * 100}%` }} />
          </div>
          <div className="tp-page-sliders">
            {([['t', 'Arriba'], ['b', 'Abajo'], ['l', 'Izquierda'], ['r', 'Derecha']] as [keyof PageMargins, string][]).map(([k, label]) => (
              <label key={k} className="tp-range sm">
                <span>{label}</span>
                <input type="range" min={0} max={MARGIN_MAX} step={1} value={m[k]} onChange={(e) => setM(k, Number(e.target.value))} />
                <b>{m[k]} mm</b>
              </label>
            ))}
            <button type="button" className="tp-link" onClick={() => set({ margins: { t: m.t, r: m.t, b: m.t, l: m.t } })}>
              Todos iguales a “Arriba”
            </button>
          </div>
        </div>
        <div className="tp-note">
          Los márgenes dejan un borde blanco alrededor de todo, incluidos el encabezado y el pie. Al cambiar la hoja,
          los bloques se reacomodan solos. Se guarda con el informe y con las plantillas.
        </div>
      </div>
    </Section>
  );
};

/* ---------- Sección plegable ---------- */
const Section: React.FC<{ title: string; defaultOpen?: boolean; children: React.ReactNode; right?: React.ReactNode }> = ({ title, defaultOpen = true, children, right }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`tp-section${open ? ' open' : ''}`}>
      <button type="button" className="tp-section-head" onClick={() => setOpen((v) => !v)}>
        <ChevronDown className="tp-chev" />
        <span>{title}</span>
        {right && <span className="tp-section-right" onClick={(e) => e.stopPropagation()}>{right}</span>}
      </button>
      {open && <div className="tp-section-body">{children}</div>}
    </section>
  );
};



/* =====================================================================
   Imágenes del tema: se cargan una vez y se ubican sin código
   ===================================================================== */
const ImagesSection: React.FC<{ theme: ReportTheme; onChange: (t: ReportTheme) => void }> = ({ theme, onChange }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const assets = theme.assets || [];
  const setAssets = (list: ThemeAsset[]) => onChange({ ...theme, assets: list });
  const patch = (id: string, p: Partial<ThemeAsset>) => setAssets(assets.map((a) => (a.id === id ? { ...a, ...p } : a)));
  const totalKB = assets.reduce((s, a) => s + assetKB(a), 0);

  const add = async (files: FileList | null) => {
    if (!files) return;
    setErr(null);
    let list = [...assets];
    for (const f of Array.from(files)) {
      try { list = [...list, await fileToAsset(f, list)]; }
      catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    }
    setAssets(list);
  };
  const sizeRange = (spot: AssetSpot) => spot === 'sheet' ? { min: 20, max: 100, unit: '% ancho' }
    : spot === 'sheet-corner' ? { min: 10, max: 60, unit: '% ancho' }
      : spot === 'title-icon' ? { min: 3, max: 9, unit: 'mm' }
        : spot === 'footer' ? { min: 3, max: 10, unit: 'mm' } : { min: 8, max: 30, unit: 'mm' };

  return (
    <div className="tp-images"
      onDragOver={(e) => { e.preventDefault(); }}
      onDrop={(e) => { e.preventDefault(); add(e.dataTransfer.files); }}>
      <button type="button" className="tp-drop" onClick={() => fileRef.current?.click()}>
        <ImagePlus /> <span><b>Agregar imagen</b> · SVG, PNG, JPG o WebP (o arrastrala acá)</span>
      </button>
      <input ref={fileRef} type="file" accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp" multiple hidden
        onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      {err && <div className="tp-note tp-err">{err}</div>}

      {assets.map((a) => {
        const r = sizeRange(a.spot);
        return (
          <div key={a.id} className="tp-img">
            <div className="tp-img-thumb" style={{ backgroundImage: `url("${a.dataUrl}")` }} />
            <div className="tp-img-body">
              <div className="tp-img-row">
                <input className="tp-input tp-img-name" value={a.name} spellCheck={false}
                  onChange={(e) => patch(a.id, { name: e.target.value })}
                  onBlur={(e) => patch(a.id, { name: slugName(e.target.value) })} title="Nombre (da la variable para Avanzado)" />
                <button type="button" className="tp-icon-sm danger" title="Quitar imagen" onClick={() => setAssets(assets.filter((x) => x.id !== a.id))}><Trash2 /></button>
              </div>
              <select className="tp-select" value={a.spot}
                onChange={(e) => { const spot = e.target.value as AssetSpot; patch(a.id, { spot, size: DEFAULT_SIZE[spot], opacity: DEFAULT_OPACITY[spot] }); }}>
                {(Object.keys(SPOT_LABEL) as AssetSpot[]).map((k) => <option key={k} value={k}>{SPOT_LABEL[k]}</option>)}
              </select>
              {a.spot !== 'none' && (
                <>
                  {a.spot !== 'header-bg' && (
                    <label className="tp-range sm"><span>Tamaño</span>
                      <input type="range" min={r.min} max={r.max} step={1} value={a.size || DEFAULT_SIZE[a.spot]} onChange={(e) => patch(a.id, { size: Number(e.target.value) })} />
                      <b>{a.size || DEFAULT_SIZE[a.spot]} {r.unit}</b>
                    </label>
                  )}
                  <label className="tp-range sm"><span>{a.spot === 'header-bg' ? 'Visibilidad' : 'Opacidad'}</span>
                    <input type="range" min={3} max={100} step={1} value={a.opacity} onChange={(e) => patch(a.id, { opacity: Number(e.target.value) })} />
                    <b>{a.opacity}%</b>
                  </label>
                </>
              )}
              <button type="button" className="tp-var" title="Copiar para usar en Avanzado"
                onClick={async () => { const t = `var(${assetVar(a)})`; try { await navigator.clipboard.writeText(t); setCopied(a.id); setTimeout(() => setCopied(null), 1500); } catch { /* noop */ } }}>
                <code>var({assetVar(a)})</code> <span>{copied === a.id ? 'copiado ✓' : `${assetKB(a)} KB · copiar`}</span>
              </button>
            </div>
          </div>
        );
      })}
      {assets.length > 0 && (
        <div className={`tp-note${totalKB > 1500 ? ' tp-err' : ''}`}>
          {totalKB > 1500
            ? `Las imágenes suman ${totalKB} KB: el navegador puede quedarse sin lugar para guardar el tema. Usá SVG o imágenes más chicas.`
            : `Las imágenes quedan guardadas dentro del tema (${totalKB} KB): viajan con la plantilla y con el tema exportado.`}
        </div>
      )}
    </div>
  );
};

/* =====================================================================
   Avanzado: reglas CSS propias del tema
   ===================================================================== */
const AdvancedTab: React.FC<{ theme: ReportTheme; onChange: (t: ReportTheme) => void; pageSetup?: PageSetup; onPageSetupChange?: (p: PageSetup) => void }> = ({ theme, onChange, pageSetup, onPageSetupChange }) => {
  const editorRef = useRef<CodeEditorHandle>(null);
  const [draft, setDraft] = useState(theme.customCss || '');
  const [showVars, setShowVars] = useState(false);
  const [showRef, setShowRef] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const applied = useRef(theme.customCss || '');
  // Si el tema cambia desde afuera (otro tema elegido, deshacer), el editor lo refleja
  useEffect(() => {
    const ext = theme.customCss || '';
    if (ext !== applied.current) { applied.current = ext; setDraft(ext); }
  }, [theme.customCss]);

  // Aplicar en vivo, con una pequeña pausa para no recalcular en cada tecla
  useEffect(() => {
    if (draft === applied.current) return;
    const t = setTimeout(() => { applied.current = draft; onChange({ ...themeRef.current, customCss: draft }); }, 350);
    return () => clearTimeout(t);
  }, [draft, onChange]);

  /** Si la respuesta de la IA trae @page, se aplica a la hoja y se saca del CSS */
  const takePage = (css: string): { css: string; pageMsg: string } => {
    if (!pageSetup || !onPageSetupChange) return { css: stripPageRules(css), pageMsg: '' };
    const r = parsePageRule(css, pageSetup);
    if (!r) return { css, pageMsg: '' };
    onPageSetupChange(r.setup);
    const m = r.setup.margins;
    const mm = (n: number) => String(n).replace('.', ',');
    return { css: r.css, pageMsg: ` Hoja: ${pageLabel(r.setup)}, márgenes ${mm(m.t)} / ${mm(m.r)} / ${mm(m.b)} / ${mm(m.l)} mm (se cambia en Ajustes → Hoja).` };
  };

  const assetHints = (theme.assets || []).map((a) => ({ label: assetVar(a), detail: `Imagen ${a.mime.replace('image/', '').replace('svg+xml', 'SVG').toUpperCase()}` }));
  const check = useMemo(() => checkCss(draft, assetHints.map((h) => h.label)), [draft, theme.assets]);
  const varsCss = useMemo(() => buildThemeVars(theme, true).replace(/^:root/, '/* Variables que arma el panel (solo lectura) */\n:root'), [theme]);

  return (
    <div className="tp-adv">
      <div className="tp-note">
        Código que dicta el aspecto de la hoja. Se aplica solo al informe (nunca al editor) y se guarda con el tema y la plantilla.
        Escribí <code>.rp</code> o <code>--rp</code> para ver sugerencias (<kbd>Ctrl</kbd>+<kbd>Espacio</kbd> las abre).
      </div>

      {/* ---- Pedírselo a una IA ---- */}
      <div className="tp-ai">
        <div className="tp-ai-head">
          <Bot />
          <div>
            <b>Diseñar el tema con una IA</b>
            <span>Copiá la guía, escribí en ella cómo lo querés y pegala en ChatGPT, Claude, Gemini… Después pegá acá su respuesta.</span>
          </div>
        </div>
        <div className="tp-actions">
          <button type="button" className="tp-btn primary" onClick={async () => {
            const guide = buildAiGuide({ varsCss, customCss: draft, themeName: theme.name, page: guidePage(pageSetup),
              images: (theme.assets || []).map((a) => ({ varName: assetVar(a), kind: a.mime === 'image/svg+xml' ? 'SVG (vectorial)' : 'Imagen ' + a.mime.replace('image/', '').toUpperCase(), size: `${a.width ?? '?'}×${a.height ?? '?'}` })) });
            try { await navigator.clipboard.writeText(guide); setAiMsg('Guía copiada. Completá “Lo que quiero” y pegala en la IA.'); }
            catch { setAiMsg('No se pudo copiar: usá “Descargar guía”.'); }
          }}><ClipboardCopy /> Copiar guía para IA</button>
          <button type="button" className="tp-btn" onClick={() => {
            const guide = buildAiGuide({ varsCss, customCss: draft, themeName: theme.name, page: guidePage(pageSetup),
              images: (theme.assets || []).map((a) => ({ varName: assetVar(a), kind: a.mime === 'image/svg+xml' ? 'SVG (vectorial)' : 'Imagen ' + a.mime.replace('image/', '').toUpperCase(), size: `${a.width ?? '?'}×${a.height ?? '?'}` })) });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([guide], { type: 'text/markdown;charset=utf-8' }));
            a.download = 'guia-tema-informe.md';
            a.click();
            URL.revokeObjectURL(a.href);
          }}><Download /> Descargar guía (.md)</button>
          <button type="button" className={`tp-btn${aiOpen ? ' on' : ''}`} onClick={() => setAiOpen((v) => !v)}><ClipboardPaste /> Pegar respuesta</button>
        </div>
        {aiOpen && (
          <div className="tp-ai-paste">
            <textarea className="tp-input" rows={5} value={aiAnswer} onChange={(e) => setAiAnswer(e.target.value)}
              placeholder="Pegá acá la respuesta completa de la IA: se toma solo el código CSS." spellCheck={false} />
            <div className="tp-actions">
              <button type="button" className="tp-btn primary" disabled={!aiAnswer.trim()} onClick={() => {
                const { css, pageMsg } = takePage(extractCss(aiAnswer));
                setDraft(css); setAiAnswer(''); setAiOpen(false);
                setAiMsg(`Reglas reemplazadas por las de la IA.${pageMsg} Si no te gusta, Ctrl+Z en el editor o “Deshacer” en Ajustes.`);
              }}>Reemplazar reglas</button>
              <button type="button" className="tp-btn" disabled={!aiAnswer.trim()} onClick={() => {
                const { css, pageMsg } = takePage(extractCss(aiAnswer));
                setDraft((d) => (d.trim() ? `${d.trimEnd()}\n\n${css}` : css)); setAiAnswer(''); setAiOpen(false);
                setAiMsg(`Reglas de la IA agregadas al final.${pageMsg}`);
              }}>Agregar al final</button>
            </div>
          </div>
        )}
        {aiMsg && <div className="tp-note">{aiMsg}</div>}
      </div>

      <details className="tp-adv-imgs" open={(theme.assets || []).length === 0 ? undefined : true}>
        <summary><ImagePlus /> Imágenes del tema ({(theme.assets || []).length}) · cargá acá tus SVG o PNG</summary>
        <ImagesSection theme={theme} onChange={onChange} />
      </details>

      <div className="tp-snips">
        <span>Insertar código de:</span>
        {SNIPPETS.map((sn) => (
          <button key={sn.label} type="button" className="tp-chip" onClick={() => editorRef.current?.insert(sn.css)}>{sn.label}</button>
        ))}
      </div>
      <div className="tp-snips">
        <span><Lightbulb /> Ideas para probar:</span>
        {IDEAS.map((sn) => (
          <button key={sn.label} type="button" className="tp-chip idea" onClick={() => editorRef.current?.insert(sn.css)}>{sn.label}</button>
        ))}
      </div>

      <div className="tp-editor">
        <CodeEditor
          ref={editorRef}
          value={draft}
          onChange={setDraft}
          vars={[...KNOWN_VARS, ...assetHints]}
          selectors={RP_SELECTORS}
          props={CSS_PROPS}
          placeholder={'/* Ej.: títulos con fondo lleno */\n:scope .rp-title {\n  background: var(--rp-primary);\n  color: #fff;\n}'}
        />
      </div>

      <div className={`tp-check-bar ${check.ok ? (check.warnings.length ? 'warn' : 'ok') : 'err'}`}>
        {check.ok ? (
          <>
            {check.warnings.length ? <AlertTriangle /> : <CheckCircle2 />}
            <span>
              {draft.trim() ? `${check.rules} ${check.rules === 1 ? 'regla aplicada' : 'reglas aplicadas'}` : 'Sin reglas propias'}
              {check.warnings.map((w) => <em key={w}> · {w}</em>)}
            </span>
          </>
        ) : (
          <><AlertTriangle /><span>{check.errors.join(' ')}</span></>
        )}
      </div>

      <div className="tp-actions">
        <button type="button" className="tp-btn" onClick={() => setShowVars((v) => !v)}>{showVars ? 'Ocultar' : 'Ver'} variables del tema</button>
        <button type="button" className="tp-btn" onClick={() => setShowRef((v) => !v)}>{showRef ? 'Ocultar' : 'Ver'} elementos con nombre</button>
        {draft.trim() && (
          <button type="button" className="tp-btn danger" onClick={() => { if (window.confirm('¿Borrar todas las reglas propias de este tema?')) setDraft(''); }}>
            <Trash2 /> Borrar reglas
          </button>
        )}
      </div>

      {showRef && (
        <table className="tp-ref">
          <tbody>
            {RP_SELECTORS.map((h) => (
              <tr key={h.label}><td><code>{h.label}</code></td><td>{h.detail}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {showVars && (
        <div className="tp-editor ro">
          <CodeEditor value={varsCss} onChange={() => undefined} readOnly vars={[]} selectors={[]} props={[]} minHeight={200} />
        </div>
      )}
      <div className="tp-note">
        Si una regla no cambia nada, puede que el módulo use un estilo más fuerte: agregá <code>!important</code> al final del valor.
        Para traer una fuente propia por URL usá “Fuente propia (URL)”.
      </div>
    </div>
  );
};

/* =====================================================================
   Panel
   ===================================================================== */

export const ThemePanel: React.FC<ThemePanelProps> = ({ isOpen, theme, onChange, onClose, onWideChange, pageSetup, onPageSetupChange }) => {
  const [tab, setTab] = useState<'basic' | 'advanced'>('basic');
  useEffect(() => { onWideChange?.(isOpen && tab === 'advanced'); }, [isOpen, tab, onWideChange]);
  const [saved, setSaved] = useState<ReportTheme[]>(() => loadSavedThemes());
  const [storeWarn, setStoreWarn] = useState(false);
  const [naming, setNaming] = useState<string | null>(null);
  const [installed, setInstalled] = useState<string[]>([]);
  const [fontMsg, setFontMsg] = useState<string | null>(null);
  const [fileMsg, setFileMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const library = [...BUILT_IN_THEMES, ...saved];
  const base = library.find((t) => t.id === theme.id);
  const dirty = !base || !sameLook(theme, base);

  if (!isOpen) return null;

  const persist = (list: ReportTheme[]) => { setSaved(list); setStoreWarn(!saveThemes(list)); };
  const pick = (t: ReportTheme) => onChange(normalizeTheme(JSON.parse(JSON.stringify(t))));
  const setColor = (k: ThemeColorKey, v: string) => onChange({ ...theme, colors: { ...theme.colors, [k]: v } });
  const setFont = (k: keyof ReportTheme['fonts'], f: ThemeFont) => onChange({ ...theme, fonts: { ...theme.fonts, [k]: f } });

  const saveAsNew = (name: string) => {
    const t: ReportTheme = { ...theme, id: `tema-${Date.now().toString(36)}`, name: name.trim() || 'Mi tema', builtIn: false };
    persist([...saved, t]);
    onChange(t);
    setNaming(null);
  };
  const saveChanges = () => {
    persist(saved.map((t) => (t.id === theme.id ? { ...theme, builtIn: false } : t)));
  };
  const remove = (id: string) => persist(saved.filter((t) => t.id !== id));

  const findFonts = async () => {
    setFontMsg('Buscando…');
    const list = await queryInstalledFonts();
    if (!list) {
      setFontMsg('Este navegador no permite listar las fuentes. Podés escribir el nombre igual (ej. Swis721 Lt BT).');
      return;
    }
    setInstalled(list);
    setFontMsg(`${list.length} fuentes instaladas agregadas a las listas.`);
  };

  const exportTheme = () => {
    const blob = new Blob([JSON.stringify({ ...theme, builtIn: false }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tema_${theme.name.replace(/[^\w-]+/g, '_').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importTheme = (file: File) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const parsed = JSON.parse(String(r.result));
        const t = normalizeTheme(parsed.theme ?? parsed);
        const fresh = { ...t, id: `tema-${Date.now().toString(36)}`, builtIn: false };
        persist([...saved, fresh]);
        onChange(fresh);
        setFileMsg(`Tema “${fresh.name}” importado.`);
      } catch {
        setFileMsg('El archivo no es un tema válido.');
      }
    };
    r.readAsText(file);
  };

  return createPortal(
    <aside className={`tp-panel no-print${tab === 'advanced' ? ' wide' : ''}`} aria-label="Tema del informe">
      <header className="tp-head">
        <div>
          <div className="tp-title">Tema del informe</div>
          <div className="tp-sub">Cambia solo la hoja · se guarda con la plantilla</div>
        </div>
        <button type="button" className="tp-icon-btn" onClick={onClose} title="Cerrar"><X /></button>
      </header>
      <div className="tp-tabs">
        <button type="button" className={tab === 'basic' ? 'on' : ''} onClick={() => setTab('basic')}><SlidersHorizontal /> Ajustes</button>
        <button type="button" className={tab === 'advanced' ? 'on' : ''} onClick={() => setTab('advanced')}>
          <Code2 /> Avanzado{(theme.customCss || '').trim() ? <i className="tp-dot" title="Este tema tiene reglas propias" /> : null}
        </button>
      </div>

      {tab === 'advanced' ? (
        <div className="tp-scroll adv"><AdvancedTab theme={theme} onChange={onChange} pageSetup={pageSetup} onPageSetupChange={onPageSetupChange} /></div>
      ) : (
      <div className="tp-scroll">
        {/* ---- Biblioteca ---- */}
        <Section title="Temas">
          <div className="tp-grid">
            {library.map((t) => {
              const active = t.id === theme.id;
              return (
                <div key={t.id} className={`tp-card${active ? ' active' : ''}`} role="button" tabIndex={0}
                  onClick={() => pick(t)} onKeyDown={(e) => { if (e.key === 'Enter') pick(t); }}>
                  <div className="tp-card-sw">
                    {(['primary', 'accent', 'ind1', 'ind2', 'ind3'] as ThemeColorKey[]).map((k) => <i key={k} style={{ background: t.colors[k] }} />)}
                  </div>
                  <div className="tp-card-name">
                    {active && <Check />}<span>{t.name}</span>
                  </div>
                  {!t.builtIn && (
                    <button type="button" className="tp-card-del" title="Eliminar tema guardado"
                      onClick={(e) => { e.stopPropagation(); remove(t.id); }}><Trash2 /></button>
                  )}
                </div>
              );
            })}
          </div>

          {storeWarn && <div className="tp-note tp-err">No hubo lugar en el navegador para guardar la biblioteca de temas (imágenes muy pesadas). Exportá el tema como archivo o achicá las imágenes.</div>}
          <div className="tp-state">
            <span>
              {base ? <>Basado en <b>{base.name}</b></> : <>Tema <b>{theme.name}</b></>}
              {dirty && <em> · modificado</em>}
            </span>
            {naming === null ? (
              <div className="tp-actions">
                {dirty && base && !base.builtIn && (
                  <button type="button" className="tp-btn primary" onClick={saveChanges}><Save /> Guardar cambios</button>
                )}
                <button type="button" className={`tp-btn${dirty && (!base || base.builtIn) ? ' primary' : ''}`}
                  onClick={() => setNaming(dirty ? `${base?.name ?? theme.name} (mío)` : `${theme.name} (copia)`)}>
                  <Plus /> Guardar como…
                </button>
                {dirty && base && (
                  <button type="button" className="tp-btn" onClick={() => pick(base)} title="Volver al tema guardado"><RotateCcw /> Deshacer</button>
                )}
              </div>
            ) : (
              <form className="tp-actions" onSubmit={(e) => { e.preventDefault(); saveAsNew(naming); }}>
                <input className="tp-input" autoFocus value={naming} onChange={(e) => setNaming(e.target.value)} placeholder="Nombre del tema" />
                <button type="submit" className="tp-btn primary"><Check /> Guardar</button>
                <button type="button" className="tp-btn" onClick={() => setNaming(null)}>Cancelar</button>
              </form>
            )}
          </div>
        </Section>

        {/* ---- Imágenes ---- */}
        <Section title="Imágenes (logo, marca de agua, íconos)">
          <ImagesSection theme={theme} onChange={onChange} />
        </Section>

        {/* ---- Colores ---- */}
        <Section title="Colores">
          {COLOR_GROUPS.map((g) => (
            <div key={g.title} className="tp-group">
              <div className="tp-group-title">{g.title}{g.hint && <span>{g.hint}</span>}</div>
              {g.keys.map(([k, l]) => (k === 'barSub' && theme.barSubAuto ? (
                <div key={k} className="tp-color disabled" title="Se calcula sola a partir de la tarea principal">
                  <span className="tp-swatch" style={{ background: `color-mix(in oklab, ${theme.colors.barMain} 55%, #fff)` }} />
                  <span className="tp-color-label">{l}</span>
                  <span className="tp-hex auto">automático</span>
                </div>
              ) : (
                <ColorRow key={k} label={l} value={theme.colors[k]} onChange={(v) => setColor(k, v)} />
              )))}
              {g.keys.some(([k]) => k === 'barSub') && (
                <label className="tp-check">
                  <input type="checkbox" checked={!!theme.barSubAuto} onChange={(e) => onChange({ ...theme, barSubAuto: e.target.checked })} />
                  <span>Subtarea = versión más clara de la tarea principal</span>
                </label>
              )}
            </div>
          ))}
        </Section>

        {/* ---- Fuentes ---- */}
        <Section title="Fuentes">
          <FontField label="Texto" kind="body" font={theme.fonts.body} installed={installed} bodyFamily={theme.fonts.body.family} onChange={(f) => setFont('body', f)} />
          <FontField label="Títulos de sección" kind="title" font={theme.fonts.title} installed={installed} bodyFamily={theme.fonts.body.family} onChange={(f) => setFont('title', f)} />
          <FontField label="Números y códigos" kind="num" font={theme.fonts.num} installed={installed} bodyFamily={theme.fonts.body.family} onChange={(f) => setFont('num', f)} />
          <div className="tp-findfonts">
            <button type="button" className="tp-btn" onClick={findFonts}><Search /> Buscar fuentes instaladas en este equipo</button>
            {fontMsg && <div className="tp-note">{fontMsg}</div>}
            <div className="tp-note">
              Las fuentes del sistema se ven en los equipos que las tienen instaladas. Al imprimir o guardar en PDF desde tu equipo quedan
              incluidas en el PDF. Elegí un reemplazo parecido para cuando el informe se abra en otra computadora.
            </div>
          </div>
        </Section>

        {/* ---- Forma ---- */}
        <Section title="Forma">
          <label className="tp-range">
            <span>Redondeo de esquinas</span>
            <input type="range" min={0} max={16} step={1} value={theme.radius}
              onChange={(e) => onChange({ ...theme, radius: Number(e.target.value) })} />
            <b>{theme.radius} px</b>
          </label>
        </Section>

        {/* ---- Hoja ---- */}
        {pageSetup && onPageSetupChange && <PageSection value={pageSetup} onChange={onPageSetupChange} />}

        {/* ---- Archivo ---- */}
        <Section title="Compartir" defaultOpen={false}>
          <div className="tp-actions">
            <button type="button" className="tp-btn" onClick={exportTheme}><Download /> Exportar tema</button>
            <button type="button" className="tp-btn" onClick={() => fileRef.current?.click()}><Upload /> Importar tema</button>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importTheme(f); e.target.value = ''; }} />
          </div>
          {fileMsg && <div className="tp-note">{fileMsg}</div>}
          <div className="tp-note">Al guardar una plantilla se guarda también el tema actual; al cargarla, el informe toma su tema.</div>
        </Section>
      </div>
      )}
    </aside>,
    document.body
  );
};
