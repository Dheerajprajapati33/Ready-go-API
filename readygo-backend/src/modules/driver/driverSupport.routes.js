import { Router } from "express";
import { z } from "zod";
import SupportTicket from "../../models/SupportTicket.js";
import HelpTopic from "../../models/HelpTopic.js";
import LiveChatSession from "../../models/LiveChatSession.js";
import { requireAuth, allowRoles } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

// Pre-defined categories
const SUPPORT_CATEGORIES = [
  { code: "RIDE_ISSUES", label: "Ride Issues" },
  { code: "PAYMENTS_PAYOUTS", label: "Payments & Payouts" },
  { code: "ACCOUNT_KYC", label: "Account & KYC" },
  { code: "RATINGS_REVIEWS", label: "Ratings & Reviews" },
  { code: "SAFETY_INCIDENTS", label: "Safety & Incidents" },
  { code: "INCENTIVES_BONUSES", label: "Incentives & Bonuses" }
];

// Seed default help topics if none exist
async function ensureDefaultHelpTopics() {
  const count = await HelpTopic.countDocuments();
  if (count > 0) return;

  const defaultTopics = [
    {
      topicId: "topic_pay_01",
      title: "How and when are trip earnings paid out?",
      category: "PAYMENTS_PAYOUTS",
      content: "Trip payouts are credited automatically to your ReadyGo Driver Wallet as soon as a trip ends. You can request an instant bank or UPI withdrawal anytime from the Earnings & Wallet screen. Standard settlement takes under 30 minutes.",
      tags: ["payout", "earnings", "wallet", "instant withdrawal"]
    },
    {
      topicId: "topic_pay_02",
      title: "Missing trip payout or fare discrepancy",
      category: "PAYMENTS_PAYOUTS",
      content: "If you notice an incorrect trip fare, toll deduction issue, or missing distance credit, create a support ticket with your Ride ID. Our fare review team recalculates GPS trajectories within 2 hours.",
      tags: ["toll", "fare", "missing", "discrepancy"]
    },
    {
      topicId: "topic_ride_01",
      title: "Rider did not show up or cancelled after arrival",
      category: "RIDE_ISSUES",
      content: "Wait at the pickup point for at least 5 minutes. If rider is unreachable, you can cancel with reason 'Rider No-Show'. A cancellation fee will automatically be credited to your wallet.",
      tags: ["cancellation fee", "no show", "pickup"]
    },
    {
      topicId: "topic_kyc_01",
      title: "Updating Vehicle Insurance or Driving License",
      category: "ACCOUNT_KYC",
      content: "Upload updated documents directly from Driver Profile > Document Upload. Verification takes 4 to 12 hours. Ensure photo is clear and expiry date is visible.",
      tags: ["documents", "insurance", "driving license", "kyc"]
    },
    {
      topicId: "topic_safe_01",
      title: "Emergency SOS and safety protocols during a trip",
      category: "SAFETY_INCIDENTS",
      content: "In case of any emergency, tap the Red Shield SOS button on your live trip screen. It immediately alerts the 24/7 ReadyGo Safety Response Team and dials emergency police helpline.",
      tags: ["sos", "safety", "emergency", "incident"]
    },
    {
      topicId: "topic_inc_01",
      title: "Understanding Daily Quests and Peak Hour Incentives",
      category: "INCENTIVES_BONUSES",
      content: "Daily and weekly quests reward extra bonuses upon completing target rides within high-demand zones. Check the Incentives tab on your dashboard for live progress.",
      tags: ["quests", "incentive", "bonus", "peak hours"]
    }
  ];

  await HelpTopic.insertMany(defaultTopics);
}

// 25.1.1 GET /driver/support/overview
router.get("/driver/support/overview", requireAuth, allowRoles("driver", "admin", "rider"), asyncHandler(async (req, res) => {
  return ok(res, {
    liveAgent: {
      available: true,
      queueStatus: "AVAILABLE",
      averageWaitSeconds: 45
    },
    supportPhone: "1800-READYGO",
    categories: SUPPORT_CATEGORIES
  }, "Support overview retrieved successfully");
}));

