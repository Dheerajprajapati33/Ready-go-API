import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) return res.status(401).json({
      success: false, message: "Bearer access token required", code: "UNAUTHENTICATED"
    });
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(payload.sub).select("-__v");
    if (!user || user.status !== "ACTIVE") return res.status(401).json({
      success: false, message: "User session is not active", code: "UNAUTHENTICATED"
    });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired access token", code: "UNAUTHENTICATED" });
  }
}
export const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "Insufficient permissions", code: "FORBIDDEN" });
  }
  next();
};
