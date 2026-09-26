import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Hero from '../components/Hero';
import CategoryCard from '../components/CategoryCard';
import ProductCard from '../components/ProductCard';
import { getProducts } from '../services/api';
import { useLocation } from '../context/LocationContext';
import './Home.css';

// Los enlaces de categoría de esta página llevaban ids legacy ("1", "2",
// "3", "4") de antes de la migración a uuid v7 -- ProductsService.findAll
// pasa ese valor tal cual a `where.category_id`, una columna uuid, así que
// Prisma tiraba un error de tipo y /search?category=1 respondía 500 en vez
// de una lista de productos (o vacía). Estos son los uuid reales de
// public.categories a día de hoy; si esas filas se vuelven a crear (otra
// migración, un reseed), estos valores hay que actualizarlos a mano.
const CATEGORY_IDS = {
  electronica: '01a03bc3-8639-7bb8-82f1-6dd5d09433f7',
  hogar: '01a03bc3-863b-7e33-a6f7-7f7ca79b4106',
  bellezaYCuidadoPersonal: '01a03bc3-863b-7fb9-a760-78463876f72c',
};

const Home = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const { location } = useLocation();

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      const data = await getProducts({
        province: location.province,
        municipality: location.municipality,
        requireImage: true
      });
      setProducts(data);
      setLoading(false);
    };
    fetchProducts();
  }, [location.province, location.municipality]);
  return (
    <div className="home-page">
      {/* Barra de acceso rápido desde el inicio */}
      <div className="home-quick-bar" style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '6px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
      }}>
        <Link to="/cubabnb" style={{
          background: '#ff385c',
          color: 'white',
          padding: '6px 12px',
          borderRadius: '16px',
          fontWeight: '800',
          fontSize: '12px',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          boxShadow: '0 2px 6px rgba(255, 56, 92, 0.3)'
        }}>
          🏡 Hostales
        </Link>
        <Link to="/negocios" style={{ background: '#f1f5f9', color: '#1e293b', padding: '6px 10px', borderRadius: '16px', fontWeight: 'bold', fontSize: '12px', textDecoration: 'none' }}>
          🏪 Negocios
        </Link>
        <Link to="/ofertas" style={{ background: '#f1f5f9', color: '#1e293b', padding: '8px 14px', borderRadius: '20px', fontWeight: 'bold', fontSize: '13px', textDecoration: 'none' }}>
          🔥 Ofertas del Día
        </Link>
        <Link to={`/search?category=${CATEGORY_IDS.electronica}`} style={{ background: '#f1f5f9', color: '#1e293b', padding: '8px 14px', borderRadius: '20px', fontWeight: '500', fontSize: '13px', textDecoration: 'none' }}>
          📱 Electrónica
        </Link>
        <Link to={`/search?category=${CATEGORY_IDS.hogar}`} style={{ background: '#f1f5f9', color: '#1e293b', padding: '8px 14px', borderRadius: '20px', fontWeight: '500', fontSize: '13px', textDecoration: 'none' }}>
          🏠 Hogar
        </Link>
      </div>

      <Hero />
      <div className="home-content">
        {/* Carousel: Lo más vendido hoy */}
        {!loading && products.length > 0 && (
          <div className="home-carousel-section">
            <h2 className="home-carousel-title">Lo más vendido hoy</h2>
            <div className="home-carousel">
              {products.slice(0, 6).map(product => (
                <ProductCard key={`vendido-${product.id}`} product={product} />
              ))}
            </div>
          </div>
        )}

        {/* Banner Promocional CubaBnB (Oculto temporalmente a petición)
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #ff385c 100%)',
          borderRadius: '16px',
          padding: '24px 30px',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
          marginBottom: '25px',
          boxShadow: '0 4px 20px rgba(255, 56, 92, 0.2)'
        }}>
          <div>
            <span style={{ background: '#ff385c', color: 'white', fontSize: '12px', fontWeight: 'bold', padding: '4px 10px', borderRadius: '12px', textTransform: 'uppercase' }}>
              Novedad CubaAirbnb
            </span>
            <h2 style={{ margin: '8px 0 4px 0', fontSize: '24px', fontWeight: 'bold' }}>🏡 Alquiler de Casas y Hostales (CubaAirbnb)</h2>
            <p style={{ margin: 0, color: '#cbd5e1', fontSize: '14px' }}>Renta hospedajes únicos con mapa interactivo y búsqueda por provincias.</p>
          </div>
          <Link to="/cubabnb" className="btn" style={{ background: '#ff385c', color: 'white', fontWeight: 'bold', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
            Explorar CubaAirbnb ➔
          </Link>
        </div>
        */}

        {/* Primera Fila de Categorías Generales. Antes hotlinkeaba fotos de
            marketing directo del CDN de Amazon.com -- material de un
            competidor en un dominio que no controlamos. Estas son fotos de
            stock (Unsplash) por categoría en su lugar. */}
        <div className="home-row">
          <CategoryCard
            title="Electrónica"
            image="https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=400&q=80"
            linkText="Explorar"
            linkUrl={`/search?category=${CATEGORY_IDS.electronica}`}
          />
          <CategoryCard
            title="Ropa y Accesorios"
            image="https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=400&q=80"
            linkText="Ver novedades"
            // No existe todavía una categoría real "Ropa y Accesorios" --
            // por ahora apunta a donde esos productos SÍ están archivados
            // (chancletas, guantes, pasamontañas), hasta que se decida crear
            // la categoría propia.
            linkUrl={`/search?category=${CATEGORY_IDS.bellezaYCuidadoPersonal}`}
          />
          <CategoryCard
            title="Hogar y Cocina"
            image="https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=400&q=80"
            linkText="Explorar"
            linkUrl={`/search?category=${CATEGORY_IDS.hogar}`}
          />
          <CategoryCard
            title="Belleza y Cuidado Personal"
            image="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=400&q=80"
            linkText="Comprar"
            linkUrl={`/search?category=${CATEGORY_IDS.bellezaYCuidadoPersonal}`}
          />
        </div>

        {/* Carousel: Productos populares */}
        {!loading && products.length > 2 && (
          <div className="home-carousel-section">
            <h2 className="home-carousel-title">Productos populares</h2>
            <div className="home-carousel">
              {[...products].reverse().slice(0, 8).map(product => (
                <ProductCard key={`popular-${product.id}`} product={product} />
              ))}
            </div>
          </div>
        )}

        {/* Carousel: Ofertas Especiales */}
        {!loading && products.length > 4 && (
          <div className="home-carousel-section">
            <h2 className="home-carousel-title">Ofertas Especiales</h2>
            <div className="home-carousel">
              {[...products].sort(() => 0.5 - Math.random()).slice(0, 6).map(product => (
                <ProductCard key={`oferta-${product.id}`} product={product} />
              ))}
            </div>
          </div>
        )}

        {/* Dynamic Products Section */}
        <div className="home-section-title">
          <h2>Artículos que te pudieran interesar</h2>
        </div>
        
        {loading ? (
          <p>Cargando productos...</p>
        ) : (
          <div className="home-products-grid">
            {products.map(product => (
              <ProductCard key={`interes-${product.id}`} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
