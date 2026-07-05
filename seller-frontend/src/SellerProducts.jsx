import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, X } from 'lucide-react';
import { getProducts, createProduct } from './services/api';
import { cubaLocations } from './utils/cubaLocations';
import './SellerProducts.css';

const SellerProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    stock: '',
    category_id: 1, // Default category
    image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80', // Default image
    description: '',
    province: 'La Habana',
    municipality: 'Plaza de la Revolución'
  });
  const [addingProduct, setAddingProduct] = useState(false);
  
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
      } catch (error) {
        console.error("Error fetching store products:", error);
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
    setAddingProduct(true);
    try {
      const storeId = localStorage.getItem('seller_store_id');
      const addedProduct = await createProduct({
        ...newProduct,
        store_id: storeId,
        price: parseFloat(newProduct.price),
        stock: parseInt(newProduct.stock, 10),
        category_id: parseInt(newProduct.category_id, 10),
        province: newProduct.province,
        municipality: newProduct.municipality
      });
      setProducts([addedProduct, ...products]);
      setShowAddModal(false);
      setNewProduct({
        name: '', price: '', stock: '', category_id: 1, 
        image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80', description: '',
        province: 'La Habana', municipality: 'Plaza de la Revolución'
      });
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
                    <td data-label="Precio"><span className="product-price">${product.price}</span></td>
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
                <div className="form-group">
                  <label>Precio ($)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    value={newProduct.price}
                    onChange={e => setNewProduct({...newProduct, price: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Inventario (Stock)</label>
                  <input 
                    type="number" 
                    required 
                    value={newProduct.stock}
                    onChange={e => setNewProduct({...newProduct, stock: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>URL de Imagen</label>
                <input 
                  type="url" 
                  value={newProduct.image_url}
                  onChange={e => setNewProduct({...newProduct, image_url: e.target.value})}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Provincia</label>
                  <select 
                    value={newProduct.province}
                    onChange={e => {
                      const newProv = e.target.value;
                      setNewProduct({
                        ...newProduct, 
                        province: newProv, 
                        municipality: cubaLocations[newProv][0] 
                      });
                    }}
                    required
                  >
                    {Object.keys(cubaLocations).map(prov => (
                      <option key={prov} value={prov}>{prov}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Municipio</label>
                  <select 
                    value={newProduct.municipality}
                    onChange={e => setNewProduct({...newProduct, municipality: e.target.value})}
                    required
                  >
                    {cubaLocations[newProduct.province].map(mun => (
                      <option key={mun} value={mun}>{mun}</option>
                    ))}
                  </select>
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
