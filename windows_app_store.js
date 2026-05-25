// ===== MICROSOFT STORE =====
const StoreManager = {
  _key: 'win12_store_installed',
  installed: null,

  load() {
    if (this.installed) return;
    try { this.installed = new Set(JSON.parse(localStorage.getItem(this._key) || '[]')); }
    catch(e) { this.installed = new Set(); }
  },
  isInstalled(appId) { this.load(); return this.installed.has(appId); },
  install(appId) { this.load(); this.installed.add(appId); this._save(); },
  uninstall(appId) { this.load(); this.installed.delete(appId); this._save(); },
  _save() { try { localStorage.setItem(this._key, JSON.stringify([...this.installed])); } catch(e) {} }
};

AppLauncher.register('store', {
  title: 'Microsoft Store', icon: '🛒',

  launch() {
    const id = WM.create({ title:'Microsoft Store', icon:'🛒', width:1000, height:680, appId:'store' });
    const content = WM.getContent(id);
    content.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;background:#1a1a1a;color:#fff;';
    StoreManager.load();

    const APPS = [
      { id:'spotify',     name:'Spotify',           icon:'🎧', cat:'Music',          rating:5, price:'Free',      size:'142 MB', version:'1.2.31',   publisher:'Spotify AB',              desc:'Stream millions of songs and podcasts. Build playlists, shuffle your library, enjoy gapless playback.',                                                screenshots:['🎵','🎶','🎼'] },
      { id:'discord',     name:'Discord',            icon:'💬', cat:'Social',         rating:4, price:'Free',      size:'89 MB',  version:'0.0.309',  publisher:'Discord Inc.',             desc:'Your place to talk. Voice, video, text. Create servers, join communities, message friends directly.',                                                   screenshots:['💬','🎙️','🖥️'] },
      { id:'zoom',        name:'Zoom',               icon:'📹', cat:'Communication',  rating:4, price:'Free',      size:'211 MB', version:'5.17.1',   publisher:'Zoom Video',               desc:'HD video conferencing with screen sharing, virtual backgrounds, and live reactions.',                                                                    screenshots:['📹','🖥️','👥'] },
      { id:'clipchamp',  name:'Clipchamp',         icon:'🎬', cat:'Video',          rating:5, price:'Free',      size:'318 MB', version:'2.0.1',    publisher:'Microsoft',                desc:'Professional video editor. Import clips, trim, add effects, export. Full timeline editing.',                                                          screenshots:['🎬','🎞️','📽️'] },
      { id:'photoshop',   name:'Photoshop',          icon:'🖼️', cat:'Design',         rating:5, price:'$9.99/mo', size:'4.2 GB', version:'25.9.1',   publisher:'Adobe Inc.',               desc:'The world\'s most powerful image editor. Brushes, filters, layers, adjustments.',                                                                       screenshots:['🖼️','🎨','✏️'] },
      { id:'vscode',      name:'VS Code',            icon:'💻', cat:'Developer',      rating:5, price:'Free',      size:'96 MB',  version:'1.89.1',   publisher:'Microsoft',                desc:'Lightweight but powerful code editor with IntelliSense, Git integration, and debugging.',                                                               screenshots:['💻','🔧','📁'] },
      { id:'notion',      name:'Notion',             icon:'📋', cat:'Productivity',   rating:4, price:'Free',      size:'112 MB', version:'3.1.0',    publisher:'Notion Labs',              desc:'All-in-one workspace for notes, docs, wikis, and project management.',                                                                                  screenshots:['📋','📝','🗂️'] },
      { id:'office',      name:'Office 365',         icon:'📊', cat:'Productivity',   rating:4, price:'$6.99/mo', size:'2.1 GB', version:'16.0',     publisher:'Microsoft',                desc:'Word, Excel, PowerPoint, Outlook and more — always up to date.',                                                                                        screenshots:['📊','📝','📧'] },
      { id:'youtube',     name:'YouTube',            icon:'▶️', cat:'Entertainment',  rating:5, price:'Free',      size:'85 MB',  version:'19.12.1',  publisher:'Google LLC',               desc:'Upload videos, grow your channel, watch trending content. Views grow over time into millions.',                                                          screenshots:['▶️','📹','🎬'] },
      { id:'tiktok',      name:'TikTok',             icon:'🎵', cat:'Entertainment',  rating:4, price:'Free',      size:'120 MB', version:'34.1.2',   publisher:'ByteDance',                desc:'Short-form video platform. Upload, discover, and go viral. Gain followers from views.',                                                                  screenshots:['🎵','💃','🔥'] },
      { id:'word',        name:'Microsoft Word',     icon:'📘', cat:'Productivity',   rating:5, price:'Included', size:'1.2 GB', version:'16.0',     publisher:'Microsoft',                desc:'Create and edit rich documents with full formatting, styles, and export.',                                                                               screenshots:['📘','📝','✍️'] },
      { id:'excel',       name:'Microsoft Excel',    icon:'📗', cat:'Productivity',   rating:5, price:'Included', size:'1.4 GB', version:'16.0',     publisher:'Microsoft',                desc:'Powerful spreadsheets with formulas, charts, pivot tables, and data analysis.',                                                                          screenshots:['📗','📊','🔢'] },
      { id:'powerpoint',  name:'PowerPoint',         icon:'📙', cat:'Productivity',   rating:5, price:'Included', size:'1.1 GB', version:'16.0',     publisher:'Microsoft',                desc:'Create stunning presentations with slides, animations, and themes.',                                                                                     screenshots:['📙','🎯','✨'] },
      { id:'mail',        name:'Outlook Mail',       icon:'📧', cat:'Communication',  rating:4, price:'Free',      size:'180 MB', version:'4.2.1',    publisher:'Microsoft',                desc:'Email, calendar, and contacts. Compose, reply, organize your inbox.',                                                                                   screenshots:['📧','📅','👤'] },
      { id:'teams',       name:'Microsoft Teams',    icon:'🟣', cat:'Communication',  rating:4, price:'Free',      size:'250 MB', version:'24.1.0',   publisher:'Microsoft',                desc:'Chat, meet, call, and collaborate. Channels, video calls, file sharing all in one.',                                                                    screenshots:['🟣','💬','📹'] },
      { id:'weatherapp',  name:'Weather',            icon:'🌤️', cat:'Utilities',      rating:4, price:'Free',      size:'12 MB',  version:'2.0.0',    publisher:'Windows 12',               desc:'Full weather data with 16-day forecast, hourly breakdown, and location search.',                                                                         screenshots:['🌤️','🌧️','❄️'] },
      { id:'vlc',         name:'VLC Media Player',   icon:'▶️', cat:'Media',          rating:5, price:'Free',      size:'41 MB',  version:'3.0.21',   publisher:'VideoLAN',                 desc:'Plays everything — video, audio, DVDs, streams. No codecs needed.',                                                                                    screenshots:['▶️','🎞️','🔊'] },
      { id:'flstudio',    name:'FL Studio',          icon:'🎹', cat:'Music',          rating:5, price:'Free',      size:'1.1 GB', version:'21.2.3',   publisher:'Image-Line',               desc:'Full-featured DAW with step sequencer, piano roll, mixer, and playlist. Make beats, melodies, and full tracks.',                                          screenshots:['🎹','🎵','🎛️'] },
      { id:'fileexplorer',name:'File Explorer',      icon:'📁', cat:'Utilities',      rating:5, price:'Included', size:'45 MB',  version:'12.0',     publisher:'Windows 12',               desc:'Browse and manage files and folders on your system.',                                                                                                    screenshots:['📁','📂','📄'] },
      { id:'terminal',    name:'Terminal',           icon:'⬛', cat:'Developer',      rating:4, price:'Included', size:'8 MB',   version:'12.0',     publisher:'Windows 12',               desc:'Command-line interface for power users and developers.',                                                                                               screenshots:['⬛','💻','🔧'] },
      { id:'settings',    name:'Settings',           icon:'⚙️', cat:'Utilities',      rating:5, price:'Included', size:'15 MB',  version:'12.0',     publisher:'Windows 12',               desc:'Customize your Windows 12 experience with personalization, privacy, and system settings.',                                                               screenshots:['⚙️','🎨','🔒'] },
      { id:'notepad',     name:'Notepad',            icon:'📝', cat:'Productivity',   rating:4, price:'Included', size:'5 MB',   version:'12.0',     publisher:'Windows 12',               desc:'Simple text editor for quick notes and code snippets.',                                                                                                  screenshots:['📝','📄','✏️'] },
      { id:'browser',     name:'Browser',            icon:'🌐', cat:'Communication',  rating:4, price:'Included', size:'65 MB',  version:'12.0',     publisher:'Windows 12',               desc:'Web browser for browsing the internet with tabs and bookmarks.',                                                                                       screenshots:['🌐','🔍','📑'] },
      { id:'calculator',  name:'Calculator',         icon:'🔢', cat:'Utilities',      rating:5, price:'Included', size:'3 MB',   version:'12.0',     publisher:'Windows 12',               desc:'Standard and scientific calculator for all your math needs.',                                                                                              screenshots:['🔢','➕','÷'] },
      { id:'taskmanager', name:'Task Manager',       icon:'📊', cat:'Utilities',      rating:4, price:'Included', size:'12 MB',  version:'12.0',     publisher:'Windows 12',               desc:'Monitor system performance and manage running applications.',                                                                                               screenshots:['📊','📈','⚡'] },
      { id:'paint',       name:'Paint',              icon:'🎨', cat:'Design',         rating:4, price:'Included', size:'25 MB',  version:'12.0',     publisher:'Windows 12',               desc:'Simple drawing and image editing tool with brushes, shapes, and colors.',                                                                                   screenshots:['🎨','🖌️','🖼️'] },
      { id:'calendar',    name:'Calendar',           icon:'📅', cat:'Productivity',   rating:4, price:'Included', size:'18 MB',  version:'12.0',     publisher:'Windows 12',               desc:'Manage your schedule with events, reminders, and calendar views.',                                                                                             screenshots:['📅','📆','🗓️'] },
      { id:'music',       name:'Music',              icon:'🎵', cat:'Media',          rating:4, price:'Included', size:'35 MB',  version:'12.0',     publisher:'Windows 12',               desc:'Play and organize your music library with playlists and shuffle.',                                                                                            screenshots:['🎵','🎶','🎧'] },
      { id:'photos',      name:'Photos',             icon:'🖼️', cat:'Media',          rating:4, price:'Included', size:'40 MB',  version:'12.0',     publisher:'Windows 12',               desc:'View and organize your photo collection with albums and slideshows.',                                                                                          screenshots:['🖼️','📷','🎞️'] },
      { id:'viruslab',    name:'Virus Lab',          icon:'🦠', cat:'Utilities',      rating:3, price:'Free',      size:'15 MB',  version:'1.0.0',    publisher:'Windows 12',               desc:'Simulated virus lab for educational purposes. Create and study virtual viruses.',                                                                              screenshots:['🦠','🔬','⚠️'] },
    ];

    const GAMES = [
      { id:'pacman',       name:'Pac-Man',         icon:'🟡', cat:'Arcade',    rating:5, price:'Free', size:'2 MB',  version:'1.0.0', publisher:'Arcade Classics', desc:'Eat dots, dodge ghosts. The iconic maze game.',                                screenshots:['🟡','👻','🔵'] },
      { id:'breakout',     name:'Breakout',        icon:'🧱', cat:'Arcade',    rating:4, price:'Free', size:'1 MB',  version:'1.0.0', publisher:'Arcade Classics', desc:'Smash bricks with a bouncing ball and paddle.',                                screenshots:['🧱','🏓','⚡'] },
      { id:'spaceinvaders',name:'Space Invaders',  icon:'👾', cat:'Arcade',    rating:5, price:'Free', size:'1 MB',  version:'1.0.0', publisher:'Arcade Classics', desc:'Defend Earth from the alien armada.',                                          screenshots:['👾','🚀','💥'] },
      { id:'flappybird',   name:'Flappy Bird',     icon:'🐦', cat:'Casual',    rating:4, price:'Free', size:'1 MB',  version:'1.0.0', publisher:'Arcade Classics', desc:'Tap to flap through endless pipes.',                                           screenshots:['🐦','🌿','🏆'] },
      { id:'minesweeper',  name:'Minesweeper',     icon:'💣', cat:'Puzzle',    rating:4, price:'Free', size:'1 MB',  version:'1.0.0', publisher:'Arcade Classics', desc:'Logic puzzle — uncover tiles without hitting mines.',                          screenshots:['💣','🚩','🔢'] },
      { id:'snake',        name:'Snake',           icon:'🐍', cat:'Arcade',    rating:4, price:'Free', size:'1 MB',  version:'1.0.0', publisher:'Arcade Classics', desc:'Eat food, grow longer, don\'t hit the walls.',                                 screenshots:['🐍','🍎','🏆'] },
      { id:'tetris',       name:'Tetris',          icon:'🟥', cat:'Puzzle',    rating:5, price:'Free', size:'1 MB',  version:'1.0.0', publisher:'Arcade Classics', desc:'Stack tetrominoes, clear lines, survive.',                                     screenshots:['🟥','🟦','🟩'] },
      { id:'pong',         name:'Pong',            icon:'🏓', cat:'Arcade',    rating:4, price:'Free', size:'1 MB',  version:'1.0.0', publisher:'Arcade Classics', desc:'Two paddles, one ball. The original video game.',                              screenshots:['🏓','⚪','🏆'] },
      { id:'memory',       name:'Memory Match',    icon:'🃏', cat:'Puzzle',    rating:4, price:'Free', size:'1 MB',  version:'1.0.0', publisher:'Arcade Classics', desc:'Flip cards and find matching pairs.',                                          screenshots:['🃏','🧠','🎯'] },
      { id:'geodash',      name:'Geometry Dash',   icon:'🟦', cat:'Platformer', rating:5, price:'Free', size:'3 MB', version:'2.2.0', publisher:'RobTop Games',    desc:'Rhythm-based platformer. Jump over spikes to the beat.',                      screenshots:['🟦','⚡','🎵'] },
    ];

    const ALL = [...APPS, ...GAMES];
    let currentTab = 'home';

    const stars = n => '⭐'.repeat(n) + '☆'.repeat(5-n);

    const card = (app) => {
      const inst = StoreManager.isInstalled(app.id);
      return `<div class="store-app-card" data-appid="${app.id}" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:14px;cursor:pointer;transition:all 0.15s;display:flex;flex-direction:column;gap:6px;" onmouseover="this.style.background='rgba(255,255,255,0.08)';this.style.transform='translateY(-2px)'" onmouseout="this.style.background='rgba(255,255,255,0.04)';this.style.transform=''">
        <div style="font-size:36px;text-align:center;margin-bottom:4px;">${app.icon}</div>
        <div style="font-size:13px;font-weight:600;text-align:center;line-height:1.2;">${app.name}</div>
        <div style="font-size:10px;color:rgba(255,255,255,0.4);text-align:center;">${app.cat}</div>
        <div style="font-size:10px;text-align:center;">${stars(app.rating)}</div>
        <div style="font-size:11px;text-align:center;color:${inst?'#4ec9b0':'var(--accent)'};">${inst?'✓ Installed':app.price}</div>
      </div>`;
    };

    // Toolbar
    content.innerHTML = `
      <div style="display:flex;align-items:center;gap:4px;padding:10px 12px;background:#111;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;">
        <span style="font-size:20px;margin-right:4px;">🛒</span>
        ${['home','apps','games','library'].map(t=>`
          <button data-tab="${t}" style="padding:6px 14px;background:${currentTab===t?'rgba(0,120,212,0.3)':'transparent'};border:none;border-radius:6px;color:${currentTab===t?'var(--accent)':'rgba(255,255,255,0.7)'};cursor:pointer;font-size:13px;font-weight:${currentTab===t?'600':'400'};">
            ${t==='home'?'🏠 Home':t==='apps'?'📦 Apps':t==='games'?'🎮 Games':'📚 Library'}
          </button>`).join('')}
        <div style="flex:1;"></div>
        <input id="store-search-${id}" type="text" placeholder="Search Store…" style="padding:6px 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:20px;color:#fff;font-size:12px;outline:none;width:200px;">
      </div>
      <div id="store-body-${id}" style="flex:1;overflow:hidden;"></div>`;

    const body = () => document.getElementById(`store-body-${id}`);

    const setTab = (tab) => {
      currentTab = tab;
      content.querySelectorAll('[data-tab]').forEach(b => {
        b.style.background = b.dataset.tab === tab ? 'rgba(0,120,212,0.3)' : 'transparent';
        b.style.color = b.dataset.tab === tab ? 'var(--accent)' : 'rgba(255,255,255,0.7)';
        b.style.fontWeight = b.dataset.tab === tab ? '600' : '400';
      });
      renderTab(tab);
    };

    content.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => setTab(btn.dataset.tab));
    });

    document.getElementById(`store-search-${id}`).addEventListener('input', e => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) { renderTab(currentTab); return; }
      const results = ALL.filter(a => a.name.toLowerCase().includes(q) || a.cat.toLowerCase().includes(q));
      body().innerHTML = `<div style="overflow-y:auto;height:100%;padding:16px;">
        <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:rgba(255,255,255,0.7);">Results for "${q}"</div>
        ${results.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;">${results.map(a=>card(a)).join('')}</div>`
          : '<div style="color:rgba(255,255,255,0.4);padding:20px;">No results found.</div>'}
      </div>`;
      bindCards();
    });

    const renderTab = (tab) => {
      if (tab === 'home') {
        body().innerHTML = `<div style="overflow-y:auto;height:100%;padding:0 0 16px;">
          <div style="background:linear-gradient(135deg,#0078d4,#7b2ff7);padding:24px;display:flex;align-items:center;gap:16px;margin-bottom:16px;">
            <div style="font-size:48px;">🛒</div>
            <div><div style="font-size:20px;font-weight:700;">Microsoft Store</div><div style="font-size:13px;color:rgba(255,255,255,0.8);">Apps, games, and more — all in one place.</div></div>
          </div>
          <div style="padding:0 16px;">
            <div style="font-size:14px;font-weight:600;margin-bottom:10px;color:rgba(255,255,255,0.7);">Featured Apps</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:20px;">${APPS.slice(0,8).map(a=>card(a)).join('')}</div>
            <div style="font-size:14px;font-weight:600;margin-bottom:10px;color:rgba(255,255,255,0.7);">Arcade Games</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;">${GAMES.slice(0,6).map(g=>card(g)).join('')}</div>
          </div>
        </div>`;
      } else if (tab === 'apps') {
        body().innerHTML = `<div style="overflow-y:auto;height:100%;padding:16px;">
          <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:rgba(255,255,255,0.7);">All Apps (${APPS.length})</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;">${APPS.map(a=>card(a)).join('')}</div>
        </div>`;
      } else if (tab === 'games') {
        body().innerHTML = `<div style="overflow-y:auto;height:100%;padding:16px;">
          <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:rgba(255,255,255,0.7);">Arcade &amp; Casual Games</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;">${GAMES.map(g=>card(g)).join('')}</div>
        </div>`;
      } else if (tab === 'library') {
        const installed = ALL.filter(a => StoreManager.isInstalled(a.id));
        body().innerHTML = `<div style="overflow-y:auto;height:100%;padding:16px;">
          <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:rgba(255,255,255,0.7);">My Library (${installed.length})</div>
          ${installed.length === 0
            ? '<div style="color:rgba(255,255,255,0.4);font-size:13px;padding:20px 0;">Nothing installed yet.</div>'
            : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;">${installed.map(a=>card(a)).join('')}</div>`}
        </div>`;
      }
      bindCards();
    };

    const bindCards = () => {
      body().querySelectorAll('.store-app-card').forEach(el => {
        el.addEventListener('click', () => {
          const app = ALL.find(a => a.id === el.dataset.appid);
          if (app) showDetail(app);
        });
      });
    };

    const showDetail = (app) => {
      const inst = StoreManager.isInstalled(app.id);
      const isGame = GAMES.some(g => g.id === app.id);
      body().innerHTML = `<div style="overflow-y:auto;height:100%;padding:24px;">
        <button id="store-back-${id}" style="background:transparent;border:none;color:var(--accent);cursor:pointer;font-size:13px;margin-bottom:20px;padding:0;display:flex;align-items:center;gap:4px;">◀ Back</button>
        <div style="display:flex;gap:24px;align-items:flex-start;margin-bottom:24px;">
          <div style="width:100px;height:100px;background:rgba(255,255,255,0.06);border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:56px;flex-shrink:0;">${app.icon}</div>
          <div style="flex:1;">
            <div style="font-size:24px;font-weight:700;">${app.name}</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px;">${app.publisher} · ${app.cat} · v${app.version} · ${app.size}</div>
            <div style="font-size:12px;margin-top:4px;">${stars(app.rating)}</div>
            <div style="display:flex;gap:10px;margin-top:16px;">
              ${inst
                ? `<button id="store-open-${id}" style="padding:10px 28px;background:var(--accent);border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:14px;font-weight:600;">▶ Open</button>
                   <button id="store-uninstall-${id}" style="padding:10px 20px;background:rgba(196,43,28,0.15);border:1px solid rgba(196,43,28,0.3);border-radius:8px;color:#f44747;cursor:pointer;font-size:13px;">Uninstall</button>`
                : `<button id="store-install-${id}" style="padding:10px 28px;background:var(--accent);border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:14px;font-weight:600;">${app.price === 'Free' || app.price === 'Included' ? 'Get' : 'Buy · ' + app.price}</button>`}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:24px;">
          ${app.screenshots.map(s=>`<div style="width:160px;height:100px;border-radius:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;font-size:36px;">${s}</div>`).join('')}
        </div>
        <div style="font-size:15px;font-weight:600;margin-bottom:8px;">About this ${isGame?'game':'app'}</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.7);line-height:1.7;max-width:600px;">${app.desc}</div>
      </div>`;

      document.getElementById(`store-back-${id}`).addEventListener('click', () => renderTab(currentTab));

      const installBtn = document.getElementById(`store-install-${id}`);
      if (installBtn) {
        installBtn.addEventListener('click', () => {
          installBtn.textContent = 'Installing…';
          installBtn.disabled = true;
          installBtn.style.opacity = '0.6';
          setTimeout(() => {
            StoreManager.install(app.id);
            Notifications.send('Microsoft Store', `${app.name} installed!`, '✅');
            showDetail(app);
          }, 1500);
        });
      }

      const openBtn = document.getElementById(`store-open-${id}`);
      if (openBtn) {
        openBtn.addEventListener('click', () => {
          const launchMap = { vlc:'music', breakout:'games', spaceinvaders:'games', flappybird:'games', pacman:'games', minesweeper:'games', snake:'games', tetris:'games', pong:'games', memory:'games', geodash:'geodash' };
          AppLauncher.launch(launchMap[app.id] || app.id);
        });
      }

      const uninstallBtn = document.getElementById(`store-uninstall-${id}`);
      if (uninstallBtn) {
        uninstallBtn.addEventListener('click', () => {
          StoreManager.uninstall(app.id);
          Notifications.send('Microsoft Store', `${app.name} uninstalled.`, '🗑️');
          showDetail(app);
        });
      }
    };

    renderTab('home');
  }
});
