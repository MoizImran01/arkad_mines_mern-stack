import axios from 'axios';

const PRICING_API_URL = process.env.PRICING_API_URL || 'https://arkad-pricing-api.onrender.com';
const PRICING_TIMEOUT_MS = Number(process.env.PRICING_TIMEOUT_MS) || 70000;
const PRICING_MAX_RETRIES = Number(process.env.PRICING_MAX_RETRIES) || 2;
const PRICING_RETRY_DELAY_MS = Number(process.env.PRICING_RETRY_DELAY_MS) || 1500;
const PRICING_POST_OPTIONS = {
    timeout: PRICING_TIMEOUT_MS,
    validateStatus: (s) => s >= 200 && s < 300,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const isRetryableError = (error) => {
    if (!error) return false;
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' ||
        error.code === 'EAI_AGAIN') {
        return true;
    }
    const status = error.response?.status;
    if (status === 502 || status === 504) return true;
    if (status === 503 && !error.response?.data) return true;
    return false;
};

const postWithRetry = async (path, body) => {
    let lastError;
    for (let attempt = 0; attempt <= PRICING_MAX_RETRIES; attempt++) {
        try {
            return await axios.post(`${PRICING_API_URL}${path}`, body, PRICING_POST_OPTIONS); // NOSONAR
        } catch (error) {
            lastError = error;
            if (attempt < PRICING_MAX_RETRIES && isRetryableError(error)) {
                console.warn(`Pricing request failed (attempt ${attempt + 1}/${PRICING_MAX_RETRIES + 1}): ${error.message}. Retrying...`);
                await sleep(PRICING_RETRY_DELAY_MS * (attempt + 1));
                continue;
            }
            throw error;
        }
    }
    throw lastError;
};

const handlePricingError = (res, error) => {
    console.error("Pricing Microservice Error:", error.message);
    if (error.response?.status === 503 && error.response?.data) {
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
        const response = await postWithRetry('/api/predict-price', req.body);
        res.status(200).json(response.data);
    } catch (error) {
        handlePricingError(res, error);
    }
};

export const getBatchPriceSuggestions = async (req, res) => {
    try {
        const response = await postWithRetry('/api/predict-prices', req.body);
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

export const warmUpPricingService = () => {
    axios.get(`${PRICING_API_URL}/api/health`, { timeout: 60000 })
        .then(() => console.log('Pricing microservice warmed up.'))
        .catch((err) => console.warn('Pricing warm-up failed (will retry on demand):', err.message));
};
