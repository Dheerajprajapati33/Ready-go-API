import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import Device from "../models/Device.js";

let messagingInstance = null;
let isFirebaseReady = false;

try {
  const projectId = process.env.FCM_PROJECT_ID;
  const clientEmail = process.env.FCM_CLIENT_EMAIL;
  let privateKey = process.env.FCM_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    // Clean up private key if it has escaped newlines or wrapping quotes
    privateKey = privateKey.trim();
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, "\n");

    const app = getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey
          })
        });

    messagingInstance = getMessaging(app);
    isFirebaseReady = true;
    console.log(`[FCM] Firebase Admin initialized successfully for project: ${projectId}`);
  } else {
    console.warn("[FCM] Credentials not fully configured in .env. Running in Mock Mode.");
  }
} catch (err) {
  console.error("[FCM] Initialization error:", err.message);
  isFirebaseReady = false;
}

/**
 * Send push notification to all devices registered by a user
 * @param {string|import("mongoose").Types.ObjectId} userId
 * @param {{ title: string, body: string, data?: Record<string, string> }} payload
 */
export async function sendPushNotification(userId, { title, body, data = {} }) {
  try {
    const devices = await Device.find({ userId });

    if (!devices || devices.length === 0) {
      console.log(`[FCM] No registered devices found for user ${userId}`);
      return { success: false, reason: "NO_REGISTERED_DEVICES" };
    }

    const tokens = devices
      .map(d => d.pushToken)
      .filter(t => t && typeof t === "string" && t.trim().length > 0);

    if (tokens.length === 0) {
      console.log(`[FCM] No valid push tokens found for user ${userId}`);
      return { success: false, reason: "NO_VALID_TOKENS" };
    }

    // Check if tokens are dummy/placeholder values (e.g., "YOUR_FCM_PUSH_TOKEN" from Postman)
    const isPlaceholder = tokens.every(t =>
      t.toLowerCase().includes("your_fcm") ||
      t.toLowerCase().includes("push_token") ||
      t.length < 20
    );

    if (!isFirebaseReady || isPlaceholder) {
      console.log(`🔔 [FCM Mock/Dev Push to User: ${userId}]`);
      console.log(`   Title: "${title}"`);
      console.log(`   Body: "${body}"`);
      console.log(`   Tokens:`, tokens);
      return {
        success: true,
        mock: true,
        reason: !isFirebaseReady ? "FIREBASE_NOT_CONFIGURED" : "PLACEHOLDER_TOKEN_DETECTED"
      };
    }

    // Ensure all data attributes are strings for Firebase messaging
    const stringifiedData = Object.entries(data).reduce((acc, [k, v]) => {
      acc[k] = String(v);
      return acc;
    }, {});

    const response = await messagingInstance.sendEachForMulticast({
      tokens,
      notification: {
        title,
        body
      },
      data: stringifiedData,
      android: {
        priority: "high",
        notification: {
          channelId: "readygo_high_importance_channel",
          priority: "max",
          defaultSound: true,
          defaultVibrateTimings: true
        }
      },
      apns: {
        headers: {
          "apns-priority": "10"
        },
        payload: {
          aps: {
            sound: "default",
            contentAvailable: true
          }
        }
      }
    });

    console.log(`[FCM] Push sent to user ${userId}: ${response.successCount} succeeded, ${response.failureCount} failed`);

    // Clean up invalid or unregistered tokens from database
    if (response.failureCount > 0) {
      const tokensToRemove = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errCode = resp.error?.code;
          if (
            errCode === "messaging/invalid-registration-token" ||
            errCode === "messaging/registration-token-not-registered"
          ) {
            tokensToRemove.push(tokens[idx]);
          }
        }
      });

      if (tokensToRemove.length > 0) {
        await Device.deleteMany({ pushToken: { $in: tokensToRemove } });
        console.log(`[FCM] Removed ${tokensToRemove.length} expired/invalid device token(s)`);
      }
    }

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount
    };
  } catch (error) {
    console.error(`[FCM] Error sending push to user ${userId}:`, error.message);
    return { success: false, error: error.message };
  }
}

export default {
  sendPushNotification
};

