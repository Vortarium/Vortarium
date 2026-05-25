// ===== MY PHOTOS APP =====
AppLauncher.register("myphotos", {
  title: "Photos", icon: "📷",
  launch() {
    const id = WM.create({ title:"Photos", icon:"📷", width:960, height:640, appId:"myphotos" });
    const content = WM.getContent(id);
    content.style.cssText = "display:flex;flex-direction:column;overflow:hidden;";

    // Load photos from both appData AND VFS Pictures folder
    const loadAllPhotos = () => {
      const appData = OS.getAppData("myphotos") || { photos:[] };
      // Also scan VFS Pictures
      const pics = FS.ls('C:/Users/User/Pictures') || {};
      const vfsPhotos = Object.entries(pics)
        .filter(([n,v]) => v.type === 'file' && v.content && v.content.startsWith('data:image'))
        .map(([n,v]) => ({ name:n, dataUrl:v.content, date:v.modified||new Date().toISOString(), size:v.content.length, source:'vfs' }));
      // Merge: avoid duplicates by name
      const existing = new Set(appData.photos.map(p=>p.name));
      const merged = [...appData.photos, ...vfsPhotos.filter(p=>!existing.has(p.name))];
      return merged;
    };

    const savePhoto = (photo) => {
      const d = OS.getAppData("myphotos") || { photos:[] };
      if (!d.photos.find(p=>p.name===photo.name)) {
        d.photos.push(photo);
        OS.setAppData("myphotos", d);
      }
    };

    const deletePhoto = (name) => {
      const d = OS.getAppData("myphotos") || { photos:[] };
      d.photos = d.photos.filter(p=>p.name!==name);
      OS.setAppData("myphotos", d);
      // Also remove from VFS if present
      FS.rm('C:/Users/User/Pictures/' + name);
    };

    const render = () => {
      const photos = loadAllPhotos();
      content.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border);flex-shrink:0;">
          <div style="font-size:18px;font-weight:600;">📷 Photos</div>
          <div style="color:var(--text-muted);font-size:12px;">${photos.length} photos</div>
          <div style="flex:1;"></div>
          <label style="padding:6px 14px;background:var(--accent);border-radius:6px;cursor:pointer;font-size:12px;color:#fff;">
            ➕ Upload Photos
            <input type="file" id="ph-upload-${id}" accept="image/*" multiple style="display:none;">
          </label>
        </div>
        ${photos.length===0?`
          <div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;color:var(--text-muted);">
            <div style="font-size:64px;">📷</div>
            <div style="font-size:16px;">No photos yet</div>
            <div style="font-size:13px;">Upload photos or save from Paint</div>
          </div>`:
          `<div style="flex:1;overflow-y:auto;padding:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;" id="ph-grid-${id}">
            ${photos.map((p,i)=>`
              <div data-photoidx="${i}" style="aspect-ratio:1;border-radius:8px;overflow:hidden;cursor:pointer;position:relative;background:#222;transition:transform 0.15s;group" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform=''">
                <img src="${p.dataUrl}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">
                <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.7));padding:6px 8px;font-size:11px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</div>
                <div style="position:absolute;top:4px;right:4px;display:flex;gap:4px;opacity:0;transition:opacity 0.15s;" class="ph-actions-${i}">
                  <button data-dlphoto="${i}" title="Download to computer" style="background:rgba(0,120,212,0.8);border:none;border-radius:4px;width:24px;height:24px;color:#fff;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;">⬇</button>
                  <button data-delphotos="${i}" title="Delete" style="background:rgba(196,43,28,0.8);border:none;border-radius:4px;width:24px;height:24px;color:#fff;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;">✕</button>
                </div>
              </div>`).join("")}
          </div>`}`;

      const up = document.getElementById(`ph-upload-${id}`);
      if (up) up.addEventListener("change", e => {
        const files = Array.from(e.target.files);
        let done = 0;
        files.forEach(file => {
          const reader = new FileReader();
          reader.onload = ev => {
            const photo = { name:file.name, dataUrl:ev.target.result, date:new Date().toISOString(), size:file.size };
            savePhoto(photo);
            // Also save to VFS Pictures
            FS.writeFile('C:/Users/User/Pictures/' + file.name, ev.target.result);
            done++;
            if (done===files.length) { render(); Notifications.send("Photos",`Added ${done} photo(s)`,"📷"); }
          };
          reader.readAsDataURL(file);
        });
      });

      const grid = document.getElementById(`ph-grid-${id}`);
      if (grid) {
        // Show action buttons on hover
        grid.querySelectorAll("[data-photoidx]").forEach((el, i) => {
          const actions = el.querySelector(`.ph-actions-${i}`);
          el.addEventListener('mouseenter', () => { if (actions) actions.style.opacity = '1'; });
          el.addEventListener('mouseleave', () => { if (actions) actions.style.opacity = '0'; });

          el.addEventListener("click", e => {
            if (e.target.dataset.delphotos !== undefined || e.target.dataset.dlphoto !== undefined) return;
            showLightbox(parseInt(el.dataset.photoidx), loadAllPhotos());
          });
        });

        grid.querySelectorAll("[data-dlphoto]").forEach(btn => {
          btn.addEventListener("click", e => {
            e.stopPropagation();
            const photos = loadAllPhotos();
            const photo = photos[parseInt(btn.dataset.dlphoto)];
            if (!photo) return;
            const a = document.createElement('a');
            a.href = photo.dataUrl;
            a.download = photo.name;
            a.click();
            Notifications.send("Photos", `Downloaded: ${photo.name}`, "⬇️");
          });
        });

        grid.querySelectorAll("[data-delphotos]").forEach(btn => {
          btn.addEventListener("click", e => {
            e.stopPropagation();
            const photos = loadAllPhotos();
            const photo = photos[parseInt(btn.dataset.delphotos)];
            if (!photo) return;
            if (confirm(`Delete "${photo.name}"?`)) {
              deletePhoto(photo.name);
              render();
            }
          });
        });
      }
    };

    const showLightbox = (idx, photos) => {
      const photo = photos[idx];
      if (!photo) return;
      const lb = document.createElement("div");
      lb.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;";
      lb.innerHTML = `
        <div style="position:absolute;top:16px;right:16px;display:flex;gap:8px;">
          <button id="lb-dl" title="Download to computer" style="background:rgba(0,120,212,0.8);border:none;border-radius:8px;padding:6px 14px;color:#fff;cursor:pointer;font-size:13px;">⬇️ Download</button>
          <button id="lb-prev" style="background:rgba(255,255,255,0.1);border:none;border-radius:50%;width:36px;height:36px;color:#fff;cursor:pointer;font-size:18px;">◀</button>
          <button id="lb-next" style="background:rgba(255,255,255,0.1);border:none;border-radius:50%;width:36px;height:36px;color:#fff;cursor:pointer;font-size:18px;">▶</button>
          <button id="lb-close" style="background:rgba(255,255,255,0.1);border:none;border-radius:50%;width:36px;height:36px;color:#fff;cursor:pointer;font-size:18px;">✕</button>
        </div>
        <img src="${photo.dataUrl}" style="max-width:90vw;max-height:80vh;border-radius:8px;object-fit:contain;">
        <div style="color:rgba(255,255,255,0.7);font-size:13px;">${photo.name} · ${idx+1}/${photos.length}</div>`;
      document.body.appendChild(lb);
      lb.addEventListener("click", e => { if (e.target===lb) lb.remove(); });
      document.getElementById("lb-close").addEventListener("click", () => lb.remove());
      document.getElementById("lb-dl").addEventListener("click", () => {
        const a = document.createElement('a');
        a.href = photo.dataUrl;
        a.download = photo.name;
        a.click();
      });
      document.getElementById("lb-prev").addEventListener("click", () => { lb.remove(); showLightbox((idx-1+photos.length)%photos.length, photos); });
      document.getElementById("lb-next").addEventListener("click", () => { lb.remove(); showLightbox((idx+1)%photos.length, photos); });
    };

    render();
  }
});
