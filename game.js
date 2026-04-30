'use strict';
// ── Audio ─────────────────────────────────────────────────────
const sTitle=document.getElementById('sTitle');
const sRain =document.getElementById('sRain');
const sHome =document.getElementById('sHome');
const sBtn  =document.getElementById('sBtn');
const sTrans=document.getElementById('sTrans');
sRain.volume=0.2; sTitle.volume=0.6; sHome.volume=0.6;
// Slow music playback rate by 30%
sTitle.playbackRate=0.7; sHome.playbackRate=0.7;

function sfx(a){try{a.currentTime=0;a.play();}catch(e){}}
// Fix #3: music continues from guide back to menu — only xfade when actually switching tracks
function xfade(from,to){
  if(from===to)return;
  const S=20,I=30;
  if(from&&!from.paused){
    const v=from.volume;
    const id=setInterval(()=>{from.volume=Math.max(0,from.volume-v/S);if(from.volume<=0){clearInterval(id);from.pause();from.volume=v;}},I);
  }
  if(to){to.volume=0;to.play().catch(()=>{});const tv=to===sRain?0.2:0.6;const id=setInterval(()=>{to.volume=Math.min(tv,to.volume+tv/S);if(to.volume>=tv)clearInterval(id);},I);}
}

// ── DOM ───────────────────────────────────────────────────────
const titleScreen=document.getElementById('titleScreen');
const guideScreen=document.getElementById('guideScreen');
const gameCanvas =document.getElementById('gameCanvas');
const pixelCanvas=document.getElementById('pixelCanvas');
const rainCanvas =document.getElementById('rainCanvas');
const guideRain  =document.getElementById('guideRain');
const fadeEl     =document.getElementById('fade');
const hudEl      =document.getElementById('hud');
const escEl      =document.getElementById('esc');
const hintEl     =document.getElementById('hint');
const startBtn   =document.getElementById('startBtn');
const guideBtn   =document.getElementById('guideBtn');
const backBtn    =document.getElementById('backBtn');
const restartBtn =document.getElementById('restartBtn');
const ctx        =gameCanvas.getContext('2d');
const pctx       =pixelCanvas.getContext('2d');
const rctx       =rainCanvas.getContext('2d');
const gctx       =guideRain.getContext('2d');

// ── Save ──────────────────────────────────────────────────────
const DEF={played:false,px:7*32+16,py:9*32,room:'bedroom',basementSeen:false};
let sv={...DEF};
function loadSv(){try{const d=localStorage.getItem('hm');if(d)sv={...DEF,...JSON.parse(d)};}catch(e){sv={...DEF};}startBtn.textContent=sv.played?'RESUME':'START';restartBtn.style.display=sv.played?'block':'none';}
function saveSv(){try{localStorage.setItem('hm',JSON.stringify(sv));}catch(e){}}
loadSv();

// ── Resize ────────────────────────────────────────────────────
function rsz(){
  const W=innerWidth,H=innerHeight;
  rainCanvas.width=W;rainCanvas.height=H;
  guideRain.width=W;guideRain.height=H;
  gameCanvas.width=W;gameCanvas.height=H;
  pixelCanvas.width=W;pixelCanvas.height=H;
}
rsz(); window.addEventListener('resize',()=>{rsz();initRain();});

// ── Rain (no lightning in menu — fix #4) ──────────────────────
const RC=['#0d3a6e','#1a4a7a','#1e5288','#245a96','#2a6aaa','#3070b0','#3a8acc'];
let drops=[];
function initRain(){drops=[];for(let i=0;i<200;i++)drops.push({x:Math.random()*innerWidth,y:Math.random()*innerHeight,s:2.5+Math.random()*4,l:9+Math.random()*20,o:0.18+Math.random()*0.45,c:RC[Math.random()*RC.length|0]});}
initRain();
function tickRain(){
  for(const d of drops){d.y+=d.s;d.x-=d.s*.28;if(d.y>innerHeight+d.l){d.y=-d.l;d.x=Math.random()*innerWidth;}if(d.x<-d.l)d.x=innerWidth+d.l;}
}
function drawRain(rc,w,h){
  rc.clearRect(0,0,w,h);
  // No lightning in menu (fix #4) — just rain
  for(const d of drops){rc.save();rc.globalAlpha=d.o;rc.strokeStyle=d.c;rc.lineWidth=1;rc.beginPath();rc.moveTo(d.x,d.y);rc.lineTo(d.x-d.l*.28,d.y+d.l);rc.stroke();rc.restore();}
}

// ── Input ─────────────────────────────────────────────────────
const K={};let spaceJust=false;
document.addEventListener('keydown',e=>{
  if(!K[e.key]){if(e.key===' ')spaceJust=true;if(e.key==='Escape'&&gstate==='game')esc2menu();}
  K[e.key]=true;if([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))e.preventDefault();
});
document.addEventListener('keyup',e=>{K[e.key]=false;});

// ── Constants ─────────────────────────────────────────────────
const T=32,SPD=1.8;
let gstate='title',trans=false;
let pl={x:sv.px,y:sv.py,dir:'down',fr:0,ft:0,mov:false,spA:0,spawning:false};
let camX=0,camY=0;
function updCam(){camX=pl.x-gameCanvas.width/2;camY=pl.y-gameCanvas.height/2;}

// ── Rooms (fix #7: walls connected, fix #5: spawn in front of door, fix #12: bedroom entry fixed) ──
function walls(W,H,t){for(let x=0;x<W;x++){t[0][x]=1;t[H-1][x]=1;}for(let y=0;y<H;y++){t[y][0]=1;t[y][W-1]=1;}}
function grid(W,H){return Array.from({length:H},()=>new Array(W).fill(0));}

function mkBedroom(){
  const W=15,H=12,t=grid(W,H);walls(W,H,t);
  t[H-1][7]=2;
  // entry: land on the door tile itself (ty=H-1, tx=7 → center of that tile)
  return{id:'bedroom',name:'BEDROOM',W,H,tiles:t,
    doors:[{tx:7,ty:H-1,to:'living_room',ex:7*T+T/2,ey:(H-1)*T+T/2,locked:false}],
    furn:bedroomF()};
}
function mkLiving(){
  const W=20,H=15,t=grid(W,H);walls(W,H,t);
  t[0][10]=2;
  t[7][W-1]=2;
  t[H-1][10]=2;
  t[7][0]=2;
  return{id:'living_room',name:'LIVING ROOM',W,H,tiles:t,
    doors:[
      {tx:10,ty:0,   to:'bedroom',  ex:10*T+T/2, ey:T/2,        locked:false},
      {tx:W-1,ty:7,  to:'kitchen',  ex:(W-1)*T+T/2, ey:7*T+T/2, locked:false},
      {tx:10,ty:H-1, to:null,       ex:0,        ey:0,           locked:true},
      {tx:0, ty:7,   to:'bathroom', ex:T/2,      ey:7*T+T/2,     locked:false}
    ],furn:livingF()};
}
function mkKitchen(){
  const W=12,H=10,t=grid(W,H);walls(W,H,t);t[5][0]=2;
  return{id:'kitchen',name:'KITCHEN',W,H,tiles:t,
    doors:[{tx:0,ty:5,to:'living_room',ex:T/2,ey:5*T+T/2,locked:false}],
    furn:kitchenF()};
}
function mkBath(){
  const W=9,H=9,t=grid(W,H);walls(W,H,t);t[4][W-1]=2;
  return{id:'bathroom',name:'BATHROOM',W,H,tiles:t,
    doors:[{tx:W-1,ty:4,to:'living_room',ex:(W-1)*T+T/2,ey:4*T+T/2,locked:false}],
    furn:bathF()};
}
function mkBasement(){
  const W=14,H=10,t=grid(W,H);walls(W,H,t);
  t[0][7]=2; // north door back up (staircase)
  return{id:'basement',name:'BASEMENT',W,H,tiles:t,
    stairTx:7,stairTy:0,
    doors:[{tx:7,ty:0,to:'living_room',locked:false}],
    furn:basementF()};
}
function basementF(){return[
  {id:'laundry',   tx:1, ty:2, tw:2,th:2, solid:true},
  {id:'blaundry',  tx:3, ty:2, tw:1,th:1, solid:true},
  {id:'ktrash',    tx:1, ty:6, tw:1,th:1, solid:true},
  {id:'floorlamp', tx:11,ty:2, tw:1,th:2, solid:true},
  {id:'bookshelf', tx:9, ty:1, tw:2,th:4, solid:true},
  {id:'dresser',   tx:9, ty:6, tw:2,th:2, solid:true},
  {id:'rug',       tx:4, ty:4, tw:4,th:3, flat:true},
  {id:'trashcan',  tx:12,ty:7, tw:1,th:1, solid:true},
];}
const ROOMS={bedroom:mkBedroom(),living_room:mkLiving(),kitchen:mkKitchen(),bathroom:mkBath(),basement:mkBasement()};
let room=ROOMS[sv.room]||ROOMS.bedroom;

// ── Furniture (fix #1: solid=true adds hitbox, flat=true draws under player, fix #10: rot support) ──
// solid:true = collision box, flat:true = drawn before player always (rugs etc)
// rot: 'n'(default),'e','s','w' for rotation hint used in drawF

function bedroomF(){return[
  {id:'rug',        tx:4, ty:4, tw:5,th:4, flat:true},
  {id:'bed',        tx:1, ty:1, tw:3,th:4, solid:true},
  {id:'blanket',    tx:1, ty:2, tw:3,th:2, flat:true},
  {id:'nightstand', tx:4, ty:1, tw:1,th:1, solid:true},
  {id:'desk',       tx:8, ty:1, tw:3,th:2, solid:true},
  {id:'laptop',     tx:9, ty:2, tw:1,th:1},
  {id:'mug',        tx:10,ty:2, tw:1,th:1},
  {id:'bookshelf',  tx:12,ty:1, tw:2,th:4, solid:true},
  {id:'dresser',    tx:12,ty:6, tw:2,th:3, solid:true},
  {id:'floorlamp',  tx:7, ty:1, tw:1,th:2, solid:true},
  {id:'window',     tx:6, ty:0, tw:2,th:1},
  {id:'curtain_a',  tx:5, ty:0, tw:1,th:1},
  {id:'curtain_b',  tx:8, ty:0, tw:1,th:1},
  {id:'poster',     tx:10,ty:0, tw:1,th:1},
  {id:'clock',      tx:12,ty:0, tw:1,th:1},
  {id:'photo',      tx:11,ty:0, tw:1,th:1},
  {id:'mirror',     tx:5, ty:0, tw:1,th:1},
  {id:'chair',      tx:9, ty:3, tw:1,th:1, solid:true},
  {id:'closet',     tx:0, ty:4, tw:1,th:3, solid:true},
  {id:'trashcan',   tx:11,ty:9, tw:1,th:1, solid:true},
  {id:'plant',      tx:13,ty:9, tw:1,th:1, solid:true},
  {id:'laundry',    tx:2, ty:9, tw:1,th:1, solid:true},
  {id:'shoes',      tx:3, ty:9, tw:1,th:1, flat:true},
  {id:'backpack',   tx:4, ty:9, tw:1,th:1},
];}

