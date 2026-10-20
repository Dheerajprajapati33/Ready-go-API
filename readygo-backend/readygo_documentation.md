# 🚕 ReadyGo API Documentation (Tested Postman Modules Only)

> **Postman Collection Name:** `Ride_Ready_Go`  
> **Base URL:** `http://localhost:5000/api/v1`  
> **Postman File Link:** [readygo_collection.json](file:///c:/Users/DELL/Downloads/ReadyGo_Backend_Starter/readygo-backend/readygo_collection.json)  
> **Language:** English & Hinglish (Step-by-Step Complete Guide)

Is documentation me **sirf aur sirf wahi modules aur endpoints include kiye gaye hain jo abhi tak Postman me test aur implement hue hain**:
1. **`RiderPage(User)`** — Customer/Rider Flow
2. **`DriverPage`** — Driver Partner Flow
3. **`Realtime Events (Socket.IO)`** — Real-time tracking & offers setup guide

---

## ⚙️ Postman Setup & Variables (Auto-Save Feature)

Collection me har request ke sath **Test Scripts** attached hain, isliye aapko tokens copy-paste karne ki zaroorat nahi hai:

| Variable Name | Default Value | Description |
| :--- | :--- | :--- |
| `baseUrl` | `http://localhost:5000/api/v1` | ReadyGo backend API root URL |
| `socketUrl` | `ws://localhost:5000/socket.io/?EIO=4&transport=websocket` | Real-time WebSocket connection URL |
| `riderToken` | *(Auto-Saved)* | Rider login hone ke baad auto-save ho jata hai |
| `driverToken` | *(Auto-Saved)* | Driver login hone ke baad auto-save ho jata hai |
| `rideId` | *(Auto-Saved)* | Nayi ride request create hone par auto-save hota hai |
| `offerId` | *(Auto-Saved)* | Driver offers check karne par auto-save hota hai |
| `tripId` | *(Auto-Saved)* | Single trip detail test karne ke liye |
| `ratingId` | `rating_123` | Single rating lookup & report review ke liye |
| `incentiveId` | `inc_daily_10` | Daily quest incentive details dekhne ke liye |
| `eventId` | *(Auto-Saved)* | Safety SOS alert create hone par auto-save hota hai |
| `contactId` | *(Auto-Saved)* | Emergency contact add karne par auto-save hota hai |
| `paymentId` | *(Auto-Saved)* | Payment intent create hone par auto-save hota hai |

---

# 📱 PART 1: RiderPage(User)

Rider module me 6 core sub-folders hain:

```
RiderPage(User)
├── 1. auth (Login, OTP, Switch Role, Logout)
├── 2. Rider Profile (Profile, Avatar, Preferences, Referral)
├── 3. prvc (Nearby Drivers Map & Vehicle Categories)
├── 4. promotion & discount (Eligible Promos, Validate, Apply to Ride)
├── 5. ridebooking & lifecycle (Book Ride, Cancel, Status, Location, Receipt)
└── 6. Rating & Review (Submit Review, View Rating)
```

---

## 🟢 1. `auth` (Rider Authentication & Session Lifecycle)

> 📌 **Workflow Steps:**  
> **Start:** User Phone Input ➡️ **Step 1.1:** `otp/send` ➡️ **Step 1.2:** `Verify OTP` (Auto-saves `{{riderToken}}`) ➡️ **Step 1.3:** `Register` (FCM Push Token) ➡️ **Step 1.4:** `Refresh Token` ➡️ **Step 1.5:** `switch-role` ➡️ **End:** `Logout`

---

### 1.1 `POST /auth/otp/send` — [STEP 1.1: WORK START]
- **Purpose:** Rider mobile number par 6-digit verification OTP send karta hai.
- **Auth Required:** `NO`
- **Request Body:**
```json
{
  "countryCode": "+91",
  "phone": "9876543210",
  "purpose": "login"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "phone": "+919876543210",
    "expiresInSeconds": 300
  },
  "message": "OTP sent"
}
```
*(Dev Mode Note: OTP backend terminal par `[DEV OTP] +919876543210: 123456` print hota hai).*

---

### 1.2 `POST /auth/otp/verify` — [STEP 1.2: VERIFY OTP & SAVE RIDER TOKEN]
- **Purpose:** OTP verify karke user login karta hai aur JWT tokens return karta hai.
- **Request Body:**
```json
{
  "countryCode": "+91",
  "phone": "9876543210",
  "otp": "123456",
  "deviceId": "device-rider-001",
  "role": "rider"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "isNewUser": false,
    "user": {
      "id": "6707a1b9e4b01...",
      "phone": "+919876543210",
      "role": "rider",
      "profileCompleted": true
    }
  },
  "message": "Login successful"
}
```
*(Test script automatically saves `data.accessToken` to `{{riderToken}}`).*

---

### 1.3 `POST /auth/devices/register` — [STEP 1.3: REGISTER PUSH DEVICE]
- **Purpose:** Push notifications (FCM / APNs) ke liye mobile device token register karta hai.
- **Headers:** `Authorization: Bearer {{riderToken}}`
- **Request Body:**
```json
{
  "deviceId": "device-rider-001",
  "platform": "android",
  "pushToken": "fcm_token_rider_xyz789"
}
```

---

### 1.3b `DELETE /devices/:deviceId` — [STEP 1.3b: UNREGISTER DEVICE]
- **Purpose:** User ke registered push notification device ko unregister / delete karta hai.
- **URL:** `DELETE {{baseUrl}}/devices/:deviceId` (ya `DELETE {{baseUrl}}/auth/devices/:deviceId`)
- **Headers:** `Authorization: Bearer {{riderToken}}`

---

### 1.4 `POST /auth/token/refresh` — [STEP 1.4: REFRESH EXPIRED TOKEN]
- **Purpose:** Jab access token expire ho jaye to background me silent call karke naya access token leta hai.
- **Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 1.5 `POST /auth/switch-role` — [STEP 1.5: SWITCH ROLE TO RIDER]
- **Purpose:** Active token se user ka role instantly `"rider"` switch karta hai.
- **Headers:** `Authorization: Bearer {{riderToken}}`
- **Request Body:**
```json
{
  "role": "rider"
}
```

---

### 1.6 `POST /auth/logout` — [STEP 1.6: LOGOUT - AUTH WORK END]
- **Purpose:** Session invalidate karke database se logout karta hai.
- **Headers:** `Authorization: Bearer {{riderToken}}`
- **Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## 🟢 2. `Rider Profile` (Profile Management)

> 📌 **Workflow Steps:**  
> **Start:** Profile Screen ➡️ **Step 2.1:** `getprofile` ➡️ **Step 2.2:** `updateprofile` ➡️ **Step 2.3:** `updatepreference` ➡️ **Step 2.4:** `avatar` (Upload URL) ➡️ **End:** `referalcode` (Validate Friend's Code)

---

### 2.1 `GET /rider/profile` — [STEP 2.1: WORK START]
- **Purpose:** Rider profile data fetch karta hai.
- **Headers:** `Authorization: Bearer {{riderToken}}`
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "6707a1b9e4b01...",
    "phone": "+919876543210",
    "fullName": "Rahul Sharma",
    "email": "rahul@example.com",
    "avatarUrl": "https://picsum.photos/seed/2/150",
    "referralCode": "RAHUL2026",
    "profileCompleted": true
  }
}
```

---

### 2.2 `PATCH /rider/profile` — [STEP 2.2: UPDATE PROFILE]
- **Purpose:** Full name, email, avatar image URL update karta hai.
- **Headers:** `Authorization: Bearer {{riderToken}}`
- **Request Body:**
```json
{
  "fullName": "Rahul Sharma",
  "email": "rahul@example.com",
  "avatarUrl": "https://picsum.photos/seed/2/150",
  "referralCode": "RAHUL2026"
}
```

---

### 2.3 `PATCH /rider/preferences` — [STEP 2.3: NOTIFICATION SETTINGS]
- **Purpose:** WhatsApp aur Push notifications toggle karta hai.
- **Headers:** `Authorization: Bearer {{riderToken}}`
- **Request Body:**
```json
{
  "whatsAppUpdatesEnabled": true,
  "ridePushEnabled": true
}
```

---

### 2.4 `POST /rider/avatar/upload-url` — [STEP 2.4: GENERATE AVATAR UPLOAD URL]
- **Purpose:** Presigned upload URL aur avatar URL return karta hai.
- **Headers:** `Authorization: Bearer {{riderToken}}`
- **Request Body:**
```json
{
  "fileName": "https://picsum.photos/seed/2/150",
  "contentType": "image/jpeg"
}
```

---

### 2.5 `GET /rider/referrals/:code/validate` — [STEP 2.5: VALIDATE REFERRAL CODE - WORK END]
- **Purpose:** Signup discount ke liye dost ka referral code check karta hai.
- **URL:** `GET {{baseUrl}}/rider/referrals/READY2026/validate`
- **Headers:** `Authorization: Bearer {{riderToken}}`
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "code": "READY2026",
    "referrerName": "ReadyGo Promo",
    "discountBonus": 50
  },
  "message": "Referral code is valid"
}
```

