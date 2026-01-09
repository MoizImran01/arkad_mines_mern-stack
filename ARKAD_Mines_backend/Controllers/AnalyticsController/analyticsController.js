import orderModel from "../../Models/orderModel/orderModel.js";
import quotationModel from "../../Models/quotationModel/quotationModel.js";
import stonesModel from "../../Models/stonesModel/stonesModel.js";
import userModel from "../../Models/Users/userModel.js";

// Helper function to round to 2 decimal places
const roundToTwoDecimals = (value) => {
  return Math.round((value || 0) * 100) / 100;
};

export const getAnalytics = async (req, res) => {
  try {
    // Get date range (default: last 12 months)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12);

    // 1. Top Clients by Purchase Value
    const topClients = await orderModel.aggregate([
      {
        $match: {
          status: { $in: ["confirmed", "processing", "shipped", "delivered"] },
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: "$buyer",
          totalPurchases: { $sum: "$financials.grandTotal" },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { totalPurchases: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "buyerInfo"
        }
      },
      { $unwind: "$buyerInfo" },
      {
        $project: {
          _id: 1,
          companyName: "$buyerInfo.companyName",
          email: "$buyerInfo.email",
          totalPurchases: 1,
          orderCount: 1
        }
      }
    ]);

    // 2. Most Sold Stones
    const mostSoldStones = await orderModel.aggregate([
      {
        $match: {
          status: { $in: ["confirmed", "processing", "shipped", "delivered"] },
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.stone",
          stoneName: { $first: "$items.stoneName" },
          totalQuantity: { $sum: "$items.quantity" },
          totalRevenue: { $sum: "$items.totalPrice" },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 }
    ]);

    // 3. Monthly Sales Trend
    const monthlySales = await orderModel.aggregate([
      {
        $match: {
          status: { $in: ["confirmed", "processing", "shipped", "delivered"] },
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          totalSales: { $sum: "$financials.grandTotal" },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
      {
        $project: {
          _id: 0,
          month: {
            $concat: [
              { $toString: "$_id.year" },
              "-",
              {
                $cond: [
                  { $lt: ["$_id.month", 10] },
                  { $concat: ["0", { $toString: "$_id.month" }] },
                  { $toString: "$_id.month" }
                ]
              }
            ]
          },
          totalSales: 1,
          orderCount: 1
        }
      }
    ]);

    // 4. Order Status Distribution
    const orderStatusDistribution = await orderModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    // 5. Quotation Status Distribution
    const quotationStatusDistribution = await quotationModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    // 6. Category-wise Sales
    const categorySales = await orderModel.aggregate([
      {
        $match: {
          status: { $in: ["confirmed", "processing", "shipped", "delivered"] },
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "stones",
          localField: "items.stone",
          foreignField: "_id",
          as: "stoneInfo"
        }
      },
      { $unwind: { path: "$stoneInfo", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$stoneInfo.category",
          totalRevenue: { $sum: "$items.totalPrice" },
          totalQuantity: { $sum: "$items.quantity" }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    // 7. Payment Status Overview
    const paymentStatusOverview = await orderModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: "$paymentStatus",
          count: { $sum: 1 },
          totalAmount: { $sum: "$financials.grandTotal" }
        }
      }
    ]);

    // 8. Summary Statistics
    const totalOrders = await orderModel.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate }
    });

    const totalQuotations = await quotationModel.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate }
    });

    const totalCustomers = await userModel.countDocuments({ role: "customer" });

    const totalStones = await stonesModel.countDocuments();

    // Actual Revenue - Only from FULLY PAID orders
    const actualRevenueAggregation = await orderModel.aggregate([
      {
        $match: {
          status: { $in: ["confirmed", "dispatched", "delivered"] },
          paymentStatus: "fully_paid",
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$financials.grandTotal" }
        }
      }
    ]);

    const totalRevenue = roundToTwoDecimals(actualRevenueAggregation[0]?.totalRevenue || 0);

    // Forecasted Revenue - From ALL confirmed/dispatched/delivered orders (regardless of payment)
    const forecastedRevenueAggregation = await orderModel.aggregate([
      {
        $match: {
          status: { $in: ["confirmed", "dispatched", "delivered"] },
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$financials.grandTotal" }
        }
      }
    ]);

    const forecastedRevenue = roundToTwoDecimals(forecastedRevenueAggregation[0]?.totalRevenue || 0);

    // Pending Revenue - Sum of outstanding balance from all orders
    const pendingRevenueAggregation = await orderModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$outstandingBalance" }
        }
      }
    ]);

    const pendingPayments = roundToTwoDecimals(pendingRevenueAggregation[0]?.totalRevenue || 0);

    // 9. Conversion Rate (Quotations to Orders)
    const approvedQuotations = await quotationModel.countDocuments({
      status: "approved",
      createdAt: { $gte: startDate, $lte: endDate }
    });

    const submittedQuotations = await quotationModel.countDocuments({
      status: { $ne: "draft" },
      createdAt: { $gte: startDate, $lte: endDate }
    });

    const conversionRate = submittedQuotations > 0 
      ? ((approvedQuotations / submittedQuotations) * 100).toFixed(2) 
      : 0;

    // 10. Weekly Sales Pattern (Day of Week)
    const weeklySalesPattern = await orderModel.aggregate([
      {
        $match: {
          status: { $in: ["confirmed", "processing", "shipped", "delivered"] },
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $dayOfWeek: "$createdAt" },
          totalSales: { $sum: "$financials.grandTotal" },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          day: {
            $switch: {
              branches: [
                { case: { $eq: ["$_id", 1] }, then: "Sun" },
                { case: { $eq: ["$_id", 2] }, then: "Mon" },
                { case: { $eq: ["$_id", 3] }, then: "Tue" },
                { case: { $eq: ["$_id", 4] }, then: "Wed" },
                { case: { $eq: ["$_id", 5] }, then: "Thu" },
                { case: { $eq: ["$_id", 6] }, then: "Fri" },
                { case: { $eq: ["$_id", 7] }, then: "Sat" }
              ],
              default: "Unknown"
            }
          },
          totalSales: 1,
          orderCount: 1
        }
      }
    ]);

    // 11. Stock Status Overview
    const stockStatus = await stonesModel.aggregate([
      {
        $group: {
          _id: "$stockAvailability",
          count: { $sum: 1 }
        }
      }
    ]);

    // 12. Recent Activity (last 30 days vs previous 30 days comparison)
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    const previous30Days = new Date();
    previous30Days.setDate(previous30Days.getDate() - 60);

    const recentOrdersCount = await orderModel.countDocuments({
      createdAt: { $gte: last30Days }
    });

    const previousOrdersCount = await orderModel.countDocuments({
      createdAt: { $gte: previous30Days, $lt: last30Days }
    });

    const orderGrowth = previousOrdersCount > 0 
      ? (((recentOrdersCount - previousOrdersCount) / previousOrdersCount) * 100).toFixed(2)
      : recentOrdersCount > 0 ? 100 : 0;

    // Round all revenue values in the response
    const roundedTopClients = topClients.map(client => ({
      ...client,
      totalPurchases: roundToTwoDecimals(client.totalPurchases || 0)
    }));

    const roundedMostSoldStones = mostSoldStones.map(stone => ({
      ...stone,
      totalRevenue: roundToTwoDecimals(stone.totalRevenue || 0)
    }));

    const roundedMonthlySales = monthlySales.map(sale => ({
      ...sale,
      totalSales: roundToTwoDecimals(sale.totalSales || 0)
    }));

    const roundedCategorySales = categorySales.map(category => ({
      ...category,
      totalRevenue: roundToTwoDecimals(category.totalRevenue || 0)
    }));

    const roundedPaymentStatusOverview = paymentStatusOverview.map(payment => ({
      ...payment,
      totalAmount: roundToTwoDecimals(payment.totalAmount || 0)
    }));

    const roundedWeeklySalesPattern = weeklySalesPattern.map(week => ({
      ...week,
      totalSales: roundToTwoDecimals(week.totalSales || 0)
    }));

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalOrders,
          totalQuotations,
          totalCustomers,
          totalStones,
          totalRevenue,
          forecastedRevenue,
          pendingPayments,
          conversionRate: parseFloat(conversionRate),
          orderGrowth: parseFloat(orderGrowth)
        },
        topClients: roundedTopClients,
        mostSoldStones: roundedMostSoldStones,
        monthlySales: roundedMonthlySales,
        orderStatusDistribution,
        quotationStatusDistribution,
        categorySales: roundedCategorySales,
        paymentStatusOverview: roundedPaymentStatusOverview,
        weeklySalesPattern: roundedWeeklySalesPattern,
        stockStatus
      }
    });
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching analytics data",
      error: error.message
    });
  }
};

