import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { anonymizeText, verifyNumberInText } from './anonymize.mjs';
import { WORKSPACE_ROOT, buildHealthDatabase } from './build-db.mjs';
import { classifyDocumentByText, parseDocumentFilename } from './classify.mjs';
import { evaluateLabStatus, evaluateTrend, parseLabValuesFromText } from './parsers.mjs';

describe('Stage 2: классификация и переименование документов', () => {
  it('распознаёт текст МРТ ТБС Affidea (бывший "2026, 55083536.pdf") и предлагает правильное имя', () => {
    const sampleText = [
      'UAB „Affidea Lietuva“ Vilties g. 3, Alytus',
      'PATVIRTINTA Forma Nr. 049/a Radiologinio tyrimo vertinimas',
      'Tyrimo data: 2026-10-23 Dokumento Nr.: 5473671',
      'Tyrimo pavadinimas: Klubo (Kairio) magnetinio rezonanso tomografija',
      'Išvada: Be žymesnių MR SI pakitimų.',
    ].join('\n');

    const res = classifyDocumentByText(sampleText, '2026, 55083536.pdf');
    expect(res.date).toBe('2026-10-23');
    expect(res.specialty).toBe('ortho');
    expect(res.proposedFolder).toBe('04_Ортопедия_и_Травматология');
    expect(res.proposedName).toBe(
      '2026-10-23_МРТ_Левый_тазобедренный_сустав_Описание_Affidea_Алитус.pdf',
    );
    expect(res.confidence).toBe('high');
  });

  it('извлекает метаданные и маркеры из стандартных имён файлов', () => {
    const ccta = parseDocumentFilename(
      '01_Кардиология_и_Сосуды',
      '2026-03-09_КТ_Коронарография_CAC-288_CAD-RADS-2_InMedica.pdf',
    );
    expect(ccta.isStandardName).toBe(true);
    expect(ccta.date).toBe('2026-03-09');
    expect(ccta.docType).toBe('КТ');
    expect(ccta.clinic).toBe('InMedica');
    expect(ccta.markers).toEqual(['CAC 288', 'CAD-RADS 2']);
  });

  it('обезличивает текст перед отправкой в облачный ИИ', () => {
    const fakeCode = '367' + '0625' + '9999';
    const fakePhone = '+370' + '600' + '11223';
    const raw = `Pacientas: TESTAS PACIENTAS, LR asmens kodas ${fakeCode}, tel. ${fakePhone}, test@example.com`;
    const clean = anonymizeText(raw, ['TESTAS PACIENTAS']);
    expect(clean).not.toContain('TESTAS PACIENTAS');
    expect(clean).not.toContain(fakeCode);
    expect(clean).not.toContain(fakePhone);
    expect(clean).not.toContain('test@example.com');
  });

  it('проверяет наличие числа в исходном тексте (защита от галлюцинаций ИИ)', () => {
    const text = 'Rezultatai: MTL CH 4,06 mmol/l, CRB 2,4 mg/l';
    expect(verifyNumberInText(4.06, text)).toBe(true);
    expect(verifyNumberInText(2.4, text)).toBe(true);
    expect(verifyNumberInText(0.6, text)).toBe(false);
  });
});

describe('Stage 3: парсеры, статусы показателей и сверка с JSON', () => {
  it('корректно оценивает статус ЛПНП 1.95 ммоль/л как above_target (при цели < 1.8)', () => {
    expect(evaluateLabStatus('LDL', 1.95)).toBe('above_target');
    expect(evaluateLabStatus('LDL', 1.75)).toBe('normal');
    expect(evaluateLabStatus('LDL', 4.06)).toBe('high');
    expect(evaluateLabStatus('PSA', 6.62)).toBe('high');
    expect(evaluateLabStatus('ALT', 25.53)).toBe('normal');
  });

  it('корректно считает тренд', () => {
    const t = evaluateTrend(4.06, 1.95);
    expect(t.direction).toBe('down');
    expect(t.percent).toBeCloseTo(-52.0, 1);
  });

  it('парсит бланки e.sveikata и Helix', () => {
    const esv =
      'Data: 2024-11-06. Tyrimas: C reaktyvinis baltymas. Rezultatai: CRB (C reaktyvinis baltymas) 2,4 (norma iki 5) mg/l.';
    expect(parseLabValuesFromText(esv)).toEqual([{ analyte: 'CRP', value: 2.4, date: '2024-11-06' }]);

    const helix = 'ООО «Международная лаборатория Хеликс»\nЛипаза 36.72\nХолестерин 3.48\nАполипопротеин А1 1.25\nАполипопротеин В 0.72';
    const parsedHelix = parseLabValuesFromText(helix);
    expect(parsedHelix).toContainEqual({ analyte: 'LIPASE', value: 36.72 });
    expect(parsedHelix).toContainEqual({ analyte: 'APOB', value: 0.72 });
  });

  it('индексирует все 51 документ и совпадает со всеми точками из medical_database_2024_2026.json', async () => {
    const db = await buildHealthDatabase();
    expect(db.documents.length).toBe(51);
    expect(db.pipelineReport.standardNamedCount).toBe(51);
    expect(db.pipelineReport.pendingRenames).toHaveLength(0);

    // Проверяем расчёт ApoB/ApoA1 = 0.58 (а не ошибочные 0.49)
    expect(db.latestByAnalyte.APOB_APOA1.value).toBe(0.58);

    // Проверяем статус последнего ЛПНП 1.95 = above_target
    expect(db.latestByAnalyte.LDL.value).toBe(1.95);
    expect(db.latestByAnalyte.LDL.status).toBe('above_target');

    // Сверяем все точки липидограммы с исходным medical_database_2024_2026.json
    const legacy = JSON.parse(
      readFileSync(join(WORKSPACE_ROOT, 'medical_database_2024_2026.json'), 'utf8'),
    );
    for (const row of legacy.lab_dynamics.lipid_profile) {
      for (const [k, code] of [
        ['CHOL', 'CHOL'],
        ['LDL', 'LDL'],
        ['HDL', 'HDL'],
        ['TG', 'TG'],
        ['ApoA1', 'APOA1'],
        ['ApoB', 'APOB'],
      ]) {
        if (row[k] !== undefined) {
          const match = db.labResults.find((r) => r.date === row.date && r.analyte === code);
          expect(match?.value, `${code} on ${row.date}`).toBe(row[k]);
        }
      }
    }
  });
});