---

## 🟢 3. `prvc (Nearby Drivers & Vehicles)`

> 📌 **Workflow Steps:**  
> **Start:** Map Screen Open ➡️ **Step 3.1:** `nearbydriver` (Show moving drivers) ➡️ **End:** `categoryid` (Show vehicle base fares)

---

### 3.1 `GET /drivers/nearby` — [STEP 3.1: WORK START]
- **Purpose:** Rider map screen par 5km radius me online available drivers (moto, auto, mini) fetch karta hai with bearings and ETA.
- **URL:** `GET {{baseUrl}}/drivers/nearby?latitude=28.6139&longitude=77.2090&radiusKm=5`
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "count": 3,
    "drivers": [
      {
        "driverId": "demo_driver_1",
        "name": "Ramesh Kumar",
        "vehicleCategory": "moto",
        "latitude": 28.6169,
        "longitude": 77.211,
        "bearing": 45,
        "rating": 4.9,
        "distanceKm": 0.4,
        "etaMinutes": 2
      }
    ]
  },
  "message": "Nearby drivers retrieved"
}
```

---

### 3.2 `GET /vehicle-categories/:categoryId` — [STEP 3.2: VEHICLE CATEGORY PRICING - WORK END]
- **Purpose:** Specific vehicle type (`moto`, `auto`, `mini`, `prime`) ka base fare aur per km rate fetch karta hai.
- **URL:** `GET {{baseUrl}}/vehicle-categories/moto`
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "moto",
    "name": "ReadyGo Moto",
    "etaMinutes": 3,
    "baseFarePaise": 5000,
    "perKmPaise": 1800
  }
}
```

---

## 🟢 4. `promotion & discount` (Coupons & Offers)

> 📌 **Workflow Steps:**  
> **Start:** Offers Screen ➡️ **Step 4.1:** `eligiblepromos` ➡️ **Step 4.2:** `validatepromos` ➡️ **Step 4.3:** `promoride` (Apply to active ride) ➡️ **End:** `removepromo` (Remove from ride)

---

### 4.1 `GET /promos/eligible` — [STEP 4.1: WORK START]
- **Purpose:** Active promo discount coupons ki list fetch karta hai (`READY50`, `SAVE20`).
- **URL:** `GET {{baseUrl}}/promos/eligible`

---

### 4.2 `POST /promos/validate` — [STEP 4.2: VALIDATE PROMO CODE]
- **Purpose:** Promo coupon check karta hai aur discount calculate karta hai.
- **Request Body:**
```json
{
  "code": "READY50",
  "quoteId": "quote_123",
  "categoryId": "moto"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "code": "READY50",
    "title": "50% Off First Ride",
    "discountPaise": 5000,
    "discountAmount": 50,
    "quoteId": "quote_123",
    "categoryId": "moto"
  },
  "message": "Promo code applied successfully"
}
```

---

### 4.3 `POST /rides/:rideId/promo` — [STEP 4.3: APPLY PROMO CODE TO RIDE]
- **Purpose:** Ongoing ride me coupon code lagata hai aur total fare discount update karta hai.
- **URL:** `POST {{baseUrl}}/rides/{{rideId}}/promo`
- **Headers:** `Authorization: Bearer {{riderToken}}`
- **Request Body:**
```json
{
  "code": "READY50",
  "quoteId": "quote_123",
  "categoryId": "moto"
}
```

---

### 4.4 `DELETE /rides/:rideId/promo` — [STEP 4.4: REMOVE PROMO - WORK END]
- **Purpose:** Applied promo code ko ride se hata kar regular fare restore karta hai.
- **URL:** `DELETE {{baseUrl}}/rides/{{rideId}}/promo`
- **Headers:** `Authorization: Bearer {{riderToken}}`

---

## 🟢 5. `ridebooking & lifecycle` (Booking Ride)

> 📌 **Workflow Steps:**  
> **Start:** Click 'Book Now' ➡️ **Step 5.1:** `ride` (Create ride booking) ➡️ **Step 5.2:** `riderrequest` (Get status) ➡️ **Step 5.3:** `ridelocation` (Track driver location) ➡️ **Step 5.4:** `cancleride` (Cancel if needed) ➡️ **Step 5.5:** `ridehistory` ➡️ **End:** `ridereceipt` (View Invoice)

---

### 5.1 `POST /rides` — [STEP 5.1: WORK START - REQUEST / BOOK RIDE]
- **Purpose:** Nayi ride create karta hai with status `"SEARCHING_DRIVER"`.
- **Headers:** `Authorization: Bearer {{riderToken}}`
- **Request Body:**
```json
{
  "quoteId": "quote_123",
  "categoryId": "moto",
  "paymentMethodId": "cash",
  "pickup": {
    "latitude": 28.6139,
    "longitude": 77.2090,
    "address": "Connaught Place, New Delhi"
  },
  "dropoff": {
    "latitude": 28.5355,
    "longitude": 77.3910,
    "address": "Sector 18, Noida"
  }
}
```
- **Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "_id": "670a5c12e4b01...",
    "riderId": "6707a1b9e4b01...",
    "categoryId": "moto",
    "status": "SEARCHING_DRIVER",
    "fareBreakdown": {
      "currency": "INR",
      "baseFarePaise": 5000,
      "totalPaise": 5000,
      "discountPaise": 0
    }
  },
  "message": "Ride requested; searching for nearby drivers"
}
```
*(Test script automatically saves `_id` to `{{rideId}}`).*

---

### 5.2 `POST /rides/:rideId/cancel` — [STEP 5.2: CANCEL RIDE]
- **Purpose:** Rider side se ride cancel karta hai with reason.
- **URL:** `POST {{baseUrl}}/rides/{{rideId}}/cancel`
- **Headers:** `Authorization: Bearer {{riderToken}}`
- **Request Body:**
```json
{
  "reason": "Driver taking too long"
}
```

---

### 5.3 `GET /rides/:rideId` — [STEP 5.3: GET RIDE STATUS]
- **Purpose:** Live trip status dekhta hai (`SEARCHING_DRIVER`, `DRIVER_ASSIGNED`, `DRIVER_ARRIVED`, `IN_PROGRESS`, `COMPLETED`).
- **URL:** `GET {{baseUrl}}/rides/{{rideId}}`
- **Headers:** `Authorization: Bearer {{riderToken}}`

---

### 5.4 `GET /rides/:rideId/tracking` — [STEP 5.4: TRACK DRIVER LOCATION & ETA]
- **Purpose:** Assigned driver ki live coordinates (latitude, longitude) aur navigation tracking return karta hai.
- **URL:** `GET {{baseUrl}}/rides/{{rideId}}/tracking`
- **Headers:** `Authorization: Bearer {{riderToken}}`

---

### 5.5 `GET /rider/rides` — [STEP 5.5: RIDER PAST RIDES HISTORY]
- **Purpose:** Rider ke past completed & active trips ki list fetch karta hai.
- **URL:** `GET {{baseUrl}}/rider/rides?page=1&limit=10`
- **Headers:** `Authorization: Bearer {{riderToken}}`

---

### 5.6 `GET /rides/:rideId/receipt` — [STEP 5.6: GET RIDE RECEIPT - WORK END]
- **Purpose:** Trip complete hone par final fare breakdown receipt invoice deta hai.
- **URL:** `GET {{baseUrl}}/rides/{{rideId}}/receipt`
- **Headers:** `Authorization: Bearer {{riderToken}}`

---

## 🟢 6. `Rating & Review` (Feedback)

> 📌 **Workflow Steps:**  
> **Start:** Ride Completed Screen ➡️ **Step 6.1:** `submitreview` (Give 1-5 Stars) ➡️ **End:** `viewriderating` (Check rating)

---

### 6.1 `POST /rides/:rideId/rating` — [STEP 6.1: SUBMIT REVIEW]
- **Purpose:** Completed ride ke baad driver ko star rating aur comment deta hai. Driver ki average rating auto-update ho jati hai.
- **URL:** `POST {{baseUrl}}/rides/{{rideId}}/rating`
- **Headers:** `Authorization: Bearer {{riderToken}}`
- **Request Body:**
```json
{
  "stars": 5,
  "comment": "Smooth ride, polite and safe driving!"
}
```

---

### 6.2 `GET /rides/:rideId/rating` — [STEP 6.2: VIEW SUBMITTED RATING - RIDER WORK END]
- **Purpose:** Submitted review verify karta hai.
- **URL:** `GET {{baseUrl}}/rides/{{rideId}}/rating`
- **Headers:** `Authorization: Bearer {{riderToken}}`

---

## 🟢 7. `Rider Safety Toolkit and Emergency SOS`

> 📌 **Workflow Steps:**  
> **Start:** Safety Hub ➡️ **Step 7.1:** `GET /rider/emergency-contacts` ➡️ **Step 7.2:** `POST /rider/emergency-contacts` ➡️ **Step 7.3:** `PATCH /rider/emergency-contacts/:id` ➡️ **Step 7.4:** `DELETE /rider/emergency-contacts/:id` ➡️ **Step 7.5:** `POST /safety/location-sharing` ➡️ **End:** `POST /safety/sos` (Emergency SOS Alert)

---

### 7.1 `GET /rider/emergency-contacts` — [GET EMERGENCY CONTACTS]
- **Purpose:** User ke registered trusted emergency contacts fetch karta hai.
- **URL:** `GET {{baseUrl}}/rider/emergency-contacts` (ya `GET {{baseUrl}}/safety/emergency-contacts`)
- **Headers:** `Authorization: Bearer {{riderToken}}`

---

### 7.2 `POST /rider/emergency-contacts` — [ADD EMERGENCY CONTACT]
- **Purpose:** Naya emergency contact add karta hai.
- **URL:** `POST {{baseUrl}}/rider/emergency-contacts` (ya `POST {{baseUrl}}/safety/emergency-contacts`)
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer {{riderToken}}`
- **Request Body:**
```json
{
  "name": "Family Contact",
  "phone": "+919876543210",
  "relationship": "Brother"
}
```

