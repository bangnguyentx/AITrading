// multiTimeframe.js - Multi-Timeframe Analysis System với Proxy Support

class MultiTimeframeAnalyzer {
    constructor() {
        this.timeframes = ['5m', '15m', '1h', '4h', '1d'];
        this.analysisResults = {};
        this.apiBase = window.location.hostname === 'localhost' ? 
            'https://fapi.binance.com' : 
            ''; // Sử dụng proxy khi deploy
    }

    async analyzeSymbol(symbol) {
        console.log(`🚀 Starting multi-timeframe analysis for ${symbol}`);
        
        const analyses = {};
        let successfulTimeframes = 0;
        
        // Analyze each timeframe với error handling
        for (const tf of this.timeframes) {
            try {
                DOM.status.textContent = `📊 Analyzing ${tf} timeframe...`;
                const candles = await this.fetchCandles(symbol, tf, 300);
                
                if (candles && candles.length > 50) {
                    const analysis = tradingEngine.analyzeCandles(candles);
                    analyses[tf] = {
                        ...analysis,
                        candles: candles,
                        timestamp: Date.now()
                    };
                    successfulTimeframes++;
                    console.log(`✅ ${tf} analysis completed`);
                } else {
                    console.warn(`⚠️ Insufficient data for ${tf}`);
                }
            } catch (error) {
                console.error(`❌ Error analyzing ${tf}:`, error);
            }
            
            // Small delay để tránh rate limiting
            await this.sleep(200);
        }

        if (successfulTimeframes === 0) {
            throw new Error('No timeframe data available for analysis');
        }

        this.analysisResults[symbol] = analyses;
        
        // Generate consensus signal
        const consensus = this.generateConsensus(analyses);
        const aiPrediction = DOM.useAI?.checked ? await this.getAIPrediction(symbol) : 0.5;
        
        console.log(`🎯 Analysis complete: ${consensus.direction} with ${consensus.confidence}% confidence`);
        
        return {
            symbol,
            analyses,
            consensus,
            aiPrediction,
            timestamp: Date.now(),
            successfulTimeframes
        };
    }

    generateConsensus(analyses) {
        let totalWeight = 0;
        let weightedScore = 0;
        let directionVotes = { LONG: 0, SHORT: 0, HOLD: 0 };
        let volumeConfirmation = 0;
        let structureStrength = 0;

        // Weight timeframes by importance
        const weights = {
            '1d': 0.25,   // Highest weight for daily
            '4h': 0.25,   // High weight for 4h
            '1h': 0.20,   // Medium weight for 1h
            '15m': 0.15,  // Lower weight for 15m
            '5m': 0.15    // Lowest weight for 5m
        };

        for (const [tf, analysis] of Object.entries(analyses)) {
            const weight = weights[tf] || 0.1;
            const signal = analysis.signal;
            const structure = analysis.structure;
            const volume = analysis.volume;
            
            let timeframeScore = 0;
            
            // Market Structure Score (40%)
            if (structure.trend === 'BULLISH') {
                timeframeScore += 40;
                structureStrength += weight;
            } else if (structure.trend === 'BEARISH') {
                timeframeScore -= 40;
                structureStrength -= weight;
            }
            
            // Signal Confidence (30%)
            if (signal.direction !== 'HOLD') {
                let signalScore = (signal.confidence / 100) * 30;
                if (signal.direction === 'SHORT') signalScore = -signalScore;
                timeframeScore += signalScore;
                directionVotes[signal.direction]++;
            }
            
            // Volume Confirmation (20%)
            if (volume.buyingPressure) {
                timeframeScore += 20;
                volumeConfirmation += weight;
            } else {
                timeframeScore -= 20;
                volumeConfirmation -= weight;
            }
            
            // Order Block/FVG Confluence (10%)
            if (analysis.orderBlocks.bullish.length > 0 || analysis.fvgs.bullish.length > 0) {
                timeframeScore += 10;
            } else if (analysis.orderBlocks.bearish.length > 0 || analysis.fvgs.bearish.length > 0) {
                timeframeScore -= 10;
            }
            
            weightedScore += (timeframeScore / 100) * weight;
            totalWeight += weight;
        }

        // Normalize scores
        const normalizedScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
        const finalConfidence = Math.abs(normalizedScore) * 100;

        // Determine final direction với volume và structure confirmation
        let finalDirection = 'HOLD';
        if (normalizedScore > 0.15 && finalConfidence >= 60 && volumeConfirmation > 0) {
            finalDirection = 'LONG';
        } else if (normalizedScore < -0.15 && finalConfidence >= 60 && volumeConfirmation < 0) {
            finalDirection = 'SHORT';
        }

        return {
            direction: finalDirection,
            confidence: Math.round(finalConfidence),
            weightedScore: normalizedScore,
            directionVotes,
            volumeConfirmation: Math.round(volumeConfirmation * 100),
            structureStrength: Math.round(structureStrength * 100),
            timeframesAnalyzed: Object.keys(analyses).length
        };
    }

