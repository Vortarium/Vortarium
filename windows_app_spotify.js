// ===== SPOTIFY CLONE — Full Featured =====
// Gated: requires Store install
AppLauncher.register("spotify", {
  title:"Spotify", icon:"🎧",
  _audio: null,
  _getAudio() { if(!this._audio){this._audio=new Audio();this._audio.volume=0.8;} return this._audio; },
  _load() { return OS.getAppData("spotify")||{songs:[],playlists:[],currentIdx:-1,volume:80,shuffle:false,repeat:false}; },
  _save(s) { OS.setAppData("spotify",{songs:s.songs,playlists:s.playlists,currentIdx:s.currentIdx,volume:s.volume,shuffle:s.shuffle,repeat:s.repeat}); },

  launch(opts) {
    if (typeof StoreManager !== 'undefined' && !StoreManager.isInstalled('spotify')) {
      _showInstallGate('Spotify', '🎧', 'spotify'); return;
    }
    const id = WM.create({title:"Spotify",icon:"🎧",width:1020,height:680,appId:"spotify"});
    const content = WM.getContent(id);
    content.style.cssText = "display:flex;flex-direction:column;overflow:hidden;background:#121212;color:#fff;";
    const audio = this._getAudio();
    const state = this._load();
    state.playing = false; state.elapsed = 0; state.view = "home"; state.selectedPlaylist = null;
    const self = this;
    const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
    const colors = ["#1db954","#e91e63","#2196f3","#ff9800","#9c27b0","#00bcd4","#f44336","#4caf50","#ff5722","#607d8b"];

    const render = () => {
      const cur = state.currentIdx>=0&&state.currentIdx<state.songs.length ? state.songs[state.currentIdx] : null;
      const artStyle = cur&&cur.albumArt ? `background:url('${cur.albumArt}') center/cover` : `background:${colors[(state.currentIdx||0)%colors.length]}`;
      content.innerHTML = `
        <div style="display:flex;flex:1;overflow:hidden;">
          <div style="width:230px;background:#000;padding:16px 8px;display:flex;flex-direction:column;gap:4px;flex-shrink:0;overflow-y:auto;">
            <div style="font-size:22px;font-weight:700;color:#1db954;padding:8px 8px 16px;">🎧 Spotify</div>
            ${[{v:"home",icon:"🏠",label:"Home"},{v:"search",icon:"🔍",label:"Search"},{v:"library",icon:"📚",label:"Your Library"}].map(item=>`
              <div data-view="${item.v}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:500;background:${state.view===item.v?"rgba(255,255,255,0.1)":"transparent"};transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='${state.view===item.v?"rgba(255,255,255,0.1)":"transparent"}'">
                <span>${item.icon}</span><span>${item.label}</span>
              </div>`).join("")}
            <div style="height:1px;background:rgba(255,255,255,0.1);margin:8px 0;"></div>
            <div style="font-size:11px;color:rgba(255,255,255,0.4);padding:4px 12px;text-transform:uppercase;letter-spacing:0.5px;">Playlists</div>
            <div id="sp-playlists-${id}" style="display:flex;flex-direction:column;gap:2px;"></div>
            <button id="sp-new-pl-${id}" style="margin-top:8px;padding:8px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff;cursor:pointer;font-size:12px;text-align:left;">+ New Playlist</button>
          </div>
          <div style="flex:1;overflow-y:auto;padding:24px;" id="sp-main-${id}"></div>
        </div>
        <div style="height:90px;background:#181818;border-top:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;padding:0 16px;gap:16px;flex-shrink:0;">
          <div style="display:flex;align-items:center;gap:12px;width:260px;flex-shrink:0;">
            <div style="width:52px;height:52px;border-radius:6px;${artStyle};display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;">${cur&&cur.albumArt?"":"🎵"}</div>
            <div style="overflow:hidden;">
              <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${cur?cur.title:"Nothing playing"}</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${cur?(cur.artists||cur.artist||"Unknown"):""}${cur&&cur.duration?" · "+fmt(cur.duration):""}</div>
            </div>
          </div>
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;">
            <div style="display:flex;align-items:center;gap:16px;">
              <button id="sp-shuf-${id}" style="background:transparent;border:none;color:${state.shuffle?"#1db954":"rgba(255,255,255,0.6)"};cursor:pointer;font-size:16px;padding:4px;">🔀</button>
              <button id="sp-prev-${id}" style="background:transparent;border:none;color:#fff;cursor:pointer;font-size:20px;padding:4px;">⏮</button>
              <button id="sp-play-${id}" style="width:38px;height:38px;border-radius:50%;background:#fff;border:none;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;">${state.playing?"⏸":"▶"}</button>
              <button id="sp-next-${id}" style="background:transparent;border:none;color:#fff;cursor:pointer;font-size:20px;padding:4px;">⏭</button>
              <button id="sp-rep-${id}" style="background:transparent;border:none;color:${state.repeat?"#1db954":"rgba(255,255,255,0.6)"};cursor:pointer;font-size:16px;padding:4px;">🔁</button>
            </div>
            <div style="display:flex;align-items:center;gap:8px;width:100%;max-width:500px;">
              <span id="sp-elapsed-${id}" style="font-size:11px;color:rgba(255,255,255,0.5);min-width:35px;text-align:right;">${fmt(state.elapsed)}</span>
              <input type="range" id="sp-seek-${id}" min="0" max="${cur?cur.duration||100:100}" value="${state.elapsed}" style="flex:1;accent-color:#1db954;height:4px;" />
              <span id="sp-dur-${id}" style="font-size:11px;color:rgba(255,255,255,0.5);min-width:35px;">${cur?fmt(cur.duration||0):"0:00"}</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;width:160px;flex-shrink:0;">
            <span style="font-size:14px;">🔊</span>
            <input type="range" id="sp-vol-${id}" min="0" max="100" value="${state.volume}" style="flex:1;accent-color:#1db954;" />
          </div>
        </div>`;

      const plEl = document.getElementById(`sp-playlists-${id}`);
      if (plEl) plEl.innerHTML = state.playlists.map((pl,i)=>`
        <div data-pl="${i}" style="padding:8px 12px;border-radius:6px;cursor:pointer;font-size:13px;color:rgba(255,255,255,0.7);background:${state.selectedPlaylist===i?"rgba(255,255,255,0.1)":"transparent"};transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.07)'" onmouseout="this.style.background='${state.selectedPlaylist===i?"rgba(255,255,255,0.1)":"transparent"}'">
          🎵 ${pl.name}
        </div>`).join("");

      renderMain();
      bindControls();
    };

    const renderMain = () => {
      const main = document.getElementById(`sp-main-${id}`);
      if (!main) return;
      if (state.view==="home") {
        main.innerHTML = `
          <div style="font-size:24px;font-weight:700;margin-bottom:20px;">Good ${new Date().getHours()<12?"morning":new Date().getHours()<18?"afternoon":"evening"} 👋</div>
          <div style="display:flex;gap:10px;margin-bottom:24px;flex-wrap:wrap;">
            <label style="padding:10px 20px;background:#1db954;border-radius:24px;cursor:pointer;font-size:13px;font-weight:600;color:#000;">
              ➕ Upload MP3s
              <input type="file" id="sp-upload-${id}" accept="audio/*" multiple style="display:none;">
            </label>
          </div>
          ${state.songs.length===0?`<div style="color:rgba(255,255,255,0.4);font-size:14px;padding:40px 0;text-align:center;">Upload some MP3 files to get started!</div>`:`
          <div style="font-size:18px;font-weight:600;margin-bottom:12px;">Your Songs (${state.songs.length})</div>
          <div id="sp-songlist-${id}">${renderSongList(state.songs,-1)}</div>`}`;
        bindUpload();
        bindSongList(`sp-songlist-${id}`,state.songs,-1);
      } else if (state.view==="library") {
        main.innerHTML = `<div style="font-size:24px;font-weight:700;margin-bottom:20px;">Your Library</div>
          <div style="font-size:16px;font-weight:600;margin-bottom:12px;">All Songs (${state.songs.length})</div>
          <div id="sp-songlist-${id}">${renderSongList(state.songs,-1)}</div>`;
        bindSongList(`sp-songlist-${id}`,state.songs,-1);
      } else if (state.view==="search") {
        main.innerHTML = `<div style="font-size:24px;font-weight:700;margin-bottom:20px;">Search</div>
          <input type="text" id="sp-search-${id}" placeholder="Search your songs..." style="width:100%;max-width:400px;padding:10px 16px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-radius:24px;color:#fff;font-size:14px;outline:none;margin-bottom:16px;">
          <div id="sp-search-results-${id}"></div>`;
        const si=document.getElementById(`sp-search-${id}`);
        si.addEventListener("input",()=>{
          const q=si.value.toLowerCase();
          const results=q?state.songs.filter(s=>s.title.toLowerCase().includes(q)||(s.artists||s.artist||"").toLowerCase().includes(q)):[];
          const el=document.getElementById(`sp-search-results-${id}`);
          if(el){el.innerHTML=renderSongList(results,-1);bindSongList(`sp-search-results-${id}`,results,-1);}
        });
        si.focus();
      } else if (state.view==="playlist"&&state.selectedPlaylist!==null) {
        const pl=state.playlists[state.selectedPlaylist];
        if(!pl) return;
        const plSongs=pl.songIds.map(sid=>state.songs.find(s=>s.id===sid)).filter(Boolean);
        const coverStyle=pl.cover?`background:url('${pl.cover}') center/cover`:`background:${colors[state.selectedPlaylist%colors.length]}`;
        main.innerHTML = `
          <div style="display:flex;align-items:center;gap:20px;margin-bottom:24px;">
            <div style="width:100px;height:100px;border-radius:10px;${coverStyle};display:flex;align-items:center;justify-content:center;font-size:40px;flex-shrink:0;cursor:pointer;" id="sp-pl-cover-${id}" title="Change cover">${pl.cover?"":"🎵"}</div>
            <div>
              <div style="font-size:28px;font-weight:700;">${pl.name}</div>
              <div style="font-size:13px;color:rgba(255,255,255,0.5);">${plSongs.length} songs</div>
              <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
                <button id="sp-pl-play-${id}" style="padding:8px 20px;background:#1db954;border:none;border-radius:24px;color:#000;cursor:pointer;font-weight:600;font-size:13px;">▶ Play</button>
                <button id="sp-pl-addsong-${id}" style="padding:8px 16px;background:rgba(255,255,255,0.1);border:none;border-radius:24px;color:#fff;cursor:pointer;font-size:13px;">+ Add Songs</button>
                <button id="sp-pl-rename-${id}" style="padding:8px 16px;background:rgba(255,255,255,0.1);border:none;border-radius:24px;color:#fff;cursor:pointer;font-size:13px;">✏️ Rename</button>
                <button id="sp-pl-del-${id}" style="padding:8px 16px;background:rgba(196,43,28,0.2);border:1px solid rgba(196,43,28,0.3);border-radius:24px;color:#f44747;cursor:pointer;font-size:13px;">🗑️ Delete</button>
              </div>
            </div>
          </div>
          <div id="sp-songlist-${id}" style="display:flex;flex-direction:column;gap:2px;">${renderSongList(plSongs,state.selectedPlaylist,true)}</div>`;
        bindSongList(`sp-songlist-${id}`,plSongs,state.selectedPlaylist,true);
        const ppBtn=document.getElementById(`sp-pl-play-${id}`);
        if(ppBtn) ppBtn.addEventListener("click",()=>{if(plSongs.length>0)playSong(state.songs.indexOf(plSongs[0]));});
        const addBtn=document.getElementById(`sp-pl-addsong-${id}`);
        if(addBtn) addBtn.addEventListener("click",()=>{
          const available=state.songs.filter(s=>!pl.songIds.includes(s.id));
          if(!available.length){Notifications.send("Spotify","All songs already in playlist","🎧");return;}
          const list=available.map((s,i)=>`${i}: ${s.title} — ${s.artists||s.artist||"Unknown"}`).join("\n");
          const choice=prompt(`Add song to "${pl.name}":\n${list}\nEnter number(s) separated by commas:`);
          if(choice!==null){
            choice.split(",").forEach(c=>{const i=parseInt(c.trim());if(!isNaN(i)&&available[i]&&!pl.songIds.includes(available[i].id))pl.songIds.push(available[i].id);});
            self._save(state);render();
          }
        });
        const renBtn=document.getElementById(`sp-pl-rename-${id}`);
        if(renBtn) renBtn.addEventListener("click",()=>{const n=prompt("Rename playlist:",pl.name);if(n){pl.name=n;self._save(state);render();}});
        const delBtn=document.getElementById(`sp-pl-del-${id}`);
        if(delBtn) delBtn.addEventListener("click",()=>{if(confirm(`Delete playlist "${pl.name}"?`)){state.playlists.splice(state.selectedPlaylist,1);state.selectedPlaylist=null;state.view="home";self._save(state);render();}});
        const coverBtn=document.getElementById(`sp-pl-cover-${id}`);
        if(coverBtn) coverBtn.addEventListener("click",()=>{
          const inp=document.createElement("input");inp.type="file";inp.accept="image/*";
          inp.onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{pl.cover=ev.target.result;self._save(state);render();};r.readAsDataURL(f);};
          inp.click();
        });
      }
    };

    const renderSongList = (songs, plIdx, draggable) => {
      if (!songs.length) return `<div style="color:rgba(255,255,255,0.4);font-size:13px;padding:20px 0;">No songs</div>`;
      return `<div style="display:flex;flex-direction:column;gap:2px;">` + songs.map((s,i)=>{
        const artStyle = s.albumArt ? `background:url('${s.albumArt}') center/cover` : `background:${colors[i%colors.length]}`;
        const isPlaying = state.songs.indexOf(s)===state.currentIdx;
        return `<div data-songidx="${i}" ${draggable?'draggable="true"':''} style="display:flex;align-items:center;gap:12px;padding:8px 10px;border-radius:8px;cursor:pointer;transition:background 0.15s;background:${isPlaying?"rgba(29,185,84,0.1)":""};" onmouseover="this.style.background='rgba(255,255,255,0.07)'" onmouseout="this.style.background='${isPlaying?"rgba(29,185,84,0.1)":""}'" >
          <div style="width:36px;height:36px;border-radius:4px;${artStyle};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">${s.albumArt?"":"🎵"}</div>
          <div style="flex:1;overflow:hidden;">
            <div style="font-size:13px;font-weight:${isPlaying?"600":"500"};color:${isPlaying?"#1db954":"#fff"};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.title}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.5);">${s.artists||s.artist||"Unknown Artist"}</div>
          </div>
          <div style="font-size:11px;color:rgba(255,255,255,0.4);flex-shrink:0;">${s.duration?fmt(s.duration):""}</div>
          <div style="display:flex;gap:4px;flex-shrink:0;">
            <button data-setart="${i}" style="background:transparent;border:none;color:rgba(255,255,255,0.3);cursor:pointer;font-size:11px;padding:2px 5px;border-radius:4px;" title="Set album art">🖼</button>
            ${state.playlists.length>0?`<button data-addpl="${i}" style="background:transparent;border:none;color:rgba(255,255,255,0.4);cursor:pointer;font-size:11px;padding:2px 5px;border-radius:4px;" title="Add to playlist">+PL</button>`:""}
            ${plIdx>=0?`<button data-removefrompl="${i}" style="background:transparent;border:none;color:rgba(255,255,255,0.3);cursor:pointer;font-size:11px;padding:2px 5px;border-radius:4px;" title="Remove from playlist">✕</button>`:""}
            <button data-delsong="${i}" style="background:transparent;border:none;color:rgba(255,255,255,0.3);cursor:pointer;font-size:11px;padding:2px 5px;border-radius:4px;" title="Delete song">🗑</button>
          </div>
        </div>`;
      }).join("") + `</div>`;
    };

    const bindSongList = (elId, songs, plIdx, draggable) => {
      const el = document.getElementById(elId);
      if (!el) return;
      let dragSrc = null;
      el.querySelectorAll("[data-songidx]").forEach(row => {
        row.addEventListener("click", e => {
          if (e.target.dataset.addpl!==undefined||e.target.dataset.delsong!==undefined||e.target.dataset.setart!==undefined||e.target.dataset.removefrompl!==undefined) return;
          const song=songs[parseInt(row.dataset.songidx)];
          const realIdx=state.songs.indexOf(song);
          if(realIdx>=0) playSong(realIdx);
        });
        if (draggable) {
          row.addEventListener("dragstart",e=>{dragSrc=parseInt(row.dataset.songidx);row.style.opacity="0.5";});
          row.addEventListener("dragend",()=>{row.style.opacity="1";});
          row.addEventListener("dragover",e=>{e.preventDefault();row.style.background="rgba(29,185,84,0.15)";});
          row.addEventListener("dragleave",()=>{row.style.background="";});
          row.addEventListener("drop",e=>{
            e.preventDefault(); row.style.background="";
            const tgt=parseInt(row.dataset.songidx);
            if(dragSrc===null||dragSrc===tgt) return;
            const pl=state.playlists[plIdx];
            if(!pl) return;
            const moved=pl.songIds.splice(dragSrc,1)[0];
            pl.songIds.splice(tgt,0,moved);
            self._save(state); render();
          });
        }
        const setArtBtn=row.querySelector("[data-setart]");
        if(setArtBtn) setArtBtn.addEventListener("click",e=>{
          e.stopPropagation();
          const song=songs[parseInt(setArtBtn.dataset.setart)];
          const realSong=state.songs.find(s=>s.id===song.id);
          if(!realSong) return;
          const inp=document.createElement("input");inp.type="file";inp.accept="image/*";
          inp.onchange=ev=>{const f=ev.target.files[0];if(!f)return;const r=new FileReader();r.onload=rv=>{realSong.albumArt=rv.target.result;self._save(state);render();};r.readAsDataURL(f);};
          inp.click();
        });
        const addPlBtn=row.querySelector("[data-addpl]");
        if(addPlBtn) addPlBtn.addEventListener("click",e=>{
          e.stopPropagation();
          const song=songs[parseInt(addPlBtn.dataset.addpl)];
          const plNames=state.playlists.map((p,i)=>`${i}: ${p.name}`).join("\n");
          const choice=prompt(`Add to playlist:\n${plNames}\nEnter number:`);
          if(choice!==null){const pi=parseInt(choice);if(!isNaN(pi)&&state.playlists[pi]&&!state.playlists[pi].songIds.includes(song.id)){state.playlists[pi].songIds.push(song.id);self._save(state);Notifications.send("Spotify",`Added to ${state.playlists[pi].name}`,"🎧");}}
        });
        const removeBtn=row.querySelector("[data-removefrompl]");
        if(removeBtn) removeBtn.addEventListener("click",e=>{
          e.stopPropagation();
          const song=songs[parseInt(removeBtn.dataset.removefrompl)];
          const pl=state.playlists[plIdx];
          if(pl){pl.songIds=pl.songIds.filter(sid=>sid!==song.id);self._save(state);render();}
        });
        const delBtn=row.querySelector("[data-delsong]");
        if(delBtn) delBtn.addEventListener("click",e=>{
          e.stopPropagation();
          const song=songs[parseInt(delBtn.dataset.delsong)];
          if(!confirm(`Delete "${song.title}"?`)) return;
          const realIdx=state.songs.indexOf(song);
          if(realIdx>=0){
            state.songs.splice(realIdx,1);
            if(state.currentIdx===realIdx){audio.pause();state.playing=false;state.currentIdx=-1;}
            else if(state.currentIdx>realIdx) state.currentIdx--;
            self._save(state);render();
          }
        });
      });
    };

    const bindUpload = () => {
      const up=document.getElementById(`sp-upload-${id}`);
      if(!up) return;
      up.addEventListener("change",e=>{
        const files=Array.from(e.target.files);
        let loaded=0;
        files.forEach(file=>{
          const reader=new FileReader();
          reader.onload=ev=>{
            const dataUrl=ev.target.result;
            const raw=file.name.replace(/\.(mp3|wav|ogg|flac|m4a)$/i,"").replace(/[-_]/g," ");
            const parts=raw.split(" - ");
            const title=parts.length>1?parts.slice(1).join(" - ").trim():raw;
            const artists=parts.length>1?parts[0].trim():"Unknown Artist";
            const songId="s_"+Date.now()+"_"+Math.random().toString(36).slice(2,6);
            const tmpAudio=new Audio(dataUrl);
            const finish=(dur)=>{
              state.songs.push({id:songId,title,artists,artist:artists,dataUrl,duration:Math.round(dur||0),albumArt:""});
              loaded++;
              if(loaded===files.length){self._save(state);render();Notifications.send("Spotify",`Added ${loaded} song(s)`,"🎧");}
            };
            tmpAudio.addEventListener("loadedmetadata",()=>finish(tmpAudio.duration));
            tmpAudio.addEventListener("error",()=>finish(0));
          };
          reader.readAsDataURL(file);
        });
      });
    };

    const playSong = idx => {
      if(idx<0||idx>=state.songs.length) return;
      state.currentIdx=idx;
      const song=state.songs[idx];
      audio.src=song.dataUrl;
      audio.volume=state.volume/100;
      audio.play().catch(()=>{});
      state.playing=true; state.elapsed=0;
      render();
      audio.ontimeupdate=()=>{
        state.elapsed=Math.floor(audio.currentTime);
        const seekEl=document.getElementById(`sp-seek-${id}`);
        const elEl=document.getElementById(`sp-elapsed-${id}`);
        if(seekEl){seekEl.max=Math.round(audio.duration||0);seekEl.value=state.elapsed;}
        if(elEl) elEl.textContent=fmt(state.elapsed);
      };
      audio.onended=()=>{
        if(state.repeat){audio.currentTime=0;audio.play();}
        else{const next=state.shuffle?Math.floor(Math.random()*state.songs.length):(state.currentIdx+1)%state.songs.length;playSong(next);}
      };
    };

    const bindControls = () => {
      document.querySelectorAll(`#${id} [data-view]`).forEach(el=>el.addEventListener("click",()=>{state.view=el.dataset.view;render();}));
      const plEl=document.getElementById(`sp-playlists-${id}`);
      if(plEl) plEl.querySelectorAll("[data-pl]").forEach(el=>el.addEventListener("click",()=>{state.selectedPlaylist=parseInt(el.dataset.pl);state.view="playlist";render();}));
      const npBtn=document.getElementById(`sp-new-pl-${id}`);
      if(npBtn) npBtn.addEventListener("click",()=>{const name=prompt("Playlist name:","My Playlist");if(name){state.playlists.push({name,songIds:[],cover:""});self._save(state);render();}});
      const playBtn=document.getElementById(`sp-play-${id}`);
      if(playBtn) playBtn.addEventListener("click",()=>{
        if(state.currentIdx<0&&state.songs.length>0){playSong(0);return;}
        if(state.playing){audio.pause();state.playing=false;playBtn.textContent="▶";}
        else{audio.play().catch(()=>{});state.playing=true;playBtn.textContent="⏸";}
      });
      const prevBtn=document.getElementById(`sp-prev-${id}`);
      if(prevBtn) prevBtn.addEventListener("click",()=>{if(state.currentIdx>0)playSong(state.currentIdx-1);else if(state.songs.length>0)playSong(state.songs.length-1);});
      const nextBtn=document.getElementById(`sp-next-${id}`);
      if(nextBtn) nextBtn.addEventListener("click",()=>{if(state.shuffle)playSong(Math.floor(Math.random()*state.songs.length));else playSong((state.currentIdx+1)%state.songs.length);});
      const shufBtn=document.getElementById(`sp-shuf-${id}`);
      if(shufBtn) shufBtn.addEventListener("click",()=>{state.shuffle=!state.shuffle;self._save(state);render();});
      const repBtn=document.getElementById(`sp-rep-${id}`);
      if(repBtn) repBtn.addEventListener("click",()=>{state.repeat=!state.repeat;self._save(state);render();});
      const seekEl=document.getElementById(`sp-seek-${id}`);
      if(seekEl) seekEl.addEventListener("input",()=>{audio.currentTime=parseInt(seekEl.value);state.elapsed=parseInt(seekEl.value);});
      const volEl=document.getElementById(`sp-vol-${id}`);
      if(volEl) volEl.addEventListener("input",()=>{state.volume=parseInt(volEl.value);audio.volume=state.volume/100;self._save(state);});
    };

    render();
    // Resume playback if was playing
    if(state.currentIdx>=0&&state.songs[state.currentIdx]){
      audio.src=state.songs[state.currentIdx].dataUrl;
      audio.volume=state.volume/100;
    }
  }
});
