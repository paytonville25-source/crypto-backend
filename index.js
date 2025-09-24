const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// Add CORS middleware to handle Unity WebGL requests
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Root route
app.get("/", (req, res) => {
    res.send("Hello World! Server is running 🚀");
});

// Create Payment route
app.post("/create-payment", async (req, res) => {
    try {
        const apiKey = process.env.NOWPAYMENTS_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: "NOWPAYMENTS_API_KEY not set on server" });
        }

        const response = await axios.post("https://api.nowpayments.io/v1/payment", req.body, {
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
            },
        });

        res.json(response.data);
    } catch (err) {
        console.error("Server error:", err);
        
        if (err.response) {
            return res.status(err.response.status).json({
                error: "NowPayments API error",
                details: err.response.data,
            });
        }
        
        res.status(500).json({ error: "Server error", details: err.message });
    }
});

// Get minimum amount
app.get("/get-min-amount/:from_currency/:to_currency", async (req, res) => {
    try {
        const { from_currency, to_currency } = req.params;
        const apiKey = process.env.NOWPAYMENTS_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: "NOWPAYMENTS_API_KEY not set" });
        }

        const response = await axios.get(
            `https://api.nowpayments.io/v1/min-amount?currency_from=${from_currency}&currency_to=${to_currency}`,
            {
                headers: { "x-api-key": apiKey },
            }
        );

        res.json(response.data);
    } catch (err) {
        console.error("Min amount error:", err);
        
        if (err.response) {
            return res.status(err.response.status).json({
                error: "NowPayments API error",
                details: err.response.data,
            });
        }
        
        res.status(500).json({ error: "Server error", details: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});