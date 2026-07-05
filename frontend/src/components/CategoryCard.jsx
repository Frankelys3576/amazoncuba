import React from 'react';
import { Link } from 'react-router-dom';
import './CategoryCard.css';

const CategoryCard = ({ title, image, linkText, linkUrl }) => {
  return (
    <div className="category-card">
      <Link to={linkUrl || "/"} className="category-card-inner" style={{textDecoration: 'none', color: 'inherit'}}>
        <h2 className="category-card-title">{title}</h2>
        <div className="category-card-image-container">
          <img src={image} alt={title} className="category-card-image" />
        </div>
        <span className="category-card-link">{linkText}</span>
      </Link>
    </div>
  );
};

export default CategoryCard;
