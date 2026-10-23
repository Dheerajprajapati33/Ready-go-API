import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  autocompleteController,
  placeDetailsController,
  reverseGeocodeController,
  geocodeController,
  directionsController,
  routeAndFareEstimateController
} from "./maps.controller.js";

const router = Router();

const pointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().max(300).optional()
});

const directionsBodySchema = z.object({
  origin: pointSchema,
  destination: pointSchema,
  mode: z.enum(["driving", "walking", "bicycling", "transit"]).optional().default("driving")
});

const estimateBodySchema = z.object({
  origin: pointSchema,
  destination: pointSchema
});

/**
 * @route   GET /api/v1/maps/autocomplete
 * @desc    Search place predictions (as rider types)
 * @query   input, sessionToken, latitude, longitude, radius, country
 */
router.get("/autocomplete", requireAuth, asyncHandler(autocompleteController));

/**
 * @route   GET /api/v1/maps/place-details/:placeId
 * @desc    Get coordinates and details of a selected place
 * @query   sessionToken
 */
router.get("/place-details/:placeId", requireAuth, asyncHandler(placeDetailsController));

/**
 * @route   GET /api/v1/maps/reverse-geocode
 * @desc    Convert GPS lat/lng to readable address
 * @query   latitude, longitude (or lat, lng)
 */
router.get("/reverse-geocode", requireAuth, asyncHandler(reverseGeocodeController));

/**
 * @route   GET /api/v1/maps/geocode
 * @desc    Convert address string to GPS lat/lng
 * @query   address
 */
router.get("/geocode", requireAuth, asyncHandler(geocodeController));

/**
 * @route   POST /api/v1/maps/directions
 * @desc    Calculate route, road distance, duration and polyline
 * @body    { origin: { latitude, longitude }, destination: { latitude, longitude }, mode? }
 */
router.post(
  "/directions",
  requireAuth,
  validateBody(directionsBodySchema),
  asyncHandler(directionsController)
);

/**
 * @route   POST /api/v1/maps/estimate
 * @desc    Calculate route directions and dynamic ride fares for all categories
 * @body    { origin: { latitude, longitude }, destination: { latitude, longitude } }
 */
router.post(
  "/estimate",
  requireAuth,
  validateBody(estimateBodySchema),
  asyncHandler(routeAndFareEstimateController)
);

export default router;

