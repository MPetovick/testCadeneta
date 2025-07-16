// Variables globales mejoradas
let priceChart = null;
let currentTimeframe = '30';
let historicalData = [];
let predictedPrice = null;
let currentPrice = null;
let currentPriceTimestamp = null;
let predictionHistory = JSON.parse(localStorage.getItem('goldenPredictorHistory')) || [];
const goldenRatio = 1.618;
const maxHistorySize = 50;
const retryCount = 3;
const retryDelay = 1500;

// Función para mostrar notificaciones
function showNotification(message, type = 'info', duration = 5000) {
    const notification = document.getElementById('notification');
    const messageElement = document.getElementById('notification-message');
    
    notification.className = 'notification show ' + type;
    messageElement.textContent = message;
    
    // Configurar cierre automático
    setTimeout(() => {
        notification.classList.remove('show');
    }, duration);
    
    // Configurar botón de cierre
    document.querySelector('.close-btn').onclick = () => {
        notification.classList.remove('show');
    };
}

// Función para reintentar solicitudes
async function retryRequest(fn, maxRetries = retryCount, delay = retryDelay) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
            showNotification(`Reintentando... (${i+1}/${maxRetries})`, 'info', 2000);
        }
    }
}

// Configuración inicial
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar notificación
    document.getElementById('notification').style.display = 'block';
    
    // Inicializar botones de timeframe
    initTimeframeButtons();
    
    // Cargar datos iniciales
    loadData();
    
    // Configurar actualización periódica
    setInterval(loadData, 300000); // Actualizar cada 5 minutos
});

// Manejar botones de timeframe
function initTimeframeButtons() {
    const buttons = document.querySelectorAll('.timeframe-btn');
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            buttons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            currentTimeframe = this.dataset.timeframe;
            document.getElementById('current-timeframe').textContent = currentTimeframe + 'D';
            loadData();
        });
    });
}

// Cargar todos los datos
async function loadData() {
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.classList.add('active');

    try {
        // Obtener precio actual
        const change24h = await retryRequest(fetchCurrentPrice);
        
        // Obtener datos históricos
        await retryRequest(fetchHistoricalData);
        
        // Calcular y actualizar predicción
        predictedPrice = calculatePrediction(change24h);
        
        // Actualizar UI
        updatePredictionDetails();
        
        // Inicializar gráfico
        initChart();
        
        // Mostrar notificación de éxito
        showNotification('Datos actualizados con éxito', 'success', 3000);
        
    } catch (error) {
        console.error('Error loading data:', error);
        showNotification(`Error al cargar datos: ${error.message}`, 'error', 5000);
    } finally {
        loadingOverlay.classList.remove('active');
    }
}

// Obtener precio actual (CryptoCompare)
async function fetchCurrentPrice() {
    try {
        const response = await fetch('https://min-api.cryptocompare.com/data/pricemultifull?fsyms=BTC&tsyms=USD');
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        
        const data = await response.json();
        if (!data.RAW || !data.RAW.BTC || !data.RAW.BTC.USD) {
            throw new Error('Datos de precio no disponibles');
        }
        
        currentPrice = data.RAW.BTC.USD.PRICE;
        currentPriceTimestamp = new Date();

        // Actualizar UI
        document.getElementById('current-price').textContent = `$${currentPrice.toLocaleString('en-US', {maximumFractionDigits: 2})}`;
        
        const change24h = data.RAW.BTC.USD.CHANGEPCT24HOUR || 0;
        const changeElement = document.getElementById('price-change');
        changeElement.textContent = `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}% (24h)`;
        changeElement.className = change24h >= 0 ? 'price-change change-positive' : 'price-change change-negative';
        
        return change24h;
    } catch (error) {
        console.error('Error fetching current price:', error);
        document.getElementById('current-price').textContent = 'Error';
        document.getElementById('price-change').textContent = 'Error';
        throw error;
    }
}

