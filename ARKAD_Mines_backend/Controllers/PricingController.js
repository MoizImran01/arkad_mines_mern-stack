import axios from 'axios';

/**
 * POST /api/pricing/predict-price
 * Proxy single-item pricing prediction to the ML microservice.
 * Body: { stoneName, category, subcategory, grade, priceUnit, requestedQuantity, priceSnapshot }
 */
export const getPriceSuggestion = async (req, res) => {
    const PRICING_API_URL = process.env.PRICING_API_URL || 'http://localhost:5001';
    const PRICING_TIMEOUT_MS = Number(process.env.PRICING_TIMEOUT_MS) || 15000;
    try {
        const response = await axios.post(
            `${PRICING_API_URL}/api/predict-price`,
            req.body,
            {
                timeout: PRICING_TIMEOUT_MS,
                validateStatus: (s) => s >= 200 && s < 300,
            }
        );
        res.status(200).json(response.data);
    } catch (error) {
        console.error("Pricing Microservice Error:", error.message);
        if (error.response?.status === 503) {
            return res.status(503).json({
                success: false,
                message: "Pricing model not trained yet. Need more issued quotation data.",
            });
        }
        res.status(500).json({
            success: false,
            message: "Pricing suggestion service unavailable.",
        });
    }
};

/**
 * POST /api/pricing/predict-prices
 * Proxy batch pricing prediction for all items in a quotation.
 * Body: { items: [{ stoneName, category, subcategory, grade, priceUnit, requestedQuantity, priceSnapshot }] }
 */
export const getBatchPriceSuggestions = async (req, res) => {
    const PRICING_API_URL = process.env.PRICING_API_URL || 'http://localhost:5001';
    const PRICING_TIMEOUT_MS = Number(process.env.PRICING_TIMEOUT_MS) || 15000;
    try {
        const response = await axios.post(
            `${PRICING_API_URL}/api/predict-prices`,
            req.body,
            {
                timeout: PRICING_TIMEOUT_MS,
                validateStatus: (s) => s >= 200 && s < 300,
            }
        );
        res.status(200).json(response.data);
    } catch (error) {
        console.error("Pricing Microservice Error:", error.message);
        if (error.response?.status === 503) {
            return res.status(503).json({
                success: false,
                message: "Pricing model not trained yet. Need more issued quotation data.",
            });
        }
        res.status(500).json({
            success: false,
            message: "Pricing suggestion service unavailable.",
        });
    }
};

/**
 * GET /api/pricing/health
 * Check health of the pricing microservice.
 */
export const getPricingHealth = async (req, res) => {
    const PRICING_API_URL = process.env.PRICING_API_URL || 'http://localhost:5001';
    try {
        const response = await axios.get(
            `${PRICING_API_URL}/api/health`,
            { timeout: 5000 }
        );
        res.status(200).json({ success: true, ...response.data });
    } catch (error) {
        res.status(503).json({
            success: false,
            message: "Pricing service offline.",
        });
    }
};