// 25.1.2 GET /driver/support/topics
router.get("/driver/support/topics", requireAuth, allowRoles("driver", "admin", "rider"), asyncHandler(async (req, res) => {
  await ensureDefaultHelpTopics();

  const { q, category } = req.query;
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const limit = Math.max(1, Math.min(50, parseInt(req.query.limit || "10", 10)));
  const filter = { isPublished: true };

  if (category) {
    filter.category = category;
  }

  if (q && q.trim()) {
    const regex = new RegExp(q.trim(), "i");
    filter.$or = [
      { title: regex },
      { content: regex },
      { tags: regex }
    ];
  }

  const [items, total] = await Promise.all([
    HelpTopic.find(filter)
      .sort({ views: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    HelpTopic.countDocuments(filter)
  ]);

  return ok(res, {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  }, "Help topics retrieved");
}));

// 25.1.3 GET /driver/support/topics/:topicId
router.get("/driver/support/topics/:topicId", requireAuth, allowRoles("driver", "admin", "rider"), asyncHandler(async (req, res) => {
  await ensureDefaultHelpTopics();

  const topic = await HelpTopic.findOne({
    $or: [
      { topicId: req.params.topicId },
      { _id: req.params.topicId.match(/^[0-9a-fA-F]{24}$/) ? req.params.topicId : null }
    ]
  });

  if (!topic) {
    return fail(res, 404, "Help topic not found", "NOT_FOUND");
  }

  // Increment views
  topic.views += 1;
  await topic.save();

  return ok(res, topic, "Help article retrieved");
}));

// 25.1.4 POST /driver/support/tickets
const createTicketSchema = z.object({
  category: z.enum([
    "RIDE_ISSUES",
    "PAYMENTS_PAYOUTS",
    "ACCOUNT_KYC",
    "RATINGS_REVIEWS",
    "SAFETY_INCIDENTS",
    "INCENTIVES_BONUSES",
    "OTHER"
  ]),
  subject: z.string().min(3),
  description: z.string().min(5),
  rideId: z.string().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional().default("NORMAL")
});

router.post("/driver/support/tickets", requireAuth, allowRoles("driver", "admin", "rider"), validateBody(createTicketSchema), asyncHandler(async (req, res) => {
  const ticketId = "ticket_" + Math.floor(100000 + Math.random() * 900000);

  const ticket = await SupportTicket.create({
    ticketId,
    driverId: req.user._id,
    category: req.body.category,
    subject: req.body.subject,
    description: req.body.description,
    rideId: req.body.rideId,
    priority: req.body.priority || "NORMAL",
    status: "OPEN",
    messages: [
      {
        messageId: "msg_" + Math.random().toString(36).substring(2, 9),
        senderId: req.user._id,
        senderRole: "driver",
        senderName: req.user.fullName || "Driver",
        message: req.body.description,
        createdAt: new Date()
      }
    ]
  });

  return ok(res, {
    ticketId: ticket.ticketId,
    status: ticket.status,
    category: ticket.category,
    createdAt: ticket.createdAt
  }, "Support ticket created", 201);
}));

// 25.1.5 GET /driver/support/tickets
router.get("/driver/support/tickets", requireAuth, allowRoles("driver", "admin", "rider"), asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const limit = Math.max(1, Math.min(50, parseInt(req.query.limit || "10", 10)));
  const filter = { driverId: req.user._id };

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const [items, total] = await Promise.all([
    SupportTicket.find(filter)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SupportTicket.countDocuments(filter)
  ]);

  return ok(res, {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  }, "Driver support tickets retrieved");
}));

async function resolveTicket(ticketIdParam, user) {
  if (!ticketIdParam) return null;
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(ticketIdParam);
  const conditions = [{ ticketId: ticketIdParam }];
  if (isObjectId) conditions.push({ _id: ticketIdParam });

  const query = user?.role === "admin"
    ? { $or: conditions }
    : { driverId: user._id, $or: conditions };

  return SupportTicket.findOne(query);
}

async function resolveChatSession(sessionIdParam, user) {
  if (!sessionIdParam) return null;
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(sessionIdParam);
  const conditions = [{ sessionId: sessionIdParam }];
  if (isObjectId) conditions.push({ _id: sessionIdParam });

  const query = user?.role === "admin"
    ? { $or: conditions }
    : { driverId: user._id, $or: conditions };

  return LiveChatSession.findOne(query);
}

// 25.1.6 GET /driver/support/tickets/:ticketId
router.get("/driver/support/tickets/:ticketId", requireAuth, allowRoles("driver", "admin", "rider"), asyncHandler(async (req, res) => {
  const ticket = await resolveTicket(req.params.ticketId, req.user);

  if (!ticket) {
    return fail(res, 404, "Support ticket not found", "NOT_FOUND");
  }

  // Safety check: driver can only see their own ticket unless admin
  if (req.user.role !== "admin" && ticket.driverId.toString() !== req.user._id.toString()) {
    return fail(res, 403, "Access denied to this ticket", "FORBIDDEN");
  }

  return ok(res, ticket, "Ticket details and message timeline retrieved");
}));

// 25.1.7 POST /driver/support/tickets/:ticketId/messages
const sendMessageSchema = z.object({
  message: z.string().min(1),
  attachmentKeys: z.array(z.string()).optional()
});

