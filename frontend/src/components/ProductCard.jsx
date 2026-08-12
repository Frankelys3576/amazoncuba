import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { Star, ShoppingCart } from 'lucide-react';
import { getValidImageUrl, handleImageError } from '../utils/imageUtils';
import './ProductCard.css';

const ProductCard = ({ product }) => {
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/product/${product.id}`);
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product);
  };

  const rating = product.rating_avg || 0;
  const reviewCount = product.review_count || 0;
  const imgSrc = getValidImageUrl(product.image_url);

  return (
    <div className="product-card" onClick={handleCardClick} style={{ cursor: 'pointer' }}>
      <div className="product-card-link">
        <div className="product-card-image-container">
          <img src={imgSrc} onError={handleImageError} alt={product.name} className="product-card-image" />
        </div>
        <div className="product-card-info">
          {product.description?.startsWith('[RESERVACIÓN]') && (
            <span style={{ fontSize: '11px', fontWeight: 'bold', background: '#ffe4e6', color: '#e11d48', padding: '2px 6px', borderRadius: '10px', display: 'inline-block', marginBottom: '4px' }}>
              🏡 Estancia / Reservación
            </span>
          )}
          <h3 className="product-card-title">{product.description?.startsWith('[RESERVACIÓN]') ? product.name.replace(/^\[RESERVACIÓN\]\s*/i, '') : product.name}</h3>
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
            {(product.store_accepts_zelle || product.stores?.accepts_zelle) && product.price_usd && (
              <span style={{ fontSize: '14px', color: '#B12704', marginLeft: '8px' }}>
                / ${Number(product.price_usd).toFixed(2)} USD
              </span>
            )}
          </p>
          <p className="product-card-delivery">
            {product.description?.startsWith('[RESERVACIÓN]') ? '🏡 Disponibilidad inmediata en Cuba' : 'Envío GRATIS a Cuba'}
          </p>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            📍 {product.municipality && product.municipality !== 'Toda la provincia' ? product.municipality : (product.province || 'Toda Cuba')}
            {product.province && product.province !== 'Toda Cuba' && product.municipality && product.municipality !== 'Toda la provincia' ? `, ${product.province}` : ''}
          </p>
          <button onClick={handleAddToCart} className="add-to-cart-btn-mobile" style={{ backgroundColor: product.description?.startsWith('[RESERVACIÓN]') ? '#ff385c' : undefined, color: product.description?.startsWith('[RESERVACIÓN]') ? 'white' : undefined }}>
            <ShoppingCart size={16} />
            {product.description?.startsWith('[RESERVACIÓN]') ? 'Reservar' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
