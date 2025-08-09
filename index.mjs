import express from "express";
import { db } from "./firebase.js";
import { sendSMS } from "./sendSMS.mjs";
import { ref, get } from "firebase/database";
import cron from "node-cron";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.get("/", (req, res) => res.send("✅ Scheduler is running"));
app.listen(PORT, () => console.log(`🌐 Server listening on port ${PORT}`));

// Firebase reference
const alertsRef = ref(db, "sms/read/plc_device_EE025F9D4E1F595D9A3947F9E1669BFE");

// Change this to your actual number with country code
const number = "919489826549";

// Function to send scheduled SMS
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

    // Convert object to array if needed
    const dataArray = Array.isArray(rawData) ? rawData : Object.values(rawData);
    if (!dataArray.length) {
      console.log("⚠️ No records available.");
      return;
    }

    const latest = dataArray[dataArray.length - 1];
    const inputValue = latest?.values?.input ?? "N/A";

    const message = `📡 ${label} Input_Report: Value = ${inputValue}`;
    console.log(`📲 Sending SMS at ${label}:`, message);

    await sendSMS(message, number);
    console.log("✅ SMS sent successfully.");
  } catch (err) {
    console.error(`❌ Failed at ${label}:`, err);
  }
}

// Test schedule: runs every 1 minute
//cron.schedule("*/1 * * * *", () => sendScheduledSMS("Test Run"));

cron.schedule("51 11 * * *", () => sendScheduledSMS("6:00 AM"));
cron.schedule("10 12 * * *", () => sendScheduledSMS("9:01 PM"));

