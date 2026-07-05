import React, { useState, useEffect } from 'react';
import Hero from '../components/Hero';
import CategoryCard from '../components/CategoryCard';
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
        
        <div className="home-row">
          <CategoryCard 
            title="Juguetes y Juegos"
            image="https://images-na.ssl-images-amazon.com/images/G/01/AmazonExports/Fuji/2021/September/DashboardCards/Fuji_Dash_Toys_1X._SY304_CB639759658_.jpg"
            linkText="Comprar ahora"
            linkUrl="/search?category=5"
          />
          <CategoryCard 
            title="Salud y Cuidado Personal"
            image="https://images-na.ssl-images-amazon.com/images/G/01/AmazonExports/Fuji/2022/February/DashboardCards/GW_CONS_AUS_HPC_HPCEssentials_CatCard_Desktop1x._SY304_CB627424361_.jpg"
            linkText="Comprar ahora"
            linkUrl="/search?category=6"
          />
          <CategoryCard 
            title="Para tu Mascota"
            image="https://images-na.ssl-images-amazon.com/images/G/01/AmazonExports/Fuji/2021/September/DashboardCards/Fuji_Dash_Pets_1X._SY304_CB639746743_.jpg"
            linkText="Ver más"
            linkUrl="/search?category=7"
          />
          <CategoryCard 
            title="Fitness"
            image="https://images-na.ssl-images-amazon.com/images/G/01/AmazonExports/Fuji/2021/September/DashboardCards/Fuji_Dash_Fitness_1X._SY304_CB639748186_.jpg"
            linkText="Explorar más"
            linkUrl="/search?category=8"
          />
        </div>
        
        {/* Dynamic Products Section */}
        <div className="home-section-title">
          <h2>Recomendado para ti</h2>
        </div>
        
        {loading ? (
          <p>Cargando productos...</p>
        ) : (
          <div className="home-products-grid">
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
