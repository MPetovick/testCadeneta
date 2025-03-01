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
let canvasSize = Math.min(window.innerWidth * 0.8, 600); // Tamaño dinámico
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let dragStartX, dragStartY;
let pinchStartDist = 0;

// Elementos del DOM
const grid = document.getElementById('grid');
const guideLinesInput = document.getElementById('guideLines');
const selectedStitch = document.getElementById('stitch');
const exportBtn = document.getElementById('exportBtn');
const exportText = document.getElementById('exportText');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const resetBtn = document.getElementById('resetBtn');
const zoomLevel = document.getElementById('zoomLevel');

// Canvas persistente
const canvas = document.createElement('canvas');
canvas.width = canvasSize;
canvas.height = canvasSize;
grid.appendChild(canvas);
const ctx = canvas.getContext('2d');

// Ajustar tamaño del canvas al redimensionar la ventana
window.addEventListener('resize', () => {
    canvasSize = Math.min(window.innerWidth * 0.8, 600);
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    render();
});

// Funciones principales
function render() {
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    const centerX = canvasSize / 2 + offsetX;
    const centerY = canvasSize / 2 + offsetY;
    const guideLines = Math.max(4, Math.min(24, parseInt(guideLinesInput.value) || 8));
    const maxRings = Math.max(4, Math.max(...matrix.map(p => p.ring + 1)) || 1);

    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(offsetX / scale, offsetY / scale);

    // Fondo blanco para mejor contraste
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasSize / scale, canvasSize / scale);

    // Líneas guía
    ctx.strokeStyle = '#a0a0a0';
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
        ctx.fillText(stitchSymbols[point.stitch], x - 10 * scale, y + 6 * scale);
    });

    ctx.restore();
    updateZoomLabel();
}

function handleClick(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / scale - offsetX / scale;
    const y = (event.clientY - rect.top) / scale - offsetY / scale;
    const guideLines = parseInt(guideLinesInput.value) || 8;

    const dx = x - canvasSize / 2;
    const dy = y - canvasSize / 2;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const ring = Math.round(distance / RING_SPACING);

    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += 2 * Math.PI;

    const segmentSize = 2 * Math.PI / guideLines;
    const segmentIndex = Math.floor(angle / segmentSize);
    const snapAngle = segmentIndex * segmentSize + segmentSize / 2;

    const pointX = canvasSize / 2 + (ring * RING_SPACING) * Math.cos(snapAngle);
    const pointY = canvasSize / 2 + (ring * RING_SPACING) * Math.sin(snapAngle);
    const tolerance = 15 / scale;

    const existingPointIndex = matrix.findIndex(point => {
        const px = canvasSize / 2 + (point.ring * RING_SPACING) * Math.cos(point.angle);
        const py = canvasSize / 2 + (point.ring * RING_SPACING) * Math.sin(point.angle);
        return Math.sqrt((pointX - px) ** 2 + (pointY - py) ** 2) < tolerance;
    });

    if (existingPointIndex >= 0) {
        if (confirm('¿Eliminar este punto?')) {
            matrix.splice(existingPointIndex, 1);
        }
    } else {
        matrix.push({ ring, angle: snapAngle, stitch: selectedStitch.value });
    }

    localStorage.setItem('crochetPattern', JSON.stringify(matrix));
    render();
}

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

function updateZoomLabel() {
    zoomLevel.textContent = `Zoom: ${Math.round(scale * 100)}%`;
}

// Eventos para escritorio
guideLinesInput.oninput = () => {
    const val = parseInt(guideLinesInput.value);
    guideLinesInput.value = Math.max(4, Math.min(24, val));
    render();
};

zoomInBtn.onclick = () => {
    scale *= 1.2;
    render();
};

zoomOutBtn.onclick = () => {
    scale = Math.max(0.5, scale / 1.2);
    render();
};

resetBtn.onclick = () => {
    matrix.length = 0;
    offsetX = 0;
    offsetY = 0;
    scale = 1;
    localStorage.setItem('crochetPattern', JSON.stringify(matrix));
    render();
};

exportBtn.onclick = exportSequence;

canvas.onclick = handleClick;
canvas.onmousedown = (e) => {
    isDragging = true;
    dragStartX = e.clientX - offsetX;
    dragStartY = e.clientY - offsetY;
};
canvas.onmousemove = (e) => {
    if (isDragging) {
        offsetX = e.clientX - dragStartX;
        offsetY = e.clientY - dragStartY;
        requestAnimationFrame(render);
    }
};
canvas.onmouseup = () => isDragging = false;
canvas.onmouseleave = () => isDragging = false;

// Eventos para teclado
document.addEventListener('keydown', (e) => {
    if (e.key === '+') zoomInBtn.click();
    if (e.key === '-') zoomOutBtn.click();
});

// Eventos táctiles para smartphones
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
        isDragging = true;
        dragStartX = e.touches[0].clientX - offsetX;
        dragStartY = e.touches[0].clientY - offsetY;
    } else if (e.touches.length === 2) {
        isDragging = false;
        pinchStartDist = getPinchDistance(e.touches);
    }
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 1 && isDragging) {
        offsetX = e.touches[0].clientX - dragStartX;
        offsetY = e.touches[0].clientY - dragStartY;
        requestAnimationFrame(render);
    } else if (e.touches.length === 2) {
        const pinchDist = getPinchDistance(e.touches);
        if (pinchStartDist) {
            const pinchScale = pinchDist / pinchStartDist;
            scale = Math.max(0.5, scale * pinchScale);
            pinchStartDist = pinchDist;
            requestAnimationFrame(render);
        }
    }
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    isDragging = false;
    pinchStartDist = 0;
});

// Función auxiliar para calcular distancia entre dos toques
function getPinchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

// Doble toque para zoom
canvas.addEventListener('dblclick', () => {
    scale *= 1.5;
    render();
});
canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        let touchCount = 0;
        const checkDoubleTap = setInterval(() => {
            touchCount++;
            if (touchCount > 1) {
                scale *= 1.5;
                render();
                clearInterval(checkDoubleTap);
            }
            if (touchCount > 10) clearInterval(checkDoubleTap); // Timeout de 1s aprox
        }, 100);
    }
});

// Inicialización
render();