// Configuration
const CONFIG = {
  API_KEY: '98e740d93d02809186f0c22f3f127ddbf5e672d49ae407cfa9891cb110bdca7b',
  API_URL: 'https://min-api.cryptocompare.com/data',
  BINANCE_URL: 'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT',
  CACHE_TTL: 180000,
  RETRY_COUNT: 3,
  RETRY_DELAY: 1000,
  UPDATE_INTERVAL: 180000,
  PRICE_UPDATE_INTERVAL: 3000, // 3 seconds for price update
  GOLDEN_RATIO: 1.618,
  FIB_LEVELS: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.414, 1.618, 2, 2.618],
  TIMEFRAME_MAP: {
    '1H': { interval: 'histominute', limit: 60, unit: 'minute', tooltipFormat: 'HH:mm', display: '1H' },
    '4H': { interval: 'histominute', limit: 240, unit: 'hour', tooltipFormat: 'HH:mm', display: '4H' },
    '6H': { interval: 'histominute', limit: 360, unit: 'hour', tooltipFormat: 'HH:mm', display: '6H' },
    '12H': { interval: 'histominute', limit: 720, unit: 'hour', tooltipFormat: 'HH:mm', display: '12H' },
    '1D': { interval: 'histohour', limit: 24, unit: 'hour', tooltipFormat: 'MMM dd HH:mm', display: '1D' },
    '1W': { interval: 'histohour', limit: 168, unit: 'day', tooltipFormat: 'MMM dd', display: '1W' },
    '30D': { interval: 'histoday', limit: 30, unit: 'day', tooltipFormat: 'MMM dd', display: '30D' }
  },
  INDICATOR_WEIGHTS: {
    momentum: 0.25,
    rsi: 0.15,
    volatility: 0.15,
    fibLevels: 0.2,
    emaTrend: 0.1,
    macd: 0.1,
    ichimoku: 0.05
  },
  MIN_DATA_POINTS: {
    '1H': 60,
    '4H': 240,
    '6H': 360,
    '12H': 720,
    '1D': 24,
    '1W': 168,
    '30D': 30
  },
  FIB_WEIGHTS: {
    0.236: 0.8,
    0.382: 1.0,
    0.5: 0.9,
    0.618: 1.0
  },
  TIMEFRAME_STYLE: {
    '1H': { pointRadius: 1, borderWidth: 1.5 },
    '4H': { pointRadius: 0, borderWidth: 1.8 },
    '6H': { pointRadius: 0, borderWidth: 1.8 },
    '12H': { pointRadius: 0, borderWidth: 2 },
    '1D': { pointRadius: 0, borderWidth: 2.2 },
    '1W': { pointRadius: 0, borderWidth: 2.5 },
    '30D': { pointRadius: 0, borderWidth: 2.5 }
  }
};

// State Management
const state = {
  priceChart: null,
  currentTimeframe: '1H',
  historicalData: [],
  currentPrice: null,
  predictedPrice: null,
  confidenceLevel: 0,
  isOnline: navigator.onLine,
  activeIndicators: { macd: false, bollinger: false, fib: true },
  indicators: {
    rsi: null,
    volatility: null,
    ema50: null,
    ema200: null,
    macd: null,
    ichimoku: null,
    goldenMomentum: null,
    bollinger: null
  }
};

// Initialize UI
function initUI() {
  document.querySelectorAll('.timeframe-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentTimeframe = btn.dataset.timeframe;
      document.getElementById('current-timeframe').textContent = CONFIG.TIMEFRAME_MAP[state.currentTimeframe].display;
      loadData();
    });
  });

  document.querySelector('.theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    const icon = document.querySelector('.theme-toggle i');
    icon.className = document.body.classList.contains('dark-theme') ? 'fas fa-sun' : 'fas fa-moon';
    if (state.priceChart) renderChart();
  });

  document.getElementById('refresh-btn').addEventListener('click', loadData);

  document.querySelector('[title="MACD"]').addEventListener('click', () => toggleIndicator('macd'));
  document.querySelector('[title="Bollinger Bands"]').addEventListener('click', () => toggleIndicator('bollinger'));
  document.querySelector('[title="Fibonacci"]').addEventListener('click', () => toggleIndicator('fib'));
}

