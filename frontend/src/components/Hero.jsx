import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLocation } from '../context/LocationContext';
import { getSettings } from '../services/api';
import './Hero.css';

const Hero = () => {
  const [banners, setBanners] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const { location } = useLocation();

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const settings = await getSettings();
        if (settings.hero_banners) {
          let bannersData = settings.hero_banners;
          if (typeof bannersData === 'string') {
            try {
              bannersData = JSON.parse(bannersData);
            } catch (e) {
              console.error('Error parsing banners:', e);
              bannersData = [];
            }
          }
          if (Array.isArray(bannersData)) {
            const activeBanners = bannersData.filter(b => b.is_active);
            
            const locationFiltered = activeBanners.filter(b => {
              if (!b.target_locations || b.target_locations.length === 0) return true;
              if (b.target_locations.includes('Toda Cuba:Toda Cuba')) return true;
              
              if (location.province && location.municipality) {
                const provMatch = `${location.province}:Toda la provincia`;
                const exactMatch = `${location.province}:${location.municipality}`;
                return b.target_locations.includes(provMatch) || b.target_locations.includes(exactMatch);
              }
              
              // If user has no location set, show global banners only
              return false;
            });
            
            setBanners(locationFiltered);
          }
        }
      } catch (error) {
        console.error('Error fetching hero banners', error);
      }
    };
    fetchBanners();
  }, [location.province, location.municipality]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [banners.length]);

  if (banners.length === 0) {
    return (
      <div className="hero-container">
        <div className="hero-images">
          <img 
            className="hero-image" 
            src="https://images-eu.ssl-images-amazon.com/images/G/30/digital/video/magellan/country/spain/TheBoysS4/TB_S4_2448x3000_ES-ES_SDP_HO_R_7c2bb475-4081-42e7-8178-5e8841434c03.jpg" 
            alt="Banner Amazon" 
          />
        </div>
      </div>
    );
  }

  return (
    <div className="hero-container dynamic-hero">
      <div className="hero-slider" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
        {banners.map((banner) => (
          <div key={banner.id} className="hero-slide">
            <div 
              className="hero-slide-blur-bg" 
              style={{ backgroundImage: `url(${banner.image_url})` }}
            ></div>
            <img src={banner.image_url} alt={banner.title || 'Banner'} className="hero-slide-bg" />
            <div className="hero-slide-overlay"></div>
            <div className="hero-slide-content">
              {banner.title && <h1>{banner.title}</h1>}
              {banner.subtitle && <p>{banner.subtitle}</p>}
              {banner.button_link && banner.button_text && (
                <Link 
                  to={banner.button_link} 
                  className="hero-btn"
                  style={{ 
                    backgroundColor: banner.button_bg_color || '#ff9900',
                    color: banner.button_text_color || '#111111'
                  }}
                >
                  {banner.button_text}
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
      {banners.length > 1 && (
        <div className="hero-indicators">
          {banners.map((_, i) => (
            <button 
              key={i} 
              className={`indicator ${i === currentIndex ? 'active' : ''}`}
              onClick={() => setCurrentIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Hero;
