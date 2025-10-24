import express from "express"
import { loginUser, registerUser } from "../../Controllers/UserController/userController.js"

//create express router for organizing user-related routes
const userRouter = express.Router()

//handle POST requests to /api/user/register - creates new user accounts
userRouter.post ("/register", registerUser)
//handle POST requests to /api/user/login - authenticates existing users
userRouter.post("/login", loginUser)

//export the router so it can be mounted in the main application
export default userRouter;