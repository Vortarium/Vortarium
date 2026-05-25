// ===== TASKBAR — with pinned apps + grouped windows =====
const Taskbar = {
  groups: {},  // key -> { winIds, icon, title, btnEl, pinned }

  init() {
    this._updateClock();
    setInterval(() => this._updateClock(), 1000);
    this._initPreviewPanel();
  },

  _updateClock() {
    const now = new Date();
    const t = document.getElementById('tb-time');
    const d = document.getElementById('tb-date');
    if (t) t.textContent = now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    if (d) d.textContent = now.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});
  },

  // ── Pinned apps ───────────────────────────────────────────────────────────
  addPinned(appId) {
    const defs = {
      browser:{icon:'🌐',title:'Browser'}, fileexplorer:{icon:'📁',title:'Files'},
      settings:{icon:'⚙️',title:'Settings'}, terminal:{icon:'💻',title:'Terminal'},
      notepad:{icon:'📝',title:'Notepad'}, calculator:{icon:'🧮',title:'Calculator'},
      spotify:{icon:'🎧',title:'Spotify'}, vscode:{icon:'🖥️',title:'VS Code'},
      games:{icon:'🎮',title:'Games'}, myphotos:{icon:'📷',title:'Photos'},
      geodash:{icon:'🟦',title:'Geo Dash'},
    };
    const def = defs[appId];
    if (!def || this.groups[appId]) return;
    const container = document.getElementById('taskbar-apps');
    const btn = document.createElement('button');
    btn.className = 'tb-app-btn pinned';
    btn.id = 'tbg_' + appId;
    btn.dataset.groupKey = appId;
    btn.innerHTML = `<span class="tb-icon">${def.icon}</span><span class="tb-label">${def.title}</span>`;
    btn.title = def.title;
    btn.addEventListener('click', () => {
      const g = this.groups[appId];
      if (!g) return;
      if (g.winIds.length === 0) AppLauncher.launch(appId);
      else if (g.winIds.length === 1) WM.toggleMinimize(g.winIds[0]);
      else this._previewPanel.style.display !== 'none' ? this._hidePreview() : this._showPreview(appId, btn);
    });
    btn.addEventListener('mouseenter', () => {
      const g = this.groups[appId];
      if (g && g.winIds.length > 1) this._showPreview(appId, btn);
    });
    btn.addEventListener('mouseleave', () => {
      setTimeout(() => { if (!this._previewPanel.matches(':hover')) this._hidePreview(); }, 120);
    });
    container.appendChild(btn);
    this.groups[appId] = { winIds:[], icon:def.icon, title:def.title, btnEl:btn, pinned:true };
  },

  // ── Preview panel ─────────────────────────────────────────────────────────
  _initPreviewPanel() {
    const panel = document.createElement('div');
    panel.id = 'tb-preview-panel';
    panel.style.cssText = `position:fixed;bottom:56px;background:rgba(24,24,34,0.97);backdrop-filter:blur(24px);
      border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:8px;
      display:none;flex-direction:row;gap:8px;z-index:2000;box-shadow:0 -4px 24px rgba(0,0,0,0.5);min-width:120px;`;
    document.body.appendChild(panel);
    this._previewPanel = panel;
    panel.addEventListener('mouseleave', () => this._hidePreview());
  },

  _showPreview(key, anchorEl) {
    const group = this.groups[key];
    if (!group || group.winIds.length <= 1) return;
    const panel = this._previewPanel;
    panel.innerHTML = '';
    group.winIds.forEach(winId => {
      const ws = WM.windows[winId];
      if (!ws) return;
      const card = document.createElement('div');
      card.style.cssText = `display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 10px;
        border-radius:8px;cursor:pointer;min-width:100px;max-width:140px;
        background:rgba(255,255,255,0.05);transition:background 0.15s;`;
      card.innerHTML = `
        <div style="font-size:22px">${ws.icon}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;text-align:center">${ws.title}</div>
        <button data-close="${winId}" style="background:rgba(196,43,28,0.3);border:none;border-radius:4px;color:#f88;cursor:pointer;font-size:10px;padding:2px 6px;width:100%">✕ Close</button>`;
      card.addEventListener('mouseenter', () => card.style.background='rgba(255,255,255,0.1)');
      card.addEventListener('mouseleave', () => card.style.background='rgba(255,255,255,0.05)');
      card.addEventListener('click', e => {
        if (e.target.dataset.close) { WM.close(e.target.dataset.close); this._hidePreview(); return; }
        WM.toggleMinimize(winId); this._hidePreview();
      });
      card.querySelector('[data-close]').addEventListener('click', e => {
        e.stopPropagation(); WM.close(winId); this._hidePreview();
      });
      panel.appendChild(card);
    });
    const rect = anchorEl.getBoundingClientRect();
    const pw = Math.max(group.winIds.length*120, 120);
    let left = rect.left + rect.width/2 - pw/2;
    left = Math.max(8, Math.min(left, window.innerWidth-pw-8));
    panel.style.left = left+'px';
    panel.style.display = 'flex';
  },

  _hidePreview() { if (this._previewPanel) this._previewPanel.style.display='none'; },

  // ── Add running window ────────────────────────────────────────────────────
  addApp(winId, icon, title, appId) {
    const container = document.getElementById('taskbar-apps');
    if (!container) return;
    const key = appId || winId;

    if (this.groups[key]) {
      this.groups[key].winIds.push(winId);
      this._updateGroupBtn(key);
    } else {
      const btn = document.createElement('button');
      btn.className = 'tb-app-btn running active';
      btn.id = 'tbg_' + key;
      btn.dataset.groupKey = key;
      btn.innerHTML = `<span class="tb-icon">${icon}</span><span class="tb-label">${title}</span>`;
      btn.title = title;
      btn.addEventListener('click', () => {
        const g = this.groups[key];
        if (!g) return;
        if (g.winIds.length===1) WM.toggleMinimize(g.winIds[0]);
        else this._previewPanel.style.display!=='none' ? this._hidePreview() : this._showPreview(key, btn);
      });
      btn.addEventListener('mouseenter', () => {
        const g = this.groups[key];
        if (g && g.winIds.length>1) this._showPreview(key, btn);
      });
      btn.addEventListener('mouseleave', () => {
        setTimeout(() => { if (!this._previewPanel.matches(':hover')) this._hidePreview(); }, 120);
      });
      container.appendChild(btn);
      this.groups[key] = { winIds:[winId], icon, title, btnEl:btn, pinned:false };
    }
    this.setActive(winId);
  },

  _updateGroupBtn(key) {
    const g = this.groups[key];
    if (!g) return;
    const count = g.winIds.length;
    g.btnEl.innerHTML = `<span class="tb-icon">${g.icon}</span><span class="tb-label">${g.title}${count>1?` (${count})`:''}</span>`;
    g.btnEl.classList.toggle('multi', count>1);
    g.btnEl.classList.toggle('running', count>0);
  },

  removeApp(winId) {
    for (const key of Object.keys(this.groups)) {
      const g = this.groups[key];
      const idx = g.winIds.indexOf(winId);
      if (idx===-1) continue;
      g.winIds.splice(idx,1);
      if (g.winIds.length===0 && !g.pinned) {
        g.btnEl.remove(); delete this.groups[key];
      } else {
        this._updateGroupBtn(key);
        if (g.winIds.length===0) g.btnEl.classList.remove('active','running','multi');
      }
      break;
    }
    this._hidePreview();
  },

  setActive(winId) {
    document.querySelectorAll('.tb-app-btn').forEach(b=>b.classList.remove('active'));
    for (const key of Object.keys(this.groups)) {
      if (this.groups[key].winIds.includes(winId)) {
        this.groups[key].btnEl.classList.add('active'); return;
      }
    }
  },

  setRunning(winId) {
    for (const key of Object.keys(this.groups)) {
      const g = this.groups[key];
      if (g.winIds.includes(winId)) {
        const anyActive = g.winIds.some(id=>id!==winId&&!WM.windows[id]?.minimized);
        if (!anyActive) g.btnEl.classList.remove('active');
        return;
      }
    }
  },

  updateLabel(winId, title) {
    for (const key of Object.keys(this.groups)) {
      const g = this.groups[key];
      if (g.winIds.includes(winId) && g.winIds.length===1) {
        g.title = title; this._updateGroupBtn(key); return;
      }
    }
  }
};
