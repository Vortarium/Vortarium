import {initializeApp} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import {getAnalytics} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-analytics.js";
import {getAuth,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,onAuthStateChanged,updateProfile} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import {getFirestore,doc,getDoc,setDoc,updateDoc,deleteDoc,onSnapshot,collection,query,where,orderBy,limit,getDocs,runTransaction} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const firebaseConfig={apiKey:"AIzaSyBHzd0x5Lqx4GIGN81iSJ3f0sVimWCrggg",authDomain:"card-e98ed.firebaseapp.com",projectId:"card-e98ed",storageBucket:"card-e98ed.firebasestorage.app",messagingSenderId:"131782135073",appId:"1:131782135073:web:b0dec39ea434606e268260",measurementId:"G-KHVERB9F9S"};
const app=initializeApp(firebaseConfig);
try{getAnalytics(app)}catch(e){}
const auth=getAuth(app),db=getFirestore(app);

/* ---------- helpers ---------- */
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const el=(t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e};
const fmt=ms=>{ms=Math.max(0,Math.ceil(ms/1000));return Math.floor(ms/60)+':'+String(ms%60).padStart(2,'0')};
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const show=id=>$$('.screen').forEach(s=>s.classList.toggle('on',s.id===id));
const modal=h=>{const m=$('#modal');m.innerHTML=`<div class="mbox">${h}</div>`;m.classList.add('on')};
const closeModal=()=>$('#modal').classList.remove('on');

/* ---------- embers ---------- */
(()=>{const b=$('#embers');for(let i=0;i<22;i++){const e=document.createElement('i');e.style.left=Math.random()*100+'%';e.style.setProperty('--dx',(Math.random()*160-80)+'px');e.style.animationDuration=(7+Math.random()*9)+'s';e.style.animationDelay=(-Math.random()*14)+'s';const z=3+Math.random()*4;e.style.width=e.style.height=z+'px';b.append(e)}})();

/* ---------- audio ---------- */
const SFX={};['take','place','hit','break'].forEach(n=>{SFX[n]=new Audio(`splendid_${n}.mp3`);SFX[n].preload='auto'});
const sfx=n=>{try{const a=SFX[n].cloneNode();a.volume=.8;a.play().catch(()=>{})}catch(e){}};
const music=new Audio('splendid_music.mp3');music.loop=true;music.volume=.4;
const startMusic=()=>music.play().catch(()=>{});
startMusic();
['pointerdown','keydown'].forEach(e=>addEventListener(e,()=>{if(music.paused)startMusic()}));

/* ---------- cards ---------- */
const RAR=[{n:'Ember',c:'#b4bcc8',node:1},{n:'Spark',c:'#f6cf4a',node:2},{n:'Flare',c:'#ff9b54',node:3},{n:'Blaze',c:'#ff5a6e',node:4}];
const TC={'ATTACK':'#ff8fa3','HEAL':'#5fd3a4','MANA HEAL':'#6cb4ff','SPELL':'#b09cff'};
const TL={'ATTACK':'#ffa9b8','HEAL':'#86e6bc','MANA HEAL':'#92c9ff','SPELL':'#c7b8ff'};
const ICONS={
 strike:['M10 10L32 32','M28 38L38 28','M34 34l5 5','M38 10L16 32','M10 28l10 10','M14 34l-5 5'],
 pierce:['M24 5L29 25 24 30 19 25z','M15 30h18','M24 30v10','M21 43h6','M24 9v14'],
 crush:['M11 9h26v11H11z','M24 20v22','M22 42h4','M16 14h5M27 14h5','M22 28h4M22 34h4'],
 leech:['M24 5C34 18 37 26 24 41 11 26 14 18 24 5z','M18 27c1 4 4 7 7 7','M20 19l2 7M28 19l-2 7'],
 mend:['M24 41C7 29 9 11 24 20 39 11 41 29 24 41z','M24 22v12M18 28h12'],
 renewal:['M10 37C8 18 22 7 39 9 41 27 29 40 10 37z','M10 37L33 15','M19 29l-1-8M26 23l-1-8M25 31l7-1'],
 resolve:['M24 5C26 14 37 18 35 30c-1 8-6 12-11 12S14 38 13 30c-1-5 2-9 5-12 0 4 2 6 4 6 0-6-2-11 2-19z','M24 40c-4 0-6-3-5-6 1-3 4-5 5-9 3 3 6 6 5 10-1 3-2 5-5 5z'],
 crimson:['M24 5l15 5v12c0 9-6 15-15 20-9-5-15-11-15-20V10z','M24 33C16 28 15 22 20 21c2 0 4 1 4 3 0-2 2-3 4-3 5 1 4 7-4 12z'],
 focus:['M24 8a16 16 0 1 0 .01 0','M24 16a8 8 0 1 0 .01 0','M24 22a2 2 0 1 0 .01 0','M24 1v5M24 42v5M1 24h5M42 24h5'],
 reserve:['M24 4L39 18 24 44 9 18z','M9 18h30','M24 4l-6 14 6 26 6-26z'],
 exchange:['M8 14h32','M24 7v31','M15 40h18','M8 14L3 27h10z','M40 14l-5 13h10z','M3 27a5 4 0 0 0 10 0M35 27a5 4 0 0 0 10 0'],
 offering:['M18 22h12v19H18z','M24 6c4 5 5 8 3 11-1 2-5 2-6 0-2-3-1-6 3-11z','M24 17v5','M12 41h24','M18 29c-3 2-3 5 0 6'],
 golden:['M24 42C7 29 9 13 24 21 39 13 41 29 24 42z','M24 3l2.5 5 5 2.5-5 2.5L24 18l-2.5-5-5-2.5 5-2.5z','M16 24c-2 3-1 6 2 9'],
 shield:['M24 5l15 5v12c0 9-6 15-15 20-9-5-15-11-15-20V10z','M24 11v28','M13 19h22'],
 vamp:['M24 20C20 12 12 10 5 13c3 3 3 8 1 11 3-2 6-1 8 2 2-3 6-3 8 0l2 5 2-5c2-3 6-3 8 0 2-3 5-4 8-2-2-3-2-8 1-11-7-3-15-1-19 7z','M21 18l-1-6M27 18l1-6','M22 28v3M26 28v3'],
 mbreak:['M24 3l5 12 13-4-8 10 10 8-13 0 1 13-8-9-8 9 1-13-13 0 10-8-8-10 13 4z','M24 20a4 4 0 1 0 .01 0']};
