// ===== PHOTOSHOP CLONE =====
// Gated: requires Store install
AppLauncher.register('photoshop', {
  title: 'Photoshop', icon: '🖼️',

  launch() {
    if (typeof StoreManager !== 'undefined' && !StoreManager.isInstalled('photoshop')) {
      _showInstallGate('Photoshop', '🖼️', 'photoshop'); return;
    }

    const id = WM.create({ title:'Adobe Photoshop', icon:'🖼️', width:1100, height:720, appId:'photoshop' });
    const content = WM.getContent(id);
    content.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;background:#1e1e1e;color:#fff;user-select:none;';

    const state = {
      tool: 'brush',
      brushSize: 12,
      brushColor: '#ff0000',
      opacity: 100,
      zoom: 1,
      image: null,       // ImageData or null
      history: [],
      historyIdx: -1,
    };

    const TOOLS = [
      { id:'brush',   icon:'🖌️', label:'Brush' },
      { id:'eraser',  icon:'🧹', label:'Eraser' },
      { id:'crop',    icon:'✂️',  label:'Crop' },
      { id:'text',    icon:'T',   label:'Text' },
      { id:'eyedrop', icon:'💧', label:'Eyedropper' },
      { id:'fill',    icon:'🪣', label:'Fill' },
    ];

    const FILTERS = [
      { id:'grayscale',  label:'Grayscale' },
      { id:'sepia',      label:'Sepia' },
      { id:'invert',     label:'Invert' },
      { id:'blur',       label:'Blur' },
      { id:'sharpen',    label:'Sharpen' },
      { id:'brightness', label:'Brightness +' },
      { id:'darken',     label:'Brightness −' },
      { id:'contrast',   label:'Contrast +' },
      { id:'saturate',   label:'Saturate' },
      { id:'hue',        label:'Hue Rotate' },
    ];

    content.innerHTML = `
      <!-- Menu bar -->
      <div style="display:flex;align-items:center;gap:0;background:#2d2d2d;border-bottom:1px solid #111;flex-shrink:0;padding:0 8px;">
        ${['File','Edit','Image','Layer','Filter','View','Help'].map(m=>`
          <button class="ps-menu-${id}" data-menu="${m}" style="padding:6px 12px;background:transparent;border:none;color:#ccc;cursor:pointer;font-size:12px;transition:background 0.1s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='transparent'">${m}</button>`).join('')}
        <div style="flex:1;"></div>
        <span style="font-size:11px;color:rgba(255,255,255,0.4);padding-right:8px;">Adobe Photoshop 2025</span>
      </div>
      <!-- Options bar -->
      <div style="display:flex;align-items:center;gap:12px;padding:6px 12px;background:#2d2d2d;border-bottom:1px solid #111;flex-shrink:0;">
        <span style="font-size:12px;color:#aaa;">Brush Size:</span>
        <input type="range" id="ps-size-${id}" min="1" max="80" value="${state.brushSize}" style="width:100px;accent-color:#0e72ed;" />
        <span id="ps-size-val-${id}" style="font-size:12px;color:#ccc;min-width:28px;">${state.brushSize}px</span>
        <span style="font-size:12px;color:#aaa;">Color:</span>
        <input type="color" id="ps-color-${id}" value="${state.brushColor}" style="width:32px;height:24px;border:none;border-radius:4px;cursor:pointer;background:transparent;" />
        <span style="font-size:12px;color:#aaa;">Opacity:</span>
        <input type="range" id="ps-opacity-${id}" min="1" max="100" value="${state.opacity}" style="width:80px;accent-color:#0e72ed;" />
        <span id="ps-opacity-val-${id}" style="font-size:12px;color:#ccc;min-width:32px;">${state.opacity}%</span>
        <div style="flex:1;"></div>
        <span style="font-size:12px;color:#aaa;">Zoom:</span>
        <button id="ps-zoom-out-${id}" style="padding:2px 8px;background:rgba(255,255,255,0.08);border:none;border-radius:4px;color:#fff;cursor:pointer;">−</button>
        <span id="ps-zoom-val-${id}" style="font-size:12px;color:#ccc;min-width:40px;text-align:center;">${Math.round(state.zoom*100)}%</span>
        <button id="ps-zoom-in-${id}" style="padding:2px 8px;background:rgba(255,255,255,0.08);border:none;border-radius:4px;color:#fff;cursor:pointer;">+</button>
      </div>
      <!-- Main layout -->
      <div style="flex:1;display:flex;overflow:hidden;">
        <!-- Tools panel -->
        <div style="width:48px;background:#2d2d2d;border-right:1px solid #111;display:flex;flex-direction:column;align-items:center;padding:8px 0;gap:4px;flex-shrink:0;">
          ${TOOLS.map(t=>`
            <button data-tool="${t.id}" title="${t.label}" style="width:36px;height:36px;background:${state.tool===t.id?'#0e72ed':'transparent'};border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:background 0.1s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='${state.tool===t.id?'#0e72ed':'transparent'}'">
              ${t.icon}
            </button>`).join('')}
          <div style="width:28px;height:1px;background:rgba(255,255,255,0.1);margin:4px 0;"></div>
          <div style="position:relative;width:36px;height:36px;cursor:pointer;" title="Foreground/Background color">
            <div style="position:absolute;bottom:0;right:0;width:22px;height:22px;background:#fff;border:2px solid #555;border-radius:2px;"></div>
            <div id="ps-fg-swatch-${id}" style="position:absolute;top:0;left:0;width:22px;height:22px;background:${state.brushColor};border:2px solid #888;border-radius:2px;"></div>
          </div>
        </div>
        <!-- Canvas area -->
        <div style="flex:1;overflow:auto;background:#404040;display:flex;align-items:center;justify-content:center;position:relative;" id="ps-canvas-wrap-${id}">
          <div id="ps-canvas-container-${id}" style="position:relative;box-shadow:0 4px 24px rgba(0,0,0,0.6);">
            <canvas id="ps-canvas-${id}" style="display:block;cursor:crosshair;"></canvas>
          </div>
          <div id="ps-empty-${id}" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;pointer-events:none;">
            <div style="font-size:64px;opacity:0.3;">🖼️</div>
            <div style="font-size:16px;color:rgba(255,255,255,0.4);">Open an image or create a new canvas</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.25);">File → Open Image  or  File → New</div>
          </div>
        </div>
        <!-- Right panel: Filters + Adjustments -->
        <div style="width:220px;background:#2d2d2d;border-left:1px solid #111;display:flex;flex-direction:column;overflow-y:auto;flex-shrink:0;">
          <div style="padding:10px 12px;font-size:12px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #111;">Adjustments</div>
          <div style="padding:10px 12px;display:flex;flex-direction:column;gap:10px;">
            ${[
              {id:'brightness',label:'Brightness',min:-100,max:100,def:0},
              {id:'contrast',label:'Contrast',min:-100,max:100,def:0},
              {id:'saturation',label:'Saturation',min:-100,max:100,def:0},
              {id:'hue',label:'Hue Rotate',min:0,max:360,def:0},
              {id:'blur_amt',label:'Blur',min:0,max:10,def:0},
            ].map(f=>`
              <div>
                <div style="display:flex;justify-content:space-between;font-size:11px;color:#aaa;margin-bottom:3px;">
                  <span>${f.label}</span><span id="ps-adj-val-${f.id}-${id}">${f.def}</span>
                </div>
                <input type="range" id="ps-adj-${f.id}-${id}" min="${f.min}" max="${f.max}" value="${f.def}" style="width:100%;accent-color:#0e72ed;" />
              </div>
            `).join('')}
            <button id="ps-apply-adj-${id}" style="padding:6px;background:#0e72ed;border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:12px;margin-top:4px;">Apply Adjustments</button>
            <button id="ps-reset-adj-${id}" style="padding:6px;background:rgba(255,255,255,0.08);border:none;border-radius:4px;color:#ccc;cursor:pointer;font-size:12px;">Reset</button>
          </div>
          <div style="padding:10px 12px;font-size:12px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #111;border-top:1px solid #111;">Quick Filters</div>
          ${[
            {id:'grayscale',label:'Grayscale'},
            {id:'sepia',label:'Sepia'},
            {id:'invert',label:'Invert'},
            {id:'sharpen',label:'Sharpen'},
          ].map(f=>`
            <button data-filter="${f.id}" style="padding:8px 12px;background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,0.04);color:#ccc;cursor:pointer;font-size:12px;text-align:left;transition:background 0.1s;" onmouseover="this.style.background='rgba(255,255,255,0.07)'" onmouseout="this.style.background='transparent'">${f.label}</button>`).join('')}
          <div style="padding:10px 12px;font-size:12px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #111;border-top:1px solid #111;margin-top:4px;">History</div>
          <div id="ps-history-${id}" style="flex:1;overflow-y:auto;padding:4px 0;font-size:11px;color:#888;"></div>
        </div>
      </div>
      <!-- Status bar -->
      <div style="padding:4px 12px;background:#2d2d2d;border-top:1px solid #111;font-size:11px;color:#888;display:flex;gap:16px;flex-shrink:0;">
        <span id="ps-status-${id}">Ready</span>
        <span id="ps-coords-${id}">0, 0</span>
        <div style="flex:1;"></div>
        <span id="ps-doc-info-${id}">No document</span>
      </div>`;

    const canvas = document.getElementById(`ps-canvas-${id}`);
    const ctx = canvas.getContext('2d');
    const emptyMsg = document.getElementById(`ps-empty-${id}`);

    const initCanvas = (w=800, h=600) => {
      canvas.width = w; canvas.height = h;
      canvas.style.width = (w * state.zoom) + 'px';
      canvas.style.height = (h * state.zoom) + 'px';
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      emptyMsg.style.display = 'none';
      pushHistory();
      updateDocInfo();
    };

    const pushHistory = () => {
      state.history = state.history.slice(0, state.historyIdx + 1);
      state.history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (state.history.length > 30) state.history.shift();
      state.historyIdx = state.history.length - 1;
      updateHistoryPanel();
    };

    const undo = () => {
      if (state.historyIdx > 0) {
        state.historyIdx--;
        ctx.putImageData(state.history[state.historyIdx], 0, 0);
        updateHistoryPanel();
      }
    };

    const redo = () => {
      if (state.historyIdx < state.history.length - 1) {
        state.historyIdx++;
        ctx.putImageData(state.history[state.historyIdx], 0, 0);
        updateHistoryPanel();
      }
    };

    const updateHistoryPanel = () => {
      const el = document.getElementById(`ps-history-${id}`);
      if (!el) return;
      el.innerHTML = state.history.slice(0, state.historyIdx+1).map((_, i) =>
        `<div style="padding:4px 12px;background:${i===state.historyIdx?'rgba(14,114,237,0.2)':'transparent'};">Step ${i+1}</div>`
      ).reverse().join('');
    };

    const updateDocInfo = () => {
      const el = document.getElementById(`ps-doc-info-${id}`);
      if (el) el.textContent = `${canvas.width} × ${canvas.height} px`;
    };

    const applyFilter = (filterId) => {
      if (!canvas.width) return;
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const r=d[i], g=d[i+1], b=d[i+2];
        if (filterId === 'grayscale') {
          const gray = 0.299*r + 0.587*g + 0.114*b;
          d[i]=d[i+1]=d[i+2]=gray;
        } else if (filterId === 'sepia') {
          d[i]   = Math.min(255, r*0.393+g*0.769+b*0.189);
          d[i+1] = Math.min(255, r*0.349+g*0.686+b*0.168);
          d[i+2] = Math.min(255, r*0.272+g*0.534+b*0.131);
        } else if (filterId === 'invert') {
          d[i]=255-r; d[i+1]=255-g; d[i+2]=255-b;
        } else if (filterId === 'brightness') {
          d[i]=Math.min(255,r+30); d[i+1]=Math.min(255,g+30); d[i+2]=Math.min(255,b+30);
        } else if (filterId === 'darken') {
          d[i]=Math.max(0,r-30); d[i+1]=Math.max(0,g-30); d[i+2]=Math.max(0,b-30);
        } else if (filterId === 'contrast') {
          const factor = 1.5;
          d[i]=Math.min(255,Math.max(0,(r-128)*factor+128));
          d[i+1]=Math.min(255,Math.max(0,(g-128)*factor+128));
          d[i+2]=Math.min(255,Math.max(0,(b-128)*factor+128));
        } else if (filterId === 'saturate') {
          const gray=0.299*r+0.587*g+0.114*b;
          d[i]=Math.min(255,gray+(r-gray)*1.8);
          d[i+1]=Math.min(255,gray+(g-gray)*1.8);
          d[i+2]=Math.min(255,gray+(b-gray)*1.8);
        } else if (filterId === 'hue') {
          // Simple hue shift via HSL
          const max=Math.max(r,g,b)/255, min=Math.min(r,g,b)/255;
          let h2=0, s2=0, l=(max+min)/2;
          if(max!==min){s2=l>0.5?(max-min)/(2-max-min):(max-min)/(max+min);const d2=max-min;if(max===r/255)h2=(g/255-b/255)/d2+(g<b?6:0);else if(max===g/255)h2=(b/255-r/255)/d2+2;else h2=(r/255-g/255)/d2+4;h2/=6;}
          h2=(h2+0.1)%1;
          const hue2rgb=(p,q,t)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;};
          const q2=l<0.5?l*(1+s2):l+s2-l*s2, p2=2*l-q2;
          d[i]=Math.round(hue2rgb(p2,q2,h2+1/3)*255);
          d[i+1]=Math.round(hue2rgb(p2,q2,h2)*255);
          d[i+2]=Math.round(hue2rgb(p2,q2,h2-1/3)*255);
        }
      }
      // Blur: simple box blur
      if (filterId === 'blur' || filterId === 'sharpen') {
        const orig = new Uint8ClampedArray(d);
        const w = canvas.width;
        for (let y=1; y<canvas.height-1; y++) for (let x=1; x<w-1; x++) {
          const idx=(y*w+x)*4;
          for (let c=0; c<3; c++) {
            const avg=(orig[idx-4-w*4+c]+orig[idx-w*4+c]+orig[idx+4-w*4+c]+
                       orig[idx-4+c]+orig[idx+c]+orig[idx+4+c]+
                       orig[idx-4+w*4+c]+orig[idx+w*4+c]+orig[idx+4+w*4+c])/9;
            d[idx+c] = filterId==='sharpen' ? Math.min(255,Math.max(0,orig[idx+c]*2-avg)) : avg;
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
      pushHistory();
      document.getElementById(`ps-status-${id}`).textContent = `Filter applied: ${filterId}`;
    };

    // ── Drawing ───────────────────────────────────────────────────────────
    let drawing = false, lastX = 0, lastY = 0;

    const getCanvasPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / state.zoom,
        y: (e.clientY - rect.top) / state.zoom,
      };
    };

    canvas.addEventListener('mousedown', e => {
      if (!canvas.width) return;
      drawing = true;
      const pos = getCanvasPos(e);
      lastX = pos.x; lastY = pos.y;

      if (state.tool === 'fill') {
        ctx.fillStyle = state.brushColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        pushHistory(); return;
      }
      if (state.tool === 'text') {
        const txt = prompt('Enter text:');
        if (txt) {
          ctx.fillStyle = state.brushColor;
          ctx.font = `${state.brushSize * 2}px Segoe UI`;
          ctx.globalAlpha = state.opacity / 100;
          ctx.fillText(txt, pos.x, pos.y);
          ctx.globalAlpha = 1;
          pushHistory();
        }
        drawing = false; return;
      }
      if (state.tool === 'eyedrop') {
        const pixel = ctx.getImageData(Math.floor(pos.x), Math.floor(pos.y), 1, 1).data;
        const hex = '#' + [pixel[0],pixel[1],pixel[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
        state.brushColor = hex;
        document.getElementById(`ps-color-${id}`).value = hex;
        document.getElementById(`ps-fg-swatch-${id}`).style.background = hex;
        drawing = false; return;
      }
    });

    canvas.addEventListener('mousemove', e => {
      const pos = getCanvasPos(e);
      const coordEl = document.getElementById(`ps-coords-${id}`);
      if (coordEl) coordEl.textContent = `${Math.round(pos.x)}, ${Math.round(pos.y)}`;
      if (!drawing) return;

      ctx.globalAlpha = state.opacity / 100;
      ctx.lineWidth = state.brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (state.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = state.brushColor;
      }

      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      lastX = pos.x; lastY = pos.y;
    });

    canvas.addEventListener('mouseup', () => { if (drawing) { drawing=false; pushHistory(); } });
    canvas.addEventListener('mouseleave', () => { if (drawing) { drawing=false; pushHistory(); } });

    // ── Controls ──────────────────────────────────────────────────────────
    document.getElementById(`ps-size-${id}`).addEventListener('input', e => {
      state.brushSize = parseInt(e.target.value);
      document.getElementById(`ps-size-val-${id}`).textContent = state.brushSize + 'px';
    });
    document.getElementById(`ps-color-${id}`).addEventListener('input', e => {
      state.brushColor = e.target.value;
      document.getElementById(`ps-fg-swatch-${id}`).style.background = e.target.value;
    });
    document.getElementById(`ps-opacity-${id}`).addEventListener('input', e => {
      state.opacity = parseInt(e.target.value);
      document.getElementById(`ps-opacity-val-${id}`).textContent = state.opacity + '%';
    });
    document.getElementById(`ps-zoom-in-${id}`).addEventListener('click', () => {
      state.zoom = Math.min(4, state.zoom + 0.25);
      canvas.style.width = (canvas.width * state.zoom) + 'px';
      canvas.style.height = (canvas.height * state.zoom) + 'px';
      document.getElementById(`ps-zoom-val-${id}`).textContent = Math.round(state.zoom*100) + '%';
    });
    document.getElementById(`ps-zoom-out-${id}`).addEventListener('click', () => {
      state.zoom = Math.max(0.25, state.zoom - 0.25);
      canvas.style.width = (canvas.width * state.zoom) + 'px';
      canvas.style.height = (canvas.height * state.zoom) + 'px';
      document.getElementById(`ps-zoom-val-${id}`).textContent = Math.round(state.zoom*100) + '%';
    });

    // Tool buttons
    content.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.tool = btn.dataset.tool;
        content.querySelectorAll('[data-tool]').forEach(b => {
          b.style.background = b.dataset.tool === state.tool ? '#0e72ed' : 'transparent';
        });
        canvas.style.cursor = state.tool === 'eyedrop' ? 'crosshair' : state.tool === 'text' ? 'text' : 'crosshair';
      });
    });

    // Filter buttons
    content.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!canvas.width) { Notifications.send('Photoshop', 'Open an image first.', '🖼️'); return; }
        applyFilter(btn.dataset.filter);
      });
    });

    // Adjustment sliders
    const adjSliders = ['brightness','contrast','saturation','hue','blur_amt'];
    adjSliders.forEach(adj => {
      const slider = document.getElementById(`ps-adj-${adj}-${id}`);
      const valEl = document.getElementById(`ps-adj-val-${adj}-${id}`);
      if (slider && valEl) {
        slider.addEventListener('input', () => { valEl.textContent = slider.value; });
      }
    });

    const applyAdjustments = () => {
      if (!canvas.width) { Notifications.send('Photoshop', 'Open an image first.', '🖼️'); return; }
      const brightness = parseInt(document.getElementById(`ps-adj-brightness-${id}`)?.value || 0);
      const contrast = parseInt(document.getElementById(`ps-adj-contrast-${id}`)?.value || 0);
      const saturation = parseInt(document.getElementById(`ps-adj-saturation-${id}`)?.value || 0);
      const hueVal = parseInt(document.getElementById(`ps-adj-hue-${id}`)?.value || 0);
      const blurAmt = parseInt(document.getElementById(`ps-adj-blur_amt-${id}`)?.value || 0);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;
      const bFactor = brightness / 100 * 80; // -80 to +80
      const cFactor = (contrast + 100) / 100; // 0 to 2
      const sFactor = (saturation + 100) / 100; // 0 to 2

      for (let i = 0; i < d.length; i += 4) {
        let r = d[i], g = d[i+1], b = d[i+2];
        // Brightness
        r = Math.min(255, Math.max(0, r + bFactor));
        g = Math.min(255, Math.max(0, g + bFactor));
        b = Math.min(255, Math.max(0, b + bFactor));
        // Contrast
        r = Math.min(255, Math.max(0, (r - 128) * cFactor + 128));
        g = Math.min(255, Math.max(0, (g - 128) * cFactor + 128));
        b = Math.min(255, Math.max(0, (b - 128) * cFactor + 128));
        // Saturation
        const gray = 0.299*r + 0.587*g + 0.114*b;
        r = Math.min(255, Math.max(0, gray + (r - gray) * sFactor));
        g = Math.min(255, Math.max(0, gray + (g - gray) * sFactor));
        b = Math.min(255, Math.max(0, gray + (b - gray) * sFactor));
        d[i] = r; d[i+1] = g; d[i+2] = b;
      }
      ctx.putImageData(imgData, 0, 0);

      // Apply hue rotation via CSS filter temporarily then re-draw
      if (hueVal !== 0) {
        const tmp = document.createElement('canvas');
        tmp.width = canvas.width; tmp.height = canvas.height;
        const tc = tmp.getContext('2d');
        tc.filter = `hue-rotate(${hueVal}deg)`;
        tc.drawImage(canvas, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tmp, 0, 0);
      }

      // Blur
      if (blurAmt > 0) {
        const tmp2 = document.createElement('canvas');
        tmp2.width = canvas.width; tmp2.height = canvas.height;
        const tc2 = tmp2.getContext('2d');
        tc2.filter = `blur(${blurAmt}px)`;
        tc2.drawImage(canvas, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tmp2, 0, 0);
      }

      pushHistory();
      document.getElementById(`ps-status-${id}`).textContent = 'Adjustments applied';
    };

    const applyBtn = document.getElementById(`ps-apply-adj-${id}`);
    if (applyBtn) applyBtn.addEventListener('click', applyAdjustments);

    const resetAdjBtn = document.getElementById(`ps-reset-adj-${id}`);
    if (resetAdjBtn) resetAdjBtn.addEventListener('click', () => {
      adjSliders.forEach(adj => {
        const slider = document.getElementById(`ps-adj-${adj}-${id}`);
        const valEl = document.getElementById(`ps-adj-val-${adj}-${id}`);
        if (slider) { slider.value = adj === 'hue' ? 0 : adj === 'blur_amt' ? 0 : 0; }
        if (valEl) valEl.textContent = '0';
      });
    });

    // Menu bar
    content.querySelectorAll(`.ps-menu-${id}`).forEach(btn => {
      btn.addEventListener('click', () => {
        const menu = btn.dataset.menu;
        if (menu === 'File') {
          const action = prompt('File menu:\n1. New (800×600)\n2. New (1920×1080)\n3. Open Image\n4. Save PNG\n5. Save JPG\nEnter number:');
          if (action === '1') initCanvas(800, 600);
          else if (action === '2') initCanvas(1920, 1080);
          else if (action === '3') {
            const inp = document.createElement('input');
            inp.type = 'file'; inp.accept = 'image/*';
            inp.onchange = e => {
              const file = e.target.files[0]; if (!file) return;
              const reader = new FileReader();
              reader.onload = ev => {
                const img = new Image();
                img.onload = () => {
                  initCanvas(img.width, img.height);
                  ctx.drawImage(img, 0, 0);
                  pushHistory();
                  document.getElementById(`ps-status-${id}`).textContent = `Opened: ${file.name}`;
                };
                img.src = ev.target.result;
              };
              reader.readAsDataURL(file);
            };
            inp.click();
          } else if (action === '4' || action === '5') {
            if (!canvas.width) return;
            const type = action === '4' ? 'image/png' : 'image/jpeg';
            const ext = action === '4' ? 'png' : 'jpg';
            const ts = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
            const fname = `photoshop_${ts}.${ext}`;
            const dataUrl = canvas.toDataURL(type, 0.92);
            // Save to VFS Pictures
            FS.writeFile('C:/Users/User/Pictures/' + fname, dataUrl);
            // Real download
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = fname;
            a.click();
            Notifications.send('Photoshop', `Saved to Pictures: ${fname}`, '💾');
          }
        } else if (menu === 'Edit') {
          const action = prompt('Edit menu:\n1. Undo\n2. Redo\n3. Clear Canvas\nEnter number:');
          if (action === '1') undo();
          else if (action === '2') redo();
          else if (action === '3') { ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); pushHistory(); }
        } else if (menu === 'Image') {
          const action = prompt('Image menu:\n1. Resize\n2. Rotate 90°\n3. Flip Horizontal\n4. Flip Vertical\nEnter number:');
          if (action === '1') {
            const w = parseInt(prompt('New width:', canvas.width));
            const h = parseInt(prompt('New height:', canvas.height));
            if (w > 0 && h > 0) {
              const tmp = document.createElement('canvas');
              tmp.width=w; tmp.height=h;
              tmp.getContext('2d').drawImage(canvas, 0, 0, w, h);
              initCanvas(w, h);
              ctx.drawImage(tmp, 0, 0);
              pushHistory();
            }
          } else if (action === '2') {
            const tmp = document.createElement('canvas');
            tmp.width=canvas.height; tmp.height=canvas.width;
            const tc=tmp.getContext('2d');
            tc.translate(tmp.width/2,tmp.height/2); tc.rotate(Math.PI/2);
            tc.drawImage(canvas,-canvas.width/2,-canvas.height/2);
            initCanvas(tmp.width,tmp.height); ctx.drawImage(tmp,0,0); pushHistory();
          } else if (action === '3') {
            const tmp=document.createElement('canvas'); tmp.width=canvas.width; tmp.height=canvas.height;
            const tc=tmp.getContext('2d'); tc.translate(canvas.width,0); tc.scale(-1,1); tc.drawImage(canvas,0,0);
            ctx.drawImage(tmp,0,0); pushHistory();
          } else if (action === '4') {
            const tmp=document.createElement('canvas'); tmp.width=canvas.width; tmp.height=canvas.height;
            const tc=tmp.getContext('2d'); tc.translate(0,canvas.height); tc.scale(1,-1); tc.drawImage(canvas,0,0);
            ctx.drawImage(tmp,0,0); pushHistory();
          }
        }
      });
    });

    // Keyboard shortcuts
    const psKh = e => {
      if (!document.getElementById(id)) return;
      if ((e.ctrlKey||e.metaKey) && e.key==='z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey||e.metaKey) && e.key==='y') { e.preventDefault(); redo(); }
      if (e.key==='b') { state.tool='brush'; content.querySelectorAll('[data-tool]').forEach(b=>b.style.background=b.dataset.tool==='brush'?'#0e72ed':'transparent'); }
      if (e.key==='e') { state.tool='eraser'; content.querySelectorAll('[data-tool]').forEach(b=>b.style.background=b.dataset.tool==='eraser'?'#0e72ed':'transparent'); }
    };
    document.addEventListener('keydown', psKh);

    const obs = new MutationObserver(() => {
      if (!document.getElementById(id)) { document.removeEventListener('keydown', psKh); obs.disconnect(); }
    });
    obs.observe(document.getElementById('windows-container'), {childList:true});
  }
});
