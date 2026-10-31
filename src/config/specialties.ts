import type { SpecialtyId } from '../model/types';

/** Направления медицины = папки с документами. Цвет — сквозная кодировка в интерфейсе. */
export interface Specialty {
  id: SpecialtyId;
  folder: string;
  label: string;
  shortLabel: string;
  color: string;
  hex: string;
  bgSoft: string;
  textClass: string;
}

export const SPECIALTIES: Specialty[] = [
  {
    id: 'cardio',
    folder: '01_Кардиология_и_Сосуды',
    label: 'Кардиология и сосуды',
    shortLabel: 'Кардиология',
    color: 'var(--color-cardio)',
    hex: '#ef4444',
    bgSoft: 'bg-red-500/12 text-red-600 dark:text-red-400 border-red-500/25',
    textClass: 'text-red-600 dark:text-red-400',
  },
  {
    id: 'uro',
    folder: '02_Урология',
    label: 'Урология',
    shortLabel: 'Урология',
    color: 'var(--color-uro)',
    hex: '#3b82f6',
    bgSoft: 'bg-blue-500/12 text-blue-600 dark:text-blue-400 border-blue-500/25',
    textClass: 'text-blue-600 dark:text-blue-400',
  },
  {
    id: 'gastro',
    folder: '03_Гастроэнтерология_и_УЗИ_БП',
    label: 'Гастроэнтерология',
    shortLabel: 'Гастро / УЗИ БП',
    color: 'var(--color-gastro)',
    hex: '#f59e0b',
    bgSoft: 'bg-amber-500/12 text-amber-600 dark:text-amber-400 border-amber-500/25',
    textClass: 'text-amber-600 dark:text-amber-400',
  },
  {
    id: 'ortho',
    folder: '04_Ортопедия_и_Травматология',
    label: 'Ортопедия и травматология',
    shortLabel: 'Ортопедия',
    color: 'var(--color-ortho)',
    hex: '#10b981',
    bgSoft: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
    textClass: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'lab',
    folder: '05_Лабораторные_анализы',
    label: 'Лабораторные анализы',
    shortLabel: 'Лаборатория',
    color: 'var(--color-lab)',
    hex: '#6366f1',
    bgSoft: 'bg-indigo-500/12 text-indigo-600 dark:text-indigo-400 border-indigo-500/25',
    textClass: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    id: 'prev',
    folder: '06_Профилактика_Реабилитация_Разное',
    label: 'Профилактика и разное',
    shortLabel: 'Профилактика',
    color: 'var(--color-prev)',
    hex: '#14b8a6',
    bgSoft: 'bg-teal-500/12 text-teal-600 dark:text-teal-400 border-teal-500/25',
    textClass: 'text-teal-600 dark:text-teal-400',
  },
];

const SPECIALTY_MAP: Record<SpecialtyId, Specialty> = Object.fromEntries(
  SPECIALTIES.map((s) => [s.id, s]),
) as Record<SpecialtyId, Specialty>;

export function getSpecialty(id: SpecialtyId): Specialty {
  return SPECIALTY_MAP[id] ?? SPECIALTIES[0];
}

export function formatRuDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return isoDate;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
}
