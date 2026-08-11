import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Image, Phone, AlignLeft, Save, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';
import { getStoreById, updateStoreProfile, uploadImage, deleteAccount } from './services/api';
import { cubaLocations } from './utils/cubaLocations';
import LocationPinPicker from './components/LocationPinPicker';
import './SellerProfile.css';

const SellerProfile = () => {
  const navigate = useNavigate();
  const storeId = localStorage.getItem('seller_store_id');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [uploading, setUploading] = useState({ logo: false, banner: false });
  
  const [formData, setFormData] = useState({
    name: '',
    slogan: '',
    description: '',
    phone: '',
    logo_url: '',
    banner_url: '',
    is_open: true,
    has_delivery: false,
    opening_time: '09:00',
    closing_time: '18:00',
    store_type: 'business',
    province: 'La Habana',
    municipality: 'La Habana Vieja',
    address: '',
    lat: '23.1367',
    lng: '-82.3584',
    price_per_night: ''
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!storeId) return;
        const data = await getStoreById(storeId);
        if (data) {
          setFormData({
            name: data.name || '',
            slogan: data.slogan || '',
            description: data.description || '',
            phone: data.phone || '',
            logo_url: data.logo_url || '',
            banner_url: data.banner_url || '',
            is_open: data.is_open !== false, // defaults true
            has_delivery: data.has_delivery || false,
            opening_time: data.opening_time || '09:00',
            closing_time: data.closing_time || '18:00',
            store_type: data.store_type || 'business',
            province: data.province || 'La Habana',
            municipality: data.municipality || 'La Habana Vieja',
            address: data.address || '',
            lat: data.lat !== null && data.lat !== undefined ? String(data.lat) : '23.1367',
            lng: data.lng !== null && data.lng !== undefined ? String(data.lng) : '-82.3584',
            price_per_night: data.price_per_night || ''
          });
        }
      } catch (err) {
        console.error('Error fetching store profile:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfile();
  }, [storeId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleImageUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(prev => ({ ...prev, [type]: true }));
    try {
      const result = await uploadImage(file);
      setFormData(prev => ({ ...prev, [`${type}_url`]: result.url }));
      setMessage({ text: `Imagen subida correctamente.`, type: 'success' });
    } catch (error) {
      console.error(error);
      setMessage({ text: error.message || 'Error al subir la imagen.', type: 'error' });
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ text: '', type: '' });
    
    try {
      await updateStoreProfile(storeId, formData);
      setMessage({ text: 'Perfil de tienda actualizado correctamente.', type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 4000);
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Error al actualizar el perfil. Intenta de nuevo.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmMessage = "⚠️ ADVERTENCIA CRÍTICA ⚠️\n\n¿Estás absolutamente seguro de que deseas ELIMINAR PARA SIEMPRE tu cuenta de vendedor, tu tienda y TODOS tus productos?\n\nEsta acción NO se puede deshacer.";
    
    if (window.confirm(confirmMessage)) {
      try {
        setSaving(true);
        await deleteAccount(storeId);
        alert('Tu cuenta y tu tienda han sido eliminadas exitosamente.');
        localStorage.removeItem('seller_store_id');
        localStorage.removeItem('seller_token');
        localStorage.removeItem('seller_name');
        navigate('/login');
      } catch (error) {
        console.error(error);
        alert('Hubo un error al intentar eliminar la cuenta. Por favor, contacta al soporte.');
        setSaving(false);
      }
    }
  };

  if (loading) {
    return <div className="seller-loading">Cargando perfil...</div>;
  }

  return (
    <div className="seller-profile">
      <div className="page-header">
        <h1>Mi Tienda</h1>
        <p>Personaliza cómo ven tu tienda los clientes en AmasonCubano.</p>
      </div>

      {message.text && (
        <div className={`alert-message ${message.type}`}>
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="profile-container">

        {/* Vista previa en tiempo real */}
        <div className="profile-preview-card">
          <h3>Vista Previa</h3>
          <div className="preview-store">
            <div 
              className="preview-banner" 
              style={{ backgroundImage: `url(${formData.banner_url || 'https://via.placeholder.com/800x200?text=Banner+de+Tienda'})` }}
            ></div>
            <div className="preview-content">
              <img 
                src={formData.logo_url || 'https://via.placeholder.com/150'} 
                alt="Logo" 
                className="preview-logo" 
              />
              <div className="preview-details">
                <h2>{formData.name || 'Nombre de la Tienda'}</h2>
                <p className="preview-slogan">{formData.slogan || 'Eslogan de tu tienda...'}</p>
                <div style={{ fontSize: '13px', color: '#ff385c', fontWeight: 'bold', margin: '4px 0 8px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  🔗 Enlace público: <a href={`https://amasoncubano.com/${formData.slug || (formData.name ? formData.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')}`} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>amasoncubano.com/{formData.slug || (formData.name ? formData.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')}</a>
                </div>
                {formData.phone && (
                  <div className="preview-phone">
                    <Phone size={14} /> +{formData.phone}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Formulario de edición */}
        <form className="profile-form card" onSubmit={handleSubmit}>
          
          <div className="profile-header" style={{flexDirection: 'column', alignItems: 'flex-start', gap: '20px'}}>
            <div className="profile-header-text" style={{width: '100%'}}>
              <h2>Información de la Tienda</h2>
              <p>Actualiza los datos públicos de tu negocio</p>
            </div>
            
            <div style={{display: 'flex', gap: '20px', flexWrap: 'wrap', width: '100%'}}>
              <div className="store-status-toggle" style={{flex: '1 1 200px'}}>
                <label className="toggle-label" style={{flexDirection: 'column', alignItems: 'flex-start', gap: '8px'}}>
                  <span className={`status-indicator ${formData.is_open ? 'open' : 'closed'}`}>
                    {formData.is_open ? 'Tienda Activa' : 'Ventas Pausadas'}
                  </span>
                  <div style={{display: 'flex', alignItems: 'center', gap: '10px', width: '100%', justifyContent: 'space-between'}}>
                    <span style={{fontSize: '14px', color: '#666'}}>{formData.is_open ? 'Pausar temporalmente' : 'Reactivar tienda'}</span>
                    <div className="toggle-switch">
                      <input 
                        type="checkbox" 
                        name="is_open"
                        checked={formData.is_open} 
                        onChange={handleChange} 
                      />
                      <span className="slider round"></span>
                    </div>
                  </div>
                </label>
              </div>

              <div className="store-status-toggle" style={{flex: '1 1 200px'}}>
                <label className="toggle-label" style={{flexDirection: 'column', alignItems: 'flex-start', gap: '8px'}}>
                  <span className={`status-indicator ${formData.has_delivery ? 'open' : ''}`}>
                    {formData.has_delivery ? '🚚 Con Envío' : 'Sin Envío'}
                  </span>
                  <div style={{display: 'flex', alignItems: 'center', gap: '10px', width: '100%', justifyContent: 'space-between'}}>
                    <span style={{fontSize: '14px', color: '#666'}}>{formData.has_delivery ? 'Desactivar domicilio' : 'Activar domicilio'}</span>
                    <div className="toggle-switch">
                      <input 
                        type="checkbox" 
                        name="has_delivery"
                        checked={formData.has_delivery} 
                        onChange={handleChange} 
                      />
                      <span className="slider round"></span>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="profile-header-actions" style={{marginTop: '10px', width: '100%'}}>
              <h3 style={{fontSize: '16px', marginBottom: '10px', color: '#333'}}>Horario de Atención</h3>
              <div style={{display: 'flex', gap: '20px', flexWrap: 'wrap'}}>
                <div className="form-group" style={{flex: '1 1 150px'}}>
                  <label htmlFor="opening_time">Abre a las</label>
                  <input 
                    type="time" 
                    id="opening_time" 
                    name="opening_time" 
                    value={formData.opening_time} 
                    onChange={handleChange} 
                    required 
                  />
                </div>
                <div className="form-group" style={{flex: '1 1 150px'}}>
                  <label htmlFor="closing_time">Cierra a las</label>
                  <input 
                    type="time" 
                    id="closing_time" 
                    name="closing_time" 
                    value={formData.closing_time} 
                    onChange={handleChange} 
                    required 
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3><Store size={18}/> Información General</h3>
            <div className="form-group">
              <label htmlFor="name">Nombre de la Tienda *</label>
              <input 
                type="text" 
                id="name" 
                name="name" 
                value={formData.name} 
                onChange={handleChange} 
                required 
              />
            </div>
            <div className="form-group">
              <label htmlFor="slogan">Eslogan (Frase corta atractiva)</label>
              <input 
                type="text" 
                id="slogan" 
                name="slogan" 
                value={formData.slogan} 
                onChange={handleChange} 
                placeholder="Ej: La mejor tecnología al mejor precio" 
                maxLength={60}
              />
            </div>
            <div className="form-group">
              <label htmlFor="description">
                <AlignLeft size={16} /> Descripción de la Tienda
              </label>
              <textarea 
                id="description" 
                name="description" 
                rows="4" 
                value={formData.description} 
                onChange={handleChange}
                placeholder="Cuéntale a tus clientes quién eres y qué vendes..."
              ></textarea>
            </div>
          </div>

          <div className="form-section">
            <h3>🏡 Ubicación y Configuración CubaAirbnb (Hostal)</h3>
            <div className="form-group">
              <label htmlFor="store_type">Tipo de Negocio</label>
              <select
                id="store_type"
                name="store_type"
                value={formData.store_type}
                onChange={handleChange}
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc', width: '100%', fontWeight: 'bold' }}
              >
                <option value="business">Negocio / Tienda / Servicio</option>
                <option value="individual">Vendedor Independiente</option>
                <option value="hostal">🏡 Hostal / Casa de Renta (CubaAirbnb)</option>
              </select>
              <small>Los negocios marcados como Hostal aparecerán en la sección **CubaAirbnb** con mapa interactivo.</small>
            </div>

            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '15px' }}>
              <div className="form-group" style={{ flex: '1 1 200px' }}>
                <label htmlFor="province">Provincia</label>
                <select
                  id="province"
                  name="province"
                  value={formData.province}
                  onChange={(e) => {
                    const newProv = e.target.value;
                    const defaultMun = cubaLocations[newProv]?.[0] || '';
                    setFormData(prev => ({ ...prev, province: newProv, municipality: defaultMun }));
                  }}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc', width: '100%' }}
                >
                  {Object.keys(cubaLocations).map(prov => (
                    <option key={prov} value={prov}>{prov}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ flex: '1 1 200px' }}>
                <label htmlFor="municipality">Municipio</label>
                <select
                  id="municipality"
                  name="municipality"
                  value={formData.municipality}
                  onChange={handleChange}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc', width: '100%' }}
                >
                  {(cubaLocations[formData.province] || []).map(mun => (
                    <option key={mun} value={mun}>{mun}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '15px' }}>
              <label htmlFor="address">Dirección Exacta</label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Ej: Calle Obispo #254 e/ Habana y Compostela"
              />
            </div>

            {formData.store_type === 'hostal' && (
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '15px', borderRadius: '8px', marginTop: '15px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#166534' }}>🏡 Ubicación Exacta y Detalles del Hostal</h4>
                
                <LocationPinPicker
                  lat={formData.lat}
                  lng={formData.lng}
                  province={formData.province}
                  municipality={formData.municipality}
                  onLocationChange={({ lat, lng }) => setFormData(prev => ({ ...prev, lat, lng }))}
                />

                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: '1 1 150px' }}>
                    <label htmlFor="price_per_night">Precio por Noche (USD/CUP)</label>
                    <input
                      type="number"
                      step="0.01"
                      id="price_per_night"
                      name="price_per_night"
                      value={formData.price_per_night}
                      onChange={handleChange}
                      placeholder="Ej: 35"
                    />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 150px' }}>
                    <label htmlFor="lat">Latitud GPS</label>
                    <input
                      type="text"
                      id="lat"
                      name="lat"
                      value={formData.lat}
                      onChange={handleChange}
                      placeholder="23.1367"
                    />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 150px' }}>
                    <label htmlFor="lng">Longitud GPS</label>
                    <input
                      type="text"
                      id="lng"
                      name="lng"
                      value={formData.lng}
                      onChange={handleChange}
                      placeholder="-82.3584"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="form-section">
            <h3><Image size={18}/> Imágenes (Archivos PNG o JPG)</h3>
            <div className="form-group">
              <label htmlFor="logo_upload">Subir Logo</label>
              <input 
                type="file" 
                id="logo_upload" 
                accept="image/png, image/jpeg, image/jpg"
                onChange={(e) => handleImageUpload(e, 'logo')}
                disabled={uploading.logo}
              />
              <small>Recomendado: Imagen cuadrada (1:1). {uploading.logo && 'Subiendo...'}</small>
              
              {/* Mantener input oculto para los datos del formulario si se requiere */}
              {formData.logo_url && <small style={{color: '#25d366'}}>✓ Logo cargado</small>}
            </div>
            
            <div className="form-group">
              <label htmlFor="banner_upload">Subir Banner</label>
              <input 
                type="file" 
                id="banner_upload" 
                accept="image/png, image/jpeg, image/jpg"
                onChange={(e) => handleImageUpload(e, 'banner')}
                disabled={uploading.banner}
              />
              <small>Recomendado: Imagen ancha (16:9 o 21:9). {uploading.banner && 'Subiendo...'}</small>
              
              {formData.banner_url && <small style={{color: '#25d366'}}>✓ Banner cargado</small>}
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary save-btn" disabled={saving}>
              {saving ? 'Guardando...' : <><Save size={18}/> Guardar Cambios</>}
            </button>
          </div>
          
          <div className="danger-zone">
            <h3><AlertCircle size={18} color="#ef4444" /> Zona de Peligro</h3>
            <p>Una vez que elimines tu cuenta, no hay vuelta atrás. Por favor, asegúrate bien.</p>
            <button 
              type="button" 
              className="btn btn-danger delete-account-btn" 
              onClick={handleDeleteAccount}
              disabled={saving}
            >
              <Trash2 size={18}/> Eliminar cuenta para siempre
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SellerProfile;
