// ===== WEATHER — Rochester Hills, MI (Open-Meteo, free, no key) =====
const Weather = {
  data: null,
  LAT: 42.6584, LON: -83.1499, CITY: 'Rochester Hills, MI',

  init() { this._load(); setInterval(() => this._load(), 15*60*1000); },

  async _load() {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${this.LAT}&longitude=${this.LON}`
        + `&current=temperature_2m,apparent_temperature,weathercode,windspeed_10m,relativehumidity_2m,is_day,precipitation,uv_index`
        + `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,sunrise,sunset`
        + `&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=America%2FDetroit&forecast_days=7`;
      const res = await fetch(url);
      this.data = await res.json();
      this._broadcast();
    } catch(e) { console.warn('Weather fetch failed:', e); }
  },

  _broadcast() {
    const unit = (typeof Widgets !== 'undefined' && Widgets.tempUnit) || 'F';
    const el = document.getElementById('w-weather-card');
    if (el) this.renderCard(el, unit);
  },

  _toC(f) { return Math.round((f - 32) * 5/9); },

  renderCard(el, unit) {
    unit = unit || 'F';
    const cur = this.getCurrent();
    const fc = this.getForecast();
    if (!cur) {
      el.innerHTML = '<div style="color:rgba(255,255,255,0.4);font-size:12px;padding:8px;">Loading weather for Rochester Hills, MI...</div>';
      return;
    }
    const temp = unit === 'C' ? this._toC(cur.temp) : cur.temp;
    const feels = unit === 'C' ? this._toC(cur.feels) : cur.feels;
    const deg = `°${unit}`;
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:14px;">
        <div style="font-size:48px;">${cur.icon}</div>
        <div>
          <div style="font-size:28px;font-weight:300;">${temp}${deg}</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.8);">${cur.desc}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.5);">Feels ${feels}${deg} · Wind ${cur.wind}mph · ${cur.humidity}% humidity</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.4);">${cur.city}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-top:12px;">
        ${fc.slice(0,5).map(d=>{
          const hi = unit === 'C' ? this._toC(d.high) : d.high;
          const lo = unit === 'C' ? this._toC(d.low) : d.low;
          return `<div style="flex:1;text-align:center;background:rgba(255,255,255,0.04);border-radius:8px;padding:6px 2px;">
            <div style="font-size:10px;color:rgba(255,255,255,0.5);">${d.day}</div>
            <div style="font-size:16px;margin:3px 0;">${d.icon}</div>
            <div style="font-size:11px;">${hi}°</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.4);">${lo}°</div>
          </div>`;
        }).join('')}
      </div>`;
  },

  // Full data card for the Weather App
  renderFullCard(el, unit) {
    unit = unit || 'F';
    const cur = this.getCurrent();
    const fc = this.getForecast();
    if (!cur) {
      el.innerHTML = '<div style="color:rgba(255,255,255,0.4);font-size:14px;padding:20px;text-align:center;">Loading weather data...</div>';
      return;
    }
    const t = (f) => unit === 'C' ? this._toC(f) + '°C' : f + '°F';
    const d = this.data;
    const sunrise = d?.daily?.sunrise?.[0] ? new Date(d.daily.sunrise[0]).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '--';
    const sunset = d?.daily?.sunset?.[0] ? new Date(d.daily.sunset[0]).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '--';
    const precip = d?.current?.precipitation ?? '--';
    const uv = d?.current?.uv_index ?? '--';

    el.innerHTML = `
      <div style="padding:24px;overflow-y:auto;height:100%;">
        <!-- Header -->
        <div style="display:flex;align-items:center;gap:20px;margin-bottom:24px;">
          <div style="font-size:80px;line-height:1;">${cur.icon}</div>
          <div>
            <div style="font-size:48px;font-weight:200;line-height:1;">${t(cur.temp)}</div>
            <div style="font-size:18px;color:rgba(255,255,255,0.8);margin-top:4px;">${cur.desc}</div>
            <div style="font-size:14px;color:rgba(255,255,255,0.5);margin-top:4px;">📍 ${cur.city}</div>
          </div>
        </div>

        <!-- Stats grid -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;">
          ${[
            {icon:'🌡️',label:'Feels Like',val:t(cur.feels)},
            {icon:'💧',label:'Humidity',val:cur.humidity+'%'},
            {icon:'💨',label:'Wind Speed',val:cur.wind+' mph'},
            {icon:'🌧️',label:'Precipitation',val:precip+' mm'},
            {icon:'☀️',label:'UV Index',val:uv},
            {icon:'🌅',label:'Sunrise',val:sunrise},
            {icon:'🌇',label:'Sunset',val:sunset},
            {icon:'👁️',label:'Visibility',val:'10 mi'},
            {icon:'🔵',label:'Pressure',val:'1013 hPa'},
          ].map(s=>`
            <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;text-align:center;">
              <div style="font-size:24px;margin-bottom:6px;">${s.icon}</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:4px;">${s.label}</div>
              <div style="font-size:16px;font-weight:500;">${s.val}</div>
            </div>
          `).join('')}
        </div>

        <!-- 7-day forecast -->
        <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:rgba(255,255,255,0.7);">7-Day Forecast</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${fc.map(day=>`
            <div style="display:flex;align-items:center;gap:12px;background:rgba(255,255,255,0.04);border-radius:10px;padding:12px 16px;">
              <div style="font-size:22px;width:32px;">${day.icon}</div>
              <div style="flex:1;font-size:14px;">${day.day}</div>
              <div style="font-size:13px;color:rgba(255,255,255,0.5);">${t(day.low)}</div>
              <div style="width:80px;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;margin:0 8px;">
                <div style="height:100%;background:linear-gradient(90deg,#4af,#f90);border-radius:2px;width:60%;"></div>
              </div>
              <div style="font-size:13px;font-weight:600;">${t(day.high)}</div>
            </div>
          `).join('')}
        </div>
      </div>`;
  },

  _icon(code, isDay=1) {
    if (code===0) return isDay?'☀️':'🌙';
    if (code<=2) return isDay?'⛅':'🌙';
    if (code<=3) return '☁️';
    if (code<=49) return '🌫️';
    if (code<=59) return '🌦️';
    if (code<=69) return '🌧️';
    if (code<=79) return '🌨️';
    if (code<=84) return '🌧️';
    if (code<=99) return '⛈️';
    return '🌡️';
  },

  _desc(code) {
    const m={0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',48:'Icy fog',
      51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',
      71:'Light snow',73:'Snow',75:'Heavy snow',80:'Light showers',81:'Showers',82:'Heavy showers',
      95:'Thunderstorm',96:'Thunderstorm w/ hail',99:'Severe thunderstorm'};
    return m[code]||'Unknown';
  },

  getCurrent() {
    if (!this.data) return null;
    const c = this.data.current;
    return { temp:Math.round(c.temperature_2m), feels:Math.round(c.apparent_temperature),
      desc:this._desc(c.weathercode), icon:this._icon(c.weathercode,c.is_day),
      wind:Math.round(c.windspeed_10m), humidity:c.relativehumidity_2m, city:this.CITY };
  },

  getForecast() {
    if (!this.data) return [];
    const d = this.data.daily;
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    return d.time.map((t,i) => ({
      day: days[new Date(t+'T12:00:00').getDay()],
      icon: this._icon(d.weathercode[i]),
      high: Math.round(d.temperature_2m_max[i]),
      low: Math.round(d.temperature_2m_min[i]),
    }));
  }
};
