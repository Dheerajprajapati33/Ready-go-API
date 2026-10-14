import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { ok } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { validateBody } from "../../middleware/validate.js";

const router = Router();

const presignSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().optional().default("image/jpeg"),
  sizeBytes: z.number().positive().optional(),
  purpose: z.string().optional().default("DRIVER_DOCUMENT"),
  documentType: z.string().optional()
}).passthrough();

const handlePresign = asyncHandler(async (req, res) => {
  const uploadId = `upl_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const fileName = req.body?.fileName || "upload.jpg";
  const fileExt = fileName.includes(".") ? fileName.split(".").pop() : "jpg";
  const contentType = req.body?.contentType || "image/jpeg";
  const purpose = (req.body?.purpose || "DRIVER_DOCUMENT").toLowerCase();
  
  const fileKey = `${purpose}/${uploadId}/${fileName}`;
  const uploadUrl = `https://storage.readygo.internal/upload/${uploadId}/${encodeURIComponent(fileName)}`;
  const fileUrl = `https://storage.readygo.internal/documents/${uploadId}/${encodeURIComponent(fileName)}`;
  const documentUrl = fileUrl;

  return ok(res, {
    uploadId,
    fileKey,
    uploadUrl,
    fileUrl,
    documentUrl,
    fileName,
    contentType,
    sizeBytes: req.body?.sizeBytes || 1024000,
    purpose: req.body?.purpose || "DRIVER_DOCUMENT",
    documentType: req.body?.documentType || "DRIVING_LICENSE",
    expiresInSeconds: 900
  }, "Presigned upload URL generated successfully");
});

router.post("/presign", validateBody(presignSchema), handlePresign);
router.post("/upload-url", validateBody(presignSchema), handlePresign);
router.post("/", validateBody(presignSchema), handlePresign);
router.get("/presign", handlePresign);

export default router;

