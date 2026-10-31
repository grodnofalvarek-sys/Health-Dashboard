#!/usr/bin/env node
// Конвейер индексации документов и сборки единой базы health_db.json (этапы 2 и 3).
// Сканирует папки 01..06, сверяет с medical_database_2024_2026.json, дополняет данными из первичных
// документов (включая МРТ ТБС от 23.10.2026, расширенные анализы Antėja / Meliva / Helix и оригиналы LT),
// связывает каждое событие и анализ с исходным файлом PDF/JPG и создаёт резервную копию перед записью.
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FOLDERS, classifyDocumentByText, parseDocumentFilename } from './classify.mjs';
import { extractPdfText } from './extract-text.mjs';
import { ANALYTES, evaluateLabStatus, evaluateTrend } from './parsers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const WORKSPACE_ROOT = resolve(__dirname, '..', '..');
export const HEALTH_DB_PATH = join(WORKSPACE_ROOT, 'health_db.json');
export const LEGACY_JSON_PATH = join(WORKSPACE_ROOT, 'medical_database_2024_2026.json');
export const BACKUPS_DIR = join(WORKSPACE_ROOT, 'backups');

function sha256Short(filePath) {
  const buf = readFileSync(filePath);
  return createHash('sha256').update(buf).digest('hex').slice(0, 16);
}

function daysBetween(a, b) {
  const t1 = Date.parse(a);
  const t2 = Date.parse(b);
  if (Number.isNaN(t1) || Number.isNaN(t2)) return 9999;
  return Math.round(Math.abs(t1 - t2) / 86400000);
}

/**
 * Сканирует папки 01..06, возвращает список документов и список непереименованных файлов.
 */
export async function scanWorkspaceDocuments(rootDir = WORKSPACE_ROOT) {
  const documents = [];
  const pendingRenames = [];

  for (const [specialty, folderName] of Object.entries(FOLDERS)) {
    const folderAbs = join(rootDir, folderName);
    if (!existsSync(folderAbs)) continue;

    const entries = readdirSync(folderAbs).sort();
    for (const fileName of entries) {
      const fullPath = join(folderAbs, fileName);
      const st = statSync(fullPath);
      if (!st.isFile() || !/\.(pdf|jpe?g|png)$/i.test(fileName)) continue;

      const parsed = parseDocumentFilename(folderName, fileName);
      const id = `doc_${sha256Short(fullPath)}`;
      const relativePath = `${folderName}/${fileName}`;

      if (!parsed.isStandardName) {
        let extractedText = '';
        if (parsed.fileType === 'pdf') {
          try {
            const res = await extractPdfText(fullPath);
            extractedText = res.text;
          } catch {
            extractedText = '';
          }
        }
        const proposal = classifyDocumentByText(extractedText, fileName);
        pendingRenames.push({
          id,
          currentFolder: folderName,
          currentName: fileName,
          proposedFolder: proposal.proposedFolder,
          proposedName: proposal.proposedName,
          detectedDate: proposal.date,
          specialty: proposal.specialty,
          confidence: proposal.confidence,
        });
      }

      documents.push({
        id,
        path: relativePath,
        folder: folderName,
        fileName,
        date: parsed.date ?? '2026-10-23',
        specialty: parsed.specialty ?? specialty,
        docType: parsed.docType,
        clinic: parsed.clinic,
        titleRu: parsed.titleRu,
        markers: parsed.markers,
        fileType: parsed.fileType,
        sizeBytes: st.size,
        isStandardName: parsed.isStandardName,
      });
    }
  }

  documents.sort((a, b) => b.date.localeCompare(a.date) || a.fileName.localeCompare(b.fileName));
  return { documents, pendingRenames };
}

/**
 * Находит подходящий документ для события или анализа (с допуском ±7 дней).
 */
function findMatchingDoc(documents, date, preferredSpecialties, keywordRe = null) {
  const candidates = documents.filter((d) => {
    const diff = daysBetween(d.date, date);
    if (diff > 7) return false;
    if (preferredSpecialties?.length && !preferredSpecialties.includes(d.specialty)) return false;
    if (keywordRe && !keywordRe.test(d.fileName)) return false;
    return true;
  });
  candidates.sort((a, b) => daysBetween(a.date, date) - daysBetween(b.date, date));
  return candidates[0] ?? null;
}

/**
 * Собирает полную нормализованную структуру health_db.json.
 */
