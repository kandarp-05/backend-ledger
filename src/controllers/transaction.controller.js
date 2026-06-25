const accountModel = require("../models/account.model");
const transactionModel = require("../models/transaction.model");
const emailService = require("../services/email.service");
const mongoose = require("mongoose");
const ledgerModel = require("../models/ledger.model");

/**
 * - Create a new transaction
 * THE 10-STEP TRANSFER FLOW:
 *    * 1. Validate request
 *    * 2. Validate idempotency key
 *    * 3. Check account status
 *    * 4. Derive sender balance from ledger
 *    * 5. Create transaction (PENDING)
 *    * 6. Create DEBIT ledger entry
 *    * 7. Create CREDIT ledger entry
 *    * 8. Mark transaction COMPLETED
 *    * 9. Commit MongoDB session
 *    * 10. Send email notification
 */

async function createTransaction(req, res) {
  /**
   * 1. Validate request
   */
  const { fromAccount, toAccount, amount, idempotencyKey } = req.body;
  if (!fromAccount || !toAccount || !amount || !idempotencyKey) {
    return res.status(400).json({
      message: "FromAccount, toAccount, amount and idempotencyKey are required",
    });
  }
  const isValidToAccount = await accountModel.findOne({ _id: toAccount });
  const isValidFromAccount = await accountModel.findOne({ _id: fromAccount });
  if (!isValidToAccount || !isValidFromAccount) {
    return res.status(400).json({
      message: "Invalid fromAccount or toAccount",
    });
  }
  /**
   * 2. Validate idempotency Key
   */
  const isTransactionAlreadyExists = await transactionModel.findOne({
    idempotencyKey,
  });
  if (isTransactionAlreadyExists) {
    if (isTransactionAlreadyExists.status === "COMPLETED") {
      return res.status(200).json({
        message: "Transaction already processed",
        transaction: isTransactionAlreadyExists,
      });
    }
    if (isTransactionAlreadyExists.status === "PENDING") {
      return res.status(200).json({
        message: "Transaction is still in process",
      });
    }
    if (isTransactionAlreadyExists.status === "FAILED") {
      return res.status(500).json({
        message: "Transaction processing failed, please try again",
      });
    }
    if (isTransactionAlreadyExists.status === "REVERSED") {
      return res.status(500).json({
        message: "Transaction is already reversed, please try again",
      });
    }
  }
  /**
   * 3. Check account status
   */
  if (
    isValidFromAccount.status !== "ACTIVE" ||
    isValidToAccount.status !== "ACTIVE"
  ) {
    return res.status(400).json({
      message:
        "Both fromAccount and toAccount must be ACTIVE to process transaction",
    });
  }
  /**
   * 4. Derive sender balance from ledger
   */
  const balance = await isValidFromAccount.getBalance();
  if (balance < amount) {
    return res.status(400).json({
      message: `Insufficient balance. Current balance is ${balance}.
        Requested amount is ${amount}`,
    });
  }
  /**
   * 5. Create transaction (PENDING)
   */
  let transaction;
  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    transaction = (
      await transactionModel.create(
        [
          {
            fromAccount,
            toAccount,
            amount,
            status: "PENDING",
            idempotencyKey,
          },
        ],
        { session },
      )
    )[0];
    const debitLedgerEntry = await ledgerModel.create(
      [
        {
          account: fromAccount,
          amount,
          type: "DEBIT",
          transaction: transaction._id,
        },
      ],
      { session },
    );
    await (() => {
      return new Promise((resolve) => setTimeout(resolve, 20 * 1000));
    })();
    const creditLedgerEntry = await ledgerModel.create(
      [
        {
          account: toAccount,
          amount: amount,
          type: "CREDIT",
          transaction: transaction._id,
        },
      ],
      { session },
    );
    await transactionModel.findOneAndUpdate(
      { _id: transaction._id },
      { status: "COMPLETED" },
      { session },
    );
    /**
     * Commit MongoDB session
     */
    await session.commitTransaction();
    session.endSession();
  } catch (error) {
    return res.status(400).json({
      message: "Transaction is pending due to some issue, please try after sometime"
    });
  }
  /**
   * 10. Send email notification
   */
  emailService.sendTransactionEmail(
    req.user.email,
    req.user.name,
    amount,
    toAccount,
  );

  return res.status(201).json({
    message: "Transaction completed successfully",
    transaction: transaction,
  });
}

async function createInitialFundsTransaction(req, res) {
  const { toAccount, amount, idempotencyKey } = req.body;
  if (!toAccount || !amount || !idempotencyKey) {
    return res.status(400).json({
      message: "ToAccount, amount and idempotencyKey are required",
    });
  }
  const isValidToAccount = await accountModel.findOne({ _id: toAccount });
  if (!isValidToAccount) {
    return res.status(400).json({
      message: "Invalid toAccount",
    });
  }
  if (isValidToAccount.status !== "ACTIVE") {
    return res.status(400).json({
      message: "toAccount must be ACTIVE to process transaction",
    });
  }

  const fromAccount = await accountModel.findOne({
    user: req.user._id,
  });
  if (!fromAccount) {
    return res.status(400).json({
      message: "System user account not found",
    });
  }
  const isTransactionAlreadyExists = await transactionModel.findOne({
    idempotencyKey,
  });
  if (isTransactionAlreadyExists) {
    if (isTransactionAlreadyExists.status === "COMPLETED") {
      return res.status(200).json({
        message: "Transaction already processed",
        transaction: isTransactionAlreadyExists,
      });
    }
    if (isTransactionAlreadyExists.status === "PENDING") {
      return res.status(200).json({
        message: "Transaction is still in process",
      });
    }
    if (isTransactionAlreadyExists.status === "FAILED") {
      return res.status(500).json({
        message: "Transaction processing failed, please try again",
      });
    }
    if (isTransactionAlreadyExists.status === "REVERSED") {
      return res.status(500).json({
        message: "Transaction is already reversed, please try again",
      });
    }
  }
  let transaction;
  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    transaction = (
      await transactionModel.create(
        [
          {
            fromAccount,
            toAccount,
            amount,
            status: "PENDING",
            idempotencyKey,
          },
        ],
        { session },
      )
    )[0];
    const debitLedgerEntry = await ledgerModel.create(
      [
        {
          account: fromAccount._id,
          amount,
          type: "DEBIT",
          transaction: transaction._id,
        },
      ],
      { session },
    );

    const creditLedgerEntry = await ledgerModel.create(
      [
        {
          account: toAccount,
          amount: amount,
          type: "CREDIT",
          transaction: transaction._id,
        },
      ],
      { session },
    );
    transactionModel.findOneAndUpdate(
      { _id: transaction._id },
      { status: "COMPLETED" },
      { session },
    );

    await session.commitTransaction();
    session.endSession();
  } catch (error) {
    return res.status(400).json({
      message: "Transaction is pending due to some issue, please try after sometime"
    });
  }
  return res.status(201).json({
    message: "Initial funds transaction completed successfully",
    transaction: transaction,
  });
}

module.exports = { createTransaction, createInitialFundsTransaction };
