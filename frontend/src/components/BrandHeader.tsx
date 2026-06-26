import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { clearUser, getOrCreateDemoUser } from '../utils/auth';
import { appDataValidity } from '../utils/employeeContext';
import packageJson from '../../package.json';

function BrandHeader() {
  const navigate = useNavigate();
  const user = getOrCreateDemoUser();
  const [pendingCount, setPendingCount] = useState(0);
  const versionLabel = packageJson.version;
  const validTo = new Intl.DateTimeFormat('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${appDataValidity}T12:00:00`));

  const handleLogout = () => {
    clearUser();
    navigate('/login', { replace: true });
  };

  const canSeeApprovals = ['admin', 'reditel', 'schvalovatel', 'specialista'].includes(user?.role ?? '');
  const canSeeDirectorOverview = user?.role === 'admin' || user?.role === 'reditel';
  const canSeeAdminModules = user?.role === 'admin' || user?.role === 'reditel';

  const getRoleLabel = () => {
    switch(user?.role) {
      case 'admin': return 'Administrátor systému';
      case 'reditel': return 'Ředitel';
      case 'schvalovatel': return 'Schvalovatel';
      case 'specialista': return 'Specialista';
      case 'zamestnanec': return 'Zaměstnanec';
      case 'traktorista': return 'Traktorista';
      default: return 'Uživatel';
    }
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
          {canSeeApprovals && (
            <div className="nav-children">
              <NavLink to="/approvals" end>Ke schválení <b className="badge-warning">{pendingCount}</b></NavLink>
              <NavLink to="/approvals/approved" end>Schválené</NavLink>
            </div>
          )}
        </div>
        {canSeeAdminModules && (
          <>
            {canSeeDirectorOverview ? <NavLink to="/director" end>Přehled ředitelství</NavLink> : null}
            <NavLink to="/users" end>Organizace</NavLink>
            <NavLink to="/dictionaries" end>Číselníky</NavLink>
            <NavLink to="/export" end>Exporty</NavLink>
          </>
        )}
        <NavLink to="/services" end>Služby</NavLink>
        <NavLink to="/contacts" end>Kontakty</NavLink>
      </nav>
      <nav className="mobile-bottom-nav" aria-label="Mobilní navigace">
        <NavLink to="/dashboard" end>Přehled</NavLink>
        <NavLink to="/report" end>Výkaz</NavLink>
        {canSeeApprovals && (
          <>
            <NavLink to="/approvals">Ke schválení <b className="badge-warning">{pendingCount}</b></NavLink>
            {canSeeDirectorOverview ? <NavLink to="/director" end>Ředitelství</NavLink> : null}
            {canSeeAdminModules ? <NavLink to="/dictionaries" end>Číselníky</NavLink> : null}
            {canSeeAdminModules ? <NavLink to="/export" end>Exporty</NavLink> : null}
          </>
        )}
        <NavLink to="/services" end>Služby</NavLink>
        <NavLink to="/contacts" end>Kontakty</NavLink>
      </nav>
      <div className="brand-user">
        <span>{user?.full_name ?? 'Nepřihlášený uživatel'}</span>
        <strong>{getRoleLabel()}</strong>
        <button className="logout-button" type="button" onClick={handleLogout}>Odhlásit se</button>
      </div>
      <div className="app-sidebar__version">
        <span>Verze {versionLabel}</span>
        <small>Databáze platná k {validTo}</small>
      </div>
    </aside>
  );
}

export default BrandHeader;