function livingF(){return[
  {id:'rug_lr',      tx:3, ty:4, tw:6,th:5, flat:true},
  {id:'doormat',     tx:9, ty:13,tw:2,th:1, flat:true},
  {id:'sofa',        tx:2, ty:5, tw:4,th:2, solid:true},
  {id:'throw',       tx:3, ty:5, tw:1,th:1, flat:true},
  {id:'coffeetable', tx:5, ty:7, tw:2,th:2, solid:true},
  {id:'remote',      tx:5, ty:7, tw:1,th:1},
  // fix #11: tvstand moved away from north door (door at tx:10,ty:0) — placed at tx:13
  {id:'tvstand',     tx:13,ty:1, tw:4,th:2, solid:true},
  {id:'tv',          tx:14,ty:0, tw:2,th:1},
  {id:'armchair',    tx:2, ty:9, tw:2,th:2, solid:true},
  {id:'bookcase',    tx:18,ty:2, tw:1,th:4, solid:true},
  {id:'sidetable',   tx:6, ty:9, tw:1,th:1, solid:true},
  {id:'candle',      tx:7, ty:9, tw:1,th:1},
  {id:'curtain_a',   tx:0, ty:2, tw:1,th:3},
  {id:'curtain_b',   tx:0, ty:8, tw:1,th:3},
  {id:'picture_a',   tx:13,ty:0, tw:1,th:1},
  {id:'picture_b',   tx:15,ty:0, tw:1,th:1},
  {id:'picture_c',   tx:17,ty:0, tw:1,th:1},
  {id:'clock_lr',    tx:11,ty:0, tw:1,th:1},
  {id:'plant_lg',    tx:17,ty:12,tw:1,th:2, solid:true},
  {id:'coatrack',    tx:19,ty:1, tw:1,th:2, solid:true},
  {id:'umbrella',    tx:19,ty:3, tw:1,th:1},
  {id:'floorlamp_lr',tx:1, ty:4, tw:1,th:2, solid:true},
  {id:'shoes_lr',    tx:18,ty:13,tw:1,th:1, flat:true},
  {id:'vase',        tx:9, ty:2, tw:1,th:1},
];}

function kitchenF(){return[
  {id:'krug',      tx:3, ty:8, tw:2,th:1, flat:true},
  // fix #10: upper cabinets above counters (wall-mounted, drawn as wall decor)
  {id:'kcab_top',  tx:1, ty:0, tw:4,th:1},
  {id:'kcab_top2', tx:6, ty:0, tw:3,th:1},
  // counters along north wall
  {id:'counter_n', tx:1, ty:1, tw:8,th:1, solid:true},
  {id:'counter_e', tx:11,ty:1, tw:1,th:4, solid:true},
  {id:'sink',      tx:3, ty:1, tw:1,th:1, solid:true},
  {id:'stove',     tx:6, ty:1, tw:2,th:1, solid:true},
  {id:'fridge',    tx:11,ty:1, tw:1,th:2, solid:true},
  {id:'microwave', tx:5, ty:1, tw:1,th:1},
  {id:'dishrack',  tx:4, ty:1, tw:1,th:1},
  {id:'pot',       tx:7, ty:1, tw:1,th:1},
  {id:'kettle',    tx:8, ty:1, tw:1,th:1},
  {id:'kwindow',   tx:2, ty:0, tw:2,th:1},
  {id:'ktable',    tx:3, ty:5, tw:3,th:2, solid:true},
  // fix #10: chairs rotated to face table
  {id:'kchair_a',  tx:3, ty:7, tw:1,th:1, solid:true, rot:'n'},
  {id:'kchair_b',  tx:5, ty:7, tw:1,th:1, solid:true, rot:'n'},
  {id:'kchair_c',  tx:2, ty:5, tw:1,th:1, solid:true, rot:'e'},
  {id:'kchair_d',  tx:6, ty:5, tw:1,th:1, solid:true, rot:'w'},
  {id:'ktrash',    tx:0, ty:9, tw:1,th:1, solid:true},
  {id:'kplant',    tx:10,ty:8, tw:1,th:1, solid:true},
];}

function bathF(){
  // fix #9: bathroom redesigned — 9x9, nothing in walls
  return[
    {id:'bathmat',   tx:3,ty:5,tw:2,th:1, flat:true},
    {id:'bathtub',   tx:1,ty:1,tw:4,th:3, solid:true},
    {id:'shower',    tx:1,ty:1,tw:2,th:2},
    {id:'toilet',    tx:6,ty:1,tw:2,th:2, solid:true},
    {id:'vanity',    tx:1,ty:6,tw:3,th:1, solid:true},
    {id:'bthmirror', tx:1,ty:4,tw:3,th:2},
    {id:'towelrack', tx:6,ty:5,tw:1,th:1},
    {id:'btowel',    tx:6,ty:4,tw:1,th:1},
    {id:'tproll',    tx:5,ty:3,tw:1,th:1},
    {id:'bcabinet',  tx:6,ty:6,tw:2,th:2, solid:true},
    {id:'bshampoo',  tx:2,ty:1,tw:1,th:1},
    {id:'bsoap',     tx:2,ty:6,tw:1,th:1},
    {id:'bplant',    tx:5,ty:7,tw:1,th:1, solid:true},
    {id:'bscale',    tx:4,ty:7,tw:1,th:1, flat:true},
    {id:'blaundry',  tx:3,ty:7,tw:1,th:1, solid:true},
  ];
}

// ── Furniture collision (fix #1) ──────────────────────────────
function buildFurnHitboxes(rm){
  rm._solidBoxes=rm.furn.filter(fn=>fn.solid).map(fn=>({
    x1:fn.tx*T+2, y1:fn.ty*T+2,
    x2:(fn.tx+fn.tw)*T-2, y2:(fn.ty+fn.th)*T-2
  }));
}
Object.values(ROOMS).forEach(buildFurnHitboxes);

function furnBlocked(nx,ny,rm){
  const m=8;
  const px1=nx-m,px2=nx+m,py1=ny-m*2,py2=ny+m;
  for(const b of rm._solidBoxes){
    if(px2>b.x1&&px1<b.x2&&py2>b.y1&&py1<b.y2)return true;
  }
  return false;
}

// ── Colors ────────────────────────────────────────────────────
const C={
  fA:'#0d2244',fB:'#0c2040',wall:'#1a3a6a',wTop:'#2a5a9a',wSide:'#0d2244',
  dFrame:'#1e4a80',dPanel:'#163a6a',dKnob:'#4a8acc',
  bed:'#1a3a6a',sheet:'#1e4a80',pillow:'#2a6aaa',
  desk:'#1e4a80',dLeg:'#163a6a',
  shelf:'#1a3a6a',bk1:'#2a6aaa',bk2:'#3a7aaa',bk3:'#1e5288',
  dres:'#1a3a6a',hdl:'#4a8acc',
  lamp:'#1a3a6a',lShade:'#3a7aaa',lGlow:'rgba(80,160,255,.12)',
  rugA:'#1e4a80',rugB:'#163a6a',rugBrd:'#2a6aaa',
  wFrm:'#1a3a6a',wGls:'rgba(80,160,255,.22)',
  post:'#163a6a',postL:'#2a6aaa',
  trash:'#1a3a6a',chair:'#1e4a80',cLeg:'#163a6a',
  clos:'#1a3a6a',cDoor:'#1e4a80',
  mir:'#1a3a6a',mirG:'rgba(100,180,255,.28)',
  pot:'#1a3a6a',leaf:'#2a6aaa',
  sofa:'#1a3a6a',sofaC:'#1e4a80',sofaA:'#163a6a',
  tbl:'#1e4a80',tLeg:'#163a6a',
  tv:'#0d2244',tvS:'#050d1a',tvG:'rgba(60,120,255,.18)',
  cnt:'#1e4a80',cntB:'#163a6a',
  sink:'#0d2244',stove:'#0d2244',brn:'#1a3a6a',frdg:'#1a3a6a',
  tub:'#1a3a6a',tubI:'#0d2244',toil:'#1a3a6a',toilS:'#1e4a80',
  van:'#1a3a6a',vanT:'#1e4a80',twl:'#2a6aaa',bmat:'#1e4a80',
  shad:'rgba(0,8,25,.5)',
  pBody:'#3a8acc',pShirt:'#1e5288',pPants:'#163a6a',pSkin:'#4a90d9',pHair:'#0d2244',pShoe:'#0d2244'
};
const fl=Math.floor;
function fr(c,x,y,w,h,col){c.fillStyle=col;c.fillRect(fl(x),fl(y),Math.max(1,fl(w)),Math.max(1,fl(h)));}
function shd(c,x,y,w){c.fillStyle=C.shad;c.fillRect(fl(x+2),fl(y-2),fl(w),4);}
function b3(c,x,y,w,h,d,top,front,side){
  d=d||5;
  c.fillStyle=top;c.beginPath();c.moveTo(fl(x),fl(y));c.lineTo(fl(x+w),fl(y));c.lineTo(fl(x+w+d),fl(y-d));c.lineTo(fl(x+d),fl(y-d));c.closePath();c.fill();
  c.fillStyle=front;c.fillRect(fl(x),fl(y),fl(w),fl(h));
  c.fillStyle=side;c.beginPath();c.moveTo(fl(x+w),fl(y));c.lineTo(fl(x+w+d),fl(y-d));c.lineTo(fl(x+w+d),fl(y-d+h));c.lineTo(fl(x+w),fl(y+h));c.closePath();c.fill();
}

// ── Floor + walls (fix #7: outer border drawn as connected wall) ──
function drawFloor(c,rm,ox,oy){
  // Draw floor tiles first
  for(let ty=0;ty<rm.H;ty++){
    for(let tx=0;tx<rm.W;tx++){
      const tile=rm.tiles[ty][tx],sx=ox+tx*T,sy=oy+ty*T;
      if(tile===1){
        // fix #7: solid wall block — top face + front face connected
        b3(c,sx,sy+T*.5,T,T*.5,7,C.wTop,C.wall,C.wSide);
        // wall top cap
        fr(c,sx,sy,T,T*.5,C.wTop);
      } else {
        fr(c,sx,sy,T,T,(tx+ty)%2===0?C.fA:C.fB);
        c.strokeStyle='rgba(0,15,50,.2)';c.lineWidth=.5;c.strokeRect(fl(sx),fl(sy),T,T);
        if(tile===2){
          const dr=rm.doors.find(d=>d.tx===tx&&d.ty===ty);
          fr(c,sx+2,sy,T-4,T,C.dFrame);
          fr(c,sx+4,sy+2,T-8,T-4,dr&&dr.locked?'#0a1830':C.dPanel);
          fr(c,sx+T-9,sy+T/2-2,3,3,C.dKnob);
          if(dr&&dr.locked){fr(c,sx+T/2-3,sy+T/2-5,6,5,C.dKnob);fr(c,sx+T/2-2,sy+T/2,4,4,'#050d1a');}
        }
      }
    }
  }
}

