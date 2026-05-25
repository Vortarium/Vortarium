// ===== WINDOW MANAGER =====
const WM = {
  windows: {},
  zCounter: 100,
  activeId: null,
  snapPreview: null,

  init() {
    this.snapPreview = document.createElement('div');
    this.snapPreview.id = 'snap-preview';
    document.getElementById('desktop').appendChild(this.snapPreview);
  },

  // Create a new window
  create(opts) {
    const id = 'win_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const {
      title = 'Window',
      icon = '🪟',
      width = 800,
      height = 520,
      x, y,
      content = '',
      appId = null,
      resizable = true,
      minWidth = 300,
      minHeight = 200,
    } = opts;

    const winX = x !== undefined ? x : Math.max(0, (window.innerWidth - width) / 2 + Math.random() * 40 - 20);
    const winY = y !== undefined ? y : Math.max(0, (window.innerHeight - height - 48) / 2 + Math.random() * 40 - 20);

    const win = document.createElement('div');
    win.className = 'win';
    win.id = id;
    win.style.cssText = `width:${width}px;height:${height}px;left:${winX}px;top:${winY}px;`;
    win.dataset.appId = appId || '';
    win.dataset.minWidth = minWidth;
    win.dataset.minHeight = minHeight;

    win.innerHTML = `
      <div class="win-titlebar" data-win="${id}">
        <span class="win-icon">${icon}</span>
        <span class="win-title">${title}</span>
        <div class="win-controls">
          <button class="win-btn minimize" title="Minimize">─</button>
          <button class="win-btn maximize" title="Maximize">□</button>
          <button class="win-btn close" title="Close">✕</button>
        </div>
      </div>
      <div class="win-content">${content}</div>
      ${resizable ? `
        <div class="win-resize n"></div>
        <div class="win-resize s"></div>
        <div class="win-resize e"></div>
        <div class="win-resize w"></div>
        <div class="win-resize ne"></div>
        <div class="win-resize nw"></div>
        <div class="win-resize se"></div>
        <div class="win-resize sw"></div>
      ` : ''}
    `;

    document.getElementById('windows-container').appendChild(win);

    this.windows[id] = {
      id, title, icon, appId,
      minimized: false,
      maximized: false,
      snapped: null,
      prevState: null,
    };

    this._bindEvents(win, id);
    this.focus(id);
    Taskbar.addApp(id, icon, title, appId);

    return id;
  },

  _bindEvents(win, id) {
    const titlebar = win.querySelector('.win-titlebar');
    const btnMin = win.querySelector('.win-btn.minimize');
    const btnMax = win.querySelector('.win-btn.maximize');
    const btnClose = win.querySelector('.win-btn.close');

    // Focus on click
    win.addEventListener('mousedown', (e) => {
      this.focus(id);
    });

    // Minimize
    btnMin.addEventListener('click', (e) => {
      e.stopPropagation();
      this.minimize(id);
    });

    // Maximize
    btnMax.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMaximize(id);
    });

    // Close
    btnClose.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close(id);
    });

    // Drag
    this._bindDrag(titlebar, win, id);

    // Resize
    win.querySelectorAll('.win-resize').forEach(handle => {
      this._bindResize(handle, win, id);
    });

    // Double-click titlebar to maximize
    titlebar.addEventListener('dblclick', () => {
      this.toggleMaximize(id);
    });
  },

  _bindDrag(handle, win, id) {
    let dragging = false;
    let startX, startY, startLeft, startTop;

    handle.addEventListener('mousedown', (e) => {
      if (e.target.closest('.win-controls')) return;
      if (this.windows[id].maximized || this.windows[id].snapped) return;

      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = win.offsetLeft;
      startTop = win.offsetTop;
      e.preventDefault();

      const onMove = (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const newLeft = Math.max(-win.offsetWidth + 100, startLeft + dx);
        const newTop = Math.max(0, Math.min(window.innerHeight - 48 - 36, startTop + dy));
        win.style.left = newLeft + 'px';
        win.style.top = newTop + 'px';

        // Snap preview
        this._updateSnapPreview(e.clientX, e.clientY);
      };

      const onUp = (e) => {
        if (!dragging) return;
        dragging = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        this._applySnap(id, win, e.clientX, e.clientY);
        this.snapPreview.style.display = 'none';
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  },

  _updateSnapPreview(x, y) {
    const sp = this.snapPreview;
    const tb = 48;
    if (x < 8) {
      // Left snap
      sp.style.cssText = `display:block;left:0;top:0;width:50%;height:calc(100vh - ${tb}px);`;
    } else if (x > window.innerWidth - 8) {
      // Right snap
      sp.style.cssText = `display:block;left:50%;top:0;width:50%;height:calc(100vh - ${tb}px);`;
    } else if (y < 4) {
      // Maximize
      sp.style.cssText = `display:block;left:0;top:0;width:100%;height:calc(100vh - ${tb}px);`;
    } else {
      sp.style.display = 'none';
    }
  },

  _applySnap(id, win, x, y) {
    const tb = 48;
    if (x < 8) {
      this.snap(id, 'left');
    } else if (x > window.innerWidth - 8) {
      this.snap(id, 'right');
    } else if (y < 4) {
      this.maximize(id);
    }
  },

  snap(id, side) {
    const win = document.getElementById(id);
    const state = this.windows[id];
    if (!state) return;
    state.prevState = { left: win.style.left, top: win.style.top, width: win.style.width, height: win.style.height };
    win.classList.remove('maximized', 'snapped-left', 'snapped-right');
    win.classList.add(side === 'left' ? 'snapped-left' : 'snapped-right');
    state.snapped = side;
    state.maximized = false;
  },

  _bindResize(handle, win, id) {
    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (this.windows[id].maximized || this.windows[id].snapped) return;

      const dir = handle.className.replace('win-resize ', '');
      const startX = e.clientX, startY = e.clientY;
      const startW = win.offsetWidth, startH = win.offsetHeight;
      const startL = win.offsetLeft, startT = win.offsetTop;
      const minW = parseInt(win.dataset.minWidth) || 300;
      const minH = parseInt(win.dataset.minHeight) || 200;

      const onMove = (e) => {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        let w = startW, h = startH, l = startL, t = startT;

        if (dir.includes('e')) w = Math.max(minW, startW + dx);
        if (dir.includes('s')) h = Math.max(minH, startH + dy);
        if (dir.includes('w')) { w = Math.max(minW, startW - dx); l = startL + startW - w; }
        if (dir.includes('n')) { h = Math.max(minH, startH - dy); t = startT + startH - h; }

        win.style.width = w + 'px';
        win.style.height = h + 'px';
        win.style.left = l + 'px';
        win.style.top = t + 'px';
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  },

  focus(id) {
    if (this.activeId === id) return;
    // Unfocus previous
    if (this.activeId) {
      const prev = document.getElementById(this.activeId);
      if (prev) prev.classList.remove('focused');
    }
    this.activeId = id;
    const win = document.getElementById(id);
    if (win) {
      win.classList.add('focused');
      win.style.zIndex = ++this.zCounter;
    }
    Taskbar.setActive(id);
  },

  minimize(id) {
    const win = document.getElementById(id);
    const state = this.windows[id];
    if (!win || !state) return;
    state.minimized = true;
    win.classList.add('minimized');
    if (this.activeId === id) {
      this.activeId = null;
      // Focus next visible window
      const ids = Object.keys(this.windows).filter(i => i !== id && !this.windows[i].minimized);
      if (ids.length) this.focus(ids[ids.length - 1]);
    }
    Taskbar.setRunning(id);
  },

  restore(id) {
    const win = document.getElementById(id);
    const state = this.windows[id];
    if (!win || !state) return;
    state.minimized = false;
    win.classList.remove('minimized');
    this.focus(id);
    Taskbar.setActive(id);
  },

  toggleMinimize(id) {
    const state = this.windows[id];
    if (!state) return;
    if (state.minimized) {
      this.restore(id);
    } else if (this.activeId === id) {
      this.minimize(id);
    } else {
      this.focus(id);
    }
  },

  maximize(id) {
    const win = document.getElementById(id);
    const state = this.windows[id];
    if (!win || !state) return;
    state.prevState = { left: win.style.left, top: win.style.top, width: win.style.width, height: win.style.height };
    win.classList.remove('snapped-left', 'snapped-right');
    win.classList.add('maximized');
    state.maximized = true;
    state.snapped = null;
  },

  unmaximize(id) {
    const win = document.getElementById(id);
    const state = this.windows[id];
    if (!win || !state) return;
    win.classList.remove('maximized', 'snapped-left', 'snapped-right');
    state.maximized = false;
    state.snapped = null;
    if (state.prevState) {
      win.style.left = state.prevState.left;
      win.style.top = state.prevState.top;
      win.style.width = state.prevState.width;
      win.style.height = state.prevState.height;
    }
  },

  toggleMaximize(id) {
    const state = this.windows[id];
    if (!state) return;
    if (state.maximized || state.snapped) {
      this.unmaximize(id);
    } else {
      this.maximize(id);
    }
  },

  close(id) {
    const win = document.getElementById(id);
    if (win) win.remove();
    Taskbar.removeApp(id);
    if (this.activeId === id) {
      this.activeId = null;
      const ids = Object.keys(this.windows).filter(i => i !== id && !this.windows[i].minimized);
      if (ids.length) this.focus(ids[ids.length - 1]);
    }
    delete this.windows[id];
  },

  closeAll() {
    Object.keys(this.windows).forEach(id => this.close(id));
  },

  minimizeAll() {
    Object.keys(this.windows).forEach(id => {
      if (!this.windows[id].minimized) this.minimize(id);
    });
  },

  restoreAll() {
    Object.keys(this.windows).forEach(id => {
      if (this.windows[id].minimized) this.restore(id);
    });
  },

  // Get window content element
  getContent(id) {
    const win = document.getElementById(id);
    return win ? win.querySelector('.win-content') : null;
  },

  // Update window title
  setTitle(id, title) {
    const win = document.getElementById(id);
    if (win) {
      win.querySelector('.win-title').textContent = title;
      if (this.windows[id]) this.windows[id].title = title;
      Taskbar.updateLabel(id, title);
    }
  }
};
