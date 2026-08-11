import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginSeller, registerSeller } from './services/api';
import { cubaLocations, defaultCoordinates } from './utils/cubaLocations';
import LocationPinPicker from './components/LocationPinPicker';
import './SellerAuth.css';

const SellerAuth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    identifier: '',
    confirmIdentifier: '',
    password: '',
    fullName: '',
    storeName: '',
    storeType: 'individual',
    province: '',
    municipality: '',
    address: '',
    price_per_night: '',
    lat: '',
    lng: '',
    description: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
  };

  const handleProvinceChange = (e) => {
    const prov = e.target.value;
    const defaultMuni = cubaLocations[prov]?.[0] || '';
    const coords = defaultCoordinates[defaultMuni] || defaultCoordinates[prov] || { lat: '', lng: '' };
    setFormData(prev => ({
      ...prev,
      province: prov,
      municipality: defaultMuni,
      lat: coords.lat ? coords.lat.toString() : prev.lat,
      lng: coords.lng ? coords.lng.toString() : prev.lng
    }));
  };

  const handleMunicipalityChange = (e) => {
    const muni = e.target.value;
    const coords = defaultCoordinates[muni] || defaultCoordinates[formData.province] || { lat: '', lng: '' };
    setFormData(prev => ({
      ...prev,
      municipality: muni,
      lat: coords.lat ? coords.lat.toString() : prev.lat,
      lng: coords.lng ? coords.lng.toString() : prev.lng
    }));
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
        : `${formData.identifier.trim()}@amasoncubano.com`;

      if (isLogin) {
        // Log in using backend
        const response = await loginSeller(formattedEmail, formData.password);
        
        // Guardar el store ID devuelto por el backend
        if (response.store && response.store.id) {
          localStorage.setItem('seller_store_id', response.store.id.toString());
        } else {
          // Fallback por si la tienda no se encontró, aunque no debería pasar si está bien registrada
          localStorage.setItem('seller_store_id', '1');
        }
        
        localStorage.setItem('seller_token', response.session?.access_token || 'mock_token');
        
        // Guardar nombre del vendedor para mostrarlo en el panel
        const fullName = response.user?.user_metadata?.full_name || response.user?.email || 'Vendedor';
        localStorage.setItem('seller_name', fullName);
        
        navigate('/dashboard');
      } else {
        // Validación de confirmación
        if (formData.identifier !== formData.confirmIdentifier) {
          setError('El correo electrónico o número de teléfono no coinciden.');
          setLoading(false);
          return;
        }

        // Register using backend
        const regResponse = await registerSeller({
          email: formattedEmail,
          password: formData.password,
          full_name: formData.fullName,
          store_name: formData.storeName,
          store_type: formData.storeType,
          province: formData.province,
          municipality: formData.municipality,
          address: formData.address,
          price_per_night: formData.price_per_night,
          lat: formData.lat,
          lng: formData.lng,
          description: formData.description
        });
        
        if (regResponse.autoApproved) {
          alert('¡Tu cuenta ha sido aprobada automáticamente! Ya puedes iniciar sesión.');
        } else {
          alert('Solicitud enviada correctamente. Tu cuenta está pendiente de aprobación por el Administrador.');
        }
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
          AmasonCubano <span style={{ fontSize: '18px', display: 'block', marginTop: '5px' }}>Regístrate para vender productos</span>
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

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '10px', color: '#0f172a' }}>
                    ¿Qué vas a registrar en AmasonCubano? *
                  </label>
                  <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                    <div
                      onClick={() => setFormData(prev => ({ ...prev, storeType: 'business' }))}
                      style={{
                        padding: '14px',
                        borderRadius: '10px',
                        border: formData.storeType !== 'hostal' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        backgroundColor: formData.storeType !== 'hostal' ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span style={{ fontSize: '26px' }}>🏪</span>
                      <div>
                        <div style={{ fontWeight: 'bold', color: formData.storeType !== 'hostal' ? '#1d4ed8' : '#1e293b', fontSize: '15px' }}>
                          Tienda o Vendedor de Productos
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          Para vender artículos, ropa, tecnología, combos de comida o servicios.
                        </div>
                      </div>
                    </div>

                    <div
                      onClick={() => setFormData(prev => ({ ...prev, storeType: 'hostal' }))}
                      style={{
                        padding: '14px',
                        borderRadius: '10px',
                        border: formData.storeType === 'hostal' ? '2px solid #ff385c' : '1px solid #cbd5e1',
                        backgroundColor: formData.storeType === 'hostal' ? '#fff1f2' : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span style={{ fontSize: '26px' }}>🏡</span>
                      <div>
                        <div style={{ fontWeight: 'bold', color: formData.storeType === 'hostal' ? '#e11d48' : '#1e293b', fontSize: '15px' }}>
                          Hostal / Casa de Renta (CubaAirbnb)
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          Para hospedar viajeros, colocar tu pin GPS en el mapa de Cuba y gestionar reservas.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="fullName">Nombre y Apellidos del Propietario *</label>
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
                  <label htmlFor="storeName">{formData.storeType === 'hostal' ? 'Nombre de tu Hostal / Casa Particular *' : 'Nombre de tu Tienda o Negocio *'}</label>
                  <input 
                    type="text" 
                    id="storeName" 
                    name="storeName" 
                    value={formData.storeName}
                    onChange={handleChange}
                    required
                  />
                </div>

                {formData.storeType === 'hostal' && (
                  <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '15px', marginBottom: '15px' }}>
                    <h4 style={{ margin: '0 0 12px 0', color: '#0f172a', fontSize: '15px', fontWeight: 'bold' }}>🏡 Ubicación Exacta y Datos de CubaAirbnb</h4>
                    
                    <div className="form-group" style={{ marginBottom: '10px' }}>
                      <label htmlFor="province">Provincia en Cuba *</label>
                      <select
                        id="province"
                        name="province"
                        value={formData.province}
                        onChange={handleProvinceChange}
                        required={formData.storeType === 'hostal'}
                        style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc', width: '100%', background: 'white' }}
                      >
                        <option value="">-- Seleccionar Provincia --</option>
                        {Object.keys(cubaLocations).map(prov => (
                          <option key={prov} value={prov}>{prov}</option>
                        ))}
                      </select>
                    </div>

                    {formData.province && (
                      <div className="form-group" style={{ marginBottom: '10px' }}>
                        <label htmlFor="municipality">Municipio *</label>
                        <select
                          id="municipality"
                          name="municipality"
                          value={formData.municipality}
                          onChange={handleMunicipalityChange}
                          required={formData.storeType === 'hostal'}
                          style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc', width: '100%', background: 'white' }}
                        >
                          <option value="">-- Seleccionar Municipio --</option>
                          {(cubaLocations[formData.province] || []).map(muni => (
                            <option key={muni} value={muni}>{muni}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="form-group" style={{ marginBottom: '10px' }}>
                      <label htmlFor="address">Dirección Exacta (Calle, entrecalles, número) *</label>
                      <input
                        type="text"
                        id="address"
                        name="address"
                        placeholder="Ej: Calle Martí #120 e/ Castillo y Libertad"
                        value={formData.address}
                        onChange={handleChange}
                        required={formData.storeType === 'hostal'}
                      />
                    </div>

                    <LocationPinPicker
                      lat={formData.lat}
                      lng={formData.lng}
                      province={formData.province}
                      municipality={formData.municipality}
                      onLocationChange={({ lat, lng }) => setFormData(prev => ({ ...prev, lat, lng }))}
                    />

                    <div className="form-group" style={{ marginBottom: '10px' }}>
                      <label htmlFor="price_per_night">Tarifa por Noche ($ USD/CUP) *</label>
                      <input
                        type="number"
                        step="0.01"
                        id="price_per_night"
                        name="price_per_night"
                        placeholder="Ej: 35.00"
                        value={formData.price_per_night}
                        onChange={handleChange}
                        required={formData.storeType === 'hostal'}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div className="form-group" style={{ flex: 1, marginBottom: '10px' }}>
                        <label htmlFor="lat">Latitud GPS (Mapa)</label>
                        <input
                          type="number"
                          step="any"
                          id="lat"
                          name="lat"
                          placeholder="Ej: 23.1381"
                          value={formData.lat}
                          onChange={handleChange}
                        />
                      </div>
                      <div className="form-group" style={{ flex: 1, marginBottom: '10px' }}>
                        <label htmlFor="lng">Longitud GPS (Mapa)</label>
                        <input
                          type="number"
                          step="any"
                          id="lng"
                          name="lng"
                          placeholder="Ej: -82.3532"
                          value={formData.lng}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                    <small style={{ display: 'block', color: '#64748b', fontSize: '11px', marginBottom: '10px' }}>
                      📍 Las coordenadas se autocalculan al elegir municipio. Puedes ajustarlas para que tu pin quede exacto en la calle de CubaAirbnb.
                    </small>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label htmlFor="description">Descripción del Hostal y Servicios</label>
                      <textarea
                        id="description"
                        name="description"
                        rows="2"
                        placeholder="Habitaciones privadas, Wifi, climatización, desayunos..."
                        value={formData.description}
                        onChange={handleChange}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', background: 'white' }}
                      />
                    </div>
                  </div>
                )}
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
            Al {isLogin ? 'iniciar sesión' : 'solicitar una cuenta'}, aceptas las Condiciones de Uso y el Aviso de Privacidad de AmasonCubano para Vendedores.
          </div>
        </div>

        <div className="auth-toggle">
          <div className="divider-container">
            <div className="divider-line"></div>
            <div className="divider-text">
              {isLogin ? '¿Eres nuevo en AmasonCubano?' : '¿Ya tienes una cuenta?'}
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
