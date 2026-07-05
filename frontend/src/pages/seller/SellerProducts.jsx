import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { getProducts } from '../../../services/api';
import './SellerProducts.css';

const SellerProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
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

  return (
    <div className="seller-products">
      <div className="seller-page-header">
        <h1 className="seller-page-title">Mis Productos</h1>
        <button className="btn-add-product">
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
                    <td>
                      <div className="product-cell">
                        <img src={product.image_url} alt={product.name} />
                        <span className="product-name">{product.name}</span>
                      </div>
                    </td>
                    <td><span className="product-price">${product.price}</span></td>
                    <td>
                      <span className={`stock-badge ${product.stock > 10 ? 'in-stock' : 'low-stock'}`}>
                        {product.stock || Math.floor(Math.random() * 50) + 1} en stock
                      </span>
                    </td>
                    <td>
                      <span className="status-badge active">Activo</span>
                    </td>
                    <td>
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
    </div>
  );
};

export default SellerProducts;
