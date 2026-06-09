import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { clearUser, getOrCreateDemoUser } from '../utils/auth';

function BrandHeader() {
  const navigate = useNavigate();
  const user = getOrCreateDemoUser();
  const [pendingCount, setPendingCount] = useState(0);

  const handleLogout = () => {
    clearUser();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    client.get('/reports')
      .then((response) => {
        const reports = response.data as Array<{ status: string }>;
        setPendingCount(reports.filter((report) => report.status === 'pending').length);
      })
      .catch((error) => console.error(error));
  }, []);

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__brand">
        <NavLink to="/" className="brand-logo" aria-label="ADW dashboard">
          <svg viewBox="0 0 188 78" role="img" aria-labelledby="adwLogoTitle">
            <title id="adwLogoTitle">ADW</title>
            <ellipse cx="94" cy="39" rx="88" ry="33" />
            <text x="94" y="52" textAnchor="middle">ADW</text>
          </svg>
          <span>Rolnická společnost<br />Lesonice a.s.</span>
        </NavLink>
      </div>
      <nav className="brand-nav desktop-nav" aria-label="Hlavní navigace">
        <NavLink to="/dashboard" end>Přehled</NavLink>
        <div className="nav-group">
          <NavLink to="/report" end className="nav-group__parent">Výkazy</NavLink>
          <div className="nav-children">
            <NavLink to="/approvals" end>Ke schválení <b className="badge-warning">{pendingCount}</b></NavLink>
            <NavLink to="/approvals/approved" end>Schválené</NavLink>
          </div>
        </div>
        <NavLink to="/users" end>Organizace</NavLink>
        <NavLink to="/dictionaries" end>Číselníky</NavLink>
        <NavLink to="/export" end>Exporty</NavLink>
      </nav>
      <nav className="mobile-bottom-nav" aria-label="Mobilní navigace">
        <NavLink to="/dashboard" end>Přehled</NavLink>
        <NavLink to="/report" end>Výkaz</NavLink>
        <NavLink to="/approvals">Ke schválení <b className="badge-warning">{pendingCount}</b></NavLink>
        <NavLink to="/dictionaries" end>Číselníky</NavLink>
        <NavLink to="/export" end>Exporty</NavLink>
      </nav>
      <div className="brand-user">
        <span>{user?.full_name ?? 'Nepřihlášený uživatel'}</span>
        <strong>Administrátor systému</strong>
        <button className="logout-button" type="button" onClick={handleLogout}>Odhlásit se</button>
      </div>
    </aside>
  );
}

export default BrandHeader;
