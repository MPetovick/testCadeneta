const canvas = document.getElementById('patternCanvas');
const ctx = canvas.getContext('2d');
const guideLinesInput = document.getElementById('guideLines');
const stitchSelect = document.getElementById('stitch');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const zoomLevel = document.getElementById('zoomLevel');
const resetBtn = document.getElementById('resetBtn');
const exportBtn = document.getElementById('exportBtn');
const exportText = document.getElementById('exportText');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');

// Estado
let pattern = JSON.parse(localStorage.getItem('crochetPattern')) || [];
let history = [[]];
let historyIndex = 0;
const stitchSymbols = {
    cadeneta: '#', punt_baix: '•', punt_pla: '-', punt_mitja: '●',
    punt_alt: '↑', punt_doble_alt: '⇑', picot: '¤'
};
const stitchColors = {
    cadeneta: '#e53e3e', punt_baix: '#48bb78', punt_pla: '#3182ce',
    punt_mitja: '#ecc94b', punt_alt: '#9f7aea', punt_doble_alt: '#ed8936',
    picot: '#38b2ac'
};
const RING_SPACING = 50;
let scale = 1;
let targetScale = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let dragStartX, dragStartY;
let pinchStartDist = 0;

// Renderizado
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const centerX = canvas.width / 2 + offsetX;
    const centerY = canvas.height / 2 + offsetY;
    const guideLines = Math.max(4, Math.min(24, parseInt(guideLinesInput.value) || 8));
    const maxRings = Math.max(4, Math.max(...pattern.map(p => p.ring + 1)) || 1);

    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(offsetX / scale, offsetY / scale);

    // Fondo
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width / scale, canvas.height / scale);

    // Líneas guía
    ctx.strokeStyle = '#a0aec0';
    ctx.lineWidth = 1 / scale;
    for (let i = 0; i < guideLines; i++) {
        const angle = (i / guideLines) * 2 * Math.PI;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + (canvas.width / 2 / scale) * Math.cos(angle), centerY + (canvas.width / 2 / scale) * Math.sin(angle));
        ctx.stroke();
    }

    // Anillos
    ctx.strokeStyle = '#cbd5e0';
    for (let r = 1; r <= maxRings; r++) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r * RING_SPACING, 0, 2 * Math.PI);
        ctx.stroke();
    }

    // Puntos
    pattern.forEach(point => {
        const x = centerX + point.ring * RING_SPACING * Math.cos(point.angle);
        const y = centerY + point.ring * RING_SPACING * Math.sin(point.angle);
        ctx.fillStyle = stitchColors[point.stitch];
        ctx.font = `${18 * scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(stitchSymbols[point.stitch], x, y);
    });

    ctx.restore();
    zoomLevel.textContent = `Zoom: ${Math.round(scale * 100)}%`;
}

// Añadir/eliminar puntos
function handlePoint(e, clientX, clientY) {
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
    const segmentIndex = Math.floor(angle / segmentSize);
    const snapAngle = segmentIndex * segmentSize + segmentSize / 2;

    const tolerance = 15 / scale;
    const existingIndex = pattern.findIndex(p => {
        const px = p.ring * RING_SPACING * Math.cos(p.angle);
        const py = p.ring * RING_SPACING * Math.sin(p.angle);
        return Math.hypot(px - (ring * RING_SPACING * Math.cos(snapAngle)), py - (ring * RING_SPACING * Math.sin(snapAngle))) < tolerance;
    });

    if (existingIndex >= 0) {
        pattern.splice(existingIndex, 1);
    } else {
        pattern.push({ ring, angle: snapAngle, stitch: stitchSelect.value });
    }
    updateHistory();
    render();
}

// Actualizar historial
function updateHistory() {
    if (historyIndex < history.length - 1) history.splice(historyIndex + 1);
    history.push([...pattern]);
    historyIndex++;
    localStorage.setItem('crochetPattern', JSON.stringify(pattern));
}

// Zoom suave
function animateZoom() {
    const diff = targetScale - scale;
    if (Math.abs(diff) > 0.01) {
        scale += diff * 0.1;
        render();
        requestAnimationFrame(animateZoom);
    } else {
        scale = targetScale;
        render();
    }
}

// Exportar
function exportPattern() {
    const text = pattern.map(p => `${p.stitch} (anillo ${p.ring}, ${Math.round(p.angle * 180 / Math.PI)}°)`).join('; ') || 'Sin puntos';
    exportText.value = text;
    const blob = new Blob([text], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'patron_crochet.txt';
    link.click();
}

// Eventos
guideLinesInput.oninput = () => {
    guideLinesInput.value = Math.max(4, Math.min(24, parseInt(guideLinesInput.value) || 8));
    render();
};

zoomInBtn.onclick = () => {
    targetScale = Math.min(3, targetScale * 1.2);
    animateZoom();
};

zoomOutBtn.onclick = () => {
    targetScale = Math.max(0.5, targetScale / 1.2);
    animateZoom();
};

canvas.onwheel = (e) => {
    e.preventDefault();
    targetScale *= e.deltaY > 0 ? 0.9 : 1.1;
    targetScale = Math.max(0.5, Math.min(3, targetScale));
    animateZoom();
};

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

canvas.onclick = (e) => !isDragging && handlePoint(e, e.clientX, e.clientY);

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
        handlePoint(e, e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 2) {
        isDragging = true;
        dragStartX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - offsetX;
        dragStartY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - offsetY;
        pinchStartDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 2) {
        if (isDragging) {
            offsetX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - dragStartX;
            offsetY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - dragStartY;
        }
        const pinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        targetScale = Math.max(0.5, Math.min(3, targetScale * (pinchDist / pinchStartDist)));
        pinchStartDist = pinchDist;
        render();
    }
});

canvas.addEventListener('touchend', () => isDragging = false);

resetBtn.onclick = () => {
    pattern = [];
    history = [[]];
    historyIndex = 0;
    offsetX = 0;
    offsetY = 0;
    scale = targetScale = 1;
    localStorage.setItem('crochetPattern', JSON.stringify(pattern));
    render();
};

exportBtn.onclick = exportPattern;

undoBtn.onclick = () => {
    if (historyIndex > 0) {
        historyIndex--;
        pattern = [...history[historyIndex]];
        localStorage.setItem('crochetPattern', JSON.stringify(pattern));
        render();
    }
};

redoBtn.onclick = () => {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        pattern = [...history[historyIndex]];
        localStorage.setItem('crochetPattern', JSON.stringify(pattern));
        render();
    }
};

// Guardado automático
setInterval(() => localStorage.setItem('crochetPattern', JSON.stringify(pattern)), 5000);

// Inicialización
render();