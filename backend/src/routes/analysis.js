const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');
const { getMany, getOne } = require('../utils/database');

/**
 * Calculate technical indicators
 */
const calculateSMA = (data, period) => {
  if (data.length < period) return [];
  
  const sma = [];
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val.close, 0);
    sma.push(sum / period);
  }
  return sma;
};

const calculateEMA = (data, period) => {
  if (data.length === 0) return [];
  
  const k = 2 / (period + 1);
  const ema = [data[0].close];
  
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i].close * k + ema[i - 1] * (1 - k));
  }
  return ema;
};

const calculateRSI = (data, period = 14) => {
  if (data.length < period + 1) return [];
  
  const rsi = [];
  const changes = [];
  
  for (let i = 1; i < data.length; i++) {
    changes.push(data[i].close - data[i - 1].close);
  }
  
  let gains = 0, losses = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) gains += changes[i];
    else losses += Math.abs(changes[i]);
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  let rs = avgGain / avgLoss;
  rsi.push(100 - (100 / (1 + rs)));
  
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
    rs = avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));
  }
  
  return rsi;
};

const calculateMACD = (data, fast = 12, slow = 26, signal = 9) => {
  const emaFast = calculateEMA(data, fast);
  const emaSlow = calculateEMA(data, slow);
  
  const macd = [];
  const startIndex = Math.max(fast, slow);
  
  for (let i = startIndex - 1; i < data.length; i++) {
    macd.push(emaFast[i - (fast - 1)] - emaSlow[i - (slow - 1)]);
  }
  
  const signalLine = calculateEMA(macd.map(m => ({ close: m })), signal);
  
  return {
    macd,
    signal: signalLine,
    histogram: macd.map((m, i) => m - (signalLine[i] || 0))
  };
};

/**
 * Get technical analysis for a stock
 */
router.get('/technical/:symbol', async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const { period = '20', limit = 100 } = req.query;

    logger.info(`Calculating technical indicators for ${symbol}`);

    // Get historical data
    const data = await getMany(
      `SELECT * FROM stock_prices WHERE symbol = $1 ORDER BY date DESC LIMIT $2`,
      [symbol.toUpperCase(), parseInt(limit)]
    );

    if (data.length === 0) {
      return res.status(404).json({ error: `No data found for ${symbol}` });
    }

    // Reverse to chronological order
    data.reverse();

    const p = parseInt(period);

    // Calculate indicators
    const sma = calculateSMA(data, p);
    const ema = calculateEMA(data, p);
    const rsi = calculateRSI(data, 14);
    const macd = calculateMACD(data);

    // Get latest prices
    const lastPrice = data[data.length - 1].close;
    const lastSMA = sma[sma.length - 1];
    const lastEMA = ema[ema.length - 1];
    const lastRSI = rsi[rsi.length - 1];

    // Determine signals
    let smaSignal = 'neutral';
    if (lastPrice > lastSMA) smaSignal = 'bullish';
    else if (lastPrice < lastSMA) smaSignal = 'bearish';

    let rsiSignal = 'neutral';
    if (lastRSI > 70) rsiSignal = 'overbought';
    else if (lastRSI < 30) rsiSignal = 'oversold';

    res.json({
      symbol: symbol.toUpperCase(),
      period: p,
      data_points: data.length,
      latest: {
        price: lastPrice,
        date: data[data.length - 1].date
      },
      indicators: {
        sma: {
          value: lastSMA,
          period: p,
          signal: smaSignal
        },
        ema: {
          value: lastEMA,
          period: p,
          signal: smaSignal
        },
        rsi: {
          value: lastRSI,
          period: 14,
          signal: rsiSignal
        },
        macd: {
          macd: macd.macd[macd.macd.length - 1],
          signal: macd.signal[macd.signal.length - 1],
          histogram: macd.histogram[macd.histogram.length - 1],
          trend: macd.macd[macd.macd.length - 1] > macd.signal[macd.signal.length - 1] ? 'bullish' : 'bearish'
        }
      },
      all_data: {
        dates: data.map(d => d.date),
        closes: data.map(d => d.close),
        sma,
        ema,
        rsi: rsi.slice(-data.length),
        macd: macd.macd,
        macd_signal: macd.signal,
        macd_histogram: macd.histogram
      }
    });
  } catch (error) {
    logger.error(`Error calculating technical indicators: ${error.message}`);
    next(error);
  }
});

