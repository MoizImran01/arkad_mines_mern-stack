import React from 'react'
import './Orders.css'
import { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { FiPackage, FiCheckCircle, FiXCircle, FiClock, FiDollarSign, FiUser, FiMapPin, FiPhone, FiCalendar, FiTruck } from 'react-icons/fi';
const Orders = () => {
  //state to store all orders fetched from the backend
  const [orders, setOrders] = useState([]);
  //loading state to show spinner while data is being fetched
  const [loading, setLoading] = useState(true);
  //state to track which order is currently expanded to show details
  const [expandedOrder, setExpandedOrder] = useState(null);

 //array of possible order statuses with their display labels and icons
 const statusOptions = [
  { value: 'Food Processing', label: 'Processing', icon: <FiClock className="status-icon processing" /> },
  { value: 'Out for Delivery', label: 'Out for Delivery', icon: <FiTruck className="status-icon out-for-delivery" /> },
  { value: 'Delivered', label: 'Delivered', icon: <FiCheckCircle className="status-icon delivered" /> },
  { value: 'Cancelled', label: 'Cancelled', icon: <FiXCircle className="status-icon cancelled" /> }
];

  //function to fetch all orders from the backend API
  const fetchAllOrders = async () => {
    try {
      setLoading(true);
      const response = await axios.get("http://localhost:4000/api/order/list");
      if (response.data.success) {
        setOrders(response.data.data);
      } else {
        toast.error("Error occurred displaying user orders");
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  //function to update the status of a specific order
  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const response = await axios.put(`http://localhost:4000/api/order/update-status/${orderId}`, {
        status: newStatus
      });
      
      if (response.data.success) {
        toast.success(`Order status updated to ${newStatus}`);
        //refresh the orders list to show updated status
        fetchAllOrders();
      } else {
        toast.error("Failed to update order status");
      }
    } catch (error) {
      console.error("Error updating order status:", error);
      toast.error("Error updating order status");
    }
  };

  //toggles the expanded view for a specific order - if same order clicked again, collapses it
  const toggleOrderExpand = (orderId) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  //formats date string into more readable format
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  //fetch orders when component first loads
  useEffect(() => {
    fetchAllOrders();
  }, []);

  //show loading spinner while data is being fetched
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading orders...</p>
      </div>
    );
  }

  return (
    <div className="orders-admin-container">
      <div className="orders-header">
        <h1><FiPackage className="header-icon" /> Orders Management</h1>
        <p>Manage and track all customer orders</p>
      </div>

      {/*statistics cards showing order counts and revenue*/}
      <div className="orders-stats">
        <div className="stat-card">
          <div className="stat-icon total">
            <FiPackage />
          </div>
          <div className="stat-info">
            <h3>{orders.length}</h3>
            <p>Total Orders</p>
          </div>
        </div>
        <div className="stat-card">
      <div className="stat-icon out-for-delivery">
        <FiTruck />
      </div>
      <div className="stat-info">
        <h3>{orders.filter(o => o.status === 'Out for Delivery').length}</h3>
        <p>Out for Delivery</p>
      </div>
     </div>
        <div className="stat-card">
          <div className="stat-icon processing">
            <FiClock />
          </div>
          <div className="stat-info">
            <h3>{orders.filter(o => o.status === 'Food Processing').length}</h3>
            <p>Processing</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon delivered">
            <FiCheckCircle />
          </div>
          <div className="stat-info">
            <h3>{orders.filter(o => o.status === 'Delivered').length}</h3>
            <p>Delivered</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon revenue">
            <FiDollarSign />
          </div>
          <div className="stat-info">
             <h3>
      {/*calculate total revenue from delivered orders only*/}
      ${orders.reduce((sum, order) => {
        return order.status === "Delivered" ? sum + order.amount : sum;
      }, 0)}
    </h3>
            <p>Total Revenue</p>
          </div>
        </div>
      </div>

      {/*main orders table*/}
      <div className="orders-table-container">
        <div className="table-responsive">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {/*show empty state if no orders exist*/}
              {orders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="no-orders">
                    <div className="empty-state">
                      <FiPackage className="empty-icon" />
                      <p>No orders found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                //map through all orders and render each as a table row
                orders.map(order => (
                  <React.Fragment key={order._id}>
                    <tr className="order-row" onClick={() => toggleOrderExpand(order._id)}>
                      <td className="order-id">#{order._id.slice(-6).toUpperCase()}</td>
                      <td className="customer-info">
                        <div className="customer-name">
                          <FiUser className="info-icon" />
                          {order.address.firstName} {order.address.lastName}
                        </div>
                      </td>
                      <td className="items-count">{order.items.reduce((sum, item) => sum + item.quantity, 0)} items</td>
                      <td className="order-total">${order.amount}</td>
                      <td className="order-date">
                        <FiCalendar className="info-icon" />
                        {formatDate(order.date)}
                      </td>
                      <td className="order-status">
                        <div className={`status-badge ${order.status.toLowerCase().replace(' ', '-')}`}>
                          {statusOptions.find(s => s.value === order.status)?.icon}
                          {statusOptions.find(s => s.value === order.status)?.label}
                        </div>
                      </td>
                      <td className="order-actions">
                        <button className="details-btn">
                          {expandedOrder === order._id ? 'Hide Details' : 'View Details'}
                        </button>
                      </td>
                    </tr>
                    {/*expanded details section that shows when order is clicked*/}
                    {expandedOrder === order._id && (
                      <tr className="order-details-row">
                        <td colSpan="7">
                          <div className="order-details">
                            <div className="details-section">
                              <h4><FiUser className="section-icon" /> Customer Information</h4>
                              <div className="details-grid">
                                <div>
                                  <span className="detail-label">Name:</span>
                                  <span>{order.address.firstName} {order.address.lastName}</span>
                                </div>
                                <div>
                                  <span className="detail-label">Email:</span>
                                  <span>{order.address.email}</span>
                                </div>
                                <div>
                                  <span className="detail-label">Phone:</span>
                                  <span><FiPhone className="info-icon" /> {order.address.phone}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="details-section">
                              <h4><FiMapPin className="section-icon" /> Delivery Address</h4>
                              <div className="address-details">
                                <p>{order.address.street}, {order.address.city}</p>
                                <p>{order.address.state}, {order.address.zipCode}</p>
                                <p>{order.address.country}</p>
                              </div>
                            </div>
                            
                            <div className="details-section">
                              <h4><FiPackage className="section-icon" /> Order Items</h4>
                              <div className="order-items">
                                {order.items.map(item => (
                                  <div key={item._id} className="order-item">
                                    <div className="item-image">
                                      <img 
                                        src={`http://localhost:4000/images/${item.image}`} 
                                        alt={item.name} 
                                        onError={(e) => {
                                          e.target.onerror = null; 
                                          e.target.src = 'https://via.placeholder.com/50';
                                        }}
                                      />
                                    </div>
                                    <div className="item-info">
                                      <h5>{item.name}</h5>
                                      <p>{item.category}</p>
                                    </div>
                                    <div className="item-quantity">
                                      <span>{item.quantity} × ${item.price}</span>
                                    </div>
                                    <div className="item-total">
                                      ${(item.quantity * item.price).toFixed(2)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            <div className="details-section payment-section">
                              <div className="payment-status">
                                <h4>Payment Status:</h4>
                                <span className={`payment-badge ${order.payment ? 'paid' : 'unpaid'}`}>
                                  {order.payment ? 'Paid' : 'Unpaid'}
                                </span>
                              </div>
                              
                              <div className="status-control">
                                <h4>Update Status:</h4>
                                <select
                                  value={order.status}
                                  onChange={(e) => updateOrderStatus(order._id, e.target.value)}
                                  className="status-select"
                                >
                                  {statusOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              
                              <div className="order-summary">
                                <h4>Order Summary</h4>
                                <div className="summary-row">
                                  <span>Subtotal:</span>
                                  <span>${order.amount}</span>
                                </div>
                                <div className="summary-row">
                                  <span>Delivery Fee:</span>
                                  <span>$0.00</span>
                                </div>
                                <div className="summary-row total">
                                  <span>Total:</span>
                                  <span>${order.amount}</span>
                                </div>
                              </div>
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
    </div>
  );
};

export default Orders;