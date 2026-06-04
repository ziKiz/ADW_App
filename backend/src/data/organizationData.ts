export interface DepartmentSeed {
  department_id: number;
  name: string;
  code: string;
  parent_department_id: number | null;
  description: string;
}

export interface EmployeeSeed {
  employee_id: number;
  full_name: string;
  title: string;
  home_department_id: number | null;
  home_department: string;
  position: string;
  manager_employee_id: number | null;
  manager_name: string;
  system_user: boolean;
}

export interface RoleSeed {
  role_id: number;
  role_code: string;
  role_name: string;
  description: string;
}

export interface PermissionSeed {
  permission_id: number;
  permission_code: string;
  description: string;
}

export interface UserRoleSeed {
  user_role_id: number;
  employee_id: number;
  role_id: number;
  role_code: string;
  scope_department_id: number | null;
  scope_department: string;
}

export const departments: DepartmentSeed[] = [
  { department_id: 1, name: 'Ředitelství', code: 'Reditelstvi', parent_department_id: null, description: 'Vedení společnosti' },
  { department_id: 2, name: 'Rostlinná výroba', code: 'RV', parent_department_id: 1, description: 'Středisko rostlinné výroby' },
  { department_id: 3, name: 'Živočišná výroba', code: 'ZV', parent_department_id: 1, description: 'Středisko živočišné výroby' },
  { department_id: 4, name: 'Mechanizace', code: 'MECH', parent_department_id: 1, description: 'Středisko mechanizace' },
  { department_id: 5, name: 'BPS', code: 'BPS', parent_department_id: 1, description: 'Bioplynová stanice' },
  { department_id: 6, name: 'Stavební skupina', code: 'STAV', parent_department_id: 1, description: 'Stavební skupina' },
  { department_id: 7, name: 'Mini mlékárna', code: 'MLEK', parent_department_id: 1, description: 'Mini mlékárna' }
];

