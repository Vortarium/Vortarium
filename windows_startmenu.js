// ===== START MENU =====
const StartMenu = {
  open: false,

  init() {
    const btn = document.getElementById('start-btn');
    const menu = document.getElementById('start-menu');
    const searchInput = document.getElementById('start-search-input');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    document.addEventListener('click', (e) => {
      if (this.open && !menu.contains(e.target) && e.target !== btn) {
        this.close();
      }
    });

    searchInput.addEventListener('input', () => this.handleSearch(searchInput.value));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const results = document.querySelectorAll('.search-result-item');
        if (results.length > 0) results[0].click();
      }
    });

    document.getElementById('btn-sleep').addEventListener('click', () => { this.close(); LockScreen.lock(); });
    document.getElementById('btn-restart').addEventListener('click', () => { this.close(); PowerManager.restart(); });
    document.getElementById('btn-shutdown').addEventListener('click', () => { this.close(); PowerManager.shutdown(); });

    this._updateRecommended();
  },

  toggle() { this.open ? this.close() : this.show(); },

  show() {
    const menu = document.getElementById('start-menu');
    const btn = document.getElementById('start-btn');
    menu.classList.remove('hidden');
    btn.classList.add('active');
    this.open = true;
    this._updateRecommended();
    document.getElementById('start-search-input').focus();
    document.getElementById('notification-panel').classList.add('hidden');
  },

  close() {
    const menu = document.getElementById('start-menu');
    const btn = document.getElementById('start-btn');
    menu.classList.add('hidden');
    btn.classList.remove('active');
    this.open = false;
    document.getElementById('start-search-input').value = '';
    this._showNormal();
  },

  handleSearch(query) {
    if (!query.trim()) { this._showNormal(); return; }
    this._showSearchResults(query.toLowerCase());
  },

  _showNormal() {
    const rec = document.querySelector('.start-recommended');
    if (rec) rec.style.display = '';
    const sr = document.getElementById('search-results-container');
    if (sr) sr.remove();
  },

  _showSearchResults(query) {
    const rec = document.querySelector('.start-recommended');
    if (rec) rec.style.display = 'none';

    let container = document.getElementById('search-results-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'search-results-container';
      container.className = 'search-results';
      document.getElementById('start-menu').insertBefore(container, document.querySelector('.start-footer'));
    }

    // Search only installed apps (not deleted from System32)
    const matches = ALL_APPS.filter(a =>
      (a.label.toLowerCase().includes(query) || a.id.toLowerCase().includes(query)) &&
      !FS.isAppDeleted(a.id)
    );

    container.innerHTML = '';

    if (matches.length === 0) {
      container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted)">No results for "${query}"</div>`;
      return;
    }

    matches.forEach(app => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.innerHTML = `<span class="sr-icon">${app.icon}</span><span class="sr-name">${app.label}</span>`;
      item.addEventListener('click', () => { AppLauncher.launch(app.id); this.close(); });
      container.appendChild(item);
    });
  },

  _updateRecommended() {
    const list = document.getElementById('rec-list');
    if (!list) return;
    list.innerHTML = '';

    const recent = OS.getRecentApps(10);
    const toShow = recent.length > 0
      ? recent
      : ['fileexplorer','browser','settings','notepad','calculator','paint','calendar','store','weatherapp','viruslab'];

    toShow.slice(0, 10).forEach(appId => {
      const def = ALL_APPS.find(a => a.id === appId);
      if (!def) return;
      const el = document.createElement('div');
      el.className = 'rec-item';
      el.innerHTML = `
        <span class="rec-icon">${def.icon}</span>
        <div class="rec-info">
          <div class="rec-name">${def.label}</div>
          <div class="rec-time">${recent.includes(appId) ? 'Recently used' : 'App'}</div>
        </div>
      `;
      el.addEventListener('click', () => { AppLauncher.launch(appId); this.close(); });
      // Right-click to pin to desktop
      el.addEventListener('contextmenu', e => {
        e.preventDefault();
        e.stopPropagation();
        ContextMenu.showAppMenu(e.clientX, e.clientY, appId, def.label);
      });
      list.appendChild(el);
    });
  },
};

// ===== POWER MANAGER =====
const PowerManager = {
  shutdown() {
    const overlay = document.getElementById('power-overlay');
    const msg = document.getElementById('power-message');
    overlay.classList.remove('hidden');
    msg.textContent = 'Shutting down...';
    setTimeout(() => { msg.textContent = ''; overlay.style.background = '#000'; }, 2000);
  },

  restart() {
    if (typeof VirusEngine !== 'undefined' && VirusEngine.activeVirus >= 9) {
      VirusEngine._doRestart();
      return;
    }
    const overlay = document.getElementById('power-overlay');
    const msg = document.getElementById('power-message');
    overlay.classList.remove('hidden');
    msg.textContent = 'Restarting...';
    setTimeout(() => {
      if (typeof WM !== 'undefined') WM.closeAll();
      overlay.classList.add('hidden');
      if (typeof VirusEngine !== 'undefined') VirusEngine._doRestart();
      else LockScreen.lock();
    }, 2000);
  }
};
