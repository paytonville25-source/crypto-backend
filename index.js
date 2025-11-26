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

// Debug endpoint to check environment variables
app.get("/debug-env", (req, res) => {
    res.json({
        nowpaymentsKey: process.env.NOWPAYMENTS_API_KEY ? "SET" : "MISSING",
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        port: PORT
    });
});

// Create Payment route with better error handling
app.post("/create-payment", async (req, res) => {
    console.log("🔍 Received payment request:", JSON.stringify(req.body, null, 2));

    try {
        const apiKey = process.env.NOWPAYMENTS_API_KEY;
        console.log("🔑 API Key present:", !!apiKey);
        
        if (!apiKey) {
            console.error("❌ NOWPAYMENTS_API_KEY not set");
            return res.status(500).json({ 
                error: "Server configuration error",
                message: "NOWPAYMENTS_API_KEY environment variable is not set",
                details: "Please set the API key in Render environment variables"
            });
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

        // Convert price_amount to number
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

        console.log("📤 Forwarding to NowPayments:", payload);

        const response = await axios.post(
            "https://api.nowpayments.io/v1/payment",
            payload,
            {
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                },
                timeout: 30000
            }
        );

        console.log("✅ NowPayments API response received");
        res.json(response.data);

    } catch (err) {
        console.error("💥 Payment creation error:", err.message);
        console.error("Stack trace:", err.stack);
        
        if (err.response) {
            console.error("NowPayments API error details:", err.response.data);
            res.status(err.response.status).json({
                error: "NowPayments API error",
                message: err.message,
                details: err.response.data
            });
        } else if (err.code === 'ECONNABORTED') {
            res.status(408).json({ error: "Request timeout" });
        } else {
            res.status(500).json({
                error: "Internal server error",
                message: err.message,
                stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
            });
        }
    }
});

// Payout endpoint for PG coins
app.post("/payout-pg", async (req, res) => {
    console.log("💰 Payout request:", JSON.stringify(req.body, null, 2));

    try {
        const { playfabId, pgCoinsAmount, payoutAddress, payoutCurrency } = req.body;

        // Validate required fields
        if (!playfabId || !pgCoinsAmount || !payoutAddress || !payoutCurrency) {
            return res.status(400).json({ 
                error: "Missing required fields: playfabId, pgCoinsAmount, payoutAddress, payoutCurrency" 
            });
        }

        const apiKey = process.env.NOWPAYMENTS_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "NOWPAYMENTS_API_KEY not set" });
        }

        // Convert PG coins to USD equivalent (adjust rate as needed)
        const usdAmount = pgCoinsAmount / 100; // Example: 100 PG coins = $1
        const minPayoutUSD = 5.00; // Minimum $5 payout

        if (usdAmount < minPayoutUSD) {
            return res.status(400).json({ 
                error: `Minimum payout is ${minPayoutUSD} USD equivalent (${minPayoutUSD * 100} PG coins)` 
            });
        }

        // First, estimate the crypto amount
        let estimatedCryptoAmount;
        try {
            const estimateResponse = await axios.get(
                `https://api.nowpayments.io/v1/estimate?amount=${usdAmount}&currency_from=usd&currency_to=${payoutCurrency.toLowerCase()}`,
                {
                    headers: { "x-api-key": apiKey }
                }
            );
            estimatedCryptoAmount = estimateResponse.data.estimated_amount;
            console.log(`💰 Estimated ${payoutCurrency} amount:`, estimatedCryptoAmount);
        } catch (estimateError) {
            console.error("Estimation error:", estimateError.message);
            return res.status(400).json({ 
                error: "Could not estimate payout amount. Please try again." 
            });
        }

        // Create payout through NowPayments
        const payoutPayload = {
            withdrawals: [
                {
                    address: payoutAddress,
                    currency: payoutCurrency.toLowerCase(),
                    amount: usdAmount, // USD amount
                    ipn_callback_url: process.env.IPN_CALLBACK_URL || `${req.protocol}://${req.get('host')}/payout-callback`
                }
            ]
        };

        console.log("📤 Sending payout to NowPayments:", payoutPayload);

        const response = await axios.post(
            "https://api.nowpayments.io/v1/payout",
            payoutPayload,
            {
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                },
                timeout: 30000
            }
        );

        console.log("✅ NowPayments payout response:", response.data);

        res.json({
            payoutId: response.data.id,
            status: "processing",
            message: "Payout initiated successfully",
            payoutAmount: usdAmount,
            payoutCurrency: payoutCurrency,
            estimatedCryptoAmount: estimatedCryptoAmount
        });

    } catch (err) {
        console.error("💥 Payout error:", err.message);
        
        if (err.response) {
            console.error("NowPayments payout error details:", err.response.data);
            res.status(err.response.status).json({
                error: "NowPayments payout error",
                message: err.message,
                details: err.response.data
            });
        } else {
            res.status(500).json({
                error: "Payout processing failed",
                message: err.message
            });
        }
    }
});

// Payout callback endpoint
app.post("/payout-callback", async (req, res) => {
    console.log("📩 Received payout callback:", JSON.stringify(req.body, null, 2));
    
    try {
        const { payout_id, status, address, currency, amount } = req.body;
        
        if (status === "finished") {
            console.log(`✅ Payout completed: ${payout_id}, ${amount} ${currency} to ${address}`);
            // Here you would update your database that payout is complete
            // You could also send email notifications, etc.
        } else if (status === "failed") {
            console.log(`❌ Payout failed: ${payout_id}`);
            // Here you would refund PG coins to user or mark for manual review
        }
        
        res.status(200).send("OK");
    } catch (err) {
        console.error("Payout callback error:", err);
        res.status(500).send("Error");
    }
});

// Check payout status
app.get("/payout-status/:payoutId", async (req, res) => {
    try {
        const { payoutId } = req.params;
        const apiKey = process.env.NOWPAYMENTS_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: "NOWPAYMENTS_API_KEY not set" });
        }

        const response = await axios.get(
            `https://api.nowpayments.io/v1/payout/${payoutId}`,
            {
                headers: { "x-api-key": apiKey }
            }
        );

        res.json(response.data);
    } catch (err) {
        console.error("Payout status error:", err.message);
        
        if (err.response) {
            res.status(err.response.status).json({
                error: "NowPayments API error",
                details: err.response.data
            });
        } else {
            res.status(500).json({ error: err.message });
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

// Get conversion rate for PG coins
app.get("/conversion-rate", (req, res) => {
    res.json({
        pgToUsdRate: 100, // 100 PG coins = $1 USD
        minPayoutPG: 500, // Minimum 500 PG coins ($5 equivalent)
        supportedCurrencies: ["btc", "eth", "usdt", "ltc", "doge"]
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔑 API Key set: ${process.env.NOWPAYMENTS_API_KEY ? 'YES' : 'NO'}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`💰 Payout system: READY`);
});