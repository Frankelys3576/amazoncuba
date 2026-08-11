import React, { useState } from 'react';
import { Link, useNavigate, useLocation as useRouterLocation } from 'react-router-dom';
import { Search, ShoppingCart, MapPin, Menu, X, Store } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useLocation } from '../context/LocationContext';
import { cubaLocations } from '../utils/cubaLocations';
import './Navbar.css';

const Navbar = () => {
  const { cartCount } = useCart();
  const { location, updateLocation } = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [showLocationModal, setShowLocationModal] = useState(false);
  
  // Modal internal state
  const [tempProv, setTempProv] = useState(location.province || '');
  const [tempMun, setTempMun] = useState(location.municipality || '');

  const navigate = useNavigate();
  const routerLocation = useRouterLocation();

  // Determinar si estamos en la vista de una tienda específica
  const pathFirstSegment = routerLocation.pathname.split('/')[1] || '';
  const knownMainRoutes = ['', 'cubabnb', 'product', 'cart', 'checkout', 'mis-pedidos', 'negocios', 'search', 'ofertas', 'servicio-cliente', 'vendedor'];
  
  const isStoreView = routerLocation.pathname.startsWith('/negocio/') || (pathFirstSegment && !knownMainRoutes.includes(pathFirstSegment));
  const currentStoreId = routerLocation.pathname.startsWith('/negocio/') 
    ? routerLocation.pathname.split('/')[2] 
    : (pathFirstSegment && !knownMainRoutes.includes(pathFirstSegment) ? pathFirstSegment : null);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      if (isStoreView && currentStoreId) {
        navigate(`/${currentStoreId}?q=${encodeURIComponent(searchQuery.trim())}`);
      } else {
        navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      }
    }
  };
  return (
    <header className="navbar-container">
      {/* Main Nav */}
      <div className={`navbar-main ${isStoreView ? 'store-mode' : ''}`}>
        {/* Logo */}
        <Link to="/" className="nav-logo-link nav-item">
          <div className="nav-logo">AmasonCubano</div>
        </Link>

        {/* Search Bar */}
        <form className="nav-search" onSubmit={handleSearch}>
          {isStoreView && (
            <div className="store-search-badge" style={{display: 'flex', alignItems: 'center', background: '#f3f3f3', padding: '0 10px', borderRight: '1px solid #ddd', color: '#555', fontSize: '13px', fontWeight: 'bold'}}>
              <Store size={14} style={{marginRight: '4px'}}/> Tienda
            </div>
          )}
          <input 
            type="text" 
            placeholder={isStoreView ? "Buscar en esta tienda..." : "Buscar productos, marcas y más..."} 
            className="search-input" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="search-btn">
            <Search size={20} color="#111" />
          </button>
        </form>

        {/* Botón Hostales */}
        <Link to="/cubabnb" className="nav-cubabnb-link" style={{ textDecoration: 'none' }}>
          <span className="text-bold" style={{ color: 'white', padding: '6px 12px', background: '#ff385c', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
            🏡 Hostales
          </span>
        </Link>

        {/* Botón Negocios (Directorio) */}
        <Link to="/negocios" className="nav-stores-link hide-mobile">
          <span className="text-bold" style={{color: 'white', padding: '10px'}}>Negocios</span>
        </Link>

        {/* Account & Lists */}
        <div className="nav-account nav-item">
          <span className="text-small">Hola, Identifícate</span>
          <span className="text-bold">Cuentas y Listas</span>
        </div>

        {/* Returns & Orders */}
        <Link to="/mis-pedidos" className="nav-orders nav-item hide-mobile" style={{textDecoration: 'none'}}>
          <span className="text-small">Cancelaciones</span>
          <span className="text-bold">y Pedidos</span>
        </Link>

        {/* Cart */}
        <Link to="/cart" className="nav-cart nav-item">
          <div className="cart-icon-wrapper">
            <ShoppingCart size={32} />
            <span className="cart-count">{cartCount}</span>
          </div>
          <span className="text-bold cart-label">Carrito</span>
        </Link>

        {/* Botón Vender (Oculto en vista de tienda) - Extremo Derecho */}
        {!isStoreView && (
          <a href="https://seller-cuba-amazon.vercel.app" className="nav-sell-btn hide-mobile" target="_blank" rel="noopener noreferrer" style={{ marginLeft: '10px' }}>
            Vender / Iniciar Sesión
          </a>
        )}
      </div>

      {/* Sub Nav */}
      <div className="navbar-sub">
        <div className="sub-menu-btn">
          <Menu size={20} />
          <span>Todo</span>
        </div>
        
        {/* Location (Interactive) - Oculto en vista de tienda */}
        {!isStoreView && (
          <div className="nav-location nav-item" onClick={() => setShowLocationModal(true)} style={{ marginLeft: '10px' }}>
            <MapPin size={16} />
            <div className="location-text" style={{ padding: '0 4px', lineHeight: '1.2' }}>
              <span className="text-bold location-name" style={{ fontSize: '13px' }}>
                {location.municipality && location.province 
                  ? `${location.municipality}, ${location.province}` 
                  : 'Filtrar por Ubicación'}
              </span>
            </div>
          </div>
        )}

        {isStoreView ? (
          <>
            <Link to={`/${currentStoreId}?filter=bestsellers`}>Lo más vendido</Link>
            <Link to={`/${currentStoreId}?filter=deals`}>Oferta del día</Link>
            <Link to={`/${currentStoreId}?filter=new`}>Nuevos</Link>
          </>
        ) : (
          <>
            <Link to="/negocios">Negocios</Link>
            <Link to="/ofertas">Ofertas del Día</Link>
            <Link to="/servicio-cliente">Servicio al Cliente</Link>
            <Link to="/mis-pedidos" style={{fontWeight: 'bold'}}>Mis Pedidos</Link>
          </>
        )}
      </div>

      {/* Location Modal */}
      {showLocationModal && (
        <div className="location-modal-overlay">
          <div className="location-modal-content">
            <div className="location-modal-header">
              <h3>Elige tu ubicación para buscar</h3>
              <button className="close-btn" onClick={() => setShowLocationModal(false)}>
                <X size={24} />
              </button>
            </div>
            
            <p className="location-modal-desc">
              Las opciones de entrega y velocidad pueden variar según la provincia y municipio seleccionados.
            </p>

            <div className="location-modal-body">
              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Provincia</label>
                <select 
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}
                  value={tempProv}
                  onChange={(e) => {
                    setTempProv(e.target.value);
                    setTempMun(''); // Reset municipality when province changes
                  }}
                >
                  <option value="">-- Selecciona Provincia --</option>
                  {Object.keys(cubaLocations).map(prov => (
                    <option key={prov} value={prov}>{prov}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Municipio</label>
                <select 
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}
                  value={tempMun}
                  onChange={(e) => setTempMun(e.target.value)}
                  disabled={!tempProv}
                >
                  <option value="">-- Selecciona Municipio --</option>
                  {tempProv && cubaLocations[tempProv]?.map(mun => (
                    <option key={mun} value={mun}>{mun}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  style={{ flex: 1, padding: '10px', backgroundColor: '#f0f2f2', border: '1px solid #d5d9d9', borderRadius: '8px', cursor: 'pointer' }}
                  onClick={() => {
                    updateLocation('', '');
                    setShowLocationModal(false);
                  }}
                >
                  Buscar en Todo Cuba
                </button>
                <button 
                  style={{ flex: 1, padding: '10px', backgroundColor: '#ffd814', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: tempProv && tempMun ? 'pointer' : 'not-allowed', opacity: tempProv && tempMun ? 1 : 0.5 }}
                  onClick={() => {
                    if (tempProv && tempMun) {
                      updateLocation(tempProv, tempMun);
                      setShowLocationModal(false);
                    }
                  }}
                  disabled={!tempProv || !tempMun}
                >
                  Aplicar Ubicación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
