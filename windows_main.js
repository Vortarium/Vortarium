// ===== MAIN INIT =====

// All available apps registry
const ALL_APPS = [
  {id:'fileexplorer',icon:'📁',label:'File Explorer'},
  {id:'browser',icon:'🌐',label:'Browser'},
  {id:'settings',icon:'⚙️',label:'Settings'},
  {id:'notepad',icon:'📝',label:'Notepad'},
  {id:'terminal',icon:'💻',label:'Terminal'},
  {id:'calculator',icon:'🧮',label:'Calculator'},
  {id:'paint',icon:'🎨',label:'Paint'},
  {id:'taskmanager',icon:'📊',label:'Task Manager'},
  {id:'calendar',icon:'📅',label:'Calendar'},
  {id:'music',icon:'🎵',label:'Music'},
  {id:'photos',icon:'🖼️',label:'Photos'},
  {id:'store',icon:'🛒',label:'Store'},
  {id:'spotify',icon:'🎧',label:'Spotify'},
  {id:'vscode',icon:'🖥️',label:'VS Code'},
  {id:'games',icon:'🎮',label:'Games'},
  {id:'myphotos',icon:'📷',label:'My Photos'},
  {id:'geodash',icon:'🟦',label:'Geo Dash'},
  {id:'viruslab',icon:'🦠',label:'Virus Lab'},
  {id:'discord',icon:'💬',label:'Discord'},
  {id:'zoom',icon:'📹',label:'Zoom'},
  {id:'clipchamp',icon:'🎬',label:'Clipchamp'},
  {id:'photoshop',icon:'🖼️',label:'Photoshop'},
  {id:'notion',icon:'📋',label:'Notion'},
  {id:'office',icon:'📊',label:'Office 365'},
  {id:'youtube',icon:'▶️',label:'YouTube'},
  {id:'tiktok',icon:'🎵',label:'TikTok'},
  {id:'weatherapp',icon:'🌤️',label:'Weather'},
  {id:'word',icon:'📘',label:'Word'},
  {id:'excel',icon:'📗',label:'Excel'},
  {id:'powerpoint',icon:'📙',label:'PowerPoint'},
  {id:'mail',icon:'📧',label:'Mail'},
  {id:'flstudio',icon:'🎹',label:'FL Studio'},
];

// Global install gate
function _showInstallGate(name, icon, storeId) {
  const id = WM.create({ title: name, icon, width: 420, height: 280, appId: storeId + '_gate', resizable: false });
  const content = WM.getContent(id);
  content.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:32px;text-align:center;';
  content.innerHTML = `
    <div style="font-size:56px;">${icon}</div>
    <div style="font-size:18px;font-weight:600;">${name} is not installed</div>
    <div style="font-size:13px;color:var(--text-muted);line-height:1.6;">
      You need to install ${name} from the Microsoft Store before you can use it.
    </div>
    <div style="display:flex;gap:10px;margin-top:4px;">
      <button id="gate-store-${id}" style="padding:10px 24px;background:var(--accent);border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:14px;font-weight:600;">Open Store</button>
      <button id="gate-close-${id}" style="padding:10px 20px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff;cursor:pointer;font-size:13px;">Cancel</button>
    </div>`;
  document.getElementById(`gate-store-${id}`).addEventListener('click', () => { WM.close(id); AppLauncher.launch('store'); });
  document.getElementById(`gate-close-${id}`).addEventListener('click', () => WM.close(id));
}

