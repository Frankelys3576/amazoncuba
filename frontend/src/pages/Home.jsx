import React, { useState, useEffect } from 'react';
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

        {/* Primera Fila de Categorías Generales */}
        <div className="home-row">
          <CategoryCard 
            title="Electrónica y Tecnología"
            image="https://images-na.ssl-images-amazon.com/images/G/01/AmazonExports/Fuji/2020/May/Dashboard/Fuji_Dash_Electronics_1x._SY304_CB432774322_.jpg"
            linkText="Explorar"
            linkUrl="/search?category=1"
          />
          <CategoryCard 
            title="Hogar y Electrodomésticos"
            image="https://images-na.ssl-images-amazon.com/images/G/01/AmazonExports/Fuji/2020/May/Dashboard/Fuji_Dash_HomeBedding_Single_Cat_1x._SY304_CB418596953_.jpg"
            linkText="Explorar"
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
