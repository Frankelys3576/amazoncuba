import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminAuth from './AdminAuth';
import AdminLayout from './AdminLayout';
import AdminDashboard from './AdminDashboard';
import AdminStores from './AdminStores';

// Simple protection
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('admin_token');
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<AdminAuth />} />
        
        <Route 
          path="/" 
          element={
            <PrivateRoute>
              <AdminLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="stores" element={<AdminStores />} />
          <Route path="users" element={<div style={{padding: 20}}>Gestión de Usuarios (Próximamente)</div>} />
          <Route path="settings" element={<div style={{padding: 20}}>Configuración (Próximamente)</div>} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
