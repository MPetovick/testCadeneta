class CrochetEditor {
    constructor() {
        this.canvas = document.getElementById('patternCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.initConstants();
        this.resizeCanvas();
        this.initEventListeners();
        this.initStitchPalette();
        this.loadProjects();
        this.loadFromLocalStorage();
        this.render();
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
            rings: [{ segments: 8, points: Array(8).fill('cadeneta') }],
            history: [[]],
            historyIndex: 0,
            scale: 1,
            targetScale: 1,
            offset: { x: 0, y: 0 },
            targetOffset: { x: 0, y: 0 },
            selectedStitch: 'punt_baix',
            guideLines: 8,
            ringSpacing: 50,
            isDragging: false,
            lastPos: { x: 0, y: 0 },
            pinchDistance: null
        };

        this.debounceRender = this.debounce(this.render.bind(this), 16);
    }

    resizeCanvas() {
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = this.canvas.parentElement.clientHeight;
        this.render();
    }

    initEventListeners() {
        this.canvas.addEventListener('click', this.handleCanvasClick.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        this.canvas.addEventListener('mousedown', this.startDrag.bind(this));
        document.addEventListener('mousemove', this.debounce(this.handleDrag.bind(this), 16));
        document.addEventListener('mouseup', this.endDrag.bind(this));

        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.debounce(this.handleTouchMove.bind(this), 16), { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
        this.canvas.addEventListener('touchcancel', this.endDrag.bind(this));

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey) {
                switch (e.key) {
                    case 'z': this.undo(); break;
                    case 'y': this.redo(); break;
                    case 's': e.preventDefault(); this.saveProject(); break;
                }
            } else {
                switch (e.key) {
                    case 'n': this.newProject(); break;
                    case '+': this.adjustZoom(0.2); break;
                    case '-': this.adjustZoom(-0.2); break;
                }
            }
        });

        document.getElementById('newBtn').addEventListener('click', this.newProject.bind(this));
        document.getElementById('saveBtn').addEventListener('click', this.saveProject.bind(this));
        document.getElementById('saveAsBtn').addEventListener('click', this.saveProjectAs.bind(this));
        document.getElementById('undoBtn').addEventListener('click', this.undo.bind(this));
        document.getElementById('redoBtn').addEventListener('click', this.redo.bind(this));

        const guideLines = document.getElementById('guideLines');
        guideLines.addEventListener('input', () => {
            this.state.guideLines = parseInt(guideLines.value);
            this.state.rings[0].segments = this.state.guideLines;
            this.state.rings[0].points = Array(this.state.guideLines).fill('cadeneta');
            document.getElementById('guideLinesValue').textContent = this.state.guideLines;
            this.render();
        });

        const ringSpacing = document.getElementById('ringSpacing');
        ringSpacing.addEventListener('input', () => {
            this.state.ringSpacing = parseInt(ringSpacing.value);
            document.getElementById('ringSpacingValue').textContent = `${this.state.ringSpacing}px`;
            this.render();
        });

        document.getElementById('zoomIn').addEventListener('click', () => this.adjustZoom(0.2));
        document.getElementById('zoomOut').addEventListener('click', () => this.adjustZoom(-0.2));
        document.getElementById('resetView').addEventListener('click', this.resetView.bind(this));

        const helpBtn = document.getElementById('stitchHelpBtn');
        helpBtn.addEventListener('click', (e) => this.toggleStitchTooltip(e));

        document.addEventListener('click', (e) => {
            const tooltip = document.getElementById('stitchTooltip');
            if (!helpBtn.contains(e.target) && !tooltip.contains(e.target)) {
                tooltip.classList.add('hidden');
            }
        });

        window.addEventListener('DOMContentLoaded', () => this.render());
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    initStitchPalette() {
        const palette = document.getElementById('stitchPalette');
        if (!palette) {
            console.error('El elemento #stitchPalette no se encontró en el DOM');
            return;
        }
        palette.innerHTML = '';
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
        const firstBtn = palette.querySelector('.stitch-btn');
        if (firstBtn) firstBtn.classList.add('active');
    }

    initExportButtons() {
        document.getElementById('exportTxt').addEventListener('click', this.exportAsText.bind(this));
        document.getElementById('exportPng').addEventListener('click', this.exportAsImage.bind(this));
        document.getElementById('exportPdf').addEventListener('click', this.generatePDF.bind(this));
    }

    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    startDrag(e) {
        this.state.isDragging = true;
        this.state.lastPos = { x: e.clientX, y: e.clientY };
    }

    handleDrag(e) {
        if (!this.state.isDragging) return;
        const newX = e.clientX;
        const newY = e.clientY;
        this.state.targetOffset.x += newX - this.state.lastPos.x;
        this.state.targetOffset.y += newY - this.state.lastPos.y;
        this.state.lastPos = { x: newX, y: newY };
        this.animate();
    }

    endDrag() {
        this.state.isDragging = false;
        this.state.offset.x = this.state.targetOffset.x;
        this.state.offset.y = this.state.targetOffset.y;
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

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - this.state.offset.x - this.canvas.width / 2) / this.state.scale;
        const mouseY = (e.clientY - rect.top - this.state.offset.y - this.canvas.height / 2) / this.state.scale;
        this.render(mouseX, mouseY);
    }

    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - this.state.offset.x - this.canvas.width / 2) / this.state.scale;
        const mouseY = (e.clientY - rect.top - this.state.offset.y - this.canvas.height / 2) / this.state.scale;

        const distance = Math.sqrt(mouseX * mouseX + mouseY * mouseY);
        const ring = Math.round(distance / this.state.ringSpacing) - 1;
        if (ring >= 0 && ring < this.state.rings.length) {
            const segments = this.state.rings[ring].segments;
            const angleStep = Math.PI * 2 / segments;
            const angle = Math.atan2(mouseY, mouseX) + Math.PI * 2;
            const segment = Math.round((angle / (Math.PI * 2)) * segments) % segments;

            if (e.shiftKey) { // Shift + clic: Aumentar puntos
                this.increasePoints(ring, segment);
            } else if (e.ctrlKey) { // Ctrl + clic: Disminuir puntos
                this.decreasePoints(ring, segment);
            } else { // Clic normal: Cambiar tipo de puntada
                this.state.rings[ring].points[segment] = this.state.selectedStitch;
            }
            this.saveState();
            this.render();
        }
    }

    increasePoints(ringIndex, segmentIndex) {
        const nextRingIndex = ringIndex + 1;
        if (nextRingIndex >= this.state.rings.length) {
            const prevSegments = this.state.rings[ringIndex].segments;
            this.state.rings.push({ segments: prevSegments, points: Array(prevSegments).fill('punt_baix') });
        }

        const nextRing = this.state.rings[nextRingIndex];
        nextRing.segments += 1;
        nextRing.points.splice(segmentIndex + 1, 0, this.state.selectedStitch);
    }

    decreasePoints(ringIndex, segmentIndex) {
        if (ringIndex > 0 && this.state.rings[ringIndex].segments > this.state.guideLines) {
            const currentRing = this.state.rings[ringIndex];
            currentRing.segments -= 1;
            currentRing.points.splice(segmentIndex, 1);
        }
    }

    render(mouseX = null, mouseY = null) {
        requestAnimationFrame(() => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            this.state.offset.x += (this.state.targetOffset.x - this.state.offset.x) * 0.1;
            this.state.offset.y += (this.state.targetOffset.y - this.state.offset.y) * 0.1;
            this.state.scale += (this.state.targetScale - this.state.scale) * 0.1;

            const centerX = this.canvas.width / 2;
            const centerY = this.canvas.height / 2;

            this.ctx.save();
            this.ctx.translate(centerX + this.state.offset.x, centerY + this.state.offset.y);
            this.ctx.scale(this.state.scale, this.state.scale);

            this.ctx.strokeStyle = '#ddd';
            this.ctx.lineWidth = 1 / this.state.scale;
            for (let r = 0; r < this.state.rings.length; r++) {
                this.ctx.beginPath();
                this.ctx.arc(0, 0, (r + 1) * this.state.ringSpacing, 0, Math.PI * 2);
                this.ctx.stroke();

                const segments = this.state.rings[r].segments;
                const angleStep = Math.PI * 2 / segments;
                this.ctx.strokeStyle = '#eee';
                this.ctx.beginPath();
                for (let i = 0; i < segments; i++) {
                    const angle = i * angleStep;
                    const cosAngle = Math.cos(angle);
                    const sinAngle = Math.sin(angle);
                    this.ctx.moveTo(0, 0);
                    this.ctx.lineTo(cosAngle * this.state.rings.length * this.state.ringSpacing, sinAngle * this.state.rings.length * this.state.ringSpacing);
                }
                this.ctx.stroke();
            }

            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.font = `${20 / this.state.scale}px Arial`;
            this.state.rings.forEach((ring, ringIndex) => {
                const segments = ring.segments;
                const angleStep = Math.PI * 2 / segments;
                ring.points.forEach((type, segmentIndex) => {
                    const angle = segmentIndex * angleStep;
                    const x = Math.cos(angle) * (ringIndex + 1) * this.state.ringSpacing;
                    const y = Math.sin(angle) * (ringIndex + 1) * this.state.ringSpacing;
                    const stitch = this.STITCH_TYPES[type];
                    this.ctx.fillStyle = stitch.color;
                    this.ctx.fillText(stitch.symbol, x, y);
                });
            });

            if (mouseX !== null && mouseY !== null) {
                const distance = Math.sqrt(mouseX * mouseX + mouseY * mouseY);
                const ring = Math.round(distance / this.state.ringSpacing) - 1;
                if (ring >= 0 && ring < this.state.rings.length) {
                    const segments = this.state.rings[ring].segments;
                    const angleStep = Math.PI * 2 / segments;
                    const angle = Math.atan2(mouseY, mouseX) + Math.PI * 2;
                    const segment = Math.round((angle / (Math.PI * 2)) * segments) % segments;

                    const x = Math.cos(segment * angleStep) * (ring + 1) * this.state.ringSpacing;
                    const y = Math.sin(segment * angleStep) * (ring + 1) * this.state.ringSpacing;
                    const stitch = this.STITCH_TYPES[this.state.selectedStitch];
                    this.ctx.fillStyle = stitch.color + '80';
                    this.ctx.fillText(stitch.symbol, x, y);
                }
            }

            this.ctx.restore();

            document.getElementById('undoBtn').disabled = this.state.historyIndex === 0;
            document.getElementById('redoBtn').disabled = this.state.historyIndex === this.state.history.length - 1;

            this.updateExportPreview();
        });
    }

    animate() {
        this.render();
        if (
            Math.abs(this.state.scale - this.state.targetScale) > 0.01 ||
            Math.abs(this.state.offset.x - this.state.targetOffset.x) > 1 ||
            Math.abs(this.state.offset.y - this.state.targetOffset.y) > 1
        ) {
            requestAnimationFrame(this.animate.bind(this));
        }
    }

    adjustZoom(amount) {
        this.state.targetScale = Math.max(0.3, Math.min(3, this.state.targetScale + amount));
        this.animate();
    }

    resetView() {
        this.state.targetScale = 1;
        this.state.targetOffset = { x: 0, y: 0 };
        this.state.offset = { x: 0, y: 0 };
        this.animate();
    }

    saveState() {
        if (this.state.historyIndex < this.state.history.length - 1) {
            this.state.history = this.state.history.slice(0, this.state.historyIndex + 1);
        }
        this.state.history.push(JSON.parse(JSON.stringify(this.state.rings)));
        this.state.historyIndex++;
        if (this.state.history.length > 100) {
            this.state.history.shift();
            this.state.historyIndex--;
        }
    }

    undo() {
        if (this.state.historyIndex > 0) {
            this.state.historyIndex--;
            this.state.rings = JSON.parse(JSON.stringify(this.state.history[this.state.historyIndex]));
            this.render();
        }
    }

    redo() {
        if (this.state.historyIndex < this.state.history.length - 1) {
            this.state.historyIndex++;
            this.state.rings = JSON.parse(JSON.stringify(this.state.history[this.state.historyIndex]));
            this.render();
        }
    }

    newProject() {
        this.state.rings = [{ segments: this.state.guideLines, points: Array(this.state.guideLines).fill('cadeneta') }];
        this.state.history = [JSON.parse(JSON.stringify(this.state.rings))];
        this.state.historyIndex = 0;
        this.resetView();
    }

    saveProject() {
        localStorage.setItem('crochetPattern', JSON.stringify(this.state.rings));
        alert('Proyecto guardado!');
    }

    saveProjectAs() {
        const name = prompt('Nombre del proyecto:', `Patrón ${new Date().toLocaleDateString()}`);
        if (name) {
            const projects = JSON.parse(localStorage.getItem('crochetProjects') || '{}');
            projects[name] = this.state.rings;
            localStorage.setItem('crochetProjects', JSON.stringify(projects));
            this.loadProjects();
            alert(`Proyecto "${name}" guardado!`);
        }
    }

    loadFromLocalStorage() {
        const saved = localStorage.getItem('crochetPattern');
        if (saved) {
            this.state.rings = JSON.parse(saved);
            this.state.history = [JSON.parse(saved)];
            this.state.historyIndex = 0;
            this.render();
        }
    }

    loadProjects() {
        const projects = JSON.parse(localStorage.getItem('crochetProjects') || '{}');
        const select = document.getElementById('loadProjects');
        const controls = document.querySelector('.project-controls');
        
        const existingDeleteBtn = controls.querySelector('.delete-btn');
        if (existingDeleteBtn) existingDeleteBtn.remove();

        select.innerHTML = '<option value="">Cargar...</option>' + 
            Object.keys(projects).map(name => `<option value="${name}">${name}</option>`).join('');

        select.addEventListener('change', () => {
            const deleteBtn = controls.querySelector('.delete-btn');
            if (deleteBtn) deleteBtn.remove();

            if (select.value) {
                this.state.rings = JSON.parse(JSON.stringify(projects[select.value]));
                this.state.history = [JSON.parse(JSON.stringify(projects[select.value]))];
                this.state.historyIndex = 0;
                this.render();

                const btn = document.createElement('button');
                btn.className = 'delete-btn';
                btn.innerHTML = '<i class="fas fa-trash"></i>';
                btn.title = 'Eliminar proyecto';
                btn.addEventListener('click', () => this.deleteProject(select.value));
                controls.insertBefore(btn, select);
            }
        });
    }

    deleteProject(projectName) {
        if (confirm(`¿Seguro que quieres eliminar el proyecto "${projectName}"?`)) {
            const projects = JSON.parse(localStorage.getItem('crochetProjects') || '{}');
            delete projects[projectName];
            localStorage.setItem('crochetProjects', JSON.stringify(projects));
            this.loadProjects();
            this.newProject();
            alert(`Proyecto "${projectName}" eliminado.`);
        }
    }

    updateExportPreview() {
        const text = this.state.rings
            .map((ring, ringIndex) => 
                ring.points.map((type, segmentIndex) => 
                    `Anillo ${ringIndex + 1}, Segmento ${segmentIndex}: ${this.STITCH_TYPES[type].desc}`
                ).join('\n')
            )
            .join('\n');
        document.getElementById('exportText').value = text || 'Patrón vacío';
    }

    exportAsText() {
        this.updateExportPreview();
        const text = document.getElementById('exportText').value;
        const blob = new Blob([text], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'patron_crochet.txt';
        link.click();
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
        const centerY = 100;

        doc.setFontSize(16);
        doc.text('Patrón de Crochet Radial', centerX, 20, { align: 'center' });

        let y = 40;
        Object.entries(this.STITCH_TYPES).forEach(([_, stitch]) => {
            doc.setTextColor(stitch.color);
            doc.text(`${stitch.symbol} - ${stitch.desc}`, 20, y);
            y += 10;
        });
        doc.setTextColor('#000000');

        this.state.rings.forEach((ring, ringIndex) => {
            doc.circle(centerX, centerY, (ringIndex + 1) * 10);
            const segments = ring.segments;
            const angleStep = Math.PI * 2 / segments;
            ring.points.forEach((type, segmentIndex) => {
                const angle = segmentIndex * angleStep;
                const x = centerX + Math.cos(angle) * (ringIndex + 1) * 10;
                const y = centerY + Math.sin(angle) * (ringIndex + 1) * 10;
                const stitch = this.STITCH_TYPES[type];
                doc.setTextColor(stitch.color);
                doc.text(stitch.symbol, x, y, { align: 'center', baseline: 'middle' });
            });
        });

        doc.save('patron_crochet.pdf');
    }

    toggleStitchTooltip(e) {
        const tooltip = document.getElementById('stitchTooltip');
        if (tooltip.classList.contains('hidden')) {
            const content = Object.entries(this.STITCH_TYPES)
                .map(([_, stitch]) => `<span style="color: ${stitch.color}">${stitch.symbol}</span> - ${stitch.desc}`)
                .join('<br>');
            tooltip.innerHTML = content;

            const rect = e.target.getBoundingClientRect();
            tooltip.style.left = `${rect.right + 5}px`;
            tooltip.style.top = `${rect.top - 5}px`;
            tooltip.classList.remove('hidden');
        } else {
            tooltip.classList.add('hidden');
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const editor = new CrochetEditor();
    window.editor = editor; // Para depuración
});
