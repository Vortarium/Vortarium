// Earth core simulation: economy, tech, events, diplomacy, history, collapse, offline catch-up
const BUILD = {
  hut:{n:"Hut",c:{wood:30},t:"Housing +8"}, gather:{n:"Gatherer camp",c:{wood:20},t:"+60 kg food/day (by biome)"},
  well:{n:"Well",c:{wood:15,stone:10},t:"+600 L water/day"}, granary:{n:"Granary",c:{wood:40},t:"Cuts spoilage 70%"},
  shrine:{n:"Shrine",c:{wood:30,stone:20},t:"+3 happiness, faith"}, workshop:{n:"Workshop",c:{wood:40,stone:20},t:"+knowledge, materials"},
  market:{n:"Market",c:{wood:60,stone:40},t:"Trade and +15 coin/day"}, barracks:{n:"Barracks",c:{wood:60,stone:60},t:"Train soldiers"}};
const TECH = [["fire","Fire",50],["agri","Agriculture",150],["pottery","Pottery",300],["bronze","Bronze working",500],["writing","Writing",800],["iron","Iron working",1300],["math","Mathematics",2000],["currency","Currency",3000],["nuclear","Nuclear fission",20000]];
const ERAS = ["Tribal","Neolithic","Bronze Age","Iron Age","Classical"];
const FERT = {8:.05,9:.1,10:.3,11:.2,12:.5,13:.9,14:1,15:.6,16:.7,17:.6,18:.1,19:.15,20:.05,21:.9,22:1,23:.5,24:.05};

