import jwt from "jsonwebtoken";

//middleware to verify JWT token from authorization header
//this protects routes by ensuring only authenticated users can access them
export const verifyToken = (req, res, next) => {
  //get the authorization header from the request
  const authHeader = req.headers.authorization;
  //if no authorization header present, return 401 Unauthorized
  if (!authHeader)
    return res.status(401).json({ message: "No token provided" });

  //extract the token from "Bearer <token>" format
  //split by space and take the second part (the actual token)
  const token = authHeader.split(" ")[1];
  try {
    //verify the token using the JWT secret key
    //if valid, decoded will contain the payload we signed (id and role)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    //attach the decoded user data to the request object for use in next middleware/routes
    req.user = decoded; 
    //move to the next middleware or route handler
    next();
  } catch (err) {
    //if token verification fails (expired, invalid signature, etc.)
    res.status(403).json({ message: "Invalid or expired token" });
  }
};

//middleware factory that creates role-based authorization middleware
//takes any number of allowed roles and returns a middleware function
export const authorizeRoles = (...allowedRoles) => {
  //return the actual middleware function that checks user roles
  return (req, res, next) => {
    //check if the current user's role is included in the allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      //if user role not allowed, return 403 Forbidden
      return res.status(403).json({ message: "Access denied" });
    }
    //if role is allowed, proceed to next middleware/route
    next();
  };
};