// Obtener datos históricos (CryptoCompare)
async function fetchHistoricalData() {
    try {
        // Determinar intervalo y límite según timeframe
        const interval = currentTimeframe === '7' ? 'histohour' : 'histoday';
        const limit = currentTimeframe === '7' ? 168 : currentTimeframe; // 168 horas = 7 días
        
        const response = await fetch(`https://min-api.cryptocompare.com/data/v2/${interval}?fsym=BTC&tsym=USD&limit=${limit}`);
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        
        const data = await response.json();
        if (!data.Data || !data.Data.Data || data.Data.Data.length === 0) {
            throw new Error('No se recibieron datos de precios');
        }
        
        historicalData = data.Data.Data.map(item => ({
            x: new Date(item.time * 1000),
            y: item.close
        }));
        
        // Agregar precio actual si es más reciente
        if (currentPrice && currentPriceTimestamp) {
            const lastDataPoint = historicalData[historicalData.length - 1].x;
            if (currentPriceTimestamp > lastDataPoint) {
                historicalData.push({
                    x: currentPriceTimestamp,
                    y: currentPrice
                });
            }
            historicalData.sort((a, b) => a.x - b.x);
        }

        // Actualizar contador de puntos de datos
        document.getElementById('data-points').textContent = historicalData.length + ' puntos';
    } catch (error) {
        console.error(`Error fetching historical data for ${currentTimeframe}D:`, error);
        throw error;
    }
}

// Mejorada predicción basada en número áureo
function calculatePrediction(change24h) {
    if (!currentPrice || historicalData.length < 2) return null;

    // 1. Calcular momentum basado en cambio reciente
    const shortTerm = Math.max(3, Math.floor(historicalData.length * 0.2)); // 20% de los datos
    const startIdx = Math.max(0, historicalData.length - shortTerm);
    const shortTermData = historicalData.slice(startIdx);
    const startPrice = shortTermData[0].y;
    const endPrice = shortTermData[shortTermData.length - 1].y;
    const momentum = (endPrice - startPrice) / startPrice;

    // 2. Identificar niveles de Fibonacci estándar
    const maxPrice = Math.max(...historicalData.map(d => d.y));
    const minPrice = Math.min(...historicalData.map(d => d.y));
    const fibLevels = [
        minPrice + (maxPrice - minPrice) * 0.236, // 23.6%
        minPrice + (maxPrice - minPrice) * 0.382, // 38.2%
        minPrice + (maxPrice - minPrice) * 0.5,   // 50%
        minPrice + (maxPrice - minPrice) * 0.618, // 61.8%
        minPrice + (maxPrice - minPrice) * 0.786  // 78.6%
    ];

    // Contar niveles detectados
    const priceRange = maxPrice - minPrice;
    const detectionThreshold = Math.max(priceRange * 0.05, 500); // 5% del rango o mínimo $500
    const detectedLevels = fibLevels.filter(level => 
        Math.abs(currentPrice - level) < detectionThreshold
    ).length;

    // Depurar niveles
    console.log('Fibonacci Levels:', fibLevels.map(level => level.toFixed(2)));
    console.log('Current Price:', currentPrice.toFixed(2));
    console.log('Detection Threshold:', detectionThreshold.toFixed(2));
    console.log('Detected Levels:', detectedLevels);

    document.getElementById('fib-levels').textContent = `${detectedLevels}/5 niveles detectados`;

    // 3. Factor de impulso áureo
    const goldenMomentum = (change24h / 100) * goldenRatio * 100;
    document.getElementById('golden-momentum').textContent = `${goldenMomentum.toFixed(2)}%`;

    // 4. Calcular predicción con ajuste de niveles detectados
    const levelFactor = 1 + (detectedLevels * 0.05); // +5% por nivel detectado
    const predicted = currentPrice * (1 + momentum * goldenRatio) * levelFactor;

    // 5. Guardar predicción para seguimiento
    const predictionEntry = {
        timestamp: new Date(),
        actualPrice: currentPrice,
        predictedPrice: predicted,
        timeframe: currentTimeframe,
        detectedLevels: detectedLevels
    };
    
    predictionHistory.push(predictionEntry);
    
    // Mantener solo las últimas entradas
    if (predictionHistory.length > maxHistorySize) {
        predictionHistory = predictionHistory.slice(predictionHistory.length - maxHistorySize);
    }
    
    localStorage.setItem('goldenPredictorHistory', JSON.stringify(predictionHistory));
    
    return predicted;
}

