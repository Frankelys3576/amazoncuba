import React, { useState, useEffect } from 'react';
import DealProductCard from '../components/DealProductCard';
import { getProducts } from '../services/api';
import './DailyDeals.css';

const DailyDeals = () => {
  const [deals, setDeals] = useState([]);
  const [allDeals, setAllDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    const fetchDeals = async () => {
      // In a real app we would hit a specific /api/deals endpoint
      // For now we get all products and select some random ones to act as deals
      try {
        const allProducts = await getProducts();
        
        // Let's pick 12 products deterministically based on their ID 
        // to act as our "daily deals" so they don't change on every refresh
        const selectedDeals = allProducts.filter(p => p.id % 4 === 0).slice(0, 12);
        
        setAllDeals(selectedDeals);
        setDeals(selectedDeals);
      } catch (error) {
        console.error("Error fetching deals:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDeals();
  }, []);

  const handleFilter = (filter) => {
    setActiveFilter(filter);
    if (filter === 'all') {
      setDeals(allDeals);
    } else if (filter === 'electronica') {
      setDeals(allDeals.filter(p => p.category_id === 1)); // 1 is Electrónica
    } else if (filter === 'hogar') {
      setDeals(allDeals.filter(p => p.category_id === 4)); // 4 is Hogar
    } else if (filter === 'menos50') {
      // Usar precio base (p.price) descontado o solo el p.price base
      // DealProductCard le aplica descuento entre 15 y 40% a p.price
      // Vamos a filtrar sobre el precio original para hacerlo simple
      setDeals(allDeals.filter(p => p.price < 50));
    }
  };

  return (
    <div className="daily-deals-container">
      <div className="deals-header">
        <h1>Ofertas del Día</h1>
        <p>Ahorra a lo grande con ofertas nuevas cada día en CubaAmazon</p>
      </div>
      
      <div className="deals-filters">
        <button 
          className={`deal-filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
          onClick={() => handleFilter('all')}
        >
          Todas las Ofertas
        </button>
        <button 
          className={`deal-filter-btn ${activeFilter === 'electronica' ? 'active' : ''}`}
          onClick={() => handleFilter('electronica')}
        >
          Electrónica
        </button>
        <button 
          className={`deal-filter-btn ${activeFilter === 'hogar' ? 'active' : ''}`}
          onClick={() => handleFilter('hogar')}
        >
          Hogar
        </button>
        <button 
          className={`deal-filter-btn ${activeFilter === 'menos50' ? 'active' : ''}`}
          onClick={() => handleFilter('menos50')}
        >
          Menos de $50
        </button>
      </div>
      
      {loading ? (
        <div className="deals-loading">
          <div className="spinner"></div>
          <p>Buscando las mejores ofertas para ti...</p>
        </div>
      ) : (
        <div className="deals-grid">
          {deals.length > 0 ? (
            deals.map(product => (
              <DealProductCard key={product.id} product={product} />
            ))
          ) : (
            <div className="no-deals">
              <p>No hay ofertas disponibles en este momento. Vuelve más tarde.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DailyDeals;
