// Извлечение текста из PDF-документов средствами Node.js (pdfjs-dist, без внешних утилит).
import { readFileSync } from 'node:fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * Извлекает текстовый слой из PDF-файла.
 * Если текстового слоя нет (< 30 символов), документ считается сканом (`isScan: true`).
 * @param {string} pdfPath абсолютный путь к PDF
 * @returns {Promise<{text: string, pages: number, isScan: boolean}>}
 */
export async function extractPdfText(pdfPath) {
  const data = new Uint8Array(readFileSync(pdfPath));
  const loadingTask = pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0,
  });
  const doc = await loadingTask.promise;
  const pageTexts = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const lines = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pageTexts.push(lines);
  }
  const text = pageTexts.join('\n').trim();
  return {
    text,
    pages: doc.numPages,
    isScan: text.length < 30,
  };
}
