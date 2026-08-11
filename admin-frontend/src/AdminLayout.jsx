import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Store, Users, Settings, LogOut, ShieldAlert, Megaphone, Menu } from 'lucide-react';
import './AdminLayout.css';

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: 'Panel de Control', icon: <LayoutDashboard size={20} /> },
    { path: '/directory', label: 'Usuarios y Negocios', icon: <Users size={20} /> },
    { path: '/marketing', label: 'Marketing (Banners)', icon: <Megaphone size={20} /> },
    { path: '/settings', label: 'Configuración Global', icon: <Settings size={20} /> },
  ];

  return (
    <div className="admin-layout">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}
      
      {/* Sidebar */}
      <aside className={`admin-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <ShieldAlert className="brand-icon" size={24} />
          <h2>amason<span className="logo-cubano" style={{ color: '#ff385c', fontWeight: '300' }}>Cubano</span> <span>Master</span></h2>
        </div>
        
        <nav className="admin-nav">
          {navItems.map((item) => (
            <Link 
              key={item.path}
              to={item.path} 
              className={`admin-nav-link ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
              onClick={() => setIsSidebarOpen(false)}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <button className="btn-logout" onClick={handleLogout}>
            <LogOut size={20} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        <header className="admin-topbar">
          <button className="menu-toggle-btn" onClick={() => setIsSidebarOpen(true)}>
            <Menu size={24} />
          </button>
          <div className="admin-user-info">
            <div className="admin-avatar">A</div>
            <span>Administrador Maestro</span>
          </div>
        </header>
        <div className="admin-page-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
