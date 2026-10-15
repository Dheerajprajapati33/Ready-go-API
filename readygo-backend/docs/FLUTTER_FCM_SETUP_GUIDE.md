# ReadyGo - Flutter FCM Push Notification Setup Guide 📱🔔

Yeh guide Frontend (Flutter) developer ke liye step-by-step complete guide hai taaki wo **ReadyGo Mobile App** me Firebase Cloud Messaging (FCM) push notifications receive kar sakein aur backend ke sath device token sync kar sakein.

---

## 📌 Workflow Overview

```
+----------------------------------------------------------------------------------+
|                             FLUTTER MOBILE APP                                   |
+----------------------------------------------------------------------------------+
  1. App start -> Firebase.initializeApp()
  2. User notification permission allow karta hai
  3. FirebaseMessaging.instance.getToken() -> Real FCM Token milta hai
  4. User login/OTP verify hone par backend ko token bhejna:
     POST /api/v1/auth/devices/register
  5. Jab profile complete hoti hai:
     Backend notification trigger karta hai -> Phone screen par pop-up show hota hai!
```

---

## 🚀 Step 1: Firebase Console Setup (Project: `readygo-b9be6`)

Aapka backend already Firebase project **`readygo-b9be6`** se connected hai. Frontend ko bhi usi project se jodna hai:

1. [Firebase Console](https://console.firebase.google.com/) par jaiye aur project **`readygo-b9be6`** open kijiye.
2. **Android App Add Karein:**
   - Android icon par click karein.
   - Package name dalein (e.g., `com.readygo.app` - jo aapke `android/app/build.gradle` me `applicationId` hai).
   - **`google-services.json`** file download karein.
   - Is file ko Flutter project me yahan paste karein:
     ```
     android/app/google-services.json
     ```
3. *(Optional) iOS App ke liye:*
   - iOS icon par click karke **`GoogleService-Info.plist`** download karein aur `ios/Runner/` folder me dalein.

---

## 📦 Step 2: Flutter Dependencies (`pubspec.yaml`)

Apne Flutter project ke `pubspec.yaml` me ye packages add karein:

```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # Firebase Core & Messaging
  firebase_core: ^3.8.0
  firebase_messaging: ^15.1.5
  
  # Foreground Notification pop-up dikhane ke liye
  flutter_local_notifications: ^18.0.1
  
  # Device info & HTTP requests
  device_info_plus: ^11.1.1
  http: ^1.2.2
```

Terminal me run karein:
```bash
flutter pub get
```

---

## ⚙️ Step 3: Android Native Configuration

### 1. `android/build.gradle` (Project Level)
`dependencies` block me Google services classpath check karein:
```groovy
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.4.2'
    }
}
```

### 2. `android/app/build.gradle` (App Level)
Sabse upar ya plugins me google-services apply karein:
```groovy
apply plugin: 'com.android.application'
apply plugin: 'com.google.gms.google-services' // <-- Yeh line add karein
```

### 3. `android/app/src/main/AndroidManifest.xml`
`<manifest>` tag ke andar permissions add karein:
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Push Notification Permissions -->
    <uses-permission android:name="android.permission.INTERNET"/>
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>

    <application
        android:label="ReadyGo"
        android:name="${applicationName}"
        android:icon="@mipmap/ic_launcher">

        <!-- Default Notification Channel & Icon -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_channel_id"
            android:value="readygo_high_importance_channel" />

        <!-- Baaki activities ... -->
    </application>
</manifest>
```

---

## 💻 Step 4: Complete Flutter Notification Service Code

Apne Flutter project me ek nayi file banayein: `lib/services/fcm_service.dart`

```dart
import 'dart:io';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:http/http.dart' as http;

// 1. Background notification handler (Must be top-level function)
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  if (kDebugMode) {
    print("🔔 Background notification received: ${message.notification?.title}");
  }
}

class FCMService {
  static final FCMService _instance = FCMService._internal();
  factory FCMService() => _instance;
  FCMService._internal();

  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();

  // Notification Channel ID
  static const AndroidNotificationChannel _channel = AndroidNotificationChannel(
    'readygo_high_importance_channel',
    'ReadyGo Notifications',
    description: 'Used for important ride and profile updates',
    importance: Importance.max,
    playSound: true,
  );

  /// Service initialize karna
  Future<void> initialize() async {
    // 1. Request User Permission
    NotificationSettings settings = await _fcm.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      if (kDebugMode) print("✅ User granted notification permission");
    } else {
      if (kDebugMode) print("⚠️ Notification permission not granted");
    }

