import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingBag, Settings, LogOut, Store } from 'lucide-react';
import './SellerLayout.css';

const SellerLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [storeName, setStoreName] = useState('Mi Negocio');
  
  useEffect(() => {
    // Check if seller is logged in
    const storeId = localStorage.getItem('seller_store_id');
    if (!storeId) {
      navigate('/login'); // Redirect to login
    }
    // Ideally we would fetch the store name from the API here
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('seller_store_id');
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Resumen' },
    { path: '/products', icon: <Package size={20} />, label: 'Mis Productos' },
    { path: '/orders', icon: <ShoppingBag size={20} />, label: 'Pedidos' },
    { path: '/settings', icon: <Settings size={20} />, label: 'Configuración' },
  ];

  return (
    <div className="seller-layout">
      {/* Sidebar */}
      <aside className="seller-sidebar">
        <div className="seller-sidebar-header">
          <Store className="brand-icon" size={28} />
          <h2>CubaAmazon <span>Seller</span></h2>
        </div>
        
        <div className="seller-store-info">
          <div className="store-avatar">
            {storeName.charAt(0)}
          </div>
          <div className="store-details">
            <span className="store-welcome">Bienvenido,</span>
            <span className="store-name">{storeName}</span>
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
          <div className="topbar-search">
            {/* Opcional: Buscador interno del dashboard */}
          </div>
          <div className="topbar-actions">
            <Link to="/" className="view-store-link" target="_blank">
              Ver tienda pública
            </Link>
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
