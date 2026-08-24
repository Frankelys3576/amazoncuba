import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, X, Heart } from 'lucide-react';
import { getProducts, createProduct, getCategories, deleteProduct, updateProduct, uploadImage, getStoreCategories, getStoreById } from './services/api';
import { cubaLocations } from './utils/cubaLocations';
import './SellerProducts.css';

const SellerProducts = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [storeCategories, setStoreCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [newProduct, setNewProduct] = useState({
    item_type: 'product',
    name: '',
    price: '',
    price_usd: '',
    currency: 'USD',
    stock: '',
    category_id: '',
    store_category_id: '',
    image_url: '',
    image_url_2: '',
    image_url_3: '',
    image_url_4: '',
    image_url_5: '',
    description: '',
    delivery_locations: []
  });
  const [addingProduct, setAddingProduct] = useState(false);
  const [tempProv, setTempProv] = useState('La Habana');
  const [tempMun, setTempMun] = useState('Plaza de la Revolución');
  const [storeInfo, setStoreInfo] = useState(null);
  
  useEffect(() => {
    const fetchStoreProducts = async () => {
      try {
        const storeId = localStorage.getItem('seller_store_id');
      
      if (storeId) {
        const [allProducts, storeCats, storeData] = await Promise.all([
          getProducts({ storeId }),
          getStoreCategories(storeId),
          getStoreById(storeId)
        ]);
        setProducts(allProducts);
        if (storeCats) setStoreCategories(storeCats);
        if (storeData) setStoreInfo(storeData);
      }
      
      // Fetch categories
        const fetchedCategories = await getCategories();
        setCategories(fetchedCategories);
      } catch (error) {
        console.error("Error fetching store data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStoreProducts();
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleImageUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setAddingProduct(true);
      const data = await uploadImage(file);
      setNewProduct(prev => ({ ...prev, [field]: data.url }));
    } catch (error) {
      alert(error.message || 'Error al subir la imagen');
    } finally {
      setAddingProduct(false);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.delivery_locations || newProduct.delivery_locations.length === 0) {
      alert("Debes agregar al menos una ubicación de entrega.");
      return;
    }

    try {
      setAddingProduct(true);
      const storeId = localStorage.getItem('seller_store_id');
      
      const cleanDesc = (newProduct.description || '').replace(/^\[RESERVACIÓN\]\s*/i, '');
      const finalDescription = newProduct.item_type === 'reservation' ? `[RESERVACIÓN] ${cleanDesc}` : cleanDesc;

      const payload = {
        ...newProduct,
        description: finalDescription,
        store_id: storeId,
        price: parseFloat(newProduct.price) || 0,
        price_usd: newProduct.price_usd ? parseFloat(newProduct.price_usd) : null,
        stock: parseInt(newProduct.stock, 10) || 0,
        currency: storeInfo?.accepts_zelle ? 'CUP' : newProduct.currency,
        // Los ids son UUID v7 (cadenas), no enteros: se envían tal cual.
        // parseInt('01a03535-9bc0-...', 10) devolvía 1 — un número válido en
        // apariencia que el backend insertaba en una columna uuid (error 500);
        // y Number() sobre ese mismo valor daba NaN, que al ser falsy hacía
        // que la sección personalizada se guardara como null sin ningún aviso.
        category_id: newProduct.category_id || null,
        store_category_id: newProduct.store_category_id || null,
        province: newProduct.delivery_locations[0].split(':')[0],
        municipality: newProduct.delivery_locations[0].split(':')[1]
      };

      if (isEditing) {
        const updatedProduct = await updateProduct(editingProductId, payload);
        setProducts(products.map(p => p.id === editingProductId ? updatedProduct : p));
      } else {
        const addedProduct = await createProduct(payload);
        setProducts([addedProduct, ...products]);
      }
      
      handleCloseModal();
    } catch (error) {
      alert(`Error al ${isEditing ? 'actualizar' : 'agregar'} la publicación`);
      console.error(error);
    } finally {
      setAddingProduct(false);
    }
  };

  const handleEditProductClick = (product) => {
    setIsEditing(true);
    setEditingProductId(product.id);
    const isRes = product.description?.startsWith('[RESERVACIÓN]') || false;
    setNewProduct({
      item_type: isRes ? 'reservation' : 'product',
      name: product.name,
      price: product.price,
      price_usd: product.price_usd || '',
      currency: product.currency || 'USD',
      stock: product.stock,
      category_id: product.category_id,
      store_category_id: product.store_category_id || '',
      image_url: product.image_url || '',
      image_url_2: product.image_url_2 || '',
      image_url_3: product.image_url_3 || '',
      image_url_4: product.image_url_4 || '',
      image_url_5: product.image_url_5 || '',
      description: isRes ? product.description.replace(/^\[RESERVACIÓN\]\s*/i, '') : product.description || '',
      delivery_locations: product.delivery_locations || []
    });
    setTempProv('La Habana');
    setTempMun('Plaza de la Revolución');
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setIsEditing(false);
    setEditingProductId(null);
    setNewProduct({
      item_type: 'product',
      name: '', price: '', price_usd: '', currency: 'USD', stock: '', category_id: '', store_category_id: '',
      image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80', 
      image_url_2: '', image_url_3: '', image_url_4: '', image_url_5: '',
      description: '', delivery_locations: []
    });
    setTempProv('La Habana');
    setTempMun('Plaza de la Revolución');
  };

  const handleDeleteProduct = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este producto?')) {
      try {
        await deleteProduct(id);
        setProducts(products.filter(p => p.id !== id));
      } catch (error) {
        alert('Error al eliminar el producto');
        console.error(error);
      }
    }
  };

  const handleToggleFeatured = async (product) => {
    try {
      const updatedProduct = await updateProduct(product.id, { is_featured: !product.is_featured });
      setProducts(products.map(p => p.id === product.id ? updatedProduct : p));
    } catch (error) {
      alert('Error al actualizar el producto destacado');
      console.error(error);
    }
  };

  return (
    <div className="seller-products">
      <div className="seller-page-header">
        <h1 className="seller-page-title">Mis Productos</h1>
        <button className="btn-add-product" onClick={() => {
          handleCloseModal();
          setShowAddModal(true);
        }}>
          <Plus size={18} />
          <span>Nuevo Producto</span>
        </button>
      </div>

      <div className="seller-products-card">
        <div className="seller-products-toolbar">
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Buscar productos..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="toolbar-actions">
            <select className="filter-select">
              <option value="all">Todas las categorías</option>
              <option value="active">Electrónica</option>
              <option value="inactive">Hogar</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Cargando inventario...</div>
        ) : (
          <div className="products-grid">
            {filteredProducts.map(product => (
              <div key={product.id} className="product-card">
                <div className="product-card-image">
                  <img src={product.image_url} alt={product.name} />
                  <div className="product-card-badges">
                    {product.description?.startsWith('[RESERVACIÓN]') ? (
                      <span className="badge featured" style={{ background: '#e11d48', color: 'white' }}>🏡 Reservación</span>
                    ) : (
                      <span className="badge featured" style={{ background: '#0284c7', color: 'white' }}>📦 Producto</span>
                    )}
                    {product.is_featured && <span className="badge featured">★ Destacado</span>}
                    <span className="badge status active">Activo</span>
                  </div>
                </div>
                
                <div className="product-card-content">
                  <h3 className="product-card-title" title={product.name}>{product.name}</h3>
                  <div className="product-card-price">
                    {Number(product.price).toFixed(2)} {product.currency || 'USD'}
                    {product.price_usd && (
                      <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                        ${Number(product.price_usd).toFixed(2)} USD (Zelle)
                      </div>
                    )}
                  </div>
                  
                  <div className="product-card-details">
                    <div className="stock-info">
                      <span className={`stock-indicator ${product.stock > 10 ? 'in-stock' : 'low-stock'}`}></span>
                      <span className="stock-text">{product.stock || 0} en inventario</span>
                    </div>
                  </div>
                  
                  <div className="product-card-actions">
                    <button 
                      className="btn-card-action btn-feature" 
                      style={{ color: product.is_featured ? '#e11d48' : '#64748b', backgroundColor: product.is_featured ? '#ffe4e6' : '#f1f5f9' }}
                      onClick={() => handleToggleFeatured(product)}
                      title={product.is_featured ? "Quitar destacado" : "Destacar producto"}
                    >
                      <Heart size={16} fill={product.is_featured ? "currentColor" : "none"} />
                    </button>
                    <button 
                      className="btn-card-action btn-edit" 
                      onClick={() => handleEditProductClick(product)}
                      title="Editar producto"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      className="btn-card-action btn-delete" 
                      onClick={() => handleDeleteProduct(product.id)}
                      title="Eliminar producto"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filteredProducts.length === 0 && (
              <div className="empty-state">
                No se encontraron productos.
              </div>
            )}
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{isEditing ? 'Editar Producto' : 'Agregar Nuevo Producto'}</h2>
              <button type="button" className="close-btn" onClick={handleCloseModal}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddProduct} className="add-product-form">
              <div style={{ marginBottom: '15px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px', fontSize: '13px', color: '#1e293b' }}>
                  ¿Qué deseas publicar en la plataforma?
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setNewProduct(prev => ({ ...prev, item_type: 'product' }))}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '6px',
                      border: newProduct.item_type === 'product' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      backgroundColor: newProduct.item_type === 'product' ? '#eff6ff' : '#ffffff',
                      color: newProduct.item_type === 'product' ? '#1d4ed8' : '#475569',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    📦 Producto / Menú de Comida / Paquete
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewProduct(prev => ({ ...prev, item_type: 'reservation' }))}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '6px',
                      border: newProduct.item_type === 'reservation' ? '2px solid #ff385c' : '1px solid #cbd5e1',
                      backgroundColor: newProduct.item_type === 'reservation' ? '#fff1f2' : '#ffffff',
                      color: newProduct.item_type === 'reservation' ? '#e11d48' : '#475569',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    🏡 Reservación / Habitación / Estancia
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>{newProduct.item_type === 'reservation' ? 'Nombre de la Reservación / Estancia' : 'Nombre del Producto'}</label>
                <input 
                  type="text" 
                  required 
                  placeholder={newProduct.item_type === 'reservation' ? 'Ej: Habitación Matrimonial Vista al Mar + Cena Especial' : 'Ej: Menú de Comida Criolla / Paquete Sorpresa'}
                  value={newProduct.name}
                  onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                />
              </div>
              <div className="form-row">
                {storeInfo?.accepts_zelle ? (
                  <>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Precio en CUP</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={newProduct.price}
                        onChange={e => setNewProduct({...newProduct, price: e.target.value})}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Precio en USD (Zelle)</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={newProduct.price_usd}
                        onChange={e => setNewProduct({...newProduct, price_usd: e.target.value})}
                        required
                      />
                    </div>
                  </>
                ) : (
                  <div className="form-group" style={{ flex: 2 }}>
                    <label>Precio</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={newProduct.price}
                        onChange={e => setNewProduct({...newProduct, price: e.target.value})}
                        required
                        style={{ flex: 1 }}
                      />
                      <select 
                        value={newProduct.currency}
                        onChange={e => setNewProduct({...newProduct, currency: e.target.value})}
                        style={{ width: '90px' }}
                      >
                        <option value="USD">USD</option>
                        <option value="CUP">CUP</option>
                      </select>
                    </div>
                  </div>
                )}
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Cantidad en inventario</label>
                  <input 
                    type="number" 
                    value={newProduct.stock}
                    onChange={e => setNewProduct({...newProduct, stock: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Categoría Global</label>
                  <select 
                    required 
                    value={newProduct.category_id}
                    onChange={e => setNewProduct({...newProduct, category_id: e.target.value})}
                  >
                    <option value="" disabled>Seleccione una categoría</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Sección de tu Tienda (Opcional)</label>
                  <select 
                    value={newProduct.store_category_id || ''}
                    onChange={(e) => setNewProduct({...newProduct, store_category_id: e.target.value === '' ? null : e.target.value})}
                  >
                    <option value="">Ninguna</option>
                    {storeCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Imagen Principal (JPG/PNG)</label>
                <input 
                  type="file" 
                  accept="image/jpeg, image/jpg, image/png"
                  onChange={e => handleImageUpload(e, 'image_url')}
                  required={!newProduct.image_url}
                />
                {newProduct.image_url && newProduct.image_url !== 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80' && (
                  <div style={{marginTop: '10px'}}>
                    <img src={newProduct.image_url} alt="Preview" style={{height: '60px', borderRadius: '4px', objectFit: 'cover'}} />
                  </div>
                )}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Imagen 2 (Opcional)</label>
                  <input 
                    type="file" 
                    accept="image/jpeg, image/jpg, image/png"
                    onChange={e => handleImageUpload(e, 'image_url_2')}
                  />
                  {newProduct.image_url_2 && (
                    <div style={{marginTop: '10px'}}><img src={newProduct.image_url_2} alt="Preview" style={{height: '60px', borderRadius: '4px', objectFit: 'cover'}} /></div>
                  )}
                </div>
                <div className="form-group">
                  <label>Imagen 3 (Opcional)</label>
                  <input 
                    type="file" 
                    accept="image/jpeg, image/jpg, image/png"
                    onChange={e => handleImageUpload(e, 'image_url_3')}
                  />
                  {newProduct.image_url_3 && (
                    <div style={{marginTop: '10px'}}><img src={newProduct.image_url_3} alt="Preview" style={{height: '60px', borderRadius: '4px', objectFit: 'cover'}} /></div>
                  )}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Imagen 4 (Opcional)</label>
                  <input 
                    type="file" 
                    accept="image/jpeg, image/jpg, image/png"
                    onChange={e => handleImageUpload(e, 'image_url_4')}
                  />
                  {newProduct.image_url_4 && (
                    <div style={{marginTop: '10px'}}><img src={newProduct.image_url_4} alt="Preview" style={{height: '60px', borderRadius: '4px', objectFit: 'cover'}} /></div>
                  )}
                </div>
                <div className="form-group">
                  <label>Imagen 5 (Opcional)</label>
                  <input 
                    type="file" 
                    accept="image/jpeg, image/jpg, image/png"
                    onChange={e => handleImageUpload(e, 'image_url_5')}
                  />
                  {newProduct.image_url_5 && (
                    <div style={{marginTop: '10px'}}><img src={newProduct.image_url_5} alt="Preview" style={{height: '60px', borderRadius: '4px', objectFit: 'cover'}} /></div>
                  )}
                </div>
              </div>
              <div className="form-group" style={{gridColumn: '1 / -1'}}>
                <label>Ubicaciones de Entrega (Agrega al menos una)</label>
                
                {/* Lista de ubicaciones agregadas */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                  {newProduct.delivery_locations.map((loc, idx) => (
                    <div key={idx} style={{ background: '#e0f2fe', color: '#0369a1', padding: '5px 10px', borderRadius: '15px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 'bold' }}>
                      {loc}
                      <button type="button" onClick={() => {
                        const newLocs = [...newProduct.delivery_locations];
                        newLocs.splice(idx, 1);
                        setNewProduct({...newProduct, delivery_locations: newLocs});
                      }} style={{ background: 'none', border: 'none', color: '#0369a1', cursor: 'pointer', display: 'flex' }}><X size={14}/></button>
                    </div>
                  ))}
                </div>

                <div className="form-row" style={{ alignItems: 'flex-end', background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Provincia</label>
                    <select 
                      value={tempProv}
                      onChange={(e) => {
                        setTempProv(e.target.value);
                        setTempMun('Toda la provincia');
                      }}
                    >
                      <option value="Toda Cuba">Toda Cuba (Nacional)</option>
                      {Object.keys(cubaLocations).map(prov => (
                        <option key={prov} value={prov}>{prov}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Municipio</label>
                    <select 
                      value={tempMun}
                      onChange={(e) => setTempMun(e.target.value)}
                      disabled={tempProv === 'Toda Cuba'}
                    >
                      <option value="Toda la provincia">Toda la provincia</option>
                      {tempProv !== 'Toda Cuba' && cubaLocations[tempProv]?.map(mun => (
                        <option key={mun} value={mun}>{mun}</option>
                      ))}
                    </select>
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    style={{ height: '38px', padding: '0 15px', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      const newLoc = tempProv === 'Toda Cuba' ? 'Toda Cuba:Toda Cuba' : `${tempProv}:${tempMun}`;
                      if (!newProduct.delivery_locations.includes(newLoc)) {
                        setNewProduct({...newProduct, delivery_locations: [...newProduct.delivery_locations, newLoc]});
                      }
                    }}
                  >
                    + Agregar
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <textarea 
                  rows="3"
                  value={newProduct.description}
                  onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                ></textarea>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={handleCloseModal}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={addingProduct}>
                  {addingProduct ? (isEditing ? 'Actualizando...' : 'Agregando...') : (isEditing ? 'Actualizar Producto' : 'Guardar Producto')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerProducts;
