import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FolderSync,
  History,
  RefreshCw,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { useHealthData } from '../context/HealthDataContext';
import { SPECIALTIES, formatRuDate } from '../config/specialties';
import type { PendingRenameItem } from '../model/types';

interface BackupInfo {
  name: string;
  sizeBytes: number;
  mtime: string;
}

interface RenameLogItem {
  timestamp: string;
  fromFolder: string;
  fromName: string;
  toFolder: string;
  toName: string;
}

export default function LocalPipelineModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { db, rescanLocalWorkspace, confirmLocalRename, undoLocalRename } = useHealthData();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [renameHistory, setRenameHistory] = useState<RenameLogItem[]>([]);
  const [editedNames, setEditedNames] = useState<Record<string, { folder: string; name: string }>>({});

  async function loadBackups() {
    try {
      const res = await fetch('/__local/backups');
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups ?? []);
        setRenameHistory(data.renameHistory ?? []);
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (open) {
      setMessage(null);
      setError(null);
      loadBackups();
    }
  }, [open]);

  if (!open || !db) return null;

  const pending = db.pipelineReport.pendingRenames;
  const discrepancies = db.pipelineReport.dateDiscrepancies;

  async function handleRescan() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await rescanLocalWorkspace();
      await loadBackups();
      setMessage('Папки 01..06 пересканированы, база health_db.json обновлена.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка пересканирования');
    } finally {
      setBusy(false);
    }
  }

  async function handleApplyRename(item: PendingRenameItem) {
    const custom = editedNames[item.id];
    const newFolder = custom?.folder ?? item.proposedFolder;
    const newName = custom?.name ?? item.proposedName;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await confirmLocalRename({
        currentFolder: item.currentFolder,
        currentName: item.currentName,
        newFolder,
        newName,
      });
      await loadBackups();
      setMessage(`Переименовано: ${item.currentName} → ${newName}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка переименования');
    } finally {
      setBusy(false);
    }
  }

  async function handleUndoRename() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await undoLocalRename();
      await loadBackups();
      setMessage('Последнее переименование успешно отменено.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка отката');
    } finally {
      setBusy(false);
    }
  }

  async function handleRestoreBackup(name: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/__local/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Не удалось восстановить резервную копию');
      await rescanLocalWorkspace();
      setMessage(`Восстановлена резервная копия ${name}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка восстановления');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-emerald-500/15 text-emerald-500">
              <FolderSync size={19} />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Конвейер документов и обновление базы (ПК)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Сканирование папок 01..06, автопереименование и контроль целостности дат
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Сводка */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="space-y-0.5 text-xs">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                Всего документов в базе: {db.pipelineReport.totalDocuments} (унифицировано:{' '}
                {db.pipelineReport.standardNamedCount})
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                Лабораторных точек: {db.labResults.length} • Событий: {db.clinicalEvents.length} • Сборка:{' '}
                {new Date(db.generatedAt).toLocaleString('ru-RU')}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {renameHistory.length > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleUndoRename}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <RotateCcw size={14} />
                  Откатить переименование
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={handleRescan}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900"
              >
                <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
                Пересканировать папки
              </button>
            </div>
          </div>

          {message && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              {message}
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs font-medium text-red-600 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Новые / непереименованные файлы */}
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
              <Sparkles size={14} className="text-amber-500" />
              Предложения по унификации имён ({pending.length})
            </h3>
            {pending.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 size={16} className="shrink-0" />
                Все {db.pipelineReport.totalDocuments} файлов имеют унифицированные русские названия формата
                «ГГГГ-ММ-ДД_Тип_Детали_Клиника.расш».
              </div>
            ) : (
              <div className="space-y-3">
                {pending.map((item) => {
                  const currentVal = editedNames[item.id] ?? {
                    folder: item.proposedFolder,
                    name: item.proposedName,
                  };
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 text-xs space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          Текущий файл: <code>{item.currentFolder}/{item.currentName}</code>
                        </span>
                        <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-300">
                          Точность: {item.confidence}
                        </span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <select
                          value={currentVal.folder}
                          onChange={(e) =>
                            setEditedNames((prev) => ({
                              ...prev,
                              [item.id]: { ...currentVal, folder: e.target.value },
                            }))
                          }
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                        >
                          {SPECIALTIES.map((s) => (
                            <option key={s.folder} value={s.folder}>
                              {s.folder}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={currentVal.name}
                          onChange={(e) =>
                            setEditedNames((prev) => ({
                              ...prev,
                              [item.id]: { ...currentVal, name: e.target.value },
                            }))
                          }
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs sm:col-span-2 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleApplyRename(item)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                        >
                          Подтвердить и переименовать
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Сверка дат забора биоматериала и выгрузки бланка */}
          {discrepancies.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                <AlertTriangle size={14} className="text-amber-500" />
                Примечания по датам забора и выгрузки бланков ({discrepancies.length})
              </h3>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 text-xs dark:border-slate-800 dark:divide-slate-800">
                {discrepancies.map((d, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{d.analyte}</span>: дата
                      анализа {formatRuDate(d.recordDate)}, бланк от {formatRuDate(d.documentDate)}
                    </div>
                    <span className="shrink-0 text-slate-400">разница {d.diffDays} дн.</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Резервные копии базы */}
          {backups.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                <History size={14} />
                Резервные копии health_db.json ({backups.length})
              </h3>
              <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 text-xs dark:border-slate-800 dark:divide-slate-800">
                {backups.slice(0, 8).map((b) => (
                  <div key={b.name} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="font-mono text-slate-700 dark:text-slate-300">{b.name}</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleRestoreBackup(b.name)}
                      className="rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      Восстановить
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
