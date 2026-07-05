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
      
      {/* Container that overlaps the hero banner */}
      <div className="home-content">
        
        {/* Carousel: Ofertas del día */}
        {!loading && products.length > 0 && (
          <div className="home-carousel-section">
            <h2 className="home-carousel-title">Ofertas del día</h2>
            <div className="home-carousel">
              {products.slice(0, 6).map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}

        {/* First Row of Categories */}
        <div className="home-row">
          <CategoryCard 
            title="Electrónica"
            image="https://images-na.ssl-images-amazon.com/images/G/01/AmazonExports/Fuji/2020/May/Dashboard/Fuji_Dash_Electronics_1x._SY304_CB432774322_.jpg"
            linkText="Comprar ahora"
            linkUrl="/search?category=1"
          />
          <CategoryCard 
            title="Computadoras y Accesorios"
            image="https://images-na.ssl-images-amazon.com/images/G/01/AmazonExports/Fuji/2020/May/Dashboard/Fuji_Dash_PC_1x._SY304_CB431800965_.jpg"
            linkText="Comprar ahora"
            linkUrl="/search?category=2"
          />
          <CategoryCard 
            title="Belleza y Cuidado Personal"
            image="https://images-na.ssl-images-amazon.com/images/G/01/AmazonExports/Fuji/2020/May/Dashboard/Fuji_Dash_Beauty_1x._SY304_CB432774351_.jpg"
            linkText="Comprar ahora"
            linkUrl="/search?category=3"
          />
          <CategoryCard 
            title="Hogar y Cocina"
            image="https://images-na.ssl-images-amazon.com/images/G/01/AmazonExports/Fuji/2020/May/Dashboard/Fuji_Dash_HomeBedding_Single_Cat_1x._SY304_CB418596953_.jpg"
            linkText="Explorar más"
            linkUrl="/search?category=4"
          />
        </div>

        {/* Carousel: Tendencias Internacionales */}
        {!loading && products.length > 5 && (
          <div className="home-carousel-section">
            <h2 className="home-carousel-title">Tendencias Internacionales</h2>
            <div className="home-carousel">
              {products.slice(5, 12).map(product => (
                <ProductCard key={`trend-${product.id}`} product={product} />
              ))}
            </div>
          </div>
        )}
        
        {/* Second Row of Categories (Quad Cards) */}
        <div className="home-row">
          <QuadCategoryCard 
            title="Mercancía oficial de fútbol"
            linkText="Compra más equipo"
            items={[
              { label: 'Balones', image: 'https://images-na.ssl-images-amazon.com/images/G/01/AMAZON_FASHION/2022/CORE/MAJORS/SUMMER/FANSHOP/L1/CAT_FANSHOP_L1_3_2.jpg' },
              { label: 'Camisetas', image: 'https://images-na.ssl-images-amazon.com/images/G/01/AMAZON_FASHION/2022/CORE/MAJORS/SUMMER/FANSHOP/L1/CAT_FANSHOP_L1_1_2.jpg' },
              { label: 'Estados Unidos', image: 'https://images-na.ssl-images-amazon.com/images/G/01/AMAZON_FASHION/2022/CORE/MAJORS/SUMMER/FANSHOP/L1/CAT_FANSHOP_L1_2_2.jpg' },
              { label: 'Coleccionables', image: 'https://images-na.ssl-images-amazon.com/images/G/01/AMAZON_FASHION/2022/CORE/MAJORS/SUMMER/FANSHOP/L1/CAT_FANSHOP_L1_4_2.jpg' }
            ]}
          />
          <QuadCategoryCard 
            title="Moda de verano para mujer"
            linkText="Ve todos los estilos"
            items={[
              { label: 'Vestidos', image: 'https://images-na.ssl-images-amazon.com/images/G/01/AMAZON_FASHION/2022/SITE_FLIPS/SPR_22/GW/DQC/DQC_APR_TBYB_W_BOTTOMS_1x._SY116_CB624172947_.jpg' },
              { label: 'Zapatos', image: 'https://images-na.ssl-images-amazon.com/images/G/01/AMAZON_FASHION/2022/SITE_FLIPS/SPR_22/GW/DQC/DQC_APR_TBYB_W_SHOES_1x._SY116_CB624172947_.jpg' },
              { label: 'Accesorios', image: 'https://images-na.ssl-images-amazon.com/images/G/01/AMAZON_FASHION/2022/SITE_FLIPS/SPR_22/GW/DQC/DQC_APR_TBYB_W_ACCESSORIES_1x._SY116_CB624172947_.jpg' },
              { label: 'Trajes de baño', image: 'https://images-na.ssl-images-amazon.com/images/G/01/AMAZON_FASHION/2022/SITE_FLIPS/SPR_22/GW/DQC/DQC_APR_TBYB_W_DRESSES_1x._SY116_CB624172947_.jpg' }
            ]}
          />
          <QuadCategoryCard 
            title="Imprescindibles de verano"
            linkText="Esenciales para viajar"
            items={[
              { label: 'Básico de cabina', image: 'https://images-na.ssl-images-amazon.com/images/G/01/home/THILGMA/SummerEvent2023/XCM_CUTTLE_1553945_3194091_372x232_en_US._SY116_CB589700349_.jpg' },
              { label: 'Botiquín', image: 'https://images-na.ssl-images-amazon.com/images/G/01/home/THILGMA/SummerEvent2023/XCM_CUTTLE_1553945_3194090_372x232_en_US._SY116_CB589700349_.jpg' },
              { label: 'Neceser', image: 'https://images-na.ssl-images-amazon.com/images/G/01/home/THILGMA/SummerEvent2023/XCM_CUTTLE_1553945_3194086_372x232_en_US._SY116_CB589700349_.jpg' },
              { label: 'Aperitivos', image: 'https://images-na.ssl-images-amazon.com/images/G/01/home/THILGMA/SummerEvent2023/XCM_CUTTLE_1553945_3194087_372x232_en_US._SY116_CB589700349_.jpg' }
            ]}
          />
          <QuadCategoryCard 
            title="Soluciones para espacios pequeños"
            linkText="Compra muebles y decoración"
            items={[
              { label: 'Muebles', image: 'https://images-na.ssl-images-amazon.com/images/G/01/home/THILGMA/RoomDecor/XCM_CUTTLE_1555541_3203924_372x232_en_US._SY116_CB588820616_.jpg' },
              { label: 'Decoración', image: 'https://images-na.ssl-images-amazon.com/images/G/01/home/THILGMA/RoomDecor/XCM_CUTTLE_1555541_3203923_372x232_en_US._SY116_CB588820616_.jpg' },
              { label: 'Organización', image: 'https://images-na.ssl-images-amazon.com/images/G/01/home/THILGMA/RoomDecor/XCM_CUTTLE_1555541_3203925_372x232_en_US._SY116_CB588820616_.jpg' },
              { label: 'Iluminación', image: 'https://images-na.ssl-images-amazon.com/images/G/01/home/THILGMA/RoomDecor/XCM_CUTTLE_1555541_3203926_372x232_en_US._SY116_CB588820616_.jpg' }
            ]}
          />
        </div>

        {/* Carousel: Los Más Vendidos en Cocina y Comedor */}
        {!loading && products.length > 0 && (
          <div className="home-carousel-section">
            <h2 className="home-carousel-title">Los Más Vendidos en Cocina y Comedor</h2>
            <div className="home-carousel">
              {[...products].reverse().slice(0, 8).map(product => (
                <ProductCard key={`cocina-${product.id}`} product={product} />
              ))}
            </div>
          </div>
        )}

        {/* Carousel: Los Más Vendidos en Computadoras y Accesorios */}
        {!loading && products.length > 0 && (
          <div className="home-carousel-section">
            <h2 className="home-carousel-title">Los Más Vendidos en Computadoras y Accesorios</h2>
            <div className="home-carousel">
              {products.slice(4, 12).map(product => (
                <ProductCard key={`compu-${product.id}`} product={product} />
              ))}
            </div>
          </div>
        )}

        {/* Carousel: Los Más Vendidos en Comida Gourmet y Alimentos */}
        {!loading && products.length > 0 && (
          <div className="home-carousel-section">
            <h2 className="home-carousel-title">Los Más Vendidos en Comida Gourmet y Alimentos</h2>
            <div className="home-carousel">
              {[...products].sort(() => 0.5 - Math.random()).slice(0, 8).map(product => (
                <ProductCard key={`gourmet-${product.id}`} product={product} />
              ))}
            </div>
          </div>
        )}

        {/* Carousel: Los Más Vendidos en Libros */}
        {!loading && products.length > 0 && (
          <div className="home-carousel-section">
            <h2 className="home-carousel-title">Los Más Vendidos en Libros</h2>
            <div className="home-carousel">
              {products.slice(0, 8).map(product => (
                <ProductCard key={`libros-${product.id}`} product={product} />
              ))}
            </div>
          </div>
        )}
        
        {/* Dynamic Products Section */}
        <div className="home-section-title">
          <h2>Descubre más productos</h2>
        </div>
        
        {loading ? (
          <p>Cargando productos...</p>
        ) : (
          <div className="home-products-grid">
            {products.map(product => (
              <ProductCard key={`grid-${product.id}`} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
