// Optimized configuration
const CONFIG = {
  CRYPTOCOMPARE_API: 'https://min-api.cryptocompare.com/data',
  API_KEY: '',
  CACHE_TTL: 300000, // 5 minutes
  RETRY_COUNT: 3,
  RETRY_DELAY: 1500,
  UPDATE_INTERVAL: 300000, // 5 minutes
  GOLDEN_RATIO: 1.618,
  FIB_LEVELS: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.414, 1.618, 2, 2.618],
  TIMEFRAME_MAP: {
    '15m': { interval: 'minute', limit: 120, unit: 'minute', tooltipFormat: 'HH:mm', minDataPoints: 15, timeframeHours: 0.25 },
    '1h': { interval: 'minute', limit: 360, unit: 'hour', tooltipFormat: 'MMM dd HH:mm', minDataPoints: 20, timeframeHours: 1 },
    '4h': { interval: 'minute', limit: 1440, unit: 'hour', tooltipFormat: 'MMM dd HH:mm', minDataPoints: 20, timeframeHours: 4 },
    '12h': { interval: 'hour', limit: 72, unit: 'hour', tooltipFormat: 'MMM dd HH:mm', minDataPoints: 20, timeframeHours: 12 },
    '1d': { interval: 'hour', limit: 144, unit: 'hour', tooltipFormat: 'MMM dd HH:mm', minDataPoints: 20, timeframeHours: 24 },
    '7': { interval: 'hour', limit: 240, unit: 'day', tooltipFormat: 'MMM dd HH:mm', minDataPoints: 20, timeframeHours: 168 },
    '15': { interval: 'day', limit: 90, unit: 'day', tooltipFormat: 'MMM dd', minDataPoints: 20, timeframeHours: 360 },
    '30': { interval: 'day', limit: 90, unit: 'day', tooltipFormat: 'MMM dd', minDataPoints: 30, timeframeHours: 720 },
    '90': { interval: 'day', limit: 120, unit: 'month', tooltipFormat: 'MMM yyyy', minDataPoints: 52, timeframeHours: 2160 },
    '180': { interval: 'day', limit: 240, unit: 'month', tooltipFormat: 'MMM yyyy', minDataPoints: 52, timeframeHours: 4320 }
  },
  INDICATOR_WEIGHTS: {
    momentum: 0.20,
    rsi: 0.15,
    volatility: 0.10,
    fib: 0.15,
    ema: 0.10,
    ichimoku: 0.15,
    volume_profile: 0.10,
    sentiment: 0.05
  }
};

// State management
const state = {
  priceChart: null,
  currentTimeframe: '7',
  historicalData: [],
  currentPrice: null,
  predictedPrice: null,
  confidenceLevel: 0,
  isOnline: navigator.onLine,
  lastSwingHigh: null,
  lastSwingLow: null,
  indicators: {
    rsi: null,
    macd: null,
    ema50: null,
    ema200: null,
    bollinger: null,
    vwap: null,
    ichimoku: null,
    adx: null,
    volumeProfile: null
  },
  signalHistory: []
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  initUI();
  loadData();

  // Periodic update
  setInterval(loadData, CONFIG.UPDATE_INTERVAL);

  // Connection handling
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
});

function initUI() {
  // Timeframe buttons
  document.querySelectorAll('.timeframe-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentTimeframe = btn.dataset.timeframe;
      document.getElementById('current-timeframe').textContent = 
        state.currentTimeframe.includes('m') ? state.currentTimeframe.toUpperCase() :
        state.currentTimeframe.includes('h') ? state.currentTimeframe.toUpperCase() :
        `${state.currentTimeframe}D`;
      loadData();
    });
  });

  // Theme toggle
  document.querySelector('.theme-toggle')?.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    const icon = document.querySelector('.theme-toggle i');
    icon.className = document.body.classList.contains('dark-theme') ? 'fas fa-sun' : 'fas fa-moon';
    if (state.priceChart) renderChart();
  });

  // Refresh button
  document.getElementById('refresh-btn')?.addEventListener('click', () => {
    loadData();
    showNotification('Actualizando datos...', 'info');
  });
}

