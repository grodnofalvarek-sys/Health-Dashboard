import { useMemo, useState } from 'react';
import { FileImage, FileText, FolderOpen, Search, Tag } from 'lucide-react';
import { useHealthData } from '../context/HealthDataContext';
import { SPECIALTIES, formatFileSize, formatRuDate, getSpecialty } from '../config/specialties';
import type { SpecialtyId } from '../model/types';

export default function DocumentsPage() {
  const { db, openDocumentViewer } = useHealthData();
  const [selectedSpec, setSelectedSpec] = useState<SpecialtyId | 'all'>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedExt, setSelectedExt] = useState<'all' | 'pdf' | 'jpg'>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!db) return [];
    const q = query.trim().toLowerCase();
    return db.documents.filter((doc) => {
      if (selectedSpec !== 'all' && doc.specialty !== selectedSpec) return false;
      if (selectedYear !== 'all' && !doc.date.startsWith(selectedYear)) return false;
      if (selectedExt !== 'all' && doc.fileType !== selectedExt) return false;
      if (q) {
        const hay = `${doc.titleRu} ${doc.fileName} ${doc.clinic} ${doc.docType} ${doc.markers.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [db, selectedSpec, selectedYear, selectedExt, query]);

  if (!db) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
            Архив медицинских документов ({filtered.length} из {db.documents.length})
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Все файлы унифицированы по стандарту «ГГГГ-ММ-ДД_Тип_Детали_Клиника» и доступны для мгновенного просмотра
          </p>
        </div>
      </div>

      {/* Панель поиска и фильтрации */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по названию, клинике (Meliva, Affidea, Helix, ЛОДЭ), маркерам (CAC 288, PI-RADS 2)…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-xs text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {['all', '2026', '2025', '2024'].map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setSelectedYear(yr)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  selectedYear === yr
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {yr === 'all' ? 'Все годы' : yr}
              </button>
            ))}

            <span className="mx-1 text-slate-300 dark:text-slate-700">|</span>

            {(['all', 'pdf', 'jpg'] as const).map((ext) => (
              <button
                key={ext}
                type="button"
                onClick={() => setSelectedExt(ext)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold uppercase transition ${
                  selectedExt === ext
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {ext === 'all' ? 'Все форматы' : ext}
              </button>
            ))}
          </div>
        </div>

        {/* Фильтр по папкам-направлениям */}
        <div className="flex flex-wrap items-center gap-1.5">
          <FolderOpen size={14} className="mr-1 text-slate-400" />
          <button
            type="button"
            onClick={() => setSelectedSpec('all')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              selectedSpec === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            Все папки ({db.documents.length})
          </button>
          {SPECIALTIES.map((s) => {
            const count = db.documents.filter((d) => d.specialty === s.id).length;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedSpec(s.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  selectedSpec === s.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <span className="size-2 rounded-full" style={{ background: s.hex }} />
                {s.shortLabel} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Сетка карточек документов */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((doc) => {
          const spec = getSpecialty(doc.specialty);
          const isPdf = doc.fileType === 'pdf';

          return (
            <button
              key={doc.id}
              type="button"
              onClick={() => openDocumentViewer(doc)}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-2xs transition hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-semibold ${spec.bgSoft}`}>
                    {isPdf ? <FileText size={13} /> : <FileImage size={13} />}
                    {spec.shortLabel}
                  </span>
                  <span className="font-semibold text-slate-500 dark:text-slate-400">
                    {formatRuDate(doc.date)}
                  </span>
                </div>

                <h3 className="mt-2.5 text-sm font-bold text-slate-900 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400">
                  {doc.titleRu}
                </h3>

                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Клиника: <strong className="font-medium text-slate-700 dark:text-slate-300">{doc.clinic}</strong>
                </div>

                {doc.markers.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {doc.markers.map((m) => (
                      <span
                        key={m}
                        className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        <Tag size={10} className="text-indigo-500" />
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-400 dark:border-slate-800">
                <span className="truncate font-mono">{doc.fileName}</span>
                <span className="ml-2 shrink-0 uppercase">
                  {doc.fileType} • {formatFileSize(doc.sizeBytes)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
