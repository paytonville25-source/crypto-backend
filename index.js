const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// Test route
app.get("/", (req, res) => {
    res.json({ message: "Server is running 🚀", timestamp: new Date().toISOString() });
});

// Health check
app.get("/health", (req, res) => {
    res.json({ status: "OK", serverTime: new Date().toISOString() });
});

// Create Payment route
app.post("/create-payment", async (req, res) => {
    console.log("Received payment request:", req.body);

    try {
        const apiKey = process.env.NOWPAYMENTS_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "NOWPAYMENTS_API_KEY not set" });
        }

        // Build payload explicitly
        const payload = {
            price_amount: req.body.price_amount,
            price_currency: req.body.price_currency,
            pay_currency: req.body.pay_currency,
            order_id: req.body.order_id,
            order_description: req.body.order_description || "Unity Game Purchase"
        };

        console.log("Forwarding to NowPayments:", payload);

        const response = await axios.post(
            "https://api.nowpayments.io/v1/payment",
            payload,
            {
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                },
            }
        );

        console.log("NowPayments API response:", response.data);
        res.json(response.data);

    } catch (err) {
        if (err.response) {
            console.error("NowPayments API error:", err.response.data);
            res.status(err.response.status).json(err.response.data);
        } else {
            console.error("Server error:", err.message);
            res.status(500).json({ error: err.message });
        }
    }
});


app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔑 API Key set: ${process.env.NOWPAYMENTS_API_KEY ? 'YES' : 'NO'}`);
});