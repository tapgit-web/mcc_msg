// import { db } from "./firebase.js";
// import { sendSMS } from "./sendSMS.mjs";
// import { ref, onValue } from "firebase/database";

// console.log("✅ Server is watching Firebase for input changes...");

// // ✅ Correct path based on your Firebase structure
// const alertsRef = ref(db, "sms/read/plc_device_EE025F9D4E1F595D9A3947F9E1669BFE");

// onValue(alertsRef, async (snapshot) => {
//   const dataArray = snapshot.val();

//   // Debug snapshot
//   console.log("📦 Snapshot value:", dataArray);

//   if (!Array.isArray(dataArray)) {
//     console.log("⚠️ Data is not an array.");
//     return;
//   }

//   // Get latest item
//   const latest = dataArray[dataArray.length - 1];
//   const inputValue = latest?.values?.input;
//   const number = "919087589685"; // replace with real number

//   console.log("🔍 Read input value from Firebase:", inputValue);

//   // Send SMS if input > 0
//   if (inputValue > 0) {
//     const message = `🚨 MCC lEVEL Alert: level is ${inputValue}`;
//     console.log("📲 Sending SMS to:", number);
//     await sendSMS(message, number);
//   } else {
//     console.log("ℹ️ Input is 0, no SMS sent.");
//   }
// });


import { db } from "./firebase.js";
import { sendSMS } from "./sendSMS.mjs";
import { ref, get, push } from "firebase/database";
import cron from "node-cron";
import dotenv from "dotenv";

dotenv.config();

const number = "919489826549"; // ✅ Your full phone number
const alertsRef = ref(db, "sms/read/plc_device_EE025F9D4E1F595D9A3947F9E1669BFE");
const  logref  = ref(db,"sms_values")

// ✅ Function to fetch latest input value from Firebase and send SMS
async function sendScheduledSMS(timeLabel) {
  try {
    const snapshot = await get(alertsRef);
    const dataArray = snapshot.val();

    if (!Array.isArray(dataArray)) {
      console.log("⚠️ Data is not an array.");
      return;
    }

    const latest = dataArray[dataArray.length - 1];
    const inputValue = latest?.values?.input;

    const timestamp = latest?.ts;

    console.log(`⏰ [${timeLabel}] Input Value:`, inputValue);

    const message = `📡 Scheduled ${timeLabel} Alert: Input is ${inputValue}`;
    await sendSMS(message, number);


    //lod data into firebase
    await push(logref,
      {
        time:timestamp,
        label: timeLabel,
        input:inputValue,
        sentto:number

      }
    );






  } catch (error) {
    console.error(`❌ Failed to send ${timeLabel} SMS:`, error);
  }
}

// ⏰ 6:00 AM every day
cron.schedule("45 13 * * *", () => sendScheduledSMS("6:00 AM"));

// ⏰ 6:00 PM every day
cron.schedule("9 21 * * *", () => sendScheduledSMS("6:00 PM"));

console.log("✅ Scheduler started — waiting for 6:00 AM and 6:00 PM triggers...");

