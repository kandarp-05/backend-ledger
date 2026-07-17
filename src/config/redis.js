const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on("error", (err) => {
  console.error("Redis Error:", err);
});

(async () => {
  try {
    await redisClient.connect();
    console.log("✅ Redis Connected");
  } catch (err) {
    console.error("Redis Connection Failed:", err);
  }
})();

module.exports = redisClient;