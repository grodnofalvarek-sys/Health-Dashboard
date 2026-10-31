#!/usr/bin/env node
// Интерактивный сценарий публикации (вызывается из publish.bat).
// Выполняет:
//   1) сборку health_db.json и шифрование AES-256-GCM (public/data/*.enc),
//   2) проверку безопасности репозитория (Data-Leak Guard),
//   3) сборку PWA и финальную проверку бандла dist/.
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { encryptAllForPublish } from './encrypt-data.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, '..');

async function askPassword() {
  if (process.env.HD_PASSWORD) {
    return process.env.HD_PASSWORD.trim();
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log('============================================================================');
    console.log('  ЗДОРОВЬЕ • Подготовка зашифрованного пакета для GitHub Pages (AES-256-GCM)');
    console.log('============================================================================\n');
    while (true) {
      const pwd = (
        await rl.question(
          '🔐 Придумайте или введите ваш мастер-пароль (минимум 8 символов, лучше 12+): ',
        )
      ).trim();
      if (pwd.length >= 8) {
        return pwd;
      }
      console.log('⚠️  Пароль слишком короткий — введите не менее 8 символов.\n');
    }
  } finally {
    rl.close();
  }
}

function runStep(title, cmd, args) {
  console.log(`\n----------------------------------------------------------------------------`);
  console.log(title);
  console.log(`----------------------------------------------------------------------------`);
  const res = spawnSync(cmd, args, {
    cwd: APP_ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (res.status !== 0) {
    console.error(`\n❌ Ошибка на шаге: ${title}`);
    process.exit(res.status ?? 1);
  }
}

try {
  const password = await askPassword();

  console.log('\n----------------------------------------------------------------------------');
  console.log('[1/3] Сканирование папок 01..06 и шифрование контейнеров AES-256-GCM...');
  console.log('----------------------------------------------------------------------------');
  const encRes = await encryptAllForPublish(password, { includeDocs: true });
  console.log(
    `✅ Зашифровано: база db.enc (${(encRes.dbSizeBytes / 1024).toFixed(1)} КБ) + медицинских документов: ${encRes.encryptedDocsCount} шт.`,
  );

  runStep(
    '[2/3] Проверка безопасности репозитория (Data-Leak Guard)...',
    'node',
    ['scripts/check-public.mjs', '--repo'],
  );

  runStep(
    '[3/3] Сборка PWA-приложения и проверка выходного пакета dist/...',
    'npm.cmd',
    ['run', 'build'],
  );

  runStep(
    'Финальная проверка папки dist/ на отсутствие открытых данных...',
    'node',
    ['scripts/check-public.mjs', '--dist'],
  );

  console.log('\n============================================================================');
  console.log('🎉 ГОТОВО! Все данные зашифрованы в папке app/public/data/*.enc');
  console.log('Что делать дальше:');
  console.log('  1. Откройте программу GitHub Desktop.');
  console.log('  2. Добавьте локальный репозиторий: File -> Add local repository -> папка "Health care\\app".');
  console.log('  3. Внизу слева введите комментарий (например: "Обновление базы") и нажмите "Commit to main".');
  console.log('  4. Нажмите кнопку "Publish repository" (при первом разе) или "Push origin".');
  console.log('============================================================================\n');
} catch (err) {
  console.error('\n❌ Ошибка:', err instanceof Error ? err.message : err);
  process.exit(1);
}
