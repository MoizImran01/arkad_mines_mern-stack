import axios from 'axios';

const PRICING_API_URL = process.env.PRICING_API_URL || 'https://arkad-pricing-api.onrender.com';
const PRICING_TIMEOUT_MS = Number(process.env.PRICING_TIMEOUT_MS) || 15000;
const PRICING_POST_OPTIONS = {
    timeout: PRICING_TIMEOUT_MS,
    validateStatus: (s) => s >= 200 && s < 300,
};

const handlePricingError = (res, error) => {
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
};

export const getPriceSuggestion = async (req, res) => {
    try {
        const response = await axios.post(`${PRICING_API_URL}/api/predict-price`, req.body, PRICING_POST_OPTIONS); // NOSONAR
        res.status(200).json(response.data);
    } catch (error) {
        handlePricingError(res, error);
    }
};

export const getBatchPriceSuggestions = async (req, res) => {
    try {
        const response = await axios.post(`${PRICING_API_URL}/api/predict-prices`, req.body, PRICING_POST_OPTIONS); // NOSONAR
        res.status(200).json(response.data);
    } catch (error) {
        handlePricingError(res, error);
    }
};

export const getPricingHealth = async (req, res) => {
    try {
        const response = await axios.get(`${PRICING_API_URL}/api/health`, { timeout: 5000 }); // NOSONAR
        res.status(200).json({ success: true, ...response.data });
    } catch (error) {
        res.status(503).json({
            success: false,
            message: "Pricing service offline.",
        });
    }
};