// ── Furniture renderer (fix #10: rot support, fix #9: better bathroom) ──
function drawF(c,furn,ox,oy){
  const x=ox+furn.tx*T,y=oy+furn.ty*T,w=furn.tw*T,h=furn.th*T;
  const rot=furn.rot||'n'; // n=default, e=east, s=south, w=west
  switch(furn.id){
    case'bed':
      shd(c,x,y+h,w);b3(c,x,y+h*.3,w,h*.7,7,C.bed,C.bed,C.wSide);
      fr(c,x+3,y+3,w-6,h*.55,C.sheet);
      fr(c,x+3,y+3,w*.35,h*.25,C.pillow);fr(c,x+w*.55,y+3,w*.35,h*.25,C.pillow);
      break;
    case'blanket':fr(c,x+2,y+2,w-4,h-4,C.sheet);fr(c,x+4,y+4,w-8,h-8,'#1a4070');break;
    case'desk':
      shd(c,x,y+h,w);b3(c,x,y+h*.45,w,h*.55,6,C.desk,C.desk,C.dLeg);
      fr(c,x+2,y+2,w-4,h*.4,C.desk);fr(c,x+3,y+3,w-6,h*.3,'#1a3a6a');break;
    case'laptop':fr(c,x+2,y+3,w-4,h-6,C.tv);fr(c,x+3,y+4,w-6,h-9,C.tvS);fr(c,x+2,y+h-4,w-4,3,'#1a3a6a');break;
    case'mug':case'bowl':fr(c,x+4,y+4,w-8,h-6,C.dres);fr(c,x+5,y+5,w-10,h-9,'#0d2244');break;
    case'bookshelf':case'bookcase':
      shd(c,x,y+h,w);b3(c,x,y,w,h,5,C.shelf,C.shelf,C.wSide);
      for(let i=0;i<3;i++){const by=y+4+i*(h/3);fr(c,x+2,by,w*.25,h/3-3,C.bk1);fr(c,x+2+w*.28,by,w*.2,h/3-3,C.bk2);fr(c,x+2+w*.52,by,w*.22,h/3-3,C.bk3);fr(c,x+2+w*.76,by,w*.18,h/3-3,C.bk1);}break;
    case'dresser':
      shd(c,x,y+h,w);b3(c,x,y,w,h,5,C.dres,C.dres,C.wSide);
      for(let i=0;i<3;i++){const dy=y+4+i*(h/3);fr(c,x+3,dy,w-6,h/3-4,'#163a6a');fr(c,x+w/2-3,dy+h/6-3,6,4,C.hdl);}break;
    case'nightstand':
      shd(c,x,y+h,w);b3(c,x,y+h*.3,w,h*.7,4,C.dres,C.dres,C.wSide);
      fr(c,x+3,y+h*.35,w-6,h*.3,'#163a6a');fr(c,x+w/2-2,y+h*.5,4,3,C.hdl);break;
    case'floorlamp':case'floorlamp_lr':
      fr(c,x+w/2-2,y+h-6,4,6,C.lamp);fr(c,x+w/2-6,y+h-8,12,4,C.lamp);
      fr(c,x+w/2-1,y+4,2,h-14,C.lamp);fr(c,x+w/2-7,y+2,14,8,C.lShade);
      c.fillStyle=C.lGlow;c.beginPath();c.arc(fl(x+w/2),fl(y+6),18,0,Math.PI*2);c.fill();break;
    case'rug':case'rug_lr':case'krug':case'bathmat':
      fr(c,x+2,y+2,w-4,h-4,C.rugA);fr(c,x+4,y+4,w-8,h-8,C.rugB);
      fr(c,x+2,y+2,w-4,3,C.rugBrd);fr(c,x+2,y+h-5,w-4,3,C.rugBrd);
      fr(c,x+2,y+2,3,h-4,C.rugBrd);fr(c,x+w-5,y+2,3,h-4,C.rugBrd);break;
    case'window':case'kwindow':
      fr(c,x,y,w,h,C.wFrm);fr(c,x+3,y+2,w-6,h-3,C.wGls);fr(c,x+w/2-1,y+2,2,h-3,'#1a3a6a');
      // light rays shining through
      c.save();
      c.globalAlpha=0.07+0.04*Math.sin(Date.now()/1800);
      for(let r=0;r<3;r++){
        const rx=x+4+r*(w/3);
        c.fillStyle='rgba(160,220,255,1)';
        c.beginPath();
        c.moveTo(fl(rx),fl(y+h));
        c.lineTo(fl(rx+4),fl(y+h));
        c.lineTo(fl(rx+28+r*8),fl(y+h+80));
        c.lineTo(fl(rx+18+r*8),fl(y+h+80));
        c.closePath();c.fill();
      }
      c.restore();
      break;
    case'poster':case'photo':case'picture_a':case'picture_b':case'picture_c':
      fr(c,x+1,y+1,w-2,h-2,C.post);fr(c,x+3,y+3,w-6,h-6,C.postL);fr(c,x+5,y+5,w-10,h-10,'#1a3a6a');break;
    case'trashcan':case'ktrash':
      shd(c,x,y+h,w);fr(c,x+3,y+4,w-6,h-5,C.trash);fr(c,x+2,y+3,w-4,4,'#1e4a80');fr(c,x+4,y+6,w-8,h-10,'#0d2244');break;
    // fix #10: chair rotation
    case'chair':case'kchair_a':case'kchair_b':case'kchair_c':case'kchair_d':{
      shd(c,x,y+h,w);
      if(rot==='n'||rot==='s'){
        // facing north/south — backrest on top
        fr(c,x+2,y+2,w-4,h*.35,C.chair); // backrest
        fr(c,x+2,y+h*.4,w-4,h*.4,C.sofaC); // seat
        fr(c,x+2,y+h*.8,4,h*.2,C.cLeg);fr(c,x+w-6,y+h*.8,4,h*.2,C.cLeg);
      } else {
        // facing east/west — backrest on side
        const bx=rot==='e'?x+w-6:x+2;
        fr(c,bx,y+2,6,h-4,C.chair);
        fr(c,x+(rot==='e'?2:8),y+2,w-10,h-4,C.sofaC);
        fr(c,x+2,y+h-6,4,4,C.cLeg);fr(c,x+w-6,y+h-6,4,4,C.cLeg);
      }
      break;}
    case'closet':
      shd(c,x,y+h,w);b3(c,x,y,w,h,5,C.clos,C.clos,C.wSide);
      fr(c,x+2,y+4,w-4,h-8,C.cDoor);fr(c,x+w/2-2,y+h/2-2,4,4,C.hdl);break;
    case'mirror':case'bthmirror':
      fr(c,x+1,y+1,w-2,h-2,C.mir);fr(c,x+3,y+3,w-6,h-6,C.mirG);
      c.strokeStyle='rgba(120,200,255,.4)';c.lineWidth=1;c.strokeRect(fl(x+3),fl(y+3),fl(w-6),fl(h-6));break;
    case'plant':case'plant_lg':case'kplant':case'bplant':
      shd(c,x,y+h,w);fr(c,x+w/2-4,y+h-8,8,8,C.pot);
      fr(c,x+w/2-7,y+h-16,14,10,C.leaf);fr(c,x+w/2-5,y+h-22,10,8,C.leaf);fr(c,x+w/2-3,y+h-28,6,8,'#2a5a9a');break;
    case'laundry':case'blaundry':
      shd(c,x,y+h,w);fr(c,x+2,y+4,w-4,h-5,C.trash);fr(c,x+3,y+5,w-6,h-8,'#0d2244');fr(c,x+2,y+3,w-4,4,'#1e4a80');break;
    case'sofa':
      shd(c,x,y+h,w);b3(c,x,y+h*.5,w,h*.5,6,C.sofa,C.sofa,C.wSide);
      fr(c,x+2,y+h*.15,w-4,h*.38,C.sofaC);fr(c,x+2,y+h*.15,8,h*.38,C.sofaA);fr(c,x+w-10,y+h*.15,8,h*.38,C.sofaA);fr(c,x+2,y+2,w-4,h*.12,C.sofa);break;
    case'throw':fr(c,x+1,y+1,w-2,h-2,'#1a4070');break;
    case'coffeetable':case'ktable':case'sidetable':
      shd(c,x,y+h,w);b3(c,x,y+h*.4,w,h*.6,5,C.tbl,C.tbl,C.tLeg);fr(c,x+3,y+3,w-6,h*.35,'#1a3a6a');break;
    case'tvstand':
      shd(c,x,y+h,w);b3(c,x,y+h*.4,w,h*.6,5,C.dres,C.dres,C.wSide);fr(c,x+3,y+3,w-6,h*.35,'#163a6a');break;
    case'tv':
      fr(c,x+2,y+2,w-4,h-3,C.tv);fr(c,x+4,y+4,w-8,h-8,C.tvS);
      c.fillStyle=C.tvG;c.fillRect(fl(x+4),fl(y+4),fl(w-8),fl(h-8));fr(c,x+w/2-2,y+h-3,4,3,'#1a3a6a');break;
    case'armchair':
      shd(c,x,y+h,w);b3(c,x,y+h*.5,w,h*.5,5,C.sofa,C.sofa,C.wSide);
      fr(c,x+3,y+h*.2,w-6,h*.32,C.sofaC);fr(c,x+2,y+h*.15,6,h*.38,C.sofaA);fr(c,x+w-8,y+h*.15,6,h*.38,C.sofaA);break;
    case'curtain_a':case'curtain_b':
      fr(c,x,y,w,h,'#1e4a80');fr(c,x+2,y,w-4,h,'#163a6a');
      for(let i=0;i<3;i++)fr(c,x+i*(w/3),y,3,h,'#1a3a6a');break;
    case'coatrack':
      fr(c,x+w/2-2,y+4,4,h-6,C.lamp);fr(c,x+w/2-8,y+4,16,4,C.lamp);
      fr(c,x+w/2-6,y+8,3,4,C.lamp);fr(c,x+w/2+3,y+8,3,4,C.lamp);fr(c,x+w/2-5,y+h-4,10,4,C.lamp);break;
    case'umbrella':fr(c,x+w/2-1,y+4,2,h-6,C.lamp);fr(c,x+w/2-5,y+4,10,5,'#1e4a80');break;
    case'remote':case'tproll':case'bsoap':case'bshampoo':fr(c,x+3,y+3,w-6,h-6,C.dres);break;
    case'vase':case'candle':fr(c,x+4,y+3,w-8,h-5,C.pot);fr(c,x+5,y+4,w-10,h-8,'#0d2244');break;
    case'clock':case'clock_lr':
      fr(c,x+2,y+2,w-4,h-4,C.mir);c.strokeStyle=C.hdl;c.lineWidth=1;c.beginPath();c.arc(fl(x+w/2),fl(y+h/2),fl(w/2-4),0,Math.PI*2);c.stroke();break;
    case'doormat':fr(c,x+1,y+1,w-2,h-2,'#163a6a');fr(c,x+3,y+3,w-6,h-6,'#1a3a6a');break;
    case'shoes':case'shoes_lr':case'backpack':fr(c,x+2,y+4,w-4,h-6,'#1a3a6a');fr(c,x+3,y+5,w-6,h-9,'#163a6a');break;
    case'counter_n':case'counter_e':
      shd(c,x,y+h,w);b3(c,x,y+h*.4,w,h*.6,5,C.cnt,C.cnt,C.cntB);fr(c,x+2,y+2,w-4,h*.35,'#1a3a6a');break;
    // fix #10: upper cabinets with gap in middle
    case'kcab_top':case'kcab_top2':{
      fr(c,x,y,w,h,C.cntB);
      fr(c,x+2,y+2,w-4,h-4,'#1a3a6a');
      // cabinet doors with gap
      const gapW=4,doorW=(w-gapW*2)/2-2;
      fr(c,x+2,y+2,doorW,h-4,'#163a6a');
      fr(c,x+w-2-doorW,y+2,doorW,h-4,'#163a6a');
      fr(c,x+2+doorW/2-1,y+h/2-1,2,2,C.hdl);
      fr(c,x+w-2-doorW/2-1,y+h/2-1,2,2,C.hdl);
      break;}
    case'sink':
      shd(c,x,y+h,w);b3(c,x,y+h*.4,w,h*.6,5,C.cnt,C.cnt,C.cntB);
      fr(c,x+4,y+4,w-8,h*.35,C.sink);fr(c,x+5,y+5,w-10,h*.28,'#050d1a');fr(c,x+w/2-1,y+3,2,4,C.hdl);break;
    case'stove':
      shd(c,x,y+h,w);b3(c,x,y+h*.4,w,h*.6,5,C.cnt,C.cnt,C.cntB);
      fr(c,x+3,y+3,w-6,h*.35,C.stove);fr(c,x+5,y+5,6,6,C.brn);fr(c,x+w-11,y+5,6,6,C.brn);break;
    case'microwave':
      fr(c,x+2,y+3,w-4,h-5,C.tv);fr(c,x+4,y+5,w-10,h-9,C.tvS);fr(c,x+w-6,y+4,4,h-7,'#1a3a6a');break;
    case'dishrack':case'kettle':case'pot':
      fr(c,x+3,y+3,w-6,h-5,C.dres);fr(c,x+4,y+4,w-8,h-8,'#1a3a6a');break;
    case'fridge':
      shd(c,x,y+h,w);b3(c,x,y,w,h,5,C.frdg,C.frdg,C.wSide);
      fr(c,x+3,y+4,w-6,h/2-6,'#163a6a');fr(c,x+3,y+h/2+2,w-6,h/2-6,'#163a6a');
      fr(c,x+w-6,y+h/4,3,4,C.hdl);fr(c,x+w-6,y+h*.7,3,4,C.hdl);break;
    // fix #9: improved bathroom fixtures
    case'bathtub':{
      shd(c,x,y+h,w);
      // outer tub body
      b3(c,x,y+h*.25,w,h*.75,6,C.tub,C.tub,C.wSide);
      // inner basin
      fr(c,x+5,y+h*.3,w-10,h*.6,C.tubI);
      // faucet
      fr(c,x+w-10,y+h*.25,6,4,'#2a6aaa');fr(c,x+w-8,y+h*.2,2,6,'#2a6aaa');
      // showerhead area
      fr(c,x+4,y+4,8,6,'#1e4a80');
      break;}
    case'shower':
      // shower curtain rail
      fr(c,x+2,y+2,w-4,3,'#2a5a9a');
      fr(c,x+2,y+5,3,h-7,'#1e4a80');
      break;
    case'toilet':{
      shd(c,x,y+h,w);
      // tank
      b3(c,x+2,y,w-4,h*.35,4,C.toil,C.toil,C.wSide);
      // bowl
      b3(c,x,y+h*.35,w,h*.65,4,C.toil,C.toil,C.wSide);
      fr(c,x+3,y+h*.4,w-6,h*.5,C.toilS);
      fr(c,x+4,y+h*.42,w-8,h*.45,'#0d2244');
      // flush button
      fr(c,x+w/2-2,y+3,4,3,C.hdl);
      break;}
    case'vanity':{
      shd(c,x,y+h,w);
      b3(c,x,y+h*.35,w,h*.65,5,C.van,C.van,C.wSide);
      // sink basin on top
      fr(c,x+4,y+4,w-8,h*.3,C.sink);
      fr(c,x+6,y+6,w-12,h*.22,'#050d1a');
      // faucet
      fr(c,x+w/2-1,y+2,2,5,'#2a6aaa');
      // drawer handle
      fr(c,x+w/2-3,y+h*.7,6,3,C.hdl);
      break;}
    case'towelrack':case'btowel':
      fr(c,x+2,y+3,w-4,4,C.lamp);fr(c,x+3,y+7,w-6,h-10,C.twl);break;
    case'bcabinet':
      shd(c,x,y+h,w);b3(c,x,y,w,h,4,C.clos,C.clos,C.wSide);
      fr(c,x+2,y+4,w-4,h/2-6,'#163a6a');fr(c,x+2,y+h/2+2,w-4,h/2-6,'#163a6a');
      fr(c,x+w/2-2,y+h/4,4,3,C.hdl);fr(c,x+w/2-2,y+h*.75,4,3,C.hdl);break;
    case'bscale':fr(c,x+2,y+4,w-4,h-6,'#1a3a6a');fr(c,x+3,y+5,w-6,h-9,'#0d2244');break;
    default:fr(c,x+2,y+2,w-4,h-4,'#1a3a6a');break;
  }
}

