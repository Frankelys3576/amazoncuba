import React from 'react';
import { DollarSign, ShoppingCart, PackageOpen, TrendingUp } from 'lucide-react';
import './SellerDashboard.css';

const SellerDashboard = () => {
  // Datos simulados para el MVP
  const stats = [
    { label: 'Ventas Totales', value: '$4,250.00', icon: <DollarSign size={28} />, gradient: 'grad-green' },
    { label: 'Pedidos Pendientes', value: '12', icon: <ShoppingCart size={28} />, gradient: 'grad-orange' },
    { label: 'Productos Activos', value: '45', icon: <PackageOpen size={28} />, gradient: 'grad-blue' },
    { label: 'Crecimiento', value: '+14%', icon: <TrendingUp size={28} />, gradient: 'grad-purple' },
  ];

  const recentOrders = [
    { id: 'ORD-001', customer: 'Carlos M.', date: 'Hoy, 10:42 AM', amount: '$45.00', status: 'Pendiente' },
    { id: 'ORD-002', customer: 'Ana G.', date: 'Hoy, 09:15 AM', amount: '$120.50', status: 'Enviado' },
    { id: 'ORD-003', customer: 'Roberto F.', date: 'Ayer, 16:30 PM', amount: '$32.00', status: 'Entregado' },
    { id: 'ORD-004', customer: 'Elena S.', date: 'Ayer, 14:20 PM', amount: '$89.99', status: 'Pendiente' },
  ];

  return (
    <div className="seller-dashboard">
      <div className="dashboard-welcome-banner">
        <div>
          <h1 className="seller-page-title" style={{color: 'white', margin: 0}}>Resumen de tu Negocio</h1>
          <p className="welcome-subtitle">Aquí tienes un vistazo rápido al rendimiento de tu tienda de hoy.</p>
        </div>
      </div>
      
      <div className="dashboard-stats-grid">
        {stats.map((stat, index) => (
          <div key={index} className={`stat-card premium-card ${stat.gradient}`}>
            <div className="stat-icon-wrapper-premium">
              {stat.icon}
            </div>
            <div className="stat-details">
              <span className="stat-label">{stat.label}</span>
              <span className="stat-value">{stat.value}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-content-grid">
        <div className="dashboard-chart-card premium-panel">
          <div className="card-header">
            <h3>Visión General de Ventas</h3>
          </div>
          <div className="chart-placeholder">
            {/* Gráfico estático simulado con CSS puro para impacto visual */}
            <div className="fake-chart">
              <div className="bar" style={{height: '40%'}}><span>Lun</span></div>
              <div className="bar" style={{height: '60%'}}><span>Mar</span></div>
              <div className="bar" style={{height: '35%'}}><span>Mié</span></div>
              <div className="bar" style={{height: '80%'}}><span>Jue</span></div>
              <div className="bar" style={{height: '50%'}}><span>Vie</span></div>
              <div className="bar" style={{height: '90%'}}><span>Sáb</span></div>
              <div className="bar" style={{height: '75%'}}><span>Dom</span></div>
            </div>
          </div>
        </div>

        <div className="dashboard-recent-card premium-panel">
          <div className="card-header">
            <h3>Pedidos Recientes</h3>
            <button className="btn-link premium-link">Ver todos</button>
          </div>
          <div className="recent-orders-list">
            {recentOrders.map((order) => (
              <div key={order.id} className="recent-order-item">
                <div className="order-info">
                  <span className="order-id">{order.id}</span>
                  <span className="order-customer">{order.customer}</span>
                </div>
                <div className="order-meta">
                  <span className="order-date">{order.date}</span>
                  <span className="order-amount">{order.amount}</span>
                </div>
                <div className={`order-status badge-${order.status.toLowerCase()}`}>
                  {order.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerDashboard;
