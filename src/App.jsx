import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Sidebar from './components/Layout/Sidebar';
import TopBar from './components/Layout/TopBar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Schedule from './pages/Schedule';
import Jobs from './pages/Jobs';
import Invoices from './pages/Invoices';
import Proposals from './pages/Proposals';
import Technicians from './pages/Technicians';
import ServiceAgreements from './pages/ServiceAgreements';
import Settings from './pages/Settings';

function ProtectedRoute({ children, requiredRole }) {
  const { user, profile, loading, hasRole } = useAuth();
  if (loading) return <div className="loading-page"><div className="loading-spinner" /><span style={{ color: 'var(--text-secondary)' }}>Loading...</span></div>;
  if (!user) return <Navigate to="/login" />;
  if (requiredRole && !hasRole(requiredRole)) return <Navigate to="/" />;
  return children;
}

const pageTitles = {
  '/': 'Dashboard',
  '/customers': 'Customers',
  '/schedule': 'Schedule',
  '/jobs': 'Jobs',
  '/invoices': 'Invoices',
  '/proposals': 'Proposals',
  '/technicians': 'Technicians',
  '/service-agreements': 'Service Plans',
  '/settings': 'Settings',
};

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const path = window.location.pathname;
  const title = pageTitles[path] || 'Yanky\'s HVAC';

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-wrapper">
        <TopBar title={title} onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/invoices" element={<ProtectedRoute requiredRole="office_manager"><Invoices /></ProtectedRoute>} />`n            <Route path="/proposals" element={<ProtectedRoute requiredRole="office_manager"><Proposals /></ProtectedRoute>} />
            <Route path="/technicians" element={<ProtectedRoute requiredRole="office_manager"><Technicians /></ProtectedRoute>} />
            <Route path="/service-agreements" element={<ServiceAgreements />} />
            <Route path="/settings" element={<ProtectedRoute requiredRole="admin"><Settings /></ProtectedRoute>} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function AppRouter() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading-page"><div className="loading-spinner" /><span style={{ color: 'var(--text-secondary)' }}>Loading...</span></div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/*" element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRouter />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

