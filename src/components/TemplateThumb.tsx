import React from 'react';
import type { BlockConfig } from '../types';

/**
 * Miniatura esquemática de una plantilla: dibuja cada bloque como un croquis
 * (cabecera, texto, fotos, tabla, gráfico…) sobre una hoja en proporción A4.
 * No renderiza el informe real: es liviano y no depende de los datos.
 */

const BRAND = '#0b455b';
const GOLD = '#f4c84a';
const LINE = '#cbd5e1';
const SOFT = '#e2e8f0';

const Lines: React.FC<{ n: number; last?: number }> = ({ n, last = 60 }) => (
  <div className="flex flex-col gap-[3px]">
    {Array.from({ length: n }).map((_, i) => (
      <div key={i} style={{ height: 2.5, background: LINE, borderRadius: 2, width: i === n - 1 ? `${last}%` : '100%' }} />
    ))}
  </div>
);

const Title: React.FC<{ w?: number }> = ({ w = 45 }) => (
  <div style={{ height: 5, width: `${w}%`, background: BRAND, borderRadius: 2, marginBottom: 4 }} />
);

const Table: React.FC<{ rows: number }> = ({ rows }) => (
  <div style={{ border: `1px solid ${LINE}`, borderRadius: 2, overflow: 'hidden' }}>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex" style={{ height: 7, background: i === 0 ? BRAND : i % 2 ? '#f8fafc' : '#fff', borderTop: i ? `1px solid ${SOFT}` : undefined }}>
        <div style={{ flex: 3, borderRight: `1px solid ${SOFT}` }} />
        <div style={{ flex: 2, borderRight: `1px solid ${SOFT}` }} />
        <div style={{ flex: 1 }} />
      </div>
    ))}
  </div>
);

