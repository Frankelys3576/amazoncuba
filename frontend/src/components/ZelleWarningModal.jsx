import React from 'react';
import './ZelleWarningModal.css';

const ZelleWarningModal = ({ isOpen, onClose, storePhone, storeName }) => {
  if (!isOpen) return null;

  // Formatear el teléfono para que tenga el código de Cuba si no lo tiene
  const formattedPhone = storePhone ? (storePhone.replace(/[^0-9]/g, '').startsWith('53') ? storePhone.replace(/[^0-9]/g, '') : `53${storePhone.replace(/[^0-9]/g, '')}`) : '';

  return (
    <div className="zelle-warning-overlay" onClick={onClose}>
      <div className="zelle-warning-content" onClick={e => e.stopPropagation()}>
        <div className="zelle-warning-icon">⚠️</div>
        <h2 className="zelle-warning-title">Aviso Importante</h2>
        <p className="zelle-warning-text">
          Antes de realizar cualquier pedido por Zelle, por favor <strong>consulta la disponibilidad</strong> del producto con el vendedor.
        </p>
        
        <div className="zelle-warning-actions">
          {storePhone ? (
            <>
              <a 
                href={`https://wa.me/${formattedPhone}?text=Hola,%20quisiera%20consultar%20disponibilidad%20en%20tu%20tienda${storeName ? ` ${storeName}` : ''}.`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn zelle-btn-whatsapp"
              >
                💬 Escribir por WhatsApp
              </a>
              <a 
                href={`tel:+${formattedPhone}`} 
                className="btn zelle-btn-call"
              >
                📞 Llamar al Vendedor
              </a>
            </>
          ) : (
            <p className="zelle-warning-nophone">El vendedor no ha registrado un número de teléfono.</p>
          )}
          <button className="btn zelle-btn-close" onClick={onClose}>
            Entendido, Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ZelleWarningModal;
