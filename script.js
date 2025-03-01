const CANVAS_SIZE = 400;
const CENTER = CANVAS_SIZE / 2;
const RING_SPACING = 50;
const GUIDE_ANGLES = 8;
const MAX_RINGS = Math.ceil(CENTER / RING_SPACING);

let matrix = [];
const stitchSymbols = {
    cadeneta: '#',
    punt_baix: '•',
    punt_pla: '-',
    punt_mitja: '●',
    punt_alt: '↑',
    punt_doble_alt: '⇑',
    picot: '¤'
};

// Elementos del DOM
const grid = document.getElementById('grid');
const selectedStitch = document.getElementById('stitch');
const exportBtn = document.getElementById('exportBtn');
const exportText = document.getElementById('exportText');

// Configuración de canvas
const backgroundCanvas = document.createElement('canvas');
const pointsCanvas = document.createElement('canvas');

function initializeCanvases() {
    [backgroundCanvas, pointsCanvas].forEach(canvas => {
        canvas.width = CANVAS_SIZE;
        canvas.height = CANVAS_SIZE;
        canvas.style.position = 'absolute';
    });
    
    grid.replaceChildren(backgroundCanvas, pointsCanvas);
    drawBackground();
    addEventListeners();
}

function drawBackground() {
    const ctx = backgroundCanvas.getContext('2d');
    
    // Estilo base
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    
    // Ejes principales
    ctx.beginPath();
    ctx.moveTo(CENTER, 0);
    ctx.lineTo(CENTER, CANVAS_SIZE);
    ctx.moveTo(0, CENTER);
    ctx.lineTo(CANVAS_SIZE, CENTER);
    ctx.stroke();

    // Guías angulares
    const angleStep = (2 * Math.PI) / GUIDE_ANGLES;
    for (let i = 0; i < GUIDE_ANGLES; i++) {
        const angle = i * angleStep;
        const x = CENTER + CENTER * Math.cos(angle);
        const y = CENTER + CENTER * Math.sin(angle);
        ctx.beginPath();
        ctx.moveTo(CENTER, CENTER);
        ctx.lineTo(x, y);
        ctx.stroke();
    }

    // Anillos concéntricos
    ctx.strokeStyle = '#ddd';
    for (let ring = 1; ring <= MAX_RINGS; ring++) {
        ctx.beginPath();
        ctx.arc(CENTER, CENTER, ring * RING_SPACING, 0, 2 * Math.PI);
        ctx.stroke();
    }
}

function renderPoints() {
    const ctx = pointsCanvas.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    
    ctx.fillStyle = '#000';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    matrix.forEach(point => {
        const radius = point.ring * RING_SPACING;
        const x = CENTER + radius * Math.cos(point.angle);
        const y = CENTER + radius * Math.sin(point.angle);
        ctx.fillText(stitchSymbols[point.stitch], x, y);
    });
}

function handleClick(event) {
    const rect = pointsCanvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    
    const dx = clickX - CENTER;
    const dy = clickY - CENTER;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const ring = Math.min(Math.round(distance / RING_SPACING), MAX_RINGS);
    if (ring === 0) return;  // Ignorar clic en el centro
    
    let angle = Math.atan2(dy, dx);
    angle = Math.round(angle * GUIDE_ANGLES / (2 * Math.PI)) * (2 * Math.PI / GUIDE_ANGLES);
    if (angle < 0) angle += 2 * Math.PI;

    matrix.push({ ring, angle, stitch: selectedStitch.value });
    renderPoints();
}

function exportSequence() {
    exportText.value = matrix.map(point => 
        `${point.stitch} (anillo ${point.ring}, ángulo ${Math.round(point.angle * 180 / Math.PI)}°)`
    ).join(';\n') || 'No hay puntos en la cuadrícula.';
    
    exportText.style.display = 'block';
}

function addEventListeners() {
    pointsCanvas.addEventListener('click', handleClick);
    exportBtn.addEventListener('click', exportSequence);
}

// Inicialización
initializeCanvases();