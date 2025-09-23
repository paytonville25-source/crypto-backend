const express = require("express");
const axios = require("axios"); // install with npm install axios
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY;

// 1. Unity asks for a payment → we create it via NowPayments
app.post("/create-payment", async (req, res) => {
  try {
    const response = await axios.post(
      "https://api.nowpayments.io/v1/payment",
      req.body,
      { headers: { "x-api-key": NOWPAYMENTS_API_KEY, "Content-Type": "application/json" } }
    );

    res.json(response.data);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Failed to create payment" });
  }
});

// 2. NowPayments notifies us (callback)
app.post("/nowpayments-callback", async (req, res) => {
  console.log("Callback received:", req.body);

  // Check payment status
  if (req.body.payment_status === "finished") {
    // ✅ Grant PlayFab currency here (call PlayFab API with Server Secret Key)
    console.log("Payment confirmed. Awarding coins to player...");
  }

  res.sendStatus(200);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
