import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';

interface UserRecord {
  id: number;
  username: string;
  email: string;
  role: string;
  role_code?: string;
  role_name?: string;
  full_name: string;
  department_name?: string;
  position?: string;
  manager_name?: string;
  scope_department?: string;
  active: boolean;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  last_change?: string;
}

function formatAuditDate(value?: string) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('cs-CZ', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}

function UsersView() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    client.get('/users')
      .then((response) => setUsers(response.data as UserRecord[]))
      .catch((error) => console.error(error));
  }, []);

  const roles = useMemo(() => [...new Set(users.map((user) => user.role_name ?? user.role_code ?? user.role))].sort(), [users]);
  const departments = useMemo(() => [...new Set(users.map((user) => user.department_name).filter(Boolean))].sort(), [users]);
  const filteredUsers = users.filter((user) => {
    const role = user.role_name ?? user.role_code ?? user.role;
    return (roleFilter === 'all' || role === roleFilter) && (departmentFilter === 'all' || user.department_name === departmentFilter);
  });

  return (
    <div className="container">
      <section className="card">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Databáze</p>
            <h1 className="page-title">Organizace a role</h1>
          </div>
        </div>
        <p className="table-hint">Zdroj: definice organizační struktury a návrh databázového modelu ADW.</p>
        <div className="filter-bar filter-bar--compact">
          <label>
            Středisko
            <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
              <option value="all">Vše</option>
              {departments.map((department) => <option key={department} value={department}>{department}</option>)}
            </select>
          </label>
          <label>
            Role
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="all">Vše</option>
              {roles.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </label>
        </div>
        <table className="approval-table">
          <thead>
            <tr>
              <th>Jméno</th>
              <th>Středisko</th>
              <th>Pozice</th>
              <th>Nadřízený</th>
              <th>Role</th>
              <th>Rozsah</th>
              <th>Poslední úprava</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id}>
                <td data-label="Jméno">{user.full_name}</td>
                <td data-label="Středisko">{user.department_name ?? '-'}</td>
                <td data-label="Pozice">{user.position ?? '-'}</td>
                <td data-label="Nadřízený">{user.manager_name || '-'}</td>
                <td data-label="Role"><span className="status-green">{user.role_name ?? user.role_code ?? user.role}</span></td>
                <td data-label="Rozsah">{user.scope_department ?? '-'}</td>
                <td data-label="Poslední úprava">{formatAuditDate(user.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default UsersView;
