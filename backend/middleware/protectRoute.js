import User from "../models/user.model.js";
import jwt from "jsonwebtoken";

export const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies.jwt; // 1. Get token from cookies
    if (!token) return res.status(401).json({ error: "Unauthorized: No token" });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET); // 2. Verify token
    } catch (err) {
      return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
    }

    // 3. Fetch user from DB
    req.user = await User.findById(decoded.userId).select("-password");

    if (!req.user) return res.status(404).json({ error: "User not found" });

    next(); // 4. Proceed to next middleware/route
  } catch (error) {
    console.error("Error in protectRoute:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
