import jwt from "jsonwebtoken";
import crypto from "node:crypto";

export function signAccessToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: `${Number(process.env.ACCESS_TOKEN_MINUTES || 15)}m`
  });
}
export function signRefreshToken(user, sessionId) {
  return jwt.sign({ sub: user._id.toString(), sid: sessionId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: `${Number(process.env.REFRESH_TOKEN_DAYS || 30)}d`
  });
}
export function hashToken(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
export function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}
