
import React, { useContext, useEffect, useMemo, useState, useRef } from "react";
import "./Orders.css";
import axios from "axios";
import { toast } from "react-toastify";
import { StoreContext } from "../../context/StoreContext";
import { useNavigate } from "react-router-dom";
import ReCAPTCHA from "react-google-recaptcha";
import { 
  FiLoader, FiExternalLink, FiCreditCard, FiPackage, 
  FiMapPin, FiCalendar, FiTruck, FiX, FiCheck, FiShoppingCart, FiCheckCircle, FiDownload,
  FiBriefcase, FiLock, FiAlertTriangle, FiRefreshCw
} from "react-icons/fi";

const RECAPTCHA_SITE_KEY = "6LfIkB0sAAAAANTjmfzZnffj2xE1POMF-Tnl3jYC";

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
  const [modalTab, setModalTab] = useState("tracking"); // "tracking", "details", or "payment"
  
  // Payment Form State
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    proofFile: null
  });
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  
  // MFA Modal State
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [mfaPassword, setMfaPassword] = useState("");
  const [pendingPayment, setPendingPayment] = useState(null);
  
  // CAPTCHA Modal State
  const [showCaptchaModal, setShowCaptchaModal] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [captchaPassword, setCaptchaPassword] = useState("");
  const recaptchaRef = useRef(null);
  
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

    setPaymentSubmitting(true);
    
    // Compress and resize image before converting to base64
    const compressImage = (file, maxWidth = 1000, maxHeight = 1000, quality = 0.6) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;

              const aspectRatio = width / height;
              if (width > height) {
                if (width > maxWidth) {
                  width = maxWidth;
                  height = Math.round(width / aspectRatio);
                }
              } else {
                if (height > maxHeight) {
                  height = maxHeight;
                  width = Math.round(height * aspectRatio);
                }
              }

              canvas.width = width;
              canvas.height = height;

              const ctx = canvas.getContext('2d');
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'medium';
              ctx.drawImage(img, 0, 0, width, height);

              canvas.toBlob(
                (blob) => {
                  if (!blob) {
                    reject(new Error('Failed to create blob from canvas'));
                    return;
                  }
                  
                  if (blob.size > 3 * 1024 * 1024) {
                    const img2 = new Image();
                    img2.onload = () => {
                      const canvas2 = document.createElement('canvas');
                      canvas2.width = Math.round(width * 0.8);
                      canvas2.height = Math.round(height * 0.8);
                      const ctx2 = canvas2.getContext('2d');
                      ctx2.drawImage(img2, 0, 0, canvas2.width, canvas2.height);
                      canvas2.toBlob(
                        (blob2) => {
                          const reader2 = new FileReader();
                          reader2.onload = () => {
                            const dataUrl = reader2.result;
                            if (dataUrl && dataUrl.startsWith('data:image/')) {
                              resolve(dataUrl);
                            } else {
                              reject(new Error('Invalid data URL format'));
                            }
                          };
                          reader2.onerror = reject;
                          reader2.readAsDataURL(blob2);
                        },
                        'image/jpeg',
                        0.5
                      );
                    };
                    img2.src = e.target.result;
                    return;
                  }
                  
                  const reader = new FileReader();
                  reader.onload = () => {
                    const dataUrl = reader.result;
                    if (dataUrl && dataUrl.startsWith('data:image/')) {
                      resolve(dataUrl);
                    } else {
                      reject(new Error('Invalid data URL format'));
                    }
                  };
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                },
                'image/jpeg',
                quality
              );
            };
            img.onerror = (error) => {
              console.error('Image load error:', error);
              reject(new Error('Failed to load image'));
            };
            img.src = e.target.result;
          };
          reader.onerror = (error) => {
            console.error('FileReader error:', error);
            reject(new Error('Failed to read file'));
          };
          reader.readAsDataURL(file);
        });
      };

    let compressedBase64 = null;
    try {
      try {
        compressedBase64 = await compressImage(paymentForm.proofFile);
        if (!compressedBase64 || !compressedBase64.startsWith('data:image/')) {
          throw new Error('Invalid image format after compression');
        }
      } catch (compressionError) {
        console.error('Image compression error:', compressionError);
        toast.error('Failed to process image. Please try a different image file.');
        setPaymentSubmitting(false);
        return;
      }
      
      const payload = {
        amountPaid: Number.parseFloat(amount.toFixed(2)),
        address: trackingOrderDetails.deliveryAddress || {},
        proofBase64: compressedBase64,
        proofFileName: paymentForm.proofFile.name
      };

      const response = await axios.post(
        `${url}/api/orders/payment/submit/${trackingOrderDetails._id}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        toast.success("Payment proof submitted successfully! Awaiting admin verification.");
        setPaymentForm({ amount: "", proofFile: null });
        const updatedOrder = await axios.get(
          `${url}/api/orders/details/${trackingOrderDetails._id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (updatedOrder.data.success) {
          setTrackingOrderDetails(updatedOrder.data.order);
        }
        fetchOrders();
      } else {
        toast.error(response.data.message || "Failed to submit payment proof");
      }
    } catch (error) {
      console.error("Error submitting payment:", error);
      console.log("Error response data:", error.response?.data);
      console.log("Error status:", error.response?.status);
      
      // Check if CAPTCHA is required - check both flag and message
      const requiresCaptcha = error.response?.data?.requiresCaptcha === true || 
                              (error.response?.data?.message && error.response.data.message.toLowerCase().includes('captcha'));
      
      if (requiresCaptcha) {
        console.log("CAPTCHA required - showing modal", { 
          requiresCaptchaFlag: error.response?.data?.requiresCaptcha,
          message: error.response?.data?.message 
        });
        
        // Use already-compressed base64 if available, otherwise compress again
        let base64ToUse = compressedBase64;
        if (!base64ToUse && paymentForm.proofFile) {
          try {
            base64ToUse = await compressImage(paymentForm.proofFile);
          } catch (compressionError) {
            console.error('Error compressing image for CAPTCHA:', compressionError);
            toast.error('Failed to process image. Please try again.');
            setPaymentSubmitting(false);
            return;
          }
        }
        
        const pendingData = {
          orderId: trackingOrderDetails._id,
          amountPaid: Number.parseFloat(amount.toFixed(2)),
          address: trackingOrderDetails.deliveryAddress || {},
          proofBase64: base64ToUse,
          proofFileName: paymentForm.proofFile?.name
        };
        
        console.log("Setting pending payment data:", pendingData);
        setPendingPayment(pendingData);
        
        console.log("Setting showCaptchaModal to true");
        setShowCaptchaModal(true);
        setPaymentSubmitting(false);
        return;
      }
      
      // Check if MFA is required - check both flag and message
      const requiresMFA = error.response?.data?.requiresMFA === true || 
                         error.response?.data?.requiresReauth === true ||
                         (error.response?.data?.message && (
                           error.response.data.message.toLowerCase().includes('re-authentication') ||
                           error.response.data.message.toLowerCase().includes('password') ||
                           error.response.data.message.toLowerCase().includes('confirm this action')
                         ));
      
      if (requiresMFA) {
        console.log("MFA required - showing modal", { 
          requiresMFAFlag: error.response?.data?.requiresMFA,
          requiresReauthFlag: error.response?.data?.requiresReauth,
          message: error.response?.data?.message 
        });
        
        // Use already-compressed base64 if available, otherwise compress again
        let base64ToUse = compressedBase64;
        if (!base64ToUse && paymentForm.proofFile) {
          try {
            base64ToUse = await compressImage(paymentForm.proofFile);
          } catch (compressionError) {
            console.error('Error compressing image for MFA:', compressionError);
            toast.error('Failed to process image. Please try again.');
            setPaymentSubmitting(false);
            return;
          }
        }
        
        const pendingData = {
          orderId: trackingOrderDetails._id,
          amountPaid: Number.parseFloat(amount.toFixed(2)),
          address: trackingOrderDetails.deliveryAddress || {},
          proofBase64: base64ToUse,
          proofFileName: paymentForm.proofFile?.name
        };
        
        console.log("Setting pending payment data:", pendingData);
        setPendingPayment(pendingData);
        
        console.log("Setting showMfaModal to true");
        setShowMfaModal(true);
        setPaymentSubmitting(false);
        return;
      }
      
      // Only show toast if neither CAPTCHA nor MFA is required
      if (!requiresCaptcha && !requiresMFA) {
        toast.error(error.response?.data?.message || "Error submitting payment proof");
      }
      setPaymentSubmitting(false);
    }
  };

  const handleCaptchaChange = (token) => {
    setCaptchaToken(token);
  };

  const handleCaptchaExpired = () => {
    setCaptchaToken(null);
  };

  const handleCaptchaSubmit = async (e) => {
    e.preventDefault();
    if (!captchaToken) {
      toast.error("Please complete the CAPTCHA verification.");
      return;
    }
    if (!captchaPassword.trim()) {
      toast.error("Please enter your password to confirm this payment submission.");
      return;
    }

    if (!pendingPayment) {
      toast.error("Error: Payment data not found. Please try again.");
      setShowCaptchaModal(false);
      setCaptchaToken(null);
      setCaptchaPassword("");
      recaptchaRef.current?.reset();
      setPendingPayment(null);
      return;
    }

    setPaymentSubmitting(true);

    try {
      const payload = {
        ...pendingPayment,
        captchaToken: captchaToken,
        passwordConfirmation: captchaPassword
      };

      const response = await axios.post(
        `${url}/api/orders/payment/submit/${pendingPayment.orderId}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        toast.success("Payment proof submitted successfully! Awaiting admin verification.");
        setPaymentForm({ amount: "", proofFile: null });
        setShowCaptchaModal(false);
        setCaptchaToken(null);
        setCaptchaPassword("");
        recaptchaRef.current?.reset();
        setPendingPayment(null);
        
        const updatedOrder = await axios.get(
          `${url}/api/orders/details/${pendingPayment.orderId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (updatedOrder.data.success) {
          setTrackingOrderDetails(updatedOrder.data.order);
        }
        fetchOrders();
      } else {
        toast.error(response.data.message || "Failed to submit payment proof");
        recaptchaRef.current?.reset();
        setCaptchaToken(null);
      }
    } catch (error) {
      console.error("Error submitting payment with CAPTCHA:", error);
      
      if (error.response?.data?.requiresCaptcha === true) {
        toast.error("CAPTCHA verification failed. Please try again.");
        recaptchaRef.current?.reset();
        setCaptchaToken(null);
      } else if (error.response?.data?.requiresMFA === true || error.response?.status === 401) {
        toast.error("Invalid password. Please check your password and try again.");
        setCaptchaPassword("");
      } else {
        toast.error(error.response?.data?.message || "Error submitting payment proof");
        recaptchaRef.current?.reset();
        setCaptchaToken(null);
      }
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    if (!mfaPassword.trim()) {
      toast.error("Please enter your password to confirm this payment submission.");
      return;
    }

    if (!pendingPayment) {
      toast.error("Error: Payment data not found. Please try again.");
      setShowMfaModal(false);
      setMfaPassword("");
      setPendingPayment(null);
      return;
    }

    setPaymentSubmitting(true);

    try {
      const payload = {
        ...pendingPayment,
        passwordConfirmation: mfaPassword
      };

      const response = await axios.post(
        `${url}/api/orders/payment/submit/${pendingPayment.orderId}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        toast.success("Payment proof submitted successfully! Awaiting admin verification.");
        setPaymentForm({ amount: "", proofFile: null });
        setShowMfaModal(false);
        setMfaPassword("");
        setPendingPayment(null);
        
        const updatedOrder = await axios.get(
          `${url}/api/orders/details/${pendingPayment.orderId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (updatedOrder.data.success) {
          setTrackingOrderDetails(updatedOrder.data.order);
        }
        fetchOrders();
      } else {
        toast.error(response.data.message || "Failed to submit payment proof");
      }
    } catch (error) {
      console.error("Error submitting payment with MFA:", error);
      
      if (error.response?.data?.requiresMFA === true || error.response?.status === 401) {
        toast.error("Invalid password. Please check your password and try again.");
        setMfaPassword("");
      } else {
        toast.error(error.response?.data?.message || "Error submitting payment proof");
      }
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const getStatusTimeline = (order) => {
    const timeline = [
      { status: "draft", label: "Draft", icon: <FiShoppingCart size={16}/> },
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

  // Format address for display
  const formatAddress = (deliveryAddress, buyer) => {
    if (!deliveryAddress || !deliveryAddress.street) {
      return null;
    }

    const parts = [];
    parts.push(buyer?.companyName || "Customer");
    
    if (deliveryAddress.street) parts.push(deliveryAddress.street);
    if (deliveryAddress.city) parts.push(deliveryAddress.city);
    if (deliveryAddress.state) parts.push(deliveryAddress.state);
    if (deliveryAddress.zipCode) parts.push(deliveryAddress.zipCode);
    if (deliveryAddress.country) parts.push(deliveryAddress.country);
    if (deliveryAddress.phone) parts.push(`Phone: ${deliveryAddress.phone}`);

    return parts.join(", ");
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

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  const refreshOrderDetails = async () => {
    if (!trackingOrderDetails || !trackingOrderDetails._id) return;
    try {
      const response = await axios.get(`${url}/api/orders/details/${trackingOrderDetails._id}`, { headers });
      if (response.data.success) {
        const updatedOrder = response.data.order;
        setTrackingOrderDetails(updatedOrder);
        // Also update in orders list
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
                <th>Outstanding Balance</th>
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
                    <span className={`balance-badge ${order.outstandingBalance > 0 ? 'pending' : 'paid'}`}>
                      Rs {(order.outstandingBalance || 0).toLocaleString()}
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
      )}

      {/* SINGLE MODAL WITH TABS */}
      {trackingOrderNumber && trackingOrderDetails && (
        <div 
          className="modal-overlay" 
          role="dialog"
          aria-modal="true"
        >
          <div className="tracking-modal" role="document">
            
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
              <button 
                className={`modal-tab-btn ${modalTab === "payment" ? "active" : ""}`}
                onClick={() => setModalTab("payment")}
              >
                Payment
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
                      {/* Company/Buyer Info */}
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

                      {/* Delivery Address */}
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

              {/* TAB 3: PAYMENT VIEW */}
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
                        <span className={`detail-value ${trackingOrderDetails.outstandingBalance > 0 ? 'highlight-red' : 'highlight-green'}`}>
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
                              disabled={paymentSubmitting}
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
                              disabled={paymentSubmitting}
                            />
                            <p className="help-text">Upload a screenshot of your bank transfer confirmation or payment receipt</p>
                          </div>
                          <button type="submit" className="btn-submit-payment" disabled={paymentSubmitting}>
                            <FiCreditCard /> {paymentSubmitting ? "Submitting..." : "Submit Payment Proof"}
                          </button>
                        </form>
                      </div>
                    )}

                    {/* Payment Proofs List */}
                   

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
                            <div key={idx} className="payment-timeline-entry">
                              <div className={`timeline-indicator ${entry.action}`} />
                              <div className="timeline-details">
                                <strong>{entry.action?.replaceAll('_', ' ').toUpperCase()}</strong>
                                <p className="timeline-date">{new Date(entry.timestamp).toLocaleDateString()}</p>
                                  {entry.amountPaid !== undefined && <p className="timeline-amount">Amount: Rs {entry.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>}
                                  <p className="timeline-notes">
                                    {entry.action === 'payment_rejected' && entry.notes 
                                      ? (entry.notes.includes('Reason:') 
                                          ? entry.notes.split('Reason:')[1]?.trim() || 'N/A'
                                          : entry.notes)
                                      : (entry.notes || 'N/A')}
                                  </p>
                                  {entry.action === 'payment_rejected' && (
                                    <div className="rejection-notice">
                                      <strong>Rejection Reason:</strong> {
                                        entry.notes && entry.notes.includes('Reason:')
                                          ? entry.notes.split('Reason:')[1]?.trim() || 'N/A'
                                          : (entry.notes || 'N/A')
                                      }
                                    </div>
                                  )}
                                  {entry.proofFile && (
                                    <button
                                      onClick={async () => {
                                        try {
                                          const proofUrl = (entry.proofFile && entry.proofFile.toString().startsWith('http')) ? entry.proofFile : `${url}/images/${entry.proofFile}`;
                                          const response = await fetch(proofUrl);
                                          const blob = await response.blob();
                                          const downloadUrl = window.URL.createObjectURL(blob);
                                          const a = document.createElement('a');
                                          a.href = downloadUrl;
                                          a.download = `payment-invoice-${trackingOrderDetails.orderNumber}-${new Date(entry.timestamp).getTime()}.${blob.type.includes('png') ? 'png' : 'jpg'}`;
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
        </div>
      )}

      {/* CAPTCHA Modal */}
      {showCaptchaModal && (
        <div 
          className="modal-overlay" 
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-content" role="document">
            <div className="modal-header">
              <h3>
                <FiLock style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                CAPTCHA Verification Required
              </h3>
              <button onClick={() => {
                setShowCaptchaModal(false);
                setCaptchaToken(null);
                setCaptchaPassword("");
                recaptchaRef.current?.reset();
                setPendingPayment(null);
              }}>
                <FiX />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#e74c3c', marginBottom: '20px' }}>
                <FiAlertTriangle style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                For security purposes, please complete the CAPTCHA verification and enter your password to submit this payment.
              </p>
              <form onSubmit={handleCaptchaSubmit}>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <span style={{ marginBottom: '10px', display: 'block' }}>CAPTCHA Verification:</span>
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                    <ReCAPTCHA
                      ref={recaptchaRef}
                      sitekey={RECAPTCHA_SITE_KEY}
                      onChange={handleCaptchaChange}
                      onExpired={handleCaptchaExpired}
                      theme="light"
                    />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label htmlFor="captcha-password">Enter Your Password:</label>
                  <input
                    id="captcha-password"
                    type="password"
                    value={captchaPassword}
                    onChange={(e) => setCaptchaPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoFocus
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      marginTop: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button 
                    type="button"
                    className="btn-secondary" 
                    onClick={() => {
                      setShowCaptchaModal(false);
                      setCaptchaToken(null);
                      setCaptchaPassword("");
                      recaptchaRef.current?.reset();
                      setPendingPayment(null);
                    }}
                    disabled={paymentSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={paymentSubmitting || !captchaToken || !captchaPassword.trim()}
                    style={{ backgroundColor: '#2d8659' }}
                  >
                    {paymentSubmitting ? "Submitting..." : "Confirm & Submit Payment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showMfaModal && (
        <div 
          className="modal-overlay" 
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-content" role="document">
            <div className="modal-header">
              <h3>
                <FiLock />
                Multi-Factor Authentication Required
              </h3>
              <button 
                onClick={() => {
                  setShowMfaModal(false);
                  setMfaPassword("");
                  setPendingPayment(null);
                }}
                aria-label="Close modal"
              >
                <FiX />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#e74c3c', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiAlertTriangle />
                For security purposes, please confirm your password to submit this payment.
              </p>
              <form onSubmit={handleMfaSubmit}>
                <div className="form-group">
                  <label htmlFor="mfa-password">Enter Your Password:</label>
                  <input
                    id="mfa-password"
                    type="password"
                    value={mfaPassword}
                    onChange={(e) => setMfaPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoFocus
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      marginTop: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div className="modal-footer">
                  <button 
                    type="button"
                    className="btn-secondary" 
                    onClick={() => {
                      setShowMfaModal(false);
                      setMfaPassword("");
                      setPendingPayment(null);
                    }}
                    disabled={paymentSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={paymentSubmitting || !mfaPassword.trim()}
                  >
                    {paymentSubmitting ? "Submitting..." : "Confirm & Submit Payment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
