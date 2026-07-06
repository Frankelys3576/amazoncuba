import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Import pages
import SellerAuth from './SellerAuth';
import SellerLayout from './SellerLayout';
import SellerDashboard from './SellerDashboard';
import SellerProducts from './SellerProducts';
import SellerOrders from './SellerOrders';
import SellerProfile from './SellerProfile';

import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<SellerAuth />} />
        
        <Route path="/" element={<SellerLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<SellerDashboard />} />
          <Route path="products" element={<SellerProducts />} />
          <Route path="orders" element={<SellerOrders />} />
          <Route path="profile" element={<SellerProfile />} />
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
