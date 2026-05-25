// ===== YOUTUBE =====
AppLauncher.register('youtube', {
  title: 'YouTube', icon: '▶️',

  launch() {
    const id = WM.create({ title:'YouTube', icon:'▶️', width:1200, height:750, appId:'youtube' });
    const content = WM.getContent(id);
    content.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;background:#0f0f0f;color:#fff;font-family:"Roboto",sans-serif;';

    const saved = OS.getAppData('youtube') || {};
    const state = {
      user: saved.user || { name: OS.settings.username || 'User', subscribers: 0, videos: [] },
      currentView: 'home', // 'home', 'trending', 'subscriptions', 'library', 'upload', 'studio'
      searchQuery: '',
      currentVideo: null,
      uploadedVideos: saved.uploadedVideos || [],
      watchHistory: saved.watchHistory || [],
    };
    const save = () => OS.setAppData('youtube', { user: state.user, uploadedVideos: state.uploadedVideos, watchHistory: state.watchHistory });

    // Trending videos with realistic view growth simulation
    const trendingVideos = [
      { id: 'v1', title: 'Amazing Cat Compilation 2024', channel: 'PetLover99', views: 2847392, likes: 89234, duration: '10:23', thumb: '🐱', uploaded: '2 days ago' },
      { id: 'v2', title: 'How to Code in 10 Minutes', channel: 'TechGuru', views: 1293847, likes: 45672, duration: '9:47', thumb: '💻', uploaded: '1 week ago' },
      { id: 'v3', title: 'Epic Gaming Moments', channel: 'GameMaster', views: 5847392, likes: 234567, duration: '15:32', thumb: '🎮', uploaded: '3 days ago' },
      { id: 'v4', title: 'Cooking Masterclass', channel: 'ChefLife', views: 892374, likes: 23456, duration: '22:15', thumb: '👨‍🍳', uploaded: '5 days ago' },
      { id: 'v5', title: 'Travel Vlog: Japan', channel: 'Wanderlust', views: 3847392, likes: 156789, duration: '18:45', thumb: '🗾', uploaded: '1 day ago' },
      { id: 'v6', title: 'Music Production Tips', channel: 'BeatMaker', views: 647392, likes: 34567, duration: '12:30', thumb: '🎵', uploaded: '4 days ago' },
      { id: 'v7', title: 'Fitness Transformation', channel: 'FitLife', views: 1847392, likes: 78901, duration: '8:15', thumb: '💪', uploaded: '6 days ago' },
      { id: 'v8', title: 'Art Tutorial: Digital Painting', channel: 'ArtMaster', views: 547392, likes: 23456, duration: '25:40', thumb: '🎨', uploaded: '1 week ago' },
    ];

    const formatViews = (views) => {
      if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
      if (views >= 1000) return (views / 1000).toFixed(1) + 'K';
      return views.toString();
    };

    const formatLikes = (likes) => {
      if (likes >= 1000000) return (likes / 1000000).toFixed(1) + 'M';
      if (likes >= 1000) return (likes / 1000).toFixed(1) + 'K';
      return likes.toString();
    };

    const simulateViewGrowth = (video) => {
      // Simulate realistic view growth: 1 view per minute initially, then exponential growth, then plateau
      const minutesSinceUpload = Math.floor(Math.random() * 10080); // Up to 1 week
      let views = minutesSinceUpload; // Base growth: 1 view per minute
      
      if (minutesSinceUpload > 60) {
        // After 1 hour, exponential growth phase
        const exponentialPhase = Math.min(minutesSinceUpload - 60, 1440); // Up to 24 hours
        views += Math.floor(exponentialPhase * exponentialPhase * 0.1);
      }
      
      if (minutesSinceUpload > 1500) {
        // After ~25 hours, rapid growth to K/M range
        const rapidPhase = Math.min(minutesSinceUpload - 1500, 2880); // Up to 48 more hours
        views += Math.floor(rapidPhase * 100 * Math.random() * 10);
      }
      
      return Math.max(views, video.views || 0);
    };

    const render = () => {
      content.innerHTML = `
        <!-- Header -->
        <div style="display:flex;align-items:center;padding:0 16px;height:56px;background:#0f0f0f;border-bottom:1px solid #272727;flex-shrink:0;">
          <div style="display:flex;align-items:center;gap:8px;margin-right:24px;">
            <span style="font-size:24px;">▶️</span>
            <span style="font-size:20px;font-weight:700;">YouTube</span>
          </div>
          
          <div style="flex:1;max-width:600px;display:flex;align-items:center;gap:8px;">
            <div style="flex:1;display:flex;align-items:center;background:#121212;border:1px solid #303030;border-radius:20px;overflow:hidden;">
              <input id="yt-search-${id}" type="text" placeholder="Search" value="${state.searchQuery}" 
                style="flex:1;padding:10px 16px;background:transparent;border:none;color:#fff;font-size:14px;outline:none;" />
              <button style="padding:8px 20px;background:#303030;border:none;color:#fff;cursor:pointer;">🔍</button>
            </div>
          </div>
          
          <div style="display:flex;align-items:center;gap:16px;margin-left:24px;">
            <button id="yt-upload-${id}" style="display:flex;align-items:center;gap:6px;padding:8px 16px;background:#cc0000;border:none;border-radius:18px;color:#fff;cursor:pointer;font-size:14px;font-weight:500;">
              📹 Create
            </button>
            <div style="width:32px;height:32px;border-radius:50%;background:#cc0000;display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;">👤</div>
          </div>
        </div>

        <!-- Main content -->
        <div style="flex:1;display:flex;overflow:hidden;">
          
          <!-- Sidebar -->
          <div style="width:240px;background:#0f0f0f;border-right:1px solid #272727;overflow-y:auto;flex-shrink:0;">
            <div style="padding:12px 0;">
              ${[
                { id: 'home', icon: '🏠', label: 'Home' },
                { id: 'trending', icon: '🔥', label: 'Trending' },
                { id: 'subscriptions', icon: '📺', label: 'Subscriptions' },
                { id: 'library', icon: '📚', label: 'Library' },
                { id: 'studio', icon: '🎬', label: 'YouTube Studio' },
              ].map(item => `
                <div data-nav="${item.id}" style="display:flex;align-items:center;gap:16px;padding:10px 24px;cursor:pointer;background:${state.currentView === item.id ? '#272727' : 'transparent'};transition:background 0.1s;" 
                     onmouseover="this.style.background='#272727'" onmouseout="this.style.background='${state.currentView === item.id ? '#272727' : 'transparent'}'">
                  <span style="font-size:20px;">${item.icon}</span>
                  <span style="font-size:14px;">${item.label}</span>
                </div>
              `).join('')}
            </div>
            
            <div style="border-top:1px solid #272727;padding:12px 24px;">
              <div style="font-size:12px;color:#aaa;margin-bottom:8px;">Your Channel</div>
              <div style="font-size:14px;font-weight:500;">${state.user.name}</div>
              <div style="font-size:12px;color:#aaa;">${formatViews(state.user.subscribers)} subscribers</div>
              <div style="font-size:12px;color:#aaa;">${state.uploadedVideos.length} videos</div>
            </div>
          </div>

          <!-- Content area -->
          <div style="flex:1;overflow-y:auto;">
            ${renderCurrentView()}
          </div>
        </div>
      `;

      bindEvents();
    };

    const renderCurrentView = () => {
      // Video player view
      if (state.currentVideo) {
        return `
          <div style="display:flex;flex-direction:column;height:100%;background:#0f0f0f;">
            <div style="display:flex;align-items:center;gap:16px;padding:16px;border-bottom:1px solid #303030;">
              <button id="yt-back-${id}" style="background:transparent;border:none;color:#fff;font-size:20px;cursor:pointer;">←</button>
              <span style="font-size:14px;color:#aaa;">Now Playing</span>
            </div>
            
            <div style="flex:1;display:flex;flex-direction:column;overflow-y:auto;">
              <div style="width:100%;background:#000;aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;">
                ${state.currentVideo.videoData ? `
                  <video src="${state.currentVideo.videoData}" style="width:100%;height:100%;object-fit:contain;" controls autoplay></video>
                ` : `
                  <div style="font-size:64px;">${state.currentVideo.thumb}</div>
                `}
              </div>
              
              <div style="padding:24px;">
                <div style="font-size:20px;font-weight:600;margin-bottom:8px;">${state.currentVideo.title}</div>
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
                  <div style="width:40px;height:40px;border-radius:50%;background:#303030;display:flex;align-items:center;justify-content:center;font-size:20px;">${state.currentVideo.thumb}</div>
                  <div>
                    <div style="font-size:14px;font-weight:500;">${state.currentVideo.channel}</div>
                    <div style="font-size:12px;color:#aaa;">${formatViews(state.currentVideo.views)} views • ${state.currentVideo.uploaded}</div>
                  </div>
                </div>
                
                <div style="display:flex;gap:16px;margin-bottom:16px;">
                  <button style="display:flex;align-items:center;gap:8px;padding:8px 16px;background:#272727;border:none;border-radius:18px;color:#fff;cursor:pointer;">
                    👍 ${formatLikes(state.currentVideo.likes)}
                  </button>
                  <button style="display:flex;align-items:center;gap:8px;padding:8px 16px;background:#272727;border:none;border-radius:18px;color:#fff;cursor:pointer;">
                    👎
                  </button>
                  <button style="display:flex;align-items:center;gap:8px;padding:8px 16px;background:#272727;border:none;border-radius:18px;color:#fff;cursor:pointer;">
                    💬 ${formatLikes(state.currentVideo.comments)}
                  </button>
                  <button style="display:flex;align-items:center;gap:8px;padding:8px 16px;background:#272727;border:none;border-radius:18px;color:#fff;cursor:pointer;">
                    📤 Share
                  </button>
                </div>
                
                ${state.currentVideo.description ? `
                  <div style="background:#272727;padding:16px;border-radius:12px;margin-bottom:16px;">
                    <div style="font-size:14px;font-weight:600;margin-bottom:8px;">Description</div>
                    <div style="font-size:14px;color:#ccc;white-space:pre-wrap;">${state.currentVideo.description}</div>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      }

      if (state.currentView === 'upload') {
        return `
          <div style="padding:24px;max-width:800px;margin:0 auto;">
            <div style="font-size:24px;font-weight:700;margin-bottom:24px;">Upload Video</div>
            
            <div id="yt-upload-area-${id}" style="border:2px dashed #303030;border-radius:8px;padding:48px;text-align:center;margin-bottom:24px;cursor:pointer;transition:border-color 0.2s;" 
                 onmouseover="this.style.borderColor='#cc0000'" onmouseout="this.style.borderColor='#303030'">
              <div style="font-size:48px;margin-bottom:16px;">📹</div>
              <div style="font-size:18px;margin-bottom:8px;">Drag and drop video files to upload</div>
              <div style="font-size:14px;color:#aaa;">Or click to select files</div>
            </div>
            
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <div>
                <label style="display:block;font-size:14px;margin-bottom:8px;">Title</label>
                <input id="yt-title-${id}" type="text" placeholder="Enter video title" 
                  style="width:100%;padding:12px;background:#181818;border:1px solid #303030;border-radius:4px;color:#fff;font-size:14px;outline:none;" />
              </div>
              <div>
                <label style="display:block;font-size:14px;margin-bottom:8px;">Category</label>
                <select id="yt-category-${id}" style="width:100%;padding:12px;background:#181818;border:1px solid #303030;border-radius:4px;color:#fff;font-size:14px;outline:none;">
                  <option>Gaming</option>
                  <option>Music</option>
                  <option>Education</option>
                  <option>Entertainment</option>
                  <option>Technology</option>
                  <option>Lifestyle</option>
                  <option>Sports</option>
                  <option>Travel</option>
                </select>
              </div>
            </div>
            
            <div style="margin-top:16px;">
              <label style="display:block;font-size:14px;margin-bottom:8px;">Description</label>
              <textarea id="yt-desc-${id}" placeholder="Tell viewers about your video" 
                style="width:100%;height:120px;padding:12px;background:#181818;border:1px solid #303030;border-radius:4px;color:#fff;font-size:14px;outline:none;resize:vertical;"></textarea>
            </div>
            
            <div style="margin-top:24px;display:flex;gap:12px;">
              <button id="yt-publish-${id}" style="padding:12px 24px;background:#cc0000;border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:14px;font-weight:500;">Publish</button>
              <button onclick="state.currentView='home';render()" style="padding:12px 24px;background:#303030;border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:14px;">Cancel</button>
            </div>
          </div>
        `;
      }

      if (state.currentView === 'studio') {
        return `
          <div style="padding:24px;">
            <div style="font-size:24px;font-weight:700;margin-bottom:24px;">YouTube Studio</div>
            
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:32px;">
              <div style="background:#181818;padding:20px;border-radius:8px;">
                <div style="font-size:32px;font-weight:700;color:#cc0000;">${state.uploadedVideos.length}</div>
                <div style="font-size:14px;color:#aaa;">Videos</div>
              </div>
              <div style="background:#181818;padding:20px;border-radius:8px;">
                <div style="font-size:32px;font-weight:700;color:#cc0000;">${formatViews(state.user.subscribers)}</div>
                <div style="font-size:14px;color:#aaa;">Subscribers</div>
              </div>
              <div style="background:#181818;padding:20px;border-radius:8px;">
                <div style="font-size:32px;font-weight:700;color:#cc0000;">${formatViews(state.uploadedVideos.reduce((sum, v) => sum + (v.views || 0), 0))}</div>
                <div style="font-size:14px;color:#aaa;">Total Views</div>
              </div>
            </div>
            
            <div style="font-size:18px;font-weight:600;margin-bottom:16px;">Your Videos</div>
            ${state.uploadedVideos.length === 0 ? 
              '<div style="text-align:center;padding:48px;color:#aaa;">No videos uploaded yet</div>' :
              `<div style="display:grid;gap:12px;">
                ${state.uploadedVideos.map(video => `
                  <div style="display:flex;gap:16px;padding:16px;background:#181818;border-radius:8px;">
                    <div style="width:120px;height:68px;background:#303030;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;">${video.thumb}</div>
                    <div style="flex:1;">
                      <div style="font-size:16px;font-weight:500;margin-bottom:4px;">${video.title}</div>
                      <div style="font-size:12px;color:#aaa;margin-bottom:8px;">Uploaded ${video.uploaded}</div>
                      <div style="display:flex;gap:16px;font-size:12px;color:#aaa;">
                        <span>👁️ ${formatViews(video.views)} views</span>
                        <span>👍 ${formatLikes(video.likes)} likes</span>
                        <span>💬 ${video.comments || 0} comments</span>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>`}
          </div>
        `;
      }

      // Default home view with trending videos + user's videos mixed in
      const allVideos = [...trendingVideos];
      
      // Mix in user's uploaded videos randomly
      state.uploadedVideos.forEach(userVideo => {
        if (Math.random() < 0.3) { // 30% chance to appear in feed
          const randomIndex = Math.floor(Math.random() * allVideos.length);
          allVideos.splice(randomIndex, 0, userVideo);
        }
      });

      return `
        <div style="padding:24px;">
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;">
            ${allVideos.map(video => `
              <div data-videoid="${video.id}" style="cursor:pointer;transition:transform 0.2s;" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform=''">
                <div style="width:100%;height:180px;background:#303030;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:48px;margin-bottom:12px;position:relative;">
                  ${video.thumb}
                  <div style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,0.8);padding:2px 6px;border-radius:4px;font-size:12px;">${video.duration}</div>
                </div>
                <div style="display:flex;gap:12px;">
                  <div style="width:36px;height:36px;border-radius:50%;background:#cc0000;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">${video.channel[0]}</div>
                  <div style="flex:1;">
                    <div style="font-size:14px;font-weight:500;line-height:1.3;margin-bottom:4px;">${video.title}</div>
                    <div style="font-size:12px;color:#aaa;">${video.channel}</div>
                    <div style="font-size:12px;color:#aaa;">${formatViews(video.views)} views • ${video.uploaded}</div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    };

    const bindEvents = () => {
      // Navigation
      content.querySelectorAll('[data-nav]').forEach(el => {
        el.addEventListener('click', () => {
          state.currentView = el.dataset.nav;
          render();
        });
      });

      // Upload button
      const uploadBtn = document.getElementById(`yt-upload-${id}`);
      if (uploadBtn) {
        uploadBtn.addEventListener('click', () => {
          state.currentView = 'upload';
          render();
        });
      }

      // Upload area
      let selectedVideoFile = null;
      const uploadArea = document.getElementById(`yt-upload-area-${id}`);
      if (uploadArea) {
        uploadArea.addEventListener('click', () => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'video/*';
          input.onchange = e => {
            const file = e.target.files[0];
            if (file) {
              selectedVideoFile = file;
              document.getElementById(`yt-title-${id}`).value = file.name.replace(/\.[^/.]+$/, '');
              uploadArea.innerHTML = `<div style="font-size:48px;margin-bottom:16px;">✅</div><div style="font-size:18px;margin-bottom:8px;">${file.name}</div><div style="font-size:14px;color:#aaa;">Video selected</div>`;
            }
          };
          input.click();
        });
      }

      // Publish video
      const publishBtn = document.getElementById(`yt-publish-${id}`);
      if (publishBtn) {
        publishBtn.addEventListener('click', () => {
          const title = document.getElementById(`yt-title-${id}`).value.trim();
          const category = document.getElementById(`yt-category-${id}`).value;
          const description = document.getElementById(`yt-desc-${id}`).value.trim();
          
          if (!title) {
            alert('Please enter a video title');
            return;
          }

          if (!selectedVideoFile) {
            alert('Please select a video first');
            return;
          }

          const reader = new FileReader();
          reader.onload = (e) => {
            const newVideo = {
              id: 'user_' + Date.now(),
              title,
              channel: state.user.name,
              category,
              description,
              views: 0,
              likes: 0,
              comments: 0,
              duration: Math.floor(Math.random() * 20 + 5) + ':' + String(Math.floor(Math.random() * 60)).padStart(2, '0'),
              thumb: ['🎬', '🎥', '📹', '🎞️'][Math.floor(Math.random() * 4)],
              uploaded: 'Just now',
              uploadTime: Date.now(),
              videoData: e.target.result
            };

            state.uploadedVideos.unshift(newVideo);
          
            // Start view growth simulation
            setTimeout(() => {
              const growthInterval = setInterval(() => {
                const video = state.uploadedVideos.find(v => v.id === newVideo.id);
                if (video) {
                  video.views = simulateViewGrowth(video);
                  video.likes = Math.floor(video.views * (0.02 + Math.random() * 0.08)); // 2-10% like rate
                  video.comments = Math.floor(video.views * (0.001 + Math.random() * 0.004)); // 0.1-0.5% comment rate
                  
                  // Update subscriber count (1 subscriber per 1000 views)
                  const newSubs = Math.floor(video.views / 1000);
                  if (newSubs > state.user.subscribers) {
                    state.user.subscribers = newSubs;
                  }
                  
                  save();
                }
              }, 60000); // Update every minute
              
              // Stop growth after 24 hours
              setTimeout(() => clearInterval(growthInterval), 24 * 60 * 60 * 1000);
            }, 1000);

            save();
            Notifications.send('YouTube', 'Video uploaded successfully!', '📹');
            state.currentView = 'studio';
            render();
          };
          reader.readAsDataURL(selectedVideoFile);
        });
      }

      // Video clicks
      content.querySelectorAll('[data-videoid]').forEach(el => {
        el.addEventListener('click', () => {
          const video = [...trendingVideos, ...state.uploadedVideos].find(v => v.id === el.dataset.videoid);
          if (video) {
            state.currentVideo = video;
            state.watchHistory.unshift(video);
            if (state.watchHistory.length > 50) state.watchHistory = state.watchHistory.slice(0, 50);
            save();
            Notifications.send('YouTube', `Now watching: ${video.title}`, '▶️');
            render();
          }
        });
      });

      // Back button (video player)
      const backBtn = document.getElementById(`yt-back-${id}`);
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          state.currentVideo = null;
          render();
        });
      }

      // Search
      const searchInput = document.getElementById(`yt-search-${id}`);
      if (searchInput) {
        searchInput.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            state.searchQuery = e.target.value;
            // For now, just show notification
            Notifications.send('YouTube', `Searching for: ${state.searchQuery}`, '🔍');
          }
        });
      }
    };

    render();
  }
});