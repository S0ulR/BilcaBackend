// backend/middleware/apiLogger.js
const ApiCall = require("../models/ApiCall");

const apiLogger = async (req, res, next) => {
  const start = Date.now();

  const logEntry = {
    timestamp: new Date(),
    ip: req.ip || req.connection?.remoteAddress || "unknown",
    method: req.method,
    path: req.path,
    userAgent: req.get("User-Agent") || "unknown",
    userId: null,
    statusCode: null,
    durationMs: null,
  };

  if (req.user?.id) {
    logEntry.userId = req.user.id;
  }

  const originalJson = res.json;
  res.json = function (body) {
    logEntry.statusCode = res.statusCode;
    logEntry.durationMs = Date.now() - start;
    ApiCall.create(logEntry).catch(console.error);
    return originalJson.call(this, body);
  };

  const originalEnd = res.end;
  res.end = function (chunk, encoding) {
    if (logEntry.statusCode === null) {
      logEntry.statusCode = res.statusCode;
      logEntry.durationMs = Date.now() - start;
      ApiCall.create(logEntry).catch(console.error);
    }
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

module.exports = apiLogger;