export const employees: EmployeeSeed[] = [
  { employee_id: 1, full_name: 'Ing. Petr Kuba', title: 'Ing.', home_department_id: 1, home_department: 'Ředitelství', position: 'Ředitel společnosti', manager_employee_id: null, manager_name: '', system_user: true },
  { employee_id: 2, full_name: 'Ing. Zbyněk Pokorný', title: 'Ing.', home_department_id: 2, home_department: 'Rostlinná výroba', position: 'Hlavní vedoucí', manager_employee_id: 1, manager_name: 'Ing. Petr Kuba', system_user: true },
  { employee_id: 3, full_name: 'Filip Daňhel', title: '', home_department_id: 2, home_department: 'Rostlinná výroba', position: 'Agronom', manager_employee_id: 2, manager_name: 'Ing. Zbyněk Pokorný', system_user: true },
  { employee_id: 4, full_name: 'Pavel Dvořák', title: '', home_department_id: 2, home_department: 'Rostlinná výroba', position: 'Zaměstnanec RV', manager_employee_id: 2, manager_name: 'Ing. Zbyněk Pokorný', system_user: true },
  { employee_id: 5, full_name: 'Jan Novák', title: '', home_department_id: 2, home_department: 'Rostlinná výroba', position: 'Zaměstnanec RV', manager_employee_id: 2, manager_name: 'Ing. Zbyněk Pokorný', system_user: true },
  { employee_id: 6, full_name: 'Stanislav Šťáva', title: '', home_department_id: 2, home_department: 'Rostlinná výroba', position: 'Zaměstnanec RV', manager_employee_id: 2, manager_name: 'Ing. Zbyněk Pokorný', system_user: true },
  { employee_id: 7, full_name: 'Pavel Klíma', title: '', home_department_id: 2, home_department: 'Rostlinná výroba', position: 'Zaměstnanec RV', manager_employee_id: 2, manager_name: 'Ing. Zbyněk Pokorný', system_user: true },
  { employee_id: 8, full_name: 'David Pacas', title: '', home_department_id: 2, home_department: 'Rostlinná výroba', position: 'Zaměstnanec RV', manager_employee_id: 2, manager_name: 'Ing. Zbyněk Pokorný', system_user: true },
  { employee_id: 9, full_name: 'Lukáš Bauer', title: '', home_department_id: 2, home_department: 'Rostlinná výroba', position: 'Zaměstnanec RV', manager_employee_id: 2, manager_name: 'Ing. Zbyněk Pokorný', system_user: true },
  { employee_id: 10, full_name: 'Dušan Dvořák', title: '', home_department_id: 2, home_department: 'Rostlinná výroba', position: 'Zaměstnanec RV', manager_employee_id: 2, manager_name: 'Ing. Zbyněk Pokorný', system_user: true },
  { employee_id: 11, full_name: 'Bohuslav Kabelka', title: '', home_department_id: 2, home_department: 'Rostlinná výroba', position: 'Zaměstnanec RV', manager_employee_id: 2, manager_name: 'Ing. Zbyněk Pokorný', system_user: true },
  { employee_id: 12, full_name: 'Jiří Venhoda', title: '', home_department_id: 2, home_department: 'Rostlinná výroba', position: 'Zaměstnanec RV', manager_employee_id: 2, manager_name: 'Ing. Zbyněk Pokorný', system_user: true },
  { employee_id: 13, full_name: 'Petr Chvátal', title: '', home_department_id: 2, home_department: 'Rostlinná výroba', position: 'Zaměstnanec RV', manager_employee_id: 2, manager_name: 'Ing. Zbyněk Pokorný', system_user: true },
  { employee_id: 14, full_name: 'Rostislav Kabelka', title: '', home_department_id: 2, home_department: 'Rostlinná výroba', position: 'Zaměstnanec RV', manager_employee_id: 2, manager_name: 'Ing. Zbyněk Pokorný', system_user: true },
  { employee_id: 15, full_name: 'Stanislav Papula', title: '', home_department_id: 2, home_department: 'Rostlinná výroba', position: 'Zaměstnanec RV', manager_employee_id: 2, manager_name: 'Ing. Zbyněk Pokorný', system_user: true },
  { employee_id: 16, full_name: 'Leoš Skucius', title: '', home_department_id: 2, home_department: 'Rostlinná výroba', position: 'Zaměstnanec RV', manager_employee_id: 2, manager_name: 'Ing. Zbyněk Pokorný', system_user: true },
  { employee_id: 17, full_name: 'Václav Trojan', title: '', home_department_id: 2, home_department: 'Rostlinná výroba', position: 'Zaměstnanec RV', manager_employee_id: 2, manager_name: 'Ing. Zbyněk Pokorný', system_user: true },
  { employee_id: 18, full_name: 'Vít Špaček', title: '', home_department_id: 3, home_department: 'Živočišná výroba', position: 'Hlavní vedoucí', manager_employee_id: 1, manager_name: 'Ing. Petr Kuba', system_user: true },
  { employee_id: 19, full_name: 'Jana Bobulová', title: '', home_department_id: 3, home_department: 'Živočišná výroba', position: 'Zootechnička', manager_employee_id: 18, manager_name: 'Vít Špaček', system_user: true },
  { employee_id: 20, full_name: 'Kateřina Kopečková', title: '', home_department_id: 3, home_department: 'Živočišná výroba', position: 'Zootechnička', manager_employee_id: 18, manager_name: 'Vít Špaček', system_user: true },
  { employee_id: 21, full_name: 'Ing. Martina Novotná', title: 'Ing.', home_department_id: 4, home_department: 'Mechanizace', position: 'Hlavní vedoucí / administrátor', manager_employee_id: 1, manager_name: 'Ing. Petr Kuba', system_user: true },
  { employee_id: 22, full_name: 'Karel Trnka', title: '', home_department_id: 4, home_department: 'Mechanizace', position: 'Vedoucí dílen', manager_employee_id: 21, manager_name: 'Ing. Martina Novotná', system_user: true },
  { employee_id: 23, full_name: 'Lukáš Dvořák', title: '', home_department_id: 4, home_department: 'Mechanizace', position: 'Zaměstnanec mechanizace', manager_employee_id: 21, manager_name: 'Ing. Martina Novotná', system_user: true },
  { employee_id: 24, full_name: 'Martina Skucius', title: '', home_department_id: 4, home_department: 'Mechanizace', position: 'Zaměstnanec mechanizace', manager_employee_id: 21, manager_name: 'Ing. Martina Novotná', system_user: true },
  { employee_id: 25, full_name: 'Filip Fiksa', title: '', home_department_id: 4, home_department: 'Mechanizace', position: 'Zaměstnanec mechanizace', manager_employee_id: 21, manager_name: 'Ing. Martina Novotná', system_user: true },
  { employee_id: 26, full_name: 'František Zach', title: '', home_department_id: 4, home_department: 'Mechanizace', position: 'Zaměstnanec mechanizace', manager_employee_id: 21, manager_name: 'Ing. Martina Novotná', system_user: true },
  { employee_id: 27, full_name: 'Jan Raab', title: '', home_department_id: 4, home_department: 'Mechanizace', position: 'Zaměstnanec mechanizace', manager_employee_id: 21, manager_name: 'Ing. Martina Novotná', system_user: true },
  { employee_id: 28, full_name: 'David Ševčík', title: '', home_department_id: 4, home_department: 'Mechanizace', position: 'Zaměstnanec mechanizace', manager_employee_id: 21, manager_name: 'Ing. Martina Novotná', system_user: true },
  { employee_id: 29, full_name: 'Ing. Veronika Suková', title: 'Ing.', home_department_id: 5, home_department: 'BPS', position: 'Vedoucí střediska', manager_employee_id: 1, manager_name: 'Ing. Petr Kuba', system_user: true },
  { employee_id: 30, full_name: 'Daniel Souček', title: '', home_department_id: 5, home_department: 'BPS', position: 'Zaměstnanec BPS', manager_employee_id: 29, manager_name: 'Ing. Veronika Suková', system_user: true },
  { employee_id: 31, full_name: 'Milan Karpíšek', title: '', home_department_id: 5, home_department: 'BPS', position: 'Zaměstnanec BPS', manager_employee_id: 29, manager_name: 'Ing. Veronika Suková', system_user: true },
  { employee_id: 32, full_name: 'Josef Joura', title: '', home_department_id: 5, home_department: 'BPS', position: 'Zaměstnanec BPS', manager_employee_id: 29, manager_name: 'Ing. Veronika Suková', system_user: true },
  { employee_id: 33, full_name: 'Petr Hugo Solař', title: '', home_department_id: 6, home_department: 'Stavební skupina', position: 'Vedoucí střediska', manager_employee_id: 1, manager_name: 'Ing. Petr Kuba', system_user: true },
  { employee_id: 34, full_name: 'Martina Venhoda', title: '', home_department_id: 6, home_department: 'Stavební skupina', position: 'Zaměstnanec stavební skupiny', manager_employee_id: 33, manager_name: 'Petr Hugo Solař', system_user: true },
  { employee_id: 35, full_name: 'František Novák', title: '', home_department_id: 6, home_department: 'Stavební skupina', position: 'Zaměstnanec stavební skupiny', manager_employee_id: 33, manager_name: 'Petr Hugo Solař', system_user: true },
  { employee_id: 36, full_name: 'Monika Ledecká', title: '', home_department_id: 7, home_department: 'Mini mlékárna', position: 'Vedoucí střediska', manager_employee_id: 1, manager_name: 'Ing. Petr Kuba', system_user: true },
  { employee_id: 37, full_name: 'Jana Bulíčková', title: '', home_department_id: null, home_department: 'Mimo středisko / speciální role', position: 'Mzdová a personální kontrola / Helios', manager_employee_id: null, manager_name: '', system_user: true }
];

