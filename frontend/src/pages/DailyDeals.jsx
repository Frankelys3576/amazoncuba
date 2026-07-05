import React, { useState, useEffect } from 'react';
import DealProductCard from '../components/DealProductCard';
import { getProducts } from '../services/api';
import './DailyDeals.css';

const DailyDeals = () => {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      // In a real app we would hit a specific /api/deals endpoint
      // For now we get all products and select some random ones to act as deals
      try {
        const allProducts = await getProducts();
        
        // Let's pick 12 products deterministically based on their ID 
        // to act as our "daily deals" so they don't change on every refresh
        const selectedDeals = allProducts.filter(p => p.id % 4 === 0).slice(0, 12);
        
        setDeals(selectedDeals);
      } catch (error) {
        console.error("Error fetching deals:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDeals();
  }, []);

  return (
    <div className="daily-deals-container">
      <div className="deals-header">
        <h1>Ofertas del Día</h1>
        <p>Ahorra a lo grande con ofertas nuevas cada día en CubaAmazon</p>
      </div>
      
      <div className="deals-filters">
        <button className="deal-filter-btn active">Todas las Ofertas</button>
        <button className="deal-filter-btn">Electrónica</button>
        <button className="deal-filter-btn">Hogar</button>
        <button className="deal-filter-btn">Menos de $50</button>
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
