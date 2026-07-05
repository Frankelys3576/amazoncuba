import React from 'react';
import './Hero.css';

const Hero = () => {
  return (
    <div className="hero-container">
      <div className="hero-images">
        {/* Usaremos una imagen representativa de un banner de Amazon de prueba */}
        <img 
          className="hero-image" 
          src="https://images-eu.ssl-images-amazon.com/images/G/30/digital/video/magellan/country/spain/TheBoysS4/TB_S4_2448x3000_ES-ES_SDP_HO_R_7c2bb475-4081-42e7-8178-5e8841434c03.jpg" 
          alt="Banner Amazon" 
        />
      </div>
    </div>
  );
};

export default Hero;