---

### 7.3 `PATCH /rider/emergency-contacts/:contactId` — [UPDATE EMERGENCY CONTACT]
- **Purpose:** Existing emergency contact ki details update karta hai.
- **URL:** `PATCH {{baseUrl}}/rider/emergency-contacts/:contactId` (ya `PATCH {{baseUrl}}/safety/emergency-contacts/:contactId`)
- **Headers:** `Authorization: Bearer {{riderToken}}`

---

### 7.4 `DELETE /rider/emergency-contacts/:contactId` — [DELETE EMERGENCY CONTACT]
- **Purpose:** Emergency contact remove karta hai.
- **URL:** `DELETE {{baseUrl}}/rider/emergency-contacts/:contactId` (ya `DELETE {{baseUrl}}/safety/emergency-contacts/:contactId`)
- **Headers:** `Authorization: Bearer {{riderToken}}`

---

### 7.5 `POST /safety/location-sharing` — [LIVE TRIP LOCATION SHARING]
- **Purpose:** Emergency contacts ke sath live ride tracking share enable/disable karta hai.
- **URL:** `POST {{baseUrl}}/safety/location-sharing`
- **Headers:** `Authorization: Bearer {{riderToken}}`
- **Request Body:**
```json
{
  "enabled": true,
  "rideId": "ride_123"
}
```

---

### 7.6 `POST /safety/sos` — [TRIGGER EMERGENCY SOS]
- **Purpose:** Panic / SOS trigger karta hai. Backend safety incident log karta hai aur rider ke phone par notification bhejta hai. `rideId` me MongoDB ObjectId ya custom test string (jaise `"ride_123"`) dono accept hota hai bina kisi CastError ke.
- **URL:** `POST {{baseUrl}}/safety/sos`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer {{riderToken}}`
- **Request Body:**
```json
{
  "rideId": "ride_123",
  "latitude": 12.9716,
  "longitude": 77.5946,
  "accuracyMeters": 8,
  "message": "Emergency assistance requested",
  "triggerSource": "HOLD_BUTTON"
}
```
- **Response (201 Created):**
```json
{
  "success": true,
  "message": "SOS emergency alert received successfully",
  "data": {
    "eventId": "6ad08...",
    "status": "OPEN",
    "rideId": "ride_123",
    "locationShared": true,
    "createdAt": "2026-10-15T10:10:25.000Z",
    "notificationStatus": "QUEUED"
  }
}
```

---

## 🟢 8. `Rider Payment & Wallet`

> 📌 **Workflow Steps:**  
> **Start:** Payment Screen ➡️ **Step 8.1:** `GET /payments/methods` ➡️ **Step 8.2:** `POST /payments/intents` ➡️ **Step 8.3:** `POST /payments/:paymentId/confirm` ➡️ **Step 8.4:** `GET /rider/wallet` ➡️ **End:** `POST /rider/wallet/topups`

---

### 8.1 `GET /payments/methods` — [GET PAYMENT METHODS]
- **Purpose:** Supported payment options (UPI, Card, Wallet, Cash) list return karta hai.
- **URL:** `GET {{baseUrl}}/payments/methods`
- **Headers:** `Authorization: Bearer {{riderToken}}`
- **Response:**
```json
{
  "success": true,
  "message": "Payment methods retrieved",
  "data": [
    { "id": "upi", "type": "UPI", "enabled": true, "title": "UPI (Google Pay, PhonePe, Paytm)" },
    { "id": "card", "type": "CARD", "enabled": true, "title": "Credit / Debit Card" },
    { "id": "wallet", "type": "WALLET", "enabled": true, "title": "ReadyGo Wallet" },
    { "id": "cash", "type": "CASH", "enabled": true, "title": "Cash on Drop" }
  ]
}
```

---

### 8.2 `POST /payments/intents` — [CREATE PAYMENT INTENT]
- **Purpose:** Ride payment ya wallet topup ke liye payment intent create karta hai. `rideId` me MongoDB ObjectId ya custom test string (jaise `"ride_123"`) dono accept hota hai bina kisi CastError ke.
- **URL:** `POST {{baseUrl}}/payments/intents`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer {{riderToken}}`
- **Request Body:**
```json
{
  "purpose": "RIDE_PAYMENT",
  "rideId": "ride_123",
  "paymentMethodId": "wallet_123"
}
```
- **Response (201 Created):**
```json
{
  "success": true,
  "message": "Payment intent created",
  "data": {
    "paymentId": "6ad0c...",
    "status": "PENDING",
    "amountPaise": 18500,
    "amount": 185,
    "currency": "INR",
    "purpose": "RIDE_PAYMENT",
    "provider": "mock",
    "clientSecret": "pi_mock_..._secret"
  }
}
```

---

