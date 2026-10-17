// dash_app.js - DASH: UI, accounts, community, editor, moderation (all synced to Firebase)
import { auth, db, storage } from './dash_firebase.js';
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, deleteUser } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, orderBy, limit, getDocs, addDoc, onSnapshot, serverTimestamp, increment, writeBatch, arrayUnion } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import { ref as sref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-storage.js';
import { Game, U, PRIMARY, SECONDARY, DIFFS, OBJ, drawObj, drawIcon, skinURL, diffURL, defColor } from './dash_game.js';

/* ================= helpers ================= */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => (n || 0).toLocaleString();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MOD = 'Vortarium';
const STAR_SCALE = 1;           // stars awarded per difficulty star (1..5). Change here to rebalance.
const SLOTS = 20;
let me = null, P = null;
const settings = Object.assign({ music: true, sfx: true, vol: .6 }, JSON.parse(localStorage.dash_settings || '{}'));
const isMod = () => !!P && P.username === MOD;
const nameHTML = n => esc(n) + (n === MOD ? '<i class="modm">M</i>' : '');
const myIcon = (size = 64) => skinURL(P?.skin || 0, PRIMARY[P?.c1 || 0], SECONDARY[P?.c2 || 0], size);
const userIcon = (u, size = 64) => skinURL(u.skin || 0, PRIMARY[u.c1 || 0], SECONDARY[u.c2 || 0], size);
const errMsg = e => {
  const c = e?.code || '';
  if (typeof e === 'string') return e;
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'Wrong username or password';
  if (c.includes('email-already-in-use')) return 'That username is already taken';
  if (c.includes('permission-denied')) return 'Permission denied (check your Firestore/Storage rules)';
  if (c.includes('operation-not-allowed')) return 'Enable Email/Password sign-in in Firebase Authentication';
  return e?.message || 'Something went wrong';
};
function toast(msg, kind = '') {
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), 3600);
}
let modalClose = null;
function modal(html, wide) { $('#modalBody').innerHTML = html; $('#modalBox').classList.toggle('wide', !!wide); $('#modal').classList.add('open'); }
function closeModal() { $('#modal').classList.remove('open'); if (modalClose) { modalClose(); modalClose = null; } }
async function batchDelete(refs) { for (let i = 0; i < refs.length; i += 400) { const b = writeBatch(db); refs.slice(i, i + 400).forEach(r => b.delete(r)); await b.commit(); } }
async function delCol(path) { const s = await getDocs(collection(db, ...path)); await batchDelete(s.docs.map(d => d.ref)); }