const FAM=[
['Strike','ATTACK','strike',{cost:[1,2,3,4],dmg:[1,2,3,4]}],
['Pierce','ATTACK','pierce',{cost:[1,2,3,4],dmg:[2,4,6,8]}],
['Crush','ATTACK','crush',{cost:[2,3,4,5],dmg:[3,5,7,9]}],
['Leech','ATTACK','leech',{cost:[1,2,3,5],dmg:[2,3,5,8],heal:[1,1,2,3]}],
['Mend','HEAL','mend',{cost:[1,2,3,4],heal:[1,3,5,7]}],
['Renewal','HEAL','renewal',{cost:[1,2,3,4],heal:[1,2,3,4],rn:[[1,1],[2,1],[1,2],[2,2]]}],
['Resolve','HEAL','resolve',{cost:[1,2,3,4],th:[5,8,11,15],big:[4,5,6,7],small:[1,2,2,3]}],
['Crimson','HEAL','crimson',{cost:[2,3,4,5],heal:[3,4,5,6],red:[1,2,3,4]}],
['Focus','MANA HEAL','focus',{cost:0,mana:[1,2,3,4]}],
['Reserve','MANA HEAL','reserve',{cost:0,mana:[1,1,2,2],nm:[1,2,2,3]}],
['Exchange','MANA HEAL','exchange',{cost:0,hpl:[1,3,6,9],mana:[2,3,4,5]}],
['Offering','MANA HEAL','offering',{cost:0,hpl:[1,2,4,6],mana:[1,2,3,4]}],
['Golden Heart','SPELL','golden',{cost:[2,3,4,5],gold:[1,2,3,4]}],
['Shield','SPELL','shield',{cost:[1,2,3,5],shield:1,heal:[0,1,0,1],back:[0,0,2,4]}],
['Vampirism','SPELL','vamp',{cost:[2,3,4,5],vamp:[2,4,6,8]}],
['Mana Break','SPELL','mbreak',{cost:1,mb:[1,2,3,4]}]];
const CARDS=[];
FAM.forEach(([name,type,ic,p])=>{for(let r=0;r<4;r++){const c={id:CARDS.length+1,name,type,ic,r};for(const k in p)c[k]=Array.isArray(p[k])?p[k][r]:p[k];CARDS.push(c)}});
const nodes=d=>d.reduce((a,id)=>a+RAR[CARDS[id-1].r].node,0);
const cardEl=(c,x='')=>{const e=el('div','card '+x);e.style.setProperty('--rc',RAR[c.r].c);e.style.setProperty('--tc',TC[c.type]);e.style.setProperty('--tl',TL[c.type]);
 const P=ICONS[c.ic].map(d=>`<path d="${d}"/>`).join('');
 e.innerHTML=`<svg viewBox="0 0 48 48"><circle class="rg" cx="24" cy="24" r="23"/><circle class="rg2" cx="24" cy="24" r="20"/><g class="sh" transform="translate(1.2 1.7)">${P}</g><g class="hl" transform="translate(-.6 -.7)">${P}</g><g class="et">${P}</g></svg><span>${c.name}</span>`;return e};
