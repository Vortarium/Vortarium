// ===== ZOOM =====
AppLauncher.register('zoom', {
  title: 'Zoom', icon: '📹',

  launch() {
    const id = WM.create({ title: 'Zoom', icon: '📹', width: 1000, height: 700, appId: 'zoom' });
    const content = WM.getContent(id);
    content.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;background:#1f1f1f;color:#fff;font-family:"Segoe UI",sans-serif;';

    // ── Media streams ──────────────────────────────────────────────────
    const streams = { camera: null, mic: null, screen: null, screenAudio: null };

    const stopStream = (key) => {
      if (streams[key]) { streams[key].getTracks().forEach(t => t.stop()); streams[key] = null; }
    };

    const stopAllStreams = () => Object.keys(streams).forEach(stopStream);

    // ── State ──────────────────────────────────────────────────────────
    const state = {
      inMeeting: false,
      isHost: true,
      participants: [],
      myVideo: false,
      myAudio: false,
      isSharing: false,
      chatMessages: [],
      chatOpen: false,
      screenPreviewOpen: false,
      screenViewMode: 'main', // 'main', 'split', 'focus'
      meetingId: null,
    };

    const botNames = ['Alex Johnson','Sarah Chen','Mike Rodriguez','Emma Wilson','David Kim','Lisa Thompson','James Park','Maria Garcia','Chris Lee','Amy Taylor','Robert Brown','Jennifer White','Daniel Garcia','Emily Davis','Matthew Martinez','Sophia Anderson','Thomas Wilson','Isabella Moore','Joseph Taylor','Charlotte Martin'];
    const botAvatars = ['👨‍💼','👩‍💼','👨‍💻','👩‍💻','👨‍🎓','👩‍🎓','👨‍🔬','👩‍🔬','👨‍🎨','👩‍🎨','👨‍⚕️','👩‍⚕️','👨‍🏫','👩‍🏫','👨‍🌾','👩‍🌾','👨‍🚀','👩‍🚀','👨‍🍳','👩‍🍳'];
    const chatResponses = ['Great presentation!','Can you share that slide again?','I have a question','Thanks for sharing','This is very helpful','Could you speak up a bit?','I was on mute, sorry!','Can everyone see my screen?','Good idea!','See you next week'];

    const generateParticipants = () => {
      const count = Math.floor(Math.random() * 10) + 1;
      const list = [{ id:'user', name: (typeof OS !== 'undefined' && OS.settings.username) || 'You', avatar:'👤', video:state.myVideo, audio:state.myAudio, isHost:state.isHost, isUser:true }];
      for (let i = 1; i < count; i++) {
        list.push({ id:'bot_'+i, name:botNames[i % botNames.length], avatar:botAvatars[i % botAvatars.length], video:Math.random()>0.3, audio:Math.random()>0.2, isHost:false, isUser:false });
      }
      return list;
    };

    const addChat = (sender, message, isSystem=false) => {
      state.chatMessages.push({ id:Date.now(), sender, message, ts: new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}), isSystem });
    };

    let activityInterval = null;
    const startActivity = () => {
      activityInterval = setInterval(() => {
        if (!state.inMeeting) return;
        if (Math.random() < 0.12) {
          const bots = state.participants.filter(p => !p.isUser);
          if (bots.length) addChat(bots[Math.floor(Math.random()*bots.length)].name, chatResponses[Math.floor(Math.random()*chatResponses.length)]);
        }
        state.participants.forEach(p => {
          if (!p.isUser) {
            if (Math.random() < 0.02) p.video = !p.video;
            if (Math.random() < 0.01) p.audio = !p.audio;
          }
        });
        render();
      }, 8000);
    };

    // ── Camera / Mic helpers ───────────────────────────────────────────
    const startCamera = async () => {
      try {
        streams.camera = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        state.myVideo = true;
        const userP = state.participants.find(p => p.isUser);
        if (userP) userP.video = true;
        render();
        // Attach stream to video element after render
        setTimeout(() => {
          const vid = document.getElementById(`zoom-selfvid-${id}`);
          if (vid && streams.camera) { vid.srcObject = streams.camera; vid.play().catch(()=>{}); }
        }, 50);
      } catch(e) {
        addChat('System', 'Camera access denied: ' + e.message, true);
        render();
      }
    };

    const stopCamera = () => {
      stopStream('camera');
      state.myVideo = false;
      const userP = state.participants.find(p => p.isUser);
      if (userP) userP.video = false;
      render();
    };

    const startMic = async () => {
      try {
        streams.mic = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        state.myAudio = true;
        const userP = state.participants.find(p => p.isUser);
        if (userP) userP.audio = true;
        render();
      } catch(e) {
        addChat('System', 'Microphone access denied: ' + e.message, true);
        render();
      }
    };

    const stopMic = () => {
      stopStream('mic');
      state.myAudio = false;
      const userP = state.participants.find(p => p.isUser);
      if (userP) userP.audio = false;
      render();
    };

    const startScreenShare = async () => {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        streams.screen = screenStream;
        state.isSharing = true;
        addChat('System', 'You started sharing your screen', true);
        render();
        // Attach to preview video after render
        setTimeout(() => {
          const prev = document.getElementById(`zoom-screenprev-${id}`);
          if (prev && streams.screen) { prev.srcObject = streams.screen; prev.play().catch(()=>{}); }
          // Also attach to the main share view
          const main = document.getElementById(`zoom-screenmain-${id}`);
          if (main && streams.screen) { main.srcObject = streams.screen; main.play().catch(()=>{}); }
        }, 50);
        // Handle user stopping share via browser UI
        screenStream.getVideoTracks()[0].addEventListener('ended', () => {
          stopScreenShare(false);
        });
      } catch(e) {
        if (e.name !== 'NotAllowedError') addChat('System', 'Screen share failed: ' + e.message, true);
        render();
      }
    };

    const stopScreenShare = (doRender=true) => {
      stopStream('screen');
      state.isSharing = false;
      state.screenPreviewOpen = false;
      addChat('System', 'Screen sharing stopped', true);
      if (doRender) render();
    };

    // ── Render ─────────────────────────────────────────────────────────
    const render = () => {
      if (!state.inMeeting) {
        content.innerHTML = `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg,#2D8CFF,#1E5F99);padding:40px;">
            <div style="text-align:center;margin-bottom:40px;">
              <div style="font-size:64px;margin-bottom:16px;">📹</div>
              <div style="font-size:32px;font-weight:700;margin-bottom:8px;">Zoom</div>
              <div style="font-size:16px;color:rgba(255,255,255,0.8);">Video Communications</div>
            </div>
            <div style="background:rgba(255,255,255,0.1);backdrop-filter:blur(10px);border-radius:12px;padding:32px;max-width:400px;width:100%;">
              <div style="font-size:18px;font-weight:600;margin-bottom:24px;text-align:center;">Join or Start a Meeting</div>
              <input type="text" id="zoom-meeting-id-${id}" placeholder="Enter Meeting ID" value="${state.meetingId || ''}"
                style="width:100%;padding:12px;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.3);border-radius:6px;color:#fff;font-size:14px;outline:none;margin-bottom:16px;box-sizing:border-box;" />
              <div style="display:flex;gap:12px;margin-bottom:16px;">
                <button id="zoom-join-${id}" style="flex:1;padding:12px;background:#0E72ED;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:14px;font-weight:600;">Join Meeting</button>
                <button id="zoom-start-${id}" style="flex:1;padding:12px;background:#FF8C00;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:14px;font-weight:600;">Start Meeting</button>
              </div>
              ${state.chatMessages.length > 0 ? `
                <div style="margin-top:16px;padding:12px;background:rgba(0,0,0,0.2);border-radius:6px;">
                  <div style="font-size:12px;color:#aaa;margin-bottom:8px;">Previous meeting chat preserved</div>
                  <button id="zoom-rejoin-${id}" style="width:100%;padding:10px;background:#27ae60;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:13px;font-weight:600;">Rejoin Previous Meeting</button>
                </div>` : ''}
              <div style="font-size:11px;color:rgba(255,255,255,0.6);text-align:center;">Camera and microphone will be requested when you join</div>
            </div>
          </div>`;
      } else {
        content.innerHTML = `
          <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
            <div style="display:flex;align-items:center;padding:8px 16px;background:#1f1f1f;border-bottom:1px solid #333;flex-shrink:0;">
              <div style="display:flex;align-items:center;gap:8px;">
                <div style="width:8px;height:8px;border-radius:50%;background:#00ff00;"></div>
                <span style="font-size:13px;">Meeting in progress</span>
              </div>
              <div style="flex:1;text-align:center;font-size:14px;font-weight:600;">Team Meeting ${state.meetingId ? `(${state.meetingId})` : ''}</div>
              <div style="font-size:12px;color:#aaa;">${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
            </div>

            <div style="flex:1;display:flex;overflow:hidden;">
              <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;position:relative;">
                ${state.isSharing ? `
                  <div style="flex:1;background:#000;display:flex;align-items:center;justify-content:center;position:relative;">
                    ${state.screenViewMode === 'main' ? `
                      <video id="zoom-screenmain-${id}" autoplay muted style="max-width:100%;max-height:100%;border-radius:8px;"></video>
                    ` : state.screenViewMode === 'split' ? `
                      <div style="display:flex;gap:8px;width:100%;height:100%;padding:8px;">
                        <div style="flex:1;background:#222;border-radius:8px;display:flex;align-items:center;justify-content:center;">
                          <video id="zoom-screenmain-${id}" autoplay muted style="max-width:100%;max-height:100%;border-radius:8px;"></video>
                        </div>
                        <div style="flex:1;background:#222;border-radius:8px;display:flex;flex-direction:column;gap:4px;padding:8px;overflow-y:auto;">
                          ${state.participants.slice(0,6).map(p => `
                            <div style="aspect-ratio:16/9;background:#333;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:24px;position:relative;">
                              ${p.isUser && state.myVideo ? `<video id="zoom-selfvid-${id}" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:4px;"></video>` : (p.video ? p.avatar : '📷')}
                              <div style="position:absolute;bottom:2px;left:4px;font-size:8px;background:rgba(0,0,0,0.7);padding:1px 4px;border-radius:2px;">${p.name.split(' ')[0]}</div>
                            </div>`).join('')}
                        </div>
                      </div>
                    ` : `
                      <div style="width:100%;height:100%;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;padding:8px;overflow-y:auto;">
                        <div style="aspect-ratio:16/9;background:#222;border-radius:8px;display:flex;align-items:center;justify-content:center;position:relative;grid-column:1/-1;">
                          <video id="zoom-screenmain-${id}" autoplay muted style="max-width:100%;max-height:100%;border-radius:8px;"></video>
                          <div style="position:absolute;top:8px;left:8px;background:rgba(231,76,60,0.9);padding:4px 10px;border-radius:4px;font-size:11px;font-weight:700;">● SHARING</div>
                        </div>
                        ${state.participants.slice(0,6).map(p => `
                          <div style="aspect-ratio:16/9;background:#333;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:24px;position:relative;">
                            ${p.isUser && state.myVideo ? `<video id="zoom-selfvid-${id}" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:4px;"></video>` : (p.video ? p.avatar : '📷')}
                            <div style="position:absolute;bottom:2px;left:4px;font-size:8px;background:rgba(0,0,0,0.7);padding:1px 4px;border-radius:2px;">${p.name.split(' ')[0]}</div>
                          </div>`).join('')}
                      </div>
                    `}
                    <div style="position:absolute;top:12px;left:12px;background:rgba(231,76,60,0.9);padding:4px 10px;border-radius:4px;font-size:11px;font-weight:700;">● SHARING</div>
                    <button id="zoom-stop-share-${id}" style="position:absolute;top:12px;right:12px;padding:6px 14px;background:#ff4444;border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:12px;">Stop Sharing</button>
                    <div style="position:absolute;top:12px;left:50%;transform:translateX(-50%);display:flex;gap:4px;">
                      <button id="zoom-view-main-${id}" style="padding:4px 8px;background:${state.screenViewMode==='main'?'#0E72ED':'#333'};border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:10px;">Main</button>
                      <button id="zoom-view-split-${id}" style="padding:4px 8px;background:${state.screenViewMode==='split'?'#0E72ED':'#333'};border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:10px;">Split</button>
                      <button id="zoom-view-focus-${id}" style="padding:4px 8px;background:${state.screenViewMode==='focus'?'#0E72ED':'#333'};border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:10px;">Focus</button>
                    </div>
                  </div>
                  <div style="position:absolute;bottom:80px;right:12px;display:flex;flex-direction:column;gap:6px;z-index:10;">
                    ${state.participants.slice(0,4).map(p => `
                      <div style="width:120px;height:68px;background:#333;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:24px;position:relative;border:2px solid ${p.isUser?'#0E72ED':'transparent'};">
                        ${p.isUser && state.myVideo ? `<video id="zoom-selfthumb-${id}" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:4px;"></video>` : (p.video ? p.avatar : '📷')}
                        <div style="position:absolute;bottom:2px;left:4px;font-size:8px;background:rgba(0,0,0,0.7);padding:1px 4px;border-radius:2px;">${p.name.split(' ')[0]}</div>
                        ${!p.audio ? '<div style="position:absolute;top:2px;right:2px;font-size:10px;">🔇</div>' : ''}
                      </div>`).join('')}
                  </div>
                ` : `
                  <div style="flex:1;padding:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;overflow-y:auto;">
                    ${state.participants.map(p => `
                      <div style="aspect-ratio:16/9;background:#2a2a2a;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:48px;position:relative;border:3px solid ${p.isUser?'#0E72ED':'transparent'};overflow:hidden;">
                        ${p.isUser && state.myVideo
                          ? `<video id="zoom-selfvid-${id}" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover;"></video>`
                          : (p.video ? `<span style="font-size:48px;">${p.avatar}</span>` : '<span style="font-size:32px;opacity:0.3;">📷</span>')}
                        <div style="position:absolute;bottom:8px;left:8px;font-size:12px;background:rgba(0,0,0,0.7);padding:4px 8px;border-radius:4px;">${p.name}${p.isUser?' (You)':''}</div>
                        ${!p.audio ? '<div style="position:absolute;top:8px;right:8px;font-size:16px;">🔇</div>' : ''}
                        ${p.isHost ? '<div style="position:absolute;top:8px;left:8px;font-size:11px;background:#FF8C00;padding:2px 6px;border-radius:4px;">Host</div>' : ''}
                      </div>`).join('')}
                  </div>
                `}
              </div>

              ${state.chatOpen ? `
                <div style="width:280px;background:#2a2a2a;border-left:1px solid #333;display:flex;flex-direction:column;flex-shrink:0;">
                  <div style="padding:10px 12px;border-bottom:1px solid #333;display:flex;align-items:center;justify-content:space-between;">
                    <span style="font-size:13px;font-weight:600;">Chat</span>
                    <button id="zoom-close-chat-${id}" style="background:transparent;border:none;color:#aaa;cursor:pointer;font-size:16px;">✕</button>
                  </div>
                  <div id="zoom-chat-messages-${id}" style="flex:1;overflow-y:auto;padding:8px;">
                    ${state.chatMessages.map(msg => `
                      <div style="margin-bottom:10px;${msg.isSystem?'text-align:center;':''}">
                        ${msg.isSystem
                          ? `<div style="font-size:11px;color:#888;font-style:italic;">${msg.message}</div>`
                          : `<div style="font-size:11px;color:#aaa;margin-bottom:2px;">${msg.sender} · ${msg.ts}</div>
                             <div style="font-size:12px;line-height:1.4;">${msg.message}</div>`}
                      </div>`).join('')}
                  </div>
                  <div style="padding:8px;border-top:1px solid #333;display:flex;gap:6px;">
                    <input id="zoom-chat-input-${id}" type="text" placeholder="Type a message..."
                      style="flex:1;padding:7px;background:#1a1a1a;border:1px solid #444;border-radius:4px;color:#fff;font-size:12px;outline:none;" />
                    <button id="zoom-send-chat-${id}" style="padding:7px 10px;background:#0E72ED;border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:12px;">Send</button>
                  </div>
                </div>` : ''}

              ${state.screenPreviewOpen && state.isSharing ? `
                <div style="width:280px;background:#111;border-left:1px solid #333;display:flex;flex-direction:column;flex-shrink:0;">
                  <div style="padding:10px 12px;border-bottom:1px solid #333;display:flex;align-items:center;justify-content:space-between;">
                    <span style="font-size:13px;font-weight:600;">🖥️ Screen Preview</span>
                    <button id="zoom-close-preview-${id}" style="background:transparent;border:none;color:#aaa;cursor:pointer;font-size:16px;">✕</button>
                  </div>
                  <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:8px;background:#000;">
                    <video id="zoom-screenprev-${id}" autoplay muted style="width:100%;border-radius:6px;"></video>
                  </div>
                  <div style="padding:8px;font-size:11px;color:#888;text-align:center;">What others see</div>
                </div>` : ''}
            </div>

            <div style="display:flex;align-items:center;justify-content:center;padding:12px 16px;background:#1a1a1a;border-top:1px solid #333;gap:10px;flex-shrink:0;flex-wrap:wrap;">
              <button id="zoom-audio-${id}" title="${state.myAudio?'Mute':'Unmute'}" style="display:flex;flex-direction:column;align-items:center;gap:3px;width:56px;height:56px;border-radius:12px;background:${state.myAudio?'#333':'#ff4444'};border:none;color:#fff;cursor:pointer;font-size:20px;justify-content:center;">${state.myAudio?'🎤':'🔇'}<span style="font-size:9px;">${state.myAudio?'Mute':'Unmute'}</span></button>
              <button id="zoom-video-${id}" title="${state.myVideo?'Stop Video':'Start Video'}" style="display:flex;flex-direction:column;align-items:center;gap:3px;width:56px;height:56px;border-radius:12px;background:${state.myVideo?'#333':'#ff4444'};border:none;color:#fff;cursor:pointer;font-size:20px;justify-content:center;">${state.myVideo?'📹':'📷'}<span style="font-size:9px;">${state.myVideo?'Stop':'Start'}</span></button>
              <button id="zoom-share-${id}" title="Share Screen" style="display:flex;flex-direction:column;align-items:center;gap:3px;padding:0 14px;height:56px;border-radius:12px;background:${state.isSharing?'#27ae60':'#333'};border:none;color:#fff;cursor:pointer;font-size:20px;justify-content:center;">🖥️<span style="font-size:9px;">${state.isSharing?'Sharing':'Share'}</span></button>
              ${state.isSharing ? `<button id="zoom-preview-${id}" title="Screen Preview" style="display:flex;flex-direction:column;align-items:center;gap:3px;padding:0 14px;height:56px;border-radius:12px;background:${state.screenPreviewOpen?'#0E72ED':'#333'};border:none;color:#fff;cursor:pointer;font-size:20px;justify-content:center;">👁️<span style="font-size:9px;">Preview</span></button>` : ''}
              <button id="zoom-chat-btn-${id}" title="Chat" style="display:flex;flex-direction:column;align-items:center;gap:3px;padding:0 14px;height:56px;border-radius:12px;background:${state.chatOpen?'#0E72ED':'#333'};border:none;color:#fff;cursor:pointer;font-size:20px;justify-content:center;">💬<span style="font-size:9px;">Chat${state.chatMessages.filter(m=>!m.isSystem).length?` (${state.chatMessages.filter(m=>!m.isSystem).length})`:''}  </span></button>
              <button style="display:flex;flex-direction:column;align-items:center;gap:3px;padding:0 14px;height:56px;border-radius:12px;background:#333;border:none;color:#fff;cursor:pointer;font-size:20px;justify-content:center;">👥<span style="font-size:9px;">${state.participants.length}</span></button>
              <button id="zoom-leave-${id}" style="display:flex;flex-direction:column;align-items:center;gap:3px;padding:0 16px;height:56px;border-radius:12px;background:#ff4444;border:none;color:#fff;cursor:pointer;font-size:20px;justify-content:center;">📵<span style="font-size:9px;font-weight:600;">Leave</span></button>
            </div>
          </div>`;
      }

      bindEvents();
      // Re-attach live streams after render
      setTimeout(() => {
        if (streams.camera) {
          const v = document.getElementById(`zoom-selfvid-${id}`) || document.getElementById(`zoom-selfthumb-${id}`);
          if (v) { v.srcObject = streams.camera; v.play().catch(()=>{}); }
        }
        if (streams.screen) {
          const sm = document.getElementById(`zoom-screenmain-${id}`);
          if (sm) { sm.srcObject = streams.screen; sm.play().catch(()=>{}); }
          const sp = document.getElementById(`zoom-screenprev-${id}`);
          if (sp) { sp.srcObject = streams.screen; sp.play().catch(()=>{}); }
        }
        // Scroll chat
        const chatEl = document.getElementById(`zoom-chat-messages-${id}`);
        if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
      }, 30);
    };

    const bindEvents = () => {
      const on = (elId, evt, fn) => { const el = document.getElementById(elId); if (el) el.addEventListener(evt, fn); };

      on(`zoom-join-${id}`, 'click', () => {
        const meetingIdInput = document.getElementById(`zoom-meeting-id-${id}`);
        state.meetingId = meetingIdInput?.value || Math.random().toString(36).substring(2, 11).toUpperCase();
        state.inMeeting = true; state.isHost = false;
        state.participants = generateParticipants();
        addChat('System', 'You joined the meeting', true);
        render(); startActivity();
      });
      on(`zoom-start-${id}`, 'click', () => {
        state.meetingId = Math.random().toString(36).substring(2, 11).toUpperCase();
        state.inMeeting = true; state.isHost = true;
        state.participants = generateParticipants();
        addChat('System', 'Meeting started', true);
        render(); startActivity();
      });

      on(`zoom-audio-${id}`, 'click', () => {
        if (state.myAudio) stopMic(); else startMic();
      });
      on(`zoom-video-${id}`, 'click', () => {
        if (state.myVideo) stopCamera(); else startCamera();
      });
      on(`zoom-share-${id}`, 'click', () => {
        if (state.isSharing) stopScreenShare(); else startScreenShare();
      });
      on(`zoom-stop-share-${id}`, 'click', () => stopScreenShare());
      on(`zoom-preview-${id}`, 'click', () => {
        state.screenPreviewOpen = !state.screenPreviewOpen; render();
      });
      on(`zoom-view-main-${id}`, 'click', () => { state.screenViewMode = 'main'; render(); });
      on(`zoom-view-split-${id}`, 'click', () => { state.screenViewMode = 'split'; render(); });
      on(`zoom-view-focus-${id}`, 'click', () => { state.screenViewMode = 'focus'; render(); });
      on(`zoom-close-preview-${id}`, 'click', () => {
        state.screenPreviewOpen = false; render();
      });
      on(`zoom-chat-btn-${id}`, 'click', () => { state.chatOpen = !state.chatOpen; render(); });
      on(`zoom-close-chat-${id}`, 'click', () => { state.chatOpen = false; render(); });

      const sendMsg = () => {
        const inp = document.getElementById(`zoom-chat-input-${id}`);
        if (!inp || !inp.value.trim()) return;
        addChat((typeof OS !== 'undefined' && OS.settings.username) || 'You', inp.value.trim());
        inp.value = '';
        render();
      };
      on(`zoom-send-chat-${id}`, 'click', sendMsg);
      const chatInp = document.getElementById(`zoom-chat-input-${id}`);
      if (chatInp) chatInp.addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(); });

      on(`zoom-leave-${id}`, 'click', () => {
        clearInterval(activityInterval);
        stopAllStreams();
        state.inMeeting = false;
        state.participants = [];
        state.chatOpen = false; state.isSharing = false; state.screenPreviewOpen = false;
        state.myVideo = false; state.myAudio = false;
        render();
      });
      on(`zoom-rejoin-${id}`, 'click', () => {
        state.inMeeting = true;
        state.participants = generateParticipants();
        addChat('System', 'You rejoined the meeting', true);
        render(); startActivity();
      });
    };

    render();

    // Cleanup when window is closed
    const cleanupObs = new MutationObserver(() => {
      if (!document.body.contains(content)) {
        clearInterval(activityInterval);
        stopAllStreams();
        cleanupObs.disconnect();
      }
    });
    cleanupObs.observe(document.body, { childList: true, subtree: true });
  }
});
