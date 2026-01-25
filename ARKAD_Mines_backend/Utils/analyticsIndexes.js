import orderModel from "../Models/orderModel/orderModel.js";
import quotationModel from "../Models/quotationModel/quotationModel.js";

export const ensureAnalyticsIndexes = async () => {
  try {
    await orderModel.collection.createIndex({ buyer: 1, status: 1, createdAt: -1 });
    await orderModel.collection.createIndex({ status: 1, createdAt: -1 });
    await orderModel.collection.createIndex({ "items.stone": 1, createdAt: -1 });
    await quotationModel.collection.createIndex({ status: 1, createdAt: -1 });
    await quotationModel.collection.createIndex({ buyer: 1, status: 1, createdAt: -1 });
    console.log("[ANALYTICS INDEXES] Created indexes for analytics queries");
  } catch (error) {
    console.error("[ANALYTICS INDEXES] Error creating indexes:", error.message);
  }
};
