import { state } from './state.js';
import { saveState } from './main.js';

class HoltWinters {
    constructor(alpha = 0.2, beta = 0.1, gamma = 0.3, seasonality = 12) {
        this.alpha = alpha;
        this.beta = beta;
        this.gamma = gamma;
        this.seasonality = seasonality;
        this.level = 0;
        this.trend = 0;
        this.seasons = [];
    }

    initialize(series) {
        if (series.length < this.seasonality) {
            throw new Error("Se requieren al menos un año de datos");
        }

        this.level = series[0];
        this.trend = (series[this.seasonality] - series[0]) / this.seasonality;
        
        this.seasons = Array(this.seasonality).fill(0);
        for (let i = 0; i < this.seasonality; i++) {
            this.seasons[i] = series[i] - this.level;
        }
    }

    forecast(steps) {
        const predictions = [];
        let level = this.level;
        let trend = this.trend;
        const seasons = [...this.seasons];

        for (let i = 0; i < steps; i++) {
            const seasonIndex = (this.seasons.length - this.seasonality + i + 1) % this.seasonality;
            const prediction = level + (i + 1) * trend + seasons[seasonIndex];
            predictions.push(Math.max(0, prediction));
        }
        
        return predictions;
    }

    update(observation) {
        const prevLevel = this.level;
        const prevTrend = this.trend;
        const prevSeason = this.seasons.shift();

        this.level = this.alpha * (observation - prevSeason) + (1 - this.alpha) * (prevLevel + prevTrend);
        this.trend = this.beta * (this.level - prevLevel) + (1 - this.beta) * prevTrend;
        const newSeason = this.gamma * (observation - this.level) + (1 - this.gamma) * prevSeason;
        this.seasons.push(newSeason);
    }
}

function initializeForecastModel() {
    if (state.historicalSales.length < 12) {
        console.warn("No hay suficientes datos para inicializar el modelo de predicción (se requieren 12 meses)");
        return;
    }

    try {
        state.forecastModel = new HoltWinters(0.2, 0.1, 0.1, 12);
        state.forecastModel.initialize(state.historicalSales);
        updateForecast();
    } catch (e) {
        console.error("Error al inicializar el modelo de predicción:", e);
    }
}

function updateForecast() {
    if (!state.forecastModel) return;

    state.forecast = state.forecastModel.forecast(state.predictionSettings.horizon);
    state.forecastConfidence = state.forecast.map(value => [
        Math.max(0, Math.round(value * 0.85)),
        Math.round(value * 1.15)
    ]);
    saveState();
}

export { initializeForecastModel, updateForecast, HoltWinters };
