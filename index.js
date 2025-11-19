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
    console.log("Received payment request:", JSON.stringify(req.body, null, 2));

    try {
        const apiKey = process.env.NOWPAYMENTS_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "NOWPAYMENTS_API_KEY not set" });
        }

        // Validate required fields
        const requiredFields = ['price_amount', 'pay_currency', 'order_id'];
        for (const field of requiredFields) {
            if (!req.body[field]) {
                return res.status(400).json({ 
                    error: `Missing required field: ${field}` 
                });
            }
        }

        // 🔑 Explicit payload conversion with validation
        const priceAmount = parseFloat(req.body.price_amount);
        if (isNaN(priceAmount) || priceAmount <= 0) {
            return res.status(400).json({ error: "Invalid price_amount" });
        }

        const payload = {
            price_amount: priceAmount,
            price_currency: String(req.body.price_currency || "usd"),
            pay_currency: String(req.body.pay_currency).toLowerCase(),
            order_id: String(req.body.order_id),
            order_description: String(req.body.order_description || "Unity Game Purchase"),
            ipn_callback_url: process.env.IPN_CALLBACK_URL || `${req.protocol}://${req.get('host')}/ipn-callback`
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
                timeout: 30000 // 30 second timeout
            }
        );

        console.log("NowPayments API response received");
        res.json(response.data);

    } catch (err) {
        console.error("Payment creation error:", err.message);
        
        if (err.response) {
            console.error("NowPayments API error details:", err.response.data);
            res.status(err.response.status).json({
                error: "NowPayments API error",
                details: err.response.data
            });
        } else if (err.code === 'ECONNABORTED') {
            res.status(408).json({ error: "Request timeout" });
        } else {
            res.status(500).json({ error: "Internal server error" });
        }
    }
});

// IPN Callback endpoint (for payment confirmation webhooks)
app.post("/ipn-callback", async (req, res) => {
    console.log("📩 Received IPN callback:", JSON.stringify(req.body, null, 2));
    
    try {
        // Verify the payment status and update your database
        const { payment_id, order_id, status } = req.body;
        
        if (status === "finished") {
            console.log(`✅ Payment completed: ${payment_id}, Order: ${order_id}`);
            // Here you would award coins to the user via PlayFab
        }
        
        res.status(200).send("OK");
    } catch (err) {
        console.error("IPN callback error:", err);
        res.status(500).send("Error");
    }
});

// Get minimum amount endpoint
app.get("/min-amount", async (req, res) => {
    try {
        const { currency_from = "usd", currency_to } = req.query;
        
        if (!currency_to) {
            return res.status(400).json({ error: "currency_to parameter required" });
        }

        const apiKey = process.env.NOWPAYMENTS_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "NOWPAYMENTS_API_KEY not set" });
        }

        const response = await axios.get(
            `https://api.nowpayments.io/v1/min-amount?currency_from=${currency_from}&currency_to=${currency_to}`,
            {
                headers: { "x-api-key": apiKey }
            }
        );

        res.json(response.data);
    } catch (err) {
        console.error("Min amount error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔑 API Key set: ${process.env.NOWPAYMENTS_API_KEY ? 'YES' : 'NO'}`);
});