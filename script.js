let numRings = 3;
let matrix = generarMatrizRadial(numRings);
let grid = document.getElementById('grid');
let selectedStitch = document.getElementById('stitch');
let exportBtn = document.getElementById('exportBtn');
let exportText = document.getElementById('exportText');

// Mapa de símbolos para cada punto
const stitchSymbols = {
    cadeneta: '#',
    punt_baix: '•',
    punt_pla: '-',
    punt_mitja: '●',
    punt_alt: '↑',
    punt_doble_alt: '⇑',
    picot: '¤'
};

// Generar matriz radial
function generarMatrizRadial(rings) {
    let radialMatrix = [];
    for (let r = 0; r < rings; r++) {
        let puntosEnAnillo = 6 * (r + 1);
        radialMatrix.push(Array(puntosEnAnillo).fill(''));
    }
    return radialMatrix;
}

// Renderizar cuadrícula radial
function renderGrid() {
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = '';
    grid.style.position = 'relative';
    grid.style.width = '400px';
    grid.style.height = '400px';

    const centerX = 200;
    const centerY = 200;
    const ringSpacing = 50;

    for (let r = 0; r < matrix.length; r++) {
        let puntosEnAnillo = matrix[r].length;
        let radius = ringSpacing * (r + 1);
        for (let p = 0; p < puntosEnAnillo; p++) {
            let angle = (p / puntosEnAnillo) * 2 * Math.PI;
            let x = centerX + radius * Math.cos(angle) - 20;
            let y = centerY + radius * Math.sin(angle) - 20;

            let cell = document.createElement('div');
            cell.className = 'cell';
            cell.style.position = 'absolute';
            cell.style.left = `${x}px`;
            cell.style.top = `${y}px`;
            cell.style.width = '40px';
            cell.style.height = '40px';
            cell.style.lineHeight = '40px';
            cell.textContent = matrix[r][p] ? stitchSymbols[matrix[r][p]] : '';
            cell.onclick = () => addStitch(r, p);
            grid.appendChild(cell);
        }
    }
}

// Añadir punto y verificar expansión
function addStitch(ring, pos) {
    matrix[ring][pos] = selectedStitch.value;
    checkExpansion(ring);
    renderGrid();
}

// Verificar si hay que expandir la matriz
function checkExpansion(ring) {
    if (ring === matrix.length - 1) {
        let puntosNuevoAnillo = matrix[matrix.length - 1].length + 6;
        matrix.push(Array(puntosNuevoAnillo).fill(''));
    }
}

// Exportar la secuencia
function exportSequence() {
    let sequence = '';
    for (let r = 0; r < matrix.length; r++) {
        for (let p = 0; p < matrix[r].length; p++) {
            if (matrix[r][p]) {
                sequence += `${matrix[r][p]} (anillo ${r}, pos ${p}); `;
            }
        }
    }
    exportText.value = sequence || 'No hay puntos en la cuadrícula.';
    exportText.style.display = 'block';
}

// Evento para el botón de exportar
exportBtn.onclick = exportSequence;

// Renderizar la cuadrícula al cargar
renderGrid();