const Photos: React.FC<{ cols: number }> = ({ cols }) => (
  <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
    {Array.from({ length: cols * 2 }).map((_, i) => (
      <div key={i} style={{ height: 22, background: SOFT, borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: '15%', bottom: 0, width: '45%', height: '55%', background: LINE, clipPath: 'polygon(0 100%, 50% 0, 100% 100%)' }} />
        <div style={{ position: 'absolute', right: '14%', top: '16%', width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />
      </div>
    ))}
  </div>
);

function sketch(b: BlockConfig, photoCols: number): React.ReactNode {
  switch (b.type) {
    case 'header':
      return (
        <div style={{ background: BRAND, borderRadius: 2, padding: '5px 6px' }} className="flex flex-col items-center gap-[3px]">
          <div style={{ height: 2.5, width: '40%', background: 'rgba(255,255,255,.55)', borderRadius: 2 }} />
          <div style={{ height: 4, width: '75%', background: '#fff', borderRadius: 2 }} />
          <div style={{ height: 3.5, width: '50%', background: GOLD, borderRadius: 2 }} />
        </div>
      );
    case 'cover':
      return (
        <div style={{ background: BRAND, borderRadius: 2, height: 95 }} className="flex flex-col justify-end gap-[4px] p-[8px]">
          <div style={{ height: 3, width: '35%', background: GOLD, borderRadius: 2 }} />
          <div style={{ height: 6, width: '80%', background: '#fff', borderRadius: 2 }} />
          <div style={{ height: 3, width: '55%', background: 'rgba(255,255,255,.6)', borderRadius: 2 }} />
        </div>
      );
    case 'toc':
      return (
        <div className="flex flex-col gap-[4px]">
          <Title w={30} />
          {[80, 70, 75, 60].map((w, i) => (
            <div key={i} className="flex items-center gap-[3px]">
              <div style={{ height: 2.5, width: `${w}%`, background: LINE, borderRadius: 2 }} />
              <div style={{ flex: 1, borderTop: `1px dotted ${LINE}` }} />
            </div>
          ))}
        </div>
      );
    case 'photos':
      return <><Title w={50} /><Photos cols={b.photoColumns ?? photoCols} /></>;
    case 'specs':
    case 'pending':
    case 'situation':
      return <><Title w={55} /><Table rows={b.type === 'situation' ? 6 : 4} /></>;
    case 'contract_metrics':
      return (
        <div className="grid gap-[4px]" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Lines n={4} />
          <div className="flex flex-col gap-[4px] justify-center">
            {[70, 45, 60].map((w, i) => (
              <div key={i} style={{ height: 4, background: SOFT, borderRadius: 2 }}>
                <div style={{ height: 4, width: `${w}%`, background: i === 1 ? GOLD : BRAND, borderRadius: 2 }} />
              </div>
            ))}
          </div>
        </div>
      );
    case 'scurve':
      return (
        <><Title w={50} />
          <svg viewBox="0 0 100 40" width="100%" height="38" preserveAspectRatio="none" style={{ background: '#f8fafc', border: `1px solid ${LINE}`, borderRadius: 2 }}>
            <path d="M0 38 C 30 38, 40 4, 100 2" fill="none" stroke={BRAND} strokeWidth="2" />
            <path d="M0 38 C 35 36, 55 14, 100 8" fill="none" stroke={GOLD} strokeWidth="2" strokeDasharray="3 2" />
          </svg></>
      );
    case 'weather':
      return (
        <><Title w={50} />
          <div className="grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} style={{ height: 20, background: i % 3 === 2 ? '#bfdbfe' : '#fef3c7', borderRadius: 2 }} />
            ))}
          </div></>
      );
    case 'gantt':
      return (
        <><Title w={50} />
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 2, padding: 3 }} className="flex flex-col gap-[3px]">
            {[[0, 40], [15, 45], [35, 35], [50, 45], [65, 30]].map(([l, w], i) => (
              <div key={i} style={{ height: 4, marginLeft: `${l}%`, width: `${w}%`, background: i === 1 ? GOLD : BRAND, borderRadius: 2, opacity: i === 1 ? 1 : 0.85 }} />
            ))}
          </div></>
      );
    case 'map':
      return (
        <><Title w={30} />
          <div style={{ height: 42, background: '#dcfce7', borderRadius: 2, position: 'relative', border: `1px solid ${LINE}` }}>
            <div style={{ position: 'absolute', left: '20%', top: '55%', width: '60%', height: 3, background: '#fff', transform: 'rotate(-12deg)' }} />
            <div style={{ position: 'absolute', left: '52%', top: '24%', width: 9, height: 9, background: '#dc2626', borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)' }} />
          </div></>
      );
    case 'diagram':
      return (
        <div className="flex items-center justify-center gap-[5px]" style={{ height: 34 }}>
          {[0, 1, 2].map((i) => (
            <React.Fragment key={i}>
              <div style={{ width: 22, height: 14, border: `1.5px solid ${BRAND}`, borderRadius: 3 }} />
              {i < 2 && <div style={{ width: 8, borderTop: `1.5px solid ${BRAND}` }} />}
            </React.Fragment>
          ))}
        </div>
      );
    case 'observations': {
      const tone = b.obsStyle === 'critical' ? '#dc2626' : b.obsStyle === 'warning' ? '#f59e0b' : b.obsStyle === 'success' ? '#16a34a' : b.obsStyle === 'info' ? '#2563eb' : BRAND;
      return (
        <div style={{ borderLeft: `3px solid ${tone}`, background: '#f8fafc', padding: '4px 5px', borderRadius: 2 }}>
          <Lines n={3} last={45} />
        </div>
      );
    }
    case 'signatures':
      return (
        <div className="flex justify-around items-end" style={{ height: 22 }}>
          {Array.from({ length: Math.min(3, Math.max(2, b.signaturesItems?.length ?? 2)) }).map((_, i) => (
            <div key={i} style={{ width: '24%' }}>
              <div style={{ borderTop: `1px solid #64748b`, marginBottom: 2 }} />
              <div style={{ height: 2, background: LINE, borderRadius: 2 }} />
            </div>
          ))}
        </div>
      );
    case 'footer':
      return <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 3 }} className="flex justify-between"><div style={{ height: 2, width: '30%', background: LINE }} /><div style={{ height: 2, width: '25%', background: LINE }} /></div>;
    case 'document':
    case 'html':
      return <div style={{ height: 40, background: '#f1f5f9', border: `1px dashed ${LINE}`, borderRadius: 2 }} />;
    case 'text':
    default: {
      const rich = /^\s*(\||[-*] \[|#)/m.test(b.textContent || '');
      return <><Title w={40} />{rich && /\|/.test(b.textContent || '') ? <Table rows={3} /> : <Lines n={4} />}</>;
    }
  }
}

export const TemplateThumb: React.FC<{ blocks: BlockConfig[]; photoColumns?: number; width?: number }> = ({ blocks, photoColumns = 2, width = 150 }) => {
  const list = [...blocks].filter((b) => b.enabled !== false).sort((a, b) => a.order - b.order);
  return (
    <div
      aria-hidden
      className="bg-white shadow-md ring-1 ring-slate-300/70 overflow-hidden flex flex-col gap-[7px]"
      style={{ width, aspectRatio: '210 / 297', padding: '9px 9px 0' }}
    >
      {list.map((b) => (
        <div key={b.id} className="shrink-0">{sketch(b, photoColumns)}</div>
      ))}
    </div>
  );
};
