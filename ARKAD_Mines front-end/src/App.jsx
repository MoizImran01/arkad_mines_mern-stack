import { useState, useEffect, useRef, useContext, useCallback } from 'react';
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
import Profile from './Pages/Profile/Profile';
import EditProfile from './Pages/EditProfile/EditProfile';
import Footer from './Components/Footer/Footer';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { StoreContext } from './context/StoreContext';
import { useIdleSession } from './hooks/useIdleSession';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/** Hooks idle timeout into logout when a session token exists. */
function IdleSessionGate() {
  const { token, logout } = useContext(StoreContext);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("arkad_logout_reason") === "inactivity") {
        sessionStorage.removeItem("arkad_logout_reason");
        toast.info(
          "You have been logged out due to inactivity exceeding one hour. Please log back in."
        );
      }
    } catch {
    }
  }, []);

  const onIdle = useCallback(() => {
    try {
      sessionStorage.setItem("arkad_logout_reason", "inactivity");
    } catch {
    }
    logout();
  }, [logout]);

  useIdleSession(token, onIdle);

  return null;
}

/** Root layout: routes, Lenis scroll, login modal, and idle logout. */
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
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        style={{ zIndex: 30000 }}
      />
      <IdleSessionGate />
      {showLogin ? <LoginPopup setShowLogin={setShowLogin} /> : null}
      <div className="app">
        <Navbar setShowLogin={setShowLogin} />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/products"
            element={
              <ProtectedRoute>
                <Products />
              </ProtectedRoute>
            }
          />
          <Route
            path="/item/:id"
            element={
              <ProtectedRoute>
                <ItemDetail />
              </ProtectedRoute>
            }
          />
          <Route
  path="/place-order/:orderNumber"
  element={
    <ProtectedRoute>
      <PlaceOrder />
    </ProtectedRoute>
  }
/>
          <Route path="/industries" element={<Industries setShowLogin={setShowLogin} />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/contact" element={<ContactUs setShowLogin={setShowLogin} />} />
          <Route
            path="/request-quote"
            element={
              <ProtectedRoute>
                <RequestQuote />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <Orders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quotations"
            element={
              <ProtectedRoute>
                <Quotations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/documents"
            element={
              <ProtectedRoute>
                <Documents />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/edit"
            element={
              <ProtectedRoute>
                <EditProfile />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<div></div>} />
        </Routes>
        <Footer />
      </div>
    </>
  );
}

export default App;