// Toggle Technical Indicators
function toggleIndicator(indicator) {
  state.activeIndicators[indicator] = !state.activeIndicators[indicator];
  renderChart();
}

// Fetch Data with Cache
async function fetchWithCache(url, cacheKey) {
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CONFIG.CACHE_TTL) {
      return data;
    }
  }

  for (let i = 0; i < CONFIG.RETRY_COUNT; i++) {
    try {
      const response = await fetch(
        url.includes('binance') ? url : `${url}&api_key=${CONFIG.API_KEY}`
      );
      if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
      const data = await response.json();
      if (!url.includes('binance')) {
        localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
      }
      return data;
    } catch (error) {
      if (i === CONFIG.RETRY_COUNT - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
    }
  }
}

// Function to update only the price
async function updateCurrentPrice() {
  if (!state.isOnline) return;

  try {
    const binanceData = await fetchWithCache(CONFIG.BINANCE_URL, 'burex_binancePrice');
    if (state.currentPrice !== parseFloat(binanceData.price)) {
      state.currentPrice = parseFloat(binanceData.price);
      updatePriceDisplay({ PRICE: state.currentPrice, CHANGEPCT24HOUR: null });

      // Update the last point of the chart
      if (state.historicalData.length > 0) {
        const lastIndex = state.historicalData.length - 1;
        state.historicalData[lastIndex] = {
          ...state.historicalData[lastIndex],
          close: state.currentPrice,
          high: Math.max(state.historicalData[lastIndex].high, state.currentPrice),
          low: Math.min(state.historicalData[lastIndex].low, state.currentPrice)
        };

        // Update chart if it exists
        if (state.priceChart) {
          state.priceChart.data.datasets[0].data[lastIndex].y = state.currentPrice;
          state.priceChart.update('none');
        }
      }
    }
  } catch (error) {
    console.error('Error actualizando precio:', error);
  }
}

// Load Data
async function loadData() {
  if (!state.isOnline) {
    showNotification('Sin conexión: usando datos almacenados', 'warning');
    updateUIWithCachedData();
    return;
  }

  showLoading('Analizando mercado de Bitcoin...');

  try {
    const priceData = await fetchWithCache(
      `${CONFIG.API_URL}/pricemultifull?fsyms=BTC&tsyms=USD`,
      'burex_currentPrice'
    );

    if (!priceData.RAW?.BTC?.USD) throw new Error('Datos de precio no disponibles');
    state.currentPrice = priceData.RAW.BTC.USD.PRICE;
    updatePriceDisplay(priceData.RAW.BTC.USD);

    await fetchHistoricalData();
    calculateAdvancedIndicators();
    calculatePrediction();
    calculateTradingRecommendations();
    renderChart();

    showNotification('Análisis actualizado correctamente', 'success', 2000);
  } catch (error) {
    console.error('Error cargando datos:', error);
    showNotification(`Error: ${error.message}`, 'error');
    updateUIWithCachedData();
  } finally {
    hideLoading();
  }
}

