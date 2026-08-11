import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { registerSeller, loginSeller } from '../services/api';
import { cubaLocations, defaultCoordinates } from '../utils/cubaLocations';
import LocationPinPicker from '../components/LocationPinPicker';
import './SellerRegistration.css';

const SellerRegistration = ({ initialRegister = true }) => {
  const location = useLocation();
  const [isLogin, setIsLogin] = useState(() => {
    if (initialRegister !== undefined) return !initialRegister;
    return !location.pathname.includes('register') && !location.pathname.includes('signup');
  });

  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    identifier: '',
    password: '',
    fullName: '',
    storeName: '',
    storeType: 'hostal',
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
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
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
      if (isLogin) {
        const formattedEmail = formData.identifier.includes('@') 
          ? formData.identifier.toLowerCase().trim()
          : `${formData.identifier.trim()}@amasoncubano.com`;

        const response = await loginSeller(formattedEmail, formData.password);
        if (response.store && response.store.id) {
          localStorage.setItem('seller_store_id', response.store.id.toString());
        }
        localStorage.setItem('seller_token', response.session?.access_token || 'mock_token');
        const fullName = response.user?.user_metadata?.full_name || response.user?.email || 'Vendedor';
        localStorage.setItem('seller_name', fullName);
        
        window.location.href = "https://seller-cuba-amazon.vercel.app/dashboard";
      } else {
        const formattedEmail = formData.email.includes('@') 
          ? formData.email.toLowerCase().trim()
          : `${formData.email.trim()}@amasoncubano.com`;

        const regResponse = await registerSeller({
          email: formattedEmail,
          phone: formData.phone,
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
          alert('¡Tu cuenta ha sido aprobada automáticamente! Ya puedes acceder a tu panel de control.');
          window.location.href = "https://seller-cuba-amazon.vercel.app/login";
        } else {
          alert('Solicitud enviada correctamente. Tu cuenta está pendiente de aprobación por el Administrador.');
          setIsLogin(true);
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al procesar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="seller-auth-page" style={{ padding: '40px 20px', maxWidth: '550px', margin: '0 auto' }}>
      <div className="auth-container" style={{ width: '100%' }}>
        
        <div className="auth-logo" style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '26px', margin: 0, fontWeight: 'bold' }}>AmasonCubano</h1>
          <span style={{ fontSize: '15px', color: '#64748b', display: 'block', marginTop: '4px' }}>
            Registro Oficial de Negocios y Hostales CubaAirbnb
          </span>
        </div>

        <div style={{ display: 'flex', width: '100%', marginBottom: '15px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9' }}>
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(''); }}
            style={{
              flex: 1,
              padding: '12px 10px',
              border: 'none',
              backgroundColor: isLogin ? '#2563eb' : 'transparent',
              color: isLogin ? '#ffffff' : '#475569',
              fontWeight: 'bold',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            🔑 Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(''); }}
            style={{
              flex: 1,
              padding: '12px 10px',
              border: 'none',
              backgroundColor: !isLogin ? '#ff385c' : 'transparent',
              color: !isLogin ? '#ffffff' : '#475569',
              fontWeight: 'bold',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            📝 Registrar Negocio / Hostal
          </button>
        </div>

        <div className="auth-card" style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
          <h2 style={{ marginTop: 0, marginBottom: '15px', fontSize: '20px' }}>{isLogin ? 'Iniciar sesión en tu cuenta' : 'Solicitar Registro de Vendedor o Hostal'}</h2>
          
          {error && <div className="auth-error" style={{color: 'red', marginBottom: '15px', padding: '10px', backgroundColor: '#fee2e2', borderRadius: '5px', fontSize: '14px'}}>{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {!isLogin && (
              <>
                <div style={{ padding: '10px', backgroundColor: '#eef2ff', borderRadius: '6px', fontSize: '13px', color: '#002a8f' }}>
                  Las cuentas de vendedor e hostal se procesan de inmediato. Rellena tus datos para enviar la solicitud.
                </div>

                <div style={{ marginBottom: '10px' }}>
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
                        gap: '12px'
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
                        gap: '12px'
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

                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Nombre y Apellidos del Propietario *</label>
                  <input 
                    type="text" 
                    name="fullName" 
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                    {formData.storeType === 'hostal' ? 'Nombre de tu Hostal / Casa Particular *' : 'Nombre de tu Tienda o Negocio *'}
                  </label>
                  <input 
                    type="text" 
                    name="storeName" 
                    value={formData.storeName}
                    onChange={handleChange}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                  />
                </div>

                <div style={{ padding: '12px 14px', backgroundColor: formData.storeType === 'hostal' ? '#fff1f2' : '#f8fafc', border: formData.storeType === 'hostal' ? '1px solid #fecdd3' : '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: 0, fontWeight: 'bold', color: formData.storeType === 'hostal' ? '#be123c' : '#334155', fontSize: '14px' }}>
                    <input 
                      type="checkbox"
                      name="isHostalCheckbox"
                      checked={formData.storeType === 'hostal'}
                      onChange={(e) => setFormData(prev => ({ ...prev, storeType: e.target.checked ? 'hostal' : 'business' }))}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#ff385c' }}
                    />
                    🏡 Marcar esta casilla si mi negocio es un Hostal / Casa Particular (CubaAirbnb)
                  </label>
                </div>

                {formData.storeType === 'hostal' && (
                  <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <h4 style={{ margin: '0 0 12px 0', color: '#0f172a', fontSize: '15px', fontWeight: 'bold' }}>🏡 Ubicación Exacta y Datos de CubaAirbnb</h4>
                    
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Provincia en Cuba *</label>
                      <select
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
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Municipio *</label>
                        <select
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

                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Dirección Exacta *</label>
                      <input
                        type="text"
                        name="address"
                        placeholder="Ej: Calle Martí #120 e/ Castillo y Libertad"
                        value={formData.address}
                        onChange={handleChange}
                        required={formData.storeType === 'hostal'}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}
                      />
                    </div>

                    <LocationPinPicker
                      lat={formData.lat}
                      lng={formData.lng}
                      province={formData.province}
                      municipality={formData.municipality}
                      onLocationChange={({ lat, lng }) => setFormData(prev => ({ ...prev, lat, lng }))}
                    />

                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Tarifa por Noche ($ USD/CUP) *</label>
                      <input
                        type="number"
                        step="0.01"
                        name="price_per_night"
                        placeholder="Ej: 35.00"
                        value={formData.price_per_night}
                        onChange={handleChange}
                        required={formData.storeType === 'hostal'}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Descripción del Hostal</label>
                      <textarea
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

            {isLogin ? (
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Correo electrónico o Número de teléfono</label>
                <input 
                  type="text" 
                  name="identifier" 
                  value={formData.identifier}
                  onChange={handleChange}
                  placeholder="ejemplo@gmail.com o 52583549"
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                />
              </div>
            ) : (
              <>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Correo electrónico *</label>
                  <input 
                    type="email" 
                    name="email" 
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="ejemplo@gmail.com"
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Número de Teléfono / WhatsApp *</label>
                  <input 
                    type="tel" 
                    name="phone" 
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Ej: +53 52583549"
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                  />
                </div>
              </>
            )}

            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Contraseña *</label>
              <input 
                type="password" 
                name="password" 
                value={formData.password}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
              />
            </div>

            <button type="submit" style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', marginTop: '10px' }} disabled={loading}>
              {loading ? 'Procesando...' : (isLogin ? 'Iniciar Sesión' : 'Enviar Solicitud de Registro')}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default SellerRegistration;
