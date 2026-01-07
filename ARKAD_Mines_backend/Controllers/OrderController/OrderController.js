import orderModel from "../../Models/orderModel/orderModel.js";

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
    const { status, courierService, trackingNumber, courierLink, notes } = req.body;

    const validStatuses = ["draft", "confirmed", "dispatched", "delivered", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`
      });
    }

    const order = await orderModel.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    order.status = status;

    //add courier tracking info if order status is dispatched
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