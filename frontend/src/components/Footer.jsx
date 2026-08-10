import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="main-footer">
      <div className="footer-container">
        <div className="footer-section">
          <h3>CubaAmazon</h3>
          <p>Conectando negocios locales con clientes en toda Cuba. Compra rápido, seguro y cerca de ti.</p>
        </div>
        <div className="footer-section">
          <h3>Enlaces Útiles</h3>
          <ul>
            <li><Link to="/negocios">Directorio de Tiendas</Link></li>
            <li><Link to="/ofertas">Ofertas del Día</Link></li>
            <li><Link to="/servicio-cliente">Atención al Cliente</Link></li>
          </ul>
        </div>
        <div className="footer-section">
          <h3>Legal</h3>
          <ul>
            <li><Link to="/terminos" onClick={(e) => { e.preventDefault(); alert('Próximamente'); }}>Términos y Condiciones</Link></li>
            <li><Link to="/privacidad" onClick={(e) => { e.preventDefault(); alert('Próximamente'); }}>Política de Privacidad</Link></li>
            <li><Link to="/reembolsos" onClick={(e) => { e.preventDefault(); alert('Próximamente'); }}>Política de Reembolsos</Link></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} CubaAmazon. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
};

export default Footer;
