import React, { useEffect, useRef, useState, useContext } from 'react';
import PropTypes from 'prop-types';
import './Navbar.css';
import logoimg from '../../assets/logo.png';
import dashboard from '../../assets/dashboard.png'
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { StoreContext } from '../../context/StoreContext';
import { assets } from '../../assets/assets.js';
import { FiBell, FiFileText, FiFolder, FiRefreshCw, FiUser } from 'react-icons/fi';
import useNotifications, { formatTime } from '../../../../shared/useNotifications';
import {
  toSafeMongoObjectId,
  sanitizeOrderNumberForRoute,
} from '../../../../shared/clientApiGuards.js';


const Navbar = ({ setShowLogin }) => {

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const lastScrollY = useRef(0);

  const { token, logout } = useContext(StoreContext);
  const navigate = useNavigate();
  const location = useLocation();
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";
  // payment fix client side: pass pathname so notifications refetch after navigation (e.g. post-payment)
  const {
    notifications, loadingNotifications, refreshingNotifications,
    showNotifications, setShowNotifications, panelRef: notificationRef,
    fetchNotifications, clearNotifications,
  } = useNotifications(token, API_BASE, { pathname: location.pathname });

  const handleNotificationNavigate = (notification) => {
    setShowNotifications(false);
    const orderNum = notification.orderNumber
      ? sanitizeOrderNumberForRoute(String(notification.orderNumber))
      : null;
    if (orderNum) {
      navigate('/orders', { state: { focusOrderNumber: orderNum } });
      return;
    }
    const oid =
      notification.orderId != null
        ? toSafeMongoObjectId(String(notification.orderId))
        : null;
    if (oid) {
      navigate('/orders', { state: { focusOrderId: oid } });
      return;
    }
    navigate('/orders');
  };

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
                      <button
                        key={notification._id}
                        type="button"
                        className="client-notification-item"
                        onClick={() => handleNotificationNavigate(notification)}
                      >
                        <div className="client-notification-title">{notification.title}</div>
                        <div className="client-notification-message">{notification.message}</div>
                        <div className="client-notification-meta">
                          <span>{formatTime(notification.createdAt)}</span>
                          {notification.clearedAt && <span className="client-notification-cleared">Cleared</span>}
                        </div>
                      </button>
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
                  onClick={() => navigate('/profile')} 
                  className="dropdown-item"
                >
                <FiUser style={{ fontSize: '18px', color: '#475467' }} />
                <span>My Profile</span>
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