import { useState, FormEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import client, { isLiveMode } from '../api/client';
import { AVAILABLE_DEMO_USERS, saveUser } from '../utils/auth';

function roleLabel(role: string) {
  switch (role) {
    case 'admin': return 'Vedoucí / Admin';
    case 'reditel': return 'Ředitel';
    case 'schvalovatel': return 'Schvalovatel';
    case 'specialista': return 'Agronom';
    case 'traktorista': return 'Traktorista';
    case 'zamestnanec': return 'Zaměstnanec';
    default: return 'Uživatel';
  }
}

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [selectedUserForLogin, setSelectedUserForLogin] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const response = await client.post('/auth/login', { email, password });
      saveUser(response.data);
      navigate('/dashboard');
    } catch (error) {
      console.error(error);
      setMessage('Přihlášení se nezdařilo. Zkontrolujte údaje.');
    }
  };

  const loginAsUser = async (username: string) => {
    const user = AVAILABLE_DEMO_USERS.find((u) => u.username === username);
    if (user) {
      if (isLiveMode) {
        const response = await client.post('/auth/login', { email: user.email, password: 'demo' });
        saveUser(response.data);
      } else {
        saveUser(user);
      }
      navigate('/dashboard');
    }
  };

  const handleCancelSelection = () => {
    setSelectedUserForLogin(null);
    setEmail('');
    setPassword('');
    setMessage('');
  };

  if (!selectedUserForLogin) {
    return (
      <div className="login-screen">
        <div className="card login-card">
          <div>
            <p className="eyebrow">ADW aplikace</p>
            <h1 className="page-title">Přihlášení</h1>
            <p className="section-title">Vyberte účet nebo se přihlaste manuálně.</p>
          </div>
          <div className="login-user-selection">
            {AVAILABLE_DEMO_USERS.map((user) => (
              <button
                key={user.username}
                type="button"
                className="user-select-button"
                onClick={() => setSelectedUserForLogin(user.username)}
              >
                <strong>{user.full_name}</strong>
                <span className="user-role">{roleLabel(user.role)}</span>
              </button>
            ))}
          </div>
          <button type="button" className="tertiary" onClick={() => setSelectedUserForLogin('manual')}>
            Přihlásit se s údaji
          </button>
        </div>
      </div>
    );
  }

  if (selectedUserForLogin === 'manual') {
    return (
      <div className="login-screen">
        <div className="card login-card">
          <div>
            <p className="eyebrow">ADW aplikace</p>
            <h1 className="page-title">Přihlášení</h1>
            <p className="section-title">Zadejte přihlašovací údaje.</p>
          </div>
          <form onSubmit={handleSubmit} className="login-form">
            <div className="field-row">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" placeholder="jmeno@firma.cz" value={email} onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)} required />
            </div>
            <div className="field-row">
              <label htmlFor="password">Heslo</label>
              <input id="password" type="password" placeholder="••••••••" value={password} onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)} required />
            </div>
            {message && <p className="form-message">{message}</p>}
            <button type="submit" className="primary">Přihlásit se</button>
            <button type="button" className="secondary" onClick={handleCancelSelection}>Zpět</button>
          </form>
        </div>
      </div>
    );
  }

  const selectedUser = AVAILABLE_DEMO_USERS.find((u) => u.username === selectedUserForLogin);
  if (!selectedUser) return null;

  return (
    <div className="login-screen">
      <div className="card login-card">
        <div>
          <p className="eyebrow">ADW aplikace</p>
          <h1 className="page-title">Přihlášení</h1>
          <p className="section-title">Přihlášení jako: <strong>{selectedUser.full_name}</strong></p>
        </div>
        <div className="login-form">
          <p>Prosím vyčkejte, přihlašuji vás...</p>
          <button
            type="button"
            className="primary"
            onClick={() => loginAsUser(selectedUser.username)}
          >
            Pokračovat
          </button>
          <button type="button" className="secondary" onClick={handleCancelSelection}>Zpět</button>
        </div>
      </div>
    </div>
  );
}

export default Login;
