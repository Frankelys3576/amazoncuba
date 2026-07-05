import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ClientLayout from './components/ClientLayout';
import Home from './pages/Home';
import ProductDetails from './pages/ProductDetails';
import Cart from './pages/Cart';
import SellerAuth from './pages/SellerAuth';
import Checkout from './pages/Checkout';
import StoresList from './pages/StoresList';
import StoreDetails from './pages/StoreDetails';
import SearchResults from './pages/SearchResults';
import DailyDeals from './pages/DailyDeals';
import CustomerService from './pages/CustomerService';

// Seller Pages
import SellerLayout from './pages/seller/SellerLayout';
import SellerDashboard from './pages/seller/SellerDashboard';
import SellerProducts from './pages/seller/SellerProducts';
import SellerOrders from './pages/seller/SellerOrders';

function App() {
  return (
    <Router>
      <Routes>
        {/* Rutas de Clientes (Públicas) */}
        <Route element={<ClientLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/product/:id" element={<ProductDetails />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/vender" element={<SellerAuth />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/negocios" element={<StoresList />} />
          <Route path="/negocio/:id" element={<StoreDetails />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/ofertas" element={<DailyDeals />} />
          <Route path="/servicio-cliente" element={<CustomerService />} />
        </Route>

        {/* Rutas de Vendedores (Privadas / Panel de Control) */}
        <Route path="/seller" element={<SellerLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<SellerDashboard />} />
          <Route path="products" element={<SellerProducts />} />
          <Route path="orders" element={<SellerOrders />} />
          <Route path="settings" element={
            <div style={{padding: '40px', textAlign: 'center'}}>
              <h2>Configuración de la Tienda</h2>
              <p>Próximamente...</p>
            </div>
          } />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