// Actualizar detalles de predicción
function updatePredictionDetails() {
    // Calcular precisión histórica
    if (predictionHistory.length > 0) {
        const accuracy = calculateHistoricalAccuracy();
        document.getElementById('accuracy-rate').textContent = `${accuracy.toFixed(2)}%`;
        
        // Actualizar barra de precisión
        const accuracyBar = document.getElementById('accuracy-bar-fill');
        accuracyBar.style.width = `${Math.min(100, Math.max(0, accuracy))}%`;
        accuracyBar.style.background = accuracy > 70 ? 'var(--positive)' : 
                                     accuracy > 50 ? '#ffd166' : 'var(--negative)';
    }
    
    // Actualizar precio predicho en la UI
    if (predictedPrice !== null) {
        document.getElementById('prediction-price').textContent = 
            `$${predictedPrice.toLocaleString('en-US', {maximumFractionDigits: 2})}`;
    }
}

// Calcular precisión histórica mejorada
function calculateHistoricalAccuracy() {
    if (predictionHistory.length < 2) return 0;
    
    let accuracySum = 0;
    let validEntries = 0;
    
    // Calcular precisión para cada predicción con datos posteriores
    for (let i = 0; i < predictionHistory.length - 1; i++) {
        const prediction = predictionHistory[i];
        const nextData = predictionHistory[i + 1];
        
        // Calcular diferencia porcentual
        const priceDiff = Math.abs(prediction.predictedPrice - nextData.actualPrice);
        const accuracy = (1 - (priceDiff / prediction.predictedPrice)) * 100;
        
        // Solo considerar predicciones válidas
        if (!isNaN(accuracy)) {
            accuracySum += Math.max(0, accuracy); // No permitir valores negativos
            validEntries++;
        }
    }
    
    return validEntries > 0 ? accuracySum / validEntries : 0;
}