// ── Player sprite (fix #2: left/right anim, fix #8: hair) ─────
function drawPlayer(c,px,py,dir,frame,mov){
  const x=fl(px)-8, y=fl(py)-20;
  // shadow ellipse
  c.fillStyle='rgba(0,8,25,.4)';c.beginPath();c.ellipse(fl(px),fl(py+2),8,3,0,0,Math.PI*2);c.fill();

  const lO=mov?(frame%2===0?-3:3):0;

  if(dir==='left'){
    // back leg (right leg, further away)
    fr(c,x+9,y+14,4,8,C.pPants);
    fr(c,x+9,y+14-lO,4,3,C.pShoe);
    // back arm (right arm, behind body)
    fr(c,x+13,y+8+lO,3,5,C.pSkin);
    // body
    fr(c,x+2,y+6,12,9,C.pShirt);
    // front leg (left leg, closer)
    fr(c,x+3,y+14+lO,4,8,C.pPants);
    fr(c,x+3,y+14+lO,4,3,C.pShoe);
    // front arm (left arm, in front of body)
    fr(c,x-1,y+7-lO,3,5,C.pSkin);
    // head
    fr(c,x+3,y,10,8,C.pSkin);
    fr(c,x+3,y,10,3,C.pHair);
    fr(c,x+2,y+1,3,4,C.pHair);
  } else if(dir==='right'){
    // back leg (left leg)
    fr(c,x+3,y+14,4,8,C.pPants);
    fr(c,x+3,y+14-lO,4,3,C.pShoe);
    // back arm (left arm, behind body)
    fr(c,x,y+8+lO,3,5,C.pSkin);
    // body
    fr(c,x+2,y+6,12,9,C.pShirt);
    // front leg (right leg)
    fr(c,x+9,y+14+lO,4,8,C.pPants);
    fr(c,x+9,y+14+lO,4,3,C.pShoe);
    // front arm (right arm, in front of body)
    fr(c,x+13,y+7-lO,3,5,C.pSkin);
    // head
    fr(c,x+3,y,10,8,C.pSkin);
    fr(c,x+3,y,10,3,C.pHair);
    fr(c,x+11,y+1,3,4,C.pHair);
    fr(c,x+9,y+4,2,2,'#050d1a');
  } else {
    // up/down — standard
    fr(c,x+3,y+14,4,8,C.pPants);fr(c,x+9,y+14,4,8,C.pPants);
    fr(c,x+3,y+14+lO,4,3,C.pShoe);fr(c,x+9,y+14-lO,4,3,C.pShoe);
    fr(c,x+2,y+6,12,9,C.pShirt);
    const aO=mov?(frame%2===0?2:-2):0;
    fr(c,x,y+7+aO,3,6,C.pSkin);fr(c,x+13,y+7-aO,3,6,C.pSkin);
    fr(c,x+3,y,10,8,C.pSkin);
    // fix #8: hair — top + small side tufts
    fr(c,x+3,y,10,3,C.pHair);
    fr(c,x+2,y+1,2,3,C.pHair);
    fr(c,x+12,y+1,2,3,C.pHair);
    if(dir==='down'){fr(c,x+5,y+4,2,2,'#050d1a');fr(c,x+9,y+4,2,2,'#050d1a');}
  }
  // pixel outline
  c.strokeStyle=C.pHair;c.lineWidth=.5;
  c.strokeRect(fl(x+3),fl(y),10,8);c.strokeRect(fl(x+2),fl(y+6),12,9);
}

// ── Object descriptions (gloomy) ─────────────────────────────
const DESCS={
  bed:
    "You sleep on your side now.\nThe other half of the bed\nhas been cold for a long time.\nNot from the cold. Just... cold.",
  desk:
    "There's a condolence card\nburied under the papers.\nYou never finished reading it.",
  laptop:
    "The last thing you searched:\nhow long grief is supposed to last.\nYou closed the tab.",
  mug:
    "Cold coffee. Again.\nYou made it an hour ago\nand forgot it existed.",
  bookshelf:
    "Dad had a shelf like this.\nSame kinds of books.\nYou never told him that.",
  bookcase:
    "Titles you meant to read.\nThey just stand there now.\nLooking at you.",
  dresser:
    "The same shirt three days running.\nMom would have said something.\nShe would have laughed about it.",
  nightstand:
    "A photo used to sit here.\nYou put it in the drawer.\nIt's still there.",
  floorlamp:
    "It flickers sometimes.\nYou keep meaning to fix it.\nYou don't.",
  floorlamp_lr:
    "The light barely reaches the corners.\nThe room feels smaller at night.\nYou leave it on anyway.",
  plant:
    "The soil is bone dry.\nIt's still alive somehow.\nYou're not sure how.",
  plant_lg:
    "Leaves yellowing at the edges.\nYou keep forgetting to water it.\nMaybe on purpose.",
  kplant:
    "A small plant on the counter.\nWilting quietly.\nYou both have that in common.",
  bplant:
    "It leans toward the window.\nLooking for something.\nYou understand that.",
  sofa:
    "The cushions are sunken and cold.\nYou sit in the same spot every time.\nThe indent is yours now.",
  armchair:
    "Your dad's chair.\nYou moved it here after.\nYou don't sit in it.",
  coffeetable:
    "Rings from cups you never cleaned.\nA slow record of days\nthat all looked the same.",
  tv:
    "You never turn it on.\nThe silence is better.",
  tvstand:
    "There's a photo behind the TV.\nYour parents at the coast.\nYou can't see their faces from here.",
  trashcan:
    "You should empty it.\nYou keep thinking about\nother things instead.",
  ktrash:
    "The receipt from the hospital\nis in here somewhere.\nYou didn't throw it away on purpose.",
  laundry:
    "Clean or dirty?\nYou can't remember.\nIt doesn't matter.",
  blaundry:
    "Clothes pile up.\nTime passes.\nYou barely notice either.",
  mirror:
    "You look older.\nOr maybe you just look tired.\nYou look away.",
  bthmirror:
    "You fogged it up on purpose.\nYou don't want to see yourself\nright now.",
  clock:
    "3:47 PM.\nIt was 3:47 PM an hour ago.\nOr maybe it wasn't.",
  clock_lr:
    "The clock was your mother's.\nShe wound it every Sunday.\nYou haven't wound it in weeks.",
  poster:
    "A band your dad liked.\nYou used to make fun of his taste.\nYou'd give anything to argue\nwith him about it now.",
  photo:
    "The four of you at a rest stop.\nSomeone's eyes are closed.\nEveryone is laughing.",
  picture_a:
    "A print from a market somewhere.\nYou don't remember buying it.\nMaybe you didn't.",
  picture_b:
    "It's a photo of you and her.\n I don't want to be reminded.",
  picture_c:
    "Your parents hung this\nthe week they moved in.\nIt's been crooked ever since.",
  backpack:
    "You packed it once.\nThought you'd go somewhere.\nYou unpacked it the same night.",
  shoes:
    "You put them by the door out of habit.\nYou haven't been outside today.",
  shoes_lr:
    "Mud from the cemetery.\nYou haven't cleaned them.\nYou're not sure you want to.",
  umbrella:
    "It was raining the night\nof the accident.\nYou think about that sometimes.",
  coatrack:
    "There's a jacket on the hook\nthat isn't yours.\nYou stopped noticing it\na while ago.",
  vase:
    "Flowers from the funeral.\nDried out now.\nYou couldn't throw them away.",
  candle:
    "Unlit. You keep meaning\nto light it.\nYou don't.",
  remote:
    "The batteries are dying.\nYou noticed weeks ago.\nYou haven't replaced them.",
  doormat:
    "WELCOME.\nNo one comes anymore.\nNot since the service.",
  bathtub:
    "You run the water too hot.\nYou sit in it until it goes cold.\nYou don't notice the difference.",
  toilet:
    "...",
  vanity:
    "The faucet drips.\nYour dad would have fixed it\nthe same day.",
  sink:
    "One plate in the basin.\nYou keep doing the math\nof living alone.",
  stove:
    "Your mom taught you\nthree recipes.\nYou haven't made any of them.",
  fridge:
    "A pie someone brought over.\nWeeks ago.\nYou keep moving it to the front\nand not eating it.",
  microwave:
    "The clock is wrong.\nIt's been wrong since the power went out\nthe night of the accident.",
  kettle:
    "You boil it.\nYou forget it.\nYou boil it again.",
  pot:
    "Unwashed. Sitting there\nlike a quiet accusation.",
  dishrack:
    "One cup. One plate. One bowl.\nThe math of living alone\nis very simple.",
  towelrack:
    "The towel is damp.\nIt's been damp for days.\nYou don't notice anymore.",
  bcabinet:
    "Prescription bottles.\nYours. Not theirs.\nYou close it before you read the labels.",
  bscale:
    "You don't weigh yourself anymore.\nYou stopped caring\naround the same time as everything else.",
  tproll:
    "Almost empty.\nYou'll replace it eventually.\nYou replace things eventually.",
  closet:
    "Their things are in boxes in here.\nYou taped them shut\nbut didn't label them.\nYou know what's inside.",
};

