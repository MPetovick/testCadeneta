class CrochetEditor {
    constructor() {
        this.canvas = document.getElementById('patternCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.staticCanvas = document.createElement('canvas');
        this.staticCtx = this.staticCanvas.getContext('2d');
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
            matrix: [],
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
            pinchDistance: null,
            needsStaticRedraw: true
        };

        this.debounceRender = this.debounce(this.render.bind(this), 16);
    }

    resizeCanvas() {
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = this.canvas.parentElement.clientHeight;
        this.staticCanvas.width = this.canvas.width;
        this.staticCanvas.height = this.canvas.height;
        this.state.needsStaticRedraw = true;
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
            document.getElementById('guideLinesValue').textContent = this.state.guideLines;
            this.state.needsStaticRedraw = true;
            this.render();
        });

        const ringSpacing = document.getElementById('ringSpacing');
        ringSpacing.addEventListener('input', () => {
            this.state.ringSpacing = parseInt(ringSpacing.value);
            document.getElementById('ringSpacingValue').textContent = `${this.state.ringSpacing}px`;
            this.state.needsStaticRedraw = true;
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

        window.addEventListener('resize', () => this.resizeCanvas());
    }

    initStitchPalette() {
        const palette = document.getElementById('stitchPalette');
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
                const scale