async function loadData() {
  if (!state.isOnline) {
    showNotification('Sin conexión: usando datos almacenados', 'warning');
    updateUIWithCachedData();
    return;
  }

  showLoading('Obteniendo datos de Bitcoin...');

  try {
    // Fetch current price
    const priceData = await fetchWithCache(
      CONFIG.API_KEY
        ? `${CONFIG.CRYPTOCOMPARE_API}/pricemultifull?fsyms=BTC&tsyms=USD&api_key=${CONFIG.API_KEY}`
        : `${CONFIG.CRYPTOCOMPARE_API}/pricemultifull?fsyms=BTC&tsyms=USD`,
      'burex_currentPrice'
    );

    if (!priceData.RAW?.BTC?.USD) throw new Error('Datos de precio no disponibles');
    state.currentPrice = priceData.RAW.BTC.USD.PRICE;
    updatePriceDisplay(priceData.RAW.BTC.USD);

    // Fetch historical data
    await fetchHistoricalData();

    // Calculate indicators and predictions
    calculateIndicators();
    calculatePrediction();
    updateSignalHistory();

    // Render chart
    renderChart();

    showNotification('Datos actualizados correctamente', 'success', 2000);
  } catch (error) {
    console.error('Error loading data:', error);
    showNotification(`Error: ${error.message}. Usando datos en caché.`, 'error');
    updateUIWithCachedData();
  } finally {
    hideLoading();
  }
}

