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
import Login from './pages/Login';
import BrandHeader from './components/BrandHeader';
import { getOrCreateDemoUser } from './utils/auth';

function App() {
  const location = useLocation();
  const user = getOrCreateDemoUser();
  const canSeeApprovals = ['admin', 'reditel', 'schvalovatel', 'specialista'].includes(user?.role ?? '');
  const canSeeDirectorOverview = user?.role === 'admin' || user?.role === 'reditel';
  const canSeeAdminModules = user?.role === 'admin' || user?.role === 'reditel';
  const canCreateReport = !canSeeApprovals;

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
          <Route path="/approvals" element={canSeeApprovals ? <ApprovalDashboard /> : <Navigate to="/dashboard" replace />} />
          <Route path="/approvals/approved" element={canSeeApprovals ? <ApprovalDashboard status="approved" /> : <Navigate to="/dashboard" replace />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/services" element={<ServiceSchedule />} />
          <Route path="/director" element={canSeeDirectorOverview ? <DirectorOverview /> : <Navigate to="/dashboard" replace />} />
          <Route path="/export" element={canSeeAdminModules ? <ExportView /> : <Navigate to="/dashboard" replace />} />
          <Route path="/users" element={canSeeAdminModules ? <UsersView /> : <Navigate to="/dashboard" replace />} />
          <Route path="/dictionaries" element={canSeeAdminModules ? <DictionariesView /> : <Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
