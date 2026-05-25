// ===== NOTEPAD APP =====
AppLauncher.register('notepad', {
  title: 'Notepad',
  icon: '📝',

  launch(opts) {
    const id = WM.create({
      title: 'Notepad — Untitled',
      icon: '📝',
      width: 700,
      height: 500,
      appId: 'notepad',
    });

    const content = WM.getContent(id);
    content.style.display = 'flex';
    content.style.flexDirection = 'column';

    content.innerHTML = `
      <div class="win-toolbar notepad-toolbar">
        <select id="np-font-${id}" title="Font">
          <option>Segoe UI</option>
          <option>Consolas</option>
          <option>Arial</option>
          <option>Times New Roman</option>
          <option>Courier New</option>
        </select>
        <input type="number" id="np-size-${id}" value="14" min="8" max="72" style="width:50px" title="Font Size" />
        <button id="np-bold-${id}" title="Bold"><b>B</b></button>
        <button id="np-italic-${id}" title="Italic"><i>I</i></button>
        <button id="np-underline-${id}" title="Underline"><u>U</u></button>
        <div style="width:1px;background:var(--border);margin:0 4px;height:20px"></div>
        <button id="np-new-${id}" title="New">📄 New</button>
        <button id="np-open-${id}" title="Open">📂 Open</button>
        <button id="np-save-${id}" title="Save">💾 Save</button>
        <div style="flex:1"></div>
        <button id="np-find-${id}" title="Find">🔍 Find</button>
        <button id="np-wrap-${id}" title="Word Wrap">↵ Wrap</button>
      </div>
      <textarea class="notepad-area" id="np-area-${id}" spellcheck="false" placeholder="Start typing..."></textarea>
      <div class="notepad-statusbar">
        <span id="np-chars-${id}">0 chars</span>
        <span id="np-words-${id}">0 words</span>
        <span id="np-lines-${id}">Ln 1, Col 1</span>
      </div>
    `;

    const area = document.getElementById(`np-area-${id}`);
    const state = { path: null, modified: false, wrap: true };

    // Load file if provided
    if (opts && opts.path) {
      const content_text = FS.readFile(opts.path);
      if (content_text !== null) {
        area.value = content_text;
        state.path = opts.path;
        WM.setTitle(id, 'Notepad — ' + opts.path.split('/').pop());
      }
    }

    const updateStatus = () => {
      const text = area.value;
      document.getElementById(`np-chars-${id}`).textContent = text.length + ' chars';
      document.getElementById(`np-words-${id}`).textContent = (text.trim() ? text.trim().split(/\s+/).length : 0) + ' words';
      const pos = area.selectionStart;
      const lines = text.substring(0, pos).split('\n');
      document.getElementById(`np-lines-${id}`).textContent = `Ln ${lines.length}, Col ${lines[lines.length - 1].length + 1}`;
    };

    area.addEventListener('input', () => {
      state.modified = true;
      WM.setTitle(id, 'Notepad — ' + (state.path ? state.path.split('/').pop() : 'Untitled') + ' *');
      updateStatus();
    });

    area.addEventListener('keyup', updateStatus);
    area.addEventListener('click', updateStatus);

    // Font controls
    document.getElementById(`np-font-${id}`).addEventListener('change', (e) => {
      area.style.fontFamily = e.target.value;
    });

    document.getElementById(`np-size-${id}`).addEventListener('change', (e) => {
      area.style.fontSize = e.target.value + 'px';
    });

    const toggleFormat = (btn, style) => {
      btn.classList.toggle('active');
      area.style[style] = btn.classList.contains('active') ?
        (style === 'fontWeight' ? 'bold' : style === 'fontStyle' ? 'italic' : 'underline') :
        (style === 'fontWeight' ? 'normal' : style === 'fontStyle' ? 'normal' : 'none');
    };

    document.getElementById(`np-bold-${id}`).addEventListener('click', (e) => toggleFormat(e.currentTarget, 'fontWeight'));
    document.getElementById(`np-italic-${id}`).addEventListener('click', (e) => toggleFormat(e.currentTarget, 'fontStyle'));
    document.getElementById(`np-underline-${id}`).addEventListener('click', (e) => toggleFormat(e.currentTarget, 'textDecoration'));

    // New
    document.getElementById(`np-new-${id}`).addEventListener('click', () => {
      if (state.modified && !confirm('Discard changes?')) return;
      area.value = '';
      state.path = null;
      state.modified = false;
      WM.setTitle(id, 'Notepad — Untitled');
      updateStatus();
    });

    // Open
    document.getElementById(`np-open-${id}`).addEventListener('click', () => {
      const path = prompt('Enter file path:', 'C:/Users/User/Documents/');
      if (path) {
        const text = FS.readFile(path);
        if (text !== null) {
          area.value = text;
          state.path = path;
          state.modified = false;
          WM.setTitle(id, 'Notepad — ' + path.split('/').pop());
          updateStatus();
        } else {
          Notifications.send('Notepad', 'File not found: ' + path, '❌');
        }
      }
    });

    // Save
    const save = () => {
      if (!state.path) {
        const path = prompt('Save as:', 'C:/Users/User/Documents/untitled.txt');
        if (!path) return;
        state.path = path;
      }
      FS.writeFile(state.path, area.value);
      state.modified = false;
      WM.setTitle(id, 'Notepad — ' + state.path.split('/').pop());
      Notifications.send('Notepad', 'Saved: ' + state.path.split('/').pop(), '💾');
    };

    document.getElementById(`np-save-${id}`).addEventListener('click', save);

    // Keyboard shortcuts
    area.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); save(); }
      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); document.getElementById(`np-new-${id}`).click(); }
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = area.selectionStart;
        const end = area.selectionEnd;
        area.value = area.value.substring(0, start) + '    ' + area.value.substring(end);
        area.selectionStart = area.selectionEnd = start + 4;
      }
    });

    // Find
    document.getElementById(`np-find-${id}`).addEventListener('click', () => {
      const query = prompt('Find:');
      if (!query) return;
      const idx = area.value.indexOf(query);
      if (idx >= 0) {
        area.focus();
        area.setSelectionRange(idx, idx + query.length);
        Notifications.send('Notepad', `Found "${query}" at position ${idx}`, '🔍');
      } else {
        Notifications.send('Notepad', `"${query}" not found`, '🔍');
      }
    });

    // Word wrap
    document.getElementById(`np-wrap-${id}`).addEventListener('click', (e) => {
      state.wrap = !state.wrap;
      area.style.whiteSpace = state.wrap ? 'pre-wrap' : 'pre';
      area.style.overflowX = state.wrap ? 'hidden' : 'auto';
      e.currentTarget.classList.toggle('active', state.wrap);
    });

    updateStatus();
    area.focus();
  }
});
