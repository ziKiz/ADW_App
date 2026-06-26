export interface AppUser {
  id: number;
  username: string;
  email: string;
  role: string;
  full_name: string;
  department_name?: string;
  scope_department?: string;
}

const USER_STORAGE_KEY = 'adw_user';
const LOGGED_OUT_STORAGE_KEY = 'adw_logged_out';

export const DEMO_ADMIN_USER: AppUser = {
  id: 21,
  username: 'demo.admin',
  email: 'demo.admin@example.local',
  role: 'admin',
  full_name: 'Demo Admin',
  department_name: 'Mechanizace',
  scope_department: 'Mechanizace'
};

export const DEMO_TRACTOR_OPERATOR_USER: AppUser = {
  id: 5,
  username: 'demo.traktorista',
  email: 'demo.traktorista@example.local',
  role: 'traktorista',
  full_name: 'Demo Traktorista',
  department_name: 'Rostlinná výroba',
  scope_department: 'Rostlinná výroba'
};

export const DEMO_SECOND_OPERATOR_USER: AppUser = {
  id: 16,
  username: 'demo.pracovnik',
  email: 'demo.pracovnik@example.local',
  role: 'traktorista',
  full_name: 'Demo Pracovník 12',
  department_name: 'Rostlinná výroba',
  scope_department: 'Rostlinná výroba'
};

export const DEMO_AGRONOM_USER: AppUser = {
  id: 3,
  username: 'demo.agronom',
  email: 'demo.agronom@example.local',
  role: 'schvalovatel',
  full_name: 'Ing. Demo Agronom',
  department_name: 'Rostlinná výroba',
  scope_department: 'Rostlinná výroba'
};

export const AVAILABLE_DEMO_USERS = [DEMO_ADMIN_USER, DEMO_TRACTOR_OPERATOR_USER, DEMO_SECOND_OPERATOR_USER, DEMO_AGRONOM_USER];

export function saveUser(user: AppUser) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  localStorage.removeItem(LOGGED_OUT_STORAGE_KEY);
}

export function getUser(): AppUser | null {
  const saved = localStorage.getItem(USER_STORAGE_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved) as AppUser;
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
  if (localStorage.getItem(LOGGED_OUT_STORAGE_KEY) === '1') return null;
  saveUser(DEMO_ADMIN_USER);
  return DEMO_ADMIN_USER;
}

export function isLoggedOut() {
  return localStorage.getItem(LOGGED_OUT_STORAGE_KEY) === '1';
}
