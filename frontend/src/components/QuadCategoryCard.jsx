import React from 'react';
import { Link } from 'react-router-dom';
import './QuadCategoryCard.css';

const QuadCategoryCard = ({ title, items, linkText, linkUrl }) => {
  return (
    <div className="quad-category-card">
      <h2 className="quad-category-card-title">{title}</h2>
      <div className="quad-grid">
        {items.map((item, index) => (
          <Link to={item.linkUrl || linkUrl || "/"} key={index} className="quad-item">
            <div className="quad-image-container">
              <img src={item.image} alt={item.label} className="quad-image" />
            </div>
            <span className="quad-label">{item.label}</span>
          </Link>
        ))}
      </div>
      <Link to={linkUrl || "/"} className="quad-category-card-link">{linkText}</Link>
    </div>
  );
};

export default QuadCategoryCard;
