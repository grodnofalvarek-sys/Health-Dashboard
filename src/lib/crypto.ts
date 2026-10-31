// Браузерный модуль расшифровки AES-256-GCM + PBKDF2-SHA256 и безопасного хранения
// неизвлекаемого ключа (CryptoKey extractable=false) в IndexedDB для функции «Запомнить это устройство».

const ENC_MAGIC = 'HDENC1';
const HEADER_LENGTH = 6 + 4 + 16 + 12; // 38 байт
const IDB_NAME = 'health_dashboard_keystore_v1';
const IDB_STORE = 'keys';
const IDB_KEY_ID = 'device_aes_key';

export interface ParsedEncPackage {
  iterations: number;
  salt: Uint8Array;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

export function parseEncHeader(bytes: Uint8Array): ParsedEncPackage {
  if (bytes.byteLength < HEADER_LENGTH + 16) {
    throw new Error('Зашифрованный файл повреждён или пуст');
  }
  const magic = String.fromCharCode(...bytes.subarray(0, 6));
  if (magic !== ENC_MAGIC) {
    throw new Error('Неверная сигнатура зашифрованного файла');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const iterations = view.getUint32(6, false);
  const salt = bytes.slice(10, 26);
  const iv = bytes.slice(26, 38);
  const ciphertext = bytes.slice(38);
  return { iterations, salt, iv, ciphertext };
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Выводит неизвлекаемый ключ AES-256-GCM из пароля и соли через PBKDF2-SHA256.
 */
export async function deriveBrowserAesKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, // extractable = false: ключ нельзя выгрузить в виде байтов из памяти браузера
    ['decrypt'],
  );
}

/**
 * Расшифровывает пакет HDENC1 готовым ключом CryptoKey.
 */
export async function decryptWithKey(bytes: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
  const { iv, ciphertext } = parseEncHeader(bytes);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    ciphertext as unknown as BufferSource,
  );
  return new Uint8Array(plain);
}

/* ── IndexedDB хранилище неизвлекаемого CryptoKey для «Запомнить это устройство» ── */

function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDeviceCryptoKey(key: CryptoKey, salt: Uint8Array): Promise<void> {
  try {
    const db = await openKeyDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put({ key, saltHex: toHex(salt), savedAt: Date.now() }, IDB_KEY_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* В приватном режиме Safari IndexedDB может быть недоступен — просто работаем в рамках сессии */
  }
}

export async function loadDeviceCryptoKey(expectedSalt: Uint8Array): Promise<CryptoKey | null> {
  try {
    const db = await openKeyDb();
    const record = await new Promise<{ key: CryptoKey; saltHex: string } | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(IDB_KEY_ID);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      },
    );
    db.close();
    if (!record || record.saltHex !== toHex(expectedSalt)) return null;
    return record.key;
  } catch {
    return null;
  }
}

export async function clearDeviceCryptoKey(): Promise<void> {
  try {
    const db = await openKeyDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(IDB_KEY_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* ignore */
  }
}