### 8.3 `POST /payments/:paymentId/confirm` — [CONFIRM PAYMENT]
- **Purpose:** Payment success confirm karke status `SUCCEEDED` karta hai aur associated ride ko `PAID` mark karta hai.
- **URL:** `POST {{baseUrl}}/payments/{{paymentId}}/confirm` (ya `POST {{baseUrl}}/payments/confirm`)
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer {{riderToken}}`
- **Request Body (optional if URL has ID):**
```json
{
  "paymentId": "{{paymentId}}"
}
```
- **Response:**
```json
{
  "success": true,
  "message": "Payment confirmed successfully",
  "data": {
    "paymentId": "6ad0c...",
    "status": "SUCCEEDED",
    "amount": 185,
    "currency": "INR",
    "paidAt": "2026-10-15T..."
  }
}
```

---

### 8.4 `GET /rider/wallet` — [GET WALLET BALANCE]
- **Purpose:** Current rider ka wallet balance aur currency return karta hai.
- **URL:** `GET {{baseUrl}}/rider/wallet`
- **Headers:** `Authorization: Bearer {{riderToken}}`

---

### 8.5 `GET /rider/wallet/transactions` — [WALLET TRANSACTIONS LEDGER]
- **Purpose:** Wallet debit/credit transactions list karta hai.
- **URL:** `GET {{baseUrl}}/rider/wallet/transactions`
- **Headers:** `Authorization: Bearer {{riderToken}}`

---

### 8.6 `POST /rider/wallet/topups` — [WALLET TOP-UP]
- **Purpose:** Wallet balance top-up karta hai.
- **URL:** `POST {{baseUrl}}/rider/wallet/topups`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer {{riderToken}}`
- **Request Body:**
```json
{
  "amount": 500
}
```

---

# 🚗 PART 2: DriverPage

Driver module me 6 core sub-folders hain:

```
DriverPage
├── 1. auth (Driver Login, Profile, Online/Offline Availability, Location Ping)
├── 2. driverbooking & lifecycle (Offers, Accept, Reject, Arrived, Start, Complete, Tracking)
├── 3. Rating & Review (Ratings Summary, Reviews List, Single Rating, Report Review)
├── 4. DriverPerformancestatus (Performance Score, Trends, Shifts, Score Breakdown)
├── 5. driverdashboard & earning (Dashboard Summary, Daily/Weekly/Monthly Earnings, Breakdown, Trips, Incentives)
└── 6. driver wallet & payouts (Wallet Balance, Ledger Transactions, Saved UPI/Bank Accounts, Verification, Withdrawals)
```

---

## 🟢 1. `auth` (Driver Auth & Availability)

> 📌 **Workflow Steps:**  
> **Start:** Driver App Open ➡️ **Step 1.0:** `otp send` (Send Driver OTP) ➡️ **Step 1.1:** `Verify OTP (Driver)` (Saves `{{driverToken}}`) ➡️ **Step 1.1b:** `Driver Auth Me` ➡️ **Step 1.2:** `Driver Profile` ➡️ **Step 1.3:** `Driver Availability Online/Offline` ➡️ **End:** `Driver Location Ping`

---

### 1.0 `POST /driver/auth/otp/send` — [STEP 1.0: WORK START - DRIVER SEND OTP]
- **Purpose:** Driver app me mobile number verify karne ke liye OTP bhejta hai.
- **URL:** `POST {{baseUrl}}/driver/auth/otp/send`
- **Request Body:**
```json
{
  "countryCode": "+91",
  "phone": "9876543212",
  "purpose": "login"
}
```
- **Dev Mode:** Terminal me `[DEV OTP] [DRIVER] +919876543212: XXXXXX` print hota hai.

---

### 1.1 `POST /driver/auth/otp/verify` — [STEP 1.1: DRIVER LOGIN & AUTO-APPROVE PROFILE]
- **Purpose:** Driver OTP verify karke authenticate hota hai. Backend automatically `DriverProfile` ko APPROVED aur ONLINE initialize kar deta hai.
- **URL:** `POST {{baseUrl}}/driver/auth/otp/verify`
- **Request Body:**
```json
{
  "countryCode": "+91",
  "phone": "9876543212",
  "otp": "123456",
  "deviceId": "device-driver-001"
}
```
*(Test script automatically saves `accessToken` to `{{driverToken}}`).*

---

### 1.1b `GET /driver/auth/me` — [STEP 1.1b: GET CURRENT LOGGED-IN DRIVER]
- **Purpose:** Current authenticated driver user aur driverProfile details fetch karta hai.
- **URL:** `GET {{baseUrl}}/driver/auth/me`
- **Headers:** `Authorization: Bearer {{driverToken}}`

---

### 1.2 `GET /driver/profile` — [STEP 1.2: GET DRIVER PROFILE]
- **Purpose:** Driver applicationStatus, availability, averageRating aur totalRatings return karta hai.
- **URL:** `GET {{baseUrl}}/driver/profile`
- **Headers:** `Authorization: Bearer {{driverToken}}`

---

### 1.3 `PATCH /driver/availability` — [STEP 1.3: GO ONLINE / OFFLINE]
- **Purpose:** Driver duty status toggle karta hai.
- **URL:** `PATCH {{baseUrl}}/driver/availability`
- **Headers:** `Authorization: Bearer {{driverToken}}`
- **Request Body:**
```json
{
  "status": "ONLINE",
  "vehicleCategory": "moto"
}
```

---

### 1.4 `POST /driver/location` — [STEP 1.4: BROADCAST GPS LOCATION]
- **Purpose:** Mobile app se periodic GPS coordinates backend ko bhejta hai.
- **URL:** `POST {{baseUrl}}/driver/location`
- **Headers:** `Authorization: Bearer {{driverToken}}`
- **Request Body:**
```json
{
  "latitude": 28.6139,
  "longitude": 77.2090,
  "heading": 90,
  "speedMps": 10.5
}
```

---

### 1.4b `POST /driver/auth/devices/register` — [REGISTER DRIVER DEVICE PUSH TOKEN]
- **Purpose:** Driver mobile app ke Firebase Cloud Messaging (FCM) push token ko register / update karta hai. Iske baad driver ko profile submit, ride offer, ride cancel, etc. ke push alerts receive hote hain.
- **URL:** `POST {{baseUrl}}/driver/auth/devices/register` (ya `POST {{baseUrl}}/driver/devices/register`)
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer {{driverToken}}`
- **Request Body:**
```json
{
  "deviceId": "device-driver-001",
  "platform": "android",
  "pushToken": "fcm_token_driver_xyz789"
}
```

---

### 1.4c `GET /driver/auth/devices` — [GET REGISTERED DRIVER DEVICES]
- **Purpose:** Driver ke saare registered devices aur push tokens fetch karta hai.
- **URL:** `GET {{baseUrl}}/driver/auth/devices` (ya `GET {{baseUrl}}/driver/devices`)
- **Headers:** `Authorization: Bearer {{driverToken}}`

---

### 1.4d `DELETE /driver/auth/devices/:deviceId` — [UNREGISTER DRIVER DEVICE]
- **Purpose:** Driver device ko unregister / delete karta hai.
- **URL:** `DELETE {{baseUrl}}/driver/auth/devices/:deviceId` (ya `DELETE {{baseUrl}}/driver/devices/:deviceId`)
- **Headers:** `Authorization: Bearer {{driverToken}}`

---

### 1.4e `POST /driver/auth/devices/test-push` — [TEST DRIVER PUSH NOTIFICATION - WORK END]
- **Purpose:** Driver ke registered device par test push notification trigger karta hai.
- **URL:** `POST {{baseUrl}}/driver/auth/devices/test-push`
- **Headers:** `Authorization: Bearer {{driverToken}}`
- **Request Body:**
```json
{
  "title": "Profile Submitted",
  "body": "Your profile submitted successfully"
}
```

---

## 🟢 1.5 `Driver Application & Onboarding` (Pilot Registration, Documents & Review)

> 📌 **Workflow Steps:**  
> **Start:** Onboarding Requirements ➡️ **Step 1.5a:** `GET /driver/onboarding/requirements` ➡️ **Step 1.5b:** `POST /driver/applications` (Create pilot application) ➡️ **Step 1.5c:** `POST /uploads/presign` ➡️ **Step 1.5d:** `POST /driver/applications/me/documents` ➡️ **Step 1.5e:** `GET /driver/applications/me` ➡️ **Step 1.5f:** `PATCH /driver/applications/me` ➡️ **Step 1.5g:** `POST /driver/applications/me/submit` ➡️ **End:** `GET /driver/applications/me/status` (Timeline)

---

### 1.5a `GET /driver/onboarding/requirements` — [GET ONBOARDING REQUIREMENTS]
- **Purpose:** City aur vehicle category ke hisab se required documents list aur vehicle guidelines fetch karta hai.
- **URL:** `GET {{baseUrl}}/driver/onboarding/requirements?city=Bengaluru&vehicleCategory=moto`
- **Query Params:** `city`, `vehicleCategory` (optional)
- **Response Data:**
  - `documents`: List of required documents (`DRIVING_LICENSE`, `VEHICLE_RC`, `VEHICLE_INSURANCE`, `AADHAAR`, `PAN_CARD`).
  - `vehicleGuidelines`: `minYear`, `maxAgeYears`, `allowedCategories`, `commercialPermitRequired`.
  - `eligibilityCriteria`: `minAge`, `validLicense`, `smartphoneRequired`.

---

### 1.5b `POST /driver/applications` — [CREATE PILOT APPLICATION]
- **Purpose:** Pilot application create karta hai with city & vehicle details. Agar user ka role abhi rider hai, to automatic elevate hokar `driver` ho jata hai.
- **URL:** `POST {{baseUrl}}/driver/applications` (ya `POST http://localhost:5000/api/driver/applications`)
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer {{driverToken}}`
- **Request Body:**
```json
{
  "city": "Bengaluru",
  "vehicleCategory": "moto",
  "make": "Honda",
  "model": "Activa 6G",
  "registrationNumber": "KA04EM9201",
  "color": "Silver"
}
```
- **Response:** Application ID, vehicle details, aur onboarding progress status (`25%`).

---

### 1.5c `GET /driver/applications/me` — [GET APPLICATION DETAILS & PROGRESS]
- **Purpose:** Driver application details, vehicle details, uploaded documents checklist, aur percentage progress return karta hai.
- **URL:** `GET {{baseUrl}}/driver/applications/me`
- **Headers:** `Authorization: Bearer {{driverToken}}`
- **Response Data:**
  - `applicationId`, `applicationStatus`, `city`, `vehicleCategory`, `vehicle`
  - `progress`: `{ completedSteps, totalSteps, percent, currentStep }`
  - `documentsCount`, `documents`, `requiredDocuments`

---

### 1.5d `PATCH /driver/applications/me` — [UPDATE APPLICATION DETAILS]
- **Purpose:** Final submission se pehle editable application details (city, vehicle make, model, registrationNumber, color) update karta hai.
- **URL:** `PATCH {{baseUrl}}/driver/applications/me`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer {{driverToken}}`
- **Request Body:**
```json
{
  "city": "Bengaluru",
  "vehicleCategory": "moto",
  "make": "Honda",
  "model": "Activa 6G",
  "registrationNumber": "KA04EM9201",
  "color": "Matte Black"
}
```

