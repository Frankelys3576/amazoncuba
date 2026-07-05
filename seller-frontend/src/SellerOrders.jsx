import React, { useState } from 'react';
import { Search, Eye, CheckCircle, X, Package, MapPin, Phone, Mail } from 'lucide-react';
// import './SellerProducts.css'; // Usamos estilos similares a products y dashboard
import './SellerOrders.css';

const SellerOrders = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  // Datos simulados para pedidos con más detalles
  const [orders, setOrders] = useState([
    { 
      id: 'ORD-001', customer: 'Carlos Martínez', date: '2026-07-05 10:42 AM', total: 45.00, items: 2, status: 'Pendiente',
      email: 'carlos@example.com', phone: '+53 51234567', address: 'Calle 23 #123, Vedado, La Habana',
      products: [{ name: 'Café Cubita 250g', qty: 2, price: 22.50 }]
    },
    { 
      id: 'ORD-002', customer: 'Ana González', date: '2026-07-05 09:15 AM', total: 120.50, items: 1, status: 'Enviado',
      email: 'ana@example.com', phone: '+53 59876543', address: 'Ave. 41 #4102, Playa, La Habana',
      products: [{ name: 'Ventilador Recargable', qty: 1, price: 120.50 }]
    },
    { 
      id: 'ORD-003', customer: 'Roberto Fernández', date: '2026-07-04 16:30 PM', total: 32.00, items: 4, status: 'Entregado',
      email: 'roberto@example.com', phone: '+53 54443322', address: 'Calle San Rafael #45, Centro Habana',
      products: [{ name: 'Jabón de baño', qty: 4, price: 8.00 }]
    },
    { 
      id: 'ORD-004', customer: 'Elena Sánchez', date: '2026-07-04 14:20 PM', total: 89.99, items: 1, status: 'Pendiente',
      email: 'elena@example.com', phone: '+53 52221100', address: 'Calle 100 #200, Marianao',
      products: [{ name: 'Licuadora Oster', qty: 1, price: 89.99 }]
    },
    { 
      id: 'ORD-005', customer: 'Miguel Díaz', date: '2026-07-03 11:10 AM', total: 210.00, items: 3, status: 'Entregado',
      email: 'miguel@example.com', phone: '+53 55556677', address: 'Calle Línea #98, Vedado, La Habana',
      products: [{ name: 'Arrocera 1.5L', qty: 1, price: 150.00 }, { name: 'Frijoles Negros 1kg', qty: 2, price: 30.00 }]
    },
  ]);

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          o.customer.toLowerCase().includes(searchTerm.toLowerCase());
                          
    let matchesStatus = true;
    if (statusFilter === 'pending') matchesStatus = o.status === 'Pendiente';
    if (statusFilter === 'shipped') matchesStatus = o.status === 'Enviado';
    if (statusFilter === 'delivered') matchesStatus = o.status === 'Entregado';
    
    return matchesSearch && matchesStatus;
  });

  const markAsShipped = (id) => {
    setOrders(orders.map(o => o.id === id ? { ...o, status: 'Enviado' } : o));
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
            <select 
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="pending">Pendientes</option>
              <option value="shipped">Enviados</option>
              <option value="delivered">Entregados</option>
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="seller-products-table">
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
                    <span className={`status-badge badge-${order.status.toLowerCase()}`}>
                      {order.status}
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
                      {order.status === 'Pendiente' && (
                        <button 
                          className="btn-icon check" 
                          title="Marcar como Enviado"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsShipped(order.id);
                          }}
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
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
              <div className="order-status-banner">
                <span className="status-label">Estado actual:</span>
                <span className={`status-badge badge-${selectedOrder.status.toLowerCase()}`}>
                  {selectedOrder.status}
                </span>
                {selectedOrder.status === 'Pendiente' && (
                  <button 
                    className="btn-primary" 
                    style={{marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px'}}
                    onClick={() => {
                      markAsShipped(selectedOrder.id);
                      setSelectedOrder({...selectedOrder, status: 'Enviado'});
                    }}
                  >
                    <CheckCircle size={16} /> Marcar como Enviado
                  </button>
                )}
              </div>

              <div className="order-info-grid">
                <div className="info-card">
                  <h3><MapPin size={18} /> Información del Cliente</h3>
                  <p><strong>{selectedOrder.customer}</strong></p>
                  <p><Phone size={14} style={{marginRight: '8px'}} /> {selectedOrder.phone}</p>
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
                </div>
              </div>

              <div className="order-products-list">
                <h3>Productos Comprados</h3>
                <table className="seller-products-table" style={{marginTop: '12px'}}>
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
