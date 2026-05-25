// ===== FL STUDIO 21 — FULL REWRITE =====
AppLauncher.register('flstudio', {
  title: 'FL Studio', icon: '🎹',
  launch() {
    const id = WM.create({ title: 'FL Studio 21', icon: '🎹', width: 1280, height: 820, appId: 'flstudio' });
    const content = WM.getContent(id);
    content.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;background:#1a1a1a;color:#e0e0e0;font-family:"Segoe UI",sans-serif;user-select:none;';

    const STEPS = 16;
    const TRACKS = [
      { name:'Kick',    color:'#e74c3c', steps:[0,4,8,12].reduce((a,i)=>{a[i]=true;return a;},Array(STEPS).fill(false)) },
      { name:'Snare',   color:'#e67e22', steps:[4,12].reduce((a,i)=>{a[i]=true;return a;},Array(STEPS).fill(false)) },
      { name:'Hi-Hat',  color:'#f1c40f', steps:Array(STEPS).fill(false).map((_,i)=>i%2===0) },
      { name:'Open HH', color:'#2ecc71', steps:[2,6,10,14].reduce((a,i)=>{a[i]=true;return a;},Array(STEPS).fill(false)) },
      { name:'Clap',    color:'#3498db', steps:[4,12].reduce((a,i)=>{a[i]=true;return a;},Array(STEPS).fill(false)) },
      { name:'Bass',    color:'#9b59b6', steps:[0,3,8,11].reduce((a,i)=>{a[i]=true;return a;},Array(STEPS).fill(false)) },
      { name:'Lead',    color:'#1abc9c', steps:Array(STEPS).fill(false) },
      { name:'Pad',     color:'#e91e63', steps:[0,8].reduce((a,i)=>{a[i]=true;return a;},Array(STEPS).fill(false)) },
    ];

    // Piano notes: C3-B4 (2 octaves), top to bottom
    const PIANO_NOTES = [];
    for (let oct = 4; oct >= 3; oct--) {
      ['B','A#','A','G#','G','F#','F','E','D#','D','C#','C'].forEach(n => PIANO_NOTES.push(n+oct));
    }
    const PR_COLS = 32;

    const noteToFreq = note => {
      const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
      const oct = parseInt(note.slice(-1));
      const name = note.slice(0,-1);
      const midi = (oct + 1) * 12 + names.indexOf(name);
      return 440 * Math.pow(2, (midi - 69) / 12);
    };

    const state = {
      bpm: 140, playing: false, recording: false, loop: false, metronome: false,
      currentStep: 0, masterVol: 80, swing: 0, activeTab: 'stepseq',
      selectedTrack: 0, interval: null, audioCtx: null,
      pianoRoll: Array(PIANO_NOTES.length).fill(null).map(() => Array(PR_COLS).fill(false)),
      mixer: TRACKS.map(() => ({ vol: 80, pan: 0, mute: false, solo: false })),
      undoStack: [], redoStack: [],
      clips: [], // { id, name, buffer, speed, reverbAmt, cropStart, cropEnd, pitchShift }
      activeClip: null,
    };

    // ── Audio Context ──────────────────────────────────────────────────
    const getCtx = () => {
      if (!state.audioCtx) state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      return state.audioCtx;
    };

    const getMasterGain = (() => {
      let g = null;
      return () => {
        const ctx = getCtx();
        if (!g) { g = ctx.createGain(); g.connect(ctx.destination); }
        g.gain.value = state.masterVol / 100;
        return g;
      };
    })();

    // ── Drum Synthesis ─────────────────────────────────────────────────
    const playDrum = (type, when) => {
      try {
        const ctx = getCtx(); const t = when || ctx.currentTime;
        const out = ctx.createGain(); out.connect(getMasterGain());
        if (type === 'Kick') {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(out);
          o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(0.01, t + 0.35);
          g.gain.setValueAtTime(1.2, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
          o.start(t); o.stop(t + 0.4);
        } else if (type === 'Snare') {
          const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
          const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
          const src = ctx.createBufferSource(); src.buffer = buf;
          const flt = ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = 1800; flt.Q.value = 0.8;
          const g = ctx.createGain(); g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
          src.connect(flt); flt.connect(g); g.connect(out);
          const o = ctx.createOscillator(); const og = ctx.createGain();
          o.frequency.value = 200; og.gain.setValueAtTime(0.4, t); og.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
          o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.2);
          src.start(t); src.stop(t + 0.2);
        } else if (type === 'Hi-Hat') {
          const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
          const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
          const src = ctx.createBufferSource(); src.buffer = buf;
          const flt = ctx.createBiquadFilter(); flt.type = 'highpass'; flt.frequency.value = 7000;
          const g = ctx.createGain(); g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.06);
          src.connect(flt); flt.connect(g); g.connect(out); src.start(t); src.stop(t + 0.1);
        } else if (type === 'Open HH') {
          const buf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
          const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
          const src = ctx.createBufferSource(); src.buffer = buf;
          const flt = ctx.createBiquadFilter(); flt.type = 'highpass'; flt.frequency.value = 6000;
          const g = ctx.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
          src.connect(flt); flt.connect(g); g.connect(out); src.start(t); src.stop(t + 0.4);
        } else if (type === 'Clap') {
          [0, 0.01, 0.02].forEach(delay => {
            const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
            const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            const src = ctx.createBufferSource(); src.buffer = buf;
            const flt = ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = 1200;
            const g = ctx.createGain(); g.gain.setValueAtTime(0.5, t + delay); g.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.08);
            src.connect(flt); flt.connect(g); g.connect(out); src.start(t + delay); src.stop(t + delay + 0.1);
          });
        } else if (type === 'Bass') {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.type = 'sawtooth'; o.frequency.value = 80;
          const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 400;
          o.connect(flt); flt.connect(g); g.connect(out);
          g.gain.setValueAtTime(0.8, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
          o.start(t); o.stop(t + 0.3);
        } else if (type === 'Lead') {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.type = 'square'; o.frequency.value = 440;
          o.connect(g); g.connect(out);
          g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
          o.start(t); o.stop(t + 0.25);
        } else {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.type = 'sine'; o.frequency.value = 220;
          o.connect(g); g.connect(out);
          g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
          o.start(t); o.stop(t + 0.6);
        }
      } catch(e) {}
    };

    // ── Piano Synthesis (ADSR + detuned oscillators + vibrato) ─────────
    const playPiano = (freq, duration) => {
      try {
        const ctx = getCtx(); const t = ctx.currentTime;
        const master = getMasterGain();
        const env = ctx.createGain();
        env.connect(master);
        // Attack 0.01, Decay 0.3, Sustain 0.7, Release 0.5
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(0.6, t + 0.01);
        env.gain.linearRampToValueAtTime(0.6 * 0.7, t + 0.01 + 0.3);
        env.gain.setValueAtTime(0.6 * 0.7, t + duration);
        env.gain.linearRampToValueAtTime(0, t + duration + 0.5);
        // Multiple detuned oscillators
        [[0,'sine',1.0],[5,'triangle',0.4],[-5,'sine',0.3],[12,'sine',0.15]].forEach(([det,type,amp]) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.type = type; o.frequency.value = freq; o.detune.value = det;
          g.gain.value = amp; o.connect(g); g.connect(env);
          o.start(t); o.stop(t + duration + 0.6);
        });
        // Vibrato LFO
        const lfo = ctx.createOscillator(); const lfoGain = ctx.createGain();
        lfo.frequency.value = 5.5; lfoGain.gain.value = 3;
        lfo.connect(lfoGain);
        // connect lfo to all oscillators via env
        lfo.start(t + 0.15); lfo.stop(t + duration + 0.6);
      } catch(e) {}
    };

    // ── Playback ───────────────────────────────────────────────────────
    const startPlayback = () => {
      const stepMs = (60000 / state.bpm) / 4;
      state.interval = setInterval(() => {
        const step = state.currentStep;
        const anySolo = state.mixer.some(m => m.solo);
        TRACKS.forEach((track, ti) => {
          const mx = state.mixer[ti];
          if (!track.steps[step]) return;
          if (mx.mute) return;
          if (anySolo && !mx.solo) return;
          const vol = mx.vol / 100;
          if (vol > 0) playDrum(track.name, getCtx().currentTime);
        });
        if (state.metronome && step % 4 === 0) {
          try {
            const ctx = getCtx(); const o = ctx.createOscillator(); const g = ctx.createGain();
            o.frequency.value = step === 0 ? 1200 : 900; g.gain.setValueAtTime(0.15, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
            o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.06);
          } catch(e) {}
        }
        state.currentStep = (state.currentStep + 1) % STEPS;
        updateStepHighlight();
      }, stepMs);
    };

    const stopPlayback = () => { clearInterval(state.interval); state.interval = null; };

    const updateStepHighlight = () => {
      content.querySelectorAll('.fl-step-row').forEach(row => {
        row.querySelectorAll('.fl-step').forEach((btn, i) => {
          const ti = parseInt(btn.dataset.track);
          const on = TRACKS[ti].steps[i];
          btn.style.outline = i === state.currentStep ? '2px solid #fff' : 'none';
          btn.style.background = on ? TRACKS[ti].color : (i % 4 === 0 ? '#2e2e2e' : '#252525');
        });
      });
    };

    // ── Save / Load ────────────────────────────────────────────────────
    const saveProject = () => {
      const data = { bpm: state.bpm, tracks: TRACKS.map(t => t.steps), mixer: state.mixer, pianoRoll: state.pianoRoll };
      try { if (typeof OS !== 'undefined') OS.setAppData('flstudio', JSON.stringify(data));
            else localStorage.setItem('flstudio_project', JSON.stringify(data)); } catch(e) {}
      if (typeof Notifications !== 'undefined') Notifications.send('FL Studio', 'Project saved', '💾');
    };

    const loadProject = () => {
      try {
        let raw = null;
        if (typeof OS !== 'undefined') raw = OS.getAppData('flstudio');
        else raw = localStorage.getItem('flstudio_project');
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data.bpm) state.bpm = data.bpm;
        if (data.tracks) data.tracks.forEach((steps, ti) => { if (TRACKS[ti]) TRACKS[ti].steps = steps; });
        if (data.mixer) state.mixer = data.mixer;
        if (data.pianoRoll) state.pianoRoll = data.pianoRoll;
        render();
        if (typeof Notifications !== 'undefined') Notifications.send('FL Studio', 'Project loaded', '📂');
      } catch(e) {}
    };

    // ── Undo/Redo ──────────────────────────────────────────────────────
    const pushUndo = () => {
      state.undoStack.push(TRACKS.map(t => [...t.steps]));
      if (state.undoStack.length > 30) state.undoStack.shift();
      state.redoStack = [];
    };
    const undo = () => {
      if (!state.undoStack.length) return;
      state.redoStack.push(TRACKS.map(t => [...t.steps]));
      const prev = state.undoStack.pop();
      prev.forEach((steps, ti) => { TRACKS[ti].steps = steps; });
      render();
    };
    const redo = () => {
      if (!state.redoStack.length) return;
      state.undoStack.push(TRACKS.map(t => [...t.steps]));
      const next = state.redoStack.pop();
      next.forEach((steps, ti) => { TRACKS[ti].steps = steps; });
      render();
    };

    // ── Render ─────────────────────────────────────────────────────────
    const render = () => {
      const tabLabels = { stepseq:'Step Seq', pianoroll:'Piano Roll', mixer:'Mixer', audioclips:'Audio Clips' };
      content.innerHTML = `
        <div style="display:flex;align-items:center;background:#111;border-bottom:1px solid #333;padding:3px 8px;gap:2px;flex-shrink:0;">
          <span style="font-size:16px;margin-right:4px;">🎹</span>
          <span style="font-weight:700;font-size:12px;color:#ff8c00;margin-right:8px;">FL Studio 21</span>
          ${[
            ['File', () => {
              const m = document.getElementById('fl-filemenu-'+id);
              if (m) m.style.display = m.style.display === 'none' ? 'block' : 'none';
            }],
            ['Edit', null], ['View', null], ['Add', null],
            ['Patterns', null], ['Tools', null],
            ['Options', () => {
              const v = prompt('BPM (40-300):', state.bpm);
              if (v && !isNaN(v)) { state.bpm = Math.max(40, Math.min(300, parseInt(v))); render(); }
            }],
            ['Help', () => alert('FL Studio 21 — Web Audio DAW\nShortcuts: Space=Play/Stop, Ctrl+Z=Undo, Ctrl+S=Save')]
          ].map(([label]) => `<span class="fl-menu-btn" data-menu="${label}" style="font-size:11px;color:#bbb;cursor:pointer;padding:3px 7px;border-radius:3px;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background=''">${label}</span>`).join('')}
          <div style="position:relative;display:inline-block;">
            <div id="fl-filemenu-${id}" style="display:none;position:absolute;top:22px;left:0;background:#2a2a2a;border:1px solid #444;border-radius:4px;z-index:999;min-width:140px;box-shadow:0 4px 12px rgba(0,0,0,0.5);">
              ${['📄 New Project', () => { if(confirm('New project? Unsaved changes will be lost.')) { TRACKS.forEach(t=>t.steps=Array(STEPS).fill(false)); state.pianoRoll=Array(PIANO_NOTES.length).fill(null).map(()=>Array(PR_COLS).fill(false)); render(); }},
                 ['💾 Save Project', saveProject],
                 ['📂 Load Project', loadProject]
                ].map(([lbl]) => `<div class="fl-filemenu-item" data-fmitem="${lbl}" style="padding:7px 14px;cursor:pointer;font-size:11px;color:#ddd;" onmouseover="this.style.background='rgba(255,140,0,0.2)'" onmouseout="this.style.background=''">${lbl}</div>`).join('')}
            </div>
          </div>
        </div>

        <div style="display:flex;align-items:center;background:#1e1e1e;border-bottom:1px solid #333;padding:5px 12px;gap:10px;flex-shrink:0;">
          <button id="fl-play-${id}" title="Play/Stop (Space)" style="width:34px;height:34px;border-radius:4px;background:${state.playing?'#c0392b':'#27ae60'};border:none;color:#fff;cursor:pointer;font-size:16px;">${state.playing?'⏹':'▶'}</button>
          <button id="fl-stop-${id}" title="Stop" style="width:34px;height:34px;border-radius:4px;background:#333;border:1px solid #444;color:#fff;cursor:pointer;font-size:16px;">⏹</button>
          <button id="fl-rec-${id}" title="Record" style="width:34px;height:34px;border-radius:4px;background:${state.recording?'#e74c3c':'#333'};border:1px solid #444;color:${state.recording?'#fff':'#e74c3c'};cursor:pointer;font-size:14px;">⏺</button>
          <button id="fl-loop-${id}" title="Loop" style="width:34px;height:34px;border-radius:4px;background:${state.loop?'#ff8c00':'#333'};border:1px solid #444;color:#fff;cursor:pointer;font-size:14px;">🔁</button>
          <button id="fl-metro-${id}" title="Metronome" style="width:34px;height:34px;border-radius:4px;background:${state.metronome?'#3498db':'#333'};border:1px solid #444;color:#fff;cursor:pointer;font-size:14px;">🎵</button>
          <div style="width:1px;height:28px;background:#333;"></div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:1px;">
            <span style="font-size:9px;color:#777;">BPM</span>
            <div style="display:flex;align-items:center;gap:3px;">
              <button id="fl-bpm-dn-${id}" style="width:16px;height:16px;background:#333;border:none;color:#fff;cursor:pointer;border-radius:2px;font-size:10px;line-height:1;">−</button>
              <span id="fl-bpm-val-${id}" style="font-size:18px;font-weight:700;color:#ff8c00;min-width:44px;text-align:center;cursor:pointer;" title="Double-click to type">${state.bpm}</span>
              <button id="fl-bpm-up-${id}" style="width:16px;height:16px;background:#333;border:none;color:#fff;cursor:pointer;border-radius:2px;font-size:10px;line-height:1;">+</button>
            </div>
          </div>
          <div style="width:1px;height:28px;background:#333;"></div>
          <div style="display:flex;flex-direction:column;gap:1px;">
            <span style="font-size:9px;color:#777;">Master</span>
            <input type="range" id="fl-mvol-${id}" min="0" max="100" value="${state.masterVol}" style="width:70px;accent-color:#ff8c00;" />
          </div>
          <div style="display:flex;flex-direction:column;gap:1px;">
            <span style="font-size:9px;color:#777;">Swing</span>
            <input type="range" id="fl-swing-${id}" min="0" max="100" value="${state.swing}" style="width:55px;accent-color:#ff8c00;" />
          </div>
          <div style="flex:1;"></div>
          <div style="display:flex;gap:3px;">
            ${Object.entries(tabLabels).map(([tab,label]) => `<button data-tab="${tab}" style="padding:5px 11px;border-radius:4px;background:${state.activeTab===tab?'#ff8c00':'#2a2a2a'};border:1px solid ${state.activeTab===tab?'#ff8c00':'#444'};color:#fff;cursor:pointer;font-size:11px;font-weight:${state.activeTab===tab?'700':'400'};">${label}</button>`).join('')}
          </div>
        </div>

        <div style="flex:1;display:flex;overflow:hidden;">
          ${state.activeTab === 'stepseq' ? renderStepSeq() : ''}
          ${state.activeTab === 'pianoroll' ? renderPianoRoll() : ''}
          ${state.activeTab === 'mixer' ? renderMixer() : ''}
          ${state.activeTab === 'audioclips' ? renderAudioClips() : ''}
        </div>
      `;
      bindEvents();
      if (state.playing) updateStepHighlight();
    };

    // ── Step Sequencer ─────────────────────────────────────────────────
    const renderStepSeq = () => `
      <div style="flex:1;overflow-y:auto;padding:10px 14px;background:#1a1a1a;">
        <div style="display:flex;align-items:center;margin-bottom:6px;padding-left:128px;gap:2px;">
          ${Array(STEPS).fill(0).map((_,i) => `<div style="width:34px;text-align:center;font-size:9px;color:${i%4===0?'#ff8c00':'#555'};">${i+1}</div>`).join('')}
        </div>
        ${TRACKS.map((track,ti) => `
          <div class="fl-step-row" style="display:flex;align-items:center;margin-bottom:3px;">
            <div style="width:118px;display:flex;align-items:center;gap:5px;flex-shrink:0;">
              <div style="width:9px;height:9px;border-radius:50%;background:${track.color};flex-shrink:0;"></div>
              <span style="font-size:11px;color:#ccc;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${track.name}</span>
              <button data-track="${ti}" data-action="mute" style="width:18px;height:18px;border-radius:2px;background:${state.mixer[ti].mute?'#e74c3c':'#333'};border:none;color:#fff;cursor:pointer;font-size:8px;font-weight:700;">M</button>
              <button data-track="${ti}" data-action="solo" style="width:18px;height:18px;border-radius:2px;background:${state.mixer[ti].solo?'#ff8c00':'#333'};border:none;color:#fff;cursor:pointer;font-size:8px;font-weight:700;">S</button>
            </div>
            <div style="display:flex;gap:2px;">
              ${track.steps.map((on,si) => `<button class="fl-step" data-track="${ti}" data-step="${si}" style="width:34px;height:28px;border-radius:3px;background:${on?track.color:(si%4===0?'#2e2e2e':'#252525')};border:1px solid ${si%4===0?'#3a3a3a':'#2e2e2e'};cursor:pointer;transition:background 0.08s;"></button>`).join('')}
            </div>
            <input type="range" data-track="${ti}" data-action="vol" min="0" max="100" value="${state.mixer[ti].vol}" style="width:55px;margin-left:8px;accent-color:${track.color};" title="Volume" />
          </div>
        `).join('')}
      </div>
    `;

    // ── Piano Roll ─────────────────────────────────────────────────────
    const renderPianoRoll = () => `
      <div style="flex:1;display:flex;overflow:hidden;background:#1a1a1a;">
        <div style="width:64px;flex-shrink:0;overflow-y:auto;border-right:1px solid #333;background:#1e1e1e;">
          ${PIANO_NOTES.map((note) => {
            const isBlack = note.includes('#');
            return `<div class="fl-piano-key" data-note="${note}" style="height:20px;display:flex;align-items:center;justify-content:flex-end;padding-right:5px;background:${isBlack?'#1a1a1a':'#2a2a2a'};border-bottom:1px solid #333;font-size:9px;color:${isBlack?'#777':'#bbb'};cursor:pointer;box-sizing:border-box;" onmouseover="this.style.background='${isBlack?'#2a3a4a':'#3a4a5a'}'" onmouseout="this.style.background='${isBlack?'#1a1a1a':'#2a2a2a'}'">${note}</div>`;
          }).join('')}
        </div>
        <div style="flex:1;overflow:auto;">
          <div style="display:flex;align-items:center;padding:4px 8px;background:#222;border-bottom:1px solid #333;gap:8px;flex-shrink:0;">
            <span style="font-size:10px;color:#888;">Track:</span>
            ${TRACKS.map((t,ti) => `<button data-seltrack="${ti}" style="padding:2px 8px;border-radius:3px;background:${state.selectedTrack===ti?t.color:'#333'};border:none;color:#fff;cursor:pointer;font-size:10px;">${t.name}</button>`).join('')}
          </div>
          <div style="display:grid;grid-template-columns:repeat(${PR_COLS},28px);grid-template-rows:repeat(${PIANO_NOTES.length},20px);">
            ${PIANO_NOTES.map((note,ni) => Array(PR_COLS).fill(0).map((_,ci) => {
              const on = state.pianoRoll[ni][ci];
              const isBlack = note.includes('#');
              return `<div class="fl-pr-cell" data-note="${ni}" data-col="${ci}" style="border-right:1px solid ${ci%4===0?'#3a3a3a':'#2a2a2a'};border-bottom:1px solid #2a2a2a;background:${on?TRACKS[state.selectedTrack].color:(isBlack?'#1e1e1e':'#242424')};cursor:pointer;box-sizing:border-box;"></div>`;
            }).join('')).join('')}
          </div>
        </div>
      </div>
    `;

    // ── Mixer ──────────────────────────────────────────────────────────
    const renderMixer = () => `
      <div style="flex:1;display:flex;overflow-x:auto;padding:14px 10px;gap:6px;background:#161616;align-items:flex-start;">
        ${TRACKS.map((track,ti) => `
          <div style="display:flex;flex-direction:column;align-items:center;gap:5px;min-width:68px;background:#222;border-radius:6px;padding:10px 6px 8px;border:1px solid ${state.mixer[ti].solo?'#ff8c00':'#333'};">
            <div style="width:9px;height:9px;border-radius:50%;background:${track.color};"></div>
            <span style="font-size:9px;color:#aaa;text-align:center;max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${track.name}</span>
            <canvas class="fl-eq-canvas" data-track="${ti}" width="56" height="36" style="border-radius:3px;background:#111;"></canvas>
            <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
              <span style="font-size:9px;color:#666;">Pan</span>
              <input type="range" data-mixer="${ti}" data-action="pan" min="-50" max="50" value="${state.mixer[ti].pan}" style="width:52px;accent-color:#aaa;" />
            </div>
            <div style="height:130px;display:flex;align-items:center;gap:3px;position:relative;">
              <input type="range" data-mixer="${ti}" data-action="vol" min="0" max="100" value="${state.mixer[ti].vol}"
                style="writing-mode:vertical-lr;direction:rtl;height:120px;width:22px;accent-color:${track.color};cursor:pointer;" orient="vertical" />
              <div style="width:6px;height:${Math.round(state.mixer[ti].vol * 1.2)}px;background:${track.color};border-radius:2px;max-height:120px;"></div>
            </div>
            <span style="font-size:9px;color:#888;">${state.mixer[ti].vol}%</span>
            <div style="display:flex;gap:3px;">
              <button data-mixer="${ti}" data-action="mute" style="padding:2px 6px;background:${state.mixer[ti].mute?'#e74c3c':'#333'};border:none;border-radius:2px;color:#fff;cursor:pointer;font-size:9px;font-weight:700;">M</button>
              <button data-mixer="${ti}" data-action="solo" style="padding:2px 6px;background:${state.mixer[ti].solo?'#ff8c00':'#333'};border:none;border-radius:2px;color:#fff;cursor:pointer;font-size:9px;font-weight:700;">S</button>
            </div>
          </div>
        `).join('')}
        <div style="display:flex;flex-direction:column;align-items:center;gap:5px;min-width:68px;background:#1a1a1a;border-radius:6px;padding:10px 6px 8px;border:2px solid #ff8c00;">
          <span style="font-size:9px;color:#ff8c00;font-weight:700;">MASTER</span>
          <div style="height:130px;display:flex;align-items:center;gap:3px;">
            <input type="range" id="fl-master-fader-${id}" min="0" max="100" value="${state.masterVol}"
              style="writing-mode:vertical-lr;direction:rtl;height:120px;width:22px;accent-color:#ff8c00;cursor:pointer;" orient="vertical" />
            <div style="width:6px;height:${Math.round(state.masterVol * 1.2)}px;background:#ff8c00;border-radius:2px;max-height:120px;"></div>
          </div>
          <span style="font-size:9px;color:#ff8c00;">${state.masterVol}%</span>
        </div>
      </div>
    `;

    // ── Audio Clips ────────────────────────────────────────────────────
    const renderAudioClips = () => `
      <div style="flex:1;display:flex;overflow:hidden;background:#1a1a1a;">
        <div style="width:220px;flex-shrink:0;background:#1e1e1e;border-right:1px solid #333;display:flex;flex-direction:column;">
          <div style="padding:10px;border-bottom:1px solid #333;">
            <button id="fl-import-audio-${id}" style="width:100%;padding:7px;background:#ff8c00;border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:12px;font-weight:700;">+ Import Audio</button>
            <input type="file" id="fl-audio-input-${id}" accept="audio/*" style="display:none;" />
          </div>
          <div style="flex:1;overflow-y:auto;padding:6px;">
            ${state.clips.length === 0 ? `<div style="text-align:center;color:#555;padding:20px;font-size:11px;">No audio clips.<br>Import an audio file.</div>` :
              state.clips.map(clip => `
                <div data-clipid="${clip.id}" style="padding:8px;margin-bottom:4px;border-radius:4px;background:${state.activeClip===clip.id?'rgba(255,140,0,0.2)':'#252525'};border:1px solid ${state.activeClip===clip.id?'#ff8c00':'#333'};cursor:pointer;" onmouseover="this.style.borderColor='#ff8c00'" onmouseout="this.style.borderColor='${state.activeClip===clip.id?'#ff8c00':'#333'}'">
                  <div style="font-size:11px;color:#ddd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${clip.name}</div>
                  <div style="font-size:9px;color:#777;margin-top:2px;">${clip.buffer ? (clip.buffer.duration).toFixed(2)+'s' : '...'}</div>
                </div>
              `).join('')}
          </div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
          ${state.activeClip ? (() => {
            const clip = state.clips.find(c => c.id === state.activeClip);
            if (!clip) return '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#555;">Select a clip</div>';
            return `
              <div style="padding:10px 14px;border-bottom:1px solid #333;display:flex;align-items:center;gap:10px;flex-shrink:0;">
                <span style="font-size:12px;color:#ff8c00;font-weight:700;">${clip.name}</span>
                <button id="fl-clip-play-${id}" style="padding:5px 14px;background:#27ae60;border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:12px;">▶ Play</button>
                <button id="fl-clip-stop-${id}" style="padding:5px 14px;background:#333;border:1px solid #444;border-radius:4px;color:#fff;cursor:pointer;font-size:12px;">⏹ Stop</button>
                <button id="fl-clip-delete-${id}" style="padding:5px 14px;background:#c0392b;border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:12px;">🗑 Delete</button>
              </div>
              <canvas id="fl-waveform-${id}" width="800" height="120" style="background:#111;border-bottom:1px solid #333;flex-shrink:0;width:100%;"></canvas>
              <div style="flex:1;overflow-y:auto;padding:14px;display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                <div style="background:#222;border-radius:6px;padding:12px;border:1px solid #333;">
                  <div style="font-size:11px;color:#ff8c00;font-weight:700;margin-bottom:8px;">⚡ Speed</div>
                  <input type="range" id="fl-speed-${id}" min="25" max="400" value="${Math.round((clip.speed||1)*100)}" style="width:100%;accent-color:#ff8c00;" />
                  <div style="font-size:11px;color:#aaa;margin-top:4px;text-align:center;">${((clip.speed||1)).toFixed(2)}x</div>
                </div>
                <div style="background:#222;border-radius:6px;padding:12px;border:1px solid #333;">
                  <div style="font-size:11px;color:#3498db;font-weight:700;margin-bottom:8px;">🌊 Reverb</div>
                  <input type="range" id="fl-reverb-${id}" min="0" max="100" value="${Math.round((clip.reverbAmt||0)*100)}" style="width:100%;accent-color:#3498db;" />
                  <div style="font-size:11px;color:#aaa;margin-top:4px;text-align:center;">${Math.round((clip.reverbAmt||0)*100)}%</div>
                </div>
                <div style="background:#222;border-radius:6px;padding:12px;border:1px solid #333;">
                  <div style="font-size:11px;color:#2ecc71;font-weight:700;margin-bottom:8px;">✂ Crop Start</div>
                  <input type="range" id="fl-cropstart-${id}" min="0" max="100" value="${Math.round((clip.cropStart||0)*100)}" style="width:100%;accent-color:#2ecc71;" />
                  <div style="font-size:11px;color:#aaa;margin-top:4px;text-align:center;">${clip.buffer ? ((clip.cropStart||0)*clip.buffer.duration).toFixed(2)+'s' : '0.00s'}</div>
                </div>
                <div style="background:#222;border-radius:6px;padding:12px;border:1px solid #333;">
                  <div style="font-size:11px;color:#e74c3c;font-weight:700;margin-bottom:8px;">✂ Crop End</div>
                  <input type="range" id="fl-cropend-${id}" min="0" max="100" value="${Math.round((clip.cropEnd||1)*100)}" style="width:100%;accent-color:#e74c3c;" />
                  <div style="font-size:11px;color:#aaa;margin-top:4px;text-align:center;">${clip.buffer ? ((clip.cropEnd||1)*clip.buffer.duration).toFixed(2)+'s' : '0.00s'}</div>
                </div>
                <div style="background:#222;border-radius:6px;padding:12px;border:1px solid #333;">
                  <div style="font-size:11px;color:#9b59b6;font-weight:700;margin-bottom:8px;">🎵 Pitch Shift</div>
                  <input type="range" id="fl-pitch-${id}" min="-12" max="12" value="${clip.pitchShift||0}" style="width:100%;accent-color:#9b59b6;" />
                  <div style="font-size:11px;color:#aaa;margin-top:4px;text-align:center;">${clip.pitchShift||0} semitones</div>
                </div>
              </div>
            `;
          })() : '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#555;font-size:13px;">Import and select an audio clip to edit</div>'}
        </div>
      </div>
    `;

    // ── Draw EQ curves on mixer canvases ───────────────────────────────
    const drawEQ = () => {
      content.querySelectorAll('.fl-eq-canvas').forEach(canvas => {
        const ctx2 = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        ctx2.clearRect(0, 0, w, h);
        ctx2.strokeStyle = '#ff8c00'; ctx2.lineWidth = 1.5;
        ctx2.beginPath();
        for (let x = 0; x < w; x++) {
          const freq = x / w;
          const y = h/2 + Math.sin(freq * Math.PI * 3) * (h/4) * (0.5 + Math.random() * 0.1);
          x === 0 ? ctx2.moveTo(x, y) : ctx2.lineTo(x, y);
        }
        ctx2.stroke();
      });
    };

    // ── Draw waveform ──────────────────────────────────────────────────
    const drawWaveform = () => {
      const canvas = document.getElementById(`fl-waveform-${id}`);
      if (!canvas) return;
      const clip = state.clips.find(c => c.id === state.activeClip);
      if (!clip || !clip.buffer) return;
      const ctx2 = canvas.getContext('2d');
      const w = canvas.offsetWidth || 800, h = 120;
      canvas.width = w;
      ctx2.fillStyle = '#111'; ctx2.fillRect(0, 0, w, h);
      const data = clip.buffer.getChannelData(0);
      const step = Math.ceil(data.length / w);
      const cropS = Math.floor((clip.cropStart||0) * data.length);
      const cropE = Math.floor((clip.cropEnd||1) * data.length);
      ctx2.strokeStyle = '#ff8c00'; ctx2.lineWidth = 1;
      ctx2.beginPath();
      for (let x = 0; x < w; x++) {
        const idx = Math.floor(x / w * data.length);
        const val = data[Math.min(idx, data.length-1)];
        const y = (1 - val) * h / 2;
        x === 0 ? ctx2.moveTo(x, y) : ctx2.lineTo(x, y);
      }
      ctx2.stroke();
      // Crop overlay
      const cs = (cropS / data.length) * w, ce = (cropE / data.length) * w;
      ctx2.fillStyle = 'rgba(0,0,0,0.5)';
      ctx2.fillRect(0, 0, cs, h);
      ctx2.fillRect(ce, 0, w - ce, h);
      ctx2.strokeStyle = '#2ecc71'; ctx2.lineWidth = 2;
      ctx2.beginPath(); ctx2.moveTo(cs, 0); ctx2.lineTo(cs, h); ctx2.stroke();
      ctx2.strokeStyle = '#e74c3c';
      ctx2.beginPath(); ctx2.moveTo(ce, 0); ctx2.lineTo(ce, h); ctx2.stroke();
    };

    // ── Clip playback ──────────────────────────────────────────────────
    let clipSource = null;
    const playClip = () => {
      const clip = state.clips.find(c => c.id === state.activeClip);
      if (!clip || !clip.buffer) return;
      try {
        const ctx = getCtx();
        if (clipSource) { try { clipSource.stop(); } catch(e) {} clipSource = null; }
        // Build reverb if needed
        let dest = getMasterGain();
        if (clip.reverbAmt > 0) {
          const convolver = ctx.createConvolver();
          const irLen = ctx.sampleRate * 2;
          const irBuf = ctx.createBuffer(2, irLen, ctx.sampleRate);
          for (let ch = 0; ch < 2; ch++) {
            const d = irBuf.getChannelData(ch);
            for (let i = 0; i < irLen; i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/irLen, 2);
          }
          convolver.buffer = irBuf;
          const dryGain = ctx.createGain(); dryGain.gain.value = 1 - clip.reverbAmt;
          const wetGain = ctx.createGain(); wetGain.gain.value = clip.reverbAmt;
          dryGain.connect(getMasterGain()); wetGain.connect(getMasterGain());
          convolver.connect(wetGain);
          // We'll route source through dryGain and convolver
          const merger = ctx.createGain();
          merger.connect(dryGain); merger.connect(convolver);
          dest = merger;
        }
        const src = ctx.createBufferSource();
        src.buffer = clip.buffer;
        src.playbackRate.value = (clip.speed || 1) * Math.pow(2, (clip.pitchShift||0)/12);
        src.connect(dest);
        const duration = clip.buffer.duration;
        const startOffset = (clip.cropStart||0) * duration;
        const endOffset = (clip.cropEnd||1) * duration;
        src.start(ctx.currentTime, startOffset, endOffset - startOffset);
        clipSource = src;
      } catch(e) { console.error(e); }
    };

    const stopClip = () => {
      if (clipSource) { try { clipSource.stop(); } catch(e) {} clipSource = null; }
    };

    // ── Bind Events ────────────────────────────────────────────────────
    const bindEvents = () => {
      // Tab switching
      content.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => { state.activeTab = btn.dataset.tab; render(); });
      });

      // File menu
      const fileMenuBtn = content.querySelector('[data-menu="File"]');
      if (fileMenuBtn) fileMenuBtn.addEventListener('click', () => {
        const m = document.getElementById(`fl-filemenu-${id}`);
        if (m) m.style.display = m.style.display === 'none' ? 'block' : 'none';
      });
      content.querySelectorAll('[data-fmitem]').forEach(item => {
        item.addEventListener('click', () => {
          const lbl = item.dataset.fmitem;
          document.getElementById(`fl-filemenu-${id}`).style.display = 'none';
          if (lbl.includes('New')) { if(confirm('New project? Unsaved changes will be lost.')) { TRACKS.forEach(t=>t.steps=Array(STEPS).fill(false)); state.pianoRoll=Array(PIANO_NOTES.length).fill(null).map(()=>Array(PR_COLS).fill(false)); render(); } }
          else if (lbl.includes('Save')) saveProject();
          else if (lbl.includes('Load')) loadProject();
        });
      });
      content.querySelectorAll('[data-menu="Edit"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const choice = prompt('Edit: (u)ndo / (r)edo');
          if (choice === 'u') undo(); else if (choice === 'r') redo();
        });
      });
      content.querySelectorAll('[data-menu="Options"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const v = prompt('BPM (40-300):', state.bpm);
          if (v && !isNaN(v)) { state.bpm = Math.max(40, Math.min(300, parseInt(v))); render(); }
        });
      });
      content.querySelectorAll('[data-menu="Help"]').forEach(btn => {
        btn.addEventListener('click', () => alert('FL Studio 21 — Web Audio DAW\nSpace = Play/Stop\nCtrl+Z = Undo\nCtrl+S = Save'));
      });

      // Transport
      const playBtn = document.getElementById(`fl-play-${id}`);
      if (playBtn) playBtn.addEventListener('click', () => {
        getCtx().resume();
        state.playing = !state.playing;
        if (state.playing) startPlayback(); else stopPlayback();
        render();
      });
      const stopBtn = document.getElementById(`fl-stop-${id}`);
      if (stopBtn) stopBtn.addEventListener('click', () => {
        state.playing = false; state.currentStep = 0; stopPlayback(); render();
      });
      const recBtn = document.getElementById(`fl-rec-${id}`);
      if (recBtn) recBtn.addEventListener('click', () => { state.recording = !state.recording; render(); });
      const loopBtn = document.getElementById(`fl-loop-${id}`);
      if (loopBtn) loopBtn.addEventListener('click', () => { state.loop = !state.loop; render(); });
      const metroBtn = document.getElementById(`fl-metro-${id}`);
      if (metroBtn) metroBtn.addEventListener('click', () => { state.metronome = !state.metronome; render(); });

      // BPM
      const bpmDn = document.getElementById(`fl-bpm-dn-${id}`);
      const bpmUp = document.getElementById(`fl-bpm-up-${id}`);
      const bpmVal = document.getElementById(`fl-bpm-val-${id}`);
      const updateBpm = () => {
        if (bpmVal) bpmVal.textContent = state.bpm;
        if (state.playing) { stopPlayback(); startPlayback(); }
      };
      if (bpmDn) bpmDn.addEventListener('click', () => { state.bpm = Math.max(40, state.bpm - 1); updateBpm(); });
      if (bpmUp) bpmUp.addEventListener('click', () => { state.bpm = Math.min(300, state.bpm + 1); updateBpm(); });
      if (bpmVal) bpmVal.addEventListener('dblclick', () => {
        const v = prompt('Enter BPM (40-300):', state.bpm);
        if (v && !isNaN(v)) { state.bpm = Math.max(40, Math.min(300, parseInt(v))); updateBpm(); }
      });

      // Master vol / swing
      const mvol = document.getElementById(`fl-mvol-${id}`);
      if (mvol) mvol.addEventListener('input', () => { state.masterVol = parseInt(mvol.value); getMasterGain(); });
      const swing = document.getElementById(`fl-swing-${id}`);
      if (swing) swing.addEventListener('input', () => { state.swing = parseInt(swing.value); });

      // Step sequencer
      content.querySelectorAll('.fl-step').forEach(btn => {
        btn.addEventListener('click', () => {
          const ti = parseInt(btn.dataset.track), si = parseInt(btn.dataset.step);
          pushUndo();
          TRACKS[ti].steps[si] = !TRACKS[ti].steps[si];
          btn.style.background = TRACKS[ti].steps[si] ? TRACKS[ti].color : (si%4===0?'#2e2e2e':'#252525');
          playDrum(TRACKS[ti].name, getCtx().currentTime);
        });
      });
      content.querySelectorAll('[data-action="mute"][data-track]').forEach(btn => {
        btn.addEventListener('click', () => {
          const ti = parseInt(btn.dataset.track);
          state.mixer[ti].mute = !state.mixer[ti].mute;
          btn.style.background = state.mixer[ti].mute ? '#e74c3c' : '#333';
        });
      });
      content.querySelectorAll('[data-action="solo"][data-track]').forEach(btn => {
        btn.addEventListener('click', () => {
          const ti = parseInt(btn.dataset.track);
          state.mixer[ti].solo = !state.mixer[ti].solo;
          btn.style.background = state.mixer[ti].solo ? '#ff8c00' : '#333';
        });
      });
      content.querySelectorAll('[data-action="vol"][data-track]').forEach(inp => {
        inp.addEventListener('input', () => { state.mixer[parseInt(inp.dataset.track)].vol = parseInt(inp.value); });
      });

      // Piano roll — key clicks
      content.querySelectorAll('.fl-piano-key').forEach(key => {
        key.addEventListener('click', () => {
          const freq = noteToFreq(key.dataset.note);
          playPiano(freq, 0.5);
        });
      });
      // Piano roll — track selector
      content.querySelectorAll('[data-seltrack]').forEach(btn => {
        btn.addEventListener('click', () => { state.selectedTrack = parseInt(btn.dataset.seltrack); render(); });
      });
      // Piano roll — grid cells
      content.querySelectorAll('.fl-pr-cell').forEach(cell => {
        cell.addEventListener('click', () => {
          const ni = parseInt(cell.dataset.note), ci = parseInt(cell.dataset.col);
          state.pianoRoll[ni][ci] = !state.pianoRoll[ni][ci];
          const isBlack = PIANO_NOTES[ni].includes('#');
          cell.style.background = state.pianoRoll[ni][ci] ? TRACKS[state.selectedTrack].color : (isBlack?'#1e1e1e':'#242424');
          if (state.pianoRoll[ni][ci]) playPiano(noteToFreq(PIANO_NOTES[ni]), 0.3);
        });
      });

      // Mixer controls
      content.querySelectorAll('[data-mixer]').forEach(el => {
        const ti = parseInt(el.dataset.mixer);
        const action = el.dataset.action;
        if (action === 'vol') el.addEventListener('input', () => { state.mixer[ti].vol = parseInt(el.value); render(); });
        if (action === 'mute') el.addEventListener('click', () => { state.mixer[ti].mute = !state.mixer[ti].mute; render(); });
        if (action === 'solo') el.addEventListener('click', () => { state.mixer[ti].solo = !state.mixer[ti].solo; render(); });
        if (action === 'pan') el.addEventListener('input', () => { state.mixer[ti].pan = parseInt(el.value); });
      });
      const masterFader = document.getElementById(`fl-master-fader-${id}`);
      if (masterFader) masterFader.addEventListener('input', () => { state.masterVol = parseInt(masterFader.value); getMasterGain(); render(); });

      // Audio clips
      const importBtn = document.getElementById(`fl-import-audio-${id}`);
      const fileInput = document.getElementById(`fl-audio-input-${id}`);
      if (importBtn && fileInput) {
        importBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', e => {
          const file = e.target.files[0]; if (!file) return;
          const reader = new FileReader();
          reader.onload = ev => {
            getCtx().decodeAudioData(ev.target.result.slice(0), buf => {
              const clip = { id: 'clip_'+Date.now(), name: file.name, buffer: buf, speed: 1, reverbAmt: 0, cropStart: 0, cropEnd: 1, pitchShift: 0 };
              state.clips.push(clip); state.activeClip = clip.id; render(); setTimeout(drawWaveform, 50);
            }, err => { if (typeof Notifications !== 'undefined') Notifications.send('FL Studio', 'Could not decode audio: '+file.name, '❌'); });
          };
          reader.readAsArrayBuffer(file);
          fileInput.value = '';
        });
      }
      content.querySelectorAll('[data-clipid]').forEach(el => {
        el.addEventListener('click', () => { state.activeClip = el.dataset.clipid; render(); setTimeout(drawWaveform, 50); });
      });
      const clipPlayBtn = document.getElementById(`fl-clip-play-${id}`);
      if (clipPlayBtn) clipPlayBtn.addEventListener('click', playClip);
      const clipStopBtn = document.getElementById(`fl-clip-stop-${id}`);
      if (clipStopBtn) clipStopBtn.addEventListener('click', stopClip);
      const clipDeleteBtn = document.getElementById(`fl-clip-delete-${id}`);
      if (clipDeleteBtn) clipDeleteBtn.addEventListener('click', () => {
        stopClip(); state.clips = state.clips.filter(c => c.id !== state.activeClip); state.activeClip = null; render();
      });

      // Clip controls
      const clip = state.clips.find(c => c.id === state.activeClip);
      if (clip) {
        const speedEl = document.getElementById(`fl-speed-${id}`);
        if (speedEl) speedEl.addEventListener('input', () => { clip.speed = parseInt(speedEl.value)/100; render(); setTimeout(drawWaveform,50); });
        const reverbEl = document.getElementById(`fl-reverb-${id}`);
        if (reverbEl) reverbEl.addEventListener('input', () => { clip.reverbAmt = parseInt(reverbEl.value)/100; render(); });
        const cropSEl = document.getElementById(`fl-cropstart-${id}`);
        if (cropSEl) cropSEl.addEventListener('input', () => { clip.cropStart = parseInt(cropSEl.value)/100; render(); setTimeout(drawWaveform,50); });
        const cropEEl = document.getElementById(`fl-cropend-${id}`);
        if (cropEEl) cropEEl.addEventListener('input', () => { clip.cropEnd = parseInt(cropEEl.value)/100; render(); setTimeout(drawWaveform,50); });
        const pitchEl = document.getElementById(`fl-pitch-${id}`);
        if (pitchEl) pitchEl.addEventListener('input', () => { clip.pitchShift = parseInt(pitchEl.value); render(); });
      }

      // Keyboard shortcuts
      if (!content._flKeyBound) {
        content._flKeyBound = true;
        content.setAttribute('tabindex', '0');
        content.addEventListener('keydown', e => {
          if (e.code === 'Space') { e.preventDefault(); document.getElementById(`fl-play-${id}`) && document.getElementById(`fl-play-${id}`).click(); }
          if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
          if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
          if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveProject(); }
        });
      }

      // Draw EQ after render
      setTimeout(drawEQ, 30);
      if (state.activeTab === 'audioclips' && state.activeClip) setTimeout(drawWaveform, 50);
    };

    render();

    // Cleanup on window close
    const cleanupObs = new MutationObserver(() => {
      if (!document.body.contains(content)) {
        stopPlayback(); stopClip();
        if (state.audioCtx) { try { state.audioCtx.close(); } catch(e) {} }
        cleanupObs.disconnect();
      }
    });
    cleanupObs.observe(document.body, { childList: true, subtree: true });
  }
});
