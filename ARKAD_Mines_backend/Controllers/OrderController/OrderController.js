import orderModel from "../../Models/orderModel/orderModel.js";
import stonesModel from "../../Models/stonesModel/stonesModel.js";

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
    const orders = await orderModel.find(query).sort({ createdAt: -1 });

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

    // Handle confirmed status - deduct stock
    if (status === "confirmed") {
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

export { getOrderDetails, getUserOrders, getAllOrders, updateOrderStatus };