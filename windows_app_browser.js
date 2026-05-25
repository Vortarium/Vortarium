// ===== BROWSER — with tabs =====
AppLauncher.register('browser', {
  title: 'Browser', icon: '🌐',

  launch(opts) {
    const id = WM.create({ title:'Browser', icon:'🌐', width:1060, height:700, appId:'browser' });
    const content = WM.getContent(id);
    content.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;';

    const state = {
      tabs: [{ id:'t1', url:'win12://newtab', title:'New Tab', history:['win12://newtab'], histIdx:0 }],
      activeTab: 't1',
      nextId: 2,
    };

    const getTab = () => state.tabs.find(t => t.id === state.activeTab);

    content.innerHTML = `
      <div id="br-tabbar-${id}" style="display:flex;align-items:flex-end;background:rgba(0,0,0,0.4);padding:4px 6px 0;gap:2px;flex-shrink:0;overflow-x:auto;min-height:34px;"></div>
      <div style="display:flex;align-items:center;gap:4px;padding:5px 8px;background:rgba(0,0,0,0.2);border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;">
        <button class="addr-btn" id="br-back-${id}">◀</button>
        <button class="addr-btn" id="br-fwd-${id}">▶</button>
        <button class="addr-btn" id="br-ref-${id}">🔄</button>
        <button class="addr-btn" id="br-home-${id}">🏠</button>
        <input type="text" class="browser-url" id="br-url-${id}" value="win12://newtab" placeholder="Search Google or enter URL..." style="flex:1;" />
        <button class="addr-btn" id="br-go-${id}">→</button>
        <button class="addr-btn" id="br-bm-${id}" title="Bookmark">⭐</button>
        <button class="addr-btn" id="br-nt-${id}" title="New Tab" style="font-size:20px;font-weight:300;line-height:1;">+</button>
      </div>
      <div id="br-content-${id}" style="flex:1;display:flex;flex-direction:column;overflow:hidden;position:relative;"></div>
    `;

    const urlInput = document.getElementById(`br-url-${id}`);
    const contentArea = document.getElementById(`br-content-${id}`);
    const tabBar = document.getElementById(`br-tabbar-${id}`);

    // ── Tabs ──────────────────────────────────────────────────────────────
    const renderTabs = () => {
      tabBar.innerHTML = '';
      state.tabs.forEach(tab => {
        const el = document.createElement('div');
        const isActive = tab.id === state.activeTab;
        el.style.cssText = `display:flex;align-items:center;gap:5px;padding:5px 10px 6px;border-radius:8px 8px 0 0;
          cursor:pointer;font-size:12px;max-width:160px;min-width:80px;flex-shrink:0;white-space:nowrap;
          background:${isActive?'rgba(255,255,255,0.1)':'rgba(255,255,255,0.03)'};
          border-bottom:${isActive?'2px solid var(--accent)':'2px solid transparent'};
          transition:background 0.15s;`;
        el.innerHTML = `
          <span style="overflow:hidden;text-overflow:ellipsis;flex:1;">${tab.title}</span>
          <span data-closetab="${tab.id}" style="opacity:0.5;font-size:10px;padding:1px 4px;border-radius:3px;flex-shrink:0;line-height:1;">✕</span>`;
        el.addEventListener('click', e => {
          if (e.target.dataset.closetab) { closeTab(e.target.dataset.closetab); return; }
          switchTab(tab.id);
        });
        tabBar.appendChild(el);
      });
    };

    const switchTab = tabId => {
      state.activeTab = tabId;
      const tab = getTab();
      urlInput.value = tab.url === 'win12://newtab' ? '' : tab.url;
      renderTabs();
      renderTabContent();
    };

    const closeTab = tabId => {
      if (state.tabs.length === 1) { navigate('win12://newtab'); return; }
      const idx = state.tabs.findIndex(t => t.id === tabId);
      state.tabs.splice(idx, 1);
      if (state.activeTab === tabId) state.activeTab = state.tabs[Math.max(0,idx-1)].id;
      renderTabs();
      renderTabContent();
    };

    const newTab = (url='win12://newtab') => {
      const tabId = 't' + (state.nextId++);
      state.tabs.push({ id:tabId, url, title:'New Tab', history:[url], histIdx:0 });
      state.activeTab = tabId;
      renderTabs();
      navigate(url);
    };

    // ── Home page ──────────────────────────────────────────────────────────
    const showHome = () => {
      const tab = getTab();
      tab.url = 'win12://newtab'; tab.title = 'New Tab';
      urlInput.value = '';
      WM.setTitle(id, 'Browser');
      renderTabs();
      contentArea.innerHTML = `
        <div class="browser-home">
          <div style="font-size:52px;">🌐</div>
          <div style="font-size:20px;font-weight:300;color:var(--text-muted);">Windows 12 Browser</div>
          <div class="browser-home-search">
            <input type="text" id="br-hs-${id}" placeholder="Search or enter URL / local file path..." />
            <button id="br-hsb-${id}">Go</button>
          </div>
          <div class="browser-bookmarks">
            ${[
              {icon:'🔍',label:'Google',url:'https://www.google.com'},
              {icon:'▶️',label:'YouTube',url:'https://www.youtube.com'},
              {icon:'🐙',label:'GitHub',url:'https://github.com'},
              {icon:'📚',label:'Wikipedia',url:'https://en.wikipedia.org'},
              {icon:'🗞️',label:'Reddit',url:'https://www.reddit.com'},
              {icon:'🛒',label:'Amazon',url:'https://www.amazon.com'},
              {icon:'🐦',label:'X/Twitter',url:'https://x.com'},
              {icon:'🌀',label:'Vortarium',url:'https://vortarium.github.io/Vortarium'},
            ].map(b=>`<div class="browser-bookmark" data-url="${b.url}"><span class="bm-icon">${b.icon}</span><span>${b.label}</span></div>`).join('')}
          </div>
          <div style="margin-top:16px;padding:12px 16px;background:rgba(255,80,80,0.07);border:1px solid rgba(255,80,80,0.2);border-radius:8px;max-width:480px;width:100%;">
            <div style="font-size:11px;color:#f44;font-weight:700;margin-bottom:8px;">⚠️ SPONSORED — Free Software Downloads</div>
            <div style="display:flex;flex-direction:column;gap:6px;">
              ${[
                {label:'🎮 FREE Games Pack 2024 — Download Now!', url:'win12://virus/1'},
                {label:'🖥️ PC Speed Booster Pro (Free)', url:'win12://virus/3'},
                {label:'🎵 MP3 Converter Ultra HD — No Ads!', url:'win12://virus/5'},
                {label:'💰 Make $500/day from home — FREE tool', url:'win12://virus/6'},
                {label:'🔓 WiFi Password Hacker v9.1 [WORKING]', url:'win12://virus/8'},
                {label:'☠️ [CRACKED] Adobe Suite 2024 Full', url:'win12://virus/9'},
                {label:'🌈 Screensaver HD Pack — TOTALLY SAFE', url:'win12://virus/10'},
              ].map(l=>`<div class="browser-bookmark" data-url="${l.url}" style="background:rgba(255,80,80,0.05);border:1px solid rgba(255,80,80,0.15);font-size:11px;padding:6px 10px;"><span>${l.label}</span></div>`).join('')}
            </div>
          </div>
          <div style="color:var(--text-muted);font-size:11px;text-align:center;max-width:480px;">
            Tip: Paste any URL including local file:// paths. Sites blocking iframes show an "Open in real browser" button.
          </div>
        </div>`;
      const hs = document.getElementById(`br-hs-${id}`);
      const hsb = document.getElementById(`br-hsb-${id}`);
      const doSearch = () => { const q=hs.value.trim(); if(q) navigate(q); };
      hsb.addEventListener('click', doSearch);
      hs.addEventListener('keydown', e => { if(e.key==='Enter') doSearch(); });
      hs.focus();
      contentArea.querySelectorAll('.browser-bookmark[data-url]').forEach(bm => {
        bm.addEventListener('click', () => navigate(bm.dataset.url));
      });
    };

    // ── Navigate ───────────────────────────────────────────────────────────
    const navigate = raw => {
      let url = (raw||'').trim();
      if (!url || url === 'win12://newtab') { showHome(); return; }

      // Handle internal virus download pages
      if (url.startsWith('win12://virus/')) {
        const virusId = parseInt(url.replace('win12://virus/', ''));
        if (virusId >= 1 && virusId <= 10) {
          const tab = getTab();
          tab.url = url; tab.title = 'TotallyLegitSoftware.net';
          urlInput.value = url;
          WM.setTitle(id, 'Browser — TotallyLegitSoftware.net');
          renderTabs();
          const tier = virusId <= 5 ? 'mild' : virusId <= 8 ? 'medium' : 'severe';
          const html = _virusSiteHTML(virusId, '', tier);
          const blob = new Blob([html], {type:'text/html'});
          const blobUrl = URL.createObjectURL(blob);
          contentArea.innerHTML = '';
          const iframe = document.createElement('iframe');
          iframe.style.cssText = 'flex:1;border:none;width:100%;height:100%;background:#0a0a0a;display:block;';
          iframe.src = blobUrl;
          contentArea.appendChild(iframe);
          return;
        }
      }

      if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('win12://') && !url.startsWith('file://') && !url.startsWith('blob:')) {
        // Only auto-add https:// if it looks like a real domain (has a dot, no spaces, no backslash)
        if (url.includes('.') && !url.includes(' ') && !url.startsWith('/') && !url.startsWith('C:') && !url.startsWith('c:') && !url.match(/^[a-zA-Z]:\\/)) {
          url = 'https://' + url;
        } else if (!url.includes('.') || url.includes(' ')) {
          // Treat as search query
          url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
        }
        // Otherwise leave as-is (local path, file://, etc.)
      }

      const tab = getTab();
      if (tab.histIdx < tab.history.length-1) tab.history = tab.history.slice(0, tab.histIdx+1);
      tab.history.push(url); tab.histIdx = tab.history.length-1;
      tab.url = url;
      const domain = url.replace(/^https?:\/\//,'').split('/')[0];
      tab.title = domain.replace('www.','');
      urlInput.value = url;
      WM.setTitle(id, 'Browser — '+tab.title);
      renderTabs();

      contentArea.innerHTML = `
        <div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;background:#111;">
          <div style="font-size:32px;animation:pulse 1s infinite;">🌐</div>
          <div style="color:var(--text-muted);font-size:13px;">Loading <b style="color:#fff;">${domain}</b>...</div>
        </div>`;

      setTimeout(() => {
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'flex:1;border:none;width:100%;height:100%;background:#fff;display:block;';
        iframe.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation');
        iframe.src = url;
        contentArea.innerHTML = '';
        contentArea.appendChild(iframe);

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:absolute;bottom:12px;right:12px;z-index:10;display:flex;gap:8px;';
        overlay.innerHTML = `
          <button id="br-real-${id}" style="padding:6px 14px;background:var(--accent);border:none;border-radius:20px;color:#fff;cursor:pointer;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,0.4);">🔗 Open in real browser</button>
          <button id="br-save-${id}" style="padding:6px 14px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:20px;color:#fff;cursor:pointer;font-size:12px;">⬇️ Save URL</button>`;
        contentArea.appendChild(overlay);
        document.getElementById(`br-real-${id}`).addEventListener('click', () => window.open(url,'_blank'));
        document.getElementById(`br-save-${id}`).addEventListener('click', () => {
          FS.saveDownload(domain.replace(/[^a-z0-9]/gi,'_')+'.url', `[InternetShortcut]\nURL=${url}\n`);
        });
      }, 350);
    };

    const renderTabContent = () => {
      const tab = getTab();
      if (tab.url === 'win12://newtab') showHome(); else navigate(tab.url);
    };

    // ── Controls ───────────────────────────────────────────────────────────
    document.getElementById(`br-back-${id}`).addEventListener('click', () => {
      const t=getTab(); if(t.histIdx>0){t.histIdx--;navigate(t.history[t.histIdx]);}
    });
    document.getElementById(`br-fwd-${id}`).addEventListener('click', () => {
      const t=getTab(); if(t.histIdx<t.history.length-1){t.histIdx++;navigate(t.history[t.histIdx]);}
    });
    document.getElementById(`br-ref-${id}`).addEventListener('click', () => navigate(getTab().url));
    document.getElementById(`br-home-${id}`).addEventListener('click', () => navigate('win12://newtab'));
    document.getElementById(`br-go-${id}`).addEventListener('click', () => navigate(urlInput.value));
    document.getElementById(`br-nt-${id}`).addEventListener('click', () => newTab());
    document.getElementById(`br-bm-${id}`).addEventListener('click', () => Notifications.send('Browser','Bookmarked: '+urlInput.value,'⭐'));
    urlInput.addEventListener('keydown', e => { if(e.key==='Enter') navigate(urlInput.value); });
    urlInput.addEventListener('focus', () => urlInput.select());

    renderTabs();
    showHome();
  }
});
