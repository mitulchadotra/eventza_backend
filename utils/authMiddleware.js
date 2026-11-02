import jwt from "jsonwebtoken";
import secretKey from "../jwtConfig.js";
import User from "../model/user.js";

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status: 0,
        message: "Authorization token missing. Please provide Bearer token.",
      });
    }

    const token = authHeader.slice(7).trim();

    const decoded = jwt.verify(token, secretKey);

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        status: 0,
        message: "User not found.",
      });
    }

    req.user = user;

    return next();
  } catch (error) {
    console.error("Authentication error:", error.message);

    return res.status(401).json({
      status: 0,
      message:
        error.name === "TokenExpiredError"
          ? "Token expired. Please login again."
          : "Invalid or unauthorized token.",
    });
  }
};

export default authMiddleware;