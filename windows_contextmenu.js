// ===== CONTEXT MENU — rich right-click for everything =====
const ContextMenu = {
  _menu: null,

  init() {
    // Hide on any click
    document.addEventListener('click', () => this.hide());
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.hide(); });

    // Desktop background right-click
    document.getElementById('desktop').addEventListener('contextmenu', (e) => {
      const target = e.target;
      // Don't intercept if inside a window, taskbar, or start menu
      if (target.closest('.win') || target.closest('#taskbar') || target.closest('#start-menu')) return;
      e.preventDefault();
      e.stopPropagation();

      // Desktop icon right-click
      const icon = target.closest('.desktop-icon');
      if (icon) {
        this._showDesktopIconMenu(e.clientX, e.clientY, icon);
        return;
      }

      // Plain desktop background
      this._showDesktopMenu(e.clientX, e.clientY);
    });

    // Taskbar right-click
    document.getElementById('taskbar').addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const appBtn = e.target.closest('.tb-app-btn');
      if (appBtn) {
        this._showTaskbarAppMenu(e.clientX, e.clientY, appBtn);
      } else {
        this._showTaskbarMenu(e.clientX, e.clientY);
      }
    });

    // Window titlebar right-click
    document.addEventListener('contextmenu', (e) => {
      const titlebar = e.target.closest('.win-titlebar');
      if (titlebar) {
        e.preventDefault();
        e.stopPropagation();
        const win = titlebar.closest('.win');
        if (win) this._showWindowMenu(e.clientX, e.clientY, win.id);
      }
    });
  },

  hide() {
    if (this._menu) { this._menu.remove(); this._menu = null; }
  },

  _build(x, y, items) {
    this.hide();
    const menu = document.createElement('div');
    menu.style.cssText = `
      position:fixed;left:${x}px;top:${y}px;
      background:rgba(22,22,32,0.97);backdrop-filter:blur(24px);
      border:1px solid rgba(255,255,255,0.1);border-radius:10px;
      padding:6px;min-width:200px;z-index:99999;
      box-shadow:0 8px 32px rgba(0,0,0,0.6);
      animation:fadeIn 0.1s ease;
    `;

    items.forEach(item => {
      if (item === 'sep') {
        const sep = document.createElement('div');
        sep.style.cssText = 'height:1px;background:rgba(255,255,255,0.08);margin:4px 0;';
        menu.appendChild(sep);
        return;
      }
      const el = document.createElement('div');
      el.style.cssText = `
        display:flex;align-items:center;gap:10px;
        padding:8px 12px;border-radius:6px;cursor:pointer;
        font-size:13px;color:${item.danger?'#f44747':'#fff'};
        transition:background 0.1s;
      `;
      el.innerHTML = `<span style="font-size:16px;width:20px;text-align:center;">${item.icon||''}</span><span>${item.label}</span>`;
      el.addEventListener('mouseenter', () => el.style.background = item.danger ? 'rgba(196,43,28,0.2)' : 'rgba(255,255,255,0.08)');
      el.addEventListener('mouseleave', () => el.style.background = '');
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hide();
        if (item.action) item.action();
      });
      if (item.disabled) { el.style.opacity = '0.4'; el.style.cursor = 'default'; el.removeEventListener('click', () => {}); }
      menu.appendChild(el);
    });

    // Keep in viewport
    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
    if (rect.bottom > window.innerHeight - 48) menu.style.top = (y - rect.height) + 'px';
    this._menu = menu;
  },

  // ── Desktop background menu ────────────────────────────────────────────
  _showDesktopMenu(x, y) {
    this._build(x, y, [
      { icon:'🔄', label:'Refresh', action: () => Notifications.send('Desktop','Refreshed','🔄') },
      { icon:'📄', label:'New Text File', action: () => {
        const n = prompt('File name:','New Document.txt');
        if (n) { FS.writeFile('C:/Users/User/Desktop/'+n,''); Notifications.send('Desktop','Created: '+n,'📄'); }
      }},
      { icon:'📁', label:'New Folder', action: () => {
        const n = prompt('Folder name:','New Folder');
        if (n) { FS.mkdir('C:/Users/User/Desktop/'+n); Notifications.send('Desktop','Created folder: '+n,'📁'); }
      }},
      'sep',
      { icon:'🖼️', label:'Change Wallpaper', action: () => AppLauncher.launch('settings',{page:'personalization'}) },
      { icon:'🖥️', label:'Display Settings', action: () => AppLauncher.launch('settings',{page:'display'}) },
      { icon:'⚙️', label:'Personalize', action: () => AppLauncher.launch('settings',{page:'personalization'}) },
      'sep',
      { icon:'📊', label:'Task Manager', action: () => AppLauncher.launch('taskmanager') },
      { icon:'💻', label:'Open Terminal', action: () => AppLauncher.launch('terminal') },
    ]);
  },

  // ── Desktop icon right-click ───────────────────────────────────────────
  _showDesktopIconMenu(x, y, iconEl) {
    const appId = iconEl.dataset.app;
    const label = iconEl.querySelector('span')?.textContent || appId;
    this._build(x, y, [
      { icon:'▶️', label:`Open ${label}`, action: () => AppLauncher.launch(appId) },
      { icon:'📌', label:'Pin to Start', action: () => {
        const pinned = PinnedApps.get();
        if (!pinned.includes(appId)) { PinnedApps.set([...pinned, appId]); PinnedApps.render(); Notifications.send('Start','Pinned: '+label,'📌'); }
        else Notifications.send('Start','Already pinned','📌');
      }},
      'sep',
      { icon:'🗑️', label:'Remove from Desktop', danger: true, action: () => {
        if (confirm(`Remove ${label} from desktop?`)) {
          iconEl.remove();
          Notifications.send('Desktop','Removed: '+label,'🗑️');
        }
      }},
    ]);
  },

  // ── Taskbar background menu ────────────────────────────────────────────
  _showTaskbarMenu(x, y) {
    this._build(x, y, [
      { icon:'📊', label:'Task Manager', action: () => AppLauncher.launch('taskmanager') },
      { icon:'⚙️', label:'Taskbar Settings', action: () => AppLauncher.launch('settings',{page:'personalization'}) },
      'sep',
      { icon:'🪟', label:'Show Desktop', action: () => document.getElementById('show-desktop-btn').click() },
      { icon:'⊞', label:'Cascade Windows', action: () => {
        let i = 0;
        Object.keys(WM.windows).forEach(id => {
          const w = document.getElementById(id);
          if (w && !WM.windows[id].minimized) { w.style.left=(40+i*30)+'px'; w.style.top=(40+i*30)+'px'; i++; }
        });
      }},
    ]);
  },

  // ── Taskbar app button right-click ─────────────────────────────────────
  _showTaskbarAppMenu(x, y, btn) {
    const key = btn.dataset.groupKey;
    const group = typeof Taskbar !== 'undefined' ? Taskbar.groups[key] : null;
    const items = [];
    if (group && group.winIds.length > 0) {
      items.push({ icon:'🪟', label:'Restore', action: () => group.winIds.forEach(id => WM.restore(id)) });
      items.push({ icon:'🗕', label:'Minimize All', action: () => group.winIds.forEach(id => WM.minimize(id)) });
      items.push({ icon:'✕', label:'Close All', danger: true, action: () => [...group.winIds].forEach(id => WM.close(id)) });
      items.push('sep');
    }
    items.push({ icon:'▶️', label:'Launch New', action: () => AppLauncher.launch(key) });
    this._build(x, y, items);
  },

  // ── Window titlebar right-click ────────────────────────────────────────
  _showWindowMenu(x, y, winId) {
    const state = WM.windows[winId];
    if (!state) return;
    this._build(x, y, [
      { icon:'🗕', label:'Minimize', action: () => WM.minimize(winId) },
      { icon:'🗖', label: state.maximized ? 'Restore' : 'Maximize', action: () => WM.toggleMaximize(winId) },
      { icon:'⊞', label:'Snap Left', action: () => WM.snap(winId,'left') },
      { icon:'⊟', label:'Snap Right', action: () => WM.snap(winId,'right') },
      'sep',
      { icon:'✕', label:'Close', danger: true, action: () => WM.close(winId) },
    ]);
  },

  // ── Image right-click (called from file explorer / photos) ────────────
  showImageMenu(x, y, opts) {
    // opts: { name, dataUrl, path }
    this._build(x, y, [
      { icon:'🔍', label:'View Full Size', action: () => {
        if (!opts.dataUrl) return;
        const lb = document.createElement('div');
        lb.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:pointer;';
        lb.innerHTML = `<img src="${opts.dataUrl}" style="max-width:95vw;max-height:90vh;border-radius:8px;object-fit:contain;">`;
        lb.addEventListener('click', () => lb.remove());
        document.body.appendChild(lb);
      }},
      { icon:'⬇️', label:'Download to Computer', action: () => {
        if (!opts.dataUrl) return;
        const a = document.createElement('a'); a.href = opts.dataUrl; a.download = opts.name || 'image.png'; a.click();
      }},
      { icon:'📋', label:'Copy Path', action: () => {
        if (opts.path) navigator.clipboard?.writeText(opts.path).catch(()=>{});
        Notifications.send('Clipboard','Path copied','📋');
      }},
      'sep',
      { icon:'🗑️', label:'Delete', danger: true, action: () => {
        if (opts.path && confirm(`Delete "${opts.name}"?`)) {
          FS.rm(opts.path);
          Notifications.send('Files','Deleted: '+opts.name,'🗑️');
        }
      }},
    ]);
  },

  // ── File/folder right-click (called from file explorer) ───────────────
  showFileMenu(x, y, opts) {
    // opts: { name, path, type }
    const isFolder = opts.type === 'folder';
    const items = [
      { icon:'📂', label:'Open', action: () => {
        if (isFolder) AppLauncher.launch('fileexplorer', { path: opts.path });
        else {
          const ext = opts.name.split('.').pop().toLowerCase();
          if (['jpg','jpeg','png','gif','bmp','webp'].includes(ext)) AppLauncher.launch('myphotos');
          else if (ext === 'zip' && typeof _tryExtractZip === 'function') { _tryExtractZip(opts.path); }
          else if (ext === 'exe' && typeof _tryRunExe === 'function') { _tryRunExe(opts.path); }
          else AppLauncher.launch('notepad', { path: opts.path });
        }
      }},
    ];
    if (!isFolder) {
      items.push({ icon:'⬇️', label:'Download', action: () => {
        const content = FS.readFile(opts.path);
        if (!content) return;
        if (content.startsWith('data:')) {
          const a = document.createElement('a'); a.href = content; a.download = opts.name; a.click();
        } else {
          const blob = new Blob([content], {type:'text/plain'});
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = opts.name; a.click();
        }
      }});
    }
    items.push(
      { icon:'✏️', label:'Rename', action: () => {
        const n = prompt('Rename to:', opts.name);
        if (n && n !== opts.name) {
          const parent = FS.getNodeObj(opts.path.replace('/'+opts.name,''));
          if (parent?.children) {
            parent.children[n] = parent.children[opts.name];
            delete parent.children[opts.name];
            OS.saveVFS();
            Notifications.send('Files','Renamed to: '+n,'✏️');
          }
        }
      }},
      'sep',
      { icon:'🗑️', label:'Delete', danger: true, action: () => {
        if (confirm(`Delete "${opts.name}"?`)) { FS.rm(opts.path); Notifications.send('Files','Deleted: '+opts.name,'🗑️'); }
      }}
    );
    this._build(x, y, items);
  },

  // ── App icon right-click (start menu / desktop) ────────────────────────
  showAppMenu(x, y, appId, appLabel) {
    const onDesktop = typeof DesktopManager !== 'undefined' && DesktopManager.get().includes(appId);
    this._build(x, y, [
      { icon:'▶️', label:`Open ${appLabel}`, action: () => AppLauncher.launch(appId) },
      { icon:'📌', label: onDesktop ? 'Unpin from Desktop' : 'Pin to Desktop', action: () => {
        if (onDesktop) {
          DesktopManager.unpin(appId);
          Notifications.send('Desktop','Unpinned: '+appLabel,'📌');
        } else {
          DesktopManager.pin(appId);
        }
      }},
      'sep',
      { icon:'🛒', label:'Open in Store', action: () => AppLauncher.launch('store') },
    ]);
  },

  // ── Public: desktop icon right-click ──────────────────────────────────
  showDesktopIconMenu(x, y, appId, appLabel) {
    this._build(x, y, [
      { icon:'▶️', label:`Open ${appLabel}`, action: () => AppLauncher.launch(appId) },
      { icon:'📌', label:'Unpin from Desktop', action: () => {
        if (typeof DesktopManager !== 'undefined') DesktopManager.unpin(appId);
      }},
      'sep',
      { icon:'🗑️', label:'Remove from Desktop', danger: true, action: () => {
        if (typeof DesktopManager !== 'undefined') DesktopManager.unpin(appId);
      }},
    ]);
  },
};
