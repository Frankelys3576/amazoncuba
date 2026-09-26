import React from 'react';
import { Link } from 'react-router-dom';
import './CategoryCard.css';

// `image` sigue soportado para categorías con foto real (p.ej. las
// secciones propias de una tienda en StoreDetails.jsx, que traen
// cat.image_url). Cuando no hay foto -- como las categorías genéricas del
// home, que antes hotlinkeaban fotos de marketing directo del CDN de
// Amazon.com (images-na.ssl-images-amazon.com), material de un competidor
// servido desde un dominio que no controlamos y que puede bloquear el
// hotlink cuando quiera -- se usa un ícono grande sobre un color de acento
// propio (mismo sistema de colores vivos que los carruseles del home).
const CategoryCard = ({ title, image, icon, accent = 'green', linkText, linkUrl }) => {
  return (
    <div className={`category-card${!image ? ` category-card--${accent}` : ''}`}>
      <Link to={linkUrl || "/"} className="category-card-inner" style={{textDecoration: 'none', color: 'inherit'}}>
        <h2 className="category-card-title">{title}</h2>
        {image ? (
          <div className="category-card-image-container">
            <img src={image} alt={title} className="category-card-image" />
          </div>
        ) : (
          <div className="category-card-icon-container">
            <span className="category-card-icon" aria-hidden="true">{icon}</span>
          </div>
        )}
        <span className="category-card-link">{linkText}</span>
      </Link>
    </div>
  );
};

export default CategoryCard;
