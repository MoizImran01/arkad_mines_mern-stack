import express from "express";
import cors from "cors";
import dotenv from "dotenv"; 
import { connectDB } from "./config/db.js";
import userRouter from "./Routes/userRouter.js";

dotenv.config({ path: './config.env' });

const app = express();
const port = 4000;

app.use(express.json());
app.use(cors());


connectDB();
app.use("/api/user", userRouter);

app.get("/", (req, res) => {
    res.send("API Working");
});

app.listen(port, () => {
    console.log(`Server running on port: ${port}`);
});
