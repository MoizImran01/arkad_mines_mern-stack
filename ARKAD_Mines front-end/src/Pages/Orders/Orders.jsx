
import React, { useContext, useEffect, useMemo, useState, useRef } from "react";
import "./Orders.css";
import { compressImage } from "../../utils/compressImage";
import axios from "axios";
import { toast } from "react-toastify";
import { StoreContext } from "../../context/StoreContext";
import { useNavigate, useLocation } from "react-router-dom";
import Pagination from '../../../../shared/Pagination.jsx';
import { subscribeLive } from '../../../../shared/socketLiveRegistry.js';
import usePaymentVerification from '../../../../shared/usePaymentVerification';
import { formatOrderStatus, formatPaymentStatus } from '../../utils/formatStatus';
import { MfaModal } from '../../../../shared/VerificationModals.jsx';
import { 
  FiLoader, FiExternalLink, FiCreditCard, FiPackage, 
  FiMapPin, FiCalendar, FiTruck, FiX, FiCheck, FiShoppingCart, FiCheckCircle, FiDownload,
  FiBriefcase, FiRefreshCw
} from "react-icons/fi";
import {
  toSafeMongoObjectId,
  sanitizeOrderNumberForRoute,
  safeImageFilenameSegment,
} from "../../../../shared/clientApiGuards.js";

