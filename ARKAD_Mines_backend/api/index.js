const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { connectDB } = require("../config/db.js");
const userRouter = require("../Routes/userRouter.js");

dotenv.config({ path: './config.env' });

const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());
app.use(cors());

connectDB();
app.use("/api/user", userRouter);

app.get("/", (req, res) => {
    res.send("API Working");
});

module.exports = app;