import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CalendarView from './pages/CalendarView';
import MapView from './pages/MapView';
import Settings from './pages/Settings';
import Chat from './pages/Chat';
import AdminDashboard from './pages/admin/AdminDashboard';
import Layout from './components/Layout';

const ProtectedRoute = ({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (requireAdmin && user.role !== 'ADMIN') return <Navigate to="/" />;
  
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="calendar" element={<CalendarView />} />
            <Route path="map" element={<MapView />} />
            <Route path="settings" element={<Settings />} />
            <Route path="chat" element={<Chat />} />
          </Route>

          <Route path="/admin" element={<ProtectedRoute requireAdmin><Layout isAdmin /></ProtectedRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="chat" element={<Chat />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}
