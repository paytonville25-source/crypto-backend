const express = require("express");
const fetch = require("node-fetch"); // make sure you installed: npm install node-fetch
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// Create Payment route
app.post("/create-payment", async (req, res) => {
  try {
    const apiKey = process.env.NOWPAYMENTS_API_KEY;

    // Check if API key is missing
    if (!apiKey) {
      return res.status(500).json({ error: "NOWPAYMENTS_API_KEY not set on server" });
    }

    // Forward request to NowPayments
    const response = await fetch("https://api.nowpayments.io/v1/payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    // If NowPayments returns error, pass it back
    if (!response.ok) {
      return res.status(response.status).json({
        error: "NowPayments API error",
        details: data,
      });
    }

    // Success → return payment info to Unity
    res.json(data);
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server crashed", details: err.message });
  }
});

// Root route (for quick testing)
app.get("/", (req, res) => {
  res.send("Hello World! Server is running 🚀");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
