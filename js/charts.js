import { state } from './state.js';
import { calculateStats } from './inventory.js';
import Chart from 'chart.js/auto';

function renderDashboard(period = 'quarter') {
    calculateStats();
    
    const criticalProducts = document.getElementById('critical-products');
    if (criticalProducts) {
        criticalProducts.innerHTML = state.inventory
            .filter(p => p.status === 'critical' || p.status === 'warning')
            .slice(0, 3)
            .map(product => `
                <div class="critical-product">
                    <div class="product-info">
                        <span class="product-name">${product.name}</span>
                        <span class="product-stock">${product.stock} / ${product.max}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${product.status}" style="width: ${(product.stock / product.max) * 100}%"></div>
                    </div>
                    <span class="replenish">Reponer: ${product.replenish} unidades</span>
                </div>
            `).join('');
    }
    
    const recentActivity = document.getElementById('recent-activity');
    if (recentActivity) {
        recentActivity.innerHTML = state.activities
            .slice(0, 4)
            .map(activity => `
                <tr>
                    <td>${activity.product}</td>
                    <td><span class="badge ${activity.type.toLowerCase()}">${activity.type}</span></td>
                    <td>${activity.quantity}</td>
                    <td>${activity.date}</td>
                    <td><span class="status ${activity.status.toLowerCase()}">${activity.status}</span></td>
                </tr>
            `).join('');
    }
    
    // Renderizar gráficos
    renderDemandChart(period);
}

function renderDemandChart(period) {
    const ctx = document.getElementById('demand-chart')?.getContext('2d');
    if (!ctx) return;
    
    // Destruir gráfico anterior si existe
    if (state.charts.demand) {
        state.charts.demand.destroy();
    }
    
    // Datos según el periodo seleccionado
    let labels, data;
    switch (period) {
        case 'month':
            labels = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'];
            data = [120, 150, 180, 140];
            break;
        case 'quarter':
            labels = ['Ene', 'Feb', 'Mar'];
            data = [350, 420, 390];
            break;
        case 'year':
            labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            data = [1200, 1350, 1420, 1300, 1550, 1480, 1600, 1650, 1580, 1700, 1750, 1850];
            break;
        default:
            labels = [];
            data = [];
    }
    
    state.charts.demand = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Unidades Vendidas',
                data: data,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function renderPredictionChart() {
    const ctx = document.getElementById('prediction-chart')?.getContext('2d');
    if (!ctx) return;
    
    // Destruir gráfico anterior si existe
    if (state.charts.prediction) {
        state.charts.prediction.destroy();
    }
    
    // Generar etiquetas de tiempo
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const currentMonth = new Date().getMonth();
    const labels = Array.from({ length: state.predictionSettings.horizon }, (_, i) => {
        const monthIndex = (currentMonth + i + 1) % 12;
        return `${months[monthIndex]} ${new Date().getFullYear() + Math.floor((currentMonth + i + 1) / 12)}`;
    });
    
    state.charts.prediction = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Predicción de demanda',
                    data: state.forecast,
                    borderColor: '#9b59b6',
                    backgroundColor: 'rgba(155, 89, 182, 0.1)',
                    borderWidth: 3,
                    tension: 0.2,
                    fill: false
                },
                {
                    label: 'Límite inferior',
                    data: state.forecast.map(v => v * 0.85),
                    borderColor: '#e74c3c',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    pointRadius: 0
                },
                {
                    label: 'Límite superior',
                    data: state.forecast.map(v => v * 1.15),
                    borderColor: '#e74c3c',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Unidades estimadas'
                    }
                }
            }
        }
    });
}

export { renderDashboard, renderPredictionChart };
