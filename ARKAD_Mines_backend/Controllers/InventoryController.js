import axios from 'axios';

const FORECAST_API_URL = process.env.FORECASTING_API_URL || 'https://nonethereally-pushiest-coleman.ngrok-free.dev/api/forecast';
const FORECAST_TIMEOUT_MS = Number(process.env.FORECAST_TIMEOUT_MS) || 15000;

export const getAIForecast = async (req, res) => {
    try {
        const response = await axios.get(FORECAST_API_URL, {
            timeout: FORECAST_TIMEOUT_MS,
            validateStatus: (s) => s >= 200 && s < 300
        });
        const data = response.data?.data || [];
        res.status(200).json({
            success: true,
            count: Array.isArray(data) ? data.length : 0,
            forecasts: Array.isArray(data) ? data : []
        });
    } catch (error) {
        console.error("AI Microservice Error:", error.message);
        res.status(500).json({ success: false, message: "Forecasting engine offline." });
    }
};