import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, MapPin, Menu, X } from 'lucide-react';
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

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };
  return (
    <header className="navbar-container">
      {/* Main Nav */}
      <div className="navbar-main">
        {/* Logo */}
        <Link to="/" className="nav-logo-link nav-item">
          <div className="nav-logo">CubaAmazon</div>
        </Link>

        {/* Location (Interactive) */}
        <div className="nav-location nav-item hide-mobile" onClick={() => setShowLocationModal(true)}>
          <MapPin size={18} />
          <div className="location-text">
            <span className="text-small">Buscar en</span>
            <span className="text-bold">
              {location.municipality && location.province 
                ? `${location.municipality}, ${location.province}` 
                : 'Todo Cuba'}
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <form className="nav-search" onSubmit={handleSearch}>
          <input 
            type="text" 
            placeholder="Buscar productos, marcas y más..." 
            className="search-input" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="search-btn">
            <Search size={20} color="#111" />
          </button>
        </form>

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
        <div className="nav-orders nav-item hide-mobile">
          <span className="text-small">Devoluciones</span>
          <span className="text-bold">y Pedidos</span>
        </div>

        {/* Botón Vender */}
        <a href="https://seller-cuba-amazon.vercel.app" className="nav-sell-btn" target="_blank" rel="noopener noreferrer">
          Vender un Producto
        </a>

        {/* Cart */}
        <Link to="/cart" className="nav-cart nav-item">
          <div className="cart-icon-wrapper">
            <ShoppingCart size={32} />
            <span className="cart-count">{cartCount}</span>
          </div>
          <span className="text-bold cart-label">Carrito</span>
        </Link>
      </div>

      {/* Sub Nav */}
      <div className="navbar-sub">
        <div className="sub-menu-btn">
          <Menu size={20} />
          <span>Todo</span>
        </div>
        <Link to="/negocios">Negocios</Link>
        <Link to="/ofertas">Ofertas del Día</Link>
        <Link to="/servicio-cliente">Servicio al Cliente</Link>
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
