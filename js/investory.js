import { state } from './state.js';
import { saveState, showNotification, renderDashboard } from './main.js';

function calculateStats() {
    const totalSales = state.activities
        .filter(a => a.type === 'Venta')
        .reduce((sum, sale) => sum + sale.quantity, 0);
    
    const avgInventory = state.inventory.reduce((sum, product) => sum + product.stock, 0) / state.inventory.length;
    
    state.stats = {
        totalValue: state.inventory.reduce((sum, product) => sum + (product.stock * 5.5), 0),
        productCount: state.inventory.length,
        rotationRate: avgInventory > 0 ? (totalSales / avgInventory).toFixed(2) : 0,
        alertCount: state.inventory.filter(p => p.status === 'critical' || p.status === 'warning').length
    };
    
    document.getElementById('total-value').textContent = `€${state.stats.totalValue.toFixed(2)}`;
    document.getElementById('product-count').textContent = state.stats.productCount;
    document.getElementById('rotation-rate').textContent = state.stats.rotationRate;
    document.getElementById('alert-count').textContent = state.stats.alertCount;
}

function renderInventory(filter = 'all', searchTerm = '') {
    const tbody = document.getElementById('inventory-body');
    if (!tbody) return;

    let filteredInventory = [...state.inventory];
    
    if (filter !== 'all') {
        filteredInventory = filteredInventory.filter(product => product.status === filter);
    }
    
    if (searchTerm) {
        filteredInventory = filteredInventory.filter(product => 
            product.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }
    
    tbody.innerHTML = filteredInventory.map(product => `
        <tr>
            <td>${product.name}</td>
            <td>${product.stock}</td>
            <td>${product.min}</td>
            <td>${product.max}</td>
            <td><span class="status ${product.status}">${product.status.charAt(0).toUpperCase() + product.status.slice(1)}</span></td>
            <td>${product.replenish > 0 ? `${product.replenish} unidades` : '-'}</td>
            <td>
                <button class="action-btn edit-btn" data-id="${product.id}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn delete-btn" data-id="${product.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
    
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const product = state.inventory.find(p => p.id === parseInt(btn.dataset.id));
            openProductModal(product);
        });
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (confirm('¿Seguro que quieres eliminar este producto?')) {
                state.inventory = state.inventory.filter(p => p.id !== parseInt(btn.dataset.id));
                saveState();
                calculateStats();
                renderInventory(filter, searchTerm);
                renderDashboard();
            }
        });
    });
}

function openProductModal(product = null) {
    const modal = document.getElementById('product-modal');
    const form = document.getElementById('product-form');
    const title = document.getElementById('modal-title');
    
    if (!modal || !form || !title) return;
    
    modal.classList.add('active');
    title.textContent = product ? 'Editar Producto' : 'Añadir Nuevo Producto';
    
    if (product) {
        document.getElementById('product-id').value = product.id;
        document.getElementById('product-name').value = product.name;
        document.getElementById('current-stock').value = product.stock;
        document.getElementById('min-stock').value = product.min;
        document.getElementById('max-stock').value = product.max;
        document.getElementById('category').value = product.category;
        document.getElementById('supplier').value = product.supplier || '';
    } else {
        form.reset();
        document.getElementById('product-id').value = '';
    }
}

function saveProduct() {
    const id = document.getElementById('product-id').value;
    const product = {
        id: id ? parseInt(id) : state.inventory.length + 1,
        name: document.getElementById('product-name').value,
        stock: parseInt(document.getElementById('current-stock').value),
        min: parseInt(document.getElementById('min-stock').value),
        max: parseInt(document.getElementById('max-stock').value),
        category: document.getElementById('category').value,
        supplier: document.getElementById('supplier').value,
        status: 'ok',
        replenish: 0
    };
    
    if (product.stock < product.min) {
        product.status = 'critical';
        product.replenish = product.min - product.stock + 10;
    } else if (product.stock < product.min + 5) {
        product.status = 'warning';
        product.replenish = product.min + 5 - product.stock;
    } else if (product.stock < product.min + 10) {
        product.status = 'low';
        product.replenish = product.min + 10 - product.stock;
    }
    
    if (id) {
        const index = state.inventory.findIndex(p => p.id === parseInt(id));
        state.inventory[index] = product;
    } else {
        state.inventory.push(product);
    }
    
    saveState();
    calculateStats();
    renderInventory();
    renderDashboard();
    document.getElementById('product-modal').classList.remove('active');
}

export { renderInventory, openProductModal, saveProduct, calculateStats };
