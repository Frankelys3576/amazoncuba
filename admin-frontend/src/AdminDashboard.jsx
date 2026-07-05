import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Store, ShoppingBag, TrendingUp, DollarSign, ArrowUpRight, X } from 'lucide-react';
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
  const [activeModal, setActiveModal] = useState(null); // 'sales' | 'products' | null

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
    if (type === 'stores' || type === 'pending') {
      navigate('/stores');
    } else if (type === 'sales') {
      setActiveModal('sales');
    } else if (type === 'products') {
      setActiveModal('products');
    }
  };

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
        <p>Resumen global de la plataforma TiendaCubaAmazon</p>
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
          <h3>Ventas Generales (Últimos 7 días)</h3>
          <div className="fake-chart">
            {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
              <div key={i} className="bar-wrapper">
                <div className="bar" style={{ height: `${h}%` }}></div>
                <span className="bar-label">Día {i+1}</span>
              </div>
            ))}
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

    </div>
  );
};

export default AdminDashboard;