---

### 1.5e `POST /uploads/presign` — [PRESIGN UPLOAD URL]
- **Purpose:** Driver Driving License, RC, Insurance ya Aadhaar upload ke liye presigned URL aur fileKey return karta hai.
- **URL:** `POST {{baseUrl}}/uploads/presign`
- **Headers:** `Authorization: Bearer {{driverToken}}`
- **Request Body:**
```json
{
  "fileName": "license-front.jpg",
  "contentType": "image/jpeg",
  "sizeBytes": 1200000,
  "purpose": "DRIVER_DOCUMENT",
  "documentType": "DRIVING_LICENSE"
}
```

---

### 1.5f `POST /driver/applications/me/documents` — [REGISTER DRIVER DOCUMENT]
- **Purpose:** Uploaded document metadata ko driver profile ke sath attach aur verify karta hai.
- **URL:** `POST {{baseUrl}}/driver/applications/me/documents`
- **Headers:** `Authorization: Bearer {{driverToken}}`
- **Request Body:**
```json
{
  "documentType": "DRIVING_LICENSE",
  "fileKey": "{{fileKey}}",
  "side": "FRONT",
  "maskedNumber": "XXXX-XXXX-1234",
  "expiryDate": "2028-12-31"
}
```

---

### 1.5g `GET /driver/applications/me/documents` — [GET DRIVER DOCUMENTS LIST]
- **Purpose:** Current driver ke saare registered documents fetch karta hai.
- **URL:** `GET {{baseUrl}}/driver/applications/me/documents`
- **Headers:** `Authorization: Bearer {{driverToken}}`

---

### 1.5h `POST /driver/applications/me/submit` — [SUBMIT COMPLETED APPLICATION]
- **Purpose:** Completed application ko review ke liye submit karta hai. Backend driver profile ko approve karke online enable karta hai aur push notification bhejta hai.
- **URL:** `POST {{baseUrl}}/driver/applications/me/submit`
- **Headers:** `Authorization: Bearer {{driverToken}}`
- **Response:**
```json
{
  "success": true,
  "message": "Driver application submitted and approved",
  "data": {
    "applicationId": "...",
    "applicationStatus": "APPROVED",
    "availability": "ONLINE",
    "progress": {
      "completedSteps": 4,
      "totalSteps": 4,
      "percent": 100,
      "currentStep": "APPROVED"
    }
  }
}
```

---

### 1.5i `GET /driver/applications/me/status` — [GET APPLICATION STATUS TIMELINE]
- **Purpose:** Application review timeline (APPLICATION_CREATED, DOCUMENTS_SUBMITTED, VERIFICATION, READY_TO_DRIVE) fetch karta hai.
- **URL:** `GET {{baseUrl}}/driver/applications/me/status`
- **Headers:** `Authorization: Bearer {{driverToken}}`
- **Response Data:**
  - `applicationStatus`, `isApproved`, `progress`
  - `timeline`: Array of 4 review stages with their status (`COMPLETED`, `IN_PROGRESS`, `PENDING`) and timestamps.

---

### 1.5j `GET /driver/vehicle` & `PATCH /driver/vehicle` — [DRIVER VEHICLE]
- **Purpose:** Driver vehicle details fetch aur update karta hai.
- **URL:** `GET {{baseUrl}}/driver/vehicle` / `PATCH {{baseUrl}}/driver/vehicle`
- **Headers:** `Authorization: Bearer {{driverToken}}`
- **Request Body for PATCH:**
```json
{
  "registrationNumber": "KA04EM9201",
  "vehicleType": "moto"
}
```

---

## 🟢 2. `driverbooking & lifecycle` (Full Trip Lifecycle)

> 📌 **Workflow Steps:**  
> **Start:** Receive Ride ➡️ **Step 2.1:** `driveroffer` ➡️ **Step 2.2:** `acceptoffer` / `rejectoffer` ➡️ **Step 2.3:** `driverarrived` ➡️ **Step 2.4:** `startride` ➡️ **Step 2.5:** `completeride` ➡️ **End:** `driverridedetail` / `drivertracking`

---

### 2.1 `GET /driver/offers` — [STEP 2.1: WORK START - VIEW INCOMING OFFERS]
- **Purpose:** Searching rides list karta hai. Pehle offer ka ID `{{offerId}}` variable me auto-save ho jata hai.
- **URL:** `GET {{baseUrl}}/driver/offers`
- **Headers:** `Authorization: Bearer {{driverToken}}`

---

### 2.2 `POST /driver/offers/:offerId/accept` — [STEP 2.2: ACCEPT OFFER]
- **Purpose:** Driver ride accept karta hai. Status ho jata hai `DRIVER_ASSIGNED`.
- **URL:** `POST {{baseUrl}}/driver/offers/{{offerId}}/accept`
- **Headers:** `Authorization: Bearer {{driverToken}}`

---

### 2.3 `POST /driver/offers/:offerId/reject` — [STEP 2.3: REJECT OFFER]
- **Purpose:** Driver ride offer reject karta hai.
- **URL:** `POST {{baseUrl}}/driver/offers/{{offerId}}/reject`
- **Headers:** `Authorization: Bearer {{driverToken}}`
- **Request Body:**
```json
{
  "reason": "Pickup distance too far"
}
```

---

### 2.4 `POST /driver/rides/:rideId/arrived` — [STEP 2.4: MARK DRIVER ARRIVED]
- **Purpose:** Driver pickup spot par pahunch chuka hai. Status ho jata hai `DRIVER_ARRIVED`.
- **URL:** `POST {{baseUrl}}/driver/rides/{{rideId}}/arrived`
- **Headers:** `Authorization: Bearer {{driverToken}}`

