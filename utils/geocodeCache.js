let client = null;
const memoryCache = new Map();

const get = async (key) => {
  if (client) return client.get(key);

  return memoryCache.get(key) || null;
};

const set = async (key, value, ttl = 86400) => {
  if (client) {
    await client.setEx(key, ttl, JSON.stringify(value));
  } else {
    memoryCache.set(key, value);
    setTimeout(() => memoryCache.delete(key), ttl * 1000);
  }
};

const initRedis = async () => {
  if (!process.env.REDIS_URL) {
    console.log("🟡 Redis no configurado, usando memoria");
    return;
  }

  const { createClient } = require("redis");
  client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  console.log("🟣 Redis conectado");
};

module.exports = { get, set, initRedis };
