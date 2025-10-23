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
const alertsRef = ref(db, "Mcc1/mccalt/sms/read/plc_device_DC16F849B1DB62509DD43ABA9BB3ADAD");
const smsLogRef = ref(db, "Mcc1/mccalt/sms/logs");
const dataLogRef = ref(db, "Mcc1/mccalt/sms/data_logs");

// Unit mapping
const unitMap = {
  0: "m3", 1: "LPM", 2: "LPS", 3: "USGPM", 4: "IGPM", 5: "USGPH", 6: "IGPH",
  7: "LPH", 8: "TPH", 9: "KGPH", 10: "X10 LPM", 11: "X10 USGPM", 12: "X10 IGPM",
  13: "X10 USGPH", 14: "X100 USGPH", 15: "X10 IGPH", 16: "X100 IGPH",
  17: "X10 LPH", 18: "X100 LPH", 19: "X1000 LPH", 20: "X10 KGPH", 21: "X100 KGPH",
  22: "X1000 KGPH"
};

// Helper: get averaged data from last logs
async function getAverageLoggedData() {
  const snapshot = await get(dataLogRef);
  const rawData = snapshot.val();
  if (!rawData) return null;

  const dataArray = Object.values(rawData);
  // Filter out zero-flow entries or invalid values
  const validData = dataArray.filter(item => {
    const B = parseFloat(item.B) || 0;
    const C = parseFloat(item.C) || 0;
    return (B > 0 || C > 0);
  });
  if (!validData.length) return null;

  let sumB = 0, sumC = 0, sumD = 0, sumE = 0;
  validData.forEach(item => {
    sumB += parseFloat(item.B) || 0;
    sumC += parseFloat(item.C) || 0;
    sumD += parseFloat(item.D) || 0;
    sumE += parseFloat(item.E) || 0;
  });

  const len = validData.length;
  const avgB = sumB / len;
  const avgC = sumC / len;
  const avgD = Math.round(sumD / len);
  const avgE = Math.round(sumE / len);

  const last = validData[validData.length - 1];
  return {
    A: last.A,
    B: avgB,
    C: avgC,
    D: avgD,
    E: avgE,
    rawTimestamp: last.rawTimestamp
  };
}

// SMS Task
async function sendScheduledSMS(label) {
  try {
    console.log(`\n⏰ Running scheduled task: ${label}`);

    const latest = await getAverageLoggedData();
    if (!latest) {
      console.log("⚠️ No valid logged data available to send SMS.");
      return;
    }

    const B = latest.B;
    const C = latest.C;
    const D = latest.D;
    const E = latest.E;

    const add_bc = Number(B) + Number(C);
    const formatted = add_bc.toFixed(D >= 0 ? D : 0);

    const unit = unitMap[E] || "Unknown";
    const ts = latest.rawTimestamp ?? Date.now();
    const timestamp = new Date(ts).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: true
    });

    const TOTALFLOW = `${formatted}${unit}`;
    console.log(`📊 Prepared SMS → Timestamp: ${timestamp}, Flow: ${TOTALFLOW}`);

    const smsSent = await sendSMS(timestamp, TOTALFLOW);

    if (smsSent) {
      await push(smsLogRef, {
        label,
        TOTALFLOW,
        timestamp: Date.now(),
        ist_time: timestamp
      });
      console.log(`📲 SMS sent & logged: ${TOTALFLOW}`);
    } else {
      console.error("❌ SMS sending returned failure.");
    }
  } catch (err) {
    console.error(`❌ Failed at ${label}:`, err);
  }
}

// Data Logger Task
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

    const valA = parseFloat(latest?.values?.["0165"]) || 0;
    const valB = parseFloat(latest?.values?.["0166"]) || 0;
    const valC = parseFloat(latest?.values?.["0167"]) || 0;
    const valD = parseInt(latest?.values?.["0168"], 10) || 0;
    const valE = parseInt(latest?.values?.["0169"], 10) || 0;

    // Skip if no valid flow values
    if (valB <= 0 && valC <= 0) {
      console.log("⚠️ Skipped logging — no valid flow data in this cycle.");
      return;
    }

    const newLogRef = await push(dataLogRef, {
      A: valA,
      B: valB,
      C: valC,
      D: valD,
      E: valE,
      rawTimestamp: ts,
      ist_time: timestamp
    });

    console.log(`🗄️ Logged data at ${timestamp}`);

    // Auto-delete after 15 minutes
    setTimeout(async () => {
      try {
        await remove(newLogRef);
        console.log(`🗑️ Auto-deleted log created at ${timestamp}`);
      } catch (err) {
        console.error("❌ Failed to auto-delete log:", err);
      }
    }, 15 * 60 * 1000); // 15 minutes
  } catch (err) {
    console.error("❌ Data logging failed:", err);
  }
}

// Cron Jobs
// Run data logger every minute between 08:25-08:30 IST
cron.schedule("*/1 25-30 8 * * *", () => logDataToFirebase(), { timezone: "Asia/Kolkata" });
// Run data logger every minute between 17:25-17:30 IST

// Run data logger every minute between 12:40-12:45 IST
cron.schedule("*/1 40-45 12 * * *", () => logDataToFirebase(), { timezone: "Asia/Kolkata" });

// SMS schedules
cron.schedule("30 8 * * *", () => sendScheduledSMS("8:30 AM"), { timezone: "Asia/Kolkata" });

cron.schedule("30 17 * * *", () => sendScheduledSMS("5:30 PM"), { timezone: "Asia/Kolkata" });
