// ===== WIDGETS PANEL =====
const Widgets = {
  open: false,
  panel: null,
  intervals: [],
  tempUnit: 'F', // 'F' or 'C'

  init() {
    // Load saved temp unit
    try { this.tempUnit = localStorage.getItem('win12_temp_unit') || 'F'; } catch(e) {}

    document.getElementById('widgets-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
    document.addEventListener('click', (e) => {
      if (this.open && this.panel && !this.panel.contains(e.target) && e.target.id !== 'widgets-btn') {
        this.close();
      }
    });
  },

  toggle() { this.open ? this.close() : this.show(); },

  show() {
    this.open = true;
    if (this.panel) this.panel.remove();

    const panel = document.createElement('div');
    panel.id = 'widgets-panel';
    panel.style.cssText = `
      position:fixed;top:0;left:0;width:380px;height:calc(100vh - 48px);
      background:rgba(18,18,28,0.96);backdrop-filter:blur(40px) saturate(200%);
      border-right:1px solid rgba(255,255,255,0.08);z-index:800;
      overflow-y:auto;padding:20px 16px;display:flex;flex-direction:column;gap:14px;
      animation:slideInLeft 0.25s ease;
    `;

    if (!document.getElementById('widget-anim-style')) {
      const s = document.createElement('style');
      s.id = 'widget-anim-style';
      s.textContent = `
        @keyframes slideInLeft{from{opacity:0;transform:translateX(-30px)}to{opacity:1;transform:translateX(0)}}
        .widget-card{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px;flex-shrink:0;}
        .widget-title{font-size:12px;font-weight:600;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;}
        .temp-toggle-btn{padding:3px 10px;border:1px solid rgba(255,255,255,0.2);border-radius:12px;background:transparent;color:rgba(255,255,255,0.5);cursor:pointer;font-size:11px;transition:all 0.15s;}
        .temp-toggle-btn.active{background:var(--accent);border-color:var(--accent);color:#fff;}
      `;
      document.head.appendChild(s);
    }

    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
        <div style="font-size:18px;font-weight:600;">Widgets</div>
        <button id="widgets-close" style="background:transparent;border:none;color:rgba(255,255,255,0.5);cursor:pointer;font-size:18px;padding:4px 8px;border-radius:6px;">✕</button>
      </div>

      <!-- Date & Time -->
      <div class="widget-card">
        <div class="widget-title">Date & Time</div>
        <div id="w-time" style="font-size:42px;font-weight:200;line-height:1;"></div>
        <div id="w-date" style="font-size:14px;color:rgba(255,255,255,0.7);margin-top:4px;"></div>
      </div>

      <!-- Weather with C/F toggle -->
      <div class="widget-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div class="widget-title" style="margin-bottom:0;">🌡️ Weather — Rochester Hills, MI</div>
          <div style="display:flex;gap:4px;">
            <button class="temp-toggle-btn ${this.tempUnit==='F'?'active':''}" id="w-toggle-f">°F</button>
            <button class="temp-toggle-btn ${this.tempUnit==='C'?'active':''}" id="w-toggle-c">°C</button>
          </div>
        </div>
        <div id="w-weather-card"><div style="color:rgba(255,255,255,0.4);font-size:12px;">Loading weather...</div></div>
      </div>

      <!-- Battery -->
      <div class="widget-card">
        <div class="widget-title">Battery</div>
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="font-size:36px;" id="w-bat-icon">🔋</div>
          <div style="flex:1;">
            <div style="font-size:24px;font-weight:300;" id="w-bat-pct">--</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.5);" id="w-bat-status">Checking...</div>
            <div style="height:6px;background:rgba(255,255,255,0.1);border-radius:3px;margin-top:6px;overflow:hidden;">
              <div id="w-bat-bar" style="height:100%;background:var(--accent);border-radius:3px;transition:width 0.5s;width:0%;"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- System Stats -->
      <div class="widget-card">
        <div class="widget-title">System</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div>
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
              <span>CPU</span><span id="w-cpu">--</span>
            </div>
            <div style="height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;">
              <div id="w-cpu-bar" style="height:100%;background:#4ec9b0;border-radius:2px;transition:width 0.8s;width:0%;"></div>
            </div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
              <span>Memory</span><span id="w-mem">--</span>
            </div>
            <div style="height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;">
              <div id="w-mem-bar" style="height:100%;background:#569cd6;border-radius:2px;transition:width 0.8s;width:0%;"></div>
            </div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
              <span>Disk (C:)</span><span>25%</span>
            </div>
            <div style="height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;">
              <div style="height:100%;background:#dcdcaa;border-radius:2px;width:25%;"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Launch (no music) -->
      <div class="widget-card">
        <div class="widget-title">Quick Launch</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
          ${[
            {id:'fileexplorer',icon:'📁',label:'Files'},
            {id:'browser',icon:'🌐',label:'Browser'},
            {id:'terminal',icon:'💻',label:'Terminal'},
            {id:'calculator',icon:'🧮',label:'Calc'},
            {id:'notepad',icon:'📝',label:'Notes'},
            {id:'settings',icon:'⚙️',label:'Settings'},
            {id:'calendar',icon:'📅',label:'Calendar'},
            {id:'store',icon:'🛒',label:'Store'},
          ].map(a=>`
            <div data-launch="${a.id}" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 4px;border-radius:8px;cursor:pointer;background:rgba(255,255,255,0.04);transition:background 0.15s;"
                 onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.04)'">
              <span style="font-size:22px;">${a.icon}</span>
              <span style="font-size:10px;color:rgba(255,255,255,0.6);">${a.label}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Recent Files -->
      <div class="widget-card">
        <div class="widget-title">Recent Files</div>
        <div id="w-recent" style="display:flex;flex-direction:column;gap:4px;"></div>
      </div>

      <!-- Calendar mini -->
      <div class="widget-card">
        <div class="widget-title">Calendar</div>
        <div id="w-cal"></div>
      </div>
    `;

    document.body.appendChild(panel);
    this.panel = panel;

    document.getElementById('widgets-close').addEventListener('click', () => this.close());

    // Temp unit toggles
    document.getElementById('w-toggle-f').addEventListener('click', () => {
      this.tempUnit = 'F';
      try { localStorage.setItem('win12_temp_unit', 'F'); } catch(e) {}
      document.getElementById('w-toggle-f').classList.add('active');
      document.getElementById('w-toggle-c').classList.remove('active');
      const ww = document.getElementById('w-weather-card');
      if (ww && typeof Weather !== 'undefined' && Weather.data) Weather.renderCard(ww, 'F');
    });
    document.getElementById('w-toggle-c').addEventListener('click', () => {
      this.tempUnit = 'C';
      try { localStorage.setItem('win12_temp_unit', 'C'); } catch(e) {}
      document.getElementById('w-toggle-c').classList.add('active');
      document.getElementById('w-toggle-f').classList.remove('active');
      const ww = document.getElementById('w-weather-card');
      if (ww && typeof Weather !== 'undefined' && Weather.data) Weather.renderCard(ww, 'C');
    });

    panel.querySelectorAll('[data-launch]').forEach(el => {
      el.addEventListener('click', () => { AppLauncher.launch(el.dataset.launch); this.close(); });
    });

    this._startUpdates();
    this._renderRecent();
    this._renderMiniCal();
    const ww = document.getElementById('w-weather-card');
    if (ww && typeof Weather !== 'undefined' && Weather.data) Weather.renderCard(ww, this.tempUnit);
  },

  close() {
    this.open = false;
    this.intervals.forEach(clearInterval);
    this.intervals = [];
    if (this.panel) { this.panel.remove(); this.panel = null; }
  },

  _startUpdates() {
    const updateClock = () => {
      const now = new Date();
      const t = document.getElementById('w-time');
      const d = document.getElementById('w-date');
      if (t) t.textContent = now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
      if (d) d.textContent = now.toLocaleDateString([], {weekday:'long',month:'long',day:'numeric'});
    };
    updateClock();
    this.intervals.push(setInterval(updateClock, 1000));

    const updateBat = () => {
      const pct = Math.round(OS.battery.level * 100);
      const charging = OS.battery.charging;
      const icon = document.getElementById('w-bat-icon');
      const pctEl = document.getElementById('w-bat-pct');
      const status = document.getElementById('w-bat-status');
      const bar = document.getElementById('w-bat-bar');
      if (icon) icon.textContent = charging ? '⚡' : pct > 20 ? '🔋' : '🪫';
      if (pctEl) pctEl.textContent = pct + '%';
      if (status) status.textContent = charging ? 'Charging' : pct > 80 ? 'Good' : pct > 20 ? 'Normal' : 'Low Battery';
      if (bar) { bar.style.width = pct + '%'; bar.style.background = pct > 50 ? 'var(--accent)' : pct > 20 ? '#dcdcaa' : '#f44747'; }
    };
    updateBat();
    this.intervals.push(setInterval(updateBat, 5000));

    const updateStats = () => {
      const cpu = OS.getCpuUsage();
      const mem = OS.getMemoryUsage();
      const cpuEl = document.getElementById('w-cpu');
      const cpuBar = document.getElementById('w-cpu-bar');
      const memEl = document.getElementById('w-mem');
      const memBar = document.getElementById('w-mem-bar');
      if (cpuEl) cpuEl.textContent = cpu + '%';
      if (cpuBar) cpuBar.style.width = cpu + '%';
      if (memEl) memEl.textContent = mem.percent + '%';
      if (memBar) memBar.style.width = mem.percent + '%';
    };
    updateStats();
    this.intervals.push(setInterval(updateStats, 2000));
  },

  _renderRecent() {
    const el = document.getElementById('w-recent');
    if (!el) return;
    const docs = FS.ls('C:/Users/User/Documents') || {};
    const downloads = FS.ls('C:/Users/User/Downloads') || {};
    const pictures = FS.ls('C:/Users/User/Pictures') || {};
    const all = [
      ...Object.entries(docs).map(([n,v])=>({name:n,path:'C:/Users/User/Documents/'+n,node:v})),
      ...Object.entries(downloads).map(([n,v])=>({name:n,path:'C:/Users/User/Downloads/'+n,node:v})),
      ...Object.entries(pictures).map(([n,v])=>({name:n,path:'C:/Users/User/Pictures/'+n,node:v})),
    ].slice(0, 6);

    if (all.length === 0) { el.innerHTML = '<div style="font-size:12px;color:rgba(255,255,255,0.4);">No recent files</div>'; return; }

    el.innerHTML = all.map(f => `
      <div data-path="${f.path}" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;transition:background 0.15s;"
           onmouseover="this.style.background='rgba(255,255,255,0.07)'" onmouseout="this.style.background=''">
        <span style="font-size:16px;">${FS.getIcon(f.name, f.node.type)}</span>
        <span style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${f.name}</span>
      </div>
    `).join('');

    el.querySelectorAll('[data-path]').forEach(item => {
      item.addEventListener('click', () => {
        const p = item.dataset.path;
        const ext = p.split('.').pop().toLowerCase();
        if (['jpg','jpeg','png','gif','bmp','webp'].includes(ext)) {
          AppLauncher.launch('myphotos');
        } else {
          AppLauncher.launch('notepad', { path: p });
        }
        this.close();
      });
    });
  },

  _renderMiniCal() {
    const el = document.getElementById('w-cal');
    if (!el) return;
    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const dayNames = ['S','M','T','W','T','F','S'];

    let days = '';
    for (let i = 0; i < firstDay; i++) days += '<div></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = d === now.getDate();
      days += `<div style="text-align:center;font-size:12px;padding:3px;border-radius:50%;cursor:pointer;${isToday?'background:var(--accent);color:#fff;font-weight:600;':''}" onclick="AppLauncher.launch('calendar')">${d}</div>`;
    }

    el.innerHTML = `
      <div style="font-size:13px;font-weight:600;margin-bottom:8px;">${monthNames[month]} ${year}</div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;">
        ${dayNames.map(d=>`<div style="text-align:center;font-size:10px;color:rgba(255,255,255,0.4);padding:2px;">${d}</div>`).join('')}
        ${days}
      </div>
    `;
  }
};
