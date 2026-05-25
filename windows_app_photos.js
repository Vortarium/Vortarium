// ===== PHOTOS APP =====
AppLauncher.register('photos', {
  title: 'Photos',
  icon: '🖼️',

  launch() {
    const id = WM.create({
      title: 'Photos',
      icon: '🖼️',
      width: 800,
      height: 560,
      appId: 'photos',
    });

    const content = WM.getContent(id);

    // Generate placeholder photos with gradients
    const photos = [
      { name: 'Sunset', gradient: 'linear-gradient(135deg,#fc466b,#3f5efb)', emoji: '🌅' },
      { name: 'Forest', gradient: 'linear-gradient(135deg,#11998e,#38ef7d)', emoji: '🌲' },
      { name: 'Ocean', gradient: 'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)', emoji: '🌊' },
      { name: 'Mountains', gradient: 'linear-gradient(135deg,#0f2027,#203a43,#2c5364)', emoji: '⛰️' },
      { name: 'City Night', gradient: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)', emoji: '🌃' },
      { name: 'Desert', gradient: 'linear-gradient(135deg,#f7971e,#ffd200)', emoji: '🏜️' },
      { name: 'Aurora', gradient: 'linear-gradient(135deg,#2d1b69,#11998e,#38ef7d)', emoji: '🌌' },
      { name: 'Flowers', gradient: 'linear-gradient(135deg,#e91e63,#ff9800)', emoji: '🌸' },
      { name: 'Space', gradient: 'linear-gradient(135deg,#0d1117,#161b22,#21262d)', emoji: '🚀' },
      { name: 'Rain', gradient: 'linear-gradient(135deg,#141e30,#243b55)', emoji: '🌧️' },
      { name: 'Volcano', gradient: 'linear-gradient(135deg,#c0392b,#f39c12)', emoji: '🌋' },
      { name: 'Waterfall', gradient: 'linear-gradient(135deg,#1e3a5f,#2d6a9f)', emoji: '💧' },
    ];

    const state = { view: 'grid', selected: null };

    const renderGrid = () => {
      content.innerHTML = `
        <div class="win-toolbar">
          <button class="win-toolbar-btn active" id="ph-grid-${id}">⊞ Grid</button>
          <button class="win-toolbar-btn" id="ph-list-${id}">☰ List</button>
          <div style="flex:1"></div>
          <button class="win-toolbar-btn" id="ph-import-${id}">📥 Import</button>
        </div>
        <div class="photos-grid" id="ph-grid-content-${id}">
          ${photos.map((p, i) => `
            <div class="photo-thumb" data-idx="${i}" style="background:${p.gradient}">
              <span style="font-size:40px">${p.emoji}</span>
            </div>
          `).join('')}
        </div>
      `;

      document.querySelectorAll(`#${id} .photo-thumb`).forEach(thumb => {
        thumb.addEventListener('click', () => {
          const idx = parseInt(thumb.dataset.idx);
          showPhoto(idx);
        });
      });

      document.getElementById(`ph-import-${id}`).addEventListener('click', () => {
        Notifications.send('Photos', 'Import feature coming soon!', '📥');
      });
    };

    const showPhoto = (idx) => {
      const photo = photos[idx];
      content.innerHTML = `
        <div class="win-toolbar">
          <button class="win-toolbar-btn" id="ph-back-${id}">◀ Back</button>
          <div style="flex:1;text-align:center;font-size:13px;color:var(--text-muted)">${photo.name} (${idx+1}/${photos.length})</div>
          <button class="win-toolbar-btn" id="ph-prev-${id}">◀</button>
          <button class="win-toolbar-btn" id="ph-next-${id}">▶</button>
          <button class="win-toolbar-btn" id="ph-delete-${id}">🗑️</button>
          <button class="win-toolbar-btn" id="ph-share-${id}">📤 Share</button>
        </div>
        <div style="flex:1;display:flex;align-items:center;justify-content:center;background:${photo.gradient};position:relative">
          <span style="font-size:120px;filter:drop-shadow(0 8px 24px rgba(0,0,0,0.5))">${photo.emoji}</span>
          <div style="position:absolute;bottom:16px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.5);backdrop-filter:blur(10px);padding:8px 16px;border-radius:20px;font-size:13px">${photo.name}</div>
        </div>
      `;

      document.getElementById(`ph-back-${id}`).addEventListener('click', renderGrid);
      document.getElementById(`ph-prev-${id}`).addEventListener('click', () => showPhoto((idx - 1 + photos.length) % photos.length));
      document.getElementById(`ph-next-${id}`).addEventListener('click', () => showPhoto((idx + 1) % photos.length));
      document.getElementById(`ph-delete-${id}`).addEventListener('click', () => {
        Notifications.send('Photos', `Deleted: ${photo.name}`, '🗑️');
        renderGrid();
      });
      document.getElementById(`ph-share-${id}`).addEventListener('click', () => {
        Notifications.send('Photos', `Shared: ${photo.name}`, '📤');
      });
    };

    renderGrid();
  }
});
