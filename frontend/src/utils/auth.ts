export interface AppUser {
  id: number;
  username: string;
  email: string;
  role: string;
  full_name: string;
}

const USER_STORAGE_KEY = 'adw_user';
const LOGGED_OUT_STORAGE_KEY = 'adw_logged_out';
export const DEMO_ADMIN_USER: AppUser = {
  id: 21,
  username: 'martina.novotna',
  email: 'martina.novotna@lesonice.local',
  role: 'admin',
  full_name: 'Ing. Martina Novotná'
};

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
