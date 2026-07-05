import React, { useState } from 'react';
import './SellerAuth.css';

const SellerAuth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    storeName: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Aquí iría la lógica para enviar a Supabase a través de nuestro backend
    console.log('Enviando datos:', formData);
    alert(isLogin 
      ? 'Iniciando sesión como vendedor...' 
      : 'Solicitud enviada. Tu cuenta de vendedor está pendiente de aprobación por un administrador.');
  };

  return (
    <div className="seller-auth-page">
      <div className="auth-container">
        
        <div className="auth-logo">
          CubaAmazon <span>Seller Central</span>
        </div>

        <div className="auth-card">
          <h2>{isLogin ? 'Iniciar sesión' : 'Solicitar cuenta'}</h2>
          
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
              <label htmlFor="email">Correo electrónico</label>
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

            <button type="submit" className="btn btn-primary btn-block auth-submit-btn">
              {isLogin ? 'Continuar' : 'Enviar solicitud de vendedor'}
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
