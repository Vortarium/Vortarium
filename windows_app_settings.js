
// ===== SETTINGS APP =====
AppLauncher.register('settings', {
  title: 'Settings',
  icon: '⚙️',
  launch(opts) {
    const id = WM.create({ title:'Settings', icon:'⚙️', width:860, height:580, appId:'settings' });
    const content = WM.getContent(id);
    content.innerHTML = `
      <div class="settings-layout">
        <div class="settings-nav" id="sn-${id}">
          <div class="settings-nav-item active" data-page="system"><span class="s-icon">🖥️</span> System</div>
          <div class="settings-nav-item" data-page="personalization"><span class="s-icon">🎨</span> Personalization</div>
          <div class="settings-nav-item" data-page="lockscreen"><span class="s-icon">🔒</span> Lock Screen</div>
          <div class="settings-nav-item" data-page="accounts"><span class="s-icon">👤</span> Accounts & Password</div>
          <div class="settings-nav-item" data-page="network"><span class="s-icon">📶</span> Network</div>
          <div class="settings-nav-item" data-page="privacy"><span class="s-icon">🛡️</span> Privacy</div>
          <div class="settings-nav-item" data-page="update"><span class="s-icon">🔄</span> Windows Update</div>
          <div class="settings-nav-item" data-page="apps"><span class="s-icon">📦</span> Apps</div>
          <div class="settings-nav-item" data-page="display"><span class="s-icon">🖥️</span> Display</div>
          <div class="settings-nav-item" data-page="sound"><span class="s-icon">🔊</span> Sound</div>
          <div class="settings-nav-item" data-page="about"><span class="s-icon">ℹ️</span> About</div>
        </div>
        <div class="settings-content" id="sc-${id}"></div>
      </div>`;
    this._bindNav(id, opts && opts.page ? opts.page : 'system');
  },

  _bindNav(id, startPage) {
    const nav = document.getElementById(`sn-${id}`);
    nav.querySelectorAll('.settings-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        nav.querySelectorAll('.settings-nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        this._renderPage(id, item.dataset.page);
      });
    });
    const startItem = nav.querySelector(`[data-page="${startPage}"]`);
    if (startItem) { nav.querySelectorAll('.settings-nav-item').forEach(i=>i.classList.remove('active')); startItem.classList.add('active'); }
    this._renderPage(id, startPage);
  },

  _renderPage(id, page) {
    const el = document.getElementById(`sc-${id}`);
    if (!el) return;
    const pages = {
      system: () => this._pageSystem(id),
      personalization: () => this._pagePersonalization(id),
      lockscreen: () => this._pageLockScreen(id),
      accounts: () => this._pageAccounts(id),
      network: () => this._pageNetwork(),
      privacy: () => this._pagePrivacy(),
      update: () => this._pageUpdate(),
      apps: () => this._pageApps(),
      display: () => this._pageDisplay(),
      sound: () => this._pageSound(id),
      about: () => this._pageAbout(),
    };
    el.innerHTML = (pages[page] || (() => '<div style="padding:24px;color:var(--text-muted)">Coming soon...</div>'))();
    this._bindPageEvents(id, page);
  },

  _pageSystem(id) {
    return `<div class="settings-section-title">System</div>
    <div class="settings-card">
      <div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">Notifications</div><div class="settings-row-desc">Show app notifications</div></div><label class="toggle"><input type="checkbox" id="s-notifs-${id}" ${OS.settings.notifications?'checked':''}><span class="toggle-slider"></span></label></div>
      <div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">Animations</div><div class="settings-row-desc">Enable window animations</div></div><label class="toggle"><input type="checkbox" id="s-anim-${id}" ${OS.settings.animations?'checked':''}><span class="toggle-slider"></span></label></div>
    </div>
    <div class="settings-card">
      <div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">Brightness</div><div class="settings-row-desc">Adjust screen brightness</div></div><input type="range" min="20" max="100" value="${OS.settings.brightness}" id="s-brightness-${id}" style="accent-color:var(--accent);width:150px"></div>
      <div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">Volume</div><div class="settings-row-desc">System volume</div></div><input type="range" min="0" max="100" value="${OS.settings.volume}" id="s-volume-${id}" style="accent-color:var(--accent);width:150px"></div>
    </div>`;
  },

  _pagePersonalization(id) {
    const wpGradients = [
      'linear-gradient(135deg,#0f0c29,#302b63,#24243e)',
      'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)',
      'linear-gradient(135deg,#0d1117,#161b22,#21262d)',
      'linear-gradient(135deg,#1e3a5f,#2d6a9f,#1a5276)',
      'linear-gradient(135deg,#2d1b69,#11998e,#38ef7d)',
      'linear-gradient(135deg,#fc466b,#3f5efb)',
      'linear-gradient(135deg,#0f2027,#203a43,#2c5364)',
      'linear-gradient(135deg,#141e30,#243b55)',
    ];
    const cur = OS.settings.wallpaper || 'wp-1';
    return `<div class="settings-section-title">Personalization</div>
    <div class="settings-card">
      <div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">Desktop Wallpaper</div><div class="settings-row-desc">Choose a preset or upload your own image</div></div></div>
      <div class="wallpaper-grid" id="wp-grid-${id}">
        <div class="wp-thumb ${cur==='wallpaper.jpg'?'selected':''}" data-wp="wallpaper.jpg" style="background:url('wallpaper.jpg') center/cover,#1a1a2e" title="wallpaper.jpg"></div>
        ${wpGradients.map((g,i)=>`<div class="wp-thumb ${cur==='wp-'+(i+1)?'selected':''}" data-wp="wp-${i+1}" style="background:${g}" title="Preset ${i+1}"></div>`).join('')}
      </div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Upload Custom Wallpaper</div><div class="settings-row-desc">Use any image from your computer</div></div>
        <label style="padding:6px 14px;background:var(--accent);border-radius:6px;cursor:pointer;font-size:12px;color:#fff">
          📁 Browse
          <input type="file" id="wp-upload-${id}" accept="image/*" style="display:none">
        </label>
      </div>
    </div>
    <div class="settings-card">
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Accent Color</div><div class="settings-row-desc">Choose your accent color</div></div>
        <div style="display:flex;gap:8px;align-items:center">
          ${['#0078d4','#7b2ff7','#e74c3c','#27ae60','#f39c12','#e91e63','#00bcd4','#ff5722'].map(c=>`<div style="width:24px;height:24px;border-radius:50%;background:${c};cursor:pointer;border:2px solid ${OS.settings.accent===c?'white':'transparent'};transition:transform 0.15s" data-accent="${c}" class="accent-swatch" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform=''"></div>`).join('')}
          <input type="color" id="accent-custom-${id}" value="${OS.settings.accent||'#0078d4'}" title="Custom color" style="width:28px;height:28px;border:none;border-radius:50%;cursor:pointer;padding:0;background:none">
        </div>
      </div>
    </div>`;
  },

  _pageLockScreen(id) {
    return `<div class="settings-section-title">Lock Screen</div>
    <div class="settings-card">
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Lock Screen Image</div><div class="settings-row-desc">Currently using home.jpg by default</div></div>
        <label style="padding:6px 14px;background:var(--accent);border-radius:6px;cursor:pointer;font-size:12px;color:#fff">
          📁 Browse
          <input type="file" id="ls-upload-${id}" accept="image/*" style="display:none">
        </label>
      </div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Lock Screen Preview</div></div>
        <div id="ls-preview-${id}" style="width:160px;height:90px;border-radius:8px;background:url('${OS.settings.lockWallpaper||'home.jpg'}') center/cover,linear-gradient(135deg,#0f0c29,#302b63);border:2px solid var(--border);overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:24px;color:rgba(255,255,255,0.5)">
          ${OS.settings.lockWallpaper?'':'🏠'}
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Reset to Default</div><div class="settings-row-desc">Use home.jpg as lock screen</div></div>
        <button id="ls-reset-${id}" style="padding:6px 14px;background:rgba(255,255,255,0.06);border:1px solid var(--border);border-radius:6px;color:#fff;cursor:pointer;font-size:12px">Reset</button>
      </div>
    </div>`;
  },

  _pageAccounts(id) {
    const hasPass = (OS.settings.password || '').length > 0;
    const pfpStyle = OS.settings.pfp ? `background-image:url('${OS.settings.pfp}');background-size:cover;background-position:center;` : 'background:var(--accent);';
    return `<div class="settings-section-title">Accounts & Password</div>
    <div class="settings-card">
      <div class="settings-row">
        <div style="display:flex;align-items:center;gap:16px">
          <div style="width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px;${pfpStyle}">${OS.settings.pfp?'':'👤'}</div>
          <div><div style="font-size:16px;font-weight:600">${OS.settings.username||'User'}</div><div style="font-size:12px;color:var(--text-muted)">Local Account · Administrator</div></div>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Profile Picture</div><div class="settings-row-desc">Upload a custom profile picture</div></div>
        <div style="display:flex;gap:8px;align-items:center;">
          <label style="padding:6px 14px;background:var(--accent);border-radius:6px;cursor:pointer;font-size:12px;color:#fff;">
            📁 Upload
            <input type="file" id="s-pfp-upload-${id}" accept="image/*" style="display:none;">
          </label>
          ${OS.settings.pfp?`<button id="s-pfp-remove-${id}" style="padding:6px 14px;background:rgba(196,43,28,0.2);border:1px solid rgba(196,43,28,0.3);border-radius:6px;color:#f44747;cursor:pointer;font-size:12px;">Remove</button>`:''}
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Username</div></div>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="text" id="s-uname-${id}" value="${OS.settings.username||'User'}" style="padding:6px 10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#fff;font-size:13px;outline:none;width:160px">
          <button id="s-save-uname-${id}" style="padding:6px 14px;background:var(--accent);border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:12px">Save</button>
        </div>
      </div>
    </div>
    <div class="settings-card">
      <div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">Password Protection</div><div class="settings-row-desc">${hasPass?'Password is set — required at lock screen':'No password set — anyone can unlock'}</div></div>
        <span style="font-size:20px">${hasPass?'🔒':'🔓'}</span>
      </div>
      ${hasPass ? `
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Current Password</div></div>
        <input type="password" id="s-curpass-${id}" placeholder="Current password" style="padding:6px 10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#fff;font-size:13px;outline:none;width:180px">
      </div>` : ''}
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">${hasPass?'New Password':'Set Password'}</div><div class="settings-row-desc">Leave blank to remove password</div></div>
        <input type="password" id="s-newpass-${id}" placeholder="${hasPass?'New password (blank to remove)':'Set a password'}" style="padding:6px 10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#fff;font-size:13px;outline:none;width:180px">
      </div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Confirm Password</div></div>
        <input type="password" id="s-confpass-${id}" placeholder="Confirm password" style="padding:6px 10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#fff;font-size:13px;outline:none;width:180px">
      </div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label" id="s-pass-msg-${id}" style="color:var(--text-muted)"></div></div>
        <button id="s-save-pass-${id}" style="padding:6px 14px;background:var(--accent);border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:12px">${hasPass?'Update Password':'Set Password'}</button>
      </div>
    </div>`;
  },

  _pageNetwork() {
    return `<div class="settings-section-title">Network & Internet</div>
    <div class="settings-card">
      <div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">Wi-Fi</div><div class="settings-row-desc">Connected to HomeNetwork_5G</div></div><label class="toggle"><input type="checkbox" checked><span class="toggle-slider"></span></label></div>
      <div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">Bluetooth</div><div class="settings-row-desc">On — 2 devices connected</div></div><label class="toggle"><input type="checkbox" checked><span class="toggle-slider"></span></label></div>
      <div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">Airplane Mode</div></div><label class="toggle"><input type="checkbox"><span class="toggle-slider"></span></label></div>
    </div>
    <div class="settings-card">
      <div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">IP Address</div><div class="settings-row-desc">192.168.1.100</div></div></div>
      <div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">DNS</div><div class="settings-row-desc">8.8.8.8, 8.8.4.4</div></div></div>
    </div>`;
  },

  _pagePrivacy() {
    return `<div class="settings-section-title">Privacy & Security</div>
    <div class="settings-card">
      ${['Location','Camera','Microphone','Contacts','Calendar'].map(item=>`<div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">${item}</div></div><label class="toggle"><input type="checkbox" checked><span class="toggle-slider"></span></label></div>`).join('')}
    </div>`;
  },

  _pageUpdate() {
    return `<div class="settings-section-title">Windows Update</div>
    <div class="settings-card">
      <div class="settings-row"><div style="display:flex;align-items:center;gap:16px"><span style="font-size:32px">✅</span><div><div style="font-size:15px;font-weight:500">You're up to date</div><div style="font-size:12px;color:var(--text-muted)">Last checked: Today</div></div></div></div>
      <div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">Windows 12 Version 12.0.${OS.build}</div></div><button onclick="Notifications.send('Windows Update','Checking for updates...','🔄')" style="padding:6px 14px;background:var(--accent);border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:12px">Check for updates</button></div>
    </div>`;
  },

  _pageApps() {
    return `<div class="settings-section-title">Apps & Features</div>
    <div class="settings-card">
      ${[{n:'File Explorer',s:'12.4 MB',i:'📁'},{n:'Terminal',s:'8.2 MB',i:'💻'},{n:'Notepad',s:'3.1 MB',i:'📝'},{n:'Calculator',s:'2.8 MB',i:'🧮'},{n:'Paint',s:'5.6 MB',i:'🎨'},{n:'Browser',s:'145 MB',i:'🌐'},{n:'Task Manager',s:'4.2 MB',i:'📊'}].map(a=>`<div class="settings-row"><div style="display:flex;align-items:center;gap:10px;flex:1"><span style="font-size:20px">${a.i}</span><div class="settings-row-info"><div class="settings-row-label">${a.n}</div><div class="settings-row-desc">${a.s}</div></div></div></div>`).join('')}
    </div>`;
  },

  _pageDisplay() {
    return `<div class="settings-section-title">Display</div>
    <div class="settings-card">
      <div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">Resolution</div></div><select class="settings-select"><option>2560 × 1440 (Recommended)</option><option>1920 × 1080</option><option>1280 × 720</option></select></div>
      <div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">Refresh Rate</div></div><select class="settings-select"><option>144 Hz</option><option>120 Hz</option><option>60 Hz</option></select></div>
      <div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">Scale</div></div><select class="settings-select"><option>125% (Recommended)</option><option>100%</option><option>150%</option></select></div>
      <div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">Night Light</div><div class="settings-row-desc">Reduce blue light at night</div></div><label class="toggle"><input type="checkbox"><span class="toggle-slider"></span></label></div>
    </div>`;
  },

  _pageSound(id) {
    return `<div class="settings-section-title">Sound</div>
    <div class="settings-card">
      <div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">Master Volume</div></div><input type="range" min="0" max="100" value="${OS.settings.volume}" id="s-vol2-${id}" style="accent-color:var(--accent);width:150px"></div>
      <div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">Output Device</div></div><select class="settings-select"><option>Speakers (Realtek HD Audio)</option><option>Headphones</option></select></div>
    </div>`;
  },

  _pageAbout() {
    return `<div class="settings-section-title">About</div>
    <div class="settings-card">
      <div class="settings-row"><div style="display:flex;align-items:center;gap:16px"><svg width="48" height="48" viewBox="0 0 18 18" fill="none"><rect x="0" y="0" width="8" height="8" rx="1" fill="var(--accent)"/><rect x="10" y="0" width="8" height="8" rx="1" fill="var(--accent)"/><rect x="0" y="10" width="8" height="8" rx="1" fill="var(--accent)"/><rect x="10" y="10" width="8" height="8" rx="1" fill="var(--accent)"/></svg><div><div style="font-size:18px;font-weight:600">Windows 12</div><div style="font-size:12px;color:var(--text-muted)">Version 12.0.${OS.build}</div></div></div></div>
      ${[['Device name',OS.hostname],['Processor','Intel Core i9-14900K @ 3.2GHz'],['Installed RAM','16.0 GB'],['System type','64-bit operating system, x64-based processor'],['OS Build',OS.build+'.0']].map(([k,v])=>`<div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">${k}</div></div><div style="font-size:13px;color:var(--text-muted)">${v}</div></div>`).join('')}
    </div>
    <div class="settings-card">
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Reset Windows 12</div><div class="settings-row-desc">Clears all settings and files — cannot be undone</div></div>
        <button id="s-reset-os" style="padding:6px 14px;background:rgba(196,43,28,0.2);border:1px solid rgba(196,43,28,0.4);border-radius:6px;color:#f44747;cursor:pointer;font-size:12px;">Reset OS</button>
      </div>
    </div>`;
  },

  _bindPageEvents(id, page) {
    const get = (sel) => document.getElementById(sel);

    if (page === 'system') {
      const notifs = get(`s-notifs-${id}`);
      if (notifs) notifs.addEventListener('change', e => { OS.settings.notifications = e.target.checked; OS.saveSettings(); });
      const brightness = get(`s-brightness-${id}`);
      if (brightness) brightness.addEventListener('input', e => { OS.settings.brightness = parseInt(e.target.value); document.body.style.filter = `brightness(${OS.settings.brightness/100})`; OS.saveSettings(); });
      const volume = get(`s-volume-${id}`);
      if (volume) volume.addEventListener('input', e => { OS.settings.volume = parseInt(e.target.value); OS.saveSettings(); });
    }

    if (page === 'personalization') {
      // Preset wallpapers
      const wpGradients = ['linear-gradient(135deg,#0f0c29,#302b63,#24243e)','linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)','linear-gradient(135deg,#0d1117,#161b22,#21262d)','linear-gradient(135deg,#1e3a5f,#2d6a9f,#1a5276)','linear-gradient(135deg,#2d1b69,#11998e,#38ef7d)','linear-gradient(135deg,#fc466b,#3f5efb)','linear-gradient(135deg,#0f2027,#203a43,#2c5364)','linear-gradient(135deg,#141e30,#243b55)'];
      const grid = get(`wp-grid-${id}`);
      if (grid) {
        grid.querySelectorAll('.wp-thumb').forEach(thumb => {
          thumb.addEventListener('click', () => {
            grid.querySelectorAll('.wp-thumb').forEach(t => t.classList.remove('selected'));
            thumb.classList.add('selected');
            const wp = thumb.dataset.wp;
            OS.settings.wallpaper = wp;
            const wallEl = document.getElementById('wallpaper');
            if (wallEl) {
              if (wp.startsWith('wp-')) {
                const idx = parseInt(wp.replace('wp-','')) - 1;
                wallEl.style.backgroundImage = wpGradients[idx] || wpGradients[0];
                wallEl.style.backgroundSize = '';
              } else {
                wallEl.style.backgroundImage = `url('${wp}'), linear-gradient(135deg,#0f0c29,#302b63,#24243e)`;
                wallEl.style.backgroundSize = 'cover';
                wallEl.style.backgroundPosition = 'center';
              }
            }
            OS.saveSettings();
          });
        });
      }
      // Custom wallpaper upload
      const wpUpload = get(`wp-upload-${id}`);
      if (wpUpload) {
        wpUpload.addEventListener('change', e => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = ev => {
            const dataUrl = ev.target.result;
            OS.settings.wallpaper = dataUrl;
            OS.settings.wallpaperCustom = dataUrl;
            const wallEl = document.getElementById('wallpaper');
            if (wallEl) { wallEl.style.backgroundImage = `url('${dataUrl}')`; wallEl.style.backgroundSize = 'cover'; wallEl.style.backgroundPosition = 'center'; }
            OS.saveSettings();
            Notifications.send('Settings', 'Wallpaper updated!', '🖼️');
            grid.querySelectorAll('.wp-thumb').forEach(t => t.classList.remove('selected'));
          };
          reader.readAsDataURL(file);
        });
      }
      // Accent colors
      document.querySelectorAll(`#sc-${id} .accent-swatch`).forEach(swatch => {
        swatch.addEventListener('click', () => {
          const c = swatch.dataset.accent;
          document.documentElement.style.setProperty('--accent', c);
          OS.settings.accent = c;
          OS.saveSettings();
          document.querySelectorAll(`#sc-${id} .accent-swatch`).forEach(s => s.style.border = '2px solid transparent');
          swatch.style.border = '2px solid white';
        });
      });
      const accentCustom = get(`accent-custom-${id}`);
      if (accentCustom) {
        accentCustom.addEventListener('input', e => {
          document.documentElement.style.setProperty('--accent', e.target.value);
          OS.settings.accent = e.target.value;
          OS.saveSettings();
        });
      }
    }

    if (page === 'lockscreen') {
      const lsUpload = get(`ls-upload-${id}`);
      if (lsUpload) {
        lsUpload.addEventListener('change', e => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = ev => {
            const dataUrl = ev.target.result;
            OS.settings.lockWallpaper = dataUrl;
            OS.saveSettings();
            const preview = get(`ls-preview-${id}`);
            if (preview) { preview.style.backgroundImage = `url('${dataUrl}')`; preview.style.backgroundSize = 'cover'; preview.innerHTML = ''; }
            Notifications.send('Settings', 'Lock screen image updated!', '🔒');
          };
          reader.readAsDataURL(file);
        });
      }
      const lsReset = get(`ls-reset-${id}`);
      if (lsReset) {
        lsReset.addEventListener('click', () => {
          OS.settings.lockWallpaper = '';
          OS.saveSettings();
          const preview = get(`ls-preview-${id}`);
          if (preview) { preview.style.backgroundImage = "url('home.jpg')"; preview.innerHTML = ''; }
          Notifications.send('Settings', 'Lock screen reset to home.jpg', '🏠');
        });
      }
    }

    if (page === 'accounts') {
      const pfpUpload = get(`s-pfp-upload-${id}`);
      if (pfpUpload) {
        pfpUpload.addEventListener('change', e => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = ev => {
            OS.settings.pfp = ev.target.result;
            OS.saveSettings();
            OS._applyPfp();
            Notifications.send('Settings', 'Profile picture updated!', '👤');
            this._renderPage(id, 'accounts');
          };
          reader.readAsDataURL(file);
        });
      }
      const pfpRemove = get(`s-pfp-remove-${id}`);
      if (pfpRemove) {
        pfpRemove.addEventListener('click', () => {
          OS.settings.pfp = '';
          OS.saveSettings();
          OS._applyPfp();
          this._renderPage(id, 'accounts');
        });
      }
      const saveUname = get(`s-save-uname-${id}`);
      if (saveUname) {
        saveUname.addEventListener('click', () => {
          const newName = (get(`s-uname-${id}`) || {}).value || '';
          if (newName.trim()) {
            OS.username = newName.trim();
            OS.settings.username = newName.trim();
            OS.saveSettings();
            const ud = document.getElementById('username-display');
            if (ud) ud.textContent = newName.trim();
            Notifications.send('Settings', 'Username updated to ' + newName.trim(), '👤');
          }
        });
      }
      const savePass = get(`s-save-pass-${id}`);
      if (savePass) {
        savePass.addEventListener('click', () => {
          const curPassEl = get(`s-curpass-${id}`);
          const newPassEl = get(`s-newpass-${id}`);
          const confPassEl = get(`s-confpass-${id}`);
          const msgEl = get(`s-pass-msg-${id}`);
          const curPass = curPassEl ? curPassEl.value : '';
          const newPass = newPassEl ? newPassEl.value : '';
          const confPass = confPassEl ? confPassEl.value : '';
          const existingPass = OS.settings.password || '';

          if (existingPass && curPass !== existingPass) {
            if (msgEl) { msgEl.textContent = '❌ Current password is incorrect'; msgEl.style.color = '#f44747'; }
            return;
          }
          if (newPass !== confPass) {
            if (msgEl) { msgEl.textContent = '❌ Passwords do not match'; msgEl.style.color = '#f44747'; }
            return;
          }
          OS.settings.password = newPass;
          OS.saveSettings();
          console.log('Password saved:', OS.settings.password);
          if (msgEl) { msgEl.textContent = newPass ? '✅ Password set successfully' : '✅ Password removed'; msgEl.style.color = '#4ec9b0'; }
          Notifications.send('Settings', newPass ? 'Password has been set' : 'Password removed', '🔒');
          setTimeout(() => this._renderPage(id, 'accounts'), 1500);
        });
      }
    }

    if (page === 'sound') {
      const vol2 = get(`s-vol2-${id}`);
      if (vol2) vol2.addEventListener('input', e => { OS.settings.volume = parseInt(e.target.value); OS.saveSettings(); });
    }

    if (page === 'about') {
      const resetBtn = get('s-reset-os');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          if (confirm('This will reset ALL settings and files. Are you sure?')) {
            OS.resetOS();
          }
        });
      }
    }
  }
});
