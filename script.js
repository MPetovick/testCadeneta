class CrochetEditor {
    constructor() {
        this.canvas = document.getElementById('patternCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.initConstants();
        this.resizeCanvas();
        this.initEventListeners();
        this.initStitchPalette();
        this.loadFromLocalStorage();
        this.render();
        this.initMobileFeatures();
        this.initExportButtons();
    }

    initConstants() {
        this.STITCH_TYPES = {
            cadeneta: { symbol: '#', color: '#e74c3c', desc: 'Cadena base' },
            punt_baix: { symbol: '•', color: '#2ecc71', desc: 'Punto bajo' },
            punt_pla: { symbol: '-', color: '#3498db', desc: 'Punto plano' },
            punt_mitja: { symbol: '●', color: '#f1c40f', desc: 'Punto medio' },
            punt_alt: { symbol: '↑', color: '#9b59b6', desc: 'Punto alto' },
            punt_doble_alt: { symbol: '⇑', color: '#e67e22', desc: 'Punto doble alto' },
            picot: { symbol: '¤', color: '#1abc9c', desc: 'Picot decorativo' }
        };

        this.state = {
            matrix: [],           // Array de puntos: {ring, angle, type}
            history: [[]],
            historyIndex: 0,
            scale: 1,
            offset: { x: 0, y: 0 },
            selectedStitch: 'punt_baix',
            guideLines: 8,
            ringSpacing: 50,
            isDragging: false,
            lastPos: { x: 0, y: 0 },
            pinchDistance: null
        };
    }

    resizeCanvas() {
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = this.canvas.parentElement.clientHeight;
        this.render();
    }

    initMobileFeatures() {
        const toggleBtn = document.querySelector('.mobile-nav-toggle');
        const toolbar = document.querySelector('.toolbar');
        
        toggleBtn.addEventListener('click', () => {
            toolbar.classList.toggle('active');
        });

        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });
    }

    initEventListeners() {
        // Eventos de ratón
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        this.canvas.addEventListener('mousedown', this.startDrag.bind(this));
        document.addEventListener('mousemove', this.handleDrag.bind(this));
        document.addEventListener('mouseup', this.endDrag.bind(this));

        // Eventos táctiles
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
        this.canvas.addEventListener('touchcancel', this.endDrag.bind(this));

        // Botones de herramientas
        document.getElementById('newBtn').addEventListener('click', this.newProject.bind(this));
        document.getElementById('saveBtn').addEventListener('click', this.saveProject.bind(this));
        document.getElementById('undoBtn').addEventListener('click', this.undo.bind(this));
        document.getElementById('redoBtn').addEventListener('click', this.redo.bind(this));

        // Configuración
        const guideLines = document.getElementById('guideLines');
        guideLines.addEventListener('input', () => {
            this.state.guideLines = parseInt(guideLines.value);
            document.getElementById('guideLinesValue').textContent = this.state.guideLines;
            this.render();
        });

        const ringSpacing = document.getElementById('ringSpacing');
        ringSpacing.addEventListener('input', () => {
            this.state.ringSpacing = parseInt(ringSpacing.value);
            document.getElementById('ringSpacingValue').textContent = `${this.state.ringSpacing}px`;
            this.render();
        });

        // Zoom
        document.getElementById('zoomIn').addEventListener('click', () => this.adjustZoom(0.2));
        document.getElementById('zoomOut').addEventListener('click', () => this.adjustZoom(-0.2));
        document.getElementById('resetView').addEventListener('click', this.resetView.bind(this));

        // Modal
        document.getElementById('helpBtn').addEventListener('click', () => {
            document.getElementById('helpModal').classList.remove('hidden');
            this.populateHelpModal();
        });
        document.querySelector('.close-modal').addEventListener('click', () => {
            document.getElementById('helpModal').classList.add('hidden');
        });

        // Tema
        document.getElementById('themeToggle').addEventListener('click', () => {
            document.documentElement.dataset.theme = 
                document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
        });
    }

    initStitchPalette() {
        const palette = document.getElementById('stitchPalette');
        Object.entries(this.STITCH_TYPES).forEach(([key, stitch]) => {
            const btn = document.createElement('button');
            btn.className = 'stitch-btn';
            btn.innerHTML = stitch.symbol;
            btn.style.color = stitch.color;
            btn.title = stitch.desc;
            btn.addEventListener('click', () => {
                this.state.selectedStitch = key;
                palette.querySelectorAll('.stitch-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
            palette.appendChild(btn);
        });
        palette.querySelector('.stitch-btn').classList.add('active');
    }

    initExportButtons() {
        document.getElementById('exportTxt').addEventListener('click', this.exportAsText.bind(this));
        document.getElementById('exportPng').addEventListener('click', this.exportAsImage.bind(this));
        document.getElementById('exportPdf').addEventListener('click', this.generatePDF.bind(this));
    }

    startDrag(e) {
        this.state.isDragging = true;
        this.state.lastPos = { x: e.clientX, y: e.clientY };
    }

    handleDrag(e) {
        if (!this.state.isDragging) return;
        const newX = e.clientX;
        const newY = e.clientY;
        this.state.offset.x += newX - this.state.lastPos.x;
        this.state.offset.y += newY - this.state.lastPos.y;
        this.state.lastPos = { x: newX, y: newY };
        this.render();
    }

    endDrag() {
        this.state.isDragging = false;
    }

    handleWheel(e) {
        e.preventDefault();
        const zoom = e.deltaY > 0 ? -0.1 : 0.1;
        this.adjustZoom(zoom);
    }

    handleTouchStart(e) {
        e.preventDefault();
        const touches = e.touches;
        if (touches.length === 1) {
            this.startDrag(touches[0]);
        } else if (touches.length === 2) {
            this.state.pinchDistance = this.getPinchDistance(touches);
            this.state.isDragging = false;
        }
    }

    handleTouchMove(e) {
        e.preventDefault();
        const touches = e.touches;
        if (touches.length === 1 && this.state.isDragging) {
            this.handleDrag(touches[0]);
        } else if (touches.length === 2) {
            const newDistance = this.getPinchDistance(touches);
            if (this.state.pinchDistance) {
                const scaleChange = (newDistance - this.state.pinchDistance) * 0.005;
                this.adjustZoom(scaleChange);
            }
            this.state.pinchDistance = newDistance;
        }
    }

    handleTouchEnd(e) {
        if (e.touches.length === 0) {
            this.endDrag();
            this.state.pinchDistance = null;
        }
    }

    getPinchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.state.offset.x) / this.state.scale;
        const y = (e.clientY - rect.top - this.state.offset.y) / this.state.scale;
        
        const centerX = this.canvas.width / 2 / this.state.scale;
        const centerY = this.canvas.height / 2 / this.state.scale;
        
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const ring = Math.round(distance / this.state.ringSpacing);
        const angle = Math.atan2(dy, dx) + Math.PI * 2;
        const segment = Math.round((angle / (Math.PI * 2)) * this.state.guideLines) % this.state.guideLines;

        const existingPointIndex = this.state.matrix.findIndex(p => 
            p.ring === ring && p.segment === segment
        );

        if (existingPointIndex >= 0) {
            this.state.matrix.splice(existingPointIndex, 1); // Eliminar punto si ya existe
        } else if (ring > 0 && ring <= 12) { // Limitar a 12 anillos
            this.state.matrix.push({
                ring,
                segment,
                type: this.state.selectedStitch
            });
        }

        this.saveState();
        this.render();
    }

    render() {
        requestAnimationFrame(() => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.save();
            this.ctx.translate(this.state.offset.x, this.state.offset.y);
            this.ctx.scale(this.state.scale, this.state.scale);

            const centerX = this.canvas.width / 2 / this.state.scale;
            const centerY = this.canvas.height / 2 / this.state.scale;

            // Dibujar anillos
            for (let r = 1; r <= 12; r++) {
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, r * this.state.ringSpacing, 0, Math.PI * 2);
                this.ctx.strokeStyle = '#ddd';
                this.ctx.lineWidth = 1 / this.state.scale;
                this.ctx.stroke();
            }

            // Dibujar guías radiales
            for (let i = 0; i < this.state.guideLines; i++) {
                const angle = (i / this.state.guideLines) * Math.PI * 2;
                this.ctx.beginPath();
                this.ctx.moveTo(centerX, centerY);
                this.ctx.lineTo(
                    centerX + Math.cos(angle) * this.state.ringSpacing * 12,
                    centerY + Math.sin(angle) * this.state.ringSpacing * 12
                );
                this.ctx.strokeStyle = '#eee';
                this.ctx.stroke();
            }

            // Dibujar puntadas
            this.state.matrix.forEach(point => {
                const angle = (point.segment / this.state.guideLines) * Math.PI * 2;
                const x = centerX + Math.cos(angle) * (point.ring * this.state.ringSpacing);
                const y = centerY + Math.sin(angle) * (point.ring * this.state.ringSpacing);
                const stitch = this.STITCH_TYPES[point.type];
                
                this.ctx.fillStyle = stitch.color;
                this.ctx.font = `${20 / this.state.scale}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(stitch.symbol, x, y);
            });

            this.ctx.restore();
        });
    }

    adjustZoom(amount) {
        this.state.scale = Math.max(0.3, Math.min(3, this.state.scale + amount));
        this.render();
    }

    resetView() {
        this.state.scale = 1;
        this.state.offset = { x: 0, y: 0 };
        this.render();
    }

    saveState() {
        if (this.state.historyIndex < this.state.history.length - 1) {
            this.state.history = this.state.history.slice(0, this.state.historyIndex + 1);
        }
        this.state.history.push(JSON.parse(JSON.stringify(this.state.matrix)));
        this.state.historyIndex++;
        if (this.state.history.length > 100) {
            this.state.history.shift();
            this.state.historyIndex--;
        }
    }

    undo() {
        if (this.state.historyIndex > 0) {
            this.state.historyIndex--;
            this.state.matrix = JSON.parse(JSON.stringify(this.state.history[this.state.historyIndex]));
            this.render();
        }
    }

    redo() {
        if (this.state.historyIndex < this.state.history.length - 1) {
            this.state.historyIndex++;
            this.state.matrix = JSON.parse(JSON.stringify(this.state.history[this.state.historyIndex]));
            this.render();
        }
    }

    newProject() {
        this.state.matrix = [];
        this.state.history = [[]];
        this.state.historyIndex = 0;
        this.resetView();
    }

    saveProject() {
        localStorage.setItem('crochetPattern', JSON.stringify(this.state.matrix));
        alert('Proyecto guardado!');
    }

    loadFromLocalStorage() {
        const saved = localStorage.getItem('crochetPattern');
        if (saved) {
            this.state.matrix = JSON.parse(saved);
            this.state.history = [JSON.parse(saved)];
            this.state.historyIndex = 0;
            this.render();
        }
    }

    exportAsText() {
        const text = this.state.matrix
            .sort((a, b) => a.ring - b.ring || a.segment - b.segment)
            .map(p => `Anillo ${p.ring}, Segmento ${p.segment}: ${this.STITCH_TYPES[p.type].desc}`)
            .join('\n');
        document.getElementById('exportText').value = text || 'Patrón vacío';
    }

    exportAsImage() {
        const dataUrl = this.canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = 'patron_crochet.png';
        link.href = dataUrl;
        link.click();
    }

    generatePDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const centerX = doc.internal.pageSize.width / 2;
        const centerY = doc.internal.pageSize.height / 2;

        // Dibujar anillos
        for (let r = 1; r <= 12; r++) {
            doc.circle(centerX, centerY, r * 10);
        }

        // Dibujar puntadas
        this.state.matrix.forEach(point => {
            const angle = (point.segment / this.state.guideLines) * Math.PI * 2;
            const x = centerX + Math.cos(angle) * (point.ring * 10);
            const y = centerY + Math.sin(angle) * (point.ring * 10);
            const stitch = this.STITCH_TYPES[point.type];
            doc.setTextColor(stitch.color);
            doc.text(stitch.symbol, x, y, { align: 'center', baseline: 'middle' });
        });

        doc.save('patron_crochet.pdf');
    }

    populateHelpModal() {
        const guide = document.getElementById('stitchGuide');
        guide.innerHTML = '';
        Object.entries(this.STITCH_TYPES).forEach(([_, stitch]) => {
            const div = document.createElement('div');
            div.innerHTML = `<span style="color: ${stitch.color}">${stitch.symbol}</span> - ${stitch.desc}`;
            guide.appendChild(div);
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const editor = new CrochetEditor();
    window.editor = editor; // Para depuración
});