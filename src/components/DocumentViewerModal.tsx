import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useHealthData } from '../context/HealthDataContext';
import { formatFileSize, formatRuDate, getSpecialty } from '../config/specialties';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export default function DocumentViewerModal() {
  const { activeViewerDoc, closeDocumentViewer, getDocumentBlobUrl } = useHealthData();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.35);
  const [useIframeFallback, setUseIframeFallback] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  useEffect(() => {
    if (!activeViewerDoc) {
      setBlobUrl(null);
      setError(null);
      setNumPages(0);
      setPageNumber(1);
      pdfDocRef.current = null;
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setUseIframeFallback(false);

    getDocumentBlobUrl(activeViewerDoc)
      .then(async (url) => {
        if (cancelled) return;
        setBlobUrl(url);
        if (activeViewerDoc.fileType === 'pdf') {
          try {
            const loadingTask = pdfjsLib.getDocument({ url });
            const pdf = await loadingTask.promise;
            if (cancelled) return;
            pdfDocRef.current = pdf;
            setNumPages(pdf.numPages);
            setPageNumber(1);
          } catch {
            if (!cancelled) setUseIframeFallback(true);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Ошибка загрузки документа');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeViewerDoc, getDocumentBlobUrl]);

  useEffect(() => {
    const pdf = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas || !activeViewerDoc || activeViewerDoc.fileType !== 'pdf' || useIframeFallback) {
      return;
    }

    let cancelled = false;
    let renderTask: pdfjsLib.RenderTask | null = null;

    pdf
      .getPage(pageNumber)
      .then((page) => {
        if (cancelled) return;
        const viewport = page.getViewport({ scale });
        const context = canvas.getContext('2d');
        if (!context) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);

        renderTask = page.render({
          canvasContext: context,
          canvas,
          viewport,
        });
        return renderTask.promise;
      })
      .catch(() => {
        /* ignore cancelled render */
      });

    return () => {
      cancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          /* ignore */
        }
      }
    };
  }, [activeViewerDoc, pageNumber, scale, numPages, useIframeFallback]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && activeViewerDoc) {
        closeDocumentViewer();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeViewerDoc, closeDocumentViewer]);

  if (!activeViewerDoc) return null;

  const spec = getSpecialty(activeViewerDoc.specialty);
  const isPdf = activeViewerDoc.fileType === 'pdf';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/85 backdrop-blur-sm"
      onClick={closeDocumentViewer}
    >
      {/* Верхняя панель управления */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-4 py-3 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${spec.bgSoft}`}>
            <FileText size={14} />
            {spec.shortLabel}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{activeViewerDoc.titleRu}</div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>{formatRuDate(activeViewerDoc.date)}</span>
              <span>•</span>
              <span>{activeViewerDoc.clinic}</span>
              <span>•</span>
              <span>{formatFileSize(activeViewerDoc.sizeBytes)}</span>
            </div>
          </div>
        </div>

        {/* Инструменты масштаба / страниц / скачивания */}
        <div className="flex items-center gap-1.5">
          {isPdf && numPages > 0 && !useIframeFallback && (
            <>
              <div className="mr-1 flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/80 px-2 py-1 text-xs">
                <button
                  type="button"
                  disabled={pageNumber <= 1}
                  onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                  className="rounded p-1 hover:bg-slate-700 disabled:opacity-40"
                  title="Предыдущая страница"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="px-1.5 font-medium">
                  {pageNumber} / {numPages}
                </span>
                <button
                  type="button"
                  disabled={pageNumber >= numPages}
                  onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                  className="rounded p-1 hover:bg-slate-700 disabled:opacity-40"
                  title="Следующая страница"
                >
                  <ChevronRight size={15} />
                </button>
              </div>

              <div className="mr-1 hidden items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/80 px-2 py-1 text-xs sm:flex">
                <button
                  type="button"
                  onClick={() => setScale((s) => Math.max(0.75, +(s - 0.2).toFixed(2)))}
                  className="rounded p-1 hover:bg-slate-700"
                  title="Уменьшить"
                >
                  <ZoomOut size={15} />
                </button>
                <span className="px-1 font-medium">{Math.round(scale * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setScale((s) => Math.min(2.6, +(s + 0.2).toFixed(2)))}
                  className="rounded p-1 hover:bg-slate-700"
                  title="Увеличить"
                >
                  <ZoomIn size={15} />
                </button>
              </div>
            </>
          )}

          {blobUrl && (
            <>
              <a
                href={blobUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
                title="Открыть в новой вкладке"
              >
                <ExternalLink size={14} />
                <span className="hidden sm:inline">Вкладка</span>
              </a>
              <a
                href={blobUrl}
                download={activeViewerDoc.fileName}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
                title="Скачать файл"
              >
                <Download size={14} />
                <span className="hidden sm:inline">Скачать</span>
              </a>
            </>
          )}

          <button
            type="button"
            onClick={closeDocumentViewer}
            aria-label="Закрыть просмотр"
            className="grid size-9 place-items-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Область просмотра */}
      <div
        className="flex flex-1 items-start justify-center overflow-auto p-3 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {loading && (
          <div className="my-auto flex flex-col items-center gap-3 text-slate-300">
            <Loader2 size={32} className="animate-spin text-red-400" />
            <span className="text-sm">Расшифровка и рендеринг документа…</span>
          </div>
        )}

        {error && (
          <div className="my-auto max-w-md rounded-2xl border border-amber-500/30 bg-slate-900 p-6 text-center text-slate-200">
            <p className="text-sm font-semibold text-amber-300">Оригинал файла сейчас не загружен</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">{error}</p>
            <div className="mt-4 rounded-xl bg-slate-950 p-3 text-left text-xs text-slate-400">
              <div>
                <strong className="text-slate-200">Путь:</strong> {activeViewerDoc.path}
              </div>
              {activeViewerDoc.markers.length > 0 && (
                <div className="mt-1">
                  <strong className="text-slate-200">Маркеры:</strong> {activeViewerDoc.markers.join(', ')}
                </div>
              )}
            </div>
          </div>
        )}

        {!loading && !error && blobUrl && (
          <>
            {isPdf ? (
              useIframeFallback ? (
                <iframe
                  src={blobUrl}
                  title={activeViewerDoc.titleRu}
                  className="h-[82dvh] w-full max-w-5xl rounded-xl border border-slate-800 bg-white"
                />
              ) : (
                <div className="overflow-auto rounded-xl border border-slate-800 bg-white shadow-2xl">
                  <canvas ref={canvasRef} className="block max-w-full" />
                </div>
              )
            ) : (
              <img
                src={blobUrl}
                alt={activeViewerDoc.titleRu}
                className="max-h-[84dvh] max-w-full rounded-xl border border-slate-800 bg-white object-contain shadow-2xl"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
