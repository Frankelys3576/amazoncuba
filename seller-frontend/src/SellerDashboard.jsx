import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, ShoppingCart, PackageOpen, Eye, X, ChevronRight, CheckCircle2, Clock, User } from 'lucide-react';
import { getStoreOrders, getProducts, getStoreStats, getStoreById } from './services/api';
import './SellerDashboard.css';

const SellerDashboard = () => {
  const navigate = useNavigate();
  const storeId = localStorage.getItem('seller_store_id');
  const [statsData, setStatsData] = useState({
    totalSales: 0,
    pendingOrdersCount: 0,
    activeProductsCount: 0,
    recentOrdersList: [],
    salesDetails: [],
    pendingDetails: [],
    productsDetails: [],
    viewsToday: 0,
    viewsThisMonth: 0,
    viewsTotal: 0
  });
  const [loading, setLoading] = useState(true);
  const [storeInfo, setStoreInfo] = useState(null);
  
  // States para el filtrado
  const [allOrders, setAllOrders] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'day', 'week', 'month', 'custom'
  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  const [rawStats, setRawStats] = useState({});

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        if (!storeId) return;

        const [orders, allProducts, statsDataRes, storeDataRes] = await Promise.all([
          getStoreOrders(storeId),
          getProducts({ storeId }),
          getStoreStats(storeId),
          getStoreById(storeId)
        ]);

        const storeProducts = allProducts.filter(p => p.store_id == storeId);
        
        setAllOrders(orders);
        setAllProducts(storeProducts);
        setRawStats(statsDataRes);
        setStoreInfo(storeDataRes);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [storeId]);

  useEffect(() => {
    if (loading) return;

    let filteredOrders = [...allOrders];
    const now = new Date();

    if (dateFilter === 'day') {
      const today = new Date(now.setHours(0, 0, 0, 0));
      filteredOrders = allOrders.filter(o => new Date(o.created_at) >= today);
    } else if (dateFilter === 'week') {
      const lastWeek = new Date(now.setDate(now.getDate() - 7));
      filteredOrders = allOrders.filter(o => new Date(o.created_at) >= lastWeek);
    } else if (dateFilter === 'month') {
      const lastMonth = new Date(now.setMonth(now.getMonth() - 1));
      filteredOrders = allOrders.filter(o => new Date(o.created_at) >= lastMonth);
    } else if (dateFilter === 'custom' && customDates.start && customDates.end) {
      const start = new Date(customDates.start);
      const end = new Date(customDates.end);
      end.setHours(23, 59, 59, 999);
      filteredOrders = allOrders.filter(o => {
        const d = new Date(o.created_at);
        return d >= start && d <= end;
      });
    }

    let total = 0;
    let pending = 0;
    let salesList = [];
    let pendingList = [];

    filteredOrders.forEach(order => {
      if (order.status !== 'Cancelado') {
        total += Number(order.total);
        salesList.push({
          title: `Pedido #${order.id}`,
          value: `+$${Number(order.total).toFixed(2)}`,
          desc: new Date(order.created_at).toLocaleString()
        });
      }
      if (order.status === 'pending' || order.status === 'Pendiente') {
        pending += 1;
        pendingList.push({
          title: `Pedido #${order.id}`,
          value: order.customer_name,
          desc: 'Esperando envío'
        });
      }
    });

    const productsList = allProducts.map(p => ({
      title: p.name,
      value: `${p.stock} un.`,
      desc: p.stock > 0 ? 'Disponible' : 'Agotado'
    }));

    // Determinar vistas a mostrar dependiendo del filtro
    let viewsToShow = rawStats.viewsTotal || 0;
    if (dateFilter === 'day') viewsToShow = rawStats.viewsToday || 0;
    if (dateFilter === 'month') viewsToShow = rawStats.viewsThisMonth || 0;

    setStatsData({
      totalSales: total,
      pendingOrdersCount: pending,
      activeProductsCount: allProducts.length,
      recentOrdersList: filteredOrders.slice(0, 5),
      salesDetails: salesList.slice(0, 10),
      pendingDetails: pendingList,
      productsDetails: productsList.slice(0, 10),
      viewsToday: rawStats.viewsToday || 0,
      viewsThisMonth: rawStats.viewsThisMonth || 0,
      viewsTotal: viewsToShow
    });
  }, [allOrders, allProducts, dateFilter, customDates, rawStats, loading]);

  const stats = [
    { label: 'Ventas Totales', value: `$${statsData.totalSales.toFixed(2)}`, icon: <DollarSign size={24} />, colorClass: 'text-emerald' },
    { label: 'Pedidos Pendientes', value: statsData.pendingOrdersCount.toString(), icon: <ShoppingCart size={24} />, colorClass: 'text-amber' },
    { label: 'Productos Activos', value: statsData.activeProductsCount.toString(), icon: <PackageOpen size={24} />, colorClass: 'text-blue' },
    { label: 'Vistas Totales', value: statsData.viewsTotal.toString(), icon: <Eye size={24} />, colorClass: 'text-indigo' },
  ];

  const [selectedStat, setSelectedStat] = useState(null);

  const handleStatClick = (stat) => {
    let details = [];
    if (stat.label === 'Ventas Totales') {
      details = statsData.salesDetails;
      if (details.length === 0) details = [{ title: 'Sin ventas aún', value: '$0.00', desc: 'Sigue promocionando tu tienda' }];
    } else if (stat.label === 'Pedidos Pendientes') {
      details = statsData.pendingDetails;
      if (details.length === 0) details = [{ title: 'No hay pedidos pendientes', value: '-', desc: '¡Todo al día!' }];
    } else if (stat.label === 'Productos Activos') {
      details = statsData.productsDetails;
      if (details.length === 0) details = [{ title: 'No hay productos', value: '0 un.', desc: 'Agrega tu primer producto' }];
    } else {
      details = [
        { title: 'Hoy', value: statsData.viewsToday, desc: 'Vistas de productos hoy' },
        { title: 'Este Mes', value: statsData.viewsThisMonth, desc: 'Vistas acumuladas en el mes' },
        { title: 'Histórico', value: statsData.viewsTotal, desc: 'Vistas desde la creación de la tienda' }
      ];
    }
    setSelectedStat({ ...stat, details });
  };

  return (
    <div className="seller-dashboard-clean">
      <div className="dashboard-header-clean">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '15px'}}>
          <div>
            <h1 className="seller-page-title">Resumen del Negocio</h1>
            <p className="welcome-subtitle">Vista general de tu rendimiento de ventas y operaciones.</p>
            {storeInfo && storeInfo.store_number && (
              <div style={{display: 'inline-block', marginTop: '8px', padding: '4px 12px', background: '#e0e7ff', color: '#4f46e5', borderRadius: '16px', fontSize: '13px', fontWeight: 'bold', border: '1px solid #c7d2fe'}}>
                ID Vendedor: {storeInfo.store_number}
              </div>
            )}
          </div>
          
          <div className="dashboard-filters" style={{display: 'flex', gap: '10px', alignItems: 'center', background: '#fff', padding: '10px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'}}>
            <select 
              value={dateFilter} 
              onChange={(e) => setDateFilter(e.target.value)}
              style={{padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', outline: 'none', background: '#f8fafc', color: '#334155'}}
            >
              <option value="all">Historico Total</option>
              <option value="day">Hoy</option>
              <option value="week">Últimos 7 días</option>
              <option value="month">Últimos 30 días</option>
              <option value="custom">Fecha Personalizada</option>
            </select>

            {dateFilter === 'custom' && (
              <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                <input 
                  type="date" 
                  value={customDates.start}
                  onChange={(e) => setCustomDates({...customDates, start: e.target.value})}
                  style={{padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0'}}
                />
                <span style={{color: '#64748b'}}>-</span>
                <input 
                  type="date" 
                  value={customDates.end}
                  onChange={(e) => setCustomDates({...customDates, end: e.target.value})}
                  style={{padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0'}}
                />
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="stats-grid-clean">
        {stats.map((stat, index) => (
          <div 
            key={index} 
            className="stat-card-clean"
            onClick={() => handleStatClick(stat)}
            title="Ver detalles"
          >
            <div className={`stat-icon-clean ${stat.colorClass}-bg`}>
              {React.cloneElement(stat.icon, { className: stat.colorClass })}
            </div>
            <div className="stat-info-clean">
              <span className="stat-label-clean">{stat.label === 'Vistas Totales' ? 'Personas que han visto tus productos' : stat.label}</span>
              <span className="stat-value-clean">{stat.value}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-content-clean">
        <div className="recent-orders-card-clean">
          <div className="card-header-clean">
            <h3>Pedidos Recientes</h3>
          </div>
          <div className="recent-orders-list-clean">
            {statsData.recentOrdersList.map((order) => (
              <div 
                key={order.id} 
                className="recent-order-row-clean"
                onClick={() => navigate('/orders')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 2 }}>
                  <div className="order-customer-avatar">
                    {order.customer_name ? order.customer_name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="order-main-info-clean">
                    <span className="order-customer-clean">{order.customer_name || 'Cliente sin nombre'}</span>
                    <span className="order-id-clean">Pedido #{order.id}</span>
                  </div>
                </div>
                <div className="order-amount-date-clean" style={{ flex: 1.5 }}>
                  <span className="order-amount-clean">${Number(order.total).toFixed(2)}</span>
                  <span className="order-date-clean">{new Date(order.created_at).toLocaleDateString()}</span>
                </div>
                <div className="order-status-wrapper-clean" style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px' }}>
                  <span className={`status-pill-clean ${order.status === 'delivered' ? 'pill-delivered' : 'pill-pending'}`}>
                    {order.status === 'delivered' ? <CheckCircle2 size={14} style={{marginRight: '4px'}}/> : <Clock size={14} style={{marginRight: '4px'}}/>}
                    {order.status === 'delivered' ? 'Entregada' : 'Pendiente'}
                  </span>
                  <ChevronRight size={18} color="#9ca3af" />
                </div>
              </div>
            ))}
            {statsData.recentOrdersList.length === 0 && (
              <div className="empty-state-clean">No tienes pedidos recientes.</div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Detalles de la Tarjeta */}
      {selectedStat && (
        <div className="modal-overlay" onClick={() => setSelectedStat(null)}>
          <div className="modal-content" style={{maxWidth: '500px'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                <div className={`stat-icon-clean ${selectedStat.colorClass}-bg`} style={{width: '40px', height: '40px', borderRadius: '10px'}}>
                  {React.cloneElement(selectedStat.icon, { className: selectedStat.colorClass, size: 20 })}
                </div>
                <h2 style={{margin: 0, fontSize: '18px', color: '#111827'}}>Detalles: {selectedStat.label}</h2>
              </div>
              <button className="close-btn" onClick={() => setSelectedStat(null)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="order-details-body" style={{padding: '0'}}>
              <div style={{padding: '32px 24px', background: '#fafafa', borderBottom: '1px solid #e5e7eb', textAlign: 'center'}}>
                <span style={{fontSize: '13px', color: '#6b7280', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em'}}>Total General</span>
                <div style={{fontSize: '42px', fontWeight: '700', color: '#111827', marginTop: '8px'}}>
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
