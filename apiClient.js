// apiClient.js
// Lightweight client for Binance Futures public endpoints (browser-safe).
// NOTE: Do NOT store API SECRET in this file. Private actions must go via server.

window.apiClient = (function(){
  const BASE = 'https://fapi.binance.com';

  function klines(symbol, interval, limit=500){
    return `${BASE}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  }

  async function loadCandles(symbol, interval='1h', limit=500){
    const res = await fetch(klines(symbol, interval, limit));
    if(!res.ok) throw new Error('Klines fetch failed');
    const data = await res.json();
    return data.map(c => ({
      t: c[0], open: +c[1], high: +c[2], low: +c[3], close: +c[4], vol: +c[5]
    }));
  }

  async function fetchJSON(url){
    const res = await fetch(url);
    if(!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return res.json();
  }

  async function fetchMarketData(symbol){
    const [price, funding, depth, ticker] = await Promise.all([
      fetchJSON(`${BASE}/fapi/v1/ticker/price?symbol=${symbol}`),
      fetchJSON(`${BASE}/fapi/v1/fundingRate?symbol=${symbol}&limit=1`),
      fetchJSON(`${BASE}/fapi/v1/depth?symbol=${symbol}&limit=5`),
      fetchJSON(`${BASE}/fapi/v1/ticker/24hr?symbol=${symbol}`)
    ]);

    return {
      symbol,
      price: parseFloat(price.price),
      fundingRate: parseFloat(funding[0]?.fundingRate || 0),
      bid: parseFloat(depth.bids?.[0]?.[0] || 0),
      ask: parseFloat(depth.asks?.[0]?.[0] || 0),
      volume: parseFloat(ticker.volume || 0),
      priceChange: parseFloat(ticker.priceChange || 0),
      priceChangePercent: parseFloat(ticker.priceChangePercent || 0),
      high: parseFloat(ticker.highPrice || 0),
      low: parseFloat(ticker.lowPrice || 0)
    };
  }

  return { loadCandles, fetchMarketData };
})();
