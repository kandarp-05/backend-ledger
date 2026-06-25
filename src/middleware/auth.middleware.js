const userModel = require("../models/user.model");
const jwt = require("jsonwebtoken");
const tokenBlackListModel=require("../models/blackList.model")


async function authMiddleware(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({
      message: "Unauthorized access, token is missing",
    });
  }
  const isTokenBlacklisted=await tokenBlackListModel.findOne({token:token});
  if(isTokenBlacklisted){
    return res.status(401).json({
      message:"Unauthorized, token is invalid"
    })
  }
  try {
    const decoded = jwt.verify(token, process.env["JWT_SECRET"]);
    const user = await userModel.findById(decoded.id);
    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({
      message: "Unauthorized access, token is invalid",
    });
  }
}

async function authSystemMiddleware(req,res,next) {
  const token=req.cookies.token;
  if (!token) {
    return res.status(401).json({
      message: "Unauthorized access, token is missing",
    });
  }
  const isTokenBlacklisted=await tokenBlackListModel.findOne({token:token});
  if(isTokenBlacklisted){
    return res.status(401).json({
      message:"Unauthorized, token is invalid"
    })
  }
  try {
    const decoded = jwt.verify(token, process.env["JWT_SECRET"]);
    const user = await userModel.findById(decoded.id).select("+systemUser");
    if (!user.systemUser){
      return res.status(403).json({
        message:"Forbidden access, not a system user"
      })
    }
    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({
      message: "Unauthorized access, token is invalid",
    });
  }
  
}

module.exports={authMiddleware,authSystemMiddleware};
