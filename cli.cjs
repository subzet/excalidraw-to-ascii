#!/usr/bin/env node

/**
 * CLI tool to convert Excalidraw files to ASCII
 * Usage: node cli.js <file.excalidraw> [options]
 */

const fs = require('fs');
const path = require('path');

// ASCII rendering logic (inline since we can't easily import ES modules)
function renderASCII(data, options = {}) {
  const { showText = true, doubleLines = false, scale = 1 } = options;
  const elements = data.elements || [];
  
  if (elements.length === 0) {
    return { ascii: '', stats: 'No elements found' };
  }

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

  const padding = 20;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  const gridW = Math.ceil((maxX - minX) * scale / 8);
  const gridH = Math.ceil((maxY - minY) * scale / 16);
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
      setChar(x, y, dy < dx ? '─' : '│');
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

    for (let i = left + 1; i < right; i++) {
      setChar(i, top, hLine);
      setChar(i, bottom, hLine);
    }
    for (let i = top + 1; i < bottom; i++) {
      setChar(left, i, vLine);
      setChar(right, i, vLine);
    }
    setChar(left, top, tl);
    setChar(right, top, tr);
    setChar(left, bottom, bl);
    setChar(right, bottom, br);
  }

  function drawDiamond(x, y, w, h) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    drawLine(x, cy, cx, y);
    drawLine(cx, y, x + w, cy);
    drawLine(x + w, cy, cx, y + h);
    drawLine(cx, y + h, x, cy);
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
        setChar(p.x, p.y, Math.abs(p.x - prevP.x) > Math.abs(p.y - prevP.y) ? '─' : '│');
      }
      prevP = p;
    }
  }

  function drawText(x, y, text) {
    if (!showText || !text) return;
    const p = toGrid(x, y);
    text.split('').forEach((char, i) => setChar(p.x + i, p.y, char));
  }

  const sortedElements = [...elements].sort((a, b) => (a.seed || 0) - (b.seed || 0));

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
        drawLine(el.x + points[i][0], el.y + points[i][1], 
                 el.x + points[i + 1][0], el.y + points[i + 1][1]);
      }
      if (type === 'arrow' && points.length >= 2) {
        const last = points[points.length - 1];
        const prev = points[points.length - 2];
        const p = toGrid(el.x + last[0], el.y + last[1]);
        const dx = last[0] - prev[0];
        const dy = last[1] - prev[1];
        setChar(p.x, p.y, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '>' : '<') : (dy > 0 ? 'v' : '^'));
      }
    } else if (type === 'text' && !el.containerId) {
      drawText(el.x, el.y, el.text);
    }
  });

  const lines = grid.map(row => row.join('').replace(/\s+$/, ''));
  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
  
  const ascii = lines.join('\n');
  return { 
    ascii: ascii || '(empty result)', 
    stats: `${elements.length} elements · ${gridW}×${gridH} grid · ${(ascii || '').length} chars`
  };
}

// CLI
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node cli.js <file.excalidraw> [options]

Options:
  --scale <n>       Scale factor (default: 1)
  --no-text         Hide text labels
  --double-lines    Use double-line borders
  --help, -h        Show this help

Examples:
  node cli.js test-wireframe.excalidraw
  node cli.js wireframe.excalidraw --scale 1.5 --double-lines
`);
  process.exit(0);
}

const filePath = args[0];
const options = {
  scale: 1,
  showText: true,
  doubleLines: false
};

// Parse options
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--scale' && args[i + 1]) {
    options.scale = parseFloat(args[i + 1]) || 1;
    i++;
  } else if (args[i] === '--no-text') {
    options.showText = false;
  } else if (args[i] === '--double-lines') {
    options.doubleLines = true;
  }
}

if (!fs.existsSync(filePath)) {
  console.error(`Error: File not found: ${filePath}`);
  process.exit(1);
}

try {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const result = renderASCII(data, options);
  
  console.log('\n' + '='.repeat(60));
  console.log('ASCII OUTPUT');
  console.log('='.repeat(60) + '\n');
  console.log(result.ascii);
  console.log('\n' + '-'.repeat(60));
  console.log(result.stats);
  console.log('-'.repeat(60) + '\n');
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
