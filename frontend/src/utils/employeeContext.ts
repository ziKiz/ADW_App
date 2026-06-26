import { AppUser } from './auth';

export const serviceCenters = ['Rostlinná výroba', 'Živočišná výroba', 'Mechanizace', 'BPS', 'Stavební skupina', 'Mini mlékárna'];

export const vacationBalance = {
  daysRemaining: 20,
  validTo: '2026-06-26'
};

export const appDataValidity = '2026-06-26';

export function normalizeServiceCenter(value?: string) {
  if (value === 'Bioplynová stanice') return 'BPS';
  if (value === 'Mini Mlékárna') return 'Mini mlékárna';
  return String(value ?? '').trim();
}

export function getUserServiceCenter(user: AppUser | null) {
  const center = normalizeServiceCenter(user?.department_name || user?.scope_department);
  return serviceCenters.includes(center) ? center : serviceCenters[0];
}