/* ---- IndexedDB for songs ---- */
const idb = () => new Promise((res, rej) => { const r = indexedDB.open('dash_db', 1); r.onupgradeneeded = () => r.result.createObjectStore('songs'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const idbGet = async k => { try { const d = await idb(); return await new Promise(r => { const q = d.transaction('songs').objectStore('songs').get(k); q.onsuccess = () => r(q.result); q.onerror = () => r(null); }); } catch { return null; } };
const idbSet = async (k, v) => { const d = await idb(); return new Promise((res, rej) => { const q = d.transaction('songs', 'readwrite').objectStore('songs').put(v, k); q.onsuccess = res; q.onerror = () => rej(q.error); }); };
const idbDel = async k => { try { const d = await idb(); d.transaction('songs', 'readwrite').objectStore('songs').delete(k); } catch { } };

/* ================= audio ================= */
const A = { menu: new Audio('dash_music.mp3'), editor: new Audio('dash_editor.mp3'), die: new Audio('dash_die.mp3'), win: new Audio('dash_win.mp3') };
A.menu.loop = A.editor.loop = true;
let track = null, unlocked = false;
function applyAudio() {
  for (const k of ['menu', 'editor']) {
    A[k].volume = settings.vol;
    if (settings.music && unlocked && track === k) A[k].play().catch(() => { }); else A[k].pause();
  }
}
function setTrack(t) { if (track === t) return; track = t; applyAudio(); }
function sfx(k) { if (!settings.sfx) return; const a = A[k].cloneNode(); a.volume = settings.vol; a.play().catch(() => { }); }
const unlock = () => { unlocked = true; applyAudio(); };
addEventListener('pointerdown', unlock, { once: true }); addEventListener('keydown', unlock, { once: true });
function saveSettings() { localStorage.dash_settings = JSON.stringify(settings); applyAudio(); if (me) updateDoc(doc(db, 'users', me.uid), { settings }).catch(() => { }); }

/* ================= achievements / unlocks ================= */
const ACH_DEFS = [
  ['totalViews', 'Popular', 'Get {n} total views on your levels', [10, 50, 100, 250, 500, 1000, 2500, 5000]],
  ['levelsBeaten', 'Winner', 'Beat {n} levels', [1, 3, 5, 10, 20, 35, 50, 75, 100, 150]],
  ['netLikes', 'Liked', 'Reach {n} total net likes', [1, 5, 10, 25, 50, 100, 250, 500]],
  ['maxPostLikes', 'Hit Level', 'Get {n} net likes on a single level', [5, 10, 25, 50, 100, 250]],
  ['rated', 'Verified', 'Get {n} of your levels rated', [1, 2, 3, 5, 10]],
  ['stars', 'Stargazer', 'Collect {n} stars', [1, 10, 25, 50, 100, 200]],
  ['demons', 'Demon Slayer', 'Beat {n} demon levels', [1, 3, 5, 10]],
  ['published', 'Creator', 'Publish {n} levels', [1, 5, 10]],
  ['comments', 'Chatty', 'Post {n} comments', [1, 5, 10]]
];
const ACH = (() => {
  const list = []; ACH_DEFS.forEach(([stat, name, desc, ns], ci) => ns.forEach((n, i) => list.push({ stat, n, name: `${name} ${i + 1}`, desc: desc.replace('{n}', fmt(n)), tier: i / ns.length, ci })));
  list.sort((a, b) => a.tier - b.tier || a.ci - b.ci);
  const rw = []; let sk = 1, pc = 1, sc = 1, tg = 0;
  while (rw.length < list.length) {
    for (let k = 0; k < 2 && sk < 36; k++) rw.push({ k: 'skin', i: sk++ });
    if (pc < 10 || sc < 10) { if (tg++ % 2 === 0 && pc < 10) rw.push({ k: 'p', i: pc++ }); else if (sc < 10) rw.push({ k: 's', i: sc++ }); else rw.push({ k: 'p', i: pc++ }); }
  }
  list.forEach((a, i) => a.rw = rw[i]); return list;
})();
const rwName = r => r.k === 'skin' ? `Cube skin #${r.i + 1}` : r.k === 'p' ? `Primary color #${r.i + 1}` : `Secondary color #${r.i + 1}`;
function unlocked_() {
  const u = { skin: new Set([0]), p: new Set([0]), s: new Set([0]) };
  if (me && P) ACH.forEach(a => { if ((P[a.stat] || 0) >= a.n) u[a.rw.k].add(a.rw.i); });
  return u;
}
function checkAch() {
  if (!me || !P) return; const key = 'dash_ach_' + me.uid; const seen = new Set(JSON.parse(localStorage[key] || '[]'));
  const first = !localStorage[key]; const now = ACH.filter(a => (P[a.stat] || 0) >= a.n).map(a => a.name);
  if (!first) now.filter(n => !seen.has(n)).forEach(n => { const a = ACH.find(x => x.name === n); toast(`🏆 Achievement: ${a.name} - unlocked ${rwName(a.rw)}`, 'ok'); });
  localStorage[key] = JSON.stringify(now);
}

/* ================= navigation ================= */
let cur = 'menu', curP = {}, stack = [];
const views = {};
function showLayer(n) { ['menu', 'view', 'play', 'edit'].forEach(l => $('#' + l).classList.toggle('active', l === n)); document.body.classList.toggle('fs', n === 'play' || n === 'edit'); }
function go(name, p = {}, push = true) {
  if (name === 'menu') { stack = []; cur = 'menu'; curP = {}; showLayer('menu'); }
  else { if (push) stack.push([cur, curP]); cur = name; curP = p; showLayer('view'); views[name](p); }
  renderFooter(); setTrack('menu');
}
function back() { const s = stack.pop(); s && s[0] !== 'menu' ? go(s[0], s[1], false) : go('menu'); }
const page = (title, html) => { $('#view').innerHTML = `<div class="page"><header><button class="round" data-act="back">◀</button><h2>${title}</h2></header><div class="pbody">${html}</div></div>`; };
function renderFooter() {
  const s = P || {};
  $('#footer').innerHTML = `<span class="fname">${me ? nameHTML(P?.username || '…') : 'Anonymous'}</span><span>💎 ${fmt(s.crystals)}</span><span>⭐ ${fmt(s.stars)}</span><span>😈 ${fmt(s.demons)}</span><span>👍 ${fmt(s.netLikes)}</span><span>✅ ${fmt(s.levelsBeaten)}</span>`;
  $('#menuIcon').src = myIcon(64);
  const b = $('#menuBadge'); const n = (reqs.length || 0) + (isMod() ? modPending : 0); b.textContent = n; b.classList.toggle('hide', !n);
}

/* ================= auth ================= */
const emailOf = u => `${u.toLowerCase()}@dash-game.app`;
const newProfile = username => ({ username, stars: 0, crystals: 0, levelsBeaten: 0, demons: 0, netLikes: 0, totalViews: 0, published: 0, rated: 0, maxPostLikes: 0, comments: 0, skin: 0, c1: 0, c2: 0, songs: [], settings, created: serverTimestamp() });
let busySignup = false;
async function signUp(username, pw) {
  username = username.trim();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) throw 'Username: 3-16 letters, numbers or _';
  if (pw.length < 6) throw 'Password must be at least 6 characters';
  const key = username.toLowerCase();
  if ((await getDoc(doc(db, 'usernames', key))).exists()) throw 'That username is already taken';
  busySignup = true;
  try {
    const cred = await createUserWithEmailAndPassword(auth, emailOf(username), pw);
    try { const b = writeBatch(db); b.set(doc(db, 'usernames', key), { uid: cred.user.uid }); b.set(doc(db, 'users', cred.user.uid), newProfile(username)); await b.commit(); }
    catch (e) { await deleteUser(cred.user).catch(() => { }); throw 'Could not create the account: ' + errMsg(e); }
    await afterLogin(cred.user);
  } finally { busySignup = false; }
}
async function afterLogin(u) {
  me = u; P = null;
  if ((await getDoc(doc(db, 'banned', u.uid))).exists()) { await signOut(auth); me = null; toast('This account has been banned', 'err'); return; }
  let s = await getDoc(doc(db, 'users', u.uid)); if (!s.exists()) { await sleep(1200); s = await getDoc(doc(db, 'users', u.uid)); }
  if (!s.exists()) { await signOut(auth); me = null; toast('Account data not found', 'err'); return; }
  P = s.data(); if (P.settings) { Object.assign(settings, P.settings); localStorage.dash_settings = JSON.stringify(settings); applyAudio(); }
  loadSlots(); startListeners(); renderFooter();
  refreshMyStats(); pullDrafts(); syncSongs(); purgeDMs();
  if (cur === 'account') views.account({ tab: 'account' });
}
onAuthStateChanged(auth, async u => {
  if (busySignup) return;
  if (u) { try { await afterLogin(u); } catch (e) { console.error(e); toast('Could not load account: ' + errMsg(e), 'err'); } }
  else { me = null; P = null; stopListeners(); loadSlots(); renderFooter(); if (cur === 'account') views.account({ tab: 'account' }); }
});
async function refreshMyStats() {
  if (!me || !P) return;
  try {
    const s = await getDocs(query(collection(db, 'levels'), where('authorId', '==', me.uid)));
    let views = 0, net = 0, max = 0, rated = 0;
    s.forEach(d => { const l = d.data(); views += l.views || 0; const n = (l.likes || 0) - (l.dislikes || 0); net += n; max = Math.max(max, n); if (l.status === 'rated') rated++; });
    const upd = { totalViews: views, netLikes: net, maxPostLikes: max, rated, published: s.size };
    Object.assign(P, upd); await updateDoc(doc(db, 'users', me.uid), upd); checkAch(); renderFooter();
  } catch (e) { console.warn(e); }
}

/* ================= listeners (friend requests, mod ping) ================= */
let reqs = [], reqUnsub = null, modUnsub = null, modPending = 0;
function startListeners() {
  stopListeners();
  reqUnsub = onSnapshot(query(collection(db, 'friendRequests'), where('to', '==', me.uid), where('status', '==', 'pending')), s => {
    const had = reqs.length; reqs = s.docs.map(d => ({ id: d.id, ...d.data() })); renderFooter();
    if (reqs.length > had && had >= 0 && reqReady) toast('📨 New friend request!');
    reqReady = true; if (cur === 'lb' && curP.tab === 'friends') views.lb(curP);
  }, () => { });
  if (isMod()) {
    let first = true;
    modUnsub = onSnapshot(query(collection(db, 'levels'), where('status', '==', 'unrated')), s => {
      modPending = s.size; renderFooter();
      if (!first) s.docChanges().forEach(c => { if (c.type === 'added') toast(`🔔 New level to rate: ${c.doc.data().title}`); });
      first = false;
    }, () => { });
  }
}
let reqReady = false;
function stopListeners() { reqUnsub && reqUnsub(); modUnsub && modUnsub(); reqUnsub = modUnsub = null; reqs = []; modPending = 0; reqReady = false; }

/* ================= account / settings ================= */
const settingsHTML = () => `<div class="card"><div class="row"><button class="btn ${settings.music ? 'green' : 'red'}" data-act="tog" data-k="music">Music: ${settings.music ? 'ON' : 'OFF'}</button><button class="btn ${settings.sfx ? 'green' : 'red'}" data-act="tog" data-k="sfx">SFX: ${settings.sfx ? 'ON' : 'OFF'}</button></div><label style="margin-top:12px">Volume<input type="range" min="0" max="1" step=".05" value="${settings.vol}" id="volr"></label></div>`;
views.account = ({ tab = 'account' } = {}) => {
  const tabs = `<div class="tabs"><button class="${tab === 'account' ? 'on' : ''}" data-act="acctab" data-t="account">Account</button><button class="${tab === 'settings' ? 'on' : ''}" data-act="acctab" data-t="settings">Settings</button></div>`;
  let body;
  if (tab === 'settings') body = settingsHTML();
  else if (!me) body = `<div class="card" style="max-width:460px"><h3>Playing as Anonymous</h3><p class="muted">Log in to like, dislike, comment, create levels and save progress. You can still view and play other people's levels.</p><label>Username<input id="au" maxlength="16" autocomplete="username"></label><label>Password<input id="ap" type="password" autocomplete="current-password"></label><div class="row"><button class="btn green" data-act="login">Log in</button><button class="btn blue" data-act="signup">Sign up</button></div></div>`;
  else if (!P) body = '<p>Loading…</p>';
  else body = `<div class="card"><div class="row"><img src="${myIcon(96)}" width="96" height="96"><div><h2 style="margin:0">${nameHTML(P.username)}</h2><div class="muted">💎 ${fmt(P.crystals)} · ⭐ ${fmt(P.stars)} · 😈 ${fmt(P.demons)} · 👍 ${fmt(P.netLikes)} · ✅ ${fmt(P.levelsBeaten)} beaten · 👁 ${fmt(P.totalViews)} views</div></div></div><div class="row" style="margin-top:12px"><button class="btn blue" data-act="myprofile">View my profile</button><button class="btn red" data-act="logout">Log out</button></div></div>`;
  page('Account', tabs + body);
};

/* ================= cosmetics ================= */
views.cosmetics = () => {
  const un = unlocked_(), sk = P?.skin || 0, c1 = P?.c1 || 0, c2 = P?.c2 || 0;
  const req = (k, i) => { const a = ACH.find(a => a.rw.k === k && a.rw.i === i); return a ? `${a.name}: ${a.desc}` : 'Default'; };
  let skins = '', p1 = '', p2 = '';
  for (let i = 0; i < 36; i++) skins += `<div class="sk ${un.skin.has(i) ? '' : 'locked'} ${i === sk ? 'sel' : ''}" data-act="equip" data-k="skin" data-i="${i}" title="${esc(un.skin.has(i) ? 'Skin ' + (i + 1) : req('skin', i))}"><img src="${skinURL(i, PRIMARY[c1], SECONDARY[c2], 56)}"></div>`;
  for (let i = 0; i < 10; i++) { p1 += `<div class="sw ${un.p.has(i) ? '' : 'locked'} ${i === c1 ? 'sel' : ''}" style="background:${PRIMARY[i]}" data-act="equip" data-k="p" data-i="${i}" title="${esc(un.p.has(i) ? 'Primary ' + (i + 1) : req('p', i))}"></div>`; p2 += `<div class="sw ${un.s.has(i) ? '' : 'locked'} ${i === c2 ? 'sel' : ''}" style="background:${SECONDARY[i]}" data-act="equip" data-k="s" data-i="${i}" title="${esc(un.s.has(i) ? 'Secondary ' + (i + 1) : req('s', i))}"></div>`; }
  const ach = ACH.map(a => { const v = P?.[a.stat] || 0, done = !!me && v >= a.n; return `<div class="ach ${done ? 'done' : ''}"><div><b>${a.name}</b><div class="muted">${a.desc} → ${rwName(a.rw)}</div></div><span class="st">${done ? '✔' : fmt(Math.min(v, a.n)) + '/' + fmt(a.n)}</span></div>`; }).join('');
  page('Cosmetics', `<div class="cosm"><div class="preview card"><img src="${myIcon(160)}"><div class="muted">${me ? 'Tap unlocked items to equip' : 'Log in to unlock cosmetics with achievements'}</div></div><div><h3>Cube</h3><div class="row" style="gap:8px;margin-bottom:12px">${skins}</div><h3>Primary color</h3><div class="swatches">${p1}</div><h3>Secondary color</h3><div class="swatches">${p2}</div><h3>Achievements</h3>${ach}</div></div>`);
};

/* ================= community ================= */
views.community = () => {
  const mb = isMod() && modPending ? `<em class="badge">${modPending}</em>` : '', rb = reqs.length ? `<em class="badge">${reqs.length}</em>` : '';
  page('Community', `<div class="grid menu4"><button class="big-btn green" data-act="go" data-v="editor"><i class="bb-ico">🛠️</i>Editor</button><button class="big-btn orange" data-act="go" data-v="levels" data-kind="stars"><i class="bb-ico">⭐</i>Stars</button><button class="big-btn blue" data-act="go" data-v="levels" data-kind="new"><i class="bb-ico">🆕</i>New Levels${mb}</button><button class="big-btn red" data-act="go" data-v="lb"><i class="bb-ico">🏆</i>Leaderboards &amp; Friends${rb}</button></div>`);
};

/* ---- level lists ---- */
const LISTS = {}, LV = {};
async function fetchLevels(kind) {
  const s = await getDocs(query(collection(db, 'levels'), where('status', '==', kind === 'stars' ? 'rated' : 'unrated'), limit(200)));
  const a = s.docs.map(d => ({ id: d.id, ...d.data() })); a.sort((x, y) => (y.created?.seconds || 0) - (x.created?.seconds || 0)); return a;
}
const lvlCard = l => `<div class="lvl" data-act="openlvl" data-id="${l.id}"><img src="${l.diff ? diffURL(l.diff, 56) : diffURL('easy', 56)}" style="${l.diff ? '' : 'filter:grayscale(1) brightness(.6)'}"><div><h3>${esc(l.title)}</h3><div class="muted">by ${nameHTML(l.authorName)}${l.diff ? ' · ' + DIFFS.find(d => d.id === l.diff).name + ' ⭐' + (DIFFS.find(d => d.id === l.diff).stars) : ' · Unrated'}</div></div><div class="meta">👍 ${fmt((l.likes || 0) - (l.dislikes || 0))}<br>👁 ${fmt(l.views)}</div></div>`;
views.levels = async ({ kind }) => {
  page(kind === 'stars' ? 'Stars - Rated Levels' : 'New Levels', '<p class="muted">Loading…</p>');
  try { LISTS[kind] = await fetchLevels(kind); } catch (e) { return page('Levels', `<p>${esc(errMsg(e))}</p>`); }
  renderLevels(kind, 0);
};
function renderLevels(kind, pg) {
  const a = LISTS[kind], pages = Math.max(1, Math.ceil(a.length / 10));
  const body = a.length ? `<div class="list">${a.slice(pg * 10, pg * 10 + 10).map(lvlCard).join('')}</div>` : '<p class="muted">No levels here yet.</p>';
  page(kind === 'stars' ? 'Stars - Rated Levels' : 'New Levels', body + `<div class="pager"><button class="btn sm" data-act="pg" data-kind="${kind}" data-pg="${pg - 1}" ${pg <= 0 ? 'disabled' : ''}>◀ Prev</button><b>Page ${pg + 1} / ${pages}</b><button class="btn sm" data-act="pg" data-kind="${kind}" data-pg="${pg + 1}" ${pg >= pages - 1 ? 'disabled' : ''}>Next ▶</button></div>`);
}

/* ---- level page ---- */
const bestKey = id => 'dash_best_' + id;
async function getBest(id) {
  let b = +localStorage[bestKey(id)] || 0;
  if (me) { try { const s = await getDoc(doc(db, 'users', me.uid, 'progress', id)); if (s.exists()) b = Math.max(b, s.data().best || 0); } catch { } }
  return b;
}
views.level = async ({ id }) => {
  page('Level', '<p class="muted">Loading…</p>');
  let lv;
  try {
    const snap = await getDoc(doc(db, 'levels', id)); if (!snap.exists()) return page('Level', '<p>This level is no longer on the servers.</p>');
    lv = { id, ...snap.data() }; LV[id] = lv;
  } catch (e) { return page('Level', `<p>${esc(errMsg(e))}</p>`); }
  let my = 0; if (me) { try { const v = await getDoc(doc(db, 'levels', id, 'votes', me.uid)); my = v.exists() ? v.data().v : 0; } catch { } }
  const best = await getBest(id);
  let cms = []; try { cms = (await getDocs(query(collection(db, 'levels', id, 'comments'), orderBy('t', 'desc'), limit(60)))).docs.map(d => ({ id: d.id, ...d.data() })); } catch { }
  const d = DIFFS.find(x => x.id === lv.diff), mine = me && lv.authorId === me.uid;
  const dl = lv.songUrl ? (await idbGet('level:' + id) ? '<span class="muted">✔ Song downloaded</span>' : `<button class="btn sm blue" data-act="dlsong" data-id="${id}">⬇ Download song${lv.songName ? ': ' + esc(lv.songName) : ''}</button>`) : '';
  const cmHtml = cms.map(c => `<div class="cm">${isMod() || (me && c.uid === me.uid) ? `<span class="del" data-act="delcm" data-id="${id}" data-cid="${c.id}">✕</span>` : ''}<b data-act="profile" data-uid="${c.uid}">${nameHTML(c.name)}</b><br>${esc(c.text)}</div>`).join('') || '<p class="muted">No comments yet.</p>';
  page(esc(lv.title), `<div class="lp"><div class="lp-main">
    <h1>${esc(lv.title)}</h1><div>by <b style="color:#8fe9ff;cursor:pointer" data-act="profile" data-uid="${lv.authorId}">${nameHTML(lv.authorName)}</b></div>
    <div class="row" style="justify-content:center"><img src="${d ? diffURL(d.id, 56) : diffURL('easy', 56)}" width="56" style="${d ? '' : 'filter:grayscale(1) brightness(.6)'}"><b>${d ? d.name + ' · ⭐ ' + d.stars : 'Unrated'}</b></div>
    <p class="muted" style="max-width:480px">${esc(lv.desc || 'No description')}</p>
    <button class="playbtn" data-act="playlvl" data-id="${id}">▶</button>
    <div class="pb"><i style="width:${best}%"></i><b>Best: ${best}%</b></div>
    <div class="votes"><button class="round ${my === 1 ? 'on' : ''}" data-act="vote" data-id="${id}" data-v="1">👍</button><span>${fmt((lv.likes || 0) - (lv.dislikes || 0))}</span><button class="round down ${my === -1 ? 'on' : ''}" data-act="vote" data-id="${id}" data-v="-1">👎</button></div>
    <div class="muted">👁 ${fmt(lv.views)} views</div>${dl}
    <div class="row" style="justify-content:center">${isMod() ? `<button class="btn orange sm" data-act="ratemenu" data-id="${id}">⭐ Rate</button>` : ''}${isMod() || mine ? `<button class="btn red sm" data-act="takedown" data-id="${id}">Take down</button>` : ''}</div>
  </div><div class="side"><h3 style="margin:0 0 8px">Comments</h3><div class="comments">${cmHtml}</div>${me ? `<input id="cmt" maxlength="200" placeholder="Write a comment…"><button class="btn green sm" data-act="comment" data-id="${id}">Post</button>` : '<p class="muted">Log in to comment.</p>'}</div></div>`);
};
async function vote(id, v) {
  if (!me) return toast('Log in to like or dislike', 'err');
  const lr = doc(db, 'levels', id), vr = doc(db, 'levels', id, 'votes', me.uid);
  const [vs, ls] = await Promise.all([getDoc(vr), getDoc(lr)]); if (!ls.exists()) return;
  const old = vs.exists() ? vs.data().v : 0, nv = old === v ? 0 : v, b = writeBatch(db);
  nv === 0 ? b.delete(vr) : b.set(vr, { v: nv });
  b.update(lr, { likes: increment((nv === 1 ? 1 : 0) - (old === 1 ? 1 : 0)), dislikes: increment((nv === -1 ? 1 : 0) - (old === -1 ? 1 : 0)) });
  b.update(doc(db, 'users', ls.data().authorId), { netLikes: increment(nv - old) });
  await b.commit(); views.level({ id });
}
async function takeDown(id) {
  const s = await getDoc(doc(db, 'levels', id)); if (!s.exists()) return; const lv = s.data();
  await delCol(['levels', id, 'comments']); await delCol(['levels', id, 'votes']);
  await deleteDoc(doc(db, 'levels', id));
  await updateDoc(doc(db, 'users', lv.authorId), { netLikes: increment(-((lv.likes || 0) - (lv.dislikes || 0))) }).catch(() => { });
  if (lv.songUrl) deleteObject(sref(storage, `songs/${id}.mp3`)).catch(() => { });
  slots.forEach(x => { if (x && x.pub === id) x.pub = null; }); saveSlots();
}
async function rateLevel(id, diff) {
  const d = DIFFS.find(x => x.id === diff);
  await updateDoc(doc(db, 'levels', id), { status: 'rated', diff, stars: d.stars * STAR_SCALE }); closeModal(); toast(`Rated ${d.name}`, 'ok'); views.level({ id });
}
async function downloadSong(id) {
  const lv = LV[id]; toast('Downloading song…');
  try { const r = await fetch(lv.songUrl); if (!r.ok) throw 0; await idbSet('level:' + id, await r.blob()); }
  catch { await idbSet('level:' + id, { url: lv.songUrl }); toast('Direct download blocked (set CORS on your Storage bucket); the song will stream instead.'); }
  if (me) updateDoc(doc(db, 'users', me.uid), { songs: arrayUnion(id) }).catch(() => { });
  toast('Song saved', 'ok'); views.level({ id });
}
async function syncSongs() {
  for (const id of (P?.songs || [])) {
    if (await idbGet('level:' + id)) continue;
    try { const s = await getDoc(doc(db, 'levels', id)); if (!s.exists() || !s.data().songUrl) continue; const r = await fetch(s.data().songUrl); await idbSet('level:' + id, await r.blob()); } catch { }
  }
}

/* ================= playing ================= */
const game = new Game($('#gameCanvas'));
let PL = null, lvAudio = null;
async function playPublished(id) {
  const lv = LV[id]; updateDoc(doc(db, 'levels', id), { views: increment(1) }).catch(() => { }); lv.views = (lv.views || 0) + 1;
  let songUrl = null;
  if (lv.songUrl) { const s = await idbGet('level:' + id); if (s instanceof Blob) songUrl = URL.createObjectURL(s); else if (s?.url) songUrl = s.url; }
  startPlay({ level: JSON.parse(lv.data), kind: 'play', id, lv, songUrl, onExit: () => { showLayer('view'); views.level({ id }); } });
}
function startPlay(o) {
  PL = o; PL.sx = o.startX || 0; PL.sy = o.startY || 0; PL.best = 0;
  $('#pauseBox').classList.remove('open'); $('#winBox').classList.remove('open'); $('#pfill').style.width = '0';
  showLayer('play'); setTrack(null);
  game.skin = { id: P?.skin || 0, c1: PRIMARY[P?.c1 || 0], c2: SECONDARY[P?.c2 || 0] };
  game.load(o.level); lvAudio = o.songUrl ? new Audio(o.songUrl) : null;
  game.cb = {
    onSpawn: t => { if (!lvAudio || !settings.music) return; lvAudio.volume = settings.vol; const go = () => { try { lvAudio.currentTime = t; } catch { } lvAudio.play().catch(() => { }); }; lvAudio.readyState >= 1 ? go() : lvAudio.addEventListener('loadedmetadata', go, { once: true }); },
    onDeath: pct => { lvAudio && lvAudio.pause(); sfx('die'); PL.best = Math.max(PL.best, pct); if (PL.kind === 'play' && pct > (+localStorage[bestKey(PL.id)] || 0)) localStorage[bestKey(PL.id)] = Math.floor(pct); },
    onWin: () => { lvAudio && lvAudio.pause(); sfx('win'); $('#pfill').style.width = '100%'; $('#ppct').textContent = '100%'; $('#winInfo').textContent = `Attempts: ${game.attempts} · Jumps: ${game.jumps}`; $('#winBox').classList.add('open'); onWon(); },
    onFrame: pct => { $('#pfill').style.width = pct + '%'; $('#ppct').textContent = Math.floor(pct) + '%'; },
    onPause: pauseToggle
  };
  game.start({ x: PL.sx, y: PL.sy });
}
function pauseToggle() {
  if (game.won) return;
  if (game.paused) { game.resume(); $('#pauseBox').classList.remove('open'); if (lvAudio && !game.p.dead) lvAudio.play().catch(() => { }); }
  else { game.pause(); lvAudio && lvAudio.pause(); $('#pauseBox').classList.add('open'); }
}
async function stopPlay() {
  game.stop(); lvAudio && lvAudio.pause(); $('#pauseBox').classList.remove('open'); $('#winBox').classList.remove('open');
  const p = PL; PL = null;
  if (p.kind === 'play') { const b = Math.max(+localStorage[bestKey(p.id)] || 0, p.best ? Math.floor(p.best) : 0); if (me && b > 0) setDoc(doc(db, 'users', me.uid, 'progress', p.id), { best: b }).catch(() => { }); }
  setTrack(p.kind === 'test' ? 'editor' : 'menu'); p.onExit && p.onExit();
}
async function onWon() {
  const p = PL; if (!p) return;
  if (p.kind === 'test') { if (p.sx === 0 && p.sy === 0) { p.lv0.verified = sigOf(p.lv0.objs); saveSlots(ed.slot); toast('✔ Level verified! You can now upload it.', 'ok'); } else toast('Beat it from the very start to verify', ''); return; }
  localStorage[bestKey(p.id)] = 100; p.best = 100;
  if (!me || !P || p.lv.authorId === me.uid) { if (!me) toast('Log in to earn stars and track wins'); return; }
  try {
    const br = doc(db, 'users', me.uid, 'beaten', p.id), snap = await getDoc(br), rated = p.lv.status === 'rated', d = DIFFS.find(x => x.id === p.lv.diff);
    const first = !snap.exists(), starred = snap.exists() && snap.data().starred; if (!first && (starred || !rated)) return;
    const upd = {}, ds = rated ? d.stars * STAR_SCALE : 0;
    if (first) { upd.levelsBeaten = increment(1); upd.crystals = increment(10 + (rated ? 5 * d.stars : 0)); P.levelsBeaten++; P.crystals += 10 + (rated ? 5 * d.stars : 0); } else if (rated) { upd.crystals = increment(5 * d.stars); P.crystals += 5 * d.stars; }
    if (rated) { upd.stars = increment(ds); P.stars += ds; if (d.id === 'demon') { upd.demons = increment(1); P.demons++; } }
    await setDoc(br, { t: serverTimestamp(), starred: rated, level: p.id }, { merge: true }); await updateDoc(doc(db, 'users', me.uid), upd);
    renderFooter(); checkAch(); toast(rated ? `+${ds} stars!` : 'Level beaten!', 'ok');
  } catch (e) { console.warn(e); }
}

/* ================= leaderboards / friends / DMs ================= */
const STATS = { stars: 'Stars', netLikes: 'Likes', levelsBeaten: 'Levels Beaten', demons: 'Demons' };
views.lb = async (p = {}) => {
  const tab = p.tab || 'global', stat = p.stat || 'stars'; curP = { ...p, tab, stat };
  const tabs = `<div class="tabs"><button class="${tab === 'global' ? 'on' : ''}" data-act="lbtab" data-t="global">Global</button><button class="${tab === 'friends' ? 'on' : ''}" data-act="lbtab" data-t="friends">Friends ${reqs.length ? '(' + reqs.length + ')' : ''}</button></div>`;
  if (tab === 'global') {
    const sel = `<div class="tabs">${Object.entries(STATS).map(([k, v]) => `<button class="${k === stat ? 'on' : ''}" data-act="lbtab" data-t="global" data-stat="${k}">${v}</button>`).join('')}</div>`;
    page('Leaderboards', tabs + sel + '<p class="muted">Loading…</p>');
    try {
      const s = await getDocs(query(collection(db, 'users'), orderBy(stat, 'desc'), limit(100)));
      page('Leaderboards', tabs + sel + `<div class="list">${s.docs.map((d, i) => { const u = d.data(); return `<div class="lb" data-act="profile" data-uid="${d.id}"><span class="rk">#${i + 1}</span><img src="${userIcon(u, 40)}"><b>${nameHTML(u.username)}</b><span class="v">${fmt(u[stat])}</span></div>`; }).join('') || '<p class="muted">Nobody yet.</p>'}</div>`);
    } catch (e) { page('Leaderboards', tabs + `<p>${esc(errMsg(e))}</p>`); }
  } else {
    if (!me) return page('Friends', tabs + '<p>Log in to use friends and messages.</p>');
    page('Friends', tabs + '<p class="muted">Loading…</p>');
    let fr = []; try { fr = (await getDocs(collection(db, 'friends', me.uid, 'list'))).docs.map(d => ({ uid: d.id, ...d.data() })); } catch { }
    const inbox = reqs.map(r => `<div class="lb"><img src="${diffURL('easy', 40)}" style="display:none"><b>${nameHTML(r.fromName)}</b> <span class="muted">wants to be friends</span><span style="margin-left:auto" class="row"><button class="btn green sm" data-act="accept" data-id="${r.id}">Accept</button><button class="btn red sm" data-act="decline" data-id="${r.id}">Decline</button></span></div>`).join('') || '<p class="muted">No pending requests.</p>';
    const list = fr.map(f => `<div class="lb"><b data-act="profile" data-uid="${f.uid}">${nameHTML(f.name)}</b><span style="margin-left:auto"><button class="btn blue sm" data-act="dm" data-uid="${f.uid}" data-name="${esc(f.name)}">💬 Message</button></span></div>`).join('') || '<p class="muted">No friends yet - click a name on the leaderboard to add someone.</p>';
    page('Friends', tabs + `<div class="card"><h3>Add a friend</h3><div class="row"><input id="fname" placeholder="Username" style="max-width:260px;margin:0"><button class="btn green sm" data-act="addfriend">Send request</button></div></div><h3>Inbox</h3><div class="list">${inbox}</div><h3>Friends</h3><div class="list">${list}</div><p class="muted">Direct messages are cleared every day at 12am EST.</p>`);
  }
};
async function showProfile(uid) {
  const s = await getDoc(doc(db, 'users', uid)); if (!s.exists()) return toast('Account not found', 'err'); const u = s.data();
  let ls = []; try { ls = (await getDocs(query(collection(db, 'levels'), where('authorId', '==', uid)))).docs.map(d => ({ id: d.id, ...d.data() })); } catch { }
  let isF = false; if (me && uid !== me.uid) { try { isF = (await getDoc(doc(db, 'friends', me.uid, 'list', uid))).exists(); } catch { } }
  const acts = me && uid !== me.uid ? (isF ? `<button class="btn blue sm" data-act="dm" data-uid="${uid}" data-name="${esc(u.username)}">💬 Message</button>` : `<button class="btn green sm" data-act="addfriend" data-name="${esc(u.username)}">➕ Add friend</button>`) : '';
  const ban = isMod() && u.username !== MOD ? `<button class="btn red sm" data-act="ban" data-uid="${uid}" data-name="${esc(u.username)}">Ban account</button>` : '';
  modal(`<h2>${nameHTML(u.username)}</h2><div class="row"><img src="${userIcon(u, 96)}" width="96" height="96"><div class="muted" style="font-size:16px">⭐ ${fmt(u.stars)} stars<br>😈 ${fmt(u.demons)} demons<br>👍 ${fmt(u.netLikes)} net likes<br>✅ ${fmt(u.levelsBeaten)} levels beaten<br>👁 ${fmt(u.totalViews)} total views</div></div><div class="row" style="margin:12px 0">${acts}${ban}</div><h3>Levels</h3><div class="list">${ls.map(lvlCard).join('') || '<p class="muted">No published levels.</p>'}</div>`, true);
}
async function addFriend(name) {
  if (!me) return toast('Log in first', 'err'); name = (name || '').trim(); if (!name) return;
  const s = await getDoc(doc(db, 'usernames', name.toLowerCase())); if (!s.exists()) return toast('No such user', 'err');
  const uid = s.data().uid; if (uid === me.uid) return toast("That's you!", 'err');
  const inc = reqs.find(r => r.from === uid); if (inc) return acceptReq(inc.id);
  const toName = (await getDoc(doc(db, 'users', uid))).data().username;
  await setDoc(doc(db, 'friendRequests', `${me.uid}_${uid}`), { from: me.uid, fromName: P.username, to: uid, toName, status: 'pending' }); toast('Friend request sent!', 'ok');
}
async function acceptReq(id) {
  const r = reqs.find(x => x.id === id); if (!r) return;
  await updateDoc(doc(db, 'friendRequests', id), { status: 'accepted' });
  const b = writeBatch(db); b.set(doc(db, 'friends', me.uid, 'list', r.from), { name: r.fromName }); b.set(doc(db, 'friends', r.from, 'list', me.uid), { name: P.username }); await b.commit();
  toast('Friend added!', 'ok');
}
function etMidnight() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(p => [p.type, p.value]));
  for (const off of [4, 5]) { const t = Date.UTC(+parts.year, +parts.month - 1, +parts.day, off); const h = +new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }).format(t); if (h % 24 === 0) return t; }
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, 5);
}
async function purgeDMs() {
  if (!me) return; const cut = new Date(etMidnight());
  try {
    const fr = await getDocs(collection(db, 'friends', me.uid, 'list'));
    for (const f of fr.docs) { const pair = [me.uid, f.id].sort().join('_'); const old = await getDocs(query(collection(db, 'dms', pair, 'messages'), where('t', '<', cut))); await batchDelete(old.docs.map(d => d.ref)); }
  } catch (e) { console.warn('dm purge', e); }
}
setInterval(purgeDMs, 15 * 60 * 1000);
function openDM(uid, name) {
  const pair = [me.uid, uid].sort().join('_'); const cut = etMidnight();
  modal(`<h2>💬 ${nameHTML(name)}</h2><div id="dmlist" class="comments" style="height:300px"></div><div class="row"><input id="dmtext" maxlength="300" placeholder="Message…" style="flex:1;margin:0"><button class="btn green sm" data-act="dmsend" data-pair="${pair}">Send</button></div><p class="muted">Messages are deleted every day at 12am EST.</p>`);
  const un = onSnapshot(query(collection(db, 'dms', pair, 'messages'), orderBy('t')), s => {
    const el = $('#dmlist'); if (!el) return;
    el.innerHTML = s.docs.map(d => d.data()).filter(m => !m.t || m.t.toMillis() >= cut).map(m => `<div class="cm" style="${m.from === me.uid ? 'background:#17673a' : ''}"><b>${nameHTML(m.fromName)}</b><br>${esc(m.text)}</div>`).join('') || '<p class="muted">No messages today.</p>'; el.scrollTop = 1e9;
  }, e => toast(errMsg(e), 'err'));
  modalClose = un;
}

