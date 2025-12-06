import React, { useState, useContext } from 'react';
import './Navbar.css';
import logoimg from '../../assets/logo.png';
import dashboard from '../../assets/dashboard.png'
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { StoreContext } from '../../context/StoreContext';
import { assets } from '../../assets/assets.js';
import { FiFileText } from 'react-icons/fi';


const Navbar = ({ setShowLogin }) => {

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const { token, logout } = useContext(StoreContext);
  const navigate = useNavigate();
  const location = useLocation();

  // Determine active menu based on current path
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

  return (
    <header className="navbar-container">
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

          <div className='nav-profile'>
            <img src={assets.profile_icon} alt="Profile" className="profile-img" />
            <ul className="nav-dropdown">
              <li onClick={() => navigate('/dashboard')} className="dropdown-item">
                <img src={dashboard }alt="Dashboard" />
                <span>Dashboard</span>
              </li>
              <li onClick={() => navigate('/orders')} className="dropdown-item">
                <img src={assets.bag_icon} alt="Orders" />
                <span>My Orders</span>
              </li>
              <li onClick={() => navigate('/quotations')} className="dropdown-item">
                <FiFileText style={{ fontSize: '18px', color: '#475467' }} />
                <span>My Quotations</span>
              </li>
              <hr className="dropdown-divider" />
              <li
                onClick={() => {
                  logout();
                  navigate("/");
                }}
                className="dropdown-item"
              >
                <img src={assets.logout_icon} alt="Logout" />
                <span>Logout</span>
              </li>
            </ul>
          </div>
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

export default Navbar;