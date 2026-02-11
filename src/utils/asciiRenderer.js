/**
 * Parses Excalidraw JSON and renders it as ASCII art.
 */

export function renderASCII(data, options = {}) {
  const { showText = true, doubleLines = false, scale = 1 } = options;
  const elements = data.elements || [];
  
  if (elements.length === 0) {
    return { ascii: '', stats: 'No elements found' };
  }

  // Calculate bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  elements.forEach(el => {
    const x = el.x || 0;
    const y = el.y || 0;
    const w = el.width || 0;
    const h = el.height || 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });

  // Add padding
  const padding = 20;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  // Grid dimensions (2 chars per unit for aspect ratio)
  const gridW = Math.ceil((maxX - minX) * scale / 8);
  const gridH = Math.ceil((maxY - minY) * scale / 16);

  // Initialize grid with spaces
  const grid = Array(gridH).fill(null).map(() => Array(gridW).fill(' '));

  function toGrid(x, y) {
    return {
      x: Math.floor((x - minX) * scale / 8),
      y: Math.floor((y - minY) * scale / 16)
    };
  }

  function setChar(x, y, char) {
    if (x >= 0 && x < gridW && y >= 0 && y < gridH) {
      grid[y][x] = char;
    }
  }

  function drawLine(x1, y1, x2, y2) {
    const p1 = toGrid(x1, y1);
    const p2 = toGrid(x2, y2);
    
    const dx = Math.abs(p2.x - p1.x);
    const dy = Math.abs(p2.y - p1.y);
    const sx = p1.x < p2.x ? 1 : -1;
    const sy = p1.y < p2.y ? 1 : -1;
    let err = dx - dy;

    let x = p1.x, y = p1.y;
    while (true) {
      const isHorizontal = dy < dx;
      setChar(x, y, isHorizontal ? '─' : '│');
      
      if (x === p2.x && y === p2.y) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }

  function drawRect(x, y, w, h) {
    const p = toGrid(x, y);
    const p2 = toGrid(x + w, y + h);
    const left = Math.min(p.x, p2.x);
    const right = Math.max(p.x, p2.x);
    const top = Math.min(p.y, p2.y);
    const bottom = Math.max(p.y, p2.y);

    const hLine = doubleLines ? '═' : '─';
    const vLine = doubleLines ? '║' : '│';
    const tl = doubleLines ? '╔' : '┌';
    const tr = doubleLines ? '╗' : '┐';
    const bl = doubleLines ? '╚' : '└';
    const br = doubleLines ? '╝' : '┘';

    // Top and bottom
    for (let i = left + 1; i < right; i++) {
      setChar(i, top, hLine);
      setChar(i, bottom, hLine);
    }
    // Left and right
    for (let i = top + 1; i < bottom; i++) {
      setChar(left, i, vLine);
      setChar(right, i, vLine);
    }
    // Corners
    setChar(left, top, tl);
    setChar(right, top, tr);
    setChar(left, bottom, bl);
    setChar(right, bottom, br);
  }

  function drawDiamond(x, y, w, h) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const pTop = toGrid(cx, y);
    const pBottom = toGrid(cx, y + h);
    const pLeft = toGrid(x, cy);
    const pRight = toGrid(x + w, cy);

    drawLine(x, cy, cx, y);
    drawLine(cx, y, x + w, cy);
    drawLine(x + w, cy, cx, y + h);
    drawLine(cx, y + h, x, cy);

    // Fix corners
    setChar(pTop.x, pTop.y, '╷');
    setChar(pBottom.x, pBottom.y, '╵');
    setChar(pLeft.x, pLeft.y, '╶');
    setChar(pRight.x, pRight.y, '╴');
  }

  function drawEllipse(x, y, w, h) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = w / 2;
    const ry = h / 2;

    const steps = Math.max(16, Math.floor((w + h) / 10));
    let prevP = null;
    
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const px = cx + rx * Math.cos(angle);
      const py = cy + ry * Math.sin(angle);
      const p = toGrid(px, py);
      
      if (prevP) {
        const dx = p.x - prevP.x;
        const dy = p.y - prevP.y;
        if (Math.abs(dx) > Math.abs(dy)) {
          setChar(p.x, p.y, '─');
        } else {
          setChar(p.x, p.y, '│');
        }
      }
      prevP = p;
    }
  }

  function drawText(x, y, text) {
    if (!showText || !text) return;
    const p = toGrid(x, y);
    const chars = text.split('');
    for (let i = 0; i < chars.length; i++) {
      setChar(p.x + i, p.y, chars[i]);
    }
  }

  // Sort elements by z-index (seed)
  const sortedElements = [...elements].sort((a, b) => (a.seed || 0) - (b.seed || 0));

  // Draw elements
  sortedElements.forEach(el => {
    const type = el.type;
    
    if (type === 'rectangle') {
      drawRect(el.x, el.y, el.width, el.height);
      if (el.boundElements) {
        el.boundElements.forEach(be => {
          const textEl = elements.find(e => e.id === be.id);
          if (textEl && textEl.type === 'text') {
            drawText(textEl.x, textEl.y, textEl.text);
          }
        });
      }
    } else if (type === 'diamond') {
      drawDiamond(el.x, el.y, el.width, el.height);
    } else if (type === 'ellipse') {
      drawEllipse(el.x, el.y, el.width, el.height);
    } else if (type === 'line' || type === 'arrow') {
      const points = el.points || [];
      for (let i = 0; i < points.length - 1; i++) {
        drawLine(
          el.x + points[i][0],
          el.y + points[i][1],
          el.x + points[i + 1][0],
          el.y + points[i + 1][1]
        );
      }
      // Arrow head
      if (type === 'arrow' && points.length >= 2) {
        const last = points[points.length - 1];
        const prev = points[points.length - 2];
        const ax = el.x + last[0];
        const ay = el.y + last[1];
        const p = toGrid(ax, ay);
        
        // Simple arrow direction
        const dx = last[0] - prev[0];
        const dy = last[1] - prev[1];
        if (Math.abs(dx) > Math.abs(dy)) {
          setChar(p.x, p.y, dx > 0 ? '>' : '<');
        } else {
          setChar(p.x, p.y, dy > 0 ? 'v' : '^');
        }
      }
    } else if (type === 'text' && !el.containerId) {
      drawText(el.x, el.y, el.text);
    }
  });

  // Convert to string
  const lines = grid.map(row => row.join('').replace(/\s+$/, ''));
  // Remove empty lines at start/end
  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
  
  const ascii = lines.join('\n');
  const stats = `${elements.length} elements · ${gridW}×${gridH} grid · ${(ascii || '').length} chars`;
  
  return { 
    ascii: ascii || '(empty result)', 
    stats 
  };
}

export function validateFile(file) {
  if (!file) return 'No file selected';
  if (!file.name.endsWith('.excalidraw') && !file.name.endsWith('.json')) {
    return 'Please select an .excalidraw or .json file';
  }
  return null;
}