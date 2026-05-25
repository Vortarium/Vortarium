// ===== LOCK SCREEN =====
const LockScreen = {
  locked: true,
  loginShown: false,

  init() {
    this._updateTime();
    setInterval(() => this._updateTime(), 1000);

    // Apply home.jpg to lock background
    const bg = document.getElementById('lock-bg');
    if (bg) {
      bg.style.backgroundImage = "url('home.jpg'), linear-gradient(135deg,#0f0c29,#302b63,#24243e)";
      bg.style.backgroundSize = 'cover';
      bg.style.backgroundPosition = 'center';
    }

    const ls = document.getElementById('lockscreen');
    if (ls) {
      ls.addEventListener('click', () => this._showLogin());
    }

    document.addEventListener('keydown', (e) => {
      if (this.locked && !this.loginShown) {
        this._showLogin();
      }
    });
  },

  _updateTime() {
    const now = new Date();
    const timeEl = document.getElementById('lockTime');
    const dateEl = document.getElementById('lockDate');
    if (timeEl) timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (dateEl) dateEl.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  },

  _showLogin() {
    if (this.loginShown) return;
    this.loginShown = true;

    const ls = document.getElementById('lockscreen');
    const savedPassword = OS.settings.password || '';
    const hasPassword = savedPassword.length > 0;
    console.log('Lockscreen: savedPassword =', savedPassword, 'hasPassword =', hasPassword);

    const login = document.createElement('div');
    login.id = 'login-screen';
    login.innerHTML = `
      <div class="login-avatar">👤</div>
      <div class="login-name">${OS.settings.username || 'User'}</div>
      ${hasPassword ? `
        <div class="login-input-row">
          <input type="password" class="login-input" placeholder="Enter password" id="login-pass" autocomplete="off" />
          <button class="login-btn" id="login-submit">→</button>
        </div>
        <div class="login-error" id="login-error"></div>
        <div class="login-hint">Enter your password to sign in</div>
      ` : `
        <div class="login-input-row">
          <input type="password" class="login-input" placeholder="Press Enter or click →" id="login-pass" autocomplete="off" />
          <button class="login-btn" id="login-submit">→</button>
        </div>
        <div class="login-hint">No password set — press Enter or click → to sign in</div>
      `}
    `;

    // CRITICAL: login screen must be above lockscreen (z-index 100001 vs 100000)
    document.body.appendChild(login);

    const passInput = login.querySelector('#login-pass');
    const submitBtn = login.querySelector('#login-submit');
    const errorEl = login.querySelector('#login-error');

    // Auto-focus the input
    setTimeout(() => passInput && passInput.focus(), 50);

    const doLogin = () => {
      const entered = passInput ? passInput.value : '';

      if (hasPassword && entered !== savedPassword) {
        if (errorEl) {
          errorEl.textContent = 'Incorrect password. Try again.';
          passInput.value = '';
          passInput.focus();
          passInput.style.borderColor = '#f44747';
          setTimeout(() => {
            passInput.style.borderColor = '';
            errorEl.textContent = '';
          }, 2000);
        }
        return;
      }

      // Correct — animate out
      login.style.opacity = '0';
      login.style.transition = 'opacity 0.35s ease';
      if (ls) {
        ls.style.opacity = '0';
        ls.style.transition = 'opacity 0.35s ease';
      }
      setTimeout(() => {
        login.remove();
        if (ls) ls.remove();
        this.locked = false;
        this.loginShown = false;
      }, 350);
    };

    if (submitBtn) submitBtn.addEventListener('click', doLogin);
    if (passInput) {
      passInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); doLogin(); }
        if (e.key === 'Escape') {
          login.remove();
          this.loginShown = false;
        }
      });
    }
  },

  lock() {
    this.locked = true;
    this.loginShown = false;

    // Remove any existing login screen
    const existingLogin = document.getElementById('login-screen');
    if (existingLogin) existingLogin.remove();

    const ls = document.createElement('div');
    ls.id = 'lockscreen';

    const lockBg = OS.settings.lockWallpaper || '';
    ls.innerHTML = `
      <div class="lock-bg" id="lock-bg"></div>
      <div class="lock-content">
        <div class="lock-time" id="lockTime"></div>
        <div class="lock-date" id="lockDate"></div>
        <div class="lock-hint">Click or press any key to unlock</div>
      </div>
    `;
    document.body.appendChild(ls);

    // Apply background
    const bg = ls.querySelector('#lock-bg');
    if (lockBg) {
      bg.style.backgroundImage = `url('${lockBg}'), url('home.jpg'), linear-gradient(135deg,#0f0c29,#302b63,#24243e)`;
    } else {
      bg.style.backgroundImage = "url('home.jpg'), linear-gradient(135deg,#0f0c29,#302b63,#24243e)";
    }
    bg.style.backgroundSize = 'cover';
    bg.style.backgroundPosition = 'center';

    this._updateTime();

    ls.addEventListener('click', () => this._showLogin());
  }
};
