import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { canSwitchProfile, clearUser, getOrCreateDemoUser, getProfileMode, setProfileMode } from '../utils/auth';
import { appDataValidity } from '../utils/employeeContext';
import packageJson from '../../package.json';

function BrandHeader() {
  const navigate = useNavigate();
  const user = getOrCreateDemoUser();
  const [pendingCount, setPendingCount] = useState(0);
  const [profileModeState, setProfileModeState] = useState(getProfileMode);
  const [mobileAccountOpen, setMobileAccountOpen] = useState(false);
  const versionLabel = packageJson.version;
  const validTo = new Intl.DateTimeFormat('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${appDataValidity}T12:00:00`));

  const handleLogout = () => {
    clearUser();
    navigate('/login', { replace: true });
  };

  const handleProfileToggle = () => {
    const nextMode = profileModeState === 'admin' ? 'work' : 'admin';
    setProfileMode(nextMode);
    setProfileModeState(nextMode);
    setMobileAccountOpen(false);
    navigate('/dashboard', { replace: true });
  };

  const canSeeApprovals = ['admin', 'reditel', 'schvalovatel', 'specialista', 'approved_viewer'].includes(user?.role ?? '');
  const canApproveReports = ['admin', 'reditel', 'schvalovatel', 'specialista'].includes(user?.role ?? '');
  const canSeeDirectorOverview = user?.role === 'admin' || user?.role === 'reditel';
  const canSeeAdminModules = user?.role === 'admin' || user?.role === 'reditel';
  const canCreateReport = !canSeeApprovals;
  const canUseProfileSwitch = canSwitchProfile(user);
  const mobileUserName = (() => {
    const fullName = user?.full_name ?? 'Nepřihlášený';
    const nameWithoutTitle = fullName.replace(/^(Ing\.|Bc\.|Mgr\.|MUDr\.)\s+/i, '').trim();
    const parts = nameWithoutTitle.split(/\s+/).filter(Boolean);
    if (parts.length >= 2 && nameWithoutTitle.length >= 15) {
      return `${parts[0]} ${parts[parts.length - 1][0]}.`;
    }
    return nameWithoutTitle;
  })();

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
        {canCreateReport ? <NavLink to="/report" end>Výkaz</NavLink> : null}
        {canSeeApprovals ? (
          <div className="nav-group">
            {canApproveReports ? <NavLink to="/approvals" end className="nav-group__parent">Ke schválení <b className="badge-warning">{pendingCount}</b></NavLink> : null}
            <div className="nav-children">
              <NavLink to="/approvals/approved" end>Schválené</NavLink>
            </div>
          </div>
        ) : null}
        {canSeeAdminModules && (
          <>
            {canSeeDirectorOverview ? <NavLink to="/director" end>Přehled ředitelství</NavLink> : null}
            <NavLink to="/users" end>Organizace</NavLink>
            <NavLink to="/dictionaries" end>Číselníky</NavLink>
            <NavLink to="/export" end>Exporty</NavLink>
            <NavLink to="/archive" end>Archiv</NavLink>
          </>
        )}
        <NavLink to="/services" end>Služby</NavLink>
        <NavLink to="/contacts" end>Kontakty</NavLink>
      </nav>
      <nav className="mobile-bottom-nav" aria-label="Mobilní navigace">
        <NavLink to="/dashboard" end>Přehled</NavLink>
        {canCreateReport ? <NavLink to="/report" end>Výkaz</NavLink> : null}
        {canSeeApprovals && (
          <>
            {canApproveReports ? <NavLink to="/approvals">Ke schválení <b className="badge-warning">{pendingCount}</b></NavLink> : null}
            {!canApproveReports ? <NavLink to="/approvals/approved">Schválené</NavLink> : null}
            {canSeeDirectorOverview ? <NavLink to="/director" end>Ředitelství</NavLink> : null}
            {canSeeAdminModules ? <NavLink to="/dictionaries" end>Číselníky</NavLink> : null}
            {canSeeAdminModules ? <NavLink to="/export" end>Exporty</NavLink> : null}
            {canSeeAdminModules ? <NavLink to="/archive" end>Archiv</NavLink> : null}
          </>
        )}
        <NavLink to="/services" end>Služby</NavLink>
        <NavLink to="/contacts" end>Kontakty</NavLink>
      </nav>
      <div className="brand-user">
        <button
          className="mobile-account-button"
          type="button"
          aria-haspopup="menu"
          aria-expanded={mobileAccountOpen}
          aria-label={`Účet ${user?.full_name ?? 'Nepřihlášený uživatel'}`}
          title={user?.full_name ?? 'Nepřihlášený uživatel'}
          onClick={() => setMobileAccountOpen((open) => !open)}
        >
          {mobileUserName}
        </button>
        <span>{user?.full_name ?? 'Nepřihlášený uživatel'}</span>
        {canUseProfileSwitch ? (
          <button className="profile-switch-button" type="button" onClick={handleProfileToggle}>
            {profileModeState === 'admin' ? 'Pracovní profil' : 'Admin profil'}
          </button>
        ) : null}
        <button className="logout-button" type="button" onClick={handleLogout}>Odhlásit se</button>
        {mobileAccountOpen ? (
          <div className="mobile-account-menu" role="menu">
            {canUseProfileSwitch ? (
              <button type="button" role="menuitem" onClick={handleProfileToggle}>
                {profileModeState === 'admin' ? 'Pracovní profil' : 'Admin profil'}
              </button>
            ) : null}
            <button type="button" role="menuitem" onClick={handleLogout}>Odhlásit se</button>
          </div>
        ) : null}
      </div>
      <div className="app-sidebar__version">
        <span>Verze {versionLabel}</span>
        <small>Databáze platná k {validTo}</small>
      </div>
    </aside>
  );
}

export default BrandHeader;
