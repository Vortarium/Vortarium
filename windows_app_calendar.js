// ===== CALENDAR APP =====
AppLauncher.register('calendar', {
  title: 'Calendar',
  icon: '📅',

  launch() {
    const id = WM.create({
      title: 'Calendar',
      icon: '📅',
      width: 480,
      height: 520,
      appId: 'calendar',
    });

    const content = WM.getContent(id);
    content.innerHTML = `<div class="calendar-body" id="cal-body-${id}"></div>`;

    const state = {
      date: new Date(),
      selected: null,
      events: {
        [new Date().toDateString()]: ['Team meeting at 10:00 AM', 'Lunch with client at 12:30 PM'],
      }
    };

    const render = () => {
      const body = document.getElementById(`cal-body-${id}`);
      const year = state.date.getFullYear();
      const month = state.date.getMonth();
      const today = new Date();

      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const daysInPrev = new Date(year, month, 0).getDate();

      const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

      let days = '';

      // Previous month days
      for (let i = firstDay - 1; i >= 0; i--) {
        days += `<div class="cal-day other-month">${daysInPrev - i}</div>`;
      }

      // Current month days
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const isToday = date.toDateString() === today.toDateString();
        const isSelected = state.selected && date.toDateString() === state.selected.toDateString();
        const hasEvent = state.events[date.toDateString()];
        days += `
          <div class="cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" 
               data-date="${date.toDateString()}"
               style="${hasEvent ? 'position:relative' : ''}">
            ${d}
            ${hasEvent ? '<span style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:4px;height:4px;background:var(--accent);border-radius:50%"></span>' : ''}
          </div>
        `;
      }

      // Next month days
      const remaining = 42 - firstDay - daysInMonth;
      for (let d = 1; d <= remaining; d++) {
        days += `<div class="cal-day other-month">${d}</div>`;
      }

      const selectedEvents = state.selected ? (state.events[state.selected.toDateString()] || []) : [];

      body.innerHTML = `
        <div class="calendar-header">
          <button class="cal-nav-btn" id="cal-prev-${id}">◀</button>
          <div class="calendar-month-title">${monthNames[month]} ${year}</div>
          <button class="cal-nav-btn" id="cal-next-${id}">▶</button>
        </div>
        <div class="calendar-grid">
          ${dayNames.map(d => `<div class="cal-day-header">${d}</div>`).join('')}
          ${days}
        </div>
        ${state.selected ? `
          <div style="margin-top:16px;padding:12px;background:rgba(255,255,255,0.04);border-radius:10px;border:1px solid var(--border)">
            <div style="font-size:13px;font-weight:600;margin-bottom:8px">${state.selected.toLocaleDateString([], {weekday:'long',month:'long',day:'numeric'})}</div>
            ${selectedEvents.length > 0 ? selectedEvents.map(e => `
              <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
                <span style="color:var(--accent)">●</span>${e}
              </div>
            `).join('') : '<div style="color:var(--text-muted);font-size:12px">No events</div>'}
            <button id="cal-add-event-${id}" style="margin-top:8px;padding:5px 12px;background:var(--accent);border:none;border-radius:6px;color:white;cursor:pointer;font-size:12px">+ Add Event</button>
          </div>
        ` : ''}
      `;

      document.getElementById(`cal-prev-${id}`).addEventListener('click', () => {
        state.date = new Date(year, month - 1, 1);
        render();
      });

      document.getElementById(`cal-next-${id}`).addEventListener('click', () => {
        state.date = new Date(year, month + 1, 1);
        render();
      });

      body.querySelectorAll('.cal-day[data-date]').forEach(day => {
        day.addEventListener('click', () => {
          state.selected = new Date(day.dataset.date);
          render();
        });
      });

      const addBtn = document.getElementById(`cal-add-event-${id}`);
      if (addBtn) {
        addBtn.addEventListener('click', () => {
          const event = prompt('Event name:');
          if (event && state.selected) {
            const key = state.selected.toDateString();
            if (!state.events[key]) state.events[key] = [];
            state.events[key].push(event);
            render();
          }
        });
      }
    };

    render();
  }
});
