import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { getProducts } from '../services/api';
import { useCart } from '../context/CartContext';
import './SearchResults.css';

const useQuery = () => {
  return new URLSearchParams(useLocation().search);
};

const SearchResults = () => {
  const query = useQuery();
  const searchQuery = query.get('q');
  const categoryQuery = query.get('category');
  
  const [products, setProducts] = useState([]);
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

      const data = await getProducts(params);
      setProducts(data);
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
            {products.length} {products.length === 1 ? 'resultado' : 'resultados'}
          </p>
        </div>

        {loading ? (
          <div className="loading-state">Buscando productos...</div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <h2>No encontramos resultados para tu búsqueda.</h2>
            <p>Intenta con otras palabras clave o revisa la ortografía.</p>
          </div>
        ) : (
          <div className="search-products-grid">
            {products.map(product => (
              <div key={product.id} className="search-grid-item">
                <Link to={`/product/${product.id}`} className="search-grid-image-container">
                  <img src={product.image_url} alt={product.name} className="search-grid-image" />
                </Link>
                <div className="search-grid-details">
                  <Link to={`/product/${product.id}`} className="search-grid-title-link">
                    <h2 className="search-grid-title">{product.name}</h2>
                  </Link>
                  
                  <div className="search-grid-rating">
                    <span className="stars">★★★★☆</span>
                    <i className="a-icon a-icon-popover"></i>
                    <span className="rating-count">{(Math.random() * 2000 + 100).toFixed(0)}</span>
                  </div>
                  
                  <div className="search-grid-price-block">
                    <span className="price-symbol">$</span>
                    <span className="price-whole">{Math.floor(product.price)}</span>
                    <span className="price-fraction">{(product.price % 1).toFixed(2).substring(2)}</span>
                  </div>
                  
                  <div className="search-grid-shipping">
                    Entrega <strong>GRATIS</strong> o entrega más rápida mañana
                  </div>

                  <button 
                    onClick={(e) => handleAddToCart(e, product)} 
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
