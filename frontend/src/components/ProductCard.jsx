import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
const ProductCard = ({ product }) => {
  const { addToCart } = useCart();

  const handleAddToCart = (e) => {
    e.preventDefault(); // Prevents navigating to product details when clicking the button
    addToCart(product);
  };

  return (
    <div className="product-card">
      <Link to={`/product/${product.id}`} className="product-card-link">
        <div className="product-card-image-container">
          <img src={product.image_url} alt={product.name} className="product-card-image" />
        </div>
        <div className="product-card-info">
          <h3 className="product-card-title">{product.name}</h3>
          <p className="product-card-price">${product.price.toFixed(2)}</p>
        </div>
      </Link>
      <button onClick={handleAddToCart} className="btn btn-primary add-to-cart-btn">
        Agregar al Carrito
      </button>
    </div>
  );
};

export default ProductCard;
