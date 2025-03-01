// Constantes y estado inicial
const matrix = JSON.parse(localStorage.getItem('crochetPattern')) || [];
const stitchSymbols = {
    cadeneta: '#', punt_baix: '•', punt_pla: '-', punt_mitja: '●',
    punt_alt: '↑', punt_doble_alt: '⇑', picot: '¤'
};
const stitchColors = {
    cadeneta: '#e74c3c', punt_baix: '#2ecc71', punt_pla: '#3498db',
    punt_mitja: '#f1c40f', punt_alt: '#9b59b6', punt_doble_alt: '#e67e22',
    picot: '#1abc9c'
};
const RING_SPACING = 50;
let canvasSize = 300; // Tamaño inicial pequeño
let scale = 1;
let targetScale = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let dragStartX, dragStartY;
let animationFrameId;
let history = [[]];
let historyIndex = 0;

// Elementos del DOM
const grid = document.getElementById('grid');
const canvas = document.getElementById('patternCanvas');
const ctx = canvas.getContext('2d');
const guideLinesInput = document.getElementById('guideLines');
const stitchMenu = document.getElementById('stitchMenu');
const exportText = document.getElementById('exportText');
const fullscreenToolbar = document.getElementById('fullscreenToolbar');
const newBtn = document.getElementById('newBtn');
const saveBtn = document.getElementById('saveBtn');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const saveFullBtn = document.getElementById('saveFullBtn');
const exitFullscreenBtn = document.getElementById('exitFullscreenBtn');

// Renderizado del canvas
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const centerX = canvas.width / 2 + offsetX;
    const centerY = canvas.height / 2 + offsetY;
    const guideLines = Math.max(4, Math.min(24, parseInt(guideLinesInput.value) || 8));
    const maxRings = Math.max(4, Math.max(...matrix.map(p => p.ring + 1)) || 1);

    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(offsetX / scale, offsetY / scale);

    // Fondo
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width / scale, canvas.height / scale);

    // Líneas guía
    ctx.strokeStyle = '#a0a0a0';
    ctx.lineWidth = 1 / scale;
    for (let i = 0; i < guideLines; i++) {
        const angle = (i / guideLines) * 2 * Math.PI;
        const x = centerX + (canvas.width / 2 / scale) * Math.cos(angle);
        const y = centerY + (canvas.height / 2 / scale) * Math.sin(angle);
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.stroke();
    }

    // Anillos
    ctx.strokeStyle = '#c0c0c0';
    for (let r = 1; r <= maxRings; r++) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r * RING_SPACING, 0, 2 * Math.PI);
        ctx.stroke();
    }

    // Puntos
    matrix.forEach(point => {
        const x = centerX + (point.ring * RING_SPACING) * Math.cos(point.angle);
        const y = centerY + (point.ring * RING_SPACING) * Math.sin(point.angle);
        ctx.fillStyle = stitchColors[point.stitch] || '#333';
        ctx.font = `${20 * scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(stitchSymbols[point.stitch], x, y);
    });

    ctx.restore();
}

// Manejo de clics para añadir o eliminar puntos
function handlePointPlacement(event, clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - offsetX) / scale;
    const y = (clientY - rect.top - offsetY) / scale;
    const guideLines = parseInt(guideLinesInput.value) || 8;

    const dx = x - canvas.width / 2;
    const dy = y - canvas.height / 2;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const ring = Math.round(distance / RING_SPACING);

    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += 2 * Math.PI;
    const segmentSize = 2 * Math.PI / guideLines;
    const segmentIndex = Math.round(angle / segmentSize);
    const snapAngle = segmentIndex * segmentSize;

    const pointX = canvas.width / 2 + ring * RING_SPACING * Math.cos(snapAngle);
    const pointY = canvas.height / 2 + ring * RING_SPACING * Math.sin(snapAngle);
    const tolerance = 15 / scale;

    const existingPointIndex = matrix.findIndex(point => {
        const px = canvas.width / 2 + point.ring * RING_SPACING * Math.cos(point.angle);
        const py = canvas.height / 2 + point.ring * RING_SPACING * Math.sin(point.angle);
        return Math.sqrt((pointX - px) ** 2 + (pointY - py) ** 2) < tolerance;
    });

    if (existingPointIndex >= 0) {
        matrix.splice(existingPointIndex, 1);
    } else {
        matrix.push({ ring, angle: snapAngle, stitch: stitchMenu.value });
    }

    history.push([...matrix]);
    historyIndex = history.length - 1;
    localStorage.setItem('crochetPattern', JSON.stringify(matrix));
    render();
}

// Exportación de la secuencia
function exportSequence() {
    const sequence = matrix.map(point => 
        `${point.stitch} (anillo ${point.ring}, ángulo ${Math.round(point.angle * 180 / Math.PI)}°)`)
        .join('; ');
    exportText.value = sequence || 'No hay puntos.';
    const blob = new Blob([exportText.value], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'patron_crochet.txt';
    link.click();
}

// Eventos para pantalla completa
grid.addEventListener('click', () => {
    grid.classList.remove('grid-small');
    grid.classList.add('grid-fullscreen');
    fullscreenToolbar.classList.remove('hidden');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    render();
});

exitFullscreenBtn.addEventListener('click', () => {
    grid.classList.remove('grid-fullscreen');
    grid.classList.add('grid-small');
    fullscreenToolbar.classList.add('hidden');
    canvas.width = 300;
    canvas.height = 300;
    render();
});

// Botones de acción
newBtn.addEventListener('click', () => {
    matrix.length = 0;
    history = [[]];
    historyIndex = 0;
    offsetX = 0;
    offsetY = 0;
    scale = 1;
    targetScale = 1;
    localStorage.setItem('crochetPattern', JSON.stringify(matrix));
    render();
});

saveBtn.addEventListener('click', exportSequence);
saveFullBtn.addEventListener('click', exportSequence);

undoBtn.addEventListener('click', () => {
    if (historyIndex > 0) {
        historyIndex--;
        matrix.splice(0, matrix.length, ...history[historyIndex]);
        localStorage.setItem('crochetPattern', JSON.stringify(matrix));
        render();
    }
});

redoBtn.addEventListener('click', () => {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        matrix.splice(0, matrix.length, ...history[historyIndex]);
        localStorage.setItem('crochetPattern', JSON.stringify(matrix));
        render();
    }
});

// Eventos de interacción con el canvas
canvas.addEventListener('click', (e) => {
    if (grid.classList.contains('grid-fullscreen')) {
        handlePointPlacement(e, e.clientX, e.clientY);
    }
});

// Inicialización
render();