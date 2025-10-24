import express from "express";
import cors from "cors";
import dotenv from "dotenv"; 
import { connectDB } from "../config/db.js";
import userRouter from "../Routes/UserRoutes/userRouter.js";
import adminRouter from "../Routes/AdminRoutes/AdminRouter.js";

//load environment variables from config file
dotenv.config({ path: './config.env' });
const app = express();
const port = 4000;

//middleware to parse JSON request bodies
app.use(express.json());
//enable CORS for cross-origin requests (from the front end)
app.use(cors());


//connect to MongoDB database
connectDB();
//mount user routes at /api/user endpoint
app.use("/api/user", userRouter);
app.use("/api",adminRouter);
//basic check route to verify API is running
app.get("/", (req, res) => {
    res.send("API Working");
});

//start the server and listen on specified port
app.listen(port, () => {
    console.log(`Server running on port: ${port}`);
});