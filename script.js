let matrix = Array(3).fill().map(() => Array(3).fill(''));
let grid = document.getElementById('grid');
let selectedStitch = document.getElementById('stitch');
let exportBtn = document.getElementById('exportBtn');
let exportText = document.getElementById('exportText');

// Mapa de símbolos para cada punto
const stitchSymbols = {
    cadeneta: '⛓️',
    punt_baix: '✖️',
    punt_pla: '⬜',
    punt_mitja: '⬆️',
    punt_alt: '↑',
    punt_doble_alt: '⇑',
    picot: '⚫'
};

// Inicializar cuadrícula
function renderGrid() {
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `repeat(${matrix[0].length}, 40px)`;
    for (let i = 0; i < matrix.length; i++) {
        for (let j = 0; j < matrix[i].length; j++) {
            let cell = document.createElement('div');
            cell.className = 'cell';
            cell.textContent = matrix[i][j] ? stitchSymbols[matrix[i][j]] : '';
            cell.onclick = () => addStitch(i, j);
            grid.appendChild(cell);
        }
    }
}

// Añadir punto y verificar expansión
function addStitch(row, col) {
    matrix[row][col] = selectedStitch.value;
    checkExpansion(row, col);
    renderGrid();
}

// Verificar si hay que expandir la matriz
function checkExpansion(row, col) {
    if (row === 0 || row === matrix.length - 1 || col === 0 || col === matrix[0].length - 1) {
        if (row === 0 || row === matrix.length - 1) {
            matrix.push(Array(matrix[0].length).fill(''));
            matrix.unshift(Array(matrix[0].length).fill(''));
        }
        if (col === 0 || col === matrix[0].length - 1) {
            matrix = matrix.map(row => [...row, '']);
            matrix = matrix.map(row => ['', ...row]);
        }
    }
}

// Exportar la secuencia
function exportSequence() {
    let sequence = '';
    for (let i = 0; i < matrix.length; i++) {
        for (let j = 0; j < matrix[i].length; j++) {
            if (matrix[i][j]) {
                sequence += `${matrix[i][j]} (${i},${j}); `;
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