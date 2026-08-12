import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { getStoreById } from '../services/api';
import { getValidImageUrl, handleImageError } from '../utils/imageUtils';
import ZelleWarningModal from '../components/ZelleWarningModal';
import './Cart.css';

const Cart = () => {
  const { cart, updateQuantity, removeFromCart, cartTotal, cartCount } = useCart();
  const [isZelleModalOpen, setIsZelleModalOpen] = useState(false);
  const [zelleStorePhone, setZelleStorePhone] = useState(null);
  const [zelleStoreName, setZelleStoreName] = useState(null);

  React.useEffect(() => {
    const checkZelleStores = async () => {
      if (cart.length === 0) return;
      
      // Get unique store IDs from cart
      const storeIds = [...new Set(cart.map(item => item.store_id).filter(Boolean))];
      
      for (const storeId of storeIds) {
        try {
          const storeData = await getStoreById(storeId);
          if (storeData?.accepts_zelle === true) {
            const hasSeenWarning = sessionStorage.getItem(`zelle_warning_${storeId}`);
            if (!hasSeenWarning) {
              setZelleStorePhone(storeData.phone);
              setZelleStoreName(storeData.name);
              setIsZelleModalOpen(true);
              sessionStorage.setItem(`zelle_warning_${storeId}`, 'true');
              break; // Show for the first Zelle store found
            }
          }
        } catch (e) {
          console.error("Error fetching store data", e);
        }
      }
    };
    
    checkZelleStores();
  }, [cart]);

  return (
    <div className="container cart-container">
      <div className="cart-content">
        <div className="cart-items-section">
          <div className="cart-header">
            <h2>Carrito de compras</h2>
            <span className="price-label">Precio</span>
          </div>
          
          {cart.length === 0 ? (
            <div className="empty-cart">
              <p>Tu carrito de AmasonCubano está vacío.</p>
              <Link to="/" className="btn btn-primary" style={{marginTop: '15px'}}>Continuar comprando</Link>
            </div>
          ) : (
            <div className="cart-items-list">
              {cart.map(item => (
                <div key={item.id} className="cart-item">
                  <div className="cart-item-image">
                    <img src={getValidImageUrl(item.image_url)} alt={item.name} onError={handleImageError} />
                  </div>
                  <div className="cart-item-details">
                    <Link to={`/product/${item.id}`} className="cart-item-title">
                      {item.name}
                    </Link>
                    <p className="cart-item-stock">En Stock</p>
                    
                    <div className="cart-item-actions">
                      <div className="quantity-control">
                        <select 
                          value={item.quantity > item.stock ? item.stock : item.quantity}
                          onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                        >
                          {[...Array(Math.min(item.stock, 10)).keys()].map(n => (
                            <option key={n+1} value={n+1}>Qty: {n+1}</option>
                          ))}
                        </select>
                      </div>
                      <span className="separator">|</span>
                      <button className="action-link" onClick={() => removeFromCart(item.id)}>Eliminar</button>
                    </div>
                  </div>
                  <div className="cart-item-price">
                    ${item.price.toFixed(2)} {item.currency || 'USD'}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {cart.length > 0 && (
            <div className="cart-subtotal-bottom">
              Subtotal ({cartCount} productos): <span className="bold-price">${cartTotal.toFixed(2)} {cart[0]?.currency || 'USD'}</span>
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="cart-checkout-section">
            <div className="checkout-panel">
              <div className="checkout-subtotal">
                Subtotal ({cartCount} productos): <br/>
                <span className="bold-price">${cartTotal.toFixed(2)} {cart[0]?.currency || 'USD'}</span>
              </div>
              <Link to="/checkout" className="btn btn-primary" style={{display: 'block', textAlign: 'center', marginTop: '15px', padding: '12px', fontSize: '16px', fontWeight: 'bold'}}>
                Hacer Orden
              </Link>
            </div>
          </div>
        )}
      </div>

      <ZelleWarningModal 
        isOpen={isZelleModalOpen} 
        onClose={() => setIsZelleModalOpen(false)} 
        storePhone={zelleStorePhone}
        storeName={zelleStoreName}
      />
    </div>
  );
};

export default Cart;
