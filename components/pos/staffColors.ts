import { Staff } from './types';

export const STAFF_COLOR_PALETTE = [
  { color: '#2a3520', colorLight: '#e8ede3' },
  { color: '#5B8A72', colorLight: '#e6f0eb' },
  { color: '#4A6FA5', colorLight: '#e8eef7' },
  { color: '#c9a55c', colorLight: '#f5eedc' },
  { color: '#8B6B8E', colorLight: '#f0e8f1' },
  { color: '#B85C4A', colorLight: '#f5e8e5' },
  { color: '#3D5A45', colorLight: '#e3ebe5' },
] as const;

/** Perfil de catálogo base cuando una especialista aún no tiene staffIds propios. */
export const STAFF_CATALOG_TEMPLATE_BY_ROLE: Record<string, string> = {
  'Perfil más completo': 'CA',
  'Comodín de uñas': 'DA',
  'Especialista 100% uñas': 'KE',
  'Uñas + mirada y cejas': 'DE',
  'Generalista en crecimiento': 'DI',
  Estética: 'VE',
};

export const getStaffColors = (staff: Pick<Staff, 'color' | 'colorLight'>) => ({
  accent: staff.color,
  background: staff.colorLight,
});

export const getStaffById = (staffList: Staff[], staffId: string) =>
  staffList.find((member) => member.id === staffId);
