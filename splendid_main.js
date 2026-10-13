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
const SFX={};['take','place','hit','break','regen'].forEach(n=>{SFX[n]=new Audio(`splendid_${n}.mp3`);SFX[n].preload='auto'});
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
const MM=10,MG=10;   /* max mana, max golden hearts */
const FAM=[
['Strike','ATTACK','strike',{cost:[1,3,5,7],dmg:[1,3,5,7]}],
['Pierce','ATTACK','pierce',{cost:[1,3,6,9],dmg:[1,2,3,5],pdot:[1,1,2,3]}],
['Crush','ATTACK','crush',{cost:[2,5,8,10],dmg:[3,5,7,9]}],
['Leech','ATTACK','leech',{cost:[2,4,7,10],dmg:[1,2,3,4],heal:[1,1,2,3]}],
['Mend','HEAL','mend',{cost:[1,2,4,6],heal:[1,2,4,6]}],
['Renewal','HEAL','renewal',{cost:[2,3,5,7],heal:[1,2,2,3],rn:[[1,1],[1,1],[2,1],[2,1]]}],
['Resolve','HEAL','resolve',{cost:[2,4,7,9],th:[12,9,6,3],big:[3,4,6,8],small:[1,2,3,4]}],
['Crimson','HEAL','crimson',{cost:[1,3,7,10],heal:[1,2,4,5],red:[1,2,3,5]}],
['Focus','MANA HEAL','focus',{cost:0,mana:[1,2,3,4]}],
['Reserve','MANA HEAL','reserve',{cost:0,mana:[1,2,3,4],nm:[1,1,1,2],hpl:[2,3,4,4]}],
['Exchange','MANA HEAL','exchange',{cost:0,hpl:[1,2,3,4],mana:[2,3,4,5]}],
['Offering','MANA HEAL','offering',{cost:0,mana:[2,3,4,6],disc:[1,2,2,9]}],
['Golden Heart','SPELL','golden',{cost:[2,4,7,10],gold:[1,2,4,6]}],
['Shield','SPELL','shield',{cost:[1,2,4,7],shield:1,back:[0,1,2,4]}],
['Vampirism','SPELL','vamp',{cost:[3,5,8,10],vamp:[2,4,6,8]}],
['Mana Break','SPELL','mbreak',{cost:[1,2,3,5],mb:[2,3,5,99]}]];
/* Shield lasts until it blocks an attack or 2 rounds pass. Crimson reduction and Vampirism wait for the next attack. */
const NXT='the next';
const CARDS=[];
FAM.forEach(([name,type,ic,p])=>{for(let r=0;r<4;r++){const c={id:CARDS.length+1,name,type,ic,r};for(const k in p)c[k]=Array.isArray(p[k])?p[k][r]:p[k];CARDS.push(c)}});
const nodes=d=>d.reduce((a,id)=>a+RAR[CARDS[id-1].r].node,0);
const cardEl=(c,x='')=>{const e=el('div','card '+x);e.style.setProperty('--rc',RAR[c.r].c);e.style.setProperty('--tc',TC[c.type]);e.style.setProperty('--tl',TL[c.type]);
 const P=ICONS[c.ic].map(d=>`<path d="${d}"/>`).join('');
 e.innerHTML=`<svg viewBox="0 0 48 48"><circle class="rg" cx="24" cy="24" r="23"/><circle class="rg2" cx="24" cy="24" r="20"/><g class="sh" transform="translate(1.2 1.7)">${P}</g><g class="hl" transform="translate(-.6 -.7)">${P}</g><g class="et">${P}</g></svg><span>${c.name}</span>`;return e};
const backEl=()=>el('div','card back','<i></i>');
const gem=t=>`<i class="gem ${t}"></i>`;
function desc(c){const s=[];
 if(c.dmg)s.push(`deal ${c.dmg} damage`+(c.pdot?` and ${c.pdot} damage the next turn`:''));
 if(c.shield)s.push('block the next attack against you'+(c.back?` and deal ${c.back} damage back`:'')+' (expires after 2 turns)');
 else if(c.th)s.push(`restore ${c.big} HP if you have ${c.th} HP or less, otherwise restore ${c.small} HP`);
 else if(c.rn)s.push(`restore ${c.heal} HP now and ${c.rn[0]} HP at the start of ${c.rn[1]>1?'each of your next '+c.rn[1]+' turns':'your next turn'}`);
 else if(c.heal)s.push(c.dmg?`heal ${c.heal} HP`:`restore ${c.heal} HP`);
 if(c.red)s.push(`reduce the next incoming attack's damage by ${c.red}`);
 if(c.hpl&&!c.nm)s.push(`lose ${c.hpl} HP`);
 if(c.mana)s.push(`restore ${c.mana} mana`+(c.nm?` now and ${c.nm} mana at the start of your next turn`:'')+(c.hpl&&c.nm?` but take ${c.hpl} damage`:''));
 if(c.disc)s.push(c.disc>=9?'auto discard your whole hand':`auto discard ${c.disc} random card${c.disc>1?'s':''}`);
 if(c.gold)s.push(`gain ${c.gold} golden heart${c.gold>1?'s':''}`);
 if(c.vamp)s.push(`convert up to ${c.vamp} damage from the next attack into healing`);
 if(c.mb)s.push(c.mb>=99?'remove all mana from your opponent':`remove ${c.mb} mana from your opponent`);
 const t=s.join(' and ');return t[0].toUpperCase()+t.slice(1)+'.'}
