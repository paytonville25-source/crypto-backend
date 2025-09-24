const express = require("express");
const axios = require("axios"); // Use axios instead of fetch
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

    // Forward request to NowPayments using axios
    const response = await axios.post("https://api.nowpayments.io/v1/payment", req.body, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
    });

    // Success → return payment info to Unity
    res.json(response.data);
  } catch (err) {
    console.error("Server error:", err);
    
    // Handle axios error response
    if (err.response) {
      return res.status(err.response.status).json({
        error: "NowPayments API error",
        details: err.response.data,
      });
    }
    
    res.status(500).json({ error: "Server crashed", details: err.message });
  }
});

// Root route (for quick testing)
app.get("/", (req, res) => {
  res.send("Hello World! Server is running");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});