/* ================= editor: slots ================= */
let slots = [];
const skey = () => `dash_levels_${me ? me.uid : 'anon'}`;
function loadSlots() { try { slots = JSON.parse(localStorage[skey()] || '[]'); } catch { slots = []; } while (slots.length < SLOTS) slots.push(null); slots.length = SLOTS; }
let pushT = {};
function saveSlots(i) {
  localStorage[skey()] = JSON.stringify(slots);
  if (me && i != null && i >= 0 && slots[i]) { clearTimeout(pushT[i]); pushT[i] = setTimeout(() => { const j = JSON.stringify(slots[i]); if (j.length < 900000) setDoc(doc(db, 'users', me.uid, 'drafts', 's' + i), { slot: i, lv: j, updated: slots[i].updated || 0 }).catch(() => { }); }, 1500); }
}
async function pullDrafts() {
  try {
    const s = await getDocs(collection(db, 'users', me.uid, 'drafts')); let ch = false;
    s.forEach(d => { const r = d.data(), l = slots[r.slot]; if (!l || (r.updated || 0) > (l.updated || 0)) { try { slots[r.slot] = JSON.parse(r.lv); ch = true; } catch { } } });
    if (ch) { localStorage[skey()] = JSON.stringify(slots); if (cur === 'editor') views.editor(); }
  } catch { }
}
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h.toString(36) + s.length; };
const sigOf = objs => hash(objs.map(o => JSON.stringify(o)).join('|'));
const newLevel = name => ({ name, desc: '', objs: [], bg: '#2b5fd9', ground: '#173a94', songName: '', verified: '', pub: null, updated: Date.now() });
views.editor = () => {
  if (!me) { return page('Editor', '<div class="card"><h3>Log in to create levels</h3><p class="muted">Anonymous players can view and play levels. Open the Account menu to log in or sign up.</p><button class="btn green" data-act="go" data-v="account">Account</button></div>'); }
  const cards = slots.map((l, i) => {
    if (!l) return `<div class="card" style="text-align:center"><b>Slot ${i + 1}</b><div class="muted" style="margin:10px 0">Empty</div><button class="btn green sm" data-act="slotnew" data-i="${i}">＋ New level</button></div>`;
    const ok = l.verified === sigOf(l.objs), pub = !!l.pub;
    return `<div class="card"><b>${esc(l.name)}</b> <span class="muted">· ${l.objs.length} objects</span><div class="muted">${pub ? '🌐 Published (locked)' : ok ? '✔ Verified' : 'Not verified'}${l.songName ? ' · 🎵 ' + esc(l.songName) : ''}</div><div class="muted" style="min-height:20px">${esc(l.desc)}</div><div class="row" style="margin-top:8px">${pub ? `<button class="btn blue sm" data-act="openlvl" data-id="${l.pub}">View</button>` : `<button class="btn orange sm" data-act="slotedit" data-i="${i}" title="Edit">🔧</button><button class="btn sm" data-act="slotrename" data-i="${i}">Rename</button><button class="btn sm" data-act="slotdesc" data-i="${i}">Description</button><button class="btn green sm" data-act="slotpub" data-i="${i}" ${ok ? '' : 'disabled'}>⬆ Upload</button>`}<button class="btn sm" data-act="slotcopy" data-i="${i}">Copy</button><button class="btn red sm" data-act="slotdel" data-i="${i}">Delete</button></div></div>`;
  }).join('');
  page('Level Editor', `<p class="muted">20 level slots. Beat your level from 0-100% in the editor to unlock Upload. Published levels can't be edited, but you can copy them.</p><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">${cards}</div>`);
};

