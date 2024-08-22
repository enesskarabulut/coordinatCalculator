const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const canvasContainer = document.getElementById('canvasContainer');

// Durum değişkenleri
canvas.width = canvasContainer.clientWidth;
canvas.height = canvasContainer.clientHeight;

let startX, startY, endX, endY;
let isDrawing = false;
let isDragging = false;
let selectedRect = null;
let imageData = null; // Mevcut görüntüyü saklayacak değişken
let rectangles = []; // Çizilen dikdörtgenleri saklayacak değişken
let resizingCorner = null; // Yeniden boyutlandırma köşesi için

document.getElementById('fileInput').addEventListener('change', handleFileUpload);

function handleFileUpload(event) {
    const file = event.target.files[0];

    if (file.type === 'application/pdf') {
        loadPDF(file);
    } else if (file.type.startsWith('image/')) {
        loadImage(file);
    }
}

function loadImage(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.src = e.target.result;
        img.onload = function() {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            imageData = ctx.getImageData(0, 0, canvas.width, canvas.height); // Görüntüyü sakla
            draw(); // Yeni görüntüyü çiz
        }
    };
    reader.readAsDataURL(file);
}

function loadPDF(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const loadingTask = pdfjsLib.getDocument({ data: e.target.result });
        loadingTask.promise.then(function(pdf) {
            pdf.getPage(1).then(function(page) {
                const viewport = page.getViewport({ scale: 1.5 });
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                const renderContext = {
                    canvasContext: ctx,
                    viewport: viewport
                };
                page.render(renderContext).promise.then(() => {
                    imageData = ctx.getImageData(0, 0, canvas.width, canvas.height); // Görüntüyü sakla
                    draw(); // Yeni görüntüyü çiz
                });
            });
        });
    };
    reader.readAsArrayBuffer(file);
}

canvas.addEventListener('mousedown', (e) => {
    const { x, y } = getMousePos(e);

    selectedRect = getRectangleAt(x, y);
    resizingCorner = getResizingCorner(x, y, selectedRect);

    if (resizingCorner) {
        isDragging = false;
        isDrawing = false;
    } else if (selectedRect) {
        isDragging = true;
        isDrawing = false;
        startX = x - selectedRect.x;
        startY = y - selectedRect.y;
    } else {
        isDrawing = true;
        startX = x;
        startY = y;
    }
});

canvas.addEventListener('mousemove', (e) => {
    const { x, y } = getMousePos(e);

    if (isDrawing) {
        endX = x;
        endY = y;
        draw();
    } else if (isDragging && selectedRect) {
        selectedRect.x = x - startX;
        selectedRect.y = y - startY;
        draw();
        updateResults();
    } else if (resizingCorner && selectedRect) {
        resizeRectangle(selectedRect, x, y, resizingCorner);
        draw();
        updateResults();
    }
});

canvas.addEventListener('mouseup', () => {
    if (isDrawing) {
        const rect = normalizeRect(startX, startY, endX, endY);
        rectangles.push(rect);
        updateResults();
    }
    isDrawing = false;
    isDragging = false;
    resizingCorner = null;
    draw();
});

canvas.addEventListener('dblclick', (e) => {
    const { x, y } = getMousePos(e);
    const rect = getRectangleAt(x, y);
    if (rect) {
        rectangles = rectangles.filter(r => r !== rect);
        draw();
        updateResults();
    }
});

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
}

function getResizingCorner(x, y, rect) {
    if (!rect) return null;

    const corners = [
        { x: rect.x, y: rect.y, name: 'top-left' },
        { x: rect.x + rect.width, y: rect.y, name: 'top-right' },
        { x: rect.x, y: rect.y + rect.height, name: 'bottom-left' },
        { x: rect.x + rect.width, y: rect.y + rect.height, name: 'bottom-right' }
    ];

    for (const corner of corners) {
        if (Math.hypot(x - corner.x, y - corner.y) < 10) {
            return corner.name;
        }
    }

    return null;
}

function resizeRectangle(rect, x, y, corner) {
    switch (corner) {
        case 'top-left':
            rect.width += rect.x - x;
            rect.height += rect.y - y;
            rect.x = x;
            rect.y = y;
            break;
        case 'top-right':
            rect.width = x - rect.x;
            rect.height += rect.y - y;
            rect.y = y;
            break;
        case 'bottom-left':
            rect.width += rect.x - x;
            rect.x = x;
            rect.height = y - rect.y;
            break;
        case 'bottom-right':
            rect.width = x - rect.x;
            rect.height = y - rect.y;
            break;
    }

    // Negatif boyutları önlemek için
    if (rect.width < 0) {
        rect.x += rect.width;
        rect.width *= -1;
    }
    if (rect.height < 0) {
        rect.y += rect.height;
        rect.height *= -1;
    }
}

