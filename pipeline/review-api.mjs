// Локальный API конвейера для ПК (принятие переименований, пересборка health_db.json, откат к резервной копии,
// раздача локальных PDF/JPG и базы в режиме разработки на ПК).
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { BACKUPS_DIR, HEALTH_DB_PATH, WORKSPACE_ROOT, saveHealthDatabase } from './build-db.mjs';
import { FOLDERS } from './classify.mjs';

const RENAME_LOG_PATH = join(WORKSPACE_ROOT, 'backups', 'rename_history.json');

function readRenameLog() {
  if (!existsSync(RENAME_LOG_PATH)) return [];
  try {
    return JSON.parse(readFileSync(RENAME_LOG_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function appendRenameLog(entry) {
  mkdirSync(BACKUPS_DIR, { recursive: true });
  const log = readRenameLog();
  log.unshift(entry);
  writeFileSync(RENAME_LOG_PATH, JSON.stringify(log, null, 2), 'utf8');
}

/**
 * Переименовывает и/или перемещает файл по подтверждённому предложению и записывает в журнал для возможного отката.
 */
export async function applyConfirmedRename({ currentFolder, currentName, newFolder, newName }) {
  const allowedFolders = new Set(Object.values(FOLDERS));
  if (!allowedFolders.has(currentFolder) || !allowedFolders.has(newFolder)) {
    throw new Error('Недопустимая папка документа');
  }
  if (/[/\\]/.test(currentName) || /[/\\]/.test(newName)) {
    throw new Error('Недопустимое имя файла');
  }

  const src = join(WORKSPACE_ROOT, currentFolder, currentName);
  const dst = join(WORKSPACE_ROOT, newFolder, newName);
  if (!existsSync(src)) {
    throw new Error(`Исходный файл не найден: ${currentFolder}/${currentName}`);
  }
  if (existsSync(dst) && src !== dst) {
    throw new Error(`Файл с таким именем уже существует: ${newFolder}/${newName}`);
  }

  renameSync(src, dst);
  appendRenameLog({
    timestamp: new Date().toISOString(),
    fromFolder: currentFolder,
    fromName: currentName,
    toFolder: newFolder,
    toName: newName,
  });

  return saveHealthDatabase(WORKSPACE_ROOT);
}

/**
 * Откатывает последнее переименование из журнала.
 */
export async function undoLastRename() {
  const log = readRenameLog();
  if (!log.length) throw new Error('Журнал переименований пуст');
  const last = log.shift();
  const src = join(WORKSPACE_ROOT, last.toFolder, last.toName);
  const dst = join(WORKSPACE_ROOT, last.fromFolder, last.fromName);
  if (!existsSync(src)) {
    throw new Error(`Файл для отката не найден: ${last.toFolder}/${last.toName}`);
  }
  renameSync(src, dst);
  writeFileSync(RENAME_LOG_PATH, JSON.stringify(log, null, 2), 'utf8');
  return saveHealthDatabase(WORKSPACE_ROOT);
}

/**
 * Список резервных копий health_db.json.
 */
export function listBackups() {
  if (!existsSync(BACKUPS_DIR)) return [];
  return readdirSync(BACKUPS_DIR)
    .filter((f) => /^health_db_.*\.json$/i.test(f))
    .sort()
    .reverse()
    .map((name) => {
      const st = statSync(join(BACKUPS_DIR, name));
      return { name, sizeBytes: st.size, mtime: st.mtime.toISOString() };
    });
}

/**
 * Восстанавливает health_db.json из выбранной резервной копии.
 */
export function restoreBackup(backupFileName) {
  if (!/^health_db_[\w-]+\.json$/.test(backupFileName)) {
    throw new Error('Недопустимое имя резервной копии');
  }
  const src = join(BACKUPS_DIR, backupFileName);
  if (!existsSync(src)) {
    throw new Error('Резервная копия не найдена');
  }
  copyFileSync(src, HEALTH_DB_PATH);
  return JSON.parse(readFileSync(HEALTH_DB_PATH, 'utf8'));
}

/**
 * Vite-плагин для локальной работы на ПК:
 *  - GET /__local/db        → возвращает актуальный health_db.json (пересобирая при отсутствии)
 *  - POST /__local/rescan   → пересканирует папки 01..06 и обновляет health_db.json
 *  - POST /__local/rename   → подтверждает переименование нового документа
 *  - POST /__local/undo-rename → откатывает последнее переименование
 *  - GET /__local/backups   → список резервных копий и история переименований
 *  - POST /__local/restore  → восстанавливает выбранную резервную копию
 *  - GET /__local/doc?path= → безопасно отдаёт PDF/JPG из папок 01..06 для предпросмотра на ПК
 */
export function localPipelineVitePlugin() {
  return {
    name: 'health-local-pipeline',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/__local/')) return next();

        const sendJson = (status, obj) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(obj));
        };

        const readBody = () =>
          new Promise((resolveBody, rejectBody) => {
            const chunks = [];
            req.on('data', (c) => chunks.push(c));
            req.on('end', () => {
              try {
                resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
              } catch (e) {
                rejectBody(e);
              }
            });
          });

        try {
          const url = new URL(req.url, 'http://localhost');

          if (req.method === 'GET' && url.pathname === '/__local/db') {
            const db = existsSync(HEALTH_DB_PATH)
              ? JSON.parse(readFileSync(HEALTH_DB_PATH, 'utf8'))
              : await saveHealthDatabase(WORKSPACE_ROOT);
            return sendJson(200, db);
          }

          if (req.method === 'POST' && url.pathname === '/__local/rescan') {
            const db = await saveHealthDatabase(WORKSPACE_ROOT);
            return sendJson(200, db);
          }

          if (req.method === 'POST' && url.pathname === '/__local/rename') {
            const body = await readBody();
            const db = await applyConfirmedRename(body);
            return sendJson(200, db);
          }

          if (req.method === 'POST' && url.pathname === '/__local/undo-rename') {
            const db = await undoLastRename();
            return sendJson(200, db);
          }

          if (req.method === 'GET' && url.pathname === '/__local/backups') {
            return sendJson(200, {
              backups: listBackups(),
              renameHistory: readRenameLog(),
            });
          }

          if (req.method === 'POST' && url.pathname === '/__local/restore') {
            const body = await readBody();
            const db = restoreBackup(body.name);
            return sendJson(200, db);
          }

          if (req.method === 'GET' && url.pathname === '/__local/doc') {
            const rel = url.searchParams.get('path') ?? '';
            const safeAbs = resolve(WORKSPACE_ROOT, normalize(rel));
            if (!safeAbs.startsWith(WORKSPACE_ROOT) || !existsSync(safeAbs)) {
              return sendJson(404, { error: 'Документ не найден' });
            }
            const ext = extname(safeAbs).toLowerCase();
            const mime =
              ext === '.pdf'
                ? 'application/pdf'
                : ext === '.jpg' || ext === '.jpeg'
                  ? 'image/jpeg'
                  : 'application/octet-stream';
            res.statusCode = 200;
            res.setHeader('Content-Type', mime);
            res.end(readFileSync(safeAbs));
            return;
          }

          return sendJson(404, { error: 'Неизвестный маршрут' });
        } catch (err) {
          return sendJson(400, { error: err instanceof Error ? err.message : String(err) });
        }
      });
    },
  };
}
