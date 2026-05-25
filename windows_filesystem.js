// ===== VIRTUAL FILE SYSTEM =====
const FS = {
  // JS files that live in System32 — deleting them disables the app
  _system32Files: {
    'os.js':            { appId: null,          desc: 'Windows 12 OS Core' },
    'filesystem.js':    { appId: null,          desc: 'Virtual File System' },
    'windowmanager.js': { appId: null,          desc: 'Window Manager' },
    'taskbar.js':       { appId: null,          desc: 'Taskbar' },
    'notifications.js': { appId: null,          desc: 'Notifications' },
    'lockscreen.js':    { appId: null,          desc: 'Lock Screen' },
    'contextmenu.js':   { appId: null,          desc: 'Context Menu' },
    'startmenu.js':     { appId: null,          desc: 'Start Menu' },
    'widgets.js':       { appId: null,          desc: 'Widgets Panel' },
    'weather.js':       { appId: null,          desc: 'Weather Service' },
    'main.js':          { appId: null,          desc: 'Main Init' },
    'app_fileexplorer.js': { appId: 'fileexplorer', desc: 'File Explorer App' },
    'app_terminal.js':     { appId: 'terminal',     desc: 'Terminal App' },
    'app_settings.js':     { appId: 'settings',     desc: 'Settings App' },
    'app_notepad.js':      { appId: 'notepad',      desc: 'Notepad App' },
    'app_browser.js':      { appId: 'browser',      desc: 'Browser App' },
    'app_calculator.js':   { appId: 'calculator',   desc: 'Calculator App' },
    'app_taskmanager.js':  { appId: 'taskmanager',  desc: 'Task Manager App' },
    'app_paint.js':        { appId: 'paint',        desc: 'Paint App' },
    'app_calendar.js':     { appId: 'calendar',     desc: 'Calendar App' },
    'app_music.js':        { appId: 'music',        desc: 'Music App' },
    'app_photos.js':       { appId: 'photos',       desc: 'Photos App' },
    'app_store.js':        { appId: 'store',        desc: 'Microsoft Store' },
    'app_spotify.js':      { appId: 'spotify',      desc: 'Spotify App' },
    'app_vscode.js':       { appId: 'vscode',       desc: 'VS Code App' },
    'app_geodash.js':      { appId: 'geodash',      desc: 'Geometry Dash' },
    'app_games.js':        { appId: 'games',        desc: 'Games Hub' },
    'app_myphotos.js':     { appId: 'myphotos',     desc: 'My Photos App' },
    'app_viruslab.js':     { appId: 'viruslab',     desc: 'Virus Lab' },
    'app_discord.js':      { appId: 'discord',      desc: 'Discord App' },
    'app_zoom.js':         { appId: 'zoom',         desc: 'Zoom App' },
    'app_photoshop.js':    { appId: 'photoshop',    desc: 'Photoshop App' },
    'app_clipchamp.js':    { appId: 'clipchamp',    desc: 'Clipchamp App' },
    'app_notion.js':       { appId: 'notion',       desc: 'Notion App' },
    'app_office.js':       { appId: 'office',       desc: 'Office 365 App' },
    'app_youtube.js':      { appId: 'youtube',      desc: 'YouTube App' },
    'app_tiktok.js':       { appId: 'tiktok',       desc: 'TikTok App' },
    'app_weatherapp.js':   { appId: 'weatherapp',   desc: 'Weather App' },
    'style.css':           { appId: null,           desc: 'System Stylesheet' },
    'index.html':          { appId: null,           desc: 'System Entry Point' },
    'wallpaper.jpg':       { appId: null,           desc: 'Default Wallpaper' },
    'home.jpg':            { appId: null,           desc: 'Lock Screen Background' },
  },

  // Track which app JS files have been "deleted"
  _deletedApps: new Set(),

  _buildSystem32() {
    const sys32 = {};
    for (const [fname, meta] of Object.entries(this._system32Files)) {
      sys32[fname] = {
        type: 'file',
        content: `[SYSTEM FILE]\n${meta.desc}\nPath: C:/Windows/System32/${fname}\nDo not delete unless you know what you are doing.`,
        size: 512,
        modified: new Date().toISOString(),
        isSystemFile: true,
        appId: meta.appId,
      };
    }
    return sys32;
  },

  tree: {
    'C:': {
      type: 'drive',
      children: {
        'Users': { type: 'folder', children: {
          'User': { type: 'folder', children: {
            'Desktop': { type: 'folder', children: {} },
            'Documents': { type: 'folder', children: {
              'readme.txt': { type: 'file', content: 'Welcome to Windows 12!\n\nThis is a simulated OS environment.\nYou can create, edit, and delete files.\n\nEnjoy!', size: 120, modified: new Date().toISOString() },
              'notes.txt': { type: 'file', content: 'My Notes\n--------\n- Buy groceries\n- Finish project\n- Call dentist', size: 80, modified: new Date().toISOString() },
            }},
            'Downloads': { type: 'folder', children: {} },
            'Pictures': { type: 'folder', children: {} },
            'Music': { type: 'folder', children: {} },
            'Videos': { type: 'folder', children: {} },
          }}
        }},
        'Windows': { type: 'folder', children: {
          'System32': { type: 'folder', children: {} }, // populated after init
        }},
        'Program Files': { type: 'folder', children: {
          'Windows 12': { type: 'folder', children: {
            'Assets': { type: 'folder', children: {
              'wallpaper.jpg': { type: 'file', content: '[IMAGE FILE]\nDefault desktop wallpaper', size: 204800, modified: new Date().toISOString() },
              'home.jpg': { type: 'file', content: '[IMAGE FILE]\nLock screen background', size: 153600, modified: new Date().toISOString() },
            }},
            'Themes': { type: 'folder', children: {
              'default.theme': { type: 'file', content: '[THEME]\nName=Windows 12 Default\nAccent=#0078d4', size: 256, modified: new Date().toISOString() },
            }},
          }},
        }},
        'Temp': { type: 'folder', children: {} },
      }
    }
  },

  cwd: 'C:/Users/User',

  init() {
    // Populate System32 with JS file entries
    const sys32 = this._buildSystem32();
    if (this.tree['C:'].children['Windows'].children['System32']) {
      // Merge — don't overwrite user-deleted entries
      const existing = this.tree['C:'].children['Windows'].children['System32'].children || {};
      for (const [fname, node] of Object.entries(sys32)) {
        if (!existing[fname]) existing[fname] = node;
      }
      this.tree['C:'].children['Windows'].children['System32'].children = existing;
    }
  },

  // Load saved VFS from OS (called after OS.init)
  loadFromSaved(saved) {
    if (saved) {
      try {
        this.tree = JSON.parse(JSON.stringify(saved));
        // Re-check which system32 files are missing (deleted by user)
        const sys32 = this.tree['C:']?.children?.['Windows']?.children?.['System32']?.children || {};
        for (const [fname, meta] of Object.entries(this._system32Files)) {
          if (!sys32[fname] && meta.appId) {
            this._deletedApps.add(meta.appId);
          }
        }
      } catch (e) {}
    }
    this.init();
  },

  isAppDeleted(appId) {
    return this._deletedApps.has(appId);
  },

  parsePath(path) {
    return path.replace(/\\/g, '/').split('/').filter(Boolean);
  },

  resolvePath(path, base) {
    if (!base) base = this.cwd;
    if (!path.includes(':')) path = base + '/' + path;
    const parts = this.parsePath(path);
    const resolved = [];
    for (const p of parts) {
      if (p === '.') continue;
      if (p === '..') { resolved.pop(); continue; }
      resolved.push(p);
    }
    return resolved.join('/');
  },

  getNodeObj(path) {
    const parts = this.parsePath(path);
    let node = this.tree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (node[part] === undefined) return null;
      if (i === parts.length - 1) return node[part];
      if (node[part].children !== undefined) node = node[part].children;
      else return null;
    }
    return null;
  },

  ls(path) {
    const node = this.getNodeObj(path);
    if (!node) return null;
    if (node.type !== 'folder' && node.type !== 'drive') return null;
    return node.children || {};
  },

  readFile(path) {
    const node = this.getNodeObj(path);
    if (!node || node.type !== 'file') return null;
    return node.content;
  },

  writeFile(path, content) {
    const parts = this.parsePath(path);
    const name = parts.pop();
    const parentPath = parts.join('/');
    const parent = this.getNodeObj(parentPath);
    if (!parent || (parent.type !== 'folder' && parent.type !== 'drive')) return false;
    parent.children[name] = { type: 'file', content, size: content.length, modified: new Date().toISOString() };
    OS.saveVFS();
    return true;
  },

  mkdir(path) {
    const parts = this.parsePath(path);
    const name = parts.pop();
    const parentPath = parts.join('/');
    const parent = this.getNodeObj(parentPath);
    if (!parent || (parent.type !== 'folder' && parent.type !== 'drive')) return false;
    if (parent.children[name]) return false;
    parent.children[name] = { type: 'folder', children: {} };
    OS.saveVFS();
    return true;
  },

  rm(path) {
    const parts = this.parsePath(path);
    const name = parts.pop();
    const parentPath = parts.join('/');
    const parent = this.getNodeObj(parentPath);
    if (!parent || !parent.children || !parent.children[name]) return false;

    const node = parent.children[name];

    // Check if this is a System32 JS file — if so, disable the app
    if (parentPath.includes('System32') && node.isSystemFile && node.appId) {
      this._deletedApps.add(node.appId);
      // Unregister from AppLauncher
      if (typeof AppLauncher !== 'undefined' && AppLauncher.apps[node.appId]) {
        delete AppLauncher.apps[node.appId];
        Notifications.send('System', `${name} deleted — ${node.appId} is now unavailable`, '⚠️');
      }
    }

    delete parent.children[name];
    OS.saveVFS();
    return true;
  },

  exists(path) { return this.getNodeObj(path) !== null; },

  // Save a "downloaded" file to Downloads folder
  saveDownload(name, content) {
    const path = 'C:/Users/User/Downloads/' + name;
    this.writeFile(path, content);
    Notifications.send('Downloads', `Saved: ${name}`, '⬇️');
  },

  getIcon(name, type) {
    if (type === 'folder' || type === 'drive') return '📁';
    const ext = name.split('.').pop().toLowerCase();
    const icons = {
      txt:'📄',md:'📄',log:'📄',js:'📜',ts:'📜',py:'📜',html:'🌐',css:'🎨',json:'📋',
      jpg:'🖼️',jpeg:'🖼️',png:'🖼️',gif:'🖼️',bmp:'🖼️',svg:'🖼️',webp:'🖼️',
      mp3:'🎵',wav:'🎵',flac:'🎵',mp4:'🎬',avi:'🎬',mkv:'🎬',
      pdf:'📕',doc:'📘',docx:'📘',xls:'📗',xlsx:'📗',ppt:'📙',pptx:'📙',
      zip:'📦',rar:'📦',exe:'⚙️',dll:'🔧',theme:'🎨',
    };
    return icons[ext] || '📄';
  },

  // File type associations - maps file extensions to app IDs
  _fileAssociations: {
    txt: 'notepad',
    md: 'notepad',
    log: 'notepad',
    js: 'vscode',
    ts: 'vscode',
    html: 'vscode',
    css: 'vscode',
    json: 'vscode',
    py: 'vscode',
    doc: 'word',
    docx: 'word',
    xls: 'excel',
    xlsx: 'excel',
    ppt: 'powerpoint',
    pptx: 'powerpoint',
    pdf: 'browser',
    jpg: 'photos',
    jpeg: 'photos',
    png: 'photos',
    gif: 'photos',
    bmp: 'photos',
    svg: 'photos',
    webp: 'photos',
    mp3: 'music',
    wav: 'music',
    flac: 'music',
    mp4: 'myphotos',
    avi: 'myphotos',
    mkv: 'myphotos',
    zip: 'fileexplorer',
    rar: 'fileexplorer',
  },

  // Get the app ID associated with a file extension
  getAppForFile(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return this._fileAssociations[ext] || null;
  },

  // Set a custom file association
  setFileAssociation(ext, appId) {
    this._fileAssociations[ext.toLowerCase()] = appId;
  },

  // Get all file associations
  getFileAssociations() {
    return { ...this._fileAssociations };
  },

  formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(1) + ' GB';
  }
};
