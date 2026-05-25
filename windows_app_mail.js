// ===== OUTLOOK MAIL CLONE =====
AppLauncher.register('mail', {
  title: 'Mail', icon: '📧',
  launch() {
    const id = WM.create({ title: 'Outlook Mail', icon: '📧', width: 1000, height: 660, appId: 'mail' });
    const content = WM.getContent(id);
    content.style.cssText = 'display:flex;overflow:hidden;background:#1e1e1e;color:#fff;font-family:"Segoe UI",sans-serif;';

    const saved = OS.getAppData('mail') || {};
    const username = OS.settings.username || 'User';
    const email = username.toLowerCase().replace(/\s/g,'') + '@windows12.local';

    const state = {
      folder: saved.folder || 'inbox',
      emails: saved.emails || [
        { id:'e1', from:'Microsoft', fromEmail:'noreply@microsoft.com', subject:'Welcome to Windows 12!', body:'Thank you for using Windows 12. Enjoy your experience!', time:'9:00 AM', read:false, folder:'inbox' },
        { id:'e2', from:'GitHub', fromEmail:'noreply@github.com', subject:'Your weekly digest', body:'Here are the trending repositories this week...', time:'8:30 AM', read:true, folder:'inbox' },
        { id:'e3', from:'Alice', fromEmail:'alice@example.com', subject:'Meeting tomorrow', body:'Hi! Just confirming our meeting tomorrow at 2 PM. See you then!', time:'Yesterday', read:true, folder:'inbox' },
        { id:'e4', from:'Bob', fromEmail:'bob@example.com', subject:'Project update', body:'The project is on track. We should be done by Friday.', time:'Mon', read:true, folder:'inbox' },
      ],
      selected: null,
      composing: false,
    };
    const save = () => OS.setAppData('mail', { folder: state.folder, emails: state.emails });

    const FOLDERS = [
      { id:'inbox', icon:'📥', label:'Inbox' },
      { id:'sent', icon:'📤', label:'Sent' },
      { id:'drafts', icon:'📝', label:'Drafts' },
      { id:'trash', icon:'🗑️', label:'Trash' },
    ];

    const render = () => {
      const folderEmails = state.emails.filter(e => e.folder === state.folder);
      const selected = state.selected ? state.emails.find(e => e.id === state.selected) : null;

      content.innerHTML = `
        <!-- Sidebar -->
        <div style="width:200px;background:#111;display:flex;flex-direction:column;flex-shrink:0;border-right:1px solid rgba(255,255,255,0.06);">
          <div style="padding:14px 16px;font-weight:700;font-size:14px;display:flex;align-items:center;gap:8px;">
            <span>📧</span> Mail
          </div>
          <button id="mail-compose-${id}" style="margin:0 12px 12px;padding:8px;background:#0078d4;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:13px;font-weight:600;">+ Compose</button>
          <div style="flex:1;overflow-y:auto;">
            ${FOLDERS.map(f => `
              <div data-folder="${f.id}" style="display:flex;align-items:center;gap:8px;padding:8px 16px;cursor:pointer;background:${state.folder===f.id?'rgba(0,120,212,0.2)':'transparent'};font-size:13px;" onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background='${state.folder===f.id?'rgba(0,120,212,0.2)':'transparent'}'">
                <span>${f.icon}</span> ${f.label}
                ${f.id==='inbox'?`<span style="margin-left:auto;background:#0078d4;border-radius:10px;padding:1px 6px;font-size:10px;">${state.emails.filter(e=>e.folder==='inbox'&&!e.read).length||''}</span>`:''}
              </div>`).join('')}
          </div>
          <div style="padding:12px 16px;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:rgba(255,255,255,0.4);">${email}</div>
        </div>

        <!-- Email list -->
        <div style="width:280px;border-right:1px solid rgba(255,255,255,0.06);display:flex;flex-direction:column;flex-shrink:0;">
          <div style="padding:12px 16px;font-weight:600;font-size:14px;border-bottom:1px solid rgba(255,255,255,0.06);">
            ${FOLDERS.find(f=>f.id===state.folder)?.label || 'Inbox'}
          </div>
          <div style="flex:1;overflow-y:auto;">
            ${folderEmails.length === 0 ? '<div style="padding:20px;text-align:center;color:rgba(255,255,255,0.4);font-size:13px;">No emails</div>' :
              folderEmails.map(e => `
                <div data-emailid="${e.id}" style="padding:12px 16px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.04);background:${state.selected===e.id?'rgba(0,120,212,0.15)':'transparent'};" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='${state.selected===e.id?'rgba(0,120,212,0.15)':'transparent'}'">
                  <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <span style="font-size:13px;font-weight:${e.read?'400':'700'};color:${e.read?'rgba(255,255,255,0.8)':'#fff'};">${e.from}</span>
                    <span style="font-size:11px;color:rgba(255,255,255,0.4);">${e.time}</span>
                  </div>
                  <div style="font-size:12px;font-weight:${e.read?'400':'600'};margin-bottom:2px;">${e.subject}</div>
                  <div style="font-size:11px;color:rgba(255,255,255,0.4);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.body.slice(0,60)}...</div>
                </div>`).join('')}
          </div>
        </div>

        <!-- Email view / compose -->
        <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
          ${state.composing ? `
            <div style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);font-weight:600;">New Message</div>
            <div style="padding:12px 16px;display:flex;flex-direction:column;gap:8px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <div style="display:flex;align-items:center;gap:8px;"><span style="font-size:12px;color:rgba(255,255,255,0.5);min-width:40px;">To:</span><input id="mail-to-${id}" type="text" placeholder="recipient@example.com" style="flex:1;background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,0.1);color:#fff;font-size:13px;padding:4px 0;outline:none;"></div>
              <div style="display:flex;align-items:center;gap:8px;"><span style="font-size:12px;color:rgba(255,255,255,0.5);min-width:40px;">Subject:</span><input id="mail-subj-${id}" type="text" placeholder="Subject" style="flex:1;background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,0.1);color:#fff;font-size:13px;padding:4px 0;outline:none;"></div>
            </div>
            <textarea id="mail-body-${id}" placeholder="Write your message..." style="flex:1;background:transparent;border:none;color:#d1d2d3;font-size:14px;padding:16px;outline:none;resize:none;line-height:1.6;"></textarea>
            <div style="padding:10px 16px;border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:8px;">
              <button id="mail-send-${id}" style="padding:8px 20px;background:#0078d4;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:13px;font-weight:600;">Send</button>
              <button id="mail-discard-${id}" style="padding:8px 16px;background:rgba(255,255,255,0.06);border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:13px;">Discard</button>
            </div>
          ` : selected ? `
            <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <div style="font-size:20px;font-weight:700;margin-bottom:8px;">${selected.subject}</div>
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:36px;height:36px;border-radius:50%;background:#0078d4;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;">${selected.from[0]}</div>
                <div>
                  <div style="font-size:13px;font-weight:600;">${selected.from}</div>
                  <div style="font-size:11px;color:rgba(255,255,255,0.4);">${selected.fromEmail} → ${email}</div>
                </div>
                <div style="margin-left:auto;font-size:12px;color:rgba(255,255,255,0.4);">${selected.time}</div>
              </div>
            </div>
            <div style="flex:1;overflow-y:auto;padding:20px;font-size:14px;line-height:1.8;color:#d1d2d3;">${selected.body}</div>
            <div style="padding:10px 16px;border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:8px;">
              <button id="mail-reply-${id}" style="padding:7px 16px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#fff;cursor:pointer;font-size:12px;">↩ Reply</button>
              <button id="mail-del-${id}" style="padding:7px 16px;background:rgba(196,43,28,0.15);border:1px solid rgba(196,43,28,0.2);border-radius:6px;color:#f44;cursor:pointer;font-size:12px;">🗑️ Delete</button>
            </div>
          ` : `
            <div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;color:rgba(255,255,255,0.3);">
              <div style="font-size:48px;">📧</div>
              <div style="font-size:14px;">Select an email to read</div>
            </div>
          `}
        </div>`;

      // Folder clicks
      content.querySelectorAll('[data-folder]').forEach(el => {
        el.addEventListener('click', () => { state.folder = el.dataset.folder; state.selected = null; save(); render(); });
      });

      // Email clicks
      content.querySelectorAll('[data-emailid]').forEach(el => {
        el.addEventListener('click', () => {
          state.selected = el.dataset.emailid;
          const email = state.emails.find(e => e.id === state.selected);
          if (email) { email.read = true; save(); }
          state.composing = false;
          render();
        });
      });

      // Compose
      document.getElementById(`mail-compose-${id}`)?.addEventListener('click', () => {
        state.composing = true; state.selected = null; render();
      });

      document.getElementById(`mail-send-${id}`)?.addEventListener('click', () => {
        const to = document.getElementById(`mail-to-${id}`)?.value || '';
        const subj = document.getElementById(`mail-subj-${id}`)?.value || '(no subject)';
        const body = document.getElementById(`mail-body-${id}`)?.value || '';
        if (!to) { Notifications.send('Mail','Please enter a recipient','⚠️'); return; }
        state.emails.unshift({ id:'e_'+Date.now(), from:username, fromEmail:email, subject:subj, body, time:'Just now', read:true, folder:'sent' });
        state.composing = false; state.folder = 'sent'; save(); render();
        Notifications.send('Mail', `Sent to ${to}`, '📤');
      });

      document.getElementById(`mail-discard-${id}`)?.addEventListener('click', () => { state.composing = false; render(); });

      document.getElementById(`mail-reply-${id}`)?.addEventListener('click', () => {
        const sel = state.emails.find(e => e.id === state.selected);
        if (!sel) return;
        state.composing = true;
        render();
        setTimeout(() => {
          const toEl = document.getElementById(`mail-to-${id}`);
          const subjEl = document.getElementById(`mail-subj-${id}`);
          const bodyEl = document.getElementById(`mail-body-${id}`);
          if (toEl) toEl.value = sel.fromEmail;
          if (subjEl) subjEl.value = 'Re: ' + sel.subject;
          if (bodyEl) bodyEl.value = `\n\n--- Original Message ---\nFrom: ${sel.from}\n${sel.body}`;
        }, 50);
      });

      document.getElementById(`mail-del-${id}`)?.addEventListener('click', () => {
        const sel = state.emails.find(e => e.id === state.selected);
        if (!sel) return;
        sel.folder = 'trash';
        state.selected = null;
        save(); render();
      });
    };

    render();
  }
});
