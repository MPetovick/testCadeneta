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

const CANVAS_SIZE = 600;
const CENTER = CANVAS_SIZE / 2;
const RING_SPACING = 50;

function createCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    return canvas;
}

function drawGuidelines(ctx, guideAngles) {
    ctx.strokeStyle = '#d3d3d3';
    ctx.lineWidth = 1;

    // Líneas principales (vertical y horizontal)
    ctx.beginPath();
    ctx.moveTo(CENTER, 0);
    ctx.lineTo(CENTER, CANVAS_SIZE);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, CENTER);
    ctx.lineTo(CANVAS_SIZE, CENTER);
    ctx.stroke();

    // Líneas diagonales
    for (let i = 0; i < guideAngles; i++) {
        const angle = (i / guideAngles) * 2 * Math.PI;
        const x = CENTER + (CANVAS_SIZE / 2) * Math.cos(angle);
        const y = CENTER + (CANVAS_SIZE / 2) * Math.sin(angle);
        ctx.beginPath();
        ctx.moveTo(CENTER, CENTER);
        ctx.lineTo(x, y);
        ctx.stroke();
    }
}

function drawRings(ctx, maxRings) {
    ctx.strokeStyle = '#e0e0e0';
    for (let r = 1; r <= maxRings; r++) {
        ctx.beginPath();
        ctx.arc(CENTER, CENTER, r * RING_SPACING, 0, 2 * Math.PI);
        ctx.stroke();
    }
}

function drawPoints(ctx) {
    ctx.fillStyle = '#333';
    ctx.font = '24px Arial';
    matrix.forEach(point => {
        const x = CENTER + (point.ring * RING_SPACING) * Math.cos(point.angle);
        const y = CENTER + (point.ring * RING_SPACING) * Math.sin(point.angle);
        ctx.fillText(stitchSymbols[point.stitch], x - 12, y + 8);
    });
}

function renderGrid() {
    grid.innerHTML = '';
    const canvas = createCanvas();
    grid.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const guideAngles = parseInt(guideLinesInput.value) || 8;
    const maxRings = Math.max(Math.ceil(CENTER / RING_SPACING), Math.max(...matrix.map(p => p.ring + 1)) || 1);

    drawGuidelines(ctx, guideAngles);
    drawRings(ctx, maxRings);
    drawPoints(ctx);

    canvas.onclick = (event) => handleClick(event, guideAngles);
}

function handleClick(event, guideAngles) {
    const rect = grid.firstChild.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const dx = x - CENTER;
    const dy = y - CENTER;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const ring = Math.round(distance / RING_SPACING);

    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += 2 * Math.PI;

    const segmentSize = 2 * Math.PI / guideAngles;
    const segmentIndex = Math.floor(angle / segmentSize);
    const snapAngle = segmentIndex * segmentSize + segmentSize / 2;

    const clickedX = CENTER + (ring * RING_SPACING) * Math.cos(snapAngle);
    const clickedY = CENTER + (ring * RING_SPACING) * Math.sin(snapAngle);
    const tolerance = 15;

    const existingPointIndex = matrix.findIndex(point => {
        const pointX = CENTER + (point.ring * RING_SPACING) * Math.cos(point.angle);
        const pointY = CENTER + (point.ring * RING_SPACING) * Math.sin(point.angle);
        return Math.sqrt((clickedX - pointX) ** 2 + (clickedY - pointY) ** 2) < tolerance;
    });

    if (existingPointIndex >= 0) {
        matrix.splice(existingPointIndex, 1); // Borrar punto
    } else {
        matrix.push({ ring, angle: snapAngle, stitch: selectedStitch.value }); // Añadir punto
    }

    renderGrid();
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

// Inicialización
renderGrid();