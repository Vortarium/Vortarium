// ===== TASK MANAGER APP =====
AppLauncher.register('taskmanager', {
  title: 'Task Manager',
  icon: '📊',

  launch() {
    const id = WM.create({
      title: 'Task Manager',
      icon: '📊',
      width: 760,
      height: 520,
      appId: 'taskmanager',
    });

    const content = WM.getContent(id);
    content.innerHTML = `
      <div class="tm-tabs" id="tm-tabs-${id}">
        <button class="tm-tab active" data-tab="processes">Processes</button>
        <button class="tm-tab" data-tab="performance">Performance</button>
        <button class="tm-tab" data-tab="startup">Startup</button>
        <button class="tm-tab" data-tab="users">Users</button>
      </div>
      <div class="tm-content" id="tm-content-${id}"></div>
    `;

    const state = { tab: 'processes', interval: null };

    const processes = [
      { name: 'System', pid: 4, type: 'System', cpu: 0.1, mem: 0.5, status: 'Running' },
      { name: 'dwm.exe', pid: 892, type: 'System', cpu: 1.2, mem: 32.1, status: 'Running' },
      { name: 'explorer.exe', pid: 1234, type: 'App', cpu: 0.5, mem: 45.2, status: 'Running' },
      { name: 'SearchHost.exe', pid: 2048, type: 'Background', cpu: 0.3, mem: 28.4, status: 'Running' },
      { name: 'RuntimeBroker.exe', pid: 3012, type: 'Background', cpu: 0.1, mem: 12.8, status: 'Running' },
      { name: 'svchost.exe', pid: 1456, type: 'System', cpu: 0.8, mem: 18.6, status: 'Running' },
      { name: 'WmiPrvSE.exe', pid: 2200, type: 'Background', cpu: 0.0, mem: 8.2, status: 'Running' },
      { name: 'antimalware.exe', pid: 3456, type: 'Background', cpu: 2.1, mem: 156.4, status: 'Running' },
    ];

    const renderProcesses = () => {
      const running = Object.values(WM.windows).map((w, i) => ({
        name: (w.appId || 'app') + '.exe',
        pid: 4000 + i,
        type: 'App',
        cpu: parseFloat((Math.random() * 8).toFixed(1)),
        mem: parseFloat((Math.random() * 150 + 20).toFixed(1)),
        status: w.minimized ? 'Suspended' : 'Running',
        winId: w.id,
      }));

      // Include active virus processes
      const virusProcs = (typeof VirusEngine !== 'undefined') ? VirusEngine.getVirusProcesses() : [];

      const all = [...processes, ...running, ...virusProcs];

      return `
        <table class="tm-process-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>PID</th>
              <th>Type</th>
              <th>CPU</th>
              <th>Memory</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${all.map(p => `
              <tr data-win="${p.winId || ''}" style="${p.isVirus ? 'background:rgba(244,68,68,0.07);' : ''}">
                <td style="${p.isVirus ? 'color:#f44747;font-weight:600;' : ''}">${p.isVirus ? '🦠 ' : ''}${p.name}</td>
                <td style="color:var(--text-muted)">${p.pid}</td>
                <td style="color:${p.isVirus ? '#f44747' : 'var(--text-muted)'}">${p.type}</td>
                <td style="color:${p.cpu > 5 ? '#f44747' : 'var(--text-muted)'}">${p.cpu}%</td>
                <td style="color:var(--text-muted)">${p.mem} MB</td>
                <td style="color:${p.status === 'Running' ? '#4ec9b0' : '#dcdcaa'}">${p.status}</td>
                <td>${p.winId ? `<button onclick="WM.close('${p.winId}')" style="padding:2px 8px;background:rgba(196,43,28,0.2);border:1px solid rgba(196,43,28,0.3);border-radius:4px;color:#f44747;cursor:pointer;font-size:11px">End</button>` : p.isVirus ? `<button onclick="VirusEngine.killProcess(${p.pid})" style="padding:2px 8px;background:rgba(196,43,28,0.3);border:1px solid rgba(196,43,28,0.5);border-radius:4px;color:#f44747;cursor:pointer;font-size:11px;font-weight:700">End Task</button>` : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    };

    const renderPerformance = () => {
      const cpu = OS.getCpuUsage();
      const mem = OS.getMemoryUsage();
      const disk = OS.getDiskUsage();
      const net = OS.getNetworkSpeed();

      return `
        <div class="tm-perf-grid">
          <div class="tm-perf-card">
            <div class="tm-perf-title">CPU</div>
            <div class="tm-perf-value">${cpu}%</div>
            <div class="tm-perf-sub">Intel Core i9-14900K · 24 cores</div>
            <div class="tm-bar"><div class="tm-bar-fill" style="width:${cpu}%"></div></div>
          </div>
          <div class="tm-perf-card">
            <div class="tm-perf-title">Memory</div>
            <div class="tm-perf-value">${mem.percent}%</div>
            <div class="tm-perf-sub">${FS.formatSize(mem.used * 1024)} / ${FS.formatSize(mem.total * 1024)}</div>
            <div class="tm-bar"><div class="tm-bar-fill" style="width:${mem.percent}%"></div></div>
          </div>
          <div class="tm-perf-card">
            <div class="tm-perf-title">Disk (C:)</div>
            <div class="tm-perf-value">${disk.percent}%</div>
            <div class="tm-perf-sub">${disk.used} GB / ${disk.total} GB used</div>
            <div class="tm-bar"><div class="tm-bar-fill" style="width:${disk.percent}%"></div></div>
          </div>
          <div class="tm-perf-card">
            <div class="tm-perf-title">Network</div>
            <div class="tm-perf-value">${net.down} Mbps</div>
            <div class="tm-perf-sub">↓ ${net.down} Mbps · ↑ ${net.up} Mbps</div>
            <div class="tm-bar"><div class="tm-bar-fill" style="width:${Math.min(100, parseFloat(net.down) * 2)}%"></div></div>
          </div>
          <div class="tm-perf-card">
            <div class="tm-perf-title">GPU</div>
            <div class="tm-perf-value">${Math.floor(Math.random() * 40 + 10)}%</div>
            <div class="tm-perf-sub">NVIDIA GeForce RTX 5090 · 24 GB VRAM</div>
            <div class="tm-bar"><div class="tm-bar-fill" style="width:${Math.floor(Math.random() * 40 + 10)}%"></div></div>
          </div>
          <div class="tm-perf-card">
            <div class="tm-perf-title">Uptime</div>
            <div class="tm-perf-value" style="font-size:18px">${OS.getUptime()}</div>
            <div class="tm-perf-sub">Since last boot</div>
          </div>
        </div>
      `;
    };

    const renderStartup = () => `
      <table class="tm-process-table">
        <thead><tr><th>Name</th><th>Publisher</th><th>Status</th><th>Impact</th><th></th></tr></thead>
        <tbody>
          ${[
            { name: 'OneDrive', pub: 'Microsoft', status: 'Enabled', impact: 'High' },
            { name: 'Teams', pub: 'Microsoft', status: 'Enabled', impact: 'High' },
            { name: 'Discord', pub: 'Discord Inc.', status: 'Enabled', impact: 'Medium' },
            { name: 'Spotify', pub: 'Spotify AB', status: 'Disabled', impact: 'Low' },
            { name: 'Steam', pub: 'Valve', status: 'Disabled', impact: 'Medium' },
          ].map(p => `
            <tr>
              <td>${p.name}</td>
              <td style="color:var(--text-muted)">${p.pub}</td>
              <td style="color:${p.status === 'Enabled' ? '#4ec9b0' : 'var(--text-muted)'}">${p.status}</td>
              <td style="color:${p.impact === 'High' ? '#f44747' : p.impact === 'Medium' ? '#dcdcaa' : '#4ec9b0'}">${p.impact}</td>
              <td><button style="padding:2px 8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:white;cursor:pointer;font-size:11px">${p.status === 'Enabled' ? 'Disable' : 'Enable'}</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const renderUsers = () => `
      <table class="tm-process-table">
        <thead><tr><th>User</th><th>Status</th><th>CPU</th><th>Memory</th></tr></thead>
        <tbody>
          <tr>
            <td style="display:flex;align-items:center;gap:8px"><span>👤</span>${OS.username}</td>
            <td style="color:#4ec9b0">Active</td>
            <td>${OS.getCpuUsage()}%</td>
            <td>${OS.getMemoryUsage().percent}%</td>
          </tr>
        </tbody>
      </table>
    `;

    const render = () => {
      const contentEl = document.getElementById(`tm-content-${id}`);
      if (!contentEl) return;
      switch (state.tab) {
        case 'processes': contentEl.innerHTML = renderProcesses(); break;
        case 'performance': contentEl.innerHTML = renderPerformance(); break;
        case 'startup': contentEl.innerHTML = renderStartup(); break;
        case 'users': contentEl.innerHTML = renderUsers(); break;
      }
    };

    document.getElementById(`tm-tabs-${id}`).querySelectorAll('.tm-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.getElementById(`tm-tabs-${id}`).querySelectorAll('.tm-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.tab = tab.dataset.tab;
        render();
      });
    });

    render();
    state.interval = setInterval(render, 2000);

    // Cleanup on close
    const observer = new MutationObserver(() => {
      if (!document.getElementById(id)) {
        clearInterval(state.interval);
        observer.disconnect();
      }
    });
    observer.observe(document.getElementById('windows-container'), { childList: true });
  }
});
