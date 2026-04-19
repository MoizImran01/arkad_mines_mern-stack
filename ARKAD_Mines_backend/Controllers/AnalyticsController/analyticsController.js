import orderModel from "../../Models/orderModel/orderModel.js";
import quotationModel from "../../Models/quotationModel/quotationModel.js";
import stonesModel from "../../Models/stonesModel/stonesModel.js";
import userModel from "../../Models/Users/userModel.js";
import { logAudit, logError, getClientIp, normalizeRole, getUserAgent } from "../../logger/auditLogger.js";
import { analyticsDTO } from "../../Utils/DTOs/analyticsDTO.js";
import { getCachedAnalytics, setCachedAnalytics, generateCacheKey } from "../../Utils/analyticsCache.js";

const roundToTwoDecimals = (value) => {
  return Math.round((value || 0) * 100) / 100;
};

/** Aggregates dashboard analytics (clients, stones, trends, revenue, conversion, etc.); cached. */
const auditBase = (req) => ({
  userId: req.user?.id || null,
  role: normalizeRole(req.user?.role),
  resourceId: 'analytics-dashboard',
  clientIp: getClientIp(req),
  userAgent: getUserAgent(req),
});

export const getAnalytics = async (req, res) => {
  const queryStartTime = Date.now();
  
  if (!req.verifiedAdminRole) {
    await logAudit({
      ...auditBase(req),
      action: 'ANALYTICS_UNAUTHORIZED_ACCESS',
      status: 'FAILED_AUTH',
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
    const dateRange = { $gte: startDate, $lte: endDate };
    const activeStatusMatch = { status: { $in: ["confirmed", "processing", "shipped", "delivered"] }, createdAt: dateRange };
    const dateOnlyMatch = { createdAt: dateRange };

    const adminUserId = req.user?.id;
    if (!adminUserId) {
      return res.status(403).json({
        success: false,
        message: "Access denied: Admin authentication required"
      });
    }

    const topClients = await orderModel.aggregate([
      { $match: activeStatusMatch },
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

    const mostSoldStones = await orderModel.aggregate([
      { $match: activeStatusMatch },
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

    const monthlySales = await orderModel.aggregate([
      { $match: activeStatusMatch },
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

    const orderStatusDistribution = await orderModel.aggregate([
      { $match: dateOnlyMatch },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    const quotationStatusDistribution = await quotationModel.aggregate([
      { $match: dateOnlyMatch },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    const categorySales = await orderModel.aggregate([
      { $match: activeStatusMatch },
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

    const paymentStatusOverview = await orderModel.aggregate([
      { $match: dateOnlyMatch },
      {
        $group: {
          _id: "$paymentStatus",
          count: { $sum: 1 },
          totalAmount: { $sum: "$financials.grandTotal" }
        }
      }
    ]);

    const totalOrders = await orderModel.countDocuments(dateOnlyMatch);
    const totalQuotations = await quotationModel.countDocuments(dateOnlyMatch);

    const totalCustomers = await userModel.countDocuments({ role: "customer" });

    const totalStones = await stonesModel.countDocuments();

    const actualRevenueAggregation = await orderModel.aggregate([
      { $match: { status: { $in: ["confirmed", "dispatched", "delivered"] }, paymentStatus: "fully_paid", createdAt: dateRange } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$financials.grandTotal" }
        }
      }
    ]);

    const totalRevenue = roundToTwoDecimals(actualRevenueAggregation[0]?.totalRevenue || 0);

    const forecastedRevenueAggregation = await orderModel.aggregate([
      { $match: { status: { $in: ["confirmed", "dispatched", "delivered"] }, createdAt: dateRange } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$financials.grandTotal" }
        }
      }
    ]);

    const forecastedRevenue = roundToTwoDecimals(forecastedRevenueAggregation[0]?.totalRevenue || 0);

    const pendingRevenueAggregation = await orderModel.aggregate([
      { $match: dateOnlyMatch },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$outstandingBalance" }
        }
      }
    ]);

    const pendingPayments = roundToTwoDecimals(pendingRevenueAggregation[0]?.totalRevenue || 0);

    const approvedQuotations = await quotationModel.countDocuments({ status: "approved", createdAt: dateRange });
    const submittedQuotations = await quotationModel.countDocuments({ status: { $ne: "draft" }, createdAt: dateRange });

    const conversionRate = submittedQuotations > 0 
      ? ((approvedQuotations / submittedQuotations) * 100).toFixed(2) 
      : 0;

    const weeklySalesPattern = await orderModel.aggregate([
      { $match: activeStatusMatch },
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
            $arrayElemAt: [
              ["Unknown", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
              "$_id"
            ]
          },
          totalSales: 1,
          orderCount: 1
        }
      }
    ]);

    const stockStatus = await stonesModel.aggregate([
      {
        $group: {
          _id: "$stockAvailability",
          count: { $sum: 1 }
        }
      }
    ]);

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

    const roundField = (arr, field) => arr.map(item => ({ ...item, [field]: roundToTwoDecimals(item[field] || 0) }));
    const roundedTopClients = roundField(topClients, 'totalPurchases');
    const roundedMostSoldStones = roundField(mostSoldStones, 'totalRevenue');
    const roundedMonthlySales = roundField(monthlySales, 'totalSales');
    const roundedCategorySales = roundField(categorySales, 'totalRevenue');
    const roundedPaymentStatusOverview = roundField(paymentStatusOverview, 'totalAmount');
    const roundedWeeklySalesPattern = roundField(weeklySalesPattern, 'totalSales');

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
      ...auditBase(req),
      action: 'ANALYTICS_ACCESS',
      status: 'SUCCESS',
      requestPayload: { method: req.method, path: req.path, dataCategoriesAccessed: dataCategories, queryParams: req.query },
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
      await logAudit({ ...auditBase(req), action: 'ANALYTICS_SLOW_QUERY', status: 'WARNING', details: `Slow analytics query detected: ${queryTime}ms` });
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
    
    await logAudit({ ...auditBase(req), action: 'ANALYTICS_ACCESS', status: 'ERROR', details: `Error accessing analytics: ${error.message}` });
    
    res.status(500).json({
      success: false,
      message: "Error fetching analytics data",
      error: error.message
    });
  }
};

export const exportAnalyticsPDF = async (req, res) => {
  if (!req.verifiedAdminRole) {
    await logAudit({ ...auditBase(req), action: 'ANALYTICS_PDF_EXPORT_UNAUTHORIZED', status: 'FAILED_AUTH', details: 'PDF export unauthorized: Admin role not verified' });

    return res.status(403).json({
      success: false,
      message: "Access denied: Admin privileges required"
    });
  }

  try {
    const adminId = req.user?.id;
    
    const isHTTPS = req.secure || 
                    req.headers['x-forwarded-proto'] === 'https' || 
                    req.headers['x-forwarded-proto'] === 'https, http';
    
    if (process.env.NODE_ENV === 'production' && !isHTTPS) {
      await logAudit({ ...auditBase(req), action: 'ANALYTICS_PDF_EXPORT', status: 'FAILED_VALIDATION', details: `PDF export blocked: HTTPS required` });
      
      return res.status(403).json({
        success: false,
        message: "Secure channel (HTTPS) required for analytics exports"
      });
    }
    
    await logAudit({
      ...auditBase(req),
      action: 'ANALYTICS_PDF_EXPORT',
      status: 'SUCCESS',
      requestPayload: { method: req.method, path: req.path, exportType: 'PDF', timestamp: new Date().toISOString(), secureChannel: isHTTPS },
      details: `Analytics PDF export initiated by admin ${adminId} via ${isHTTPS ? 'HTTPS' : 'HTTP'}`
    });

    res.status(200).json({
      success: true,
      message: "PDF export logged. Export functionality handled client-side."
    });
  } catch (error) {
    logError(error, { action: 'ANALYTICS_PDF_EXPORT', userId: req.user?.id });
    
    await logAudit({ ...auditBase(req), action: 'ANALYTICS_PDF_EXPORT', status: 'ERROR', details: `Error logging PDF export: ${error.message}` });
    
    res.status(500).json({
      success: false,
      message: "Error logging PDF export"
    });
  }
};

