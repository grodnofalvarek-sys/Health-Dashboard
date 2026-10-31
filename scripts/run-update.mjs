#!/usr/bin/env node
// Интерактивный сценарий локального обновления и запуска на ПК (вызывается из update.bat).
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORKSPACE_ROOT, saveHealthDatabase } from '../pipeline/build-db.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, '..');

console.log('============================================================================');
console.log('  ЗДОРОВЬЕ • Локальное сканирование папок 01..06 и запуск дашборда на ПК');
console.log('============================================================================\n');

const db = await saveHealthDatabase(WORKSPACE_ROOT);
console.log(
  `✅ База health_db.json обновлена: документов — ${db.documents.length}, анализов — ${db.labResults.length}, событий — ${db.clinicalEvents.length}.`,
);
if (db.pipelineReport.pendingRenames.length > 0) {
  console.log(
    `🔔 Обнаружено новых файлов для переименования: ${db.pipelineReport.pendingRenames.length} (откройте «Конвейер (ПК)» в левом меню).`,
  );
}

console.log('\n🌐 Запуск локального сервера http://localhost:5173/Health-Dashboard/ (для выхода нажмите Ctrl+C)...\n');

spawnSync('npm.cmd', ['run', 'dev', '--', '--open'], {
  cwd: APP_ROOT,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
