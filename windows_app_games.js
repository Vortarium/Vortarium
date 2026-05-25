// ===== GAMES HUB =====
AppLauncher.register("games", {
  title: "Games", icon: "🎮",
  launch() {
    const id = WM.create({ title:"Games", icon:"🎮", width:900, height:620, appId:"games" });
    const content = WM.getContent(id);
    content.style.cssText = "display:flex;flex-direction:column;overflow:hidden;";
    const games = [
      { id:"geodash",      icon:"🟦", name:"Geometry Dash",  desc:"Rhythm-based platformer — tap to jump over spikes", color:"#0078d4", storeId:"geodash" },
      { id:"snake",        icon:"🐍", name:"Snake",           desc:"Eat food, grow longer, don't hit the walls", color:"#27ae60", storeId:"snake" },
      { id:"pong",         icon:"🏓", name:"Pong",            desc:"Classic Pong — play against the AI (W/S keys)", color:"#e74c3c", storeId:"pong" },
      { id:"memory",       icon:"🃏", name:"Memory Match",    desc:"Flip cards and find matching pairs", color:"#9c27b0", storeId:"memory" },
      { id:"tetris",       icon:"🟥", name:"Tetris",          desc:"Stack falling tetrominoes to clear lines", color:"#f39c12", storeId:"tetris" },
      { id:"pacman",       icon:"🟡", name:"Pac-Man",         desc:"Eat all the dots, dodge the ghosts", color:"#f1c40f", storeId:"pacman" },
      { id:"breakout",     icon:"🧱", name:"Breakout",        desc:"Smash bricks with a bouncing ball and paddle", color:"#e67e22", storeId:"breakout" },
      { id:"spaceinvaders",icon:"👾", name:"Space Invaders",  desc:"Defend Earth from the descending alien armada", color:"#2ecc71", storeId:"spaceinvaders" },
      { id:"flappybird",   icon:"🐦", name:"Flappy Bird",     desc:"Tap to flap through an endless pipe gauntlet", color:"#3498db", storeId:"flappybird" },
      { id:"minesweeper",  icon:"💣", name:"Minesweeper",     desc:"Logic puzzle — uncover tiles without hitting mines", color:"#95a5a6", storeId:"minesweeper" },
    ];
    content.innerHTML = `
      <div style="padding:20px 24px 12px;font-size:22px;font-weight:700;">🎮 Games</div>
      <div style="flex:1;overflow-y:auto;padding:0 16px 16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;">
        ${games.map(g=>{
          const inst = typeof StoreManager!=='undefined' ? StoreManager.isInstalled(g.storeId) : true;
          const builtIn = ['geodash','snake','pong','memory','tetris'].includes(g.id);
          const available = builtIn || inst;
          return `<div data-gameid="${g.id}" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:20px;cursor:pointer;transition:all 0.2s;position:relative;" onmouseover="this.style.background='rgba(255,255,255,0.1)';this.style.transform='translateY(-2px)'" onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.transform=''">
            ${!available?'<div style="position:absolute;top:10px;right:10px;font-size:10px;background:rgba(255,255,255,0.1);border-radius:4px;padding:2px 6px;color:var(--text-muted);">Not installed</div>':''}
            <div style="font-size:40px;margin-bottom:10px;">${g.icon}</div>
            <div style="font-size:16px;font-weight:600;margin-bottom:6px;">${g.name}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px;line-height:1.5;">${g.desc}</div>
            <button style="padding:8px 20px;background:${available?g.color:'rgba(255,255,255,0.1)'};border:none;border-radius:20px;color:${available?'#fff':'var(--text-muted)'};cursor:pointer;font-size:13px;font-weight:500;">${available?'▶ Play':'🛒 Get'}</button>
          </div>`;
        }).join("")}
      </div>`;

    content.querySelectorAll("[data-gameid]").forEach(card => {
      card.addEventListener("click", e => {
        if (e.target.tagName === "BUTTON" || e.target.closest("button")) {
          const gid = card.dataset.gameid;
          const builtIn = ['geodash','snake','pong','memory','tetris'].includes(gid);
          const inst = typeof StoreManager!=='undefined' ? StoreManager.isInstalled(gid) : true;
          if (!builtIn && !inst) { AppLauncher.launch('store'); return; }
          if (gid === "geodash")       { AppLauncher.launch("geodash"); return; }
          if (gid === "snake")         launchSnake();
          if (gid === "pong")          launchPong();
          if (gid === "memory")        launchMemory();
          if (gid === "tetris")        launchTetris();
          if (gid === "pacman")        launchPacman();
          if (gid === "breakout")      launchBreakout();
          if (gid === "spaceinvaders") launchSpaceInvaders();
          if (gid === "flappybird")    launchFlappyBird();
          if (gid === "minesweeper")   launchMinesweeper();
        }
      });
    });

    // ── Snake ──────────────────────────────────────────────────────────────
    const launchSnake = () => {
      const wid = WM.create({ title:"Snake", icon:"🐍", width:460, height:500, appId:"snake" });
      const c = WM.getContent(wid);
      c.style.cssText = "display:flex;flex-direction:column;overflow:hidden;background:#0a0a0a;align-items:center;justify-content:center;";
      c.innerHTML = `<canvas id="snake-c-${wid}" style="display:block;"></canvas>`;
      const cv = document.getElementById(`snake-c-${wid}`);
      const SZ=20, COLS=20, ROWS=20;
      cv.width=COLS*SZ; cv.height=ROWS*SZ;
      const ctx = cv.getContext("2d");
      let snake=[{x:10,y:10}], dir={x:1,y:0}, food={x:5,y:5}, score=0, running=true;
      const placeFood = () => { food={x:Math.floor(Math.random()*COLS),y:Math.floor(Math.random()*ROWS)}; };
      const draw = () => {
        ctx.fillStyle="#0a0a0a"; ctx.fillRect(0,0,cv.width,cv.height);
        snake.forEach((s,i)=>{ ctx.fillStyle=i===0?"#4ec9b0":"#1db954"; ctx.fillRect(s.x*SZ,s.y*SZ,SZ-1,SZ-1); });
        ctx.fillStyle="#f44747"; ctx.fillRect(food.x*SZ,food.y*SZ,SZ-1,SZ-1);
        ctx.fillStyle="#fff"; ctx.font="14px Arial"; ctx.fillText("Score: "+score,8,16);
        if (!running) {
          ctx.fillStyle="rgba(0,0,0,0.75)"; ctx.fillRect(0,0,cv.width,cv.height);
          ctx.fillStyle="#fff"; ctx.font="bold 28px Arial"; ctx.textAlign="center";
          ctx.fillText("Game Over",cv.width/2,cv.height/2-20);
          ctx.font="16px Arial"; ctx.fillText("Score: "+score,cv.width/2,cv.height/2+10);
          ctx.fillText("Click to restart",cv.width/2,cv.height/2+40); ctx.textAlign="left";
        }
      };
      const move = () => {
        if (!running) return;
        const head={x:snake[0].x+dir.x,y:snake[0].y+dir.y};
        if (head.x<0||head.x>=COLS||head.y<0||head.y>=ROWS||snake.some(s=>s.x===head.x&&s.y===head.y)) { running=false; draw(); return; }
        snake.unshift(head);
        if (head.x===food.x&&head.y===food.y) { score++; placeFood(); } else snake.pop();
        draw();
      };
      placeFood(); draw();
      // Frame-rate independent: move every 150ms regardless of display refresh rate
      const interval = setInterval(move, 150);
      const kh = e => {
        if(e.key==="ArrowUp"&&dir.y!==1)    dir={x:0,y:-1};
        else if(e.key==="ArrowDown"&&dir.y!==-1) dir={x:0,y:1};
        else if(e.key==="ArrowLeft"&&dir.x!==1)  dir={x:-1,y:0};
        else if(e.key==="ArrowRight"&&dir.x!==-1) dir={x:1,y:0};
      };
      document.addEventListener("keydown",kh);
      cv.addEventListener("click",()=>{ if(!running){ snake=[{x:10,y:10}]; dir={x:1,y:0}; score=0; running=true; placeFood(); } });
      const obs=new MutationObserver(()=>{ if(!document.getElementById(wid)){clearInterval(interval);document.removeEventListener("keydown",kh);obs.disconnect();} });
      obs.observe(document.getElementById("windows-container"),{childList:true});
    };

    // ── Pong ──────────────────────────────────────────────────────────────
    const launchPong = () => {
      const wid = WM.create({ title:"Pong", icon:"🏓", width:600, height:460, appId:"pong" });
      const c = WM.getContent(wid);
      c.style.cssText = "display:flex;overflow:hidden;background:#000;align-items:center;justify-content:center;";
      c.innerHTML = `<canvas id="pong-c-${wid}"></canvas>`;
      const cv = document.getElementById(`pong-c-${wid}`);
      cv.width=560; cv.height=400;
      const ctx = cv.getContext("2d");
      const PH=80, PW=10;
      // Use pixels-per-second for frame-rate independence
      const BALL_SPEED = 220; // px/sec
      const PADDLE_SPEED = 300; // px/sec
      const AI_SPEED = 180; // px/sec
      const st = { ball:{x:280,y:200,vx:BALL_SPEED,vy:BALL_SPEED*0.6}, p1:{y:160,score:0}, p2:{y:160,score:0} };
      const kd={};
      const kh=e=>{kd[e.key]=true;}; const ku=e=>{kd[e.key]=false;};
      document.addEventListener("keydown",kh); document.addEventListener("keyup",ku);
      let lastTime = performance.now();
      const loop = (now) => {
        const dt = Math.min((now - lastTime) / 1000, 0.05); // cap at 50ms
        lastTime = now;
        const b=st.ball;
        b.x+=b.vx*dt; b.y+=b.vy*dt;
        if(b.y<=0||b.y>=cv.height) b.vy*=-1;
        if(b.x<=PW+10&&b.y>=st.p1.y&&b.y<=st.p1.y+PH){ b.vx=Math.abs(b.vx); b.vy+=(Math.random()-0.5)*40; }
        if(b.x>=cv.width-PW-10&&b.y>=st.p2.y&&b.y<=st.p2.y+PH){ b.vx=-Math.abs(b.vx); b.vy+=(Math.random()-0.5)*40; }
        if(b.x<0){ st.p2.score++; b.x=280; b.y=200; b.vx=BALL_SPEED; b.vy=BALL_SPEED*0.6; }
        if(b.x>cv.width){ st.p1.score++; b.x=280; b.y=200; b.vx=-BALL_SPEED; b.vy=BALL_SPEED*0.6; }
        if(kd["w"]&&st.p1.y>0) st.p1.y-=PADDLE_SPEED*dt;
        if(kd["s"]&&st.p1.y<cv.height-PH) st.p1.y+=PADDLE_SPEED*dt;
        const mid=st.p2.y+PH/2;
        if(mid<b.y-5&&st.p2.y<cv.height-PH) st.p2.y+=AI_SPEED*dt;
        else if(mid>b.y+5&&st.p2.y>0) st.p2.y-=AI_SPEED*dt;
        ctx.fillStyle="#000"; ctx.fillRect(0,0,cv.width,cv.height);
        ctx.setLineDash([10,10]); ctx.strokeStyle="rgba(255,255,255,0.2)";
        ctx.beginPath(); ctx.moveTo(cv.width/2,0); ctx.lineTo(cv.width/2,cv.height); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle="#fff";
        ctx.fillRect(0,st.p1.y,PW,PH); ctx.fillRect(cv.width-PW,st.p2.y,PW,PH);
        ctx.beginPath(); ctx.arc(b.x,b.y,8,0,Math.PI*2); ctx.fill();
        ctx.font="bold 24px Arial"; ctx.textAlign="center";
        ctx.fillText(st.p1.score,cv.width/4,30); ctx.fillText(st.p2.score,3*cv.width/4,30);
        ctx.font="11px Arial"; ctx.fillText("W/S to move",cv.width/4,cv.height-8); ctx.fillText("AI",3*cv.width/4,cv.height-8);
        ctx.textAlign="left";
        animId = requestAnimationFrame(loop);
      };
      let animId = requestAnimationFrame(loop);
      const obs=new MutationObserver(()=>{ if(!document.getElementById(wid)){cancelAnimationFrame(animId);document.removeEventListener("keydown",kh);document.removeEventListener("keyup",ku);obs.disconnect();} });
      obs.observe(document.getElementById("windows-container"),{childList:true});
    };

    // ── Memory Match ──────────────────────────────────────────────────────
    const launchMemory = () => {
      const wid = WM.create({ title:"Memory Match", icon:"🃏", width:480, height:520, appId:"memory" });
      const c = WM.getContent(wid);
      c.style.cssText = "display:flex;flex-direction:column;overflow:hidden;padding:14px;gap:10px;box-sizing:border-box;";
      const emojis=["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼"];
      let cards=[...emojis,...emojis].sort(()=>Math.random()-0.5).map((e,i)=>({id:i,emoji:e,flipped:false,matched:false}));
      let flipped=[], moves=0, matches=0, locked=false;
      const render=()=>{
        c.innerHTML=`
          <div style="display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
            <div style="font-size:16px;font-weight:600;">🃏 Memory Match</div>
            <div style="font-size:12px;color:var(--text-muted);">Moves: ${moves} | Matches: ${matches}/8</div>
          </div>
          ${matches===8?`<div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;">
            <div style="font-size:48px;">🎉</div>
            <div style="font-size:18px;font-weight:600;">You won in ${moves} moves!</div>
            <button id="mem-restart-${wid}" style="padding:8px 20px;background:var(--accent);border:none;border-radius:20px;color:#fff;cursor:pointer;font-size:13px;">Play Again</button>
          </div>`:`
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;flex:1;">
            ${cards.map(card=>`
              <div data-cardid="${card.id}" style="border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:28px;transition:all 0.2s;aspect-ratio:1;
                background:${card.matched?"rgba(29,185,84,0.2)":card.flipped?"rgba(255,255,255,0.18)":"rgba(255,255,255,0.07)"};
                border:2px solid ${card.matched?"rgba(29,185,84,0.5)":card.flipped?"rgba(255,255,255,0.3)":"rgba(255,255,255,0.1)"};
                transform:${card.flipped||card.matched?"scale(1)":"scale(0.97)"};
                box-shadow:${card.matched?"0 0 12px rgba(29,185,84,0.3)":"none"};">
                ${card.flipped||card.matched?card.emoji:""}
              </div>`).join("")}
          </div>`}`;
        const rb=document.getElementById(`mem-restart-${wid}`);
        if(rb) rb.addEventListener("click",()=>{cards=[...emojis,...emojis].sort(()=>Math.random()-0.5).map((e,i)=>({id:i,emoji:e,flipped:false,matched:false}));flipped=[];moves=0;matches=0;locked=false;render();});
        c.querySelectorAll("[data-cardid]").forEach(el=>{
          el.addEventListener("click",()=>{
            if(locked) return;
            const card=cards[parseInt(el.dataset.cardid)];
            if(card.matched||card.flipped||flipped.length>=2) return;
            card.flipped=true; flipped.push(card); render();
            if(flipped.length===2){
              moves++;
              if(flipped[0].emoji===flipped[1].emoji){flipped[0].matched=flipped[1].matched=true;matches++;flipped=[];render();}
              else{locked=true;setTimeout(()=>{flipped.forEach(fc=>fc.flipped=false);flipped=[];locked=false;render();},900);}
            }
          });
        });
      };
      render();
    };

    // ── Tetris ────────────────────────────────────────────────────────────
    const launchTetris = () => {
      const wid = WM.create({ title:"Tetris", icon:"🟥", width:340, height:580, appId:"tetris" });
      const c = WM.getContent(wid);
      c.style.cssText = "display:flex;overflow:hidden;background:#0a0a0a;align-items:center;justify-content:center;";
      c.innerHTML = `<canvas id="tet-c-${wid}"></canvas>`;
      const cv = document.getElementById(`tet-c-${wid}`);
      const COLS=10, ROWS=20, SZ=24;
      cv.width=COLS*SZ; cv.height=ROWS*SZ;
      const ctx=cv.getContext("2d");
      const PIECES=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[0,1,1],[1,1,0]],[[1,1,0],[0,1,1]]];
      const COLORS=["#00f5ff","#ffd700","#9c27b0","#f44747","#2196f3","#4caf50","#ff9800"];
      let board, piece, score, running, animId, dropTimer;
      const reset=()=>{board=Array.from({length:ROWS},()=>Array(COLS).fill(0));score=0;running=true;dropTimer=0;newPiece();};
      const newPiece=()=>{const i=Math.floor(Math.random()*PIECES.length);piece={shape:PIECES[i],color:COLORS[i],x:3,y:0};};
      const valid=(s,x,y)=>s.every((row,r)=>row.every((cell,col)=>!cell||((y+r>=0)&&(y+r<ROWS)&&(x+col>=0)&&(x+col<COLS)&&!board[y+r][x+col])));
      const place=()=>{
        piece.shape.forEach((row,r)=>row.forEach((cell,col)=>{if(cell)board[piece.y+r][piece.x+col]=piece.color;}));
        let cleared=0;
        board=board.filter(row=>{if(row.every(c=>c)){cleared++;return false;}return true;});
        while(board.length<ROWS) board.unshift(Array(COLS).fill(0));
        score+=cleared*100; newPiece();
        if(!valid(piece.shape,piece.x,piece.y)) running=false;
      };
      const draw=()=>{
        ctx.fillStyle="#0a0a0a"; ctx.fillRect(0,0,cv.width,cv.height);
        ctx.strokeStyle="rgba(255,255,255,0.04)"; ctx.lineWidth=0.5;
        for(let r=0;r<ROWS;r++){ctx.beginPath();ctx.moveTo(0,r*SZ);ctx.lineTo(cv.width,r*SZ);ctx.stroke();}
        for(let col=0;col<COLS;col++){ctx.beginPath();ctx.moveTo(col*SZ,0);ctx.lineTo(col*SZ,cv.height);ctx.stroke();}
        board.forEach((row,r)=>row.forEach((cell,col)=>{if(cell){ctx.fillStyle=cell;ctx.fillRect(col*SZ+1,r*SZ+1,SZ-2,SZ-2);}}));
        if(piece) piece.shape.forEach((row,r)=>row.forEach((cell,col)=>{if(cell){ctx.fillStyle=piece.color;ctx.fillRect((piece.x+col)*SZ+1,(piece.y+r)*SZ+1,SZ-2,SZ-2);}}));
        ctx.fillStyle="#fff"; ctx.font="bold 13px Arial"; ctx.fillText("Score: "+score,4,14);
        if(!running){
          ctx.fillStyle="rgba(0,0,0,0.82)"; ctx.fillRect(0,0,cv.width,cv.height);
          ctx.fillStyle="#fff"; ctx.font="bold 22px Arial"; ctx.textAlign="center";
          ctx.fillText("Game Over",cv.width/2,cv.height/2-20);
          ctx.font="15px Arial"; ctx.fillText("Score: "+score,cv.width/2,cv.height/2+10);
          ctx.fillStyle="#aef"; ctx.font="13px Arial"; ctx.fillText("Click to restart",cv.width/2,cv.height/2+38);
          ctx.textAlign="left";
        }
      };
      // Delta-time based drop: drop every 500ms regardless of refresh rate
      const DROP_INTERVAL = 500; // ms
      let lastTime2 = performance.now();
      let accumulated = 0;
      const loop=( now )=>{
        const dt = Math.min(now - lastTime2, 50);
        lastTime2 = now;
        if(running){
          accumulated += dt;
          if(accumulated >= DROP_INTERVAL){
            accumulated -= DROP_INTERVAL;
            if(valid(piece.shape,piece.x,piece.y+1))piece.y++;else place();
          }
        }
        draw(); animId=requestAnimationFrame(loop);
      };
      const kh=e=>{
        if(!running){if(e.key===" "||e.key==="Enter")reset();return;}
        if(e.key==="ArrowLeft"&&valid(piece.shape,piece.x-1,piece.y)) piece.x--;
        else if(e.key==="ArrowRight"&&valid(piece.shape,piece.x+1,piece.y)) piece.x++;
        else if(e.key==="ArrowDown"&&valid(piece.shape,piece.x,piece.y+1)) piece.y++;
        else if(e.key==="ArrowUp"){const rot=piece.shape[0].map((_,i)=>piece.shape.map(row=>row[i]).reverse());if(valid(rot,piece.x,piece.y))piece.shape=rot;}
        else if(e.key===" "){while(valid(piece.shape,piece.x,piece.y+1))piece.y++;place();}
      };
      cv.addEventListener("click",()=>{if(!running)reset();});
      document.addEventListener("keydown",kh);
      reset(); animId=requestAnimationFrame(loop);
      const obs=new MutationObserver(()=>{if(!document.getElementById(wid)){cancelAnimationFrame(animId);document.removeEventListener("keydown",kh);obs.disconnect();}});
      obs.observe(document.getElementById("windows-container"),{childList:true});
    };

    // ── Breakout ──────────────────────────────────────────────────────────
    const launchBreakout = () => {
      const wid = WM.create({ title:"Breakout", icon:"🧱", width:500, height:520, appId:"breakout" });
      const c = WM.getContent(wid);
      c.style.cssText = "display:flex;overflow:hidden;background:#000;align-items:center;justify-content:center;";
      c.innerHTML = `<canvas id="brk-c-${wid}"></canvas>`;
      const cv = document.getElementById(`brk-c-${wid}`);
      cv.width=460; cv.height=460;
      const ctx=cv.getContext("2d");
      const BROWS=6,BCOLS=10,BW=40,BH=14,BGAP=2,BPW=70,BPH=10,BBR=8;
      const BCOLORS=["#f44","#f90","#ff0","#4c4","#48f","#a4f"];
      let bricks,ball,paddle,score,lives,running,animId;
      const reset=()=>{
        bricks=[];
        for(let r=0;r<BROWS;r++) for(let col=0;col<BCOLS;col++)
          bricks.push({x:col*(BW+BGAP)+5,y:r*(BH+BGAP)+30,alive:true,color:BCOLORS[r%BCOLORS.length]});
        ball={x:230,y:300,vx:3,vy:-4,r:BBR};
        paddle={x:195,y:430,w:BPW};
        score=0; lives=3; running=true;
      };
      const draw=()=>{
        ctx.fillStyle="#000"; ctx.fillRect(0,0,cv.width,cv.height);
        bricks.forEach(b=>{
          if(!b.alive) return;
          ctx.fillStyle=b.color; ctx.fillRect(b.x,b.y,BW,BH);
          ctx.strokeStyle="rgba(0,0,0,0.3)"; ctx.strokeRect(b.x,b.y,BW,BH);
        });
        ctx.fillStyle="#4af"; ctx.fillRect(paddle.x,paddle.y,paddle.w,BPH);
        ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="#fff"; ctx.font="13px Arial";
        ctx.fillText("Score: "+score,4,16); ctx.fillText("Lives: "+lives,cv.width-70,16);
        if(!running){
          ctx.fillStyle="rgba(0,0,0,0.75)"; ctx.fillRect(0,0,cv.width,cv.height);
          ctx.fillStyle="#fff"; ctx.font="bold 26px Arial"; ctx.textAlign="center";
          ctx.fillText(bricks.every(b=>!b.alive)?"YOU WIN!":"GAME OVER",cv.width/2,cv.height/2-10);
          ctx.font="14px Arial"; ctx.fillText("Score: "+score,cv.width/2,cv.height/2+20);
          ctx.fillText("Click to restart",cv.width/2,cv.height/2+44); ctx.textAlign="left";
        }
      };
      const bkd={};
      const bkh=e=>{bkd[e.key]=true;}; const bku=e=>{bkd[e.key]=false;};
      document.addEventListener("keydown",bkh); document.addEventListener("keyup",bku);
      cv.addEventListener("mousemove",e=>{
        const rect=cv.getBoundingClientRect();
        paddle.x=Math.max(0,Math.min(cv.width-paddle.w,e.clientX-rect.left-paddle.w/2));
      });
      const loop=()=>{
        if(running){
          if(bkd["ArrowLeft"]) paddle.x=Math.max(0,paddle.x-6);
          if(bkd["ArrowRight"]) paddle.x=Math.min(cv.width-paddle.w,paddle.x+6);
          ball.x+=ball.vx; ball.y+=ball.vy;
          if(ball.x-ball.r<0||ball.x+ball.r>cv.width) ball.vx*=-1;
          if(ball.y-ball.r<0) ball.vy*=-1;
          if(ball.y+ball.r>paddle.y&&ball.x>paddle.x&&ball.x<paddle.x+paddle.w&&ball.vy>0){
            ball.vy*=-1; ball.vx+=(ball.x-(paddle.x+paddle.w/2))*0.05;
          }
          if(ball.y>cv.height){ lives--; if(lives<=0)running=false; else{ball.x=230;ball.y=300;ball.vx=3;ball.vy=-4;} }
          bricks.forEach(b=>{
            if(!b.alive) return;
            if(ball.x>b.x&&ball.x<b.x+BW&&ball.y-ball.r<b.y+BH&&ball.y+ball.r>b.y){
              b.alive=false; ball.vy*=-1; score+=10;
            }
          });
          if(bricks.every(b=>!b.alive)) running=false;
        }
        draw(); animId=requestAnimationFrame(loop);
      };
      cv.addEventListener("click",()=>{if(!running)reset();});
      reset(); animId=requestAnimationFrame(loop);
      const bobs=new MutationObserver(()=>{if(!document.getElementById(wid)){cancelAnimationFrame(animId);document.removeEventListener("keydown",bkh);document.removeEventListener("keyup",bku);bobs.disconnect();}});
      bobs.observe(document.getElementById("windows-container"),{childList:true});
    };

    // ── Space Invaders ────────────────────────────────────────────────────
    const launchSpaceInvaders = () => {
      const wid = WM.create({ title:"Space Invaders", icon:"👾", width:520, height:540, appId:"spaceinvaders" });
      const c = WM.getContent(wid);
      c.style.cssText = "display:flex;overflow:hidden;background:#000;align-items:center;justify-content:center;";
      c.innerHTML = `<canvas id="si-c-${wid}"></canvas>`;
      const cv = document.getElementById(`si-c-${wid}`);
      cv.width=480; cv.height=480;
      const ctx=cv.getContext("2d");
      let aliens,player,bullets,bombs,score,lives,running,animId,tick;
      const reset=()=>{
        aliens=[];
        for(let r=0;r<4;r++) for(let col=0;col<10;col++)
          aliens.push({x:col*44+20,y:r*36+40,alive:true,row:r});
        player={x:220,w:30,y:440};
        bullets=[]; bombs=[]; score=0; lives=3; running=true; tick=0;
      };
      const draw=()=>{
        ctx.fillStyle="#000"; ctx.fillRect(0,0,cv.width,cv.height);
        ctx.font="22px Arial"; ctx.textAlign="center";
        aliens.forEach(a=>{
          if(!a.alive) return;
          ctx.fillStyle=a.row<2?"#f44":a.row<3?"#f90":"#4f4";
          ctx.fillText("👾",a.x+16,a.y+22);
        });
        ctx.fillStyle="#4af"; ctx.fillRect(player.x,player.y,player.w,12);
        ctx.fillStyle="#ff0"; bullets.forEach(b=>ctx.fillRect(b.x,b.y,3,10));
        ctx.fillStyle="#f44"; bombs.forEach(b=>ctx.fillRect(b.x,b.y,3,10));
        ctx.fillStyle="#fff"; ctx.font="13px Arial"; ctx.textAlign="left";
        ctx.fillText("Score: "+score,4,16); ctx.fillText("Lives: "+lives,cv.width-70,16);
        if(!running){
          ctx.fillStyle="rgba(0,0,0,0.8)"; ctx.fillRect(0,0,cv.width,cv.height);
          ctx.fillStyle="#fff"; ctx.font="bold 26px Arial"; ctx.textAlign="center";
          ctx.fillText(aliens.every(a=>!a.alive)?"YOU WIN!":"GAME OVER",cv.width/2,cv.height/2-10);
          ctx.font="14px Arial"; ctx.fillText("Score: "+score,cv.width/2,cv.height/2+20);
          ctx.fillText("Click to restart",cv.width/2,cv.height/2+44); ctx.textAlign="left";
        }
      };
      const skd={};
      const skh=e=>{skd[e.key]=true;}; const sku=e=>{skd[e.key]=false;};
      document.addEventListener("keydown",skh); document.addEventListener("keyup",sku);
      let lastShot=0;
      const loop=()=>{
        if(running){
          tick++;
          if(skd["ArrowLeft"]) player.x=Math.max(0,player.x-5);
          if(skd["ArrowRight"]) player.x=Math.min(cv.width-player.w,player.x+5);
          if((skd[" "]||skd["ArrowUp"])&&Date.now()-lastShot>300){
            bullets.push({x:player.x+player.w/2-1,y:player.y}); lastShot=Date.now();
          }
          bullets.forEach(b=>b.y-=8);
          bullets=bullets.filter(b=>b.y>0);
          const sdir=Math.sin(tick/60)>0?1:-1;
          aliens.forEach(a=>{ if(a.alive) a.x+=sdir*1.2; });
          if(tick%60===0){
            const live=aliens.filter(a=>a.alive);
            if(live.length>0){const a=live[Math.floor(Math.random()*live.length)];bombs.push({x:a.x+16,y:a.y+22});}
          }
          bombs.forEach(b=>b.y+=4);
          bombs=bombs.filter(b=>b.y<cv.height);
          bullets.forEach(b=>{
            aliens.forEach(a=>{
              if(a.alive&&b.x>a.x&&b.x<a.x+32&&b.y>a.y&&b.y<a.y+28){a.alive=false;b.y=-999;score+=10*(4-a.row);}
            });
          });
          bombs.forEach(b=>{
            if(b.x>player.x&&b.x<player.x+player.w&&b.y>player.y&&b.y<player.y+12){
              lives--; b.y=-999; if(lives<=0)running=false;
            }
          });
          if(aliens.some(a=>a.alive&&a.y>player.y-20)) running=false;
          if(aliens.every(a=>!a.alive)) running=false;
        }
        draw(); animId=requestAnimationFrame(loop);
      };
      cv.addEventListener("click",()=>{if(!running)reset();});
      reset(); animId=requestAnimationFrame(loop);
      const sobs=new MutationObserver(()=>{if(!document.getElementById(wid)){cancelAnimationFrame(animId);document.removeEventListener("keydown",skh);document.removeEventListener("keyup",sku);sobs.disconnect();}});
      sobs.observe(document.getElementById("windows-container"),{childList:true});
    };

    // ── Flappy Bird ───────────────────────────────────────────────────────
    const launchFlappyBird = () => {
      const wid = WM.create({ title:"Flappy Bird", icon:"🐦", width:400, height:520, appId:"flappybird" });
      const c = WM.getContent(wid);
      c.style.cssText = "display:flex;overflow:hidden;background:#70c5ce;align-items:center;justify-content:center;";
      c.innerHTML = `<canvas id="fb-c-${wid}"></canvas>`;
      const cv = document.getElementById(`fb-c-${wid}`);
      cv.width=360; cv.height=480;
      const ctx=cv.getContext("2d");
      const FBGAP=130,FBPW=52,FBSPEED=2.5;
      let bird,pipes,score,running,started,animId;
      const reset=()=>{
        bird={x:80,y:200,vy:0,r:14};
        pipes=[{x:360,gap:Math.random()*180+80}];
        score=0; running=true; started=false;
      };
      const draw=()=>{
        ctx.fillStyle="#70c5ce"; ctx.fillRect(0,0,cv.width,cv.height);
        ctx.fillStyle="#ded895"; ctx.fillRect(0,cv.height-40,cv.width,40);
        ctx.fillStyle="#5d8a3c"; ctx.fillRect(0,cv.height-44,cv.width,8);
        pipes.forEach(p=>{
          ctx.fillStyle="#5d8a3c";
          ctx.fillRect(p.x,0,FBPW,p.gap-FBGAP/2);
          ctx.fillRect(p.x,p.gap+FBGAP/2,FBPW,cv.height);
          ctx.fillStyle="#4a7a2e";
          ctx.fillRect(p.x-4,p.gap-FBGAP/2-20,FBPW+8,20);
          ctx.fillRect(p.x-4,p.gap+FBGAP/2,FBPW+8,20);
        });
        ctx.fillStyle="#f9ca24";
        ctx.beginPath(); ctx.arc(bird.x,bird.y,bird.r,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="#f0932b";
        ctx.beginPath(); ctx.arc(bird.x+6,bird.y+4,6,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="#fff"; ctx.font="bold 28px Arial"; ctx.textAlign="center";
        ctx.strokeStyle="#000"; ctx.lineWidth=3;
        ctx.strokeText(score,cv.width/2,40); ctx.fillText(score,cv.width/2,40);
        ctx.lineWidth=1; ctx.textAlign="left";
        if(!started&&running){
          ctx.fillStyle="rgba(0,0,0,0.4)"; ctx.fillRect(0,0,cv.width,cv.height);
          ctx.fillStyle="#fff"; ctx.font="bold 22px Arial"; ctx.textAlign="center";
          ctx.fillText("Tap to Start",cv.width/2,cv.height/2); ctx.textAlign="left";
        }
        if(!running){
          ctx.fillStyle="rgba(0,0,0,0.6)"; ctx.fillRect(0,0,cv.width,cv.height);
          ctx.fillStyle="#fff"; ctx.font="bold 26px Arial"; ctx.textAlign="center";
          ctx.fillText("GAME OVER",cv.width/2,cv.height/2-20);
          ctx.font="18px Arial"; ctx.fillText("Score: "+score,cv.width/2,cv.height/2+14);
          ctx.font="14px Arial"; ctx.fillText("Click to restart",cv.width/2,cv.height/2+44);
          ctx.textAlign="left";
        }
      };
      const flap=()=>{ if(!running){reset();return;} started=true; bird.vy=-7; };
      cv.addEventListener("click",flap);
      const fbkh=e=>{if(e.key===" "||e.key==="ArrowUp")flap();};
      document.addEventListener("keydown",fbkh);
      const loop=()=>{
        if(running&&started){
          bird.vy+=0.35; bird.y+=bird.vy;
          pipes.forEach(p=>p.x-=FBSPEED);
          if(pipes[pipes.length-1].x<cv.width-200)
            pipes.push({x:cv.width,gap:Math.random()*180+80});
          pipes=pipes.filter(p=>p.x>-FBPW);
          pipes.forEach(p=>{
            if(bird.x+bird.r>p.x&&bird.x-bird.r<p.x+FBPW){
              if(bird.y-bird.r<p.gap-FBGAP/2||bird.y+bird.r>p.gap+FBGAP/2) running=false;
            }
            if(p.x+FBPW<bird.x&&!p.scored){p.scored=true;score++;}
          });
          if(bird.y+bird.r>cv.height-40||bird.y-bird.r<0) running=false;
        }
        draw(); animId=requestAnimationFrame(loop);
      };
      reset(); animId=requestAnimationFrame(loop);
      const fbobs=new MutationObserver(()=>{if(!document.getElementById(wid)){cancelAnimationFrame(animId);document.removeEventListener("keydown",fbkh);fbobs.disconnect();}});
      fbobs.observe(document.getElementById("windows-container"),{childList:true});
    };

    // ── Minesweeper ───────────────────────────────────────────────────────
    const launchMinesweeper = () => {
      const wid = WM.create({ title:"Minesweeper", icon:"💣", width:420, height:480, appId:"minesweeper" });
      const c = WM.getContent(wid);
      c.style.cssText = "display:flex;flex-direction:column;overflow:hidden;padding:12px;gap:8px;box-sizing:border-box;";
      const MR=12,MC=12,MM=18;
      const numColors=["","#2196f3","#4caf50","#f44","#9c27b0","#f44","#00bcd4","#000","#888"];
      let board,revealed,flagged,gameOver,won,firstClick;
      const init=()=>{
        board=Array.from({length:MR},()=>Array(MC).fill(0));
        revealed=Array.from({length:MR},()=>Array(MC).fill(false));
        flagged=Array.from({length:MR},()=>Array(MC).fill(false));
        gameOver=false; won=false; firstClick=true;
      };
      const placeMines=(sr,sc)=>{
        let placed=0;
        while(placed<MM){
          const r=Math.floor(Math.random()*MR),cc=Math.floor(Math.random()*MC);
          if(board[r][cc]!==-1&&!(Math.abs(r-sr)<=1&&Math.abs(cc-sc)<=1)){board[r][cc]=-1;placed++;}
        }
        for(let r=0;r<MR;r++) for(let cc=0;cc<MC;cc++){
          if(board[r][cc]===-1) continue;
          let n=0;
          for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
            const nr=r+dr,nc=cc+dc;
            if(nr>=0&&nr<MR&&nc>=0&&nc<MC&&board[nr][nc]===-1) n++;
          }
          board[r][cc]=n;
        }
      };
      const reveal=(r,cc)=>{
        if(r<0||r>=MR||cc<0||cc>=MC||revealed[r][cc]||flagged[r][cc]) return;
        revealed[r][cc]=true;
        if(board[r][cc]===0) for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++) reveal(r+dr,cc+dc);
      };
      const checkWin=()=>{
        for(let r=0;r<MR;r++) for(let cc=0;cc<MC;cc++)
          if(board[r][cc]!==-1&&!revealed[r][cc]) return false;
        return true;
      };
      const render=()=>{
        const flagCount=flagged.flat().filter(Boolean).length;
        c.innerHTML=`
          <div style="display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
            <div style="font-size:15px;font-weight:600;">💣 Minesweeper</div>
            <div style="font-size:12px;color:var(--text-muted);">🚩 ${flagCount}/${MM}</div>
            <button id="ms-new-${wid}" style="padding:4px 12px;background:var(--accent);border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:12px;">New Game</button>
          </div>
          ${gameOver||won?`<div style="text-align:center;font-size:14px;font-weight:600;color:${won?"#4ec9b0":"#f44"};">${won?"🎉 You Win!":"💥 Game Over!"}</div>`:""}
          <div style="display:grid;grid-template-columns:repeat(${MC},1fr);gap:2px;flex:1;">
            ${Array.from({length:MR},(_,r)=>Array.from({length:MC},(_,cc)=>{
              const rev=revealed[r][cc],flag=flagged[r][cc],val=board[r][cc];
              const bg=rev?(val===-1?"#f44":"rgba(255,255,255,0.15)"):"rgba(255,255,255,0.07)";
              const border=rev?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.2)";
              const txt=rev?(val===-1?"💣":val>0?val:""):(flag?"🚩":"");
              const color=val>0&&val<=8?numColors[val]:"#fff";
              return `<div data-r="${r}" data-c="${cc}" style="background:${bg};border:1px solid ${border};border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:${val===-1||flag?"14":"13"}px;font-weight:700;color:${color};cursor:pointer;aspect-ratio:1;user-select:none;">${txt}</div>`;
            }).join("")).join("")}
          </div>`;
        document.getElementById(`ms-new-${wid}`).addEventListener("click",()=>{init();render();});
        c.querySelectorAll("[data-r]").forEach(el=>{
          el.addEventListener("click",()=>{
            if(gameOver||won) return;
            const r=parseInt(el.dataset.r),cc=parseInt(el.dataset.c);
            if(flagged[r][cc]) return;
            if(firstClick){firstClick=false;placeMines(r,cc);}
            if(board[r][cc]===-1){
              revealed[r][cc]=true; gameOver=true;
              for(let rr=0;rr<MR;rr++) for(let c2=0;c2<MC;c2++) if(board[rr][c2]===-1) revealed[rr][c2]=true;
            } else reveal(r,cc);
            if(checkWin()) won=true;
            render();
          });
          el.addEventListener("contextmenu",e=>{
            e.preventDefault();
            if(gameOver||won) return;
            const r=parseInt(el.dataset.r),cc=parseInt(el.dataset.c);
            if(!revealed[r][cc]) flagged[r][cc]=!flagged[r][cc];
            render();
          });
        });
      };
      init(); render();
    };

  }  // end launch
});  // end AppLauncher.register
    // ── Pac-Man ───────────────────────────────────────────────────────────
    const launchPacman = () => {
      const wid = WM.create({ title:"Pac-Man", icon:"🟡", width:500, height:560, appId:"pacman" });
      const c = WM.getContent(wid);
      c.style.cssText = "display:flex;overflow:hidden;background:#000;align-items:center;justify-content:center;flex-direction:column;";
      c.innerHTML = `<canvas id="pac-c-${wid}"></canvas>`;
      const cv = document.getElementById(`pac-c-${wid}`);
      const CELL=20, COLS=21, ROWS=21;
      cv.width=COLS*CELL; cv.height=ROWS*CELL;
      const ctx=cv.getContext("2d");
      // Simple maze: 1=wall, 0=dot, 2=empty, 3=power pellet
      const mazeTemplate=[
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
        [1,3,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,3,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,1,1,0,1,0,1,1,1,1,1,1,1,0,1,0,1,1,0,1],
        [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
        [1,1,1,1,0,1,1,1,2,2,1,2,2,1,1,1,0,1,1,1,1],
        [2,2,2,1,0,1,2,2,2,2,2,2,2,2,2,1,0,1,2,2,2],
        [1,1,1,1,0,1,2,1,1,2,2,2,1,1,2,1,0,1,1,1,1],
        [2,2,2,2,0,2,2,1,2,2,2,2,2,1,2,2,0,2,2,2,2],
        [1,1,1,1,0,1,2,1,1,1,1,1,1,1,2,1,0,1,1,1,1],
        [2,2,2,1,0,1,2,2,2,2,2,2,2,2,2,1,0,1,2,2,2],
        [1,1,1,1,0,1,2,1,1,1,1,1,1,1,2,1,0,1,1,1,1],
        [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
        [1,0,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,0,1],
        [1,3,0,1,0,0,0,0,0,0,2,0,0,0,0,0,0,1,0,3,1],
        [1,1,0,1,0,1,0,1,1,1,1,1,1,1,0,1,0,1,0,1,1],
        [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
        [1,0,1,1,1,1,1,1,0,1,1,1,0,1,1,1,1,1,1,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      ];
      let maze, pac, ghosts, score, lives, powered, powTimer, running, animId, dir, nextDir;
      const reset=()=>{
        maze=mazeTemplate.map(r=>[...r]);
        pac={x:10,y:15,px:10*CELL,py:15*CELL,dir:{x:0,y:0}};
        dir={x:0,y:0}; nextDir={x:0,y:0};
        ghosts=[
          {px:9*CELL,py:9*CELL,dir:{x:1,y:0},color:"#f44"},
          {px:10*CELL,py:9*CELL,dir:{x:-1,y:0},color:"#f9f"},
          {px:11*CELL,py:9*CELL,dir:{x:0,y:1},color:"#0ff"},
          {px:10*CELL,py:10*CELL,dir:{x:0,y:-1},color:"#f90"},
        ];
        score=0; lives=3; powered=false; powTimer=0; running=true;
      };
      const canMove=(px,py,dx,dy)=>{
        const nx=px+dx*2, ny=py+dy*2;
        const cx=Math.floor((nx)/CELL), cy=Math.floor((ny)/CELL);
        const cx2=Math.floor((nx+CELL-2)/CELL), cy2=Math.floor((ny+CELL-2)/CELL);
        return maze[cy]&&maze[cy][cx]!==1&&maze[cy2]&&maze[cy2][cx2]!==1;
      };
      const draw=()=>{
        ctx.fillStyle="#000"; ctx.fillRect(0,0,cv.width,cv.height);
        maze.forEach((row,r)=>row.forEach((cell,col)=>{
          if(cell===1){ctx.fillStyle="#00f";ctx.fillRect(col*CELL,r*CELL,CELL,CELL);}
          else if(cell===0){ctx.fillStyle="#ff0";ctx.beginPath();ctx.arc(col*CELL+CELL/2,r*CELL+CELL/2,2,0,Math.PI*2);ctx.fill();}
          else if(cell===3){ctx.fillStyle="#ff0";ctx.beginPath();ctx.arc(col*CELL+CELL/2,r*CELL+CELL/2,5,0,Math.PI*2);ctx.fill();}
        }));
        // Pac-Man
        const angle=pac.dir.x===1?0.2:pac.dir.x===-1?Math.PI+0.2:pac.dir.y===1?Math.PI/2+0.2:pac.dir.y===-1?-Math.PI/2+0.2:0.2;
        ctx.fillStyle="#ff0";
        ctx.beginPath();
        ctx.moveTo(pac.px+CELL/2,pac.py+CELL/2);
        ctx.arc(pac.px+CELL/2,pac.py+CELL/2,CELL/2-1,angle,Math.PI*2-angle);
        ctx.closePath(); ctx.fill();
        // Ghosts
        ghosts.forEach(g=>{
          ctx.fillStyle=powered?"#00f":g.color;
          ctx.beginPath();
          ctx.arc(g.px+CELL/2,g.py+CELL/2,CELL/2-1,Math.PI,0);
          ctx.lineTo(g.px+CELL-1,g.py+CELL);
          for(let i=0;i<3;i++){ctx.lineTo(g.px+CELL-(i+1)*CELL/3,g.py+CELL/2+4);ctx.lineTo(g.px+CELL-(i+0.5)*CELL/3,g.py+CELL);}
          ctx.lineTo(g.px+1,g.py+CELL); ctx.closePath(); ctx.fill();
        });
        ctx.fillStyle="#fff"; ctx.font="13px Arial";
        ctx.fillText("Score: "+score,4,14);
        ctx.fillText("Lives: "+"❤️".repeat(lives),cv.width-90,14);
        if(!running){
          ctx.fillStyle="rgba(0,0,0,0.75)"; ctx.fillRect(0,0,cv.width,cv.height);
          ctx.fillStyle="#ff0"; ctx.font="bold 26px Arial"; ctx.textAlign="center";
          ctx.fillText(lives<=0?"GAME OVER":"YOU WIN!",cv.width/2,cv.height/2-10);
          ctx.font="14px Arial"; ctx.fillStyle="#fff"; ctx.fillText("Score: "+score,cv.width/2,cv.height/2+20);
          ctx.fillText("Click to restart",cv.width/2,cv.height/2+44); ctx.textAlign="left";
        }
      };
      const SPEED=2;
      const loop=()=>{
        if(running){
          // Move pac
          if(canMove(pac.px,pac.py,nextDir.x,nextDir.y)){dir=nextDir;}
          if(canMove(pac.px,pac.py,dir.x,dir.y)){pac.px+=dir.x*SPEED;pac.py+=dir.y*SPEED;}
          pac.dir=dir;
          // Wrap
          if(pac.px<0)pac.px=cv.width-CELL; if(pac.px>=cv.width)pac.px=0;
          // Eat dots
          const cx=Math.round(pac.px/CELL), cy=Math.round(pac.py/CELL);
          if(maze[cy]&&maze[cy][cx]===0){maze[cy][cx]=2;score+=10;}
          if(maze[cy]&&maze[cy][cx]===3){maze[cy][cx]=2;score+=50;powered=true;powTimer=200;}
          if(powered){powTimer--;if(powTimer<=0)powered=false;}
          // Move ghosts
          ghosts.forEach(g=>{
            const dirs=[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
            const valid=dirs.filter(d=>canMove(g.px,g.py,d.x,d.y)&&!(d.x===-g.dir.x&&d.y===-g.dir.y));
            if(valid.length>0) g.dir=valid[Math.floor(Math.random()*valid.length)];
            g.px+=g.dir.x*SPEED; g.py+=g.dir.y*SPEED;
            if(g.px<0)g.px=cv.width-CELL; if(g.px>=cv.width)g.px=0;
            // Collision
            if(Math.abs(g.px-pac.px)<CELL-2&&Math.abs(g.py-pac.py)<CELL-2){
              if(powered){score+=200;g.px=10*CELL;g.py=9*CELL;}
              else{lives--;if(lives<=0)running=false;else{pac.px=10*CELL;pac.py=15*CELL;}}
            }
          });
          // Win check
          if(!maze.some(row=>row.some(c=>c===0||c===3))) running=false;
        }
        draw(); animId=requestAnimationFrame(loop);
      };
      const kh=e=>{
        if(!running){if(e.key===" "||e.key==="Enter")reset();return;}
        if(e.key==="ArrowRight")nextDir={x:1,y:0};
        else if(e.key==="ArrowLeft")nextDir={x:-1,y:0};
        else if(e.key==="ArrowDown")nextDir={x:0,y:1};
        else if(e.key==="ArrowUp")nextDir={x:0,y:-1};
      };
      cv.addEventListener("click",()=>{if(!running)reset();});
      document.addEventListener("keydown",kh);
      reset(); animId=requestAnimationFrame(loop);
      const obs=new MutationObserver(()=>{if(!document.getElementById(wid)){cancelAnimationFrame(animId);document.removeEventListener("keydown",kh);obs.disconnect();}});
      obs.observe(document.getElementById("windows-container"),{childList:true});
    };