// ── Desktop Icon Manager ───────────────────────────────────────────────────
// Pinning an app adds it to the DESKTOP (not start menu).
// Icons are arranged in columns of 10, new column starts after 10.
const DesktopManager = {
  _key: 'win12_desktop_icons',
  _defaults: [
    'fileexplorer','terminal','settings','notepad','browser',
    'calculator','taskmanager','paint','weatherapp','myphotos',
    'viruslab','store','calendar'
  ],

  get() {
    try {
      const s = localStorage.getItem(this._key);
      if (s) return JSON.parse(s);
    } catch(e) {}
    return [...this._defaults];
  },

  set(arr) {
    try { localStorage.setItem(this._key, JSON.stringify(arr)); } catch(e) {}
  },

  pin(appId) {
    const icons = this.get();
    if (!icons.includes(appId)) {
      icons.push(appId);
      this.set(icons);
      this.render();
      const def = ALL_APPS.find(a => a.id === appId);
      Notifications.send('Desktop', `Pinned: ${def?.label || appId}`, '📌');
    }
  },

  unpin(appId) {
    const icons = this.get().filter(a => a !== appId);
    this.set(icons);
    this.render();
  },

  render() {
    const container = document.getElementById('desktop-icons');
    if (!container) return;
    const icons = this.get();

    // Layout: columns of 10, each column is 80px wide
    // Column 1: top-left, Column 2: next to it, etc.
    const ICONS_PER_COL = 10;
    const cols = [];
    for (let i = 0; i < icons.length; i += ICONS_PER_COL) {
      cols.push(icons.slice(i, i + ICONS_PER_COL));
    }

    container.style.cssText = `
      position:absolute;top:16px;left:16px;
      display:flex;flex-direction:row;gap:8px;z-index:10;
      align-items:flex-start;
    `;

    container.innerHTML = cols.map((col, ci) => `
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${col.map(appId => {
          const def = ALL_APPS.find(a => a.id === appId);
          if (!def) return '';
          return `<div class="desktop-icon" data-app="${def.id}" data-label="${def.label}">
            <div class="icon-img">${def.icon}</div>
            <span>${def.label}</span>
          </div>`;
        }).join('')}
      </div>
    `).join('');

    // Bind double-click to launch
    container.querySelectorAll('.desktop-icon').forEach(icon => {
      let clicks = 0, timer = null;
      icon.addEventListener('click', e => {
        e.stopPropagation();
        container.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('selected'));
        icon.classList.add('selected');
        clicks++;
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (clicks >= 2) AppLauncher.launch(icon.dataset.app);
          clicks = 0;
        }, 280);
      });

      // Right-click on desktop icon
      icon.addEventListener('contextmenu', e => {
        e.preventDefault();
        e.stopPropagation();
        ContextMenu.showDesktopIconMenu(e.clientX, e.clientY, icon.dataset.app, icon.dataset.label);
      });
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  OS.init();
  if (OS.vfs) {
    FS.loadFromSaved(OS.vfs);
  } else {
    FS.init();
  }

  WM.init();
  Taskbar.init();
  StartMenu.init();
  Notifications.init();
  LockScreen.init();
  ContextMenu.init();
  Widgets.init();
  Weather.init();

  // ── Wrap AppLauncher.launch to track recent apps ───────────────────────
  const _origLaunch = AppLauncher.launch.bind(AppLauncher);
  AppLauncher.launch = function(id, opts) {
    OS.trackAppLaunch(id);
    StartMenu._updateRecommended();
    _origLaunch(id, opts);
  };

  // ── Render desktop icons ───────────────────────────────────────────────
  DesktopManager.render();

  // ── Pinned taskbar apps ────────────────────────────────────────────────
  const pinned = OS.settings.pinnedApps || ['browser','fileexplorer','settings'];
  pinned.forEach(appId => Taskbar.addPinned(appId));

  // ── Desktop click deselect ─────────────────────────────────────────────
  document.getElementById('desktop').addEventListener('click', e => {
    if (e.target === document.getElementById('desktop') || e.target === document.getElementById('wallpaper')) {
      document.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('selected'));
    }
  });

  document.getElementById('search-btn').addEventListener('click', e => {
    e.stopPropagation();
    StartMenu.show();
    setTimeout(() => document.getElementById('start-search-input').focus(), 50);
  });

  document.getElementById('show-desktop-btn').addEventListener('click', () => {
    const any = Object.values(WM.windows).some(w => !w.minimized);
    if (any) WM.minimizeAll(); else WM.restoreAll();
  });

  document.querySelector('.taskbar-clock').addEventListener('click', () => AppLauncher.launch('calendar'));

  // ── Hard reset button ──────────────────────────────────────────────────
  document.getElementById('btn-hardreset').addEventListener('click', () => {
    if (confirm('⚠️ HARD RESET: This will wipe ALL data — passwords, files, settings, installed apps, photos, everything. Cannot be undone. Continue?')) {
      const overlay = document.getElementById('power-overlay');
      const msg = document.getElementById('power-message');
      if (overlay && msg) { overlay.classList.remove('hidden'); msg.textContent = 'Resetting Windows 12...'; }
      setTimeout(() => OS.hardReset(), 1500);
    }
  });

  // ── Tab visibility — freeze FPS counter for 1.5s on return ────────────
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && typeof VirusEngine !== 'undefined') {
      VirusEngine._tabReturnFreeze = true;
      setTimeout(() => { VirusEngine._tabReturnFreeze = false; }, 1500);
    }
  });

  document.addEventListener('keydown', e => {
    if (LockScreen.locked) return;
    if ((e.key === 'Meta') || (e.ctrlKey && e.key === 'Escape')) { e.preventDefault(); StartMenu.toggle(); }
    if (e.metaKey && e.key === 'd') { e.preventDefault(); document.getElementById('show-desktop-btn').click(); }
    if (e.metaKey && e.key === 'e') { e.preventDefault(); AppLauncher.launch('fileexplorer'); }
    if (e.metaKey && e.key === 'r') { e.preventDefault(); AppLauncher.launch('terminal'); }
    if (e.ctrlKey && e.shiftKey && e.key === 'Escape') { e.preventDefault(); AppLauncher.launch('taskmanager'); }
    if (e.altKey && e.key === 'F4') { e.preventDefault(); if (WM.activeId) WM.close(WM.activeId); }
    if (e.key === 'Escape') {
      StartMenu.close();
      document.getElementById('notification-panel').classList.add('hidden');
      Widgets.close();
    }
  });

  document.addEventListener('contextmenu', e => {
    if (e.target.matches('input,textarea')) return;
    if (!e.target.closest('.win') && !e.target.closest('#taskbar')) e.preventDefault();
  });

  setTimeout(() => Notifications.send('Windows 12', 'Welcome back, ' + (OS.settings.username || 'User') + '!', '🪟'), 1800);
  console.log('Windows 12 initialized. Apps:', Object.keys(AppLauncher.apps).join(', '));

  // ── FPS tracking ──────────────────────────────────────────────────────────
  VirusEngine.startFpsTracking();

  // ── Virus persistence on startup ──────────────────────────────────────────
  const savedVirus = parseInt(localStorage.getItem('win12_active_virus') || '0');
  if (savedVirus >= 6 && savedVirus <= 8) {
    setTimeout(() => {
      Notifications.send('System', 'Startup process initializing...', '⚙️');
      setTimeout(() => VirusEngine.infectWith(savedVirus), 3000);
    }, 10000);
  } else if (savedVirus >= 9) {
    setTimeout(() => VirusEngine.infectWith(savedVirus), 1200);
  }
});
