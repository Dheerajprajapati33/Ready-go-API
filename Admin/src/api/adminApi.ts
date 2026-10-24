import axiosClient from './axiosClient';

// Dashboard Live Metrics API
export const getDashboardStats = () => axiosClient.get('/admin/dashboard/stats');

// Driver KYC Applications API
export const getDriverApplications = (params?: {
  city?: string;
  status?: string;
  category?: string;
  page?: number;
  limit?: number;
}) => axiosClient.get('/admin/driver-applications', { params });

export const getDriverApplicationById = (id: string) =>
  axiosClient.get(`/admin/driver-applications/${id}`);

export const reviewDriverApplication = (
  id: string,
  data: { decision: 'APPROVED' | 'REJECTED' | 'ACTION_REQUIRED' | 'UNDER_REVIEW'; remarks?: string }
) => axiosClient.post(`/admin/driver-applications/${id}/review`, data);

export const verifyDriverDocument = (
  id: string,
  data: { status: 'VERIFIED' | 'REJECTED' | 'UNDER_REVIEW'; rejectionReason?: string; remarks?: string }
) => axiosClient.patch(`/admin/documents/${id}/verification`, data);

export const getDriverDocuments = (params?: { driverId?: string; documentType?: string; status?: string }) =>
  axiosClient.get('/admin/documents', { params });

// Rides & Dispatch Operations API
export const getAdminRides = (params?: {
  status?: string;
  categoryId?: string;
  page?: number;
  limit?: number;
}) => axiosClient.get('/admin/rides', { params });

export const manualAssignRide = (
  rideId: string,
  data: { driverId: string; reason?: string }
) => axiosClient.post(`/admin/rides/${rideId}/assign`, data);

// Safety & SOS Control Room API
export const getSafetyEvents = () => axiosClient.get('/admin/safety/events');

export const assignSafetyEvent = (
  eventId: string,
  data?: { responderId?: string; note?: string }
) => axiosClient.post(`/safety/events/${eventId}/assign`, data || {});

export const resolveSafetyEvent = (
  eventId: string,
  data?: { note?: string }
) => axiosClient.post(`/safety/events/${eventId}/resolve`, data || {});

export const acknowledgeSafetyEvent = (
  eventId: string,
  data?: { note?: string }
) => axiosClient.post(`/safety/events/${eventId}/acknowledge`, data || {});

// Promos & Marketing API
export const getAdminPromos = (params?: { isActive?: boolean; page?: number; limit?: number }) =>
  axiosClient.get('/admin/promos', { params });

export const createAdminPromo = (data: {
  code: string;
  title?: string;
  description?: string;
  discountType: 'PERCENTAGE' | 'FLAT';
  discountValue: number;
  maxDiscount?: number;
  minOrderValue?: number;
  usageLimit?: number;
  applicableCategories?: string[];
  validUntil?: string;
}) => axiosClient.post('/admin/promos', data);

// Fare Rules API
export const getFareRules = () => axiosClient.get('/admin/fare-rules');

export const updateFareRule = (ruleId: string, data: Record<string, unknown>) =>
  axiosClient.patch(`/admin/fare-rules/${ruleId}`, data);

// Finance & Payment Reconciliation API
export const getPaymentReconciliation = (params?: {
  fromDate?: string;
  toDate?: string;
  status?: string;
  paymentMethod?: string;
  purpose?: string;
  search?: string;
  page?: number;
  limit?: number;
}) => axiosClient.get('/admin/payments/reconciliation', { params });

// Audit Logs API
export const getAdminAuditLogs = (params?: {
  actorId?: string;
  action?: string;
  resourceType?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}) => axiosClient.get('/admin/audit-logs', { params });

