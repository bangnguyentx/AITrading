// tradingEngine.js - Core Trading Logic

class TradingEngine {
    constructor() {
        this.marketStructure = new MarketStructure();
        this.orderBlockDetector = new OrderBlockDetector();
        this.fvgDetector = new FVGDetector();
        this.liquidityDetector = new LiquidityDetector();
        this.volumeAnalyzer = new VolumeAnalyzer();
    }

    // Main analysis function
    analyzeCandles(candles) {
        const structure = this.marketStructure.analyze(candles);
        const orderBlocks = this.orderBlockDetector.findOrderBlocks(candles);
        const fvgs = this.fvgDetector.findFVGs(candles);
        const liquidity = this.liquidityDetector.findLiquiditySweeps(candles);
        const volume = this.volumeAnalyzer.analyzeVolume(candles);

        return {
            structure,
            orderBlocks,
            fvgs,
            liquidity,
            volume,
            confluence: this.calculateConfluence(structure, orderBlocks, fvgs, liquidity, volume),
            signal: this.generateSignal(structure, orderBlocks, fvgs, liquidity, volume)
        };
    }

    calculateConfluence(structure, orderBlocks, fvgs, liquidity, volume) {
        let score = 0;
        let maxScore = 0;

        // Market Structure (30%)
        if (structure.trend === 'BULLISH') score += 30;
        else if (structure.trend === 'BEARISH') score += 0;
        else score += 15;
        maxScore += 30;

        // Order Blocks (25%)
        if (orderBlocks.bullish.length > 0) score += 25;
        if (orderBlocks.bearish.length > 0) score -= 25;
        maxScore += 25;

        // FVG (20%)
        if (fvgs.bullish.length > 0) score += 20;
        if (fvgs.bearish.length > 0) score -= 20;
        maxScore += 20;

        // Liquidity (15%)
        if (liquidity.sweepHigh) score -= 15;
        if (liquidity.sweepLow) score += 15;
        maxScore += 15;

        // Volume (10%)
        if (volume.imbalance > 1.2) score += 10;
        else if (volume.imbalance < 0.8) score -= 10;
        maxScore += 10;

        return {
            score: Math.max(0, Math.min(100, (score / maxScore) * 100)),
            breakdown: {
                structure: structure.trend === 'BULLISH' ? 30 : structure.trend === 'BEARISH' ? 0 : 15,
                orderBlocks: orderBlocks.bullish.length > 0 ? 25 : orderBlocks.bearish.length > 0 ? 0 : 12,
                fvg: fvgs.bullish.length > 0 ? 20 : fvgs.bearish.length > 0 ? 0 : 10,
                liquidity: liquidity.sweepLow ? 15 : liquidity.sweepHigh ? 0 : 7,
                volume: volume.imbalance > 1.2 ? 10 : volume.imbalance < 0.8 ? 0 : 5
            }
        };
    }

    generateSignal(structure, orderBlocks, fvgs, liquidity, volume) {
        const confluence = this.calculateConfluence(structure, orderBlocks, fvgs, liquidity, volume);
        
        let direction = 'HOLD';
        if (confluence.score >= 70) direction = 'LONG';
        else if (confluence.score <= 30) direction = 'SHORT';

        // Calculate entry, SL, TP based on ICT concepts
        const currentPrice = structure.currentPrice;
        const atr = this.calculateATR(structure.candles);

        let entry = currentPrice;
        let stopLoss = currentPrice;
        let takeProfit = currentPrice;

        if (direction === 'LONG') {
            // Use bullish order block or FVG for entry
            const bullOB = orderBlocks.bullish[orderBlocks.bullish.length - 1];
            const bullFVG = fvgs.bullish[fvgs.bullish.length - 1];
            
            if (bullOB) {
                entry = bullOB.low + (bullOB.high - bullOB.low) * 0.5;
                stopLoss = bullOB.low - atr * 0.5;
                takeProfit = entry + (entry - stopLoss) * 2;
            } else if (bullFVG) {
                entry = bullFVG.low;
                stopLoss = bullFVG.low - atr;
                takeProfit = entry + (entry - stopLoss) * 3;
            }
        } else if (direction === 'SHORT') {
            // Use bearish order block or FVG for entry
            const bearOB = orderBlocks.bearish[orderBlocks.bearish.length - 1];
            const bearFVG = fvgs.bearish[fvgs.bearish.length - 1];
            
            if (bearOB) {
                entry = bearOB.high - (bearOB.high - bearOB.low) * 0.5;
                stopLoss = bearOB.high + atr * 0.5;
                takeProfit = entry - (stopLoss - entry) * 2;
            } else if (bearFVG) {
                entry = bearFVG.high;
                stopLoss = bearFVG.high + atr;
                takeProfit = entry - (stopLoss - entry) * 3;
            }
        }

        const riskReward = direction !== 'HOLD' ? 
            Math.abs((takeProfit - entry) / (entry - stopLoss)).toFixed(2) : '0';

        return {
            direction,
            confidence: Math.round(confluence.score),
            entry,
            stopLoss,
            takeProfit,
            riskReward,
            atr
        };
    }

    calculateATR(candles, period = 14) {
        let trSum = 0;
        for (let i = candles.length - period; i < candles.length - 1; i++) {
            const tr = Math.max(
                candles[i].high - candles[i].low,
                Math.abs(candles[i].high - candles[i-1].close),
                Math.abs(candles[i].low - candles[i-1].close)
            );
            trSum += tr;
        }
        return trSum / period;
    }
}