function eff(c){const o=[];const add=(n,t,w)=>o.push(`<span class="chip">${n>0?'+':'-'}${Math.abs(n)}${gem(t)}${w?'<small>'+w+'</small>':''}</span>`);
 if(c.dmg)add(-c.dmg,'r','foe');if(c.pdot)add(-c.pdot,'r','next turn');
 if(c.heal&&!c.shield)add(c.heal,'r');if(c.th)add(c.big,'r');if(c.hpl)add(-c.hpl,'r');
 if(c.mana)add(c.mana,'b');if(c.gold)add(c.gold,'g');
 if(c.mb)c.mb>=99?o.push(`<span class="chip">ALL${gem('b')}<small>foe</small></span>`):add(-c.mb,'b','foe');
 if(c.disc)o.push(`<span class="chip">DISCARD ${c.disc>=9?'ALL':c.disc}</span>`);
 return o.join('')}

/* ---------- auth ---------- */
let user=null,U=null,mode='in',signing=false;
const mail=n=>n.toLowerCase()+'@splendid.game';
const openAuth=m=>{mode=m;$('#af').style.display='block';$('#aTitle').textContent=m==='up'?'CREATE ACCOUNT':'LOG IN';$('#aErr').textContent=''};
$('#bSign').onclick=()=>openAuth('up');$('#bLog').onclick=()=>openAuth('in');
const nice=e=>({'auth/email-already-in-use':'That username is taken','auth/invalid-credential':'Wrong username or password','auth/weak-password':'Password needs 6+ characters','auth/user-not-found':'No such user','auth/wrong-password':'Wrong username or password'}[e.code]||e.m||e.message);
$('#af').onsubmit=async e=>{e.preventDefault();const n=$('#aUser').value.trim(),p=$('#aPass').value;
 try{if(!/^[A-Za-z0-9_]{3,14}$/.test(n))throw{m:'Username: 3-14 letters, numbers or _'};
  if(mode==='up'){signing=true;const c=await createUserWithEmailAndPassword(auth,mail(n),p);await updateProfile(c.user,{displayName:n});
   await setDoc(doc(db,'splendid_users',c.user.uid),{name:n,wins:0,losses:0,streak:0,best:0,matches:0,rate:0,time:0,deck:[]});signing=false;await boot(c.user)}
  else await signInWithEmailAndPassword(auth,mail(n),p)}
 catch(err){signing=false;$('#aErr').textContent=nice(err)}};
$('#bOut').onclick=()=>signOut(auth);
onAuthStateChanged(auth,u=>{if(signing)return;if(u)boot(u);else{user=null;U=null;show('s-auth')}});
async function loadU(){const r=doc(db,'splendid_users',user.uid);let s=await getDoc(r);
 if(!s.exists()){await setDoc(r,{name:user.displayName||'Player',wins:0,losses:0,streak:0,best:0,matches:0,rate:0,time:0,deck:[]});s=await getDoc(r)}
 U=s.data();U.deck=U.deck||[];
 if(U.rate===undefined&&(U.matches||0)>0){U.rate=Math.round((U.wins||0)/U.matches*100);updateDoc(r,{rate:U.rate}).catch(()=>{})}}
async function boot(u){user=u;await loadU();$('#meName').textContent=U.name;show('s-menu');goTab('play');renderDeck();updateLock()}

