import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { getStoreById, getProducts, getStoreCategories } from '../services/api';
import ProductCard from '../components/ProductCard';
import CategoryCard from '../components/CategoryCard';
import ZelleWarningModal from '../components/ZelleWarningModal';
import './StoreDetails.css';

const StoreDetails = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
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

      // Automatically rewrite address bar URL to clean slug amasoncubano.com/slug
      if (storeData.slug && location.pathname !== `/${storeData.slug}`) {
        navigate(`/${storeData.slug}${location.search}`, { replace: true });
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
  }, [id, searchQuery, filterQuery, navigate, location.pathname, location.search]);

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

  const renderHostalView = () => {
    return (
      <div className="hostal-details-page">
        <div className="container" style={{ paddingTop: '20px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '5px' }}>{store.name}</h1>
          <p style={{ color: '#475569', fontSize: '15px', marginBottom: '20px' }}>
            📍 {store.municipality}, {store.province} {store.address ? `- ${store.address}` : ''}
          </p>
          
          <div className="hostal-gallery-grid">
            {store.gallery && store.gallery.length > 0 ? (
              <>
                <img src={store.gallery[0]} className="hostal-gallery-main" alt="Principal" />
                {store.gallery.slice(1, 5).map((img, i) => (
                  <img key={i} src={img} className="hostal-gallery-img" alt={`Galería ${i}`} />
                ))}
              </>
            ) : (
              <img src={store.banner_url || 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1200'} className="hostal-gallery-main" alt="Principal" />
            )}
          </div>
          
          <div className="hostal-layout">
            <div className="hostal-content">
              <h2>Sobre este alojamiento</h2>
              <p style={{ color: '#475569', lineHeight: '1.6', fontSize: '16px' }}>
                {store.description || 'Este hostal aún no ha añadido una descripción.'}
              </p>
              
              <div style={{ margin: '30px 0', borderTop: '1px solid #e2e8f0', paddingTop: '30px' }}>
                <h2>Habitaciones y Servicios</h2>
                {products.length === 0 ? (
                  <p style={{color: '#64748b'}}>No hay habitaciones ni servicios registrados por el momento.</p>
                ) : (
                  <div className="store-products-grid">
                    {products.map(product => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="hostal-sidebar">
              <div className="hostal-booking-card">
                {store.price_per_night ? (
                  <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '15px' }}>
                    ${store.price_per_night} <span style={{fontSize: '14px', fontWeight: 'normal', color: '#64748b'}}>noche</span>
                  </div>
                ) : (
                  <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>
                    Precios a consultar
                  </div>
                )}
                
                {store.phone ? (
                  <a 
                    href={`https://wa.me/${store.phone.replace(/[^0-9]/g, '').startsWith('53') && store.phone.replace(/[^0-9]/g, '').length > 8 ? store.phone.replace(/[^0-9]/g, '') : `53${store.phone.replace(/[^0-9]/g, '')}`}?text=Hola%20${encodeURIComponent(store.name)},%20vengo%20de%20AmasonCubano%20y%20me%20interesa%20su%20alojamiento.`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="btn"
                    style={{ width: '100%', padding: '14px', borderRadius: '8px', fontSize: '16px', background: '#ff385c', border: 'none', color: 'white', textDecoration: 'none', textAlign: 'center', display: 'block', fontWeight: 'bold' }}
                  >
                    Contactar Anfitrión
                  </a>
                ) : (
                  <button className="btn" disabled style={{ width: '100%', padding: '14px', borderRadius: '8px', background: '#cbd5e1', color: 'white', border: 'none' }}>
                    Contacto no disponible
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (store.store_type === 'hostal') {
    return renderHostalView();
  }

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
                  href={`https://wa.me/${store.phone.replace(/[^0-9]/g, '').startsWith('53') && store.phone.replace(/[^0-9]/g, '').length > 8 ? store.phone.replace(/[^0-9]/g, '') : `53${store.phone.replace(/[^0-9]/g, '')}`}?text=Hola%20${encodeURIComponent(store.name)},%20vengo%20de%20AmasonCubano%20y%20me%20interesan%20algunos%20de%20sus%20productos.`}
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
