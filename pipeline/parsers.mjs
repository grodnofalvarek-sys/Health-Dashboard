// Расчёт статусов показателей относительно норм/целей и парсеры лабораторных бланков.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const refConfig = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'src', 'config', 'reference_ranges.json'), 'utf8'),
);

export const ANALYTES = refConfig.analytes;

/**
 * Вычисляет статус значения показателя относительно референсного диапазона и целевого уровня.
 * Важно: если задан целевой уровень (например, ЛПНП < 1.8 ммоль/л), а значение 1.95 —
 * статус будет 'above_target' (жёлтый «выше цели»), а НЕ зелёный.
 *
 * @param {string} analyteCode код показателя (LDL, PSA, CRP...)
 * @param {number} value числовое значение
 * @returns {'normal' | 'above_target' | 'high' | 'low'}
 */
export function evaluateLabStatus(analyteCode, value) {
  const spec = ANALYTES[analyteCode];
  if (!spec || typeof value !== 'number' || !Number.isFinite(value)) return 'normal';

  if (typeof spec.refLow === 'number' && value < spec.refLow) {
    return 'low';
  }
  if (typeof spec.refHigh === 'number' && value > spec.refHigh) {
    return 'high';
  }
  if (typeof spec.targetHigh === 'number' && value > spec.targetHigh) {
    return 'above_target';
  }
  return 'normal';
}

/**
 * Вычисляет тренд между предыдущим и текущим значением.
 * @param {number | null | undefined} previous
 * @param {number} current
 * @returns {{direction: 'up' | 'down' | 'stable' | 'none', delta: number | null, percent: number | null}}
 */
export function evaluateTrend(previous, current) {
  if (typeof previous !== 'number' || !Number.isFinite(previous)) {
    return { direction: 'none', delta: null, percent: null };
  }
  const delta = Number((current - previous).toFixed(3));
  const percent = previous !== 0 ? Number((((current - previous) / previous) * 100).toFixed(1)) : null;
  if (Math.abs(percent ?? 0) < 1.5) {
    return { direction: 'stable', delta, percent };
  }
  return {
    direction: delta > 0 ? 'up' : 'down',
    delta,
    percent,
  };
}

