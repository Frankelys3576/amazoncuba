import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { getStoreById } from '../services/api';
import { getValidImageUrl, handleImageError } from '../utils/imageUtils';
import ZelleWarningModal from '../components/ZelleWarningModal';
import './Cart.css';

// Mismo tope que el backend (orders.service.ts: MAX_ITEM_QUANTITY).
const MAX_ORDER_QUANTITY = 1000;

// El desplegable anterior solo ofrecía hasta 10 opciones aunque hubiera más
// stock. Un componente aparte (en vez de un solo estado en Cart) porque
// cada fila necesita su propio "borrador" mientras se escribe -- confirmar
// cada tecla contra el contexto del carrito reescribiría el valor a mitad
// de que el cliente todavía está tecleando un número de varios dígitos.
const CartQuantityInput = ({ item, onCommit }) => {
  const maxQuantity = Math.max(1, Math.min(MAX_ORDER_QUANTITY, item.stock || MAX_ORDER_QUANTITY));
  const [draft, setDraft] = useState(String(item.quantity > maxQuantity ? maxQuantity : item.quantity));

  const clamp = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(Math.floor(n), maxQuantity);
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      max={maxQuantity}
      className="quantity-input"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const clamped = clamp(draft);
        setDraft(String(clamped));
        onCommit(item.id, clamped);
      }}
    />
  );
};

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
                        <span className="quantity-control-label">Cant:</span>
                        <CartQuantityInput item={item} onCommit={updateQuantity} />
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
