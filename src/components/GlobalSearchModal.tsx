import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Fuse from 'fuse.js';
import { Activity, FileText, FlaskConical, Pill, Search, Stethoscope, X } from 'lucide-react';
import { useHealthData } from '../context/HealthDataContext';
import { formatRuDate, getSpecialty } from '../config/specialties';
import type { MedicalDocument, SpecialtyId } from '../model/types';

interface SearchEntry {
  id: string;
  kind: 'diagnosis' | 'lab' | 'event' | 'medication' | 'document';
  title: string;
  subtitle: string;
  keywords: string;
  date?: string;
  specialty: SpecialtyId;
  route: string;
  doc?: MedicalDocument;
}

export default function GlobalSearchModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { db, openDocumentViewer } = useHealthData();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const entries = useMemo<SearchEntry[]>(() => {
    if (!db) return [];
    const list: SearchEntry[] = [];

    for (const d of db.diagnoses) {
      list.push({
        id: `diag-${d.id}`,
        kind: 'diagnosis',
        title: `${d.code} — ${d.titleRu}`,
        subtitle: `${d.status} • Терапия: ${d.therapy}`,
        keywords: `${d.titleLt} ${d.therapyLt} ${d.domain}`,
        specialty: d.specialty,
        route: '/',
      });
    }

    for (const l of Object.values(db.latestByAnalyte)) {
      list.push({
        id: `lab-${l.analyte}`,
        kind: 'lab',
        title: `${l.nameRu} (${l.shortName}): ${l.value} ${l.unit}`,
        subtitle: `${formatRuDate(l.date)} • ${l.lab}${l.note ? ` • ${l.note}` : ''}`,
        keywords: `${l.analyte} ${l.group}`,
        date: l.date,
        specialty: 'lab',
        route: `/labs?analyte=${encodeURIComponent(l.analyte)}`,
      });
    }

    for (const ev of db.clinicalEvents) {
      list.push({
        id: `ev-${ev.id}`,
        kind: 'event',
        title: `${formatRuDate(ev.date)} — ${ev.titleRu}`,
        subtitle: ev.findingsRu,
        keywords: `${ev.findingsLt ?? ''} ${ev.clinic}`,
        date: ev.date,
        specialty: ev.specialty,
        route: '/timeline',
      });
    }

    for (const m of db.medications) {
      list.push({
        id: `med-${m.id}`,
        kind: 'medication',
        title: `${m.drugRu} — ${m.dose}`,
        subtitle: `${m.active ? 'Активный курс' : 'Завершён'} • ${m.reason}`,
        keywords: m.drugLt,
        date: m.start,
        specialty: m.specialty,
        route: '/plan',
      });
    }

    for (const doc of db.documents) {
      list.push({
        id: `doc-${doc.id}`,
        kind: 'document',
        title: doc.titleRu,
        subtitle: `${formatRuDate(doc.date)} • ${doc.clinic} • ${doc.fileName}`,
        keywords: `${doc.markers.join(' ')} ${doc.docType} ${doc.folder}`,
        date: doc.date,
        specialty: doc.specialty,
        route: '/documents',
        doc,
      });
    }

    return list;
  }, [db]);

  const fuse = useMemo(
    () =>
      new Fuse(entries, {
        keys: [
          { name: 'title', weight: 2 },
          { name: 'subtitle', weight: 1.4 },
          { name: 'keywords', weight: 1.2 },
        ],
        threshold: 0.34,
        ignoreLocation: true,
      }),
    [entries],
  );

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return entries.slice(0, 14);
    return fuse.search(q, { limit: 25 }).map((r) => r.item);
  }, [query, fuse, entries]);

  if (!open) return null;

  function handleSelect(item: SearchEntry) {
    onClose();
    if (item.doc) {
      openDocumentViewer(item.doc);
    } else {
      navigate(item.route);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/75 px-4 pt-12 pb-6 backdrop-blur-xs sm:pt-20"
      onClick={onClose}
    >
      <div
        className="flex max-h-[82dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <Search size={19} className="shrink-0 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по анализам, диагнозам (МКБ-10), клиникам, лекарствам, документам (RU / LT)…"
            autoFocus
            className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none dark:text-slate-100"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400"
          >
            Esc
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 dark:divide-slate-800/70">
          {results.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Ничего не найдено по запросу «{query}»
            </div>
          ) : (
            results.map((item) => {
              const spec = getSpecialty(item.specialty);
              const KindIcon =
                item.kind === 'lab'
                  ? FlaskConical
                  : item.kind === 'event'
                    ? Activity
                    : item.kind === 'medication'
                      ? Pill
                      : item.kind === 'document'
                        ? FileText
                        : Stethoscope;
              const kindLabel =
                item.kind === 'lab'
                  ? 'Анализ'
                  : item.kind === 'event'
                    ? 'Событие'
                    : item.kind === 'medication'
                      ? 'Терапия'
                      : item.kind === 'document'
                        ? 'Документ'
                        : 'Диагноз';

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800/70"
                >
                  <span
                    className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border ${spec.bgSoft}`}
                  >
                    <KindIcon size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {item.title}
                      </span>
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {kindLabel}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                      {item.subtitle}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
