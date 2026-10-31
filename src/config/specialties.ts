/** Направления медицины = папки с документами. Цвет — сквозная кодировка в интерфейсе. */
export interface Specialty {
  id: 'cardio' | 'uro' | 'gastro' | 'ortho' | 'lab' | 'prev';
  folder: string;
  label: string;
  color: string;
}

export const SPECIALTIES: Specialty[] = [
  { id: 'cardio', folder: '01_Кардиология_и_Сосуды', label: 'Кардиология и сосуды', color: 'var(--color-cardio)' },
  { id: 'uro', folder: '02_Урология', label: 'Урология', color: 'var(--color-uro)' },
  { id: 'gastro', folder: '03_Гастроэнтерология_и_УЗИ_БП', label: 'Гастроэнтерология', color: 'var(--color-gastro)' },
  { id: 'ortho', folder: '04_Ортопедия_и_Травматология', label: 'Ортопедия и травматология', color: 'var(--color-ortho)' },
  { id: 'lab', folder: '05_Лабораторные_анализы', label: 'Лабораторные анализы', color: 'var(--color-lab)' },
  { id: 'prev', folder: '06_Профилактика_Реабилитация_Разное', label: 'Профилактика и разное', color: 'var(--color-prev)' },
];