export const roles: RoleSeed[] = [
  { role_id: 1, role_code: 'ADMIN', role_name: 'Administrátor systému', description: 'Plný přístup ke všem modulům a nastavení systému' },
  { role_id: 2, role_code: 'DIRECTOR', role_name: 'Ředitel společnosti', description: 'Náhled na všechna střediska a reporty bez správy systému' },
  { role_id: 3, role_code: 'DEPT_MANAGER', role_name: 'Vedoucí střediska', description: 'Správa a schvalování pouze vlastního střediska' },
  { role_id: 4, role_code: 'SPECIALIST', role_name: 'Odborná role', description: 'Např. agronom, zootechnička, vedoucí dílen' },
  { role_id: 5, role_code: 'HELIOS_CONTROL', role_name: 'Mzdová a personální kontrola', description: 'Náhled všech výkazů, kontrola a export pro Helios, bez schvalování' },
  { role_id: 6, role_code: 'EMPLOYEE', role_name: 'Zaměstnanec', description: 'Vlastní výkazy a přidělené úkoly' }
];

export const permissions: PermissionSeed[] = [
  { permission_id: 1, permission_code: 'SYSTEM_ADMIN', description: 'Správa systému a organizační struktury' },
  { permission_id: 2, permission_code: 'USER_ADMIN', description: 'Správa uživatelů a oprávnění' },
  { permission_id: 3, permission_code: 'VIEW_ALL', description: 'Náhled do všech dat' },
  { permission_id: 4, permission_code: 'VIEW_DEPT', description: 'Náhled na vlastní středisko' },
  { permission_id: 5, permission_code: 'VIEW_OWN', description: 'Náhled na vlastní záznamy' },
  { permission_id: 6, permission_code: 'EDIT_DEPT', description: 'Úpravy dat vlastního střediska' },
  { permission_id: 7, permission_code: 'EDIT_OWN_UNTIL_APPROVED', description: 'Úprava vlastních výkazů do schválení' },
  { permission_id: 8, permission_code: 'APPROVE_DEPT', description: 'Schvalování výkazů vlastního střediska' },
  { permission_id: 9, permission_code: 'APPROVE_COST_CENTER', description: 'Schvalování práce vykázané na vlastní nákladové středisko' },
  { permission_id: 10, permission_code: 'EXPORT_HELIOS', description: 'Export a podklady pro Helios' },
  { permission_id: 11, permission_code: 'SEND_CORRECTION_NOTICE', description: 'Odeslání upozornění na opravu výkazu' },
  { permission_id: 12, permission_code: 'REPORTS_ALL', description: 'Reporty a statistiky za celou společnost' }
];

