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

const RING_SPACING = 50;
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let dragStartX, dragStartY;

const grid = document.getElementById('grid');
const guideLinesInput = document.getElementById('guideLines');
const selectedStitch = document.getElementById('stitch');
const exportBtn = document.getElementById('exportBtn');
const exportText = document.getElementById('exportText');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');

function render() {
    const canvas = document.createElement('canvas');
    const canvasSize = grid.clientWidth; // Tamaño responsivo
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    grid.innerHTML = '';
    grid.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const centerX = canvasSize / 2 + offsetX;
    const centerY = canvasSize / 2 + offsetY;
    const guideLines = Math.max(4, Math.min(24, parseInt(guideLinesInput.value) || 8));
    const maxRings = Math.max(4, Math.max(...matrix.map(p => p.ring + 1)) || 1);

    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(offsetX / scale, offsetY / scale);

    // Líneas guía
    ctx.strokeStyle = '#d3d3d3';
    ctx.lineWidth = 1 / scale;
    for (let i = 0; i < guideLines; i++) {
        const angle = (i / guideLines) * 2 * Math.PI;
        const x = centerX + (canvasSize / 2 / scale) * Math.cos(angle);
        const y = centerY + (canvasSize / 2 / scale) * Math.sin(angle);
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.stroke();
    }

    // Anillos
    ctx.strokeStyle = '#e0e0e0';
    for (let r = 1; r <= maxRings; r++) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r * RING_SPACING, 0, 2 * Math.PI);
        ctx.stroke();
    }

    // Puntos
    ctx.fillStyle = '#333';
    ctx.font = `${20 * scale}px Arial`;
    matrix.forEach(point => {
        const x = centerX + (point.ring * RING_SPACING) * Math.cos(point.angle);
        const y = centerY + (point.ring * RING_SPACING) * Math.sin(point.angle);
        ctx.fillText(stitchSymbols[point.stitch], x - 10 * scale, y + 6 * scale);
    });

    ctx.restore();

    // Eventos
    canvas.onclick = (e) => handleClick(e, guideLines, centerX, centerY, canvasSize);
    canvas.onmousedown = (e) => {
        isDragging = true;
        dragStartX = e.clientX - offsetX;
        dragStartY = e.clientY - offsetY;
    };
    canvas.onmousemove = (e) => {
        if (isDragging) {
            offsetX = e.clientX - dragStartX;
            offsetY = e.clientY - dragStartY;
            render();
        }
    };
    canvas.onmouseup = () => isDragging = false;
    canvas.onmouseleave = () => isDragging = false;
}

function handleClick(event, guideLines, centerX, centerY, canvasSize) {
    const rect = grid.firstChild.getBoundingClientRect();
    const x = (event.clientX - rect.left) / scale - offsetX / scale;
    const y = (event.clientY - rect.top) / scale - offsetY / scale;

    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const ring = Math.round(distance / RING_SPACING);
    if (ring < 1) return; // Evitar puntos en el centro

    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += 2 * Math.PI;

    const segmentSize = 2 * Math.PI / guideLines;
    const segmentIndex = Math.floor(angle / segmentSize);
    // Punto centrado en el segmento: mitad del anillo y mitad del ángulo
    const snapAngle = segmentIndex * segmentSize + segmentSize / 2;
    const snapRadius = (ring - 0.5) * RING_SPACING; // Mitad entre anillos

    const pointX = centerX + snapRadius * Math.cos(snapAngle);
    const pointY = centerY + snapRadius * Math.sin(snapAngle);
    const tolerance = 15 / scale;

    const existingPointIndex = matrix.findIndex(point => {
        const px = centerX + (point.ring - 0.5) * RING_SPACING * Math.cos(point.angle);
        const py = centerY + (point.ring - 0.5) * RING_SPACING * Math.sin(point.angle);
        return Math.sqrt((pointX - px) ** 2 + (pointY - py) ** 2) < tolerance;
    });

    if (existingPointIndex >= 0) {
        matrix.splice(existingPointIndex, 1);
    } else {
        matrix.push({ ring, angle: snapAngle, stitch: selectedStitch.value });
    }

    render();
}

function exportSequence() {
    const sequence = matrix.map(point => 
        `${point.stitch} (anillo ${point.ring}, ángulo ${Math.round(point.angle * 180 / Math.PI)}°)`)
        .join('; ');
    exportText.value = sequence || 'No hay puntos.';
}

// Eventos
guideLinesInput.oninput = render;
zoomInBtn.onclick = () => {
    scale *= 1.2;
    render();
};
zoomOutBtn.onclick = () => {
    scale = Math.max(0.5, scale / 1.2);
    render();
};
exportBtn.onclick = exportSequence;
window.onresize = render; // Ajustar al cambiar tamaño de ventana

// Inicialización
render();