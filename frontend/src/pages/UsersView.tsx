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
  manager_username?: string;
  scope_department?: string;
  active: boolean;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  last_change?: string;
  password?: string;
}

const roleOptions = [
  ['zamestnanec', 'Pracovník'],
  ['traktorista', 'Pracovník s technikou'],
  ['schvalovatel', 'Vedoucí'],
  ['specialista', 'Vedoucí specialista'],
  ['approved_viewer', 'Kontrola schválených výkazů'],
  ['reditel', 'Ředitel'],
  ['admin', 'Administrátor']
];

function emptyUser(): UserRecord {
  return {
    id: 0,
    username: '',
    email: '',
    role: 'zamestnanec',
    full_name: '',
    department_name: serviceCenters[0],
    scope_department: serviceCenters[0],
    position: '',
    manager_name: '',
    active: true,
    password: ''
  };
}

function formatAuditDate(value?: string) {
  if (!value) return '-';
  return formatCzechDateTime(value);
}

function UsersView() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [editedUser, setEditedUser] = useState<UserRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState('');
  const user = getUser();
  const canEditOrganization = user?.role === 'admin' || user?.role === 'reditel';

  useEffect(() => {
    client.get('/users')
      .then((response) => setUsers(response.data as UserRecord[]))
      .catch((error) => console.error(error));
  }, []);

  const departments = useMemo(() => [...new Set(users.map((user) => user.department_name).filter(Boolean))].sort(), [users]);
  const filteredUsers = users.filter((user) => {
    return departmentFilter === 'all' || user.department_name === departmentFilter;
  });

  const startEdit = (item: UserRecord) => {
    setIsCreating(false);
    setEditedUser({ ...item, password: '' });
  };

  const startCreate = () => {
    setIsCreating(true);
    setEditedUser(emptyUser());
    setMessage('');
  };

  const cancelEdit = () => {
    setIsCreating(false);
    setEditedUser(null);
  };

  const saveEdit = async () => {
    if (!editedUser) return;
    try {
      const response = isCreating
        ? await client.post('/users', editedUser)
        : await client.put(`/users/${editedUser.id}`, editedUser);
      const saved = response.data as UserRecord;
      setUsers((items) => isCreating
        ? [...items, saved].sort((first, second) => first.full_name.localeCompare(second.full_name, 'cs-CZ'))
        : items.map((item) => item.id === saved.id ? { ...item, ...saved, role_name: saved.role } : item));
      setMessage(isCreating ? 'Uživatel byl přidán.' : 'Uživatel byl upraven.');
      cancelEdit();
    } catch (error) {
      console.error(error);
      const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setMessage(detail || 'Uživatele se nepodařilo uložit.');
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
          {canEditOrganization ? <button type="button" className="primary" onClick={startCreate}>Přidat uživatele</button> : null}
        </div>
        <p className="table-hint">Účty se deaktivují, nemažou. Historie výkazů a změn tak zůstává zachována.</p>
        {message ? <p className="form-message" role="status">{message}</p> : null}
        {editedUser ? (
          <div className="user-account-editor">
            <div className="section-line">
              <h2>{isCreating ? 'Nový uživatel' : `Upravit účet: ${editedUser.full_name}`}</h2>
            </div>
            <div className="field-grid user-account-editor__grid">
              <label className="field-row">Jméno<input value={editedUser.full_name} onChange={(event) => updateEdited({ full_name: event.target.value })} /></label>
              <label className="field-row">Přihlašovací jméno<input autoCapitalize="none" value={editedUser.username} onChange={(event) => updateEdited({ username: event.target.value.toLowerCase() })} /></label>
              <label className="field-row">{isCreating ? 'Heslo' : 'Nové heslo (nepovinné)'}<input type="password" autoComplete="new-password" value={editedUser.password ?? ''} onChange={(event) => updateEdited({ password: event.target.value })} /></label>
              <label className="field-row">E-mail<input type="email" placeholder="doplní se automaticky" value={editedUser.email ?? ''} onChange={(event) => updateEdited({ email: event.target.value })} /></label>
              <label className="field-row">Středisko<select value={editedUser.department_name ?? ''} onChange={(event) => updateEdited({ department_name: event.target.value, scope_department: event.target.value })}>{serviceCenters.map((center) => <option key={center} value={center}>{center}</option>)}</select></label>
              <label className="field-row">Pozice<input value={editedUser.position ?? ''} onChange={(event) => updateEdited({ position: event.target.value })} /></label>
              <label className="field-row">Oprávnění<select value={editedUser.role} onChange={(event) => updateEdited({ role: event.target.value })}>{roleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="field-row">Nadřízený<select value={editedUser.manager_username ?? ''} onChange={(event) => updateEdited({ manager_username: event.target.value || undefined })}><option value="">Bez nadřízeného</option>{users.filter((item) => item.active && item.id !== editedUser.id).map((item) => <option key={item.id} value={item.username}>{item.full_name}</option>)}</select></label>
            </div>
            <label className="toggle-row"><input type="checkbox" checked={editedUser.active} onChange={(event) => updateEdited({ active: event.target.checked })} />Aktivní účet</label>
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={cancelEdit}>Zrušit</button>
              <button type="button" className="primary" onClick={saveEdit}>{isCreating ? 'Vytvořit účet' : 'Uložit změny'}</button>
            </div>
          </div>
        ) : null}
        <div className="filter-bar filter-bar--compact">
          <label>
            Středisko
            <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
              <option value="all">Vše</option>
              {departments.map((department) => <option key={department} value={department}>{department}</option>)}
            </select>
          </label>
        </div>
        <table className="approval-table">
          <thead>
            <tr>
              <th>Jméno</th>
              <th>Přihlášení</th>
              <th>Středisko</th>
              <th>Pozice</th>
              <th>Nadřízený</th>
              <th>Poslední úprava</th>
              <th>Stav</th>
              {canEditOrganization ? <th>Akce</th> : null}
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((item) => {
              return (
                <tr key={item.id}>
                  <td data-label="Jméno">{item.full_name}</td>
                  <td data-label="Přihlášení">{item.username}</td>
                  <td data-label="Středisko">{item.department_name ?? '-'}</td>
                  <td data-label="Pozice">{item.position ?? '-'}</td>
                  <td data-label="Nadřízený">{item.manager_name || '-'}</td>
                  <td data-label="Poslední úprava">{formatAuditDate(item.updated_at)}</td>
                  <td data-label="Stav"><span className={item.active ? 'status-green' : 'status-red'}>{item.active ? 'Aktivní' : 'Neaktivní'}</span></td>
                  {canEditOrganization ? (
                    <td data-label="Akce">
                      <button type="button" className="edit-action" onClick={() => startEdit(item)}>Upravit</button>
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
