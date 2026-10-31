// Обезличивание текста медицинского документа перед отправкой в облачный ИИ.
// Заменяет ФИО, литовский персональный код, ESI/ID пациента, адрес, телефон и e-mail на нейтральные метки.
// Персональные строки загружаются локально из .private/pii_terms.txt и никогда не хранятся в коде репозитория.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCAL_PII_PATH = resolve(__dirname, '..', '..', '.private', 'pii_terms.txt');

const LT_PERSONAL_CODE_GLOBAL = /(?<!\d)[1-6]\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{4}(?!\d)/g;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?370|8)\s*[-()]?\s*\d{2,3}[\s\-()]*\d{2}[\s\-()]*\d{2,3}/g;
const ESI_RE = /\bpatient-\d{6}-\d{5}\b/gi;

function loadLocalPiiTerms() {
  if (!existsSync(LOCAL_PII_PATH)) return [];
  try {
    return readFileSync(LOCAL_PII_PATH, 'utf8')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 3 && !s.startsWith('#'));
  } catch {
    return [];
  }
}

/**
 * Обезличивает медицинский текст.
 * @param {string} text исходный текст документа
 * @param {string[]} [extraTerms] дополнительные строки для скрытия
 * @returns {string}
 */
export function anonymizeText(text, extraTerms = []) {
  if (!text) return '';
  let out = text;

  const allTerms = [...loadLocalPiiTerms(), ...extraTerms];
  for (const raw of allTerms) {
    const term = raw.trim();
    if (term.length < 3 || /^\d{4}-\d{2}-\d{2}$/.test(term)) continue;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(escaped, 'gi'), '[СКРЫТО]');
  }

  out = out.replace(ESI_RE, '[ESI_ID]');
  out = out.replace(LT_PERSONAL_CODE_GLOBAL, '[ПЕРС_КОД]');
  out = out.replace(EMAIL_RE, '[EMAIL]');
  out = out.replace(PHONE_RE, '[ТЕЛЕФОН]');

  return out;
}

/**
 * Проверяет, что извлечённое ИИ числовое значение действительно присутствует в исходном тексте
 * (защита от галлюцинаций чисел).
 * @param {number} value
 * @param {string} sourceText
 */
export function verifyNumberInText(value, sourceText) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  const normalized = sourceText.replace(/,/g, '.');
  const candidates = new Set([
    String(value),
    value.toFixed(1),
    value.toFixed(2),
    value.toFixed(3),
  ]);
  for (const c of candidates) {
    const escaped = c.replace('.', '[.,]');
    const re = new RegExp(`(?<!\\d)${escaped}(?!\\d)`);
    if (re.test(normalized) || re.test(sourceText)) return true;
  }
  return false;
}
