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
            console.error("NOWPAYMENTS_API_KEY is missing");
            return res.status(500).json({ 
                error: "Server configuration error: NOWPAYMENTS_API_KEY not set" 
            });
        }

        // Validate required fields
        const required = ['price_amount', 'price_currency', 'pay_currency', 'order_id'];
        for (const field of required) {
            if (!req.body[field]) {
                return res.status(400).json({ 
                    error: `Missing required field: ${field}` 
                });
            }
        }

        const response = await axios.post(
            "https://api.nowpayments.io/v1/payment", 
            req.body, 
            {
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                },
                timeout: 10000 // 10 second timeout
            }
        );

        console.log("NowPayments API response:", response.data);
        res.json(response.data);

    } catch (err) {
        console.error("Payment creation error:", err.message);
        
        if (err.response) {
            // NowPayments API returned an error
            console.error("NowPayments API error details:", err.response.data);
            return res.status(err.response.status).json({
                error: "NowPayments API error",
                details: err.response.data,
            });
        } else if (err.request) {
            // Request was made but no response received
            console.error("No response from NowPayments API");
            return res.status(503).json({
                error: "Cannot connect to payment service",
                details: "Service temporarily unavailable"
            });
        } else {
            // Other errors
            console.error("Server error:", err.message);
            return res.status(500).json({
                error: "Server error",
                details: err.message
            });
        }
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔑 API Key set: ${process.env.NOWPAYMENTS_API_KEY ? 'YES' : 'NO'}`);
});