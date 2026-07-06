import React, { useState, useEffect } from 'react';
import { Store, Image, MessageSquare, Phone, AlignLeft, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getStoreById, updateStoreProfile, uploadImage } from './services/api';
import './SellerProfile.css';

const SellerProfile = () => {
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
    banner_url: ''
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!storeId) return;
        const store = await getStoreById(storeId);
        if (store) {
          setFormData({
            name: store.name || '',
            slogan: store.slogan || '',
            description: store.description || '',
            phone: store.phone || '',
            logo_url: store.logo_url || '',
            banner_url: store.banner_url || ''
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
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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

  if (loading) {
    return <div className="seller-loading">Cargando perfil...</div>;
  }

  return (
    <div className="seller-profile">
      <div className="page-header">
        <h1>Mi Tienda</h1>
        <p>Personaliza cómo ven tu tienda los clientes en CubaAmazon.</p>
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
            <h3><MessageSquare size={18}/> Contacto</h3>
            <div className="form-group">
              <label htmlFor="phone">Teléfono / WhatsApp</label>
              <div className="input-with-icon">
                <Phone size={18} className="input-icon" />
                <input 
                  type="text" 
                  id="phone" 
                  name="phone" 
                  value={formData.phone} 
                  onChange={handleChange} 
                  placeholder="Ej: 5351234567" 
                />
              </div>
              <small>Incluye el código de país para que el botón de WhatsApp funcione bien.</small>
            </div>
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
        </form>
      </div>
    </div>
  );
};

export default SellerProfile;