/* ================= editor: canvas ================= */
const ed = { on: false, slot: -1, lv: null, camX: -90, camY: -80, z: 1, mode: 'build', tool: 'block', rot: 0, sel: null, hist: [], mx: 300, my: 300, wx: 0, wy: 0, drag: null, tab: 'blocks' };
const iconCache = {};
function objIcon(t) {
  if (iconCache[t]) return iconCache[t];
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
  const o = { t, r: 0, col: t === 'trig_color' ? '#ff5252' : undefined };
  if (t.startsWith('port')) drawObj(c, o, 20, 32, 24, '#000', true); else drawObj(c, o, 10, 10, 44, defColor(t), true);
  return iconCache[t] = cv.toDataURL();
}
function openEditor(i) {
  ed.slot = i; ed.lv = slots[i]; ed.camX = -90; ed.camY = -80; ed.z = 1; ed.sel = null; ed.hist = []; ed.mode = 'build'; ed.on = true;
  showLayer('edit'); setTrack('editor'); renderEdUI(); renderProps(); edDraw();
}
function renderEdUI() {
  document.querySelectorAll('#edModes button').forEach(b => b.classList.toggle('on', b.dataset.m === ed.mode));
  const cats = [...new Set(Object.values(OBJ).map(o => o.cat))];
  $('#edTabs').innerHTML = cats.map(c => `<button class="${c === ed.tab ? 'on' : ''}" data-act="edtab" data-c="${c}">${c}</button>`).join('') + `<button data-act="edrot">↻ Rotate (Q/E)</button>`;
  $('#edItems').innerHTML = Object.entries(OBJ).filter(([, o]) => o.cat === ed.tab).map(([t, o]) => `<button class="it ${t === ed.tool ? 'on' : ''}" data-act="edtool" data-t="${t}"><img src="${objIcon(t)}">${o.name}</button>`).join('');
  const ok = ed.lv && ed.lv.verified === sigOf(ed.lv.objs); $('#edStatus').textContent = `${ed.lv.name} · ${ed.lv.objs.length} obj · ${ok ? '✔ Verified' : 'Not verified'}`;
}
const snap = () => { const s = JSON.stringify(ed.lv.objs); if (ed.hist[ed.hist.length - 1] !== s) { ed.hist.push(s); if (ed.hist.length > 60) ed.hist.shift(); } };
let asT = null;
function changed() { ed.lv.updated = Date.now(); clearTimeout(asT); asT = setTimeout(() => saveSlots(ed.slot), 800); renderEdUI(); }
function s2w(e) { const cv = $('#editCanvas'), H = cv.clientHeight; ed.mx = e.offsetX; ed.my = e.offsetY; ed.wx = e.offsetX / ed.z + ed.camX; ed.wy = (H - e.offsetY) / ed.z + ed.camY; return [ed.wx, ed.wy]; }
function pick(cx, cy) { const os = ed.lv.objs; for (let i = os.length - 1; i >= 0; i--) { const o = os[i]; const h = o.t.startsWith('port') ? (o.x === cx && (o.y === cy || o.y + 1 === cy)) : (o.x === cx && o.y === cy); if (h) return o; } return null; }
function place(cx, cy) {
  if (cx < 0 || cy < 0) return; const lv = ed.lv, t = ed.tool;
  if (lv.objs.some(o => o.t === t && o.x === cx && o.y === cy && (o.r || 0) === ed.rot)) return;
  if (!OBJ[t].trig) lv.objs = lv.objs.filter(o => OBJ[o.t].trig || !(o.x === cx && o.y === cy));
  if (t === 'trig_end') lv.objs = lv.objs.filter(o => o.t !== 'trig_end');
  const o = { t, x: cx, y: cy, r: ed.rot, g: 0 };
  if (t === 'block' || t === 'spike') o.c = '#0d0d22';
  if (t === 'trig_color') Object.assign(o, { tg: 1, col: '#ff5252', dur: 1 });
  if (t === 'trig_move') Object.assign(o, { tg: 1, dx: 5, dy: 0, dur: 1 });
  lv.objs.push(o); changed();
}
function delAt(cx, cy) { const n = ed.lv.objs.length; ed.lv.objs = ed.lv.objs.filter(o => !(o.x === cx && (o.t.startsWith('port') ? (o.y === cy || o.y + 1 === cy) : o.y === cy))); if (ed.sel && !ed.lv.objs.includes(ed.sel)) { ed.sel = null; renderProps(); } if (n !== ed.lv.objs.length) changed(); }
function renderProps() {
  const el = $('#edProps'), o = ed.sel; if (!o) return el.classList.remove('open'); el.classList.add('open');
  let h = `<h3>${OBJ[o.t].name}</h3>`;
  if (o.t === 'trig_color') h += `<label>Target group (0 = background, -1 = ground)<input type="number" data-p="tg" value="${o.tg}"></label><label>Color<input type="color" data-p="col" value="${o.col}"></label><label>Duration (s)<input type="number" step=".1" min="0" data-p="dur" value="${o.dur}"></label>`;
  else if (o.t === 'trig_move') h += `<label>Target group<input type="number" min="1" data-p="tg" value="${o.tg}"></label><label>Move X (blocks)<input type="number" data-p="dx" value="${o.dx}"></label><label>Move Y (blocks)<input type="number" data-p="dy" value="${o.dy}"></label><label>Duration (s)<input type="number" step=".1" min="0" data-p="dur" value="${o.dur}"></label>`;
  else if (o.t === 'trig_end') h += '<p class="muted">Touching this ends the level.</p>';
  else { h += `<label>Group (0 = none)<input type="number" min="0" data-p="g" value="${o.g || 0}"></label>`; if (o.t === 'block' || o.t === 'spike') h += `<label>Color<input type="color" data-p="c" value="${o.c || '#0d0d22'}"></label>`; }
  h += `<div class="row">${['spike', 'pad_y', 'pad_p'].includes(o.t) ? '<button class="btn sm" data-act="edrot">↻ Rotate</button>' : ''}<button class="btn sm red" data-act="eddel">Delete</button></div>`; el.innerHTML = h;
}
function edDraw() {
  if (!ed.on) return; requestAnimationFrame(edDraw);
  const cv = $('#editCanvas'), d = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== W * d || cv.height !== H * d) { cv.width = W * d; cv.height = H * d; }
  const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); const z = ed.z, cs = U * z, lv = ed.lv, X = x => (x - ed.camX) * z, Y = y => H - (y - ed.camY) * z, now = performance.now() / 1000;
  c.fillStyle = lv.bg; c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1; c.beginPath();
  for (let gx = Math.floor(ed.camX / U) * U; X(gx) < W; gx += U) { c.moveTo(X(gx), 0); c.lineTo(X(gx), H); }
  for (let gy = Math.floor(ed.camY / U) * U; Y(gy) > 0; gy += U) { c.moveTo(0, Y(gy)); c.lineTo(W, Y(gy)); } c.stroke();
  if (Y(0) < H) { c.fillStyle = lv.ground; c.fillRect(0, Y(0), W, H - Y(0)); c.fillStyle = '#fff'; c.fillRect(0, Y(0) - 1, W, 3); }
  c.strokeStyle = '#3ddc4a'; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(X(0), 0); c.lineTo(X(0), H); c.stroke(); c.setLineDash([]);
  c.globalAlpha = .5; c.save(); c.translate(X(15), Y(15)); drawIcon(c, P?.skin || 0, PRIMARY[P?.c1 || 0], SECONDARY[P?.c2 || 0], cs); c.restore(); c.globalAlpha = 1;
  for (const o of lv.objs) { const sx = X(o.x * U), sy = Y(o.y * U + U); if (sx < -cs * 2 || sx > W + cs || sy < -cs * 3 || sy > H + cs) continue; drawObj(c, o, sx, sy, cs, o.c || defColor(o.t), true, now); }
  if (ed.sel) { const o = ed.sel; c.strokeStyle = '#ffe36b'; c.lineWidth = 3; c.strokeRect(X(o.x * U) - 2, Y(o.y * U + U) - 2, cs + 4, cs + 4); }
  if (ed.mode === 'build') { const cx = Math.floor(ed.wx / U), cy = Math.floor(ed.wy / U); if (cx >= 0 && cy >= 0) { c.globalAlpha = .5; drawObj(c, { t: ed.tool, r: ed.rot }, X(cx * U), Y(cy * U + U), cs, defColor(ed.tool), true, now); c.globalAlpha = 1; } }
}
(() => {
  const cv = $('#editCanvas');
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId); const [wx, wy] = s2w(e), cx = Math.floor(wx / U), cy = Math.floor(wy / U);
    if (e.button === 1 || e.button === 2 || ed.mode === 'pan') { ed.drag = { k: 'pan', x: e.clientX, y: e.clientY }; return; }
    snap();
    if (ed.mode === 'build') { ed.drag = { k: 'paint' }; place(cx, cy); }
    else if (ed.mode === 'delete') { ed.drag = { k: 'del' }; delAt(cx, cy); }
    else { ed.sel = pick(cx, cy); renderProps(); ed.drag = ed.sel ? { k: 'move', cx, cy } : null; }
  });
  cv.addEventListener('pointermove', e => {
    const [wx, wy] = s2w(e), cx = Math.floor(wx / U), cy = Math.floor(wy / U), dr = ed.drag; if (!dr) return;
    if (dr.k === 'pan') { ed.camX -= (e.clientX - dr.x) / ed.z; ed.camY += (e.clientY - dr.y) / ed.z; dr.x = e.clientX; dr.y = e.clientY; }
    else if (dr.k === 'paint') place(cx, cy); else if (dr.k === 'del') delAt(cx, cy);
    else if (dr.k === 'move' && ed.sel && (cx !== dr.cx || cy !== dr.cy)) { ed.sel.x = Math.max(0, ed.sel.x + cx - dr.cx); ed.sel.y = Math.max(0, ed.sel.y + cy - dr.cy); dr.cx = cx; dr.cy = cy; changed(); renderProps(); }
  });
  const up = () => { ed.drag = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) { const f = e.deltaY < 0 ? 1.1 : .9, bx = e.offsetX / ed.z + ed.camX; ed.z = Math.max(.4, Math.min(2.5, ed.z * f)); ed.camX = bx - e.offsetX / ed.z; }
    else if (e.shiftKey) ed.camX += e.deltaY / ed.z; else { ed.camY -= e.deltaY / ed.z; ed.camX += e.deltaX / ed.z; }
  }, { passive: false });
})();
function edRotate() { if (ed.sel) { if (['spike', 'pad_y', 'pad_p'].includes(ed.sel.t)) { snap(); ed.sel.r = ((ed.sel.r || 0) + 1) % 4; changed(); } } else ed.rot = (ed.rot + 1) % 4; }
addEventListener('keydown', e => {
  if (!ed.on || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || $('#modal').classList.contains('open')) return;
  const k = e.key.toLowerCase(), st = 60 / ed.z;
  if (k === 'q' || k === 'e') edRotate();
  else if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); edUndo(); }
  else if (k === 'delete' || k === 'backspace') { if (ed.sel) { snap(); ed.lv.objs = ed.lv.objs.filter(o => o !== ed.sel); ed.sel = null; renderProps(); changed(); } }
  else if (k === 'arrowleft') ed.camX -= st; else if (k === 'arrowright') ed.camX += st; else if (k === 'arrowup') ed.camY += st; else if (k === 'arrowdown') ed.camY -= st;
  else if (k === 'p') edPlay(e.shiftKey);
  else if (k === 'escape') { ed.sel = null; renderProps(); }
});
function edUndo() { if (!ed.hist.length) return; ed.lv.objs = JSON.parse(ed.hist.pop()); ed.sel = null; renderProps(); changed(); }
document.addEventListener('focusin', e => { if (e.target.dataset?.p && ed.on) snap(); });
document.addEventListener('input', e => {
  if (e.target.id === 'volr') { settings.vol = +e.target.value; saveSettings(); return; }
  const p = e.target.dataset?.p; if (!p || !ed.sel) return;
  ed.sel[p] = (e.target.type === 'number') ? (+e.target.value || 0) : e.target.value; changed();
});
function edPlay(here) {
  const lv = ed.lv; if (!lv.objs.some(o => o.t === 'trig_end')) return toast('Add an End Trigger first (Triggers tab)', 'err');
  let sx = 0, sy = 0; if (here) { sx = Math.max(0, Math.floor(ed.wx / U) * U); sy = Math.max(0, Math.floor(ed.wy / U) * U); }
  saveSlots(ed.slot); ed.on = false;
  idbGet(`draft:${me.uid}:${ed.slot}`).then(b => {
    startPlay({ level: { objs: lv.objs, bg: lv.bg, ground: lv.ground }, kind: 'test', lv0: lv, startX: sx, startY: sy, songUrl: b instanceof Blob ? URL.createObjectURL(b) : null, onExit: () => { ed.on = true; showLayer('edit'); renderEdUI(); edDraw(); } });
  });
}
async function edBack() { ed.on = false; saveSlots(ed.slot); clearTimeout(pushT[ed.slot]); const j = JSON.stringify(ed.lv); if (me && j.length < 900000) setDoc(doc(db, 'users', me.uid, 'drafts', 's' + ed.slot), { slot: ed.slot, lv: j, updated: ed.lv.updated || 0 }).catch(() => { }); showLayer('view'); setTrack('menu'); views.editor(); renderFooter(); }
function edSettings() {
  const lv = ed.lv;
  modal(`<h2>Level settings</h2><label>Title<input id="lvName" maxlength="30" value="${esc(lv.name)}"></label><label>Description<textarea id="lvDesc" maxlength="200" rows="3">${esc(lv.desc)}</textarea></label><div class="row"><label style="flex:1">Background<input type="color" id="lvBg" value="${lv.bg}"></label><label style="flex:1">Ground<input type="color" id="lvGr" value="${lv.ground}"></label></div><label>Level song (mp3)<input type="file" id="songfile" accept="audio/mpeg,audio/*"></label><p class="muted">${lv.songName ? '🎵 ' + esc(lv.songName) : 'No song set'} - the song is played in sync with where you start a playtest, and uploaded to the servers when you publish.</p><div class="row"><button class="btn green" data-act="edsave">Save</button>${lv.songName ? '<button class="btn red" data-act="edsong-rm">Remove song</button>' : ''}</div>`);
}