// Inicializar gráfico
function initChart() {
    if (historicalData.length === 0) {
        console.warn('No hay datos históricos para mostrar el gráfico');
        return;
    }

    const ctx = document.getElementById('price-chart').getContext('2d');
    if (priceChart) {
        priceChart.destroy();
    }

    // Calcular límites del eje Y
    const values = historicalData.map(d => d.y);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue;
    const allValues = predictedPrice ? [...values, predictedPrice] : values;
    const minBound = Math.min(...allValues) - range * 0.05;
    const maxBound = Math.max(...allValues) + range * 0.05;

    // Preparar datos para predicción
    let predictionData = [];
    let annotations = [];
    
    if (currentPrice && currentPriceTimestamp && predictedPrice) {
        const futureDate = new Date(currentPriceTimestamp);
        const daysToAdd = parseInt(currentTimeframe) / 10;
        futureDate.setDate(futureDate.getDate() + daysToAdd);

        predictionData = [
            { x: currentPriceTimestamp, y: currentPrice },
            { x: futureDate, y: predictedPrice }
        ];

        // Añadir línea horizontal para el precio predicho
        annotations.push({
            type: 'line',
            yMin: predictedPrice,
            yMax: predictedPrice,
            borderColor: 'rgba(0, 230, 195, 0.8)',
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
                enabled: true,
                content: `PREDICCIÓN: $${predictedPrice.toLocaleString('en-US', {maximumFractionDigits: 2})}`,
                backgroundColor: 'rgba(0, 230, 195, 0.8)',
                font: { size: 12, family: 'Exo 2', weight: 'bold' },
                color: '#0a0e17',
                position: 'end',
                yAdjust: predictedPrice > currentPrice ? -10 : 10
            }
        });
    }

    // Añadir líneas horizontales para niveles de Fibonacci
    const maxPrice = Math.max(...historicalData.map(d => d.y));
    const minPrice = Math.min(...historicalData.map(d => d.y));
    const fibLevels = [
        { level: minPrice + (maxPrice - minPrice) * 0.236, label: '23.6%' },
        { level: minPrice + (maxPrice - minPrice) * 0.382, label: '38.2%' },
        { level: minPrice + (maxPrice - minPrice) * 0.5, label: '50%' },
        { level: minPrice + (maxPrice - minPrice) * 0.618, label: '61.8%' },
        { level: minPrice + (maxPrice - minPrice) * 0.786, label: '78.6%' }
    ];

    fibLevels.forEach((fib, index) => {
        annotations.push({
            type: 'line',
            yMin: fib.level,
            yMax: fib.level,
            borderColor: 'rgba(240, 185, 11, 0.5)', // Color dorado con opacidad
            borderWidth: 1,
            borderDash: [3, 3],
            label: {
                enabled: true,
                content: `${fib.label}: $${fib.level.toLocaleString('en-US', {maximumFractionDigits: 2})}`,
                backgroundColor: 'rgba(240, 185, 11, 0.7)',
                font: { size: 10, family: 'Exo 2', weight: 'normal' },
                color: '#0a0e17',
                position: 'start',
                yAdjust: index % 2 === 0 ? -10 : 10 // Alternar posición para evitar solapamiento
            }
        });
    });

    // Añadir predicciones históricas al gráfico
    let historicalPredictions = [];
    if (predictionHistory.length > 0) {
        historicalPredictions = predictionHistory.map(prediction => {
            const predictionDate = new Date(prediction.timestamp);
            const resultDate = new Date(prediction.timestamp);
            resultDate.setDate(resultDate.getDate() + parseInt(prediction.timeframe)/10);
            
            return {
                x: resultDate,
                y: prediction.actualPrice,
                prediction: prediction.predictedPrice,
                timestamp: prediction.timestamp
            };
        });
    }

    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Precio Real',
                    data: historicalData,
                    borderColor: '#f0b90b',
                    backgroundColor: 'rgba(240, 185, 11, 0.1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: true,
                    tension: 0.1
                },
                {
                    label: 'Predicción Áurea',
                    data: predictionData,
                    borderColor: 'var(--prediction-color)',
                    backgroundColor: 'rgba(0, 230, 195, 0.2)',
                    borderWidth: 4,
                    borderDash: [8, 4],
                    pointRadius: [0, 0], // Sin puntos en la línea de predicción
                    pointBackgroundColor: 'var(--prediction-color)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    fill: false,
                    tension: 0,
                    shadowOffsetX: 0,
                    shadowOffsetY: 4,
                    shadowBlur: 10,
                    shadowColor: 'rgba(0, 230, 195, 0.5)'
                },
                {
                    label: 'Predicciones Pasadas',
                    data: historicalPredictions,
                    pointBackgroundColor: 'rgba(255, 255, 255, 0.8)',
                    pointBorderColor: '#00e6c3',
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    showLine: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: 'rgba(200, 200, 200, 0.7)'
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += `$${context.parsed.y.toLocaleString('en-US', {maximumFractionDigits: 2})}`;
                            }
                            
                            // Información adicional para predicciones pasadas
                            if (context.datasetIndex === 2) {
                                const dataPoint = historicalPredictions[context.dataIndex];
                                const predictionDate = new Date(dataPoint.timestamp).toLocaleDateString();
                                label += `\nPredicho: $${dataPoint.prediction.toLocaleString('en-US', {maximumFractionDigits: 2})}`;
                                label += `\nFecha predicción: ${predictionDate}`;
                            }
                            
                            return label;
                        }
                    }
                },
                annotation: {
                    annotations: annotations
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: currentTimeframe === '7' ? 'hour' : 'day',
                        tooltipFormat: currentTimeframe === '7' ? 'MMM dd HH:mm' : 'MMM dd',
                        displayFormats: {
                            day: 'MMM dd',
                            hour: 'HH:mm'
                        }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: 'rgba(200, 200, 200, 0.7)',
                        maxTicksLimit: currentTimeframe === '7' ? 12 : 10
                    }
                },
                y: {
                    position: 'right',
                    min: minBound,
                    max: maxBound,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: 'rgba(200, 200, 200, 0.7)',
                        callback: function(value) {
                            return '$' + value.toLocaleString('en-US', {maximumFractionDigits: 0});
                        },
                        maxTicksLimit: 8
                    }
                }
            },
            animation: {
                duration: 500,
                easing: 'easeOutQuart'
            },
            hover: {
                mode: 'nearest',
                intersect: false
            }
        }
    });
}