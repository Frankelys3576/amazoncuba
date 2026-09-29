import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getProductById, getProducts, getStoreById, registerProductView, getProductReviews, addProductReview } from '../services/api';
import { useCart } from '../context/CartContext';
import ProductCard from '../components/ProductCard';
import { Star } from 'lucide-react';
import { getValidImageUrl, handleImageError } from '../utils/imageUtils';
import ZelleWarningModal from '../components/ZelleWarningModal';
import './ProductDetails.css';

// Mismo tope que el backend (orders.service.ts: MAX_ITEM_QUANTITY).
const MAX_ORDER_QUANTITY = 1000;

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

  if (loading) return <div className="container product-details-status">Cargando producto...</div>;
  if (!product) return <div className="container product-details-status">Producto no encontrado.</div>;

  const isStoreCurrentlyOpen = checkStoreIsOpen(product);
  const isReservation = product.description?.startsWith('[RESERVACIÓN]');
  const descriptionText = (product.description || '').replace(/^\[RESERVACIÓN\]\s*/i, '');
  const showZellePrice = product.store_accepts_zelle && product.price_usd;

  // El desplegable anterior solo ofrecía hasta 10 opciones aunque hubiera
  // más stock; ahora se escribe la cantidad, con el tope real del sistema
  // (orders.service.ts: MAX_ITEM_QUANTITY = 1000), no un límite artificial
  // de la interfaz.
  const maxQuantity = Math.max(1, Math.min(MAX_ORDER_QUANTITY, Number(product.stock) || MAX_ORDER_QUANTITY));
  const clampQuantity = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(Math.floor(n), maxQuantity);
  };

  // El teléfono de la tienda se guarda a veces con el código de país (53) y a
  // veces sin él -- este cálculo se repetía igual para el link de llamada y
  // el de WhatsApp, así que vive una sola vez aquí.
  const storePhoneDigits = product.store_phone?.replace(/[^0-9]/g, '') || '';
  const storePhoneWithCountryCode = storePhoneDigits.startsWith('53') ? storePhoneDigits : `53${storePhoneDigits}`;

  const handleAddToCart = () => {
    // Por si el cliente hace clic sin haber salido del campo (blur) todavía
    // -- p.ej. escribió y le dio Enter, o tocó el botón directo en móvil --
    // así el carrito nunca recibe un valor vacío o fuera de rango.
    const finalQuantity = clampQuantity(quantity);
    if (finalQuantity !== quantity) setQuantity(finalQuantity);
    addToCart(product, finalQuantity);
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
                  src={getValidImageUrl(img)} 
                  onError={handleImageError}
                  alt={`${product.name} - foto ${index + 1}`} 
                  className={`thumbnail ${activeImage === img ? 'active' : ''}`}
                  onMouseEnter={() => setActiveImage(img)}
                  onClick={() => setActiveImage(img)}
                />
              ))}
            </div>
          )}
          <div className="product-main-image-container">
            <img 
              src={getValidImageUrl(activeImage || product.image_url)} 
              onError={handleImageError}
              alt={product.name} 
              className="product-main-image" 
            />
          </div>
        </div>

        {/* Columna Central: Información */}
        <div className="product-info-section">
          {isReservation && (
            <div className="product-badge-row">
              <span className="product-badge product-badge--reservation">
                🏡 Reservación / Estancia en CubaAirbnb
              </span>
            </div>
          )}
          <h1 className="product-title">{product.name}</h1>
          <div className="product-rating-row" onClick={() => document.getElementById('reviews-section').scrollIntoView({behavior: 'smooth'})}>
            <div className="stars">
              {[1,2,3,4,5].map(i => (
                <Star
                  key={i}
                  size={16}
                  className={i <= Math.round(product.rating_avg || 0) ? 'star-filled' : 'star-empty'}
                />
              ))}
            </div>
            <span className="product-rating-count">{product.review_count || 0} calificaciones</span>
          </div>
          <hr className="divider" />
          <div className="product-price-large">
            <span className="price-symbol">$</span>
            <span className="price-whole">{Math.floor(parseFloat(product.price || 0))}</span>
            <span className="price-fraction">{(((parseFloat(product.price || 0)) % 1) * 100).toFixed(0).padStart(2, '0')}</span>
            <span className="price-currency">{product.currency || 'USD'}</span>
            {showZellePrice && (
              <div className="price-zelle-alt">
                También disponible por: ${Number(product.price_usd).toFixed(2)} USD (Zelle)
              </div>
            )}
          </div>
          <hr className="divider" />
          <div className="product-description">
            <h3>Acerca de este artículo</h3>
            <div className="product-store-box">
              <Link to={`/${product.store_slug}`} className="product-store-link">
                Visitar la tienda {product.store_name}
              </Link>
              <div className="store-badges-row">
                {product.store_has_delivery && (
                  <span className="store-badge store-badge--delivery">
                    🚚 Con Envío
                  </span>
                )}
                <span className={`status-indicator ${isStoreCurrentlyOpen ? 'open' : 'closed'}`}>
                  {product.store_is_open === false ? 'Pausada' : isStoreCurrentlyOpen ? 'Abierto Ahora' : 'Cerrado Ahora'}
                </span>
                {product.store_opening_time && product.store_closing_time && (
                  <span className="store-hours">
                    🕒 {formatTime(product.store_opening_time)} - {formatTime(product.store_closing_time)}
                  </span>
                )}
              </div>
            </div>
            <p>{descriptionText}</p>
          </div>
        </div>

        {/* Columna Derecha: Panel de Compra */}
        <div className="product-buy-section">
          {product.store_has_delivery && (
            <div className="delivery-banner">
              🚚 Esta tienda ofrece servicio a domicilio
            </div>
          )}
          <div className="buy-panel">
            <div className="buy-panel-price">
              ${parseFloat(product.price || 0).toFixed(2)} {product.currency || 'USD'}
              {showZellePrice && (
                <div className="buy-panel-zelle">
                  / ${Number(product.price_usd).toFixed(2)} USD
                </div>
              )}
            </div>
            <div className="buy-panel-stock">
              {product.store_is_open === false ? (
                <span className="out-of-stock">Tienda Cerrada Temporalmente</span>
              ) : product.stock > 0 ? (
                <span className="in-stock">En Stock</span>
              ) : (
                <span className="out-of-stock">Agotado</span>
              )}
            </div>

            <div className="quantity-selector">
              <label htmlFor="quantity">Cantidad: </label>
              <input
                type="number"
                id="quantity"
                inputMode="numeric"
                min={1}
                max={maxQuantity}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                onBlur={() => setQuantity(clampQuantity(quantity))}
              />
              <span className="quantity-max-hint">de {maxQuantity} disponibles</span>
            </div>

            <button
              className="btn btn-primary btn-block buy-btn"
              onClick={handleAddToCart}
              disabled={product.stock === 0 || product.store_is_open === false}
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
            >
              Hacer Pedido
            </button>
            <button
              className="btn btn-block contact-btn"
              onClick={openContactModal}
              disabled={product.stock === 0}
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
        <div className="related-products-section section-with-divider">
          <h2 className="section-heading">Productos que te podrían interesar</h2>
          <div className="related-products-grid">
            {relatedProducts.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}

      {/* Reviews Section */}
      <div id="reviews-section" className="product-reviews-section section-with-divider">
        <h2 className="section-heading">Reseñas de clientes</h2>

        <div className="reviews-layout">
          <div className="reviews-summary">
            <h3>Valoración promedio</h3>
            <div className="rating-summary-row">
              <span className="rating-summary-number">{product.rating_avg || 0}</span>
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
            <p className="reviews-count-text">{product.review_count || 0} calificaciones globales</p>

            <hr className="divider" />

            <h4 className="review-form-heading">Dejar una reseña</h4>
            <form onSubmit={handleReviewSubmit} className="review-form">
              <div className="form-field">
                <label>Tu Nombre</label>
                <input
                  type="text"
                  value={newReview.name}
                  onChange={e => setNewReview({...newReview, name: e.target.value})}
                  required
                  placeholder="Ej. Juan Pérez"
                />
              </div>
              <div className="form-field">
                <label>Calificación</label>
                <select
                  value={newReview.rating}
                  onChange={e => setNewReview({...newReview, rating: Number(e.target.value)})}
                >
                  <option value="5">5 - Excelente</option>
                  <option value="4">4 - Muy bueno</option>
                  <option value="3">3 - Regular</option>
                  <option value="2">2 - Malo</option>
                  <option value="1">1 - Pésimo</option>
                </select>
              </div>
              <div className="form-field">
                <label>Comentario (Opcional)</label>
                <textarea
                  value={newReview.comment}
                  onChange={e => setNewReview({...newReview, comment: e.target.value})}
                  rows="4"
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
              <p className="reviews-empty-text">Todavía no hay reseñas para este producto. ¡Sé el primero en calificarlo!</p>
            ) : (
              <div className="review-item-list">
                {reviews.map(review => (
                  <div key={review.id} className="review-item">
                    <div className="review-item-header">
                      <div className="stars">
                        {[1,2,3,4,5].map(i => (
                          <Star
                            key={i}
                            size={14}
                            className={i <= review.rating ? 'star-filled' : 'star-empty'}
                          />
                        ))}
                      </div>
                      <span className="review-author">{review.customer_name}</span>
                    </div>
                    <div className="review-date">
                      {new Date(review.created_at).toLocaleDateString()}
                    </div>
                    {review.comment && <p className="review-comment">{review.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showContactModal && (
        <div className="contact-modal-overlay" onClick={closeContactModal}>
          <div className="contact-modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Contactar Vendedor</h2>
            <p className="contact-modal-desc">¿Cómo prefieres comunicarte con la tienda para adquirir este producto?</p>

            <div className="contact-modal-options">
              {product.store_phone && (
                <>
                  <a
                    href={`tel:+${storePhoneWithCountryCode}`}
                    className="btn contact-call-btn"
                  >
                    📞 Llamar por Teléfono
                  </a>

                  <a
                    href={`https://wa.me/${storePhoneWithCountryCode}?text=Hola,%20estoy%20interesado%20en%20el%20producto:%20${encodeURIComponent(product.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn contact-whatsapp-btn"
                  >
                    💬 Escribir por WhatsApp
                  </a>
                </>
              )}
              {!product.store_phone && (
                <p className="contact-no-phone-text">Este vendedor no ha registrado un número de teléfono.</p>
              )}
            </div>

            <button
              onClick={closeContactModal}
              className="contact-cancel-btn"
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