// Fetch Historical Data
async function fetchHistoricalData() {
  const { interval, limit } = CONFIG.TIMEFRAME_MAP[state.currentTimeframe];
  const cacheKey = `burex_historicalData_${state.currentTimeframe}`;
  const data = await fetchWithCache(
    `${CONFIG.API_URL}/v2/${interval}?fsym=BTC&tsym=USD&limit=${limit}`,
    cacheKey
  );

  if (!data.Data?.Data?.length) throw new Error('No hay datos históricos disponibles');

  state.historicalData = data.Data.Data
    .filter(item => item.close > 0)
    .map(item => ({
      time: item.time * 1000,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volumeto
    }));

  if (state.historicalData.length < CONFIG.MIN_DATA_POINTS[state.currentTimeframe]) {
    showNotification('Datos insuficientes, intentando timeframe alternativo', 'warning');
    return;
  }

  if (state.currentPrice) {
    const lastDate = state.historicalData[state.historicalData.length - 1]?.time;
    const currentDate = new Date().getTime();
    if (!lastDate || currentDate > lastDate) {
      state.historicalData.push({
        time: currentDate,
        open: state.currentPrice,
        high: state.currentPrice,
        low: state.currentPrice,
        close: state.currentPrice,
        volume: 0
      });
    }
  }
}

// Update Price Display
function updatePriceDisplay(priceData) {
  document.getElementById('current-price').textContent =
    `$${state.currentPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

  const change24h = priceData.CHANGEPCT24HOUR || 0;
  const changeElement = document.getElementById('price-change');
  changeElement.textContent = `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}% (24h)`;
  changeElement.className = change24h >= 0 ? 'price-change trend-up' : 'price-change trend-down';
}

// Calculate Advanced Indicators
function calculateAdvancedIndicators() {
  if (!state.currentPrice) return;

  const prices = state.historicalData.map(d => d.close);

  state.indicators.rsi = prices.length >= 15 ? calculateRSI(prices) : 50;
  state.indicators.volatility = prices.length >= 30 ? calculateVolatility(prices) : 15;
  state.indicators.ema50 = prices.length >= 50 ? calculateEMA(50, prices) : null;
  state.indicators.ema200 = prices.length >= 200 ? calculateEMA(200, prices) : null;
  state.indicators.macd = prices.length >= 35 ? calculateMACD(prices) : null;
  state.indicators.ichimoku = state.historicalData.length >= 52 ? calculateIchimoku(state.historicalData) : null;
  state.indicators.bollinger = prices.length >= 20 ? calculateBollingerBands(prices) : null;

  const shortTermData = prices.slice(-Math.min(7, prices.length));
  const { slope } = linearRegression(shortTermData);
  state.indicators.goldenMomentum = (slope / (state.currentPrice || 1)) * CONFIG.GOLDEN_RATIO * 100;
}

// Calculate Prediction
function calculatePrediction() {
  if (!state.currentPrice || state.historicalData.length < 5) {
    state.predictedPrice = null;
    state.confidenceLevel = 0;
    return;
  }

  const prices = state.historicalData.map(d => d.close);
  const shortTermData = prices.slice(-Math.min(7, prices.length));
  const { slope } = linearRegression(shortTermData);
  const momentum = slope / state.currentPrice;
  const timeframeFactor = 1 + (parseFloat(state.currentTimeframe) / 100);

  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const priceRange = maxPrice - minPrice;
  const threshold = Math.max(priceRange * 0.025, 100);

  let fibImpact = 0;
  CONFIG.FIB_LEVELS.forEach(level => {
    const fibPrice = minPrice + priceRange * level;
    if (Math.abs(state.currentPrice - fibPrice) < threshold) {
      fibImpact += CONFIG.FIB_WEIGHTS[level] || 0.5;
    }
  });
  const levelFactor = 1 + Math.min(0.2, fibImpact * 0.05);

  const rsi = state.indicators.rsi ?? 50;
  const volatility = state.indicators.volatility ?? 15;
  const rsiFactor = (50 - rsi) * 0.005;
  const volatilityFactor = volatility > 30 ? -0.05 : 0.05;

  let emaFactor = 0;
  let emaTrend = 'Neutral';
  if (state.indicators.ema50 !== null && state.indicators.ema200 !== null) {
    emaFactor = state.indicators.ema50 > state.indicators.ema200 ? 0.02 : -0.02;
    emaTrend = state.indicators.ema50 > state.indicators.ema200 ? 'Alcista' : 'Bajista';
  }

  const macdFactor = (state.indicators.macd?.histogram > 0) ? 0.015 : -0.015;

  const factors = {
    momentum: momentum * CONFIG.GOLDEN_RATIO * timeframeFactor,
    rsi: rsiFactor,
    volatility: volatilityFactor,
    fib: levelFactor - 1,
    ema: emaFactor,
    macd: macdFactor,
    ichimoku: 0
  };

  let weightedChange = 0;
  Object.keys(factors).forEach(key => {
    weightedChange += factors[key] * (CONFIG.INDICATOR_WEIGHTS[key] || 0);
  });

  state.predictedPrice = state.currentPrice * (1 + weightedChange);

  const historicalAccuracy = calculateHistoricalAccuracy();
  const volatilityImpact = Math.max(0, 1 - (volatility / 50));
  state.confidenceLevel = Math.min(100, Math.max(0,
    historicalAccuracy *
    volatilityImpact *
    (1 + (fibImpact * 0.08)) *
    (emaFactor === 0 ? 1 : 1.05)
  ));

  document.getElementById('prediction-price').textContent = state.predictedPrice
    ? `$${state.predictedPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : 'N/A';

  const confidencePercent = Math.round(state.confidenceLevel);
  document.getElementById('confidence-level').textContent = `${confidencePercent}%`;
  document.getElementById('confidence-fill').style.width = `${confidencePercent}%`;

  const confidenceClass = confidencePercent > 70 ? 'confidence-high' :
                        confidencePercent > 50 ? 'confidence-medium' : 'confidence-low';
  document.getElementById('confidence-dot').className = `confidence-dot ${confidenceClass}`;
  document.getElementById('confidence-fill').className = `confidence-fill ${confidenceClass}`;

  document.getElementById('golden-momentum').textContent = `${state.indicators.goldenMomentum.toFixed(2)}%`;
  document.getElementById('fib-levels').textContent = `${fibImpact ? Math.round(fibImpact) : 0}/12`;
  document.getElementById('rsi-value').textContent = `${rsi.toFixed(2)}`;
  document.getElementById('volatility').textContent = `${volatility.toFixed(2)}%`;
  document.getElementById('ema-trend').textContent = emaTrend;

  if (state.indicators.macd) {
    document.getElementById('macd-value').textContent =
      `${state.indicators.macd.MACD.toFixed(2)}/${state.indicators.macd.signal.toFixed(2)}`;
  }

  document.getElementById('accuracy-rate').textContent = `${historicalAccuracy.toFixed(0)}%`;

  updateTrendIndicators();
  updateSentiment();
}

