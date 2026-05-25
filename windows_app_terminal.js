// ===== TERMINAL APP =====
AppLauncher.register('terminal', {
  title: 'Terminal',
  icon: '💻',

  launch(opts) {
    const id = WM.create({
      title: 'Terminal',
      icon: '💻',
      width: 720,
      height: 460,
      appId: 'terminal',
    });

    const content = WM.getContent(id);
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.background = '#0c0c0c';
    content.innerHTML = `
      <div class="terminal-body" id="term-body-${id}"></div>
      <div class="terminal-input-row">
        <span class="terminal-prompt">PS</span>
        <span class="terminal-path" id="term-path-${id}"> C:\\Users\\User</span>
        <span class="terminal-prompt">&gt;</span>
        <input type="text" class="terminal-input" id="term-input-${id}" autocomplete="off" spellcheck="false" />
      </div>
    `;

    this._init(id);
  },

  _init(winId) {
    const body = document.getElementById(`term-body-${winId}`);
    const input = document.getElementById(`term-input-${winId}`);
    const pathEl = document.getElementById(`term-path-${winId}`);

    const state = {
      cwd: 'C:/Users/User',
      history: [],
      histIdx: -1,
      env: {
        USERNAME: OS.username,
        COMPUTERNAME: OS.hostname,
        OS: 'Windows 12',
        PATH: 'C:\\Windows\\System32',
        TEMP: 'C:\\Temp',
      }
    };

    const print = (text, cls = 'terminal-output') => {
      const line = document.createElement('div');
      line.className = cls;
      line.textContent = text;
      body.appendChild(line);
      body.scrollTop = body.scrollHeight;
    };

    const printHTML = (html) => {
      const line = document.createElement('div');
      line.className = 'terminal-output';
      line.innerHTML = html;
      body.appendChild(line);
      body.scrollTop = body.scrollHeight;
    };

    const printPrompt = (cmd) => {
      const line = document.createElement('div');
      line.className = 'terminal-line';
      line.innerHTML = `<span class="terminal-prompt">PS</span><span class="terminal-path"> ${state.cwd.replace(/\//g, '\\')}</span><span class="terminal-prompt">&gt;</span><span class="terminal-cmd"> ${cmd}</span>`;
      body.appendChild(line);
    };

    const updatePath = () => {
      pathEl.textContent = ' ' + state.cwd.replace(/\//g, '\\');
    };

    // Welcome message
    print(`Windows PowerShell`, 'terminal-info');
    print(`Copyright (C) Microsoft Corporation. All rights reserved.`, 'terminal-output');
    print(``, 'terminal-output');
    print(`Windows 12 v${OS.version} (Build ${OS.build})`, 'terminal-success');
    print(`Type 'help' for a list of commands.`, 'terminal-output');
    print(``, 'terminal-output');

    const commands = {
      help() {
        const cmds = [
          ['help', 'Show this help message'],
          ['ls / dir', 'List directory contents'],
          ['cd <path>', 'Change directory'],
          ['pwd', 'Print working directory'],
          ['cat <file>', 'Display file contents'],
          ['echo <text>', 'Print text'],
          ['mkdir <name>', 'Create directory'],
          ['rm <name>', 'Remove file or directory'],
          ['touch <name>', 'Create empty file'],
          ['write <file> <text>', 'Write text to file'],
          ['clear / cls', 'Clear terminal'],
          ['whoami', 'Show current user'],
          ['hostname', 'Show computer name'],
          ['date', 'Show current date/time'],
          ['uptime', 'Show system uptime'],
          ['sysinfo', 'Show system information'],
          ['ps', 'List running processes'],
          ['kill <name>', 'Close an application'],
          ['open <app>', 'Open an application'],
          ['set', 'Show environment variables'],
          ['ver', 'Show OS version'],
          ['ping <host>', 'Ping a host'],
          ['calc', 'Open Calculator'],
          ['notepad', 'Open Notepad'],
          ['explorer', 'Open File Explorer'],
        ];
        print('Available commands:', 'terminal-info');
        cmds.forEach(([cmd, desc]) => {
          printHTML(`<span style="color:#4ec9b0;min-width:200px;display:inline-block">${cmd}</span><span style="color:#888"> — ${desc}</span>`);
        });
      },

      ls(args) {
        const path = args[0] ? FS.resolvePath(args[0], state.cwd) : state.cwd;
        const items = FS.ls(path);
        if (!items) { print(`ls: cannot access '${path}': No such file or directory`, 'terminal-error'); return; }
        const entries = Object.entries(items);
        if (entries.length === 0) { print('(empty)', 'terminal-output'); return; }
        entries.forEach(([name, node]) => {
          const icon = node.type === 'folder' || node.type === 'drive' ? '📁' : FS.getIcon(name, node.type);
          const color = node.type === 'folder' || node.type === 'drive' ? '#569cd6' : '#d4d4d4';
          const size = node.type === 'file' ? `<span style="color:#888;margin-left:16px">${FS.formatSize(node.size || 0)}</span>` : '';
          printHTML(`<span>${icon}</span> <span style="color:${color}">${name}</span>${size}`);
        });
      },

      dir(args) { commands.ls(args); },

      cd(args) {
        if (!args[0] || args[0] === '~') {
          state.cwd = 'C:/Users/User';
          updatePath();
          return;
        }
        const target = args[0] === '..' ? state.cwd.split('/').slice(0, -1).join('/') || 'C:' : FS.resolvePath(args[0], state.cwd);
        const node = FS.getNodeObj(target);
        if (!node || (node.type !== 'folder' && node.type !== 'drive')) {
          print(`cd: The system cannot find the path specified: '${args[0]}'`, 'terminal-error');
          return;
        }
        state.cwd = target;
        updatePath();
      },

      pwd() { print(state.cwd.replace(/\//g, '\\')); },

      cat(args) {
        if (!args[0]) { print('Usage: cat <filename>', 'terminal-error'); return; }
        const path = FS.resolvePath(args[0], state.cwd);
        const content = FS.readFile(path);
        if (content === null) { print(`cat: ${args[0]}: No such file or directory`, 'terminal-error'); return; }
        print(content || '(empty file)');
      },

      echo(args) { print(args.join(' ')); },

      mkdir(args) {
        if (!args[0]) { print('Usage: mkdir <name>', 'terminal-error'); return; }
        const path = FS.resolvePath(args[0], state.cwd);
        if (FS.mkdir(path)) print(`Directory created: ${args[0]}`, 'terminal-success');
        else print(`mkdir: Cannot create directory '${args[0]}'`, 'terminal-error');
      },

      rm(args) {
        if (!args[0]) { print('Usage: rm <name>', 'terminal-error'); return; }
        const path = FS.resolvePath(args[0], state.cwd);
        if (FS.rm(path)) print(`Removed: ${args[0]}`, 'terminal-success');
        else print(`rm: cannot remove '${args[0]}': No such file or directory`, 'terminal-error');
      },

      touch(args) {
        if (!args[0]) { print('Usage: touch <filename>', 'terminal-error'); return; }
        const path = FS.resolvePath(args[0], state.cwd);
        FS.writeFile(path, '');
        print(`Created: ${args[0]}`, 'terminal-success');
      },

      write(args) {
        if (args.length < 2) { print('Usage: write <filename> <text>', 'terminal-error'); return; }
        const path = FS.resolvePath(args[0], state.cwd);
        const text = args.slice(1).join(' ');
        FS.writeFile(path, text);
        print(`Written to ${args[0]}`, 'terminal-success');
      },

      clear() { body.innerHTML = ''; },
      cls() { body.innerHTML = ''; },

      whoami() { print(OS.username, 'terminal-info'); },
      hostname() { print(OS.hostname, 'terminal-info'); },

      date() { print(new Date().toString(), 'terminal-info'); },

      uptime() { print(`System uptime: ${OS.getUptime()}`, 'terminal-info'); },

      sysinfo() {
        const mem = OS.getMemoryUsage();
        const disk = OS.getDiskUsage();
        printHTML(`<span style="color:#4ec9b0">OS:</span> Windows 12 v${OS.version} (Build ${OS.build})`);
        printHTML(`<span style="color:#4ec9b0">User:</span> ${OS.username}@${OS.hostname}`);
        printHTML(`<span style="color:#4ec9b0">CPU:</span> Intel Core i9-14900K @ 3.2GHz (24 cores)`);
        printHTML(`<span style="color:#4ec9b0">RAM:</span> ${FS.formatSize(mem.used * 1024)} / ${FS.formatSize(mem.total * 1024)} (${mem.percent}%)`);
        printHTML(`<span style="color:#4ec9b0">Disk:</span> ${disk.used}GB / ${disk.total}GB (${disk.percent}%)`);
        printHTML(`<span style="color:#4ec9b0">GPU:</span> NVIDIA GeForce RTX 5090`);
        printHTML(`<span style="color:#4ec9b0">Uptime:</span> ${OS.getUptime()}`);
      },

      ps() {
        const procs = [
          { name: 'System', pid: 4, cpu: '0.0%', mem: '0.1 MB' },
          { name: 'explorer.exe', pid: 1234, cpu: '0.5%', mem: '45.2 MB' },
          { name: 'dwm.exe', pid: 2345, cpu: '1.2%', mem: '32.1 MB' },
          ...Object.values(WM.windows).map((w, i) => ({
            name: w.appId + '.exe',
            pid: 3000 + i,
            cpu: (Math.random() * 5).toFixed(1) + '%',
            mem: (Math.random() * 100 + 20).toFixed(1) + ' MB'
          }))
        ];
        printHTML(`<span style="color:#4ec9b0;display:inline-block;width:200px">Name</span><span style="color:#4ec9b0;display:inline-block;width:60px">PID</span><span style="color:#4ec9b0;display:inline-block;width:60px">CPU</span><span style="color:#4ec9b0">Memory</span>`);
        procs.forEach(p => {
          printHTML(`<span style="display:inline-block;width:200px">${p.name}</span><span style="color:#888;display:inline-block;width:60px">${p.pid}</span><span style="color:#dcdcaa;display:inline-block;width:60px">${p.cpu}</span><span style="color:#9cdcfe">${p.mem}</span>`);
        });
      },

      kill(args) {
        if (!args[0]) { print('Usage: kill <app-name>', 'terminal-error'); return; }
        const target = args[0].replace('.exe', '');
        const found = Object.entries(WM.windows).find(([id, w]) => w.appId === target || w.title.toLowerCase().includes(target.toLowerCase()));
        if (found) {
          WM.close(found[0]);
          print(`Terminated: ${found[1].title}`, 'terminal-success');
        } else {
          print(`kill: process not found: ${args[0]}`, 'terminal-error');
        }
      },

      open(args) {
        if (!args[0]) { print('Usage: open <app>', 'terminal-error'); return; }
        const app = args[0].toLowerCase();
        if (AppLauncher.apps[app]) {
          AppLauncher.launch(app);
          print(`Launched: ${app}`, 'terminal-success');
        } else {
          print(`open: application not found: ${app}`, 'terminal-error');
        }
      },

      set() {
        Object.entries(state.env).forEach(([k, v]) => {
          printHTML(`<span style="color:#4ec9b0">${k}</span>=<span style="color:#ce9178">${v}</span>`);
        });
      },

      ver() {
        print(`Microsoft Windows [Version 12.0.${OS.build}]`, 'terminal-info');
        print(`(c) Microsoft Corporation. All rights reserved.`, 'terminal-output');
      },

      ping(args) {
        const host = args[0] || 'localhost';
        print(`Pinging ${host} with 32 bytes of data:`, 'terminal-info');
        let count = 0;
        const interval = setInterval(() => {
          const ms = Math.floor(Math.random() * 20 + 1);
          print(`Reply from ${host}: bytes=32 time=${ms}ms TTL=128`, 'terminal-success');
          count++;
          if (count >= 4) {
            clearInterval(interval);
            print(`\nPing statistics for ${host}:`, 'terminal-info');
            print(`    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)`, 'terminal-output');
          }
        }, 500);
      },

      calc() { AppLauncher.launch('calculator'); print('Opened Calculator', 'terminal-success'); },
      notepad(args) { AppLauncher.launch('notepad', args[0] ? { path: FS.resolvePath(args[0], state.cwd) } : {}); print('Opened Notepad', 'terminal-success'); },
      explorer(args) { AppLauncher.launch('fileexplorer', args[0] ? { path: FS.resolvePath(args[0], state.cwd) } : {}); print('Opened File Explorer', 'terminal-success'); },
    };

    const execute = (cmdLine) => {
      const trimmed = cmdLine.trim();
      if (!trimmed) return;

      state.history.unshift(trimmed);
      state.histIdx = -1;

      printPrompt(trimmed);

      const parts = trimmed.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      if (commands[cmd]) {
        commands[cmd](args);
      } else {
        print(`'${parts[0]}' is not recognized as an internal or external command.`, 'terminal-error');
        print(`Type 'help' for available commands.`, 'terminal-output');
      }
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        execute(input.value);
        input.value = '';
      } else if (e.key === 'ArrowUp') {
        if (state.histIdx < state.history.length - 1) {
          state.histIdx++;
          input.value = state.history[state.histIdx];
        }
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        if (state.histIdx > 0) {
          state.histIdx--;
          input.value = state.history[state.histIdx];
        } else {
          state.histIdx = -1;
          input.value = '';
        }
        e.preventDefault();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        // Tab completion
        const partial = input.value.split(/\s+/).pop();
        const items = FS.ls(state.cwd);
        if (items) {
          const matches = Object.keys(items).filter(k => k.toLowerCase().startsWith(partial.toLowerCase()));
          if (matches.length === 1) {
            const parts = input.value.split(/\s+/);
            parts[parts.length - 1] = matches[0];
            input.value = parts.join(' ');
          }
        }
      } else if (e.ctrlKey && e.key === 'c') {
        print('^C', 'terminal-error');
        input.value = '';
      } else if (e.ctrlKey && e.key === 'l') {
        body.innerHTML = '';
        e.preventDefault();
      }
    });

    // Focus input when clicking terminal
    document.getElementById(winId).querySelector('.win-content').addEventListener('click', () => {
      input.focus();
    });

    input.focus();
  }
});
