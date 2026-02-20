// In your Express controllers/inventoryController.js
import axios from 'axios';

export const getAIForecast = async (req, res) => {
    try {
        // Call the FastAPI microservice running locally
        const response = await axios.get('https://nonethereally-pushiest-coleman.ngrok-free.dev/api/forecast');
        
        // Return the clean data to React
       res.status(200).json({
            success: true,
            count: response.data.data.length,
            forecasts: response.data.data
        });
    } catch (error) {
        console.error("AI Microservice Error:", error);
        res.status(500).json({ success: false, message: "Forecasting engine offline." });
    }
};