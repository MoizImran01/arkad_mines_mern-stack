import React, { useContext } from 'react'
import './Navbar.css'
import { assets } from '../../assets/assets.js'
import { AdminAuthContext } from '../../context/AdminAuthContext'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

const Navbar = () => {
  const { adminUser, logout } = useContext(AdminAuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  return (
    <div className='navbar'>
      <img className='logo' src={assets.logo} alt='ARKAD Mines Logo'/>
      <div className='navbar-right'>
        <div className='admin-info'>
          <span className='admin-name'>{adminUser?.companyName || 'Admin'}</span>
          <span className='admin-role'>Administrator</span>
        </div>
        <div className='profile-section'>
          <button className='logout-btn' onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}

export default Navbar