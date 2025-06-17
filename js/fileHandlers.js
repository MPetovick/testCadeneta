import { state } from './state.js';
import { saveState, showNotification, renderInventory, renderDashboard } from './main.js';
import { calculateStats } from './inventory.js';

function setupFileHandlers() {
    const dropZone = document.getElementById('pdf-drop-zone');
    const fileInput = document.getElementById('pdf-upload');
    
    if (!dropZone || !fileInput) return;
    
    dropZone.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            processFile(e.target.files[0]);
        }
    });
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        
        if (e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type === 'application/pdf' || file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
                processFile(file);
            } else {
                showNotification('Por favor, sube un archivo PDF o TXT', 'error');
            }
        }
    });
    
    document.getElementById('export-data')?.addEventListener('click', exportInventory);
}

function processFile(file) {
    const dropZone = document.getElementById('pdf-drop-zone');
    const processing = document.getElementById('processing');
    
    if (!dropZone || !processing) return;
    
    dropZone.innerHTML = '';
    dropZone.appendChild(processing);
    processing.style.display = 'flex';
    
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        processPDF(file);
    } else if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
        processTXT(file);
    } else {
        processing.style.display = 'none';
        dropZone.innerHTML = `
            <div class="success-message" style="color: var(--danger);">
                <i class="fas fa-exclamation-circle fa-3x"></i>
                <h3>Formato no soportado</h3>
                <p>Por favor sube un PDF o TXT</p>
            </div>
        `;
        setTimeout(() => resetDropZone(), 3000);
    }
}

function processPDF(file) {
    const dropZone = document.getElementById('pdf-drop-zone');
    const processing = document.getElementById('processing');
    
    setTimeout(() => {
        const simulatedData = generateInventoryFromPDF(file.name);
        
        state.inventory = [...state.inventory, ...simulatedData];
        
        calculateStats();
        saveState();
        renderInventory();
        renderDashboard();
        
        processing.style.display = 'none';
        dropZone.innerHTML = `
            <div class="success-message">
                <i class="fas fa-check-circle fa-3x"></i>
                <h3>¡PDF procesado correctamente!</h3>
                <p>Se importaron ${simulatedData.length} productos</p>
            </div>
        `;
        
        setTimeout(() => resetDropZone(), 5000);
    }, 3000);
}

function processTXT(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        const simulatedData = parseTXTContent(content);
        
        state.inventory = [...state.inventory, ...simulatedData];
        
        calculateStats();
        saveState();
        renderInventory();
        renderDashboard();
        
        const dropZone = document.getElementById('pdf-drop-zone');
        const processing = document.getElementById('processing');
        processing.style.display = 'none';
        dropZone.innerHTML = `
            <div class="success-message">
                <i class="fas fa-check-circle fa-3x"></i>
                <h3>¡TXT procesado correctamente!</h3>
                <p>Se importaron ${simulatedData.length} productos</p>
            </div>
        `;
        
        setTimeout(() => resetDropZone(), 5000);
    };
    reader.readAsText(file, 'ISO-8859-1');
}

function parseTXTContent(text) {
    const lines = text.split('\n');
    const products = [];
    
    for (let i = 4; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        try {
            const codigo = line.substring(0, 10).trim();
            const familia = line.substring(10, 20).trim();
            const codigo2 = line.substring(20, 30).trim();
            const descripcion = line.substring(30, 60).trim();
            const dteMax = line.substring(60, 70).trim();
            const stockStr = line.substring(70, 80).trim();
            const mermes = line.substring(80, 90).trim();
            const stockMinStr = line.substring(90, 100).trim();
            
            const stock = parseFloat(stockStr.replace(',', '.'));
            const stockMin = parseFloat(stockMinStr.replace(',', '.'));
            
            if (!descripcion || isNaN(stock) || isNaN(stockMin)) continue;
            
            const maxStock = Math.max(stockMin * 2, stockMin + 20, 50);
            let status = 'ok';
            let replenish = 0;
            
            if (stock < stockMin) {
                status = 'critical';
                replenish = stockMin - stock + 10;
            } else if (stock < stockMin + 5) {
                status = 'warning';
                replenish = stockMin + 5 - stock;
            } else if (stock < stockMin + 10) {
                status = 'low';
                replenish = stockMin + 10 - stock;
            }
            
            products.push({
                id: state.inventory.length > 0 ? Math.max(...state.inventory.map(p => p.id)) + 1 : 1,
                name: descripcion,
                stock: stock,
                min: stockMin,
                max: maxStock,
                status: status,
                replenish: replenish,
                category: 'general',
                supplier: '',
                lastUpdate: new Date().toLocaleDateString('es-ES')
            });
        } catch (e) {
            console.error('Error parsing TXT line:', e);
        }
    }
    
    return products;
}

function resetDropZone() {
    const dropZone = document.getElementById('pdf-drop-zone');
    dropZone.innerHTML = `
        <i class="fas fa-file-alt fa-3x"></i>
        <h3>Arrastra tu PDF o TXT de LKBitronics aquí</h3>
        <p>o haz clic para seleccionar archivo</p>
        <div class="file-types">
            <span class="file-type">PDF</span>
            <span class="file-type">TXT</span>
        </div>
        <input type="file" id="pdf-upload" accept=".pdf,.txt" style="display: none;">
        <div class="processing" id="processing" style="display: none;">
            <div class="spinner"></div>
            <p>Procesando archivo...</p>
        </div>
    `;
    setupFileHandlers();
}

function generateInventoryFromPDF(fileName) {
    const products = [
        {
            id: state.inventory.length + 1,
            name: `Producto ${fileName.slice(0, 10)} #1`,
            stock: Math.floor(Math.random() * 50),
            min: 20,
            max: 100,
            status: 'low',
            replenish: 30,
            category: 'general',
            supplier: 'Importado'
        },
        {
            id: state.inventory.length + 2,
            name: `Producto ${fileName.slice(0, 10)} #2`,
            stock: Math.floor(Math.random() * 30),
            min: 15,
            max: 80,
            status: 'critical',
            replenish: 25,
            category: 'general',
            supplier: 'Importado'
        }
    ];
    return products;
}

function exportInventory() {
    const dataStr = JSON.stringify(state.inventory, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'inventory_export.json';
    link.click();
    URL.revokeObjectURL(url);
}

export { setupFileHandlers, resetDropZone };
