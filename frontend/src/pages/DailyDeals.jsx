import React, { useState, useEffect } from 'react';
import DealProductCard from '../components/DealProductCard';
import { getProducts, getCategories } from '../services/api';
import './DailyDeals.css';
import { idNumber } from '../utils/productId';

// Los botones de filtro están rotulados "Electrónica" y "Hogar"; las
// categorías vienen de la API con su nombre tal cual está en la base de
// datos. Comparamos sin acentos ni mayúsculas para no depender de eso.
const normalizeName = (name) =>
  (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

// Si la categoría no existe en la base de datos no hay nada que mostrar:
// sin esta guarda, comparar contra `undefined` devolvería los productos que
// no tienen categoría asignada.
const filterByCategory = (products, categoryId) =>
  categoryId ? products.filter(p => p.category_id === categoryId) : [];

const DailyDeals = () => {
  const [deals, setDeals] = useState([]);
  const [allDeals, setAllDeals] = useState([]);
  const [categoryIds, setCategoryIds] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    const fetchDeals = async () => {
      // In a real app we would hit a specific /api/deals endpoint
      // For now we get all products and select some random ones to act as deals
      try {
        const [allProducts, categories] = await Promise.all([
          getProducts(),
          getCategories()
        ]);

        // Escogemos 12 productos de forma determinista a partir de su id,
        // para que las ofertas no cambien en cada recarga. `p.id % 4` daba
        // NaN con los UUID v7 y la página se quedaba sin ofertas, así que
        // usamos el último dígito hexadecimal. Funciona igual con los ids
        // enteros de antes de la migración que con los uuid: el frontend y
        // la base de datos se despliegan por separado, así que esta página
        // tiene que servir las dos formas mientras dure la ventana.
        const selectedDeals = allProducts
          .filter(p => p.id != null && idNumber(p.id) % 4 === 0)
          .slice(0, 12);

        // Los filtros por categoría comparaban category_id con 1 y 4, los
        // ids enteros que existían antes de la migración a UUID. Ahora se
        // resuelven por nombre, que es lo que muestran los botones.
        setCategoryIds(
          Object.fromEntries(
            categories.map(cat => [normalizeName(cat.name), cat.id])
          )
        );

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
      setDeals(filterByCategory(allDeals, categoryIds.electronica));
    } else if (filter === 'hogar') {
      setDeals(filterByCategory(allDeals, categoryIds.hogar));
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
        <p>Ahorra a lo grande con ofertas nuevas cada día en AmasonCubano</p>
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
