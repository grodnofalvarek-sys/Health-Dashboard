// Поиск исполняемого git: сначала PATH, затем встроенный git из GitHub Desktop (Windows).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

let cached;

export function findGit() {
  if (cached) return cached;
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    cached = 'git';
    return cached;
  } catch {
    /* git нет в PATH — ищем в GitHub Desktop */
  }
  const base = process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'GitHubDesktop');
  if (base && existsSync(base)) {
    const apps = readdirSync(base).filter((d) => d.startsWith('app-')).sort().reverse();
    for (const app of apps) {
      const candidate = join(base, app, 'resources', 'app', 'git', 'cmd', 'git.exe');
      if (existsSync(candidate)) {
        cached = candidate;
        return cached;
      }
    }
  }
  throw new Error('git не найден: установите Git или GitHub Desktop');
}

/** Выполняет git и возвращает stdout как Buffer. */
export function git(args, opts = {}) {
  return execFileSync(findGit(), args, { maxBuffer: 256 * 1024 * 1024, ...opts });
}
