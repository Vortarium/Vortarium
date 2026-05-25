// ===== NOTIFICATIONS =====
const Notifications = {
  list: [],
  toastContainer: null,

  init() {
    this.toastContainer = document.createElement('div');
    this.toastContainer.className = 'toast-container';
    document.body.appendChild(this.toastContainer);

    const notifBtn = document.getElementById('notif-btn');
    const panel = document.getElementById('notification-panel');

    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.classList.toggle('hidden');
      StartMenu.close();
    });

    document.addEventListener('click', (e) => {
      if (!panel.contains(e.target) && e.target !== notifBtn) {
        panel.classList.add('hidden');
      }
    });

    document.getElementById('clear-notifs').addEventListener('click', () => {
      this.list = [];
      this._renderList();
    });

    // Quick settings toggles
    document.querySelectorAll('.qs-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
      });
    });

    // Brightness slider
    document.getElementById('brightness-slider').addEventListener('input', (e) => {
      OS.settings.brightness = parseInt(e.target.value);
      document.body.style.filter = `brightness(${OS.settings.brightness / 100})`;
      OS.saveSettings();
    });

    // Volume slider
    document.getElementById('volume-slider').addEventListener('input', (e) => {
      OS.settings.volume = parseInt(e.target.value);
      OS.saveSettings();
    });

    // Send welcome notification
    setTimeout(() => {
      this.send('Windows 12', 'Welcome back, ' + OS.username + '!', '🪟');
    }, 1500);

    setTimeout(() => {
      this.send('System', 'All systems running normally.', '✅');
    }, 3000);
  },

  send(title, text, icon = '🔔') {
    const notif = { id: Date.now(), title, text, icon, time: new Date() };
    this.list.unshift(notif);
    this._renderList();
    this._showToast(notif);
    // Show badge
    const badge = document.querySelector('#notif-btn .badge');
    if (!badge) {
      const b = document.createElement('div');
      b.className = 'badge';
      document.getElementById('notif-btn').appendChild(b);
    }
  },

  _renderList() {
    const list = document.getElementById('notif-list');
    if (!list) return;
    if (this.list.length === 0) {
      list.innerHTML = '<div class="notif-empty">No notifications</div>';
      return;
    }
    list.innerHTML = this.list.map(n => `
      <div class="notif-item">
        <span class="notif-icon">${n.icon}</span>
        <div class="notif-body">
          <div class="notif-title">${n.title}</div>
          <div class="notif-text">${n.text}</div>
        </div>
        <span class="notif-time">${this._formatTime(n.time)}</span>
      </div>
    `).join('');
  },

  _showToast(notif) {
    if (!OS.settings.notifications) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <span class="toast-icon">${notif.icon}</span>
      <div class="toast-body">
        <div class="toast-title">${notif.title}</div>
        <div class="toast-text">${notif.text}</div>
      </div>
    `;
    this.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  _formatTime(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
};
