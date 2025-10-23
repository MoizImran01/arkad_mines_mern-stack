import React, { useState, useContext } from 'react';
import './Navbar.css';
import logoimg from '../../assets/logo.png';
import dashboard from '../../assets/dashboard.png'
import { Link, useNavigate } from 'react-router-dom';
import { StoreContext } from '../../context/StoreContext';
import { assets } from '../../assets/assets.js';

//main navbar component with authentication state and mobile menu
const Navbar = ({ setShowLogin }) => {
  //state for mobile menu toggle
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  //tracks which nav item is currently active
  const [menu, setMenu] = useState("home");
  //authentication token from global context
  const { token, setToken } = useContext(StoreContext);
  const navigate = useNavigate();

  //toggles mobile menu open/close state
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  //handles user logout by clearing token and redirecting
  const logout = () => {
    localStorage.removeItem("token");
    setToken("");
    navigate("/");
  };

  //sets active menu item and closes mobile menu on selection
  const handleNavClick = (section) => {
    setMenu(section);
    setIsMenuOpen(false); 
  };

  return (
    <header className="navbar-container">
      <div className="navbar-brand">
        <Link to='/' onClick={() => handleNavClick("home")}>
          <img src={logoimg} alt="Stone & Minerals Co." className="logo" />
        </Link>
      </div>

      <nav className={`navbar-nav ${isMenuOpen ? 'nav-open' : ''}`}>
        <Link 
          to="/" 
          className={`nav-link ${menu === "home" ? "nav-active" : ""}`}
          onClick={() => handleNavClick("home")}
        >
          Home
        </Link>
        <Link 
          to="/products" 
          className={`nav-link ${menu === "products" ? "nav-active" : ""}`}
          onClick={() => handleNavClick("products")}
        >
          Product Catalog
        </Link>
        <Link 
          to="/industries" 
          className={`nav-link ${menu === "industries" ? "nav-active" : ""}`}
          onClick={() => handleNavClick("industries")}
        >
          Industries
        </Link>
        <Link 
          to="/about" 
          className={`nav-link ${menu === "about" ? "nav-active" : ""}`}
          onClick={() => handleNavClick("about")}
        >
          About Us
        </Link>
        <Link 
          to="/contact" 
          className={`nav-link ${menu === "contact" ? "nav-active" : ""}`}
          onClick={() => handleNavClick("contact")}
        >
          Contact
        </Link>
      </nav>

      <div className="navbar-actions">
            <button 
          className="btn-primary" 
          onClick={() => {
            navigate('/request-quote');
            handleNavClick("quote");
          }}
        >
          Get Started
        </button>

        {/*conditional rendering based on auth state*/}
        {!token ? (
          //show login button if not authenticated
          <button className="btn-secondary" onClick={() => setShowLogin(true)}>
            Client Login
          </button>
        ) : (
          //show user profile dropdown if authenticated
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
              <hr className="dropdown-divider" />
              <li onClick={logout} className="dropdown-item">
                <img src={assets.logout_icon} alt="Logout" />
                <span>Logout</span>
              </li>
            </ul>
          </div>
        )}

        {/*mobile hamburger menu button*/}
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