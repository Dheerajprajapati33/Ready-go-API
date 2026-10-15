# ⚡ ReadyGo - Flutter Socket.IO Real-time Events Setup Guide

Yeh guide Flutter frontend developers ke liye banayi gayi hai taaki ReadyGo ke real-time features (**Ride Tracking, Driver Offers, SOS, aur Payment Updates**) ko Flutter app me asani se integrate aur verify kiya ja sake.

---

## 📑 Table of Contents
1. [Prerequisites & Package Installation](#1-prerequisites--package-installation)
2. [Server Connection URLs (Emulator vs Real Device)](#2-server-connection-urls-emulator-vs-real-device)
3. [Android & iOS Network Permissions](#3-android--ios-network-permissions)
4. [Centralized Flutter SocketService (Production Ready)](#4-centralized-flutter-socketservice-production-ready)
5. [Rider App Integration Flow](#5-rider-app-integration-flow)
6. [Driver Partner App Integration Flow](#6-driver-partner-app-integration-flow)
7. [Safety & Emergency SOS Flow](#7-safety--emergency-sos-flow)
8. [Testing & Verification Checklist](#8-testing--verification-checklist)
9. [FAQ & Troubleshooting](#9-faq--troubleshooting)

---

## 1. Prerequisites & Package Installation

Apne Flutter project ke `pubspec.yaml` me official Socket.IO client add karein:

```yaml
dependencies:
  flutter:
    sdk: flutter
  socket_io_client: ^3.0.2  # Socket.IO v4 compatible client
```

Terminal me run karein:
```bash
flutter pub get
```

---

## 2. Server Connection URLs (Emulator vs Real Device)

Localhost URL device ke hisab se alag hoti hai:

| Device Type | WebSocket URL | Note |
| :--- | :--- | :--- |
| **Android Emulator** | `http://10.0.2.2:5000` | Android emulator localhost ko `10.0.2.2` manta hai |
| **iOS Simulator** | `http://localhost:5000` | Mac localhost direct access hota hai |
| **Real Physical Phone** | `http://192.168.x.x:5000` | Computer aur phone dono **same Wi-Fi** par hone chahiye |
| **Production Server** | `https://api.yourdomain.com` | SSL secure WSS connection |

---

## 3. Android & iOS Network Permissions

### Android (`android/app/src/main/AndroidManifest.xml`)
HTTP / WebSocket traffic allow karne ke liye `INTERNET` permission aur `usesCleartextTraffic` zaroori hai:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

    <application
        android:label="ReadyGo"
        android:usesCleartextTraffic="true"
        android:icon="@mipmap/ic_launcher">
        <!-- ... -->
    </application>
</manifest>
```

### iOS (`ios/Runner/Info.plist`)
Local testing ke liye App Transport Security enable karein:
```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>
```

---

## 4. Centralized Flutter `SocketService` (Production Ready)

Ek clean singleton service banayein: `lib/services/socket_service.dart`:

```dart
import 'dart:developer';
import 'package:socket_io_client/socket_io_client.dart' as IO;

class SocketService {
  static final SocketService _instance = SocketService._internal();
  factory SocketService() => _instance;
  SocketService._internal();

  IO.Socket? _socket;
  bool get isConnected => _socket?.connected ?? false;

  // Initialize and Connect Socket
  void initSocket({
    required String baseUrl,
    required String accessToken,
    required Function() onConnected,
    required Function(dynamic) onError,
  }) {
    if (_socket != null && _socket!.connected) {
      log('[SocketService] Already connected');
      return;
    }

    log('[SocketService] Connecting to $baseUrl...');

    _socket = IO.io(
      baseUrl,
      IO.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .disableAutoConnect()
          .setAuth({'token': accessToken})
          .setExtraHeaders({'Authorization': 'Bearer $accessToken'})
          .enableReconnection()
          .setReconnectionAttempts(10)
          .setReconnectionDelay(2000)
          .build(),
    );

    // Handshake & Connection Events
    _socket!.onConnect((_) {
      log('🟢 [SocketService] Connected successfully. Socket ID: ${_socket!.id}');
      onConnected();
    });

    _socket!.onConnectError((data) {
      log('🔴 [SocketService] Connection Error: $data');
      onError(data);
    });

    _socket!.onError((data) {
      log('⚠️ [SocketService] General Error: $data');
      onError(data);
    });

    _socket!.onDisconnect((reason) {
      log('🟡 [SocketService] Disconnected. Reason: $reason');
    });

    _socket!.connect();
  }

  // --------------------------------------------------------------------------
  // ROOM MANAGEMENT
  // --------------------------------------------------------------------------
  void joinRideRoom(String rideId) {
    if (_socket == null || !_socket!.connected) return;
    log('[SocketService] Joining ride room for: $rideId');
    _socket!.emitWithAck('ride:join', {'rideId': rideId}, ack: (response) {
      log('[SocketService] Join room ack: $response');
    });
  }

  void leaveRideRoom(String rideId) {
    if (_socket == null || !_socket!.connected) return;
    _socket!.emit('ride:leave', {'rideId': rideId});
  }

  // --------------------------------------------------------------------------
  // INBOUND EVENT LISTENERS
  // --------------------------------------------------------------------------

  // 1. Ride Status (DRIVER_ARRIVED, IN_PROGRESS, COMPLETED, CANCELLED)
  void onRideStatus(Function(Map<String, dynamic> data) callback) {
    _socket?.off('ride:status');
    _socket?.on('ride:status', (data) {
      log('📡 [Event: ride:status] $data');
      callback(Map<String, dynamic>.from(data));
    });
  }

  // 2. Driver Assigned (Driver summary, Vehicle summary, ETA)
  void onDriverAssigned(Function(Map<String, dynamic> data) callback) {
    _socket?.off('ride:driver_assigned');
    _socket?.on('ride:driver_assigned', (data) {
      log('📡 [Event: ride:driver_assigned] $data');
      callback(Map<String, dynamic>.from(data));
    });
  }

  // 3. Driver Live Location (Map marker movement)
  void onRideLocation(Function(Map<String, dynamic> data) callback) {
    _socket?.off('ride:location');
    _socket?.on('ride:location', (data) {
      callback(Map<String, dynamic>.from(data));
    });
  }

  // 4. Driver Offers (Incoming ride broadcast for drivers)
  void onDriverOffer(Function(Map<String, dynamic> data) callback) {
    _socket?.off('driver:offer');
    _socket?.on('driver:offer', (data) {
      log('📡 [Event: driver:offer] $data');
      callback(Map<String, dynamic>.from(data));
    });
  }

  // 5. Safety SOS Status
  void onSafetySosStatus(Function(Map<String, dynamic> data) callback) {
    _socket?.off('safety:sos_status');
    _socket?.on('safety:sos_status', (data) {
      log('🚨 [Event: safety:sos_status] $data');
      callback(Map<String, dynamic>.from(data));
    });
  }

  // 6. Payment Status (SUCCEEDED, FAILED)
  void onPaymentStatus(Function(Map<String, dynamic> data) callback) {
    _socket?.off('payment:status');
    _socket?.on('payment:status', (data) {
      log('💳 [Event: payment:status] $data');
      callback(Map<String, dynamic>.from(data));
    });
  }

  // --------------------------------------------------------------------------
  // OUTBOUND EVENTS (Driver sends to Server)
  // --------------------------------------------------------------------------
  void emitDriverLocation({
    required String rideId,
    required double latitude,
    required double longitude,
    double heading = 0.0,
  }) {
    if (_socket == null || !_socket!.connected) return;
    _socket!.emit('ride:location', {
      'rideId': rideId,
      'latitude': latitude,
      'longitude': longitude,
      'heading': heading,
      'recordedAt': DateTime.now().toIso8601String(),
    });
  }

  // Disconnect Socket
  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    log('[SocketService] Disposed');
  }
}
```

---

## 5. Rider App Integration Flow

Rider app me OTP verify hote hi socket connect karein aur tracking screen par events listen karein:

```dart
// 1. Login ke turant baad socket connect karein
final socketService = SocketService();
socketService.initSocket(
  baseUrl: 'http://10.0.2.2:5000',
  accessToken: riderAccessToken,
  onConnected: () {
    print("Rider connected to ReadyGo real-time engine");
  },
  onError: (err) => print("Socket error: $err"),
);

// 2. Jab Rider Ride request kare aur rideId mile:
socketService.joinRideRoom(currentRideId);

// 3. Driver Assign hone ka listener:
socketService.onDriverAssigned((data) {
  // data example:
  // {
  //   "rideId": "6ad08...",
  //   "driver": { "fullName": "Ramesh Kumar", "rating": 4.85, "avatarUrl": "..." },
  //   "vehicle": { "model": "Activa 6G", "plateNumber": "DL 01 AB 1234" },
  //   "eta": 3
  // }
  setState(() {
    assignedDriver = data['driver'];
    vehicleDetails = data['vehicle'];
    etaMinutes = data['eta'];
  });
});

// 4. Map par Driver Car animate karne ke liye live coordinates:
socketService.onRideLocation((data) {
  double lat = data['latitude'];
  double lng = data['longitude'];
  double heading = (data['heading'] ?? 0.0).toDouble();

  // Google Maps marker position update karein:
  updateDriverMarker(LatLng(lat, lng), heading);
});

// 5. Ride Status updates (Arrived, Started, Completed):
socketService.onRideStatus((data) {
  String status = data['status'];
  if (status == 'DRIVER_ARRIVED') {
    showNotification("Driver is at your pickup location!");
  } else if (status == 'IN_PROGRESS') {
    navigateToOnTripScreen();
  } else if (status == 'COMPLETED') {
    navigateToPaymentOrRatingScreen();
  }
});

// 6. Payment Confirmation:
socketService.onPaymentStatus((data) {
  if (data['status'] == 'SUCCEEDED') {
    showPaymentSuccessDialog(amount: data['amountPaise'] / 100);
  }
});
```

---

## 6. Driver Partner App Integration Flow

Driver app me naye ride offers milne aur live location bhejne ke liye:

```dart
// 1. Driver Login ke baad Connect karein
socketService.initSocket(
  baseUrl: 'http://10.0.2.2:5000',
  accessToken: driverAccessToken,
  onConnected: () => print("Driver is online on Socket"),
  onError: (err) => print("Driver socket error: $err"),
);

// 2. New Ride Offer aane par Bottom Sheet pop-up dikhayein:
socketService.onDriverOffer((data) {
  // data example:
  // {
  //   "offerId": "6ad08...",
  //   "ride": { "pickup": {...}, "dropoff": {...}, "fareAmount": 150 },
  //   "pickupDistance": "1.2 km",
  //   "expiry": 30
  // }
  showIncomingRideBottomSheet(
    offerId: data['offerId'],
    fare: data['ride']['fareAmount'],
    pickup: data['ride']['pickup']['address'],
    distance: data['pickupDistance'],
    expirySeconds: data['expiry'],
  );
});

// 3. GPS stream se Server ko coordinates bhejte rahein (Throttled):
Geolocator.getPositionStream().listen((Position pos) {
  if (activeRideId != null) {
    socketService.emitDriverLocation(
      rideId: activeRideId!,
      latitude: pos.latitude,
      longitude: pos.longitude,
      heading: pos.heading,
    );
  }
});
```

---

## 7. Safety & Emergency SOS Flow

Jab rider emergency SOS button press karta hai:

```dart
socketService.onSafetySosStatus((data) {
  // data: { "eventId": "...", "status": "OPEN", "updatedAt": "..." }
  setState(() {
    sosActive = (data['status'] == 'OPEN' || data['status'] == 'ACKNOWLEDGED');
    sosStatusMessage = "Safety Desk is monitoring your trip.";
  });
});
```

---

## 8. Testing & Verification Checklist

Frontend user ya developer kaise test karega:

| Step | Action | Expected Output | Status |
| :--- | :--- | :--- | :--- |
| **1. Auth Test** | Bina token ke connect karein | Console me `Authentication error` dikhega |  Pass |
| **2. Connect Test** | Valid token ke sath connect karein | `[SocketService] Connected successfully` log hoga |  Pass |
| **3. Room Join Test** | `socketService.joinRideRoom(rideId)` call karein | Server acknowledgment `success: true` aayega |  Pass |
| **4. Driver Offer** | Rider app se ride create karein | Driver screen par `driver:offer` event trigger hoga |  Pass |
| **5. Assignment** | Driver offer accept kare | Rider app par turant `ride:driver_assigned` aayega |  Pass |
| **6. Tracking** | Driver move kare / coordinates bheje | Rider map marker real-time animate hoga |  Pass |
| **7. Payment** | Payment confirm karein | `payment:status` aate hi success screen khulegi |  Pass |

---

## 9. FAQ & Troubleshooting

### Q1: Android Emulator par `Connection refused` ya `SocketException`?
👉 Android emulator ke liye `http://localhost:5000` kaam nahi karta. URL me **`http://10.0.2.2:5000`** use karein.

### Q2: Real Phone par test kaise karein?
1. Computer aur phone ko same Wi-Fi network se connect karein.
2. Terminal me `ipconfig` (Windows) run karke apna IPv4 address (e.g., `192.168.1.15`) dekhein.
3. Flutter URL me `http://192.168.1.15:5000` daalein.

### Q3: `Authentication error: User account is inactive`?
👉 Login karne ke baad jo `accessToken` milta hai wahi use karein. Database me user ka status `ACTIVE` hona chahiye.

### Q4: Event emit karne par rider ko location update kyun nahi mil rahi?
👉 Check karein ki dono Rider aur Driver ne **same `rideId`** ke room ko `joinRideRoom(rideId)` kiya hai ya nahi.

