import express from "express"
import { loginUser, registerUser } from "../../Controllers/UserController/userController.js"

const userRouter = express.Router()

//handle POST requests to /api/user/register - creates new user accounts
userRouter.post ("/register", registerUser)
//handle POST requests to /api/user/login - authenticates existing users
userRouter.post("/login", loginUser)


export default userRouter;