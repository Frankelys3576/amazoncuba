import React, { useState, useEffect, useRef } from 'react';
import './AddressInputWithAutocomplete.css';

const AddressInputWithAutocomplete = ({
  address,
  province,
  municipality,
  onChangeAddress,
  onSelectSuggestion,
  required = false
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!address || address.trim().length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const queryParts = [address.trim()];
        if (municipality) queryParts.push(municipality);
        if (province) queryParts.push(province);
        queryParts.push('Cuba');

        const query = queryParts.join(', ');
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=cu&limit=5`,
          {
            headers: {
              'Accept-Language': 'es,en'
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            const formatted = data.map(item => ({
              id: item.place_id,
              displayName: item.display_name.replace(', Cuba', ''),
              shortName: item.name || item.display_name.split(',')[0],
              lat: item.lat,
              lng: item.lon
            }));
            setSuggestions(formatted);
            setShowDropdown(true);
          } else {
            const photonRes = await fetch(
              `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&bbox=-84.95,19.8,-74.13,23.27&limit=5`
            );
            if (photonRes.ok) {
              const photonData = await photonRes.json();
              if (photonData.features && photonData.features.length > 0) {
                const formatted = photonData.features.map(f => {
                  const p = f.properties;
                  const parts = [p.name, p.locality, p.district, p.city, p.state].filter(Boolean);
                  return {
                    id: p.osm_id || Math.random(),
                    displayName: parts.join(', '),
                    shortName: p.name || parts[0],
                    lat: f.geometry.coordinates[1].toString(),
                    lng: f.geometry.coordinates[0].toString()
                  };
                });
                setSuggestions(formatted);
                setShowDropdown(true);
              } else {
                setSuggestions([]);
              }
            }
          }
        }
      } catch (err) {
        console.error('Error in address autocomplete:', err);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [address, province, municipality]);

  const handleSelect = (suggestion) => {
    onSelectSuggestion({
      address: suggestion.displayName,
      lat: suggestion.lat,
      lng: suggestion.lng
    });
    setShowDropdown(false);
  };

  return (
    <div className="address-autocomplete-wrapper" ref={wrapperRef}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>
        Dirección Exacta *
      </label>
      <div className="address-input-container">
        <input
          type="text"
          name="address"
          value={address}
          onChange={(e) => {
            onChangeAddress(e.target.value);
            setShowDropdown(true);
          }}
          placeholder="Ej: Calle Martí #120 e/ Castillo y Libertad"
          required={required}
          autoComplete="off"
          style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
        />
        {loading && <span className="address-spinner">⌛</span>}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <ul className="address-suggestions-dropdown">
          {suggestions.map((item) => (
            <li key={item.id} onClick={() => handleSelect(item)} className="suggestion-item">
              <span className="suggestion-icon">📍</span>
              <div className="suggestion-text">
                <strong>{item.shortName}</strong>
                <small>{item.displayName}</small>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AddressInputWithAutocomplete;
