// aiModel.js - Neural Network AI for Price Prediction

class AIModel {
    constructor() {
        this.model = null;
        this.isTrained = false;
        this.trainingHistory = null;
    }

    async createModel() {
        this.model = tf.sequential({
            layers: [
                tf.layers.dense({ units: 64, activation: 'relu', inputShape: [20] }),
                tf.layers.dropout({ rate: 0.2 }),
                tf.layers.dense({ units: 32, activation: 'relu' }),
                tf.layers.dropout({ rate: 0.2 }),
                tf.layers.dense({ units: 16, activation: 'relu' }),
                tf.layers.dense({ units: 1, activation: 'sigmoid' })
            ]
        });

        this.model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'binaryCrossentropy',
            metrics: ['accuracy']
        });

        console.log('AI Model created successfully');
    }

    prepareTrainingData(candles) {
        const features = [];
        const labels = [];

        // Use last 1000 candles for training
        const trainingData = candles.slice(-1000);

        for (let i = 20; i < trainingData.length - 5; i++) {
            // Feature: 20 previous candles normalized data
            const featureSet = [];
            for (let j = i - 20; j < i; j++) {
                const candle = trainingData[j];
                featureSet.push(
                    (candle.close - candle.open) / candle.open, // Price change %
                    (candle.high - candle.low) / candle.low,    // Volatility %
                    candle.vol / 1000000,                       // Volume normalized
                    candle.close > candle.open ? 1 : 0          // Bullish/Bearish
                );
            }

            // Label: Price increased in next 5 candles? (1 = yes, 0 = no)
            const currentPrice = trainingData[i].close;
            const futurePrice = trainingData[i + 5].close;
            const label = futurePrice > currentPrice ? 1 : 0;

            features.push(featureSet);
            labels.push(label);
        }

        return {
            features: tf.tensor2d(features),
            labels: tf.tensor1d(labels)
        };
    }

    async train(candles, epochs = 50) {
        if (!this.model) {
            await this.createModel();
        }

        const { features, labels } = this.prepareTrainingData(candles);

        this.trainingHistory = await this.model.fit(features, labels, {
            epochs: epochs,
            batchSize: 32,
            validationSplit: 0.2,
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    console.log(`Epoch ${epoch + 1}: Loss = ${logs.loss.toFixed(4)}, Accuracy = ${logs.acc.toFixed(4)}`);
                    // Update UI if needed
                    if (typeof updateTrainingProgress === 'function') {
                        updateTrainingProgress(epoch + 1, epochs, logs.acc);
                    }
                }
            }
        });

        this.isTrained = true;
        
        // Cleanup tensors
        features.dispose();
        labels.dispose();

        console.log('AI Model training completed');
        return this.trainingHistory;
    }

    predict(candles) {
        if (!this.model || !this.isTrained) {
            console.warn('AI Model not trained yet');
            return 0.5; // Neutral prediction
        }

        // Prepare latest 20 candles for prediction
        const recentCandles = candles.slice(-20);
        const featureSet = [];

        for (let j = 0; j < recentCandles.length; j++) {
            const candle = recentCandles[j];
            featureSet.push(
                (candle.close - candle.open) / candle.open,
                (candle.high - candle.low) / candle.low,
                candle.vol / 1000000,
                candle.close > candle.open ? 1 : 0
            );
        }

        const features = tf.tensor2d([featureSet]);
        const prediction = this.model.predict(features);
        const result = prediction.dataSync()[0];
        
        // Cleanup
        features.dispose();
        prediction.dispose();

        return result;
    }

    async saveModel() {
        if (this.model) {
            await this.model.save('indexeddb://quantum-ai-model');
            console.log('AI Model saved locally');
        }
    }

    async loadModel() {
        try {
            this.model = await tf.loadLayersModel('indexeddb://quantum-ai-model');
            this.isTrained = true;
            console.log('AI Model loaded from local storage');
        } catch (error) {
            console.log('No saved model found, creating new one');
            await this.createModel();
        }
    }

    getModelSummary() {
        if (this.model) {
            this.model.summary();
        }
    }
}

// Initialize AI Model
const aiModel = new AIModel();

// Training progress update function
function updateTrainingProgress(epoch, totalEpochs, accuracy) {
    const progress = (epoch / totalEpochs) * 100;
    console.log(`Training: ${progress.toFixed(1)}% - Accuracy: ${(accuracy * 100).toFixed(1)}%`);
    
    // Update UI if DOM elements exist
    const statusElement = document.getElementById('status');
    if (statusElement) {
        statusElement.textContent = `🤖 Training AI: ${progress.toFixed(1)}% (Accuracy: ${(accuracy * 100).toFixed(1)}%)`;
    }
}
