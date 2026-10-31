// Шифрование и расшифровка пакетов данных AES-256-GCM + PBKDF2-SHA256 (WebCrypto).
// Формат файла .enc:
//   [0..5]   6 байт: сигнатура ASCII "HDENC1"
//   [6..9]   4 байта (uint32 BE): число итераций PBKDF2 (по умолчанию 600 000)
//   [10..25] 16 байт: соль PBKDF2 (общая для одного пакета публикации)
//   [26..37] 12 байт: уникальный случайный вектор инициализации (IV) для каждого файла
//   [38..]   шифротекст AES-256-GCM + 16-байтовый тег аутентификации
import { webcrypto } from 'node:crypto';
import { ENC_MAGIC } from '../scripts/guard/rules.mjs';

const subtle = webcrypto.subtle;
export const DEFAULT_ITERATIONS = 600_000;
export const HEADER_LENGTH = 6 + 4 + 16 + 12; // 38 байт

/**
 * Генерирует криптостойкую 16-байтовую соль.
 */
export function generateSalt() {
  return webcrypto.getRandomValues(new Uint8Array(16));
}

/**
 * Выводит ключ AES-256-GCM из пароля и соли через PBKDF2-SHA256.
 * @param {string} password
 * @param {Uint8Array} salt
 * @param {number} [iterations]
 */
export async function deriveAesKey(password, salt, iterations = DEFAULT_ITERATIONS) {
  const enc = new TextEncoder();
  const baseKey = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Шифрует произвольный буфер готовым ключом AES-GCM и упаковывает в формат HDENC1.
 * @param {Uint8Array} plainBytes
 * @param {CryptoKey} aesKey
 * @param {Uint8Array} salt 16 байт
 * @param {number} [iterations]
 * @returns {Promise<Buffer>}
 */
export async function encryptBytesWithKey(plainBytes, aesKey, salt, iterations = DEFAULT_ITERATIONS) {
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plainBytes);
  const cipherBytes = new Uint8Array(cipherBuf);

  const out = Buffer.alloc(HEADER_LENGTH + cipherBytes.byteLength);
  out.write(ENC_MAGIC, 0, 'latin1');
  out.writeUInt32BE(iterations, 6);
  Buffer.from(salt).copy(out, 10);
  Buffer.from(iv).copy(out, 26);
  Buffer.from(cipherBytes).copy(out, 38);
  return out;
}

/**
 * Разбирает заголовок файла HDENC1.
 * @param {Uint8Array} encBytes
 */
export function parseEncHeader(encBytes) {
  if (encBytes.byteLength < HEADER_LENGTH + 16) {
    throw new Error('Повреждённый зашифрованный файл (слишком короткий)');
  }
  const magic = Buffer.from(encBytes.subarray(0, 6)).toString('latin1');
  if (magic !== ENC_MAGIC) {
    throw new Error('Неверная сигнатура зашифрованного файла');
  }
  const view = new DataView(encBytes.buffer, encBytes.byteOffset, encBytes.byteLength);
  const iterations = view.getUint32(6, false);
  const salt = encBytes.slice(10, 26);
  const iv = encBytes.slice(26, 38);
  const ciphertext = encBytes.slice(38);
  return { iterations, salt, iv, ciphertext };
}

/**
 * Расшифровывает буфер HDENC1 паролем (или готовым ключом).
 * @param {Uint8Array} encBytes
 * @param {string | CryptoKey} passwordOrKey
 * @returns {Promise<Uint8Array>}
 */
export async function decryptBytes(encBytes, passwordOrKey) {
  const { iterations, salt, iv, ciphertext } = parseEncHeader(encBytes);
  const key =
    typeof passwordOrKey === 'string'
      ? await deriveAesKey(passwordOrKey, salt, iterations)
      : passwordOrKey;
  const plainBuf = await subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new Uint8Array(plainBuf);
}
