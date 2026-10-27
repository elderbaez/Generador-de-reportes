import React from 'react';
import { PhotoItem } from '../../types';

interface PhotosBlockProps {
  photos: PhotoItem[];
  columns?: 1 | 2 | 3 | 4;
  heightMm?: number;
  title?: string;
}

export const PhotosBlock: React.FC<PhotosBlockProps> = ({
  photos,
  columns = 2,
  heightMm = 70,
  title = 'REGISTRO FOTOGRÁFICO DE SITUACIÓN ACTUAL',
}) => {
  const getGridColsClass = () => {
    switch (columns) {
      case 1:
        return 'grid-cols-1';
      case 3:
        return 'grid-cols-3';
      case 4:
        return 'grid-cols-4';
      case 2:
      default:
        return 'grid-cols-2';
    }
  };

  return (
    <section className="photos-block-container px-5 py-2 shrink-0 select-none break-inside-avoid">
      {/* Section Title */}
      <div className="w-full text-center font-bold text-[9pt] text-[#174b60] tracking-wider uppercase py-1 px-4 bg-gradient-to-r from-slate-100 via-sky-50 to-slate-100 border border-[#b8cbd4] rounded-lg mb-2 shadow-2xs">
        {title}
      </div>

      {photos.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-lg p-6 text-center text-slate-400 text-[8pt] italic bg-slate-50/50">
          No se han adjuntado fotografías para esta sección. Sube imágenes desde el editor lateral.
        </div>
      ) : (
        <div className={`grid ${getGridColsClass()} gap-3`}>
          {photos.map((ph, idx) => (
            <div
              key={ph.id || idx}
              className="photo-card break-inside-avoid border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs flex flex-col"
            >
              <div
                className="w-full bg-slate-900 flex items-center justify-center overflow-hidden"
                style={{ height: `${heightMm}mm` }}
              >
                <img
                  src={ph.src}
                  alt={ph.caption || `Fotografía de obra ${idx + 1}`}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
              </div>
              <div className="py-1 px-2.5 bg-slate-50 border-t border-slate-200 text-[7.5pt] text-slate-700 text-center font-medium leading-tight min-h-[5.5mm] flex items-center justify-center">
                {ph.caption || `Fotografía ${idx + 1}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
