// backtestEngine.js - Professional Backtesting System

class BacktestEngine {
    constructor() {
        this.trades = [];
        this.performance = {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            totalProfit: 0,
            maxDrawdown: 0,
            winRate: 0,
            profitFactor: 0,
            sharpeRatio: 0
        };
    }

    async runBacktest(symbol, timeframe, period = 30) {
        console.log(`Starting backtest for ${symbol} on ${timeframe} for ${period} days`);
        
        // Load historical data
        const candles = await this.loadHistoricalData(symbol, timeframe, period);
        if (!candles || candles.length < 100) {
            throw new Error('Insufficient historical data for backtesting');
        }

        this.trades = [];
        let equity = 10000; // Starting capital
        let peakEquity = equity;
        let maxDrawdown = 0;
        let totalWins = 0;
        let totalLosses = 0;

        // Simulate trading
        for (let i = 50; i < candles.length - 1; i++) {
            const historicalData = candles.slice(0, i + 1);
            const currentCandle = candles[i];
            
            // Analyze current market condition
            const analysis = tradingEngine.analyzeCandles(historicalData);
            
            // Only trade if signal confidence is high
            if (analysis.signal.confidence >= 70 && analysis.signal.direction !== 'HOLD') {
                const entryPrice = currentCandle.close;
                const positionSize = this.calculatePositionSize(equity, analysis.signal);
                
                // Simulate trade
                const tradeResult = this.simulateTrade(
                    analysis.signal, 
                    entryPrice, 
                    positionSize, 
                    candles.slice(i + 1)
                );

                if (tradeResult) {
                    // Update equity
                    equity += tradeResult.profit;
                    
                    // Update performance metrics
                    if (tradeResult.profit > 0) {
                        totalWins++;
                    } else {
                        totalLosses++;
                    }

                    // Update max drawdown
                    if (equity > peakEquity) {
                        peakEquity = equity;
                    }
                    const drawdown = ((peakEquity - equity) / peakEquity) * 100;
                    if (drawdown > maxDrawdown) {
                        maxDrawdown = drawdown;
                    }

                    this.trades.push({
                        timestamp: currentCandle.t,
                        direction: analysis.signal.direction,
                        entry: entryPrice,
                        exit: tradeResult.exitPrice,
                        profit: tradeResult.profit,
                        profitPercent: (tradeResult.profit / positionSize) * 100,
                        duration: tradeResult.duration
                    });
                }
            }
        }

        // Calculate final performance metrics
        this.performance = {
            totalTrades: this.trades.length,
            winningTrades: totalWins,
            losingTrades: totalLosses,
            winRate: this.trades.length > 0 ? (totalWins / this.trades.length) * 100 : 0,
            totalProfit: equity - 10000,
            totalProfitPercent: ((equity - 10000) / 10000) * 100,
            maxDrawdown: maxDrawdown,
            finalEquity: equity
        };

        console.log('Backtest completed:', this.performance);
        return {
            performance: this.performance,
            trades: this.trades
        };
    }

    simulateTrade(signal, entryPrice, positionSize, futureCandles) {
        const stopLoss = signal.stopLoss;
        const takeProfit = signal.takeProfit;
        const direction = signal.direction;

        for (let i = 0; i < Math.min(futureCandles.length, 50); i++) {
            const candle = futureCandles[i];
            
            if (direction === 'LONG') {
                // Check for stop loss hit
                if (candle.low <= stopLoss) {
                    return {
                        exitPrice: stopLoss,
                        profit: (stopLoss - entryPrice) * positionSize,
                        duration: i + 1
                    };
                }
                // Check for take profit hit
                if (candle.high >= takeProfit) {
                    return {
                        exitPrice: takeProfit,
                        profit: (takeProfit - entryPrice) * positionSize,
                        duration: i + 1
                    };
                }
            } else if (direction === 'SHORT') {
                // Check for stop loss hit
                if (candle.high >= stopLoss) {
                    return {
                        exitPrice: stopLoss,
                        profit: (entryPrice - stopLoss) * positionSize,
                        duration: i + 1
                    };
                }
                // Check for take profit hit
                if (candle.low <= takeProfit) {
                    return {
                        exitPrice: takeProfit,
                        profit: (entryPrice - takeProfit) * positionSize,
                        duration: i + 1
                    };
                }
            }
        }

        // If no SL/TP hit, exit at last candle
        const lastCandle = futureCandles[futureCandles.length - 1];
        if (direction === 'LONG') {
            return {
                exitPrice: lastCandle.close,
                profit: (lastCandle.close - entryPrice) * positionSize,
                duration: futureCandles.length
            };
        } else {
            return {
                exitPrice: lastCandle.close,
                profit: (entryPrice - lastCandle.close) * positionSize,
                duration: futureCandles.length
            };
        }
    }

