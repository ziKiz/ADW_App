import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ReportForm from './pages/ReportForm';
import ApprovalDashboard from './pages/ApprovalDashboard';
import ExportView from './pages/ExportView';
import UsersView from './pages/UsersView';
import DictionariesView from './pages/DictionariesView';
import Login from './pages/Login';
import BrandHeader from './components/BrandHeader';
import { getOrCreateDemoUser } from './utils/auth';

function App() {
  const location = useLocation();
  const user = getOrCreateDemoUser();

  if (!user && location.pathname !== '/login') {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="app-shell">
      {location.pathname !== '/login' ? <BrandHeader /> : null}
      <main>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/report" element={<ReportForm />} />
          <Route path="/approvals" element={<ApprovalDashboard />} />
          <Route path="/approvals/approved" element={<ApprovalDashboard status="approved" />} />
          <Route path="/export" element={<ExportView />} />
          <Route path="/users" element={<UsersView />} />
          <Route path="/dictionaries" element={<DictionariesView />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
