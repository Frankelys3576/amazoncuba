import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingBag, Settings, LogOut, Store, Menu, X, ExternalLink, FolderTree } from 'lucide-react';
import { getStoreById } from './services/api';
import './SellerLayout.css';

const getClientStoreUrl = (id) => {
  if (import.meta.env.PROD) return `https://www.amasoncubano.com/negocio/${id}`;
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `http://${window.location.hostname}:5173/negocio/${id}`;
  }
  return `http://localhost:5173/negocio/${id}`;
};

const SellerLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sellerName, setSellerName] = useState('Vendedor');
  const [storeId, setStoreId] = useState(null);
  const [storeNumber, setStoreNumber] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [storeType, setStoreType] = useState('business');
  
  useEffect(() => {
    // Check if seller is logged in
    const id = localStorage.getItem('seller_store_id');
    const name = localStorage.getItem('seller_name');
    
    if (!id) {
      navigate('/login'); // Redirect to login
    } else {
      setStoreId(id);
      if (name) setSellerName(name);
      
      getStoreById(id).then(storeData => {
         if (storeData) {
            if (storeData.store_number) setStoreNumber(storeData.store_number);
            if (storeData.store_type) setStoreType(storeData.store_type);
         }
      }).catch(err => console.error(err));
    }
  }, [navigate]);

  // Close sidebar on route change in mobile
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('seller_store_id');
    localStorage.removeItem('seller_token');
    localStorage.removeItem('seller_name');
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Resumen' },
    { path: '/products', icon: <Package size={20} />, label: storeType === 'hostal' ? 'Habitaciones' : 'Mis Productos' },
    ...(storeType !== 'hostal' ? [{ path: '/categories', icon: <FolderTree size={20} />, label: 'Secciones' }] : []),
    { path: '/orders', icon: <ShoppingBag size={20} />, label: 'Pedidos' },
    { path: '/profile', icon: <Store size={20} />, label: 'Mi Tienda' },
    { path: '/settings', icon: <Settings size={20} />, label: 'Configuración' },
  ];

  return (
    <div className="seller-layout">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* Sidebar */}
      <aside className={`seller-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="seller-sidebar-header">
          <Store className="brand-icon" size={28} />
          <h2>AmasonCubano <span>Seller</span></h2>
          <button className="mobile-close-btn" onClick={() => setIsSidebarOpen(false)}>
            <X size={24} />
          </button>
        </div>
        
        <div className="seller-store-info">
          <div className="store-avatar">
            {sellerName.charAt(0).toUpperCase()}
          </div>
          <div className="store-details">
            <span className="store-welcome">Bienvenido,</span>
            <span className="store-name">{sellerName}</span>
          </div>
        </div>

        <nav className="seller-nav">
          <ul>
            {navItems.map((item) => (
              <li key={item.path}>
                <Link 
                  to={item.path} 
                  className={`seller-nav-link ${location.pathname === item.path ? 'active' : ''}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="seller-sidebar-footer">
          <button onClick={handleLogout} className="seller-logout-btn">
            <LogOut size={20} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="seller-main-content">
        <header className="seller-topbar">
          <div className="topbar-mobile-left" style={{ display: 'flex', alignItems: 'center' }}>
            <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            {storeNumber && (
              <div style={{ marginLeft: '12px', background: '#e0e7ff', color: '#4f46e5', padding: '4px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: 'bold', border: '1px solid #c7d2fe', whiteSpace: 'nowrap' }}>
                Vendedor: {storeNumber}
              </div>
            )}
          </div>
          <div className="topbar-actions">
            <a 
              href={getClientStoreUrl(storeId)}
              className="view-store-link" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <span className="desktop-text">Ver tienda pública</span>
              <span className="mobile-text">Ver tienda</span>
              <ExternalLink size={16} />
            </a>
          </div>
        </header>
        
        <div className="seller-page-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default SellerLayout;
