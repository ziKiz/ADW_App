export interface AppUser {
  id: number;
  username: string;
  email: string;
  role: string;
  full_name: string;
  department_name?: string;
  scope_department?: string;
  manager_username?: string;
  manager_name?: string;
  access_token?: string;
  token_type?: string;
}

const USER_STORAGE_KEY = 'adw_user';
const LOGGED_OUT_STORAGE_KEY = 'adw_logged_out';
const PROFILE_MODE_STORAGE_KEY = 'adw_profile_mode';
const IS_LIVE_MODE = import.meta.env.VITE_APP_MODE === 'live';
export type ProfileMode = 'admin' | 'work';

export const DEMO_ADMIN_USER: AppUser = {
  id: 21,
  username: 'martina.novotna',
  email: 'martina.novotna@lesonice.local',
  role: 'admin',
  full_name: 'Ing. Martina Novotná',
  department_name: 'Mechanizace',
  scope_department: 'Mechanizace'
};

export const DEMO_TRACTOR_OPERATOR_USER: AppUser = {
  id: 5,
  username: 'jan.novak',
  email: 'jan.novak@lesonice.local',
  role: 'traktorista',
  full_name: 'Jan Novák',
  department_name: 'Rostlinná výroba',
  scope_department: 'Rostlinná výroba'
};

export const DEMO_LEOS_SKUCIUS_USER: AppUser = {
  id: 16,
  username: 'leos.skucius',
  email: 'leos.skucius@lesonice.local',
  role: 'traktorista',
  full_name: 'Leoš Skucius',
  department_name: 'Rostlinná výroba',
  scope_department: 'Rostlinná výroba'
};

export const DEMO_AGRONOM_USER: AppUser = {
  id: 3,
  username: 'filip.danhel',
  email: 'filip.danhel@lesonice.local',
  role: 'schvalovatel',
  full_name: 'Ing. Filip Daňhel',
  department_name: 'Rostlinná výroba',
  scope_department: 'Rostlinná výroba'
};

export const AVAILABLE_DEMO_USERS = [DEMO_ADMIN_USER, DEMO_TRACTOR_OPERATOR_USER, DEMO_LEOS_SKUCIUS_USER, DEMO_AGRONOM_USER];

export function isMartinaUser(user: AppUser | null | undefined) {
  return user?.username === 'martina.novotna' || user?.full_name === 'Ing. Martina Novotná';
}

export function canSwitchProfile(user: AppUser | null | undefined) {
  return user?.username === 'martina.novotna' || user?.username === 'tomas.zika';
}

export function getProfileMode(): ProfileMode {
  const saved = localStorage.getItem(PROFILE_MODE_STORAGE_KEY);
  return saved === 'work' ? 'work' : 'admin';
}

export function setProfileMode(mode: ProfileMode) {
  localStorage.setItem(PROFILE_MODE_STORAGE_KEY, mode);
}

function applyProfileMode(user: AppUser) {
  if (!canSwitchProfile(user) || getProfileMode() !== 'work') return user;
  if (user.username === 'tomas.zika') {
    return {
      ...user,
      role: 'traktorista',
      department_name: user.department_name || 'Kontrola',
      scope_department: user.scope_department || user.department_name || 'Kontrola'
    };
  }
  return {
    ...user,
    role: 'schvalovatel',
    department_name: user.department_name || 'Mechanizace',
    scope_department: user.scope_department || user.department_name || 'Mechanizace'
  };
}

export function saveUser(user: AppUser) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  localStorage.removeItem(LOGGED_OUT_STORAGE_KEY);
}

export function getUser(): AppUser | null {
  const saved = localStorage.getItem(USER_STORAGE_KEY);
  if (!saved) return null;
  try {
    return applyProfileMode(JSON.parse(saved) as AppUser);
  } catch {
    return null;
  }
}

export function clearUser() {
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.setItem(LOGGED_OUT_STORAGE_KEY, '1');
}

export function getOrCreateDemoUser(): AppUser | null {
  const user = getUser();
  if (user && user.full_name !== 'Admin') return user;
  if (IS_LIVE_MODE) return null;
  if (localStorage.getItem(LOGGED_OUT_STORAGE_KEY) === '1') return null;
  saveUser(DEMO_ADMIN_USER);
  return DEMO_ADMIN_USER;
}

export function isLoggedOut() {
  return localStorage.getItem(LOGGED_OUT_STORAGE_KEY) === '1';
}
