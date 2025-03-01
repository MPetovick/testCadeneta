const matrix = [];
const stitchSymbols = {
    cadeneta: '#',
    punt_baix: '•',
    punt_pla: '-',
    punt_mitja: '●',
    punt_alt: '↑',
    punt_doble_alt: '⇑',
    picot: '¤'
};

const grid = document.getElementById('grid');
const guideLinesInput = document.getElementById('guideLines');
const selectedStitch = document.getElementById('stitch');
const exportBtn = document.getElementById('exportBtn');
const exportText = document.getElementById('exportText');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');

const CANVAS_SIZE = 600;
const RING_SPACING = 50;
let scale = 1; // Escala inicial (zoom)
let offsetX = 0; // Desplazamiento en X
let offsetY = 0; // Desplazamiento en Y
let isDragging = false;
let startX, startY;

function createCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    return canvas;
}

function drawGuidelines(ctx, guideAngles) {
    ctx.strokeStyle = '#d3d3d3';
    ctx.lineWidth = 1 / scale; // Ajustar grosor con zoom
    const centerX = CANVAS_SIZE / 2 + offsetX;
    const centerY = CANVAS_SIZE / 2 + offsetY;

    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, CANVAS_SIZE);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(CANVAS_SIZE, centerY);
    ctx.stroke();

    for (let i = 0; i < guideAngles; i++) {
        const angle = (i / guideAngles) * 2 * Math.PI;
        const x = centerX + (CANVAS_SIZE / 2 / scale) * Math.cos(angle);
        const y = centerY + (CANVAS_SIZE / 2 / scale) * Math.sin(angle);
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.stroke();
    }
}

function drawRings(ctx, maxRings) {
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1 / scale;
    const centerX = CANVAS_SIZE / 2 + offsetX;
    const centerY = CANVAS_SIZE / 2 + offsetY;

    for (let r = 1; r <= maxRings; r++) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r * RING_SPACING * scale, 0, 2 * Math.PI);
        ctx.stroke();
    }
}

function drawPoints(ctx) {
    ctx.fillStyle = '#333';
    ctx.font = `${24 * scale}px Arial`; // Tamaño ajustado al zoom
    const centerX = CANVAS_SIZE / 2 + offsetX;
    const centerY = CANVAS_SIZE / 2 + offsetY;

    matrix.forEach(point => {
        const x = centerX + (point.ring * RING_SPACING * scale) * Math.cos(point.angle);
        const y = centerY + (point.ring * RING_SPACING * scale) * Math.sin(point.angle);
        ctx.fillText(stitchSymbols[point.stitch], x - 12 * scale, y + 8 * scale);
    });
}

function renderGrid() {
    grid.innerHTML = '';
    const canvas = createCanvas();
    grid.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    ctx.scale(scale, scale); // Aplicar escala
    ctx.translate(offsetX / scale, offsetY / scale); // Aplicar desplazamiento

    const guideAngles = parseInt(guideLinesInput.value) || 8;
    const maxRings = Math.max(Math.ceil(CANVAS_SIZE / 2 / RING_SPACING / scale), 
                             Math.max(...matrix.map(p => p.ring + 1)) || 1);

    drawGuidelines(ctx, guideAngles);
    drawRings(ctx, maxRings);
    drawPoints(ctx);

    setupCanvasEvents(canvas, guideAngles);
}

function handleClick(event, guideAngles) {
    const rect = grid.firstChild.getBoundingClientRect();
    const x = (event.clientX - rect.left - offsetX) / scale;
    const y = (event.clientY - rect.top - offsetY) / scale;
    const centerX = CANVAS_SIZE / 2;
    const centerY = CANVAS_SIZE / 2;

    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const ring = Math.round(distance / RING_SPACING);

    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += 2 * Math.PI;

    const segmentSize = 2 * Math.PI / guideAngles;
    const segmentIndex = Math.floor(angle / segmentSize);
    // Ajustar ángulo para que esté dentro del segmento, no solo en el centro
    const baseAngle = segmentIndex * segmentSize;
    const relativeAngle = (angle - baseAngle) / segmentSize; // 0 a 1 dentro del segmento
    const snapAngle = baseAngle + segmentSize * Math.min(Math.max(relativeAngle, 0.1), 0.9); // Limitar a 10%-90% del segmento

    const clickedX = centerX + (ring * RING_SPACING) * Math.cos(snapAngle);
    const clickedY = centerY + (ring * RING_SPACING) * Math.sin(snapAngle);
    const tolerance = 15 / scale;

    const existingPointIndex = matrix.findIndex(point => {
        const pointX = centerX + (point.ring * RING_SPACING) * Math.cos(point.angle);
        const pointY = centerY + (point.ring * RING_SPACING) * Math.sin(point.angle);
        return Math.sqrt((clickedX - pointX) ** 2 + (clickedY - pointY) ** 2) < tolerance;
    });

    if (existingPointIndex >= 0) {
        matrix.splice(existingPointIndex, 1);
    } else {
        matrix.push({ ring, angle: snapAngle, stitch: selectedStitch.value });
    }

    renderGrid();
}

function setupCanvasEvents(canvas, guideAngles) {
    canvas.onclick = (event) => handleClick(event, guideAngles);

    canvas.onmousedown = (event) => {
        isDragging = true;
        startX = event.clientX - offsetX;
        startY = event.clientY - offsetY;
    };

    canvas.onmousemove = (event) => {
        if (isDragging) {
            offsetX = event.clientX - startX;
            offsetY = event.clientY - startY;
            renderGrid();
        }
    };

    canvas.onmouseup = () => isDragging = false;
    canvas.onmouseleave = () => isDragging = false;
}

function exportSequence() {
    const sequence = matrix.map(point => 
        `${point.stitch} (anillo ${point.ring}, ángulo ${Math.round(point.angle * 180 / Math.PI)}°)`)
        .join('; ');
    exportText.value = sequence || 'No hay puntos en la cuadrícula.';
}

// Eventos
guideLinesInput.onchange = renderGrid;
exportBtn.onclick = exportSequence;
zoomInBtn.onclick = () => { scale *= 1.2; renderGrid(); };
zoomOutBtn.onclick = () => { scale /= 1.2; renderGrid(); };

// Inicialización
renderGrid();