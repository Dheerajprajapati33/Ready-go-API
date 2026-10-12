# ReadyGo Backend

Node.js + Express + MongoDB/Mongoose API based on **ReadyGo Complete API Documentation v2.0**.

## 1. Requirements
- Node.js 20+
- MongoDB Community/Atlas
- Postman or Thunder Client

## 2. Setup
```bash
npm install
cp .env.example .env
# Edit .env and set secrets/MONGODB_URI
npm run dev
```
Base URL: `http://localhost:5000/api/v1`  
Health check: `GET http://localhost:5000/health`

### Development OTP
When `OTP_DEV_MODE=true`, the OTP is printed in the backend terminal for local testing. Never use this mode in production. Production requires an SMS provider and proper OTP delivery.

### First login flow
1. `POST /api/v1/auth/otp/send` with `{ "countryCode":"+91", "phone":"9876543210", "purpose":"login" }`
2. Read OTP from terminal (development only).
3. `POST /api/v1/auth/otp/verify` with `{ "countryCode":"+91", "phone":"9876543210", "otp":"123456", "deviceId":"device-001", "role":"rider" }`
4. Copy `accessToken` from response.
5. In Postman, set `Authorization: Bearer <accessToken>`.

For driver/admin access, do not let public clients self-assign privileged roles in production. The `role` input is for local development only; restrict it before deployment.

## 3. Structure
```text
src/
  app.js
  server.js
  config/db.js
  middleware/             # auth, RBAC, errors, validation
  models/                 # Mongoose collections
  modules/
    auth/                 # OTP, sessions and devices
    users/                # rider/driver profiles
    fares/                # categories and quote calculation (demo formula)
    rides/                # booking lifecycle
    safety/               # emergency contacts and SOS events
    ratings/              # reviews and rating distribution
    performance/          # driver metrics summary
    driver/               # availability, GPS, onboarding summary
    payments/             # mock intent only; gateway adapter required
    admin/                # protected operational endpoints
  utils/
```

## 4. Implemented foundation
- API versioning, common response envelope, request IDs, centralized errors.
- JWT access tokens, hashed refresh tokens, hashed OTP challenges and rate limiting.
- MongoDB models and ownership/role middleware.
- Rider profile/preferences, fare quotes, booking lifecycle, SOS/contact management,
  driver availability/location, ratings and performance summary.
- Mock fare/payment implementations are clearly marked. They are not production payment,
  maps, dispatch, SMS, push, document verification or file-storage integrations.

## 5. Key endpoints
| Method | Endpoint | Auth |
|---|---|---|
| GET | `/health` | Public |
| POST | `/auth/otp/send` | Public |
| POST | `/auth/otp/verify` | Public |
| POST | `/auth/token/refresh` | Public |
| POST | `/auth/logout` | User |
| GET/PATCH | `/rider/profile` | User |
| PATCH | `/rider/preferences` | User |
| GET | `/vehicle-categories` | Public |
| POST | `/fares/quote` | User |
| POST | `/rides` | Rider |
| GET | `/rides/:rideId` | Ride participant/admin |
| POST | `/rides/:rideId/cancel` | Ride participant |
| GET | `/rider/rides` | Rider |
| PATCH | `/driver/availability` | Approved driver |
| POST | `/driver/location` | Approved driver |
| GET | `/driver/ratings/summary` | Driver |
| GET | `/driver/ratings` | Driver |
| POST | `/rides/:rideId/rating` | Rider |
| GET | `/driver/performance` | Driver |
| POST | `/safety/sos` | Authenticated user |
| GET | `/safety/events/:eventId` | Event owner/admin |
| GET | `/driver/dashboard` | Driver |
| GET | `/payments/methods` | Authenticated user |
| POST | `/payments/intents` | Authenticated user |
| GET | `/admin/safety/events` | Admin/safety |

## 6. Important production tasks
Before launch, implement a real SMS OTP provider, payment gateway and signed webhooks, map/routing provider, dispatch engine, FCM/APNs, private object storage, document scanning/verification, payout provider, SOS escalation workflows, audit logs and automated tests. Configure TLS, secret manager, monitoring, backups, data retention and legal/privacy requirements.

Do not use the sample ratings, fares, earnings or contacts in the documentation as real production data.
