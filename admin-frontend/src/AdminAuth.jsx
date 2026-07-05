import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
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

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Simular autenticación maestra
    setTimeout(() => {
      if (formData.email === 'admin@tiendacuba.com' && formData.password === 'admin123') {
        localStorage.setItem('admin_token', 'master_token');
        navigate('/dashboard');
      } else {
        setError('Acceso denegado. Credenciales de administrador inválidas.');
        setLoading(false);
      }
    }, 1000);
  };

  return (
    <div className="admin-auth-page">
      <div className="admin-auth-container">
        
        <div className="admin-auth-logo">
          <ShieldAlert size={48} className="brand-icon" />
          <h1>CubaAmazon <span>Master</span></h1>
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
                placeholder="admin@tiendacuba.com"
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
                placeholder="admin123"
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
