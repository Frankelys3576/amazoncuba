import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getStoreById, getProducts } from '../services/api';
import ProductCard from '../components/ProductCard';
import './StoreDetails.css';

const StoreDetails = () => {
  const { id } = useParams();
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStoreData = async () => {
      const storeData = await getStoreById(id);
      const storeProducts = await getProducts({ storeId: id }); // Pasar storeId a getProducts
      
      setStore(storeData);
      setProducts(storeProducts);
      setLoading(false);
    };
    
    fetchStoreData();
  }, [id]);

  if (loading) return <div className="container" style={{padding: '40px 20px'}}>Cargando tienda...</div>;
  if (!store) return <div className="container" style={{padding: '40px 20px'}}>Tienda no encontrada.</div>;

  return (
    <div className="store-details-page">
      <div 
        className="store-banner" 
        style={{ backgroundImage: `url(${store.banner_url || 'https://via.placeholder.com/1200x300?text=Bienvenido+a+nuestra+tienda'})` }}
      >
        <div className="store-banner-overlay">
          <div className="container store-profile">
            <img 
              src={store.logo_url || 'https://via.placeholder.com/150'} 
              alt={store.name} 
              className="store-profile-logo" 
            />
            <div className="store-profile-info">
              <h1>{store.name}</h1>
              {store.slogan && <h3 className="store-slogan">{store.slogan}</h3>}
              <p>{store.description}</p>
              
              {store.phone && (
                <a 
                  href={`https://wa.me/${store.phone.replace(/[^0-9]/g, '')}?text=Hola%20${encodeURIComponent(store.name)},%20vengo%20de%20CubaAmazon%20y%20tengo%20una%20consulta.`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="store-whatsapp-btn"
                >
                  Contactar por WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container store-products-section">
        <h2 className="store-section-title">Todos los productos de {store.name}</h2>
        
        {products.length === 0 ? (
          <p>Esta tienda aún no tiene productos disponibles.</p>
        ) : (
          <div className="store-products-grid">
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreDetails;
