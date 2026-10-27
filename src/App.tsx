import React, { useState, useMemo } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import {
  ProjectData,
  RubricItem,
  PendingItem,
  PhotoItem,
  ObservationsData,
  BlockConfig,
  BlockId,
} from './types';
import {
  DEFAULT_PROJECT_DATA,
  DEFAULT_RUBRICS,
  DEFAULT_PENDINGS,
  DEFAULT_PHOTOS,
  DEFAULT_OBSERVATIONS,
  DEFAULT_BLOCKS,
} from './utils/defaultData';
import { HeaderBar } from './components/HeaderBar';
import { EditorSidebar } from './components/EditorSidebar';
import { ReportSheet } from './components/ReportSheet';

export default function App() {
  const [projectData, setProjectData] = useState<ProjectData>(DEFAULT_PROJECT_DATA);
  const [rubrics, setRubrics] = useState<RubricItem[]>(DEFAULT_RUBRICS);
  const [pendings, setPendings] = useState<PendingItem[]>(DEFAULT_PENDINGS);
  const [photos, setPhotos] = useState<PhotoItem[]>(DEFAULT_PHOTOS);
  const [observations, setObservations] = useState<ObservationsData>(DEFAULT_OBSERVATIONS);
  const [blocks, setBlocks] = useState<BlockConfig[]>(DEFAULT_BLOCKS);

  const [photoColumns, setPhotoColumns] = useState<1 | 2 | 3 | 4>(2);
  const [photoHeightMm, setPhotoHeightMm] = useState<number>(40); // 4 cm (40 mm) compact height for Page 1
  const [photosPage1Count, setPhotosPage1Count] = useState<number>(2); // 2 photos on Page 1, remainder on Page 2
  const [zoom, setZoom] = useState<number>(0.9);
  const [sidebarWidth, setSidebarWidth] = useState<number>(380);
  const [extraPages, setExtraPages] = useState<number>(0);

  // Compute total pages dynamically: if photos are on Page 0 and have continuation photos, ensure at least 2 pages
  const totalPages = useMemo(() => {
    const maxAssignedPage = blocks
      .filter((b) => b.enabled)
      .reduce((max, b) => Math.max(max, b.pageIndex), 0);
    const photosBlock = blocks.find((b) => b.id === 'photos' && b.enabled);
    const hasContinuation =
      photosBlock &&
      photosBlock.pageIndex === 0 &&
      photos.length > photosPage1Count;
    const minPages = hasContinuation ? 2 : 1;
    return Math.max(maxAssignedPage + 1, minPages) + extraPages;
  }, [blocks, photos.length, photosPage1Count, extraPages]);

  // Block reordering within page or global
  const handleMoveBlockOrder = (blockId: BlockId, direction: 'up' | 'down') => {
    const blockIndex = blocks.findIndex((b) => b.id === blockId);
    if (blockIndex === -1) return;

    const block = blocks[blockIndex];
    // Find neighbors on the same page
    const samePageBlocks = blocks
      .filter((b) => b.enabled && b.pageIndex === block.pageIndex)
      .sort((a, b) => a.order - b.order);

    const indexInPage = samePageBlocks.findIndex((b) => b.id === blockId);

    if (direction === 'up' && indexInPage > 0) {
      const neighbor = samePageBlocks[indexInPage - 1];
      const newBlocks = blocks.map((b) => {
        if (b.id === block.id) return { ...b, order: neighbor.order };
        if (b.id === neighbor.id) return { ...b, order: block.order };
        return b;
      });
      setBlocks(newBlocks);
    } else if (direction === 'down' && indexInPage < samePageBlocks.length - 1) {
      const neighbor = samePageBlocks[indexInPage + 1];
      const newBlocks = blocks.map((b) => {
        if (b.id === block.id) return { ...b, order: neighbor.order };
        if (b.id === neighbor.id) return { ...b, order: block.order };
        return b;
      });
      setBlocks(newBlocks);
    } else if (direction === 'down' && indexInPage === samePageBlocks.length - 1) {
      // Move to next page
      handleMoveBlockPage(blockId, block.pageIndex + 1);
    } else if (direction === 'up' && indexInPage === 0 && block.pageIndex > 0) {
      // Move to previous page
      handleMoveBlockPage(blockId, block.pageIndex - 1);
    }
  };

  // Move block directly to another page
  const handleMoveBlockPage = (blockId: BlockId, targetPageIndex: number) => {
    if (targetPageIndex < 0) return;
    const newBlocks = blocks.map((b) =>
      b.id === blockId ? { ...b, pageIndex: targetPageIndex } : b
    );
    setBlocks(newBlocks);
  };

  // Toggle force page break
  const handleToggleForcePageBreak = (blockId: BlockId) => {
    const newBlocks = blocks.map((b) =>
      b.id === blockId ? { ...b, forceNewPage: !b.forceNewPage } : b
    );
    setBlocks(newBlocks);
  };

  // Intelligent auto-distribution of blocks across A4 sheets
  const handleAutoDistribute = () => {
    // Page 1: Header + Contract & Metrics + Situation + Photos (Part 1, 40mm)
    // Page 2: Cuadro de Pendencias + Continuation Photos + Observations
    const newBlocks = blocks.map((b) => {
      if (b.id === 'header') return { ...b, pageIndex: 0, order: 0 };
      if (b.id === 'contract_metrics') return { ...b, pageIndex: 0, order: 1 };
      if (b.id === 'situation') return { ...b, pageIndex: 0, order: 2 };
      if (b.id === 'photos') return { ...b, pageIndex: 0, order: 3 };
      if (b.id === 'pending') return { ...b, pageIndex: 1, order: 4 };
      if (b.id === 'observations') return { ...b, pageIndex: 1, order: 5 };
      return b;
    });

    setBlocks(newBlocks);
    setPhotoHeightMm(40);
    setPhotosPage1Count(2);
    setExtraPages(0);
  };

  const handleAddPage = () => {
    setExtraPages((prev) => prev + 1);
  };

  const handleLoadExample = () => {
    setProjectData(DEFAULT_PROJECT_DATA);
    setRubrics(DEFAULT_RUBRICS);
    setPendings(DEFAULT_PENDINGS);
    setPhotos(DEFAULT_PHOTOS);
    setObservations(DEFAULT_OBSERVATIONS);
    setBlocks(DEFAULT_BLOCKS);
    setPhotoHeightMm(40);
    setPhotosPage1Count(2);
    setExtraPages(0);
  };

  // Print native dialog
  const handlePrint = () => {
    window.print();
  };

  // Export full JSON project
  const handleExportJson = () => {
    const payload = {
      projectData,
      rubrics,
      pendings,
      photos,
      observations,
      blocks,
      photoColumns,
      photoHeightMm,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_obra_${projectData.reportDate || 'semanal'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON project
  const handleImportJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (parsed.projectData) setProjectData(parsed.projectData);
        if (parsed.rubrics) setRubrics(parsed.rubrics);
        if (parsed.pendings) setPendings(parsed.pendings);
        if (parsed.photos) setPhotos(parsed.photos);
        if (parsed.observations) setObservations(parsed.observations);
        if (parsed.blocks) setBlocks(parsed.blocks);
        if (parsed.photoColumns) setPhotoColumns(parsed.photoColumns);
        if (parsed.photoHeightMm) setPhotoHeightMm(parsed.photoHeightMm);
      } catch (err) {
        alert('Archivo de proyecto JSON inválido.');
      }
    };
    reader.readAsText(file);
  };

  // Export standalone HTML
  const handleExportHtml = () => {
    const printArea = document.getElementById('report-print-container');
    if (!printArea) return;

    const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${projectData.project || 'Reporte de Obra A4'}</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
@page { size: A4 portrait; margin: 0; }
body { margin: 0; padding: 0; background: #f1f5f9; font-family: 'Plus Jakarta Sans', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.a4-sheet { width: 210mm; min-height: 297mm; height: 297mm; background: #fff; margin: 15px auto; box-shadow: 0 4px 14px rgba(0,0,0,0.1); overflow: hidden; display: flex; flex-direction: column; }
@media print {
  body { background: transparent; }
  .a4-sheet { margin: 0 !important; box-shadow: none !important; page-break-after: always; break-after: page; }
  .no-print { display: none !important; }
}
</style>
</head>
<body>
${printArea.innerHTML}
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_semanal_${projectData.reportDate || 'a4'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen max-h-screen w-screen overflow-hidden flex flex-col bg-slate-100 text-slate-800">
      {/* Top Application Bar */}
      <HeaderBar
        totalPages={totalPages}
        zoom={zoom}
        onZoomChange={setZoom}
        onPrint={handlePrint}
        onExportHtml={handleExportHtml}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onLoadExample={handleLoadExample}
        onAutoDistribute={handleAutoDistribute}
      />

      {/* Main Workspace: Left Editor Sidebar + Right A4 Paper Preview */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Editor with independent scrollbar */}
        <EditorSidebar
          blocks={blocks}
          projectData={projectData}
          rubrics={rubrics}
          pendings={pendings}
          photos={photos}
          observations={observations}
          photoColumns={photoColumns}
          photoHeightMm={photoHeightMm}
          photosPage1Count={photosPage1Count}
          onUpdatePhotosPage1Count={setPhotosPage1Count}
          totalPages={totalPages}
          sidebarWidth={sidebarWidth}
          onSidebarWidthChange={setSidebarWidth}
          onUpdateBlocks={setBlocks}
          onUpdateProjectData={(patch) =>
            setProjectData((prev) => ({ ...prev, ...patch }))
          }
          onUpdateRubrics={setRubrics}
          onUpdatePendings={setPendings}
          onUpdatePhotos={setPhotos}
          onUpdateObservations={(patch) =>
            setObservations((prev) => ({ ...prev, ...patch }))
          }
          onUpdatePhotoSettings={(cols, height) => {
            setPhotoColumns(cols);
            setPhotoHeightMm(height);
          }}
          onAddPage={handleAddPage}
          onAutoDistribute={handleAutoDistribute}
        />

        {/* Right Preview Viewport with dedicated independent scrollbar */}
        <main
          id="report-scroll-viewport"
          tabIndex={0}
          className="flex-1 h-full overflow-y-scroll overflow-x-auto preview-scrollbar bg-slate-300/70 p-4 md:p-8 outline-none select-none"
          style={{ scrollBehavior: 'smooth' }}
        >
          <div className="w-full flex flex-col items-center min-h-max pb-36">
            {/* Zoom scaling wrapper */}
            <div
              id="report-print-container"
              className="flex flex-col items-center origin-top transition-transform duration-100 ease-out"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top center',
              }}
            >
              {Array.from({ length: totalPages }).map((_, pageIdx) => (
                <ReportSheet
                  key={`page-${pageIdx}`}
                  pageIndex={pageIdx}
                  totalPages={totalPages}
                  blocks={blocks}
                  projectData={projectData}
                  rubrics={rubrics}
                  pendings={pendings}
                  photos={photos}
                  observations={observations}
                  photoColumns={photoColumns}
                  photoHeightMm={photoHeightMm}
                  photosPage1Count={photosPage1Count}
                  onMoveBlockOrder={handleMoveBlockOrder}
                  onMoveBlockPage={handleMoveBlockPage}
                  onToggleForcePageBreak={handleToggleForcePageBreak}
                />
              ))}
            </div>

            {/* Zoom Controls Bar placed below the sheets */}
            <div className="no-print mt-6 mb-12 bg-[#0b455b] text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-3 border border-white/20 text-xs">
              <span className="text-slate-200 uppercase font-bold tracking-wider text-[11px]">
                Escala de Hojas A4:
              </span>
              <button
                onClick={() => setZoom(Math.max(0.4, Number((zoom - 0.05).toFixed(2))))}
                title="Reducir tamaño"
                className="p-1 text-slate-200 hover:text-white rounded hover:bg-white/10"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <input
                type="range"
                min="40"
                max="140"
                step="5"
                value={Math.round(zoom * 100)}
                onChange={(e) => setZoom(parseInt(e.target.value) / 100)}
                className="w-32 accent-[#f4c84a] cursor-pointer h-2 bg-slate-700 rounded-lg appearance-none"
                title="Deslizador de zoom"
              />
              <span className="font-mono font-bold text-[#f4c84a] px-1 text-sm min-w-[44px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(Math.min(1.5, Number((zoom + 0.05).toFixed(2))))}
                title="Aumentar tamaño"
                className="p-1 text-slate-200 hover:text-white rounded hover:bg-white/10"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoom(0.85)}
                className="px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white rounded text-xs font-semibold ml-2 transition-colors"
              >
                Ajustar (85%)
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
