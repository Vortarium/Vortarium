// ===== PAINT APP =====
AppLauncher.register('paint', {
  title: 'Paint',
  icon: '🎨',

  launch() {
    const id = WM.create({
      title: 'Paint',
      icon: '🎨',
      width: 860,
      height: 580,
      appId: 'paint',
    });

    const content = WM.getContent(id);
    content.innerHTML = `
      <div class="paint-toolbar">
        <div class="paint-tool-group">
          <button class="paint-btn active" data-tool="pencil" title="Pencil">✏️</button>
          <button class="paint-btn" data-tool="brush" title="Brush">🖌️</button>
          <button class="paint-btn" data-tool="eraser" title="Eraser">🧹</button>
          <button class="paint-btn" data-tool="fill" title="Fill">🪣</button>
          <button class="paint-btn" data-tool="line" title="Line">╱</button>
          <button class="paint-btn" data-tool="rect" title="Rectangle">▭</button>
          <button class="paint-btn" data-tool="circle" title="Circle">○</button>
          <button class="paint-btn" data-tool="text" title="Text">T</button>
        </div>
        <div class="paint-tool-group">
          <label style="font-size:11px;color:var(--text-muted)">Size</label>
          <input type="range" id="paint-size-${id}" min="1" max="50" value="4" style="width:80px;accent-color:var(--accent)" />
          <span id="paint-size-val-${id}" style="font-size:11px;color:var(--text-muted);min-width:20px">4</span>
        </div>
        <div class="paint-tool-group">
          <div class="paint-color-palette" id="paint-palette-${id}"></div>
          <input type="color" id="paint-custom-color-${id}" value="#ffffff" title="Custom Color" style="width:28px;height:28px;border:none;border-radius:4px;cursor:pointer;background:none;padding:0" />
        </div>
        <div class="paint-tool-group">
          <button class="paint-btn" id="paint-clear-${id}" title="Clear">🗑️</button>
          <button class="paint-btn" id="paint-undo-${id}" title="Undo">↩️</button>
          <button class="paint-btn" id="paint-save-${id}" title="Save">💾</button>
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-left:auto">
          <span style="font-size:11px;color:var(--text-muted)" id="paint-coords-${id}">0, 0</span>
        </div>
      </div>
      <div class="paint-canvas-wrap">
        <canvas id="paint-canvas-${id}" width="800" height="500"></canvas>
      </div>
    `;

    const canvas = document.getElementById(`paint-canvas-${id}`);
    const ctx = canvas.getContext('2d');
    const sizeInput = document.getElementById(`paint-size-${id}`);
    const sizeVal = document.getElementById(`paint-size-val-${id}`);
    const coordsEl = document.getElementById(`paint-coords-${id}`);

    // Fill canvas white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const state = {
      tool: 'pencil',
      color: '#000000',
      size: 4,
      drawing: false,
      lastX: 0, lastY: 0,
      startX: 0, startY: 0,
      history: [],
      snapshot: null,
    };

    // Save initial state
    state.history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));

    // Color palette
    const colors = [
      '#000000','#ffffff','#808080','#c0c0c0',
      '#ff0000','#800000','#ff6600','#804000',
      '#ffff00','#808000','#00ff00','#008000',
      '#00ffff','#008080','#0000ff','#000080',
      '#ff00ff','#800080','#ff69b4','#ffd700',
    ];

    const palette = document.getElementById(`paint-palette-${id}`);
    colors.forEach(c => {
      const swatch = document.createElement('div');
      swatch.className = 'paint-color' + (c === state.color ? ' selected' : '');
      swatch.style.background = c;
      swatch.style.border = c === '#ffffff' ? '1px solid #ccc' : '';
      swatch.addEventListener('click', () => {
        palette.querySelectorAll('.paint-color').forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');
        state.color = c;
        document.getElementById(`paint-custom-color-${id}`).value = c;
      });
      palette.appendChild(swatch);
    });

    document.getElementById(`paint-custom-color-${id}`).addEventListener('input', (e) => {
      state.color = e.target.value;
      palette.querySelectorAll('.paint-color').forEach(s => s.classList.remove('selected'));
    });

    // Tool selection
    document.querySelectorAll(`#${id} .paint-btn[data-tool]`).forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll(`#${id} .paint-btn[data-tool]`).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.tool = btn.dataset.tool;
        canvas.style.cursor = state.tool === 'eraser' ? 'cell' : state.tool === 'fill' ? 'crosshair' : 'crosshair';
      });
    });

    // Size
    sizeInput.addEventListener('input', (e) => {
      state.size = parseInt(e.target.value);
      sizeVal.textContent = state.size;
    });

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.round(e.clientX - rect.left),
        y: Math.round(e.clientY - rect.top)
      };
    };

    const saveHistory = () => {
      state.history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (state.history.length > 30) state.history.shift();
    };

    const floodFill = (x, y, fillColor) => {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const idx = (y * canvas.width + x) * 4;
      const targetR = data[idx], targetG = data[idx+1], targetB = data[idx+2], targetA = data[idx+3];

      const fc = hexToRgb(fillColor);
      if (!fc) return;
      if (targetR === fc.r && targetG === fc.g && targetB === fc.b) return;

      const stack = [[x, y]];
      const visited = new Set();

      while (stack.length) {
        const [cx, cy] = stack.pop();
        const key = cx + ',' + cy;
        if (visited.has(key)) continue;
        if (cx < 0 || cx >= canvas.width || cy < 0 || cy >= canvas.height) continue;
        const i = (cy * canvas.width + cx) * 4;
        if (data[i] !== targetR || data[i+1] !== targetG || data[i+2] !== targetB || data[i+3] !== targetA) continue;
        visited.add(key);
        data[i] = fc.r; data[i+1] = fc.g; data[i+2] = fc.b; data[i+3] = 255;
        stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
      }
      ctx.putImageData(imageData, 0, 0);
    };

    const hexToRgb = (hex) => {
      const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return r ? { r: parseInt(r[1],16), g: parseInt(r[2],16), b: parseInt(r[3],16) } : null;
    };

    canvas.addEventListener('mousedown', (e) => {
      const pos = getPos(e);
      state.drawing = true;
      state.startX = pos.x;
      state.startY = pos.y;
      state.lastX = pos.x;
      state.lastY = pos.y;

      if (state.tool === 'fill') {
        saveHistory();
        floodFill(pos.x, pos.y, state.color);
        state.drawing = false;
        return;
      }

      if (state.tool === 'text') {
        const text = prompt('Enter text:');
        if (text) {
          saveHistory();
          ctx.fillStyle = state.color;
          ctx.font = `${state.size * 4}px Segoe UI`;
          ctx.fillText(text, pos.x, pos.y);
        }
        state.drawing = false;
        return;
      }

      if (['line','rect','circle'].includes(state.tool)) {
        state.snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      }

      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    });

    canvas.addEventListener('mousemove', (e) => {
      const pos = getPos(e);
      coordsEl.textContent = `${pos.x}, ${pos.y}`;

      if (!state.drawing) return;

      if (state.tool === 'pencil' || state.tool === 'brush') {
        ctx.strokeStyle = state.color;
        ctx.lineWidth = state.tool === 'brush' ? state.size * 2 : state.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
      } else if (state.tool === 'eraser') {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = state.size * 3;
        ctx.lineCap = 'round';
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
      } else if (state.tool === 'line') {
        ctx.putImageData(state.snapshot, 0, 0);
        ctx.strokeStyle = state.color;
        ctx.lineWidth = state.size;
        ctx.beginPath();
        ctx.moveTo(state.startX, state.startY);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      } else if (state.tool === 'rect') {
        ctx.putImageData(state.snapshot, 0, 0);
        ctx.strokeStyle = state.color;
        ctx.lineWidth = state.size;
        ctx.strokeRect(state.startX, state.startY, pos.x - state.startX, pos.y - state.startY);
      } else if (state.tool === 'circle') {
        ctx.putImageData(state.snapshot, 0, 0);
        ctx.strokeStyle = state.color;
        ctx.lineWidth = state.size;
        const rx = Math.abs(pos.x - state.startX) / 2;
        const ry = Math.abs(pos.y - state.startY) / 2;
        const cx = state.startX + (pos.x - state.startX) / 2;
        const cy = state.startY + (pos.y - state.startY) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      state.lastX = pos.x;
      state.lastY = pos.y;
    });

    canvas.addEventListener('mouseup', () => {
      if (state.drawing) {
        saveHistory();
        state.drawing = false;
        ctx.beginPath();
      }
    });

    canvas.addEventListener('mouseleave', () => {
      if (state.drawing) {
        state.drawing = false;
        ctx.beginPath();
      }
    });

    // Clear
    document.getElementById(`paint-clear-${id}`).addEventListener('click', () => {
      saveHistory();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });

    // Undo
    document.getElementById(`paint-undo-${id}`).addEventListener('click', () => {
      if (state.history.length > 1) {
        state.history.pop();
        ctx.putImageData(state.history[state.history.length - 1], 0, 0);
      }
    });

    // Save — saves to VFS Pictures AND triggers real download
    document.getElementById(`paint-save-${id}`).addEventListener('click', () => {
      const dataUrl = canvas.toDataURL('image/png');
      const ts = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
      const fname = `painting_${ts}.png`;
      // Save to VFS Pictures
      FS.writeFile('C:/Users/User/Pictures/' + fname, dataUrl);
      // Also trigger real browser download
      const link = document.createElement('a');
      link.download = fname;
      link.href = dataUrl;
      link.click();
      Notifications.send('Paint', `Saved to Pictures: ${fname}`, '💾');
    });
  }
});
