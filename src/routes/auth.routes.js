const express=require("express");
const authController=require("../controllers/auth.controller")
const router= express.Router();

router.get("/me",authController.fetchUser);
router.post("/register",authController.registerUser);
router.post("/login",authController.loginUser);
router.post("/logout",authController.logoutUser);
router.post("/reset-password/:token",authController.resetPassword);
router.post("/forgot-password",authController.forgotPassword);

module.exports=router;