router.post("/driver/support/tickets/:ticketId/messages", requireAuth, allowRoles("driver", "admin", "rider"), validateBody(sendMessageSchema), asyncHandler(async (req, res) => {
  const ticket = await resolveTicket(req.params.ticketId, req.user);

  if (!ticket) {
    return fail(res, 404, "Support ticket not found", "NOT_FOUND");
  }

  if (req.user.role !== "admin" && ticket.driverId.toString() !== req.user._id.toString()) {
    return fail(res, 403, "Access denied to this ticket", "FORBIDDEN");
  }

  const senderRole = req.user.role === "admin" ? "agent" : "driver";
  const newMsg = {
    messageId: "msg_" + Math.random().toString(36).substring(2, 9),
    senderId: req.user._id,
    senderRole,
    senderName: req.user.fullName || (senderRole === "agent" ? "ReadyGo Support Agent" : "Driver"),
    message: req.body.message,
    attachmentKeys: req.body.attachmentKeys || [],
    createdAt: new Date()
  };

  ticket.messages.push(newMsg);

  // If driver replied to a resolved/waiting ticket, reopen
  if (senderRole === "driver" && ["RESOLVED", "WAITING_FOR_DRIVER"].includes(ticket.status)) {
    ticket.status = "OPEN";
  }

  await ticket.save();

  return ok(res, {
    ticketId: ticket.ticketId,
    status: ticket.status,
    message: newMsg
  }, "Message sent to support ticket");
}));

// 25.1.8 POST /driver/support/live-chat/sessions
const liveChatSchema = z.object({
  category: z.string().default("RIDE_ISSUES"),
  initialMessage: z.string().optional()
});

router.post("/driver/support/live-chat/sessions", requireAuth, allowRoles("driver", "admin", "rider"), validateBody(liveChatSchema), asyncHandler(async (req, res) => {
  // Check for any ongoing active or queued session
  let session = await LiveChatSession.findOne({
    driverId: req.user._id,
    status: { $in: ["QUEUED", "ASSIGNED", "ACTIVE"] }
  });

  if (!session) {
    const sessionId = "chat_" + Math.random().toString(36).substring(2, 9);
    session = await LiveChatSession.create({
      sessionId,
      driverId: req.user._id,
      category: req.body.category || "RIDE_ISSUES",
      initialMessage: req.body.initialMessage || "Driver connected to support chat.",
      status: "QUEUED",
      queuePosition: 1,
      estimatedWaitSeconds: 45
    });
  }

  return ok(res, {
    sessionId: session.sessionId,
    status: session.status,
    queuePosition: session.queuePosition,
    estimatedWaitSeconds: session.estimatedWaitSeconds,
    agent: session.agent,
    startedAt: session.startedAt
  }, "Live support chat session requested");
}));

// 25.1.9 GET /driver/support/live-chat/sessions/:sessionId
router.get("/driver/support/live-chat/sessions/:sessionId", requireAuth, allowRoles("driver", "admin", "rider"), asyncHandler(async (req, res) => {
  const session = await resolveChatSession(req.params.sessionId, req.user);

  if (!session) {
    return fail(res, 404, "Chat session not found", "NOT_FOUND");
  }

  return ok(res, {
    sessionId: session.sessionId,
    status: session.status,
    queuePosition: session.queuePosition,
    estimatedWaitSeconds: session.estimatedWaitSeconds,
    agent: session.agent,
    startedAt: session.startedAt
  }, "Chat session status retrieved");
}));

// 25.1.10 PATCH /driver/support/tickets/:ticketId/close
const closeTicketSchema = z.object({
  closingNote: z.string().optional()
});

router.patch("/driver/support/tickets/:ticketId/close", requireAuth, allowRoles("driver", "admin", "rider"), validateBody(closeTicketSchema), asyncHandler(async (req, res) => {
  const ticket = await resolveTicket(req.params.ticketId, req.user);

  if (!ticket) {
    return fail(res, 404, "Support ticket not found", "NOT_FOUND");
  }

  if (req.user.role !== "admin" && ticket.driverId.toString() !== req.user._id.toString()) {
    return fail(res, 403, "Access denied to this ticket", "FORBIDDEN");
  }

  ticket.status = "CLOSED";
  ticket.closingNote = req.body.closingNote || "Closed by driver";
  ticket.closedAt = new Date();
  ticket.closedBy = req.user._id;

  ticket.messages.push({
    messageId: "msg_" + Math.random().toString(36).substring(2, 9),
    senderId: req.user._id,
    senderRole: req.user.role === "admin" ? "agent" : "driver",
    senderName: req.user.fullName || "Driver",
    message: `Ticket closed. Note: ${ticket.closingNote}`,
    createdAt: new Date()
  });

  await ticket.save();

  return ok(res, {
    ticketId: ticket.ticketId,
    status: ticket.status,
    closingNote: ticket.closingNote,
    closedAt: ticket.closedAt
  }, "Support ticket closed successfully");
}));

export default router;

