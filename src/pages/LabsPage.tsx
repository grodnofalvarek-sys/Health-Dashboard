import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Line } from 'react-chartjs-2';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  FlaskConical,
  Info,
  Minus,
} from 'lucide-react';
import { useHealthData } from '../context/HealthDataContext';
import { formatRuDate } from '../config/specialties';
import type { LabStatus, LatestAnalyteSummary } from '../model/types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin,
);

const GROUPS = [
  {
    id: 'all',
    label: 'Все показатели',
    match: () => true,
  },
  {
    id: 'lipids',
    label: 'Липидный спектр и терапия',
    match: (g: string) => g === 'lipids',
  },
  {
    id: 'renal_liver',
    label: 'Печень и почки (безопасность)',
    match: (g: string) => g === 'renal' || g === 'liver',
  },
  {
    id: 'uro_infl',
    label: 'Урология и воспаление (ПСА, СРБ)',
    match: (g: string) => g === 'urology' || g === 'inflammation',
  },
  {
    id: 'meta_cbc',
    label: 'Метаболизм, гормоны и ОАК',
    match: (g: string) =>
      g === 'metabolism' || g === 'hormones' || g === 'vitamins' || g === 'electrolytes' || g === 'cbc',
  },
] as const;

function statusBadge(status: LabStatus, targetHigh: number | null) {
  if (status === 'normal') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 size={11} />
        Норма
      </span>
    );
  }
  if (status === 'above_target') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/12 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
        Выше цели {targetHigh !== null ? `< ${targetHigh}` : ''}
      </span>
    );
  }
  if (status === 'high') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/12 px-2 py-0.5 text-[11px] font-semibold text-red-600 dark:text-red-400">
        Выше нормы ↑
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/12 px-2 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
      Ниже нормы ↓
    </span>
  );
}