async function fetchWithCache(url, cacheKey) {
  // Try cache first
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CONFIG.CACHE_TTL) {
        return data;
      }
    } catch (error) {
      console.error('Error parsing cache:', error);
      localStorage.removeItem(cacheKey);
    }
  }

  // Fetch with retries
  for (let i = 0; i < CONFIG.RETRY_COUNT; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      const data = await response.json();

      if (data.Response === 'Error') throw new Error(data.Message || 'API error');

      // Store in cache
      localStorage.setItem(cacheKey, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
      return data;
    } catch (error) {
      if (i < CONFIG.RETRY_COUNT - 1) {
        console.error(`Retry ${i + 1} failed for ${url}: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * Math.pow(2, i)));
      } else {
        throw error;
      }
    }
  }
}

async function fetchHistoricalData() {
  const { interval, limit } = CONFIG.TIMEFRAME_MAP[state.currentTimeframe];
  const cacheKey = `burex_historicalData_${state.currentTimeframe}`;
  const url = CONFIG.API_KEY
    ? `${CONFIG.CRYPTOCOMPARE_API}/v2/histo${interval}?fsym=BTC&tsym=USD&limit=${limit}&api_key=${CONFIG.API_KEY}`
    : `${CONFIG.CRYPTOCOMPARE_API}/v2/histo${interval}?fsym=BTC&tsym=USD&limit=${limit}`;

  const data = await fetchWithCache(url, cacheKey);

  if (!data.Data?.Data?.length) throw new Error('No hay datos históricos disponibles');

  // Process data
  state.historicalData = data.Data.Data
    .filter(item => item.close > 0)
    .map(item => ({
      x: new Date(item.time * 1000),
      y: item.close,
      volume: item.volumeto,
      high: item.high,
      low: item.low,
      open: item.open
    }));

  console.log(`Fetched ${state.historicalData.length} data points for ${state.currentTimeframe}`);

  // Add current price if more recent
  if (state.currentPrice) {
    const lastDate = state.historicalData[state.historicalData.length - 1]?.x;
    const currentDate = new Date();
    if (!lastDate || currentDate > lastDate) {
      state.historicalData.push({
        x: currentDate,
        y: state.currentPrice,
        volume: state.historicalData[state.historicalData.length - 1]?.volume || 0,
        high: state.currentPrice,
        low: state.currentPrice,
        open: state.currentPrice
      });
    }
  }
}

function updatePriceDisplay(priceData) {
  document.getElementById('current-price').textContent =
    `$${state.currentPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

  const change24h = priceData.CHANGEPCT24HOUR || 0;
  const changeElement = document.getElementById('price-change');
  changeElement.textContent = `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}% (24h)`;
  changeElement.className = change24h >= 0 ? 'stat-label trend-up' : 'stat-label trend-down';
}

function calculateIndicators() {
  const prices = state.historicalData.map(d => d.y);
  const highs = state.historicalData.map(d => d.high);
  const lows = state.historicalData.map(d => d.low);
  const volumes = state.historicalData.map(d => d.volume);
  const minDataPoints = CONFIG.TIMEFRAME_MAP[state.currentTimeframe].minDataPoints;

  if (prices.length < minDataPoints) {
    console.warn(`Datos insuficientes para indicadores en ${state.currentTimeframe}: ${prices.length} puntos`);
    return;
  }

  // RSI
  state.indicators.rsi = calculateRSI(prices, Math.min(14, prices.length - 1));

  // EMA
  state.indicators.ema50 = calculateEMA(Math.min(50, prices.length), prices);
  state.indicators.ema200 = prices.length >= 200 ? calculateEMA(200, prices) : null;

  // Bollinger Bands
  state.indicators.bollinger = calculateBollingerBands(prices, Math.min(20, prices.length));

  // VWAP
  state.indicators.vwap = calculateVWAP(state.historicalData);

  // Ichimoku Cloud
  state.indicators.ichimoku = prices.length >= 52 ? calculateIchimokuCloud(highs, lows, prices) : null;

  // ADX
  state.indicators.adx = prices.length >= 28 ? calculateADX(highs, lows, prices) : null;

  // Volume Profile
  state.indicators.volumeProfile = calculateVolumeProfile(prices, volumes);

  // Swing points
  const swings = calculateSwingPoints(state.historicalData);
  state.lastSwingHigh = swings.swingHigh;
  state.lastSwingLow = swings.swingLow;
}

// Advanced indicator: Ichimoku Cloud
function calculateIchimokuCloud(highs, lows, closes) {
  const conversionPeriod = 9;
  const basePeriod = 26;
  const leadingSpanPeriod = 52;

  if (closes.length < leadingSpanPeriod) return null;

  // Conversion Line (Tenkan-sen)
  const conversionLine = [];
  for (let i = conversionPeriod - 1; i < closes.length; i++) {
    const high = Math.max(...highs.slice(i - conversionPeriod + 1, i + 1));
    const low = Math.min(...lows.slice(i - conversionPeriod + 1, i + 1));
    conversionLine.push((high + low) / 2);
  }

  // Base Line (Kijun-sen)
  const baseLine = [];
  for (let i = basePeriod - 1; i < closes.length; i++) {
    const high = Math.max(...highs.slice(i - basePeriod + 1, i + 1));
    const low = Math.min(...lows.slice(i - basePeriod + 1, i + 1));
    baseLine.push((high + low) / 2);
  }

  // Leading Span A (Senkou Span A)
  const leadingSpanA = [];
  for (let i = basePeriod - 1; i < conversionLine.length; i++) {
    leadingSpanA.push((conversionLine[i] + baseLine[i]) / 2);
  }

  // Leading Span B (Senkou Span B)
  const leadingSpanB = [];
  for (let i = leadingSpanPeriod - 1; i < closes.length; i++) {
    const high = Math.max(...highs.slice(i - leadingSpanPeriod + 1, i + 1));
    const low = Math.min(...lows.slice(i - leadingSpanPeriod + 1, i + 1));
    leadingSpanB.push((high + low) / 2);
  }

  return {
    conversion: conversionLine[conversionLine.length - 1],
    base: baseLine[baseLine.length - 1],
    spanA: leadingSpanA,
    spanB: leadingSpanB,
    trend: closes[closes.length - 1] > leadingSpanA[leadingSpanA.length - 1] &&
           closes[closes.length - 1] > leadingSpanB[leadingSpanB.length - 1] ?
           'Alcista' : 'Bajista'
  };
}

// Advanced indicator: ADX (Average Directional Index)
function calculateADX(highs, lows, closes, period = 14) {
  if (highs.length < period * 2 || lows.length < period * 2 || closes.length < period * 2) {
    return null;
  }

  const plusDM = [0];
  const minusDM = [0];
  const trueRanges = [0];

  for (let i = 1; i < highs.length; i++) {
    const upMove = highs[i] - highs[i-1];
    const downMove = lows[i-1] - lows[i];

    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);

    trueRanges.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i-1]),
      Math.abs(lows[i] - closes[i-1])
    ));
  }

  // Smooth the values
  let atr = trueRanges.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
  let plusDI = plusDM.slice(0, period).reduce((sum, val) => sum + val, 0) / period / atr * 100;
  let minusDI = minusDM.slice(0, period).reduce((sum, val) => sum + val, 0) / period / atr * 100;

  const dxValues = [Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100];

  for (let i = period; i < highs.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
    plusDI = (plusDI * (period - 1) + plusDM[i]) / period / atr * 100;
    minusDI = (minusDI * (period - 1) + minusDM[i]) / period / atr * 100;
    dxValues.push(Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100);
  }

  // Calculate ADX
  let adx = dxValues.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
  for (let i = period; i < dxValues.length; i++) {
    adx = (adx * (period - 1) + dxValues[i]) / period;
  }

  return adx;
}

