import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  clearDeviceCryptoKey,
  decryptWithKey,
  deriveBrowserAesKey,
  loadDeviceCryptoKey,
  parseEncHeader,
  saveDeviceCryptoKey,
} from '../lib/crypto';
import type { HealthDatabase, MedicalDocument } from '../model/types';

interface HealthDataContextValue {
  db: HealthDatabase | null;
  status: 'loading' | 'locked' | 'unlocked' | 'error';
  errorMessage: string | null;
  isLocalServer: boolean;
  unlockWithPassword: (password: string, rememberDevice: boolean) => Promise<void>;
  lockAndForgetDevice: () => Promise<void>;
  lockSessionOnly: () => void;
  getDocumentBlobUrl: (doc: MedicalDocument) => Promise<string>;
  rescanLocalWorkspace: () => Promise<void>;
  confirmLocalRename: (args: {
    currentFolder: string;
    currentName: string;
    newFolder: string;
    newName: string;
  }) => Promise<void>;
  undoLocalRename: () => Promise<void>;
  activeViewerDoc: MedicalDocument | null;
  openDocumentViewer: (doc: MedicalDocument | string) => void;
  closeDocumentViewer: () => void;
}

const HealthDataContext = createContext<HealthDataContextValue | null>(null);

export function HealthDataProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<HealthDatabase | null>(null);
  const [status, setStatus] = useState<'loading' | 'locked' | 'unlocked' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLocalServer, setIsLocalServer] = useState(false);
  const [activeViewerDoc, setActiveViewerDoc] = useState<MedicalDocument | null>(null);

  const encDbBytesRef = useRef<Uint8Array | null>(null);
  const cryptoKeyRef = useRef<CryptoKey | null>(null);
  const blobUrlCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      // 1. Сначала пробуем загрузить зашифрованный пакет data/db.enc (боевой режим для смартфонов/планшетов/ПК)
      try {
        const encUrl = `${import.meta.env.BASE_URL}data/db.enc`;
        const encRes = await fetch(encUrl, { cache: 'no-cache' });
        if (encRes.ok) {
          const buf = new Uint8Array(await encRes.arrayBuffer());
          if (buf.byteLength > 54 && String.fromCharCode(...buf.subarray(0, 6)) === 'HDENC1') {
            encDbBytesRef.current = buf;
            const header = parseEncHeader(buf);
            const savedKey = await loadDeviceCryptoKey(header.salt);
            if (savedKey) {
              try {
                const plain = await decryptWithKey(buf, savedKey);
                const parsed = JSON.parse(new TextDecoder().decode(plain)) as HealthDatabase;
                if (!cancelled) {
                  cryptoKeyRef.current = savedKey;
                  setDb(parsed);
                  setStatus('unlocked');
                }
                // Проверим также доступность локального конвейера на ПК
                fetch('/__local/db')
                  .then((r) => {
                    if (r.ok && !cancelled) setIsLocalServer(true);
                  })
                  .catch(() => {});
                return;
              } catch {
                await clearDeviceCryptoKey();
              }
            }
          }
        }
      } catch {
        /* data/db.enc не найден — проверим локальный сервер разработчика */
      }

      // 2. Если запущен локальный конвейер на ПК (update.bat / npm run dev)
      try {
        const localRes = await fetch('/__local/db');
        if (localRes.ok) {
          const ct = localRes.headers.get('content-type') ?? '';
          if (ct.includes('application/json')) {
            const localDb = (await localRes.json()) as HealthDatabase;
            if (!cancelled) {
              setIsLocalServer(true);
              // Если при этом есть зашифрованный пакет и включён принудительный экран пароля
              if (sessionStorage.getItem('hd_force_lock') === '1' && encDbBytesRef.current) {
                setStatus('locked');
              } else {
                setDb(localDb);
                setStatus('unlocked');
              }
            }
            return;
          }
        }
      } catch {
        /* не локальный сервер */
      }

      if (!cancelled) {
        if (encDbBytesRef.current) {
          setStatus('locked');
        } else {
          setErrorMessage(
            'Зашифрованный пакет данных (data/db.enc) ещё не создан. Запустите publish.bat на ПК или откройте локальный сервер update.bat.',
          );
          setStatus('error');
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const unlockWithPassword = useCallback(async (password: string, rememberDevice: boolean) => {
    setErrorMessage(null);
    let encBytes = encDbBytesRef.current;
    if (!encBytes) {
      const encUrl = `${import.meta.env.BASE_URL}data/db.enc`;
      const res = await fetch(encUrl, { cache: 'no-cache' });
      if (!res.ok) {
        throw new Error('Зашифрованный файл data/db.enc не найден');
      }
      encBytes = new Uint8Array(await res.arrayBuffer());
      encDbBytesRef.current = encBytes;
    }

    const header = parseEncHeader(encBytes);
    const key = await deriveBrowserAesKey(password, header.salt, header.iterations);
    let plainBytes: Uint8Array;
    try {
      plainBytes = await decryptWithKey(encBytes, key);
    } catch {
      throw new Error('Неверный пароль — расшифровка отклонена (AES-256-GCM)');
    }

    const parsed = JSON.parse(new TextDecoder().decode(plainBytes)) as HealthDatabase;
    cryptoKeyRef.current = key;
    sessionStorage.removeItem('hd_force_lock');

    if (rememberDevice) {
      await saveDeviceCryptoKey(key, header.salt);
    } else {
      await clearDeviceCryptoKey();
    }

    setDb(parsed);
    setStatus('unlocked');
  }, []);

  const lockAndForgetDevice = useCallback(async () => {
    await clearDeviceCryptoKey();
    cryptoKeyRef.current = null;
    for (const url of blobUrlCacheRef.current.values()) {
      URL.revokeObjectURL(url);
    }
    blobUrlCacheRef.current.clear();
    sessionStorage.setItem('hd_force_lock', '1');
    setActiveViewerDoc(null);
    setDb(null);
    setStatus('locked');
  }, []);

  const lockSessionOnly = useCallback(() => {
    cryptoKeyRef.current = null;
    sessionStorage.setItem('hd_force_lock', '1');
    setActiveViewerDoc(null);
    setDb(null);
    setStatus('locked');
  }, []);

  const getDocumentBlobUrl = useCallback(
    async (doc: MedicalDocument): Promise<string> => {
      const cached = blobUrlCacheRef.current.get(doc.id);
      if (cached) return cached;

      const mime =
        doc.fileType === 'pdf'
          ? 'application/pdf'
          : doc.fileType === 'jpg' || doc.fileType === 'jpeg'
            ? 'image/jpeg'
            : 'application/octet-stream';

      // 1. Если есть ключ расшифровки и опубликован data/<doc.id>.enc — расшифровываем в браузере
      if (cryptoKeyRef.current) {
        try {
          const encDocUrl = `${import.meta.env.BASE_URL}data/${doc.id}.enc`;
          const res = await fetch(encDocUrl);
          if (res.ok) {
            const encBytes = new Uint8Array(await res.arrayBuffer());
            if (encBytes.byteLength > 54 && String.fromCharCode(...encBytes.subarray(0, 6)) === 'HDENC1') {
              const plain = await decryptWithKey(encBytes, cryptoKeyRef.current);
              const blob = new Blob([plain as unknown as BlobPart], { type: mime });
              const url = URL.createObjectURL(blob);
              blobUrlCacheRef.current.set(doc.id, url);
              return url;
            }
          }
        } catch {
          /* fallback к локальному серверу ниже */
        }
      }

      // 2. На ПК в режиме локального сервера — читаем напрямую из папок 01..06
      if (isLocalServer) {
        const localUrl = `/__local/doc?path=${encodeURIComponent(doc.path)}`;
        const res = await fetch(localUrl);
        if (res.ok) {
          const blob = new Blob([await res.arrayBuffer()], { type: mime });
          const url = URL.createObjectURL(blob);
          blobUrlCacheRef.current.set(doc.id, url);
          return url;
        }
      }

      throw new Error(
        'Файл документа недоступен: выполните publish.bat (шифрование документов) или откройте дашборд через update.bat на ПК.',
      );
    },
    [isLocalServer],
  );

  const rescanLocalWorkspace = useCallback(async () => {
    const res = await fetch('/__local/rescan', { method: 'POST' });
    if (!res.ok) throw new Error('Не удалось пересканировать папки');
    const updated = (await res.json()) as HealthDatabase;
    setDb(updated);
  }, []);

  const confirmLocalRename = useCallback(
    async (args: {
      currentFolder: string;
      currentName: string;
      newFolder: string;
      newName: string;
    }) => {
      const res = await fetch('/__local/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Ошибка переименования');
      setDb(body as HealthDatabase);
    },
    [],
  );

  const undoLocalRename = useCallback(async () => {
    const res = await fetch('/__local/undo-rename', { method: 'POST' });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? 'Ошибка отката');
    setDb(body as HealthDatabase);
  }, []);

  const openDocumentViewer = useCallback(
    (docOrPath: MedicalDocument | string) => {
      if (typeof docOrPath !== 'string') {
        setActiveViewerDoc(docOrPath);
        return;
      }
      const found = db?.documents.find(
        (d) => d.id === docOrPath || d.path === docOrPath || d.fileName === docOrPath,
      );
      if (found) setActiveViewerDoc(found);
    },
    [db],
  );

  const closeDocumentViewer = useCallback(() => setActiveViewerDoc(null), []);

  return (
    <HealthDataContext.Provider
      value={{
        db,
        status,
        errorMessage,
        isLocalServer,
        unlockWithPassword,
        lockAndForgetDevice,
        lockSessionOnly,
        getDocumentBlobUrl,
        rescanLocalWorkspace,
        confirmLocalRename,
        undoLocalRename,
        activeViewerDoc,
        openDocumentViewer,
        closeDocumentViewer,
      }}
    >
      {children}
    </HealthDataContext.Provider>
  );
}

export function useHealthData(): HealthDataContextValue {
  const ctx = useContext(HealthDataContext);
  if (!ctx) {
    throw new Error('useHealthData должен вызываться внутри HealthDataProvider');
  }
  return ctx;
}
