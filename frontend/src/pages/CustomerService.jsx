import React from 'react';
import { Link } from 'react-router-dom';
import { HeadphonesIcon } from 'lucide-react';
import './CustomerService.css';

// La página anterior tenía contenido de relleno (política de devoluciones
// que no aplica al negocio real, una barra de búsqueda y un botón
// "Contáctanos" que no hacían nada) -- se deja en "Próximamente" hasta que
// se construya de verdad, en vez de mostrar algo que parece funcionar pero
// no hace nada.
const CustomerService = () => {
  return (
    <div className="customer-service-container">
      <div className="cs-coming-soon">
        <HeadphonesIcon size={48} className="cs-coming-soon-icon" />
        <h1>Servicio al Cliente</h1>
        <p className="cs-coming-soon-tag">Próximamente</p>
        <p className="cs-coming-soon-text">
          Estamos preparando esta sección. Mientras tanto, si necesitas ayuda con un pedido,
          puedes contactar directamente a la tienda desde la página del producto.
        </p>
        <Link to="/" className="btn btn-primary">Volver al inicio</Link>
      </div>
    </div>
  );
};

export default CustomerService;