    // 2. Set Background message handler
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    // 3. Setup Local Notifications (Foreground me popup dikhane ke liye)
    const AndroidInitializationSettings androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const DarwinInitializationSettings iosSettings = DarwinInitializationSettings();
    const InitializationSettings initSettings =
        InitializationSettings(android: androidSettings, iOS: iosSettings);

    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        if (kDebugMode) print("🔔 Notification clicked with payload: ${response.payload}");
        // Yahan navigation handle kar sakte hain (e.g. open profile page)
      },
    );

    // Create Notification Channel for Android
    await _localNotifications
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(_channel);

    // 4. Foreground Notifications Listener
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      if (kDebugMode) {
        print("🔔 Foreground message received: ${message.notification?.title}");
      }

      RemoteNotification? notification = message.notification;
      AndroidNotification? android = message.notification?.android;

      // Foreground me hone par bhi heads-up banner show karein
      if (notification != null && android != null) {
        _localNotifications.show(
          notification.hashCode,
          notification.title,
          notification.body,
          NotificationDetails(
            android: AndroidNotificationDetails(
              _channel.id,
              _channel.name,
              channelDescription: _channel.description,
              importance: Importance.max,
              priority: Priority.high,
              icon: '@mipmap/ic_launcher',
            ),
          ),
          payload: jsonEncode(message.data),
        );
      }
    });

    // 5. App opened from background by tapping notification
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      if (kDebugMode) {
        print("🔔 App opened from notification: ${message.data}");
      }
    });
  }

  /// Device Unique ID get karna
  Future<String> getDeviceId() async {
    final deviceInfo = DeviceInfoPlugin();
    if (Platform.isAndroid) {
      final androidInfo = await deviceInfo.androidInfo;
      return androidInfo.id; // Unique hardware/OS id
    } else if (Platform.isIOS) {
      final iosInfo = await deviceInfo.iosInfo;
      return iosInfo.identifierForVendor ?? "ios-device";
    }
    return "unknown-device";
  }

  /// Backend API par Device & FCM Token Register karna
  Future<bool> registerDeviceWithBackend({
    required String backendBaseUrl, // e.g. "http://192.168.1.10:5000/api/v1" ya production URL
    required String accessToken,     // User ka login JWT accessToken
    bool isDriver = false,          // true agar driver app hai
  }) async {
    try {
      // 1. Real FCM Token lein
      String? pushToken = await _fcm.getToken();
      if (pushToken == null) {
        if (kDebugMode) print("❌ Failed to get FCM token");
        return false;
      }
      if (kDebugMode) print("🔑 FCM Token: $pushToken");

      // 2. Device ID lein
      String deviceId = await getDeviceId();
      String platform = Platform.isAndroid ? "android" : (Platform.isIOS ? "ios" : "web");

      // 3. API endpoint decide karein
      final endpoint = isDriver
          ? "$backendBaseUrl/driver/auth/devices/register"
          : "$backendBaseUrl/auth/devices/register";

      final response = await http.post(
        Uri.parse(endpoint),
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer $accessToken",
        },
        body: jsonEncode({
          "deviceId": deviceId,
          "platform": platform,
          "pushToken": pushToken,
        }),
      );

      if (response.statusCode == 200) {
        if (kDebugMode) print("✅ Device registered with ReadyGo backend successfully!");
        return true;
      } else {
        if (kDebugMode) {
          print("❌ Device register failed: ${response.statusCode} - ${response.body}");
        }
        return false;
      }
    } catch (e) {
      if (kDebugMode) print("❌ Error registering device with backend: $e");
      return false;
    }
  }
}
```

---

## 🔌 Step 5: `main.dart` Setup

Apne `lib/main.dart` me Firebase aur `FCMService` initialize karein:

```dart
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'services/fcm_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // 1. Firebase initialize karein
  await Firebase.initializeApp();

  // 2. Notification Service start karein
  await FCMService().initialize();

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ReadyGo',
      theme: ThemeData(primarySwatch: Colors.green),
      home: const HomeScreen(),
    );
  }
}
```

---

## 📲 Step 6: Login hone ke baad Device Register karna

Jaise hi user OTP verify karta hai aur aapko `accessToken` milta hai, turant backend par device register call karein:

```dart
// User OTP verification success ke baad:
final String accessToken = verifyResponse['data']['accessToken'];

// Backend URL (Emulator ke liye 10.0.2.2 ya local Wi-Fi IP)
const String baseUrl = "http://10.0.2.2:5000/api/v1"; 

// Device register karein
await FCMService().registerDeviceWithBackend(
  backendBaseUrl: baseUrl,
  accessToken: accessToken,
  isDriver: false, // Rider ke liye false, Driver ke liye true
);
```

---

## 🎯 Step 7: Profile Update & Real Notification Test

Ab Flutter app se user ka profile update API call karein:

```dart
Future<void> submitProfile(String name, String email, String token) async {
  final response = await http.patch(
    Uri.parse("http://10.0.2.2:5000/api/v1/rider/profile"),
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer $token",
    },
    body: jsonEncode({
      "fullName": name,
      "email": email,
    }),
  );

  if (response.statusCode == 200) {
    print("Profile submitted successfully!");
    // 🔔 ISI TIME PHONE KE TOP PAR NOTIFICATION AAYEGA:
    // Title: "Profile Submitted"
    // Body: "Your profile submitted successfully"
  }
}
```

---

## 🧪 Testing Checklist & Debugging Tips

| Issue | Solution |
| :--- | :--- |
| **Emulator par notification nahi aa rahi** | Make sure emulator **Google Play Services** wala image ho (API 28+ recommended). |
| **`401 Unauthorized`** | Check karein ki `Bearer <accessToken>` header me sahi aur valid token pass kiya gaya hai. |
| **Local Machine par API connect nahi ho rahi** | Android Emulator ke liye `localhost` ki jagah `http://10.0.2.2:5000` use karein. Real device ke liye computer ka Wi-Fi IP (jaise `http://192.168.1.X:5000`) use karein. |
| **Token Backend me save hua ya nahi kaise check karein?** | Backend terminal me check karein ya MongoDB me `devices` collection check karein. |

