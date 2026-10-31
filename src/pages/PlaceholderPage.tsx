import type { ReactNode } from 'react';
import { Construction } from 'lucide-react';

/** Временная страница-заглушка раздела (наполняется на следующих этапах). */
export default function PlaceholderPage({
  title,
  stage,
  children,
}: {
  title: string;
  stage: number;
  children?: ReactNode;
}) {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">{title}</h1>
      <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6 dark:border-slate-700 dark:bg-slate-900/40">
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          <Construction size={20} />
          <span className="text-sm">Раздел появится на этапе {stage}.</span>
        </div>
        {children && <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">{children}</div>}
      </div>
    </section>
  );
}
