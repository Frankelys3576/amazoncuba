import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { getProducts, getStores } from '../services/api';
import { useCart } from '../context/CartContext';
import './SearchResults.css';

const useQuery = () => {
  return new URLSearchParams(useLocation().search);
};

const SearchResults = () => {
  const query = useQuery();
  const searchQuery = query.get('q');
  const categoryQuery = query.get('category');
  
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();

  const handleAddToCart = (e, product) => {
    e.preventDefault();
    addToCart(product);
  };

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      const params = {};
      if (searchQuery) params.q = searchQuery;
      if (categoryQuery) params.category = categoryQuery;

      const productsData = await getProducts(params);
      
      let storesData = [];
      if (searchQuery) {
        const allStores = await getStores();
        storesData = allStores.filter(store => 
          store.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
          (store.description && store.description.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      }

      // Format items to distinguish types
      const formattedStores = storesData.map(s => ({ ...s, is_store: true }));
      const formattedProducts = productsData.map(p => ({ ...p, is_store: false }));

      setResults([...formattedStores, ...formattedProducts]);
      setLoading(false);
    };

    fetchResults();
  }, [searchQuery, categoryQuery]);

  let title = "Todos los productos";
  if (searchQuery) {
    title = `Resultados para "${searchQuery}"`;
  } else if (categoryQuery) {
    title = `Explorando categoría`;
  }

  return (
    <div className="search-results-page">
      <div className="container">
        <div className="search-header">
          <h1>{title}</h1>
          <p className="results-count">
            {results.length} {results.length === 1 ? 'resultado' : 'resultados'}
          </p>
        </div>

        {loading ? (
          <div className="loading-state">Buscando productos...</div>
        ) : results.length === 0 ? (
          <div className="empty-state">
            <h2>No encontramos resultados para tu búsqueda.</h2>
            <p>Intenta con otras palabras clave o revisa la ortografía.</p>
          </div>
        ) : (
          <div className="search-products-grid">
            {results.map(item => item.is_store ? (
              <div key={`store-${item.id}`} className="search-grid-item" style={{ border: '2px solid #007185', background: '#f0f8ff' }}>
                <Link to={`/negocio/${item.id}`} className="search-grid-image-container" style={{ height: '150px' }}>
                  <img src={item.logo_url} alt={item.name} className="search-grid-image" style={{ objectFit: 'contain' }} />
                </Link>
                <div className="search-grid-details">
                  <div style={{ color: '#007185', fontWeight: 'bold', fontSize: '12px', marginBottom: '5px' }}>
                    🏢 NEGOCIO OFICIAL
                  </div>
                  <Link to={`/negocio/${item.id}`} className="search-grid-title-link">
                    <h2 className="search-grid-title" style={{ fontSize: '18px' }}>{item.name}</h2>
                  </Link>
                  <p style={{ fontSize: '14px', color: '#565959', margin: '10px 0' }}>{item.description}</p>
                  
                  <Link to={`/negocio/${item.id}`} className="btn btn-primary search-grid-cart-btn" style={{marginTop: 'auto', width: '100%', padding: '10px', borderRadius: '20px', fontSize: '14px', textAlign: 'center', display: 'block'}}>
                    Visitar Negocio
                  </Link>
                </div>
              </div>
            ) : (
              <div key={`product-${item.id}`} className="search-grid-item">
                <Link to={`/product/${item.id}`} className="search-grid-image-container">
                  <img src={item.image_url} alt={item.name} className="search-grid-image" />
                </Link>
                <div className="search-grid-details">
                  <Link to={`/product/${item.id}`} className="search-grid-title-link">
                    <h2 className="search-grid-title">{item.name}</h2>
                  </Link>
                  
                  <div className="search-grid-rating">
                    <span className="stars">★★★★☆</span>
                    <i className="a-icon a-icon-popover"></i>
                    <span className="rating-count">{(Math.random() * 2000 + 100).toFixed(0)}</span>
                  </div>
                  
                  <div className="search-grid-price-block">
                    <span className="price-symbol">$</span>
                    <span className="price-whole">{Math.floor(item.price)}</span>
                    <span className="price-fraction">{(item.price % 1).toFixed(2).substring(2)}</span>
                  </div>
                  
                  <div className="search-grid-shipping">
                    Entrega <strong>GRATIS</strong> o entrega más rápida mañana
                  </div>

                  <button 
                    onClick={(e) => handleAddToCart(e, item)} 
                    className="btn btn-primary search-grid-cart-btn"
                    style={{marginTop: 'auto', width: '100%', padding: '10px', borderRadius: '20px', fontSize: '14px', backgroundColor: '#ffd814', borderColor: '#fcd200', color: '#0f1111'}}
                  >
                    Agregar al Carrito
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchResults;
