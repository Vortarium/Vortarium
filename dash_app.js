import{initializeApp}from"https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import{getAuth,onAuthStateChanged,signInWithEmailAndPassword as si,createUserWithEmailAndPassword as su,signOut}from"https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import{getFirestore,doc,getDoc,setDoc,updateDoc,addDoc,deleteDoc,collection,getDocs,query,orderBy,limit,where,increment,arrayUnion}from"https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import{getStorage,ref,uploadBytes,getDownloadURL}from"https://www.gstatic.com/firebasejs/13.0.0/firebase-storage.js";
const app=initializeApp({apiKey:"AIzaSyAlQ0fG9UUgyFFdwlKlTb0p2nbeoJkc3ig",authDomain:"dash-da809.firebaseapp.com",projectId:"dash-da809",storageBucket:"dash-da809.firebasestorage.app",messagingSenderId:"463073446480",appId:"1:463073446480:web:d939f6448a8391dcfa9f55"});
const auth=getAuth(app),db=getFirestore(app),st=getStorage(app),$=s=>document.querySelector(s),ui=$('#ui'),bar=$('#bar'),cv=$('#c'),g=cv.getContext('2d');
const COL=['#4de1ff','#ff4d8d','#8dff4d','#ffd84d','#b04dff','#ff8a4d','#4dffb8','#ffffff','#ff4d4d','#4d6bff'],RN=['Easy','Medium','Hard','Insane','Demon'];
let me=null,uid=null,L=null,G=null,ED=null,U=40,pg=0,cache=[],[sk,col,c2,shp]=JSON.parse(localStorage.dcs||'[0,0,1,0]'),S={m:1,s:1},keys={};
const au=n=>new Audio('dash_'+n+'.mp3'),mus=au('music'),edm=au('editor'),die=au('die'),win=au('win');mus.loop=edm.loop=true;
const snd=a=>{if(S.s){a.currentTime=0;a.play().catch(()=>{})}},bgm=a=>{mus.pause();edm.pause();if(S.m&&a)a.play().catch(()=>{})};
const show=h=>{G?.au?.pause();G=null;bar.classList.add('off');ui.classList.remove('off');ui.innerHTML=h};
const foot=()=>$('#ft').innerHTML=`${me?me.name+M(me.name):'Anonymous'}   ★ ${me?.stars||0}   💎 ${me?.crystals||0}   👍 ${me?.likes||0}   ✔ ${me?.beaten||0}   😈 ${me?.demons||0}`;
const load=async()=>{me=uid?(await getDoc(doc(db,'users',uid))).data()||null:null;foot()};
onAuthStateChanged(auth,async u=>{if(u&&(await getDoc(doc(db,'bans',u.uid))).exists()){alert('This account is banned');await signOut(auth);return}uid=u?.uid||null;await load();pingCk();act.menu()});
addEventListener('pointerdown',()=>{if(mus.paused&&!G&&!ui.classList.contains('off'))bgm(mus)},{once:true});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';'),lvl=d=>({id:d.id,...d.data(),name:esc(d.data().name),author:esc(d.data().author),desc:esc(d.data().desc)});
const AC=[[0,0],...[['beaten',[1,3,5,8,12,18,25,35,50]],['stars',[3,8,15,25,40,60,90,130,200]],['likes',[1,3,5,10,20,40,80,150]],['demons',[1,2,4,7,12]],['views',[10,50,150,500]]].flatMap(([k,a])=>a.map(n=>[k,n]))];
const unl=i=>i==0||(me&&me[AC[i][0]]>=AC[i][1]);
function skin(c,i,z,a,b){const h=z/2,p=i%6,f=i/6|0;c.fillStyle=a;c.fillRect(-h,-h,z,z);c.fillStyle=b;
if(p==1)c.fillRect(-h,-h/4,z,h/2);if(p==2){c.beginPath();c.moveTo(-h,h);c.lineTo(h,-h);c.lineTo(h,-h/3);c.lineTo(-h/3,h);c.fill()}if(p==3){c.fillRect(-h,-h,h,h);c.fillRect(0,0,h,h)}if(p==4){c.fillRect(-h,-h,z,h/4);c.fillRect(-h,h*.75,z,h/4)}if(p==5){c.fillRect(-h/6,-h,h/3,z);c.fillRect(-h,-h/6,z,h/3)}
c.fillStyle='#111';[()=>{c.fillRect(-h*.5,-h*.4,h*.28,h*.4);c.fillRect(h*.22,-h*.4,h*.28,h*.4)},()=>c.fillRect(-h*.6,-h*.4,h*1.2,h*.3),()=>{c.fillRect(-h*.5,-h*.5,h*.3,h*.3);c.fillRect(h*.2,-h*.2,h*.3,h*.3)},()=>{c.beginPath();c.arc(-h*.3,-h*.2,h*.15,0,7);c.arc(h*.3,-h*.2,h*.15,0,7);c.fill()},()=>{c.fillRect(-h*.5,-h*.3,h,h*.12);c.fillRect(-h*.5,h*.1,h,h*.12)},()=>{c.beginPath();c.arc(0,0,h*.3,0,7);c.fill()}][f]();
c.strokeStyle='#fff';c.lineWidth=2;c.strokeRect(-h,-h,z,z)}
const sImg=i=>{const c=document.createElement('canvas');c.width=c.height=48;const x=c.getContext('2d');x.translate(24,24);skin(x,i,40,COL[col],COL[c2]);return c.toDataURL()};
const AS=[[0,0],...[['beaten',[2,4,7,10,15,22,32]],['stars',[5,12,22,35,55,85,130]],['likes',[2,5,10,20,40,80]],['demons',[1,3,5,8,13]],['rated',[1,2,4,7]]].flatMap(([k,a])=>a.map(n=>[k,n]))];
const unlS=i=>i==0||(me&&me[AS[i][0]]>=AS[i][1]);
function ship(c,i,z,a,b){const h=z/2,p=i%5,f=i/5|0;c.fillStyle=a;c.beginPath();
[()=>{c.moveTo(-h,h*.3);c.lineTo(h*1.1,h*.1);c.lineTo(h*.6,h*.7);c.lineTo(-h*.8,h*.7)},()=>{c.moveTo(-h,h*.6);c.lineTo(-h*.4,h*.1);c.lineTo(h*1.1,h*.3);c.lineTo(h*.4,h*.8);c.lineTo(-h*.7,h*.8)},()=>{c.moveTo(-h,h*.7);c.lineTo(-h*.2,h*.05);c.lineTo(h*1.2,h*.45);c.lineTo(h*.2,h*.8)},()=>{c.moveTo(-h*.9,h*.4);c.lineTo(h*1.1,h*.2);c.lineTo(h*1.1,h*.6);c.lineTo(-h*.9,h*.8)},()=>{c.arc(0,h*.45,h*.95,Math.PI,0);c.lineTo(h*.95,h*.7);c.lineTo(-h*.95,h*.7)}][p]();c.fill();
c.fillStyle=b;[()=>c.fillRect(-h*.6,h*.4,h*1.2,h*.12),()=>c.fillRect(-h,h*.15,h*.3,h*.5),()=>{c.beginPath();c.arc(h*.4,h*.45,h*.14,0,7);c.fill()},()=>c.fillRect(h*.6,h*.2,h*.4,h*.1),()=>{c.beginPath();c.moveTo(-h*.8,h*.7);c.lineTo(-h*1.1,h);c.lineTo(-h*.4,h*.7);c.fill()},()=>{c.fillRect(-h*.2,h*.25,h*.12,h*.5);c.fillRect(h*.15,h*.25,h*.12,h*.5)}][f]();
c.save();c.translate(0,-h*.15);skin(c,sk,z*.55,a,b);c.restore()}
const sImg2=i=>{const c=document.createElement('canvas');c.width=64;c.height=48;const x=c.getContext('2d');x.translate(32,24);ship(x,i,36,COL[col],COL[c2]);return c.toDataURL()};
const sw=(k,j,c,on)=>`<button data-a=pick data-v=${k}:${j} ${on?'':'disabled'} style="background:${c};width:40px;height:40px;min-width:0;padding:0;color:#000">${on?(k=='c1'?col:c2)==j?'✓':'':'🔒'}</button>`;
let pv,PU,CH,PING=-1;const M=n=>n=='vortarium'?' <span class=mod>M</span>':'';
const uIcon=u=>{const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d');x.translate(16,16);skin(x,u.sk|0,26,COL[u.c1|0],COL[u.c2??1]);return`<img src=${c.toDataURL()} width=24 height=24 style="vertical-align:middle">`};
const pingCk=async()=>{if(me?.name!='vortarium'){PING=-1;return}const n=(await getDocs(query(collection(db,'levels'),where('rating','==',0),limit(50)))).size;if(PING>=0&&n>PING)alert('A new level is waiting for a rating');PING=n;const b=ui.querySelector('button[data-a=comm]');if(b&&b.textContent.startsWith('Community'))b.textContent='Community'+(n?` 🔔${n}`:'')};setInterval(pingCk,6e4);
const FN={},pid=(a,b)=>[a,b].sort().join('_');
const sa=m=>{const a=new Audio(m.url);a.playbackRate=m.speed||1;a.onloadedmetadata=()=>a.currentTime=(m.off||0)/1000;a.play().catch(()=>{});return a};
const rd=()=>{if(ED.song&&$('#so'))ED.song.off=Math.max(0,+$('#so').value||0)};
const cut=()=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour12:false,hour:'numeric',minute:'numeric',second:'numeric'}).formatToParts(new Date()).map(x=>[x.type,x.value]));return Date.now()-(((+p.hour)%24)*3600+p.minute*60+ +p.second)*1000};
const cred=()=>[$('#u').value.trim().toLowerCase().replace(/[^a-z0-9_]/g,''),$('#p').value];
const act={
menu:()=>{bgm(mus);show(`<h1>DASH</h1><div class=row><button data-a=acct>Account</button><button data-a=comm>Community${PING>0?` 🔔${PING}`:''}</button></div><button data-a=cos>Cosmetics</button>`)},
acct:()=>show(`<h2>${me?me.name+M(me.name):'Anonymous'}</h2>${uid?'':'<input id=u placeholder=Username><input id=p type=password placeholder=Password><div class=row><button data-a=login>Log in</button><button data-a=sign>Sign up</button></div>'}<div class=row><button data-a=tm>Music: ${S.m?'On':'Off'}</button><button data-a=ts>SFX: ${S.s?'On':'Off'}</button></div>${uid?'<button data-a=out>Log out</button>':''}<button data-a=menu>Back</button>`),
tm:()=>{S.m^=1;bgm(S.m?mus:null);act.acct()},ts:()=>{S.s^=1;act.acct()},
login:async()=>{const[n,p]=cred();try{await si(auth,n+'@dash.game',p)}catch(e){alert('Log in failed: '+e.code)}},
sign:async()=>{const[n,p]=cred();if(n.length<3)return alert('Username needs 3+ letters or numbers');try{await su(auth,n+'@dash.game',p);uid=auth.currentUser.uid;await setDoc(doc(db,'users',uid),{name:n,stars:0,likes:0,beaten:0,demons:0,crystals:0,done:[]});await load();act.menu()}catch(e){alert('Sign up failed: '+e.code+' (password needs 6+ characters)')}},
out:async()=>{await signOut(auth)},
cos:()=>show(`<h2>Cosmetics</h2><div class=row style="max-width:620px">${[...Array(36)].map((_,i)=>unl(i)?`<button data-a=pick data-v=sk:${i} style="min-width:0;padding:4px;${i==sk?'border-color:#fff':''}"><img src=${sImg(i)}></button>`:`<button disabled style="min-width:0;padding:6px;font-size:12px">🔒<br>${AC[i][1]} ${AC[i][0]}</button>`).join('')}</div><p>Ships</p><div class=row style="max-width:620px">${[...Array(30)].map((_,i)=>unlS(i)?`<button data-a=pick data-v=sh:${i} style="min-width:0;padding:4px;${i==(shp|0)?'border-color:#fff':''}"><img src=${sImg2(i)}></button>`:`<button disabled style="min-width:0;padding:6px;font-size:12px">🔒<br>${AS[i][1]} ${AS[i][0]}</button>`).join('')}</div><p>Primary color</p><div class=row>${COL.map((c,j)=>sw('c1',j,c,j<=(me?.beaten||0))).join('')}</div><p>Secondary color</p><div class=row>${COL.map((c,j)=>sw('c2',j,c,j<=(me?.stars||0)/2)).join('')}</div><button data-a=menu>Back</button>`),
pick:v=>{const[k,n]=v.split(':');if(k=='sk')sk=+n;if(k=='sh')shp=+n;if(k=='c1')col=+n;if(k=='c2')c2=+n;localStorage.dcs=JSON.stringify([sk,col,c2,shp]);if(uid)updateDoc(doc(db,'users',uid),{sk,c1:col,c2,shp}).catch(()=>{});act.cos()},
comm:()=>show(`<h2>Community</h2><div class=row><button data-a=edl>Editor</button><button data-a=list data-v=1>Stars</button></div><div class=row><button data-a=list data-v=0>New levels</button><button data-a=lb data-v=stars>Leaderboards</button></div><button data-a=menu>Back</button>`),
list:async v=>{L={m:+v};const s=await getDocs(query(collection(db,'levels'),orderBy('ts','desc'),limit(200)));cache=s.docs.map(lvl).filter(l=>L.m?l.rating>0:!l.rating);act.pg(0)},
pg:n=>{pg=+n;const m=L?.m??0,p=cache.slice(pg*10,pg*10+10);show(`<h2>${m?'Rated levels':'New levels'}</h2>${p.map(l=>`<button data-a=lv data-v=${l.id}>${l.name} by ${l.author}${M(l.author)} · ${l.rating?l.rating+'★':'unrated'} · ${l.likes}👍</button>`).join('')||'<p>No levels yet</p>'}<div class=row>${pg?`<button data-a=pg data-v=${pg-1}>Prev</button>`:''}${cache.length>pg*10+10?`<button data-a=pg data-v=${pg+1}>Next</button>`:''}</div><button data-a=comm>Back</button>`)},
lv:id=>{L=cache.find(l=>l.id==id)||L;const b=+localStorage['b'+L.id]||0,mod=me?.name=='vortarium',has=L.song&&(localStorage['dl'+L.id]||me?.dl?.includes(L.id));show(`<h2>${L.name}</h2><p>by ${L.author}${M(L.author)} · ${L.rating?RN[L.rating-1]+' '+L.rating+'★':'Unrated'}</p><p>${L.desc||''}</p><div class=pb><i style="width:${b}%"></i></div><p>Best ${b}% · 👁 ${L.views} · ${L.likes} likes</p>${L.song?(has?`<p>♪ ${esc(L.song.name)}</p>`:`<button data-a=dl>Download song: ${esc(L.song.name)}</button>`):''}<button data-a=play>Play</button><div class=row><button data-a=vt data-v=1>Like</button><button data-a=vt data-v=-1>Dislike</button></div>${mod?`<div class=row>${RN.map((n,i)=>`<button data-a=rate data-v=${i+1}>${n}</button>`).join('')}<button data-a=down>Take down</button></div>`:''}<input id=ct placeholder=Comment maxlength=200><button data-a=post>Post</button><div class=sc id=cm></div><button data-a=back>Back</button>`);act.cm()},
back:()=>act.pg(pg),
vt:async v=>{if(!uid)return alert('Log in to like or dislike');v=+v;const r=doc(db,'levels',L.id,'votes',uid),s=await getDoc(r),o=s.exists()?s.data().v:0;if(o==v)return;await setDoc(r,{v});await updateDoc(doc(db,'levels',L.id),{likes:increment(v-o)});await updateDoc(doc(db,'users',L.aid),{likes:increment(v-o)}).catch(()=>{});L.likes+=v-o;act.lv(L.id)},
rate:async v=>{if(!L.rating)await updateDoc(doc(db,'users',L.aid),{rated:increment(1)}).catch(()=>{});await updateDoc(doc(db,'levels',L.id),{rating:+v});L.rating=+v;act.lv(L.id)},
down:async()=>{await deleteDoc(doc(db,'levels',L.id));cache=cache.filter(l=>l.id!=L.id);act.pg(0)},
play:()=>{updateDoc(doc(db,'levels',L.id),{views:increment(1)}).catch(()=>{});L.views++;if(uid&&L.aid!=uid)updateDoc(doc(db,'users',L.aid),{views:increment(1)}).catch(()=>{});start(JSON.parse(L.data),'play',L.song&&(localStorage['dl'+L.id]||me?.dl?.includes(L.id))?L.song:null)},
lb:async k=>{const s=await getDocs(query(collection(db,'users'),orderBy(k,'desc'),limit(100)));show(`<h2>Top 100: ${k}</h2><div class=row>${['stars','likes','beaten','demons'].map(x=>`<button data-a=lb data-v=${x}>${x}</button>`).join('')}</div><button data-a=fr>Friends</button><div class=sc>${s.docs.map((d,i)=>`<button data-a=prof data-v=${d.id} style="min-width:0;padding:4px 12px;margin:2px 0;display:block">#${i+1} ${uIcon(d.data())} ${esc(d.data().name)}${M(d.data().name)} — ${d.data()[k]||0}</button>`).join('')}</div><button data-a=comm>Back</button>`)},
cm:async()=>{const s=await getDocs(query(collection(db,'levels',L.id,'comments'),orderBy('ts','desc'),limit(30))),el=$('#cm'),mod=me?.name=='vortarium';if(el)el.innerHTML=s.docs.map(d=>`<p><b>${esc(d.data().name)}${M(d.data().name)}</b>: ${esc(d.data().text)} ${mod?`<button data-a=dc data-v=${d.id} style="min-width:0;padding:0 8px">x</button>`:''}</p>`).join('')||'<p>No comments yet</p>'},
post:async()=>{if(!uid)return alert('Log in to comment');const t=$('#ct').value.trim().slice(0,200);if(!t)return;await addDoc(collection(db,'levels',L.id,'comments'),{uid,name:me.name,text:t,ts:Date.now()});act.lv(L.id)},
dc:async v=>{await deleteDoc(doc(db,'levels',L.id,'comments',v));act.cm()},
prof:async v=>{const u=(await getDoc(doc(db,'users',v))).data();if(!u)return;PU={id:v,name:u.name};const s=await getDocs(query(collection(db,'levels'),where('aid','==',v)));cache=s.docs.map(lvl);L={m:0};pg=0;show(`<h2>${uIcon(u)} ${esc(u.name)}${M(u.name)}</h2><p>★ ${u.stars} · 💎 ${u.crystals} · 👍 ${u.likes} · ✔ ${u.beaten} · 😈 ${u.demons}</p>${cache.map(l=>`<button data-a=lv data-v=${l.id}>${l.name} · ${l.rating?l.rating+'★':'unrated'} · ${l.likes}👍</button>`).join('')||'<p>No published levels</p>'}${uid&&v!=uid?`<button data-a=addf>Add friend</button>`:''}${me?.name=='vortarium'&&v!=uid?`<button data-a=ban data-v=${v}>Ban account</button>`:''}<button data-a=lb data-v=stars>Back</button>`)},
addf:async()=>{try{await setDoc(doc(db,'requests',pid(uid,PU.id)),{from:uid,to:PU.id,fromName:me.name,toName:PU.name,status:'pending'});alert('Friend request sent')}catch(e){alert('A request with this player already exists')}},
fr:async()=>{if(!uid)return alert('Log in to use friends');const q=w=>getDocs(query(collection(db,'requests'),where(w,'==',uid))),[a,b]=await Promise.all([q('from'),q('to')]),all=[...a.docs,...b.docs].map(d=>({id:d.id,...d.data()})),inbox=all.filter(r=>r.to==uid&&r.status=='pending'),fl=all.filter(r=>r.status=='accepted');
fl.forEach(r=>{FN[r.from==uid?r.to:r.from]=r.from==uid?r.toName:r.fromName});
show(`<h2>Friends</h2><h3>Inbox</h3>${inbox.map(r=>`<div class=row><span>${esc(r.fromName)}</span><button data-a=acc data-v=${r.id}>Accept</button><button data-a=dec data-v=${r.id}>Decline</button></div>`).join('')||'<p>No requests</p>'}<h3>Friends</h3>${fl.map(r=>{const o=r.from==uid?r.to:r.from;return`<button data-a=chat data-v=${o}>${esc(FN[o])}</button>`}).join('')||'<p>No friends yet</p>'}<button data-a=lb data-v=stars>Back</button>`)},
acc:async v=>{await updateDoc(doc(db,'requests',v),{status:'accepted'});act.fr()},
dec:async v=>{await deleteDoc(doc(db,'requests',v));act.fr()},
chat:v=>{CH={id:pid(uid,v),n:FN[v]||'Friend'};act.cr()},
cr:async()=>{const s=await getDocs(query(collection(db,'dms',CH.id,'msgs'),orderBy('ts','asc'),limit(100))),t=cut();s.docs.filter(d=>d.data().ts<t).forEach(d=>deleteDoc(d.ref).catch(()=>{}));show(`<h2>${esc(CH.n)}</h2><div class=sc>${s.docs.filter(d=>d.data().ts>=t).map(d=>`<p><b>${esc(d.data().name)}</b>: ${esc(d.data().text)}</p>`).join('')||'<p>No messages today</p>'}</div><input id=mt maxlength=300 placeholder=Message><div class=row><button data-a=snd>Send</button><button data-a=cr>Refresh</button></div><p>Chats clear every day at 12am Eastern</p><button data-a=fr>Back</button>`)},
snd:async()=>{const t=$('#mt').value.trim();if(!t)return;await addDoc(collection(db,'dms',CH.id,'msgs'),{from:uid,name:me.name,text:t,ts:Date.now()});act.cr()},
ban:async v=>{if(!confirm('Ban this account and delete its levels?'))return;const s=await getDocs(query(collection(db,'levels'),where('aid','==',v)));await Promise.all(s.docs.map(d=>deleteDoc(d.ref)));await setDoc(doc(db,'bans',v),{ts:Date.now()});await deleteDoc(doc(db,'users',v));act.lb('stars')},
edl:async()=>{if(!uid)return alert('Log in to create levels');const ds=await Promise.all([...Array(20)].map((_,i)=>getDoc(doc(db,'drafts',uid+'_'+i))));show(`<h2>My levels</h2><div class=row style="max-width:480px">${ds.map((d,i)=>`<button data-a=ed data-v=${i}>${d.exists()?d.data().name:'+ New '+(i+1)}</button>`).join('')}</div><button data-a=comm>Back</button>`)},
ed:async i=>{i=+i;const d=await getDoc(doc(db,'drafts',uid+'_'+i)),x=d.data();ED={mode:'edit',i,name:x?.name||'Level '+(i+1),desc:x?.desc||'',o:x?JSON.parse(x.data):[],song:x?.song||null,beaten:!!x?.beaten,tool:'b',cam:-1,r:0,v:0,gp:0,sel:new Set,h:[0,0]};bar.innerHTML=[['sel','Select'],['b','Block'],['s','Spike'],['w','Saw'],['o','Orb'],['u','Blue orb'],['g','Gravity up'],['h','Gravity down'],['d','Decor'],['p','Speed'],['i','Ship portal'],['k','Cube portal'],['c','Color trigger'],['m','Move trigger'],['e','End'],['x','Erase']].map(([v,n])=>`<button data-a=tool data-v=${v}>${n}</button>`).join('')+[['rl','↺'],['rr','↻'],['sty','Style'],['grp','Group'],['test','Playtest'],['save','Save'],['ren','Rename'],['song','Song'],['up','Upload'],['del','Delete'],['exit','Exit']].map(([a,n])=>`<button data-a=${a}>${n}</button>`).join('');setEd()},
tool:v=>{ED.tool=v;ED.v=0},
song:()=>{const m=ED.song;show(`<h2>Level song</h2><p>${m?esc(m.name):'No song'}</p><input type=file id=sf accept=".mp3,audio/mpeg"><p>${m?'Pick a file to change the song':'Choose an mp3 (8 MB max)'}</p>${m?`<div class=row>${[.5,1,1.5,2].map(x=>`<button data-a=sps data-v=${x} ${m.speed==x?'style="border-color:#fff"':''}>${x}x</button>`).join('')}</div><input id=so type=number min=0 value=${m.off} placeholder="Start offset (ms)"><div class=row><button data-a=spv>Preview</button><button data-a=srm>Remove</button></div>`:''}<button data-a=sdone>Done</button>`)},
sps:v=>{rd();ED.song.speed=+v;act.song()},
spv:()=>{rd();pv?.pause();pv=sa(ED.song);setTimeout(()=>pv?.pause(),6000)},
srm:()=>{pv?.pause();ED.song=null;act.song()},
sdone:()=>{rd();pv?.pause();setEd()},
dl:async()=>{localStorage['dl'+L.id]=1;if(uid)updateDoc(doc(db,'users',uid),{dl:arrayUnion(L.id)}).catch(()=>{});const a=new Audio(L.song.url);a.preload='auto';a.load();act.lv(L.id)},grp:()=>{if(G.sel.size)G.sel.forEach(o=>o[5]=((o[5]|0)+1)%10);else G.gp=(G.gp+1)%10;G.beaten=false},rl:()=>rot(-1),rr:()=>rot(1),sty:()=>{if(G.sel.size)G.sel.forEach(o=>o[4]=((o[4]|0)+1)%(NV[o[0]]||1));else G.v=((G.v|0)+1)%(NV[G.tool]||1);G.beaten=false},
test:()=>{if(!ED.o.some(o=>o[0]=='e'))return alert('Add an End trigger first');start(ED.o,'test',ED.song)},
save:async()=>{await setDoc(doc(db,'drafts',uid+'_'+ED.i),{name:ED.name,desc:ED.desc,data:JSON.stringify(ED.o),beaten:ED.beaten,song:ED.song||null})},
ren:()=>{ED.name=prompt('Level name',ED.name)||ED.name;ED.desc=prompt('Description',ED.desc)??ED.desc},
up:async()=>{if(!ED.beaten)return alert('Beat your level from 0 to 100% in Playtest to unlock upload');await act.save();await addDoc(collection(db,'levels'),{name:ED.name,desc:ED.desc,author:me.name,aid:uid,data:JSON.stringify(ED.o),song:ED.song||null,rating:0,likes:0,views:0,ts:Date.now()});await updateDoc(doc(db,'users',uid),{pub:increment(1)}).catch(()=>{});await load();alert('Published!');act.edl()},
del:async()=>{if(confirm('Delete this level?')){await deleteDoc(doc(db,'drafts',uid+'_'+ED.i));act.edl()}},
exit:()=>act.edl()};
document.onclick=e=>{const b=e.target.closest('[data-a]');if(b)act[b.dataset.a]?.(b.dataset.v)};
document.onchange=async e=>{if(e.target.id!='sf')return;const f=e.target.files[0];if(!f)return;if(f.size>8e6)return alert('Song must be under 8 MB');try{const r=ref(st,`songs/${uid}/${Date.now()}.mp3`);await uploadBytes(r,f,{contentType:'audio/mpeg'});ED.song={name:f.name.replace(/\.mp3$/i,''),url:await getDownloadURL(r),speed:1,off:0};act.song()}catch(x){alert('Song upload failed: '+x.code)}};
function setEd(){G?.au?.pause();G=ED;ui.classList.add('off');bar.classList.remove('off');bgm(edm)}
function start(o,mode,sg){const e=o.find(x=>x[0]=='e');G={mode,o,sg,x:0,y:0,vy:0,rot:0,gr:true,dead:0,held:false,fresh:false,used:new Set(),gd:1,sh:0,sp:1,cc:{},mv:{},tw:[],fi:new Set,end:e?e[1]:30};ui.classList.add('off');bar.classList.add('off');bgm(null);if(sg&&S.m)G.au=sa(sg)}
function quit(){if(G.mode=='test')setEd();else act.lv(L.id)}
async function fin(){const m=G.mode;G.au?.pause();G=null;snd(win);if(m=='test'){ED.beaten=true;alert('Level beaten! You can upload it now.');setEd();return}
localStorage['b'+L.id]=100;if(uid&&me&&!me.done.includes(L.id)){const d={beaten:increment(1),crystals:increment(10),done:arrayUnion(L.id)};if(L.rating){d.stars=increment(L.rating);if(L.rating==5)d.demons=increment(1)}await updateDoc(doc(db,'users',uid),d).catch(()=>{});await load()}
show(`<h2>Level complete!</h2><button data-a=lv data-v=${L.id}>OK</button>`)}
function step(dt){const s=G;if(s.dead>0){if((s.dead-=dt)<=0){s.x=s.y=s.vy=s.rot=0;s.gd=1;s.sp=1;s.sh=0;if(s.au)s.au.currentTime=(s.sg.off||0)/1000;s.used.clear();s.fi.clear();s.cc={};s.mv={};s.tw=[]}return}
for(const w of s.tw){w.c=Math.min(w.d,w.c+dt);const k=w.d?w.c/w.d:1;if(w.t=='c')s.cc[w.g].k=k;else{const e=k*k*(3-2*k);s.mv[w.g]=[w.f[0]+w.dx*e,w.f[1]+w.dy*e]}}
s.tw=s.tw.filter(w=>w.c<w.d);
const py=s.y,d=s.gd;s.x+=9.3*dt*s.sp;if(s.sh){s.vy+=(s.held?26:-20)*d*dt;s.vy=Math.max(-9,Math.min(9,s.vy))}else s.vy-=75*dt*d;s.y+=s.vy*dt;s.gr=false;
if(s.y<=0){s.y=0;s.vy=0;s.gr=d>0}if(s.y>=9){s.y=9;s.vy=0;s.gr=d<0}
const kill=()=>{s.dead=.6;snd(die);if(s.mode=='play'){const p=Math.min(99,s.x/s.end*100|0);if(p>(+localStorage['b'+L.id]||0))localStorage['b'+L.id]=p}};
for(const o of s.o){const[t,X0,Y0]=o,m=s.mv[o[5]]||[0,0],ox=X0+m[0],oy=Y0+m[1],r=o[3]|0,v=o[4]|0;if(t=='d'||Math.abs(ox-s.x)>2.5)continue;const dx=s.x-ox,dy=s.y-oy;
if(t=='b'){if(s.x+1>ox+.04&&s.x<ox+.96&&s.y<oy+1&&s.y+1>oy){if(d>0?(py>=oy+.95&&s.vy<=0):(py+1<=oy+.05&&s.vy>=0)){s.y=d>0?oy+1:oy-1;s.vy=0;s.gr=true}else return kill()}}
else if(t=='s'){let a=dx,b=dy;for(let i=0;i<r;i++)[a,b]=[-b,a];if(Math.abs(a)<.5&&b<(v&1?.2:.45)&&b>-1)return kill()}
else if(t=='w'){if(Math.hypot(dx,dy)<(v?1.1:.5)+.35)return kill()}
else if(t=='o'||t=='u'){const k=ox+','+oy;if(s.fresh&&Math.hypot(dx,dy)<.9&&!s.used.has(k)){s.used.add(k);if(t=='o')s.vy=16*d;else{s.gd=-d;s.vy=6*s.gd}s.fresh=false}}
else if('ghpik'.includes(t)){if(s.x+1>ox&&s.x<ox+1&&s.y+1>oy-.5&&s.y<oy+1.5){if(t=='p')s.sp=[.8,1,1.3,1.6][v&3];else if(t=='i'||t=='k')s.sh=t=='i'?1:0;else s.gd=t=='g'?-1:1}}
else if(t=='c'||t=='m'){if(s.x>=ox&&!s.fi.has(o)){s.fi.add(o);trig(s,o)}}
else if(t=='e'&&s.x>=ox)return fin()}
if(s.gr&&s.held&&!s.sh){s.vy=17.5*s.gd;s.gr=false}s.fresh=false;s.rot=s.sh?-Math.atan2(s.vy,9.3*s.sp)*57.3:s.gr?Math.round(s.rot/90)*90:s.rot+420*dt*s.gd}
const NV={b:20,s:20,w:2,d:30,c:10,p:4},BC=[...Array(20)].map((_,i)=>`hsl(${i*18},45%,${30+i%3*6}%)`),SC=['#ff4d6d','#c04dff'];
const DC=[()=>{g.beginPath();g.arc(0,0,U*.15,0,7);g.fill()},()=>{g.fillRect(-2,-U/2,4,U);g.beginPath();g.ellipse(6,-4,8,4,.5,0,7);g.fill()},()=>{[[-8,2,9],[0,-3,11],[8,2,8]].forEach(([a,b,R])=>{g.beginPath();g.arc(a,b,R,0,7);g.fill()})},()=>g.fillRect(-U/4,-U/8,U/2,U/4),()=>{g.rotate(Math.PI/4);g.fillRect(-U*.15,-U*.15,U*.3,U*.3)},()=>{g.beginPath();g.moveTo(-6,U/4);g.lineTo(0,-U*.2);g.lineTo(6,U/4);g.fill()},()=>{g.beginPath();g.arc(0,0,U*.25,0,7);g.lineWidth=3;g.stroke();g.lineWidth=1},()=>{g.fillRect(-2,-U*.3,4,U*.6);g.fillRect(-U*.3,-2,U*.6,4)},()=>{for(let i=-1;i<2;i++){g.beginPath();g.moveTo(i*10-5,U/4);g.lineTo(i*10,-U*.1);g.lineTo(i*10+5,U/4);g.fill()}},()=>{for(let i=0;i<5;i++){g.beginPath();g.arc(Math.cos(i*1.257)*8,Math.sin(i*1.257)*8,5,0,7);g.fill()}}];
const cl=(x,y)=>[Math.floor((x-120)/U+G.cam),Math.floor((cv.height*.75-y)/U)];
let dr=null,clip=[];
const rgb=h=>{g.fillStyle=h;h=g.fillStyle;return[1,3,5].map(i=>parseInt(h.substr(i,2),16))},mix=(a,b,k)=>'rgb('+a.map((x,i)=>x+(b[i]-x)*k|0)+')',LY=c=>'cm'.includes(c)?1:c=='d'?2:0;
function trig(s,o){const q=o[5]|0;if(o[0]=='c'){const p=s.cc[q],f=p?(p.k>=1||!p.f?p.to:p.f.map((x,i)=>x+(p.to[i]-x)*p.k)):null;s.cc[q]={f,to:rgb(COL[o[4]|0]),k:0};s.tw=s.tw.filter(w=>w.t!='c'||w.g!=q);s.tw.push({t:'c',g:q,c:0,d:o[6]||0})}
else s.tw.push({t:'m',g:q,f:[...(s.mv[q]||[0,0])],dx:o[6]||0,dy:o[7]||0,c:0,d:o[8]||0})}
function place(e){const[x,y]=cl(e.clientX,e.clientY);if(y<0)return;const t=G.tool;G.o=G.o.filter(o=>o[1]!=x||o[2]!=y||(t!='x'&&LY(o[0])!=LY(t)));if(t!='x'){const n=[t,x,y,G.r|0,G.v|0,G.gp|0];if(t=='c')n[6]=+prompt('Fade seconds','1')||0;if(t=='m')n.push(...(prompt('Move x,y blocks and seconds','4,0,1')||'0,0,0').split(',').map(a=>+a||0));G.o.push(n)}G.beaten=false;G.sel=new Set}
function pick(){const[a,b]=cl(dr.x,dr.y),[c,d]=cl(dr.a,dr.b),s=new Set(dr.add?G.sel:[]);G.o.forEach(o=>{if(o[1]>=Math.min(a,c)&&o[1]<=Math.max(a,c)&&o[2]>=Math.min(b,d)&&o[2]<=Math.max(b,d))s.add(o)});G.sel=s}
function rot(k){if(G.sel.size){G.sel.forEach(o=>o[3]=((o[3]|0)+k)&3);G.beaten=false}else G.r=((G.r|0)+k)&3}
function edkey(e){const k=e.key.toLowerCase();
if(e.ctrlKey||e.metaKey){if(k=='c'){const m=[...G.sel];if(m.length){const x=Math.min(...m.map(o=>o[1])),y=Math.min(...m.map(o=>o[2]));clip=m.map(o=>{const c=[...o];c[1]-=x;c[2]-=y;return c})}e.preventDefault()}
else if(k=='v'&&clip.length){const[x,y]=G.h,n=clip.map(o=>{const c=[...o];c[1]+=x;c[2]+=Math.max(0,y);return c});G.o.push(...n);G.sel=new Set(n);G.beaten=false;e.preventDefault()}return}
if(k=='q')rot(-1);else if(k=='e')rot(1);else if(k=='delete'||k=='backspace'){G.o=G.o.filter(o=>!G.sel.has(o));G.sel=new Set;G.beaten=false}else if(k=='escape')G.sel=new Set}
function obj(o,x,y){const[t,,,r,v]=o,c=U/2,cf=b=>{const k=o[5]&&G.cc?.[o[5]];return k?mix(k.f||rgb(b),k.to,k.k):b};g.save();g.translate(x+c,y+c);g.rotate((r|0)*Math.PI/2);
if(t=='b'){g.fillStyle=cf(BC[(v|0)%20]);g.fillRect(-c,-c,U,U);g.strokeStyle='rgba(255,255,255,.55)';g.strokeRect(-c+1,-c+1,U-2,U-2);const q=v%4;if(q==1)g.strokeRect(-c+7,-c+7,U-14,U-14);if(q==2){g.beginPath();g.moveTo(-c,0);g.lineTo(c,0);g.moveTo(0,-c);g.lineTo(0,c);g.stroke()}if(q==3){g.beginPath();g.moveTo(-c,c);g.lineTo(c,-c);g.stroke()}}
else if(t=='s'){const h=v&1?U*.45:U*.85;g.fillStyle=cf(`hsl(${(v>>1)*36},80%,60%)`);g.beginPath();g.moveTo(-c+3,c);g.lineTo(0,c-h);g.lineTo(c-3,c);g.fill()}
else if(t=='w'){const R=v?U*1.1:U*.5;g.rotate(performance.now()/120);g.fillStyle=cf('#cfd6ff');g.beginPath();for(let i=0;i<16;i++){const a=i*Math.PI/8,q=i&1?R*.7:R;g.lineTo(Math.cos(a)*q,Math.sin(a)*q)}g.fill()}
else if(t=='o'||t=='u'){g.fillStyle=t=='o'?'#ffe14d':'#4d9bff';g.beginPath();g.arc(0,0,U*.3,0,7);g.fill();g.strokeStyle='#fff';g.stroke()}
else if('ghpik'.includes(t)){g.strokeStyle=t=='i'?'#ff4dd8':t=='k'?'#4dffe0':t=='p'?['#4dff88','#4de1ff','#ffd84d','#ff4d6d'][v&3]:t=='g'?'#ffe14d':'#4d9bff';g.lineWidth=4;g.strokeRect(-c/2,-U,c,U*2)}
else if(t=='c'||t=='m'){if(G.mode=='edit'){g.fillStyle=t=='c'?COL[v|0]:'#fff';g.fillRect(-c/2,-c/2,c,c);g.fillStyle='#000';g.fillText((t=='c'?'C':'M')+(o[5]|0),-8,4)}}
else if(t=='d'){g.fillStyle=`hsla(${(v/10|0)*130+190},70%,75%,.6)`;g.strokeStyle=g.fillStyle;DC[v%10]()}
else{g.fillStyle='#fff';g.fillRect(-2,-y-c,4,cv.height)}
if(G.mode=='edit'&&o[5]&&t!='c'&&t!='m'){g.fillStyle='#fff';g.fillText(o[5],-c+3,-c+12)}
g.restore()}
function draw(){const W=cv.width,H=cv.height,gy=H*.75,r=g.createLinearGradient(0,0,0,H);r.addColorStop(0,G?.cc?.[0]?mix(G.cc[0].f||[26,31,92],G.cc[0].to,G.cc[0].k):'#1a1f5c');r.addColorStop(1,'#4a1f6e');g.fillStyle=r;g.fillRect(0,0,W,H);
const c=G?(G.mode=='edit'?G.cam:G.x):performance.now()/900;g.fillStyle='rgba(255,255,255,.06)';
for(let i=0;i<8;i++){const m=W+300;g.beginPath();g.arc(((i*263-c*U*.15*(1+i%3))%m+m)%m-150,H*(.15+.1*(i%4)),30+i*9,0,7);g.fill()}
if(!G)return;const X=x=>120+(x-c)*U,Y=y=>gy-y*U;
g.fillStyle='#0a0c24';g.fillRect(0,gy,W,H-gy);g.fillStyle=COL[col];g.fillRect(0,gy,W,3);
if(G.mode=='edit'){g.strokeStyle='rgba(255,255,255,.07)';for(let x=Math.floor(c-3);x<c+W/U;x++){g.beginPath();g.moveTo(X(x),0);g.lineTo(X(x),gy);g.stroke()}for(let y=0;y<14;y++){g.beginPath();g.moveTo(0,Y(y));g.lineTo(W,Y(y));g.stroke()}}
for(const pass of[1,0])for(const o of G.o){if((o[0]=='d')!=pass)continue;const m=G.mv?.[o[5]]||[0,0],x=X(o[1]+m[0]),y=Y(o[2]+m[1]+1);if(x<-2*U||x>W+U)continue;obj(o,x,y);if(G.sel?.has(o)){g.strokeStyle='#ffe14d';g.lineWidth=2;g.strokeRect(x,y,U,U);g.lineWidth=1}}
if(dr&&G.mode=='edit'){g.strokeStyle='#4de1ff';g.strokeRect(dr.x,dr.y,dr.a-dr.x,dr.b-dr.y)}
if(G.mode=='edit'){g.fillStyle='#fff';g.font='14px sans-serif';g.fillText(`Tool ${G.tool} · style ${G.v|0} · group ${G.gp|0} · rotation ${(G.r|0)*90}°`,12,gy+26)}
if(G.mode!='edit'){const p=Math.min(1,G.x/G.end);g.fillStyle='rgba(255,255,255,.25)';g.fillRect(W*.25,12,W*.5,8);g.fillStyle='#4de1ff';g.fillRect(W*.25,12,W*.5*p,8);
if(G.dead<=0){g.save();g.translate(120+U/2,Y(G.y+.5));g.rotate(G.rot*Math.PI/180);if(G.sh){g.scale(1,G.gd);ship(g,shp|0,U,COL[col],COL[c2])}else skin(g,sk,U,COL[col],COL[c2]);g.restore()}}}
let last=0,acc=0;
function loop(t){requestAnimationFrame(loop);const dt=Math.min(.05,(t-last)/1000);last=t;
if(G?.mode=='edit')G.cam=Math.max(-3,G.cam+((keys.ArrowRight||keys.d?1:0)-(keys.ArrowLeft||keys.a?1:0))*10*dt);
else if(G){acc+=dt;while(G&&acc>1/120){step(1/120);acc-=1/120}}
draw()}
const fit=()=>{cv.width=innerWidth;cv.height=innerHeight;U=Math.max(24,innerHeight/14|0)};onresize=fit;fit();requestAnimationFrame(loop);
const JK=[' ','ArrowUp','w'];
onkeydown=e=>{if(e.repeat)return;keys[e.key]=1;if(G&&G.mode!='edit'){if(JK.includes(e.key)){G.held=G.fresh=true;e.preventDefault()}if(e.key=='Escape')quit()}else if(G)edkey(e)};
onkeyup=e=>{delete keys[e.key];if(G&&JK.includes(e.key))G.held=false};
cv.onpointerdown=e=>{if(!G)return;if(G.mode!='edit'){G.held=G.fresh=true;return}if(e.shiftKey||G.tool=='sel')dr={x:e.clientX,y:e.clientY,a:e.clientX,b:e.clientY,add:e.shiftKey};else place(e)};
cv.onpointermove=e=>{if(G?.mode!='edit')return;G.h=cl(e.clientX,e.clientY);if(dr){dr.a=e.clientX;dr.b=e.clientY}};
cv.onpointerup=()=>{if(G&&G.mode!='edit')G.held=false;if(dr&&G?.mode=='edit')pick();dr=null};
