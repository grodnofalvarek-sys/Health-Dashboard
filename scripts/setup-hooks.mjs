#!/usr/bin/env node
// Подключает версионируемые git-хуки из папки .githooks (проверка перед каждым коммитом).
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { git } from './lib/git.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
git(['config', 'core.hooksPath', '.githooks'], { cwd: repoRoot });
console.log('✅ Git-хуки подключены: перед каждым коммитом выполняется проверка на открытые данные.');
