import { useState } from 'react';
import './App.css';
import Navbar from './Components/Navbar/Navbar';
import LoginPopup from './Components/LoginPopup/LoginPopup';
import Home from './Pages/Home/Home';
import Products from './Pages/Products/Products';
import AboutUs from './Pages/AboutUs/AboutUs';
import ContactUs from './Pages/ContactUs/ContactUs';
import ProtectedRoute from './Components/ProtectedRoute/ProtectedRoute';
import { Routes, Route } from 'react-router-dom';
import RequestQuote from './Pages/RequestQuote/RequestQuote';
import Orders from './Pages/Orders/Orders';
import ItemDetail from './Pages/ItemDetail/ItemDetail';

function App() {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <>
      {showLogin ? <LoginPopup setShowLogin={setShowLogin} /> : null}
      <div className="app">
        <Navbar setShowLogin={setShowLogin} />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/products"
            element={
              <ProtectedRoute setShowLogin={setShowLogin}>
                <Products />
              </ProtectedRoute>
            }
          />
          <Route
            path="/item/:id"
            element={
              <ProtectedRoute setShowLogin={setShowLogin}>
                <ItemDetail />
              </ProtectedRoute>
            }
          />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route
            path="/request-quote"
            element={
              <ProtectedRoute setShowLogin={setShowLogin}>
                <RequestQuote />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute setShowLogin={setShowLogin}>
                <Orders />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<div></div>} />
        </Routes>
      </div>
    </>
  );
}

export default App;
