import { ok, fail } from "../../utils/apiResponse.js";
import {
  getPlaceAutocomplete,
  getPlaceDetails,
  reverseGeocode,
  geocodeAddress,
  getDirections
} from "../../services/googleMapsService.js";

const categories = [
  { id: "moto", name: "ReadyGo Moto", baseFarePaise: 5000, perKmPaise: 1800, etaMinutes: 3 },
  { id: "auto", name: "ReadyGo Auto", baseFarePaise: 7000, perKmPaise: 2500, etaMinutes: 5 },
  { id: "mini", name: "ReadyGo Mini", baseFarePaise: 10000, perKmPaise: 3500, etaMinutes: 7 },
  { id: "prime", name: "ReadyGo Prime", baseFarePaise: 15000, perKmPaise: 4800, etaMinutes: 10 }
];

export const autocompleteController = async (req, res) => {
  const input = req.query.input || req.query.q;
  if (!input || !String(input).trim()) {
    return ok(res, { predictions: [] }, "Empty input", 200);
  }

  const { sessionToken, latitude, longitude, radius, country } = req.query;
  const options = {
    sessionToken: sessionToken || undefined,
    latitude: latitude ? Number(latitude) : undefined,
    longitude: longitude ? Number(longitude) : undefined,
    radius: radius ? Number(radius) : undefined,
    country: country || undefined
  };

  try {
    const predictions = await getPlaceAutocomplete(String(input), options);
    return ok(res, { predictions }, "Place predictions fetched");
  } catch (error) {
    return fail(
      res,
      error.statusCode || 500,
      error.message || "Failed to fetch autocomplete predictions",
      error.code || "MAPS_AUTOCOMPLETE_ERROR",
      error.details ? [error.details] : []
    );
  }
};

export const placeDetailsController = async (req, res) => {
  const { placeId } = req.params;
  const { sessionToken } = req.query;

  try {
    const details = await getPlaceDetails(placeId, { sessionToken });
    return ok(res, details, "Place details fetched");
  } catch (error) {
    return fail(
      res,
      error.statusCode || 500,
      error.message || "Failed to fetch place details",
      error.code || "MAPS_PLACE_DETAILS_ERROR",
      error.details ? [error.details] : []
    );
  }
};

export const reverseGeocodeController = async (req, res) => {
  const lat = req.query.latitude ?? req.query.lat;
  const lng = req.query.longitude ?? req.query.lng;

  if (lat == null || lng == null) {
    return fail(res, 400, "Latitude and longitude query parameters are required", "VALIDATION_ERROR");
  }

  try {
    const result = await reverseGeocode(Number(lat), Number(lng));
    return ok(res, result, "Reverse geocoded address fetched");
  } catch (error) {
    return fail(
      res,
      error.statusCode || 500,
      error.message || "Failed to reverse geocode coordinates",
      error.code || "MAPS_REVERSE_GEOCODE_ERROR",
      error.details ? [error.details] : []
    );
  }
};

export const geocodeController = async (req, res) => {
  const address = req.query.address || req.query.q;
  if (!address || !String(address).trim()) {
    return fail(res, 400, "Address query parameter is required", "VALIDATION_ERROR");
  }

  try {
    const result = await geocodeAddress(String(address));
    return ok(res, result, "Coordinates fetched for address");
  } catch (error) {
    return fail(
      res,
      error.statusCode || 500,
      error.message || "Failed to geocode address",
      error.code || "MAPS_GEOCODE_ERROR",
      error.details ? [error.details] : []
    );
  }
};

export const directionsController = async (req, res) => {
  const { origin, destination, mode } = req.body;

  try {
    const route = await getDirections(origin, destination, { mode });
    return ok(res, route, "Route directions fetched successfully");
  } catch (error) {
    return fail(
      res,
      error.statusCode || 500,
      error.message || "Failed to compute route directions",
      error.code || "MAPS_DIRECTIONS_ERROR",
      error.details ? [error.details] : []
    );
  }
};

export const routeAndFareEstimateController = async (req, res) => {
  const { origin, destination } = req.body;

  try {
    const route = await getDirections(origin, destination, { mode: "driving" });
    const distanceKm = route.distanceKm;

    const options = categories.map(c => ({
      categoryId: c.id,
      name: c.name,
      etaMinutes: Math.max(1, Math.round(route.durationMinutes * 0.3)), // Driver arrival ETA
      tripDurationMinutes: route.durationMinutes,
      farePaise: Math.round(c.baseFarePaise + distanceKm * c.perKmPaise)
    }));

    return ok(res, {
      route: {
        distanceKm: route.distanceKm,
        distanceMeters: route.distanceMeters,
        distanceText: route.distanceText,
        durationMinutes: route.durationMinutes,
        durationSeconds: route.durationSeconds,
        durationText: route.durationText,
        startAddress: route.startAddress,
        endAddress: route.endAddress,
        polyline: route.polyline
      },
      currency: "INR",
      options
    }, "Route and fare estimate calculated");
  } catch (error) {
    return fail(
      res,
      error.statusCode || 500,
      error.message || "Failed to compute route and fare estimate",
      error.code || "MAPS_ESTIMATE_ERROR",
      error.details ? [error.details] : []
    );
  }
};

