const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname)));

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API proxy endpoint to avoid CORS issues
app.get('/api/klines', async (req, res) => {
  try {
    const { symbol, interval, limit } = req.query;
    const response = await fetch(
      `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit || 500}`
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ticker/price', async (req, res) => {
  try {
    const { symbol } = req.query;
    const response = await fetch(
      `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/fundingRate', async (req, res) => {
  try {
    const { symbol } = req.query;
    const response = await fetch(
      `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=1`
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Quantum Trading Suite running on port ${PORT}`);
  console.log(`📊 Access at: http://localhost:${PORT}`);
});
