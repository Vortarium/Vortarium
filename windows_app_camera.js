// ===== CAMERA APP =====
AppLauncher.register("camera", {
  title:"Camera", icon:"📸",
  launch() {
    const id = WM.create({title:"Camera",icon:"📸",width:720,height:560,appId:"camera"});
    const content = WM.getContent(id);
    content.style.cssText = "display:flex;flex-direction:column;overflow:hidden;background:#000;";
    content.innerHTML = `
      <div style="flex:1;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;">
        <video id="cam-video-${id}" autoplay playsinline style="width:100%;height:100%;object-fit:cover;"></video>
        <canvas id="cam-canvas-${id}" style="display:none;"></canvas>
        <div id="cam-flash-${id}" style="position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity 0.1s;"></div>
        <div id="cam-mode-${id}" style="position:absolute;top:12px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.5);backdrop-filter:blur(10px);border-radius:20px;padding:4px;display:flex;gap:2px;">
          <button id="cam-photo-mode-${id}" style="padding:6px 16px;border:none;border-radius:16px;cursor:pointer;font-size:12px;font-weight:600;background:#fff;color:#000;">📷 Photo</button>
          <button id="cam-video-mode-${id}" style="padding:6px 16px;border:none;border-radius:16px;cursor:pointer;font-size:12px;font-weight:600;background:transparent;color:#fff;">🎬 Video</button>
        </div>
        <div id="cam-rec-indicator-${id}" style="display:none;position:absolute;top:12px;right:12px;background:rgba(196,43,28,0.9);border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600;color:#fff;">● REC</div>
      </div>
      <div style="height:80px;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;gap:20px;flex-shrink:0;">
        <div id="cam-last-${id}" style="width:52px;height:52px;border-radius:8px;background:rgba(255,255,255,0.1);overflow:hidden;cursor:pointer;border:2px solid rgba(255,255,255,0.2);"></div>
        <button id="cam-capture-${id}" style="width:60px;height:60px;border-radius:50%;background:#fff;border:4px solid rgba(255,255,255,0.3);cursor:pointer;font-size:24px;display:flex;align-items:center;justify-content:center;transition:transform 0.1s;">📷</button>
        <button id="cam-switch-${id}" style="width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.15);border:none;cursor:pointer;font-size:20px;color:#fff;">🔄</button>
      </div>`;

    const video = document.getElementById(`cam-video-${id}`);
    const canvas = document.getElementById(`cam-canvas-${id}`);
    const flash = document.getElementById(`cam-flash-${id}`);
    const captureBtn = document.getElementById(`cam-capture-${id}`);
    const lastThumb = document.getElementById(`cam-last-${id}`);
    const recIndicator = document.getElementById(`cam-rec-indicator-${id}`);
    let stream = null, mode = "photo", mediaRecorder = null, recordedChunks = [], facingMode = "user";

    const startCamera = async () => {
      try {
        if (stream) stream.getTracks().forEach(t=>t.stop());
        stream = await navigator.mediaDevices.getUserMedia({video:{facingMode},audio:true});
        video.srcObject = stream;
      } catch(e) {
        content.innerHTML = `<div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;color:var(--text-muted);">
          <div style="font-size:48px;">📷</div>
          <div style="font-size:16px;">Camera access denied</div>
          <div style="font-size:13px;">Please allow camera access in your browser settings</div>
        </div>`;
      }
    };

    const takePhoto = () => {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      canvas.getContext("2d").drawImage(video,0,0);
      const dataUrl = canvas.toDataURL("image/jpeg",0.92);
      // Flash effect
      flash.style.opacity = "1";
      setTimeout(()=>flash.style.opacity="0",150);
      // Save to Photos
      const d = OS.getAppData("myphotos")||{photos:[]};
      const name = "photo_"+new Date().toISOString().replace(/[:.]/g,"-")+".jpg";
      d.photos.push({name,dataUrl,date:new Date().toISOString(),size:dataUrl.length});
      OS.setAppData("myphotos",d);
      // Update thumbnail
      lastThumb.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;">`;
      Notifications.send("Camera","Photo saved to Photos","📷");
    };

    const startRecording = () => {
      if (!stream) return;
      recordedChunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = e => { if(e.data.size>0) recordedChunks.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks,{type:"video/webm"});
        const reader = new FileReader();
        reader.onload = ev => {
          const d = OS.getAppData("myphotos")||{photos:[]};
          const name = "video_"+new Date().toISOString().replace(/[:.]/g,"-")+".webm";
          d.photos.push({name,dataUrl:ev.target.result,date:new Date().toISOString(),size:ev.target.result.length,isVideo:true});
          OS.setAppData("myphotos",d);
          Notifications.send("Camera","Video saved to Photos","🎬");
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorder.start();
      recIndicator.style.display = "block";
      captureBtn.style.background = "#f44747";
      captureBtn.textContent = "⏹";
    };

    const stopRecording = () => {
      if (mediaRecorder&&mediaRecorder.state!=="inactive") mediaRecorder.stop();
      recIndicator.style.display = "none";
      captureBtn.style.background = "#fff";
      captureBtn.textContent = "🎬";
    };

    captureBtn.addEventListener("click",()=>{
      if (mode==="photo") takePhoto();
      else if (mediaRecorder&&mediaRecorder.state==="recording") stopRecording();
      else startRecording();
    });

    document.getElementById(`cam-photo-mode-${id}`).addEventListener("click",()=>{
      mode="photo";
      document.getElementById(`cam-photo-mode-${id}`).style.cssText="padding:6px 16px;border:none;border-radius:16px;cursor:pointer;font-size:12px;font-weight:600;background:#fff;color:#000;";
      document.getElementById(`cam-video-mode-${id}`).style.cssText="padding:6px 16px;border:none;border-radius:16px;cursor:pointer;font-size:12px;font-weight:600;background:transparent;color:#fff;";
      captureBtn.textContent="📷"; captureBtn.style.background="#fff";
    });
    document.getElementById(`cam-video-mode-${id}`).addEventListener("click",()=>{
      mode="video";
      document.getElementById(`cam-video-mode-${id}`).style.cssText="padding:6px 16px;border:none;border-radius:16px;cursor:pointer;font-size:12px;font-weight:600;background:#f44747;color:#fff;";
      document.getElementById(`cam-photo-mode-${id}`).style.cssText="padding:6px 16px;border:none;border-radius:16px;cursor:pointer;font-size:12px;font-weight:600;background:transparent;color:#fff;";
      captureBtn.textContent="🎬"; captureBtn.style.background="#fff";
    });

    document.getElementById(`cam-switch-${id}`).addEventListener("click",()=>{
      facingMode = facingMode==="user"?"environment":"user";
      startCamera();
    });

    lastThumb.addEventListener("click",()=>AppLauncher.launch("myphotos"));

    startCamera();

    // Cleanup
    const obs = new MutationObserver(()=>{
      if(!document.getElementById(id)){if(stream)stream.getTracks().forEach(t=>t.stop());obs.disconnect();}
    });
    obs.observe(document.getElementById("windows-container"),{childList:true});
  }
});
