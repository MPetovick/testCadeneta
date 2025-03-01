let matrix = [];
let grid = document.getElementById('grid');
let selectedStitch = document.getElementById('stitch');
let exportBtn = document.getElementById('exportBtn');
let exportText = document.getElementById('exportText');

const stitchSymbols = {
    cadeneta: '#',
    punt_baix: '•',
    punt_pla: '-',
    punt_mitja: '●',
    punt_alt: '↑',
    punt_doble_alt: '⇑',
    picot: '¤'
};

function renderGrid() {
    grid.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    grid.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const centerX = 200;
    const centerY = 200;
    const ringSpacing = 50;
    const maxRings = Math.ceil(200 / ringSpacing);

    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;

    // Línea vertical
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, 400);
    ctx.stroke();

    // Línea horizontal
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(400, centerY);
    ctx.stroke();

    // Líneas diagonales (8 en total)
    for (let i = 0; i < 8; i++) {
        let angle = (i / 8) * 2 * Math.PI;
        let x = centerX + 200 * Math.cos(angle);
        let y = centerY + 200 * Math.sin(angle);
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.stroke();
    }

    // Anillos
    ctx.strokeStyle = '#ddd';
    for (let r = 1; r <= maxRings; r++) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r * ringSpacing, 0, 2 * Math.PI);
        ctx.stroke();
    }

    // Puntos existentes
    ctx.fillStyle = '#000';
    matrix.forEach(point => {
        let x = centerX + (point.ring * ringSpacing) * Math.cos(point.angle);
        let y = centerY + (point.ring * ringSpacing) * Math.sin(point.angle);
        ctx.font = '20px Arial';
        ctx.fillText(stitchSymbols[point.stitch], x - 10, y + 10);
    });

    canvas.onclick = handleClick;
}

function handleClick(event) {
    const rect = grid.firstChild.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const centerX = 200;
    const centerY = 200;
    const ringSpacing = 50;

    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const ring = Math.round(distance / ringSpacing);

    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += 2 * Math.PI;

    const guideAngles = 8;
    const snapAngle = Math.round((angle / (2 * Math.PI)) * guideAngles) * (2 * Math.PI / guideAngles);

    matrix.push({ ring, angle: snapAngle, stitch: selectedStitch.value });
    renderGrid();
}

function exportSequence() {
    let sequence = '';
    matrix.forEach(point => {
        sequence += `${point.stitch} (anillo ${point.ring}, ángulo ${Math.round(point.angle * 180 / Math.PI)}°); `;
    });
    exportText.value = sequence || 'No hay puntos en la cuadrícula.';
    exportText.style.display = 'block';
}

exportBtn.onclick = exportSequence;
renderGrid();