// ── Furniture collision ───────────────────────────────────────
function buildFurnHitboxes(rm){
  rm._solidBoxes=rm.furn.filter(fn=>fn.solid).map(fn=>({
    x1:fn.tx*T+2,y1:fn.ty*T+2,x2:(fn.tx+fn.tw)*T-2,y2:(fn.ty+fn.th)*T-2
  }));
}
Object.values(ROOMS).forEach(buildFurnHitboxes);
function furnBlocked(nx,ny,rm){
  const m=8,px1=nx-m,px2=nx+m,py1=ny-m*2,py2=ny+m;
  for(const b of rm._solidBoxes){if(px2>b.x1&&px1<b.x2&&py2>b.y1&&py1<b.y2)return true;}
  return false;
}

// ── Inventory ─────────────────────────────────────────────────
const sItem=document.getElementById('sItem');
let inventory=[];
function pickupItem(id,label){
  if(inventory.find(i=>i.id===id))return;
  inventory.push({id,label});
  try{sItem.currentTime=0;sItem.play();}catch(e){}
}
function hasItem(id){return!!inventory.find(i=>i.id===id);}

// ── Colors ────────────────────────────────────────────────────
function drawFloor(c,rm,ox,oy){
  for(let ty=0;ty<rm.H;ty++){
    for(let tx=0;tx<rm.W;tx++){
      const tile=rm.tiles[ty][tx],sx=ox+tx*T,sy=oy+ty*T;
      if(tile===1){
        b3(c,sx,sy+T*.5,T,T*.5,7,C.wTop,C.wall,C.wSide);
        fr(c,sx,sy,T,T*.5,C.wTop);
      } else {
        fr(c,sx,sy,T,T,(tx+ty)%2===0?C.fA:C.fB);
        c.strokeStyle='rgba(0,15,50,.2)';c.lineWidth=.5;c.strokeRect(fl(sx),fl(sy),T,T);
        if(tile===2){
          const dr=rm.doors.find(d=>d.tx===tx&&d.ty===ty);
          fr(c,sx+2,sy,T-4,T,C.dFrame);
          fr(c,sx+4,sy+2,T-8,T-4,dr&&dr.locked?'#0a1830':C.dPanel);
          fr(c,sx+T-9,sy+T/2-2,3,3,C.dKnob);
          if(dr&&dr.locked){fr(c,sx+T/2-3,sy+T/2-5,6,5,C.dKnob);fr(c,sx+T/2-2,sy+T/2,4,4,'#050d1a');}
        }
        // secret door tile type 3
        if(tile===3){
          fr(c,sx,sy,T,T,'#0a1a3a');
          fr(c,sx+2,sy+2,T-4,T-4,'#0d2244');
          fr(c,sx+T/2-2,sy+T/2-4,4,8,'#1e4a80');
        }
      }
    }
  }
}

