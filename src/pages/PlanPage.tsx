import { CalendarClock, CheckCircle2, Clock, Download, Pill } from 'lucide-react';
import { useHealthData } from '../context/HealthDataContext';
import { formatRuDate, getSpecialty } from '../config/specialties';
import type { FollowUpItem } from '../model/types';

function downloadIcsFile(items: FollowUpItem[]) {
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const events = items.map((item) => {
    const cleanDate = item.dueDate.replace(/-/g, '');
    return [
      'BEGIN:VEVENT',
      `UID:${item.id}@health-dashboard.local`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${cleanDate}`,
      `SUMMARY:${item.titleRu}`,
      `DESCRIPTION:${item.titleLt} (${item.source})`,
      'END:VEVENT',
    ].join('\r\n');
  });

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Health Dashboard//RU',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'health_checkup_plan_2026_2027.ics';
  a.click();
  URL.revokeObjectURL(url);
}

export default function PlanPage() {
  const { db } = useHealthData();
  if (!db) return null;

  const activeMeds = db.medications.filter((m) => m.active);
  const pastMeds = db.medications.filter((m) => !m.active);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
            План контрольных обследований и история терапии
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            График чекапов на 2026–2027 гг. с экспортом в календарь смартфона и схема курсов лечения
          </p>
        </div>

        <button
          type="button"
          onClick={() => downloadIcsFile(db.followUps)}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
        >
          <Download size={15} />
          Экспорт в календарь (.ics)
        </button>
      </div>

      {/* ── Контрольные точки и чекапы ── */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
          <CalendarClock size={18} className="text-indigo-500" />
          Календарь предстоящих консультаций и контрольных исследований ({db.followUps.length})
        </h2>

        <div className="grid gap-3 md:grid-cols-2">
          {db.followUps.map((f) => {
            const spec = getSpecialty(f.specialty);
            const isHigh = f.priority === 'high';
            return (
              <div
                key={f.id}
                className={`flex flex-col justify-between rounded-2xl border p-4 ${
                  isHigh
                    ? 'border-amber-500/35 bg-amber-500/5'
                    : 'border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/50'
                }`}
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className={`rounded-md border px-2 py-0.5 font-semibold ${spec.bgSoft}`}>
                      {spec.shortLabel}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        isHigh
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      <Clock size={11} />
                      {f.dueLabel}
                    </span>
                  </div>

                  <h3 className="mt-2.5 text-sm font-bold text-slate-900 dark:text-white">{f.titleRu}</h3>
                  <p className="mt-0.5 text-xs italic text-slate-500 dark:text-slate-400">LT: {f.titleLt}</p>
                </div>

                <div className="mt-3 border-t border-slate-200/70 pt-2 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  Основание: <strong className="text-slate-700 dark:text-slate-300">{f.source}</strong>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Постоянная и курсовая медикаментозная терапия ── */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
          <Pill size={18} className="text-emerald-500" />
          Постоянная медикаментозная терапия ({activeMeds.length})
        </h2>

        <div className="grid gap-3 md:grid-cols-2">
          {activeMeds.map((m) => {
            const spec = getSpecialty(m.specialty);
            return (
              <div
                key={m.id}
                className="rounded-2xl border border-emerald-500/30 bg-emerald-500/6 p-4 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded-md border px-2 py-0.5 font-semibold ${spec.bgSoft}`}>
                    {spec.shortLabel}
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 size={13} />С {formatRuDate(m.start)} — по наст. время
                  </span>
                </div>
                <div className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
                  {m.drugRu} — <span className="text-emerald-700 dark:text-emerald-300">{m.dose}</span>
                </div>
                <div className="mt-0.5 italic text-slate-500 dark:text-slate-400">LT: {m.drugLt}</div>
                <div className="mt-2 text-slate-600 dark:text-slate-300">{m.reason}</div>
              </div>
            );
          })}
        </div>

        <h3 className="mt-6 mb-3 text-xs font-bold tracking-wider text-slate-400 uppercase">
          Завершённые курсы и вакцинация (2024–2026)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 dark:border-slate-800">
                <th className="pb-2 font-semibold">Препарат (RU / LT)</th>
                <th className="pb-2 font-semibold">Дозировка</th>
                <th className="pb-2 font-semibold">Период</th>
                <th className="pb-2 font-semibold">Показание / примечание</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {pastMeds.map((m) => (
                <tr key={m.id}>
                  <td className="py-2.5 pr-3">
                    <div className="font-bold text-slate-900 dark:text-white">{m.drugRu}</div>
                    <div className="text-[11px] italic text-slate-400">{m.drugLt}</div>
                  </td>
                  <td className="py-2.5 pr-3 font-medium text-slate-700 dark:text-slate-300">{m.dose}</td>
                  <td className="py-2.5 pr-3 whitespace-nowrap text-slate-500">
                    {formatRuDate(m.start)}
                    {m.end && m.end !== m.start ? ` – ${formatRuDate(m.end)}` : ''}
                  </td>
                  <td className="py-2.5 text-slate-600 dark:text-slate-300">{m.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
