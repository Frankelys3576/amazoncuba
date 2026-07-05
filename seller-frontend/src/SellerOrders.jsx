import React, { useState } from 'react';
import { Search, Eye, CheckCircle } from 'lucide-react';
// import './SellerProducts.css'; // Usamos estilos similares a products y dashboard
import './SellerOrders.css';

const SellerOrders = () => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Datos simulados para pedidos
  const [orders, setOrders] = useState([
    { id: 'ORD-001', customer: 'Carlos Martínez', date: '2026-07-05 10:42 AM', total: 45.00, items: 2, status: 'Pendiente' },
    { id: 'ORD-002', customer: 'Ana González', date: '2026-07-05 09:15 AM', total: 120.50, items: 1, status: 'Enviado' },
    { id: 'ORD-003', customer: 'Roberto Fernández', date: '2026-07-04 16:30 PM', total: 32.00, items: 4, status: 'Entregado' },
    { id: 'ORD-004', customer: 'Elena Sánchez', date: '2026-07-04 14:20 PM', total: 89.99, items: 1, status: 'Pendiente' },
    { id: 'ORD-005', customer: 'Miguel Díaz', date: '2026-07-03 11:10 AM', total: 210.00, items: 3, status: 'Entregado' },
  ]);

  const filteredOrders = orders.filter(o => 
    o.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.customer.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <select className="filter-select">
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
                <tr key={order.id}>
                  <td><strong>{order.id}</strong></td>
                  <td>{order.customer}</td>
                  <td>{order.date}</td>
                  <td>{order.items} art.</td>
                  <td><span className="product-price">${order.total.toFixed(2)}</span></td>
                  <td>
                    <span className={`status-badge badge-${order.status.toLowerCase()}`}>
                      {order.status}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn-icon" title="Ver detalles"><Eye size={16} /></button>
                      {order.status === 'Pendiente' && (
                        <button 
                          className="btn-icon check" 
                          title="Marcar como Enviado"
                          onClick={() => markAsShipped(order.id)}
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
    </div>
  );
};

export default SellerOrders;
