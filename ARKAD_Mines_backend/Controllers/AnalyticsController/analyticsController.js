import orderModel from "../../Models/orderModel/orderModel.js";
import quotationModel from "../../Models/quotationModel/quotationModel.js";
import stonesModel from "../../Models/stonesModel/stonesModel.js";
import userModel from "../../Models/Users/userModel.js";
import { logAudit, logError, getClientIp, normalizeRole, getUserAgent } from "../../logger/auditLogger.js";
import { analyticsDTO } from "../../Utils/DTOs/analyticsDTO.js";
import { getCachedAnalytics, setCachedAnalytics, generateCacheKey } from "../../Utils/analyticsCache.js";

// Helper function to round to 2 decimal places
const roundToTwoDecimals = (value) => {
  return Math.round((value || 0) * 100) / 100;
};

export const getAnalytics = async (req, res) => {
  const queryStartTime = Date.now();
  
  if (!req.verifiedAdminRole) {
    await logAudit({
      userId: req.user?.id || null,
      role: normalizeRole(req.user?.role),
      action: 'ANALYTICS_UNAUTHORIZED_ACCESS',
      status: 'FAILED_AUTH',
      resourceId: 'analytics-dashboard',
      clientIp: getClientIp(req),
      userAgent: getUserAgent(req),
      details: 'Controller-level authorization check failed: Admin role not verified'
    });

    return res.status(403).json({
      success: false,
      message: "Access denied: Admin privileges required"
    });
  }

  try {
    const cacheKey = generateCacheKey(req);
    const cached = getCachedAnalytics(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: cached,
        cached: true
      });
    }

    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Number.parseInt(req.query.limit, 10) || 100;
    const skip = (page - 1) * limit;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12);

    // 1. Top Clients by Purchase Value
    const adminUserId = req.user?.id;
    if (!adminUserId) {
      return res.status(403).json({
        success: false,
        message: "Access denied: Admin authentication required"
      });
    }

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

    const dataCategories = [
      'summary',
      'topClients',
      'mostSoldStones',
      'monthlySales',
      'orderStatusDistribution',
      'quotationStatusDistribution',
      'categorySales',
      'paymentStatusOverview',
      'weeklySalesPattern',
      'stockStatus'
    ];

    await logAudit({
      userId: req.user?.id || null,
      role: normalizeRole(req.user?.role),
      action: 'ANALYTICS_ACCESS',
      status: 'SUCCESS',
      resourceId: 'analytics-dashboard',
      clientIp: getClientIp(req),
      userAgent: getUserAgent(req),
      requestPayload: {
        method: req.method,
        path: req.path,
        dataCategoriesAccessed: dataCategories,
        queryParams: req.query
      },
      details: `Analytics dashboard accessed. Data categories: ${dataCategories.join(', ')}`
    });

    const rawData = {
      summary: {
        totalOrders,
        totalQuotations,
        totalCustomers,
        totalStones,
        totalRevenue,
        forecastedRevenue,
        pendingPayments,
        conversionRate: Number.parseFloat(conversionRate),
        orderGrowth: Number.parseFloat(orderGrowth)
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
    };

    const sanitizedData = analyticsDTO(rawData);
    setCachedAnalytics(cacheKey, sanitizedData);

    const queryTime = Date.now() - queryStartTime;
    if (queryTime > 5000) {
      await logAudit({
        userId: req.user?.id || null,
        role: normalizeRole(req.user?.role),
        action: 'ANALYTICS_SLOW_QUERY',
        status: 'WARNING',
        resourceId: 'analytics-dashboard',
        clientIp: getClientIp(req),
        userAgent: getUserAgent(req),
        details: `Slow analytics query detected: ${queryTime}ms`
      });
    }

    res.status(200).json({
      success: true,
      data: sanitizedData,
      pagination: {
        page,
        limit,
        hasMore: false
      },
      queryTime: `${queryTime}ms`
    });
  } catch (error) {
    logError(error, { action: 'ANALYTICS_ACCESS', userId: req.user?.id });
    
    await logAudit({
      userId: req.user?.id || null,
      role: normalizeRole(req.user?.role),
      action: 'ANALYTICS_ACCESS',
      status: 'ERROR',
      resourceId: 'analytics-dashboard',
      clientIp: getClientIp(req),
      userAgent: getUserAgent(req),
      details: `Error accessing analytics: ${error.message}`
    });
    
    res.status(500).json({
      success: false,
      message: "Error fetching analytics data",
      error: error.message
    });
  }
};

export const exportAnalyticsPDF = async (req, res) => {
  if (!req.verifiedAdminRole) {
    await logAudit({
      userId: req.user?.id || null,
      role: normalizeRole(req.user?.role),
      action: 'ANALYTICS_PDF_EXPORT_UNAUTHORIZED',
      status: 'FAILED_AUTH',
      resourceId: 'analytics-dashboard',
      clientIp: getClientIp(req),
      userAgent: getUserAgent(req),
      details: 'PDF export unauthorized: Admin role not verified'
    });

    return res.status(403).json({
      success: false,
      message: "Access denied: Admin privileges required"
    });
  }

  try {
    const clientIp = getClientIp(req);
    const userAgent = getUserAgent(req);
    const adminId = req.user?.id;
    
    const isHTTPS = req.secure || 
                    req.headers['x-forwarded-proto'] === 'https' || 
                    req.headers['x-forwarded-proto'] === 'https, http';
    
    if (process.env.NODE_ENV === 'production' && !isHTTPS) {
      await logAudit({
        userId: adminId,
        role: normalizeRole(req.user?.role),
        action: 'ANALYTICS_PDF_EXPORT',
        status: 'FAILED_VALIDATION',
        resourceId: 'analytics-dashboard',
        clientIp,
        userAgent,
        details: `PDF export blocked: HTTPS required`
      });
      
      return res.status(403).json({
        success: false,
        message: "Secure channel (HTTPS) required for analytics exports"
      });
    }
    
    await logAudit({
      userId: adminId,
      role: normalizeRole(req.user?.role),
      action: 'ANALYTICS_PDF_EXPORT',
      status: 'SUCCESS',
      resourceId: 'analytics-dashboard',
      clientIp,
      userAgent,
      requestPayload: {
        method: req.method,
        path: req.path,
        exportType: 'PDF',
        timestamp: new Date().toISOString(),
        secureChannel: isHTTPS
      },
      details: `Analytics PDF export initiated by admin ${adminId} via ${isHTTPS ? 'HTTPS' : 'HTTP'}`
    });

    res.status(200).json({
      success: true,
      message: "PDF export logged. Export functionality handled client-side."
    });
  } catch (error) {
    logError(error, { action: 'ANALYTICS_PDF_EXPORT', userId: req.user?.id });
    
    await logAudit({
      userId: req.user?.id || null,
      role: normalizeRole(req.user?.role),
      action: 'ANALYTICS_PDF_EXPORT',
      status: 'ERROR',
      resourceId: 'analytics-dashboard',
      clientIp: getClientIp(req),
      userAgent: getUserAgent(req),
      details: `Error logging PDF export: ${error.message}`
    });
    
    res.status(500).json({
      success: false,
      message: "Error logging PDF export"
    });
  }
};

