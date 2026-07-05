import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, MapPin, Menu } from 'lucide-react';
import { useCart } from '../context/CartContext';
import './Navbar.css';

const Navbar = () => {
  const { cartCount } = useCart();
  const [searchQuery, setSearchQuery] = useState('');
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

        {/* Location (Mock) */}
        <div className="nav-location nav-item hide-mobile">
          <MapPin size={18} />
          <div className="location-text">
            <span className="text-small">Enviar a</span>
            <span className="text-bold">La Habana, Cuba</span>
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
    </header>
  );
};

export default Navbar;