/**
 * Analyze portfolio risk
 */
router.get('/risk', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get portfolio
    const portfolio = await getOne(
      'SELECT * FROM portfolios WHERE user_id = $1',
      [userId]
    );

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // Get holdings
    const holdings = await getMany(
      'SELECT * FROM holdings WHERE portfolio_id = $1',
      [portfolio.id]
    );

    // Get trades
    const trades = await getMany(
      'SELECT * FROM trades WHERE portfolio_id = $1 ORDER BY created_at ASC',
      [portfolio.id]
    );

    if (trades.length === 0) {
      return res.json({
        portfolio_risk: {
          score: 'N/A',
          value_at_risk: 0,
          max_drawdown: 0,
          sharpe_ratio: 0
        },
        correlation: 0,
        diversification: {
          score: 0,
          sectors: {}
        },
        recommendations: ['Start trading to analyze risk']
      });
    }

    // Calculate portfolio values over time
    let portfolioValues = [];
    let cumulativeCost = parseFloat(process.env.INITIAL_CAPITAL || 100000);

    trades.forEach(trade => {
      const tradeValue = trade.type === 'buy' ? 
                        -(trade.quantity * trade.price) :
                        (trade.quantity * trade.price);
      cumulativeCost += tradeValue;
      portfolioValues.push(cumulativeCost);
    });

    // Calculate metrics
    const initialValue = parseFloat(process.env.INITIAL_CAPITAL || 100000);
    const currentValue = cumulativeCost;
    const maxValue = Math.max(...portfolioValues);
    const minValue = Math.min(...portfolioValues);
    
    const maxDrawdown = (maxValue - minValue) / maxValue;
    const returnPercent = ((currentValue - initialValue) / initialValue) * 100;

    // Simple risk assessment
    let riskScore = 'low';
    if (Math.abs(maxDrawdown) > 0.2) riskScore = 'high';
    else if (Math.abs(maxDrawdown) > 0.1) riskScore = 'medium';

    // Diversification score (0-1)
    const diversificationScore = Math.min(holdings.length / 10, 1);

    res.json({
      portfolio_risk: {
        score: riskScore,
        value_at_risk: Math.abs(minValue - initialValue),
        max_drawdown: maxDrawdown,
        sharpe_ratio: returnPercent / (Math.abs(maxDrawdown) * 100 + 1)
      },
      correlation: 0.5, // Simplified
      diversification: {
        score: diversificationScore,
        holdings: holdings.length,
        recommendations: [
          holdings.length < 5 ? 'Consider diversifying into more holdings' : 'Good diversification',
          Math.abs(maxDrawdown) > 0.2 ? 'High drawdown risk - consider risk reduction' : 'Acceptable drawdown risk'
        ]
      },
      performance: {
        total_return_percent: returnPercent,
        current_value: currentValue,
        initial_value: initialValue,
        max_value: maxValue,
        min_value: minValue
      }
    });
  } catch (error) {
    logger.error(`Error analyzing risk: ${error.message}`);
    next(error);
  }
});

/**
 * Get sentiment analysis (mock)
 */
router.get('/sentiment/:symbol', async (req, res, next) => {
  try {
    const { symbol } = req.params;

    // Mock sentiment data
    const sentimentScore = Math.random();
    const sentiment = sentimentScore > 0.6 ? 'positive' : sentimentScore < 0.4 ? 'negative' : 'neutral';

    res.json({
      symbol: symbol.toUpperCase(),
      overall: {
        score: sentimentScore,
        sentiment
      },
      sources: {
        news: {
          score: Math.random(),
          positive: Math.floor(Math.random() * 100),
          neutral: Math.floor(Math.random() * 100),
          negative: Math.floor(Math.random() * 100)
        },
        social: {
          score: Math.random(),
          positive: Math.floor(Math.random() * 100),
          neutral: Math.floor(Math.random() * 100),
          negative: Math.floor(Math.random() * 100)
        }
      },
      trend: ['increasing', 'decreasing', 'stable'][Math.floor(Math.random() * 3)]
    });
  } catch (error) {
    logger.error(`Error analyzing sentiment: ${error.message}`);
    next(error);
  }
});

module.exports = router;
