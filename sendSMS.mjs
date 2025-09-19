import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

export async function sendSMS(var1, var2) {
  try {
    const apiKey = process.env.FAST2SMS_API_KEY;
    const senderId = process.env.FAST2SMS_SENDER_ID;
    const message = process.env.FAST2SMS_MESSAGE; // Your DLT approved message ID
    const numbers = process.env.FAST2SMS_NUMBER;

    if (!apiKey) throw new Error("API Key missing in .env");
    if (!senderId) throw new Error("Sender ID missing in .env");
    if (!message) throw new Error("Message (Template ID) missing in .env");
    if (!numbers) throw new Error("Recipient number missing in .env");

    // Debugging logs
    console.log("📩 Preparing SMS with values:");
    console.log("var1 =", var1);
    console.log("var2 =", var2);

    // Construct GET request with query parameters
    const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${apiKey}&route=dlt&sender_id=${senderId}&message=${message}&variables_values=${var1}|${var2}&numbers=${numbers}&flash=0`;

    console.log("🌍 Final URL:", url);

    const response = await axios.get(url);

    if (!response.data.return) {
      console.error("❌ Failed to send SMS:", response.data);
      return false;
    }

    console.log("✅ SMS sent successfully:", response.data);
    return true;
  } catch (err) {
    console.error("❌ Error sending SMS:", err.response?.data || err.message);
    return false;
  }
}