export async function buildHealthDatabase(rootDir = WORKSPACE_ROOT) {
  const { documents, pendingRenames } = await scanWorkspaceDocuments(rootDir);
  const legacy = existsSync(join(rootDir, 'medical_database_2024_2026.json'))
    ? JSON.parse(readFileSync(join(rootDir, 'medical_database_2024_2026.json'), 'utf8'))
    : null;

  const birthDate = legacy?.patient_summary?.birth_date ?? '1967-06-25';

  // 1. Активные диагнозы (обновлён статус ортопедии с учётом выполненного МРТ ТБС от 23.10.2026)
  const diagnoses = [
    {
      id: 'diag_cardio',
      code: 'I20.8 / E78.0 / I49.3',
      specialty: 'cardio',
      domain: 'Кардиология и сосуды',
      titleRu: 'Коронарный атеросклероз (CAD-RADS 2/P2, CAC 288), дислипидемия, желудочковая экстрасистолия',
      titleLt: 'Vainikinių arterijų aterosklerozė (CAD-RADS 2/P2, CAC 288), dislipidemija, skilvelinė ekstrasistolija',
      status: 'Контроль на терапии',
      statusLevel: 'controlled',
      therapy: 'Аторвастатин 10 мг вечером, Метопролола сукцинат 23.75 мг по 0.5 таб. утром, Триметазидин 35 мг ×2/сут, Аспирин 100 мг вечером (целевой ЛПНП < 1.8 ммоль/л)',
      therapyLt: 'Atorvastatinas 10 mg ×1 vakare, Metoprololio sukcinatas 23,75 mg po 0,5 tab. ryte, Trimetazidinas 35 mg ×2/d., Aspirinas 100 mg ×1 vakare (tikslinis MTL-C < 1,8 mmol/l)',
    },
    {
      id: 'diag_uro',
      code: 'N40 / N41.1',
      specialty: 'uro',
      domain: 'Урология',
      titleRu: 'Доброкачественная гиперплазия предстательной железы (ДГПЖ), хронический простатит (PI-RADS 2)',
      titleLt: 'Priešinės liaukos (prostatos) gerybinė hiperplazija (GPH), lėtinis prostatitas (PI-RADS 2)',
      status: 'Плановое наблюдение',
      statusLevel: 'controlled',
      therapy: 'Тамсулозин 0.4 мг/сут, контроль ПСА и ОАМ 1 раз в 6–12 мес.',
      therapyLt: 'Tamsulozinas 0,4 mg ×1/d., PSA ir BŠT kontrolė kas 6–12 mėn.',
    },
    {
      id: 'diag_gastro',
      code: 'K80.2',
      specialty: 'gastro',
      domain: 'Гастроэнтерология',
      titleRu: 'Желчнокаменная болезнь (холецистолитиаз, билиарный сладж и конкременты до 10–15 мм)',
      titleLt: 'Tulžies pūslės akmenligė (cholecistolitiazė, „sludge“ ir konkrementai iki 10–15 mm)',
      status: 'Ремиссия / наблюдение',
      statusLevel: 'remission',
      therapy: 'Щадящая диета, УЗИ органов брюшной полости 1 раз в год',
      therapyLt: 'Tikslinga dieta, pilvo organų echoskopija 1 k./m.',
    },
    {
      id: 'diag_ortho',
      code: 'M65.85 / I83.9',
      specialty: 'ortho',
      domain: 'Ортопедия и сосуды',
      titleRu: 'Трохантерит / синовит левого бедра (M65.85 — на МРТ ТБС от 23.10.2026 структурной патологии нет); направление к сосудистому хирургу (I83.9)',
      titleLt: 'Kairio klubo trochanteritas / sinovitas (M65.85 — 2026-10-23 MRT be žymesnių pakitimų); siuntimas kraujagyslių chirurgui (I83.9)',
      status: 'МРТ ТБС выполнено (норма) · ожидается сосудистый хирург',
      statusLevel: 'attention',
      therapy: 'Симптоматическая терапия (НПВС при боли), плановая консультация сосудистого хирурга по направлению от 08.10.2026',
      therapyLt: 'Simptominis gydymas (NVNU p.r.), planinė kraujagyslių chirurgo konsultacija',
    },
  ];

  // 2. Нормализованный массив лабораторных измерений (JSON + извлечённые показатели из первичных бланков)
  const rawLabPoints = [
    // 2024-10-15 (Kardiolita — острый эпизод ИМП/простатита)
    { date: '2024-10-15', lab: 'Kardiolita (InMedica)', analyte: 'CRP', value: 190.98, note: 'Острый эпизод ИМП / простатита' },
    { date: '2024-10-15', lab: 'Kardiolita (InMedica)', analyte: 'WBC', value: 5.7 },
    { date: '2024-10-15', lab: 'Kardiolita (InMedica)', analyte: 'HGB', value: 139 },
    { date: '2024-10-15', lab: 'Kardiolita (InMedica)', analyte: 'PLT', value: 148 },
    { date: '2024-10-15', lab: 'Kardiolita (InMedica)', analyte: 'URINE_LEU', value: 125 },

    // 2024-10-18 (Kardiolita — контроль на терапии)
    { date: '2024-10-18', lab: 'Kardiolita (InMedica)', analyte: 'CRP', value: 39.32, note: 'Быстрое снижение СРБ на терапии, посев E. coli >10⁵' },
    { date: '2024-10-18', lab: 'Kardiolita (InMedica)', analyte: 'WBC', value: 8.1 },
    { date: '2024-10-18', lab: 'Kardiolita (InMedica)', analyte: 'HGB', value: 129 },
    { date: '2024-10-18', lab: 'Kardiolita (InMedica)', analyte: 'PLT', value: 214 },
    { date: '2024-10-18', lab: 'Kardiolita (InMedica)', analyte: 'URINE_LEU', value: 70 },

    // 2024-11-06 (Alytaus poliklinika — программа SCORE2 + контроль ИМП)
    { date: '2024-11-06', lab: 'Alytaus poliklinika', analyte: 'CHOL', value: 5.6, note: 'До старта статинов' },
    { date: '2024-11-06', lab: 'Alytaus poliklinika', analyte: 'LDL', value: 4.06, note: 'Исходный уровень без статинов' },
    { date: '2024-11-06', lab: 'Alytaus poliklinika', analyte: 'HDL', value: 0.99 },
    { date: '2024-11-06', lab: 'Alytaus poliklinika', analyte: 'TG', value: 1.2 },
    { date: '2024-11-06', lab: 'Alytaus poliklinika', analyte: 'NON_HDL', value: 4.61 },
    { date: '2024-11-06', lab: 'Alytaus poliklinika', analyte: 'CRP', value: 2.4, note: 'Полная нормализация СРБ после курса лечения ИМП' },
    { date: '2024-11-06', lab: 'Alytaus poliklinika', analyte: 'CREA', value: 72.1 },
    { date: '2024-11-06', lab: 'Alytaus poliklinika', analyte: 'EGFR', value: 102.36 },
    { date: '2024-11-06', lab: 'Alytaus poliklinika', analyte: 'TSH', value: 2.16 },
    { date: '2024-11-06', lab: 'Alytaus poliklinika', analyte: 'GLU', value: 5.5 },
    { date: '2024-11-06', lab: 'Alytaus poliklinika', analyte: 'ALT', value: 31 },
    { date: '2024-11-06', lab: 'Alytaus poliklinika', analyte: 'AST', value: 24 },
    { date: '2024-11-06', lab: 'Alytaus poliklinika', analyte: 'HGB', value: 141 },
    { date: '2024-11-06', lab: 'Alytaus poliklinika', analyte: 'WBC', value: 5.52 },
    { date: '2024-11-06', lab: 'Alytaus poliklinika', analyte: 'PLT', value: 281 },
    { date: '2024-11-06', lab: 'Alytaus poliklinika', analyte: 'K', value: 3.9 },
    { date: '2024-11-06', lab: 'Alytaus poliklinika', analyte: 'NA', value: 139 },
    { date: '2024-11-05', lab: 'Alytaus poliklinika', analyte: 'URINE_LEU', value: 250 },

    // 2025-02-14 (Alytaus poliklinika — ПСА)
    { date: '2025-02-14', lab: 'Alytaus poliklinika', analyte: 'PSA', value: 7.015, note: 'Повышен ПСА после перенесённого воспаления; направлен на мпМРТ простаты' },

    // 2025-03-12 (Alytaus poliklinika — контроль мочи и креатинина)
    { date: '2025-03-12', lab: 'Alytaus poliklinika', analyte: 'CREA', value: 67.6 },
    { date: '2025-03-12', lab: 'Alytaus poliklinika', analyte: 'EGFR', value: 104.15 },
    { date: '2025-03-12', lab: 'Alytaus poliklinika', analyte: 'URINE_LEU', value: 500, note: 'Рецидив бактериурии E. coli, курс антибиотикотерапии' },

    // 2025-06-05 (Alytaus poliklinika — перед назначением розувастатина)
    { date: '2025-06-05', lab: 'Alytaus poliklinika', analyte: 'CHOL', value: 5.6 },
    { date: '2025-06-05', lab: 'Alytaus poliklinika', analyte: 'LDL', value: 4.01, note: '06.06.2025 назначен Розувастатин 10 мг (30.07 заменён на Аторвастатин 10 мг)' },
    { date: '2025-06-05', lab: 'Alytaus poliklinika', analyte: 'HDL', value: 1.0 },
    { date: '2025-06-05', lab: 'Alytaus poliklinika', analyte: 'TG', value: 1.3 },
    { date: '2025-06-05', lab: 'Alytaus poliklinika', analyte: 'NON_HDL', value: 4.6 },

    // 2025-09-03 (Alytaus poliklinika — 1 мес на Аторвастатине 10 мг)
    { date: '2025-09-03', lab: 'Alytaus poliklinika', analyte: 'CHOL', value: 5.5 },
    { date: '2025-09-03', lab: 'Alytaus poliklinika', analyte: 'LDL', value: 3.95, note: 'Аторвастатин 10 мг' },
    { date: '2025-09-03', lab: 'Alytaus poliklinika', analyte: 'HDL', value: 1.1 },
    { date: '2025-09-03', lab: 'Alytaus poliklinika', analyte: 'TG', value: 1.0 },

    // 2025-10-15 (Antėja — расширенный профиль из первичного PDF)
    { date: '2025-10-15', lab: 'Antėja', analyte: 'CHOL', value: 4.67 },
    { date: '2025-10-15', lab: 'Antėja', analyte: 'LDL', value: 3.28, note: 'Извлечено из протокола Antėja (на фоне Аторвастатина 10 мг)' },
    { date: '2025-10-15', lab: 'Antėja', analyte: 'HDL', value: 0.94 },
    { date: '2025-10-15', lab: 'Antėja', analyte: 'TG', value: 0.99 },
    { date: '2025-10-15', lab: 'Antėja', analyte: 'NON_HDL', value: 3.73 },
    { date: '2025-10-15', lab: 'Antėja', analyte: 'GLU', value: 4.8 },
    { date: '2025-10-15', lab: 'Antėja', analyte: 'HBA1C', value: 5.2 },
    { date: '2025-10-15', lab: 'Antėja', analyte: 'ALT', value: 22 },
    { date: '2025-10-15', lab: 'Antėja', analyte: 'AST', value: 17 },
    { date: '2025-10-15', lab: 'Antėja', analyte: 'GGT', value: 15 },
    { date: '2025-10-15', lab: 'Antėja', analyte: 'ALP', value: 45 },
    { date: '2025-10-15', lab: 'Antėja', analyte: 'URIC_ACID', value: 315 },
    { date: '2025-10-15', lab: 'Antėja', analyte: 'K', value: 4.64 },
    { date: '2025-10-15', lab: 'Antėja', analyte: 'NA', value: 142 },
    { date: '2025-10-15', lab: 'Antėja', analyte: 'FPSA', value: 0.45 },
    { date: '2025-10-15', lab: 'Antėja', analyte: 'VITD', value: 33.1, note: 'Достаточный уровень (30–100 мкг/л)' },
    { date: '2025-10-15', lab: 'Antėja', analyte: 'HGB', value: 147 },
    { date: '2025-10-15', lab: 'Antėja', analyte: 'WBC', value: 4.89 },
    { date: '2025-10-15', lab: 'Antėja', analyte: 'PLT', value: 255 },

    // 2025-11-12 (Meliva — комплексный анализ + ПСА)
    { date: '2025-11-12', lab: 'Meliva', analyte: 'CHOL', value: 3.75 },
    { date: '2025-11-12', lab: 'Meliva', analyte: 'LDL', value: 2.25, note: 'Аторвастатин 10 мг' },
    { date: '2025-11-12', lab: 'Meliva', analyte: 'HDL', value: 1.06 },
    { date: '2025-11-12', lab: 'Meliva', analyte: 'TG', value: 0.96 },
    { date: '2025-11-12', lab: 'Meliva', analyte: 'NON_HDL', value: 2.69 },
    { date: '2025-11-12', lab: 'Meliva', analyte: 'PSA', value: 6.62, note: 'Снижение ПСА с 7.015 до 6.62 мкг/л' },
    { date: '2025-11-12', lab: 'Meliva', analyte: 'CREA', value: 65.12 },
    { date: '2025-11-12', lab: 'Meliva', analyte: 'EGFR', value: 105.2 },
    { date: '2025-11-12', lab: 'Meliva', analyte: 'GLU', value: 5.17 },
    { date: '2025-11-12', lab: 'Meliva', analyte: 'ALT', value: 23.49 },
    { date: '2025-11-12', lab: 'Meliva', analyte: 'AST', value: 21.47 },
    { date: '2025-11-12', lab: 'Meliva', analyte: 'TSH', value: 2.71 },
    { date: '2025-11-12', lab: 'Meliva', analyte: 'K', value: 4.23 },
    { date: '2025-11-12', lab: 'Meliva', analyte: 'NA', value: 141.85 },
    { date: '2025-11-12', lab: 'Meliva', analyte: 'HGB', value: 156 },
    { date: '2025-11-12', lab: 'Meliva', analyte: 'WBC', value: 7.44 },
    { date: '2025-11-12', lab: 'Meliva', analyte: 'PLT', value: 312 },
    { date: '2025-11-12', lab: 'Meliva', analyte: 'URINE_LEU', value: 70 },

    // 2026-01-30 (S. Kudirkos ligoninė — кардиологический чекап)
    { date: '2026-01-30', lab: 'S. Kudirkos ligoninė', analyte: 'CHOL', value: 4.24 },
    { date: '2026-01-30', lab: 'S. Kudirkos ligoninė', analyte: 'LDL', value: 3.09, note: 'Прямой метод; Аторвастатин 10 мг' },
    { date: '2026-01-30', lab: 'S. Kudirkos ligoninė', analyte: 'HDL', value: 1.17 },
    { date: '2026-01-30', lab: 'S. Kudirkos ligoninė', analyte: 'TG', value: 1.02 },
    { date: '2026-01-30', lab: 'S. Kudirkos ligoninė', analyte: 'CREA', value: 65.0 },
    { date: '2026-01-30', lab: 'S. Kudirkos ligoninė', analyte: 'EGFR', value: 116 },
    { date: '2026-01-30', lab: 'S. Kudirkos ligoninė', analyte: 'URIC_ACID', value: 248 },
    { date: '2026-01-30', lab: 'S. Kudirkos ligoninė', analyte: 'NT_PROBNP', value: 71 },
    { date: '2026-01-30', lab: 'S. Kudirkos ligoninė', analyte: 'TSH', value: 1.89 },
    { date: '2026-01-30', lab: 'S. Kudirkos ligoninė', analyte: 'ALT', value: 16 },
    { date: '2026-01-30', lab: 'S. Kudirkos ligoninė', analyte: 'AST', value: 17 },
    { date: '2026-01-30', lab: 'S. Kudirkos ligoninė', analyte: 'K', value: 4.5 },
    { date: '2026-01-30', lab: 'S. Kudirkos ligoninė', analyte: 'NA', value: 141 },
    { date: '2026-01-30', lab: 'S. Kudirkos ligoninė', analyte: 'MG', value: 0.8 },
    { date: '2026-01-30', lab: 'S. Kudirkos ligoninė', analyte: 'HGB', value: 149 },
    { date: '2026-01-30', lab: 'S. Kudirkos ligoninė', analyte: 'WBC', value: 7.52 },
    { date: '2026-01-30', lab: 'S. Kudirkos ligoninė', analyte: 'PLT', value: 222 },

    // 2026-05-05 (Helix Гродно — расширенная липидограмма + АпоА1/АпоВ + липаза)
    { date: '2026-05-05', lab: 'Helix Гродно', analyte: 'CHOL', value: 3.48 },
    { date: '2026-05-05', lab: 'Helix Гродно', analyte: 'LDL', value: 2.0, note: 'Аторвастатин 10 мг' },
    { date: '2026-05-05', lab: 'Helix Гродно', analyte: 'HDL', value: 1.12 },
    { date: '2026-05-05', lab: 'Helix Гродно', analyte: 'TG', value: 0.8 },
    { date: '2026-05-05', lab: 'Helix Гродно', analyte: 'APOA1', value: 1.25 },
    { date: '2026-05-05', lab: 'Helix Гродно', analyte: 'APOB', value: 0.72, note: 'В пределах целевого уровня кардиолога (≤ 0.80 г/л)' },
    { date: '2026-05-05', lab: 'Helix Гродно', analyte: 'APOB_APOA1', value: Number((0.72 / 1.25).toFixed(2)), note: 'Расчёт 0.72 / 1.25 = 0.58 (оптимальный < 0.80)' },
    { date: '2026-05-05', lab: 'Helix Гродно', analyte: 'LIPASE', value: 36.72 },

    // 2026-05-27 (Meliva — комплексный анализ)
    { date: '2026-05-27', lab: 'Meliva', analyte: 'CHOL', value: 3.41 },
    { date: '2026-05-27', lab: 'Meliva', analyte: 'LDL', value: 1.95, note: 'Снижение на 52 % от исходного 4.06; чуть выше целевого < 1.8' },
    { date: '2026-05-27', lab: 'Meliva', analyte: 'HDL', value: 1.1 },
    { date: '2026-05-27', lab: 'Meliva', analyte: 'TG', value: 0.79 },
    { date: '2026-05-27', lab: 'Meliva', analyte: 'NON_HDL', value: 2.31 },
    { date: '2026-05-27', lab: 'Meliva', analyte: 'CREA', value: 63.24 },
    { date: '2026-05-27', lab: 'Meliva', analyte: 'EGFR', value: 106.1 },
    { date: '2026-05-27', lab: 'Meliva', analyte: 'GLU', value: 5.59 },
    { date: '2026-05-27', lab: 'Meliva', analyte: 'ALT', value: 25.53 },
    { date: '2026-05-27', lab: 'Meliva', analyte: 'AST', value: 19.71 },
    { date: '2026-05-27', lab: 'Meliva', analyte: 'GGT', value: 14.67 },
    { date: '2026-05-27', lab: 'Meliva', analyte: 'ALP', value: 50.64 },
    { date: '2026-05-27', lab: 'Meliva', analyte: 'BILIRUBIN', value: 9.11 },
    { date: '2026-05-27', lab: 'Meliva', analyte: 'TSH', value: 2.18 },
    { date: '2026-05-27', lab: 'Meliva', analyte: 'K', value: 4.16 },
    { date: '2026-05-27', lab: 'Meliva', analyte: 'NA', value: 140.61 },
    { date: '2026-05-27', lab: 'Meliva', analyte: 'HGB', value: 154 },
    { date: '2026-05-27', lab: 'Meliva', analyte: 'WBC', value: 6.2 },
    { date: '2026-05-27', lab: 'Meliva', analyte: 'PLT', value: 262 },
  ];

  const dateDiscrepancies = [];
  const labResults = rawLabPoints.map((pt, idx) => {
    const spec = ANALYTES[pt.analyte];
    const matchedDoc =
      findMatchingDoc(documents, pt.date, ['lab']) ??
      findMatchingDoc(documents, pt.date, ['cardio', 'uro']);
    if (matchedDoc && matchedDoc.date !== pt.date) {
      dateDiscrepancies.push({
        kind: 'lab',
        analyte: pt.analyte,
        recordDate: pt.date,
        documentDate: matchedDoc.date,
        documentPath: matchedDoc.path,
        diffDays: daysBetween(matchedDoc.date, pt.date),
      });
    }
    return {
      id: `lab_${idx + 1}_${pt.analyte}_${pt.date}`,
      analyte: pt.analyte,
      group: spec?.group ?? 'other',
      nameRu: spec?.nameRu ?? pt.analyte,
      shortName: spec?.shortName ?? pt.analyte,
      value: pt.value,
      unit: spec?.unit ?? '',
      date: pt.date,
      lab: pt.lab,
      refLow: spec?.refLow ?? null,
      refHigh: spec?.refHigh ?? null,
      targetHigh: spec?.targetHigh ?? null,
      status: evaluateLabStatus(pt.analyte, pt.value),
      note: pt.note ?? null,
      documentId: matchedDoc?.id ?? null,
      documentPath: matchedDoc?.path ?? null,
      verificationStatus: 'confirmed',
    };
  });

  // 3. Ключевые диагностические и клинические события (с двуязычными заключениями LT + RU и привязкой к документам)
  const rawEvents = [
    {
      id: 'ev_2024_10_15_us_uro',
      date: '2024-10-15',
      specialty: 'uro',
      episodeId: 'ep_uti_2024',
      kind: 'УЗИ и консультация уролога',
      titleRu: 'Первичный приём уролога и УЗИ почек, мочевого пузыря и простаты',
      clinic: 'Kardiolita (Вильнюс), врач Ю. Макевичюс',
      findingsRu:
        'Почки обычных размеров (паренхима 17 мм), без конкрементов и стаза. Остаточной мочи нет. На фоне острого воспаления объём простаты увеличен до 75 мл. СРБ 190.98 мг/л. Назначены Бисептол, Тамсулозин 0.4 мг и Фитолизин.',
      findingsLt:
        'Šlapimo pūslė tuščia, liekamojo šlapimo nėra. Prostatos tūris 75 ml, jos ribos aiškios. Dešinysis ir kairysis inkstai normalaus dydžio, parenchimos storis 17 mm, kolektorika neišplėsta. CRB 190,98 mg/l.',
      docMatchRe: /2024-10-15_Уролог|2024-10-15_УЗИ/,
    },
    {
      id: 'ev_2024_10_18_uti_ctrl',
      date: '2024-10-18',
      specialty: 'uro',
      episodeId: 'ep_uti_2024',
      kind: 'Лабораторный контроль и посев мочи',
      titleRu: 'Контроль СРБ (снижение 190.98 → 39.32 мг/л) и посев мочи',
      clinic: 'Kardiolita (Вильнюс) / Alytaus poliklinika',
      findingsRu:
        'Положительная динамика на терапии: СРБ снизился до 39.32 мг/л (к 06.11.2024 нормализовался до 2.4 мг/л). В посеве мочи E. coli > 10⁵ КОЕ/мл, чувствительна к нитрофурантоину (Увамин).',
      findingsLt:
        '2024-10-18: C reaktyvus baltymas 39,32 mg/l, BŠT leukocitai 70. Šlapimo pasėlis TEIGIAMAS: Escherichia coli >100000 KSV/ml (jautri Nitrofurantoinui). 2024-11-06 CRB 2,4 mg/l.',
      docMatchRe: /2024-10-18|2024-10-28/,
    },
    {
      id: 'ev_2024_11_11_score2',
      date: '2024-11-11',
      specialty: 'cardio',
      episodeId: 'ep_cardio_2024_2026',
      kind: 'Превентивная программа ССЗ',
      titleRu: 'Оценка сердечно-сосудистого риска (SCORE2 = 11 %) и ЭКГ в покое',
      clinic: 'Alytaus poliklinika, врач В. Менкевичене',
      findingsRu:
        'Рост 176 см, вес 82 кг, ИМТ 26.47 кг/м², окружность талии 95 см, АД 130/83 мм рт. ст., ЧСС 69 уд/мин. ЭКГ — синусовый ритм. ОХС 5.60, ЛПНП 4.06 ммоль/л. Кал на скрытую кровь (iFOB) и анти-HCV — отрицательные.',
      findingsLt:
        'Atvyko pagal ŠKL prevencijos programą. Ūgis 176 cm, svoris 82 kg, KMI 26,47 kg/m², AKS 130/83 mmHg. Pagal SCORE2 - 11%, nustatoma labai didelė ŠKL rizika. EKG - SR. iFOB ir aHCV - neigiami.',
      docMatchRe: /2024-11-11_Семейный_врач_Программа_ССЗ/,
    },
    {
      id: 'ev_2025_01_08_us_abd',
      date: '2025-01-08',
      specialty: 'gastro',
      episodeId: 'ep_gastro_2025_2026',
      kind: 'УЗИ брюшной полости',
      titleRu: 'УЗИ органов брюшной полости и почек',
      clinic: 'Гродненская университетская клиника',
      findingsRu:
        'Печень и поджелудочная железа в норме. Желчный пузырь с перегибом, застойное содержимое (сладж), конкремент 12 мм. В почках мелкие гиперэхогенные включения (микролиты).',
      findingsLt: null,
      docMatchRe: /2025-01-08_УЗИ/,
    },
    {
      id: 'ev_2025_01_10_treadmill',
      date: '2025-01-10',
      specialty: 'cardio',
      episodeId: 'ep_cardio_2024_2026',
      kind: 'Тредмил-тест и рентген ОГК',
      titleRu: 'Нагрузочный тредмил-тест (протокол Брюса) и рентгенография ОГК',
      clinic: 'ЛОДЭ (Гродно)',
      findingsRu:
        'Тредмил-тест: толерантность к нагрузке выше средней (7.0 МЕТ), ЧСС макс 146 уд/мин, АД макс 180/80 мм рт. ст., ишемических изменений ST нет, проба отрицательная. Рентген ОГК: без очаговых и инфильтративных изменений.',
      findingsLt: null,
      docMatchRe: /2025-01-10_Тредмил|2025-01-10_Рентген/,
    },
    {
      id: 'ev_2025_03_04_spa',
      date: '2025-03-04',
      specialty: 'prev',
      episodeId: null,
      kind: 'Санаторная реабилитация',
      titleRu: 'Курс санаторно-курортной реабилитации',
      clinic: 'Grand SPA Lietuva (Друскининкай), врач О. Ломот',
      findingsRu:
        'Проведены кинезитерапия, лечебный массаж, жемчужные минеральные ванны, магнитотерапия, фитотерапия.',
      findingsLt:
        'Kineziterapija, gydomasis masažas, perlinė mineralinė vonia, magnetoterapija, fitoterapija.',
      docMatchRe: /2025-03-04_Выписка/,
    },
    {
      id: 'ev_2025_03_19_mri_prostate',
      date: '2025-03-19',
      specialty: 'uro',
      episodeId: 'ep_psa_mri_2025',
      kind: 'мпМРТ простаты',
      titleRu: 'Мультипараметрическая МРТ предстательной железы (PI-RADS 2)',
      clinic: 'Алитус / Каунас (радиолог Й. Кемешене, уролог А. Алишаускас)',
      findingsRu:
        'Простата ~3.5×4.5×4.2 см, объём ~35 мл (после купирования октябрьского воспаления уменьшился с 75 до 35 мл), PSAd 0.2. В транзиторной зоне признаки ДГПЖ (PI-RADS 1), в периферической зоне поствоспалительные изменения (PI-RADS 2). Подозрительных очагов PI-RADS > 3 не выявлено.',
      findingsLt:
        'Prostatos mpMRT tyrimas Nr. 18576: Prostata ~3,5x4,5x4,2 cm dydžio (~35 ml tūrio), PSAd 0,2. Tranzitorinėje zonoje vyrauja GPH požymiai (PIRADS 1). Periferinė zona „marga“ - PIRADS 2 (lėt. prostatitas); jų fone įtartinų PIRADS>3 židinių nematyti.',
      docMatchRe: /2025-03-24_Уролог_Консультация_и_описание_МРТ/,
    },
    {
      id: 'ev_2025_05_17_ticovac',
      date: '2025-05-17',
      specialty: 'prev',
      episodeId: null,
      kind: 'Вакцинация',
      titleRu: 'Вакцинация против клещевого энцефалита TicoVac (доза 1 — 26.04.2025, доза 2 — 17.05.2025)',
      clinic: 'Gintarinė vaistinė, П. Жукаускас',
      findingsRu:
        'Выполнены первые 2 дозы первичного курса TicoVac. 3-я доза по схеме вводится через 5–12 месяцев после второй дозы для завершения базовой иммунизации.',
      findingsLt: 'Erkinis encefalitas, vaistinis preparatas TicoVac, 1 dozė (2025-04-26) ir 2 dozė (2025-05-17).',
      docMatchRe: /TicoVac/,
    },
    {
      id: 'ev_2025_07_30_statin',
      date: '2025-07-30',
      specialty: 'cardio',
      episodeId: 'ep_cardio_2024_2026',
      kind: 'Коррекция липидснижающей терапии',
      titleRu: 'Старт статинотерапии (06.06.2025 Розувастатин 10 мг → 30.07.2025 замена на Аторвастатин 10 мг)',
      clinic: 'Alytaus poliklinika, врач В. Менкевичене',
      findingsRu:
        'При целевом уровне ЛПНП < 1.8 ммоль/л 06.06.2025 назначен Розувастатин 10 мг; из-за побочного эффекта со стороны ЖКТ 30.07.2025 заменён на Аторвастатин 10 мг/сут с отличной переносимостью.',
      findingsLt:
        'Tikslinis MTL-ch < 1.8 mmol/l. Paskirtas Rozuvastatinas 10 mg, tačiau dėl netoleravimo 2025-07-30 gydymas keičiamas: Atorvastatini 10 mg × 1 k/p.',
      docMatchRe: /2025-07-30|2025-06-06/,
    },
    {
      id: 'ev_2025_12_03_uro_ctrl',
      date: '2025-12-03',
      specialty: 'uro',
      episodeId: 'ep_psa_mri_2025',
      kind: 'Плановый приём уролога',
      titleRu: 'Плановый контроль у уролога (ПСА снизился до 6.62 мкг/л)',
      clinic: 'S. Kudirkos ligoninė (Алитус), врач А. Алишаускас',
      findingsRu:
        'Обострения простатита нет. ПСА снизился с 7.015 до 6.62 мкг/л (от 12.11.2025). Продлён приём Тамсулозина 0.4 мг ×1/сут на 90 дней.',
      findingsLt:
        '2025.11.12 PSA 6,62 ng/ml. Prostatito paūmėjimo nėra. Rp Tamsulozino hidrochloridas 0,4 mg × 1 k./d.',
      docMatchRe: /2025-12-03_Уролог/,
    },
    {
      id: 'ev_2026_01_30_echo',
      date: '2026-01-30',
      specialty: 'cardio',
      episodeId: 'ep_cardio_2024_2026',
      kind: 'ЭхоКГ и консультация кардиолога',
      titleRu: 'Трансторакальная ЭхоКГ (УЗИ сердца) и консультация кардиолога',
      clinic: 'S. Kudirkos ligoninė (Алитус), кардиолог Ю. Юргайтите',
      findingsRu:
        'ФВ ЛЖ (IF) 55 %, склеротические изменения створок аортального клапана с сохранной функцией, восходящая аорта 39 мм, синусы Ао 34 мм, МЖП 14 мм, псевдонормальная диастолическая дисфункция. NT-proBNP 71 пмоль/л (норма до 133). Добавлен Триметазидин 35 мг ×2/сут.',
      findingsLt:
        'Transtorakalinė echokardiografija: Aortos žiedas 23 mm; Aorta ties sinusais 34 mm; Kylančioji dalis 39 mm; TSP 14 mm; IF 55 %. Išvada: AoV burių sklerotiniai pakitimai, vožtuvo funkcija išlikusi gera. Sistolinė KS funkcija gera, pseudonormali diastolinė disfunkcija.',
      docMatchRe: /2026-01-30_Кардиолог/,
    },
    {
      id: 'ev_2026_02_17_holter',
      date: '2026-02-17',
      specialty: 'cardio',
      episodeId: 'ep_cardio_2024_2026',
      kind: 'Холтер-мониторирование ЭКГ',
      titleRu: 'Суточное мониторирование ЭКГ по Холтеру (21 ч 26 мин)',
      clinic: 'S. Kudirkos ligoninė (Алитус)',
      findingsRu:
        'В течение всего исследования — синусовый ритм. ЧСС мин 48, средн 69, макс 118 уд/мин. Зарегистрированы одиночные мономорфные ЖЭС (26 за сутки) и НЖЭС (271 за сутки). Пауз не зарегистрировано.',
      findingsLt:
        'Holter tyrimas: monitoruota 21 val. 26 min. Viso tyrimo metu - sinusinis ritmas. Min ŠSD 48, vid. 69, maks. 118 k./min. Aptiktos pavienės skilvelinės Ex. - monomorfinės bei nedidelis kiekis suprav. Ex. Pauzių neregistruota.',
      docMatchRe: /2026-02-17_Холтер/,
    },
    {
      id: 'ev_2026_02_27_vem',
      date: '2026-02-27',
      specialty: 'cardio',
      episodeId: 'ep_cardio_2024_2026',
      kind: 'Велоэргометрия (ВЭМ)',
      titleRu: 'Нагрузочный тест (ВЭМ 150 W, 7.5 METS) и назначение метопролола',
      clinic: 'S. Kudirkos ligoninė (Алитус), кардиолог Ю. Юргайтите',
      findingsRu:
        'Достигнута нагрузка 150 W (7.5 METS), ЧСС 142 уд/мин (87 %), гипертензивная реакция на нагрузку (АД до 214/53 мм рт. ст.), желудочковая экстрасистолия по типу бигеминии на нагрузке. Назначен Метопролола сукцинат 23.75 мг по 0.5 таб. утром; направлен на КТ-коронарографию.',
      findingsLt:
        'VEM: pasiektas krūvis 150W; METS - 7,5; krūvio metu fiksuotos skilvelinės Ex., nutraukus krūvį - SR. Hipertenzinė reakcija į krūvį. Paskirtas Metoprololio sukcinatas 23,75 mg po 0,5 tab. ryte; nukreipiamas į širdies VA KT angiografiją.',
      docMatchRe: /2026-02-27_ВЭМ|2026-02-27_Кардиолог/,
    },
    {
      id: 'ev_2026_03_09_ccta',
      date: '2026-03-09',
      specialty: 'cardio',
      episodeId: 'ep_cardio_2024_2026',
      kind: 'КТ-коронарография',
      titleRu: 'КТ-ангиография коронарных артерий (Agatston CAC = 288, CAD-RADS 2/P2)',
      clinic: 'InMedica (Вильнюс), радиолог К. Гайжаускене / кардиолог Ю. Юргайтите (20.03.2026)',
      findingsRu:
        'Индекс коронарного кальция Agatston = 288 (LM 0, LAD 11, LCX 268, RCA 9). Синусы Ао 39 мм, восходящая Ао 40 мм. Стенозы: ПМЖВ (RIA) S6 < 25 %, S6/7 ~25–30 % + поверхностный мышечный мостик в S7 (20 мм); ОВ (RCX) S11 ~25–49 %; ПКА (ACD) S1 < 25 %. CAD-RADS 2/P2. В лёгких единичные мелкие очаги до 5 мм — КТ-контроль через 12 мес. (март 2027). По итогам консультации 20.03.2026 рекомендованы: Метопролола сукцинат 23.75 мг 0.5 таб. утром, Аторвастатин 10 мг вечером, Триметазидин 35 мг ×2, Аспирин 100 мг вечером.',
      findingsLt:
        'Vainikinių arterijų kalcinozės indeksas pagal Agatston lygus 288 (LM 0/ LAD 11/ LCX 268/ RCA 9). RIA S6 <25 proc., S6/7 ~25-30 proc., RIA S7 20 mm negilus raumeninis tiltelis, RCX S11 ~25-49 proc., ACD S1 <25 proc. CAD-RADS 2/P2. Plaučiuose pavieniai smulkūs židiniai iki 5 mm - KT kontrolė po 12 mėn.',
      docMatchRe: /2026-03-09_КТ|2026-03-20_Кардиолог/,
    },
    {
      id: 'ev_2026_05_05_bca',
      date: '2026-05-05',
      specialty: 'cardio',
      episodeId: 'ep_cardio_2024_2026',
      kind: 'УЗИ БЦА и брюшной полости',
      titleRu: 'УЗИ брахиоцефальных артерий и УЗИ брюшной полости (06.05.2026)',
      clinic: 'ЛОДЭ / Гродненская УК (Гродно)',
      findingsRu:
        'УЗИ БЦА: атеросклеротические бляшки в бифуркациях общих сонных артерий со стенозом справа 15 %, слева 20 %. УЗИ БП (06.05.2026): желчный пузырь с застойной желчью и 2 конкрементами до 15 мм.',
      findingsLt: null,
      docMatchRe: /2026-05-05_УЗИ|2026-05-06_УЗИ/,
    },
    {
      id: 'ev_2026_05_25_us_abd',
      date: '2026-05-25',
      specialty: 'gastro',
      episodeId: 'ep_gastro_2025_2026',
      kind: 'УЗИ брюшной полости и уропоэтической системы',
      titleRu: 'Консультация гастроэнтеролога и УЗИ брюшной полости, почек и простаты',
      clinic: 'S. Kudirkos ligoninė (Алитус), гастроэнтеролог Г. Куратчик',
      findingsRu:
        'Печень однородная (правая доля 150 мм), холедох 8 мм. Желчный пузырь 90×44 мм со сладжем и конкрементами (несколько по 3–5 мм и один 10 мм), стенки тонкие. Поджелудочная железа и селезёнка (124 мм) без патологии. Почки без конкрементов и стаза (паренхима 16 мм). Объём простаты 47 мл.',
      findingsLt:
        'Tulžies pūslė 90x44 mm, užpildyta „sludge“, matosi keletas 3-5 mm ir vienas 10 mm konkrementai, sienelės plonos, bendras tulžies latakas 8 mm. Inkstų kolektorika neišplėsta, konkrementų nėra. Prostata: V-47 ml. Išvada: tulžies pūslės akmenligė ir „sludge“, prostatos hiperplazija.',
      docMatchRe: /2026-05-25_Гастроэнтеролог/,
    },
    {
      id: 'ev_2026_10_12_ortho_xr',
      date: '2026-10-12',
      specialty: 'ortho',
      episodeId: 'ep_ortho_2026',
      kind: 'Рентгенография и консультация ортопеда',
      titleRu: 'Рентген таза и левого коленного сустава (12.10) + консультация ортопеда (20.10.2026)',
      clinic: 'Каунасская поликлиника (Р. Баришаускене) / больница Друскининкай (А. Сипавичюс)',
      findingsRu:
        'Рентген таза и левого колена (12.10.2026): суставные щели сохранены, костной рентгенологической патологии не выявлено. Ортопед (20.10.2026): боль в области большого вертела левого бедра по ходу широкой фасции (трохантерит / синовит M65.85); направлен на МРТ левого ТБС. Также 08.10.2026 выдано направление к сосудистому хирургу (подозрение на варикоз вен левой ноги, I83.9).',
      findingsLt:
        '2026-10-12 Rentgenas: Kairio kelio ir abiejų klubų sąnarinių tarpų aukščiai nepakitę. Išvada: be kaulinės rentgenologinės patologijos. 2026-10-20 Ortopedas: K. klubo judesiai kiek skausmingi, ribota vidinė rotacija skausminga didžiojo gumburo srityje, plinta šlaunimi distalyn pagal fascia lata eigą (M65.85).',
      docMatchRe: /2026-10-12_Рентген|2026-10-20_Ортопед/,
    },
    {
      id: 'ev_2026_10_23_mri_hip',
      date: '2026-10-23',
      specialty: 'ortho',
      episodeId: 'ep_ortho_2026',
      kind: 'МРТ тазобедренного сустава',
      titleRu: 'МРТ левого тазобедренного сустава (1.5 Тл) — без структурной патологии',
      clinic: 'Affidea Lietuva (Алитус), радиолог С. Инокайтене',
      findingsRu:
        'В обоих тазобедренных суставах выпота нет, субхондральных повреждений не выявлено. Вертлужная губа (labrum acetabulare) без разрывов и паралабральных кист. Сухожилия, связки, мышцы и мягкие ткани без структурных МР-изменений. В вертельных сумках (бурсах) избытка жидкости нет. Сосудисто-нервные пучки без изменений. Заключение: без значимых МР-изменений.',
      findingsLt:
        'Abipus klubų sąnariuose skysčio nepadaugėję, subchondraliai pažeidimų nematyti. Labrum acetabulare aiškių plyšimų, paralabrinių cistų nematyti. Sausgyslėse ir raiščiuose žymesnių pažeidimų, plyšimų nematyti. Raumenyse, minkštuosiuose audiniuose struktūrinių MR pakitimų nematyti. Klubų bursose skysčio nepadaugėję. Išvada: Be žymesnių MR SI pakitimų.',
      docMatchRe: /2026-10-23_МРТ/,
    },
  ];

  const clinicalEvents = rawEvents.map((ev) => {
    const matchedDocs = documents.filter(
      (d) => ev.docMatchRe?.test(d.fileName) || (d.specialty === ev.specialty && daysBetween(d.date, ev.date) <= 5),
    );
    return {
      id: ev.id,
      date: ev.date,
      specialty: ev.specialty,
      episodeId: ev.episodeId,
      kind: ev.kind,
      titleRu: ev.titleRu,
      clinic: ev.clinic,
      findingsRu: ev.findingsRu,
      findingsLt: ev.findingsLt,
      documentIds: matchedDocs.map((d) => d.id),
      documentPaths: matchedDocs.map((d) => d.path),
    };
  });

  // 4. Клинические эпизоды (группировка связанных событий для хронологии)
  const episodes = [
    {
      id: 'ep_ortho_2026',
      titleRu: 'Диагностика боли в левом бедре и ноге (октябрь 2026)',
      specialty: 'ortho',
      period: '10.2026',
      summary:
        'Направления семейного врача (08.10) → рентген таза и колена без костной патологии (12.10) → осмотр ортопеда, диагноз трохантерит M65.85 (20.10) → МРТ левого ТБС без структурных изменений (23.10). Остаётся плановая консультация сосудистого хирурга.',
    },
    {
      id: 'ep_cardio_2024_2026',
      titleRu: 'Кардиологическое обследование и контроль липидов (2024–2026)',
      specialty: 'cardio',
      period: '11.2024 – 05.2026',
      summary:
        'SCORE2 11 % (ЛПНП 4.06) → старт статинов (06–07.2025, переход на Аторвастатин 10 мг) → ЭхоКГ (ФВ 55 %), Холтер, ВЭМ (150 W, ЖЭС) → КТ-коронарография (CAC 288, CAD-RADS 2/P2) → снижение ЛПНП до 1.95 ммоль/л (-52 %) и ApoB 0.72 г/л.',
    },
    {
      id: 'ep_gastro_2025_2026',
      titleRu: 'Наблюдение желчнокаменной болезни (2025–2026)',
      specialty: 'gastro',
      period: '01.2025 – 05.2026',
      summary:
        'УЗИ БП 01.2025 (конкремент 12 мм, сладж) → УЗИ БП 05.2026 Гродно и Алитус (сладж, конкременты 3–5 мм и 10–15 мм, стенки тонкие, холедох 8 мм, печёночные пробы и липаза в норме).',
    },
    {
      id: 'ep_psa_mri_2025',
      titleRu: 'Верификация повышения ПСА и мпМРТ простаты (2025)',
      specialty: 'uro',
      period: '02.2025 – 12.2025',
      summary:
        'ПСА 7.015 мкг/л (02.2025) → мпМРТ простаты (03.2025: объём 35 мл, PI-RADS 2, очагов PI-RADS > 3 нет) → санация бактериурии по посеву → снижение ПСА до 6.62 мкг/л (11–12.2025).',
    },
    {
      id: 'ep_uti_2024',
      titleRu: 'Острый эпизод ИМП / простатита (октябрь – ноябрь 2024)',
      specialty: 'uro',
      period: '10.2024 – 11.2024',
      summary:
        'Острый дебют с лихорадкой и СРБ 190.98 мг/л, отёк простаты до 75 мл (15.10.2024) → быстрое снижение СРБ до 39.32 (18.10) и 2.4 мг/л (06.11) после терапии по посеву E. coli.',
    },
  ];

  // 5. Курсы медикаментозной терапии (для диаграммы Ганта и карточки визита к врачу)
  const medications = [
    {
      id: 'med_atorva',
      drugRu: 'Аторвастатин',
      drugLt: 'Atorvastatinas',
      dose: '10 мг × 1 раз вечером',
      specialty: 'cardio',
      start: '2025-07-30',
      end: null,
      active: true,
      reason: 'Дислипидемия, коронарный атеросклероз CAD-RADS 2 (цель ЛПНП < 1.8 ммоль/л)',
    },
    {
      id: 'med_tamsu',
      drugRu: 'Тамсулозин (Фокусин)',
      drugLt: 'Tamsulozino hidrochloridas',
      dose: '0.4 мг × 1 раз в сутки',
      specialty: 'uro',
      start: '2024-10-15',
      end: null,
      active: true,
      reason: 'ДГПЖ (N40), нормализация уродинамики',
    },
    {
      id: 'med_metoprolol',
      drugRu: 'Метопролола сукцинат',
      drugLt: 'Metoprololio sukcinatas',
      dose: '23.75 мг по 0.5 таб. (11.88 мг) утром',
      specialty: 'cardio',
      start: '2026-02-27',
      end: null,
      active: true,
      reason: 'Желудочковая экстрасистолия на нагрузке (I49.3), контроль ЧСС и АД',
    },
    {
      id: 'med_trimetazidine',
      drugRu: 'Триметазидин МВ',
      drugLt: 'Trimetazidino dihidrochloridas',
      dose: '35 мг × 2 раза в сутки (утром и вечером)',
      specialty: 'cardio',
      start: '2026-01-30',
      end: null,
      active: true,
      reason: 'Метаболическая кардиопротекция (назначен кардиологом 30.01 и 20.03.2026)',
    },
    {
      id: 'med_aspirin',
      drugRu: 'Ацетилсалициловая кислота (Аспирин)',
      drugLt: 'Aspirinas',
      dose: '100 мг × 1 раз вечером',
      specialty: 'cardio',
      start: '2026-03-20',
      end: null,
      active: true,
      reason: 'Профилактика при коронарном кальцинозе CAC 288 / CAD-RADS 2 (рекомендация кардиолога 20.03.2026)',
    },
    {
      id: 'med_rosuva',
      drugRu: 'Розувастатин',
      drugLt: 'Rozuvastatinas',
      dose: '10 мг × 1 раз в сутки',
      specialty: 'cardio',
      start: '2025-06-06',
      end: '2025-07-30',
      active: false,
      reason: 'Заменён на Аторвастатин 10 мг из-за побочного эффекта со стороны ЖКТ',
    },
    {
      id: 'med_nitro_2025',
      drugRu: 'Нитрофурантоин',
      drugLt: 'Nitrofurantoinas',
      dose: '100 мг × 2 раза в сутки (10 дней)',
      specialty: 'uro',
      start: '2025-04-07',
      end: '2025-04-17',
      active: false,
      reason: 'Санация E. coli > 10⁵ по результатам посева мочи',
    },
    {
      id: 'med_cipro_2025',
      drugRu: 'Ципрофлоксацин',
      drugLt: 'Ciprofloksacinas',
      dose: '500 мг × 2 раза в сутки (5 дней)',
      specialty: 'uro',
      start: '2025-03-12',
      end: '2025-03-17',
      active: false,
      reason: 'Эмпирический курс при лейкоцитурии до результата посева',
    },
    {
      id: 'med_uvamin_2024',
      drugRu: 'Бисептол → Увамин (Нитрофурантоин)',
      drugLt: 'Biseptol 960 mg → Uvamin 100 mg',
      dose: 'Курс антибактериальной терапии',
      specialty: 'uro',
      start: '2024-10-15',
      end: '2024-11-02',
      active: false,
      reason: 'Купирование острого эпизода ИМП / простатита (СРБ 190.98 → 2.4 мг/л)',
    },
  ];

  // 6. План контрольных обследований и чекапов (формирует и блок «Требует внимания»)
  const followUps = [
    {
      id: 'fu_vascular_2026',
      titleRu: 'Консультация сосудистого хирурга (УЗДГ вен нижних конечностей)',
      titleLt: 'Kraujagyslių chirurgo konsultacija (kojų venų dvigubas skenavimas)',
      specialty: 'cardio',
      dueDate: '2026-11-15',
      dueLabel: 'Ноябрь 2026 (открытое направление от 08.10.2026)',
      status: 'pending',
      priority: 'high',
      source: 'Направление семейного врача К. Юшка от 08.10.2026 (I83.9, боль в левой ноге)',
    },
    {
      id: 'fu_ortho_followup',
      titleRu: 'Повторная оценка у ортопеда / семейного врача после МРТ левого ТБС',
      titleLt: 'Ortopedo / šeimos gydytojo įvertinimas po kairio klubo MRT',
      specialty: 'ortho',
      dueDate: '2026-11-20',
      dueLabel: 'Ноябрь 2026 (МРТ от 23.10.2026 выполнено — без патологии сустава)',
      status: 'pending',
      priority: 'medium',
      source: 'Консультация ортопеда А. Сипавичюса от 20.10.2026 («kontrolė po tyrimo»)',
    },
    {
      id: 'fu_psa_2026',
      titleRu: 'Плановый контроль ПСА общего и общего анализа мочи (ОАМ)',
      titleLt: 'Planinė PSA ir bendro šlapimo tyrimo (BŠT) kontrolė',
      specialty: 'uro',
      dueDate: '2026-11-30',
      dueLabel: 'Ноябрь – декабрь 2026 (1 раз в 6–12 мес.)',
      status: 'pending',
      priority: 'high',
      source: 'Консультация уролога А. Алишаускаса от 03.12.2025 (предыдущий ПСА 6.62 от 12.11.2025)',
    },
    {
      id: 'fu_ticovac_dose3',
      titleRu: 'Проверить срок 3-й дозы вакцины TicoVac (клещевой энцефалит)',
      titleLt: 'Patikrinti TicoVac 3-iosios dozės terminą (erkinis encefalitas)',
      specialty: 'prev',
      dueDate: '2026-11-15',
      dueLabel: 'Проверить статус (2-я доза была 17.05.2025; 3-я доза вводится через 5–12 мес.)',
      status: 'pending',
      priority: 'medium',
      source: 'Вакцинация TicoVac (доза 1 — 26.04.2025, доза 2 — 17.05.2025)',
    },
    {
      id: 'fu_ct_lungs_2027',
      titleRu: 'Контрольная низкодозная КТ лёгких (очаги до 5 мм)',
      titleLt: 'Kontrolinė krūtinės ląstos KT po 12 mėn. (židiniai iki 5 mm)',
      specialty: 'cardio',
      dueDate: '2027-03-09',
      dueLabel: 'Март 2027 (через 12 мес. после КТ от 09.03.2026)',
      status: 'scheduled',
      priority: 'high',
      source: 'КТ-коронарография InMedica от 09.03.2026 («Plaučiuose pavieniai smulkūs židiniai - KT kontrolė po 12 mėn.»)',
    },
    {
      id: 'fu_lipids_2027',
      titleRu: 'Контроль липидограммы (ЛПНП, цель < 1.8 ммоль/л) и печёночных проб (АЛТ, АСТ)',
      titleLt: 'Lipidogramos (tikslinis MTL-C < 1,8 mmol/l) ir kepenų fermentų (ALT, AST) kontrolė',
      specialty: 'cardio',
      dueDate: '2027-05-01',
      dueLabel: 'Весна 2027 (или раньше при коррекции дозы статина)',
      status: 'scheduled',
      priority: 'medium',
      source: 'Консультация кардиолога Ю. Юргайтите от 20.03.2026',
    },
    {
      id: 'fu_us_abd_2027',
      titleRu: 'Ежегодное УЗИ органов брюшной полости и почек + УЗИ БЦА',
      titleLt: 'Kasmetinė pilvo organų ir kaklo kraujagyslių echoskopija',
      specialty: 'gastro',
      dueDate: '2027-05-25',
      dueLabel: 'Май 2027 (контроль конкрементов желчного пузыря и бляшек БЦА)',
      status: 'scheduled',
      priority: 'medium',
      source: 'УЗИ брюшной полости от 25.05.2026 и УЗИ БЦА от 05.05.2026',
    },
  ];

  // 7. Шаблоны «Карточка визита к врачу» (RU + LT, проверенные по реальным выпискам)
  const visitTemplates = [
    {
      id: 'visit_vascular',
      specialistRu: 'Сосудистый хирург',
      specialistLt: 'Kraujagyslių chirurgas',
      specialty: 'cardio',
      reasonRu: 'Боль в левой нижней конечности (бедро/голень), исключение венозной/артериальной патологии (направление от 08.10.2026, I83.9).',
      reasonLt: 'Kairės kojos (šlaunies / blauzdos) skausmas. Siuntimas išduotas 2026-10-08 (I83.9 įtariama kojų venų varikozė).',
      keyFactsRu: [
        'МРТ левого тазобедренного сустава (23.10.2026, Affidea) и рентген таза/левого колена (12.10.2026): без костной и суставной патологии, бурсы без выпота.',
        'УЗИ брахиоцефальных артерий (05.05.2026): бляшки в каротидных бифуркациях (справа 15 %, слева 20 %).',
        'КТ-коронарография (09.03.2026): CAC Agatston 288, CAD-RADS 2/P2 (стенозы до 25–49 %).',
        'ЛПНП снижен с 4.06 до 1.95 ммоль/л на Аторвастатине 10 мг; ApoB 0.72 г/л.',
      ],
      keyFactsLt: [
        '2026-10-23 Kairio klubo MRT (Affidea) ir 2026-10-12 klubų bei kairio kelio rentgenogramos: be žymesnių MR SI ir kaulinių pakitimų, bursose skysčio nepadaugėję.',
        '2026-05-05 Kaklo kraujagyslių UG: aterosklerotinės plokštelės miego arterijų bifurkacijose (deš. 15 %, kair. 20 %).',
        '2026-03-09 Širdies VA KT angiografija: Agatston 288, CAD-RADS 2/P2 (stenozės 25–49 %).',
        'MTL-C sumažėjo nuo 4,06 iki 1,95 mmol/l vartojant Atorvastatiną 10 mg; ApoB 0,72 g/l.',
      ],
      questionsRu: [
        'Связана ли боль в левой ноге с венозной недостаточностью (варикозом) или артериальным кровотоком?',
        'Показано ли дуплексное сканирование (УЗДГ) артерий и вен нижних конечностей?',
        'Нужен ли компрессионный трикотаж или венотоники?',
      ],
      questionsLt: [
        'Ar kairės kojos skausmas yra susijęs su venų nepakankamumu ar arterinės kraujotakos sutrikimu?',
        'Ar tikslinga atlikti kojų venų ir arterijų dvigubą ultragarsinį skenavimą (UG)?',
        'Ar rekomenduojama kompresinė terapija ar venotonikai?',
      ],
    },
    {
      id: 'visit_ortho',
      specialistRu: 'Ортопед-травматолог',
      specialistLt: 'Ortopedas traumatologas',
      specialty: 'ortho',
      reasonRu: 'Повторная консультация с результатом МРТ левого тазобедренного сустава от 23.10.2026 (диагноз при направлении: M65.85 трохантерит / синовит).',
      reasonLt: 'Pakartotinė konsultacija po 2026-10-23 atlikto kairio klubo MRT tyrimo (diagnozė M65.85 — trochanteritas / sinovitas).',
      keyFactsRu: [
        'МРТ левого ТБС (23.10.2026, Affidea Alytus, 1.5T): в суставах и вертельных бурсах жидкости не увеличено, субхондральных повреждений нет, labrum acetabulare, сухожилия и мышцы без повреждений. Заключение: Be žymesnių MR SI pakitimų.',
        'Рентген таза и левого колена стоя (12.10.2026, Каунас): суставные щели сохранены, без костной патологии.',
        'Клинически (20.10.2026): болезненность в области большого вертела с иррадиацией по fascia lata.',
      ],
      keyFactsLt: [
        '2026-10-23 Kairio klubo MRT (Affidea Alytus): Abipus klubų sąnariuose ir bursose skysčio nepadaugėję, labrum acetabulare, sausgyslėse, raiščiuose ir raumenyse struktūrinių MR pakitimų nematyti. Išvada: Be žymesnių MR SI pakitimų.',
        '2026-10-12 Dubens ir kairio kelio rentgenogramos: sąnarinių tarpų aukščiai nepakitę, be kaulinės patologijos.',
        '2026-10-20 Objektyviai: ribota vidinė rotacija skausminga didžiojo gumburo srityje, plinta pagal fascia lata eigą.',
      ],
      questionsRu: [
        'С учётом нормальной картины МРТ ТБС, является ли болевой синдром проявлением миофасциального синдрома широкой фасции бедра (iliotibial band) или пояснично-крестцового отдела позвоночника?',
        'Какие упражнения ЛФК / кинезитерапии показаны для разгрузки области большого вертела?',
        'Нужна ли физиотерапия (УВТ, магнитотерапия) или локальная терапия?',
      ],
      questionsLt: [
        'Atsižvelgiant į tai, kad klubo MRT pakitimų nerasta, ar skausmas susijęs su fascia lata miofasciniu sindromu ar juosmeninės stuburo dalies patologija?',
        'Kokie kineziterapijos ir tempimo pratimai rekomenduojami?',
        'Ar tikslinga fizioterapija (smūginė banga, magnetoterapija)?',
      ],
    },
    {
      id: 'visit_cardio',
      specialistRu: 'Кардиолог',
      specialistLt: 'Gydytojas kardiologas',
      specialty: 'cardio',
      reasonRu: 'Плановый контроль коронарного атеросклероза (CAD-RADS 2/P2, CAC 288), дислипидемии и желудочковой экстрасистолии.',
      reasonLt: 'Planinė kardiologo kontrolė dėl vainikinių arterijų aterosklerozės (CAD-RADS 2/P2, CAC 288), dislipidemijos ir skilvelinės ekstrasistolijos.',
      keyFactsRu: [
        'КТ-коронарография (09.03.2026): Agatston 288 (LM 0, LAD 11, LCX 268, RCA 9). Стенозы: LAD S6/7 25–30 % + мышечный мостик S7; LCX S11 25–49 %; RCA S1 < 25 %. CAD-RADS 2/P2. В лёгких узелки до 5 мм (КТ-контроль 03.2027).',
        'Динамика липидов на Аторвастатине 10 мг: ЛПНП 4.06 → 1.95 ммоль/л (27.05.2026), ОХС 3.41, ТГ 0.79, ЛПВП 1.10; ApoB 0.72 г/л, ApoA1 1.25 г/л (ApoB/ApoA1 = 0.58).',
        'Безопасность терапии: АЛТ 25.5 Ед/л, АСТ 19.7 Ед/л, креатинин 63.2 мкмоль/л, СКФ 106.1 мл/мин.',
        'ЭхоКГ (30.01.2026): ФВ ЛЖ 55 %, восходящая аорта 39–40 мм. Холтер (17.02.2026): СР 69 уд/мин, 26 ЖЭС и 271 НЖЭС/сут. ВЭМ (27.02.2026): 150 W (7.5 METS), АД до 214/53, ЖЭС на нагрузке.',
      ],
      keyFactsLt: [
        '2026-03-09 Širdies VA KT: Agatston 288 (LM 0, LAD 11, LCX 268, RCA 9); RIA S6/7 ~25-30 %, S7 raumeninis tiltelis; RCX S11 ~25-49 %; CAD-RADS 2/P2.',
        'Lipidų dinamika (Atorvastatinas 10 mg): MTL-C sumažėjo nuo 4,06 iki 1,95 mmol/l (2026-05-27), CHOL 3,41, TG 0,79, DTL 1,10; ApoB 0,72 g/l, ApoB/ApoA1 = 0,58.',
        'Kepenų ir inkstų rodikliai: ALT 25,5 U/l, AST 19,7 U/l, kreatininas 63,2 µmol/l, GFG 106,1 ml/min.',
        'EchoKG (2026-01-30): IF 55 %, kylančioji aorta 39-40 mm. Holter (2026-02-17): SR, 26 skilv. Ex. VEM (2026-02-27): 150 W, 7,5 METS, AKS 214/53 mmHg.',
      ],
      questionsRu: [
        'Достаточно ли текущего снижения ЛПНП до 1.95 ммоль/л (при снижении на 52 % от исходного 4.06 и нормальном ApoB 0.72 г/л) на дозе Аторвастатина 10 мг, или требуется коррекция для достижения < 1.8 / < 1.4 ммоль/л?',
        'Продолжать ли приём Триметазидина 35 мг ×2 и Метопролола 23.75 мг по 0.5 таб. в прежнем режиме?',
        'Когда повторять ЭхоКГ (контроль диаметра восходящей аорты 39–40 мм) и Холтер?',
      ],
      questionsLt: [
        'Ar pakanka dabartinio MTL-C sumažėjimo iki 1,95 mmol/l (−52 % nuo pradinio 4,06 mmol/l, esant ApoB 0,72 g/l) vartojant Atorvastatiną 10 mg?',
        'Ar tęsti Metoprololio sukcinato (23,75 mg × 0,5 tab.) ir Trimetazidino (35 mg × 2) vartojimą?',
        'Kada tikslinga kartoti širdies echoskopiją (kylančiosios aortos 39–40 mm kontrolei) ir Holter monitoravimą?',
      ],
    },
    {
      id: 'visit_uro',
      specialistRu: 'Уролог',
      specialistLt: 'Gydytojas urologas',
      specialty: 'uro',
      reasonRu: 'Плановое наблюдение ДГПЖ (N40) и хронического простатита (N41.1, PI-RADS 2), контроль ПСА.',
      reasonLt: 'Planinė urologo kontrolė dėl prostatos gerybinės hiperplazijos (N40) ir lėtinio prostatito (N41.1, PI-RADS 2).',
      keyFactsRu: [
        'мпМРТ простаты (19.03.2025): объём ~35 мл, PSAd 0.2; транзиторная зона PI-RADS 1 (ДГПЖ), периферическая зона PI-RADS 2 (хр. простатит), очагов PI-RADS > 3 нет.',
        'Динамика ПСА: 7.015 мкг/л (14.02.2025) → 6.62 мкг/л (12.11.2025); свободный ПСА (fPSA) 0.45 мкг/л (15.10.2025).',
        'УЗИ простаты в динамике: 75 мл (15.10.2024, острый простатит) → 35 мл (19.03.2025, мпМРТ) → 47 мл (25.05.2026, трансабдоминальное УЗИ).',
        'Постоянно принимает Тамсулозин 0.4 мг ×1/сут.',
      ],
      keyFactsLt: [
        '2025-03-19 Prostatos mpMRT: tūris ~35 ml, PSAd 0,2; TZ PIRADS 1 (GPH), PZ PIRADS 2 (lėt. prostatitas), įtartinų PIRADS>3 židinių nematyti.',
        'PSA dinamika: 7,015 µg/l (2025-02-14) → 6,62 µg/l (2025-11-12).',
        '2026-05-25 Pilvo ir uropoetinės sistemos UG: inkstai be stazės ir konkrementų, prostata V-47 ml.',
        'Nuolat vartoja Tamsuloziną 0,4 mg × 1 k./d.',
      ],
      questionsRu: [
        'Нужно ли добавить к общему ПСА определение индекса PHI или соотношения fPSA/PSA при следующем контроле?',
        'Продолжать ли монотерапию Тамсулозином 0.4 мг или показана комбинированная терапия при объёме 47 мл?',
        'Через какой интервал рекомендуется повторная мпМРТ простаты?',
      ],
      questionsLt: [
        'Ar tikslinga kartu su bendru PSA tirti fPSA/PSA santykį?',
        'Ar tęsti monoterapiją Tamsulozinu 0,4 mg, ar reikalingas gydymo koregavimas?',
        'Po kiek laiko rekomenduojama kartoti prostatos mpMRT?',
      ],
    },
    {
      id: 'visit_gastro',
      specialistRu: 'Гастроэнтеролог / Семейный врач',
      specialistLt: 'Gydytojas gastroenterologas / Šeimos gydytojas',
      specialty: 'gastro',
      reasonRu: 'Наблюдение желчнокаменной болезни (K80.2) и оценка печёночного профиля на фоне терапии статинами.',
      reasonLt: 'Tulžies pūslės akmenligės (K80.2) stebėsena ir kepenų fermentų kontrolė vartojant statinus.',
      keyFactsRu: [
        'УЗИ брюшной полости (25.05.2026, Алитус): желчный пузырь 90×44 мм со сладжем, несколько конкрементов 3–5 мм и один 10 мм (в Гродно 06.05.2026 — до 15 мм), стенки тонкие, холедох 8 мм. Печень и поджелудочная железа без патологии.',
        'Биохимия печени и поджелудочной (май 2026): АЛТ 25.5 Ед/л, АСТ 19.7 Ед/л, ГГТП 14.7 Ед/л, ЩФ 50.6 Ед/л, билирубин общий 9.11 мкмоль/л, липаза 36.7 Ед/л — все показатели в норме.',
        'Скрининг колоректального рака (iFOB, 12.11.2025) и гепатита C (aHCV, 12.11.2025) — отрицательные.',
      ],
      keyFactsLt: [
        '2026-05-25 Pilvo UG: tulžies pūslė 90x44 mm su „sludge“, keli 3-5 mm ir vienas 10 mm konkrementai, sienelės plonos, bendras tulžies latakas 8 mm.',
        '2026-05-27 Kepenų ir kasos rodikliai: ALT 25,5 U/l, AST 19,7 U/l, GGT 14,7 U/l, ŠF 50,6 U/l, bendras bilirubinas 9,11 µmol/l, lipazė 36,7 U/l (visi normos ribose).',
        '2025-11-12 iFOB (slaptas kraujas išmatose) ir anti-HCV — neigiami.',
      ],
      questionsRu: [
        'Показана ли курсовая терапия урсодезоксихолевой кислотой (УДХК) с учётом билиарного сладжа и плотных конкрементов 10–15 мм, или предпочтительно динамическое наблюдение?',
        'Какова тактика при эпизодическом дискомфорте в правом подреберье?',
      ],
      questionsLt: [
        'Ar tikslingas gydymas ursodeoksicholio rūgštimi esant tulžies pūslės „sludge“ ir 10–15 mm konkrementams, ar rekomenduojama tik stebėsena?',
        'Kokia taktika rekomenduojama atsiradus epizodiniam maudimui po dešiniuoju šonkaulių lanku?',
      ],
    },
  ];

  // 8. Расчёт сводных KPI и автоматических алертов «Требует внимания» (строго по правилам!)
  const latestByAnalyte = {};
  const seriesByAnalyte = {};
  for (const r of labResults) {
    (seriesByAnalyte[r.analyte] ??= []).push(r);
  }
  for (const [code, list] of Object.entries(seriesByAnalyte)) {
    list.sort((a, b) => a.date.localeCompare(b.date));
    const curr = list[list.length - 1];
    const prev = list.length >= 2 ? list[list.length - 2] : null;
    const first = list[0];
    latestByAnalyte[code] = {
      ...curr,
      trendFromPrev: evaluateTrend(prev?.value, curr.value),
      trendFromBaseline: evaluateTrend(first?.value, curr.value),
      baselineValue: first?.value ?? null,
      baselineDate: first?.date ?? null,
      history: list.map((x) => ({ date: x.date, value: x.value, lab: x.lab, status: x.status })),
    };
  }

  // Автоматическая сборка блока «Требует внимания»
  const attentionItems = [];
  const ldl = latestByAnalyte.LDL;
  if (ldl && ldl.status === 'above_target') {
    attentionItems.push({
      id: 'att_ldl',
      kind: 'lab_target',
      specialty: 'cardio',
      severity: 'warn',
      titleRu: `ЛПНП ${ldl.value} ммоль/л — выше целевого уровня (< ${ldl.targetHigh} ммоль/л)`,
      detailRu: `Отличный ответ на Аторвастатин 10 мг (снижение с ${ldl.baselineValue} до ${ldl.value} ммоль/л, −52 %, ApoB 0.72 г/л в норме), но целевой порог < 1.8 ммоль/л формально ещё не достигнут.`,
      date: ldl.date,
    });
  }
  const psa = latestByAnalyte.PSA;
  if (psa && psa.status === 'high') {
    attentionItems.push({
      id: 'att_psa',
      kind: 'lab_high',
      specialty: 'uro',
      severity: 'warn',
      titleRu: `ПСА общий ${psa.value} мкг/л (норма ≤ ${psa.refHigh} мкг/л) — плановый контроль`,
      detailRu: `Снизился с 7.015 до 6.62 мкг/л; на мпМРТ простаты (19.03.2025) категория PI-RADS 2 (очагов > 3 нет). Подошёл срок годового контроля ПСА (ноябрь–декабрь 2026).`,
      date: psa.date,
    });
  }
  for (const fu of followUps.filter((f) => f.status === 'pending')) {
    attentionItems.push({
      id: `att_${fu.id}`,
      kind: 'followup',
      specialty: fu.specialty,
      severity: fu.priority === 'high' ? 'warn' : 'info',
      titleRu: fu.titleRu,
      detailRu: `${fu.dueLabel}. Источник: ${fu.source}.`,
      date: fu.dueDate,
    });
  }

  return {
    schemaVersion: '2.0',
    generatedAt: new Date().toISOString(),
    patient: {
      birthDate,
      gender: 'male',
      anthropometry: {
        heightCm: 176,
        weightKg: 80,
        bmi: 25.83,
        score2Percent: 11,
        cacAgatston: 288,
        cadRads: '2/P2',
        lvefPercent: 55,
        ascendingAortaMm: 40,
        piRads: 2,
        prostateVolumeMl: 47,
      },
    },
    diagnoses,
    attentionItems,
    latestByAnalyte,
    labResults,
    clinicalEvents,
    episodes,
    medications,
    followUps,
    visitTemplates,
    documents,
    pipelineReport: {
      totalDocuments: documents.length,
      standardNamedCount: documents.filter((d) => d.isStandardName).length,
      pendingRenames,
      dateDiscrepancies,
    },
  };
}

/**
 * Записывает health_db.json с предварительным созданием резервной копии в папке backups/.
 */
export async function saveHealthDatabase(rootDir = WORKSPACE_ROOT) {
  const db = await buildHealthDatabase(rootDir);
  const dbPath = join(rootDir, 'health_db.json');
  const backupsDir = join(rootDir, 'backups');

  if (existsSync(dbPath)) {
    mkdirSync(backupsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    copyFileSync(dbPath, join(backupsDir, `health_db_${stamp}.json`));
  }

  writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  return db;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const db = await saveHealthDatabase();
  console.log(
    `✅ База health_db.json собрана: документов=${db.documents.length}, анализов=${db.labResults.length}, событий=${db.clinicalEvents.length}, требуют переименования=${db.pipelineReport.pendingRenames.length}`,
  );
}
