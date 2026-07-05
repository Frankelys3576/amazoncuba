import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getStores } from '../services/api';
import './StoresList.css';

const StoresList = () => {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStores = async () => {
      const data = await getStores();
      setStores(data);
      setLoading(false);
    };
    fetchStores();
  }, []);

  if (loading) return <div className="container" style={{padding: '40px 20px'}}>Cargando directorio de negocios...</div>;

  return (
    <div className="stores-list-page">
      <div className="stores-header">
        <h1>Directorio de Negocios</h1>
        <p>Descubre las mejores tiendas y vendedores en CubaAmazon</p>
      </div>

      <div className="container stores-grid">
        {stores.map(store => (
          <Link to={`/negocio/${store.id}`} key={store.id} className="store-card">
            <div className="store-card-banner" style={{ backgroundImage: `url(${store.banner_url})` }}></div>
            <div className="store-card-content">
              <div className="store-logo-wrapper">
                <img src={store.logo_url} alt={store.name} className="store-logo" />
              </div>
              <h2 className="store-title">{store.name}</h2>
              <p className="store-desc">{store.description}</p>
              <span className="store-visit-btn">Visitar tienda</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default StoresList;