export const userRoles: UserRoleSeed[] = [
  { user_role_id: 1, employee_id: 21, role_id: 1, role_code: 'ADMIN', scope_department_id: null, scope_department: 'Všechna střediska / bez omezení' },
  { user_role_id: 2, employee_id: 21, role_id: 3, role_code: 'DEPT_MANAGER', scope_department_id: 4, scope_department: 'Mechanizace' },
  { user_role_id: 3, employee_id: 1, role_id: 2, role_code: 'DIRECTOR', scope_department_id: null, scope_department: 'Všechna střediska / bez omezení' },
  { user_role_id: 4, employee_id: 2, role_id: 3, role_code: 'DEPT_MANAGER', scope_department_id: 2, scope_department: 'Rostlinná výroba' },
  { user_role_id: 5, employee_id: 18, role_id: 3, role_code: 'DEPT_MANAGER', scope_department_id: 3, scope_department: 'Živočišná výroba' },
  { user_role_id: 6, employee_id: 29, role_id: 3, role_code: 'DEPT_MANAGER', scope_department_id: 5, scope_department: 'BPS' },
  { user_role_id: 7, employee_id: 33, role_id: 3, role_code: 'DEPT_MANAGER', scope_department_id: 6, scope_department: 'Stavební skupina' },
  { user_role_id: 8, employee_id: 36, role_id: 3, role_code: 'DEPT_MANAGER', scope_department_id: 7, scope_department: 'Mini mlékárna' },
  { user_role_id: 9, employee_id: 3, role_id: 4, role_code: 'SPECIALIST', scope_department_id: 2, scope_department: 'Rostlinná výroba' },
  { user_role_id: 10, employee_id: 19, role_id: 4, role_code: 'SPECIALIST', scope_department_id: 3, scope_department: 'Živočišná výroba' },
  { user_role_id: 11, employee_id: 20, role_id: 4, role_code: 'SPECIALIST', scope_department_id: 3, scope_department: 'Živočišná výroba' },
  { user_role_id: 12, employee_id: 22, role_id: 4, role_code: 'SPECIALIST', scope_department_id: 4, scope_department: 'Mechanizace' },
  { user_role_id: 13, employee_id: 37, role_id: 5, role_code: 'HELIOS_CONTROL', scope_department_id: null, scope_department: 'Všechna střediska / bez omezení' },
  ...employees
    .filter((employee) => employee.position.startsWith('Zaměstnanec'))
    .map((employee, index) => ({
      user_role_id: 14 + index,
      employee_id: employee.employee_id,
      role_id: 6,
      role_code: 'EMPLOYEE',
      scope_department_id: employee.home_department_id,
      scope_department: employee.home_department
    }))
];

