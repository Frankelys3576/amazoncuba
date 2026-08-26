import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { createOrder, getStoreById, uploadImage } from '../services/api';
import ZelleWarningModal from '../components/ZelleWarningModal';
import { getOrderTotalDisplay } from '../utils/orderTotals';
import './Checkout.css';

const Checkout = () => {
  const { cart, cartTotal, clearCart } = useCart();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);
  
  const [formData, setFormData] = useState({
    fullName: '',
    address: '',
    municipio: '',
    province: '',
    phone: '',
    paymentMethod: 'cash_on_delivery'
  });

  const [storeZelleInfo, setStoreZelleInfo] = useState(null);
  const [acceptsZelle, setAcceptsZelle] = useState(false);
  const [storePhone, setStorePhone] = useState('');
  const [storeName, setStoreName] = useState('');
  const [zelleReceiptFile, setZelleReceiptFile] = useState(null);
  const [zelleReceiptPreview, setZelleReceiptPreview] = useState('');
  
  const [isZelleModalOpen, setIsZelleModalOpen] = useState(false);
  const [hasSeenCheckoutWarning, setHasSeenCheckoutWarning] = useState(false);

  React.useEffect(() => {
    if (cart.length > 0 && cart[0].store_id) {
      getStoreById(cart[0].store_id).then(store => {
        if (store) {
          setAcceptsZelle(store?.accepts_zelle === true);
          setStoreZelleInfo(store.zelle_info || null);
          setStorePhone(store.phone || '');
          setStoreName(store.name || '');
        }
      }).catch(console.error);
    }
  }, [cart]);

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

    if (acceptsZelle && !hasSeenCheckoutWarning) {
      setIsZelleModalOpen(true);
      setHasSeenCheckoutWarning(true);
      return;
    }

    if (formData.paymentMethod === 'zelle' && !zelleReceiptFile) {
      alert("Debes adjuntar el comprobante de pago Zelle para continuar.");
      return;
    }

    setLoading(true);

    try {
      let payment_proof_url = '';
      if (formData.paymentMethod === 'zelle' && zelleReceiptFile) {
        const uploadRes = await uploadImage(zelleReceiptFile);
        payment_proof_url = uploadRes.url;
      }

      const orderData = {
        customer_name: formData.fullName,
        customer_email: 'correo@ejemplo.com', 
        customer_address: `${formData.address}, ${formData.municipio}, ${formData.province}`,
        customer_phone: formData.phone,
        total: cartTotal,
        payment_method: formData.paymentMethod,
        payment_proof_url,
        items: cart.map(item => ({
          product_id: item.id,
          quantity: item.quantity,
          price: item.price
        }))
      };

      const { totals } = await createOrder(orderData);

      // Fetch store details for cart items if missing (for the receipt and MyOrders)
      const enrichedCart = await Promise.all(cart.map(async (item) => {
        if (!item.store_phone && item.store_id) {
          try {
            // getStoreById ya estaba importado arriba: este fetch traía la URL
            // del backend a mano, saltándose services/api.js, y apuntaba a un
            // despliegue que ya no se actualiza desde main.
            const storeData = await getStoreById(item.store_id);
            if (storeData) {
              return { ...item, store_name: storeData.name, store_phone: storeData.phone };
            }
          } catch (e) {
            console.error("Error fetching store info during checkout", e);
          }
        }
        return item;
      }));
      
      const newOrder = {
        id: Math.random().toString(36).substring(2, 9).toUpperCase(),
        date: new Date().toLocaleString('es-CU'),
        customerInfo: formData,
        items: enrichedCart,
        total: cartTotal,
        totals,
        status: 'pending'
      };

      const currentOrders = JSON.parse(localStorage.getItem('my_orders') || '[]');
      localStorage.setItem('my_orders', JSON.stringify([newOrder, ...currentOrders]));
      
      setCurrentOrder(newOrder);
      setSuccess(true);
    } catch (error) {
      alert("Hubo un error al procesar tu pedido. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const generateReceipt = () => {
    if (!currentOrder) return;
    
    // Asumimos que los productos son de una tienda, extraemos el nombre de la tienda del primer producto si existe
    const storeName = currentOrder.items[0]?.store_name || "La Tienda";
    
    let receiptText = `======================================\n`;
    receiptText += `          RECIBO DE COMPRA          \n`;
    receiptText += `======================================\n`;
    receiptText += `Tienda: ${storeName}\n`;
    receiptText += `Fecha: ${currentOrder.date}\n`;
    receiptText += `Orden ID: #${currentOrder.id}\n\n`;
    receiptText += `DATOS DEL CLIENTE:\n`;
    receiptText += `Nombre: ${currentOrder.customerInfo.fullName}\n`;
    receiptText += `Teléfono: ${currentOrder.customerInfo.phone}\n`;
    receiptText += `Dirección: ${currentOrder.customerInfo.address}\n`;
    receiptText += `Ubicación: ${currentOrder.customerInfo.municipio}, ${currentOrder.customerInfo.province}\n\n`;
    receiptText += `DETALLE DEL PEDIDO:\n`;
    receiptText += `--------------------------------------\n`;
    
    currentOrder.items.forEach(item => {
      receiptText += `${item.quantity}x ${item.name}\n`;
      receiptText += `   Precio unitario: $${item.price.toFixed(2)} ${item.currency || 'USD'}\n`;
    });
    
    receiptText += `--------------------------------------\n`;
    receiptText += `TOTAL: ${getOrderTotalDisplay(currentOrder)}\n`;
    receiptText += `======================================\n`;
    receiptText += `¡Gracias por su compra!\n`;

    const blob = new Blob([receiptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Recibo_Orden_${currentOrder.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    clearCart();
    navigate('/');
  };

  return (
    <div className="container checkout-container" style={{position: 'relative'}}>
      
      {/* SUCCESS MODAL */}
      {success && currentOrder && (
        <div className="success-modal-overlay">
          <div className="success-modal-card">
            <div className="success-icon" style={{fontSize: '48px', color: '#25D366'}}>✅</div>
            <h2 style={{color: '#333'}}>¡Pedido Exitoso!</h2>
            
            <div className="order-summary-box">
              <h3>Resumen de la orden #{currentOrder.id}</h3>
              <ul className="modal-items-list">
                {currentOrder.items.map((item, index) => (
                  <li key={index}>
                    <span>{item.quantity}x {item.name}</span>
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              <div className="modal-total">
                <strong>Total Pagado:</strong>
                <span className="bold-price">{getOrderTotalDisplay(currentOrder)}</span>
              </div>
              
              <div className="modal-customer-info">
                <strong>Enviando a:</strong> {currentOrder.customerInfo.fullName}<br/>
                <strong>Dirección:</strong> {currentOrder.customerInfo.address}, {currentOrder.customerInfo.municipio}, {currentOrder.customerInfo.province}<br/>
                <strong>Teléfono:</strong> {currentOrder.customerInfo.phone}
              </div>
            </div>

            <div className="success-message-dynamic">
              <p><strong>{currentOrder.items[0]?.store_name || "El vendedor"}</strong> se comunicará pronto con usted para coordinar la entrega y el pago.</p>
            </div>

            <div className="modal-actions" style={{display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px'}}>
              <button 
                className="btn" 
                style={{backgroundColor: '#25D366', color: 'white', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', border: 'none'}}
                onClick={() => {
                  const phone = currentOrder.items[0]?.store_phone || '';
                  if (!phone) {
                    alert("No se encontró el teléfono del vendedor. Descargue el recibo y contáctelo.");
                    return;
                  }
                  
                  // Format the WhatsApp message
                  const sellerPanelUrl = window.location.origin.includes('localhost') 
                    ? `http://localhost:3001/orders` 
                    : `https://seller.amasoncubano.com/orders`;
                    
                  let msg = `¡Hola! Me interesa hacer este pedido ahora.\n\n`;
                  msg += `*Orden ID:* #${currentOrder.id}\n`;
                  msg += `*Total a pagar:* ${getOrderTotalDisplay(currentOrder)}\n\n`;
                  msg += `*Mis datos para el envío:*\n`;
                  msg += `Nombre: ${currentOrder.customerInfo.fullName}\n`;
                  msg += `Dirección: ${currentOrder.customerInfo.address}, ${currentOrder.customerInfo.municipio}, ${currentOrder.customerInfo.province}\n`;
                  msg += `Teléfono de contacto: ${currentOrder.customerInfo.phone}\n\n`;
                  msg += `*Artículos:*\n`;
                  currentOrder.items.forEach(item => {
                    msg += `- ${item.quantity}x ${item.name} ($${item.price} c/u)\n`;
                  });
                  msg += `\n📌 *Revisa este pedido en tu panel de vendedor:*\n${sellerPanelUrl}`;
                  
                  // Clean up phone number (remove spaces, plus, etc.)
                  const cleanPhone = phone.replace(/[^0-9]/g, '');
                  window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                Finalizar pedido por WhatsApp
              </button>

              <div style={{display: 'flex', gap: '10px'}}>
                <button className="btn btn-secondary" onClick={generateReceipt} style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#f0f0f0', color: '#333', border: '1px solid #ccc', cursor: 'pointer', padding: '10px', borderRadius: '8px'}}>
                  📄 Descargar recibo
                </button>
                <button className="btn btn-primary" onClick={handleClose} style={{flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer'}}>
                  Volver al inicio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FORMULARIO DE CHECKOUT */}
      <div className="checkout-content" style={{ opacity: success ? 0.3 : 1, pointerEvents: success ? 'none' : 'auto' }}>
        <div className="checkout-form-section">
          <h2>Detalles de Facturación y Envío</h2>
          <form id="checkout-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="fullName">Nombre y Apellidos</label>
              <input type="text" id="fullName" name="fullName" required value={formData.fullName} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="phone">Número de Teléfono</label>
              <input type="tel" id="phone" name="phone" required value={formData.phone} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="address">Dirección de entrega</label>
              <input type="text" id="address" name="address" required value={formData.address} onChange={handleChange} />
            </div>
            
            <div className="form-row">
              <div className="form-group" style={{flex: 1}}>
                <label htmlFor="municipio">Municipio</label>
                <input type="text" id="municipio" name="municipio" required value={formData.municipio} onChange={handleChange} />
              </div>
              <div className="form-group" style={{flex: 1}}>
                <label htmlFor="province">Provincia</label>
                <input type="text" id="province" name="province" required value={formData.province} onChange={handleChange} />
              </div>
            </div>

            <h2 style={{marginTop: '30px'}}>Método de Pago</h2>
            <div className="payment-methods" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label className="payment-option" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: formData.paymentMethod === 'cash_on_delivery' ? '2px solid #3b82f6' : '1px solid #e2e8f0' }}>
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="cash_on_delivery" 
                  checked={formData.paymentMethod === 'cash_on_delivery'}
                  onChange={handleChange}
                />
                <div>
                  <strong>Pago en Efectivo (Cash)</strong>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>Pago al acordar con el vendedor o contra entrega.</div>
                </div>
              </label>

              {acceptsZelle && storeZelleInfo?.name && (
                <label className="payment-option" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: formData.paymentMethod === 'zelle' ? '2px solid #7445c6' : '1px solid #e2e8f0' }}>
                  <input 
                    type="radio" 
                    name="paymentMethod" 
                    value="zelle" 
                    checked={formData.paymentMethod === 'zelle'} 
                    onChange={handleChange} 
                    style={{ marginTop: '5px' }}
                  />
                  <div style={{ width: '100%' }}>
                    <strong style={{ color: '#7445c6' }}>Zelle (Desde EE.UU.)</strong>
                    <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '10px' }}>Transfiere desde tu banco de EE.UU. directamente al vendedor.</div>
                    
                    {formData.paymentMethod === 'zelle' && (
                      <div style={{ background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '10px' }}>
                        <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Información para Transferencia Zelle</h4>
                        <p style={{ margin: '5px 0' }}><strong>Titular:</strong> {storeZelleInfo.name}</p>
                        <p style={{ margin: '5px 0' }}><strong>Zelle (Correo/Tel):</strong> {storeZelleInfo.email_phone}</p>
                        {storeZelleInfo.description && <p style={{ margin: '5px 0', fontSize: '13px', background: '#f0fdf4', padding: '8px', borderRadius: '4px', color: '#166534' }}>{storeZelleInfo.description}</p>}
                        
                        <div style={{ marginTop: '15px' }}>
                          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Sube la foto del comprobante (Requerido) *.png, *.jpg</label>
                          <input 
                            type="file" 
                            accept="image/png, image/jpeg" 
                            onChange={(e) => {
                              if(e.target.files && e.target.files[0]) {
                                setZelleReceiptFile(e.target.files[0]);
                                setZelleReceiptPreview(URL.createObjectURL(e.target.files[0]));
                              }
                            }} 
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
                          />
                          {zelleReceiptPreview && (
                            <img src={zelleReceiptPreview} alt="Comprobante" style={{ marginTop: '10px', height: '100px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #ccc' }} />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </label>
              )}
            </div>
            
            <div className="checkout-form-actions">
              <Link to="/cart" className="btn btn-secondary" style={{flex: 1, textAlign: 'center', backgroundColor: '#f5f5f5', color: '#333', border: '1px solid #ddd', textDecoration: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold'}}>
                Cancelar
              </Link>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={loading}
                style={{flex: 1, padding: '12px', borderRadius: '8px', fontWeight: 'bold'}}
              >
                {loading ? 'Procesando...' : 'Hacer pedido'}
              </button>
            </div>
          </form>
        </div>

        <div className="checkout-summary-section">
          <div className="summary-card">
            <div className="summary-totals">
              <h3>Resumen del pedido</h3>
              <div className="summary-items">
                {cart.map((item, idx) => (
                  <div key={idx} style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: '#555'}}>
                    <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%'}}>{item.quantity}x {item.name}</span>
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <hr style={{margin: '15px 0', border: 'none', borderTop: '1px solid #eee'}} />
              <div className="summary-row total-row">
                <span>Total a Pagar:</span>
                <span className="total-price">${cartTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ZelleWarningModal 
        isOpen={isZelleModalOpen} 
        onClose={() => setIsZelleModalOpen(false)} 
        storePhone={storePhone}
        storeName={storeName}
      />
    </div>
  );
};

export default Checkout;
