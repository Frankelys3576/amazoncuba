import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProductById, getProducts } from '../services/api';
import { useCart } from '../context/CartContext';
import ProductCard from '../components/ProductCard';
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
  const { addToCart } = useCart();

  useEffect(() => {
    const fetchProduct = async () => {
      const data = await getProductById(id);
      setProduct(data);
      if (data) {
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
      setLoading(false);
    };
    fetchProduct();
  }, [id]);

  if (loading) return <div className="container" style={{padding: '40px 20px'}}>Cargando detalles del producto...</div>;
  if (!product) return <div className="container" style={{padding: '40px 20px'}}>Producto no encontrado.</div>;

  const handleAddToCart = () => {
    addToCart(product, quantity);
  };

  const openContactModal = () => setShowContactModal(true);
  const closeContactModal = () => setShowContactModal(false);

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
          <hr className="divider" />
          <div className="product-price-large">
            <span className="price-symbol">$</span>
            <span className="price-whole">{Math.floor(product.price)}</span>
            <span className="price-fraction">
              {(product.price % 1).toFixed(2).substring(2)}
            </span>
          </div>
          <hr className="divider" />
          <div className="product-description">
            <h3>Acerca de este artículo</h3>
            <p>{product.description}</p>
          </div>
        </div>

        {/* Columna Derecha: Panel de Compra */}
        <div className="product-buy-section">
          <div className="buy-panel">
            <div className="buy-panel-price">${product.price.toFixed(2)}</div>
            <div className="buy-panel-stock">
              {product.stock > 0 ? <span className="in-stock">En Stock</span> : <span className="out-of-stock">Agotado</span>}
            </div>
            
            <div className="quantity-selector">
              <label htmlFor="quantity">Cantidad: </label>
              <select 
                id="quantity" 
                value={quantity} 
                onChange={(e) => setQuantity(Number(e.target.value))}
              >
                {[...Array(Math.min(10, product.stock)).keys()].map(n => (
                  <option key={n+1} value={n+1}>{n+1}</option>
                ))}
              </select>
            </div>

            <button 
              className="btn btn-primary btn-block buy-btn"
              onClick={handleAddToCart}
              disabled={product.stock === 0}
            >
              Agregar al Carrito
            </button>
            <button 
              className="btn btn-secondary btn-block buy-now-btn"
              onClick={openContactModal}
              disabled={product.stock === 0}
              style={{backgroundColor: '#25d366', color: 'white', borderColor: '#25d366', marginTop: '10px'}}
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

      {showContactModal && (
        <div className="contact-modal-overlay" onClick={closeContactModal} style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div className="contact-modal-content" onClick={(e) => e.stopPropagation()} style={{backgroundColor: 'white', padding: '30px', borderRadius: '12px', maxWidth: '400px', width: '90%', textAlign: 'center'}}>
            <h2 style={{marginTop: 0, marginBottom: '20px', color: '#333'}}>Contactar Vendedor</h2>
            <p style={{marginBottom: '30px', color: '#666'}}>¿Cómo prefieres comunicarte con la tienda para adquirir este producto?</p>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
              <a 
                href={`tel:+5350000000`} 
                className="btn" 
                style={{backgroundColor: '#007bff', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'}}
              >
                📞 Llamar por Teléfono
              </a>
              
              <a 
                href={`https://wa.me/5350000000?text=Hola,%20estoy%20interesado%20en%20el%20producto:%20${encodeURIComponent(product.name)}`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn" 
                style={{backgroundColor: '#25D366', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'}}
              >
                💬 Escribir por WhatsApp
              </a>
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
    </div>
  );
};

export default ProductDetails;
