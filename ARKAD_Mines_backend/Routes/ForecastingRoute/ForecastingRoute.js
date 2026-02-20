import express from "express"
import { getAIForecast } from "../../Controllers/InventoryController.js"

const forecastingRouter = express.Router();

forecastingRouter.get("/forecast", getAIForecast);

export default forecastingRouter;