// â”€â”€ Furniture renderer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function drawF(c,furn,ox,oy){
  const x=ox+furn.tx*T,y=oy+furn.ty*T,w=furn.tw*T,h=furn.th*T;
  const rot=furn.rot||'n';
  // knocked-over bookcase
  if(furn.id==='bookcase'&&furn.knocked){
    fr(c,x,y+h-8,w+16,8,C.shelf);
    for(let i=0;i<4;i++)fr(c,x+i*10,y+h-6,8,5,i%2===0?C.bk1:C.bk2);
    return;
  }
  switch(furn.id){
    case'bed':shd(c,x,y+h,w);b3(c,x,y+h*.3,w,h*.7,7,C.bed,C.bed,C.wSide);fr(c,x+3,y+3,w-6,h*.55,C.sheet);fr(c,x+3,y+3,w*.35,h*.25,C.pillow);fr(c,x+w*.55,y+3,w*.35,h*.25,C.pillow);break;
    case'blanket':fr(c,x+2,y+2,w-4,h-4,C.sheet);fr(c,x+4,y+4,w-8,h-8,'#1a4070');break;
    case'desk':shd(c,x,y+h,w);b3(c,x,y+h*.45,w,h*.55,6,C.desk,C.desk,C.dLeg);fr(c,x+2,y+2,w-4,h*.4,C.desk);fr(c,x+3,y+3,w-6,h*.3,'#1a3a6a');break;
    case'laptop':fr(c,x+2,y+3,w-4,h-6,C.tv);fr(c,x+3,y+4,w-6,h-9,C.tvS);fr(c,x+2,y+h-4,w-4,3,'#1a3a6a');break;
    case'mug':case'bowl':fr(c,x+4,y+4,w-8,h-6,C.dres);fr(c,x+5,y+5,w-10,h-9,'#0d2244');break;
    case'bookshelf':case'bookcase':shd(c,x,y+h,w);b3(c,x,y,w,h,5,C.shelf,C.shelf,C.wSide);for(let i=0;i<3;i++){const by=y+4+i*(h/3);fr(c,x+2,by,w*.25,h/3-3,C.bk1);fr(c,x+2+w*.28,by,w*.2,h/3-3,C.bk2);fr(c,x+2+w*.52,by,w*.22,h/3-3,C.bk3);fr(c,x+2+w*.76,by,w*.18,h/3-3,C.bk1);}break;
    case'dresser':shd(c,x,y+h,w);b3(c,x,y,w,h,5,C.dres,C.dres,C.wSide);for(let i=0;i<3;i++){const dy=y+4+i*(h/3);fr(c,x+3,dy,w-6,h/3-4,'#163a6a');fr(c,x+w/2-3,dy+h/6-3,6,4,C.hdl);}break;
    case'nightstand':shd(c,x,y+h,w);b3(c,x,y+h*.3,w,h*.7,4,C.dres,C.dres,C.wSide);fr(c,x+3,y+h*.35,w-6,h*.3,'#163a6a');fr(c,x+w/2-2,y+h*.5,4,3,C.hdl);break;
    case'floorlamp':case'floorlamp_lr':fr(c,x+w/2-2,y+h-6,4,6,C.lamp);fr(c,x+w/2-6,y+h-8,12,4,C.lamp);fr(c,x+w/2-1,y+4,2,h-14,C.lamp);fr(c,x+w/2-7,y+2,14,8,C.lShade);c.fillStyle=C.lGlow;c.beginPath();c.arc(fl(x+w/2),fl(y+6),18,0,Math.PI*2);c.fill();break;
    case'rug':case'rug_lr':case'krug':case'bathmat':fr(c,x+2,y+2,w-4,h-4,C.rugA);fr(c,x+4,y+4,w-8,h-8,C.rugB);fr(c,x+2,y+2,w-4,3,C.rugBrd);fr(c,x+2,y+h-5,w-4,3,C.rugBrd);fr(c,x+2,y+2,3,h-4,C.rugBrd);fr(c,x+w-5,y+2,3,h-4,C.rugBrd);break;
    case'window':case'kwindow':
      fr(c,x,y,w,h,C.wFrm);fr(c,x+3,y+2,w-6,h-3,C.wGls);fr(c,x+w/2-1,y+2,2,h-3,'#1a3a6a');
      c.save();c.globalAlpha=0.07+0.04*Math.sin(Date.now()/1800);
      for(let r=0;r<3;r++){const rx=x+4+r*(w/3);c.fillStyle='rgba(160,220,255,1)';c.beginPath();c.moveTo(fl(rx),fl(y+h));c.lineTo(fl(rx+4),fl(y+h));c.lineTo(fl(rx+28+r*8),fl(y+h+80));c.lineTo(fl(rx+18+r*8),fl(y+h+80));c.closePath();c.fill();}
      c.restore();break;
    case'poster':case'photo':case'picture_a':case'picture_b':case'picture_c':fr(c,x+1,y+1,w-2,h-2,C.post);fr(c,x+3,y+3,w-6,h-6,C.postL);fr(c,x+5,y+5,w-10,h-10,'#1a3a6a');break;
    case'trashcan':case'ktrash':shd(c,x,y+h,w);fr(c,x+3,y+4,w-6,h-5,C.trash);fr(c,x+2,y+3,w-4,4,'#1e4a80');fr(c,x+4,y+6,w-8,h-10,'#0d2244');break;
    case'chair':case'kchair_a':case'kchair_b':case'kchair_c':case'kchair_d':{
      shd(c,x,y+h,w);
      if(rot==='n'||rot==='s'){fr(c,x+2,y+2,w-4,h*.35,C.chair);fr(c,x+2,y+h*.4,w-4,h*.4,C.sofaC);fr(c,x+2,y+h*.8,4,h*.2,C.cLeg);fr(c,x+w-6,y+h*.8,4,h*.2,C.cLeg);}
      else{const bx=rot==='e'?x+w-6:x+2;fr(c,bx,y+2,6,h-4,C.chair);fr(c,x+(rot==='e'?2:8),y+2,w-10,h-4,C.sofaC);fr(c,x+2,y+h-6,4,4,C.cLeg);fr(c,x+w-6,y+h-6,4,4,C.cLeg);}
      break;}
    case'closet':shd(c,x,y+h,w);b3(c,x,y,w,h,5,C.clos,C.clos,C.wSide);fr(c,x+2,y+4,w-4,h-8,C.cDoor);fr(c,x+w/2-2,y+h/2-2,4,4,C.hdl);break;
    case'mirror':case'bthmirror':fr(c,x+1,y+1,w-2,h-2,C.mir);fr(c,x+3,y+3,w-6,h-6,C.mirG);c.strokeStyle='rgba(120,200,255,.4)';c.lineWidth=1;c.strokeRect(fl(x+3),fl(y+3),fl(w-6),fl(h-6));break;
    case'plant':case'plant_lg':case'kplant':case'bplant':shd(c,x,y+h,w);fr(c,x+w/2-4,y+h-8,8,8,C.pot);fr(c,x+w/2-7,y+h-16,14,10,C.leaf);fr(c,x+w/2-5,y+h-22,10,8,C.leaf);fr(c,x+w/2-3,y+h-28,6,8,'#2a5a9a');break;
    case'laundry':case'blaundry':shd(c,x,y+h,w);fr(c,x+2,y+4,w-4,h-5,C.trash);fr(c,x+3,y+5,w-6,h-8,'#0d2244');fr(c,x+2,y+3,w-4,4,'#1e4a80');break;
    case'sofa':shd(c,x,y+h,w);b3(c,x,y+h*.5,w,h*.5,6,C.sofa,C.sofa,C.wSide);fr(c,x+2,y+h*.15,w-4,h*.38,C.sofaC);fr(c,x+2,y+h*.15,8,h*.38,C.sofaA);fr(c,x+w-10,y+h*.15,8,h*.38,C.sofaA);fr(c,x+2,y+2,w-4,h*.12,C.sofa);break;
    case'throw':fr(c,x+1,y+1,w-2,h-2,'#1a4070');break;
    case'coffeetable':case'ktable':case'sidetable':shd(c,x,y+h,w);b3(c,x,y+h*.4,w,h*.6,5,C.tbl,C.tbl,C.tLeg);fr(c,x+3,y+3,w-6,h*.35,'#1a3a6a');break;
    case'tvstand':shd(c,x,y+h,w);b3(c,x,y+h*.4,w,h*.6,5,C.dres,C.dres,C.wSide);fr(c,x+3,y+3,w-6,h*.35,'#163a6a');break;
    case'tv':fr(c,x+2,y+2,w-4,h-3,C.tv);fr(c,x+4,y+4,w-8,h-8,C.tvS);c.fillStyle=C.tvG;c.fillRect(fl(x+4),fl(y+4),fl(w-8),fl(h-8));fr(c,x+w/2-2,y+h-3,4,3,'#1a3a6a');break;
    case'armchair':shd(c,x,y+h,w);b3(c,x,y+h*.5,w,h*.5,5,C.sofa,C.sofa,C.wSide);fr(c,x+3,y+h*.2,w-6,h*.32,C.sofaC);fr(c,x+2,y+h*.15,6,h*.38,C.sofaA);fr(c,x+w-8,y+h*.15,6,h*.38,C.sofaA);break;
    case'curtain_a':case'curtain_b':fr(c,x,y,w,h,'#1e4a80');fr(c,x+2,y,w-4,h,'#163a6a');for(let i=0;i<3;i++)fr(c,x+i*(w/3),y,3,h,'#1a3a6a');break;
    case'coatrack':fr(c,x+w/2-2,y+4,4,h-6,C.lamp);fr(c,x+w/2-8,y+4,16,4,C.lamp);fr(c,x+w/2-6,y+8,3,4,C.lamp);fr(c,x+w/2+3,y+8,3,4,C.lamp);fr(c,x+w/2-5,y+h-4,10,4,C.lamp);break;
    case'umbrella':fr(c,x+w/2-1,y+4,2,h-6,C.lamp);fr(c,x+w/2-5,y+4,10,5,'#1e4a80');break;
    case'remote':case'tproll':case'bsoap':case'bshampoo':fr(c,x+3,y+3,w-6,h-6,C.dres);break;
    case'vase':case'candle':fr(c,x+4,y+3,w-8,h-5,C.pot);fr(c,x+5,y+4,w-10,h-8,'#0d2244');break;
    case'clock':case'clock_lr':fr(c,x+2,y+2,w-4,h-4,C.mir);c.strokeStyle=C.hdl;c.lineWidth=1;c.beginPath();c.arc(fl(x+w/2),fl(y+h/2),fl(w/2-4),0,Math.PI*2);c.stroke();break;
    case'doormat':fr(c,x+1,y+1,w-2,h-2,'#163a6a');fr(c,x+3,y+3,w-6,h-6,'#1a3a6a');break;
    case'shoes':case'shoes_lr':case'backpack':fr(c,x+2,y+4,w-4,h-6,'#1a3a6a');fr(c,x+3,y+5,w-6,h-9,'#163a6a');break;
    case'counter_n':case'counter_e':shd(c,x,y+h,w);b3(c,x,y+h*.4,w,h*.6,5,C.cnt,C.cnt,C.cntB);fr(c,x+2,y+2,w-4,h*.35,'#1a3a6a');break;
    case'kcab_top':case'kcab_top2':{fr(c,x,y,w,h,C.cntB);fr(c,x+2,y+2,w-4,h-4,'#1a3a6a');const gapW=4,doorW=(w-gapW*2)/2-2;fr(c,x+2,y+2,doorW,h-4,'#163a6a');fr(c,x+w-2-doorW,y+2,doorW,h-4,'#163a6a');fr(c,x+2+doorW/2-1,y+h/2-1,2,2,C.hdl);fr(c,x+w-2-doorW/2-1,y+h/2-1,2,2,C.hdl);break;}
    case'sink':shd(c,x,y+h,w);b3(c,x,y+h*.4,w,h*.6,5,C.cnt,C.cnt,C.cntB);fr(c,x+4,y+4,w-8,h*.35,C.sink);fr(c,x+5,y+5,w-10,h*.28,'#050d1a');fr(c,x+w/2-1,y+3,2,4,C.hdl);break;
    case'stove':shd(c,x,y+h,w);b3(c,x,y+h*.4,w,h*.6,5,C.cnt,C.cnt,C.cntB);fr(c,x+3,y+3,w-6,h*.35,C.stove);fr(c,x+5,y+5,6,6,C.brn);fr(c,x+w-11,y+5,6,6,C.brn);break;
    case'microwave':fr(c,x+2,y+3,w-4,h-5,C.tv);fr(c,x+4,y+5,w-10,h-9,C.tvS);fr(c,x+w-6,y+4,4,h-7,'#1a3a6a');break;
    case'dishrack':case'kettle':case'pot':fr(c,x+3,y+3,w-6,h-5,C.dres);fr(c,x+4,y+4,w-8,h-8,'#1a3a6a');break;
    case'fridge':shd(c,x,y+h,w);b3(c,x,y,w,h,5,C.frdg,C.frdg,C.wSide);fr(c,x+3,y+4,w-6,h/2-6,'#163a6a');fr(c,x+3,y+h/2+2,w-6,h/2-6,'#163a6a');fr(c,x+w-6,y+h/4,3,4,C.hdl);fr(c,x+w-6,y+h*.7,3,4,C.hdl);break;
    case'bathtub':shd(c,x,y+h,w);b3(c,x,y+h*.25,w,h*.75,6,C.tub,C.tub,C.wSide);fr(c,x+5,y+h*.3,w-10,h*.6,C.tubI);fr(c,x+w-10,y+h*.25,6,4,'#2a6aaa');fr(c,x+w-8,y+h*.2,2,6,'#2a6aaa');fr(c,x+4,y+4,8,6,'#1e4a80');break;
    case'shower':fr(c,x+2,y+2,w-4,3,'#2a5a9a');fr(c,x+2,y+5,3,h-7,'#1e4a80');break;
    case'toilet':shd(c,x,y+h,w);b3(c,x+2,y,w-4,h*.35,4,C.toil,C.toil,C.wSide);b3(c,x,y+h*.35,w,h*.65,4,C.toil,C.toil,C.wSide);fr(c,x+3,y+h*.4,w-6,h*.5,C.toilS);fr(c,x+4,y+h*.42,w-8,h*.45,'#0d2244');fr(c,x+w/2-2,y+3,4,3,C.hdl);break;
    case'vanity':shd(c,x,y+h,w);b3(c,x,y+h*.35,w,h*.65,5,C.van,C.van,C.wSide);fr(c,x+4,y+4,w-8,h*.3,C.sink);fr(c,x+6,y+6,w-12,h*.22,'#050d1a');fr(c,x+w/2-1,y+2,2,5,'#2a6aaa');fr(c,x+w/2-3,y+h*.7,6,3,C.hdl);break;
    case'towelrack':case'btowel':fr(c,x+2,y+3,w-4,4,C.lamp);fr(c,x+3,y+7,w-6,h-10,C.twl);break;
    case'bcabinet':shd(c,x,y+h,w);b3(c,x,y,w,h,4,C.clos,C.clos,C.wSide);fr(c,x+2,y+4,w-4,h/2-6,'#163a6a');fr(c,x+2,y+h/2+2,w-4,h/2-6,'#163a6a');fr(c,x+w/2-2,y+h/4,4,3,C.hdl);fr(c,x+w/2-2,y+h*.75,4,3,C.hdl);break;
    case'bscale':fr(c,x+2,y+4,w-4,h-6,'#1a3a6a');fr(c,x+3,y+5,w-6,h-9,'#0d2244');break;
    default:fr(c,x+2,y+2,w-4,h-4,'#1a3a6a');break;
  }
}

// â”€â”€ Player sprite â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function drawPlayer(c,px,py,dir,frame,mov,tint){
  const x=fl(px)-8,y=fl(py)-20;
  c.fillStyle='rgba(0,8,25,.4)';c.beginPath();c.ellipse(fl(px),fl(py+2),8,3,0,0,Math.PI*2);c.fill();
  const lO=mov?(frame%2===0?-3:3):0;
  const sc=tint||C.pSkin,sh=tint?'#1a3a6a':C.pShirt,sp=tint?'#0d2244':C.pPants;
  if(dir==='left'){
    fr(c,x+9,y+14,4,8,sp);fr(c,x+9,y+14-lO,4,3,C.pShoe);
    fr(c,x+13,y+8+lO,3,5,sc);
    fr(c,x+2,y+6,12,9,sh);
    fr(c,x+3,y+14+lO,4,8,sp);fr(c,x+3,y+14+lO,4,3,C.pShoe);
    fr(c,x-1,y+7-lO,3,5,sc);
    fr(c,x+3,y,10,8,sc);fr(c,x+3,y,10,3,C.pHair);fr(c,x+2,y+1,3,4,C.pHair);
  } else if(dir==='right'){
    fr(c,x+3,y+14,4,8,sp);fr(c,x+3,y+14-lO,4,3,C.pShoe);
    fr(c,x,y+8+lO,3,5,sc);
    fr(c,x+2,y+6,12,9,sh);
    fr(c,x+9,y+14+lO,4,8,sp);fr(c,x+9,y+14+lO,4,3,C.pShoe);
    fr(c,x+13,y+7-lO,3,5,sc);
    fr(c,x+3,y,10,8,sc);fr(c,x+3,y,10,3,C.pHair);fr(c,x+11,y+1,3,4,C.pHair);
    fr(c,x+9,y+4,2,2,'#050d1a');
  } else {
    fr(c,x+3,y+14,4,8,sp);fr(c,x+9,y+14,4,8,sp);
    fr(c,x+3,y+14+lO,4,3,C.pShoe);fr(c,x+9,y+14-lO,4,3,C.pShoe);
    fr(c,x+2,y+6,12,9,sh);
    const aO=mov?(frame%2===0?2:-2):0;
    fr(c,x,y+7+aO,3,6,sc);fr(c,x+13,y+7-aO,3,6,sc);
    fr(c,x+3,y,10,8,sc);fr(c,x+3,y,10,3,C.pHair);fr(c,x+2,y+1,2,3,C.pHair);fr(c,x+12,y+1,2,3,C.pHair);
    if(dir==='down'){fr(c,x+5,y+4,2,2,'#050d1a');fr(c,x+9,y+4,2,2,'#050d1a');}
  }
  c.strokeStyle=C.pHair;c.lineWidth=.5;c.strokeRect(fl(x+3),fl(y),10,8);c.strokeRect(fl(x+2),fl(y+6),12,9);
}

