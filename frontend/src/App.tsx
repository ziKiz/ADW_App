import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ReportForm from './pages/ReportForm';
import ApprovalDashboard from './pages/ApprovalDashboard';
import ExportView from './pages/ExportView';
import UsersView from './pages/UsersView';
import DictionariesView from './pages/DictionariesView';
import Contacts from './pages/Contacts';
import ServiceSchedule from './pages/ServiceSchedule';
import DirectorOverview from './pages/DirectorOverview';
import ArchiveView from './pages/ArchiveView';
import Login from './pages/Login';
import BrandHeader from './components/BrandHeader';
import client, { hasHttpStatus, isLiveMode } from './api/client';
import { clearUser, getOrCreateDemoUser, saveUser } from './utils/auth';
import packageJson from '../package.json';

function App() {
  const location = useLocation();
  const [, setSessionRevision] = useState(0);
  const user = getOrCreateDemoUser();
  const canSeeApprovals = ['admin', 'reditel', 'schvalovatel', 'specialista', 'approved_viewer'].includes(user?.role ?? '');
  const canApprove = ['admin', 'reditel', 'schvalovatel', 'specialista'].includes(user?.role ?? '');
  const canSeeDirectorOverview = user?.role === 'admin' || user?.role === 'reditel';
  const canSeeAdminModules = user?.role === 'admin' || user?.role === 'reditel';
  const canExportReports = canSeeAdminModules || user?.role === 'approved_viewer';
  const canCreateReport = !canSeeApprovals;

  useEffect(() => {
    if (!isLiveMode || !user?.access_token) return;
    let cancelled = false;
    client.get('/auth/me')
      .then((response) => {
        if (cancelled) return;
        saveUser({ ...response.data, access_token: user.access_token, token_type: user.token_type ?? 'bearer' });
        setSessionRevision((revision) => revision + 1);
      })
      .catch((error) => {
        if (!cancelled && hasHttpStatus(error, [401])) {
          clearUser();
          setSessionRevision((revision) => revision + 1);
        }
      });
    return () => { cancelled = true; };
  }, [user?.access_token]);

  useEffect(() => {
    if (!isLiveMode) return;
    let cancelled = false;
    const checkVersion = async () => {
      try {
        const response = await fetch(`/api/health?ts=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok || cancelled) return;
        const health = await response.json() as { version?: string };
        if (!health.version || health.version === packageJson.version) return;
        const reloadKey = `adw-reloaded-for-${health.version}`;
        if (sessionStorage.getItem(reloadKey) === '1') return;
        sessionStorage.setItem(reloadKey, '1');
        window.location.reload();
      } catch {
        // Během krátkého restartu serveru zůstane aktuální obrazovka použitelná.
      }
    };
    checkVersion();
    const intervalId = window.setInterval(checkVersion, 60_000);
    const handleFocus = () => checkVersion();
    window.addEventListener('focus', handleFocus);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  if (!user && location.pathname !== '/login') {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className={location.pathname === '/login' ? 'app-shell app-shell--login' : 'app-shell'}>
      {location.pathname !== '/login' ? <BrandHeader /> : null}
      <main>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/report" element={canCreateReport ? <ReportForm /> : <Navigate to="/dashboard" replace />} />
          <Route path="/approvals" element={canApprove ? <ApprovalDashboard /> : canSeeApprovals ? <Navigate to="/approvals/approved" replace /> : <Navigate to="/dashboard" replace />} />
          <Route path="/approvals/approved" element={canSeeApprovals ? <ApprovalDashboard status="approved" /> : <Navigate to="/dashboard" replace />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/services" element={<ServiceSchedule />} />
          <Route path="/director" element={canSeeDirectorOverview ? <DirectorOverview /> : <Navigate to="/dashboard" replace />} />
          <Route path="/export" element={canExportReports ? <ExportView /> : <Navigate to="/dashboard" replace />} />
          <Route path="/archive" element={canSeeAdminModules ? <ArchiveView /> : <Navigate to="/dashboard" replace />} />
          <Route path="/users" element={canSeeAdminModules ? <UsersView /> : <Navigate to="/dashboard" replace />} />
          <Route path="/dictionaries" element={canSeeAdminModules ? <DictionariesView /> : <Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
