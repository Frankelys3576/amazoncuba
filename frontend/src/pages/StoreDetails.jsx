import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { getStoreById, getProducts, getStoreCategories } from '../services/api';
import ProductCard from '../components/ProductCard';
import CategoryCard from '../components/CategoryCard';
import ZelleWarningModal from '../components/ZelleWarningModal';
import './StoreDetails.css';

const StoreDetails = () => {
  const { id } = useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const searchQuery = searchParams.get('q');
  const filterQuery = searchParams.get('filter');

  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [storeCategories, setStoreCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isZelleModalOpen, setIsZelleModalOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    
    const fetchStoreData = async () => {
      const storeData = await getStoreById(id);
      
      if (!storeData) {
        setLoading(false);
        return;
      }
      
      const storeProducts = await getProducts({ storeId: storeData.id, q: searchQuery || undefined }); 
      
      setStore(storeData);
      
      // Fetch store categories
      const cats = await getStoreCategories(storeData.id);
      if (cats) setStoreCategories(cats);
      
      // Aplicar filtros locales si existen
      let filteredProducts = storeProducts;
      if (filterQuery === 'bestsellers') {
        // Simular los más vendidos (solo con id par o algo así)
        filteredProducts = storeProducts.filter(p => p.id % 2 === 0);
      } else if (filterQuery === 'deals') {
        // Simular ofertas (productos con precio terminado en .99 o similar, o random)
        filteredProducts = storeProducts.filter(p => p.id % 3 === 0);
      } else if (filterQuery === 'new') {
        // Simular nuevos (los últimos agregados)
        filteredProducts = storeProducts.slice(0, 10);
      }
      
      setProducts(filteredProducts);
      setLoading(false);
      
      if (storeData?.accepts_zelle === true) {
        const hasSeenWarning = sessionStorage.getItem(`zelle_warning_${storeData.id}`);
        if (!hasSeenWarning) {
          setIsZelleModalOpen(true);
          sessionStorage.setItem(`zelle_warning_${storeData.id}`, 'true');
        }
      }
    };
    
    fetchStoreData();
  }, [id, searchQuery, filterQuery]);

  if (loading) return <div className="container" style={{padding: '40px 20px'}}>Cargando tienda...</div>;
  if (!store) return <div className="container" style={{padding: '40px 20px'}}>Tienda no encontrada.</div>;

  // Determinar si la tienda está abierta según el horario
  const checkIsOpen = () => {
    if (store.is_open === false) return false; // Pausa manual
    
    if (!store.opening_time || !store.closing_time) return true; // Por defecto
    
    const now = new Date();
    // Convertir a zona horaria de Cuba (-4 o -5). Para simplificar, usamos la hora local del cliente
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    const [openH, openM] = store.opening_time.split(':').map(Number);
    const [closeH, closeM] = store.closing_time.split(':').map(Number);
    
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    const openTimeMinutes = openH * 60 + (openM || 0);
    const closeTimeMinutes = closeH * 60 + (closeM || 0);
    
    // Si cierra al día siguiente (ej. 18:00 a 02:00)
    if (closeTimeMinutes < openTimeMinutes) {
      return currentTimeMinutes >= openTimeMinutes || currentTimeMinutes <= closeTimeMinutes;
    }
    
    return currentTimeMinutes >= openTimeMinutes && currentTimeMinutes <= closeTimeMinutes;
  };

  const isStoreCurrentlyOpen = checkIsOpen();

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${m} ${ampm}`;
  };

  return (
    <div className="store-details-page">
      <div 
        className="store-banner" 
        style={{ backgroundImage: `url(${store.banner_url || 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1200&q=80'})` }}
      >
        <div className="store-banner-overlay">
          <div className="container store-profile">
            <img 
              src={store.logo_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(store.name) + '&background=random&color=fff&size=150'} 
              alt={store.name} 
              className="store-profile-logo" 
            />
            <div className="store-profile-info">
              <h1>{store.name}</h1>
              {store.slogan && <h3 className="store-slogan">{store.slogan}</h3>}
              <p>{store.description}</p>
              
              <div style={{display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap'}}>
                {store.has_delivery && (
                  <span style={{backgroundColor: '#e0f2fe', color: '#0369a1', padding: '5px 10px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold'}}>
                    🚚 Servicio a Domicilio Disponible
                  </span>
                )}
                <span className={isStoreCurrentlyOpen ? "status-indicator open" : "status-indicator closed"} style={{fontSize: '13px', padding: '5px 10px', borderRadius: '20px', backgroundColor: isStoreCurrentlyOpen ? '#dcfce7' : '#fee2e2'}}>
                  {store.is_open === false ? 'Pausada' : isStoreCurrentlyOpen ? 'Abierto Ahora' : 'Cerrado Ahora'}
                </span>
                
                {store.opening_time && store.closing_time && (
                  <span style={{fontSize: '13px', color: '#fff', backgroundColor: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '20px'}}>
                    🕒 {formatTime(store.opening_time)} - {formatTime(store.closing_time)}
                  </span>
                )}
              </div>
              
              {store.phone && (
                <a 
                  href={`https://wa.me/${store.phone.replace(/[^0-9]/g, '').startsWith('53') && store.phone.replace(/[^0-9]/g, '').length > 8 ? store.phone.replace(/[^0-9]/g, '') : `53${store.phone.replace(/[^0-9]/g, '')}`}?text=Hola%20${encodeURIComponent(store.name)},%20vengo%20de%20CubaAmazon%20y%20me%20interesan%20algunos%20de%20sus%20productos.`}
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
        {(!searchQuery && !filterQuery && !selectedCategoryId && storeCategories.length > 0) ? (
          <>
            <h2 className="store-section-title">Secciones de la Tienda</h2>
            <div className="home-row" style={{marginBottom: '40px'}}>
              {storeCategories.map(cat => (
                <div key={cat.id} onClick={() => setSelectedCategoryId(cat.id)} style={{cursor: 'pointer'}}>
                  <CategoryCard 
                    title={cat.name}
                    image={cat.image_url || 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=400&q=80'}
                    linkText="Ver productos"
                    linkUrl="#" // handled by onClick on wrapper to prevent navigation
                  />
                </div>
              ))}
            </div>
            
            <h2 className="store-section-title">Todos los productos</h2>
            <div className="store-products-grid">
              {products.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <h2 className="store-section-title" style={{margin: 0}}>
                {searchQuery 
                  ? `Resultados para "${searchQuery}" en ${store.name}` 
                  : filterQuery === 'bestsellers' ? `Lo más vendido en ${store.name}`
                  : filterQuery === 'deals' ? `Ofertas del día en ${store.name}`
                  : filterQuery === 'new' ? `Nuevos productos en ${store.name}`
                  : selectedCategoryId ? `Sección: ${storeCategories.find(c => c.id === selectedCategoryId)?.name}`
                  : `Todos los productos de ${store.name}`}
              </h2>
              {selectedCategoryId && (
                <button 
                  onClick={() => setSelectedCategoryId(null)}
                  className="btn btn-secondary"
                  style={{padding: '5px 15px', fontSize: '14px'}}
                >
                  Volver a secciones
                </button>
              )}
            </div>
            
            {products.filter(p => selectedCategoryId ? p.store_category_id === selectedCategoryId : true).length === 0 ? (
              <p>Esta tienda aún no tiene productos en esta sección.</p>
            ) : (
              <div className="store-products-grid">
                {products
                  .filter(p => selectedCategoryId ? p.store_category_id === selectedCategoryId : true)
                  .map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <ZelleWarningModal 
        isOpen={isZelleModalOpen} 
        onClose={() => setIsZelleModalOpen(false)} 
        storePhone={store.phone}
        storeName={store.name}
      />
    </div>
  );
};

export default StoreDetails;
