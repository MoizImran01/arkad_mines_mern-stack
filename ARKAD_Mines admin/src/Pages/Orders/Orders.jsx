import React from 'react'
import './Orders.css'
import { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import {
  FiPackage, FiCheckCircle, FiXCircle, FiClock, FiDollarSign,
  FiUser, FiMapPin, FiPhone, FiCalendar, FiTruck, FiEdit2,
  FiX, FiCheck, FiDownload, FiFileText, FiHome, FiBox
} from 'react-icons/fi'

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000"

const Orders = () => {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedOrder, setExpandedOrder] = useState(null)
  const [editingStatus, setEditingStatus] = useState(null)
  const [statusModalOrder, setStatusModalOrder] = useState(null)
  const [statusForm, setStatusForm] = useState({
    status: '',
    paymentStatus: '',
    courierService: '',
    trackingNumber: '',
    courierLink: '',
    notes: ''
  })
  const [rejectModal, setRejectModal] = useState({ 
    show: false, 
    orderId: null, 
    proofIndex: null, 
    reason: '' 
  })

  // Status options for order model
  const statusOptions = [
    { value: 'draft', label: 'Draft', color: '#6b7280' },
    { value: 'confirmed', label: 'Confirmed', color: '#3b82f6' },
    { value: 'dispatched', label: 'Dispatched', color: '#8b5cf6' },
    { value: 'delivered', label: 'Delivered', color: '#10b981' },
    { value: 'cancelled', label: 'Cancelled', color: '#ef4444' }
  ]

  // Payment status options
  const paymentStatusOptions = [
    { value: 'pending', label: 'Pending', color: '#f59e0b' },
    { value: 'payment_in_progress', label: 'Payment In Progress', color: '#3b82f6' },
    { value: 'fully_paid', label: 'Fully Paid', color: '#10b981' }
  ]

  // Get image URL
  const getImageUrl = (imagePath) => {
    if (!imagePath) return 'https://via.placeholder.com/50?text=No+Image'
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath
    }
    return `${API_URL}/images/${imagePath}`
  }

  // Fetch all orders from backend
  const fetchAllOrders = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('adminToken')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const response = await axios.get(`${API_URL}/api/orders/admin/all`, { headers })
      
      if (response.data.success) {
        setOrders(response.data.orders)
      } else {
        toast.error("Error loading orders")
      }
    } catch (error) {
      console.error("Error fetching orders:", error)
      toast.error("Failed to load orders")
    } finally {
      setLoading(false)
    }
  }

  // Update order status
  const updateOrderStatus = async (orderId) => {
    try {
      if (statusForm.status === 'dispatched' && (!statusForm.courierService || !statusForm.trackingNumber)) {
        toast.error("Courier service and tracking number required for dispatched status")
        return
      }

      const token = localStorage.getItem('adminToken')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const response = await axios.put(
        `${API_URL}/api/orders/admin/status/${orderId}`,
        {
          ...statusForm,
          dispatchedBlocks: []
        },
        { headers }
      )

      if (response.data.success) {
        toast.success(`Order status updated to ${statusForm.status}`)
        setEditingStatus(null)
        setStatusForm({
          status: '',
          paymentStatus: '',
          courierService: '',
          trackingNumber: '',
          courierLink: '',
          notes: ''
        })
        fetchAllOrders()
      } else {
        toast.error(response.data.message || "Failed to update order status")
      }
    } catch (error) {
      console.error("Error updating order status:", error)
      toast.error(error.response?.data?.message || "Error updating order status")
    }
  }

  // Update payment status
  const updatePaymentStatus = async (orderId) => {
    try {
      if (!statusForm.paymentStatus) {
        toast.error("Please select a payment status")
        return
      }

      const token = localStorage.getItem('adminToken')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const response = await axios.put(
        `${API_URL}/api/orders/admin/payment-status/${orderId}`,
        {
          paymentStatus: statusForm.paymentStatus,
          notes: statusForm.notes || ''
        },
        { headers }
      )

      if (response.data.success) {
        toast.success(`Payment status updated to ${statusForm.paymentStatus}`)
        setStatusModalOrder(null)
        setStatusForm({
          status: '',
          paymentStatus: '',
          courierService: '',
          trackingNumber: '',
          courierLink: '',
          notes: ''
        })
        fetchAllOrders()
      } else {
        toast.error(response.data.message || "Failed to update payment status")
      }
    } catch (error) {
      console.error("Error updating payment status:", error)
      toast.error(error.response?.data?.message || "Error updating payment status")
    }
  }

  // Approve a payment proof
  const approvePayment = async (orderId, proofIndex) => {
    try {
      const token = localStorage.getItem('adminToken')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const response = await axios.put(
        `${API_URL}/api/orders/admin/payment/approve/${orderId}/${proofIndex}`,
        { notes: 'Approved by admin' },
        { headers }
      )
      
      if (response.data.success) {
        toast.success('Payment approved')
        fetchAllOrders()
      } else {
        toast.error(response.data.message || 'Failed to approve payment')
      }
    } catch (err) {
      console.error('Error approving payment:', err)
      toast.error(err.response?.data?.message || 'Error approving payment')
    }
  }

  // Reject a payment proof
  const rejectPayment = async (orderId, proofIndex, rejectionReason) => {
    try {
      const token = localStorage.getItem('adminToken')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const response = await axios.put(
        `${API_URL}/api/orders/admin/payment/reject/${orderId}/${proofIndex}`,
        { rejectionReason: rejectionReason || '', notes: rejectionReason || '' },
        { headers }
      )
      
      if (response.data.success) {
        toast.success('Payment rejected')
        setRejectModal({ show: false, orderId: null, proofIndex: null, reason: '' })
        fetchAllOrders()
      } else {
        toast.error(response.data.message || 'Failed to reject payment')
      }
    } catch (err) {
      console.error('Error rejecting payment:', err)
      toast.error(err.response?.data?.message || 'Error rejecting payment')
    }
  }

  // Helper functions
  const toggleOrderExpand = (orderId) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId)
  }

  const openStatusModal = (order) => {
    setStatusModalOrder(order._id)
    setStatusForm({
      status: order.status,
      paymentStatus: order.paymentStatus,
      courierService: order.courierTracking?.courierService || '',
      trackingNumber: order.courierTracking?.trackingNumber || '',
      courierLink: order.courierTracking?.courierLink || '',
      notes: ''
    })
  }

  const closeStatusModal = () => {
    setStatusModalOrder(null)
    setStatusForm({
      status: '',
      courierService: '',
      trackingNumber: '',
      courierLink: '',
      notes: ''
    })
  }

  const startEditingStatus = (order) => {
    setEditingStatus(order._id)
    setStatusForm({
      status: order.status,
      courierService: order.courierTracking?.courierService || '',
      trackingNumber: order.courierTracking?.trackingNumber || '',
      courierLink: order.courierTracking?.courierLink || '',
      notes: ''
    })
  }

  const cancelEditingStatus = () => {
    setEditingStatus(null)
    setStatusForm({
      status: '',
      courierService: '',
      trackingNumber: '',
      courierLink: '',
      notes: ''
    })
  }

  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    }
    return new Date(dateString).toLocaleDateString(undefined, options)
  }

  const formatCurrency = (amount) => {
    return `Rs ${(amount || 0).toLocaleString()}`
  }

  // Initialize
  useEffect(() => {
    fetchAllOrders()
  }, [])

  // Calculate stats
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
        : sum
    }, 0)
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading orders...</p>
      </div>
    )
  }

  return (
    <div className="orders-admin-container">
      {/* Header */}
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
PKR
          </div>
          <div className="stat-info">
            <h3>{formatCurrency(stats.revenue)}</h3>
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
                <th>Balance</th>
                <th>Payment</th>
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
                    <tr 
                      className="order-row" 
                      onClick={() => toggleOrderExpand(order._id)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          toggleOrderExpand(order._id)
                        }
                      }}
                      tabIndex="0"
                      role="button"
                    >
                      <td className="order-id">#{order.orderNumber}</td>
                      <td className="customer-info">
                        <div className="customer-name">
                          <FiUser className="info-icon" />
                          {order.buyer?.companyName || 'Unknown'}
                        </div>
                        <div className="customer-email">
                          {order.buyer?.email}
                        </div>
                      </td>
                      <td className="items-count">
                        {order.items?.length || 0} items
                      </td>
                      <td className="order-total">
                        {formatCurrency(order.financials?.grandTotal)}
                      </td>
                      <td className="outstanding-balance">
                        <span className={`balance-badge ${order.outstandingBalance > 0 ? 'pending' : 'paid'}`}>
                          {formatCurrency(order.outstandingBalance)}
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
                            e.stopPropagation()
                            openStatusModal(order)
                          }}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation()
                              openStatusModal(order)
                            }
                          }}
                          role="button"
                          tabIndex="0"
                          title="Click to edit status"
                        >
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
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
                                  <span className="detail-label">Company</span>
                                  <span>{order.buyer?.companyName || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="detail-label">Email</span>
                                  <span>{order.buyer?.email || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="detail-label">Phone</span>
                                  <span>
                                    <FiPhone className="info-icon" />
                                    {order.deliveryAddress?.phone || 'N/A'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Delivery Address */}
                            <div className="details-section">
                              <h4><FiMapPin className="section-icon" /> Delivery Address</h4>
                              {order.deliveryAddress ? (
                                <div className="address-details">
                                  <p><strong>{order.deliveryAddress.firstName} {order.deliveryAddress.lastName}</strong></p>
                                  <p>{order.deliveryAddress.street}</p>
                                  <p>{order.deliveryAddress.city}, {order.deliveryAddress.state}</p>
                                  <p>{order.deliveryAddress.country} - {order.deliveryAddress.zipCode}</p>
                                  {order.deliveryNotes && (
                                    <p className="delivery-notes">
                                      <strong>Notes:</strong> {order.deliveryNotes}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <p className="no-address">No delivery address provided</p>
                              )}
                            </div>

                            {/* Order Items */}
                            <div className="details-section">
                              <h4><FiBox className="section-icon" /> Order Items ({order.items?.length || 0})</h4>
                              <div className="order-items">
                                {order.items?.map((item, idx) => (
                                  <div key={idx} className="order-item">
                                    <div className="item-image">
                                      <img 
                                        src={getImageUrl(item.image)} 
                                        alt={item.stoneName}
                                        onError={(e) => {
                                          e.target.onerror = null
                                          e.target.src = 'https://via.placeholder.com/50'
                                        }}
                                      />
                                    </div>
                                    <div className="item-info">
                                      <h5>{item.stoneName}</h5>
                                      {item.dimensions && <p>{item.dimensions}</p>}
                                    </div>
                                    <div className="item-quantity">
                                      {item.quantity} × {formatCurrency(item.unitPrice)}
                                    </div>
                                    <div className="item-total">
                                      {formatCurrency(item.totalPrice || item.quantity * item.unitPrice)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Order Summary */}
                            <div className="details-section">
                              <h4><FiFileText className="section-icon" /> Order Summary</h4>
                              <div className="summary-details">
                                <div className="summary-row">
                                  <span>Subtotal:</span>
                                  <span>{formatCurrency(order.financials?.subtotal)}</span>
                                </div>
                                {order.financials?.taxPercentage > 0 && (
                                  <div className="summary-row">
                                    <span>Tax ({order.financials.taxPercentage}%):</span>
                                    <span>{formatCurrency(order.financials.taxAmount)}</span>
                                  </div>
                                )}
                                {order.financials?.shippingCost > 0 && (
                                  <div className="summary-row">
                                    <span>Shipping:</span>
                                    <span>{formatCurrency(order.financials.shippingCost)}</span>
                                  </div>
                                )}
                                {order.financials?.discountAmount > 0 && (
                                  <div className="summary-row discount">
                                    <span>Discount:</span>
                                    <span>- {formatCurrency(order.financials.discountAmount)}</span>
                                  </div>
                                )}
                                <div className="summary-row total">
                                  <span>Grand Total:</span>
                                  <span>{formatCurrency(order.financials?.grandTotal)}</span>
                                </div>
                                {order.outstandingBalance > 0 && (
                                  <div className="summary-row">
                                    <span>Outstanding Balance:</span>
                                    <span className="highlight-red">{formatCurrency(order.outstandingBalance)}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Payment Timeline */}
                            {order.paymentTimeline && order.paymentTimeline.length > 0 && (
                              <div className="payment-timeline-section">
                                <h4> Payment Timeline</h4>
                                <div className="timeline">
                                  {order.paymentTimeline.map((entry, idx) => {
                                    // Find corresponding payment proof if any
                                    const proofIndex = order.paymentProofs?.findIndex(p => 
                                      p.proofFile === entry.proofFile || 
                                      p.uploadedAt === entry.timestamp
                                    )
                                    
                                    const proof = proofIndex !== -1 ? order.paymentProofs[proofIndex] : null

                                    return (
                                      <div key={idx} className="timeline-entry">
                                        <div className={`timeline-dot payment-${entry.action?.replace('payment_', '')}`} />
                                        <div className="timeline-content">
                                          <div className="timeline-header">
                                            <div>
                                              <strong>
                                                {entry.action?.replace(/_/g, ' ').toUpperCase()}
                                              </strong>
                                              <p>{formatDate(entry.timestamp)}</p>
                                              {entry.amountPaid && (
                                                <p className="timeline-amount">
                                                  Amount: {formatCurrency(entry.amountPaid)}
                                                </p>
                                              )}
                                              {entry.notes && (
                                                <p className="timeline-notes">{entry.notes}</p>
                                              )}
                                            </div>
                                            {proof && (
                                              <span className={`proof-status ${proof.status}`}>
                                                {proof.status?.toUpperCase()}
                                              </span>
                                            )}
                                          </div>

                                          {/* Action buttons for pending payments */}
                                          {entry.action === 'payment_submitted' && proof?.status === 'pending' && (
                                            <div className="proof-actions">
                                              {entry.proofFile && (
                                                <button
                                                  onClick={async () => {
                                                    try {
                                                      const proofUrl = getImageUrl(entry.proofFile)
                                                      const response = await fetch(proofUrl)
                                                      const blob = await response.blob()
                                                      const downloadUrl = window.URL.createObjectURL(blob)
                                                      const a = document.createElement('a')
                                                      a.href = downloadUrl
                                                      a.download = `payment-proof-${order.orderNumber}-${idx + 1}.${blob.type.includes('png') ? 'png' : 'jpg'}`
                                                      document.body.appendChild(a)
                                                      a.click()
                                                      window.URL.revokeObjectURL(downloadUrl)
                                                      document.body.removeChild(a)
                                                    } catch (error) {
                                                      console.error('Error downloading proof:', error)
                                                      toast.error('Failed to download payment proof')
                                                    }
                                                  }}
                                                  className="btn-download-invoice"
                                                >
                                                  <FiDownload size={14} /> View Proof
                                                </button>
                                              )}
                                              <button 
                                                className="btn-approve" 
                                                onClick={() => approvePayment(order._id, proofIndex)}
                                              >
                                                <FiCheck size={14} /> Approve
                                              </button>
                                              <button 
                                                className="btn-reject" 
                                                onClick={() => {
                                                  setRejectModal({ 
                                                    show: true, 
                                                    orderId: order._id, 
                                                    proofIndex: proofIndex, 
                                                    reason: '' 
                                                  })
                                                }}
                                              >
                                                <FiX size={14} /> Reject
                                              </button>
                                            </div>
                                          )}

                                          {/* Rejection reason */}
                                          {proof?.status === 'rejected' && proof.notes && (
                                            <div className="rejection-reason">
                                              <strong>Rejection Reason:</strong> {proof.notes}
                                            </div>
                                          )}

                                          {/* Download button for approved payments */}
                                          {entry.action === 'payment_approved' && entry.proofFile && (
                                            <div className="proof-actions">
                                              <button
                                                onClick={async () => {
                                                  try {
                                                    const proofUrl = getImageUrl(entry.proofFile)
                                                    const response = await fetch(proofUrl)
                                                    const blob = await response.blob()
                                                    const downloadUrl = window.URL.createObjectURL(blob)
                                                    const a = document.createElement('a')
                                                    a.href = downloadUrl
                                                    a.download = `invoice-${order.orderNumber}-${idx + 1}.${blob.type.includes('png') ? 'png' : 'jpg'}`
                                                    document.body.appendChild(a)
                                                    a.click()
                                                    window.URL.revokeObjectURL(downloadUrl)
                                                    document.body.removeChild(a)
                                                  } catch (error) {
                                                    console.error('Error downloading invoice:', error)
                                                    toast.error('Failed to download invoice')
                                                  }
                                                }}
                                                className="btn-download-invoice"
                                              >
                                                <FiDownload size={14} /> Download Invoice
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Order Timeline */}
                            {order.timeline && order.timeline.length > 0 && (
                              <div className="order-timeline-section">
                                <h4><FiClock className="section-icon" /> Order Timeline</h4>
                                <div className="timeline">
                                  {order.timeline.map((entry, idx) => (
                                    <div key={idx} className="timeline-entry">
                                      <div className={`timeline-dot status-${entry.status}`} />
                                      <div className="timeline-content">
                                        <strong>
                                          {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                                        </strong>
                                        <p>{formatDate(entry.timestamp)}</p>
                                        {entry.notes && (
                                          <p className="timeline-notes">{entry.notes}</p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Courier Tracking */}
                            {order.status === 'dispatched' && order.courierTracking?.isDispatched && (
                              <div className="details-section courier-section">
                                <h4><FiTruck className="section-icon" /> Courier Tracking</h4>
                                <div className="courier-details">
                                  <div>
                                    <span className="detail-label">Courier Service</span>
                                    <span>{order.courierTracking.courierService}</span>
                                  </div>
                                  <div>
                                    <span className="detail-label">Tracking Number</span>
                                    <span>{order.courierTracking.trackingNumber}</span>
                                  </div>
                                  {order.courierTracking.courierLink && (
                                    <div>
                                      <span className="detail-label">Tracking Link</span>
                                      <a 
                                        href={order.courierTracking.courierLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="courier-link"
                                      >
                                        Track Package →
                                      </a>
                                    </div>
                                  )}
                                  <div>
                                    <span className="detail-label">Dispatched At</span>
                                    <span>{formatDate(order.courierTracking.dispatchedAt)}</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Status Update */}
                            <div className="details-section status-update-section">
                              <h4>Update Order Status</h4>
                              {editingStatus === order._id ? (
                                <div className="status-form">
                                  <div className="form-group">
                                    <label htmlFor={`inline-status-${order._id}`}>Status</label>
                                    <select 
                                      id={`inline-status-${order._id}`}
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
                                        <label htmlFor={`inline-courier-${order._id}`}>Courier Service *</label>
                                        <input 
                                          type="text"
                                          id={`inline-courier-${order._id}`}
                                          placeholder="e.g., TCS, Leopards, Hundi"
                                          value={statusForm.courierService}
                                          onChange={(e) => setStatusForm({...statusForm, courierService: e.target.value})}
                                          className="form-control"
                                          required
                                        />
                                      </div>
                                      <div className="form-group">
                                        <label htmlFor={`inline-tracking-${order._id}`}>Tracking Number *</label>
                                        <input 
                                          type="text"
                                          id={`inline-tracking-${order._id}`}
                                          placeholder="e.g., TCS123456789"
                                          value={statusForm.trackingNumber}
                                          onChange={(e) => setStatusForm({...statusForm, trackingNumber: e.target.value})}
                                          className="form-control"
                                          required
                                        />
                                      </div>
                                      <div className="form-group">
                                        <label htmlFor={`inline-link-${order._id}`}>Courier Tracking Link</label>
                                        <input 
                                          type="text"
                                          id={`inline-link-${order._id}`}
                                          placeholder="https://courier.com/track/..."
                                          value={statusForm.courierLink}
                                          onChange={(e) => setStatusForm({...statusForm, courierLink: e.target.value})}
                                          className="form-control"
                                        />
                                      </div>
                                    </>
                                  )}

                                  <div className="form-group">
                                    <label htmlFor={`inline-notes-${order._id}`}>Notes</label>
                                    <textarea 
                                      id={`inline-notes-${order._id}`}
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
                                      <FiCheck /> Save Changes
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
              <button className="close-btn" onClick={closeStatusModal}>
                <FiX size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="modal-order-status">Order Status</label>
                <select 
                  id="modal-order-status"
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
                <label htmlFor="modal-payment-status">Payment Status</label>
                <select 
                  id="modal-payment-status"
                  value={statusForm.paymentStatus}
                  onChange={(e) => setStatusForm({...statusForm, paymentStatus: e.target.value})}
                  className="form-control"
                >
                  {paymentStatusOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="help-text">
                  Payment status will be updated immediately
                </p>
              </div>

              {statusForm.status === 'dispatched' && (
                <>
                  <div className="form-group">
                    <label htmlFor="modal-courier-service">Courier Service *</label>
                    <input 
                      type="text"
                      id="modal-courier-service"
                      placeholder="e.g., TCS, Leopards, Hundi"
                      value={statusForm.courierService}
                      onChange={(e) => setStatusForm({...statusForm, courierService: e.target.value})}
                      className="form-control"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="modal-tracking-number">Tracking Number *</label>
                    <input 
                      type="text"
                      id="modal-tracking-number"
                      placeholder="e.g., TCS123456789"
                      value={statusForm.trackingNumber}
                      onChange={(e) => setStatusForm({...statusForm, trackingNumber: e.target.value})}
                      className="form-control"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="modal-courier-link">Courier Tracking Link</label>
                    <input 
                      type="text"
                      id="modal-courier-link"
                      placeholder="https://courier.com/track/..."
                      value={statusForm.courierLink}
                      onChange={(e) => setStatusForm({...statusForm, courierLink: e.target.value})}
                      className="form-control"
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label htmlFor="modal-notes">Notes</label>
                <textarea 
                  id="modal-notes"
                  placeholder="Optional notes about this status update"
                  value={statusForm.notes}
                  onChange={(e) => setStatusForm({...statusForm, notes: e.target.value})}
                  className="form-control"
                  rows="3"
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
                  updateOrderStatus(statusModalOrder)
                  closeStatusModal()
                }}
              >
                <FiCheck /> Save Changes
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
              <button 
                className="close-btn" 
                onClick={() => setRejectModal({ show: false, orderId: null, proofIndex: null, reason: '' })}
              >
                <FiX size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="rejection-reason">Rejection Reason (Optional)</label>
                <textarea 
                  id="rejection-reason"
                  placeholder="Enter reason for rejection (this will be shown to the client)"
                  value={rejectModal.reason}
                  onChange={(e) => setRejectModal({...rejectModal, reason: e.target.value})}
                  className="form-control"
                  rows="4"
                />
                <p className="help-text">
                  This reason will be displayed to the client when they track their order
                </p>
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
                  rejectPayment(rejectModal.orderId, rejectModal.proofIndex, rejectModal.reason)
                }}
              >
                <FiX /> Reject Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Orders