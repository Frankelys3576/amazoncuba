import React, { useState, useEffect } from 'react';
import { getSettings, updateSetting } from './services/api';
import './AdminSettings.css';

const AdminSettings = () => {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await getSettings();
      setSettings(data);
    } catch (err) {
      console.error('Error fetching settings:', err);
      setMessage('Error al cargar configuraciones.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key, currentValue) => {
    const newValue = currentValue === 'true' ? 'false' : 'true';
    setSettings(prev => ({ ...prev, [key]: newValue }));
    
    setSaving(true);
    setMessage('');
    
    try {
      await updateSetting(key, newValue);
      setMessage('Configuración guardada exitosamente.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setMessage('Error de conexión o al guardar.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="admin-loading">Cargando configuraciones...</div>;
  }

  const autoApprove = settings['auto_approve_sellers'] === 'true';

  return (
    <div className="admin-settings-container">
      <div className="admin-header">
        <h1>Configuraciones de la Plataforma</h1>
        <p>Ajusta el comportamiento general del marketplace.</p>
      </div>

      {message && <div className={`admin-alert ${message.includes('Error') ? 'error' : 'success'}`}>{message}</div>}

      <div className="settings-section">
        <h3>Registro de Vendedores</h3>
        <div className="setting-item">
          <div className="setting-info">
            <span className="setting-title">Aprobación Automática de Vendedores</span>
            <span className="setting-desc">Si está activado, los nuevos vendedores y sus tiendas serán aprobados automáticamente sin requerir revisión del administrador.</span>
          </div>
          <div className="setting-action">
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={autoApprove}
                onChange={() => handleToggle('auto_approve_sellers', settings['auto_approve_sellers'] || 'false')}
                disabled={saving}
              />
              <span className="slider round"></span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
