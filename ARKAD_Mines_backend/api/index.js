import express from "express";
import cors from "cors";
import dotenv from "dotenv"; 
import { connectDB } from "../config/db.js";
import userRouter from "../Routes/userRouter.js";

//load environment variables from config file
dotenv.config({ path: './config.env' });
const app = express();


//middleware to parse JSON request bodies
app.use(express.json());
//enable CORS for cross-origin requests (from the front end)
app.use(cors());


//connect to MongoDB database
await connectDB();
//mount user routes at /api/user endpoint
app.use("/api/user", userRouter);

//basic check route to verify API is running
app.get("/", (req, res) => {
    res.send("API Working");
});

//start the server and listen on specified port
