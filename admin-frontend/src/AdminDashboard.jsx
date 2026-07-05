import React, { useState, useEffect } from 'react';
import { Users, Store, ShoppingBag, TrendingUp, DollarSign, ArrowUpRight } from 'lucide-react';
import { getStores } from './services/api';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalStores: 0,
    pendingStores: 0,
    totalProducts: 24, // Mock
    totalSales: 4500   // Mock
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const storesData = await getStores();
        const pending = storesData.filter(s => s.status === 'pending').length;
        
        setStats(prev => ({
          ...prev,
          totalStores: storesData.length,
          pendingStores: pending
        }));
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    { title: 'Ingresos Totales', value: `$${stats.totalSales}`, icon: <DollarSign size={24} />, trend: '+12.5%' },
    { title: 'Negocios Activos', value: stats.totalStores, icon: <Store size={24} />, trend: '+4' },
    { title: 'Solicitudes Pendientes', value: stats.pendingStores, icon: <Users size={24} />, trend: 'Revisar', isAlert: stats.pendingStores > 0 },
    { title: 'Productos en Red', value: stats.totalProducts, icon: <ShoppingBag size={24} />, trend: '+24%' }
  ];

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>Panel de Control</h1>
        <p>Resumen global de la plataforma TiendaCubaAmazon</p>
      </div>

      <div className="stats-grid">
        {statCards.map((stat, idx) => (
          <div key={idx} className={`stat-card ${stat.isAlert ? 'alert-card' : ''}`}>
            <div className="stat-card-header">
              <h3>{stat.title}</h3>
              <div className="stat-icon">{stat.icon}</div>
            </div>
            <div className="stat-card-body">
              <span className="stat-value">{stat.value}</span>
              <span className="stat-trend">
                {stat.trend !== 'Revisar' && <ArrowUpRight size={16} />}
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
            {/* Gráfico simulado con barras */}
            {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
              <div key={i} className="bar-wrapper">
                <div className="bar" style={{ height: `${h}%` }}></div>
                <span className="bar-label">Día {i+1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
