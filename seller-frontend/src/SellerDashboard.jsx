import React, { useState } from 'react';
import { DollarSign, ShoppingCart, PackageOpen, TrendingUp, X, ChevronRight } from 'lucide-react';
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

  const [selectedStat, setSelectedStat] = useState(null);

  const handleStatClick = (stat) => {
    let details = [];
    if (stat.label === 'Ventas Totales') {
      details = [
        { title: 'Venta de Pedido #ORD-001', value: '+$45.00', desc: 'Hoy, 10:42 AM' },
        { title: 'Venta de Pedido #ORD-002', value: '+$120.50', desc: 'Hoy, 09:15 AM' },
        { title: 'Venta de Pedido #ORD-003', value: '+$32.00', desc: 'Ayer, 16:30 PM' },
      ];
    } else if (stat.label === 'Pedidos Pendientes') {
      details = [
        { title: 'Pedido #ORD-001', value: 'Carlos M.', desc: 'Esperando envío' },
        { title: 'Pedido #ORD-004', value: 'Elena S.', desc: 'Esperando envío' },
      ];
    } else if (stat.label === 'Productos Activos') {
      details = [
        { title: 'Café Cubita 250g', value: '25 un.', desc: 'En stock' },
        { title: 'Ventilador Recargable', value: '5 un.', desc: 'En stock' },
        { title: 'Arrocera 1.5L', value: '12 un.', desc: 'En stock' }
      ];
    } else {
      details = [
        { title: 'Conversión de Visitas', value: '+5.2%', desc: 'Crecimiento semanal' },
        { title: 'Retención de Clientes', value: '+8.8%', desc: 'Crecimiento mensual' },
      ];
    }
    setSelectedStat({ ...stat, details });
  };

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
          <div 
            key={index} 
            className={`stat-card premium-card ${stat.gradient}`} 
            onClick={() => handleStatClick(stat)}
            style={{cursor: 'pointer'}}
            title="Toca para ver detalles"
          >
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

      {/* Modal de Detalles de la Tarjeta */}
      {selectedStat && (
        <div className="modal-overlay" onClick={() => setSelectedStat(null)}>
          <div className="modal-content" style={{maxWidth: '500px'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                <div className={`stat-icon-wrapper-premium ${selectedStat.gradient}`} style={{width: '40px', height: '40px'}}>
                  {selectedStat.icon}
                </div>
                <h2>Detalles: {selectedStat.label}</h2>
              </div>
              <button className="close-btn" onClick={() => setSelectedStat(null)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="order-details-body" style={{padding: '0'}}>
              <div style={{padding: '24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'center'}}>
                <span style={{fontSize: '14px', color: '#64748b', fontWeight: '500'}}>Total General</span>
                <div style={{fontSize: '36px', fontWeight: '800', color: '#0f172a', marginTop: '4px'}}>
                  {selectedStat.value}
                </div>
              </div>
              
              <div style={{padding: '16px 24px'}}>
                <h3 style={{fontSize: '15px', color: '#0f172a', marginBottom: '16px'}}>Desglose Detallado</h3>
                <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                  {selectedStat.details.map((item, idx) => (
                    <div key={idx} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9'}}>
                      <div style={{display: 'flex', flexDirection: 'column'}}>
                        <strong style={{color: '#1e293b', fontSize: '14px'}}>{item.title}</strong>
                        <span style={{color: '#64748b', fontSize: '12px', marginTop: '2px'}}>{item.desc}</span>
                      </div>
                      <div style={{fontWeight: '700', color: '#0f172a'}}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-actions" style={{padding: '16px 24px'}}>
              <button className="btn-primary" style={{width: '100%'}} onClick={() => setSelectedStat(null)}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerDashboard;
