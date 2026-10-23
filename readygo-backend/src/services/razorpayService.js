import Razorpay from "razorpay";
import crypto from "node:crypto";

function getRazorpayClient() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    return null;
  }

  return new Razorpay({
    key_id,
    key_secret
  });
}

export function isRazorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function getRazorpayKeyId() {
  return process.env.RAZORPAY_KEY_ID || "";
}

/**
 * Create a Razorpay Order
 * @param {Object} options
 * @param {number} options.amountPaise - Amount in paise (e.g. 50000 = ₹500)
 * @param {string} options.receipt - Unique internal receipt ID (e.g. payment._id)
 * @param {string} [options.currency="INR"]
 * @param {Object} [options.notes={}]
 * @returns {Promise<Object>} Razorpay order object
 */
export async function createRazorpayOrder({ amountPaise, receipt, currency = "INR", notes = {} }) {
  const client = getRazorpayClient();
  if (!client) {
    const err = new Error("Razorpay credentials (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are not configured in .env");
    err.code = "RAZORPAY_NOT_CONFIGURED";
    err.statusCode = 500;
    throw err;
  }

  const order = await client.orders.create({
    amount: Math.round(amountPaise),
    currency,
    receipt: String(receipt).slice(0, 40),
    notes
  });

  return order;
}

/**
 * Verify Razorpay payment signature
 * @param {Object} params
 * @param {string} params.orderId - razorpay_order_id
 * @param {string} params.paymentId - razorpay_payment_id
 * @param {string} params.signature - razorpay_signature
 * @returns {boolean} True if signature is valid
 */
export function verifyRazorpaySignature({ orderId, paymentId, signature }) {
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_secret) {
    throw new Error("RAZORPAY_KEY_SECRET is not configured");
  }

  const generatedSignature = crypto
    .createHmac("sha256", key_secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return generatedSignature === signature;
}

