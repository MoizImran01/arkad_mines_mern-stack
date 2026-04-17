import React, { useContext, useEffect, useState } from 'react';
import { StoreContext } from '../../context/StoreContext';
import { compressImage } from '../../utils/compressImage';
import './PlaceOrder.css';
import axios from "axios";
import { useNavigate, useParams } from 'react-router-dom';
import { FiPackage, FiCreditCard, FiMapPin, FiShoppingBag, FiEdit2, FiArrowLeft } from "react-icons/fi";
import { toast } from "react-toastify";
import usePaymentVerification from '../../../../shared/usePaymentVerification';
import { MfaModal } from '../../../../shared/VerificationModals.jsx';

// Order status page: delivery info, summary, and payment proof with MFA confirmation.
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
          if (ord.buyer) {
            setUserData({
              businessName: ord.buyer.companyName || 'N/A',
              email: ord.buyer.email || 'N/A'
            });
          }

          const hasPaymentProofs = ord.paymentProofs && ord.paymentProofs.length > 0;
          
          if (ord.deliveryAddress) {
            setAddressData({
              street: ord.deliveryAddress.street || '',
              city: ord.deliveryAddress.city || '',
              state: ord.deliveryAddress.state || '',
              zipCode: ord.deliveryAddress.zipCode || '',
              country: ord.deliveryAddress.country || 'Pakistan',
              phone: ord.deliveryAddress.phone || ''
            });

            if (hasPaymentProofs && (ord.outstandingBalance || ord.financials?.grandTotal) > 0) {
              setActiveTab('summary');
              setTimeout(() => {
                setShowPaymentModal(true);
              }, 100);
            }
          } else {
            if (hasPaymentProofs && (ord.outstandingBalance || ord.financials?.grandTotal) > 0) {
              setActiveTab('summary');
              setTimeout(() => {
                setShowPaymentModal(true);
              }, 100);
            }
          }
        } else {
          toast.error("Order not found");
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
    event.preventDefault();
    setShowPaymentModal(true);
  };

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentProofFile, setPaymentProofFile] = useState(null);

  const pv = usePaymentVerification(url, token);

  const submitPaymentProof = async (e) => {
    e.preventDefault();
    const numericAmount = Number.parseFloat(paymentAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount < 0.01) {
      toast.error('Please enter a valid payment amount (minimum 0.01)');
      return;
    }
    if (!paymentProofFile) {
      toast.error('Please upload a payment proof screenshot');
      return;
    }

    const outstanding = orderData?.outstandingBalance ?? orderData?.financials?.grandTotal;
    if (numericAmount > outstanding + 0.01) {
      toast.error(`Amount cannot exceed outstanding balance of Rs ${outstanding.toFixed(2)}`);
      return;
    }

    pv.setPaymentSubmitting(true);
    let base64 = null;

    try {
      try {
        base64 = await compressImage(paymentProofFile);
        if (!base64 || !base64.startsWith('data:image/')) {
          throw new Error('Invalid image format after compression');
        }
      } catch (compressionError) {
        console.error('Image compression error:', compressionError);
        toast.error('Failed to process image. Please try a different image file.');
        pv.setPaymentSubmitting(false);
        return;
      }

      const payload = {
        amountPaid: Number.parseFloat(numericAmount.toFixed(2)),
        address: addressData,
        proofBase64: base64,
        proofFileName: paymentProofFile.name
      };

      const response = await axios.post(
        `${url}/api/orders/payment/submit/${orderData._id}`,
        payload,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );

      if (response.data.success) {
        toast.success('Payment proof submitted successfully. Awaiting admin verification.');
        setShowPaymentModal(false);
        navigate('/orders');
      } else {
        toast.error(response.data.message || 'Failed to submit payment proof');
      }
    } catch (err) {
      console.error('Error submitting payment proof:', err);
      const errData = err.response?.data;
      const { requiresMFA } = pv.detectVerificationNeeded(errData);

      if (requiresMFA) {
        setShowPaymentModal(false);
        if (!base64 && paymentProofFile) {
          try { base64 = await compressImage(paymentProofFile); }
          catch { toast.error('Failed to process image. Please try again.'); pv.setPaymentSubmitting(false); return; }
        }
        pv.triggerVerification({
          orderId: orderData._id,
          amountPaid: Number.parseFloat(numericAmount.toFixed(2)),
          address: addressData,
          proofBase64: base64,
          proofFileName: paymentProofFile.name
        });
        pv.setPaymentSubmitting(false);
        return;
      }

      toast.error(errData?.message || 'Error submitting payment proof');
      pv.setPaymentSubmitting(false);
    }
  };

  const onPaymentSuccess = () => {
    setShowPaymentModal(false);
    navigate('/orders');
  };

  const validateForm = () => {
    const required = ['street', 'city', 'state', 'zipCode', 'phone'];
    for (let field of required) {
      if (!addressData[field].trim()) {
        toast.error(`Please fill in ${field.replaceAll(/([A-Z])/g, ' $1').toLowerCase()}`);
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

  const hasPaymentProofs = orderData?.paymentProofs && orderData.paymentProofs.length > 0;

  return (
    <div className="place-order">
      <div className="tabs" role="tablist">
        <button 
          type="button"
          role="tab"
          aria-selected={activeTab === 'information'}
          className={`tab ${activeTab === 'information' ? 'active' : ''} ${hasPaymentProofs ? 'disabled' : ''}`}
          onClick={() => {
            if (!hasPaymentProofs) {
              setActiveTab('information');
            }
          }}
          style={{ cursor: hasPaymentProofs ? 'not-allowed' : 'pointer', opacity: hasPaymentProofs ? 0.5 : 1 }}
          disabled={hasPaymentProofs}
        >
          <span className="tab-number">1</span>
          <span>Shipping Information</span>
        </button>
        <button 
          type="button"
          role="tab"
          aria-selected={activeTab === 'summary'}
          className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
          style={{ cursor: 'pointer' }}
        >
          <span className="tab-number">2</span>
          <span>Review & Confirm</span>
        </button>
      </div>

      {activeTab === 'information' ? (
        <div className="tab-content">
          <div className="form-section">
            <h3>Shipping Address</h3>
            <form onSubmit={(e) => { e.preventDefault(); proceedToSummary(); }}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="businessName">Business Name</label>
                  <input 
                    id="businessName"
                    type='text' 
                    value={userData?.businessName || ''} 
                    disabled 
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="emailAddress">Email Address</label>
                  <input 
                    id="emailAddress"
                    type="email" 
                    value={userData?.email || ''} 
                    disabled 
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="streetAddress">Street Address</label>
                <input 
                  id="streetAddress"
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
                  <label htmlFor="city">City</label>
                  <input 
                    id="city"
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
                  <label htmlFor="province">Province</label>
                  <select 
                    id="province"
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
                  <label htmlFor="postalCode">Postal Code</label>
                  <input 
                    id="postalCode"
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
                  <label htmlFor="country">Country</label>
                  <input 
                    id="country"
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
                <label htmlFor="phoneNumber">Phone Number</label>
                <input 
                  id="phoneNumber"
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
                  <span>PKR {(orderData.outstandingBalance ?? orderData.financials?.grandTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                  <button
                    type="button"
                    className="btn-back"
                    onClick={() => setActiveTab('information')}
                    disabled={hasPaymentProofs || showPaymentModal || pv.paymentSubmitting}
                  >
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

      {pv.showMfaModal && (
        <MfaModal
          onSubmit={(e) => pv.handleMfaSubmit(e, onPaymentSuccess)}
          onClose={pv.resetMfaState}
          isSubmitting={pv.paymentSubmitting}
          mfaPassword={pv.mfaPassword}
          setMfaPassword={pv.setMfaPassword}
        />
      )}

      {showPaymentModal && !pv.showMfaModal && (
        <div 
          className="modal-overlay" 
          style={{ zIndex: 9999 }} 
          role="dialog"
          aria-modal="true"
        >
          <div className="payment-modal" role="document">
            <div className="payment-modal-header">
              <h3><FiCreditCard /> Submit Payment Proof</h3>
              {!pv.paymentSubmitting && (
                <button className="modal-close-btn" onClick={() => setShowPaymentModal(false)}>×</button>
              )}
            </div>
            
            <div className="payment-modal-body">
              <p className="payment-modal-subtitle">Please attach a screenshot of your bank transfer and enter the exact amount paid.</p>

              <form onSubmit={submitPaymentProof} className="payment-form">
                <div className="payment-info-card">
                  <div className="info-row">
                    <span className="info-label">Outstanding Balance:</span>
                    <span className="info-value highlight">PKR {(orderData?.outstandingBalance ?? orderData?.financials?.grandTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="paymentAmount">Amount Paid (PKR)</label>
                  <input
                    id="paymentAmount"
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
                  <label htmlFor="paymentProof">Payment Proof (Screenshot)</label>
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
                    <span className="form-label">Delivery Address</span>
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
              {!pv.paymentSubmitting && (
                <button type="button" className="btn-back" onClick={() => setShowPaymentModal(false)}>Cancel</button>
              )}
              <button type="submit" className="btn-primary" onClick={submitPaymentProof} disabled={pv.paymentSubmitting}>
                {pv.paymentSubmitting ? 'Submitting...' : 'Submit Payment Proof'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaceOrder;