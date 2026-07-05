import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, Store, AlertCircle } from 'lucide-react';
import { getStores, updateStoreStatus } from './services/api';
import './AdminStores.css';

const AdminStores = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = searchParams.get('filter') || 'pending';
  
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(initialFilter);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const data = await getStores();
      setStores(data);
    } catch (error) {
      console.error('Error fetching stores:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (storeId, newStatus) => {
    try {
      await updateStoreStatus(storeId, newStatus);
      setStores(stores.map(store => 
        store.id === storeId ? { ...store, status: newStatus } : store
      ));
    } catch (error) {
      alert('Error al actualizar el estado de la tienda.');
    }
  };

  if (loading) return <div className="admin-loading">Cargando tiendas...</div>;

  const counts = {
    all: stores.length,
    pending: stores.filter(s => s.status === 'pending').length,
    approved: stores.filter(s => s.status === 'approved').length,
    rejected: stores.filter(s => s.status === 'rejected').length,
  };

  const filteredStores = stores.filter(store => {
    if (filter === 'all') return true;
    return store.status === filter;
  });

  const tabs = [
    { id: 'all', label: 'Todos', icon: <Store size={16} />, count: counts.all },
    { id: 'pending', label: 'Pendientes', icon: <Clock size={16} />, count: counts.pending },
    { id: 'approved', label: 'Aprobados', icon: <CheckCircle size={16} />, count: counts.approved },
    { id: 'rejected', label: 'Rechazados', icon: <XCircle size={16} />, count: counts.rejected },
  ];

  const handleTabClick = (tabId) => {
    setFilter(tabId);
    setSearchParams({ filter: tabId });
  };

  return (
    <div className="admin-stores">
      <div className="page-header">
        <h1>Gestión de Vendedores</h1>
        <p>Aprueba o rechaza solicitudes de nuevos vendedores en la plataforma.</p>
      </div>

      {/* Tabs */}
      <div className="store-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`store-tab ${filter === tab.id ? 'active' : ''} ${tab.id === 'pending' && tab.count > 0 ? 'has-pending' : ''}`}
            onClick={() => handleTabClick(tab.id)}
          >
            {tab.icon}
            <span className="tab-label">{tab.label}</span>
            <span className={`tab-count ${tab.id}`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="stores-list">
        {filteredStores.length === 0 ? (
          <div className="empty-state">
            <AlertCircle size={48} />
            <h3>No hay negocios {filter === 'pending' ? 'pendientes' : filter === 'approved' ? 'aprobados' : filter === 'rejected' ? 'rechazados' : ''}</h3>
            <p>No se encontraron negocios con este filtro.</p>
          </div>
        ) : (
          filteredStores.map(store => (
            <div key={store.id} className="store-card">
              <div className="store-card-header">
                <div className="store-identity">
                  <div className="store-logo-wrapper">
                    {store.logo_url ? (
                      <img src={store.logo_url} alt={store.name} className="store-logo" />
                    ) : (
                      <div className="store-logo-placeholder">
                        <Store size={24} />
                      </div>
                    )}
                  </div>
                  <div className="store-info">
                    <h3>{store.name}</h3>
                    <span className={`status-badge ${store.status}`}>
                      {store.status === 'pending' && <Clock size={14} />}
                      {store.status === 'approved' && <CheckCircle size={14} />}
                      {store.status === 'rejected' && <XCircle size={14} />}
                      {store.status === 'pending' ? 'Pendiente' : 
                       store.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="store-card-body">
                <p>{store.description}</p>
                <div className="store-details">
                  <span><strong>ID:</strong> #{store.id}</span>
                  <span><strong>Fecha de registro:</strong> {new Date(store.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="store-card-actions">
                {store.status === 'pending' ? (
                  <>
                    <button 
                      className="btn btn-primary approve-btn"
                      onClick={() => handleStatusChange(store.id, 'approved')}
                    >
                      <CheckCircle size={16} /> Aprobar
                    </button>
                    <button 
                      className="btn btn-secondary reject-btn"
                      onClick={() => handleStatusChange(store.id, 'rejected')}
                    >
                      <XCircle size={16} /> Rechazar
                    </button>
                  </>
                ) : (
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleStatusChange(store.id, store.status === 'approved' ? 'rejected' : 'approved')}
                  >
                    Cambiar a {store.status === 'approved' ? 'Rechazado' : 'Aprobado'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminStores;
