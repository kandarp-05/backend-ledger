// src/config/redis.js

const { createClient } = require("redis");

const redisClient = createClient({
    url: "redis://127.0.0.1:6379"
});

redisClient.on("connect", () => {
    console.log("✅ Redis Connected");
});

redisClient.on("error", (err) => {
    console.log("Redis Error:", err);
});

module.exports = redisClient;