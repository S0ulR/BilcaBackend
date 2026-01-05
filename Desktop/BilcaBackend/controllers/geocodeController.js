const geocodingService = require("../utils/geocodingService");

// Cache en memoria con TTL
const geocodeCache = new Map();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 horas

const getCacheKey = (...parts) =>
  parts.join(":").toLowerCase().trim();

const setCache = (key, value) => {
  geocodeCache.set(key, {
    value,
    expires: Date.now() + CACHE_TTL
  });
};

const getCache = (key) => {
  const entry = geocodeCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    geocodeCache.delete(key);
    return null;
  }
  return entry.value;
};

const VALID_COUNTRIES = ["AR", "UY", "PY", "BO", "CL", "BR"];

exports.search = async (req, res) => {
  const { q, country = "AR" } = req.query;

  if (!q || typeof q !== "string" || q.trim().length < 2) {
    return res
      .status(400)
      .json({ msg: "La consulta debe tener al menos 2 caracteres" });
  }

  const cleanQuery = q.trim();
  const countryCode = VALID_COUNTRIES.includes(country) ? country : "AR";
  const cacheKey = getCacheKey("search", cleanQuery, countryCode);

  // ✅ CACHE HIT
  const cached = getCache(cacheKey);
  if (cached) {
    return res.json({ source: "cache", results: cached });
  }

  try {
    const results = await geocodingService.searchAddress(
      cleanQuery,
      countryCode
    );

    setCache(cacheKey, results);
    return res.json({ source: "api", results });
  } catch (err) {
    console.error("Error en geocode search:", err.message);
    return res.json({ source: "error", results: [] });
  }
};

exports.reverse = async (req, res) => {
  const { lat, lon } = req.query;

  if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ msg: "Coordenadas inválidas" });
  }

  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);

  if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
    return res.status(400).json({ msg: "Coordenadas fuera de rango válido" });
  }

  const cacheKey = getCacheKey("reverse", latNum, lonNum);

  const cached = getCache(cacheKey);
  if (cached) {
    return res.json({ source: "cache", result: cached });
  }

  try {
    const result = await geocodingService.reverseGeocode(latNum, lonNum);
    setCache(cacheKey, result);
    return res.json({ source: "api", result });
  } catch (err) {
    console.error("Error en reverse geocoding:", err.message);
    return res.status(500).json({ msg: "Error al obtener dirección" });
  }
};