const backEl=()=>el('div','card back','<i></i>');
const gem=t=>`<i class="gem ${t}"></i>`;
function desc(c){const s=[];
 if(c.dmg)s.push(`deal ${c.dmg} damage`);
 if(c.shield)s.push('block the next attack'+(c.heal?` and restore ${c.heal} HP`:'')+(c.back?` and deal ${c.back} damage back`:''));
 else if(c.th)s.push(`restore ${c.big} HP if you have ${c.th} HP or less, otherwise ${c.small} HP`);
 else if(c.rn)s.push(`restore ${c.heal} HP now and ${c.rn[0]} HP at the start of ${c.rn[1]>1?'each of your next '+c.rn[1]+' turns':'your next turn'}`);
 else if(c.heal)s.push(c.dmg?`heal ${c.heal} HP`:`restore ${c.heal} HP`);
 if(c.red)s.push(`reduce the next incoming attack by ${c.red}`);
 if(c.hpl)s.push(`lose ${c.hpl} HP`);
 if(c.mana)s.push(`restore ${c.mana} mana`+(c.nm?` now and ${c.nm} at the start of your next turn`:''));
 if(c.gold)s.push(`gain ${c.gold} golden heart${c.gold>1?'s':''}`);
 if(c.vamp)s.push(`convert up to ${c.vamp} damage from the next attack into healing`);
 if(c.mb)s.push(`remove ${c.mb} mana from your opponent`);
 const t=s.join(' and ');return t[0].toUpperCase()+t.slice(1)+'.'}
function eff(c){const o=[];const add=(n,t,w)=>o.push(`<span class="chip">${n>0?'+':'-'}${Math.abs(n)}${gem(t)}${w?'<small>'+w+'</small>':''}</span>`);
 if(c.dmg)add(-c.dmg,'r','foe');if(c.heal&&!c.shield)add(c.heal,'r');if(c.th)add(c.big,'r');if(c.hpl)add(-c.hpl,'r');
 if(c.mana)add(c.mana,'b');if(c.gold)add(c.gold,'g');if(c.mb)add(-c.mb,'b','foe');return o.join('')}

/* ---------- auth ---------- */
let user=null,U=null,mode='in',signing=false;
const mail=n=>n.toLowerCase()+'@splendid.game';
const openAuth=m=>{mode=m;$('#af').style.display='block';$('#aTitle').textContent=m==='up'?'CREATE ACCOUNT':'LOG IN';$('#aErr').textContent=''};
$('#bSign').onclick=()=>openAuth('up');$('#bLog').onclick=()=>openAuth('in');
const nice=e=>({'auth/email-already-in-use':'That username is taken','auth/invalid-credential':'Wrong username or password','auth/weak-password':'Password needs 6+ characters','auth/user-not-found':'No such user','auth/wrong-password':'Wrong username or password'}[e.code]||e.m||e.message);
$('#af').onsubmit=async e=>{e.preventDefault();const n=$('#aUser').value.trim(),p=$('#aPass').value;
 try{if(!/^[A-Za-z0-9_]{3,14}$/.test(n))throw{m:'Username: 3-14 letters, numbers or _'};
  if(mode==='up'){signing=true;const c=await createUserWithEmailAndPassword(auth,mail(n),p);await updateProfile(c.user,{displayName:n});
   await setDoc(doc(db,'splendid_users',c.user.uid),{name:n,wins:0,losses:0,streak:0,best:0,matches:0,time:0,deck:[]});signing=false;await boot(c.user)}
  else await signInWithEmailAndPassword(auth,mail(n),p)}
 catch(err){signing=false;$('#aErr').textContent=nice(err)}};
$('#bOut').onclick=()=>signOut(auth);
onAuthStateChanged(auth,u=>{if(signing)return;if(u)boot(u);else{user=null;U=null;show('s-auth')}});
async function loadU(){const r=doc(db,'splendid_users',user.uid);let s=await getDoc(r);
 if(!s.exists()){await setDoc(r,{name:user.displayName||'Player',wins:0,losses:0,streak:0,best:0,matches:0,time:0,deck:[]});s=await getDoc(r)}
 U=s.data();U.deck=U.deck||[]}
async function boot(u){user=u;await loadU();$('#meName').textContent=U.name;show('s-menu');goTab('play');renderDeck();updateLock()}

