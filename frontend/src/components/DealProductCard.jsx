import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import './DealProductCard.css';

const DealProductCard = ({ product }) => {
  const { addToCart } = useCart();
  
  // Simulated discount logic (15% to 40%)
  // Using the product id to generate a consistent but pseudo-random discount
  const discountPercentage = 15 + ((product.id * 7) % 25);
  
  const originalPrice = product.price / (1 - (discountPercentage / 100));

  const handleAddToCart = (e) => {
    e.preventDefault();
    addToCart(product);
  };

  return (
    <div className="deal-card">
      <Link to={`/product/${product.id}`} className="deal-card-link">
        <div className="deal-image-container">
          <img src={product.image_url} alt={product.name} className="deal-image" />
        </div>
        <div className="deal-info">
          <div className="deal-badge-row">
            <span className="deal-badge">Oferta del día</span>
          </div>
          <div className="deal-price-row">
            <span className="deal-price-discount">-{discountPercentage}%</span>
            <span className="deal-price-current">${product.price.toFixed(2)}</span>
          </div>
          <div className="deal-price-original">
            Precio típico: <span>${originalPrice.toFixed(2)}</span>
          </div>
          <h3 className="deal-title">{product.name}</h3>
        </div>
      </Link>
      <button onClick={handleAddToCart} className="btn btn-primary add-to-cart-btn">
        Agregar al Carrito
      </button>
    </div>
  );
};

export default DealProductCard;
