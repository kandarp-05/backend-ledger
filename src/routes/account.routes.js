const express=require("express")
const accountController=require("../controllers/account.controller")
const router=express.Router();
const authMiddleware=require("../middleware/auth.middleware")

router.post("/create-account",authMiddleware.authMiddleware,accountController.createAccount);
router.get("/",authMiddleware.authMiddleware,accountController.getUserAccounts)
router.get("/:accountId",authMiddleware.authMiddleware,accountController.getUserAccount)
router.get("/balance/:accountId", authMiddleware.authMiddleware, accountController.getAccountBalance)
router.post("/forgot-transaction-password",authMiddleware.authMiddleware,accountController.forgotTransactionPassword)
router.post("/reset-transaction-password/:token",authMiddleware.authMiddleware,accountController.resetTransactionPassword);
router.post("/change-transaction-password",authMiddleware.authMiddleware,accountController.changePassword);


module.exports=router