import { useState } from 'react';
import './App.css';
import Navbar from './Components/Navbar/Navbar';
import LoginPopup from './Components/LoginPopup/LoginPopup';
import PlaceOrder from './Pages/PlaceOrder/PlaceOrder';
import Home from './Pages/Home/Home';
import Products from './Pages/Products/Products';
import AboutUs from './Pages/AboutUs/AboutUs';
import ContactUs from './Pages/ContactUs/ContactUs';
import Industries from './Pages/Industries/Industries';
import ProtectedRoute from './Components/ProtectedRoute/ProtectedRoute';
import { Routes, Route } from 'react-router-dom';
import RequestQuote from './Pages/RequestQuote/RequestQuote';
import Orders from './Pages/Orders/Orders';
import Quotations from './Pages/Quotations/Quotations';
import Documents from './Pages/Documents/Documents';
import ItemDetail from './Pages/ItemDetail/ItemDetail';
import Dashboard from './Pages/Dashboard/Dashboard';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <>
      <ToastContainer
        position="top-center"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
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
          <Route
  path="/place-order/:orderNumber"
  element={
    <ProtectedRoute setShowLogin={setShowLogin}>
      <PlaceOrder />
    </ProtectedRoute>
  }
/>
          <Route path="/industries" element={<Industries setShowLogin={setShowLogin} />} />
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
          <Route
            path="/quotations"
            element={
              <ProtectedRoute setShowLogin={setShowLogin}>
                <Quotations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/documents"
            element={
              <ProtectedRoute setShowLogin={setShowLogin}>
                <Documents />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute setShowLogin={setShowLogin}>
                <Dashboard />
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
