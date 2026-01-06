let client = null;

const get = async (key) => {
  if (!client) return null;
  return client.get(key);
};

const set = async (key, value, ttl = 86400) => {
  if (!client) return;
  await client.setEx(key, ttl, JSON.stringify(value));
};

const initRedis = async () => {
  if (!process.env.REDIS_URL) return;

  const { createClient } = require("redis");
  client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  console.log("🟣 Redis conectado");
};

module.exports = { get, set, initRedis };
