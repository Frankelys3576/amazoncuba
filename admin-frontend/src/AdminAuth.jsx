import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { loginAdmin } from './services/api';
import './AdminAuth.css';

const AdminAuth = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { ok, data } = await loginAdmin(formData.email, formData.password);

      if (!ok || !data.session || !data.session.access_token) {
        setError('Acceso denegado. Credenciales de administrador inválidas.');
        setLoading(false);
        return;
      }

      // El permiso real lo comprueba el backend en cada petición. Esto sólo
      // evita entrar a un panel que va a responder 403 en todo.
      const role = data.user && data.user.app_metadata && data.user.app_metadata.role;
      if (role !== 'admin') {
        setError('Esta cuenta no tiene permisos de administrador.');
        setLoading(false);
        return;
      }

      localStorage.setItem('admin_token', data.session.access_token);
      navigate('/dashboard');
    } catch (err) {
      console.error('Admin login error:', err);
      setError('No se pudo conectar con el servidor.');
      setLoading(false);
    }
  };

  return (
    <div className="admin-auth-page">
      <div className="admin-auth-container">
        
        <div className="admin-auth-logo">
          <ShieldAlert size={48} className="brand-icon" />
          <h1>AmasonCubano <span>Master</span></h1>
          <p>Panel de Administración Global</p>
        </div>

        <div className="admin-auth-card">
          <h2>Acceso Restringido</h2>
          
          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="email">Correo Administrativo</label>
              <input 
                type="email" 
                id="email" 
                name="email" 
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Contraseña Maestra</label>
              <input 
                type="password" 
                id="password" 
                name="password" 
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block auth-submit-btn" disabled={loading}>
              {loading ? 'Verificando...' : 'Entrar al Sistema'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminAuth;
