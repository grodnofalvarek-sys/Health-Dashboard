import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, HeartPulse, KeyRound, Lock, RefreshCw, ShieldCheck } from 'lucide-react';
import { useHealthData } from '../context/HealthDataContext';

export default function LockScreen() {
  const { status, errorMessage, unlockWithPassword } = useHealthData();
  const [password, setPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (status === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-950 px-4 text-slate-100">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid size-14 animate-pulse place-items-center rounded-2xl bg-red-500/15 text-red-400">
            <HeartPulse size={28} />
          </div>
          <div className="text-sm font-medium text-slate-300">Проверка ключа устройства и загрузка контейнера…</div>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLocalError(null);
    setSubmitting(true);
    try {
      await unlockWithPassword(password, rememberDevice);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Ошибка расшифровки');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-slate-950 px-4 py-8 text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur sm:p-8">
        <div className="flex items-center gap-3">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-red-500/15 text-red-400">
            <HeartPulse size={26} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Здоровье</h1>
            <p className="text-xs text-slate-400">Защищённый персональный медицинский дашборд</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-3.5 text-xs leading-relaxed text-emerald-300">
          <div className="flex items-center gap-2 font-semibold text-emerald-200">
            <ShieldCheck size={16} className="shrink-0" />
            Сквозное шифрование AES-256-GCM
          </div>
          <p className="mt-1 text-emerald-300/85">
            В репозитории GitHub хранятся только зашифрованные контейнеры (<code>HDENC1</code>). Расшифровка
            выполняется локально в памяти вашего браузера через WebCrypto API (PBKDF2-SHA256, 600 000 итераций).
          </p>
        </div>

        {status === 'error' && errorMessage && (
          <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="hd-password" className="mb-1.5 block text-xs font-medium text-slate-300">
              Мастер-пароль для расшифровки базы
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <KeyRound size={17} />
              </span>
              <input
                id="hd-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль…"
                autoFocus
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pr-11 pl-10 text-sm text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-300 select-none">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              className="mt-0.5 size-4 rounded border-slate-700 bg-slate-950 text-red-500 focus:ring-0"
            />
            <span>
              <strong className="font-medium text-slate-200">Запомнить это устройство</strong>
              <span className="block text-slate-400">
                Сохранить неизвлекаемый ключ <code>CryptoKey</code> в защищённом хранилище IndexedDB браузера
              </span>
            </span>
          </label>

          {localError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs font-medium text-red-300">
              {localError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !password.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <>
                <RefreshCw size={17} className="animate-spin" />
                Расшифровка контейнера (PBKDF2)…
              </>
            ) : (
              <>
                <Lock size={17} />
                Разблокировать дашборд
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
