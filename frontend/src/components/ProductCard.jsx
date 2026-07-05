import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { Star, ShoppingCart } from 'lucide-react';
import './ProductCard.css';

const ProductCard = ({ product }) => {
  const { addToCart } = useCart();

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product);
  };

  // Generate a fake rating between 3.5 and 5.0
  const rating = (3.5 + (product.id % 15) * 0.1).toFixed(1);
  const reviewCount = 50 + (product.id * 7) % 500;

  return (
    <div className="product-card">
      <Link to={`/product/${product.id}`} className="product-card-link">
        <div className="product-card-image-container">
          <img src={product.image_url} alt={product.name} className="product-card-image" />
        </div>
        <div className="product-card-info">
          <h3 className="product-card-title">{product.name}</h3>
          <div className="product-card-rating">
            <div className="stars">
              {[1,2,3,4,5].map(i => (
                <Star 
                  key={i} 
                  size={14} 
                  className={i <= Math.round(parseFloat(rating)) ? 'star-filled' : 'star-empty'} 
                />
              ))}
            </div>
            <span className="review-count">{reviewCount.toLocaleString()}</span>
          </div>
          <p className="product-card-price">
            <span className="price-symbol">$</span>
            <span className="price-whole">{Math.floor(product.price)}</span>
            <span className="price-fraction">{((product.price % 1) * 100).toFixed(0).padStart(2, '0')}</span>
            <span style={{ fontSize: '12px', color: '#565959', marginLeft: '4px', verticalAlign: 'top' }}>{product.currency || 'USD'}</span>
          </p>
          <p className="product-card-delivery">Envío GRATIS a Cuba</p>
          <button onClick={handleAddToCart} className="add-to-cart-btn-mobile">
            <ShoppingCart size={16} />
            Agregar
          </button>
        </div>
      </Link>
    </div>
  );
};

export default ProductCard;
