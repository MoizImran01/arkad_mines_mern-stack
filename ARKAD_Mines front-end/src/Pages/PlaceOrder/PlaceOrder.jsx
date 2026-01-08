import React, { useContext, useEffect, useState } from 'react';
import { StoreContext } from '../../context/StoreContext';
import './PlaceOrder.css';
import axios from "axios";
import { useNavigate, useParams } from 'react-router-dom';
import { FiPackage, FiCreditCard, FiMapPin, FiShoppingBag, FiEdit2, FiArrowLeft } from "react-icons/fi";

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

  const submitPaymentProof = async (e) => {
    e.preventDefault();
    // Parse amount with proper decimal handling
    const numericAmount = parseFloat(paymentAmount);
    if (!isFinite(numericAmount) || numericAmount <= 0 || numericAmount < 0.01) {
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

      let base64;
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
        amountPaid: parseFloat(numericAmount.toFixed(2)), // Ensure proper decimal precision
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
      alert(err.response?.data?.message || 'Error submitting payment proof');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const validateForm = () => {
    const required = ['street', 'city', 'state', 'zipCode', 'phone'];
    for (let field of required) {
      if (!addressData[field].trim()) {
        alert(`Please fill in ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
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

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
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