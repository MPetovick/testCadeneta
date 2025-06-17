import { state } from './state.js';
import { renderInventory } from './inventory.js';
import { renderDashboard, renderPredictionChart } from './charts.js';
import { openProductModal, saveProduct } from './inventory.js';
import { updateForecast } from './forecast.js';
import { saveState } from './main.js';

function setCurrentDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').textContent = now.toLocaleDateString('es-ES', options);
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-menu li');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const sectionId = item.getAttribute('data-section');
            renderSection(sectionId);
        });
    });
    
    document.getElementById('logout-btn').addEventListener('click', () => {
        if (confirm('¿Estás seguro de cerrar sesión?')) {
            alert('Sesión cerrada');
        }
    });
}

function renderSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-menu li').forEach(item => {
        item.classList.remove('active');
    });
    
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('active');
    }
    
    const navItem = document.querySelector(`.nav-menu li[data-section="${sectionId}"]`);
    if (navItem) {
        navItem.classList.add('active');
    }
    
    state.currentSection = sectionId;
    
    if (sectionId === 'dashboard') {
        renderDashboard();
    } else if (sectionId === 'inventario') {
        renderInventory();
    } else if (sectionId === 'predicciones') {
        renderPredictionChart();
    }
}

function setupEventListeners() {
    document.querySelectorAll('.filter-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const filter = button.getAttribute('data-filter');
            renderInventory(filter);
        });
    });
    
    document.getElementById('add-product').addEventListener('click', () => openProductModal());
    
    document.getElementById('close-modal-btn').addEventListener('click', closeModal);
    document.getElementById('cancel-btn').addEventListener('click', closeModal);
    
    document.getElementById('product-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveProduct();
    });
    
    document.getElementById('search-product').addEventListener('input', (e) => {
        filterInventory(e.target.value);
    });
    
    document.getElementById('view-all-activity').addEventListener('click', () => {
        renderSection('movimientos');
    });
    
    document.querySelectorAll('.chart-actions button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.chart-actions button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            renderDashboard(button.getAttribute('data-period'));
        });
    });
    
    document.getElementById('horizon').addEventListener('change', (e) => {
        state.predictionSettings.horizon = parseInt(e.target.value);
        saveState();
        updateForecast();
        renderPredictionChart();
    });
    
    document.getElementById('apply-forecast').addEventListener('click', () => {
        renderPredictionChart();
    });
    
    document.addEventListener('new-sale', (e) => {
        if (state.forecastModel) {
            state.forecastModel.update(e.detail.sale);
            state.historicalSales.push(e.detail.sale);
            saveState();
            updateForecast();
            if (state.currentSection === 'predicciones') {
                renderPredictionChart();
            }
        }
    });
}

function filterInventory(searchTerm) {
    const filter = document.querySelector('.filter-btn.active')?.getAttribute('data-filter') || 'all';
    renderInventory(filter, searchTerm);
}

function closeModal() {
    const modal = document.getElementById('product-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.padding = '1rem';
    notification.style.borderRadius = '4px';
    notification.style.zIndex = '10000';
    notification.style.backgroundColor = type === 'error' ? 'rgba(231, 76, 60, 0.9)' : 'rgba(46, 204, 113, 0.9)';
    notification.style.color = 'white';
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

export { setCurrentDate, setupNavigation, renderSection, setupEventListeners, showNotification, closeModal, filterInventory };