/* ================= actions (click delegation) ================= */
const val = id => $('#' + id)?.value ?? '';
const actions = {
  go: d => go(d.v, { ...d }), back: () => back(), closemodal: closeModal,
  acctab: d => views.account({ tab: d.t }),
  login: async () => { const u = val('au').trim(), p = val('ap'); if (!u || !p) throw 'Enter a username and password'; await signInWithEmailAndPassword(auth, emailOf(u), p); },
  signup: async () => { await signUp(val('au'), val('ap')); toast('Welcome to DASH!', 'ok'); },
  logout: async () => { await signOut(auth); toast('Logged out'); },
  myprofile: () => me && showProfile(me.uid),
  tog: d => { settings[d.k] = !settings[d.k]; saveSettings(); views.account({ tab: 'settings' }); },
  equip: async d => {
    if (!me) return toast('Log in to customize your icon', 'err'); const un = unlocked_(), i = +d.i;
    if (!un[d.k].has(i)) { const a = ACH.find(a => a.rw.k === d.k && a.rw.i === i); return toast('🔒 ' + (a ? `${a.name}: ${a.desc}` : 'Locked'), 'err'); }
    const f = d.k === 'skin' ? 'skin' : d.k === 'p' ? 'c1' : 'c2'; P[f] = i; await updateDoc(doc(db, 'users', me.uid), { [f]: i }); renderFooter(); views.cosmetics();
  },
  openlvl: d => { closeModal(); go('level', { id: d.id }); },
  pg: d => renderLevels(d.kind, +d.pg),
  playlvl: d => playPublished(d.id),
  vote: d => vote(d.id, +d.v),
  comment: async d => {
    const t = val('cmt').trim(); if (!t) return; await addDoc(collection(db, 'levels', d.id, 'comments'), { uid: me.uid, name: P.username, text: t, t: serverTimestamp() });
    P.comments = (P.comments || 0) + 1; updateDoc(doc(db, 'users', me.uid), { comments: increment(1) }).catch(() => { }); checkAch(); views.level({ id: d.id });
  },
  delcm: async d => { await deleteDoc(doc(db, 'levels', d.id, 'comments', d.cid)); views.level({ id: d.id }); },
  dlsong: d => downloadSong(d.id),
  takedown: async d => { if (!confirm('Take this level off the servers? All its stats will be cleared.')) return; await takeDown(d.id); toast('Level removed', 'ok'); refreshMyStats(); back(); },
  ratemenu: d => modal(`<h2>Rate level</h2><div class="rate-grid">${DIFFS.map(x => `<button data-act="rate" data-id="${d.id}" data-d="${x.id}"><img src="${diffURL(x.id, 62)}">${x.name}<br>⭐ ${x.stars}</button>`).join('')}</div>`),
  rate: d => rateLevel(d.id, d.d),
  profile: d => showProfile(d.uid),
  lbtab: d => views.lb({ tab: d.t, stat: d.stat || curP.stat }),
  addfriend: async d => { await addFriend(d.name || val('fname')); },
  accept: d => acceptReq(d.id).then(() => views.lb({ tab: 'friends' })),
  decline: async d => { await deleteDoc(doc(db, 'friendRequests', d.id)); },
  dm: d => { closeModal(); openDM(d.uid, d.name); },
  dmsend: async d => { const t = val('dmtext').trim(); if (!t) return; $('#dmtext').value = ''; await addDoc(collection(db, 'dms', d.pair, 'messages'), { from: me.uid, fromName: P.username, text: t, t: serverTimestamp() }); },
  ban: async d => { if (!confirm(`Ban ${d.name}? This deletes their account data and levels.`)) return; await banUser(d.uid, d.name); closeModal(); toast(`${d.name} banned`, 'ok'); },
  // play
  resume: pauseToggle, restart: () => { $('#winBox').classList.remove('open'); $('#pauseBox').classList.remove('open'); game.start({ x: PL.sx, y: PL.sy }); },
  exitplay: () => stopPlay(),
  // editor slots
  slotnew: d => { if (!me) return; const i = +d.i; slots[i] = newLevel('Level ' + (i + 1)); saveSlots(i); openEditor(i); },
  slotedit: d => openEditor(+d.i),
  slotrename: d => { const l = slots[+d.i], n = prompt('Level name', l.name); if (n && n.trim()) { l.name = n.trim().slice(0, 30); l.updated = Date.now(); saveSlots(+d.i); views.editor(); } },
  slotdesc: d => { const l = slots[+d.i], n = prompt('Description', l.desc); if (n !== null) { l.desc = n.slice(0, 200); l.updated = Date.now(); saveSlots(+d.i); views.editor(); } },
  slotdel: async d => { const i = +d.i; if (!confirm('Delete this level slot? (Published copies stay on the servers.)')) return; slots[i] = null; saveSlots(); idbDel(`draft:${me.uid}:${i}`); deleteDoc(doc(db, 'users', me.uid, 'drafts', 's' + i)).catch(() => { }); views.editor(); },
  slotcopy: async d => {
    const i = +d.i, f = slots.findIndex(x => !x); if (f < 0) return toast('No free slots', 'err');
    const c = JSON.parse(JSON.stringify(slots[i])); c.name = (c.name + ' copy').slice(0, 30); c.pub = null; c.verified = ''; c.updated = Date.now(); slots[f] = c; saveSlots(f);
    const b = await idbGet(`draft:${me.uid}:${i}`); if (b) idbSet(`draft:${me.uid}:${f}`, b); toast('Copied to slot ' + (f + 1), 'ok'); views.editor();
  },
  slotpub: async d => { await publish(+d.i); },
  // editor
  edback: edBack, edmode: d => { ed.mode = d.m; ed.drag = null; renderEdUI(); }, edundo: edUndo, edplay: () => edPlay(false), edplayhere: () => edPlay(true),
  edtab: d => { ed.tab = d.c; renderEdUI(); }, edtool: d => { ed.tool = d.t; ed.mode = 'build'; ed.sel = null; renderProps(); renderEdUI(); },
  edrot: edRotate, edsettings: edSettings,
  eddel: () => { if (ed.sel) { snap(); ed.lv.objs = ed.lv.objs.filter(o => o !== ed.sel); ed.sel = null; renderProps(); changed(); } },
  edsave: () => { const lv = ed.lv; lv.name = val('lvName').trim().slice(0, 30) || lv.name; lv.desc = val('lvDesc').slice(0, 200); lv.bg = val('lvBg'); lv.ground = val('lvGr'); lv.updated = Date.now(); saveSlots(ed.slot); closeModal(); renderEdUI(); },
  'edsong-rm': async () => { ed.lv.songName = ''; await idbDel(`draft:${me.uid}:${ed.slot}`); saveSlots(ed.slot); closeModal(); },
};
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const f = actions[a.dataset.act]; if (!f) return;
  Promise.resolve().then(() => f(a.dataset, a, e)).catch(err => { console.error(err); toast(errMsg(err), 'err'); });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') { if (e.target.id === 'ap' || e.target.id === 'au') actions.login().catch(err => toast(errMsg(err), 'err')); else if (e.target.id === 'cmt') $('[data-act=comment]')?.click(); else if (e.target.id === 'dmtext') $('[data-act=dmsend]')?.click(); else if (e.target.id === 'fname') actions.addfriend({}).catch(err => toast(errMsg(err), 'err')); }
  if (e.key === 'Escape' && $('#modal').classList.contains('open')) closeModal();
});
document.addEventListener('change', async e => {
  if (e.target.id === 'songfile' && e.target.files[0]) {
    const f = e.target.files[0]; if (f.size > 12 * 1024 * 1024) return toast('Song must be under 12 MB', 'err');
    await idbSet(`draft:${me.uid}:${ed.slot}`, f); ed.lv.songName = f.name.slice(0, 60); saveSlots(ed.slot); toast('Song added', 'ok'); edSettings();
  }
});
$('#pauseBtn').addEventListener('click', e => { e.stopPropagation(); pauseToggle(); });
$('#modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal') closeModal(); });

