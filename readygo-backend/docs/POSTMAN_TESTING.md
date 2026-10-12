# Postman quick test

Set variable `baseUrl = http://localhost:5000/api/v1`.

1. `POST {{baseUrl}}/auth/otp/send`
```json
{"countryCode":"+91","phone":"9876543210","purpose":"login"}
```
Check backend terminal for `[DEV OTP]`.

2. `POST {{baseUrl}}/auth/otp/verify`
```json
{"countryCode":"+91","phone":"9876543210","otp":"<terminal-otp>","deviceId":"device-001"}
```
Copy `data.accessToken` into `accessToken` variable.

3. Set `Authorization: Bearer {{accessToken}}` for protected requests.

4. `GET {{baseUrl}}/rider/profile`

5. `POST {{baseUrl}}/fares/quote`
```json
{"pickup":{"latitude":28.6139,"longitude":77.2090,"address":"Pickup"},"dropoff":{"latitude":28.5355,"longitude":77.3910,"address":"Drop"}}
```
Copy `data.quoteId` and one `data.options[0].categoryId`.

6. `POST {{baseUrl}}/rides`
```json
{"quoteId":"<quoteId>","categoryId":"moto","paymentMethodId":"cash"}
```

7. SOS: `POST {{baseUrl}}/safety/sos`
```json
{"latitude":12.9716,"longitude":77.5946,"accuracyMeters":8,"message":"Test only","triggerSource":"HOLD_BUTTON"}
```
Only test SOS in a controlled development environment; notification delivery is not configured.

## Driver testing
For local development only, use `role:"driver"` in OTP verify for a new phone. Then a driver profile is created as DRAFT. Admin approval needs an existing admin account/DB update in local dev; do not allow clients to self-assign roles in production.
