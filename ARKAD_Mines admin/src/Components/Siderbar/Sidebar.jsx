import React from 'react';
import './Sidebar.css';
import { NavLink } from 'react-router-dom';
import { FiUser, FiPackage, FiFileText, FiTrendingUp, FiTruck, FiPlusSquare, FiList, FiShoppingCart, FiHome } from 'react-icons/fi';

const Siderbar = () => {
  return (
    <div className='sidebar'>
      <div className="sidebar-options">
        <NavLink to='/dashboard' className="sidebar-option">
          <FiHome className="sidebar-icon" />
          <p>Dashboard</p>
        </NavLink>

        <NavLink to='/add' className="sidebar-option">
          <FiPlusSquare className="sidebar-icon" />
          <p>Add Items</p>
        </NavLink>

        <NavLink to='/list' className="sidebar-option">
          <FiList className="sidebar-icon" />
          <p>List Items</p>
        </NavLink>

        <NavLink to='/orders' className="sidebar-option">
          <FiShoppingCart className="sidebar-icon" />
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

        <NavLink to='/purchase-orders' className="sidebar-option">
          <FiTruck className="sidebar-icon" />
          <p>Purchase Orders</p>
        </NavLink>

        <NavLink to='/create-purchase-order' className="sidebar-option">
          <FiPackage className="sidebar-icon" />
          <p>Create Purchase Order</p>
        </NavLink>

        <NavLink to='/forecasting' className="sidebar-option">
          <FiTrendingUp className="sidebar-icon" />
          <p>Inventory Forecasting</p>
        </NavLink>
      </div>
    </div>
  );
};

export default Siderbar;
