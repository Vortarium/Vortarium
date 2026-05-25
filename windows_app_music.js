// ===== MUSIC PLAYER APP =====
AppLauncher.register('music', {
  title: 'Music',
  icon: '🎵',

  launch() {
    const id = WM.create({
      title: 'Music',
      icon: '🎵',
      width: 380,
      height: 560,
      minWidth: 320,
      appId: 'music',
    });

    const content = WM.getContent(id);

    const tracks = [
      { title: 'Neon Dreams', artist: 'Synthwave Artist', duration: 214, color: '#0078d4' },
      { title: 'Digital Horizon', artist: 'Future Bass', duration: 187, color: '#7b2ff7' },
      { title: 'Midnight Drive', artist: 'Lo-Fi Beats', duration: 243, color: '#e74c3c' },
      { title: 'Electric Sky', artist: 'Ambient Waves', duration: 198, color: '#27ae60' },
      { title: 'Cyber City', artist: 'Retrowave', duration: 221, color: '#f39c12' },
    ];

    const state = {
      trackIdx: 0,
      playing: false,
      progress: 0,
      elapsed: 0,
      interval: null,
      shuffle: false,
      repeat: false,
      volume: 75,
    };

    const formatTime = (s) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;

    const render = () => {
      const track = tracks[state.trackIdx];
      content.innerHTML = `
        <div class="music-body">
          <div class="music-album-art" style="background:linear-gradient(135deg,${track.color},#1a1a2e)">
            🎵
          </div>
          <div class="music-info">
            <div class="music-title">${track.title}</div>
            <div class="music-artist">${track.artist}</div>
          </div>
          <div class="music-progress">
            <input type="range" id="music-prog-${id}" min="0" max="${track.duration}" value="${state.elapsed}" />
            <div class="music-time">
              <span id="music-elapsed-${id}">${formatTime(state.elapsed)}</span>
              <span>${formatTime(track.duration)}</span>
            </div>
          </div>
          <div class="music-controls">
            <button class="music-btn ${state.shuffle ? 'active' : ''}" id="music-shuffle-${id}" title="Shuffle" style="${state.shuffle ? 'color:var(--accent)' : ''}">🔀</button>
            <button class="music-btn" id="music-prev-${id}" title="Previous">⏮</button>
            <button class="music-btn play-btn" id="music-play-${id}" title="${state.playing ? 'Pause' : 'Play'}">${state.playing ? '⏸' : '▶'}</button>
            <button class="music-btn" id="music-next-${id}" title="Next">⏭</button>
            <button class="music-btn ${state.repeat ? 'active' : ''}" id="music-repeat-${id}" title="Repeat" style="${state.repeat ? 'color:var(--accent)' : ''}">🔁</button>
          </div>
          <div style="display:flex;align-items:center;gap:8px;width:100%;max-width:300px">
            <span style="font-size:14px">🔊</span>
            <input type="range" id="music-vol-${id}" min="0" max="100" value="${state.volume}" style="flex:1;accent-color:var(--accent)" />
          </div>
          <div style="width:100%;max-width:300px">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Up Next</div>
            ${tracks.map((t, i) => `
              <div id="music-track-${id}-${i}" style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;cursor:pointer;transition:background 0.15s;${i === state.trackIdx ? 'background:rgba(0,120,212,0.15)' : ''}"
                   onmouseover="this.style.background='rgba(255,255,255,0.06)'" 
                   onmouseout="this.style.background='${i === state.trackIdx ? 'rgba(0,120,212,0.15)' : ''}'">
                <div style="width:32px;height:32px;border-radius:6px;background:linear-gradient(135deg,${t.color},#1a1a2e);display:flex;align-items:center;justify-content:center;font-size:14px">🎵</div>
                <div style="flex:1;overflow:hidden">
                  <div style="font-size:12px;font-weight:${i === state.trackIdx ? '600' : '400'};color:${i === state.trackIdx ? 'var(--accent)' : 'white'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.title}</div>
                  <div style="font-size:11px;color:var(--text-muted)">${t.artist}</div>
                </div>
                <div style="font-size:11px;color:var(--text-muted)">${formatTime(t.duration)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      bindEvents();
    };

    const bindEvents = () => {
      document.getElementById(`music-play-${id}`).addEventListener('click', () => {
        state.playing = !state.playing;
        if (state.playing) {
          state.interval = setInterval(() => {
            state.elapsed++;
            if (state.elapsed >= tracks[state.trackIdx].duration) {
              if (state.repeat) state.elapsed = 0;
              else nextTrack();
              return;
            }
            const prog = document.getElementById(`music-prog-${id}`);
            const elapsed = document.getElementById(`music-elapsed-${id}`);
            if (prog) prog.value = state.elapsed;
            if (elapsed) elapsed.textContent = formatTime(state.elapsed);
          }, 1000);
        } else {
          clearInterval(state.interval);
        }
        document.getElementById(`music-play-${id}`).textContent = state.playing ? '⏸' : '▶';
      });

      document.getElementById(`music-prev-${id}`).addEventListener('click', () => {
        state.trackIdx = (state.trackIdx - 1 + tracks.length) % tracks.length;
        state.elapsed = 0;
        clearInterval(state.interval);
        state.playing = false;
        render();
      });

      document.getElementById(`music-next-${id}`).addEventListener('click', nextTrack);

      document.getElementById(`music-shuffle-${id}`).addEventListener('click', () => {
        state.shuffle = !state.shuffle;
        render();
      });

      document.getElementById(`music-repeat-${id}`).addEventListener('click', () => {
        state.repeat = !state.repeat;
        render();
      });

      document.getElementById(`music-prog-${id}`).addEventListener('input', (e) => {
        state.elapsed = parseInt(e.target.value);
      });

      document.getElementById(`music-vol-${id}`).addEventListener('input', (e) => {
        state.volume = parseInt(e.target.value);
      });

      tracks.forEach((_, i) => {
        const el = document.getElementById(`music-track-${id}-${i}`);
        if (el) {
          el.addEventListener('click', () => {
            state.trackIdx = i;
            state.elapsed = 0;
            clearInterval(state.interval);
            state.playing = false;
            render();
          });
        }
      });
    };

    const nextTrack = () => {
      if (state.shuffle) {
        state.trackIdx = Math.floor(Math.random() * tracks.length);
      } else {
        state.trackIdx = (state.trackIdx + 1) % tracks.length;
      }
      state.elapsed = 0;
      clearInterval(state.interval);
      state.playing = false;
      render();
    };

    render();
  }
});
