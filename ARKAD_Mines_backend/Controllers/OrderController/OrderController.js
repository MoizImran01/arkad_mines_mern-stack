import orderModel from "../../Models/orderModel/orderModel.js";
import stonesModel from "../../Models/stonesModel/stonesModel.js";
import { cloudinary, configureCloudinary } from '../../config/cloudinary.js';

// Get order details by order number for the logged-in user for a single order
const getOrderDetails = async (req, res) => {
  try {
    const { orderNumber } = req.params;


    const order = await orderModel.findOne({ 
      orderNumber: orderNumber,
      buyer: req.user.id 
    }).populate("buyer", "companyName email");

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: "Order not found" 
      });
    }

    res.json({ 
      success: true, 
      order 
    });
  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while retrieving order" 
    });
  }
};

//Get all orders for the logged-in user
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id; 
    const { status } = req.query; 

    const query = { buyer: userId };
    
    if (status) {
      query.status = status;
    }
    
    const orders = await orderModel.find(query)
      .populate("buyer", "companyName email phone") 
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      orders, 
      count: orders.length
    });

  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({
      success: false,
      message: "Server error while retrieving your orders"
    });
  }
};

//get all orders (acccessible by Admin only)
const getAllOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }

    const orders = await orderModel
      .find(query)
      .populate("buyer", "companyName email phone")
      .populate("quotation", "referenceNumber")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      orders,
      count: orders.length
    });

  } catch (error) {
    console.error("Error fetching all orders:", error);
    res.status(500).json({
      success: false,
      message: "Server error while retrieving orders"
    });
  }
};