// Market Structure Analysis
class MarketStructure {
    analyze(candles) {
        const swings = this.findSwings(candles);
        const trend = this.determineTrend(swings);
        
        return {
            swings,
            trend,
            currentPrice: candles[candles.length - 1].close,
            candles
        };
    }

    findSwings(candles) {
        const swings = [];
        for (let i = 2; i < candles.length - 2; i++) {
            // Swing High
            if (candles[i].high > candles[i-1].high && candles[i].high > candles[i-2].high &&
                candles[i].high > candles[i+1].high && candles[i].high > candles[i+2].high) {
                swings.push({ type: 'HIGH', price: candles[i].high, index: i });
            }
            // Swing Low
            if (candles[i].low < candles[i-1].low && candles[i].low < candles[i-2].low &&
                candles[i].low < candles[i+1].low && candles[i].low < candles[i+2].low) {
                swings.push({ type: 'LOW', price: candles[i].low, index: i });
            }
        }
        return swings;
    }

    determineTrend(swings) {
        if (swings.length < 4) return 'SIDEWAYS';

        const recentSwings = swings.slice(-4);
        let higherHighs = 0;
        let higherLows = 0;
        let lowerHighs = 0;
        let lowerLows = 0;

        for (let i = 1; i < recentSwings.length; i++) {
            const current = recentSwings[i];
            const previous = recentSwings[i-1];

            if (current.type === 'HIGH' && previous.type === 'HIGH') {
                if (current.price > previous.price) higherHighs++;
                else lowerHighs++;
            } else if (current.type === 'LOW' && previous.type === 'LOW') {
                if (current.price > previous.price) higherLows++;
                else lowerLows++;
            }
        }

        if (higherHighs >= 2 && higherLows >= 1) return 'BULLISH';
        if (lowerHighs >= 2 && lowerLows >= 1) return 'BEARISH';
        return 'SIDEWAYS';
    }
}

// Order Block Detection
class OrderBlockDetector {
    findOrderBlocks(candles) {
        const bullish = [];
        const bearish = [];

        for (let i = 1; i < candles.length - 1; i++) {
            const current = candles[i];
            const next = candles[i + 1];

            // Bullish Order Block: Bearish candle followed by bullish candle
            if (current.close < current.open && next.close > next.open) {
                bullish.push({
                    high: current.high,
                    low: current.low,
                    time: current.t,
                    strength: this.calculateOBStrength(candles, i)
                });
            }

            // Bearish Order Block: Bullish candle followed by bearish candle
            if (current.close > current.open && next.close < next.open) {
                bearish.push({
                    high: current.high,
                    low: current.low,
                    time: current.t,
                    strength: this.calculateOBStrength(candles, i)
                });
            }
        }

        return { bullish, bearish };
    }

    calculateOBStrength(candles, index) {
        const candle = candles[index];
        const bodySize = Math.abs(candle.close - candle.open);
        const totalRange = candle.high - candle.low;
        return bodySize / totalRange; // Higher = stronger OB
    }
}

// Fair Value Gap Detection
class FVGDetector {
    findFVGs(candles) {
        const bullish = [];
        const bearish = [];

        for (let i = 1; i < candles.length - 1; i++) {
            const prev = candles[i - 1];
            const curr = candles[i];
            const next = candles[i + 1];

            // Bullish FVG
            if (prev.low > curr.high && next.high < prev.low) {
                bullish.push({
                    high: prev.low,
                    low: curr.high,
                    time: curr.t
                });
            }

            // Bearish FVG
            if (prev.high < curr.low && next.low > prev.high) {
                bearish.push({
                    high: curr.low,
                    low: prev.high,
                    time: curr.t
                });
            }
        }

        return { bullish, bearish };
    }
}

// Liquidity Sweep Detection
class LiquidityDetector {
    findLiquiditySweeps(candles) {
        let sweepHigh = false;
        let sweepLow = false;
        let sweepLevel = null;

        if (candles.length < 10) return { sweepHigh, sweepLow, sweepLevel };

        const recentHigh = Math.max(...candles.slice(-5).map(c => c.high));
        const recentLow = Math.min(...candles.slice(-5).map(c => c.low));

        const lastCandle = candles[candles.length - 1];
        const prevCandle = candles[candles.length - 2];

        // Check for liquidity sweep high
        if (lastCandle.high > recentHigh && lastCandle.close < lastCandle.open) {
            sweepHigh = true;
            sweepLevel = recentHigh;
        }

        // Check for liquidity sweep low
        if (lastCandle.low < recentLow && lastCandle.close > lastCandle.open) {
            sweepLow = true;
            sweepLevel = recentLow;
        }

        return { sweepHigh, sweepLow, sweepLevel };
    }
}

// Volume Analysis
class VolumeAnalyzer {
    analyzeVolume(candles) {
        const recentVolume = candles.slice(-20);
        const totalVolume = recentVolume.reduce((sum, candle) => sum + candle.vol, 0);
        const avgVolume = totalVolume / recentVolume.length;

        const currentVolume = candles[candles.length - 1].vol;
        const volumeRatio = currentVolume / avgVolume;

        // Volume delta (buying vs selling pressure)
        let buyingVolume = 0;
        let sellingVolume = 0;

        recentVolume.forEach(candle => {
            if (candle.close > candle.open) {
                buyingVolume += candle.vol;
            } else {
                sellingVolume += candle.vol;
            }
        });

        const volumeDelta = buyingVolume - sellingVolume;
        const imbalance = buyingVolume / (sellingVolume || 1);

        return {
            currentVolume,
            avgVolume,
            volumeRatio,
            volumeDelta,
            imbalance,
            buyingPressure: buyingVolume > sellingVolume
        };
    }
}

// Export for use in main application
const tradingEngine = new TradingEngine();