/* ---------- menu ---------- */
function goTab(t){$$('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));$$('.tab').forEach(x=>x.classList.toggle('on',x.id==='t-'+t));if(t==='stats')loadStats('best')}
$$('.tabs button').forEach(b=>b.onclick=()=>goTab(b.dataset.t));
const MAXN=32;
const ready24=()=>nodes(U.deck)===MAXN;
function updateLock(){const l=!ready24();['bCode','bJoin','bCreate'].forEach(i=>$('#'+i).classList.toggle('lockd',l));
 $('#lockHint').textContent=l?'Your deck needs exactly 32 nodes. Open DECK to finish it.':''}
const gate=f=>()=>{if(!ready24()){goTab('deck');return}f()};

/* deck tab */
let dSel=null;
function toggle(id){let d=U.deck;if(d.includes(id))U.deck=d.filter(x=>x!==id);else{if(nodes(d)+RAR[CARDS[id-1].r].node>MAXN)return;d.push(id)}
 updateDoc(doc(db,'splendid_users',user.uid),{deck:U.deck}).catch(()=>{});renderDeck();updateLock()}
function renderDeck(){const g=$('#dgrid'),st=g.scrollTop;g.innerHTML='';
 FAM.forEach((f,fi)=>{
  if(fi%4===0){const h=el('div','sech','<i></i>'+f[1]+' CARDS<i></i>');h.style.setProperty('--sc',TL[f[1]]);g.append(h)}
  const row=el('div','fam');row.append(el('div','fl',f[0].toUpperCase()));
  for(let r=0;r<4;r++){const c=CARDS[fi*4+r];const lock=!U.deck.includes(c.id)&&nodes(U.deck)+RAR[c.r].node>MAXN;const w=el('div','cw'+(U.deck.includes(c.id)?' sel':'')+(dSel===c.id?' view':'')+(lock?' lk':''));w.append(cardEl(c));
   const t=el('button','tg');t.disabled=lock;t.onclick=e=>{e.stopPropagation();toggle(c.id)};w.append(t);w.onclick=()=>{dSel=c.id;renderDeck()};row.append(w)}
  g.append(row)});
 g.scrollTop=st;const n=nodes(U.deck);$('#nodeTxt').textContent=`NODES ${n} / ${MAXN}  -  ${U.deck.length} CARDS`;$('#nodeBar').style.width=Math.min(100,n/MAXN*100)+'%';
 const p=$('#dpanel');p.innerHTML='';
 if(!dSel){p.innerHTML='<p style="margin:auto;opacity:.6">Select a card to inspect it.<br>Use the circle on a card to add it to your deck.</p>';return}
 const c=CARDS[dSel-1],r=RAR[c.r],on=U.deck.includes(c.id);
 const big=cardEl(c,'big');p.append(big);
 p.append(el('h2','',c.name),el('b','',`<span style="color:${r.c}">${r.n.toUpperCase()}</span>`),
  el('div','',`<span class="chip">${r.node} NODE${r.node>1?'S':''}</span><span class="chip">${c.type}</span><span class="chip">${c.cost} ${gem('b')}</span>`),el('div','',eff(c)),el('p','',desc(c)));
 const full=!on&&nodes(U.deck)+r.node>MAXN;const b=el('button',on?'red':'green',on?'REMOVE FROM DECK':full?'NOT ENOUGH NODES':'ADD TO DECK');b.disabled=full;b.onclick=()=>toggle(c.id);p.append(b)}

/* stats tab */
async function loadStats(f){$$('.sub button').forEach(b=>b.classList.toggle('on',b.dataset.f===f));const bd=$('#board');bd.innerHTML='<p>Loading...</p>';
 try{const s=await getDocs(query(collection(db,'splendid_users'),orderBy(f,'desc'),limit(5)));bd.innerHTML='';
  s.docs.forEach((d,i)=>{const x=d.data();bd.append(el('div','lb',`<i>${i+1}</i><b>${x.name}</b><span>${x[f]||0}</span>`))});if(!s.size)bd.innerHTML='<p>No players yet.</p>'}
 catch(e){bd.innerHTML='<p>Could not load leaderboard.</p>'}
 await loadU();const t=U.time||0,m=U.matches||0;
 $('#mystats').innerHTML=[['WINS',U.wins],['LOSSES',U.losses],['WIN STREAK',U.streak],['BEST STREAK',U.best],['MATCHES',m],['WIN RATE',m?Math.round(U.wins/m*100)+'%':'0%'],['TIME PLAYED',Math.floor(t/3600)+'h '+Math.floor(t%3600/60)+'m']].map(([a,b])=>`<div><small>${a}</small><b>${b||0}</b></div>`).join('')}
$$('.sub button').forEach(b=>b.onclick=()=>loadStats(b.dataset.f));

/* ---------- rooms ---------- */
let G=null;
const newG=code=>({code,ref:doc(db,'splendid_rooms',code),me:user.uid,clk:{me:300000,op:300000},last:Date.now(),t0:Date.now(),deck:[],hand:[]});
function enterRoom(code){G=newG(code);G.waiting=true;G.unsub=onSnapshot(G.ref,s=>onRoom(s.data()))}
async function joinRoom(code){const ref=doc(db,'splendid_rooms',code);
 await runTransaction(db,async t=>{const s=await t.get(ref);if(!s.exists())throw{m:'Room not found'};const d=s.data();
  if(d.status!=='open'||d.guest)throw{m:'Room is not available'};if(d.host.uid===user.uid)throw{m:'That is your own room'};
  t.update(ref,{guest:{uid:user.uid,name:U.name},status:'playing',turn:Math.random()<.5?d.host.uid:user.uid,seq:1,phase:'act'})});
 enterRoom(code)}
async function createRoom(pub,searching){const L='ABCDEFGHIJKLMNOPQRSTUVWXYZ';let code;
 do{code=Array.from({length:4},()=>L[Math.random()*26|0]).join('')}while((await getDoc(doc(db,'splendid_rooms',code))).exists());
 await setDoc(doc(db,'splendid_rooms',code),{code,public:pub,status:'open',host:{uid:user.uid,name:U.name},guest:null,beat:Date.now(),pub:{},c:{},res:{},fin:{}});
 enterRoom(code);G.beat=setInterval(()=>updateDoc(G.ref,{beat:Date.now()}).catch(()=>{}),15000);
 const cols=['#d9546a','#e08a3a','#3fae84','#4f8fd6'];
 modal(searching?`<h2>SEARCHING</h2><div class="spin"></div><p>Looking for an opponent...</p><button class="red" id="cx">CANCEL</button>`
  :`<h2>ROOM CODE</h2><div class="codes">${[...code].map((l,i)=>`<b style="background:${cols[i]}">${l}</b>`).join('')}</div><div class="spin"></div><p>Waiting for your friend...</p><button class="red" id="cx">CANCEL</button>`);
 $('#cx').onclick=cancelWait}
async function cancelWait(){if(!G)return;clearInterval(G.beat);G.unsub&&G.unsub();const r=G.ref;G=null;closeModal();try{await deleteDoc(r)}catch(e){}}
$('#bCreate').onclick=gate(()=>createRoom(false));
$('#bCode').onclick=gate(()=>{modal(`<h2>JOIN ROOM</h2><input id="ci" maxlength="4" placeholder="ABCD"><p id="ce" style="color:#ff6f8a;min-height:20px"></p><div class="row"><button class="lav" id="cc">CANCEL</button><button class="blue" id="cg">JOIN</button></div>`);
 const i=$('#ci');i.oninput=()=>i.value=i.value.toUpperCase().replace(/[^A-Z]/g,'');i.focus();$('#cc').onclick=closeModal;
 $('#cg').onclick=async()=>{if(i.value.length<4){$('#ce').textContent='Enter the 4 letter code';return}
  try{await joinRoom(i.value)}catch(e){$('#ce').textContent=e.m||'Could not join'}}});
$('#bJoin').onclick=gate(async()=>{modal(`<h2>SEARCHING</h2><div class="spin"></div><p>Looking for an opponent...</p>`);
 try{const s=await getDocs(query(collection(db,'splendid_rooms'),where('public','==',true),where('status','==','open'),limit(10)));
  for(const d of s.docs){const x=d.data();if(x.host.uid===user.uid||Date.now()-x.beat>45000)continue;try{await joinRoom(d.id);return}catch(e){}}
  await createRoom(true,true)}catch(e){modal(`<h2>ERROR</h2><p>${e.message}</p><button class="lav" onclick="document.getElementById('modal').classList.remove('on')">OK</button>`)}});

/* ---------- gems ---------- */
function buildGems(){['op','me'].forEach(s=>{$('#'+s+'-gems').innerHTML=`<div class="hpbox"><div class="gd" id="${s}-gd"></div><div class="hp" id="${s}-hp"></div></div><div class="mn" id="${s}-mn"></div>`;
 const f=(id,n,c)=>{for(let i=0;i<n;i++){const g=el('i','gem '+c);g.dataset.f=0;$('#'+s+id).append(g)}};f('-hp',20,'r');f('-gd',5,'g');f('-mn',5,'b')})}
function gemSet(box,n,base){const sl=$$('.gem',box),lost=[];
 sl.forEach((g,i)=>{const w=i<n?1:0,h=+g.dataset.f;g.dataset.f=w;if(w&&!h){g.classList.remove('shatter');g.classList.add('on')}else if(!w&&h)lost.push(i)});
 lost.reverse().forEach((i,k)=>setTimeout(()=>{const g=sl[i];if(+g.dataset.f)return;g.classList.remove('on');g.classList.add('shatter');sfx('break');setTimeout(()=>g.classList.remove('shatter'),480)},(base+k)*200));return lost.length}
function renderSide(s,hp,gd,mn){let d=0;d+=gemSet($('#'+s+'-hp'),Math.max(0,hp),d);d+=gemSet($('#'+s+'-gd'),gd,d);gemSet($('#'+s+'-mn'),mn,d)}
const syncMe=()=>renderSide('me',G.S.hp,G.S.gold,G.S.mana);

/* ---------- battle ---------- */
const setMsg=t=>$('#gmsg').textContent=t;
const pubOf=()=>({hp:G.S.hp,gold:G.S.gold,mana:G.S.mana,deck:G.deck.length,hand:G.hand.length,clock:G.clk.me});
const pub=()=>updateDoc(G.ref,{['pub.'+G.me]:pubOf()}).catch(()=>{});
const myAct=()=>G&&G.r&&G.r.phase==='act'&&G.r.turn===G.me&&!G.locked&&!G.stuck&&!G.over;
const myReact=()=>G&&G.r&&G.r.phase==='react'&&G.r.turn===G.opp&&!G.rcDone&&!G.over;
const canPlay=c=>(myAct()&&c.cost<=G.S.mana)||(myReact()&&c.type==='SPELL'&&c.cost<=G.S.mana);
const heal=n=>G.S.hp=Math.min(20,G.S.hp+n);
function hitMe(d){const S=G.S,g=Math.min(S.gold,d);S.gold-=g;S.hp=Math.max(0,S.hp-(d-g))}
function draw(){if(G.deck.length&&G.hand.length<3){G.hand.push(G.deck.pop());sfx('take')}}

function initGame(r){G.init=1;G.waiting=false;G.opp=r.host.uid===G.me?r.guest.uid:r.host.uid;G.oppName=r.host.uid===G.me?r.guest.name:r.host.name;
 G.S={hp:20,gold:0,mana:5,shield:null,vamp:0,red:0,dots:[],nm:0};G.deck=shuffle(U.deck);G.hand=[];G.t0=Date.now();G.last=Date.now();
 clearInterval(G.beat);closeModal();show('s-game');buildGems();$('#me-name').textContent=U.name;$('#op-name').textContent=G.oppName;
 for(let i=0;i<3;i++)draw();syncMe();renderSide('op',20,0,5);renderOpHand(3);$('#op-dn').textContent='';renderFooter();pub()}
function renderOpHand(n){const h=$('#op-hand');h.innerHTML='';for(let i=0;i<n;i++)h.append(backEl())}

function onRoom(r){
 if(!G||!r||G.over)return;G.r=r;
 if(r.status==='open')return;
 if(r.status==='done'){endGame(r);return}
 if(!G.init)initGame(r);
 const me=G.me,op=G.opp,o=r.pub&&r.pub[op];
 if(o){if(r.phase!=='act')G.clk.op=o.clock;renderSide('op',o.hp,o.gold,o.mana);$('#op-dn').textContent=o.deck;renderOpHand(o.hand)}
 if(r.phase==='act'&&G.a!==r.seq){G.a=r.seq;G.locked=false;G.rcDone=false;G.sel=null;G.stuck=false;G.last=Date.now();
  $('#me-slot').innerHTML='';$('#op-slot').innerHTML='';setMsg(r.turn===me?'YOUR TURN':"OPPONENT'S TURN");renderFooter();checkStuck()}
 if(r.phase==='react'&&r.turn===op&&G.rc!==r.seq){G.rc=r.seq;G.rcDone=false;G.rcAt=Date.now();$('#op-slot').replaceChildren(backEl());renderFooter()}
 if(r.phase==='resolve'&&G.rv!==r.seq){G.rv=r.seq;reveal(r)}
 if(r.phase==='resolve'&&G.rd===r.seq&&G.fin!==r.seq&&r.res&&r.res[op]&&r.res[op].seq===r.seq)finish(r);
 if(r.phase==='resolve'&&r.turn===op&&G.st!==r.seq&&r.fin&&r.fin[me]===r.seq&&r.fin[op]===r.seq){G.st=r.seq;startMyTurn(r)}}

function checkStuck(){if(!G||G.over||G.stuck||!myAct())return;
 if(!G.hand.length||G.hand.every(id=>CARDS[id-1].cost>G.S.mana)){
  if(!G.deck.length){endWrite(G.opp,'out of moves');return}
  G.stuck=true;setMsg('NO PLAYABLE CARD - DISCARDING');renderFooter();
  setTimeout(()=>{if(!G||G.over)return;G.stuck=false;if(G.hand.length)discard(Math.random()*G.hand.length|0);checkStuck();setMsg(G.stuck?'NO PLAYABLE CARD - DISCARDING':'YOUR TURN')},1000)}}

function discard(i){if(!G.hand[i])return;G.hand.splice(i,1);G.sel=null;draw();pub();renderFooter()}

async function commit(i){const react=myReact(),id=G.hand[i],c=CARDS[id-1];
 if(!c||!(react?c.type==='SPELL'&&c.cost<=G.S.mana:myAct()&&c.cost<=G.S.mana))return;
 G.hand.splice(i,1);G.S.mana-=c.cost;G.sel=null;
 if(react)G.rcDone=true;else{G.locked=true;G.reactStart=Date.now();G.clk.me=G.clk.me}
 draw();$('#me-slot').replaceChildren(backEl());syncMe();renderFooter();setMsg(react?'':'WAITING FOR OPPONENT...');
 await updateDoc(G.ref,{['c.'+G.me]:id,phase:react?'resolve':'react',['pub.'+G.me]:pubOf()})}
async function ready(){if(!myReact())return;G.rcDone=true;renderFooter();await updateDoc(G.ref,{['c.'+G.me]:0,phase:'resolve'})}

function reveal(r){const mc=r.c[G.me],oc=r.c[G.opp];setMsg('');
 const put=(id,slot)=>{if(!id)return;const c=CARDS[id-1],e=cardEl(c,'flip');$(slot).replaceChildren(e);sfx('place');if(c.dmg)setTimeout(()=>sfx('hit'),200)};
 put(mc,'#me-slot');put(oc,'#op-slot');
 setTimeout(()=>doResolve(mc,oc,r.seq),1000)}

function doResolve(mc,oc,seq){if(!G||G.over)return;const S=G.S,out={back:0},m=mc&&CARDS[mc-1],t=oc&&CARDS[oc-1];
 if(m){
  if(m.dmg&&m.heal)heal(m.heal);
  if(m.shield)S.shield={heal:m.heal||0,back:m.back||0};
  else if(m.th)heal(S.hp<=m.th?m.big:m.small);
  else if(m.rn){heal(m.heal);S.dots.push({a:m.rn[0],t:m.rn[1]})}
  else if(m.heal&&!m.dmg)heal(m.heal);
  if(m.red)S.red+=m.red;
  if(m.hpl)S.hp=Math.max(0,S.hp-m.hpl);
  if(m.mana){S.mana=Math.min(5,S.mana+m.mana);S.nm+=m.nm||0}
  if(m.gold)S.gold=Math.min(5,S.gold+m.gold);
  if(m.vamp)S.vamp=Math.max(S.vamp,m.vamp)}
 if(t){
  if(t.mb)S.mana=Math.max(0,S.mana-t.mb);
  if(t.dmg){let d=t.dmg;
   if(S.shield){heal(S.shield.heal);out.back=S.shield.back;S.shield=null;d=0}
   else{if(S.red){d=Math.max(0,d-S.red);S.red=0}
    if(S.vamp){const cv=Math.min(S.vamp,d);d-=cv;heal(cv);S.vamp=0}
    hitMe(d)}}}
 G.rd=seq;syncMe();
 updateDoc(G.ref,{['res.'+G.me]:{seq,back:out.back},['pub.'+G.me]:pubOf()})}

function finish(r){G.fin=r.seq;const b=r.res[G.opp].back;if(b){hitMe(b);syncMe()}
 updateDoc(G.ref,{['fin.'+G.me]:r.seq,['pub.'+G.me]:pubOf()});
 if(G.S.hp<=0)endWrite(G.opp,'hearts')}

async function startMyTurn(r){const S=G.S;S.mana=Math.min(5,S.mana+1);S.mana=Math.min(5,S.mana+S.nm);S.nm=0;
 S.dots=S.dots.filter(d=>{heal(d.a);d.t--;return d.t>0});syncMe();
 await updateDoc(G.ref,{turn:G.me,seq:r.seq+1,phase:'act',c:{},res:{},fin:{},['pub.'+G.me]:pubOf()})}

/* footer */
function renderFooter(){if(!G||!G.init)return;const f=$('#ftr');f.innerHTML='';
 if(G.sel!=null&&G.hand[G.sel]){const i=G.sel,c=CARDS[G.hand[i]-1];
  const bk=el('button','lav','BACK');bk.onclick=()=>{G.sel=null;renderFooter()};
  const inf=el('div','inf',`<b style="color:${RAR[c.r].c}">${c.name} <em>${RAR[c.r].n.toUpperCase()}</em></b><div>${eff(c)}</div><small>${desc(c)}</small>`);
  const pl=el('button','green',`PLAY <span class="chip">${c.cost}${gem('b')}</span>`);pl.disabled=!canPlay(c);pl.onclick=()=>commit(i);
  const ds=el('button','red','DISCARD');ds.disabled=!(myAct()&&G.deck.length);ds.onclick=()=>discard(i);
  f.append(bk,inf,pl,ds);return}
 const hd=el('div','hand');
 for(let i=0;i<3;i++){const id=G.hand[i];
  if(id){const c=CARDS[id-1],e=cardEl(c);if((myAct()||myReact())&&!canPlay(c))e.classList.add('dim');e.onclick=()=>{G.sel=i;renderFooter()};hd.append(e)}
  else hd.append(el('div','slot ph'))}
 f.append(hd);
 if(myReact()){const rb=el('button','blue','READY');rb.onclick=ready;f.append(rb)}
 const pile=el('div','pile');pile.append(backEl(),el('b','',G.deck.length));f.append(pile)}

/* timers */
setInterval(()=>{if(!G||G.over||!G.init||!G.r||G.r.status!=='playing')return;
 const now=Date.now(),dt=now-G.last;G.last=now;const r=G.r;
 if(r.phase==='act'){const k=r.turn===G.me?'me':'op';G.clk[k]-=dt;if(G.clk[k]<=0)endWrite(k==='me'?G.opp:G.me,'time')}
 $('#me-clk b').textContent=fmt(G.clk.me);$('#op-clk b').textContent=fmt(G.clk.op);
 $('#me-clk').classList.toggle('act',r.phase==='act'&&r.turn===G.me);$('#op-clk').classList.toggle('act',r.phase==='act'&&r.turn===G.opp);
 if(r.phase==='react'){
  if(r.turn===G.opp&&!G.rcDone){const left=10000-(now-G.rcAt);if(left<=0)ready();else setMsg(`OPPONENT IS READY - PLACE A SPELL OR PRESS READY (${Math.ceil(left/1000)})`)}
  if(r.turn===G.me&&G.reactStart&&now-G.reactStart>25000)endWrite(G.me,'disconnect')}
},250);

/* forfeit */
(()=>{const b=$('#forfeit'),u=$('u',b);let t=null;
 const stop=()=>{clearTimeout(t);u.style.transition='none';u.style.width='0'};
 b.onpointerdown=()=>{if(!G||G.over)return;u.style.transition='width 3s linear';u.style.width='100%';t=setTimeout(()=>{stop();if(G&&!G.over)endWrite(G.opp,'forfeit')},3000)};
 ['pointerup','pointerleave','pointercancel'].forEach(e=>b.addEventListener(e,stop))})();

/* end */
async function endWrite(winner,reason){if(!G||G.over||!G.ref)return;
 try{await runTransaction(db,async t=>{const s=await t.get(G.ref);if(!s.exists()||s.data().status==='done')return;t.update(G.ref,{status:'done',winner,reason})})}catch(e){}}
function endGame(r){if(G.over)return;G.over=true;G.unsub&&G.unsub();const won=r.winner===G.me,who=won?G.oppName:'You';
 const txt={time:'ran out of time',forfeit:'forfeited','hearts':'lost all hearts','out of moves':'ran out of cards',disconnect:'disconnected'}[r.reason]||'lost';
 modal(`<h2 class="${won?'win':'lose'}">${won?'VICTORY':'DEFEAT'}</h2><p>${who} ${txt}.</p><button class="blue" id="bk">CONTINUE</button>`);
 $('#bk').onclick=async()=>{closeModal();G=null;show('s-menu');goTab('play');await loadU();updateLock()};
 saveStats(won,G.t0)}
async function saveStats(won,t0){try{const ref=doc(db,'splendid_users',user.uid),d=(await getDoc(ref)).data();
 const streak=won?(d.streak||0)+1:0;
 await setDoc(ref,{wins:(d.wins||0)+(won?1:0),losses:(d.losses||0)+(won?0:1),streak,best:Math.max(d.best||0,streak),matches:(d.matches||0)+1,time:(d.time||0)+Math.round((Date.now()-t0)/1000)},{merge:true})}catch(e){}}
