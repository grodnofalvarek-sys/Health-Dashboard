import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  CheckCircle2,
  FileText,
  HeartPulse,
  Pill,
  ShieldAlert,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { useHealthData } from '../context/HealthDataContext';
import { formatRuDate, getSpecialty } from '../config/specialties';

function MiniSparkline({
  points,
  color,
  targetLine,
}: {
  points: number[];
  color: string;
  targetLine?: number;
}) {
  if (points.length < 2) return null;
  const all = targetLine !== undefined ? [...points, targetLine] : points;
  const min = Math.min(...all) * 0.9;
  const max = Math.max(...all) * 1.05;
  const range = max - min || 1;
  const w = 120;
  const h = 36;

  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * (w - 8) + 4;
    const y = h - 4 - ((v - min) / range) * (h - 8);
    return { x, y };
  });

  const pathD = coords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = coords[coords.length - 1];
  const targetY =
    targetLine !== undefined ? h - 4 - ((targetLine - min) / range) * (h - 8) : null;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      {targetY !== null && (
        <line
          x1={0}
          y1={targetY}
          x2={w}
          y2={targetY}
          stroke="#ef4444"
          strokeDasharray="3 3"
          strokeWidth={1}
          opacity={0.7}
        />
      )}
      <path d={pathD} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r={3.2} fill={color} />
    </svg>
  );
}

