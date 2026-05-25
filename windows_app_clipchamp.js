// ===== CLIPCHAMP — Video Editor =====
AppLauncher.register('clipchamp', {
  title: 'Clipchamp', icon: '🎬',

  launch() {
    const id = WM.create({ title:'Clipchamp', icon:'🎬', width:1200, height:750, appId:'clipchamp' });
    const content = WM.getContent(id);
    content.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;background:#1a1a1a;color:#fff;font-family:"Segoe UI",sans-serif;';

    const saved = OS.getAppData('clipchamp') || {};
    const state = {
      project: { name: 'Untitled Project', duration: 0 },
      timeline: [],  // { id, type, file, name, start, duration, track, x, w }
      selectedClip: null,
      playing: false,
      currentTime: 0,
      zoom: 1,
      tracks: [
        { id: 'video1', type: 'video', name: 'Video Track 1', height: 60 },
        { id: 'video2', type: 'video', name: 'Video Track 2', height: 60 },
        { id: 'audio1', type: 'audio', name: 'Audio Track 1', height: 40 },
        { id: 'audio2', type: 'audio', name: 'Audio Track 2', height: 40 },
      ],
      mediaLibrary: saved.mediaLibrary || [],
      exportProgress: 0,
      exporting: false,
    };

    const save = () => OS.setAppData('clipchamp', { mediaLibrary: state.mediaLibrary, timeline: state.timeline, project: state.project });

    let playInterval = null;
    const fmtTime = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

    const render = () => {
      content.innerHTML = `
        <!-- Menu bar -->
        <div style="display:flex;align-items:center;background:#2a2a2a;border-bottom:1px solid #111;padding:0 8px;flex-shrink:0;">
          ${['File','Edit','View','Insert','Tools','Help'].map(m=>`<button style="padding:6px 12px;background:transparent;border:none;color:#ccc;cursor:pointer;font-size:12px;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='transparent'">${m}</button>`).join('')}
          <div style="flex:1;"></div>
          <span style="font-size:11px;color:rgba(255,255,255,0.3);padding-right:8px;">Clipchamp 2.0.1</span>
        </div>

        <!-- Main layout -->
        <div style="flex:1;display:flex;overflow:hidden;">
          
          <!-- Left panel - Media Library -->
          <div style="width:250px;background:#252525;border-right:1px solid #111;display:flex;flex-direction:column;flex-shrink:0;">
            <div style="padding:12px;border-bottom:1px solid #111;">
              <div style="font-size:14px;font-weight:600;margin-bottom:8px;">Media Library</div>
              <button id="clip-import-${id}" style="width:100%;padding:8px;background:#0078d4;border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:12px;">+ Import Media</button>
            </div>
            <div style="flex:1;overflow-y:auto;padding:8px;">
              ${state.mediaLibrary.length === 0 ? 
                `<div style="text-align:center;color:rgba(255,255,255,0.3);padding:20px;font-size:12px;">No media files<br>Click Import to add videos, images, or audio</div>` :
                state.mediaLibrary.map(media => `
                  <div draggable="true" data-mediaid="${media.id}" style="background:#333;border-radius:6px;padding:8px;margin-bottom:8px;cursor:grab;border:1px solid transparent;" onmouseover="this.style.borderColor='#0078d4'" onmouseout="this.style.borderColor='transparent'">
                    <div style="font-size:24px;text-align:center;margin-bottom:4px;">${media.type === 'video' ? '🎞️' : media.type === 'audio' ? '🎵' : '🖼️'}</div>
                    <div style="font-size:11px;text-align:center;word-break:break-all;">${media.name}</div>
                    <div style="font-size:10px;text-align:center;color:rgba(255,255,255,0.4);margin-top:2px;">${media.duration ? fmtTime(media.duration) : ''}</div>
                  </div>
                `).join('')}
            </div>
          </div>

          <!-- Center - Preview and Timeline -->
          <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
            
            <!-- Preview area -->
            <div style="flex:1;background:#000;position:relative;display:flex;align-items:center;justify-content:center;min-height:300px;">
              <div id="clip-preview-${id}" style="width:640px;height:360px;background:#111;border-radius:8px;position:relative;overflow:hidden;">
                ${state.timeline.length === 0 && state.mediaLibrary.length === 0 ? 
                  `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:rgba(255,255,255,0.3);">
                    <div style="font-size:48px;">🎬</div>
                    <div>Import media and drag to timeline</div>
                  </div>` :
                  state.timeline.length === 0 && state.mediaLibrary.length > 0 ?
                  (() => {
                    const firstMedia = state.mediaLibrary[0];
                    if (firstMedia.type === 'video') {
                      return `<video src="${firstMedia.dataUrl}" style="width:100%;height:100%;object-fit:contain;" controls></video>`;
                    } else if (firstMedia.type === 'image') {
                      return `<img src="${firstMedia.dataUrl}" style="width:100%;height:100%;object-fit:contain;" />`;
                    } else {
                      return `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.5);"><div style="font-size:64px;">🎵</div></div>`;
                    }
                  })() :
                  `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.5);">
                    <div style="font-size:64px;">▶️</div>
                  </div>`}
                ${state.playing ? `<div style="position:absolute;top:8px;left:8px;background:rgba(231,76,60,0.9);padding:4px 8px;border-radius:4px;font-size:11px;font-weight:700;display:flex;align-items:center;gap:4px;"><div style="width:6px;height:6px;border-radius:50%;background:#fff;animation:pulse 1s infinite;"></div>PLAYING</div>` : ''}
              </div>
              
              <!-- Playback controls -->
              <div style="position:absolute;bottom:16px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);padding:8px 16px;border-radius:24px;display:flex;align-items:center;gap:12px;">
                <button id="clip-play-${id}" style="width:36px;height:36px;border-radius:50%;background:#0078d4;border:none;color:#fff;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;">${state.playing ? '⏸️' : '▶️'}</button>
                <span style="font-size:12px;min-width:60px;">${fmtTime(state.currentTime)}</span>
                <input type="range" id="clip-scrub-${id}" min="0" max="${Math.max(1, state.project.duration)}" value="${state.currentTime}" style="width:200px;accent-color:#0078d4;" />
                <span style="font-size:12px;min-width:60px;">${fmtTime(state.project.duration)}</span>
              </div>
            </div>

            <!-- Timeline -->
            <div style="height:200px;background:#1e1e1e;border-top:1px solid #111;display:flex;flex-direction:column;flex-shrink:0;">
              <div style="padding:8px 12px;border-bottom:1px solid #111;display:flex;align-items:center;gap:12px;">
                <span style="font-size:12px;font-weight:600;">Timeline</span>
                <button id="clip-zoom-out-${id}" style="padding:4px 8px;background:rgba(255,255,255,0.1);border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:11px;">−</button>
                <span style="font-size:11px;color:rgba(255,255,255,0.5);">${Math.round(state.zoom * 100)}%</span>
                <button id="clip-zoom-in-${id}" style="padding:4px 8px;background:rgba(255,255,255,0.1);border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:11px;">+</button>
                <div style="flex:1;"></div>
                <button id="clip-export-${id}" style="padding:6px 16px;background:#28a745;border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:12px;font-weight:600;">${state.exporting ? 'Exporting...' : 'Export Video'}</button>
              </div>
              
              <div style="flex:1;display:flex;overflow:hidden;">
                <!-- Track labels -->
                <div style="width:120px;background:#252525;border-right:1px solid #111;flex-shrink:0;">
                  ${state.tracks.map(track => `
                    <div style="height:${track.height}px;border-bottom:1px solid #111;display:flex;align-items:center;padding:0 8px;font-size:11px;color:rgba(255,255,255,0.7);">
                      ${track.type === 'video' ? '🎞️' : '🎵'} ${track.name}
                    </div>
                  `).join('')}
                </div>
                
                <!-- Timeline tracks -->
                <div id="clip-timeline-${id}" style="flex:1;position:relative;overflow-x:auto;background:#1a1a1a;">
                  ${state.tracks.map((track, trackIndex) => `
                    <div data-trackid="${track.id}" style="height:${track.height}px;border-bottom:1px solid #111;position:relative;">
                      ${state.timeline.filter(clip => clip.track === track.id).map(clip => `
                        <div data-clipid="${clip.id}" style="position:absolute;left:${clip.x}px;width:${clip.w}px;height:${track.height - 4}px;top:2px;background:${track.type === 'video' ? '#0078d4' : '#28a745'};border-radius:4px;cursor:move;display:flex;align-items:center;padding:0 8px;font-size:10px;color:#fff;border:2px solid ${state.selectedClip === clip.id ? '#fff' : 'transparent'};">
                          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${clip.name}</span>
                        </div>
                      `).join('')}
                    </div>
                  `).join('')}
                  
                  <!-- Playhead -->
                  <div style="position:absolute;top:0;bottom:0;width:2px;background:#ff4444;left:${state.currentTime * state.zoom * 10}px;pointer-events:none;z-index:10;"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right panel - Properties -->
          <div style="width:220px;background:#252525;border-left:1px solid #111;display:flex;flex-direction:column;flex-shrink:0;">
            <div style="padding:12px;border-bottom:1px solid #111;">
              <div style="font-size:14px;font-weight:600;">Properties</div>
            </div>
            <div style="flex:1;overflow-y:auto;padding:12px;">
              ${state.selectedClip ? (() => {
                const clip = state.timeline.find(c => c.id === state.selectedClip);
                if (!clip) return '<div style="color:rgba(255,255,255,0.3);font-size:12px;">No clip selected</div>';
                return `
                  <div style="margin-bottom:16px;">
                    <div style="font-size:12px;font-weight:600;margin-bottom:8px;">${clip.name}</div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:8px;">Duration: ${fmtTime(clip.duration)}</div>
                    
                    <div style="margin-bottom:8px;">
                      <label style="font-size:11px;color:rgba(255,255,255,0.7);">Volume</label>
                      <input type="range" min="0" max="200" value="100" style="width:100%;accent-color:#0078d4;margin-top:4px;" />
                    </div>
                    
                    <div style="margin-bottom:8px;">
                      <label style="font-size:11px;color:rgba(255,255,255,0.7);">Speed</label>
                      <select style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;border-radius:4px;color:#fff;font-size:11px;margin-top:4px;">
                        <option>0.25x</option>
                        <option>0.5x</option>
                        <option selected>1.0x</option>
                        <option>1.5x</option>
                        <option>2.0x</option>
                      </select>
                    </div>
                    
                    <button id="clip-delete-${id}" style="width:100%;padding:6px;background:#dc3545;border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:11px;margin-top:8px;">Delete Clip</button>
                  </div>
                `;
              })() : '<div style="color:rgba(255,255,255,0.3);font-size:12px;">Select a clip to edit properties</div>'}
              
              <div style="border-top:1px solid #111;padding-top:12px;margin-top:12px;">
                <div style="font-size:12px;font-weight:600;margin-bottom:8px;">Effects</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                  <button style="padding:6px;background:rgba(255,255,255,0.1);border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:10px;">Fade In</button>
                  <button style="padding:6px;background:rgba(255,255,255,0.1);border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:10px;">Fade Out</button>
                  <button style="padding:6px;background:rgba(255,255,255,0.1);border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:10px;">Blur</button>
                  <button style="padding:6px;background:rgba(255,255,255,0.1);border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:10px;">Brightness</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        ${state.exporting ? `
          <div style="position:absolute;inset:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:100;">
            <div style="background:#2a2a2a;padding:24px;border-radius:8px;text-align:center;min-width:300px;">
              <div style="font-size:16px;font-weight:600;margin-bottom:16px;">Exporting Video...</div>
              <div style="width:100%;height:8px;background:#111;border-radius:4px;overflow:hidden;margin-bottom:12px;">
                <div style="height:100%;background:#28a745;width:${state.exportProgress}%;transition:width 0.3s;"></div>
              </div>
              <div style="font-size:12px;color:rgba(255,255,255,0.7);">${Math.round(state.exportProgress)}% complete</div>
            </div>
          </div>
        ` : ''}
      `;

      bindEvents();
    };

    const bindEvents = () => {
      // Import media
      const importBtn = document.getElementById(`clip-import-${id}`);
      if (importBtn) {
        importBtn.addEventListener('click', () => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'video/*,audio/*,image/*';
          input.multiple = true;
          input.onchange = e => {
            Array.from(e.target.files).forEach(file => {
              const reader = new FileReader();
              reader.onload = ev => {
                const media = {
                  id: 'media_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                  name: file.name,
                  type: file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image',
                  dataUrl: ev.target.result,
                  duration: file.type.startsWith('video') ? Math.floor(Math.random() * 120) + 30 : file.type.startsWith('audio') ? Math.floor(Math.random() * 180) + 60 : 5,
                  size: file.size
                };
                state.mediaLibrary.push(media);
                save();
                render();
              };
              reader.readAsDataURL(file);
            });
          };
          input.click();
        });
      }

      // Media library drag
      content.querySelectorAll('[data-mediaid]').forEach(el => {
        el.addEventListener('dragstart', e => {
          e.dataTransfer.setData('text/plain', el.dataset.mediaid);
        });
      });

      // Timeline drop — bound directly, not via global
      const timelineEl = document.getElementById(`clip-timeline-${id}`);
      if (timelineEl) {
        timelineEl.addEventListener('dragover', e => e.preventDefault());
        timelineEl.addEventListener('drop', e => {
          e.preventDefault();
          const mediaId = e.dataTransfer.getData('text/plain');
          const media = state.mediaLibrary.find(m => m.id === mediaId);
          if (!media) return;

          const rect = timelineEl.getBoundingClientRect();
          const x = e.clientX - rect.left + timelineEl.scrollLeft;
          const y = e.clientY - rect.top;

          // Find which track
          let trackId = null;
          let currentY = 0;
          for (const track of state.tracks) {
            if (y >= currentY && y < currentY + track.height) {
              trackId = track.id;
              break;
            }
            currentY += track.height;
          }
          if (!trackId) return;

          const track = state.tracks.find(t => t.id === trackId);
          if ((track.type === 'video' && media.type === 'audio') || (track.type === 'audio' && media.type === 'video')) return;

          const clip = {
            id: 'clip_' + Date.now(),
            mediaId: media.id,
            name: media.name,
            type: media.type,
            track: trackId,
            start: Math.max(0, x / (state.zoom * 10)),
            duration: media.duration,
            x: x,
            w: media.duration * state.zoom * 10
          };
          state.timeline.push(clip);
          state.project.duration = Math.max(state.project.duration, clip.start + clip.duration);
          save();
          render();
        });
      }

      // Timeline clip selection
      content.querySelectorAll('[data-clipid]').forEach(el => {
        el.addEventListener('click', () => {
          state.selectedClip = el.dataset.clipid;
          render();
        });
      });

      // Play/pause
      const playBtn = document.getElementById(`clip-play-${id}`);
      if (playBtn) {
        playBtn.addEventListener('click', () => {
          state.playing = !state.playing;
          if (state.playing) {
            playInterval = setInterval(() => {
              state.currentTime += 0.1;
              if (state.currentTime >= state.project.duration) {
                state.currentTime = 0;
                state.playing = false;
                clearInterval(playInterval);
              }
              const scrubber = document.getElementById(`clip-scrub-${id}`);
              if (scrubber) scrubber.value = state.currentTime;
              render();
            }, 100);
          } else {
            clearInterval(playInterval);
          }
          render();
        });
      }

      // Scrubber
      const scrubber = document.getElementById(`clip-scrub-${id}`);
      if (scrubber) {
        scrubber.addEventListener('input', e => {
          state.currentTime = parseFloat(e.target.value);
          render();
        });
      }

      // Zoom
      const zoomIn = document.getElementById(`clip-zoom-in-${id}`);
      const zoomOut = document.getElementById(`clip-zoom-out-${id}`);
      if (zoomIn) zoomIn.addEventListener('click', () => { state.zoom = Math.min(3, state.zoom * 1.2); render(); });
      if (zoomOut) zoomOut.addEventListener('click', () => { state.zoom = Math.max(0.2, state.zoom / 1.2); render(); });

      // Delete clip
      const deleteBtn = document.getElementById(`clip-delete-${id}`);
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          state.timeline = state.timeline.filter(c => c.id !== state.selectedClip);
          state.selectedClip = null;
          render();
        });
      }

      // Export
      const exportBtn = document.getElementById(`clip-export-${id}`);
      if (exportBtn) {
        exportBtn.addEventListener('click', () => {
          if (state.exporting) return;
          state.exporting = true;
          state.exportProgress = 0;
          render();
          
          const exportInterval = setInterval(() => {
            state.exportProgress += Math.random() * 15 + 5;
            if (state.exportProgress >= 100) {
              state.exportProgress = 100;
              clearInterval(exportInterval);
              setTimeout(() => {
                state.exporting = false;
                Notifications.send('Clipchamp', 'Video exported successfully!', '🎬');
                render();
              }, 500);
            }
            render();
          }, 200);
        });
      }
    };

    render();

    // Cleanup on window close
    const observer = new MutationObserver(() => {
      if (!document.body.contains(content)) {
        clearInterval(playInterval);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
});