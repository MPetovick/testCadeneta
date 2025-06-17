import { state } from './state.js';

const STORAGE_KEYS = {
    INVENTORY: 'stockmaster_inventory',
    ACTIVITIES: 'stockmaster_activities',
    SETTINGS: 'stockmaster_settings',
    HISTORICAL_SALES: 'stockmaster_historical_sales'
};

function getDefaultInventory() {
    return [
        { id: 1, name: 'Marlboro Rojo', stock: 15, min: 20, max: 100, status: 'warning', replenish: 35, category: 'tabaco', supplier: 'Tabacalera S.A.' },
        { id: 2, name: 'Fortuna Azul', stock: 45, min: 30, max: 120, status: 'low', replenish: 15, category: 'tabaco', supplier: 'Tabacalera S.A.' },
        { id: 3, name: 'Lotería Nacional', stock: 85, min: 50, max: 200, status: 'ok', replenish: 0, category: 'lotería', supplier: 'Loterías del Estado' },
        { id: 4, name: 'Café Cortado', stock: 8, min: 10, max: 50, status: 'critical', replenish: 22, category: 'bebidas', supplier: 'Nescafé' },
        { id: 5, name: 'Chicles Orbit', stock: 35, min: 20, max: 80, status: 'ok', replenish: 0, category: 'snacks', supplier: 'Wrigley' },
        { id: 6, name: 'Fortuna', stock: 25, min: 25, max: 100, status: 'warning', replenish: 15, category: 'tabaco', supplier: 'Tabacalera S.A.' },
        { id: 7, name: 'Tabaco de liar', stock: 12, min: 15, max: 60, status: 'critical', replenish: 28, category: 'tabaco', supplier: 'Golden Virginia' },
        { id: 8, name: 'Billetes de lotería', stock: 95, min: 50, max: 200, status: 'ok', replenish: 0, category: 'lotería', supplier: 'Loterías del Estado' }
    ];
}

function getDefaultActivities() {
    return [
        { product: 'Marlboro Roja', type: 'Venta', quantity: 5, date: '15/06/2025', status: 'Completado' },
        { product: 'Lotería Nacional', type: 'Recarga', quantity: 100, date: '14/06/2025', status: 'Completado' },
        { product: 'Café Cortado', type: 'Venta', quantity: 12, date: '14/06/2025', status: 'Completado' },
        { product: 'Fortuna Azul', type: 'Pedido', quantity: 50, date: '13/06/2025', status: 'En camino' }
    ];
}

function loadSavedState() {
    const savedInventory = localStorage.getItem(STORAGE_KEYS.INVENTORY);
    state.inventory = savedInventory ? JSON.parse(savedInventory) : getDefaultInventory();
    
    const savedActivities = localStorage.getItem(STORAGE_KEYS.ACTIVITIES);
    state.activities = savedActivities ? JSON.parse(savedActivities) : getDefaultActivities();
    
    const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (savedSettings) {
        state.predictionSettings = JSON.parse(savedSettings);
        document.getElementById('horizon').value = state.predictionSettings.horizon;
    }
    
    const savedHistorical = localStorage.getItem(STORAGE_KEYS.HISTORICAL_SALES);
    state.historicalSales = savedHistorical ? JSON.parse(savedHistorical) : state.historicalSales;
}

function saveState() {
    localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(state.inventory));
    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(state.activities));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(state.predictionSettings));
    localStorage.setItem(STORAGE_KEYS.HISTORICAL_SALES, JSON.stringify(state.historicalSales));
}

export { loadSavedState, saveState, STORAGE_KEYS, getDefaultInventory, getDefaultActivities };
