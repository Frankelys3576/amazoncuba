import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Filter, Map as MapIcon, EyeOff, Home, Star, CheckCircle } from 'lucide-react';
import { getStores } from '../services/api';
import { cubaLocations } from '../utils/cubaLocations';
import HostalMap from '../components/HostalMap';
import './CubaBnB.css';

const CubaBnB = () => {
  const [hostals, setHostals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedMunicipality, setSelectedMunicipality] = useState('');
  const [showMap, setShowMap] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchHostals();
  }, []);

  const fetchHostals = async () => {
    setLoading(true);
    try {
      // Fetch stores with store_type = hostal
      const data = await getStores('hostal');
      setHostals(data || []);
    } catch (err) {
      console.error('Error loading hostals:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter hostals client-side for immediate responsiveness
  const filteredHostals = hostals.filter(hostal => {
    const matchesSearch = !searchQuery.trim() || 
      hostal.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hostal.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hostal.address?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesProv = !selectedProvince || (hostal.province && hostal.province.toLowerCase() === selectedProvince.toLowerCase());
    const matchesMun = !selectedMunicipality || (hostal.municipality && hostal.municipality.toLowerCase() === selectedMunicipality.toLowerCase());

    return matchesSearch && matchesProv && matchesMun;
  });

  return (
    <div className="cubabnb-container">
      {/* Hero Banner */}
      <div className="cubabnb-hero">
        <div className="container cubabnb-hero-content">
          <div className="hero-badge">🏡 Cuba Rbnb</div>
          <h1>Alquiler de Casas y Hostales en Cuba</h1>
          <p>Descubre hospedajes únicos, casas particulares y villas en todas las provincias de Cuba.</p>
        </div>
      </div>

      <div className="container cubabnb-content">
        {/* Filter & Search Bar */}
        <div className="cubabnb-filter-card card">
          <div className="filter-row">
            {/* Buscador */}
            <div className="filter-group search-group">
              <label><Search size={16} /> Buscar Hostal</label>
              <input
                type="text"
                placeholder="Nombre, dirección o descripción..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="cubabnb-input"
              />
            </div>

            {/* Selector Provincia */}
            <div className="filter-group">
              <label><MapPin size={16} /> Provincia</label>
              <select
                value={selectedProvince}
                onChange={(e) => {
                  setSelectedProvince(e.target.value);
                  setSelectedMunicipality('');
                }}
                className="cubabnb-select"
              >
                <option value="">Todas las provincias</option>
                {Object.keys(cubaLocations).map(prov => (
                  <option key={prov} value={prov}>{prov}</option>
                ))}
              </select>
            </div>

            {/* Selector Municipio */}
            <div className="filter-group">
              <label><Filter size={16} /> Municipio</label>
              <select
                value={selectedMunicipality}
                onChange={(e) => setSelectedMunicipality(e.target.value)}
                disabled={!selectedProvince}
                className="cubabnb-select"
              >
                <option value="">Todos los municipios</option>
                {selectedProvince && cubaLocations[selectedProvince]?.map(mun => (
                  <option key={mun} value={mun}>{mun}</option>
                ))}
              </select>
            </div>

            {/* Botón Ocultar / Mostrar Mapa */}
            <div className="filter-group toggle-map-group">
              <label>&nbsp;</label>
              <button 
                type="button" 
                className={`btn btn-toggle-map ${showMap ? 'active' : ''}`}
                onClick={() => setShowMap(!showMap)}
              >
                {showMap ? (
                  <> <EyeOff size={18} /> Ocultar Mapa </>
                ) : (
                  <> <MapIcon size={18} /> Mostrar Mapa </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mapa Interactivo (si está visible) */}
        {showMap && (
          <div className="cubabnb-map-section">
            <div className="section-title-row">
              <h3>📍 Mapa de Hostales Disponibles ({filteredHostals.length})</h3>
              <span className="map-subtext">Haz clic en los pines para ver detalles del hospedaje</span>
            </div>
            <HostalMap 
              hostals={filteredHostals} 
              onHostalSelect={(hostal) => setSelectedHostal(hostal)}
            />
          </div>
        )}

        {/* Grid de Hostales */}
        <div className="cubabnb-list-section">
          <div className="section-title-row">
            <h2>Casas y Hostales ({filteredHostals.length})</h2>
            {selectedProvince && (
              <span className="location-pill">
                📍 {selectedMunicipality ? `${selectedMunicipality}, ` : ''}{selectedProvince}
              </span>
            )}
          </div>

          {loading ? (
            <div className="cubabnb-loading">Cargando hospedajes disponibles en Cuba...</div>
          ) : filteredHostals.length === 0 ? (
            <div className="cubabnb-empty card">
              <Home size={48} color="#94a3b8" />
              <h3>No se encontraron hostales</h3>
              <p>Intenta cambiar los filtros de provincia o búsqueda para encontrar otras opciones de alojamiento.</p>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setSearchQuery('');
                  setSelectedProvince('');
                  setSelectedMunicipality('');
                }}
              >
                Limpiar Filtros
              </button>
            </div>
          ) : (
            <div className="cubabnb-grid">
              {filteredHostals.map(hostal => {
                const phoneFormatted = hostal.phone ? hostal.phone.replace(/[^0-9]/g, '') : '';
                const cleanPhone = phoneFormatted.startsWith('53') ? phoneFormatted : `53${phoneFormatted}`;

                return (
                  <div key={hostal.id} className="hostal-card card">
                    <div className="hostal-image-container">
                      <img 
                        src={hostal.banner_url || hostal.logo_url || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600'} 
                        alt={hostal.name} 
                        className="hostal-image"
                      />
                      <div className="hostal-badge">
                        <CheckCircle size={14} /> Cuba Rbnb
                      </div>
                      {hostal.price_per_night && (
                        <div className="hostal-price-badge">
                          ${hostal.price_per_night} <span>/ noche</span>
                        </div>
                      )}
                    </div>

                    <div className="hostal-card-content">
                      <div className="hostal-location-text">
                        📍 {hostal.municipality || 'Cuba'}, {hostal.province || ''}
                      </div>

                      <h3 className="hostal-card-title">{hostal.name}</h3>

                      <div className="hostal-rating-row">
                        <div className="stars" style={{ display: 'flex', gap: '2px', color: '#f59e0b' }}>
                          {[1,2,3,4,5].map(i => (
                            <Star key={i} size={14} fill="#f59e0b" />
                          ))}
                        </div>
                        <span className="rating-score">4.9 (Excelente)</span>
                      </div>

                      <p className="hostal-description">
                        {hostal.description || 'Hermoso alojamiento vacacional con comodidades para estancia confortable en Cuba.'}
                      </p>

                      {hostal.address && (
                        <div className="hostal-address">
                          <strong>Dirección:</strong> {hostal.address}
                        </div>
                      )}

                      <div className="hostal-card-actions">
                        {hostal.phone && (
                          <a 
                            href={`https://wa.me/${cleanPhone}?text=Hola!%20Me%20interesa%20reservar%20estancia%20en%20su%20hostal%20${encodeURIComponent(hostal.name)}.`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="btn btn-whatsapp-hostal"
                            title="Consultar disponibilidad por WhatsApp"
                          >
                            💬 WhatsApp
                          </a>
                        )}
                        <Link 
                          to={`/negocio/${hostal.slug || hostal.id}`} 
                          className="btn btn-primary-hostal"
                        >
                          Ver Hostal y Reservar
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CubaBnB;
