export const validateBody = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({
    success: false, message: "Validation failed", code: "VALIDATION_ERROR",
    details: parsed.error.issues.map(i => ({ field: i.path.join("."), message: i.message }))
  });
  req.body = parsed.data;
  next();
};
