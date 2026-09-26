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

  const isReservation = product.description?.startsWith('[RESERVACIÓN]');
  const displayName = isReservation ? product.name.replace(/^\[RESERVACIÓN\]\s*/i, '') : product.name;
  const showZellePrice = (product.store_accepts_zelle || product.stores?.accepts_zelle) && product.price_usd;

  const hasMunicipality = product.municipality && product.municipality !== 'Toda la provincia';
  const hasProvince = product.province && product.province !== 'Toda Cuba';
  const municipalityLabel = hasMunicipality ? product.municipality : (product.province || 'Toda Cuba');
  const provinceSuffix = hasProvince && hasMunicipality ? `, ${product.province}` : '';

  return (
    <div className="product-card" onClick={handleCardClick}>
      <div className="product-card-link">
        <div className="product-card-image-container">
          <img src={imgSrc} onError={handleImageError} alt={product.name} className="product-card-image" />
        </div>
        <div className="product-card-info">
          {isReservation && (
            <span className="product-card-badge product-card-badge--reservation">
              🏡 Estancia / Reservación
            </span>
          )}
          <h3 className="product-card-title">{displayName}</h3>
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
            <span className="price-currency">{product.currency || 'USD'}</span>
            {showZellePrice && (
              <span className="price-zelle">/ ${Number(product.price_usd).toFixed(2)} USD</span>
            )}
          </p>
          <p className="product-card-delivery">
            {isReservation
              ? '🏡 Disponibilidad inmediata en Cuba'
              : product.store_has_delivery
                ? '🚚 Tenemos domicilio'
                : '🏬 Recogida en tienda (No tenemos domicilio)'}
          </p>
          <p className="product-card-location">
            📍 {municipalityLabel}{provinceSuffix}
          </p>
          <button onClick={handleAddToCart} className={`add-to-cart-btn-mobile${isReservation ? ' add-to-cart-btn-mobile--reservation' : ''}`}>
            <ShoppingCart size={16} />
            {isReservation ? 'Reservar' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