function toNum(str) {
  if (!str) return null;
  const n = Number(String(str).replace(',', '.').trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Извлекает лабораторные показатели из текста выписок e.sveikata, Meliva, InMedica/Kardiolita, Antėja, Helix.
 * @param {string} text текст документа
 * @returns {Array<{analyte: string, value: number, date?: string}>}
 */
export function parseLabValuesFromText(text) {
  if (!text) return [];
  const results = [];
  const add = (analyte, rawVal, date) => {
    const value = toNum(rawVal);
    if (value !== null) {
      results.push({ analyte, value, ...(date ? { date } : {}) });
    }
  };

  // 1. Формат e.sveikata E025: "Data: 2024-11-06. Tyrimas: ... Rezultatai: CODE (...) 4,06 (norma ...)"
  const esveikataRe =
    /Data:\s*(\d{4}-\d{2}-\d{2})\.\s*Tyrimas:\s*([^.]+)\.\s*Rezultatai:\s*([^\n]+)/gi;
  for (const m of text.matchAll(esveikataRe)) {
    const [, date, tyrimas, rez] = m;
    if (/Bendras cholesterolis/i.test(tyrimas)) {
      add('CHOL', rez.match(/CHOL\s*\([^)]+\)\s*(\d+[.,]\d+|\d+)/i)?.[1], date);
    } else if (/MTL cholesterolis/i.test(tyrimas)) {
      add('LDL', rez.match(/MTL CH\s*\([^)]+\)\s*(\d+[.,]\d+|\d+)/i)?.[1], date);
    } else if (/DTL cholesterolis/i.test(tyrimas) && !/Ne DTL/i.test(tyrimas)) {
      add('HDL', rez.match(/DTL CH\s*\([^)]+\)\s*(\d+[.,]\d+|\d+)/i)?.[1], date);
    } else if (/Ne DTL cholesterolis/i.test(tyrimas)) {
      add('NON_HDL', rez.match(/Ne DTL\s*\([^)]+\)\s*(\d+[.,]\d+|\d+)/i)?.[1], date);
    } else if (/Trigliceridai/i.test(tyrimas)) {
      add('TG', rez.match(/TG\s*\([^)]+\)\s*(\d+[.,]\d+|\d+)/i)?.[1], date);
    } else if (/C reaktyvinis baltymas/i.test(tyrimas)) {
      add('CRP', rez.match(/CRB\s*\([^)]+\)\s*(\d+[.,]\d+|\d+)/i)?.[1], date);
    } else if (/Prostatos specifinis antigenas/i.test(tyrimas)) {
      add('PSA', rez.match(/PSA\s*\([^)]+\)\s*(\d+[.,]\d+|\d+)/i)?.[1], date);
    } else if (/Kreatininas/i.test(tyrimas)) {
      add('CREA', rez.match(/CREA\s*\([^)]+\)\s*(\d+[.,]\d+|\d+)/i)?.[1], date);
      add('EGFR', rez.match(/formulę\)\s*\.\)\s*(\d+[.,]\d+|\d+)/i)?.[1], date);
    }
  }

  // 2. Формат Хеликс (Гродно)
  if (/Международная лаборатория Хеликс|HELIX/i.test(text)) {
    add('LIPASE', text.match(/Липаза\s+(\d+[.,]\d+|\d+)/i)?.[1]);
    add('CHOL', text.match(/Холестерин\s+(\d+[.,]\d+|\d+)/i)?.[1]);
    add('HDL', text.match(/ЛПВП-холестерин\s*\(HDL\)\s*(\d+[.,]\d+|\d+)/i)?.[1]);
    add('LDL', text.match(/ЛПНП-холестерин\s*\(LDL\)\s*(\d+[.,]\d+|\d+)/i)?.[1]);
    add('TG', text.match(/Триглицериды\s+(\d+[.,]\d+|\d+)/i)?.[1]);
    add('APOA1', text.match(/Аполипопротеин\s+А1\s+(\d+[.,]\d+|\d+)/i)?.[1]);
    add('APOB', text.match(/Аполипопротеин\s+В\s+(\d+[.,]\d+|\d+)/i)?.[1]);
  }

  // 3. Формат Meliva / InMedica Kardiolita
  if (/LABORATORINIŲ TYRIMŲ PROTOKOLAS/i.test(text)) {
    add('CRP', text.match(/mg\/l\s*0\s*-\s*5\s*(\d+[.,]\d+)\s*C reaktyvus baltymas/i)?.[1]);
    add('PSA', text.match(/µg\/l\s*<=\s*4\s*(\d+[.,]\d+)\s*Prostatos specifinis antigenas/i)?.[1]);
    add('CHOL', text.match(/mmol\/l\s*0\s*-\s*5,18\s*(\d+[.,]\d+)\s*Cholesterolis/i)?.[1]);
    add('TG', text.match(/mmol\/l\s*0\s*-\s*1,7\s*(\d+[.,]\d+)\s*Triacilgliceroliai/i)?.[1]);
    add('HDL', text.match(/mmol\/l\s*>=\s*1,55\s*(\d+[.,]\d+)\s*Didelio tankio/i)?.[1]);
    add('LDL', text.match(/mmol\/l\s*<\s*2,6\s*(\d+[.,]\d+)\s*Mažo tankio/i)?.[1]);
    add('CREA', text.match(/µmol\/l\s*64\s*-\s*104\s*(\d+[.,]\d+)\s*Kreatininas/i)?.[1]);
    add('ALT', text.match(/U\/l\s*0\s*-\s*55\s*(\d+[.,]\d+)\s*Alanino aminotransferazė/i)?.[1]);
    add('AST', text.match(/U\/l\s*5\s*-\s*34\s*(\d+[.,]\d+)\s*Aspartato aminotransferazė/i)?.[1]);
    add('TSH', text.match(/mIU\/l\s*0,35\s*-\s*4,94\s*(\d+[.,]\d+)\s*Tirotropinas/i)?.[1]);
  }

  return results;
}
