import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  FolderSync,
  HeartPulse,
  Lock,
  Menu,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react';
import { NAV_ITEMS } from '../config/navigation';
import { useTheme } from '../hooks/useTheme';
import { useHealthData } from '../context/HealthDataContext';
import DocumentViewerModal from './DocumentViewerModal';
import GlobalSearchModal from './GlobalSearchModal';
import LocalPipelineModal from './LocalPipelineModal';

const linkBase =
  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors min-h-11';
const linkIdle = 'text-slate-600 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:bg-slate-800/70';
const linkActive = 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900';

/**
 * Адаптивная оболочка:
 *  - телефон: верхняя строка + нижняя панель вкладок + лист «Ещё»;
 *  - планшет/ПК (lg+): боковое меню + глобальный поиск (Ctrl+K) + модальное окно документов.
 */
export default function Layout({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const { db, isLocalServer, lockAndForgetDevice } = useHealthData();
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);

  const location = useLocation();
  const current = NAV_ITEMS.find((i) => i.path === location.pathname);
  const secondaryActive = NAV_ITEMS.some((i) => !i.primary && i.path === location.pathname);
  const pendingRenamesCount = db?.pipelineReport.pendingRenames.length ?? 0;

  const ThemeIcon = theme === 'dark' ? Sun : Moon;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="flex min-h-dvh">
      {/* ── Боковое меню (lg+) ── */}
      <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-slate-200 bg-white/75 p-4 backdrop-blur lg:flex dark:border-slate-800 dark:bg-slate-900/65">
        <Brand />

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-100/80 px-3 py-2 text-xs text-slate-500 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400"
        >
          <span className="flex items-center gap-2">
            <Search size={15} />
            Поиск по базе…
          </span>
          <kbd className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-semibold dark:border-slate-700">
            Ctrl+K
          </kbd>
        </button>

        <nav className="mt-4 flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-1 border-t border-slate-200 pt-3 dark:border-slate-800">
          {isLocalServer && (
            <button
              type="button"
              onClick={() => setPipelineOpen(true)}
              className={`${linkBase} ${linkIdle} w-full justify-between`}
            >
              <span className="flex items-center gap-3">
                <FolderSync size={18} className="text-emerald-500" />
                Конвейер (ПК)
              </span>
              {pendingRenamesCount > 0 && (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">
                  {pendingRenamesCount}
                </span>
              )}
            </button>
          )}
          <button type="button" onClick={toggle} className={`${linkBase} ${linkIdle} w-full`}>
            <ThemeIcon size={18} />
            {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          </button>
          <button
            type="button"
            onClick={lockAndForgetDevice}
            className={`${linkBase} ${linkIdle} w-full text-xs`}
            title="Очистить сохранённый ключ устройства и закрыть базу"
          >
            <Lock size={17} />
            Заблокировать / Забыть ключ
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ── Верхняя строка (телефон) ── */}
        <header className="no-print sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-4 py-2.5 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-950/90">
          <Brand compact />
          <span className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
            {current?.label}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Поиск"
              className="grid size-10 place-items-center rounded-xl text-slate-600 dark:text-slate-300"
            >
              <Search size={19} />
            </button>
            <button
              type="button"
              onClick={toggle}
              aria-label="Переключить тему"
              className="grid size-10 place-items-center rounded-xl text-slate-600 dark:text-slate-300"
            >
              <ThemeIcon size={19} />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-4 pb-28 lg:px-8 lg:pt-7 lg:pb-10">
          {children}

          <footer className="no-print mt-10 border-t border-slate-200/80 pt-5 text-xs text-slate-400 dark:border-slate-800/80 dark:text-slate-500">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-500" />
                Информационно-справочная визуализация личного медицинского архива (2024–2026). Не является
                медицинским изделием; клинические решения принимаются лечащим врачом.
              </span>
              {db && <span>Документов: {db.documents.length}</span>}
            </div>
          </footer>
        </main>
      </div>

      {/* ── Нижняя панель вкладок (телефон/планшет в портрете) ── */}
      <nav className="no-print safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {NAV_ITEMS.filter((i) => i.primary).map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  isActive ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
                }`
              }
            >
              <Icon size={21} />
              {label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              moreOpen || secondaryActive ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {moreOpen ? <X size={21} /> : <Menu size={21} />}
            Ещё
          </button>
        </div>
      </nav>

      {/* ── Лист «Ещё» ── */}
      {moreOpen && (
        <div className="no-print fixed inset-0 z-20 lg:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-slate-950/40" />
          <div
            className="absolute inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] space-y-1 rounded-t-2xl border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            {NAV_ITEMS.filter((i) => !i.primary).map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
            {isLocalServer && (
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  setPipelineOpen(true);
                }}
                className={`${linkBase} ${linkIdle} w-full`}
              >
                <FolderSync size={18} className="text-emerald-500" />
                Конвейер документов (ПК)
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                lockAndForgetDevice();
              }}
              className={`${linkBase} ${linkIdle} w-full`}
            >
              <Lock size={18} />
              Заблокировать устройство
            </button>
          </div>
        </div>
      )}

      {/* Глобальные модальные окна */}
      <DocumentViewerModal />
      <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <LocalPipelineModal open={pipelineOpen} onClose={() => setPipelineOpen(false)} />
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-red-500/15 text-red-500">
        <HeartPulse size={20} />
      </span>
      {!compact && (
        <div className="leading-tight">
          <div className="font-bold tracking-tight">Здоровье</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">медицинский дашборд</div>
        </div>
      )}
    </div>
  );
}
