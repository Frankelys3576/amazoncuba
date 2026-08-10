import React, { useState, useEffect } from 'react';
import { getStoreCategories, createStoreCategory, updateStoreCategory, deleteStoreCategory } from './services/api';
import { Trash2, Edit2, Plus, Image as ImageIcon } from 'lucide-react';
import './SellerProducts.css'; // Reusing styles

const SellerStoreCategories = ({ session }) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState(null);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [newCategory, setNewCategory] = useState({ name: '', image_url: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchStoreAndCategories();
  }, [session]);

  const fetchStoreAndCategories = async () => {
    try {
      const storeData = { id: localStorage.getItem('seller_store_id') }; // Use local storage as we do in other components
        
      if (storeData && storeData.id) {
        setStoreId(storeData.id);
        const categoriesData = await getStoreCategories(storeData.id);
        if (categoriesData) setCategories(categoriesData);
      }
    } catch (error) {
      console.error("Error loading categories", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    setIsEditing(false);
    setNewCategory({ name: '', image_url: '' });
    setShowAddModal(true);
  };

  const handleEditClick = (cat) => {
    setIsEditing(true);
    setEditingCategoryId(cat.id);
    setNewCategory({ name: cat.name, image_url: cat.image_url || '' });
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setIsEditing(false);
    setEditingCategoryId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newCategory.name || !storeId) return;
    setSubmitting(true);
    
    try {
      if (isEditing) {
        const data = await updateStoreCategory(storeId, editingCategoryId, { name: newCategory.name, image_url: newCategory.image_url });
        setCategories(categories.map(c => c.id === editingCategoryId ? data : c));
      } else {
        const data = await createStoreCategory(storeId, { name: newCategory.name, image_url: newCategory.image_url });
        setCategories([data, ...categories]);
      }
      handleCloseModal();
    } catch (error) {
      alert("Error al guardar categoría");
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta categoría? Los productos asociados quedarán sin categoría de tienda.")) return;
    
    try {
      await deleteStoreCategory(storeId, id);
      setCategories(categories.filter(c => c.id !== id));
    } catch (error) {
      alert("Error al eliminar categoría");
      console.error(error);
    }
  };

  if (loading) return <div className="loading-state">Cargando categorías...</div>;

  return (
    <div className="seller-products">
      <div className="page-header">
        <div>
          <h1>Secciones de Tienda</h1>
          <p>Organiza tus productos en categorías personalizadas para que los clientes las vean primero.</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenModal}>
          <Plus size={18} /> Nueva Sección
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="empty-state">
          <h3>No tienes secciones creadas</h3>
          <p>Crea secciones como "Ofertas", "Ropa de Verano" o "Electrodomésticos" para organizar tu tienda.</p>
          <button className="btn btn-primary" onClick={handleOpenModal} style={{marginTop: '15px'}}>
            Crear tu primera sección
          </button>
        </div>
      ) : (
        <div className="products-grid">
          {categories.map(cat => (
            <div key={cat.id} className="product-card" style={{display: 'flex', flexDirection: 'column'}}>
              <div className="product-image" style={{height: '150px', backgroundColor: '#f5f5f5'}}>
                {cat.image_url ? (
                  <img src={cat.image_url} alt={cat.name} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                ) : (
                  <div style={{display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#999'}}>
                    <ImageIcon size={40} />
                  </div>
                )}
              </div>
              <div className="product-info" style={{padding: '15px', flex: 1}}>
                <h3 className="product-name">{cat.name}</h3>
              </div>
              <div className="product-actions">
                <button className="action-btn edit" onClick={() => handleEditClick(cat)} title="Editar">
                  <Edit2 size={16} />
                </button>
                <button className="action-btn delete" onClick={() => handleDelete(cat.id)} title="Eliminar">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '500px'}}>
            <div className="modal-header">
              <h2>{isEditing ? 'Editar Sección' : 'Nueva Sección'}</h2>
              <button className="close-btn" onClick={handleCloseModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="product-form">
              <div className="form-group">
                <label>Nombre de la Sección</label>
                <input 
                  type="text" 
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                  placeholder="Ej. Novedades, Ropa de Invierno"
                  required 
                />
              </div>
              <div className="form-group">
                <label>URL de Imagen (Opcional)</label>
                <input 
                  type="url" 
                  value={newCategory.image_url}
                  onChange={(e) => setNewCategory({...newCategory, image_url: e.target.value})}
                  placeholder="https://..."
                />
                <small>Una foto representativa para la tarjeta de la categoría.</small>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Guardando...' : 'Guardar Sección'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerStoreCategories;
