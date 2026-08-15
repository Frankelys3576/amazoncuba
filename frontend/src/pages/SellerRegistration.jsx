import React, { useState } from 'react';
import { registerSeller, loginSeller } from '../services/api';
import { cubaLocations, defaultCoordinates } from '../utils/cubaLocations';
import LocationPinPicker from '../components/LocationPinPicker';
import AddressInputWithAutocomplete from '../components/AddressInputWithAutocomplete';
import './SellerRegistration.css';

const SellerRegistration = () => {
  const [isLogin, setIsLogin] = useState(true);

  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    identifier: '',
    password: '',
    fullName: '',
    storeName: '',
    storeType: 'business',
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
        const cleanPhone = formData.phone.replace(/[^0-9]/g, '');
        const formattedEmail = `${cleanPhone}@amasoncubano.com`;

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
          alert('¡Tu cuenta ha sido registrada con éxito! Ya puedes acceder a tu panel.');
          window.location.href = "https://seller-cuba-amazon.vercel.app/login";
        } else {
          alert('Solicitud enviada correctamente. Tu cuenta está en proceso de activación.');
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
    <div className="seller-auth-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', width: '100%', padding: '20px 12px', minHeight: 'calc(100vh - 120px)', backgroundColor: '#f8fafc', boxSizing: 'border-box' }}>
      <div className="auth-container" style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '16px', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', margin: 0 }}>AmasonCubano</h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>Panel de Vendedores y Hostales</p>
        </div>

        {/* Selector de Modo Limpio */}
        <div style={{ display: 'flex', background: '#e2e8f0', padding: '4px', borderRadius: '10px', width: '100%', boxSizing: 'border-box' }}>
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(''); }}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              borderRadius: '7px',
              background: isLogin ? '#ffffff' : 'transparent',
              color: isLogin ? '#0f172a' : '#64748b',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: isLogin ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(''); }}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              borderRadius: '7px',
              background: !isLogin ? '#ffffff' : 'transparent',
              color: !isLogin ? '#0f172a' : '#64748b',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: !isLogin ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            Crear Cuenta
          </button>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '12px', padding: '20px 16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', width: '100%', boxSizing: 'border-box' }}>
        {error && (
          <div style={{ color: '#b91c1c', marginBottom: '15px', padding: '10px', backgroundColor: '#fef2f2', border: '1px solid #fecdd3', borderRadius: '6px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {!isLogin && (
            <>
              {/* Selector sencillo de Tipo de Negocio */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, storeType: 'business' }))}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: formData.storeType !== 'hostal' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: formData.storeType !== 'hostal' ? '#eff6ff' : '#ffffff',
                    color: formData.storeType !== 'hostal' ? '#1d4ed8' : '#475569',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  🏪 Tienda / Vendedor
                </button>

                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, storeType: 'hostal' }))}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: formData.storeType === 'hostal' ? '2px solid #ff385c' : '1px solid #cbd5e1',
                    background: formData.storeType === 'hostal' ? '#fff1f2' : '#ffffff',
                    color: formData.storeType === 'hostal' ? '#e11d48' : '#475569',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  🏡 Hostal (CubaAirbnb)
                </button>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>Nombre y Apellidos *</label>
                <input 
                  type="text" 
                  name="fullName" 
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="Propietario del negocio"
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>
                  {formData.storeType === 'hostal' ? 'Nombre del Hostal *' : 'Nombre de la Tienda *'}
                </label>
                <input 
                  type="text" 
                  name="storeName" 
                  value={formData.storeName}
                  onChange={handleChange}
                  placeholder={formData.storeType === 'hostal' ? 'Ej: Hostal Colonial' : 'Ej: Mi Tienda'}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              {formData.storeType === 'hostal' && (
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>📍 Datos de Ubicación y Hostal</span>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>Provincia *</label>
                      <select
                        name="province"
                        value={formData.province}
                        onChange={handleProvinceChange}
                        required={formData.storeType === 'hostal'}
                        style={{ width: '100%', padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white' }}
                      >
                        <option value="">Seleccionar</option>
                        {Object.keys(cubaLocations).map(prov => (
                          <option key={prov} value={prov}>{prov}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>Municipio *</label>
                      <select
                        name="municipality"
                        value={formData.municipality}
                        onChange={handleMunicipalityChange}
                        required={formData.storeType === 'hostal'}
                        style={{ width: '100%', padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white' }}
                      >
                        <option value="">Seleccionar</option>
                        {(cubaLocations[formData.province] || []).map(muni => (
                          <option key={muni} value={muni}>{muni}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <AddressInputWithAutocomplete
                    address={formData.address}
                    province={formData.province}
                    municipality={formData.municipality}
                    onChangeAddress={(newAddr) => setFormData(prev => ({ ...prev, address: newAddr }))}
                    onSelectSuggestion={({ address: selectedAddr, lat, lng }) => {
                      setFormData(prev => ({
                        ...prev,
                        address: selectedAddr,
                        lat: lat ? lat.toString() : prev.lat,
                        lng: lng ? lng.toString() : prev.lng
                      }));
                    }}
                    required={formData.storeType === 'hostal'}
                  />

                  <LocationPinPicker
                    lat={formData.lat}
                    lng={formData.lng}
                    province={formData.province}
                    municipality={formData.municipality}
                    onLocationChange={({ lat, lng }) => setFormData(prev => ({ ...prev, lat, lng }))}
                  />

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>Precio por Noche ($ USD/CUP) *</label>
                    <input
                      type="number"
                      step="0.01"
                      name="price_per_night"
                      placeholder="Ej: 35.00"
                      value={formData.price_per_night}
                      onChange={handleChange}
                      required={formData.storeType === 'hostal'}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>Teléfono / WhatsApp *</label>
                <input 
                  type="tel" 
                  name="phone" 
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+53 51234567"
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
            </>
          )}

          {isLogin && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>Correo electrónico o Teléfono</label>
              <input 
                type="text" 
                name="identifier" 
                value={formData.identifier}
                onChange={handleChange}
                placeholder="correo@ejemplo.com o 51234567"
                required
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>Contraseña *</label>
            <input 
              type="password" 
              name="password" 
              value={formData.password}
              onChange={handleChange}
              required
              style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '11px',
              borderRadius: '6px',
              border: 'none',
              background: '#0f172a',
              color: '#ffffff',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
              marginTop: '4px'
            }}
          >
            {loading ? 'Procesando...' : (isLogin ? 'Iniciar Sesión' : 'Registrar Cuenta')}
          </button>
        </form>
      </div>
    </div>
  </div>
);
};

export default SellerRegistration;
