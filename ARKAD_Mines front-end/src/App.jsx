import { useState, useEffect, useRef } from 'react';
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
import { Routes, Route, useLocation } from 'react-router-dom';
import RequestQuote from './Pages/RequestQuote/RequestQuote';
import Orders from './Pages/Orders/Orders';
import Quotations from './Pages/Quotations/Quotations';
import Documents from './Pages/Documents/Documents';
import ItemDetail from './Pages/ItemDetail/ItemDetail';
import Dashboard from './Pages/Dashboard/Dashboard';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

function App() {
  const [showLogin, setShowLogin] = useState(false);
  const lenisRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    lenisRef.current = new Lenis({
      smoothWheel: true,
      lerp: 0.07,
      duration: 1.3,
      wheelMultiplier: 1,
      preventDefault: (e) => {
        const target = e.target.closest('[data-lenis-prevent]');
        return !!target;
      },
    });

    window.lenisInstance = lenisRef.current;

    const raf = (time) => {
      lenisRef.current?.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
    
    lenisRef.current.on('scroll', () => {
      ScrollTrigger.update();
    });
    
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate: true });
    }

    return () => {
      if (lenisRef.current) {
        lenisRef.current.destroy();
        lenisRef.current = null;
      }
    };
  }, [location.pathname]);

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