/* ---------- menu ---------- */
function goTab(t){$$('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));$$('.tab').forEach(x=>x.classList.toggle('on',x.id==='t-'+t));if(t==='stats')loadStats('best')}
$$('.tabs button').forEach(b=>b.onclick=()=>goTab(b.dataset.t));
const MAXN=32,MIN_RATE_MATCHES=5;   /* win-rate board only lists players with this many matches */
const ready24=()=>nodes(U.deck)===MAXN;
function updateLock(){const l=!ready24();['bCode','bJoin','bCreate','bBot'].forEach(i=>$('#'+i).classList.toggle('lockd',l));
 $('#lockHint').textContent=l?'Your deck needs exactly 32 nodes. Open DECK to finish it.':''}
const gate=f=>()=>{if(!ready24()){goTab('deck');return}f()};

/* deck tab */
let dSel=null;
function toggle(id){let d=U.deck;if(d.includes(id))U.deck=d.filter(x=>x!==id);else{if(nodes(d)+RAR[CARDS[id-1].r].node>MAXN)return;d.push(id)}
 updateDoc(doc(db,'splendid_users',user.uid),{deck:U.deck}).catch(()=>{});renderDeck();updateLock()}
let clrArm=0;
$('#bClr').onclick=()=>{const b=$('#bClr');if(!U||!U.deck.length)return;
 if(Date.now()-clrArm<2500){clrArm=0;b.textContent='DESELECT ALL';U.deck=[];updateDoc(doc(db,'splendid_users',user.uid),{deck:[]}).catch(()=>{});renderDeck();updateLock()}
 else{clrArm=Date.now();b.textContent='TAP AGAIN';setTimeout(()=>{if(Date.now()-clrArm>=2400){clrArm=0;b.textContent='DESELECT ALL'}},2600)}};
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
 try{const rate=f==='rate',s=await getDocs(query(collection(db,'splendid_users'),orderBy(f,'desc'),limit(rate?50:5)));bd.innerHTML='';
  const rows=s.docs.map(d=>d.data()).filter(x=>!rate||(x.matches||0)>=MIN_RATE_MATCHES).slice(0,5);
  rows.forEach((x,i)=>bd.append(el('div','lb',`<i>${i+1}</i><b>${x.name}</b><span>${rate?(x.rate||0)+'%':(x[f]||0)}</span>`)));
  if(!rows.length)bd.innerHTML='<p>'+(rate?'Nobody has played '+MIN_RATE_MATCHES+' matches yet.':'No players yet.')+'</p>'}
 catch(e){bd.innerHTML='<p>Could not load leaderboard.</p>'}
 await loadU();const t=U.time||0,m=U.matches||0;
 $('#mystats').innerHTML=[['WINS',U.wins],['LOSSES',U.losses],['CURRENT STREAK',U.streak],['WIN STREAK RECORD',U.best],['MATCHES',m],['WIN RATE',m?Math.round(U.wins/m*100)+'%':'0%'],['TIME PLAYED',Math.floor(t/3600)+'h '+Math.floor(t%3600/60)+'m']].map(([a,b])=>`<div><small>${a}</small><b>${b||0}</b></div>`).join('')}
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
$('#bBot').onclick=gate(()=>startBot());
$('#bCode').onclick=gate(()=>{modal(`<h2>JOIN ROOM</h2><input id="ci" maxlength="4" placeholder="ABCD"><p id="ce" style="color:#ff6f8a;min-height:20px"></p><div class="row"><button class="lav" id="cc">CANCEL</button><button class="blue" id="cg">JOIN</button></div>`);
 const i=$('#ci');i.oninput=()=>i.value=i.value.toUpperCase().replace(/[^A-Z]/g,'');i.focus();$('#cc').onclick=closeModal;
 $('#cg').onclick=async()=>{if(i.value.length<4){$('#ce').textContent='Enter the 4 letter code';return}
  try{await joinRoom(i.value)}catch(e){$('#ce').textContent=e.m||'Could not join'}}});
$('#bJoin').onclick=gate(async()=>{modal(`<h2>SEARCHING</h2><div class="spin"></div><p>Looking for an opponent...</p>`);
 try{const s=await getDocs(query(collection(db,'splendid_rooms'),where('public','==',true),where('status','==','open'),limit(10)));
  for(const d of s.docs){const x=d.data();if(x.host.uid===user.uid||Date.now()-x.beat>45000)continue;try{await joinRoom(d.id);return}catch(e){}}
  await createRoom(true,true)}catch(e){modal(`<h2>ERROR</h2><p>${e.message}</p><button class="lav" onclick="document.getElementById('modal').classList.remove('on')">OK</button>`)}});

/* ---------- gems ---------- */
function buildGems(){['op','me'].forEach(s=>{$('#'+s+'-gems').innerHTML=`<div class="hpbox"><div class="fx" id="${s}-fx"></div><div class="gd" id="${s}-gd"></div><div class="hp" id="${s}-hp"></div></div><div class="mn" id="${s}-mn"></div>`;
 const f=(id,n,c)=>{for(let i=0;i<n;i++){const g=el('i','gem '+c);g.dataset.f=0;$('#'+s+id).append(g)}};f('-hp',20,'r');f('-gd',MG,'g');f('-mn',MM,'b')})}
let regenN=0;
function gemSet(box,n,base,snd){const sl=$$('.gem',box),lost=[],first=!box.dataset.i;box.dataset.i=1;
 sl.forEach((g,i)=>{const w=i<n?1:0,h=+g.dataset.f;g.dataset.f=w;if(w&&!h){g.classList.remove('shatter');g.classList.add('on');if(snd&&!first)regenN++}else if(!w&&h)lost.push(i)});
 lost.reverse().forEach((i,k)=>setTimeout(()=>{const g=sl[i];if(+g.dataset.f)return;g.classList.remove('on');g.classList.add('shatter');sfx('break');setTimeout(()=>g.classList.remove('shatter'),480)},(base+k)*200));return lost.length}
function renderSide(s,hp,gd,mn){let d=0;regenN=0;d+=gemSet($('#'+s+'-hp'),Math.max(0,hp),d,true);d+=gemSet($('#'+s+'-gd'),gd,d,false);gemSet($('#'+s+'-mn'),mn,d,true);if(regenN)sfx('regen')}
const fxTxt=S=>[S.shield?'SHIELD ('+S.shield.t+' LEFT)':'',S.bleed&&S.bleed.length?'BLEED '+S.bleed.reduce((a,b)=>a+b.a,0):'',S.vamp?'VAMPIRISM '+S.vamp:'',S.red?'-'+S.red+' NEXT HIT':'',S.dots.length?'REGEN '+S.dots.reduce((a,d)=>a+d.a*d.t,0):''].filter(Boolean).join('  \u00b7  ');
const syncMe=()=>{renderSide('me',G.S.hp,G.S.gold,G.S.mana);$('#me-fx').textContent=fxTxt(G.S)};

/* ---------- battle ---------- */
const setMsg=t=>$('#gmsg').textContent=t;
const pubOf=()=>({fx:fxTxt(G.S),hp:G.S.hp,gold:G.S.gold,mana:G.S.mana,deck:G.deck.length,hand:G.hand.length,clock:G.clk.me});
const wr=p=>G&&G.bot?Promise.resolve(botWrite(p)):updateDoc(G.ref,p).catch(()=>{});
const pub=()=>wr({['pub.'+G.me]:pubOf()});
/* turn model: first player (room.turn) picks in phase 'act', second player picks in phase 'react', then 'resolve' */
const mover=r=>r.phase==='act'?r.turn:r.phase==='react'?(r.turn===G.me?G.opp:G.me):null;
const myMove=()=>!!(G&&G.r&&!G.over&&mover(G.r)===G.me&&!G.locked);
const canPlay=c=>myMove()&&c.cost<=G.S.mana;
const heal=n=>G.S.hp=Math.min(20,G.S.hp+n);
function hitMe(d){const S=G.S,g=Math.min(S.gold,d);S.gold-=g;S.hp=Math.max(0,S.hp-(d-g))}
/* pile empty -> whole deck (minus cards in hand) is reshuffled back in, so nobody ever runs out */
const refill=()=>{G.deck=shuffle(U.deck.filter(id=>!G.hand.includes(id)))};
function draw(){if(!G.deck.length)refill();if(G.deck.length&&G.hand.length<3){G.hand.push(G.deck.pop());sfx('take');if(!G.deck.length){refill();sfx('regen')}}}

function initGame(r){G.init=1;G.waiting=false;G.opp=r.host.uid===G.me?r.guest.uid:r.host.uid;G.oppName=r.host.uid===G.me?r.guest.name:r.host.name;
 G.S={hp:20,gold:0,mana:4,shield:null,vamp:0,red:0,dots:[],bleed:[],nm:0};G.deck=shuffle(U.deck);G.hand=[];G.t0=Date.now();G.last=Date.now();
 clearInterval(G.beat);closeModal();show('s-game');buildGems();$('#me-name').textContent=U.name;$('#op-name').textContent=G.oppName;
 for(let i=0;i<3;i++)draw();syncMe();renderSide('op',20,0,4);renderOpHand(3);$('#op-dn').textContent='';renderFooter();pub()}
function renderOpHand(n){const h=$('#op-hand');h.innerHTML='';for(let i=0;i<n;i++)h.append(backEl())}

function onRoom(r){
 if(!G||!r||G.over)return;G.r=r;
 if(r.status==='open')return;
 if(r.status==='done'){endGame(r);return}
 if(!G.init)initGame(r);
 const me=G.me,op=G.opp,o=r.pub&&r.pub[op],m=mover(r);
 const pk=r.seq+r.phase;if(G.pk!==pk){G.pk=pk;G.opSeen=Date.now()}
 if(o){if(o.clock!==G.opClk){G.opClk=o.clock;G.opSeen=Date.now()}
  G.clk.op=m===op?Math.min(G.clk.op,o.clock):o.clock;
  renderSide('op',o.hp,o.gold,o.mana);$('#op-fx').textContent=o.fx||'';$('#op-dn').textContent=o.deck;renderOpHand(o.hand)}
 /* new round: clear table, apply start-of-round mana and regen */
 if(r.phase==='act'&&G.a!==r.seq){G.a=r.seq;$('#me-slot').innerHTML='';$('#op-slot').innerHTML='';startRound()}
 if(r.phase==='react'&&r.turn===op&&G.rc!==r.seq){G.rc=r.seq;$('#op-slot').replaceChildren(backEl())}
 const mk=r.seq+':'+r.phase;
 if(m===me&&G.mk!==mk){G.mk=mk;G.locked=false;G.disc=false;G.skipArm=0;G.sel=null;G.last=Date.now();setMsg('YOUR TURN');renderFooter()}
 else if(m===op&&G.mk!==mk){G.mk=mk;G.sel=null;setMsg("OPPONENT'S TURN");renderFooter()}
 if(r.phase==='resolve'&&G.rv!==r.seq){G.rv=r.seq;reveal(r)}
 if(r.phase==='resolve'&&G.rd===r.seq&&G.fin!==r.seq&&r.res&&r.res[op]&&r.res[op].seq===r.seq)finish(r);
 /* first player starts the next round once both sides finished and cards were shown for 4s */
 if(r.phase==='resolve'&&r.turn===me&&G.st!==r.seq&&r.fin&&r.fin[me]===r.seq&&r.fin[op]===r.seq){G.st=r.seq;
  const seq=r.seq,wait=Math.max(0,(G.shownAt||Date.now())+4000-Date.now());
  setTimeout(()=>{if(G&&!G.over)wr({seq:seq+1,phase:'act',c:{},res:{},fin:{}})},wait)}}

function startRound(){const S=G.S;S.mana=Math.min(MM,S.mana+1+S.nm);S.nm=0;
 S.dots=S.dots.filter(d=>{heal(d.a);d.t--;return d.t>0});tickBleed(S);syncMe();pub();if(S.hp<=0)endWrite(G.opp,'hearts')}
/* Pierce's delayed damage: hits at the start of the victim's next round, golden hearts absorb it first */
const tickBleed=S=>{S.bleed=S.bleed.filter(b=>{const g=Math.min(S.gold,b.a);S.gold-=g;S.hp=Math.max(0,S.hp-(b.a-g));b.t--;return b.t>0})};

/* one discard per turn; it does not use up the turn */
function discard(i){if(!myMove()||G.disc||!G.hand[i])return;G.disc=true;G.hand.splice(i,1);G.sel=null;draw();pub();renderFooter()}

async function commit(i){if(!myMove())return;const skip=i<0,id=skip?0:G.hand[i],c=skip?null:CARDS[id-1];
 if(!skip&&(!c||c.cost>G.S.mana))return;
 const second=G.r.phase==='react';
 G.locked=true;G.sel=null;
 if(!skip){G.hand.splice(i,1);G.S.mana-=c.cost;
  if(c.disc){const n=c.disc>=9?G.hand.length:Math.min(c.disc,G.hand.length);for(let k=0;k<n;k++)G.hand.splice(Math.random()*G.hand.length|0,1)}
  for(let k=0;k<3&&G.hand.length<3;k++)draw()}
 $('#me-slot').replaceChildren(backEl());syncMe();renderFooter();setMsg(second?'':'WAITING FOR OPPONENT...');
 await wr({['c.'+G.me]:id,phase:second?'resolve':'react',['pub.'+G.me]:pubOf()})}

function reveal(r){const mc=r.c[G.me],oc=r.c[G.opp],seq=r.seq;
 G.flipAt=Date.now()+1000;G.shownAt=0;G.sum='';G.myRes=null;
 $('#me-slot').replaceChildren(backEl());$('#op-slot').replaceChildren(backEl());
 setMsg('');
 /* both cards stay face down for 3s, then flip together */
 setTimeout(()=>{if(!G||G.over||G.rv!==seq)return;
  const put=(id,slot)=>{if(!id){$(slot).replaceChildren(el('div','card skip flip','SKIP'));return}const c=CARDS[id-1],e=cardEl(c,'flip');$(slot).replaceChildren(e);sfx('place');if(c.dmg)setTimeout(()=>sfx('hit'),200)};
  put(mc,'#me-slot');put(oc,'#op-slot');G.shownAt=Date.now();
  setTimeout(()=>doResolve(mc,oc,seq),600)},1000)}

/* Resolves one round for ONE side. S = that side's state, m = card that side played, t = card the other side played.
   Heals are applied first (capped at 20 hearts), then damage, so an attack that gets through can never be erased by a heal. */
function applyRound(S,m,t){const o={back:0,dmgIn:0,took:0,blk:0,cut:0,conv:0};let heals=0,selfLoss=0,hpLoss=0;
 if(m){
  if(m.dmg&&m.heal)heals+=m.heal;
  if(m.shield)S.shield={heal:0,back:m.back||0,t:2};
  else if(m.th)heals+=S.hp<=m.th?m.big:m.small;
  else if(m.rn){heals+=m.heal;S.dots.push({a:m.rn[0],t:m.rn[1]})}
  else if(m.heal&&!m.dmg)heals+=m.heal;
  if(m.red)S.red+=m.red;
  if(m.hpl)selfLoss+=m.hpl;
  if(m.mana){S.mana=Math.min(MM,S.mana+m.mana);S.nm+=m.nm||0}
  if(m.gold)S.gold=Math.min(MG,S.gold+m.gold);
  if(m.vamp)S.vamp=Math.max(S.vamp,m.vamp)}
 if(t){
  if(t.mb)S.mana=Math.max(0,S.mana-t.mb);
  if(t.dmg){let d=t.dmg;o.dmgIn=d;
   if(S.shield){heals+=S.shield.heal;o.back=S.shield.back;S.shield=null;o.blk=1;d=0}
   else{if(S.red){const c=Math.min(S.red,d);d-=c;o.cut+=c;S.red=0}
    if(S.vamp){const cv=Math.min(S.vamp,d);d-=cv;heals+=cv;o.conv=cv;S.vamp=0}
    const g=Math.min(S.gold,d);S.gold-=g;hpLoss=d-g;o.took=d;if(t.pdot)S.bleed.push({a:t.pdot,t:1})}}}
 S.hp=Math.min(20,S.hp+heals);S.hp=Math.max(0,S.hp-selfLoss-hpLoss);
 if(S.shield&&--S.shield.t<=0)S.shield=null   /* an unused shield lasts 2 rounds */
 return o}

function doResolve(mc,oc,seq){if(!G||G.over)return;
 G.pre={hp:G.S.hp,gold:G.S.gold,mana:G.S.mana};
 const o=applyRound(G.S,mc&&CARDS[mc-1],oc&&CARDS[oc-1]);
 G.rd=seq;G.myRes={seq,back:o.back,dmgIn:o.dmgIn,took:o.took,blk:o.blk,cut:o.cut,conv:o.conv};syncMe();
 wr({['res.'+G.me]:G.myRes,['pub.'+G.me]:pubOf()})}

const sideTxt=(who,x)=>!x||!x.dmgIn?'':x.blk?`${who} BLOCKED ${x.dmgIn} DAMAGE`:`${who} TOOK ${x.took} DAMAGE`+(x.cut||x.conv?' ('+[x.cut?x.cut+' PREVENTED':'',x.conv?x.conv+' CONVERTED TO HEARTS':''].filter(Boolean).join(', ')+')':'');
function finish(r){G.fin=r.seq;const ro=r.res[G.opp],b=ro.back;if(b){hitMe(b);syncMe()}
 const P=G.pre||G.S,mine='YOU: HEARTS '+P.hp+' > '+G.S.hp+'   MANA '+P.mana+' > '+G.S.mana+(P.gold!==G.S.gold?'   GOLD '+P.gold+' > '+G.S.gold:'');
 G.sum=[mine,sideTxt('YOU',G.myRes),sideTxt((G.oppName||'OPPONENT').toUpperCase(),ro),b?'SHIELD REFLECTED '+b:''].filter(Boolean).join('\n');
 wr({['fin.'+G.me]:r.seq,['pub.'+G.me]:pubOf()});
 if(G.S.hp<=0)endWrite(G.opp,'hearts')}

/* footer */
function renderFooter(){if(!G||!G.init)return;const f=$('#ftr');f.innerHTML='';
 if(G.sel!=null&&G.hand[G.sel]){const i=G.sel,c=CARDS[G.hand[i]-1];
  const bk=el('button','lav','BACK');bk.onclick=()=>{G.sel=null;renderFooter()};
  const inf=el('div','inf',`<b style="color:${RAR[c.r].c}">${c.name} <em>${RAR[c.r].n.toUpperCase()}</em></b><div>${eff(c)}</div><small>${desc(c)}</small>`);
  const pl=el('button','green',`PLAY <span class="chip">${c.cost}${gem('b')}</span>`);pl.disabled=!canPlay(c);pl.onclick=()=>commit(i);
  const ds=el('button','red',G.disc?'DISCARD USED':'DISCARD');ds.disabled=!(myMove()&&!G.disc);ds.onclick=()=>discard(i);
  f.append(bk,inf,pl,ds);return}
 const hd=el('div','hand');
 for(let i=0;i<3;i++){const id=G.hand[i];
  if(id){const c=CARDS[id-1],e=cardEl(c);if(myMove()&&!canPlay(c))e.classList.add('dim');e.onclick=()=>{G.sel=i;renderFooter()};hd.append(e)}
  else hd.append(el('div','slot ph'))}
 const sk=el('button','lav',G.skipArm&&Date.now()-G.skipArm<2500?'TAP AGAIN':'SKIP TURN');sk.disabled=!myMove();
 sk.onclick=()=>{if(G.skipArm&&Date.now()-G.skipArm<2500){G.skipArm=0;commit(-1)}else{G.skipArm=Date.now();sk.textContent='TAP AGAIN';setTimeout(renderFooter,2600)}};
 f.append(sk,hd);
 const pile=el('div','pile');pile.append(backEl(),el('b','',G.deck.length));f.append(pile)}

/* timers: only the player whose pick it is has a ticking clock; nothing ticks while cards are revealed */
setInterval(()=>{if(!G||G.over||!G.init||!G.r||G.r.status!=='playing')return;
 const now=Date.now(),dt=now-G.last;G.last=now;const r=G.r,m=mover(r);
 if(m){const k=m===G.me?'me':'op';if(!G.bot){G.clk[k]-=dt;if(G.clk[k]<=0)endWrite(k==='me'?G.opp:G.me,'time')}
  if(k==='me'&&now-(G.lastPub||0)>1500){G.lastPub=now;pub()}
  if(k==='op'&&!G.bot&&now-(G.opSeen||now)>30000)endWrite(G.me,'disconnect')}
 $('#me-clk b').textContent=G.bot?'\u221e':fmt(G.clk.me);$('#op-clk b').textContent=G.bot?'\u221e':fmt(G.clk.op);
 $('#me-clk').classList.toggle('act',m===G.me);$('#op-clk').classList.toggle('act',m===G.opp);
 if(r.phase==='resolve'){
  if(now<G.flipAt)setMsg(`CARDS REVEAL IN ${Math.ceil((G.flipAt-now)/1000)}`);
  else if(G.shownAt)setMsg((G.sum?G.sum+'\n':'')+`NEXT TURN IN ${Math.max(0,Math.ceil((G.shownAt+4000-now)/1000))}`)}
},250);

/* forfeit */
(()=>{const b=$('#forfeit'),u=$('u',b);let t=null;
 const stop=()=>{clearTimeout(t);u.style.transition='none';u.style.width='0'};
 b.onpointerdown=()=>{if(!G||G.over)return;u.style.transition='width 3s linear';u.style.width='100%';t=setTimeout(()=>{stop();if(G&&!G.over)endWrite(G.opp,'forfeit')},3000)};
 ['pointerup','pointerleave','pointercancel'].forEach(e=>b.addEventListener(e,stop))})();

/* end */
async function endWrite(winner,reason){if(!G||G.over)return;
 if(G.bot){if(G.bot.room.status!=='done')botWrite({status:'done',winner,reason});return}
 if(!G.ref)return;
 try{await runTransaction(db,async t=>{const s=await t.get(G.ref);if(!s.exists()||s.data().status==='done')return;t.update(G.ref,{status:'done',winner,reason})})}catch(e){}}
function endGame(r){if(G.over)return;G.over=true;G.unsub&&G.unsub();const won=r.winner===G.me,who=won?G.oppName:'You';
 const txt={time:'ran out of time',forfeit:'forfeited','hearts':'lost all hearts',disconnect:'disconnected'}[r.reason]||'lost';
 modal(`<h2 class="${won?'win':'lose'}">${won?'VICTORY':'DEFEAT'}</h2><p>${who} ${txt}.</p><button class="blue" id="bk">CONTINUE</button>`);
 $('#bk').onclick=async()=>{closeModal();G=null;show('s-menu');goTab('play');await loadU();updateLock()};
 saveStats(won,G.t0)}
async function saveStats(won,t0){try{const ref=doc(db,'splendid_users',user.uid),d=(await getDoc(ref)).data();
 const streak=won?(d.streak||0)+1:0;
 await setDoc(ref,{wins:(d.wins||0)+(won?1:0),losses:(d.losses||0)+(won?0:1),streak,best:Math.max(d.best||0,streak),matches:(d.matches||0)+1,rate:Math.round(((d.wins||0)+(won?1:0))/((d.matches||0)+1)*100),time:(d.time||0)+Math.round((Date.now()-t0)/1000)},{merge:true})}catch(e){}}


/* =====================================================================
   BOT MODE  -  fully local, zero Firestore traffic until the fight ends
   The bot is a second "client" that talks to a fake room object. Everything the
   human client does (wr(), onRoom(), timers, reveal) runs unchanged on that fake room.
   The bot only uses what a human also sees: the public gems (hearts/hearts-shield/mana, pile
   counts) and cards that were revealed in earlier rounds. It never reads your hand, your deck,
   or the card you committed before the reveal.
   ===================================================================== */
const BOT={think:[1100,2600],   // ms of "thinking" before it commits
 mistake:.12,                   // chance to take its 2nd best option (set 0 for a ruthless bot)
 noise:.5};                     // random wobble on scores so it isn't perfectly predictable
const BOT_NAMES=['Cinder','Onyx','Vesper','Gloam','Rune','Ashen'];
const cl=o=>structuredClone(o);
const live=B=>!!(G&&G.bot===B&&!G.over);
const newSide=()=>({hp:20,gold:0,mana:4,shield:null,vamp:0,red:0,dots:[],bleed:[],nm:0});
const sideStart=S=>{S.mana=Math.min(MM,S.mana+1+S.nm);S.nm=0;S.dots=S.dots.filter(d=>{S.hp=Math.min(20,S.hp+d.a);d.t--;return d.t>0});tickBleed(S)};
const sideHit=(S,d)=>{const g=Math.min(S.gold,d);S.gold-=g;S.hp=Math.max(0,S.hp-(d-g))};
function setPath(o,k,v){const p=k.split('.');let x=o;for(let i=0;i<p.length-1;i++)x=x[p[i]]=x[p[i]]||{};x[p[p.length-1]]=v}

/* the fake Firestore: apply the patch, then let both "clients" react, like onSnapshot would */
function botWrite(p){const B=G&&G.bot;if(!B)return;for(const k in p)setPath(B.room,k,p[k]);
 setTimeout(()=>{if(!live(B))return;onRoom(cl(B.room));botTick()},0)}

function makeBotDeck(){const W={ATTACK:4,HEAL:3.2,'MANA HEAL':1.6,SPELL:2.4},RW=[1.2,1.4,1,.7];const d=[];let n=0;
 const add=c=>{d.push(c.id);n+=RAR[c.r].node};
 const seed=(f,k)=>{for(let i=0;i<k;i++){const p=CARDS.filter(c=>f(c)&&c.r<=2&&!d.includes(c.id));add(p[Math.random()*p.length|0])}};
 seed(c=>c.type==='ATTACK',3);seed(c=>c.type==='HEAL',2);seed(c=>c.name==='Focus',1);
 while(n<MAXN){const p=CARDS.filter(c=>!d.includes(c.id)&&n+RAR[c.r].node<=MAXN);
  let x=Math.random()*p.reduce((a,c)=>a+W[c.type]*RW[c.r],0),pick=p[p.length-1];
  for(const c of p){x-=W[c.type]*RW[c.r];if(x<=0){pick=c;break}}add(pick)}
 return d}

function startBot(){const all=makeBotDeck(),name=BOT_NAMES[Math.random()*BOT_NAMES.length|0]+' [BOT]';
 G=newG('BOT');G.ref=null;
 const room={code:'BOT',status:'playing',host:{uid:user.uid,name:U.name},guest:{uid:'bot',name},turn:Math.random()<.5?user.uid:'bot',seq:1,phase:'act',pub:{},c:{},res:{},fin:{}};
 const B=G.bot={room,S:newSide(),O:newSide(),all,deck:shuffle(all),hand:[],seen:{},a:0,mk:null,rv:0,rd:0,fin:0,st:0,disc:false,oppEnd:4};
 for(let i=0;i<3;i++)bDraw();
 room.pub.bot=botPub();
 onRoom(cl(room));botTick()}

const bDraw=()=>{const B=G.bot;if(B.hand.length>=3)return;if(!B.deck.length)B.deck=shuffle(B.all.filter(id=>!B.hand.includes(id)));
 if(B.deck.length){B.hand.push(B.deck.pop());if(!B.deck.length)B.deck=shuffle(B.all.filter(id=>!B.hand.includes(id)))}};
const botPub=()=>{const B=G.bot;return{fx:fxTxt(B.S),hp:B.S.hp,gold:B.S.gold,mana:B.S.mana,deck:B.deck.length,hand:B.hand.length,clock:Math.max(0,Math.round(G.clk.op))}};
const syncO=()=>{const B=G.bot,o=B.room.pub[G.me];if(o){B.O.hp=o.hp;B.O.gold=o.gold;B.O.mana=o.mana}};

/* the bot's side of the round loop (mirrors onRoom) */
function botTick(){const B=G&&G.bot;if(!B||G.over)return;const r=B.room;if(r.status!=='playing')return;const hu=G.me;
 if(r.phase==='act'&&B.a!==r.seq){B.a=r.seq;sideStart(B.S);sideStart(B.O);wr({['pub.bot']:botPub()});if(B.S.hp<=0){endWrite(G.me,'hearts');return}}
 const m=r.phase==='act'?r.turn:r.phase==='react'?(r.turn==='bot'?hu:'bot'):null,mk=r.seq+':'+r.phase;
 if(m==='bot'&&B.mk!==mk){B.mk=mk;B.disc=false;
  setTimeout(()=>{if(live(B)&&B.mk===mk)botAct()},BOT.think[0]+Math.random()*(BOT.think[1]-BOT.think[0]))}
 if(r.phase==='resolve'&&B.rv!==r.seq){B.rv=r.seq;botReveal(r)}
 if(r.phase==='resolve'&&B.rd===r.seq&&B.fin!==r.seq&&r.res[hu]&&r.res[hu].seq===r.seq)botFinish(r);
 if(r.phase==='resolve'&&r.turn==='bot'&&B.st!==r.seq&&r.fin&&r.fin.bot===r.seq&&r.fin[hu]===r.seq){B.st=r.seq;const seq=r.seq,wait=Math.max(0,(G.shownAt||Date.now())+4000-Date.now());
  setTimeout(()=>{if(live(B))wr({seq:seq+1,phase:'act',c:{},res:{},fin:{}})},wait)}}

function botReveal(r){const B=G.bot,seq=r.seq,bc=r.c.bot,hc=r.c[G.me];
 syncO();if(hc)B.seen[hc]=(B.seen[hc]||0)+1;
 setTimeout(()=>{if(!live(B)||B.rv!==seq)return;
  const bk=bc&&CARDS[bc-1],hk=hc&&CARDS[hc-1];
  const rb=applyRound(B.S,bk,hk);applyRound(B.O,hk,bk);if(rb.back)sideHit(B.O,rb.back);
  B.rd=seq;B.oppEnd=B.O.mana;
  wr({['res.bot']:{seq,back:rb.back,dmgIn:rb.dmgIn,took:rb.took,blk:rb.blk,cut:rb.cut,conv:rb.conv},['pub.bot']:botPub()})},1600)}

function botFinish(r){const B=G.bot;B.fin=r.seq;const h=r.res[G.me];if(h&&h.back)sideHit(B.S,h.back);
 wr({['fin.bot']:r.seq,['pub.bot']:botPub()});if(B.S.hp<=0)endWrite(G.me,'hearts')}

/* ---- decision making ---- */
/* what could the human play? every card they can afford, weighted by what the bot has seen and by their situation */
function oppDist(mana){const B=G.bot,O=B.O,out=[],RW=[1,1,.75,.5];
 CARDS.forEach(c=>{if(c.cost>mana)return;let w=RW[c.r];const sn=B.seen[c.id]||0;if(sn)w*=3+Math.min(sn,3);
  if(c.type==='ATTACK')w*=mana>=2?1.5:1;
  else if(c.type==='HEAL')w*=O.hp<=10?2.2:O.hp>=17?.15:.7;
  else if(c.hpl)w*=O.hp<=8?.1:mana<=2?2:.6;
  else if(c.type==='MANA HEAL')w*=mana<=2?2.2:.5;
  out.push({t:c,w})});
 out.push({t:null,w:mana<=1?2:.3});return out}

/* how good is a board for the bot (higher = better) */
function botEval(a,b){
 if(a.hp<=0&&b.hp<=0)return -300;if(b.hp<=0)return 1000;if(a.hp<=0)return -1000;
 const hv=x=>x.hp+.85*x.gold,mv=m=>.8*Math.min(m,4)+.1*m;
 const pot=x=>-x.bleed.reduce((s,b)=>s+b.a*.9,0)+(x.shield?2.2:0)+Math.min(x.vamp,6)*.45+x.red*.7+x.dots.reduce((s,d)=>s+d.a*d.t*.8,0);
 const wa=1+Math.max(0,9-a.hp)*.14,wb=1+Math.max(0,8-b.hp)*.08;   // own hearts matter more when low, kill pressure when you're low
 return wa*hv(a)-wb*hv(b)+mv(a.mana)-.9*mv(b.mana)+pot(a)-pot(b)}

/* score every playable card + skipping: simulate the round against each card you might play */
function botOptions(){const B=G.bot,S=B.S;syncO();
 const om=Math.max(B.O.mana,Math.min(MM,B.oppEnd+1)),dist=oppDist(om),opts=[];   // assume you could have up to this much mana
 const ev=m=>{const vals=[];let W=0;
  dist.forEach(({t,w})=>{const a=cl(S),b=cl(B.O);b.mana=om;if(m)a.mana-=m.cost;if(t)b.mana-=t.cost;
   const ra=applyRound(a,m,t),rb=applyRound(b,t,m);if(rb.back)sideHit(a,rb.back);if(ra.back)sideHit(b,ra.back);
   vals.push([botEval(a,b),w]);W+=w});
  vals.sort((x,y)=>x[0]-y[0]);let mean=0,tail=0,tw=0,acc=0;
  vals.forEach(([v,w])=>{mean+=v*w/W;if(acc<W*.25){const u=Math.min(w,W*.25-acc);tail+=v*u;tw+=u;acc+=u}});
  return .75*mean+.25*(tail/tw)};   // mostly the average case, a bit of fear for your best plays
 opts.push({i:-1,s:ev(null)});
 B.hand.forEach((id,i)=>{const c=CARDS[id-1];if(c.cost<=S.mana)opts.push({i,s:ev(c)-(c.disc?Math.min(c.disc>=9?2:c.disc,B.hand.length-1)*.5:0)})});
 return opts.sort((x,y)=>y.s-x.s)}

/* discard (max once per turn) only when the hand is weak: a card it can't afford first, else its worst card */
function botDiscardPick(opts){const B=G.bot,best=opts[0],skip=opts.find(o=>o.i<0);
 if(best.s>=900||(best.i>=0&&best.s-skip.s>=1.2))return -1;
 const dead=B.hand.map((id,i)=>({i,c:CARDS[id-1]})).filter(x=>x.c.cost>B.S.mana).sort((x,y)=>y.c.cost-x.c.cost);
 if(dead.length)return dead[0].i;
 const cards=opts.filter(o=>o.i>=0&&o.i!==best.i);return cards.length?cards[cards.length-1].i:-1}

function botChoose(opts){opts.forEach(o=>o.s+=(Math.random()-.5)*BOT.noise);opts.sort((x,y)=>y.s-x.s);
 return opts[0].s<900&&opts.length>1&&Math.random()<BOT.mistake&&opts[0].s-opts[1].s<5?opts[1]:opts[0]}

function botAct(){const B=G.bot;if(!live(B))return;const mk=B.mk,opts=botOptions();
 if(!B.disc){const d=botDiscardPick(opts);
  if(d>=0){B.disc=true;B.hand.splice(d,1);bDraw();wr({['pub.bot']:botPub()});
   setTimeout(()=>{if(live(B)&&B.mk===mk)botAct()},700);return}}
 botCommit(botChoose(opts))}

function botCommit(sel){const B=G.bot,second=B.room.phase==='react';let id=0;
 if(sel.i>=0){id=B.hand[sel.i];const c=CARDS[id-1];B.S.mana-=c.cost;B.hand.splice(sel.i,1);
  if(c.disc){const n=c.disc>=9?B.hand.length:Math.min(c.disc,B.hand.length);for(let k=0;k<n;k++)B.hand.splice(Math.random()*B.hand.length|0,1)}
  for(let k=0;k<3&&B.hand.length<3;k++)bDraw()}
 wr({['c.bot']:id,phase:second?'resolve':'react',['pub.bot']:botPub()})}
