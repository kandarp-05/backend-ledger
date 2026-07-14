const userModel = require("../models/user.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const emailService = require("../services/email.service");
const redisClient = require("../config/redis");
/**
 *
 * 1. destructuring object
 * 2. Check whether email already exist
 * 3. If no,Create new user
 * 4. Generate token with user._id
 * 5. Save token in cookies
 */

async function registerUser(req, res) {
  const { email, name, password } = req.body;
  const isExists = await userModel.findOne({ email: email });
  if (isExists) {
    return res.status(422).json({
      message: "User with this Email already exists",
      success: false,
    });
  }
  try {
    const user = await userModel.create({
      email,
      name,
      password,
    });
    res.status(201).json({
      message: "User registered successfully",
      success: true,
    });
    await emailService.sendRegistrationEmail(user.email, user.name);
  } catch (error) {
    res.status(500).json({ success:false,message: error.message, success: false });
  }
}

/**
 *
 * 1. Destructuring object
 * 2. Check whether email already exist or not
 * 3. If yes,Verify password
 * 4. Generate jti and store it in redis then token with user._id
 * 5. Save token in cookies
 */

async function loginUser(req, res) {
  const { email, password } = req.body;
  try {
    const user = await userModel.findOne({ email }).select("+password +systemUser");
    if (!user) {
      return res.status(401).json({
        message: "Email or password is invalid",
        success: false,
      });
    }
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        message: "Email or Password is invalid",
        success: false,
      });
    }
    const jti = uuidv4();
    await redisClient.hSet(`session:${jti}`, {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.systemUser?"System":"User"
    });
    await redisClient.expire(`session:${jti}`, 60 * 60 * 24 * 3);
    const token = jwt.sign({ id: user._id, jti }, process.env["JWT_SECRET"], {
      expiresIn: "3d",
    });
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      maxAge: 3 * 24 * 60 * 60 * 1000,
    });
    res.status(200).json({
      message: "User successfully logged in",
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      }
    });
  } catch (error) {
    res.status(401).json({ message: error.message, success: false });
  }
}
async function fetchUser(req, res) {
  
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({
      message: "Please Login to access",
      success: false,
    });
  }
  let decoded;
  try {
    decoded = jwt.verify(token, process.env["JWT_SECRET"])
  } catch (error) {
     return res.status(401).json({
        success:false,
        message:"Invalid token"
    });
  }
  

  const session = await redisClient.hGetAll(`session:${decoded.jti}`);

  if (Object.keys(session).length === 0) {
    return res.status(401).json({
      success: false,
      message: "Session expired. Please login again.",
    });
  }

  res.status(200).json({
    message: "User is authorized",
    success: true,
    user: {
      name: session.name,
      email: session.email,
    },
  });
}

async function logoutUser(req, res) {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(400).json({
      message: "User logged out successfully",
      success: true,
    });
  }

  const decoded = jwt.verify(token, process.env["JWT_SECRET"]);
  await redisClient.del(`session:${decoded.jti}`);
  res.clearCookie("token");

  res.status(200).json({
    message: "User logged out successfully",
    success: true,
  });
}

/**
 * 1.Verify user by email
 * 2. Generate & Save reset token
 * 3. Send email with reset link localhost:8000/api:reset_token
 *
 */
async function forgotPassword(req, res) {
  const { email } = req.body;
  const user = await userModel.findOne({ email });
  if (!user) {
    return res.status(200).json({
      message: "If user Exist, reset link is sent",
      success:true
    });
  }
  const resetToken = jwt.sign({ id: user._id }, process.env["JWT_SECRET"], {
    expiresIn: "15m",
  });
  const resetLink = `http://localhost:5173/reset-password/${resetToken}`;
  await emailService.sendForgotPasswordEmail(email, user.name, resetLink);
  res.status(200).json({
    message: "Reset link is sent",
    success:true
  });
}

/**
 * 1. fetch token
 * 2. Verify token
 * 3. fetch user with the help of token.id
 * 4. Update password
 * 5. Save
 */
async function resetPassword(req, res) {
  const { token } = req.params;
  if (!token) {
    return res.status(401).json({
      message: "Token is expired, Please try again",
      success:false
    });
  }
  const decoded = await jwt.verify(token, process.env["JWT_SECRET"]);
  const user = await userModel.findById(decoded.id);
  if (!user) {
    return res.status(404).json({
        success:false,
        message:"User not found"
    });
}
  const { password } = req.body;
  user.password = password;
  await user.save();
  res.status(200).json({
    message: "Password changed Successfully",
    success:true
  });
}

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  forgotPassword,
  resetPassword,
  fetchUser,
};
