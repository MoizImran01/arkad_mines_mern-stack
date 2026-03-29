import axios from 'axios';

export const getAIForecast = async (req, res) => {
    const FORECAST_API_URL = process.env.FORECASTING_API_URL || 'https://arkad-forecasting-api.onrender.com/api/forecast';
    const FORECAST_TIMEOUT_MS = Number(process.env.FORECAST_TIMEOUT_MS) || 15000;
    try {
        const response = await axios.get(FORECAST_API_URL, {
            timeout: FORECAST_TIMEOUT_MS,
            validateStatus: (s) => s >= 200 && s < 300
        });
        const payload = response.data;
        const data = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.data)
                ? payload.data
                : [];

        res.status(200).json({
            success: true,
            count: Array.isArray(data) ? data.length : 0,
            forecasts: Array.isArray(data) ? data : []
        });
    } catch (error) {
        console.error("AI Microservice Error:", error.message);
        console.error("AI Microservice URL:", FORECAST_API_URL);
        if (error.response) {
            console.error("AI Microservice status:", error.response.status);
            console.error("AI Microservice body:", error.response.data);
        }
        res.status(500).json({ success: false, message: "Forecasting engine offline." });
    }
};