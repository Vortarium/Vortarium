// ===== NOTION CLONE =====
AppLauncher.register('notion', {
  title: 'Notion', icon: '📋',
  launch() {
    if (typeof StoreManager !== 'undefined' && !StoreManager.isInstalled('notion')) {
      _showInstallGate('Notion', '📋', 'notion'); return;
    }
    const id = WM.create({ title: 'Notion', icon: '📋', width: 1000, height: 660, appId: 'notion' });
    const content = WM.getContent(id);
    content.style.cssText = 'display:flex;overflow:hidden;background:#191919;color:#fff;font-family:"Segoe UI",sans-serif;';

    const saved = OS.getAppData('notion') || {};
    const state = {
      pages: saved.pages || [
        { id:'p1', title:'Getting Started', icon:'👋', content:'# Welcome to Notion\n\nThis is your workspace. Create pages, take notes, and organize your life.\n\n## Quick Start\n- Create a new page with the + button\n- Use markdown for formatting\n- Organize with nested pages' },
        { id:'p2', title:'My Tasks', icon:'✅', content:'# Tasks\n\n- [ ] Buy groceries\n- [x] Finish project\n- [ ] Call dentist\n- [ ] Read book\n- [ ] Exercise' },
        { id:'p3', title:'Notes', icon:'📝', content:'# Notes\n\nWrite anything here...' },
      ],
      active: saved.active || 'p1',
    };
    const save = () => OS.setAppData('notion', { pages: state.pages, active: state.active });

    const getPage = () => state.pages.find(p => p.id === state.active);

    const renderMarkdown = (text) => {
      return text
        .replace(/^# (.+)$/gm, '<h1 style="font-size:28px;font-weight:700;margin:16px 0 8px;">$1</h1>')
        .replace(/^## (.+)$/gm, '<h2 style="font-size:20px;font-weight:600;margin:14px 0 6px;">$1</h2>')
        .replace(/^### (.+)$/gm, '<h3 style="font-size:16px;font-weight:600;margin:12px 0 4px;">$1</h3>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code style="background:rgba(255,255,255,0.1);padding:1px 5px;border-radius:3px;font-family:monospace;">$1</code>')
        .replace(/^- \[x\] (.+)$/gm, '<div style="display:flex;align-items:center;gap:8px;margin:3px 0;"><input type="checkbox" checked disabled style="accent-color:#0d99ff;"><span style="text-decoration:line-through;color:rgba(255,255,255,0.4);">$1</span></div>')
        .replace(/^- \[ \] (.+)$/gm, '<div style="display:flex;align-items:center;gap:8px;margin:3px 0;"><input type="checkbox" disabled style="accent-color:#0d99ff;"><span>$1</span></div>')
        .replace(/^- (.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0;"><span style="color:rgba(255,255,255,0.4);">•</span><span>$1</span></div>')
        .replace(/\n/g, '<br>');
    };

    const render = () => {
      const page = getPage();
      content.innerHTML = `
        <!-- Sidebar -->
        <div style="width:240px;background:#111;display:flex;flex-direction:column;flex-shrink:0;border-right:1px solid rgba(255,255,255,0.06);">
          <div style="padding:14px 16px;font-weight:700;font-size:14px;display:flex;align-items:center;gap:8px;">
            <span>📋</span> Notion
          </div>
          <div style="flex:1;overflow-y:auto;padding:4px 0;">
            <div style="padding:4px 12px;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Pages</div>
            ${state.pages.map(p => `
              <div data-pageid="${p.id}" style="display:flex;align-items:center;gap:8px;padding:6px 12px;cursor:pointer;border-radius:4px;margin:0 4px;background:${state.active===p.id?'rgba(255,255,255,0.1)':'transparent'};font-size:13px;"
                   onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background='${state.active===p.id?'rgba(255,255,255,0.1)':'transparent'}'">
                <span>${p.icon}</span>
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.title}</span>
              </div>`).join('')}
          </div>
          <div style="padding:8px 12px;border-top:1px solid rgba(255,255,255,0.06);">
            <button id="notion-new-${id}" style="width:100%;padding:8px;background:rgba(255,255,255,0.06);border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:13px;text-align:left;">+ New Page</button>
          </div>
        </div>

        <!-- Main content -->
        <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
          <!-- Toolbar -->
          <div style="display:flex;align-items:center;gap:8px;padding:8px 16px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;">
            <span style="font-size:20px;">${page?.icon || '📄'}</span>
            <input id="notion-title-${id}" type="text" value="${page?.title || ''}"
              style="flex:1;background:transparent;border:none;color:#fff;font-size:18px;font-weight:700;outline:none;">
            <div style="display:flex;gap:4px;">
              <button id="notion-preview-${id}" style="padding:4px 10px;background:rgba(255,255,255,0.06);border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:12px;">Preview</button>
              <button id="notion-edit-${id}" style="padding:4px 10px;background:var(--accent);border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:12px;">Edit</button>
            </div>
          </div>
          <!-- Editor / Preview -->
          <div style="flex:1;overflow:hidden;display:flex;flex-direction:column;">
            <textarea id="notion-editor-${id}" style="flex:1;background:transparent;border:none;color:#d1d2d3;font-size:14px;line-height:1.8;padding:24px;outline:none;resize:none;font-family:'Segoe UI',sans-serif;">${page?.content || ''}</textarea>
            <div id="notion-preview-area-${id}" style="flex:1;overflow-y:auto;padding:24px;display:none;font-size:14px;line-height:1.8;color:#d1d2d3;"></div>
          </div>
        </div>`;

      // Bind sidebar
      content.querySelectorAll('[data-pageid]').forEach(el => {
        el.addEventListener('click', () => {
          // Save current
          const cur = getPage();
          if (cur) {
            cur.content = document.getElementById(`notion-editor-${id}`)?.value || cur.content;
            cur.title = document.getElementById(`notion-title-${id}`)?.value || cur.title;
          }
          state.active = el.dataset.pageid;
          save();
          render();
        });
      });

      document.getElementById(`notion-new-${id}`).addEventListener('click', () => {
        const title = prompt('Page title:', 'New Page');
        if (!title) return;
        const icons = ['📄','📝','💡','🎯','📊','🗂️','🔖','⭐'];
        const newPage = { id: 'p_' + Date.now(), title, icon: icons[Math.floor(Math.random()*icons.length)], content: `# ${title}\n\nStart writing...` };
        state.pages.push(newPage);
        state.active = newPage.id;
        save();
        render();
      });

      const editor = document.getElementById(`notion-editor-${id}`);
      const previewArea = document.getElementById(`notion-preview-area-${id}`);

      if (editor) {
        editor.addEventListener('input', () => {
          const p = getPage();
          if (p) { p.content = editor.value; save(); }
        });
      }

      const titleInput = document.getElementById(`notion-title-${id}`);
      if (titleInput) {
        titleInput.addEventListener('input', () => {
          const p = getPage();
          if (p) { p.title = titleInput.value; save(); }
        });
      }

      document.getElementById(`notion-preview-${id}`).addEventListener('click', () => {
        if (editor) editor.style.display = 'none';
        if (previewArea) {
          previewArea.style.display = 'block';
          previewArea.innerHTML = renderMarkdown(editor?.value || getPage()?.content || '');
        }
      });

      document.getElementById(`notion-edit-${id}`).addEventListener('click', () => {
        if (editor) editor.style.display = '';
        if (previewArea) previewArea.style.display = 'none';
      });
    };

    render();
  }
});
