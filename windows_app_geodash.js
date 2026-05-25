// ===== GEOMETRY DASH CLONE =====
AppLauncher.register("geodash", {
  title: "Geometry Dash", icon: "🟦",
  launch() {
    const id = WM.create({ title:"Geometry Dash", icon:"🟦", width:900, height:560, appId:"geodash" });
    const content = WM.getContent(id);
    content.style.cssText = "display:flex;flex-direction:column;overflow:hidden;background:#000;";
    content.innerHTML = `<canvas id="gd-canvas-${id}" style="display:block;width:100%;height:100%;"></canvas>`;
    const canvas = document.getElementById(`gd-canvas-${id}`);
    const ctx = canvas.getContext("2d");

    const resize = () => { canvas.width=content.offsetWidth; canvas.height=content.offsetHeight; };
    resize();
    new ResizeObserver(resize).observe(content);

    // Game state — fully reset on each startGame()
    let state, player, obstacles, frame, animId;

    const GRAVITY = 980; // px/sec²
    const JUMP_VEL = -520; // px/sec
    const GROUND = () => canvas.height - 80;

    const resetState = () => {
      state = { running:false, dead:false, score:0, speed:300, bgHue:200 }; // speed in px/sec
      player = { x:120, y:0, w:40, h:40, vy:0, onGround:false };
      obstacles = [];
      frame = 0;
    };

    const startGame = () => {
      resetState();
      state.running = true;
      player.y = GROUND() - player.h;
      player.onGround = true;
    };

    const jump = () => {
      if (state.dead) { startGame(); return; }
      if (!state.running) { startGame(); return; }
      if (player.onGround) { player.vy = JUMP_VEL; player.onGround = false; }
    };

    const spawnObstacle = () => {
      const h = 40 + Math.random()*60;
      obstacles.push({ x:canvas.width+20, y:GROUND()-h, w:30, h, color:`hsl(${Math.random()*360},80%,60%)` });
    };

    let lastFrameTime = performance.now();
    let spawnAccum = 0;
    const SPAWN_INTERVAL = 1.8; // seconds between spawns

    const gameLoop = (now) => {
      animId = requestAnimationFrame(gameLoop);
      const rawDt = (now - lastFrameTime) / 1000;
      lastFrameTime = now;
      // Clamp dt to avoid huge jumps when tab was hidden
      const dt = Math.min(rawDt, 0.05);

      ctx.fillStyle = `hsl(${state.bgHue},60%,15%)`;
      ctx.fillRect(0,0,canvas.width,canvas.height);
      state.bgHue = (state.bgHue + 30*dt) % 360;

      ctx.fillStyle = `hsl(${state.bgHue},50%,30%)`;
      ctx.fillRect(0,GROUND(),canvas.width,80);
      ctx.fillStyle = `hsl(${state.bgHue},60%,40%)`;
      ctx.fillRect(0,GROUND(),canvas.width,4);

      if (!state.running && !state.dead) {
        ctx.fillStyle="#fff"; ctx.font=`bold ${Math.min(canvas.width/15,40)}px Arial`; ctx.textAlign="center";
        ctx.fillText("GEOMETRY DASH",canvas.width/2,canvas.height/2-40);
        ctx.font=`${Math.min(canvas.width/20,22)}px Arial`; ctx.fillStyle="#aef";
        ctx.fillText("Click or Space to Start",canvas.width/2,canvas.height/2+10);
        ctx.textAlign="left"; return;
      }

      if (state.dead) {
        ctx.fillStyle="#fff"; ctx.font=`bold ${Math.min(canvas.width/15,36)}px Arial`; ctx.textAlign="center";
        ctx.fillText("GAME OVER",canvas.width/2,canvas.height/2-30);
        ctx.font=`${Math.min(canvas.width/20,20)}px Arial`; ctx.fillStyle="#ffd700";
        ctx.fillText(`Score: ${state.score}`,canvas.width/2,canvas.height/2+10);
        ctx.fillStyle="#aef"; ctx.fillText("Click or Space to Restart",canvas.width/2,canvas.height/2+45);
        ctx.textAlign="left"; return;
      }

      frame++;
      state.score = Math.floor(frame * 60 / 360); // normalize to ~60fps equivalent
      state.speed = 300 + Math.floor(state.score/200)*30; // px/sec

      // Spawn obstacles by time
      spawnAccum += dt;
      const spawnInterval = Math.max(0.8, SPAWN_INTERVAL - state.score/500);
      if (spawnAccum >= spawnInterval) { spawnAccum -= spawnInterval; spawnObstacle(); }

      // Physics (delta-time based)
      player.vy += GRAVITY * dt;
      player.y += player.vy * dt;
      if (player.y >= GROUND()-player.h) { player.y=GROUND()-player.h; player.vy=0; player.onGround=true; }

      // Draw player
      ctx.save();
      ctx.translate(player.x+player.w/2, player.y+player.h/2);
      ctx.rotate(frame*0.05);
      const pg = ctx.createLinearGradient(-player.w/2,-player.h/2,player.w/2,player.h/2);
      pg.addColorStop(0,"#00f5ff"); pg.addColorStop(1,"#0078d4");
      ctx.fillStyle=pg; ctx.fillRect(-player.w/2,-player.h/2,player.w,player.h);
      ctx.strokeStyle="#fff"; ctx.lineWidth=2; ctx.strokeRect(-player.w/2,-player.h/2,player.w,player.h);
      ctx.restore();

      // Obstacles (delta-time based movement)
      for (let i=obstacles.length-1;i>=0;i--) {
        const o=obstacles[i];
        o.x -= state.speed * dt;
        ctx.fillStyle=o.color; ctx.fillRect(o.x,o.y,o.w,o.h);
        ctx.strokeStyle="rgba(255,255,255,0.3)"; ctx.lineWidth=1; ctx.strokeRect(o.x,o.y,o.w,o.h);
        if (o.x+o.w<0) { obstacles.splice(i,1); continue; }
        if (player.x+player.w-8>o.x+4 && player.x+8<o.x+o.w-4 && player.y+player.h-4>o.y+4 && player.y+4<o.y+o.h-4) {
          state.dead=true; state.running=false;
        }
      }

      ctx.fillStyle="#fff"; ctx.font=`bold ${Math.min(canvas.width/30,18)}px Arial`;
      ctx.fillText(`Score: ${state.score}`,16,28);
      ctx.fillStyle="rgba(255,255,255,0.4)"; ctx.font=`${Math.min(canvas.width/40,13)}px Arial`;
      ctx.fillText(`Speed: ${(state.speed/300).toFixed(1)}x`,16,48);
    };

    resetState();
    animId = requestAnimationFrame(gameLoop);

    canvas.addEventListener("click", jump);
    const keyHandler = e => { if (e.code==="Space"||e.code==="ArrowUp") { e.preventDefault(); jump(); } };
    document.addEventListener("keydown", keyHandler);

    const obs = new MutationObserver(() => {
      if (!document.getElementById(id)) { cancelAnimationFrame(animId); document.removeEventListener("keydown",keyHandler); obs.disconnect(); }
    });
    obs.observe(document.getElementById("windows-container"), {childList:true});
  }
});
