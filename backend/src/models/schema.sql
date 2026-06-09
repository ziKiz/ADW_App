-- PostgreSQL schema for ADW reports application

CREATE TABLE IF NOT EXISTS departments (
  department_id INT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(32) UNIQUE NOT NULL,
  parent_department_id INT REFERENCES departments(department_id),
  description TEXT
);

CREATE TABLE IF NOT EXISTS employees (
  employee_id INT PRIMARY KEY,
  full_name VARCHAR(200) NOT NULL,
  title VARCHAR(50),
  home_department_id INT REFERENCES departments(department_id),
  position VARCHAR(200),
  manager_employee_id INT REFERENCES employees(employee_id),
  is_active BOOLEAN DEFAULT TRUE,
  is_system_user BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS roles (
  role_id INT PRIMARY KEY,
  role_code VARCHAR(50) UNIQUE NOT NULL,
  role_name VARCHAR(100) NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS permissions (
  permission_id INT PRIMARY KEY,
  permission_code VARCHAR(80) UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT REFERENCES roles(role_id),
  permission_id INT REFERENCES permissions(permission_id),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_role_id INT PRIMARY KEY,
  employee_id INT REFERENCES employees(employee_id),
  role_id INT REFERENCES roles(role_id),
  scope_department_id INT REFERENCES departments(department_id)
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  employee_id INT REFERENCES employees(employee_id),
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL,
  full_name VARCHAR(200),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(200),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by VARCHAR(200),
  last_change TEXT
);

CREATE TABLE IF NOT EXISTS tractors (
  id SERIAL PRIMARY KEY,
  tractor_code VARCHAR(100) UNIQUE NOT NULL,
  tractor_name VARCHAR(200) NOT NULL,
  vehicle_type VARCHAR(100),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(200),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by VARCHAR(200),
  last_change TEXT
);

CREATE TABLE IF NOT EXISTS fields (
  id SERIAL PRIMARY KEY,
  field_code VARCHAR(100) UNIQUE NOT NULL,
  field_name VARCHAR(200) NOT NULL,
  quadrant VARCHAR(50),
  area DECIMAL(10,2),
  culture VARCHAR(50),
  crop VARCHAR(200),
  erosion VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(200),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by VARCHAR(200),
  last_change TEXT
);

CREATE TABLE IF NOT EXISTS work_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(200),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by VARCHAR(200),
  last_change TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  collection VARCHAR(100) NOT NULL,
  record_id INT NOT NULL,
  action VARCHAR(32) NOT NULL,
  changed_at TIMESTAMP DEFAULT NOW(),
  changed_by VARCHAR(200),
  changed_by_id VARCHAR(100),
  before_data JSONB,
  after_data JSONB
);

CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  report_number VARCHAR(100) UNIQUE NOT NULL,
  tractor_id INT REFERENCES tractors(id),
  user_id INT REFERENCES users(id),
  employee_id INT REFERENCES employees(employee_id),
  home_department_id INT REFERENCES departments(department_id),
  cost_department_id INT REFERENCES departments(department_id),
  field_id INT REFERENCES fields(id),
  work_type_id INT REFERENCES work_types(id),
  date DATE NOT NULL,
  time_start TIME,
  time_end TIME,
  break_hours DECIMAL(5,2) DEFAULT 0,
  hours_worked DECIMAL(5,2),
  amount_ha DECIMAL(10,2) DEFAULT 0,
  fuel_liters DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  status VARCHAR(32) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fuel_entries (
  id SERIAL PRIMARY KEY,
  report_id INT REFERENCES reports(id),
  date DATE NOT NULL,
  tractor_id INT REFERENCES tractors(id),
  user_id INT REFERENCES users(id),
  liters DECIMAL(10,2) NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approvals (
  id SERIAL PRIMARY KEY,
  report_id INT REFERENCES reports(id),
  approver_id INT REFERENCES users(id),
  approver_employee_id INT REFERENCES employees(employee_id),
  department_id INT REFERENCES departments(department_id),
  approval_step VARCHAR(50),
  status VARCHAR(32) DEFAULT 'pending',
  comment TEXT,
  approved_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS work_report_lines (
  work_report_line_id SERIAL PRIMARY KEY,
  report_id INT REFERENCES reports(id),
  cost_department_id INT REFERENCES departments(department_id),
  field_id INT REFERENCES fields(id),
  tractor_id INT REFERENCES tractors(id),
  work_type_id INT REFERENCES work_types(id),
  hours_worked DECIMAL(5,2),
  amount_ha DECIMAL(10,2),
  fuel_liters DECIMAL(10,2),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS helios_checks (
  helios_check_id SERIAL PRIMARY KEY,
  report_id INT REFERENCES reports(id),
  checked_by_employee_id INT REFERENCES employees(employee_id),
  check_status VARCHAR(32) DEFAULT 'pending',
  finding TEXT,
  checked_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  notification_id SERIAL PRIMARY KEY,
  recipient_employee_id INT REFERENCES employees(employee_id),
  report_id INT REFERENCES reports(id),
  notification_type VARCHAR(80),
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO tractors (tractor_code, tractor_name, vehicle_type)
VALUES
  ('S05 0148', 'FENDT VARIO 724', 'traktor'),
  ('S05 8924', 'FENDT VARIO 724', 'traktor'),
  ('S07 2384', 'FENDT 1165 PÁSÁK', 'traktor'),
  ('S07 6568', 'FENDT 516', 'traktor'),
  ('S07 6551', 'FENDT 828', 'traktor'),
  ('J03 7561', 'FENDT 211', 'traktor'),
  ('J02 2050', 'NEW HOLLAND TS135A', 'traktor'),
  ('J03 3668', 'NEW HOLLAND TM155', 'traktor'),
  ('J01 6057', 'Challenger MT 865 C', 'traktor'),
  ('J02 3322', 'Challenger MT 545 B', 'traktor'),
  ('TR 25-69', 'Zetor 3011', 'traktor'),
  ('TR 38-85', 'Zetor 4511', 'traktor'),
  ('TR 69-74', 'Zetor 6911', 'traktor'),
  ('TR 00-42', 'Zetor 7211', 'traktor'),
  ('TRA 01-50', 'Zetor 7711', 'traktor'),
  ('TRA 06-08', 'Zetor 7711', 'traktor'),
  ('J02 3536', 'Zetor 7711', 'traktor'),
  ('nemá - Zetor 7245', 'Zetor 7245', 'traktor'),
  ('J03 0381', 'Zetor 7745', 'traktor'),
  ('TRA 23-73', 'Zetor 9641', 'traktor'),
  ('J03 3669', 'Zetor 9540 (105)', 'traktor'),
  ('J02 6889', 'Z Proxima Power', 'traktor'),
  ('nemá - Domamil', 'Domamil', 'traktor')
ON CONFLICT DO NOTHING;

INSERT INTO fields (field_code, field_name, quadrant, area, culture, crop, erosion)
VALUES
  ('0307/1', 'Anterie', '660-1150', 3.22, 'R', 'Kukuřice na siláž', 'NEO'),
  ('2101/1', 'Bahna 1', '660-1160', 17.15, 'R', 'Pšenice setá ozimá', 'MEO-VR'),
  ('1509', 'Ctvrtky', '660-1160', 9.73, 'R', 'Řepka ozimá', 'MEO-NR'),
  ('2304/3', 'Dily Lesonice', '660-1160', 32.05, 'R', 'Pšenice setá ozimá', 'XXX'),
  ('1201/2', 'Dolni louky 1', '660-1160', 2.03, 'T', 'Trvalý travní porost', 'NEO')
ON CONFLICT DO NOTHING;

INSERT INTO work_types (name, description)
VALUES
  ('Orání', 'Příprava půdy před setím'),
  ('Setí', 'Založení plodiny na pole'),
  ('Sklizeň', 'Sklizeň úrody'),
  ('Mulčování', 'Odstranění porostu a údržba mezí'),
  ('Hnojení', 'Aplikace hnojiva nebo živin'),
  ('Ostatní', 'Ostatní práce mimo hlavní kategorie')
ON CONFLICT DO NOTHING;

INSERT INTO departments (department_id, name, code, parent_department_id, description)
VALUES
  (1, 'Ředitelství', 'Reditelstvi', NULL, 'Vedení společnosti'),
  (2, 'Rostlinná výroba', 'RV', 1, 'Středisko rostlinné výroby'),
  (3, 'Živočišná výroba', 'ZV', 1, 'Středisko živočišné výroby'),
  (4, 'Mechanizace', 'MECH', 1, 'Středisko mechanizace'),
  (5, 'BPS', 'BPS', 1, 'Bioplynová stanice'),
  (6, 'Stavební skupina', 'STAV', 1, 'Stavební skupina'),
  (7, 'Mini mlékárna', 'MLEK', 1, 'Mini mlékárna')
ON CONFLICT DO NOTHING;

INSERT INTO roles (role_id, role_code, role_name, description)
VALUES
  (1, 'ADMIN', 'Administrátor systému', 'Plný přístup ke všem modulům a nastavení systému'),
  (2, 'DIRECTOR', 'Ředitel společnosti', 'Náhled na všechna střediska a reporty bez správy systému'),
  (3, 'DEPT_MANAGER', 'Vedoucí střediska', 'Správa a schvalování pouze vlastního střediska'),
  (4, 'SPECIALIST', 'Odborná role', 'Např. agronom, zootechnička, vedoucí dílen'),
  (5, 'HELIOS_CONTROL', 'Mzdová a personální kontrola', 'Náhled všech výkazů, kontrola a export pro Helios, bez schvalování'),
  (6, 'EMPLOYEE', 'Zaměstnanec', 'Vlastní výkazy a přidělené úkoly')
ON CONFLICT DO NOTHING;

INSERT INTO permissions (permission_id, permission_code, description)
VALUES
  (1, 'SYSTEM_ADMIN', 'Správa systému a organizační struktury'),
  (2, 'USER_ADMIN', 'Správa uživatelů a oprávnění'),
  (3, 'VIEW_ALL', 'Náhled do všech dat'),
  (4, 'VIEW_DEPT', 'Náhled na vlastní středisko'),
  (5, 'VIEW_OWN', 'Náhled na vlastní záznamy'),
  (6, 'EDIT_DEPT', 'Úpravy dat vlastního střediska'),
  (7, 'EDIT_OWN_UNTIL_APPROVED', 'Úprava vlastních výkazů do schválení'),
  (8, 'APPROVE_DEPT', 'Schvalování výkazů vlastního střediska'),
  (9, 'APPROVE_COST_CENTER', 'Schvalování práce vykázané na vlastní nákladové středisko'),
  (10, 'EXPORT_HELIOS', 'Export a podklady pro Helios'),
  (11, 'SEND_CORRECTION_NOTICE', 'Odeslání upozornění na opravu výkazu'),
  (12, 'REPORTS_ALL', 'Reporty a statistiky za celou společnost')
ON CONFLICT DO NOTHING;

INSERT INTO employees (employee_id, full_name, title, home_department_id, position, manager_employee_id, is_active, is_system_user)
VALUES
  (1, 'Ing. Petr Kuba', 'Ing.', 1, 'Ředitel společnosti', NULL, TRUE, TRUE),
  (2, 'Ing. Zbyněk Pokorný', 'Ing.', 2, 'Hlavní vedoucí', 1, TRUE, TRUE),
  (18, 'Vít Špaček', '', 3, 'Hlavní vedoucí', 1, TRUE, TRUE),
  (21, 'Ing. Martina Novotná', 'Ing.', 4, 'Hlavní vedoucí / administrátor', 1, TRUE, TRUE),
  (29, 'Ing. Veronika Suková', 'Ing.', 5, 'Vedoucí střediska', 1, TRUE, TRUE),
  (33, 'Petr Hugo Solař', '', 6, 'Vedoucí střediska', 1, TRUE, TRUE),
  (36, 'Monika Ledecká', '', 7, 'Vedoucí střediska', 1, TRUE, TRUE),
  (37, 'Jana Bulíčková', '', NULL, 'Mzdová a personální kontrola / Helios', NULL, TRUE, TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO users (employee_id, username, email, password_hash, role, full_name)
VALUES
  (21, 'martina.novotna', 'martina.novotna@lesonice.local', 'changeme', 'admin', 'Ing. Martina Novotná'),
  (1, 'petr.kuba', 'petr.kuba@lesonice.local', 'changeme', 'reditel', 'Ing. Petr Kuba'),
  (37, 'jana.bulickova', 'jana.bulickova@lesonice.local', 'changeme', 'helios', 'Jana Bulíčková')
ON CONFLICT DO NOTHING;
