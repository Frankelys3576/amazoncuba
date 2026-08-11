import React, { useEffect, useRef } from 'react';
import { defaultCoordinates } from '../utils/cubaLocations';
import './LocationPinPicker.css';

const LocationPinPicker = ({ lat, lng, province, municipality, onLocationChange }) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  // Initial center coordinates
  const getInitialCoords = () => {
    if (lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
      return { lat: parseFloat(lat), lng: parseFloat(lng) };
    }
    if (municipality && defaultCoordinates[municipality]) {
      return defaultCoordinates[municipality];
    }
    if (province && defaultCoordinates[province]) {
      return defaultCoordinates[province];
    }
    return { lat: 23.1136, lng: -82.3666 }; // Default La Habana
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (typeof window === 'undefined' || !window.L) return;

    const L = window.L;
    const initialCoords = getInitialCoords();

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current).setView([initialCoords.lat, initialCoords.lng], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors | CubaAirbnb'
      }).addTo(map);

      // Custom marker icon with house emoji
      const customIcon = L.divIcon({
        className: 'custom-pin-picker-marker',
        html: `<div class="pin-picker-bubble">🏡 <span class="pin-text">Mi Hostal</span></div>`,
        iconSize: [80, 36],
        iconAnchor: [40, 36]
      });

      const marker = L.marker([initialCoords.lat, initialCoords.lng], {
        icon: customIcon,
        draggable: true
      }).addTo(map);

      marker.on('dragend', () => {
        const position = marker.getLatLng();
        onLocationChange({
          lat: position.lat.toFixed(6),
          lng: position.lng.toFixed(6)
        });
      });

      map.on('click', (e) => {
        const { lat: newLat, lng: newLng } = e.latlng;
        marker.setLatLng([newLat, newLng]);
        onLocationChange({
          lat: newLat.toFixed(6),
          lng: newLng.toFixed(6)
        });
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
    } else {
      const map = mapInstanceRef.current;
      const marker = markerRef.current;

      const currentLatLng = getInitialCoords();
      map.setView([currentLatLng.lat, currentLatLng.lng], map.getZoom() < 10 ? 12 : map.getZoom());
      if (marker) {
        marker.setLatLng([currentLatLng.lat, currentLatLng.lng]);
      }
    }
  }, [province, municipality]);

  // Sync marker position if lat/lng props change externally
  useEffect(() => {
    if (markerRef.current && lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
      const newLat = parseFloat(lat);
      const newLng = parseFloat(lng);
      markerRef.current.setLatLng([newLat, newLng]);
    }
  }, [lat, lng]);

  return (
    <div className="location-pin-picker">
      <div className="pin-picker-header">
        <strong>📍 Marca la ubicación exacta de tu hostal en el mapa:</strong>
        <span className="pin-picker-hint">Haz clic en el mapa o arrastra el pin 🏡</span>
      </div>
      <div ref={mapContainerRef} className="pin-picker-map"></div>
      <div className="pin-picker-coords">
        <span><strong>Latitud:</strong> {lat || 'Sin marcar'}</span>
        <span><strong>Longitud:</strong> {lng || 'Sin marcar'}</span>
      </div>
    </div>
  );
};

export default LocationPinPicker;
