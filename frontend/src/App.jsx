import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import ProductDetails from './pages/ProductDetails';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import StoresList from './pages/StoresList';
import StoreDetails from './pages/StoreDetails';
import SearchResults from './pages/SearchResults';
import DailyDeals from './pages/DailyDeals';
import CustomerService from './pages/CustomerService';
import MyOrders from './pages/MyOrders';
import CubaBnB from './pages/CubaBnB';
import SellerRegistration from './pages/SellerRegistration';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/cubabnb" element={<CubaBnB />} />
            <Route path="/product/:id" element={<ProductDetails />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/mis-pedidos" element={<MyOrders />} />
            <Route path="/negocios" element={<StoresList />} />
            <Route path="/negocio/:id" element={<StoreDetails />} />
            <Route path="/tienda/:id" element={<StoreDetails />} />
            <Route path="/vendedor" element={<SellerRegistration initialRegister={true} />} />
            <Route path="/vendedor/registro" element={<SellerRegistration initialRegister={true} />} />
            <Route path="/vendedor/register" element={<SellerRegistration initialRegister={true} />} />
            <Route path="/search" element={<SearchResults />} />
            <Route path="/ofertas" element={<DailyDeals />} />
            <Route path="/servicio-cliente" element={<CustomerService />} />
            <Route path="/:id" element={<StoreDetails />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