---

### 2.5 `POST /driver/rides/:rideId/start` — [STEP 2.5: START RIDE]
- **Purpose:** Rider baithne ke baad ride start karta hai. Status ho jata hai `IN_PROGRESS`.
- **URL:** `POST {{baseUrl}}/driver/rides/{{rideId}}/start`
- **Headers:** `Authorization: Bearer {{driverToken}}`

---

### 2.6 `POST /driver/rides/:rideId/complete` — [STEP 2.6: COMPLETE RIDE]
- **Purpose:** Destination par pahunch kar trip complete mark karta hai. Status ho jata hai `COMPLETED`. Kamayi driver ke ledger me add hoti hai.
- **URL:** `POST {{baseUrl}}/driver/rides/{{rideId}}/complete`
- **Headers:** `Authorization: Bearer {{driverToken}}`

---

### 2.7 `GET /driver/rides/:rideId` — [STEP 2.7: GET DRIVER RIDE DETAILS]
- **Purpose:** Ride ke pickup, dropoff aur fare details check karta hai.
- **URL:** `GET {{baseUrl}}/driver/rides/{{rideId}}`
- **Headers:** `Authorization: Bearer {{driverToken}}`

---

### 2.8 `GET /driver/rides/:rideId/tracking` — [STEP 2.8: TRIP TRACKING - WORK END]
- **Purpose:** Live trip navigation coordinates aur status monitor karta hai.
- **URL:** `GET {{baseUrl}}/driver/rides/{{rideId}}/tracking`
- **Headers:** `Authorization: Bearer {{driverToken}}`

---

## 🟢 3. `Rating & Review` (Driver Reviews & Moderation)

> 📌 **Workflow Steps:**  
> **Start:** Reviews Screen ➡️ **Step 3.1:** `ratingssummary` ➡️ **Step 3.2:** `recentreviewrating` ➡️ **Step 3.3:** `singleratingdetails` ➡️ **End:** `reportreview` (Report Unfair Review)

---

### 3.1 `GET /driver/ratings/summary` — [STEP 3.1: WORK START]
- **Purpose:** Overall 5-star distribution aur average rating show karta hai.
- **URL:** `GET {{baseUrl}}/driver/ratings/summary`
- **Headers:** `Authorization: Bearer {{driverToken}}`

---

### 3.2 `GET /driver/ratings` — [STEP 3.2: PAGINATED REVIEWS LIST]
- **Purpose:** Riders dwara diye gaye feedback comments aur stars list karta hai.
- **URL:** `GET {{baseUrl}}/driver/ratings?page=1&limit=10`
- **Headers:** `Authorization: Bearer {{driverToken}}`

---

### 3.3 `GET /driver/ratings/:ratingId` — [STEP 3.3: GET SINGLE RATING DETAIL]
- **Purpose:** Kisi ek rating ka detail fetch karta hai. Supports dummy ID (e.g. `rating_123`) smoothly without CastError.
- **URL:** `GET {{baseUrl}}/driver/ratings/{{ratingId}}`
- **Headers:** `Authorization: Bearer {{driverToken}}`

---

### 3.4 `POST /driver/ratings/:ratingId/report` — [STEP 3.4: REPORT UNFAIR REVIEW - WORK END]
- **Purpose:** Galat ya abusive review ko report karta hai admin moderation ke liye. Status ban jata hai `UNDER_REVIEW`.
- **URL:** `POST {{baseUrl}}/driver/ratings/{{ratingId}}/report`
- **Headers:** `Authorization: Bearer {{driverToken}}`
- **Request Body:**
```json
{
  "reason": "abusive",
  "description": "Customer was verbally aggressive and left an unfair 1-star rating."
}
```

---

## 🟢 4. `DriverPerformancestatus` (Driver Score & Shifts)

> 📌 **Workflow Steps:**  
> **Start:** Performance Tab ➡️ **Step 4.1:** `driverperformance` (Score 0-100) ➡️ **Step 4.2:** `score-breakdown` ➡️ **Step 4.3:** `trends` ➡️ **End:** `shifts`

---

### 4.1 `GET /driver/performance` — [STEP 4.1: WORK START - DRIVER PERFORMANCE SCORE]
- **Purpose:** Driver score (0-100), Tier (`PRO_PILOT` / `PILOT` / `STANDARD`), completion rate aur cancellation rate calculate karta hai.
- **URL:** `GET {{baseUrl}}/driver/performance?period=30d`
- **Headers:** `Authorization: Bearer {{driverToken}}`

---

### 4.2 `GET /driver/performance/score-breakdown` — [STEP 4.2: SCORE CALCULATION BREAKDOWN]
- **Purpose:** Score calculation weights aur metrics definitions deta hai.
- **URL:** `GET {{baseUrl}}/driver/performance/score-breakdown`
- **Headers:** `Authorization: Bearer {{driverToken}}`

---

### 4.3 `GET /driver/performance/trends` — [STEP 4.3: PERFORMANCE TRENDS]
- **Purpose:** Weekly performance trend analytics graph data deta hai.
- **URL:** `GET {{baseUrl}}/driver/performance/trends?period=week`
- **Headers:** `Authorization: Bearer {{driverToken}}`

---

### 4.4 `GET /driver/performance/shifts` — [STEP 4.4: SHIFTS ANALYTICS - WORK END]
- **Purpose:** Working shift hours aur trips per hour analysis deta hai.
- **URL:** `GET {{baseUrl}}/driver/performance/shifts`
- **Headers:** `Authorization: Bearer {{driverToken}}`

---

## 🟢 5. `driverdashboard & earning` (Kamayi & Quests)

> 📌 **Workflow Steps:**  
> **Start:** Earnings Screen ➡️ **Step 5.1:** `driverdashboardsummary` ➡️ **Step 5.2:** `dailyearnings` / `weeklyearning` / `monthlyearning` ➡️ **Step 5.3:** `earningbreakdown` ➡️ **Step 5.4:** `drivertriphistory` / `singletripdetail` ➡️ **Step 5.5:** `driverincentivetrip` ➡️ **End:** `incentivedetails` (Target & Bonus)

---

### 5.1 `GET /driver/dashboard/summary` — [STEP 5.1: WORK START - COMPREHENSIVE DASHBOARD SUMMARY]
- **Purpose:** Driver home screen ke liye today's earnings, completed trips, online hours aur lifetime earnings show karta hai.
- **URL:** `GET {{baseUrl}}/driver/dashboard/summary`
- **Headers:** `Authorization: Bearer {{driverToken}}`
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "fullName": "Driver",
    "availability": "ONLINE",
    "applicationStatus": "APPROVED",
    "today": {
      "completedTrips": 4,
      "earningsAmount": 350,
      "onlineHours": 5.2
    },
    "lifetime": {
      "totalTrips": 28,
      "totalEarningsAmount": 1250
    },
    "rating": {
      "averageRating": 4.85,
      "totalRatings": 18
    }
  },
  "message": "Driver dashboard summary retrieved"
}
```

---

### 5.2 `GET /driver/earnings/daily`, `weekly`, `monthly` — [STEP 5.2: PERIOD EARNINGS]
- **Daily:** `GET {{baseUrl}}/driver/earnings/daily`
- **Weekly:** `GET {{baseUrl}}/driver/earnings/weekly`
- **Monthly:** `GET {{baseUrl}}/driver/earnings/monthly`
- **Headers:** `Authorization: Bearer {{driverToken}}`

---

### 5.3 `GET /driver/earnings/breakdown` — [STEP 5.3: ITEMIZED EARNINGS BREAKDOWN]
- **Purpose:** Itemized kamayi show karta hai: Base Fare + Distance Fare + Surge + Tips + Incentives Bonus minus Platform Deductions.
- **URL:** `GET {{baseUrl}}/driver/earnings/breakdown?period=week`
- **Headers:** `Authorization: Bearer {{driverToken}}`

---

### 5.4 `GET /driver/trips` & `GET /driver/trips/:tripId` — [STEP 5.4: TRIPS HISTORY]
- **All Trips:** `GET {{baseUrl}}/driver/trips?status=COMPLETED&limit=20`
- **Single Trip Detail:** `GET {{baseUrl}}/driver/trips/{{tripId}}`
- **Headers:** `Authorization: Bearer {{driverToken}}`

---

### 5.5 `GET /driver/incentives` — [STEP 5.5: ACTIVE INCENTIVES / QUESTS]
- **Purpose:** Active daily/weekly quest targets (e.g. Complete 10 Trips for ₹500 Bonus) list karta hai. Auto-saves `incentiveId`.
- **URL:** `GET {{baseUrl}}/driver/incentives`
- **Headers:** `Authorization: Bearer {{driverToken}}`

---

### 5.6 `GET /driver/incentives/:incentiveId` — [STEP 5.6: INCENTIVE TARGET DETAILS - WORK END]
- **Purpose:** Target trips, completed trips, progress percentage aur reward cash bonus details fetch karta hai (ID: `inc_daily_10`).
- **URL:** `GET {{baseUrl}}/driver/incentives/{{incentiveId}}`
- **Headers:** `Authorization: Bearer {{driverToken}}`
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "inc_daily_10",
    "title": "Daily Ride Goal",
    "description": "Complete 10 trips today between 6 AM to 11 PM",
    "targetTrips": 10,
    "completedTrips": 4,
    "rewardAmount": 500,
    "currency": "INR",
    "status": "IN_PROGRESS"
  },
  "message": "Incentive details retrieved successfully"
}
```

