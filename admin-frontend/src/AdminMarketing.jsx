import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Image as ImageIcon, X } from 'lucide-react';
import { getSettings, updateSetting, uploadImage } from './services/api';
import { cubaLocations } from './cubaLocations';
import './AdminMarketing.css';

const AdminMarketing = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const [formData, setFormData] = useState({
    image_url: '',
    title: '',
    subtitle: '',
    button_text: '',
    button_link: '',
    button_bg_color: '#ff9900',
    button_text_color: '#111111',
    target_locations: []
  });

  const [selectedProv, setSelectedProv] = useState('');
  const [selectedMun, setSelectedMun] = useState('');

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const settings = await getSettings();
      if (settings.hero_banners) {
        let bannersData = settings.hero_banners;
        if (typeof bannersData === 'string') {
          try {
            bannersData = JSON.parse(bannersData);
          } catch (e) {
            console.error('Error parsing banners:', e);
            bannersData = [];
          }
        }
        setBanners(Array.isArray(bannersData) ? bannersData : []);
      }
    } catch (error) {
      console.error('Error fetching banners:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (banner = null) => {
    if (banner) {
      setEditingBanner(banner);
      setFormData(banner);
    } else {
      setEditingBanner(null);
      setFormData({
        image_url: '',
        title: '',
        subtitle: '',
        button_text: '',
        button_link: '',
        button_bg_color: '#ff9900',
        button_text_color: '#111111',
        target_locations: []
      });
    }
    setSelectedProv('');
    setSelectedMun('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBanner(null);
  };

  const saveBanners = async (newBanners) => {
    try {
      await updateSetting('hero_banners', JSON.stringify(newBanners));
      setBanners(newBanners);
      handleCloseModal();
    } catch (error) {
      alert('Error al guardar los banners');
      console.error(error);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      setUploadingImage(true);
      const data = await uploadImage(file);
      setFormData({ ...formData, image_url: data.url });
    } catch (error) {
      alert('Error al subir la imagen. Intenta de nuevo.');
      console.error(error);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.image_url) {
      alert('La URL de la imagen es requerida');
      return;
    }

    let newBanners;
    if (editingBanner) {
      newBanners = banners.map(b => b.id === editingBanner.id ? { ...b, ...formData } : b);
    } else {
      const newBanner = {
        ...formData,
        id: `banner-${Date.now()}`,
        is_active: true
      };
      newBanners = [...banners, newBanner];
    }
    saveBanners(newBanners);
  };

  const handleDelete = (id) => {
    if (window.confirm('¿Estás seguro de eliminar este banner?')) {
      const newBanners = banners.filter(b => b.id !== id);
      saveBanners(newBanners);
    }
  };

  const handleAddLocation = () => {
    if (!selectedProv) return;
    const locString = selectedProv === 'Toda Cuba' ? 'Toda Cuba:Toda Cuba' : `${selectedProv}:${selectedMun || 'Toda la provincia'}`;
    
    if (!formData.target_locations) {
      setFormData({ ...formData, target_locations: [locString] });
    } else if (!formData.target_locations.includes(locString)) {
      setFormData({ ...formData, target_locations: [...formData.target_locations, locString] });
    }
    
    setSelectedProv('');
    setSelectedMun('');
  };

  const handleRemoveLocation = (locToRemove) => {
    setFormData({
      ...formData,
      target_locations: formData.target_locations.filter(loc => loc !== locToRemove)
    });
  };

  if (loading) return <div className="admin-loading">Cargando datos de marketing...</div>;

  return (
    <div className="admin-marketing">
      <div className="page-header">
        <h1>Marketing y Banners</h1>
        <p>Administra los banners promocionales que aparecen en la página principal.</p>
      </div>

      <div className="marketing-content">
        <div className="marketing-section">
          <div className="section-header">
            <h2>Carrusel Principal (Hero Banners)</h2>
            <button className="btn-add" onClick={() => handleOpenModal()}>
              <Plus size={18} /> Agregar Banner
            </button>
          </div>

          {banners.length === 0 ? (
            <div className="empty-state">
              <ImageIcon size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
              <h3>No hay banners activos</h3>
              <p>Agrega banners para que se muestren en la página de inicio de la tienda.</p>
            </div>
          ) : (
            <div className="banners-list">
              {banners.map((banner) => (
                <div key={banner.id} className="banner-item">
                  <div className="banner-item-image">
                    <img src={banner.image_url} alt={banner.title || 'Banner'} />
                  </div>
                  <div className="banner-item-details">
                    <h3 className="banner-item-title">{banner.title || '(Sin Título)'}</h3>
                    <p className="banner-item-subtitle">{banner.subtitle}</p>
                    {banner.button_link && (
                      <a href={banner.button_link} className="banner-item-link" target="_blank" rel="noreferrer">
                        Botón: {banner.button_text} &rarr; {banner.button_link}
                      </a>
                    )}
                    <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {(!banner.target_locations || banner.target_locations.length === 0) ? (
                        <span style={{ fontSize: '11px', backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: '10px' }}>Toda Cuba</span>
                      ) : (
                        banner.target_locations.map(loc => (
                          <span key={loc} style={{ fontSize: '11px', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '10px' }}>
                            {loc.replace(':', ' - ')}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="banner-item-actions">
                    <button className="btn-icon edit" onClick={() => handleOpenModal(banner)} title="Editar">
                      <Edit2 size={18} />
                    </button>
                    <button className="btn-icon delete" onClick={() => handleDelete(banner.id)} title="Eliminar">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingBanner ? 'Editar Banner' : 'Nuevo Banner'}</h2>
              <button className="close-btn" onClick={handleCloseModal}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Subir Imagen (JPG/PNG) *</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input 
                    type="file" 
                    accept="image/jpeg, image/png, image/jpg"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    style={{ flex: 1 }}
                  />
                  {uploadingImage && <span style={{ fontSize: '12px', color: '#64748b' }}>Subiendo...</span>}
                </div>
                {formData.image_url && (
                  <div style={{ marginTop: '10px', borderRadius: '4px', overflow: 'hidden', width: '100px', height: '60px' }}>
                    <img src={formData.image_url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Título Principal</label>
                <input 
                  type="text" 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  placeholder="Ej. Ofertas de Verano"
                />
              </div>
              <div className="form-group">
                <label>Subtítulo</label>
                <textarea 
                  value={formData.subtitle} 
                  onChange={e => setFormData({...formData, subtitle: e.target.value})}
                  placeholder="Ej. Descubre los mejores productos al mejor precio"
                  rows="2"
                />
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Texto del Botón</label>
                  <input 
                    type="text" 
                    value={formData.button_text} 
                    onChange={e => setFormData({...formData, button_text: e.target.value})}
                    placeholder="Ej. Comprar ahora"
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Enlace del Botón</label>
                  <input 
                    type="text" 
                    value={formData.button_link} 
                    onChange={e => setFormData({...formData, button_link: e.target.value})}
                    placeholder="Ej. /stores"
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '15px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Color de Fondo del Botón</label>
                  <input 
                    type="color" 
                    value={formData.button_bg_color || '#ff9900'} 
                    onChange={e => setFormData({...formData, button_bg_color: e.target.value})}
                    style={{ width: '100%', height: '40px', padding: '0', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '4px' }}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Color del Texto del Botón</label>
                  <input 
                    type="color" 
                    value={formData.button_text_color || '#111111'} 
                    onChange={e => setFormData({...formData, button_text_color: e.target.value})}
                    style={{ width: '100%', height: '40px', padding: '0', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '4px' }}
                  />
                </div>
              </div>
              
              <div className="form-group" style={{ marginTop: '15px' }}>
                <label>Ubicaciones Destino (Si no seleccionas ninguna, el banner saldrá en Toda Cuba)</label>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <select 
                    value={selectedProv} 
                    onChange={e => { setSelectedProv(e.target.value); setSelectedMun(''); }}
                    style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                  >
                    <option value="">Seleccionar Provincia</option>
                    <option value="Toda Cuba">Toda Cuba</option>
                    {Object.keys(cubaLocations).map(prov => (
                      <option key={prov} value={prov}>{prov}</option>
                    ))}
                  </select>
                  
                  {selectedProv && selectedProv !== 'Toda Cuba' && (
                    <select 
                      value={selectedMun} 
                      onChange={e => setSelectedMun(e.target.value)}
                      style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    >
                      <option value="">Toda la provincia</option>
                      {cubaLocations[selectedProv].map(mun => (
                        <option key={mun} value={mun}>{mun}</option>
                      ))}
                    </select>
                  )}
                  
                  <button 
                    type="button" 
                    onClick={handleAddLocation}
                    disabled={!selectedProv}
                    style={{ padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: selectedProv ? 'pointer' : 'not-allowed', opacity: selectedProv ? 1 : 0.6 }}
                  >
                    Agregar Zona
                  </button>
                </div>
                
                {formData.target_locations && formData.target_locations.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                    {formData.target_locations.map(loc => (
                      <span key={loc} style={{ backgroundColor: '#e2e8f0', padding: '4px 10px', borderRadius: '15px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {loc.replace(':', ' - ')}
                        <X size={14} style={{ cursor: 'pointer', color: '#64748b' }} onClick={() => handleRemoveLocation(loc)} />
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={handleCloseModal}>Cancelar</button>
                <button type="submit" className="btn-save">Guardar Banner</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMarketing;
