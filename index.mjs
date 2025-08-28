
import express from "express";
import { db } from "./firebase.js";
import { sendSMS } from "./sendSMS.mjs";
import { ref, get, push, remove, child } from "firebase/database";
import cron from "node-cron";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.get("/", (req, res) => res.send("✅ Scheduler is running"));
app.listen(PORT, () => console.log(`🌐 Server listening on port ${PORT}`));

// Firebase references
const alertsRef = ref(db, "Mcc1/mccalt/sms/read/plc_device_DC16F849B1DB62509DD43ABA9BB3ADAD");
const smsLogRef = ref(db, "Mcc1/mccalt/sms/logs");
const dataLogRef = ref(db, "Mcc1/mccalt/sms/data_logs"); // ✅ Temporary logs

// Numbers to send SMS
const number = ["919489826549"];

const unitMap = {
  0: "m3", 1: "LPM", 2: "LPS", 3: "USGPM", 4: "IGPM", 5: "USGPH", 6: "IGPH",
  7: "LPH", 8: "TPH", 9: "KGPH", 10: "X10 LPM", 11: "X10 USGPM", 12: "X10 IGPM",
  13: "X10 USGPH", 14: "X100 USGPH", 15: "X10 IGPH", 16: "X100 IGPH", 17: "X10 LPH",
  18: "X100 LPH", 19: "X1000 LPH", 20: "X10 KGPH", 21: "X100 KGPH", 22: "X1000 KGPH"
};


async function getAverageCFromLogs() {
  const snapshot = await get(dataLogRef);
  const rawData = snapshot.val();
  if (!rawData) return null;

  const oneMinuteAgo = Date.now() - 60 * 1000; // 1 min ago
  const values = [];

  // Loop through all logs
  for (const key in rawData) {
    const entry = rawData[key];
    const ts = entry?.rawTimestamp ?? 0;

    if (ts >= oneMinuteAgo) {
      const cVal = Number(entry?.C ?? 0);
      if (cVal > 0) values.push(cVal); // ✅ ignore 0
    }
  }

  if (values.length === 0) return null; // no valid data
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return avg;
}

// Helper: format number with decimals
function formatWithDecimal(value, decimalPlaces) {
  if (value === "N/A" || value === undefined || value === null) return "N/A";
  let str = String(value);
  if (decimalPlaces === 0) return str;
  if (decimalPlaces >= str.length) str = str.padStart(decimalPlaces + 1, "0");
  const pointIndex = str.length - decimalPlaces;
  return str.slice(0, pointIndex) + "." + str.slice(pointIndex);
}

// 🔹 Fetch latest record from dataLogRef (not from alertsRef anymore)
async function getLatestLoggedData() {
  const snapshot = await get(dataLogRef);
  const rawData = snapshot.val();
  if (!rawData) return null;
  const dataArray = Object.values(rawData);
  return dataArray[dataArray.length - 1]; // ✅ Get latest entry
}

// 🔹 SMS sending task (now uses dataLogRef)
async function sendScheduledSMS(label) {
  try {
    console.log(`\n⏰ Running scheduled task: ${label}`);

    const latest = await getLatestLoggedData();
    if (!latest) return console.log("⚠️ No logged data available.");

    // ✅ Calculate avg of C from last 1 min
    const avgC = await getAverageCFromLogs();
    console.log("📊 Average C (last 1 min, ignoring 0):", avgC);

    const A = latest?.A ?? 0;
    const B = latest?.B ?? 0;
    const C = avgC ?? (latest?.C ?? 0); // use avg if available, else fallback
    const D = latest?.D ?? 0;
    const E = latest?.E ?? 0;

    const add_bc = Number(B) + Number(C);
    const formattedA = formatWithDecimal(A, D);
    const formattedB = formatWithDecimal(add_bc, D);

    const unit = unitMap[E] || "Unknown";
    const ts = latest?.rawTimestamp ?? Date.now();
    const timestamp = new Date(ts).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: true
    });

    const message = `${label} KOYAMBEDU MARKET ${timestamp} TOTALEFLOW=${formattedB} ${unit}`;
    console.log(`📲 Sending SMS at ${label}:`, message);

    for (const num of number) {
      await sendSMS(message, num);
      await push(smsLogRef, {
        to: num,
        message,
        label,
        avgC, // ✅ log the average for reference
        timestamp: Date.now(),
        ist_time: timestamp
      });
      console.log(`📲 SMS sent to ${num}`);
    }

    console.log("📝 Logged SMS to Firebase.");
  } catch (err) {
    console.error(`❌ Failed at ${label}:`, err);
  }
}


// 🔹 Data logging with auto-delete after 5 min
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
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: true
    });

    // ✅ Push log into temp storage
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

    // ✅ Auto-delete after 5 minutes
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

// -------------------- CRON SCHEDULES --------------------

// Only at 8:29 & 8:30 IST → log data, then auto-delete after 5 min 
cron.schedule("*/5 28-29 8 * * *", () => logDataToFirebase(), { timezone: "Asia/Kolkata", });
cron.schedule("*/5 28-29 17 * * *", () => logDataToFirebase(), { timezone: "Asia/Kolkata", });
 // Example SMS test (every 30 sec) //
  // cron.schedule("0,30 * * * * *", () => sendScheduledSMS("Test Run")); 
  // Real SMS schedules (enable when ready) 
   cron.schedule("30 8 * * *", () => sendScheduledSMS("8:30 AM"), { timezone: "Asia/Kolkata" }); 
   cron.schedule("30 17 * * *", () => sendScheduledSMS("5:30 PM"), { timezone: "Asia/Kolkata" }); 
  
