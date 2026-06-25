const express=require("express")
const accountController=require("../controllers/account.controller")
const router=express.Router();
const authMiddleware=require("../middleware/auth.middleware")

router.post("/",authMiddleware.authMiddleware,accountController.createAccount);

router.get("/",authMiddleware.authMiddleware,accountController.getUserAccounts)

router.get("/balance/:accountId", authMiddleware.authMiddleware, accountController.getAccountBalance)

module.exports=router