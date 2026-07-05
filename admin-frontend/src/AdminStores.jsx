import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, ExternalLink, Filter } from 'lucide-react';
import { getStores, updateStoreStatus } from './services/api';
import './AdminStores.css';

const AdminStores = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = searchParams.get('filter') || 'all';
  
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
      // Update local state
      setStores(stores.map(store => 
        store.id === storeId ? { ...store, status: newStatus } : store
      ));
    } catch (error) {
      alert('Error al actualizar el estado de la tienda.');
    }
  };

  if (loading) return <div className="admin-loading">Cargando tiendas...</div>;

  const filteredStores = stores.filter(store => {
    if (filter === 'all') return true;
    return store.status === filter;
  });

  return (
    <div className="admin-stores">
      <div className="page-header">
        <h1>Gestión de Vendedores</h1>
        <p>Aprueba o rechaza solicitudes de nuevos vendedores en la plataforma.</p>
        
        <div className="filter-container">
          <Filter size={18} />
          <select 
            value={filter} 
            onChange={(e) => {
              setFilter(e.target.value);
              setSearchParams({ filter: e.target.value });
            }}
            className="store-filter"
          >
            <option value="all">Todos los negocios</option>
            <option value="pending">Solicitudes Pendientes</option>
            <option value="approved">Negocios Aprobados</option>
            <option value="rejected">Negocios Rechazados</option>
          </select>
        </div>
      </div>

      <div className="stores-list">
        {filteredStores.map(store => (
          <div key={store.id} className="store-card">
            <div className="store-card-header">
              <div className="store-identity">
                <img src={store.logo_url} alt={store.name} className="store-logo" />
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
        ))}
      </div>
    </div>
  );
};

export default AdminStores;
