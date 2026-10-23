const GOOGLE_MAPS_BASE_URL = "https://maps.googleapis.com/maps/api";

// Simple in-memory cache with TTL to optimize Google API quota & billing
const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function setCached(key, value, ttlMs = CACHE_TTL_MS) {
  if (cache.size > 1000) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function getApiKey() {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    const err = new Error("GOOGLE_MAPS_API_KEY is not configured in environment variables.");
    err.code = "MAPS_CONFIG_MISSING";
    err.statusCode = 500;
    throw err;
  }
  return key;
}

/**
 * Handle Google Maps HTTP JSON response and errors
 */
async function fetchGoogleJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.error_message || data?.error?.message || `Google API error with HTTP ${response.status}`;
    const err = new Error(errorMsg);
    err.statusCode = response.status >= 400 && response.status < 500 ? 400 : 502;
    err.code = data?.status || data?.error?.status || "GOOGLE_MAPS_ERROR";
    err.details = data;
    throw err;
  }

  if (data?.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    const err = new Error(data.error_message || `Google Maps request failed with status: ${data.status}`);
    err.statusCode = data.status === "REQUEST_DENIED" || data.status === "OVER_QUERY_LIMIT" ? 403 : 400;
    err.code = data.status;
    err.details = data;
    throw err;
  }

  return data;
}

/**
 * Places Autocomplete: Search places / locations as rider types
 */
export async function getPlaceAutocomplete(input, options = {}) {
  const apiKey = getApiKey();
  const trimmed = input?.trim();
  if (!trimmed) return [];

  const url = new URL(`${GOOGLE_MAPS_BASE_URL}/place/autocomplete/json`);
  url.searchParams.set("input", trimmed);
  url.searchParams.set("key", apiKey);

  if (options.sessionToken) {
    url.searchParams.set("sessiontoken", options.sessionToken);
  }

  if (options.latitude != null && options.longitude != null) {
    url.searchParams.set("location", `${options.latitude},${options.longitude}`);
    url.searchParams.set("radius", String(options.radius || 25000)); // Default 25km bias
  }

  if (options.country) {
    url.searchParams.set("components", `country:${options.country}`);
  }

  const data = await fetchGoogleJson(url.toString());
  const predictions = data.predictions || [];

  return predictions.map(p => ({
    placeId: p.place_id,
    description: p.description,
    mainText: p.structured_formatting?.main_text || p.description,
    secondaryText: p.structured_formatting?.secondary_text || "",
    types: p.types || []
  }));
}

/**
 * Place Details: Retrieve coordinates and structured address by place_id
 */
