import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Hero from '../components/Hero';
import CategoryCard from '../components/CategoryCard';
import QuadCategoryCard from '../components/QuadCategoryCard';
import ProductCard from '../components/ProductCard';
import { getProducts } from '../services/api';
import { useLocation } from '../context/LocationContext';
import './Home.css';

const Home = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const { location } = useLocation();

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      const data = await getProducts({
        province: location.province,
        municipality: location.municipality
      });
      setProducts(data);
      setLoading(false);
    };
    fetchProducts();
  }, [location.province, location.municipality]);
  return (
    <div className="home-page">
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

        {/* Banner Promocional CubaBnB */}
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
              Novedad CubaBnB
            </span>
            <h2 style={{ margin: '8px 0 4px 0', fontSize: '24px', fontWeight: 'bold' }}>🏡 Alquiler de Casas y Hostales en Cuba</h2>
            <p style={{ margin: 0, color: '#cbd5e1', fontSize: '14px' }}>Renta hospedajes únicos con mapa interactivo y búsqueda por provincias.</p>
          </div>
          <Link to="/cubabnb" className="btn" style={{ background: '#ff385c', color: 'white', fontWeight: 'bold', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
            Explorar CubaBnB ➔
          </Link>
        </div>

        {/* Primera Fila de Categorías Generales */}
        <div className="home-row">
          <CategoryCard 
            title="Electrónica"
            image="https://images-na.ssl-images-amazon.com/images/G/01/AmazonExports/Fuji/2020/May/Dashboard/Fuji_Dash_Electronics_1x._SY304_CB432774322_.jpg"
            linkText="Explorar"
            linkUrl="/search?category=1"
          />
          <CategoryCard 
            title="Ropa y Accesorios"
            image="https://images-na.ssl-images-amazon.com/images/G/01/AmazonExports/Fuji/2022/February/DashboardCards/GW_CONS_AUS_HPC_HPCEssentials_CatCard_Desktop1x._SY304_CB627424361_.jpg"
            linkText="Ver novedades"
            linkUrl="/search?category=3"
          />
          <CategoryCard 
            title="Hogar y Cocina"
            image="https://images-na.ssl-images-amazon.com/images/G/01/AmazonExports/Fuji/2020/May/Dashboard/Fuji_Dash_HomeBedding_Single_Cat_1x._SY304_CB418596953_.jpg"
            linkText="Explorar"
            linkUrl="/search?category=2"
          />
          <CategoryCard 
            title="Belleza y Cuidado Personal"
            image="https://images-na.ssl-images-amazon.com/images/G/01/AmazonExports/Fuji/2020/May/Dashboard/Fuji_Dash_Beauty_1x._SY304_CB432774351_.jpg"
            linkText="Comprar"
            linkUrl="/search?category=4"
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