---

## 🟢 6. `driver wallet & payouts` (Driver Wallet, Ledger & Withdrawals)

> 📌 **Workflow Steps:**  
> **Start:** Check Balance ➡️ **Step 6.1:** `GET /driver/wallet` ➡️ **Step 6.2:** `GET /driver/wallet/transactions` ➡️ **Step 6.3:** `GET /driver/payout-accounts` ➡️ **Step 6.4:** `POST /driver/payout-accounts/upi` (Auto-saves `{{destinationId}}`) ➡️ **Step 6.5:** `POST /driver/payout-accounts/bank` ➡️ **Step 6.6:** `POST /driver/payout-accounts/:id/verify` ➡️ **Step 6.7:** `POST /driver/payouts` (Auto-saves `{{payoutId}}`) ➡️ **Step 6.8:** `GET /driver/payouts` ➡️ **End:** `GET /driver/payouts/:id`

---

### 6.1 `GET /driver/wallet` — [STEP 6.1: WORK START - DRIVER WALLET BALANCE]
- **Purpose:** Driver ka available balance, currency aur last credited transaction detail fetch karta hai.
- **URL:** `GET {{baseUrl}}/driver/wallet`
- **Headers:** `Authorization: Bearer {{driverToken}}`
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "currency": "INR",
    "availableBalancePaise": 483250,
    "availableBalance": 4832.5,
    "lastCredited": {
      "amountPaise": 30650,
      "type": "TRIP_PAYOUT",
      "createdAt": "2026-10-20T06:01:00.000Z"
    }
  },
  "message": "Driver wallet retrieved successfully"
}
```

---

### 6.2 `GET /driver/wallet/transactions` — [STEP 6.2: WALLET TRANSACTIONS LEDGER]
- **Purpose:** Append-only ledger transactions (Trip payouts, surge bonuses, incentives aur withdrawals) fetch karta hai.
- **URL:** `GET {{baseUrl}}/driver/wallet/transactions?page=1&limit=10`
- **Headers:** `Authorization: Bearer {{driverToken}}`
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "671401f8...",
        "type": "CREDIT",
        "category": "TRIP_PAYOUT",
        "description": "Trip payout",
        "referenceId": "ride_101",
        "amountPaise": 30650,
        "amount": 306.5,
        "balanceAfterPaise": 483250,
        "currency": "INR",
        "createdAt": "2026-10-20T06:01:00.000Z"
      },
      {
        "id": "671401f9...",
        "type": "CREDIT",
        "category": "SURGE_BONUS",
        "description": "Peak hour surge",
        "amountPaise": 4500,
        "amount": 45,
        "balanceAfterPaise": 452600,
        "currency": "INR",
        "createdAt": "2026-10-20T04:00:00.000Z"
      },
      {
        "id": "671401fa...",
        "type": "DEBIT",
        "category": "BANK_TRANSFER",
        "description": "IMPS bank transfer",
        "amountPaise": 200000,
        "amount": 2000,
        "balanceAfterPaise": 448100,
        "currency": "INR",
        "createdAt": "2026-10-19T12:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 3,
      "totalPages": 1
    }
  },
  "message": "Wallet transactions retrieved successfully"
}
```

---

### 6.3 `GET /driver/payout-accounts` — [STEP 6.3: LIST SAVED DESTINATIONS]
- **Purpose:** Saved UPI aur Bank accounts return karta hai with sensitive data masked (`********8231`, `dr***@okaxis`).
- **URL:** `GET {{baseUrl}}/driver/payout-accounts`
- **Headers:** `Authorization: Bearer {{driverToken}}`

---

### 6.4 `POST /driver/payout-accounts/upi` — [STEP 6.4: SAVE UPI DESTINATION]
- **Purpose:** Driver ka UPI VPA ID save karta hai.
- **URL:** `POST {{baseUrl}}/driver/payout-accounts/upi`
- **Headers:** `Authorization: Bearer {{driverToken}}`
- **Request Body:**
```json
{
  "upiId": "driver@okaxis",
  "accountType": "UPI"
}
```
- **Response (201 Created):**
```json
{
  "success": true,
  "message": "UPI destination saved; verification required",
  "data": {
    "destinationId": "671402a1...",
    "id": "671402a1...",
    "type": "UPI",
    "maskedUpiId": "dr***@okaxis",
    "verificationStatus": "PENDING",
    "isDefault": false
  }
}
```
*(Test script automatically saves `destinationId`).*

---

### 6.5 `POST /driver/payout-accounts/bank` — [STEP 6.5: SAVE BANK ACCOUNT]
- **Purpose:** Account holder name, account number aur IFSC save karta hai.
- **URL:** `POST {{baseUrl}}/driver/payout-accounts/bank`
- **Headers:** `Authorization: Bearer {{driverToken}}`
- **Request Body:**
```json
{
  "accountHolderName": "Rajesh Kumar",
  "accountNumber": "50100234918231",
  "ifscCode": "HDFC0001234",
  "accountType": "BANK"
}
```
- **Response (201 Created):**
```json
{
  "success": true,
  "message": "Bank destination saved; verification required",
  "data": {
    "destinationId": "671402b5...",
    "id": "671402b5...",
    "type": "BANK",
    "accountHolderName": "Rajesh Kumar",
    "maskedAccountNumber": "********8231",
    "ifscCode": "HDFC0001234",
    "verificationStatus": "PENDING",
    "isDefault": false
  }
}
```

---

### 6.6 `POST /driver/payout-accounts/:destinationId/verify` — [STEP 6.6: VERIFY DESTINATION]
- **Purpose:** Payout destination ko verify karta hai (`PENDING` ➔ `VERIFIED`).
- **URL:** `POST {{baseUrl}}/driver/payout-accounts/{{destinationId}}/verify`
- **Headers:** `Authorization: Bearer {{driverToken}}`
- **Request Body:**
```json
{
  "verificationMethod": "PROVIDER"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "destinationId": "671402b5...",
    "id": "671402b5...",
    "verificationStatus": "VERIFIED",
    "verificationReference": "verify_1729428123456"
  },
  "message": "Payout destination verified successfully"
}
```

---

### 6.7 `POST /driver/payouts` — [STEP 6.7: REQUEST WITHDRAWAL]
- **Purpose:** Verified account me atomic balance deduction ke sath payout request create karta hai.
- **URL:** `POST {{baseUrl}}/driver/payouts`
- **Headers:**  
  `Authorization: Bearer {{driverToken}}`  
  `Idempotency-Key: payout_req_123456`