// â”€â”€ NPC (mom) sprite â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function drawNPC(c,px,py,dir,frame,mov){
  drawPlayer(c,px,py,dir,frame,mov,'#5a9acc');
  // apron
  const x=fl(px)-8,y=fl(py)-20;
  fr(c,x+4,y+7,8,8,'rgba(100,180,255,.4)');
}

// â”€â”€ Door check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function nearDoor(){
  for(const d of room.doors){
    const dx=d.tx*T+T/2,dy=d.ty*T+T/2;
    if(Math.hypot(pl.x-dx,pl.y-dy)<T*1.5)return d;
  }
  return null;
}

// â”€â”€ Nearby furniture â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function nearFurniture(){
  const range=T*1.6;
  for(const fn of room.furn){
    if(fn.flat)continue;
    const cx=(fn.tx+fn.tw/2)*T,cy=(fn.ty+fn.th/2)*T;
    if(Math.hypot(pl.x-cx,pl.y-cy)<range)return fn;
  }
  return null;
}

// â”€â”€ Description popup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let descActive=false,descText='',descTimer=0;
function showDesc(text){descActive=true;descText=text;descTimer=4000;}
function tickDesc(dt){if(!descActive)return;descTimer-=dt;if(descTimer<=0){descActive=false;descText='';}}

// â”€â”€ Hotbar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function drawHotbar(){
  if(!inventory.length)return;
  const slotW=44,slotH=44,pad=6,margin=12;
  const totalW=inventory.length*(slotW+pad)-pad;
  const bx=gameCanvas.width/2-totalW/2;
  const by=gameCanvas.height-slotH-margin;
  pctx.save();
  inventory.forEach((item,i)=>{
    const sx=bx+i*(slotW+pad);
    pctx.fillStyle='rgba(3,10,30,.88)';pctx.fillRect(fl(sx),fl(by),slotW,slotH);
    pctx.strokeStyle='#1e5a9a';pctx.lineWidth=2;pctx.strokeRect(fl(sx),fl(by),slotW,slotH);
    pctx.fillStyle='#4a8acc';pctx.font='6px "Press Start 2P",monospace';pctx.textAlign='center';pctx.textBaseline='middle';
    pctx.fillText(item.label,fl(sx+slotW/2),fl(by+slotH/2));
  });
  pctx.restore();
}

// â”€â”€ Room transition â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function goRoom(door){
  if(trans)return;
  if(door.locked){sfx(sBtn);hintEl.textContent='[ LOCKED ]';hintEl.style.display='block';setTimeout(()=>hintEl.style.display='none',1500);return;}
  trans=true;sfx(sBtn);
  fadeEl.style.opacity=1;fadeEl.style.pointerEvents='all';
  setTimeout(()=>{
    const destRoom=ROOMS[door.to];
    const matchDoor=destRoom.doors.find(d=>d.to===room.id);
    if(matchDoor){pl.x=matchDoor.tx*T+T/2;pl.y=matchDoor.ty*T+T/2;}
    else{pl.x=destRoom.W/2*T;pl.y=destRoom.H/2*T;}
    room=destRoom;
    sv.room=room.id;sv.px=pl.x;sv.py=pl.y;saveSv();updCam();
    setTimeout(()=>{
      fadeEl.style.opacity=0;fadeEl.style.pointerEvents='none';trans=false;
      // trigger basement cutscene on first entry
      if(room.id==='basement'&&!sv.basementSeen){sv.basementSeen=true;saveSv();triggerBasementCutscene();}
    },200);
  },560);
}

// â”€â”€ Use item on furniture â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function useItemOn(furn){
  // plastic knife on bookcase -> knock it over, reveal secret door
  if(furn.id==='bookcase'&&hasItem('knife')&&!furn.knocked){
    furn.knocked=true;
    // reveal secret door tile in living room
    const lr=ROOMS.living_room;
    lr.tiles[6][18]=3; // secret passage behind bookcase
    lr.doors.push({tx:18,ty:6,to:'basement',locked:false});
    // rebuild hitboxes
    buildFurnHitboxes(lr);
    showDesc("The bookcase crashes to the floor.\nBehind it â€” a door.\nYou didn't know this was here.");
    sfx(sBtn);
    return true;
  }
  return false;
}

// â”€â”€ Player update â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function updPlayer(dt){
  if(trans||cutsceneActive)return;
  let dx=0,dy=0;
  if(K['w']||K['W']||K['ArrowUp'])   dy=-1;
  if(K['s']||K['S']||K['ArrowDown']) dy= 1;
  if(K['a']||K['A']||K['ArrowLeft']) dx=-1;
  if(K['d']||K['D']||K['ArrowRight'])dx= 1;
  if(dx&&dy){dx*=.707;dy*=.707;}
  pl.mov=!!(dx||dy);
  if(pl.mov){
    if(dy<0)pl.dir='up';else if(dy>0)pl.dir='down';else if(dx<0)pl.dir='left';else pl.dir='right';
    const nx=pl.x+dx*SPD,ny=pl.y+dy*SPD,m=8;
    const txL=fl((nx-m)/T),txR=fl((nx+m)/T),tyT=fl((ny-m*2)/T),tyB=fl((ny+m)/T);
    function tileBlk(cx,cy){if(cy<0||cy>=room.H||cx<0||cx>=room.W)return true;const t=room.tiles[cy][cx];return t===1;}
    const wallX=tileBlk(txL,fl(pl.y/T))||tileBlk(txR,fl(pl.y/T));
    const wallY=tileBlk(fl(pl.x/T),tyT)||tileBlk(fl(pl.x/T),tyB);
    const fullBlk=tileBlk(txL,tyT)||tileBlk(txR,tyT)||tileBlk(txL,tyB)||tileBlk(txR,tyB);
    const fbFull=furnBlocked(nx,ny,room),fbX=furnBlocked(nx,pl.y,room),fbY=furnBlocked(pl.x,ny,room);
    if(!fullBlk&&!fbFull){pl.x=nx;pl.y=ny;}
    else if(!wallX&&!fbX)pl.x=nx;
    else if(!wallY&&!fbY)pl.y=ny;
    pl.ft+=dt;if(pl.ft>120){pl.ft=0;pl.fr=(pl.fr+1)%4;}
  }
  const door=nearDoor();
  const nf=nearFurniture();
  if(door){hintEl.textContent=door.locked?'[ LOCKED ]':'[ SPACE ] OPEN DOOR';hintEl.style.display='block';}
  else if(nf&&(DESCS[nf.id]||hasItem('knife'))){hintEl.textContent='[ SPACE ] LOOK';hintEl.style.display='block';}
  else hintEl.style.display='none';
  if(spaceJust){
    spaceJust=false;
    if(door)goRoom(door);
    else if(nf){
      if(hasItem('knife')&&useItemOn(nf)){}
      else if(nf.id==='ktrash'&&!hasItem('knife')){
        pickupItem('knife','KNIFE');
        showDesc("A plastic knife.\nStill in the wrapper.\nYou take it.");
      } else if(DESCS[nf.id]){sfx(sBtn);showDesc(DESCS[nf.id]);}
    }
  }
}

// â”€â”€ Cutscene system â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const sCutscene=document.getElementById('sCut');
let cutsceneActive=false;
let cutsceneSteps=[];
let cutsceneIdx=0;
let cutsceneTimer=0;
let cutsceneAuto=false; // auto-advance
let cutsceneOnEnd=null;

// NPC state for cutscene
let npc={x:3*T,y:6*T,dir:'right',fr:0,ft:0,mov:false};
let npc2={x:10*T,y:5*T,dir:'down',fr:0,ft:0,mov:false}; // father

// Simple pathfind: move toward target
function stepToward(entity,tx,ty,dt){
  const dx=tx-entity.x,dy=ty-entity.y;
  const dist=Math.hypot(dx,dy);
  if(dist<4){entity.mov=false;return true;}
  entity.mov=true;
  const spd=SPD*0.8;
  entity.x+=dx/dist*spd;entity.y+=dy/dist*spd;
  if(Math.abs(dx)>Math.abs(dy))entity.dir=dx>0?'right':'left';
  else entity.dir=dy>0?'down':'up';
  entity.ft+=dt;if(entity.ft>120){entity.ft=0;entity.fr=(entity.fr+1)%4;}
  return false;
}

function startCutscene(steps,onEnd){
  cutsceneActive=true;cutsceneSteps=steps;cutsceneIdx=0;cutsceneTimer=0;
  cutsceneOnEnd=onEnd||null;
  try{sCutscene.currentTime=0;sCutscene.play();}catch(e){}
  xfade(sHome,null);
}
function endCutscene(){
  cutsceneActive=false;
  try{sCutscene.pause();sCutscene.currentTime=0;}catch(e){}
  xfade(null,sHome);currentMusic=sHome;
  if(cutsceneOnEnd)cutsceneOnEnd();
}

function tickCutscene(dt){
  if(!cutsceneActive)return;
  const step=cutsceneSteps[cutsceneIdx];
  if(!step){endCutscene();return;}
  cutsceneTimer+=dt;
  // auto-advance after duration
  if(step.duration&&cutsceneTimer>=step.duration){
    cutsceneTimer=0;cutsceneIdx++;
    return;
  }
  // pathfind steps
  if(step.type==='walk'){
    const done=stepToward(step.entity,step.tx*T+T/2,step.ty*T+T/2,dt);
    if(done){cutsceneTimer=0;cutsceneIdx++;}
  }
  // wait for space or auto
  if(step.type==='dialog'&&!step.duration){
    if(spaceJust){spaceJust=false;cutsceneTimer=0;cutsceneIdx++;}
  }
}

// The basement memory cutscene
function triggerBasementCutscene(){
  // set up NPC positions in basement
  npc.x=3*T+T/2;npc.y=5*T+T/2;npc.dir='right';
  npc2.x=8*T+T/2;npc2.y=3*T+T/2;npc2.dir='down';
  const bs=ROOMS.basement;
  startCutscene([
    // mom doing laundry, humming
    {type:'dialog',speaker:'mom',text:"Hmm hmm hmm~\n...",duration:2500},
    {type:'dialog',speaker:'mom',text:"Almost done.\nJust these last few.",duration:2500},
    {type:'dialog',speaker:'mom',text:"You're quiet today.\nCome sit with me.",duration:2800},
    // mom walks toward stairs
    {type:'walk',entity:npc,tx:bs.stairTx,ty:bs.stairTy},
    {type:'dialog',speaker:'mom',text:"Come on.\nYour father's waiting upstairs.",duration:2200},
    // player auto-walks to stairs
    {type:'walk',entity:pl,tx:bs.stairTx,ty:bs.stairTy+1},
    // fade to living room
    {type:'fade',duration:600},
    // now in living room â€” dad is there
    {type:'dialog',speaker:'dad',text:"There you are.\nWe won't be long.",duration:2500},
    {type:'dialog',speaker:'mom',text:"We'll be back before it gets dark.",duration:2500},
    {type:'dialog',speaker:'dad',text:"Lock the door behind us, okay?",duration:2500},
    // mom kisses goodbye
    {type:'dialog',speaker:'mom',text:"...",duration:800},
    {type:'dialog',speaker:'mom',text:"I love you.",duration:2200},
    // both walk to front door
    {type:'walk',entity:npc, tx:10,ty:14},
    {type:'walk',entity:npc2,tx:10,ty:14},
    {type:'dialog',speaker:null,text:"They leave.\nThe door closes.",duration:2800},
    // fade to black, back to basement
    {type:'fade',duration:800},
  ],()=>{
    // return player to basement entrance
    room=ROOMS.basement;
    pl.x=bs.stairTx*T+T/2;pl.y=(bs.stairTy+2)*T;
    pl.dir='down';updCam();
    fadeEl.style.opacity=0;fadeEl.style.pointerEvents='none';
  });
}

