import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Store, ShoppingBag, DollarSign, ArrowUpRight, X } from 'lucide-react';
import { getStores, getOrders, getProducts } from './services/api';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalStores: 0,
    pendingStores: 0,
    totalProducts: 0,
    totalSales: 0
  });

  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [activeModal, setActiveModal] = useState(null); // 'sales' | 'products' | 'daily_registrations' | null
  const [selectedDayStores, setSelectedDayStores] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [storesData, ordersData, productsData] = await Promise.all([
          getStores(),
          getOrders(),
          getProducts()
        ]);

        const pending = storesData.filter(s => s.status === 'pending').length;
        const totalIncome = ordersData.reduce((acc, order) => acc + (Number(order.total) || 0), 0);
        
        setOrders(ordersData);
        setProducts(productsData);
        setStores(storesData);

        setStats({
          totalStores: storesData.filter(s => s.status === 'approved').length,
          pendingStores: pending,
          totalProducts: productsData.length,
          totalSales: totalIncome
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      }
    };

    fetchStats();
  }, []);

  const handleCardClick = (type) => {
    if (type === 'stores') {
      navigate('/stores');
    } else if (type === 'pending') {
      navigate('/stores?filter=pending');
    } else if (type === 'sales') {
      setActiveModal('sales');
    } else if (type === 'products') {
      setActiveModal('products');
    }
  };

  const handleDayClick = (dayData) => {
    setSelectedDayStores(dayData);
    setActiveModal('daily_registrations');
  };

  const getLast7DaysStats = () => {
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push({
        date: d,
        label: d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
        stores: []
      });
    }

    stores.forEach(store => {
      if (!store.created_at) return;
      const storeDate = new Date(store.created_at);
      storeDate.setHours(0, 0, 0, 0);
      
      const dayMatch = days.find(d => d.date.getTime() === storeDate.getTime());
      if (dayMatch) {
        dayMatch.stores.push(store);
      }
    });

    const maxCount = Math.max(...days.map(d => d.stores.length), 1);
    return { days, maxCount };
  };

  const chartData = getLast7DaysStats();

  const statCards = [
    { id: 'sales', title: 'Ingresos Totales', value: `$${stats.totalSales.toFixed(2)}`, icon: <DollarSign size={24} />, trend: '+12.5%' },
    { id: 'stores', title: 'Negocios Activos', value: stats.totalStores, icon: <Store size={24} />, trend: 'Ver negocios' },
    { id: 'pending', title: 'Solicitudes Pendientes', value: stats.pendingStores, icon: <Users size={24} />, trend: 'Revisar', isAlert: stats.pendingStores > 0 },
    { id: 'products', title: 'Productos en Red', value: stats.totalProducts, icon: <ShoppingBag size={24} />, trend: 'Ver catálogo' }
  ];

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>Panel de Control</h1>
        <p>Resumen global de la plataforma AmasonCubano</p>
      </div>

      <div className="stats-grid">
        {statCards.map((stat) => (
          <div 
            key={stat.id} 
            className={`stat-card interactive-card ${stat.isAlert ? 'alert-card' : ''}`}
            onClick={() => handleCardClick(stat.id)}
          >
            <div className="stat-card-header">
              <h3>{stat.title}</h3>
              <div className="stat-icon">{stat.icon}</div>
            </div>
            <div className="stat-card-body">
              <span className="stat-value">{stat.value}</span>
              <span className="stat-trend">
                {(stat.id === 'sales' || stat.id === 'products') && <ArrowUpRight size={16} />}
                {stat.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-charts">
        <div className="chart-container">
          <h3>Nuevos Vendedores (Últimos 7 días)</h3>
          <p style={{fontSize: '13px', color: '#64748b', marginBottom: '15px'}}>Haz clic en una barra para ver qué negocios se registraron ese día.</p>
          <div className="fake-chart" style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '15px', padding: '10px 0', borderBottom: '1px solid #e2e8f0' }}>
            {chartData.days.map((day, i) => {
              const heightPercentage = (day.stores.length / chartData.maxCount) * 100;
              return (
                <div key={i} className="bar-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => handleDayClick(day)}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: day.stores.length > 0 ? '#3b82f6' : '#94a3b8' }}>
                    {day.stores.length}
                  </span>
                  <div 
                    className="bar" 
                    style={{ 
                      height: `${Math.max(heightPercentage, 2)}%`, 
                      width: '100%', 
                      maxWidth: '40px',
                      backgroundColor: day.stores.length > 0 ? '#3b82f6' : '#e2e8f0',
                      borderRadius: '4px 4px 0 0',
                      transition: 'all 0.2s ease',
                      minHeight: '4px'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#2563eb'}
                    onMouseOut={(e) => e.target.style.backgroundColor = day.stores.length > 0 ? '#3b82f6' : '#e2e8f0'}
                  ></div>
                  <span className="bar-label" style={{ fontSize: '11px', color: '#64748b' }}>{day.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modals */}
      {activeModal === 'sales' && (
        <div className="admin-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="admin-modal-content" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Historial de Ingresos Globales</h2>
              <button onClick={() => setActiveModal(null)} className="close-btn"><X size={24}/></button>
            </div>
            <div className="admin-modal-body">
              {orders.length === 0 ? (
                <p className="no-data">No hay órdenes registradas todavía.</p>
              ) : (
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID Pedido</th>
                        <th>Cliente</th>
                        <th>Fecha</th>
                        <th>Estado</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map(order => (
                        <tr key={order.id}>
                          <td>#{order.id.slice(0, 8)}</td>
                          <td>{order.customer_name}</td>
                          <td>{new Date(order.created_at).toLocaleDateString()}</td>
                          <td><span className={`status-tag ${order.status}`}>{order.status}</span></td>
                          <td>${Number(order.total).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeModal === 'products' && (
        <div className="admin-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="admin-modal-content" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Catálogo Global de Productos</h2>
              <button onClick={() => setActiveModal(null)} className="close-btn"><X size={24}/></button>
            </div>
            <div className="admin-modal-body">
              {products.length === 0 ? (
                <p className="no-data">No hay productos en la plataforma.</p>
              ) : (
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Precio</th>
                        <th>Stock</th>
                        <th>Categoría</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map(product => (
                        <tr key={product.id}>
                          <td>
                            <div className="product-cell">
                              <img src={product.image_url} alt={product.name} />
                              <span>{product.name}</span>
                            </div>
                          </td>
                          <td>${Number(product.price).toFixed(2)}</td>
                          <td>{product.stock}</td>
                          <td>{product.category_id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeModal === 'daily_registrations' && selectedDayStores && (
        <div className="admin-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="admin-modal-content" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Negocios Registrados el {selectedDayStores.label}</h2>
              <button onClick={() => setActiveModal(null)} className="close-btn"><X size={24}/></button>
            </div>
            <div className="admin-modal-body">
              {selectedDayStores.stores.length === 0 ? (
                <p className="no-data">No se registraron negocios en este día.</p>
              ) : (
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Nombre del Negocio</th>
                        <th>Teléfono (Usuario)</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDayStores.stores.map(store => (
                        <tr key={store.id}>
                          <td><strong>{store.name}</strong></td>
                          <td>{store.phone || 'N/A'}</td>
                          <td><span className={`status-tag ${store.status}`}>{store.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
