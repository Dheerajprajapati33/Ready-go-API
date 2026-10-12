# Implementation status

## Working foundation
- Express app, MongoDB connection, common JSON envelopes, request ID, centralized error handler.
- OTP generation/verification, session/refresh token storage and JWT auth.
- Rider profile/preferences and device registration.
- Demo vehicle categories and straight-line fare estimate.
- Fare quote and ride request/history/read/cancel/receipt.
- Driver profile summary, availability, location heartbeat and trip listing.
- Ratings creation, summary distribution and paginated reviews.
- Basic driver performance calculation.
- Emergency contacts and SOS event creation/status lookup.
- Mock payment intent and protected admin starter endpoints.

## Deliberately incomplete / needs provider or business rules
- SMS delivery, real payment gateway, signed webhook verification, refunds, payout provider.
- Road route/geocoding/maps and real dispatch/driver offer engine.
- FCM/APNs notification delivery and SOS escalation to staffed safety desk/emergency contacts.
- Private object storage, signed uploads, malware scanning and document verification.
- Complete driver application/document/vehicle CRUD.
- Wallet ledger, earnings ledger, incentive rules, admin audit persistence.
- Acceptance/on-time metrics require dispatch offer and driver-arrival events.
- Shift analytics require shift start/end tracking.
- Production-grade idempotency, transaction handling and integration tests.
