import { state } from './state.js';
import { initializeForecastModel, updateForecast } from './forecast.js';
import { loadSavedState, saveState } from './storage.js';
import { setCurrentDate, setupNavigation, renderSection, setupEventListeners, showNotification } from './ui.js';
import { setupFileHandlers, resetDropZone } from './fileHandlers.js';
import { renderInventory } from './inventory.js';
import { renderDashboard, renderPredictionChart } from './charts.js';

function initializeApp() {
    // Cargar datos guardados
    loadSavedState();
    
    // Configuración inicial
    setCurrentDate();
    setupNavigation();
    setupEventListeners();
    
    // Inicializar modelo de predicción
    initializeForecastModel();
    
    // Configurar manejadores de archivos
    setupFileHandlers();
    
    // Mostrar la sección activa
    renderSection('dashboard');
    
    // Actualizar área de carga
    resetDropZone();
}

// Iniciar la aplicación
document.addEventListener('DOMContentLoaded', initializeApp);

// Exportar funciones necesarias para otros módulos
export { state, saveState, showNotification, renderInventory, renderDashboard, renderPredictionChart, updateForecast };
