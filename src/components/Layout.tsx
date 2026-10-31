import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { HeartPulse, Menu, Moon, Sun, X } from 'lucide-react';
import { NAV_ITEMS } from '../config/navigation';
import { useTheme } from '../hooks/useTheme';

const linkBase =
  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors min-h-11';
const linkIdle = 'text-slate-600 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:bg-slate-800/70';
const linkActive = 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900';

/**
 * Адаптивная оболочка:
 *  - телефон: верхняя строка + нижняя панель вкладок + лист «Ещё»;
 *  - планшет/ПК (lg+): боковое меню.
 */
export default function Layout({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const current = NAV_ITEMS.find((i) => i.path === location.pathname);
  const secondaryActive = NAV_ITEMS.some((i) => !i.primary && i.path === location.pathname);

  const ThemeIcon = theme === 'dark' ? Sun : Moon;

  return (
    <div className="flex min-h-dvh">
      {/* ── Боковое меню (lg+) ── */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-slate-200 bg-white/70 p-4 backdrop-blur lg:flex dark:border-slate-800 dark:bg-slate-900/60">
        <Brand />
        <nav className="mt-6 flex flex-1 flex-col gap-1">
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
        <button type="button" onClick={toggle} className={`${linkBase} ${linkIdle}`}>
          <ThemeIcon size={18} />
          {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ── Верхняя строка (телефон) ── */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-slate-50/85 px-4 py-3 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-950/85">
          <Brand compact />
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{current?.label}</span>
          <button
            type="button"
            onClick={toggle}
            aria-label="Переключить тему"
            className="grid size-11 place-items-center rounded-xl text-slate-600 dark:text-slate-300"
          >
            <ThemeIcon size={20} />
          </button>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-4 pb-28 lg:px-8 lg:pt-8 lg:pb-8">{children}</main>
      </div>

      {/* ── Нижняя панель вкладок (телефон/планшет в портрете) ── */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/90 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/90">
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
              <Icon size={22} />
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
            {moreOpen ? <X size={22} /> : <Menu size={22} />}
            Ещё
          </button>
        </div>
      </nav>

      {/* ── Лист «Ещё» ── */}
      {moreOpen && (
        <div className="fixed inset-0 z-20 lg:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-slate-950/40" />
          <div
            className="absolute inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] rounded-t-2xl border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
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
          </div>
        </div>
      )}
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-9 place-items-center rounded-xl bg-cardio/15 text-cardio">
        <HeartPulse size={20} />
      </span>
      {!compact && (
        <div className="leading-tight">
          <div className="font-semibold">Здоровье</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">медицинский дашборд</div>
        </div>
      )}
    </div>
  );
}
