import express from "express";
import { db } from "./firebase.js";
import { sendSMS } from "./sendSMS.mjs";
import { ref, get, push, remove } from "firebase/database";
import cron from "node-cron";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.get("/", (req, res) => res.send("✅ Scheduler is running"));
app.listen(PORT, () => console.log(`🌐 Server listening on port ${PORT}`));

// Firebase references
const alertsRef = ref(
  db,
  "Mcc1/mccalt/sms/read/plc_device_DC16F849B1DB62509DD43ABA9BB3ADAD"
);
const smsLogRef = ref(db, "Mcc1/mccalt/sms/logs");
const dataLogRef = ref(db, "Mcc1/mccalt/sms/data_logs");

// ---------------- Unit Mapping ----------------
const unitMap = {
  0: "m3", 1: "LPM", 2: "LPS", 3: "USGPM", 4: "IGPM", 5: "USGPH", 6: "IGPH",
  7: "LPH", 8: "TPH", 9: "KGPH", 10: "X10 LPM", 11: "X10 USGPM", 12: "X10 IGPM",
  13: "X10 USGPH", 14: "X100 USGPH", 15: "X10 IGPH", 16: "X100 IGPH", 17: "X10 LPH",
  18: "X100 LPH", 19: "X1000 LPH", 20: "X10 KGPH", 21: "X100 KGPH", 22: "X1000 KGPH"
};

// ---------------- Helpers ----------------
async function getLatestLoggedData() {
  const snapshot = await get(dataLogRef);
  const rawData = snapshot.val();
  if (!rawData) return null;

  const dataArray = Object.values(rawData);
  return dataArray[dataArray.length - 1];
}

// ---------------- SMS Task ----------------
async function sendScheduledSMS(label) {
  try {
    console.log(`\n⏰ Running scheduled task: ${label}`);

    const latest = await getLatestLoggedData();
    if (!latest) return console.log("⚠️ No logged data available.");

    const A = latest?.A ?? 0;
    const B = latest?.B ?? 0;
    const C = latest?.C ?? 0;
    const D = latest?.D ?? 0;
    const E = latest?.E ?? 0;

    const add_bc = Number(B) + Number(C);
    const formattedB = add_bc.toFixed(D);

    const unit = unitMap[E] || "Unknown";
    const ts = latest?.rawTimestamp ?? Date.now();
    const timestamp = new Date(ts).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: true
    });

    const TOTALFLOW = `${formattedB}${unit}`;

    console.log(`📊 Prepared SMS → Timestamp: ${timestamp}, Flow: ${TOTALFLOW}`);

    // ✅ Send SMS using template vars
    const smsSent = await sendSMS(timestamp, TOTALFLOW);

    if (smsSent) {
      await push(smsLogRef, {
        label,
        TOTALFLOW,
        timestamp: Date.now(),
        ist_time: timestamp
      });
      console.log(`📲 SMS sent & logged: ${TOTALFLOW}`);
    }
  } catch (err) {
    console.error(`❌ Failed at ${label}:`, err);
  }
}

// ---------------- Data Logger ----------------
async function logDataToFirebase() {
  try {
    const snapshot = await get(alertsRef);
    const rawData = snapshot.val();
    if (!rawData) return;

    const dataArray = Array.isArray(rawData) ? rawData : Object.values(rawData);
    if (!dataArray.length) return;

    const latest = dataArray[dataArray.length - 1];
    const ts = latest?.ts ?? Date.now();
    const timestamp = new Date(ts).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: true
    });

    const newLogRef = await push(dataLogRef, {
      A: latest?.values?.["0165"] ?? 0,
      B: latest?.values?.["0166"] ?? 0,
      C: latest?.values?.["0167"] ?? 0,
      D: latest?.values?.["0168"] ?? 0,
      E: latest?.values?.["0169"] ?? 0,
      rawTimestamp: ts,
      ist_time: timestamp
    });

    console.log(`🗄️ Logged data at ${timestamp}`);

    // Auto-delete after 5 minutes
    setTimeout(async () => {
      try {
        await remove(newLogRef);
        console.log(`🗑️ Auto-deleted log created at ${timestamp}`);
      } catch (err) {
        console.error("❌ Failed to auto-delete log:", err);
      }
    }, 5 * 60 * 1000);
  } catch (err) {
    console.error("❌ Data logging failed:", err);
  }
}

// ---------------- CRON Jobs ----------------
// Only at 8:29 & 8:30 IST → log data, then auto-delete after 5 min 
cron.schedule("*/5 28-29 8 * * *", () => logDataToFirebase(), { timezone: "Asia/Kolkata", });
cron.schedule("*/5 28-29 17 * * *", () => logDataToFirebase(), { timezone: "Asia/Kolkata", });
 // Example SMS test (every 30 sec) //
  // cron.schedule("0,30 * * * * *", () => sendScheduledSMS("Test Run")); 
  // Real SMS schedules (enable when ready) 
   cron.schedule("30 8 * * *", () => sendScheduledSMS("8:30 AM"), { timezone: "Asia/Kolkata" }); 
   cron.schedule("30 17 * * *", () => sendScheduledSMS("5:30 PM"), { timezone: "Asia/Kolkata" }); 
  