/* ================= publish & moderation ================= */
async function publish(i) {
  const lv = slots[i]; if (!me || !P) return toast('Log in first', 'err');
  if (lv.verified !== sigOf(lv.objs)) return toast('Beat the level from 0 to 100% first', 'err');
  if (!confirm(`Publish "${lv.name}"? Published levels can't be edited (you can copy them).`)) return;
  const r = doc(collection(db, 'levels')); let songUrl = null, songName = null; toast('Uploading…');
  const sb = await idbGet(`draft:${me.uid}:${i}`);
  if (sb instanceof Blob) { const sr = sref(storage, `songs/${r.id}.mp3`); await uploadBytes(sr, sb, { contentType: sb.type || 'audio/mpeg' }); songUrl = await getDownloadURL(sr); songName = lv.songName; }
  const data = JSON.stringify({ objs: lv.objs, bg: lv.bg, ground: lv.ground }); if (data.length > 900000) throw 'Level is too big to upload';
  await setDoc(r, { authorId: me.uid, authorName: P.username, title: lv.name, desc: lv.desc, data, status: 'unrated', diff: null, stars: 0, views: 0, likes: 0, dislikes: 0, created: serverTimestamp(), songUrl, songName, count: lv.objs.length });
  lv.pub = r.id; saveSlots(i); refreshMyStats(); toast('Published! Vortarium has been pinged to rate it.', 'ok'); views.editor();
}
async function banUser(uid, name) {
  const ls = await getDocs(query(collection(db, 'levels'), where('authorId', '==', uid))); for (const d of ls.docs) await takeDown(d.id);
  for (const sub of ['beaten', 'progress', 'drafts']) await delCol(['users', uid, sub]).catch(() => { });
  await delCol(['friends', uid, 'list']).catch(() => { });
  await deleteDoc(doc(db, 'users', uid)); await deleteDoc(doc(db, 'usernames', name.toLowerCase())).catch(() => { });
  await setDoc(doc(db, 'banned', uid), { name, t: serverTimestamp() });
}

/* ================= boot ================= */
loadSlots(); renderFooter(); go('menu');
