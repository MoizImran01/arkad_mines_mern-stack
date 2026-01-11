import orderModel from "../../Models/orderModel/orderModel.js";
import stonesModel from "../../Models/stonesModel/stonesModel.js";
import { cloudinary, configureCloudinary, generateSignedUrl } from '../../config/cloudinary.js';
import { logAudit, logError, getClientIp, normalizeRole, getUserAgent } from '../../logger/auditLogger.js';

// Helper function to round to 2 decimal places
const roundToTwoDecimals = (value) => {
  return Math.round((value || 0) * 100) / 100;
};

// Helper function to generate signed URLs for payment proofs in an order object
const generateSignedUrlsForPaymentProofs = (order) => {
  if (!order) return order;
  
  // Convert to plain object if it's a Mongoose document
  const orderObj = order.toObject ? order.toObject() : order;
  
  // Generate signed URLs for payment proofs
  if (orderObj.paymentProofs && Array.isArray(orderObj.paymentProofs)) {
    orderObj.paymentProofs = orderObj.paymentProofs.map(proof => {
      if (proof.proofFile) {
        // Generate signed URL that expires in 1 hour (3600 seconds)
        proof.proofFile = generateSignedUrl(proof.proofFile, 3600);
      }
      return proof;
    });
  }
  
  // Also update payment timeline proof file URLs
  if (orderObj.paymentTimeline && Array.isArray(orderObj.paymentTimeline)) {
    orderObj.paymentTimeline = orderObj.paymentTimeline.map(timeline => {
      if (timeline.proofFile) {
        // Generate signed URL that expires in 1 hour (3600 seconds)
        timeline.proofFile = generateSignedUrl(timeline.proofFile, 3600);
      }
      return timeline;
    });
  }
  
  return orderObj;
};

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
// SECURITY: All payment processing logic is enforced server-side only
// - outstandingBalance and totalPaid are calculated ONLY after admin approval (in approvePayment)
// - paymentStatus is managed server-side only (clients cannot set it directly - see rejectClientPaymentStatus middleware)
// - Clients can only submit payment proofs with amountPaid; all other fields are server-calculated
const submitPaymentProof = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { amountPaid } = req.body; // Only accept amountPaid from client; paymentStatus is rejected by middleware

    // Handle proof upload coming as base64 string (from client) - upload to Cloudinary
    let proofFileUrl = null;
    if (req.body.proofBase64) {
      // upload base64 data to Cloudinary
      const base64 = req.body.proofBase64;
      try {
        // Ensure Cloudinary is configured before upload
        configureCloudinary();
        
        // Cloudinary accepts data URI format directly
        // Store payment proof in secure cloud storage with tamper-evident metadata
        const timestamp = new Date().toISOString();
        const uploadRes = await cloudinary.uploader.upload(base64, {
          folder: 'arkad_mines/payment_proofs',
          resource_type: 'image',
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
          transformation: [
            { quality: 'auto:good' },
            { fetch_format: 'auto' }
          ],
          // Tamper-evident metadata: Store orderId and upload timestamp
          context: {
            orderId: orderId || 'unknown',
            uploadedAt: timestamp,
            uploadedBy: req.user?.id?.toString() || 'unknown'
          },
          // Add tags for better organization and security
          tags: ['payment_proof', 'secure', orderId || 'unknown']
        });
        proofFileUrl = uploadRes.secure_url;
      } catch (uploadErr) {
        // Log detailed error securely (for developers only)
        const clientIp = getClientIp(req);
        const userAgent = getUserAgent(req);
        
        logError(uploadErr, {
          action: 'CLOUDINARY_UPLOAD_ERROR',
          userId: req.user?.id || null,
          orderId: orderId,
          clientIp,
          details: `Error uploading payment proof to Cloudinary for order ${orderId}`
        });
        
        // Return generic error message to client (never expose internal errors)
        return res.status(500).json({ 
          success: false, 
          message: 'An error occurred while uploading your payment proof. Please try again.' 
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
      const clientIp = getClientIp(req);
      const userAgent = getUserAgent(req);
      
      await logAudit({
        userId: req.user?.id || null,
        role: normalizeRole(req.user?.role),
        action: 'PAYMENT_SUBMISSION_FAILED',
        status: 'FAILED_VALIDATION',
        resourceId: orderId,
        clientIp,
        userAgent,
        requestPayload: { orderId, amountPaid },
        details: `Order not found for payment submission: orderId=${orderId}`
      });

      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Server-side ownership validation: Ensure authenticated user owns the order
    const userId = req.user?.id;
    const buyerId = order.buyer ? (typeof order.buyer === 'object' ? order.buyer.toString() : String(order.buyer)) : null;
    
    if (!userId || !buyerId || buyerId !== userId.toString()) {
      const clientIp = getClientIp(req);
      const userAgent = getUserAgent(req);
      
      await logAudit({
        userId: userId || null,
        role: normalizeRole(req.user?.role),
        action: 'PAYMENT_OWNERSHIP_VALIDATION_FAILED',
        status: 'FAILED_AUTH',
        resourceId: orderId,
        clientIp,
        userAgent,
        requestPayload: { orderId, amountPaid },
        details: `Unauthorized payment attempt: User ${userId} attempted to submit payment for order ${order.orderNumber} owned by buyer ${buyerId}`
      });

      return res.status(403).json({
        success: false,
        message: "Unauthorized: You do not have permission to submit payment for this order"
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
    const numericAmount = roundToTwoDecimals(parseFloat(amountPaid));
    if (!isFinite(numericAmount)) {
      return res.status(400).json({ success: false, message: 'Invalid amountPaid value' });
    }

    // Round outstanding balance for comparison
    const roundedOutstandingBalance = roundToTwoDecimals(order.outstandingBalance);

    // Server-side validation: Check if amount paid exceeds outstanding balance (with small tolerance for floating-point precision)
    const FLOATING_POINT_TOLERANCE = 0.01; // Small tolerance for floating-point precision errors
    if (numericAmount > roundedOutstandingBalance + FLOATING_POINT_TOLERANCE) {
      const clientIp = getClientIp(req);
      const userAgent = getUserAgent(req);
      
      await logAudit({
        userId: userId,
        role: normalizeRole(req.user?.role),
        action: 'PAYMENT_AMOUNT_VALIDATION_FAILED',
        status: 'FAILED_VALIDATION',
        resourceId: orderId,
        clientIp,
        userAgent,
        requestPayload: { orderId, amountPaid: numericAmount, outstandingBalance: roundedOutstandingBalance },
        details: `Payment amount validation failed: Amount ${numericAmount.toFixed(2)} exceeds outstanding balance ${roundedOutstandingBalance.toFixed(2)} for order ${order.orderNumber}`
      });

      return res.status(400).json({
        success: false,
        message: `Amount paid (Rs ${numericAmount.toFixed(2)}) cannot exceed outstanding balance of Rs ${roundedOutstandingBalance.toFixed(2)}`
      });
    }

    // Add payment proof (store numeric amount and cloudinary URL)
    order.paymentProofs.push({
      proofFile: proofFileUrl,
      amountPaid: roundToTwoDecimals(numericAmount),
      status: "pending"
    });

    // Update payment timeline with proof file reference and numeric amount
    order.paymentTimeline.push({
      action: "payment_submitted",
      amountPaid: numericAmount,
      proofFile: proofFileUrl,
      notes: `Payment of Rs ${numericAmount.toFixed(2)} submitted for verification`
    });

    // Server-side logic: Update payment status to payment_in_progress if it was pending
    // NOTE: This is server-side logic only - clients cannot set paymentStatus directly (blocked by rejectClientPaymentStatus middleware)
    if (order.paymentStatus === "pending") {
      order.paymentStatus = "payment_in_progress";
    }
    
    // SECURITY: Do NOT calculate outstandingBalance or totalPaid here - these are calculated ONLY after admin approval

    await order.save();

    const clientIp = getClientIp(req);
    const userAgent = getUserAgent(req);

    // Immutable audit log for payment submission with all required fields
    await logAudit({
      userId: userId || null,
      role: normalizeRole(req.user?.role),
      action: 'PAYMENT_SUBMITTED',
      status: 'SUCCESS',
      resourceId: orderId,
      clientIp,
      userAgent,
      requestPayload: { 
        orderId, 
        orderNumber: order.orderNumber,
        amountPaid: numericAmount,
        proofFileUrl: proofFileUrl,
        timestamp: new Date().toISOString()
      },
      details: `Payment proof submitted: Rs ${numericAmount.toFixed(2)} for order ${order.orderNumber}, proofFile: ${proofFileUrl}${req.paymentAnomaly?.detected ? ` | Anomalies: ${req.paymentAnomaly.details.join('; ')}` : ''}`
    });

    // Generate signed URLs for payment proofs (access control)
    const orderWithSignedUrls = generateSignedUrlsForPaymentProofs(order);

    res.json({
      success: true,
      message: "Payment proof submitted successfully. Awaiting admin approval.",
      order: orderWithSignedUrls
    });

  } catch (error) {
    const clientIp = getClientIp(req);
    const userAgent = getUserAgent(req);

    await logAudit({
      userId: req.user?.id || null,
      role: normalizeRole(req.user?.role),
      action: 'PAYMENT_SUBMISSION_ERROR',
      status: 'ERROR',
      resourceId: req.params.orderId,
      clientIp,
      userAgent,
      requestPayload: { orderId: req.params.orderId, amountPaid: req.body?.amountPaid },
      details: `Error submitting payment proof: ${error.message}`
    });

    // Log detailed error securely (for developers only)
    logError(error, {
      action: 'PAYMENT_SUBMISSION_ERROR',
      userId: req.user?.id || null,
      orderId: req.params.orderId,
      clientIp,
      details: `Error submitting payment proof for order ${req.params.orderId}`
    });

    // Return generic error message to client (never expose internal errors, stack traces, or file paths)
    res.status(500).json({
      success: false,
      message: "An error occurred while processing your payment. Please try again."
    });
  }
};

// Approve payment by admin
// SECURITY: This endpoint is protected by authorizeRoles('admin') middleware (admin-only)
// - Calculates outstandingBalance and totalPaid server-side ONLY after admin approval
// - Updates paymentStatus to "fully_paid" ONLY if outstandingBalance <= 0 (server-side logic)
// - All payment state changes are validated on the server against business rules
const approvePayment = async (req, res) => {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const adminId = req.user.id;
  const adminRole = normalizeRole(req.user.role);
  
  try {
    const { orderId, proofIndex } = req.params;
    const { notes } = req.body;

    const order = await orderModel.findById(orderId);
    if (!order) {
      await logAudit({
        userId: adminId,
        role: adminRole,
        action: 'PAYMENT_APPROVAL_FAILED',
        status: 'FAILED_VALIDATION',
        resourceId: orderId,
        clientIp,
        userAgent,
        requestPayload: { orderId, proofIndex, notes },
        details: `Payment approval failed: Order not found for orderId=${orderId}, proofIndex=${proofIndex}`
      });

      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (!order.paymentProofs[proofIndex]) {
      await logAudit({
        userId: adminId,
        role: adminRole,
        action: 'PAYMENT_APPROVAL_FAILED',
        status: 'FAILED_VALIDATION',
        resourceId: orderId,
        clientIp,
        userAgent,
        requestPayload: { orderId, proofIndex, notes },
        details: `Payment approval failed: Payment proof not found for orderId=${orderId}, proofIndex=${proofIndex}`
      });

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

    // SECURITY: Server-side calculation of payment balances - ONLY done after admin approval
    // Round payment amount to 2 decimal places
    const roundedAmountPaid = roundToTwoDecimals(paymentProof.amountPaid);

    // Update totalPaid (round to 2 decimal places) - calculated server-side only
    order.totalPaid = roundToTwoDecimals(order.totalPaid + roundedAmountPaid);

    // Calculate outstanding balance (round to 2 decimal places) - calculated server-side only
    order.outstandingBalance = roundToTwoDecimals(order.financials.grandTotal - order.totalPaid);

    // Server-side logic: Update payment status if fully paid (validated against business rules)
    if (order.outstandingBalance <= 0) {
      order.paymentStatus = "fully_paid";

      // Auto-confirm order if payment is fully received and order is still in draft/pending
      if (order.status === "draft") {
        order.status = "confirmed";
        
        // Deduct stock for each item in the order (same logic as manual confirmation)
        if (order.items && order.items.length > 0) {
          // Populate items if not already populated
          await order.populate("items.stone");
          
          // Deduct stock for each item in the order
          for (const item of order.items) {
            // Get stone ID - handle both populated (object with _id) and unpopulated (ObjectId) cases
            const stoneId = item.stone?._id || item.stone;
            const stone = await stonesModel.findById(stoneId);
            if (stone) {
              const quantityToDeduct = item.quantity || 1;
              
              // Check if enough stock is available
              const remainingBeforeDeduct = stone.stockQuantity - (stone.quantityDelivered || 0);
              if (remainingBeforeDeduct < quantityToDeduct) {
                // Log warning but don't block confirmation (stock check should have been done earlier)
                console.warn(`Warning: Not enough stock available for ${stone.stoneName}. Need ${quantityToDeduct}, but only ${remainingBeforeDeduct} available.`);
              } else {
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
      amountPaid: roundedAmountPaid,
      notes: notes || `Payment of Rs ${roundedAmountPaid.toFixed(2)} approved by admin`
    });

    await order.save();

    // Log payment approval action with admin ID and timestamp
    const approvalTimestamp = new Date();
    await logAudit({
      userId: adminId,
      role: adminRole,
      action: 'PAYMENT_APPROVED',
      status: 'SUCCESS',
      resourceId: orderId,
      clientIp,
      userAgent,
      requestPayload: { 
        orderId, 
        orderNumber: order.orderNumber,
        proofIndex,
        amountPaid: roundedAmountPaid,
        approvedBy: adminId,
        approvedAt: approvalTimestamp.toISOString(),
        notes: notes || null
      },
      details: `Payment approved by admin ${adminId} at ${approvalTimestamp.toISOString()}: Order ${order.orderNumber}, Amount Rs ${roundedAmountPaid.toFixed(2)}, Proof Index ${proofIndex}`
    });

    // Generate signed URLs for payment proofs (access control)
    const orderWithSignedUrls = generateSignedUrlsForPaymentProofs(order);

    res.json({
      success: true,
      message: "Payment approved successfully",
      order: orderWithSignedUrls
    });

  } catch (error) {
    await logAudit({
      userId: adminId,
      role: adminRole,
      action: 'PAYMENT_APPROVAL_ERROR',
      status: 'ERROR',
      resourceId: req.params.orderId,
      clientIp,
      userAgent,
      requestPayload: { orderId: req.params.orderId, proofIndex: req.params.proofIndex },
      details: `Error approving payment: ${error.message}`
    });

    // Log detailed error securely (for developers only)
    logError(error, {
      action: 'PAYMENT_APPROVAL_ERROR',
      userId: adminId,
      orderId: req.params.orderId,
      proofIndex: req.params.proofIndex,
      clientIp,
      details: `Error approving payment for order ${req.params.orderId}, proofIndex ${req.params.proofIndex}`
    });

    // Return generic error message to client (never expose internal errors, stack traces, or file paths)
    res.status(500).json({
      success: false,
      message: "An error occurred while processing your payment approval. Please try again."
    });
  }
};

// Reject payment by admin
const rejectPayment = async (req, res) => {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const adminId = req.user.id;
  const adminRole = normalizeRole(req.user.role);
  
  try {
    const { orderId, proofIndex } = req.params;
    const { notes, rejectionReason } = req.body;

    const order = await orderModel.findById(orderId);
    if (!order) {
      await logAudit({
        userId: adminId,
        role: adminRole,
        action: 'PAYMENT_REJECTION_FAILED',
        status: 'FAILED_VALIDATION',
        resourceId: orderId,
        clientIp,
        userAgent,
        requestPayload: { orderId, proofIndex, notes, rejectionReason },
        details: `Payment rejection failed: Order not found for orderId=${orderId}, proofIndex=${proofIndex}`
      });

      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (!order.paymentProofs[proofIndex]) {
      await logAudit({
        userId: adminId,
        role: adminRole,
        action: 'PAYMENT_REJECTION_FAILED',
        status: 'FAILED_VALIDATION',
        resourceId: orderId,
        clientIp,
        userAgent,
        requestPayload: { orderId, proofIndex, notes, rejectionReason },
        details: `Payment rejection failed: Payment proof not found for orderId=${orderId}, proofIndex=${proofIndex}`
      });

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

    // Log payment rejection action with admin ID and timestamp
    const rejectionTimestamp = new Date();
    await logAudit({
      userId: adminId,
      role: adminRole,
      action: 'PAYMENT_REJECTED',
      status: 'SUCCESS',
      resourceId: orderId,
      clientIp,
      userAgent,
      requestPayload: { 
        orderId, 
        orderNumber: order.orderNumber,
        proofIndex,
        amountPaid: paymentProof.amountPaid,
        rejectedBy: adminId,
        rejectedAt: rejectionTimestamp.toISOString(),
        rejectionReason: rejectionReason || notes || null
      },
      details: `Payment rejected by admin ${adminId} at ${rejectionTimestamp.toISOString()}: Order ${order.orderNumber}, Amount Rs ${paymentProof.amountPaid.toFixed(2)}, Proof Index ${proofIndex}, Reason: ${rejectionReason || notes || 'N/A'}`
    });

    // Generate signed URLs for payment proofs (access control)
    const orderWithSignedUrls = generateSignedUrlsForPaymentProofs(order);

    res.json({
      success: true,
      message: "Payment rejected successfully",
      order: orderWithSignedUrls
    });

  } catch (error) {
    await logAudit({
      userId: adminId,
      role: adminRole,
      action: 'PAYMENT_REJECTION_ERROR',
      status: 'ERROR',
      resourceId: req.params.orderId,
      clientIp,
      userAgent,
      requestPayload: { orderId: req.params.orderId, proofIndex: req.params.proofIndex },
      details: `Error rejecting payment: ${error.message}`
    });

    // Log detailed error securely (for developers only)
    logError(error, {
      action: 'PAYMENT_REJECTION_ERROR',
      userId: adminId,
      orderId: req.params.orderId,
      proofIndex: req.params.proofIndex,
      clientIp,
      details: `Error rejecting payment for order ${req.params.orderId}, proofIndex ${req.params.proofIndex}`
    });

    // Return generic error message to client (never expose internal errors, stack traces, or file paths)
    res.status(500).json({
      success: false,
      message: "An error occurred while processing your payment rejection. Please try again."
    });
  }
};

// Get order details with all payment information (for both client and admin)
const getOrderDetailsWithPayment = async (req, res) => {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const userId = req.user?.id;
  
  try {
    const { orderId } = req.params;
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

    // Generate signed, expiring URLs for payment proofs (access control)
    const orderWithSignedUrls = generateSignedUrlsForPaymentProofs(order);

    res.json({
      success: true,
      order: orderWithSignedUrls
    });

  } catch (error) {
    // Log detailed error securely (for developers only)
    logError(error, {
      action: 'GET_ORDER_DETAILS_WITH_PAYMENT_ERROR',
      userId: userId || null,
      orderId: req.params.orderId,
      clientIp,
      details: `Error fetching order details with payment for order ${req.params.orderId}`
    });

    // Return generic error message to client (never expose internal errors, stack traces, or file paths)
    res.status(500).json({
      success: false,
      message: "An error occurred while retrieving your order. Please try again."
    });
  }
};

// Update payment status by admin
// SECURITY: This endpoint is protected by authorizeRoles('admin') middleware (admin-only)
// - Allows admins to manually update payment status for administrative purposes
// - All state changes are validated on the server against business rules
// - NOTE: For normal payment flow, use approvePayment/rejectPayment endpoints which calculate balances correctly
const updatePaymentStatus = async (req, res) => {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const adminId = req.user?.id;
  
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
    // Log detailed error securely (for developers only)
    logError(error, {
      action: 'UPDATE_PAYMENT_STATUS_ERROR',
      userId: adminId || null,
      orderId: req.params.orderId,
      clientIp,
      details: `Error updating payment status for order ${req.params.orderId}`
    });

    // Return generic error message to client (never expose internal errors, stack traces, or file paths)
    res.status(500).json({
      success: false,
      message: "An error occurred while processing your payment status update. Please try again."
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