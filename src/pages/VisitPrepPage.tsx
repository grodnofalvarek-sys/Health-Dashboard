import { useState } from 'react';
import {
  Check,
  Copy,
  HelpCircle,
  Languages,
  Maximize2,
  Minimize2,
  Pill,
  Printer,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { useHealthData } from '../context/HealthDataContext';
import { getSpecialty } from '../config/specialties';

export default function VisitPrepPage() {
  const { db } = useHealthData();
  const [selectedId, setSelectedId] = useState<string>('visit-vascular');
  const [langMode, setLangMode] = useState<'both' | 'lt' | 'ru'>('both');
  const [doctorScreenMode, setDoctorScreenMode] = useState(false);
  const [copiedLang, setCopiedLang] = useState<'lt' | 'ru' | null>(null);

  if (!db) return null;

  const template = db.visitTemplates.find((t) => t.id === selectedId) ?? db.visitTemplates[0];
  const activeMeds = db.medications.filter((m) => m.active);
  const spec = getSpecialty(template.specialty);

  function buildPlainText(lang: 'lt' | 'ru') {
    if (!db) return '';
    if (lang === 'lt') {
      return [
        `PACIENTO ATMINTINĖ GYDYTOJUI: ${template.specialistLt.toUpperCase()}`,
        `Pacientas: Vyras, gim. 1967-06-25 (59 m.), KMI ${db.patient.anthropometry.bmi} kg/m² (${db.patient.anthropometry.heightCm} cm / ${db.patient.anthropometry.weightKg} kg)`,
        '',
        `KREIPIMOSI PRIEŽASTIS:`,
        template.reasonLt,
        '',
        `NUOLAT VARTOJAMI VAISTAI:`,
        ...activeMeds.map((m) => `- ${m.drugLt}`),
        '',
        `SVARBIAUSI TYRIMŲ DUOMENYS (2024–2026):`,
        ...template.keyFactsLt.map((f) => `• ${f}`),
        '',
        `KLAUSIMAI GYDYTOJUI:`,
        ...template.questionsLt.map((q, i) => `${i + 1}. ${q}`),
      ].join('\n');
    }

    return [
      `КАРТОЧКА ПАЦИЕНТА ДЛЯ ВИЗИТА К ВРАЧУ: ${template.specialistRu.toUpperCase()}`,
      `Пациент: Мужчина, 25.06.1967 г.р. (59 лет), ИМТ ${db.patient.anthropometry.bmi} кг/м² (${db.patient.anthropometry.heightCm} см / ${db.patient.anthropometry.weightKg} кг)`,
      '',
      `ПОВОД ОБРАЩЕНИЯ:`,
      template.reasonRu,
      '',
      `ПОСТОЯННАЯ ТЕРАПИЯ:`,
      ...activeMeds.map((m) => `- ${m.drugRu} (${m.dose})`),
      '',
      `КЛЮЧЕВЫЕ ОБЪЕКТИВНЫЕ ДАННЫЕ (2024–2026):`,
      ...template.keyFactsRu.map((f) => `• ${f}`),
      '',
      `ВОПРОСЫ К ВРАЧУ:`,
      ...template.questionsRu.map((q, i) => `${i + 1}. ${q}`),
    ].join('\n');
  }

  async function handleCopy(lang: 'lt' | 'ru') {
    const text = buildPlainText(lang);
    await navigator.clipboard.writeText(text);
    setCopiedLang(lang);
    setTimeout(() => setCopiedLang(null), 2200);
  }

  return (
    <div
      className={
        doctorScreenMode
          ? 'fixed inset-0 z-50 overflow-y-auto bg-white p-5 text-slate-900 sm:p-10 dark:bg-slate-950 dark:text-slate-100'
          : 'space-y-6'
      }
    >
      {/* Панель управления (скрывается при печати) */}
      <div className="no-print flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
            Подготовка к визиту к врачу (RU / LT)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Готовые клинические выписки и вопросы узким специалистам на русском и литовском языках
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleCopy('lt')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-500/20 dark:text-indigo-300"
          >
            {copiedLang === 'lt' ? <Check size={14} /> : <Copy size={14} />}
            {copiedLang === 'lt' ? 'Скопировано (LT)!' : 'Скопировать LT'}
          </button>

          <button
            type="button"
            onClick={() => handleCopy('ru')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {copiedLang === 'ru' ? <Check size={14} /> : <Copy size={14} />}
            {copiedLang === 'ru' ? 'Скопировано (RU)!' : 'Скопировать RU'}
          </button>

          <button
            type="button"
            onClick={() => setDoctorScreenMode((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
          >
            {doctorScreenMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {doctorScreenMode ? 'Выйти из экранного режима' : 'Экран для врача'}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Printer size={14} />
            Печать A4
          </button>
        </div>
      </div>

      {/* Выбор врача и языка (скрывается при печати) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap gap-1.5">
          {db.visitTemplates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedId(t.id)}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                t.id === template.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {t.specialistRu}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-slate-200 p-1 text-xs dark:border-slate-800">
          <Languages size={14} className="mx-1.5 text-slate-400" />
          {[
            { id: 'both', label: 'RU + LT' },
            { id: 'lt', label: 'Только LT (врачу)' },
            { id: 'ru', label: 'Только RU' },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setLangMode(m.id as 'both' | 'lt' | 'ru')}
              className={`rounded-lg px-2.5 py-1 font-semibold ${
                langMode === m.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Печатная / Экранная карточка визита ── */}
      <article className="mx-auto max-w-4xl space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${spec.bgSoft}`}>
              <Stethoscope size={14} />
              {template.specialistRu} / {template.specialistLt}
            </span>
            <h2 className="mt-2 text-lg font-bold text-slate-900 sm:text-xl dark:text-white">
              {langMode === 'lt'
                ? `Konsultacijos atmintinė: ${template.specialistLt}`
                : `Клиническая сводка для консультации: ${template.specialistRu}`}
            </h2>
          </div>

          <div className="rounded-xl bg-slate-50 px-3.5 py-2 text-xs text-slate-600 dark:bg-slate-950/70 dark:text-slate-300">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
              <UserRound size={14} />
              Vyras / Мужчина, 25.06.1967 (59 m.)
            </div>
            <div>
              Ūgis {db.patient.anthropometry.heightCm} cm, svoris {db.patient.anthropometry.weightKg} kg, KMI{' '}
              {db.patient.anthropometry.bmi} kg/m²
            </div>
          </div>
        </header>

        {/* Повод обращения */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase">
            Повод обращения / Kreipimosi priežastis
          </h3>
          {langMode !== 'ru' && (
            <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/6 p-3.5 text-sm font-medium text-slate-900 dark:text-slate-100">
              <span className="mr-2 rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">LT</span>
              {template.reasonLt}
            </div>
          )}
          {langMode !== 'lt' && (
            <div className="rounded-2xl bg-slate-50 p-3.5 text-sm text-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
              <span className="mr-2 rounded bg-slate-300 px-1.5 py-0.5 text-[10px] font-bold text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                RU
              </span>
              {template.reasonRu}
            </div>
          )}
        </section>

        {/* Постоянно принимаемые препараты */}
        <section className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-400 uppercase">
            <Pill size={14} className="text-indigo-500" />
            Постоянно принимаемые лекарства / Nuolat vartojami vaistai
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {activeMeds.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800"
              >
                {langMode !== 'ru' && (
                  <div className="font-bold text-indigo-700 dark:text-indigo-300">LT: {m.drugLt}</div>
                )}
                {langMode !== 'lt' && (
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    RU: {m.drugRu} ({m.dose})
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Ключевые объективные факты */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase">
            Ключевые данные обследований (2024–2026) / Svarbiausi tyrimų duomenys
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {langMode !== 'ru' && (
              <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/5 p-4">
                <div className="mb-2 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                  Lietuvių kalba (Gydytojui):
                </div>
                <ul className="space-y-2 text-xs leading-relaxed text-slate-800 dark:text-slate-200">
                  {template.keyFactsLt.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-indigo-500" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {langMode !== 'lt' && (
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
                <div className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  На русском языке:
                </div>
                <ul className="space-y-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  {template.keyFactsRu.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-slate-400" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* Вопросы врачу */}
        <section className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-400 uppercase">
            <HelpCircle size={14} className="text-amber-500" />
            Вопросы к врачу на приёме / Klausimai gydytojui
          </h3>
          <div className="space-y-2.5">
            {template.questionsRu.map((qRu, idx) => {
              const qLt = template.questionsLt[idx];
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 p-3.5 text-xs dark:border-slate-800"
                >
                  {langMode !== 'ru' && qLt && (
                    <div className="font-bold text-slate-900 dark:text-white">
                      {idx + 1}. [LT] {qLt}
                    </div>
                  )}
                  {langMode !== 'lt' && (
                    <div className={langMode === 'both' ? 'mt-1 text-slate-600 dark:text-slate-300' : 'font-bold text-slate-900 dark:text-white'}>
                      {idx + 1}. [RU] {qRu}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </article>
    </div>
  );
}
