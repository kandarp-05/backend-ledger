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
  const {
    fromAccount,
    toAccount,
    amount,
    idempotencyKey,
    transactionPassword,
  } = req.body;
  if (
    !fromAccount ||
    !toAccount ||
    !amount ||
    !idempotencyKey ||
    !transactionPassword
  ) {
    return res.status(400).json({
      success: false,
      message:
        "FromAccount, toAccount, amount, transactionPassword and idempotencyKey are required",
    });
  }
  const isValidToAccount = await accountModel
    .findOne({ _id: toAccount, user: req.user._id })
  const isValidFromAccount = await accountModel.findOne({ _id: fromAccount }).select("+transactionPassword");;
  if (!isValidToAccount || !isValidFromAccount) {
    return res.status(400).json({
      message: "Invalid fromAccount or toAccount",
      success: false,
    });
  }
  const isCorrect =
    await isValidFromAccount.compareTransactionPassword(transactionPassword);

  if (!isCorrect) {
    return res.status(401).json({
      success: false,
      message: "Invalid transaction password",
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
        success: true,
      });
    }
    if (isTransactionAlreadyExists.status === "PENDING") {
      return res.status(200).json({
        message: "Transaction is still in process",
        success: false,
      });
    }
    if (isTransactionAlreadyExists.status === "FAILED") {
      return res.status(500).json({
        message: "Transaction processing failed, please try again",
        success: false,
      });
    }
    if (isTransactionAlreadyExists.status === "REVERSED") {
      return res.status(500).json({
        message: "Transaction is already reversed, please try again",
        success: false,
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
      success: false,
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
      success: false,
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
    await session.endSession();
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    return res.status(400).json({
      message:
        "Transaction is pending due to some issue, please try after sometime",
      success: false,
    });
  }
  /**
   * 10. Send email notification
   */
  await emailService.sendTransactionEmail(
    req.user.email,
    req.user.name,
    amount,
    toAccount,
  );
  transaction = await transactionModel.findById(transaction._id);

  return res.status(201).json({
    message: "Transaction completed successfully",
    transaction: transaction,
    success: true,
  });
}

async function createInitialFundsTransaction(req, res) {
  const { toAccount, amount, idempotencyKey, transactionPassword } = req.body;
  if (!toAccount || !amount || !idempotencyKey || !transactionPassword) {
    return res.status(400).json({
      message:
        "ToAccount, amount, transactionPassword and idempotencyKey are required",
      success: false,
    });
  }
  const isValidToAccount = await accountModel.findOne({ _id: toAccount });
  if (!isValidToAccount) {
    return res.status(400).json({
      message: "Invalid toAccount",
      success: false,
    });
  }
  if (isValidToAccount.status !== "ACTIVE") {
    return res.status(400).json({
      message: "toAccount must be ACTIVE to process transaction",
      success: false,
    });
  }

  const fromAccount = await accountModel
    .findOne({
      user: req.user._id,
    })
    .select("+transactionPassword");
  if (!fromAccount) {
    return res.status(400).json({
      message: "System user account not found",
    });
  }
  const isCorrect =
    await fromAccount.compareTransactionPassword(transactionPassword);
  if (!isCorrect) {
    return res.status(401).json({
      success: false,
      message: "Invalid transaction password",
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
        success: true,
      });
    }
    if (isTransactionAlreadyExists.status === "PENDING") {
      return res.status(200).json({
        message: "Transaction is still in process",
        success: false,
      });
    }
    if (isTransactionAlreadyExists.status === "FAILED") {
      return res.status(500).json({
        message: "Transaction processing failed, please try again",
        success: false,
      });
    }
    if (isTransactionAlreadyExists.status === "REVERSED") {
      return res.status(500).json({
        message: "Transaction is already reversed, please try again",
        success: false,
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
    await transactionModel.findOneAndUpdate(
      { _id: transaction._id },
      { status: "COMPLETED" },
      { session },
    );

    await session.commitTransaction();
    await session.endSession();
    transaction = await transactionModel.findById(transaction._id);
  } catch (error) {
    return res.status(400).json({
      message:
        "Transaction is pending due to some issue, please try after sometime",
      success: false,
    });
  }
  return res.status(201).json({
    message: "Initial funds transaction completed successfully",
    transaction: transaction,
    success: true,
  });
}

async function getTransactions(req, res) {
  try {
    const { accountId } = req.query;

    const accounts = await accountModel.find({
      user: req.user._id,
    });

    if (accounts.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No accounts found",
        transactions: [],
      });
    }

    const accountIds = accounts.map((account) => account._id);

    let filter = {
      $or: [
        { fromAccount: { $in: accountIds } },
        { toAccount: { $in: accountIds } },
      ],
    };

    if (accountId) {
      const isOwner = accountIds.some((id) => id.equals(accountId));

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to access this account.",
        });
      }

      filter = {
        $or: [{ fromAccount: accountId }, { toAccount: accountId }],
      };
    }

    const transactions = await transactionModel
      .find(filter)
      .populate("fromAccount", "accountNumber currency")
      .populate("toAccount", "accountNumber currency")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Transactions fetched successfully",
      transactions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = { createTransaction, createInitialFundsTransaction, getTransactions };
