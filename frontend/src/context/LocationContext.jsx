import React, { createContext, useState, useContext, useEffect } from 'react';

const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
  const [location, setLocation] = useState(() => {
    const savedProv = localStorage.getItem('user_province');
    const savedMun = localStorage.getItem('user_municipality');
    return {
      province: savedProv || '',
      municipality: savedMun || ''
    };
  });

  const updateLocation = (province, municipality) => {
    localStorage.setItem('user_province', province);
    localStorage.setItem('user_municipality', municipality);
    setLocation({ province, municipality });
  };

  return (
    <LocationContext.Provider value={{ location, updateLocation }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => useContext(LocationContext);
