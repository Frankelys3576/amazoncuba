import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getProductById, getProducts, getStoreById, registerProductView, getProductReviews, addProductReview } from '../services/api';
import { useCart } from '../context/CartContext';
import ProductCard from '../components/ProductCard';
import { Star } from 'lucide-react';
import ZelleWarningModal from '../components/ZelleWarningModal';
import './ProductDetails.css';

const ProductDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [showContactModal, setShowContactModal] = useState(false);
  const [activeImage, setActiveImage] = useState('');
  const [productImages, setProductImages] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [newReview, setNewReview] = useState({ name: '', rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [isZelleModalOpen, setIsZelleModalOpen] = useState(false);
  const { addToCart } = useCart();

  useEffect(() => {
    window.scrollTo(0, 0); // Scroll to top when page loads
    
    const fetchProduct = async () => {
      const data = await getProductById(id);
      if (data) {
        if (data.store_id) {
          try {
            const storeData = await getStoreById(data.store_id);
            data.store_name = storeData?.name;
            data.store_slug = storeData?.slug || storeData?.id;
            data.store_phone = storeData?.phone;
            data.store_is_open = storeData?.is_open !== false; // defaults true
            data.store_has_delivery = storeData?.has_delivery || false;
            data.store_opening_time = storeData?.opening_time;
            data.store_closing_time = storeData?.closing_time;
            data.store_accepts_zelle = storeData?.accepts_zelle === true;
            
            if (storeData?.accepts_zelle === true) {
              const hasSeenWarning = sessionStorage.getItem(`zelle_warning_${storeData.id}`);
              if (!hasSeenWarning) {
                setIsZelleModalOpen(true);
                sessionStorage.setItem(`zelle_warning_${storeData.id}`, 'true');
              }
            }
          } catch (e) {
            console.error("Error fetching store for product", e);
            data.store_is_open = true; // safe fallback
          }
        }
        
        setProduct({ ...data });
        
        // Collect all valid image URLs
        const images = [data.image_url, data.image_url_2, data.image_url_3, data.image_url_4, data.image_url_5].filter(Boolean);
        setProductImages(images);
        if (images.length > 0) setActiveImage(images[0]);
      }
      if (data && data.category_id) {
        const related = await getProducts({ category: data.category_id });
        // Filter out the current product and take up to 4
        setRelatedProducts(related.filter(p => p.id !== data.id).slice(0, 4));
      }

      const reviewsData = await getProductReviews(id);
      setReviews(reviewsData);

      setLoading(false);
      
      // Registrar la vista del producto de forma silenciosa
      registerProductView(id);
    };
    fetchProduct();
  }, [id]);

  // Función compartida para revisar si la tienda está abierta
  const checkStoreIsOpen = (storeData) => {
    if (storeData.store_is_open === false) return false;
    if (!storeData.store_opening_time || !storeData.store_closing_time) return true;
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    const [openH, openM] = storeData.store_opening_time.split(':').map(Number);
    const [closeH, closeM] = storeData.store_closing_time.split(':').map(Number);
    
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    const openTimeMinutes = openH * 60 + (openM || 0);
    const closeTimeMinutes = closeH * 60 + (closeM || 0);
    
    if (closeTimeMinutes < openTimeMinutes) {
      return currentTimeMinutes >= openTimeMinutes || currentTimeMinutes <= closeTimeMinutes;
    }
    return currentTimeMinutes >= openTimeMinutes && currentTimeMinutes <= closeTimeMinutes;
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${m} ${ampm}`;
  };

  if (loading) return <div className="container" style={{padding: '40px 20px'}}>Cargando producto...</div>;
  if (!product) return <div className="container" style={{padding: '40px 20px'}}>Producto no encontrado.</div>;

  const isStoreCurrentlyOpen = checkStoreIsOpen(product);

  const handleAddToCart = () => {
    addToCart(product, quantity);
    if (product?.store_accepts_zelle) {
      setIsZelleModalOpen(true);
    }
  };

  const openContactModal = () => setShowContactModal(true);
  const closeContactModal = () => setShowContactModal(false);

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!newReview.name || !newReview.rating) return;
    setSubmittingReview(true);
    const addedReview = await addProductReview(id, {
      customer_name: newReview.name,
      rating: newReview.rating,
      comment: newReview.comment
    });
    if (addedReview) {
      setReviews([addedReview, ...reviews]);
      setNewReview({ name: '', rating: 5, comment: '' });
      // Update local product rating to reflect visually without full reload
      const newCount = (product.review_count || 0) + 1;
      const newTotal = (product.rating_avg || 0) * (product.review_count || 0) + newReview.rating;
      setProduct({
        ...product,
        review_count: newCount,
        rating_avg: (newTotal / newCount).toFixed(1)
      });
    }
    setSubmittingReview(false);
  };

  return (
    <div className="container product-details-container">
      <div className="product-details-content">
        
        {/* Columna Izquierda: Imagen */}
        <div className="product-image-section">
          {productImages.length > 1 && (
            <div className="product-thumbnails">
              {productImages.map((img, index) => (
                <img 
                  key={index} 
                  src={img} 
                  alt={`${product.name} - foto ${index + 1}`} 
                  className={`thumbnail ${activeImage === img ? 'active' : ''}`}
                  onMouseEnter={() => setActiveImage(img)}
                  onClick={() => setActiveImage(img)}
                />
              ))}
            </div>
          )}
          <div className="product-main-image-container">
            <img src={activeImage || product.image_url} alt={product.name} className="product-main-image" />
          </div>
        </div>

        {/* Columna Central: Información */}
        <div className="product-info-section">
          <h1 className="product-title">{product.name}</h1>
          <div className="product-card-rating" style={{marginBottom: '15px', cursor: 'pointer'}} onClick={() => document.getElementById('reviews-section').scrollIntoView({behavior: 'smooth'})}>
            <div className="stars">
              {[1,2,3,4,5].map(i => (
                <Star 
                  key={i} 
                  size={16} 
                  className={i <= Math.round(product.rating_avg || 0) ? 'star-filled' : 'star-empty'} 
                />
              ))}
            </div>
            <span className="review-count" style={{fontSize: '14px', color: '#007185'}}>{product.review_count || 0} calificaciones</span>
          </div>
          <hr className="divider" />
          <div className="product-price-large">
            <span className="price-symbol">$</span>
            <span className="price-whole">{Math.floor(parseFloat(product.price || 0))}</span>
            <span className="price-fraction">{(((parseFloat(product.price || 0)) % 1) * 100).toFixed(0).padStart(2, '0')}</span>
            <span style={{ fontSize: '14px', color: '#565959', marginLeft: '6px', verticalAlign: 'top' }}>{product.currency || 'USD'}</span>
            {product.store_accepts_zelle && product.price_usd && (
              <div style={{ fontSize: '18px', color: '#B12704', marginTop: '8px' }}>
                También disponible por: ${Number(product.price_usd).toFixed(2)} USD (Zelle)
              </div>
            )}
          </div>
          <hr className="divider" />
          <div className="product-description">
            <h3>Acerca de este artículo</h3>
            <div style={{marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '8px', border: '1px solid #eee'}}>
              <Link to={`/negocio/${product.store_slug}`} className="product-store-link" style={{fontSize: '16px', fontWeight: 'bold'}}>
                Visitar la tienda {product.store_name}
              </Link>
              <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center'}}>
                {product.store_has_delivery && (
                  <span style={{backgroundColor: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '15px', fontSize: '12px', fontWeight: 'bold'}}>
                    🚚 Con Envío
                  </span>
                )}
                <span className={isStoreCurrentlyOpen ? "status-indicator open" : "status-indicator closed"} style={{fontSize: '12px', padding: '3px 8px', borderRadius: '15px', backgroundColor: isStoreCurrentlyOpen ? '#dcfce7' : '#fee2e2'}}>
                  {product.store_is_open === false ? 'Pausada' : isStoreCurrentlyOpen ? 'Abierto Ahora' : 'Cerrado Ahora'}
                </span>
                {product.store_opening_time && product.store_closing_time && (
                  <span style={{fontSize: '12px', color: '#666'}}>
                    🕒 {formatTime(product.store_opening_time)} - {formatTime(product.store_closing_time)}
                  </span>
                )}
              </div>
            </div>
            <p>{product.description}</p>
          </div>
        </div>

        {/* Columna Derecha: Panel de Compra */}
        <div className="product-buy-section">
          {product.store_has_delivery && (
            <div style={{backgroundColor: '#e0f2fe', color: '#0369a1', padding: '10px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', marginBottom: '15px', textAlign: 'center'}}>
              🚚 Esta tienda ofrece servicio a domicilio
            </div>
          )}
          <div className="buy-panel">
            <div className="buy-panel-price">
              ${parseFloat(product.price || 0).toFixed(2)} {product.currency || 'USD'}
              {product.store_accepts_zelle && product.price_usd && (
                <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>
                  / ${Number(product.price_usd).toFixed(2)} USD
                </div>
              )}
            </div>
            <div className="buy-panel-stock">
              {product.store_is_open === false ? (
                <span className="out-of-stock" style={{color: '#991b1b'}}>Tienda Cerrada Temporalmente</span>
              ) : product.stock > 0 ? (
                <span className="in-stock">En Stock</span>
              ) : (
                <span className="out-of-stock">Agotado</span>
              )}
            </div>
            
            <div className="quantity-selector">
              <label htmlFor="quantity">Cantidad: </label>
              <select 
                id="quantity" 
                value={quantity} 
                onChange={(e) => setQuantity(Number(e.target.value))}
              >
                {[...Array(Math.max(1, Math.min(10, Number(product.stock) || 1))).keys()].map(n => (
                  <option key={n+1} value={n+1}>{n+1}</option>
                ))}
              </select>
            </div>

            <button 
              className="btn btn-primary btn-block buy-btn"
              onClick={handleAddToCart}
              disabled={product.stock === 0 || product.store_is_open === false}
              style={{marginBottom: '10px'}}
            >
              Agregar al Carrito
            </button>
            <button 
              className="btn btn-secondary btn-block buy-now-btn"
              onClick={() => {
                handleAddToCart();
                navigate('/checkout');
              }}
              disabled={product.stock === 0}
              style={{marginBottom: '10px'}}
            >
              Hacer Pedido
            </button>
            <button 
              className="btn btn-secondary btn-block contact-btn"
              onClick={openContactModal}
              disabled={product.stock === 0}
              style={{backgroundColor: '#25d366', color: 'white', borderColor: '#25d366'}}
            >
              Contactar al Vendedor
            </button>
            
            <div className="secure-transaction">
              <span>Transacción segura</span>
            </div>
          </div>
        </div>

      </div>

      {/* Related Products Section */}
      {relatedProducts.length > 0 && (
        <div className="related-products-section" style={{ marginTop: '50px', borderTop: '1px solid #ddd', paddingTop: '30px' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '20px', color: '#0F1111' }}>Productos que te podrían interesar</h2>
          <div className="home-products-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
            {relatedProducts.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}

      {/* Reviews Section */}
      <div id="reviews-section" className="product-reviews-section" style={{ marginTop: '50px', borderTop: '1px solid #ddd', paddingTop: '30px' }}>
        <h2 style={{ fontSize: '24px', marginBottom: '20px', color: '#0F1111' }}>Reseñas de clientes</h2>
        
        <div className="reviews-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '40px' }}>
          <div className="reviews-summary">
            <h3>Valoración promedio</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '10px 0' }}>
              <span style={{ fontSize: '32px', fontWeight: 'bold' }}>{product.rating_avg || 0}</span>
              <div className="stars">
                {[1,2,3,4,5].map(i => (
                  <Star 
                    key={i} 
                    size={20} 
                    className={i <= Math.round(product.rating_avg || 0) ? 'star-filled' : 'star-empty'} 
                  />
                ))}
              </div>
            </div>
            <p style={{ color: '#565959' }}>{product.review_count || 0} calificaciones globales</p>
            
            <hr style={{ margin: '20px 0' }} />
            
            <h4 style={{ marginBottom: '15px' }}>Dejar una reseña</h4>
            <form onSubmit={handleReviewSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>Tu Nombre</label>
                <input 
                  type="text" 
                  value={newReview.name} 
                  onChange={e => setNewReview({...newReview, name: e.target.value})}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                  placeholder="Ej. Juan Pérez"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>Calificación</label>
                <select 
                  value={newReview.rating} 
                  onChange={e => setNewReview({...newReview, rating: Number(e.target.value)})}
                  style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  <option value="5">5 - Excelente</option>
                  <option value="4">4 - Muy bueno</option>
                  <option value="3">3 - Regular</option>
                  <option value="2">2 - Malo</option>
                  <option value="1">1 - Pésimo</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>Comentario (Opcional)</label>
                <textarea 
                  value={newReview.comment} 
                  onChange={e => setNewReview({...newReview, comment: e.target.value})}
                  rows="4"
                  style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', resize: 'vertical' }}
                  placeholder="¿Qué te pareció el producto?"
                ></textarea>
              </div>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={submittingReview || !newReview.name}
              >
                {submittingReview ? 'Enviando...' : 'Enviar Reseña'}
              </button>
            </form>
          </div>
          
          <div className="reviews-list">
            <h3>Reseñas escritas</h3>
            {reviews.length === 0 ? (
              <p style={{ color: '#565959', marginTop: '15px' }}>Todavía no hay reseñas para este producto. ¡Sé el primero en calificarlo!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '15px' }}>
                {reviews.map(review => (
                  <div key={review.id} className="review-item" style={{ padding: '15px', border: '1px solid #eee', borderRadius: '8px', backgroundColor: '#fafafa' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <div className="stars">
                        {[1,2,3,4,5].map(i => (
                          <Star 
                            key={i} 
                            size={14} 
                            className={i <= review.rating ? 'star-filled' : 'star-empty'} 
                          />
                        ))}
                      </div>
                      <span style={{ fontWeight: 'bold' }}>{review.customer_name}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#565959', marginBottom: '8px' }}>
                      {new Date(review.created_at).toLocaleDateString()}
                    </div>
                    {review.comment && <p style={{ margin: 0, lineHeight: '1.4' }}>{review.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showContactModal && (
        <div className="contact-modal-overlay" onClick={closeContactModal} style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div className="contact-modal-content" onClick={(e) => e.stopPropagation()} style={{backgroundColor: 'white', padding: '30px', borderRadius: '12px', maxWidth: '400px', width: '90%', textAlign: 'center'}}>
            <h2 style={{marginTop: 0, marginBottom: '20px', color: '#333'}}>Contactar Vendedor</h2>
            <p style={{marginBottom: '30px', color: '#666'}}>¿Cómo prefieres comunicarte con la tienda para adquirir este producto?</p>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
              {product.store_phone && (
                <>
                  <a 
                    href={`tel:+${product.store_phone.replace(/[^0-9]/g, '').startsWith('53') ? product.store_phone.replace(/[^0-9]/g, '') : `53${product.store_phone.replace(/[^0-9]/g, '')}`}`} 
                    className="btn" 
                    style={{backgroundColor: '#007bff', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'}}
                  >
                    📞 Llamar por Teléfono
                  </a>
                  
                  <a 
                    href={`https://wa.me/${product.store_phone.replace(/[^0-9]/g, '').startsWith('53') ? product.store_phone.replace(/[^0-9]/g, '') : `53${product.store_phone.replace(/[^0-9]/g, '')}`}?text=Hola,%20estoy%20interesado%20en%20el%20producto:%20${encodeURIComponent(product.name)}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn" 
                    style={{backgroundColor: '#25D366', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'}}
                  >
                    💬 Escribir por WhatsApp
                  </a>
                </>
              )}
              {!product.store_phone && (
                <p style={{color: '#d9534f', fontWeight: 'bold'}}>Este vendedor no ha registrado un número de teléfono.</p>
              )}
            </div>

            <button 
              onClick={closeContactModal} 
              style={{marginTop: '25px', background: 'none', border: 'none', color: '#999', cursor: 'pointer', textDecoration: 'underline'}}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <ZelleWarningModal 
        isOpen={isZelleModalOpen} 
        onClose={() => setIsZelleModalOpen(false)} 
        storePhone={product?.store_phone}
        storeName={product?.store_name}
      />
    </div>
  );
};

export default ProductDetails;
