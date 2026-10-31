#!/usr/bin/env node
// Скрипт сборки и шифрования базы health_db.json и всех 51 медицинских документов в public/data/*.enc.
// Пароль передаётся через переменную окружения HD_PASSWORD или вводится интерактивно в консоли
// (пароль не сохраняется на диск и не попадает в git).
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { WORKSPACE_ROOT, saveHealthDatabase } from '../pipeline/build-db.mjs';
import {
  DEFAULT_ITERATIONS,
  deriveAesKey,
  encryptBytesWithKey,
  generateSalt,
} from '../pipeline/crypto-node.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DATA_DIR = resolve(__dirname, '..', 'public', 'data');

async function promptPassword() {
  if (process.env.HD_PASSWORD) {
    return process.env.HD_PASSWORD;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const pwd = await rl.question(
      '🔐 Введите пароль для шифрования данных (рекомендуется от 12 символов или фраза из 4–5 слов): ',
    );
    return pwd.trim();
  } finally {
    rl.close();
  }
}

/**
 * Шифрует базу и все исходные документы в папку public/data/*.enc.
 */
export async function encryptAllForPublish(password, { includeDocs = true } = {}) {
  if (!password || password.length < 8) {
    throw new Error('Пароль слишком короткий (минимум 8 символов)');
  }

  const db = await saveHealthDatabase(WORKSPACE_ROOT);
  mkdirSync(PUBLIC_DATA_DIR, { recursive: true });

  // Очищаем старые .enc файлы перед новой сборкой
  for (const name of readdirSync(PUBLIC_DATA_DIR)) {
    if (name.endsWith('.enc')) {
      rmSync(join(PUBLIC_DATA_DIR, name), { force: true });
    }
  }

  const salt = generateSalt();
  const aesKey = await deriveAesKey(password, salt, DEFAULT_ITERATIONS);

  // 1. Шифруем основную базу health_db.json -> public/data/db.enc
  const dbBytes = new TextEncoder().encode(JSON.stringify(db));
  const dbEnc = await encryptBytesWithKey(dbBytes, aesKey, salt, DEFAULT_ITERATIONS);
  writeFileSync(join(PUBLIC_DATA_DIR, 'db.enc'), dbEnc);

  // 2. Шифруем каждый документ PDF/JPG -> public/data/<doc.id>.enc
  let encryptedDocsCount = 0;
  if (includeDocs) {
    for (const doc of db.documents) {
      const absDoc = join(WORKSPACE_ROOT, doc.path);
      if (!existsSync(absDoc)) continue;
      const rawBytes = new Uint8Array(readFileSync(absDoc));
      const encBuf = await encryptBytesWithKey(rawBytes, aesKey, salt, DEFAULT_ITERATIONS);
      writeFileSync(join(PUBLIC_DATA_DIR, `${doc.id}.enc`), encBuf);
      encryptedDocsCount += 1;
    }
  }

  return {
    dbSizeBytes: dbEnc.byteLength,
    encryptedDocsCount,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const password = await promptPassword();
  const skipDocs = process.argv.includes('--db-only');
  const res = await encryptAllForPublish(password, { includeDocs: !skipDocs });
  console.log(
    `✅ Зашифровано: db.enc (${(res.dbSizeBytes / 1024).toFixed(1)} КБ) и документов: ${res.encryptedDocsCount}.`,
  );
}
