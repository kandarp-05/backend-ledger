const userModel = require("../models/user.model");
const jwt = require("jsonwebtoken");
const redisClient = require("../config/redis");
async function authMiddleware(req, res, next) {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Token missing.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const session = await redisClient.hGetAll(`session:${decoded.jti}`);

    if (Object.keys(session).length === 0) {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please login again.",
      });
    }

    req.user = {
      _id: session.userId,
      email: session.email,
      name: session.name,
    };

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
}

async function authSystemMiddleware(req, res, next) {
  try {
    const decoded = req.user;
    if (decoded.role!=="System") {
      return res.status(403).json({
        message: "Forbidden access, not a system user",
        success:false
      });
    }
    return next();
  } catch (error) {
    return res.status(401).json({
      message: "Unauthorized access, token is invalid",
      success:false
    });
  }
}

module.exports = { authMiddleware, authSystemMiddleware };
