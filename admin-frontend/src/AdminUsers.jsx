import React, { useState, useEffect } from 'react';
import { Users, Mail, Calendar, Clock, CheckCircle, Search } from 'lucide-react';
import { getUsers } from './services/api';
import './AdminUsers.css';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(search.toLowerCase()) ||
    user.full_name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="admin-loading">Cargando usuarios...</div>;

  return (
    <div className="admin-users">
      <div className="page-header">
        <div className="page-header-top">
          <div>
            <h1>Usuarios Registrados</h1>
            <p>Todos los usuarios registrados en la plataforma TiendaCubaAmazon.</p>
          </div>
          <div className="users-count-badge">
            <Users size={20} />
            <span>{users.length} usuarios</span>
          </div>
        </div>

        <div className="users-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