    async getAIPrediction(symbol) {
        try {
            DOM.status.textContent = '🤖 Running AI prediction...';
            // Use 1h timeframe for AI prediction
            const candles = await this.fetchCandles(symbol, '1h', 100);
            if (candles && candles.length >= 20) {
                const prediction = await aiModel.predict(candles);
                console.log(`🧠 AI Prediction: ${prediction}`);
                return prediction;
            }
        } catch (error) {
            console.error('AI prediction error:', error);
        }
        return 0.5; // Neutral prediction
    }

    async fetchCandles(symbol, interval, limit = 300) {
        try {
            let url;
            
            // Sử dụng proxy endpoint khi deploy, direct API khi development
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
            } else {
                // Sử dụng proxy endpoint trên Render
                url = `/api/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
            }
            
            console.log(`📡 Fetching data from: ${url}`);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!Array.isArray(data) || data.length === 0) {
                throw new Error('No data returned from API');
            }
            
            // Validate và transform data
            const candles = data.map((candle, index) => {
                if (!Array.isArray(candle) || candle.length < 6) {
                    throw new Error(`Invalid candle data at index ${index}`);
                }
                
                return {
                    t: parseInt(candle[0]),
                    open: parseFloat(candle[1]),
                    high: parseFloat(candle[2]),
                    low: parseFloat(candle[3]),
                    close: parseFloat(candle[4]),
                    vol: parseFloat(candle[5])
                };
            }).filter(candle => 
                candle.t > 0 && 
                !isNaN(candle.open) && 
                !isNaN(candle.high) && 
                !isNaN(candle.low) && 
                !isNaN(candle.close) &&
                candle.high >= candle.low &&
                candle.high >= Math.max(candle.open, candle.close) &&
                candle.low <= Math.min(candle.open, candle.close)
            );
            
            console.log(`✅ Fetched ${candles.length} valid candles for ${symbol} ${interval}`);
            return candles;
            
        } catch (error) {
            console.error(`❌ Error fetching ${interval} data for ${symbol}:`, error);
            
            // Fallback: thử direct Binance API nếu proxy fail
            if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                try {
                    console.log('🔄 Trying direct Binance API as fallback...');
                    const fallbackUrl = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
                    const fallbackResponse = await fetch(fallbackUrl);
                    const fallbackData = await fallbackResponse.json();
                    
                    return fallbackData.map(candle => ({
                        t: parseInt(candle[0]),
                        open: parseFloat(candle[1]),
                        high: parseFloat(candle[2]),
                        low: parseFloat(candle[3]),
                        close: parseFloat(candle[4]),
                        vol: parseFloat(candle[5])
                    }));
                } catch (fallbackError) {
                    console.error('❌ Fallback also failed:', fallbackError);
                }
            }
            
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
            keyLevels: this.extractKeyLevels(analysis),
            signals: this.extractSignals(analysis)
        };

        let bullCount = 0;
        let bearCount = 0;
        let totalConfidence = 0;

        for (const [tf, data] of Object.entries(analysis)) {
            const signal = data.signal;
            summary.timeframes[tf] = {
                bias: data.structure.trend,
                confidence: signal.confidence,
                signal: signal.direction,
                volume: data.volume.buyingPressure ? 'BULLISH' : 'BEARISH',
                rrr: signal.riskReward
            };

            if (data.structure.trend === 'BULLISH') bullCount++;
            else if (data.structure.trend === 'BEARISH') bearCount++;

            totalConfidence += signal.confidence;
        }

        if (bullCount > bearCount) summary.overallBias = 'BULLISH';
        else if (bearCount > bullCount) summary.overallBias = 'BEARISH';

        summary.strength = Math.abs(bullCount - bearCount) / Object.keys(analysis).length;
        summary.avgConfidence = Math.round(totalConfidence / Object.keys(analysis).length);

        return summary;
    }

    extractKeyLevels(analysis) {
        const levels = {
            support: [],
            resistance: [],
            liquidityZones: []
        };

        for (const [tf, data] of Object.entries(analysis)) {
            // Add swing points as key levels
            data.structure.swings.forEach(swing => {
                if (swing.type === 'LOW') {
                    levels.support.push({
                        price: swing.price,
                        timeframe: tf,
                        strength: this.calculateLevelStrength(swing, data.structure.swings),
                        type: 'SWING_LOW'
                    });
                } else {
                    levels.resistance.push({
                        price: swing.price,
                        timeframe: tf,
                        strength: this.calculateLevelStrength(swing, data.structure.swings),
                        type: 'SWING_HIGH'
                    });
                }
            });

            // Add order blocks as liquidity zones
            data.orderBlocks.bullish.forEach(ob => {
                levels.liquidityZones.push({
                    price: ob.low,
                    high: ob.high,
                    type: 'BULLISH_OB',
                    timeframe: tf,
                    strength: ob.strength
                });
            });

            data.orderBlocks.bearish.forEach(ob => {
                levels.liquidityZones.push({
                    price: ob.high,
                    low: ob.low,
                    type: 'BEARISH_OB',
                    timeframe: tf,
                    strength: ob.strength
                });
            });
        }

        // Remove duplicates and sort
        levels.support = this.consolidateLevels(levels.support);
        levels.resistance = this.consolidateLevels(levels.resistance);
        levels.liquidityZones = this.consolidateLiquidityZones(levels.liquidityZones);

        return levels;
    }

    extractSignals(analysis) {
        const signals = {
            bullish: [],
            bearish: []
        };

        for (const [tf, data] of Object.entries(analysis)) {
            if (data.signal.direction === 'LONG' && data.signal.confidence >= 70) {
                signals.bullish.push({
                    timeframe: tf,
                    confidence: data.signal.confidence,
                    reason: this.getSignalReason(data),
                    entry: data.signal.entry,
                    stopLoss: data.signal.stopLoss,
                    takeProfit: data.signal.takeProfit
                });
            } else if (data.signal.direction === 'SHORT' && data.signal.confidence >= 70) {
                signals.bearish.push({
                    timeframe: tf,
                    confidence: data.signal.confidence,
                    reason: this.getSignalReason(data),
                    entry: data.signal.entry,
                    stopLoss: data.signal.stopLoss,
                    takeProfit: data.signal.takeProfit
                });
            }
        }

        return signals;
    }

    getSignalReason(analysis) {
        const reasons = [];
        
        if (analysis.structure.trend === 'BULLISH') reasons.push('Bullish Structure');
        if (analysis.structure.trend === 'BEARISH') reasons.push('Bearish Structure');
        if (analysis.orderBlocks.bullish.length > 0) reasons.push('Bullish OB');
        if (analysis.orderBlocks.bearish.length > 0) reasons.push('Bearish OB');
        if (analysis.fvgs.bullish.length > 0) reasons.push('Bullish FVG');
        if (analysis.fvgs.bearish.length > 0) reasons.push('Bearish FVG');
        if (analysis.volume.buyingPressure) reasons.push('Buying Volume');
        if (!analysis.volume.buyingPressure) reasons.push('Selling Volume');
        
        return reasons.join(', ');
    }

    calculateLevelStrength(swing, allSwings) {
        const similarSwings = allSwings.filter(s => 
            Math.abs(s.price - swing.price) / swing.price < 0.002
        );
        
        let strength = similarSwings.length;
        
        // Tăng strength nếu level này được nhiều timeframe confirm
        if (strength > 1) strength += 2;
        
        return Math.min(strength, 10);
    }

    consolidateLevels(levels) {
        const consolidated = [];
        const tolerance = 0.002;

        levels.sort((a, b) => a.price - b.price);

        for (const level of levels) {
            const existing = consolidated.find(l => 
                Math.abs(l.price - level.price) / level.price < tolerance
            );

            if (existing) {
                existing.strength += level.strength;
                existing.timeframes.push(level.timeframe);
                if (!existing.types) existing.types = new Set();
                existing.types.add(level.type);
            } else {
                consolidated.push({
                    price: level.price,
                    strength: level.strength,
                    timeframes: [level.timeframe],
                    types: new Set([level.type])
                });
            }
        }

        return consolidated
            .map(level => ({
                ...level,
                types: Array.from(level.types)
            }))
            .sort((a, b) => b.strength - a.strength)
            .slice(0, 5);
    }

    consolidateLiquidityZones(zones) {
        const consolidated = [];
        const tolerance = 0.003;

        zones.sort((a, b) => a.price - b.price);

        for (const zone of zones) {
            const existing = consolidated.find(z => 
                Math.abs(z.price - zone.price) / zone.price < tolerance
            );

            if (existing) {
                existing.strength += zone.strength;
                existing.timeframes.push(zone.timeframe);
            } else {
                consolidated.push({
                    ...zone,
                    timeframes: [zone.timeframe]
                });
            }
        }

        return consolidated
            .sort((a, b) => b.strength - a.strength)
            .slice(0, 3);
    }

    // Utility function
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Global functions for main application
async function performComprehensiveAnalysis(symbol) {
    const analyzer = new MultiTimeframeAnalyzer();
    
    try {
        DOM.status.textContent = '🎯 Starting comprehensive analysis...';
        const analysis = await analyzer.analyzeSymbol(symbol);
        
        // Combine với AI prediction nếu enabled
        const useAI = DOM.useAI?.checked || false;
        const aiWeight = useAI ? 0.3 : 0;
        const baseConfidence = analysis.consensus.confidence;
        const aiContribution = useAI ? (analysis.aiPrediction * 100) * aiWeight : 0;
        
        const finalConfidence = baseConfidence * (1 - aiWeight) + aiContribution;

        // Generate final signal với improved logic
        const bestTimeframe = this.getBestTimeframe(analysis.analyses);
        const bestAnalysis = analysis.analyses[bestTimeframe];
        
        const finalSignal = {
            direction: analysis.consensus.direction,
            confidence: Math.round(finalConfidence),
            entry: bestAnalysis?.signal.entry || 0,
            stopLoss: bestAnalysis?.signal.stopLoss || 0,
            takeProfit: bestAnalysis?.signal.takeProfit || 0,
            riskReward: bestAnalysis?.signal.riskReward || '0',
            timeframe: bestTimeframe,
            volumeConfirmation: analysis.consensus.volumeConfirmation,
            structureStrength: analysis.consensus.structureStrength
        };

        // Calculate confidence breakdown
        const confidenceBreakdown = {
            structure: analysis.consensus.structureStrength,
            volume: analysis.consensus.volumeConfirmation,
            ai: useAI ? Math.round(analysis.aiPrediction * 100) : 0,
            confluence: Math.round(analysis.consensus.confidence)
        };

        return {
            symbol,
            signal: finalSignal,
            aiPrediction: analysis.aiPrediction,
            confidenceBreakdown,
            multiTimeframe: analysis.analyses,
            summary: analyzer.getAnalysisSummary(symbol),
            timestamp: analysis.timestamp,
            successfulTimeframes: analysis.successfulTimeframes
        };
        
    } catch (error) {
        console.error('Comprehensive analysis failed:', error);
        throw error;
    }
}

function getBestTimeframe(analyses) {
    // Tìm timeframe có confidence cao nhất
    let bestTF = '1h'; // default
    let highestConfidence = 0;
    
    for (const [tf, analysis] of Object.entries(analyses)) {
        if (analysis.signal.confidence > highestConfidence) {
            highestConfidence = analysis.signal.confidence;
            bestTF = tf;
        }
    }
    
    return bestTF;
}

async function runBacktest(symbol) {
    DOM.status.textContent = '📊 Running backtest...';
    try {
        const results = await backtestEngine.runBacktest(symbol, '1h', 30);
        DOM.status.textContent = '✅ Backtest completed';
        return results;
    } catch (error) {
        console.error('Backtest failed:', error);
        throw error;
    }
}

async function trainAIModel(symbol) {
    DOM.status.textContent = '🤖 Training AI model...';
    try {
        const candles = await fetchCandles(symbol, '1h', 1000);
        if (!candles || candles.length < 100) {
            throw new Error('Insufficient data for AI training');
        }
        const history = await aiModel.train(candles, 30);
        DOM.status.textContent = '✅ AI model trained successfully';
        return history;
    } catch (error) {
        console.error('AI training failed:', error);
        throw error;
    }
}

async function initializeAIModel() {
    try {
        await aiModel.loadModel();
        console.log('🧠 AI Model initialized');
    } catch (error) {
        console.log('🤖 Creating new AI model');
        await aiModel.createModel();
    }
}

// Helper function với proxy support
async function fetchCandles(symbol, interval, limit) {
    try {
        let url;
        
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        } else {
            url = `/api/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        return data.map(candle => ({
            t: parseInt(candle[0]),
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            vol: parseFloat(candle[5])
        }));
        
    } catch (error) {
        console.error(`Error fetching candles for ${symbol}:`, error);
        
        // Fallback to direct API
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            try {
                const fallbackUrl = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
                const fallbackResponse = await fetch(fallbackUrl);
                const fallbackData = await fallbackResponse.json();
                
                return fallbackData.map(candle => ({
                    t: parseInt(candle[0]),
                    open: parseFloat(candle[1]),
                    high: parseFloat(candle[2]),
                    low: parseFloat(candle[3]),
                    close: parseFloat(candle[4]),
                    vol: parseFloat(candle[5])
                }));
            } catch (fallbackError) {
                console.error('Fallback also failed:', fallbackError);
            }
        }
        
        return null;
    }
}

// Export multi-timeframe analyzer
const multiTimeframeAnalyzer = new MultiTimeframeAnalyzer();
