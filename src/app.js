const express = require("express");
const cors= require("cors")
const app= express();
const cookieParser=require("cookie-parser")
const authRouter= require("./routes/auth.routes")
const accountRouter = require("./routes/account.routes");
const transactionRouter = require("./routes/transaction.routes");

app.use(cors({
    origin: "http://localhost:5173",
    credentials: true,
  }))
app.use(express.json())
app.use(cookieParser())

app.use("/api/auth",authRouter);
app.use("/api/accounts",accountRouter);
app.use("/api/transaction",transactionRouter);

module.exports=app;