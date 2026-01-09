import React from 'react';
import './Sidebar.css';
import { assets } from '../../assets/assets';
import { NavLink } from 'react-router-dom';
import { FiUser, FiPackage, FiFileText, FiBarChart2 } from 'react-icons/fi';

const Siderbar = () => {
  return (
    <div className='sidebar'>
      <div className="sidebar-options">
        <NavLink to='/add' className="sidebar-option">
          <img src={assets.add_icon} alt="Add" />
          <p>Add Items</p>
        </NavLink>

        <NavLink to='/list' className="sidebar-option">
          <img src={assets.order_icon} alt="List" />
          <p>List Items</p>
        </NavLink>

        <NavLink to='/orders' className="sidebar-option">
          <img src={assets.order_icon} alt="Orders" />
          <p>Orders</p>
        </NavLink>

        <NavLink to='/dispatch' className="sidebar-option">
          <FiPackage className="sidebar-icon" />
          <p>Dispatch</p>
        </NavLink>

        <NavLink to='/users' className="sidebar-option">
          <FiUser className="sidebar-icon" />
          <p>Users</p>
        </NavLink>

        <NavLink to='/quotes' className="sidebar-option">
          <FiFileText className="sidebar-icon" />
          <p>Quotes</p>
        </NavLink>

        <NavLink to='/analytics' className="sidebar-option">
          <FiBarChart2 className="sidebar-icon" />
          <p>Analytics</p>
        </NavLink>
      </div>
    </div>
  );
};

export default Siderbar;
