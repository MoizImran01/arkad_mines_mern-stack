import { detectAnomalies } from "./anomalyDetection.js";

// Wraps detectAnomalies with analytics context (resourceId, actionPrefix).
export const detectAnalyticsAnomalies = async (req, res, next) => {
  req.analyticsAnomalyContext = {
    resourceId: 'analytics-dashboard',
    actionPrefix: 'ANALYTICS'
  };
  await detectAnomalies(req, res, next);
};
