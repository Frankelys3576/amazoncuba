import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginSeller, registerSeller } from './services/api';
import './SellerAuth.css';

const SellerAuth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    identifier: '',
    confirmIdentifier: '',
    password: '',
    fullName: '',
    storeName: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Formatear el identificador: si no tiene '@', asumimos que es un teléfono o usuario
      // y le agregamos un dominio ficticio para que Supabase Auth lo acepte como email.
      const formattedEmail = formData.identifier.includes('@') 
        ? formData.identifier.toLowerCase().trim()
        : `${formData.identifier.trim()}@phone.cubaamazon.com`;

      if (isLogin) {
        // Log in using backend
        const response = await loginSeller(formattedEmail, formData.password);
        
        // Simular negocio 1 para MVP
        localStorage.setItem('seller_store_id', '1');
        localStorage.setItem('seller_token', response.session?.access_token || 'mock_token');
        navigate('/dashboard');
      } else {
        // Validación de confirmación
        if (formData.identifier !== formData.confirmIdentifier) {
          setError('El correo electrónico o número de teléfono no coinciden.');
          setLoading(false);
          return;
        }

        // Register using backend
        await registerSeller({
          email: formattedEmail,
          password: formData.password,
          full_name: formData.fullName,
          store_name: formData.storeName
        });
        
        alert('Solicitud enviada correctamente. Tu cuenta está pendiente de aprobación por el Administrador.');
        setIsLogin(true); // Cambiar a pestaña de login
      }
    } catch (err) {
      setError(err.message || 'Ocurrió un error. Verifica tus datos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="seller-auth-page">
      <div className="auth-container">
        
        <div className="auth-logo">
          CubaAmazon <span>Seller Central</span>
        </div>

        <div className="auth-card">
          <h2>{isLogin ? 'Iniciar sesión' : 'Solicitar cuenta'}</h2>
          
          {error && <div className="auth-error" style={{color: 'red', marginBottom: '15px', padding: '10px', backgroundColor: '#fee2e2', borderRadius: '5px', fontSize: '14px'}}>{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            {!isLogin && (
              <>
                <div className="form-group" style={{marginBottom: '15px', padding: '10px', backgroundColor: '#eef2ff', borderRadius: '5px', fontSize: '13px', color: '#002a8f'}}>
                  Las cuentas de vendedor requieren aprobación del administrador. Rellena tus datos para enviar la solicitud.
                </div>
                <div className="form-group">
                  <label htmlFor="fullName">Nombre y Apellidos</label>
                  <input 
                    type="text" 
                    id="fullName" 
                    name="fullName" 
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="storeName">Nombre de tu Tienda</label>
                  <input 
                    type="text" 
                    id="storeName" 
                    name="storeName" 
                    value={formData.storeName}
                    onChange={handleChange}
                    required
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label htmlFor="identifier">Correo electrónico o Número de teléfono</label>
              <input 
                type="text" 
                id="identifier" 
                name="identifier" 
                value={formData.identifier}
                onChange={handleChange}
                required
              />
            </div>

            {!isLogin && (
              <div className="form-group">
                <label htmlFor="confirmIdentifier">Confirmar Correo o Número</label>
                <input 
                  type="text" 
                  id="confirmIdentifier" 
                  name="confirmIdentifier" 
                  value={formData.confirmIdentifier}
                  onChange={handleChange}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <input 
                type="password" 
                id="password" 
                name="password" 
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block seller-auth-btn" disabled={loading}>
              {loading ? 'Cargando...' : (isLogin ? 'Continuar' : 'Enviar solicitud de vendedor')}
            </button>
          </form>

          <div className="auth-terms">
            Al {isLogin ? 'iniciar sesión' : 'solicitar una cuenta'}, aceptas las Condiciones de Uso y el Aviso de Privacidad de CubaAmazon para Vendedores.
          </div>
        </div>

        <div className="auth-toggle">
          <div className="divider-container">
            <div className="divider-line"></div>
            <div className="divider-text">
              {isLogin ? '¿Eres nuevo en CubaAmazon?' : '¿Ya tienes una cuenta?'}
            </div>
            <div className="divider-line"></div>
          </div>
          
          <button 
            className="btn btn-secondary btn-block auth-toggle-btn"
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? 'Solicitar cuenta de vendedor' : 'Inicia sesión'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default SellerAuth;
