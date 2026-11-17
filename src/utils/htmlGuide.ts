/* =====================================================================
   Guía para que una IA arme el HTML/SVG del módulo "HTML / SVG" de modo
   que se vea como parte del informe (colores, letras, medidas del tema).
   Se arma con los valores ACTUALES del tema y el ancho real del módulo.
   ===================================================================== */
import { KNOWN_VARS } from '../theme/advanced';
import { blockInnerWidthMm, getPageSetup, pageLabel } from './pageSetup';
import { getReportData } from './fields';

export function buildHtmlGuide(): string {
  const sheet = document.querySelector('.a4-sheet') || document.documentElement;
  const cs = getComputedStyle(sheet);
  const vars = KNOWN_VARS
    .map((v) => ({ ...v, value: cs.getPropertyValue(v.label).trim() }))
    .filter((v) => v.value && !/^--rp-(title-|obs-)/.test(v.label) || ['--rp-obs-critical', '--rp-obs-ok', '--rp-obs-warn'].includes(v.label));
  const width = Math.round(blockInnerWidthMm() - 2);
  const widthPx = Math.round((width * 96) / 25.4);

  return `# Guía para armar un gráfico o tarjeta en HTML/SVG para un informe

Necesito que escribas un fragmento de **HTML y/o SVG** que va dentro de un informe técnico impreso (hoja ${pageLabel(getPageSetup())}). Se pega en un módulo que lo dibuja en la hoja con los colores y letras del informe.

## Lo que quiero
> ✏️ **Describí acá qué querés mostrar** (por ejemplo: "cronograma de estas tareas con estas fechas", "tarjetas con 4 indicadores", "comparación de presupuesto por rubro") y **pegá los datos**:
>
> _…_

## Reglas (si no se cumplen, se borra o no se ve)
1. **Solo un fragmento**: nada de \`<html>\`, \`<head>\`, \`<body>\`. Podés usar \`<style>\` (se aplica solo a este módulo) y SVG en línea.
2. **Sin scripts ni interacción**: \`<script>\`, \`onclick\`, \`<iframe>\`, \`<form>\`, \`<input>\`, \`<button>\` se eliminan. Tiene que verse completo sin JavaScript. Nada de animaciones ni efectos al pasar el mouse: es para imprimir.
3. **Sin recursos externos**: ni fuentes de Google, ni imágenes por URL, ni \`@import\`. Si necesitás un ícono, dibujalo en SVG.
4. **No pongas título ni pie de figura**: el módulo ya tiene su barra de título y un pie numerado ("Figura 03 - …").
5. **Calculá los datos vos**: si hay fechas o valores, calculá las posiciones (porcentajes de \`left\`/\`width\`, alturas de barras) y escribilas ya resueltas. Dejá un comentario breve de cómo se calcularon.

## Espacio disponible
- Ancho útil: **${width} mm** (≈ ${widthPx} px a 96 ppp). Usá \`width: 100%\` o porcentajes; nunca un ancho fijo mayor.
- Alto: idealmente **menos de 180 mm** (tiene que entrar en una hoja junto al título y el pie).
- Unidades: \`mm\` y \`pt\` para medidas y letras (es papel). En un SVG con \`viewBox\`, las letras se miden en unidades del dibujo: con \`viewBox="0 0 ${widthPx} …"\` y \`width="100%"\`, 1 unidad ≈ 1 px y una letra de 10–11 unidades se lee como ~8 pt.

## Datos del informe (se completan solos)
Podés escribir estas marcas y el programa las reemplaza antes de dibujar, con los datos del informe:
- \`{fecha}\` → fecha de toma de datos (03/11/2026) · \`{fecha_corta}\` → 03/11/26
- \`{pos:2026-10-01:2027-07-01}\` → dónde cae la fecha de toma de datos entre esas dos fechas, en % (por ejemplo \`12.09\`). Usalo para la línea de "hoy" de un cronograma: \`style="left:{pos:INICIO:FIN}%"\`, con INICIO y FIN = el comienzo y el final de la escala de tiempo, en formato aaaa-mm-dd.
- \`{logo}\` y \`{logo_derecho}\` → los logos de Datos generales, para un encabezado propio: \`<img src="{logo}">\`
- \`{obra}\`, \`{titulo}\`, \`{contrato}\`, \`{contratista}\`, \`{direccion}\`
- \`{avance:1.0}\` o \`{avance:Movimiento de suelos}\` → % de avance de ese rubro del módulo de situación actual (número con punto, por ejemplo \`65\`), por código o por el comienzo del nombre. \`{avance_fisico}\`, \`{avance_financiero}\`, \`{plazo}\` → % del contrato. Para una barra de avance real dentro de otra: \`style="width:calc(30% * {avance:1.0} / 100)"\`.
${(getReportData()?.fields || []).length ? `- Campos propios del informe: ${(getReportData()?.fields || []).map((f) => `\`{${f.key}}\` (${f.label}${f.value ? `: ${f.value}` : ''})`).join(', ')}\n` : ''}Así el gráfico se actualiza solo en cada informe semanal. Los datos escritos como texto (por ejemplo \`<td>{vertice}</td>\`) además se pueden cambiar con un clic en la hoja: usalos para todo lo que el usuario tenga que completar, en vez de escribir el valor fijo.

## Que se vea como el resto del informe
- **Colores**: usá SIEMPRE las variables del tema (\`var(--rp-…)\`), así si el usuario cambia el tema el gráfico cambia con él. Poné un respaldo por si acaso: \`var(--rp-primary, ${cs.getPropertyValue('--rp-primary').trim() || '#0b455b'})\`. En SVG van como atributo: \`fill="var(--rp-primary)"\`.
- **Letras**: no cambies la familia (se hereda la del informe). Si la necesitás explícita: \`var(--rp-font-body)\`, títulos \`var(--rp-font-title)\`, números \`var(--rp-font-num)\` con \`font-variant-numeric: tabular-nums\`.
- **Tamaños de letra del informe**: texto de tablas y datos **7–8 pt**, rótulos chicos en mayúsculas **6,5 pt** con \`letter-spacing: .04em\`, cifras destacadas **14–22 pt** en negrita.
- **Formas**: esquinas con \`var(--rp-radius)\` (o \`var(--rp-radius-sm)\`), bordes de 1 px con \`var(--rp-line)\` o \`var(--rp-border)\`, fondos suaves con \`var(--rp-surface-1)\` / \`var(--rp-surface-2)\`.
- **Sombras**: como mucho \`box-shadow\` muy suave. **Nada de \`filter\`** (\`drop-shadow\`, \`blur\`): al imprimir convierte todo en imagen borrosa.
- **Clases**: empezalas con un prefijo propio (por ejemplo \`.gx-\`) y no le des estilo a \`html\`, \`body\`, \`:root\` ni a etiquetas sueltas como \`div\` o \`table\`.

## Variables del tema (valores actuales)
| Variable | Para qué | Valor |
|---|---|---|
${vars.map((v) => `| \`${v.label}\` | ${v.detail} | \`${v.value}\` |`).join('\n')}

