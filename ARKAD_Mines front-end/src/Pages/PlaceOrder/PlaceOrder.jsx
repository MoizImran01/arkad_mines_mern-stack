import React, { useContext, useEffect, useState, useRef } from 'react';
import { StoreContext } from '../../context/StoreContext';
import './PlaceOrder.css';
import axios from "axios";
import { useNavigate, useParams } from 'react-router-dom';
import ReCAPTCHA from "react-google-recaptcha";
import { FiPackage, FiCreditCard, FiMapPin, FiShoppingBag, FiEdit2, FiArrowLeft, FiLock, FiX, FiAlertTriangle } from "react-icons/fi";

const RECAPTCHA_SITE_KEY = "6LfIkB0sAAAAANTjmfzZnffj2xE1POMF-Tnl3jYC";

const PlaceOrder = () => {
  const { orderNumber } = useParams();
  const navigate = useNavigate();
  const { token, url } = useContext(StoreContext);

  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('information');
  const [userData, setUserData] = useState(null);
  const [addressData, setAddressData] = useState({
    street: "",
    city: "", 
    state: "", 
    zipCode: "", 
    country: "Pakistan", 
    phone: "",
  });

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const response = await axios.get(`${url}/api/orders/status/${orderNumber}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data.success) {
          setOrderData(response.data.order);
          const ord = response.data.order;
          // Extract user data from the order's buyer information
          if (ord.buyer) {
            setUserData({
              businessName: ord.buyer.companyName || 'N/A',
              email: ord.buyer.email || 'N/A'
            });
          }

          // Check if order has any payment proofs (at least one payment exists)
          const hasPaymentProofs = ord.paymentProofs && ord.paymentProofs.length > 0;
          
          // If order already has a delivery address, pre-fill it so user doesn't re-enter
          if (ord.deliveryAddress) {
            setAddressData({
              street: ord.deliveryAddress.street || '',
              city: ord.deliveryAddress.city || '',
              state: ord.deliveryAddress.state || '',
              zipCode: ord.deliveryAddress.zipCode || '',
              country: ord.deliveryAddress.country || 'Pakistan',
              phone: ord.deliveryAddress.phone || ''
            });

            // Only redirect to payment if payment proofs exist AND there's outstanding balance
            // If no payment exists yet, user must fill shipping information first
            if (hasPaymentProofs && (ord.outstandingBalance || ord.financials?.grandTotal) > 0) {
              setActiveTab('summary');
              // Auto-open payment modal after a brief delay to ensure UI is ready
              setTimeout(() => {
                setShowPaymentModal(true);
              }, 100);
            }
            // If no payment exists, stay on information tab (default)
          } else {
            // No delivery address - user must fill it first
            // Only redirect to payment if payment proofs exist AND there's outstanding balance
            if (hasPaymentProofs && (ord.outstandingBalance || ord.financials?.grandTotal) > 0) {
              setActiveTab('summary');
              setTimeout(() => {
                setShowPaymentModal(true);
              }, 100);
            }
            // Otherwise stay on information tab (default)
          }
        } else {
          alert("Order not found");
          navigate("/quotations");
        }
      } catch (err) {
        console.error("Error fetching order:", err);
        navigate("/quotations");
      } finally {
        setLoading(false);
      }
    };

    if (token && orderNumber) fetchOrderDetails();
  }, [token, orderNumber, url, navigate]);

  const onChangeHandler = (event) => {
    const { name, value } = event.target;
    setAddressData(data => ({ ...data, [name]: value }));
  };

  const handlePlaceOrder = async (event) => {
    // Open payment modal instead of posting to a non-existent endpoint
    event.preventDefault();
    setShowPaymentModal(true);
  };

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  
  // CAPTCHA Modal State
  const [showCaptchaModal, setShowCaptchaModal] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [captchaPassword, setCaptchaPassword] = useState("");
  const recaptchaRef = useRef(null);
  
  // MFA Modal State
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [mfaPassword, setMfaPassword] = useState("");
  const [pendingPayment, setPendingPayment] = useState(null);

  const submitPaymentProof = async (e) => {
    e.preventDefault();
    // Parse amount with proper decimal handling
    const numericAmount = Number.parseFloat(paymentAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount < 0.01) {
      alert('Please enter a valid payment amount (minimum 0.01)');
      return;
    }
    if (!paymentProofFile) {
      alert('Please upload a payment proof screenshot');
      return;
    }

    // Ensure amount does not exceed outstanding balance (with small tolerance for floating point)
    const outstanding = orderData?.outstandingBalance ?? orderData?.financials?.grandTotal;
    if (numericAmount > outstanding + 0.01) { // Small tolerance for floating point precision
      alert(`Amount cannot exceed outstanding balance of Rs ${outstanding.toFixed(2)}`);
      return;
    }

    setPaymentSubmitting(true);
    let base64 = null;
    
    try {
      // Compress and resize image before converting to base64
      // Aggressive compression to keep payload under 5MB
      const compressImage = (file, maxWidth = 1000, maxHeight = 1000, quality = 0.6) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;

              // Calculate new dimensions - more aggressive resizing
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
              // Use better image rendering
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'medium'; // Changed from 'high' to reduce processing
              ctx.drawImage(img, 0, 0, width, height);

              // Convert to base64 with compression - ensure JPEG format
              // Use lower quality for smaller file size
              canvas.toBlob(
                (blob) => {
                  if (!blob) {
                    reject(new Error('Failed to create blob from canvas'));
                    return;
                  }
                  
                  // Check if blob is still too large (> 3MB), compress more
                  if (blob.size > 3 * 1024 * 1024) {
                    // Re-compress with even lower quality
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
                        0.5 // Even lower quality
                      );
                    };
                    img2.src = e.target.result;
                    return;
                  }
                  
                  const reader = new FileReader();
                  reader.onload = () => {
                    // Ensure we return a valid data URI
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

      try {
        base64 = await compressImage(paymentProofFile);
        // Validate base64 format
        if (!base64 || !base64.startsWith('data:image/')) {
          throw new Error('Invalid image format after compression');
        }
      } catch (compressionError) {
        console.error('Image compression error:', compressionError);
        alert('Failed to process image. Please try a different image file.');
        setPaymentSubmitting(false);
        return;
      }

      const payload = {
        amountPaid: Number.parseFloat(numericAmount.toFixed(2)), // Ensure proper decimal precision
        address: addressData,
        proofBase64: base64,
        proofFileName: paymentProofFile.name
      };

      const response = await axios.post(
        `${url}/api/orders/payment/submit/${orderData._id}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        alert('Payment proof submitted successfully. Awaiting admin verification.');
        setShowPaymentModal(false);
        // Optionally refresh or redirect to orders
        navigate('/orders');
      } else {
        alert(response.data.message || 'Failed to submit payment proof');
      }
    } catch (err) {
      console.error('Error submitting payment proof:', err);
      console.log("Error response data:", err.response?.data);
      console.log("Error status:", err.response?.status);
      
      // Check if CAPTCHA is required - check both flag and message
      const requiresCaptcha = err.response?.data?.requiresCaptcha === true || 
                              (err.response?.data?.message && err.response.data.message.toLowerCase().includes('captcha'));
      
      if (requiresCaptcha) {
        console.log("CAPTCHA required - showing modal");
        
        // Close payment modal first
        setShowPaymentModal(false);
        
        // If base64 is not available, try to compress again
        if (!base64 && paymentProofFile) {
          try {
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
                          reject(new Error('Failed to create blob'));
                          return;
                        }
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
                        reader2.readAsDataURL(blob);
                      },
                      'image/jpeg',
                      quality
                    );
                  };
                  img.onerror = reject;
                  img.src = e.target.result;
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });
            };
            base64 = await compressImage(paymentProofFile);
          } catch (compressionError) {
            console.error('Error compressing image for CAPTCHA:', compressionError);
            alert('Failed to process image. Please try again.');
            setPaymentSubmitting(false);
            return;
          }
        }
        
        // Store payment data for retry
        const pendingData = {
          orderId: orderData._id,
          amountPaid: Number.parseFloat(numericAmount.toFixed(2)),
          address: addressData,
          proofBase64: base64,
          proofFileName: paymentProofFile.name
        };
        
        setPendingPayment(pendingData);
        setShowCaptchaModal(true);
        setPaymentSubmitting(false);
        return;
      }
      
      // Check if MFA is required - check both flag and message
      const requiresMFA = err.response?.data?.requiresMFA === true || 
                         err.response?.data?.requiresReauth === true ||
                         (err.response?.data?.message && (
                           err.response.data.message.toLowerCase().includes('re-authentication') ||
                           err.response.data.message.toLowerCase().includes('password') ||
                           err.response.data.message.toLowerCase().includes('confirm this action')
                         ));
      
      if (requiresMFA) {
        console.log("MFA required - showing modal");
        
        // Close payment modal first
        setShowPaymentModal(false);
        
        // If base64 is not available, try to compress again
        if (!base64 && paymentProofFile) {
          try {
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
                          reject(new Error('Failed to create blob'));
                          return;
                        }
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
                        reader2.readAsDataURL(blob);
                      },
                      'image/jpeg',
                      quality
                    );
                  };
                  img.onerror = reject;
                  img.src = e.target.result;
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });
            };
            base64 = await compressImage(paymentProofFile);
          } catch (compressionError) {
            console.error('Error compressing image for MFA:', compressionError);
            alert('Failed to process image. Please try again.');
            setPaymentSubmitting(false);
            return;
          }
        }
        
        // Store payment data for retry
        const pendingData = {
          orderId: orderData._id,
          amountPaid: Number.parseFloat(numericAmount.toFixed(2)),
          address: addressData,
          proofBase64: base64,
          proofFileName: paymentProofFile.name
        };
        
        setPendingPayment(pendingData);
        setShowMfaModal(true);
        setPaymentSubmitting(false);
        return;
      }
      
      // Only show alert if neither CAPTCHA nor MFA is required
      if (!requiresCaptcha && !requiresMFA) {
        alert(err.response?.data?.message || 'Error submitting payment proof');
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
      alert("Please complete the CAPTCHA verification.");
      return;
    }
    if (!captchaPassword.trim()) {
      alert("Please enter your password to confirm this payment submission.");
      return;
    }

    if (!pendingPayment) {
      alert("Error: Payment data not found. Please try again.");
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
        alert('Payment proof submitted successfully. Awaiting admin verification.');
        setShowCaptchaModal(false);
        setCaptchaToken(null);
        setCaptchaPassword("");
        recaptchaRef.current?.reset();
        setPendingPayment(null);
        setShowPaymentModal(false);
        navigate('/orders');
      } else {
        alert(response.data.message || "Failed to submit payment proof");
        recaptchaRef.current?.reset();
        setCaptchaToken(null);
      }
    } catch (error) {
      console.error("Error submitting payment with CAPTCHA:", error);
      
      if (error.response?.data?.requiresCaptcha === true) {
        alert("CAPTCHA verification failed. Please try again.");
        recaptchaRef.current?.reset();
        setCaptchaToken(null);
      } else if (error.response?.data?.requiresMFA === true || error.response?.status === 401) {
        alert("Invalid password. Please check your password and try again.");
        setCaptchaPassword("");
      } else {
        alert(error.response?.data?.message || "Error submitting payment proof");
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
      alert("Please enter your password to confirm this payment submission.");
      return;
    }

    if (!pendingPayment) {
      alert("Error: Payment data not found. Please try again.");
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
        alert('Payment proof submitted successfully. Awaiting admin verification.');
        setShowMfaModal(false);
        setMfaPassword("");
        setPendingPayment(null);
        setShowPaymentModal(false);
        navigate('/orders');
      } else {
        alert(response.data.message || "Failed to submit payment proof");
      }
    } catch (error) {
      console.error("Error submitting payment with MFA:", error);
      
      if (error.response?.data?.requiresMFA === true || error.response?.status === 401) {
        alert("Invalid password. Please check your password and try again.");
        setMfaPassword("");
      } else {
        alert(error.response?.data?.message || "Error submitting payment proof");
      }
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const validateForm = () => {
    const required = ['street', 'city', 'state', 'zipCode', 'phone'];
    for (let field of required) {
      if (!addressData[field].trim()) {
        alert(`Please fill in ${field.replaceAll(/([A-Z])/g, ' $1').toLowerCase()}`);
        return false;
      }
    }
    return true;
  };

  const proceedToSummary = () => {
    if (validateForm()) {
      setActiveTab('summary');
    }
  };

  if (loading) return <div className="loading">Loading order details...</div>;

  // Check if payment exists - if so, disable information tab
  const hasPaymentProofs = orderData?.paymentProofs && orderData.paymentProofs.length > 0;

  return (
    <div className="place-order">
      <div className="tabs">
        <div 
          className={`tab ${activeTab === 'information' ? 'active' : ''} ${hasPaymentProofs ? 'disabled' : ''}`}
          onClick={() => {
            if (!hasPaymentProofs) {
              setActiveTab('information');
            }
          }}
          style={{ cursor: hasPaymentProofs ? 'not-allowed' : 'pointer', opacity: hasPaymentProofs ? 0.5 : 1 }}
        >
          <span className="tab-number">1</span>
          <span>Shipping Information</span>
        </div>
        <div 
          className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
          style={{ cursor: 'pointer' }}
        >
          <span className="tab-number">2</span>
          <span>Review & Confirm</span>
        </div>
      </div>

      {activeTab === 'information' ? (
        <div className="tab-content">
          <div className="form-section">
            <h3>Shipping Address</h3>
            <form onSubmit={(e) => { e.preventDefault(); proceedToSummary(); }}>
              <div className="form-row">
                <div className="form-group">
                  <label>Business Name</label>
                  <input 
                    type='text' 
                    value={userData?.businessName || ''} 
                    disabled 
                  />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    value={userData?.email || ''} 
                    disabled 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Street Address</label>
                <input 
                  required 
                  name='street' 
                  onChange={onChangeHandler} 
                  value={addressData.street} 
                  type="text" 
                  placeholder='Street address' 
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>City</label>
                  <input 
                    required 
                    name='city' 
                    onChange={onChangeHandler} 
                    value={addressData.city} 
                    type='text' 
                    placeholder='City'
                    disabled={orderData?.paymentProofs && orderData.paymentProofs.length > 0}
                  />
                </div>
                <div className="form-group">
                  <label>Province</label>
                  <select 
                    required 
                    name='state' 
                    onChange={onChangeHandler} 
                    value={addressData.state}
                    className="form-select"
                    disabled={orderData?.paymentProofs && orderData.paymentProofs.length > 0}
                  >
                    <option value="">Select Province</option>
                    <option value="Sindh">Sindh</option>
                    <option value="Punjab">Punjab</option>
                    <option value="Khyber Pakhtunkhwa">Khyber Pakhtunkhwa</option>
                    <option value="Balochistan">Balochistan</option>
                    <option value="Gilgit-Baltistan">Gilgit-Baltistan</option>
                    <option value="Azad Kashmir">Azad Kashmir</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Postal Code</label>
                  <input 
                    required 
                    name='zipCode' 
                    onChange={onChangeHandler} 
                    value={addressData.zipCode} 
                    type='text' 
                    placeholder='Postal code'
                    disabled={orderData?.paymentProofs && orderData.paymentProofs.length > 0}
                  />
                </div>
                <div className="form-group">
                  <label>Country</label>
                  <input 
                    required 
                    name='country' 
                    onChange={onChangeHandler} 
                    value={addressData.country} 
                    type='text' 
                    disabled 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Phone Number</label>
                <input 
                  required 
                  name='phone' 
                  onChange={onChangeHandler} 
                  value={addressData.phone} 
                  type='text' 
                  placeholder='+92 300 1234567'
                  disabled={orderData?.paymentProofs && orderData.paymentProofs.length > 0}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-back" onClick={() => navigate("/quotations")}>
                  Back
                </button>
                {!(orderData?.paymentProofs && orderData.paymentProofs.length > 0) && (
                  <button type="submit" className="btn-primary">
                    Continue to Review
                  </button>
                )}
                {orderData?.paymentProofs && orderData.paymentProofs.length > 0 && (
                  <button 
                    type="button" 
                    className="btn-primary"
                    onClick={() => {
                      setActiveTab('summary');
                      setShowPaymentModal(true);
                    }}
                  >
                    Proceed to Payment
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="tab-content">
          <div className="review-section">
            <div className="review-header">
              <h3>Review Your Order</h3>
             
            </div>

            <div className="order-items">
              <h4>Order Items ({orderData.items.length})</h4>
              <div className="items-list">
                {orderData.items.map((item, index) => (
                  <div key={index} className="item-card">
                    <img src={item.image} alt={item.stoneName} className="item-image" />
                    <div className="item-details">
                      <div className="item-info">
                        <h5>{item.stoneName}</h5>
                        <p className="item-spec">{item.dimensions}</p>
                      </div>
                      <div className="item-quantity">
                        <span>{item.quantity} pcs</span>
                      </div>
                      <div className="item-price">
                        <span className="unit-price">PKR {item.unitPrice?.toLocaleString() || '0'} each</span>
                        <span className="total-price">PKR {(item.unitPrice * item.quantity).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="order-summary">
              <h4>Order Summary</h4>
              <div className="summary-details">
                <div className="summary-row">
                  <span>Subtotal ({orderData.items.length} items)</span>
                  <span>PKR {orderData.financials.subtotal.toLocaleString()}</span>
                </div>
                <div className="summary-row">
                  <span>Tax ({orderData.financials.taxPercentage}%)</span>
                  <span>PKR {orderData.financials.taxAmount.toLocaleString()}</span>
                </div>
                <div className="summary-row">
                  <span>Shipping</span>
                  <span>PKR {orderData.financials.shippingCost.toLocaleString()}</span>
                </div>
                <div className="summary-row discount">
                  <span>Discount</span>
                  <span>- PKR {orderData.financials.discountAmount.toLocaleString()}</span>
                </div>
                <div className="summary-row total">
                  <span>Outstanding Balance</span>
                  <span>PKR {(orderData.outstandingBalance ?? orderData.financials.grandTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div className="shipping-review">
              <h4>Shipping To</h4>
              <div className="shipping-details">
                <p><strong>{userData?.businessName}</strong></p>
                <p>{addressData.street}</p>
                <p>{addressData.city}, {addressData.state} {addressData.zipCode}</p>
                <p>{addressData.country}</p>
                <p>{addressData.phone}</p>
                <p>{userData?.email}</p>
              </div>
            </div>

            <div className="confirmation-section">
              <div className="confirmation-message">
                <p>Please review your order details above. Once you proceed to payment, items will be reserved for 30 minutes.</p>
              </div>
              
              <form onSubmit={handlePlaceOrder}>
                <div className="confirmation-actions">
                  <button type="button" className="btn-back" onClick={() => setActiveTab('information')}>
                    Back to Edit
                  </button>
                  <button type="submit" className="btn-confirm">
                    <FiCreditCard /> Proceed to Payment
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* CAPTCHA Modal */}
      {showCaptchaModal && (
        <div 
          className="modal-overlay" 
          style={{ zIndex: 10000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)' }} 
          onClick={() => {
            setShowCaptchaModal(false);
            setCaptchaToken(null);
            setCaptchaPassword("");
            recaptchaRef.current?.reset();
            setPendingPayment(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowCaptchaModal(false);
              setCaptchaToken(null);
              setCaptchaPassword("");
              recaptchaRef.current?.reset();
              setPendingPayment(null);
            }
          }}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
        >
          <div className="modal-content" style={{ zIndex: 10001, position: 'relative' }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="document">
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
                  <label style={{ marginBottom: '10px', display: 'block' }}>CAPTCHA Verification:</label>
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

      {/* MFA Modal */}
      {showMfaModal && (
        <div 
          className="modal-overlay" 
          style={{ zIndex: 10000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)' }} 
          onClick={() => {
            setShowMfaModal(false);
            setMfaPassword("");
            setPendingPayment(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowMfaModal(false);
              setMfaPassword("");
              setPendingPayment(null);
            }
          }}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
        >
          <div className="modal-content" style={{ zIndex: 10001, position: 'relative' }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="document">
            <div className="modal-header">
              <h3>
                <FiLock style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                Multi-Factor Authentication Required
              </h3>
              <button onClick={() => {
                setShowMfaModal(false);
                setMfaPassword("");
                setPendingPayment(null);
              }}>
                <FiX />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#e74c3c', marginBottom: '20px' }}>
                <FiAlertTriangle style={{ marginRight: '8px', verticalAlign: 'middle' }} />
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
                <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
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

      {/* Payment Modal */}
      {showPaymentModal && !showCaptchaModal && !showMfaModal && (
        <div 
          className="modal-overlay" 
          style={{ zIndex: 9999 }} 
          onClick={() => setShowPaymentModal(false)}
          onKeyDown={(e) => e.key === 'Escape' && setShowPaymentModal(false)}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
        >
          <div className="payment-modal" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="document">
            <div className="payment-modal-header">
              <h3><FiCreditCard /> Submit Payment Proof</h3>
              <button className="modal-close-btn" onClick={() => setShowPaymentModal(false)} disabled={paymentSubmitting}>×</button>
            </div>
            
            <div className="payment-modal-body">
              <p className="payment-modal-subtitle">Please attach a screenshot of your bank transfer and enter the exact amount paid.</p>

              <form onSubmit={submitPaymentProof} className="payment-form">
                <div className="payment-info-card">
                  <div className="info-row">
                    <span className="info-label">Outstanding Balance:</span>
                    <span className="info-value highlight">PKR {(orderData?.outstandingBalance ?? orderData?.financials?.grandTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="form-group">
                  <label>Amount Paid (PKR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    max={orderData?.outstandingBalance || orderData?.financials?.grandTotal}
                    min="0.01"
                    placeholder="0.00"
                    required
                    className="payment-amount-input"
                  />
                  <p className="help-text">Enter the exact amount you transferred (decimals allowed)</p>
                </div>

                <div className="form-group">
                  <label>Payment Proof (Screenshot)</label>
                  <div className="file-upload-wrapper">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setPaymentProofFile(e.target.files[0])}
                      required
                      className="file-input"
                      id="payment-proof-input"
                    />
                    <label htmlFor="payment-proof-input" className="file-upload-label">
                      {paymentProofFile ? paymentProofFile.name : 'Choose file or drag here'}
                    </label>
                  </div>
                  <p className="help-text">Upload a clear screenshot of your bank transfer confirmation</p>
                </div>

                {addressData.street && (
                  <div className="form-group">
                    <label>Delivery Address</label>
                    <div className="address-preview">
                      <p><strong>{addressData.street}</strong></p>
                      <p>{addressData.city}, {addressData.state} {addressData.zipCode}</p>
                      <p>{addressData.country}</p>
                      <p>{addressData.phone}</p>
                    </div>
                  </div>
                )}
              </form>
            </div>

            <div className="payment-modal-footer">
              <button type="button" className="btn-back" onClick={() => setShowPaymentModal(false)} disabled={paymentSubmitting}>Cancel</button>
              <button type="submit" className="btn-primary" onClick={submitPaymentProof} disabled={paymentSubmitting}>
                {paymentSubmitting ? 'Submitting...' : 'Submit Payment Proof'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaceOrder;