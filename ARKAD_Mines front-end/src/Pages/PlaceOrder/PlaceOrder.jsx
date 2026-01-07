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
          // Extract user data from the order's buyer information
          if (response.data.order.buyer) {
            setUserData({
              businessName: response.data.order.buyer.companyName || 'N/A',
              email: response.data.order.buyer.email || 'N/A'
            });
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
    event.preventDefault();
    const submissionData = { orderNumber, address: addressData };

    try {
      let response = await axios.post(`${url}/api/order/confirm-payment`, submissionData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        window.location.replace(response.data.session_url);
      } else {
        alert(response.data.message || "Error placing order");
      }
    } catch (err) {
      alert("Inventory check failed or server error.");
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

  return (
    <div className="place-order">
      <div className="tabs">
        <div className={`tab ${activeTab === 'information' ? 'active' : ''}`}>
          <span className="tab-number">1</span>
          <span>Shipping Information</span>
        </div>
        <div className={`tab ${activeTab === 'summary' ? 'active' : ''}`}>
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
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-back" onClick={() => navigate("/quotations")}>
                  Back
                </button>
                <button type="submit" className="btn-primary">
                  Continue to Review
                </button>
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
                  <span>Total Amount</span>
                  <span>PKR {orderData.financials.grandTotal.toLocaleString()}</span>
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
    </div>
  );
};

export default PlaceOrder;