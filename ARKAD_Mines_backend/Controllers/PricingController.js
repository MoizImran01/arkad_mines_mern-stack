import axios from 'axios';

const PRICING_API_URL = process.env.PRICING_API_URL || 'http://localhost:5001';
const PRICING_TIMEOUT_MS = Number(process.env.PRICING_TIMEOUT_MS) || 15000;

const proxyPricingRequest = async (req, res, endpoint) => {
    try {
        const response = await axios.post(
            `${PRICING_API_URL}${endpoint}`,
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
    proxyPricingRequest(req, res, '/api/predict-price');

export const getBatchPriceSuggestions = (req, res) =>
    proxyPricingRequest(req, res, '/api/predict-prices');

export const getPricingHealth = async (req, res) => {
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
