import React, { useState, useEffect } from 'react';
import { Search, Store, Users as UsersIcon, CheckCircle, Clock, XCircle, Building2, UserCircle, Edit } from 'lucide-react';
import { getUsers, getStores, updateUser } from './services/api';
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

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({ email: '', password: '' });
  const [editLoading, setEditLoading] = useState(false);

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

  const getUserByStore = (store) => {
    if (!store.phone) return null;
    const phoneMatch = store.phone.replace(/[^0-9]/g, '');
    return users.find(u => u.email.startsWith(phoneMatch));
  };

  const openEditModal = (user) => {
    if (!user) {
      alert('No se pudo encontrar el usuario asociado (credenciales) de este negocio.');
      return;
    }
    setEditingUser(user);
    setEditFormData({ email: user.email, password: '' });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      const dataToUpdate = {};
      if (editFormData.email && editFormData.email !== editingUser.email) dataToUpdate.email = editFormData.email;
      if (editFormData.password) dataToUpdate.password = editFormData.password;
      
      if (Object.keys(dataToUpdate).length > 0) {
        await updateUser(editingUser.id, dataToUpdate);
        setUsers(users.map(u => u.id === editingUser.id ? { ...u, email: editFormData.email || u.email } : u));
        alert('Credenciales actualizadas correctamente.');
      }
      setIsEditModalOpen(false);
    } catch (error) {
      alert('Error al actualizar: ' + error.message);
    } finally {
      setEditLoading(false);
    }
  };

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
                <th>Acciones</th>
              </tr>
            ) : (
              <tr>
                <th>ID (Email)</th>
                <th>Nombre</th>
                <th>Fecha de Registro</th>
                <th>Estado (Auth)</th>
                <th>Acciones</th>
              </tr>
            )}
          </thead>
          <tbody>
            {activeTab === 'stores' ? (
              filteredStores.length > 0 ? (
                filteredStores.map(store => (
                  <tr key={store.id}>
                    <td data-label="ID">#{store.id}</td>
                    <td data-label="Nombre"><strong>{store.name}</strong></td>
                    <td data-label="Tipo">
                      {store.store_type === 'business' ? (
                        <span className="type-badge business"><Building2 size={14}/> Negocio Físico</span>
                      ) : (
                        <span className="type-badge individual"><UserCircle size={14}/> Independiente</span>
                      )}
                    </td>
                    <td data-label="Estado">
                      <span className={`status-badge ${store.status}`}>
                        {store.status === 'pending' && <Clock size={14}/>}
                        {store.status === 'approved' && <CheckCircle size={14}/>}
                        {store.status === 'rejected' && <XCircle size={14}/>}
                        {store.status === 'pending' ? 'Pendiente' : store.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                      </span>
                    </td>
                    <td data-label="Fecha de Registro">{new Date(store.created_at).toLocaleDateString()}</td>
                    <td data-label="Acciones">
                      <button 
                        onClick={() => openEditModal(getUserByStore(store))}
                        style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '5px' }}
                        title="Editar Credenciales"
                      >
                        <Edit size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="5" className="empty-table">No se encontraron tiendas con estos filtros.</td></tr>
              )
            ) : (
              filteredUsers.length > 0 ? (
                filteredUsers.map(user => (
                  <tr key={user.id}>
                    <td data-label="ID (Email)">{user.email}</td>
                    <td data-label="Nombre">{user.full_name || 'Sin nombre'}</td>
                    <td data-label="Fecha de Registro">{new Date(user.created_at).toLocaleDateString()}</td>
                    <td data-label="Estado (Auth)"><span className="status-badge approved">Activo</span></td>
                    <td data-label="Acciones">
                      <button 
                        onClick={() => openEditModal(user)}
                        style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '5px' }}
                        title="Editar Credenciales"
                      >
                        <Edit size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="4" className="empty-table">No se encontraron clientes.</td></tr>
              )
            )}
          </tbody>
        </table>
      </div>

      {isEditModalOpen && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}}>
          <div style={{background: 'white', padding: '24px', borderRadius: '8px', width: '400px', maxWidth: '90%'}}>
            <h2 style={{marginTop: 0}}>Editar Credenciales</h2>
            <p style={{fontSize: '14px', color: '#64748b', marginBottom: '20px'}}>
              Modifica el correo de acceso o establece una nueva contraseña para <strong>{editingUser?.full_name || 'el usuario'}</strong>. 
              <em>Las contraseñas actuales no se pueden ver porque están encriptadas de forma segura.</em>
            </p>
            <form onSubmit={handleEditSubmit}>
              <div style={{marginBottom: '15px'}}>
                <label style={{display: 'block', marginBottom: '5px', fontWeight: '500'}}>Correo (Usuario):</label>
                <input 
                  type="email" 
                  value={editFormData.email} 
                  onChange={e => setEditFormData({...editFormData, email: e.target.value})}
                  required
                  style={{width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1'}}
                />
              </div>
              <div style={{marginBottom: '20px'}}>
                <label style={{display: 'block', marginBottom: '5px', fontWeight: '500'}}>Nueva Contraseña (Opcional):</label>
                <input 
                  type="password" 
                  value={editFormData.password}
                  onChange={e => setEditFormData({...editFormData, password: e.target.value})}
                  placeholder="Dejar en blanco para no cambiar"
                  style={{width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1'}}
                />
              </div>
              <div style={{display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
                <button type="button" onClick={() => setIsEditModalOpen(false)} style={{padding: '10px 15px', border: '1px solid #cbd5e1', background: 'white', borderRadius: '4px', cursor: 'pointer'}}>Cancelar</button>
                <button type="submit" disabled={editLoading} style={{padding: '10px 15px', border: 'none', background: '#3b82f6', color: 'white', borderRadius: '4px', cursor: 'pointer'}}>
                  {editLoading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDirectory;
