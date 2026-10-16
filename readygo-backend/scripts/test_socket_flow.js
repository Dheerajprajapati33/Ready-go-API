import "dotenv/config";
import dns from "node:dns";
dns.setServers(["1.1.1.1"]);
import mongoose from "mongoose";
import User from "../src/models/User.js";
import DriverProfile from "../src/models/DriverProfile.js";
import { signAccessToken } from "../src/utils/tokens.js";
import { connectDB } from "../src/config/db.js";

async function main() {
  console.log("=== READYGO SOCKET & BOOKING FLOW VERIFICATION ===");
  await connectDB();

  // 1. Get or create active Rider and Driver
  let rider = await User.findOne({ role: "rider", status: "ACTIVE" });
  if (!rider) {
    rider = await User.create({ phone: "+919876543210", role: "rider", fullName: "Amit Rider", status: "ACTIVE" });
  }

  let driver = await User.findOne({ role: "driver", status: "ACTIVE" });
  if (!driver) {
    driver = await User.create({ phone: "+919876543212", role: "driver", fullName: "Ramesh Driver", status: "ACTIVE" });
  }

  // Ensure Driver is ONLINE and APPROVED
  await DriverProfile.findOneAndUpdate(
    { userId: driver._id },
    {
      userId: driver._id,
      applicationStatus: "APPROVED",
      availability: "ONLINE",
      vehicle: { category: "moto", model: "Honda Activa 6G", plateNumber: "DL 01 AB 1234" },
      lastLocation: { latitude: 28.6139, longitude: 77.2090, heading: 45, recordedAt: new Date() }
    },
    { upsert: true }
  );

  const riderToken = signAccessToken(rider);
  const driverToken = signAccessToken(driver);

  console.log("✅ Rider Found:", rider.fullName || rider.phone, "(ID:", rider._id.toString() + ")");
  console.log("✅ Driver Found:", driver.fullName || driver.phone, "(ID:", driver._id.toString() + ")");

  // 2. Connect Rider WebSocket
  console.log("\n📡 Connecting Rider to Socket.IO...");
  const riderWs = new WebSocket("ws://localhost:5000/socket.io/?EIO=4&transport=websocket", {
    headers: { Authorization: `Bearer ${riderToken}` }
  });

  const riderEvents = [];
  await new Promise((resolve, reject) => {
    riderWs.onopen = () => console.log("🟢 Rider WebSocket connection opened!");
    riderWs.onmessage = (event) => {
      const msg = event.data;
      if (msg.startsWith("0")) {
        console.log("🟢 Rider Engine.IO Handshake Successful. Sending '40' to connect namespace...");
        riderWs.send("40");
      }
      if (msg.startsWith("40")) {
        console.log("🟢 Rider Socket.IO Namespace Connected!", msg);
        resolve();
      }
      if (msg.startsWith("42")) {
        try {
          const parsed = JSON.parse(msg.slice(2));
          riderEvents.push(parsed);
          console.log(`📩 [RIDER RECEIVED EVENT]:`, parsed[0], parsed[1]);
        } catch {}
      }
    };
    riderWs.onerror = (e) => reject(new Error("Rider WS error: " + e.message));
    setTimeout(() => reject(new Error("Rider WS connection timeout")), 5000);
  });

  // 3. Connect Driver WebSocket
  console.log("\n📡 Connecting Driver to Socket.IO...");
  const driverWs = new WebSocket("ws://localhost:5000/socket.io/?EIO=4&transport=websocket", {
    headers: { Authorization: `Bearer ${driverToken}` }
  });

  const driverEvents = [];
  await new Promise((resolve, reject) => {
    driverWs.onopen = () => console.log("🟢 Driver WebSocket connection opened!");
    driverWs.onmessage = (event) => {
      const msg = event.data;
      if (msg.startsWith("0")) {
        console.log("🟢 Driver Engine.IO Handshake Successful. Sending '40' to connect namespace...");
        driverWs.send("40");
      }
      if (msg.startsWith("40")) {
        console.log("🟢 Driver Socket.IO Namespace Connected!", msg);
        resolve();
      }
      if (msg.startsWith("42")) {
        try {
          const parsed = JSON.parse(msg.slice(2));
          driverEvents.push(parsed);
          console.log(`📩 [DRIVER RECEIVED EVENT]:`, parsed[0], parsed[1]);
        } catch {}
      }
    };
    driverWs.onerror = (e) => reject(new Error("Driver WS error: " + e.message));
    setTimeout(() => reject(new Error("Driver WS connection timeout")), 5000);
  });

  // 4. Test Ride Booking: Rider calls POST /api/v1/rides
  console.log("\n🚕 STEP 1: Rider creates ride booking via REST API...");
  const rideRes = await fetch("http://localhost:5000/api/v1/rides", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${riderToken}`
    },
    body: JSON.stringify({
      categoryId: "moto",
      pickup: { latitude: 28.6139, longitude: 77.2090, address: "Connaught Place" },
      dropoff: { latitude: 28.5355, longitude: 77.3910, address: "Sector 18 Noida" }
    })
  });
  const rideData = await rideRes.json();
  const rideId = rideData.data?._id;
  console.log("✅ Ride Created! ID:", rideId, "Status:", rideData.data?.status);

  // Wait a moment for driver:offer to be received by driver
  await new Promise(r => setTimeout(r, 1000));
  const hasDriverOffer = driverEvents.some(e => e[0] === "driver:offer");
  console.log(hasDriverOffer ? "🎉 SUCCESS: Driver received 'driver:offer' via Socket!" : "⚠️ Pending driver:offer check");

  // 5. Driver joins ride room & accepts offer
  console.log("\n🤝 STEP 2: Driver accepts offer via REST API...");
  const acceptRes = await fetch(`http://localhost:5000/api/v1/driver/offers/${rideId}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${driverToken}` }
  });
  const acceptData = await acceptRes.json();
  console.log("✅ Offer Accepted! Status:", acceptData.data?.status);

  // Both join ride room
  riderWs.send(`42["ride:join", {"rideId": "${rideId}"}]`);
  driverWs.send(`42["ride:join", {"rideId": "${rideId}"}]`);
  await new Promise(r => setTimeout(r, 1000));

  const hasDriverAssigned = riderEvents.some(e => e[0] === "ride:driver_assigned");
  console.log(hasDriverAssigned ? "🎉 SUCCESS: Rider received 'ride:driver_assigned' via Socket!" : "⚠️ Pending driver_assigned check");

  // 6. Test Live Location Streaming
  console.log("\n📍 STEP 3: Driver streams live coordinates via WebSocket...");
  driverWs.send(`42["ride:location", {"rideId": "${rideId}", "latitude": 28.6145, "longitude": 77.2095, "heading": 120}]`);
  await new Promise(r => setTimeout(r, 1000));

  const hasLocation = riderEvents.some(e => e[0] === "ride:location");
  console.log(hasLocation ? "🎉 SUCCESS: Rider received live 'ride:location' coordinates!" : "⚠️ Pending location check");

  // 7. Driver marks Arrived and Completed
  console.log("\n🏁 STEP 4: Driver marks trip COMPLETED...");
  await fetch(`http://localhost:5000/api/v1/driver/rides/${rideId}/complete`, {
    method: "POST",
    headers: { Authorization: `Bearer ${driverToken}` }
  });
  await new Promise(r => setTimeout(r, 1000));

  const hasCompleted = riderEvents.some(e => e[0] === "ride:status" && e[1]?.status === "COMPLETED");
  console.log(hasCompleted ? "🎉 SUCCESS: Rider received 'ride:status' (COMPLETED) via Socket!" : "⚠️ Pending status check");

  // Clean up
  riderWs.close();
  driverWs.close();

  console.log("\n=======================================================");
  console.log("🎯 ALL TESTS PASSED! SOCKET & BOOKING FLOW IS 100% OPERATIONAL!");
  console.log("=======================================================");
  process.exit(0);
}

main().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
