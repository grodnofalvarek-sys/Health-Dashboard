import { useMemo, useState } from 'react';
import {
  Calendar,
  FileText,
  Filter,
  FolderGit2,
  Languages,
  ListOrdered,
  Search,
} from 'lucide-react';
import { useHealthData } from '../context/HealthDataContext';
import { SPECIALTIES, formatRuDate, getSpecialty } from '../config/specialties';
import type { ClinicalEvent, SpecialtyId } from '../model/types';

export default function TimelinePage() {
  const { db, openDocumentViewer } = useHealthData();
  const [viewMode, setViewMode] = useState<'chronological' | 'episodes'>('chronological');
  const [selectedSpecialty, setSelectedSpecialty] = useState<SpecialtyId | 'all'>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [showLt, setShowLt] = useState<boolean>(true);
  const [query, setQuery] = useState<string>('');

  const filteredEvents = useMemo(() => {
    if (!db) return [];
    const q = query.trim().toLowerCase();
    return db.clinicalEvents.filter((ev) => {
      if (selectedSpecialty !== 'all' && ev.specialty !== selectedSpecialty) return false;
      if (selectedYear !== 'all' && !ev.date.startsWith(selectedYear)) return false;
      if (q) {
        const hay = `${ev.titleRu} ${ev.findingsRu} ${ev.findingsLt ?? ''} ${ev.clinic}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [db, selectedSpecialty, selectedYear, query]);

  if (!db) return null;

  return (
    <div className="space-y-6">
      {/* Заголовок и переключатель режимов */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
            Хронология обследований и консультаций (2024–2026)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Двуязычный архив заключений (русский перевод + оригинал на литовском из e.sveikata)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLt((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
              showLt
                ? 'border-indigo-500/40 bg-indigo-500/12 text-indigo-700 dark:text-indigo-300'
                : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            <Languages size={15} />
            Оригинал LT: {showLt ? 'Вкл' : 'Выкл'}
          </button>

          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setViewMode('chronological')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'chronological'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <ListOrdered size={14} />
              Лента ({filteredEvents.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('episodes')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'episodes'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <FolderGit2 size={14} />
              По эпизодам ({db.episodes.length})
            </button>
          </div>
        </div>
      </div>

      {/* Панель фильтров */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Фильтр по диагнозу, врачу, клинике, ключевым словам (RU / LT)…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-xs text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="text-slate-400" />
            {['all', '2026', '2025', '2024'].map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setSelectedYear(yr)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  selectedYear === yr
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {yr === 'all' ? 'Все годы' : yr}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Filter size={14} className="mr-1 text-slate-400" />
          <button
            type="button"
            onClick={() => setSelectedSpecialty('all')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              selectedSpecialty === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            Все направления
          </button>
          {SPECIALTIES.filter((s) => s.id !== 'lab').map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedSpecialty(s.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                selectedSpecialty === s.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <span className="size-2 rounded-full" style={{ background: s.hex }} />
              {s.shortLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Режим 1: По клиническим эпизодам */}
      {viewMode === 'episodes' ? (
        <div className="space-y-6">
          {db.episodes.map((ep) => {
            const spec = getSpecialty(ep.specialty);
            const epEvents = filteredEvents.filter((e) => e.episodeId === ep.id);
            if (epEvents.length === 0) return null;

            return (
              <section
                key={ep.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="mb-4 border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`rounded-lg border px-2.5 py-0.5 text-xs font-semibold ${spec.bgSoft}`}>
                      {spec.label}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">{ep.period}</span>
                  </div>
                  <h2 className="mt-2 text-base font-bold text-slate-900 dark:text-white">{ep.titleRu}</h2>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{ep.summary}</p>
                </div>

                <div className="space-y-3">
                  {epEvents.map((ev) => (
                    <EventCard
                      key={ev.id}
                      event={ev}
                      showLt={showLt}
                      onOpenDoc={openDocumentViewer}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        /* Режим 2: Единая хронологическая лента */
        <div className="relative space-y-4 before:absolute before:top-3 before:bottom-3 before:left-4 before:w-0.5 before:bg-slate-200 sm:before:left-5 dark:before:bg-slate-800">
          {filteredEvents.map((ev) => {
            const spec = getSpecialty(ev.specialty);
            return (
              <div key={ev.id} className="relative pl-10 sm:pl-12">
                <span
                  className="absolute top-4 left-2.5 size-3.5 rounded-full ring-4 ring-slate-50 sm:left-3.5 dark:ring-slate-950"
                  style={{ background: spec.hex }}
                />
                <EventCard event={ev} showLt={showLt} onOpenDoc={openDocumentViewer} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EventCard({
  event,
  showLt,
  onOpenDoc,
}: {
  event: ClinicalEvent;
  showLt: boolean;
  onOpenDoc: (path: string) => void;
}) {
  const spec = getSpecialty(event.specialty);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-900 dark:text-white">{formatRuDate(event.date)}</span>
          <span className={`rounded-md border px-2 py-0.5 font-semibold ${spec.bgSoft}`}>
            {spec.shortLabel}
          </span>
        </div>
        <span className="font-medium text-slate-500 dark:text-slate-400">{event.clinic}</span>
      </div>

      <h3 className="mt-2 text-sm font-bold text-slate-900 dark:text-slate-100">{event.titleRu}</h3>

      <p className="mt-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
        {event.findingsRu}
      </p>

      {showLt && event.findingsLt && (
        <div className="mt-2.5 rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
          <span className="mr-1.5 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            LT оригинал
          </span>
          <span className="italic">{event.findingsLt}</span>
        </div>
      )}

      {event.documentPaths.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
          {event.documentPaths.map((p, idx) => {
            const fileName = p.split('/').pop() ?? `Документ ${idx + 1}`;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onOpenDoc(p)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <FileText size={13} className="text-indigo-500" />
                <span className="max-w-xs truncate">{fileName}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