Paleta sugerida para series (en este orden): \`--rp-primary\`, \`--rp-accent\`, \`--rp-ind-1\`, \`--rp-ind-3\`, \`--rp-ind-2\`, \`--rp-label\`, \`--rp-real\`. Rojo de alerta: \`--rp-obs-critical\`; verde de conforme: \`--rp-obs-ok\`.

## Ejemplo del estilo esperado
\`\`\`html
<style>
.gx { display: grid; grid-template-columns: 38mm 1fr 12mm; gap: 2mm 3mm; align-items: center; font-size: 7.5pt; color: var(--rp-text); }
.gx-lbl { font-weight: 600; }
.gx-trk { height: 4mm; background: var(--rp-surface-2); border-radius: var(--rp-radius-sm); overflow: hidden; }
.gx-bar { height: 100%; border-radius: var(--rp-radius-sm); }
.gx-val { text-align: right; font-weight: 800; color: var(--rp-primary); font-variant-numeric: tabular-nums; }
</style>
<div class="gx">
  <span class="gx-lbl">Estructura</span><div class="gx-trk"><div class="gx-bar" style="width:62%;background:var(--rp-primary)"></div></div><span class="gx-val">62 %</span>
  <span class="gx-lbl">Instalaciones</span><div class="gx-trk"><div class="gx-bar" style="width:35%;background:var(--rp-accent)"></div></div><span class="gx-val">35 %</span>
</div>
\`\`\`

## Respuesta
Devolvé **un solo bloque de código \`\`\`html** con el fragmento completo, listo para pegar. Fuera del bloque, como mucho dos renglones explicando qué hiciste.
`;
}
