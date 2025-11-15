// multiTimeframe.js - Multi-Timeframe Analysis System

class MultiTimeframeAnalyzer {
    constructor() {
        this.timeframes = ['5m', '15m', '1h', '4h', '1d'];
        this.analysisResults = {};
    }

    async analyzeSymbol(symbol) {
        console.log(`Starting multi-timeframe analysis for ${symbol}`);
        
        const analyses = {};
        
        // Analyze each timeframe
        for (const tf of this.timeframes) {
            try {
                const candles = await this.fetchCandles(symbol, tf, 300);
                if (candles && candles.length > 50) {
                    analyses[tf] = {
                        ...tradingEngine.analyzeCandles(candles),
                        candles: candles,
                        timestamp: Date.now()
                    };
                }
            } catch (error) {
                console.error(`Error analyzing ${tf}:`, error);
            }
        }

        this.analysisResults[symbol] = analyses;
        
        // Generate consensus signal
        const consensus = this.generateConsensus(analyses);
        const aiPrediction = await this.getAIPrediction(symbol);
        
        return {
            symbol,
            analyses,
            consensus,
            aiPrediction,
            timestamp: Date.now()
        };
    }

    generateConsensus(analyses) {
        let totalWeight = 0;
        let weightedScore = 0;
        let directionVotes = { LONG: 0, SHORT: 0, HOLD: 0 };

        // Weight timeframes by importance
        const weights = {
            '5m': 0.1,
            '15m': 0.2,
            '1h': 0.3,
            '4h': 0.25,
            '1d': 0.15
        };

        for (const [tf, analysis] of Object.entries(analyses)) {
            const weight = weights[tf] || 0.1;
            const signal = analysis.signal;
            
            if (signal.direction !== 'HOLD') {
                let score = signal.confidence / 100;
                if (signal.direction === 'SHORT') score = -score;
                
                weightedScore += score * weight;
                directionVotes[signal.direction]++;
            }
            
            totalWeight += weight;
        }

        // Determine final direction
        let finalDirection = 'HOLD';
        let confidence = Math.abs(weightedScore) * 100;

        if (weightedScore > 0.1 && confidence >= 60) {
            finalDirection = 'LONG';
        } else if (weightedScore < -0.1 && confidence >= 60) {
            finalDirection = 'SHORT';
        }

        return {
            direction: finalDirection,
            confidence: Math.round(confidence),
            weightedScore: weightedScore,
            directionVotes,
            timeframesAnalyzed: Object.keys(analyses).length
        };
    }

    async getAIPrediction(symbol) {
        try {
            // Use 1h timeframe for AI prediction
            const candles = await this.fetchCandles(symbol, '1h', 100);
            if (candles && candles.length >= 20) {
                return aiModel.predict(candles);
            }
        } catch (error) {
            console.error('AI prediction error:', error);
        }
        return 0.5; // Neutral prediction
    }

    async fetchCandles(symbol, interval, limit = 300) {
        try {
            const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
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
            console.error(`Error fetching ${interval} data for ${symbol}:`, error);
            return null;
        }
    }

    getAnalysisSummary(symbol) {
        const analysis = this.analysisResults[symbol];
        if (!analysis) return null;

        const summary = {
            symbol,
            timeframes: {},
            overallBias: 'NEUTRAL',
            strength: 0,
            keyLevels: this.extractKeyLevels(analysis)
        };

        let bullCount = 0;
        let bearCount = 0;

        for (const [tf, data] of Object.entries(analysis)) {
            summary.timeframes[tf] = {
                bias: data.structure.trend,
                confidence: data.signal.confidence,
                signal: data.signal.direction
            };

            if (data.structure.trend === 'BULLISH') bullCount++;
            else if (data.structure.trend === 'BEARISH') bearCount++;
        }

        if (bullCount > bearCount) summary.overallBias = 'BULLISH';
        else if (bearCount < bullCount) summary.overallBias = 'BEARISH';

        summary.strength = Math.abs(bullCount - bearCount) / Object.keys(analysis).length;

        return summary;
    }

    extractKeyLevels(analysis) {
        const levels = {
            support: [],
            resistance: []
        };

        for (const [tf, data] of Object.entries(analysis)) {
            // Add swing points as key levels
            data.structure.swings.forEach(swing => {
                if (swing.type === 'LOW') {
                    levels.support.push({
                        price: swing.price,
                        timeframe: tf,
                        strength: this.calculateLevelStrength(swing, data.structure.swings)
                    });
                } else {
                    levels.resistance.push({
                        price: swing.price,
                        timeframe: tf,
                        strength: this.calculateLevelStrength(swing, data.structure.swings)
                    });
                }
            });
        }

        // Remove duplicates and sort
        levels.support = this.consolidateLevels(levels.support);
        levels.resistance = this.consolidateLevels(levels.resistance);

        return levels;
    }

    calculateLevelStrength(swing, allSwings) {
        // Calculate how many times this price level has been tested
        const similarSwings = allSwings.filter(s => 
            Math.abs(s.price - swing.price) / swing.price < 0.002 // Within 0.2%
        );
        return similarSwings.length;
    }

    consolidateLevels(levels) {
        const consolidated = [];
        const tolerance = 0.002; // 0.2%

        levels.sort((a, b) => a.price - b.price);

        for (const level of levels) {
            const existing = consolidated.find(l => 
                Math.abs(l.price - level.price) / level.price < tolerance
            );

            if (existing) {
                existing.strength += level.strength;
                existing.timeframes.push(level.timeframe);
            } else {
                consolidated.push({
                    price: level.price,
                    strength: level.strength,
                    timeframes: [level.timeframe]
                });
            }
        }

        return consolidated.sort((a, b) => b.strength - a.strength).slice(0, 5);
    }
}

// Global functions for main application
async function performComprehensiveAnalysis(symbol) {
    const analyzer = new MultiTimeframeAnalyzer();
    const analysis = await analyzer.analyzeSymbol(symbol);
    
    // Combine with AI prediction
    const aiWeight = 0.3;
    const finalConfidence = analysis.consensus.confidence * (1 - aiWeight) + 
                          (analysis.aiPrediction * 100) * aiWeight;

    // Generate final signal
    const finalSignal = {
        direction: analysis.consensus.direction,
        confidence: Math.round(finalConfidence),
        entry: analysis.analyses['1h']?.signal.entry || 0,
        stopLoss: analysis.analyses['1h']?.signal.stopLoss || 0,
        takeProfit: analysis.analyses['1h']?.signal.takeProfit || 0,
        riskReward: analysis.analyses['1h']?.signal.riskReward || '0'
    };

    return {
        symbol,
        signal: finalSignal,
        aiPrediction: analysis.aiPrediction,
        confidenceBreakdown: {
            structure: analysis.consensus.confidence,
            volume: analysis.analyses['1h']?.confluence.breakdown.volume || 0,
            ai: analysis.aiPrediction * 100
        },
        multiTimeframe: analysis.analyses,
        timestamp: analysis.timestamp
    };
}

async function runBacktest(symbol) {
    return await backtestEngine.runBacktest(symbol, '1h', 30);
}

async function trainAIModel(symbol) {
    const candles = await fetchCandles(symbol, '1h', 1000);
    return await aiModel.train(candles, 30);
}

async function initializeAIModel() {
    await aiModel.loadModel();
}

// Helper function
async function fetchCandles(symbol, interval, limit) {
    const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
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
}

// Export multi-timeframe analyzer
const multiTimeframeAnalyzer = new MultiTimeframeAnalyzer();
