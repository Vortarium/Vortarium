// ===== OFFICE 365 HUB =====
AppLauncher.register('office', {
  title: 'Office 365', icon: '📊',
  launch() {
    if (typeof StoreManager !== 'undefined' && !StoreManager.isInstalled('office')) {
      _showInstallGate('Office 365', '📊', 'office'); return;
    }
    const id = WM.create({ title: 'Office 365', icon: '📊', width: 860, height: 580, appId: 'office' });
    const content = WM.getContent(id);
    content.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;background:#1e1e1e;color:#fff;';

    const apps = [
      { id:'word', icon:'📘', name:'Word', color:'#2b579a', desc:'Create and edit documents' },
      { id:'excel', icon:'📗', name:'Excel', color:'#217346', desc:'Spreadsheets and data' },
      { id:'powerpoint', icon:'📙', name:'PowerPoint', color:'#d24726', desc:'Presentations and slides' },
      { id:'mail', icon:'📧', name:'Outlook Mail', color:'#0078d4', desc:'Email and calendar' },
      { id:'notepad', icon:'📝', name:'OneNote', color:'#7719aa', desc:'Notes and notebooks' },
      { id:'taskmanager', icon:'📊', name:'Teams', color:'#6264a7', desc:'Chat and collaboration' },
    ];

    content.innerHTML = `
      <div style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;gap:12px;">
        <span style="font-size:28px;">📊</span>
        <div>
          <div style="font-size:20px;font-weight:700;">Office 365</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.5);">Signed in as ${OS.settings.username || 'User'}</div>
        </div>
      </div>
      <div style="flex:1;overflow-y:auto;padding:24px;">
        <div style="font-size:14px;font-weight:600;margin-bottom:16px;color:rgba(255,255,255,0.7);">Apps</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px;">
          ${apps.map(a => `
            <div data-appid="${a.id}" style="display:flex;align-items:center;gap:12px;padding:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:10px;cursor:pointer;transition:all 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='rgba(255,255,255,0.04)'">
              <div style="width:44px;height:44px;border-radius:8px;background:${a.color};display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">${a.icon}</div>
              <div>
                <div style="font-size:14px;font-weight:600;">${a.name}</div>
                <div style="font-size:11px;color:rgba(255,255,255,0.4);">${a.desc}</div>
              </div>
            </div>`).join('')}
        </div>
        <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:rgba(255,255,255,0.7);">Recent Documents</div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${[
            {icon:'📘',name:'Project Proposal.docx',app:'word',time:'2 hours ago'},
            {icon:'📗',name:'Budget 2025.xlsx',app:'excel',time:'Yesterday'},
            {icon:'📙',name:'Q4 Review.pptx',app:'powerpoint',time:'3 days ago'},
          ].map(f=>`
            <div data-appid="${f.app}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,0.03);border-radius:8px;cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.07)'" onmouseout="this.style.background='rgba(255,255,255,0.03)'">
              <span style="font-size:20px;">${f.icon}</span>
              <div style="flex:1;">
                <div style="font-size:13px;">${f.name}</div>
                <div style="font-size:11px;color:rgba(255,255,255,0.4);">${f.time}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>`;

    content.querySelectorAll('[data-appid]').forEach(el => {
      el.addEventListener('click', () => AppLauncher.launch(el.dataset.appid));
    });
  }
});
