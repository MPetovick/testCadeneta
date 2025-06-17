export const state = {
    currentSection: 'dashboard',
    inventory: [],
    activities: [],
    stats: {
        totalValue: 0,
        productCount: 0,
        rotationRate: 0,
        alertCount: 0
    },
    charts: {
        demand: null,
        prediction: null,
        productChart1: null,
        productChart2: null
    },
    predictionSettings: {
        horizon: 3
    },
    historicalSales: [120, 150, 180, 140, 200, 170, 190, 210, 180, 200, 220, 250],
    forecastModel: null,
    forecast: [],
    forecastConfidence: []
};
