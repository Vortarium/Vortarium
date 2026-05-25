// ===== WEATHER APP =====
AppLauncher.register('weatherapp', {
  title: 'Weather', icon: '🌤️',

  launch() {
    const id = WM.create({ title: 'Weather', icon: '🌤️', width: 900, height: 640, appId: 'weatherapp' });
    const content = WM.getContent(id);
    content.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;background:linear-gradient(135deg,#0f2027,#203a43,#2c5364);color:#fff;';

    // Saved state
    const saved = OS.getAppData('weatherapp') || {};
    const state = {
      lat: saved.lat || 42.6584,
      lon: saved.lon || -83.1499,
      city: saved.city || 'Rochester Hills, MI',
      unit: saved.unit || (typeof Widgets !== 'undefined' ? Widgets.tempUnit : 'F'),
      data: null,
      forecastDays: 7,
    };

    const save = () => OS.setAppData('weatherapp', { lat: state.lat, lon: state.lon, city: state.city, unit: state.unit });

    const toC = f => Math.round((f - 32) * 5 / 9);
    const fmt = f => state.unit === 'C' ? toC(f) + '°C' : Math.round(f) + '°F';

    const ICONS = (code, isDay = 1) => {
      if (code === 0) return isDay ? '☀️' : '🌙';
      if (code <= 2) return isDay ? '⛅' : '🌙';
      if (code <= 3) return '☁️';
      if (code <= 49) return '🌫️';
      if (code <= 59) return '🌦️';
      if (code <= 69) return '🌧️';
      if (code <= 79) return '🌨️';
      if (code <= 84) return '🌧️';
      if (code <= 99) return '⛈️';
      return '🌡️';
    };

    const DESC = code => {
      const m = { 0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',48:'Icy fog',
        51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',
        71:'Light snow',73:'Snow',75:'Heavy snow',80:'Light showers',81:'Showers',82:'Heavy showers',
        95:'Thunderstorm',96:'Thunderstorm w/ hail',99:'Severe thunderstorm' };
      return m[code] || 'Unknown';
    };

    const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    const fetchWeather = async () => {
      renderLoading();
      try {
        const days = Math.min(state.forecastDays, 16);
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${state.lat}&longitude=${state.lon}`
          + `&current=temperature_2m,apparent_temperature,weathercode,windspeed_10m,winddirection_10m,relativehumidity_2m,is_day,precipitation,uv_index,surface_pressure,visibility`
          + `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,sunrise,sunset,uv_index_max,precipitation_probability_max`
          + `&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=auto&forecast_days=${days}`;
        const res = await fetch(url);
        state.data = await res.json();
        renderFull();
      } catch (e) {
        renderError('Failed to load weather data. Check your connection.');
      }
    };

    const searchLocation = async (query) => {
      try {
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`);
        const data = await res.json();
        return data.results || [];
      } catch (e) { return []; }
    };

    const renderLoading = () => {
      content.innerHTML = `
        <div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;">
          <div style="font-size:64px;animation:pulse 1s infinite;">🌤️</div>
          <div style="font-size:16px;color:rgba(255,255,255,0.7);">Loading weather for ${state.city}...</div>
        </div>`;
    };

    const renderError = (msg) => {
      content.innerHTML = `
        <div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;">
          <div style="font-size:48px;">⚠️</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.7);">${msg}</div>
          <button onclick="fetchWeather()" style="padding:8px 20px;background:var(--accent);border:none;border-radius:8px;color:#fff;cursor:pointer;">Retry</button>
        </div>`;
    };

    const renderFull = () => {
      if (!state.data) return;
      const d = state.data;
      const cur = d.current;
      const daily = d.daily;

      const sunrise = daily.sunrise?.[0] ? new Date(daily.sunrise[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
      const sunset = daily.sunset?.[0] ? new Date(daily.sunset[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
      const windDir = cur.winddirection_10m ?? '--';
      const pressure = cur.surface_pressure ? Math.round(cur.surface_pressure) + ' hPa' : '--';
      const visibility = cur.visibility ? (cur.visibility / 1000).toFixed(1) + ' km' : '--';
      const uvIndex = cur.uv_index ?? '--';
      const precip = cur.precipitation ?? 0;

      content.innerHTML = `
        <!-- Top bar -->
        <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(0,0,0,0.2);flex-shrink:0;">
          <div style="font-size:20px;font-weight:700;">🌤️ Weather</div>
          <div style="flex:1;"></div>
          <!-- Location search -->
          <div style="position:relative;display:flex;gap:6px;align-items:center;">
            <input id="wa-search-${id}" type="text" placeholder="Search city..." value="${state.city}"
              style="padding:6px 12px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:20px;color:#fff;font-size:13px;outline:none;width:200px;">
            <button id="wa-search-btn-${id}" style="padding:6px 14px;background:var(--accent);border:none;border-radius:20px;color:#fff;cursor:pointer;font-size:12px;">Search</button>
            <div id="wa-results-${id}" style="position:absolute;top:36px;left:0;right:0;background:rgba(22,22,32,0.98);border:1px solid rgba(255,255,255,0.1);border-radius:8px;z-index:100;display:none;max-height:200px;overflow-y:auto;"></div>
          </div>
          <!-- Unit toggle -->
          <div style="display:flex;gap:4px;">
            <button id="wa-f-${id}" style="padding:4px 10px;border-radius:12px;border:1px solid rgba(255,255,255,0.3);background:${state.unit==='F'?'var(--accent)':'transparent'};color:#fff;cursor:pointer;font-size:12px;">°F</button>
            <button id="wa-c-${id}" style="padding:4px 10px;border-radius:12px;border:1px solid rgba(255,255,255,0.3);background:${state.unit==='C'?'var(--accent)':'transparent'};color:#fff;cursor:pointer;font-size:12px;">°C</button>
          </div>
          <!-- Forecast range -->
          <select id="wa-days-${id}" style="padding:5px 8px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:#fff;font-size:12px;outline:none;cursor:pointer;">
            <option value="7" ${state.forecastDays===7?'selected':''}>7 days</option>
            <option value="10" ${state.forecastDays===10?'selected':''}>10 days</option>
            <option value="14" ${state.forecastDays===14?'selected':''}>14 days</option>
            <option value="16" ${state.forecastDays===16?'selected':''}>16 days</option>
          </select>
        </div>

        <!-- Main content -->
        <div style="flex:1;overflow-y:auto;padding:20px;">

          <!-- Hero current weather -->
          <div style="display:flex;align-items:center;gap:24px;margin-bottom:24px;padding:20px;background:rgba(255,255,255,0.08);border-radius:16px;backdrop-filter:blur(10px);">
            <div style="font-size:80px;line-height:1;">${ICONS(cur.weathercode, cur.is_day)}</div>
            <div style="flex:1;">
              <div style="font-size:56px;font-weight:200;line-height:1;">${fmt(cur.temperature_2m)}</div>
              <div style="font-size:20px;color:rgba(255,255,255,0.85);margin-top:4px;">${DESC(cur.weathercode)}</div>
              <div style="font-size:14px;color:rgba(255,255,255,0.6);margin-top:4px;">📍 ${state.city}</div>
              <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-top:2px;">Feels like ${fmt(cur.apparent_temperature)}</div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;min-width:200px;">
              ${[
                {icon:'💧',label:'Humidity',val:cur.relativehumidity_2m+'%'},
                {icon:'💨',label:'Wind',val:Math.round(cur.windspeed_10m)+' mph'},
                {icon:'🌧️',label:'Precip',val:precip.toFixed(1)+' mm'},
                {icon:'☀️',label:'UV Index',val:uvIndex},
              ].map(s=>`
                <div style="background:rgba(255,255,255,0.06);border-radius:10px;padding:10px;text-align:center;">
                  <div style="font-size:20px;">${s.icon}</div>
                  <div style="font-size:10px;color:rgba(255,255,255,0.5);margin:2px 0;">${s.label}</div>
                  <div style="font-size:14px;font-weight:500;">${s.val}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Detailed stats grid -->
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px;">
            ${[
              {icon:'🌅',label:'Sunrise',val:sunrise},
              {icon:'🌇',label:'Sunset',val:sunset},
              {icon:'🔵',label:'Pressure',val:pressure},
              {icon:'👁️',label:'Visibility',val:visibility},
              {icon:'🧭',label:'Wind Dir',val:windDir+'°'},
              {icon:'🌡️',label:'High',val:fmt(daily.temperature_2m_max[0])},
              {icon:'❄️',label:'Low',val:fmt(daily.temperature_2m_min[0])},
              {icon:'☔',label:'Rain Chance',val:(daily.precipitation_probability_max?.[0]??0)+'%'},
            ].map(s=>`
              <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;text-align:center;">
                <div style="font-size:24px;margin-bottom:6px;">${s.icon}</div>
                <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:4px;">${s.label}</div>
                <div style="font-size:15px;font-weight:500;">${s.val}</div>
              </div>
            `).join('')}
          </div>

          <!-- Extended forecast -->
          <div style="font-size:15px;font-weight:600;margin-bottom:12px;color:rgba(255,255,255,0.8);">
            ${state.forecastDays}-Day Forecast
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${daily.time.map((t, i) => {
              const date = new Date(t + 'T12:00:00');
              const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DAYS[date.getDay()];
              const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
              const hi = fmt(daily.temperature_2m_max[i]);
              const lo = fmt(daily.temperature_2m_min[i]);
              const rain = daily.precipitation_probability_max?.[i] ?? 0;
              const precip_sum = daily.precipitation_sum?.[i]?.toFixed(1) ?? '0';
              const wind = Math.round(daily.windspeed_10m_max?.[i] ?? 0);
              const icon = ICONS(daily.weathercode[i]);
              const desc = DESC(daily.weathercode[i]);
              return `
                <div style="display:flex;align-items:center;gap:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:12px 16px;">
                  <div style="font-size:28px;width:36px;text-align:center;">${icon}</div>
                  <div style="min-width:120px;">
                    <div style="font-size:14px;font-weight:600;">${dayName}</div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.5);">${dateStr}</div>
                  </div>
                  <div style="flex:1;font-size:13px;color:rgba(255,255,255,0.7);">${desc}</div>
                  <div style="font-size:12px;color:rgba(255,255,255,0.5);min-width:60px;text-align:center;">💧 ${rain}%</div>
                  <div style="font-size:12px;color:rgba(255,255,255,0.5);min-width:60px;text-align:center;">💨 ${wind}mph</div>
                  <div style="display:flex;align-items:center;gap:8px;min-width:100px;">
                    <span style="font-size:13px;color:rgba(255,255,255,0.5);">${lo}</span>
                    <div style="flex:1;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;">
                      <div style="height:100%;background:linear-gradient(90deg,#4af,#f90);border-radius:2px;width:60%;"></div>
                    </div>
                    <span style="font-size:13px;font-weight:600;">${hi}</span>
                  </div>
                </div>`;
            }).join('')}
          </div>

          <div style="text-align:center;margin-top:16px;font-size:11px;color:rgba(255,255,255,0.3);">
            Data from Open-Meteo · Updated ${new Date().toLocaleTimeString()}
          </div>
        </div>`;

      // Bind controls
      const searchInput = document.getElementById(`wa-search-${id}`);
      const searchBtn = document.getElementById(`wa-search-btn-${id}`);
      const resultsDiv = document.getElementById(`wa-results-${id}`);

      const doSearch = async () => {
        const q = searchInput.value.trim();
        if (!q) return;
        const results = await searchLocation(q);
        if (results.length === 0) {
          resultsDiv.innerHTML = '<div style="padding:10px;font-size:12px;color:rgba(255,255,255,0.5);">No results found</div>';
          resultsDiv.style.display = 'block';
          return;
        }
        resultsDiv.innerHTML = results.map((r, i) => `
          <div data-idx="${i}" style="padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06);"
               onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background=''">
            📍 ${r.name}${r.admin1 ? ', ' + r.admin1 : ''}${r.country ? ', ' + r.country : ''}
          </div>`).join('');
        resultsDiv.style.display = 'block';
        resultsDiv.querySelectorAll('[data-idx]').forEach(el => {
          el.addEventListener('click', () => {
            const r = results[parseInt(el.dataset.idx)];
            state.lat = r.latitude;
            state.lon = r.longitude;
            state.city = r.name + (r.admin1 ? ', ' + r.admin1 : '') + (r.country_code ? ', ' + r.country_code : '');
            resultsDiv.style.display = 'none';
            save();
            fetchWeather();
          });
        });
      };

      searchBtn.addEventListener('click', doSearch);
      searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
      document.addEventListener('click', e => {
        if (!resultsDiv.contains(e.target) && e.target !== searchInput && e.target !== searchBtn) {
          resultsDiv.style.display = 'none';
        }
      }, { once: false });

      document.getElementById(`wa-f-${id}`).addEventListener('click', () => {
        state.unit = 'F';
        try { localStorage.setItem('win12_temp_unit', 'F'); } catch(e) {}
        save();
        renderFull();
      });
      document.getElementById(`wa-c-${id}`).addEventListener('click', () => {
        state.unit = 'C';
        try { localStorage.setItem('win12_temp_unit', 'C'); } catch(e) {}
        save();
        renderFull();
      });
      document.getElementById(`wa-days-${id}`).addEventListener('change', e => {
        state.forecastDays = parseInt(e.target.value);
        fetchWeather();
      });
    };

    fetchWeather();
  }
});
