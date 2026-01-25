import React, { useContext, useEffect, useRef, useState } from 'react'
import './Navbar.css'
import { assets } from '../../assets/assets.js'
import { AdminAuthContext } from '../../context/AdminAuthContext'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axios from 'axios'
import { FiBell, FiX } from 'react-icons/fi'

const Navbar = () => {
  const { adminUser, logout, token } = useContext(AdminAuthContext);
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showExpanded, setShowExpanded] = useState(false);
  const [paymentSummary, setPaymentSummary] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const panelRef = useRef(null);

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      setLoadingNotifications(true);
      const response = await axios.get(`${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setNotifications(response.data.notifications || []);
      }
    } catch (error) {
      console.error("Notification fetch error:", error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const fetchPaymentSummary = async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/notifications/admin/payment-summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setPaymentSummary(response.data.summary || []);
      }
    } catch (error) {
      console.error("Payment summary error:", error);
    }
  };

  const clearNotifications = async () => {
    if (!token) return;
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/notifications/clear`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        const clearedAt = response.data.clearedAt || new Date().toISOString();
        setNotifications((prev) => prev.map((n) => ({ ...n, clearedAt })));
        toast.success("Notifications cleared");
      }
    } catch (error) {
      console.error("Clear notifications error:", error);
      toast.error("Failed to clear notifications");
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
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className='navbar'>
      <img className='logo' src={assets.logo} alt='ARKAD Mines Logo'/>
      <div className='navbar-right'>
        <div className="notification-wrapper" ref={panelRef}>
          <button className="notification-btn" onClick={() => setShowNotifications(!showNotifications)}>
            <FiBell />
            {notifications.length > 0 && (
              <span className="notification-badge">{notifications.length}</span>
            )}
          </button>
          {showNotifications && (
            <div className="notifications-panel">
              <div className="notifications-header">
                <h4>Payment Notifications</h4>
                <div className="notification-actions">
                  <button className="notification-link" onClick={() => { setShowExpanded(true); fetchPaymentSummary(); }}>
                    Expand
                  </button>
                  <button className="notification-link" onClick={clearNotifications}>
                    Clear
                  </button>
                </div>
              </div>
              <div className="notifications-list">
                {loadingNotifications && <p className="notifications-empty">Loading...</p>}
                {!loadingNotifications && notifications.length === 0 && (
                  <p className="notifications-empty">No notifications yet</p>
                )}
                {notifications.map((notification) => (
                  <div key={notification._id} className="notification-item">
                    <div className="notification-title">{notification.title}</div>
                    <div className="notification-message">{notification.message}</div>
                    <div className="notification-meta">
                      <span>{formatTime(notification.createdAt)}</span>
                      {notification.clearedAt && <span className="notification-cleared">Cleared</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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
      {showExpanded && (
        <div className="notification-modal-overlay" onClick={() => setShowExpanded(false)}>
          <div className="notification-modal" onClick={(e) => e.stopPropagation()}>
            <div className="notification-modal-header">
              <h3>Payment Notifications</h3>
              <button className="notification-modal-close" onClick={() => setShowExpanded(false)}>
                <FiX />
              </button>
            </div>
            <div className="notification-modal-content">
              <div className="notification-modal-section">
                <h4>Recent Updates</h4>
                <div className="notification-modal-list">
                  {notifications.length === 0 && (
                    <p className="notifications-empty">No notifications yet</p>
                  )}
                  {notifications.map((notification) => (
                    <div key={notification._id} className="notification-item">
                      <div className="notification-title">{notification.title}</div>
                      <div className="notification-message">{notification.message}</div>
                      <div className="notification-meta">
                        <span>{formatTime(notification.createdAt)}</span>
                        {notification.clearedAt && <span className="notification-cleared">Cleared</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="notification-modal-section">
                <h4>Payment Status by Client</h4>
                <div className="notification-summary-table">
                  <div className="summary-row summary-header">
                    <span>Client</span>
                    <span>Status</span>
                    <span>Outstanding</span>
                    <span>Last Order</span>
                  </div>
                  {paymentSummary.length === 0 && (
                    <p className="notifications-empty">No payment summary available</p>
                  )}
                  {paymentSummary.map((item, idx) => (
                    <div key={`${item.buyerId}-${idx}`} className="summary-row">
                      <span>{item.companyName}</span>
                      <span className={`status-pill status-${item.latestPaymentStatus}`}>
                        {item.latestPaymentStatus}
                      </span>
                      <span>PKR {Number(item.outstandingBalance || 0).toLocaleString()}</span>
                      <span>{item.latestOrderNumber}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Navbar