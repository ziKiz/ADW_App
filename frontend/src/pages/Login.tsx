import { useState, FormEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { DEMO_ADMIN_USER, saveUser } from '../utils/auth';

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

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

  const useDemoAdmin = () => {
    saveUser(DEMO_ADMIN_USER);
    navigate('/dashboard');
  };

  return (
    <div className="login-screen">
      <div className="card login-card">
        <div>
          <p className="eyebrow">ADW aplikace</p>
          <h1 className="page-title">Přihlášení</h1>
          <p className="section-title">Zadejte účet nebo pokračujte v offline demo režimu.</p>
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
          <button type="button" className="secondary" onClick={useDemoAdmin}>Pokračovat jako Ing. Martina Novotná</button>
        </form>
      </div>
    </div>
  );
}

export default Login;
