const mongoose=require("mongoose");
const ledgerModel = require("./ledger.model");
const bcrypt= require("bcryptjs")

const accountSchema = new mongoose.Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"user",
        required: [true, "Account must be associated with a user"],
        index: true
    },
    status:{
        type:String,
        enum:{
            values: ["ACTIVE","FROZEN","CLOSED"],
            message: "Status can be either ACTIVE, FROZEN or CLOSED",
        }
        ,default:"ACTIVE"
    },
    currency:{
        type:String,
        required:[true,"Currency is required for creating an account"],
        default: "INR"
    },
    transactionPassword:{
        type: String,
        required: [true,"Password is required for creating an account"],
        minlength: [6,"password should contain more than six characters"],
        select: false
    }
},{
    timestamps: true
})

accountSchema.index({user:1,status:1})
accountSchema.methods.getBalance=async function(){
    const balanceData= await ledgerModel.aggregate([
        {$match: {account: this._id}},
        {$group:{
            _id:null,
            totalDebit:{
                $sum:{
                    $cond:[
                        {$eq:["$type","DEBIT"]},
                        "$amount",
                        0
                    ]
                }
            },
            totalCredit:{
                $sum:{
                    $cond:[
                        {$eq:["$type","CREDIT"]},
                        "$amount",
                        0
                    ]
                }
            }
        }},
        {
            $project:{
                _id: 0,
                balance: {$subtract: ["$totalCredit", "$totalDebit"
                ]}
            }
        }
    ])
    if (balanceData.length ===0){
        return 0;
    }
    return balanceData[0].balance
}

accountSchema.pre("save",async function(next) {
    if (!this.isModified("transactionPassword")){
        return
    }

    const hash= await bcrypt.hash(this.transactionPassword,10);
    this.transactionPassword=hash;
    return 
})

accountSchema.methods.compareTransactionPassword= async function (password) {
    return await bcrypt.compare(password,this.transactionPassword);
}

const accountModel = mongoose.model("account",accountSchema);

module.exports=accountModel;
