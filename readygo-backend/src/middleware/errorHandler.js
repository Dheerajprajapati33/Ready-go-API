import { fail } from "../utils/apiResponse.js";

export function notFound(req, res) {
  return fail(res, 404, `Route not found: ${req.method} ${req.originalUrl}`, "NOT_FOUND");
}
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err?.name === "ValidationError") {
    return fail(res, 400, "Validation failed", "VALIDATION_ERROR",
      Object.values(err.errors || {}).map(e => ({ field: e.path, message: e.message })));
  }
  if (err?.name === "CastError") return fail(res, 400, "Invalid resource ID", "VALIDATION_ERROR");
  if (err?.code === 11000) return fail(res, 409, "Duplicate value", "STATE_CONFLICT");
  const status = err.status || 500;
  if (status >= 500) console.error({ requestId: res.locals.requestId, error: err.message });
  return fail(res, status, status >= 500 ? "Internal server error" : err.message,
    err.code || (status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : "ERROR"));
}
