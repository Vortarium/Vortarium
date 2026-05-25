// ===== MICROSOFT POWERPOINT =====
AppLauncher.register('powerpoint', {
  title: 'PowerPoint', icon: '📙',
  launch() {
    if (typeof StoreManager !== 'undefined' && !StoreManager.isInstalled('powerpoint')) {
      _showInstallGate('PowerPoint', '📙', 'powerpoint'); return;
    }
    const id = WM.create({ title: 'Microsoft PowerPoint', icon: '📙', width: 1200, height: 760, appId: 'powerpoint' });
    const content = WM.getContent(id);
    content.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;background:#1e1e1e;color:#fff;font-family:"Segoe UI",sans-serif;';

    const saved = (typeof OS !== 'undefined' && OS.getAppData('powerpoint')) || {};
    const SHAPES = ['rectangle','circle','triangle','star','arrow','line'];
    const THEMES = [
      { name:'Dark Blue', bg:'#1a1a2e', accent:'#e94560', title:'#fff', body:'rgba(255,255,255,0.85)' },
      { name:'Midnight', bg:'#0d1117', accent:'#58a6ff', title:'#f0f6fc', body:'rgba(240,246,252,0.8)' },
      { name:'Corporate', bg:'#ffffff', accent:'#0078d4', title:'#1a1a1a', body:'#444' },
      { name:'Forest', bg:'#1b4332', accent:'#52b788', title:'#fff', body:'rgba(255,255,255,0.85)' },
      { name:'Sunset', bg:'#2d1b69', accent:'#f72585', title:'#fff', body:'rgba(255,255,255,0.85)' },
      { name:'Ocean', bg:'#03045e', accent:'#00b4d8', title:'#caf0f8', body:'rgba(202,240,248,0.8)' },
      { name:'Warm', bg:'#fff8f0', accent:'#e76f51', title:'#264653', body:'#457b9d' },
      { name:'Slate', bg:'#2c3e50', accent:'#3498db', title:'#ecf0f1', body:'rgba(236,240,241,0.8)' },
    ];
    const mkSlide = (n) => {
      const t = THEMES[0];
      return { id:'sl_'+Date.now()+'_'+n, title:'Slide '+n, body:'Click to add content', bg:t.bg, accent:t.accent, titleColor:t.title, bodyColor:t.body, elements:[] };
    };
    const state = {
      slides: saved.slides || [mkSlide(1), mkSlide(2)],
      active: saved.active || null,
      activeMenu: null,
      tool: 'select', // select | text | shape | image
      selectedEl: null,
      presentIdx: 0,
    };
    if (!state.active) state.active = state.slides[0].id;
    const save = () => { if (typeof OS !== 'undefined') OS.setAppData('powerpoint', { slides: state.slides, active: state.active }); };
    const getSlide = () => state.slides.find(s => s.id === state.active);

    const MENUS = {
      File: [{ label:'New Presentation', action:'new' },{ sep:true },{ label:'Save', action:'save' },{ label:'Save As...', action:'saveas' },{ sep:true },{ label:'Export as PDF', action:'export-pdf' },{ sep:true },{ label:'Close', action:'close' }],
      Home: [
        { label:'New Slide', action:'add-slide', icon:'➕' },
        { label:'Layout', action:'layout', icon:'▦' },
        { sep:true },
        { label:'Reset', action:'reset', icon:'↺' },
        { label:'Delete', action:'delete-slide', icon:'🗑' },
        { sep:true },
        { label:'Text Box', action:'insert-text', icon:'T' },
        { label:'Picture', action:'insert-image', icon:'🖼' },
        { sep:true },
        { label:'Rectangle', action:'insert-rect', icon:'▢' },
        { label:'Circle', action:'insert-circle', icon:'○' },
        { label:'Triangle', action:'insert-triangle', icon:'△' },
        { label:'Star', action:'insert-star', icon:'★' },
      ],
      Insert: [{ label:'Text Box', action:'insert-text' },{ label:'Image from file', action:'insert-image' },{ sep:true },{ label:'Rectangle', action:'insert-rect' },{ label:'Circle', action:'insert-circle' },{ label:'Triangle', action:'insert-triangle' },{ label:'Star', action:'insert-star' },{ sep:true },{ label:'New Slide', action:'add-slide' }],
      Design: THEMES.map(t => ({ label:t.name, action:'theme-'+t.name })),
      Transitions: [{ label:'None', action:'trans-none' },{ label:'Fade', action:'trans-fade' },{ label:'Slide', action:'trans-slide' },{ label:'Zoom', action:'trans-zoom' }],
      Animations: [{ label:'Appear', action:'anim-appear' },{ label:'Fly In', action:'anim-fly' },{ label:'Fade In', action:'anim-fade' }],
      'Slide Show': [{ label:'From Beginning', action:'present-start' },{ label:'From Current Slide', action:'present-current' },{ sep:true },{ label:'Set Up Show', action:'setup-show' }],
      Review: [{ label:'Spell Check', action:'spellcheck' },{ label:'Word Count', action:'wordcount' }],
    };

    const handleMenuAction = (action) => {
      state.activeMenu = null;
      document.querySelectorAll('.ppt-menu-drop').forEach(d => d.remove());
      const sl = getSlide();
      if (action === 'new') { if (confirm('New presentation? Unsaved changes lost.')) { state.slides = [mkSlide(1)]; state.active = state.slides[0].id; save(); render(); } }
      else if (action === 'save') { save(); if (typeof Notifications !== 'undefined') Notifications.send('PowerPoint','Saved!','💾'); }
      else if (action === 'saveas') { const n = prompt('Name:','Presentation'); if (n) { save(); if (typeof Notifications !== 'undefined') Notifications.send('PowerPoint','Saved as '+n,'💾'); } }
      else if (action === 'close') { if (typeof WM !== 'undefined') WM.close(id); }
      else if (action === 'add-slide') { const ns = mkSlide(state.slides.length+1); state.slides.push(ns); state.active = ns.id; save(); render(); }
      else if (action === 'insert-text') { if (sl) { sl.elements.push({ id:'el_'+Date.now(), type:'text', x:100, y:100, w:300, h:60, text:'Text Box', fontSize:18, color:'#fff', bold:false, italic:false, align:'left' }); save(); render(); } }
      else if (action === 'insert-rect') { if (sl) { sl.elements.push({ id:'el_'+Date.now(), type:'shape', shape:'rect', x:150, y:120, w:200, h:120, fill:'#0078d4', stroke:'#fff', strokeW:2 }); save(); render(); } }
      else if (action === 'insert-circle') { if (sl) { sl.elements.push({ id:'el_'+Date.now(), type:'shape', shape:'circle', x:200, y:120, w:120, h:120, fill:'#e74c3c', stroke:'#fff', strokeW:2 }); save(); render(); } }
      else if (action === 'insert-triangle') { if (sl) { sl.elements.push({ id:'el_'+Date.now(), type:'shape', shape:'triangle', x:200, y:100, w:150, h:130, fill:'#27ae60', stroke:'#fff', strokeW:2 }); save(); render(); } }
      else if (action === 'insert-star') { if (sl) { sl.elements.push({ id:'el_'+Date.now(), type:'shape', shape:'star', x:200, y:100, w:120, h:120, fill:'#f0b232', stroke:'#fff', strokeW:2 }); save(); render(); } }
      else if (action === 'insert-image') {
        const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*';
        inp.onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => { if (sl) { sl.elements.push({ id:'el_'+Date.now(), type:'image', x:100, y:80, w:300, h:200, src:ev.target.result }); save(); render(); } }; r.readAsDataURL(f); };
        inp.click();
      }
      else if (action === 'layout') { if (typeof Notifications !== 'undefined') Notifications.send('PowerPoint','Layout options','▦'); }
      else if (action === 'reset') { if (sl) { sl.elements = []; save(); render(); } }
      else if (action === 'delete-slide') { if (state.slides.length > 1) { state.slides = state.slides.filter(s => s.id !== state.active); state.active = state.slides[0].id; save(); render(); } }
      else if (action === 'present-start') { startPresentation(0); }
      else if (action === 'present-current') { startPresentation(state.slides.findIndex(s=>s.id===state.active)); }
      else if (action.startsWith('theme-')) {
        const t = THEMES.find(th => th.name === action.replace('theme-',''));
        if (t && sl) { sl.bg = t.bg; sl.accent = t.accent; sl.titleColor = t.title; sl.bodyColor = t.body; save(); render(); }
      }
    };

    const renderMenuDropdowns = () => {
      document.querySelectorAll('.ppt-menu-drop').forEach(d => d.remove());
      if (!state.activeMenu || !MENUS[state.activeMenu]) return;
      const btn = document.getElementById(`ppt-menu-${state.activeMenu}-${id}`);
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const drop = document.createElement('div');
      drop.className = 'ppt-menu-drop';
      drop.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.bottom}px;background:#2a2a2a;border:1px solid #444;box-shadow:0 4px 12px rgba(0,0,0,0.4);z-index:9999;min-width:180px;border-radius:4px;padding:4px 0;`;
      drop.innerHTML = MENUS[state.activeMenu].map(item =>
        item.sep ? '<div style="height:1px;background:#444;margin:4px 0;"></div>'
        : `<div class="ppt-drop-item" data-action="${item.action}" style="padding:7px 16px;cursor:pointer;font-size:13px;color:#e0e0e0;" onmouseover="this.style.background='#d24726'" onmouseout="this.style.background=''">${item.label}</div>`
      ).join('');
      document.body.appendChild(drop);
      drop.querySelectorAll('[data-action]').forEach(el => el.addEventListener('click', () => handleMenuAction(el.dataset.action)));
      setTimeout(() => {
        const dismiss = e => { if (!drop.contains(e.target) && !btn.contains(e.target)) { drop.remove(); state.activeMenu = null; document.removeEventListener('click', dismiss); } };
        document.addEventListener('click', dismiss);
      }, 10);
    };

    const startPresentation = (startIdx) => {
      let idx = startIdx;
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:#000;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;';
      const showSlide = () => {
        const sl = state.slides[idx];
        if (!sl) { overlay.remove(); return; }
        overlay.innerHTML = `
          <div style="width:100vw;height:100vh;background:${sl.bg};display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden;">
            ${renderSlideElements(sl, true)}
            <div style="position:absolute;bottom:16px;left:50%;transform:translateX(-50%);display:flex;gap:16px;align-items:center;">
              <button id="ppt-prev-btn" style="padding:8px 20px;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:4px;color:#fff;cursor:pointer;font-size:14px;">◀ Prev</button>
              <span style="color:rgba(255,255,255,0.5);font-size:13px;">${idx+1} / ${state.slides.length}</span>
              <button id="ppt-next-btn" style="padding:8px 20px;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:4px;color:#fff;cursor:pointer;font-size:14px;">Next ▶</button>
              <button id="ppt-exit-btn" style="padding:8px 20px;background:rgba(196,43,28,0.6);border:1px solid rgba(196,43,28,0.8);border-radius:4px;color:#fff;cursor:pointer;font-size:14px;">✕ Exit</button>
            </div>
          </div>`;
        document.getElementById('ppt-prev-btn').onclick = () => { if (idx > 0) { idx--; showSlide(); } };
        document.getElementById('ppt-next-btn').onclick = () => { if (idx < state.slides.length-1) { idx++; showSlide(); } };
        document.getElementById('ppt-exit-btn').onclick = () => overlay.remove();
      };
      document.body.appendChild(overlay);
      showSlide();
      const keyHandler = e => { if (e.key==='ArrowRight'||e.key==='ArrowDown') { if (idx<state.slides.length-1){idx++;showSlide();} } else if (e.key==='ArrowLeft'||e.key==='ArrowUp') { if (idx>0){idx--;showSlide();} } else if (e.key==='Escape') { overlay.remove(); document.removeEventListener('keydown',keyHandler); } };
      document.addEventListener('keydown', keyHandler);
    };

    const renderSlideElements = (sl, presenting=false) => {
      const scale = presenting ? 1 : 1;
      let html = '';
      // Title
      html += `<div style="position:absolute;top:${presenting?'15%':'40px'};left:50%;transform:translateX(-50%);width:${presenting?'80%':'640px'};text-align:center;z-index:2;">
        <div ${!presenting?`id="ppt-title-${id}" contenteditable="true"`:''}
          style="font-size:${presenting?'52px':'32px'};font-weight:700;color:${sl.titleColor};outline:none;min-height:${presenting?'60px':'40px'};cursor:${presenting?'default':'text'};"
        >${sl.title}</div>
      </div>`;
      // Body
      html += `<div style="position:absolute;top:${presenting?'38%':'130px'};left:50%;transform:translateX(-50%);width:${presenting?'75%':'600px'};text-align:center;z-index:2;">
        <div ${!presenting?`id="ppt-body-${id}" contenteditable="true"`:''}
          style="font-size:${presenting?'26px':'16px'};color:${sl.bodyColor};outline:none;min-height:${presenting?'40px':'40px'};cursor:${presenting?'default':'text'};"
        >${sl.body}</div>
      </div>`;
      // Extra elements
      (sl.elements||[]).forEach(el => {
        if (el.type === 'text') {
          html += `<div ${!presenting?`data-elid="${el.id}"`:''}
            style="position:absolute;left:${el.x}px;top:${el.y}px;width:${el.w}px;min-height:${el.h}px;color:${el.color};font-size:${el.fontSize}px;font-weight:${el.bold?'bold':'normal'};font-style:${el.italic?'italic':'normal'};text-align:${el.align};cursor:${presenting?'default':'move'};z-index:3;padding:4px;border:${!presenting&&state.selectedEl===el.id?'2px dashed rgba(255,255,255,0.6)':'2px solid transparent'};"
            ${!presenting?`contenteditable="true"`:''}
          >${el.text}</div>`;
        } else if (el.type === 'shape') {
          const shapeHtml = {
            rect: `<div style="width:100%;height:100%;background:${el.fill};border:${el.strokeW}px solid ${el.stroke};border-radius:4px;"></div>`,
            circle: `<div style="width:100%;height:100%;background:${el.fill};border:${el.strokeW}px solid ${el.stroke};border-radius:50%;"></div>`,
            triangle: `<div style="width:0;height:0;border-left:${el.w/2}px solid transparent;border-right:${el.w/2}px solid transparent;border-bottom:${el.h}px solid ${el.fill};"></div>`,
            star: `<div style="width:100%;height:100%;background:${el.fill};clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);"></div>`,
          }[el.shape] || '';
          html += `<div ${!presenting?`data-elid="${el.id}"`:''}
            style="position:absolute;left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;cursor:${presenting?'default':'move'};z-index:3;border:${!presenting&&state.selectedEl===el.id?'2px dashed rgba(255,255,255,0.6)':'2px solid transparent'};"
          >${shapeHtml}</div>`;
        } else if (el.type === 'image') {
          html += `<div ${!presenting?`data-elid="${el.id}"`:''}
            style="position:absolute;left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;cursor:${presenting?'default':'move'};z-index:3;border:${!presenting&&state.selectedEl===el.id?'2px dashed rgba(255,255,255,0.6)':'2px solid transparent'};"
          ><img src="${el.src}" style="width:100%;height:100%;object-fit:contain;" /></div>`;
        }
      });
      return html;
    };

    const render = () => {
      const slide = getSlide();
      content.innerHTML = `
        <div style="background:#d24726;padding:0 8px;flex-shrink:0;">
          <div style="display:flex;align-items:center;border-bottom:1px solid rgba(255,255,255,0.15);">
            ${Object.keys(MENUS).map(m=>`<button id="ppt-menu-${m}-${id}" style="padding:6px 12px;background:transparent;border:none;color:rgba(255,255,255,0.9);cursor:pointer;font-size:12px;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='transparent'">${m}</button>`).join('')}
            <div style="flex:1;"></div>
            <button id="ppt-present-${id}" style="padding:5px 14px;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.3);border-radius:4px;color:#fff;cursor:pointer;font-size:12px;margin:4px;">▶ Present</button>
            <button id="ppt-save-${id}" style="padding:5px 14px;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#fff;cursor:pointer;font-size:12px;margin:4px;">💾 Save</button>
          </div>
        </div>
        <div style="background:#2a2a2a;border-bottom:1px solid #444;padding:6px 12px;flex-shrink:0;">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span style="font-size:11px;color:#aaa;margin-right:4px;">Insert:</span>
            <button id="ppt-ins-text-${id}" title="Text Box" style="padding:4px 10px;background:#333;border:1px solid #555;border-radius:3px;color:#fff;cursor:pointer;font-size:11px;">T Text</button>
            <button id="ppt-ins-rect-${id}" title="Rectangle" style="padding:4px 10px;background:#333;border:1px solid #555;border-radius:3px;color:#fff;cursor:pointer;font-size:11px;">▭ Rect</button>
            <button id="ppt-ins-circle-${id}" title="Circle" style="padding:4px 10px;background:#333;border:1px solid #555;border-radius:3px;color:#fff;cursor:pointer;font-size:11px;">○ Circle</button>
            <button id="ppt-ins-tri-${id}" title="Triangle" style="padding:4px 10px;background:#333;border:1px solid #555;border-radius:3px;color:#fff;cursor:pointer;font-size:11px;">△ Triangle</button>
            <button id="ppt-ins-star-${id}" title="Star" style="padding:4px 10px;background:#333;border:1px solid #555;border-radius:3px;color:#fff;cursor:pointer;font-size:11px;">★ Star</button>
            <button id="ppt-ins-img-${id}" title="Image" style="padding:4px 10px;background:#333;border:1px solid #555;border-radius:3px;color:#fff;cursor:pointer;font-size:11px;">🖼 Image</button>
            <div style="width:1px;height:20px;background:#555;margin:0 4px;"></div>
            <span style="font-size:11px;color:#aaa;">Theme:</span>
            ${THEMES.map(t=>`<div data-theme="${t.name}" title="${t.name}" style="width:20px;height:20px;border-radius:3px;background:${t.bg};border:2px solid ${slide?.bg===t.bg?'#fff':'transparent'};cursor:pointer;"></div>`).join('')}
            <div style="width:1px;height:20px;background:#555;margin:0 4px;"></div>
            <span style="font-size:11px;color:#aaa;">BG:</span>
            <input type="color" id="ppt-bg-custom-${id}" value="${slide?.bg||'#1a1a2e'}" style="width:24px;height:24px;border:none;border-radius:3px;cursor:pointer;padding:0;">
            <span style="font-size:11px;color:#aaa;">Title:</span>
            <input type="color" id="ppt-tc-${id}" value="${slide?.titleColor||'#ffffff'}" style="width:24px;height:24px;border:none;border-radius:3px;cursor:pointer;padding:0;">
            <span style="font-size:11px;color:#aaa;">Body:</span>
            <input type="color" id="ppt-bc-${id}" value="${slide?.bodyColor||'rgba(255,255,255,0.8)'}" style="width:24px;height:24px;border:none;border-radius:3px;cursor:pointer;padding:0;">
            ${state.selectedEl ? `<div style="width:1px;height:20px;background:#555;margin:0 4px;"></div><button id="ppt-del-el-${id}" style="padding:4px 10px;background:rgba(196,43,28,0.4);border:1px solid #f44;border-radius:3px;color:#f88;cursor:pointer;font-size:11px;">🗑 Delete Element</button>` : ''}
          </div>
        </div>
        <div style="flex:1;display:flex;overflow:hidden;">
          <div style="width:160px;background:#1a1a1a;border-right:1px solid #333;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
            ${state.slides.map((sl, i) => `
              <div data-slideid="${sl.id}" style="border-radius:4px;overflow:hidden;cursor:pointer;border:2px solid ${state.active===sl.id?'#d24726':'transparent'};flex-shrink:0;">
                <div style="background:${sl.bg};height:72px;position:relative;overflow:hidden;">
                  <div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);width:90%;font-size:8px;font-weight:700;color:${sl.titleColor};text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${sl.title}</div>
                  <div style="position:absolute;top:26px;left:50%;transform:translateX(-50%);width:90%;font-size:6px;color:${sl.bodyColor};text-align:center;overflow:hidden;">${sl.body}</div>
                </div>
                <div style="background:#2a2a2a;padding:2px 6px;font-size:9px;color:rgba(255,255,255,0.4);">Slide ${i+1}</div>
              </div>`).join('')}
            <button id="ppt-addslide-${id}" style="padding:6px;background:rgba(255,255,255,0.06);border:1px dashed rgba(255,255,255,0.2);border-radius:4px;color:rgba(255,255,255,0.5);cursor:pointer;font-size:11px;">+ Add Slide</button>
          </div>
          <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
            <div style="flex:1;background:#525659;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:20px;position:relative;">
              <div id="ppt-canvas-${id}" style="width:720px;height:405px;background:${slide?.bg||'#1a1a2e'};border-radius:4px;box-shadow:0 8px 32px rgba(0,0,0,0.5);position:relative;overflow:hidden;">
                ${slide ? renderSlideElements(slide) : ''}
              </div>
            </div>
            <div style="padding:6px 12px;background:#1a1a1a;border-top:1px solid #333;display:flex;align-items:center;gap:8px;flex-shrink:0;">
              <span style="font-size:11px;color:rgba(255,255,255,0.4);">Slide ${state.slides.findIndex(s=>s.id===state.active)+1} of ${state.slides.length}</span>
              <div style="flex:1;"></div>
              <button id="ppt-delslide-${id}" style="padding:3px 10px;background:rgba(196,43,28,0.2);border:1px solid rgba(196,43,28,0.3);border-radius:3px;color:#f44;cursor:pointer;font-size:11px;">Delete Slide</button>
              <button id="ppt-dupslide-${id}" style="padding:3px 10px;background:rgba(255,255,255,0.08);border:1px solid #444;border-radius:3px;color:#ccc;cursor:pointer;font-size:11px;">Duplicate</button>
            </div>
          </div>
        </div>`;

      bindEvents();
    };

    const bindEvents = () => {
      const slide = getSlide();

      // Menu bar
      Object.keys(MENUS).forEach(m => {
        const btn = document.getElementById(`ppt-menu-${m}-${id}`);
        if (btn) btn.addEventListener('click', e => { e.stopPropagation(); state.activeMenu = state.activeMenu===m?null:m; renderMenuDropdowns(); });
      });

      // Quick insert toolbar
      const qi = (btnId, action) => { const el = document.getElementById(btnId); if (el) el.addEventListener('click', () => handleMenuAction(action)); };
      qi(`ppt-ins-text-${id}`, 'insert-text');
      qi(`ppt-ins-rect-${id}`, 'insert-rect');
      qi(`ppt-ins-circle-${id}`, 'insert-circle');
      qi(`ppt-ins-tri-${id}`, 'insert-triangle');
      qi(`ppt-ins-star-${id}`, 'insert-star');
      qi(`ppt-ins-img-${id}`, 'insert-image');

      // Theme swatches
      content.querySelectorAll('[data-theme]').forEach(el => {
        el.addEventListener('click', () => handleMenuAction('theme-'+el.dataset.theme));
      });

      // Color pickers
      const bgPicker = document.getElementById(`ppt-bg-custom-${id}`);
      if (bgPicker) bgPicker.addEventListener('input', e => { if (slide) { slide.bg = e.target.value; save(); render(); } });
      const tcPicker = document.getElementById(`ppt-tc-${id}`);
      if (tcPicker) tcPicker.addEventListener('input', e => { if (slide) { slide.titleColor = e.target.value; save(); render(); } });
      const bcPicker = document.getElementById(`ppt-bc-${id}`);
      if (bcPicker) bcPicker.addEventListener('input', e => { if (slide) { slide.bodyColor = e.target.value; save(); render(); } });

      // Slide panel
      content.querySelectorAll('[data-slideid]').forEach(el => {
        el.addEventListener('click', () => {
          const cur = getSlide();
          if (cur) {
            const t = document.getElementById(`ppt-title-${id}`); if (t) cur.title = t.innerText;
            const b = document.getElementById(`ppt-body-${id}`); if (b) cur.body = b.innerText;
          }
          state.active = el.dataset.slideid; state.selectedEl = null; save(); render();
        });
      });

      // Title/body editable
      const titleEl = document.getElementById(`ppt-title-${id}`);
      const bodyEl = document.getElementById(`ppt-body-${id}`);
      if (titleEl) titleEl.addEventListener('input', () => { if (slide) { slide.title = titleEl.innerText; save(); } });
      if (bodyEl) bodyEl.addEventListener('input', () => { if (slide) { slide.body = bodyEl.innerText; save(); } });

      // Element selection & drag
      content.querySelectorAll('[data-elid]').forEach(el => {
        el.addEventListener('click', e => { e.stopPropagation(); state.selectedEl = el.dataset.elid; render(); });
        let dragging = false, ox=0, oy=0, startX=0, startY=0;
        el.addEventListener('mousedown', e => {
          e.preventDefault(); dragging = true;
          const elem = slide?.elements.find(x=>x.id===el.dataset.elid);
          if (!elem) return;
          ox = elem.x; oy = elem.y; startX = e.clientX; startY = e.clientY;
          const onMove = ev => { if (!dragging) return; elem.x = ox+(ev.clientX-startX); elem.y = oy+(ev.clientY-startY); el.style.left=elem.x+'px'; el.style.top=elem.y+'px'; };
          const onUp = () => { dragging=false; save(); document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp); };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });
      });

      // Click canvas to deselect
      const canvas = document.getElementById(`ppt-canvas-${id}`);
      if (canvas) canvas.addEventListener('click', e => { if (e.target === canvas) { state.selectedEl = null; render(); } });

      // Delete element
      const delEl = document.getElementById(`ppt-del-el-${id}`);
      if (delEl) delEl.addEventListener('click', () => { if (slide && state.selectedEl) { slide.elements = slide.elements.filter(e=>e.id!==state.selectedEl); state.selectedEl=null; save(); render(); } });

      // Add/delete/duplicate slide
      document.getElementById(`ppt-addslide-${id}`)?.addEventListener('click', () => { const ns=mkSlide(state.slides.length+1); state.slides.push(ns); state.active=ns.id; save(); render(); });
      document.getElementById(`ppt-delslide-${id}`)?.addEventListener('click', () => {
        if (state.slides.length<=1) { if (typeof Notifications!=='undefined') Notifications.send('PowerPoint','Cannot delete last slide','⚠️'); return; }
        state.slides=state.slides.filter(s=>s.id!==state.active); state.active=state.slides[0].id; save(); render();
      });
      document.getElementById(`ppt-dupslide-${id}`)?.addEventListener('click', () => {
        if (!slide) return;
        const dup = JSON.parse(JSON.stringify(slide)); dup.id='sl_'+Date.now(); dup.title+=' (copy)';
        const idx = state.slides.findIndex(s=>s.id===state.active);
        state.slides.splice(idx+1,0,dup); state.active=dup.id; save(); render();
      });

      // Present / Save
      document.getElementById(`ppt-present-${id}`)?.addEventListener('click', () => startPresentation(state.slides.findIndex(s=>s.id===state.active)));
      document.getElementById(`ppt-save-${id}`)?.addEventListener('click', () => { save(); if (typeof Notifications!=='undefined') Notifications.send('PowerPoint','Saved!','💾'); });
    };

    render();

  }
});
