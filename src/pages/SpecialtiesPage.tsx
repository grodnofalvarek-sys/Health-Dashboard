import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  FileText,
  HeartPulse,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { useHealthData } from '../context/HealthDataContext';
import { SPECIALTIES, formatRuDate } from '../config/specialties';
import type { SpecialtyId } from '../model/types';

export default function SpecialtiesPage() {
  const { db, openDocumentViewer } = useHealthData();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as SpecialtyId) || 'cardio';
  const [activeTab, setActiveTab] = useState<SpecialtyId>(
    ['cardio', 'uro', 'gastro', 'ortho', 'prev'].includes(initialTab) ? initialTab : 'cardio',
  );

  if (!db) return null;

  const tabs = SPECIALTIES.filter((s) => s.id !== 'lab');
  const specDocs = db.documents.filter((d) => d.specialty === activeTab);

  function selectTab(id: SpecialtyId) {
    setActiveTab(id);
    setSearchParams({ tab: id });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
          Клинические направления и инструментальная диагностика
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Детальные результаты КТ-коронарографии, мпМРТ простаты, МРТ тазобедренного сустава, УЗИ и нагрузочных проб
        </p>
      </div>

      {/* Вкладки направлений */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => selectTab(s.id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === s.id
                ? 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            <span className="size-2.5 rounded-full" style={{ background: s.hex }} />
            {s.label}
          </button>
        ))}
      </div>

      {/* ── 1. КАРДИОЛОГИЯ И СОСУДЫ ── */}
      {activeTab === 'cardio' && (
        <div className="space-y-6">
          <div className="grid gap-5 lg:grid-cols-12">
            {/* Схема коронарного русла и кальциевого индекса Agatston 288 */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    КТ-коронарография (04.06.2025, Каунас)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Agatston CAC = 288 (75–90-й перцентиль) • CAD-RADS 2/P2 • Правый тип кровоснабжения
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    openDocumentViewer(
                      '01_Кардиология_и_Сосуды/2025-06-04_КТ_Коронарография_CAC288_CAD-RADS2_Каунас.pdf',
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-500/12 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500/20 dark:text-red-400"
                >
                  <FileText size={14} />
                  Протокол КТ
                </button>
              </div>

              {/* Интерактивная SVG-схема коронарных артерий */}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="flex items-center justify-center rounded-2xl bg-slate-950 p-4 text-white">
                  <svg viewBox="0 0 260 220" className="w-full max-w-[240px]">
                    {/* Контур восходящей аорты */}
                    <path
                      d="M115 20 C115 55, 145 55, 145 20"
                      stroke="#94a3b8"
                      strokeWidth="3"
                      fill="none"
                    />
                    <text x="102" y="15" fill="#94a3b8" fontSize="10" fontWeight="bold">
                      Аорта 37 мм
                    </text>

                    {/* Ствол ЛКА (LM = 0) */}
                    <path d="M135 45 L165 65" stroke="#22c55e" strokeWidth="6" strokeLinecap="round" />
                    <text x="148" y="48" fill="#86efac" fontSize="10" fontWeight="bold">
                      LM (CAC 0)
                    </text>

                    {/* ПМЖВ (LAD = 11) + мышечный мостик S7 */}
                    <path
                      d="M165 65 Q155 125 140 195"
                      stroke="#eab308"
                      strokeWidth="4.5"
                      strokeLinecap="round"
                      fill="none"
                    />
                    {/* Мышечный мостик в S7 */}
                    <path
                      d="M156 112 Q152 130 149 145"
                      stroke="#38bdf8"
                      strokeWidth="7"
                      strokeDasharray="3 3"
                      fill="none"
                    />
                    <text x="162" y="118" fill="#fde047" fontSize="9.5" fontWeight="bold">
                      ПМЖВ / LAD (CAC 11)
                    </text>
                    <text x="162" y="131" fill="#7dd3fc" fontSize="8.5">
                      S6/7: 25–30% • Мостик S7 20мм
                    </text>

                    {/* Огибающая артерия (LCX = 268) */}
                    <path
                      d="M165 65 Q210 95 215 160"
                      stroke="#f97316"
                      strokeWidth="5"
                      strokeLinecap="round"
                      fill="none"
                    />
                    <circle cx="196" cy="95" r="6" fill="#ef4444" />
                    <text x="175" y="82" fill="#fdba74" fontSize="9.5" fontWeight="bold">
                      ОА / LCX (CAC 268)
                    </text>
                    <text x="172" y="175" fill="#fca5a5" fontSize="8.5">
                      S11: стеноз 25–49%
                    </text>

                    {/* Правая коронарная артерия (RCA = 9) */}
                    <path
                      d="M122 45 Q65 95 85 180"
                      stroke="#22c55e"
                      strokeWidth="4.5"
                      strokeLinecap="round"
                      fill="none"
                    />
                    <text x="18" y="88" fill="#86efac" fontSize="9.5" fontWeight="bold">
                      ПКА / RCA (CAC 9)
                    </text>
                    <text x="18" y="101" fill="#cbd5e1" fontSize="8.5">
                      S1: бляшка &lt; 25%
                    </text>
                  </svg>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                    <div className="font-bold text-emerald-600 dark:text-emerald-400">
                      Ствол ЛКА (LM) — CAC 0
                    </div>
                    <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                      Кальциноза и стенозов нет, проходимость полностью сохранена.
                    </p>
                  </div>
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                    <div className="font-bold text-amber-600 dark:text-amber-400">
                      Огибающая (LCX) — CAC 268 (основной вклад)
                    </div>
                    <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                      В проксимальном сегменте S11 эксцентрическая кальцинированная бляшка со стенозом{' '}
                      <strong>25–49%</strong> (гемодинамически незначимый, CAD-RADS 2).
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                    <div className="font-bold text-sky-600 dark:text-sky-400">
                      ПМЖВ (LAD) — CAC 11 + мышечный мостик
                    </div>
                    <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                      S6 &lt; 25%, S6/S7 25–30%. В среднем сегменте S7 интрамиокардиальный ход («мостик») длиной 20 мм
                      на глубине 1.5–2 мм.
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      Внесердечные находки КТ ОГК
                    </div>
                    <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                      Субплевральный узелок средней доли правого лёгкого 4×3 мм (контроль КТ через 12 мес. в марте 2027).
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Сравнение нагрузочных проб + ЭхоКГ + Холтер + УЗИ БЦА */}
            <div className="space-y-4 lg:col-span-5">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Сравнение нагрузочных проб (2025 → 2026)
                </h3>
                <div className="mt-3 space-y-2.5 text-xs">
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60">
                    <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                      <span>10.01.2025 — Тредмил-тест (Вильнюс)</span>
                      <span className="text-amber-500">Сомнительный</span>
                    </div>
                    <p className="mt-1 text-slate-500 dark:text-slate-400">
                      Нагрузка 11.7 METS, ЧСС 155 уд/мин (95%), АД 166/80. Болей нет, но отмечена косовосходящая
                      депрессия ST → направлен на КТ-КАГ.
                    </p>
                  </div>

                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-3">
                    <div className="flex items-center justify-between font-semibold text-emerald-700 dark:text-emerald-300">
                      <span>27.02.2026 — Велоэргометрия (Каунас)</span>
                      <span>Отрицательная ✓</span>
                    </div>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">
                      Мощность <strong>175 Вт</strong>, ЧСС 77 → 144 уд/мин (90%), АД 133/88 → 205/89. Ишемических
                      изменений ST, стенокардии и аритмий не выявлено. Высокая толерантность к нагрузке.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  ЭхоКГ, Холтер и УЗИ брахиоцефальных артерий
                </h3>
                <ul className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <li>
                    <strong className="text-slate-900 dark:text-white">ЭхоКГ (24.06.2025):</strong> ФВ ЛЖ{' '}
                    <strong>55%</strong>, КДД ЛЖ 50 мм, МЖП 10.5 мм, восходящая аорта 37 мм, умеренный фиброз створок
                    АК без стеноза.
                  </li>
                  <li>
                    <strong className="text-slate-900 dark:text-white">Холтер ЭКГ (17.02.2026):</strong> синусовый ритм,
                    средняя ЧСС 73 уд/мин (54–126), редкая экстрасистолия, пауз &gt; 2.0 с и ишемии нет.
                  </li>
                  <li>
                    <strong className="text-slate-900 dark:text-white">УЗИ БЦА (05.05.2026, ЛОДЭ):</strong> КИМ 0.9 мм.
                    В бифуркации правой ОСА бляшка <strong>15%</strong>, левой ОСА — <strong>20%</strong>. Кровоток
                    магистральный.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. УРОЛОГИЯ ── */}
      {activeTab === 'uro' && (
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Мультипараметрическая МРТ простаты 3Т (25.10.2025)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Вильнюс (InMedica / Kardiolita) • Категория PI-RADS 2 (клинически значимый рак маловероятен)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    openDocumentViewer('02_Урология/2025-10-25_МРТ_Простаты_PI-RADS2_Описание_Вильнюс.pdf')
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-500/12 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-500/20 dark:text-blue-400"
                >
                  <FileText size={14} />
                  Протокол мпМРТ
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-3.5 text-xs dark:bg-slate-950/60">
                  <div className="text-slate-400">Объём простаты</div>
                  <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">35 мл (МРТ)</div>
                  <div className="text-[11px] text-slate-500">75 мл в острую фазу 10.2024 → 47 мл УЗИ 04.2026</div>
                </div>
                <div className="rounded-2xl bg-blue-500/8 p-3.5 text-xs border border-blue-500/20">
                  <div className="text-blue-600 dark:text-blue-400 font-semibold">Оценка PI-RADS v2.1</div>
                  <div className="mt-1 text-lg font-bold text-blue-700 dark:text-blue-300">PI-RADS 2</div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300">
                    Очагов с ограничением диффузии (PI-RADS ≥ 3) нет
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3.5 text-xs dark:bg-slate-950/60">
                  <div className="text-slate-400">ПСА общий (28.04.2026)</div>
                  <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">6.62 мкг/л</div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                    ↓ с 7.015 мкг/л (15.10.2025)
                  </div>
                </div>
              </div>
            </div>

            {/* Антибиотикограмма посева мочи (Октябрь 2024) */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Справочник чувствительности микрофлоры (посев от 21.10.2024)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Возбудитель эпизода ОМП 10.2024: <em>Escherichia coli</em> (&gt; 10⁵ КОЕ/мл)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openDocumentViewer('02_Урология/2024-10-21_Посев_мочи_E-coli_Друскининкай.pdf')}
                  className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  Бланк посева →
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                {[
                  { drug: 'Ципрофлоксацин', status: 'S (чувствителен)', ok: true },
                  { drug: 'Норфлоксацин', status: 'S (чувствителен)', ok: true },
                  { drug: 'Нитрофурантоин', status: 'S (чувствителен)', ok: true },
                  { drug: 'Фосфомицин', status: 'S (чувствителен)', ok: true },
                  { drug: 'Цефуроксим / Цефадроксил', status: 'S (чувствителен)', ok: true },
                  { drug: 'Амоксициллин / клавуланат', status: 'S (чувствителен)', ok: true },
                  { drug: 'Ампициллин', status: 'R (резистентен)', ok: false },
                ].map((ab) => (
                  <div
                    key={ab.drug}
                    className={`rounded-xl border p-2.5 ${
                      ab.ok
                        ? 'border-emerald-500/25 bg-emerald-500/6 text-emerald-800 dark:text-emerald-200'
                        : 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
                    }`}
                  >
                    <div className="font-bold">{ab.drug}</div>
                    <div className="text-[11px] opacity-80">{ab.status}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4 lg:col-span-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Купирование острого воспаления (Октябрь–Ноябрь 2024)
              </h3>
              <ul className="mt-3 space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                <li>
                  <strong className="text-slate-900 dark:text-white">15.10.2024 (Приёмный покой):</strong> острая
                  задержка/инфекция МВП, СРБ <strong>190.98 мг/л</strong>, лейкоциты 16.56×10⁹/л, отёк простаты до 75 мл.
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-white">18.10.2024 (3-й день терапии):</strong> СРБ снизился
                  в 5 раз до <strong>39.32 мг/л</strong>.
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-white">06.11.2024 (Контроль у уролога):</strong> СРБ{' '}
                  <strong>2.4 мг/л</strong> (полная нормализация), посев мочи стерилен.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. ГАСТРОЭНТЕРОЛОГИЯ И УЗИ БП ── */}
      {activeTab === 'gastro' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Динамика УЗИ органов брюшной полости (2025 → 2026)
            </h2>
            <div className="mt-4 space-y-3 text-xs">
              <div className="rounded-2xl border border-slate-200 p-3.5 dark:border-slate-800">
                <div className="font-bold text-slate-900 dark:text-white">08.01.2025 — УЗИ ОБП (Друскининкай)</div>
                <p className="mt-1 text-slate-600 dark:text-slate-300">
                  В желчном пузыре одиночный конкремент около <strong>12 мм</strong>, стенки не утолщены, признаков
                  холецистита нет. Печень и поджелудочная железа без очаговой патологии.
                </p>
              </div>
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/6 p-3.5">
                <div className="font-bold text-amber-700 dark:text-amber-300">06.05.2026 — УЗИ ОБП (ЛОДЭ, Гродно)</div>
                <p className="mt-1 text-slate-600 dark:text-slate-300">
                  Желчный пузырь 82×29 мм, стенка 2 мм (не утолщена), в просвете густая желчь и конкремент{' '}
                  <strong>10–15 мм</strong>. Холедох 8 мм, внутрипечёночные протоки не расширены. Киста правой почки 13×11
                  мм.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Лабораторная панель печени и поджелудочной железы
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Отсутствие холестаза и гепатотоксичности на фоне приёма Аторвастатина 10 мг (05.05.2026)
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs sm:grid-cols-3">
              {[
                { label: 'АЛТ (ALT)', val: '25.5 Ед/л', ref: 'норма < 41' },
                { label: 'АСТ (AST)', val: '21.8 Ед/л', ref: 'норма < 40' },
                { label: 'ГГТП (GGT)', val: '15 Ед/л', ref: 'норма < 60' },
                { label: 'ЩФ (ALP)', val: '45 Ед/л', ref: 'норма 40–129' },
                { label: 'Билирубин общ.', val: '12.1 мкмоль/л', ref: 'норма < 21' },
                { label: 'Липаза', val: '36.72 Ед/л', ref: 'норма 13–60' },
              ].map((m) => (
                <div key={m.label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60">
                  <div className="text-slate-400">{m.label}</div>
                  <div className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">{m.val}</div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400">{m.ref}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 4. ОРТОПЕДИЯ И ТРАВМАТОЛОГИЯ ── */}
      {activeTab === 'ortho' && (
        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Диагностический маршрут: боль в левой нижней конечности (Октябрь 2026)
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Последовательное исключение костной и суставной патологии левого ТБС и колена
            </p>

            <div className="mt-5 grid gap-3.5 md:grid-cols-5">
              {[
                {
                  date: '08.10.2026',
                  title: '1. Направления E027',
                  desc: 'Семейный врач выдал 3 направления: рентген, ортопед-травматолог и сосудистый хирург.',
                  done: true,
                },
                {
                  date: '12.10.2026',
                  title: '2. Рентген таза и колена',
                  desc: 'Суставные щели обоих ТБС и левого коленного сустава сохранены, костной деструкции нет.',
                  done: true,
                },
                {
                  date: '20.10.2026',
                  title: '3. Осмотр ортопеда',
                  desc: 'Клинически M65.85 (подозрение на бурсит/тендинопатию). Назначено МРТ левого ТБС 1.5Т.',
                  done: true,
                },
                {
                  date: '23.10.2026',
                  title: '4. МРТ левого ТБС ✓',
                  desc: 'Affidea Алитус: Be žymesnių MR SI pakitimų. Выпота, бурсита, коксартроза и разрыва губы НЕТ.',
                  done: true,
                },
                {
                  date: 'Следующий шаг',
                  title: '5. Сосудистый хирург',
                  desc: 'УЗДГ артерий и вен нижних конечностей по уже имеющемуся направлению E027.',
                  done: false,
                },
              ].map((step) => (
                <div
                  key={step.title}
                  className={`flex flex-col justify-between rounded-2xl border p-3.5 text-xs ${
                    step.done
                      ? 'border-emerald-500/30 bg-emerald-500/6'
                      : 'border-amber-500/40 bg-amber-500/10'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between font-semibold">
                      <span className={step.done ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}>
                        {step.date}
                      </span>
                      {step.done ? (
                        <CheckCircle2 size={15} className="text-emerald-500" />
                      ) : (
                        <Clock size={15} className="text-amber-500" />
                      )}
                    </div>
                    <div className="mt-1.5 font-bold text-slate-900 dark:text-white">{step.title}</div>
                    <p className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 5. ПРОФИЛАКТИКА И РЕАБИЛИТАЦИЯ ── */}
      {activeTab === 'prev' && (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <ShieldCheck size={18} className="text-teal-500" />
              Иммунопрофилактика и скрининговые программы
            </h2>
            <ul className="mt-4 space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <li className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60">
                <strong className="text-slate-900 dark:text-white">Клещевой энцефалит (TicoVac 0.5 мл):</strong> Доза 1
                введена <strong>26.04.2025</strong>, Доза 2 — <strong>17.05.2025</strong> (Meliva Друскининкай). Для
                завершения первичного курса требуется 3-я доза (5–12 мес. после второй).
              </li>
              <li className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60">
                <strong className="text-slate-900 dark:text-white">Скрининг колоректального рака (12.03.2025):</strong>{' '}
                иммунохимический тест кала на скрытую кровь (iFOB) — <strong>отрицательный</strong>.
              </li>
              <li className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60">
                <strong className="text-slate-900 dark:text-white">Скрининг вирусного гепатита С (12.03.2025):</strong>{' '}
                антитела Anti-HCV — <strong>отрицательный</strong>.
              </li>
              <li className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60">
                <strong className="text-slate-900 dark:text-white">Рентгенография ОГК (10.01.2025):</strong> лёгкие без
                очаговых и инфильтративных изменений.
              </li>
            </ul>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <HeartPulse size={18} className="text-teal-500" />
              Санаторно-курортная реабилитация (Grand SPA Lietuva)
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              С <strong>27.04.2025 по 09.05.2025</strong> проведён комплексный курс бальнео- и физиотерапии в санатории
              «Grand SPA Lietuva» (Друскининкай) по поводу остеохондроза позвоночника и миалгии с положительным
              функциональным эффектом.
            </p>
            <button
              type="button"
              onClick={() =>
                openDocumentViewer(
                  '06_Профилактика_Реабилитация_Разное/2025-05-09_Санаторная_выписка_Реабилитация_Grand-SPA_Друскининкай.pdf',
                )
              }
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-teal-500/12 px-3.5 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-500/20 dark:text-teal-300"
            >
              <FileText size={14} />
              Открыть санаторную выписку
            </button>
          </div>
        </div>
      )}

      {/* ── Документы выбранного направления ── */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <Stethoscope size={16} className="text-slate-400" />
          Оригиналы документов направления ({specDocs.length})
        </h3>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {specDocs.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => openDocumentViewer(doc)}
              className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-left text-xs transition hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:bg-slate-800"
            >
              <FileText size={16} className="mt-0.5 shrink-0 text-indigo-500" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-slate-900 dark:text-slate-100">{doc.titleRu}</div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {formatRuDate(doc.date)} • {doc.clinic}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
