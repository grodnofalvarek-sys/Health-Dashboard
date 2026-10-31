import { describe, expect, it } from 'vitest';
import { checkFile } from '../scripts/guard/rules.mjs';
import {
  decryptBytes,
  deriveAesKey,
  encryptBytesWithKey,
  generateSalt,
  parseEncHeader,
} from './crypto-node.mjs';

describe('Stage 5: шифрование AES-256-GCM + PBKDF2-SHA256', () => {
  it('шифрует и расшифровывает данные с проверкой целостности', async () => {
    const salt = generateSalt();
    const key = await deriveAesKey('Correct-Horse-Battery-Staple-2026', salt, 10_000);
    const sample = new TextEncoder().encode(JSON.stringify({ ldl: 1.95, cac: 288 }));

    const encBuf = await encryptBytesWithKey(sample, key, salt, 10_000);

    // Проверяем, что guard пропускает этот .enc файл
    const guardIssues = checkFile(
      { path: 'public/data/db.enc', size: encBuf.length, read: () => encBuf },
      { mode: 'repo', piiTerms: [] },
    );
    expect(guardIssues).toEqual([]);

    const header = parseEncHeader(new Uint8Array(encBuf));
    expect(header.iterations).toBe(10_000);

    const decBytes = await decryptBytes(new Uint8Array(encBuf), 'Correct-Horse-Battery-Staple-2026');
    const decoded = JSON.parse(new TextDecoder().decode(decBytes));
    expect(decoded).toEqual({ ldl: 1.95, cac: 288 });
  });

  it('отклоняет неверный пароль', async () => {
    const salt = generateSalt();
    const key = await deriveAesKey('Right-Password-1234', salt, 5_000);
    const encBuf = await encryptBytesWithKey(new Uint8Array([1, 2, 3, 4]), key, salt, 5_000);

    await expect(decryptBytes(new Uint8Array(encBuf), 'Wrong-Password-9999')).rejects.toThrow();
  });

  it('отклоняет подмену байтов шифротекста (проверка тега аутентификации GCM)', async () => {
    const salt = generateSalt();
    const key = await deriveAesKey('Right-Password-1234', salt, 5_000);
    const encBuf = await encryptBytesWithKey(new Uint8Array([10, 20, 30, 40]), key, salt, 5_000);
    const tampered = new Uint8Array(encBuf);
    tampered[tampered.length - 1] ^= 0xff;

    await expect(decryptBytes(tampered, key)).rejects.toThrow();
  });
});