//update order status (accessible by Admin only)
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, courierService, trackingNumber, courierLink, notes, dispatchedBlocks } = req.body;

    const validStatuses = ["draft", "confirmed", "dispatched", "delivered", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`
      });
    }

    const order = await orderModel.findById(orderId).populate("items.stone");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Handle confirmed status - check payment first, then deduct stock
    if (status === "confirmed") {
      // Prevent manual confirmation if payment is not fully paid
      if (order.paymentStatus !== "fully_paid") {
        return res.status(400).json({
          success: false,
          message: "Cannot confirm order. Full payment is required before confirmation."
        });
      }

      if (order.items && order.items.length > 0) {
        // Deduct stock for each item in the order
        for (const item of order.items) {
          const stone = await stonesModel.findById(item.stone?._id || item.stoneId);
          if (stone) {
            const quantityToDeduct = item.quantity || 1;
            
            // Check if enough stock is available
            const remainingBeforeDeduct = stone.stockQuantity - (stone.quantityDelivered || 0);
            if (remainingBeforeDeduct < quantityToDeduct) {
              return res.status(400).json({
                success: false,
                message: `Not enough stock available for ${stone.stoneName}. Need ${quantityToDeduct}, but only ${remainingBeforeDeduct} available.`
              });
            }
            
            stone.quantityDelivered = (stone.quantityDelivered || 0) + quantityToDeduct;
            
            // Update stock availability based on remaining quantity
            const remainingQuantity = stone.stockQuantity - stone.quantityDelivered;
            if (remainingQuantity <= 0) {
              stone.stockAvailability = "Out of Stock";
            }

            await stone.save();
          }
        }
      }
    }

    // Handle dispatch status - just set courier info (stock already deducted on confirmed)
    if (status === "dispatched") {
      // Prevent dispatch if payment is not fully paid
      if (order.paymentStatus !== "fully_paid") {
        return res.status(400).json({
          success: false,
          message: "Cannot dispatch order. Full payment is required before dispatch."
        });
      }

      if (!courierService || !trackingNumber) {
        return res.status(400).json({
          success: false,
          message: "Courier service and tracking number are required for dispatched status"
        });
      }

      order.courierTracking = {
        isDispatched: true,
        courierService,
        trackingNumber,
        courierLink: courierLink || "",
        dispatchedAt: new Date()
      };
    }

    // Handle delivered status - check payment first
    if (status === "delivered") {
      // Prevent delivery if payment is not fully paid
      if (order.paymentStatus !== "fully_paid") {
        return res.status(400).json({
          success: false,
          message: "Cannot mark order as delivered. Full payment is required before delivery."
        });
      }
    }

    // Handle cancelled status - restore stock quantities (only if was confirmed or dispatched)
    if (status === "cancelled") {
      if ((order.status === "confirmed" || order.status === "dispatched") && order.items) {
        // Restore quantityDelivered for all items in the order
        for (const item of order.items) {
          const stone = await stonesModel.findById(item.stone?._id || item.stoneId);
          if (stone) {
            const quantityToRestore = item.quantity || 1;
            // Reduce quantityDelivered to restore stock
            stone.quantityDelivered = Math.max(0, (stone.quantityDelivered || 0) - quantityToRestore);
            
            // Update stock availability
            const remainingQuantity = stone.stockQuantity - stone.quantityDelivered;
            if (remainingQuantity > 0) {
              stone.stockAvailability = "In Stock";
            }

            await stone.save();
          }
        }
      }
    }

    order.status = status;

    //add order timeline entry
    order.timeline.push({
      status: status,
      timestamp: new Date(),
      notes: notes || `Order status updated to ${status}`
    });

    await order.save();

    res.json({
      success: true,
      message: `Order status updated to ${status}`,
      order
    });

  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating order status"
    });
  }
};

// Submit payment proof by client
const submitPaymentProof = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { amountPaid } = req.body;

    // Handle proof upload coming as base64 string (from client) - upload to Cloudinary
    let proofFileUrl = null;
    if (req.body.proofBase64) {
      // upload base64 data to Cloudinary
      const base64 = req.body.proofBase64;
      try {
        // Ensure Cloudinary is configured before upload
        configureCloudinary();
        
        // Cloudinary accepts data URI format directly
        const uploadRes = await cloudinary.uploader.upload(base64, {
          folder: 'arkad_mines/payment_proofs',
          resource_type: 'image',
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
          transformation: [
            { quality: 'auto:good' },
            { fetch_format: 'auto' }
          ]
        });
        proofFileUrl = uploadRes.secure_url;
      } catch (uploadErr) {
        console.error('Cloudinary upload error:', uploadErr);
        console.error('Error details:', {
          message: uploadErr.message,
          http_code: uploadErr.http_code,
          name: uploadErr.name,
          error: uploadErr
        });
        
        // Check if it's a configuration error
        if (uploadErr.message && uploadErr.message.includes('api_key')) {
          console.error('Cloudinary configuration error - check CLOUDINARY_API_KEY in config.env');
          return res.status(500).json({ 
            success: false, 
            message: 'Cloudinary configuration error. Please check server configuration.' 
          });
        }
        
        return res.status(500).json({ 
          success: false, 
          message: `Failed to upload proof to Cloudinary: ${uploadErr.message || 'Unknown error'}` 
        });
      }
    }

    // Accept delivery address sent from client (may be JSON string or object)
    let address = null;
    if (req.body.address) {
      try {
        address = typeof req.body.address === 'string' ? JSON.parse(req.body.address) : req.body.address;
      } catch (e) {
        // If parsing fails, ignore and continue
        address = null;
      }
    }

    if (!orderId || amountPaid === undefined || amountPaid === null) {
      return res.status(400).json({
        success: false,
        message: "Order ID and amount paid are required"
      });
    }

    if (!proofFileUrl) {
      return res.status(400).json({
        success: false,
        message: "Payment proof file is required"
      });
    }

    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // If address provided, update order deliveryAddress
    if (address) {
      order.deliveryAddress = {
        street: address.street || order.deliveryAddress?.street || "",
        city: address.city || order.deliveryAddress?.city || "",
        state: address.state || order.deliveryAddress?.state || "",
        zipCode: address.zipCode || order.deliveryAddress?.zipCode || "",
        country: address.country || order.deliveryAddress?.country || "",
        phone: address.phone || order.deliveryAddress?.phone || ""
      };
    } else {
      // Also accept individual address fields if sent directly
      const { street, city, state, zipCode, country, phone } = req.body;
      if (street || city || state || zipCode || country || phone) {
        order.deliveryAddress = {
          street: street || order.deliveryAddress?.street || "",
          city: city || order.deliveryAddress?.city || "",
          state: state || order.deliveryAddress?.state || "",
          zipCode: zipCode || order.deliveryAddress?.zipCode || "",
          country: country || order.deliveryAddress?.country || "",
          phone: phone || order.deliveryAddress?.phone || ""
        };
      }
    }

    // Parse and validate numeric amount (allow decimals)
    const numericAmount = parseFloat(amountPaid);
    if (!isFinite(numericAmount)) {
      return res.status(400).json({ success: false, message: 'Invalid amountPaid value' });
    }

    // Check if amount paid exceeds outstanding balance
    if (numericAmount > order.outstandingBalance) {
      return res.status(400).json({
        success: false,
        message: `Amount paid cannot exceed outstanding balance of Rs ${order.outstandingBalance}`
      });
    }

    // Add payment proof (store numeric amount and cloudinary URL)
    order.paymentProofs.push({
      proofFile: proofFileUrl,
      amountPaid: numericAmount,
      status: "pending"
    });

    // Update payment timeline with proof file reference and numeric amount
    order.paymentTimeline.push({
      action: "payment_submitted",
      amountPaid: numericAmount,
      proofFile: proofFileUrl,
      notes: `Payment of Rs ${numericAmount} submitted for verification`
    });

    // Update payment status to payment_in_progress if it was pending
    if (order.paymentStatus === "pending") {
      order.paymentStatus = "payment_in_progress";
    }

    await order.save();

    res.json({
      success: true,
      message: "Payment proof submitted successfully. Awaiting admin approval.",
      order
    });

  } catch (error) {
    console.error("Error submitting payment proof:", error);
    res.status(500).json({
      success: false,
      message: "Server error while submitting payment proof"
    });
  }
};

// Approve payment by admin
const approvePayment = async (req, res) => {
  try {
    const { orderId, proofIndex } = req.params;
    const { notes } = req.body;
    const adminId = req.user.id; // Assuming authenticated admin

    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (!order.paymentProofs[proofIndex]) {
      return res.status(404).json({
        success: false,
        message: "Payment proof not found"
      });
    }

    const paymentProof = order.paymentProofs[proofIndex];

    // Update payment proof
    paymentProof.status = "approved";
    paymentProof.approvedAt = new Date();
    paymentProof.approvedBy = adminId;
    paymentProof.notes = notes || "";

    // Update totalPaid
    order.totalPaid += paymentProof.amountPaid;

    // Calculate outstanding balance
    order.outstandingBalance = order.financials.grandTotal - order.totalPaid;

    // Update payment status if fully paid
    if (order.outstandingBalance <= 0) {
      order.paymentStatus = "fully_paid";

      // Auto-confirm order if payment is fully received and order is still in draft/pending
      if (order.status === "draft") {
        order.status = "confirmed";
        
        // Add to order timeline
        order.timeline.push({
          status: "confirmed",
          timestamp: new Date(),
          notes: "Order automatically confirmed upon full payment received"
        });
      }
    }

    // Update payment timeline
    order.paymentTimeline.push({
      action: "payment_approved",
      amountPaid: paymentProof.amountPaid,
      notes: notes || `Payment of Rs ${paymentProof.amountPaid} approved by admin`
    });

    await order.save();

    res.json({
      success: true,
      message: "Payment approved successfully",
      order
    });

  } catch (error) {
    console.error("Error approving payment:", error);
    res.status(500).json({
      success: false,
      message: "Server error while approving payment"
    });
  }
};

// Reject payment by admin
const rejectPayment = async (req, res) => {
  try {
    const { orderId, proofIndex } = req.params;
    const { notes, rejectionReason } = req.body;

    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (!order.paymentProofs[proofIndex]) {
      return res.status(404).json({
        success: false,
        message: "Payment proof not found"
      });
    }

    const paymentProof = order.paymentProofs[proofIndex];
    paymentProof.status = "rejected";
    // Store rejection reason (optional) - use rejectionReason if provided, otherwise notes, otherwise empty
    paymentProof.notes = rejectionReason || notes || "";

    // Update payment timeline with rejection reason
    const rejectionNote = rejectionReason || notes || "N/A";
    order.paymentTimeline.push({
      action: "payment_rejected",
      amountPaid: paymentProof.amountPaid,
      notes: rejectionNote !== "N/A" ? `Payment of Rs ${paymentProof.amountPaid} rejected. Reason: ${rejectionNote}` : `Payment of Rs ${paymentProof.amountPaid} rejected`
    });

    await order.save();

    res.json({
      success: true,
      message: "Payment rejected successfully",
      order
    });

  } catch (error) {
    console.error("Error rejecting payment:", error);
    res.status(500).json({
      success: false,
      message: "Server error while rejecting payment"
    });
  }
};

// Get order details with all payment information (for both client and admin)
const getOrderDetailsWithPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === "admin";

    let query = { _id: orderId };

    // If not admin, ensure user is the buyer
    if (!isAdmin) {
      query.buyer = userId;
    }

    const order = await orderModel.findOne(query).populate("buyer", "companyName email phone");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    res.json({
      success: true,
      order
    });

  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(500).json({
      success: false,
      message: "Server error while retrieving order"
    });
  }
};

// Update payment status by admin
const updatePaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentStatus, notes } = req.body;

    const validPaymentStatuses = ["pending", "payment_in_progress", "fully_paid"];
    if (!validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment status. Must be one of: ${validPaymentStatuses.join(", ")}`
      });
    }

    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    order.paymentStatus = paymentStatus;

    // Add to payment timeline
    order.paymentTimeline.push({
      action: `payment_${paymentStatus === 'fully_paid' ? 'approved' : paymentStatus}`,
      timestamp: new Date(),
      notes: notes || `Payment status updated to ${paymentStatus}`
    });

    await order.save();

    res.json({
      success: true,
      message: `Payment status updated to ${paymentStatus}`,
      order
    });

  } catch (error) {
    console.error("Error updating payment status:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating payment status"
    });
  }
};

export { 
  getOrderDetails, 
  getUserOrders, 
  getAllOrders, 
  updateOrderStatus,
  submitPaymentProof,
  approvePayment,
  rejectPayment,
  getOrderDetailsWithPayment,
  updatePaymentStatus
};