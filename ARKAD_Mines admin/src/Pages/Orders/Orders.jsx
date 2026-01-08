import React from 'react'
import './Orders.css'
import { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { FiPackage, FiCheckCircle, FiXCircle, FiClock, FiDollarSign, FiUser, FiMapPin, FiPhone, FiCalendar, FiTruck, FiEdit2, FiX, FiCheck, FiSearch, FiGrid, FiDownload } from 'react-icons/fi';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const Orders = () => {

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [editingStatus, setEditingStatus] = useState(null);
  const [statusModalOrder, setStatusModalOrder] = useState(null);
  const [statusForm, setStatusForm] = useState({
    status: '',
    paymentStatus: '',
    courierService: '',
    trackingNumber: '',
    courierLink: '',
    notes: ''
  });
  const [rejectModal, setRejectModal] = useState({ show: false, orderId: null, proofIndex: null, reason: '' });

  // Payment status options
  const paymentStatusOptions = [
    { value: 'pending', label: 'Pending', color: '#fbbf24' },
    { value: 'payment_in_progress', label: 'Payment In Progress', color: '#93c5fd' },
    { value: 'fully_paid', label: 'Fully Paid', color: '#86efac' }
  ];

  // Status options for order model
  const statusOptions = [
    { value: 'draft', label: 'Draft', icon: <FiEdit2 className="status-icon draft" />, color: '#6b7280' },
    { value: 'confirmed', label: 'Confirmed', icon: <FiCheckCircle className="status-icon confirmed" />, color: '#3b82f6' },
    { value: 'dispatched', label: 'Dispatched', icon: <FiTruck className="status-icon dispatched" />, color: '#8b5cf6' },
    { value: 'delivered', label: 'Delivered', icon: <FiCheckCircle className="status-icon delivered" />, color: '#10b981' },
    { value: 'cancelled', label: 'Cancelled', icon: <FiXCircle className="status-icon cancelled" />, color: '#ef4444' }
  ];

  // Get image URL
  const getImageUrl = (imagePath) => {
    if (!imagePath) return 'https://via.placeholder.com/50?text=No+Image';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    return `${API_URL}/images/${imagePath}`;
  };

  // Fetch all orders from backend
  const fetchAllOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API_URL}/api/orders/admin/all`, { headers });
      if (response.data.success) {
        setOrders(response.data.orders);
      } else {
        toast.error("Error occurred displaying orders");
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  // Update order status
  const updateOrderStatus = async (orderId) => {
    try {

      if (statusForm.status === 'dispatched' && (!statusForm.courierService || !statusForm.trackingNumber)) {
        toast.error("Courier service and tracking number required for dispatched status");
        return;
      }

      const token = localStorage.getItem('adminToken');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await axios.put(
        `${API_URL}/api/orders/admin/status/${orderId}`,
        {
          ...statusForm,
          dispatchedBlocks: []
        },
        { headers }
      );

      if (response.data.success) {
        toast.success(`Order status updated to ${statusForm.status}`);
        setEditingStatus(null);
        setStatusForm({
          status: '',
          paymentStatus: '',
          courierService: '',
          trackingNumber: '',
          courierLink: '',
          notes: ''
        });
        fetchAllOrders();
      } else {
        toast.error(response.data.message || "Failed to update order status");
      }
    } catch (error) {
      console.error("Error updating order status:", error);
      toast.error(error.response?.data?.message || "Error updating order status");
    }
  };

  // Update payment status
  const updatePaymentStatus = async (orderId) => {
    try {
      if (!statusForm.paymentStatus) {
        toast.error("Please select a payment status");
        return;
      }

      const token = localStorage.getItem('adminToken');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await axios.put(
        `${API_URL}/api/orders/admin/payment-status/${orderId}`,
        {
          paymentStatus: statusForm.paymentStatus,
          notes: statusForm.notes || ''
        },
        { headers }
      );

      if (response.data.success) {
        toast.success(`Payment status updated to ${statusForm.paymentStatus}`);
        setStatusModalOrder(null);
        setStatusForm({
          status: '',
          paymentStatus: '',
          courierService: '',
          trackingNumber: '',
          courierLink: '',
          notes: ''
        });
        fetchAllOrders();
      } else {
        toast.error(response.data.message || "Failed to update payment status");
      }
    } catch (error) {
      console.error("Error updating payment status:", error);
      toast.error(error.response?.data?.message || "Error updating payment status");
    }
  };

  const toggleOrderExpand = (orderId) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  const openStatusModal = (order) => {
    setStatusModalOrder(order._id);
    setStatusForm({
      status: order.status,
      paymentStatus: order.paymentStatus,
      courierService: order.courierTracking?.courierService || '',
      trackingNumber: order.courierTracking?.trackingNumber || '',
      courierLink: order.courierTracking?.courierLink || '',
      notes: ''
    });
  };

  const closeStatusModal = () => {
    setStatusModalOrder(null);
    setStatusForm({
      status: '',
      courierService: '',
      trackingNumber: '',
      courierLink: '',
      notes: ''
    });
  };

  const startEditingStatus = (order) => {
    setEditingStatus(order._id);
    setStatusForm({
      status: order.status,
      courierService: order.courierTracking?.courierService || '',
      trackingNumber: order.courierTracking?.trackingNumber || '',
      courierLink: order.courierTracking?.courierLink || '',
      notes: ''
    });
  };

  const cancelEditingStatus = () => {
    setEditingStatus(null);
    setStatusForm({
      status: '',
      courierService: '',
      trackingNumber: '',
      courierLink: '',
      notes: ''
    });
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  useEffect(() => {
    fetchAllOrders();
  }, []);

  // Approve a payment proof (admin)
  const approvePayment = async (orderId, proofIndex) => {
    try {
      const token = localStorage.getItem('adminToken');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.put(`${API_URL}/api/orders/admin/payment/approve/${orderId}/${proofIndex}`, { notes: 'Approved by admin' }, { headers });
      if (response.data.success) {
        toast.success('Payment approved');
        fetchAllOrders();
      } else {
        toast.error(response.data.message || 'Failed to approve payment');
      }
    } catch (err) {
      console.error('Error approving payment:', err);
      toast.error(err.response?.data?.message || 'Error approving payment');
    }
  };

  const rejectPayment = async (orderId, proofIndex, rejectionReason) => {
    try {
      const token = localStorage.getItem('adminToken');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.put(
        `${API_URL}/api/orders/admin/payment/reject/${orderId}/${proofIndex}`, 
        { rejectionReason: rejectionReason || '', notes: rejectionReason || '' }, 
        { headers }
      );
      if (response.data.success) {
        toast.success('Payment rejected');
        setRejectModal({ show: false, orderId: null, proofIndex: null, reason: '' });
        fetchAllOrders();
      } else {
        toast.error(response.data.message || 'Failed to reject payment');
      }
    } catch (err) {
      console.error('Error rejecting payment:', err);
      toast.error(err.response?.data?.message || 'Error rejecting payment');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading orders...</p>
      </div>
    );
  }

  //calculate stats e.g how many orders have been confirmed, dispatched, delivered, cancelled
  const stats = {
    total: orders.length,
    draft: orders.filter(o => o.status === 'draft').length,
    confirmed: orders.filter(o => o.status === 'confirmed').length,
    dispatched: orders.filter(o => o.status === 'dispatched').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
    revenue: orders.reduce((sum, order) => {
      return (order.status === "dispatched" || order.status === "confirmed" || order.status === "delivered") 
        ? sum + (order.financials?.grandTotal || 0) 
        : sum;
    }, 0)
  };

  return (
    <div className="orders-admin-container">
      <div className="orders-header">
        <h1><FiPackage className="header-icon" /> Orders Management</h1>
        <p>Manage and track all customer orders</p>
      </div>

      {/* Statistics Cards */}
      <div className="orders-stats">
        <div className="stat-card">
          <div className="stat-icon total">
            <FiPackage />
          </div>
          <div className="stat-info">
            <h3>{stats.total}</h3>
            <p>Total Orders</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon draft">
            <FiEdit2 />
          </div>
          <div className="stat-info">
            <h3>{stats.draft}</h3>
            <p>Draft</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon confirmed">
            <FiCheckCircle />
          </div>
          <div className="stat-info">
            <h3>{stats.confirmed}</h3>
            <p>Confirmed</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon dispatched">
            <FiTruck />
          </div>
          <div className="stat-info">
            <h3>{stats.dispatched}</h3>
            <p>Dispatched</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon delivered">
            <FiCheckCircle />
          </div>
          <div className="stat-info">
            <h3>{stats.delivered}</h3>
            <p>Delivered</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon revenue">
            <FiDollarSign />
          </div>
          <div className="stat-info">
            <h3>Rs {stats.revenue.toLocaleString()}</h3>
            <p>Total Revenue</p>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="orders-table-container">
        <div className="table-responsive">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Order Number</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Outstanding Balance</th>
                <th>Payment Status</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan="9" className="no-orders">
                    <div className="empty-state">
                      <FiPackage className="empty-icon" />
                      <p>No orders found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map(order => (
                  <React.Fragment key={order._id}>
                    <tr className="order-row" onClick={() => toggleOrderExpand(order._id)}>
                      <td className="order-id">#{order.orderNumber}</td>
                      <td className="customer-info">
                        <div className="customer-name">
                          <FiUser className="info-icon" />
                          {order.buyer?.companyName || 'Unknown'}
                        </div>
                        <div className="customer-email">{order.buyer?.email}</div>
                      </td>
                      <td className="items-count">{order.items?.length || 0} items</td>
                      <td className="order-total">Rs {(order.financials?.grandTotal || 0).toLocaleString()}</td>
                      <td className="outstanding-balance">
                        <span className={`balance-badge ${order.outstandingBalance > 0 ? 'pending' : 'paid'}`}>
                          Rs {(order.outstandingBalance || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="payment-status">
                        <div className={`payment-badge payment-${order.paymentStatus}`}>
                          {order.paymentStatus?.charAt(0).toUpperCase() + order.paymentStatus?.slice(1) || 'Pending'}
                        </div>
                      </td>
                      <td className="order-date">
                        <FiCalendar className="info-icon" />
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="order-status">
                        <div 
                          className={`status-badge status-${order.status} clickable`}
                          onClick={(e) => {
                            e.stopPropagation();
                            openStatusModal(order);
                          }}
                          title="Click to edit status"
                        >
                          {statusOptions.find(s => s.value === order.status)?.icon}
                          {statusOptions.find(s => s.value === order.status)?.label}
                        </div>
                      </td>
                      <td className="order-actions" onClick={(e) => e.stopPropagation()}>
                        <button 
                          className="details-btn"
                          onClick={() => toggleOrderExpand(order._id)}
                        >
                          {expandedOrder === order._id ? 'Hide Details' : 'View Details'}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Order Details */}
                    {expandedOrder === order._id && (
                      <tr className="order-details-row">
                        <td colSpan="9">
                          <div className="order-details">
                            {/* Customer Information */}
                            <div className="details-section">
                              <h4><FiUser className="section-icon" /> Customer Information</h4>
                              <div className="details-grid">
                                <div>
                                  <span className="detail-label">Company:</span>
                                  <span>{order.buyer?.companyName || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="detail-label">Email:</span>
                                  <span>{order.buyer?.email || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="detail-label">Phone:</span>
                                  <span><FiPhone className="info-icon" /> {order.deliveryAddress.phone || 'N/A'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Delivery Address */}
                            <div className="details-section">
                              <h4><FiMapPin className="section-icon" /> Delivery Address</h4>
                              {order.deliveryAddress ? (
                                <div className="address-details">
                                  <p>{order.deliveryAddress.firstName} {order.deliveryAddress.lastName}</p>
                                  <p>{order.deliveryAddress.street}</p>
                                  <p>{order.deliveryAddress.city}, {order.deliveryAddress.state} {order.deliveryAddress.zipCode}</p>
                                  <p>{order.deliveryAddress.country}</p>
                                  {order.deliveryNotes && <p className="delivery-notes"><strong>Notes:</strong> {order.deliveryNotes}</p>}
                                </div>
                              ) : (
                                <p className="no-address">No delivery address provided</p>
                              )}
                            </div>

                            {/* Order Items */}
                            <div className="details-section">
                              <h4><FiPackage className="section-icon" /> Order Items ({order.items?.length || 0})</h4>
                              <div className="order-items">
                                {order.items?.map((item, idx) => (
                                  <div key={idx} className="order-item">
                                    <div className="item-image">
                                      <img 
                                        src={getImageUrl(item.image)} 
                                        alt={item.stoneName}
                                        onError={(e) => {
                                          e.target.onerror = null; 
                                          e.target.src = 'https://via.placeholder.com/50';
                                        }}
                                      />
                                    </div>
                                    <div className="item-info">
                                      <h5>{item.stoneName}</h5>
                                      {item.dimensions && <p>{item.dimensions}</p>}
                                    </div>
                                    <div className="item-quantity">
                                      <span>{item.quantity} × Rs {item.unitPrice?.toLocaleString()}</span>
                                    </div>
                                    <div className="item-total">
                                      Rs {(item.totalPrice || item.quantity * item.unitPrice).toLocaleString()}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Financial Summary */}
                            <div className="details-section">
                              <h4>Order Summary</h4>
                              <div className="summary-details">
                                <div className="summary-row">
                                  <span>Subtotal:</span>
                                  <span>Rs {(order.financials?.subtotal || 0).toLocaleString()}</span>
                                </div>
                                {order.financials?.taxPercentage > 0 && (
                                  <div className="summary-row">
                                    <span>Tax ({order.financials.taxPercentage}%):</span>
                                    <span>Rs {(order.financials.taxAmount || 0).toLocaleString()}</span>
                                  </div>
                                )}
                                {order.financials?.shippingCost > 0 && (
                                  <div className="summary-row">
                                    <span>Shipping:</span>
                                    <span>Rs {(order.financials.shippingCost || 0).toLocaleString()}</span>
                                  </div>
                                )}
                                {order.financials?.discountAmount > 0 && (
                                  <div className="summary-row discount">
                                    <span>Discount:</span>
                                    <span>- Rs {(order.financials.discountAmount || 0).toLocaleString()}</span>
                                  </div>
                                )}
                                <div className="summary-row total">
                                  <span>Grand Total:</span>
                                  <span>Rs {(order.financials?.grandTotal || 0).toLocaleString()}</span>
                                </div>
                              </div>
                            </div>

                            {/* Payment Timeline & Proofs Side-by-Side */}
                            <div className="payment-timeline-proofs-grid">
                              {/* Payment Timeline Section */}
                              {(order.paymentTimeline && order.paymentTimeline.length > 0) && (
                                <div className="payment-timeline-section">
                                  <h4><FiClock className="section-icon" /> Payment Timeline</h4>
                                  <div className="timeline">
                                    {order.paymentTimeline?.map((entry, idx) => (
                                      <div key={idx} className="timeline-entry">
                                        <div className={`timeline-dot payment-${entry.action}`} />
                                        <div className="timeline-content">
                                          <strong>{entry.action?.replace(/_/g, ' ').toUpperCase()}</strong>
                                          <p>{formatDate(entry.timestamp)}</p>
                                          {entry.amountPaid && <p className="timeline-amount">Amount: Rs {entry.amountPaid.toLocaleString()}</p>}
                                          {entry.notes && <p className="timeline-notes">{entry.notes}</p>}
                                          {entry.proofFile && (
                                            <div className="proof-actions">
                                              <button
                                                onClick={async () => {
                                                  try {
                                                    const proofUrl = getImageUrl(entry.proofFile);
                                                    const response = await fetch(proofUrl);
                                                    const blob = await response.blob();
                                                    const downloadUrl = window.URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = downloadUrl;
                                                    a.download = `payment-invoice-${order.orderNumber}-${new Date(entry.timestamp).getTime()}.${blob.type.includes('png') ? 'png' : 'jpg'}`;
                                                    document.body.appendChild(a);
                                                    a.click();
                                                    window.URL.revokeObjectURL(downloadUrl);
                                                    document.body.removeChild(a);
                                                  } catch (error) {
                                                    console.error('Error downloading invoice:', error);
                                                    toast.error('Failed to download payment invoice');
                                                  }
                                                }}
                                                className="btn-download-invoice"
                                              >
                                                <FiDownload /> Download Invoice
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Payment Proofs Section */}
                              {(order.paymentProofs && order.paymentProofs.length > 0) && (
                                <div className="payment-proofs-section">
                                  <h4><FiDollarSign className="section-icon" /> Payment Proofs</h4>
                                  <div className="payment-proofs-list">
                                    {order.paymentProofs.map((proof, pidx) => (
                                      <div key={pidx} className="proof-item">
                                        <div className="proof-header">
                                          <span className={`proof-status ${proof.status || 'pending'}`}>
                                            {proof.status?.toUpperCase() || 'PENDING'}
                                          </span>
                                          {proof.uploadedAt && (
                                            <span className="proof-date">{formatDate(proof.uploadedAt)}</span>
                                          )}
                                        </div>
                                        
                                        {proof.amountPaid && (
                                          <div className="proof-amount">
                                            Amount: Rs {proof.amountPaid.toLocaleString()}
                                          </div>
                                        )}
                                        
                                        <div className="proof-actions">
                                          {proof.proofFile && (
                                            <button
                                              onClick={async () => {
                                                try {
                                                  const proofUrl = getImageUrl(proof.proofFile);
                                                  const response = await fetch(proofUrl);
                                                  const blob = await response.blob();
                                                  const downloadUrl = window.URL.createObjectURL(blob);
                                                  const a = document.createElement('a');
                                                  a.href = downloadUrl;
                                                  a.download = `payment-proof-${order.orderNumber}-${pidx + 1}.${blob.type.includes('png') ? 'png' : 'jpg'}`;
                                                  document.body.appendChild(a);
                                                  a.click();
                                                  window.URL.revokeObjectURL(downloadUrl);
                                                  document.body.removeChild(a);
                                                } catch (error) {
                                                  console.error('Error downloading proof:', error);
                                                  toast.error('Failed to download payment proof');
                                                }
                                              }}
                                              className="btn-download-invoice"
                                            >
                                              <FiDownload /> Download Proof
                                            </button>
                                          )}
                                          
                                          {proof.status === 'pending' && (
                                            <>
                                              <button 
                                                className="btn-approve" 
                                                onClick={() => approvePayment(order._id, pidx)}
                                              >
                                                <FiCheck /> Approve
                                              </button>
                                              <button 
                                                className="btn-reject" 
                                                onClick={() => {
                                                  setRejectModal({ show: true, orderId: order._id, proofIndex: pidx, reason: '' });
                                                }}
                                              >
                                                <FiX /> Reject
                                              </button>
                                            </>
                                          )}
                                          
                                          {proof.status === 'rejected' && proof.notes && (
                                            <div className="rejection-reason">
                                              <strong>Rejection Reason:</strong> {proof.notes || 'N/A'}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Order Timeline - Below the payment sections */}
                            {(order.timeline && order.timeline.length > 0) && (
                              <div className="order-timeline-section">
                                <h4><FiCalendar className="section-icon" /> Order Timeline</h4>
                                <div className="timeline">
                                  {order.timeline?.map((entry, idx) => (
                                    <div key={idx} className="timeline-entry">
                                      <div className={`timeline-dot status-${entry.status}`} />
                                      <div className="timeline-content">
                                        <strong>{entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}</strong>
                                        <p>{formatDate(entry.timestamp)}</p>
                                        {entry.notes && <p className="timeline-notes">{entry.notes}</p>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Courier Tracking Info (if dispatched) */}
                            {order.status === 'dispatched' && order.courierTracking?.isDispatched && (
                              <div className="details-section courier-section">
                                <h4><FiTruck className="section-icon" /> Courier Tracking</h4>
                                <div className="courier-details">
                                  <div>
                                    <span className="detail-label">Courier Service:</span>
                                    <span>{order.courierTracking.courierService}</span>
                                  </div>
                                  <div>
                                    <span className="detail-label">Tracking Number:</span>
                                    <span>{order.courierTracking.trackingNumber}</span>
                                  </div>
                                  {order.courierTracking.courierLink && (
                                    <div>
                                      <span className="detail-label">Tracking Link:</span>
                                      <a href={order.courierTracking.courierLink} target="_blank" rel="noopener noreferrer" className="courier-link">
                                        Track on Courier Website →
                                      </a>
                                    </div>
                                  )}
                                  <div>
                                    <span className="detail-label">Dispatched:</span>
                                    <span>{formatDate(order.courierTracking.dispatchedAt)}</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Status Update Section */}
                            <div className="details-section status-update-section">
                              <h4>Update Order Status</h4>
                              {editingStatus === order._id ? (
                                <div className="status-form">
                                  <div className="form-group">
                                    <label>Status</label>
                                    <select 
                                      value={statusForm.status}
                                      onChange={(e) => setStatusForm({...statusForm, status: e.target.value})}
                                      className="form-control"
                                    >
                                      <option value="">Select Status</option>
                                      {statusOptions.map(option => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  {statusForm.status === 'dispatched' && (
                                    <>
                                      <div className="form-group">
                                        <label>Courier Service *</label>
                                        <input 
                                          type="text"
                                          placeholder="e.g., TCS, Leopards, Hundi"
                                          value={statusForm.courierService}
                                          onChange={(e) => setStatusForm({...statusForm, courierService: e.target.value})}
                                          className="form-control"
                                        />
                                      </div>
                                      <div className="form-group">
                                        <label>Tracking Number *</label>
                                        <input 
                                          type="text"
                                          placeholder="e.g., TCS123456789"
                                          value={statusForm.trackingNumber}
                                          onChange={(e) => setStatusForm({...statusForm, trackingNumber: e.target.value})}
                                          className="form-control"
                                        />
                                      </div>
                                      <div className="form-group">
                                        <label>Courier Tracking Link</label>
                                        <input 
                                          type="text"
                                          placeholder="https://courier.com/track/..."
                                          value={statusForm.courierLink}
                                          onChange={(e) => setStatusForm({...statusForm, courierLink: e.target.value})}
                                          className="form-control"
                                        />
                                      </div>
                                    </>
                                  )}

                                  <div className="form-group">
                                    <label>Notes</label>
                                    <textarea 
                                      placeholder="Optional notes about this status update"
                                      value={statusForm.notes}
                                      onChange={(e) => setStatusForm({...statusForm, notes: e.target.value})}
                                      className="form-control"
                                      rows="2"
                                    />
                                  </div>

                                  <div className="form-actions">
                                    <button 
                                      className="btn btn-save"
                                      onClick={() => updateOrderStatus(order._id)}
                                    >
                                      <FiCheck /> Save
                                    </button>
                                    <button 
                                      className="btn btn-cancel"
                                      onClick={cancelEditingStatus}
                                    >
                                      <FiX /> Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button 
                                  className="edit-status-btn"
                                  onClick={() => startEditingStatus(order)}
                                >
                                  <FiEdit2 /> Edit Status
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status Update Modal */}
      {statusModalOrder && (
        <div className="status-modal-overlay" onClick={closeStatusModal}>
          <div className="status-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Update Order Status</h3>
              <button className="close-btn" onClick={closeStatusModal}><FiX size={20} /></button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Order Status</label>
                <select 
                  value={statusForm.status}
                  onChange={(e) => setStatusForm({...statusForm, status: e.target.value})}
                  className="form-control"
                >
                  <option value="">Select Status</option>
                  {statusOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Payment Status (Read-only)</label>
                <div className="payment-status-display">
                  <span className={`payment-badge payment-${statusForm.paymentStatus || 'pending'}`}>
                    {paymentStatusOptions.find(opt => opt.value === statusForm.paymentStatus)?.label || 'Pending'}
                  </span>
                  <p className="help-text">Payment status is automatically updated based on payment proofs</p>
                </div>
              </div>

              {statusForm.status === 'dispatched' && (
                <>
                  <div className="form-group">
                    <label>Courier Service *</label>
                    <input 
                      type="text"
                      placeholder="e.g., TCS, Leopards, Hundi"
                      value={statusForm.courierService}
                      onChange={(e) => setStatusForm({...statusForm, courierService: e.target.value})}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>Tracking Number *</label>
                    <input 
                      type="text"
                      placeholder="e.g., TCS123456789"
                      value={statusForm.trackingNumber}
                      onChange={(e) => setStatusForm({...statusForm, trackingNumber: e.target.value})}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>Courier Tracking Link</label>
                    <input 
                      type="text"
                      placeholder="https://courier.com/track/..."
                      value={statusForm.courierLink}
                      onChange={(e) => setStatusForm({...statusForm, courierLink: e.target.value})}
                      className="form-control"
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label>Notes</label>
                <textarea 
                  placeholder="Optional notes about this status update"
                  value={statusForm.notes}
                  onChange={(e) => setStatusForm({...statusForm, notes: e.target.value})}
                  className="form-control"
                  rows="2"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn btn-cancel"
                onClick={closeStatusModal}
              >
                <FiX /> Cancel
              </button>
              <button 
                className="btn btn-save"
                onClick={() => {
                  updateOrderStatus(statusModalOrder);
                  closeStatusModal();
                }}
              >
                <FiCheck /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectModal.show && (
        <div className="status-modal-overlay" onClick={() => setRejectModal({ show: false, orderId: null, proofIndex: null, reason: '' })}>
          <div className="status-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reject Payment Proof</h3>
              <button className="close-btn" onClick={() => setRejectModal({ show: false, orderId: null, proofIndex: null, reason: '' })}><FiX size={20} /></button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Rejection Reason (Optional)</label>
                <textarea 
                  placeholder="Enter reason for rejection (leave blank for N/A)"
                  value={rejectModal.reason}
                  onChange={(e) => setRejectModal({...rejectModal, reason: e.target.value})}
                  className="form-control"
                  rows="4"
                />
                <p className="help-text">This reason will be displayed to the client when they track their order</p>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn btn-cancel"
                onClick={() => setRejectModal({ show: false, orderId: null, proofIndex: null, reason: '' })}
              >
                <FiX /> Cancel
              </button>
              <button 
                className="btn btn-save"
                onClick={() => {
                  rejectPayment(rejectModal.orderId, rejectModal.proofIndex, rejectModal.reason);
                }}
              >
                <FiCheck /> Reject Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Orders;