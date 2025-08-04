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

// 🔁 Scheduled SMS logic
const alertsRef = ref(db, "sms/read/plc_device_EE025F9D4E1F595D9A3947F9E1669BFE");
const number = "919489826549"; // Change this to your actual number

async function sendScheduledSMS(label) {
  try {
    const snapshot = await get(alertsRef);
    const dataArray = snapshot.val();
    if (!Array.isArray(dataArray)) {
      console.log("⚠️ Data is not an array.");
      return;
    }
    const latest = dataArray[dataArray.length - 1];
    const inputValue = latest?.values?.input;
    const message = `📡 ${label} Input Report: Value = ${inputValue}`;
    console.log(`📲 Sending SMS at ${label}:`, inputValue);
    await sendSMS(message, number);
  } catch (err) {
    console.error(`❌ Failed at ${label}:`, err.message);
  }
}

// ⏰ Schedule times
cron.schedule("50 14 * * *", () => sendScheduledSMS("6:00 AM"));  // Morning
cron.schedule("5 15 * * *", () => sendScheduledSMS("9:01 PM")); // Evening