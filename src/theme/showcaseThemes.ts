import type { ThemeColorKey, ThemeFont } from './themes';

/**
 * Temas de fábrica con estilos radicalmente distintos. Muestran hasta dónde llegan los
 * temas: colores, tipografías, formas y reglas propias (apartado Avanzado). Cada uno es
 * solo datos: se pueden duplicar y modificar desde el panel de Temas.
 */
export interface ShowcaseSpec {
  id: string;
  name: string;
  colors: Omit<Record<ThemeColorKey, string>, 'obsInfo' | 'obsWarn' | 'obsCritical' | 'obsOk'> & Partial<Record<'obsInfo' | 'obsWarn' | 'obsCritical' | 'obsOk', string>>;
  fonts: { body: ThemeFont; title: ThemeFont; num?: ThemeFont };
  radius: number;
  css: string;
}

const g = (family: string): ThemeFont => ({ family, source: 'google' });

export const SHOWCASE: ShowcaseSpec[] = [
  /* ---------- Editorial: revista / papel crema, serif, filetes finos ---------- */
  {
    id: 'editorial', name: 'Editorial (serif y filetes)',
    colors: {
      primary: '#1c1a17', primaryDark: '#000000', primarySoft: '#f1ebdd', label: '#7a6a52', accent: '#b4452c',
      titleText: '#1c1a17', titleBorder: '#1c1a17', titleBg1: '#fbf8f1', titleBg2: '#fbf8f1',
      ind1: '#7a6a52', ind2: '#b4452c', ind3: '#4d6b4a', real: '#4d6b4a',
      barMain: '#1c1a17', barSub: '#7a6a52',
      thBg: '#efe6d2', thText: '#1c1a17', border: '#cfc3aa',
      surface1: '#fbf8f1', surface2: '#f4eedf', line: '#e3d9c4',
      highlightBg: '#f4eedf', highlightBorder: '#cfc3aa', text: '#2b2620',
    },
    fonts: { body: g('Lora'), title: g('Playfair Display') },
    radius: 0,
    css: `:scope { background: #fbf8f1; }
:scope .rp-cover, :scope .rp-footer { background: transparent; }
:scope .rp-header { background: transparent; color: #1c1a17; border-bottom: 3px double #1c1a17; padding-bottom: 4mm; }
:scope .rp-header-director { color: #7a6a52; letter-spacing: .25em; font-weight: 500; }
:scope .rp-header-project { color: #1c1a17; font-size: 17pt; font-weight: 700; }
:scope .rp-header-report { color: #b4452c; font-style: italic; text-transform: none; letter-spacing: .02em; font-weight: 500; font-size: 12pt; }
:scope .rp-header-date, :scope .rp-header-line-md { color: #7a6a52; }
:scope .rp-hd-logo-empty { border-color: #cfc3aa; color: #a39378; }
:scope .rp-title { background: none; border: 0; border-top: 2px solid #1c1a17; border-bottom: 1px solid #1c1a17; border-radius: 0; box-shadow: none; }
:scope .rp-title-text { text-transform: uppercase; letter-spacing: .22em; font-size: 9.5pt; font-weight: 600; color: #1c1a17; }
:scope .rp-title-num { color: #b4452c; font-style: italic; }
:scope .rp-md-h1, :scope .rp-md-h2 { font-family: var(--rp-font-title); color: #1c1a17; }
:scope .rp-md p { text-align: justify; hyphens: auto; }
:scope .rp-md-quote, :scope .rp-obs--quote { border-left: 3px solid #b4452c; font-style: italic; }`,
  },

  /* ---------- Neón noche: hoja oscura con acentos fluorescentes ---------- */
  {
    id: 'neon', name: 'Neón noche (hoja oscura)',
    colors: {
      primary: '#ff2d95', primaryDark: '#1a0f3c', primarySoft: '#1c1440', label: '#7df9ff', accent: '#f9f871',
      titleText: '#7df9ff', titleBorder: '#7df9ff', titleBg1: '#140c33', titleBg2: '#140c33',
      ind1: '#7df9ff', ind2: '#f9f871', ind3: '#ff2d95', real: '#39ff9c',
      barMain: '#ff2d95', barSub: '#7df9ff',
      thBg: '#241a55', thText: '#7df9ff', border: '#4a3a96',
      surface1: '#0c0720', surface2: '#140c33', line: '#2a1f60',
      highlightBg: '#1c1440', highlightBorder: '#4a3a96', text: '#e8e4ff',
      obsInfo: '#7df9ff', obsWarn: '#f9f871', obsCritical: '#ff2d95', obsOk: '#39ff9c',
    },
    fonts: { body: g('Space Grotesk'), title: g('Orbitron') },
    radius: 6,
    css: `:scope { background: #0c0720; color: #e8e4ff; }
:scope .rp-cover, :scope .rp-footer { background: transparent; }
:scope .rp-header { background: linear-gradient(120deg, #1a0f3c, #3a1170 55%, #ff2d95 160%); border-bottom: 2px solid #7df9ff; box-shadow: 0 0 18px #7df9ff66; }
:scope .rp-header-project { text-shadow: 0 0 10px #7df9ff; letter-spacing: .04em; }
:scope .rp-header-report { text-shadow: 0 0 10px #f9f871; }
:scope .rp-title { background: transparent; border: 1px solid #7df9ff; box-shadow: 0 0 10px #7df9ff55, inset 0 0 10px #7df9ff22; }
:scope .rp-title-text { color: #7df9ff; letter-spacing: .2em; text-transform: uppercase; text-shadow: 0 0 8px #7df9ff; }
:scope .rp-title-num { color: #ff2d95; text-shadow: 0 0 8px #ff2d95; }
:scope .rp-table, :scope .rp-card, :scope .rp-photo { background: #140c33; border-color: #4a3a96; }
:scope .rp-table td { color: #e8e4ff; border-color: #2a1f60; }
:scope .rp-md-h1, :scope .rp-md-h2, :scope .rp-md-h3 { color: #f9f871; font-family: var(--rp-font-title); }
:scope .rp-footer, :scope .rp-footer * { color: #8f86c9; }`,
  },

  /* ---------- Máquina de escribir: monoespaciada, blanco y negro, sin adornos ---------- */
  {
    id: 'maquina', name: 'Máquina de escribir (memo)',
    colors: {
      primary: '#111111', primaryDark: '#000000', primarySoft: '#efefea', label: '#444444', accent: '#111111',
      titleText: '#111111', titleBorder: '#111111', titleBg1: '#fdfcf8', titleBg2: '#fdfcf8',
      ind1: '#444444', ind2: '#888888', ind3: '#111111', real: '#111111',
      barMain: '#111111', barSub: '#666666',
      thBg: '#ecebe4', thText: '#111111', border: '#111111',
      surface1: '#fdfcf8', surface2: '#f4f3ec', line: '#cfcdc2',
      highlightBg: '#f4f3ec', highlightBorder: '#111111', text: '#111111',
    },
    fonts: { body: g('Special Elite'), title: g('Special Elite'), num: g('Special Elite') },
    radius: 0,
    css: `:scope { background: #fdfcf8; }
:scope .rp-cover, :scope .rp-footer { background: transparent; }
:scope .rp-header { background: transparent; color: #111; border: 2px solid #111; margin: 6mm 8mm 2mm; padding: 4mm; }
:scope .rp-header-director, :scope .rp-header-project, :scope .rp-header-report, :scope .rp-header-date, :scope .rp-header-line-md { color: #111; }
:scope .rp-header-report { letter-spacing: .3em; text-decoration: underline; text-underline-offset: 4px; }
:scope .rp-hd-logo-empty { border-color: #111; color: #111; }
:scope .rp-title { background: none; border: 0; border-bottom: 1.5px dashed #111; border-radius: 0; box-shadow: none; }
:scope .rp-title-row { justify-content: flex-start; }
:scope .rp-title-text { text-transform: uppercase; letter-spacing: .15em; font-weight: 400; }
:scope .rp-md { font-size: 10.5pt; line-height: 1.6; }
:scope .rp-md-h1, :scope .rp-md-h2 { text-transform: uppercase; letter-spacing: .1em; }
:scope .rp-table { border: 1.5px solid #111; }
:scope .rp-md-table td, :scope .rp-md-table th { border: 1px solid #111; }`,
  },

  /* ---------- Pop festivo: colores planos, bordes gruesos, sombras duras ---------- */
  {
    id: 'pop', name: 'Pop festivo (bordes gruesos)',
    colors: {
      primary: '#e63946', primaryDark: '#7a0c16', primarySoft: '#ffe3e5', label: '#1d3557', accent: '#ffd166',
      titleText: '#1d3557', titleBorder: '#1d3557', titleBg1: '#ffd166', titleBg2: '#ffd166',
      ind1: '#1d3557', ind2: '#ffb703', ind3: '#2a9d8f', real: '#2a9d8f',
      barMain: '#e63946', barSub: '#1d3557',
      thBg: '#a8dadc', thText: '#1d3557', border: '#1d3557',
      surface1: '#fff8e7', surface2: '#ffefc7', line: '#1d3557',
      highlightBg: '#ffefc7', highlightBorder: '#1d3557', text: '#1d3557',
    },
    fonts: { body: g('Nunito Sans'), title: g('Lilita One') },
    radius: 14,
    css: `:scope { background: #fff8e7; }
:scope .rp-cover, :scope .rp-footer { background: transparent; }
:scope .rp-header { background: #e63946; border: 3px solid #1d3557; border-radius: 16px; margin: 5mm 6mm 2mm; box-shadow: 5px 5px 0 #1d3557; }
:scope .rp-header-project { font-family: var(--rp-font-title); font-size: 17pt; letter-spacing: .02em; text-shadow: 2px 2px 0 #1d3557; }
:scope .rp-header-report { color: #ffd166; font-family: var(--rp-font-title); font-size: 13pt; }
:scope .rp-title { border: 3px solid #1d3557; box-shadow: 4px 4px 0 #1d3557; transform: rotate(-.6deg); }
:scope .rp-title-text { font-family: var(--rp-font-title); font-size: 12pt; letter-spacing: .04em; color: #1d3557; }
:scope .rp-title-num { color: #e63946; }
:scope .rp-card, :scope .rp-table, :scope .rp-photo, :scope .rp-obs { border: 2.5px solid #1d3557 !important; box-shadow: 3px 3px 0 #1d3557; }
:scope .rp-md-h1, :scope .rp-md-h2, :scope .rp-md-h3 { font-family: var(--rp-font-title); color: #e63946; }
:scope .rp-md-mark { background: #ffd166; }`,
  },

  /* ---------- Suizo: blanco, negro, rojo y mucho aire; rejilla y mayúsculas ---------- */
  {
    id: 'suizo', name: 'Minimal suizo (negro y rojo)',
    colors: {
      primary: '#111111', primaryDark: '#000000', primarySoft: '#f2f2f2', label: '#111111', accent: '#e10600',
      titleText: '#111111', titleBorder: '#111111', titleBg1: '#ffffff', titleBg2: '#ffffff',
      ind1: '#111111', ind2: '#e10600', ind3: '#777777', real: '#e10600',
      barMain: '#111111', barSub: '#999999',
      thBg: '#ffffff', thText: '#111111', border: '#111111',
      surface1: '#ffffff', surface2: '#f5f5f5', line: '#d9d9d9',
      highlightBg: '#f5f5f5', highlightBorder: '#111111', text: '#111111',
    },
    fonts: { body: g('Inter'), title: g('Archivo') },
    radius: 0,
    css: `:scope { background: #fff; }
:scope .rp-header { background: #fff; color: #111; border-top: 10px solid #e10600; padding: 6mm 8mm 4mm; align-items: flex-end; }
:scope .rp-header-titles { text-align: left; padding: 0; }
:scope .rp-header-director { color: #111; font-weight: 800; letter-spacing: .15em; font-size: 7pt; }
:scope .rp-header-project { color: #111; font-size: 22pt; font-weight: 900; line-height: .95; letter-spacing: -.02em; text-transform: uppercase; }
:scope .rp-header-report { color: #e10600; font-size: 11pt; letter-spacing: .1em; }
:scope .rp-header-date, :scope .rp-header-line-md { color: #555; }
:scope .rp-hd-logo-empty { border-color: #111; color: #111; }
:scope .rp-title { background: none; border: 0; border-top: 3px solid #111; border-radius: 0; box-shadow: none; padding-top: 2px; }
:scope .rp-title-row { justify-content: flex-start; }
:scope .rp-title-text { text-transform: uppercase; font-weight: 900; letter-spacing: .08em; font-size: 10pt; }
:scope .rp-title-num { color: #e10600; }
:scope .rp-table { border: 0; border-top: 2px solid #111; border-bottom: 2px solid #111; }
:scope .rp-md-h1, :scope .rp-md-h2 { text-transform: uppercase; font-weight: 900; letter-spacing: -.01em; }`,
  },
];