export default function LabsPage() {
  const { db, openDocumentViewer } = useHealthData();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialGroup = searchParams.get('group') ?? 'lipids';
  const initialAnalyte = searchParams.get('analyte') ?? 'LDL';

  const [activeGroup, setActiveGroup] = useState<string>(
    GROUPS.some((g) => g.id === initialGroup) ? initialGroup : 'lipids',
  );
  const [selectedAnalyte, setSelectedAnalyte] = useState<string>(initialAnalyte);

  const summaries = useMemo(() => {
    if (!db) return [];
    const groupObj = GROUPS.find((g) => g.id === activeGroup) ?? GROUPS[0];
    return Object.values(db.latestByAnalyte).filter((item) => groupObj.match(item.group));
  }, [db, activeGroup]);

  if (!db) return null;

  const activeItem: LatestAnalyteSummary | undefined =
    db.latestByAnalyte[selectedAnalyte] ?? summaries[0] ?? db.latestByAnalyte.LDL;

  // Сводный график липидного профиля по всем датам
  const lipidDates = ['2024-11-05', '2025-03-12', '2025-09-03', '2025-10-15', '2026-05-05'];
  const getLipidSeries = (code: string) =>
    lipidDates.map((d) => {
      const found = db.labResults.find((r) => r.analyte === code && r.date === d);
      return found ? found.value : null;
    });

  const lipidChartData = {
    labels: lipidDates.map((d) => formatRuDate(d)),
    datasets: [
      {
        label: 'Общий холестерин (CHOL)',
        data: getLipidSeries('CHOL'),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderWidth: 2.5,
        tension: 0.25,
        spanGaps: true,
      },
      {
        label: 'ЛПНП (LDL) — целевой < 1.8',
        data: getLipidSeries('LDL'),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.14)',
        borderWidth: 3,
        pointRadius: 5,
        tension: 0.25,
        fill: true,
        spanGaps: true,
      },
      {
        label: 'ЛПВП (HDL)',
        data: getLipidSeries('HDL'),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 2,
        tension: 0.25,
        spanGaps: true,
      },
      {
        label: 'Триглицериды (TG)',
        data: getLipidSeries('TG'),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 2,
        borderDash: [4, 4],
        tension: 0.25,
        spanGaps: true,
      },
    ],
  };

  const lipidChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: { boxWidth: 12, usePointStyle: true, font: { size: 11 } },
      },
      annotation: {
        annotations: {
          ldlTarget: {
            type: 'line',
            yMin: 1.8,
            yMax: 1.8,
            borderColor: '#ef4444',
            borderWidth: 1.5,
            borderDash: [6, 5],
            label: {
              display: true,
              content: 'Цель ЛПНП < 1.8 ммоль/л (SCORE2 11%)',
              position: 'end',
              backgroundColor: 'rgba(239, 68, 68, 0.88)',
              color: '#fff',
              font: { size: 10, weight: 'bold' },
            },
          },
        },
      },
    },
    scales: {
      y: {
        min: 0.5,
        max: 6.5,
        title: { display: true, text: 'ммоль/л', font: { size: 11 } },
      },
    },
  };

  // Индивидуальный график выбранного показателя
  const singleHistory = activeItem?.history ?? [];
  const singleChartData = {
    labels: singleHistory.map((h) => formatRuDate(h.date)),
    datasets: [
      {
        label: `${activeItem?.nameRu ?? ''} (${activeItem?.unit ?? ''})`,
        data: singleHistory.map((h) => h.value),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.14)',
        borderWidth: 3,
        pointRadius: 5,
        tension: 0.25,
        fill: true,
      },
    ],
  };

  const singleAnnotations: Record<string, object> = {};
  if (activeItem?.refHigh !== null && activeItem?.refHigh !== undefined) {
    singleAnnotations.refHighLine = {
      type: 'line',
      yMin: activeItem.refHigh,
      yMax: activeItem.refHigh,
      borderColor: '#f59e0b',
      borderWidth: 1.5,
      borderDash: [5, 5],
      label: {
        display: true,
        content: `Верхняя граница нормы: ${activeItem.refHigh}`,
        position: 'start',
        backgroundColor: 'rgba(245, 158, 11, 0.85)',
        color: '#fff',
        font: { size: 10 },
      },
    };
  }
  if (activeItem?.targetHigh !== null && activeItem?.targetHigh !== undefined) {
    singleAnnotations.targetLine = {
      type: 'line',
      yMin: activeItem.targetHigh,
      yMax: activeItem.targetHigh,
      borderColor: '#ef4444',
      borderWidth: 1.5,
      borderDash: [4, 4],
      label: {
        display: true,
        content: `Клиническая цель < ${activeItem.targetHigh}`,
        position: 'end',
        backgroundColor: 'rgba(239, 68, 68, 0.88)',
        color: '#fff',
        font: { size: 10 },
      },
    };
  }

  const singleChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      annotation: { annotations: singleAnnotations },
    },
  };

  const activeRecords = db.labResults
    .filter((r) => r.analyte === activeItem?.analyte)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
            Лабораторная аналитика (2024–2026)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Всего верифицированных измерений в базе: {db.labResults.length} по{' '}
            {Object.keys(db.latestByAnalyte).length} показателям
          </p>
        </div>
      </div>

      {/* ── Переключатель групп анализов ── */}
      <div className="flex flex-wrap gap-2">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => {
              setActiveGroup(g.id);
              setSearchParams({ group: g.id });
            }}
            className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              activeGroup === g.id
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* ── Главный график липидного спектра и гиполипидемической терапии ── */}
      {(activeGroup === 'lipids' || activeGroup === 'all') && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Динамика липидного профиля и ответ на статинотерапию (2024–2026)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Снижение ЛПНП на 52% (с 4.06 до 1.95 ммоль/л). Нажмите на легенду, чтобы скрыть/показать линии.
              </p>
            </div>
            <span className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-300">
              Цель ЛПНП &lt; 1.8 ммоль/л (осталось −0.15)
            </span>
          </div>

          <div className="h-72 w-full sm:h-80">
            <Line data={lipidChartData} options={lipidChartOptions} />
          </div>

          {/* Шкала событий терапии под графиком */}
          <div className="mt-4 grid gap-2.5 border-t border-slate-100 pt-4 text-xs sm:grid-cols-3 dark:border-slate-800">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60">
              <div className="font-bold text-slate-800 dark:text-slate-200">1. Июнь 2025: Старт терапии</div>
              <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                Назначен Розувастатин 10 мг после КТ-коронарографии (CAC 288). К 03.09.2025 ЛПНП снизился с 4.06 до
                1.97 ммоль/л.
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60">
              <div className="font-bold text-slate-800 dark:text-slate-200">2. Июль–Октябрь 2025: Смена статина</div>
              <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                Переход на Аторвастатин 10 мг + краткий перерыв перед анализом 15.10.2025 (Antėja) дали временный
                подъём ЛПНП до 3.28 ммоль/л.
              </p>
            </div>
            <div className="rounded-xl bg-emerald-500/8 p-3 border border-emerald-500/20">
              <div className="font-bold text-emerald-700 dark:text-emerald-300">
                3. Май 2026: Стабильный приём (Helix)
              </div>
              <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                ЛПНП 1.95 ммоль/л, Не-ЛПВП 2.24 ммоль/л, индекс ApoB/ApoA1 = 0.58 (оптимальный баланс). АЛТ 25.5 Ед/л,
                СКФ 106.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── Детальный разбор выбранного показателя + таблица всех бланков ── */}
      {activeItem && (
        <section className="grid gap-5 lg:grid-cols-12">
          {/* Левая колонка: список показателей выбранной группы */}
          <div className="space-y-2 lg:col-span-5">
            <h3 className="px-1 text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
              Показатели группы ({summaries.length}) — выберите для детализации
            </h3>
            <div className="max-h-[540px] space-y-2 overflow-y-auto pr-1">
              {summaries.map((item) => {
                const isSelected = item.analyte === activeItem.analyte;
                return (
                  <button
                    key={item.analyte}
                    type="button"
                    onClick={() => setSelectedAnalyte(item.analyte)}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500/8 shadow-xs dark:border-indigo-400 dark:bg-indigo-500/12'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-bold text-slate-900 dark:text-white">
                          {item.shortName}
                        </span>
                        {statusBadge(item.status, item.targetHigh)}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                        {item.nameRu} • {formatRuDate(item.date)}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-base font-bold text-slate-900 dark:text-white">
                        {item.value}{' '}
                        <span className="text-xs font-normal text-slate-500">{item.unit}</span>
                      </div>
                      {item.trendFromPrev.direction !== 'none' && item.trendFromPrev.delta !== null && (
                        <div className="inline-flex items-center gap-0.5 text-[11px] text-slate-500">
                          {item.trendFromPrev.direction === 'down' ? (
                            <ArrowDownRight size={13} className="text-emerald-500" />
                          ) : item.trendFromPrev.direction === 'up' ? (
                            <ArrowUpRight size={13} className="text-amber-500" />
                          ) : (
                            <Minus size={12} />
                          )}
                          {item.trendFromPrev.delta > 0 ? `+${item.trendFromPrev.delta}` : item.trendFromPrev.delta}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Правая колонка: график и таблица выбранного показателя */}
          <div className="space-y-4 lg:col-span-7">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <FlaskConical size={18} className="text-indigo-500" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {activeItem.nameRu} ({activeItem.analyte})
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Референс:{' '}
                    {activeItem.refLow !== null && activeItem.refHigh !== null
                      ? `${activeItem.refLow} – ${activeItem.refHigh} ${activeItem.unit}`
                      : activeItem.refHigh !== null
                        ? `< ${activeItem.refHigh} ${activeItem.unit}`
                        : activeItem.refLow !== null
                          ? `> ${activeItem.refLow} ${activeItem.unit}`
                          : 'индивидуальный'}
                    {activeItem.targetHigh !== null && ` • Клиническая цель: < ${activeItem.targetHigh} ${activeItem.unit}`}
                  </p>
                </div>
                {statusBadge(activeItem.status, activeItem.targetHigh)}
              </div>

              {singleHistory.length > 1 ? (
                <div className="mt-4 h-56 w-full">
                  <Line data={singleChartData} options={singleChartOptions} />
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                  <Info size={15} className="shrink-0 text-indigo-500" />
                  Показатель измерен однократно ({formatRuDate(activeItem.date)}):{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {activeItem.value} {activeItem.unit}
                  </strong>
                </div>
              )}

              {/* Таблица всех измерений выбранного маркера с кнопкой открытия PDF */}
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 dark:border-slate-800">
                      <th className="pb-2 font-semibold">Дата</th>
                      <th className="pb-2 font-semibold">Значение</th>
                      <th className="pb-2 font-semibold">Лаборатория / примечание</th>
                      <th className="pb-2 text-right font-semibold">Оригинал</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {activeRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 pr-2 font-medium whitespace-nowrap text-slate-800 dark:text-slate-200">
                          {formatRuDate(rec.date)}
                        </td>
                        <td className="py-2.5 pr-2 font-bold whitespace-nowrap text-slate-900 dark:text-white">
                          {rec.value} <span className="font-normal text-slate-400">{rec.unit}</span>
                        </td>
                        <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-300">
                          <span className="font-medium">{rec.lab}</span>
                          {rec.note && <span className="block text-[11px] text-slate-400">{rec.note}</span>}
                        </td>
                        <td className="py-2.5 text-right whitespace-nowrap">
                          {rec.documentPath ? (
                            <button
                              type="button"
                              onClick={() => openDocumentViewer(rec.documentPath!)}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                            >
                              <FileText size={12} />
                              Бланк
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
