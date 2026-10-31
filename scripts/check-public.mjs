#!/usr/bin/env node
// Проверка, что в коммит / репозиторий / сборку не попадают открытые медицинские данные.
//   --staged  файлы, подготовленные к коммиту (запускается git-хуком pre-commit)
//   --repo    все файлы репозитория (кроме игнорируемых)
//   --dist    готовая сборка в папке dist/
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkFile, parsePiiTerms } from './guard/rules.mjs';
import { git } from './lib/git.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] ?? '--repo';

function loadPiiTerms() {
  const file = process.env.HD_PII_FILE ?? resolve(repoRoot, '..', '.private', 'pii_terms.txt');
  if (!existsSync(file)) {
    console.warn('⚠️  Список персональных терминов (.private/pii_terms.txt) не найден — проверка содержимого ограничена.');
    return [];
  }
  return parsePiiTerms(readFileSync(file, 'utf8'));
}

function splitZ(buf) {
  return buf.toString('utf8').split('\0').filter(Boolean);
}

function stagedFiles() {
  const names = splitZ(git(['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR'], { cwd: repoRoot }));
  return names.map((path) => {
    let data;
    const read = () => (data ??= git(['show', `:${path}`], { cwd: repoRoot }));
    const size = Number(git(['cat-file', '-s', `:${path}`], { cwd: repoRoot }).toString().trim());
    return { path, size, read };
  });
}

function repoFiles() {
  const names = splitZ(git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: repoRoot }));
  return names
    .filter((p) => existsSync(join(repoRoot, p)))
    .map((path) => fileFromDisk(repoRoot, join(repoRoot, path)));
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)],
  );
}

function distFiles() {
  const dist = join(repoRoot, 'dist');
  if (!existsSync(dist)) {
    console.error('Папка dist/ не найдена — сначала выполните сборку (npm run build).');
    process.exit(2);
  }
  return walk(dist).map((abs) => fileFromDisk(dist, abs));
}

function fileFromDisk(root, abs) {
  let data;
  return {
    path: relative(root, abs).replace(/\\/g, '/'),
    size: statSync(abs).size,
    read: () => (data ??= readFileSync(abs)),
  };
}

const ctxMode = mode === '--dist' ? 'dist' : 'repo';
const files = mode === '--staged' ? stagedFiles() : mode === '--dist' ? distFiles() : repoFiles();
const piiTerms = loadPiiTerms();

let problems = 0;
for (const file of files) {
  const issues = checkFile(file, { mode: ctxMode, piiTerms });
  if (issues.length) {
    problems += 1;
    console.error(`✖ ${file.path}`);
    for (const issue of issues) console.error(`    — ${issue}`);
  }
}

if (problems) {
  console.error(`\n⛔ Публикация остановлена: ${problems} файл(ов) с нарушениями. Открытые медицинские данные не должны попадать в репозиторий.`);
  process.exit(1);
}
console.log(`✅ Проверка пройдена (${mode.replace('--', '')}): ${files.length} файл(ов), открытых данных не найдено.`);
