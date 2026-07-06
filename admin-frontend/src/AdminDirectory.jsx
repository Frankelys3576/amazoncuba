import React, { useState, useEffect } from 'react';
import { Search, Store, Users as UsersIcon, CheckCircle, Clock, XCircle, Building2, UserCircle } from 'lucide-react';
import { getUsers, getStores } from './services/api';
import './AdminDirectory.css';

const AdminDirectory = () => {
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // View states
  const [activeTab, setActiveTab] = useState('stores'); // 'users' or 'stores'
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, pending, approved, rejected
  const [typeFilter, setTypeFilter] = useState('all'); // all, individual, business (only applies to stores)

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersData, storesData] = await Promise.all([
        getUsers(),
        getStores()
      ]);
      setUsers(usersData || []);
      setStores(storesData || []);
    } catch (err) {
      console.error('Error fetching directory data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredStores = () => {
    return stores.filter(store => {
      // Status filter
      if (statusFilter !== 'all' && store.status !== statusFilter) return false;
      // Type filter
      if (typeFilter !== 'all' && store.store_type !== typeFilter) return false;
      // Search
      if (search && !store.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  };

  const getFilteredUsers = () => {
    return users.filter(user => {
      // Search
      const term = search.toLowerCase();
      return user.email.toLowerCase().includes(term) || (user.full_name && user.full_name.toLowerCase().includes(term));
    });
  };

  const filteredStores = getFilteredStores();
  const filteredUsers = getFilteredUsers();

  if (loading) return <div className="admin-loading">Cargando directorio...</div>;

  return (
    <div className="admin-directory">
      <div className="page-header">
        <h1>Usuarios y Negocios Existentes</h1>
        <p>Busca, filtra y explora todo el directorio de clientes y vendedores.</p>
      </div>

      {/* Control Bar (Tabs & Search) */}
      <div className="directory-controls">
        <div className="directory-tabs">
          <button 
            className={`tab-btn ${activeTab === 'stores' ? 'active' : ''}`}
            onClick={() => setActiveTab('stores')}
          >
            <Store size={18} /> Negocios y Vendedores ({stores.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <UsersIcon size={18} /> Clientes ({users.length})
          </button>
        </div>

        <div className="directory-search">
          <Search size={18} />
          <input 
            type="text" 
            placeholder={activeTab === 'stores' ? "Buscar negocio o vendedor..." : "Buscar cliente por email o nombre..."} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Specific Filters for Stores */}
      {activeTab === 'stores' && (
        <div className="directory-filters">
          <div className="filter-group">
            <span className="filter-label">Estado:</span>
            <button className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>Todos</button>
            <button className={`filter-btn ${statusFilter === 'pending' ? 'active' : ''}`} onClick={() => setStatusFilter('pending')}>Pendientes</button>
            <button className={`filter-btn ${statusFilter === 'approved' ? 'active' : ''}`} onClick={() => setStatusFilter('approved')}>Aprobados</button>
          </div>
          <div className="filter-group">
            <span className="filter-label">Tipo:</span>
            <button className={`filter-btn ${typeFilter === 'all' ? 'active' : ''}`} onClick={() => setTypeFilter('all')}>Todos</button>
            <button className={`filter-btn ${typeFilter === 'business' ? 'active' : ''}`} onClick={() => setTypeFilter('business')}>Local Físico</button>
            <button className={`filter-btn ${typeFilter === 'individual' ? 'active' : ''}`} onClick={() => setTypeFilter('individual')}>Independientes</button>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="directory-table-container">
        <table className="directory-table">
          <thead>
            {activeTab === 'stores' ? (
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Fecha de Registro</th>
              </tr>
            ) : (
              <tr>
                <th>ID (Email)</th>
                <th>Nombre</th>
                <th>Fecha de Registro</th>
                <th>Estado (Auth)</th>
              </tr>
            )}
          </thead>
          <tbody>
            {activeTab === 'stores' ? (
              filteredStores.length > 0 ? (
                filteredStores.map(store => (
                  <tr key={store.id}>
                    <td>#{store.id}</td>
                    <td><strong>{store.name}</strong></td>
                    <td>
                      {store.store_type === 'business' ? (
                        <span className="type-badge business"><Building2 size={14}/> Negocio Físico</span>
                      ) : (
                        <span className="type-badge individual"><UserCircle size={14}/> Independiente</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge ${store.status}`}>
                        {store.status === 'pending' && <Clock size={14}/>}
                        {store.status === 'approved' && <CheckCircle size={14}/>}
                        {store.status === 'rejected' && <XCircle size={14}/>}
                        {store.status === 'pending' ? 'Pendiente' : store.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                      </span>
                    </td>
                    <td>{new Date(store.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="5" className="empty-table">No se encontraron tiendas con estos filtros.</td></tr>
              )
            ) : (
              filteredUsers.length > 0 ? (
                filteredUsers.map(user => (
                  <tr key={user.id}>
                    <td>{user.email}</td>
                    <td>{user.full_name || 'Sin nombre'}</td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td><span className="status-badge approved">Activo</span></td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="4" className="empty-table">No se encontraron clientes.</td></tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDirectory;
