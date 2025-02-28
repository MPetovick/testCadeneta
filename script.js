let matrix = Array(3).fill().map(() => Array(3).fill(''));
let grid = document.getElementById('grid');
let selectedStitch = document.getElementById('stitch');

// Inicializar cuadrícula
function renderGrid() {
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `repeat(${matrix[0].length}, 50px)`;
    for (let i = 0; i < matrix.length; i++) {
        for (let j = 0; j < matrix[i].length; j++) {
            let cell = document.createElement('div');
            cell.className = 'cell';
            cell.textContent = matrix[i][j] || '';
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

// Renderizar la cuadrícula al cargar la página
renderGrid();