export default function OverviewPage() {
  const { db, openDocumentViewer } = useHealthData();
  if (!db) return null;

  const ldl = db.latestByAnalyte.LDL;
  const apobRatio = db.latestByAnalyte.APOB_APOA1;
  const apob = db.latestByAnalyte.APOB;
  const apoa1 = db.latestByAnalyte.APOA1;
  const psa = db.latestByAnalyte.PSA;
  const egfr = db.latestByAnalyte.EGFR;
  const crea = db.latestByAnalyte.CREA;
  const alt = db.latestByAnalyte.ALT;
  const activeMeds = db.medications.filter((m) => m.active);
  const recentEvents = db.clinicalEvents.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* ── Паспорт пациента и активная терапия ── */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/12 px-3 py-1 text-xs font-semibold text-red-600 dark:text-red-400">
                <HeartPulse size={14} />
                Мужчина, 59 лет (25.06.1967)
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                ИМТ {db.patient.anthropometry.bmi} кг/м² ({db.patient.anthropometry.heightCm} см /{' '}
                {db.patient.anthropometry.weightKg} кг)
              </span>
              <span className="rounded-full bg-amber-500/12 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                SCORE2: {db.patient.anthropometry.score2Percent}% (высокий СС-риск)
              </span>
            </div>

            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
              Клиническая сводка (2024–2026)
            </h1>

            <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200">
                <Pill size={14} className="text-indigo-500" />
                Постоянная терапия:
              </span>
              {activeMeds.map((m) => (
                <span
                  key={m.id}
                  className="rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-0.5 font-medium text-indigo-700 dark:text-indigo-300"
                >
                  {m.drugRu} ({m.dose})
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/visit"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              <UserRound size={16} />
              Визит к врачу (RU / LT)
            </Link>
            <Link
              to="/documents"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <FileText size={16} />
              Архив ({db.documents.length})
            </Link>
          </div>
        </div>
      </section>

      {/* ── Bento-сетка из 6 ключевых KPI-карточек ── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* 1. ЛПНП */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Холестерин ЛПНП (LDL)
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {ldl?.value ?? 1.95}
                </span>
                <span className="text-xs text-slate-500">{ldl?.unit ?? 'ммоль/л'}</span>
              </div>
            </div>
            <span className="rounded-lg border border-amber-500/30 bg-amber-500/12 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              Выше цели &lt; 1.8
            </span>
          </div>

          <div className="my-3 flex items-center justify-between">
            <div className="space-y-0.5 text-xs">
              <div className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                <ArrowDownRight size={15} />
                −52% от пика 4.06 ммоль/л
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                До цели: −0.15 ммоль/л ({formatRuDate(ldl?.date)})
              </div>
            </div>
            {ldl && (
              <MiniSparkline
                points={ldl.history.map((h) => h.value)}
                color="#f59e0b"
                targetLine={1.8}
              />
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs dark:border-slate-800">
            <span className="text-slate-400">Аторвастатин 10 мг</span>
            <Link to="/labs?group=lipids" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
              График липидов →
            </Link>
          </div>
        </div>

        {/* 2. ApoB / ApoA1 */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Индекс ApoB / ApoA1
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {apobRatio?.value ?? 0.58}
                </span>
                <span className="text-xs text-slate-500">норма &lt; 0.70</span>
              </div>
            </div>
            <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/12 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              Оптимально
            </span>
          </div>

          <div className="my-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2.5 text-xs dark:bg-slate-950/60">
            <div>
              <div className="text-slate-400">ApoB (атерогенный)</div>
              <div className="font-bold text-slate-800 dark:text-slate-100">
                {apob?.value ?? 0.72} г/л <span className="font-normal text-emerald-500">(&lt; 1.0)</span>
              </div>
            </div>
            <div>
              <div className="text-slate-400">ApoA1 (защитный)</div>
              <div className="font-bold text-slate-800 dark:text-slate-100">
                {apoa1?.value ?? 1.25} г/л
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs dark:border-slate-800">
            <span className="text-slate-400">Helix ({formatRuDate(apob?.date)})</span>
            {apob?.documentPath && (
              <button
                type="button"
                onClick={() => openDocumentViewer(apob.documentPath!)}
                className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Бланк PDF →
              </button>
            )}
          </div>
        </div>

        {/* 3. Коронарный статус */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Коронарный статус и ЭхоКГ
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  CAC {db.patient.anthropometry.cacAgatston}
                </span>
                <span className="text-xs text-slate-500">{db.patient.anthropometry.cadRads}</span>
              </div>
            </div>
            <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/12 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              ВЭМ 175 Вт (−)
            </span>
          </div>

          <div className="my-3 grid grid-cols-3 gap-1.5 rounded-xl bg-slate-50 p-2.5 text-xs dark:bg-slate-950/60">
            <div>
              <div className="text-slate-400">ФВ ЛЖ</div>
              <div className="font-bold text-slate-800 dark:text-slate-100">
                {db.patient.anthropometry.lvefPercent}%
              </div>
            </div>
            <div>
              <div className="text-slate-400">Аорта</div>
              <div className="font-bold text-slate-800 dark:text-slate-100">
                {db.patient.anthropometry.ascendingAortaMm} мм
              </div>
            </div>
            <div>
              <div className="text-slate-400">БЦА стеноз</div>
              <div className="font-bold text-slate-800 dark:text-slate-100">15–20%</div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs dark:border-slate-800">
            <span className="text-slate-400">LM 0 • LAD 11 • LCX 268 • RCA 9</span>
            <Link to="/specialties?tab=cardio" className="font-semibold text-red-600 hover:underline dark:text-red-400">
              Схема артерий →
            </Link>
          </div>
        </div>

        {/* 4. Урология (ПСА + PI-RADS 2) */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                ПСА общий и простата
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {psa?.value ?? 6.62}
                </span>
                <span className="text-xs text-slate-500">{psa?.unit ?? 'мкг/л'} (норма &lt; 4.0)</span>
              </div>
            </div>
            <span className="rounded-lg border border-blue-500/30 bg-blue-500/12 px-2.5 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
              мпМРТ PI-RADS 2
            </span>
          </div>

          <div className="my-3 flex items-center justify-between">
            <div className="space-y-0.5 text-xs">
              <div className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                <ArrowDownRight size={15} />
                Снижение с 7.015 → 6.62 мкг/л
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                ДГПЖ ({db.patient.anthropometry.prostateVolumeMl} мл), очагов PI-RADS ≥ 3 нет
              </div>
            </div>
            {psa && <MiniSparkline points={psa.history.map((h) => h.value)} color="#3b82f6" targetLine={4.0} />}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs dark:border-slate-800">
            <span className="text-slate-400">fPSA 0.45 мкг/л • СРБ 2.4 мг/л</span>
            <Link to="/specialties?tab=uro" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
              Урология →
            </Link>
          </div>
        </div>

        {/* 5. Безопасность терапии (Почки и Печень) */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Функция почек и печени
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  СКФ {egfr?.value ?? 106}
                </span>
                <span className="text-xs text-slate-500">мл/мин/1.73м²</span>
              </div>
            </div>
            <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/12 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              Норма на статинах
            </span>
          </div>

          <div className="my-3 grid grid-cols-3 gap-1.5 rounded-xl bg-slate-50 p-2.5 text-xs dark:bg-slate-950/60">
            <div>
              <div className="text-slate-400">Креатинин</div>
              <div className="font-bold text-slate-800 dark:text-slate-100">{crea?.value ?? 63.2}</div>
            </div>
            <div>
              <div className="text-slate-400">АЛТ</div>
              <div className="font-bold text-slate-800 dark:text-slate-100">{alt?.value ?? 25.5} Ед/л</div>
            </div>
            <div>
              <div className="text-slate-400">Желчный</div>
              <div className="font-bold text-amber-600 dark:text-amber-400">конкр. 10–15 мм</div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs dark:border-slate-800">
            <span className="text-slate-400">Контроль от 05.05.2026</span>
            <Link to="/labs?group=renal" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
              Печень и почки →
            </Link>
          </div>
        </div>

        {/* 6. Ортопедия и сосуды (Октябрь 2026) */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Диагностика левой ноги (10.2026)
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-lg font-bold text-slate-900 dark:text-white">
                  МРТ ТБС — без патологии
                </span>
              </div>
            </div>
            <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/12 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              23.10.2026 ✓
            </span>
          </div>

          <p className="my-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            Рентген таза и колена (12.10) и МРТ левого ТБС (23.10, Affidea) исключили коксартроз, бурсит и
            разрыв губы. Следующий шаг —{' '}
            <strong className="text-slate-900 dark:text-white">консультация сосудистого хирурга</strong> (направление
            E027).
          </p>

          <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs dark:border-slate-800">
            <button
              type="button"
              onClick={() =>
                openDocumentViewer(
                  '04_Ортопедия_и_Травматология/2026-10-23_МРТ_Левый_тазобедренный_сустав_Описание_Affidea_Алитус.pdf',
                )
              }
              className="font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Открыть МРТ ТБС →
            </button>
            <Link to="/visit" className="font-semibold text-slate-700 hover:underline dark:text-slate-200">
              Памятка сосуд. хирургу →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Блок «Требует внимания и предстоящие шаги» ── */}
      <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 dark:border-amber-500/20 dark:bg-amber-500/5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <ShieldAlert size={18} className="text-amber-500" />
            Требует внимания и контроля ({db.attentionItems.length})
          </h2>
          <Link
            to="/plan"
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:underline dark:text-amber-300"
          >
            Все контрольные точки и календарь <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {db.attentionItems.map((item) => {
            const spec = getSpecialty(item.specialty);
            return (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/90"
              >
                <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border ${spec.bgSoft}`}>
                  <AlertTriangle size={15} />
                </span>
                <div className="min-w-0 flex-1 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="font-bold text-slate-900 dark:text-slate-100">{item.titleRu}</span>
                    <span className="text-[11px] text-slate-400">{formatRuDate(item.date)}</span>
                  </div>
                  <p className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">{item.detailRu}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Активные диагнозы по направлениям (с МКБ-10 и терапией) ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
            <Stethoscope size={18} className="text-slate-500" />
            Основные диагнозы (МКБ-10) и статус по системам
          </h2>
          <Link
            to="/specialties"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:underline dark:text-slate-300"
          >
            Подробный разбор направлений <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid gap-3.5 md:grid-cols-2">
          {db.diagnoses.map((d) => {
            const spec = getSpecialty(d.specialty);
            return (
              <div
                key={d.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-xs font-semibold ${spec.bgSoft}`}>
                      {d.domain} • {d.code}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                        d.statusLevel === 'attention'
                          ? 'bg-amber-500/12 text-amber-600 dark:text-amber-400'
                          : 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      <CheckCircle2 size={12} />
                      {d.status}
                    </span>
                  </div>
                  <h3 className="mt-2.5 text-sm font-bold text-slate-900 dark:text-slate-100">{d.titleRu}</h3>
                  <p className="mt-1 text-xs italic text-slate-400 dark:text-slate-500">LT: {d.titleLt}</p>
                </div>

                <div className="mt-3 border-t border-slate-100 pt-2.5 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
                  <strong className="text-slate-800 dark:text-slate-200">Тактика / терапия:</strong> {d.therapy}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Последние клинические события ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
            <Activity size={18} className="text-slate-500" />
            Последние обследования и консультации
          </h2>
          <Link
            to="/timeline"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:underline dark:text-slate-300"
          >
            Вся хронология ({db.clinicalEvents.length}) <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {recentEvents.map((ev) => {
            const spec = getSpecialty(ev.specialty);
            return (
              <div
                key={ev.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className={`rounded-md border px-2 py-0.5 font-semibold ${spec.bgSoft}`}>
                      {spec.shortLabel}
                    </span>
                    <span className="font-medium text-slate-400">
                      {formatRuDate(ev.date)} • {ev.clinic}
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-bold text-slate-900 dark:text-slate-100">{ev.titleRu}</h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {ev.findingsRu}
                  </p>
                </div>

                {ev.documentPaths.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                    {ev.documentPaths.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => openDocumentViewer(p)}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <FileText size={13} />
                        Открыть документ
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