export const rolePermissions = [
  ...permissions.map((permission) => ({ role_id: 1, role_code: 'ADMIN', permission_id: permission.permission_id, permission_code: permission.permission_code })),
  { role_id: 2, role_code: 'DIRECTOR', permission_id: 3, permission_code: 'VIEW_ALL' },
  { role_id: 2, role_code: 'DIRECTOR', permission_id: 12, permission_code: 'REPORTS_ALL' },
  ...[4, 5, 6, 7, 8, 9, 11].map((permission_id) => {
    const permission = permissions.find((item) => item.permission_id === permission_id)!;
    return { role_id: 3, role_code: 'DEPT_MANAGER', permission_id, permission_code: permission.permission_code };
  }),
  ...[4, 5, 7].map((permission_id) => {
    const permission = permissions.find((item) => item.permission_id === permission_id)!;
    return { role_id: 4, role_code: 'SPECIALIST', permission_id, permission_code: permission.permission_code };
  }),
  ...[3, 10, 11].map((permission_id) => {
    const permission = permissions.find((item) => item.permission_id === permission_id)!;
    return { role_id: 5, role_code: 'HELIOS_CONTROL', permission_id, permission_code: permission.permission_code };
  }),
  ...[5, 7].map((permission_id) => {
    const permission = permissions.find((item) => item.permission_id === permission_id)!;
    return { role_id: 6, role_code: 'EMPLOYEE', permission_id, permission_code: permission.permission_code };
  })
];

function slugName(name: string) {
  return name
    .toLocaleLowerCase('cs-CZ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^ing\.\s*/, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/(^\.|\.$)/g, '');
}

function primaryRoleForEmployee(employeeId: number) {
  const assignments = userRoles.filter((item) => item.employee_id === employeeId);
  const priority = ['ADMIN', 'DIRECTOR', 'HELIOS_CONTROL', 'DEPT_MANAGER', 'SPECIALIST', 'EMPLOYEE'];
  return assignments.sort((first, second) => priority.indexOf(first.role_code) - priority.indexOf(second.role_code))[0];
}

function compatibleRole(roleCode: string) {
  if (roleCode === 'ADMIN') return 'admin';
  if (roleCode === 'DIRECTOR') return 'reditel';
  if (roleCode === 'HELIOS_CONTROL') return 'helios';
  if (roleCode === 'DEPT_MANAGER') return 'schvalovatel';
  if (roleCode === 'SPECIALIST') return 'specialista';
  return 'zamestnanec';
}

export function organizationUsers() {
  return employees.map((employee) => {
    const primaryRole = primaryRoleForEmployee(employee.employee_id);
    const role = roles.find((item) => item.role_id === primaryRole?.role_id);
    return {
      id: employee.employee_id,
      username: slugName(employee.full_name),
      email: `${slugName(employee.full_name)}@lesonice.local`,
      role: compatibleRole(primaryRole?.role_code ?? 'EMPLOYEE'),
      role_code: primaryRole?.role_code ?? 'EMPLOYEE',
      role_name: role?.role_name ?? 'Zaměstnanec',
      full_name: employee.full_name,
      title: employee.title,
      active: true,
      department_id: employee.home_department_id,
      department_name: employee.home_department,
      position: employee.position,
      manager_employee_id: employee.manager_employee_id,
      manager_name: employee.manager_name,
      scope_department_id: primaryRole?.scope_department_id ?? null,
      scope_department: primaryRole?.scope_department ?? employee.home_department
    };
  });
}
