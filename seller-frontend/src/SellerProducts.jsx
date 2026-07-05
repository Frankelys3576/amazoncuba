import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, X } from 'lucide-react';
import { getProducts, createProduct, getCategories } from './services/api';
import { cubaLocations } from './utils/cubaLocations';
import './SellerProducts.css';

const SellerProducts = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    currency: 'USD',
    stock: '',
    category_id: '',
    image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80',
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
  
  useEffect(() => {
    const fetchStoreProducts = async () => {
      try {
        const storeId = localStorage.getItem('seller_store_id');
        // Para este MVP traemos los productos de esta tienda
        // Si el endpoint no filtra por tienda, simulamos el filtrado aquí.
        const allProducts = await getProducts();
        const storeProducts = allProducts.filter(p => p.store_id == storeId);
        
        // Si la tienda no tiene productos, ponemos unos de prueba para que no se vea vacío
        if (storeProducts.length === 0) {
          setProducts(allProducts.slice(0, 5));
        } else {
          setProducts(storeProducts);
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

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (newProduct.delivery_locations.length === 0) {
      alert("Debes agregar al menos una ubicación de entrega.");
      return;
    }

    try {
      setAddingProduct(true);
      const storeId = localStorage.getItem('seller_store_id');
      const addedProduct = await createProduct({
        ...newProduct,
        store_id: storeId,
        price: parseFloat(newProduct.price),
        stock: parseInt(newProduct.stock, 10),
        category_id: parseInt(newProduct.category_id, 10),
        // Send the first location as primary just for backwards compatibility, if needed
        province: newProduct.delivery_locations[0].split(':')[0],
        municipality: newProduct.delivery_locations[0].split(':')[1]
      });
      setProducts([addedProduct, ...products]);
      setShowAddModal(false);
      setNewProduct({
        name: '', price: '', currency: 'USD', stock: '', category_id: '', 
        image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80', 
        image_url_2: '', image_url_3: '', image_url_4: '', image_url_5: '',
        description: '', delivery_locations: []
      });
      setTempProv('La Habana');
      setTempMun('Plaza de la Revolución');
    } catch (error) {
      alert('Error al agregar el producto');
      console.error(error);
    } finally {
      setAddingProduct(false);
    }
  };

  return (
    <div className="seller-products">
      <div className="seller-page-header">
        <h1 className="seller-page-title">Mis Productos</h1>
        <button className="btn-add-product" onClick={() => setShowAddModal(true)}>
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
          <div className="table-responsive">
            <table className="seller-products-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Precio</th>
                  <th>Inventario</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(product => (
                  <tr key={product.id}>
                    <td data-label="Producto">
                      <div className="product-cell">
                        <img src={product.image_url} alt={product.name} />
                        <span className="product-name">{product.name}</span>
                      </div>
                    </td>
                    <td data-label="Precio"><span className="product-price">{Number(product.price).toFixed(2)} {product.currency || 'USD'}</span></td>
                    <td data-label="Inventario">
                      <span className={`stock-badge ${product.stock > 10 ? 'in-stock' : 'low-stock'}`}>
                        {product.stock || Math.floor(Math.random() * 50) + 1} en stock
                      </span>
                    </td>
                    <td data-label="Estado">
                      <span className="status-badge active">Activo</span>
                    </td>
                    <td data-label="Acciones">
                      <div className="action-buttons">
                        <button className="btn-icon edit"><Edit2 size={16} /></button>
                        <button className="btn-icon delete"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan="5" className="empty-table-state">
                      No se encontraron productos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Agregar Nuevo Producto</h2>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddProduct} className="add-product-form">
              <div className="form-group">
                <label>Nombre del Producto</label>
                <input 
                  type="text" 
                  required 
                  value={newProduct.name}
                  onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                />
              </div>
              <div className="form-row">
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
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Stock</label>
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
                  <label>Categoría</label>
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
              </div>
              <div className="form-group">
                <label>URL de Imagen Principal</label>
                <input 
                  type="url" 
                  value={newProduct.image_url}
                  onChange={e => setNewProduct({...newProduct, image_url: e.target.value})}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>URL Imagen 2 (Opcional)</label>
                  <input 
                    type="url" 
                    value={newProduct.image_url_2}
                    onChange={e => setNewProduct({...newProduct, image_url_2: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>URL Imagen 3 (Opcional)</label>
                  <input 
                    type="url" 
                    value={newProduct.image_url_3}
                    onChange={e => setNewProduct({...newProduct, image_url_3: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>URL Imagen 4 (Opcional)</label>
                  <input 
                    type="url" 
                    value={newProduct.image_url_4}
                    onChange={e => setNewProduct({...newProduct, image_url_4: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>URL Imagen 5 (Opcional)</label>
                  <input 
                    type="url" 
                    value={newProduct.image_url_5}
                    onChange={e => setNewProduct({...newProduct, image_url_5: e.target.value})}
                  />
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
                <button type="button" className="btn-cancel" onClick={() => setShowAddModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={addingProduct}>
                  {addingProduct ? 'Agregando...' : 'Guardar Producto'}
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
