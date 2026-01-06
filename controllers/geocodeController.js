const geocodingService = require("../utils/geocodingService");

const VALID_COUNTRIES = ["AR", "UY", "PY", "BO", "CL", "BR"];

exports.search = async (req, res) => {
  const { q, country = "AR" } = req.query;

  if (!q || typeof q !== "string" || q.trim().length < 2) {
    return res
      .status(400)
      .json({ msg: "La consulta debe tener al menos 2 caracteres" });
  }

  try {
    const cleanQuery = q.trim();
    // Validar el país
    const VALID_COUNTRIES = ["AR", "UY", "PY", "BR", "CL", "BO"];
    const countryCode = VALID_COUNTRIES.includes(country) ? country : "AR";

    const results = await geocodingService.searchAddress(
      cleanQuery,
      countryCode
    );
    return res.json(results);
  } catch (err) {
    console.error("Error en geocode search:", err.message);
    return res.json([]);
  }
};

exports.reverse = async (req, res) => {
  const { lat, lon } = req.query;

  if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ msg: "Coordenadas inválidas" });
  }

  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);

  // Validar rango de coordenadas
  if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
    return res.status(400).json({ msg: "Coordenadas fuera de rango válido" });
  }

  try {
    const result = await geocodingService.reverseGeocode(latNum, lonNum);
    return res.json(result);
  } catch (err) {
    console.error("Error en reverse geocoding:", err.message);
    return res.status(500).json({ msg: "Error al obtener dirección" });
  }
};