- **Request Body:**
```json
{
  "amountPaise": 200000,
  "destinationId": "{{destinationId}}",
  "mode": "INSTANT"
}
```
- **Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "payoutId": "671403c9...",
    "id": "671403c9...",
    "amountPaise": 200000,
    "currency": "INR",
    "mode": "INSTANT",
    "status": "REQUESTED"
  },
  "message": "Payout requested successfully"
}
```
*(Test script automatically saves `payoutId`).*

---

### 6.8 `GET /driver/payouts` — [STEP 6.8: LIST DRIVER PAYOUTS]
- **Purpose:** Driver ki sabhi payout requests aur unka status fetch karta hai.
- **URL:** `GET {{baseUrl}}/driver/payouts?page=1&limit=10`
- **Headers:** `Authorization: Bearer {{driverToken}}`

---

### 6.9 `GET /driver/payouts/:payoutId` — [STEP 6.9: GET SINGLE PAYOUT STATUS - WORK END]
- **Purpose:** Kisi single withdrawal request ka live status (`REQUESTED`, `PROCESSING`, `PAID`) check karta hai.
- **URL:** `GET {{baseUrl}}/driver/payouts/{{payoutId}}`
- **Headers:** `Authorization: Bearer {{driverToken}}`

---

# ⚡ PART 3: Realtime Events (Socket.IO Setup in Postman)

ReadyGo Section 9.1 ke complete Real-time Events architecture, Socket.IO handshake authentication, room membership authorization, aur data sanitization ka complete guide.

```
9.1 Realtime Events Overview:
1. ride:status          -> rideId, status, changedAt
2. ride:driver_assigned -> rideId, driver summary, vehicle summary, ETA
3. ride:location        -> rideId, latitude, longitude, heading, recordedAt
4. driver:offer         -> offerId, ride summary, pickup distance, expiry
5. safety:sos_status    -> eventId, status, updatedAt
6. payment:status       -> paymentId, status, amountPaise
```

---

## 🔒 1. Security, Authentication & Room Authorization

### A. Socket Handshake Authentication
* Har socket connection ko authenticate karne ke liye JWT Access Token zaroori hai.
* Token `socket.handshake.auth.token` ya `headers.authorization` (`Bearer <token>`) se verify hota hai.
* Backend token decode karke user identity (`userId`, `role`) check karta hai aur verify karta hai ki `user.status === "ACTIVE"`.
* Unauthorized ya expired tokens turant connection level par `Authentication error` ke sath reject ho jate hain.

### B. Room Membership Authorization
* **Personal User Rooms:** Connection bante hi socket apne isolated personal room me auto-join hota hai:
  * Rider: `room:rider_{{riderId}}`
  * Driver: `room:driver_{{driverId}}`
  * Admin / Safety Desk: `room:safety_desk`
* **Ride Room (`room:ride_{{rideId}}`):**
  * Client ko trip updates lene ke liye `ride:join` event bhejna hota hai (`{"rideId": "..."}`).
  * Backend verify karta hai ki requesting user us ride ka authorized **Rider**, **Driver**, ya **Safety/Admin** hai ya nahi. Kisi aur user ko access deny (`FORBIDDEN`) kiya jata hai.

### C. Data Sanitization & Privacy Protection
* **Driver Assignment (`ride:driver_assigned`):** Rider ko sirf public summary (name, avatar, vehicle plate/model, rating, ETA) milti hai. Driver ke private KYC documents, Aadhaar, ya home address filter out ho jate hain.
* **Driver Offer (`driver:offer`):** Nearby drivers ko sirf pickup/drop approximate area aur fare milta hai. Rider ka personal contact number offer accept hone se pehle reveal nahi hota.
* **Payment (`payment:status`):** Payment card details ya gateway secrets leak nahi hote; sirf `paymentId`, `status`, aur `amountPaise` broadcast hota hai.

---

## 🔌 2. Postman me Real-time Socket kaise connect karein:

### Method A: Postman Native Socket.IO (Recommended)
1. Postman me top-left **New** ➡️ **Socket.IO** select karein.
2. Connection URL me daalein:
   ```
   http://localhost:5000
   ```
3. Version dropdown me **v4** select karein.
4. **Auth** tab me **Bearer Token** select karein aur `{{riderToken}}` (ya `{{driverToken}}`) paste karein.
5. **Connect** par click karein. Postman screen par `Connected` badge dikhega.

### Method B: Raw WebSocket
1. Postman me top-left **New** ➡️ **WebSocket Request** select karein.
2. URL:
   ```
   {{socketUrl}}
   (Default: ws://localhost:5000/socket.io/?EIO=4&transport=websocket)
   ```
3. **Headers** tab me header add karein:
   ```
   Authorization: Bearer {{riderToken}}   (ya {{driverToken}})
   ```
4. **Connect** par click karein.

---

## 📡 3. Event Listeners, Payloads & Triggers

| Event Name | Direction | Room / Target | Payload Outline | Trigger Postman Request |
| :--- | :--- | :--- | :--- | :--- |
| **`ride:status`** | Server ➡️ Room | `room:ride_{{rideId}}` | `rideId, status, changedAt` | `POST /rides/cancel`, `POST /driver/rides/:id/arrived`, `POST /driver/rides/:id/start`, `POST /driver/rides/:id/complete` |
| **`ride:driver_assigned`** | Server ➡️ Rider | `room:rider_{{riderId}}` | `rideId, driver, vehicle, eta` | `POST /driver/offers/:offerId/accept` |
| **`ride:location`** | Driver ➡️ Server ➡️ Rider | `room:ride_{rideId}` | `rideId, latitude, longitude, heading, recordedAt` | Driver Socket Event `ride:location` ya `POST /driver/location` |
| **`driver:offer`** | Server ➡️ Driver | `room:driver_{{driverId}}` | `offerId, ride, pickupDistance, expiry` | `POST /rides` (New Ride Request) |
| **`safety:sos_status`** | Server ➡️ Desk / Rider | `room:safety_desk` & Rider Room | `eventId, status, updatedAt` | `POST /safety/sos`, `POST /safety/events/:id/acknowledge`, `POST /safety/events/:id/resolve` |
| **`payment:status`** | Server ➡️ Rider | `room:ride_{{rideId}}` | `paymentId, status, amountPaise` | `POST /payments/:paymentId/confirm` |

---

## 📲 4. Inbound Client Events (Client ➡️ Server)

### 1. `ride:join` (Join Trip Room)
* **Payload:**
```json
{
  "rideId": "6ad08..."
}
```
* **Server Acknowledgment:**
```json
{
  "success": true,
  "message": "Joined ride room for 6ad08...",
  "rideId": "6ad08..."
}
```

### 2. `ride:location` (Driver Live Coordinates)
* **Payload (Zod Validated & Throttled to max 1 update / 300ms):**
```json
{
  "rideId": "6ad08...",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "heading": 90,
  "recordedAt": "2026-10-15T12:00:00.000Z"
}
```

---

## 📱 5. Flutter Client Integration
Flutter developers ke liye complete guide aur ready-to-use Singleton `SocketService` class `FLUTTER_SOCKET_SETUP_GUIDE.md` me available hai:
* [FLUTTER_SOCKET_SETUP_GUIDE.md](file:///c:/Users/DELL/Downloads/ReadyGo_Backend_Starter/readygo-backend/FLUTTER_SOCKET_SETUP_GUIDE.md)

---

## 🛠️ FAQ & Troubleshooting

1. **`CastError: Cast to ObjectId failed for value "rating_123"`?**  
   Backend me safe lookup handler laga diya gaya hai. Agar aap dummy ID (`rating_123`, `inc_daily_10`) bhejte hain, tab bhi backend 200 OK ke sath mock detail return karta hai aur crash nahi hota.

2. **`Driver must be approved before going online`?**  
   Jab aap `POST /auth/otp/verify` me `role: "driver"` select karte hain, backend automatically profile ko `APPROVED` aur `ONLINE` initialize kar deta hai.

3. **`riderToken` aur `driverToken` alag hain ya same?**  
   Postman collection me dono ke liye alag variables (`{{riderToken}}` aur `{{driverToken}}`) set hain. Jab aap Rider OTP verify karenge toh `riderToken` update hoga, aur jab Driver OTP verify karenge toh `driverToken` update hoga. Dono bilkul separate aur conflict-free hain.

4. **Socket Handshake Rejected with `Authentication error`?**  
   Check karein ki Postman Auth tab me `Bearer {{riderToken}}` pass ho raha hai aur token valid aur unexpired hai.


