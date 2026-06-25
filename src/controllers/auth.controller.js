const userModel = require("../models/user.model");
const jwt = require("jsonwebtoken");
const bcrypt=require("bcryptjs");
const emailService=require("../services/email.service")
const tokenBlackListModel= require("../models/blackList.model")

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
  const isExists =await userModel.findOne({ email:email });
  if (isExists) {
    return res.status(422).json({
      message: "User with this Email already exists",
      status:"failed"
    });
  }
  try {
    const user = await userModel.create({
      email,
      name,
      password,
    });
    const token = await jwt.sign({ id: user._id }, process.env["JWT_SECRET"],{expiresIn:"3d"});
    res.cookie("token", token);
    res.status(201).json({
      message: "User registered successfully",
      user:{
        id:user._id,
        email:user.email,
        name:user.name
      },
      token
    });
    await emailService.sendRegistrationEmail(user.email,user.name)
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
}

/**
 * 
 * 1. Destructuring object 
 * 2. Check whether email already exist or not
 * 3. If yes,Verify password
 * 4. Generate token with user._id
 * 5. Save token in cookies
 */


async function loginUser(req, res) {
  const { email, password } = req.body;
  try {
    const user = await userModel.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({
        message: "Email or password is invalid",
      });
    }
    const isValidPassword = await user.comparePassword(password);
    if(!isValidPassword){
        return res.status(401).json({
            message:"Email or Password is invalid"
        })
    }
    const token = await jwt.sign({ id: user._id }, process.env["JWT_SECRET"]);
    res.cookie("token", token);
    res.status(200).json({
      message: "User successfully logged in",
      user:{
        id:user._id,
        email:user.email,
        name:user.name
      },
      token
    });
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
}

async function logoutUser(req,res){
  const token=req.cookies.token || req.headers.authorization?.split(" ")[1];

  if(!token){
    return res.status(400).json({
      message:"User logged out successfully"
    })
  }
  res.cookie("token","");
  await tokenBlackListModel.create({
    token:token
  })
  res.status(200).json({
    message:"User logged out successfully"
  })
}

module.exports = { registerUser, loginUser, logoutUser };
