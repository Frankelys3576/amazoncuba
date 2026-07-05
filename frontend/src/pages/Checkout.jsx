import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { createOrder } from '../services/api';
import './Checkout.css';

const Checkout = () => {
  const { cart, cartTotal, clearCart } = useCart();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    address: '',
    city: '',
    phone: '',
    paymentMethod: 'cash_on_delivery'
  });

  if (cart.length === 0 && !success) {
    return (
      <div className="container checkout-empty">
        <h2>Tu carrito está vacío</h2>
        <Link to="/">Volver al inicio</Link>
      </div>
    );
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const orderData = {
        customer_name: formData.fullName,
        customer_email: 'correo@ejemplo.com', // Por ahora hardcodeado hasta que haya auth
        customer_address: `${formData.address}, ${formData.city}`,
        total: cartTotal,
        items: cart.map(item => ({
          product_id: item.id,
          quantity: item.quantity,
          price: item.price
        }))
      };

      await createOrder(orderData);
      
      setSuccess(true);
      clearCart();
    } catch (error) {
      alert("Hubo un error al procesar tu pedido. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="container checkout-success">
        <div className="success-icon">✓</div>
        <h2>¡Pedido Confirmado!</h2>
        <p>Tu pedido ha sido registrado con éxito en CubaAmazon.</p>
        <p>Te contactaremos al <strong>{formData.phone}</strong> para coordinar la entrega.</p>
        <Link to="/" className="btn btn-primary" style={{marginTop: '20px'}}>Volver a la tienda</Link>
      </div>
    );
  }

  return (
    <div className="container checkout-container">
      <div className="checkout-content">
        <div className="checkout-form-section">
          <h2>Dirección de Envío</h2>
          <form id="checkout-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="fullName">Nombre Completo</label>
              <input type="text" id="fullName" name="fullName" required value={formData.fullName} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="address">Dirección de entrega (Reparto, Calle, Número)</label>
              <input type="text" id="address" name="address" required value={formData.address} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="city">Municipio / Provincia</label>
              <input type="text" id="city" name="city" required value={formData.city} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="phone">Teléfono de contacto</label>
              <input type="tel" id="phone" name="phone" required value={formData.phone} onChange={handleChange} />
            </div>

            <h2 style={{marginTop: '30px'}}>Método de Pago</h2>
            <div className="payment-methods">
              <label className="payment-option">
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="cash_on_delivery" 
                  checked={formData.paymentMethod === 'cash_on_delivery'}
                  onChange={handleChange}
                />
                <span>Pago contra entrega (Efectivo/Transfermóvil)</span>
              </label>
            </div>
          </form>
        </div>

        <div className="checkout-summary-section">
          <div className="summary-card">
            <button 
              type="submit" 
              form="checkout-form" 
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading ? 'Procesando...' : 'Confirmar Pedido'}
            </button>
            
            <div className="summary-totals">
              <h3>Resumen del pedido</h3>
              <div className="summary-row">
                <span>Productos:</span>
                <span>${cartTotal.toFixed(2)}</span>
              </div>
              <div className="summary-row">
                <span>Envío:</span>
                <span>$0.00</span>
              </div>
              <div className="summary-row total-row">
                <span>Total:</span>
                <span className="total-price">${cartTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