import { initGround } from "./earth_ground.js";
export function initGame(C) {
  const { THREE, globe, cam, db, me, empire, world, BIOMES, play, snd, fs, W, H, setDist } = C, { doc, setDoc, getDocs, collection, addDoc, query, orderBy, limit, updateDoc, deleteDoc, where } = fs;
  const $ = id => document.getElementById(id), bi = world.b[empire.spawn.y * W + empire.spawn.x];
  const fert = FERT[bi] ?? .5, wm = [18,19,20].includes(bi) ? .15 : [8,9].includes(bi) ? .5 : 1, wdm = [12,13,21,22,23].includes(bi) ? 1.5 : .5, stm = [11,24,19].includes(bi) ? 1.5 : .6;
  const s = empire.s ||= { food:12000, water:8000, wood:150, stone:40, coin:20, know:0, pop:empire.pop, happy:70, army:0, b:{hut:2,gather:1}, techs:[], rel:{}, faith:0, unrest:0, days:0 };
  s.pl ||= []; s.impose ||= "none";
  let wx = "Clear", ruins = [], last = empire.lastSave || Date.now(), others = [], dead = false, quiet = true, sf = 1, shake = 0, tab = null;
  const n = k => s.b[k] || 0, tc = t => s.techs.includes(t), cap = () => 40 + n("hut") * 8 + (tc("pottery") ? 20 : 0), era = () => ERAS[Math.min(4, s.techs.length >> 1)];
  const log = async text => { try { await addDoc(collection(db, "history"), { text, by: empire.name, t: C.gameTime().str, at: Date.now() }); } catch {} };
  const toast = (t, sfx) => { if (quiet) return; const d = $("toast"); d.textContent = t; d.style.opacity = 1; clearTimeout(toast.h); toast.h = setTimeout(() => d.style.opacity = 0, 5000); if (sfx) play(sfx); };

  // ---- UI shell ----
  const hud = $("hud");
  hud.insertAdjacentHTML("beforeend", `<div id="toast"></div><div id="bar">${["build","research","trade","military","diplomacy","history","settings"].map(k => `<button data-a="tab:${k}">${k}</button>`).join("")}<button data-a="save">save</button></div><div id="panel" hidden></div><div id="lb" hidden></div><div id="over" class="screen"><div class="card"><h2>Empire collapsed</h2><p id="overmsg" class="sub"></p><p class="sub">This account is forgotten. Create a new account to begin again.</p></div></div>`);

  function season() { const g = C.gameTime(), north = empire.spawn.y < H / 2, sn = north ? g.north : g.south; sf = sn === "Winter" ? .6 : sn === "Summer" ? 1.1 : 1; wx = weather(); return sn; }
  function weather() { const p = Math.floor((Date.now() - C.startMs) / 4320000), h = Math.abs(Math.sin((empire.spawn.x >> 3) * 12.9898 + (empire.spawn.y >> 3) * 78.233 + p * 37.719) * 43758.5453) % 1, cold = sf < 1 || [8, 9, 10, 12].includes(bi), hot = [16, 18, 19, 20, 21].includes(bi); return h < .35 ? "Clear" : h < .55 ? "Overcast" : h < .75 ? (cold ? "Snow" : "Rain") : h < .9 ? (hot ? "Heatwave" : "Storm") : "Fog"; }

  // ---- simulation (min = game minutes) ----
  function step(min) {
    const d = min / 1440, wk = s.pop * .6;
    s.food += ((s.pop * 1.2 * fert + n("gather") * 60 * fert) * (tc("agri") ? 1.6 : 1) * sf * (wx === "Storm" || wx === "Snow" ? .85 : 1) - s.pop * 2) * d;
    s.food -= s.food * .01 * d * (n("granary") ? .3 : 1);
    s.water += (s.pop * 2.5 * wm * (wx === "Rain" ? 1.5 : wx === "Heatwave" ? .7 : 1) + n("well") * 600 - s.pop * 3) * d;
    s.wood += (wk * .05 * wdm + n("workshop") * 10) * d; s.stone += (wk * .03 * stm + n("workshop") * 6) * d;
    s.know += (s.pop * .02 + n("workshop") * 8 + n("shrine") * 2) * (1 + .05 * others.length) * d; s.coin += (n("market") * 15 + s.pop * .01) * d;
    s.coin -= s.army * .5 * d; if (s.coin < 0) { s.coin = 0; s.army = Math.max(0, Math.floor(s.army * (1 - .1 * d))); }
    s.days += d;
    const starving = s.food <= 0, thirsty = s.water <= 0; s.food = Math.max(0, s.food); s.water = Math.max(0, s.water);
    const war = Object.values(s.rel).includes("war"), target = 60 + n("shrine") * 3 + s.faith * .5 - (starving ? 35 : 0) - (thirsty ? 35 : 0) - (s.pop > cap() ? 15 : 0) - (war ? 8 : 0);
    s.happy += (Math.min(100, target) - s.happy) * Math.min(1, d * .3); s.happy = Math.max(0, Math.min(100, s.happy));
    if (!starving && !thirsty && s.happy > 40 && s.pop < cap()) s.pop += s.pop * .004 * d;
    if (starving) s.pop -= s.pop * .03 * d; if (thirsty) s.pop -= s.pop * .08 * d;
    s.unrest = s.happy < 20 ? s.unrest + d : Math.max(0, s.unrest - d);
    if (Math.random() < .015 * d) event();
    if (s.unrest > 30) return collapse("overthrown by a rebellion of its unhappy people");
    if (s.pop < 1) return collapse("its last people perished");
  }
  function event() {
    const r = Math.random(), mtn = [11, 24].includes(bi), forest = [12, 13, 21, 22].includes(bi);
    if (r < .3) { s.wood *= .8; toast("A storm batters your lands: 20% of wood lost."); }
    else if (r < .5) { s.water *= .6; toast("Drought: water reserves fall 40%."); }
    else if (r < (mtn ? .8 : .6)) { if (!quiet) { play("earthquake"); shake = 1; } const l = Math.max(1, s.pop * .02); s.pop -= l; toast(`Earthquake! ${Math.round(l)} people lost.`); log(`An earthquake struck the lands of ${empire.name}.`); }
    else if (forest) { const l = s.pop * .01; s.pop -= l; toast("Wild animals attacked your settlers."); }
  }
  async function collapse(why) {
    if (dead) return; dead = true; $("overmsg").textContent = `${empire.name} ${why}.`; $("over").classList.add("show");
    try { await setDoc(doc(db, "players", me.uid), { ...empire, collapsed: true, reason: why, pop: 0 }); } catch {} log(`${empire.name} collapsed: ${why}.`);
    setTimeout(() => C.signOut(C.auth).then(() => location.reload()), 7000);
  }
  async function save() { if (dead) return; last = Date.now(); Object.assign(empire, { uid: me.uid, pop: Math.round(s.pop), era: era(), lastSave: last }); try { await setDoc(doc(db, "players", me.uid), empire); } catch {} }

  // ---- panels ----
  const cost = c => Object.entries(c).map(([k, v]) => `${v} ${k}`).join(", ");
  function panel() {
    const p = $("panel"); if (!tab) { p.hidden = true; return; } p.hidden = false; let h = `<h3>${tab}</h3>`;
    if (tab === "build") h += Object.entries(BUILD).map(([k, b]) => `<div class="it"><b>${b.n}</b> ×${n(k)}<br><small>${b.t} · ${cost(b.c)}</small><button data-a="build:${k}">Build</button></div>`).join("");
    if (tab === "research") h += `<small>Knowledge: ${Math.floor(s.know)} (+5% speed per other player)</small>` + TECH.map(([id, nm, c]) => `<div class="it"><b>${nm}</b> ${tc(id) ? "✓" : `<small>${c} knowledge</small><button data-a="research:${id}">Learn</button>`}</div>`).join("");
    if (tab === "trade") h += n("market") ? `<div class="it">Sell 500 kg food → 25 coin<button data-a="trade:sell">Sell</button></div><div class="it">Buy 50 wood ← 20 coin<button data-a="trade:buy">Buy</button></div><div class="it">Spread faith (20 coin)<button data-a="faith">Spread</button></div>` : "Build a Market first.";
    if (tab === "military") h += `<div class="it">Army: ${s.army} soldiers<br><small>10 coin + 30 kg food each · needs Barracks</small><button data-a="train">Train</button><br><button data-a="impose">Conquest policy: ${s.impose}</button><button data-a="march">March</button></div>`;
    if (tab === "diplomacy") h += others.length ? others.map(o => `<div class="it"><b>${o.name}</b> pop ${o.pop} · UTC ${Math.round(((o.spawn.x + .5) * 360 / W - 180) / 15)} · ${s.rel[o.name] || "neutral"}<br><button data-a="dip:trade:${o.name}">Trade</button><button data-a="dip:peace:${o.name}">Peace</button><button data-a="dip:war:${o.name}">War</button><button data-a="dip:attack:${o.name}">Attack</button>${tc("nuclear") ? `<button data-a="dip:nuke:${o.name}">Nuke</button>` : ""}</div>`).join("") : "No other empires yet.";
    if (tab === "settings") h += `Music <input type="range" min="0" max="1" step=".05" value="${snd.music.volume}" data-v="1"><br><button data-a="ai">Ask advisor (optional AI)</button><br><small>Time: 1 real second = 1 game minute.</small>`;
    p.innerHTML = h; if (tab === "history") loadHistory(p, h);
  }
  async function loadHistory(p, h) { try { const q = await getDocs(query(collection(db, "history"), orderBy("at", "desc"), limit(40))); p.innerHTML = h + q.docs.map(d => { const v = d.data(); return `<div class="it"><small>${v.t}</small><br>${v.text}</div>`; }).join("") || h + "Nothing yet."; } catch { p.innerHTML = h + "Could not load history."; } }
  document.addEventListener("input", e => { if (e.target.dataset.v) snd.music.volume = +e.target.value; });
  hud.addEventListener("click", e => {
    const a = e.target.dataset.a; if (!a || dead) return; const [k, x, y] = a.split(":"); quiet = false;
    if (k === "tab") tab = tab === x ? null : x;
    else if (k === "save") { save(); toast("Game saved."); }
    else if (k === "build") { ui.sel = x; setDist(2.2); toast(`Click an explored land tile to place the ${BUILD[x].n}. (Esc cancels)`); }
    else if (k === "impose") s.impose = { none: "currency", currency: "faith", faith: "none" }[s.impose];
    else if (k === "research") { const t = TECH.find(t => t[0] === x); if (s.know >= t[2]) { s.know -= t[2]; s.techs.push(x); play("tech"); toast(`Discovered ${t[1]}.`); log(`${empire.name} discovered ${t[1]}.`); } else toast("Not enough knowledge."); }
    else if (k === "trade") { if (x === "sell" && s.food >= 500) { s.food -= 500; s.coin += 25; play("money"); } else if (x === "buy" && s.coin >= 20) { s.coin -= 20; s.wood += 50; play("money"); } else toast("Cannot trade."); }
    else if (k === "faith") { if (n("shrine") && s.coin >= 20) { s.coin -= 20; s.faith++; s.happy = Math.min(100, s.happy + 2); play("religion"); if (s.faith % 10 === 0) log(`The faith of ${empire.name} has grown to ${s.faith} devotions.`); } else toast("Needs a Shrine and 20 coin."); }
    else if (k === "train") { if (n("barracks") && s.coin >= 10 && s.food >= 30) { s.coin -= 10; s.food -= 30; s.army++; play("army2"); } else toast("Needs Barracks, coin and food."); }
    else if (k === "march") { if (s.army) play("army3"); }
    else if (k === "ai") { window.earthAI?.(`Briefly advise a tribal leader: pop ${Math.round(s.pop)}, food ${Math.round(s.food)} kg, water ${Math.round(s.water)} L, happiness ${Math.round(s.happy)}%.`).then(t => { quiet = false; toast(t || "Advisor unavailable. The game never depends on it."); quiet = true; }); }
    else if (k === "dip") { const [, , who] = a.split(":"); if (x === "attack" || x === "nuke") attack(who, x === "nuke"); else if (x === "war") { s.rel[who] = "war"; play("army"); log(`${empire.name} declared war on ${who}.`); } else if (x === "peace") { s.rel[who] = "peace"; log(`${empire.name} made peace with ${who}.`); } else if (n("market")) { s.rel[who] = "trade"; s.coin += 10; play("money"); } else toast("Needs a Market."); }
    quiet = true; panel(); render();
  });
  function render() {
    const sn = season(), pn = Math.round(s.pop), warn = s.food <= 0 ? " ⚠ starving" : s.water <= 0 ? " ⚠ dehydrating" : s.happy < 20 ? " ⚠ rebellion brewing" : "";
    $("stats").innerHTML = `<b>${era()}</b> · ${BIOMES[bi][0]} · ${sn} · ${wx}<br>Population: ${pn} / ${cap()}${warn}<br>Food: ${Math.round(s.food)} kg · Water: ${Math.round(s.water)} L<br>Wood ${Math.round(s.wood)} · Stone ${Math.round(s.stone)} · Knowledge ${Math.floor(s.know)}<br>Happiness: ${Math.round(s.happy)}% · Army: ${s.army}<br>${empire.currency}: ${Math.round(s.coin)}`;
    $("lb").hidden = C.getDist() < 4;
  }
  // ---- other players: leaderboard + markers ----
  const marks = new THREE.Group(); globe.add(marks);
  async function refresh() {
    try { const q = await getDocs(collection(db, "players")), all = q.docs.map(d => d.data()).filter(v => !v.collapsed); others = all.filter(v => v.owner !== empire.owner); ruins = q.docs.map(d => d.data()).filter(v => v.collapsed && v.spawn);
      $("lb").innerHTML = "<b>Leaderboard</b>" + all.sort((a, b) => b.pop - a.pop).slice(0, 10).map((v, i) => `<br>${i + 1}. ${v.name} · ${v.pop}`).join("");
      marks.clear(); all.forEach(v => { const la = (90 - (v.spawn.y + .5) * 180 / H) * Math.PI / 180, lo = ((v.spawn.x + .5) * 360 / W - 180) * Math.PI / 180, m = new THREE.Mesh(new THREE.SphereGeometry(.012 + Math.min(.03, v.pop / 20000), 12, 12), new THREE.MeshBasicMaterial({ color: v.owner === empire.owner ? 0xffd54f : 0xffffff }));
        m.position.set(1.51 * Math.cos(la) * Math.cos(lo), 1.51 * Math.sin(la), -1.51 * Math.cos(la) * Math.sin(lo)); m.userData = { name: v.name, pop: v.pop, me: v.owner === empire.owner }; marks.add(m); }); } catch {}
  }
  (function sk() { requestAnimationFrame(sk); if (shake > 0) { cam.position.x = (Math.random() - .5) * shake * .08; shake -= .02; } else cam.position.x = 0; })();

  const ui = { sel: null, place(type, x, y) { const b = BUILD[type]; if (!Object.entries(b.c).every(([r, v]) => s[r] >= v)) { toast("Not enough materials."); return false; } Object.entries(b.c).forEach(([r, v]) => s[r] -= v); s.b[type] = n(type) + 1; s.pl.push({ t: type, x, y }); play("build"); render(); return true; } };
  // ---- war & conquest: claims are resolved by the defender's own client ----
  async function attack(who, nuke) {
    const o = others.find(x => x.name === who); if (!o?.uid) return toast("That empire is unreachable.");
    if (nuke ? !(tc("nuclear") && s.coin >= 500) : s.army < 1) return toast(nuke ? "Needs Nuclear fission and 500 coin." : "You need soldiers.");
    const power = nuke ? 0 : s.army; if (nuke) s.coin -= 500; else s.army = Math.floor(s.army * .7); s.rel[who] = "war";
    await addDoc(collection(db, "claims"), { impose: s.impose, cur: empire.currency, fromUid: me.uid, from: empire.name, toUid: o.uid, to: who, power, nuke: !!nuke, at: Date.now() });
    play("army"); log(`${empire.name} ${nuke ? "launched a nuclear strike at" : "attacked"} ${who}.`); toast(nuke ? "Nuclear missile launched." : "Your army marches to war.");
  }
  async function inbox() {
    if (dead) return; try {
      for (const d of (await getDocs(query(collection(db, "claims"), where("toUid", "==", me.uid)))).docs) { const v = d.data(); if (v.resolved) continue; let won = true, loot = 0, sur = false;
        if (v.nuke) { play("nuke"); s.pop *= .4; s.happy = Math.max(0, s.happy - 40); toast(`${v.from} launched a nuclear strike on you!`); log(`${v.from} nuked ${empire.name}.`); }
        else { const def = s.army * 1.5 + n("barracks") * 2; won = v.power > def; if (won) { s.pop *= .7; loot = Math.round(s.coin * .25); s.coin -= loot; s.happy = Math.max(0, s.happy - 20); sur = v.power > def * 3; if (v.impose === "currency") { empire.currency = v.cur; log(`${empire.name} was forced to adopt the ${v.cur}.`); } if (v.impose === "faith") { s.faithOf = v.from; log(`${empire.name} was forced to adopt the faith of ${v.from}.`); } toast(`${v.from} defeated your defenses!`, "army"); log(`${v.from} defeated ${empire.name} in battle.`); } else { s.army = Math.floor(s.army * .8); toast(`You repelled ${v.from}'s attack.`, "army2"); } }
        await updateDoc(d.ref, { resolved: true, won, loot, surrender: sur }); if (sur) return collapse(`surrendered to ${v.from}`); }
      for (const d of (await getDocs(query(collection(db, "claims"), where("fromUid", "==", me.uid)))).docs) { const v = d.data(); if (!v.resolved) continue; s.coin += v.loot || 0; if (v.surrender) { s.rel[v.to] = "vassal"; s.happy = Math.min(100, s.happy + 10); log(`${empire.name} conquered ${v.to}; their currency and faith now follow ${empire.currency}.`); toast(`${v.to} surrendered to you.`, "army"); } else if (v.won && !v.nuke) toast(`Victory over ${v.to}. Looted ${v.loot} coin.`, "army"); else if (!v.nuke) toast(`Your attack on ${v.to} failed.`); await deleteDoc(d.ref); }
    } catch {}
  }
  setInterval(inbox, 20000); setTimeout(inbox, 4000);
  initGround({ ...C, s, empire, marks, play, ui, getOthers: () => others, getRuins: () => ruins });
  // ---- offline catch-up, then live loop ----
  season(); let away = Math.min((Date.now() - last) / 1000 * 60, 60 * 24 * 1440); // cap 60 days
  for (; away > 0 && !dead; away -= 1440) step(Math.min(1440, away));
  quiet = false; refresh().then(render); render(); setInterval(() => { if (!dead) { step(1); render(); } }, 1000); setInterval(save, 15000); setInterval(refresh, 30000);
  addEventListener("beforeunload", save);
}
