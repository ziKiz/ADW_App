import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import { getUser } from '../utils/auth';
import { serviceCenters } from '../utils/employeeContext';
import { formatCzechDateTime } from '../utils/format';

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
  return formatCzechDateTime(value);
}

function UsersView() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editedUser, setEditedUser] = useState<UserRecord | null>(null);
  const user = getUser();
  const canEditOrganization = user?.role === 'admin' || user?.full_name === 'Demo Admin';
  const roleOptions = ['admin', 'reditel', 'schvalovatel', 'specialista', 'zamestnanec', 'traktorista', 'helios'];

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

  const startEdit = (item: UserRecord) => {
    setEditingId(item.id);
    setEditedUser({ ...item });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditedUser(null);
  };

  const saveEdit = async () => {
    if (!editedUser) return;
    try {
      const response = await client.put(`/users/${editedUser.id}`, editedUser);
      const saved = response.data as UserRecord;
      setUsers((items) => items.map((item) => item.id === saved.id ? { ...item, ...saved, role_name: saved.role } : item));
      cancelEdit();
    } catch (error) {
      console.error(error);
    }
  };

  const updateEdited = (changes: Partial<UserRecord>) => {
    setEditedUser((item) => item ? { ...item, ...changes } : item);
  };

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
              {canEditOrganization ? <th>Akce</th> : null}
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((item) => {
              const isEditing = editingId === item.id && editedUser;
              return (
                <tr key={item.id}>
                  <td data-label="Jméno">
                    {isEditing ? <input value={editedUser.full_name} onChange={(event) => updateEdited({ full_name: event.target.value })} /> : item.full_name}
                  </td>
                  <td data-label="Středisko">
                    {isEditing ? (
                      <select value={editedUser.department_name ?? ''} onChange={(event) => updateEdited({ department_name: event.target.value, scope_department: event.target.value })}>
                        {serviceCenters.map((center) => <option key={center} value={center}>{center}</option>)}
                      </select>
                    ) : item.department_name ?? '-'}
                  </td>
                  <td data-label="Pozice">
                    {isEditing ? <input value={editedUser.position ?? ''} onChange={(event) => updateEdited({ position: event.target.value })} /> : item.position ?? '-'}
                  </td>
                  <td data-label="Nadřízený">{item.manager_name || '-'}</td>
                  <td data-label="Role">
                    {isEditing ? (
                      <select value={editedUser.role} onChange={(event) => updateEdited({ role: event.target.value })}>
                        {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                    ) : <span className="status-green">{item.role_name ?? item.role_code ?? item.role}</span>}
                  </td>
                  <td data-label="Rozsah">
                    {isEditing ? (
                      <select value={editedUser.scope_department ?? editedUser.department_name ?? ''} onChange={(event) => updateEdited({ scope_department: event.target.value })}>
                        {serviceCenters.map((center) => <option key={center} value={center}>{center}</option>)}
                      </select>
                    ) : item.scope_department ?? '-'}
                  </td>
                  <td data-label="Poslední úprava">{formatAuditDate(item.updated_at)}</td>
                  {canEditOrganization ? (
                    <td data-label="Akce">
                      {isEditing ? (
                        <div className="table-actions">
                          <button type="button" className="edit-action" onClick={saveEdit}>Uložit</button>
                          <button type="button" className="edit-action" onClick={cancelEdit}>Zrušit</button>
                        </div>
                      ) : (
                        <button type="button" className="edit-action" onClick={() => startEdit(item)}>Upravit</button>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default UsersView;
