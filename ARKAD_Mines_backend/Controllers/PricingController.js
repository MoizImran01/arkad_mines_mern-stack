import axios from 'axios';

const PRICING_API_URL = process.env.PRICING_API_URL || 'http://localhost:5001';
const PRICING_TIMEOUT_MS = Number(process.env.PRICING_TIMEOUT_MS) || 15000;

const ALLOWED_ENDPOINTS = {
    single: `${PRICING_API_URL}/api/predict-price`,
    batch: `${PRICING_API_URL}/api/predict-prices`,
    health: `${PRICING_API_URL}/api/health`,
};

const proxyPricingPost = async (req, res, resolvedUrl) => {
    try {
        const response = await axios.post(
            resolvedUrl,
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

export const getPriceSuggestion = (req, res) =>
    proxyPricingPost(req, res, ALLOWED_ENDPOINTS.single);

export const getBatchPriceSuggestions = (req, res) =>
    proxyPricingPost(req, res, ALLOWED_ENDPOINTS.batch);

export const getPricingHealth = async (req, res) => {
    try {
        const response = await axios.get(
            ALLOWED_ENDPOINTS.health,
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
