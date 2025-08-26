
import express from "express";
import { db } from "./firebase.js";
import { sendSMS } from "./sendSMS.mjs";
import { ref, get, push } from "firebase/database";
import cron from "node-cron";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.get("/", (req, res) => res.send("✅ Scheduler is running"));
app.listen(PORT, () => console.log(`🌐 Server listening on port ${PORT}`));

// Firebase reference
const alertsRef = ref(db, "Mcc1/mccalt/sms/read/plc_device_DC16F849B1DB62509DD43ABA9BB3ADAD");
const smsLogRef = ref(db, "Mcc1/mccalt/sms/logs");


// Number with country code
const number = ["919087589685", "917373012128"];

const unitMap = {
  0: "m3",
  1: "LPM",
  2: "LPS",
  3: "USGPM",
  4: "IGPM",
  5: "USGPH",
  6: "IGPH",
  7: "LPH",
  8: "TPH",
  9: "KGPH",
  10: "X10 LPM",
  11: "X10 USGPM",
  12: "X10 IGPM",
  13: "X10 USGPH",
  14: "X100 USGPH",
  15: "X10 IGPH",
  16: "X100 IGPH",
  17: "X10 LPH",
  18: "X100 LPH",
  19: "X1000 LPH",
  20: "X10 KGPH",
  21: "X100 KGPH",
  22: "X1000 KGPH",

};

// Helper: format number with decimal from right side based on D
function formatWithDecimal(value, decimalPlaces) {
  if (value === "N/A" || value === undefined || value === null) return "N/A";
  let str = String(value);

  if (decimalPlaces === 0) return str; // no decimal

  // If D is larger than number length, pad with zeros at front
  if (decimalPlaces >= str.length) {
    str = str.padStart(decimalPlaces + 1, "0");
  }

  const pointIndex = str.length - decimalPlaces;
  return str.slice(0, pointIndex) + "." + str.slice(pointIndex);
}


async function sendScheduledSMS(label) {
  try {
    console.log(`\n⏰ Running scheduled task: ${label}`);

    const snapshot = await get(alertsRef);
    const rawData = snapshot.val();
    console.log("📂 Firebase raw data:", rawData);

    if (!rawData) {
      console.log("⚠️ No data found in Firebase path.");
      return;
    }

    const dataArray = Array.isArray(rawData) ? rawData : Object.values(rawData);
    if (!dataArray.length) {
      console.log("⚠️ No records available.");
      return;
    }

    const latest = dataArray[dataArray.length - 1];
    const A = latest?.values?.["0165"] ?? 0;
    const B = latest?.values?.["0166"] ?? 0;
    const C = latest?.values?.["0167"] ?? 0;
    const D = latest?.values?.["0168"] ?? 0;
    const E = latest?.values?.["0169"] ?? 0;


    const add_bc = Number(B) + Number(C);
    const formattedA = formatWithDecimal(A, D);
    const formattedB = formatWithDecimal(add_bc, D);

    // TWO = formatted B
    const TWO = formattedB;
    const unit = unitMap[E] || "Unknown";

    const ts = latest?.ts ?? Date.now();
    // Convert to IST (Asia/Kolkata)
    const timestamp = new Date(ts).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,   // shows AM/PM, remove if you prefer 24h
    });



    console.log(
      `✅ Latest fetched at ${label}: A=${formattedA} ${unit}, TWO=${TWO} ${unit}, D=${D}, C=${C}, Timestamp=${timestamp}`
    );


    const message = ` ${label}  KOYAMBEDU MARKET ${timestamp}  TOTALEFLOW=${formattedB} ${unit}`;
    console.log(`📲 Sending SMS at ${label}:`, message);


    for (const num of number) {
      await sendSMS(message, num);
      console.log(`📲 SMS sent to ${num}`);
      // Log SMS details into Firebase
      await push(smsLogRef, {
        to: num,
        message,
        label,
        timestamp: Date.now(), // raw timestamp for queries
        ist_time: timestamp    // formatted IST string
      });
    }


    console.log("📝 Logged SMS to Firebase.");
  } catch (err) {
    console.error(`❌ Failed at ${label}:`, err);
  }
}


// cron.schedule("0,30 * * * * *", () => sendScheduledSMS("Test Run"));


// // Schedules
cron.schedule("30 8 * * *", () => sendScheduledSMS("8:30 AM"), {
  timezone: "Asia/Kolkata"
});

cron.schedule("30 17 * * *", () => sendScheduledSMS("5:30 PM"), {
  timezone: "Asia/Kolkata"
});
