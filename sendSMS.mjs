import dotenv from "dotenv";
import axios from "axios";
dotenv.config();

const sendSMS = async (message, number) => {
  try {
    const response = await axios.post("https://www.fast2sms.com/dev/bulkV2", {
      route: "q",
      message: message,
      language: "english",
      flash: 0,
      numbers: number,
    }, {
      headers: {
        authorization: '9Q1xbkwgyZV0MTNnLCEszm7WAfvhtDYuRorjS2IXe8KplHJ45aCcwaXkUANnF3ITB7gjLVtQmh2eOHob',
      },
    });

    console.log("✅ SMS Sent:", response.data);
    console.log("✅ SMS Sent:", response.data);
  } catch (error) {
    console.error("❌ Error sending SMS:", error.response?.data || error.message);
  }
};

export { sendSMS };
