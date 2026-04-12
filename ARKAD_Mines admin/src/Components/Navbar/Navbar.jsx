import React, { useContext, useState } from 'react'
import './Navbar.css'
import { assets } from '../../assets/assets.js'
import { AdminAuthContext } from '../../context/AdminAuthContext'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'react-toastify'
import axios from 'axios'
import { FiBell, FiX, FiRefreshCw } from 'react-icons/fi'
import useNotifications, { formatTime } from '../../../../shared/useNotifications'

const API_BASE = import.meta.env.VITE_API_URL ?? "";

const Navbar = () => {
  const { adminUser, logout, token } = useContext(AdminAuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [showExpanded, setShowExpanded] = useState(false);
  const [paymentSummary, setPaymentSummary] = useState([]);

  const {
    notifications, loadingNotifications, refreshingNotifications,
    showNotifications, setShowNotifications, panelRef,
    fetchNotifications, clearNotifications,
  } = useNotifications(token, API_BASE, { pathname: location.pathname });

  const authHeaders = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const fetchPaymentSummary = async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${API_BASE}/api/notifications/admin/payment-summary`, authHeaders);
      if (response.data.success) {
        setPaymentSummary(response.data.summary || []);
      }
    } catch (error) {
      console.error("Payment summary error:", error);
    }
  };

  const renderNotificationItem = (notification) => (
    <div key={notification._id} className="notification-item">
      <div className="notification-title">{notification.title}</div>
      <div className="notification-message">{notification.message}</div>
      <div className="notification-meta">
        <span>{formatTime(notification.createdAt)}</span>
        {notification.clearedAt && <span className="notification-cleared">Cleared</span>}
      </div>
    </div>
  );

  const isRefreshing = refreshingNotifications || loadingNotifications;

  const renderRefreshButton = (onRefresh, style) => (
    <button
      className="notification-link refresh-notification-btn"
      onClick={onRefresh}
      disabled={isRefreshing}
      title="Refresh notifications"
      style={style}
    >
      <FiRefreshCw className={refreshingNotifications ? 'spin' : ''} />
    </button>
  );

  const renderNotificationList = (showLoading) => (
    <>
      {showLoading && loadingNotifications && <p className="notifications-empty">Loading...</p>}
      {(!showLoading || !loadingNotifications) && notifications.length === 0 && (
        <p className="notifications-empty">No notifications yet</p>
      )}
      {notifications.map(renderNotificationItem)}
    </>
  );

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
                  {renderRefreshButton(() => fetchNotifications(true))}
                  <button className="notification-link" onClick={() => { setShowExpanded(true); fetchPaymentSummary(); }}>
                    Expand
                  </button>
                  <button className="notification-link" onClick={() => clearNotifications(() => toast.success("Notifications cleared"))}>
                    Clear
                  </button>
                </div>
              </div>
              <div className="notifications-list">
                {renderNotificationList(true)}
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
        <div 
          className="notification-modal-overlay" 
          role="dialog"
          aria-modal="true"
          aria-labelledby="notification-modal-title"
        >
          <div className="notification-modal" role="document">
            <div className="notification-modal-header">
              <h3 id="notification-modal-title">Payment Notifications</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {renderRefreshButton(() => { fetchNotifications(true); fetchPaymentSummary(); }, { padding: '4px 8px' })}
                <button className="notification-modal-close" onClick={() => setShowExpanded(false)}>
                  <FiX />
                </button>
              </div>
            </div>
            <div className="notification-modal-content">
              <div className="notification-modal-section">
                <h4>Recent Updates</h4>
                <div className="notification-modal-list">
                  {renderNotificationList(false)}
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