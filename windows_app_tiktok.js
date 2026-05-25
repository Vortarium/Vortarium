// ===== TIKTOK =====
AppLauncher.register('tiktok', {
  title: 'TikTok', icon: '🎵',

  launch() {
    const id = WM.create({ title:'TikTok', icon:'🎵', width:400, height:700, appId:'tiktok' });
    const content = WM.getContent(id);
    content.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;background:#000;color:#fff;font-family:"Helvetica",sans-serif;';

    const saved = OS.getAppData('tiktok') || {};
    const state = {
      user: saved.user || { username: OS.settings.username || 'user', followers: 0, following: 127, likes: 0 },
      currentView: 'foryou', // 'foryou', 'following', 'profile', 'upload'
      currentVideoIndex: 0,
      uploadedVideos: saved.uploadedVideos || [],
      likedVideos: saved.likedVideos || [],
    };
    const save = () => OS.setAppData('tiktok', { user: state.user, uploadedVideos: state.uploadedVideos, likedVideos: state.likedVideos });

    // Trending videos with user's videos mixed in
    const trendingVideos = [
      { id: 'tt1', username: 'dancequeen', content: 'New dance trend! 💃', likes: 234567, comments: 12345, shares: 5678, music: 'Original Sound', thumb: '💃' },
      { id: 'tt2', username: 'comedyking', content: 'When you realize it\'s Monday 😭', likes: 456789, comments: 23456, shares: 8901, music: 'Funny Sound Effect', thumb: '😂' },
      { id: 'tt3', username: 'foodie_life', content: 'Making the perfect pasta 🍝', likes: 123456, comments: 6789, shares: 2345, music: 'Cooking Vibes', thumb: '🍝' },
      { id: 'tt4', username: 'petlover', content: 'My cat being dramatic again 🐱', likes: 345678, comments: 15678, shares: 7890, music: 'Cat Meow Remix', thumb: '🐱' },
      { id: 'tt5', username: 'artcreator', content: 'Speed painting challenge ✨', likes: 567890, comments: 34567, shares: 12345, music: 'Chill Beats', thumb: '🎨' },
      { id: 'tt6', username: 'fitnessguru', content: '5 minute morning workout 💪', likes: 234567, comments: 11234, shares: 4567, music: 'Workout Motivation', thumb: '💪' },
      { id: 'tt7', username: 'techreview', content: 'This phone feature is insane! 📱', likes: 456789, comments: 23456, shares: 8901, music: 'Tech Beat', thumb: '📱' },
      { id: 'tt8', username: 'travelbug', content: 'Hidden gem in Tokyo 🗾', likes: 678901, comments: 45678, shares: 15678, music: 'Travel Vibes', thumb: '🗾' },
    ];

    const formatCount = (count) => {
      if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
      if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
      return count.toString();
    };

    const simulateFollowerGrowth = (video) => {
      // 1 follower per 500 views (TikTok rate)
      const views = video.likes * 10; // Estimate views from likes
      return Math.floor(views / 500);
    };

    const getAllVideos = () => {
      const allVideos = [...trendingVideos];
      
      // Mix in user's uploaded videos
      state.uploadedVideos.forEach(userVideo => {
        if (Math.random() < 0.4) { // 40% chance to appear in feed
          const randomIndex = Math.floor(Math.random() * allVideos.length);
          allVideos.splice(randomIndex, 0, userVideo);
        }
      });
      
      return allVideos;
    };

    const render = () => {
      if (state.currentView === 'upload') {
        content.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;background:#000;">
            <!-- Upload header -->
            <div style="display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid #333;">
              <button onclick="state.currentView='foryou';render()" style="background:transparent;border:none;color:#fff;font-size:16px;cursor:pointer;">✕</button>
              <span style="font-size:16px;font-weight:600;">Create</span>
              <div style="width:24px;"></div>
            </div>
            
            <!-- Upload content -->
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;">
              <div id="tt-upload-area-${id}" style="width:200px;height:300px;border:2px dashed #666;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;margin-bottom:24px;transition:border-color 0.2s;" 
                   onmouseover="this.style.borderColor='#ff0050'" onmouseout="this.style.borderColor='#666'">
                <div style="font-size:48px;margin-bottom:12px;">📹</div>
                <div style="font-size:14px;text-align:center;color:#ccc;">Tap to upload video</div>
              </div>
              
              <div style="width:100%;max-width:300px;">
                <input id="tt-caption-${id}" type="text" placeholder="Write a caption..." 
                  style="width:100%;padding:12px;background:#1a1a1a;border:1px solid #333;border-radius:8px;color:#fff;font-size:14px;outline:none;margin-bottom:16px;" />
                
                <div style="margin-bottom:16px;">
                  <div style="font-size:12px;color:#ccc;margin-bottom:8px;">Add Music</div>
                  <select id="tt-music-${id}" style="width:100%;padding:12px;background:#1a1a1a;border:1px solid #333;border-radius:8px;color:#fff;font-size:14px;outline:none;">
                    <option>Original Sound</option>
                    <option>Trending Beat #1</option>
                    <option>Viral Dance Track</option>
                    <option>Chill Vibes</option>
                    <option>Upbeat Pop</option>
                    <option>Lo-fi Hip Hop</option>
                  </select>
                </div>
                
                <button id="tt-post-${id}" style="width:100%;padding:14px;background:#ff0050;border:none;border-radius:8px;color:#fff;font-size:16px;font-weight:600;cursor:pointer;">Post</button>
              </div>
            </div>
          </div>
        `;
      } else if (state.currentView === 'profile') {
        content.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;background:#000;">
            <!-- Profile header -->
            <div style="display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid #333;">
              <button onclick="state.currentView='foryou';render()" style="background:transparent;border:none;color:#fff;font-size:16px;cursor:pointer;">←</button>
              <span style="font-size:16px;font-weight:600;">${state.user.username}</span>
              <button style="background:transparent;border:none;color:#fff;font-size:16px;cursor:pointer;">⋯</button>
            </div>
            
            <!-- Profile info -->
            <div style="padding:24px;text-align:center;border-bottom:1px solid #333;">
              <div style="width:80px;height:80px;border-radius:50%;background:#ff0050;display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto 16px;">👤</div>
              <div style="font-size:18px;font-weight:600;margin-bottom:8px;">@${state.user.username}</div>
              
              <div style="display:flex;justify-content:center;gap:24px;margin-bottom:16px;">
                <div style="text-align:center;">
                  <div style="font-size:18px;font-weight:700;">${formatCount(state.user.following)}</div>
                  <div style="font-size:12px;color:#ccc;">Following</div>
                </div>
                <div style="text-align:center;">
                  <div style="font-size:18px;font-weight:700;">${formatCount(state.user.followers)}</div>
                  <div style="font-size:12px;color:#ccc;">Followers</div>
                </div>
                <div style="text-align:center;">
                  <div style="font-size:18px;font-weight:700;">${formatCount(state.user.likes)}</div>
                  <div style="font-size:12px;color:#ccc;">Likes</div>
                </div>
              </div>
              
              <button style="padding:8px 24px;background:#333;border:none;border-radius:6px;color:#fff;font-size:14px;cursor:pointer;">Edit Profile</button>
            </div>
            
            <!-- User's videos -->
            <div style="flex:1;overflow-y:auto;">
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:2px;padding:2px;">
                ${state.uploadedVideos.length === 0 ? 
                  '<div style="grid-column:1/-1;text-align:center;padding:48px;color:#666;">No videos yet</div>' :
                  state.uploadedVideos.map(video => `
                    <div style="aspect-ratio:9/16;background:#333;display:flex;align-items:center;justify-content:center;font-size:24px;cursor:pointer;position:relative;">
                      ${video.thumb}
                      <div style="position:absolute;bottom:4px;left:4px;font-size:10px;color:#fff;">👁️ ${formatCount(video.likes * 10)}</div>
                    </div>
                  `).join('')}
              </div>
            </div>
          </div>
        `;
      } else {
        // Main feed view
        const videos = getAllVideos();
        const currentVideo = videos[state.currentVideoIndex] || videos[0];
        
        content.innerHTML = `
          <div style="position:relative;height:100%;background:#000;">
            <!-- Video area -->
            <div style="height:100%;display:flex;align-items:center;justify-content:center;position:relative;">
              ${currentVideo && currentVideo.videoData ? `
                <video src="${currentVideo.videoData}" style="width:100%;height:100%;object-fit:cover;" autoplay loop muted playsinline></video>
              ` : `
                <div style="width:100%;height:100%;background:#111;display:flex;align-items:center;justify-content:center;font-size:64px;">
                  ${currentVideo ? currentVideo.thumb : '🎵'}
                </div>
              `}
              
              <!-- Video info overlay -->
              ${currentVideo ? `
                <div style="position:absolute;bottom:80px;left:16px;right:80px;">
                  <div style="font-size:14px;font-weight:600;margin-bottom:8px;">@${currentVideo.username}</div>
                  <div style="font-size:12px;margin-bottom:12px;line-height:1.4;">${currentVideo.content}</div>
                  <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#ccc;">
                    <span>🎵</span>
                    <span>${currentVideo.music}</span>
                  </div>
                </div>
              ` : ''}
              
              <!-- Right side actions -->
              <div style="position:absolute;right:16px;bottom:120px;display:flex;flex-direction:column;gap:16px;align-items:center;">
                <div style="text-align:center;">
                  <button id="tt-like-${id}" style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.2);border:none;color:#fff;font-size:20px;cursor:pointer;margin-bottom:4px;">❤️</button>
                  <div style="font-size:10px;">${currentVideo ? formatCount(currentVideo.likes) : '0'}</div>
                </div>
                <div style="text-align:center;">
                  <button style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.2);border:none;color:#fff;font-size:20px;cursor:pointer;margin-bottom:4px;">💬</button>
                  <div style="font-size:10px;">${currentVideo ? formatCount(currentVideo.comments) : '0'}</div>
                </div>
                <div style="text-align:center;">
                  <button style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.2);border:none;color:#fff;font-size:20px;cursor:pointer;margin-bottom:4px;">📤</button>
                  <div style="font-size:10px;">${currentVideo ? formatCount(currentVideo.shares) : '0'}</div>
                </div>
                <div style="width:32px;height:32px;border-radius:50%;background:#ff0050;display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;">👤</div>
              </div>
            </div>
            
            <!-- Bottom navigation -->
            <div style="position:absolute;bottom:0;left:0;right:0;height:60px;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:space-around;">
              <button data-nav="foryou" style="background:transparent;border:none;color:${state.currentView === 'foryou' ? '#fff' : '#666'};font-size:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;">
                <span style="font-size:20px;">🏠</span>
                <span>Home</span>
              </button>
              <button data-nav="following" style="background:transparent;border:none;color:${state.currentView === 'following' ? '#fff' : '#666'};font-size:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;">
                <span style="font-size:20px;">👥</span>
                <span>Following</span>
              </button>
              <button id="tt-create-${id}" style="background:#ff0050;border:none;color:#fff;font-size:20px;cursor:pointer;width:40px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;">+</button>
              <button style="background:transparent;border:none;color:#666;font-size:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;">
                <span style="font-size:20px;">💬</span>
                <span>Inbox</span>
              </button>
              <button data-nav="profile" style="background:transparent;border:none;color:${state.currentView === 'profile' ? '#fff' : '#666'};font-size:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;">
                <span style="font-size:20px;">👤</span>
                <span>Profile</span>
              </button>
            </div>
            
            <!-- Swipe indicators -->
            <div style="position:absolute;right:8px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:4px;">
              <div style="width:2px;height:20px;background:rgba(255,255,255,0.3);border-radius:1px;"></div>
              <div style="width:2px;height:20px;background:#fff;border-radius:1px;"></div>
              <div style="width:2px;height:20px;background:rgba(255,255,255,0.3);border-radius:1px;"></div>
            </div>
          </div>
        `;
      }

      bindEvents();
    };

    const bindEvents = () => {
      // Navigation
      content.querySelectorAll('[data-nav]').forEach(el => {
        el.addEventListener('click', () => {
          state.currentView = el.dataset.nav;
          render();
        });
      });

      // Create button
      const createBtn = document.getElementById(`tt-create-${id}`);
      if (createBtn) {
        createBtn.addEventListener('click', () => {
          state.currentView = 'upload';
          render();
        });
      }

      // Upload area
      let selectedVideoFile = null;
      const uploadArea = document.getElementById(`tt-upload-area-${id}`);
      if (uploadArea) {
        uploadArea.addEventListener('click', () => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'video/*';
          input.onchange = e => {
            const file = e.target.files[0];
            if (file) {
              selectedVideoFile = file;
              uploadArea.innerHTML = `<div style="font-size:48px;margin-bottom:12px;">✅</div><div style="font-size:14px;text-align:center;color:#ccc;">${file.name}</div>`;
              Notifications.send('TikTok', 'Video selected! Add caption and post.', '📹');
            }
          };
          input.click();
        });
      }

      // Post video
      const postBtn = document.getElementById(`tt-post-${id}`);
      if (postBtn) {
        postBtn.addEventListener('click', () => {
          const caption = document.getElementById(`tt-caption-${id}`).value.trim();
          const music = document.getElementById(`tt-music-${id}`).value;
          
          if (!caption) {
            alert('Please add a caption');
            return;
          }

          if (!selectedVideoFile) {
            alert('Please select a video first');
            return;
          }

          const reader = new FileReader();
          reader.onload = (e) => {
            const newVideo = {
              id: 'user_tt_' + Date.now(),
              username: state.user.username,
              content: caption,
              music,
              likes: 0,
              comments: 0,
              shares: 0,
              thumb: ['🎬', '🎥', '📹', '🎞️', '✨', '🔥'][Math.floor(Math.random() * 6)],
              videoData: e.target.result,
              uploadTime: Date.now()
            };

            state.uploadedVideos.unshift(newVideo);
          
            // Start engagement growth simulation
            setTimeout(() => {
              const growthInterval = setInterval(() => {
                const video = state.uploadedVideos.find(v => v.id === newVideo.id);
                if (video) {
                  // Simulate viral growth pattern
                  const minutesSinceUpload = (Date.now() - video.uploadTime) / 60000;
                  const baseGrowth = Math.floor(minutesSinceUpload * (1 + Math.random() * 2));
                  
                  video.likes += baseGrowth;
                  video.comments += Math.floor(baseGrowth * 0.1);
                  video.shares += Math.floor(baseGrowth * 0.05);
                  
                  // Update user stats
                  state.user.likes += baseGrowth;
                  const newFollowers = simulateFollowerGrowth(video);
                  if (newFollowers > state.user.followers) {
                    state.user.followers = newFollowers;
                  }
                  
                  save();
                }
              }, 30000); // Update every 30 seconds
              
              // Stop growth after 2 hours
              setTimeout(() => clearInterval(growthInterval), 2 * 60 * 60 * 1000);
            }, 1000);

            save();
            Notifications.send('TikTok', 'Video posted! 🎉', '🎵');
            state.currentView = 'foryou';
            render();
          };
          reader.readAsDataURL(selectedVideoFile);
        });
      }

      // Like button
      const likeBtn = document.getElementById(`tt-like-${id}`);
      if (likeBtn) {
        likeBtn.addEventListener('click', () => {
          const videos = getAllVideos();
          const currentVideo = videos[state.currentVideoIndex];
          if (currentVideo && !state.likedVideos.includes(currentVideo.id)) {
            state.likedVideos.push(currentVideo.id);
            currentVideo.likes += 1;
            save();
            likeBtn.style.color = '#ff0050';
            Notifications.send('TikTok', 'Liked! ❤️', '🎵');
          }
        });
      }

      // Swipe gestures (simplified - just click to next)
      content.addEventListener('click', (e) => {
        if (state.currentView === 'foryou' || state.currentView === 'following') {
          // Don't trigger on buttons
          if (e.target.tagName === 'BUTTON') return;
          
          const videos = getAllVideos();
          if (e.clientY > content.offsetHeight / 2) {
            // Swipe up - next video
            state.currentVideoIndex = (state.currentVideoIndex + 1) % videos.length;
          } else {
            // Swipe down - previous video
            state.currentVideoIndex = state.currentVideoIndex > 0 ? state.currentVideoIndex - 1 : videos.length - 1;
          }
          render();
        }
      });
    };

    render();
  }
});