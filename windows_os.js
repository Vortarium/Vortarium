// ===== WINDOWS 12 OS CORE =====
const OS = {
  version: '12.0.1', build: '26100',
  username: 'User', hostname: 'DESKTOP-WIN12',
  startTime: Date.now(),

  settings: {
    wallpaper: 'wallpaper.jpg', volume: 75, brightness: 100,
    animations: true, notifications: true, username: 'User',
    password: '', lockWallpaper: '', accent: '#0078d4', pfp: '',
    pinnedApps: ['browser','fileexplorer','settings'],
  },

  vfs: null,
  appData: {},

  init() {
    this.loadSettings();
    this.loadVFS();
    this.loadAppData();
    this.applySettings();
    this._startBattery();
    console.log(`Windows 12 v${this.version} (Build ${this.build}) initialized`);
  },

  loadSettings() {
    try {
      const s = localStorage.getItem('win12_settings');
      if (s) this.settings = { ...this.settings, ...JSON.parse(s) };
      this.username = this.settings.username || 'User';
    } catch(e) {}
  },
  saveSettings() {
    try { localStorage.setItem('win12_settings', JSON.stringify(this.settings)); } catch(e) {}
  },

  loadVFS() {
    try { const s = localStorage.getItem('win12_vfs'); if (s) this.vfs = JSON.parse(s); } catch(e) {}
  },
  saveVFS() {
    try { localStorage.setItem('win12_vfs', JSON.stringify(FS.tree)); } catch(e) {}
  },

  loadAppData() {
    try { const s = localStorage.getItem('win12_appdata'); if (s) this.appData = JSON.parse(s); } catch(e) {}
  },
  saveAppData() {
    try { localStorage.setItem('win12_appdata', JSON.stringify(this.appData)); } catch(e) {}
  },
  getAppData(id) { return this.appData[id] || null; },
  setAppData(id, data) { this.appData[id] = data; this.saveAppData(); },

  // Track recently used apps
  trackAppLaunch(appId) {
    try {
      let recent = JSON.parse(localStorage.getItem('win12_recent_apps') || '[]');
      recent = [appId, ...recent.filter(a => a !== appId)].slice(0, 20);
      localStorage.setItem('win12_recent_apps', JSON.stringify(recent));
    } catch(e) {}
  },
  getRecentApps(limit = 8) {
    try {
      return JSON.parse(localStorage.getItem('win12_recent_apps') || '[]').slice(0, limit);
    } catch(e) { return []; }
  },

  hardReset() {
    // Wipe every win12_ key
    Object.keys(localStorage).filter(k => k.startsWith('win12')).forEach(k => localStorage.removeItem(k));
    localStorage.removeItem('win12_store_installed');
    localStorage.removeItem('win12_pinned_apps');
    localStorage.removeItem('win12_recent_apps');
    localStorage.removeItem('win12_temp_unit');
    location.reload();
  },

  resetOS() { this.hardReset(); },

  applySettings() {
    this._applyWallpaper(this.settings.wallpaper || 'wallpaper.jpg');
    document.body.style.filter = `brightness(${(this.settings.brightness||100)/100})`;
    const ud = document.getElementById('username-display');
    if (ud) ud.textContent = this.settings.username || 'User';
    if (this.settings.accent) document.documentElement.style.setProperty('--accent', this.settings.accent);
    this._applyPfp();
  },

  _applyWallpaper(wp) {
    const el = document.getElementById('wallpaper');
    if (!el) return;
    const grads = [
      'linear-gradient(135deg,#0f0c29,#302b63,#24243e)',
      'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)',
      'linear-gradient(135deg,#0d1117,#161b22,#21262d)',
      'linear-gradient(135deg,#1e3a5f,#2d6a9f,#1a5276)',
      'linear-gradient(135deg,#2d1b69,#11998e,#38ef7d)',
      'linear-gradient(135deg,#fc466b,#3f5efb)',
      'linear-gradient(135deg,#0f2027,#203a43,#2c5364)',
      'linear-gradient(135deg,#141e30,#243b55)',
    ];
    if (!wp || wp === 'wallpaper.jpg') {
      el.style.backgroundImage = "url('wallpaper.jpg')";
    } else if (wp.startsWith('wp-')) {
      el.style.backgroundImage = grads[parseInt(wp.replace('wp-',''))-1] || grads[0];
    } else {
      el.style.backgroundImage = `url('${wp}')`;
    }
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
  },

  _applyPfp() {
    const pfp = this.settings.pfp;
    document.querySelectorAll('.user-avatar,.login-avatar').forEach(el => {
      if (pfp) {
        el.style.backgroundImage = `url('${pfp}')`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.textContent = '';
      } else {
        el.style.backgroundImage = '';
        if (!el.textContent.trim()) el.textContent = '👤';
      }
    });
  },

  battery: { level: 1, charging: false },
  _startBattery() {
    const update = bat => {
      this.battery.level = bat.level; this.battery.charging = bat.charging;
      this._renderBattery();
      bat.addEventListener('levelchange', () => { this.battery.level = bat.level; this._renderBattery(); });
      bat.addEventListener('chargingchange', () => { this.battery.charging = bat.charging; this._renderBattery(); });
    };
    if (navigator.getBattery) navigator.getBattery().then(update).catch(() => this._renderBattery());
    else this._renderBattery();
  },
  _renderBattery() {
    const pct = Math.round(this.battery.level * 100);
    const icon = this.battery.charging ? '⚡' : pct > 20 ? '🔋' : '🪫';
    const tray = document.querySelector('.tray-icon[title="Battery"]');
    if (tray) { tray.textContent = icon; tray.title = `Battery: ${pct}%${this.battery.charging?' (Charging)':''}`; }
  },

  getUptime() {
    const ms=Date.now()-this.startTime,s=Math.floor(ms/1000),m=Math.floor(s/60),h=Math.floor(m/60);
    return `${h}h ${m%60}m ${s%60}s`;
  },
  getCpuUsage() { return Math.floor(Math.random()*30+5); },
  getMemoryUsage() { const t=16384,u=Math.floor(Math.random()*4000+4000); return {used:u,total:t,percent:Math.floor(u/t*100)}; },
  getDiskUsage() { return {used:128,total:512,percent:25}; },
  getNetworkSpeed() { return {down:(Math.random()*50).toFixed(1),up:(Math.random()*10).toFixed(1)}; },
};
