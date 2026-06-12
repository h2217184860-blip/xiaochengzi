import React, { useState, useEffect } from 'react';
import { analysisService, stockService } from '../services/api';
import './Analysis.css';

function Analysis() {
  const [symbol, setSymbol] = useState('AAPL');
  const [technicalData, setTechnicalData] = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [sentimentData, setSentimentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('technical');

  useEffect(() => {
    fetchAnalysisData();
  }, [symbol]);

  const fetchAnalysisData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch technical analysis
      const techRes = await analysisService.getTechnical(symbol, 20, 100);
      setTechnicalData(techRes.data);

      // Fetch sentiment analysis
      const sentRes = await analysisService.getSentiment(symbol);
      setSentimentData(sentRes.data);

      // Fetch risk analysis (only once, not symbol-specific)
      if (activeTab === 'risk') {
        const riskRes = await analysisService.getRisk();
        setRiskData(riskRes.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRiskData = async () => {
    try {
      setLoading(true);
      const riskRes = await analysisService.getRisk();
      setRiskData(riskRes.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="analysis">
      <h2>🔬 Data Analysis</h2>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Symbol Input */}
      <div className="card search-card">
        <h3>🔍 Analyze Stock</h3>
        <div className="search-input">
          <input
            type="text"
            placeholder="Enter stock symbol (e.g., AAPL, GOOGL, MSFT)"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          />
          <button onClick={fetchAnalysisData} className="btn btn-primary" disabled={loading}>
            {loading ? '⏳' : '🔍'} Analyze
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <button
          className={`tab ${activeTab === 'technical' ? 'active' : ''}`}
          onClick={() => setActiveTab('technical')}
        >
          📈 Technical
        </button>
        <button
          className={`tab ${activeTab === 'sentiment' ? 'active' : ''}`}
          onClick={() => setActiveTab('sentiment')}
        >
          💭 Sentiment
        </button>
        <button
          className={`tab ${activeTab === 'risk' ? 'active' : ''}`}
          onClick={() => { setActiveTab('risk'); fetchRiskData(); }}
        >
          ⚠️ Risk
        </button>
      </div>

      {/* Technical Analysis Tab */}
      {activeTab === 'technical' && technicalData && (
        <div className="analysis-content">
          <div className="card">
            <h3>📊 Technical Indicators - {technicalData.symbol}</h3>
            
            <div className="indicators-grid">
              {/* Current Price */}
              <div className="indicator-card">
                <h4>Current Price</h4>
                <div className="indicator-value">${technicalData.latest?.price.toFixed(2)}</div>
                <div className="indicator-label">
                  {new Date(technicalData.latest?.date).toLocaleDateString()}
                </div>
              </div>

              {/* SMA */}
              <div className="indicator-card">
                <h4>SMA ({technicalData.indicators.sma.period})</h4>
                <div className={`indicator-value ${technicalData.indicators.sma.signal}`}>
                  ${technicalData.indicators.sma.value.toFixed(2)}
                </div>
                <div className={`indicator-label ${technicalData.indicators.sma.signal}`}>
                  {technicalData.indicators.sma.signal === 'bullish' ? '📈 Bullish' : '📉 Bearish'}
                </div>
              </div>

              {/* EMA */}
              <div className="indicator-card">
                <h4>EMA ({technicalData.indicators.ema.period})</h4>
                <div className={`indicator-value ${technicalData.indicators.ema.signal}`}>
                  ${technicalData.indicators.ema.value.toFixed(2)}
                </div>
                <div className={`indicator-label ${technicalData.indicators.ema.signal}`}>
                  {technicalData.indicators.ema.signal === 'bullish' ? '📈 Bullish' : '📉 Bearish'}
                </div>
              </div>

              {/* RSI */}
              <div className="indicator-card">
                <h4>RSI (14)</h4>
                <div className={`indicator-value ${technicalData.indicators.rsi.signal}`}>
                  {technicalData.indicators.rsi.value.toFixed(2)}
                </div>
                <div className={`indicator-label ${technicalData.indicators.rsi.signal}`}>
                  {technicalData.indicators.rsi.signal === 'overbought' ? '⚠️ Overbought' : 
                   technicalData.indicators.rsi.signal === 'oversold' ? '✅ Oversold' : '➡️ Neutral'}
                </div>
              </div>

              {/* MACD */}
              <div className="indicator-card">
                <h4>MACD</h4>
                <div className={`indicator-value ${technicalData.indicators.macd.trend}`}>
                  {technicalData.indicators.macd.macd.toFixed(2)}
                </div>
                <div className={`indicator-label ${technicalData.indicators.macd.trend}`}>
                  {technicalData.indicators.macd.trend === 'bullish' ? '📈 Bullish' : '📉 Bearish'}
                </div>
              </div>

              {/* Summary */}
              <div className="indicator-card">
                <h4>Data Points</h4>
                <div className="indicator-value">{technicalData.data_points}</div>
                <div className="indicator-label">Latest {technicalData.data_points} days</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sentiment Analysis Tab */}
      {activeTab === 'sentiment' && sentimentData && (
        <div className="analysis-content">
          <div className="card">
            <h3>💭 Sentiment Analysis - {sentimentData.symbol}</h3>
            
            <div className="sentiment-grid">
              {/* Overall Sentiment */}
              <div className="sentiment-card">
                <h4>Overall Sentiment</h4>
                <div className={`sentiment-score ${sentimentData.overall.sentiment}`}>
                  {sentimentData.overall.sentiment === 'positive' ? '📈' : 
                   sentimentData.overall.sentiment === 'negative' ? '📉' : '➡️'} 
                  {' '}{sentimentData.overall.sentiment.toUpperCase()}
                </div>
                <div className="sentiment-score-value">
                  Score: {(sentimentData.overall.score * 100).toFixed(1)}%
                </div>
              </div>

              {/* News Sentiment */}
              <div className="sentiment-card">
                <h4>📰 News Sentiment</h4>
                <div className="sentiment-breakdown">
                  <div className="sentiment-item positive">
                    <span>Positive: {sentimentData.sources.news.positive}%</span>
                  </div>
                  <div className="sentiment-item neutral">
                    <span>Neutral: {sentimentData.sources.news.neutral}%</span>
                  </div>
                  <div className="sentiment-item negative">
                    <span>Negative: {sentimentData.sources.news.negative}%</span>
                  </div>
                </div>
              </div>

              {/* Social Sentiment */}
              <div className="sentiment-card">
                <h4>📱 Social Sentiment</h4>
                <div className="sentiment-breakdown">
                  <div className="sentiment-item positive">
                    <span>Positive: {sentimentData.sources.social.positive}%</span>
                  </div>
                  <div className="sentiment-item neutral">
                    <span>Neutral: {sentimentData.sources.social.neutral}%</span>
                  </div>
                  <div className="sentiment-item negative">
                    <span>Negative: {sentimentData.sources.social.negative}%</span>
                  </div>
                </div>
              </div>

              {/* Trend */}
              <div className="sentiment-card">
                <h4>📊 Trend</h4>
                <div className={`trend-indicator ${sentimentData.trend}`}>
                  {sentimentData.trend === 'increasing' ? '📈' : 
                   sentimentData.trend === 'decreasing' ? '📉' : '➡️'} {sentimentData.trend.toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Risk Analysis Tab */}
      {activeTab === 'risk' && riskData && (
        <div className="analysis-content">
          <div className="card">
            <h3>⚠️ Portfolio Risk Analysis</h3>
            
            <div className="risk-grid">
              <div className="risk-item">
                <h4>Risk Score</h4>
                <div className={`risk-value ${riskData.portfolio_risk.score?.toLowerCase()}`}>
                  {riskData.portfolio_risk.score}
                </div>
              </div>

              <div className="risk-item">
                <h4>Max Drawdown</h4>
                <div className="risk-value">
                  {(riskData.portfolio_risk.max_drawdown * 100).toFixed(2)}%
                </div>
              </div>

              <div className="risk-item">
                <h4>Value at Risk</h4>
                <div className="risk-value">
                  ${riskData.portfolio_risk.value_at_risk.toFixed(2)}
                </div>
              </div>

              <div className="risk-item">
                <h4>Sharpe Ratio</h4>
                <div className="risk-value">
                  {riskData.portfolio_risk.sharpe_ratio.toFixed(2)}
                </div>
              </div>

              <div className="risk-item">
                <h4>Diversification</h4>
                <div className="risk-value">
                  {(riskData.diversification.score * 100).toFixed(1)}%
                </div>
              </div>

              <div className="risk-item">
                <h4>Holdings</h4>
                <div className="risk-value">
                  {riskData.diversification.holdings}
                </div>
              </div>
            </div>

            {riskData.diversification.recommendations && (
              <div className="recommendations">
                <h4>💡 Recommendations</h4>
                <ul>
                  {riskData.diversification.recommendations.map((rec, idx) => (
                    <li key={idx}>• {rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Analysis;
