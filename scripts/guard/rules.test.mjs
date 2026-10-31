import { describe, expect, it } from 'vitest';
import { ENC_MAGIC, checkFile, parsePiiTerms } from './rules.mjs';

const file = (path, content = '', size) => {
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  return { path, size: size ?? buf.length, read: () => buf };
};
// Вымышленный код собирается из частей, чтобы сам тест не срабатывал на проверку репозитория.
const FAKE_CODE = '399' + '1231' + '0000';
const repo = (f, piiTerms = []) => checkFile(f, { mode: 'repo', piiTerms });
const dist = (f, piiTerms = []) => checkFile(f, { mode: 'dist', piiTerms });

describe('guard: запрещённые документы', () => {
  it.each([
    'public/2026-10-23_МРТ.pdf',
    'docs/scan.JPG',
    'src/assets/report.pdf',
    'export.xlsx',
    'notes.txt',
  ])('блокирует %s', (p) => {
    expect(repo(file(p, 'x'))).not.toHaveLength(0);
  });

  it('блокирует PDF в сборке', () => {
    expect(dist(file('assets/doc.pdf', '%PDF-1.7'))).not.toHaveLength(0);
  });
});

describe('guard: данные только в зашифрованном виде', () => {
  it('блокирует открытый JSON с данными', () => {
    expect(repo(file('public/data/health_db.json', '{}'))).not.toHaveLength(0);
    expect(repo(file('src/medical_database_2024_2026.json', '{}'))).not.toHaveLength(0);
  });

  it('блокирует любой JSON в сборке', () => {
    expect(dist(file('data/db.json', '{}'))).not.toHaveLength(0);
  });

  it('пропускает корректно зашифрованный .enc', () => {
    const enc = Buffer.concat([Buffer.from(ENC_MAGIC, 'latin1'), Buffer.from([1, 2, 3, 250])]);
    expect(repo(file('public/data/db.enc', enc))).toEqual([]);
    expect(dist(file('data/db.enc', enc))).toEqual([]);
  });

  it('ловит открытый PDF, переименованный в .enc', () => {
    expect(repo(file('public/data/doc.enc', '%PDF-1.7 ...'))).not.toHaveLength(0);
  });

  it('в public/data/ допускает только .enc', () => {
    expect(repo(file('public/data/readme.md', 'x'))).not.toHaveLength(0);
  });
});

describe('guard: секреты и персональные данные', () => {
  it('блокирует .env, но не .env.example', () => {
    expect(repo(file('.env', 'GEMINI_API_KEY=abc'))).not.toHaveLength(0);
    expect(repo(file('.env.local', 'x'))).not.toHaveLength(0);
    expect(repo(file('.env.example', 'GEMINI_API_KEY='))).toEqual([]);
  });

  it('находит литовский персональный код в коде', () => {
    expect(repo(file('src/x.ts', `const id = "${FAKE_CODE}";`))).not.toHaveLength(0);
  });

  it('находит термины из локального списка без учёта регистра', () => {
    const terms = ['Ivanov Ivan', 'Testo g. 1-2'];
    expect(repo(file('src/a.tsx', 'Пациент: IVANOV IVAN'), terms)).not.toHaveLength(0);
    expect(repo(file('README.md', 'Обычный текст'), terms)).toEqual([]);
  });

  it('не сканирует package-lock.json на номера', () => {
    expect(repo(file('package-lock.json', `"x": "${FAKE_CODE}"`))).toEqual([]);
  });
});

describe('guard: допустимые файлы', () => {
  it.each([
    ['src/App.tsx', 'export default 1'],
    ['package.json', '{}'],
    ['tsconfig.app.json', '{}'],
    ['src/config/reference_ranges.json', '{}'],
    ['public/icons/icon-192.png', 'png'],
    ['public/data/.gitkeep', ''],
    ['.github/workflows/deploy.yml', 'name: x'],
  ])('пропускает %s', (p, c) => {
    expect(repo(file(p, c))).toEqual([]);
  });

  it('блокирует изображение вне папки иконок', () => {
    expect(repo(file('public/photo.png', 'png'))).not.toHaveLength(0);
  });

  it('блокирует слишком большой файл', () => {
    expect(repo(file('src/big.ts', 'x', 30 * 1024 * 1024))).not.toHaveLength(0);
  });
});

describe('parsePiiTerms', () => {
  it('игнорирует комментарии, пустые и короткие строки', () => {
    expect(parsePiiTerms('# комм\n\nabc\nIvanov\r\n  Testo g. 1  \n')).toEqual(['Ivanov', 'Testo g. 1']);
  });
});
