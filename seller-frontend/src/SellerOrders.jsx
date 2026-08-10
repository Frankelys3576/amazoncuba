import React, { useState, useEffect } from 'react';
import { Search, Eye, CheckCircle, X, Package, MapPin, Phone, Mail } from 'lucide-react';
import { getStoreOrders, updateOrder } from './services/api';
import './SellerProducts.css';
import './SellerOrders.css';

const SellerOrders = () => {
  const storeId = localStorage.getItem('seller_store_id');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        if (!storeId) return;
        const data = await getStoreOrders(storeId);
        // Format the orders for the UI
        const formattedOrders = data.map(o => {
          let itemsCount = 0;
          let productsList = [];
          
          if (o.order_items) {
            o.order_items.forEach(item => {
              itemsCount += item.quantity;
              productsList.push({
                name: item.products ? item.products.name : `Producto ${item.product_id}`,
                qty: item.quantity,
                price: Number(item.price_at_purchase)
              });
            });
          }

          return {
            id: o.id,
            customer: o.customer_name,
            date: new Date(o.created_at).toLocaleString(),
            total: Number(o.total),
            items: itemsCount,
            status: o.status === 'pending' ? 'Pendiente' : (o.status === 'shipped' ? 'Enviado' : o.status),
            email: o.customer_email,
            phone: o.customer_phone || 'N/A',
            address: o.customer_address,
            products: productsList,
            payment_method: o.payment_method,
            payment_proof_url: o.payment_proof_url,
            rawStatus: o.status
          };
        });
        
        setOrders(formattedOrders);
      } catch (err) {
        console.error('Error fetching orders:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchOrders();
  }, [storeId]);

  const filteredOrders = orders.filter(o => {
    const searchLower = searchTerm.toLowerCase();
    const idStr = o.id.toString();
    const matchesSearch = idStr.includes(searchLower) || o.customer.toLowerCase().includes(searchLower);
                          
    let matchesStatus = true;
    if (statusFilter === 'pending') matchesStatus = o.status === 'Pendiente';
    if (statusFilter === 'shipped') matchesStatus = o.status === 'Enviado';
    if (statusFilter === 'delivered') matchesStatus = o.status === 'Entregado';
    
    return matchesSearch && matchesStatus;
  });

  const markAsDelivered = async (id) => {
    if (window.confirm('¿Estás seguro de marcar este pedido como entregado?')) {
      try {
        await updateOrder(id, 'delivered');
        setOrders(orders.map(o => o.id === id ? { ...o, status: 'Entregada', rawStatus: 'delivered' } : o));
        if (selectedOrder && selectedOrder.id === id) {
          setSelectedOrder({...selectedOrder, status: 'Entregada', rawStatus: 'delivered'});
        }
      } catch (err) {
        alert('Error al actualizar el pedido');
        console.error(err);
      }
    }
  };

  return (
    <div className="seller-orders">
      <div className="seller-page-header">
        <h1 className="seller-page-title">Gestión de Pedidos</h1>
      </div>

      <div className="seller-products-card">
        <div className="seller-products-toolbar">
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Buscar por # de pedido o cliente..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="toolbar-actions">
          </div>
        </div>

        <div className="table-responsive">
          <table className="seller-orders-table">
            <thead>
              <tr>
                <th>ID Pedido</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Artículos</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => (
                <tr key={order.id} onClick={() => setSelectedOrder(order)} style={{cursor: 'pointer'}}>
                  <td data-label="ID Pedido"><strong>{order.id}</strong></td>
                  <td data-label="Cliente">{order.customer}</td>
                  <td data-label="Fecha">{order.date}</td>
                  <td data-label="Artículos">{order.items} art.</td>
                  <td data-label="Total"><span className="product-price">${order.total.toFixed(2)}</span></td>
                  <td data-label="Estado">
                    <span className={`status-badge badge-${order.status === 'Entregada' || order.status === 'delivered' ? 'entregado' : 'pendiente'}`}>
                      {order.status === 'delivered' ? 'Entregada' : (order.status === 'pending' ? 'Pendiente' : order.status)}
                    </span>
                  </td>
                  <td data-label="Acciones">
                    <div className="action-buttons">
                      <button 
                        className="btn-icon" 
                        title="Ver detalles"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan="7" className="empty-table-state">
                    No se encontraron pedidos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalles del Pedido */}
      {selectedOrder && (
        <div className="modal-overlay">
          <div className="modal-content order-details-modal">
            <div className="modal-header">
              <h2>Detalles del Pedido: {selectedOrder.id}</h2>
              <button className="close-btn" onClick={() => setSelectedOrder(null)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="order-details-body">
              <div className="order-status-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span className="status-label">Estado actual:</span>
                  <span className={`status-badge badge-${selectedOrder.status === 'Entregada' || selectedOrder.status === 'delivered' ? 'entregado' : 'pendiente'}`}>
                    {selectedOrder.status === 'delivered' ? 'Entregada' : (selectedOrder.status === 'pending' ? 'Pendiente' : selectedOrder.status)}
                  </span>
                </div>
                {selectedOrder.status !== 'Entregada' && selectedOrder.status !== 'delivered' && (
                  <button 
                    className="btn btn-primary"
                    onClick={() => markAsDelivered(selectedOrder.id)}
                  >
                    <CheckCircle size={16} style={{marginRight: '6px'}}/> Marcar como Entregado
                  </button>
                )}
              </div>

              <div className="order-info-grid">
                <div className="info-card">
                  <h3><MapPin size={18} /> Información del Cliente</h3>
                  <p><strong>{selectedOrder.customer}</strong></p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0' }}>
                    <p style={{ margin: 0 }}><Phone size={14} style={{marginRight: '8px'}} /> {selectedOrder.phone}</p>
                    {selectedOrder.phone && selectedOrder.phone !== 'N/A' && (
                      <a 
                        href={`https://wa.me/53${selectedOrder.phone.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(selectedOrder.customer)},%20te%20escribimos%20sobre%20tu%20pedido%20%23${selectedOrder.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          backgroundColor: '#25D366',
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          textDecoration: 'none',
                          fontWeight: 'bold'
                        }}
                      >
                        💬 Contactar
                      </a>
                    )}
                  </div>
                  <p><Mail size={14} style={{marginRight: '8px'}} /> {selectedOrder.email}</p>
                  <p style={{marginTop: '8px', color: '#4b5563'}}>{selectedOrder.address}</p>
                </div>
                
                <div className="info-card">
                  <h3><Package size={18} /> Resumen del Pedido</h3>
                  <p><strong>Fecha:</strong> {selectedOrder.date}</p>
                  <p><strong>Total de artículos:</strong> {selectedOrder.items}</p>
                  <h2 style={{color: 'var(--brand-primary)', marginTop: '16px'}}>
                    Total: ${selectedOrder.total.toFixed(2)}
                  </h2>
                  <div style={{ marginTop: '15px', background: 'var(--bg-body)', padding: '10px', borderRadius: '6px' }}>
                    <p style={{ margin: '0 0 5px 0' }}><strong>Método de Pago:</strong></p>
                    {selectedOrder.payment_method === 'zelle' ? (
                      <span style={{ display: 'inline-block', background: '#7445c6', color: 'white', padding: '4px 10px', borderRadius: '15px', fontSize: '12px', fontWeight: 'bold' }}>Zelle</span>
                    ) : (
                      <span style={{ display: 'inline-block', background: '#f59e0b', color: 'white', padding: '4px 10px', borderRadius: '15px', fontSize: '12px', fontWeight: 'bold' }}>Efectivo (Cash)</span>
                    )}
                  </div>
                </div>
              </div>
              
              {selectedOrder.payment_method === 'zelle' && selectedOrder.payment_proof_url && (
                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '15px', marginBottom: '15px' }}>
                  <h3 style={{ margin: '0 0 10px 0', color: '#7445c6' }}>Comprobante de Zelle</h3>
                  <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '10px' }}>Verifica visualmente el comprobante de pago subido por el cliente antes de procesar el pedido.</p>
                  <a href={selectedOrder.payment_proof_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                    <img 
                      src={selectedOrder.payment_proof_url} 
                      alt="Comprobante de Zelle" 
                      style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '6px', border: '1px solid #cbd5e1' }} 
                    />
                  </a>
                </div>
              )}

              <div className="order-products-list">
                <h3>Productos Comprados</h3>
                <table className="seller-orders-table" style={{marginTop: '12px'}}>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cantidad</th>
                      <th>Precio Unit.</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.products.map((prod, idx) => (
                      <tr key={idx}>
                        <td data-label="Producto">{prod.name}</td>
                        <td data-label="Cantidad">{prod.qty}</td>
                        <td data-label="Precio Unit.">${prod.price.toFixed(2)}</td>
                        <td data-label="Subtotal"><strong>${(prod.qty * prod.price).toFixed(2)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerOrders;
