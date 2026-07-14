const express = require("express");
const transactionController = require("../controllers/transaction.controller");
const authMiddleware = require("../middleware/auth.middleware");
const transactionRoutes = express.Router();

transactionRoutes.post(
  "/",
  authMiddleware.authMiddleware,
  transactionController.createTransaction,
);
transactionRoutes.get(
  "/",
  authMiddleware.authMiddleware,
  transactionController.getTransactions
);

transactionRoutes.post(
  "/system/initial-funds",
  authMiddleware.authMiddleware,
  authMiddleware.authSystemMiddleware,
  transactionController.createInitialFundsTransaction,
);
module.exports = transactionRoutes;
