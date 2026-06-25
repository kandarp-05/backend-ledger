const accountModel=require("../models/account.model");
const userModel = require("../models/user.model");

async function createAccount(req,res) {
    const user=req.user;
    const account= await accountModel.create({
        user:user._id,
        currency: req.body?.currency
    })
    res.status(201).json({
        message:"Account created successfully",
        account:account
    })
    
}

async function getUserAccounts(req,res){
    const accounts= await accountModel.find({user: req.user._id});
    if (!accounts){
        return res.status(200).json({
            message:"User have no account yet"
        })
    }
    res.status(200).json({
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
            message: "Account not found"
        })
    }
    const balance=await isValidUser.getBalance();
    res.status(200).json({
        accountId: isValidUser._id,
        balance:balance
    })
}
module.exports={createAccount,getUserAccounts,getAccountBalance}