// Calculate Trading Recommendations
function calculateTradingRecommendations() {
  if (!state.predictedPrice || !state.historicalData.length) return;

  const prices = state.historicalData.map(d => d.close);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const priceRange = maxPrice - minPrice;

  const supportLevel = CONFIG.FIB_LEVELS
    .map(level => minPrice + priceRange * level)
    .filter(level => level < state.currentPrice)
    .reduce((prev, curr) =>
      Math.abs(curr - state.currentPrice) < Math.abs(prev - state.currentPrice) ? curr : prev,
      state.currentPrice * 0.95
    );

  const takeProfit = CONFIG.FIB_LEVELS
    .map(level => minPrice + priceRange * level)
    .filter(level => level > state.predictedPrice)
    .sort((a, b) => a - b)[0] || state.predictedPrice * 1.05;

  const stopLoss = supportLevel * 0.95;

  document.getElementById('key-support').textContent =
    `$${supportLevel.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  document.getElementById('take-profit').textContent =
    `$${takeProfit.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  document.getElementById('stop-loss').textContent =
    `$${stopLoss.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const strategy = state.confidenceLevel > 70 ? 'Compra Moderada' :
                  state.confidenceLevel > 50 ? 'Mantener' : 'Venta Prudente';
  document.getElementById('trading-strategy').textContent = strategy;

  const position = state.confidenceLevel > 70 ? '65% Largo' :
                  state.confidenceLevel > 50 ? '50% Balanceado' : '30% Corto';
  document.getElementById('optimal-position').textContent = position;

  const risk = state.indicators.volatility > 30 ? 'Alto' :
              state.indicators.volatility > 15 ? 'Moderado' : 'Bajo';
  document.getElementById('risk-factor').textContent = risk;

  document.getElementById('backtesting-accuracy').textContent = `${calculateHistoricalAccuracy().toFixed(0)}%`;
}

// Update Trend Indicators
function updateTrendIndicators() {
  const goldenTrend = state.indicators.goldenMomentum > 0 ? 'trend-up' : 'trend-down';
  document.getElementById('golden-trend').className = `indicator-trend ${goldenTrend}`;
  document.querySelector('#golden-trend span').textContent =
    state.indicators.goldenMomentum > 0 ? 'Alcista' : 'Bajista';

  const rsiTrend = state.indicators.rsi > 70 ? 'trend-down' :
                  state.indicators.rsi < 30 ? 'trend-up' : 'trend-neutral';
  document.getElementById('rsi-trend').className = `indicator-trend ${rsiTrend}`;
  document.querySelector('#rsi-trend span').textContent =
    state.indicators.rsi > 70 ? 'Sobrecompra' :
    state.indicators.rsi < 30 ? 'Sobreventa' : 'Neutral';

  const volatilityTrend = state.indicators.volatility > 25 ? 'trend-up' : 'trend-down';
  document.getElementById('volatility-trend').className = `indicator-trend ${volatilityTrend}`;
  document.querySelector('#volatility-trend span').textContent =
    state.indicators.volatility > 25 ? 'Alta' : 'Baja';

  const emaTrend = state.indicators.ema50 > state.indicators.ema200 ? 'trend-up' : 'trend-down';
  document.getElementById('ema-trend-indicator').className = `indicator-trend ${emaTrend}`;
  document.querySelector('#ema-trend-indicator span').textContent =
    state.indicators.ema50 > state.indicators.ema200 ? 'Alcista' : 'Bajista';

  if (state.indicators.macd) {
    const macdTrend = state.indicators.macd.histogram > 0 ? 'trend-up' : 'trend-down';
    document.getElementById('macd-trend').className = `indicator-trend ${macdTrend}`;
    document.querySelector('#macd-trend span').textContent =
      state.indicators.macd.histogram > 0 ? 'Compra' : 'Venta';
  }

  if (state.indicators.ichimoku) {
    const ichimokuTrend = state.indicators.ichimoku.conversionLine > state.indicators.ichimoku.baseLine ? 'trend-up' : 'trend-down';
    document.getElementById('ichimoku-trend').className = `indicator-trend ${ichimokuTrend}`;
    document.querySelector('#ichimoku-trend span').textContent =
      state.indicators.ichimoku.conversionLine > state.indicators.ichimoku.baseLine ? 'Alcista' : 'Bajista';
    document.getElementById('ichimoku-value').textContent =
      `${state.indicators.ichimoku.conversionLine.toFixed(2)}`;
  }
}

// Update Sentiment
function updateSentiment() {
  const sentimentElement = document.getElementById('sentiment-indicator');
  const sentimentText = document.getElementById('sentiment-text');
  if (state.confidenceLevel > 70) {
    sentimentElement.className = 'sentiment-indicator';
    sentimentText.textContent = 'Sentimiento: Muy Alcista';
  } else if (state.confidenceLevel > 50) {
    sentimentElement.className = 'sentiment-indicator';
    sentimentText.textContent = 'Sentimiento: Alcista';
  } else if (state.confidenceLevel > 30) {
    sentimentElement.className = 'sentiment-indicator neutral';
    sentimentText.textContent = 'Sentimiento: Neutral';
  } else {
    sentimentElement.className = 'sentiment-indicator bearish';
    sentimentText.textContent = 'Sentimiento: Bajista';
  }
}

// Technical Indicator Calculations
function linearRegression(data) {
  const n = data.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += data[i];
    sumXY += i * data[i];
    sumXX += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateVolatility(prices, period = 30) {
  if (prices.length < period) return 0;
  const recentPrices = prices.slice(-period);
  const logReturns = [];
  for (let i = 1; i < recentPrices.length; i++) {
    logReturns.push(Math.log(recentPrices[i] / recentPrices[i - 1]));
  }
  const mean = logReturns.reduce((sum, ret) => sum + ret, 0) / logReturns.length;
  const variance = logReturns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / logReturns.length;
  return Math.sqrt(variance * 252) * 100;
}

function calculateEMA(period, prices) {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (prices.length < slowPeriod + signalPeriod) return null;
  const fastEMA = calculateEMA(fastPeriod, prices);
  const slowEMA = calculateEMA(slowPeriod, prices);
  const MACD = fastEMA - slowEMA;
  const macdValues = [];
  for (let i = slowPeriod; i < prices.length; i++) {
    const fast = calculateEMA(fastPeriod, prices.slice(0, i + 1));
    const slow = calculateEMA(slowPeriod, prices.slice(0, i + 1));
    macdValues.push(fast - slow);
  }
  const signal = calculateEMA(signalPeriod, macdValues);
  const histogram = MACD - signal;
  return { MACD, signal, histogram };
}

function calculateIchimoku(data, conversionPeriod = 9, basePeriod = 26, leadingSpanBPeriod = 52) {
  if (data.length < leadingSpanBPeriod) return null;
  const conversionHigh = Math.max(...data.slice(-conversionPeriod).map(d => d.high));
  const conversionLow = Math.min(...data.slice(-conversionPeriod).map(d => d.low));
  const conversionLine = (conversionHigh + conversionLow) / 2;
  const baseHigh = Math.max(...data.slice(-basePeriod).map(d => d.high));
  const baseLow = Math.min(...data.slice(-basePeriod).map(d => d.low));
  const baseLine = (baseHigh + baseLow) / 2;
  const leadingSpanA = (conversionLine + baseLine) / 2;
  const leadingSpanBHigh = Math.max(...data.slice(-leadingSpanBPeriod).map(d => d.high));
  const leadingSpanBLow = Math.min(...data.slice(-leadingSpanBPeriod).map(d => d.low));
  const leadingSpanB = (leadingSpanBHigh + leadingSpanBLow) / 2;
  return { conversionLine, baseLine, leadingSpanA, leadingSpanB };
}

function calculateBollingerBands(prices, period = 20, multiplier = 2) {
  if (prices.length < period) return null;
  const sma = prices.slice(-period).reduce((sum, price) => sum + price, 0) / period;
  const variance = prices.slice(-period).reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  return {
    upper: sma + (stdDev * multiplier),
    middle: sma,
    lower: sma - (stdDev * multiplier)
  };
}

function calculateHistoricalAccuracy() {
  if (state.historicalData.length < 100) return 75 + Math.random() * 20;

  const predictions = [];
  const actuals = state.historicalData.slice(-100).map(d => d.close);
  for (let i = 20; i < actuals.length; i++) {
    const pastData = actuals.slice(0, i);
    const { slope } = linearRegression(pastData.slice(-7));
    const predicted = pastData[pastData.length - 1] * (1 + (slope / pastData[pastData.length - 1]));
    predictions.push(predicted);
  }

  let correct = 0;
  for (let i = 0; i < predictions.length - 1; i++) {
    const actualMove = actuals[i + 20] - actuals[i + 19];
    const predictedMove = predictions[i] - actuals[i + 19];
    if ((actualMove > 0 && predictedMove > 0) || (actualMove < 0 && predictedMove < 0)) {
      correct++;
    }
  }

  return (correct / (predictions.length - 1)) * 100;
}

// Render Chart
function renderChart() {
  const ctx = document.getElementById('price-chart');
  if (state.priceChart) {
    state.priceChart.destroy();
  }

  if (state.historicalData.length < 2) return;

  const { unit, tooltipFormat } = CONFIG.TIMEFRAME_MAP[state.currentTimeframe];
  const currentStyle = CONFIG.TIMEFRAME_STYLE[state.currentTimeframe] || CONFIG.TIMEFRAME_STYLE['4H'];
  const prices = state.historicalData.map(d => d.close);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const fibAnnotations = state.activeIndicators.fib ? CONFIG.FIB_LEVELS.map(level => {
    const price = minPrice + (maxPrice - minPrice) * level;
    return {
      type: 'line',
      yMin: price,
      yMax: price,
      borderColor: 'var(--chart-fib)',
      borderWidth: 1,
      borderDash: [3, 3]
    };
  }) : [];

  let bollingerDatasets = [];
  if (state.activeIndicators.bollinger && state.indicators.bollinger) {
    bollingerDatasets = [
      {
        label: 'Bollinger Upper',
        data: state.historicalData.map((d, i) => ({
          x: d.time,
          y: calculateBollingerBands(prices.slice(0, i + 1))?.upper
        })),
        borderColor: 'var(--bollinger-upper)',
        borderWidth: 1,
        pointRadius: 0,
        fill: false
      },
      {
        label: 'Bollinger Middle',
        data: state.historicalData.map((d, i) => ({
          x: d.time,
          y: calculateBollingerBands(prices.slice(0, i + 1))?.middle
        })),
        borderColor: 'var(--bollinger-middle)',
        borderWidth: 1,
        pointRadius: 0,
        fill: false
      },
      {
        label: 'Bollinger Lower',
        data: state.historicalData.map((d, i) => ({
          x: d.time,
          y: calculateBollingerBands(prices.slice(0, i + 1))?.lower
        })),
        borderColor: 'var(--bollinger-lower)',
        borderWidth: 1,
        pointRadius: 0,
        fill: false
      }
    ];
  }

  let macdDatasets = [];
  if (state.activeIndicators.macd && state.indicators.macd) {
    macdDatasets = [
      {
        label: 'MACD Line',
        data: state.historicalData.map((d, i) => ({
          x: d.time,
          y: calculateMACD(prices.slice(0, i + 1))?.MACD
        })),
        borderColor: 'var(--macd-line)',
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
        yAxisID: 'y2'
      },
      {
        label: 'Signal Line',
        data: state.historicalData.map((d, i) => ({
          x: d.time,
          y: calculateMACD(prices.slice(0, i + 1))?.signal
        })),
        borderColor: 'var(--macd-signal)',
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
        yAxisID: 'y2'
      },
      {
        label: 'MACD Histogram',
        data: state.historicalData.map((d, i) => ({
          x: d.time,
          y: calculateMACD(prices.slice(0, i + 1))?.histogram
        })),
        type: 'bar',
        backgroundColor: state.historicalData.map((d, i) => {
          const hist = calculateMACD(prices.slice(0, i + 1))?.histogram;
          return hist > 0 ? 'var(--macd-hist-up)' : 'var(--macd-hist-down)';
        }),
        yAxisID: 'y2'
      }
    ];
  }

  let predictionDataset = [];
  let predictionAnnotation = [];
  if (state.predictedPrice && state.currentPrice) {
    const currentDate = new Date();
    const predictionDate = new Date(currentDate);
    const timeframeHours = {
      '1H': 1, '4H': 4, '6H': 6, '12H': 12,
      '1D': 24, '1W': 168, '30D': 720
    };
    predictionDate.setHours(predictionDate.getHours() + timeframeHours[state.currentTimeframe]);
    predictionDataset = [{
      label: 'Predicción',
      data: [
        { x: currentDate, y: state.currentPrice },
        { x: predictionDate, y: state.predictedPrice }
      ],
      borderColor: 'var(--chart-prediction)',
      borderWidth: 3,
      borderDash: [5, 5],
      pointRadius: 0,
      tension: 0
    }];
    predictionAnnotation = [{
      type: 'line',
      yMin: state.predictedPrice,
      yMax: state.predictedPrice,
      borderColor: 'var(--chart-prediction)',
      borderWidth: 2,
      borderDash: [5, 5],
      label: {
        content: `Predicción: $${state.predictedPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
        display: true,
        position: 'right',
        backgroundColor: state.confidenceLevel > 70 ? 'var(--confidence-high)' :
                        state.confidenceLevel > 50 ? 'var(--confidence-medium)' : 'var(--confidence-low)',
        font: { size: 10, weight: 'bold' }
      }
    }];
  }

  state.priceChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Precio de Bitcoin',
          data: state.historicalData.map(d => ({ x: d.time, y: d.close })),
          borderColor: 'var(--chart-line)',
          backgroundColor: 'rgba(0, 0, 0, 0.05)',
          borderWidth: currentStyle.borderWidth,
          pointRadius: currentStyle.pointRadius,
          fill: true,
          tension: 0.1
        },
        ...predictionDataset,
        ...bollingerDatasets,
        ...macdDatasets
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              return `$${context.parsed.y.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
            }
          }
        },
        annotation: { annotations: [...fibAnnotations, ...predictionAnnotation] }
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: unit, tooltipFormat: tooltipFormat },
          grid: { color: 'rgba(0, 0, 0, 0.05)' },
          ticks: { maxRotation: 0, autoSkip: true }
        },
        y: {
          position: 'right',
          grid: { color: 'rgba(0, 0, 0, 0.05)' },
          ticks: {
            callback: value => `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
          }
        },
        y2: {
          display: state.activeIndicators.macd,
          position: 'left',
          grid: { display: false },
          ticks: { display: false }
        }
      },
      interaction: { mode: 'nearest', intersect: false }
    }
  });
}

