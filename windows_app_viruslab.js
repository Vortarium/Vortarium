// ===== VIRUS SIMULATION ENGINE =====

// VirusEngine — manages all active virus state, FPS tracking, BSOD, BIOS, and effects
const VirusEngine = {
  activeVirus: null,       // current virus id (1-10) or null
  virusName: '',
  currentFps: 60,
  effectIntervals: [],     // all setInterval handles for cleanup
  effectTimeouts: [],      // all setTimeout handles for cleanup
  popupCount: 0,
  _bsodShown: false,
  _biosShown: false,
  _ransomPaid: false,

  // ── FPS tracking — measures real browser frame rate ──────────────────────
  startFpsTracking() {
    let frameTimes = [];
    let lowFpsSeconds = 0; // consecutive seconds at ≤5 fps
    let lastSecondCheck = performance.now();
    this._tabReturnFreeze = false;

    const tick = (now) => {
      frameTimes.push(now);
      const cutoff = now - 1000;
      frameTimes = frameTimes.filter(t => t > cutoff);
      this.currentFps = frameTimes.length;
      this._updateFpsDisplay();

      if (now - lastSecondCheck >= 1000) {
        lastSecondCheck = now;

        // Skip FPS crash check if tab just returned or BSOD already shown
        if (this._tabReturnFreeze || this._bsodShown) {
          lowFpsSeconds = 0;
        } else if (this.currentFps <= 5) {
          lowFpsSeconds++;
          // Trigger BSOD after 5 consecutive seconds at ≤5 fps
          if (lowFpsSeconds >= 5) {
            this._triggerBSOD();
          }
        } else {
          lowFpsSeconds = 0;
        }
      }

      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  },

  _updateFpsDisplay() {
    const el = document.getElementById('tb-fps');
    if (!el) return;
    const fps = this.currentFps;
    let color = '#4ec9b0';
    if (fps < 30) color = '#dcdcaa';
    if (fps < 15) color = '#f44747';
    if (fps <= 3)  color = '#ff0000';
    el.textContent = fps + ' FPS';
    el.style.color = color;
  },

  // ── Real FPS drop via synchronous busy-work injected each rAF ────────────
  // _lagBudgetMs: how many ms of sync work to burn per frame.
  // At 60fps each frame is ~16ms. Burning 14ms leaves ~2ms for real work → ~5fps.
  // Burning 10ms → ~15fps. Burning 6ms → ~30fps. Burning 0ms → native fps.
  _lagBudgetMs: 0,
  _lagRafId: null,

  _startFpsDrop(targetFps) {
    this._stopFpsDrop();
    if (targetFps >= 60) return;

    // Map target FPS to a busy-work budget per frame.
    // Formula: we want ~(1000/targetFps) ms per frame total.
    // Native frame is ~16ms, so we burn (frameTime - 16) extra ms.
    // Clamp so we never burn more than 95% of a frame (keeps browser alive).
    const frameMs = 1000 / Math.max(1, targetFps);
    this._lagBudgetMs = Math.min(frameMs - 16, 200); // ms of busy-work per frame

    const burnCpu = (budget) => {
      const start = performance.now();
      // Synchronous busy loop — actually blocks the main thread
      while (performance.now() - start < budget) {
        // Force layout thrash: read then write, repeat
        const el = document.getElementById('desktop');
        if (el) {
          const w = el.offsetWidth;
          el.style.setProperty('--lag-tick', (w + Math.random()).toString());
        }
      }
    };

    const lagTick = () => {
      if (this._lagBudgetMs > 0) burnCpu(this._lagBudgetMs);
      this._lagRafId = requestAnimationFrame(lagTick);
    };
    this._lagRafId = requestAnimationFrame(lagTick);
  },

  _stopFpsDrop() {
    this._lagBudgetMs = 0;
    if (this._lagRafId !== null) {
      cancelAnimationFrame(this._lagRafId);
      this._lagRafId = null;
    }
  },

  // ── BSOD ─────────────────────────────────────────────────────────────────
  _triggerBSOD() {
    if (this._bsodShown) return;
    this._bsodShown = true;
    this.currentFps = 0;
    this._updateFpsDisplay();

    // Immediately stop all lag effects and close all windows so BIOS doesn't lag
    this._stopFpsDrop();
    this.effectIntervals.forEach(h => clearInterval(h));
    this.effectIntervals = [];
    this.effectTimeouts.forEach(h => clearTimeout(h));
    this.effectTimeouts = [];
    if (typeof WM !== 'undefined') WM.closeAll();

    // Remove all virus visual overlays
    ['virus-glitch-overlay','virus-popup-container','virus-memz-overlay'].forEach(eid => {
      const el = document.getElementById(eid); if (el) el.remove();
    });
    document.querySelectorAll('.virus-popup').forEach(el => el.remove());

    // Restore desktop filter
    const desktop = document.getElementById('desktop');
    if (desktop) { desktop.style.filter = ''; desktop.style.transform = ''; }

    const bsod = document.createElement('div');
    bsod.id = 'bsod-overlay';
    bsod.innerHTML = `
      <div class="bsod-inner">
        <div class="bsod-face">:(</div>
        <div class="bsod-title">Your PC ran into a problem and needs to restart.</div>
        <div class="bsod-sub">We're just collecting some error info, and then we'll restart for you.</div>
        <div class="bsod-progress" id="bsod-pct">0% complete</div>
        <div class="bsod-code">Stop code: CRITICAL_PROCESS_DIED</div>
        <div class="bsod-code" style="margin-top:4px;font-size:11px;opacity:0.7;">What failed: virus_${this.activeVirus || 0}.exe</div>
      </div>`;
    document.body.appendChild(bsod);

    let pct = 0;
    const pctEl = document.getElementById('bsod-pct');
    const pctInterval = setInterval(() => {
      pct += Math.floor(Math.random() * 4 + 1);
      if (pct >= 100) {
        pct = 100;
        clearInterval(pctInterval);
        if (pctEl) pctEl.textContent = '100% complete';
        setTimeout(() => this._triggerBIOS(), 1200);
      } else {
        if (pctEl) pctEl.textContent = pct + '% complete';
      }
    }, 180);
  },

  // ── Fake BIOS ─────────────────────────────────────────────────────────────
  _triggerBIOS() {
    const bsod = document.getElementById('bsod-overlay');
    if (bsod) bsod.remove();

    const bios = document.createElement('div');
    bios.id = 'bios-overlay';
    bios.innerHTML = `
      <div class="bios-screen">
        <div class="bios-header">
          <span>AMI BIOS Setup Utility v2.21.1278</span>
          <span>Copyright (C) 2024 American Megatrends Inc.</span>
        </div>
        <div class="bios-body">
          <div class="bios-menu" id="bios-menu">
            <div class="bios-menu-item active" data-tab="main">Main</div>
            <div class="bios-menu-item" data-tab="advanced">Advanced</div>
            <div class="bios-menu-item" data-tab="boot">Boot</div>
            <div class="bios-menu-item" data-tab="security">Security</div>
            <div class="bios-menu-item" data-tab="exit">Exit</div>
          </div>
          <div class="bios-content" id="bios-content"></div>
        </div>
        <div class="bios-footer">
          <span>↑↓ Select Item</span>
          <span>Enter Select</span>
          <span>F10 Save &amp; Exit</span>
          <span>ESC Exit</span>
          <span style="margin-left:auto;color:#ff0;">Press F10 to continue booting</span>
        </div>
      </div>`;
    document.body.appendChild(bios);
    this._biosShown = true;

    const tabs = {
      main: `
        <div class="bios-row"><span>System Date</span><span id="bios-date">${new Date().toLocaleDateString()}</span></div>
        <div class="bios-row"><span>System Time</span><span id="bios-time">${new Date().toLocaleTimeString()}</span></div>
        <div class="bios-row"><span>BIOS Version</span><span>2.21.1278</span></div>
        <div class="bios-row"><span>Processor</span><span>Intel Core i9-14900K @ 3.20GHz</span></div>
        <div class="bios-row"><span>Total Memory</span><span>16384 MB DDR5</span></div>
        <div class="bios-row"><span>Platform</span><span>Windows 12 Simulation</span></div>
        <div class="bios-row bios-highlight"><span>Last Crash Reason</span><span style="color:#f44">CRITICAL_PROCESS_DIED</span></div>`,
      advanced: `
        <div class="bios-row"><span>CPU Overclocking</span><span class="bios-toggle" data-key="oc">Disabled</span></div>
        <div class="bios-row"><span>Hyper-Threading</span><span class="bios-toggle" data-key="ht">Enabled</span></div>
        <div class="bios-row"><span>Virtualization (VT-x)</span><span class="bios-toggle" data-key="vt">Enabled</span></div>
        <div class="bios-row"><span>Secure Boot</span><span class="bios-toggle" data-key="sb">Enabled</span></div>
        <div class="bios-row"><span>Fast Boot</span><span class="bios-toggle" data-key="fb">Enabled</span></div>
        <div class="bios-row"><span>USB Legacy Support</span><span class="bios-toggle" data-key="usb">Enabled</span></div>`,
      boot: `
        <div class="bios-row bios-highlight"><span>Boot Device Priority</span><span></span></div>
        <div class="bios-row" style="padding-left:24px"><span>1st Boot Device</span><span>Windows Boot Manager</span></div>
        <div class="bios-row" style="padding-left:24px"><span>2nd Boot Device</span><span>USB Drive</span></div>
        <div class="bios-row" style="padding-left:24px"><span>3rd Boot Device</span><span>Network PXE</span></div>
        <div class="bios-row"><span>Boot Timeout</span><span>3 seconds</span></div>`,
      security: `
        <div class="bios-row"><span>Supervisor Password</span><span>Not Installed</span></div>
        <div class="bios-row"><span>User Password</span><span>Not Installed</span></div>
        <div class="bios-row"><span>TPM Device</span><span>Enabled</span></div>
        <div class="bios-row"><span>Secure Boot State</span><span style="color:#4ec9b0">Active</span></div>`,
      exit: `
        <div class="bios-row bios-btn" id="bios-save-exit">Save Changes and Exit (F10)</div>
        <div class="bios-row bios-btn" id="bios-discard-exit">Discard Changes and Exit</div>
        <div class="bios-row bios-btn" id="bios-load-defaults">Load Optimized Defaults</div>`,
    };

    const biosContent = document.getElementById('bios-content');
    const biosMenu = document.getElementById('bios-menu');
    let activeTab = 'main';
    const renderTab = (tab) => {
      biosContent.innerHTML = tabs[tab] || '';
      biosMenu.querySelectorAll('.bios-menu-item').forEach(el => {
        el.classList.toggle('active', el.dataset.tab === tab);
      });
      // Toggle buttons
      biosContent.querySelectorAll('.bios-toggle').forEach(el => {
        el.addEventListener('click', () => {
          el.textContent = el.textContent === 'Enabled' ? 'Disabled' : 'Enabled';
          el.style.color = el.textContent === 'Enabled' ? '#4ec9b0' : '#f44747';
        });
      });
      // Exit buttons
      const saveExit = document.getElementById('bios-save-exit');
      const discardExit = document.getElementById('bios-discard-exit');
      const loadDef = document.getElementById('bios-load-defaults');
      if (saveExit) saveExit.addEventListener('click', () => this._biosExit());
      if (discardExit) discardExit.addEventListener('click', () => this._biosExit());
      if (loadDef) loadDef.addEventListener('click', () => {
        Notifications.send('BIOS', 'Optimized defaults loaded.', '⚙️');
      });
    };
    renderTab('main');

    biosMenu.querySelectorAll('.bios-menu-item').forEach(el => {
      el.addEventListener('click', () => { activeTab = el.dataset.tab; renderTab(activeTab); });
    });

    // F10 exits BIOS
    const biosKeyHandler = (e) => {
      if (e.key === 'F10') { e.preventDefault(); this._biosExit(); document.removeEventListener('keydown', biosKeyHandler); }
    };
    document.addEventListener('keydown', biosKeyHandler);

    // Update time in BIOS
    setInterval(() => {
      const t = document.getElementById('bios-time');
      if (t) t.textContent = new Date().toLocaleTimeString();
    }, 1000);
  },

  _biosExit() {
    const bios = document.getElementById('bios-overlay');
    if (bios) bios.remove();
    this._doRestart();
  },

  // ── Restart logic ─────────────────────────────────────────────────────────
  _doRestart() {
    this._bsodShown = false;
    this._biosShown = false;
    this.stopVirus();

    // Close all open windows on restart
    if (typeof WM !== 'undefined') WM.closeAll();

    const overlay = document.getElementById('power-overlay');
    const msg = document.getElementById('power-message');
    if (overlay && msg) {
      overlay.classList.remove('hidden');
      msg.textContent = 'Restarting...';
    }

    setTimeout(() => {
      if (overlay) overlay.classList.add('hidden');
      LockScreen.lock();
      // Re-check if a persistent virus should auto-relaunch
      const savedVirus = parseInt(localStorage.getItem('win12_active_virus') || '0');
      if (savedVirus >= 6 && savedVirus <= 8) {
        setTimeout(() => {
          if (!this.activeVirus) {
            Notifications.send('System', 'Startup process initializing...', '⚙️');
            setTimeout(() => this.infectWith(savedVirus), 3000);
          }
        }, 10000);
      } else if (savedVirus >= 9) {
        setTimeout(() => this.infectWith(savedVirus), 800);
      } else {
        localStorage.removeItem('win12_active_virus');
      }
    }, 2500);
  },

  // ── Stop all virus effects ────────────────────────────────────────────────
  stopVirus() {
    this.effectIntervals.forEach(h => clearInterval(h));
    this.effectTimeouts.forEach(h => clearTimeout(h));
    this.effectIntervals = [];
    this.effectTimeouts = [];
    this._stopFpsDrop();
    this.activeVirus = null;
    this.virusName = '';
    this.popupCount = 0;

    // Remove all virus overlays/elements
    ['virus-glitch-overlay','virus-popup-container','virus-ransom-overlay',
     'virus-trojan-overlay','virus-memz-overlay'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    document.querySelectorAll('.virus-popup').forEach(el => el.remove());
    document.querySelectorAll('.virus-glitch-text').forEach(el => el.remove());

    // Clean up virus 3 keyboard handler
    if (this._virus3Cleanup) { this._virus3Cleanup(); this._virus3Cleanup = null; }

    // Restore desktop
    document.getElementById('desktop').style.filter = '';
    document.getElementById('desktop').style.transform = '';
    document.getElementById('desktop').style.animation = '';
    document.body.style.filter = `brightness(${(OS.settings.brightness||100)/100})`;

    // Restore all window titles/content from corruption
    document.querySelectorAll('.win-title').forEach(el => {
      if (el.dataset.originalTitle) {
        el.textContent = el.dataset.originalTitle;
        delete el.dataset.originalTitle;
      }
    });
    document.querySelectorAll('.win-content').forEach(el => {
      el.style.filter = '';
      el.style.transform = '';
    });
  },

  // ── Main infection entry point ────────────────────────────────────────────
  infectWith(virusId) {
    if (this.activeVirus) this.stopVirus();
    this.activeVirus = virusId;
    localStorage.setItem('win12_active_virus', virusId);

    const names = {
      1: 'FPSDropper.exe',
      2: 'ScreenJitter.exe',
      3: 'SlowType.exe',
      4: 'ColorShift.exe',
      5: 'CursorDrift.exe',
      6: 'PopupStorm.exe',
      7: 'WindowSpam.exe',
      8: 'ScreenFlash.exe',
      9: 'CryptoWall.exe',
      10: 'MEMZ.exe',
    };
    this.virusName = names[virusId] || 'unknown.exe';

    Notifications.send('⚠️ Security Alert', `Threat detected: ${this.virusName}`, '🦠');

    switch (virusId) {
      case 1: this._virus1_FpsDrop(); break;
      case 2: this._virus2_ScreenJitter(); break;
      case 3: this._virus3_SlowType(); break;
      case 4: this._virus4_ColorShift(); break;
      case 5: this._virus5_CursorDrift(); break;
      case 6: this._virus6_PopupStorm(); break;
      case 7: this._virus7_WindowSpam(); break;
      case 8: this._virus8_ScreenFlash(); break;
      case 9: this._virus9_CryptoWall(); break;
      case 10: this._virus10_MEMZ(); break;
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TIER 1 — MILD VIRUSES (1–5)
  // ══════════════════════════════════════════════════════════════════════════

  // Virus 1: FPS Dropper — tanks FPS to ~25, slight screen blur
  _virus1_FpsDrop() {
    this._startFpsDrop(25);
    const h = setInterval(() => {
      const desktop = document.getElementById('desktop');
      if (desktop) desktop.style.filter = `blur(${(Math.random()*0.6).toFixed(2)}px) brightness(0.97)`;
    }, 800);
    this.effectIntervals.push(h);
    Notifications.send('System', 'Performance degradation detected.', '⚠️');
  },

  // Virus 2: Screen Jitter — random micro-shakes of the desktop
  _virus2_ScreenJitter() {
    this._startFpsDrop(35);
    const h = setInterval(() => {
      const desktop = document.getElementById('desktop');
      if (!desktop) return;
      const x = (Math.random() * 4 - 2).toFixed(1);
      const y = (Math.random() * 4 - 2).toFixed(1);
      desktop.style.transform = `translate(${x}px, ${y}px)`;
      setTimeout(() => { if (desktop) desktop.style.transform = ''; }, 80);
    }, 600);
    this.effectIntervals.push(h);
  },

  // Virus 3: SlowType — adds random characters to focused inputs
  _virus3_SlowType() {
    this._startFpsDrop(40);
    const junkChars = '!@#$%^&*~`|\\';
    const handler = (e) => {
      if (Math.random() < 0.25 && e.target.tagName === 'INPUT') {
        const pos = e.target.selectionStart;
        const val = e.target.value;
        const junk = junkChars[Math.floor(Math.random() * junkChars.length)];
        e.target.value = val.slice(0, pos) + junk + val.slice(pos);
        e.target.setSelectionRange(pos + 1, pos + 1);
      }
    };
    document.addEventListener('keyup', handler);
    this._virus3Handler = handler;
    this._virus3Cleanup = () => document.removeEventListener('keyup', handler);
  },

  // Virus 4: Color Shift — slowly rotates hue of the entire desktop
  _virus4_ColorShift() {
    this._startFpsDrop(45);
    let hue = 0;
    const h = setInterval(() => {
      hue = (hue + 2) % 360;
      document.getElementById('desktop').style.filter = `hue-rotate(${hue}deg) brightness(0.95)`;
    }, 100);
    this.effectIntervals.push(h);
  },

  // Virus 5: Cursor Drift — randomly moves open windows slightly
  _virus5_CursorDrift() {
    this._startFpsDrop(42);
    const h = setInterval(() => {
      const wins = Object.keys(WM.windows);
      if (wins.length === 0) return;
      const winId = wins[Math.floor(Math.random() * wins.length)];
      const el = document.getElementById(winId);
      if (!el || WM.windows[winId]?.minimized || WM.windows[winId]?.maximized) return;
      const dx = Math.floor(Math.random() * 10 - 5);
      const dy = Math.floor(Math.random() * 10 - 5);
      const curLeft = parseInt(el.style.left) || 0;
      const curTop = parseInt(el.style.top) || 0;
      el.style.left = Math.max(0, Math.min(window.innerWidth - 200, curLeft + dx)) + 'px';
      el.style.top = Math.max(0, Math.min(window.innerHeight - 100, curTop + dy)) + 'px';
    }, 500);
    this.effectIntervals.push(h);
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TIER 2 — MEDIUM VIRUSES (6–8)
  // ══════════════════════════════════════════════════════════════════════════

  // Virus 6: Popup Storm — spawns annoying popups every 2 seconds, tanks FPS
  _virus6_PopupStorm() {
    this._startFpsDrop(10); // real lag: ~10fps
    const container = document.createElement('div');
    container.id = 'virus-popup-container';
    document.body.appendChild(container);

    const messages = [
      '⚠️ YOUR COMPUTER IS INFECTED!', '🔴 CRITICAL ERROR: DISK FAILURE',
      '💀 VIRUS DETECTED — ACT NOW', '🚨 HACKER ALERT: 47 THREATS FOUND',
      '🔥 SYSTEM MELTDOWN IMMINENT', '💣 MALWARE SPREADING TO ALL FILES',
      '⛔ WINDOWS LICENSE EXPIRED', '📛 YOUR DATA IS BEING STOLEN',
      '🆘 CALL MICROSOFT SUPPORT NOW', '☠️ RANSOMWARE DETECTED',
    ];

    const spawnPopup = () => {
      if (this.popupCount > 40) return; // cap at 40 popups
      this.popupCount++;
      const popup = document.createElement('div');
      popup.className = 'virus-popup';
      const msg = messages[Math.floor(Math.random() * messages.length)];
      const x = Math.floor(Math.random() * (window.innerWidth - 320));
      const y = Math.floor(Math.random() * (window.innerHeight - 160));
      popup.style.cssText = `left:${x}px;top:${y}px;`;
      popup.innerHTML = `
        <div class="vp-title">⚠️ Security Warning</div>
        <div class="vp-body">${msg}</div>
        <div class="vp-footer">
          <button class="vp-btn vp-ok" onclick="this.closest('.virus-popup').remove();VirusEngine.popupCount=Math.max(0,VirusEngine.popupCount-1)">OK</button>
          <button class="vp-btn vp-cancel" onclick="this.closest('.virus-popup').remove();VirusEngine.popupCount=Math.max(0,VirusEngine.popupCount-1)">Cancel</button>
        </div>`;
      document.body.appendChild(popup);
      // Make it draggable
      let dragging = false, ox = 0, oy = 0;
      popup.querySelector('.vp-title').addEventListener('mousedown', e => {
        dragging = true; ox = e.clientX - popup.offsetLeft; oy = e.clientY - popup.offsetTop;
      });
      document.addEventListener('mousemove', e => {
        if (!dragging) return;
        popup.style.left = (e.clientX - ox) + 'px';
        popup.style.top = (e.clientY - oy) + 'px';
      });
      document.addEventListener('mouseup', () => { dragging = false; });
    };

    spawnPopup();
    const h = setInterval(spawnPopup, 2000);
    this.effectIntervals.push(h);
  },

  // Virus 7: Window Spam — opens random app windows repeatedly, tanks FPS hard
  _virus7_WindowSpam() {
    this._startFpsDrop(6); // real lag: ~6fps
    const apps = ['notepad','calculator','browser','fileexplorer','terminal','paint'];
    let count = 0;
    const h = setInterval(() => {
      if (count >= 12) return;
      count++;
      const app = apps[Math.floor(Math.random() * apps.length)];
      AppLauncher.launch(app);
      // Also jitter all windows
      Object.keys(WM.windows).forEach(winId => {
        const el = document.getElementById(winId);
        if (!el || WM.windows[winId]?.maximized) return;
        el.style.left = Math.floor(Math.random() * (window.innerWidth - 400)) + 'px';
        el.style.top = Math.floor(Math.random() * (window.innerHeight - 300)) + 'px';
      });
    }, 3000);
    this.effectIntervals.push(h);

    // Also add popup storm on top
    this._virus6_PopupStorm();
  },

  // Virus 8: Screen Flash — strobes the screen, inverts colors, heavy FPS drop
  _virus8_ScreenFlash() {
    this._startFpsDrop(4); // real lag: ~4fps — will BSOD after ~3 sustained seconds
    let phase = 0;
    const effects = [
      'invert(1)', 'invert(1) hue-rotate(90deg)', 'invert(0) brightness(3)',
      'invert(1) saturate(5)', 'hue-rotate(180deg) contrast(3)', 'invert(0)',
    ];
    const h = setInterval(() => {
      const desktop = document.getElementById('desktop');
      if (!desktop) return;
      desktop.style.filter = effects[phase % effects.length];
      phase++;
    }, 200);
    this.effectIntervals.push(h);

    // Spawn popups too
    this._virus6_PopupStorm();

    // Scramble window titles
    const titleH = setInterval(() => {
      document.querySelectorAll('.win-title').forEach(el => {
        if (!el.dataset.originalTitle) el.dataset.originalTitle = el.textContent;
        const chars = '!@#$%^&*<>?/\\|~`';
        el.textContent = Array.from({length: 8}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
      });
    }, 400);
    this.effectIntervals.push(titleH);
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TIER 3 — SEVERE VIRUSES (9–10)
  // ══════════════════════════════════════════════════════════════════════════

  // Virus 9: CryptoWall — fake ransomware, encrypts VFS filenames, shows ransom screen
  _virus9_CryptoWall() {
    this._startFpsDrop(15); // moderate lag during encryption phase

    // "Encrypt" all VFS files (scramble their names in the tree)
    this._encryptVFS();

    // Show ransom screen after a short "encrypting" phase
    const encryptingOverlay = document.createElement('div');
    encryptingOverlay.id = 'virus-ransom-overlay';
    encryptingOverlay.innerHTML = `
      <div class="ransom-encrypting" id="ransom-encrypting">
        <div style="font-size:48px;margin-bottom:16px;">🔒</div>
        <div style="font-size:22px;font-weight:700;color:#f44;">ENCRYPTING YOUR FILES...</div>
        <div style="margin-top:12px;font-size:13px;color:#aaa;">Do not turn off your computer</div>
        <div class="ransom-bar-wrap"><div class="ransom-bar-fill" id="ransom-enc-bar"></div></div>
        <div id="ransom-enc-pct" style="margin-top:8px;font-size:12px;color:#aaa;">0%</div>
      </div>`;
    document.body.appendChild(encryptingOverlay);

    let pct = 0;
    const barEl = document.getElementById('ransom-enc-bar');
    const pctEl = document.getElementById('ransom-enc-pct');
    const encInterval = setInterval(() => {
      pct += Math.floor(Math.random() * 5 + 2);
      if (pct >= 100) {
        pct = 100;
        clearInterval(encInterval);
        if (barEl) barEl.style.width = '100%';
        if (pctEl) pctEl.textContent = '100%';
        setTimeout(() => this._showRansomScreen(), 800);
      } else {
        if (barEl) barEl.style.width = pct + '%';
        if (pctEl) pctEl.textContent = pct + '%';
      }
    }, 120);
    this.effectIntervals.push(encInterval);
  },

  _encryptVFS() {
    const scramble = (name) => {
      const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
      const base = Array.from({length: 12}, () => '0123456789abcdef'[Math.floor(Math.random()*16)]).join('');
      return base + (ext ? '.locked' : '');
    };
    const walkAndEncrypt = (node) => {
      if (!node || !node.children) return;
      const keys = Object.keys(node.children);
      keys.forEach(key => {
        const child = node.children[key];
        if (child.type === 'file') {
          const newKey = scramble(key);
          node.children[newKey] = { ...child, content: btoa(child.content || '').slice(0, 40) + '==[ENCRYPTED]' };
          delete node.children[key];
        } else if (child.type === 'folder') {
          walkAndEncrypt(child);
        }
      });
    };
    walkAndEncrypt(FS.tree['C:']);
    OS.saveVFS();
  },

  _showRansomScreen() {
    const overlay = document.getElementById('virus-ransom-overlay');
    if (overlay) overlay.remove();

    let timeLeft = 72 * 3600; // 72 hours in seconds
    const ransom = document.createElement('div');
    ransom.id = 'virus-ransom-overlay';
    ransom.innerHTML = `
      <div class="ransom-screen">
        <div class="ransom-skull">💀</div>
        <div class="ransom-title">YOUR FILES HAVE BEEN ENCRYPTED</div>
        <div class="ransom-sub">All your documents, photos, databases and other important files have been encrypted with military-grade AES-256 encryption.</div>
        <div class="ransom-timer-label">Time remaining to pay:</div>
        <div class="ransom-timer" id="ransom-timer">72:00:00</div>
        <div class="ransom-amount">Send <span style="color:#f90;font-weight:700;">0.5 BTC</span> to the following address:</div>
        <div class="ransom-address">1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf<span style="color:#888">Na</span></div>
        <div class="ransom-btns">
          <button class="ransom-btn ransom-pay" id="ransom-pay-btn">💳 I HAVE PAID</button>
          <button class="ransom-btn ransom-ignore" id="ransom-ignore-btn">❌ Ignore (files will be deleted)</button>
        </div>
        <div class="ransom-note" id="ransom-note"></div>
      </div>`;
    document.body.appendChild(ransom);

    // Countdown timer
    const timerEl = document.getElementById('ransom-timer');
    const timerH = setInterval(() => {
      timeLeft = Math.max(0, timeLeft - 1);
      const h = Math.floor(timeLeft / 3600);
      const m = Math.floor((timeLeft % 3600) / 60);
      const s = timeLeft % 60;
      if (timerEl) timerEl.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      if (timeLeft === 0) {
        clearInterval(timerH);
        if (timerEl) timerEl.textContent = '00:00:00';
        if (timerEl) timerEl.style.color = '#f00';
      }
    }, 1000);
    this.effectIntervals.push(timerH);

    // Pay button — triggers corrupted desktop
    document.getElementById('ransom-pay-btn').addEventListener('click', () => {
      const note = document.getElementById('ransom-note');
      if (note) note.innerHTML = '<span style="color:#4ec9b0">✓ Payment received. Decrypting...</span>';
      setTimeout(() => {
        ransom.remove();
        this._triggerCorruptedDesktop();
      }, 2000);
    });

    // Ignore button — just shows a warning
    document.getElementById('ransom-ignore-btn').addEventListener('click', () => {
      const note = document.getElementById('ransom-note');
      if (note) note.innerHTML = '<span style="color:#f44">⚠️ Ignoring will result in permanent file deletion. This is your final warning.</span>';
    });
  },

  _triggerCorruptedDesktop() {
    this._ransomPaid = true;
    // Corrupt all desktop icons text
    document.querySelectorAll('.desktop-icon span').forEach(el => {
      el.textContent = this._corruptText(el.textContent);
    });
    // Corrupt taskbar labels
    document.querySelectorAll('.tb-label').forEach(el => {
      el.textContent = this._corruptText(el.textContent);
    });
    // Corrupt window titles
    document.querySelectorAll('.win-title').forEach(el => {
      if (!el.dataset.originalTitle) el.dataset.originalTitle = el.textContent;
      el.textContent = this._corruptText(el.textContent);
    });
    // Break all buttons (make them do nothing / show garbage)
    document.querySelectorAll('button').forEach(btn => {
      if (btn.id === 'ransom-pay-btn' || btn.id === 'ransom-ignore-btn') return;
      const orig = btn.onclick;
      btn.addEventListener('click', (e) => {
        e.stopImmediatePropagation();
        btn.textContent = this._corruptText(btn.textContent || '???');
        return false;
      }, true);
    });
    // Apply heavy visual corruption
    document.getElementById('desktop').style.filter = 'hue-rotate(180deg) contrast(1.5) saturate(3)';
    document.body.style.fontFamily = 'monospace';

    // Corrupt all open window content
    document.querySelectorAll('.win-content').forEach(el => {
      el.style.filter = 'invert(1) hue-rotate(90deg)';
    });

    // Show "corrupted" overlay message
    const corruptMsg = document.createElement('div');
    corruptMsg.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(0,0,0,0.9);border:2px solid #f00;border-radius:8px;padding:24px 32px;
      z-index:99998;text-align:center;font-family:monospace;`;
    corruptMsg.innerHTML = `
      <div style="font-size:32px;color:#f00;font-weight:700;">${this._corruptText('SYSTEM CORRUPTED')}</div>
      <div style="margin-top:12px;color:#aaa;font-size:13px;">${this._corruptText('All files have been permanently damaged.')}</div>
      <div style="margin-top:8px;color:#666;font-size:11px;">${this._corruptText('Error code: 0xDEADBEEF')}</div>`;
    document.body.appendChild(corruptMsg);

    // Keep re-corrupting text every second
    const corruptH = setInterval(() => {
      document.querySelectorAll('.win-title, .tb-label, .desktop-icon span').forEach(el => {
        if (Math.random() < 0.3) el.textContent = this._corruptText(el.textContent);
      });
    }, 1200);
    this.effectIntervals.push(corruptH);
  },

  _corruptText(text) {
    const garbage = '█▓▒░▄▀■□▪▫◘○●◙♦♣♠♥♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼';
    return Array.from(text).map(c => {
      if (c === ' ') return ' ';
      return Math.random() < 0.6 ? garbage[Math.floor(Math.random() * garbage.length)] : c;
    }).join('');
  },

  // Virus 10: MEMZ — maximum chaos, opens every app repeatedly, emoji spam, fast flashing
  _virus10_MEMZ() {
    this._startFpsDrop(50); // Phase 1: barely noticeable

    Notifications.send('System', 'Background service started.', '⚙️');

    // Sound effects for MEMZ
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const playScarySound = (frequency, duration, type = 'sawtooth') => {
      try {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.5, audioCtx.currentTime + duration);
        
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + duration);
      } catch(e) {}
    };

    const EMOJIS = ['💀','🔥','☠️','👾','🦠','💣','⚡','🌈','🎉','🤡','👻','🎃','🌀','💥','🚨'];
    const ALL_APPS = ['notepad','calculator','browser','fileexplorer','terminal','paint','taskmanager','calendar','settings'];

    // Phase 2 (3s): Jitter + color shift + start opening apps + occasional sounds
    const t1 = setTimeout(() => {
      this._startFpsDrop(25);
      this._virus2_ScreenJitter();
      this._virus4_ColorShift();

      // Occasional scary sounds
      const soundH1 = setInterval(() => {
        if (!this.activeVirus) { clearInterval(soundH1); return; }
        if (Math.random() < 0.3) {
          playScarySound(200 + Math.random() * 400, 0.2, 'sawtooth');
        }
      }, 1000);
      this.effectIntervals.push(soundH1);

      // Start opening every app repeatedly
      let appIdx = 0;
      const appSpamH = setInterval(() => {
        if (!this.activeVirus) { clearInterval(appSpamH); return; }
        AppLauncher.launch(ALL_APPS[appIdx % ALL_APPS.length]);
        appIdx++;
        // Also open a second app
        AppLauncher.launch(ALL_APPS[(appIdx + 3) % ALL_APPS.length]);
      }, 800);
      this.effectIntervals.push(appSpamH);
    }, 3000);
    this.effectTimeouts.push(t1);

    // Phase 3 (8s): Popup storm + emoji rain + heavier lag + more frequent sounds
    const t2 = setTimeout(() => {
      this._startFpsDrop(10);
      this._virus6_PopupStorm();

      // More frequent scary sounds
      const soundH2 = setInterval(() => {
        if (!this.activeVirus) { clearInterval(soundH2); return; }
        if (Math.random() < 0.5) {
          playScarySound(100 + Math.random() * 600, 0.3, Math.random() < 0.5 ? 'sawtooth' : 'square');
        }
      }, 500);
      this.effectIntervals.push(soundH2);

      // Emoji rain — spawn emojis flying across screen
      const emojiRainH = setInterval(() => {
        if (!this.activeVirus) { clearInterval(emojiRainH); return; }
        for (let i = 0; i < 5; i++) {
          const em = document.createElement('div');
          em.style.cssText = `position:fixed;left:${Math.random()*100}vw;top:-40px;font-size:${24+Math.random()*32}px;z-index:99990;pointer-events:none;transition:top ${0.5+Math.random()*1.5}s linear;`;
          em.textContent = EMOJIS[Math.floor(Math.random()*EMOJIS.length)];
          document.body.appendChild(em);
          requestAnimationFrame(() => { em.style.top = '110vh'; });
          setTimeout(() => em.remove(), 2500);
        }
      }, 200);
      this.effectIntervals.push(emojiRainH);

      // Move all windows chaotically
      const winMoveH = setInterval(() => {
        Object.keys(WM.windows).forEach(winId => {
          const el = document.getElementById(winId);
          if (el && !WM.windows[winId]?.maximized) {
            el.style.left = Math.floor(Math.random() * Math.max(100, window.innerWidth - 300)) + 'px';
            el.style.top = Math.floor(Math.random() * Math.max(100, window.innerHeight - 200)) + 'px';
          }
        });
      }, 300);
      this.effectIntervals.push(winMoveH);
    }, 8000);
    this.effectTimeouts.push(t2);

    // Phase 4 (15s): Full screen chaos + severe lag + MEMZ overlay + constant loud scary noises
    const t3 = setTimeout(() => {
      this._startFpsDrop(4);
      
      // Constant loud scary noises at different rates
      const soundH3 = setInterval(() => {
        if (!this.activeVirus) { clearInterval(soundH3); return; }
        // Play multiple overlapping sounds for chaos effect
        playScarySound(50 + Math.random() * 800, 0.1, 'sawtooth');
        if (Math.random() < 0.7) {
          setTimeout(() => playScarySound(100 + Math.random() * 500, 0.15, 'square'), 50);
        }
        if (Math.random() < 0.4) {
          setTimeout(() => playScarySound(200 + Math.random() * 300, 0.2, 'triangle'), 100);
        }
      }, 150);
      this.effectIntervals.push(soundH3);

      let phase = 0;
      const chaosEffects = [
        'invert(1)', 'hue-rotate(90deg) saturate(5)', 'invert(1) hue-rotate(180deg)',
        'contrast(5) brightness(0.3)', 'sepia(1) hue-rotate(270deg)', 'invert(0) brightness(3)',
        'hue-rotate(45deg) contrast(3)', 'invert(1) saturate(8)', 'brightness(0.1)',
      ];
      const chaosH = setInterval(() => {
        const desktop = document.getElementById('desktop');
        if (desktop) desktop.style.filter = chaosEffects[phase % chaosEffects.length];
        phase++;
        // Open more apps
        if (Math.random() < 0.5) AppLauncher.launch(ALL_APPS[Math.floor(Math.random()*ALL_APPS.length)]);
        // Teleport windows
        Object.keys(WM.windows).forEach(winId => {
          const el = document.getElementById(winId);
          if (el && !WM.windows[winId]?.maximized) {
            el.style.left = Math.floor(Math.random() * Math.max(50, window.innerWidth - 300)) + 'px';
            el.style.top = Math.floor(Math.random() * Math.max(50, window.innerHeight - 200)) + 'px';
          }
        });
      }, 100); // Very fast flashing
      this.effectIntervals.push(chaosH);

      // Scramble all text rapidly
      const textH = setInterval(() => {
        document.querySelectorAll('.win-title, .tb-label, .desktop-icon span').forEach(el => {
          if (!el.dataset.originalTitle) el.dataset.originalTitle = el.textContent;
          el.textContent = this._corruptText(el.textContent);
        });
      }, 150);
      this.effectIntervals.push(textH);

      // Massive popup spam
      const megaPopupH = setInterval(() => {
        if (this.popupCount < 80) {
          this.popupCount++;
          const popup = document.createElement('div');
          popup.className = 'virus-popup';
          const x = Math.floor(Math.random() * (window.innerWidth - 320));
          const y = Math.floor(Math.random() * (window.innerHeight - 160));
          popup.style.cssText = `left:${x}px;top:${y}px;`;
          popup.innerHTML = `<div class="vp-title">☠️ MEMZ</div><div class="vp-body">${EMOJIS[Math.floor(Math.random()*EMOJIS.length)]} SYSTEM DESTROYED ${EMOJIS[Math.floor(Math.random()*EMOJIS.length)]}</div><div class="vp-footer"><button class="vp-btn vp-ok" onclick="this.closest('.virus-popup').remove()">OK</button></div>`;
          document.body.appendChild(popup);
        }
      }, 300);
      this.effectIntervals.push(megaPopupH);

      // MEMZ overlay
      const memz = document.createElement('div');
      memz.id = 'virus-memz-overlay';
      memz.innerHTML = `
        <div class="memz-inner">
          <div class="memz-title">MEMZ</div>
          <div class="memz-sub">Your computer has been infected by MEMZ.</div>
          <div class="memz-sub" style="margin-top:8px;font-size:12px;color:#aaa;">Do not try to close or restart your computer.</div>
          <div class="memz-sub" style="margin-top:4px;font-size:12px;color:#aaa;">It will only make things worse.</div>
          <div class="memz-nyan" id="memz-nyan">🌈🐱</div>
        </div>`;
      document.body.appendChild(memz);

      // Nyan cat animation — fast
      let nyanPos = 0;
      const nyanH = setInterval(() => {
        const nyan = document.getElementById('memz-nyan');
        if (nyan) {
          nyanPos = (nyanPos + 15) % window.innerWidth;
          nyan.style.left = nyanPos + 'px';
          nyan.style.top = Math.floor(Math.random() * (window.innerHeight - 60)) + 'px';
        }
      }, 16);
      this.effectIntervals.push(nyanH);

    }, 15000);
    this.effectTimeouts.push(t3);

    // Phase 5 (28s): Maximum lag — sustained ≤5fps for 5s triggers BSOD
    const t4 = setTimeout(() => {
      this._startFpsDrop(2); // ~2fps — BSOD will fire after 5 sustained seconds
      // Open every single app at once
      ALL_APPS.forEach(app => AppLauncher.launch(app));
      ALL_APPS.forEach(app => AppLauncher.launch(app));
    }, 28000);
    this.effectTimeouts.push(t4);
  },

  // ── Virus process list (for Task Manager integration) ─────────────────────
  getVirusProcesses() {
    if (!this.activeVirus) return [];
    const virusProcesses = {
      1: [{ name: 'fpsdropper.exe', pid: 9001, cpu: 18.4, mem: 42.1 }],
      2: [{ name: 'screenjitter.exe', pid: 9002, cpu: 22.1, mem: 38.7 }],
      3: [{ name: 'slowtype.exe', pid: 9003, cpu: 15.3, mem: 29.4 }],
      4: [{ name: 'colorshift.exe', pid: 9004, cpu: 19.8, mem: 35.2 }],
      5: [{ name: 'cursordrift.exe', pid: 9005, cpu: 16.7, mem: 31.9 }],
      6: [
        { name: 'popupstorm.exe', pid: 9006, cpu: 45.2, mem: 128.4 },
        { name: 'adware_helper.exe', pid: 9061, cpu: 12.1, mem: 44.2 },
      ],
      7: [
        { name: 'windowspam.exe', pid: 9007, cpu: 67.8, mem: 256.1 },
        { name: 'popupstorm.exe', pid: 9006, cpu: 45.2, mem: 128.4 },
        { name: 'spawn_worker.exe', pid: 9071, cpu: 23.4, mem: 88.6 },
      ],
      8: [
        { name: 'screenflash.exe', pid: 9008, cpu: 78.3, mem: 312.7 },
        { name: 'popupstorm.exe', pid: 9006, cpu: 45.2, mem: 128.4 },
        { name: 'inject32.exe', pid: 9081, cpu: 34.1, mem: 96.3 },
      ],
      9: [
        { name: 'cryptowall.exe', pid: 9009, cpu: 55.6, mem: 198.4 },
        { name: 'encrypt_worker.exe', pid: 9091, cpu: 88.2, mem: 412.1 },
        { name: 'c2_beacon.exe', pid: 9092, cpu: 4.1, mem: 18.7 },
      ],
      10: [
        { name: 'memz.exe', pid: 9010, cpu: 91.4, mem: 512.8 },
        { name: 'chaos_engine.exe', pid: 9101, cpu: 76.3, mem: 384.2 },
        { name: 'nyan_payload.exe', pid: 9102, cpu: 44.7, mem: 156.9 },
        { name: 'rootkit_loader.exe', pid: 9103, cpu: 12.3, mem: 64.1 },
      ],
    };
    return (virusProcesses[this.activeVirus] || []).map(p => ({
      ...p,
      cpu: parseFloat((p.cpu + (Math.random() * 6 - 3)).toFixed(1)),
      mem: parseFloat((p.mem + (Math.random() * 10 - 5)).toFixed(1)),
      type: 'Virus',
      status: 'Running',
      isVirus: true,
    }));
  },

  // Kill a virus process by pid — only kills all if it's the main process
  killProcess(pid) {
    const mainPids = { 9001:1, 9002:2, 9003:3, 9004:4, 9005:5, 9006:6, 9007:7, 9008:8, 9009:9, 9010:10 };
    if (mainPids[pid] !== undefined) {
      const virusId = mainPids[pid];
      if (virusId === this.activeVirus) {
        this.stopVirus();
        localStorage.removeItem('win12_active_virus');
        Notifications.send('Task Manager', `${this.virusName || 'Virus'} process terminated.`, '✅');
        return true;
      }
    }
    // Worker process — just show it was killed but virus continues
    Notifications.send('Task Manager', 'Worker process terminated. Main virus still running.', '⚠️');
    return false;
  },
};

// ── Fake "sketchy download" site in browser ───────────────────────────────
// Registers a win12:// internal page that looks like a sketchy download site
const _virusSiteHTML = (virusId, virusName, tier) => {
  const tierColors = { mild: '#4ec9b0', medium: '#dcdcaa', severe: '#f44747' };
  const tierLabels = { mild: '⚠️ Low Risk', medium: '🔴 Medium Risk', severe: '☠️ SEVERE' };
  const color = tierColors[tier] || '#fff';
  const label = tierLabels[tier] || '';
  return `<!DOCTYPE html><html><head><style>
    body{background:#0a0a0a;color:#ccc;font-family:monospace;margin:0;padding:20px;min-height:100vh;}
    .site-header{background:#111;border-bottom:2px solid #333;padding:12px 20px;margin:-20px -20px 20px;display:flex;align-items:center;gap:12px;}
    .site-logo{font-size:24px;}
    .site-name{font-size:16px;color:#888;}
    .download-card{background:#111;border:1px solid #333;border-radius:8px;padding:24px;max-width:480px;margin:40px auto;}
    .dl-title{font-size:20px;color:#fff;margin-bottom:8px;}
    .dl-sub{font-size:12px;color:#666;margin-bottom:16px;}
    .dl-risk{display:inline-block;padding:3px 10px;border-radius:4px;font-size:11px;color:${color};border:1px solid ${color};margin-bottom:16px;}
    .dl-btn{display:block;width:100%;padding:14px;background:#1a1a1a;border:2px solid #444;border-radius:6px;color:#fff;font-size:14px;cursor:pointer;text-align:center;margin-top:12px;transition:background 0.2s;}
    .dl-btn:hover{background:#222;border-color:#666;}
    .dl-btn.primary{background:#1a3a1a;border-color:#2a6a2a;color:#4ec9b0;}
    .dl-btn.primary:hover{background:#1e4a1e;}
    .dl-warning{margin-top:16px;font-size:11px;color:#555;border-top:1px solid #222;padding-top:12px;}
    .dl-filename{font-size:12px;color:#888;margin-bottom:4px;}
    .dl-size{font-size:11px;color:#555;}
    .fake-reviews{margin-top:24px;}
    .review{background:#0d0d0d;border:1px solid #222;border-radius:4px;padding:10px;margin-bottom:8px;font-size:11px;color:#666;}
    .review-name{color:#888;margin-bottom:4px;}
  </style></head><body>
    <div class="site-header"><span class="site-logo">💾</span><span class="site-name">TotallyLegitSoftware.net — Free Downloads</span></div>
    <div class="download-card">
      <div class="dl-title">Free_Screensaver_HD_v3.2_FINAL.zip</div>
      <div class="dl-sub">Downloaded 847,291 times · Uploaded by anonymous</div>
      <div class="dl-risk">${label}</div>
      <div class="dl-filename">📦 Free_Screensaver_HD_v3.2_FINAL.zip → setup.exe</div>
      <div class="dl-size">Size: 2.4 MB · MD5: a3f9c2b1...</div>
      <button class="dl-btn primary" onclick="window.parent.postMessage({type:'virus_download',virusId:${virusId}},'*')">
        ⬇️ DOWNLOAD NOW (FREE)
      </button>
      <button class="dl-btn" onclick="window.parent.postMessage({type:'virus_download',virusId:${virusId}},'*')">
        Mirror 2 — Fast Download
      </button>
      <div class="dl-warning">⚠️ This file has not been scanned. Download at your own risk. We are not responsible for any damage.</div>
    </div>
    <div class="fake-reviews">
      <div class="review"><div class="review-name">xX_D4rkH4ck3r_Xx ★★★★★</div>works great on my pc lol</div>
      <div class="review"><div class="review-name">totally_real_user ★★★★★</div>downloaded it and my computer is totally fine trust me</div>
      <div class="review"><div class="review-name">anonymous ★☆☆☆☆</div>DO NOT DOWNLOAD THIS</div>
    </div>
  </body></html>`;
};

// Register internal virus download pages
const _virusPages = {
  'win12://virus/1':  { id:1, tier:'mild' },
  'win12://virus/2':  { id:2, tier:'mild' },
  'win12://virus/3':  { id:3, tier:'mild' },
  'win12://virus/4':  { id:4, tier:'mild' },
  'win12://virus/5':  { id:5, tier:'mild' },
  'win12://virus/6':  { id:6, tier:'medium' },
  'win12://virus/7':  { id:7, tier:'medium' },
  'win12://virus/8':  { id:8, tier:'medium' },
  'win12://virus/9':  { id:9, tier:'severe' },
  'win12://virus/10': { id:10, tier:'severe' },
};

// Listen for postMessage from virus download iframes
window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'virus_download') {
    const virusId = parseInt(e.data.virusId);
    if (virusId >= 1 && virusId <= 10) {
      // Save a fake zip to Downloads — user must unzip and run .exe to activate
      const zipName = `Free_Screensaver_HD_v${virusId}_FINAL.zip`;
      const exeName = `setup_v${virusId}.exe`;
      const zipPath = 'C:/Users/User/Downloads/' + zipName;
      // Write the zip entry
      FS.writeFile(zipPath, `[ZIP ARCHIVE]\nContents: ${exeName}\nSize: 2.4 MB\nVIRUS_ID:${virusId}`);
      Notifications.send('Downloads', `${zipName} downloaded. Open File Explorer to find it.`, '⬇️');
    }
  }
});

// Handle .exe execution from file explorer (called when user double-clicks .exe)
function _tryRunExe(path) {
  const content = FS.readFile(path);
  if (!content) return false;
  if (content.startsWith('[VIRUS_EXE]')) {
    const match = content.match(/VIRUS_ID:(\d+)/);
    if (match) {
      const virusId = parseInt(match[1]);
      Notifications.send('⚠️ Security Alert', 'Running ' + path.split('/').pop(), '🦠');
      setTimeout(() => VirusEngine.infectWith(virusId), 800);
      return true;
    }
  }
  return false;
}

// Handle .zip extraction from file explorer
function _tryExtractZip(path) {
  const content = FS.readFile(path);
  if (!content || !content.startsWith('[ZIP ARCHIVE]')) return false;
  const match = content.match(/Contents: (.+)\n/);
  const virusMatch = content.match(/VIRUS_ID:(\d+)/);
  if (match && virusMatch) {
    const exeName = match[1].trim();
    const virusId = virusMatch[1];
    const dir = path.replace(/\/[^/]+$/, '');
    const exePath = dir + '/' + exeName;
    FS.writeFile(exePath, `[VIRUS_EXE]\nVIRUS_ID:${virusId}\nThis file activates a virus simulation.`);
    FS.rm(path);
    Notifications.send('File Explorer', `Extracted: ${exeName}. Double-click to run.`, '📦');
    return true;
  }
  return false;
}

// ── Virus Lab App (for testing all viruses) ───────────────────────────────
AppLauncher.register('viruslab', {
  title: 'Virus Lab', icon: '🦠',
  launch() {
    const id = WM.create({ title:'Virus Lab', icon:'🦠', width:560, height:580, appId:'viruslab' });
    const content = WM.getContent(id);
    content.style.cssText = 'padding:16px;overflow-y:auto;';
    content.innerHTML = `
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">
        Simulate virus infections. Each virus can be triggered by visiting a sketchy link in the Browser, or directly here.
        Use Task Manager → End Task on the virus process to stop Tier 1–2 viruses.
        Tier 3 viruses require a restart (and may persist).
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;" id="vl-grid"></div>
      <div style="margin-top:16px;display:flex;gap:8px;">
      </div>
      <div style="margin-top:8px;padding:10px;background:rgba(255,255,255,0.04);border-radius:8px;font-size:11px;color:var(--text-muted);">
        Active virus: <span id="vl-active" style="color:#4ec9b0;">None</span>
      </div>`;

    const viruses = [
      { id:1, name:'FPS Dropper', tier:'Mild', desc:'Drops FPS to ~25, slight blur' },
      { id:2, name:'Screen Jitter', tier:'Mild', desc:'Random micro-shakes' },
      { id:3, name:'Slow Type', tier:'Mild', desc:'Injects junk chars in inputs' },
      { id:4, name:'Color Shift', tier:'Mild', desc:'Rotates desktop hue' },
      { id:5, name:'Cursor Drift', tier:'Mild', desc:'Randomly moves windows' },
      { id:6, name:'Popup Storm', tier:'Medium', desc:'Spam popups, tanks FPS' },
      { id:7, name:'Window Spam', tier:'Medium', desc:'Opens random apps + popups' },
      { id:8, name:'Screen Flash', tier:'Medium', desc:'Strobes + scrambles titles' },
      { id:9, name:'CryptoWall', tier:'SEVERE', desc:'Fake ransomware + file encryption' },
      { id:10, name:'MEMZ', tier:'SEVERE', desc:'Escalating chaos trojan' },
    ];

    const tierColor = { Mild:'#4ec9b0', Medium:'#dcdcaa', SEVERE:'#f44747' };
    const grid = content.querySelector('#vl-grid');
    viruses.forEach(v => {
      const btn = document.createElement('div');
      btn.style.cssText = `padding:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);
        border-radius:8px;cursor:pointer;transition:background 0.15s;`;
      btn.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-size:13px;font-weight:600;">Virus ${v.id}: ${v.name}</span>
          <span style="font-size:10px;color:${tierColor[v.tier]};border:1px solid ${tierColor[v.tier]};padding:1px 6px;border-radius:3px;">${v.tier}</span>
        </div>
        <div style="font-size:11px;color:var(--text-muted);">${v.desc}</div>`;
      btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(255,255,255,0.08)');
      btn.addEventListener('mouseleave', () => btn.style.background = 'rgba(255,255,255,0.04)');
      btn.addEventListener('click', () => {
        VirusEngine.infectWith(v.id);
        content.querySelector('#vl-active').textContent = `Virus ${v.id}: ${v.name}`;
      });
      grid.appendChild(btn);
    });

    content.querySelector('#vl-stop').addEventListener('click', () => {
      VirusEngine.stopVirus();
      localStorage.removeItem('win12_active_virus');
      content.querySelector('#vl-active').textContent = 'None';
      Notifications.send('Virus Lab', 'All virus effects stopped.', '✅');
    });
    content.querySelector('#vl-bsod').addEventListener('click', () => {
      VirusEngine.activeVirus = VirusEngine.activeVirus || 99;
      VirusEngine._bsodShown = false;
      VirusEngine._triggerBSOD();
    });

    // Update active virus display
    const h = setInterval(() => {
      const el = content.querySelector('#vl-active');
      if (!el) { clearInterval(h); return; }
      if (VirusEngine.activeVirus) {
        const v = viruses.find(x => x.id === VirusEngine.activeVirus);
        el.textContent = v ? `Virus ${v.id}: ${v.name}` : `Virus ${VirusEngine.activeVirus}`;
        el.style.color = '#f44747';
      } else {
        el.textContent = 'None';
        el.style.color = '#4ec9b0';
      }
    }, 1000);

    const observer = new MutationObserver(() => {
      if (!document.getElementById(id)) { clearInterval(h); observer.disconnect(); }
    });
    observer.observe(document.getElementById('windows-container'), { childList: true });
  }
});
