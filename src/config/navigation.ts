import {
  Activity,
  CalendarClock,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Stethoscope,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Показывать в нижней панели на телефоне (остальные — в меню «Ещё»). */
  primary: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Обзор', icon: LayoutDashboard, primary: true },
  { path: '/labs', label: 'Анализы', icon: FlaskConical, primary: true },
  { path: '/timeline', label: 'Хронология', icon: Activity, primary: true },
  { path: '/documents', label: 'Документы', icon: FileText, primary: true },
  { path: '/specialties', label: 'Направления', icon: Stethoscope, primary: false },
  { path: '/visit', label: 'Визит к врачу', icon: UserRound, primary: false },
  { path: '/plan', label: 'План', icon: CalendarClock, primary: false },
];
