// ===== FILE EXPLORER APP =====
AppLauncher.register('fileexplorer', {
  title: 'File Explorer',
  icon: '📁',
  width: 900,
  height: 560,

  launch(opts) {
    const id = WM.create({
      title: 'File Explorer',
      icon: '📁',
      width: 900,
      height: 560,
      appId: 'fileexplorer',
    });

    const content = WM.getContent(id);
    content.innerHTML = this._buildUI();
    this._init(id, opts && opts.path ? opts.path : 'C:/Users/User');
  },

  _buildUI() {
    return `
      <div class="win-toolbar">
        <button class="win-toolbar-btn" id="fe-back">◀ Back</button>
        <button class="win-toolbar-btn" id="fe-forward">▶ Forward</button>
        <button class="win-toolbar-btn" id="fe-up">⬆ Up</button>
        <button class="win-toolbar-btn" id="fe-refresh">🔄</button>
        <div style="flex:1"></div>
        <button class="win-toolbar-btn" id="fe-view-grid" title="Grid View">⊞</button>
        <button class="win-toolbar-btn" id="fe-view-list" title="List View">☰</button>
        <button class="win-toolbar-btn" id="fe-new-folder">📁 New</button>
        <button class="win-toolbar-btn" id="fe-delete">🗑️ Delete</button>
      </div>
      <div class="win-addressbar">
        <button class="addr-btn" id="fe-addr-back">◀</button>
        <input type="text" id="fe-path-input" value="C:/Users/User" />
        <button class="addr-btn" id="fe-addr-go">→</button>
      </div>
      <div class="fe-layout">
        <div class="fe-sidebar" id="fe-sidebar"></div>
        <div class="fe-main" id="fe-main"></div>
      </div>
    `;
  },

  _init(winId, startPath) {
    const win = document.getElementById(winId);
    const state = {
      path: startPath,
      history: [startPath],
      histIdx: 0,
      view: 'grid',
      selected: null,
    };

    const navigate = (path) => {
      if (!FS.exists(path)) {
        Notifications.send('File Explorer', `Path not found: ${path}`, '❌');
        return;
      }
      if (state.histIdx < state.history.length - 1) {
        state.history = state.history.slice(0, state.histIdx + 1);
      }
      state.history.push(path);
      state.histIdx = state.history.length - 1;
      state.path = path;
      state.selected = null;
      render();
    };

    const render = () => {
      const pathInput = win.querySelector('#fe-path-input');
      if (pathInput) pathInput.value = state.path;
      WM.setTitle(winId, 'File Explorer — ' + state.path.split('/').pop());
      renderSidebar();
      renderMain();
    };

    const renderSidebar = () => {
      const sidebar = win.querySelector('#fe-sidebar');
      const quickAccess = [
        { label: 'Desktop', path: 'C:/Users/User/Desktop', icon: '🖥️' },
        { label: 'Documents', path: 'C:/Users/User/Documents', icon: '📄' },
        { label: 'Downloads', path: 'C:/Users/User/Downloads', icon: '⬇️' },
        { label: 'Pictures', path: 'C:/Users/User/Pictures', icon: '🖼️' },
        { label: 'Music', path: 'C:/Users/User/Music', icon: '🎵' },
        { label: 'Videos', path: 'C:/Users/User/Videos', icon: '🎬' },
      ];
      const drives = [
        { label: 'Local Disk (C:)', path: 'C:', icon: '💾' },
      ];

      sidebar.innerHTML = `
        <div class="fe-sidebar-section">Quick Access</div>
        ${quickAccess.map(i => `
          <div class="fe-sidebar-item ${state.path === i.path ? 'active' : ''}" data-path="${i.path}">
            <span>${i.icon}</span><span>${i.label}</span>
          </div>
        `).join('')}
        <div class="fe-sidebar-section">This PC</div>
        ${drives.map(i => `
          <div class="fe-sidebar-item ${state.path === i.path ? 'active' : ''}" data-path="${i.path}">
            <span>${i.icon}</span><span>${i.label}</span>
          </div>
        `).join('')}
      `;

      sidebar.querySelectorAll('.fe-sidebar-item').forEach(item => {
        item.addEventListener('click', () => navigate(item.dataset.path));
      });
    };

    const renderMain = () => {
      const main = win.querySelector('#fe-main');
      const items = FS.ls(state.path);
      if (!items) {
        main.innerHTML = '<div style="padding:20px;color:var(--text-muted)">Cannot read this location.</div>';
        return;
      }

      const entries = Object.entries(items);
      if (entries.length === 0) {
        main.innerHTML = '<div style="padding:20px;color:var(--text-muted)">This folder is empty.</div>';
        return;
      }

      if (state.view === 'grid') {
        main.innerHTML = `<div class="fe-grid">${entries.map(([name, node]) => `
          <div class="fe-item ${state.selected === name ? 'selected' : ''}" data-name="${name}" data-type="${node.type}">
            <div class="fe-icon">${FS.getIcon(name, node.type)}</div>
            <div class="fe-name">${name}</div>
          </div>
        `).join('')}</div>`;
      } else {
        main.innerHTML = `<div class="fe-list">${entries.map(([name, node]) => `
          <div class="fe-list-item ${state.selected === name ? 'selected' : ''}" data-name="${name}" data-type="${node.type}">
            <span class="fe-icon">${FS.getIcon(name, node.type)}</span>
            <span style="flex:1">${name}</span>
            <span style="color:var(--text-muted);font-size:11px">${node.type === 'file' ? FS.formatSize(node.size || 0) : ''}</span>
            <span style="color:var(--text-muted);font-size:11px;margin-left:16px">${node.modified ? new Date(node.modified).toLocaleDateString() : ''}</span>
          </div>
        `).join('')}</div>`;
      }

      // Bind item events
      main.querySelectorAll('.fe-item, .fe-list-item').forEach(item => {
        item.addEventListener('click', (e) => {
          state.selected = item.dataset.name;
          main.querySelectorAll('.fe-item, .fe-list-item').forEach(i => i.classList.remove('selected'));
          item.classList.add('selected');
        });

        item.addEventListener('dblclick', () => {
          const name = item.dataset.name;
          const type = item.dataset.type;
          const fullPath = state.path + '/' + name;
          if (type === 'folder' || type === 'drive') {
            navigate(fullPath);
          } else {
            const ext = name.split('.').pop().toLowerCase();
            // Text/code files → Notepad
            if (['txt','md','log','js','ts','py','html','css','json','xml','csv','ini','cfg','bat','sh','docx','doc'].includes(ext)) {
              if (['docx','doc'].includes(ext) && AppLauncher.apps['word']) {
                AppLauncher.launch('word', { path: fullPath });
              } else {
                AppLauncher.launch('notepad', { path: fullPath });
              }
            }
            // Spreadsheets → Excel
            else if (['xlsx','xls'].includes(ext)) {
              AppLauncher.launch('excel', { path: fullPath });
            }
            // Presentations → PowerPoint
            else if (['pptx','ppt'].includes(ext)) {
              AppLauncher.launch('powerpoint', { path: fullPath });
            }
            // ZIP files → extract
            else if (ext === 'zip') {
              if (typeof _tryExtractZip === 'function' && _tryExtractZip(fullPath)) {
                render();
              } else {
                Notifications.send('File Explorer', `Cannot extract: ${name}`, '📦');
              }
            }
            // EXE files → run
            else if (ext === 'exe') {
              if (typeof _tryRunExe === 'function' && _tryRunExe(fullPath)) {
                // virus started
              } else {
                Notifications.send('File Explorer', `Running: ${name}`, '⚙️');
              }
            }
            // Images → lightbox viewer
            else if (['jpg','jpeg','png','gif','bmp','svg','webp'].includes(ext)) {
              const fileContent = FS.readFile(fullPath);
              if (fileContent && fileContent.startsWith('data:image')) {
                const lb = document.createElement('div');
                lb.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;cursor:pointer;';
                lb.innerHTML = `
                  <div style="position:absolute;top:16px;right:16px;display:flex;gap:8px;">
                    <button id="lb-dl-fe" style="padding:6px 14px;background:var(--accent);border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:12px;">⬇️ Download</button>
                    <button id="lb-close-fe" style="background:rgba(255,255,255,0.1);border:none;border-radius:50%;width:36px;height:36px;color:#fff;cursor:pointer;font-size:18px;">✕</button>
                  </div>
                  <img src="${fileContent}" style="max-width:90vw;max-height:85vh;border-radius:8px;object-fit:contain;">
                  <div style="color:rgba(255,255,255,0.6);font-size:13px;">${name}</div>`;
                document.body.appendChild(lb);
                lb.addEventListener('click', e => { if (e.target === lb) lb.remove(); });
                document.getElementById('lb-close-fe').addEventListener('click', () => lb.remove());
                document.getElementById('lb-dl-fe').addEventListener('click', () => {
                  const a = document.createElement('a'); a.href = fileContent; a.download = name; a.click();
                });
              } else {
                AppLauncher.launch('myphotos');
              }
            }
            // Audio files → music player
            else if (['mp3','wav','flac','ogg','aac','m4a'].includes(ext)) {
              const fileContent = FS.readFile(fullPath);
              if (fileContent && fileContent.startsWith('data:audio')) {
                const player = document.createElement('div');
                player.style.cssText = 'position:fixed;bottom:60px;right:16px;background:rgba(22,22,32,0.97);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:16px;z-index:9999;min-width:280px;';
                player.innerHTML = `
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                    <div style="font-size:13px;font-weight:600;">🎵 ${name}</div>
                    <button onclick="this.closest('div').remove()" style="background:transparent;border:none;color:rgba(255,255,255,0.5);cursor:pointer;font-size:16px;">✕</button>
                  </div>
                  <audio controls autoplay style="width:100%;" src="${fileContent}"></audio>`;
                document.body.appendChild(player);
              } else {
                AppLauncher.launch('music');
              }
            }
            // Video files → video player
            else if (['mp4','avi','mkv','mov','webm'].includes(ext)) {
              const fileContent = FS.readFile(fullPath);
              if (fileContent && fileContent.startsWith('data:video')) {
                const player = document.createElement('div');
                player.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;';
                player.innerHTML = `
                  <div style="position:absolute;top:16px;right:16px;">
                    <button onclick="this.closest('div').remove()" style="background:rgba(255,255,255,0.1);border:none;border-radius:50%;width:36px;height:36px;color:#fff;cursor:pointer;font-size:18px;">✕</button>
                  </div>
                  <video controls autoplay style="max-width:90vw;max-height:85vh;border-radius:8px;" src="${fileContent}"></video>
                  <div style="color:rgba(255,255,255,0.6);font-size:13px;">${name}</div>`;
                document.body.appendChild(player);
              } else {
                Notifications.send('File Explorer', `Cannot play: ${name}`, '🎬');
              }
            }
            // PDF → browser
            else if (ext === 'pdf') {
              AppLauncher.launch('browser');
            }
            // Unknown
            else {
              AppLauncher.launch('notepad', { path: fullPath });
            }
          }
        });

        item.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          state.selected = item.dataset.name;
          showItemContextMenu(e.clientX, e.clientY, item.dataset.name, item.dataset.type);
        });
      });
    };

    const showItemContextMenu = (x, y, name, type) => {
      const existing = document.getElementById('fe-ctx-menu');
      if (existing) existing.remove();

      const menu = document.createElement('div');
      menu.id = 'fe-ctx-menu';
      menu.className = 'context-menu-popup';
      menu.style.cssText = `position:fixed;left:${x}px;top:${y}px;background:rgba(28,28,38,0.95);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:6px;min-width:180px;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.5);`;

      const actions = type === 'file'
        ? [
            { label: '📂 Open', action: 'open' },
            { label: '✏️ Rename', action: 'rename' },
            { label: '🗑️ Delete', action: 'delete' },
          ]
        : [
            { label: '📂 Open', action: 'open' },
            { label: '✏️ Rename', action: 'rename' },
            { label: '🗑️ Delete', action: 'delete' },
          ];

      menu.innerHTML = actions.map(a => `
        <div style="padding:7px 12px;border-radius:6px;cursor:pointer;font-size:13px;transition:background 0.15s;" 
             onmouseover="this.style.background='rgba(255,255,255,0.08)'" 
             onmouseout="this.style.background=''" 
             data-action="${a.action}">${a.label}</div>
      `).join('');

      document.body.appendChild(menu);

      menu.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          const fullPath = state.path + '/' + name;
          switch (btn.dataset.action) {
            case 'open':
              if (type === 'folder') navigate(fullPath);
              else AppLauncher.launch('notepad', { path: fullPath });
              break;
            case 'rename':
              const newName = prompt('Rename to:', name);
              if (newName && newName !== name) {
                const node = FS.getNodeObj(fullPath);
                if (node) {
                  const parent = FS.getNodeObj(state.path);
                  if (parent && parent.children) {
                    parent.children[newName] = node;
                    delete parent.children[name];
                    render();
                  }
                }
              }
              break;
            case 'delete':
              if (confirm(`Delete "${name}"?`)) {
                FS.rm(fullPath);
                render();
              }
              break;
          }
          menu.remove();
        });
      });

      setTimeout(() => {
        document.addEventListener('click', () => menu.remove(), { once: true });
      }, 0);
    };

    // Toolbar buttons
    win.querySelector('#fe-back').addEventListener('click', () => {
      if (state.histIdx > 0) {
        state.histIdx--;
        state.path = state.history[state.histIdx];
        render();
      }
    });

    win.querySelector('#fe-forward').addEventListener('click', () => {
      if (state.histIdx < state.history.length - 1) {
        state.histIdx++;
        state.path = state.history[state.histIdx];
        render();
      }
    });

    win.querySelector('#fe-up').addEventListener('click', () => {
      const parts = state.path.split('/');
      if (parts.length > 1) {
        parts.pop();
        navigate(parts.join('/'));
      }
    });

    win.querySelector('#fe-refresh').addEventListener('click', render);

    win.querySelector('#fe-view-grid').addEventListener('click', () => {
      state.view = 'grid';
      win.querySelector('#fe-view-grid').classList.add('active');
      win.querySelector('#fe-view-list').classList.remove('active');
      renderMain();
    });

    win.querySelector('#fe-view-list').addEventListener('click', () => {
      state.view = 'list';
      win.querySelector('#fe-view-list').classList.add('active');
      win.querySelector('#fe-view-grid').classList.remove('active');
      renderMain();
    });

    win.querySelector('#fe-new-folder').addEventListener('click', () => {
      const name = prompt('Folder name:', 'New Folder');
      if (name) {
        FS.mkdir(state.path + '/' + name);
        render();
      }
    });

    win.querySelector('#fe-delete').addEventListener('click', () => {
      if (state.selected) {
        if (confirm(`Delete "${state.selected}"?`)) {
          FS.rm(state.path + '/' + state.selected);
          state.selected = null;
          render();
        }
      }
    });

    win.querySelector('#fe-addr-go').addEventListener('click', () => {
      navigate(win.querySelector('#fe-path-input').value);
    });

    win.querySelector('#fe-path-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') navigate(e.target.value);
    });

    win.querySelector('#fe-addr-back').addEventListener('click', () => {
      if (state.histIdx > 0) {
        state.histIdx--;
        state.path = state.history[state.histIdx];
        render();
      }
    });

    render();
  }
});