// â”€â”€ Pixel filter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function drawPixelFilter(){
  const W=pixelCanvas.width,H=pixelCanvas.height;
  pctx.clearRect(0,0,W,H);
  if(cutsceneActive){
    // VHS static look
    pctx.fillStyle='rgba(0,5,20,.22)';
    for(let y=0;y<H;y+=2)pctx.fillRect(0,y,W,1);
    // noise
    for(let i=0;i<300;i++){
      const nx=Math.random()*W,ny=Math.random()*H;
      pctx.fillStyle=`rgba(100,160,255,${Math.random()*.15})`;
      pctx.fillRect(fl(nx),fl(ny),2,1);
    }
    // horizontal glitch lines
    if(Math.random()<0.08){
      pctx.fillStyle=`rgba(80,140,255,${Math.random()*.12})`;
      pctx.fillRect(0,fl(Math.random()*H),W,2);
    }
    // vignette
    const vg=pctx.createRadialGradient(W/2,H/2,H*.2,W/2,H/2,H*.75);
    vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,20,.7)');
    pctx.fillStyle=vg;pctx.fillRect(0,0,W,H);
  } else {
    pctx.fillStyle='rgba(0,5,20,.18)';
    for(let y=0;y<H;y+=2)pctx.fillRect(0,y,W,1);
    pctx.fillStyle='rgba(0,10,40,.06)';
    for(let x=0;x<W;x+=2)pctx.fillRect(x,0,1,H);
    const vg=pctx.createRadialGradient(W/2,H/2,H*.3,W/2,H/2,H*.8);
    vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,5,20,.45)');
    pctx.fillStyle=vg;pctx.fillRect(0,0,W,H);
  }
  drawHotbar();
}

// â”€â”€ Cutscene overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function drawCutsceneOverlay(){
  if(!cutsceneActive)return;
  const step=cutsceneSteps[cutsceneIdx];
  if(!step||step.type!=='dialog'||!step.text)return;
  const W=pixelCanvas.width,H=pixelCanvas.height;
  pctx.save();
  // portrait bar at bottom
  const barH=110,barY=H-barH;
  pctx.fillStyle='rgba(2,8,25,.92)';pctx.fillRect(0,barY,W,barH);
  pctx.strokeStyle='#1e5a9a';pctx.lineWidth=2;pctx.strokeRect(0,barY,W,barH);
  // portrait box
  const portW=80,portH=90,portX=16,portY=barY+10;
  pctx.fillStyle='#0d2244';pctx.fillRect(portX,portY,portW,portH);
  pctx.strokeStyle='#2a6aaa';pctx.lineWidth=1;pctx.strokeRect(portX,portY,portW,portH);
  // draw portrait face
  if(step.speaker==='mom'){
    fr(pctx,portX+25,portY+15,30,28,'#4a90d9');
    fr(pctx,portX+25,portY+15,30,8,'#0d2244');
    fr(pctx,portX+30,portY+26,6,5,'#050d1a');fr(pctx,portX+42,portY+26,6,5,'#050d1a');
    fr(pctx,portX+20,portY+43,40,35,'#1e5288');
    pctx.fillStyle='#5a9acc';pctx.font='5px "Press Start 2P",monospace';pctx.textAlign='center';
    pctx.fillText('MOM',portX+portW/2,portY+portH-4);
  } else if(step.speaker==='dad'){
    fr(pctx,portX+25,portY+15,30,28,'#3a7acc');
    fr(pctx,portX+25,portY+15,30,8,'#0a1830');
    fr(pctx,portX+30,portY+26,6,5,'#050d1a');fr(pctx,portX+42,portY+26,6,5,'#050d1a');
    fr(pctx,portX+20,portY+43,40,35,'#163a6a');
    pctx.fillStyle='#5a9acc';pctx.font='5px "Press Start 2P",monospace';pctx.textAlign='center';
    pctx.fillText('DAD',portX+portW/2,portY+portH-4);
  }
  // dialog text
  const lines=step.text.split('\n');
  pctx.fillStyle='#a0d4f5';pctx.font='7px "Press Start 2P",monospace';pctx.textAlign='left';pctx.textBaseline='top';
  lines.forEach((l,i)=>pctx.fillText(l,portX+portW+16,barY+16+i*16));
  // advance hint
  if(!step.duration){pctx.fillStyle='#2a6aaa';pctx.font='5px "Press Start 2P",monospace';pctx.textAlign='right';pctx.fillText('[ SPACE ]',W-16,barY+barH-14);}
  pctx.restore();
}

// â”€â”€ Game draw â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function drawGame(){
  ctx.clearRect(0,0,gameCanvas.width,gameCanvas.height);
  ctx.save();ctx.translate(-fl(camX),-fl(camY));
  drawFloor(ctx,room,0,0);
  const flatItems=room.furn.filter(fn=>fn.flat);
  const solidItems=room.furn.filter(fn=>!fn.flat);
  for(const fn of flatItems)drawF(ctx,fn,0,0);
  const list=[...solidItems.map(fn=>({type:'f',fn,sy:(fn.ty+fn.th)*T})),{type:'p',sy:pl.y}];
  // add NPCs during cutscene in basement
  if(cutsceneActive&&room.id==='basement'){
    list.push({type:'npc',sy:npc.y});
  }
  if(cutsceneActive&&room.id==='living_room'){
    list.push({type:'npc',sy:npc.y},{type:'npc2',sy:npc2.y});
  }
  list.sort((a,b)=>a.sy-b.sy);
  for(const d of list){
    if(d.type==='f')drawF(ctx,d.fn,0,0);
    else if(d.type==='p')drawPlayer(ctx,pl.x,pl.y,pl.dir,pl.fr,pl.mov);
    else if(d.type==='npc')drawNPC(ctx,npc.x,npc.y,npc.dir,npc.fr,npc.mov);
    else if(d.type==='npc2')drawPlayer(ctx,npc2.x,npc2.y,npc2.dir,npc2.fr,npc2.mov,'#2a5a9a');
  }
  if(pl.spawning){ctx.restore();ctx.fillStyle=`rgba(0,0,0,${1-pl.spA})`;ctx.fillRect(0,0,gameCanvas.width,gameCanvas.height);return;}
  ctx.restore();
  hudEl.textContent=room.name;
  drawPixelFilter();
  drawCutsceneOverlay();
  // description popup
  if(descActive&&descText){
    const lines=descText.split('\n');
    const PAD=14,LH=16;
    const bw=Math.min(gameCanvas.width-40,380);
    const bh=lines.length*LH+PAD*2;
    const bx=gameCanvas.width/2-bw/2;
    const by=gameCanvas.height-bh-70;
    const alpha=Math.min(1,descTimer/400);
    pctx.save();pctx.globalAlpha=alpha;
    pctx.fillStyle='rgba(3,10,30,.92)';pctx.fillRect(fl(bx),fl(by),bw,bh);
    pctx.strokeStyle='#1e5a9a';pctx.lineWidth=2;pctx.strokeRect(fl(bx),fl(by),bw,bh);
    pctx.fillStyle='#7ac4f0';pctx.font='7px "Press Start 2P",monospace';pctx.textBaseline='top';pctx.textAlign='left';
    lines.forEach((l,i)=>pctx.fillText(l,fl(bx+PAD),fl(by+PAD+i*LH)));
    pctx.restore();
  }
}

// â”€â”€ Loops â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let lastT=0;
function gameLoop(ts){
  if(gstate!=='game')return;
  const dt=Math.min(ts-lastT,50);lastT=ts;
  updPlayer(dt);updCam();tickDesc(dt);tickCutscene(dt);drawGame();
  if(pl.spawning){pl.spA+=dt/2000;if(pl.spA>=1){pl.spA=1;pl.spawning=false;}}
  requestAnimationFrame(gameLoop);
}

let menuRafRunning=false;
function menuLoop(){
  if(!menuRafRunning)return;
  tickRain();
  if(gstate==='title')drawRain(rctx,rainCanvas.width,rainCanvas.height);
  else if(gstate==='guide')drawRain(gctx,guideRain.width,guideRain.height);
  requestAnimationFrame(menuLoop);
}

// â”€â”€ Screen control â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let currentMusic=null;
function showTitle(){
  gstate='title';menuRafRunning=true;
  titleScreen.style.display='flex';guideScreen.style.display='none';
  gameCanvas.style.display='none';pixelCanvas.style.display='none';
  hudEl.style.display='none';escEl.style.display='none';hintEl.style.display='none';
  if(currentMusic!==sTitle){xfade(currentMusic,sTitle);currentMusic=sTitle;}
  menuLoop();
}
function showGuide(){
  gstate='guide';titleScreen.style.display='none';guideScreen.style.display='flex';
  menuRafRunning=true;menuLoop();
}
function startGame(){
  gstate='game';menuRafRunning=false;
  titleScreen.style.display='none';guideScreen.style.display='none';
  gameCanvas.style.display='block';pixelCanvas.style.display='block';
  hudEl.style.display='block';escEl.style.display='block';
  if(currentMusic!==sHome){xfade(currentMusic,sHome);currentMusic=sHome;}
  updCam();
  if(!sv.played){pl.spawning=true;pl.spA=0;sv.played=true;saveSv();startBtn.textContent='RESUME';restartBtn.style.display='block';}
  lastT=performance.now();requestAnimationFrame(gameLoop);
}
function esc2menu(){
  sv.px=pl.x;sv.py=pl.y;sv.room=room.id;saveSv();sfx(sTrans);
  fadeEl.style.opacity=1;fadeEl.style.pointerEvents='all';
  setTimeout(()=>{showTitle();fadeEl.style.opacity=0;fadeEl.style.pointerEvents='none';},400);
}

// â”€â”€ Buttons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
startBtn.addEventListener('click',()=>{
  sfx(sTrans);fadeEl.style.opacity=1;fadeEl.style.pointerEvents='all';
  setTimeout(()=>{startGame();fadeEl.style.opacity=0;fadeEl.style.pointerEvents='none';},500);
});
guideBtn.addEventListener('click',()=>{sfx(sTrans);showGuide();});
backBtn.addEventListener('click',()=>{sfx(sTrans);showTitle();});
restartBtn.addEventListener('click',()=>{
  sfx(sBtn);
  if(!confirm('Start over? Your save will be deleted.'))return;
  localStorage.removeItem('hm');sv={...DEF};
  pl.x=sv.px;pl.y=sv.py;pl.dir='down';pl.fr=0;pl.ft=0;pl.mov=false;pl.spA=0;pl.spawning=false;
  inventory=[];room=ROOMS.bedroom;
  startBtn.textContent='START';restartBtn.style.display='none';
});

// â”€â”€ Audio unlock â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let audioOk=false;
function unlockAudio(){
  if(audioOk)return;audioOk=true;
  sRain.play().catch(()=>{});sTitle.play().catch(()=>{});currentMusic=sTitle;
}
document.addEventListener('click',unlockAudio,{once:true});
document.addEventListener('keydown',unlockAudio,{once:true});

// â”€â”€ Boot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
showTitle();
