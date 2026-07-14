const accountModel=require("../models/account.model");
const userModel = require("../models/user.model");

async function createAccount(req,res) {
    const user=req.user;
    const account= await accountModel.create({
        user:user._id,
        currency: req.body?.currency,
        transactionPassword:req.body.transactionPassword
    })
    res.status(201).json({
        message:"Account created successfully",
        succes:true,
        account: {
            accountId:account._id,
            status:account.status,
            currency:account.currency,
            user_id:user._id
    }
    })
    
}

async function getUserAccounts(req,res){
    const accounts= await accountModel.find({user: req.user._id});
    if (accounts.legth===0){
        return res.status(200).json({
            success:false,
            message:"User have no account yet"
        })
    }
    res.status(200).json({
        success:true,
        message:"Accounts fetched successfuly",
        accounts
    })

}

async function getAccountBalance(req,res){
    const {accountId} = req.params;
    const isValidUser= await accountModel.findOne({
        user: req.user._id,
        _id:accountId
    })
    if(!isValidUser){
        return res.status(404).json({
            message: "Account not found",
            success:false
        })
    }
    const balance=await isValidUser.getBalance();
    res.status(200).json({
        accountId: isValidUser._id,
        balance:balance,
        success:true
    })
}

async function forgotTransactionPassword(req,res) {
  const {accountId}=req.body;
  const email=req.user.email;
  const isValidAccount= await accountModel.findOne({
        user: req.user._id,
        _id:accountId
    })
    if(!isValidAccount){
        return res.status(404).json({
            message: "Email or Account not found",
            success:false
        })
    }
  const resetToken=jwt.sign({id:isValidAccount._id},process.env['JWT_SECRET'],{ expiresIn: "15m" });
  res.cookie("transactionToken",resetToken);
  const resetLink = `http://localhost:5173/reset-transaction-password/${resetToken}`;
  await emailService.sendForgotTransactionPasswordEmail(email,req.user.name,resetLink);
  res.status(200).json({
    message:"Reset link is sent",
    success:true
  })
}

/**
 * 1. fetch token
 * 2. Verify token
 * 3. fetch user with the help of token.id
 * 4. Update password
 * 5. Save
 */
async function resetTransactionPassword(req,res) {
  const token=req.cookies.transactionToken
  if(!token){
    return res.status(401).json({
      message:"Token is expired, Please try again",success:false});
  }
  const decoded= await jwt.verify(token,process.env['JWT_SECRET']);
  const account= await accountModel.findById(decoded.id)
  const {transactionPassword}=req.body;
  account.transactionPassword=transactionPassword;
  await account.save()
  res.status(201).json({
    message:"Transaction Password changed Successfully",
    success:true
  })
}

async function changePassword(req,res){
    const {accountId,currentPassword,newPassword}=req.body;
    const isValidAccount= await accountModel.findOne({
        user: req.user._id,
        _id:accountId
    }).select("+transactionPassword")
    if(!isValidAccount){
        return res.status(404).json({
            message: "Email or Account not found",
            success:false
        })
    }
    
    const isValidPassword=await isValidAccount.compareTransactionPassword(currentPassword)
    if(!isValidPassword){
        return res.status(401).json({
            message:" Account or Password is invalid",
            success:false
        })
    }
    isValidAccount.transactionPassword=newPassword;
    await isValidAccount.save();
    res.status(200).json({
        message:"Password Changed Successfully",
        success:true
    })
}
module.exports={createAccount,getUserAccounts,getAccountBalance,forgotTransactionPassword,resetTransactionPassword,changePassword}