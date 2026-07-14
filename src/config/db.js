const mongoose = require("mongoose");
const redisClient= require("./redis")

async function connectDB() {
  try {
    await mongoose.connect(process.env["MONGO_URI"]);
    await redisClient.connect();
  console.log("Database connected successfully");
  } catch (error) {
    console.error("Database connectivity error: ",error);
    process.exit(1);
  } 
}

module.exports = connectDB;
