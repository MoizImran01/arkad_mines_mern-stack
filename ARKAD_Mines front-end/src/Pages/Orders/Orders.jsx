import React, { useContext, useEffect, useMemo, useState } from "react";
import "./Orders.css";
import axios from "axios";
import { StoreContext } from "../../context/StoreContext";
import { useNavigate } from "react-router-dom";
import { 
  FiLoader, FiExternalLink, FiCreditCard, FiPackage, 
  FiMapPin, FiCalendar, FiTruck, FiX, FiCheck, FiShoppingCart, FiCheckCircle 
} from "react-icons/fi";

const Orders = () => {
  const { token, url, replaceQuoteItems, setActiveQuoteId } = useContext(StoreContext);
  
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal State
  const [trackingOrderNumber, setTrackingOrderNumber] = useState(null);
  const [trackingOrderDetails, setTrackingOrderDetails] = useState(null);
  const [modalTab, setModalTab] = useState("tracking"); // "tracking" or "details"
  
  const navigate = useNavigate();


  const ORDER_STATUSES = ["draft", "confirmed", "dispatched", "delivered", "cancelled"];

  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
  }), [token]);

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

  useEffect(() => {
    fetchOrders();

  }, [token]);

  useEffect(() => {
    if (activeTab === "all") {
      setFilteredOrders(orders);
    } else {
      setFilteredOrders(orders.filter((order) => order.status === activeTab));
    }
  }, [activeTab, orders]);

  const openTrackingView = (orderNumber) => {
    const order = orders.find(o => o.orderNumber === orderNumber);
    setTrackingOrderDetails(order);
    setTrackingOrderNumber(orderNumber);
    setModalTab("tracking"); // Default to tracking view
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

  const getStatusTimeline = (order) => {
    const timeline = [
      { status: "draft", label: "Draft", icon: <FiShoppingCart size={16}/> },
      { status: "confirmed", label: "Confirmed", icon: <FiCheck size={16}/> },
      { status: "dispatched", label: "Dispatched", icon: <FiTruck size={16}/> },
      { status: "delivered", label: "Delivered", icon: <FiCheckCircle size={16}/> },
    ];
    
    // Add Cancelled state only if the order is actually cancelled
    if (order.status === "cancelled") {
      timeline.push({ status: "cancelled", label: "Cancelled", icon: <FiX size={16}/> });
    }

    return timeline;
  };

  // Helper to determine if a timeline step is completed
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

  return (
    <div className="orders-page">
      <div className="orders-header">
        <h1>My Orders</h1>
        <p>Track your order status and view historical purchases.</p>
      </div>

      {/* Main Page Tabs */}
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
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="orders-loading"><FiLoader className="spin" size={24} /><p>Loading your orders...</p></div>
      ) : error ? (
        <div className="orders-error">{error}</div>
      ) : filteredOrders.length === 0 ? (
        <div className="orders-empty"><p>No orders found in this category.</p></div>
      ) : (
        <div className="table-container">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Order Number</th>
                <th>Date Placed</th>
                <th>Status</th>
                <th>Total</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order._id}>
                  <td><strong>{order.orderNumber}</strong></td>
                  <td>
                    {new Date(order.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric', month: 'short', day: 'numeric'
                    })}
                  </td>
                  <td>
                    <span className={`status-badge status-${order.status.toLowerCase()}`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </td>
                  <td>Rs {order.financials?.grandTotal?.toLocaleString()}</td>
                  <td>
                    <div className="action-buttons">
                      {order.status === "draft" && (
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
      )}

      {/* SINGLE MODAL WITH TABS */}
      {trackingOrderNumber && trackingOrderDetails && (
        <div className="modal-overlay" onClick={closeTrackingView}>
          <div className="tracking-modal" onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="modal-header">
              <div>
                <h2>Order #{trackingOrderDetails.orderNumber}</h2>
                <span className={`status-badge status-${trackingOrderDetails.status}`}>
                  {trackingOrderDetails.status.toUpperCase()}
                </span>
              </div>
              <button className="close-btn" onClick={closeTrackingView}><FiX size={24} /></button>
            </div>

            {/* Modal Internal Tabs */}
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
            </div>

            <div className="modal-body">
              {/* TAB 1: TRACKING VIEW */}
              {modalTab === "tracking" && (
                <>
                  <div className="timeline-section">
                    <h3>Order Timeline</h3>
                    <div className="timeline">
                      {getStatusTimeline(trackingOrderDetails).map((step, index) => {
                        // Logic to show active/completed state
                        const completed = isStepCompleted(trackingOrderDetails.status, step.status);
                        const current = trackingOrderDetails.status === step.status;
                        
                        return (
                          <div key={step.status} className="timeline-step">
                            <div className={`timeline-dot ${step.status} ${completed ? "completed" : ""} ${current ? "current" : ""}`}>
                              {step.icon}
                            </div>
                            <div className="timeline-content">
                              <h4>{step.label}</h4>
                              
                              {/* Status Change Notes */}
                              {trackingOrderDetails.timeline && trackingOrderDetails.timeline.find(entry => entry.status === step.status) && (
                                <p className="status-notes">
                                  <strong>Notes:</strong> {trackingOrderDetails.timeline.find(entry => entry.status === step.status)?.notes || "N/A"}
                                </p>
                              )}
                              
                              {/* Courier Info appears only under 'Dispatched'*/}
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
                    <h3><FiMapPin /> Delivery Address</h3>
                    {trackingOrderDetails.deliveryAddress?.firstName ? (
                      <div className="delivery-info">
                        <p>
                          {trackingOrderDetails.deliveryAddress.firstName} {trackingOrderDetails.deliveryAddress.lastName}<br />
                          {trackingOrderDetails.deliveryAddress.street}<br />
                          {trackingOrderDetails.deliveryAddress.city}, {trackingOrderDetails.deliveryAddress.country}
                        </p>
                      </div>
                    ) : (
                      <p className="no-address">No delivery address provided.</p>
                    )}
                  </div>
                </>
              )}

              {/* TAB 2: DETAILS VIEW */}
              {modalTab === "details" && (
                <>
                  <div className="details-section">
                    <h3><FiPackage /> Items ({trackingOrderDetails.items?.length || 0})</h3>
                    <div className="order-items-grid">
                      {trackingOrderDetails.items?.map((item, index) => (
                        <div key={index} className="order-item">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;