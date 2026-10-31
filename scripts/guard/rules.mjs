// Правила защиты репозитория и сборки от попадания открытых медицинских данных.
// Чистые функции без доступа к git/файловой системе — так их легко тестировать.

/** Сигнатура (первые байты) всех зашифрованных файлов приложения. */
export const ENC_MAGIC = 'HDENC1';

/** Расширения, которые никогда не должны попадать в репозиторий и сборку. */
const BLOCKED_EXT = new Set([
  '.pdf', '.jpg', '.jpeg', '.heic', '.heif', '.tif', '.tiff', '.bmp', '.gif',
  '.doc', '.docx', '.xls', '.xlsx', '.odt', '.ods', '.csv', '.txt', '.rtf',
  '.dcm', '.zip', '.7z', '.rar', '.sqlite', '.db',
]);

/** Изображения допустимы только как иконки/ассеты интерфейса. */
const IMAGE_EXT = new Set(['.png', '.svg', '.ico', '.webp']);
const IMAGE_ALLOWED_DIRS = {
  repo: ['public/icons/', 'src/assets/'],
  dist: ['icons/', 'assets/'],
};

/** JSON в репозитории разрешён только для конфигурации (не для данных пациента). */
const JSON_ALLOWED_REPO = [
  /^package(-lock)?\.json$/,
  /^tsconfig(\.[\w-]+)?\.json$/,
  /^src\/config\/.+\.json$/,
  /^pipeline\/config\/.+\.json$/,
  /^\.vscode\/[\w-]+\.json$/,
];

/** Имена, характерные для файлов с данными пациента. */
const DATA_NAME_RE = /(medical|health[_-]?db|patient|database|пациент|анализ)/i;

/** Текстовые файлы, содержимое которых проверяется на персональные данные. */
const TEXT_EXT = new Set([
  '.ts', '.tsx', '.js', '.mjs', '.cjs', '.jsx', '.json', '.md', '.html', '.css',
  '.yml', '.yaml', '.webmanifest', '.svg', '.sh', '.bat', '.cmd', '.ps1',
]);

/** Файлы, где длинные числа — норма (хеши, версии); их содержимое не сканируется. */
const CONTENT_SCAN_SKIP = [/(^|\/)package-lock\.json$/];

/** Литовский персональный код: G ГГММДД NNNN (11 цифр). */
const LT_PERSONAL_CODE_RE =
  /(?<!\d)[1-6]\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{4}(?!\d)/;

const MAX_FILE_BYTES = 25 * 1024 * 1024;

function ext(path) {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot).toLowerCase() : '';
}

function baseName(path) {
  return path.slice(path.lastIndexOf('/') + 1);
}

function normalize(path) {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * Проверяет один файл.
 * @param {{path: string, size: number, read: () => Buffer}} file  путь относительно корня репозитория или dist
 * @param {{mode: 'repo'|'dist', piiTerms?: string[]}} ctx
 * @returns {string[]} список нарушений (пустой — файл допустим)
 */
export function checkFile(file, ctx) {
  const path = normalize(file.path);
  const e = ext(path);
  const name = baseName(path);
  const issues = [];
  const mode = ctx.mode;

  if (BLOCKED_EXT.has(e)) {
    issues.push(`запрещённый тип файла (${e}) — документы и выгрузки не публикуются`);
  }

  if (/^\.env(\..+)?$/.test(name) && name !== '.env.example') {
    issues.push('файл .env содержит секреты (ключи API) и не публикуется');
  }

  if (IMAGE_EXT.has(e)) {
    const allowed = IMAGE_ALLOWED_DIRS[mode].some((d) => path.startsWith(d));
    if (!allowed) {
      issues.push(`изображение вне разрешённых папок (${IMAGE_ALLOWED_DIRS[mode].join(', ')})`);
    }
  }

  if (e === '.json') {
    if (mode === 'dist') {
      issues.push('JSON в сборке запрещён — данные публикуются только в виде .enc');
    } else if (!JSON_ALLOWED_REPO.some((re) => re.test(path))) {
      issues.push('JSON вне разрешённых конфигурационных путей — данные публикуются только в виде .enc');
    }
  }

  if (e !== '.enc' && e !== '.json' && DATA_NAME_RE.test(name) && !TEXT_EXT.has(e)) {
    issues.push('имя файла похоже на файл с данными пациента');
  }

  const dataDir = mode === 'repo' ? 'public/data/' : 'data/';
  if (path.startsWith(dataDir) && e !== '.enc' && name !== '.gitkeep') {
    issues.push(`в папке ${dataDir} допустимы только зашифрованные файлы .enc`);
  }

  if (file.size > MAX_FILE_BYTES) {
    issues.push(`файл слишком большой (${(file.size / 1048576).toFixed(1)} МБ > 25 МБ)`);
  }

  if (e === '.enc') {
    const head = file.read().subarray(0, ENC_MAGIC.length).toString('latin1');
    if (head !== ENC_MAGIC) {
      issues.push('файл .enc не зашифрован (нет сигнатуры шифрования) — возможно, переименованный открытый файл');
    }
  }

  if (TEXT_EXT.has(e) && !CONTENT_SCAN_SKIP.some((re) => re.test(path))) {
    const text = file.read().toString('utf8');
    if (LT_PERSONAL_CODE_RE.test(text)) {
      issues.push('найден номер, похожий на персональный код (asmens kodas)');
    }
    const lower = text.toLowerCase();
    for (const term of ctx.piiTerms ?? []) {
      if (lower.includes(term.toLowerCase())) {
        issues.push('найдены персональные данные из локального списка .private/pii_terms.txt');
        break;
      }
    }
  }

  return issues;
}

/**
 * Разбирает файл со списком персональных терминов (по одному в строке, # — комментарий).
 * Слишком короткие строки отбрасываются, чтобы избежать ложных срабатываний.
 */
export function parsePiiTerms(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.length >= 4);
}
