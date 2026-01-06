const axios = require("axios");

const USER_AGENT = "BilcaApp/1.0 (contacto@bilca.com)";

// Tipos válidos según UX
const VALID_TYPES = [
  "city",
  "town",
  "village",
  "administrative",
  "road",
  "residential",
  "neighbourhood",
];

// Formatea la dirección para el usuario final
const formatDisplayName = (item) => {
  const addr = item.address || {};

  // Si tiene número en la calle → es una dirección exacta
  // (ej: "Av. Cabildo 1234" contiene "1234")
  const hasHouseNumber =
    addr.house_number ||
    (item.display_name && /\b\d{1,5}\b/.test(item.display_name));

  if (hasHouseNumber) {
    // Devolver dirección completa y exacta
    return item.display_name;
  } else {
    // Devolver formato amigable: Localidad, Provincia, País (SIEMPRE)
    const locality =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.suburb ||
      addr.hamlet ||
      addr.neighbourhood ||
      "";

    const province = addr.state || "";
    const country = addr.country || "Argentina"; // Fallback

    // Aseguramos que siempre tenga provincia y país
    const parts = [locality, province, country].filter(Boolean);

    // Si no hay localidad, usar display_name como fallback
    if (parts.length === 0) {
      return item.display_name;
    }

    return parts.join(", ");
  }
};

exports.searchAddress = async (query, country = "AR") => {
  const response = await axios.get(
    "https://nominatim.openstreetmap.org/search",
    {
      params: {
        format: "json",
        q: query,
        countrycodes: country,
        addressdetails: 1,
        limit: 10,
        dedupe: 1,
        accept_language: "es",
      },
      headers: { "User-Agent": USER_AGENT },
    }
  );

  return response.data
    .filter((item) => VALID_TYPES.includes(item.type))
    .map((item) => {
      const formattedName = formatDisplayName(item);

      return {
        id: `${item.lat}-${item.lon}`,
        type: item.type,
        display_name: formattedName,
        lat: item.lat,
        lon: item.lon,
        address: {
          locality:
            item.address.city ||
            item.address.town ||
            item.address.village ||
            item.address.suburb ||
            "",
          province: item.address.state || "",
          country: item.address.country || "",
          road: item.address.road || "",
          postcode: item.address.postcode || "",
        },
      };
    });
};

exports.reverseGeocode = async (lat, lon) => {
  const response = await axios.get(
    "https://nominatim.openstreetmap.org/reverse",
    {
      params: {
        format: "json",
        lat,
        lon,
        zoom: 18,
        addressdetails: 1,
      },
      headers: { "User-Agent": USER_AGENT },
    }
  );

  if (!response.data.address) {
    throw new Error("Dirección no encontrada");
  }

  const addr = response.data.address;

  // Determinar si es una dirección exacta (tiene número)
  const hasHouseNumber = addr.house_number;
  let formattedDisplayName;

  if (hasHouseNumber) {
    formattedDisplayName = response.data.display_name;
  } else {
    const locality =
      addr.town || addr.city || addr.village || addr.suburb || "";
    const province = addr.state || "";
    const country = addr.country || "Argentina";
    const parts = [locality, province, country].filter(Boolean);

    // Si no hay localidad, usar display_name como fallback
    if (parts.length === 0) {
      formattedDisplayName = response.data.display_name;
    } else {
      formattedDisplayName = parts.join(", ");
    }
  }

  return {
    display_name: formattedDisplayName,
    address: {
      road: addr.road || addr.pedestrian || "",
      suburb: addr.suburb || "",
      town: addr.town || addr.city || addr.village || "",
      city: addr.city || addr.town || "",
      state: addr.state || "",
      country: addr.country || "Argentina",
      postcode: addr.postcode || "",
    },
  };
};
