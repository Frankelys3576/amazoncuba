import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, Store, AlertCircle, Info } from 'lucide-react';
import { getStores, updateStoreStatus, getAdminStoreDetails, updateZelleConfig } from './services/api';
import './AdminStores.css';

const AdminStores = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = searchParams.get('filter') || 'pending';
  
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(initialFilter);
  const [dateFilter, setDateFilter] = useState('all');
  const [customDates, setCustomDates] = useState({ start: '', end: '' });

  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [storeDetails, setStoreDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [zelleConfig, setZelleConfig] = useState({
    accepts_zelle: false,
    name: '',
    email_phone: '',
    description: ''
  });
  const [savingZelle, setSavingZelle] = useState(false);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const data = await getStores();
      setStores(data);
    } catch (error) {
      console.error('Error fetching stores:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (storeId, newStatus) => {
    try {
      await updateStoreStatus(storeId, newStatus);
      setStores(stores.map(store => 
        store.id === storeId ? { ...store, status: newStatus } : store
      ));
    } catch (error) {
      alert('Error al actualizar el estado de la tienda.');
    }
  };

  const handleViewDetails = async (storeId) => {
    setSelectedStoreId(storeId);
    setDetailsLoading(true);
    try {
      const details = await getAdminStoreDetails(storeId);
      setStoreDetails(details);
      setZelleConfig({
        accepts_zelle: details.store.accepts_zelle || false,
        name: details.store.zelle_info?.name || '',
        email_phone: details.store.zelle_info?.email_phone || '',
        description: details.store.zelle_info?.description || ''
      });
    } catch (err) {
      alert("Error al cargar detalles");
      setSelectedStoreId(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setSelectedStoreId(null);
    setStoreDetails(null);
  };

  const handleSaveZelle = async () => {
    setSavingZelle(true);
    try {
      await updateZelleConfig(selectedStoreId, {
        accepts_zelle: zelleConfig.accepts_zelle,
        zelle_info: {
          name: zelleConfig.name,
          email_phone: zelleConfig.email_phone,
          description: zelleConfig.description
        }
      });
      alert('Configuración de Zelle guardada con éxito.');
      setStoreDetails(prev => ({
        ...prev,
        store: {
          ...prev.store,
          accepts_zelle: zelleConfig.accepts_zelle,
          zelle_info: {
            name: zelleConfig.name,
            email_phone: zelleConfig.email_phone,
            description: zelleConfig.description
          }
        }
      }));
    } catch (err) {
      alert('Error al guardar configuración de Zelle.');
    } finally {
      setSavingZelle(false);
    }
  };

  if (loading) return <div className="admin-loading">Cargando tiendas...</div>;

  const counts = {
    all: stores.length,
    pending: stores.filter(s => s.status === 'pending').length,
    approved: stores.filter(s => s.status === 'approved').length,
    rejected: stores.filter(s => s.status === 'rejected').length,
  };

  const filteredStores = stores.filter(store => {
    if (filter !== 'all' && store.status !== filter) return false;
    
    if (dateFilter !== 'all') {
      const now = new Date();
      const createdDate = new Date(store.created_at);
      
      if (dateFilter === 'day') {
        const today = new Date(now.setHours(0, 0, 0, 0));
        return createdDate >= today;
      } else if (dateFilter === 'week') {
        const lastWeek = new Date(now.setDate(now.getDate() - 7));
        return createdDate >= lastWeek;
      } else if (dateFilter === 'month') {
        const lastMonth = new Date(now.setMonth(now.getMonth() - 1));
        return createdDate >= lastMonth;
      } else if (dateFilter === 'custom' && customDates.start && customDates.end) {
        const start = new Date(customDates.start);
        const end = new Date(customDates.end);
        end.setHours(23, 59, 59, 999);
        return createdDate >= start && createdDate <= end;
      }
    }
    return true;
  });

  const tabs = [
    { id: 'all', label: 'Todos', icon: <Store size={16} />, count: counts.all },
    { id: 'pending', label: 'Pendientes', icon: <Clock size={16} />, count: counts.pending },
    { id: 'approved', label: 'Aprobados', icon: <CheckCircle size={16} />, count: counts.approved },
    { id: 'rejected', label: 'Rechazados', icon: <XCircle size={16} />, count: counts.rejected },
  ];

  const handleTabClick = (tabId) => {
    setFilter(tabId);
    setSearchParams({ filter: tabId });
  };

  return (
    <div className="admin-stores">
      <div className="page-header">
        <div>
          <h1>Gestión de Vendedores</h1>
          <p>Aprueba o rechaza solicitudes de nuevos vendedores en la plataforma.</p>
        </div>
        <div style={{display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', background: '#fff', padding: '10px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginTop: '15px'}}>
          <select 
            value={dateFilter} 
            onChange={(e) => setDateFilter(e.target.value)}
            style={{padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', outline: 'none'}}
          >
            <option value="all">Historico Total</option>
            <option value="day">Hoy</option>
            <option value="week">Últimos 7 días</option>
            <option value="month">Últimos 30 días</option>
            <option value="custom">Fecha Personalizada</option>
          </select>

          {dateFilter === 'custom' && (
            <div style={{display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'}}>
              <input 
                type="date" 
                value={customDates.start}
                onChange={(e) => setCustomDates({...customDates, start: e.target.value})}
                style={{padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0'}}
              />
              <span>-</span>
              <input 
                type="date" 
                value={customDates.end}
                onChange={(e) => setCustomDates({...customDates, end: e.target.value})}
                style={{padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0'}}
              />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="store-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`store-tab ${filter === tab.id ? 'active' : ''} ${tab.id === 'pending' && tab.count > 0 ? 'has-pending' : ''}`}
            onClick={() => handleTabClick(tab.id)}
          >
            {tab.icon}
            <span className="tab-label">{tab.label}</span>
            <span className={`tab-count ${tab.id}`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="stores-list">
        {filteredStores.length === 0 ? (
          <div className="empty-state">
            <AlertCircle size={48} />
            <h3>No hay negocios {filter === 'pending' ? 'pendientes' : filter === 'approved' ? 'aprobados' : filter === 'rejected' ? 'rechazados' : ''}</h3>
            <p>No se encontraron negocios con este filtro.</p>
          </div>
        ) : (
          filteredStores.map(store => (
            <div key={store.id} className="store-card">
              <div className="store-card-header">
                <div className="store-identity">
                  <div className="store-logo-wrapper">
                    {store.logo_url ? (
                      <img src={store.logo_url} alt={store.name} className="store-logo" />
                    ) : (
                      <div className="store-logo-placeholder">
                        <Store size={24} />
                      </div>
                    )}
                  </div>
                  <div className="store-info">
                    <h3>{store.name}</h3>
                    <span className={`status-badge ${store.status}`}>
                      {store.status === 'pending' && <Clock size={14} />}
                      {store.status === 'approved' && <CheckCircle size={14} />}
                      {store.status === 'rejected' && <XCircle size={14} />}
                      {store.status === 'pending' ? 'Pendiente' : 
                       store.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="store-card-body">
                <p>{store.description}</p>
                <div className="store-details" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
                  <span><strong>Teléfono:</strong> <a href={`tel:${store.phone}`} style={{ color: '#3b82f6' }}>{store.phone || 'No registrado'}</a></span>
                  <span><strong>Tipo:</strong> {store.store_type === 'hostal' ? '🏡 Hostal (Cuba Rbnb)' : store.store_type === 'business' ? '🏪 Negocio' : '👤 Particular'}</span>
                  <span><strong>ID Sistema:</strong> #{store.id}</span>
                  <span><strong>Nº Único:</strong> {store.store_number || 'N/A'}</span>
                  <span><strong>Fecha:</strong> {new Date(store.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="store-card-actions">
                <button 
                  className="btn btn-secondary" 
                  onClick={() => handleViewDetails(store.id)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                >
                  <Info size={16} /> Ver Detalles Completos
                </button>
              </div>

              <div className="store-card-actions" style={{ borderTop: 'none', paddingTop: 0 }}>
                {store.status === 'pending' ? (
                  <>
                    <button 
                      className="btn btn-primary approve-btn"
                      onClick={() => handleStatusChange(store.id, 'approved')}
                    >
                      <CheckCircle size={16} /> Aprobar
                    </button>
                    <button 
                      className="btn btn-secondary reject-btn"
                      onClick={() => handleStatusChange(store.id, 'rejected')}
                    >
                      <XCircle size={16} /> Rechazar
                    </button>
                  </>
                ) : (
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleStatusChange(store.id, store.status === 'approved' ? 'rejected' : 'approved')}
                  >
                    Cambiar a {store.status === 'approved' ? 'Rechazado' : 'Aprobado'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {selectedStoreId && (
        <div className="modal-overlay" onClick={closeDetails}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}>
            <div className="modal-header">
              <h2>Detalles Completos del Negocio</h2>
              <button className="close-btn" onClick={closeDetails}><XCircle size={24} /></button>
            </div>
            
            {detailsLoading ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>Cargando información...</div>
            ) : storeDetails ? (
              <div className="store-details-view">
                <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <img src={storeDetails.store.logo_url || 'https://via.placeholder.com/100'} alt="Logo" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                  <div>
                    <h3 style={{ margin: '0 0 5px 0', fontSize: '1.4rem', color: 'var(--text-main)' }}>{storeDetails.store.name}</h3>
                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>{storeDetails.store.slogan || 'Sin eslogan'}</p>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                      <span style={{ padding: '4px 10px', background: 'var(--bg-body)', color: 'var(--text-main)', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                        Nº Único: {storeDetails.store.store_number || 'N/A'}
                      </span>
                      <span style={{ padding: '4px 10px', background: 'var(--bg-body)', color: 'var(--text-main)', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                        ID Sistema: #{storeDetails.store.id}
                      </span>
                      <span style={{ padding: '4px 10px', background: '#3b82f6', color: 'white', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                        Tipo: {storeDetails.store.store_type === 'hostal' ? '🏡 Hostal (Cuba Rbnb)' : storeDetails.store.store_type === 'business' ? '🏪 Negocio con Local' : '👤 Vendedor Independiente'}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-body)', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-main)' }}>Estadísticas Clave</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--text-main)' }}>{storeDetails.activeProductsCount}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Productos Activos</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>{storeDetails.totalSalesCount}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Artículos Vendidos</div>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '20px', color: 'var(--text-main)', background: 'var(--bg-body)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 12px 0', color: 'var(--text-main)' }}>📞 Datos de Contacto y Cuenta</h4>
                  <p style={{ margin: '6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong>Teléfono / WhatsApp:</strong> 
                    <a href={`tel:${storeDetails.store.phone}`} style={{ color: '#3b82f6', fontWeight: 'bold' }}>{storeDetails.store.phone || 'No registrado'}</a>
                    {storeDetails.store.phone && (
                      <a 
                        href={`https://wa.me/${storeDetails.store.phone.replace(/[^0-9]/g, '')}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style={{ background: '#25d366', color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', textDecoration: 'none', fontWeight: 'bold' }}
                      >
                        💬 Abrir WhatsApp
                      </a>
                    )}
                  </p>
                  <p style={{ margin: '6px 0' }}><strong>Estado de la Tienda:</strong> {storeDetails.store.status === 'approved' ? '✅ Aprobado' : storeDetails.store.status === 'pending' ? '⏳ Pendiente' : '❌ Rechazado'}</p>
                  <p style={{ margin: '6px 0' }}><strong>Horario:</strong> {storeDetails.store.opening_time || '09:00'} - {storeDetails.store.closing_time || '18:00'} ({storeDetails.store.is_open ? 'Abierto' : 'Pausado'})</p>
                  <p style={{ margin: '6px 0' }}><strong>Fecha de Registro:</strong> {new Date(storeDetails.store.created_at).toLocaleDateString()} a las {new Date(storeDetails.store.created_at).toLocaleTimeString()}</p>
                </div>

                {(storeDetails.store.province || storeDetails.store.municipality || storeDetails.store.address || storeDetails.store.store_type === 'hostal') && (
                  <div style={{ marginBottom: '20px', color: 'var(--text-main)', background: 'var(--bg-body)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ margin: '0 0 12px 0', color: 'var(--text-main)' }}>📍 Ubicación y Cuba Rbnb</h4>
                    <p style={{ margin: '6px 0' }}><strong>Provincia:</strong> {storeDetails.store.province || 'No especificada'}</p>
                    <p style={{ margin: '6px 0' }}><strong>Municipio:</strong> {storeDetails.store.municipality || 'No especificado'}</p>
                    <p style={{ margin: '6px 0' }}><strong>Dirección Exacta:</strong> {storeDetails.store.address || 'No registrada'}</p>
                    {storeDetails.store.lat && storeDetails.store.lng && (
                      <p style={{ margin: '6px 0' }}><strong>Coordenadas GPS:</strong> Lat {storeDetails.store.lat}, Lng {storeDetails.store.lng}</p>
                    )}
                    {storeDetails.store.price_per_night && (
                      <p style={{ margin: '6px 0', color: '#ff385c', fontWeight: 'bold' }}><strong>Precio por Noche:</strong> ${storeDetails.store.price_per_night} USD/CUP</p>
                    )}
                  </div>
                )}

                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-main)' }}>Descripción</h4>
                  <p style={{ margin: 0, lineHeight: '1.5', color: 'var(--text-main)', background: 'var(--bg-body)', padding: '10px', borderRadius: '6px' }}>
                    {storeDetails.store.description || 'Sin descripción'}
                  </p>
                </div>
                
                {storeDetails.store.banner_url && (
                  <div>
                    <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-main)' }}>Banner de la Tienda</h4>
                    <img src={storeDetails.store.banner_url} alt="Banner" style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px' }} />
                  </div>
                )}

                <div style={{ marginTop: '30px', padding: '15px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 15px 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>Configuración de Pagos por Zelle</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                    <input 
                      type="checkbox" 
                      id="acceptsZelle"
                      checked={zelleConfig.accepts_zelle}
                      onChange={(e) => setZelleConfig({...zelleConfig, accepts_zelle: e.target.checked})}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <label htmlFor="acceptsZelle" style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>Habilitar pagos por Zelle para esta tienda</label>
                  </div>
                  
                  {zelleConfig.accepts_zelle && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Nombre del Titular (Zelle)</label>
                        <input 
                          type="text" 
                          value={zelleConfig.name}
                          onChange={(e) => setZelleConfig({...zelleConfig, name: e.target.value})}
                          placeholder="Ej. Juan Perez"
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-body)', color: 'var(--text-main)' }}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Correo / Teléfono registrado en Zelle</label>
                        <input 
                          type="text" 
                          value={zelleConfig.email_phone}
                          onChange={(e) => setZelleConfig({...zelleConfig, email_phone: e.target.value})}
                          placeholder="Ej. juan@zelle.com o +123456789"
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-body)', color: 'var(--text-main)' }}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Descripción / Instrucciones adicionales</label>
                        <textarea 
                          rows="2"
                          value={zelleConfig.description}
                          onChange={(e) => setZelleConfig({...zelleConfig, description: e.target.value})}
                          placeholder="Instrucciones que verá el cliente al pagar por Zelle..."
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-body)', color: 'var(--text-main)', resize: 'vertical' }}
                        />
                      </div>
                    </div>
                  )}
                  
                  <button 
                    onClick={handleSaveZelle}
                    disabled={savingZelle}
                    className="btn btn-primary"
                    style={{ marginTop: '15px', width: '100%', padding: '10px' }}
                  >
                    {savingZelle ? 'Guardando...' : 'Guardar Configuración Zelle'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center' }}>No se pudo cargar la información.</div>
            )}
            
            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button type="button" className="btn-cancel" onClick={closeDetails} style={{ width: '100%', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', borderColor: 'var(--border-color)' }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStores;
