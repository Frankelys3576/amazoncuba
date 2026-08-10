import React, { useEffect, useRef } from 'react';
import './HostalMap.css';

const HostalMap = ({ hostals, onHostalSelect }) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Check if window.L is available
    if (typeof window === 'undefined' || !window.L) {
      console.warn('Leaflet (window.L) not loaded yet.');
      return;
    }

    const L = window.L;

    // Initialize map if not initialized
    if (!mapInstanceRef.current) {
      // Default view centered over Cuba
      const map = L.map(mapContainerRef.current).setView([22.5, -79.5], 7);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors | CubaBnB'
      }).addTo(map);

      markersGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;

    // Clear existing markers
    markersGroup.clearLayers();

    if (hostals && hostals.length > 0) {
      const bounds = [];

      hostals.forEach(hostal => {
        const lat = parseFloat(hostal.lat) || (hostal.zelle_info?.lat) || 23.1367;
        const lng = parseFloat(hostal.lng) || (hostal.zelle_info?.lng) || -82.3584;

        if (isNaN(lat) || isNaN(lng)) return;

        bounds.push([lat, lng]);

        // Custom marker icon with house emoji style
        const customIcon = L.divIcon({
          className: 'custom-hostal-marker',
          html: `<div class="marker-pin">🏡 <span class="marker-price">$${hostal.price_per_night || 35}</span></div>`,
          iconSize: [60, 36],
          iconAnchor: [30, 36]
        });

        const marker = L.marker([lat, lng], { icon: customIcon });

        const popupContent = `
          <div class="map-popup-card">
            <img src="${hostal.banner_url || hostal.logo_url || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400'}" alt="${hostal.name}" class="map-popup-img" />
            <div class="map-popup-body">
              <h4 class="map-popup-title">${hostal.name}</h4>
              <p class="map-popup-location">📍 ${hostal.municipality || ''}, ${hostal.province || ''}</p>
              ${hostal.price_per_night ? `<div class="map-popup-price">$${hostal.price_per_night} <span style="font-size: 11px; font-weight: normal; color: #666;">/ noche</span></div>` : ''}
              <a href="/negocio/${hostal.slug || hostal.id}" class="map-popup-btn">Ver Hostal y Reservar</a>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);
        
        marker.on('click', () => {
          if (onHostalSelect) onHostalSelect(hostal);
        });

        markersGroup.addLayer(marker);
      });

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    }

  }, [hostals, onHostalSelect]);

  return (
    <div className="hostal-map-wrapper">
      <div ref={mapContainerRef} className="hostal-leaflet-map"></div>
    </div>
  );
};

export default HostalMap;
