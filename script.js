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
        }
    };
    reader.readAsDataURL(file);
}

function loadPDF(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const loadingTask = pdfjsLib.getDocument({data: e.target.result});
        loadingTask.promise.then(function(pdf) {
            pdf.getPage(1).then(function(page) {
                const viewport = page.getViewport({scale: 1});
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                const renderContext = {
                    canvasContext: ctx,
                    viewport: viewport
                };
                page.render(renderContext).promise.then(() => {
                    imageData = ctx.getImageData(0, 0, canvas.width, canvas.height); // Görüntüyü sakla
                });
            });
        });
    };
    reader.readAsArrayBuffer(file);
}

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Kontrol - Değişkenin tanımlı olduğundan emin ol
    if (typeof isDrawing === 'undefined') {
        console.error('isDrawing değişkeni tanımlı değil!');
        isDrawing = false; // Tanımlanmadıysa varsayılan değeri ata
    }

    selectedRect = getRectangleAt(x, y);
    resizingCorner = getResizingCorner(x, y, selectedRect); // Yeniden boyutlandırma köşesi kontrolü
    
    if (resizingCorner) {
        isDragging = false; // Sürükleme modunu kapat
        isDrawing = false;
    } else if (isDrawing) {
        endX = x;
        endY = y;
        drawRect(startX, startY, endX - startX, endY - startY);
        isDrawing = false;
    } else if (selectedRect) {
        if (!resizingCorner) {
            isDragging = true;
            startX = x - selectedRect.x;
            startY = y - selectedRect.y;
        }
    } else {
        startX = x;
        startY = y;
        isDrawing = true;
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDrawing) {
        endX = x;
        endY = y;
        draw();
    } else if (isDragging && selectedRect) {
        selectedRect.x = x - startX;
        selectedRect.y = y - startY;
        draw();
    } else if (resizingCorner && selectedRect) {
        resizeRectangle(selectedRect, x, y, resizingCorner);
        draw();
    }
});

canvas.addEventListener('mouseup', () => {
    isDrawing = false;
    isDragging = false;
    resizingCorner = null;
    logCoordinates();
});

function getResizingCorner(x, y, rect) {
    if (!rect) return null;

    const corners = [
        { x: rect.x, y: rect.y, name: 'top-left' },
        { x: rect.x + rect.width, y: rect.y, name: 'top-right' },
        { x: rect.x, y: rect.y + rect.height, name: 'bottom-left' },
        { x: rect.x + rect.width, y: rect.y + rect.height, name: 'bottom-right' }
    ];

    // Tıklanan konum bir köşeye yakın mı kontrol et
    for (const corner of corners) {
        if (Math.abs(x - corner.x) < 10 && Math.abs(y - corner.y) < 10) {
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
}

function draw() {
    if (imageData) {
        ctx.putImageData(imageData, 0, 0);
    }

    rectangles.forEach(rect => {
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 2;
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        ctx.fillStyle = 'red';
        ctx.fillRect(rect.x - 5, rect.y - 5, 10, 10);
        ctx.fillRect(rect.x + rect.width - 5, rect.y - 5, 10, 10);
        ctx.fillRect(rect.x - 5, rect.y + rect.height - 5, 10, 10);
        ctx.fillRect(rect.x + rect.width - 5, rect.y + rect.height - 5, 10, 10);

        ctx.font = '12px Arial';
        ctx.fillStyle = 'black';
        ctx.fillText(`x1=${rect.x}, y1=${rect.y}`, rect.x + 10, rect.y - 10);
        ctx.fillText(`x2=${rect.x + rect.width}, y2=${rect.y + rect.height}`, rect.x + rect.width + 10, rect.y - 10);
    });

    if (isDrawing) {
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, startY, endX - startX, endY - startY);
        ctx.fillStyle = 'red';
        ctx.fillRect(startX - 5, startY - 5, 10, 10);
        ctx.fillRect(endX - 5, endY - 5, 10, 10);
        ctx.font = '12px Arial';
        ctx.fillStyle = 'black';
        ctx.fillText(`x1=${startX}, y1=${startY}`, startX + 10, startY - 10);
        ctx.fillText(`x2=${endX}, y2=${endY}`, endX + 10, endY - 10);
    }
}

function drawRect(x, y, width, height) {
    rectangles.push({x, y, width, height});
    draw(); // Çizimi güncelle
}

function getRectangleAt(x, y) {
    // Çizim alanındaki dikdörtgenleri kontrol et
    return rectangles.find(rect => x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height);
}

function logCoordinates() {
    console.log(`Koordinatlar:`);
    console.log(`Başlangıç noktası: x1=${startX}, y1=${startY}`);
    console.log(`Bitiş noktası: x2=${endX}, y2=${endY}`);
}