function draw() {
    if (imageData) {
        ctx.putImageData(imageData, 0, 0);
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    rectangles.forEach(rect => {
        drawRectangle(rect);
    });

    if (isDrawing) {
        const rect = normalizeRect(startX, startY, endX, endY);
        drawRectangle(rect, true);
    }
}

function drawRectangle(rect, isTemp = false) {
    ctx.strokeStyle = isTemp ? 'green' : 'blue';
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

    // Köşe noktaları
    ctx.fillStyle = 'red';
    const corners = [
        { x: rect.x, y: rect.y },
        { x: rect.x + rect.width, y: rect.y },
        { x: rect.x, y: rect.y + rect.height },
        { x: rect.x + rect.width, y: rect.y + rect.height }
    ];
    corners.forEach(corner => {
        ctx.fillRect(corner.x - 5, corner.y - 5, 10, 10);
    });
}

function getRectangleAt(x, y) {
    return rectangles.find(rect =>
        x >= rect.x &&
        x <= rect.x + rect.width &&
        y >= rect.y &&
        y <= rect.y + rect.height
    );
}

function normalizeRect(x1, y1, x2, y2) {
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    return { x, y, width, height };
}

function updateResults() {
    const resultsTable = document.getElementById('resultsTable');

    // Önce mevcut satırları temizle
    resultsTable.innerHTML = `
        <div class="resultsRow header">
            <div class="resultsCell">#</div>
            <div class="resultsCell">X1</div>
            <div class="resultsCell">Y1</div>
            <div class="resultsCell">X2</div>
            <div class="resultsCell">Y2</div>
            <div class="resultsCell">Width</div>
            <div class="resultsCell">Height</div>
        </div>
    `;

    rectangles.forEach((rect, index) => {
        const row = document.createElement('div');
        row.classList.add('resultsRow');

        const cells = [
            index + 1, // Sıra numarası
            rect.x.toFixed(2),
            rect.y.toFixed(2),
            (rect.x + rect.width).toFixed(2),
            (rect.y + rect.height).toFixed(2),
            rect.width.toFixed(2),
            rect.height.toFixed(2)
        ];

        cells.forEach(cellValue => {
            const cell = document.createElement('div');
            cell.classList.add('resultsCell');
            cell.textContent = cellValue;
            row.appendChild(cell);
        });

        resultsTable.appendChild(row);
    });
}

function drawRectangle(rect, isTemp = false) {
    ctx.strokeStyle = isTemp ? 'green' : 'blue';
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

    // Köşe noktaları
    ctx.fillStyle = 'red';
    const corners = [
        { x: rect.x, y: rect.y },
        { x: rect.x + rect.width, y: rect.y },
        { x: rect.x, y: rect.y + rect.height },
        { x: rect.x + rect.width, y: rect.y + rect.height }
    ];
    corners.forEach(corner => {
        ctx.fillRect(corner.x - 5, corner.y - 5, 10, 10);
    });

    // Koordinatları ve boyutları yazdırma
    ctx.font = '12px Arial';
    ctx.fillStyle = 'black';
    ctx.fillText(`X1: ${rect.x.toFixed(2)}, Y1: ${rect.y.toFixed(2)}`, rect.x + 5, rect.y - 10);
    ctx.fillText(`X2: ${(rect.x + rect.width).toFixed(2)}, Y2: ${(rect.y + rect.height).toFixed(2)}`, rect.x + rect.width + 5, rect.y + rect.height + 15);
    ctx.fillText(`Width: ${rect.width.toFixed(2)}, Height: ${rect.height.toFixed(2)}`, rect.x + 5, rect.y + rect.height + 15);
}

function draw() {
    if (imageData) {
        ctx.putImageData(imageData, 0, 0);
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    rectangles.forEach(rect => {
        drawRectangle(rect);
    });

    if (isDrawing) {
        const rect = normalizeRect(startX, startY, endX, endY);
        drawRectangle(rect, true);
    }
}

const clearButton = document.getElementById('clearButton');
clearButton.addEventListener('click', () => {
    // Dikdörtgenleri temizle
    rectangles = [];


    // Sonuçları temizle
    updateResults();
});