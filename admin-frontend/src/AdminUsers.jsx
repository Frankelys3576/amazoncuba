import React, { useState, useEffect } from 'react';
import { Users, Mail, Calendar, Clock, CheckCircle, Search, Trash2 } from 'lucide-react';
import { getUsers, deleteUser } from './services/api';
import './AdminUsers.css';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [customDates, setCustomDates] = useState({ start: '', end: '' });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await getUsers();
        setUsers(data);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(search.toLowerCase()) || 
                          user.full_name.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;

    if (dateFilter !== 'all') {
      const now = new Date();
      const createdDate = new Date(user.created_at || new Date()); // Default if no created_at
      
      if (dateFilter === 'day') {
        const today = new Date(now.setHours(0, 0, 0, 0));
        return createdDate >= today;
      } else if (dateFilter === 'week') {
        const lastWeek = new Date(now.setDate(now.getDate() - 7));
        return createdDate >= lastWeek;
      } else if (dateFilter === 'month') {
        const lastMonth = new Date(now.setMonth(now.getMonth() - 1));
        return createdDate >= lastMonth;
      } else if (dateFilter === 'custom' && customDates.start && customDates.end) {
        const start = new Date(customDates.start);
        const end = new Date(customDates.end);
        end.setHours(23, 59, 59, 999);
        return createdDate >= start && createdDate <= end;
      }
    }
    return true;
  });

  const handleDeleteUser = async (id, name) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar permanentemente al usuario ${name}? Esta acción no se puede deshacer.`)) {
      try {
        await deleteUser(id);
        setUsers(users.filter(u => u.id !== id));
      } catch (error) {
        alert('Error al eliminar el usuario. Intenta nuevamente.');
        console.error(error);
      }
    }
  };

  if (loading) return <div className="admin-loading">Cargando usuarios...</div>;

  return (
    <div className="admin-users">
      <div className="page-header">
        <div className="page-header-top">
          <div>
            <h1>Usuarios Registrados</h1>
            <p>Todos los usuarios registrados en la plataforma AmasonCubano.</p>
          </div>
          <div className="users-count-badge">
            <Users size={20} />
            <span>{users.length} usuarios</span>
          </div>
        </div>

        <div className="users-search" style={{display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap'}}>
          <div style={{display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 12px', flex: 1, minWidth: '250px'}}>
            <Search size={18} color="#64748b" />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{border: 'none', padding: '10px', width: '100%', outline: 'none'}}
            />
          </div>

          <div style={{display: 'flex', gap: '10px', alignItems: 'center', background: '#fff', padding: '5px', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
            <select 
              value={dateFilter} 
              onChange={(e) => setDateFilter(e.target.value)}
              style={{padding: '8px 12px', borderRadius: '6px', border: 'none', outline: 'none', background: '#f8fafc'}}
            >
              <option value="all">Historico Total</option>
              <option value="day">Hoy</option>
              <option value="week">Últimos 7 días</option>
              <option value="month">Últimos 30 días</option>
              <option value="custom">Personalizado</option>
            </select>

            {dateFilter === 'custom' && (
              <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                <input 
                  type="date" 
                  value={customDates.start}
                  onChange={(e) => setCustomDates({...customDates, start: e.target.value})}
                  style={{padding: '6px', borderRadius: '6px', border: '1px solid #e2e8f0'}}
                />
                <span>-</span>
                <input 
                  type="date" 
                  value={customDates.end}
                  onChange={(e) => setCustomDates({...customDates, end: e.target.value})}
                  style={{padding: '6px', borderRadius: '6px', border: '1px solid #e2e8f0'}}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="users-table-wrapper">
        <table className="users-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Email</th>
              <th>Fecha de registro</th>
              <th>Último acceso</th>
              <th>Email verificado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="no-results">
                  No se encontraron usuarios.
                </td>
              </tr>
            ) : (
              filteredUsers.map(user => (
                <tr key={user.id}>
                  <td>
                    <div className="user-cell">
                      <div className="user-avatar">
                        {user.full_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="user-name">{user.full_name}</span>
                    </div>
                  </td>
                  <td>
                    <div className="email-cell">
                      <Mail size={14} />
                      {user.email}
                    </div>
                  </td>
                  <td>
                    <div className="date-cell">
                      <Calendar size={14} />
                      {new Date(user.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td>
                    <div className="date-cell">
                      <Clock size={14} />
                      {user.last_sign_in_at 
                        ? new Date(user.last_sign_in_at).toLocaleDateString() 
                        : 'Nunca'}
                    </div>
                  </td>
                  <td>
                    <span className={`verify-badge ${user.email_confirmed ? 'verified' : 'unverified'}`}>
                      {user.email_confirmed ? (
                        <><CheckCircle size={14} /> Verificado</>
                      ) : (
                        'Sin verificar'
                      )}
                    </span>
                  </td>
                  <td>
                    <button 
                      onClick={() => handleDeleteUser(user.id, user.full_name)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '8px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background-color 0.2s'
                      }}
                      title="Eliminar usuario"
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsers;
