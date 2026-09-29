import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import './BackButton.css';

// Flotante y fijo en vez de vivir dentro de cada página: así aparece en
// TODAS las pantallas del cliente con un solo componente, sin tener que
// tocar cada page.jsx uno por uno.
const BackButton = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // En el inicio no hay a dónde "volver" dentro del sitio -- mostrarlo ahí
  // solo invitaría a salir de la web (al referrer, o a ninguna parte si no
  // hay historial).
  if (location.pathname === '/') return null;

  const handleBack = () => {
    // Sin historial propio (llegaron por un link directo, no navegando
    // dentro del sitio), volver atrás no tiene a dónde ir -- se manda al
    // inicio en vez de dejar el botón sin hacer nada.
    if (window.history.length <= 1) {
      navigate('/');
      return;
    }
    navigate(-1);
  };

  return (
    <button className="back-floating-btn" onClick={handleBack} aria-label="Volver atrás">
      <ArrowLeft size={18} />
      <span>Atrás</span>
    </button>
  );
};

export default BackButton;
