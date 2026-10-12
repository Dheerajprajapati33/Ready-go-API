export const ok = (res, data = {}, message = "OK", status = 200) =>
  res.status(status).json({ success: true, message, data, requestId: res.locals.requestId });

export const fail = (res, status, message, code = "ERROR", details = []) =>
  res.status(status).json({ success: false, message, code, details, requestId: res.locals.requestId });
