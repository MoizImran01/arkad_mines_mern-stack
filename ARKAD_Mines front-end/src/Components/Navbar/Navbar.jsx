import React, { useEffect, useRef, useState, useContext } from 'react';
import PropTypes from 'prop-types';
import './Navbar.css';
import logoimg from '../../assets/logo.png';
import dashboard from '../../assets/dashboard.png'
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { StoreContext } from '../../context/StoreContext';
import { assets } from '../../assets/assets.js';
import { FiBell, FiFileText, FiFolder, FiRefreshCw } from 'react-icons/fi';
import axios from 'axios';


const Navbar = ({ setShowLogin }) => {

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const lastScrollY = useRef(0);

  const { token, logout } = useContext(StoreContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [refreshingNotifications, setRefreshingNotifications] = useState(false);
  const notificationRef = useRef(null);

  const getActiveMenu = () => {
    const path = location.pathname;
    if (path === '/') return 'home';
    if (path === '/products' || path.startsWith('/products')) return 'products';
    if (path === '/industries' || path.startsWith('/industries')) return 'industries';
    if (path === '/about' || path.startsWith('/about')) return 'about';
    if (path === '/contact' || path.startsWith('/contact')) return 'contact';
    return '';
  };

  const menu = getActiveMenu();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleNavClick = () => {
    setIsMenuOpen(false); 
  };

  const fetchNotifications = async (isRefresh = false) => {
    if (!token) return;
    try {
      if (isRefresh) {
        setRefreshingNotifications(true);
      } else {
        setLoadingNotifications(true);
      }
      const response = await axios.get(`${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setNotifications(response.data.notifications || []);
      }
    } catch (error) {
      console.error("Client notifications error:", error);
    } finally {
      setLoadingNotifications(false);
      setRefreshingNotifications(false);
    }
  };

  const clearNotifications = async () => {
    if (!token) return;
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/notifications/clear`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setNotifications([]);
      }
    } catch (error) {
      console.error("Client clear notifications error:", error);
    }
  };

  const formatTime = (date) => {
    if (!date) return "";
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  useEffect(() => {
    fetchNotifications();
  }, [token]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 50);
      if (y > lastScrollY.current && y > 120) {
        setNavHidden(true);
      } else {
        setNavHidden(false);
      }
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`navbar-container${scrolled ? ' navbar-scrolled' : ''}${navHidden ? ' navbar-hidden' : ''}`}>
      <div className="navbar-brand">
        <Link to='/' onClick={handleNavClick}>
          <img src={logoimg} alt="Stone & Minerals Co." className="logo" />
        </Link>
      </div>

      <nav className={`navbar-nav ${isMenuOpen ? 'nav-open' : ''}`}>
        <Link 
          to="/" 
          className={`nav-link ${menu === "home" ? "nav-active" : ""}`}
          onClick={handleNavClick}
        >
          Home
        </Link>
        {token && (
          <Link 
            to="/products" 
            className={`nav-link ${menu === "products" ? "nav-active" : ""}`}
            onClick={handleNavClick}
          >
            Product Catalog
          </Link>
        )}
        <Link 
          to="/industries" 
          className={`nav-link ${menu === "industries" ? "nav-active" : ""}`}
          onClick={handleNavClick}
        >
          Industries
        </Link>
        <Link 
          to="/about" 
          className={`nav-link ${menu === "about" ? "nav-active" : ""}`}
          onClick={handleNavClick}
        >
          About Us
        </Link>
        <Link 
          to="/contact" 
          className={`nav-link ${menu === "contact" ? "nav-active" : ""}`}
          onClick={handleNavClick}
        >
          Contact
        </Link>
      </nav>

      <div className="navbar-actions">
        {!token ? (

          <button className="btn-secondary" onClick={() => setShowLogin(true)}>
            Client Login
          </button>
        ) : (

          <>
            <div className="client-notification-wrapper" ref={notificationRef}>
              <button className="client-notification-btn" onClick={() => setShowNotifications(!showNotifications)}>
                <FiBell />
                {notifications.length > 0 && (
                  <span className="client-notification-badge">{notifications.length}</span>
                )}
              </button>
              {showNotifications && (
                <div className="client-notifications-panel">
                  <div className="client-notifications-header">
                    <h4>Payment Updates</h4>
                    <div className="client-notifications-actions">
                      <button 
                        className="client-notification-refresh" 
                        onClick={() => fetchNotifications(true)}
                        disabled={refreshingNotifications}
                        title="Refresh notifications"
                      >
                        <FiRefreshCw className={refreshingNotifications ? 'spin' : ''} />
                      </button>
                      <button className="client-notification-link" onClick={clearNotifications}>Clear</button>
                    </div>
                  </div>
                  <div className="client-notifications-list">
                    {loadingNotifications && <p className="client-notifications-empty">Loading...</p>}
                    {!loadingNotifications && notifications.length === 0 && (
                      <p className="client-notifications-empty">No updates yet</p>
                    )}
                    {notifications.map((notification) => (
                      <div key={notification._id} className="client-notification-item">
                        <div className="client-notification-title">{notification.title}</div>
                        <div className="client-notification-message">{notification.message}</div>
                        <div className="client-notification-meta">
                          <span>{formatTime(notification.createdAt)}</span>
                          {notification.clearedAt && <span className="client-notification-cleared">Cleared</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className='nav-profile'>
            <img src={assets.profile_icon} alt="Profile" className="profile-img" />
            <ul className="nav-dropdown">
              <li className="dropdown-item-wrapper">
                <button 
                  type="button"
                  onClick={() => navigate('/dashboard')} 
                  className="dropdown-item"
                >
                  <img src={dashboard} alt="" />
                <span>Dashboard</span>
                </button>
              </li>
              <li className="dropdown-item-wrapper">
                <button 
                  type="button"
                  onClick={() => navigate('/orders')} 
                  className="dropdown-item"
                >
                  <img src={assets.bag_icon} alt="" />
                <span>My Orders</span>
                </button>
              </li>
              <li className="dropdown-item-wrapper">
                <button 
                  type="button"
                  onClick={() => navigate('/quotations')} 
                  className="dropdown-item"
                >
                <FiFileText style={{ fontSize: '18px', color: '#475467' }} />
                <span>My Quotations</span>
                </button>
              </li>
              <li className="dropdown-item-wrapper">
                <button 
                  type="button"
                  onClick={() => navigate('/documents')} 
                  className="dropdown-item"
                >
                <FiFolder style={{ fontSize: '18px', color: '#475467' }} />
                <span>Document History</span>
                </button>
              </li>
              <hr className="dropdown-divider" />
              <li className="dropdown-item-wrapper">
                <button 
                  type="button"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
                className="dropdown-item"
              >
                  <img src={assets.logout_icon} alt="" />
                <span>Logout</span>
                </button>
              </li>
            </ul>
          </div>
          </>
        )}


        <button 
          className="nav-toggle" 
          onClick={toggleMenu}
          aria-label="Toggle navigation menu"
        >
          <span className={`hamburger ${isMenuOpen ? 'hamburger-open' : ''}`}>
            <span></span>
            <span></span>
            <span></span>
          </span>
        </button>
      </div>
    </header>
  );
};

Navbar.propTypes = {
  setShowLogin: PropTypes.func.isRequired,
};

export default Navbar;