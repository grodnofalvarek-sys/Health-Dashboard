// Облачный ИИ-помощник (Gemini API) для разбора сложных/неизвестных документов и перевода LT → RU.
// Выполняется ТОЛЬКО на ПК владельца в конвейере; в веб-приложение не входит.
// Правила безопасности:
//   1. Текст обязательно обезличивается через anonymizeText() перед отправкой.
//   2. Все извлечённые числа проверяются через verifyNumberInText() по исходному тексту.
//   3. Ответы кэшируются локально по SHA-256 обезличенного текста в app/cache/gemini-cache.json.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { anonymizeText, verifyNumberInText } from './anonymize.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = resolve(__dirname, '..', 'cache', 'gemini-cache.json');

function readCache() {
  if (!existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function writeCache(cache) {
  mkdirSync(dirname(CACHE_PATH), { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
}

function loadEnvApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  const envFile = resolve(__dirname, '..', '.env');
  if (!existsSync(envFile)) return '';
  const m = readFileSync(envFile, 'utf8').match(/^\s*GEMINI_API_KEY\s*=\s*(.+)\s*$/m);
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}

/**
 * Вызывает Gemini API с обезличенным текстом документа для получения перевода LT → RU
 * и структурированного резюме. Если ключ не задан — возвращает null (работают локальные правила).
 */
export async function analyzeDocumentWithGemini(rawText, piiTerms = []) {
  const apiKey = loadEnvApiKey();
  if (!apiKey || !rawText || rawText.trim().length < 30) {
    return null;
  }

  const cleanText = anonymizeText(rawText, piiTerms);
  const hash = createHash('sha256').update(cleanText).digest('hex');
  const cache = readCache();
  if (cache[hash]) {
    return cache[hash];
  }

  const prompt = [
    'Ты — медицинский ассистент-переводчик. Перед тобой обезличенный текст медицинского документа (на литовском или русском).',
    'Верни строго JSON со следующими полями:',
    '- date: дата исследования в формате YYYY-MM-DD',
    '- specialty: одно из cardio | uro | gastro | ortho | lab | prev',
    '- proposedFileName: имя файла по шаблону ГГГГ-ММ-ДД_Тип_Детали_Клиника.pdf на русском',
    '- findingsOriginal: краткая выжимка заключения (Išvada / описание) на языке оригинала',
    '- findingsRu: точный медицинский перевод заключения на русский язык',
    '- labs: массив [{ "analyte": "LDL|CHOL|HDL|TG|PSA|CRP|CREA|EGFR|ALT|AST|TSH|HGB|WBC|PLT|GLU", "value": число }]',
    '',
    'Текст документа:',
    cleanText.slice(0, 12000),
  ].join('\n');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini API вернул ошибку ${res.status}`);
  }
  const body = await res.json();
  const rawJson = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawJson) return null;

  const parsed = JSON.parse(rawJson);
  if (Array.isArray(parsed.labs)) {
    parsed.labs = parsed.labs.filter((item) => verifyNumberInText(Number(item.value), rawText));
  }
  parsed.verificationStatus = 'pending_review';
  parsed.isMachineTranslation = true;

  cache[hash] = parsed;
  writeCache(cache);
  return parsed;
}
