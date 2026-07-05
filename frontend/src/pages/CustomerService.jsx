import React, { useState } from 'react';
import './CustomerService.css';
import { Search, Package, RefreshCcw, User, ChevronDown, ChevronUp } from 'lucide-react';

const CustomerService = () => {
  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: '¿Cómo puedo rastrear mi pedido?',
      a: 'Puedes rastrear tu pedido yendo a "Tus Pedidos" en el menú principal. Haz clic en el pedido que deseas rastrear para ver su estado actual y la fecha de entrega estimada.'
    },
    {
      q: '¿Cuál es la política de devoluciones?',
      a: 'Ofrecemos devoluciones gratuitas dentro de los 30 días posteriores a la entrega. Los artículos deben estar en su estado y empaque original.'
    },
    {
      q: '¿Cómo cancelo un pedido?',
      a: 'Si tu pedido aún no ha sido enviado, puedes cancelarlo desde la sección "Tus Pedidos" haciendo clic en el botón "Cancelar Producto".'
    },
    {
      q: 'Mi paquete dice entregado pero no lo he recibido',
      a: 'A veces los transportistas marcan los paquetes como entregados hasta 48 horas antes. Te sugerimos revisar con tus vecinos o áreas comunes. Si después de 48 horas no llega, contáctanos.'
    }
  ];

  return (
    <div className="customer-service-container">
      <div className="cs-hero">
        <h1>¿En qué podemos ayudarte?</h1>
        <div className="cs-search-bar">
          <input type="text" placeholder="Buscar ayuda (ej. rastrear pedido, devoluciones)" />
          <button><Search size={20} /></button>
        </div>
      </div>

      <div className="cs-content">
        <h2>Temas más consultados</h2>
        <div className="cs-grid">
          <div className="cs-card">
            <Package size={40} className="cs-icon" />
            <h3>Tus Pedidos</h3>
            <p>Rastrear paquetes, editar o cancelar pedidos</p>
          </div>
          <div className="cs-card">
            <RefreshCcw size={40} className="cs-icon" />
            <h3>Devoluciones</h3>
            <p>Devolver o reemplazar artículos, imprimir etiquetas</p>
          </div>
          <div className="cs-card">
            <User size={40} className="cs-icon" />
            <h3>Tu Cuenta</h3>
            <p>Gestionar preferencias y direcciones</p>
          </div>
        </div>

        <div className="cs-faq-section">
          <h2>Preguntas Frecuentes</h2>
          <div className="cs-faqs">
            {faqs.map((faq, index) => (
              <div 
                key={index} 
                className={`cs-faq-item ${openFaq === index ? 'active' : ''}`}
                onClick={() => toggleFaq(index)}
              >
                <div className="cs-faq-question">
                  <span>{faq.q}</span>
                  {openFaq === index ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
                {openFaq === index && (
                  <div className="cs-faq-answer">
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="cs-contact-box">
          <h2>¿Necesitas más ayuda?</h2>
          <p>Nuestro equipo está disponible 24/7 para asistirte en todo lo que necesites.</p>
          <button className="cs-contact-btn">Contáctanos</button>
        </div>
      </div>
    </div>
  );
};

export default CustomerService;