    calculatePositionSize(equity, signal) {
        const riskPercent = 2; // 2% risk per trade
        const riskAmount = equity * (riskPercent / 100);
        const priceRisk = Math.abs(signal.entry - signal.stopLoss);
        
        return riskAmount / priceRisk;
    }

    async loadHistoricalData(symbol, timeframe, days) {
        const intervals = {
            '1m': 1,
            '5m': 5,
            '15m': 15,
            '1h': 60,
            '4h': 240,
            '1d': 1440
        };

        const intervalMinutes = intervals[timeframe] || 5;
        const totalCandles = (days * 24 * 60) / intervalMinutes;
        
        try {
            const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${timeframe}&limit=${totalCandles}`;
            const response = await fetch(url);
            const data = await response.json();
            
            return data.map(candle => ({
                t: candle[0],
                open: parseFloat(candle[1]),
                high: parseFloat(candle[2]),
                low: parseFloat(candle[3]),
                close: parseFloat(candle[4]),
                vol: parseFloat(candle[5])
            }));
        } catch (error) {
            console.error('Error loading historical data:', error);
            return null;
        }
    }

    generateReport() {
        const report = {
            summary: this.performance,
            equityCurve: this.calculateEquityCurve(),
            monthlyPerformance: this.calculateMonthlyPerformance(),
            tradeAnalysis: this.analyzeTrades()
        };

        return report;
    }

    calculateEquityCurve() {
        let equity = 10000;
        return this.trades.map(trade => {
            equity += trade.profit;
            return {
                timestamp: trade.timestamp,
                equity: equity
            };
        });
    }

    calculateMonthlyPerformance() {
        // Group trades by month and calculate performance
        const monthly = {};
        
        this.trades.forEach(trade => {
            const date = new Date(trade.timestamp);
            const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
            
            if (!monthly[monthKey]) {
                monthly[monthKey] = { trades: 0, profit: 0 };
            }
            
            monthly[monthKey].trades++;
            monthly[monthKey].profit += trade.profit;
        });

        return monthly;
    }

    analyzeTrades() {
        const analysis = {
            bestTrade: null,
            worstTrade: null,
            avgTrade: 0,
            avgWin: 0,
            avgLoss: 0,
            longestStreak: 0,
            currentStreak: 0
        };

        if (this.trades.length === 0) return analysis;

        let currentStreak = 0;
        let maxStreak = 0;
        let totalProfit = 0;
        let winTrades = [];
        let lossTrades = [];

        this.trades.forEach(trade => {
            totalProfit += trade.profit;

            if (trade.profit > 0) {
                winTrades.push(trade);
                currentStreak = currentStreak > 0 ? currentStreak + 1 : 1;
            } else {
                lossTrades.push(trade);
                currentStreak = currentStreak < 0 ? currentStreak - 1 : -1;
            }

            maxStreak = Math.max(maxStreak, Math.abs(currentStreak));
        });

        analysis.bestTrade = [...this.trades].sort((a, b) => b.profit - a.profit)[0];
        analysis.worstTrade = [...this.trades].sort((a, b) => a.profit - b.profit)[0];
        analysis.avgTrade = totalProfit / this.trades.length;
        analysis.avgWin = winTrades.length > 0 ? winTrades.reduce((sum, t) => sum + t.profit, 0) / winTrades.length : 0;
        analysis.avgLoss = lossTrades.length > 0 ? lossTrades.reduce((sum, t) => sum + t.profit, 0) / lossTrades.length : 0;
        analysis.longestStreak = maxStreak;

        return analysis;
    }
}

// Export backtest engine
const backtestEngine = new BacktestEngine();
