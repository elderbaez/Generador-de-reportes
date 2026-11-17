import React from 'react';
import { SectionHeaderBanner } from '../SectionHeaderBanner';
import { Sparkles } from 'lucide-react';
import { ChunkedRichText } from '../RichText';
import { RichEditor } from '../FormatBar';
import { EditDock, DockGroup, DockSegmented } from '../EditDock';

interface TextBlockProps {
  blockId: string;
  title: string;
  numberIndex?: number | null;
  showTitle?: boolean;
  content?: string;
  isEditing?: boolean;
  /** Tramo del texto que va en esta hoja, si el bloque se reparte en varias. */
  part?: { from: number; to: number; index: number; count: number };
  onUpdateTitle?: (title: string) => void;
  onToggleShowTitle?: () => void;
  onUpdateContent?: (content: string) => void;
  onStartEditing?: () => void;
  /** Corta el bloque en dos en el cursor (para insertar algo en medio de un texto). */
  onSplit?: (before: string, after: string) => void;
  /** Tamaño de letra propio (pt); sin definir = el del tema (10 pt) */
  sizePt?: number;
  onChangeSize?: (pt: number | undefined) => void;
}

const SIZES = [8, 9, 10, 11, 12];

const PRESET_SNIPPETS = [
  {
    label: 'Condiciones climáticas',
    text: 'Condiciones climáticas: Jornadas laborales sin precipitaciones significativas. Clima favorable que permitió el normal desarrollo de las tareas a cielo abierto y trabajos en altura.',
  },
  {
    label: 'Seguridad y Salud',
    text: 'Seguridad y Salud Ocupacional: Se verificó el uso obligatorio de EPP completo (arnés de seguridad con doble cabo de vida, casco dieléctrico y calzado de seguridad). Se realizaron charlas de 5 minutos al inicio de cada jornada.',
  },
  {
    label: 'Ecuación',
    text: 'Momento máximo en viga simplemente apoyada: $$M_{max} = \\frac{q \\, L^2}{8}$$ con $q$ = carga distribuida y $L$ = luz libre.',
  },
  {
    label: 'Control de Calidad',
    text: 'Control de Calidad: Se tomaron muestras para ensayos de resistencia a la compresión y se verificó el curado húmedo de las superficies intervenidas conforme a las especificaciones técnicas vigentes.',
  },
];

export const TextBlock: React.FC<TextBlockProps> = ({
  blockId,
  title,
  numberIndex,
  showTitle = true,
  content = '',
  isEditing = false,
  part,
  onUpdateTitle,
  onToggleShowTitle,
  onUpdateContent,
  onStartEditing,
  onSplit,
  sizePt,
  onChangeSize,
}) => {
  const sizeStyle = sizePt ? { fontSize: `${sizePt}pt` } : undefined;
  const isCont = !!part && part.index > 0;
  return (
    <div
      className={`text-block relative px-5 py-2${
        part ? ` is-split${isCont ? ' is-cont' : ''}${part.index < part.count - 1 ? ' has-next' : ''}` : ''
      }`}
    >
      {/* La continuación en otra hoja no repite el título */}
      {!isCont && (
        <SectionHeaderBanner
          numberIndex={numberIndex}
          title={title}
          isEditing={isEditing}
          showTitle={showTitle}
          onUpdateTitle={onUpdateTitle}
          onToggleShowTitle={onToggleShowTitle}
          onStartEditing={onStartEditing}
        />
      )}

      {isEditing ? (
        <div className="rp-text-body text-slate-800 leading-relaxed text-justify font-normal" style={sizeStyle}>
          {onChangeSize && (
            <EditDock slot="options">
              <DockGroup label="Letra">
                <DockSegmented<string>
                  value={sizePt ? String(sizePt) : 'tema'}
                  options={[{ value: 'tema', label: 'Del tema' }, ...SIZES.map((s) => ({ value: String(s), label: `${s}` }))]}
                  onChange={(v) => onChangeSize(v === 'tema' ? undefined : Number(v))}
                />
                <span className="dock-label">pt</span>
              </DockGroup>
            </EditDock>
          )}
          <RichEditor
            value={content}
            onChange={(v) => onUpdateContent?.(v)}
            onSplit={onSplit}
            placeholder="Escriba aquí la memoria descriptiva, notas de fiscalización o narrativa de obra… También puede pegar la respuesta de ChatGPT, Claude o Gemini."
          />

          {/* Quick preset insertion */}
          <div className="no-print flex items-center gap-1.5 flex-wrap mt-3 pt-1.5 border-t border-slate-100 text-[10px] text-left">
            <span className="text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Plantillas rápidas:</span>
            </span>
            {PRESET_SNIPPETS.map((snippet, sIdx) => (
              <button
                key={sIdx}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const newText = content.trim() ? `${content.trim()}\n\n${snippet.text}` : snippet.text;
                  onUpdateContent?.(newText);
                }}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium transition-colors cursor-pointer"
              >
                + {snippet.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* View / Print Mode */
        <div className="rp-text-body text-slate-800 leading-relaxed text-justify font-normal" style={sizeStyle}>
          {content.trim() ? (
            <ChunkedRichText text={content} measureId={blockId} from={part?.from} to={part?.to} />
          ) : (
            <p className="no-print text-slate-400 italic">
              (Bloque de texto sin contenido. Haga doble clic para ingresar memoria técnica o notas).
            </p>
          )}
        </div>
      )}
    </div>
  );
};
