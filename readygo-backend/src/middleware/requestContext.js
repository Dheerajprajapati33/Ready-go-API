import crypto from "node:crypto";
export function requestContext(req, res, next) {
  res.locals.requestId = req.headers["x-request-id"]?.toString() || crypto.randomUUID();
  res.setHeader("X-Request-Id", res.locals.requestId);
  next();
}
