import crypto from "node:crypto";
export function requestContext(req, res, next) {
  res.locals.requestId = req.headers["x-request-id"]?.toString() || crypto.randomUUID();
  res.setHeader("X-Request-Id", res.locals.requestId);

  // Normalize URL: trim any accidental trailing spaces or encoded %20 from Postman URLs
  if (req.url) {
    req.url = req.url.replace(/(%20|\s)+(?=\?|$)/g, "");
  }

  next();
}