export async function getPlaceDetails(placeId, options = {}) {
  const apiKey = getApiKey();
  if (!placeId) throw new Error("placeId is required");

  const cacheKey = `place_${placeId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const url = new URL(`${GOOGLE_MAPS_BASE_URL}/place/details/json`);
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "name,formatted_address,geometry,address_components,place_id");
  url.searchParams.set("key", apiKey);

  if (options.sessionToken) {
    url.searchParams.set("sessiontoken", options.sessionToken);
  }

  const data = await fetchGoogleJson(url.toString());
  const result = data.result;

  if (!result || !result.geometry) {
    const err = new Error("Place details not found");
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }

  const response = {
    placeId: result.place_id,
    name: result.name || "",
    formattedAddress: result.formatted_address || "",
    latitude: result.geometry.location.lat,
    longitude: result.geometry.location.lng,
    addressComponents: result.address_components || []
  };

  setCached(cacheKey, response);
  return response;
}

/**
 * Reverse Geocode: Convert latitude and longitude to a human-readable address
 */
export async function reverseGeocode(latitude, longitude) {
  const apiKey = getApiKey();
  if (latitude == null || longitude == null) {
    throw new Error("Latitude and longitude are required for reverse geocoding");
  }

  // Round to 5 decimal places (~1.1 meter precision) for caching efficiency
  const roundedLat = Number(latitude).toFixed(5);
  const roundedLng = Number(longitude).toFixed(5);
  const cacheKey = `revgeo_${roundedLat}_${roundedLng}`;

  const cached = getCached(cacheKey);
  if (cached) return cached;

  const url = new URL(`${GOOGLE_MAPS_BASE_URL}/geocode/json`);
  url.searchParams.set("latlng", `${latitude},${longitude}`);
  url.searchParams.set("key", apiKey);

  const data = await fetchGoogleJson(url.toString());
  const results = data.results || [];

  if (results.length === 0) {
    return {
      formattedAddress: "Unknown location",
      placeId: null,
      addressComponents: [],
      latitude: Number(latitude),
      longitude: Number(longitude)
    };
  }

  const primary = results[0];
  const response = {
    formattedAddress: primary.formatted_address,
    placeId: primary.place_id,
    addressComponents: primary.address_components,
    latitude: primary.geometry?.location?.lat ?? Number(latitude),
    longitude: primary.geometry?.location?.lng ?? Number(longitude)
  };

  setCached(cacheKey, response);
  return response;
}

/**
 * Forward Geocode: Convert address string to coordinates
 */
export async function geocodeAddress(address) {
  const apiKey = getApiKey();
  const trimmed = address?.trim();
  if (!trimmed) throw new Error("Address is required for geocoding");

  const cacheKey = `fwdgeo_${trimmed.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const url = new URL(`${GOOGLE_MAPS_BASE_URL}/geocode/json`);
  url.searchParams.set("address", trimmed);
  url.searchParams.set("key", apiKey);

  const data = await fetchGoogleJson(url.toString());
  const results = data.results || [];

  if (results.length === 0) {
    const err = new Error("No coordinates found for the given address");
    err.statusCode = 404;
    err.code = "ADDRESS_NOT_FOUND";
    throw err;
  }

  const primary = results[0];
  const response = {
    formattedAddress: primary.formatted_address,
    placeId: primary.place_id,
    latitude: primary.geometry.location.lat,
    longitude: primary.geometry.location.lng,
    addressComponents: primary.address_components
  };

  setCached(cacheKey, response);
  return response;
}

/**
 * Directions API: Compute route, distance, travel duration and encoded polyline
 */
export async function getDirections(origin, destination, options = {}) {
  const apiKey = getApiKey();
  const { latitude: oLat, longitude: oLng } = origin || {};
  const { latitude: dLat, longitude: dLng } = destination || {};

  if (oLat == null || oLng == null || dLat == null || dLng == null) {
    throw new Error("Origin and destination latitude/longitude are required");
  }

  const url = new URL(`${GOOGLE_MAPS_BASE_URL}/directions/json`);
  url.searchParams.set("origin", `${oLat},${oLng}`);
  url.searchParams.set("destination", `${dLat},${dLng}`);
  url.searchParams.set("mode", options.mode || "driving");
  url.searchParams.set("departure_time", "now"); // For live traffic duration
  url.searchParams.set("key", apiKey);

  const data = await fetchGoogleJson(url.toString());

  if (!data.routes || data.routes.length === 0) {
    const err = new Error("No route found between the specified locations");
    err.statusCode = 404;
    err.code = "ROUTE_NOT_FOUND";
    throw err;
  }

  const route = data.routes[0];
  const leg = route.legs[0];

  const distanceMeters = leg.distance?.value || 0;
  const distanceKm = Number((distanceMeters / 1000).toFixed(2));
  const durationSeconds = leg.duration_in_traffic?.value || leg.duration?.value || 0;
  const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));

  return {
    distanceKm,
    distanceMeters,
    distanceText: leg.distance?.text || `${distanceKm} km`,
    durationMinutes,
    durationSeconds,
    durationText: leg.duration_in_traffic?.text || leg.duration?.text || `${durationMinutes} mins`,
    startAddress: leg.start_address,
    endAddress: leg.end_address,
    polyline: route.overview_polyline?.points || "",
    bounds: route.bounds || null
  };
}

