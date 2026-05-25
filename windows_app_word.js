// ===== MICROSOFT WORD =====
AppLauncher.register('word', {
  title: 'Microsoft Word', icon: '📘',
  launch() {
    if (typeof StoreManager !== 'undefined' && !StoreManager.isInstalled('word')) {
      _showInstallGate('Microsoft Word', '📘', 'word'); return;
    }
    const id = WM.create({ title:'Microsoft Word', icon:'📘', width:1200, height:800, appId:'word' });
    const content = WM.getContent(id);
    content.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;background:#fff;color:#000;font-family:"Segoe UI",sans-serif;';

    const saved = (typeof OS !== 'undefined' && OS.getAppData('word')) || {};
    const state = {
      doc: saved.doc || { title:'Document1', content:'' },
      zoom: 100,
      activeMenu: null,
      wordCount: 0,
    };
    const save = () => { if (typeof OS !== 'undefined') OS.setAppData('word', { doc: state.doc }); };

    const MENUS = {
      File: [
        { label:'New', action:'new' }, { label:'Open', action:'open' }, { sep:true },
        { label:'Save', action:'save' }, { label:'Save As...', action:'saveas' }, { sep:true },
        { label:'Print', action:'print' }, { sep:true }, { label:'Close', action:'close' }
      ],
      Home: [
        { label:'Bold', action:'bold', icon:'B', style:'font-weight:bold' },
        { label:'Italic', action:'italic', icon:'I', style:'font-style:italic' },
        { label:'Underline', action:'underline', icon:'U', style:'text-decoration:underline' },
        { sep:true },
        { label:'Align Left', action:'align-left', icon:'⬅' },
        { label:'Center', action:'align-center', icon:'⬌' },
        { label:'Align Right', action:'align-right', icon:'➡' },
        { label:'Justify', action:'align-justify', icon:'≡' },
        { sep:true },
        { label:'Bullet List', action:'insert-unordered-list', icon:'•' },
        { label:'Numbered List', action:'insert-ordered-list', icon:'1.' },
        { sep:true },
        { label:'Decrease Indent', action:'outdent', icon:'⬅' },
        { label:'Increase Indent', action:'indent', icon:'➡' },
        { sep:true },
        { label:'Text Color', action:'forecolor', icon:'A' },
        { label:'Highlight', action:'hilitecolor', icon:'🖍' },
        { sep:true },
        { label:'Clear Formatting', action:'removeformat', icon:'✕' },
      ],
      Insert: [
        { label:'Insert Table', action:'table' }, { label:'Insert Image', action:'image' }, { sep:true },
        { label:'Insert Link', action:'link' }, { label:'Insert Horizontal Rule', action:'hr' }, { sep:true },
        { label:'Page Break', action:'pagebreak' }
      ],
      Design: [
        { label:'Theme: Default', action:'theme-default' }, { label:'Theme: Dark', action:'theme-dark' },
        { label:'Theme: Sepia', action:'theme-sepia' }
      ],
      Layout: [
        { label:'Margins: Normal', action:'margin-normal' }, { label:'Margins: Narrow', action:'margin-narrow' },
        { label:'Margins: Wide', action:'margin-wide' }, { sep:true },
        { label:'Orientation: Portrait', action:'orient-portrait' }, { label:'Orientation: Landscape', action:'orient-landscape' }
      ],
      References: [
        { label:'Insert Footnote', action:'footnote' }, { label:'Insert Citation', action:'citation' },
        { label:'Table of Contents', action:'toc' }
      ],
      Review: [
        { label:'Spell Check', action:'spellcheck' }, { label:'Word Count', action:'wordcount' }, { sep:true },
        { label:'Track Changes', action:'trackchanges' }
      ],
      View: [
        { label:'Zoom In', action:'zoom-in' }, { label:'Zoom Out', action:'zoom-out' }, { sep:true },
        { label:'Print Layout', action:'view-print' }, { label:'Read Mode', action:'view-read' }, { label:'Web Layout', action:'view-web' }, { sep:true },
        { label:'Show Ruler', action:'ruler' }, { label:'Show Gridlines', action:'gridlines' }
      ],
    };

    const exec = (cmd, val) => {
      const editor = document.getElementById(`word-editor-${id}`);
      if (editor) editor.focus();
      document.execCommand(cmd, false, val || null);
    };

    const handleMenuAction = (action) => {
      state.activeMenu = null;
      renderMenuDropdowns();
      const editor = document.getElementById(`word-editor-${id}`);
      switch(action) {
        case 'new': if (confirm('Create new document? Unsaved changes will be lost.')) { state.doc.content = ''; if (editor) editor.innerHTML = ''; save(); } break;
        case 'save': state.doc.content = editor?.innerHTML || ''; save(); if (typeof Notifications !== 'undefined') Notifications.send('Word','Document saved','💾'); break;
        case 'saveas': {
          const name = prompt('Save as:', state.doc.title);
          if (name) { state.doc.title = name; state.doc.content = editor?.innerHTML || ''; save(); renderTitle(); }
          break;
        }
        case 'print': window.print(); break;
        case 'close': if (typeof WM !== 'undefined') WM.close(id); break;
        case 'table': {
          const rows = parseInt(prompt('Rows:', '3') || '3');
          const cols = parseInt(prompt('Columns:', '3') || '3');
          let html = '<table border="1" style="border-collapse:collapse;width:100%;margin:8px 0;">';
          for (let r = 0; r < rows; r++) { html += '<tr>'; for (let c = 0; c < cols; c++) html += '<td style="padding:6px;min-width:60px;">&nbsp;</td>'; html += '</tr>'; }
          html += '</table>';
          exec('insertHTML', html); break;
        }
        case 'image': {
          const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
          inp.onchange = e => {
            const f = e.target.files[0]; if (!f) return;
            const r = new FileReader();
            r.onload = ev => {
              // Insert image scaled to fit page width (max 600px)
              const img = new Image();
              img.onload = () => {
                const maxW = 600;
                const w = Math.min(img.naturalWidth, maxW);
                const h = Math.round(img.naturalHeight * (w / img.naturalWidth));
                exec('insertHTML', `<img src="${ev.target.result}" style="max-width:100%;width:${w}px;height:auto;display:block;margin:8px 0;" />`);
              };
              img.src = ev.target.result;
            };
            r.readAsDataURL(f);
          };
          inp.click(); break;
        }
        case 'link': { const url = prompt('URL:','https://'); if (url) exec('createLink', url); break; }
        case 'hr': exec('insertHorizontalRule'); break;
        case 'pagebreak': exec('insertHTML','<div style="page-break-after:always;border-top:2px dashed #ccc;margin:16px 0;"></div>'); break;
        case 'bold': exec('bold'); break;
        case 'italic': exec('italic'); break;
        case 'underline': exec('underline'); break;
        case 'align-left': exec('justifyLeft'); break;
        case 'align-center': exec('justifyCenter'); break;
        case 'align-right': exec('justifyRight'); break;
        case 'align-justify': exec('justifyFull'); break;
        case 'insert-unordered-list': exec('insertUnorderedList'); break;
        case 'insert-ordered-list': exec('insertOrderedList'); break;
        case 'outdent': exec('outdent'); break;
        case 'indent': exec('indent'); break;
        case 'forecolor': exec('foreColor', prompt('Color (hex or name):','#000000') || '#000000'); break;
        case 'hilitecolor': exec('hiliteColor', prompt('Highlight color (hex or name):','yellow') || 'yellow'); break;
        case 'removeformat': exec('removeFormat'); break;
        case 'theme-dark': if (editor) { editor.style.background='#1e1e1e'; editor.style.color='#d4d4d4'; } break;
        case 'theme-sepia': if (editor) { editor.style.background='#f4ecd8'; editor.style.color='#5c4a1e'; } break;
        case 'theme-default': if (editor) { editor.style.background='#fff'; editor.style.color='#000'; } break;
        case 'margin-normal': if (editor) editor.style.padding='96px'; break;
        case 'margin-narrow': if (editor) editor.style.padding='48px'; break;
        case 'margin-wide': if (editor) editor.style.padding='128px'; break;
        case 'wordcount': {
          const wc = (editor?.innerText || '').trim().split(/\s+/).filter(w=>w).length;
          alert(`Word count: ${wc}`); break;
        }
        case 'zoom-in': state.zoom = Math.min(200, state.zoom + 10); applyZoom(); break;
        case 'zoom-out': state.zoom = Math.max(50, state.zoom - 10); applyZoom(); break;
        case 'spellcheck': if (editor) editor.spellcheck = !editor.spellcheck; break;
      }
    };

    const applyZoom = () => {
      const wrap = document.getElementById(`word-page-wrap-${id}`);
      if (wrap) { wrap.style.transform = `scale(${state.zoom/100})`; wrap.style.transformOrigin = 'top center'; }
      const zoomLabel = document.getElementById(`word-zoom-label-${id}`);
      if (zoomLabel) zoomLabel.textContent = state.zoom + '%';
    };

    const renderTitle = () => {
      const t = document.getElementById(`word-title-${id}`);
      if (t) t.textContent = state.doc.title + ' - Microsoft Word';
    };

    const renderMenuDropdowns = () => {
      document.querySelectorAll('.word-menu-dropdown').forEach(d => d.remove());
      if (!state.activeMenu || !MENUS[state.activeMenu]) return;
      const btn = document.getElementById(`word-menu-${state.activeMenu}-${id}`);
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const drop = document.createElement('div');
      drop.className = 'word-menu-dropdown';
      drop.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.bottom}px;background:#fff;border:1px solid #d1d1d1;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:9999;min-width:180px;border-radius:2px;`;
      drop.innerHTML = MENUS[state.activeMenu].map(item =>
        item.sep ? '<div style="height:1px;background:#e1dfdd;margin:4px 0;"></div>'
        : `<div class="word-menu-item" data-action="${item.action}" style="padding:7px 16px;cursor:pointer;font-size:13px;color:#323130;" onmouseover="this.style.background='#f3f2f1'" onmouseout="this.style.background=''">${item.label}</div>`
      ).join('');
      document.body.appendChild(drop);
      drop.querySelectorAll('[data-action]').forEach(el => el.addEventListener('click', () => handleMenuAction(el.dataset.action)));
      setTimeout(() => {
        const dismiss = e => { if (!drop.contains(e.target) && !btn.contains(e.target)) { drop.remove(); state.activeMenu = null; document.removeEventListener('click', dismiss); } };
        document.addEventListener('click', dismiss);
      }, 10);
    };

    const render = () => {
      content.innerHTML = `
        <div style="display:flex;align-items:center;background:#f3f2f1;border-bottom:1px solid #d1d1d1;padding:0 8px;flex-shrink:0;">
          ${Object.keys(MENUS).map(m => `<button id="word-menu-${m}-${id}" style="padding:7px 12px;background:transparent;border:none;color:#323130;cursor:pointer;font-size:13px;" onmouseover="this.style.background='#e1dfdd'" onmouseout="this.style.background='transparent'">${m}</button>`).join('')}
        </div>
        <div style="background:#f3f2f1;border-bottom:2px solid #2b579a;padding:6px 12px;flex-shrink:0;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <div style="display:flex;gap:2px;padding-right:8px;border-right:1px solid #d1d1d1;">
              <button id="w-paste-${id}" title="Paste" style="padding:4px 8px;background:#fff;border:1px solid #8a8886;border-radius:2px;cursor:pointer;font-size:11px;">📋</button>
              <button id="w-cut-${id}" title="Cut" style="padding:4px 8px;background:#fff;border:1px solid #8a8886;border-radius:2px;cursor:pointer;font-size:11px;">✂️</button>
              <button id="w-copy-${id}" title="Copy" style="padding:4px 8px;background:#fff;border:1px solid #8a8886;border-radius:2px;cursor:pointer;font-size:11px;">📄</button>
            </div>
            <select id="w-font-${id}" title="Font" style="padding:3px 4px;border:1px solid #8a8886;font-size:12px;width:110px;">
              ${['Calibri','Arial','Times New Roman','Georgia','Verdana','Courier New','Comic Sans MS','Impact'].map(f=>`<option value="${f}">${f}</option>`).join('')}
            </select>
            <select id="w-size-${id}" title="Font Size" style="padding:3px 4px;border:1px solid #8a8886;font-size:12px;width:52px;">
              ${[8,9,10,11,12,14,16,18,20,24,28,32,36,48,72].map(s=>`<option value="${s}">${s}</option>`).join('')}
            </select>
            <div style="display:flex;gap:2px;padding:0 4px;border-left:1px solid #d1d1d1;border-right:1px solid #d1d1d1;">
              <button id="w-bold-${id}" title="Bold (Ctrl+B)" style="padding:4px 7px;background:#fff;border:1px solid #8a8886;border-radius:2px;cursor:pointer;font-weight:bold;font-size:13px;">B</button>
              <button id="w-italic-${id}" title="Italic (Ctrl+I)" style="padding:4px 7px;background:#fff;border:1px solid #8a8886;border-radius:2px;cursor:pointer;font-style:italic;font-size:13px;">I</button>
              <button id="w-underline-${id}" title="Underline (Ctrl+U)" style="padding:4px 7px;background:#fff;border:1px solid #8a8886;border-radius:2px;cursor:pointer;text-decoration:underline;font-size:13px;">U</button>
              <button id="w-strike-${id}" title="Strikethrough" style="padding:4px 7px;background:#fff;border:1px solid #8a8886;border-radius:2px;cursor:pointer;text-decoration:line-through;font-size:13px;">S</button>
            </div>
            <div style="display:flex;gap:2px;padding:0 4px;border-right:1px solid #d1d1d1;">
              <button id="w-al-${id}" title="Align Left" style="padding:4px 7px;background:#fff;border:1px solid #8a8886;border-radius:2px;cursor:pointer;font-size:12px;">⬅</button>
              <button id="w-ac-${id}" title="Center" style="padding:4px 7px;background:#fff;border:1px solid #8a8886;border-radius:2px;cursor:pointer;font-size:12px;">↔</button>
              <button id="w-ar-${id}" title="Align Right" style="padding:4px 7px;background:#fff;border:1px solid #8a8886;border-radius:2px;cursor:pointer;font-size:12px;">➡</button>
              <button id="w-aj-${id}" title="Justify" style="padding:4px 7px;background:#fff;border:1px solid #8a8886;border-radius:2px;cursor:pointer;font-size:12px;">≡</button>
            </div>
            <div style="display:flex;gap:2px;padding:0 4px;border-right:1px solid #d1d1d1;">
              <button id="w-ul-${id}" title="Bullet List" style="padding:4px 7px;background:#fff;border:1px solid #8a8886;border-radius:2px;cursor:pointer;font-size:12px;">• List</button>
              <button id="w-ol-${id}" title="Numbered List" style="padding:4px 7px;background:#fff;border:1px solid #8a8886;border-radius:2px;cursor:pointer;font-size:12px;">1. List</button>
            </div>
            <div style="display:flex;gap:2px;padding:0 4px;border-right:1px solid #d1d1d1;">
              <label style="font-size:11px;color:#605e5c;display:flex;align-items:center;gap:3px;" title="Text Color">A<input type="color" id="w-fgcolor-${id}" value="#000000" style="width:22px;height:22px;border:none;cursor:pointer;padding:0;" /></label>
              <button id="w-highlight-${id}" title="Highlight selected text yellow" style="padding:4px 7px;background:#fff;border:1px solid #8a8886;border-radius:2px;cursor:pointer;font-size:11px;">🖊 HL</button>
              <button id="w-unhighlight-${id}" title="Remove highlight" style="padding:4px 7px;background:#fff;border:1px solid #8a8886;border-radius:2px;cursor:pointer;font-size:11px;">✕ HL</button>
            </div>
            <div style="display:flex;gap:2px;padding:0 4px;">
              <button id="w-h1-${id}" style="padding:3px 7px;background:#fff;border:1px solid #8a8886;border-radius:2px;cursor:pointer;font-size:11px;font-weight:700;">H1</button>
              <button id="w-h2-${id}" style="padding:3px 7px;background:#fff;border:1px solid #8a8886;border-radius:2px;cursor:pointer;font-size:11px;font-weight:600;">H2</button>
              <button id="w-h3-${id}" style="padding:3px 7px;background:#fff;border:1px solid #8a8886;border-radius:2px;cursor:pointer;font-size:11px;">H3</button>
            </div>
          </div>
        </div>
        <div style="flex:1;overflow:auto;background:#f5f5f5;padding:24px;">
          <div id="word-page-wrap-${id}" style="max-width:816px;margin:0 auto;transform-origin:top center;">
            <div id="word-editor-${id}" contenteditable="true" spellcheck="true"
              style="background:#fff;box-shadow:0 0 10px rgba(0,0,0,0.12);min-height:1056px;padding:96px;font-family:Calibri,sans-serif;font-size:12pt;line-height:1.6;outline:none;color:#000;overflow:visible;"
            >${state.doc.content || ''}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:3px 12px;background:#f3f2f1;border-top:1px solid #d1d1d1;font-size:11px;color:#605e5c;flex-shrink:0;">
          <div style="display:flex;gap:16px;">
            <span>Page 1 of 1</span>
            <span id="word-wc-${id}">Words: 0</span>
            <span>English (US)</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <button id="word-zoom-out-${id}" style="background:transparent;border:none;cursor:pointer;font-size:14px;color:#605e5c;">−</button>
            <span id="word-zoom-label-${id}">${state.zoom}%</span>
            <button id="word-zoom-in-${id}" style="background:transparent;border:none;cursor:pointer;font-size:14px;color:#605e5c;">+</button>
            <input type="range" id="word-zoom-slider-${id}" min="50" max="200" value="${state.zoom}" style="width:80px;accent-color:#2b579a;">
          </div>
        </div>
      `;
      bindEvents();
      applyZoom();
    };

    const bindEvents = () => {
      const editor = document.getElementById(`word-editor-${id}`);
      const wc = document.getElementById(`word-wc-${id}`);

      // Menu bar
      Object.keys(MENUS).forEach(m => {
        const btn = document.getElementById(`word-menu-${m}-${id}`);
        if (btn) btn.addEventListener('click', e => {
          e.stopPropagation();
          state.activeMenu = state.activeMenu === m ? null : m;
          renderMenuDropdowns();
        });
      });

      // Editor events
      if (editor) {
        editor.addEventListener('input', () => {
          state.doc.content = editor.innerHTML;
          if (wc) wc.textContent = 'Words: ' + (editor.innerText.trim().split(/\s+/).filter(w=>w).length);
          save();
          // Auto new page: if content height exceeds page height, add a new page separator
          checkPageOverflow(editor);
        });
        // Restore content
        if (!editor.innerHTML && state.doc.content) editor.innerHTML = state.doc.content;

        // Update toolbar active states on cursor move / selection change
        editor.addEventListener('keyup', updateToolbarState);
        editor.addEventListener('mouseup', updateToolbarState);
        editor.addEventListener('selectionchange', updateToolbarState);

        // Make links open in new tab
        editor.addEventListener('click', e => {
          const a = e.target.closest('a');
          if (a && a.href) { e.preventDefault(); window.open(a.href, '_blank'); }
        });
      }

      // Helper: update toolbar button active states based on current selection
      const updateToolbarState = () => {
        const cmds = [
          ['w-bold-'+id, 'bold'],
          ['w-italic-'+id, 'italic'],
          ['w-underline-'+id, 'underline'],
          ['w-strike-'+id, 'strikeThrough'],
        ];
        cmds.forEach(([btnId, cmd]) => {
          const btn = document.getElementById(btnId);
          if (btn) btn.style.background = document.queryCommandState(cmd) ? '#deecf9' : '#fff';
        });
      };

      // Helper: auto-add new page when content overflows
      const checkPageOverflow = (editor) => {
        // Page height in px at 96dpi: A4 = 1056px content area (1122px - 2*33px margin)
        const PAGE_H = 1056;
        const PADDING = 96;
        // Check if last child is already a page break marker
        const lastChild = editor.lastElementChild;
        if (lastChild && lastChild.dataset && lastChild.dataset.page) return;
        if (editor.scrollHeight > editor.offsetHeight + 20) {
          // Content overflowed — insert a page break + new page div
          const pageBreak = document.createElement('div');
          pageBreak.dataset.page = 'break';
          pageBreak.style.cssText = `
            height:${PADDING * 2}px;
            background:#f5f5f5;
            border-top:1px solid #ccc;
            border-bottom:1px solid #ccc;
            margin:0 -${PADDING}px;
            display:flex;
            align-items:center;
            justify-content:center;
            color:#aaa;
            font-size:11px;
            pointer-events:none;
            user-select:none;
          `;
          pageBreak.textContent = '— Page Break —';
          pageBreak.contentEditable = 'false';
          editor.appendChild(pageBreak);
          // Add a new paragraph after the break for continued typing
          const cont = document.createElement('p');
          cont.innerHTML = '<br>';
          editor.appendChild(cont);
          // Move cursor to new paragraph
          const range = document.createRange();
          range.setStart(cont, 0);
          range.collapse(true);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      };

      // Toolbar buttons — all use execCommand on selection
      const btn = (elId, cmd, val) => {
        const el = document.getElementById(elId);
        if (el) el.addEventListener('click', () => {
          if (editor) editor.focus();
          document.execCommand(cmd, false, val || null);
          updateToolbarState();
        });
      };
      btn(`w-bold-${id}`, 'bold');
      btn(`w-italic-${id}`, 'italic');
      btn(`w-underline-${id}`, 'underline');
      btn(`w-strike-${id}`, 'strikeThrough');
      btn(`w-al-${id}`, 'justifyLeft');
      btn(`w-ac-${id}`, 'justifyCenter');
      btn(`w-ar-${id}`, 'justifyRight');
      btn(`w-aj-${id}`, 'justifyFull');
      btn(`w-ul-${id}`, 'insertUnorderedList');
      btn(`w-ol-${id}`, 'insertOrderedList');
      btn(`w-copy-${id}`, 'copy');
      btn(`w-cut-${id}`, 'cut');
      btn(`w-paste-${id}`, 'paste');

      // Highlight / unhighlight buttons
      const hlBtn = document.getElementById(`w-highlight-${id}`);
      if (hlBtn) hlBtn.addEventListener('click', () => {
        if (editor) editor.focus();
        document.execCommand('hiliteColor', false, '#ffff00');
      });
      const unhlBtn = document.getElementById(`w-unhighlight-${id}`);
      if (unhlBtn) unhlBtn.addEventListener('click', () => {
        if (editor) editor.focus();
        document.execCommand('hiliteColor', false, 'transparent');
      });

      // Heading buttons
      const h1 = document.getElementById(`w-h1-${id}`);
      const h2 = document.getElementById(`w-h2-${id}`);
      const h3 = document.getElementById(`w-h3-${id}`);
      if (h1) h1.addEventListener('click', () => { if (editor) editor.focus(); document.execCommand('formatBlock', false, 'h1'); });
      if (h2) h2.addEventListener('click', () => { if (editor) editor.focus(); document.execCommand('formatBlock', false, 'h2'); });
      if (h3) h3.addEventListener('click', () => { if (editor) editor.focus(); document.execCommand('formatBlock', false, 'h3'); });

      // Font family
      const fontSel = document.getElementById(`w-font-${id}`);
      if (fontSel) fontSel.addEventListener('change', () => { if (editor) editor.focus(); document.execCommand('fontName', false, fontSel.value); });

      // Font size (execCommand uses 1-7 scale, so we use inline style instead)
      const sizeSel = document.getElementById(`w-size-${id}`);
      if (sizeSel) sizeSel.addEventListener('change', () => {
        if (editor) editor.focus();
        document.execCommand('fontSize', false, '7');
        // Replace the font size 7 with actual px value
        editor.querySelectorAll('font[size="7"]').forEach(el => {
          el.removeAttribute('size');
          el.style.fontSize = sizeSel.value + 'pt';
        });
      });

      // Text color
      const fgColor = document.getElementById(`w-fgcolor-${id}`);
      if (fgColor) fgColor.addEventListener('input', () => { if (editor) editor.focus(); document.execCommand('foreColor', false, fgColor.value); });

      // Highlight color
      const bgColor = document.getElementById(`w-bgcolor-${id}`);
      if (bgColor) bgColor.addEventListener('input', () => { if (editor) editor.focus(); document.execCommand('hiliteColor', false, bgColor.value); });

      // Zoom
      const zoomIn = document.getElementById(`word-zoom-in-${id}`);
      const zoomOut = document.getElementById(`word-zoom-out-${id}`);
      const zoomSlider = document.getElementById(`word-zoom-slider-${id}`);
      if (zoomIn) zoomIn.addEventListener('click', () => { state.zoom = Math.min(200, state.zoom + 10); applyZoom(); });
      if (zoomOut) zoomOut.addEventListener('click', () => { state.zoom = Math.max(50, state.zoom - 10); applyZoom(); });
      if (zoomSlider) zoomSlider.addEventListener('input', () => { state.zoom = parseInt(zoomSlider.value); applyZoom(); });
    };

    render();
  }
});