const Orders = () => {
  const { token, url, replaceQuoteItems, setActiveQuoteId } = useContext(StoreContext);
  
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [trackingOrderNumber, setTrackingOrderNumber] = useState(null);
  const [trackingOrderDetails, setTrackingOrderDetails] = useState(null);
  const [modalTab, setModalTab] = useState("tracking");
  
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    proofFile: null
  });
  
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const pv = usePaymentVerification(url, token);

  const navigate = useNavigate();
  const location = useLocation();

  const ORDER_STATUSES = ["draft", "confirmed", "dispatched", "delivered", "cancelled"];

  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
  }), [token]);

  const fetchOrdersRef = useRef(async () => {});
  const fetchOrders = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${url}/api/orders/my`, { headers });

      if (response.data.success) {
        const sortedOrders = (response.data.orders || []).sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        setOrders(sortedOrders);
        setFilteredOrders(sortedOrders);
      } else {
        setError("Unable to load order history.");
      }
    } catch (err) {
      console.error("Error fetching orders:", err);
      setError("Error connecting to server.");
    } finally {
      setLoading(false);
    }
  };
  fetchOrdersRef.current = fetchOrders;

  useEffect(() => {
    const fn = () => fetchOrdersRef.current();
    const u1 = subscribeLive("orders", fn);
    // Payment approve/reject emits notification; refetch orders so balances/status match without refresh
    const u2 = subscribeLive("notifications", fn);
    return () => {
      u1();
      u2();
    };
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [token]);

  // Open relevant order from notification navigation (see Navbar notification click handler).
  useEffect(() => {
    if (loading || orders.length === 0) return;
    const st = location.state;
    if (!st?.focusOrderNumber && !st?.focusOrderId) return;
    let order = null;
    if (st.focusOrderNumber) {
      const n = sanitizeOrderNumberForRoute(st.focusOrderNumber);
      if (n) order = orders.find((o) => o.orderNumber === n);
    }
    if (!order && st.focusOrderId) {
      const id = toSafeMongoObjectId(st.focusOrderId);
      if (id) order = orders.find((o) => String(o._id) === id);
    }
    if (order) {
      setTrackingOrderDetails(order);
      setTrackingOrderNumber(order.orderNumber);
      setModalTab("payment");
      navigate(".", { replace: true, state: {} });
    }
  }, [loading, orders, location.state, navigate]);

  useEffect(() => {
    if (activeTab === "all") {
      setFilteredOrders(orders);
    } else {
      setFilteredOrders(orders.filter((order) => order.status === activeTab));
    }
  }, [activeTab, orders]);
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, orders.length]);

  useEffect(() => {
    const hasModalOpen = trackingOrderNumber || pv.showMfaModal;
    const lenisInstance = globalThis.lenisInstance;
    let scrollY = 0;

    if (hasModalOpen) {
      scrollY = globalThis.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${scrollY}px`;
      if (lenisInstance) {
        lenisInstance.stop();
        lenisInstance.options.smoothWheel = false;
      }
    } else {
      const savedScrollY = Number.parseInt(document.body.style.top || "0", 10) * -1;
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.top = "";
      if (savedScrollY) {
        globalThis.scrollTo(0, savedScrollY);
      }
      if (lenisInstance) {
        lenisInstance.options.smoothWheel = true;
        lenisInstance.start();
      }
    }

    return () => {
      if (!trackingOrderNumber && !pv.showMfaModal) {
        const savedScrollY = Number.parseInt(document.body.style.top || "0", 10) * -1;
        document.body.style.position = "";
        document.body.style.width = "";
        document.body.style.top = "";
        if (savedScrollY) {
          globalThis.scrollTo(0, savedScrollY);
        }
        if (lenisInstance) {
          lenisInstance.options.smoothWheel = true;
          lenisInstance.start();
        }
      }
    };
  }, [trackingOrderNumber, pv.showMfaModal]);

  useEffect(() => {
    if (!trackingOrderNumber && !pv.showMfaModal) return;

    const modalBodies = document.querySelectorAll(".modal-body");
    const lenisInstance = globalThis.lenisInstance;
    
    if (lenisInstance) {
      lenisInstance.options.smoothWheel = false;
      lenisInstance.stop();
    }
    
    const handleWheel = (e) => {
      if (!e.currentTarget.classList.contains('modal-body')) return;
      
      const target = e.currentTarget;
      const scrollAmount = e.deltaY;
      const currentScroll = target.scrollTop;
      const maxScroll = target.scrollHeight - target.clientHeight;
      
      const canScrollUp = currentScroll > 0;
      const canScrollDown = currentScroll < maxScroll;
      
      if ((scrollAmount < 0 && canScrollUp) || (scrollAmount > 0 && canScrollDown)) { 
        e.stopPropagation();
        e.stopImmediatePropagation();
        target.scrollTop += scrollAmount * 0.5;
        e.preventDefault();
        return false;
      } else {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    modalBodies.forEach(body => {
      body.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    });

    return () => {
      modalBodies.forEach(body => {
        body.removeEventListener('wheel', handleWheel, { capture: true });
      });
      if (lenisInstance) {
        lenisInstance.options.smoothWheel = true;
        lenisInstance.start();
      }
    };
  }, [trackingOrderNumber, pv.showMfaModal]);

  const openTrackingView = (orderNumber) => {
    const order = orders.find(o => o.orderNumber === orderNumber);
    setTrackingOrderDetails(order);
    setTrackingOrderNumber(orderNumber);
    setModalTab("tracking");
  };

  const closeTrackingView = () => {
    setTrackingOrderNumber(null);
    setTrackingOrderDetails(null);
  };

  const handleProceedToPayment = (order) => {
    if (order.items) {
      replaceQuoteItems(order.items);
      setActiveQuoteId(order._id);
      navigate(`/place-order/${order.orderNumber}`);
    }
  };

  const refreshAfterPayment = async (orderId) => {
    setPaymentForm({ amount: "", proofFile: null });
    const safeId = toSafeMongoObjectId(orderId);
    if (!safeId) return;
    try {
      const updatedOrder = await axios.get(`${url}/api/orders/details/${safeId}`, { headers });
      if (updatedOrder.data.success) setTrackingOrderDetails(updatedOrder.data.order);
    } catch { /* ignore */ }
    fetchOrders();
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    const amount = Number.parseFloat(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount < 0.01) {
      toast.error("Please enter a valid payment amount (minimum 0.01)");
      return;
    }
    if (!paymentForm.proofFile) {
      toast.error("Please upload a payment proof screenshot");
      return;
    }
    const outstanding = trackingOrderDetails.outstandingBalance || 0;
    if (amount > outstanding + 0.01) {
      toast.error(`Amount cannot exceed outstanding balance of Rs ${outstanding.toFixed(2)}`);
      return;
    }

    pv.setPaymentSubmitting(true);
    let compressedBase64 = null;
    try {
      try {
        compressedBase64 = await compressImage(paymentForm.proofFile);
        if (!compressedBase64 || !compressedBase64.startsWith("data:image/")) throw new Error("Invalid image format");
      } catch { toast.error("Failed to process image. Please try a different image file."); pv.setPaymentSubmitting(false); return; }

      const payload = {
        amountPaid: Number.parseFloat(amount.toFixed(2)),
        address: trackingOrderDetails.deliveryAddress || {},
        proofBase64: compressedBase64,
        proofFileName: paymentForm.proofFile.name
      };
      const payId = toSafeMongoObjectId(trackingOrderDetails._id);
      if (!payId) {
        toast.error("Invalid order reference");
        pv.setPaymentSubmitting(false);
        return;
      }
      const response = await axios.post(`${url}/api/orders/payment/submit/${payId}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      if (response.data.success) {
        toast.success("Payment proof submitted successfully! Awaiting admin verification.");
        await refreshAfterPayment(trackingOrderDetails._id);
      } else {
        toast.error(response.data.message || "Failed to submit payment proof");
      }
    } catch (error) {
      console.error("Error submitting payment:", error);
      const errData = error.response?.data;
      const { requiresMFA } = pv.detectVerificationNeeded(errData);
      if (requiresMFA) {
        let base64ToUse = compressedBase64;
        if (!base64ToUse && paymentForm.proofFile) {
          try { base64ToUse = await compressImage(paymentForm.proofFile); }
          catch { toast.error('Failed to process image.'); pv.setPaymentSubmitting(false); return; }
        }
        pv.triggerVerification({
          orderId: trackingOrderDetails._id,
          amountPaid: Number.parseFloat(amount.toFixed(2)),
          address: trackingOrderDetails.deliveryAddress || {},
          proofBase64: base64ToUse,
          proofFileName: paymentForm.proofFile?.name
        });
        pv.setPaymentSubmitting(false);
        return;
      }
      toast.error(errData?.message || "Error submitting payment proof");
      pv.setPaymentSubmitting(false);
    }
  };

  const getStatusTimeline = (order) => {
    const timeline = [
      { status: "draft", label: "Pending", icon: <FiShoppingCart size={16}/> },
      { status: "confirmed", label: "Confirmed", icon: <FiCheck size={16}/> },
      { status: "dispatched", label: "Dispatched", icon: <FiTruck size={16}/> },
      { status: "delivered", label: "Delivered", icon: <FiCheckCircle size={16}/> },
    ];
    
    if (order.status === "cancelled") {
      timeline.push({ status: "cancelled", label: "Cancelled", icon: <FiX size={16}/> });
    }

    return timeline;
  };

  const isStepCompleted = (currentStatus, stepStatus) => {
    const statusOrder = ["draft", "confirmed", "dispatched", "delivered"];
    if (currentStatus === "cancelled") return false;

    const currentIndex = statusOrder.indexOf(currentStatus);
    const stepIndex = statusOrder.indexOf(stepStatus);

    return currentIndex >= stepIndex;
  };

  if (!token) {
    return (
      <div className="orders-page">
        <div className="orders-empty">
          <p>Please sign in to view your orders.</p>
        </div>
      </div>
    );
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };
  const totalItems = filteredOrders.length;
  const pageStart = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageEnd = pageStart + ITEMS_PER_PAGE;
  const paginatedOrders = filteredOrders.slice(pageStart, pageEnd);

  const refreshOrderDetails = async () => {
    if (!trackingOrderDetails || !trackingOrderDetails._id) return;
    const safeId = toSafeMongoObjectId(trackingOrderDetails._id);
    if (!safeId) return;
    try {
      const response = await axios.get(`${url}/api/orders/details/${safeId}`, { headers });
      if (response.data.success) {
        const updatedOrder = response.data.order;
        setTrackingOrderDetails(updatedOrder);
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order._id === updatedOrder._id ? updatedOrder : order
          )
        );
        toast.success("Order details refreshed");
      }
    } catch (err) {
      console.error("Error refreshing order details:", err);
      toast.error("Failed to refresh order details");
    }
  };

  return (
    <div className="orders-page">
      <div className="orders-header">
        <div>
          <h1>My Orders</h1>
          <p>Track your order status and view historical purchases.</p>
        </div>
        <button className="refresh-btn" onClick={handleRefresh} disabled={refreshing || loading}>
          <FiRefreshCw className={refreshing ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="orders-tabs">
        <button 
          className={`tab-btn ${activeTab === "all" ? "active" : ""}`} 
          onClick={() => setActiveTab("all")}
        >
          All Orders
        </button>
        {ORDER_STATUSES.map((status) => (
          <button
            key={status}
            className={`tab-btn ${activeTab === status ? "active" : ""}`}
            onClick={() => setActiveTab(status)}
          >
            {formatOrderStatus(status)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="orders-loading"><FiLoader className="spin" size={24} /><p>Loading your orders...</p></div>
      ) : error ? (
        <div className="orders-error">{error}</div>
      ) : filteredOrders.length === 0 ? (
        <div className="orders-empty"><p>No orders found in this category.</p></div>
      ) : (
        <>
        <div className="table-container">
          <table className="orders-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Order Number</th>
                <th>Date Placed</th>
                <th>Status</th>
                <th>Total</th>
                <th>Outstanding Balance</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.map((order, index) => (
                <tr key={order._id}>
                  <td>{pageStart + index + 1}</td>
                  <td><strong>{order.orderNumber}</strong></td>
                  <td>
                    {new Date(order.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric', month: 'short', day: 'numeric'
                    })}
                  </td>
                  <td>
                    <span className={`status-badge status-${order.status.toLowerCase()}`}>
                      {formatOrderStatus(order.status)}
                    </span>
                  </td>
                  <td>Rs {order.financials?.grandTotal?.toLocaleString()}</td>
                  <td>
                    <span className={`balance-badge ${(order.outstandingBalance ?? 0) > 0 ? "pending" : "paid"}`}>
                      Rs {((order.outstandingBalance ?? 0)).toLocaleString()}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      {order.status === "draft" && order.outstandingBalance > 0 && (
                        <button className="payment-btn" onClick={() => handleProceedToPayment(order)}>
                          <FiCreditCard /> Pay
                        </button>
                      )}
                      <button className="track-btn" onClick={() => openTrackingView(order.orderNumber)}>
                        <FiTruck /> Track
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} setCurrentPage={setCurrentPage} totalItems={totalItems} itemsPerPage={ITEMS_PER_PAGE} label="orders" />
        </>
      )}

      {trackingOrderNumber && trackingOrderDetails && (
        <dialog open className="modal-overlay" aria-modal="true" data-lenis-prevent="true">
          <button type="button" className="modal-backdrop" onClick={closeTrackingView} aria-label="Close" />
          <div className="tracking-modal" data-lenis-prevent="true">
            
            <div className="modal-header">
              <div>
                <h2>Order #{trackingOrderDetails.orderNumber}</h2>
                <span className={`status-badge status-${trackingOrderDetails.status}`}>
                  {formatOrderStatus(trackingOrderDetails.status)}
                </span>
              </div>
              <button className="close-btn" onClick={closeTrackingView}><FiX size={24} /></button>
            </div>

            <div className="modal-tabs">
              <button 
                className={`modal-tab-btn ${modalTab === "tracking" ? "active" : ""}`}
                onClick={() => setModalTab("tracking")}
              >
                Track Order
              </button>
              <button 
                className={`modal-tab-btn ${modalTab === "details" ? "active" : ""}`}
                onClick={() => setModalTab("details")}
              >
                Order Details
              </button>
              <button 
                className={`modal-tab-btn ${modalTab === "payment" ? "active" : ""}`}
                onClick={() => setModalTab("payment")}
              >
                Payment
              </button>
            </div>

            <div className="modal-body" data-lenis-prevent="true">
              {modalTab === "tracking" && (
                <>
                  <div className="timeline-section">
                    <h3>Order Timeline</h3>
                    <div className="timeline">
                      {getStatusTimeline(trackingOrderDetails).map((step, index) => {
                        const completed = isStepCompleted(trackingOrderDetails.status, step.status);
                        const current = trackingOrderDetails.status === step.status;
                        
                        return (
                          <div key={step.status} className="timeline-step">
                            <div className={`timeline-dot ${step.status} ${completed ? "completed" : ""} ${current ? "current" : ""}`}>
                              {step.icon}
                            </div>
                            <div className="timeline-content">
                              <h4>{step.label}</h4>
                              
                              {trackingOrderDetails.timeline && trackingOrderDetails.timeline.find(entry => entry.status === step.status) && (
                                <p className="status-notes">
                                  <strong>Notes:</strong> {trackingOrderDetails.timeline.find(entry => entry.status === step.status)?.notes || "N/A"}
                                </p>
                              )}
                              
                              {((step.status === "dispatched") && 
                               (trackingOrderDetails.status === "dispatched" || trackingOrderDetails.status === "delivered")) && 
                               trackingOrderDetails.courierTracking?.trackingNumber && (
                                <div className="tracking-info-box">
                                  <p><strong>Courier:</strong> {trackingOrderDetails.courierTracking.courierService}</p>
                                  <p><strong>Tracking #:</strong> {trackingOrderDetails.courierTracking.trackingNumber}</p>
                                  {trackingOrderDetails.courierTracking.courierLink && (
                                    <a href={trackingOrderDetails.courierTracking.courierLink} target="_blank" rel="noopener noreferrer" className="courier-link">
                                      <FiExternalLink /> Track Shipment
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="delivery-section">
                    <h3><FiMapPin /> Delivery Information</h3>
                    <div className="customer-info-grid">
                      <div className="customer-info-card">
                        <h4><FiBriefcase /> Company Details</h4>
                        <div className="info-row">
                          <span className="info-label">Company:</span>
                          <span className="info-value">{trackingOrderDetails.buyer?.companyName || "N/A"}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Email:</span>
                          <span className="info-value">{trackingOrderDetails.buyer?.email || "N/A"}</span>
                        </div>
                      </div>

                      <div className="customer-info-card">
                        <h4><FiMapPin /> Delivery Address</h4>
                        {trackingOrderDetails.deliveryAddress?.street ? (
                          <div className="address-details">
                            <div className="info-row">
                              <span className="info-label">Street:</span>
                              <span className="info-value">{trackingOrderDetails.deliveryAddress.street}</span>
                            </div>
                            <div className="info-row">
                              <span className="info-label">City:</span>
                              <span className="info-value">{trackingOrderDetails.deliveryAddress.city}</span>
                            </div>
                            <div className="info-row">
                              <span className="info-label">State:</span>
                              <span className="info-value">{trackingOrderDetails.deliveryAddress.state}</span>
                            </div>
                            <div className="info-row">
                              <span className="info-label">ZIP Code:</span>
                              <span className="info-value">{trackingOrderDetails.deliveryAddress.zipCode}</span>
                            </div>
                            <div className="info-row">
                              <span className="info-label">Country:</span>
                              <span className="info-value">{trackingOrderDetails.deliveryAddress.country}</span>
                            </div>
                            {trackingOrderDetails.deliveryAddress.phone && (
                              <div className="info-row">
                                <span className="info-label">Phone:</span>
                                <span className="info-value">{trackingOrderDetails.deliveryAddress.phone}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="no-address">No delivery address provided for this order.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {modalTab === "details" && (
                <>
                  <div className="details-section">
                    <h3><FiPackage /> Items ({trackingOrderDetails.items?.length || 0})</h3>
                    <div className="order-items-grid">
                      {trackingOrderDetails.items?.map((item, index) => (
                        <div key={item._id ?? `item-${trackingOrderDetails._id}-${index}`} className="order-item">
                          <img src={item.image} alt={item.stoneName} className="order-item-image" />
                          <div className="order-item-info">
                            <div className="order-item-name">{item.stoneName}</div>
                            <div className="order-item-specs">
                              <span>Qty: {item.quantity}</span>
                              <span>Unit: Rs {item.unitPrice?.toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="order-item-total">
                            Rs {(item.totalPrice || item.unitPrice * item.quantity).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="details-section">
                    <h3><FiCalendar /> Financials</h3>
                    <div className="summary-details">
                      <div className="summary-row">
                        <span>Subtotal:</span>
                        <span>Rs {trackingOrderDetails.financials?.subtotal?.toLocaleString()}</span>
                      </div>
                      {trackingOrderDetails.financials?.taxAmount > 0 && (
                        <div className="summary-row">
                          <span>Tax ({trackingOrderDetails.financials?.taxPercentage}%):</span>
                          <span>Rs {trackingOrderDetails.financials?.taxAmount?.toLocaleString()}</span>
                        </div>
                      )}
                      {trackingOrderDetails.financials?.shippingCost > 0 && (
                        <div className="summary-row">
                          <span>Shipping:</span>
                          <span>Rs {trackingOrderDetails.financials?.shippingCost?.toLocaleString()}</span>
                        </div>
                      )}
                      {trackingOrderDetails.financials?.discountAmount > 0 && (
                        <div className="summary-row discount">
                          <span>Discount:</span>
                          <span>- Rs {trackingOrderDetails.financials?.discountAmount?.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="summary-row total">
                        <span>Grand Total:</span>
                        <span>Rs {trackingOrderDetails.financials?.grandTotal?.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {modalTab === "payment" && (
                <>
                  <div className="payment-section">
                    <h3><FiCreditCard /> Payment Information</h3>
                    <div className="payment-details-grid">
                      <div className="payment-detail-card">
                        <span className="detail-label">Grand Total:</span>
                        <span className="detail-value">Rs {trackingOrderDetails.financials?.grandTotal?.toLocaleString()}</span>
                      </div>
                      <div className="payment-detail-card">
                        <span className="detail-label">Total Paid:</span>
                        <span className="detail-value highlight-green">Rs {(trackingOrderDetails.totalPaid || 0).toLocaleString()}</span>
                      </div>
                      <div className="payment-detail-card">
                        <span className="detail-label">Outstanding Balance:</span>
                        <span className={`detail-value ${(trackingOrderDetails.outstandingBalance ?? 0) > 0 ? "highlight-red" : "highlight-green"}`}>
                          Rs {(trackingOrderDetails.outstandingBalance || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {trackingOrderDetails.outstandingBalance > 0 && (
                      <div className="payment-form-section">
                        <h4>Submit Payment</h4>
                        <form onSubmit={handlePaymentSubmit}>
                          <div className="form-group">
                            <label htmlFor="payment-amount">Amount to Pay</label>
                            <input 
                              type="number" 
                              id="payment-amount"
                              placeholder={`Enter amount (max: Rs ${trackingOrderDetails.outstandingBalance?.toLocaleString()})`}
                              step="0.01"
                              max={trackingOrderDetails.outstandingBalance}
                              value={paymentForm.amount}
                              onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                              className="form-input"
                              disabled={pv.paymentSubmitting}
                            />
                          </div>
                          <div className="form-group">
                            <label htmlFor="payment-proof">Upload Payment Proof (Screenshot)</label>
                            <input 
                              type="file" 
                              id="payment-proof"
                              accept="image/*"
                              onChange={(e) => setPaymentForm({...paymentForm, proofFile: e.target.files[0]})}
                              className="form-input"
                              disabled={pv.paymentSubmitting}
                            />
                            <p className="help-text">Upload a screenshot of your bank transfer confirmation or payment receipt</p>
                          </div>
                          <button type="submit" className="btn-submit-payment" disabled={pv.paymentSubmitting}>
                            <FiCreditCard /> {pv.paymentSubmitting ? "Submitting..." : "Submit Payment Proof"}
                          </button>
                        </form>
                      </div>
                    )}

                    {trackingOrderDetails.paymentTimeline && trackingOrderDetails.paymentTimeline.length > 0 && (
                      <div className="payment-timeline-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <h4>Payment Timeline</h4>
                          <button 
                            className="refresh-btn-small" 
                            onClick={refreshOrderDetails}
                            title="Refresh payment timeline"
                          >
                            <FiRefreshCw />
                          </button>
                        </div>
                        <div className="payment-timeline">
                          {trackingOrderDetails.paymentTimeline.map((entry, idx) => (
                            <div key={`${entry.timestamp}-${entry.action ?? "payment"}-${idx}`} className="payment-timeline-entry">
                              <div className={`timeline-indicator ${entry.action}`} />
                              <div className="timeline-details">
                                <strong>{entry.action?.replaceAll('_', ' ').toUpperCase()}</strong>
                                <p className="timeline-date">{new Date(entry.timestamp).toLocaleDateString()}</p>
                                  {entry.amountPaid !== undefined && <p className="timeline-amount">Amount: Rs {entry.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>}
                                  <p className="timeline-notes">
                                    {entry.action === "payment_rejected" && entry.notes
                                      ? (entry.notes.includes("Reason:") ? (entry.notes.split("Reason:")[1]?.trim() ?? "N/A") : entry.notes)
                                      : (entry.notes ?? "N/A")}
                                  </p>
                                  {entry.action === "payment_rejected" && (() => {
                                    const rejectionReason = entry.notes?.includes("Reason:") ? (entry.notes.split("Reason:")[1]?.trim() ?? "N/A") : (entry.notes ?? "N/A");
                                    return (
                                      <div className="rejection-notice">
                                        <strong>Rejection Reason:</strong> {rejectionReason}
                                      </div>
                                    );
                                  })()}
                                  {entry.proofFile && (
                                    <button
                                      onClick={async () => {
                                        try {
                                          const raw = entry.proofFile && entry.proofFile.toString();
                                          const proofUrl =
                                            raw && raw.startsWith("http")
                                              ? raw
                                              : (() => {
                                                  const seg = safeImageFilenameSegment(raw);
                                                  return seg ? `${url}/images/${seg}` : null;
                                                })();
                                          if (!proofUrl) {
                                            toast.error("Invalid file reference");
                                            return;
                                          }
                                          const response = await fetch(proofUrl);
                                          const blob = await response.blob();
                                          const downloadUrl = globalThis.URL.createObjectURL(blob);
                                          const a = document.createElement("a");
                                          a.href = downloadUrl;
                                          a.download = `payment-invoice-${trackingOrderDetails.orderNumber}-${new Date(entry.timestamp).getTime()}.${blob.type.includes("png") ? "png" : "jpg"}`;
                                          document.body.appendChild(a);
                                          a.click();
                                          globalThis.URL.revokeObjectURL(downloadUrl);
                                          a.remove();
                                        } catch (error) {
                                          console.error('Error downloading invoice:', error);
                                          toast.error('Failed to download payment invoice');
                                        }
                                      }}
                                      className="btn-download-invoice"
                                    >
                                      <FiDownload /> Download Payment Invoice
                                    </button>
                                  )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </dialog>
      )}

      {pv.showMfaModal && (
        <MfaModal
          onSubmit={(e) => pv.handleMfaSubmit(e, () => refreshAfterPayment(pv.pendingPayment?.orderId))}
          onClose={pv.resetMfaState}
          isSubmitting={pv.paymentSubmitting}
          mfaPassword={pv.mfaPassword}
          setMfaPassword={pv.setMfaPassword}
          WrapperTag="dialog"
          wrapperProps={{ open: true, "data-lenis-prevent": "true", backdrop: <button type="button" className="modal-backdrop" onClick={pv.resetMfaState} aria-label="Close" />, contentProps: { "data-lenis-prevent": "true" }, bodyProps: { "data-lenis-prevent": "true" } }}
        />
      )}
    </div>
  );
};

export default Orders;
