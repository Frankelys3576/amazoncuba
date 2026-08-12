import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getOrdersByIds, updateOrder } from '../services/api';
import { getValidImageUrl, handleImageError } from '../utils/imageUtils';
import './MyOrders.css';

const MyOrders = () => {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const savedOrders = JSON.parse(localStorage.getItem('my_orders') || '[]');
    setOrders(savedOrders);

    if (savedOrders.length > 0) {
      const orderIds = savedOrders.map(o => o.id);
      getOrdersByIds(orderIds).then(updatedOrders => {
        if (updatedOrders && updatedOrders.length > 0) {
          const newSavedOrders = savedOrders.map(localOrder => {
            const remoteOrder = updatedOrders.find(ro => ro.id === localOrder.id);
            if (remoteOrder) {
              return { ...localOrder, status: remoteOrder.status };
            }
            return localOrder;
          });
          setOrders(newSavedOrders);
          localStorage.setItem('my_orders', JSON.stringify(newSavedOrders));
        }
      });
    }
  }, []);

  const markAsReceived = async (id) => {
    try {
      if (window.confirm('¿Confirmas que has recibido esta orden?')) {
        await updateOrder(id, 'delivered');
        
        // Update local state
        const savedOrders = JSON.parse(localStorage.getItem('my_orders') || '[]');
        const newSavedOrders = savedOrders.map(o => o.id === id ? { ...o, status: 'delivered' } : o);
        setOrders(newSavedOrders);
        localStorage.setItem('my_orders', JSON.stringify(newSavedOrders));
      }
    } catch (error) {
      alert('Hubo un error al actualizar el estado.');
      console.error(error);
    }
  };

  const downloadReceipt = (order) => {
    const storeName = order.items[0]?.store_name || "La Tienda";
    
    let receiptText = `======================================\n`;
    receiptText += `          RECIBO DE COMPRA          \n`;
    receiptText += `======================================\n`;
    receiptText += `Tienda: ${storeName}\n`;
    receiptText += `Fecha: ${order.date}\n`;
    receiptText += `Orden ID: #${order.id}\n\n`;
    receiptText += `DATOS DEL CLIENTE:\n`;
    receiptText += `Nombre: ${order.customerInfo.fullName}\n`;
    receiptText += `Teléfono: ${order.customerInfo.phone}\n`;
    receiptText += `Dirección: ${order.customerInfo.address}\n`;
    receiptText += `Ubicación: ${order.customerInfo.municipio}, ${order.customerInfo.province}\n\n`;
    receiptText += `DETALLE DEL PEDIDO:\n`;
    receiptText += `--------------------------------------\n`;
    
    order.items.forEach(item => {
      receiptText += `${item.quantity}x ${item.name}\n`;
      receiptText += `   Precio unitario: $${item.price.toFixed(2)} ${item.currency || 'USD'}\n`;
    });
    
    receiptText += `--------------------------------------\n`;
    receiptText += `TOTAL: $${order.total.toFixed(2)} USD\n`;
    receiptText += `======================================\n`;
    receiptText += `¡Gracias por su compra!\n`;

    const blob = new Blob([receiptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Recibo_Orden_${order.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (orders.length === 0) {
    return (
      <div className="container my-orders-empty">
        <h2>Mis Pedidos</h2>
        <div className="empty-state-box">
          <p>No tienes ningún pedido registrado en este dispositivo.</p>
          <Link to="/" className="btn btn-primary" style={{marginTop: '20px'}}>Empezar a comprar</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container my-orders-container">
      <h2>Mis Pedidos</h2>
      <p style={{color: '#666', marginBottom: '30px'}}>
        Historial de compras realizadas desde este dispositivo. (Si borras los datos del navegador, este historial se perderá).
      </p>

      <div className="orders-list">
        {orders.map((order, index) => (
          <div key={index} className="order-card">
            <div className="order-header">
              <div className="order-header-info">
                <span className="order-date">Realizado el: {order.date}</span>
                <span className="order-id">Orden #{order.id}</span>
              </div>
              <div className="order-status">
                <span className={`status-badge status-${order.status || 'pending'}`}>
                  {order.status === 'delivered' ? 'Entregada' : 'Pendiente'}
                </span>
              </div>
            </div>
            
            <div className="order-body">
              <div className="order-products">
                <h4>Productos ({order.items.length})</h4>
                <div className="products-preview">
                  {order.items.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="product-preview-item">
                      <img src={getValidImageUrl(item.image_url)} alt={item.name} onError={handleImageError} />
                      <div className="product-preview-details">
                        <span className="product-name">{item.name}</span>
                        <span className="product-qty-price">{item.quantity} x ${item.price}</span>
                      </div>
                    </div>
                  ))}
                  {order.items.length > 3 && (
                    <div className="more-products">
                      + {order.items.length - 3} más...
                    </div>
                  )}
                </div>
              </div>
              <div className="order-summary-mini">
                <div className="summary-row">
                  <span>Total:</span>
                  <span className="bold-price">${order.total.toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span>Enviado a:</span>
                  <span>{order.customerInfo.fullName}</span>
                </div>
                
                <div style={{marginTop: '15px', padding: '10px', backgroundColor: '#e8f5e9', borderRadius: '8px', border: '1px solid #c8e6c9'}}>
                  <p style={{fontSize: '12px', color: '#2e7d32', marginBottom: '8px', fontWeight: 'bold'}}>
                    Vendedor ({order.items[0]?.store_name || "Tienda"}):<br/>
                    {order.items[0]?.store_phone || "No disponible"}
                  </p>
                  
                  {order.items[0]?.store_phone && (
                    <div style={{display: 'flex', gap: '8px'}}>
                      <a 
                        href={`tel:+53${order.items[0].store_phone.replace(/\D/g, '')}`} 
                        className="btn btn-secondary" 
                        style={{flex: 1, padding: '8px 5px', fontSize: '12px', textAlign: 'center', color: '#333', border: '1px solid #ccc', textDecoration: 'none'}}
                      >
                        📞 Llamar
                      </a>
                      <a 
                        href={`https://wa.me/53${order.items[0].store_phone.replace(/\D/g, '')}?text=Hola,%20les%20escribo%20sobre%20mi%20pedido%20%23${order.id}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="btn" 
                        style={{flex: 1, padding: '8px 5px', fontSize: '12px', textAlign: 'center', backgroundColor: '#25D366', color: 'white', border: '1px solid #25D366', textDecoration: 'none'}}
                      >
                        💬 WhatsApp
                      </a>
                    </div>
                  )}
                </div>
                <div style={{display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px'}}>
                  <button 
                    className="btn btn-secondary btn-download" 
                    onClick={() => downloadReceipt(order)}
                  >
                    📄 Descargar Recibo
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyOrders;
