import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const parts = header.trim().split(/\s+/);
    const scheme = parts[0];
    const token = parts.slice(1).join(" ").trim().replace(/^["']|["']$/g, "");
    if (scheme !== "Bearer" || !token) return res.status(401).json({
      success: false, message: "Bearer access token required", code: "UNAUTHENTICATED"
    });

    // In local dev mode, allow dev admin convenience tokens
    if (process.env.NODE_ENV !== "production" && ["dev_admin_token", "admin_token", "ADMIN_TOKEN"].includes(token)) {
      const adminUser = await User.findOne({ role: "admin", status: "ACTIVE" });
      if (adminUser) {
        req.user = adminUser;
        return next();
      }
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (jwtErr) {
      // In local dev mode, accept validly signed expired tokens to avoid friction during testing
      if (process.env.NODE_ENV !== "production" && jwtErr.name === "TokenExpiredError") {
        payload = jwt.decode(token);
        console.log(`[Auth Info] Dev mode: accepted expired token for user ${payload?.sub || "admin"}`);
      } else {
        throw jwtErr;
      }
    }

    if (!payload?.sub) {
      return res.status(401).json({ success: false, message: "Invalid access token payload", code: "UNAUTHENTICATED" });
    }

    const user = await User.findById(payload.sub).select("-__v");
    if (!user || user.status !== "ACTIVE") return res.status(401).json({
      success: false, message: "User session is not active", code: "UNAUTHENTICATED"
    });
    req.user = user;
    next();
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[Auth Error] ${err?.name}: ${err?.message}`);
    }
    return res.status(401).json({
      success: false,
      message: err?.name === "TokenExpiredError" ? "Access token has expired. Please refresh your token or login again." : "Invalid or expired access token",
      code: "UNAUTHENTICATED",
      details: process.env.NODE_ENV !== "production" && err?.message ? [{ reason: err.message }] : []
    });
  }
}
export const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "Insufficient permissions", code: "FORBIDDEN" });
  }
  next();
};