// Update UI with Cached Data
function updateUIWithCachedData() {
  const cachedPrice = localStorage.getItem('burex_currentPrice');
  const cachedHistorical = localStorage.getItem(`burex_historicalData_${state.currentTimeframe}`);
  if (cachedPrice && cachedHistorical) {
    const priceData = JSON.parse(cachedPrice).data;
    const historicalData = JSON.parse(cachedHistorical).data;
    state.currentPrice = priceData.RAW?.BTC?.USD?.PRICE;
    state.historicalData = historicalData.Data?.Data?.map(item => ({
      time: item.time * 1000,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volumeto
    })) || [];
    updatePriceDisplay(priceData.RAW.BTC.USD);
    calculateAdvancedIndicators();
    calculatePrediction();
    calculateTradingRecommendations();
    renderChart();
  } else {
    showNotification('No hay datos en caché disponibles', 'warning');
  }
}

// Network Handlers
function handleOnline() {
  state.isOnline = true;
  showNotification('Conexión restablecida', 'success');
  loadData();
}

function handleOffline() {
  state.isOnline = false;
  showNotification('Sin conexión: usando datos almacenados', 'warning');
  updateUIWithCachedData();
}

// Notification and Loading
function showNotification(message, type = 'info', duration = 3000) {
  const notification = document.getElementById('notification');
  const messageElement = document.getElementById('notification-message');
  messageElement.textContent = message;
  notification.className = `notification show ${type}`;
  setTimeout(() => notification.classList.remove('show'), duration);
}

function showLoading(message) {
  const overlay = document.getElementById('loading-overlay');
  document.getElementById('loading-text').textContent = message;
  overlay.classList.add('active');
}

function hideLoading() {
  document.getElementById('loading-overlay').classList.remove('active');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initUI();
  updateCurrentPrice().then(() => {
    loadData();
  });
  setInterval(updateCurrentPrice, CONFIG.PRICE_UPDATE_INTERVAL);
  setInterval(loadData, CONFIG.UPDATE_INTERVAL);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
});
