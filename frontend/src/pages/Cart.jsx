import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import './Cart.css';

const Cart = () => {
  const { cart, updateQuantity, removeFromCart, cartTotal, cartCount } = useCart();
  const [showContactModal, setShowContactModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const openContactModal = (item) => {
    setSelectedProduct(item);
    setShowContactModal(true);
  };

  const closeContactModal = () => {
    setShowContactModal(false);
    setSelectedProduct(null);
  };

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
              <p>Tu carrito de CubaAmazon está vacío.</p>
              <Link to="/" className="btn btn-primary" style={{marginTop: '15px'}}>Continuar comprando</Link>
            </div>
          ) : (
            <div className="cart-items-list">
              {cart.map(item => (
                <div key={item.id} className="cart-item">
                  <div className="cart-item-image">
                    <img src={item.image_url} alt={item.name} />
                  </div>
                  <div className="cart-item-details">
                    <Link to={`/product/${item.id}`} className="cart-item-title">
                      {item.name}
                    </Link>
                    <p className="cart-item-stock">En Stock</p>
                    
                    <div className="cart-item-actions">
                      <div className="quantity-control">
                        <select 
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                        >
                          {[...Array(Math.max(10, item.quantity)).keys()].map(n => (
                            <option key={n+1} value={n+1}>Qty: {n+1}</option>
                          ))}
                        </select>
                      </div>
                      <span className="separator">|</span>
                      <button className="action-link" onClick={() => removeFromCart(item.id)}>Eliminar</button>
                      <span className="separator">|</span>
                      <button className="action-link" style={{color: '#25d366', fontWeight: 'bold'}} onClick={() => openContactModal(item)}>
                        Contactar al Vendedor
                      </button>
                    </div>
                  </div>
                  <div className="cart-item-price">
                    ${item.price.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {cart.length > 0 && (
            <div className="cart-subtotal-bottom">
              Subtotal ({cartCount} productos): <span className="bold-price">${cartTotal.toFixed(2)}</span>
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="cart-checkout-section">
            <div className="checkout-panel">
              <div className="checkout-subtotal">
                Subtotal ({cartCount} productos): <br/>
                <span className="bold-price">${cartTotal.toFixed(2)}</span>
              </div>
              <div style={{marginTop: '15px', fontSize: '13px', color: '#666', lineHeight: '1.4'}}>
                Para concretar tu compra, contacta directamente al vendedor de cada producto usando el botón verde "Contactar al Vendedor" en la lista de artículos.
              </div>
            </div>
          </div>
        )}
      </div>
      {showContactModal && selectedProduct && (
        <div className="contact-modal-overlay" onClick={closeContactModal} style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div className="contact-modal-content" onClick={(e) => e.stopPropagation()} style={{backgroundColor: 'white', padding: '30px', borderRadius: '12px', maxWidth: '400px', width: '90%', textAlign: 'center'}}>
            <h2 style={{marginTop: 0, marginBottom: '20px', color: '#333'}}>Contactar Vendedor</h2>
            <p style={{marginBottom: '30px', color: '#666'}}>¿Cómo prefieres comunicarte con la tienda para adquirir <strong>{selectedProduct.name}</strong>?</p>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
              <a 
                href={`tel:+5350000000`} 
                className="btn" 
                style={{backgroundColor: '#007bff', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'}}
              >
                📞 Llamar por Teléfono
              </a>
              
              <a 
                href={`https://wa.me/5350000000?text=Hola,%20estoy%20interesado%20en%20comprar%20${selectedProduct.quantity}%20unidades%20de:%20${encodeURIComponent(selectedProduct.name)}`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn" 
                style={{backgroundColor: '#25D366', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'}}
              >
                💬 Escribir por WhatsApp
              </a>
            </div>

            <button 
              onClick={closeContactModal} 
              style={{marginTop: '25px', background: 'none', border: 'none', color: '#999', cursor: 'pointer', textDecoration: 'underline'}}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;