// Volume Profile indicator
function calculateVolumeProfile(prices, volumes) {
  if (prices.length < 10) return null;

  // Find price range
  const minPrice = Math.min(...prices.slice(-10));
  const maxPrice = Math.max(...prices.slice(-10));
  const range = maxPrice - minPrice;

  if (range === 0) return 'Neutral';

  // Create volume buckets
  const buckets = new Array(10).fill(0).map((_, i) => ({
    priceLevel: minPrice + (range * i / 10),
    volume: 0
  }));

  // Distribute volume to buckets
  for (let i = prices.length - 10; i < prices.length; i++) {
    const bucketIndex = Math.min(9, Math.floor((prices[i] - minPrice) / range * 10));
    buckets[bucketIndex].volume += volumes[i];
  }

  // Find high volume nodes
  const sortedBuckets = [...buckets].sort((a, b) => b.volume - a.volume);
  const highVolumeNodes = sortedBuckets.slice(0, 3);

  // Determine market profile
  const currentPrice = prices[prices.length - 1];
  const valueArea = highVolumeNodes.reduce((sum, node) => sum + node.priceLevel, 0) / 3;

  return currentPrice > valueArea ? 'Alcista' : 'Bajista';
}

function calculatePrediction() {
  const minDataPoints = CONFIG.TIMEFRAME_MAP[state.currentTimeframe].minDataPoints;
  if (!state.currentPrice || state.historicalData.length < minDataPoints) {
    console.warn(`No se puede calcular predicción para ${state.currentTimeframe}: solo ${state.historicalData.length} puntos, se requieren ${minDataPoints}`);
    state.predictedPrice = null;
    state.confidenceLevel = 0;
    document.getElementById('prediction-price').textContent = 'N/A';
    document.getElementById('confidence-level').textContent = 'Confianza: 0%';
    return;
  }

  const prices = state.historicalData.map(d => d.y);
  const timeframeHours = CONFIG.TIMEFRAME_MAP[state.currentTimeframe].timeframeHours;

  // 1. Momentum (short-term trend)
  const shortTermData = prices.slice(-Math.min(7, prices.length));
  const { slope } = linearRegression(shortTermData);
  const momentum = slope / state.currentPrice;
  const momentumFactor = 1 + (momentum * CONFIG.GOLDEN_RATIO * (timeframeHours / 720)); // Scale with timeframe

  // 2. RSI
  const rsi = state.indicators.rsi;
  const rsiFactor = rsi ? 1 + (50 - rsi) * 0.005 : 1;

  // 3. Volatility
  const volatility = calculateVolatility(prices, timeframeHours);
  const volatilityFactor = volatility > 30 ? 0.95 : volatility < 10 ? 1.05 : 1;

  // 4. Fibonacci Levels
  const maxPrice = state.lastSwingHigh || Math.max(...prices);
  const minPrice = state.lastSwingLow || Math.min(...prices);
  const priceRange = maxPrice - minPrice;
  const threshold = Math.max(priceRange * 0.025, 100);
  const detectedLevels = CONFIG.FIB_LEVELS.filter(level => {
    const fibPrice = minPrice + priceRange * level;
    return Math.abs(state.currentPrice - fibPrice) < threshold;
  }).length;
  const fibFactor = 1 + (detectedLevels * 0.04);

  // 5. EMA Trend
  let emaFactor = 1;
  let emaTrend = 'Neutral';
  if (state.indicators.ema50 && (state.indicators.ema200 || state.historicalData.length < 200)) {
    emaTrend = state.indicators.ema50 > (state.indicators.ema200 || state.indicators.ema50) ? 'Alcista' : 'Bajista';
    emaFactor = emaTrend === 'Alcista' ? 1.02 : 0.98;
  }

  // 6. Ichimoku Cloud
  let ichimokuFactor = 1;
  let ichimokuTrend = 'Neutral';
  if (state.indicators.ichimoku) {
    ichimokuTrend = state.indicators.ichimoku.trend;
    ichimokuFactor = ichimokuTrend === 'Alcista' ? 1.03 : 0.97;
  }

  // 7. Volume Profile
  let volumeProfileFactor = 1;
  if (state.indicators.volumeProfile) {
    volumeProfileFactor = state.indicators.volumeProfile === 'Alcista' ? 1.02 : 0.98;
  }

  // 8. Sentiment Proxy
  const volumeTrend = calculateVolumeTrend(state.historicalData);
  const sentimentFactor = volumeTrend > 0 ? 1.02 : volumeTrend < 0 ? 0.98 : 1;

  // Combine factors with weights
  state.predictedPrice = state.currentPrice *
    (CONFIG.INDICATOR_WEIGHTS.momentum * momentumFactor +
     CONFIG.INDICATOR_WEIGHTS.rsi * rsiFactor +
     CONFIG.INDICATOR_WEIGHTS.volatility * volatilityFactor +
     CONFIG.INDICATOR_WEIGHTS.fib * fibFactor +
     CONFIG.INDICATOR_WEIGHTS.ema * emaFactor +
     CONFIG.INDICATOR_WEIGHTS.ichimoku * ichimokuFactor +
     CONFIG.INDICATOR_WEIGHTS.volume_profile * volumeProfileFactor +
     CONFIG.INDICATOR_WEIGHTS.sentiment * sentimentFactor);

  // Calculate confidence with improved alignment
  const historicalAccuracy = calculateHistoricalAccuracy();
  const indicatorAlignment = [
    Math.abs(momentum) < 0.01 ? 0.9 : 1, // Relaxed penalty for low momentum
    rsi ? (rsi > 30 && rsi < 70 ? 1 : 0.95) : 0.9, // Relaxed penalty for missing/overbought RSI
    volatility > 30 ? 0.95 : 1, // Relaxed penalty for high volatility
    detectedLevels > 0 ? 1.1 : 0.98, // Slightly relaxed Fibonacci penalty
    emaFactor !== 1 ? 1.05 : 1,
    ichimokuFactor !== 1 ? 1.05 : 0.9, // Relaxed penalty for missing Ichimoku
    volumeProfileFactor !== 1 ? 1.05 : 0.9 // Relaxed penalty for missing volume profile
  ].reduce((product, factor) => product * factor, 1);

  // Log factors for debugging
  console.log(`Confidence factors for ${state.currentTimeframe}:`, {
    historicalAccuracy,
    indicatorAlignment,
    volatility,
    momentum,
    rsi,
    detectedLevels,
    emaTrend,
    ichimokuTrend,
    volumeProfile: state.indicators.volumeProfile
  });

  state.confidenceLevel = Math.min(100, Math.max(10, // Minimum confidence of 10%
    historicalAccuracy * indicatorAlignment * Math.max(0.5, 1 - volatility / 100) * 100
  ));

  // Update UI
  document.getElementById('prediction-price').textContent =
    `$${state.predictedPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const confidenceElement = document.getElementById('confidence-level');
  confidenceElement.textContent = `Confianza: ${state.confidenceLevel.toFixed(0)}%`;

  const confidenceClass = state.confidenceLevel > 70 ? 'confidence-high' :
                         state.confidenceLevel > 50 ? 'confidence-medium' : 'confidence-low';
  confidenceElement.className = `confidence-indicator ${confidenceClass}`;

  // Update confidence meter
  const confidenceFill = document.getElementById('confidence-fill');
  confidenceFill.style.width = `${state.confidenceLevel}%`;
  confidenceFill.className = `confidence-fill ${confidenceClass}`;

  // Update sentiment display
  const sentimentValue = document.getElementById('sentiment-value');
  if (momentum > 0 && rsi < 70 && ichimokuTrend === 'Alcista') {
    sentimentValue.textContent = 'Alcista';
    sentimentValue.className = 'sentiment-value trend-up';
  } else if (momentum < 0 && rsi > 30 && ichimokuTrend === 'Bajista') {
    sentimentValue.textContent = 'Bajista';
    sentimentValue.className = 'sentiment-value trend-down';
  } else {
    sentimentValue.textContent = 'Neutral';
    sentimentValue.className = 'sentiment-value trend-neutral';
  }

  // Update indicators display
  document.getElementById('ichimoku-trend').textContent = ichimokuTrend || 'N/A';
  document.getElementById('ichimoku-trend').className = `stat-value ${
    ichimokuTrend === 'Alcista' ? 'trend-up' : ichimokuTrend === 'Bajista' ? 'trend-down' : 'trend-neutral'
  }`;

  document.getElementById('rsi-value').textContent = rsi ? rsi.toFixed(2) : 'N/A';
  document.getElementById('rsi-value').className = `stat-value ${
    rsi > 70 ? 'trend-down' : rsi < 30 ? 'trend-up' : 'trend-neutral'
  }`;

  document.getElementById('volatility').textContent = `${volatility.toFixed(2)}%`;
  document.getElementById('fib-levels').textContent = `${detectedLevels}/12`;
  document.getElementById('adx-value').textContent = state.indicators.adx ? state.indicators.adx.toFixed(2) : 'N/A';
  document.getElementById('volume-profile').textContent = state.indicators.volumeProfile || 'N/A';
  document.getElementById('volume-profile').className = `stat-value ${
    state.indicators.volumeProfile === 'Alcista' ? 'trend-up' :
    state.indicators.volumeProfile === 'Bajista' ? 'trend-down' : 'trend-neutral'
  }`;
}

function renderChart() {
  const ctx = document.getElementById('price-chart');
  if (!ctx || state.historicalData.length < 2) {
    console.warn('No se puede renderizar el gráfico: datos insuficientes');
    showNotification('No hay datos suficientes para mostrar el gráfico', 'error');
    return;
  }

  if (state.priceChart) {
    state.priceChart.destroy();
  }

  const { unit, tooltipFormat } = CONFIG.TIMEFRAME_MAP[state.currentTimeframe];
  const prices = state.historicalData.map(d => d.y);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  // Ichimoku Cloud dataset
  const ichimokuDatasets = [];
  if (state.indicators.ichimoku && state.indicators.ichimoku.spanA && state.indicators.ichimoku.spanB) {
    const sliceIndex = Math.max(0, state.historicalData.length - state.indicators.ichimoku.spanA.length);
    ichimokuDatasets.push({
      label: 'Ichimoku Span A',
      data: state.historicalData.slice(sliceIndex).map((d, i) => ({
        x: d.x,
        y: state.indicators.ichimoku.spanA[i]
      })),
      borderColor: 'rgba(75, 192, 192, 0.5)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      borderWidth: 1,
      pointRadius: 0,
      fill: {
        target: '+1',
        above: 'rgba(75, 192, 192, 0.2)',
        below: 'rgba(255, 99, 132, 0.2)'
      },
      tension: 0
    }, {
      label: 'Ichimoku Span B',
      data: state.historicalData.slice(sliceIndex).map((d, i) => ({
        x: d.x,
        y: state.indicators.ichimoku.spanB[i]
      })),
      borderColor: 'rgba(153, 102, 255, 0.5)',
      backgroundColor: 'rgba(153, 102, 255, 0.2)',
      borderWidth: 1,
      pointRadius: 0,
      fill: false,
      tension: 0
    });
  }

  // Prediction dataset
  let predictionDataset = [];
  if (state.predictedPrice && state.currentPrice) {
    const currentDate = new Date();
    const timeframeHours = CONFIG.TIMEFRAME_MAP[state.currentTimeframe].timeframeHours;
    const predictionDate = new Date(currentDate.getTime() + timeframeHours * 60 * 60 * 1000);

    predictionDataset = [{
      label: 'Predicción',
      data: [
        { x: currentDate, y: state.currentPrice },
        { x: predictionDate, y: state.predictedPrice }
      ],
      borderColor: 'var(--chart-prediction)',
      borderWidth: 2,
      borderDash: [5, 5],
      pointRadius: 0,
      tension: 0
    }];
  }

  // Create chart
  state.priceChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Precio de Bitcoin',
          data: state.historicalData.map(d => ({ x: d.x, y: d.y })),
          borderColor: 'var(--chart-line)',
          backgroundColor: 'rgba(0, 0, 0, 0.05)',
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.1
        },
        ...ichimokuDatasets,
        ...predictionDataset
      ].filter(d => d !== null)
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
            label: context => `$${context.parsed.y.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: { unit, tooltipFormat },
          grid: { color: 'rgba(0, 0, 0, 0.05)' },
          ticks: { maxRotation: 0, autoSkip: true }
        },
        y: {
          position: 'right',
          grid: { color: 'rgba(0, 0, 0, 0.05)' },
          ticks: {
            callback: value => `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
          }
        }
      },
      interaction: {
        mode: 'nearest',
        intersect: false
      }
    }
  });
}

// Helper functions
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;

  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i-1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i-1];
    avgGain = (avgGain * (period - 1) + (diff >= 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
  }

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateEMA(period, prices) {
  if (prices.length < period) return null;

  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((sum, val) => sum + val, 0) / period;

  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }

  return ema;
}

function calculateBollingerBands(prices, period = 20, stdDev = 2) {
  if (prices.length < period) return null;

  const sma = prices.slice(-period).reduce((sum, val) => sum + val, 0) / period;
  const variance = prices.slice(-period).reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
  const std = Math.sqrt(variance);

  return {
    upper: sma + std * stdDev,
    middle: sma,
    lower: sma - std * stdDev
  };
}

function calculateVWAP(data) {
  if (data.length < 1) return null;

  let totalVolume = 0;
  let totalPriceVolume = 0;

  for (const item of data.slice(-Math.min(20, data.length))) {
    const typicalPrice = (item.high + item.low + item.y) / 3;
    totalPriceVolume += typicalPrice * item.volume;
    totalVolume += item.volume;
  }

  return totalVolume === 0 ? null : totalPriceVolume / totalVolume;
}

function calculateVolumeTrend(data) {
  if (data.length < 10) return 0;

  const volumes = data.slice(-10).map(d => d.volume);
  const { slope } = linearRegression(volumes);
  return slope;
}

function calculateHistoricalAccuracy() {
  if (state.signalHistory.length < 2) return 0.85; // Increased default accuracy

  let correct = 0;
  let total = 0;

  for (let i = 1; i < state.signalHistory.length; i++) {
    const prev = state.signalHistory[i-1];
    const actual = state.historicalData.find(d => d.x >= new Date(prev.date))?.y;
    if (actual) {
      const predictedChange = prev.predictedPrice - prev.currentPrice;
      const actualChange = actual - prev.currentPrice;
      if ((predictedChange > 0 && actualChange > 0) || (predictedChange < 0 && actualChange < 0)) {
        correct++;
      }
      total++;
    }
  }

  return total > 0 ? Math.max(0.5, correct / total) : 0.85; // Minimum 50% if some history exists
}

function linearRegression(data) {
  if (data.length < 2) return { slope: 0, intercept: 0 };

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

function calculateVolatility(prices, timeframeHours) {
  if (prices.length < 10) return 0;

  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(Math.log(prices[i] / prices[i-1]));
  }

  const mean = returns.reduce((sum, val) => sum + val, 0) / returns.length;
  const variance = returns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / returns.length;
  const periodFactor = Math.sqrt(Math.min(365 * 24, timeframeHours * 24)); // Scale by timeframe
  return Math.sqrt(variance) * periodFactor * 100;
}

function calculateSwingPoints(data) {
  if (data.length < 5) return { swingHigh: null, swingLow: null };

  let swingHigh = data[0].high;
  let swingLow = data[0].low;

  for (let i = 2; i < data.length - 2; i++) {
    if (data[i].high > data[i-1].high && data[i].high > data[i+1].high &&
        data[i].high > data[i-2].high && data[i].high > data[i+2].high) {
      swingHigh = data[i].high;
    }
    if (data[i].low < data[i-1].low && data[i].low < data[i+1].low &&
        data[i].low < data[i-2].low && data[i].low < data[i+2].low) {
      swingLow = data[i].low;
    }
  }

  return { swingHigh, swingLow };
}

function updateSignalHistory() {
  if (!state.predictedPrice || !state.currentPrice) return;

  const newSignal = {
    date: new Date().toISOString(),
    timeframe: state.currentTimeframe,
    currentPrice: state.currentPrice,
    predictedPrice: state.predictedPrice,
    confidence: state.confidenceLevel
  };

  state.signalHistory.push(newSignal);
  if (state.signalHistory.length > 50) {
    state.signalHistory.shift(); // Keep only last 50 entries
  }

  // Save to localStorage
  localStorage.setItem('burex_signalHistory', JSON.stringify(state.signalHistory));

  // Update UI
  const historyContainer = document.getElementById('signal-history');
  historyContainer.innerHTML = '';

  if (state.signalHistory.length === 0) {
    historyContainer.innerHTML = '<p class="empty-history">No hay datos históricos disponibles</p>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'history-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Marco Temporal</th>
        <th>Precio Actual</th>
        <th>Predicción</th>
        <th>Confianza</th>
      </tr>
    </thead>
    <tbody>
      ${state.signalHistory.reverse().map(signal => `
        <tr>
          <td>${new Date(signal.date).toLocaleDateString()}</td>
          <td>${signal.timeframe.includes('m') ? signal.timeframe.toUpperCase() :
                 signal.timeframe.includes('h') ? signal.timeframe.toUpperCase() :
                 `${signal.timeframe}D`}</td>
          <td>$${signal.currentPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
          <td>$${signal.predictedPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
          <td>${signal.confidence.toFixed(0)}%</td>
        </tr>
      `).join('')}
    </tbody>
  `;

  historyContainer.appendChild(table);
}

function updateUIWithCachedData() {
  const cachedPrice = localStorage.getItem('burex_currentPrice');
  const cachedHistory = localStorage.getItem(`burex_historicalData_${state.currentTimeframe}`);
  const cachedSignals = localStorage.getItem('burex_signalHistory');

  if (cachedPrice) {
    try {
      const { data } = JSON.parse(cachedPrice);
      state.currentPrice = data.RAW.BTC.USD.PRICE;
      updatePriceDisplay(data.RAW.BTC.USD);
    } catch (error) {
      console.error('Error parsing cached price:', error);
    }
  }

  if (cachedHistory) {
    try {
      const { data } = JSON.parse(cachedHistory);
      state.historicalData = data.Data.Data
        .filter(item => item.close > 0)
        .map(item => ({
          x: new Date(item.time * 1000),
          y: item.close,
          volume: item.volumeto,
          high: item.high,
          low: item.low,
          open: item.open
        }));
      console.log(`Loaded ${state.historicalData.length} cached data points for ${state.currentTimeframe}`);
      calculateIndicators();
      calculatePrediction();
    } catch (error) {
      console.error('Error parsing cached history:', error);
    }
  }

  if (cachedSignals) {
    try {
      state.signalHistory = JSON.parse(cachedSignals);
      updateSignalHistory();
    } catch (error) {
      console.error('Error parsing cached signals:', error);
    }
  }

  if (state.historicalData.length >= 2) {
    renderChart();
  }
}

function handleOnline() {
  state.isOnline = true;
  loadData();
  showNotification('Conexión restaurada', 'success');
}

function handleOffline() {
  state.isOnline = false;
  showNotification('Sin conexión: usando datos en caché', 'warning');
}

function showNotification(message, type = 'info', duration = 3000) {
  const notification = document.getElementById('notification');
  const messageElement = document.getElementById('notification-message');

  messageElement.textContent = message;
  notification.className = `notification ${type} show`;

  setTimeout(() => {
    notification.className = `notification ${type}`;
  }, duration);
}

function showLoading(message) {
  const overlay = document.getElementById('loading-overlay');
  const text = document.getElementById('loading-text');

  text.textContent = message;
  overlay.classList.add('active');
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  overlay.classList.remove('active');
}
